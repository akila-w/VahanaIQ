// Loan-term inputs: validation, snapping to the value actually used, and saving/sharing
import { num, getSettings, DOWN_MIN } from "./calculator.js?v=2.7.0";

const STORE_KEY = "vahanaiq_inputs_v1";

// Field id -> URL parameter and default value
export const FIELDS = {
  rate: { param: "rate", def: "16" },
  tenure: { param: "n", def: "84" },
  down: { param: "down", def: "60" },
  income: { param: "inc", def: "" },
  debt: { param: "debt", def: "0" },
  dti: { param: "dti", def: "0.4" },
  warr: { param: "warr", def: "all" },
  condFilter: { param: "cond", def: "all" },
  maxprice: { param: "max", def: "" },
  afford: { param: "show", def: "all" },
  sort: { param: "sort", def: "price|-1" }
};

// Validated numeric fields: settings key, the check, and the last value that passed it
const RULES = {
  rate: { key: "rate", check: v => v === "" ? "Enter an interest rate." : !(num(v) >= 0 && num(v) <= 40) ? "Enter a rate between 0 and 40%." : "" },
  tenure: { key: "n", check: v => v === "" || !isFinite(num(v)) ? "Enter a tenure in months." : "", snap: true },
  down: { key: "down", check: v => v === "" || !isFinite(num(v)) ? "Enter a down payment percentage." : "", snap: true },
  income: { key: "income", check: v => v !== "" && !isFinite(num(v)) ? "Enter an amount in rupees." : num(v) < 0 ? "Income can't be negative." : "" },
  debt: { key: "debt", check: v => v !== "" && !isFinite(num(v)) ? "Enter an amount in rupees." : num(v) < 0 ? "Payments can't be negative." : "" },
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
  } else if (id === "income" || id === "debt" || id === "maxprice") {
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
  for (const id of ["rate", "tenure", "down", "income", "debt"]) {
    const el = $(id);
    if (!el) continue;
    const err = fieldError(id);
    const key = RULES[id].key;
    if (err) {
      if (id in lastValid) s[key] = lastValid[id];
      if (el.setAttribute) el.setAttribute("aria-invalid", "true");
      setFieldState(id, err, true);
    } else {
      lastValid[id] = s[key];
      if (el.removeAttribute) el.removeAttribute("aria-invalid");
      if (snapNotes[id]) setFieldState(id, snapNotes[id], true);
      else setFieldState(id, "");
    }
  }
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
    if (id in lastValid) el.value = String(lastValid[id]);
    delete snapNotes[id];
    return;
  }
  const used = id === "tenure" ? Math.min(84, Math.max(6, Math.round(num(raw)))) : Math.min(100, Math.max(DOWN_MIN, num(raw)));
  if (used !== num(raw)) {
    snapNotes[id] = hint && hint.className.includes("warn") ? hint.textContent : (id === "tenure" ? "Set to the nearest allowed tenure" : "Set to the nearest allowed down payment");
    el.value = String(used);
  }
}

export const clearSnapNote = id => { delete snapNotes[id]; };

// --- Persistence: URL query (shareable) wins over localStorage, which wins over defaults

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

let saveTimer = null;
export function saveState(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const diff = {};
    for (const [id, f] of Object.entries(FIELDS)) {
      if (state[id] !== undefined && String(state[id]) !== f.def) diff[id] = String(state[id]);
    }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(diff)); } catch (e) {}
    try {
      const params = new URLSearchParams(window.location.search);
      for (const f of Object.values(FIELDS)) params.delete(f.param);
      for (const [id, v] of Object.entries(diff)) params.set(FIELDS[id].param, v);
      const qs = params.toString();
      history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
    } catch (e) {}
  }, 400);
}

export function clearState() {
  clearTimeout(saveTimer);
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  for (const id of Object.keys(lastValid)) delete lastValid[id];
  for (const id of Object.keys(snapNotes)) delete snapNotes[id];
}
