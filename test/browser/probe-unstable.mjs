import { webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';

async function probe(width) {
  const browser = await webkit.launch();
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${BASE}/catalogue.html`);
  await page.waitForTimeout(400);
  const samples = [];
  for (let i = 0; i < 25; i++) {
    samples.push(await page.evaluate(() => {
      const btn = document.querySelector('#helpCentreButton').getBoundingClientRect();
      const card = document.querySelector('#vehicles > .card, #vehicles .card');
      const cr = card ? card.getBoundingClientRect() : null;
      return {
        scrollY: Math.round(window.scrollY),
        docH: document.documentElement.scrollHeight,
        bodyH: Math.round(document.body.getBoundingClientRect().height),
        vvH: Math.round(window.visualViewport ? window.visualViewport.height : 0),
        btn: [Math.round(btn.x), Math.round(btn.y), Math.round(btn.width), Math.round(btn.height)],
        card: cr ? [Math.round(cr.y), Math.round(cr.height)] : null,
        running: document.getAnimations().filter(a => a.playState === 'running').map(a => `${a.animationName || a.transitionProperty}@${a.effect?.target?.className || a.effect?.target?.tagName}`),
      };
    }));
    await page.waitForTimeout(100);
  }
  const stable = new Set(samples.map(s => JSON.stringify([s.btn, s.scrollY, s.docH]))).size;
  console.log(`\n=== ${width}px: ${stable} distinct states across 25 samples ===`);
  console.log(JSON.stringify(samples.slice(0, 6), null, 1));
  const running = [...new Set(samples.flatMap(s => s.running))];
  console.log('running animations:', JSON.stringify(running));
  let clickError = 'none';
  try {
    await page.locator('#helpCentreButton').click({ timeout: 8000 });
  } catch (error) {
    clickError = error.message.split('\n').slice(0, 14).join('\n');
  }
  console.log('--- click result ---\n', clickError);
  await page.screenshot({ path: `catalogue-${width}.png`, fullPage: false });
  await context.close();
  await browser.close();
}

for (const width of [320, 768]) await probe(width);
