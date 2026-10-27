import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const KEY = 'vahanaiq_guidance_v1';
const go = (page, name = 'index.html') => page.goto(`${BASE}/${name}`);
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
const start = async page => { await page.getByRole('button', { name: 'Show me around', exact: true }).click(); };

test('welcome is optional, dismissal persists across pages and help can restart', async ({ page }) => {
  await go(page);
  await expect(page.locator('.guide-invitation')).toContainText('Welcome to VahanaIQ');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('button', { name: 'I’ll explore myself' }).click();
  await page.reload();
  await expect(page.locator('.guide-invitation')).toBeHidden();
  await go(page, 'catalogue.html');
  await expect(page.locator('.guide-invitation')).toBeHidden();
  await page.locator('#helpCentreButton').click();
  await page.getByRole('button', { name: 'Start Catalogue tour' }).click();
  await expect(page.locator('#guidedTour')).toContainText('1 of 3');
  await expect(page.locator('#guidedTour h2')).toBeFocused();
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await expect(page.locator('#helpCentreButton')).toBeFocused();
});

test('tour resumes only on request, supports back, skip, restart and completion', async ({ page }) => {
  await go(page); await start(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.reload();
  await expect(page.locator('#guidedTour')).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume tour', exact: true }).click();
  await expect(page.locator('#guidedTour')).toContainText('2 of 4');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('#guidedTour')).toContainText('1 of 4');
  await page.keyboard.press('Escape');
  expect((await state(page)).tours.calculator.status).toBe('skipped');
  await page.locator('#helpCentreButton').click();
  await page.getByRole('button', { name: 'Restart Calculator tour' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Finish tour' }).click();
  expect((await state(page)).tours.calculator.status).toBe('completed');
  await expect(page.locator('.guide-target')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#guidedTour')).toHaveCount(0);
});

test('real controls are usable and guidance never changes finance data', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ rate: '17.5', down: '70' })));
  await go(page);
  const before = await page.evaluate(() => ({ rate: document.querySelector('#rate').value, down: document.querySelector('#down').value, data: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k !== 'vahanaiq_guidance_v1')) }));
  await start(page);
  await page.getByRole('button', { name: 'Explore loan terms' }).click();
  await expect(page.locator('#rate')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Expand guide' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand guide' }).click();
  await page.getByRole('button', { name: 'Skip tour' }).click();
  const after = await page.evaluate(() => ({ rate: document.querySelector('#rate').value, down: document.querySelector('#down').value, data: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k !== 'vahanaiq_guidance_v1')) }));
  expect(after).toEqual(before);
});

test('help has keyboard containment, Escape and focus return; contextual search is safe', async ({ page }) => {
  await go(page);
  const trigger = page.getByRole('button', { name: 'Help: Understanding your budget' });
  await trigger.click();
  await expect(page.locator('#guideContextHelp')).toBeVisible();
  await page.locator('#guideContextHelp').getByRole('button', { name: 'More details' }).click();
  await expect(page.locator('[data-article="budget"]')).toHaveAttribute('open', '');
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('#helpCentre').contains(document.activeElement))).toBe(true);
  }
  await page.locator('#guideSearch').fill('flat rate');
  await expect(page.locator('.guide-article')).toHaveCount(1);
  await page.locator('#guideSearch').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#guideSearchStatus')).toContainText('No explanations');
  await expect(page.locator('.guide-articles img')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#helpCentre')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('quick explanations toggle, dismiss and link to the matching article without changing data', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ rate: '17.5', down: '70' })));
  await go(page);
  await expect(page.locator('#rate')).toHaveValue('17.5');
  const before = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  const trigger = page.getByRole('button', { name: 'Help: Understanding your budget' });
  const popover = page.locator('#guideContextHelp');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(popover).toHaveAttribute('role', 'dialog');
  await expect(popover).toContainText('monthly take-home pay');
  await expect(popover.getByRole('button', { name: 'Close explanation' })).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.guide-context[popovertarget]')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(popover.getByRole('button', { name: 'More details' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.guide-context[popovertarget]')).toHaveCount(0);
  await trigger.click();
  await trigger.click();
  await expect(popover).toBeHidden();
  await trigger.click();
  await page.locator('#h-sum').click();
  await expect(popover).toBeHidden();
  await trigger.click();
  await popover.getByRole('button', { name: 'Close explanation' }).click();
  await expect(trigger).toBeFocused();
  for (const index of [2, 3, 4]) {
    const next = page.locator('.guide-context').nth(index);
    await next.click();
    await expect(popover).toBeVisible();
    await popover.getByRole('button', { name: 'More details' }).click();
    await expect(popover).toBeHidden();
    await expect(page.locator('#helpCentre details[open] summary')).toContainText((await next.getAttribute('aria-label')).replace('Help: ', ''));
    await page.keyboard.press('Escape');
    await expect(next).toBeFocused();
  }
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(before);
  await start(page);
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await expect(page.locator('#guidedTour')).toBeVisible();
});

test('quick explanations fit a short touch viewport and reposition after rotation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await context.newPage();
  await go(page);
  await page.locator('.guide-context').nth(2).tap();
  const popover = page.locator('#guideContextHelp');
  await expect(popover).toBeVisible();
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    // Let the browser apply orientation layout and native popover dismissal.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    // Rotation may move the original section off screen; reopen at its new position.
    if (!await popover.isVisible()) await page.locator('.guide-context').nth(2).tap();
    await expect(popover).toBeVisible();
    const box = await popover.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(12);
    expect(box.y).toBeGreaterThanOrEqual(12);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 12);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 12);
    await expect(popover.getByRole('button', { name: 'More details' })).toBeInViewport();
  }
  await context.close();
});

for (const [name, steps] of [['catalogue', 3], ['studio', 3]]) {
  test(`${name} tour works with page controls and completes`, async ({ page }) => {
    await go(page, `${name}.html?guide=tour`);
    await expect(page.locator('#guidedTour')).toContainText(`1 of ${steps}`);
    expect(page.url()).not.toContain('guide=tour');
    for (let i = 1; i < steps; i++) await page.locator('#guidedTour').getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Finish tour' }).click();
    expect((await state(page)).tours[name].status).toBe('completed');
  });
}

test('blocked and corrupt storage do not prevent help or touring', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw Error('blocked'); }; Storage.prototype.getItem = () => '{malformed'; });
  await go(page); await start(page);
  await page.getByRole('button', { name: 'Explain this' }).click();
  await expect(page.locator('#helpCentre')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await expect(page.locator('#guidedTour')).toBeHidden();
});

test('progressive suggestions follow real comparison changes and can be disabled', async ({ page }) => {
  await go(page); await start(page);
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await expect(page.locator('.guide-invitation')).toContainText('add a vehicle');
  await page.locator('#addVehicleBtn').click();
  await page.fill('#catalogueSearch', 'Toyota');
  await page.locator('#catalogueAddSearch').click();
  await expect(page.locator('.guide-invitation')).toContainText('add your income');
  await page.locator('#helpCentreButton').click();
  await page.locator('#guideTips').uncheck();
  await expect(page.locator('.guide-invitation')).toBeHidden();
  // A checkbox change must work even when a browser/assistive action omits input.
  await page.locator('#guideTips').evaluate(el => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(page.locator('.guide-invitation')).toBeVisible();
  await page.locator('#guideTips').uncheck();
  await expect(page.locator('.guide-invitation')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.guide-invitation')).toBeHidden();
});

test('existing modals take priority without losing tour progress', async ({ page }) => {
  await go(page); await start(page);
  for (let i = 0; i < 2; i++) await page.locator('#guidedTour').getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('#guidedTour').getByRole('button', { name: 'Add a vehicle', exact: true }).click();
  await expect(page.locator('#guidedTour')).not.toBeVisible();
  await expect(page.locator('.modal-bg.open')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#guidedTour')).toBeVisible();
  expect((await state(page)).tours.calculator.step).toBe(2);
});

for (const width of [320, 390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`guidance fits ${width}px in ${theme}, with reduced motion`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await go(page); await start(page);
      expect(await page.locator('#guidedTour').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
      for (let i = 0; i < 4; i++) {
        const bounds = await page.locator('#guidedTour').boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        if (i < 3) await page.getByRole('button', { name: 'Next', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Explain this' }).click();
      const bounds = await page.locator('#helpCentre').boundingBox();
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(await page.locator('#helpCentre').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Finish tour' }).click();
    });
  }
}

for (const name of ['about', 'privacy', 'terms']) {
  test(`${name} keeps Help Centre available`, async ({ page }) => {
    await go(page, `${name}.html`); await page.locator('#helpCentreButton').click();
    await expect(page.locator('#helpCentre')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Calculator tour', exact: true })).toHaveAttribute('href', 'index.html?guide=tour');
  });
}

test('guidance is cached and works offline', async ({ page, context }) => {
  await go(page);
  await page.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await go(page, 'catalogue.html');
  await page.locator('.guide-context').first().click();
  await expect(page.locator('#guideContextHelp')).toContainText('price source and date');
  await page.locator('#guideContextHelp').getByRole('button', { name: 'More details' }).click();
  await expect(page.locator('#helpCentre [data-article="prices"]')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await page.locator('#helpCentreButton').click();
  await page.locator('#guideSearch').fill('offline');
  await expect(page.locator('.guide-article')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await start(page);
  await expect(page.locator('#guidedTour')).toBeVisible();
});

test('an older cached content module keeps quick help available during refresh', async ({ page }) => {
  const content = fs.readFileSync('js/guidance-content.js', 'utf8');
  await page.route('**/js/guidance-content.js*', route => route.fulfill({ contentType: 'text/javascript', body: content.slice(content.indexOf('export const articles')) }));
  await go(page);
  await page.getByRole('button', { name: 'Help: Understanding your budget' }).click();
  await expect(page.locator('#guideContextHelp')).toContainText('Net income is your monthly take-home pay');
  await page.locator('#guideContextHelp').getByRole('button', { name: 'More details' }).click();
  await expect(page.locator('#helpCentre [data-article="budget"]')).toHaveAttribute('open', '');
});

test('relative links and assets work under a GitHub Pages project path', async ({ page }) => {
  await page.route('**/VahanaIQ/**', async route => {
    const relative = new URL(route.request().url()).pathname.replace(/^\/VahanaIQ\//, '');
    const file = path.resolve(relative || 'index.html');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
    if (!file.startsWith(process.cwd() + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { await route.fulfill({ status: 404, body: '' }); return; }
    // Serve the actual static files at the project prefix. Avoid a second fetch whose
    // response can be disposed when navigation cancels speculative preloads.
    await route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await page.goto(`${BASE}/VahanaIQ/about.html`);
  await page.locator('#helpCentreButton').click();
  await page.getByRole('link', { name: 'Catalogue tour', exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/VahanaIQ/catalogue.html`);
  await expect(page.locator('#guidedTour')).toBeVisible();
  await page.unrouteAll({ behavior: 'wait' });
});

test('touch controls, landscape, saved theme and print remain usable', async ({ browser, browserName }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, ...(browserName === 'firefox' ? {} : { isMobile: true }) });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('vahanaiq_theme', 'dark');
    window.guidanceCSP = [];
    document.addEventListener('securitypolicyviolation', e => window.guidanceCSP.push(e.violatedDirective));
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await go(page); await start(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Explore loan terms' }).click();
  await expect(page.locator('#rate')).toBeFocused();
  const field = await page.locator('#rate').boundingBox(), dock = await page.locator('#guidedTour').boundingBox();
  expect(field.y + field.height).toBeLessThanOrEqual(dock.y);
  await page.getByRole('button', { name: 'Expand guide' }).click();
  for (const control of await page.locator('#guidedTour button').all()) {
    const rect = await control.boundingBox();
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.width).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'Explain this' }).click();
  await expect(page.locator('#helpCentre')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#guidedTour')).toBeHidden();
  await expect(page.locator('#helpCentreButton')).toBeHidden();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.guidanceCSP)).toEqual([]);
  await context.close();
});

test('preferences synchronise between tabs without altering financial data', async ({ page, context }) => {
  await go(page);
  const second = await context.newPage();
  await go(second, 'catalogue.html');
  await page.getByRole('button', { name: 'I’ll explore myself' }).click();
  await expect(second.locator('.guide-invitation')).toBeHidden();
});
