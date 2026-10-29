// Focused diagnostic experiments. The standard suite keeps its original assertions.
import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {observeOnboarding} from './onboarding-observer.mjs';
const base=process.env.BASE_URL||'http://127.0.0.1:8123';
const mode=process.env.ONBOARDING_INTERACTION||'focus-explicit';
const cssVariant=process.env.ONBOARDING_CSS||'current';
if(!['current','baseline-auto'].includes(cssVariant))throw Error('Use current or baseline-auto anchoring');
test.use({trace:'on',screenshot:'only-on-failure'});
if(cssVariant==='baseline-auto')test.use({serviceWorkers:'block'});
if(process.env.ONBOARDING_PARALLEL==='1')test.describe.configure({mode:'parallel'});
const releaseByPage=new WeakMap();
test.beforeEach(async({page})=>{
 if(process.env.ONBOARDING_OBSERVE==='1')await page.addInitScript(observeOnboarding);
 if(cssVariant==='baseline-auto')await page.route('**/css/experience.css*',route=>route.fulfill({contentType:'text/css',body:readFileSync('css/experience.css','utf8')+'\n.onboarding-body { overflow-anchor: auto; }\n'}));
 await page.addInitScript(()=>{
  if(localStorage.getItem('vahanaiq_comparison_v3'))return;
  localStorage.setItem('vahanaiq_comparison_v3',JSON.stringify({version:3,cars:[{id:'saved-car',name:'Saved vehicle',price:9000000,cond:'New'}]}));
  localStorage.setItem('vahanaiq_inputs_v1',JSON.stringify({insurance:'120000',fees:'45000',dti:'0.5'}));
 });
});
test.afterEach(async({page},info)=>{
 releaseByPage.get(page)?.();
 if(process.env.ONBOARDING_OBSERVE==='1')await writeFile(info.outputPath('onboarding-observation.json'),JSON.stringify(await page.evaluate(()=>window.__onboardingObservation).catch(e=>({error:String(e)}))||{error:'Observer not initialised: no application document loaded'}));
});
// Generated cases share the worker's browser process; repeat-each starts a new
// repeat-index worker and therefore cannot exercise the same long-lived state.
for(let i=0;i<Number(process.env.ONBOARDING_CASES||6);i++)for(const route of ['catalogue','studio']){
 test.describe(`${route} case ${i}`,()=>{
 if(process.env.ONBOARDING_VARIANTS==='1'&&i%3===2)test.use({serviceWorkers:'block'});
 test(`${mode} saved-state journey`,async({page,browserName})=>{
  const variants=process.env.ONBOARDING_VARIANTS==='1';
  const width=Number(process.env.ONBOARDING_WIDTH||(variants?[1280,390,1440][i%3]:1280));
  await page.setViewportSize({width,height:width===1280?720:844});
  await page.emulateMedia({reducedMotion:process.env.ONBOARDING_MOTION||(variants&&i%2?'reduce':'no-preference')});
  const delayedImages=variants&&i%3===2;
  const keyboard=variants&&i%3===1;
  let releaseImages=()=>{},heldImages=0;
  if(delayedImages){
   const gate=new Promise(resolve=>{releaseImages=resolve;});
   releaseByPage.set(page,releaseImages);
   await page.route('**/assets/images/**',async route=>{heldImages++;await gate;await route.continue();});
  }
  await page.goto(`${base}/${route}.html?onboarding=1`,{waitUntil:delayedImages?'domcontentloaded':'load'});
  await page.getByRole('button',{name:'Start Guided Setup (Takes 2 min) →',exact:true}).click();
  await expect(page.locator('.onboarding-body')).toHaveCSS('overflow-anchor',cssVariant==='baseline-auto'?'auto':'none');
  const search=page.getByRole('searchbox',{name:'Search vehicles',exact:true});
  for(const [index,name]of ['Toyota Aqua','Toyota Camry Hybrid'].entries()){
   if(mode.startsWith('focus'))await search.click();
   await search.fill(name);
   const card=page.locator('.onboarding-car').filter({has:page.getByRole('heading',{name,exact:true})});
   const add=card.getByRole('button',{name:'+ Add to Shortlist',exact:true});
   if(delayedImages)await expect(card.locator('img')).toHaveJSProperty('complete',false);
   if(mode==='ready')await card.evaluate(async card=>{
    await document.fonts.ready;
    await Promise.all([...card.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
    await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
   });
   if(mode==='wheel') {
    const bounds=await page.locator('.onboarding-body').boundingBox();
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    await page.mouse.wheel(0,600);
    await expect(add).toBeInViewport();
   } else if(mode==='dom') {
    await add.evaluate(button=>button.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
    await expect(add).toBeInViewport();
   } else if(!['click','focus'].includes(mode)) {await add.scrollIntoViewIfNeeded();await expect(add).toBeInViewport();}
   if(keyboard){
    // Safari on macOS uses Option-Tab when the user's Tab preference skips buttons.
    const tabKey=process.platform==='darwin'&&browserName==='webkit'?'Alt+Tab':'Tab';
    for(let tab=0;tab<8&&!await add.evaluate(button=>document.activeElement===button);tab++)await page.keyboard.press(tabKey);
    await expect(add).toBeFocused();
    await expect(add).toBeInViewport();
    await page.keyboard.press('Space');
   }else await add.click();
   await expect(card.locator('.onboarding-car-btn')).toBeInViewport();
   await expect(page.locator('.onboarding-tray')).toContainText(`${index+1} of 12 selected`);
  }
  releaseImages();
  if(delayedImages){
   expect(heldImages).toBeGreaterThan(0);
   await page.locator('.onboarding-car img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  }
  await page.getByRole('button',{name:'Continue to Loan Terms →'}).click();
  await page.getByRole('button',{name:'Continue to Affordability Check →'}).click();
  await page.getByRole('button',{name:'Skip Income'}).click();
  await page.getByRole('button',{name:'Open My Lease →'}).click();
  await expect(page.locator('#rows tr')).toHaveCount(3);
  await expect(page.locator('#rows')).toContainText('Saved vehicle');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('vahanaiq_inputs_v1')))).toMatchObject({insurance:'120000',fees:'45000',dti:'0.5'});
 });
 });
}
