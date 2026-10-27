// Measures what happens when the calculator details modal opens on WebKit:
// does the frame clock keep running, and does the .modal get a layout box at once?
import { webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const TRIALS = Number(process.env.TRIALS || 4);
const WIDTHS = (process.env.WIDTHS || '600,1920').split(',').map(Number);

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
  baseline: '',
  'modal blur off': off('.modal'),
  'modal + dialog backdrop off': `${off('.modal')}\n${off('dialog::backdrop')}\ndialog::backdrop{backdrop-filter:none!important}`,
  'all glass blur off': `${off('.modal')}${off('.filters')}${off('.card')}${off('.catalogue-card')}`,
};

const INPUTS = { income: '220000', rate: '16', tenure: '84', down: '60', insurance: '120000', fees: '150000' };
const CAR = { id: 'qa-example', name: 'Independent QA example', price: 7269515.4, cond: 'New', pt: 'Petrol', w: 'Official', img: '', custom: true };

const browser = await webkit.launch();

async function run(label, css, width) {
  let noBox = 0;
  let stalled = 0;
  const notes = [];
  for (let i = 0; i < TRIALS; i++) {
    const context = await browser.newContext({ viewport: { width, height: width === 844 ? 390 : 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.addInitScript(({ inputs, car }) => {
      localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify(inputs));
      localStorage.setItem('vahanaiq_comparison_v3', JSON.stringify({ version: 3, cars: [car] }));
      localStorage.setItem('vahanaiq_guidance_v1', JSON.stringify({ version: 1, welcomed: true, tips: false, tours: {} }));
    }, { inputs: INPUTS, car: CAR });
    await page.goto(`${BASE}/index.html`);
    if (css) await page.addStyleTag({ content: css });
    try {
      await page.locator('#rows [data-act="details"]').click({ timeout: 20000 });
    } catch (error) {
      notes.push(`trial${i}:click=${error.message.split('\n')[0]}`);
    }
    const box = await page.evaluate(() => {
      const m = document.querySelector('.modal-bg.open .modal');
      if (!m) return { state: 'no open modal' };
      const r = m.getBoundingClientRect();
      return { state: 'ok', rects: m.getClientRects().length, w: Math.round(r.width), h: Math.round(r.height), display: getComputedStyle(m).display, vis: getComputedStyle(m).visibility };
    });
    const raf = await page.evaluate(rafProbe);
    const dead = raf.stalled || raf.ticks < 10;
    if ('state' in box) { noBox++; notes.push(`trial${i}:${JSON.stringify(box)}`); }
    if (dead) stalled++;
    notes.push(`ticks${i}=${raf.ticks}`);
    await context.close();
  }
  console.log(`${label} @${width}: no-box ${noBox}/${TRIALS} | stalled ${stalled}/${TRIALS} | ${notes.join(' ')}`);
}

for (const width of WIDTHS) {
  console.log(`=== details modal at ${width}px ===`);
  for (const [label, css] of Object.entries(variants)) await run(label, css, width);
}

await browser.close();
