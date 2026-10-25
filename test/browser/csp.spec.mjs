import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8123';
const PAGES = ['index.html', 'catalogue.html', 'studio.html'];

test.describe('Content Security Policy & Browser Integrations', () => {
  for (const pageName of PAGES) {
    test(`${pageName}: zero CSP violations, photo bootstrap, and dark theme`, async ({ page }) => {
      const cspErrors = [];
      const pageErrors = [];

      page.on('console', (msg) => {
        if (/Content Security Policy/i.test(msg.text())) {
          cspErrors.push(msg.text());
        }
      });

      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
      });

      await page.addInitScript(() => {
        localStorage.setItem('vahanaiq_theme', 'dark');
      });

      await page.goto(`${BASE_URL}/${pageName}`, { waitUntil: 'load' });

      // No console message matching /Content Security Policy/i and no pageerror
      expect(cspErrors).toEqual([]);
      expect(pageErrors).toEqual([]);

      // typeof window.__VAHANAIQ_PHOTOS__ === "object"
      const photosType = await page.evaluate(() => typeof window.__VAHANAIQ_PHOTOS__);
      expect(photosType).toBe('object');

      // with localStorage.vahanaiq_theme set to dark, documentElement.dataset.theme is dark
      const theme = await page.evaluate(() => document.documentElement.dataset.theme);
      expect(theme).toBe('dark');
    });
  }

  test('index.html: Google Identity Services iframe exists after opening the Account dialog', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });

    // Open the Account dialog
    await page.locator('#accountBtn').click();

    // The Google Identity Services iframe exists
    const gisIframe = page.locator('#accountModal iframe, #googleSignIn iframe');
    await expect(gisIframe.first()).toBeAttached({ timeout: 15000 });
  });

  test('catalogue.html: photo overlay Apply function is a function', async ({ page }) => {
    await page.goto(`${BASE_URL}/catalogue.html`, { waitUntil: 'load' });

    // Ensure the overlay script has initialized the apply function
    await page.waitForFunction(() => typeof window.__VAHANAIQ_PHOTOS__?.apply === 'function');
    const applyType = await page.evaluate(() => typeof window.__VAHANAIQ_PHOTOS__?.apply);
    expect(applyType).toBe('function');
  });
});
