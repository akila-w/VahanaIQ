import { formatDate } from "./dates.js?v=2.12.0";
import { fmt, esc, num, computeLeaseTable, rental, yearlySchedule, rateLabel, CONDITIONS, minDownFor, safeUrl } from "./calculator.js?v=2.12.0";
import {
  DOWN_MIN,
  DOWN_MIN_UNREG,
  DOWN_MAX,
  MIN_TENURE,
  MAX_TENURE,
  MAX_INPUT_RATE,
  DTI_STANDARD_PCT,
  DTI_STRETCH_PCT,
  STRATEGY_PRESETS
} from "./constants.js?v=2.12.0";
import { baseVehicles } from "./catalog.js?v=2.12.0";
import { initCatalogue } from "./catalogue-browser.js?v=2.12.0";
import { APP_VERSION } from "./config.js?v=2.12.0";
import { normalizeImageToStudio } from "./canvas-utils.js?v=2.12.0";
import { fetchVehicleStudioImage, NO_PHOTO } from "./image-fetcher.js?v=2.12.0";
let geminiModulePromise = null;
const loadGeminiModule = () => (geminiModulePromise ||= import("./gemini.js?v=2.12.0"));
import { clearLegacyKeys, loadSavedCars, saveCars, newVehicleId } from "./storage.js?v=2.12.0";
import { openModal, closeModal, isOpen } from "./modal.js?v=2.12.0";
import { FIELDS, readSettings, fieldError, snapField, clearSnapNote, loadState, saveState, clearState, sharedCarsFromUrl, cleanUrl, buildShareLink } from "./inputs.js?v=2.12.0";
import { baseVehicles as marketCatalogue } from "./market-catalogue.js?v=2.12.0";
import { showToast, clearToast } from "./toast.js?v=2.12.0";
import { initAccount } from "./account.js?v=2.12.0";
import { attachMoneyInput, formatMoneyText } from "./money-input.js?v=2.12.0";
import { validPrice, vehicleBatchError, conditionPrice } from "./vehicle-validation.js?v=2.12.0";
import { creditFor, photoForModel, formatCreditHtml, PHOTO_CREDITS } from "./photo-credits.js?v=2.12.0";
import { initPlanner } from "./planner.js?v=2.12.0";

clearLegacyKeys();

const $ = id => document.getElementById(id);

// Motion (docs/motion-design.md). Figures and bar widths are always written in full at once;
// these helpers only tint a figure that changed or ease a graphic from where it was. They do
// nothing under reduced motion, or where the Web Animations API is missing (the Node test doubles).
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canAnimate = el => !!el && typeof el.animate === "function" && !reducedMotion();
const activeMotion = new Set();
const elementMotion = new WeakMap();
function animateMotion(el, frames, options) {
  elementMotion.get(el)?.cancel();
  if (!canAnimate(el)) return;
  const animation = el.animate(frames, options);
  if (!animation) return; // Lightweight Node test doubles need no animation lifecycle.
  elementMotion.set(el, animation);
  activeMotion.add(animation);
  const clear = () => { activeMotion.delete(animation); if (elementMotion.get(el) === animation) elementMotion.delete(el); };
  animation.addEventListener('finish', clear, { once: true });
  animation.addEventListener('cancel', clear, { once: true });
}
const motionPreference = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
motionPreference?.addEventListener?.('change', event => {
  if (event.matches) {
    // Underlying values already hold the final reading; cancelling reveals it immediately.
    for (const animation of activeMotion) animation.cancel();
    activeMotion.clear();
  }
});

// Sets a figure's text; when it changes after the first render, tints it for a moment
function setFigure(el, text) {
  if (!el || el.textContent === text) return;
  const changed = el.textContent !== "";
  el.textContent = text;
  if (changed && canAnimate(el)) {
    animateMotion(el, [{ backgroundColor: "var(--callout-info-bg)" }, { backgroundColor: "transparent" }], { duration: 700, easing: EASE_OUT });
  }
}

// Points the gauge needle at its new angle at once, then eases the inner group from the old one
function setNeedle(el, angle) {
  if (!el) return;
  const before = parseFloat(String(el.getAttribute("transform") || "").replace(/^rotate\(/, ""));
  const swing = el.querySelector ? el.querySelector(".dial-needle-swing") : null;
  if (before === parseFloat(angle)) return;
  const offset = swing && typeof window !== "undefined" && typeof window.getComputedStyle === "function" ? parseFloat(window.getComputedStyle(swing).rotate) || 0 : 0;
  el.setAttribute("transform", `rotate(${angle}, 160, 150)`);
  const delta = before + offset - parseFloat(angle);
  if (Number.isFinite(delta) && Math.abs(delta) > 0.05 && canAnimate(swing)) {
    animateMotion(swing, [{ rotate: `${delta}deg` }, { rotate: "0deg" }], { duration: 450, easing: EASE_OUT });
  }
}

// Replaces a graphic's markup and eases each bar from its previous width to its new width
function setBars(el, html, barSelector) {
  if (!el) return;
  // Input and change can request the same render. Keep the current nodes/effects
  // when the graphic is unchanged instead of discarding an in-flight transition.
  if (el._barsHtml === html) return;
  el._barsHtml = html;
  const animate = canAnimate(el) && typeof el.querySelectorAll === "function";
  const before = animate ? [...el.querySelectorAll(barSelector)].map(b => ({ target: b.style.width, visible: typeof window !== "undefined" && typeof window.getComputedStyle === "function" ? window.getComputedStyle(b).width : b.style.width })) : [];
  el.innerHTML = html;
  if (!before.length) return;
  [...el.querySelectorAll(barSelector)].forEach((bar, i) => {
    const from = before[i], to = bar.style.width;
    if (from && to && from.target !== to) animateMotion(bar, [{ width: from.visible }, { width: to }], { duration: 450, easing: EASE_OUT });
  });
}

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

const pinnedKeys = new Set();
let activeQuickFilter = "all";

export function matchesQuickFilter(r, qf) {
  if (!qf || qf === "all") return true;
  if (qf === "under15m") return r.price <= 15000000;
  if (qf === "electrified") {
    return /\b(hybrid|hev|e:hev|phev|ev|electric|bev|dm-i|e-power)\b/i.test(`${r.pt || ""} ${r.name || ""} ${r.trim || ""}`);
  }
  if (qf === "suv") {
    const gcMatch = String(r.groundClearance || "").match(/(\d+(?:\.\d+)?)/);
    if (gcMatch && parseFloat(gcMatch[1]) >= 170) return true;
    return /\b(suv|crossover|cross|vezel|raize|hyryder|fronx|taisor|magnite|sealion|prado|fortuner|montero|hilux|ranger|triton)\b/i.test(`${r.body || ""} ${r.name || ""}`);
  }
  if (qf === "cbsl40") {
    return minDownFor(r.cond, r.financeClass, r.firstRegisteredOn) === 40;
  }
  if (qf === "official") {
    return r.w === "Official";
  }
  return true;
}

const cols = [
  ["name", "Vehicle"],
  ["price", "Price", "n"],
  ["dp", "Down Payment", "n"],
  ["rental", "Monthly Rental", "n"],
  ["bar", "Affordability"],
  ["interest", "Total Interest", "n secondary"],
  ["total", "Total Outlay", "n secondary"],
  ["need", "Income Needed", "n secondary"],
  ["status", "Status", "secondary"],
  ["actions", "Actions", "actions"]
];

const condLabel = c => CONDITIONS[c] || CONDITIONS.New;

function summaryHtml(s, f, room) {
  const limit = Math.round(s.dti * 100);
  if (s.income) {
    if (s.down >= 100) {
      return `<div class="stat"><b>100% Cash</b><span>100% cash purchase — LKR 0.00 monthly lease loan</span></div>
<div class="stat"><b>LKR 0.00</b><span>Monthly lease rental commitment</span></div>
<div class="stat"><b>LKR ${fmt(room)}</b><span>Monthly room available for other commitments</span></div>`;
    }
    if (room <= 0) {
      return `<div class="stat stat-wide"><b class="bad">No room for a lease rental</b><span>Your existing monthly payments already use up your ${limit}% limit — no room for a lease rental.</span></div>`;
    }
    const maxPrice = room / f / (1 - s.down / 100);
    return `<div class="stat"><b>LKR ${fmt(room)}</b><span>Highest monthly rental at a ${limit}% limit${s.debt ? " after existing payments" : ""}${s.insurance ? " and monthly insurance" : ""}</span></div>
<div class="stat"><b>LKR ${fmt(maxPrice)}</b><span>Highest vehicle price you can finance with ${s.down}% down${s.down < 60 ? " (cars registered over a year only)" : ""}</span></div>
<div class="stat"><b>LKR ${fmt(maxPrice * s.down / 100 + (s.fees || 0))}</b><span>Cash Needed Up Front for that vehicle${s.fees ? ", with fees" : ""}</span></div>`;
  }
  if (s.down >= 100) {
    return `<div class="stat"><b>LKR 0.00</b><span>Monthly rental (100% down payment)</span></div>
<div class="stat"><b>100% Cash</b><span>Zero lease financing needed</span></div>
<div class="stat"><span>Enter your net monthly income above to evaluate affordability and budget room.</span></div>`;
  }
  return `<div class="stat"><b>LKR ${fmt(1e6 * f * (1 - s.down / 100))}</b><span>Monthly rental for every LKR 1.00 million of vehicle price</span></div>
<div class="stat"><b>LKR ${fmt(1e6 * f * (1 - s.down / 100) / s.dti)}</b><span>Net Income Needed per LKR 1.00 million of price at a ${limit}% limit</span></div>
<div class="stat"><span>Enter your net monthly income above to see which vehicles fit and the highest price you can finance.</span></div>`;
}

function rowActions(r) {
  const name = esc(r.name);
  const key = esc(r._key);
  const isPinned = pinnedKeys.has(r._key);
  return `<button class="row-btn pin-btn${isPinned ? " active" : ""}" type="button" data-act="pin" data-key="${key}" aria-pressed="${isPinned}" title="${isPinned ? "Pinned for head-to-head comparison" : "Pin for head-to-head comparison"}" aria-label="${isPinned ? "Pinned for head-to-head comparison" : "Compare head-to-head"}, ${name}">${isPinned ? "Pinned" : "Compare"}</button><button class="row-btn" type="button" data-act="details" data-key="${key}" aria-label="Lease details, ${name}">Details</button><button class="icon-btn remove-row-btn" type="button" data-act="remove" data-key="${key}" title="Remove ${name}" aria-label="Remove ${name}">&times;</button>`;
}

const UNKNOWN_SPEC = "Specifications to confirm";

export function cleanVehicleSpecs(r) {
  const nameLower = String(r.name || "").toLowerCase();
  const nameWords = new Set(nameLower.replace(/[()]/g, " ").split(/\s+/).filter(Boolean));
  const rawParts = [r.trim, r.pt, r.power, r.drivetrain, r.km]
    .filter(t => t && t !== UNKNOWN_SPEC)
    .flatMap(t => String(t).split(/\s*[·•]\s*/))
    .map(t => t.trim())
    .filter(Boolean);

  const hasPureRange = rawParts.some(p => /\b\d[\d,]*\+?\s*km\b/i.test(p) && !/\bpure\s*ev\b/i.test(p));
  const seen = new Set();
  const out = [];

  for (let i = 0; i < rawParts.length; i++) {
    let part = rawParts[i];
    const lower = part.toLowerCase();
    if (/^standard(\s+trim)?$/i.test(part)) continue;
    // Omit trim token if already in vehicle title or generic "Spec" label when engine is present
    if (i === 0 && r.trim && (nameLower.includes(lower) || lower.split(/\s+/).every(w => nameWords.has(w)) || /\bspec$/i.test(part))) {
      continue;
    }
    // Skip secondary battery pack / transmission / pure-EV sub-range tokens in compact table rows
    if (/\b(kwh|battery|s\s*tronic|dsg|cvt|e-cvt|at|mt)\b/i.test(part) && rawParts.length > 3) continue;
    if (hasPureRange && /\bpure\s*ev\b/i.test(part)) continue;

    // Condense verbose powertrain, power, and range phrasing into scannable badge text
    part = part
      .replace(/\bPlug-in\s+Hybrid\b/gi, "PHEV")
      .replace(/\bStrong\s+(?:Hybrid|HEV)\b/gi, "HEV")
      .replace(/\bMild\s+(?:Hybrid|MHEV)\b/gi, "MHEV")
      .replace(/\b(\d+\s*HP)\s+combined\b/gi, "$1")
      .replace(/\s*\(\d+(?:\.\d+)?\s*(?:kW|PS|hp)\)/gi, "")
      .replace(/,\s*(\d[\d,]*\+?)\s*km\s*range/gi, " · $1 km")
      .replace(/\b(\d[\d,]*\+?)\s*km\s+(?:combined|range)\b/gi, "$1 km");

    for (const sub of part.split(/\s*·\s*/).map(s => s.trim()).filter(Boolean)) {
      const subLower = sub.toLowerCase();
      if (seen.has(subLower)) continue;
      seen.add(subLower);
      out.push(sub);
    }
  }
  return out.slice(0, 4);
}

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
  const safeKey = esc(key);
  tr.innerHTML = `<td class="name"><div class="car"><span class="thumb"></span><div><div class="v-title-row"><b class="v-name"></b><span class="v-badge-lowest"></span></div><small class="v-spec"></small><div class="warr"><span class="v-warr"></span><button type="button" class="cond-tag" data-act="cond" data-key="${safeKey}" title="Change condition (Brand New, Reconditioned, Registered under a year, Registered Used)"><span class="v-cond"></span> <span class="cycle-icon" aria-hidden="true">⇄</span></button><span class="v-ltv"></span></div></div></div></td>
<td class="n price-cell" data-label="Price (LKR)"><span class="price-wrap"><span class="price-val"></span><button type="button" class="icon-btn edit-price" data-act="price" data-key="${safeKey}" title="Edit price">✎</button></span></td>
<td class="n v-dp" data-label="Down payment (LKR)"><div class="cell-metric"><span class="dp-wrap"><span class="v-dp-val"></span><button type="button" class="icon-btn edit-dp" data-act="dp" data-key="${safeKey}" title="Override down payment % for this vehicle">✎</button></span><span class="micro-sub v-dp-sub"></span></div></td>
<td class="n" data-label="Monthly rental (LKR)"><div class="cell-metric"><b class="v-rent"></b><span class="micro-sub v-rent-sub"></span></div></td>
<td class="v-bar" data-label="Affordability"></td>
<td class="n v-interest secondary" data-label="Total Interest (LKR)"></td>
<td class="n v-total secondary" data-label="Total outlay (LKR)"></td>
<td class="n v-need secondary" data-label="Income needed (LKR)"><div class="cell-metric"><span class="v-need-val"></span><span class="micro-sub v-need-sub"></span></div></td>
<td class="v-status secondary" data-label="Status"></td>
<td class="v-actions"><span class="row-actions"></span></td>`;
  return tr;
}

// Sets innerHTML only when it changed, so unchanged buttons keep focus
function setHtml(el, html) {
  if (el._html !== html) { el._html = html; el.innerHTML = html; }
}

// setHtml for a cell holding a rental bar: the fill eases from its previous width
function setBarHtml(el, html) {
  if (el._html !== html) { el._html = html; setBars(el, html, ".fill"); }
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

function updateRow(tr, r, { s, room, scale, labels, minRental, totalVehicles }) {
  const q = sel => tr.querySelector(sel);
  const cl = condLabel(r.cond);
  tr.classList.toggle("is-pinned", pinnedKeys.has(r._key));
  setThumb(tr, r);
  q(".v-name").textContent = r.name;

  const isLowest = (totalVehicles || 0) > 1 && r.downPct < 100 && r.rental > 0 && r.rental === minRental;
  if (q(".v-badge-lowest")) {
    setHtml(q(".v-badge-lowest"), isLowest
      ? '<span class="badge-lowest-rental" title="Lowest monthly lease rental in this comparison"><span class="glyph glyph-badge-check" aria-hidden="true"></span> Lowest Rental</span>'
      : "");
  }

  const fullSpecTitle = [r.trim, r.pt, r.power, r.drivetrain, r.km]
    .filter(t => t && t !== UNKNOWN_SPEC)
    .join(" · ");
  const specEl = q(".v-spec");
  if (specEl) {
    specEl.setAttribute("title", fullSpecTitle);
    setHtml(specEl, cleanVehicleSpecs(r).map(t => `<span class="spec">${esc(t)}</span>`).join(""));
  }
  q(".v-warr").textContent = r.w === "Official" ? "Official agent" : r.w === "Grey" ? "Grey import" : "Route unconfirmed";
  const basis = { "user-entered": "Your Price", "ai-estimate": "AI estimate: confirm with the seller", "seller-listed": "Seller's asking price", "unpublished": "Unverified price estimate", "published": "Source-backed asking price", "starting": "Source-backed starting price" };
  if (r.firstRegisteredOn) q(".v-warr").textContent += " · First registered " + formatDate(r.firstRegisteredOn);
  if (r.legacy) q(".v-warr").textContent += " · Saved estimate: verify price";
  else if (r.priceBasis) q(".v-warr").textContent += " · " + (basis[r.priceBasis] || "Confirm current quote");
  if (r.conditionAssumed) q(".v-warr").textContent += ' · Condition unconfirmed; new-car deposit assumed';
  if (r.financeNote) q(".v-warr").textContent += ' · ' + r.financeNote;
  q(".v-cond").textContent = cl;
  q(".cond-tag").setAttribute("aria-label", `Change condition, currently ${cl}`);
  setHtml(q(".v-ltv"), r.downCustom
    ? `<span class="dp-custom-badge" title="Custom down payment override (${r.downPct}%) set for this vehicle">${r.downPct}% down (custom)</span>`
    : r.downRaised
    ? `<span class="ltv-warn" title="CBSL Directions No. 01 of 2026, cl. 2.1: brand new, reconditioned and recently registered cars need at least ${r.downPct}% down, so this car is calculated at ${r.downPct}% instead of ${s.down}%">${r.downPct}% down (CBSL minimum)</span>`
    : "");
  setHtml(q(".row-actions"), rowActions(r));
  setFigure(q(".price-val"), fmt(r.price));
  q(".edit-price").setAttribute("aria-label", `Edit price, ${r.name}`);
  if (q(".edit-dp")) q(".edit-dp").setAttribute("aria-label", `Override down payment percentage, ${r.name}`);
  setFigure(q(".v-rent"), fmt(r.rental));

  if (q(".v-rent-sub")) {
    if (r.downPct >= 100) {
      setHtml(q(".v-rent-sub"), '<small class="micro-sub ok">100% Cash</small>');
    } else if (s.insurance) {
      const insMonthly = s.insurance / 12;
      setHtml(q(".v-rent-sub"), `<small class="micro-sub" title="LKR ${fmt(insMonthly)}/mo insurance included in budget">+Ins LKR ${fmt(insMonthly)}/mo</small>`);
    } else {
      setHtml(q(".v-rent-sub"), `<small class="micro-sub" title="Monthly lease repayment over ${s.n} months">${s.n} instalments</small>`);
    }
  }

  if (q(".v-dp-val")) {
    setFigure(q(".v-dp-val"), fmt(r.dp));
  } else {
    q(".v-dp").textContent = fmt(r.dp);
  }
  if (q(".v-dp-sub")) {
    const resetBtn = r.downCustom ? ` · <button type="button" class="dp-reset-btn" data-act="reset-dp" data-key="${esc(r._key)}" aria-label="Reset custom down payment for ${esc(r.name)}">Reset</button>` : "";
    if (r.downPct >= 100) {
      setHtml(q(".v-dp-sub"), `<small class="micro-sub ok">100% paid upfront${resetBtn}</small>`);
    } else if (s.fees) {
      setHtml(q(".v-dp-sub"), `<small class="micro-sub" title="LKR ${fmt(r.dp)} deposit + LKR ${fmt(s.fees)} fees">${r.downPct}%${r.downCustom ? " custom" : " down"} · Upfront: LKR ${fmt(r.upfront)}${resetBtn}</small>`);
    } else {
      setHtml(q(".v-dp-sub"), `<small class="micro-sub">${r.downPct}% ${r.downCustom ? "custom deposit" : "cash deposit"}${resetBtn}</small>`);
    }
  }

  const limit = Math.round(s.dti * 100);
  let statusHtml = '<span class="na">-</span>';
  if (s.income) {
    const monthlyCost = r.rental + (s.insurance ? s.insurance / 12 : 0);
    const carDti = ((monthlyCost + s.debt) / s.income) * 100;
    const carDtiStr = `${carDti.toFixed(1)}% DTI`;
    if (r.downPct >= 100) {
      statusHtml = `<span class="tag ok" title="100% cash purchase — zero monthly lease debt">100% Cash · 0% DTI</span>`;
    } else if (r.status === "ok") {
      if (limit === DTI_STRETCH_PCT && carDti > DTI_STANDARD_PCT) {
        statusHtml = `<span class="tag mid" title="${carDtiStr} of income fits within ${DTI_STRETCH_PCT}% stretch limit (exceeds ${DTI_STANDARD_PCT}% standard limit)">Stretch limit · ${carDtiStr}</span>`;
      } else {
        statusHtml = `<span class="tag ok" title="${carDtiStr} of monthly income (Limit: ${limit}%)">Within limit · ${carDtiStr}</span>`;
      }
    } else {
      if (limit === DTI_STANDARD_PCT && carDti <= DTI_STRETCH_PCT) {
        statusHtml = `<span class="tag mid" title="${carDtiStr} exceeds ${DTI_STANDARD_PCT}% standard limit, but fits within ${DTI_STRETCH_PCT}% stretch limit">Stretch only · ${carDtiStr}</span>`;
      } else {
        statusHtml = `<span class="tag bad" title="${carDtiStr} of monthly income (Exceeds ${limit}% limit)">Above limit · ${carDtiStr}</span>`;
      }
    }
  }

  const w = Math.min(100, r.rental / scale * 100);
  const markPos = Math.min(100, room / scale * 100);
  let barMicro = "";
  if (s.income) {
    if (r.downPct >= 100) {
      barMicro = `<div class="bar-micro-metric ok">Full room: LKR ${fmt(room)}/mo</div>`;
    } else if (r.rental <= room) {
      barMicro = `<div class="bar-micro-metric ok">+LKR ${fmt(room - r.rental)}/mo left</div>`;
    } else {
      barMicro = `<div class="bar-micro-metric bad">-LKR ${fmt(r.rental - room)}/mo over</div>`;
    }
  }
  const inlineStatus = s.income ? `<div class="v-bar-status-inline">${statusHtml}</div>` : "";
  setBarHtml(q(".v-bar"), s.income
    ? `<div class="v-bar-inner">${inlineStatus}<div class="track" role="img" aria-label="Rental LKR ${fmt(r.rental)} against your highest affordable rental of LKR ${fmt(room)}"><span class="fill ${r.status}" style="width:${w}%"></span><span class="mark" style="left:${markPos}%" title="Your highest affordable rental"></span></div>${barMicro}</div>`
    : `<div class="v-bar-inner v-bar-no-income"><span class="v-bar-need-fallback">Need LKR ${fmt(r.need)}/mo</span><span class="na bar-empty">At ${limit}% limit · Add income</span></div>`);

  q(".v-interest").textContent = fmt(r.interest);
  q(".v-total").textContent = fmt(r.total);

  if (q(".v-need-val")) {
    q(".v-need-val").textContent = fmt(r.need);
  } else {
    q(".v-need").textContent = fmt(r.need);
  }
  if (q(".v-need-sub")) {
    if (s.income) {
      const diff = s.income - r.need;
      if (diff >= 0) {
        setHtml(q(".v-need-sub"), '<small class="micro-sub ok">Income meets limit</small>');
      } else {
        setHtml(q(".v-need-sub"), `<small class="micro-sub bad">+LKR ${fmt(Math.abs(diff))} gap</small>`);
      }
    } else {
      setHtml(q(".v-need-sub"), `<small class="micro-sub">At ${limit}% limit</small>`);
    }
  }

  setHtml(q(".v-status"), statusHtml);
}

function render() {
  // The shared deposit control permits 40% only when a selected vehicle can use it, or 40% is selected.
  const eligibleForForty = cars.some(c => !c.hidden && minDownFor(c.cond, c.financeClass, c.firstRegisteredOn) === 40);
  if ($('down')) $('down').min = String(eligibleForForty || num($("down")) <= 40 ? 40 : 60);
  const settings = readSettings();
  syncSegmentedAndSteppers();
  const { s, f, rows: allRows, room } = computeLeaseTable(cars, settings);
  const rows = allRows.filter(r => !r.hidden);
  for (const k of pinnedKeys) {
    if (!rows.some(r => r._key === k)) pinnedKeys.delete(k);
  }

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
    if (!matchesQuickFilter(r, activeQuickFilter)) return false;
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
  syncQuickFilterChips();
  updateHeadToHeadTray(rows, s);
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
  if ($("toggleColsBtn")) $("toggleColsBtn").hidden = !hasCars;
  if ($("comparisonPanel") && $("comparisonPanel").classList) {
    $("comparisonPanel").classList.toggle("few-cars", rows.length <= 2);
  }
  if ($("affordOption")) $("affordOption").textContent = `Only those within my ${Math.round(s.dti * 100)}% limit`;
  refreshCatalogue();

  let minRental = Infinity;
  for (const row of rows) {
    if (row.price > 0 && Number.isFinite(row.rental)) {
      if (row.rental < minRental) minRental = row.rental;
    }
  }

  const ctx = { s, room, scale, labels, minRental, totalVehicles: rows.length };
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

  const costsMetaEl = $("costsDrawerMeta");
  if (costsMetaEl) {
    const costParts = [];
    if (s.insurance) costParts.push(`Ins: LKR ${fmt(s.insurance)}/yr`);
    if (s.fees) costParts.push(`Fees: LKR ${fmt(s.fees)}`);
    costsMetaEl.textContent = costParts.length ? costParts.join(" · ") : "Optional";
  }
  const ltvMetaEl = $("ltvDrawerMeta");
  if (ltvMetaEl) {
    const dpPct = Math.min(100, Math.max(0, s.down));
    const loanPct = Math.max(0, 100 - dpPct);
    ltvMetaEl.textContent = `${dpPct}% Deposit · ${loanPct}% LTV`;
  }
  const savingsMetaEl = $("savingsDrawerMeta");
  if (savingsMetaEl) {
    const pvEl = $("plannerVehicle");
    savingsMetaEl.textContent = pvEl && pvEl.value ? "Goal active · Click to toggle" : "Optional deposit & pace calculator";
  }

  if (list.length === 0) {
    $("empty").textContent = affordVal === "ok" && !s.income
      ? "Enter your net monthly income above to filter vehicles you can afford."
      : "No vehicles match these filters.";
    $("empty").hidden = false;
  } else {
    $("empty").hidden = true;
  }

  applyBudgetMode();
  saveState(currentState());
}

// Mobile "Filters & sort" toggle shows how many filters are active
const FILTER_DEFAULTS = { warr: "all", condFilter: "all", maxprice: "", afford: "all" };
function updateFilterCount() {
  const baseCount = Object.entries(FILTER_DEFAULTS).filter(([id, def]) => $(id) && String($(id).value).trim() !== def).length;
  const n = baseCount + (activeQuickFilter && activeQuickFilter !== "all" ? 1 : 0);
  $("filtersCount").textContent = n ? `(${n})` : "";
  $("filtersCount").hidden = !n;
  $("filtersToggle").setAttribute("aria-label", n ? `Filters and sort, ${n} active` : "Filters and sort");
}

function syncQuickFilterChips() {
  if (typeof document.querySelectorAll !== "function") return;
  const chips = document.querySelectorAll("button[data-qf]");
  chips.forEach(chip => {
    const active = chip.dataset.qf === activeQuickFilter;
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-pressed", String(active));
  });
}

function updateHeadToHeadTray(rows, s) {
  const tray = $("headToHeadTray");
  if (!tray) return;
  const pinnedRows = rows.filter(r => pinnedKeys.has(r._key));
  if (pinnedRows.length === 0) {
    tray.hidden = true;
    return;
  }
  tray.hidden = false;
  if ($("h2hTrayCount")) $("h2hTrayCount").textContent = String(pinnedRows.length);
  const pillsEl = $("h2hTrayPills");
  if (pillsEl) {
    pillsEl.innerHTML = pinnedRows.map(r => `<span class="h2h-pill"><span class="h2h-pill-name">${esc(r.name)}</span><button type="button" class="h2h-pill-remove" data-unpin-key="${esc(r._key)}" aria-label="Unpin ${esc(r.name)} from head-to-head">&times;</button></span>`).join("");
  }
  const openBtn = $("openHeadToHeadBtn");
  if (openBtn) {
    openBtn.textContent = pinnedRows.length >= 2
      ? `Compare Side-by-Side (${pinnedRows.length})`
      : "Pin 1 More to Compare";
    openBtn.disabled = pinnedRows.length < 2;
  }
}

$("filtersToggle").addEventListener("click", () => {
  const open = $("filtersToggle").getAttribute("aria-expanded") !== "true";
  $("filtersToggle").setAttribute("aria-expanded", String(open));
  $("toolsPanel").classList.toggle("collapsed", !open);
});

if ($("toggleColsBtn") && typeof $("toggleColsBtn").addEventListener === "function") {
  $("toggleColsBtn").addEventListener("click", () => {
    const panel = $("comparisonPanel");
    if (!panel || !panel.classList) return;
    const showAll = !panel.classList.contains("show-all-cols");
    panel.classList.toggle("show-all-cols", showAll);
    $("toggleColsBtn").setAttribute("aria-pressed", String(showAll));
    $("toggleColsBtn").textContent = showAll ? "Compact Columns" : "Show Full Columns";
  });
}

// Budget legend, sticky mobile summary and the debounced screen-reader sentence
let liveTimer = null;
let budgetBarText = "";
function updateBudgetExtras(s, f, room, rows) {
  const limit = Math.round(s.dti * 100);
  const legend = $("budgetLegend");
  legend.hidden = !s.income;
  if (s.income) {
    legend.innerHTML = `<span><span class="legend-tick" aria-hidden="true"></span>Limit: <strong>${limit}% of income</strong>${s.debt ? " (after existing debt)" : ""}${s.insurance ? " + insurance" : ""}</span>
<span><span class="tag ok">Within limit</span> &le;${limit}% &middot; <span class="tag bad">Above limit</span> &gt;${limit}%</span>`;
  }

  const budgetGraphic = $("budgetGraphic");
  if (budgetGraphic) {
    budgetGraphic.hidden = false;
    if ($("summary")) $("summary").hidden = true;

    if (!s.income) {
      if (budgetGraphic.classList) {
        budgetGraphic.classList.remove("is-offscale", "is-over-income");
        budgetGraphic.classList.add("is-pending");
      }
      if ($("dialOffscaleBadge")) {
        $("dialOffscaleBadge").setAttribute("hidden", "");
        $("dialOffscaleBadge").hidden = true;
      }
      const needleEl = $("budgetNeedle");
      setNeedle(needleEl, "-90.0");

      const heroEl = $("budgetDtiHero");
      if (heroEl) heroEl.textContent = "—% DTI";

      const propRent = s.down >= 100 ? 0 : (rows.length > 0 ? rows[0].rental : 1e6 * f * (1 - s.down / 100));
      const subEl = $("budgetDtiSub");
      if (subEl) subEl.textContent = rows.length > 0
        ? `LKR ${fmt(propRent)} / month rental`
        : `LKR ${fmt(propRent)} / LKR 1M price`;

      const pillEl = $("budgetDtiPill");
      if (pillEl) pillEl.className = "classic-dti-pill pending";
      const textEl = $("budgetDtiText");
      if (textEl) textEl.textContent = "Enter Net Monthly Income";

      const labelEl = $("budgetCashflowLabel");
      if (labelEl) labelEl.textContent = "Pending — Enter net monthly income above";

      const barEl = $("budgetCashflowBar");
      if (barEl) {
        const fullW = 100;
        if (typeof barEl.setAttribute === "function") {
          barEl.setAttribute("role", "img");
          barEl.setAttribute("aria-label", "Net income cashflow spectrum pending: enter net monthly income above to evaluate DTI and monthly cashflow.");
        }
        barEl._barsHtml = null;
        barEl.innerHTML = `<div class="cashflow-seg-free" style="width:${fullW}%" title="Pending: Enter net monthly income">Enter net monthly income above to evaluate DTI &amp; cashflow</div>`;
      }

      const gridEl = $("budgetTelemetryGrid");
      if (gridEl) {
        const card1Title = rows.length > 0 ? "Vehicle Lease Rental" : "Monthly Rental / LKR 1M";
        const card1Tag = rows.length > 0 ? "Proposed" : "Standard";
        const card1Val = propRent;
        const card1Sub = rows.length > 0 ? esc(rows[0].name) : "Per LKR 1.00M vehicle price";

        const card2Title = "Existing Commitments";
        const card2Tag = s.debt > 0 ? "Loans / Cards" : "Zero Debt";
        const card2TagClass = s.debt > 0 ? "mid" : "ok";
        const card2Val = s.debt;
        const card2Sub = s.debt > 0 ? "Enter income to calculate %" : "Existing monthly payments";

        const card3Title = "Net Income Needed / LKR 1M";
        const card3Tag = `${limit}% Limit`;
        const card3Val = 1e6 * f * (1 - s.down / 100) / s.dti;
        const card3Sub = `At ${limit}% limit per LKR 1.00M price`;

        const card4Title = "Down Payment";
        const card4Tag = "CBSL 2026";
        const card4Val = 1e6 * (s.down / 100);
        const card4Sub = `${s.down}% CBSL minimum per LKR 1M`;

        const bar1W = s.down >= 100 ? 0 : Math.min(100, Math.max(15, Math.round(100 - s.down)));
        const bar2W = s.debt > 0 ? 35 : 0;
        const bar3W = Math.min(100, Math.max(0, Math.round(s.dti * 100)));
        const downW = Math.min(100, Math.max(0, Math.round(s.down)));

        gridEl.innerHTML = `<div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card1Title}</span><span class="tag ok">${card1Tag}</span></div><div class="telemetry-card-val val-rental">LKR ${fmt(card1Val)}</div><div class="telemetry-card-sub"><span>${card1Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-rental" style="width:${bar1W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card2Title}</span><span class="tag ${card2TagClass}">${card2Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card2Val)}</div><div class="telemetry-card-sub"><span>${card2Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-debt" style="width:${bar2W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card3Title}</span><span class="tag ok">${card3Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card3Val)}</div><div class="telemetry-card-sub"><span>${card3Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-price" style="width:${bar3W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card4Title}</span><span class="tag ok">${card4Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card4Val)}</div><div class="telemetry-card-sub"><span>${card4Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-upfront" style="width:${downW}%"></div></div></div>`;
      }
    } else {
      budgetGraphic.hidden = false;
      if ($("summary")) $("summary").hidden = true;

      const leaseRental = s.down >= 100 ? 0 : (rows.length > 0 ? rows[0].rental : (room > 0 ? room : 0));
      const monthlyInsurance = s.insurance ? s.insurance / 12 : 0;
      const totalMonthlyDebt = leaseRental + s.debt + monthlyInsurance;
      const dtiPct = s.income > 0 ? (totalMonthlyDebt / s.income) * 100 : 0;
      const dtiStr = dtiPct.toFixed(1) + "%";
      const isOffScale = dtiPct > 60;
      const isOverIncome = dtiPct > 100;

      if (budgetGraphic.classList) {
        budgetGraphic.classList.remove("is-pending");
        budgetGraphic.classList.toggle("is-offscale", isOffScale);
        budgetGraphic.classList.toggle("is-over-income", isOverIncome);
      }
      if ($("dialOffscaleBadge")) {
        // SVG groups do not implement HTMLElement.hidden: update the attribute too.
        if (isOffScale) $("dialOffscaleBadge").removeAttribute("hidden");
        else $("dialOffscaleBadge").setAttribute("hidden", "");
        $("dialOffscaleBadge").hidden = !isOffScale;
      }

      const clampedDti = Math.min(60, Math.max(0, dtiPct));
      const needleAngle = -90 + (clampedDti / 60) * 180;
      const needleEl = $("budgetNeedle");
      setNeedle(needleEl, needleAngle.toFixed(1));

      const heroEl = $("budgetDtiHero");
      setFigure(heroEl, dtiStr + " DTI");
      if (heroEl) heroEl.classList.toggle("is-critical", isOffScale);
      const subEl = $("budgetDtiSub");
      setFigure(subEl, isOverIncome
        ? `LKR ${fmt(totalMonthlyDebt)} / month · Shortfall LKR ${fmt(totalMonthlyDebt - s.income)}`
        : `LKR ${fmt(totalMonthlyDebt)} / month`);

      let statusClass = "ok";
      let statusText = `Within ${DTI_STANDARD_PCT}% Standard Limit`;
      if (dtiPct <= DTI_STANDARD_PCT) {
        statusClass = "ok";
        statusText = `Within ${DTI_STANDARD_PCT}% Standard Limit`;
      } else if (dtiPct <= DTI_STRETCH_PCT) {
        statusClass = "mid";
        statusText = `Stretching (${DTI_STANDARD_PCT} - ${DTI_STRETCH_PCT}% Cap)`;
      } else if (dtiPct <= 60) {
        statusClass = "bad";
        statusText = `Limit Exceeded (> ${DTI_STRETCH_PCT}%)`;
      } else if (dtiPct <= 100) {
        statusClass = "bad is-critical-pill";
        statusText = `Critical Risk: ${dtiStr} DTI (>50% Limit · Off-Scale 60%+)`;
      } else {
        statusClass = "bad is-critical-pill";
        statusText = `Critical: Exceeds 100% of Net Income (Off-Scale 60%+)`;
      }
      const pillEl = $("budgetDtiPill");
      if (pillEl) pillEl.className = "classic-dti-pill " + statusClass;
      const textEl = $("budgetDtiText");
      if (textEl) textEl.textContent = statusText;

      const dialBoxEl = typeof document !== "undefined" && typeof document.querySelector === "function" ? document.querySelector(".gauge-dial-box") : null;
      if (dialBoxEl && dialBoxEl.classList) dialBoxEl.classList.toggle("is-critical-risk", isOffScale);

      const rentalPctOfIncome = s.income > 0 ? (leaseRental / s.income) * 100 : 0;
      const debtPctOfIncome = s.income > 0 ? (s.debt / s.income) * 100 : 0;
      const insPctOfIncome = s.income > 0 ? (monthlyInsurance / s.income) * 100 : 0;
      const fmtPct = p => (Math.abs(p - Math.round(p)) < 0.05 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`);

      const labelEl = $("budgetCashflowLabel");
      if (isOverIncome) {
        const shortfall = totalMonthlyDebt - s.income;
        const text = `LKR ${fmt(totalMonthlyDebt)} / LKR ${fmt(s.income)} (${dtiStr} of net monthly income committed · Monthly shortfall: LKR ${fmt(shortfall)})`;
        setFigure(labelEl, text);
        if (typeof document !== "undefined" && typeof document.createElement === "function" && labelEl && labelEl.innerHTML !== undefined) {
          labelEl.innerHTML = `<span class="cf-metric-main"><strong class="cf-num val-debt">LKR ${fmt(totalMonthlyDebt)}</strong> <span class="cf-slash">/</span> <span class="cf-income">LKR ${fmt(s.income)}</span></span> <span class="cf-metric-badge is-critical">${dtiStr} of net monthly income committed</span> <span class="cf-metric-badge is-shortfall">Monthly shortfall: LKR ${fmt(shortfall)}</span>`;
        }
      } else {
        const remainingIncome = Math.max(0, s.income - totalMonthlyDebt);
        const text = `LKR ${fmt(totalMonthlyDebt)} / LKR ${fmt(s.income)} (${dtiStr} of net monthly income committed · Remaining: LKR ${fmt(remainingIncome)})`;
        setFigure(labelEl, text);
        if (typeof document !== "undefined" && typeof document.createElement === "function" && labelEl && labelEl.innerHTML !== undefined) {
          labelEl.innerHTML = `<span class="cf-metric-main"><strong class="cf-num">LKR ${fmt(totalMonthlyDebt)}</strong> <span class="cf-slash">/</span> <span class="cf-income">LKR ${fmt(s.income)}</span></span> <span class="cf-metric-badge is-committed">${dtiStr} of net monthly income committed</span> <span class="cf-metric-badge is-remaining">Remaining: LKR ${fmt(remainingIncome)}</span>`;
        }
      }

      const barEl = $("budgetCashflowBar");
      if (barEl) {
        if (isOverIncome) {
          const shortfall = totalMonthlyDebt - s.income;
          // Keep the track on a true 0–100% income scale. Excess belongs outside it,
          // otherwise the 40% / 50% markers falsely describe a compressed scale.
          const rW = Math.min(100, Math.max(0, rentalPctOfIncome));
          const dW = Math.min(100 - rW, Math.max(0, debtPctOfIncome));
          const iW = Math.min(100 - rW - dW, Math.max(0, insPctOfIncome));

          const rLabel = rW >= 12 ? `Rental ${fmtPct(rentalPctOfIncome)}` : "";
          const dLabel = dW >= 8 ? `Debt ${fmtPct(debtPctOfIncome)}` : "";
          const iLabel = iW >= 8 ? `Ins ${fmtPct(insPctOfIncome)}` : "";
          const sLabel = `Monthly shortfall: LKR ${fmt(shortfall)} · ${(dtiPct - 100).toFixed(1)}% beyond income`;

          if (typeof barEl.setAttribute === "function") {
            barEl.setAttribute("role", "img");
            barEl.setAttribute("aria-label", `Net income cashflow spectrum: ${dtiStr} of net monthly income committed. Lease rental LKR ${fmt(leaseRental)} (${rentalPctOfIncome.toFixed(1)}%), existing debt LKR ${fmt(s.debt)} (${debtPctOfIncome.toFixed(1)}%)${monthlyInsurance > 0 ? `, monthly insurance LKR ${fmt(monthlyInsurance)} (${insPctOfIncome.toFixed(1)}%)` : ""}. Monthly shortfall: LKR ${fmt(shortfall)}.`);
          }

          setBars(barEl, `<div class="cashflow-income-track"><div class="cashflow-seg-rental" style="width:${rW}%" title="Lease Rental: LKR ${fmt(leaseRental)} (${rentalPctOfIncome.toFixed(1)}% of net income)">${rLabel}</div><div class="cashflow-seg-debt" style="width:${dW}%" title="Existing Debt: LKR ${fmt(s.debt)} (${debtPctOfIncome.toFixed(1)}% of net income)">${dLabel}</div>${iW > 0 ? `<div class="cashflow-seg-ins" style="width:${iW}%" title="Monthly Insurance: LKR ${fmt(monthlyInsurance)} (${insPctOfIncome.toFixed(1)}% of net income)">${iLabel}</div>` : ""}</div><div class="cashflow-seg-shortfall">${sLabel}<span class="cashflow-breakdown">Rental ${fmtPct(rentalPctOfIncome)} · Existing payments ${fmtPct(debtPctOfIncome)}${monthlyInsurance > 0 ? ` · Insurance ${fmtPct(insPctOfIncome)}` : ""}</span></div>`, "[class^=\"cashflow-seg\"]");
        } else {
          const ceilingPct = s.dti * 100;
          const committedPct = rentalPctOfIncome + debtPctOfIncome + insPctOfIncome;
          const safeRoomPctOfIncome = Math.max(0, ceilingPct - committedPct);
          const freeIncomePct = Math.max(0, 100 - committedPct - safeRoomPctOfIncome);

          const rW = Math.min(100, Math.max(0, Math.round(rentalPctOfIncome * 10) / 10));
          const dW = Math.min(100 - rW, Math.max(0, Math.round(debtPctOfIncome * 10) / 10));
          const iW = Math.min(100 - rW - dW, Math.max(0, Math.round(insPctOfIncome * 10) / 10));
          const roomW = Math.min(100 - rW - dW - iW, Math.max(0, Math.round(safeRoomPctOfIncome * 10) / 10));
          const freeW = Math.max(0, Math.round((100 - rW - dW - iW - roomW) * 10) / 10);

          const rLabel = rW >= 12 ? `Rental ${fmtPct(rentalPctOfIncome)}` : "";
          const dLabel = dW >= 8 ? `Debt ${fmtPct(debtPctOfIncome)}` : "";
          const iLabel = iW >= 8 ? `Ins ${fmtPct(insPctOfIncome)}` : "";
          const roomLabel = roomW >= 10 ? `Buffer ${fmtPct(safeRoomPctOfIncome)}` : "";
          const freeLabel = freeW >= 15 ? `Discretionary ${fmtPct(freeIncomePct)}` : "";

          if (typeof barEl.setAttribute === "function") {
            barEl.setAttribute("role", "img");
            barEl.setAttribute("aria-label", `Net income cashflow spectrum: ${dtiStr} of net monthly income committed. Lease rental ${rentalPctOfIncome.toFixed(1)}%, existing debt ${debtPctOfIncome.toFixed(1)}%${monthlyInsurance > 0 ? `, monthly insurance ${insPctOfIncome.toFixed(1)}%` : ""}, available buffer within ${limit}% limit ${safeRoomPctOfIncome.toFixed(1)}%, discretionary uncommitted income ${freeIncomePct.toFixed(1)}%.`);
          }

          setBars(barEl, `<div class="cashflow-seg-rental" style="width:${rW}%" title="Lease Rental: LKR ${fmt(leaseRental)} (${rentalPctOfIncome.toFixed(1)}%)">${rLabel}</div><div class="cashflow-seg-debt" style="width:${dW}%" title="Existing Debt: LKR ${fmt(s.debt)} (${debtPctOfIncome.toFixed(1)}%)">${dLabel}</div>${iW > 0 ? `<div class="cashflow-seg-ins" style="width:${iW}%" title="Monthly Insurance: LKR ${fmt(monthlyInsurance)} (${insPctOfIncome.toFixed(1)}%)">${iLabel}</div>` : ""}<div class="cashflow-seg-room" style="width:${roomW}%" title="Buffer Within ${limit}% Limit: LKR ${fmt(room)} (${safeRoomPctOfIncome.toFixed(1)}%)">${roomLabel}</div><div class="cashflow-seg-free" style="width:${freeW}%" title="Discretionary: ${freeIncomePct.toFixed(1)}%">${freeLabel}</div>`, "[class^=\"cashflow-seg\"]");
        }
      }

      const gridEl = $("budgetTelemetryGrid");
      if (gridEl) {
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
          card1Sub = "100% cash purchase — LKR 0.00 rental";
        } else if (rows.length > 0) {
          card1Title = "Vehicle Lease Rental";
          card1Tag = "Proposed";
          card1TagClass = rows[0].status === "ok" ? "ok" : "bad";
          card1Val = rows[0].rental;
          if (isOverIncome) {
            card1Sub = `${esc(rows[0].name)} · Shortfall LKR ${fmt(totalMonthlyDebt - s.income)}/mo`;
          } else if (rows[0].rental > room) {
            card1Sub = `${esc(rows[0].name)} · LKR ${fmt(rows[0].rental - room)}/mo over ${limit}% limit`;
          } else {
            card1Sub = `${esc(rows[0].name)} (${rentalPctOfIncome.toFixed(1)}% of income)`;
          }
        }
        const bar1Class = card1TagClass === "bad" ? "bar-debt" : "bar-rental";

        const card2Title = "Existing Commitments";
        const card2Tag = s.debt > 0 ? "Loans / Cards" : "Zero Debt";
        const card2TagClass = s.debt > 0 ? (debtPctOfIncome > limit ? "bad" : "mid") : "ok";
        const card2Val = s.debt;
        const card2Sub = monthlyInsurance > 0
          ? `${debtPctOfIncome.toFixed(1)}% debt + ${insPctOfIncome.toFixed(1)}% insurance`
          : `${debtPctOfIncome.toFixed(1)}% of net monthly income`;

        const maxPrice = room > 0 ? (s.down >= 100 ? 0 : room / f / (1 - s.down / 100)) : 0;
        const maxUpfront = maxPrice * s.down / 100 + (s.fees || 0);
        const bar3W = Math.min(100, Math.max(0, Math.round(room > 0 ? 100 : 0)));
        const bar4W = Math.min(100, Math.max(0, Math.round(s.down)));

        let card3Title = "Max Vehicle Price";
        let card3Tag = `${s.down}% Down`;
        let card3TagClass = room > 0 || s.down >= 100 ? "ok" : "bad";
        let card3Val = maxPrice;
        let card3Sub = s.down < 60 ? "Over 1yr registered cars only" : `Financed at ${s.rateInput}% interest`;

        let card4Title = "Cash Needed Up Front";
        let card4Tag = s.fees ? "Deposit + Fees" : "Deposit";
        let card4TagClass = "ok";
        let card4Val = maxUpfront;
        let card4Sub = s.fees ? `Includes LKR ${fmt(s.fees)} fees` : `Deposit for highest price`;

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

        gridEl.innerHTML = `<div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card1Title}</span><span class="tag ${card1TagClass}">${card1Tag}</span></div><div class="telemetry-card-val val-rental">LKR ${fmt(card1Val)}</div><div class="telemetry-card-sub"><span>${card1Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill ${bar1Class}" style="width:${bar1W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card2Title}</span><span class="tag ${card2TagClass}">${card2Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card2Val)}</div><div class="telemetry-card-sub"><span>${card2Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-debt" style="width:${bar2W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card3Title}</span><span class="tag ${card3TagClass}">${card3Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card3Val)}</div><div class="telemetry-card-sub"><span>${card3Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-price" style="width:${bar3W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card4Title}</span><span class="tag ${card4TagClass}">${card4Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card4Val)}</div><div class="telemetry-card-sub"><span>${card4Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-upfront" style="width:${bar4W}%"></div></div></div>`;
      }
    }
  }

  let sentence = "", bar = "";
  if (!s.income) {
    sentence = `Monthly rental is LKR ${fmt(1e6 * f * (1 - s.down / 100))} for every LKR 1.00 million of price.`;
  } else if (s.down >= 100) {
    sentence = "100% cash purchase, no lease rental.";
  } else if (room <= 0) {
    const leaseRental = rows.length > 0 ? rows[0].rental : 0;
    const monthlyInsurance = s.insurance ? s.insurance / 12 : 0;
    const totalMonthlyDebt = leaseRental + s.debt + monthlyInsurance;
    if (totalMonthlyDebt > s.income) {
      const shortfall = totalMonthlyDebt - s.income;
      sentence = bar = `Commitments use ${((totalMonthlyDebt / s.income) * 100).toFixed(1)}% of net monthly income. Monthly shortfall: LKR ${fmt(shortfall)}.`;
    } else {
      sentence = bar = `Your existing payments already use up your ${limit}% limit. No room for a lease rental.`;
    }
  } else {
    const maxPrice = room / f / (1 - s.down / 100);
    const ok = rows.filter(r => r.status === "ok").length;
    sentence = `Highest monthly rental LKR ${fmt(room)}. Highest vehicle price LKR ${fmt(maxPrice)}. ${ok} of ${rows.length} vehicles fit your budget.`;
    bar = `Max rental LKR ${fmt(room)} · Max price LKR ${fmt(maxPrice)}`;
  }
  budgetBarText = bar;
  $("budgetBar").textContent = bar;
  syncBudgetBar();
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { $("budgetLive").textContent = sentence; }, 500);

  // Update Live Option D (Linear Cash Flow) and Option A (Borrowing Ceiling) views in test build
  const linearStackEl = $("linearStackBar");
  const linearMetricsEl = $("linearMetricsGrid");
  const ceilingGridEl = $("ceilingCardsGrid");
  const ceilingBarEl = $("ceilingRoomBar");

  if (s.income) {
    const leaseRental = s.down >= 100 ? 0 : (rows.length > 0 ? rows[0].rental : (room > 0 ? room : 0));
    const monthlyInsurance = s.insurance ? s.insurance / 12 : 0;
    const totalMonthlyDebt = leaseRental + s.debt + monthlyInsurance;
    const dtiPct = s.income > 0 ? (totalMonthlyDebt / s.income) * 100 : 0;
    const dtiStr = dtiPct.toFixed(1) + "%";
    const isOffScale = dtiPct > 60;
    const isOverIncome = dtiPct > 100;

    let statusClass = "ok";
    let statusText = `Within ${DTI_STANDARD_PCT}% Standard Limit`;
    if (dtiPct <= DTI_STANDARD_PCT) {
      statusClass = "ok";
      statusText = `Within ${DTI_STANDARD_PCT}% Standard Limit`;
    } else if (dtiPct <= DTI_STRETCH_PCT) {
      statusClass = "mid";
      statusText = `Stretching (${DTI_STANDARD_PCT} - ${DTI_STRETCH_PCT}% Cap)`;
    } else if (dtiPct <= 60) {
      statusClass = "bad";
      statusText = `Limit Exceeded (> ${DTI_STRETCH_PCT}%)`;
    } else if (dtiPct <= 100) {
      statusClass = "bad is-critical-pill";
      statusText = `Critical Risk: ${dtiStr} DTI (>50% Limit · Off-Scale 60%+)`;
    } else {
      statusClass = "bad is-critical-pill";
      statusText = `Critical: Exceeds 100% of Income (Off-Scale 60%+)`;
    }

    if ($("linearDtiPill")) $("linearDtiPill").className = "classic-dti-pill " + statusClass;
    if ($("linearDtiText")) $("linearDtiText").textContent = statusText;
    if ($("linearBudgetSubtitle")) {
      $("linearBudgetSubtitle").textContent = rows.length > 0
        ? `Evaluating ${rows[0].name} against LKR ${fmt(s.income)}/mo net income`
        : `Evaluating ceiling against LKR ${fmt(s.income)}/mo net income`;
    }

    const rentalPct = Math.min(100, (leaseRental / s.income) * 100);
    const debtPct = Math.min(100 - rentalPct, (s.debt / s.income) * 100);
    const insurancePct = Math.min(100 - rentalPct - debtPct, (monthlyInsurance / s.income) * 100);
    const bufferPct = Math.max(0, 100 - rentalPct - debtPct - insurancePct);

    if (linearStackEl) {
      linearStackEl.innerHTML = `
        <div class="linear-stack-seg linear-seg-debt" style="width:${debtPct}%" title="Existing Debt: LKR ${fmt(s.debt)} (${debtPct.toFixed(1)}%)">Debt ${debtPct.toFixed(1)}%</div>
        <div class="linear-stack-seg linear-seg-lease ${isOffScale ? "is-critical" : dtiPct > DTI_STANDARD_PCT ? "is-stretch" : ""}" style="width:${rentalPct}%" title="Lease: LKR ${fmt(leaseRental)} (${rentalPct.toFixed(1)}%)">Lease ${rentalPct.toFixed(1)}%</div>
        <div class="linear-stack-seg linear-seg-insurance" style="width:${insurancePct}%" title="Insurance: LKR ${fmt(monthlyInsurance)} (${insurancePct.toFixed(1)}%)">Insurance ${insurancePct.toFixed(1)}%</div>
        <div class="linear-stack-seg linear-seg-buffer" style="width:${bufferPct}%" title="Living Buffer: LKR ${fmt(Math.max(0, s.income - totalMonthlyDebt))} (${bufferPct.toFixed(1)}%)">Buffer ${bufferPct.toFixed(1)}%</div>
      `;
    }

    if (linearMetricsEl) {
      linearMetricsEl.innerHTML = `
        <div class="linear-metric-card">
          <span class="linear-metric-label">Monthly Commitments</span>
          <span class="linear-metric-val">LKR ${fmt(totalMonthlyDebt)}</span>
          <span class="linear-metric-sub">${dtiStr} of net income (${statusText})</span>
        </div>
        <div class="linear-metric-card">
          <span class="linear-metric-label">Primary Lease Rental</span>
          <span class="linear-metric-val">LKR ${fmt(leaseRental)}</span>
          <span class="linear-metric-sub">${rows.length > 0 ? esc(rows[0].name) : "Lease room"}</span>
        </div>
        <div class="linear-metric-card">
          <span class="linear-metric-label">Remaining Living Buffer</span>
          <span class="linear-metric-val">LKR ${fmt(Math.max(0, s.income - totalMonthlyDebt))}</span>
          <span class="linear-metric-sub">${bufferPct.toFixed(1)}% uncommitted cash flow</span>
        </div>
      `;
    }

    const maxP = room > 0 ? (s.down >= 100 ? 0 : room / f / (1 - s.down / 100)) : 0;
    const maxUpfront = maxP * (s.down / 100) + (s.fees || 0);

    if ($("ceilingStatusTag")) $("ceilingStatusTag").textContent = `${limit}% CBSL Standard Limit`;
    if (ceilingGridEl) {
      ceilingGridEl.innerHTML = `
        <div class="ceiling-stat-card">
          <span class="ceiling-stat-label">Safe Monthly Lease Room</span>
          <span class="ceiling-stat-val">LKR ${fmt(room)}</span>
          <span class="ceiling-stat-sub">Maximum safe rental at your ${limit}% limit</span>
        </div>
        <div class="ceiling-stat-card">
          <span class="ceiling-stat-label">Highest Vehicle Price</span>
          <span class="ceiling-stat-val">LKR ${fmt(maxP)}</span>
          <span class="ceiling-stat-sub">With ${s.down}% cash deposit (${s.down < 60 ? "Over 1yr reg" : "All cars"})</span>
        </div>
        <div class="ceiling-stat-card">
          <span class="ceiling-stat-label">Up-front Cash Needed</span>
          <span class="ceiling-stat-val">LKR ${fmt(maxUpfront)}</span>
          <span class="ceiling-stat-sub">${s.down}% deposit${s.fees ? ` + LKR ${fmt(s.fees)} fees` : ""}</span>
        </div>
      `;
    }

    const debtW = Math.min(100, (s.debt / s.income) * 100);
    const roomW = Math.min(100 - debtW, (room / s.income) * 100);
    const unborrowedW = Math.max(0, 100 - debtW - roomW);

    if (ceilingBarEl) {
      ceilingBarEl.innerHTML = `
        <div class="linear-stack-seg linear-seg-debt" style="width:${debtW}%" title="Existing Debt: LKR ${fmt(s.debt)}">Debt ${debtW.toFixed(1)}%</div>
        <div class="linear-stack-seg linear-seg-lease" style="width:${roomW}%" title="Available Safe Room: LKR ${fmt(room)}">Room ${roomW.toFixed(1)}%</div>
        <div class="linear-stack-seg linear-seg-buffer" style="width:${unborrowedW}%" title="Unborrowed Living Buffer: ${(unborrowedW).toFixed(1)}%">Buffer ${unborrowedW.toFixed(1)}%</div>
      `;
    }
    if ($("ceilingRoomRatioText")) {
      $("ceilingRoomRatioText").textContent = room > 0
        ? `LKR ${fmt(room)} / mo available for vehicle lease`
        : "Existing commitments exceed limit — no lease room";
    }
  } else {
    if (linearStackEl) linearStackEl.innerHTML = `<div class="linear-stack-seg linear-seg-buffer linear-stack-placeholder">Enter net monthly income above to see cashflow allocation</div>`;
    if ($("linearDtiPill")) $("linearDtiPill").className = "classic-dti-pill pending";
    if ($("linearDtiText")) $("linearDtiText").textContent = "Enter Net Monthly Income";
    if ($("linearBudgetSubtitle")) $("linearBudgetSubtitle").textContent = "Enter net monthly income to evaluate cashflow allocation";
    if (linearMetricsEl) {
      linearMetricsEl.innerHTML = `
        <div class="linear-metric-card">
          <span class="linear-metric-label">Monthly Commitments</span>
          <span class="linear-metric-val">LKR 0.00</span>
          <span class="linear-metric-sub">Add income above</span>
        </div>
        <div class="linear-metric-card">
          <span class="linear-metric-label">Primary Lease Rental</span>
          <span class="linear-metric-val">LKR ${fmt(rows.length > 0 ? rows[0].rental : 0)}</span>
          <span class="linear-metric-sub">${rows.length > 0 ? esc(rows[0].name) : "No car selected"}</span>
        </div>
        <div class="linear-metric-card">
          <span class="linear-metric-label">Living Buffer</span>
          <span class="linear-metric-val">Pending</span>
          <span class="linear-metric-sub">Enter monthly income</span>
        </div>
      `;
    }
    if (ceilingGridEl) {
      const card3Val = 1e6 * f * (1 - s.down / 100) / s.dti;
      ceilingGridEl.innerHTML = `
        <div class="ceiling-stat-card">
          <span class="ceiling-stat-label">Rental / LKR 1M</span>
          <span class="ceiling-stat-val">LKR ${fmt(1e6 * f * (1 - s.down / 100))}</span>
          <span class="ceiling-stat-sub">Monthly rental per 1M price</span>
        </div>
        <div class="ceiling-stat-card">
          <span class="ceiling-stat-label">Income Needed / LKR 1M</span>
          <span class="ceiling-stat-val">LKR ${fmt(card3Val)}</span>
          <span class="ceiling-stat-sub">At ${limit}% limit</span>
        </div>
        <div class="ceiling-stat-card">
          <span class="ceiling-stat-label">CBSL Down Payment</span>
          <span class="ceiling-stat-val">${s.down}%</span>
          <span class="ceiling-stat-sub">Statutory deposit floor</span>
        </div>
      `;
    }
    if (ceilingBarEl) ceilingBarEl.innerHTML = `<div class="linear-stack-seg linear-seg-buffer linear-stack-placeholder">Enter net income to calculate borrowing ceiling</div>`;
    if ($("ceilingRoomRatioText")) $("ceilingRoomRatioText").textContent = "Enter net monthly income above";
  }
}

function updateLtvBar(s, rows) {
  const trackEl = $("ltvBarTrack");
  if (!trackEl) return;
  const dpPct = Math.min(100, Math.max(0, s.down));
  const loanPct = Math.max(0, 100 - dpPct);
  setBars(trackEl, `<div class="ltv-bar-dp" id="ltvBarDp" style="width:${dpPct}%"><span id="ltvBarDpText">${dpPct}% Cash Deposit</span></div><div class="ltv-bar-loan" id="ltvBarLoan" style="width:${loanPct}%"><span id="ltvBarLoanText">${loanPct}% Financed Loan</span></div>`, ".ltv-bar-dp, .ltv-bar-loan");

  const badgeEl = $("ltvEligibilityBadge");
  if (badgeEl) {
    if (dpPct >= 100) { badgeEl.className = "tag ok"; badgeEl.textContent = "100% Cash Purchase"; }
    else if (dpPct >= 60) { badgeEl.className = "tag ok"; badgeEl.textContent = "CBSL Compliant (All Vehicles)"; }
    else if (dpPct >= 40) { badgeEl.className = "tag mid"; badgeEl.textContent = "CBSL Compliant (>1yr Reg Only)"; }
    else { badgeEl.className = "tag bad"; badgeEl.textContent = "Below CBSL Minimum"; }
  }
  const detailDp = $("ltvDetailDp");
  if (detailDp) detailDp.textContent = rows.length > 0 ? `LKR ${fmt(rows[0].dp)} (${dpPct}%)` : `${dpPct}% Deposit`;
  const detailLoan = $("ltvDetailLoan");
  if (detailLoan) detailLoan.textContent = rows.length > 0 ? `LKR ${fmt(rows[0].loan)} (${loanPct.toFixed(1)}% LTV)` : `${loanPct.toFixed(1)}% LTV`;
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
// An IntersectionObserver reports visibility without measuring layout on every scroll, which
// was a forced reflow at load. Without one, the panel is measured directly.
let budgetPanelVisible = null;
function syncBudgetBar() {
  let panelVisible = budgetPanelVisible;
  if (panelVisible === null) {
    const box = $("budgetPanel").getBoundingClientRect ? $("budgetPanel").getBoundingClientRect() : null;
    panelVisible = !box || (box.bottom > 0 && box.top < window.innerHeight);
  }
  const show = !!budgetBarText && !panelVisible;
  $("budgetBar").hidden = !show;
  if (document.body && document.body.classList) document.body.classList.toggle("has-budget-bar", show);
}
if (typeof IntersectionObserver === "function" && typeof document.getElementById === "function" && $("budgetPanel")) {
  new IntersectionObserver(entries => {
    budgetPanelVisible = entries[entries.length - 1].isIntersecting;
    syncBudgetBar();
  }).observe($("budgetPanel"));
} else if (typeof window.addEventListener === "function") {
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
  for (const id of ["rate", "tenure", "down", "plannerPercent"]) {
    const el = $(id);
    if (!el) continue;
    const val = num(el);
    const min = Number(el.min) || (id === "down" ? DOWN_MIN : id === "tenure" ? MIN_TENURE : 0);
    const max = Number(el.max) || (id === "down" ? DOWN_MAX : id === "tenure" ? MAX_TENURE : MAX_INPUT_RATE);
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
          chip.title = chipVal === DOWN_MIN
            ? `CBSL ${DOWN_MIN}% minimum for vehicles registered over 1 year`
            : chipVal === DOWN_MIN_UNREG
            ? `CBSL ${DOWN_MIN_UNREG}% minimum for new and reconditioned vehicles`
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
  const minDown = Number($("down")?.min) || DOWN_MIN;
  const canForty = minDown <= DOWN_MIN;

  const stratBtns = document.querySelectorAll("button[data-strategy]");
  stratBtns.forEach(btn => {
    const strat = btn.dataset.strategy;
    let active = false;
    if (strat === "lowest-rental") {
      active = (tenureVal === STRATEGY_PRESETS.LOWEST_RENTAL.tenure && downVal === STRATEGY_PRESETS.LOWEST_RENTAL.down && rateTypeVal === STRATEGY_PRESETS.LOWEST_RENTAL.rateType);
    } else if (strat === "fast-payoff") {
      active = (tenureVal === STRATEGY_PRESETS.FAST_PAYOFF.tenure && downVal === STRATEGY_PRESETS.FAST_PAYOFF.down && rateTypeVal === STRATEGY_PRESETS.FAST_PAYOFF.rateType);
    } else if (strat === "min-cash") {
      active = (tenureVal === STRATEGY_PRESETS.MIN_CASH.tenure && downVal === STRATEGY_PRESETS.MIN_CASH.down && rateTypeVal === STRATEGY_PRESETS.MIN_CASH.rateType);
      btn.disabled = false;
      btn.title = `CBSL minimum ${DOWN_MIN}% deposit (for vehicles registered over 1 year)`;
    } else if (strat === "cash-purchase") {
      active = (downVal === STRATEGY_PRESETS.CASH_PURCHASE.down);
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
      const min = el.min !== "" && !isNaN(Number(el.min)) ? Number(el.min) : (id === "down" ? DOWN_MIN : id === "tenure" ? MIN_TENURE : 0);
      const max = el.max !== "" && !isNaN(Number(el.max)) ? Number(el.max) : (id === "down" ? DOWN_MAX : id === "tenure" ? MAX_TENURE : MAX_INPUT_RATE);
      let next = Math.min(max, Math.max(min, Math.round((cur + delta) * 10) / 10));
      if (id !== "rate") next = Math.round(next);
      el.value = String(next);
      el.dispatchEvent(new Event("input", { bubbles: true }));
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
      if ($("tenure")) $("tenure").value = String(STRATEGY_PRESETS.LOWEST_RENTAL.tenure);
      if ($("down")) $("down").value = String(STRATEGY_PRESETS.LOWEST_RENTAL.down);
      if ($("rateType")) $("rateType").value = STRATEGY_PRESETS.LOWEST_RENTAL.rateType;
    } else if (strat === "fast-payoff") {
      if ($("tenure")) $("tenure").value = String(STRATEGY_PRESETS.FAST_PAYOFF.tenure);
      if ($("down")) $("down").value = String(STRATEGY_PRESETS.FAST_PAYOFF.down);
      if ($("rateType")) $("rateType").value = STRATEGY_PRESETS.FAST_PAYOFF.rateType;
    } else if (strat === "min-cash") {
      if ($("tenure")) $("tenure").value = String(STRATEGY_PRESETS.MIN_CASH.tenure);
      if ($("down")) {
        $("down").min = String(STRATEGY_PRESETS.MIN_CASH.down);
        $("down").value = "40";
      }
      if ($("rateType")) $("rateType").value = STRATEGY_PRESETS.MIN_CASH.rateType;
    } else if (strat === "cash-purchase") {
      if ($("down")) $("down").value = String(STRATEGY_PRESETS.CASH_PURCHASE.down);
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
  const qfBtn = e.target.closest("button[data-qf]");
  if (qfBtn) {
    const nextQf = qfBtn.dataset.qf || "all";
    activeQuickFilter = activeQuickFilter === nextQf && nextQf !== "all" ? "all" : nextQf;
    syncQuickFilterChips();
    render();
    return;
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
  activeQuickFilter = "all";
  applyState({});
  try { history.replaceState(null, "", window.location.pathname + window.location.hash); } catch (e) {}
  render();
  $("rate").focus();
});

if ($("resetFiltersBtn") && typeof $("resetFiltersBtn").addEventListener === "function") {
  $("resetFiltersBtn").addEventListener("click", () => {
    for (const [id, def] of Object.entries(FILTER_DEFAULTS)) {
      if ($(id)) $(id).value = def;
    }
    sortKey = "price";
    sortDir = -1;
    activeQuickFilter = "all";
    syncQuickFilterChips();
    render();
  });
}

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
    pinnedKeys.delete(key);
    changeWithUndo(idx, `Removed ${car.name}.`, () => { cars.splice(idx, 1); });
  } else if (act === "details") {
    openDetails(car, b);
  } else if (act === "pin") {
    if (pinnedKeys.has(key)) {
      pinnedKeys.delete(key);
    } else {
      if (pinnedKeys.size >= 3) {
        showToast("You can compare up to 3 vehicles head-to-head.");
        return;
      }
      pinnedKeys.add(key);
    }
    render();
    focusRowControl(key, "pin");
  } else if (act === "cond") {
    const cycle = { New: "Recond", Recond: "Recent", Recent: "Used", Used: "New" };
    car.cond = cycle[car.cond || "New"] || "New";
    delete car.conditionAssumed;
    if (Number.isFinite(car.downOverride) && car.downOverride > 0) {
      const minDown = minDownFor(car.cond, car.financeClass, car.firstRegisteredOn);
      car.downOverride = Math.max(minDown, car.downOverride);
    }
    car.custom = true;
    car.priceBasis = "user-entered";
    car.priceSourceUrl = null;
    saveCars(cars);
    render();
    if (car.cond !== "New") {
      const edit = $("rows").querySelector(`[data-key="${key}"][data-act="price"]`);
      if (edit) {
        startPriceEdit(edit, car, { clearInitial: true });
      } else {
        focusRowControl(key, "cond");
      }
      showToast(`${car.name} is now ${condLabel(car.cond)}. Enter your quotation or marketplace listing price.`);
    } else {
      focusRowControl(key, "cond");
      showToast(`${car.name} is now ${condLabel(car.cond)}. Check its price for this condition.`, "Edit Price", () => {
        const edit = $("rows").querySelector(`[data-key="${key}"][data-act="price"]`);
        if (edit) startPriceEdit(edit, car);
      });
    }
  } else if (act === "price") {
    startPriceEdit(b, car);
  } else if (act === "dp") {
    startDpEdit(b, car);
  } else if (act === "reset-dp") {
    delete car.downOverride;
    saveCars(cars);
    render();
    focusRowControl(key, "dp");
    showToast(`Reset ${car.name} to the shared down payment.`);
  }
});

function startDpEdit(btn, car) {
  const wrap = btn.closest(".dp-wrap");
  if (!wrap || wrap.hidden) return;
  const minDown = minDownFor(car.cond, car.financeClass, car.firstRegisteredOn);
  const s = readSettings();
  const curPct = Number.isFinite(car.downOverride) && car.downOverride > 0
    ? Math.min(100, Math.max(minDown, car.downOverride))
    : Math.min(100, Math.max(minDown, s.down));
  const editor = document.createElement("span");
  editor.className = "inline-dp-editor";
  const input = document.createElement("input");
  input.type = "number";
  input.className = "inline-dp-input";
  input.min = String(minDown);
  input.max = "100";
  input.step = "1";
  input.inputMode = "decimal";
  input.value = String(curPct);
  input.setAttribute("aria-label", `Down payment percentage for ${car.name} (${minDown}% to 100%)`);
  const suffix = document.createElement("span");
  suffix.className = "inline-dp-suffix";
  suffix.textContent = "%";
  suffix.setAttribute("aria-hidden", "true");
  editor.append(input, suffix);
  wrap.hidden = true;
  wrap.after(editor);
  input.focus();
  input.select();

  let done = false;
  const finish = save => {
    if (done) return;
    done = true;
    const rawVal = parseFloat(input.value);
    if (save && Number.isFinite(rawVal)) {
      const clamped = Math.min(100, Math.max(minDown, Math.round(rawVal * 10) / 10));
      car.downOverride = clamped;
      car.custom = true;
      saveCars(cars);
    }
    editor.remove();
    wrap.hidden = false;
    render();
    focusRowControl(car._key, "dp");
  };
  input.addEventListener("keydown", evt => {
    if (evt.key === "Enter") { evt.preventDefault(); finish(true); }
    else if (evt.key === "Escape") { evt.preventDefault(); evt.stopPropagation(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true));
}

function startPriceEdit(btn, car, { clearInitial = false } = {}) {
  const wrap = btn.closest(".price-wrap");
  if (!wrap || wrap.hidden) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "inline-price-input";
  input.inputMode = "numeric";
  input.value = clearInitial ? "" : formatMoneyText(String(car.price));
  input.placeholder = clearInitial ? "Enter quote / listing price" : formatMoneyText(String(car.price));
  input.setAttribute("aria-label", `Price for ${car.name}`);
  wrap.hidden = true;
  wrap.after(input);
  attachMoneyInput(input);
  input.focus();
  if (!clearInitial) input.select();

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
        <div class="donut-chart-box" id="donutChartBox">
          <svg class="donut-svg" id="donutSvg" viewBox="0 0 100 100" role="img" aria-label="Cost composition donut chart">
            <g transform="rotate(-90 50 50)">
              <circle cx="50" cy="50" r="38" class="donut-bg-circle"/>
              <g id="donutSegmentsGroup"></g>
            </g>
          </svg>
          <div class="donut-center-info">
            <span class="donut-center-label" id="donutCenterLabel">Lifetime Outlay</span>
            <span class="donut-center-amount" id="donutCenterAmount"></span>
            <span class="donut-center-pct" id="donutCenterPct"></span>
          </div>
        </div>
        <div class="donut-legend" id="donutLegend"></div>
      </div>
    </div>
  `;
}

function updateDonutContent(car, r, s, mode) {
  const chartBox = $("donutChartBox");
  const segmentsGroup = $("donutSegmentsGroup");
  const centerLabel = $("donutCenterLabel");
  const centerAmount = $("donutCenterAmount");
  const centerPct = $("donutCenterPct");
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
        subtitle: `${s.n} monthly instalments`
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
  centerAmount.textContent = "LKR " + fmtM(total);
  if (centerPct) centerPct.textContent = "";

  const circ = 2 * Math.PI * 38;
  let cumOffset = 0;
  let segsHtml = "";

  if (positiveItems.length === 0) {
    segsHtml = `<circle cx="50" cy="50" r="38" class="donut-seg donut-seg-accent" stroke-dasharray="${circ} 0" stroke-dashoffset="0"/>`;
  } else {
    positiveItems.forEach((item, i) => {
      item.segIdx = i;
      const pct = item.val / total;
      const pctStr = (pct * 100).toFixed(1) + "%";
      const dash = (pct * circ).toFixed(2);
      const gap = (circ - parseFloat(dash)).toFixed(2);
      const off = (-cumOffset).toFixed(2);
      segsHtml += `<circle cx="50" cy="50" r="38" class="donut-seg ${item.segClass}" data-seg-idx="${i}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${off}" tabindex="0" role="button" aria-label="${esc(item.label)}: LKR ${fmt(item.val)} (${pctStr})"><title>${esc(item.label)}: LKR ${fmt(item.val)} (${pctStr})</title></circle>`;
      cumOffset += pct * circ;
    });
  }
  segmentsGroup.innerHTML = segsHtml;

  let legendHtml = "";
  items.forEach(item => {
    const hasSeg = item.segIdx !== undefined && item.segIdx >= 0;
    const pctStr = total > 0 && item.val > 0 ? ((item.val / total) * 100).toFixed(1) + "%" : "0.0%";
    legendHtml += `
      <div class="legend-item" data-legend-idx="${hasSeg ? item.segIdx : -1}" tabindex="0" role="button" aria-label="${esc(item.label)}: LKR ${fmt(item.val)} (${pctStr})">
        <div class="legend-lead">
          <span class="legend-dot ${item.dotClass}"></span>
          <div>
            <div class="legend-title">${esc(item.label)}</div>
            <div class="legend-subtitle">${esc(item.subtitle)}</div>
          </div>
        </div>
        <div>
          <div class="legend-val">LKR ${fmt(item.val)}</div>
          <div class="legend-pct">${pctStr} of total</div>
        </div>
      </div>
    `;
  });
  legend.innerHTML = legendHtml;

  const defaultLabel = mode === "monthly" ? "Monthly Outlay" : "Lifetime Outlay";
  const defaultAmount = "LKR " + fmtM(total);

  function highlightSegment(idx) {
    if (idx < 0) return;
    const item = positiveItems[idx];
    if (!item) return;
    const pctStr = total > 0 ? ((item.val / total) * 100).toFixed(1) + "% of total" : "";
    if (chartBox) chartBox.classList.add("has-hover");
    segmentsGroup.querySelectorAll(".donut-seg").forEach(seg => {
      seg.classList.toggle("active", seg.dataset.segIdx === String(idx));
    });
    legend.querySelectorAll(".legend-item").forEach(leg => {
      leg.classList.toggle("active", leg.dataset.legendIdx === String(idx));
    });
    centerLabel.textContent = item.label;
    centerAmount.textContent = "LKR " + fmtM(item.val);
    if (centerPct) centerPct.textContent = `${pctStr} · LKR ${fmt(item.val)}`;
  }

  function resetSegment() {
    if (chartBox) chartBox.classList.remove("has-hover");
    segmentsGroup.querySelectorAll(".donut-seg").forEach(seg => seg.classList.remove("active"));
    legend.querySelectorAll(".legend-item").forEach(leg => leg.classList.remove("active"));
    centerLabel.textContent = defaultLabel;
    centerAmount.textContent = defaultAmount;
    if (centerPct) centerPct.textContent = "";
  }

  segmentsGroup.querySelectorAll(".donut-seg[data-seg-idx]").forEach(seg => {
    const idx = Number(seg.dataset.segIdx);
    seg.addEventListener("mouseenter", () => highlightSegment(idx));
    seg.addEventListener("focus", () => highlightSegment(idx));
    seg.addEventListener("mouseleave", resetSegment);
    seg.addEventListener("blur", resetSegment);
  });

  legend.querySelectorAll(".legend-item[data-legend-idx]").forEach(leg => {
    const idx = Number(leg.dataset.legendIdx);
    if (idx >= 0) {
      leg.addEventListener("mouseenter", () => highlightSegment(idx));
      leg.addEventListener("focus", () => highlightSegment(idx));
      leg.addEventListener("mouseleave", resetSegment);
      leg.addEventListener("blur", resetSegment);
    }
  });
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

  const hitW = (xStep * 0.9).toFixed(1);

  markersHtml += `
    <g class="amort-point-group" data-year="0" data-x="${xStart}" tabindex="0" role="button" aria-label="Year 0: Initial Principal LKR ${fmt(r.loan)}, Interest LKR 0.00">
      <rect x="${(xStart - hitW / 2).toFixed(1)}" y="20" width="${hitW}" height="140" class="amort-hitzone"><title>Year 0: Initial Principal LKR ${fmt(r.loan)}</title></rect>
      <circle cx="${xStart}" cy="${y(r.loan)}" r="4.5" class="amort-marker-principal"></circle>
      <circle cx="${xStart}" cy="${y(0)}" r="4" class="amort-marker-interest"></circle>
    </g>
  `;

  let cumInterest = 0;
  years.forEach((yr, i) => {
    const x = (xStart + (i + 1) * xStep).toFixed(1);
    cumInterest += yr.interest;
    const yP = y(yr.balance);
    const yI = y(cumInterest);

    princPts.push(`${x},${yP}`);
    intPts.push(`${x},${yI}`);

    markersHtml += `
      <g class="amort-point-group" data-year="${yr.year}" data-x="${x}" tabindex="0" role="button" aria-label="Year ${yr.year}: Principal Remaining LKR ${fmt(yr.balance)}, Cumulative Interest LKR ${fmt(cumInterest)}">
        <rect x="${(x - hitW / 2).toFixed(1)}" y="20" width="${hitW}" height="140" class="amort-hitzone"><title>Year ${yr.year}: Principal Remaining LKR ${fmt(yr.balance)} · Interest LKR ${fmt(cumInterest)}</title></rect>
        <circle cx="${x}" cy="${yP}" r="4.5" class="amort-marker-principal"></circle>
        <circle cx="${x}" cy="${yI}" r="4" class="amort-marker-interest"></circle>
      </g>
    `;
    xLabelsHtml += `<text x="${x}" y="178" class="amort-axis-label" text-anchor="middle">Yr ${yr.year}</text>`;
  });

  const princAreaPts = `${xStart},${yBase} ${princPts.join(" ")} ${xEnd},${yBase}`;
  const intAreaPts = `${xStart},${yBase} ${intPts.join(" ")} ${xEnd},${yBase}`;

  return `
    <div class="amort-card">
      <div class="amort-head">
        <h3 class="amort-title">Loan Amortisation Paydown Curve</h3>
        <div class="amort-legend-row">
          <span class="amort-legend-item"><span class="amort-legend-color amort-color-principal"></span> Principal Balance Remaining</span>
          <span class="amort-legend-item"><span class="amort-legend-color amort-color-interest"></span> Cumulative Interest Paid</span>
        </div>
      </div>
      <div class="amort-inspection-panel" id="amortInspectionPanel" aria-live="polite">
        <span class="amort-inspect-guide"><span class="glyph glyph-sliders-horizontal" aria-hidden="true"></span> Hover or tap year points to inspect annual amortisation balance</span>
      </div>
      <div class="amort-svg-box">
        <svg class="amort-svg" id="amortSvg" viewBox="0 0 680 200" aria-label="Amortisation schedule curve">
          <line x1="55" y1="20" x2="660" y2="20" class="amort-grid-line"/>
          <line x1="55" y1="90" x2="660" y2="90" class="amort-grid-line"/>
          <line x1="55" y1="160" x2="660" y2="160" class="amort-grid-line"/>
          <line x1="55" y1="160" x2="660" y2="160" class="amort-axis-base"/>
          <line id="amortCursorHairline" x1="55" y1="20" x2="55" y2="160" class="amort-cursor-hairline" hidden/>

          <polygon points="${princAreaPts}" class="amort-principal-area"/>
          <polyline points="${princPts.join(" ")}" class="amort-principal-line"/>

          <polygon points="${intAreaPts}" class="amort-interest-area"/>
          <polyline points="${intPts.join(" ")}" class="amort-interest-line"/>

          <g id="amortMarkersGroup">${markersHtml}</g>
          <g>${xLabelsHtml}</g>

          <text x="48" y="24" class="amort-axis-label" text-anchor="end">LKR ${fmtM(maxVal)}</text>
          <text x="48" y="94" class="amort-axis-label" text-anchor="end">LKR ${fmtM(maxVal / 2)}</text>
          <text x="48" y="164" class="amort-axis-label" text-anchor="end">LKR 0</text>
        </svg>
      </div>
    </div>
  `;
}

function setupAmortizationInteractions(r, s, years) {
  const panel = $("amortInspectionPanel");
  const hairline = $("amortCursorHairline");
  const svg = $("amortSvg");
  if (!panel || !svg || !years || !years.length) return;

  const defaultHtml = '<span class="amort-inspect-guide"><span class="glyph glyph-sliders-horizontal" aria-hidden="true"></span> Hover or tap year points to inspect annual amortisation balance</span>';

  function activateYear(yearNum, x) {
    if (hairline) {
      hairline.setAttribute("x1", String(x));
      hairline.setAttribute("x2", String(x));
      hairline.hidden = false;
    }
    const groups = svg.querySelectorAll(".amort-point-group");
    groups.forEach(g => {
      g.classList.toggle("active", g.dataset.year === String(yearNum));
    });

    const rows = document.querySelectorAll("tr[data-amort-yr]");
    rows.forEach(tr => {
      tr.classList.toggle("active-table-row", tr.dataset.amortYr === String(yearNum));
    });

    if (yearNum === 0) {
      panel.innerHTML = `
        <div class="amort-inspect-active">
          <span class="amort-inspect-yr">Year 0 (Start)</span>
          <span class="amort-inspect-metric principal"><b>Initial Principal Financed:</b> LKR ${fmt(r.loan)}</span>
          <span class="amort-inspect-metric interest"><b>Cumulative Interest:</b> LKR 0.00</span>
        </div>
      `;
    } else {
      const yrData = years.find(y => y.year === Number(yearNum));
      if (yrData) {
        let cumInt = 0;
        for (let i = 0; i < yrData.year; i++) cumInt += years[i].interest;
        panel.innerHTML = `
          <div class="amort-inspect-active">
            <span class="amort-inspect-yr">Year ${yrData.year}${yrData.months < 12 ? ` (${yrData.months}m)` : ""}</span>
            <span class="amort-inspect-metric principal"><b>Principal Remaining:</b> LKR ${fmt(yrData.balance)}</span>
            <span class="amort-inspect-metric interest"><b>Cumulative Interest:</b> LKR ${fmt(cumInt)}</span>
            <span class="amort-inspect-metric paid"><b>Rentals in Year:</b> LKR ${fmt(yrData.paid)}</span>
          </div>
        `;
      }
    }
  }

  function reset() {
    if (hairline) hairline.hidden = true;
    svg.querySelectorAll(".amort-point-group").forEach(g => g.classList.remove("active"));
    document.querySelectorAll("tr[data-amort-yr]").forEach(tr => tr.classList.remove("active-table-row"));
    panel.innerHTML = defaultHtml;
  }

  svg.querySelectorAll(".amort-point-group").forEach(g => {
    const yr = Number(g.dataset.year);
    const x = g.dataset.x;
    g.addEventListener("mouseenter", () => activateYear(yr, x));
    g.addEventListener("focus", () => activateYear(yr, x));
  });

  svg.addEventListener("mouseleave", reset);

  document.querySelectorAll("tr[data-amort-yr]").forEach(tr => {
    const yr = Number(tr.dataset.amortYr);
    const g = svg.querySelector(`.amort-point-group[data-year="${yr}"]`);
    if (g) {
      const x = g.dataset.x;
      tr.addEventListener("mouseenter", () => activateYear(yr, x));
      tr.addEventListener("mouseleave", reset);
    }
  });
}

// Lease details: the numbers behind one row, and the balance year by year
function openDetails(car, opener) {
  const { s, rows: [r] } = computeLeaseTable([car], readSettings());
  const limit = Math.round(s.dti * 100);
  const line = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const candidateCredit = creditFor(car);
  const photo = candidateCredit?.largeImg || candidateCredit?.img || photoForModel(car);
  const credit = candidateCredit;
  let html = "";
  if (photo) {
    html += `<div class="detail-photo"><img src="${esc(photo)}" alt="${esc(car.name || "Vehicle")}" loading="lazy"></div>${credit ? `<div class="source-links detail-source">${formatCreditHtml(credit)}</div>` : ""}`;
  }
  html += `<p class="detail-sub">${esc(condLabel(car.cond))} · LKR ${fmt(car.price)} · ${esc(rateLabel(s))} over ${s.n} months</p><dl class="detail-list">`;
  if (r.downPct >= 100) {
    html += line("Paid in cash", `LKR ${fmt(car.price)}`) + "</dl><p class=\"hint\">With a 100% down payment there's no lease to repay.</p>";
    html += renderCostDonutMarkup();
  } else {
    const extras = s.fees || s.insurance;
    html += line(`Down payment (${r.downPct}%${r.downCustom ? ", custom override for this car" : r.downRaised ? ", the CBSL minimum for this car" : ""})`, `LKR ${fmt(r.dp)}`) +
      (s.fees ? line("Up-front fees", `LKR ${fmt(s.fees)}`) + line("Cash Needed Up Front", `<b>LKR ${fmt(r.upfront)}</b>`) : "") +
      line("Amount Financed", `LKR ${fmt(r.loan)}`) +
      line(`Monthly rental × ${s.n}`, `<b>LKR ${fmt(r.rental)}</b>`) +
      (s.insurance ? line("Monthly cost with insurance", `LKR ${fmt(r.monthlyCost)}`) : "") +
      line("Total Interest", `LKR ${fmt(r.interest)}`) +
      line(`Total Paid (down payment, rentals${extras ? ", fees and insurance" : ""})`, `LKR ${fmt(r.total)}`) +
      line(`Net Income Needed at a ${limit}% limit`, `LKR ${fmt(r.need)}`) + "</dl>";
    html += renderCostDonutMarkup();
    const years = yearlySchedule(r.loan, s.rate, s.n);
    html += buildAmortizationSvg(r, s, years);
    html += `<h3 class="detail-h">Year by Year</h3><div class="wrap detail-wrap"><table class="detail-table"><thead><tr><th>Year</th><th class="n">Rentals paid</th><th class="n">Interest</th><th class="n">Principal</th><th class="n">Balance left</th></tr></thead><tbody>${
      years.map(y => `<tr data-amort-yr="${y.year}"><td>${y.year}${y.months < 12 ? ` (${y.months} months)` : ""}</td><td class="n">${fmt(y.paid)}</td><td class="n">${fmt(y.interest)}</td><td class="n">${fmt(y.principal)}</td><td class="n">${fmt(y.balance)}</td></tr>`).join("")
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
  if (r.downPct < 100) {
    const years = yearlySchedule(r.loan, s.rate, s.n);
    setupAmortizationInteractions(r, s, years);
  }
  openModal($("detailModal"), opener, $("closeDetailBtn"));
}
if ($("closeDetailBtn")) $("closeDetailBtn").addEventListener("click", () => closeModal($("detailModal")));

function openHeadToHead(opener) {
  const s = readSettings();
  const { rows: allRows, room } = computeLeaseTable(cars, s);
  const pinnedRows = allRows.filter(r => !r.hidden && pinnedKeys.has(r._key));
  if (pinnedRows.length < 2) {
    showToast("Pin at least 2 vehicles to compare them side-by-side.");
    return;
  }
  const minRent = Math.min(...pinnedRows.map(r => r.rental));
  const maxRent = Math.max(...pinnedRows.map(r => r.rental));
  const minUpfront = Math.min(...pinnedRows.map(r => r.upfront));
  const maxUpfront = Math.max(...pinnedRows.map(r => r.upfront));
  const minTotal = Math.min(...pinnedRows.map(r => r.total));
  const maxTotal = Math.max(...pinnedRows.map(r => r.total));
  const minInt = Math.min(...pinnedRows.map(r => r.interest));
  const limit = Math.round(s.dti * 100);

  const rentWinner = pinnedRows.find(r => r.rental === minRent);
  const totalWinner = pinnedRows.find(r => r.total === minTotal);
  const upfrontWinner = pinnedRows.find(r => r.upfront === minUpfront);

  let html = `<div class="h2h-summary-banner">
    <div class="h2h-banner-terms">Comparing <b>${pinnedRows.length} finalists</b> at ${esc(rateLabel(s))} over <b>${s.n} months</b></div>
    <div class="h2h-winner-callouts">
      <div class="h2h-callout-chip">
        <span class="h2h-callout-label">Lowest Monthly Rental</span>
        <strong>${esc(rentWinner.name)}</strong>
        <span class="h2h-callout-delta ok">${maxRent > minRent ? `Saves up to LKR ${fmt(maxRent - minRent)}/mo` : "Equal monthly rental"}</span>
      </div>
      <div class="h2h-callout-chip">
        <span class="h2h-callout-label">Lowest Cash Up Front</span>
        <strong>${esc(upfrontWinner.name)}</strong>
        <span class="h2h-callout-delta ok">${maxUpfront > minUpfront ? `LKR ${fmt(maxUpfront - minUpfront)} less upfront` : "Equal upfront cash"}</span>
      </div>
      <div class="h2h-callout-chip">
        <span class="h2h-callout-label">Lowest Lifetime Outlay</span>
        <strong>${esc(totalWinner.name)}</strong>
        <span class="h2h-callout-delta ok">${maxTotal > minTotal ? `Saves up to LKR ${fmt(maxTotal - minTotal)} over ${s.n}m` : "Equal total outlay"}</span>
      </div>
    </div>
  </div>`;

  // Phones: the same figures as the cards, grouped by metric so they can be read side by side
  const matrix = [["Monthly rental", "rental"], ["Cash up front", "upfront"], ["Total interest", "interest"], ["Total outlay", "total"]].map(([label, key]) => {
    const low = Math.min(...pinnedRows.map(r => r[key]));
    const differ = pinnedRows.some(r => r[key] !== low);
    const rows = pinnedRows.map(r => {
      const best = differ && r[key] === low;
      const note = best ? "Lowest" : differ ? `+${fmt(r[key] - low)}` : "";
      return `<tr${best ? ' class="is-best"' : ""}><th scope="row">${esc(r.name)}</th><td>${fmt(r[key])}${note ? `<span class="h2h-matrix-note">${note}</span>` : ""}</td></tr>`;
    }).join("");
    return `<tbody><tr class="h2h-matrix-metric"><th scope="colgroup" colspan="2">${label}</th></tr>${rows}</tbody>`;
  }).join("");
  html += `<div class="h2h-matrix-wrap"><table class="h2h-matrix"><caption>At a Glance (LKR)</caption>${matrix}</table></div>`;

  html += `<div class="h2h-grid cols-${pinnedRows.length}">`;
  for (const r of pinnedRows) {
    const photo = photoForModel(r);
    const isBestRent = r.rental === minRent && maxRent > minRent;
    const isBestUpfront = r.upfront === minUpfront && maxUpfront > minUpfront;
    const isBestTotal = r.total === minTotal && maxTotal > minTotal;
    const rentDelta = r.rental - minRent;
    const upfrontDelta = r.upfront - minUpfront;
    const totalDelta = r.total - minTotal;
    const intDelta = r.interest - minInt;

    let statusPill = `<span class="tag na">Add income to check</span>`;
    if (s.income) {
      const monthlyCost = r.rental + (s.insurance ? s.insurance / 12 : 0);
      const carDti = ((monthlyCost + s.debt) / s.income) * 100;
      const carDtiStr = `${carDti.toFixed(1)}% DTI`;
      if (r.downPct >= 100) {
        statusPill = `<span class="tag ok">100% Cash · 0% DTI</span>`;
      } else if (r.status === "ok") {
        statusPill = `<span class="tag ok">Within limit · ${carDtiStr}</span>`;
      } else if (limit === DTI_STANDARD_PCT && carDti <= DTI_STRETCH_PCT) {
        statusPill = `<span class="tag mid">Stretch only · ${carDtiStr}</span>`;
      } else {
        statusPill = `<span class="tag bad">Above limit · ${carDtiStr}</span>`;
      }
    }

    html += `<article class="h2h-col-card" data-h2h-key="${esc(r._key)}">
      <div class="h2h-col-head">
        <div class="h2h-photo-frame">${photo ? `<img src="${esc(photo)}" alt="${esc(r.name)}" loading="lazy">` : NO_PHOTO}</div>
        <div class="h2h-title-block">
          <div class="h2h-tags-row">
            <span class="cond-tag">${esc(condLabel(r.cond))}</span>
            <span class="tag">${r.w === "Official" ? "Official agent" : r.w === "Grey" ? "Grey import" : "Independent"}</span>
          </div>
          <h3 class="h2h-car-title">${esc(r.name)}</h3>
          <div class="h2h-car-price">LKR ${fmt(r.price)}</div>
        </div>
      </div>

      <div class="h2h-metrics-list">
        <div class="h2h-metric-row${isBestRent ? " winner" : ""}">
          <div class="h2h-metric-top">
            <span class="h2h-metric-label">Monthly Lease Rental</span>
            ${isBestRent ? '<span class="h2h-win-badge">Lowest Rental</span>' : `<span class="h2h-delta-sub">+LKR ${fmt(rentDelta)}/mo</span>`}
          </div>
          <strong class="h2h-metric-val">LKR ${fmt(r.rental)}</strong>
          <small class="micro-sub">${r.downPct >= 100 ? "100% Cash purchase" : `${s.n} monthly instalments${s.insurance ? ` (+Ins LKR ${fmt(s.insurance / 12)}/mo)` : ""}`}</small>
        </div>

        <div class="h2h-metric-row${isBestUpfront ? " winner" : ""}">
          <div class="h2h-metric-top">
            <span class="h2h-metric-label">Down Payment &amp; Upfront</span>
            ${isBestUpfront ? '<span class="h2h-win-badge">Lowest Upfront</span>' : `<span class="h2h-delta-sub">+LKR ${fmt(upfrontDelta)}</span>`}
          </div>
          <strong class="h2h-metric-val">LKR ${fmt(r.upfront)}</strong>
          <small class="micro-sub">${r.downPct}% deposit (LKR ${fmt(r.dp)})${r.downCustom ? " · Custom override" : r.downRaised ? " · CBSL floor" : ""}${s.fees ? ` + LKR ${fmt(s.fees)} fees` : ""}</small>
        </div>

        <div class="h2h-metric-row">
          <div class="h2h-metric-top">
            <span class="h2h-metric-label">Amount Financed &amp; Interest</span>
            ${intDelta > 0 ? `<span class="h2h-delta-sub">+LKR ${fmt(intDelta)} int.</span>` : '<span class="h2h-win-badge">Lowest Interest</span>'}
          </div>
          <strong class="h2h-metric-val">LKR ${fmt(r.loan)}</strong>
          <small class="micro-sub">Total interest: LKR ${fmt(r.interest)} (${(100 - r.downPct).toFixed(0)}% LTV)</small>
        </div>

        <div class="h2h-metric-row${isBestTotal ? " winner" : ""}">
          <div class="h2h-metric-top">
            <span class="h2h-metric-label">Total Lifetime Outlay</span>
            ${isBestTotal ? '<span class="h2h-win-badge">Lowest Total Cost</span>' : `<span class="h2h-delta-sub">+LKR ${fmt(totalDelta)}</span>`}
          </div>
          <strong class="h2h-metric-val">LKR ${fmt(r.total)}</strong>
          <small class="micro-sub">Deposit + ${s.n} rentals${s.fees || s.insurance ? " + fees/insurance" : ""}</small>
        </div>

        <div class="h2h-metric-row">
          <div class="h2h-metric-top">
            <span class="h2h-metric-label">Net Income Needed (${limit}% DTI)</span>
            ${statusPill}
          </div>
          <strong class="h2h-metric-val">LKR ${fmt(r.need)}/mo</strong>
          <small class="micro-sub">${s.income ? (r.rental <= room ? `+LKR ${fmt(room - r.rental)}/mo buffer` : `-LKR ${fmt(r.rental - room)}/mo over limit`) : "Enter income to check personal buffer"}</small>
        </div>

        <div class="h2h-specs-box">
          <div><span>Powertrain</span><b>${esc(r.pt && r.pt !== UNKNOWN_SPEC ? r.pt : "To confirm")}</b></div>
          <div><span>Fuel Economy</span><b>${esc(r.km || "To confirm")}</b></div>
          <div><span>Ground Clearance</span><b>${esc(r.groundClearance || "Standard")}</b></div>
        </div>
      </div>

      <div class="h2h-col-foot">
        <button type="button" class="btn-outline btn-sm" data-h2h-details="${esc(r._key)}">Full Lease Schedule</button>
        <button type="button" class="link" data-unpin-key="${esc(r._key)}">Unpin</button>
      </div>
    </article>`;
  }
  html += `</div>`;

  $("h2hBody").innerHTML = html;
  openModal($("h2hModal"), opener || $("openHeadToHeadBtn"), $("closeH2hBtn"));
}

if ($("closeH2hBtn")) $("closeH2hBtn").addEventListener("click", () => closeModal($("h2hModal")));
if ($("openHeadToHeadBtn")) $("openHeadToHeadBtn").addEventListener("click", () => openHeadToHead($("openHeadToHeadBtn")));
if ($("clearHeadToHeadBtn")) {
  $("clearHeadToHeadBtn").addEventListener("click", () => {
    pinnedKeys.clear();
    render();
    $("h-list").focus();
  });
}
if ($("headToHeadTray")) {
  $("headToHeadTray").addEventListener("click", e => {
    const rm = e.target.closest("button[data-unpin-key]");
    if (!rm) return;
    pinnedKeys.delete(rm.dataset.unpinKey);
    render();
  });
}
if ($("h2hBody")) {
  $("h2hBody").addEventListener("click", e => {
    const rm = e.target.closest("button[data-unpin-key]");
    if (rm) {
      pinnedKeys.delete(rm.dataset.unpinKey);
      render();
      if (pinnedKeys.size >= 2) openHeadToHead($("openHeadToHeadBtn"));
      else closeModal($("h2hModal"));
      return;
    }
    const det = e.target.closest("button[data-h2h-details]");
    if (det) {
      const car = cars[indexOfKey(det.dataset.h2hDetails)];
      if (car) {
        closeModal($("h2hModal"));
        openDetails(car, $("openHeadToHeadBtn"));
      }
    }
  });
}

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
let printFootnotes = [];
window.addEventListener("beforeprint", () => {
  printFootnotes = [...(document.querySelectorAll?.('.foot-note:not([open])') || [])];
  printFootnotes.forEach(note => { note.open = true; });
  screenComparisonLimit = comparisonLimit; comparisonLimit = Infinity; render();
});
window.addEventListener("afterprint", () => {
  printFootnotes.forEach(note => { note.open = false; });
  printFootnotes = [];
  comparisonLimit = screenComparisonLimit; render();
});
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

const SUPPORTED_AD_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_AD_IMAGE_BYTES = 4 * 1024 * 1024;

// Classified Ad / Auction Sheet Screenshot Upload & Clipboard Paste
function setAttachedAdImage(file) {
  if (!file) return;
  if (!SUPPORTED_AD_IMAGE_TYPES.includes(file.type)) {
    $("aiSearchMsg").textContent = "Attach a JPEG, PNG, WebP or GIF screenshot.";
    $("aiSearchMsg").classList.add("msg-error");
    pendingAdImage = null;
    $("aiAttachedAdBox").hidden = true;
    $("aiAdFile").value = "";
    return;
  }
  if (file.size > MAX_AD_IMAGE_BYTES) {
    $("aiSearchMsg").textContent = "The screenshot is too large; attach one under 4 MB.";
    $("aiSearchMsg").classList.add("msg-error");
    pendingAdImage = null;
    $("aiAttachedAdBox").hidden = true;
    $("aiAdFile").value = "";
    return;
  }
  $("aiSearchMsg").textContent = "";
  $("aiSearchMsg").classList.remove("msg-error");

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
    const { searchVehicle } = await loadGeminiModule();
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
  $("aiSearchMsg").innerHTML = `<span class="msg-error">${esc(message)}</span> <button type="button" class="btn-outline btn-sm" id="goManualBtn">Enter Details Manually</button>`;
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
      return `<option value="${esc(yVal)}">${esc(yVal)}</option>`;
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
    { id: "recent", name: "Registered under a year", c: "Recent" },
    { id: "used_low", name: "Registered Used (under 50,000 km)", c: "Used" },
    { id: "used_med", name: "Registered Used (50,000–100,000 km)", c: "Used" }
  );
  for (const option of options) option.price = conditionPrice(tData, option.id, sellerP);
  const selected = options.find(o => o.selected && validPrice(o.price)) || options.find(o => validPrice(o.price)) || options[0];
  $("aiCondSelect").innerHTML = options.map(o => `<option value="${esc(o.id)}" data-p="${validPrice(o.price) ? o.price : ""}" data-c="${esc(o.c)}" ${o === selected ? "selected" : ""}>${esc(o.name)}: ${validPrice(o.price) ? "LKR " + fmt(o.price) : "enter custom quote / listing price"}</option>`).join("");
  updateSelectedPrice(false);
}

function updateSelectedPrice(focusOnCustom = false) {
  const selOpt = $("aiCondSelect").selectedOptions[0];
  const p = +selOpt?.dataset.p || 0;
  $("aiPriceInput").value = p ? fmt(p) : "";
  $("aiPriceInput").placeholder = p ? "" : "Enter quotation or marketplace listing price";
  $("aiPriceInput").removeAttribute("aria-invalid");
  if (!p && selOpt && selOpt.dataset.c && selOpt.dataset.c !== "New") {
    $("aiSearchMsg").textContent = "Only Brand New prices are estimated automatically. Enter your quotation or marketplace listing price for this condition.";
    $("aiSearchMsg").classList.remove("msg-error");
    if (focusOnCustom) $("aiPriceInput").focus();
  } else {
    $("aiSearchMsg").textContent = "";
    $("aiSearchMsg").classList.remove("msg-error");
  }
}

$("aiYearSelect").addEventListener("change", updateTrimDropdown);
$("aiTrimSelect").addEventListener("change", updateConditionAndSpecs);
$("aiCondSelect").addEventListener("change", () => updateSelectedPrice(true));
$("aiResetPriceBtn").addEventListener("click", () => updateSelectedPrice(false));

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
          <b class="discovery-price">LKR ${fmt(v.price_lkr)}</b>
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

for (const [btnId, panelId, closedText, openText] of [
  ['toggleCostsDrawer', 'termsSubcardCosts', '+ Optional Incidental Costs (Insurance & Up-front Fees)', '− Optional Incidental Costs (Insurance & Up-front Fees)'],
  ['toggleLtvDrawer', 'ltvSplitContainer', '+ Vehicle Valuation Financing Structure (CBSL Directions No. 01 of 2026)', '− Vehicle Valuation Financing Structure (CBSL Directions No. 01 of 2026)'],
  ['toggleSavingsDrawer', 'savingsPlannerLayout', 'Expand Deposit & Savings Trajectory Planner', 'Collapse Deposit & Savings Trajectory Planner']
]) {
  const btn = $(btnId);
  if (btn && typeof btn.addEventListener === 'function') {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      const panel = $(panelId);
      if (panel && panel.classList) panel.classList.toggle('drawer-collapsed', !open);
      const labelEl = btn.querySelector ? btn.querySelector('.drawer-toggle-label') : null;
      if (labelEl) labelEl.textContent = open ? openText : closedText;
    });
  }
}

// --- Sharing: a link carries inputs and vehicles (catalogue cars by ID, others in full);
// income and existing payments only when the person ticks the box

function shareableCars() {
  return cars.filter(c => !c.hidden).map(c => {
    const dpExtra = Number.isFinite(c.downOverride) && c.downOverride > 0 ? { d: c.downOverride } : {};
    return c.catalogueId
      ? { c: c.catalogueId, p: c.price, k: c.cond, ...dpExtra }
      : { n: c.name, p: c.price, k: c.cond, w: c.w, t: c.pt || "", ...( /^https:\/\//.test(c.img || "") ? { i: c.img } : {}), ...dpExtra };
  });
}

function carFromShare(item) {
  if (!item || typeof item !== "object" || !validPrice(+item.p)) return null;
  const cond = ["New", "Recond", "Recent", "Used"].includes(item.k) ? item.k : "New";
  const dpExtra = Number.isFinite(+item.d) && +item.d > 0 ? { downOverride: Math.min(100, Math.max(40, +item.d)) } : {};
  const entry = item.c && marketCatalogue.find(v => v.id === item.c);
  if (entry) {
    const published = +item.p === entry.price && cond === entry.cond;
    return { ...entry, id: newVehicleId(), catalogueId: entry.id, price: +item.p, cond, custom: true,
      priceBasis: published ? entry.priceBasis : "user-entered", priceSourceUrl: published ? entry.priceSourceUrl : null, ...dpExtra };
  }
  if (typeof item.n !== "string" || !item.n.trim()) return null;
  return { id: newVehicleId(), name: item.n.trim().slice(0, 120), price: +item.p, cond, w: item.w === "Official" ? "Official" : item.w === "Grey" ? "Grey" : "Unknown",
    pt: String(item.t || "").slice(0, 80), km: "", img: /^https:\/\//.test(item.i || "") ? item.i : "", custom: true, priceBasis: "user-entered", ...dpExtra };
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
    for (const id of ['detailModal', 'h2hModal', 'shareModal', 'aiModal', 'catalogueAddModal']) {
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
  if ($(id)) $(id).addEventListener("click", event => { event.currentTarget.focus({ preventScroll: true }); $("guide")?.showModal(); });
}
if ($("closeGuide")) $("closeGuide").addEventListener("click", () => $("guide")?.close());

// In-page section navigation: smooth scroll without polluting the URL or causing reloads to jump
const pageNav = document.querySelector?.(".page-nav");
if (pageNav && typeof pageNav.addEventListener === "function") {
  pageNav.addEventListener("click", e => {
    const link = e.target?.closest?.("a");
    if (!link) return;
    const href = link.getAttribute?.("href");
    if (href && href.startsWith("#")) {
      const target = document.querySelector?.(href);
      if (target) {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof target.scrollIntoView === "function") target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
        if (typeof target.setAttribute === "function") target.setAttribute("tabindex", "-1");
        if (typeof target.focus === "function") target.focus({ preventScroll: true });
      }
    }
  });
}

function checkUrlHash() {
  const SECTION_HASHES = ["#budgetPanel", "#comparisonPanel", "#savingsPanel"];
  if (SECTION_HASHES.includes(window.location.hash)) {
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (_) {}
    return;
  }
  if (window.location.hash === "#openAdd") {
    setTimeout(() => openAddFlow("ai", $("addVehicleBtn")), 60);
  } else if (window.location.hash === "#account") {
    setTimeout(() => { if (!isOpen($("accountModal"))) openModal($("accountModal"), $("accountBtn")); }, 60);
  }
}
checkUrlHash();
window.addEventListener("hashchange", checkUrlHash);

// Connect Catalogue Photo Studio overlay so local edits immediately reflect in the Calculator
if (typeof window !== "undefined" && window.__VAHANAIQ_PHOTOS__) {
  const studio = window.__VAHANAIQ_PHOTOS__;
  const applyStudio = () => {
    const fn = studio.apply || (typeof studio.resolve === "function" ? null : null);
    const p = fn ? fn(window.__VAHANAIQ_CATALOGUE__) : (studio.ready ? studio.ready.then(apply => apply && apply(window.__VAHANAIQ_CATALOGUE__)) : null);
    if (p && typeof p.then === "function") {
      p.then(res => { if (res) render(); }).catch(() => {});
    }
  };
  applyStudio();
}

// Accept the reviewed first-use choices without reloading or losing in-memory work.
window.addEventListener('vahanaiq:onboarding-complete', event => {
  const payload = event.detail;
  if (!payload || vehicleBatchError(payload.cars)) return;
  for (const car of payload.cars) if (!cars.some(c => c.id === car.id || (c.catalogueId && c.catalogueId === car.catalogueId))) cars.push(assignKey(car));
  applyState({ ...currentState(), ...payload.terms });
  saveCars(cars); saveState(currentState()); render();
});

// Interactive Budget View Switcher in test build (Gauge Dial vs Linear Cash Flow vs Borrowing Ceiling)
function applyBudgetMode(mode) {
  if (mode === undefined) mode = document.querySelector?.('.budget-mode-btn.active')?.dataset.budgetMode;
  if (!mode) return;
  for (const [id, value] of [['budgetGraphic', 'dial'], ['budgetLinearView', 'linear'], ['budgetCeilingView', 'ceiling']]) {
    const panel = $(id);
    if (panel) panel.hidden = mode !== value;
  }
}
function initBudgetModeSwitcher() {
  if (typeof document === "undefined") return;
  const switcherBtns = document.querySelectorAll(".budget-mode-btn");
  if (!switcherBtns.length) return;
  const setMode = mode => {
    switcherBtns.forEach(btn => {
      const active = btn.dataset.budgetMode === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active);
    });
    applyBudgetMode(mode);
    try { localStorage.setItem("vahanaiq_budget_mode", mode); } catch (_) {}
  };
  switcherBtns.forEach(btn => {
    btn.addEventListener("click", () => setMode(btn.dataset.budgetMode));
  });
  try {
    const saved = localStorage.getItem("vahanaiq_budget_mode");
    if (saved && ["dial", "linear", "ceiling"].includes(saved)) setMode(saved);
  } catch (_) {}
}
initBudgetModeSwitcher();
