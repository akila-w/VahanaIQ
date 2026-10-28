// Font-only baseline comparison; uses the local server on 8123.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { seedReturning } from '../test/browser/returning-user.mjs';
const out='qa/2026-10-28-task03/visual';await fs.mkdir(out,{recursive:true});
const baseline=execFileSync('git',['show','0494ecd:css/tokens.css']);
const b=await chromium.launch();const results=[];
try {
for(const route of ['index','catalogue','studio','about','privacy','terms']) for(const mode of ['phone-light','phone-dark','wide-light','wide-dark','print','reduced','fallback','first']) {
 if(['first'].includes(mode) && route!=='index')continue;
 const pair=[];
 for(const variant of ['before','after']) {
  const c=await b.newContext({viewport:{width:mode.startsWith('wide')||mode==='print'?1440:390,height:844},deviceScaleFactor:1,serviceWorkers:'block',colorScheme:mode.endsWith('dark')?'dark':'light',reducedMotion:'reduce'});
  if(mode!=='first')await seedReturning(c);
  await c.route(/https:\/\//,r=>r.abort());
  if(variant==='before')await c.route('**/css/tokens.css*',r=>r.fulfill({body:baseline,contentType:'text/css'}));
  if(mode==='fallback')await c.route(/\.(ttf|woff2)$/,r=>r.abort());
  const p=await c.newPage();await p.goto(`http://127.0.0.1:8123/${route}.html`);await p.evaluate(()=>document.fonts.ready);
  await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
  await p.waitForTimeout(400);
  if(mode==='print')await p.emulateMedia({media:'print'});
  const fonts=await p.evaluate(()=>[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight})));
  const geometry=await p.evaluate(()=>Array.from(document.querySelectorAll('h1,h2,h3,button,input,select,nav,a,.brand,dialog,table')).filter(e=>e.getBoundingClientRect().width).map(e=>{let r=e.getBoundingClientRect();let s=getComputedStyle(e);return {tag:e.tagName,id:e.id,text:e.textContent.slice(0,65),x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontFamily,weight:s.fontWeight}}));
  const file=`${out}/${route}-${mode}-${variant}.png`;await p.screenshot({path:file,fullPage:true,animations:'disabled'});
  pair.push({variant,fonts,geometry,file});await c.close();
 }
 const equal=JSON.stringify(pair[0].geometry)===JSON.stringify(pair[1].geometry);
 results.push({route,mode,equal,...{before:pair[0],after:pair[1]}});
 console.log(route,mode,equal?'identical geometry':'GEOMETRY DIFF');
 await fs.writeFile(`${out}/comparisons.json`,JSON.stringify(results,null,2));
}
} finally {await b.close();}
