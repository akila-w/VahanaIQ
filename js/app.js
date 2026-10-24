import { formatDate } from "./dates.js?v=2.11.5";
import { fmt, esc, num, computeLeaseTable, rental, yearlySchedule, rateLabel, CONDITIONS, minDownFor } from "./calculator.js?v=2.11.5";
import { baseVehicles } from "./catalog.js?v=2.11.5";
import { initCatalogue } from "./catalogue-browser.js?v=2.11.5";
import { APP_VERSION } from "./config.js?v=2.11.5";
import { normalizeImageToStudio } from "./canvas-utils.js?v=2.11.5";
import { searchVehicle } from "./gemini.js?v=2.11.5";
import { fetchVehicleStudioImage, NO_PHOTO } from "./image-fetcher.js?v=2.11.5";
import { clearLegacyKeys, loadSavedCars, saveCars, newVehicleId } from "./storage.js?v=2.11.5";
import { openModal, closeModal, isOpen } from "./modal.js?v=2.11.5";
import { FIELDS, readSettings, fieldError, snapField, clearSnapNote, loadState, saveState, clearState, sharedCarsFromUrl, cleanUrl, buildShareLink } from "./inputs.js?v=2.11.5";
import { baseVehicles as marketCatalogue } from "./market-catalogue.js?v=2.11.5";
import { showToast, clearToast } from "./toast.js?v=2.11.5";
import { initAccount } from "./account.js?v=2.11.5";
import { attachMoneyInput, formatMoneyText } from "./money-input.js?v=2.11.5";
import { validPrice, vehicleBatchError, conditionPrice } from "./vehicle-validation.js?v=2.11.5";
import { creditFor, photoForModel, formatCreditHtml, PHOTO_CREDITS } from "./photo-credits.js?v=2.11.5";
import { initPlanner } from "./planner.js?v=2.11.5";

clearLegacyKeys();

const $ = id => document.getElementById(id);

let invalidSavedCount = 0;
let cars = loadSavedCars(baseVehicles, count => { invalidSavedCount = count; });
let sortKey = "price", sortDir = -1;
let currentAiData = null;
let currentAiImgSrc = "";
let pendingAdImage = null;
let currentDiscoveredVehicles = [];
let refreshCatalogue = () => {};
let refreshPlanner = () => {};
let comparisonLimit = 24;
let copyGeneration = 0;
function normaliseCurrentImage(src, callback) {
  const token = copyGeneration;
  normalizeImageToStudio(src, image => { if (token === copyGeneration) callback(image); });
}

export function formatVehicleTitle(modelName, trimName, year) {
  let m = (modelName || "").trim();
  let t = (trimName || "").trim();
  const y = String(year || "").trim();

  // Strip existing (YYYY) or standalone 4-digit year from modelName and trimName
  m = m.replace(/\s*\(\d{4}\)/g, "").replace(/\b(19|20)\d{2}\b/g, "").trim();
  t = t.replace(/\s*\(\d{4}\)/g, "").replace(/\b(19|20)\d{2}\b/g, "").trim();

  // If trimName starts with modelName (or parts of it), strip redundant prefix
  if (t && m) {
    const mLower = m.toLowerCase();
    const tLower = t.toLowerCase();
    if (tLower.startsWith(mLower)) {
      t = t.slice(m.length).trim();
    } else {
      const words = m.split(/\s+/);
      if (words.length > 1) {
        const withoutMake = words.slice(1).join(" ").toLowerCase();
        if (tLower.startsWith(withoutMake)) {
          t = t.slice(withoutMake.length).trim();
        }
      }
    }
  }

  // If trim is empty or "Standard" / "Standard Trim" or equals model
  if (!t || /^standard(\s+trim)?$/i.test(t) || t.toLowerCase() === m.toLowerCase()) {
    return y ? `${m} (${y})` : m;
  }

  return y ? `${m} ${t} (${y})` : `${m} ${t}`;
}

const cols = [
  ["name", "Vehicle"],
  ["price", "Price", "n"],
  ["dp", "Down Payment", "n"],
  ["rental", "Monthly Rental", "n"],
  ["bar", "Share of Your Budget"],
  ["interest", "Total Interest", "n secondary"],
  ["total", "Total Outlay", "n secondary"],
  ["need", "Income Needed", "n"],
  ["status", "Status"],
  ["actions", "Actions", "actions"]
];

const condLabel = c => CONDITIONS[c] || CONDITIONS.New;

function summaryHtml(s, f, room) {
  const limit = Math.round(s.dti * 100);
  if (s.income) {
    if (s.down >= 100) {
      return `<div class="stat"><b>100% Cash</b><span>100% cash purchase — Rs. 0.00 monthly lease loan</span></div>
<div class="stat"><b>Rs. 0.00</b><span>Monthly lease rental commitment</span></div>
<div class="stat"><b>Rs. ${fmt(room)}</b><span>Monthly room available for other commitments</span></div>`;
    }
    if (room <= 0) {
      return `<div class="stat stat-wide"><b class="bad">No room for a lease rental</b><span>Your existing monthly payments already use up your ${limit}% limit — no room for a lease rental.</span></div>`;
    }
    const maxPrice = room / f / (1 - s.down / 100);
    return `<div class="stat"><b>Rs. ${fmt(room)}</b><span>Highest monthly rental at a ${limit}% limit${s.debt ? " after existing payments" : ""}${s.insurance ? " and monthly insurance" : ""}</span></div>
<div class="stat"><b>Rs. ${fmt(maxPrice)}</b><span>Highest vehicle price you can finance with ${s.down}% down${s.down < 60 ? " (cars registered over a year only)" : ""}</span></div>
<div class="stat"><b>Rs. ${fmt(maxPrice * s.down / 100 + (s.fees || 0))}</b><span>Cash Needed Up Front for that vehicle${s.fees ? ", with fees" : ""}</span></div>`;
  }
  if (s.down >= 100) {
    return `<div class="stat"><b>Rs. 0.00</b><span>Monthly rental (100% down payment)</span></div>
<div class="stat"><b>100% Cash</b><span>Zero lease financing needed</span></div>
<div class="stat"><span>Enter your net monthly income above to evaluate affordability and budget room.</span></div>`;
  }
  return `<div class="stat"><b>Rs. ${fmt(1e6 * f * (1 - s.down / 100))}</b><span>Monthly rental for every Rs. 1.00 million of vehicle price</span></div>
<div class="stat"><b>Rs. ${fmt(1e6 * f * (1 - s.down / 100) / s.dti)}</b><span>Net Income Needed per Rs. 1.00 million of price at a ${limit}% limit</span></div>
<div class="stat"><span>Enter your net monthly income above to see which vehicles fit and the highest price you can finance.</span></div>`;
}

function rowActions(r) {
  const name = esc(r.name);
  return `<button class="row-btn" type="button" data-act="details" data-key="${r._key}" aria-label="Lease details, ${name}">Details</button><button class="link" type="button" data-act="remove" data-key="${r._key}" aria-label="Remove ${name}">Remove</button>`;
}

const UNKNOWN_SPEC = "Specifications to confirm";

// Table header is rebuilt only when the sort changes
let headSig = "";
function renderHead() {
  const sig = sortKey + "|" + sortDir;
  if (sig === headSig) return;
  headSig = sig;
  $("head").innerHTML = cols.map(c => {
    const sortable = !["status", "bar", "actions"].includes(c[0]);
    const k = c[0];
    const cur = k === sortKey ? (sortDir === -1 ? "descending" : "ascending") : "none";
    const arrow = k === sortKey ? (sortDir === -1 ? " ▾" : " ▴") : "";
    const label = k === "actions" ? `<span class="sr-only">${c[1]}</span>` : c[1];
    return `<th class="${c[2] || ""}"${sortable ? ` aria-sort="${cur}"` : ""}>${sortable ? `<button type="button" data-k="${k}">${c[1]}${arrow}</button>` : label}</th>`;
  }).join("");
}

// Vehicle rows are created once per vehicle and then updated in place,
// so photos are not re-requested and focused buttons stay put while typing.
const rowEls = new Map();

function buildRow(key) {
  const tr = document.createElement("tr");
  tr.dataset.key = key;
  tr.innerHTML = `<td class="name"><div class="car"><span class="thumb"></span><div><b class="v-name"></b><small class="v-spec"></small><div class="warr"><span class="v-warr"></span><button type="button" class="cond-tag" data-act="cond" data-key="${key}" title="Change condition (Brand New, Reconditioned, Registered under a year, Registered Used)"><span class="v-cond"></span> <span class="cycle-icon" aria-hidden="true">⇄</span></button><span class="v-ltv"></span></div></div></div></td>
<td class="n price-cell" data-label="Price (Rs.)"><span class="price-wrap"><span class="price-val"></span><button type="button" class="icon-btn edit-price" data-act="price" data-key="${key}" title="Edit price">✎</button></span></td>
<td class="n v-dp" data-label="Down payment (Rs.)"></td>
<td class="n" data-label="Monthly rental (Rs.)"><b class="v-rent"></b></td>
<td class="v-bar" data-label="Share of your budget"></td>
<td class="n v-interest secondary" data-label="Total Interest (Rs.)"></td>
<td class="n v-total secondary" data-label="Total outlay (Rs.)"></td>
<td class="n v-need" data-label="Income needed (Rs.)"></td>
<td class="v-status" data-label="Status"></td>
<td class="v-actions"><span class="row-actions"></span></td>`;
  return tr;
}

// Sets innerHTML only when it changed, so unchanged buttons keep focus
function setHtml(el, html) {
  if (el._html !== html) { el._html = html; el.innerHTML = html; }
}

function setThumb(tr, r) {
  const slot = tr.querySelector(".thumb");
  const officialPhoto = photoForModel(r);
  if (slot._img === officialPhoto && slot._alt === r.name) return;
  slot._img = officialPhoto;
  slot._alt = r.name;
  slot.innerHTML = NO_PHOTO;
  if (!officialPhoto) return;
  const img = new Image();
  img.loading = "lazy";
  img.alt = r.name;
  img.addEventListener("error", () => { slot.innerHTML = NO_PHOTO; });
  img.src = officialPhoto;
  slot.replaceChildren(img);
}

function updateRow(tr, r, { s, room, scale, labels }) {
  const q = sel => tr.querySelector(sel);
  const cl = condLabel(r.cond);
  setThumb(tr, r);
  q(".v-name").textContent = r.name;
  setHtml(q(".v-spec"), [r.trim, r.pt, r.power, r.drivetrain, r.km].filter(t => t && t !== UNKNOWN_SPEC).map(t => `<span class="spec">${esc(t)}</span>`).join(" · "));
  q(".v-warr").textContent = r.w === "Official" ? "Official agent" : r.w === "Grey" ? "Grey import" : "Route unconfirmed";
  const basis = { "user-entered": "Your Price", "ai-estimate": "AI estimate: confirm with the seller", "seller-listed": "Seller's asking price", "unpublished": "Unverified price estimate", "published": "Source-backed asking price", "starting": "Source-backed starting price" };
  if (r.firstRegisteredOn) q(".v-warr").textContent += " · First registered " + formatDate(r.firstRegisteredOn);
  if (r.legacy) q(".v-warr").textContent += " · Saved estimate: verify price";
  else if (r.priceBasis) q(".v-warr").textContent += " · " + (basis[r.priceBasis] || "Confirm current quote");
  if (r.conditionAssumed) q(".v-warr").textContent += ' · Condition unconfirmed; new-car deposit assumed';
  if (r.financeNote) q(".v-warr").textContent += ' · ' + r.financeNote;
  q(".v-cond").textContent = cl;
  q(".cond-tag").setAttribute("aria-label", `Change condition, currently ${cl}`);
  setHtml(q(".v-ltv"), r.downRaised ? `<span class="ltv-warn" title="CBSL Directions No. 01 of 2026, cl. 2.1: brand new, reconditioned and recently registered cars need at least ${r.downPct}% down, so this car is calculated at ${r.downPct}% instead of ${s.down}%">${r.downPct}% down (CBSL minimum)</span>` : "");
  setHtml(q(".row-actions"), rowActions(r));
  q(".price-val").textContent = fmt(r.price);
  q(".edit-price").setAttribute("aria-label", `Edit price, ${r.name}`);
  q(".v-rent").textContent = fmt(r.rental);
  q(".v-dp").textContent = fmt(r.dp);

  const w = Math.min(100, r.rental / scale * 100);
  setHtml(q(".v-bar"), s.income
    ? `<div class="track" role="img" aria-label="Rental Rs. ${fmt(r.rental)} against your highest affordable rental of Rs. ${fmt(room)}"><span class="fill ${r.status}" style="width:${w}%"></span><span class="mark" style="left:${Math.min(100, room / scale * 100)}%" title="Your highest affordable rental"></span></div>`
    : `<span class="na bar-empty">Add income to compare</span>`);
  q(".v-interest").textContent = fmt(r.interest);
  q(".v-total").textContent = fmt(r.total);
  q(".v-need").textContent = fmt(r.need);
  setHtml(q(".v-status"), r.status === "na" ? '<span class="na">-</span>' : `<span class="tag ${r.status}">${labels[r.status]}</span>`);
}

function render() {
  // The shared deposit control permits 40% only when a selected vehicle can use it.
  const eligibleForForty = cars.some(c => !c.hidden && minDownFor(c.cond, c.financeClass, c.firstRegisteredOn) === 40);
  if ($('down')) $('down').min = String(eligibleForForty ? 40 : 60);
  const settings = readSettings();
  syncSegmentedAndSteppers();
  const { s, f, rows: allRows, room } = computeLeaseTable(cars, settings);
  const rows = allRows.filter(r => !r.hidden);

  $("summary").innerHTML = summaryHtml(s, f, room);

  // Rate hint: which kind of rate is in use, and a flat rate's reducing-balance equivalent
  const rateHint = $("rateHint");
  if (rateHint && !fieldError("rate")) {
    rateHint.className = "hint";
    rateHint.textContent = s.rateType === "flat"
      ? `${s.rateInput}% flat is about ${s.rate.toFixed(2)}% a year on a reducing balance over ${s.n} months.`
      : "Reducing-balance rate. Ask the lender which kind they quote.";
  }

  // Filters
  const maxValue = num("maxprice");
  const maxP = Number.isFinite(maxValue) && maxValue >= 0 ? maxValue * 1e6 : Infinity;
  const wFilter = $("warr").value;
  const cFilter = $("condFilter").value;
  const affordVal = $("afford").value;

  const list = rows.filter(r => {
    if (r.price > maxP) return false;
    if (wFilter === "official" && r.w !== "Official") return false;
    if (wFilter === "grey" && r.w !== "Grey") return false;
    if (wFilter === "independent" && (r.w === "Official" || r.w === "Grey")) return false;
    if (cFilter !== "all" && (r.cond || "New") !== cFilter) return false;
    if (affordVal === "ok") {
      if (!s.income) return false;
      if (r.status !== "ok") return false;
    }
    return true;
  });

  const key = sortKey === "bar" ? "rental" : sortKey;
  list.sort((a, b) => {
    const x = a[key], y = b[key];
    if (typeof x === "string") return sortDir * x.localeCompare(y);
    return sortDir * (x - y);
  });

  renderHead();

  $("sort").value = [...$("sort").options].some(o => o.value === sortKey + "|" + sortDir) ? sortKey + "|" + sortDir : "";

  updateFilterCount();
  updateBudgetExtras(s, f, room, rows);
  updateLtvBar(s, rows);

  const maxRent = Math.max(1, ...rows.map(r => r.rental));
  const scale = s.income ? Math.max(room, maxRent) : maxRent;
  const labels = { ok: "Within your limit", mid: "Above your limit", bad: "Above your limit", na: "" };

  const hasCars = cars.some(c => !c.hidden);
  $("resetCatalogWrap").hidden = !cars.length;
  if ($("emptyState")) $("emptyState").hidden = hasCars;
  if ($("comparisonBody")) $("comparisonBody").hidden = !hasCars;
  if ($("openCatalogueBtn")) $("openCatalogueBtn").hidden = !hasCars;
  if ($("affordOption")) $("affordOption").textContent = `Only those within my ${Math.round(s.dti * 100)}% limit`;
  refreshCatalogue();

  const ctx = { s, room, scale, labels };
  const tbody = $("rows");
  const wanted = list.slice(0, comparisonLimit).map(r => {
    let tr = rowEls.get(r._key);
    if (!tr) { tr = buildRow(r._key); rowEls.set(r._key, tr); }
    updateRow(tr, r, ctx);
    return tr;
  });
  // Put rows in order, moving only those out of place so focus and images survive
  wanted.forEach((tr, i) => {
    const at = tbody.children[i];
    if (at !== tr) tbody.insertBefore(tr, at || null);
  });
  while (tbody.children.length > wanted.length) tbody.lastElementChild.remove();
  for (const k of rowEls.keys()) if (!cars.some(c => c._key === k)) rowEls.delete(k);
  if ($('comparisonCount')) $('comparisonCount').textContent = `${Math.min(comparisonLimit, list.length)} of ${list.length} matching vehicles · ${rows.length} in your comparison`;
  if ($('showMoreVehicles')) $('showMoreVehicles').hidden = list.length <= comparisonLimit;
  if ($('compactTerms')) $('compactTerms').textContent = `${s.rateInput}% ${s.rateType === 'flat' ? 'flat' : 'reducing'} · ${s.n} months · ${s.down}% down`;
  if ($('calculationBasis')) $('calculationBasis').textContent = `Calculated from each selected vehicle's price, ${s.rateInput}% ${s.rateType === 'flat' ? 'flat' : 'reducing-balance'} interest, ${s.n} months and your ${s.down}% deposit (or the vehicle's higher legal minimum). ${s.income ? `Monthly budget uses your LKR ${fmt(s.income)} income, LKR ${fmt(s.debt)} existing payments and ${Math.round(s.dti * 100)}% limit.` : 'Add income to calculate a personal monthly budget.'} Fees and insurance use the amounts you enter. Catalogue prices are sourced amounts or clearly labelled estimates.`;
  refreshPlanner();

  if (list.length === 0) {
    $("empty").textContent = affordVal === "ok" && !s.income
      ? "Enter your net monthly income above to filter vehicles you can afford."
      : "No vehicles match these filters.";
    $("empty").hidden = false;
  } else {
    $("empty").hidden = true;
  }

  saveState(currentState());
}

// Mobile "Filters & sort" toggle shows how many filters are active
const FILTER_DEFAULTS = { warr: "all", condFilter: "all", maxprice: "", afford: "all" };
function updateFilterCount() {
  const n = Object.entries(FILTER_DEFAULTS).filter(([id, def]) => $(id) && String($(id).value).trim() !== def).length;
  $("filtersCount").textContent = n ? `(${n})` : "";
  $("filtersCount").hidden = !n;
  $("filtersToggle").setAttribute("aria-label", n ? `Filters and sort, ${n} active` : "Filters and sort");
}

$("filtersToggle").addEventListener("click", () => {
  const open = $("filtersToggle").getAttribute("aria-expanded") !== "true";
  $("filtersToggle").setAttribute("aria-expanded", String(open));
  $("toolsPanel").classList.toggle("collapsed", !open);
});

// Budget legend, sticky mobile summary and the debounced screen-reader sentence
let liveTimer = null;
let budgetBarText = "";
function updateBudgetExtras(s, f, room, rows) {
  const limit = Math.round(s.dti * 100);
  const legend = $("budgetLegend");
  legend.hidden = !s.income;
  if (s.income) {
    legend.innerHTML = `<span><span class="legend-tick" aria-hidden="true"></span>Your limit: ${limit}% of income${s.debt ? " after existing payments" : ""}${s.insurance ? " and monthly insurance" : ""}</span>
<span>Rental, monthly insurance and existing payments: <span class="tag ok">Within your limit</span> up to ${limit}% · <span class="tag bad">Above your limit</span> over ${limit}%</span>`;
  }

  const budgetGraphic = $("budgetGraphic");
  if (budgetGraphic) {
    budgetGraphic.hidden = false;
    if ($("summary")) $("summary").hidden = true;

    if (!s.income) {
      const needleEl = $("budgetNeedle");
      if (needleEl) needleEl.setAttribute("transform", "rotate(-90.0, 160, 150)");

      const heroEl = $("budgetDtiHero");
      if (heroEl) heroEl.textContent = "0.0% DTI";

      const propRent = rows.length > 0 ? rows[0].rental : 1e6 * f * (1 - s.down / 100);
      const subEl = $("budgetDtiSub");
      if (subEl) subEl.textContent = rows.length > 0
        ? `Rs. ${fmt(propRent)} / month rental`
        : `Rs. ${fmt(propRent)} / Rs. 1M price`;

      const pillEl = $("budgetDtiPill");
      if (pillEl) pillEl.className = "classic-dti-pill ok";
      const textEl = $("budgetDtiText");
      if (textEl) textEl.textContent = "Enter Net Monthly Income";

      const labelEl = $("budgetCashflowLabel");
      if (labelEl) labelEl.textContent = "Net Income Cashflow (Enter income above)";

      const barEl = $("budgetCashflowBar");
      if (barEl) {
        const fullW = 100;
        barEl.innerHTML = `<div class="cashflow-seg-free" style="width:${fullW}%" title="Discretionary: Enter net monthly income">Enter net monthly income above to evaluate DTI &amp; cashflow</div>`;
      }

      const gridEl = $("budgetTelemetryGrid");
      if (gridEl) {
        const card1Title = rows.length > 0 ? "Vehicle Lease Rental" : "Monthly Rental / Rs. 1M";
        const card1Tag = rows.length > 0 ? "Proposed" : "Standard";
        const card1Val = propRent;
        const card1Sub = rows.length > 0 ? esc(rows[0].name) : "Per Rs. 1.00M vehicle price";

        const card2Title = "Existing Commitments";
        const card2Tag = s.debt > 0 ? "Loans / Cards" : "Zero Debt";
        const card2TagClass = s.debt > 0 ? "mid" : "ok";
        const card2Val = s.debt;
        const card2Sub = "Existing monthly payments";

        const card3Title = "Net Income Needed / Rs. 1M";
        const card3Tag = `${limit}% Limit`;
        const card3Val = 1e6 * f * (1 - s.down / 100) / s.dti;
        const card3Sub = `At ${limit}% limit per Rs. 1.00M price`;

        const card4Title = "Down Payment";
        const card4Tag = "CBSL 2026";
        const card4Val = 1e6 * (s.down / 100);
        const card4Sub = `${s.down}% CBSL minimum per Rs. 1M`;

        const zeroW = 0;
        const downW = Math.min(100, Math.max(0, Math.round(s.down)));

        gridEl.innerHTML = `<div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card1Title}</span><span class="tag ok">${card1Tag}</span></div><div class="telemetry-card-val val-rental">Rs. ${fmt(card1Val)}</div><div class="telemetry-card-sub"><span>${card1Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-rental" style="width:${downW}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card2Title}</span><span class="tag ${card2TagClass}">${card2Tag}</span></div><div class="telemetry-card-val">Rs. ${fmt(card2Val)}</div><div class="telemetry-card-sub"><span>${card2Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-debt" style="width:${zeroW}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card3Title}</span><span class="tag ok">${card3Tag}</span></div><div class="telemetry-card-val">Rs. ${fmt(card3Val)}</div><div class="telemetry-card-sub"><span>${card3Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-price" style="width:${downW}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card4Title}</span><span class="tag ok">${card4Tag}</span></div><div class="telemetry-card-val">Rs. ${fmt(card4Val)}</div><div class="telemetry-card-sub"><span>${card4Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-upfront" style="width:${downW}%"></div></div></div>`;
      }
    } else {
      budgetGraphic.hidden = false;
      if ($("summary")) $("summary").hidden = true;

      const leaseRental = s.down >= 100 ? 0 : (rows.length > 0 ? rows[0].rental : (room > 0 ? room : 0));
      const monthlyInsurance = s.insurance ? s.insurance / 12 : 0;
      const totalMonthlyDebt = leaseRental + s.debt + monthlyInsurance;
      const dtiPct = s.income > 0 ? (totalMonthlyDebt / s.income) * 100 : 0;
      const dtiStr = dtiPct.toFixed(1) + "%";

      const clampedDti = Math.min(60, Math.max(0, dtiPct));
      const needleAngle = -90 + (clampedDti / 60) * 180;
      const needleEl = $("budgetNeedle");
      if (needleEl) needleEl.setAttribute("transform", `rotate(${needleAngle.toFixed(1)}, 160, 150)`);

      const heroEl = $("budgetDtiHero");
      if (heroEl) heroEl.textContent = dtiStr + " DTI";
      const subEl = $("budgetDtiSub");
      if (subEl) subEl.textContent = `Rs. ${fmt(totalMonthlyDebt)} / month`;

      let statusClass = "ok";
      let statusText = "Within 40% CBSL Limit";
      if (dtiPct <= 40) {
        statusClass = "ok";
        statusText = "Within 40% CBSL Limit";
      } else if (dtiPct <= 50) {
        statusClass = "mid";
        statusText = "Stretching (40 - 50% Cap)";
      } else {
        statusClass = "bad";
        statusText = "Limit Exceeded (> 50%)";
      }
      const pillEl = $("budgetDtiPill");
      if (pillEl) pillEl.className = "classic-dti-pill " + statusClass;
      const textEl = $("budgetDtiText");
      if (textEl) textEl.textContent = statusText;

      const labelEl = $("budgetCashflowLabel");
      if (labelEl) labelEl.textContent = `Rs. ${fmt(totalMonthlyDebt)} / Rs. ${fmt(s.income)} (${dtiStr})`;

      const barEl = $("budgetCashflowBar");
      if (barEl) {
        const rentalPctOfIncome = s.income > 0 ? (leaseRental / s.income) * 100 : 0;
        const debtPctOfIncome = s.income > 0 ? (s.debt / s.income) * 100 : 0;
        const ceilingPct = s.dti * 100;
        const safeRoomPctOfIncome = Math.max(0, ceilingPct - rentalPctOfIncome - debtPctOfIncome);
        const freeIncomePct = Math.max(0, 100 - rentalPctOfIncome - debtPctOfIncome - safeRoomPctOfIncome);

        const rW = Math.min(100, Math.max(0, Math.round(rentalPctOfIncome * 10) / 10));
        const dW = Math.min(100 - rW, Math.max(0, Math.round(debtPctOfIncome * 10) / 10));
        const roomW = Math.min(100 - rW - dW, Math.max(0, Math.round(safeRoomPctOfIncome * 10) / 10));
        const freeW = Math.max(0, Math.round((100 - rW - dW - roomW) * 10) / 10);

        const rLabel = rW >= 12 ? `Rental ${rW.toFixed(0)}%` : "";
        const dLabel = dW >= 8 ? `Debt ${dW.toFixed(0)}%` : "";
        const roomLabel = roomW >= 10 ? `Buffer ${roomW.toFixed(0)}%` : "";
        const freeLabel = freeW >= 15 ? `Discretionary ${freeW.toFixed(0)}%` : "";

        barEl.innerHTML = `<div class="cashflow-seg-rental" style="width:${rW}%" title="Lease Rental: ${rentalPctOfIncome.toFixed(1)}%">${rLabel}</div><div class="cashflow-seg-debt" style="width:${dW}%" title="Existing Debt: ${debtPctOfIncome.toFixed(1)}%">${dLabel}</div><div class="cashflow-seg-room" style="width:${roomW}%" title="Buffer: ${safeRoomPctOfIncome.toFixed(1)}%">${roomLabel}</div><div class="cashflow-seg-free" style="width:${freeW}%" title="Discretionary: ${freeIncomePct.toFixed(1)}%">${freeLabel}</div>`;
      }

      const gridEl = $("budgetTelemetryGrid");
      if (gridEl) {
        const rentalPctOfIncome = s.income > 0 ? (leaseRental / s.income) * 100 : 0;
        const debtPctOfIncome = s.income > 0 ? (s.debt / s.income) * 100 : 0;
        const bar1W = Math.min(100, Math.max(0, Math.round(rentalPctOfIncome)));
        const bar2W = Math.min(100, Math.max(0, Math.round(debtPctOfIncome)));

        let card1Title = "Highest Rental Room";
        let card1Tag = `${limit}% Limit`;
        let card1TagClass = room > 0 ? "ok" : "bad";
        let card1Val = room > 0 ? room : 0;
        let card1Sub = room > 0 ? `Highest monthly rental at ${limit}% limit` : "No room for a lease rental";

        if (s.down >= 100) {
          card1Title = "Lease Rental";
          card1Tag = "100% Cash";
          card1TagClass = "ok";
          card1Val = 0;
          card1Sub = "100% cash purchase — Rs. 0.00 rental";
        } else if (rows.length > 0) {
          card1Title = "Vehicle Lease Rental";
          card1Tag = "Proposed";
          card1TagClass = rows[0].status === "ok" ? "ok" : "bad";
          card1Val = rows[0].rental;
          card1Sub = esc(rows[0].name);
        }

        const card2Title = "Existing Commitments";
        const card2Tag = s.debt > 0 ? "Loans / Cards" : "Zero Debt";
        const card2TagClass = s.debt > 0 ? "mid" : "ok";
        const card2Val = s.debt;
        const card2Sub = `${debtPctOfIncome.toFixed(1)}% of net monthly income`;

        const maxPrice = room > 0 ? (s.down >= 100 ? 0 : room / f / (1 - s.down / 100)) : 0;
        const maxUpfront = maxPrice * s.down / 100 + (s.fees || 0);
        const bar3W = Math.min(100, Math.max(0, Math.round(room > 0 ? 100 : 0)));
        const bar4W = Math.min(100, Math.max(0, Math.round(s.down)));

        let card3Title = "Max Vehicle Price";
        let card3Tag = `${s.down}% Down`;
        let card3TagClass = "ok";
        let card3Val = maxPrice;
        let card3Sub = s.down < 60 ? "Over 1yr registered cars only" : `Financed at ${s.rateInput}% interest`;

        let card4Title = "Cash Needed Up Front";
        let card4Tag = s.fees ? "Deposit + Fees" : "Deposit";
        let card4TagClass = "ok";
        let card4Val = maxUpfront;
        let card4Sub = s.fees ? `Includes Rs. ${fmt(s.fees)} fees` : `Deposit for highest price`;

        if (s.down >= 100) {
          card3Title = "Cash Purchase";
          card3Tag = "100% Down";
          card3Val = 0;
          card3Sub = "Zero lease financing needed";
          card4Title = "Cash Needed";
          card4Tag = "Fees Only";
          card4Val = s.fees || 0;
          card4Sub = s.fees ? "Up-front fees" : "No deposit needed";
        } else if (room <= 0) {
          card3Sub = "Zero borrowing capacity";
          card4Sub = "No lease possible";
        }

        gridEl.innerHTML = `<div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card1Title}</span><span class="tag ${card1TagClass}">${card1Tag}</span></div><div class="telemetry-card-val val-rental">Rs. ${fmt(card1Val)}</div><div class="telemetry-card-sub"><span>${card1Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-rental" style="width:${bar1W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card2Title}</span><span class="tag ${card2TagClass}">${card2Tag}</span></div><div class="telemetry-card-val">Rs. ${fmt(card2Val)}</div><div class="telemetry-card-sub"><span>${card2Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-debt" style="width:${bar2W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card3Title}</span><span class="tag ${card3TagClass}">${card3Tag}</span></div><div class="telemetry-card-val">Rs. ${fmt(card3Val)}</div><div class="telemetry-card-sub"><span>${card3Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-price" style="width:${bar3W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card4Title}</span><span class="tag ${card4TagClass}">${card4Tag}</span></div><div class="telemetry-card-val">Rs. ${fmt(card4Val)}</div><div class="telemetry-card-sub"><span>${card4Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-upfront" style="width:${bar4W}%"></div></div></div>`;
      }
    }
  }

  let sentence = "", bar = "";
  if (!s.income) {
    sentence = `Monthly rental is Rs. ${fmt(1e6 * f * (1 - s.down / 100))} for every Rs. 1.00 million of price.`;
  } else if (s.down >= 100) {
    sentence = "100% cash purchase, no lease rental.";
  } else if (room <= 0) {
    sentence = bar = `Your existing payments already use up your ${limit}% limit. No room for a lease rental.`;
  } else {
    const maxPrice = room / f / (1 - s.down / 100);
    const ok = rows.filter(r => r.status === "ok").length;
    sentence = `Highest monthly rental Rs. ${fmt(room)}. Highest vehicle price Rs. ${fmt(maxPrice)}. ${ok} of ${rows.length} vehicles fit your budget.`;
    bar = `Max rental Rs. ${fmt(room)} · Max price Rs. ${fmt(maxPrice)}`;
  }
  budgetBarText = bar;
  $("budgetBar").textContent = bar;
  syncBudgetBar();
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { $("budgetLive").textContent = sentence; }, 500);
}

function updateLtvBar(s, rows) {
  const trackEl = $("ltvBarTrack");
  if (!trackEl) return;
  const dpPct = Math.min(100, Math.max(0, s.down));
  const loanPct = Math.max(0, 100 - dpPct);
  trackEl.innerHTML = `<div class="ltv-bar-dp" id="ltvBarDp" style="width:${dpPct}%"><span id="ltvBarDpText">${dpPct}% Cash Deposit</span></div><div class="ltv-bar-loan" id="ltvBarLoan" style="width:${loanPct}%"><span id="ltvBarLoanText">${loanPct}% Financed Loan</span></div>`;

  const badgeEl = $("ltvEligibilityBadge");
  if (badgeEl) {
    if (dpPct >= 100) { badgeEl.className = "tag ok"; badgeEl.textContent = "100% Cash Purchase"; }
    else if (dpPct >= 60) { badgeEl.className = "tag ok"; badgeEl.textContent = "CBSL Compliant (All Vehicles)"; }
    else if (dpPct >= 40) { badgeEl.className = "tag mid"; badgeEl.textContent = "CBSL Compliant (>1yr Reg Only)"; }
    else { badgeEl.className = "tag bad"; badgeEl.textContent = "Below CBSL Minimum"; }
  }
  const detailDp = $("ltvDetailDp");
  if (detailDp) detailDp.textContent = rows.length > 0 ? `Rs. ${fmt(rows[0].dp)} (${dpPct}%)` : `${dpPct}% Deposit`;
  const detailLoan = $("ltvDetailLoan");
  if (detailLoan) detailLoan.textContent = rows.length > 0 ? `Rs. ${fmt(rows[0].loan)} (${loanPct.toFixed(1)}% LTV)` : `${loanPct.toFixed(1)}% LTV`;
  const detailCeiling = $("ltvDetailCeiling");
  if (detailCeiling) detailCeiling.textContent = dpPct >= 100 ? "Zero Loan (100% Cash)" : dpPct >= 60 ? "Max 40% Loan (All Cars)" : "Max 60% Loan (>1yr Reg)";
  const detailStatus = $("ltvDetailStatus");
  if (detailStatus) {
    if (dpPct >= 100) { detailStatus.className = "ok"; detailStatus.textContent = "100% Cash Purchase"; }
    else if (dpPct >= 60) { detailStatus.className = "ok"; detailStatus.textContent = "Standard Minimum Met"; }
    else if (dpPct >= 40) { detailStatus.className = "mid"; detailStatus.textContent = "Used Car Rule Only"; }
    else { detailStatus.className = "bad"; detailStatus.textContent = "Below Legal Floor"; }
  }
}

// The bar shows once the budget panel has scrolled out of view
function syncBudgetBar() {
  const panel = $("budgetPanel");
  const box = panel.getBoundingClientRect ? panel.getBoundingClientRect() : null;
  const panelVisible = !box || (box.bottom > 0 && box.top < window.innerHeight);
  const show = !!budgetBarText && !panelVisible;
  $("budgetBar").hidden = !show;
  if (document.body && document.body.classList) document.body.classList.toggle("has-budget-bar", show);
}
if (typeof window.addEventListener === "function") {
  window.addEventListener("scroll", syncBudgetBar, { passive: true });
  window.addEventListener("resize", syncBudgetBar);
}

// Current input values for saving and sharing (invalid fields are skipped)
function currentState() {
  const state = { sort: sortKey + "|" + sortDir };
  for (const id of Object.keys(FIELDS)) {
    if (id === "sort") continue;
    const el = $(id);
    if (!el || fieldError(id)) continue;
    const v = String(el.value).trim();
    state[id] = ["income", "debt", "insurance", "fees"].includes(id) ? (v === "" ? "" : String(num(v))) : v;
  }
  return state;
}

function syncSegmentedAndSteppers() {
  if (typeof document.querySelectorAll !== "function") return;
  for (const id of ["rateType", "dti"]) {
    const el = $(id);
    if (!el) continue;
    const btns = document.querySelectorAll(`button[data-seg-for="${id}"]`);
    btns.forEach(btn => {
      const active = btn.dataset.segVal === String(el.value);
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }
  for (const id of ["rate", "tenure", "down"]) {
    const el = $(id);
    if (!el) continue;
    const val = num(el);
    const min = Number(el.min) || (id === "down" ? 40 : id === "tenure" ? 6 : 0);
    const max = Number(el.max) || (id === "down" ? 100 : id === "tenure" ? 84 : 40);
    const btns = document.querySelectorAll(`button[data-step-for="${id}"]`);
    btns.forEach(btn => {
      const delta = parseFloat(btn.dataset.stepDelta);
      if (delta < 0) btn.disabled = isFinite(val) && val <= min;
      else if (delta > 0) btn.disabled = isFinite(val) && val >= max;
    });
    const chips = document.querySelectorAll(`button[data-preset-for="${id}"]`);
    chips.forEach(chip => {
      const chipVal = Number(chip.dataset.presetVal);
      const active = isFinite(val) && Math.round(val) === chipVal;
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", String(active));
      if (id === "down") {
        const disabled = chipVal < min;
        chip.disabled = disabled;
        if (disabled) {
          chip.title = "Eligible only when a vehicle registered over 1 year is added";
        } else {
          chip.title = chipVal === 40
            ? "CBSL 40% minimum for vehicles registered over 1 year"
            : chipVal === 60
            ? "CBSL 60% minimum for new and reconditioned vehicles"
            : "Conservative down payment (higher equity)";
        }
      }
    });
    const slider = $(id + "Slider");
    if (slider) {
      slider.min = String(min);
      slider.max = String(max);
      if (isFinite(val)) {
        slider.value = String(Math.min(max, Math.max(min, val)));
      }
    }
  }

  const tenureVal = num($("tenure"));
  const downVal = num($("down"));
  const rateTypeVal = $("rateType")?.value;
  const minDown = Number($("down")?.min) || 40;
  const canForty = minDown <= 40;

  const stratBtns = document.querySelectorAll("button[data-strategy]");
  stratBtns.forEach(btn => {
    const strat = btn.dataset.strategy;
    let active = false;
    if (strat === "lowest-rental") {
      active = (tenureVal === 84 && downVal === 60 && rateTypeVal === "reducing");
    } else if (strat === "fast-payoff") {
      active = (tenureVal === 36 && downVal === 60 && rateTypeVal === "reducing");
    } else if (strat === "min-cash") {
      active = (tenureVal === 84 && downVal === 40 && rateTypeVal === "reducing");
      btn.disabled = !canForty;
      btn.title = canForty
        ? "CBSL minimum 40% deposit (for vehicles registered over 1 year)"
        : "Requires an eligible vehicle registered over 1 year in comparison";
    } else if (strat === "cash-purchase") {
      active = (downVal === 100);
    }
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

function applyState(state) {
  for (const [id, f] of Object.entries(FIELDS)) {
    const v = state[id] !== undefined ? state[id] : f.def;
    if (id === "sort") {
      const [k, d] = v.split("|");
      if (cols.some(c => c[0] === k) && (d === "1" || d === "-1")) { sortKey = k; sortDir = +d; }
      continue;
    }
    const el = $(id);
    if (!el) continue;
    if (el.tagName === "SELECT" && el.options && el.options.length && ![...el.options].some(o => o.value === v)) continue;
    el.value = ["income", "debt", "insurance", "fees", "maxprice"].includes(id) && v !== "" ? formatMoneyText(v, { grouping: id !== "maxprice" }) : v;
  }
  syncSegmentedAndSteppers();
}

// Global Event Listeners
const isTermsField = el => el.closest && el.closest(".panel") && !el.closest(".modal");

document.addEventListener("click", e => {
  if (!e.target || typeof e.target.closest !== "function") return;
  const segBtn = e.target.closest("button[data-seg-for]");
  if (segBtn) {
    const id = segBtn.dataset.segFor;
    const val = segBtn.dataset.segVal;
    const el = $(id);
    if (el && String(el.value) !== val) {
      el.value = val;
      syncSegmentedAndSteppers();
      render();
    }
    return;
  }
  const stepBtn = e.target.closest("button[data-step-for]");
  if (stepBtn && !stepBtn.disabled) {
    const id = stepBtn.dataset.stepFor;
    const delta = parseFloat(stepBtn.dataset.stepDelta);
    const el = $(id);
    if (el && isFinite(delta)) {
      const cur = isFinite(num(el)) ? num(el) : parseFloat(FIELDS[id]?.def || "0");
      const min = Number(el.min) || (id === "down" ? 40 : id === "tenure" ? 6 : 0);
      const max = Number(el.max) || (id === "down" ? 100 : id === "tenure" ? 84 : 40);
      let next = Math.min(max, Math.max(min, Math.round((cur + delta) * 10) / 10));
      if (id !== "rate") next = Math.round(next);
      el.value = String(next);
      clearSnapNote(id);
      syncSegmentedAndSteppers();
      render();
    }
    return;
  }
  const presetBtn = e.target.closest("button[data-preset-for]");
  if (presetBtn && !presetBtn.disabled) {
    const id = presetBtn.dataset.presetFor;
    const val = presetBtn.dataset.presetVal;
    const el = $(id);
    if (el) {
      el.value = val;
      clearSnapNote(id);
      try {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (err) {}
      syncSegmentedAndSteppers();
      render();
    }
    return;
  }
  const stratBtn = e.target.closest("button[data-strategy]");
  if (stratBtn && !stratBtn.disabled) {
    const strat = stratBtn.dataset.strategy;
    if (strat === "lowest-rental") {
      if ($("tenure")) $("tenure").value = "84";
      if ($("down")) $("down").value = "60";
      if ($("rateType")) $("rateType").value = "reducing";
    } else if (strat === "fast-payoff") {
      if ($("tenure")) $("tenure").value = "36";
      if ($("down")) $("down").value = "60";
      if ($("rateType")) $("rateType").value = "reducing";
    } else if (strat === "min-cash") {
      const minDown = Number($("down")?.min) || 40;
      if ($("tenure")) $("tenure").value = "84";
      if ($("down")) $("down").value = String(minDown);
      if ($("rateType")) $("rateType").value = "reducing";
    } else if (strat === "cash-purchase") {
      if ($("down")) $("down").value = "100";
    }
    clearSnapNote("tenure");
    clearSnapNote("down");
    clearSnapNote("rateType");
    try {
      $("tenure")?.dispatchEvent(new Event("input", { bubbles: true }));
      $("down")?.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (err) {}
    syncSegmentedAndSteppers();
    render();
    return;
  }
  const adornWrap = e.target.closest(".input-adorn-wrap");
  if (adornWrap && e.target !== adornWrap.querySelector("input")) {
    adornWrap.querySelector("input")?.focus();
  }
});

document.addEventListener("input", e => {
  if (e.target.id === "sort" && e.target.value) {
    const [k, d] = e.target.value.split("|");
    sortKey = k; sortDir = +d;
  }
  if (e.target.tagName === "SELECT") return; // Let change handler process select elements
  if (e.target.id) clearSnapNote(e.target.id);
  const slider = e.target.closest && e.target.closest("input[data-slider-for]");
  if (slider) {
    const id = slider.dataset.sliderFor;
    const el = $(id);
    if (el && String(el.value) !== String(slider.value)) {
      el.value = String(slider.value);
      clearSnapNote(id);
      syncSegmentedAndSteppers();
      render();
    }
    return;
  }
  if (isTermsField(e.target)) {
    syncSegmentedAndSteppers();
    render();
  }
});

for (const id of ['down','tenure']) $(id)?.addEventListener('blur', () => { snapField(id); syncSegmentedAndSteppers(); render(); });

document.addEventListener("change", e => {
  if (e.target.id === "sort" && e.target.value) {
    const [k, d] = e.target.value.split("|");
    sortKey = k; sortDir = +d;
  }
  const slider = e.target.closest && e.target.closest("input[data-slider-for]");
  if (slider) {
    const id = slider.dataset.sliderFor;
    const el = $(id);
    if (el && String(el.value) !== String(slider.value)) {
      el.value = String(slider.value);
      clearSnapNote(id);
      syncSegmentedAndSteppers();
      render();
    }
    return;
  }
  if (e.target.id === "tenure" || e.target.id === "down") snapField(e.target.id);
  if (isTermsField(e.target)) {
    syncSegmentedAndSteppers();
    render();
  }
});

$("head").addEventListener("click", e => {
  const b = e.target.closest("button[data-k]");
  if (!b) return;
  const k = b.dataset.k;
  if (k === sortKey) sortDir = -sortDir; else { sortKey = k; sortDir = k === "name" ? 1 : -1; }
  render();
  const again = $("head").querySelector(`button[data-k="${k}"]`);
  if (again) again.focus();
});

$("resetInputsBtn").addEventListener("click", () => {
  clearState();
  for (const id of Object.keys(FIELDS)) clearSnapNote(id);
  applyState({});
  try { history.replaceState(null, "", window.location.pathname + window.location.hash); } catch (e) {}
  render();
  $("rate").focus();
});

["income", "debt", "insurance", "fees", "mPrice", "aiPriceInput"].forEach(id => $(id) && attachMoneyInput($(id)));
attachMoneyInput($("maxprice"), { grouping: false });

// Stable keys let the table keep focus and rows across re-renders
function assignKey(c) {
  c.id = c.id || newVehicleId();
  c._key = "v-" + c.id;
  return c;
}
cars.forEach(assignKey);

function addCars(batch) {
  const error = vehicleBatchError(batch);
  if (error) { showVehicleError(error); return false; }
  cars.push(...batch.map(assignKey));
  return true;
}

function showVehicleError(message) {
  $("aiSearchMsg").textContent = message;
  $("aiSearchMsg").classList.add("msg-error");
}

const indexOfKey = key => cars.findIndex(c => c._key === key);

function focusRowControl(key, act) {
  const el = $("rows").querySelector(`[data-key="${key}"][data-act="${act}"]`);
  if (el) el.focus();
  else $("h-list").focus();
}

// Removing, hiding or resetting a vehicle offers Undo for about 6 seconds
function changeWithUndo(idx, message, mutate) {
  const before = Object.assign({}, cars[idx]);
  mutate();
  saveCars(cars);
  render();
  const undoBtn = showToast(message, "Undo", () => {
    const at = indexOfKey(before._key);
    if (at >= 0) cars[at] = before; else cars.splice(Math.min(idx, cars.length), 0, before);
    saveCars(cars);
    render();
    focusRowControl(before._key, "price");
  }, () => $("h-list").focus());
  if (undoBtn) undoBtn.focus();
}

// Table actions: remove/hide/reset, condition cycling, inline price editing
$("rows").addEventListener("click", e => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const key = b.dataset.key;
  const idx = indexOfKey(key);
  const car = cars[idx];
  if (!car) return;
  const act = b.dataset.act;

  if (act === "remove") {
    changeWithUndo(idx, `Removed ${car.name}.`, () => { cars.splice(idx, 1); });
  } else if (act === "details") {
    openDetails(car, b);
  } else if (act === "cond") {
    const cycle = { New: "Recond", Recond: "Recent", Recent: "Used", Used: "New" };
    car.cond = cycle[car.cond || "New"] || "New";
    delete car.conditionAssumed;
    car.custom = true;
    car.priceBasis = "user-entered";
    car.priceSourceUrl = null;
    saveCars(cars);
    render();
    focusRowControl(key, "cond");
    // The price was for the old condition, so offer to change it
    showToast(`${car.name} is now ${condLabel(car.cond)}. Check its price for this condition.`, "Edit Price", () => {
      const edit = $("rows").querySelector(`[data-key="${key}"][data-act="price"]`);
      if (edit) startPriceEdit(edit, car);
    });
  } else if (act === "price") {
    startPriceEdit(b, car);
  }
});

function startPriceEdit(btn, car) {
  const wrap = btn.closest(".price-wrap");
  if (!wrap || wrap.hidden) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "inline-price-input";
  input.inputMode = "numeric";
  input.value = formatMoneyText(String(car.price));
  input.setAttribute("aria-label", `Price for ${car.name}`);
  wrap.hidden = true;
  wrap.after(input);
  attachMoneyInput(input);
  input.focus();
  input.select();

  let done = false;
  const finish = save => {
    if (done) return;
    done = true;
    const newP = num(input.value);
    if (save && newP > 0 && newP !== car.price) {
      car.price = newP;
      car.custom = true;
      car.priceBasis = "user-entered";
      car.priceSourceUrl = null;
      saveCars(cars);
    }
    input.remove();
    wrap.hidden = false;
    render();
    focusRowControl(car._key, "price");
  };
  input.addEventListener("keydown", evt => {
    if (evt.key === "Enter") { evt.preventDefault(); finish(true); }
    else if (evt.key === "Escape") { evt.preventDefault(); evt.stopPropagation(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true));
}

$("resetCatalogBtn").addEventListener("click", () => {
  const before = cars;
  cars = [];
  saveCars(cars);
  rowEls.clear();
  $("rows").replaceChildren();
  render();
  const undoBtn = showToast(`Cleared ${before.length === 1 ? "1 vehicle" : before.length + " vehicles"} from your comparison.`, "Undo", () => {
    cars = before;
    saveCars(cars);
    render();
    $("h-list").focus();
  }, () => $("h-list").focus());
  if (undoBtn) undoBtn.focus(); else $("h-list").focus();
});

function fmtM(n) {
  if (!Number.isFinite(n) || n <= 0) return "0.00";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(0);
}

function renderCostDonutMarkup() {
  return `
    <div class="donut-card" id="detailDonutCard">
      <div class="donut-head">
        <h3 class="donut-title">Cost &amp; Payment Composition</h3>
        <div class="tab-pills" role="tablist">
          <button type="button" class="tab-pill active" id="donutTabLifetime">Lifetime Outlay</button>
          <button type="button" class="tab-pill" id="donutTabMonthly">Monthly Outlay</button>
        </div>
      </div>
      <div class="donut-wrapper">
        <div class="donut-chart-box">
          <svg class="donut-svg" viewBox="0 0 100 100" aria-hidden="true">
            <g transform="rotate(-90 50 50)">
              <circle cx="50" cy="50" r="38" class="donut-bg-circle"/>
              <g id="donutSegmentsGroup"></g>
            </g>
          </svg>
          <div class="donut-center-info">
            <span class="donut-center-label" id="donutCenterLabel">Lifetime Outlay</span>
            <span class="donut-center-amount" id="donutCenterAmount"></span>
          </div>
        </div>
        <div class="donut-legend" id="donutLegend"></div>
      </div>
    </div>
  `;
}

function updateDonutContent(car, r, s, mode) {
  const segmentsGroup = $("donutSegmentsGroup");
  const centerLabel = $("donutCenterLabel");
  const centerAmount = $("donutCenterAmount");
  const legend = $("donutLegend");
  if (!segmentsGroup || !centerLabel || !centerAmount || !legend) return;

  let items = [];
  if (mode === "monthly") {
    centerLabel.textContent = "Monthly Outlay";
    if (r.downPct >= 100) {
      items.push({
        val: 0,
        segClass: "donut-seg-accent",
        dotClass: "donut-dot-accent",
        label: "Vehicle Lease Rental",
        subtitle: "100% Cash — Zero monthly lease"
      });
    } else {
      items.push({
        val: r.rental,
        segClass: "donut-seg-accent",
        dotClass: "donut-dot-accent",
        label: "Vehicle Lease Rental",
        subtitle: `${s.n} monthly installments`
      });
    }
    if (s.insurance) {
      items.push({
        val: s.insurance / 12,
        segClass: "donut-seg-teal",
        dotClass: "donut-dot-teal",
        label: "Monthly Insurance",
        subtitle: "Comprehensive annual cover ÷ 12"
      });
    }
    if (s.debt) {
      items.push({
        val: s.debt,
        segClass: "donut-seg-bad",
        dotClass: "donut-dot-bad",
        label: "Existing Commitments",
        subtitle: "Monthly loans & credit cards"
      });
    }
  } else {
    centerLabel.textContent = "Lifetime Outlay";
    if (r.downPct >= 100) {
      items.push({
        val: car.price,
        segClass: "donut-seg-accent",
        dotClass: "donut-dot-accent",
        label: "Cash Vehicle Purchase",
        subtitle: "100% cash paid upfront"
      });
    } else {
      items.push({
        val: r.dp,
        segClass: "donut-seg-accent",
        dotClass: "donut-dot-accent",
        label: "Cash Down Payment",
        subtitle: `${r.downPct}% statutory cash deposit`
      });
      items.push({
        val: r.loan,
        segClass: "donut-seg-spark",
        dotClass: "donut-dot-spark",
        label: "Principal Financed",
        subtitle: `${100 - r.downPct}% financed loan capital`
      });
      items.push({
        val: r.interest,
        segClass: "donut-seg-amber",
        dotClass: "donut-dot-amber",
        label: "Total Lease Interest",
        subtitle: `${s.rateInput}% rate over ${s.n} months`
      });
    }
    if (s.fees) {
      items.push({
        val: s.fees,
        segClass: "donut-seg-teal",
        dotClass: "donut-dot-teal",
        label: "Up-Front Fees",
        subtitle: "Registration & doc charges"
      });
    }
    if (s.insurance) {
      items.push({
        val: (s.insurance * s.n) / 12,
        segClass: "donut-seg-bad",
        dotClass: "donut-dot-bad",
        label: "Comprehensive Insurance",
        subtitle: `Total over ${s.n} month tenure`
      });
    }
  }

  const positiveItems = items.filter(it => it.val > 0);
  const total = positiveItems.reduce((sum, it) => sum + it.val, 0);
  centerAmount.textContent = "Rs. " + fmtM(total);

  const circ = 2 * Math.PI * 38;
  let cumOffset = 0;
  let segsHtml = "";

  if (positiveItems.length === 0) {
    segsHtml = `<circle cx="50" cy="50" r="38" class="donut-seg donut-seg-accent" stroke-dasharray="${circ} 0" stroke-dashoffset="0"/>`;
  } else {
    positiveItems.forEach(item => {
      const pct = item.val / total;
      const dash = (pct * circ).toFixed(2);
      const gap = (circ - parseFloat(dash)).toFixed(2);
      const off = (-cumOffset).toFixed(2);
      segsHtml += `<circle cx="50" cy="50" r="38" class="donut-seg ${item.segClass}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${off}"/>`;
      cumOffset += pct * circ;
    });
  }
  segmentsGroup.innerHTML = segsHtml;

  let legendHtml = "";
  items.forEach(item => {
    const pctStr = total > 0 && item.val > 0 ? ((item.val / total) * 100).toFixed(1) + "%" : "0.0%";
    legendHtml += `
      <div class="legend-item">
        <div class="legend-lead">
          <span class="legend-dot ${item.dotClass}"></span>
          <div>
            <div class="legend-title">${esc(item.label)}</div>
            <div class="legend-subtitle">${esc(item.subtitle)}</div>
          </div>
        </div>
        <div>
          <div class="legend-val">Rs. ${fmt(item.val)}</div>
          <div class="legend-pct">${pctStr} of total</div>
        </div>
      </div>
    `;
  });
  legend.innerHTML = legendHtml;
}

function setupDetailDonut(car, r, s) {
  const tabLifetime = $("donutTabLifetime");
  const tabMonthly = $("donutTabMonthly");
  if (!tabLifetime || !tabMonthly) return;

  function renderMode(mode) {
    tabLifetime.classList.toggle("active", mode === "lifetime");
    tabMonthly.classList.toggle("active", mode === "monthly");
    updateDonutContent(car, r, s, mode);
  }

  tabLifetime.addEventListener("click", () => renderMode("lifetime"));
  tabMonthly.addEventListener("click", () => renderMode("monthly"));
  renderMode("lifetime");
}

function buildAmortizationSvg(r, s, years) {
  if (r.downPct >= 100 || !years || !years.length) return "";
  const totalInterest = r.interest;
  const maxVal = Math.max(1, r.loan, totalInterest);
  const xStart = 55, xEnd = 660, yBase = 160, yTop = 20;
  const chartW = xEnd - xStart;
  const chartH = yBase - yTop;
  const xStep = chartW / years.length;

  const y = (val) => (yBase - (val / maxVal) * chartH).toFixed(1);

  let princPts = [`${xStart},${y(r.loan)}`];
  let intPts = [`${xStart},${y(0)}`];
  let markersHtml = "";
  let xLabelsHtml = `<text x="${xStart}" y="178" class="amort-axis-label" text-anchor="middle">Yr 0</text>`;

  markersHtml += `<circle cx="${xStart}" cy="${y(r.loan)}" r="4" class="amort-marker-principal"><title>Year 0: Initial Principal Rs. ${fmt(r.loan)}</title></circle>`;
  markersHtml += `<circle cx="${xStart}" cy="${y(0)}" r="3.5" class="amort-marker-interest"><title>Year 0: Cumulative Interest Rs. 0.00</title></circle>`;

  let cumInterest = 0;
  years.forEach((yr, i) => {
    const x = (xStart + (i + 1) * xStep).toFixed(1);
    cumInterest += yr.interest;
    const yP = y(yr.balance);
    const yI = y(cumInterest);

    princPts.push(`${x},${yP}`);
    intPts.push(`${x},${yI}`);

    markersHtml += `<circle cx="${x}" cy="${yP}" r="4" class="amort-marker-principal"><title>Year ${yr.year}: Principal Remaining Rs. ${fmt(yr.balance)}</title></circle>`;
    markersHtml += `<circle cx="${x}" cy="${yI}" r="3.5" class="amort-marker-interest"><title>Year ${yr.year}: Cumulative Interest Rs. ${fmt(cumInterest)}</title></circle>`;
    xLabelsHtml += `<text x="${x}" y="178" class="amort-axis-label" text-anchor="middle">Yr ${yr.year}</text>`;
  });

  const princAreaPts = `${xStart},${yBase} ${princPts.join(" ")} ${xEnd},${yBase}`;
  const intAreaPts = `${xStart},${yBase} ${intPts.join(" ")} ${xEnd},${yBase}`;

  return `
    <div class="amort-card">
      <div class="amort-head">
        <h3 class="amort-title">Loan Amortization Paydown Curve</h3>
        <div class="amort-legend-row">
          <span class="amort-legend-item"><span class="amort-legend-color amort-color-principal"></span> Principal Balance Remaining</span>
          <span class="amort-legend-item"><span class="amort-legend-color amort-color-interest"></span> Cumulative Interest Paid</span>
        </div>
      </div>
      <div class="amort-svg-box">
        <svg class="amort-svg" viewBox="0 0 680 200" aria-hidden="true">
          <line x1="55" y1="20" x2="660" y2="20" class="amort-grid-line"/>
          <line x1="55" y1="90" x2="660" y2="90" class="amort-grid-line"/>
          <line x1="55" y1="160" x2="660" y2="160" class="amort-grid-line"/>
          <line x1="55" y1="160" x2="660" y2="160" class="amort-axis-base"/>

          <polygon points="${princAreaPts}" class="amort-principal-area"/>
          <polyline points="${princPts.join(" ")}" class="amort-principal-line"/>

          <polygon points="${intAreaPts}" class="amort-interest-area"/>
          <polyline points="${intPts.join(" ")}" class="amort-interest-line"/>

          <g>${markersHtml}</g>
          <g>${xLabelsHtml}</g>

          <text x="48" y="24" class="amort-axis-label" text-anchor="end">Rs. ${fmtM(maxVal)}</text>
          <text x="48" y="94" class="amort-axis-label" text-anchor="end">Rs. ${fmtM(maxVal / 2)}</text>
          <text x="48" y="164" class="amort-axis-label" text-anchor="end">Rs. 0</text>
        </svg>
      </div>
    </div>
  `;
}

// Lease details: the numbers behind one row, and the balance year by year
function openDetails(car, opener) {
  const { s, rows: [r] } = computeLeaseTable([car], readSettings());
  const limit = Math.round(s.dti * 100);
  const line = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const photo = photoForModel(car);
  const candidateCredit = creditFor(car);
  const credit = candidateCredit?.img === photo ? candidateCredit : null;
  let html = "";
  if (photo) {
    html += `<div class="detail-photo"><img src="${esc(photo)}" alt="${esc(car.name || "Vehicle")}" loading="lazy"></div>${credit ? `<div class="source-links detail-source">${formatCreditHtml(credit)}</div>` : ""}`;
  }
  html += `<p class="detail-sub">${esc(condLabel(car.cond))} · Rs. ${fmt(car.price)} · ${esc(rateLabel(s))} over ${s.n} months</p><dl class="detail-list">`;
  if (r.downPct >= 100) {
    html += line("Paid in cash", `Rs. ${fmt(car.price)}`) + "</dl><p class=\"hint\">With a 100% down payment there's no lease to repay.</p>";
    html += renderCostDonutMarkup();
  } else {
    const extras = s.fees || s.insurance;
    html += line(`Down payment (${r.downPct}%${r.downRaised ? ", the CBSL minimum for this car" : ""})`, `Rs. ${fmt(r.dp)}`) +
      (s.fees ? line("Up-front fees", `Rs. ${fmt(s.fees)}`) + line("Cash Needed Up Front", `<b>Rs. ${fmt(r.upfront)}</b>`) : "") +
      line("Amount Financed", `Rs. ${fmt(r.loan)}`) +
      line(`Monthly rental × ${s.n}`, `<b>Rs. ${fmt(r.rental)}</b>`) +
      (s.insurance ? line("Monthly cost with insurance", `Rs. ${fmt(r.monthlyCost)}`) : "") +
      line("Total Interest", `Rs. ${fmt(r.interest)}`) +
      line(`Total Paid (down payment, rentals${extras ? ", fees and insurance" : ""})`, `Rs. ${fmt(r.total)}`) +
      line(`Net Income Needed at a ${limit}% limit`, `Rs. ${fmt(r.need)}`) + "</dl>";
    html += renderCostDonutMarkup();
    const years = yearlySchedule(r.loan, s.rate, s.n);
    html += buildAmortizationSvg(r, s, years);
    html += `<h3 class="detail-h">Year by Year</h3><div class="wrap detail-wrap"><table class="detail-table"><thead><tr><th>Year</th><th class="n">Rentals paid</th><th class="n">Interest</th><th class="n">Principal</th><th class="n">Balance left</th></tr></thead><tbody>${
      years.map(y => `<tr><td>${y.year}${y.months < 12 ? ` (${y.months} months)` : ""}</td><td class="n">${fmt(y.paid)}</td><td class="n">${fmt(y.interest)}</td><td class="n">${fmt(y.principal)}</td><td class="n">${fmt(y.balance)}</td></tr>`).join("")
    }</tbody></table></div><p class="hint">Rentals use the standard reducing-balance formula with monthly compounding${s.rateType === "flat" ? "; the flat rate is converted to its reducing-balance equivalent" : ""}. ${extras ? "Fees and insurance are the amounts you entered." : "Insurance and fees are not included."}</p>`;
  }
  const specRows = [
    ["Trim / Grade", car.trim],
    ["Powertrain", car.pt && car.pt !== UNKNOWN_SPEC ? car.pt : ""],
    ["Output", [car.power, car.torque].filter(Boolean).join(" · ")],
    ["Transmission & Drive", [car.transmission, car.drivetrain].filter(Boolean).join(" · ")],
    ["Economy / Range", car.km],
    ["Dimensions & Cabin", [car.dimensions, car.groundClearance ? `${car.groundClearance} clearance` : "", car.seats ? `${car.seats} seats` : ""].filter(Boolean).join(" · ")],
    ["Safety", car.safety],
    ["Key Features", car.features],
    ["Warranty", car.warranty]
  ].filter(([, val]) => val);
  if (specRows.length) {
    html += `<h3 class="detail-h">Vehicle Specifications</h3><dl class="detail-list">${specRows.map(([k, val]) => line(esc(k), esc(val))).join("")}</dl>`;
  }
  $("detailTitle").textContent = car.name;
  $("detailBody").innerHTML = html;
  setupDetailDonut(car, r, s);
  openModal($("detailModal"), opener, $("closeDetailBtn"));
}
if ($("closeDetailBtn")) $("closeDetailBtn").addEventListener("click", () => closeModal($("detailModal")));

function renderPhotoCredits() {
  const list = $("photoCreditsList");
  if (!list || list._rendered) return;
  const entries = Object.entries(PHOTO_CREDITS).sort(([a], [b]) => a.localeCompare(b));
  list.innerHTML = entries.map(([model, credit]) => `
    <div class="credit-row">
      <span class="credit-model">${esc(model)}</span>
      <span class="credit-info">${formatCreditHtml(credit, false)}</span>
    </div>
  `).join("");
  list._rendered = true;
}

if ($("openPhotoCreditsBtn")) {
  $("openPhotoCreditsBtn").addEventListener("click", () => {
    renderPhotoCredits();
    openModal($("photoCreditsModal"), $("openPhotoCreditsBtn"), $("closePhotoCreditsBtn"));
  });
}
if ($("closePhotoCreditsBtn")) {
  $("closePhotoCreditsBtn").addEventListener("click", () => closeModal($("photoCreditsModal")));
}

// AI Search Modal UI
const closeAiModal = () => closeModal($("aiModal"));

// AI search and manual entry open from the catalogue's "Can't find your car?" line and the
// empty state; focus returns to the main "Add a vehicle" button once the catalogue has closed
function openAddFlow(tab, opener) {
  if ($("catalogueModal") && $("catalogueModal").classList.contains("open")) closeModal($("catalogueModal"));
  $("aiSearchMsg").textContent = "";
  selectTab(tab);
  openModal($("aiModal"), opener, $(tab === "ai" ? "aiSearchQuery" : "mName"));
}
$("openAiModalBtn").addEventListener("click", () => openAddFlow("ai", $("addVehicleBtn") || $("openAiModalBtn")));
if ($("openManualBtn")) $("openManualBtn").addEventListener("click", () => openAddFlow("manual", $("addVehicleBtn")));
if ($("aiEmptyBtn")) $("aiEmptyBtn").addEventListener("click", () => openAddFlow("ai", $("aiEmptyBtn")));
let screenComparisonLimit = comparisonLimit;
window.addEventListener("beforeprint", () => { screenComparisonLimit = comparisonLimit; comparisonLimit = Infinity; render(); });
window.addEventListener("afterprint", () => { comparisonLimit = screenComparisonLimit; render(); });
if ($("printBtn")) $("printBtn").addEventListener("click", () => window.print());

$("closeAiModalBtn").addEventListener("click", closeAiModal);
$("aiCancelBtn").addEventListener("click", closeAiModal);
$("mCancelBtn").addEventListener("click", closeAiModal);

// Enter key bindings
$("aiSearchQuery").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("aiSearchBtn").click();
  }
});

$("paneManual").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.tagName === "INPUT") {
    e.preventDefault();
    $("mAddBtn").click();
  }
});

function selectTab(which, focus) {
  const ai = which === "ai";
  [["tabAiBtn", ai], ["tabManualBtn", !ai]].forEach(([id, on]) => {
    $(id).classList.toggle("active", on);
    $(id).setAttribute("aria-selected", String(on));
    $(id).setAttribute("tabindex", on ? "0" : "-1");
  });
  $("paneAi").hidden = !ai;
  $("paneManual").hidden = ai;
  if (focus) $(ai ? "tabAiBtn" : "tabManualBtn").focus();
}
$("tabAiBtn").addEventListener("click", () => selectTab("ai"));
$("tabManualBtn").addEventListener("click", () => selectTab("manual"));
// Arrow keys, Home and End move between the two tabs
$("tabAiBtn").parentNode.addEventListener("keydown", e => {
  const keys = { ArrowLeft: 1, ArrowRight: 1, Home: "ai", End: "manual" };
  if (!(e.key in keys)) return;
  e.preventDefault();
  const next = keys[e.key] === 1 ? ($("tabAiBtn").getAttribute("aria-selected") === "true" ? "manual" : "ai") : keys[e.key];
  selectTab(next, true);
});

// Classified Ad / Auction Sheet Screenshot Upload & Clipboard Paste
function setAttachedAdImage(file) {
  const token = copyGeneration;
  const reader = new FileReader();
  reader.onload = evt => {
    if (token !== copyGeneration) return;
    pendingAdImage = {
      mimeType: file.type || "image/jpeg",
      data: evt.target.result.split(",")[1]
    };
    $("aiAttachedAdLabel").textContent = `📷 ${file.name || "Screenshot"} attached`;
    $("aiAttachedAdBox").hidden = false;
  };
  reader.readAsDataURL(file);
}

$("aiAdFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) setAttachedAdImage(file);
});

$("aiRemoveAdImgBtn").addEventListener("click", () => {
  pendingAdImage = null;
  $("aiAdFile").value = "";
  $("aiAttachedAdBox").hidden = true;
});

// Support paste anywhere inside aiModal
$("aiModal").addEventListener("paste", e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        setAttachedAdImage(file);
        e.preventDefault();
        break;
      }
    }
  }
});

// Search execution
$("aiSearchBtn").addEventListener("click", async () => {
  if ($("aiSearchBtn").disabled) return;
  const token = copyGeneration;
  const query = $("aiSearchQuery").value.trim();
  if (!query && !pendingAdImage) {
    $("aiSearchMsg").textContent = "Please enter a vehicle name, paste an ad, or attach a screenshot.";
    return;
  }
  $("aiSearchMsg").innerHTML = '<span class="spin"></span>Checking Sri Lankan availability, trims and prices…';
  $("aiSearchMsg").classList.remove("msg-error");
  $("aiSearchBtn").disabled = true;
  $("paneAi").setAttribute("aria-busy", "true");
  $("aiUnavailBox").hidden = true;
  $("aiResultForm").hidden = true;
  $("aiDiscoveryBox").hidden = true;

  try {
    const parsed = await searchVehicle(query, pendingAdImage);
    if (token !== copyGeneration) return;
    currentAiData = parsed;
    renderAiResults(parsed).catch(error => {
      if (token !== copyGeneration) return;
      console.error("AI result could not be displayed:", error);
      showSearchUnavailable(error);
    });
  } catch (e) {
    if (token !== copyGeneration) return;
    console.error("AI vehicle search failed:", e);
    showSearchUnavailable(e);
  } finally {
    if (token !== copyGeneration) return;
    $("aiSearchBtn").disabled = false;
    $("paneAi").removeAttribute("aria-busy");
  }
});

// Friendly fallback when AI search fails: offer manual entry instead of the raw error
function showSearchUnavailable(error) {
  const message = error?.code === "incomplete_comparison"
    ? "AI did not return a complete comparison. Search again or add each vehicle separately."
    : "AI search isn't available right now. Try again or add the car yourself.";
  $("aiSearchMsg").innerHTML = `<span class="msg-error">${message}</span> <button type="button" class="btn-outline btn-sm" id="goManualBtn">Enter Details Manually</button>`;
  const manualBtn = $("goManualBtn");
  if (manualBtn) manualBtn.addEventListener("click", () => {
    selectTab("manual");
    if (!$("mName").value) $("mName").value = $("aiSearchQuery").value.trim().slice(0, 120);
    $("mName").focus();
  });
}

async function renderAiResults(data) {
  const token = copyGeneration;
  $("aiSearchMsg").textContent = "";
  $("aiSearchMsg").classList.remove("msg-error");

  // 1. Multi-vehicle discovery / comparative query
  if (data.is_multi_vehicle && Array.isArray(data.discovered_vehicles) && data.discovered_vehicles.length > 1) {
    renderDiscoveryChecklist(data.discovered_vehicles);
    return;
  }

  // 2. Unavailable in Sri Lanka
  if (!data.is_available_in_sri_lanka) {
    $("aiUnavailBox").hidden = false;
    $("aiUnavailBox").innerHTML = `<b>⚠️ Not available in Sri Lanka:</b> ${esc(data.reason || "This model is not road-legal or actively imported into Sri Lanka.")}<br><small class="callout-alt"><b>Popular Sri Lankan alternatives:</b> ${esc(Array.isArray(data.alternatives) ? data.alternatives.join(", ") : data.alternatives || "Toyota Corolla Cross, Honda Vezel, BYD Sealion")}</small>`;
    $("aiResultForm").hidden = true;
    $("aiDiscoveryBox").hidden = true;
    return;
  }

  // 3. Single vehicle result form
  $("aiUnavailBox").hidden = true;
  $("aiDiscoveryBox").hidden = true;
  $("aiResultForm").hidden = false;

  $("aiAvailNotes").textContent = data.availability_notes || "Actively traded in Sri Lanka";
  const isOfficial = (data.import_route || "").toLowerCase().includes("official");
  $("aiRouteBadge").textContent = data.import_route || "Available in SL";
  $("aiRouteBadge").className = `callout-badge ${isOfficial ? "badge-official" : "badge-grey"}`;

  const years = data.model_years || [];
  if (!years.length) {
    $("aiYearSelect").innerHTML = '<option value="">Year not given</option>';
  } else {
    $("aiYearSelect").innerHTML = years.map(y => {
      const yVal = typeof y === "object" ? y.year : y;
      return `<option value="${yVal}">${yVal}</option>`;
    }).join("");
  }

  updateAllTrimsYearLabel();
  updateTrimDropdown();

  // Zero-touch image fetcher
  const modelName = data.model_name || $("aiSearchQuery").value.trim();
  const wikiSlug = data.wikipedia_slug || data.wikipedia_Slug || "";
  setAiImgPreview("");
  $("aiImgUrl").value = "";
  try {
    const fetchedImg = await fetchVehicleStudioImage(modelName, wikiSlug);
    if (token !== copyGeneration) return;
    if (fetchedImg && currentAiData === data) {
      ((procImg) => {
        if (currentAiData !== data) return;
        setAiImgPreview(fetchedImg);
        // Show where the photo came from, never the processed image data
        $("aiImgUrl").value = creditFor(modelName)?.sourceUrl || "";
      })(fetchedImg);
    }
  } catch (e) {
    console.warn("Studio photo resolution error:", e);
  }
}

function updateAllTrimsYearLabel() {
  const yr = $("aiYearSelect").value;
  const label = $("aiTrimsYearLabel");
  if (label) label.textContent = yr ? `for ${yr}` : "";
}

function getSelectedYearData() {
  if (!currentAiData) return null;
  const yrVal = String($("aiYearSelect").value);
  const years = currentAiData.model_years || [];
  return years.find(y => String(typeof y === "object" ? y.year : y) === yrVal) || years[0] || null;
}

function updateTrimDropdown() {
  updateAllTrimsYearLabel();
  const yData = getSelectedYearData();
  const trims = yData?.trims || [];
  if (!trims.length) {
    $("aiTrimSelect").innerHTML = '<option value="0">Standard trim</option>';
  } else {
    $("aiTrimSelect").innerHTML = trims.map((t, i) => `<option value="${i}">${esc(t.trim_name || "Trim " + (i + 1))}</option>`).join("");
  }
  updateConditionAndSpecs();
}

function getSelectedTrimData() {
  const yData = getSelectedYearData();
  const trims = yData?.trims || [];
  const idx = +$("aiTrimSelect").value || 0;
  return trims[idx] || trims[0] || {};
}

function updateConditionAndSpecs() {
  const tData = getSelectedTrimData();
  $("aiKmInput").value = tData.fuel_economy_kml || "";
  $("aiWarrSelect").value = tData.warranty_type === "Official" ? "Official" : "Grey";

  const options = [];

  // If seller price was extracted from classified ad / auction sheet
  const sellerP = currentAiData?.seller_price_lkr || 0;
  if (sellerP > 0) {
    const detCond = currentAiData?.detected_condition || "Used";
    options.push({
      id: "seller_price",
      name: "Seller's asking price (from the ad)",
      price: sellerP,
      c: detCond,
      selected: true
    });
  }

  options.push(
    { id: "brand_new", name: "Brand New (unregistered, 0 km)", c: "New" },
    { id: "recond", name: "Reconditioned (grade 4.5+, under 25,000 km)", c: "Recond" },
    { id: "used_low", name: "Registered Used (under 50,000 km)", c: "Used" },
    { id: "used_med", name: "Registered Used (50,000–100,000 km)", c: "Used" }
  );
  for (const option of options) option.price = conditionPrice(tData, option.id, sellerP);
  const selected = options.find(o => o.selected && validPrice(o.price)) || options.find(o => validPrice(o.price)) || options[0];
  $("aiCondSelect").innerHTML = options.map(o => `<option value="${o.id}" data-p="${validPrice(o.price) ? o.price : ""}" data-c="${o.c}" ${o === selected ? "selected" : ""}>${o.name}: ${validPrice(o.price) ? "Rs. " + fmt(o.price) : "no price, enter one"}</option>`).join("");
  updateSelectedPrice();
}

function updateSelectedPrice() {
  const selOpt = $("aiCondSelect").selectedOptions[0];
  const p = +selOpt?.dataset.p || 0;
  $("aiPriceInput").value = p ? fmt(p) : "";
  $("aiPriceInput").removeAttribute("aria-invalid");
  $("aiSearchMsg").textContent = "";
  $("aiSearchMsg").classList.remove("msg-error");
}

$("aiYearSelect").addEventListener("change", updateTrimDropdown);
$("aiTrimSelect").addEventListener("change", updateConditionAndSpecs);
$("aiCondSelect").addEventListener("change", updateSelectedPrice);
$("aiResetPriceBtn").addEventListener("click", updateSelectedPrice);

function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const s = url.trim();
  return /^https:\/\//i.test(s) || /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(s);
}

function setAiImgPreview(src) {
  const trimmed = src ? photoForModel(currentAiData?.model_name || "") : "";
  currentAiImgSrc = trimmed || "";
  const preview = $("aiImgPreview");
  const previewBox = preview.closest(".preview-box");
  let existingPh = previewBox.querySelector(".pimg-ph");

  if (!currentAiImgSrc) {
    preview.removeAttribute("src");
    preview.hidden = true;
    if (!existingPh) {
      existingPh = document.createElement("div");
      existingPh.className = "ph pimg-ph";
      existingPh.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="3"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M14 21v-4a2 2 0 0 0-4 0v4"/></svg><span>No photo</span>`;
      preview.parentNode.insertBefore(existingPh, preview);
    }
    existingPh.hidden = false;
  } else {
    if (existingPh) existingPh.hidden = true;
    preview.hidden = false;
    preview.src = currentAiImgSrc;
  }
}

$("aiImgPreview").addEventListener("error", () => {
  setAiImgPreview("");
});

$("aiImgUrl").addEventListener("input", e => {
  setAiImgPreview(e.target.value);
});

$("aiImgFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    setAiImgPreview(evt.target.result);
    $("aiImgUrl").value = "";
  };
  reader.readAsDataURL(file);
});

$("aiConfirmAddBtn").addEventListener("click", () => {
  const tData = getSelectedTrimData();
  const yr = $("aiYearSelect").value;
  const trimName = tData.trim_name || "";
  const modelName = currentAiData.model_name || $("aiSearchQuery").value.trim();
  const fullName = formatVehicleTitle(modelName, trimName, yr);
  const price = num($("aiPriceInput").value);
  if (!validPrice(price)) {
    showVehicleError("Enter a valid price greater than zero before adding this vehicle.");
    $("aiPriceInput").setAttribute("aria-invalid", "true");
    $("aiPriceInput").focus();
    return;
  }
  const condOpt = $("aiCondSelect").selectedOptions[0];
  const cond = condOpt?.dataset.c || "New";
  const w = $("aiWarrSelect").value;
  const km = $("aiKmInput").value.trim();
  const pt = tData.powertrain || "";

  // Mark where the price came from: the seller's ad, an AI estimate, or the user's own figure
  const offered = +condOpt?.dataset.p || 0;
  const priceBasis = price !== offered ? "user-entered" : condOpt?.value === "seller_price" ? "seller-listed" : "ai-estimate";
  normaliseCurrentImage(currentAiImgSrc, procImg => {
    if (!addCars([{
      name: fullName,
      pt: pt,
      km: km,
      w: w,
      price: price,
      cond: cond,
      img: procImg,
      custom: true,
      priceBasis
    }])) return;
    saveCars(cars);
    render();
    closeAiModal();
  });
});

$("aiAddAllTrimsBtn").addEventListener("click", () => {
  const yData = getSelectedYearData();
  const yr = $("aiYearSelect").value;
  const modelName = currentAiData?.model_name || $("aiSearchQuery").value.trim();
  const trims = yData?.trims || [];
  if (!trims.length) {
    $("aiConfirmAddBtn").click();
    return;
  }

  const condOpt = $("aiCondSelect").selectedOptions[0];
  const condId = $("aiCondSelect").value;
  const cond = condOpt?.dataset.c || "New";

  if (condId === "seller_price" && trims.length > 1) {
    showVehicleError("The listed price applies to this vehicle only. Add it individually or select a market condition for all trims.");
    return;
  }
  const batch = trims.map(t => ({
    name: formatVehicleTitle(modelName, t.trim_name, yr),
    pt: t.powertrain || "",
    km: t.fuel_economy_kml || "",
    w: t.warranty_type || "Grey",
    price: conditionPrice(t, condId, currentAiData?.seller_price_lkr),
    cond, custom: true, priceBasis: "ai-estimate"
  }));
  const error = vehicleBatchError(batch);
  if (error) { showVehicleError(error + " Select another condition or add trims individually with a price."); return; }

  normaliseCurrentImage(currentAiImgSrc, procImg => {
    if (!addCars(batch.map(car => ({ ...car, img: procImg })))) return;
    saveCars(cars);
    render();
    closeAiModal();
  });
});

// Multi-vehicle Discovery Checklist Implementation
function renderDiscoveryChecklist(vehicles) {
  currentDiscoveredVehicles = vehicles;
  $("aiUnavailBox").hidden = true;
  $("aiResultForm").hidden = true;
  $("aiDiscoveryBox").hidden = false;
  $("aiDiscoveryTitle").textContent = `${vehicles.length} Vehicles Match Your Search`;

  const listContainer = $("aiDiscoveryList");
  listContainer.innerHTML = vehicles.map((v, i) => {
    const title = formatVehicleTitle(v.model_name, v.trim_name, v.year);
    const condLabel = v.condition === "Used" ? "Registered Used" : v.condition === "Recond" ? "Reconditioned" : "Brand New";
    return `<label class="discovery-item selected" data-i="${i}">
      <input type="checkbox" class="disc-check" data-idx="${i}" checked>
      <img class="discovery-thumb" id="discThumb${i}" alt="${esc(title)}" hidden>
      <div class="discovery-body">
        <div class="discovery-title">
          <b>${esc(title)}</b>
          <b class="discovery-price">Rs. ${fmt(v.price_lkr)}</b>
        </div>
        <div class="discovery-spec">${esc(v.powertrain || "")}${v.fuel_economy_kml ? " · " + esc(v.fuel_economy_kml) : ""}</div>
        <div class="discovery-tags">
          <span class="callout-badge ${v.warranty_type === "Official" ? "badge-official" : "badge-grey"}">${esc(v.warranty_type || "Grey")}</span>
          <span class="cond-tag">${condLabel}</span>
        </div>
      </div>
    </label>`;
  }).join("");

  updateSelectedCount();

  // Async load thumbnails
  const token = copyGeneration;
  vehicles.forEach(async (v, i) => {
    try {
      const imgUrl = await fetchVehicleStudioImage(v.model_name, v.wikipedia_slug);
      if (token !== copyGeneration) return;
      const imgEl = $(`discThumb${i}`);
      if (imgEl && imgUrl) {
        normaliseCurrentImage(imgUrl, normalized => {
          if (imgEl) { imgEl.src = normalized || imgUrl; imgEl.hidden = false; }
        });
      }
    } catch (e) {}
  });
}

function updateSelectedCount() {
  const checked = document.querySelectorAll(".disc-check:checked").length;
  $("aiAddSelectedBtn").textContent = `Add Selected (${checked}) to Comparison`;
}

$("aiDiscoveryList").addEventListener("change", e => {
  if (e.target.classList.contains("disc-check")) {
    const item = e.target.closest(".discovery-item");
    if (item) item.classList.toggle("selected", e.target.checked);
    updateSelectedCount();
  }
});

$("aiToggleSelectAllBtn").addEventListener("click", () => {
  const checks = document.querySelectorAll(".disc-check");
  const anyUnchecked = [...checks].some(c => !c.checked);
  checks.forEach(c => {
    c.checked = anyUnchecked;
    c.closest(".discovery-item")?.classList.toggle("selected", anyUnchecked);
  });
  updateSelectedCount();
});

$("aiDiscoveryBackBtn").addEventListener("click", () => {
  $("aiDiscoveryBox").hidden = true;
  $("aiResultForm").hidden = true;
  $("aiSearchQuery").focus();
});

$("aiAddSelectedBtn").addEventListener("click", () => {
  const checks = document.querySelectorAll(".disc-check:checked");
  if (!checks.length) {
    showVehicleError("Select at least one vehicle to add.");
    return;
  }

  const batch = [];
  for (const c of checks) {
    const idx = +c.dataset.idx;
    const v = currentDiscoveredVehicles[idx];
    if (!v) continue;
    const title = formatVehicleTitle(v.model_name, v.trim_name, v.year);
    const thumbEl = $(`discThumb${idx}`);
    const rawImg = thumbEl?.getAttribute("src") || "";

    batch.push({
      name: title,
      pt: v.powertrain || "",
      km: v.fuel_economy_kml || "",
      w: v.warranty_type || "Grey",
      price: v.price_lkr,
      cond: v.condition || "New",
      img: rawImg,
      custom: true, priceBasis: "ai-estimate"
    });
  }

  if (!addCars(batch)) return;
  saveCars(cars);
  render();
  closeAiModal();
});

// Quick Manual Entry Add Button
function setManualError(field, message) {
  for (const id of ["mName", "mPrice"]) {
    $(id).removeAttribute("aria-invalid");
    $(id).removeAttribute("aria-describedby");
  }
  $("mErr").textContent = message || "";
  if (field) {
    $(field).setAttribute("aria-invalid", "true");
    $(field).setAttribute("aria-describedby", "mErr");
    $(field).focus();
  }
}

$("mName").addEventListener("input", () => { if ($("mName").getAttribute("aria-invalid")) setManualError(null, ""); });
$("mPrice").addEventListener("input", () => { if ($("mPrice").getAttribute("aria-invalid")) setManualError(null, ""); });

$("mAddBtn").addEventListener("click", () => {
  const name = $("mName").value.trim();
  const price = num($("mPrice").value);
  if (!name) { setManualError("mName", "Enter a vehicle name."); return; }
  if (!validPrice(price)) { setManualError("mPrice", "Enter a valid price greater than zero."); return; }
  setManualError(null, "");
  const cond = $("mCond").value;
  const w = $("mWarr").value;
  const pt = $("mPt").value.trim() || "Custom entry";
  const rawImg = photoForModel(name);

  normaliseCurrentImage(rawImg, procImg => {
    if (!addCars([{
      name: name,
      pt: pt,
      km: "",
      w: w,
      price: price,
      cond: cond,
      img: procImg,
      custom: true
    }])) return;
    saveCars(cars);
    render();
    $("mName").value = ""; $("mPrice").value = ""; $("mImgUrl").value = "";
    closeAiModal();
  });
});

// Theme: System follows the device's light or dark setting (no data-theme, so the CSS media
// query decides, live); Light or Dark is saved in this browser and set on <html>. The inline
// script in index.html applies a saved choice before the page paints.
const THEME_KEY = "vahanaiq_theme";
const themeMetas = typeof document.querySelectorAll === "function" ? [...document.querySelectorAll('meta[name="theme-color"]')] : [];
themeMetas.forEach(m => { m.dataset.content = m.content; });

function applyTheme(choice) {
  const root = document.documentElement;
  if (root && typeof root.setAttribute === "function") {
    if (choice === "light" || choice === "dark") root.setAttribute("data-theme", choice);
    else root.removeAttribute("data-theme");
  }
  // The browser's toolbar colour follows a fixed choice too
  const fixed = themeMetas.find(m => {
    const media = m.getAttribute?.("media") || m.media || "";
    return media.includes(choice);
  });
  themeMetas.forEach(m => {
    const def = m.dataset?.content || m.getAttribute?.("content") || m.content || "";
    m.content = fixed ? (fixed.dataset?.content || fixed.getAttribute?.("content") || fixed.content || def) : def;
  });
  const radio = document.querySelector?.(`input[name="theme"][value="${choice}"]`);
  if (radio) radio.checked = true;
}

let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
applyTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system");

document.addEventListener("change", e => {
  if (e.target.name !== "theme") return;
  const choice = e.target.value;
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch (err) {}
  applyTheme(choice);
});

const themeSwitchEl = $("themeSwitch");
if (themeSwitchEl) {
  themeSwitchEl.addEventListener("change", e => {
    const radio = themeSwitchEl.querySelector('input[name="theme"]:checked');
    if (!radio) return;
    const choice = radio.value;
    try {
      if (choice === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, choice);
    } catch (err) {}
    applyTheme(choice);
  });
  themeSwitchEl.addEventListener("click", e => {
    const label = e.target.closest("label");
    if (!label) return;
    const input = label.querySelector('input[name="theme"]');
    if (input && !input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

// Footer: catalogue availability and individual prices have separate evidence dates.
$("appVersion").textContent = APP_VERSION;
$("priceAsOf").textContent = "Prices checked on 21 Oct 2026. Unsubstantiated amounts are omitted; enter a quote to calculate. Confirm stock and final terms with the seller.";

refreshCatalogue = initCatalogue({
  terms: () => { const s = readSettings(); return { f: rental(1, s.rate, s.n), down: s.down, income: s.income, room: s.income ? s.income * s.dti - s.debt - (s.insurance || 0) / 12 : -1 }; },
  isSelected: id => cars.some(c => c.catalogueId === id && !c.hidden),
  onAddBatch(batch, skipped) {
    if (!addCars(batch)) return false;
    const added = new Set(batch.map(v => v.id));
    saveCars(cars); render();
    const unverified = batch.filter(v => !['published', 'starting'].includes(v.priceBasis)).length;
    const undo = showToast(`Added ${batch.length} vehicles.${skipped ? ` ${skipped} need a quote and were left out.` : ''}${unverified ? ` ${unverified} amounts are unverified estimates.` : ''}`, 'Undo', () => {
      cars = cars.filter(v => !added.has(v.id)); saveCars(cars); render(); $('h-list').focus();
    });
    if (undo) undo.focus();
    return true;
  },
  onAdd: vehicle => {
    if (cars.some(c => c.catalogueId === vehicle.catalogueId && !c.hidden)) return false;
    if (!addCars([vehicle])) return false;
    saveCars(cars);
    render();
    showToast(`Added ${vehicle.name} to your comparison.`);
    return true;
  }
});
if ($('showMoreVehicles')) $('showMoreVehicles').addEventListener('click', () => { comparisonLimit += 24; render(); });
if ($('toggleTerms')) $('toggleTerms').addEventListener('click', () => {
  const open = $('toggleTerms').getAttribute('aria-expanded') !== 'true';
  $('toggleTerms').setAttribute('aria-expanded', String(open));
  $('loanTermsGrid').classList.toggle('mobile-collapsed', !open);
  $('toggleTerms').textContent = open ? 'Done' : 'Edit';
});

// --- Sharing: a link carries inputs and vehicles (catalogue cars by ID, others in full);
// income and existing payments only when the person ticks the box

function shareableCars() {
  return cars.filter(c => !c.hidden).map(c => c.catalogueId
    ? { c: c.catalogueId, p: c.price, k: c.cond }
    : { n: c.name, p: c.price, k: c.cond, w: c.w, t: c.pt || "", ...( /^https:\/\//.test(c.img || "") ? { i: c.img } : {}) });
}

function carFromShare(item) {
  if (!item || typeof item !== "object" || !validPrice(+item.p)) return null;
  const cond = ["New", "Recond", "Recent", "Used"].includes(item.k) ? item.k : "New";
  const entry = item.c && marketCatalogue.find(v => v.id === item.c);
  if (entry) {
    const published = +item.p === entry.price && cond === entry.cond;
    return { ...entry, id: newVehicleId(), catalogueId: entry.id, price: +item.p, cond, custom: true,
      priceBasis: published ? entry.priceBasis : "user-entered", priceSourceUrl: published ? entry.priceSourceUrl : null };
  }
  if (typeof item.n !== "string" || !item.n.trim()) return null;
  return { id: newVehicleId(), name: item.n.trim().slice(0, 120), price: +item.p, cond, w: item.w === "Official" ? "Official" : item.w === "Grey" ? "Grey" : "Unknown",
    pt: String(item.t || "").slice(0, 80), km: "", img: /^https:\/\//.test(item.i || "") ? item.i : "", custom: true, priceBasis: "user-entered" };
}

function updateShareLink() {
  const shared = shareableCars();
  $("shareLink").value = buildShareLink(currentState(), shared.slice(0,30), $("shareIncome").checked);
  $("shareStatus").textContent = shared.length > 30 ? `This link includes the first 30 of ${shared.length} vehicles to keep it manageable. Your full comparison stays saved here.` : `This link includes ${shared.length} vehicles.`;
}

if ($("shareBtn")) {
  $("shareBtn").addEventListener("click", () => {
    $("shareIncome").checked = false;
    updateShareLink();
    openModal($("shareModal"), $("shareBtn"), $("copyShareBtn"));
  });
  $("shareIncome").addEventListener("change", updateShareLink);
  for (const id of ["closeShareBtn", "cancelShareBtn"]) $(id).addEventListener("click", () => closeModal($("shareModal")));
  $("copyShareBtn").addEventListener("click", async () => {
    const link = $("shareLink").value;
    try {
      await navigator.clipboard.writeText(link);
      $("shareStatus").textContent = "Link copied." + (shareableCars().length > 30 ? " Includes the first 30 vehicles." : "");
    } catch (e) {
      $("shareLink").select();
      $("shareStatus").textContent = "Select the link above and copy it.";
    }
  });
}

// Offline support (see sw.js); browsers without service workers simply skip it
if (typeof navigator !== "undefined" && "serviceWorker" in navigator && window.location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(e => console.warn("Offline support unavailable:", e));
}

applyState(loadState());
refreshPlanner = initPlanner({
  vehicles: () => [...cars.filter(c => !c.hidden), ...marketCatalogue.filter(v => !cars.some(c => c.catalogueId === v.id && !c.hidden))],
  settings: readSettings
});

// A shared link's vehicles: loaded when the comparison is empty, otherwise offered
const sharedCars = sharedCarsFromUrl().map(carFromShare).filter(Boolean);
cleanUrl();
if (sharedCars.length) {
  const word = sharedCars.length === 1 ? "1 vehicle" : `${sharedCars.length} vehicles`;
  const addShared = () => {
    const fresh = sharedCars.filter(n => !cars.some(c => (n.catalogueId && c.catalogueId === n.catalogueId) || (c.name === n.name && c.price === n.price)));
    if (fresh.length && addCars(fresh)) saveCars(cars);
    render();
  };
  if (!cars.some(c => !c.hidden)) {
    addShared();
    showToast(`Opened a shared comparison with ${word}.`);
  } else {
    showToast(`This link has ${word}.`, "Add Them", addShared);
  }
}
render();

// Signing in syncs these inputs and vehicles with the person's account (see js/account.js)
initAccount({
  beforeApply() {
    copyGeneration++;
    clearToast();
    clearState();
    for (const id of ['detailModal', 'shareModal', 'aiModal', 'catalogueAddModal']) {
      const modal = $(id);
      if (modal && isOpen(modal)) closeModal(modal);
    }
    $('detailBody').textContent = '';
    currentAiData = null; currentAiImgSrc = ''; pendingAdImage = null; currentDiscoveredVehicles = [];
    for (const id of ['aiSearchQuery','aiPriceInput','aiKmInput','aiImgUrl','aiAdFile','mName','mPrice','mPt','mImgUrl','catalogueName','cataloguePrice','shareLink']) $(id).value = '';
    for (const id of ['aiSearchMsg','aiDiscoveryList','aiAttachedAdLabel']) $(id).textContent = '';
    $('shareIncome').checked = false;
    window.dispatchEvent(new Event('vahanaiq:copy-reset'));
    $('aiSearchBtn').disabled = false;
    $('paneAi').removeAttribute('aria-busy');
    for (const id of ['aiResultForm','aiDiscoveryBox','aiAttachedAdBox']) $(id).hidden = true;
    $('plannerName').value = '';
  },
  reload() {
    cars = loadSavedCars(baseVehicles);
    cars.forEach(assignKey);
    applyState(loadState());
    window.dispatchEvent(new Event('vahanaiq:planner-reload'));
    render();
  }
});
if (invalidSavedCount) showToast("Some saved vehicles had invalid prices and were left out. Add them again with a valid price.");

// Source guidance opens from the footer link on either page; the header no longer carries a button.
for (const id of ["sourceGuide", "footerSourceGuide"]) {
  if ($(id)) $(id).addEventListener("click", () => $("guide")?.showModal());
}
if ($("closeGuide")) $("closeGuide").addEventListener("click", () => $("guide")?.close());

function checkUrlHash() {
  if (window.location.hash === "#openAdd") {
    setTimeout(() => openAddFlow("ai", $("addVehicleBtn")), 60);
  } else if (window.location.hash === "#account") {
    setTimeout(() => { if (!isOpen($("accountModal"))) openModal($("accountModal"), $("accountBtn")); }, 60);
  }
}
checkUrlHash();
window.addEventListener("hashchange", checkUrlHash);
