// Task 03.1: Linux Firefox isolation. Does not modify application or font files.
import { firefox } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { seedReturning } from '../test/browser/returning-user.mjs';
const out=path.resolve(process.env.FONT_DIAG_OUT||'qa/task031-diagnostics');await fs.mkdir(out,{recursive:true});
const origin=process.env.BASE_URL||'http://127.0.0.1:8123';
const tokens=await fs.readFile('css/tokens.css','utf8');
const ttf=tokens.replaceAll('-variable.woff2','-variable.ttf').replaceAll('format("woff2")','format("truetype")');
const samples=['LKR 1,234,567.89 — − + % £ € ₹ ₨','Café Škoda Ελληνικά Україна','සිංහල','தமிழ்','🚗','සිංහල தமிழ் 🚗'];
const weights=[200,400,650,750,800];
const result={date:'28/10/2026',platform:process.platform,arch:process.arch,cases:[],pairs:[]};
function command(bin,args){try{return execFileSync(bin,args,{encoding:'utf8'}).trim()}catch(e){return String(e)}}
result.os=command('cat',['/etc/os-release']);result.fcList=command('fc-list',['--format','%{family}|%{style}|%{file}\n']);
result.fontMatches=Object.fromEntries(['sans-serif:charset=0dc3','sans-serif:charset=0ba4','sans-serif:charset=1f697'].map(x=>[x,command('fc-match',['-s','--format','%{family}|%{style}|%{file}\n',x])]));
let b;
async function launch(label){b=await firefox.launch({env:{...process.env,MOZ_LOG:'fontlist:5,textrun:5',MOZ_LOG_FILE:path.join(out,label+'-native-fonts.log')}});result.browser=b.version();}
async function context(){const c=await b.newContext({serviceWorkers:'block',viewport:{width:1100,height:900}});await seedReturning(c);await c.route(/https:\/\//,r=>r.abort());await c.addInitScript(()=>{window.__fontEvents=[];for(const type of ['loading','loadingdone','loadingerror'])document.fonts.addEventListener(type,e=>window.__fontEvents.push({type,time:performance.now(),faces:e.fontfaces.map(f=>({family:f.family,weight:f.weight,status:f.status}))}));});return c;}
async function measure(p,families=['Inter','Manrope','sans-serif']){return p.evaluate(({families,weights,samples})=>{const c=document.createElement('canvas').getContext('2d'),rows=[];for(const family of families)for(const weight of weights)for(const text of samples){c.font=`${weight} 24px ${family==='sans-serif'?family:JSON.stringify(family)+', sans-serif'}`;const m=c.measureText(text);rows.push({family,weight,text,width:m.width,ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent});}return rows;},{families,weights,samples});}
async function exercise(p,families=['Inter','Manrope','sans-serif']){await p.evaluate(async({families,weights,samples})=>{document.querySelector('#fontDiagnostic')?.remove();const host=document.createElement('section');host.id='fontDiagnostic';host.style='background:white;color:black;padding:12px;position:relative;z-index:2000';for(const family of families)for(const weight of weights){const row=document.createElement('p');row.style=`font:${weight} 24px ${family==='sans-serif'?family:JSON.stringify(family)+', sans-serif'};margin:4px`;row.textContent=samples.slice(2).join(' | ');host.append(row);}document.body.prepend(host);host.getBoundingClientRect();await Promise.all(families.filter(f=>f!=='sans-serif').flatMap(f=>weights.map(w=>document.fonts.load(`${w} 24px ${JSON.stringify(f)}`,samples.join(' ')))));await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},{families,weights,samples});}
async function run(c,format,label){if(format==='ttf')await c.route('**/css/tokens.css*',r=>r.fulfill({body:ttf,contentType:'text/css'}));else await c.unroute('**/css/tokens.css*');const p=await c.newPage();await p.goto(origin+'/index.html');await p.evaluate(()=>document.fonts.ready);const r={label,format,initialFaces:await p.evaluate(()=>[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight}))),first:await measure(p),second:await measure(p)};await exercise(p);r.exercised=await measure(p);r.exercisedAgain=await measure(p);r.fontEvents=await p.evaluate(()=>window.__fontEvents);await p.screenshot({path:path.join(out,label+'.png')});result.cases.push(r);await p.close();return r;}
function compare(a,b,stage){return a[stage].flatMap((x,i)=>JSON.stringify(x)===JSON.stringify(b[stage][i])?[]:[{before:x,after:b[stage][i]}]);}
try{
 // Same-format controls and both cross-format orders in fresh contexts.
 for(const [a,z]of [['ttf','ttf'],['woff2','woff2'],['ttf','woff2'],['woff2','ttf']]){
  await launch(a+'-'+z+'-fresh');
  const pair=[];for(const [i,f]of [a,z].entries()){const c=await context();try{pair.push(await run(c,f,`${a}-${z}-fresh-${i}`))}finally{await c.close()}}
  result.pairs.push({mode:'fresh',formats:[a,z],differences:Object.fromEntries(['first','second','exercised','exercisedAgain'].map(s=>[s,compare(...pair,s)]))});await b.close();
 }
 for(const formats of [['ttf','woff2'],['woff2','ttf']]){await launch(formats.join('-')+'-shared');const c=await context();try{const pair=[];for(const[i,f]of formats.entries())pair.push(await run(c,f,`${formats.join('-')}-shared-${i}`));result.pairs.push({mode:'shared-context',formats,differences:Object.fromEntries(['first','second','exercised','exercisedAgain'].map(s=>[s,compare(...pair,s)]))});}finally{await c.close();await b.close()}}
 // Both source formats present simultaneously, independent of context changes.
 await launch('simultaneous');const c=await context();try{const p=await c.newPage();await p.goto(origin+'/about.html');await p.evaluate(async()=>{for(const family of ['Inter','Manrope'])for(const format of ['ttf','woff2']){const f=new FontFace(`${family} ${format}`,`url(/assets/fonts/${family.toLowerCase()}/${family}-variable.${format})`,{weight:family==='Inter'?'100 900':'200 800',style:'normal'});document.fonts.add(f);await f.load();}});const families=['Inter ttf','Inter woff2','Manrope ttf','Manrope woff2','sans-serif','FreeSans','FreeSerif','DejaVu Sans','Unifont','Noto Color Emoji'];const r={label:'simultaneous',first:await measure(p,families)};await exercise(p,families);r.exercised=await measure(p,families);r.exercisedAgain=await measure(p,families);r.fontEvents=await p.evaluate(()=>window.__fontEvents);await p.screenshot({path:path.join(out,'simultaneous.png')});result.cases.push(r);await p.close();}finally{await c.close()}
}finally{await b.close();await fs.writeFile(path.join(out,'diagnostic.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({browser:result.browser,pairs:result.pairs.map(x=>({mode:x.mode,formats:x.formats,differences:Object.fromEntries(Object.entries(x.differences).map(([s,rows])=>[s,rows.length]))}))},null,2));}
