import { webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';

const clockProbe = () => new Promise(resolve => {
  const out = { raf: 0, interval: 0, timeout: 0, visibility: document.visibilityState, now: 0 };
  const start = performance.now();
  const tick = () => { out.raf++; if (performance.now() - start < 1200) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const iv = setInterval(() => { out.interval++; }, 100);
  setTimeout(() => { out.timeout++; }, 600);
  setTimeout(() => { clearInterval(iv); out.now = Math.round(performance.now() - start); resolve(out); }, 1400);
});

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
await page.goto(`${BASE}/catalogue.html`);

console.log('clocks right after load:', JSON.stringify(await page.evaluate(clockProbe)));
await page.waitForTimeout(1200);
console.log('clocks after 1.2s     :', JSON.stringify(await page.evaluate(clockProbe)));

const t0 = Date.now();
try {
  const shot = await page.screenshot({ timeout: 15000 });
  console.log(`screenshot during stall: ok ${shot.length} bytes in ${Date.now() - t0}ms`);
} catch (e) {
  console.log(`screenshot during stall: FAILED in ${Date.now() - t0}ms — ${e.message.split('\n')[0]}`);
}

// Raw mouse click at the badge centre, bypassing Playwright actionability entirely.
const box = await page.locator('.brand-badge').first().boundingBox();
const t1 = Date.now();
try {
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { timeout: 5000, noWaitAfter: true });
  console.log(`page.mouse.click during stall: ok in ${Date.now() - t1}ms`);
} catch (e) {
  console.log(`page.mouse.click during stall: FAILED in ${Date.now() - t1}ms — ${e.message.split('\n')[0]}`);
}

// Does a locator action that does not need rAF work?
const t2 = Date.now();
try {
  await page.locator('#vehicles .card').first().scrollIntoViewIfNeeded({ timeout: 5000 });
  console.log(`scrollIntoViewIfNeeded during stall: ok in ${Date.now() - t2}ms`);
} catch (e) {
  console.log(`scrollIntoViewIfNeeded during stall: FAILED in ${Date.now() - t2}ms — ${e.message.split('\n')[0]}`);
}

const t3 = Date.now();
try {
  await page.locator('.guide-context').first().click({ force: true, timeout: 5000 });
  console.log(`force click during stall: ok in ${Date.now() - t3}ms`);
} catch (e) {
  console.log(`force click during stall: FAILED in ${Date.now() - t3}ms — ${e.message.split('\n')[0]}`);
}

const badge = await page.evaluate(() => {
  const b = document.querySelector('.brand-badge');
  const cs = getComputedStyle(b);
  const r = b.getBoundingClientRect();
  return {
    rect: [r.x, r.y, r.width, r.height].map(n => Math.round(n)),
    position: cs.position, zIndex: cs.zIndex, display: cs.display, overflow: cs.overflow,
    backdropFilter: cs.backdropFilter, filter: cs.filter, isolation: cs.isolation,
    contain: cs.contain, transform: cs.transform, willChange: cs.willChange,
    boxShadow: cs.boxShadow, mixBlend: cs.mixBlendMode, clipPath: cs.clipPath,
    mask: cs.maskImage, contentVisibility: cs.contentVisibility,
  };
});
console.log('badge computed:', JSON.stringify(badge));

await context.close();

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

console.log('=== badge stacking variants at 320px ===');
const cases = [
  ['baseline', ''],
  ['.brand-badge z-index:auto', '.brand-badge{z-index:auto!important}'],
  ['.brand-badge position:static', '.brand-badge{position:static!important}'],
  ['.brand-badge absolute, no z-index, no blur', '.brand-badge{z-index:auto!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important}'],
  ['.brand-badge outline instead of box-shadow', '.brand-badge{box-shadow:none!important;backdrop-filter:none!important}'],
  ['.brand-badge plain text (empty)', '.brand-badge{background:#eee!important;backdrop-filter:none!important;box-shadow:none!important}'],
  ['baseline repeat', ''],
];
for (const [label, css] of cases) {
  const c = await browser.newContext({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
  const p = await c.newPage();
  await p.goto(`${BASE}/catalogue.html`);
  if (css) await p.addStyleTag({ content: css });
  await p.waitForTimeout(400);
  const raf = await p.evaluate(rafProbe);
  await c.close();
  console.log(`${label}: ${raf.ticks} ticks/${raf.ms}ms ${raf.stalled ? 'STALLED' : 'ok'}`);
}

await browser.close();
