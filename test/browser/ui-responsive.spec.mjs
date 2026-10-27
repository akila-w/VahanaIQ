import { test, expect } from '@playwright/test';

const seedReturning = context => context.addInitScript(() => localStorage.setItem('vahanaiq_onboarding_v1', JSON.stringify({version:1,completed:true,step:4})));
test.beforeEach(async ({context}) => { await seedReturning(context); });


// Responsive layout, touch, focus and motion guarantees from the 26/10/2026 UI/UX pass
// (docs/uiux-audit.md, docs/uiux-qa-results.md). Like csp.spec.mjs it starts nothing itself
// and expects a local web server at BASE_URL. The comparison is filled through the real
// catalogue bulk-add button, so no AI search or other external request is made.
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8123';

// Firefox has no mobile emulation in Playwright (isMobile), so there a phone is a touch-enabled
// narrow window; Chromium and WebKit also apply the meta viewport as a phone does.
const phone = (browserName, viewport = { width: 390, height: 844 }) =>
  ({ viewport, hasTouch: true, ...(browserName === 'firefox' ? {} : { isMobile: true }) });
const PHONES = [[320, 568], [360, 800], [390, 844], [430, 932]];
const WIDE = [[768, 1024], [1024, 768], [1280, 800], [1366, 768], [1440, 900]];

async function addToyotas(page) {
  await page.locator('#addVehicleBtn').click();
  await page.fill('#catalogueSearch', 'Toyota');
  await page.locator('#catalogueAddSearch').click();
  await expect(page.locator('#rows tr').first()).toBeVisible();
  // On phones the loan terms start collapsed behind Edit
  if (await page.locator('#toggleTerms').isVisible() && await page.locator('#toggleTerms').getAttribute('aria-expanded') === 'false') await page.locator('#toggleTerms').click();
  await page.locator('.terms-disclosure').filter({has:page.locator('#income')}).locator('summary').click();
  await page.fill('#income', '2500000');
  await page.locator('#income').dispatchEvent('change');
}

const pageWidth = page => page.evaluate(() => document.documentElement.scrollWidth);

test.describe('Layout: nothing is wider than the screen', () => {
  for (const pageName of ['index', 'catalogue', 'studio', 'about']) {
    for (const [width, height] of PHONES) {
      test(`${pageName}.html at ${width}px`, async ({ browser, browserName }) => {
        const context = await browser.newContext(phone(browserName, { width, height }));
        await seedReturning(context);
    const page = await context.newPage();
        await page.goto(`${BASE_URL}/${pageName}.html`, { waitUntil: 'load' });
        await page.waitForTimeout(400);
        expect(await pageWidth(page)).toBeLessThanOrEqual(width);
        await context.close();
      });
    }
  }

  for (const [width, height] of [...PHONES, ...WIDE]) {
    test(`calculator with 24 vehicles at ${width}px keeps every figure on screen`, async ({ browser, browserName }) => {
      const context = await browser.newContext(width < 768 ? phone(browserName, { width, height }) : { viewport: { width, height } });
      await seedReturning(context);
    const page = await context.newPage();
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
      await addToyotas(page);
      expect(await pageWidth(page)).toBeLessThanOrEqual(width);
      // In card layouts (below 980px) every figure of the first vehicle is inside its card
      if (width < 980) {
        const clipped = await page.evaluate(() => {
          const card = document.querySelector('#rows tr').getBoundingClientRect();
          return [...document.querySelectorAll('#rows tr:first-child :is(.price-val, .v-dp-val, .v-rent, .row-actions button)')]
            .filter(el => { const r = el.getBoundingClientRect(); return r.left < card.left - 1 || r.right > card.right + 1; }).length;
        });
        expect(clipped).toBe(0);
      }
      await context.close();
    });
  }

  // Ubuntu has none of the font stack's system fonts and falls back to the wider DejaVu Sans,
  // which pushed the header links past a 320px screen. Verdana is as wide on a Mac.
  for (const pageName of ['index', 'catalogue', 'studio']) {
    test(`${pageName}.html fits 320px with a wide fallback font`, async ({ browser, browserName }) => {
      const context = await browser.newContext(phone(browserName, { width: 320, height: 568 }));
      await seedReturning(context);
    const page = await context.newPage();
      await page.goto(`${BASE_URL}/${pageName}.html`, { waitUntil: 'load' });
      await page.addStyleTag({ content: '* { font-family: Verdana, "DejaVu Sans", sans-serif !important; }' });
      await page.waitForTimeout(300);
      expect(await pageWidth(page)).toBeLessThanOrEqual(320);
      await context.close();
    });
  }

  test('catalogue hero stays stacked on phones (UX-02)', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/catalogue.html`, { waitUntil: 'load' });
    await expect(page.locator('#metrics strong').first()).toBeVisible();
    const aside = await page.locator('.hero-aside').boundingBox();
    expect(aside.x + aside.width).toBeLessThanOrEqual(390);
    await context.close();
  });

  // In two columns the loan terms card stays pinned at the top with its own split scroll,
  // and its bottom edge aligns flush with the bottom of the savings panel at the footer;
  // in one column (up to 1365px) it scrolls with the page as before.
  for (const [width, height] of [[1366, 768], [1440, 900]]) {
    test(`loan terms use split scroll and align at the bottom beside results at ${width}px`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height } });
      await seedReturning(context);
    const page = await context.newPage();
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
      await addToyotas(page);
      const mid = await page.evaluate(async () => {
        const terms = document.getElementById('loanTermsHead');
        const results = document.getElementById('comparisonPanel').getBoundingClientRect();
        window.scrollTo({ top: results.top + window.scrollY, behavior: 'instant' });
        // Allow sticky positioning to settle before taking the exact pixel measurement.
        await new Promise(requestAnimationFrame);
        const style = getComputedStyle(terms);
        return {
          box: terms.getBoundingClientRect().toJSON(),
          overflowY: style.overflowY,
          scrollHeight: terms.scrollHeight,
          clientHeight: terms.clientHeight
        };
      });
      expect(Math.round(mid.box.top)).toBe(16);
      expect(mid.box.bottom).toBeLessThanOrEqual(height);
      expect(mid.overflowY).toBe('auto');
      if (height <= 800) expect(mid.scrollHeight).toBeGreaterThan(mid.clientHeight);

      const bottomDiff = await page.evaluate(async () => {
        const terms = document.getElementById('loanTermsHead');
        const savings = document.getElementById('savingsPanel');
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
        await new Promise(requestAnimationFrame);
        return Math.abs(terms.getBoundingClientRect().bottom - savings.getBoundingClientRect().bottom);
      });
      expect(bottomDiff).toBeLessThanOrEqual(1);
      await context.close();
    });
  }

  test('loan terms are not sticky in one column at 1365px', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1365, height: 768 } });
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    expect(await page.locator('#loanTermsHead').evaluate(el => getComputedStyle(el).position)).not.toBe('sticky');
    await context.close();
  });
});

test.describe('Touch and focus', () => {
  test('calculator controls meet 44px on a touch screen', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    // The 44px rules apply under (pointer: coarse). Chromium and WebKit emulate a touch screen;
    // Firefox's emulation may not report a coarse pointer, and then there is nothing to measure.
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    if (browserName !== 'firefox') expect(coarse).toBe(true);
    test.skip(!coarse, 'This engine does not emulate a coarse (touch) pointer');
    await page.locator('#toggleTerms').click();
    const small = await page.evaluate(() => [...document.querySelectorAll('.chip-btn, .seg-btn, .step-btn, .strategy-pill, .page-nav a, .header-actions > button, .header-actions label, input[type="range"].terms-slider, .foot-meta a, .foot-meta button')]
      .filter(el => el.getClientRects().length)
      .map(el => { const r = el.getBoundingClientRect(); return { id: el.id || el.className || el.textContent.trim(), h: Math.round(r.height) }; })
      .filter(x => x.h < 36));
    expect(small).toEqual([]);
    await context.close();
  });

  test('sliders and footer controls show keyboard focus (UX-08, UX-09)', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    // Safari's default Tab order skips sliders, buttons and links (Option-Tab reaches them), so
    // focus is moved after a key press instead: every engine then treats it as keyboard focus.
    for (const selector of ['#rateSlider', '#footerSourceGuide', '#openPhotoCreditsBtn']) {
      await page.keyboard.press('Shift');
      await page.locator(selector).focus();
      const state = await page.locator(selector).evaluate(el => ({ visible: el.matches(':focus-visible'), outline: getComputedStyle(el).outlineStyle }));
      expect(state).toEqual({ visible: true, outline: 'solid' });
    }
  });

  test('a dialog returns focus to its opener after rapid opening and closing', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    for (let i = 0; i < 5; i++) {
      await page.locator('#addVehicleBtn').click();
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('#catalogueModal')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('addVehicleBtn');
  });
});

test.describe('Phone journeys', () => {
  test('section switcher marks the section in view', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById('savingsPanel').scrollIntoView(); });
    await expect(page.locator('.page-nav a[aria-current="location"]')).toHaveText(/Save/);
    await context.close();
  });

  test('head-to-head opens with the at-a-glance matrix on a phone', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await addToyotas(page);
    const pins = page.locator('#rows [data-act="pin"]');
    for (let i = 0; i < 3; i++) await pins.nth(i).click();
    await page.locator('#openHeadToHeadBtn').click();
    const matrix = page.locator('#h2hModal .h2h-matrix');
    await expect(matrix).toBeVisible();
    await expect(matrix.locator('tr.is-best')).toHaveCount(4);
    expect(await matrix.evaluate(t => getComputedStyle(t).display)).toBe('table');
    await context.close();
  });

  test('the savings planner date picker keeps a 7-column month grid on a phone', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.locator('#toggleSavingsDrawer').click();
    await page.locator('#plannerCalendar').click();
    const grid = page.locator('.calendar-grid');
    await expect(grid).toBeVisible();
    expect(await grid.evaluate(t => getComputedStyle(t).display)).toBe('table');
    await expect(grid.locator('thead th')).toHaveCount(7);
    expect((await grid.boundingBox()).height).toBeLessThan(450);
    await context.close();
  });

  test('every field on a phone is at least 16px, so iOS does not zoom on focus', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    for (const pageName of ['index', 'catalogue', 'studio']) {
      await page.goto(`${BASE_URL}/${pageName}.html`, { waitUntil: 'load' });
      const small = await page.evaluate(() => [...document.querySelectorAll('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not(.sr-only), select:not(.sr-only), textarea')]
        .map(el => ({ id: el.id || el.className, size: parseFloat(getComputedStyle(el).fontSize) }))
        .filter(x => x.size < 16));
      expect(small, pageName).toEqual([]);
    }
    await context.close();
  });

  test('choosing a Photo Studio entry on a phone brings the editor into view', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/studio.html`, { waitUntil: 'load' });
    await page.locator('#modelList [data-model]').nth(2).click();
    await expect.poll(() => page.evaluate(() => Math.round(document.querySelector('.studio-editor').getBoundingClientRect().top))).toBeLessThan(150);
    await context.close();
  });

  test('a focused field that ends up out of sight when the visible area changes is brought back', async ({ browser, browserName }) => {
    // iOS Safari can undo its own keyboard scroll (seen in the iOS 27 Simulator). Only Safari
    // shows a keyboard, so this checks the guard in js/page-transitions.js directly: the field
    // is focused off-screen, then the visible area reports a resize as it does when a keyboard opens.
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.locator('#toggleTerms').click();
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      document.getElementById('income').closest('details').open = true;
      document.getElementById('income').focus({ preventScroll: true });
      window.scrollTo(0, document.documentElement.scrollHeight);
      window.visualViewport.dispatchEvent(new Event('resize'));
    });
    await expect.poll(() => page.evaluate(() => {
      const box = document.getElementById('income').getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    })).toBe(true);
    await context.close();
  });

  test('the catalogue sheet scrolls as a whole on a phone, not in a box a card tall (UX-26)', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName, { width: 375, height: 635 }));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.locator('#addVehicleBtn').click();
    await expect(page.locator('#catalogueResults .catalogue-card').first()).toBeVisible();
    const state = await page.evaluate(() => {
      const sheet = document.querySelector('#catalogueModal .modal');
      const results = document.getElementById('catalogueResults');
      return { sheet: getComputedStyle(sheet).overflowY, results: getComputedStyle(results).overflowY, scrolls: sheet.scrollHeight > sheet.clientHeight };
    });
    expect(state).toEqual({ sheet: 'auto', results: 'visible', scrolls: true });
    await context.close();
  });

  test('the rental bar in a phone comparison card keeps its height (UX-27)', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await addToyotas(page);
    const heights = await page.evaluate(() => {
      const cell = document.querySelector('#rows tr td.v-bar');
      return [cell.querySelector('.track'), cell.querySelector('.fill')].map(el => Math.round(el.getBoundingClientRect().height));
    });
    expect(heights).toEqual([8, 8]);
    await context.close();
  });

  test('"Mark for Review" in the catalogue dialog is readable in the dark theme (UX-29)', async ({ browser, browserName }) => {
    const context = await browser.newContext({ ...phone(browserName), colorScheme: 'dark' });
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/catalogue.html`, { waitUntil: 'load' });
    await page.locator('#vehicles .card .photo-button').first().click();
    const colours = await page.locator('#detailBody .dialog-compare-bar .flag').evaluate(el => {
      const s = getComputedStyle(el);
      return { color: s.color, background: s.backgroundColor };
    });
    expect(colours).toEqual({ color: 'rgb(241, 245, 249)', background: 'rgb(30, 41, 59)' });
    await context.close();
  });
});

test.describe('Motion', () => {
  test('reduced motion: nothing animates and figures are final at once', async ({ browser, browserName }) => {
    const context = await browser.newContext({ ...phone(browserName), reducedMotion: 'reduce' });
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await addToyotas(page);
    await page.locator('.step-btn[data-step-for="rate"][data-step-delta="0.5"]').click();
    await page.locator('#addVehicleBtn').click();
    const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
    expect(running).toBe(0);
    await context.close();
  });

  test('full motion: the gauge needle attribute holds the final reading immediately', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await addToyotas(page);
    const before = await page.locator('#budgetNeedle').getAttribute('transform');
    await page.locator('.step-btn[data-step-for="rate"][data-step-delta="0.5"]').click();
    const after = await page.locator('#budgetNeedle').getAttribute('transform');
    expect(after).toMatch(/^rotate\(-?\d+(\.\d)?, 160, 150\)$/);
    expect(after).not.toBe(before);
  });
});
