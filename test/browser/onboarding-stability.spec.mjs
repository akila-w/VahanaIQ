// Focused diagnostic experiments. The standard suite keeps its original assertions.
import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {observeOnboarding} from './onboarding-observer.mjs';
const base=process.env.BASE_URL||'http://127.0.0.1:8123';
const mode=process.env.ONBOARDING_INTERACTION||'explicit';
test.use({trace:'on',screenshot:'only-on-failure',reducedMotion:process.env.ONBOARDING_MOTION||'no-preference'});
test.beforeEach(async({page})=>{
 if(process.env.ONBOARDING_OBSERVE==='1')await page.addInitScript(observeOnboarding);
 await page.addInitScript(()=>{
  if(localStorage.getItem('vahanaiq_comparison_v3'))return;
  localStorage.setItem('vahanaiq_comparison_v3',JSON.stringify({version:3,cars:[{id:'saved-car',name:'Saved vehicle',price:9000000,cond:'New'}]}));
  localStorage.setItem('vahanaiq_inputs_v1',JSON.stringify({insurance:'120000',fees:'45000',dti:'0.5'}));
 });
});
test.afterEach(async({page},info)=>{
 if(process.env.ONBOARDING_OBSERVE==='1')await writeFile(info.outputPath('onboarding-observation.json'),JSON.stringify(await page.evaluate(()=>window.__onboardingObservation).catch(e=>({error:String(e)}))));
});
// Generated cases share the worker's browser process; repeat-each starts a new
// repeat-index worker and therefore cannot exercise the same long-lived state.
for(let i=0;i<Number(process.env.ONBOARDING_CASES||24);i++)for(const route of ['catalogue','studio']){
 test(`${mode} ${route} long-lived case ${i}`,async({page})=>{
  if(process.env.ONBOARDING_WIDTH)await page.setViewportSize({width:Number(process.env.ONBOARDING_WIDTH),height:844});
  await page.goto(`${base}/${route}.html?onboarding=1`);
  await page.getByRole('button',{name:'Start Guided Setup (Takes 2 min) →',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'Search vehicles',exact:true});
  for(const [index,name]of ['Toyota Aqua','Toyota Camry Hybrid'].entries()){
   await search.fill(name);
   const card=page.locator('.onboarding-car').filter({has:page.getByRole('heading',{name,exact:true})});
   const add=card.getByRole('button',{name:'+ Add to Shortlist',exact:true});
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
   } else if(mode!=='click') {await add.scrollIntoViewIfNeeded();await expect(add).toBeInViewport();}
   await add.click();
   await expect(card.locator('.onboarding-car-btn')).toBeInViewport();
   await expect(page.locator('.onboarding-tray')).toContainText(`${index+1} of 12 selected`);
  }
  await page.getByRole('button',{name:'Continue to Loan Terms →'}).click();
  await page.getByRole('button',{name:'Continue to Affordability Check →'}).click();
  await page.getByRole('button',{name:'Skip Income'}).click();
  await page.getByRole('button',{name:'Open My Lease →'}).click();
  await expect(page.locator('#rows tr')).toHaveCount(3);
  await expect(page.locator('#rows')).toContainText('Saved vehicle');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('vahanaiq_inputs_v1')))).toMatchObject({insurance:'120000',fees:'45000',dti:'0.5'});
 });
}
