import { test, expect } from '@playwright/test';

import { seedReturning } from './returning-user.mjs';
test.beforeEach(async ({context}) => { await seedReturning(context); });

import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const OUT = path.resolve('qa/2026-10-27-independent');
const widths = [320, 360, 375, 390, 414, 430, 600, 768, 979, 980, 1024, 1280, 1365, 1366, 1440, 1920];
const routes = ['index', 'catalogue', 'studio', 'about', 'privacy', 'terms'];
fs.mkdirSync(OUT, { recursive: true });

for (const width of widths) for (const theme of ['light', 'dark']) {
  test(`all six routes at ${width}px in ${theme}`, async ({ browser, browserName }) => {
    test.setTimeout(60000);
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
    await seedReturning(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const measurements = [];
    for (const route of routes) {
      await page.goto(`${BASE}/${route}.html`);
      await expect(page.locator('#helpCentreButton')).toBeVisible();
      await page.waitForTimeout(200);
      const measurement = await page.evaluate(() => {
        const rect = el => el.getBoundingClientRect();
        const outside = [...document.querySelectorAll('h1, h2, .header-actions, .metrics, .guide-invitation, .telemetry-card-val, .afford-stat-val, .site-header button, .info-header > *')].filter(el => {
          const r = rect(el);
          return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1);
        }).map(el => ({ element: el.id || el.className || el.tagName, text: el.textContent.slice(0, 80), left: rect(el).left, right: rect(el).right }));
        const terms = document.querySelector('#loanTermsHead'), budget = document.querySelector('#budgetPanel');
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, outside, welcomeInHero: !!document.querySelector('.hero > .guide-invitation'), columns: terms && budget ? Math.abs(rect(terms).top - rect(budget).top) : null };
      });
      measurements.push({ route, ...measurement });
      expect.soft(measurement.scrollWidth, `${route}: page overflow`).toBeLessThanOrEqual(width);
      expect.soft(measurement.outside, `${route}: clipped headings/controls`).toEqual([]);
      if (route === 'index' && width >= 1366) {
        expect.soft(measurement.welcomeInHero).toBe(true);
        expect.soft(measurement.columns, 'loan terms and budget start at same vertical position').toBeLessThanOrEqual(1);
      }
      if (['about', 'privacy', 'terms'].includes(route)) {
        const info = await page.locator('main').evaluate(el => ({ display: getComputedStyle(el).display, width: el.clientWidth, sectionWidth: el.querySelector('.info-sections').clientWidth, padding: parseFloat(getComputedStyle(el).paddingLeft) }));
        expect.soft(info.display).toBe('block');
        expect.soft(Math.abs(info.sectionWidth - (info.width - 2 * info.padding))).toBeLessThanOrEqual(1);
      }
      if (route === 'studio') {
        const colors = await page.locator('#modelSearch').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, expected: getComputedStyle(document.documentElement).getPropertyValue('--select-bg').trim() }));
        // Compare through a canvas-normalised colour in the page; no screenshot-only inference.
        const matches = await page.locator('#modelSearch').evaluate(el => {
          const probe = document.createElement('span'); probe.style.backgroundColor = 'var(--select-bg)'; document.body.append(probe);
          const equal = getComputedStyle(probe).backgroundColor === getComputedStyle(el).backgroundColor; probe.remove(); return equal;
        });
        expect.soft(matches, JSON.stringify(colors)).toBe(true);
      }
      if (process.env.CAPTURE_QA === '1' && [320, 390, 600, 768, 1440, 1920].includes(width)) {
        await page.screenshot({ path: path.join(OUT, `${browserName}-${width}-${theme}-${route}.png`) });
      }
      await page.locator('#helpCentreButton').click();
      await expect(page.locator('#helpCentre')).toBeVisible();
      const help = await page.locator('#helpCentre').boundingBox();
      expect.soft(help.x).toBeGreaterThanOrEqual(-1);
      expect.soft(help.x + help.width).toBeLessThanOrEqual(width + 1);
      await page.keyboard.press('Escape');
    }
    fs.writeFileSync(path.join(OUT, `${browserName}-${width}-${theme}-measurements.json`), JSON.stringify({ measurements, errors }, null, 2));
    expect(errors).toEqual([]);
    await context.close();
  });
}

const fixture = { id: 'qa-example', name: 'Independent QA example', price: 7269515.4, cond: 'New', pt: 'Petrol', w: 'Official', img: '', custom: true };
async function seed(page, inputs, car = fixture) {
  await page.addInitScript(({ inputs, car }) => {
    localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify(inputs));
    localStorage.setItem('vahanaiq_comparison_v3', JSON.stringify({ version: 3, cars: [car] }));
    localStorage.setItem('vahanaiq_guidance_v1', JSON.stringify({ version: 1, welcomed: true, tips: false, tours: {} }));
  }, { inputs, car });
}

test('all gauge boundaries and the exact overflow example render actual values', async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { income: '220000', rate: '0', tenure: '12', down: '60' });
  await page.goto(`${BASE}/index.html`);
  await expect(page.locator('#budgetDtiHero')).toHaveText('110.1% DTI');
  await expect(page.locator('#budgetCashflowLabel')).toContainText('Monthly shortfall: LKR 22,317.18');
  await expect(page.locator('#budgetCashflowBar')).toHaveAttribute('aria-label', /110.1%.*22,317.18/);
  await page.waitForTimeout(300);
  await page.locator('#budgetGraphic').screenshot({ path: path.join(OUT, `${browserName}-overflow.png`) });
  // Keep a real zero-rental vehicle: vary existing commitments to isolate the ratio.
  await page.locator('#toggleTerms').click();
  await expect(page.locator('#income')).toBeVisible();
  await page.fill('#down', '100'); await page.locator('#down').dispatchEvent('change');
  for (const ratio of [0, 10, 39.9, 40, 40.1, 49.9, 50, 50.1, 59.9, 60, 60.1, 75, 99.9, 100, 110.1, 150, 200]) {
    await page.fill('#debt', String(220000 * ratio / 100)); await page.locator('#debt').dispatchEvent('change');
    await expect(page.locator('#budgetDtiHero')).toHaveText(`${ratio.toFixed(1)}% DTI`);
    await expect(page.locator('#budgetGraphic')).toHaveClass(ratio > 60 ? /is-offscale/ : /^(?!.*is-offscale)/);
    if (ratio > 60) await expect(page.locator('#dialOffscaleBadge')).toBeVisible();
    else await expect(page.locator('#dialOffscaleBadge')).toBeHidden();
    if ([0, 40, 50, 60, 75, 100, 110.1, 200].includes(ratio)) {
      await page.locator('#budgetGraphic').screenshot({ path: path.join(OUT, `${browserName}-gauge-${ratio}.png`) });
    }
  }
});

const scenarios = [
  { name: 'zero interest', rate: '0', tenure: '12', down: '60', cond: 'New' },
  { name: 'reducing new deposit floor', rate: '16', tenure: '84', down: '40', cond: 'New' },
  { name: 'flat reconditioned', rate: '12', rateType: 'flat', tenure: '60', down: '40', cond: 'Recon' },
  { name: 'used 40 percent', rate: '9.5', tenure: '36', down: '40', cond: 'Used' },
  { name: 'recent registration', rate: '16', tenure: '84', down: '40', cond: 'Used', firstRegisteredOn: '2026-09-27' },
  { name: 'commercial class', rate: '16', tenure: '84', down: '40', cond: 'New', financeClass: 'commercial' },
  { name: 'insurance and fees', rate: '14', rateType: 'flat', tenure: '48', down: '70', cond: 'New', insurance: '120000', fees: '150000' },
  { name: 'cash with insurance and debt', rate: '16', tenure: '84', down: '100', cond: 'New', insurance: '240000', debt: '30000', fees: '150000' }
];
const currency = n => n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
for (const scenario of scenarios) test(`independent cross-page finance: ${scenario.name}`, async ({ page }) => {
  const price = 12345678.91;
  const car = { ...fixture, price, cond: scenario.cond, financeClass: scenario.financeClass, firstRegisteredOn: scenario.firstRegisteredOn };
  const inputs = { income: '1000000', debt: '0', insurance: '0', fees: '0', ...scenario };
  const minDown = scenario.financeClass === 'commercial' || (scenario.cond === 'Used' && !scenario.firstRegisteredOn) ? 40 : 60;
  const down = Math.max(Number(inputs.down), minDown), loan = price * (1 - down / 100), n = Number(inputs.tenure), annual = Number(inputs.rate);
  const monthlyRate = annual / 1200;
  const expected = loan === 0 ? 0 : inputs.rateType === 'flat' ? loan * (1 + annual * n / 1200) / n : annual === 0 ? loan / n : loan * monthlyRate / (1 - (1 + monthlyRate) ** -n);
  const catalogue = JSON.parse(fs.readFileSync('data/catalogue.json', 'utf8'));
  const model = structuredClone(catalogue.models[0]);
  model.financeClass = scenario.financeClass;
  model.offers = [{ ...model.offers[0], amount: price, condition: scenario.cond, firstRegisteredOn: scenario.firstRegisteredOn }];
  catalogue.models = [model];
  await page.route('**/js/catalogue-data.js*', route => route.fulfill({ contentType: 'text/javascript', body: `window.__VAHANAIQ_CATALOGUE__ = ${JSON.stringify(catalogue)};` }));
  await seed(page, inputs, car);
  await page.goto(`${BASE}/index.html`);
  await expect(page.locator('#rows .v-rent')).toHaveText(currency(expected));
  await expect(page.locator('#rows .v-dp-val')).toHaveText(currency(price * down / 100));
  await page.goto(`${BASE}/catalogue.html`);
  await expect(page.locator('#affordabilityPanel .afford-stat-val').nth(2)).toHaveText(`LKR ${currency(expected)} / mo`);
  await expect(page.locator('#affordabilityPanel .afford-stat-val').nth(3)).toHaveText(`LKR ${currency(price * down / 100)}`);
  if (down < 100) {
    const ratio = (expected + Number(inputs.debt) + Number(inputs.insurance) / 12) / Number(inputs.income) * 100;
    await expect(page.locator('#affordabilityPanel .tag')).toContainText(`${ratio.toFixed(1)}% DTI`);
  }
  await page.unrouteAll({ behavior: 'wait' });
});

for (const width of [...widths, 844]) test(`populated calculator, charts and dialogs at ${width}px`, async ({ page, browserName }) => {
  await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: [320, 768, 1440].includes(width) ? 'dark' : 'light' });
  await seed(page, { income: '220000', rate: '16', tenure: '84', down: '60', insurance: '120000', fees: '150000' });
  await page.goto(`${BASE}/index.html`);
  const checkBounds = async selector => {
    const r = await page.locator(selector).boundingBox();
    expect(r.x).toBeGreaterThanOrEqual(-1); expect(r.x + r.width).toBeLessThanOrEqual(width + 1);
  };
  await page.locator('#rows [data-act="details"]').click();
  await checkBounds('.modal-bg.open .modal');
  await expect(page.locator('.modal-bg.open svg').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#shareBtn').click();
  await checkBounds('.modal-bg.open .modal');
  await expect(page.locator('#shareLink')).not.toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.locator('#savingsPlannerLayout')).toBeHidden();
  await page.locator('#toggleSavingsDrawer').click();
  await expect(page.locator('#savingsPlannerLayout')).toBeVisible();
  await page.locator('#plannerVehicle').selectOption(fixture.id);
  await page.locator('#plannerMode').selectOption('fixed');
  await page.fill('#plannerMonthly', '25000'); await page.locator('#plannerMonthly').dispatchEvent('input');
  await expect(page.locator('.planner-trajectory-card svg')).toBeVisible();
  const plotScale = await page.locator('.planner-trajectory-card svg').evaluate(svg => svg.getBoundingClientRect().width / svg.viewBox.baseVal.width);
  expect(plotScale, 'chart labels must retain readable size instead of shrinking a desktop plot').toBeGreaterThanOrEqual(0.9);
  await checkBounds('.planner-trajectory-card');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const clipped = await page.locator('#budgetGraphic').evaluate(el => [...el.querySelectorAll('.cashflow-seg-shortfall, .telemetry-card-val, .classic-dti-pill, .classic-dti-sub')].filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.className));
  expect(clipped).toEqual([]);
  if ([320, 768, 1440].includes(width)) {
    await page.locator('#savingsPanel').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `${browserName}-${width}-savings.png`) });
  }
});

test('catalogue transfer preserves finance class and registration age', async ({ page }) => {
  const catalogue = JSON.parse(fs.readFileSync('data/catalogue.json', 'utf8'));
  const model = structuredClone(catalogue.models[0]); model.financeClass = 'commercial';
  model.offers = [{ ...model.offers[0], amount: 12000000, condition: 'New', firstRegisteredOn: '2026-09-27' }]; catalogue.models = [model];
  await page.route('**/js/catalogue-data.js*', route => route.fulfill({ contentType: 'text/javascript', body: `window.__VAHANAIQ_CATALOGUE__ = ${JSON.stringify(catalogue)};` }));
  await page.addInitScript(() => localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ income: '1000000', rate: '16', tenure: '84', down: '40' })));
  await page.goto(`${BASE}/catalogue.html`);
  await page.locator('.photo-button').first().click();
  await page.locator('#dialogCompareBtn').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_comparison_v3')).cars[0]);
  expect(saved.financeClass).toBe('commercial'); expect(saved.firstRegisteredOn).toBe('2026-09-27');
  await page.goto(`${BASE}/index.html`);
  await expect(page.locator('#rows .v-dp-val')).toHaveText('4,800,000.00');
  await page.unrouteAll({ behavior: 'wait' });
});

test('Photo Studio accepts the real JPEG fixture and refuses invalid uploads', async ({ page }) => {
  await page.goto(`${BASE}/studio.html`);
  await page.locator('#modelList button').first().click();
  const before = await page.locator('#filmstrip > *').count();
  await page.locator('#photoFiles').setInputFiles('test/fixtures/audi-a3-studio-fixture.jpg');
  await expect(page.locator('#filmstrip > *')).toHaveCount(before + 1);
  await page.locator('#photoFiles').setInputFiles({ name: 'invalid.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
  await expect(page.locator('#photoError')).toContainText('invalid image format');
  await expect(page.locator('#filmstrip > *')).toHaveCount(before + 1);
  await page.locator('#photoFiles').setInputFiles({ name: 'vector.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await expect(page.locator('#photoError')).toContainText('invalid image format');
  await expect(page.locator('#filmstrip > *')).toHaveCount(before + 1);
});
