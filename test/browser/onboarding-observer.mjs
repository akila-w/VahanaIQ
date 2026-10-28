// Opt-in diagnostic observer; no application hooks or synthetic interactions.
export function observeOnboarding() {
  const historyKey = '__task032_observation';
  const data = window.__onboardingObservation = { history: JSON.parse(sessionStorage.getItem(historyKey) || '[]'), samples: [], events: [] };
  window.addEventListener('pagehide', () => sessionStorage.setItem(historyKey, JSON.stringify([...data.history, { samples:data.samples, events:data.events }])));
  const ids = new WeakMap(); let nextId = 0, lastSample = -100;
  const id = el => { if (!el) return null; if (!ids.has(el)) ids.set(el, ++nextId); return ids.get(el); };
  const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height }; };
  const label = el => el?.id || el?.className || el?.nodeName;
  const event = (type, extra = {}) => { if(data.events.length < 3000)data.events.push({ t:performance.now(),type,...extra }); };
  for(const type of ['scroll','focusin','focusout','visibilitychange','animationstart','animationend','transitionrun','transitionend','click'])document.addEventListener(type,e=>{
    if(e.target?.closest?.('#onboarding') || type==='visibilitychange')event(type,{target:label(e.target),trusted:e.isTrusted,scrollTop:e.target.scrollTop,animation:e.animationName,property:e.propertyName});
  },true);
  for(const type of ['load','error'])document.addEventListener(type,e=>{if(e.target?.matches?.('.onboarding-car img'))event('image-'+type,{src:e.target.currentSrc,rect:rect(e.target),complete:e.target.complete,naturalWidth:e.target.naturalWidth});},true);
  new MutationObserver(records=>{for(const r of records){if(r.target?.closest?.('.onboarding-cars,.onboarding-tray'))event('mutation',{target:label(r.target),id:id(r.target),added:r.addedNodes.length,removed:r.removedNodes.length,attribute:r.attributeName});}}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
  function sample(t) {
    const body=document.querySelector('.onboarding-body');
    if(body && t-lastSample>=40 && data.samples.length<3000){
      lastSample=t;
      const search=document.querySelector('.onboarding-search');
      const cards=[...document.querySelectorAll('.onboarding-car')];
      const buttons=cards.flatMap(card=>[...card.querySelectorAll('button')].filter(b=>b.textContent.includes('Add to Shortlist')).map(button=>({id:id(button),name:card.querySelector('h3')?.textContent,rect:rect(button),disabled:button.disabled,hit:(()=>{const r=button.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===button;})(),images:[...card.querySelectorAll('img')].map(img=>({rect:rect(img),complete:img.complete,naturalWidth:img.naturalWidth}))})));
      data.samples.push({t,query:search?.value,body:{rect:rect(body),scrollTop:body.scrollTop,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight,scrollBehavior:getComputedStyle(body).scrollBehavior,transform:getComputedStyle(body).transform},dialog:rect(document.querySelector('#onboarding')),documentScroll:document.scrollingElement.scrollTop,focus:label(document.activeElement),buttons,animations:document.getAnimations().map(a=>({name:a.animationName,state:a.playState,time:a.currentTime,target:label(a.effect?.target)}))});
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}
