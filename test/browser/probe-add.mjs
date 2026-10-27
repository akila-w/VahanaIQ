// The heaviest calculator flow: add 24 Toyota vehicles through the catalogue picker,
// then measure the frame clock. Splits the remaining blur cost per surface.
import { webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const TRIALS = Number(process.env.TRIALS || 3);
const WIDTHS = (process.env.WIDTHS || '390,1024,1440').split(',').map(Number);

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

const off = sel => `${sel}{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`;
const variants = {
  current: '',
  'catalogue-card blur off': off('.catalogue-card'),
  'panel + card blur off': `${off('.catalogue-card')}${off('.panel')}${off('.card')}${off('.filters')}${off('.page-nav')}`,
  'all backdrop blur off': '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  'all blur off + aurora': `*{backdrop-filter:none!important}body::before,body::after{filter:none!important}`,
};

const browser = await webkit.launch();

for (const width of WIDTHS) {
  for (const [label, css] of Object.entries(variants)) {
    const ticks = [];
    let stalled = 0;
    let note = '';
    for (let i = 0; i < TRIALS; i++) {
      const context = await browser.newContext({
        viewport: { width, height: width < 768 ? 844 : 900 },
        ...(width < 768 ? { hasTouch: true } : {}),
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        localStorage.setItem('vahanaiq_guidance_v1', JSON.stringify({ version: 1, welcomed: true, tips: false, tours: {} }));
      });
      await page.goto(`${BASE}/index.html`);
      if (css) await page.addStyleTag({ content: css });
      await page.waitForTimeout(300);
      try {
        await page.locator('#addVehicleBtn').click({ timeout: 20000 });
        await page.fill('#catalogueSearch', 'Toyota');
        await page.locator('#catalogueAddSearch').click({ timeout: 20000 });
        await page.locator('#rows tr').first().waitFor({ timeout: 20000 });
      } catch (error) {
        note = error.message.split('\n')[0];
      }
      const rows = await page.locator('#rows tr').count();
      const raf = await page.evaluate(rafProbe);
      if (raf.stalled || raf.ticks < 10) stalled++;
      ticks.push(`${raf.ticks}/${rows}`);
      await context.close();
    }
    console.log(`@${width} ${label}: ${stalled}/${TRIALS} stalled | ticks/rows ${ticks.join(',')}${note ? ` | ${note}` : ''}`);
  }
}

await browser.close();
