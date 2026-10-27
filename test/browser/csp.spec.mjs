import { test, expect } from '@playwright/test';

const seedReturning = context => context.addInitScript(() => localStorage.setItem('vahanaiq_onboarding_v1', JSON.stringify({version:1,completed:true,step:4})));
test.beforeEach(async ({context}) => { await seedReturning(context); });


const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8123';
const PAGES = ['index.html', 'catalogue.html', 'studio.html'];

// Chromium and WebKit log "Content Security Policy"; Firefox logs "Content-Security-Policy".
const CSP_MESSAGE = /Content[- ]Security[- ]Policy/i;

// Every engine also fires securitypolicyviolation on the document, whatever its console says.
async function recordViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
}
const violations = (page) => page.evaluate(() => window.__cspViolations || []);

test.describe('Content Security Policy & Browser Integrations', () => {
  for (const pageName of PAGES) {
    test(`${pageName}: zero CSP violations, photo bootstrap, and dark theme`, async ({ page }) => {
      const cspErrors = [];
      const pageErrors = [];

      page.on('console', (msg) => {
        if (CSP_MESSAGE.test(msg.text())) {
          cspErrors.push(msg.text());
        }
      });
      await recordViolations(page);

      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
      });

      await page.addInitScript(() => {
        localStorage.setItem('vahanaiq_theme', 'dark');
      });

      await page.goto(`${BASE_URL}/${pageName}`, { waitUntil: 'load' });

      // No CSP console message, no securitypolicyviolation event and no pageerror
      expect(cspErrors).toEqual([]);
      expect(await violations(page)).toEqual([]);
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
    const cspErrors = [];
    page.on('console', (msg) => {
      if (CSP_MESSAGE.test(msg.text())) cspErrors.push(msg.text());
    });
    await recordViolations(page);

    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });

    // Open the Account dialog
    await page.locator('#accountBtn').click();

    // The Google Identity Services iframe exists
    const gisIframe = page.locator('#accountModal iframe, #googleSignIn iframe');
    await expect(gisIframe.first()).toBeAttached({ timeout: 15000 });

    // GIS injects its own stylesheet from https://accounts.google.com/gsi/style.
    // That request must not be blocked, otherwise the button renders unstyled while
    // the iframe still attaches; only a console assertion catches it.
    await page.waitForTimeout(1500);
    expect(cspErrors.filter((text) => /style-src|accounts\.google\.com/i.test(text))).toEqual([]);
    expect((await violations(page)).filter((text) => /style-src|accounts\.google\.com/i.test(text))).toEqual([]);
  });

  test('catalogue.html: photo overlay Apply function is a function', async ({ page }) => {
    await page.goto(`${BASE_URL}/catalogue.html`, { waitUntil: 'load' });

    // Ensure the overlay script has initialized the apply function
    await page.waitForFunction(() => typeof window.__VAHANAIQ_PHOTOS__?.apply === 'function');
    const applyType = await page.evaluate(() => typeof window.__VAHANAIQ_PHOTOS__?.apply);
    expect(applyType).toBe('function');
  });
});
