/* Display preferences are presentational; financial state is never changed. */
(() => {
 const root=document.documentElement;
 const buttons=[...document.querySelectorAll('[data-lease-view]')];
 const details=document.getElementById('leaseCustomSettings');
 const summary=document.getElementById('leaseModeSummary');
 if(!buttons.length||!details)return;
 const key='vahanaiq:lease-display:v1';
 const defaults={strategies:true,shortcuts:true,budgetViews:true,quickFilters:true,columns:true};
 const controls=[...details.querySelectorAll('[data-lease-option]')];
 let saved=null;
 try{saved=JSON.parse(localStorage.getItem(key));}catch{}
 const state={mode:['simple','detailed','custom'].includes(saved?.mode)?saved.mode:(matchMedia('(max-width:650px)').matches?'simple':'detailed'),options:{...defaults}};
 for(const k of Object.keys(defaults)) if(typeof saved?.options?.[k]==='boolean')state.options[k]=saved.options[k];
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{}};
 const apply=()=>{
  root.dataset.leaseView=state.mode;
  for(const [k,v] of Object.entries(state.options))root.dataset['lease'+k[0].toUpperCase()+k.slice(1)]=String(v);
  buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.leaseView===state.mode)));
  details.hidden=state.mode!=='custom';
  if(state.mode!=='custom')details.open=false;
  controls.forEach(c=>{c.checked=state.options[c.dataset.leaseOption];});
  summary.textContent=state.mode==='simple'?'Focused on the essentials. All financial inputs and warnings remain available.':state.mode==='detailed'?'Full finance controls and comparison options.':'Choose which optional tools to show below.';
 };
 buttons.forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.leaseView;apply();persist();}));
 controls.forEach(c=>c.addEventListener('change',()=>{state.options[c.dataset.leaseOption]=c.checked;apply();persist();}));
 document.getElementById('leaseResetCustom')?.addEventListener('click',()=>{state.options={...defaults};apply();persist();});
 apply();
})();
