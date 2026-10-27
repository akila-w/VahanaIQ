import { test, expect } from '@playwright/test';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';

for (const width of [320, 390, 768, 1440]) for (const motion of ['no-preference', 'reduce']) {
  test(`guidance motion at ${width}px with ${motion}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: motion });
    const page = await context.newPage();
    for (const route of ['index', 'catalogue', 'studio']) {
      await page.goto(`${BASE}/${route}.html`);
      const trigger = route === 'index' ? page.locator('.guide-context').nth(2) : page.locator('.guide-context').first();
      await trigger.click();
      const popover = page.locator('#guideContextHelp');
      const style = await popover.evaluate(el => ({ name: getComputedStyle(el).animationName, duration: getComputedStyle(el).animationDuration }));
      expect(style.name).toBe(motion === 'reduce' ? 'none' : 'guide-appear');
      if (motion !== 'reduce') expect(style.duration).toBe('0.15s');
      await popover.getByRole('button', { name: 'More details' }).click();
      const help = page.locator('#helpCentre');
      expect(await help.evaluate(el => getComputedStyle(el).animationName)).toBe(motion === 'reduce' ? 'none' : 'guide-appear');
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      // Animation must not delay dismissal or leave a stale top-layer overlay.
      await trigger.click(); await page.keyboard.press('Escape'); await trigger.click();
      await expect(popover).toBeVisible();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect.poll(() => popover.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
      await page.keyboard.press('Escape');
      await page.emulateMedia({ reducedMotion: motion });
    }
    await context.close();
  });
}

test('rapid chart changes retarget from the visible angle and reduced motion stops in-flight effects', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${BASE}/index.html`);
  await page.locator('#addVehicleBtn').click(); await page.fill('#catalogueSearch', 'Toyota'); await page.locator('#catalogueAddSearch').click();
  if (!await page.locator('#income').isVisible()) await page.locator('#toggleTerms').click();
  await page.fill('#income', '2500000'); await page.locator('#income').dispatchEvent('change');
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const result = await page.locator('#rate').evaluate(async input => {
    const needle = document.querySelector('#budgetNeedle'), swing = needle.querySelector('.dial-needle-swing');
    const angle = () => parseFloat(needle.getAttribute('transform').slice(7)) + (parseFloat(getComputedStyle(swing).rotate) || 0);
    const update = value => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
    update('25');
    const animation = swing.getAnimations()[0];
    if (!animation) throw Error('Gauge must animate a real rate change');
    animation.pause(); animation.currentTime = 100;
    const visible = angle();
    const bar = document.querySelector('.cashflow-seg-rental');
    const barAnimation = bar.getAnimations()[0];
    if (!barAnimation) throw Error('Cashflow must animate a real rate change');
    barAnimation.pause(); barAnimation.currentTime = 100;
    const visibleWidth = parseFloat(getComputedStyle(bar).width);
    update('30');
    const next = swing.getAnimations().filter(a => a.playState !== 'idle');
    const from = parseFloat(next[0].effect.getKeyframes()[0].rotate);
    const target = parseFloat(needle.getAttribute('transform').slice(7));
    const nextBar = document.querySelector('.cashflow-seg-rental').getAnimations()[0];
    return { visible, start: target + from, visibleWidth, barStart: parseFloat(nextBar.effect.getKeyframes()[0].width), running: next.length, target, text: document.querySelector('.classic-dti-hero').textContent };
  });
  expect(result.running).toBe(1);
  expect(result.start).toBeCloseTo(result.visible, 3);
  expect(result.barStart).toBeCloseTo(result.visibleWidth, 3);
  expect(result.text).not.toBe('');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' || a.playState === 'paused').length)).toBe(0);
  expect(await page.locator('#budgetNeedle .dial-needle-swing').evaluate(el => getComputedStyle(el).rotate)).toBe('none');
  await page.fill('#income', ''); await page.locator('#income').dispatchEvent('change');
  await expect(page.locator('#budgetCashflowBar')).toContainText('Enter net monthly income');
  await page.fill('#income', '2500000'); await page.locator('#income').dispatchEvent('change');
  await expect(page.locator('#budgetCashflowBar .cashflow-seg-rental')).toBeVisible();
});

for (const mode of ['desktop', 'reduced', 'touch']) {
  test(`hover feedback is smooth and appropriate on ${mode}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: mode === 'touch' ? 390 : 1440, height: 900 }, hasTouch: mode === 'touch', reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    for (const [route, selector] of [['index', '#addVehicleBtn'], ['catalogue', '.review-bar button'], ['studio', '#exportBtn']]) {
      await page.goto(`${BASE}/${route}.html`);
      const control = page.locator(selector).first();
      await control.hover();
      const style = await control.evaluate(el => ({ transform: getComputedStyle(el).transform, transition: getComputedStyle(el).transitionProperty, disabled: el.disabled }));
      if (mode !== 'desktop' || style.disabled) expect(style.transform).toBe('none');
      if (mode === 'desktop' && !style.disabled) expect(style.transition).toContain('transform');
      const help = page.locator('#helpCentreButton');
      const before = await help.boundingBox(); await help.hover(); const after = await help.boundingBox();
      expect(after.width).toBe(before.width); expect(after.height).toBe(before.height);
      expect(await help.evaluate(el => getComputedStyle(el).transform)).toBe('none');
    }
    await page.goto(`${BASE}/catalogue.html`);
    const card = page.locator('#vehicles > .card').first();
    await card.hover();
    await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.target?.closest?.('#vehicles')).map(a => a.finished.catch(() => {}))));
    const cardTransform = await card.evaluate(el => getComputedStyle(el).transform);
    if (mode === 'desktop') expect(cardTransform).toBe('matrix(1, 0, 0, 1, 0, -2)');
    else expect(cardTransform).toBe('none');
    // The established photo framing remains stationary rather than cropping further on hover.
    expect(await card.locator('.photo-button > img').evaluate(el => getComputedStyle(el).transform)).toBe('none');
    await context.close();
  });
}

for (const width of [320, 390, 600, 768, 980, 1024, 1280, 1440, 1920]) for (const theme of ['light', 'dark']) {
  test(`footer disclosures and navigation at ${width}px in ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage(); await page.goto(`${BASE}/index.html`);
    await expect(page.locator('.foot-note')).toHaveCount(3);
    const footer = await page.locator('.foot').boundingBox();
    expect(footer.height, 'closed footer stays compact without shrinking touch targets').toBeLessThanOrEqual(width < 700 ? 600 : 350);
    await expect(page.locator('.foot-intro')).toContainText('not financial advice');
    const summary = page.locator('.foot-note summary').first();
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.foot-note').first()).toHaveAttribute('open', '');
    await expect(page.locator('.foot-note').first().locator('p')).toContainText('monthly compounding');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect(page.locator('.foot-note[open]')).toHaveCount(3);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('.foot-note[open]')).toHaveCount(1);
    for (const link of await page.locator('.foot .site-links a, .foot-meta a, .foot-meta button').all()) {
      const rect = await link.boundingBox();
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.locator('#footerSourceGuide').click();
    await expect(page.locator('#guide')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('#footerSourceGuide')).toBeFocused();
    await context.close();
  });
}
