import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ trace: process.env.RATE_TRACE === '1' ? 'on' : 'retain-on-failure', screenshot: 'only-on-failure' });
const BASE=process.env.BASE_URL||'http://127.0.0.1:8123';
async function selectCars(page) {
 await page.getByRole('button',{name:'Start Guided Setup (Takes 2 min) →',exact:true}).click();
 const search = page.getByRole('searchbox', { name: 'Search vehicles', exact: true });
 for (const [index, name] of ['Toyota Aqua', 'Toyota Camry Hybrid'].entries()) {
  await search.fill(name);
  const card = page.locator('.onboarding-car').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const add = card.getByRole('button', { name: '+ Add to Shortlist', exact: true });
  // A separate scroll can leave WebKit's fractional modal scrollport oscillating
  // by one pixel. Click performs its own visibility, stability and hit-target
  // checks and scrolling; verify the selected replacement button stays in view.
  await add.click();
  await expect(card.locator('.onboarding-car-btn')).toBeInViewport();
  await expect(page.locator('.onboarding-tray')).toContainText(`${index + 1} of 12 selected`);
  if (index === 0) await expect(page.getByRole('button', { name: 'Continue to Loan Terms →' })).toBeDisabled();
 }
 await page.getByRole('button',{name:'Continue to Loan Terms →'}).click();
}
// Observe the real completion event and normal persisted state; no production hooks.
async function reviewedTerms(page, testInfo, deferFocus = false) {
 const checkpoints = [];
 let handoff = [];
 await page.addInitScript(deferFocus => {
  window.__reviewedRate = [];
  window.addEventListener('vahanaiq:onboarding-complete', event => {
   const payloadRate = event.detail.terms.rate;
   window.__reviewedRate.push({ phase: 'completion-payload', payloadRate });
   queueMicrotask(() => window.__reviewedRate.push({ phase: 'completion-listeners-applied', payloadRate, calculatorRate: document.querySelector('#rate').value }));
  });
  if (deferFocus) {
   const raf = window.requestAnimationFrame.bind(window), pending = [];
   window.requestAnimationFrame = callback => {
    if (new Error().stack.includes('/js/onboarding.js')) { pending.push(callback); return -pending.length; }
    return raf(callback);
   };
   window.__flushStepFocus = () => {
    const count = pending.length;
    pending.splice(0).forEach(callback => callback(performance.now()));
    return count;
   };
  }
 }, deferFocus);
 const draftRate = () => page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_onboarding_draft_v1') || '{}').terms?.rate);
 const snapshot = async phase => checkpoints.push(await page.evaluate(phase => ({ phase, fieldRate: document.querySelector('#onboarding .onboarding-terms-form input')?.value, draftRate: JSON.parse(localStorage.getItem('vahanaiq_onboarding_draft_v1') || '{}').terms?.rate, calculatorRate: document.querySelector('#rate')?.value, active: document.activeElement?.tagName }), phase));
 try {
  await page.goto(BASE + '/index.html');
  await expect(page.locator('#onboarding')).toBeVisible();
  await selectCars(page);
  const rate = page.getByLabel('Annual Interest Rate (%)', { exact: true });
  if (deferFocus) {
   // Deliver the queued render callback between the selection and text phases
   // of a number fill. Before the fix this takes focus away from the rate field.
   await rate.selectText();
   await expect(rate).toBeFocused();
   expect(await page.evaluate(() => window.__flushStepFocus())).toBeGreaterThan(0);
   await expect(rate).toBeFocused();
   await page.keyboard.insertText('12');
  } else await rate.fill('12');
  await snapshot('after-fill');
  await expect(rate).toHaveValue('12');
  await expect.poll(draftRate).toBe('12');
  await page.getByRole('button', { name: 'Continue to Affordability Check →', exact: true }).click();
  await snapshot('after-leaving-field');
  expect(await draftRate()).toBe('12');
  await page.getByRole('button', { name: 'Skip Income', exact: true }).click();
  await expect(page.locator('.onboarding-result')).toHaveCount(2);
  await snapshot('before-completion');
  expect(await draftRate()).toBe('12');
  await page.getByRole('button', { name: 'Open My Lease →', exact: true }).click();
  await expect(page.locator('#onboarding')).toHaveCount(0);
  await expect(page.locator('#rows tr')).toHaveCount(2);
  await expect(page.locator('#rate')).toHaveValue('12');
  handoff = await page.evaluate(() => window.__reviewedRate);
  expect(handoff).toEqual([
   { phase: 'completion-payload', payloadRate: '12' },
   { phase: 'completion-listeners-applied', payloadRate: '12', calculatorRate: '12' }
  ]);
  await snapshot('calculator-applied');
  // Save is deliberately debounced: wait for durable state before testing reload.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_inputs_v1') || '{}').rate)).toBe('12');
  await page.screenshot({ path: testInfo.outputPath('reviewed-rate.png') });
  await page.reload();
  await expect(page.locator('#onboarding')).toHaveCount(0);
  await expect(page.locator('#rows tr')).toHaveCount(2);
  await expect(page.locator('#rate')).toHaveValue('12');
  await snapshot('after-reload');
 } finally {
  if (!handoff.length) handoff = await page.evaluate(() => window.__reviewedRate).catch(() => []);
  await writeFile(testInfo.outputPath('reviewed-rate-state.json'), JSON.stringify({ deferFocus, checkpoints, handoff }, null, 2));
 }
}

test('guided setup requires a shortlist and applies reviewed terms to real comparison', async ({ page }, testInfo) => {
 await reviewedTerms(page, testInfo);
});
test('deferred step focus preserves the rate being entered', async ({ page }, testInfo) => {
 await reviewedTerms(page, testInfo, true);
});
test('draft survives reload and direct catalogue entry uses the same required flow',async({page})=>{
 await test.step('Open Catalogue setup and select two cars', async () => {
  await page.goto(BASE+'/catalogue.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#onboarding')).toBeVisible();
  await selectCars(page);
  await expect(page.locator('#onboardingTitle')).toHaveText('Set your lease financing terms');
 });
 await test.step('Reload the page and recover the finance step', async () => {
  // Setup is ready when its own controls render; optional external SDKs do not
  // need to finish downloading for a saved draft to be restored.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#onboardingTitle')).toHaveText('Set your lease financing terms');
 });
 await test.step('Return to the shortlist and enforce the two-car minimum', async () => {
  await page.getByRole('button',{name:'← Back',exact:true}).click();
  await expect(page.locator('.onboarding-tray')).toContainText('2 of 12 selected');
  await page.getByRole('button',{name:/Remove Toyota Aqua/}).click();
  await expect(page.getByRole('button',{name:'Continue to Loan Terms →'})).toBeDisabled();
 });
});
test('existing comparisons survive without compulsory setup',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('vahanaiq_comparison_v3',JSON.stringify({version:3,cars:[{id:'existing-car',name:'Existing car',price:10000000,cond:'New'}]})));
 await page.goto(BASE+'/index.html');await expect(page.locator('#onboarding')).toHaveCount(0);await expect(page.locator('#rows')).toContainText('Existing car');
});
test('required flow fits a narrow phone',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto(BASE+'/index.html');await page.getByRole('button',{name:'Start Guided Setup (Takes 2 min) →',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);await expect(page.getByRole('button',{name:'Continue to Loan Terms →'})).toBeInViewport();
});

test('all five onboarding progress steps stay visible on narrow phones', async ({ page }) => {
 await mkdir('qa/2026-10-28-uiux', { recursive: true });
 const layouts = [];
 for (const [width, height] of [[320, 568], [360, 800], [375, 812], [390, 844], [430, 932]]) {
  await page.setViewportSize({ width, height });
  await page.goto(BASE + '/index.html');
  const steps = page.locator('#onboarding .onboarding-step-pill');
  await expect(steps).toHaveCount(5);
  await page.locator('#onboarding').evaluate(el => Promise.all(el.getAnimations().filter(a => a.effect?.target === el).map(a => a.finished)));
  const legacyStyle = await page.addStyleTag({ content: `@media (max-width:600px) {
   .onboarding-head { display:flex; justify-content:space-between; gap:16px; }
   .onboarding-stepper { justify-content:flex-start; gap:12px; }
   .onboarding-progress-bar { left:12px; right:12px; }
   .onboarding-step-pill { width:auto; height:auto; min-width:0; padding:4px 10px; }
   .onboarding-close-btn { width:34px; height:34px; margin-left:auto; }
  }` });
  await page.screenshot({ path: `qa/2026-10-28-uiux/onboarding-before-${width}.png` });
  await legacyStyle.evaluate(el => el.remove());
  await page.screenshot({ path: `qa/2026-10-28-uiux/onboarding-after-${width}.png` });
  const boxes = await steps.evaluateAll(items => items.map(item => {
   const rect = item.getBoundingClientRect();
   return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
  }));
  layouts.push({ width, boxes });
 }
 for (const { width, boxes } of layouts) {
  for (const [index, box] of boxes.entries()) {
   expect(box.width, `step ${index + 1} width at ${width}px`).toBeGreaterThanOrEqual(44);
   expect(box.height, `step ${index + 1} height at ${width}px`).toBeGreaterThanOrEqual(44);
   expect(box.left, `step ${index + 1} left edge at ${width}px`).toBeGreaterThanOrEqual(0);
   expect(box.right, `step ${index + 1} right edge at ${width}px`).toBeLessThanOrEqual(width);
  }
 }
});

test('history renders only comparable reviewed observations and handles missing history',async({page})=>{
 await page.goto(BASE+'/index.html');
 const result=await page.evaluate(async()=>{
  const {mountPriceHistory}=await import('/js/price-history.js?v=2.12.0');
  const host=document.createElement('div');
  const point={modelId:'fixture',offerId:'offer',seriesId:'series',sourceUrl:'https://example.com/price',observedOn:'2026-09-01',amount:10000000,currency:'LKR',kind:'official',reviewed:true,year:'2026',trim:'Base',condition:'New',route:'Distributor'};
  mountPriceHistory(host,'fixture',[point,{...point,amount:9000000,observedOn:'2026-10-01'}]);
  const populated={text:host.textContent,rows:host.querySelectorAll('tbody tr').length,chart:!!host.querySelector('svg'),source:host.querySelector('a').href};
  host.replaceChildren();mountPriceHistory(host,'fixture',[]);
  return {populated,empty:host.textContent};
 });
 expect(result.populated.text).toContain('-10.0%');expect(result.populated.text).toContain('01/09/2026');expect(result.populated.rows).toBe(2);expect(result.populated.chart).toBe(true);expect(result.populated.source).toBe('https://example.com/price');expect(result.empty).toContain('no verified historical observations');
});

test('first-use setup is optional and Escape dismisses it', async ({ page }) => {
 await page.goto(BASE+'/index.html');
 await expect(page.locator('#onboarding')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#onboarding')).toHaveCount(0);
 await page.reload();
 await expect(page.locator('#onboarding')).toHaveCount(0);
});

for (const route of ['catalogue', 'studio']) test(`setup from ${route} preserves saved vehicles and other financing settings`, async ({ page }) => {
 await page.addInitScript(() => {
  if (localStorage.getItem('vahanaiq_comparison_v3')) return;
  localStorage.setItem('vahanaiq_comparison_v3', JSON.stringify({ version: 3, cars: [{ id: 'saved-car', name: 'Saved vehicle', price: 9000000, cond: 'New' }] }));
  localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ insurance: '120000', fees: '45000', dti: '0.5' }));
 });
 await page.goto(`${BASE}/${route}.html?onboarding=1`);
 await selectCars(page);
 await page.getByRole('button', { name: 'Continue to Affordability Check →' }).click();
 await page.getByRole('button', { name: 'Skip Income' }).click();
 await page.getByRole('button', { name: 'Open My Lease →' }).click();
 await expect(page.locator('#rows tr')).toHaveCount(3);
 await expect(page.locator('#rows')).toContainText('Saved vehicle');
 const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_inputs_v1')));
 expect(saved).toMatchObject({ insurance: '120000', fees: '45000', dti: '0.5' });
});

test('repeated Guided Setup clicks create only one dialog per click', async ({ page }) => {
 await page.goto(BASE+'/index.html');
 await expect(page.locator('#onboarding')).toBeVisible();
 await page.evaluate(() => {
  window.setupInsertions = 0;
  new MutationObserver(records => {
   for (const record of records) for (const node of record.addedNodes) if (node.id === 'onboarding') window.setupInsertions++;
  }).observe(document.body, { childList: true });
 });
 for (let index = 1; index <= 5; index++) {
  await page.locator('#onboarding').getByRole('button', { name: 'Exit to Lease', exact: true }).click();
  await page.locator('#restartOnboardingBtn').click();
  await expect(page.locator('#onboarding')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.setupInsertions)).toBe(index);
 }
});

test('completing setup starts the Calculator tour and preserves existing cost settings', async ({ page }) => {
 await page.addInitScript(() => localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ insurance: '120000', fees: '45000' })));
 await page.goto(BASE+'/index.html');
 await selectCars(page);
 await page.getByRole('button', { name: 'Continue to Affordability Check →' }).click();
 await page.getByRole('button', { name: 'Skip Income' }).click();
 await page.getByRole('button', { name: 'Take a 60-Second Guided Tour' }).click();
 await expect(page.locator('#onboarding')).toHaveCount(0);
 await expect(page.locator('#guidedTour')).toBeVisible();
 await expect(page.locator('#guidedTour')).toContainText('1 of 4');
 const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_inputs_v1')));
 expect(saved).toMatchObject({ insurance: '120000', fees: '45000' });
});
