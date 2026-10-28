import { test, expect } from '@playwright/test';
import { seedReturning } from './returning-user.mjs';
import { exerciseFontText, primaryMetrics, fallbackMetrics, mixedFormatMetrics } from './font-metrics.mjs';
import fs from 'node:fs';
const tokens = fs.readFileSync(new URL('../../css/tokens.css', import.meta.url), 'utf8');
const baseline = tokens.replaceAll('-variable.woff2', '-variable.ttf').replaceAll('format("woff2")', 'format("truetype")');
const origin = process.env.BASE_URL || 'http://127.0.0.1:8123';

for (const route of ['index', 'catalogue', 'studio', 'about', 'privacy', 'terms']) {
  test(`${route}: local WOFF2 faces load once and retain source rendering metrics`, async ({ browser }, testInfo) => {
    const results = [];
    for (const before of [true, false]) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: 'light' });
      try {
        await seedReturning(context);
        await context.route(/https:\/\//, r => r.abort());
        if (before) await context.route('**/css/tokens.css*', r => r.fulfill({ body: baseline, contentType: 'text/css' }));
        const page = await context.newPage(), requests = [], failed = [];
        page.on('request', r => { if (/\.(ttf|woff2)$/.test(r.url())) requests.push(r.url()); });
        page.on('requestfailed', r => { if (/\.(ttf|woff2)$/.test(r.url())) failed.push(r.url()); });
        await page.goto(origin + '/' + route + '.html');
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => [...document.fonts].map(f => f.status))).toEqual(['loaded', 'loaded']);
        await expect(page.locator('h1')).toBeVisible();
        if (route === 'index') await expect(page.locator('#rate')).not.toHaveValue('');
        if (route === 'catalogue') await expect(page.locator('#vehicles .card').first()).toBeVisible();
        if (route === 'studio') await expect(page.locator('#modelList button').first()).toBeVisible();
        // Closed dialogs contain asynchronously populated catalogue controls;
        // compare the visible page, not hidden modal contents at arbitrary times.
        const geometry = await page.evaluate(() => [...document.querySelectorAll('h1,h2,nav,button,input,select')]
          .filter(e => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).map(e => {
            const r = e.getBoundingClientRect(), s = getComputedStyle(e);
            return { tag: e.tagName, id: e.id, x: r.x, y: r.y, width: r.width, height: r.height, family: s.fontFamily, weight: s.fontWeight };
          }));
        await exerciseFontText(page, ['Inter', 'Manrope']);
        const primary = await primaryMetrics(page), fallback = await fallbackMetrics(page);
        await testInfo.attach(before ? 'source-font-metrics' : 'web-font-metrics', { body: JSON.stringify({ primary, fallback }, null, 2), contentType: 'application/json' });
        for (const row of primary) expect(row.width).toBeGreaterThan(0);
        for (const row of fallback) {
          expect(row.actual, `${row.family} ${row.weight}: ${row.text}`).toEqual(row.system);
          expect(row.hasInk).toBe(true);
          expect(row.identicalPixels, `${row.family} ${row.weight}: ${row.text}`).toBe(true);
        }
        expect(failed).toEqual([]);
        expect(requests).toHaveLength(2);
        expect(new Set(requests).size).toBe(2);
        expect(requests.every(u => u.endsWith(before ? '.ttf' : '.woff2'))).toBe(true);
        results.push({ format: before ? 'ttf' : 'woff2', primary, fallback, geometry });
      } finally { await context.close(); }
    }
    await testInfo.attach('font-metrics', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
    // Exact equivalence remains mandatory for converted-font glyphs and layout.
    expect(results[1].primary).toEqual(results[0].primary);
    expect(results[1].geometry).toEqual(results[0].geometry);
  });
}

test('mixed Sinhala, Tamil and emoji retain metrics and pixels with both formats in one controlled page', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 900 } });
  try {
    await context.route(/https:\/\//, r => r.abort());
    const page = await context.newPage();
    await page.goto(origin + '/about.html');
    const events = await page.evaluate(async () => {
      const events = [];
      for (const type of ['loading', 'loadingdone', 'loadingerror']) document.fonts.addEventListener(type, e => events.push({
        type, faces: e.fontfaces.map(f => ({ family: f.family, status: f.status, weight: f.weight }))
      }));
      for (const family of ['Inter', 'Manrope']) for (const [alias, format] of [['source', 'ttf'], ['web', 'woff2']]) {
        const file = new URL(`assets/fonts/${family.toLowerCase()}/${family}-variable.${format}`, location.href);
        const face = new FontFace(`${family} ${alias}`, `url("${file}")`, { weight: family === 'Inter' ? '100 900' : '200 800', style: 'normal' });
        document.fonts.add(face); await face.load();
      }
      await document.fonts.ready;
      return events;
    });
    await exerciseFontText(page, ['Inter source', 'Inter web', 'Manrope source', 'Manrope web']);
    const rows = await mixedFormatMetrics(page), repeated = await mixedFormatMetrics(page);
    for (const row of rows) {
      expect(row.web, `${row.family} ${row.weight}`).toEqual(row.source);
      expect(row.identicalPixels, `${row.family} ${row.weight}`).toBe(true);
      expect(row.web.width).toBeGreaterThan(0);
    }
    expect(repeated).toEqual(rows);
    expect(events.some(e => e.type === 'loadingerror')).toBe(false);
    await testInfo.attach('mixed-script-metrics', { body: JSON.stringify({ rows, events }, null, 2), contentType: 'application/json' });
    await page.locator('#fontMetricsProbe').screenshot({ path: testInfo.outputPath('mixed-script.png') });
  } finally { await context.close(); }
});
