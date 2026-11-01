import { test, expect } from '@playwright/test';
import { seedReturning } from './returning-user.mjs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8123';

test.describe('Lease mobile layout refresh', () => {
  test.beforeEach(async ({ context }) => { await seedReturning(context); });

  for (const width of [320, 375, 390, 430, 650]) {
    test(`compact header remains usable at ${width}px`, async ({ browser, browserName }) => {
      const context = await browser.newContext({
        viewport: { width, height: 812 },
        hasTouch: true,
        ...(browserName === 'firefox' ? {} : { isMobile: true })
      });
      await seedReturning(context);
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
      await expect(page.locator('#addVehicleBtn')).toBeVisible();
      const toggle = page.locator('#mobileToolsToggle');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#accountBtn')).toBeHidden();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#accountBtn')).toBeVisible();
      await expect(page.locator('#printBtn')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await context.close();
    });
  }

  test('mobile loan terms are revealed without changing finance values', async ({ browser, browserName }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      ...(browserName === 'firefox' ? {} : { isMobile: true })
    });
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await expect(page.locator('#loanTermsGrid')).toBeHidden();
    await expect(page.locator('#toggleTerms')).toContainText('Edit Terms');
    await page.locator('#toggleTerms').click();
    await expect(page.locator('#rate')).toHaveValue('16');
    await expect(page.locator('#tenure')).toHaveValue('84');
    await expect(page.locator('#down')).toHaveValue('60');
    await expect(page.locator('#rate')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await context.close();
  });

  test('empty budget displays guidance instead of an unused gauge on a phone', async ({ browser, browserName }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      ...(browserName === 'firefox' ? {} : { isMobile: true })
    });
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await expect(page.locator('#budgetEmptyMessage')).toBeVisible();
    await expect(page.locator('#budgetGraphic .gauge-wrapper')).toBeHidden();
    await page.locator('#income').fill('250000');
    await page.locator('#income').dispatchEvent('change');
    await expect(page.locator('#budgetEmptyMessage')).toBeHidden();
    await expect(page.locator('#budgetGraphic .gauge-wrapper')).toBeVisible();
    await context.close();
  });
});
