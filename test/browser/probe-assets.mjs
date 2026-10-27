import { webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const browser = await webkit.launch();

for (const width of [320, 750, 820]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  let requests = 0, bytes = 0;
  page.on('response', async res => {
    const url = res.url();
    if (!/\.(jpe?g|png|webp|avif|svg)(\?|$)/i.test(url)) return;
    requests++;
    try { bytes += (await res.body()).length; } catch {}
  });
  const t0 = Date.now();
  await page.goto(`${BASE}/catalogue.html`, { waitUntil: 'load' });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(1000);
  const stats = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('#vehicles img')];
    const loaded = imgs.filter(i => i.complete && i.naturalWidth);
    return {
      cards: document.querySelectorAll('#vehicles .card').length,
      imgs: imgs.length,
      loaded: loaded.length,
      eager: imgs.filter(i => i.loading === 'eager').length,
      currentSrc: loaded.slice(0, 3).map(i => `${i.currentSrc.split('/').pop()} ${i.naturalWidth}x${i.naturalHeight}`),
      decodedBytes: loaded.reduce((n, i) => n + i.naturalWidth * i.naturalHeight * 4, 0),
    };
  });
  console.log(`width ${width}: load ${loadMs}ms, ${requests} image responses, ${(bytes / 1048576).toFixed(1)} MB transferred`, JSON.stringify(stats));
  await context.close();
}
await browser.close();
