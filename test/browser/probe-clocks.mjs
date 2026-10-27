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

const browser = await webkit.launch();

async function rate(label, css, width = 320, trials = TRIALS) {
  let stalled = 0;
  const detail = [];
  for (let i = 0; i < trials; i++) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${BASE}/catalogue.html`);
    if (css) await page.addStyleTag({ content: css });
    await page.waitForTimeout(400);
    const raf = await page.evaluate(rafProbe);
    await context.close();
    const dead = raf.stalled || raf.ticks < 10;
    if (dead) stalled++;
    detail.push(raf.ticks);
  }
  console.log(`${label} @${width}: ${stalled}/${trials} stalled | ticks ${detail.join(',')}`);
}

console.log('=== aurora layers at 320px ===');
await rate('baseline', '');
await rate('aurora display:none', 'body::before,body::after{display:none!important}');
await rate('aurora blur removed', 'body::before,body::after{filter:none!important}');
await rate('aurora opacity 0', 'body::before,body::after{opacity:0!important}');

console.log('=== confirm at 1280px ===');
await rate('baseline', '', 1280, 4);
await rate('aurora display:none', 'body::before,body::after{display:none!important}', 1280, 4);

console.log('=== control ===');
await rate('baseline again', '');

await browser.close();
