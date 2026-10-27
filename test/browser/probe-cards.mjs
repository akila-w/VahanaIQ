// Reproduces the heaviest interaction in the suite: 24 catalogue cards on screen,
// then measures whether the WebKit frame clock keeps running.
import { webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const TRIALS = Number(process.env.TRIALS || 4);
const WIDTHS = (process.env.WIDTHS || '390,1024,1440,1920').split(',').map(Number);

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

for (const width of WIDTHS) {
  const results = [];
  let stalled = 0;
  for (let i = 0; i < TRIALS; i++) {
    const context = await browser.newContext({
      viewport: { width, height: width < 768 ? 844 : 900 },
      ...(width < 768 ? { hasTouch: true } : {}),
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/catalogue.html`);
    await page.waitForTimeout(300);
    try {
      await page.locator('#addVehicleBtn').click({ timeout: 20000 });
      await page.fill('#catalogueSearch', 'Toyota');
      await page.locator('#catalogueAddSearch').click({ timeout: 20000 });
      await page.locator('#rows tr').first().waitFor({ timeout: 20000 });
    } catch (error) {
      results.push(`trial${i}:${error.message.split('\n')[0]}`);
    }
    const count = await page.locator('#rows tr').count();
    const raf = await page.evaluate(rafProbe);
    const dead = raf.stalled || raf.ticks < 10;
    if (dead) stalled++;
    results.push(`t${i}:${raf.ticks}t/${count}rows`);
    await context.close();
  }
  console.log(`catalogue 24 vehicles @${width}: ${stalled}/${TRIALS} stalled | ${results.join(' ')}`);
}

await browser.close();
