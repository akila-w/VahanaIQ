import { webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';

const rafProbe = () => new Promise(resolve => {
  const ticks = [];
  const start = performance.now();
  let last = start;
  const tick = now => {
    ticks.push(Math.round(now - last));
    last = now;
    if (now - start < 2000) requestAnimationFrame(tick);
    else resolve({ ticks: ticks.length, maxGap: Math.max(...ticks), medianGap: ticks.sort((a, b) => a - b)[Math.floor(ticks.length / 2)] || 0 });
  };
  requestAnimationFrame(tick);
  setTimeout(() => resolve({ ticks: ticks.length, stalled: true }), 6000);
});

async function run(label, width, { touch = false, css = '' } = {}) {
  const browser = await webkit.launch();
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', hasTouch: touch });
  const page = await context.newPage();
  await page.goto(`${BASE}/catalogue.html`);
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(500);
  const raf = await page.evaluate(rafProbe);
  const blurred = await page.evaluate(() => [...document.querySelectorAll('*')].filter(el => {
    const style = getComputedStyle(el);
    return style.backdropFilter && style.backdropFilter !== 'none';
  }).length);
  let result = 'clicked';
  const started = Date.now();
  try {
    await page.locator('#helpCentreButton').click({ timeout: 8000 });
  } catch (error) {
    result = `${error.message.split('\n')[0]} after ${Date.now() - started}ms`;
  }
  console.log(`${label} | width=${width} touch=${touch} backdropElements=${blurred} rafTicks/2s=${raf.ticks} maxGap=${raf.maxGap}ms medianGap=${raf.medianGap}ms | ${result}`);
  await context.close();
  await browser.close();
}

await run('baseline', 320);
await run('touch (pointer coarse)', 320, { touch: true });
await run('no backdrop-filter', 320, { css: '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' });
await run('baseline', 768);
await run('baseline', 600);
