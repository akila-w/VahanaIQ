import { dateInputValue, attachDatePicker } from './date-picker.js?v=2.11.3';
import { formatDate } from './dates.js?v=2.11.3';
import { savingsPlan } from './savings.js?v=2.11.3';
import { loadPlanner, savePlanner } from './planner-store.js?v=2.11.3';
import { fmt, esc } from './calculator.js?v=2.11.3';
import { attachMoneyInput, parseMoneyText } from './money-input.js?v=2.11.3';
import { showToast } from './toast.js?v=2.11.3';

export function initPlanner({ vehicles, settings }) {
  const $ = id => document.getElementById(id);
  if (!$('plannerVehicle')) return () => {};
  let store = loadPlanner(), signature = '', restoring = false;
  let generation = 0;
  const fields = ['plannerVehicle','plannerGoal','plannerSaved','plannerMode','plannerPercent','plannerMonthly','plannerDate'];
  const defaults = { plannerGoal: 'deposit', plannerSaved: '0.00', plannerMode: 'percent', plannerPercent: '20', plannerMonthly: '', plannerDate: '' };
  const read = () => Object.fromEntries(fields.map(id => [id, id==='plannerDate'?dateInputValue($(id).value):$(id).value]));
  function restore() { restoring = true; for (const id of fields) if (id !== 'plannerVehicle') $(id).value = store.draft[id] ?? defaults[id] ?? ''; if ($('plannerDate').value && formatDate($('plannerDate').value)!=='Date unavailable') $('plannerDate').value=formatDate($('plannerDate').value,{numeric:true}); restoring = false; }
  function options() {
    const list = vehicles().filter(v => v.price > 0 && v.priceBasis !== 'conflicting'), sig = JSON.stringify(list.map(v => [v.id,v.name,v.price]));
    if (sig !== signature) {
      const selected = $('plannerVehicle').value || store.draft.plannerVehicle || '';
      $('plannerVehicle').innerHTML = '<option value="">Choose a Vehicle</option>' + list.map(v => `<option value="${esc(v.id)}">${esc(v.name)} · LKR ${fmt(v.price)}${['published','starting','user-entered','seller-listed'].includes(v.priceBasis)?'':' · unverified'}</option>`).join('');
      $('plannerVehicle').value = selected; signature = sig;
    }
    const selectedScenario = $('plannerScenarios').value;
    $('plannerScenarios').innerHTML = '<option value="">Saved Goals</option>' + store.scenarios.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    $('plannerScenarios').value = selectedScenario;
    return list;
  }
  function render() {
    const list = options(), v = list.find(v => v.id === $('plannerVehicle').value), s = settings();
    const mode = $('plannerMode').value;
    $('plannerPercentWrap').hidden = mode !== 'percent'; $('plannerMonthlyWrap').hidden = mode !== 'fixed';
    $('plannerSave').disabled = !v;
    if (!v) { $('plannerResult').innerHTML = '<p class="hint">Choose a Vehicle to see your savings journey.</p>'; return; }
    const r = savingsPlan({ price: v.price, condition: v.cond, financeClass: v.financeClass, firstRegisteredOn: v.firstRegisteredOn, down: s.down, cash: $('plannerGoal').value === 'cash', fees: s.fees || 0,
      insurance: s.insurance || 0, saved: parseMoneyText($('plannerSaved').value), income: s.income || 0, debt: s.debt || 0, mode,
      contribution: mode === 'percent' ? Number($('plannerPercent').value) : parseMoneyText($('plannerMonthly').value), targetDate: dateInputValue($('plannerDate').value) });
    $('plannerDate').setAttribute('aria-invalid',String(!!r.targetError));
    if (r.targetError) $('plannerSave').disabled=true;
    if (r.error) { $('plannerSave').disabled = true; $('plannerResult').innerHTML = `<p class="bad">${esc(r.error)}</p>`; return; }
    const date = r.date ? formatDate([r.date.getFullYear(),String(r.date.getMonth()+1).padStart(2,'0'),String(r.date.getDate()).padStart(2,'0')].join('-')) : '';
    const end = r.months === 0 ? 'Your goal is funded' : r.months === null ? 'Set a monthly contribution' : r.months > 1200 ? 'Over 100 years at this contribution' : `${r.months} ${r.months === 1 ? 'month' : 'months'} to your goal`;
    $('plannerResult').innerHTML = `<div class="planner-hero"><span class="glyph glyph-target" aria-hidden="true"></span><div><strong>${end}</strong><span>${r.months && date ? 'Estimated '+date : 'No investment growth or future price changes assumed'}</span></div></div><label class="sr-only" for="savingsProgress">Savings progress</label><progress id="savingsProgress" max="100" value="${r.progress}">${r.progress.toFixed(1)}%</progress><div class="planner-metrics"><div><span>Target upfront</span><strong>LKR ${fmt(r.target)}</strong></div><div><span>Still to save</span><strong>LKR ${fmt(r.remaining)}</strong></div><div><span>Monthly saving</span><strong>LKR ${fmt(r.monthly)}</strong></div></div><dl class="planner-breakdown"><div><dt>${r.downPct===100?'Cash price':'Deposit ('+r.downPct+'%)'}</dt><dd>LKR ${fmt(r.deposit)}</dd></div><div><dt>Fees + first-year insurance entered above</dt><dd>LKR ${fmt(r.fees+r.insurance)}</dd></div></dl>${r.percent!==null?`<p class="hint">${r.percent.toFixed(1)}% of net income saved each month${r.fitsKnownCommitments?' · fits income after entered loan payments, before living costs':''}.</p>`:'<p class="hint">Enter income above to see the percentage saved.</p>'}${r.fitsKnownCommitments===false?'<p class="bad">This contribution exceeds income after your existing loan payments.</p>':''}${r.targetError?`<p class="bad">${esc(r.targetError)}</p>`:''}${r.required!==null?`<div class="planner-target"><span class="glyph glyph-calendar" aria-hidden="true"></span><p>For your target date: <strong>LKR ${fmt(r.required)} per month</strong>${r.requiredPercent!==null?' ('+r.requiredPercent.toFixed(1)+'% of income)':''}.</p></div>`:''}<p class="hint">${['published','starting','user-entered','seller-listed'].includes(v.priceBasis)?'Using the selected price; confirm it before purchase.':'This vehicle has an unverified estimate. Enter a seller quote before relying on this goal.'} A saved deposit does not guarantee lease approval. These projections assume monthly contributions, no investment growth and no future price changes; current inputs recalculate saved goals.</p>`;
  }
  function changed() { if (restoring) return; store.draft=read(); savePlanner(store); render(); }
  attachDatePicker($('plannerDate'),$('plannerCalendar'));
  restore(); options(); $('plannerVehicle').value=store.draft.plannerVehicle||'';
  for (const id of fields) $(id).addEventListener('input',changed);
  for (const id of ['plannerSaved','plannerMonthly']) attachMoneyInput($(id));
  $('plannerSave').addEventListener('click',()=>{
    if ($('plannerSave').disabled || !$('plannerVehicle').value) { showToast('Choose a Vehicle before saving a goal.'); return; }
    const name=$('plannerName').value.trim()||'My savings goal';
    if (store.scenarios.length>=30) { showToast('You can save up to 30 goals. Remove one to make room.'); return; }
    store.scenarios.push({ id:'goal-'+Date.now().toString(36), name, draft:read(), savedOn:new Date().toISOString().slice(0,10) });
    savePlanner(store); options(); showToast('Savings goal saved.');
  });
  $('plannerScenarios').addEventListener('change',()=>{
    const goal=store.scenarios.find(s=>s.id===$('plannerScenarios').value); if(!goal)return;
    store.draft={...goal.draft}; restore(); options(); $('plannerVehicle').value=store.draft.plannerVehicle||''; savePlanner(store); render();
  });
  $('plannerDelete').addEventListener('click',()=>{
    const id=$('plannerScenarios').value;if(!id)return;
    const token=generation;
    const before=store.scenarios;store.scenarios=before.filter(s=>s.id!==id);savePlanner(store);options();
    showToast('Saved goal removed.','Undo',()=>{if(token!==generation)return;store.scenarios=before;savePlanner(store);options();});
  });
  window.addEventListener('vahanaiq:planner-reload',()=>{generation++;store=loadPlanner();signature='';restore();options();$('plannerVehicle').value=store.draft.plannerVehicle||'';render();});
  render(); return render;
}
