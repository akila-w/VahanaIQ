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
 await page.goto(BASE+'/catalogue.html');await selectCars(page);await page.reload();await expect(page.locator('#onboardingTitle')).toHaveText('Set your lease financing terms');await page.getByRole('button',{name:'← Back',exact:true}).click();await expect(page.locator('.onboarding-tray')).toContainText('2 of 12 selected');
 await page.getByRole('button',{name:/Remove Toyota Aqua/}).click();await expect(page.getByRole('button',{name:'Continue to Loan Terms →'})).toBeDisabled();
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
