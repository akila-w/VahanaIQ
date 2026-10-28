import { test, expect } from '@playwright/test';
const BASE=process.env.BASE_URL||'http://127.0.0.1:8123';
async function selectCars(page) {
 await page.getByRole('button',{name:'Start Guided Setup (Takes 2 min) →',exact:true}).click();
 const search = page.getByRole('searchbox', { name: 'Search vehicles', exact: true });
 for (const [index, name] of ['Toyota Aqua', 'Toyota Camry Hybrid'].entries()) {
  await search.fill(name);
  const add = page.locator('.onboarding-car').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('button', { name: '+ Add to Shortlist', exact: true });
  await add.scrollIntoViewIfNeeded();
  await expect(add).toBeInViewport();
  await add.click();
  await expect(page.locator('.onboarding-tray')).toContainText(`${index + 1} of 12 selected`);
  if (index === 0) await expect(page.getByRole('button', { name: 'Continue to Loan Terms →' })).toBeDisabled();
 }
 await page.getByRole('button',{name:'Continue to Loan Terms →'}).click();
}
test('guided setup requires a shortlist and applies reviewed terms to real comparison',async({page})=>{
 await page.goto(BASE+'/index.html');await expect(page.locator('#onboarding')).toBeVisible();
 await selectCars(page);await page.getByLabel('Annual Interest Rate (%)',{exact:true}).fill('12');await page.getByRole('button',{name:'Continue to Affordability Check →'}).click();await page.getByRole('button',{name:'Skip Income'}).click();await expect(page.locator('.onboarding-result')).toHaveCount(2);
 await page.getByRole('button',{name:'Open My Lease →'}).click();await expect(page.locator('#onboarding')).toHaveCount(0);await expect(page.locator('#rows tr')).toHaveCount(2);await expect(page.locator('#rate')).toHaveValue('12');await page.reload();await expect(page.locator('#onboarding')).toHaveCount(0);
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
