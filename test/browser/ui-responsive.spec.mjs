import { test, expect } from '@playwright/test';

import { seedReturning, blockFirebase } from './returning-user.mjs';
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
  await expect(page.locator('#income')).toBeVisible();
  await page.fill('#income', '2500000');
  await page.locator('#income').dispatchEvent('change');
}

const pageWidth = page => page.evaluate(() => document.documentElement.scrollWidth);

// Only iOS Safari shows a keyboard here, so the visible area is made to report the height an open
// keyboard leaves, and resizes as it does then. Null puts the real height back: the keyboard closes.
// The layout viewport stays 844px tall, so a field the guard centres sits at about 420px.
const KEYBOARD_OPEN_HEIGHT = 600;
const setVisibleHeight = (page, height) => page.evaluate(value => {
  const v = window.visualViewport;
  if (value === null) delete v.height;
  else Object.defineProperty(v, 'height', { configurable: true, get: () => value });
  v.dispatchEvent(new Event('resize'));
}, height);

const incomeInSight = page => page.evaluate(() => {
  const box = document.getElementById('income').getBoundingClientRect();
  return box.top >= 0 && box.bottom <= window.visualViewport.height;
});

// The guard waits 80ms after a scroll, so 300ms is long enough to see it move the page.
async function expectStaysScrolled(page) {
  const scrolled = await page.evaluate(async () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    await new Promise(requestAnimationFrame);
    return window.scrollY;
  });
  expect(scrolled).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
}

test('all six routes fit the requested 375×812 phone viewport in both themes', async ({ browser, browserName }) => {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ ...phone(browserName, { width: 375, height: 812 }), colorScheme: theme });
    await seedReturning(context);
    await blockFirebase(context);
    const page = await context.newPage();
    for (const pageName of ['index', 'catalogue', 'studio', 'about', 'privacy', 'terms']) {
      await page.goto(`${BASE_URL}/${pageName}.html`, { waitUntil: 'load' });
      await expect(page.locator('h1').first()).toBeVisible();
      expect(await pageWidth(page), `${pageName}.html at 375×812 in ${theme}`).toBeLessThanOrEqual(375);
    }
    await context.close();
  }
});

test.describe('Layout: nothing is wider than the screen', () => {
  for (const pageName of ['index', 'catalogue', 'studio', 'about']) {
    for (const [width, height] of PHONES) {
      test(`${pageName}.html at ${width}px`, async ({ browser, browserName }) => {
        const context = await browser.newContext(phone(browserName, { width, height }));
        await seedReturning(context);
        if (pageName === 'studio') await blockFirebase(context);
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
        if (pageName === 'studio') await blockFirebase(context);
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
    test(`the answer stays in view beside the terms and income at ${width}px`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height } });
      await seedReturning(context);
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
      await addToyotas(page);
      const box = await page.evaluate(async () => {
        const income = document.getElementById('incomePanel').getBoundingClientRect();
        window.scrollTo({ top: income.top + window.scrollY - 200, behavior: 'instant' });
        await new Promise(requestAnimationFrame);
        return {
          answer: document.getElementById('answerPanel').getBoundingClientRect().toJSON(),
          income: document.getElementById('incomePanel').getBoundingClientRect().toJSON()
        };
      });
      expect(box.answer.left).toBeGreaterThan(box.income.right);
      expect(box.answer.top).toBeGreaterThanOrEqual(0);
      expect(box.answer.top).toBeLessThan(height);
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
    await blockFirebase(context);
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

  test('Photo Studio: Reset stays hidden until an entry changes, and the Frame panel edits the one saved setting', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await seedReturning(context);
    await blockFirebase(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/studio.html`, { waitUntil: 'load' });
    await expect(page.locator('#frameStatus')).not.toBeEmpty();
    const reset = page.locator('#resetModelBtn');
    await expect(reset).toBeHidden();
    await expect(page.locator('#stageBadge')).toHaveText('Cover · 8:5');
    await expect(page.locator('#filterAll')).toHaveText(/^All \d+$/);
    await expect(page.locator('#filterEdited')).toHaveText('Edited 0');
    await expect(page.locator('#positionAuto')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.model-flag')).toHaveCount(0);

    // The tools the artboard does not show are still there, one click away
    await page.locator('.frame-tools summary').click();
    for (const id of ['#zoomIn', '#zoomOut', '#fitBtn', '#centreBtn', '#resetFrameBtn', '#toggleBaselinesBtn', '#toggleGridBtn', '#toggleMarginsBtn']) await expect(page.locator(id)).toBeVisible();
    await page.locator('#toggleGridBtn').click();
    await expect(page.locator('#cropGuides')).toHaveClass(/hide-grid/);
    await expect(page.locator('.guide-grid')).toBeHidden();

    const pressedBackground = await page.locator('#backgroundPlate').getAttribute('aria-pressed') === 'true' ? '#backgroundOriginal' : '#backgroundPlate';
    await page.locator(pressedBackground).click();
    await expect(page.locator(pressedBackground)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#positionManual')).toHaveAttribute('aria-pressed', 'true');
    await expect(reset).toBeVisible();
    await expect(reset).toHaveText(/^Reset .+ to original photos…$/);
    await expect(page.locator('#filterEdited')).toHaveText('Edited 1');
    await expect(page.locator('.model-flag')).toHaveText('Edited');

    await page.locator('#saveFrameBtn').click();
    await expect(page.locator('#toast')).toContainText('saved in this browser');
    await page.locator('#filterEdited').click();
    await expect(page.locator('#modelList [data-model]')).toHaveCount(1);

    // Automatic undoes a manual choice, so the entry is no longer edited
    await page.locator('#positionAuto').click();
    await expect(page.locator('#positionAuto')).toHaveAttribute('aria-pressed', 'true');
    await expect(reset).toBeHidden();
    await expect(page.locator('#filterEdited')).toHaveText('Edited 0');

    // Reset asks first: declining keeps the edit, accepting restores the published photos
    await page.locator('#filterAll').click();
    await page.locator(pressedBackground).click();
    await expect(reset).toBeVisible();
    page.once('dialog', dialog => dialog.dismiss());
    await reset.click();
    await expect(reset).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await reset.click();
    await expect(reset).toBeHidden();
    await expect(page.locator('#zoomValue')).toHaveText('100%');
    await context.close();
  });

  // These reload, and a worker's requests would pass blockFirebase. Each change and the action racing it
  // run in one task, so the action always lands inside the change's 400ms wait.
  const openStudioToSave = async (browser, setup) => {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    await seedReturning(context);
    await blockFirebase(context);
    const page = await context.newPage();
    if (setup) await page.addInitScript(setup);
    await page.goto(`${BASE_URL}/studio.html`, { waitUntil: 'load' });
    await expect(page.locator('#frameStatus')).not.toBeEmpty();
    return { context, page };
  };
  const inOneTask = (page, steps) => page.evaluate(list => {
    const actions = {
      zoom: () => { const range = document.getElementById('zoomRange'); range.value = String(Number(range.value) + 0.5); range.dispatchEvent(new Event('input', { bubbles: true })); },
      otherEntry: () => document.querySelectorAll('#modelList [data-model]')[2].click(),
      save: () => document.getElementById('saveFrameBtn').click(),
      reset: () => document.getElementById('resetModelBtn').click()
    };
    for (const step of list) actions[step]();
  }, steps);
  const reloadAfterSaves = async page => {
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('#frameStatus')).not.toBeEmpty();
    await page.waitForTimeout(500);
  };

  test('Photo Studio: Save Frame on one entry keeps another entry\'s waiting save', async ({ browser }) => {
    const { context, page } = await openStudioToSave(browser);
    await inOneTask(page, ['zoom', 'otherEntry', 'save']);
    // The second entry has no changes of its own, so this is also the Nothing to save path
    await expect(page.locator('#toast')).toContainText('Nothing to save');
    await reloadAfterSaves(page);
    await expect(page.locator('#filterEdited')).toHaveText('Edited 1');
    await context.close();
  });

  test('Photo Studio: changing a second entry keeps the first entry\'s waiting save', async ({ browser }) => {
    const { context, page } = await openStudioToSave(browser);
    await inOneTask(page, ['zoom', 'otherEntry', 'zoom']);
    await reloadAfterSaves(page);
    await expect(page.locator('#filterEdited')).toHaveText('Edited 2');
    await context.close();
  });

  test('Photo Studio: a waiting save does not undo a reset', async ({ browser }) => {
    const { context, page } = await openStudioToSave(browser);
    await inOneTask(page, ['zoom']);
    await expect(page.locator('#resetModelBtn')).toBeVisible();
    await page.waitForTimeout(800);
    page.once('dialog', dialog => dialog.accept());
    await inOneTask(page, ['zoom', 'reset']);
    await expect(page.locator('#filterEdited')).toHaveText('Edited 0');
    await reloadAfterSaves(page);
    await expect(page.locator('#filterEdited')).toHaveText('Edited 0');
    await context.close();
  });

  test('Photo Studio: a failed write says so, from Save Frame and from a waiting save', async ({ browser }) => {
    const { context, page } = await openStudioToSave(browser, () => {
      IDBObjectStore.prototype.put = () => { throw new Error('Storage is full'); };
    });
    await inOneTask(page, ['zoom', 'save']);
    await expect(page.locator('#toast')).toContainText('could not save the frame');
    await expect(page.locator('#storageNote')).toHaveClass(/is-alert/);
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('#frameStatus')).not.toBeEmpty();
    await expect(page.locator('#storageNote')).not.toHaveClass(/is-alert/);
    await inOneTask(page, ['zoom']);
    await expect(page.locator('#storageNote')).toHaveClass(/is-alert/);
    await context.close();
  });

  test('Photo Studio controls are 44px touch targets on a phone', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    await blockFirebase(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/studio.html`, { waitUntil: 'load' });
    await expect(page.locator('#frameStatus')).not.toBeEmpty();
    await page.locator('.frame-tools summary').click();
    const small = await page.evaluate(() => [...document.querySelectorAll('#main button, #main a, #main summary, #main label.btn, .film-add label, .site-header .header-actions button, .site-header .header-actions label, .header-tour-btn')]
      .filter(el => el.offsetParent)
      .map(el => ({ name: el.id || el.className, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.height < 43.5 || box.width < 43.5)
      .map(({ name, box }) => `${name} ${Math.round(box.width)}x${Math.round(box.height)}`));
    expect(small).toEqual([]);
    await context.close();
  });

  test('choosing a Photo Studio entry on a phone brings the editor into view', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    await blockFirebase(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/studio.html`, { waitUntil: 'load' });
    await page.locator('#modelList [data-model]').nth(2).click();
    await expect.poll(() => page.evaluate(() => Math.round(document.querySelector('.studio-editor').getBoundingClientRect().top))).toBeLessThan(150);
    await context.close();
  });

  test('a focused field that ends up out of sight when the visible area changes is brought back', async ({ browser, browserName }) => {
    // iOS Safari can undo its own keyboard scroll (seen in the iOS 27 Simulator). Only Safari
    // shows a keyboard, so this checks the guard in js/page-transitions.js directly: the field
    // is focused off-screen, then the visible area shrinks and reports a resize as it does when
    // a keyboard opens.
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.locator('#toggleTerms').click();
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      // Income is now always visible in the Budget panel.
      document.getElementById('income').focus({ preventScroll: true });
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await setVisibleHeight(page, KEYBOARD_OPEN_HEIGHT);
    await expect.poll(() => incomeInSight(page)).toBe(true);
    await context.close();
  });

  test('a scroll just after the keyboard opens that hides the focused field is undone', async ({ browser, browserName }) => {
    // Safari's own undo arrives as a scroll after the last resize, with the field already in sight.
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.locator('#toggleTerms').click();
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const income = document.getElementById('income');
      income.focus({ preventScroll: true });
      income.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    await setVisibleHeight(page, KEYBOARD_OPEN_HEIGHT);
    expect(await incomeInSight(page)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => incomeInSight(page)).toBe(true);
    await context.close();
  });

  test('once the keyboard has closed, scrolling away from the focused field stays where it is', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.locator('#toggleTerms').click();
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const income = document.getElementById('income');
      income.focus({ preventScroll: true });
      income.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    await setVisibleHeight(page, KEYBOARD_OPEN_HEIGHT);
    await setVisibleHeight(page, null);
    await expectStaysScrolled(page);
    await context.close();
  });

  test('pinch zoom does not count as the keyboard opening', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.locator('#toggleTerms').click();
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      document.getElementById('income').focus({ preventScroll: true });
      const v = window.visualViewport;
      const height = document.documentElement.clientHeight / 2;
      Object.defineProperty(v, 'height', { configurable: true, get: () => height });
      Object.defineProperty(v, 'scale', { configurable: true, get: () => 2 });
      v.dispatchEvent(new Event('resize'));
    });
    await expectStaysScrolled(page);
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

for (const [width, height] of [[1366, 768], [1440, 900]]) {
  test.describe(`a focused field at ${width}x${height} with no on-screen keyboard`, () => {
    // A desktop has no on-screen keyboard to hide a field behind, so resizing the visible area must
    // not move the page. The split-scroll test above failed intermittently on this. Only the height
    // changes here: WebKit itself scrolls to a focused text field whose width changes.
    const open = async browser => {
      const context = await browser.newContext({ viewport: { width, height } });
      await seedReturning(context);
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
      await addToyotas(page);
      await expect(page.locator('#income')).toBeFocused();
      // WebKit reports a resize from 0x0 at first layout; outlast it so each test checks its own.
      await page.waitForTimeout(1100);
      return { context, page };
    };

    test('scrolling after a resize event stays where it is', async ({ browser }) => {
      const { context, page } = await open(browser);
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        window.visualViewport.dispatchEvent(new Event('resize'));
      });
      await expectStaysScrolled(page);
      await context.close();
    });

    test('resizing the window and then wheeling down the page stays where it is', async ({ browser }) => {
      const { context, page } = await open(browser);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.setViewportSize({ width, height: height - 40 });
      await page.mouse.move(width / 2, height / 2);
      // The guard can only act 80ms after a scroll event, so recording the furthest point on each
      // one always sees where the wheel took the page, however slowly this test reads it.
      await page.evaluate(() => {
        window.furthestScroll = 0;
        window.addEventListener('scroll', () => { window.furthestScroll = Math.max(window.furthestScroll, window.scrollY); }, { passive: true });
      });
      // Firefox moves the page at most about one screen per wheel event, whatever the distance.
      await page.mouse.wheel(0, 1600);
      await expect.poll(() => page.evaluate(() => window.furthestScroll)).toBeGreaterThan(height / 2);
      await page.waitForTimeout(300);
      const { furthest, now } = await page.evaluate(() => ({ furthest: window.furthestScroll, now: window.scrollY }));
      expect(now).toBe(furthest);
      await context.close();
    });

    test('resizing the window after scrolling away stays where it is', async ({ browser }) => {
      const { context, page } = await open(browser);
      await page.evaluate(() => window.scrollTo({ top: 2000, behavior: 'instant' }));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
      const scrolled = await page.evaluate(() => window.scrollY);
      await page.setViewportSize({ width, height: height - 40 });
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
      await context.close();
    });
  });
}

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

test.describe('Answer first', () => {
  test('a ready-made comparison fills the card, and Show Above and Undo Removal keep it true', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);
    await page.locator('#readyShortlists button', { hasText: 'Compact SUVs' }).click();
    await expect(page.locator('#rows tr')).toHaveCount(2);
    await expect(page.locator('#answerName')).toContainText('Suzuki Fronx');

    const raize = page.locator('#rows tr', { hasText: 'Toyota Raize' });
    const rental = (await raize.locator('.v-rent').innerText()).trim();
    await raize.locator('[data-act="focus"]').click();
    await expect(page.locator('#answerName')).toContainText('Toyota Raize');
    await expect(raize.locator('[data-act="focus"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#answerRental')).toHaveText(/^LKR [\d,]+\.\d\d$/);
    await expect(page.locator('#answerRentalText')).toContainText(rental);

    await page.fill('#income', '350000');
    await page.locator('#income').dispatchEvent('change');
    await expect(page.locator('#answerDti')).toHaveText(/^\d+\.\d%$/);
    await expect(page.locator('#answerStatusText')).toHaveText(/Comfortable|Stretching|Out of reach/);
    await expect(page.locator('#answerCeiling')).toContainText('Vehicles up to LKR');

    await raize.locator('[data-act="remove"]').click();
    await expect(page.locator('#undoText')).toContainText('Toyota Raize');
    await expect(page.locator('#answerName')).toContainText('Suzuki Fronx');
    await expect(page.locator('#undoRemovalBtn')).toBeFocused();
    await page.locator('#undoRemovalBtn').click();
    await expect(page.locator('#rows tr')).toHaveCount(2);
    await expect(page.locator('#undoBar')).toBeHidden();
    await expect(page.locator('#answerName')).toContainText('Toyota Raize');
  });
});

test.describe('Showroom and Settings', () => {
  test('cards show the rental on saved terms, and the budget toggle and brand strip filter', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ income: '350000', rate: '16', tenure: '84', down: '60', dti: '0.4' })));
    await page.goto(`${BASE_URL}/catalogue.html`);
    await expect(page.locator('#termsText')).toContainText('16% · 84 months · 60% down');
    await expect(page.locator('.card-rental').first()).toContainText('a month');
    const count = async () => parseInt(await page.locator('#resultCount').innerText(), 10);
    await expect.poll(count).toBeGreaterThan(0);
    const all = await count();
    await page.locator('#budgetToggle').click();
    await expect(page.locator('#budgetToggle')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(count).toBeLessThan(all);
    await expect(page.locator('.card-fit[data-fit="bad"]')).toHaveCount(0);
    await page.locator('#budgetToggle').click();
    const chip = page.locator('.brand-strip-group:first-child .brand-chip', { hasText: 'Toyota' });
    await chip.focus();
    await chip.press('Enter');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#make')).toHaveValue('Toyota');
  });

  test('settings apply at once, survive reload, and delete keeps nothing but the sign-in', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings.html`);
    await page.getByText('Dark', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('input[name="motion"][value="reduced"] + span').click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await page.locator('input[name="tenure"][value="60"] + span').click();
    await page.locator('#hideEstimated').check();
    await page.reload();
    await expect(page.locator('input[name="tenure"][value="60"]')).toBeChecked();
    await expect(page.locator('#hideEstimated')).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    const download = page.waitForEvent('download');
    await page.locator('#exportData').click();
    expect((await download).suggestedFilename()).toBe('vahanaiq-data.json');
    await page.locator('#askDelete').click();
    await expect(page.locator('#keepData')).toBeFocused();
    await page.locator('#deleteData').click();
    await expect(page.locator('#settingsSaved')).toContainText('deleted');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('vahanaiq_settings_v1'))).toBeNull();
  });
});

test.describe('Number choices and phone tabs', () => {
  test('choices change what is displayed, not the amount worked out', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);
    await page.locator('#readyShortlists button').first().click();
    await expect(page.locator('#answerRental')).toHaveText(/^LKR [\d,]+\.\d\d$/);
    await page.evaluate(() => localStorage.setItem('vahanaiq_settings_v1', JSON.stringify({ currency: 'rs', cents: 'no', large: 'lakhs' })));
    await page.reload();
    await expect(page.locator('#answerRental')).toHaveText(/^Rs\. [\d,]+$/);
    await expect(page.locator('#answerDown')).toContainText('lakhs');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_comparison_v3')).cars[0].price);
    expect(Number.isFinite(stored) && stored > 1e6).toBe(true);
  });

  test('phones get bottom tabs, wider screens do not', async ({ browser, browserName }) => {
    const context = await browser.newContext(phone(browserName));
    await seedReturning(context);
    const page = await context.newPage();
    for (const [file, tab] of [['index.html', 'Lease Planner'], ['catalogue.html', 'Showroom'], ['settings.html', 'Settings']]) {
      await page.goto(`${BASE_URL}/${file}`);
      await expect(page.locator('.tab-bar a[aria-current="page"]')).toHaveText(tab);
      expect(await pageWidth(page)).toBeLessThanOrEqual(390);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.tab-bar')).toBeHidden();
    await context.close();
  });
});

// Findings from the review of PR 51, 06/11/2026
test.describe('Showroom verdicts need a confirmed price', () => {
  const cards = page => page.locator('#vehicles .card');
  const fit = page => cards(page).first().locator('.card-fit');
  const search = async (page, text) => { await page.fill('#search', text); await expect(cards(page).first().or(page.locator('#resultCount', { hasText: /^0 /}))).toBeVisible(); };

  test('a disputed or unverified price gets no verdict and stays out of the budget filter', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ income: '1000000' })));
    await page.goto(`${BASE_URL}/catalogue.html`);

    // The representative offer: the A3's only price comes from a page about another model.
    await search(page, 'Audi A3');
    await expect(fit(page)).toHaveAttribute('data-fit', 'illustrative');
    await expect(fit(page)).toHaveText('Illustrative only · Price unverified');
    await expect(cards(page).first().locator('.card-rental-value')).toContainText('a month');

    // A confirmed price keeps its verdict, so the check is on the evidence and not the card.
    await search(page, 'Raize');
    await expect(fit(page)).toHaveAttribute('data-fit', 'ok');
    await expect(fit(page)).toHaveText('Comfortable');

    await page.locator('#budgetToggle').click();
    await expect(fit(page)).toHaveAttribute('data-fit', 'ok');
    await page.fill('#search', 'Audi A3');
    await expect(cards(page)).toHaveCount(0);

    // An offer chosen by the price filter: Estimated Prices are never confirmed.
    await page.fill('#search', '');
    await page.selectOption('#priceType', 'estimated');
    await expect(cards(page)).toHaveCount(0);
    await page.locator('#budgetToggle').click();
    await expect(cards(page).first()).toBeVisible();
    await expect(page.locator('#vehicles .card-fit:not([data-fit="illustrative"])')).toHaveCount(0);

    // The fallback when the filter leaves no offer: Price on Request has nothing to judge.
    await page.selectOption('#priceType', 'quote');
    await page.locator('#budgetToggle').click();
    await expect(cards(page)).toHaveCount(0);
  });

  test('an unconfirmed rental is marked illustrative before any income is entered', async ({ page }) => {
    await page.goto(`${BASE_URL}/catalogue.html`);
    await search(page, 'Audi A3');
    await expect(fit(page)).toHaveAttribute('data-fit', 'illustrative');
    await search(page, 'Raize');
    await expect(fit(page)).toHaveCount(0);
  });
});

for (const width of [1024, 1440, 1920]) test(`the rental card never covers the Comparison or Budget Breakdown at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE_URL}/index.html`);
  await page.locator('#readyShortlists button').first().click();
  await page.locator('#budgetDetails summary').click();
  const overlap = await page.evaluate(async () => {
    const card = document.getElementById('answerPanel');
    const others = ['budgetPanel', 'comparisonPanel', 'savingsPanel'].map(id => document.getElementById(id));
    let worst = 0;
    for (let y = 0; y < document.documentElement.scrollHeight - innerHeight; y += 60) {
      scrollTo(0, y);
      await new Promise(requestAnimationFrame);
      const a = card.getBoundingClientRect();
      for (const el of others) {
        const b = el.getBoundingClientRect();
        worst = Math.max(worst, Math.min(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top), Math.min(a.right, b.right) - Math.max(a.left, b.left)));
      }
    }
    return worst;
  });
  expect(overlap).toBeLessThanOrEqual(0);
});

test('guided setup and the ready-made comparison price a car the same way', async ({ page }) => {
  await page.goto(`${BASE_URL}/index.html`);
  await page.locator('#readyShortlists button').first().click();
  const ready = await page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_comparison_v3')).cars.map(c => [c.catalogueId, c.price]));
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE_URL}/index.html?onboarding=1`);
  await page.locator('.onboarding-quick-pick', { hasText: 'Compact SUVs' }).click();
  await page.getByRole('button', { name: /^Continue to Income/ }).click();
  await page.getByRole('button', { name: 'Skip Income', exact: true }).click();
  await page.getByRole('button', { name: /^Continue to Down Payment/ }).click();
  await page.getByRole('button', { name: /See My Result/ }).click();
  await page.getByRole('button', { name: /^Open My Lease/ }).click();
  await expect(page.locator('#rows tr')).toHaveCount(2);
  const setup = await page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_comparison_v3')).cars.map(c => [c.catalogueId, c.price]));
  expect(setup.sort()).toEqual(ready.sort());
});

test('the logo opens the landing page and the footer columns line up', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/index.html`);
  const tops = await page.locator('.foot-link-groups .site-links h3').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  await page.locator('.site-header .brand').click();
  await expect(page.locator('#landingTitle')).toBeVisible();
});

test('a printed estimate keeps its labels, choices and every column on the A4 page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/index.html`);
  await addToyotas(page);
  await page.locator('#budgetDetails summary').click();
  await page.setViewportSize({ width: 703, height: 1000 });
  await page.emulateMedia({ media: 'print' });
  for (const id of ['rate', 'tenure', 'down']) {
    const box = await page.locator(`label[for="${id}"]`).boundingBox();
    expect(box.width, `${id} label`).toBeGreaterThan(60);
  }
  await expect(page.locator('[data-seg="dti"] .seg-btn.active')).toBeVisible();
  await expect(page.locator('#filtersToggle')).toBeHidden();
  await expect(page.locator('td.v-status').first()).toBeHidden();
  await expect(page.locator('#budgetGraphic')).toBeVisible();
  await expect(page.locator('#budgetLinearView')).toBeHidden();
  const overflow = () => page.locator('#comparisonPanel').evaluate(panel => {
    const right = panel.getBoundingClientRect().right;
    return Math.max(...[...panel.querySelectorAll('th, td')].map(cell => cell.getBoundingClientRect().right)) - right;
  });
  expect(await overflow(), 'with an income').toBeLessThanOrEqual(0);
  // With no income, each row says what income the car needs instead. Fields are edited on screen, never mid-print.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ media: 'screen' });
  await page.locator('#income').fill('');
  await expect(page.locator('td.v-bar').first()).toContainText('Need');
  await page.setViewportSize({ width: 703, height: 1000 });
  await page.emulateMedia({ media: 'print' });
  expect(await overflow(), 'without an income').toBeLessThanOrEqual(0);
  await page.locator('#budgetDetails').evaluate(details => { details.open = false; });
  await expect(page.locator('#budgetPanel')).toBeHidden();
});

test('Help Centre lines up with the footer text on Settings and the information pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ['settings.html', 'about.html']) {
    await page.goto(`${BASE_URL}/${path}`);
    const left = selector => page.locator(selector).evaluate(el => el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft));
    expect(await left('#helpCentreButton'), path).toBeCloseTo(await left('footer.info-foot'), 0);
  }
  await page.goto(`${BASE_URL}/settings.html`);
  const footer = await page.locator('footer.settings-foot').boundingBox();
  const copy = await page.locator('footer.settings-foot p').first().boundingBox();
  expect(copy.x).toBeCloseTo(footer.x, 0);
});

test('Help Centre has a full touch target on a phone', async ({ browser, browserName }) => {
  const context = await browser.newContext(phone(browserName));
  await seedReturning(context);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/catalogue.html`);
  const box = await page.locator('#helpCentreButton').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await context.close();
});

test('the Settings preview uses saved loan values that its choices do not offer', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ tenure: '66', down: '100', rate: '16' })));
  await page.goto(`${BASE_URL}/settings.html`);
  await expect(page.locator('#previewTerms')).toContainText('66 months');
  await expect(page.locator('#previewTerms')).toContainText('100% down');
  await expect(page.locator('#previewRental')).toContainText('0.00 a month');
  await page.locator('input[name="down"][value="70"]').check({ force: true });
  await expect(page.locator('#previewTerms')).toContainText('70% down');
  await expect(page.locator('#previewRental')).not.toContainText('0.00 a month');
});

test('loan defaults chosen in Settings reach the planner and the Showroom', async ({ page }) => {
  await page.goto(`${BASE_URL}/settings.html`);
  await page.fill('#defaultRate', '12.5');
  await page.locator('#defaultRate').blur();
  for (const [name, value] of [['rateType', 'flat'], ['tenure', '60'], ['down', '70'], ['dti', '0.5']]) {
    await page.locator(`input[name="${name}"][value="${value}"]`).check({ force: true });
  }
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_inputs_v1')));
  const inputs = await stored();
  for (const name of ['rate', 'rateType', 'tenure', 'down', 'dti']) expect(typeof inputs[name], name).toBe('string');

  // A blank box is not a rate of 0%.
  await page.fill('#defaultRate', '');
  await page.locator('#defaultRate').blur();
  expect((await stored()).rate).toBe('12.5');

  await page.goto(`${BASE_URL}/index.html`);
  await expect(page.locator('#rate')).toHaveValue('12.5');
  await expect(page.locator('#tenure')).toHaveValue('60');
  await expect(page.locator('#down')).toHaveValue('70');
  await expect(page.locator('#dti')).toHaveValue('0.5');
  await expect(page.locator('#rateType')).toHaveValue('flat');

  await page.goto(`${BASE_URL}/catalogue.html`);
  await expect(page.locator('#termsText')).toContainText('12.5%');
  await expect(page.locator('#termsText')).toContainText('60 months · 70% down');
});

test.describe('The budget bar on phones', () => {
  for (const [width, height] of [[320, 568], [390, 844]]) {
    test(`sits above the tabs at ${width}px and hides nothing`, async ({ browser, browserName }) => {
      const context = await browser.newContext(phone(browserName, { width, height }));
      await seedReturning(context);
      // Seed before any page script runs: written after the page has rendered, the income is
      // overwritten when that render's autosave fires, so the bar has nothing to show.
      await context.addInitScript(() => localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ income: '500000' })));
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/index.html`);
      await expect(page.locator('#budgetBar')).toContainText('Max rental');
      const toEnd = () => page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));

      // The page can still grow as it loads, so keep going until the budget panel has really left the screen.
      await expect.poll(async () => { await toEnd(); return page.evaluate(() => document.querySelector('#budgetPanel').getBoundingClientRect().bottom <= 0); }, { message: 'the budget panel has scrolled out of view' }).toBe(true);
      await expect(page.locator('#budgetBar')).toBeVisible();

      // The bar's arrival makes the page longer, so go to the new end before measuring.
      await expect.poll(async () => { await toEnd(); return page.evaluate(() => document.querySelector('footer.foot').getBoundingClientRect().bottom <= document.querySelector('#budgetBar').getBoundingClientRect().top + 0.5); }, { message: 'the end of the page clears the bar' }).toBe(true);
      await expect.poll(() => page.evaluate(() => {
        const bar = document.querySelector('#budgetBar').getBoundingClientRect();
        return document.querySelector('.tab-bar').getBoundingClientRect().top - bar.bottom;
      })).toBeGreaterThanOrEqual(-0.5);
      const box = await page.evaluate(() => {
        const bar = document.querySelector('#budgetBar').getBoundingClientRect();
        return {
          barTop: bar.top,
          view: window.innerHeight,
          toastBottom: parseFloat(getComputedStyle(document.querySelector('.toast')).bottom)
        };
      });
      expect(box.toastBottom, 'a toast clears the bar').toBeGreaterThanOrEqual(box.view - box.barTop);

      const tabs = page.locator('.tab-bar a');
      await expect(tabs).toHaveCount(4);
      for (let i = 0; i < 4; i++) await tabs.nth(i).click({ trial: true, timeout: 3000 });
      await context.close();
    });
  }
});
