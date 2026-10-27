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

async function frameTest(width, css = '', route = 'catalogue') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${BASE}/${route}.html`);
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(400);
  const raf = await page.evaluate(rafProbe);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await context.close();
  return `${raf.ticks} ticks / ${raf.ms}ms${raf.stalled ? ' STALLED' : ''} (docH ${height})`;
}

console.log('--- width sweep, catalogue.html ---');
for (const width of [599, 600, 601, 640, 650, 651, 699, 700, 750, 760, 761, 820]) {
  console.log(`width ${width}: ${await frameTest(width)}`);
}

console.log('--- element/CSS bisect at 320px, catalogue.html ---');
const variants = [
  ['stylesheet disabled', 'html{all:unset}'],
  ['hide #vehicles', '#vehicles{display:none!important}'],
  ['hide images', 'img,#vehicles .photo-button{display:none!important}'],
  ['hide .filters', '.filters,#filters{display:none!important}'],
  ['hide header', '.site-header,.info-header{display:none!important}'],
  ['no shadows/filters', '*{box-shadow:none!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'],
  ['no sticky', '*{position:static!important}'],
];
for (const [label, css] of variants) console.log(`${label}: ${await frameTest(320, css)}`);

console.log(`index.html at 320: ${await frameTest(320, '', 'index')}`);
console.log(`index.html at 768: ${await frameTest(768, '', 'index')}`);
await browser.close();
