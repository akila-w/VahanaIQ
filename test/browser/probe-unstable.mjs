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

async function frameTest({ width = 320, css = '', route = 'catalogue', init = null, label = '' }) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  if (init) await page.addInitScript(init);
  await page.goto(`${BASE}/${route}.html`);
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(400);
  const raf = await page.evaluate(rafProbe);
  const info = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight,
    imgs: document.querySelectorAll('#vehicles img').length,
    loaded: [...document.querySelectorAll('#vehicles img')].filter(i => i.complete && i.naturalWidth).length,
    lazy: document.querySelectorAll('img[loading="lazy"]').length,
    ready: document.readyState,
  }));
  await context.close();
  const flag = raf.stalled ? 'STALLED' : 'ok';
  console.log(`${label}: ${raf.ticks} ticks/${raf.ms}ms ${flag} | docH ${info.h} imgs ${info.imgs} loaded ${info.loaded} lazy ${info.lazy} ready ${info.ready}`);
}

console.log('=== 1. paint vs layout of card images, 320px ===');
await frameTest({ label: 'baseline', css: '' });
await frameTest({ label: 'img visibility:hidden', css: 'img{visibility:hidden!important}' });
await frameTest({ label: 'img display:none', css: 'img{display:none!important}' });
await frameTest({ label: 'img opacity:0', css: 'img{opacity:0!important}' });
await frameTest({ label: 'photo-button only hidden', css: '.photo-button{display:none!important}' });

console.log('=== 2. lazy loading / decode pipeline, 320px ===');
await frameTest({
  label: 'no native lazy (loading=eager)',
  init: `addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('img[loading="lazy"]').forEach(i=>{i.loading='eager'})});`,
});
await frameTest({
  label: 'IntersectionObserver stubbed out',
  init: `window.IntersectionObserver=class{constructor(){}observe(){}unobserve(){}disconnect(){}takeRecords(){return[]}};`,
});
await frameTest({
  label: 'img.decode stubbed out',
  init: `HTMLImageElement.prototype.decode=function(){return Promise.resolve()};`,
});
await frameTest({ label: 'srcset+sizes removed', css: 'img{width:284px;height:177px}' });
await frameTest({
  label: 'srcset/sizes/loading stripped',
  init: `addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('#vehicles img').forEach(i=>{i.removeAttribute('srcset');i.removeAttribute('sizes');i.loading='eager';})});`,
});

console.log('=== 3. stylesheet-by-stylesheet, 320px ===');
await frameTest({
  label: 'only tokens.css',
  init: `addEventListener('DOMContentLoaded',()=>{[...document.styleSheets].forEach(s=>{if(!/tokens\\.css/.test(s.href||''))s.disabled=true})});`,
});
await frameTest({
  label: 'no curated-catalogue.css',
  init: `addEventListener('DOMContentLoaded',()=>{[...document.styleSheets].forEach(s=>{if(/curated-catalogue\\.css/.test(s.href||''))s.disabled=true})});`,
});
await frameTest({
  label: 'no guidance.css',
  init: `addEventListener('DOMContentLoaded',()=>{[...document.styleSheets].forEach(s=>{if(/guidance\\.css/.test(s.href||''))s.disabled=true})});`,
});

console.log('=== 4. containment experiments, 320px ===');
await frameTest({ label: 'card contain:paint', css: '.card{contain:paint!important}' });
await frameTest({ label: 'video/lazy card content-visibility', css: '.card{content-visibility:auto!important;contain-intrinsic-size:auto 700px}' });
await frameTest({ label: '#vehicles content-visibility', css: '#vehicles{content-visibility:auto!important}' });
await frameTest({ label: 'images decoded-size cap', css: '#vehicles img{max-width:284px!important;height:auto!important}' });

console.log('=== 5. control repeat (browser health) ===');
await frameTest({ label: 'baseline repeat', css: '' });
await frameTest({ label: 'index.html 320', route: 'index' });

await browser.close();
