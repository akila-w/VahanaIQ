import { dateInputValue, attachDatePicker } from './date-picker.js?v=2.11.5';
import { formatDate } from './dates.js?v=2.11.5';
import { savingsPlan, addMonths } from './savings.js?v=2.11.5';
import { loadPlanner, savePlanner } from './planner-store.js?v=2.11.5';
import { fmt, esc } from './calculator.js?v=2.11.5';
import { attachMoneyInput, parseMoneyText } from './money-input.js?v=2.11.5';
import { showToast } from './toast.js?v=2.11.5';

export function initPlanner({ vehicles, settings }) {
  const $ = id => document.getElementById(id);
  if (!$('plannerVehicle')) return () => {};
  let store = loadPlanner(), signature = '', restoring = false;
  let generation = 0;
  const fields = ['plannerVehicle','plannerGoal','plannerSaved','plannerMode','plannerPercent','plannerMonthly','plannerDate'];
  const defaults = { plannerGoal: 'deposit', plannerSaved: '0.00', plannerMode: 'percent', plannerPercent: '20', plannerMonthly: '', plannerDate: '' };
  const read = () => Object.fromEntries(fields.map(id => [id, id==='plannerDate'?dateInputValue($(id).value):$(id).value]));
  function restore() {
    restoring = true;
    for (const id of fields) if (id !== 'plannerVehicle') $(id).value = store.draft[id] ?? defaults[id] ?? '';
    const rawDate = dateInputValue($('plannerDate').value);
    if (rawDate) {
      const today = new Date(); today.setHours(12, 0, 0, 0);
      const minTarget = addMonths(today, 1);
      const end = new Date(rawDate + 'T12:00:00');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || formatDate(rawDate) === 'Date unavailable' || end < minTarget) {
        $('plannerDate').value = '';
        store.draft.plannerDate = '';
        savePlanner(store);
      } else {
        $('plannerDate').value = formatDate(rawDate, { numeric: true });
      }
    }
    restoring = false;
  }
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
    if (!v) {
      const targetDateVal = dateInputValue($('plannerDate').value);
      let dateWarn = '';
      if (targetDateVal) {
        const today = new Date(); today.setHours(12, 0, 0, 0);
        const minTarget = addMonths(today, 1);
        const end = new Date(targetDateVal + 'T12:00:00');
        const invalid = !/^\d{4}-\d{2}-\d{2}$/.test(targetDateVal) || formatDate(targetDateVal) === 'Date unavailable' || end < minTarget;
        $('plannerDate').setAttribute('aria-invalid', String(invalid));
        if (invalid) dateWarn = '<p class="bad planner-warn-box">Choose a target date at least one month from today.</p>';
      } else {
        $('plannerDate').removeAttribute('aria-invalid');
      }
      $('plannerResult').innerHTML = `${dateWarn}<div class="planner-empty-state"><div class="planner-empty-icon-wrap"><span class="glyph glyph-piggy-bank" aria-hidden="true"></span></div><h3>Map Your Savings Journey</h3><p class="planner-empty-lead">Select a vehicle from your comparison to calculate down payment targets, explore contribution timelines, and track required cash upfront.</p><div class="planner-empty-steps"><div class="planner-step-card"><div class="planner-step-num">1</div><div class="planner-step-info"><strong>Choose a Vehicle</strong><span>Pulls live pricing and CBSL statutory down payment rates.</span></div></div><div class="planner-step-card"><div class="planner-step-num">2</div><div class="planner-step-info"><strong>Set Savings Pace</strong><span>Allocate a percentage of net monthly income or a custom fixed sum.</span></div></div><div class="planner-step-card"><div class="planner-step-num">3</div><div class="planner-step-info"><strong>Track Milestones</strong><span>See completion months, deposit gaps, and target date feasibility.</span></div></div></div></div>`;
      return;
    }
    const r = savingsPlan({ price: v.price, condition: v.cond, financeClass: v.financeClass, firstRegisteredOn: v.firstRegisteredOn, down: s.down, cash: $('plannerGoal').value === 'cash', fees: s.fees || 0,
      insurance: s.insurance || 0, saved: parseMoneyText($('plannerSaved').value), income: s.income || 0, debt: s.debt || 0, mode,
      contribution: mode === 'percent' ? Number($('plannerPercent').value) : parseMoneyText($('plannerMonthly').value), targetDate: dateInputValue($('plannerDate').value) });
    $('plannerDate').setAttribute('aria-invalid',String(!!r.targetError));
    if (r.targetError) $('plannerSave').disabled=true;
    if (r.error) { $('plannerSave').disabled = true; $('plannerResult').innerHTML = `<p class="bad">${esc(r.error)}</p>`; return; }
    const date = r.date ? formatDate([r.date.getFullYear(),String(r.date.getMonth()+1).padStart(2,'0'),String(r.date.getDate()).padStart(2,'0')].join('-')) : '';
    const end = r.months === 0 ? 'Your goal is funded' : r.months === null ? 'Set a monthly contribution' : r.months > 1200 ? 'Over 100 years at this contribution' : `${r.months} ${r.months === 1 ? 'month' : 'months'} to your goal`;
    const savedAmount = parseMoneyText($('plannerSaved').value);
    $('plannerResult').innerHTML = `<div class="planner-hero"><div class="planner-hero-icon"><span class="glyph glyph-target" aria-hidden="true"></span></div><div class="planner-hero-content"><div class="planner-hero-title">${end}</div><div class="planner-hero-sub">${r.months && date ? 'Estimated completion: '+date : 'No investment growth or future price changes assumed'}</div></div>${r.months !== null && r.months <= 12 ? '<span class="tag ok">Fast Track</span>' : ''}</div><div class="planner-progress-card"><div class="planner-progress-header"><span class="planner-progress-label">Savings Progress</span><span class="planner-progress-pct">${r.progress.toFixed(1)}%</span></div><div class="planner-progress-track"><div class="planner-progress-fill" style="width:${r.progress.toFixed(1)}%"></div></div><div class="planner-progress-sub"><span>LKR ${fmt(savedAmount)} saved</span><span>LKR ${fmt(r.remaining)} remaining</span></div><label class="sr-only" for="savingsProgress">Savings progress</label><progress id="savingsProgress" class="sr-only" max="100" value="${r.progress}">${r.progress.toFixed(1)}%</progress></div><div class="planner-metrics"><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">Target Upfront</span><span class="glyph glyph-wallet" aria-hidden="true"></span></div><div class="telemetry-card-val">LKR ${fmt(r.target)}</div><div class="telemetry-card-sub"><span>Deposit + fees</span></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">Already Saved</span><span class="glyph glyph-circle-check" aria-hidden="true"></span></div><div class="telemetry-card-val">LKR ${fmt(savedAmount)}</div><div class="telemetry-card-sub"><span>${r.progress.toFixed(1)}% of target</span></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">Still to Save</span><span class="glyph glyph-piggy-bank" aria-hidden="true"></span></div><div class="telemetry-card-val val-rental">LKR ${fmt(r.remaining)}</div><div class="telemetry-card-sub"><span>Cash gap needed</span></div></div><div class="telemetry-card highlight"><div class="telemetry-card-top"><span class="telemetry-card-title">Monthly Saving</span><span class="glyph glyph-chart-no-axes-combined" aria-hidden="true"></span></div><div class="telemetry-card-val">LKR ${fmt(r.monthly)}</div><div class="telemetry-card-sub"><span>${r.percent !== null ? r.percent.toFixed(1) + '% of income' : 'Fixed contribution'}</span></div></div></div><div class="planner-breakdown-card"><div class="planner-breakdown-header"><span class="planner-breakdown-title">Upfront Cost Composition</span><span class="tag">${r.downPct===100 ? '100% Cash' : r.downPct+'% Down Payment'}</span></div><dl class="planner-breakdown"><div><dt>${r.downPct===100?'Cash price':'Statutory cash deposit ('+r.downPct+'%)'}</dt><dd>LKR ${fmt(r.deposit)}</dd></div><div><dt>Fees &amp; first-year comprehensive insurance</dt><dd>LKR ${fmt(r.fees+r.insurance)}</dd></div></dl></div>${r.required !== null ? `<div class="planner-target-card"><div class="planner-target-top"><span class="glyph glyph-calendar" aria-hidden="true"></span><strong>Pace Needed for Target Date</strong></div><div class="planner-target-body"><div class="planner-target-stat"><span>Required contribution:</span><strong>LKR ${fmt(r.required)} / month</strong>${r.requiredPercent !== null ? `<span class="planner-target-pct">(${r.requiredPercent.toFixed(1)}% of income)</span>` : ''}</div></div></div>` : ''}${r.percent !== null ? `<p class="hint planner-insight-hint">${r.percent.toFixed(1)}% of net income saved each month${r.fitsKnownCommitments ? ' · fits income after entered loan payments, before living costs' : ''}.</p>` : '<p class="hint planner-insight-hint">Enter income above to see the percentage saved.</p>'}${r.fitsKnownCommitments === false ? '<p class="bad planner-warn-box">This contribution exceeds income after your existing loan payments.</p>' : ''}${r.targetError ? `<p class="bad planner-warn-box">${esc(r.targetError)}</p>` : ''}<p class="hint planner-disclaimer">${['published','starting','user-entered','seller-listed'].includes(v.priceBasis)?'Using the selected price; confirm it before purchase.':'This vehicle has an unverified estimate. Enter a seller quote before relying on this goal.'} A saved deposit does not guarantee lease approval. Projections assume monthly contributions, no investment growth, and no vehicle price changes.</p>`;
  }
  function changed() { if (restoring) return; store.draft=read(); savePlanner(store); render(); }
  attachDatePicker($('plannerDate'),$('plannerCalendar'));
  restore(); options(); $('plannerVehicle').value=store.draft.plannerVehicle||'';
  for (const id of ['plannerSaved','plannerMonthly']) attachMoneyInput($(id));
  for (const id of fields) $(id).addEventListener('input',changed);
  for (const id of ['plannerSaved','plannerMonthly']) $(id).addEventListener('blur',changed);
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
