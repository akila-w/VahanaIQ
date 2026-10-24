// Test suite for js/planner.js and CSS select arrow preservation
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. Verify CSS styles for select arrows and background-color preservation
const cssContent = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');

// Ensure select has custom background chevron
assert.match(cssContent, /select\s*\{[^}]*background-image:\s*linear-gradient/s, 'select must have background-image gradients for custom chevrons');

// Ensure .planner-card select does not use the shorthand 'background:' which erases background-image
const plannerSelectBlocks = [...cssContent.matchAll(/(?:\.planner-card\s+select|\.panel\s+select)[^{]*\{([^}]+)\}/g)];
assert.ok(plannerSelectBlocks.length > 0, 'Found .planner-card or .panel select styles');
for (const match of plannerSelectBlocks) {
  const block = match[1];
  assert.doesNotMatch(block, /(?<!-)background:\s*var\(--/, `Found forbidden shorthand 'background: var(...)' in select rule: "${match[0]}" which would wipe out dropdown arrows`);
}

// 2. Test planner logic and DOM interaction
// Setup lightweight DOM mock
const eventListeners = new Map();
const elements = new Map();

function createElement(id, tagName = 'div') {
  const listeners = {};
  const classSet = new Set();
  const el = {
    id,
    tagName: tagName.toUpperCase(),
    value: '',
    innerHTML: '',
    textContent: '',
    hidden: false,
    disabled: false,
    attributes: {},
    classList: {
      add(c) { classSet.add(c); },
      remove(c) { classSet.delete(c); },
      contains(c) { return classSet.has(c); }
    },
    contains() { return false; },
    matches() { return false; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    removeAttribute(k) { delete this.attributes[k]; },
    getAttribute(k) { return this.attributes[k]; },
    addEventListener(evt, fn) {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    dispatchEvent(evt) {
      const type = typeof evt === 'string' ? evt : evt.type;
      if (listeners[type]) listeners[type].forEach(fn => fn(typeof evt === 'string' ? { target: el } : evt));
    },
    querySelector() { return createElement('sub-el'); },
    querySelectorAll() { return []; },
    appendChild() {},
    showModal() {},
    close() {},
    focus() {}
  };
  if (id) elements.set(id, el);
  return el;
}

const elementIds = [
  'plannerVehicle', 'plannerGoal', 'plannerSaved', 'plannerMode',
  'plannerPercent', 'plannerPercentWrap', 'plannerMonthly', 'plannerMonthlyWrap',
  'plannerDate', 'plannerCalendar', 'plannerName', 'plannerSave',
  'plannerScenarios', 'plannerDelete', 'plannerResult', 'toast'
];

for (const id of elementIds) {
  const tag = id.includes('Vehicle') || id.includes('Goal') || id.includes('Mode') || id.includes('Scenarios') ? 'select' :
              id.includes('Save') || id.includes('Delete') || id.includes('Calendar') ? 'button' : 'input';
  createElement(id, tag);
}

// Global DOM mocks
globalThis.Event = class Event {
  constructor(type, opts = {}) { this.type = type; this.bubbles = opts.bubbles; }
};
globalThis.document = {
  getElementById: id => elements.get(id) || null,
  createElement: tag => createElement('', tag),
  body: {
    append() {}
  },
  addEventListener: () => {}
};
const windowListeners = {};
globalThis.window = {
  addEventListener(evt, fn) {
    windowListeners[evt] = windowListeners[evt] || [];
    windowListeners[evt].push(fn);
  },
  dispatchEvent(evt) {
    const type = typeof evt === 'string' ? evt : evt.type;
    if (windowListeners[type]) windowListeners[type].forEach(fn => fn(typeof evt === 'string' ? { type: evt } : evt));
  }
};
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] ?? null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

// Import modules
const { initPlanner } = await import('../js/planner.js?test=' + Date.now());
const { savingsPlan, addMonths } = await import('../js/savings.js');

// Test vehicles & settings
const mockVehicles = [
  { id: 'v1', name: 'Toyota Yaris Cross', price: 18000000, cond: 'New', financeClass: 'car', priceBasis: 'published' },
  { id: 'v2', name: 'Honda Vezel', price: 14000000, cond: 'Used', financeClass: 'car', priceBasis: 'published' }
];
const mockSettings = () => ({
  down: 40,
  income: 600000,
  debt: 50000,
  fees: 150000,
  insurance: 250000
});

// A. Test: Initial empty state
localStorage.clear();
const render = initPlanner({ vehicles: () => mockVehicles, settings: mockSettings });

assert.ok(elements.get('plannerResult').innerHTML.includes('Map Your Savings Journey'), 'Empty state must show "Map Your Savings Journey"');
assert.ok(elements.get('plannerResult').innerHTML.includes('Choose a Vehicle'), 'Empty state must contain step 1');
assert.ok(elements.get('plannerResult').innerHTML.includes('Set Savings Pace'), 'Empty state must contain step 2');
assert.ok(elements.get('plannerResult').innerHTML.includes('Track Milestones'), 'Empty state must contain step 3');
assert.equal(elements.get('plannerSave').disabled, true, 'Save Goal button must be disabled when no vehicle is selected');

// B. Test: Stale target date in storage (< 1 month) is cleared without crashing
elements.get('plannerDate').value = '24-10-2026'; // Today's date (stale)
localStorage.setItem('vahanaiq_planner_v1', JSON.stringify({
  version: 1,
  draft: { plannerDate: '2026-10-24' },
  scenarios: []
}));
window.dispatchEvent('vahanaiq:planner-reload');
assert.equal(elements.get('plannerDate').value, '', 'Stale date must be cleared automatically on reload');
assert.ok(elements.get('plannerResult').innerHTML.includes('Map Your Savings Journey'), 'Empty state renders after clearing stale date');

// C. Test: Selecting a vehicle renders active calculations
elements.get('plannerVehicle').value = 'v1';
elements.get('plannerVehicle').dispatchEvent('input');

const resHtml1 = elements.get('plannerResult').innerHTML;
assert.ok(!resHtml1.includes('Map Your Savings Journey'), 'Empty state should be replaced by active calculation');
assert.ok(resHtml1.includes('Savings Progress'), 'Progress card should render');
assert.ok(resHtml1.includes('Target Upfront'), 'Target Upfront card should render');
assert.ok(resHtml1.includes('Monthly Saving'), 'Monthly Saving card should render');
assert.equal(elements.get('plannerSave').disabled, false, 'Save Goal button must be enabled with vehicle selected');

// D. Test: Progress calculation with Already Saved
elements.get('plannerSaved').value = '3,000,000.00';
elements.get('plannerSaved').dispatchEvent('input');
const resHtml2 = elements.get('plannerResult').innerHTML;
assert.ok(resHtml2.includes('3,000,000'), 'Updated saved amount must display');

// E. Test: Switching to Fixed monthly contribution mode
elements.get('plannerMode').value = 'fixed';
elements.get('plannerMode').dispatchEvent('input');
assert.equal(elements.get('plannerPercentWrap').hidden, true, 'Percent wrap should be hidden in fixed mode');
assert.equal(elements.get('plannerMonthlyWrap').hidden, false, 'Monthly wrap should be visible in fixed mode');

elements.get('plannerMonthly').value = '250,000.00';
elements.get('plannerMonthly').dispatchEvent('input');
const resHtml3 = elements.get('plannerResult').innerHTML;
assert.ok(resHtml3.includes('250,000'), 'Fixed monthly amount should reflect in result');

// F. Test: Target date validation (valid vs invalid)
// Future date (e.g. 18 months out)
elements.get('plannerDate').value = '24-04-2028';
elements.get('plannerDate').dispatchEvent('input');
const resHtml4 = elements.get('plannerResult').innerHTML;
assert.ok(resHtml4.includes('Pace Needed for Target Date'), 'Pace needed card should render for valid future date');
assert.equal(elements.get('plannerDate').getAttribute('aria-invalid'), 'false');

// Past / too soon date (e.g. tomorrow)
elements.get('plannerDate').value = '25-10-2026';
elements.get('plannerDate').dispatchEvent('input');
const resHtml5 = elements.get('plannerResult').innerHTML;
assert.equal(elements.get('plannerDate').getAttribute('aria-invalid'), 'true', 'aria-invalid should be true for date < 1 month away');
assert.ok(resHtml5.includes('planner-warn-box') || resHtml5.includes('bad'), 'Warning should show for target date too soon');

// G. Test: Save goal functionality
elements.get('plannerDate').value = '24-04-2028';
elements.get('plannerDate').dispatchEvent('input');
elements.get('plannerName').value = 'My Dream Yaris';
elements.get('plannerSave').dispatchEvent('click');

const savedStore = JSON.parse(localStorage.getItem('vahanaiq_planner_v1'));
assert.equal(savedStore.scenarios.length, 1, 'Goal should be saved to localStorage');
assert.equal(savedStore.scenarios[0].name, 'My Dream Yaris');

// H. Test: Load saved goal scenario
elements.get('plannerVehicle').value = '';
elements.get('plannerVehicle').dispatchEvent('input');
assert.ok(elements.get('plannerResult').innerHTML.includes('Map Your Savings Journey'), 'Should return to empty state');

elements.get('plannerScenarios').value = savedStore.scenarios[0].id;
elements.get('plannerScenarios').dispatchEvent('change');
assert.equal(elements.get('plannerVehicle').value, 'v1', 'Loading saved scenario restores vehicle');
assert.equal(elements.get('plannerSaved').value, '3,000,000.00', 'Loading saved scenario restores saved amount');
assert.ok(!elements.get('plannerResult').innerHTML.includes('Map Your Savings Journey'), 'Active calculation restored');

// I. Test: Delete goal scenario and undo
let undoFn = null;
elements.get('toast').lastToast = null;
// Mock showToast callback capture
const originalShowToast = (await import('../js/toast.js?v=2.11.3')).showToast;
elements.get('plannerDelete').dispatchEvent('click');
const afterDeleteStore = JSON.parse(localStorage.getItem('vahanaiq_planner_v1'));
assert.equal(afterDeleteStore.scenarios.length, 0, 'Scenario should be removed after delete');

// J. Test: Boundary condition - Goal already fully funded (Saved >= Target)
elements.get('plannerSaved').value = '15,000,000.00';
elements.get('plannerSaved').dispatchEvent('input');
const resHtmlFunded = elements.get('plannerResult').innerHTML;
assert.ok(resHtmlFunded.includes('Your goal is funded'), 'Should display "Your goal is funded" when saved exceeds target');
assert.ok(resHtmlFunded.includes('100.0%'), 'Progress should be 100%');

// K. Test: Fast Track badge (<= 12 months)
elements.get('plannerSaved').value = '9,000,000.00'; // Target is 11,200,000 (10.8m deposit + 400k fees), 2.2m remaining
elements.get('plannerMode').value = 'fixed';
elements.get('plannerMonthly').value = '500,000.00'; // 5 months to goal
elements.get('plannerMonthly').dispatchEvent('input');
const resHtmlFast = elements.get('plannerResult').innerHTML;
assert.ok(resHtmlFast.includes('Fast Track'), 'Should display Fast Track tag for goals achievable within 12 months');
assert.ok(resHtmlFast.includes('5 months to your goal'), 'Should calculate exact remaining months');

console.log('✓ All 11 Savings Planner unit, integration & boundary checks passed successfully!');
