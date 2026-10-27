import { webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';

const rafProbe = () => new Promise(resolve => {
  let ticks = 0;
  const start = performance.now();
  const tick = now => {
    ticks++;
    if (now - start < 1500) requestAnimationFrame(tick);
    else resolve({ ticks, ms: Math.round(now - start) });
  };
  requestAnimationFrame(tick);
  setTimeout(() => resolve({ ticks, ms: 6000, stalled: true }), 6000);
});

const browser = await webkit.launch();

async function frameTest({ width = 320, css = '', route = 'catalogue', label = '' }) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${BASE}/${route}.html`);
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(400);
  const raf = await page.evaluate(rafProbe);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await context.close();
  console.log(`${label}: ${raf.ticks} ticks/${raf.ms}ms ${raf.stalled ? 'STALLED' : 'ok'} | docH ${h}`);
}

const cases = [
  ['baseline', ''],
  ['.photo-button aspect-ratio off, fixed height', '.photo-button{aspect-ratio:auto!important;height:178px!important}'],
  ['.photo-button overflow visible', '.photo-button{overflow:visible!important}'],
  ['.photo-button overflow clip', '.photo-button{overflow:clip!important}'],
  ['.photo-button padding-top ratio box', '.photo-button{aspect-ratio:auto!important;height:0!important;padding-top:62.5%!important}'],
  ['.brand-badge display:none', '.brand-badge{display:none!important}'],
  ['.brand-badge no backdrop-filter', '.photo-button .brand-badge{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'],
  ['.photo-count display:none', '.photo-count{display:none!important}'],
  ['img transition:none', '.photo-button img{transition:none!important}'],
  ['.card border-radius:0', '.card{border-radius:0!important}'],
  ['.card overflow:visible', '.card{overflow:visible!important}'],
  ['.card overflow:clip', '.card{overflow:clip!important}'],
  ['.photo-button contain:paint', '.photo-button{contain:paint!important}'],
  ['.photo-button isolation:isolate', '.photo-button{isolation:isolate!important}'],
  ['.photo-button backface-visibility', '.photo-button{backface-visibility:hidden!important;transform:translateZ(0)!important}'],
  ['.photo-button width:auto', '.photo-button{width:auto!important}'],
  ['.photo-button position:static', '.photo-button{position:static!important}'],
  ['only .card content-visibility (control)', '.card{content-visibility:auto!important;contain-intrinsic-size:auto 700px}'],
  ['baseline repeat', ''],
];

console.log('=== .photo-button internals at 320px ===');
for (const [label, css] of cases) await frameTest({ label, css });

await browser.close();
