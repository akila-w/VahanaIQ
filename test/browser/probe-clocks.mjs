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

const BADGE = `.photo-button .brand-badge,
:root:not([data-theme="light"]) .photo-button .brand-badge,
[data-theme="dark"] .photo-button .brand-badge`;
const off = sel => `${sel}{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`;

const badgeOff = off(BADGE);
const filtersOff = off('.filters');
const cardOff = off('.card');
const dialogOff = off('dialog');

const browser = await webkit.launch();

async function rate(label, css, width = 320, trials = TRIALS) {
  let stalled = 0;
  const detail = [];
  let seen = '';
  for (let i = 0; i < trials; i++) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${BASE}/catalogue.html`);
    if (css) await page.addStyleTag({ content: css });
    await page.waitForTimeout(400);
    const raf = await page.evaluate(rafProbe);
    if (i === 0) {
      seen = await page.evaluate(() => {
        const b = document.querySelector('.brand-badge');
        const f = document.querySelector('.filters');
        const c = document.querySelector('.card');
        return `badge=${getComputedStyle(b).backdropFilter} filters=${getComputedStyle(f).backdropFilter} card=${getComputedStyle(c).backdropFilter}`;
      });
    }
    await context.close();
    const dead = raf.stalled || raf.ticks < 10;
    if (dead) stalled++;
    detail.push(raf.ticks);
  }
  console.log(`${label} @${width}: ${stalled}/${trials} stalled | ticks ${detail.join(',')} | ${seen}`);
}

console.log('=== backdrop-filter sources at 320px ===');
await rate('baseline', '');
await rate('badges only off', badgeOff);
await rate('filters only off', filtersOff);
await rate('badges + filters off', `${badgeOff}\n${filtersOff}`);
await rate('all blur off', `${badgeOff}\n${filtersOff}\n${cardOff}\n${dialogOff}`);
await rate('all blur off + aurora off', `${badgeOff}\n${filtersOff}\n${cardOff}\n${dialogOff}\nbody::before,body::after{display:none!important}`);

await browser.close();
