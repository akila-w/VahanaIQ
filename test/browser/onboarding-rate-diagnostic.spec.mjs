// Temporary investigation: observe state without changing application assignments.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const sourceRoot = process.env.DIAG_SOURCE_ROOT || process.cwd();
test.use({ trace: 'on', screenshot: 'on' });

test('trace the reviewed onboarding interest rate end to end', async ({ page }, testInfo) => {
  await page.addInitScript(forceFocus => {
    window.__rateLog = [];
    const state = (kind, extra = {}) => {
      const input = document.querySelector('#onboarding .onboarding-terms-form input[type="number"]');
      const parse = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
      window.__rateLog.push({ t: performance.now(), kind, active: document.activeElement?.outerHTML?.slice(0, 180), input: input?.value, terms: window.__rateTerms?.(), draft: parse('vahanaiq_onboarding_draft_v1'), calculator: document.querySelector('#rate')?.value, stored: parse('vahanaiq_inputs_v1'), ...extra });
    };
    window.__rateSnapshot = state;
    if (forceFocus) {
      const raf = window.requestAnimationFrame.bind(window), pending = [];
      window.requestAnimationFrame = callback => {
        if (new Error().stack.includes('/js/onboarding.js')) { pending.push(callback); return -pending.length; }
        return raf(callback);
      };
      window.__releaseStepFocus = () => {
        state('release-deferred-step-focus', { count: pending.length });
        pending.splice(0).forEach(callback => callback(performance.now()));
      };
    }
    for (const event of ['input', 'change', 'focusin', 'focusout', 'pointerdown', 'click']) {
      document.addEventListener(event, e => {
        if (e.target.closest?.('#onboarding') || e.target.id === 'rate') {
          state(event + ':capture', { target: e.target.outerHTML?.slice(0, 180) });
          queueMicrotask(() => state(event + ':after'));
        }
      }, true);
    }
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (...args) {
      const result = focus.apply(this, args);
      if (this.closest?.('#onboarding')) state('focus-call', { target: this.outerHTML.slice(0, 180), stack: new Error().stack });
      return result;
    };
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(HTMLInputElement.prototype, 'value', { ...descriptor, set(value) {
      descriptor.set.call(this, value);
      if (this.id === 'rate' || this.closest('#onboarding')) state('value-set', { value, target: this.outerHTML.slice(0, 180), stack: new Error().stack });
    } });
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      const result = write.call(this, key, value);
      if (key === 'vahanaiq_onboarding_draft_v1' || key === 'vahanaiq_inputs_v1') state('storage-write', { key, value: JSON.parse(value) });
      return result;
    };
    window.addEventListener('vahanaiq:onboarding-complete', e => {
      state('completion:before-listeners', { payload: structuredClone(e.detail) });
      queueMicrotask(() => state('completion:after-listeners', { payload: structuredClone(e.detail) }));
    });
  }, process.env.DIAG_FORCE_FOCUS === '1');
  await page.route('**/js/onboarding.js*', route => {
    const source = fs.readFileSync(path.join(sourceRoot, 'js/onboarding.js'), 'utf8');
    const anchor = "  let models = window.__VAHANAIQ_CATALOGUE__?.models || [];";
    expect(source).toContain(anchor);
    return route.fulfill({ contentType: 'text/javascript', body: source.replace(anchor, "  window.__rateTerms = () => ({ ...terms, step });\n" + anchor) });
  });
  const snapshot = label => page.evaluate(label => window.__rateSnapshot(label), label);
  try {
    await page.goto(BASE + '/index.html');
    await expect(page.locator('#onboarding')).toBeVisible();
    await page.getByRole('button', { name: 'Start Guided Setup (Takes 2 min) →', exact: true }).click();
    const search = page.getByRole('searchbox', { name: 'Search vehicles', exact: true });
    for (const name of ['Toyota Aqua', 'Toyota Camry Hybrid']) {
      await search.fill(name);
      const add = page.locator('.onboarding-car').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('button', { name: '+ Add to Shortlist', exact: true });
      await add.scrollIntoViewIfNeeded(); await expect(add).toBeInViewport(); await add.click();
    }
    await page.getByRole('button', { name: 'Continue to Loan Terms →', exact: true }).click();
    const rate = page.getByLabel('Annual Interest Rate (%)', { exact: true });
    if (process.env.DIAG_FORCE_FOCUS === '1') {
      // The same selection/text phases used by Playwright fill for number inputs,
      // with the application's queued animation-frame callback delivered between.
      await rate.selectText();
      await snapshot('field-selected-before-deferred-focus');
      await page.evaluate(() => window.__releaseStepFocus());
      await page.keyboard.insertText('12');
    } else await rate.fill('12');
    await snapshot('after-fill');
    await page.getByRole('button', { name: 'Continue to Affordability Check →', exact: true }).click();
    await snapshot('after-leaving-field');
    await page.getByRole('button', { name: 'Skip Income', exact: true }).click();
    await snapshot('comparison-step');
    await expect(page.locator('.onboarding-result')).toHaveCount(2);
    await snapshot('before-completion');
    await page.getByRole('button', { name: 'Open My Lease →', exact: true }).click();
    await snapshot('after-completion');
    await expect(page.locator('#onboarding')).toHaveCount(0);
    await expect(page.locator('#rows tr')).toHaveCount(2);
    await expect(page.locator('#rate')).toHaveValue('12');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_inputs_v1') || '{}').rate)).toBe('12');
    await page.screenshot({ path: testInfo.outputPath('completed.png'), fullPage: true });
    const state = await page.evaluate(() => window.__rateLog);
    await testInfo.attach('rate-state-before-reload.json', { body: JSON.stringify(state, null, 2), contentType: 'application/json' });
    await page.reload();
    await expect(page.locator('#rate')).toHaveValue('12');
  } finally {
    const state = await page.evaluate(() => window.__rateLog).catch(() => []);
    console.log(JSON.stringify({ source: process.env.DIAG_LABEL || 'head', checkpoints: state.filter(e => ['after-fill', 'after-leaving-field', 'comparison-step', 'before-completion', 'completion:after-listeners', 'after-completion'].includes(e.kind)) }));
    await testInfo.attach('rate-state.json', { body: JSON.stringify(state, null, 2), contentType: 'application/json' });
    await page.screenshot({ path: testInfo.outputPath('final.png'), fullPage: true }).catch(() => {});
  }
});
