// Loan-term inputs: validation, snapping to the value actually used, and saving/sharing
import { num, getSettings, flatToEffective } from "./calculator.js?v=2.12.0";
import {
  DOWN_MIN,
  DOWN_MIN_UNREG,
  DOWN_MAX,
  MIN_TENURE,
  MAX_TENURE,
  MIN_RATE,
  MAX_INPUT_RATE,
  DEFAULT_RATE,
  DEFAULT_RATE_TYPE,
  DEFAULT_TENURE,
  DEFAULT_DOWN,
  DEFAULT_DTI,
  AUTOSAVE_DELAY_MS,
  MAX_SHARED_CARS
} from "./constants.js?v=2.12.0";
import { notifySaved } from "./storage.js?v=2.12.0";

export const STORE_KEY = "vahanaiq_inputs_v1";

// Field id -> URL parameter and default value
export const FIELDS = {
  rate: { param: "rate", def: String(DEFAULT_RATE) },
  rateType: { param: "rt", def: DEFAULT_RATE_TYPE },
  tenure: { param: "n", def: String(DEFAULT_TENURE) },
  down: { param: "down", def: String(DEFAULT_DOWN) },
  income: { param: "inc", def: "" },
  debt: { param: "debt", def: "" },
  dti: { param: "dti", def: String(DEFAULT_DTI) },
  insurance: { param: "ins", def: "" },
  fees: { param: "fees", def: "" },
  warr: { param: "warr", def: "all" },
  condFilter: { param: "cond", def: "all" },
  maxprice: { param: "max", def: "" },
  afford: { param: "show", def: "all" },
  sort: { param: "sort", def: "price|-1" }
};

// Validated numeric fields: settings key, the check, and the last value that passed it
const RULES = {
  rate: { key: "rateInput", check: v => v === "" ? "Enter an interest rate." : !(num(v) >= MIN_RATE && num(v) <= MAX_INPUT_RATE) ? `Enter a rate between ${MIN_RATE} and ${MAX_INPUT_RATE}%.` : "" },
  tenure: { key: "n", check: v => v === "" || !isFinite(num(v)) ? "Enter a tenure in months." : "", snap: true },
  down: { key: "down", check: v => v === "" || !isFinite(num(v)) ? "Enter a down payment percentage." : num(v) < (Number($("down")?.min) || DOWN_MIN) || num(v) > DOWN_MAX ? `Enter a down payment from ${Number($("down")?.min) || DOWN_MIN}% to ${DOWN_MAX}%. New and recent passenger vehicles require at least ${DOWN_MIN_UNREG}% down (at most ${100 - DOWN_MIN_UNREG}% financed).` : "", snap: true },
  income: { key: "income", check: v => v !== "" && !isFinite(num(v)) ? "Enter rupees with up to two decimal places." : num(v) < 0 ? "Income can't be negative." : "" },
  debt: { key: "debt", check: v => v !== "" && !isFinite(num(v)) ? "Enter rupees with up to two decimal places." : num(v) < 0 ? "Payments can't be negative." : "" },
  insurance: { key: "insurance", check: v => v !== "" && !isFinite(num(v)) ? "Enter rupees with up to two decimal places." : num(v) < 0 ? "Insurance can't be negative." : "" },
  fees: { key: "fees", check: v => v !== "" && !isFinite(num(v)) ? "Enter rupees with up to two decimal places." : num(v) < 0 ? "Fees can't be negative." : "" },
  maxprice: { check: v => v !== "" && !isFinite(num(v)) ? "Enter a price in millions." : num(v) < 0 ? "Enter a price of 0 or more." : "" }
};

const lastValid = {};
const snapNotes = {};
const $ = id => document.getElementById(id);
const hintFor = id => $(id + "Hint");

function setFieldState(id, message, warn) {
  const el = $(id), hint = hintFor(id);
  if (!el || !hint) return;
  if (hint.dataset && hint.dataset.def === undefined) hint.dataset.def = hint.textContent;
  if (message) {
    hint.textContent = message;
    hint.className = warn ? "hint warn" : "hint";
  } else if (["income", "debt", "insurance", "fees", "maxprice"].includes(id)) {
    hint.textContent = hint.dataset ? hint.dataset.def : hint.textContent;
    hint.className = "hint";
  }
}

export function fieldError(id) {
  const el = $(id);
  return el && RULES[id] ? RULES[id].check(String(el.value).trim()) : "";
}

// Reads the inputs, falling back to the last valid value for any invalid field
export function readSettings() {
  const s = getSettings();
  for (const id of ["rate", "tenure", "down", "income", "debt", "insurance", "fees"]) {
    const el = $(id);
    if (!el) continue;
    const err = fieldError(id);
    const key = RULES[id].key;
    if (err) {
      if (id in lastValid) s[key] = id === "down" ? Math.max(Number(el.min) || DOWN_MIN, lastValid[id]) : lastValid[id];
      if (el.setAttribute) el.setAttribute("aria-invalid", "true");
      setFieldState(id, err, true);
    } else {
      lastValid[id] = s[key];
      if (el.removeAttribute) el.removeAttribute("aria-invalid");
      if (snapNotes[id]) setFieldState(id, snapNotes[id], true);
      else setFieldState(id, "");
    }
  }
  // The rate actually used follows the entered (or last valid) rate and its type
  s.rate = s.rateType === "flat" ? flatToEffective(s.rateInput, s.n) : s.rateInput;
  const mp = $("maxprice");
  if (mp) {
    const err = fieldError("maxprice");
    if (err) mp.setAttribute && mp.setAttribute("aria-invalid", "true");
    else mp.removeAttribute && mp.removeAttribute("aria-invalid");
    setFieldState("maxprice", err, !!err);
  }
  return s;
}

// On change/blur: put the value actually used back into tenure and down payment
export function snapField(id) {
  const el = $(id);
  if (!el || !RULES[id] || !RULES[id].snap) return;
  const hint = hintFor(id);
  const raw = String(el.value).trim();
  if (fieldError(id)) {
    if (id in lastValid) el.value = String(id === "down" ? Math.max(Number(el.min) || DOWN_MIN, lastValid[id]) : lastValid[id]);
    else if (id === "down") el.value = String(Number(el.min) || DEFAULT_DOWN);
    snapNotes[id] = "Invalid entry replaced with the last valid value within the current limits.";
    return;
  }
  const used = id === "tenure" ? Math.min(MAX_TENURE, Math.max(MIN_TENURE, Math.round(num(raw)))) : Math.min(DOWN_MAX, Math.max(Number(el.min) || DOWN_MIN, DOWN_MIN, num(raw)));
  if (used !== num(raw)) {
    snapNotes[id] = hint && hint.className.includes("warn") ? hint.textContent : (id === "tenure" ? "Set to the nearest allowed tenure" : "Set to the nearest allowed down payment");
    el.value = String(used);
  }
}

export const clearSnapNote = id => { delete snapNotes[id]; };

// --- Persistence: a shared link's values win over this browser's saved values, which win
// over the defaults. Inputs are saved in this browser; the address bar is cleaned after
// a shared link is read, so income never stays in the URL or browser history. When the person
// signs in, js/account.js keeps a copy with their account too.

// Fields left out of a shared link unless the person chooses to include them
export const PRIVATE_FIELDS = ["income", "debt"];
const SHARED_CARS_PARAM = "cars";

export function loadState() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch (e) {}
  const state = {};
  let params = null;
  try { params = new URLSearchParams(window.location.search); } catch (e) {}
  for (const [id, f] of Object.entries(FIELDS)) {
    if (params && params.has(f.param)) state[id] = params.get(f.param);
    else if (typeof stored[id] === "string") state[id] = stored[id];
  }
  return state;
}

// Vehicles carried in a shared link, or [] (malformed links are ignored)
export function sharedCarsFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get(SHARED_CARS_PARAM);
    if (!raw) return [];
    const json = decodeURIComponent(escape(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))));
    const list = JSON.parse(json);
    return Array.isArray(list) ? list.slice(0, MAX_SHARED_CARS) : [];
  } catch (e) {
    return [];
  }
}

// Removes the shared link's values from the address bar once they're applied
export function cleanUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (![SHARED_CARS_PARAM, ...Object.values(FIELDS).map(f => f.param)].some(k => params.has(k))) return;
    history.replaceState(null, "", window.location.pathname + window.location.hash);
  } catch (e) {}
}

// A link with the given inputs and vehicles; income and payments only when asked
export function buildShareLink(state, cars, includePrivate) {
  const params = new URLSearchParams();
  for (const [id, f] of Object.entries(FIELDS)) {
    if (!includePrivate && PRIVATE_FIELDS.includes(id)) continue;
    if (state[id] !== undefined && String(state[id]) !== f.def && String(state[id]) !== "") params.set(f.param, String(state[id]));
  }
  if (cars.length) {
    const json = JSON.stringify(cars);
    params.set(SHARED_CARS_PARAM, btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  }
  const qs = params.toString();
  return `${window.location.origin}${window.location.pathname}${qs ? "?" + qs : ""}`;
}

let saveTimer = null;
export function saveState(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const diff = {};
    for (const [id, f] of Object.entries(FIELDS)) {
      if (state[id] !== undefined && String(state[id]) !== f.def) diff[id] = String(state[id]);
    }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(diff)); } catch (e) {}
    notifySaved();
  }, AUTOSAVE_DELAY_MS);
}

export function clearState() {
  clearTimeout(saveTimer);
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  for (const id of Object.keys(lastValid)) delete lastValid[id];
  for (const id of Object.keys(snapNotes)) delete snapNotes[id];
}
