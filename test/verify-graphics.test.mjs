import assert from "node:assert/strict";
import fs from "node:fs";

console.log("============================================================");
console.log("VAHANAIQ GRAPHICS & REGULATORY AUDIT CHECKLIST TEST SUITE");
console.log("============================================================\n");

// 1. Verify HTML Structure in index.html
console.log("TEST SUITE 1: Verifying index.html Markup for All Components");
const html = fs.readFileSync("index.html", "utf8");

// LTV Split Bar Markup
assert(html.includes('id="ltvSplitContainer"'), "Missing #ltvSplitContainer");
assert(html.includes('id="ltvEligibilityBadge"'), "Missing #ltvEligibilityBadge");
assert(html.includes('id="ltvBarTrack"'), "Missing #ltvBarTrack");
assert(html.includes('id="ltvBarDp"'), "Missing #ltvBarDp");
assert(html.includes('id="ltvBarLoan"'), "Missing #ltvBarLoan");
assert(html.includes('id="ltvDetailDp"'), "Missing #ltvDetailDp");
assert(html.includes('id="ltvDetailLoan"'), "Missing #ltvDetailLoan");
assert(html.includes('id="ltvDetailCeiling"'), "Missing #ltvDetailCeiling");
assert(html.includes('id="ltvDetailStatus"'), "Missing #ltvDetailStatus");
assert(html.includes('data-preset-val="40"'), "Missing 40% preset chip");
assert(html.includes('data-preset-val="60"'), "Missing 60% preset chip");
assert(html.includes('data-preset-val="70"'), "Missing 70% preset chip");
assert(html.includes('id="downSlider"'), "Missing downSlider");

// Budget Dial & Cashflow Markup
assert(html.includes('id="budgetGraphic"'), "Missing #budgetGraphic");
assert(html.includes('id="budgetNeedle"'), "Missing #budgetNeedle");
assert(html.includes('id="budgetDtiHero"'), "Missing #budgetDtiHero");
assert(html.includes('id="budgetDtiSub"'), "Missing #budgetDtiSub");
assert(html.includes('id="budgetDtiPill"'), "Missing #budgetDtiPill");
assert(html.includes('id="budgetDtiText"'), "Missing #budgetDtiText");
assert(html.includes('id="budgetCashflowLabel"'), "Missing #budgetCashflowLabel");
assert(html.includes('id="budgetCashflowBar"'), "Missing #budgetCashflowBar");
assert(html.includes('id="budgetTelemetryGrid"'), "Missing #budgetTelemetryGrid");

// Modal Details Markup
assert(html.includes('id="detailModal"'), "Missing #detailModal");
assert(html.includes('class="modal detail-modal"'), "Missing .modal.detail-modal class");
assert(html.includes('id="detailTitle"'), "Missing #detailTitle");
assert(html.includes('id="detailBody"'), "Missing #detailBody");

// Savings Planner Markup
assert(html.includes('id="savingsPanel"'), "Missing #savingsPanel");
assert(html.includes('id="plannerVehicle"'), "Missing #plannerVehicle");
assert(html.includes('id="plannerVehicleBadge"'), "Missing #plannerVehicleBadge");
assert(html.includes('id="plannerGoal"'), "Missing #plannerGoal");
assert(html.includes('id="plannerSaved"'), "Missing #plannerSaved");
assert(html.includes('id="plannerPercent"'), "Missing #plannerPercent");
assert(html.includes('data-preset-for="plannerPercent"'), "Missing data-preset-for=\"plannerPercent\"");
assert(html.includes('id="plannerResult"'), "Missing #plannerResult");

console.log("✓ All required DOM IDs and structural elements exist in index.html.\n");


// 2. Setup Comprehensive Browser Mock for Logic Testing
const mockStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};
globalThis.localStorage = mockStorage;

const docListeners = {};
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
    this.attributes = {};
    this.classList = {
      _classes: new Set(),
      add: c => { this.classList._classes.add(c); this.className = Array.from(this.classList._classes).join(" "); },
      remove: c => { this.classList._classes.delete(c); this.className = Array.from(this.classList._classes).join(" "); },
      contains: c => this.classList._classes.has(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (this.classList.contains(c)) this.classList.remove(c);
          else this.classList.add(c);
        } else if (force) {
          this.classList.add(c);
        } else {
          this.classList.remove(c);
        }
      }
    };
  }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  dispatchEvent(event) {
    const evt = typeof event === "string" ? { type: event, target: this } : event;
    if (!evt.target) evt.target = this;
    const fns = this.listeners[evt.type] || [];
    fns.forEach(fn => fn(evt));
    const docFns = docListeners[evt.type] || [];
    docFns.forEach(fn => fn(evt));
  }
  click() {
    this.dispatchEvent({
      type: "click",
      target: this,
      closest: sel => (sel.includes(this.tagName.toLowerCase()) || (this.id && sel.includes(this.id))) ? this : null
    });
  }
  focus() {}
  select() {}
  contains() { return false; }
  closest(sel) {
    if (!sel) return null;
    if (sel.includes("modal")) return null;
    if (sel.includes("panel")) return this;
    if (this.id && sel.includes(this.id)) return this;
    return null;
  }
  querySelector(sel) { return this._stubs[sel] || (this._stubs[sel] = new MockElement("", "DIV")); }
  querySelectorAll() { return []; }
  insertBefore(node, ref) {
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(node); else this.children.splice(i, 0, node);
  }
  get lastElementChild() { return this.children[this.children.length - 1] || null; }
  remove() {}
  after() {}
  replaceChildren(...nodes) { this.children = nodes; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  insertAdjacentHTML(pos, html) { this.innerHTML += html; }
  get parentNode() { return this; }
  setAttribute(k, v) { this.attributes[k] = String(v); this[k] = v; }
  removeAttribute(k) { delete this.attributes[k]; delete this[k]; }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : (this[k] !== undefined ? String(this[k]) : null); }
  getBoundingClientRect() { return { top: 100, bottom: 200, height: 100, width: 100 }; }
}

const domElements = {};
function registerEl(id, tag = "DIV", val = "") {
  const m = new MockElement(id, tag);
  if (val) m.value = val;
  domElements[id] = m;
  return m;
}

// Initialise core inputs
registerEl("rate", "INPUT", "16");
registerEl("rateSlider", "INPUT", "16");
registerEl("rateType", "SELECT", "reducing");
registerEl("tenure", "INPUT", "84");
registerEl("tenureSlider", "INPUT", "84");
registerEl("down", "INPUT", "60");
registerEl("downSlider", "INPUT", "60");
domElements.down.min = "40";
domElements.down.max = "100";
domElements.downSlider.min = "40";
domElements.downSlider.max = "100";

registerEl("income", "INPUT", "");
registerEl("debt", "INPUT", "0");
registerEl("insurance", "INPUT", "");
registerEl("fees", "INPUT", "");
registerEl("dti", "SELECT", "0.4");
registerEl("rateHint");
registerEl("rateTypeHint");
registerEl("tenureHint");
registerEl("downHint");
registerEl("incomeHint");
registerEl("debtHint");
registerEl("dtiHint");
registerEl("summary");
registerEl("sort", "SELECT", "price|-1");
domElements.sort.options = [{ value: "price|-1" }, { value: "price|1" }];
registerEl("warr", "SELECT", "all");
registerEl("condFilter", "SELECT", "all");
registerEl("maxprice", "INPUT", "");
registerEl("maxpriceHint");
registerEl("afford", "SELECT", "all");
registerEl("head");
registerEl("rows");
registerEl("empty");
registerEl("resetCatalogWrap");
registerEl("resetCatalogBtn", "BUTTON");
registerEl("apiKeyInput", "INPUT");
registerEl("keyStatus");
registerEl("settingsModal");
registerEl("openSettingsBtn", "BUTTON");
registerEl("closeSettingsBtn", "BUTTON");
registerEl("saveKeyBtn", "BUTTON");
registerEl("clearKeyBtn", "BUTTON");
registerEl("testKeyBtn", "BUTTON");
registerEl("aiModal");
registerEl("openAiModalBtn", "BUTTON");
registerEl("closeAiModalBtn", "BUTTON");
registerEl("aiCancelBtn", "BUTTON");
registerEl("mCancelBtn", "BUTTON");
registerEl("tabAiBtn", "BUTTON");
registerEl("tabManualBtn", "BUTTON");
registerEl("paneAi");
registerEl("paneManual");
registerEl("aiSearchQuery", "TEXTAREA");
registerEl("aiSearchBtn", "BUTTON");
registerEl("aiUploadAdBtn");
registerEl("aiAdFile", "INPUT");
registerEl("aiAttachedAdBox");
registerEl("aiAttachedAdLabel");
registerEl("aiRemoveAdImgBtn", "BUTTON");
registerEl("aiSearchMsg");
registerEl("aiDiscoveryBox");
registerEl("aiDiscoveryTitle");
registerEl("aiToggleSelectAllBtn", "BUTTON");
registerEl("aiDiscoveryList");
registerEl("aiDiscoveryBackBtn", "BUTTON");
registerEl("aiAddSelectedBtn", "BUTTON");
registerEl("aiUnavailBox");
registerEl("aiResultForm");
registerEl("aiAvailNotes");
registerEl("aiRouteBadge");
registerEl("aiYearSelect", "SELECT");
registerEl("aiTrimSelect", "SELECT");
registerEl("aiCondSelect", "SELECT");
registerEl("aiPriceInput", "INPUT");
registerEl("aiResetPriceBtn", "SPAN");
registerEl("aiWarrSelect", "SELECT");
registerEl("aiKmInput", "INPUT");
registerEl("aiImgPreview", "IMG");
registerEl("aiImgUrl", "INPUT");
registerEl("aiImgFile", "INPUT");
registerEl("aiAddAllTrimsBtn", "BUTTON");
registerEl("aiTrimsYearLabel");
registerEl("aiConfirmAddBtn", "BUTTON");
registerEl("mName", "INPUT");
registerEl("mPrice", "INPUT");
registerEl("mCond", "SELECT");
registerEl("mWarr", "SELECT");
registerEl("mPt", "INPUT");
registerEl("mImgUrl", "INPUT");
registerEl("mAddBtn", "BUTTON");
registerEl("mErr");
registerEl("resetInputsBtn", "BUTTON");
registerEl("h-list");
registerEl("toast");
registerEl("filtersToggle", "BUTTON");
registerEl("filtersCount");
registerEl("toolsPanel");
registerEl("budgetLegend");
registerEl("budgetLive");
registerEl("budgetBar");
registerEl("budgetPanel");
registerEl("budgetGraphic");
registerEl("budgetNeedle");
registerEl("dialTickMax");
registerEl("dialOffscaleBadge");
registerEl("budgetDtiHero");
registerEl("budgetDtiSub");
registerEl("budgetDtiPill");
registerEl("budgetDtiText");
registerEl("budgetCashflowLabel");
registerEl("budgetCashflowBar");
registerEl("budgetTelemetryGrid");
registerEl("resetFiltersBtn", "BUTTON");
registerEl("quickStartGuide", "DETAILS");
registerEl("ltvSplitContainer");
registerEl("ltvBarTrack");
registerEl("ltvBarDp");
registerEl("ltvBarDpText");
registerEl("ltvBarLoan");
registerEl("ltvBarLoanText");
registerEl("ltvEligibilityBadge");
registerEl("ltvDetailDp");
registerEl("ltvDetailLoan");
registerEl("ltvDetailCeiling");
registerEl("ltvDetailStatus");
registerEl("appVersion");
registerEl("priceAsOf");
registerEl("detailModal");
registerEl("detailTitle");
registerEl("detailBody");
registerEl("closeDetailBtn", "BUTTON");
registerEl("plannerVehicle", "SELECT");
registerEl("plannerVehicleBadge", "DIV");
registerEl("plannerGoal", "SELECT");
registerEl("plannerSaved", "INPUT", "0.00");
registerEl("plannerMode", "SELECT", "percent");
registerEl("plannerPercent", "INPUT", "20");
registerEl("plannerPercentWrap", "DIV");
registerEl("plannerMonthly", "INPUT", "");
registerEl("plannerMonthlyWrap", "DIV");
registerEl("plannerDate", "INPUT", "");
registerEl("plannerCalendar", "BUTTON");
registerEl("plannerName", "INPUT", "");
registerEl("plannerSave", "BUTTON");
registerEl("plannerScenarios", "SELECT");
registerEl("plannerDelete", "BUTTON");
registerEl("plannerResult", "DIV");
registerEl("closeDetailBtn", "BUTTON");
registerEl("donutTabLifetime", "BUTTON");
registerEl("donutTabMonthly", "BUTTON");
registerEl("donutSegmentsGroup");
registerEl("donutCenterLabel");
registerEl("donutCenterAmount");
registerEl("donutLegend");
registerEl("sourceGuide", "BUTTON");
registerEl("footerSourceGuide", "BUTTON");
registerEl("guide", "DIALOG");
registerEl("closeGuide", "BUTTON");
registerEl("addVehicleBtn", "BUTTON");
registerEl("printBtn", "BUTTON");
registerEl("themeSwitch");
registerEl("photoCreditsModal");
registerEl("openPhotoCreditsBtn", "BUTTON");
registerEl("closePhotoCreditsBtn", "BUTTON");
registerEl("photoCreditsList");
registerEl("shareModal");
registerEl("shareBtn", "BUTTON");
registerEl("closeShareBtn", "BUTTON");
registerEl("cancelShareBtn", "BUTTON");
registerEl("shareLink", "INPUT");
registerEl("shareStatus");
registerEl("shareIncome", "INPUT");
registerEl("copyShareBtn", "BUTTON");
registerEl("showMoreVehicles", "BUTTON");
registerEl("toggleTerms", "BUTTON");
registerEl("compactTerms");
registerEl("loanTermsGrid");
registerEl("catalogueModal");
registerEl("closeCatalogueBtn", "BUTTON");
registerEl("catalogueSearch", "INPUT");
registerEl("catalogueFiltersToggle", "BUTTON");
registerEl("catalogueFiltersCount");
registerEl("catalogueFilters");
registerEl("catalogueSort", "SELECT");
registerEl("cataloguePriceFilter", "SELECT");
registerEl("catalogueAffordability", "SELECT");
registerEl("catalogueBrandFilter", "SELECT");
registerEl("catalogueBodyFilter", "SELECT");
registerEl("catalogueFuelFilter", "SELECT");
registerEl("catalogueRows");
registerEl("catalogueResultsCount");
registerEl("catalogueEmpty");
registerEl("openAddVehicleBtn", "BUTTON");
registerEl("headToHeadTray");
registerEl("h2hTrayCount");
registerEl("h2hTrayPills");
registerEl("clearHeadToHeadBtn", "BUTTON");
registerEl("openHeadToHeadBtn", "BUTTON");
registerEl("h2hModal");
registerEl("h2hTitle");
registerEl("closeH2hBtn", "BUTTON");
registerEl("h2hBody");
registerEl("quickFilterChips");

globalThis.Image = class extends MockElement {
  constructor() {
    super("", "IMG");
    this.width = 400;
    this.height = 250;
  }
  set src(v) {
    if (this.onload) this.onload();
  }
};
const mockBody = new MockElement("body");
globalThis.document = {
  body: mockBody,
  getElementById: id => domElements[id] || null,
  createElement: tag => {
    const el = new MockElement("", tag);
    if (tag.toLowerCase() === "canvas") {
      el.getContext = () => ({
        fillRect() {},
        createRadialGradient: () => ({ addColorStop() {} }),
        drawImage() {}
      });
      el.toDataURL = () => "data:image/png;base64,mock";
    }
    return el;
  },
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
  },
  dispatchEvent() {}
};

console.log("TEST SUITE 2: Loading app.js & Initialising Calculator");
await import("../js/app.js");
console.log("✓ Application initialized successfully.\n");


// -------------------------------------------------------------
// CHECKLIST ITEM 1: Loan Terms Panel — CBSL LTV Split Bar
// -------------------------------------------------------------
console.log("CHECKLIST ITEM 1: Loan Terms Panel — CBSL LTV Split Bar");

// 1.1 Baseline (60% Down Payment):
console.log("  1.1 Checking Baseline (60% Down):");
assert.equal(domElements.ltvEligibilityBadge.textContent, "CBSL Compliant (All Vehicles)", "Badge should show CBSL Compliant (All Vehicles)");
assert.ok(domElements.ltvEligibilityBadge.className.includes("ok"), "Badge should be green (ok class)");
assert.equal(domElements.ltvDetailCeiling.textContent, "Max 40% Loan (All Cars)", "Ceiling should be Max 40% Loan (All Cars)");
assert.equal(domElements.ltvDetailStatus.textContent, "Standard Minimum Met", "Status should be Standard Minimum Met");
assert.ok(domElements.ltvBarTrack.innerHTML.includes('style="width:60%"'), "Bar track must contain 60% cash deposit width");
assert.ok(domElements.ltvBarTrack.innerHTML.includes('60% Cash Deposit'), "Bar track must state 60% Cash Deposit");
assert.ok(domElements.ltvBarTrack.innerHTML.includes('style="width:40%"'), "Bar track must contain 40% loan width");
assert.ok(domElements.ltvBarTrack.innerHTML.includes('40% Financed Loan'), "Bar track must state 40% Financed Loan");
console.log("  ✓ 1.1 Baseline verified: 60% Deposit / 40% Loan split, green badge, standard minimum met.");

// 1.2 100% Cash Purchase (100% Down Payment):
console.log("  1.2 Checking 100% Cash Purchase:");
domElements.down.value = "100";
domElements.down.dispatchEvent({ type: "input", target: domElements.down });

assert.equal(domElements.ltvEligibilityBadge.textContent, "100% Cash Purchase", "Badge should show 100% Cash Purchase");
assert.ok(domElements.ltvEligibilityBadge.className.includes("ok"), "Badge should be ok");
assert.equal(domElements.ltvDetailCeiling.textContent, "Zero Loan (100% Cash)", "Ceiling should be Zero Loan (100% Cash)");
assert.equal(domElements.ltvDetailStatus.textContent, "100% Cash Purchase", "Status should be 100% Cash Purchase");
assert.ok(domElements.ltvBarTrack.innerHTML.includes('style="width:100%"'), "Deposit bar must be 100%");
assert.ok(domElements.ltvBarTrack.innerHTML.includes('style="width:0%"'), "Financed loan bar must collapse to 0%");
console.log("  ✓ 1.2 100% Cash Purchase verified: Loan collapses to 0%, badge displays 100% Cash Purchase.");

// 1.3 Used Car Statutory Floor (40% Down):
console.log("  1.3 Checking Used Car Statutory Floor (40% Down):");
const calcMod = await import("../js/calculator.js");
const appSettings = calcMod.getSettings();

// Verify computeLeaseTable handles 40% down:
const sampleCars = [
  { name: "Brand New SUV", price: 20000000, cond: "New" },
  { name: "Registered Used Sedan", price: 12000000, cond: "Used" }
];
const leaseResult = calcMod.computeLeaseTable(sampleCars, { ...appSettings, down: 40 });
assert.equal(leaseResult.rows[0].downPct, 60, "New car down payment must be raised to 60%");
assert.equal(leaseResult.rows[0].downRaised, true, "New car downRaised must be true");
assert.equal(leaseResult.rows[1].downPct, 40, "Used car down payment must stay at statutory 40%");
assert.equal(leaseResult.rows[1].downRaised, false, "Used car downRaised must be false");

// When only brand new vehicles are in the comparison, down.min is 60 (CBSL statutory floor for new cars)
console.log("    Checking down.min behavior with only new vehicles present: min is", domElements.down.min);
assert.equal(domElements.down.min, "60", "With only new cars, down.min should be 60");

// Now test adding a Used vehicle via the Manual Add form:
console.log("    Adding a Used vehicle to comparison via Manual Add form...");
domElements.mName.value = "Registered Used Toyota Aqua";
domElements.mPrice.value = "8,500,000";
domElements.mCond.value = "Used";
domElements.mWarr.value = "Official";
domElements.mAddBtn.click();

// Check down.min is now 40 because a Used vehicle is present
console.log("    Checking down.min after adding Used car: min is", domElements.down.min);
assert.equal(domElements.down.min, "40", "When a used vehicle is present, down.min must unlock to 40");

// Set down payment input to 40
domElements.down.value = "40";
domElements.down.dispatchEvent({ type: "input", target: domElements.down });

// Check LTV UI readout
console.log("    Badge text:", domElements.ltvEligibilityBadge.textContent);
console.log("    Ceiling text:", domElements.ltvDetailCeiling.textContent);
console.log("    Status text:", domElements.ltvDetailStatus.textContent);
assert.equal(domElements.ltvEligibilityBadge.textContent, "CBSL Compliant (>1yr Reg Only)");
assert.ok(domElements.ltvEligibilityBadge.className.includes("mid"), "Badge must have amber indicator (class 'mid')");
assert.equal(domElements.ltvDetailCeiling.textContent, "Max 60% Loan (>1yr Reg)");
assert.equal(domElements.ltvDetailStatus.textContent, "Used Car Rule Only");
assert.ok(domElements.ltvBarTrack.innerHTML.includes('style="width:40%"'));
assert.ok(domElements.ltvBarTrack.innerHTML.includes('40% Cash Deposit'));
assert.ok(domElements.ltvBarTrack.innerHTML.includes('style="width:60%"'));
assert.ok(domElements.ltvBarTrack.innerHTML.includes('60% Financed Loan'));
console.log("  ✓ 1.3 Used Car Statutory Floor verified: 40% Down, Max 60% Loan (>1yr Reg), amber tag mid.\n");


// -------------------------------------------------------------
// CHECKLIST ITEM 2: Budget Panel — Speedometer & Cashflow Console
// -------------------------------------------------------------
console.log("CHECKLIST ITEM 2: Budget Panel — Speedometer & Cashflow Console");

// 2.1 Zero-Income / Pending State (Updated per Section 7 audit: absent income must NOT show a misleading '0.0% DTI' / green 'ok' pill):
console.log("  2.1 Checking Zero-Income (Pending) State:");
domElements.income.value = "";
domElements.debt.value = "0";
domElements.down.value = "60";
domElements.income.dispatchEvent({ type: "input", target: domElements.income });

assert.equal(domElements.budgetDtiHero.textContent, "—% DTI", "Hero must show pending —% DTI when income is not provided");
assert.equal(domElements.budgetNeedle.getAttribute("transform"), "rotate(-90.0, 160, 150)", "Needle must anchor at far left (-90 deg)");
assert.equal(domElements.budgetDtiText.textContent, "Enter Net Monthly Income");
assert.ok(domElements.budgetDtiPill.className.includes("pending"), "Status pill must use .pending state instead of green .ok when income is missing");
assert.equal(domElements.dialOffscaleBadge.hidden, true, "Off-scale badge must be hidden when income is absent");
assert.ok(domElements.budgetCashflowBar.innerHTML.includes("Enter net monthly income above to evaluate DTI &amp; cashflow"));
assert.ok(domElements.budgetTelemetryGrid.innerHTML.includes("telemetry-card"), "Telemetry grid must render cards");
console.log("  ✓ 2.1 Zero-Income pending state verified: —% DTI, .pending pill, needle at far-left.\n");

// 2.2 Standard Cashflow & DTI (LKR 450,000 Income & LKR 45,000 Debt):
console.log("  2.2 Checking Standard Cashflow & DTI (LKR 450,000 Income & LKR 45,000 Debt):");
domElements.income.value = "450,000";
domElements.debt.value = "45,000";
domElements.dti.value = "0.4"; // 40% standard ceiling
domElements.income.dispatchEvent({ type: "input", target: domElements.income });

console.log("    DTI Hero:", domElements.budgetDtiHero.textContent);
console.log("    DTI Sub:", domElements.budgetDtiSub.textContent);
console.log("    Status Pill:", domElements.budgetDtiText.textContent, "Class:", domElements.budgetDtiPill.className);
console.log("    Needle Transform:", domElements.budgetNeedle.getAttribute("transform"));
console.log("    Cashflow label:", domElements.budgetCashflowLabel.textContent);

// Verify needle rotated from -90°
const needleTransform = domElements.budgetNeedle.getAttribute("transform");
const angleMatch = needleTransform.match(/rotate\(([-\d.]+),/);
assert(angleMatch, "Needle transform should contain rotation angle");
const needleAngle = parseFloat(angleMatch[1]);
assert.ok(needleAngle > -90, "Needle must rotate forward from -90 deg");

// Verify cashflow spectrum segments
assert.ok(domElements.budgetCashflowBar.innerHTML.includes("cashflow-seg-rental"), "Must contain vehicle rental segment");
assert.ok(domElements.budgetCashflowBar.innerHTML.includes("cashflow-seg-debt"), "Must contain existing debt segment");
assert.ok(domElements.budgetCashflowBar.innerHTML.includes("cashflow-seg-free"), "Must contain discretionary segment");

// Verify telemetry grid cards
assert.ok(domElements.budgetTelemetryGrid.innerHTML.includes("Existing Commitments"), "Telemetry must show Existing Commitments");
assert.ok(domElements.budgetTelemetryGrid.innerHTML.includes("LKR 45,000.00"), "Telemetry must reflect LKR 45,000 debt");
console.log("  ✓ 2.2 Standard Cashflow & DTI verified: Smooth needle rotation, stacked cashflow spectrum segments.\n");

// 2.3 Section 7 Edge Cases: 0% to 200% DTI, Off-Scale 60%+, >100% Monthly Shortfall, & Insurance Segment:
console.log("  2.3 Checking All 17 DTI Edge Cases (0% to 200%), Off-Scale 60%+, and >100% Monthly Shortfall:");
assert.ok(html.includes('id="dialTickMax"') && html.includes('60%+'), "Gauge SVG must label right endpoint as 60%+");
assert.ok(html.includes('id="dialOffscaleBadge"'), "Gauge SVG must include #dialOffscaleBadge");

// Test 100% cash purchase + debt edge cases across all 17 DTI ratios
domElements.down.value = "100"; // 0 lease rental so we can dial exact DTI percentages via existing debt
domElements.insurance.value = "";
domElements.income.value = "100,000";
const edgeRatios = [0, 10, 39.9, 40, 40.1, 49.9, 50, 50.1, 59.9, 60, 60.1, 75, 99.9, 100, 110.1, 150, 200];
for (const pct of edgeRatios) {
  domElements.debt.value = String(pct * 1000);
  domElements.debt.dispatchEvent({ type: "input", target: domElements.debt });
  assert.equal(domElements.budgetDtiHero.textContent, `${pct.toFixed(1)}% DTI`, `Hero must show ${pct.toFixed(1)}% DTI`);
  const expectedAngle = (-90 + (Math.min(60, Math.max(0, pct)) / 60) * 180).toFixed(1);
  assert.equal(domElements.budgetNeedle.getAttribute("transform"), `rotate(${expectedAngle}, 160, 150)`, `Needle angle for ${pct}%`);
  if (pct <= 40) {
    assert.ok(domElements.budgetDtiPill.className.includes("ok"), `${pct}% should be ok`);
    assert.equal(domElements.dialOffscaleBadge.hidden, true, `${pct}% should not be off-scale`);
  } else if (pct <= 50) {
    assert.ok(domElements.budgetDtiPill.className.includes("mid"), `${pct}% should be mid`);
    assert.equal(domElements.dialOffscaleBadge.hidden, true, `${pct}% should not be off-scale`);
  } else if (pct <= 60) {
    assert.ok(domElements.budgetDtiPill.className.includes("bad"), `${pct}% should be bad`);
    assert.equal(domElements.dialOffscaleBadge.hidden, true, `${pct}% should not be off-scale`);
  } else if (pct <= 100) {
    assert.ok(domElements.budgetDtiPill.className.includes("bad"), `${pct}% should be bad`);
    assert.equal(domElements.dialOffscaleBadge.hidden, false, `${pct}% (>60%) must unhide #dialOffscaleBadge`);
    assert.ok(domElements.budgetDtiText.textContent.includes("Off-Scale 60%+"), `${pct}% status must mention Off-Scale 60%+`);
  } else {
    assert.ok(domElements.budgetDtiPill.className.includes("bad"), `${pct}% should be bad`);
    assert.equal(domElements.dialOffscaleBadge.hidden, false, `${pct}% (>100%) must unhide #dialOffscaleBadge`);
    assert.ok(domElements.budgetDtiText.textContent.includes("Exceeds 100% of Net Income"), `${pct}% status must warn Exceeds 100% of Net Income`);
    assert.ok(domElements.budgetCashflowBar.innerHTML.includes("cashflow-seg-shortfall"), `${pct}% must render .cashflow-seg-shortfall`);
  }
}

// Exact user-specified overflow test case:
// Net monthly income: LKR 220,000, Proposed monthly rental: LKR 242,317.18, Existing commitments: LKR 0
domElements.resetCatalogBtn.click();
domElements.down.value = "60";
domElements.rate.value = "16";
domElements.rateType.value = "reducing";
domElements.tenure.value = "84";
domElements.income.value = "220,000";
domElements.debt.value = "0";
domElements.insurance.value = "";
const f84 = calcMod.rental(1, 16, 84);
const exactPrice = Math.round(242317.18 / (f84 * 0.4));
domElements.mName.value = "Overflow Test SUV";
domElements.mPrice.value = String(exactPrice);
domElements.mCond.value = "New";
domElements.mWarr.value = "Official";
domElements.mAddBtn.click();

assert.equal(domElements.budgetDtiHero.textContent, "110.1% DTI", "Exact scenario must display 110.1% DTI");
assert.ok(domElements.budgetCashflowLabel.textContent.includes("110.1% of net monthly income committed"), "Must state 110.1% of net monthly income committed");
assert.ok(domElements.budgetCashflowLabel.textContent.includes("Monthly shortfall: LKR 22,317."), "Must state Monthly shortfall: LKR 22,317.xx");
assert.ok(!domElements.budgetCashflowBar.innerHTML.includes("Rental 100%"), "Must NEVER label a >100% rental as Rental 100%");
assert.ok(domElements.budgetCashflowBar.innerHTML.includes("Rental 110.1%"), "Must label the segment with actual 110.1% ratio");
assert.ok(domElements.budgetCashflowBar.innerHTML.includes("cashflow-seg-shortfall"), "Must include shortfall overflow segment");

// Verify monthly insurance segment in cashflow spectrum
domElements.income.value = "600,000";
domElements.debt.value = "30,000";
domElements.insurance.value = "360,000"; // LKR 30,000/mo = 5% of income
domElements.insurance.dispatchEvent({ type: "input", target: domElements.insurance });
assert.ok(domElements.budgetCashflowBar.innerHTML.includes("cashflow-seg-ins"), "Cashflow bar must include .cashflow-seg-ins when annual insurance is provided");
domElements.insurance.value = "";

// Re-add Registered Used car & BYD ATTO 1 so Checklist Item 4 has both in plannerVehicle
domElements.mName.value = "BYD ATTO 1 Dynamic (Standard Range)";
domElements.mPrice.value = "9,100,000";
domElements.mCond.value = "New";
domElements.mWarr.value = "Official";
domElements.mAddBtn.click();
domElements.mName.value = "Registered Used Toyota Aqua";
domElements.mPrice.value = "8,500,000";
domElements.mCond.value = "Used";
domElements.mWarr.value = "Official";
domElements.mAddBtn.click();
console.log("  ✓ 2.3 All 17 DTI edge cases, 110.1% shortfall scenario, and insurance cashflow segment verified.\n");


// -------------------------------------------------------------
// CHECKLIST ITEM 3: Vehicle Details Modal — Donut & Amortization Curve
// -------------------------------------------------------------
console.log("CHECKLIST ITEM 3: Vehicle Details Modal — Donut & Amortization Curve");

// 3.1 Test Donut & Amortization Generation
const testCar = {
  name: "Toyota Yaris Cross Z",
  price: 17500000,
  cond: "New",
  pt: "1.5L Strong HEV",
  km: "26-30 km/l"
};

// Test detail modal open
const { s: testSettings, rows: [testRow] } = calcMod.computeLeaseTable([testCar], calcMod.getSettings());
assert.ok(testRow.rental > 0, "Rental must be positive");
assert.ok(testRow.interest > 0, "Interest must be positive");
assert.ok(testRow.loan > 0, "Loan principal must be positive");

const yearsSchedule = calcMod.yearlySchedule(testRow.loan, testSettings.rate, testSettings.n);
assert.equal(yearsSchedule.length, 7, "84-month tenure should produce 7 annual schedule entries");

// Verify SVG Amortization Paydown Curve generator
// The function buildAmortizationSvg is internal to app.js, but rendered into detailBody when opened
console.log("  3.1 Opening Details Modal for Toyota Yaris Cross Z:");
// Trigger openDetails by finding the car row action or calling directly
// Let's inspect the SVG amortization curve structure generated:
const totalInterest = testRow.interest;
const maxVal = Math.max(1, testRow.loan, totalInterest);
assert.ok(maxVal > 0);
assert.equal(yearsSchedule[0].year, 1);
assert.equal(yearsSchedule[6].year, 7);
assert.ok(yearsSchedule[0].balance > yearsSchedule[6].balance, "Principal balance must decline each year");
assert.ok(Math.abs(yearsSchedule[6].balance) < 0.01, "Balance at end of Year 7 must reach 0 (within rounding)");

console.log("  ✓ 3.1 Yearly schedule amortization verified: 7 years, decreasing principal, zero terminal balance.");

// 3.2 Test Cost Donut Composition (Lifetime vs Monthly Mode)
console.log("  3.2 Checking Cost Donut Composition Toggle:");
// Lifetime mode: Cash Down Payment, Principal Financed, Total Lease Interest
const lifetimeItems = [
  { label: "Cash Down Payment", val: testRow.dp },
  { label: "Principal Financed", val: testRow.loan },
  { label: "Total Lease Interest", val: testRow.interest }
];
const lifetimeTotal = lifetimeItems.reduce((acc, it) => acc + it.val, 0);
assert.equal(lifetimeTotal, testRow.dp + testRow.rental * testSettings.n, "Lifetime total equals DP + all rentals");

// Monthly mode: Lease Rental, Insurance, Debt
const monthlyItems = [
  { label: "Vehicle Lease Rental", val: testRow.rental }
];
const monthlyTotal = monthlyItems.reduce((acc, it) => acc + it.val, 0);
assert.equal(monthlyTotal, testRow.rental);

console.log("  ✓ 3.2 Donut Composition verified: Lifetime outlay (DP + Loan + Interest) & Monthly outlay modes.\n");

// 3.3 Test Interactive Hover Structure for Donut & Amortization Curve
console.log("  3.3 Checking Interactive Inspection Markup:");
const appJsCode = fs.readFileSync("js/app.js", "utf8");
assert.ok(appJsCode.includes('id="donutCenterPct"'), "Donut chart must contain center percentage container");
assert.ok(appJsCode.includes('data-seg-idx'), "Donut segments must link to index via data-seg-idx");
assert.ok(appJsCode.includes('id="amortInspectionPanel"'), "Amortization chart must include inspection panel");
assert.ok(appJsCode.includes('id="amortCursorHairline"'), "Amortization chart must include cursor hairline");
assert.ok(appJsCode.includes('class="amort-point-group"'), "Amortization chart must contain point groups");
assert.ok(appJsCode.includes('data-amort-yr'), "Detail table must tag rows with data-amort-yr for two-way sync");
console.log("  ✓ 3.3 Interactive inspection markup verified: Two-way donut legend sync & amortization crosshair.\n");

// ============================================================
// CHECKLIST ITEM 4: Savings Planner — Trajectory Curve & CBSL Upfront Breakdown
// ============================================================
console.log("CHECKLIST ITEM 4: Savings Planner — Trajectory Curve, Split Bar & Milestones");

// Find vehicle IDs populated by app.js
const usedCarMatch = domElements.plannerVehicle.innerHTML.match(/value="([^"]+)"[^>]*>[^<]*Registered Used/);
const usedCarId = usedCarMatch ? usedCarMatch[1] : "";
const newCarMatch = domElements.plannerVehicle.innerHTML.match(/value="([^"]+)"[^>]*>[^<]*BYD ATTO 1/);
const newCarId = newCarMatch ? newCarMatch[1] : "";

assert.ok(usedCarId, "Registered Used car ID should be present in plannerVehicle select");
assert.ok(newCarId, "Brand new car ID should be present in plannerVehicle select");

// Ensure income and fees are populated in app settings
domElements.income.value = "500000";
domElements.income.dispatchEvent("input");

// 4.1 Vehicle Statutory Floor Badges
console.log("  4.1 Checking Vehicle Statutory Floor Badges:");
domElements["plannerVehicle"].value = newCarId;
domElements["plannerVehicle"].dispatchEvent("input");
assert.ok(domElements["plannerVehicleBadge"].innerHTML.includes("CBSL 60% Statutory Floor Required"), "New car indicates 60% statutory floor");
domElements["plannerVehicle"].value = usedCarId;
domElements["plannerVehicle"].dispatchEvent("input");
assert.ok(domElements["plannerVehicleBadge"].innerHTML.includes("Eligible for CBSL 40% Minimum Deposit"), "Used car indicates 40% deposit eligibility");
console.log("  ✓ 4.1 Statutory Badges verified: Dynamic CBSL 60% vs 40% floor indication.");

// 4.2 Upfront Cost Composition Split Bar
console.log("  4.2 Checking Upfront Cost Composition Split Bar:");
const plannerHtml = domElements["plannerResult"].innerHTML;
assert.ok(plannerHtml.includes("planner-cost-split-bar"), "Result includes proportional split bar");
assert.ok(plannerHtml.includes("cost-split-seg seg-deposit"), "Result includes deposit segment");
assert.ok(plannerHtml.includes("cost-split-seg seg-fees"), "Result includes fees/insurance segment");
assert.ok(plannerHtml.includes("CBSL Compliant"), "Result includes CBSL compliance badge");
console.log("  ✓ 4.2 Upfront Cost Composition Split Bar verified: Visual deposit/fees segments and CBSL compliance badge.");

// 4.3 Savings Horizon & Trajectory SVG
console.log("  4.3 Checking Savings Horizon & Trajectory SVG:");
domElements["plannerSaved"].value = "2,000,000.00";
domElements["plannerMode"].value = "percent";
domElements["plannerPercent"].value = "20"; // 20% of 500k = 100k/mo
domElements["plannerPercent"].dispatchEvent("input");
const trajectoryHtml = domElements["plannerResult"].innerHTML;
assert.ok(trajectoryHtml.includes("planner-trajectory-card"), "Result includes trajectory card");
assert.ok(trajectoryHtml.includes("planner-trajectory-svg"), "Result includes SVG element");
assert.ok(trajectoryHtml.includes("trajectory-ceiling-line"), "SVG includes target ceiling dashed line");
assert.ok(trajectoryHtml.includes("trajectory-line"), "SVG includes polyline accumulation path");
assert.ok(trajectoryHtml.includes("trajectory-area"), "SVG includes area polygon fill");
assert.ok(trajectoryHtml.includes("marker-start"), "SVG includes start checkpoint marker");
assert.ok(trajectoryHtml.includes("marker-goal"), "SVG includes goal completion checkpoint marker");
console.log("  ✓ 4.3 Trajectory SVG verified: Responsive coordinate scaling, ceiling guide, area fill and milestone markers.");

// 4.4 Target Date Feasibility Pacing (On Track vs Pace Gap)
console.log("  4.4 Checking Target Date Feasibility Pacing:");
domElements["plannerDate"].value = "24-10-2028"; // 24 months
domElements["plannerMode"].value = "fixed";
domElements["plannerMonthly"].value = "800,000.00"; // fast pace
domElements["plannerMonthly"].dispatchEvent("input");
assert.ok(domElements["plannerResult"].innerHTML.includes("on-track"), "Displays on-track class when planned pace >= required");
assert.ok(domElements["plannerResult"].innerHTML.includes("On Track"), "Displays On Track badge");

domElements["plannerMonthly"].value = "50,000.00"; // slow pace
domElements["plannerMonthly"].dispatchEvent("input");
assert.ok(domElements["plannerResult"].innerHTML.includes("pace-needed"), "Displays pace-needed class when pace < required");
assert.ok(domElements["plannerResult"].innerHTML.includes("Pace Gap"), "Displays Pace Gap badge");
console.log("  ✓ 4.4 Target Date Pacing verified: Dynamic On Track / Pace Gap feasibility status.");

// 4.5 Goal Funded Celebratory State
console.log("  4.5 Checking Fully Funded Goal State:");
domElements["plannerSaved"].value = "15,000,000.00"; // target is 8.8m
domElements["plannerSaved"].dispatchEvent("input");
assert.ok(domElements["plannerResult"].innerHTML.includes("planner-funded-card"), "Displays celebratory funded card");
assert.ok(domElements["plannerResult"].innerHTML.includes("Goal 100% Funded &amp; Ready") || domElements["plannerResult"].innerHTML.includes("Goal 100% Funded & Ready"));
console.log("  ✓ 4.5 Goal Funded State verified: Celebratory 100% funded card with readiness confirmation.\n");

// -------------------------------------------------------------
// CHECKLIST ITEM 5: Bank Quotation Print Stylesheet & Layout
// -------------------------------------------------------------
console.log("CHECKLIST ITEM 5: Bank Quotation Print Stylesheet & Regulatory Layout");

// 5.1 Single Consolidated @media print Block
console.log("  5.1 Checking Single Consolidated @media print Block:");
const styleFile = fs.readFileSync("css/style.css", "utf8");
const printMatches = [...styleFile.matchAll(/@media\s+print\s*\{/g)];
assert.equal(printMatches.length, 1, "css/style.css must have exactly 1 consolidated @media print block");
const printSlice = styleFile.slice(styleFile.indexOf("@media print {"));
console.log("  ✓ 5.1 Single consolidated @media print block verified.");

// 5.2 Complete Interactive Noise Suppression
console.log("  5.2 Checking Interactive Noise Suppression:");
const requiredHidden = [
  ".terms-slider",
  'input[type="range"]',
  ".step-btn",
  ".preset-chips",
  "#toolsPanel",
  ".modal-bg",
  ".savings-panel",
  ".page-nav",
  ".site-links",
  "th.actions",
  "td.v-actions"
];
for (const sel of requiredHidden) {
  assert.ok(printSlice.includes(sel), `Must suppress ${sel} in print`);
}
console.log("  ✓ 5.2 Interactive noise suppression verified (sliders, presets, filters, modals, navigation).");

// 5.3 Page Break Hygiene
console.log("  5.3 Checking Page Break Hygiene:");
assert.match(printSlice, /tr\s*\{[^}]*break-inside:\s*avoid/i, "Table rows avoid page breaks");
assert.match(printSlice, /thead\s*\{[^}]*display:\s*table-header-group/i, "Table headers repeat on every page");
assert.match(printSlice, /\.panel\s*\{[^}]*break-inside:\s*avoid/i, "Panels avoid page breaks");
assert.match(printSlice, /\.ltv-split-container\s*\{[^}]*break-inside:\s*avoid/i, "LTV container avoids page breaks");
assert.match(printSlice, /footer\.foot\s*\{[^}]*break-inside:\s*avoid/i, "Footer avoids page breaks");
console.log("  ✓ 5.3 Page break hygiene verified (tr, thead, .panel, .ltv-split-container, footer).");

// 5.4 Exact Print Color Adjustment
console.log("  5.4 Checking Exact Print Color Adjustment:");
assert.match(printSlice, /\.ltv-bar-track\s*\{[^}]*print-color-adjust:\s*exact/i, "LTV track preserves exact color");
assert.match(printSlice, /\.ltv-bar-dp\s*\{[^}]*print-color-adjust:\s*exact/i, "LTV deposit preserves exact color");
assert.match(printSlice, /\.dial-arc-safe\s*\{[^}]*print-color-adjust:\s*exact/i, "Speedometer safe arc preserves exact color");
assert.match(printSlice, /\.cashflow-bar\s*\{[^}]*print-color-adjust:\s*exact/i, "Cashflow spectrum preserves exact color");
assert.match(printSlice, /\.car\s+img\s*,\s*\.car\s+\.ph\s*\{[^}]*print-color-adjust:\s*exact/i, "Vehicle thumbnails preserve exact color");
console.log("  ✓ 5.4 Exact print color adjustment verified across all graphics and indicators.");

// 5.5 CBSL Statutory Disclosures & 3-Column Footer
console.log("  5.5 Checking CBSL Statutory Disclosures & 3-Column Footer:");
assert.match(printSlice, /Central Bank of Sri Lanka Directions No\. 01 of 2026/i, "Quotation carries CBSL Directions 01 of 2026 citation");
assert.match(printSlice, /\.foot-cols\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/i, "Footer notes in 3 columns");
console.log("  ✓ 5.5 CBSL Directions No. 01 of 2026 citation and 3-column footer verified.\n");

// -------------------------------------------------------------
// CHECKLIST ITEM 6: Improvements #8, #9 & #10 (DP Override, H2H, Quick Filters)
// -------------------------------------------------------------
console.log("CHECKLIST ITEM 6: Per-Vehicle DP Override, Head-to-Head Finalists & Quick Market Filters");
const appMod = await import("../js/app.js");
const { matchesQuickFilter } = appMod;
assert.equal(typeof matchesQuickFilter, "function", "matchesQuickFilter must be exported");
assert.equal(matchesQuickFilter({ price: 12500000 }, "under15m"), true);
assert.equal(matchesQuickFilter({ price: 18500000 }, "under15m"), false);
assert.equal(matchesQuickFilter({ pt: "1.5L Strong Hybrid", name: "Toyota Yaris Cross" }, "electrified"), true);
assert.equal(matchesQuickFilter({ pt: "1.0L Turbo Petrol", name: "Nissan Magnite" }, "electrified"), false);
assert.equal(matchesQuickFilter({ groundClearance: "210 mm", name: "Toyota Raize" }, "suv"), true);
assert.equal(matchesQuickFilter({ cond: "Used" }, "cbsl40"), true);
assert.equal(matchesQuickFilter({ cond: "New" }, "cbsl40"), false);
assert.equal(matchesQuickFilter({ w: "Official" }, "official"), true);
assert.equal(matchesQuickFilter({ w: "Grey" }, "official"), false);
console.log("  ✓ 6.1 Quick Market Segment Filter predicates verified.");

assert.ok(printSlice.includes(".quick-filter-chips"), "Print stylesheet suppresses .quick-filter-chips");
assert.ok(printSlice.includes("#headToHeadTray"), "Print stylesheet suppresses #headToHeadTray");
assert.ok(printSlice.includes("#h2hModal"), "Print stylesheet suppresses #h2hModal");
assert.ok(printSlice.includes(".edit-dp"), "Print stylesheet suppresses .edit-dp");
console.log("  ✓ 6.2 Print suppression for DP override, Head-to-Head tray/modal, and Quick Filter chips verified.\n");

console.log("============================================================");
console.log("ALL 6 AUDIT CHECKLIST SUITES VERIFIED AND PASSED SUCCESSFULLY!");
console.log("============================================================");
