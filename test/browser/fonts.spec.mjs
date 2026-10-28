import { test, expect } from '@playwright/test';
import { seedReturning } from './returning-user.mjs';
import fs from 'node:fs';
const tokens = fs.readFileSync(new URL('../../css/tokens.css', import.meta.url), 'utf8');
const baseline = tokens.replaceAll('-variable.woff2', '-variable.ttf').replaceAll('format("woff2")', 'format("truetype")');
const origin = process.env.BASE_URL || 'http://127.0.0.1:8123';
for (const route of ['index', 'catalogue', 'studio', 'about', 'privacy', 'terms']) {
  test(`${route}: local WOFF2 faces load once and retain source rendering metrics`, async ({ browser }) => {
    const widths = [];
    for (const before of [true, false]) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
      try {
        await seedReturning(context);
        await context.route(/https:\/\//, r => r.abort());
        if (before) await context.route('**/css/tokens.css*', r => r.fulfill({ body: baseline, contentType: 'text/css' }));
        const page = await context.newPage();
        const requests = [], failed = [];
        page.on('request', r => { if (/\.(ttf|woff2)$/.test(r.url())) requests.push(r.url()); });
        page.on('requestfailed', r => { if (/\.(ttf|woff2)$/.test(r.url())) failed.push(r.url()); });
        await page.goto(origin + '/' + route + '.html');
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => [...document.fonts].map(f => f.status))).toEqual(['loaded', 'loaded']);
        expect(failed).toEqual([]);
        expect(requests).toHaveLength(2);
        expect(new Set(requests).size).toBe(2);
        expect(requests.every(u => u.endsWith(before ? '.ttf' : '.woff2'))).toBe(true);
        // This includes characters outside both bundled fonts: the browser must
        // keep its normal per-character fallback for Sinhala, Tamil and emoji.
        widths.push(await page.evaluate(() => {
          const canvas = document.createElement('canvas'), c = canvas.getContext('2d'), result = [];
          for (const family of ['Inter', 'Manrope']) for (const weight of [200, 400, 650, 750, 800]) {
            c.font = `${weight} 24px "${family}", sans-serif`;
            for (const text of ['LKR 1,234,567.89 — − + % £ € ₹ ₨', 'Café Škoda Ελληνικά Україна', 'සිංහල தமிழ் 🚗']) {
              const m = c.measureText(text);
              result.push([family, weight, text, m.width, m.actualBoundingBoxAscent, m.actualBoundingBoxDescent]);
            }
          }
          return result;
        }));
      } finally { await context.close(); }
    }
    expect(widths[1]).toEqual(widths[0]);
  });
}
