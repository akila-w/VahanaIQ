import { dateInputValue, attachDatePicker } from './date-picker.js?v=2.11.6';
import { formatDate } from './dates.js?v=2.11.6';
import { savingsPlan, addMonths } from './savings.js?v=2.11.6';
import { loadPlanner, savePlanner } from './planner-store.js?v=2.11.6';
import { fmt, esc } from './calculator.js?v=2.11.6';
import { DOWN_MIN, DOWN_MIN_UNREG, DOWN_MAX, MAX_SAVED_GOALS } from './constants.js?v=2.11.6';
import { attachMoneyInput, parseMoneyText } from './money-input.js?v=2.11.6';
import { showToast } from './toast.js?v=2.11.6';

function fmtM(n) {
  if (!Number.isFinite(n) || n <= 0) return '0.00';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toFixed(0);
}

function buildSavingsTrajectorySvg(r, savedAmount, date, targetDateStr = '') {
  const months = (r.months && r.months > 0 && r.months <= 120)
    ? r.months
    : (r.targetMonths && r.targetMonths > 0 && r.targetMonths <= 120)
      ? r.targetMonths
      : null;
  if (!months || months <= 0 || months > 120) return '';
  const target = r.target;
  const isTargetTrajectory = (!r.months || r.monthly <= 0) && r.targetMonths > 0;
  const monthly = isTargetTrajectory ? (r.required || 0) : r.monthly;
  const deposit = r.deposit;
  const effectiveDate = date || (targetDateStr ? targetDateStr : '');

  const xStart = 62, xEnd = 650, chartW = xEnd - xStart;
  const yBase = 155, yTop = 25, chartH = yBase - yTop;

  const getX = m => (xStart + (m / months) * chartW).toFixed(1);
  const getY = val => (yBase - (Math.min(target, Math.max(0, val)) / target) * chartH).toFixed(1);

  const sampleMonths = new Set([0, months]);
  const step = months <= 12 ? 1 : months <= 24 ? 2 : months <= 48 ? 4 : 6;
  for (let m = step; m < months; m += step) sampleMonths.add(m);

  let depMonth = null;
  if (savedAmount < deposit && deposit < target && monthly > 0) {
    depMonth = Math.ceil((deposit - savedAmount) / monthly);
    if (depMonth > 0 && depMonth < months) sampleMonths.add(depMonth);
  }

  if (r.targetMonths && r.targetMonths > 0 && r.targetMonths < months) {
    sampleMonths.add(r.targetMonths);
  }

  const sortedMonths = Array.from(sampleMonths).sort((a, b) => a - b);
  const pts = [];
  let markersHtml = '';

  sortedMonths.forEach(m => {
    const val = Math.min(target, savedAmount + m * monthly);
    const x = getX(m);
    const y = getY(val);
    pts.push(`${x},${y}`);

    if (m === 0) {
      markersHtml += `<circle cx="${x}" cy="${y}" r="4.5" class="trajectory-marker marker-start"><title>Today (Month 0): LKR ${fmt(savedAmount)} (${r.progress.toFixed(1)}% of target)</title></circle>`;
    } else if (m === depMonth) {
      markersHtml += `<circle cx="${x}" cy="${y}" r="5.5" class="trajectory-marker marker-cbsl"><title>Month ${m}: CBSL Statutory Deposit Met (LKR ${fmt(deposit)})</title></circle>`;
    } else if (m === r.targetMonths && r.targetMonths !== months) {
      markersHtml += `<circle cx="${x}" cy="${y}" r="4.5" class="trajectory-marker marker-targetdate"><title>Target Date (Month ${m}): Projected LKR ${fmt(val)}</title></circle>`;
    } else if (m === months) {
      markersHtml += `<circle cx="${x}" cy="${y}" r="6" class="trajectory-marker marker-goal"><title>Month ${m}${effectiveDate ? ' (' + esc(effectiveDate) + ')' : ''}: Target Reached LKR ${fmt(target)}</title></circle>`;
    } else {
      markersHtml += `<circle cx="${x}" cy="${y}" r="3.5" class="trajectory-marker"><title>Month ${m}: LKR ${fmt(val)} (${((val / target) * 100).toFixed(1)}%)</title></circle>`;
    }
  });

  const areaPts = `${xStart},${yBase} ${pts.join(' ')} ${xEnd},${yBase}`;

  let xLabelsHtml = `<text x="${xStart}" y="174" class="trajectory-axis-label" text-anchor="middle">Today</text>`;
  if (months >= 12) {
    const midM = Math.round(months / 2);
    xLabelsHtml += `<text x="${getX(midM)}" y="174" class="trajectory-axis-label" text-anchor="middle">${midM}m</text>`;
  }
  xLabelsHtml += `<text x="${xEnd}" y="174" class="trajectory-axis-label" text-anchor="middle">${months} mos</text>`;

  return `
    <div class="planner-trajectory-card">
      <div class="planner-trajectory-head">
        <div class="planner-trajectory-title-wrap">
          <span class="glyph glyph-chart-no-axes-combined" aria-hidden="true"></span>
          <span class="planner-trajectory-title">Savings Horizon &amp; Trajectory</span>
        </div>
        <div class="planner-trajectory-legend">
          <span class="trajectory-legend-item"><span class="legend-swatch swatch-accum"></span> ${isTargetTrajectory ? 'Target Pace Projection' : 'Cumulative Savings'}</span>
          <span class="trajectory-legend-item"><span class="legend-swatch swatch-target"></span> Target Upfront (LKR ${fmtM(target)})</span>
          ${depMonth ? '<span class="trajectory-legend-item"><span class="legend-swatch swatch-deposit"></span> CBSL Deposit Met</span>' : ''}
        </div>
      </div>
      <div class="planner-trajectory-box">
        <svg class="planner-trajectory-svg" viewBox="0 0 680 185" aria-hidden="true">
          <line x1="${xStart}" y1="${yTop}" x2="${xEnd}" y2="${yTop}" class="trajectory-ceiling-line" />
          <line x1="${xStart}" y1="${(yTop + yBase) / 2}" x2="${xEnd}" y2="${(yTop + yBase) / 2}" class="trajectory-grid-line" />
          <line x1="${xStart}" y1="${yBase}" x2="${xEnd}" y2="${yBase}" class="trajectory-axis-base" />

          <polygon points="${areaPts}" class="trajectory-area" />
          <polyline points="${pts.join(' ')}" class="trajectory-line" />

          <g>${markersHtml}</g>
          <g>${xLabelsHtml}</g>

          <text x="54" y="${yTop + 4}" class="trajectory-axis-label" text-anchor="end">LKR ${fmtM(target)}</text>
          <text x="54" y="${((yTop + yBase) / 2) + 4}" class="trajectory-axis-label" text-anchor="end">50%</text>
          <text x="54" y="${yBase + 4}" class="trajectory-axis-label" text-anchor="end">LKR 0</text>
        </svg>
      </div>
    </div>
  `;
}

function buildFundedCard(r, savedAmount) {
  return `
    <div class="planner-funded-card">
      <div class="planner-funded-icon"><span class="glyph glyph-circle-check" aria-hidden="true"></span></div>
      <div class="planner-funded-body">
        <strong>Goal 100% Funded &amp; Ready</strong>
        <p>Your current savings of LKR ${fmt(savedAmount)} fully cover the required cash deposit (LKR ${fmt(r.deposit)}) and all upfront fees.</p>
      </div>
    </div>
  `;
}

export function initPlanner({ vehicles, settings }) {
  const $ = id => document.getElementById(id);
  if (!$('plannerVehicle')) return () => {};
  let store = loadPlanner(), signature = '', restoring = false;
  let generation = 0;
  const fields = ['plannerVehicle','plannerGoal','plannerSaved','plannerMode','plannerPercent','plannerMonthly','plannerDate'];
  const defaults = { plannerGoal: 'deposit', plannerSaved: '', plannerMode: 'percent', plannerPercent: '20', plannerMonthly: '', plannerDate: '' };
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
    const vehicleBadgeEl = $('plannerVehicleBadge');
    if (vehicleBadgeEl) {
      if (v) {
        vehicleBadgeEl.hidden = false;
        const isUsed = v.cond === 'Used';
        vehicleBadgeEl.innerHTML = `<span class="cbsl-statutory-badge ${isUsed ? 'mid' : 'ok'}"><span class="glyph glyph-badge-check" aria-hidden="true"></span> ${esc(v.cond || 'Vehicle')} · ${isUsed ? `Eligible for CBSL ${DOWN_MIN}% Minimum Deposit` : `CBSL ${DOWN_MIN_UNREG}% Statutory Floor Required`}</span>`;
      } else {
        vehicleBadgeEl.hidden = true;
        vehicleBadgeEl.innerHTML = '';
      }
    }
    const percentEl = $('plannerPercent');
    if (percentEl && typeof document.querySelectorAll === 'function') {
      const curPct = Math.round(Number(percentEl.value));
      document.querySelectorAll('button[data-preset-for="plannerPercent"]').forEach(chip => {
        const chipVal = Number(chip.dataset?.presetVal ?? chip.getAttribute?.('data-preset-val'));
        const active = curPct === chipVal;
        chip.classList?.toggle('active', active);
        chip.setAttribute?.('aria-pressed', String(active));
      });
    }
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
      insurance: s.insurance || 0, saved: parseMoneyText($('plannerSaved').value) || 0, income: s.income || 0, debt: s.debt || 0, mode,
      contribution: mode === 'percent' ? Number($('plannerPercent').value) : parseMoneyText($('plannerMonthly').value), targetDate: dateInputValue($('plannerDate').value) });
    $('plannerDate').setAttribute('aria-invalid',String(!!r.targetError));
    if (r.targetError) $('plannerSave').disabled=true;
    if (r.error) { $('plannerSave').disabled = true; $('plannerResult').innerHTML = `<p class="bad">${esc(r.error)}</p>`; return; }
    const targetDateVal = dateInputValue($('plannerDate').value);
    const targetDateStr = targetDateVal && /^\d{4}-\d{2}-\d{2}$/.test(targetDateVal) ? formatDate(targetDateVal) : '';
    const date = r.date ? formatDate([r.date.getFullYear(),String(r.date.getMonth()+1).padStart(2,'0'),String(r.date.getDate()).padStart(2,'0')].join('-')) : targetDateStr;
    const end = r.months === 0 ? 'Your goal is funded' : r.months === null ? (r.targetMonths ? `${r.targetMonths} ${r.targetMonths === 1 ? 'month' : 'months'} to target date` : 'Set a monthly contribution') : r.months > 1200 ? 'Over 100 years at this contribution' : `${r.months} ${r.months === 1 ? 'month' : 'months'} to your goal`;
    const savedAmount = parseMoneyText($('plannerSaved').value) || 0;

    const depPct = r.target > 0 ? (r.deposit / r.target * 100).toFixed(1) : '100.0';
    const feePct = r.target > 0 ? (((r.fees || 0) + (r.insurance || 0)) / r.target * 100).toFixed(1) : '0.0';
    const cbslBadgeClass = r.downPct === DOWN_MIN ? 'mid' : 'ok';
    const cbslBadgeText = r.downPct === DOWN_MAX ? '100% Cash Purchase' : r.downPct === DOWN_MIN ? 'CBSL Compliant (>1yr Reg Only)' : 'CBSL Compliant (' + r.downPct + '% Down)';

    let targetCardHtml = '';
    if (r.required !== null) {
      const onTrack = r.monthly >= r.required;
      const cardClass = onTrack ? 'on-track' : 'pace-needed';
      const badgeClass = onTrack ? 'ok' : 'mid';
      const badgeText = onTrack ? 'On Track' : `Pace Gap: LKR ${fmt(r.required - r.monthly)} / mo`;
      const noteClass = onTrack ? 'ok' : 'mid';
      const noteText = onTrack
        ? `Your planned savings of LKR ${fmt(r.monthly)}/mo will reach this target on time.`
        : `Increase monthly saving by LKR ${fmt(r.required - r.monthly)} to meet your target date.`;

      targetCardHtml = `<div class="planner-target-card ${cardClass}"><div class="planner-target-top"><span class="glyph glyph-calendar" aria-hidden="true"></span><strong>Pace Needed for Target Date</strong><span class="tag ${badgeClass}">${badgeText}</span></div><div class="planner-target-body"><div class="planner-target-stat"><span>Required contribution:</span><strong>LKR ${fmt(r.required)} / month</strong>${r.requiredPercent !== null ? `<span class="planner-target-pct">(${r.requiredPercent.toFixed(1)}% of income)</span>` : ''}</div><div class="planner-target-note ${noteClass}">${noteText}</div></div></div>`;
    }

    const visualTrajectoryHtml = r.months === 0 ? buildFundedCard(r, savedAmount) : buildSavingsTrajectorySvg(r, savedAmount, date, targetDateStr);

    $('plannerResult').innerHTML = `<div class="planner-hero"><div class="planner-hero-icon"><span class="glyph glyph-target" aria-hidden="true"></span></div><div class="planner-hero-content"><div class="planner-hero-title">${esc(end)}</div><div class="planner-hero-sub">${r.months && date ? 'Estimated completion: '+esc(date) : (r.targetMonths && targetDateStr ? 'Target date: ' + esc(targetDateStr) + ' · Required: LKR ' + fmt(r.required) + ' / mo' : 'No investment growth or future price changes assumed')}</div></div>${r.months !== null && r.months <= 12 ? '<span class="tag ok">Fast Track</span>' : ''}</div><div class="planner-progress-card"><div class="planner-progress-header"><span class="planner-progress-label">Savings Progress</span><span class="planner-progress-pct">${r.progress.toFixed(1)}%</span></div><div class="planner-progress-track"><div class="planner-progress-fill" style="width:${r.progress.toFixed(1)}%"></div></div><div class="planner-progress-sub"><span>LKR ${fmt(savedAmount)} saved</span><span>LKR ${fmt(r.remaining)} remaining</span></div><label class="sr-only" for="savingsProgress">Savings progress</label><progress id="savingsProgress" class="sr-only" max="100" value="${r.progress}">${r.progress.toFixed(1)}%</progress></div><div class="planner-metrics"><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">Target Upfront</span><span class="glyph glyph-wallet" aria-hidden="true"></span></div><div class="telemetry-card-val">LKR ${fmt(r.target)}</div><div class="telemetry-card-sub"><span>Deposit + fees</span></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">Already Saved</span><span class="glyph glyph-circle-check" aria-hidden="true"></span></div><div class="telemetry-card-val">LKR ${fmt(savedAmount)}</div><div class="telemetry-card-sub"><span>${r.progress.toFixed(1)}% of target</span></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">Still to Save</span><span class="glyph glyph-piggy-bank" aria-hidden="true"></span></div><div class="telemetry-card-val val-rental">LKR ${fmt(r.remaining)}</div><div class="telemetry-card-sub"><span>Cash gap needed</span></div></div><div class="telemetry-card highlight"><div class="telemetry-card-top"><span class="telemetry-card-title">Monthly Saving</span><span class="glyph glyph-chart-no-axes-combined" aria-hidden="true"></span></div><div class="telemetry-card-val">LKR ${fmt(r.monthly)}</div><div class="telemetry-card-sub"><span>${r.percent !== null ? r.percent.toFixed(1) + '% of income' : 'Fixed contribution'}</span></div></div></div>${visualTrajectoryHtml}<div class="planner-breakdown-card"><div class="planner-breakdown-header"><span class="planner-breakdown-title">Upfront Cost Composition</span><span class="tag ${cbslBadgeClass}">${cbslBadgeText}</span></div><div class="planner-cost-split-bar" role="progressbar" aria-label="Upfront cost composition"><div class="cost-split-seg seg-deposit" style="width:${depPct}%" title="Statutory Deposit: LKR ${fmt(r.deposit)} (${depPct}%)"></div><div class="cost-split-seg seg-fees" style="width:${feePct}%" title="Fees &amp; Insurance: LKR ${fmt(r.fees+r.insurance)} (${feePct}%)"></div></div><div class="planner-cost-split-legend"><span class="split-legend-item"><span class="legend-swatch swatch-deposit"></span> Statutory Deposit: ${depPct}%</span><span class="split-legend-item"><span class="legend-swatch swatch-fees"></span> Fees &amp; Insurance: ${feePct}%</span></div><dl class="planner-breakdown"><div><dt>${r.downPct===100?'Cash price':'Statutory cash deposit ('+r.downPct+'%)'}</dt><dd>LKR ${fmt(r.deposit)}</dd></div><div><dt>Fees &amp; first-year comprehensive insurance</dt><dd>LKR ${fmt(r.fees+r.insurance)}</dd></div></dl></div>${targetCardHtml}${r.percent !== null ? `<p class="hint planner-insight-hint">${r.percent.toFixed(1)}% of net income saved each month${r.fitsKnownCommitments ? ' · fits income after entered loan payments, before living costs' : ''}.</p>` : '<p class="hint planner-insight-hint">Enter income above to see the percentage saved.</p>'}${r.fitsKnownCommitments === false ? '<p class="bad planner-warn-box">This contribution exceeds income after your existing loan payments.</p>' : ''}${r.targetError ? `<p class="bad planner-warn-box">${esc(r.targetError)}</p>` : ''}<p class="hint planner-disclaimer">${['published','starting','user-entered','seller-listed'].includes(v.priceBasis)?'Using the selected price; confirm it before purchase.':'This vehicle has an unverified estimate. Enter a seller quote before relying on this goal.'} A saved deposit does not guarantee lease approval. Projections assume monthly contributions, no investment growth, and no vehicle price changes.</p>`;
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
    if (store.scenarios.length>=MAX_SAVED_GOALS) { showToast(`You can save up to ${MAX_SAVED_GOALS} goals. Remove one to make room.`); return; }
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
