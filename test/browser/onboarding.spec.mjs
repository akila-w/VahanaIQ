import { test, expect } from '@playwright/test';
import { seedStudioAdmin, blockFirebase, ADMIN_UID, ONBOARDING_KEY } from './returning-user.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ trace: process.env.RATE_TRACE === '1' ? 'on' : 'retain-on-failure', screenshot: 'only-on-failure' });
const BASE=process.env.BASE_URL||'http://127.0.0.1:8123';
// First visits to the Lease page open on the landing introduction; Get Started opens setup.
async function startFromLanding(page) {
 await expect(page.locator('#landing')).toBeVisible();
 await page.locator('#landing').getByRole('button',{name:'Get Started',exact:true}).first().click();
 await expect(page.locator('#onboarding')).toBeVisible();
}
async function selectCars(page) {
 const search = page.getByRole('searchbox', { name: 'Search vehicles', exact: true });
 for (const [index, name] of ['Toyota Aqua', 'Toyota Camry Hybrid'].entries()) {
  await search.fill(name);
  const add = page.locator('.onboarding-car').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('button', { name: '+ Add to Shortlist', exact: true });
  await add.scrollIntoViewIfNeeded();
  await expect(add).toBeInViewport();
  await add.click();
  await expect(page.locator('.onboarding-tray')).toContainText(`${index + 1} of 12 selected`);
  if (index === 0) await expect(page.getByRole('button', { name: 'Continue to Income →' })).toBeDisabled();
 }
 await page.getByRole('button',{name:'Continue to Income →'}).click();
}
// Income is optional; the rate is on Loan Length, after it.
async function toResult(page) {
 await page.getByRole('button', { name: 'Skip Income', exact: true }).click();
 await page.getByRole('button', { name: 'Continue to Down Payment →', exact: true }).click();
 await page.getByRole('button', { name: 'See My Result →', exact: true }).click();
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
  await startFromLanding(page);
  await selectCars(page);
  await page.getByRole('button', { name: 'Skip Income', exact: true }).click();
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
  await page.getByRole('button', { name: 'Continue to Down Payment →', exact: true }).click();
  await snapshot('after-leaving-field');
  expect(await draftRate()).toBe('12');
  await page.getByRole('button', { name: 'See My Result →', exact: true }).click();
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
  await expect(page.locator('#onboardingTitle')).toHaveText('What do you take home each month?');
 });
 await test.step('Reload the page and recover the finance step', async () => {
  // Setup is ready when its own controls render; optional external SDKs do not
  // need to finish downloading for a saved draft to be restored.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#onboardingTitle')).toHaveText('What do you take home each month?');
 });
 await test.step('Return to the shortlist and enforce the two-car minimum', async () => {
  await page.getByRole('button',{name:'← Back',exact:true}).click();
  await expect(page.locator('.onboarding-tray')).toContainText('2 of 12 selected');
  await page.getByRole('button',{name:/Remove Toyota Aqua/}).click();
  await expect(page.getByRole('button',{name:'Continue to Income →'})).toBeDisabled();
 });
});
test('existing comparisons survive without compulsory setup',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('vahanaiq_comparison_v3',JSON.stringify({version:3,cars:[{id:'existing-car',name:'Existing car',price:10000000,cond:'New'}]})));
 await page.goto(BASE+'/index.html');await expect(page.locator('#onboarding')).toHaveCount(0);await expect(page.locator('#rows')).toContainText('Existing car');
});
test('required flow fits a narrow phone',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto(BASE+'/index.html');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);await startFromLanding(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);await expect(page.getByRole('button',{name:'Continue to Income →'})).toBeInViewport();
});

test('all five onboarding progress steps stay visible on narrow phones', async ({ page }) => {
 await mkdir('qa/2026-10-28-uiux', { recursive: true });
 const layouts = [];
 for (const [width, height] of [[320, 568], [360, 800], [375, 812], [390, 844], [430, 932]]) {
  await page.setViewportSize({ width, height });
  await page.goto(BASE + '/index.html?onboarding=1');
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
 await startFromLanding(page);
 await page.keyboard.press('Escape');
 await expect(page.locator('#onboarding')).toHaveCount(0);
 await expect(page.locator('#landing')).toBeHidden();
 await page.reload();
 await expect(page.locator('#onboarding')).toHaveCount(0);
 await expect(page.locator('#landing')).toBeHidden();
});

for (const route of ['catalogue', 'studio']) test(`setup from ${route} preserves saved vehicles and other financing settings`, async ({ page }) => {
 if (route === 'studio') { await seedStudioAdmin(page.context()); await blockFirebase(page.context()); }
 await page.addInitScript(() => {
  if (localStorage.getItem('vahanaiq_comparison_v3')) return;
  localStorage.setItem('vahanaiq_comparison_v3', JSON.stringify({ version: 3, cars: [{ id: 'saved-car', name: 'Saved vehicle', price: 9000000, cond: 'New' }] }));
  localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ insurance: '120000', fees: '45000', dti: '0.5' }));
 });
 await page.goto(`${BASE}/${route}.html?onboarding=1`);
 await selectCars(page);
 await toResult(page);
 await page.getByRole('button', { name: 'Open My Lease →' }).click();
 await expect(page.locator('#rows tr')).toHaveCount(3);
 await expect(page.locator('#rows')).toContainText('Saved vehicle');
 const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_inputs_v1')));
 expect(saved).toMatchObject({ insurance: '120000', fees: '45000', dti: '0.5' });
});

test('repeated Guided Setup clicks create only one dialog per click', async ({ page }) => {
 await page.goto(BASE+'/index.html');
 await startFromLanding(page);
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
 await startFromLanding(page);
 await selectCars(page);
 await toResult(page);
 await page.getByRole('button', { name: 'Take a 60-Second Guided Tour' }).click();
 await expect(page.locator('#onboarding')).toHaveCount(0);
 await expect(page.locator('#guidedTour')).toBeVisible();
 await expect(page.locator('#guidedTour')).toContainText('1 of 4');
 const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_inputs_v1')));
 expect(saved).toMatchObject({ insurance: '120000', fees: '45000' });
});

test('first visit opens on the landing introduction with real Showroom cars', async ({ page }) => {
 await page.goto(BASE + '/index.html');
 await expect(page.locator('#landingTitle')).toHaveText('See the monthly lease rental of any car in Sri Lanka.');
 await expect(page.locator('.site-header')).toBeHidden();
 await expect(page.locator('#onboarding')).toHaveCount(0);
 // Each belt holds its cars twice for the loop; only the first copy is exposed.
 const tiles = page.locator('#landingRowA li:not([aria-hidden="true"]) .landing-tile');
 expect(await tiles.count()).toBeGreaterThanOrEqual(2);
 await expect(tiles.first()).toContainText(/LKR [\d,]+ \/mo/);
 await expect(page.locator('#landingRowA li[aria-hidden="true"] a').first()).toHaveAttribute('tabindex', '-1');
 await expect(page.locator('#landingExample')).toBeVisible();
 await startFromLanding(page);
 await expect(page.locator('#onboardingTitle')).toHaveText('Which cars are you considering?');
});

test('leaving the landing for the planner dismisses it for good', async ({ page }) => {
 await page.goto(BASE + '/index.html');
 await page.locator('#landing').getByRole('link', { name: 'Lease Planner', exact: true }).click();
 await expect(page.locator('#landing')).toBeHidden();
 await expect(page.locator('.site-header')).toBeVisible();
 await expect(page.locator('#onboarding')).toHaveCount(0);
 await page.reload();
 await expect(page.locator('#landing')).toBeHidden();
 await expect(page.locator('#onboarding')).toHaveCount(0);
});

test('returning visitors and direct setup links skip the landing', async ({ page }) => {
 await page.goto(BASE + '/index.html?onboarding=1');
 await expect(page.locator('#landing')).toBeHidden();
 await expect(page.locator('#onboarding')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.goto(BASE + '/index.html');
 await expect(page.locator('#landing')).toBeHidden();
 await page.goto(BASE + '/index.html?welcome');
 await expect(page.locator('#landing')).toBeVisible();
});

test('quick picks add real catalogue cars to the shortlist', async ({ page }) => {
 await page.goto(BASE + '/index.html');
 await startFromLanding(page);
 await page.getByRole('button', { name: /Compact SUVs/ }).click();
 await expect(page.locator('.onboarding-tray')).toContainText('2 of 12 selected');
 await expect(page.getByRole('button', { name: 'Continue to Income →' })).toBeEnabled();
});

test('landing pauses its motion and stops it for reduced motion', async ({ page }) => {
 await page.goto(BASE + '/index.html');
 await page.getByRole('button', { name: 'Pause Animation' }).click();
 await expect(page.locator('#landingRowA')).toHaveCSS('animation-play-state', 'paused');
 await expect(page.getByRole('button', { name: 'Play Animation' })).toHaveAttribute('aria-pressed', 'true');
 await page.emulateMedia({ reducedMotion: 'reduce' });
 await page.reload();
 await expect(page.locator('#landingRowA')).toHaveCSS('animation-name', 'none');
 await expect(page.locator('#landingRowA li[aria-hidden="true"]').first()).toBeHidden();
});

test('visitors and other accounts get a not-found page that does not name the studio', async ({ page }) => {
 for (const record of [null, 'someone-else']) {
  if (record) await page.addInitScript(uid => localStorage.setItem('vahanaiq_account_v1', uid), record);
  await page.goto(BASE + '/studio.html');
  await expect(page.locator('h1').first()).toHaveText('Page not found');
  await expect(page).toHaveTitle(/Page not found/);
  await expect(page.locator('body')).not.toContainText(/studio/i);
  await expect(page.locator('#models')).toHaveCount(0);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('.header-actions, #restartOnboardingBtn')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Go to the Showroom' })).toHaveAttribute('href', 'catalogue.html');
  await page.goto(BASE + '/catalogue.html');
  await expect(page.locator('a[href*="studio"]')).toHaveCount(0);
 }
});

test('a visitor downloads no studio code and meets no photo tools in the Showroom', async ({ page }) => {
 const requests = [];
 page.on('request', request => requests.push(request.url()));
 await page.goto(BASE + '/studio.html');
 await expect(page.locator('h1').first()).toHaveText('Page not found');
 await page.waitForLoadState('networkidle');
 expect(requests.filter(url => /catalogue-studio\.js|catalogue-data\.js|onboarding\.js|firebase/.test(url))).toEqual([]);
 await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 1, completed: true, step: 4 })), ONBOARDING_KEY);
 await page.goto(BASE + '/catalogue.html');
 await page.locator('[data-open]').first().click();
 await expect(page.locator('#detail')).toBeVisible();
 await expect(page.locator('#galleryToolbar, #galleryStudioBtn')).toHaveCount(0);
 await expect(page.locator('#detail')).not.toContainText(/studio/i);
});

// Firebase answers for the record in this browser: a stand-in SDK says who is really signed in.
const firebaseSays = (context, uid) => context.route(/firebase-(app|auth)\.js/, route => route.fulfill({
 contentType: 'text/javascript',
 headers: { 'Access-Control-Allow-Origin': '*' },
 body: route.request().url().includes('firebase-app')
  ? 'export const getApps = () => []; export const getApp = () => ({}); export const initializeApp = () => ({});'
  : `export const indexedDBLocalPersistence = {}; export const browserLocalPersistence = {};
     export const initializeAuth = () => ({ authStateReady: async () => {}, currentUser: ${JSON.stringify(uid ? { uid } : null)} });`
}));
const adminRecord = (context, uid = ADMIN_UID) => context.addInitScript(([key, record]) => {
 localStorage.setItem(key, JSON.stringify({ version: 1, completed: true, step: 4 }));
 localStorage.setItem('vahanaiq_account_v1', record);
 localStorage.setItem('vahanaiq_account_name_v1', 'Akila');
}, [ONBOARDING_KEY, uid]);

for (const [case_, uid] of [['nobody', null], ['another account', 'someone-else']]) test(`the administrator's record alone does not open the studio when Firebase says ${case_} is signed in`, async ({ browser }) => {
 const context = await browser.newContext({ serviceWorkers: 'block' });
 await adminRecord(context);
 await firebaseSays(context, uid);
 const page = await context.newPage();
 await page.goto(BASE + '/studio.html');
 await expect(page.locator('h1').first()).toHaveText('Page not found');
 await expect(page).toHaveTitle(/Page not found/);
 await expect(page.locator('#models')).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText(/studio/i);
 await context.close();
});

test('the administrator gets the studio, an Admin badge and the links', async ({ browser }) => {
 const context = await browser.newContext({ serviceWorkers: 'block' });
 await adminRecord(context);
 await firebaseSays(context, ADMIN_UID);
 const page = await context.newPage();
 await page.goto(BASE + '/studio.html');
 await expect(page).toHaveTitle(/Photo Studio/);
 await expect(page.locator('#modelList [data-model]').first()).toBeVisible();
 const link = page.locator('nav[aria-label="Main"] a[data-admin-link]');
 await expect(link).toHaveAttribute('aria-current', 'page');
 await expect(link.locator('.admin-badge')).toHaveText('Admin');
 await expect(page.locator('.page-missing')).toHaveCount(0);
 await expect(page.locator('#exportBtn')).toBeVisible();
 await expect(page.locator('#accountBtn')).toHaveText('Akila');
 for (const route of ['index', 'catalogue']) {
  await page.goto(`${BASE}/${route}.html`);
  await expect(page.locator('nav[aria-label="Main"] a[data-admin-link]')).toHaveAttribute('href', 'studio.html');
  await expect(page.locator('nav[aria-label="Explore"] a[data-admin-link]')).toHaveCount(1);
 }
 await page.locator('[data-open]').first().click();
 await expect(page.locator('#galleryStudioBtn')).toBeVisible();
 await page.evaluate(() => { localStorage.removeItem('vahanaiq_account_v1'); window.dispatchEvent(new Event('vahanaiq:account')); });
 await expect(page.locator('a[data-admin-link]')).toHaveCount(0);
 await context.close();
});
