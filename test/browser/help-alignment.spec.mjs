import { test, expect } from '@playwright/test';

import { seedReturning } from './returning-user.mjs';
test.beforeEach(async ({context}) => { await seedReturning(context); });


const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const widths = [320, 360, 375, 390, 414, 430, 600, 768, 979, 980, 1024, 1280, 1365, 1366, 1440, 1920];

for (const width of widths) for (const theme of ['light', 'dark']) {
  test(`contextual help alignment at ${width}px in ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
    await seedReturning(context);
    const page = await context.newPage();
    for (const [route, count] of [['index', 5], ['catalogue', 2], ['studio', 1]]) {
      await page.goto(`${BASE}/${route}.html`);
      await expect(page.locator('.guide-context')).toHaveCount(count);
      if (route === 'index' && await page.locator('#toggleTerms').isVisible()) await page.locator('#toggleTerms').click();
      const layout = await page.locator('.guide-context-row').evaluateAll(rows => rows.map(row => {
        const [title, button] = row.children;
        const t = title.getBoundingClientRect(), b = button.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
        const targetY = title.matches('h2, h3') ? t.top + lineHeight / 2 : t.top + t.height / 2;
        return { anchor: row.dataset.guideFor, width: b.width, height: b.height, gap: b.left - t.right, offset: Math.abs(b.top + b.height / 2 - targetY), left: b.left, right: b.right, nested: !!button.closest('label, h2, h3'), mask: getComputedStyle(button, '::before').maskImage };
      }));
      for (const item of layout) {
        expect(item.width, `${route}/${item.anchor}: touch width`).toBe(44);
        expect(item.height, `${route}/${item.anchor}: touch height`).toBe(44);
        expect(item.gap, `${route}/${item.anchor}: consistent spacing`).toBeCloseTo(4, 1);
        expect(item.offset, `${route}/${item.anchor}: icon aligns to text or heading's first line`).toBeLessThanOrEqual(3);
        expect(item.left).toBeGreaterThanOrEqual(0);
        expect(item.right).toBeLessThanOrEqual(width);
        expect(item.nested).toBe(false);
        expect(item.mask).toContain('circle-help.svg');
      }
      if (route === 'index' && width >= 980 && width <= 1365) {
        const controls = await page.locator('.terms-subcard-financing').evaluate(el =>
          [el.querySelector('.seg-control'), ...['rate', 'tenure', 'down'].map(id => el.querySelector(`#${id}`).closest('.stepper-wrap'))].map(control => {
            const field = control.closest('.terms-field');
            return { row: field.getBoundingClientRect().top, top: control.getBoundingClientRect().top, height: control.getBoundingClientRect().height };
          }));
        expect(controls).toHaveLength(4);
        for (const control of controls) {
          expect(control.height, 'each finance control is visible').toBeGreaterThan(0);
          expect(control.top, 'each finance control sits below its label').toBeGreaterThan(control.row);
          for (const peer of controls.filter(peer => Math.abs(peer.row - control.row) <= 1)) {
            expect(Math.abs(peer.top - control.top), 'finance controls in the same grid row share a top edge').toBeLessThanOrEqual(1);
          }
        }
      }
      const trigger = page.locator('.guide-context').last();
      await trigger.click();
      await expect(page.locator('#guideContextHelp')).toBeVisible();
      await expect(page.locator('#helpCentre')).not.toBeVisible();
      const popover = await page.locator('#guideContextHelp').boundingBox();
      expect(popover.x).toBeGreaterThanOrEqual(12);
      expect(popover.x + popover.width).toBeLessThanOrEqual(width - 12);
      expect(popover.y).toBeGreaterThanOrEqual(12);
      expect(popover.y + popover.height).toBeLessThanOrEqual(988);
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
    }
    await context.close();
  });
}
