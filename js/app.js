import { fmt, esc, num, computeLeaseTable, rental, yearlySchedule, rateLabel, CONDITIONS } from "./calculator.js?v=2.10.0";
import { baseVehicles } from "./catalog.js?v=2.10.0";
import { initCatalogue } from "./catalogue-browser.js?v=2.10.0";
import { APP_VERSION } from "./config.js?v=2.10.0";
import { normalizeImageToStudio } from "./canvas-utils.js?v=2.10.0";
import { searchVehicle } from "./gemini.js?v=2.10.0";
import { fetchVehicleStudioImage, NO_PHOTO } from "./image-fetcher.js?v=2.10.0";
import { clearLegacyKeys, loadSavedCars, saveCars, newVehicleId } from "./storage.js?v=2.10.0";
import { openModal, closeModal } from "./modal.js?v=2.10.0";
import { FIELDS, readSettings, fieldError, snapField, clearSnapNote, loadState, saveState, clearState, sharedCarsFromUrl, cleanUrl, buildShareLink } from "./inputs.js?v=2.10.0";
import { baseVehicles as marketCatalogue } from "./market-catalogue.js?v=2.10.0";
import { showToast } from "./toast.js?v=2.10.0";
import { initAccount } from "./account.js?v=2.10.0";
import { attachMoneyInput, formatMoneyText } from "./money-input.js?v=2.10.0";
import { validPrice, vehicleBatchError, conditionPrice } from "./vehicle-validation.js?v=2.10.0";

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
  ["dp", "Down payment", "n"],
  ["rental", "Monthly rental", "n"],
  ["bar", "Share of your budget"],
  ["interest", "Total interest", "n secondary"],
  ["total", "Total outlay", "n secondary"],
  ["need", "Income needed", "n"],
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
    return `<div class="stat"><b>Rs. ${fmt(room)}</b><span>Highest monthly rental at a ${limit}% limit${s.debt ? " after existing payments" : ""}</span></div>
<div class="stat"><b>Rs. ${fmt(maxPrice)}</b><span>Highest vehicle price you can finance with ${s.down}% down${s.down < 60 ? " (cars registered over a year only)" : ""}</span></div>
<div class="stat"><b>Rs. ${fmt(maxPrice * s.down / 100 + (s.fees || 0))}</b><span>Cash needed up front for that vehicle${s.fees ? ", with fees" : ""}</span></div>`;
  }
  if (s.down >= 100) {
    return `<div class="stat"><b>Rs. 0.00</b><span>Monthly rental (100% down payment)</span></div>
<div class="stat"><b>100% Cash</b><span>Zero lease financing needed</span></div>
<div class="stat"><span>Enter your net monthly income above to evaluate affordability and budget room.</span></div>`;
  }
  return `<div class="stat"><b>Rs. ${fmt(1e6 * f * (1 - s.down / 100))}</b><span>Monthly rental for every Rs. 1.00 million of vehicle price</span></div>
<div class="stat"><b>Rs. ${fmt(1e6 * f * (1 - s.down / 100) / s.dti)}</b><span>Net income needed per Rs. 1.00 million of price at a ${limit}% limit</span></div>
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
<td class="n v-interest secondary" data-label="Total interest (Rs.)"></td>
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
  if (slot._img === r.img && slot._alt === r.name) return;
  slot._img = r.img;
  slot._alt = r.name;
  slot.innerHTML = NO_PHOTO;
  if (!r.img) return;
  const img = new Image();
  img.loading = "lazy";
  img.alt = r.name;
  img.addEventListener("error", () => { slot.innerHTML = NO_PHOTO; });
  img.src = r.img;
  slot.replaceChildren(img);
}

function updateRow(tr, r, { s, room, scale, labels }) {
  const q = sel => tr.querySelector(sel);
  const cl = condLabel(r.cond);
  setThumb(tr, r);
  q(".v-name").textContent = r.name;
  setHtml(q(".v-spec"), [r.pt, r.km].filter(t => t && t !== UNKNOWN_SPEC).map(t => `<span class="spec">${esc(t)}</span>`).join(" · "));
  q(".v-warr").textContent = r.w === "Official" ? "Official agent" : r.w === "Grey" ? "Grey import" : "Route unconfirmed";
  const basis = { "user-entered": "Your price", "ai-estimate": "AI estimate: confirm with the seller", "seller-listed": "Seller's asking price" };
  if (r.legacy) q(".v-warr").textContent += " · Saved estimate: verify price";
  else if (r.priceBasis) q(".v-warr").textContent += " · " + (basis[r.priceBasis] || "Confirm current quote");
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
  const settings = readSettings();
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
      if (r.rental > room) return false;
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

  const maxRent = Math.max(1, ...rows.map(r => r.rental));
  const scale = s.income ? Math.max(room, maxRent) : maxRent;
  const labels = { ok: "Comfortable", mid: "Stretching", bad: "Out of reach", na: "" };

  const hasCars = cars.some(c => !c.hidden);
  $("resetCatalogWrap").hidden = !cars.length;
  if ($("emptyState")) $("emptyState").hidden = hasCars;
  if ($("comparisonBody")) $("comparisonBody").hidden = !hasCars;
  if ($("openCatalogueBtn")) $("openCatalogueBtn").hidden = !hasCars;
  if ($("affordOption")) $("affordOption").textContent = `Only those within my ${Math.round(s.dti * 100)}% limit`;
  refreshCatalogue();

  const ctx = { s, room, scale, labels };
  const tbody = $("rows");
  const wanted = list.map(r => {
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
    legend.innerHTML = `<span><span class="legend-tick" aria-hidden="true"></span>Your limit: ${limit}% of income${s.debt ? " after existing payments" : ""}</span>
<span>Rental plus existing payments: <span class="tag ok">Comfortable</span> up to 40% · <span class="tag mid">Stretching</span> 40–50% · <span class="tag bad">Out of reach</span> over 50%</span>`;
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
    const ok = rows.filter(r => r.rental <= room).length;
    sentence = `Highest monthly rental Rs. ${fmt(room)}. Highest vehicle price Rs. ${fmt(maxPrice)}. ${ok} of ${rows.length} vehicles fit your budget.`;
    bar = `Max rental Rs. ${fmt(room)} · Max price Rs. ${fmt(maxPrice)}`;
  }
  budgetBarText = bar;
  $("budgetBar").textContent = bar;
  syncBudgetBar();
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { $("budgetLive").textContent = sentence; }, 500);
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
}

// Global Event Listeners
const isTermsField = el => el.closest && el.closest(".panel") && !el.closest(".modal");

document.addEventListener("input", e => {
  if (e.target.id === "sort" && e.target.value) {
    const [k, d] = e.target.value.split("|");
    sortKey = k; sortDir = +d;
  }
  if (e.target.tagName === "SELECT") return; // Let change handler process select elements
  if (e.target.id) clearSnapNote(e.target.id);
  if (isTermsField(e.target)) render();
});

document.addEventListener("change", e => {
  if (e.target.id === "sort" && e.target.value) {
    const [k, d] = e.target.value.split("|");
    sortKey = k; sortDir = +d;
  }
  if (e.target.id === "tenure" || e.target.id === "down") snapField(e.target.id);
  if (isTermsField(e.target)) render();
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
    car.custom = true;
    car.priceBasis = "user-entered";
    car.priceSourceUrl = null;
    saveCars(cars);
    render();
    focusRowControl(key, "cond");
    // The price was for the old condition, so offer to change it
    showToast(`${car.name} is now ${condLabel(car.cond)}. Check its price for this condition.`, "Edit price", () => {
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

// Lease details: the numbers behind one row, and the balance year by year
function openDetails(car, opener) {
  const { s, rows: [r] } = computeLeaseTable([car], readSettings());
  const limit = Math.round(s.dti * 100);
  const line = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  let html = `<p class="detail-sub">${esc(condLabel(car.cond))} · Rs. ${fmt(car.price)} · ${esc(rateLabel(s))} over ${s.n} months</p><dl class="detail-list">`;
  if (r.downPct >= 100) {
    html += line("Paid in cash", `Rs. ${fmt(car.price)}`) + "</dl><p class=\"hint\">With a 100% down payment there's no lease to repay.</p>";
  } else {
    const extras = s.fees || s.insurance;
    html += line(`Down payment (${r.downPct}%${r.downRaised ? ", the CBSL minimum for this car" : ""})`, `Rs. ${fmt(r.dp)}`) +
      (s.fees ? line("Up-front fees", `Rs. ${fmt(s.fees)}`) + line("Cash needed up front", `<b>Rs. ${fmt(r.upfront)}</b>`) : "") +
      line("Amount financed", `Rs. ${fmt(r.loan)}`) +
      line(`Monthly rental × ${s.n}`, `<b>Rs. ${fmt(r.rental)}</b>`) +
      (s.insurance ? line("Monthly cost with insurance", `Rs. ${fmt(r.monthlyCost)}`) : "") +
      line("Total interest", `Rs. ${fmt(r.interest)}`) +
      line(`Total paid (down payment, rentals${extras ? ", fees and insurance" : ""})`, `Rs. ${fmt(r.total)}`) +
      line(`Net income needed at a ${limit}% limit`, `Rs. ${fmt(r.need)}`) + "</dl>";
    const years = yearlySchedule(r.loan, s.rate, s.n);
    html += `<h3 class="detail-h">Year by year</h3><div class="wrap detail-wrap"><table class="detail-table"><thead><tr><th>Year</th><th class="n">Rentals paid</th><th class="n">Interest</th><th class="n">Principal</th><th class="n">Balance left</th></tr></thead><tbody>${
      years.map(y => `<tr><td>${y.year}${y.months < 12 ? ` (${y.months} months)` : ""}</td><td class="n">${fmt(y.paid)}</td><td class="n">${fmt(y.interest)}</td><td class="n">${fmt(y.principal)}</td><td class="n">${fmt(y.balance)}</td></tr>`).join("")
    }</tbody></table></div><p class="hint">Rentals use the standard reducing-balance formula with monthly compounding${s.rateType === "flat" ? "; the flat rate is converted to its reducing-balance equivalent" : ""}. ${extras ? "Fees and insurance are the amounts you entered." : "Insurance and fees are not included."}</p>`;
  }
  $("detailTitle").textContent = car.name;
  $("detailBody").innerHTML = html;
  openModal($("detailModal"), opener, $("closeDetailBtn"));
}
if ($("closeDetailBtn")) $("closeDetailBtn").addEventListener("click", () => closeModal($("detailModal")));

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
  const reader = new FileReader();
  reader.onload = evt => {
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
    currentAiData = parsed;
    renderAiResults(parsed).catch(error => {
      console.error("AI result could not be displayed:", error);
      showSearchUnavailable(error);
    });
  } catch (e) {
    console.error("AI vehicle search failed:", e);
    showSearchUnavailable(e);
  } finally {
    $("aiSearchBtn").disabled = false;
    $("paneAi").removeAttribute("aria-busy");
  }
});

// Friendly fallback when AI search fails: offer manual entry instead of the raw error
function showSearchUnavailable(error) {
  const message = error?.code === "incomplete_comparison"
    ? "AI did not return a complete comparison. Search again or add each vehicle separately."
    : "AI search isn't available right now. Try again or add the car yourself.";
  $("aiSearchMsg").innerHTML = `<span class="msg-error">${message}</span> <button type="button" class="btn-outline btn-sm" id="goManualBtn">Enter details manually</button>`;
  $("goManualBtn").addEventListener("click", () => {
    selectTab("manual");
    if (!$("mName").value) $("mName").value = $("aiSearchQuery").value.trim().slice(0, 120);
    $("mName").focus();
  });
}

async function renderAiResults(data) {
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
    if (fetchedImg && currentAiData === data) {
      normalizeImageToStudio(fetchedImg, procImg => {
        if (currentAiData !== data) return;
        setAiImgPreview(procImg || fetchedImg);
        // Show where the photo came from, never the processed image data
        $("aiImgUrl").value = /^https?:\/\//.test(fetchedImg) ? fetchedImg : "";
      });
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

function setAiImgPreview(src) {
  currentAiImgSrc = (src && src.trim() && src !== window.location.href) ? src.trim() : "";
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
  normalizeImageToStudio(currentAiImgSrc, procImg => {
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

  normalizeImageToStudio(currentAiImgSrc, procImg => {
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
  $("aiDiscoveryTitle").textContent = `${vehicles.length} vehicles match your search`;

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
          <span class="callout-badge ${v.warranty_type === "Official" ? "badge-official" : "badge-grey"}">${v.warranty_type || "Grey"}</span>
          <span class="cond-tag">${condLabel}</span>
        </div>
      </div>
    </label>`;
  }).join("");

  updateSelectedCount();

  // Async load thumbnails
  vehicles.forEach(async (v, i) => {
    try {
      const imgUrl = await fetchVehicleStudioImage(v.model_name, v.wikipedia_slug);
      const imgEl = $(`discThumb${i}`);
      if (imgEl && imgUrl) {
        normalizeImageToStudio(imgUrl, normalized => {
          if (imgEl) { imgEl.src = normalized || imgUrl; imgEl.hidden = false; }
        });
      }
    } catch (e) {}
  });
}

function updateSelectedCount() {
  const checked = document.querySelectorAll(".disc-check:checked").length;
  $("aiAddSelectedBtn").textContent = `Add selected (${checked}) to comparison`;
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
  const rawImg = $("mImgUrl").value.trim();

  normalizeImageToStudio(rawImg, procImg => {
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
  const fixed = themeMetas.find(m => m.media.includes(choice));
  themeMetas.forEach(m => { m.content = fixed ? fixed.dataset.content : m.dataset.content; });
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

// Footer: catalogue availability and individual prices have separate evidence dates.
$("appVersion").textContent = APP_VERSION;
$("priceAsOf").textContent = "Catalogue sources checked 20/10/2026 · confirm prices and stock with the seller";

refreshCatalogue = initCatalogue({
  terms: () => { const s = readSettings(); return { f: rental(1, s.rate, s.n), down: s.down }; },
  isSelected: id => cars.some(c => c.catalogueId === id && !c.hidden),
  onAdd: vehicle => {
    if (cars.some(c => c.catalogueId === vehicle.catalogueId && !c.hidden)) return false;
    if (!addCars([vehicle])) return false;
    saveCars(cars);
    render();
    showToast(`Added ${vehicle.name} to your comparison.`);
    return true;
  }
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
  $("shareLink").value = buildShareLink(currentState(), shareableCars(), $("shareIncome").checked);
  $("shareStatus").textContent = "";
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
      $("shareStatus").textContent = "Link copied.";
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
    showToast(`This link has ${word}.`, "Add them", addShared);
  }
}
render();

// Signing in syncs these inputs and vehicles with the person's account (see js/account.js)
initAccount({
  reload() {
    cars = loadSavedCars(baseVehicles);
    cars.forEach(assignKey);
    applyState(loadState());
    render();
  }
});
if (invalidSavedCount) showToast("Some saved vehicles had invalid prices and were left out. Add them again with a valid price.");
