// Static catalogue page: does the frame clock run at each width, with and without
// the make-badge backdrop blur? No interaction, so any stall is pure rendering.
import { webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const TRIALS = Number(process.env.TRIALS || 4);
const WIDTHS = (process.env.WIDTHS || '320,390,768,1024,1440,1920').split(',').map(Number);

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
[data-theme="dark"] .photo-button .brand-badge,
:root:not([data-theme="light"]) .photo-button .brand-badge`;
const variants = {
  current: '',
  'badge blur off everywhere': `${BADGE}{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`,
  'badge + guide-label blur off': `${BADGE},.guide-label{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`,
};

const browser = await webkit.launch();

for (const width of WIDTHS) {
  for (const [label, css] of Object.entries(variants)) {
    const ticks = [];
    let stalled = 0;
    for (let i = 0; i < TRIALS; i++) {
      const context = await browser.newContext({
        viewport: { width, height: width < 768 ? 844 : 900 },
        ...(width < 768 ? { hasTouch: true } : {}),
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/catalogue.html`);
      if (css) await page.addStyleTag({ content: css });
      await page.waitForTimeout(300);
      const raf = await page.evaluate(rafProbe);
      if (raf.stalled || raf.ticks < 10) stalled++;
      ticks.push(raf.ticks);
      await context.close();
    }
    console.log(`@${width} ${label}: ${stalled}/${TRIALS} stalled | ticks ${ticks.join(',')}`);
  }
}

await browser.close();
