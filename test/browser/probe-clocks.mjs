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

async function frameTest(label, { css = '', width = 320, inline = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${BASE}/catalogue.html`);
  if (css) await page.addStyleTag({ content: css });
  if (inline) await page.evaluate(inline);
  await page.waitForTimeout(400);
  const raf = await page.evaluate(rafProbe);
  const seen = await page.evaluate(() => {
    const b = document.querySelector('.brand-badge');
    const cs = getComputedStyle(b);
    return `badge bf=${cs.backdropFilter} bg=${cs.backgroundColor} disp=${cs.display}`;
  });
  await context.close();
  console.log(`${label} @${width}: ${raf.ticks} ticks/${raf.ms}ms ${raf.stalled ? 'STALLED' : 'ok'} | ${seen}`);
}

const killBlurInline = `document.querySelectorAll('.brand-badge').forEach(b => {
  b.style.setProperty('backdrop-filter', 'none', 'important');
  b.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
});`;
const killBadgeInline = `document.querySelectorAll('.brand-badge').forEach(b => {
  b.style.setProperty('display', 'none', 'important');
});`;

// The selector that currently sets the blur wins on specificity, so match it exactly.
const PRODUCT_FIX = `
.photo-button .brand-badge,
:root:not([data-theme="light"]) .photo-button .brand-badge,
[data-theme="dark"] .photo-button .brand-badge {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}`;

console.log('=== is the badge backdrop-filter the trigger? ===');
await frameTest('baseline', {});
await frameTest('inline blur off (definitive)', { inline: killBlurInline });
await frameTest('inline display:none (control)', { inline: killBadgeInline });
await frameTest('candidate later-rule fix', { css: PRODUCT_FIX });
await frameTest('baseline repeat (control)', {});

console.log('=== candidate fix across widths ===');
for (const width of [320, 360, 375, 390, 414, 430, 600, 760, 820, 1280]) {
  await frameTest('candidate fix', { width, css: PRODUCT_FIX });
}

await browser.close();
