import { fmt, esc, num, computeLeaseTable, DOWN_MIN_UNREG } from "./calculator.js?v=2.7.0";
import { baseVehicles, catalogMeta } from "./catalog.js?v=2.7.0";
import { APP_VERSION } from "./config.js?v=2.7.0";
import { normalizeImageToStudio } from "./canvas-utils.js?v=2.7.0";
import { searchVehicle } from "./gemini.js?v=2.7.0";
import { fetchVehicleStudioImage } from "./image-fetcher.js?v=2.7.0";
import { clearLegacyKeys, cloneBaseCars, loadSavedCars, saveCars } from "./storage.js?v=2.7.0";
import { openModal, closeModal } from "./modal.js?v=2.7.0";
import { FIELDS, readSettings, fieldError, snapField, clearSnapNote, loadState, saveState, clearState } from "./inputs.js?v=2.7.0";
import { showToast } from "./toast.js?v=2.7.0";
import { attachMoneyInput } from "./money-input.js?v=2.7.0";

clearLegacyKeys();

const $ = id => document.getElementById(id);

let cars = loadSavedCars(baseVehicles);
let sortKey = "price", sortDir = -1;
let currentAiData = null;
let currentAiImgSrc = "";
let pendingAdImage = null;
let currentDiscoveredVehicles = [];

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
  ["rental", "Monthly rental", "n"],
  ["bar", "Share of your budget"],
  ["interest", "Total interest", "n"],
  ["total", "Total outlay", "n"],
  ["need", "Income needed", "n"],
  ["status", "Status"]
];

const condLabels = { New: "Brand New", Recond: "Reconditioned", Used: "Registered Used" };
const condLabel = c => condLabels[c] || condLabels.New;
const NO_PHOTO = '<div class="ph"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.55" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="3"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M14 21v-4a2 2 0 0 0-4 0v4"/></svg><span>No photo</span></div>';

function summaryHtml(s, f, room) {
  const limit = Math.round(s.dti * 100);
  if (s.income) {
    if (s.down >= 100) {
      return `<div class="stat"><b>100% Cash</b><span>100% cash purchase — Rs. 0 monthly lease loan</span></div>
<div class="stat"><b>Rs. 0</b><span>Monthly lease rental commitment</span></div>
<div class="stat"><b>Rs. ${fmt(room)}</b><span>Monthly room available for other commitments</span></div>`;
    }
    if (room <= 0) {
      return `<div class="stat stat-wide"><b class="bad">No room for a lease rental</b><span>Your existing monthly payments already use up your ${limit}% limit — no room for a lease rental.</span></div>`;
    }
    const maxPrice = room / f / (1 - s.down / 100);
    return `<div class="stat"><b>Rs. ${fmt(room)}</b><span>Highest monthly rental at a ${limit}% limit${s.debt ? " after existing payments" : ""}</span></div>
<div class="stat"><b>Rs. ${fmt(maxPrice)}</b><span>Highest vehicle price you can finance with ${s.down}% down</span></div>
<div class="stat"><b>Rs. ${fmt(maxPrice * s.down / 100)}</b><span>Cash needed up front for that vehicle</span></div>`;
  }
  if (s.down >= 100) {
    return `<div class="stat"><b>Rs. 0</b><span>Monthly rental (100% down payment)</span></div>
<div class="stat"><b>100% Cash</b><span>Zero lease financing needed</span></div>
<div class="stat"><span>Enter your net monthly income above to evaluate affordability and budget room.</span></div>`;
  }
  return `<div class="stat"><b>Rs. ${fmt(1e6 * f * (1 - s.down / 100))}</b><span>Monthly rental for every Rs. 1 million of vehicle price</span></div>
<div class="stat"><b>Rs. ${fmt(1e6 * f * (1 - s.down / 100) / s.dti)}</b><span>Net income needed per Rs. 1 million of price at a ${limit}% limit</span></div>
<div class="stat"><span>Enter your net monthly income above to see which vehicles fit and the highest price you can finance.</span></div>`;
}

function rowActions(r) {
  const name = esc(r.name);
  if (typeof r._baseId !== "number") {
    return `<button class="row-btn danger" type="button" data-act="remove" data-key="${r._key}" aria-label="Remove ${name}">Remove</button>`;
  }
  return (r.custom ? `<button class="row-btn" type="button" data-act="revert" data-key="${r._key}" aria-label="Reset price and condition, ${name}">Reset</button>` : "") +
    `<button class="row-btn" type="button" data-act="hide" data-key="${r._key}" aria-label="Hide ${name}">Hide</button>`;
}

// Table header is rebuilt only when the sort changes
let headSig = "";
function renderHead() {
  const sig = sortKey + "|" + sortDir;
  if (sig === headSig) return;
  headSig = sig;
  $("head").innerHTML = cols.map(c => {
    const sortable = c[0] !== "status" && c[0] !== "bar";
    const k = c[0];
    const cur = k === sortKey ? (sortDir === -1 ? "descending" : "ascending") : "none";
    const arrow = k === sortKey ? (sortDir === -1 ? " ▾" : " ▴") : "";
    return `<th class="${c[2] || ""}" aria-sort="${cur}">${sortable ? `<button type="button" data-k="${k}">${c[1]}${arrow}</button>` : c[1]}</th>`;
  }).join("");
}

// Vehicle rows are created once per vehicle and then updated in place,
// so photos are not re-requested and focused buttons stay put while typing.
const rowEls = new Map();

function buildRow(key) {
  const tr = document.createElement("tr");
  tr.dataset.key = key;
  tr.innerHTML = `<td class="name"><div class="car"><span class="thumb"></span><div><b class="v-name"></b><small class="v-spec"></small><div class="warr"><span class="v-warr"></span><button type="button" class="cond-tag" data-act="cond" data-key="${key}" title="Change condition (Brand New, Reconditioned, Registered Used)"><span class="v-cond"></span> <span class="cycle-icon" aria-hidden="true">⇄</span></button><span class="v-ltv"></span><span class="row-actions"></span></div></div></div></td>
<td class="n price-cell" data-label="Price (Rs.)"><span class="price-wrap"><span class="price-val"></span><button type="button" class="icon-btn edit-price" data-act="price" data-key="${key}" title="Edit price">✎</button></span></td>
<td class="n" data-label="Monthly rental (Rs.)"><b class="v-rent"></b></td>
<td class="v-bar" data-label="Share of your budget"></td>
<td class="n v-interest" data-label="Total interest (Rs.)"></td>
<td class="n v-total" data-label="Total outlay (Rs.)"></td>
<td class="n v-need" data-label="Income needed (Rs.)"></td>
<td class="v-status" data-label="Status"></td>`;
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
  setHtml(q(".v-spec"), [r.pt, r.km].filter(Boolean).map(t => `<span class="spec">${esc(t)}</span>`).join(" · "));
  q(".v-warr").textContent = r.w === "Official" ? "Official warranty" : "Grey market";
  q(".v-cond").textContent = cl;
  q(".cond-tag").setAttribute("aria-label", `Change condition, currently ${cl}`);
  const isUnreg = (r.cond || "New") !== "Used";
  setHtml(q(".v-ltv"), s.down < DOWN_MIN_UNREG && isUnreg ? `<span class="ltv-warn" title="CBSL Directions No. 01 of 2026, cl. 2.1: brand new, reconditioned and recently registered cars need at least 60% down (current down payment: ${s.down}%)">⚠️ &lt;60% down</span>` : "");
  setHtml(q(".row-actions"), rowActions(r));
  q(".price-val").textContent = fmt(r.price);
  q(".edit-price").setAttribute("aria-label", `Edit price, ${r.name}`);
  q(".v-rent").textContent = fmt(r.rental);

  const w = Math.min(100, r.rental / scale * 100);
  const fillCol = r.status === "bad" ? "var(--bad)" : r.status === "mid" ? "var(--mid)" : "var(--accent)";
  setHtml(q(".v-bar"), s.income
    ? `<div class="track" role="img" aria-label="Rental Rs. ${fmt(r.rental)} against your highest affordable rental of Rs. ${fmt(room)}"><span class="fill" style="width:${w}%;background:${fillCol}"></span><span class="mark" style="left:${Math.min(100, room / scale * 100)}%" title="Your highest affordable rental"></span></div>`
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

  // Preferential rate hint (only while the rate field is valid)
  const rateHint = $("rateHint");
  if (rateHint && !fieldError("rate")) {
    rateHint.className = "hint";
    if (s.income > 200000 && s.rate === 16) {
      rateHint.innerHTML = `<button type="button" class="hint-btn" id="applyPrefRateBtn">Earning over Rs. 200,000? Apply the 15% preferential rate</button>`;
      $("applyPrefRateBtn").onclick = () => {
        $("rate").value = "15";
        render();
        $("rate").focus();
      };
    } else if (s.rate === 15 && s.income > 200000) {
      rateHint.textContent = "✓ 15% preferential rate applied";
    } else {
      rateHint.textContent = "15% may apply if you earn over Rs. 200,000";
    }
  }

  // Filters
  const maxP = num("maxprice") > 0 ? num("maxprice") * 1e6 : Infinity;
  const wFilter = $("warr").value;
  const cFilter = $("condFilter").value;
  const affordVal = $("afford").value;

  const list = rows.filter(r => {
    if (r.price > maxP) return false;
    if (wFilter === "official" && r.w !== "Official") return false;
    if (wFilter === "grey" && r.w !== "Grey") return false;
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

  $("resetCatalogWrap").hidden = !cars.some(c => c.custom);

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
    legend.innerHTML = `<span><span class="legend-tick" aria-hidden="true"></span>Tick: your highest affordable rental (${limit}% of income${s.debt ? ", after existing payments" : ""})</span>
<span><span class="tag ok">Comfortable</span> rental plus existing payments up to 40% of income</span>
<span><span class="tag mid">Stretching</span> over 40%, up to 50%</span>
<span><span class="tag bad">Out of reach</span> over 50%</span>`;
  }

  let sentence = "", bar = "";
  if (!s.income) {
    sentence = `Monthly rental is Rs. ${fmt(1e6 * f * (1 - s.down / 100))} for every Rs. 1 million of price.`;
  } else if (s.down >= 100) {
    sentence = "100% cash purchase, no lease rental.";
  } else if (room <= 0) {
    sentence = bar = `Your existing payments already use up your ${limit}% limit. No room for a lease rental.`;
  } else {
    const maxPrice = room / f / (1 - s.down / 100);
    const ok = rows.filter(r => r.rental <= room).length;
    sentence = `Highest monthly rental Rs. ${fmt(room)}. Highest vehicle price Rs. ${fmt(maxPrice)}. ${ok} of ${rows.length} vehicles fit your budget.`;
    bar = `Max rental Rs. ${fmt(room)} · Max price Rs. ${(maxPrice / 1e6).toFixed(1)}M`;
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
    state[id] = id === "income" || id === "debt" ? (v === "" ? "" : String(num(v))) : v;
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
    el.value = (id === "income" || id === "debt") && v !== "" && isFinite(num(v)) ? fmt(num(v)) : v;
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

["income", "debt", "mPrice", "aiPriceInput"].forEach(id => attachMoneyInput($(id)));

// Stable keys let the table keep focus and rows across re-renders
let keySeq = 0;
function assignKey(c) {
  c._key = typeof c._baseId === "number" ? "b" + c._baseId : "c" + (++keySeq);
  return c;
}
cars.forEach(assignKey);

function addCar(car) {
  cars.push(assignKey(car));
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
  } else if (act === "hide") {
    changeWithUndo(idx, `Hid ${car.name}.`, () => { cars[idx] = Object.assign({}, car, { hidden: true, custom: true }); });
  } else if (act === "revert") {
    changeWithUndo(idx, `Reset ${car.name} to its original price and condition.`, () => {
      cars[idx] = Object.assign({}, baseVehicles[car._baseId], { _baseId: car._baseId, _key: car._key, custom: false });
    });
  } else if (act === "cond") {
    const cycle = { New: "Recond", Recond: "Used", Used: "New" };
    car.cond = cycle[car.cond || "New"] || "New";
    car.custom = true;
    saveCars(cars);
    render();
    focusRowControl(key, "cond");
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
  input.value = fmt(car.price);
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
  if (confirm("Reset to the original 12 vehicles? Added vehicles, price and condition changes and hidden vehicles will be reset.")) {
    try { localStorage.removeItem("sl_lease_custom_cars_v2"); } catch (e) {}
    cars = cloneBaseCars(baseVehicles);
    cars.forEach(assignKey);
    rowEls.clear();
    $("rows").replaceChildren();
    render();
    $("h-list").focus();
  }
});

// AI Search Modal UI
const closeAiModal = () => closeModal($("aiModal"));

$("openAiModalBtn").addEventListener("click", () => {
  $("aiSearchMsg").textContent = "";
  openModal($("aiModal"), $("openAiModalBtn"), $("aiSearchQuery"));
});

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
    $("aiAttachedAdBox").style.display = "flex";
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
  $("aiAttachedAdBox").style.display = "none";
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
  const query = $("aiSearchQuery").value.trim();
  if (!query && !pendingAdImage) {
    $("aiSearchMsg").textContent = "Please enter a vehicle name, paste an ad, or attach a screenshot.";
    return;
  }
  $("aiSearchMsg").innerHTML = '<span class="spin"></span>Analyzing Sri Lankan market availability, trims, and valuations...';
  $("aiUnavailBox").hidden = true;
  $("aiResultForm").hidden = true;
  $("aiDiscoveryBox").hidden = true;

  try {
    const parsed = await searchVehicle(query, pendingAdImage);
    currentAiData = parsed;
    renderAiResults(parsed);
  } catch (e) {
    console.error("AI vehicle search failed:", e);
    showSearchUnavailable();
  }
});

// Friendly fallback when AI search fails: offer manual entry instead of the raw error
function showSearchUnavailable() {
  $("aiSearchMsg").innerHTML = `<span class="msg-error">AI search isn't available right now. You can still add the car yourself.</span> <button type="button" class="btn-outline btn-sm" id="goManualBtn">Enter details manually</button>`;
  $("goManualBtn").addEventListener("click", () => {
    selectTab("manual");
    if (!$("mName").value) $("mName").value = $("aiSearchQuery").value.trim().slice(0, 120);
    $("mName").focus();
  });
}

async function renderAiResults(data) {
  $("aiSearchMsg").textContent = "";

  // 1. Multi-vehicle discovery / comparative query
  if (data.is_multi_vehicle && Array.isArray(data.discovered_vehicles) && data.discovered_vehicles.length > 1) {
    renderDiscoveryChecklist(data.discovered_vehicles);
    return;
  }

  // 2. Unavailable in Sri Lanka
  if (!data.is_available_in_sri_lanka) {
    $("aiUnavailBox").hidden = false;
    $("aiUnavailBox").innerHTML = `<b>⚠️ Not available in Sri Lanka:</b> ${esc(data.reason || "This model is not road-legal or actively imported into Sri Lanka.")}<br><small style="margin-top:4px;display:block"><b>Popular Sri Lankan alternatives:</b> ${esc(Array.isArray(data.alternatives) ? data.alternatives.join(", ") : data.alternatives || "Toyota Corolla Cross, Honda Vezel, BYD Sealion")}</small>`;
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
    $("aiYearSelect").innerHTML = '<option value="2024">2024</option>';
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
    if (fetchedImg) {
      normalizeImageToStudio(fetchedImg, procImg => {
        setAiImgPreview(procImg || fetchedImg);
        $("aiImgUrl").value = procImg || fetchedImg;
      });
    }
  } catch (e) {
    console.warn("Studio photo resolution error:", e);
  }
}

function updateAllTrimsYearLabel() {
  const yr = $("aiYearSelect").value;
  const label = $("aiTrimsYearLabel");
  if (label) label.textContent = yr;
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
    $("aiTrimSelect").innerHTML = '<option value="0">Standard Trim</option>';
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

  const condPrices = tData.condition_prices || {};
  const baseP = condPrices.brand_new || 0;
  const recondP = condPrices.recond || Math.round(baseP * 0.88);
  const usedLowP = condPrices.used_low || Math.round(baseP * 0.75);
  const usedMedP = condPrices.used_med || Math.round(baseP * 0.65);

  const options = [];

  // If seller price was extracted from classified ad / auction sheet
  const sellerP = currentAiData?.seller_price_lkr || 0;
  if (sellerP > 0) {
    const detCond = currentAiData?.detected_condition || "Used";
    options.push({
      id: "seller_price",
      name: `Listed / Seller Asking Price (from Ad)`,
      price: sellerP,
      c: detCond,
      selected: true
    });
  }

  options.push(
    { id: "brand_new", name: "Brand New (Unregistered) - 0 km", price: baseP, c: "New" },
    { id: "recond", name: "Reconditioned (Grade 4.5+) - Under 25k km", price: recondP, c: "Recond" },
    { id: "used_low", name: "Registered Used (< 50,000 km)", price: usedLowP, c: "Used" },
    { id: "used_med", name: "Registered Used (50,000 - 100,000 km)", price: usedMedP, c: "Used" }
  );

  $("aiCondSelect").innerHTML = options.map(o => `<option value="${o.id}" data-p="${o.price}" data-c="${o.c}" ${o.selected ? "selected" : ""}>${o.name} - Rs. ${fmt(o.price)}</option>`).join("");
  updateSelectedPrice();
}

function updateSelectedPrice() {
  const selOpt = $("aiCondSelect").selectedOptions[0];
  const p = +selOpt?.dataset.p || 0;
  $("aiPriceInput").value = p ? fmt(p) : "";
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
      existingPh.style.cssText = "width:140px;height:88px;border-radius:6px;border:1px solid var(--line);background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--mute);font-size:0.75rem;gap:4px";
      existingPh.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.55"><rect width="18" height="18" x="3" y="3" rx="3"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M14 21v-4a2 2 0 0 0-4 0v4"/></svg><span>No photo</span>`;
      preview.parentNode.insertBefore(existingPh, preview);
    }
    existingPh.style.display = "flex";
  } else {
    if (existingPh) existingPh.style.display = "none";
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
  if (!(price > 0)) { alert("Please enter a valid price in LKR."); return; }
  const condOpt = $("aiCondSelect").selectedOptions[0];
  const cond = condOpt?.dataset.c || "New";
  const w = $("aiWarrSelect").value;
  const km = $("aiKmInput").value.trim();
  const pt = tData.powertrain || "";

  normalizeImageToStudio(currentAiImgSrc, procImg => {
    addCar({
      name: fullName,
      pt: pt,
      km: km,
      w: w,
      price: price,
      cond: cond,
      img: procImg,
      custom: true
    });
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

  normalizeImageToStudio(currentAiImgSrc, procImg => {
    trims.forEach(t => {
      const fullName = formatVehicleTitle(modelName, t.trim_name, yr);
      const condPrices = t.condition_prices || {};
      let p = 0;
      if (condId === "seller_price") {
        p = currentAiData?.seller_price_lkr || condPrices.brand_new || 0;
      } else {
        p = condPrices[condId] || condPrices.brand_new || 0;
      }
      addCar({
        name: fullName,
        pt: t.powertrain || "",
        km: t.fuel_economy_kml || "",
        w: t.warranty_type || "Grey",
        price: p,
        cond: cond,
        img: procImg,
        custom: true
      });
    });
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
  $("aiDiscoveryTitle").textContent = `Discovered ${vehicles.length} Vehicles Matching Your Query`;

  const listContainer = $("aiDiscoveryList");
  listContainer.innerHTML = vehicles.map((v, i) => {
    const title = formatVehicleTitle(v.model_name, v.trim_name, v.year);
    const condLabel = v.condition === "Used" ? "Registered Used" : v.condition === "Recond" ? "Reconditioned" : "Brand New";
    return `<label class="discovery-item selected" data-i="${i}">
      <input type="checkbox" class="disc-check" data-idx="${i}" checked style="width:auto">
      <img class="discovery-thumb" id="discThumb${i}" alt="${esc(title)}" hidden>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
          <b>${esc(title)}</b>
          <b style="color:var(--accent);font-variant-numeric:tabular-nums">Rs. ${fmt(v.price_lkr)}</b>
        </div>
        <div style="font-size:0.78rem;color:var(--mute)">${esc(v.powertrain || "")}${v.fuel_economy_kml ? " · " + esc(v.fuel_economy_kml) : ""}</div>
        <div style="margin-top:2px">
          <span class="callout-badge ${v.warranty_type === "Official" ? "badge-official" : "badge-grey"}" style="font-size:0.68rem">${v.warranty_type || "Grey"}</span>
          <span class="cond-tag" style="font-size:0.68rem">${condLabel}</span>
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
  $("aiResultForm").hidden = false;
});

$("aiAddSelectedBtn").addEventListener("click", () => {
  const checks = document.querySelectorAll(".disc-check:checked");
  if (!checks.length) {
    alert("Please select at least one vehicle to add.");
    return;
  }

  for (const c of checks) {
    const idx = +c.dataset.idx;
    const v = currentDiscoveredVehicles[idx];
    if (!v) continue;
    const title = formatVehicleTitle(v.model_name, v.trim_name, v.year);
    const thumbEl = $(`discThumb${idx}`);
    const rawImg = thumbEl?.getAttribute("src") || "";

    addCar({
      name: title,
      pt: v.powertrain || "",
      km: v.fuel_economy_kml || "",
      w: v.warranty_type || "Grey",
      price: v.price_lkr,
      cond: v.condition || "New",
      img: rawImg,
      custom: true
    });
  }

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
  if (!(price > 0)) { setManualError("mPrice", "Enter a price greater than zero."); return; }
  setManualError(null, "");
  const cond = $("mCond").value;
  const w = $("mWarr").value;
  const pt = $("mPt").value.trim() || "Custom entry";
  const rawImg = $("mImgUrl").value.trim();

  normalizeImageToStudio(rawImg, procImg => {
    addCar({
      name: name,
      pt: pt,
      km: "",
      w: w,
      price: price,
      cond: cond,
      img: procImg,
      custom: true
    });
    saveCars(cars);
    render();
    $("mName").value = ""; $("mPrice").value = ""; $("mImgUrl").value = "";
    closeAiModal();
  });
});

// Theme Switcher (☀️ / 🌙)
function applyTheme(theme) {
  if (typeof document !== "undefined" && document.documentElement && typeof document.documentElement.setAttribute === "function") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  const btn = $("themeToggleBtn");
  if (btn) {
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.title = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
    if (typeof btn.setAttribute === "function") {
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
  }
}

function initTheme() {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem("vahanaiq_theme") : null;
  const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

const themeBtn = $("themeToggleBtn");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const cur = (typeof document !== "undefined" && document.documentElement && typeof document.documentElement.getAttribute === "function" && document.documentElement.getAttribute("data-theme")) || 
      (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("vahanaiq_theme", next);
    }
    applyTheme(next);
  });
}

initTheme();

// Footer: version and the month the catalogue prices were checked
$("appVersion").textContent = APP_VERSION;
{
  const [y, m] = catalogMeta.priceUpdated.split("-").map(Number);
  if (y && m) $("priceAsOf").textContent = `Prices as of ${new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
}

applyState(loadState());
render();
