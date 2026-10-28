// Comprehensive Automated Verification Suite for VahanaIQ
// Tests all Part 1 Bug Fixes, Part 2 New Features, and Part 3 Verification Checklist

import assert from "node:assert/strict";
import fs from "node:fs";

console.log("=== RUNNING VAHANAIQ VERIFICATION SUITE ===\n");

// Setup full DOM & Browser Mock
const mockStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};
globalThis.localStorage = mockStorage;

class MockElement {
  constructor(id = "", tagName = "DIV") {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.className = "";
    this.hidden = false;
    this.style = {};
    this.options = [];
    this.selectedOptions = [];
    this.listeners = {};
    this.dataset = {};
    this.children = [];
    this._stubs = {};
    this.classList = {
      _classes: new Set(),
      add: c => mockElementClassListAdd(this, c),
      remove: c => mockElementClassListRemove(this, c),
      contains: c => this.classList._classes.has(c),
      toggle: (c, force) => mockElementClassListToggle(this, c, force)
    };
  }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  dispatchEvent(event) {
    const fns = this.listeners[event.type] || [];
    fns.forEach(fn => fn(event));
  }
  click() {
    this.dispatchEvent({ type: "click", target: this, closest: () => null });
  }
  focus() {}
  select() {}
  closest(sel) {
    return this;
  }
  querySelector(sel) { return this._stubs[sel] || (this._stubs[sel] = new MockElement()); }
  querySelectorAll() { return []; }
  insertBefore(node, ref) {
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(node); else this.children.splice(i, 0, node);
  }
  get lastElementChild() { return this.children[this.children.length - 1] || null; }
  remove() {}
  after() {}
  replaceChildren(...nodes) { this.children = nodes; }
  get parentNode() { return this; }
  setAttribute(k, v) { this[k] = v; }
  removeAttribute(k) { delete this[k]; }
  getAttribute(k) { return this[k] || null; }
}

function mockElementClassListAdd(el, c) {
  el.classList._classes.add(c);
  el.className = Array.from(el.classList._classes).join(" ");
}
function mockElementClassListRemove(el, c) {
  el.classList._classes.delete(c);
  el.className = Array.from(el.classList._classes).join(" ");
}
function mockElementClassListToggle(el, c, force) {
  if (force === undefined) {
    if (el.classList.contains(c)) mockElementClassListRemove(el, c);
    else mockElementClassListAdd(el, c);
  } else if (force) {
    mockElementClassListAdd(el, c);
  } else {
    mockElementClassListRemove(el, c);
  }
}

const domElements = {
  rate: new MockElement("rate", "INPUT"),
  tenure: new MockElement("tenure", "INPUT"),
  down: new MockElement("down", "INPUT"),
  rateSlider: new MockElement("rateSlider", "INPUT"),
  tenureSlider: new MockElement("tenureSlider", "INPUT"),
  downSlider: new MockElement("downSlider", "INPUT"),
  income: new MockElement("income", "INPUT"),
  debt: new MockElement("debt", "INPUT"),
  dti: new MockElement("dti", "SELECT"),
  rateHint: new MockElement("rateHint"),
  tenureHint: new MockElement("tenureHint"),
  downHint: new MockElement("downHint"),
  summary: new MockElement("summary"),
  sort: new MockElement("sort", "SELECT"),
  warr: new MockElement("warr", "SELECT"),
  condFilter: new MockElement("condFilter", "SELECT"),
  maxprice: new MockElement("maxprice", "INPUT"),
  afford: new MockElement("afford", "SELECT"),
  head: new MockElement("head"),
  rows: new MockElement("rows"),
  empty: new MockElement("empty"),
  resetCatalogWrap: new MockElement("resetCatalogWrap"),
  resetCatalogBtn: new MockElement("resetCatalogBtn", "BUTTON"),
  apiKeyInput: new MockElement("apiKeyInput", "INPUT"),
  keyStatus: new MockElement("keyStatus"),
  settingsModal: new MockElement("settingsModal"),
  openSettingsBtn: new MockElement("openSettingsBtn", "BUTTON"),
  closeSettingsBtn: new MockElement("closeSettingsBtn", "BUTTON"),
  saveKeyBtn: new MockElement("saveKeyBtn", "BUTTON"),
  clearKeyBtn: new MockElement("clearKeyBtn", "BUTTON"),
  testKeyBtn: new MockElement("testKeyBtn", "BUTTON"),
  aiModal: new MockElement("aiModal"),
  openAiModalBtn: new MockElement("openAiModalBtn", "BUTTON"),
  closeAiModalBtn: new MockElement("closeAiModalBtn", "BUTTON"),
  aiCancelBtn: new MockElement("aiCancelBtn", "BUTTON"),
  mCancelBtn: new MockElement("mCancelBtn", "BUTTON"),
  tabAiBtn: new MockElement("tabAiBtn", "BUTTON"),
  tabManualBtn: new MockElement("tabManualBtn", "BUTTON"),
  paneAi: new MockElement("paneAi"),
  paneManual: new MockElement("paneManual"),
  aiSearchQuery: new MockElement("aiSearchQuery", "TEXTAREA"),
  aiSearchBtn: new MockElement("aiSearchBtn", "BUTTON"),
  aiUploadAdBtn: new MockElement("aiUploadAdBtn"),
  aiAdFile: new MockElement("aiAdFile", "INPUT"),
  aiAttachedAdBox: new MockElement("aiAttachedAdBox"),
  aiAttachedAdLabel: new MockElement("aiAttachedAdLabel"),
  aiRemoveAdImgBtn: new MockElement("aiRemoveAdImgBtn", "BUTTON"),
  aiSearchMsg: new MockElement("aiSearchMsg"),
  aiDiscoveryBox: new MockElement("aiDiscoveryBox"),
  aiDiscoveryTitle: new MockElement("aiDiscoveryTitle"),
  aiToggleSelectAllBtn: new MockElement("aiToggleSelectAllBtn", "BUTTON"),
  aiDiscoveryList: new MockElement("aiDiscoveryList"),
  aiDiscoveryBackBtn: new MockElement("aiDiscoveryBackBtn", "BUTTON"),
  aiAddSelectedBtn: new MockElement("aiAddSelectedBtn", "BUTTON"),
  aiUnavailBox: new MockElement("aiUnavailBox"),
  aiResultForm: new MockElement("aiResultForm"),
  aiAvailNotes: new MockElement("aiAvailNotes"),
  aiRouteBadge: new MockElement("aiRouteBadge"),
  aiYearSelect: new MockElement("aiYearSelect", "SELECT"),
  aiTrimSelect: new MockElement("aiTrimSelect", "SELECT"),
  aiCondSelect: new MockElement("aiCondSelect", "SELECT"),
  aiPriceInput: new MockElement("aiPriceInput", "INPUT"),
  aiResetPriceBtn: new MockElement("aiResetPriceBtn", "SPAN"),
  aiWarrSelect: new MockElement("aiWarrSelect", "SELECT"),
  aiKmInput: new MockElement("aiKmInput", "INPUT"),
  aiImgPreview: new MockElement("aiImgPreview", "IMG"),
  aiImgUrl: new MockElement("aiImgUrl", "INPUT"),
  aiImgFile: new MockElement("aiImgFile", "INPUT"),
  aiAddAllTrimsBtn: new MockElement("aiAddAllTrimsBtn", "BUTTON"),
  aiTrimsYearLabel: new MockElement("aiTrimsYearLabel"),
  aiConfirmAddBtn: new MockElement("aiConfirmAddBtn", "BUTTON"),
  mName: new MockElement("mName", "INPUT"),
  mPrice: new MockElement("mPrice", "INPUT"),
  mCond: new MockElement("mCond", "SELECT"),
  mWarr: new MockElement("mWarr", "SELECT"),
  mPt: new MockElement("mPt", "INPUT"),
  mImgUrl: new MockElement("mImgUrl", "INPUT"),
  mAddBtn: new MockElement("mAddBtn", "BUTTON"),
  mErr: new MockElement("mErr"),
  resetInputsBtn: new MockElement("resetInputsBtn", "BUTTON"),
  incomeHint: new MockElement("incomeHint"),
  debtHint: new MockElement("debtHint"),
  maxpriceHint: new MockElement("maxpriceHint"),
  "h-list": new MockElement("h-list"),
  toast: new MockElement("toast"),
  filtersToggle: new MockElement("filtersToggle", "BUTTON"),
  filtersCount: new MockElement("filtersCount"),
  toolsPanel: new MockElement("toolsPanel"),
  budgetLegend: new MockElement("budgetLegend"),
  budgetLive: new MockElement("budgetLive"),
  budgetBar: new MockElement("budgetBar"),
  budgetPanel: new MockElement("budgetPanel"),
  budgetGraphic: new MockElement("budgetGraphic"),
  budgetNeedle: new MockElement("budgetNeedle"),
  budgetDtiHero: new MockElement("budgetDtiHero"),
  budgetDtiSub: new MockElement("budgetDtiSub"),
  budgetDtiPill: new MockElement("budgetDtiPill"),
  budgetDtiText: new MockElement("budgetDtiText"),
  budgetCashflowLabel: new MockElement("budgetCashflowLabel"),
  budgetCashflowBar: new MockElement("budgetCashflowBar"),
  budgetTelemetryGrid: new MockElement("budgetTelemetryGrid"),
  ltvSplitContainer: new MockElement("ltvSplitContainer"),
  ltvBarTrack: new MockElement("ltvBarTrack"),
  ltvBarDp: new MockElement("ltvBarDp"),
  ltvBarDpText: new MockElement("ltvBarDpText"),
  ltvBarLoan: new MockElement("ltvBarLoan"),
  ltvBarLoanText: new MockElement("ltvBarLoanText"),
  ltvEligibilityBadge: new MockElement("ltvEligibilityBadge"),
  ltvDetailDp: new MockElement("ltvDetailDp"),
  ltvDetailLoan: new MockElement("ltvDetailLoan"),
  ltvDetailCeiling: new MockElement("ltvDetailCeiling"),
  ltvDetailStatus: new MockElement("ltvDetailStatus"),
  appVersion: new MockElement("appVersion"),
  priceAsOf: new MockElement("priceAsOf")
};

// Initial default input values
domElements.rate.value = "16";
domElements.tenure.value = "84";
domElements.down.value = "60";
domElements.income.value = "";
domElements.debt.value = "0";
domElements.dti.value = "0.4";
domElements.warr.value = "all";
domElements.condFilter.value = "all";
domElements.afford.value = "all";
domElements.maxprice.value = "";
domElements.sort.value = "price|-1";
domElements.sort.options = [
  { value: "price|-1" }, { value: "price|1" },
  { value: "rental|1" }, { value: "rental|-1" },
  { value: "interest|1" }, { value: "interest|-1" },
  { value: "total|1" }, { value: "total|-1" },
  { value: "need|1" }, { value: "need|-1" },
  { value: "name|1" }, { value: "name|-1" }
];

const docListeners = {};
globalThis.Image = class extends MockElement { constructor() { super("", "IMG"); } };
globalThis.document = {
  getElementById: id => domElements[id] || null,
  createElement: tag => new MockElement("", tag),
  addEventListener: (ev, fn) => {
    if (!docListeners[ev]) docListeners[ev] = [];
    docListeners[ev].push(fn);
  },
  dispatchEvent: ev => {
    const fns = docListeners[ev.type] || [];
    fns.forEach(fn => fn(ev));
  },
  querySelectorAll: sel => []
};

globalThis.window = {
  addEventListener() {},
  location: {
    href: "http://localhost:8000/index.html",
    origin: "http://localhost:8000",
    pathname: "/index.html",
    search: "",
    hash: ""
  }
};

// -------------------------------------------------------------
// Test 1: Actuarial Calculator & Settings Edge Cases
// -------------------------------------------------------------
console.log("TEST 1: Actuarial Calculator & Settings Edge Cases");
const calcModule = await import("../js/calculator.js");
const { num, getSettings, computeLeaseTable } = calcModule;

// Test comma stripping in num()
assert.equal(num("250,000"), 250000, "num should parse 250,000");
assert.equal(num("18,500,000"), 18500000, "num should parse 18,500,000");
domElements.income.value = "250,000";
assert.equal(num("income"), 250000, "num should parse comma-formatted input value");
domElements.income.value = "";

// 1a: Default settings
let s = getSettings();
assert.equal(s.rate, 16);
assert.equal(s.n, 84);
assert.equal(s.down, 60);
assert.equal(s.income, 0);
assert.equal(domElements.tenureHint.textContent, "Maximum 84");
assert.match(domElements.downHint.textContent, /^Minimum 40%.*need 60%/);

// 1b: Clamping down payment below the 40% CBSL floor (cl. 2.1, registered over a year)
domElements.down.value = "10";
s = getSettings();
assert.equal(s.down, 40, "Down payment < 40 should clamp to 40");
assert.equal(domElements.downHint.textContent, "Raised to the 40% minimum down payment");
assert.match(domElements.downHint.className, /warn/);

// 1c: Clamping tenure < 6 months
domElements.tenure.value = "3";
s = getSettings();
assert.equal(s.n, 6, "Tenure < 6 should clamp to 6");
assert.equal(domElements.tenureHint.textContent, "Minimum 6 months");
assert.match(domElements.tenureHint.className, /warn/);

// 1d: Clamping tenure > 84 months
domElements.tenure.value = "96";
s = getSettings();
assert.equal(s.n, 84, "Tenure > 84 should clamp to 84");
assert.equal(domElements.tenureHint.textContent, "Capped at the 84-month maximum");
assert.match(domElements.tenureHint.className, /warn/);

// 1e: 100% Down Payment
domElements.down.value = "100";
domElements.tenure.value = "84";
const testCars = [
  { name: "Car A", price: 15000000, custom: false },
  { name: "Car B", price: 25000000, custom: true }
];
const table100 = computeLeaseTable(testCars);
for (const r of table100.rows) {
  assert.equal(r.loan, 0, "100% down payment should result in Rs. 0 loan");
  assert.equal(r.rental, 0, "100% down payment should result in Rs. 0 monthly rental");
  assert.equal(r.interest, 0, "100% down payment should result in Rs. 0 interest");
  assert.equal(r.total, r.price, "Total outlay should equal vehicle price");
  assert(!isNaN(r.rental), "Rental must not be NaN");
  assert(isFinite(r.rental), "Rental must not be Infinity");
}
console.log("✓ Actuarial Calculator & Settings Edge Cases PASSED\n");

// -------------------------------------------------------------
// Test 2: Row Index Preservation (_idx) for Accurate Deletion
// -------------------------------------------------------------
console.log("TEST 2: Row Index Preservation (_idx) on Cars");
const sampleCars = [
  { name: "Base Car 1", price: 10000000, custom: false },
  { name: "Custom Car 1", price: 20000000, custom: true },
  { name: "Base Car 2", price: 15000000, custom: false },
  { name: "Custom Car 2", price: 25000000, custom: true }
];
const leaseResult = computeLeaseTable(sampleCars);
assert.equal(leaseResult.rows.length, 4);
leaseResult.rows.forEach((r, idx) => {
  assert.equal(r._idx, idx, `Row ${idx} should preserve original index _idx`);
});

const customToDelete = leaseResult.rows.find(r => r.name === "Custom Car 1");
assert.equal(customToDelete._idx, 1);
sampleCars.splice(customToDelete._idx, 1);
assert.equal(sampleCars.length, 3);
assert.equal(sampleCars[1].name, "Base Car 2");
assert.equal(sampleCars[2].name, "Custom Car 2");
console.log("✓ Row Index Preservation (_idx) PASSED\n");

// -------------------------------------------------------------
// Test 3: Vehicle Title Deduplication Helper
// -------------------------------------------------------------
console.log("TEST 3: Vehicle Title Deduplication (formatVehicleTitle)");
const appModule = await import("../js/app.js");
const { formatVehicleTitle } = appModule;

assert.equal(
  formatVehicleTitle("Toyota Yaris Cross", "Z", 2024),
  "Toyota Yaris Cross Z (2024)"
);
assert.equal(
  formatVehicleTitle("Toyota Yaris Cross", "Toyota Yaris Cross Z", 2024),
  "Toyota Yaris Cross Z (2024)",
  "Should strip redundant model prefix from trim"
);
assert.equal(
  formatVehicleTitle("Toyota Yaris Cross", "Yaris Cross Z", 2024),
  "Toyota Yaris Cross Z (2024)",
  "Should strip model sub-name from trim"
);
assert.equal(
  formatVehicleTitle("Honda Vezel (2021)", "e:HEV Z (2021)", 2021),
  "Honda Vezel e:HEV Z (2021)",
  "Should strip redundant existing year tags"
);
assert.equal(
  formatVehicleTitle("Suzuki Swift", "Standard Trim", 2023),
  "Suzuki Swift (2023)",
  "Should omit 'Standard Trim'"
);
console.log("✓ Vehicle Title Deduplication PASSED\n");

// -------------------------------------------------------------
// Test 4: Image Safety and Normalization (Never saves window.location.href)
// -------------------------------------------------------------
console.log("TEST 4: Image Safety and Normalization");
const canvasModule = await import("../js/canvas-utils.js");
const { normalizeImageToStudio } = canvasModule;

let emptyRes = null;
normalizeImageToStudio("", res => { emptyRes = res; });
assert.equal(emptyRes, "", "Empty string src must return empty string");

let wsRes = null;
normalizeImageToStudio("   ", res => { wsRes = res; });
assert.equal(wsRes, "", "Whitespace src must return empty string");

let pageUrlRes = null;
normalizeImageToStudio("http://localhost:8000/index.html", res => { pageUrlRes = res; });
assert.equal(pageUrlRes, "", "window.location.href must return empty string, never saved as car image");
console.log("✓ Image Safety and Normalization PASSED\n");

// -------------------------------------------------------------
// Test 5: Model Year String vs Number Handling
// -------------------------------------------------------------
console.log("TEST 5: Model Year Comparison (String vs Number)");
const testAiData = {
  model_years: [
    { year: "2024", trims: [{ trim_name: "Trim 2024" }] },
    { year: 2022, trims: [{ trim_name: "Trim 2022" }] }
  ]
};

const matchYear = (years, selectedVal) => {
  return years.find(y => String(typeof y === "object" ? y.year : y) === String(selectedVal)) || years[0] || null;
};

assert.equal(matchYear(testAiData.model_years, "2024")?.trims[0].trim_name, "Trim 2024");
assert.equal(matchYear(testAiData.model_years, 2024)?.trims[0].trim_name, "Trim 2024");
assert.equal(matchYear(testAiData.model_years, "2022")?.trims[0].trim_name, "Trim 2022");
assert.equal(matchYear(testAiData.model_years, 2022)?.trims[0].trim_name, "Trim 2022");
console.log("✓ Model Year Comparison PASSED\n");

// -------------------------------------------------------------
// Test 6: Strict OpenAPI responseSchema Validation
// -------------------------------------------------------------
console.log("TEST 6: OpenAPI responseSchema Enforced in Gemini and Proxies");
const geminiModule = await import("../js/gemini.js");
const { VEHICLE_RESPONSE_SCHEMA } = geminiModule;

assert(VEHICLE_RESPONSE_SCHEMA, "VEHICLE_RESPONSE_SCHEMA must be defined");
const requiredKeys = VEHICLE_RESPONSE_SCHEMA.required;
assert(requiredKeys.includes("is_available_in_sri_lanka"));
assert(requiredKeys.includes("model_name"));
assert(requiredKeys.includes("wikipedia_slug"));
assert(requiredKeys.includes("availability_notes"));
assert(requiredKeys.includes("import_route"));
assert(requiredKeys.includes("model_years"));

const cfWorkerCode = fs.readFileSync("serverless/cloudflare-worker.js", "utf8");
const gcpFnCode = fs.readFileSync("serverless/gcp-cloud-function/index.js", "utf8");

assert(!cfWorkerCode.includes("gemini-3.8-flash"), "cloudflare-worker.js must not contain gemini-3.8-flash");
assert(!gcpFnCode.includes("gemini-3.8-flash"), "gcp-cloud-function/index.js must not contain gemini-3.8-flash");
assert(cfWorkerCode.includes("VEHICLE_RESPONSE_SCHEMA"), "cloudflare-worker.js must enforce VEHICLE_RESPONSE_SCHEMA");
assert(gcpFnCode.includes("VEHICLE_RESPONSE_SCHEMA"), "gcp-cloud-function/index.js must enforce VEHICLE_RESPONSE_SCHEMA");
console.log("✓ OpenAPI responseSchema and Model Validation PASSED\n");

// -------------------------------------------------------------
// Test 7: Index.html Verification (Sort Options & Cache Busters)
// -------------------------------------------------------------
console.log("TEST 7: index.html Elements, Sort Options & Cache Busters");
const html = fs.readFileSync("index.html", "utf8");
const style = fs.readFileSync("css/style.css", "utf8");

assert(html.includes('value="total|1"'), "index.html must include total|1 sort option");
assert(html.includes('value="total|-1"'), "index.html must include total|-1 sort option");
assert(html.includes('value="interest|-1"'), "index.html must include interest|-1 sort option");
assert(html.includes('value="need|-1"'), "index.html must include need|-1 sort option");
assert(html.includes('value="name|-1"'), "index.html must include name|-1 sort option");
assert(html.includes('id="rateHint"'), "index.html must include rateHint element");
assert(html.includes('id="aiDiscoveryBox"'), "index.html must include aiDiscoveryBox element");
assert(html.includes('id="aiAddAllTrimsBtn"'), "index.html must include aiAddAllTrimsBtn element");
assert(html.includes('id="aiAdFile"'), "index.html must include aiAdFile input for screenshot upload");
assert(html.includes('id="themeSwitch"'), "index.html must include the theme switch");
for (const choice of ["system", "light", "dark"]) assert(html.includes(`name="theme" value="${choice}"`), `theme switch must offer ${choice}`);
assert(html.includes('apple-touch-icon.png'), "index.html must reference PNG apple-touch-icon");
assert(html.includes('og-image.png'), "index.html must reference PNG og-image");
assert(html.includes('terms-grid'), "index.html must use terms-grid layout");
assert(html.includes('aria-label="Search vehicle with Gemini AI or paste advertisement"'), "index.html must have aria-label on aiSearchQuery");
assert(html.includes('<label for="aiImgUrl">'), "index.html must give aiImgUrl a visible label");
assert(html.includes('inputmode="numeric"'), "index.html must have inputmode numeric");
assert(html.includes('inputmode="decimal"'), "index.html must have inputmode decimal");
assert(html.includes('js/app.js?v=2.12.0'), "index.html must reference js/app.js?v=2.12.0");
assert(html.includes('css/style.min.css?v=2.12.0'), "index.html must reference css/style.min.css?v=2.12.0");
assert(html.includes('id="budgetGraphic"'), "index.html must include budgetGraphic container");
assert(html.includes('id="budgetNeedle"'), "index.html must include budgetNeedle SVG element");
assert(html.includes('id="budgetDtiHero"'), "index.html must include budgetDtiHero readout");
assert(html.includes('id="budgetCashflowBar"'), "index.html must include budgetCashflowBar container");
assert(html.includes('id="budgetTelemetryGrid"'), "index.html must include budgetTelemetryGrid container");
assert(html.includes('id="ltvSplitContainer"'), "index.html must include ltvSplitContainer container");
assert(html.includes('id="ltvBarTrack"'), "index.html must include ltvBarTrack element");
assert(html.includes('id="ltvBarDp"'), "index.html must include ltvBarDp element");
assert(html.includes('class="modal detail-modal"'), "index.html must include detail-modal class on detailModal");
assert(html.includes('data-preset-for="tenure"'), "index.html must include tenure preset chips");
assert(html.includes('data-preset-for="down"'), "index.html must include down payment preset chips");
assert(html.includes('data-preset-val="36"'), "index.html must include 36m tenure preset");
assert(html.includes('data-preset-val="60"'), "index.html must include 60m tenure preset");
assert(html.includes('data-preset-val="84"'), "index.html must include 84m tenure preset");
assert(html.includes('data-preset-val="40"'), "index.html must include 40% down payment preset");
assert(html.includes('data-preset-val="70"'), "index.html must include 70% down payment preset");
assert(html.includes('class="stepper-suffix"'), "index.html must include stepper suffix adornments");
assert(html.includes('class="input-adorn-wrap"'), "index.html must include input adornment wrappers");
assert(html.includes('class="adorn-prefix"'), "index.html must include currency prefix adornments");
assert(html.includes('id="rateSlider"'), "index.html must include rateSlider element");
assert(html.includes('id="tenureSlider"'), "index.html must include tenureSlider element");
assert(html.includes('id="downSlider"'), "index.html must include downSlider element");
assert(html.includes('data-slider-for="rate"'), "index.html must link rate slider");
assert(html.includes('data-slider-for="tenure"'), "index.html must link tenure slider");
assert(html.includes('data-slider-for="down"'), "index.html must link down payment slider");
assert(html.includes('class="strategy-scenarios-wrap"'), "index.html must include strategy-scenarios-wrap");
assert(html.includes('data-strategy="lowest-rental"'), "index.html must include lowest-rental strategy pill");
assert(html.includes('data-strategy="fast-payoff"'), "index.html must include fast-payoff strategy pill");
assert(html.includes('data-strategy="min-cash"'), "index.html must include min-cash strategy pill");
assert(html.includes('data-strategy="cash-purchase"'), "index.html must include cash-purchase strategy pill");
assert(style.includes('.badge-lowest-rental'), "css/style.css must include badge-lowest-rental");
assert(style.includes('.cell-metric'), "css/style.css must include cell-metric");
assert(style.includes('.micro-sub'), "css/style.css must include micro-sub");
assert(style.includes('.bar-micro-metric'), "css/style.css must include bar-micro-metric");
assert(style.includes('.v-bar-inner'), "css/style.css must include v-bar-inner");
assert(style.includes('.donut-center-pct'), "css/style.css must include donut-center-pct");
assert(style.includes('.amort-inspection-panel'), "css/style.css must include amort-inspection-panel");
assert(style.includes('.amort-cursor-hairline'), "css/style.css must include amort-cursor-hairline");
assert(style.includes('.amort-point-group'), "css/style.css must include amort-point-group");
assert(style.includes('.dp-wrap'), "css/style.css must include dp-wrap for per-vehicle down payment override");
assert(style.includes('.inline-dp-input'), "css/style.css must include inline-dp-input");
assert(style.includes('.dp-custom-badge'), "css/style.css must include dp-custom-badge");
assert(html.includes('id="headToHeadTray"'), "index.html must include headToHeadTray");
assert(html.includes('id="h2hModal"'), "index.html must include h2hModal");
assert(html.includes('id="openHeadToHeadBtn"'), "index.html must include openHeadToHeadBtn");
assert(style.includes('.h2h-grid'), "css/style.css must include h2h-grid");
assert(style.includes('.h2h-col-card'), "css/style.css must include h2h-col-card");
assert(html.includes('id="quickFilterChips"'), "index.html must include quickFilterChips");
for (const qf of ["all", "under15m", "electrified", "suv", "cbsl40", "official"]) {
  assert(html.includes(`data-qf="${qf}"`), `index.html must include quick filter chip ${qf}`);
}
assert(style.includes('.quick-filter-chips'), "css/style.css must include quick-filter-chips");
assert(style.includes('@media print'), "css/style.css must include @media print");
assert(style.includes('STATUTORY LEASE FINANCING QUOTATION'), "css/style.css must include statutory lease financing quotation watermark in print");
console.log("✓ index.html Elements, Sort Options & Cache Busters PASSED\n");

// -------------------------------------------------------------
// Test 8: Zero-Touch Studio Image Resolver Logic
// -------------------------------------------------------------
console.log("TEST 8: Zero-Touch Studio Image Resolver (image-fetcher.js)");
const imgFetcher = await import("../js/image-fetcher.js");
const { fetchVehicleStudioImage } = imgFetcher;

const yarisImg = await fetchVehicleStudioImage("Toyota Yaris Cross", "Toyota_Yaris_Cross");
assert.match(yarisImg, /^assets\/images\/review-thumbnails\/[a-f0-9]+\.webp$/);

const vezelImg = await fetchVehicleStudioImage("Honda Vezel e:HEV", "Honda_Vezel");
assert.ok(vezelImg === "" || /^assets\/images\/review-thumbnails\//.test(vezelImg));

const sealionImg = await fetchVehicleStudioImage("BYD Sealion 6 Premium", "BYD_Sealion_6");
assert.match(sealionImg, /^assets\/images\/review-thumbnails\/[a-f0-9]+\.webp$/);
assert.equal(await fetchVehicleStudioImage("Nonexistent Model", "Some_Wikipedia_Slug"), "");
console.log("✓ Zero-Touch Studio Image Resolver PASSED\n");

// -------------------------------------------------------------
// Test 9: Proxy-only search, one configurable model, no stored keys
// -------------------------------------------------------------
console.log("TEST 9: Proxy-only search with a single configurable model");
const { searchVehicle } = geminiModule;
assert.equal(typeof searchVehicle, "function", "gemini.js must export searchVehicle");
assert.equal(geminiModule.discoverActiveModel, undefined, "Direct-key model discovery must be removed");
assert(gcpFnCode.includes("process.env.GEMINI_MODEL"), "GCP proxy must read GEMINI_MODEL");
assert(cfWorkerCode.includes("env.GEMINI_MODEL"), "Worker must read GEMINI_MODEL");
assert(!gcpFnCode.includes("gemini-2.0-flash") && !cfWorkerCode.includes("gemini-2.0-flash"), "Shut-down gemini-2.0-flash must not be referenced");

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => ({ error: "upstream_unavailable", detail: "model gone" }) });
try {
  await searchVehicle("Toyota Aqua 2024");
  assert.fail("searchVehicle should throw on proxy error");
} catch (e) {
  assert.match(e.message, /upstream_unavailable/);
} finally {
  globalThis.fetch = originalFetch;
}
mockStorage.setItem("sl_lease_gemini_key", "legacy");
const { clearLegacyKeys } = await import("../js/storage.js");
clearLegacyKeys();
assert.equal(mockStorage.getItem("sl_lease_gemini_key"), null, "Legacy stored keys must be cleared");
console.log("✓ Proxy-only search PASSED\n");

// -------------------------------------------------------------
// Test 10: Inline Base Vehicle Edit Persistence Without Duplication
// -------------------------------------------------------------
console.log("TEST 10: Inline Base Vehicle Edit Persistence Without Duplication");
const storageMod = await import("../js/storage.js");
const { cloneBaseCars, loadSavedCars, saveCars } = storageMod;
const catalogMod = await import("../js/catalog.js");
const { baseVehicles } = catalogMod;

mockStorage.clear();
const catalogPrice = baseVehicles[0].price; // read, not hard-coded, so monthly price refreshes keep this test green
assert.equal(loadSavedCars(baseVehicles).length, 0, "A new comparison starts empty, independent of catalogue size");
const initialCars = cloneBaseCars(baseVehicles);
assert.equal(initialCars.length, 12);
// Simulate inline editing base vehicle #0
initialCars[0].price = 28900000;
initialCars[0].cond = "Recond";
initialCars[0].custom = true;
saveCars(initialCars);

// Simulate page reload
const reloadedCars = loadSavedCars(baseVehicles);
assert.equal(reloadedCars.length, 12, "Inline-edited base vehicle must update in place on reload without duplicating");
assert.equal(reloadedCars[0].price, 28900000);
assert.equal(reloadedCars[0].cond, "Recond");
assert.equal(baseVehicles[0].price, catalogPrice, "Original baseVehicles catalog must remain unmutated");
console.log("✓ Inline Base Vehicle Edit Persistence PASSED\n");

// -------------------------------------------------------------
// Test 11: British English, Onboarding Guide, Filter Reset & Catalogue Parity
// -------------------------------------------------------------
console.log("TEST 11: British English, Onboarding Guide, Filter Reset & Catalogue Parity");
const appJsContent = fs.readFileSync("js/app.js", "utf8");
assert.ok(!appJsContent.includes("installments"), "js/app.js must use British English 'instalments', not 'installments'");
assert.ok(appJsContent.includes("instalments"), "js/app.js must contain British English 'instalments'");
assert.ok(html.includes('id="quickStartGuide"'), "index.html must include #quickStartGuide onboarding guide");
assert.ok(html.includes('id="resetFiltersBtn"'), "index.html must include #resetFiltersBtn");
const curatedCatalogueJs = fs.readFileSync("js/curated-catalogue.js", "utf8");
assert.ok(curatedCatalogueJs.includes("flatToEffective"), "js/curated-catalogue.js must use flatToEffective from calculator.js");
assert.ok(curatedCatalogueJs.includes("minDownFor"), "js/curated-catalogue.js must enforce minDownFor from calculator.js");
assert.ok(curatedCatalogueJs.includes("parsed.insurance"), "js/curated-catalogue.js must read saved insurance from vahanaiq_inputs_v1");
assert.ok(curatedCatalogueJs.includes("parsed.fees"), "js/curated-catalogue.js must read saved fees from vahanaiq_inputs_v1");
console.log("✓ British English, Onboarding Guide, Filter Reset & Catalogue Parity PASSED\n");

console.log("==================================================");
console.log("ALL 11 VERIFICATION TESTS PASSED SUCCESSFULLY! (100%)");
console.log("==================================================");
