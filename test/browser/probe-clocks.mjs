import { webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const TRIALS = 6;

const rafProbe = () => new Promise(resolve => {
  let ticks = 0;
  const start = performance.now();
  const tick = now => {
    ticks++;
    if (now - start < 1200) requestAnimationFrame(tick);
    else resolve({ ticks, ms: Math.round(now - start) });
  };
  requestAnimationFrame(tick);
  setTimeout(() => resolve({ ticks, ms: 5000, stalled: true }), 5000);
});

async function rate(browser, label, route, width, trials = TRIALS) {
  let stalled = 0;
  const detail = [];
  for (let i = 0; i < trials; i++) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${BASE}/${route}.html`);
    await page.waitForTimeout(400);
    const raf = await page.evaluate(rafProbe);
    await context.close();
    const dead = raf.stalled || raf.ticks < 10;
    if (dead) stalled++;
    detail.push(raf.ticks);
  }
  console.log(`${label}: ${stalled}/${trials} stalled | ticks ${detail.join(',')}`);
}

const browser = await webkit.launch();
console.log('=== default launch ===');
await rate(browser, 'catalogue 320', 'catalogue', 320);
await rate(browser, 'catalogue 1280', 'catalogue', 1280);
await rate(browser, 'index 320', 'index', 320);
await browser.close();

for (const env of [
  { WEBKIT_DISABLE_COMPOSITING_MODE: '1' },
  { LIBGL_ALWAYS_SOFTWARE: '1' },
  { WEBKIT_DISABLE_DMABUF_RENDERER: '1' },
]) {
  const b = await webkit.launch({ env: { ...process.env, ...env } });
  console.log(`=== env ${JSON.stringify(env)} ===`);
  await rate(b, 'catalogue 320', 'catalogue', 320, 4);
  await b.close();
}
