// Comparable local lab fixture. Run: node scripts/measure-fonts.mjs [output-dir]
// Baseline is the immutable Task 02 release; candidate is the current checkout.
// gzip mirrors encoded transport, not GitHub Pages' deployment/cache behaviour.
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { seedReturning } from '../test/browser/returning-user.mjs';
const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.argv[2] || 'qa/2026-10-28-task03');
await fs.mkdir(out, {recursive:true});
const baseline = '0494ecdbb362dbd6c39cc2ee5aadbd9ae73108ad';
const baselineFiles = new Map(['css/tokens.css','sw.js'].map(f => [f,execFileSync('git',['show',`${baseline}:${f}`])]));
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
let variant = 'before';
const server = http.createServer(async(req,res)=>{
  const file = decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'') || 'index.html';
  const target=path.resolve(root,file);
  try {
    if(!target.startsWith(root+path.sep)) throw Error();
    let body=variant==='before' && baselineFiles.has(file) ? baselineFiles.get(file) : await fs.readFile(target);
    res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-cache');
    if (!/\.(woff2|png|webp|jpg|ico)$/.test(file)) { body=gzipSync(body); res.setHeader('Content-Encoding','gzip'); }
    res.end(body);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
const results=[];
try {
// Alternate variants to reduce temperature/order bias. All cold sessions have
// empty HTTP caches and blocked workers; returning means onboarding complete.
for(let sample=0;sample<5;sample++) for(const session of ['first','returning','warm']) for(const v of sample%2?['after','before']:['before','after']) {
  variant=v;
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:session==='warm'?'allow':'block'});
  await context.route(/https:\/\//,r=>r.abort());
  if(session!=='first') await seedReturning(context);
  const page=await context.newPage();
  if(session==='warm') {
    await page.goto(origin); await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  }
  await context.addInitScript(()=>{
    window.__metrics={lcp:0,cls:0,lcpElement:'',shifts:[],paints:[]};
    new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__metrics.lcp=e.startTime;window.__metrics.lcpElement=e.element?.outerHTML.slice(0,300);}}).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput){window.__metrics.cls+=e.value;window.__metrics.shifts.push({time:e.startTime,value:e.value});}}).observe({type:'layout-shift',buffered:true});
    document.fonts.addEventListener('loadingdone',()=>window.__metrics.fontsDone=performance.now());
  });
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8,connectionType:'cellular4g'});
  if(sample===0 && session!=='warm') await cdp.send('Tracing.start',{categories:'devtools.timeline,loading,blink.user_timing',transferMode:'ReturnAsStream'});
  await page.goto(origin+'/index.html',{waitUntil:'load',timeout:120000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(2500);
  const metrics=await page.evaluate(()=>({...window.__metrics,paints:performance.getEntriesByType('paint').map(e=>({name:e.name,time:e.startTime})),resources:performance.getEntriesByType('resource').map(e=>({name:new URL(e.name).pathname,encoded:e.encodedBodySize,transfer:e.transferSize,start:e.startTime,end:e.responseEnd,duration:e.duration})),navigation:performance.getEntriesByType('navigation')[0].toJSON()}));
  const fonts=metrics.resources.filter(e=>/\.(ttf|woff2)$/.test(e.name));
  const row={variant:v,session,sample:sample+1,lcp:metrics.lcp,cls:metrics.cls,fontBytes:fonts.reduce((n,e)=>n+(e.transfer?e.encoded:0),0),fontTransfer:fonts.reduce((n,e)=>n+e.transfer,0),fontRequests:fonts.length,fontEnd:Math.max(...fonts.map(e=>e.end)),initialTransfer:metrics.resources.reduce((n,e)=>n+e.transfer,0),...metrics};
  results.push(row); await fs.writeFile(path.join(out,'performance.json'),JSON.stringify(results,null,2));
  if(sample===0 && session!=='warm') {
    const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r)); await cdp.send('Tracing.end');
    const {stream}=await done;let trace='';while(true){const x=await cdp.send('IO.read',{handle:stream});trace+=x.data;if(x.eof)break;}await cdp.send('IO.close',{handle:stream});await fs.writeFile(path.join(out,`${v}-${session}-trace.json`),trace);
  }
  console.log(JSON.stringify({variant:v,session,sample:sample+1,lcp:row.lcp,cls:row.cls,fontBytes:row.fontBytes,fontEnd:row.fontEnd,initialTransfer:row.initialTransfer}));
  await context.close();
}
} finally {await browser.close();await new Promise(r=>server.close(r));}
