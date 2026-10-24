(function() {
  if (typeof window !== "undefined" && window.location.protocol !== "file:") return;
  const __mods = {};
  // === dates.js ===
  __mods.mod_1_dates = {};
  (function(__exports) {
// ISO values stay in storage; people see a friendly British-English date.
function formatDate(value, { numeric = false } = {}) {
  const raw = String(value || '');
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : /^\d{2}[/-]\d{2}[/-]\d{4}$/.test(raw) ? raw.slice(6)+'-'+raw.slice(3,5)+'-'+raw.slice(0,2) : '';
  if (!iso) return 'Date unavailable';
  const date = new Date(iso+'T12:00:00');
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== +iso.slice(0,4) || date.getMonth()+1 !== +iso.slice(5,7) || date.getDate() !== +iso.slice(8,10)) return 'Date unavailable';
  return numeric ? iso.split('-').reverse().join('-') : date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
function formatMonth(value) {
  return /^\d{4}-\d{2}$/.test(String(value||'')) ? formatDate(value+'-01').replace(/^1 /,'') : 'Date unavailable';
}

  __exports.formatDate = formatDate;
  __exports.formatMonth = formatMonth;
  })(__mods.mod_1_dates);

  // === money-input.js ===
  __mods.mod_3_money_input = {};
  (function(__exports) {
// Rupee inputs: plain text with a numeric keypad, thousands separators added as you type
const MAX_DIGITS = 15;
const moneyFormatter = new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Round only for presentation; calculations and saved amounts retain their precision.
const formatMoneyAmount = value => moneyFormatter.format(Math.abs(value) < 0.005 ? 0 : (value || 0));

// Keep decimals and reject ambiguous input instead of silently changing its value.
// Supports plain digits, standard thousands grouping (groups of 3), and South Asian lakh/crore grouping.
function parseMoneyText(text) {
  const raw = String(text ?? "").trim().replace(/^(?:LKR|Rs\.?|₨)\s*/i, "");
  if (!/^-?(?:(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3})(?:\.\d{0,2})?|\.\d{1,2})$/.test(raw)) return NaN;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && Math.abs(value) < 10 ** MAX_DIGITS ? value : NaN;
}

function formatMoneyText(text, { editing = false, grouping = true } = {}) {
  const raw = String(text ?? "");
  if (!editing) {
    const value = parseMoneyText(raw);
    if (!Number.isFinite(value)) return raw;
    const formatted = formatMoneyAmount(value);
    return grouping ? formatted : formatted.replace(/,/g, "");
  }
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  const clean = trimmed.replace(/^(?:LKR|Rs\.?|₨)\s*/i, "").replace(/,/g, "");
  if (clean === "-" || clean === "") return clean;
  if (!/^-?(?:\d*(?:\.\d{0,2})?|\.\d{1,2})$/.test(clean)) return raw;
  const [whole, fraction] = clean.split(".");
  if (whole === "" && fraction === undefined) return raw;
  if (whole === "-" && fraction === undefined) return "-";
  const numDigits = (whole.replace(/^-/, "") + (fraction || "")).length;
  if (numDigits > MAX_DIGITS) return raw;

  let formattedWhole = "";
  if (whole === "-") {
    formattedWhole = "-";
  } else if (whole !== "") {
    const isNeg = whole.startsWith("-");
    const digits = whole.replace(/^-/, "");
    const n = Number(digits || "0");
    formattedWhole = (isNeg ? "-" : "") + (grouping ? n.toLocaleString("en-LK") : digits);
  }
  return fraction === undefined ? formattedWhole : formattedWhole + "." + fraction;
}

function attachMoneyInput(el, { grouping = true } = {}) {
  if (!el || !el.addEventListener) return;
  let prevValue = el.value || "";
  const finishEditing = () => {
    el.value = formatMoneyText(el.value, { grouping });
    prevValue = el.value;
  };
  finishEditing();
  el.addEventListener("blur", finishEditing);

  const selectAll = () => {
    try {
      if (typeof el.select === "function" && (typeof document === "undefined" || document.activeElement === el)) {
        el.select();
      }
    } catch (e) {}
  };

  el.addEventListener("focus", () => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(selectAll);
    } else {
      setTimeout(selectAll, 0);
    }
  });

  el.addEventListener("mouseup", e => {
    if (el.value === "0.00" || el.value === "0") {
      if (el.selectionStart === el.selectionEnd) {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        selectAll();
      }
    }
  });

  el.addEventListener("keydown", e => {
    if (!e || !e.key) return;
    const isZero = el.value === "0.00" || el.value === "0";
    if (!isZero) return;

    if (e.key === "Backspace" || e.key === "Delete") {
      if (typeof e.preventDefault === "function") e.preventDefault();
      el.value = "";
      prevValue = "";
      if (typeof el.dispatchEvent === "function") {
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (typeof el.oninput === "function") {
        el.oninput();
      }
    } else if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (typeof e.preventDefault === "function") e.preventDefault();
      el.value = e.key;
      prevValue = el.value;
      try {
        if (typeof el.setSelectionRange === "function") el.setSelectionRange(1, 1);
      } catch (err) {}
      if (typeof el.dispatchEvent === "function") {
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (typeof el.oninput === "function") {
        el.oninput();
      }
    } else if (e.key === "." && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (typeof e.preventDefault === "function") e.preventDefault();
      el.value = "0.";
      prevValue = el.value;
      try {
        if (typeof el.setSelectionRange === "function") el.setSelectionRange(2, 2);
      } catch (err) {}
      if (typeof el.dispatchEvent === "function") {
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (typeof el.oninput === "function") {
        el.oninput();
      }
    }
  });

  el.addEventListener("input", e => {
    let value = el.value;
    if (prevValue === "0.00" || prevValue === "0") {
      if (value !== prevValue && (value === "0.0" || value === "0." || value === ".00" || value === "00" || value === ".0")) {
        el.value = "";
        prevValue = "";
        return;
      }
      const digitsOnly = value.replace(/\D/g, "");
      if (digitsOnly.length > 0 && digitsOnly !== "0" && digitsOnly !== "000") {
        if (e && e.data && /^\d+$/.test(e.data)) {
          value = e.data;
          el.value = value;
        } else if (digitsOnly.replace(/^0+/, "") !== "") {
          value = digitsOnly.replace(/^0+/, "");
          el.value = value;
        }
      }
    }
    const caret = el.selectionStart == null ? value.length : el.selectionStart;
    const digitsBefore = value.slice(0, caret).replace(/\D/g, "").length;
    // Do not pad cents mid-keystroke: the user must be able to enter "250000.5".
    const formatted = formatMoneyText(value, { editing: true, grouping });
    if (formatted !== value) {
      el.value = formatted;
      // Put the caret back after the same number of digits
      let pos = formatted.startsWith("-") ? 1 : 0;
      for (let seen = 0; pos < formatted.length && seen < digitsBefore; pos++) {
        if (/\d/.test(formatted[pos])) seen++;
      }
      if (value.slice(0, caret).endsWith(".") && formatted[pos] === ".") pos++;
      if (caret === value.length) pos = formatted.length;
      try { el.setSelectionRange(pos, pos); } catch (e) {}
    }
    prevValue = el.value;
  });
}

  __exports.parseMoneyText = parseMoneyText;
  __exports.formatMoneyText = formatMoneyText;
  __exports.attachMoneyInput = attachMoneyInput;
  __exports.formatMoneyAmount = formatMoneyAmount;
  })(__mods.mod_3_money_input);

  // === calculator.js ===
  __mods.mod_2_calculator = {};
  (function(__exports) {
// VahanaIQ: Sri Lankan Lease & Actuarial Calculator Logic
// Down-payment rules follow CBSL Directions No. 01 of 2026, cl. 2.1 (motor cars):
// at most 40% financed for unregistered cars and cars registered under a year (60% down),
// at most 60% financed for cars registered over a year (40% down).

const {  parseMoneyText, formatMoneyAmount  } = __mods.mod_3_money_input;
const DOWN_MIN = 40;          // lowest down payment any car can have (registered over a year)
const DOWN_MIN_UNREG = 60;    // brand new, reconditioned and recently registered cars

// Vehicle conditions. "Recent" is a car registered in Sri Lanka for under a year, which the
// Direction treats like an unregistered one.
const CONDITIONS = { New: "Brand New", Recond: "Reconditioned", Recent: "Registered under a year", Used: "Registered Used" };

// The lowest down payment the Direction allows for a condition. Only "Used" (registered in
// Sri Lanka for over a year) may go down to 40%; an unknown condition is treated as unregistered.
function minDownFor(cond, financeClass, firstRegisteredOn, today = new Date()) {
  if (financeClass === "commercial") return DOWN_MIN;
  if (firstRegisteredOn !== undefined && firstRegisteredOn !== null && firstRegisteredOn !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstRegisteredOn)) return DOWN_MIN_UNREG;
    const first = new Date(firstRegisteredOn + 'T12:00:00');
    if (!Number.isFinite(first.getTime()) || first.toISOString().slice(0, 10) !== firstRegisteredOn) return DOWN_MIN_UNREG;
    const anniversary = new Date(first); anniversary.setFullYear(first.getFullYear() + 1);
    return cond === "Used" && new Date(today.getFullYear(), today.getMonth(), today.getDate()) > new Date(anniversary.getFullYear(), anniversary.getMonth(), anniversary.getDate()) ? DOWN_MIN : DOWN_MIN_UNREG;
  }
  return cond === "Used" ? DOWN_MIN : DOWN_MIN_UNREG;
}

const fmt = formatMoneyAmount;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = id => {
  const el = typeof id === "string" ? document.getElementById(id) : id;
  const raw = el && typeof el === "object" && "value" in el ? el.value : id;
  if (typeof raw === "number") return isFinite(raw) ? raw : NaN;
  if (raw === null || raw === undefined || raw === "") return NaN;
  return parseMoneyText(raw);
};

function rental(loan, rate, n) {
  const i = rate / 100 / 12;
  return i === 0 ? loan / n : (loan * i) / (1 - Math.pow(1 + i, -n));
}

// A flat rate charges interest on the whole amount financed for the whole term:
// rental = loan × (1 + flat × years) / months. This returns the reducing-balance annual rate
// (monthly compounding) with the same rental, so every other figure can use one formula.
function flatToEffective(flat, n) {
  if (!(flat > 0) || !(n > 0)) return Math.max(0, flat || 0);
  const target = (1 + flat / 100 * n / 12) / n;
  let lo = 0, hi = 5;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (rental(1, mid * 100, n) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2 * 100;
}

// Year-by-year totals of a reducing-balance loan: rentals paid, interest, principal and the
// balance left at the end of each year (the last year may be shorter than 12 months)
function yearlySchedule(loan, rate, n) {
  const i = rate / 100 / 12;
  const pay = rental(loan, rate, n);
  const years = [];
  let balance = loan;
  for (let m = 1; m <= n; m++) {
    const interest = balance * i;
    const principal = Math.min(balance, pay - interest);
    balance = Math.max(0, balance - principal);
    if ((m - 1) % 12 === 0) years.push({ year: years.length + 1, months: 0, paid: 0, interest: 0, principal: 0, balance: 0 });
    const y = years[years.length - 1];
    y.months += 1;
    y.paid += pay;
    y.interest += interest;
    y.principal += principal;
    y.balance = balance;
  }
  return years;
}

function getSettings() {
  let rate = num("rate");
  if (!(rate >= 0)) rate = 16;
  let n = num("tenure");
  if (!(n >= 1)) n = 84;
  let down = num("down");
  if (!(down >= 0)) down = DOWN_MIN_UNREG;
  
  const rawN = num("tenure");
  const rawDown = num("down");

  const nCap = n > 84;
  const nLow = isFinite(rawN) && rawN < 6;
  n = Math.min(84, Math.max(6, Math.round(n)));
  
  const downLow = isFinite(rawDown) && rawDown < DOWN_MIN;
  const inputMinimum = Number(document.getElementById("down")?.min) || DOWN_MIN;
  down = Math.min(100, Math.max(inputMinimum, DOWN_MIN, down));

  const tenureHint = document.getElementById("tenureHint");
  const downHint = document.getElementById("downHint");
  
  if (tenureHint) {
    if (nCap) {
      tenureHint.textContent = "Capped at the 84-month maximum";
      tenureHint.className = "hint warn";
    } else if (nLow) {
      tenureHint.textContent = "Minimum 6 months";
      tenureHint.className = "hint warn";
    } else {
      tenureHint.textContent = "Maximum 84";
      tenureHint.className = "hint";
    }
  }

  if (downHint) {
    if (downLow) {
      downHint.textContent = "Raised to the 40% minimum down payment";
      downHint.className = "hint warn";
    } else if (down < DOWN_MIN_UNREG) {
      downHint.textContent = "Below 60%, only cars registered over a year qualify. Others are calculated at 60%.";
      downHint.className = "hint";
    } else {
      downHint.textContent = inputMinimum >= 60 ? "Minimum 60% for new and recent passenger vehicles. A larger deposit reduces the amount financed." : "Minimum 40% (cars registered over a year). Brand new, reconditioned and recently registered cars need 60%, so they're calculated at 60% below that.";
      downHint.className = "hint";
    }
  }

  const income = num("income");
  const debt = Math.max(0, num("debt") || 0);
  const dti = parseFloat(document.getElementById("dti").value);
  const typeEl = document.getElementById("rateType");
  const rateType = typeEl && typeEl.value === "flat" ? "flat" : "reducing";
  const extra = id => document.getElementById(id) ? Math.max(0, num(id) || 0) : 0;

  return {
    rate: rateType === "flat" ? flatToEffective(rate, n) : rate,
    rateInput: rate, rateType, n, down,
    income: income > 0 ? income : 0, debt, dti,
    insurance: extra("insurance"), fees: extra("fees")
  };
}

// "16% a year (reducing balance)" or "14% flat (about 25.17% a year reducing balance)"
const rateLabel = s => s.rateType === "flat"
  ? `${s.rateInput}% flat (about ${s.rate.toFixed(2)}% a year reducing balance)`
  : `${s.rate}% a year (reducing balance)`;

function computeLeaseTable(cars, settings = getSettings()) {
  const s = settings;
  const f = rental(1, s.rate, s.n);
  const insurance = s.insurance || 0, fees = s.fees || 0;
  const rows = cars.map((c, idx) => {
    let loan, dp, rent, interest, total, need;
    const minDown = minDownFor(c.cond, c.financeClass, c.firstRegisteredOn);
    const hasCustomDown = Number.isFinite(c.downOverride) && c.downOverride > 0;
    const targetDown = hasCustomDown ? Math.min(100, Math.max(minDown, c.downOverride)) : s.down;
    // Each car is calculated at its legal minimum down payment, or the chosen one if higher
    const downPct = targetDown >= 100 ? 100 : Math.max(targetDown, minDown);
    if (downPct >= 100) {
      loan = 0;
      dp = c.price;
      rent = 0;
      interest = 0;
      total = c.price;
      need = (s.debt + insurance / 12) / s.dti;
    } else {
      loan = c.price * (1 - downPct / 100);
      dp = c.price - loan;
      rent = loan * f;
      interest = rent * s.n - loan;
      total = dp + rent * s.n;
      need = (rent + s.debt + insurance / 12) / s.dti;
    }
    // Optional costs: up-front fees and comprehensive insurance over the term
    const upfront = dp + fees;
    const monthlyCost = rent + insurance / 12;
    total += fees + insurance * s.n / 12;
    let status = "na";
    if (s.income) {
      const load = (monthlyCost + s.debt) / s.income;
      status = load <= s.dti ? "ok" : "bad";
    }
    return Object.assign({}, c, { _idx: idx, loan, dp, downPct, downCustom: hasCustomDown, downRaised: !hasCustomDown && downPct > s.down, upfront, monthlyCost, rental: rent, interest, total, need, status });
  });

  const room = s.income ? Math.max(0, s.income * s.dti - s.debt - insurance / 12) : 0;
  return { s, f, rows, room };
}

  __exports.minDownFor = minDownFor;
  __exports.rental = rental;
  __exports.flatToEffective = flatToEffective;
  __exports.yearlySchedule = yearlySchedule;
  __exports.getSettings = getSettings;
  __exports.computeLeaseTable = computeLeaseTable;
  __exports.DOWN_MIN = DOWN_MIN;
  __exports.DOWN_MIN_UNREG = DOWN_MIN_UNREG;
  __exports.CONDITIONS = CONDITIONS;
  __exports.fmt = fmt;
  __exports.esc = esc;
  __exports.num = num;
  __exports.rateLabel = rateLabel;
  })(__mods.mod_2_calculator);

  // === catalog.js ===
  __mods.mod_4_catalog = {};
  (function(__exports) {
// Frozen v2 comparison snapshot for saved-data migration and legacy refresh tests.
// These estimates are not the current market catalogue. See market-catalogue.js.

// Month the catalogue prices were last checked (YYYY-MM); shown in the footer
const catalogMeta = { priceUpdated: "2026-10" };

const baseVehicles = [
  { name: "Toyota Corolla Cross Z (Adventure)", pt: "1.8L Strong HEV", km: "23-26 km/l", w: "Grey", price: 30500000, cond: "New", img: "assets/images/toyota-corolla-cross.jpg", custom: false },
  { name: "BYD Sealion 6 Premium (AWD)", pt: "1.5L PHEV", km: "20 km/l, 1000+ km range", w: "Official", price: 27700000, cond: "New", img: "assets/images/byd-sealion-6.jpg", custom: false },
  { name: "Honda Vezel e:HEV Z", pt: "1.5L Strong HEV", km: "24-28 km/l", w: "Grey", price: 21320000, cond: "New", img: "assets/images/honda-vezel.jpg", custom: false },
  { name: "BYD Sealion 5 Premium", pt: "1.5L PHEV", km: "20 km/l, 1000+ km range", w: "Official", price: 20750000, cond: "New", img: "assets/images/byd-sealion-5.jpg", custom: false },
  { name: "Toyota Yaris Cross Z", pt: "1.5L Strong HEV", km: "26-30 km/l", w: "Grey", price: 17500000, cond: "New", img: "assets/images/toyota-yaris-cross.jpg", custom: false },
  { name: "Toyota Urban Cruiser Hyryder V", pt: "1.5L Strong HEV", km: "26-28 km/l", w: "Grey", price: 17500000, cond: "New", img: "assets/images/toyota-hyryder.jpg", custom: false },
  { name: "Toyota Raize Z Hybrid", pt: "1.2L Strong HEV", km: "26-28 km/l", w: "Grey", price: 16300000, cond: "New", img: "assets/images/toyota-raize.jpg", custom: false },
  { name: "Suzuki Swift MZ Hybrid", pt: "1.2L Mild MHEV", km: "22-24.5 km/l", w: "Grey", price: 12600000, cond: "New", img: "assets/images/suzuki-swift.jpg", custom: false },
  { name: "Suzuki Fronx Alpha (Turbo)", pt: "1.0L Turbo MHEV", km: "20-22 km/l", w: "Grey", price: 11250000, cond: "New", img: "assets/images/suzuki-fronx.jpg", custom: false },
  { name: "Toyota Urban Cruiser Taisor V", pt: "1.0L Turbo Petrol", km: "18-20 km/l", w: "Grey", price: 11750000, cond: "New", img: "assets/images/toyota-taisor.jpg", custom: false },
  { name: "Nissan Magnite Tekna Plus", pt: "1.0L Turbo Petrol", km: "14-18 km/l", w: "Official", price: 9800000, cond: "New", img: "assets/images/nissan-magnite.jpg", custom: false },
  { name: "Suzuki Wagon R Custom Z", pt: "660cc Mild MHEV", km: "25-30 km/l", w: "Grey", price: 9300000, cond: "New", img: "assets/images/suzuki-wagon-r.jpg", custom: false }
];

  __exports.catalogMeta = catalogMeta;
  __exports.baseVehicles = baseVehicles;
  })(__mods.mod_4_catalog);

  // === market-catalogue.js ===
  __mods.mod_6_market_catalogue = {};
  (function(__exports) {
// Sri Lankan passenger-vehicle and pickup catalogue. Online price evidence reviewed 21/10/2026.
// Unsubstantiated amounts are omitted; enter a quote to calculate. Listings do not guarantee stock.
const catalogMeta = { priceUpdated: "2026-10" };
const baseVehicles = [
  {id: "toyota-yaris-cross-range-official", make: "Toyota", model: "Yaris Cross", name: "Toyota Yaris Cross", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.5L Hybrid · e-CVT", km: "26.0–30.8 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dailymirror.lk/breaking-news/Toyota-releases-new-price-list-with-lowest-price-starting-at-Rs-7-4-million/108-302123", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "110–116 HP (82–85 kW)", torque: "141 Nm + 120 Nm motor", transmission: "e-CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "210 mm", dimensions: "4,310 × 1,770 × 1,615 mm · 458 L boot", safety: "6 Airbags · Toyota Safety Sense (PCS, ACC, LDA, BSM) · 360° Camera", features: "10.1\" Wireless Apple CarPlay/Android Auto · Panoramic Glass Roof · Power Tailgate · 7\" Digital Cluster", warranty: "3 yrs / 100,000 km (Toyota Lanka) · 5 yrs Hybrid Battery"},
  {id: "toyota-corolla-cross-range-official", make: "Toyota", model: "Corolla Cross", name: "Toyota Corolla Cross", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.8L Hybrid · e-CVT", km: "23.3–26.2 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dailymirror.lk/breaking-news/Toyota-releases-new-price-list-with-lowest-price-starting-at-Rs-7-4-million/108-302123", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "122 HP (90 kW) combined", torque: "142 Nm + 163 Nm motor", transmission: "e-CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "161 mm", dimensions: "4,460 × 1,825 × 1,620 mm · 487 L boot", safety: "7 Airbags · Toyota Safety Sense · Blind Spot Monitor · Rear Cross Traffic Alert", features: "9\" Display Audio · Dual-Zone Climate · Power Moonroof · Kick-Sensor Power Tailgate · 18\" Alloys", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-rush-range-official", make: "Toyota", model: "Rush", name: "Toyota Rush", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L 2NR-VE Dual VVT-i Petrol · 4AT / 5MT", km: "14.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/toyota-rush-2025", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "104 HP (77 kW)", torque: "136 Nm", transmission: "4-speed Automatic", drivetrain: "RWD", seats: 7, groundClearance: "220 mm", dimensions: "4,435 × 1,695 × 1,705 mm · 7-Seater (213–514 L)", safety: "6 SRS Airbags · Vehicle Stability Control (VSC) · Hill-Start Assist · Rear Parking Sensors", features: "7\" Touchscreen · Auto A/C with Rear Blower · Smart Entry & Push Start · LED Headlamps · 17\" Alloys", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-raize-range-official", make: "Toyota", model: "Raize", name: "Toyota Raize", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L Turbo Petrol · D-CVT", km: "18.6–20.7 km/L (WLTC)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dailymirror.lk/breaking-news/Toyota-releases-new-price-list-with-lowest-price-starting-at-Rs-7-4-million/108-302123", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "98 HP (1.0T) / 87 HP (1.2L)", torque: "140 Nm (1.0T) / 113 Nm (1.2L)", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "185–200 mm", dimensions: "3,995 × 1,695 × 1,620 mm · 369 L boot", safety: "6 Airbags · Smart Assist (AEB, ACC, Lane Keep, BSM, RCTA) · Corner Sensors", features: "9\" Smartphone-Link Display · 7\" TFT Digital Meter · Heated Front Seats (JDM) · 17\" Alloys · LED Sequential Lamps", warranty: "3 yrs / 100,000 km (Official) or Importer Warranty"},
  {id: "toyota-rav4-2026-range-official", make: "Toyota", model: "RAV4 2026", name: "Toyota RAV4 2026", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "2.0L Petrol / 2.5L Hybrid · CVT", km: "16.0–21.4 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/toyota-raize-2025", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "170 HP (2.0L) / 219 HP (2.5L HEV AWD)", torque: "203 Nm / 221 Nm + E-Four", transmission: "Direct-Shift CVT / e-CVT", drivetrain: "FWD / E-Four AWD", seats: 5, groundClearance: "195–200 mm", dimensions: "4,600 × 1,855 × 1,685 mm · 580 L boot", safety: "Toyota Safety Sense (PCS, DRCC, LTA, AHB, BSM) · 7 SRS Airbags · Panoramic View Monitor", features: "12.9\" Display Audio · Panoramic Sunroof & Moonroof · Dual Wireless Chargers · Ventilated Leather Seats · 6 Drive Modes", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-land-cruiser-250-range-official", make: "Toyota", model: "Land Cruiser 250", name: "Toyota Land Cruiser 250", body: "SUV", trim: null, year: null, market: null, fuel: "Diesel", pt: "2.8L Turbo Diesel / 2.7L Petrol · 8AT", km: "7.5–11.0 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dailymirror.lk/breaking-news/Toyota-releases-new-price-list-with-lowest-price-starting-at-Rs-7-4-million/108-302123", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "204 HP (2.8D) / 163 HP (2.7P)", torque: "500 Nm (2.8D) / 246 Nm (2.7P)", transmission: "8-speed Direct Shift AT / 6AT", drivetrain: "Full-Time 4WD w/ Torsen LSD & Low Range", seats: 7, groundClearance: "221 mm", dimensions: "4,925 × 1,980 × 1,935 mm · 2,850 mm wheelbase", safety: "Toyota Safety Sense 3.0 · Multi-Terrain Monitor · Crawl Control · SDM Stabilizer Disconnect · 8 Airbags", features: "12.3\" Dual Screens · Heated & Ventilated Leather Seats · Tri-Zone Climate · Cool Box · Electric Tailgate", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-land-cruiser-300-range-official", make: "Toyota", model: "Land Cruiser 300", name: "Toyota Land Cruiser 300", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "3.5L V6 Twin-Turbo · 10AT", km: "8.0–10.2 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dailymirror.lk/breaking-news/Toyota-releases-new-price-list-with-lowest-price-starting-at-Rs-7-4-million/108-302123", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "409 HP (3.5T) / 304 HP (3.3D)", torque: "650 Nm (3.5T) / 700 Nm (3.3D)", transmission: "10-speed Direct Shift Automatic", drivetrain: "Full-Time 4WD w/ Front/Rear Diff Locks", seats: 7, groundClearance: "235 mm", dimensions: "4,985 × 1,980 × 1,945 mm · 2,850 mm wheelbase", safety: "Toyota Safety Sense · Fingerprint Start · 3D Multi-Terrain Monitor · E-KDSS Suspension · 10 Airbags", features: "12.3\" Infotainment · 14-Speaker JBL Audio · 4-Zone Climate · Rear Seat Entertainment · Power 3rd Row", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-fortuner-range-official", make: "Toyota", model: "Fortuner", name: "Toyota Fortuner", body: "SUV", trim: null, year: null, market: null, fuel: "Diesel", pt: "2.8L Turbo Diesel · 6AT 4WD", km: "10.5–12.4 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/vehicle-model/fortuner/", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "204 HP (150 kW)", torque: "500 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "Part-Time 4WD w/ Auto LSD", seats: 7, groundClearance: "279 mm", dimensions: "4,795 × 1,855 × 1,835 mm · 7-Seater", safety: "7 SRS Airbags · Toyota Safety Sense · Downhill Assist Control · Active Traction Control (A-TRC)", features: "8\" Touchscreen w/ CarPlay · Power Leather Seats · Dual-Zone Auto A/C · Hands-Free Power Tailgate · Bi-Beam LED", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-prius-range-official", make: "Toyota", model: "Prius", name: "Toyota Prius", body: "Passenger car", trim: null, year: null, market: null, fuel: "HEV", pt: "1.8L Hybrid · e-CVT", km: "28.6–32.6 km/L (WLTC)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dailymirror.lk/breaking-news/Toyota-releases-new-price-list-with-lowest-price-starting-at-Rs-7-4-million/108-302123", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "140 HP (1.8L) / 196 HP (2.0L)", torque: "142–188 Nm + electric motor", transmission: "e-CVT Automatic", drivetrain: "FWD / E-Four AWD", seats: 5, groundClearance: "145 mm", dimensions: "4,600 × 1,780 × 1,420 mm · 410 L boot", safety: "Toyota Safety Sense 3.0 · Proactive Driving Assist · Safe Exit Assist · 7 Airbags · 360° Camera", features: "12.3\" Central Display · 7\" Top-Mount Driver Cluster · Panoramic Glass Roof · Digital Inner Mirror · 19\" Aero Wheels", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-wigo-range-official", make: "Toyota", model: "Wigo", name: "Toyota Wigo", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L 1KR-VE 3-Cyl VVT-i Petrol · D-CVT", km: "20.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dailymirror.lk/breaking-news/Toyota-releases-new-price-list-with-lowest-price-starting-at-Rs-7-4-million/108-302123", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "67 HP (49 kW)", torque: "89 Nm", transmission: "Dual-Mode CVT", drivetrain: "FWD", seats: 5, groundClearance: "160 mm", dimensions: "3,760 × 1,665 × 1,505 mm · 276 L boot", safety: "Dual SRS Airbags · Vehicle Stability Control (VSC) · Hill-Start Assist · Rear Camera & Sensors · Blind Spot Monitor", features: "8\" Display Audio w/ Apple CarPlay & Android Auto · Smart Entry & Push Start · Digital A/C · LED Headlamps", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-yaris-ativ-range-official", make: "Toyota", model: "Yaris Ativ", name: "Toyota Yaris Ativ", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.2L Petrol · Super CVT-i", km: "21.3 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.firstcar.lk/vehicles/toyota-yaris-ativ", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "94 HP (69 kW)", torque: "110 Nm", transmission: "Super CVT-i w/ Sequential Shift", drivetrain: "FWD", seats: 5, groundClearance: "160 mm", dimensions: "4,425 × 1,740 × 1,480 mm · 475 L boot", safety: "6 SRS Airbags · Toyota Safety Sense (PCS, ACC, LKC, BSM, RCTA) · 360° Panoramic View", features: "9\" Floating Touchscreen · 7\" Digital Cluster · 64-Colour Ambient Lighting · Pioneer 6-Speaker Audio · nanoe™ X A/C", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-corolla-range-official", make: "Toyota", model: "Corolla", name: "Toyota Corolla", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.6L Petrol / 1.8L Hybrid · CVT", km: "15.5–23.8 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/vehicle-model/corolla/", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "121 HP (1.6L) / 122 HP (1.8L HEV)", torque: "154 Nm / 142 Nm + motor", transmission: "CVT / e-CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "135 mm", dimensions: "4,630 × 1,780 × 1,435 mm · 470 L boot", safety: "7 SRS Airbags · Toyota Safety Sense · Blind Spot Monitor · Rear Cross Traffic Alert · TNGA-C Platform", features: "9\" Multimedia Display w/ Wireless CarPlay · 12.3\" Digital Gauge Cluster · Dual-Zone Auto A/C · Rear Sunshade", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-camry-hybrid-range-official", make: "Toyota", model: "Camry Hybrid", name: "Toyota Camry Hybrid", body: "Passenger car", trim: null, year: null, market: null, fuel: "HEV", pt: "2.5L A25A-FXS 5th-Gen Hybrid · e-CVT", km: "24.0–25.0 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dailymirror.lk/breaking-news/Toyota-releases-new-price-list-with-lowest-price-starting-at-Rs-7-4-million/108-302123", sourceUrl: "https://www.toyota.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "230 HP (170 kW) combined", torque: "221 Nm + 202 Nm motor", transmission: "e-CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "145 mm", dimensions: "4,920 × 1,840 × 1,445 mm · 500 L boot", safety: "8 SRS Airbags · Toyota Safety Sense 3.0 · Panoramic View Monitor · Head-Up Display · Safe Exit Assist", features: "12.3\" Dual Displays · JBL 9-Speaker Audio · Power Reclining Rear VIP Seats · Tri-Zone Climate · Panoramic Sunroof", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "suzuki-s-presso-auto-range-official", make: "Suzuki", model: "S-Presso Auto", name: "Suzuki S-Presso Auto", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L K10C Dualjet Petrol · 5-speed AGS (AMT)", km: "25.3 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/suzuki-s-presso-2024", sourceUrl: "https://www.suzuki.lk/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "67 HP (49 kW)", torque: "89 Nm", transmission: "5-speed Auto Gear Shift (AGS)", drivetrain: "FWD", seats: 5, groundClearance: "180 mm", dimensions: "3,565 × 1,520 × 1,567 mm · 240 L boot", safety: "Dual Airbags · ESP · Hill Hold Assist · Rear Parking Sensors · HEARTECT Platform", features: "7\" SmartPlay Studio Touchscreen · Apple CarPlay & Android Auto · Digital Center Speedometer · Engine Idle Start-Stop", warranty: "3 yrs / 100,000 km (AMW Suzuki)"},
  {id: "suzuki-celerio-range-official", make: "Suzuki", model: "Celerio", name: "Suzuki Celerio", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L K10C Dualjet Petrol · 5-speed AGS (AMT)", km: "26.68 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.firstcar.lk/vehicles/suzuki-celerio", sourceUrl: "https://www.suzuki.lk/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "67 HP (49 kW)", torque: "89 Nm", transmission: "5-speed Auto Gear Shift (AGS)", drivetrain: "FWD", seats: 5, groundClearance: "170 mm", dimensions: "3,695 × 1,655 × 1,555 mm · 313 L boot", safety: "6 Airbags · ESP · Hill Hold Assist · ABS w/ EBD · Rear Parking Sensors", features: "7\" SmartPlay Studio · Push Start/Stop · Idle Start-Stop · 15\" Black Alloy Wheels · 60:40 Split Rear Seat", warranty: "3 yrs / 100,000 km (AMW Suzuki)"},
  {id: "suzuki-fronx-range-official", make: "Suzuki", model: "Fronx", name: "Suzuki Fronx", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L Turbo · Automatic", km: "20.01 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/suzuki-s-presso-2024", sourceUrl: "https://www.suzuki.lk/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "100 HP (73.6 kW)", torque: "147.6 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "190 mm", dimensions: "3,995 × 1,765 × 1,550 mm · 308 L boot", safety: "6 Airbags · 360° View Camera · Head-Up Display · ESP · Hill Hold Assist · ISOFIX", features: "9\" SmartPlay Pro+ HD · Wireless CarPlay & Android Auto · Wireless Charger · Arkamys Sound · 16\" Precision-Cut Alloys", warranty: "3 yrs / 100,000 km (AMW) or Importer Warranty"},
  {id: "suzuki-brezza-range-official", make: "Suzuki", model: "Brezza", name: "Suzuki Brezza", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L K15C Smart Hybrid Petrol · 6AT", km: "19.8 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/suzuki-s-presso-2024", sourceUrl: "https://www.suzuki.lk/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "103 HP (75.8 kW)", torque: "136.8 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "198 mm", dimensions: "3,995 × 1,790 × 1,685 mm · 328 L boot", safety: "6 Airbags · 360° View Camera · Head-Up Display · ESP · Hill Hold Assist", features: "Electric Sunroof · 9\" SmartPlay Pro+ · Wireless Charging Dock · Rear A/C Vents · Dual LED Projector Headlamps", warranty: "3 yrs / 100,000 km (AMW Suzuki)"},
  {id: "suzuki-jimny-range-official", make: "Suzuki", model: "Jimny", name: "Suzuki Jimny", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L K15B Petrol · 4AT ALLGRIP PRO 4WD", km: "16.4 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/suzuki-s-presso-2024", sourceUrl: "https://www.suzuki.lk/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "102 HP (75 kW)", torque: "130 Nm", transmission: "4-speed Automatic", drivetrain: "ALLGRIP PRO Part-Time 4WD w/ Low Range", seats: 4, groundClearance: "210 mm", dimensions: "3,985 × 1,645 × 1,720 mm (5-Door) · Ladder Frame", safety: "6 Airbags · Brake LSD Traction Control · Hill Hold & Hill Descent Control · ESP · Rear Camera", features: "9\" SmartPlay Pro+ w/ Wireless CarPlay · LED Projector Headlamps w/ Washers · Auto Climate Control · Cruise Control", warranty: "3 yrs / 100,000 km (AMW Suzuki)"},
  {id: "suzuki-dzire-range-official", make: "Suzuki", model: "Dzire", name: "Suzuki Dzire", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.2L Z12E 3-Cyl Petrol · 5-speed AGS (AMT)", km: "25.71 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/suzuki-s-presso-2024", sourceUrl: "https://www.suzuki.lk/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "82 HP (60 kW)", torque: "111.7 Nm", transmission: "5-speed Auto Gear Shift (AGS)", drivetrain: "FWD", seats: 5, groundClearance: "163 mm", dimensions: "3,995 × 1,735 × 1,525 mm · 382 L boot", safety: "6 Airbags Standard · 5-Star Global NCAP · 360° HD Camera · ESP · Hill Hold Assist · TPMS", features: "Electric Sunroof · 9\" SmartPlay Pro+ · Wireless Charger · Auto A/C w/ Rear Vents · Crystal Vision LED Headlamps", warranty: "3 yrs / 100,000 km (AMW Suzuki)"},
  {id: "suzuki-grand-vitara-range-official", make: "Suzuki", model: "Grand Vitara", name: "Suzuki Grand Vitara", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.5L K15C Smart Hybrid / Strong Hybrid · 6AT / e-CVT", km: "21.1–27.97 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.suzuki.lk/vehicles/", sourceUrl: "https://www.suzuki.lk/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "103 HP (MHEV) / 115 HP (HEV)", torque: "136.8 Nm / 141 Nm", transmission: "6AT / e-CVT Automatic", drivetrain: "FWD / ALLGRIP Select AWD", seats: 5, groundClearance: "210 mm", dimensions: "4,345 × 1,795 × 1,645 mm · 373 L boot", safety: "6 Airbags · 360° View Camera · TPMS · ESP · Hill Descent Control · All-Wheel Disc Brakes", features: "Panoramic Sunroof · 9\" SmartPlay Pro+ · Ventilated Front Seats · Head-Up Display · 7\" Digital Cluster · Wireless Charger", warranty: "3 yrs / 100,000 km (AMW Suzuki)"},
  {id: "suzuki-alto-k10-range-official", make: "Suzuki", model: "Alto K10", name: "Suzuki Alto K10", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L K10C Dualjet Petrol · 5-speed AGS (AMT)", km: "24.9 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.firstcar.lk/vehicles/suzuki-alto-k10", sourceUrl: "https://www.suzuki.lk/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "67 HP (49 kW)", torque: "89 Nm", transmission: "5-speed Auto Gear Shift (AGS)", drivetrain: "FWD", seats: 5, groundClearance: "167 mm", dimensions: "3,530 × 1,490 × 1,520 mm · 214 L boot", safety: "Dual Airbags · ABS w/ EBD · ESP · Rear Parking Sensors · HEARTECT Platform", features: "7\" SmartPlay Studio Touchscreen · Apple CarPlay & Android Auto · Digital Speedometer · Steering Audio Controls", warranty: "3 yrs / 100,000 km (AMW Suzuki)"},
  {id: "byd-atto-1-range-official", make: "BYD", model: "ATTO 1", name: "BYD ATTO 1", body: "Passenger car", trim: null, year: null, market: null, fuel: "BEV", pt: "55 kW Permanent Magnet Synchronous Motor · 30.08–38.88 kWh Blade Battery", km: "300–380 km NEDC · 30–80% DC in 30 min", w: "Official", cond: "New", price: 9300000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-atto-1-dynamic/", sourceUrl: "https://www.johnkeellscgauto.com/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "correction", priceScope: "Dynamic grade; range entry needs a named trim", priceVerifiedOn: "2026-10-21", power: "75 HP (55 kW)", torque: "135 Nm", transmission: "Single-speed EV Reduction Gear", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,780 × 1,715 × 1,580 mm · 230 L boot", safety: "6 Airbags · ESP · Electronic Parking Brake · Rear Camera & Sensors · Blade LFP Battery Safety", features: "10.1\" Rotating Touchscreen · Wireless Apple CarPlay & Android Auto · NFC Card Key · V2L Discharge · Wireless Charger", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-atto-2-range-official", make: "BYD", model: "ATTO 2", name: "BYD ATTO 2", body: "SUV", trim: null, year: null, market: null, fuel: "BEV", pt: "130 kW Electric Motor · 45.12 kWh Blade Battery (CTB)", km: "380 km NEDC / 312 km WLTP · DC Fast Charge", w: "Official", cond: "New", price: 13635000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-atto-2/", sourceUrl: "https://www.johnkeellscgauto.com/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "correction", priceScope: "ATTO 2 model", priceVerifiedOn: "2026-10-21", power: "174 HP (130 kW)", torque: "290 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 5, groundClearance: "165 mm", dimensions: "4,310 × 1,830 × 1,675 mm · 400 L boot", safety: "6 Airbags · 360° Panoramic Camera · ADAS Suite · Cell-to-Body (CTB) Structural Blade Battery", features: "12.8\" Rotating Infotainment · 8.8\" LCD Cluster · Panoramic Glass Roof · Vegan Leather Power Seats · V2L Power Output", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-dolphin-range-official", make: "BYD", model: "Dolphin", name: "BYD Dolphin", body: "Passenger car", trim: null, year: null, market: null, fuel: "BEV", pt: "70–150 kW Electric Motor · 44.9–60.48 kWh Blade Battery", km: "340–427 km WLTP (410–490 km NEDC)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://srilanka-promotions.com/motor-vehicles/sri-lanka-byd-vehicles-prices-as-of-20-april-2025-11564/", sourceUrl: "https://www.johnkeellscgauto.com/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "95 HP (Dynamic) / 204 HP (Premium)", torque: "180 Nm / 310 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 5, groundClearance: "130 mm", dimensions: "4,290 × 1,770 × 1,570 mm · 345 L boot", safety: "6 Airbags · 5-Star Euro NCAP · Adaptive Cruise · Lane Keep Assist · Blind Spot Detection · 360° Camera", features: "12.8\" Rotating Screen · Panoramic Glass Roof · V2L (Vehicle-to-Load) · NFC Key Card · Heat Pump Climate System", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-atto-3-range-official", make: "BYD", model: "ATTO 3", name: "BYD ATTO 3", body: "SUV", trim: null, year: null, market: null, fuel: "BEV", pt: "100–150 kW Electric Motor · 49.92–60.48 kWh Blade Battery", km: "345–420 km WLTP (410–480 km NEDC)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://srilanka-promotions.com/motor-vehicles/sri-lanka-byd-vehicles-prices-as-of-20-april-2025-11564/", sourceUrl: "https://www.johnkeellscgauto.com/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "136 HP (Advanced) / 204 HP (Extended)", torque: "310 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 5, groundClearance: "175 mm", dimensions: "4,455 × 1,875 × 1,615 mm · 440 L boot", safety: "7 Airbags · 5-Star Euro NCAP · Full Level 2 ADAS (ACC, AEB, LKA, BSD, RCTA) · 360° Holographic Camera", features: "15.6\" Rotating Screen · Panoramic Sunroof · Dirac 8-Speaker Audio · Electric Tailgate · Multi-Colour Rhythm Ambient Lighting", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-seal-range-official", make: "BYD", model: "Seal", name: "BYD Seal", body: "Passenger car", trim: null, year: null, market: null, fuel: "BEV", pt: "150–390 kW e-Platform 3.0 CTB · 61.4–82.5 kWh Blade Battery", km: "460–570 km WLTP · 0–100 km/h in 3.8–7.5 s", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://srilanka-promotions.com/motor-vehicles/sri-lanka-byd-vehicles-prices-as-of-20-april-2025-11564/", sourceUrl: "https://www.johnkeellscgauto.com/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "204 HP (Dynamic) / 313 HP (Premium) / 530 HP (AWD)", torque: "310 Nm / 360 Nm / 670 Nm", transmission: "Single-speed EV", drivetrain: "RWD / iTAC Dual-Motor AWD", seats: 5, groundClearance: "145 mm", dimensions: "4,800 × 1,875 × 1,460 mm · 400 L boot + 53 L frunk", safety: "9 Airbags · 5-Star Euro NCAP · Cell-to-Body (CTB) Chassis · Head-Up Display · Full ADAS · 360° Camera", features: "15.6\" Rotating Screen · 12-Speaker Dynaudio · Heated & Ventilated Nappa Leather Seats · Silver-Plated Panoramic Roof", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-sealion-5-premium-official", make: "BYD", model: "Sealion 5", name: "BYD Sealion 5 Premium", body: "SUV", trim: "Premium", year: null, market: null, fuel: "PHEV", pt: "1.5L DM-i Plug-in Hybrid · 18.3 kWh Blade Battery", km: "115 km pure EV · 1,050+ km combined", w: "Official", cond: "New", price: 20745000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-sealion-5-premium/", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-sealion-5-premium/", checkedOn: "2026-10-20", availability: "marketed", img: "assets/images/byd-sealion-5.jpg", custom: false, priceVerification: "correction", priceScope: "Premium grade", priceVerifiedOn: "2026-10-21", power: "215 HP combined", torque: "325 Nm", transmission: "E-CVT Dedicated Hybrid (EHS)", drivetrain: "FWD", seats: 5, groundClearance: "170 mm", dimensions: "4,738 × 1,860 × 1,710 mm · 407–1,430 L boot", safety: "6 Airbags · DiPilot ADAS (ACC, AEB, LKA, BSD) · 360° Panoramic Camera · V2L External Power", features: "15.6\" Rotating Touchscreen · Infinity Audio · Heated & Ventilated Front Seats · Wireless Charger · Full DiPilot ADAS · Power Tailgate", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-sealion-5-dynamic-official", make: "BYD", model: "Sealion 5", name: "BYD Sealion 5 Dynamic", body: "SUV", trim: "Dynamic", year: null, market: null, fuel: "PHEV", pt: "1.5L DM-i Plug-in Hybrid · 12.9 kWh Blade Battery", km: "75 km pure EV · 1,000+ km combined", w: "Official", cond: "New", price: 19477000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-sealion-5-dynamic/", sourceUrl: "https://www.johnkeellscgauto.com/wp-content/uploads/2025/10/Sealion-5-4Page-BYD-Brochure-5.pdf", checkedOn: "2026-10-20", availability: "marketed", img: "assets/images/byd-sealion-5.jpg", custom: false, priceVerification: "correction", priceScope: "Dynamic grade", priceVerifiedOn: "2026-10-21", power: "197 HP combined", torque: "300 Nm", transmission: "E-CVT Dedicated Hybrid (EHS)", drivetrain: "FWD", seats: 5, groundClearance: "170 mm", dimensions: "4,738 × 1,860 × 1,710 mm · 407–1,430 L boot", safety: "6 Airbags · DiPilot ADAS (ACC, AEB, LKA, BSD) · 360° Panoramic Camera · V2L External Power", features: "12.8\" Rotating Touchscreen · Panoramic Sunroof · 360° Camera · NFC Key · V2L External Power · 18\" Alloy Wheels", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-sealion-6-premium-awd-official", make: "BYD", model: "Sealion 6", name: "BYD Sealion 6 Premium AWD", body: "SUV", trim: "Premium AWD", year: null, market: null, fuel: "PHEV", pt: "1.5T DM-i Dual-Motor AWD · 18.3 kWh Blade Battery", km: "1,000+ km combined · 81 km pure EV", w: "Official", cond: "New", price: 27700000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-sealion-6-premium/", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-sealion-6-premium/", checkedOn: "2026-10-20", availability: "marketed", img: "assets/images/byd-sealion-6.jpg", custom: false, priceVerification: "correction", priceScope: "Premium grade", priceVerifiedOn: "2026-10-21", power: "319 HP (238 kW)", torque: "550 Nm · 0–100 km/h in 5.9 s", transmission: "E-CVT Dedicated Hybrid (EHS)", drivetrain: "Dual-Motor All-Wheel Drive (AWD)", seats: 5, groundClearance: "173 mm", dimensions: "4,775 × 1,890 × 1,670 mm · 425 L boot", safety: "7 Airbags · 5-Star Euro NCAP · Head-Up Display · Full DiPilot ADAS · 360° Camera", features: "Dual-Motor AWD + 1.5T Engine · Head-Up Display (W-HUD) · AWD Terrain Modes (Mud/Sand/Snow) · 15.6\" Rotating Screen · Infinity 10-Speaker Sound", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-sealion-6-superior-official", make: "BYD", model: "Sealion 6", name: "BYD Sealion 6 Superior", body: "SUV", trim: "Superior", year: null, market: null, fuel: "PHEV", pt: "1.5L DM-i Super Hybrid FWD · 18.3 kWh Blade Battery", km: "1,092 km NEDC · 92 km pure EV", w: "Official", cond: "New", price: 23850000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-sealion-6-superior/", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-sealion-6-superior/", checkedOn: "2026-10-20", availability: "marketed", img: "assets/images/byd-sealion-6.jpg", custom: false, priceVerification: "correction", priceScope: "Superior grade", priceVerifiedOn: "2026-10-21", power: "215 HP (160 kW)", torque: "300 Nm", transmission: "E-CVT Dedicated Hybrid (EHS)", drivetrain: "FWD", seats: 5, groundClearance: "173 mm", dimensions: "4,775 × 1,890 × 1,670 mm · 425 L boot", safety: "7 Airbags · 5-Star Euro NCAP · Head-Up Display · Full DiPilot ADAS · 360° Camera", features: "15.6\" Rotating Screen · Infinity 10-Speaker Audio · Panoramic Sunroof · Heated & Ventilated Seats · Dual 15W Wireless Chargers · 360° Camera", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-sealion-8-premium-official", make: "BYD", model: "Sealion 8", name: "BYD Sealion 8 Premium", body: "SUV", trim: "Premium", year: null, market: null, fuel: "PHEV", pt: "1.5T DM-p Dual-Motor AWD 7-Seater PHEV · Blade Battery", km: "1,040 km NEDC combined · 200 km pure EV", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/byd-sealion-6-2025", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-sealion-8-premium/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "482 HP combined", torque: "675 Nm · 0–100 km/h in 4.9 s", transmission: "E-CVT Dedicated Hybrid", drivetrain: "Dual-Motor AWD", seats: 7, groundClearance: "185 mm", dimensions: "4,975 × 1,960 × 1,745 mm · 7-Seater (up to 1,960 L cargo)", safety: "9 Airbags · DiSus-C Intelligent Damping · Full Level 2+ ADAS · 360° Camera · W-HUD", features: "482 HP Dual-Motor AWD · Nappa Leather Massage & Ventilated Seats · W-HUD · DiSus-C Intelligent Suspension · 12-Speaker Dynaudio", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "nissan-magnite-accenta-1-0-automatic-official", make: "Nissan", model: "Magnite", name: "Nissan Magnite Accenta 1.0 Automatic", body: "SUV", trim: "Accenta 1.0 Automatic", year: null, market: null, fuel: "Petrol", pt: "1.0L B4D Petrol (72 HP) · 5-speed EZ-Shift AMT", km: "19.7 km/L", w: "Official", cond: "New", price: 8190000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.nissanlk.com/nissan-magnite/", sourceUrl: "https://www.nissanlk.com/nissan-magnite/", checkedOn: "2026-10-20", availability: "marketed", img: "assets/images/nissan-magnite.jpg", custom: false, priceVerification: "confirmed", priceScope: "trim", priceVerifiedOn: "2026-10-21", power: "72 HP (53 kW)", torque: "96 Nm", transmission: "5-speed EZ-Shift AMT", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,994 × 1,758 × 1,572 mm · 336 L boot", safety: "6 Airbags Standard · 360° Around View Monitor (Tekna+) · VDC · Hill Start Assist · TPMS", features: "EZ-Shift Automated Manual · Auto Climate Control · Keyless Entry · Rear Parking Sensors · 6 Airbags + VDC", warranty: "3 yrs / 100,000 km (AMW Nissan Sri Lanka)"},
  {id: "nissan-magnite-tekna-1-0-automatic-official", make: "Nissan", model: "Magnite", name: "Nissan Magnite Tekna+ 1.0 Automatic", body: "SUV", trim: "Tekna+ 1.0 Automatic", year: null, market: null, fuel: "Petrol", pt: "1.0L B4D Petrol (72 HP) · 5-speed EZ-Shift AMT", km: "19.7 km/L", w: "Official", cond: "New", price: 9390000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.nissanlk.com/nissan-magnite/", sourceUrl: "https://www.nissanlk.com/nissan-magnite/", checkedOn: "2026-10-20", availability: "marketed", img: "assets/images/nissan-magnite.jpg", custom: false, priceVerification: "confirmed", priceScope: "trim", priceVerifiedOn: "2026-10-21", power: "72 HP (53 kW)", torque: "96 Nm", transmission: "5-speed EZ-Shift AMT", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,994 × 1,758 × 1,572 mm · 336 L boot", safety: "6 Airbags Standard · 360° Around View Monitor (Tekna+) · VDC · Hill Start Assist · TPMS", features: "360° Around View Monitor · 8\" Wireless CarPlay/Android Auto · 7\" TFT Cluster · Bi-Projector LED Headlamps · 16\" Diamond-Cut Alloys", warranty: "3 yrs / 100,000 km (AMW Nissan Sri Lanka)"},
  {id: "nissan-magnite-n-connecta-1-0-turbo-cvt-official", make: "Nissan", model: "Magnite", name: "Nissan Magnite N Connecta 1.0 Turbo CVT", body: "SUV", trim: "N Connecta 1.0 Turbo CVT", year: null, market: null, fuel: "Petrol", pt: "1.0L HRA0 Turbo Petrol (100 HP) · X-Tronic CVT", km: "17.4 km/L", w: "Official", cond: "New", price: 9990000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.nissanlk.com/nissan-magnite/", sourceUrl: "https://www.nissanlk.com/nissan-magnite/", checkedOn: "2026-10-20", availability: "marketed", img: "assets/images/nissan-magnite.jpg", custom: false, priceVerification: "confirmed", priceScope: "trim", priceVerifiedOn: "2026-10-21", power: "100 HP (74 kW)", torque: "152 Nm", transmission: "X-Tronic CVT", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,994 × 1,758 × 1,572 mm · 336 L boot", safety: "6 Airbags Standard · 360° Around View Monitor (Tekna+) · VDC · Hill Start Assist · TPMS", features: "100 HP Turbo + X-Tronic CVT · 8\" Wireless CarPlay/Android Auto · 7\" Digital Cluster · Smart Key & Push Start · Rear Camera · 16\" Alloys", warranty: "3 yrs / 100,000 km (AMW Nissan Sri Lanka)"},
  {id: "nissan-magnite-tekna-1-0-turbo-cvt-official", make: "Nissan", model: "Magnite", name: "Nissan Magnite Tekna+ 1.0 Turbo CVT", body: "SUV", trim: "Tekna+ 1.0 Turbo CVT", year: null, market: null, fuel: "Petrol", pt: "1.0L HRA0 Turbo Petrol (100 HP) · X-Tronic CVT", km: "17.4 km/L", w: "Official", cond: "New", price: null, priceBasis: "conflicting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.nissanlk.com/nissan-magnite/", sourceUrl: "https://www.nissanlk.com/nissan-magnite/", checkedOn: "2026-10-20", availability: "marketed", img: "assets/images/nissan-magnite.jpg", custom: false, priceVerification: "conflict", priceScope: "unverified", power: "100 HP (74 kW)", torque: "152 Nm", transmission: "X-Tronic CVT", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,994 × 1,758 × 1,572 mm · 336 L boot", safety: "6 Airbags Standard · 360° Around View Monitor (Tekna+) · VDC · Hill Start Assist · TPMS", features: "Flagship Tekna+ Turbo · 360° Around View Monitor · Cruise Control · Arkamys 3D Sound · Quilted Tan Leatherette Cabin · Plasma Cluster Ionizer", warranty: "3 yrs / 100,000 km (AMW Nissan Sri Lanka)"},
  {id: "nissan-almera-range-official", make: "Nissan", model: "Almera", name: "Nissan Almera", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L Turbo · Automatic", km: "23.3 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/nissan-magnite-2026", sourceUrl: "https://www.nissanlk.com/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "100 HP (74 kW)", torque: "152 Nm", transmission: "X-Tronic CVT w/ D-Step Logic", drivetrain: "FWD", seats: 5, groundClearance: "135 mm", dimensions: "4,495 × 1,740 × 1,460 mm · 482 L boot", safety: "6 Airbags · Nissan 360° Safety Shield (AEB, BSW, RCTA, High Beam Assist) · 360° Around View Monitor", features: "8\" NissanConnect Display · Wireless Charger · Bose 8-Speaker Personal Plus Audio · Quill-Pattern Leather Seats", warranty: "3 yrs / 100,000 km (AMW Nissan Sri Lanka)"},
  {id: "nissan-x-trail-e-4orce-range-official", make: "Nissan", model: "X-Trail e-4ORCE", name: "Nissan X-Trail e-4ORCE", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.5L VC-Turbo e-POWER Series Hybrid · Dual-Motor e-4ORCE AWD", km: "18.4 km/L (WLTC)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/nissan-magnite-2026", sourceUrl: "https://www.nissanlk.com/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "213 HP (157 kW) combined", torque: "330 Nm (front) + 195 Nm (rear)", transmission: "e-POWER 100% Electric Motor Drive", drivetrain: "e-4ORCE All-Wheel Drive", seats: 7, groundClearance: "195 mm", dimensions: "4,680 × 1,840 × 1,725 mm · 7-Seater / 575 L boot", safety: "7 Airbags · ProPILOT ADAS · 10.8\" Head-Up Display · Intelligent Around View Monitor · e-Pedal Step", features: "12.3\" Dual Screens · Bose 10-Speaker Audio · Panoramic Sunroof · Tri-Zone Climate · Quilted Nappa Leather", warranty: "3 yrs / 100,000 km (AMW Nissan Sri Lanka)"},
  {id: "kia-sportage-range-official", make: "Kia", model: "Sportage", name: "Kia Sportage", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.6L T-GDI Turbo Hybrid / Petrol · 6AT / 7DCT", km: "17.8 km/L (HEV)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/kia-sonet-2026", sourceUrl: "https://www.kia.lk/brand-new-cars-suvs/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "230 HP (HEV) / 180 HP (1.6T)", torque: "350 Nm (HEV) / 265 Nm (1.6T)", transmission: "6-speed Automatic (HEV) / 7DCT", drivetrain: "FWD / AWD", seats: 5, groundClearance: "170 mm", dimensions: "4,660 × 1,865 × 1,665 mm · 587 L boot", safety: "6 Airbags · Kia Drive Wise ADAS (FCA, LKA, BCA, SCC) · 360° Surround View Monitor · Blind-Spot View Monitor", features: "Dual 12.3\" Panoramic Curved Display · Harman Kardon Audio · Panoramic Sunroof · Ventilated Seats · Shift-by-Wire Dial", warranty: "3 yrs / 100,000 km (Kia Sri Lanka)"},
  {id: "kia-sorento-range-official", make: "Kia", model: "Sorento", name: "Kia Sorento", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.6L T-GDI Turbo Hybrid / 2.2L CRDi Diesel · 6AT / 8DCT", km: "15.3 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/kia-sonet-2026", sourceUrl: "https://www.kia.lk/brand-new-cars-suvs/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "230 HP (1.6T HEV) / 202 HP (2.2D)", torque: "350 Nm (HEV) / 440 Nm (Diesel)", transmission: "6AT / 8-speed Wet DCT", drivetrain: "AWD w/ Terrain Mode", seats: 7, groundClearance: "176 mm", dimensions: "4,815 × 1,900 × 1,700 mm · 7-Seater SUV", safety: "7 Airbags · Highway Driving Assist · Surround View Monitor · Blind-Spot View Monitor · Safe Exit Assist", features: "Dual 12.3\" Curved Display · Bose 12-Speaker Audio · Nappa Leather · Panoramic Sunroof · Fingerprint Recognition", warranty: "3 yrs / 100,000 km (Kia Sri Lanka)"},
  {id: "kia-picanto-range-official", make: "Kia", model: "Picanto", name: "Kia Picanto", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.2L DPI 4-Cyl Petrol · 4AT / 5AMT", km: "18.2 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/kia-sonet-2026", sourceUrl: "https://www.kia.lk/brand-new-cars-suvs/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "84 HP (62 kW)", torque: "120 Nm", transmission: "4-speed Automatic / 5AMT", drivetrain: "FWD", seats: 5, groundClearance: "141 mm", dimensions: "3,595 × 1,595 × 1,485 mm · 255 L boot", safety: "6 Airbags · Forward Collision-Avoidance Assist · Lane Keeping Assist · ESC · Rear Camera & Sensors", features: "8\" Floating Touchscreen · Wireless Apple CarPlay & Android Auto · 4.2\" Digital Cluster · LED Star-Map Lamps · Sunroof", warranty: "3 yrs / 100,000 km (Kia Sri Lanka)"},
  {id: "kia-sonet-range-official", make: "Kia", model: "Sonet", name: "Kia Sonet", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L T-GDI Petrol · 7DCT", km: "18.4 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/kia-sonet-2026", sourceUrl: "https://www.kia.lk/brand-new-cars-suvs/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "120 HP (88 kW)", torque: "172 Nm", transmission: "7-speed Dual-Clutch (7DCT) w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,995 × 1,790 × 1,642 mm · 385 L boot", safety: "6 Airbags Standard · Level 1 ADAS (10 features on GTX+/X-Line) · 360° Camera · Blind View Monitor · All-Wheel Disc Brakes", features: "Dual 10.25\" Screens · Bose 7-Speaker Audio · Ventilated Front Seats · Electric Sunroof · Smart Air Purifier", warranty: "3 yrs / 100,000 km (Official) or Importer Warranty"},
  {id: "kia-seltos-range-official", make: "Kia", model: "Seltos", name: "Kia Seltos", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L Petrol · IVT / 7DCT", km: "17.0–17.9 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/kia-sonet-2026", sourceUrl: "https://www.kia.lk/brand-new-cars-suvs/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "115 HP (1.5 NA) / 160 HP (1.5T)", torque: "144 Nm / 253 Nm", transmission: "IVT / 7-speed DCT", drivetrain: "FWD", seats: 5, groundClearance: "190 mm", dimensions: "4,365 × 1,800 × 1,645 mm · 433 L boot", safety: "6 Airbags · Level 2 ADAS (17 features) · 360° Surround Camera · 8\" Head-Up Display · Electronic Parking Brake", features: "Dual 10.25\" Panoramic Screens · Panoramic Sunroof · Bose 8-Speaker Audio · Ventilated Seats · Dual-Zone Climate", warranty: "3 yrs / 100,000 km (Kia Sri Lanka)"},
  {id: "kia-ev3-range-official", make: "Kia", model: "EV3", name: "Kia EV3", body: "SUV", trim: null, year: null, market: null, fuel: "BEV", pt: "150 kW Front Motor · 58.3–81.4 kWh E-GMP Battery", km: "436–605 km WLTP · 10–80% DC in 31 min", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/kia-ev3-2025", sourceUrl: "https://www.kia.lk/brand-new-cars-suvs/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "204 HP (150 kW)", torque: "283 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 5, groundClearance: "140 mm", dimensions: "4,300 × 1,850 × 1,560 mm · 460 L boot + 25 L frunk", safety: "7 Airbags · Highway Driving Assist 2 · Smart Regenerative Braking (i-Pedal 3.0) · 360° Surround View", features: "30\" Widescreen Display (12.3\" + 5.3\" + 12.3\") · Harman Kardon Audio · Sliding Console Table · V2L Inside & Out", warranty: "3 yrs / 100,000 km Vehicle · 8 yrs EV Battery (Kia Sri Lanka)"},
  {id: "kia-ev5-range-official", make: "Kia", model: "EV5", name: "Kia EV5", body: "SUV", trim: null, year: null, market: null, fuel: "BEV", pt: "160 kW (FWD) / 230 kW (AWD) · 64.2–88.1 kWh LFP Blade Battery", km: "400–555 km WLTP · 27 min Fast Charge", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/kia-sonet-2026", sourceUrl: "https://www.kia.lk/brand-new-cars-suvs/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "218 HP (FWD) / 313 HP (AWD)", torque: "310 Nm / 480 Nm", transmission: "Single-speed EV", drivetrain: "FWD / Dual-Motor AWD", seats: 5, groundClearance: "175 mm", dimensions: "4,615 × 1,875 × 1,715 mm · 513 L boot + 67 L frunk", safety: "7 Airbags · 5-Star ANCAP · Highway Driving Assist 2 · Remote Smart Parking Assist 2 · 360° Camera", features: "Triple Panoramic Display · Heated & Cooled Console Drawer (5°C–55°C) · Relaxation Massage Driver Seat · V2L", warranty: "3 yrs / 100,000 km Vehicle · 8 yrs EV Battery (Kia Sri Lanka)"},
  {id: "kia-ev9-range-official", make: "Kia", model: "EV9", name: "Kia EV9", body: "SUV", trim: null, year: null, market: null, fuel: "BEV", pt: "283 kW Dual-Motor AWD · 99.8 kWh 800V E-GMP Battery", km: "505 km WLTP · 10–80% Ultra-Fast DC in 24 min", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.kia.lk/brand-new-cars-suvs/", sourceUrl: "https://www.kia.lk/brand-new-cars-suvs/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "385 HP (283 kW)", torque: "700 Nm · 0–100 km/h in 5.3 s", transmission: "Single-speed EV", drivetrain: "Dual-Motor All-Wheel Drive", seats: 6, groundClearance: "177 mm", dimensions: "5,015 × 1,980 × 1,780 mm · Flagship 3-Row SUV", safety: "10 Airbags · 5-Star Euro NCAP · Full ADAS Suite · Digital Side Mirrors · 360° Surround View", features: "Swiveling/Relaxation 2nd-Row Captain Chairs · Meridian 14-Speaker Audio · Dual Sunroofs · Triple Panoramic Screen", warranty: "3 yrs / 100,000 km Vehicle · 8 yrs EV Battery (Kia Sri Lanka)"},
  {id: "hyundai-grand-i10-range-official", make: "Hyundai", model: "Grand i10", name: "Hyundai Grand i10", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.2L Kappa Petrol · 4AT / AMT", km: "18.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/byd-atto-1-2025", sourceUrl: "https://hyundaisrilanka.lk/vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "83 HP (61 kW)", torque: "113.8 Nm", transmission: "4-speed Automatic / Smart Auto AMT", drivetrain: "FWD", seats: 5, groundClearance: "165 mm", dimensions: "3,815 × 1,680 × 1,520 mm · 260 L boot", safety: "6 Airbags Standard · ESC · Hill-Start Assist · TPMS · Rear Camera & Sensors", features: "8\" Touchscreen w/ Apple CarPlay & Android Auto · Wireless Phone Charger · Cruise Control · Rear A/C Vents · Push Button Start", warranty: "3 yrs / 100,000 km (Hyundai Lanka)"},
  {id: "hyundai-accent-range-official", make: "Hyundai", model: "Accent", name: "Hyundai Accent", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L Smartstream Petrol · IVT", km: "18.6–20.6 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/hyundai-tucson-2025", sourceUrl: "https://hyundaisrilanka.lk/vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "115 HP (1.5 NA) / 160 HP (1.5T)", torque: "144 Nm / 253 Nm", transmission: "Smartstream IVT / 7DCT", drivetrain: "FWD", seats: 5, groundClearance: "165 mm", dimensions: "4,535 × 1,765 × 1,475 mm · 528 L boot", safety: "6 Airbags · 5-Star Global NCAP · Hyundai SmartSense Level 2 ADAS · All-Wheel Disc Brakes", features: "10.25\" Integrated Screen · Bose 8-Speaker Audio · Heated & Ventilated Front Seats · Electric Sunroof · Horizon LED Bar", warranty: "3 yrs / 100,000 km (Hyundai Lanka)"},
  {id: "hyundai-creta-range-official", make: "Hyundai", model: "Creta", name: "Hyundai Creta", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L Smartstream MPi Petrol · IVT Automatic", km: "17.7 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/hyundai-tucson-2025", sourceUrl: "https://hyundaisrilanka.lk/vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "115 HP (84.4 kW)", torque: "143.8 Nm", transmission: "Intelligent Variable Transmission (IVT)", drivetrain: "FWD", seats: 5, groundClearance: "190 mm", dimensions: "4,330 × 1,790 × 1,635 mm · 433 L boot", safety: "6 Airbags · Hyundai SmartSense Level 2 ADAS (19 features) · 360° Surround View · Blind-Spot View Monitor", features: "Dual 10.25\" Curvilinear Screens · Voice-Enabled Panoramic Sunroof · Bose 8-Speaker Audio · Ventilated Seats · Dual-Zone A/C", warranty: "3 yrs / 100,000 km (Hyundai Lanka)"},
  {id: "hyundai-tucson-range-official", make: "Hyundai", model: "Tucson", name: "Hyundai Tucson", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.6L T-GDI Petrol · 7DCT AWD", km: "14.5–18.0 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/hyundai-tucson-2025", sourceUrl: "https://hyundaisrilanka.lk/vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "180 HP (1.6T) / 230 HP (1.6T HEV)", torque: "265 Nm / 350 Nm", transmission: "7-speed DCT / 6AT", drivetrain: "HTRAC All-Wheel Drive", seats: 5, groundClearance: "181 mm", dimensions: "4,640 × 1,865 × 1,665 mm · 540–620 L boot", safety: "7 Airbags · 5-Star Euro NCAP · Hyundai SmartSense ADAS · 360° Surround View · Blind-Spot View Monitor", features: "Dual 12.3\" Panoramic Curved Display · Krell/Bose Premium Audio · Panoramic Sunroof · Ventilated Leather Seats · Power Tailgate", warranty: "3 yrs / 100,000 km (Hyundai Lanka)"},
  {id: "hyundai-santa-fe-range-official", make: "Hyundai", model: "Santa Fe", name: "Hyundai Santa Fe", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.6L Turbo Hybrid · 6AT AWD", km: "14.5 km/L (HEV)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/hyundai-tucson-2025", sourceUrl: "https://hyundaisrilanka.lk/vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "235 HP (1.6T HEV) / 281 HP (2.5T)", torque: "367 Nm / 422 Nm", transmission: "6-speed Automatic / 8DCT", drivetrain: "HTRAC All-Wheel Drive", seats: 7, groundClearance: "177 mm", dimensions: "4,830 × 1,900 × 1,770 mm · Boxy 7-Seater SUV (725 L boot)", safety: "10 Airbags · Highway Driving Assist 2 · Remote Smart Parking Assist · Digital Center Mirror · 360° Camera", features: "Dual 12.3\" Curved Screen · Dual Wireless Chargers · UV-C Sanitizer Tray · Relaxation Comfort Seats · Dual Sunroof", warranty: "3 yrs / 100,000 km (Hyundai Lanka)"},
  {id: "hyundai-palisade-range-official", make: "Hyundai", model: "Palisade", name: "Hyundai Palisade", body: "SUV", trim: null, year: null, market: null, fuel: "Diesel", pt: "2.2L Turbo Diesel · 8AT HTRAC AWD", km: "12.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://hyundaisrilanka.lk/vehicle/palisade", sourceUrl: "https://hyundaisrilanka.lk/vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "200 HP (147 kW)", torque: "440 Nm", transmission: "8-speed Automatic w/ Shift-by-Wire", drivetrain: "HTRAC AWD w/ Multi-Terrain Control", seats: 7, groundClearance: "203 mm", dimensions: "4,995 × 1,975 × 1,750 mm · Flagship 3-Row SUV", safety: "9 Airbags · Hyundai SmartSense ADAS · 360° Surround View · Blind-Spot View Monitor · Head-Up Display", features: "2nd-Row Ventilated Captain Chairs · Infinity 12-Speaker Audio · Dual Sunroofs · Nappa Leather · 3-Zone Independent Climate", warranty: "3 yrs / 100,000 km (Hyundai Lanka)"},
  {id: "hyundai-ioniq-5-range-official", make: "Hyundai", model: "Ioniq 5", name: "Hyundai Ioniq 5", body: "SUV", trim: null, year: null, market: null, fuel: "BEV", pt: "125–239 kW 800V E-GMP · 58–84 kWh Battery", km: "384–507 km WLTP · 10–80% DC in 18 min", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/hyundai-ioniq-5-ev-2025", sourceUrl: "https://hyundaisrilanka.lk/vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "170–325 HP", torque: "350–605 Nm", transmission: "Single-speed EV", drivetrain: "RWD / HTRAC Dual-Motor AWD", seats: 5, groundClearance: "160 mm", dimensions: "4,635 × 1,890 × 1,605 mm · 3,000 mm wheelbase · 527 L boot", safety: "7 Airbags · 5-Star Euro NCAP · Highway Driving Assist 2 · AR Head-Up Display · 360° Camera", features: "Zero-Gravity Relaxation Seats · Sliding Universal Island Console · Dual 12.3\" Screens · Bose 8-Speaker · 3.6 kW V2L", warranty: "3 yrs / 100,000 km Vehicle · 8 yrs / 160,000 km EV Battery (Hyundai Lanka)"},
  {id: "hyundai-ioniq-9-range-official", make: "Hyundai", model: "Ioniq 9", name: "Hyundai Ioniq 9", body: "SUV", trim: null, year: null, market: null, fuel: "BEV", pt: "160–320 kW 800V E-GMP · 110.3 kWh Long-Range Battery", km: "up to 620 km WLTP · 10–80% in 24 min (350 kW)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://hyundaisrilanka.lk/vehicles", sourceUrl: "https://hyundaisrilanka.lk/vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "218–435 HP", torque: "350–700 Nm", transmission: "Single-speed EV", drivetrain: "RWD / HTRAC Dual-Motor AWD", seats: 7, groundClearance: "174 mm", dimensions: "5,060 × 1,980 × 1,790 mm · 3,130 mm wheelbase · 3-Row EV SUV", safety: "10 Airbags · Full Hyundai SmartSense ADAS · Digital Side Mirrors · Active Road Noise Control", features: "Swiveling 2nd-Row Lounge Seats · Bose 14-Speaker Sound · Panoramic Curved Display · 100W USB-C in All 3 Rows · V2L", warranty: "3 yrs / 100,000 km Vehicle · 8 yrs EV Battery (Hyundai Lanka)"},
  {id: "gwm-haval-h6-range-official", make: "GWM", model: "Haval H6", name: "GWM Haval H6", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.5L Turbo Hybrid / Plug-in Hybrid", km: "19.2 km/L (HEV) / 1,000+ km combined (PHEV)", w: "Official", cond: "New", price: 19995000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.gwmsrilanka.lk/vehicles/haval-h6", sourceUrl: "https://www.gwmsrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "240 HP (HEV) / 326 HP (PHEV)", torque: "530 Nm", transmission: "2-speed Dedicated Hybrid (DHT)", drivetrain: "FWD", seats: 5, groundClearance: "175 mm", dimensions: "4,683 × 1,886 × 1,730 mm · 600 L boot", safety: "6 Airbags · 5-Star ANCAP · 360° Camera w/ Transparent Chassis · Full Level 2 ADAS · Auto Reversing Assistance", features: "14.6\" Infotainment Screen · 10.25\" Digital Cluster · Head-Up Display · Panoramic Sunroof · Ventilated Comfort-Tek Seats · 9-Speaker Audio", warranty: "5 yrs / 150,000 km (GWM Sri Lanka)"},
  {id: "gwm-haval-h6-gt-range-official", make: "GWM", model: "Haval H6 GT", name: "GWM Haval H6 GT PHEV", body: "SUV", trim: "PHEV", year: null, market: null, fuel: "PHEV", pt: "1.5L Turbo Hi4 Plug-in Hybrid · 35.4 kWh Battery", km: "180 km pure EV · 1,000+ km combined", w: "Official", cond: "New", price: 25995000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.gwmsrilanka.lk/vehicles/haval-h6-gt", sourceUrl: "https://www.gwmsrilanka.lk/vehicles/haval-h6-gt", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "321–436 HP combined", torque: "530–762 Nm · 0–100 km/h in 4.9 s", transmission: "Dedicated Hybrid Transmission (DHT)", drivetrain: "AWD / FWD", seats: 5, groundClearance: "170 mm", dimensions: "4,727 × 1,940 × 1,729 mm · Coupe SUV", safety: "6 Airbags · 5-Star ANCAP · 360° HD Camera · Full Level 2 ADAS · Brembo Front Brakes · Launch Control", features: "Aero Coupe Styling · Heated & Ventilated Alcantara/Leather Sport Seats · Panoramic Sunroof · Head-Up Display · Hands-Free Tailgate", warranty: "5 yrs / 150,000 km Vehicle · 8 yrs Battery (GWM Sri Lanka)"},
  {id: "gwm-tank-300-range-official", make: "GWM", model: "Tank 300", name: "GWM Tank 300", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "2.0L Turbo Hybrid · 9HAT 4WD", km: "10.5–11.9 km/L", w: "Official", cond: "New", price: 33995000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.gwmsrilanka.lk/vehicles/tank-300", sourceUrl: "https://www.gwmsrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "342 HP (255 kW) combined", torque: "648 Nm", transmission: "9-speed Hydraulic Automatic (9HAT)", drivetrain: "Intelligent 4WD w/ Front & Rear Diff Locks + Tank Turn", seats: 5, groundClearance: "224 mm · 700 mm wading", dimensions: "4,760 × 1,930 × 1,903 mm · Ladder-Frame Off-Roader", safety: "6 Airbags · 5-Star ANCAP · 360° View w/ Transparent Chassis · Crawl Control · Full ADAS Suite", features: "Dual 12.3\" Screens · Nappa Leather Massage Seats · Infinity 9-Speaker Audio · 64-Colour Ambient Lighting · Sunroof", warranty: "5 yrs / 150,000 km (GWM Sri Lanka)"},
  {id: "gwm-tank-500-range-official", make: "GWM", model: "Tank 500", name: "GWM Tank 500", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "2.0L Turbo Hybrid · 9HAT 4WD", km: "10.0–11.8 km/L", w: "Official", cond: "New", price: 43500000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.gwmsrilanka.lk/vehicles/tank-500", sourceUrl: "https://www.gwmsrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "342 HP (255 kW) combined", torque: "648 Nm", transmission: "9-speed Hydraulic Automatic (9HAT)", drivetrain: "Intelligent 4WD w/ 11 All-Terrain Modes & Diff Locks", seats: 7, groundClearance: "224 mm · 800 mm wading", dimensions: "5,078 × 1,934 × 1,905 mm · Luxury 7-Seater Off-Road SUV", safety: "6 Airbags · 5-Star ANCAP · 360° Panoramic Camera · Head-Up Display · Auto Parking & Reversing Memory", features: "14.6\" Central Touchscreen · 12.3\" Cluster · Nappa Leather Heated/Ventilated/Massage Seats · Power Side Steps · Infinity 12-Speaker Audio", warranty: "5 yrs / 150,000 km (GWM Sri Lanka)"},
  {id: "gwm-haval-jolion-range-official", make: "GWM", model: "Haval Jolion", name: "GWM Haval Jolion", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L Turbo Petrol · 7 DCT", km: "13.5–20.0 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://gwm.lk/gwm-haval-jolion/index.html", sourceUrl: "https://gwm.lk/gwm-haval-jolion/index.html", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "147 HP (1.5T) / 188 HP (HEV)", torque: "220 Nm (1.5T) / 375 Nm (HEV)", transmission: "7-speed Wet DCT / DHT", drivetrain: "FWD", seats: 5, groundClearance: "168 mm", dimensions: "4,472 × 1,841 × 1,619 mm · 430 L boot", safety: "6 Airbags · 5-Star ANCAP · 360° Surround Camera · Adaptive Cruise · Lane Centering · Blind Spot Detection", features: "12.3\" Touchscreen · Head-Up Display · Panoramic Sunroof · Rotary Shift Dial · Wireless Charger · Heated/Ventilated Seats", warranty: "5 yrs / 150,000 km (GWM Sri Lanka)"},
  {id: "chery-tiggo-4-pro-range-official", make: "Chery", model: "Tiggo 4 Pro", name: "Chery Tiggo 4 Pro", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L / 1.5T Petrol · 9-speed Simulated CVT", km: "14.8 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/cherry-tiggo-4-pro-2025", sourceUrl: "https://www.cherysrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "113 HP (1.5L) / 145 HP (1.5T)", torque: "138 Nm / 210 Nm", transmission: "CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "180 mm", dimensions: "4,318 × 1,831 × 1,662 mm · 340–1,100 L boot", safety: "6 Airbags · 360° HD Camera · ESP · Hill Descent Control · TPMS · ADAS (Turbo)", features: "Dual 10.25\" Integrated Screens · Wireless Apple CarPlay & Android Auto · Electric Sunroof · Power Driver Seat · Voice Control", warranty: "5 yrs / 150,000 km (Chery Sri Lanka)"},
  {id: "chery-tiggo-cross-hybrid-range-official", make: "Chery", model: "Tiggo Cross Hybrid", name: "Chery Tiggo Cross Hybrid", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.5L Dedicated Hybrid (HEV) · DHT", km: "21.3 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/cherry-tiggo-4-pro-2025", sourceUrl: "https://www.cherysrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "201 HP combined", torque: "310 Nm", transmission: "Dedicated Hybrid Transmission (DHT)", drivetrain: "FWD", seats: 5, groundClearance: "175 mm", dimensions: "4,320 × 1,831 × 1,652 mm · Compact Hybrid SUV", safety: "6 Airbags · Level 2 ADAS (15 functions) · 540° Panoramic Camera · Blind Spot Detection · RCTA", features: "Dual 10.25\" Widescreen · Electric Sunroof · Wireless Charger · Sony 6-Speaker Audio · Ambient Lighting", warranty: "5 yrs / 150,000 km (Chery Sri Lanka)"},
  {id: "chery-tiggo-9-phev-range-official", make: "Chery", model: "Tiggo 9 PHEV", name: "Chery Tiggo 9 PHEV", body: "SUV", trim: null, year: null, market: null, fuel: "PHEV", pt: "1.5T C-DM Super Plug-in Hybrid · 3-speed DHT · 19.4–34.4 kWh Battery", km: "1,400+ km combined · 100–160 km pure EV", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/chery-tiggo-9-phev-2026", sourceUrl: "https://www.cherysrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "375–610 HP combined", torque: "610–920 Nm", transmission: "3-speed Dedicated Hybrid (DHT)", drivetrain: "FWD / AWD", seats: 7, groundClearance: "190 mm", dimensions: "4,820 × 1,930 × 1,710 mm · Flagship 7-Seater SUV", safety: "10 Airbags · CDC Magnetic Suspension · Level 2.5 ADAS · 540° Camera · AR Head-Up Display", features: "15.6\" 2.5K Screen (Snapdragon 8155) · Sony 14-Speaker Headrest Audio · Zero-Gravity Massage Seats · Panoramic Sunroof", warranty: "5 yrs / 150,000 km (Chery Sri Lanka)"},
  {id: "tata-punch-range-official", make: "Tata", model: "Punch", name: "Tata Punch", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.2L Petrol · AMT / EV", km: "18.8 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://ackodrive.com/news/tata-motors-launches-curvv-punch-nexon-tiago-ev-in-sri-lanka/", sourceUrl: "https://cars.tatamotors.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "88 HP (65 kW)", torque: "115 Nm", transmission: "5-speed Automated Manual (AMT)", drivetrain: "FWD", seats: 5, groundClearance: "187 mm", dimensions: "3,827 × 1,742 × 1,615 mm · 366 L boot", safety: "Dual Airbags · 5-Star Global NCAP · ESP · Traction Pro Mode · Rear Camera · Rain-Sensing Wipers", features: "10.25\" Harman Touchscreen · Wireless Apple CarPlay & Android Auto · Electric Sunroof · Wireless Charger · 90° Opening Doors", warranty: "3 yrs / 100,000 km (DIMO / Tata Motors Sri Lanka)"},
  {id: "tata-nexon-range-official", make: "Tata", model: "Nexon", name: "Tata Nexon", body: "SUV", trim: null, year: null, market: null, fuel: "BEV", pt: "1.2L Turbo DCA / 45 kWh EV", km: "17.18 km/L", w: "Official", cond: "New", price: null, priceBasis: "conflicting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://srilanka-promotions.com/motor-vehicles/tata-motors-tata-curvv-ice-tata-curvv-ev-and-tata-nexon-ev-sri-lanka-price-features-as-of-28-sep-2025-12179/", sourceUrl: "https://cars.tatamotors.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "specification-mismatch", priceScope: "unverified", power: "120 HP (88.2 kW)", torque: "170 Nm", transmission: "7-speed Dual-Clutch Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "208 mm", dimensions: "3,995 × 1,804 × 1,620 mm · 382 L boot", safety: "6 Airbags Standard · 5-Star Global & Bharat NCAP · 360° Surround View · Blind View Monitor · ESP", features: "Dual 10.25\" Screens · JBL 9-Speaker Audio · Ventilated Leatherette Seats · Voice-Assisted Panoramic Sunroof · Air Purifier", warranty: "3 yrs / 100,000 km (DIMO / Tata Motors Sri Lanka)"},
  {id: "tata-curvv-range-official", make: "Tata", model: "Curvv", name: "Tata Curvv", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.2L Turbo Petrol · DCA", km: "18.0 km/L or 502–585 km ARAI (Curvv.ev)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://srilanka-promotions.com/motor-vehicles/tata-motors-tata-curvv-ice-tata-curvv-ev-and-tata-nexon-ev-sri-lanka-price-features-as-of-28-sep-2025-12179/", sourceUrl: "https://cars.tatamotors.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "historical", priceScope: "unverified", power: "125 HP (1.2T) / 150–167 HP (EV)", torque: "225 Nm / 215 Nm", transmission: "7-speed DCA / Single-speed EV", drivetrain: "FWD", seats: 5, groundClearance: "190–208 mm", dimensions: "4,308 × 1,810 × 1,630 mm · 500 L boot · SUV Coupe", safety: "6 Airbags · 5-Star Bharat NCAP · Level 2 ADAS (20 features) · 360° 3D Surround View · EPB w/ Auto Hold", features: "12.3\" Harman Cinemascope Display · Gesture-Controlled Power Tailgate · Panoramic Sunroof · Ventilated Seats · Flush Door Handles", warranty: "3 yrs / 100,000 km (DIMO / Tata Motors Sri Lanka)"},
  {id: "tata-tiago-ev-range-official", make: "Tata", model: "Tiago.ev", name: "Tata Tiago.ev", body: "Passenger car", trim: null, year: null, market: null, fuel: "BEV", pt: "45–55 kW Ziptron Permanent Magnet Motor · 19.2–24 kWh IP67 Battery", km: "250–315 km MIDC · 10–80% DC in 58 min", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://synergyy.com/2025/02/exploring-the-brand-new-tata-passenger-vehicle-range-in-sri-lanka-models-prices-and-key-features-feb-2025-34559/", sourceUrl: "https://cars.tatamotors.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "61–75 HP", torque: "110–114 Nm", transmission: "Single-speed EV w/ Sport Mode", drivetrain: "FWD", seats: 5, groundClearance: "166 mm", dimensions: "3,769 × 1,677 × 1,536 mm · 240 L boot", safety: "Dual Airbags · 4-Star Global NCAP · IP67 Water/Dust-Proof Battery · Multi-Mode Regen (4 levels) · TPMS", features: "7\" Harman Touchscreen w/ CarPlay & Android Auto · 8-Speaker Sound · Auto Climate Control · Cruise Control · ZConnect Telematics", warranty: "3 yrs / 125,000 km Vehicle · 8 yrs / 160,000 km Battery (Tata Sri Lanka)"},
  {id: "renault-kwid-range-official", make: "Renault", model: "Kwid", name: "Renault Kwid Evolution MT", body: "Passenger car", trim: "Evolution MT", year: null, market: null, fuel: "Petrol", pt: "1.0L SCe Petrol · 5-speed Manual", km: "21.7–22.3 km/L", w: "Official", cond: "New", price: 6690000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/", sourceUrl: "https://www.renault.lk/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "correction", priceScope: "Evolution MT", priceVerifiedOn: "2026-10-21", power: "68 HP (50 kW)", torque: "91 Nm", transmission: "5-speed Manual (MT)", drivetrain: "FWD", seats: 5, groundClearance: "184 mm", dimensions: "3,731 × 1,579 × 1,490 mm · 279 L boot", safety: "Dual Airbags · Electronic Stability Program (ESP) · Hill Start Assist · Traction Control · TPMS · Rear Camera", features: "8\" MediaNAV Touchscreen · Apple CarPlay & Android Auto · Digital Cluster · Front & Rear Power Windows · LED DRLs", warranty: "3 yrs / 100,000 km Bumper-to-Bumper (AMW Renault Sri Lanka)"},
  {id: "renault-kiger-range-official", make: "Renault", model: "Kiger", name: "Renault Kiger Evolution AMT", body: "SUV", trim: "Evolution AMT", year: null, market: null, fuel: "Petrol", pt: "1.0L Energy Petrol (72 HP) · 5-speed Easy-R AMT", km: "19.0 km/L", w: "Official", cond: "New", price: 8190000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/", sourceUrl: "https://www.renault.lk/vehicles/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "correction", priceScope: "Evolution AMT", priceVerifiedOn: "2026-10-21", power: "72 HP (53 kW)", torque: "96 Nm", transmission: "5-speed Easy-R AMT", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,991 × 1,750 × 1,605 mm · 405 L boot", safety: "4 Airbags · 4-Star Global NCAP · ESP · Hill Start Assist · Traction Control · TPMS · Rear View Camera", features: "8\" Floating Touchscreen · LED DRLs · Rear A/C Vents · Digital Instrument Cluster · 4 Airbags + ESP", warranty: "3 yrs / 100,000 km Bumper-to-Bumper (AMW Renault Sri Lanka)"},
  {id: "perodua-axia-g-official", make: "Perodua", model: "Axia", name: "Perodua Axia G", body: "Passenger car", trim: "G", year: null, market: null, fuel: "Petrol", pt: "1.0L VVT-i · D-CVT", km: "23.2–27.4 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://synergyy.com/2025/02/unveiling-the-2025-perodua-models-price-and-availability-in-sri-lanka-34539/", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "67 HP (50 kW)", torque: "91 Nm", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "150 mm", dimensions: "3,760 × 1,665 × 1,505 mm · 265 L boot · DNGA Platform", safety: "2–6 Airbags · VSC · Traction Control · Hill-Start Assist · Perodua Smart Drive Assist (SE)", features: "7\" TFT Digital Meter (SE) · 9\" Display Audio · Power Mode Drive Switch · Keyless Entry & Push Start · LED Headlamps", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "perodua-axia-x-official", make: "Perodua", model: "Axia", name: "Perodua Axia X", body: "Passenger car", trim: "X", year: null, market: null, fuel: "Petrol", pt: "1.0L VVT-i · D-CVT", km: "23.2–27.4 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/perodua-ativa-2025", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "67 HP (50 kW)", torque: "91 Nm", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "150 mm", dimensions: "3,760 × 1,665 × 1,505 mm · 265 L boot · DNGA Platform", safety: "2–6 Airbags · VSC · Traction Control · Hill-Start Assist · Perodua Smart Drive Assist (SE)", features: "7\" TFT Digital Meter (SE) · 9\" Display Audio · Power Mode Drive Switch · Keyless Entry & Push Start · LED Headlamps", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "perodua-axia-se-official", make: "Perodua", model: "Axia", name: "Perodua Axia SE", body: "Passenger car", trim: "SE", year: null, market: null, fuel: "Petrol", pt: "1.0L VVT-i · D-CVT", km: "23.2–27.4 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://synergyy.com/2025/02/unveiling-the-2025-perodua-models-price-and-availability-in-sri-lanka-34539/", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "67 HP (50 kW)", torque: "91 Nm", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "150 mm", dimensions: "3,760 × 1,665 × 1,505 mm · 265 L boot · DNGA Platform", safety: "2–6 Airbags · VSC · Traction Control · Hill-Start Assist · Perodua Smart Drive Assist (SE)", features: "7\" TFT Digital Meter (SE) · 9\" Display Audio · Power Mode Drive Switch · Keyless Entry & Push Start · LED Headlamps", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "perodua-bezza-g-official", make: "Perodua", model: "Bezza", name: "Perodua Bezza G", body: "Passenger car", trim: "G", year: null, market: null, fuel: "Petrol", pt: "1.0L 1KR-VE VVT-i Petrol · 4-speed E-AT", km: "21.3 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://synergyy.com/2025/02/unveiling-the-2025-perodua-models-price-and-availability-in-sri-lanka-34539/", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "67 HP (50 kW)", torque: "91 Nm", transmission: "4-speed Electronic Automatic", drivetrain: "FWD", seats: 5, groundClearance: "150 mm", dimensions: "4,170 × 1,620 × 1,525 mm · Huge 508 L boot", safety: "Dual SRS Airbags · VSC & Traction Control (X Grade) · ABS w/ EBD · Front & Rear Corner Sensors", features: "Smart Entry & Push Start (X Grade) · LED Headlamps · 15\" Two-Tone Alloys · USB Rear Charging · 60:40 Fold Rear Seats", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "perodua-bezza-x-official", make: "Perodua", model: "Bezza", name: "Perodua Bezza X", body: "Passenger car", trim: "X", year: null, market: null, fuel: "Petrol", pt: "1.3L Dual VVT-i · 4AT", km: "21.3 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/perodua-ativa-2025", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "67 HP (50 kW)", torque: "91 Nm", transmission: "4-speed Electronic Automatic", drivetrain: "FWD", seats: 5, groundClearance: "150 mm", dimensions: "4,170 × 1,620 × 1,525 mm · Huge 508 L boot", safety: "Dual SRS Airbags · VSC & Traction Control (X Grade) · ABS w/ EBD · Front & Rear Corner Sensors", features: "Smart Entry & Push Start (X Grade) · LED Headlamps · 15\" Two-Tone Alloys · USB Rear Charging · 60:40 Fold Rear Seats", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "perodua-myvi-g-official", make: "Perodua", model: "Myvi", name: "Perodua Myvi G", body: "Passenger car", trim: "G", year: null, market: null, fuel: "Petrol", pt: "1.3L Dual VVT-i · D-CVT", km: "21.1–22.2 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/perodua-ativa-2025", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "94 HP (G) / 102 HP (H)", torque: "121 Nm (G) / 137 Nm (H)", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "160 mm", dimensions: "3,895 × 1,735 × 1,515 mm · 277 L boot", safety: "4–6 Airbags · 5-Star ASEAN NCAP · Perodua Smart Drive Assist (ASA 3.0, ACC, LKC on H Grade) · VSC", features: "LED Headlamps · Digital A/C · Smart Entry & Push Start · 8-Config Flexible Seating · Built-in Toll/Dashcam Port", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "perodua-myvi-h-official", make: "Perodua", model: "Myvi", name: "Perodua Myvi H", body: "Passenger car", trim: "H", year: null, market: null, fuel: "Petrol", pt: "1.5L Dual VVT-i · D-CVT", km: "21.1–22.2 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/perodua-ativa-2025", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "94 HP (G) / 102 HP (H)", torque: "121 Nm (G) / 137 Nm (H)", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "160 mm", dimensions: "3,895 × 1,735 × 1,515 mm · 277 L boot", safety: "4–6 Airbags · 5-Star ASEAN NCAP · Perodua Smart Drive Assist (ASA 3.0, ACC, LKC on H Grade) · VSC", features: "LED Headlamps · Digital A/C · Smart Entry & Push Start · 8-Config Flexible Seating · Built-in Toll/Dashcam Port", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "perodua-ativa-range-official", make: "Perodua", model: "Ativa", name: "Perodua Ativa", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L Turbo · D-CVT", km: "18.9 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/perodua-ativa-2025", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "98 HP (72 kW)", torque: "140 Nm", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "200 mm", dimensions: "4,065 × 1,710 × 1,635 mm · 369 L dual-level boot", safety: "6 Airbags · 5-Star ASEAN NCAP · ASA 3.0 (AEB, Adaptive Cruise, Lane Keep, BSM, RCTA) · Adaptive Driving Beam", features: "9\" Touch Infotainment · 7\" TFT Multi-Info Display · Sequential LED Headlamps · 17\" Alloys · PWR Steering Button", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "perodua-aruz-range-official", make: "Perodua", model: "Aruz", name: "Perodua Aruz", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L Dual VVT-i · 4AT", km: "15.6 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/perodua-ativa-2025", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "102 HP (75 kW)", torque: "133 Nm", transmission: "4-speed Electronic Automatic", drivetrain: "RWD", seats: 7, groundClearance: "220 mm", dimensions: "4,435 × 1,695 × 1,740 mm · 7-Seater SUV (213–514 L)", safety: "6 Airbags · 5-Star ASEAN NCAP · Advanced Safety Assist (ASA 2.0) · VSC · Hill-Start Assist · Built-in DVR", features: "Auto LED Headlamps · Rear A/C Blower · Smart Entry & Push Start · Roof Rails · 17\" Two-Tone Alloys", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "perodua-traz-range-official", make: "Perodua", model: "Traz", name: "Perodua Traz", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L Dual VVT-i · D-CVT", km: "21.3 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.peroduasl.lk/", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "105 HP (78 kW)", torque: "138 Nm", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "200 mm", dimensions: "4,320 × 1,770 × 1,620 mm · 471 L boot · DNGA B-SUV", safety: "6 Airbags · 5-Star ASEAN NCAP · Perodua Smart Drive Assist (AEB, ACC, LKC, BSM, RCTA) · 360° Panoramaview", features: "9\" Infotainment w/ CarPlay & Android Auto · 7\" Digital Cluster · Kick-Sensor Power Boot · Rear Air Vents · Optional GearUp Body Kit", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "audi-a3-range-official", make: "Audi", model: "A3", name: "Audi A3", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L / 1.5L TFSI · S tronic", km: "17.2 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/audi-q2-2025", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "150 HP (110 kW)", torque: "250 Nm", transmission: "7-speed S tronic / 8AT", drivetrain: "FWD", seats: 5, groundClearance: "140 mm", dimensions: "4,495 × 1,816 × 1,425 mm · 425 L boot", safety: "6 Airbags · Audi Pre Sense Front · Lane Departure Warning · Park Assist w/ Rear Camera · Cruise Control", features: "10.25\" Audi Virtual Cockpit · 10.1\" MMI Touch · LED Headlights w/ Dynamic Rear Indicators · Dual-Zone Deluxe A/C · Sport Seats", warranty: "Used / Past Import Listing (2023 · 14,000 km)"},
  {id: "audi-a4-range-official", make: "Audi", model: "A4", name: "Audi A4", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "2.0L TFSI MHEV · S tronic", km: "15.8 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.audi.lk/en/models/", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "blocked", priceScope: "unverified", power: "190–204 HP", torque: "320 Nm", transmission: "7-speed S tronic Dual-Clutch", drivetrain: "FWD / quattro", seats: 5, groundClearance: "138 mm", dimensions: "4,762 × 1,847 × 1,428 mm · 460 L boot", safety: "6 Airbags · Audi Pre Sense City · Hold Assist · Parking System Plus · Attention Assist", features: "12.3\" Virtual Cockpit Plus · 10.1\" MMI Navigation Plus · 3-Zone Climate Control · Matrix LED Headlights · Leather Memory Seats", warranty: "Past Import Example · Enquire for Quote"},
  {id: "audi-a5-range-official", make: "Audi", model: "A5", name: "Audi A5", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "2.0L TFSI · S tronic", km: "15.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.audi.lk/en/models/", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "blocked", priceScope: "unverified", power: "150–190 HP", torque: "250–320 Nm", transmission: "7-speed S tronic Dual-Clutch", drivetrain: "FWD / quattro", seats: 5, groundClearance: "135 mm", dimensions: "4,757 × 1,843 × 1,386 mm · 465 L Sportback boot", safety: "6 Airbags · Audi Pre Sense · 360° Cameras · Blind Spot Assist · Matrix LED Headlights", features: "Frameless 4-Door Coupe Styling · Virtual Cockpit · Bang & Olufsen 3D Sound · Panoramic Glass Roof · Power Tailgate", warranty: "Used Vehicle Listing (2018 · 74,000 km)"},
  {id: "audi-a6-range-official", make: "Audi", model: "A6", name: "Audi A6", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "2.0L TFSI MHEV · S tronic", km: "14.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.audi.lk/en/models/", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "blocked", priceScope: "unverified", power: "190–265 HP", torque: "320–370 Nm", transmission: "7-speed S tronic", drivetrain: "FWD / quattro", seats: 5, groundClearance: "140 mm", dimensions: "4,939 × 1,886 × 1,457 mm · 530 L boot", safety: "8 Airbags · Audi Pre Sense Front & Rear · 360° Surround Cameras · Lane Departure Warning", features: "Dual MMI Touch Response Screens (10.1\" + 8.6\") · 12.3\" Virtual Cockpit · 4-Zone Climate · Soft-Close Doors · Matrix LED", warranty: "Past Import Example · Enquire for Quote"},
  {id: "audi-a7-range-official", make: "Audi", model: "A7", name: "Audi A7", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "2.0L / 3.0L TFSI · S tronic", km: "12.5–14.0 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.audi.lk/en/models/", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "blocked", priceScope: "unverified", power: "265–340 HP", torque: "370–500 Nm", transmission: "7-speed S tronic", drivetrain: "quattro All-Wheel Drive", seats: 5, groundClearance: "135 mm", dimensions: "4,969 × 1,908 × 1,422 mm · 535 L Sportback boot", safety: "8 Airbags · HD Matrix LED w/ Laser Light · Night Vision Assist · 360° Cameras · Adaptive Cruise Assist", features: "Retractable Rear Spoiler · Dual Touch Response Displays · Bang & Olufsen 3D Audio · Valcona Leather · Air Suspension", warranty: "Past Import Example · Enquire for Quote"},
  {id: "audi-a8-range-official", make: "Audi", model: "A8", name: "Audi A8", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "3.0L V6 TFSI MHEV · tiptronic", km: "11.2 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/audi-q2-2025", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "340 HP (250 kW)", torque: "500 Nm", transmission: "8-speed tiptronic Automatic", drivetrain: "quattro Permanent AWD w/ All-Wheel Steering", seats: 5, groundClearance: "140 mm (Adaptive Air)", dimensions: "5,190–5,320 × 1,945 × 1,475 mm · Flagship Luxury Saloon", safety: "8 Airbags · Predictive Active Suspension · Digital Matrix LED · 360° 3D Cameras · Full Driver Assistance", features: "Rear Relaxation Seat w/ Foot Massager · Dual Rear Tablets · Bang & Olufsen 23-Speaker 3D Sound · Valcona Leather · Panoramic Roof", warranty: "Past Import Example · Enquire for Quote"},
  {id: "audi-q2-range-official", make: "Audi", model: "Q2", name: "Audi Q2", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L / 1.4L TFSI · S tronic", km: "17.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/audi-q2-2025", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "116–150 HP", torque: "200–250 Nm", transmission: "7-speed S tronic / 8AT", drivetrain: "FWD", seats: 5, groundClearance: "150 mm", dimensions: "4,208 × 1,794 × 1,508 mm · 405 L boot", safety: "6 Airbags · Audi Pre Sense Front · Progressive Steering · Rear View Camera & Park Assist", features: "12.3\" Virtual Cockpit · 8.3\" MMI Display · Matrix LED Headlights · Contrast C-Pillar Blade · Panoramic Sunroof · Power Tailgate", warranty: "Past Import Example · Enquire for Quote"},
  {id: "audi-q3-range-official", make: "Audi", model: "Q3", name: "Audi Q3", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.4L / 1.5L TFSI · S tronic", km: "15.6 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.audi.lk/en/models/", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "blocked", priceScope: "unverified", power: "150 HP (110 kW)", torque: "250 Nm", transmission: "S tronic Dual-Clutch", drivetrain: "FWD / quattro", seats: 5, groundClearance: "170 mm", dimensions: "4,484 × 1,849 × 1,616 mm · 530 L boot (sliding rear bench)", safety: "6 Airbags · 5-Star Euro NCAP · Audi Pre Sense · 360° Cameras · Hill Descent Control", features: "Virtual Cockpit Plus · 10.1\" MMI Touch · Panoramic Glass Sunroof · Sonos 3D Premium Sound · Power Tailgate", warranty: "Past Import Example · Enquire for Quote"},
  {id: "audi-q5-range-official", make: "Audi", model: "Q5", name: "Audi Q5", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "2.0L TFSI MHEV · S tronic", km: "13.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.audi.lk/en/models/", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "blocked", priceScope: "unverified", power: "249–265 HP", torque: "370 Nm", transmission: "7-speed S tronic Dual-Clutch", drivetrain: "quattro ultra All-Wheel Drive", seats: 5, groundClearance: "200 mm", dimensions: "4,682 × 1,893 × 1,662 mm · 520 L boot", safety: "8 Airbags · 5-Star Euro NCAP · Audi Pre Sense City & Rear · 360° Cameras · Adaptive Damping Suspension", features: "12.3\" Virtual Cockpit Plus · 10.1\" MMI Touch · Bang & Olufsen 3D Sound · Panoramic Sunroof · 3-Zone Deluxe Climate", warranty: "Past Import Example · Enquire for Quote"},
  {id: "audi-q7-range-official", make: "Audi", model: "Q7", name: "Audi Q7", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "2.0L / 3.0L TFSI quattro · tiptronic", km: "11.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/audi-q7-quattro-2025", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "252–340 HP", torque: "370–500 Nm", transmission: "8-speed tiptronic Automatic", drivetrain: "quattro Permanent All-Wheel Drive", seats: 7, groundClearance: "205–245 mm (Adaptive Air)", dimensions: "5,063 × 1,970 × 1,741 mm · 7-Seater Luxury SUV", safety: "8 Airbags · Adaptive Air Suspension · All-Wheel Steering · 360° Surround Cameras · Matrix LED Headlights", features: "S line Styling · Virtual Cockpit · Bose/Bang & Olufsen 3D Audio · Power Folding 3rd Row · Panoramic Sunroof · 4-Zone Climate", warranty: "Used Vehicle Listing (2017 · 78,000 km)"},
  {id: "audi-tt-range-official", make: "Audi", model: "TT", name: "Audi TT", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "2.0L TFSI · S tronic", km: "14.2 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/audi-q2-2025", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "197–245 HP", torque: "320–370 Nm · 0–100 km/h in 5.2–6.6 s", transmission: "S tronic Dual-Clutch", drivetrain: "FWD / quattro AWD", seats: 4, groundClearance: "130 mm", dimensions: "4,191 × 1,832 × 1,353 mm · 305 L coupe boot", safety: "6 Airbags · Audi Space Frame Aluminum Body · ESC w/ Torque Vectoring · Active Lane Assist", features: "12.3\" Audi Virtual Cockpit (All-in-One Driver Display) · Retractable Rear Spoiler · Turbine A/C Vents w/ Integrated Displays · S Sport Seats", warranty: "Past Import Example · Enquire for Quote"},
  {id: "jetour-dashing-range-official", make: "Jetour", model: "Dashing", name: "Jetour Dashing", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L Turbo Petrol · 6DCT", km: "13.5 km/L", w: "Official", cond: "New", price: 16950000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.euromotors.lk/index.html", sourceUrl: "https://www.jetour.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "correction", priceScope: "starting", priceVerifiedOn: "2026-10-21", power: "156 HP (115 kW)", torque: "230 Nm", transmission: "6-speed Wet Dual-Clutch (6DCT)", drivetrain: "FWD", seats: 5, groundClearance: "160 mm", dimensions: "4,590 × 1,900 × 1,685 mm · 486 L boot", safety: "6 Airbags · 540° Panoramic Camera · Blind Spot Detection · Lane Change Assist · RCTA · Door Open Warning", features: "12.8\"–15.6\" Central Touchscreen · Panoramic Sunroof · Pop-Out Flush Door Handles · 40W Wireless Charger · Voice Command", warranty: "5 yrs / 150,000 km (Euro Motors Sri Lanka)"},
  {id: "jetour-x70-plus-range-official", make: "Jetour", model: "X70 Plus", name: "Jetour X70 Plus", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L Turbo Petrol · 6DCT", km: "13.0 km/L", w: "Official", cond: "New", price: 17500000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.euromotors.lk/index.html", sourceUrl: "https://www.jetour.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "correction", priceScope: "starting", priceVerifiedOn: "2026-10-21", power: "156 HP (115 kW)", torque: "230 Nm", transmission: "6-speed Wet Dual-Clutch (6DCT)", drivetrain: "FWD", seats: 7, groundClearance: "190 mm", dimensions: "4,749 × 1,900 × 1,720 mm · 7-Seater SUV", safety: "6 Airbags · 360° Panoramic Camera · Blind Spot Monitoring · Lane Departure Warning · Hill Descent Control", features: "Dual 10.25\" Widescreen · 62\" Ultra-Wide Panoramic Sunroof · Power Tailgate · 3-Row A/C · 19\" Alloy Wheels", warranty: "5 yrs / 150,000 km (Euro Motors Sri Lanka)"},
  {id: "jetour-t2-range-official", make: "Jetour", model: "T2", name: "Jetour T2", body: "SUV", trim: null, year: null, market: null, fuel: "PHEV", pt: "1.5L Turbo i-DM PHEV / 2.0L Turbo 7DCT", km: "1,000+ km combined · 92–139 km pure EV · 35 min DC fast charge", w: "Official", cond: "New", price: 28500000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.euromotors.lk/index.html", sourceUrl: "https://www.jetour.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "starting", priceVerifiedOn: "2026-10-21", power: "375 HP (280 kW) combined", torque: "610 Nm", transmission: "3-speed Dedicated Hybrid (DHT)", drivetrain: "Dual-Motor Drive / XWD", seats: 5, groundClearance: "220 mm · 700 mm wading", dimensions: "4,785 × 2,006 × 1,875 mm · Rugged Off-Road SUV", safety: "6 Airbags · Level 2 Intelligent ADAS · 540° Transparent Chassis Camera · High-Strength Cage Body (80% HSS)", features: "15.6\" Snapdragon 8155 Display · 10.25\" Cluster · Sony 12-Speaker Audio · Suede Heated/Ventilated Seats · Panoramic Sky Roof", warranty: "5 yrs / 150,000 km (Euro Motors Sri Lanka)"},
  {id: "mg-zs-mce-range-official", make: "MG", model: "ZS MCE", name: "MG ZS MCE 1.0T Automatic", body: "SUV", trim: "1.0T Automatic", year: null, market: null, fuel: "Petrol", pt: "1.0L Turbo Petrol · 6-speed Automatic", km: "14.5–15.2 km/L", w: "Official", cond: "New", price: 12989000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mgsrilanka.lk/", sourceUrl: "https://mgsrilanka.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "111 HP (1.0T) / 114 HP (1.5L)", torque: "160 Nm (1.0T) / 150 Nm (1.5L)", transmission: "6-speed Automatic / 8-step CVT", drivetrain: "FWD", seats: 5, groundClearance: "170 mm", dimensions: "4,323 × 1,809 × 1,653 mm · 448 L boot", safety: "6 Airbags · 360° Around View Camera · Blind Spot Detection · Rear Cross Traffic Alert · ESP · Hill Launch Assist", features: "10.1\" Floating Touchscreen w/ CarPlay & Android Auto · Panoramic Sky Roof · Digital Cluster · Red-Stitched Leatherette Cabin", warranty: "5 yrs / 150,000 km (MG Sri Lanka)"},
  {id: "mg-zs-hybrid-range-official", make: "MG", model: "ZS Hybrid+", name: "MG ZS Hybrid+", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.5L Atkinson Hybrid+ (102 HP + 136 HP motor) · 3-speed Hybrid AT · 1.83 kWh Battery", km: "20.0 km/L (5.0 L/100 km WLTP)", w: "Official", cond: "New", price: 18390000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mgsrilanka.lk/", sourceUrl: "https://mgsrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "197 HP (145 kW) combined", torque: "465 Nm combined · 0–100 km/h in 8.7 s", transmission: "3-speed Hybrid Automatic", drivetrain: "FWD", seats: 5, groundClearance: "165 mm", dimensions: "4,430 × 1,818 × 1,635 mm · 443 L boot", safety: "6 Airbags · MG Pilot ADAS (ACC, AEB, LKA, TJA, BSM, RCTA) · 360° HD Camera", features: "12.3\" HD Infotainment · 7\" Digital Cluster · Panoramic Sunroof · Heated Front Seats & Steering · Keyless Entry", warranty: "5 yrs / 150,000 km Vehicle · 8 yrs Hybrid Battery (MG Sri Lanka)"},
  {id: "mg-hs-plug-in-hybrid-range-official", make: "MG", model: "HS Plug-In Hybrid", name: "MG HS Plug-In Hybrid", body: "SUV", trim: null, year: null, market: null, fuel: "PHEV", pt: "1.5T Plug-in Hybrid · 2-speed EDU · 21.4 kWh Battery", km: "100+ km WLTP pure EV · 1,000+ km combined", w: "Official", cond: "New", price: 24995000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mgsrilanka.lk/", sourceUrl: "https://mgsrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "correction", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "299–339 HP combined", torque: "350–365 Nm · 0–100 km/h in 6.8 s", transmission: "2-speed Electric Drive Unit (EDU)", drivetrain: "FWD", seats: 5, groundClearance: "165 mm", dimensions: "4,670 × 1,890 × 1,663 mm · 441 L boot", safety: "7 Airbags · 5-Star Euro NCAP · MG Pilot 16-Function ADAS · 360° HD Camera · Safe Exit Warning", features: "Dual 12.3\" Widescreen Displays · Panoramic Sky Roof · Power Tailgate · Memory Leather Seats · Wireless Charger · 8-Speaker Audio", warranty: "5 yrs / 150,000 km Vehicle · 8 yrs PHEV Battery (MG Sri Lanka)"},
  {id: "mg-s5-ev-range-official", make: "MG", model: "S5 EV", name: "MG S5 EV", body: "SUV", trim: null, year: null, market: null, fuel: "BEV", pt: "125–170 kW Rear Motor (MSP Platform) · 49–62.2 kWh Ultra-Thin Battery", km: "425–515 km WLTP/CLTC · 10–80% DC in 26 min", w: "Official", cond: "New", price: 20985000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mgsrilanka.lk/", sourceUrl: "https://mgsrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "correction", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "170–231 HP", torque: "250–350 Nm", transmission: "Single-speed EV", drivetrain: "RWD (5-Link Rear Suspension)", seats: 5, groundClearance: "165 mm", dimensions: "4,476 × 1,849 × 1,621 mm · 453 L boot", safety: "7 Airbags · 5-Star Euro NCAP · MG Pilot ADAS · 360° Surround Camera · One-Pedal Driving · V2L", features: "12.8\" Floating Central Display · 10.25\" Driver Cluster · Panoramic Sunroof · Wireless CarPlay/Android Auto · Power Tailgate", warranty: "5 yrs / 150,000 km Vehicle · 8 yrs EV Battery (MG Sri Lanka)"},
  {id: "mg-4-electric-range-official", make: "MG", model: "4 Electric", name: "MG 4 Electric", body: "Passenger car", trim: null, year: null, market: null, fuel: "BEV", pt: "125–150 kW Rear Motor (MSP Platform) · 51–64 kWh Battery", km: "350–450 km WLTP · 10–80% DC in 26–35 min", w: "Official", cond: "New", price: null, priceBasis: "conflicting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/mg-4-ev-2026", sourceUrl: "https://mgsrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "conflict", priceScope: "unverified", power: "170–204 HP", torque: "250 Nm · 50:50 Weight Distribution", transmission: "Single-speed EV", drivetrain: "RWD", seats: 5, groundClearance: "150 mm", dimensions: "4,287 × 1,836 × 1,504 mm · 363 L boot", safety: "6 Airbags · 5-Star Euro NCAP · MG Pilot ADAS (ACC, AEB, LKA, BSM) · 360° Camera · V2L Discharge", features: "10.25\" Floating Screen · 7\" Digital Cluster · Twin-Aero Rear Spoiler · Two-Tone Roof · Wireless Phone Charger", warranty: "5 yrs / 150,000 km Vehicle · 8 yrs EV Battery (MG Sri Lanka)"},
  {id: "mg-hs-hybrid-range-official", make: "MG", model: "HS Hybrid+", name: "MG HS Hybrid+", body: "SUV", trim: "Hybrid+", year: null, market: null, fuel: "HEV", pt: "1.5T Hybrid+ (143 HP engine + 198 HP motor) · 2-speed Hybrid AT · 1.83 kWh Battery", km: "18.2 km/L (5.5 L/100 km WLTP)", w: "Official", cond: "New", price: 21450000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mgsrilanka.lk/models/mg-hs-hybrid/", sourceUrl: "https://mgsrilanka.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-21", power: "224 HP (165 kW) combined", torque: "340 Nm · 0–100 km/h in 7.9 s", transmission: "2-speed Hybrid Automatic", drivetrain: "FWD", seats: 5, groundClearance: "170 mm", dimensions: "4,670 × 1,890 × 1,663 mm · 507 L boot", safety: "7 Airbags · 5-Star Euro NCAP · MG Pilot Full ADAS · 360° HD Camera · Blind Spot Detection", features: "Dual 12.3\" Displays · Panoramic Sunroof · Power Tailgate · Heated Electric Front Seats · Wireless Charger", warranty: "5 yrs / 150,000 km Vehicle · 8 yrs Hybrid Battery (MG Sri Lanka)"},
  {id: "mahindra-xuv-3xo-mx3-official", make: "Mahindra", model: "XUV 3XO", name: "Mahindra XUV 3XO MX3", body: "SUV", trim: "MX3", year: null, market: null, fuel: "Petrol", pt: "1.2L mStallion TCMPFi Turbo Petrol (111 HP) · 6AT", km: "17.96–18.2 km/L", w: "Official", cond: "New", price: 11595000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mahindrasrilanka.lk/", sourceUrl: "https://mahindrasrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "starting", priceVerifiedOn: "2026-10-21", power: "111 HP (82 kW)", torque: "200 Nm", transmission: "6-speed AISIN Automatic", drivetrain: "FWD", seats: 5, groundClearance: "201 mm", dimensions: "3,990 × 1,821 × 1,647 mm · 364 L boot", safety: "6 Airbags Standard · 5-Star Bharat NCAP · Level 2 ADAS (AX7L) · 360° Surround View (AX7L) · All-Wheel Disc Brakes · EPB w/ Auto Hold", features: "Single-Pane Electric Sunroof · 10.25\" HD Infotainment · Wireless Android Auto & Wired CarPlay · Wireless Charger · Rear A/C Vents · 6 Airbags", warranty: "3 yrs / 100,000 km (Ideal Motors / Mahindra Sri Lanka)"},
  {id: "mahindra-xuv-3xo-ax5-official", make: "Mahindra", model: "XUV 3XO", name: "Mahindra XUV 3XO AX5", body: "SUV", trim: "AX5", year: null, market: null, fuel: "Petrol", pt: "1.2L mStallion TCMPFi Turbo Petrol (111 HP) · 6AT", km: "17.96–18.2 km/L", w: "Official", cond: "New", price: 12695000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mahindrasrilanka.lk/", sourceUrl: "https://mahindrasrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "starting", priceVerifiedOn: "2026-10-21", power: "111 HP (82 kW)", torque: "200 Nm", transmission: "6-speed AISIN Automatic", drivetrain: "FWD", seats: 5, groundClearance: "201 mm", dimensions: "3,990 × 1,821 × 1,647 mm · 364 L boot", safety: "6 Airbags Standard · 5-Star Bharat NCAP · Level 2 ADAS (AX7L) · 360° Surround View (AX7L) · All-Wheel Disc Brakes · EPB w/ Auto Hold", features: "Twin 10.25\" HD Screens (Infotainment + Digital Cluster) · Adrenox Connected Car · Dual-Zone Climate · Bi-LED Projector Headlamps · 16\" Diamond-Cut Alloys · Rear Camera", warranty: "3 yrs / 100,000 km (Ideal Motors / Mahindra Sri Lanka)"},
  {id: "mahindra-xuv-3xo-ax7l-official", make: "Mahindra", model: "XUV 3XO", name: "Mahindra XUV 3XO AX7L", body: "SUV", trim: "AX7L", year: null, market: null, fuel: "Petrol", pt: "1.2L mStallion TGDi Turbo Petrol (130 HP) · 6AT", km: "17.96–18.2 km/L", w: "Official", cond: "New", price: 13695000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mahindrasrilanka.lk/", sourceUrl: "https://mahindrasrilanka.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "starting", priceVerifiedOn: "2026-10-21", power: "130 HP (96 kW)", torque: "230 Nm", transmission: "6-speed AISIN Automatic", drivetrain: "FWD", seats: 5, groundClearance: "201 mm", dimensions: "3,990 × 1,821 × 1,647 mm · 364 L boot", safety: "6 Airbags Standard · 5-Star Bharat NCAP · Level 2 ADAS (AX7L) · 360° Surround View (AX7L) · All-Wheel Disc Brakes · EPB w/ Auto Hold", features: "Skyroof™ Panoramic Sunroof · Level 2 ADAS · 360° Surround View w/ Blind View Monitor · Harman Kardon 7-Speaker Audio · 17\" Diamond-Cut Alloys · EPB w/ Auto Hold", warranty: "3 yrs / 100,000 km (Ideal Motors / Mahindra Sri Lanka)"},
  {id: "volkswagen-virtus-chrome-range-official", make: "Volkswagen", model: "Virtus Chrome", name: "Volkswagen Virtus Chrome", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L TSI Turbo Petrol · 6-speed Torque-Converter AT", km: "18.12 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.volkswagen.lk/en.html", sourceUrl: "https://www.volkswagen.lk/en.html", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "115 HP (85 kW)", torque: "178 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "179 mm", dimensions: "4,561 × 1,752 × 1,507 mm · 521 L boot", safety: "6 Airbags · 5-Star Global NCAP · ESC · Multi-Collision Brakes · Electronic Differential Lock (XDS) · TPMS", features: "10\" VW Play Touchscreen w/ Wireless CarPlay/Android Auto · 8\" Digital Cockpit · Ventilated Leather Seats · Electric Sunroof", warranty: "3 yrs / 100,000 km (Senok Volkswagen Sri Lanka)"},
  {id: "volkswagen-taigun-range-official", make: "Volkswagen", model: "Taigun", name: "Volkswagen Taigun", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L TSI Turbo Petrol · 6-speed Torque-Converter AT", km: "18.15 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/mg-s5-2025", sourceUrl: "https://www.volkswagen.lk/en.html", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "115 HP (85 kW)", torque: "178 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "188 mm", dimensions: "4,221 × 1,760 × 1,612 mm · 385 L boot", safety: "6 Airbags · 5-Star Global NCAP · ESC · Hill Hold Control · Multi-Collision Brakes · TPMS", features: "10\" VW Play Touchscreen · 8\" Digital Cockpit · Ventilated Front Seats · Electric Sunroof · Infinity LED Tail Light Bar", warranty: "3 yrs / 100,000 km (Senok Volkswagen Sri Lanka)"},
  {id: "toyota-urban-cruiser-hyryder-v-range-grey", make: "Toyota", model: "Urban Cruiser Hyryder V", name: "Toyota Urban Cruiser Hyryder V", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.5L Strong Hybrid · e-CVT", km: "27.97 km/L", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/advanced-search/", sourceUrl: "https://cartivatemotors.lk/advanced-search/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, route: "grey", priceVerification: "unverified", priceScope: "unverified", power: "115 HP (85 kW) combined", torque: "122 Nm + 141 Nm motor", transmission: "e-CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "210 mm", dimensions: "4,365 × 1,795 × 1,645 mm · 373 L boot", safety: "6 Airbags · 360° Camera · ESP · Hill Hold Control · TPMS · All-Wheel Disc Brakes", features: "9\" Smart Playcast · Panoramic Sunroof · Head-Up Display · Ventilated Leather Seats · Wireless Charger · Arkamys Audio", warranty: "Importer Warranty"},
  {id: "toyota-urban-cruiser-taisor-range-grey", make: "Toyota", model: "Urban Cruiser Taisor", name: "Toyota Urban Cruiser Taisor G", body: "SUV", trim: "G", year: null, market: null, fuel: "Petrol", pt: "1.0L Turbo Petrol · 6AT", km: "19.8 km/L", w: "Grey", cond: "New", price: 11150000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/listing/toyota-taisor-g-grade-2026-2/", sourceUrl: "https://cartivatemotors.lk/listing/toyota-taisor-g-grade-2026-2/", checkedOn: "2026-10-21", availability: "importer-listed", img: "", custom: false, route: "grey", priceVerification: "confirmed", priceScope: "listing", priceVerifiedOn: "2026-10-21", power: "100 HP (73.6 kW)", torque: "147.6 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "190 mm", dimensions: "3,995 × 1,765 × 1,550 mm · 308 L boot", safety: "6 Airbags · 360° View Camera (V Grade) · Head-Up Display · ESP · Hill-Hold Assist", features: "9\" HD Touchscreen · Wireless Apple CarPlay & Android Auto · Wireless Charger · Cruise Control · 16\" Machined Alloys", warranty: "Importer Warranty (Cartivate Motors)"},
  {id: "toyota-urban-cruiser-taisor-v-grey", make: "Toyota", model: "Urban Cruiser Taisor", name: "Toyota Urban Cruiser Taisor V", body: "SUV", trim: "V", year: 2026, market: null, fuel: "Petrol", pt: "1.0L Turbo Petrol · 6AT", km: "19.8 km/L", w: "Grey", cond: "New", price: 11950000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/listing/toyota-taisor-v-grade-highest-spec-2026-black/", sourceUrl: "https://cartivatemotors.lk/listing/toyota-taisor-v-grade-highest-spec-2026-black/", checkedOn: "2026-10-21", availability: "importer-listed", img: "", custom: false, route: "grey", priceVerification: "confirmed", priceScope: "listing", priceVerifiedOn: "2026-10-21", power: "100 HP (73.6 kW)", torque: "147.6 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "190 mm", dimensions: "3,995 × 1,765 × 1,550 mm · 308 L boot", safety: "6 Airbags · 360° View Camera (V Grade) · Head-Up Display · ESP · Hill-Hold Assist", features: "9\" HD Touchscreen · Wireless Apple CarPlay & Android Auto · Wireless Charger · Cruise Control · 16\" Machined Alloys", warranty: "Importer Warranty (Cartivate Motors)"},
  {id: "honda-vezel-e-hev-z-range-grey", make: "Honda", model: "Vezel e:HEV Z", name: "Honda Vezel e:HEV Z", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.5L e:HEV Strong Hybrid · e-CVT", km: "25.3–26.0 km/L (WLTC)", w: "Grey", cond: null, price: 17900000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://trixon.lk/vehicles", checkedOn: "2026-10-20", availability: "import-service", img: "", custom: false, route: "grey", priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "131 HP (96 kW) motor + 106 HP engine", torque: "253 Nm electric motor", transmission: "e-CVT Electric Coupled", drivetrain: "FWD / Real-Time AWD", seats: 5, groundClearance: "195 mm", dimensions: "4,330 × 1,790 × 1,590 mm · Magic Seats", safety: "Honda SENSING (CMBS, ACC w/ LSF, LKAS, BSM, Multi-View Camera) · 6 Airbags · Hill Descent Control", features: "9\" Honda CONNECT Display · Hands-Free Power Tailgate · Heated Steering & Front Seats · Breeze-Diffusion Air Vents · 18\" Alloys (Z/PLaY)", warranty: "Importer Powertrain & Hybrid Battery Warranty"},
  {id: "toyota-raize-hybrid-z-range-grey", make: "Toyota", model: "Raize Hybrid Z", name: "Toyota Raize Hybrid Z", body: "SUV", trim: "Z Hybrid BSM", year: 2026, market: null, fuel: "HEV", pt: "1.2L WA-VEX e-SMART Series Hybrid · e-CVT", km: "28.0 km/L (WLTC)", w: "Grey", cond: "New", price: 14450000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/listing/toyota-raize-z-grade-2026-hybrid-bsm-highest-spec/", sourceUrl: "https://cartivatemotors.lk/make/toyota/", checkedOn: "2026-10-21", availability: "importer-listed", img: "", custom: false, route: "grey", priceVerification: "confirmed", priceScope: "listing", priceVerifiedOn: "2026-10-21", power: "106 HP (78 kW) electric drive motor", torque: "170 Nm electric motor", transmission: "e-SMART Electric Drive", drivetrain: "FWD", seats: 5, groundClearance: "185 mm", dimensions: "3,995 × 1,695 × 1,620 mm · 369 L boot", safety: "Smart Assist ADAS · Adaptive Cruise Control · Blind Spot Monitor (BSM) · 360° Panoramic View · 6 Airbags", features: "S-Pedal One-Pedal Drive · Electronic Parking Brake w/ Auto Hold · 9\" Display Audio · Full LED Adaptive Headlamps", warranty: "Importer Powertrain & Hybrid Battery Warranty"},
  {id: "suzuki-swift-mz-range-grey", make: "Suzuki", model: "Swift MZ", name: "Suzuki Swift MZ", body: "Passenger car", trim: null, year: null, market: null, fuel: "HEV", pt: "1.2L Mild Hybrid · CVT", km: "24.5 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/suzuki-s-presso-2024", sourceUrl: "https://cartivatemotors.lk/advanced-search/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, route: "grey", priceVerification: "wrong-source", priceScope: "unverified", power: "82 HP + 3.1 HP WA06D ISG motor", torque: "108 Nm + 60 Nm motor", transmission: "CVT Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "120 mm", dimensions: "3,860 × 1,695 × 1,500 mm · 265 L boot", safety: "Dual Sensor Brake Support II (Millimeter Radar + Camera) · Adaptive Cruise w/ Stop & Go · BSM · 6 Airbags", features: "9\" Display Audio · Electronic Parking Brake w/ Auto Hold · Heated Front Seats · LED Projector Headlamps · 16\" Alloys", warranty: "Importer Warranty"},
  {id: "toyota-corolla-cross-z-range-grey", make: "Toyota", model: "Corolla Cross Z", name: "Toyota Corolla Cross Z", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "1.8L Hybrid · e-CVT", km: "26.4 km/L (WLTC)", w: "Grey", cond: null, price: 22500000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://cartivatemotors.lk/advanced-search/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, route: "grey", priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "140 HP combined", torque: "142 Nm + 185 Nm motor", transmission: "e-CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "160 mm", dimensions: "4,490 × 1,825 × 1,620 mm · 487 L boot", safety: "Toyota Safety Sense 3.0 · Panoramic View Monitor · Advanced Park · BSM · 7 Airbags", features: "JDM Z Leather/Fabric Heated Seats · Sequential LED Turn Signals · Hands-Free Power Back Door · 18\" Two-Tone Alloys", warranty: "Importer Warranty (1–3 yrs selectable)"},
  {id: "kia-syros-range-grey", make: "Kia", model: "Syros", name: "Kia Syros HTX Plus", body: "SUV", trim: "HTX Plus", year: 2026, market: null, fuel: "Petrol", pt: "1.0L T-GDI Petrol · 7DCT", km: "17.65 km/L", w: "Grey", cond: "New", price: 12950000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/listing/kia-syros-htx-plus-2026-2/", sourceUrl: "https://cartivatemotors.lk/listing/kia-syros-htx-plus-2026-2/", checkedOn: "2026-10-21", availability: "importer-listed", img: "", custom: false, route: "grey", priceVerification: "confirmed", priceScope: "listing", priceVerifiedOn: "2026-10-21", power: "120 HP (88 kW)", torque: "172 Nm", transmission: "7-speed Dual-Clutch (7DCT) w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "190 mm", dimensions: "3,995 × 1,805 × 1,680 mm · 465 L boot (sliding rear seats)", safety: "6 Airbags · 5-Star Bharat NCAP · Level 2 ADAS (16 features) · 360° Camera w/ Blind View Monitor · EPB w/ Auto Hold", features: "30\" Trinity Panoramic Display · Sliding, Reclining & Ventilated Rear Seats · Dual-Pane Panoramic Sunroof · Harman Kardon 8-Speaker", warranty: "Importer Warranty (Cartivate Motors)"},
  {id: "volkswagen-t-cross-range-grey", make: "Volkswagen", model: "T-Cross", name: "Volkswagen T-Cross", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.0L TSI Turbo Petrol · 7-speed DSG Dual-Clutch", km: "17.5 km/L", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://autoxolk.com/", sourceUrl: "https://autoxolk.com/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, route: "grey", priceVerification: "unverified", priceScope: "unverified", power: "115 HP (85 kW)", torque: "200 Nm", transmission: "7-speed DSG Automatic", drivetrain: "FWD", seats: 5, groundClearance: "180 mm", dimensions: "4,127 × 1,760 × 1,573 mm · 385–455 L sliding boot", safety: "6 Airbags · 5-Star Euro NCAP · Travel Assist (ACC, Front Assist AEB, Lane Assist, Blind Spot) · Park Assist", features: "Digital Cockpit Pro · IQ.LIGHT LED Matrix Headlamps · Sliding Rear Bench · BeatsAudio 300W Sound · Wireless App-Connect", warranty: "3 yrs / 100,000 km (Senok Volkswagen Sri Lanka)"},
  {id: "mitsubishi-outlander-2015-used", make: "Mitsubishi", model: "Outlander", name: "Mitsubishi Outlander", body: "SUV", trim: null, year: 2015, market: null, fuel: "PHEV", pt: "2.0L Twin-Motor PHEV · 4WD", km: "52 km EV · 18.6 km/L hybrid", w: "Unknown", cond: null, price: 12300000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/listing/mitsubishi-outlander-2015/", sourceUrl: "https://cartivatemotors.lk/advanced-search/", checkedOn: "2026-10-20", availability: "used-listed", img: "", custom: false, route: "independent", priceVerification: "confirmed", priceScope: "used listing", priceVerifiedOn: "2026-10-21", power: "200 HP combined (82 HP × 2 motors + 118 HP engine)", torque: "137 Nm (front) + 195 Nm (rear) + 186 Nm", transmission: "Single-speed Twin-Motor PHEV w/ Parallel Mode", drivetrain: "Super All-Wheel Control (S-AWC) 4WD", seats: 5, groundClearance: "190 mm", dimensions: "4,695 × 1,800 × 1,710 mm · 463 L boot", safety: "7 Airbags · Forward Collision Mitigation (FCM) · Adaptive Cruise Control · Lane Departure Warning · S-AWC Stability", features: "6-Level Regen Paddle Shifters · Power Tailgate · Heated Leather/Alcantara Seats · CHAdeMO Rapid Charge + AC 1500W Outlets", warranty: "Used Seller Warranty (Cartivate Motors)"},
  {id: "peugeot-5008-allure-premium-2019-used", make: "Peugeot", model: "5008 Allure Premium", name: "Peugeot 5008 Allure Premium", body: "SUV", trim: null, year: 2019, market: null, fuel: "Petrol", pt: "Turbo Petrol · EAT8", km: "15.8 km/L", w: "Unknown", cond: null, price: 22500000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/listing/peugeot-5008-allure-premium-2019/", sourceUrl: "https://cartivatemotors.lk/advanced-search/", checkedOn: "2026-10-20", availability: "used-listed", img: "", custom: false, route: "independent", priceVerification: "confirmed", priceScope: "used listing", priceVerifiedOn: "2026-10-21", power: "130 HP (96 kW)", torque: "230 Nm", transmission: "8-speed Efficient Automatic (EAT8)", drivetrain: "FWD w/ Advanced Grip Control", seats: 7, groundClearance: "236 mm", dimensions: "4,641 × 1,844 × 1,646 mm · 7-Seater SUV (780 L 5-seat boot)", safety: "6 Airbags · Active Safety Brake · Blind Spot Monitoring · Lane Keeping Assist · 180° VisioPark Camera", features: "Peugeot i-Cockpit 12.3\" Digital Head-Up Cluster · 10\" HD Touchscreen · 3 Individual 2nd-Row Seats w/ ISOFIX · Hands-Free Tailgate", warranty: "Used Vehicle Listing (2019 · 83,000 km)"},
  {id: "bmw-530e-m-sport-2017-used", make: "BMW", model: "530e M Sport", name: "BMW 530e M Sport", body: "Passenger car", trim: null, year: 2017, market: null, fuel: "PHEV", pt: "2.0L Turbo PHEV · 8AT", km: "45 km EV · 18.5 km/L combined", w: "Unknown", cond: null, price: 28500000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/listing/bmw-530e-msport-2017/", sourceUrl: "https://cartivatemotors.lk/advanced-search/", checkedOn: "2026-10-20", availability: "used-listed", img: "", custom: false, route: "independent", priceVerification: "confirmed", priceScope: "used listing", priceVerifiedOn: "2026-10-21", power: "252 HP (185 kW) combined", torque: "420 Nm · 0–100 km/h in 6.2 s", transmission: "8-speed Steptronic Sport Automatic", drivetrain: "RWD", seats: 5, groundClearance: "140 mm", dimensions: "4,936 × 1,868 × 1,483 mm · Executive PHEV Saloon", safety: "6 Airbags · Driving Assistant · Active Protection · 360° Surround View · Parking Assistant Plus · M Sport Brakes", features: "M Aerodynamics Package · Harman Kardon Surround Sound · Dakota Leather Sport Seats · Head-Up Display · Gesture Control · Sunroof", warranty: "Used Vehicle Listing (2017 · 70,000 km)"},
  {id: "mercedes-benz-e200-avantgarde-2010-used", make: "Mercedes-Benz", model: "E200 Avantgarde", name: "Mercedes-Benz E200 Avantgarde", body: "Passenger car", trim: null, year: 2010, market: null, fuel: "Petrol", pt: "1.8L CGI Turbocharged Petrol (W212) · 5G-Tronic / 7G-Tronic Automatic", km: "13.2 km/L", w: "Unknown", cond: null, price: 13450000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/listing/mercedes-benz-e200-avantgarde-2010/", sourceUrl: "https://cartivatemotors.lk/advanced-search/", checkedOn: "2026-10-20", availability: "used-listed", img: "", custom: false, route: "independent", priceVerification: "confirmed", priceScope: "used listing", priceVerifiedOn: "2026-10-21", power: "184 HP (135 kW)", torque: "270 Nm", transmission: "Automatic w/ Comfort & Sport Modes", drivetrain: "RWD", seats: 5, groundClearance: "140 mm", dimensions: "4,868 × 1,854 × 1,471 mm · 540 L boot", safety: "9 Airbags · PRE-SAFE® Occupant Protection · ATTENTION ASSIST · Adaptive Brake w/ HOLD · Active Park Assist", features: "Avantgarde Styling & Suspension · Intelligent Bi-Xenon/LED Lighting · Leather Power Memory Seats · Dual-Zone THERMATIC Climate", warranty: "Used Vehicle Listing (2010 · 89,000 km)"},
  {id: "daihatsu-mira-e-s-l-grey", make: "Daihatsu", model: "Mira e:S", name: "Daihatsu Mira e:S L", body: "Passenger car", trim: "L", year: null, market: null, fuel: "Petrol", pt: "660cc KF-VE 3-Cyl DOHC Petrol · CVT", km: "25.0 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "49 HP (36 kW)", torque: "57 Nm", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,500 mm · 650 kg Lightweight Kei Car", safety: "Smart Assist III (Stereo Camera AEB, Pedestrian Detection, Lane Departure Warning, Corner Sensors) · Dual Airbags · VSC", features: "Eco Idle Stop-Start · Digital Multi-Info Speedometer · LED Headlamps (X SA III) · Power Windows & Mirrors", warranty: "Importer Warranty"},
  {id: "daihatsu-mira-e-s-x-grey", make: "Daihatsu", model: "Mira e:S", name: "Daihatsu Mira e:S X", body: "Passenger car", trim: "X", year: null, market: null, fuel: "Petrol", pt: "660cc KF-VE 3-Cyl DOHC Petrol · CVT", km: "25.0 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "49 HP (36 kW)", torque: "57 Nm", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,500 mm · 650 kg Lightweight Kei Car", safety: "Smart Assist III (Stereo Camera AEB, Pedestrian Detection, Lane Departure Warning, Corner Sensors) · Dual Airbags · VSC", features: "Eco Idle Stop-Start · Digital Multi-Info Speedometer · LED Headlamps (X SA III) · Power Windows & Mirrors", warranty: "Importer Warranty"},
  {id: "suzuki-wagon-r-fx-grey", make: "Suzuki", model: "Wagon R", name: "Suzuki Wagon R FX", body: "Passenger car", trim: "FX", year: null, market: null, fuel: "Petrol", pt: "660cc Petrol · CVT", km: "25.2 km/L (WLTC)", w: "Grey", cond: null, price: 7000000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "49 HP + 2.6 HP ISG motor", torque: "58 Nm + 40 Nm motor", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,650 mm · Kei Tall Wagon", safety: "Suzuki Safety Support (Dual Camera Brake Support, ACC, Lane Keep, Sign Recognition) · 6 Airbags · Head-Up Display", features: "Umbrella Holders in Rear Doors · Heated Driver/Passenger Seats · Keyless Push Start · Auto A/C · Sliding Rear Seats", warranty: "Importer Warranty"},
  {id: "suzuki-wagon-r-fxs-grey", make: "Suzuki", model: "Wagon R", name: "Suzuki Wagon R FXS", body: "Passenger car", trim: "FXS", year: null, market: null, fuel: "HEV", pt: "660cc Mild Hybrid · CVT", km: "25.2 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "49 HP + 2.6 HP ISG motor", torque: "58 Nm + 40 Nm motor", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,650 mm · Kei Tall Wagon", safety: "Suzuki Safety Support (Dual Camera Brake Support, ACC, Lane Keep, Sign Recognition) · 6 Airbags · Head-Up Display", features: "Umbrella Holders in Rear Doors · Heated Driver/Passenger Seats · Keyless Push Start · Auto A/C · Sliding Rear Seats", warranty: "Importer Warranty"},
  {id: "suzuki-wagon-r-custom-z-grey", make: "Suzuki", model: "Wagon R", name: "Suzuki Wagon R Custom Z", body: "Passenger car", trim: "Custom Z", year: null, market: null, fuel: "HEV", pt: "660cc Mild Hybrid · CVT", km: "25.2 km/L (WLTC)", w: "Grey", cond: null, price: 8300000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "49 HP + 2.6 HP ISG motor", torque: "58 Nm + 40 Nm motor", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,650 mm · Kei Tall Wagon", safety: "Suzuki Safety Support (Dual Camera Brake Support, ACC, Lane Keep, Sign Recognition) · 6 Airbags · Head-Up Display", features: "Umbrella Holders in Rear Doors · Heated Driver/Passenger Seats · Keyless Push Start · Auto A/C · Sliding Rear Seats", warranty: "Importer Warranty"},
  {id: "toyota-yaris-x-grey", make: "Toyota", model: "Yaris", name: "Toyota Yaris X", body: "Passenger car", trim: "X", year: null, market: null, fuel: "Petrol", pt: "1.0L / 1.5L Petrol · CVT", km: "20.2–21.6 km/L (WLTC)", w: "Grey", cond: null, price: 9500000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "69 HP (1.0L) / 120 HP (1.5L)", torque: "92 Nm / 145 Nm", transmission: "CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "145 mm", dimensions: "3,940 × 1,695 × 1,500 mm · 270 L boot", safety: "Toyota Safety Sense (PCS, Radar Cruise, Lane Trace Assist, Road Sign Assist) · 6 Airbags · ICS Parking Sonar", features: "8\" Display Audio · Digital Multi-Info Display · Auto Climate Control (G Grade) · Smart Entry & Push Start · LED Lamps", warranty: "Importer Warranty"},
  {id: "toyota-yaris-g-grey", make: "Toyota", model: "Yaris", name: "Toyota Yaris G", body: "Passenger car", trim: "G", year: null, market: null, fuel: "Petrol", pt: "1.0L / 1.5L Petrol · CVT", km: "20.2–21.6 km/L (WLTC)", w: "Grey", cond: null, price: 10500000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "69 HP (1.0L) / 120 HP (1.5L)", torque: "92 Nm / 145 Nm", transmission: "CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "145 mm", dimensions: "3,940 × 1,695 × 1,500 mm · 270 L boot", safety: "Toyota Safety Sense (PCS, Radar Cruise, Lane Trace Assist, Road Sign Assist) · 6 Airbags · ICS Parking Sonar", features: "8\" Display Audio · Digital Multi-Info Display · Auto Climate Control (G Grade) · Smart Entry & Push Start · LED Lamps", warranty: "Importer Warranty"},
  {id: "toyota-yaris-cross-z-hybrid-grey", make: "Toyota", model: "Yaris Cross", name: "Toyota Yaris Cross Z Hybrid", body: "SUV", trim: "Z Hybrid", year: null, market: null, fuel: "HEV", pt: "1.5L Hybrid · e-CVT", km: "26.0–30.8 km/L", w: "Grey", cond: null, price: 17200000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "110–116 HP (82–85 kW)", torque: "141 Nm + 120 Nm motor", transmission: "e-CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "210 mm", dimensions: "4,310 × 1,770 × 1,615 mm · 458 L boot", safety: "6 Airbags · Toyota Safety Sense (PCS, ACC, LDA, BSM) · 360° Camera", features: "10.1\" Wireless Apple CarPlay/Android Auto · Panoramic Glass Roof · Power Tailgate · 7\" Digital Cluster", warranty: "3 yrs / 100,000 km (Toyota Lanka) · 5 yrs Hybrid Battery"},
  {id: "honda-wr-v-z-grey", make: "Honda", model: "WR-V", name: "Honda WR-V Z", body: "SUV", trim: "Z", year: null, market: null, fuel: "Petrol", pt: "1.5L i-VTEC Petrol · CVT", km: "16.2–16.4 km/L (WLTC)", w: "Grey", cond: null, price: 15800000, priceBasis: "starting", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "confirmed", priceScope: "range/starting", priceVerifiedOn: "2026-10-21", power: "118 HP (87 kW)", torque: "142 Nm", transmission: "CVT w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "195 mm", dimensions: "4,325 × 1,790 × 1,650 mm · Class-Leading 458 L boot", safety: "Honda SENSING Standard (CMBS, ACC, LKAS, Auto High-Beam, Parking Sensors) · 6 Airbags", features: "Prime Smooth Combination Seats (Z Grade) · 9\" Honda CONNECT · Rear A/C Vents · 17\" Two-Tone Alloys · Full LED Headlamps", warranty: "Importer Warranty"},
  {id: "toyota-aqua-range-grey", make: "Toyota", model: "Aqua", name: "Toyota Aqua", body: "Passenger car", trim: null, year: null, market: null, fuel: "HEV", pt: "1.5L Hybrid · e-CVT", km: "33.6–35.8 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/toyota-aqua-2022", sourceUrl: "https://apitrading.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "range-only", priceScope: "unverified", power: "116 HP (85 kW) combined", torque: "120 Nm + 141 Nm motor", transmission: "e-CVT Automatic", drivetrain: "FWD", seats: 5, groundClearance: "140 mm", dimensions: "4,050 × 1,695 × 1,485 mm · 305 L boot", safety: "Toyota Safety Sense · Comfort Pedal (One-Pedal Drive) · Teammate Advanced Park · BSM · 6 Airbags", features: "10.5\" HD Display Audio · AC100V/1500W Emergency Power Outlet · Bi-Beam LED Headlamps · Heated Steering & Seats", warranty: "Importer Warranty"},
  {id: "toyota-pixis-epoch-range-grey", make: "Toyota", model: "Pixis Epoch", name: "Toyota Pixis Epoch", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "660cc Petrol · CVT", km: "25.0 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/toyota-raize-2025", sourceUrl: "https://apitrading.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "49 HP (36 kW)", torque: "57 Nm", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,500 mm · Kei Hatchback", safety: "Smart Assist III (Stereo Camera AEB, Lane Departure Warning, Corner Sensors) · Dual SRS Airbags · VSC", features: "Eco Idle Stop-Start · LED Headlamps (X SA III) · Digital Speedometer · Power Windows · Keyless Entry", warranty: "Importer Warranty"},
  {id: "toyota-harrier-range-grey", make: "Toyota", model: "Harrier", name: "Toyota Harrier", body: "SUV", trim: null, year: null, market: null, fuel: "HEV", pt: "2.5L Hybrid / 2.0L Petrol · e-CVT", km: "15.4–22.3 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://apitrading.lk/", sourceUrl: "https://apitrading.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "171 HP (2.0L) / 218 HP (2.5L HEV)", torque: "207 Nm / 221 Nm + motor", transmission: "Direct-Shift CVT / e-CVT", drivetrain: "FWD / E-Four AWD", seats: 5, groundClearance: "190–195 mm", dimensions: "4,740 × 1,855 × 1,660 mm · 409 L boot", safety: "Toyota Safety Sense · Digital Inner Mirror w/ Front/Rear Dashcam · Panoramic View Monitor · 7 Airbags", features: "12.3\" T-Connect SD Navigation · JBL 9-Speaker Premium Sound · Electrochromatic Dimming Panorama Roof · Power Leather Seats", warranty: "Importer Warranty"},
  {id: "suzuki-alto-range-grey", make: "Suzuki", model: "Alto", name: "Suzuki Alto", body: "Passenger car", trim: null, year: null, market: null, fuel: "HEV", pt: "660cc Mild Hybrid · CVT", km: "25.2–27.7 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://apitrading.lk/", sourceUrl: "https://apitrading.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "46–49 HP + 2.6 HP ISG", torque: "55–58 Nm", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,525 mm · JDM Kei Hatchback", safety: "Suzuki Safety Support (Dual Camera Brake Support, False Start Prevention, Lane Departure Warning) · 6 Airbags", features: "Bi-Tone Roof Option · LED Headlamps (Hybrid X) · Auto Climate Control · Heated Front Seats · Keyless Push Start", warranty: "Importer Warranty"},
  {id: "suzuki-hustler-range-grey", make: "Suzuki", model: "Hustler", name: "Suzuki Hustler", body: "Passenger car", trim: null, year: null, market: null, fuel: "HEV", pt: "660cc Mild Hybrid · CVT", km: "23.4–25.0 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/byd-atto-1-2025", sourceUrl: "https://apitrading.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "49 HP (NA) / 64 HP (Turbo)", torque: "58 Nm / 98 Nm", transmission: "CVT Automatic", drivetrain: "FWD / 4WD", seats: 4, groundClearance: "180 mm", dimensions: "3,395 × 1,475 × 1,680 mm · Kei Crossover SUV", safety: "Dual Camera Brake Support · Adaptive Cruise Control · Lane Keep Assist · 6 Airbags · 360° Camera Option", features: "9\" HD Navigation · Washable Luggage Floor · Fold-Flat Camping Seats · Round LED Headlamps · Roof Rails (Tough Wild)", warranty: "Importer Warranty"},
  {id: "suzuki-lapin-range-grey", make: "Suzuki", model: "Lapin", name: "Suzuki Lapin", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "660cc Petrol · CVT", km: "26.2 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://apitrading.lk/", sourceUrl: "https://apitrading.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "52 HP (38 kW)", torque: "60 Nm", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "155 mm", dimensions: "3,395 × 1,475 × 1,525 mm · Retro Kei Hatchback", safety: "Dual Camera Brake Support · 360° Omni-Directional Monitor · 6 Airbags · ESP", features: "nanoe™ X Climate Control · 360° UV/IR Cut Glass · Wood-Style Dash Table · Quilted/Plaid Upholstery · USB-C PD Ports", warranty: "Importer Warranty"},
  {id: "suzuki-wagon-r-stingray-range-grey", make: "Suzuki", model: "Wagon R Stingray", name: "Suzuki Wagon R Stingray", body: "Passenger car", trim: null, year: null, market: null, fuel: "HEV", pt: "660cc Mild Hybrid · CVT", km: "22.5–25.2 km/L (WLTC)", w: "Grey", cond: null, price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://apitrading.lk/", checkedOn: "2026-10-20", availability: "importer-listed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "64 HP (Turbo) / 49 HP (Hybrid)", torque: "98 Nm (Turbo) / 58 Nm", transmission: "CVT w/ 7-speed Manual Mode", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,650 mm · Sport Kei Wagon", safety: "Suzuki Safety Support · Dual Camera Brake Support · Head-Up Display · 6 Airbags · ESP", features: "Stingray Aero Bumper & Vertical LED Headlamps · 15\" Alloy Wheels · Leather Steering Wheel · Heated Seats", warranty: "Importer Warranty"},
  {id: "land-rover-range-rover-range-official", make: "Land Rover", model: "Range Rover", name: "Land Rover Range Rover", body: "SUV", trim: null, year: null, market: null, fuel: "PHEV", pt: "3.0L PHEV / Mild Hybrid · AWD", km: "11.0–18.0 km/L (PHEV: 121 km EV)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.landrover.lk/our-vehicles", sourceUrl: "https://www.landrover.lk/our-vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "360–460 HP", torque: "500–660 Nm", transmission: "8-speed ZF Automatic", drivetrain: "Intelligent All-Wheel Drive w/ All-Wheel Steering", seats: 5, groundClearance: "219–295 mm (Electronic Air)", dimensions: "5,052 × 2,047 × 1,870 mm · Flagship Luxury SUV", safety: "8 Airbags · Electronic Air Suspension w/ Dynamic Response Pro · ClearSight Ground View & Mirror · Terrain Response 2", features: "13.1\" Pivi Pro Curved Floating Glass · Meridian Signature 35-Speaker Audio w/ Active Noise Cancellation · Semi-Aniline Leather · Split Tailgate", warranty: "3 yrs / 100,000 km (Access Motors / Land Rover Sri Lanka)"},
  {id: "land-rover-range-rover-sport-range-official", make: "Land Rover", model: "Range Rover Sport", name: "Land Rover Range Rover Sport", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "3.0L I6 MHEV (360 BHP) · AWD", km: "10.6–18.0 km/L · 900 mm wading", w: "Official", cond: "New", price: 143296000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.landrover.lk/stock-locator/new-vehicles/range-rover", sourceUrl: "https://www.landrover.lk/our-vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Autobiography stock listing", priceVerifiedOn: "2026-10-21", power: "360 HP (Autobiography) / 460 HP (PHEV)", torque: "500–660 Nm · 0–100 km/h in 5.5–5.9 s", transmission: "8-speed ZF Automatic", drivetrain: "Intelligent AWD w/ All-Wheel Steering & Dynamic Air Suspension", seats: 5, groundClearance: "216–281 mm", dimensions: "4,946 × 2,047 × 1,820 mm · 647 L boot", safety: "8 Airbags · 5-Star Euro NCAP · Adaptive Off-Road Cruise · 3D Surround Camera w/ Wade Sensing · Digital LED Headlights", features: "Autobiography Semi-Aniline 22-Way Massage Seats · 13.1\" Pivi Pro · Meridian 3D Surround · Sliding Panoramic Roof · Soft Door Close", warranty: "3 yrs / 100,000 km (Access Motors / Land Rover Sri Lanka)"},
  {id: "land-rover-range-rover-velar-range-official", make: "Land Rover", model: "Range Rover Velar", name: "Land Rover Range Rover Velar", body: "SUV", trim: null, year: null, market: null, fuel: "PHEV", pt: "2.0L Turbo / PHEV · AWD", km: "10.8–16.5 km/L (P400e: 64 km EV)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.landrover.lk/our-vehicles", sourceUrl: "https://www.landrover.lk/our-vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "250 HP (P250) / 404 HP (P400e)", torque: "365 Nm / 640 Nm", transmission: "8-speed Automatic", drivetrain: "Intelligent All-Wheel Drive w/ Terrain Response", seats: 5, groundClearance: "213–251 mm", dimensions: "4,797 × 2,041 × 1,678 mm · 568 L boot", safety: "6 Airbags · 5-Star Euro NCAP · 3D Surround Camera · Blind Spot Assist · Adaptive Cruise Control", features: "11.4\" Curved Floating Pivi Pro Glass · Deployable Flush Door Handles · Meridian 3D Sound · Windsor Leather · Panoramic Roof", warranty: "3 yrs / 100,000 km (Access Motors / Land Rover Sri Lanka)"},
  {id: "land-rover-range-rover-evoque-range-official", make: "Land Rover", model: "Range Rover Evoque", name: "Land Rover Range Rover Evoque", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L I3 MHEV (160 BHP)", km: "12.5 km/L", w: "Official", cond: "New", price: 48970000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.landrover.lk/stock-locator/new-vehicles/range-rover", sourceUrl: "https://www.landrover.lk/our-vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "S stock listing", priceVerifiedOn: "2026-10-21", power: "160 HP (118 kW)", torque: "260 Nm", transmission: "8-speed Automatic", drivetrain: "FWD / AWD", seats: 5, groundClearance: "212 mm · 530 mm wading", dimensions: "4,371 × 1,996 × 1,649 mm · 472 L boot", safety: "6 Airbags · 5-Star Euro NCAP · 3D Surround Camera w/ ClearSight Ground View · Driver Condition Monitor · Lane Keep Assist", features: "11.4\" Curved Glass Pivi Pro · Meridian Sound · Grained Leather Power Seats · Fixed Panoramic Roof · Pixel LED Headlights (Dynamic SE/Hoxton)", warranty: "3 yrs / 100,000 km (Access Motors / Land Rover Sri Lanka)"},
  {id: "land-rover-discovery-range-official", make: "Land Rover", model: "Discovery", name: "Land Rover Discovery", body: "SUV", trim: null, year: null, market: null, fuel: "Diesel", pt: "3.0L I6 MHEV · AWD", km: "10.5–12.8 km/L · 900 mm wading", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.landrover.lk/our-vehicles", sourceUrl: "https://www.landrover.lk/our-vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "300–360 HP", torque: "500–650 Nm · 3,500 kg towing", transmission: "8-speed ZF Automatic", drivetrain: "All-Wheel Drive w/ Twin-Speed Transfer Box & Air Suspension", seats: 7, groundClearance: "207–283 mm (Electronic Air)", dimensions: "4,956 × 2,073 × 1,888 mm · Full-Size 7-Seater SUV", safety: "8 Airbags · 5-Star Euro NCAP · 3D Surround Camera w/ ClearSight Ground View · Wade Sensing · Terrain Response 2", features: "11.4\" Pivi Pro · Intelligent Seat Fold (Power 7-Seat Layout) · Powered Inner Tailgate · Meridian Audio · Dual Sunroofs", warranty: "3 yrs / 100,000 km (Access Motors / Land Rover Sri Lanka)"},
  {id: "land-rover-discovery-sport-range-official", make: "Land Rover", model: "Discovery Sport", name: "Land Rover Discovery Sport", body: "SUV", trim: null, year: null, market: null, fuel: "PHEV", pt: "1.5L PHEV / 2.0L Turbo · AWD", km: "11.5–17.0 km/L · 600 mm wading", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.landrover.lk/our-vehicles", sourceUrl: "https://www.landrover.lk/our-vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "200–309 HP", torque: "320–540 Nm", transmission: "9-speed / 8-speed Automatic", drivetrain: "Active Driveline AWD w/ Terrain Response 2", seats: 7, groundClearance: "212 mm", dimensions: "4,597 × 2,069 × 1,727 mm · 5+2 Seater SUV", safety: "6 Airbags · 5-Star Euro NCAP · 3D Surround Camera · ClearSight Ground View & Interior Mirror · Adaptive Cruise", features: "11.4\" Curved Pivi Pro Touchscreen · Flexible 5+2 Seating · Fixed Panoramic Glass Roof · Wireless Charger · Meridian Sound", warranty: "3 yrs / 100,000 km (Access Motors / Land Rover Sri Lanka)"},
  {id: "land-rover-defender-range-official", make: "Land Rover", model: "Defender", name: "Land Rover Defender", body: "SUV", trim: null, year: null, market: null, fuel: "PHEV", pt: "2.0L Petrol PHEV (404 BHP) · AWD", km: "44 km EV · 13.0 km/L · 900 mm wading", w: "Official", cond: "New", price: 99720682, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.landrover.lk/stock-locator/new-vehicles/defender", sourceUrl: "https://www.landrover.lk/our-vehicles", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "110 X-Dynamic SE stock listing", priceVerifiedOn: "2026-10-21", power: "404 HP (297 kW) combined", torque: "640 Nm · 0–100 km/h in 5.6 s", transmission: "8-speed ZF Automatic w/ Twin-Speed Transfer Box", drivetrain: "Permanent 4WD w/ Terrain Response & Electronic Air Suspension", seats: 5, groundClearance: "218–291 mm (Electronic Air)", dimensions: "5,018 × 2,008 × 1,967 mm · Defender 110", safety: "6 Airbags · 5-Star Euro NCAP · 3D Surround Camera w/ ClearSight Ground View · Wade Sensing · Blind Spot Assist", features: "11.4\" Pivi Pro · Meridian Sound · Resist & Robustec X-Dynamic Interior · Sliding Panoramic Roof · Exposed Magnesium Cross-Car Beam", warranty: "3 yrs / 100,000 km (Access Motors / Land Rover Sri Lanka)"},
  {id: "mitsubishi-montero-sport-range-official", make: "Mitsubishi", model: "Montero Sport", name: "Mitsubishi Montero Sport", body: "SUV", trim: null, year: null, market: null, fuel: "Diesel", pt: "2.4L Turbo Diesel · Automatic", km: "11.2 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.unitedmotors.lk/personal/suvs/mitsubishi/montero-sport", sourceUrl: "https://www.unitedmotors.lk/personal/suvs/mitsubishi/montero-sport", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "181 HP (133 kW)", torque: "430 Nm", transmission: "8-speed Automatic w/ Sport Mode Paddle Shifters", drivetrain: "Super Select 4WD-II w/ Off-Road Modes & Rear Diff Lock", seats: 7, groundClearance: "218 mm · 700 mm wading", dimensions: "4,825 × 1,815 × 1,835 mm · 7-Seater Ladder-Frame SUV", safety: "7 Airbags · Forward Collision Mitigation · Blind Spot Warning w/ LCA · Ultrasonic Misacceleration Mitigation · 360° Camera", features: "8\" Smartphone-Link Display · 8\" LCD Digital Meter · Dual-Zone A/C w/ nanoe™ · Hands-Free Power Tailgate · Leather Power Seats", warranty: "3 yrs / 100,000 km (United Motors Sri Lanka)"},
  {id: "mitsubishi-destinator-range-official", make: "Mitsubishi", model: "Destinator", name: "Mitsubishi Destinator", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L 4B40 MIVEC Turbocharged Petrol · CVT w/ 5 Drive Modes", km: "14.8 km/L", w: "Official", cond: "New", price: 26250000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.mitsubishisl.lk/destinator", sourceUrl: "https://www.mitsubishisl.lk/destinator", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "correction", priceScope: "model", priceVerifiedOn: "2026-10-21", power: "163 HP (120 kW)", torque: "250 Nm", transmission: "CVT w/ 5 Drive Modes (Normal, Wet, Gravel, Tarmac, Mud)", drivetrain: "FWD w/ Active Yaw Control (AYC)", seats: 7, groundClearance: "244 mm (214 mm w/ undercover)", dimensions: "4,680 × 1,840 × 1,780 mm · 7-Seater SUV", safety: "6 Airbags · Diamond Sense ADAS (ACC, FCM, BSW, RCTA, AHB) · 360° Multi-Around Monitor", features: "12.3\" Smartphone-Link Display · 8\" Digital Driver Display · Dynamic Sound Yamaha Premium (8 speakers) · Panoramic Sunroof · Cool Box", warranty: "3 yrs / 100,000 km (United Motors / Mitsubishi Sri Lanka)"},
  {id: "mazda-cx-3-range-official", make: "Mazda", model: "CX-3", name: "Mazda CX-3", body: "SUV", trim: null, year: null, market: null, fuel: "Petrol", pt: "1.5L Skyactiv-G · 6AT", km: "16.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mazdalanka.lk/assets/Brochures/2025%20MAZDA%20CX-3%20SPEC%20-%201500CC.pdf", sourceUrl: "https://mazdalanka.lk/assets/Brochures/2025%20MAZDA%20CX-3%20SPEC%20-%201500CC.pdf", checkedOn: "2026-10-20", availability: "brochure-listed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "111 HP (82 kW)", torque: "144 Nm", transmission: "6-speed Automatic w/ Sport Mode", drivetrain: "FWD w/ G-Vectoring Control Plus", seats: 5, groundClearance: "160 mm", dimensions: "4,275 × 1,765 × 1,535 mm · 350 L boot", safety: "6 Airbags · i-Activsense (Smart Brake Support, Blind Spot Monitoring, RCTA, 360° View Monitor) · Head-Up Display", features: "8\" Mazda Connect w/ Wireless CarPlay · Bose 7-Speaker Audio · Electric Sunroof · Leather/Suede Seats · 18\" Alloy Wheels", warranty: "3 yrs / 100,000 km (Colonial Motors / Mazda Lanka)"},
  {id: "porsche-911-range-official", make: "Porsche", model: "911", name: "Porsche 911", body: "Passenger car", trim: null, year: null, market: null, fuel: "Petrol", pt: "3.0L Twin-Turbo Flat-6 · 8PDK", km: "9.8 km/L · 294 km/h top speed", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://models.porsche.com/en-LK/model-start/911", sourceUrl: "https://models.porsche.com/en-LK/model-start/911", checkedOn: "2026-10-20", availability: "configurator-listed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "394 HP (290 kW)", torque: "450 Nm · 0–100 km/h in 4.1 s (3.9 s Sport Chrono)", transmission: "8-speed Porsche Doppelkupplung (PDK)", drivetrain: "RWD", seats: 4, groundClearance: "122 mm", dimensions: "4,542 × 1,852 × 1,302 mm · Iconic Sports Coupe", safety: "Porsche Stability Management (PSM) · Porsche Wet Mode · Matrix LED Headlights · Warn & Brake Assist · 6 Airbags", features: "12.6\" Curved Digital Cluster · 10.9\" PCM Display · PASM Active Suspension · Sports Exhaust Option · Bose/Burmester Audio", warranty: "Official Porsche Configurator / Agent Order"},
  {id: "leapmotor-c10-reev-style-official", make: "Leapmotor", model: "C10 REEV", name: "Leapmotor C10 REEV Style", body: "SUV", trim: "Style", year: null, market: null, fuel: "PHEV", pt: "Range-extended plug-in hybrid (REEV)", km: "170 km pure EV (NEDC) · 1,150 km combined · 18 min DC fast charge", w: "Official", cond: "New", price: 22150000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://leapmotor.lk/", sourceUrl: "https://leapmotor.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "introductory", priceVerifiedOn: "2026-10-21", power: "215 HP (158 kW)", torque: "320 Nm", transmission: "Single-speed Electric Drive (REEV)", drivetrain: "RWD", seats: 5, groundClearance: "180 mm", dimensions: "4,739 × 1,900 × 1,680 mm · 435–1,410 L boot", safety: "7 Airbags · 5-Star Euro NCAP & ANCAP · 17 LEAP Pilot ADAS Functions · 360° Panoramic Camera · Cell-to-Chassis 2.0", features: "14.6\" 2.5K Central Screen · 10.25\" Cluster · Panoramic Glass Roof · 360° Camera · 17 ADAS Functions · 18\" Alloy Wheels · Power Front Seats", warranty: "Backed by Stellantis & Carmart Sri Lanka"},
  {id: "leapmotor-c10-reev-design-official", make: "Leapmotor", model: "C10 REEV", name: "Leapmotor C10 REEV Design", body: "SUV", trim: "Design", year: null, market: null, fuel: "PHEV", pt: "Range-extended plug-in hybrid (REEV)", km: "170 km pure EV (NEDC) · 1,150 km combined · 18 min DC fast charge", w: "Official", cond: "New", price: 22700000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://leapmotor.lk/", sourceUrl: "https://leapmotor.lk/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "introductory", priceVerifiedOn: "2026-10-21", power: "215 HP (158 kW)", torque: "320 Nm", transmission: "Single-speed Electric Drive (REEV)", drivetrain: "RWD", seats: 5, groundClearance: "180 mm", dimensions: "4,739 × 1,900 × 1,680 mm · 435–1,410 L boot", safety: "7 Airbags · 5-Star Euro NCAP & ANCAP · 17 LEAP Pilot ADAS Functions · 360° Panoramic Camera · Cell-to-Chassis 2.0", features: "OEKO-TEX® Silicon Leather w/ Heated & Ventilated Front Seats · Heated Steering Wheel · 20\" Trident Alloy Wheels · Power Tailgate · Multi-Colour Ambient Lighting · Privacy Glass", warranty: "Backed by Stellantis & Carmart Sri Lanka"},
  {id: "gac-aion-v-range-official", make: "GAC", model: "Aion V", name: "GAC Aion V", body: "SUV", trim: null, year: null, market: null, fuel: "BEV", pt: "150–165 kW Electric Motor · 62–75.3 kWh Magazine Battery 2.0", km: "520–650 km CLTC / 510 km WLTP · 15 min 370 km fast charge", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://motorguide.lk/en/reviews/cars/mg-s5-2025", sourceUrl: "https://gacsrilanka.com/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "wrong-source", priceScope: "unverified", power: "204–224 HP", torque: "240 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 5, groundClearance: "175 mm", dimensions: "4,605 × 1,854 × 1,686 mm · 427 L boot", safety: "7 Airbags (incl. 2.3m Side Curtain) · 5-Star Euro NCAP · ADiGO Pilot Level 2 ADAS · 360° Camera", features: "14.6\" Central Display · Built-in Console Refrigerator/Warmer (-15°C to 50°C) · 8-Point Massage Front Seats · Panoramic Roof", warranty: "Official Distributor Warranty (GAC Sri Lanka)"},
  {id: "gac-aion-es-range-official", make: "GAC", model: "Aion ES", name: "GAC Aion ES", body: "Passenger car", trim: null, year: null, market: null, fuel: "BEV", pt: "100 kW Electric Motor · 55.2 kWh Magazine LFP Battery", km: "442 km NEDC · 30–80% DC in 35 min", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://gacsrilanka.com/", sourceUrl: "https://gacsrilanka.com/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "136 HP (100 kW)", torque: "225 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 5, groundClearance: "145 mm", dimensions: "4,810 × 1,880 × 1,545 mm · 450 L boot · Executive EV Sedan", safety: "Dual/Side Airbags · ESP · Electronic Parking Brake w/ Auto Hold · TPMS · Rear Camera & Sensors", features: "8\" Touchscreen w/ CarPlay · Dual-Zone Auto Climate w/ Rear Vents · Leather Seats · Smart Key & Push Start · LED Headlamps", warranty: "Official Distributor Warranty (GAC Sri Lanka)"},
  {id: "gac-aion-ut-range-official", make: "GAC", model: "Aion UT", name: "GAC Aion UT", body: "Passenger car", trim: null, year: null, market: null, fuel: "BEV", pt: "100 kW Electric Motor · 44–60 kWh Magazine LFP Battery", km: "330–420 km WLTP · 24 min DC fast charge", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://gacsrilanka.com/", sourceUrl: "https://gacsrilanka.com/", checkedOn: "2026-10-20", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "unverified", power: "136 HP (100 kW)", torque: "176–210 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 5, groundClearance: "150 mm", dimensions: "4,270 × 1,850 × 1,575 mm · 440 L boot · Premium EV Hatchback", safety: "6 Airbags · Level 2 ADAS · 360° Surround Camera · Rollover Protection · Magazine Battery Safety", features: "14.6\" HD Central Screen + 8.8\" Cluster · Panoramic Canopy · Wireless CarPlay · V2L External Power · Power Tailgate", warranty: "Official Distributor Warranty (GAC Sri Lanka)"},
  {id: "toyota-alphard-range-official", make: "Toyota", model: "Alphard", name: "Toyota Alphard", body: "MPV", trim: null, year: null, market: null, fuel: null, pt: "2.5L A25A-FXS Hybrid / 2.4L Turbo · e-CVT / 8AT", km: "16.5–17.7 km/L (WLTC)", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/vehicle-model/alphard/", sourceUrl: "https://www.toyota.lk/vehicle-model/alphard/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", power: "250 HP (184 kW) combined", torque: "236 Nm + E-Four motors", transmission: "e-CVT / 8-speed AT", drivetrain: "FWD / E-Four AWD", seats: 7, groundClearance: "160 mm", dimensions: "4,995 × 1,850 × 1,935 mm · Luxury Executive MPV", safety: "Toyota Safety Sense 3.0 · Teammate Advanced Drive & Park · Safe Exit Assist · 8 Airbags", features: "Executive Lounge Ottoman Captain Chairs · Dual Detachable Rear Touch Controllers · 14\" Infotainment · Overhead Console", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-hiace-range-official", make: "Toyota", model: "Hiace", name: "Toyota Hiace", body: "Passenger van", trim: null, year: null, market: null, fuel: null, pt: "2.8L 1GD-FTV Turbo Diesel · 6AT / 6MT", km: "10.5–12.0 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/vehicle-model/hiace/", sourceUrl: "https://www.toyota.lk/vehicle-model/hiace/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", financeNote: "Passenger/B-class planning basis; confirm the registration class with your lender.", power: "177 HP (130 kW)", torque: "420–450 Nm", transmission: "6-speed Automatic / Manual", drivetrain: "RWD", seats: 14, groundClearance: "175 mm", dimensions: "5,265–5,915 × 1,950 × 1,990–2,280 mm · Commuter Van", safety: "Toyota Safety Sense · 3 Airbags · Vehicle Stability Control · Hill-Start Assist · Rear Parking Sensors", features: "Front & Rear Dual A/C w/ Individual Roof Vents · Reclining High-Back Seats · Sliding Door Step · Display Audio", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-coaster-range-official", make: "Toyota", model: "Coaster", name: "Toyota Coaster", body: "Minibus", trim: null, year: null, market: null, fuel: null, pt: "4.0L N04C-VL Turbo Diesel · 5MT / 6AT", km: "7.5–9.0 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/vehicle-model/coaster/", sourceUrl: "https://www.toyota.lk/vehicle-model/coaster/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", financeClass: "commercial", financeNote: "Commercial D-class planning basis; confirm registration class and lender valuation.", power: "150 HP (110 kW)", torque: "420 Nm", transmission: "5-speed Manual / 6AT", drivetrain: "RWD", seats: 29, groundClearance: "185 mm", dimensions: "6,990 × 2,080 × 2,635 mm · 29-Seater Minibus", safety: "High-Rigidity Ring Body Frame · ABS · VSC · Pre-Collision System · Emergency Exit Door", features: "Auto Folding Glide Door · Roof Ducted A/C · Microphone & PA System · High-Back Passenger Seating", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-hilux-2026-range-official", make: "Toyota", model: "Hilux 2026", name: "Toyota Hilux 2026", body: "Pickup", trim: null, year: null, market: null, fuel: null, pt: "2.8L 1GD-FTV 48V Mild-Hybrid Turbo Diesel · 6AT 4WD", km: "11.2–12.8 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/vehicle-model/hilux-2026/", sourceUrl: "https://www.toyota.lk/vehicle-model/hilux-2026/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", financeNote: "Passenger/B-class planning basis; confirm the registration class with your lender.", power: "204 HP (150 kW) + 16 HP MHEV", torque: "500 Nm + 65 Nm boost", transmission: "6-speed Automatic", drivetrain: "Part-Time 4WD w/ Rear Diff Lock", seats: 5, groundClearance: "310 mm", dimensions: "5,325 × 1,900 × 1,815 mm · Double Cab Pickup", safety: "7 SRS Airbags · Toyota Safety Sense (PCS, ACC, LDA) · Panoramic View Monitor · Downhill Assist Control", features: "8\" Touchscreen w/ Wireless CarPlay · Multi-Terrain Select · Dual-Zone Climate · Bi-LED Headlamps · Deck Bedliner", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "suzuki-ertiga-range-official", make: "Suzuki", model: "Ertiga", name: "Suzuki Ertiga", body: "MPV", trim: null, year: null, market: null, fuel: null, pt: "1.5L K15C Smart Hybrid Petrol · 6AT", km: "20.3 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.suzuki.lk/vehicles/", sourceUrl: "https://www.suzuki.lk/vehicles/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", power: "103 HP (75.8 kW)", torque: "136.8 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 7, groundClearance: "185 mm", dimensions: "4,395 × 1,735 × 1,690 mm · 7-Seater MPV (209–803 L)", safety: "4–6 Airbags · ESP · Hill Hold Assist · Rear Parking Camera & Sensors · ISOFIX", features: "7\" SmartPlay Pro · Roof-Mounted Rear A/C · Air-Cooled Cupholders · Reclining 2nd & 3rd Row · Cruise Control", warranty: "3 yrs / 100,000 km (AMW Suzuki)"},
  {id: "suzuki-xl6-range-official", make: "Suzuki", model: "XL6", name: "Suzuki XL6", body: "MPV", trim: null, year: null, market: null, fuel: null, pt: "1.5L K15C Smart Hybrid Petrol · 6AT", km: "20.27 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.suzuki.lk/vehicles/", sourceUrl: "https://www.suzuki.lk/vehicles/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", power: "103 HP (75.8 kW)", torque: "136.8 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 6, groundClearance: "185 mm", dimensions: "4,445 × 1,775 × 1,755 mm · 6-Seater Captain-Chair MPV", safety: "4–6 Airbags · 360° View Camera · TPMS · ESP · Hill Hold Assist", features: "Ventilated Front Seats · 2nd-Row Plush Captain Chairs · Quad-Chamber LED Headlamps · 7\" SmartPlay Pro · Roof Rails", warranty: "3 yrs / 100,000 km (AMW Suzuki)"},
  {id: "kia-carnival-range-official", make: "Kia", model: "Carnival", name: "Kia Carnival", body: "MPV", trim: null, year: null, market: null, fuel: null, pt: "2.2L Smartstream CRDi Diesel / 1.6T Hybrid · 8AT / 6AT", km: "13.5–14.5 km/L", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.kia.lk/carnival/", sourceUrl: "https://www.kia.lk/carnival/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", power: "202 HP (2.2D) / 245 HP (1.6T HEV)", torque: "440 Nm (2.2D) / 367 Nm (HEV)", transmission: "8-speed Automatic", drivetrain: "FWD", seats: 7, groundClearance: "172 mm", dimensions: "5,155 × 1,995 × 1,775 mm · Grand Luxury MPV", safety: "8 Airbags · Level 2 ADAS (23 features) · 360° Surround View · Safe Exit Assist · Head-Up Display", features: "2nd-Row VIP Relaxation Lounge Seats w/ Leg Support · Dual Sunroofs · Bose 12-Speaker Audio · Dual 12.3\" Curved Screens", warranty: "3 yrs / 100,000 km (Kia Sri Lanka)"},
  {id: "kia-carens-clavis-ev-range-official", make: "Kia", model: "Carens Clavis EV", name: "Kia Carens Clavis EV", body: "MPV", trim: null, year: null, market: null, fuel: "BEV", pt: "99–126 kW Electric Motor · 42–51.4 kWh Battery", km: "404–490 km MIDC/ARAi · DC Fast Charge", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.kia.lk/clavis/", sourceUrl: "https://www.kia.lk/clavis/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", power: "135–171 HP", torque: "255 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 7, groundClearance: "195 mm", dimensions: "4,540 × 1,800 × 1,708 mm · 3-Row Electric MPV", safety: "6 Airbags Standard · Level 2 ADAS (20 features) · 360° Camera · All-Wheel Disc Brakes · V2L", features: "Dual 12.25\" Panoramic Displays · Panoramic Sunroof · Ventilated Front Seats · Bose 8-Speaker Sound · One-Touch Tumble 2nd Row", warranty: "3 yrs / 100,000 km Vehicle · 8 yrs EV Battery (Kia Sri Lanka)"},
  {id: "kia-tasman-range-official", make: "Kia", model: "Tasman", name: "Kia Tasman", body: "Pickup", trim: null, year: null, market: null, fuel: null, pt: "2.2L CRDi Turbo Diesel / 2.5L Turbo Petrol · 8AT 4WD", km: "10.8 km/L · 3,500 kg towing", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.kia.lk/tasman/", sourceUrl: "https://www.kia.lk/tasman/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", financeNote: "Passenger/B-class planning basis; confirm the registration class with your lender.", power: "210 HP (2.2D) / 281 HP (2.5T)", torque: "441 Nm (2.2D) / 421 Nm (2.5T)", transmission: "8-speed Automatic", drivetrain: "4WD w/ Electronic Locking Rear Diff & X-Trek Mode", seats: 5, groundClearance: "224–252 mm", dimensions: "5,410 × 1,930 × 1,890 mm · Double Cab Pickup", safety: "7 Airbags · Ground View Monitor · Trailer Stability Assist · Level 2 Highway Driving Assist", features: "Panoramic Widescreen (12.3\" + 5\" + 12.3\") · Harman Kardon Audio · Folding Console Table · Reclining Rear Bench · Bed Corner Steps", warranty: "3 yrs / 100,000 km (Kia Sri Lanka)"},
  {id: "byd-m6-standard-captain-official", make: "BYD", model: "M6", name: "BYD M6 Standard Captain", body: "MPV", trim: "Standard Captain", year: null, market: null, fuel: "BEV", pt: "120–150 kW Electric Motor · 55.4–71.8 kWh Blade Battery", km: "420–530 km NEDC · DC Fast Charge", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-m6-standard-captain/", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-m6-standard-captain/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Standard Captain", power: "163–204 HP", torque: "310 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 6, groundClearance: "170 mm", dimensions: "4,710 × 1,810 × 1,690 mm · 6-Seater Captain-Chair MPV", safety: "6 Airbags · 360° Panoramic Camera · AEB · Adaptive Cruise · Lane Keep Assist · BSD", features: "2nd-Row Ventilated Captain Seats · 12.8\" Rotating Display · Panoramic Glass Roof · Power Tailgate · V2L Output", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-shark-6-premium-official", make: "BYD", model: "Shark 6", name: "BYD Shark 6 Premium", body: "Pickup", trim: "Premium", year: null, market: null, fuel: "PHEV", pt: "Plug-in hybrid · dual cab", km: "800 km NEDC combined · 100 km pure EV · 2,500 kg tow", w: "Official", cond: "New", price: 28350000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-shark-6-premium/", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-shark-6-premium/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Premium", priceVerifiedOn: "2026-10-21", financeNote: "Passenger/B-class planning basis; confirm the registration class with your lender.", power: "430 HP (321 kW) combined", torque: "650 Nm · 0–100 km/h in 5.7 s", transmission: "E-CVT DMO Off-Road Hybrid", drivetrain: "Dual-Motor Electric 4WD", seats: 5, groundClearance: "230 mm", dimensions: "5,457 × 1,971 × 1,925 mm · Dual Cab Pickup", safety: "7 Airbags · 5-Star ANCAP · 540° Transparent Chassis Camera · Head-Up Display · Full ADAS", features: "15.6\" Rotating Screen · 12-Speaker Dynaudio · 6 kW V2L Bed Outlets · Heated & Ventilated Seats · Double-Wishbone Suspension", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-racco-range-official", make: "BYD", model: "Racco", name: "BYD Racco", body: "Passenger car", trim: null, year: null, market: null, fuel: "BEV", pt: "Electric Urban Compact · BYD Blade Battery", km: "305–405 km CLTC/NEDC", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-racco/", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-racco/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", power: "75–95 HP", torque: "135–180 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,780 × 1,715 × 1,580 mm · Compact EV", safety: "6 Airbags · ESP · Rear Camera · Blade Battery Thermal Safety", features: "10.1\" Touchscreen · Smart Key & NFC Access · Digital Instrument Cluster · LED Lighting", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "perodua-alza-introductory-offer-official", make: "Perodua", model: "Alza", name: "Perodua Alza Introductory offer", body: "MPV", trim: "Introductory offer", year: null, market: null, fuel: null, pt: "1.5L 2NR-VE Dual VVT-i Petrol · D-CVT", km: "22.0 km/L", w: "Official", cond: "New", price: 19950000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.peroduasl.lk/", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Introductory offer", priceVerifiedOn: "2026-10-21", power: "105 HP (78 kW)", torque: "138 Nm", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 7, groundClearance: "160 mm", dimensions: "4,425 × 1,730 × 1,670 mm · 7-Seater DNGA MPV (137–498 L)", safety: "6 Airbags · 5-Star ASEAN NCAP · ASA 3.0 w/ Stop & Go ACC · 360° Panoramic View · Electronic Parking Brake w/ Auto Hold", features: "9\" Display Audio · 7\" Digital Cluster · Roof-Mounted Rear Blower · Sofa Mode Seating · LED Sequential Turn Signals", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "perodua-traz-without-body-kit-introductory-official", make: "Perodua", model: "Traz", name: "Perodua Traz Without body kit · introductory", body: "SUV", trim: "Without body kit · introductory", year: null, market: null, fuel: null, pt: "1.5L 2NR-VE Dual VVT-i Petrol · D-CVT", km: "21.3 km/L", w: "Official", cond: "New", price: 19200000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.peroduasl.lk/", sourceUrl: "https://www.peroduasl.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Without body kit · introductory", priceVerifiedOn: "2026-10-21", power: "105 HP (78 kW)", torque: "138 Nm", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "200 mm", dimensions: "4,320 × 1,770 × 1,620 mm · 471 L boot · DNGA B-SUV", safety: "6 Airbags · 5-Star ASEAN NCAP · Perodua Smart Drive Assist (AEB, ACC, LKC, BSM, RCTA) · 360° Panoramaview", features: "9\" Infotainment w/ CarPlay & Android Auto · 7\" Digital Cluster · Kick-Sensor Power Boot · Rear Air Vents · Optional GearUp Body Kit", warranty: "3 yrs / 100,000 km (Unimo / Perodua Sri Lanka)"},
  {id: "renault-triber-evolution-mt-official", make: "Renault", model: "Triber", name: "Renault Triber Evolution MT", body: "MPV", trim: "Evolution MT", year: null, market: null, fuel: null, pt: "1.0L Energy Petrol (72 HP) · 5-speed Manual", km: "18.2–19.0 km/L", w: "Official", cond: "New", price: 8190000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/", sourceUrl: "https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Evolution MT", priceVerifiedOn: "2026-10-21", power: "72 HP (53 kW)", torque: "96 Nm", transmission: "5-speed Manual (MT)", drivetrain: "FWD", seats: 7, groundClearance: "182 mm", dimensions: "3,990 × 1,739 × 1,643 mm · Modular 7-Seater (84–625 L boot)", safety: "4 Airbags · 4-Star Global NCAP · ESP · Hill Start Assist · Traction Control · TPMS · Rear Camera & Sensors", features: "EasyFix Modular 7-Seater · Twin A/C w/ 2nd & 3rd Row Vents · 8\" Touchscreen · Projector Headlamps · Rear Parking Sensors", warranty: "3 yrs / 100,000 km Bumper-to-Bumper (AMW Renault Sri Lanka)"},
  {id: "renault-triber-emotion-amt-official", make: "Renault", model: "Triber", name: "Renault Triber Emotion AMT", body: "MPV", trim: "Emotion AMT", year: null, market: null, fuel: null, pt: "1.0L Energy Petrol (72 HP) · 5-speed Easy-R AMT", km: "18.2–19.0 km/L", w: "Official", cond: "New", price: 9190000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/", sourceUrl: "https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Emotion AMT", priceVerifiedOn: "2026-10-21", power: "72 HP (53 kW)", torque: "96 Nm", transmission: "5-speed Easy-R AMT", drivetrain: "FWD", seats: 7, groundClearance: "182 mm", dimensions: "3,990 × 1,739 × 1,643 mm · Modular 7-Seater (84–625 L boot)", safety: "4 Airbags · 4-Star Global NCAP · ESP · Hill Start Assist · Traction Control · TPMS · Rear Camera & Sensors", features: "Easy-R AMT Gearbox · 7\" TFT Digital Cluster · Smart Access Card & Push Start · LED DRLs · Cooled Center Console · Rear Camera", warranty: "3 yrs / 100,000 km Bumper-to-Bumper (AMW Renault Sri Lanka)"},
  {id: "isuzu-d-max-range-official", make: "Isuzu", model: "D-Max", name: "Isuzu D-Max", body: "Pickup", trim: null, year: null, market: null, fuel: null, pt: "1.9L RZ4E-TC / 3.0L 4JJ3-TCX BluePower Turbo Diesel · 6AT 4WD", km: "12.5 km/L · 800 mm wading", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://sathosamotorsplc.com/d-max.php", sourceUrl: "https://sathosamotorsplc.com/d-max.php", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Quote required", financeNote: "Passenger/B-class planning basis; confirm the registration class with your lender.", power: "150 HP (1.9L) / 190 HP (3.0L)", torque: "350 Nm (1.9L) / 450 Nm (3.0L)", transmission: "6-speed Automatic / Manual", drivetrain: "Terrain Command 4WD w/ Rough Terrain Mode & Rear Diff Lock", seats: 5, groundClearance: "240 mm", dimensions: "5,280 × 1,870 × 1,790 mm · Double Cab Pickup", safety: "8 Airbags · 5-Star ASEAN NCAP · Stereo Camera ADAS · Blind Spot Monitoring · Trailer Sway Control", features: "9\" Touch Infotainment w/ Wireless CarPlay & Android Auto · 7\" Digital Cluster · Dual-Zone Climate · Bi-LED Projector Lamps", warranty: "3 yrs / 100,000 km (Sathosa Motors Sri Lanka)"},
  {id: "renault-kwid-climber-amt-official", make: "Renault", model: "Kwid", name: "Renault Kwid Climber AMT", body: "Passenger car", trim: "Climber AMT", year: 2026, market: "LK/IN", fuel: "Petrol", pt: "1.0L SCe Petrol · 5-speed Easy-R AMT", km: "22.0 km/L", w: "Official", cond: "New", price: 6990000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/", sourceUrl: "https://www.renault.lk/vehicles/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Climber AMT", priceVerifiedOn: "2026-10-21", power: "68 HP (50 kW)", torque: "91 Nm", transmission: "5-speed Easy-R Automated Manual (AMT)", drivetrain: "FWD", seats: 5, groundClearance: "184 mm", dimensions: "3,731 × 1,579 × 1,490 mm · 279 L boot", safety: "Dual Airbags · Electronic Stability Program (ESP) · Hill Start Assist · Traction Control · TPMS · Rear Camera", features: "Rotary Easy-R Gear Selector · Climber Dual-Tone Exterior & Orange Accents · 8\" MediaNAV · Rear Armrest · Skid Plates", warranty: "3 yrs / 100,000 km Bumper-to-Bumper (AMW Renault Sri Lanka)"},
  {id: "renault-kiger-tekno-amt-official", make: "Renault", model: "Kiger", name: "Renault Kiger Tekno AMT", body: "SUV", trim: "Tekno AMT", year: 2026, market: "LK/IN", fuel: "Petrol", pt: "1.0L Energy Petrol (72 HP) · 5-speed Easy-R AMT", km: "19.0 km/L", w: "Official", cond: "New", price: 8850000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/", sourceUrl: "https://www.renault.lk/vehicles/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Tekno AMT", priceVerifiedOn: "2026-10-21", power: "72 HP (53 kW)", torque: "96 Nm", transmission: "5-speed Easy-R AMT", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,991 × 1,750 × 1,605 mm · 405 L boot", safety: "4 Airbags · 4-Star Global NCAP · ESP · Hill Start Assist · Traction Control · TPMS · Rear View Camera", features: "Tri-Octa Pure Vision LED Headlamps · Wireless Smartphone Replication · Auto A/C · Smart Access Card · 16\" Styled Wheels", warranty: "3 yrs / 100,000 km Bumper-to-Bumper (AMW Renault Sri Lanka)"},
  {id: "renault-kiger-emotion-cvt-official", make: "Renault", model: "Kiger", name: "Renault Kiger Emotion Turbo CVT", body: "SUV", trim: "Emotion Turbo CVT", year: 2026, market: "LK/IN", fuel: "Petrol", pt: "1.0L Turbo Petrol (100 HP) · X-Tronic CVT", km: "18.2 km/L", w: "Official", cond: "New", price: 10590000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/", sourceUrl: "https://www.renault.lk/vehicles/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Emotion Turbo CVT", priceVerifiedOn: "2026-10-21", power: "100 HP (74 kW)", torque: "152 Nm", transmission: "X-Tronic CVT w/ Multi-Sense Modes", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,991 × 1,750 × 1,605 mm · 405 L boot", safety: "4 Airbags · 4-Star Global NCAP · ESP · Hill Start Assist · Traction Control · TPMS · Rear View Camera", features: "100 HP Turbo Engine · Multi-Sense Drive Modes (Eco/Normal/Sport) · Arkamys 3D 8-Speaker Audio · 7\" TFT Cluster · 16\" Diamond-Cut Alloys · Cruise Control", warranty: "3 yrs / 100,000 km Bumper-to-Bumper (AMW Renault Sri Lanka)"},
  {id: "byd-sealion-8-dynamic-official", make: "BYD", model: "Sealion 8", name: "BYD Sealion 8 Dynamic", body: "SUV", trim: "Dynamic", year: 2026, market: "Global", fuel: "PHEV", pt: "1.5T DM-i 7-Seater Plug-in Hybrid FWD · Blade Battery", km: "1,118 km NEDC combined · 30–80% DC in 21 min", w: "Official", cond: "New", price: 31850000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-sealion-8-dynamic/", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-sealion-8-dynamic/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Dynamic grade", priceVerifiedOn: "2026-10-21", power: "268 HP combined", torque: "315 Nm · 0–100 km/h in 8.6 s", transmission: "E-CVT Dedicated Hybrid", drivetrain: "FWD", seats: 7, groundClearance: "185 mm", dimensions: "4,975 × 1,960 × 1,745 mm · 7-Seater (up to 1,960 L cargo)", safety: "9 Airbags · DiSus-C Intelligent Damping · Full Level 2+ ADAS · 360° Camera · W-HUD", features: "7-Seater Luxury Cabin (1,960 L max cargo) · 15.6\" Rotating Screen · 9 Airbags · DiSus-C Damping · Panoramic Sunroof · Dynaudio Sound", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-atto-3-extended-official", make: "BYD", model: "ATTO 3", name: "BYD ATTO 3 Superior Extended Range", body: "SUV", trim: "Superior Extended Range (60.5 kWh)", year: 2025, market: "Global", fuel: "BEV", pt: "100 kW Permanent Magnet Synchronous · 60.48 kWh Blade Battery", km: "420 km WLTP", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-atto-3-advanced/", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-atto-3-advanced/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Superior Extended Range", power: "136 HP (Advanced) / 204 HP (Extended)", torque: "310 Nm", transmission: "Single-speed EV", drivetrain: "FWD", seats: 5, groundClearance: "175 mm", dimensions: "4,455 × 1,875 × 1,615 mm · 440 L boot", safety: "7 Airbags · 5-Star Euro NCAP · Full Level 2 ADAS (ACC, AEB, LKA, BSD, RCTA) · 360° Holographic Camera", features: "15.6\" Rotating Screen · Panoramic Sunroof · Dirac 8-Speaker Audio · Electric Tailgate · Multi-Colour Rhythm Ambient Lighting", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-seal-premium-official", make: "BYD", model: "Seal", name: "BYD Seal Premium Extended Range", body: "Passenger car", trim: "Premium (82.5 kWh RWD)", year: 2025, market: "Global", fuel: "BEV", pt: "230 kW Rear Motor · 82.5 kWh Blade Battery", km: "570 km WLTP", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-seal-dynamic/", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-seal-dynamic/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Premium RWD", power: "204 HP (Dynamic) / 313 HP (Premium) / 530 HP (AWD)", torque: "310 Nm / 360 Nm / 670 Nm", transmission: "Single-speed EV", drivetrain: "RWD / iTAC Dual-Motor AWD", seats: 5, groundClearance: "145 mm", dimensions: "4,800 × 1,875 × 1,460 mm · 400 L boot + 53 L frunk", safety: "9 Airbags · 5-Star Euro NCAP · Cell-to-Body (CTB) Chassis · Head-Up Display · Full ADAS · 360° Camera", features: "15.6\" Rotating Screen · 12-Speaker Dynaudio · Heated & Ventilated Nappa Leather Seats · Silver-Plated Panoramic Roof", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "byd-seal-performance-awd-official", make: "BYD", model: "Seal", name: "BYD Seal Performance AWD", body: "Passenger car", trim: "Performance AWD (82.5 kWh)", year: 2025, market: "Global", fuel: "BEV", pt: "390 kW Dual Motor AWD · 82.5 kWh Blade Battery", km: "520 km WLTP", w: "Official", cond: "New", price: null, priceBasis: "unpublished", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.johnkeellscgauto.com/product/byd-seal-dynamic/", sourceUrl: "https://www.johnkeellscgauto.com/product/byd-seal-dynamic/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "unverified", priceScope: "Performance AWD", power: "204 HP (Dynamic) / 313 HP (Premium) / 530 HP (AWD)", torque: "310 Nm / 360 Nm / 670 Nm", transmission: "Single-speed EV", drivetrain: "RWD / iTAC Dual-Motor AWD", seats: 5, groundClearance: "145 mm", dimensions: "4,800 × 1,875 × 1,460 mm · 400 L boot + 53 L frunk", safety: "9 Airbags · 5-Star Euro NCAP · Cell-to-Body (CTB) Chassis · Head-Up Display · Full ADAS · 360° Camera", features: "15.6\" Rotating Screen · 12-Speaker Dynaudio · Heated & Ventilated Nappa Leather Seats · Silver-Plated Panoramic Roof", warranty: "6 yrs / 150,000 km Vehicle · 8 yrs / 160,000 km Blade Battery (JKCG Auto)"},
  {id: "land-rover-range-rover-evoque-dynamic-se-official", make: "Land Rover", model: "Range Rover Evoque", name: "Land Rover Range Rover Evoque Dynamic SE", body: "SUV", trim: "Dynamic SE SWB P160", year: 2026, market: "UK/LK", fuel: "Petrol", pt: "1.5L 3-Cyl Turbo MHEV (160 BHP) · 8AT", km: "12.5 km/L", w: "Official", cond: "New", price: 51000000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://www.landrover.lk/stock-locator/new-vehicles/range-rover", sourceUrl: "https://www.landrover.lk/range-rover/range-rover-evoque/overview", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Dynamic SE stock listing", priceVerifiedOn: "2026-10-21", power: "160 HP (118 kW)", torque: "260 Nm", transmission: "8-speed Automatic", drivetrain: "FWD / AWD", seats: 5, groundClearance: "212 mm · 530 mm wading", dimensions: "4,371 × 1,996 × 1,649 mm · 472 L boot", safety: "6 Airbags · 5-Star Euro NCAP · 3D Surround Camera w/ ClearSight Ground View · Driver Condition Monitor · Lane Keep Assist", features: "11.4\" Curved Glass Pivi Pro · Meridian Sound · Grained Leather Power Seats · Fixed Panoramic Roof · Pixel LED Headlights (Dynamic SE/Hoxton)", warranty: "3 yrs / 100,000 km (Access Motors / Land Rover Sri Lanka)"},
  {id: "land-rover-range-rover-evoque-hoxton-official", make: "Land Rover", model: "Range Rover Evoque", name: "Land Rover Range Rover Evoque Hoxton Edition", body: "SUV", trim: "Hoxton Edition SWB P160", year: 2026, market: "UK/LK", fuel: "Petrol", pt: "1.5L 3-Cyl Turbo MHEV (160 BHP) · 8AT", km: "12.5 km/L", w: "Official", cond: "New", price: 55612504, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://www.landrover.lk/stock-locator/new-vehicles/range-rover", sourceUrl: "https://www.landrover.lk/range-rover/range-rover-evoque/overview", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Hoxton Edition stock listing", priceVerifiedOn: "2026-10-21", power: "160 HP (118 kW)", torque: "260 Nm", transmission: "8-speed Automatic", drivetrain: "FWD / AWD", seats: 5, groundClearance: "212 mm · 530 mm wading", dimensions: "4,371 × 1,996 × 1,649 mm · 472 L boot", safety: "6 Airbags · 5-Star Euro NCAP · 3D Surround Camera w/ ClearSight Ground View · Driver Condition Monitor · Lane Keep Assist", features: "11.4\" Curved Glass Pivi Pro · Meridian Sound · Grained Leather Power Seats · Fixed Panoramic Roof · Pixel LED Headlights (Dynamic SE/Hoxton)", warranty: "3 yrs / 100,000 km (Access Motors / Land Rover Sri Lanka)"},
  {id: "land-rover-defender-110-woolstone-official", make: "Land Rover", model: "Defender", name: "Land Rover Defender 110 X-Dynamic SE (Woolstone Green)", body: "SUV", trim: "110 X-Dynamic SE P400e PHEV (Woolstone Green)", year: 2026, market: "UK/LK", fuel: "PHEV", pt: "2.0L Turbo PHEV (404 BHP) · 8AT AWD", km: "44 km EV · 13.0 km/L", w: "Official", cond: "New", price: 101332924, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://www.landrover.lk/stock-locator/new-vehicles/defender", sourceUrl: "https://www.landrover.lk/defender/defender/overview", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "110 X-Dynamic SE Woolstone Green stock listing", priceVerifiedOn: "2026-10-21", power: "404 HP (297 kW) combined", torque: "640 Nm · 0–100 km/h in 5.6 s", transmission: "8-speed ZF Automatic w/ Twin-Speed Transfer Box", drivetrain: "Permanent 4WD w/ Terrain Response & Electronic Air Suspension", seats: 5, groundClearance: "218–291 mm (Electronic Air)", dimensions: "5,018 × 2,008 × 1,967 mm · Defender 110", safety: "6 Airbags · 5-Star Euro NCAP · 3D Surround Camera w/ ClearSight Ground View · Wade Sensing · Blind Spot Assist", features: "11.4\" Pivi Pro · Meridian Sound · Resist & Robustec X-Dynamic Interior · Sliding Panoramic Roof · Exposed Magnesium Cross-Car Beam", warranty: "3 yrs / 100,000 km (Access Motors / Land Rover Sri Lanka)"},
  {id: "kia-sonet-htx-plus-grey", make: "Kia", model: "Sonet", name: "Kia Sonet HTX Plus (2026)", body: "SUV", trim: "HTX Plus 1.0T DCT", year: 2026, market: "IN", fuel: "Petrol", pt: "1.0L T-GDI Turbo Petrol · 7DCT", km: "18.4 km/L", w: "Grey", cond: "New", price: 11450000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://cartivatemotors.lk/listing/kia-sonet-htx-plus-2026-white/", sourceUrl: "https://cartivatemotors.lk/listing/kia-sonet-htx-plus-2026-white/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "HTX Plus 2026 0 km listing", priceVerifiedOn: "2026-10-21", power: "120 HP (88 kW)", torque: "172 Nm", transmission: "7-speed Dual-Clutch (7DCT) w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,995 × 1,790 × 1,642 mm · 385 L boot", safety: "6 Airbags Standard · Level 1 ADAS (10 features on GTX+/X-Line) · 360° Camera · Blind View Monitor · All-Wheel Disc Brakes", features: "Dual 10.25\" Screens · Bose 7-Speaker Audio · Ventilated Front Seats · Electric Sunroof · Smart Air Purifier", warranty: "3 yrs / 100,000 km (Official) or Importer Warranty"},
  {id: "kia-sonet-gtx-plus-grey", make: "Kia", model: "Sonet", name: "Kia Sonet GTX Plus (2026)", body: "SUV", trim: "GTX Plus 1.0T DCT", year: 2026, market: "IN", fuel: "Petrol", pt: "1.0L T-GDI Turbo Petrol · 7DCT", km: "18.4 km/L", w: "Grey", cond: "New", price: 11950000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://cartivatemotors.lk/listing/kia-sonet-gtx-plus-brand-new-2026-grey/", sourceUrl: "https://cartivatemotors.lk/listing/kia-sonet-gtx-plus-brand-new-2026-grey/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "GTX Plus 2026 0 km listing", priceVerifiedOn: "2026-10-21", power: "120 HP (88 kW)", torque: "172 Nm", transmission: "7-speed Dual-Clutch (7DCT) w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,995 × 1,790 × 1,642 mm · 385 L boot", safety: "6 Airbags Standard · Level 1 ADAS (10 features on GTX+/X-Line) · 360° Camera · Blind View Monitor · All-Wheel Disc Brakes", features: "Dual 10.25\" Screens · Bose 7-Speaker Audio · Ventilated Front Seats · Electric Sunroof · Smart Air Purifier", warranty: "3 yrs / 100,000 km (Official) or Importer Warranty"},
  {id: "kia-sonet-x-line-grey", make: "Kia", model: "Sonet", name: "Kia Sonet X-Line Highest Spec (2026)", body: "SUV", trim: "X-Line 1.0T DCT", year: 2026, market: "IN", fuel: "Petrol", pt: "1.0L T-GDI Turbo Petrol · 7DCT", km: "18.4 km/L", w: "Grey", cond: "New", price: 12850000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://cartivatemotors.lk/listing/kia-sonet-x-line-highest-spec-2026/", sourceUrl: "https://cartivatemotors.lk/listing/kia-sonet-x-line-highest-spec-2026/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "X-Line 2026 0 km listing", priceVerifiedOn: "2026-10-21", power: "120 HP (88 kW)", torque: "172 Nm", transmission: "7-speed Dual-Clutch (7DCT) w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "205 mm", dimensions: "3,995 × 1,790 × 1,642 mm · 385 L boot", safety: "6 Airbags Standard · Level 1 ADAS (10 features on GTX+/X-Line) · 360° Camera · Blind View Monitor · All-Wheel Disc Brakes", features: "Dual 10.25\" Screens · Bose 7-Speaker Audio · Ventilated Front Seats · Electric Sunroof · Smart Air Purifier", warranty: "3 yrs / 100,000 km (Official) or Importer Warranty"},
  {id: "suzuki-fronx-alpha-at-grey", make: "Suzuki", model: "Fronx", name: "Suzuki Fronx Alpha AT (2026)", body: "SUV", trim: "Alpha 1.0T Smart Hybrid AT", year: 2026, market: "IN", fuel: "Petrol", pt: "1.0L Boosterjet Turbo MHEV · 6AT", km: "20.0 km/L", w: "Grey", cond: "New", price: 11350000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://cartivatemotors.lk/listing/suzuki-fronx-alpha-2026/", sourceUrl: "https://cartivatemotors.lk/listing/suzuki-fronx-alpha-2026/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Alpha 2026 0 km listing", priceVerifiedOn: "2026-10-21", power: "100 HP (73.6 kW)", torque: "147.6 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "190 mm", dimensions: "3,995 × 1,765 × 1,550 mm · 308 L boot", safety: "6 Airbags · 360° View Camera · Head-Up Display · ESP · Hill Hold Assist · ISOFIX", features: "9\" SmartPlay Pro+ HD · Wireless CarPlay & Android Auto · Wireless Charger · Arkamys Sound · 16\" Precision-Cut Alloys", warranty: "3 yrs / 100,000 km (AMW) or Importer Warranty"},
  {id: "suzuki-fronx-alpha-dualtone-grey", make: "Suzuki", model: "Fronx", name: "Suzuki Fronx Alpha Dual-Tone AT (2026)", body: "SUV", trim: "Alpha Dual-Tone 1.0T AT", year: 2026, market: "IN", fuel: "Petrol", pt: "1.0L Boosterjet Turbo MHEV · 6AT", km: "20.0 km/L", w: "Grey", cond: "New", price: 11475000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://cartivatemotors.lk/listing/suzuki-fronx-alpha-2026-silver-with-black-top/", sourceUrl: "https://cartivatemotors.lk/listing/suzuki-fronx-alpha-2026-silver-with-black-top/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Alpha Dual-Tone 2026 0 km listing", priceVerifiedOn: "2026-10-21", power: "100 HP (73.6 kW)", torque: "147.6 Nm", transmission: "6-speed Automatic w/ Paddle Shifters", drivetrain: "FWD", seats: 5, groundClearance: "190 mm", dimensions: "3,995 × 1,765 × 1,550 mm · 308 L boot", safety: "6 Airbags · 360° View Camera · Head-Up Display · ESP · Hill Hold Assist · ISOFIX", features: "9\" SmartPlay Pro+ HD · Wireless CarPlay & Android Auto · Wireless Charger · Arkamys Sound · 16\" Precision-Cut Alloys", warranty: "3 yrs / 100,000 km (AMW) or Importer Warranty"},
  {id: "suzuki-wagon-r-zl-new-grey", make: "Suzuki", model: "Wagon R", name: "Suzuki Wagon R ZL (2025)", body: "Passenger car", trim: "ZL", year: 2025, market: "JDM", fuel: "Petrol", pt: "660cc R06D Petrol · CVT", km: "25.2 km/L (WLTC)", w: "Grey", cond: "New", price: 7900000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "ZL 2025 0 km listing", priceVerifiedOn: "2026-10-21", power: "49 HP + 2.6 HP ISG motor", torque: "58 Nm + 40 Nm motor", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,650 mm · Kei Tall Wagon", safety: "Suzuki Safety Support (Dual Camera Brake Support, ACC, Lane Keep, Sign Recognition) · 6 Airbags · Head-Up Display", features: "Umbrella Holders in Rear Doors · Heated Driver/Passenger Seats · Keyless Push Start · Auto A/C · Sliding Rear Seats", warranty: "Importer Warranty"},
  {id: "suzuki-wagon-r-zx-new-grey", make: "Suzuki", model: "Wagon R", name: "Suzuki Wagon R ZX Hybrid (2025)", body: "Passenger car", trim: "ZX Hybrid", year: 2025, market: "JDM", fuel: "HEV", pt: "660cc R06D Mild Hybrid · CVT", km: "25.2 km/L (WLTC)", w: "Grey", cond: "New", price: 8650000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "ZX brand-new listing", priceVerifiedOn: "2026-10-21", power: "49 HP + 2.6 HP ISG motor", torque: "58 Nm + 40 Nm motor", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,650 mm · Kei Tall Wagon", safety: "Suzuki Safety Support (Dual Camera Brake Support, ACC, Lane Keep, Sign Recognition) · 6 Airbags · Head-Up Display", features: "Umbrella Holders in Rear Doors · Heated Driver/Passenger Seats · Keyless Push Start · Auto A/C · Sliding Rear Seats", warranty: "Importer Warranty"},
  {id: "suzuki-wagon-r-custom-z-upgrade-grey", make: "Suzuki", model: "Wagon R", name: "Suzuki Wagon R Custom Z Upgrade (2025)", body: "Passenger car", trim: "Custom Z Upgrade Package", year: 2025, market: "JDM", fuel: "HEV", pt: "660cc Mild Hybrid · CVT", km: "25.2 km/L (WLTC)", w: "Grey", cond: "New", price: 8500000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Custom Z Upgrade 2025 0 km listing", priceVerifiedOn: "2026-10-21", power: "49 HP + 2.6 HP ISG motor", torque: "58 Nm + 40 Nm motor", transmission: "CVT Automatic", drivetrain: "FWD", seats: 4, groundClearance: "150 mm", dimensions: "3,395 × 1,475 × 1,650 mm · Kei Tall Wagon", safety: "Suzuki Safety Support (Dual Camera Brake Support, ACC, Lane Keep, Sign Recognition) · 6 Airbags · Head-Up Display", features: "Umbrella Holders in Rear Doors · Heated Driver/Passenger Seats · Keyless Push Start · Auto A/C · Sliding Rear Seats", warranty: "Importer Warranty"},
  {id: "honda-vezel-e-hev-x-hunt-grey", make: "Honda", model: "Vezel e:HEV Z", name: "Honda Vezel e:HEV X HuNT Package (2025)", body: "SUV", trim: "e:HEV X HuNT Package", year: 2025, market: "JDM", fuel: "HEV", pt: "1.5L i-MMD e:HEV Strong Hybrid · e-CVT", km: "26.0 km/L (WLTC)", w: "Grey", cond: "New", price: 17100000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "e:HEV X HuNT 2025 0 km listing", priceVerifiedOn: "2026-10-21", power: "131 HP (96 kW) motor + 106 HP engine", torque: "253 Nm electric motor", transmission: "e-CVT Electric Coupled", drivetrain: "FWD / Real-Time AWD", seats: 5, groundClearance: "195 mm", dimensions: "4,330 × 1,790 × 1,590 mm · Magic Seats", safety: "Honda SENSING (CMBS, ACC w/ LSF, LKAS, BSM, Multi-View Camera) · 6 Airbags · Hill Descent Control", features: "9\" Honda CONNECT Display · Hands-Free Power Tailgate · Heated Steering & Front Seats · Breeze-Diffusion Air Vents · 18\" Alloys (Z/PLaY)", warranty: "Importer Powertrain & Hybrid Battery Warranty"},
  {id: "honda-vezel-e-hev-z-play-grey", make: "Honda", model: "Vezel e:HEV Z", name: "Honda Vezel e:HEV Z PLaY Package (2025)", body: "SUV", trim: "e:HEV Z PLaY Package", year: 2025, market: "JDM", fuel: "HEV", pt: "1.5L i-MMD e:HEV Strong Hybrid · e-CVT", km: "25.3 km/L (WLTC)", w: "Grey", cond: "New", price: 18900000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "e:HEV Z PLaY 2025 0 km listing", priceVerifiedOn: "2026-10-21", power: "131 HP (96 kW) motor + 106 HP engine", torque: "253 Nm electric motor", transmission: "e-CVT Electric Coupled", drivetrain: "FWD / Real-Time AWD", seats: 5, groundClearance: "195 mm", dimensions: "4,330 × 1,790 × 1,590 mm · Magic Seats", safety: "Honda SENSING (CMBS, ACC w/ LSF, LKAS, BSM, Multi-View Camera) · 6 Airbags · Hill Descent Control", features: "9\" Honda CONNECT Display · Hands-Free Power Tailgate · Heated Steering & Front Seats · Breeze-Diffusion Air Vents · 18\" Alloys (Z/PLaY)", warranty: "Importer Powertrain & Hybrid Battery Warranty"},
  {id: "honda-vezel-e-hev-z-play-moonroof-grey", make: "Honda", model: "Vezel e:HEV Z", name: "Honda Vezel e:HEV Z PLaY Moonroof (2025)", body: "SUV", trim: "e:HEV Z PLaY w/ Panoramic Moonroof", year: 2025, market: "JDM", fuel: "HEV", pt: "1.5L i-MMD e:HEV Strong Hybrid · e-CVT", km: "25.3 km/L (WLTC)", w: "Grey", cond: "New", price: 21900000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "e:HEV Z PLaY Moonroof 2025 0 km listing", priceVerifiedOn: "2026-10-21", power: "131 HP (96 kW) motor + 106 HP engine", torque: "253 Nm electric motor", transmission: "e-CVT Electric Coupled", drivetrain: "FWD / Real-Time AWD", seats: 5, groundClearance: "195 mm", dimensions: "4,330 × 1,790 × 1,590 mm · Magic Seats", safety: "Honda SENSING (CMBS, ACC w/ LSF, LKAS, BSM, Multi-View Camera) · 6 Airbags · Hill Descent Control", features: "9\" Honda CONNECT Display · Hands-Free Power Tailgate · Heated Steering & Front Seats · Breeze-Diffusion Air Vents · 18\" Alloys (Z/PLaY)", warranty: "Importer Powertrain & Hybrid Battery Warranty"},
  {id: "honda-vezel-e-hev-rs-premium-grey", make: "Honda", model: "Vezel e:HEV Z", name: "Honda Vezel e:HEV RS Premium (2025)", body: "SUV", trim: "e:HEV RS Premium", year: 2025, market: "JDM", fuel: "HEV", pt: "1.5L i-MMD e:HEV Strong Hybrid · e-CVT", km: "25.3 km/L (WLTC)", w: "Grey", cond: "New", price: 20900000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "e:HEV RS Premium 2025 0 km listing", priceVerifiedOn: "2026-10-21", power: "131 HP (96 kW) motor + 106 HP engine", torque: "253 Nm electric motor", transmission: "e-CVT Electric Coupled", drivetrain: "FWD / Real-Time AWD", seats: 5, groundClearance: "195 mm", dimensions: "4,330 × 1,790 × 1,590 mm · Magic Seats", safety: "Honda SENSING (CMBS, ACC w/ LSF, LKAS, BSM, Multi-View Camera) · 6 Airbags · Hill Descent Control", features: "9\" Honda CONNECT Display · Hands-Free Power Tailgate · Heated Steering & Front Seats · Breeze-Diffusion Air Vents · 18\" Alloys (Z/PLaY)", warranty: "Importer Powertrain & Hybrid Battery Warranty"},
  {id: "toyota-raize-z-petrol-2025-grey", make: "Toyota", model: "Raize", name: "Toyota Raize Z 1.2L Petrol (2025)", body: "SUV", trim: "Z 1.2L Petrol", year: 2025, market: "JDM", fuel: "Petrol", pt: "1.2L WA-VE Petrol · Dual-Mode CVT", km: "20.7 km/L (WLTC)", w: "Grey", cond: "New", price: 12500000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Raize Z 2025 0 km listing", priceVerifiedOn: "2026-10-21", power: "98 HP (1.0T) / 87 HP (1.2L)", torque: "140 Nm (1.0T) / 113 Nm (1.2L)", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "185–200 mm", dimensions: "3,995 × 1,695 × 1,620 mm · 369 L boot", safety: "6 Airbags · Smart Assist (AEB, ACC, Lane Keep, BSM, RCTA) · Corner Sensors", features: "9\" Smartphone-Link Display · 7\" TFT Digital Meter · Heated Front Seats (JDM) · 17\" Alloys · LED Sequential Lamps", warranty: "3 yrs / 100,000 km (Official) or Importer Warranty"},
  {id: "toyota-raize-z-petrol-2026-grey", make: "Toyota", model: "Raize", name: "Toyota Raize Z Brand New (2026)", body: "SUV", trim: "Z (2026)", year: 2026, market: "JDM", fuel: "Petrol", pt: "1.2L WA-VE Petrol · Dual-Mode CVT", km: "20.7 km/L (WLTC)", w: "Grey", cond: "New", price: 13650000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://cartivatemotors.lk/listing/toyota-raize-z-brand-new-2026/", sourceUrl: "https://cartivatemotors.lk/listing/toyota-raize-z-brand-new-2026/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Raize Z 2026 0 km listing", priceVerifiedOn: "2026-10-21", power: "98 HP (1.0T) / 87 HP (1.2L)", torque: "140 Nm (1.0T) / 113 Nm (1.2L)", transmission: "Dual-Mode CVT (D-CVT)", drivetrain: "FWD", seats: 5, groundClearance: "185–200 mm", dimensions: "3,995 × 1,695 × 1,620 mm · 369 L boot", safety: "6 Airbags · Smart Assist (AEB, ACC, Lane Keep, BSM, RCTA) · Corner Sensors", features: "9\" Smartphone-Link Display · 7\" TFT Digital Meter · Heated Front Seats (JDM) · 17\" Alloys · LED Sequential Lamps", warranty: "3 yrs / 100,000 km (Official) or Importer Warranty"},
  {id: "toyota-raize-hybrid-z-bodykit-grey", make: "Toyota", model: "Raize Hybrid Z", name: "Toyota Raize Hybrid Z BSM BodyKit (2026)", body: "SUV", trim: "Z Hybrid BSM BodyKit", year: 2026, market: "JDM", fuel: "HEV", pt: "1.2L e-SMART Series Hybrid · e-CVT", km: "28.0 km/L (WLTC)", w: "Grey", cond: "New", price: 14850000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://cartivatemotors.lk/listing/toyota-raize-z-hybrid-bsm-bodykit-2026/", sourceUrl: "https://cartivatemotors.lk/listing/toyota-raize-z-hybrid-bsm-bodykit-2026/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Raize Z Hybrid BSM BodyKit 2026 0 km listing", priceVerifiedOn: "2026-10-21", power: "106 HP (78 kW) electric drive motor", torque: "170 Nm electric motor", transmission: "e-SMART Electric Drive", drivetrain: "FWD", seats: 5, groundClearance: "185 mm", dimensions: "3,995 × 1,695 × 1,620 mm · 369 L boot", safety: "Smart Assist ADAS · Adaptive Cruise Control · Blind Spot Monitor (BSM) · 360° Panoramic View · 6 Airbags", features: "S-Pedal One-Pedal Drive · Electronic Parking Brake w/ Auto Hold · 9\" Display Audio · Full LED Adaptive Headlamps", warranty: "Importer Powertrain & Hybrid Battery Warranty"},
  {id: "toyota-land-cruiser-250-vx-grey", make: "Toyota", model: "Land Cruiser 250", name: "Toyota Land Cruiser 250 VX (2025 Grey Import)", body: "SUV", trim: "VX 2.7L (JDM 0 km)", year: 2025, market: "JDM", fuel: "Petrol", pt: "2.7L 2TR-FE Petrol · 6AT 4WD", km: "7.5 km/L (WLTC)", w: "Grey", cond: "New", price: 54000000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Land Cruiser Prado 250 2025 0 km listing", priceVerifiedOn: "2026-10-21", power: "204 HP (2.8D) / 163 HP (2.7P)", torque: "500 Nm (2.8D) / 246 Nm (2.7P)", transmission: "8-speed Direct Shift AT / 6AT", drivetrain: "Full-Time 4WD w/ Torsen LSD & Low Range", seats: 7, groundClearance: "221 mm", dimensions: "4,925 × 1,980 × 1,935 mm · 2,850 mm wheelbase", safety: "Toyota Safety Sense 3.0 · Multi-Terrain Monitor · Crawl Control · SDM Stabilizer Disconnect · 8 Airbags", features: "12.3\" Dual Screens · Heated & Ventilated Leather Seats · Tri-Zone Climate · Cool Box · Electric Tailgate", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "toyota-land-cruiser-300-zx-grey", make: "Toyota", model: "Land Cruiser 300", name: "Toyota Land Cruiser 300 ZX (2025 Grey Import)", body: "SUV", trim: "ZX 3.5L V6 Twin-Turbo (JDM 0 km)", year: 2025, market: "JDM", fuel: "Petrol", pt: "3.5L V6 Twin-Turbo · 10AT 4WD", km: "8.0 km/L (WLTC)", w: "Grey", cond: "New", price: 94000000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: "2026-10", priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-21", availability: "marketed", img: "", custom: false, priceVerification: "confirmed", priceScope: "Land Cruiser 300 ZX 2025 0 km listing", priceVerifiedOn: "2026-10-21", power: "409 HP (3.5T) / 304 HP (3.3D)", torque: "650 Nm (3.5T) / 700 Nm (3.3D)", transmission: "10-speed Direct Shift Automatic", drivetrain: "Full-Time 4WD w/ Front/Rear Diff Locks", seats: 7, groundClearance: "235 mm", dimensions: "4,985 × 1,980 × 1,945 mm · 2,850 mm wheelbase", safety: "Toyota Safety Sense · Fingerprint Start · 3D Multi-Terrain Monitor · E-KDSS Suspension · 10 Airbags", features: "12.3\" Infotainment · 14-Speaker JBL Audio · 4-Zone Climate · Rear Seat Entertainment · Power 3rd Row", warranty: "3 yrs / 100,000 km (Toyota Lanka)"},
  {id: "audi-q8", make: "Audi", model: "Q8", name: "Audi Q8", body: "SUV", trim: "55 TFSI Quattro", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 82000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.audi.lk/en/models/", sourceUrl: "https://www.audi.lk/en/models/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/audi-q8-63e9b81950c9-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "bmw-3-series", make: "BMW", model: "3 Series", name: "BMW 3 Series", body: "Passenger car", trim: "320i", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 42000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.bmw.lk/", sourceUrl: "https://www.bmw.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/bmw-3-series-84c48917bac6-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "bmw-5-series", make: "BMW", model: "5 Series", name: "BMW 5 Series", body: "Passenger car", trim: "520i", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 58000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.bmw.lk/", sourceUrl: "https://www.bmw.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/bmw-5-series-101ae94f8ee3-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "bmw-7-series", make: "BMW", model: "7 Series", name: "BMW 7 Series", body: "Passenger car", trim: "735i", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 130000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.bmw.lk/", sourceUrl: "https://www.bmw.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/bmw-7-series-8ce08c044e3b-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "bmw-x1", make: "BMW", model: "X1", name: "BMW X1", body: "SUV", trim: "sDrive18i", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 33500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.bmw.lk/", sourceUrl: "https://www.bmw.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/bmw-x1-bda39a02fbd1-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "bmw-x3", make: "BMW", model: "X3", name: "BMW X3", body: "SUV", trim: "20 xDrive", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 52000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.bmw.lk/", sourceUrl: "https://www.bmw.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/bmw-x3-b91ed10e79a4-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "bmw-x5", make: "BMW", model: "X5", name: "BMW X5", body: "SUV", trim: "xDrive40i", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 88000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.bmw.lk/", sourceUrl: "https://www.bmw.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/bmw-x5-c3d44acf6abd-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "bmw-i4", make: "BMW", model: "i4", name: "BMW i4", body: "Passenger car", trim: "eDrive40", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 49500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.bmw.lk/", sourceUrl: "https://www.bmw.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/bmw-i4-207e41844154-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "changan-cs55-plus", make: "Changan", model: "CS55 Plus", name: "Changan CS55 Plus", body: "SUV", trim: "Luxe 1.5T", year: 2026, fuel: "Petrol", pt: "CS55 Plus 1.5L Blue Core Turbo 7DCT Turbo", km: "", w: "Official", cond: "New", price: 14200000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.unitedmotors.lk/", sourceUrl: "https://www.unitedmotors.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/changan-cs55-plus-a9e90b0c519d-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "chery-jaecoo-j7", make: "Chery", model: "Jaecoo J7", name: "Chery Jaecoo J7", body: "SUV", trim: "All-Road AWD", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 18500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.cherysrilanka.lk/", sourceUrl: "https://www.cherysrilanka.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/chery-jaecoo-j7-6583ef518671-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "chery-omoda-5", make: "Chery", model: "Omoda 5", name: "Chery Omoda 5", body: "SUV", trim: "Elegance Turbo", year: 2026, fuel: "Petrol", pt: "Omoda 5 1.5L Turbo Elegance CVT Turbo", km: "", w: "Official", cond: "New", price: 15800000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.cherysrilanka.lk/", sourceUrl: "https://www.cherysrilanka.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/chery-omoda-5-a40ba4a83a5b-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "chery-tiggo-7-pro", make: "Chery", model: "Tiggo 7 Pro", name: "Chery Tiggo 7 Pro", body: "SUV", trim: "Executive", year: 2026, fuel: "Petrol", pt: "Tiggo 7 Pro 1.5L Turbo Executive CVT Turbo", km: "", w: "Official", cond: "New", price: 15500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.cherysrilanka.lk/", sourceUrl: "https://www.cherysrilanka.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/chery-tiggo-7-pro-816c91d2f683-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "chery-tiggo-8-pro-max", make: "Chery", model: "Tiggo 8 Pro Max", name: "Chery Tiggo 8 Pro Max", body: "SUV", trim: "Executive AWD 7S", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 22500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.cherysrilanka.lk/", sourceUrl: "https://www.cherysrilanka.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/chery-tiggo-8-pro-max-93d16c9d354e-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "dfsk-glory-580-pro", make: "DFSK", model: "Glory 580 Pro", name: "DFSK Glory 580 Pro", body: "SUV", trim: "Pro 7-Seater", year: 2026, fuel: "Petrol", pt: "Glory 580 Pro 1.5L Turbo Intelligent 7-Seater CVT Turbo", km: "", w: "Official", cond: "New", price: 13800000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.unitedmotors.lk/", sourceUrl: "https://www.unitedmotors.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/dfsk-glory-580-pro-f5f6d09a0e56-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "seres-5", make: "DFSK", model: "Seres 5", name: "DFSK Seres 5", body: "SUV", trim: "Performance AWD BEV", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 23500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.unitedmotors.lk/", sourceUrl: "https://www.unitedmotors.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/seres-5-e780be585390-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "daihatsu-cast", make: "Daihatsu", model: "Cast", name: "Daihatsu Cast", body: "Passenger car", trim: "Style G", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Grey", cond: "New", price: 6500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/daihatsu-cast-6adb49a42892-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "daihatsu-move-canbus", make: "Daihatsu", model: "Move Canbus", name: "Daihatsu Move Canbus", body: "Passenger car", trim: "Theory G", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Grey", cond: "New", price: 6900000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/daihatsu-move-canbus-986af5007620-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "daihatsu-rocky", make: "Daihatsu", model: "Rocky", name: "Daihatsu Rocky", body: "SUV", trim: "Premium G Hybrid", year: 2026, fuel: "HEV", pt: "HEV Powertrain", km: "", w: "Grey", cond: "New", price: 11500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/daihatsu-rocky-0fbbbee77daf-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "daihatsu-taft", make: "Daihatsu", model: "Taft", name: "Daihatsu Taft", body: "SUV", trim: "G Turbo 4WD", year: 2026, fuel: "Petrol", pt: "Taft G Turbo 660cc 4WD Turbo", km: "", w: "Grey", cond: "New", price: 7600000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/daihatsu-taft-f8b9dce4b143-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "daihatsu-tanto", make: "Daihatsu", model: "Tanto", name: "Daihatsu Tanto", body: "Passenger car", trim: "Custom RS", year: 2026, fuel: "Petrol", pt: "Tanto Custom RS 660cc Turbo Turbo", km: "", w: "Grey", cond: "New", price: 7200000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/daihatsu-tanto-7793c63e4fc0-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "deepal-l07", make: "Deepal", model: "L07", name: "Deepal L07", body: "Passenger car", trim: "Sports Fastback BEV", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Grey", cond: "New", price: 18700000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.unitedmotors.lk/", sourceUrl: "https://www.unitedmotors.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/deepal-l07-43175a042a1f-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "deepal-s07", make: "Deepal", model: "S07", name: "Deepal S07", body: "SUV", trim: "Long Range BEV", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Grey", cond: "New", price: 19000000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.unitedmotors.lk/", sourceUrl: "https://www.unitedmotors.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/deepal-s07-b7cb30895e66-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "ford-everest", make: "Ford", model: "Everest", name: "Ford Everest", body: "SUV", trim: "Titanium 4x4", year: 2026, fuel: "Diesel", pt: "Everest 2.0L Bi-Turbo Titanium 4x4 7-Seater Turbo", km: "", w: "Official", cond: "New", price: 46000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.ford.lk/suvs/everest/", sourceUrl: "https://www.ford.lk/suvs/everest/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/ford-everest-1c8b41c37702-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "ford-ranger", make: "Ford", model: "Ranger", name: "Ford Ranger", body: "Pickup", trim: "Wildtrak 4x4", year: 2026, fuel: "Diesel", pt: "Ranger Double Cab 2.0L Bi-Turbo Wildtrak 4x4 Turbo", km: "", w: "Official", cond: "New", price: 28500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.ford.lk/trucks/ranger/", sourceUrl: "https://www.ford.lk/trucks/ranger/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/ford-ranger-3938112bbb5c-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "gac-aion-y-plus", make: "GAC", model: "Aion Y Plus", name: "GAC Aion Y Plus", body: "SUV", trim: "Premium BEV", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 14500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://gacsrilanka.com/", sourceUrl: "https://gacsrilanka.com/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/gac-aion-y-plus-933d63dd1450-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "gac-emkoo", make: "GAC", model: "Emkoo", name: "GAC Emkoo", body: "SUV", trim: "GL Turbo AT", year: 2026, fuel: "Petrol", pt: "Emkoo 1.5L MegaWave Turbo GL AT Turbo", km: "", w: "Official", cond: "New", price: 16500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://gacsrilanka.com/", sourceUrl: "https://gacsrilanka.com/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/gac-emkoo-dd58f8bc31c1-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "gac-gs3-emzoom", make: "GAC", model: "GS3 Emzoom", name: "GAC GS3 Emzoom", body: "SUV", trim: "R-Style Turbo", year: 2026, fuel: "Petrol", pt: "GS3 Emzoom 1.5L Turbo R-Style 7WDCT Turbo", km: "", w: "Official", cond: "New", price: 14800000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://gacsrilanka.com/", sourceUrl: "https://gacsrilanka.com/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/gac-gs3-emzoom-7a2dd8efd2a9-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "gac-hyptec-ht", make: "GAC", model: "Hyptec HT", name: "GAC Hyptec HT", body: "SUV", trim: "Ultra Luxury BEV", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 26500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://gacsrilanka.com/", sourceUrl: "https://gacsrilanka.com/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/gac-hyptec-ht-4483384087ea-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "gwm-poer", make: "GWM", model: "Poer", name: "GWM Poer", body: "Pickup", trim: "Cannon 4WD", year: 2026, fuel: "Diesel", pt: "Poer Cannon Double Cab 2.0L Turbo Diesel 4WD Turbo", km: "", w: "Official", cond: "New", price: 19500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.gwmsrilanka.lk/vehicles/poer/", sourceUrl: "https://www.gwmsrilanka.lk/vehicles/poer/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/gwm-poer-92dfdaf3f1b7-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "geely-coolray", make: "Geely", model: "Coolray", name: "Geely Coolray", body: "SUV", trim: "Sport+ 1.5T", year: 2026, fuel: "Petrol", pt: "Coolray 1.5L Turbo Sport+ 7DCT Turbo", km: "", w: "Official", cond: "New", price: 15500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://microcars.lk/", sourceUrl: "https://microcars.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/geely-coolray-8f6a7b75ebb3-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "geely-monjaro", make: "Geely", model: "Monjaro", name: "Geely Monjaro", body: "SUV", trim: "Flagship AWD", year: 2026, fuel: "Petrol", pt: "Monjaro 2.0L Turbo Flagship AWD 8AT Turbo", km: "", w: "Official", cond: "New", price: 28500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://microcars.lk/", sourceUrl: "https://microcars.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/geely-monjaro-dbc23d527429-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "honda-cr-v", make: "Honda", model: "CR-V", name: "Honda CR-V", body: "SUV", trim: "1.5 Turbo AWD", year: 2026, fuel: "Petrol", pt: "CR-V 1.5L VTEC Turbo AWD Turbo", km: "", w: "Official", cond: "New", price: 39500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.honda.lk/automobiles/cr-v/", sourceUrl: "https://www.honda.lk/automobiles/cr-v/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/honda-cr-v-f54f1d0aa978-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "honda-civic", make: "Honda", model: "Civic", name: "Honda Civic", body: "Passenger car", trim: "RS Turbo", year: 2026, fuel: "Petrol", pt: "Civic 1.5L VTEC Turbo RS Turbo", km: "", w: "Official", cond: "New", price: 26000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.honda.lk/automobiles/civic/", sourceUrl: "https://www.honda.lk/automobiles/civic/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/honda-civic-b70bab3b22ca-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "honda-hr-v", make: "Honda", model: "HR-V", name: "Honda HR-V", body: "SUV", trim: "e:HEV RS", year: 2026, fuel: "HEV", pt: "HEV Powertrain", km: "", w: "Official", cond: "New", price: 24500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.honda.lk/automobiles/hr-v/", sourceUrl: "https://www.honda.lk/automobiles/hr-v/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/honda-hr-v-38703ede2533-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "honda-n-box", make: "Honda", model: "N-Box", name: "Honda N-Box Custom", body: "Passenger car", trim: "Custom Turbo", year: 2026, fuel: "Petrol", pt: "N-Box Custom 660cc Turbo Turbo", km: "", w: "Grey", cond: "Zero Mileage", price: 9800000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/honda-n-box-d66b774f4466-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "isuzu-mu-x", make: "Isuzu", model: "MU-X", name: "Isuzu MU-X", body: "SUV", trim: "Ultimate 4x4", year: 2026, fuel: "Diesel", pt: "Diesel Powertrain", km: "", w: "Official", cond: "New", price: 36000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://sathosamotorsplc.com/mu-x.php", sourceUrl: "https://sathosamotorsplc.com/mu-x.php", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/isuzu-mu-x-ef236895624d-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "jaguar-f-pace", make: "Jaguar", model: "F-Pace", name: "Jaguar F-Pace", body: "SUV", trim: "R-Dynamic S AWD", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 56000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.jaguar.lk/", sourceUrl: "https://www.jaguar.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/jaguar-f-pace-b526627f41d9-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "jaguar-i-pace", make: "Jaguar", model: "I-Pace", name: "Jaguar I-Pace", body: "SUV", trim: "EV400 HSE AWD", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 62000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.jaguar.lk/", sourceUrl: "https://www.jaguar.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/jaguar-i-pace-9cca3d315afa-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "jeep-grand-cherokee", make: "Jeep", model: "Grand Cherokee", name: "Jeep Grand Cherokee", body: "SUV", trim: "Limited 4xe", year: 2026, fuel: "PHEV", pt: "PHEV Powertrain", km: "", w: "Official", cond: "New", price: 68000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dimolanka.com/passenger-vehicles/jeep/", sourceUrl: "https://www.dimolanka.com/passenger-vehicles/jeep/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/jeep-grand-cherokee-13de46435470-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "jeep-wrangler-unlimited", make: "Jeep", model: "Wrangler Unlimited", name: "Jeep Wrangler Unlimited", body: "SUV", trim: "Rubicon", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 58000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dimolanka.com/passenger-vehicles/jeep/", sourceUrl: "https://www.dimolanka.com/passenger-vehicles/jeep/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/jeep-wrangler-unlimited-130012a2d040-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "kia-ev6", make: "Kia", model: "EV6", name: "Kia EV6", body: "SUV", trim: "GT-Line Long Range", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 43300000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.kia.lk/", sourceUrl: "https://www.kia.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/kia-ev6-1c32afb790da-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "leapmotor-b10", make: "Leapmotor", model: "B10", name: "Leapmotor B10", body: "SUV", trim: "Design BEV", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 14500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://leapmotor.lk/", sourceUrl: "https://leapmotor.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/leapmotor-b10-cc0369743087-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "leapmotor-c16", make: "Leapmotor", model: "C16", name: "Leapmotor C16", body: "SUV", trim: "Luxury BEV", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 24500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://leapmotor.lk/", sourceUrl: "https://leapmotor.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/leapmotor-c16-9b6b286a3a00-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "leapmotor-t03", make: "Leapmotor", model: "T03", name: "Leapmotor T03", body: "Passenger car", trim: "Smart BEV", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 7950000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://leapmotor.lk/", sourceUrl: "https://leapmotor.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/leapmotor-t03-afc9dce78329-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "lexus-lbx", make: "Lexus", model: "LBX", name: "Lexus LBX", body: "SUV", trim: "Relax E-Four", year: 2026, fuel: "HEV", pt: "HEV Powertrain", km: "", w: "Official", cond: "New", price: 32000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/lexus/lbx/", sourceUrl: "https://www.toyota.lk/lexus/lbx/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/lexus-lbx-4a6664bb6b36-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "lexus-lx", make: "Lexus", model: "LX", name: "Lexus LX", body: "SUV", trim: "LX 600 VIP", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 145000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/lexus/lx/", sourceUrl: "https://www.toyota.lk/lexus/lx/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/lexus-lx-39bc8914bf71-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "lexus-nx", make: "Lexus", model: "NX", name: "Lexus NX", body: "SUV", trim: "NX 350h Luxury", year: 2026, fuel: "HEV", pt: "HEV Powertrain", km: "", w: "Official", cond: "New", price: 58000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/lexus/nx/", sourceUrl: "https://www.toyota.lk/lexus/nx/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/lexus-nx-1c7e4a80409e-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "lexus-rx", make: "Lexus", model: "RX", name: "Lexus RX", body: "SUV", trim: "RX 350 Luxury", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 84000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/lexus/rx/", sourceUrl: "https://www.toyota.lk/lexus/rx/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/lexus-rx-4d7f050a5870-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mg-3-hybrid", make: "MG", model: "3 Hybrid+", name: "MG 3 Hybrid+", body: "Passenger car", trim: "Trophy Hybrid+", year: 2026, fuel: "HEV", pt: "HEV Powertrain", km: "", w: "Official", cond: "New", price: 8900000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mgsrilanka.lk/", sourceUrl: "https://mgsrilanka.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mg-3-hybrid-77e0b94f1718-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mg-cyberster", make: "MG", model: "Cyberster", name: "MG Cyberster", body: "Passenger car", trim: "AWD Roadster", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 38000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mgsrilanka.lk/", sourceUrl: "https://mgsrilanka.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mg-cyberster-909c883af7a8-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mg-whale", make: "MG", model: "Whale", name: "MG Whale", body: "SUV", trim: "Trophy 2.0T", year: 2026, fuel: "Petrol", pt: "Whale 2.0L Turbo Trophy 8AT Coupe SUV Turbo", km: "", w: "Official", cond: "New", price: 21000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mgsrilanka.lk/", sourceUrl: "https://mgsrilanka.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mg-whale-d59d241441b7-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mg-zs-ev", make: "MG", model: "ZS EV", name: "MG ZS EV", body: "SUV", trim: "Trophy Long Range", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 13500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mgsrilanka.lk/", sourceUrl: "https://mgsrilanka.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mg-zs-ev-2bfe81b3bd0c-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mini-cooper", make: "MINI", model: "Cooper", name: "MINI Cooper", body: "Passenger car", trim: "Cooper C 3-Door", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 26500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.mini.lk/", sourceUrl: "https://www.mini.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mini-cooper-c0c75203f3cb-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mini-countryman", make: "MINI", model: "Countryman", name: "MINI Countryman", body: "SUV", trim: "Countryman C", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 34000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.mini.lk/", sourceUrl: "https://www.mini.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mini-countryman-346b5632d743-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mahindra-bolero-camper", make: "Mahindra", model: "Bolero Camper", name: "Mahindra Bolero Camper", body: "Pickup", trim: "Camper Gold 4x4", year: 2026, fuel: "Diesel", pt: "Diesel Powertrain", km: "", w: "Official", cond: "New", price: 10500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mahindrasrilanka.lk/", sourceUrl: "https://mahindrasrilanka.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mahindra-bolero-camper-b167b6425187-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mahindra-bolero-maxx-pik-up", make: "Mahindra", model: "Bolero MaXX Pik-Up", name: "Mahindra Bolero MaXX Pik-Up", body: "Pickup", trim: "City 1.5T", year: 2026, fuel: "Diesel", pt: "Diesel Powertrain", km: "", w: "Official", cond: "New", price: 4911000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mahindrasrilanka.lk/", sourceUrl: "https://mahindrasrilanka.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mahindra-bolero-maxx-pik-up-a286d0689461-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mahindra-scorpio-n", make: "Mahindra", model: "Scorpio-N", name: "Mahindra Scorpio-N", body: "SUV", trim: "Z8L 4x4", year: 2026, fuel: "Diesel", pt: "Diesel Powertrain", km: "", w: "Grey", cond: "New", price: 29500000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/", sourceUrl: "https://cartivatemotors.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mahindra-scorpio-n-2a6477f945df-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "mahindra-thar", make: "Mahindra", model: "Thar", name: "Mahindra Thar", body: "SUV", trim: "LX 4x4", year: 2026, fuel: "Petrol", pt: "Thar 2.0L Turbo LX Hard Top 4x4 Turbo", km: "", w: "Grey", cond: "New", price: 24500000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/", sourceUrl: "https://cartivatemotors.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mahindra-thar-169044f1967d-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "mahindra-thar-roxx", make: "Mahindra", model: "Thar Roxx", name: "Mahindra Thar Roxx", body: "SUV", trim: "AX7L 4x4 5-Door", year: 2026, fuel: "Diesel", pt: "Diesel Powertrain", km: "", w: "Grey", cond: "Zero Mileage", price: 31000000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cartivatemotors.lk/", sourceUrl: "https://cartivatemotors.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mahindra-thar-roxx-3965857b5a14-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "mazda-bt-50", make: "Mazda", model: "BT-50", name: "Mazda BT-50", body: "Pickup", trim: "SP 4x4", year: 2026, fuel: "Diesel", pt: "Diesel Powertrain", km: "", w: "Official", cond: "New", price: 25000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mazdalanka.lk/mazda-bt-50/", sourceUrl: "https://mazdalanka.lk/mazda-bt-50/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mazda-bt-50-140dee4de3f6-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mazda-cx-30", make: "Mazda", model: "CX-30", name: "Mazda CX-30", body: "SUV", trim: "2.0 High", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 26500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mazdalanka.lk/mazda-cx-30/", sourceUrl: "https://mazdalanka.lk/mazda-cx-30/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mazda-cx-30-c7a759897378-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mazda-cx-5", make: "Mazda", model: "CX-5", name: "Mazda CX-5", body: "SUV", trim: "2.0 AWD", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 34000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mazdalanka.lk/mazda-cx-5/", sourceUrl: "https://mazdalanka.lk/mazda-cx-5/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mazda-cx-5-3f9a2f073e57-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mazda-cx-60", make: "Mazda", model: "CX-60", name: "Mazda CX-60", body: "SUV", trim: "PHEV AWD", year: 2026, fuel: "PHEV", pt: "PHEV Powertrain", km: "", w: "Official", cond: "New", price: 54000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://mazdalanka.lk/mazda-cx-60/", sourceUrl: "https://mazdalanka.lk/mazda-cx-60/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mazda-cx-60-62492c9f6c13-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mercedes-benz-a-class", make: "Mercedes-Benz", model: "A-Class", name: "Mercedes-Benz A-Class", body: "Passenger car", trim: "A200", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 29500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", sourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mercedes-benz-a-class-9717e40e108d-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mercedes-benz-c-class", make: "Mercedes-Benz", model: "C-Class", name: "Mercedes-Benz C-Class", body: "Passenger car", trim: "C200", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 44000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", sourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mercedes-benz-c-class-8807820a06e8-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mercedes-benz-gla", make: "Mercedes-Benz", model: "GLA", name: "Mercedes-Benz GLA", body: "SUV", trim: "GLA200", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 32500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", sourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mercedes-benz-gla-f838854e6e71-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mercedes-benz-glc", make: "Mercedes-Benz", model: "GLC", name: "Mercedes-Benz GLC", body: "SUV", trim: "GLC300", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 54000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", sourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mercedes-benz-glc-7a51e0d694cd-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mercedes-benz-gle", make: "Mercedes-Benz", model: "GLE", name: "Mercedes-Benz GLE", body: "SUV", trim: "GLE450", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 89000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", sourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mercedes-benz-gle-ae4471d0dc07-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mercedes-benz-s-class", make: "Mercedes-Benz", model: "S-Class", name: "Mercedes-Benz S-Class", body: "Passenger car", trim: "S450", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 135000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", sourceUrl: "https://www.dimolanka.com/passenger-vehicles/mercedes-benz/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mercedes-benz-s-class-bd2a5095fa28-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "micro-baic-bj30-hybrid", make: "Micro", model: "BAIC BJ30 Hybrid", name: "Micro BAIC BJ30 Hybrid", body: "SUV", trim: "Magic Core HEV", year: 2026, fuel: "HEV", pt: "HEV Powertrain", km: "", w: "Official", cond: "New", price: 20000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://microcars.lk/", sourceUrl: "https://microcars.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/micro-baic-bj30-hybrid-76641fde835a-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "micro-baic-x3e-electric", make: "Micro", model: "BAIC X3e Electric", name: "Micro BAIC X3e Electric", body: "SUV", trim: "Electric EV", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 17900000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://microcars.lk/", sourceUrl: "https://microcars.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/micro-baic-x3e-electric-347d2fb41fdb-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "micro-tivoli", make: "Micro", model: "Tivoli", name: "Micro Tivoli", body: "SUV", trim: "1.6 AT", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 16500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://microcars.lk/", sourceUrl: "https://microcars.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/micro-tivoli-102a8492b2cb-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mitsubishi-eclipse-cross", make: "Mitsubishi", model: "Eclipse Cross", name: "Mitsubishi Eclipse Cross", body: "SUV", trim: "GLS AWD", year: 2026, fuel: "Petrol", pt: "Eclipse Cross 1.5L Turbo GLS AWD Turbo", km: "", w: "Official", cond: "New", price: 21500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.unitedmotors.lk/personal/suvs/mitsubishi/eclipse-cross", sourceUrl: "https://www.unitedmotors.lk/personal/suvs/mitsubishi/eclipse-cross", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mitsubishi-eclipse-cross-1cd30a37740c-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mitsubishi-triton", make: "Mitsubishi", model: "Triton", name: "Mitsubishi Triton", body: "Pickup", trim: "Athlete 4WD", year: 2026, fuel: "Diesel", pt: "Diesel Powertrain", km: "", w: "Official", cond: "New", price: 25500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.unitedmotors.lk/personal/pickups/mitsubishi/triton", sourceUrl: "https://www.unitedmotors.lk/personal/pickups/mitsubishi/triton", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mitsubishi-triton-dcd73de64dbf-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "mitsubishi-xforce", make: "Mitsubishi", model: "Xforce", name: "Mitsubishi Xforce", body: "SUV", trim: "Ultimate", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 16800000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.mitsubishisl.lk/xforce", sourceUrl: "https://www.mitsubishisl.lk/xforce", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/mitsubishi-xforce-03e0728142e0-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "nissan-gravite", make: "Nissan", model: "Gravite", name: "Nissan Gravite", body: "MPV", trim: "Visia", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 7490000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.nissanlk.com/", sourceUrl: "https://www.nissanlk.com/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/nissan-gravite-cb2b0aca03d6-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "nissan-kicks", make: "Nissan", model: "Kicks", name: "Nissan Kicks", body: "SUV", trim: "e-POWER Premium", year: 2026, fuel: "HEV", pt: "HEV Powertrain", km: "", w: "Official", cond: "New", price: 16500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.nissanlk.com/nissan-kicks/", sourceUrl: "https://www.nissanlk.com/nissan-kicks/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/nissan-kicks-6620aa07057b-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "nissan-navara", make: "Nissan", model: "Navara", name: "Nissan Navara", body: "Pickup", trim: "PRO-4X 4WD", year: 2026, fuel: "Diesel", pt: "Diesel Powertrain", km: "", w: "Official", cond: "New", price: 26500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.nissanlk.com/nissan-navara/", sourceUrl: "https://www.nissanlk.com/nissan-navara/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/nissan-navara-041f65aa8755-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "nissan-patrol", make: "Nissan", model: "Patrol", name: "Nissan Patrol", body: "SUV", trim: "Titanium V8", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 85000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.nissanlk.com/nissan-patrol/", sourceUrl: "https://www.nissanlk.com/nissan-patrol/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/nissan-patrol-7489b96bc359-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "nissan-tekton", make: "Nissan", model: "Tekton", name: "Nissan Tekton", body: "SUV", trim: "1.3L Turbo DCT", year: 2026, fuel: "Petrol", pt: "Tekton 1.3L Turbo T280 GDi DCT Turbo", km: "", w: "Official", cond: "New", price: 20100000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.nissanlk.com/", sourceUrl: "https://www.nissanlk.com/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/nissan-tekton-33b9835d84d3-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "renault-captur", make: "Renault", model: "Captur", name: "Renault Captur", body: "SUV", trim: "Intens EDC", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 15000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.renault.lk/vehicles/", sourceUrl: "https://www.renault.lk/vehicles/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/renault-captur-97539318b398-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "renault-duster", make: "Renault", model: "Duster", name: "Renault Duster", body: "SUV", trim: "TCe 130 4x4", year: 2026, fuel: "Petrol", pt: "Duster 1.3L Turbo TCe 130 4x4 Turbo", km: "", w: "Official", cond: "New", price: 16500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.renault.lk/vehicles/", sourceUrl: "https://www.renault.lk/vehicles/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/renault-duster-57034d050190-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "suzuki-spacia", make: "Suzuki", model: "Spacia", name: "Suzuki Spacia Custom Hybrid", body: "Passenger car", trim: "Custom Hybrid XS", year: 2026, fuel: "HEV", pt: "HEV Powertrain", km: "", w: "Grey", cond: "Zero Mileage", price: 9500000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/suzuki-spacia-00afa908e7ed-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "tata-curvv-ev", make: "Tata", model: "Curvv.ev", name: "Tata Curvv.ev", body: "SUV", trim: "Empowered+ 55", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 18750000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dimolanka.com/", sourceUrl: "https://www.dimolanka.com/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/tata-curvv-ev-d7544752f38a-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "tata-punch-ev", make: "Tata", model: "Punch.ev", name: "Tata Punch.ev", body: "SUV", trim: "Empowered+ S LR", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 12400000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.dimolanka.com/", sourceUrl: "https://www.dimolanka.com/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/tata-punch-ev-57c049dac281-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "tata-yodha", make: "Tata", model: "Yodha", name: "Tata Yodha", body: "Pickup", trim: "Crew Cab 4x4", year: 2026, fuel: "Diesel", pt: "Diesel Powertrain", km: "", w: "Official", cond: "New", price: 12500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://cars.tatamotors.lk/", sourceUrl: "https://cars.tatamotors.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/tata-yodha-a2e8d034316a-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "toyota-land-cruiser-70", make: "Toyota", model: "Land Cruiser 70", name: "Toyota Land Cruiser 70", body: "SUV", trim: "LC76 4x4", year: 2026, fuel: "Diesel", pt: "Land Cruiser 70 Series LC76 2.8L Turbo Diesel 4x4 Turbo", km: "", w: "Official", cond: "New", price: 48000000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.toyota.lk/vehicles/land-cruiser-70/", sourceUrl: "https://www.toyota.lk/vehicles/land-cruiser-70/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/toyota-land-cruiser-70-b1c889e0f2df-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "toyota-roomy", make: "Toyota", model: "Roomy", name: "Toyota Roomy", body: "Passenger car", trim: "Custom G-T 1.0L Turbo", year: 2026, fuel: "Petrol", pt: "Roomy Custom G-T 1.0L Turbo Turbo", km: "", w: "Grey", cond: "Zero Mileage", price: 9500000, priceBasis: "published", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://importcar.lk/", sourceUrl: "https://importcar.lk/", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/toyota-roomy-38e45c321138-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Importer / Seller Warranty"},
  {id: "volkswagen-id-4", make: "Volkswagen", model: "ID.4", name: "Volkswagen ID.4", body: "SUV", trim: "Pro EV", year: 2026, fuel: "BEV", pt: "BEV Powertrain", km: "", w: "Official", cond: "New", price: 29500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.volkswagen.lk/en/models.html", sourceUrl: "https://www.volkswagen.lk/en/models.html", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/volkswagen-id-4-dc9309e595cb-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"},
  {id: "volkswagen-tiguan", make: "Volkswagen", model: "Tiguan", name: "Volkswagen Tiguan", body: "SUV", trim: "2.0 TSI Elegance", year: 2026, fuel: "Petrol", pt: "Petrol Powertrain", km: "", w: "Official", cond: "New", price: 34500000, priceBasis: "estimated", priceCheckedMonth: "2026-10", pricePublishedMonth: null, priceSourceUrl: "https://www.volkswagen.lk/en/models.html", sourceUrl: "https://www.volkswagen.lk/en/models.html", checkedOn: "2026-10-23", availability: "marketed", img: "assets/images/curated-catalogue/volkswagen-tiguan-8f717cc64de6-640.webp", custom: false, priceVerification: "confirmed", priceScope: "model", priceVerifiedOn: "2026-10-23", power: "", torque: "", transmission: "", drivetrain: "FWD", seats: 5, groundClearance: "", dimensions: "", safety: "", features: "", warranty: "Official Agent Warranty"}
];

  __exports.catalogMeta = catalogMeta;
  __exports.baseVehicles = baseVehicles;
  })(__mods.mod_6_market_catalogue);

  // === vehicle-validation.js ===
  __mods.mod_7_vehicle_validation = {};
  (function(__exports) {
// All vehicle-entry paths use the same price boundary, including saved records.
const validPrice = price => typeof price === "number" && Number.isFinite(price) && price > 0 && price < 1e15;

function vehicleBatchError(vehicles) {
  if (!Array.isArray(vehicles) || !vehicles.length) return "Select at least one vehicle to add.";
  for (const vehicle of vehicles) {
    if (!vehicle || typeof vehicle.name !== "string" || !vehicle.name.trim()) return "Enter a vehicle name.";
    if (vehicle.name.trim().length > 200) return "Keep vehicle names to 200 characters or fewer.";
    if (!validPrice(vehicle.price)) return `Enter a valid price greater than zero for ${vehicle.name}. No vehicles were added.`;
  }
  return "";
}

function conditionPrice(trim, condition, sellerPrice) {
  const price = condition === "seller_price" ? sellerPrice : trim?.condition_prices?.[condition];
  return validPrice(price) ? price : NaN;
}

const expectsComparison = query => /\b(?:compar(?:e|ing|ison)|versus|vs\.?|alternatives)\b/i.test(query);

function validateSearchResponse(data, query) {
  if (!data || typeof data !== "object" || typeof data.is_available_in_sri_lanka !== "boolean") {
    throw new Error("AI returned an incomplete vehicle result. Please search again.");
  }
  const vehicles = Array.isArray(data.discovered_vehicles) ? data.discovered_vehicles : [];
  if (expectsComparison(query) || data.is_multi_vehicle) {
    const variants = new Set(String(query).match(/\b(?:19|20)\d{2}\b/g) || []).size > 1 || /\b(?:trims?|grades?|variants?)\b/i.test(query);
    const models = new Set(vehicles.filter(v => typeof v.model_name === "string" && v.model_name.trim())
      .map(v => (v.model_name.trim() + (variants ? `|${v.year}|${v.trim_name}` : "")).toLowerCase()));
    if (models.size < 2) {
      const error = new Error("AI did not return a complete comparison. Please search again or add each vehicle separately.");
      error.code = "incomplete_comparison";
      throw error;
    }
    const error = vehicleBatchError(vehicles.map(v => ({ name: v.model_name, price: v.price_lkr })));
    if (error) throw new Error(error);
    return { ...data, is_multi_vehicle: true };
  }
  if (data.is_available_in_sri_lanka && (typeof data.model_name !== "string" || !data.model_name.trim() ||
      !Array.isArray(data.model_years) || !data.model_years.length ||
      !data.model_years.every(y => y && Number.isInteger(Number(y.year)) && Array.isArray(y.trims) && y.trims.length))) {
    throw new Error("AI returned no model years or trims. Please search again or enter the vehicle manually.");
  }
  return data;
}

  __exports.vehicleBatchError = vehicleBatchError;
  __exports.conditionPrice = conditionPrice;
  __exports.validateSearchResponse = validateSearchResponse;
  __exports.validPrice = validPrice;
  __exports.expectsComparison = expectsComparison;
  })(__mods.mod_7_vehicle_validation);

  // === config.js ===
  __mods.mod_9_config = {};
  (function(__exports) {
// VahanaIQ Platform Configuration
// -------------------------------------------------------------
// AI vehicle search goes through a serverless proxy (see /serverless) that
// holds the Gemini API key and model choice, so no key is ever in the browser.
const APP_VERSION = "2.11.5";

const config = {
  proxyUrl: "https://vahanaiq-search-71962876227.asia-south1.run.app"
};

// Google sign-in and sync (js/account.js). This web config is public by design: Firebase
// identifies the project with it, and firestore.rules decide who can read or write what.
const firebaseConfig = {
  apiKey: "AIzaSyB7y80tXqmjxVf_jy9SOTo2x_yXWYhVquU",
  authDomain: "vahanaiq-sign-in.firebaseapp.com",
  projectId: "vahanaiq-sign-in",
  storageBucket: "vahanaiq-sign-in.firebasestorage.app",
  messagingSenderId: "376324722920",
  appId: "1:376324722920:web:c20f16fe322420ecfaf95d"
};

// Google's own sign-in button (Google Identity Services) for the project's web OAuth client.
// Firebase's sign-in pop-up stalls in Safari, which blocks the cross-site storage it relies on;
// this button hands an ID token straight to the page, and Firebase signs in with it.
const GOOGLE_CLIENT_ID = "376324722920-0btrupeuvlepdl7rtsckljq8g3fftpq8.apps.googleusercontent.com";
const GOOGLE_SIGN_IN_SRC = "https://accounts.google.com/gsi/client?hl=en";

// Firebase's modular SDK, loaded from Google's CDN only when someone signs in
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/12.19.0";

  __exports.APP_VERSION = APP_VERSION;
  __exports.config = config;
  __exports.firebaseConfig = firebaseConfig;
  __exports.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
  __exports.GOOGLE_SIGN_IN_SRC = GOOGLE_SIGN_IN_SRC;
  __exports.FIREBASE_SDK = FIREBASE_SDK;
  })(__mods.mod_9_config);

  // === storage.js ===
  __mods.mod_8_storage = {};
  (function(__exports) {
// Storage helpers
const {  config  } = __mods.mod_9_config;
const {  vehicleBatchError  } = __mods.mod_7_vehicle_validation;
const getProxyUrl = () => config.proxyUrl || "";

// Tells the account sync (js/account.js) that this browser's saved inputs or vehicles changed
const SAVED_EVENT = "vahanaiq:saved";
function notifySaved() {
  try { window.dispatchEvent(new Event(SAVED_EVENT)); } catch (e) {}
}

// Earlier versions stored a personal Gemini key, a proxy override and a cached model name.
// None of these are used any more, so remove them from the browser.
function clearLegacyKeys() {
  try {
    ["sl_lease_gemini_key", "sl_lease_gemini_proxy", "sl_lease_gemini_model", "sl_lease_gemini_model_v"].forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

function cloneBaseCars(base) {
  return base.map(c => ({ ...c, id: c.id || legacyIdByName.get(c.name) || newVehicleId(), legacy: true, custom: false }));
}

// Immutable mapping from v2's ORIGINAL array positions. Never derive this from a
// reordered live catalogue; a saved override must keep its original identity.
const LEGACY_BASE_IDS = Object.freeze([
  "legacy-corolla-cross-z-adventure", "legacy-byd-sealion-6-premium-awd", "legacy-vezel-ehev-z",
  "legacy-byd-sealion-5-premium", "legacy-yaris-cross-z", "legacy-hyryder-v",
  "legacy-raize-z-hybrid", "legacy-swift-mz", "legacy-fronx-alpha-turbo",
  "legacy-taisor-v", "legacy-magnite-tekna-plus", "legacy-wagon-r-custom-z"
]);
const legacyNames = [
  "Toyota Corolla Cross Z (Adventure)", "BYD Sealion 6 Premium (AWD)", "Honda Vezel e:HEV Z",
  "BYD Sealion 5 Premium", "Toyota Yaris Cross Z", "Toyota Urban Cruiser Hyryder V",
  "Toyota Raize Z Hybrid", "Suzuki Swift MZ Hybrid", "Suzuki Fronx Alpha (Turbo)",
  "Toyota Urban Cruiser Taisor V", "Nissan Magnite Tekna Plus", "Suzuki Wagon R Custom Z"
];
const legacyIdByName = new Map(legacyNames.map((name, i) => [name, LEGACY_BASE_IDS[i]]));
const COMPARISON_KEY = "vahanaiq_comparison_v3";
const newVehicleId = () => "user-" + (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const safeId = id => typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,150}$/.test(id);

function loadSavedCars(base, onInvalid = () => {}) {
  let list = [];
  let invalid = 0;
  try {
    const current = localStorage.getItem(COMPARISON_KEY);
    if (current !== null) {
      const parsed = JSON.parse(current);
      if (parsed?.version !== 3 || !Array.isArray(parsed.cars)) throw new Error("Unsupported comparison data");
      const seen = new Set();
      for (const item of parsed.cars) {
        if (vehicleBatchError([item])) { invalid++; continue; }
        const id = safeId(item.id) && !seen.has(item.id) ? item.id : newVehicleId();
        const { _baseId, _key, ...record } = item;
        list.push({ ...record, id });
        seen.add(id);
      }
      if (invalid) onInvalid(invalid);
      return list;
    }
    const saved = localStorage.getItem("sl_lease_custom_cars_v2");
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Invalid legacy comparison data");
      list = cloneBaseCars(base);
      for (const item of parsed) {
        if (vehicleBatchError([item])) { invalid++; continue; }
        const { _baseId, _key, ...record } = item;
        const id = LEGACY_BASE_IDS[_baseId];
        const at = id ? list.findIndex(c => c.id === id) : -1;
        if (at >= 0) list[at] = { ...list[at], ...record, id, legacy: true, custom: true };
        else list.push({ ...record, id: newVehicleId(), legacy: true, custom: true });
      }
      saveCars(list); // v3 is authoritative after migration; retain v2 as a backup.
    }
  } catch (e) {
    console.error("Failed to load saved comparison", e);
    invalid++;
  }
  if (invalid) onInvalid(invalid);
  return list;
}

function saveCars(cars) {
  try {
    const records = cars.filter(c => !vehicleBatchError([c])).map(c => {
      if (!safeId(c.id)) c.id = newVehicleId();
      const { _key, _baseId, ...record } = c;
      return record;
    });
    localStorage.setItem(COMPARISON_KEY, JSON.stringify({ version: 3, cars: records }));
    notifySaved();
    return true;
  } catch (e) {
    console.error("Failed to save comparison", e);
    return false;
  }
}

  __exports.notifySaved = notifySaved;
  __exports.clearLegacyKeys = clearLegacyKeys;
  __exports.cloneBaseCars = cloneBaseCars;
  __exports.loadSavedCars = loadSavedCars;
  __exports.saveCars = saveCars;
  __exports.getProxyUrl = getProxyUrl;
  __exports.SAVED_EVENT = SAVED_EVENT;
  __exports.LEGACY_BASE_IDS = LEGACY_BASE_IDS;
  __exports.COMPARISON_KEY = COMPARISON_KEY;
  __exports.newVehicleId = newVehicleId;
  })(__mods.mod_8_storage);

  // === modal.js ===
  __mods.mod_10_modal = {};
  (function(__exports) {
// Accessible modal handling: inert background, focus trap, scroll lock and focus return
const stack = [];
// iframe: Google's sign-in button is rendered in one
const FOCUSABLE = 'a[href], iframe, button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const background = () => [...document.body.children].filter(el => !el.classList.contains("modal-bg") && el.tagName !== "SCRIPT");

function focusables(modal) {
  return [...modal.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el.getClientRects().length);
}

function openModal(modal, opener, initialFocus) {
  if (stack.some(m => m.modal === modal)) return;
  const top = stack[stack.length - 1];
  if (top) top.modal.inert = true;
  else background().forEach(el => { el.inert = true; });
  stack.push({ modal, opener: opener || document.activeElement });
  modal.inert = false;
  modal.classList.add("open");
  document.body.classList.add("modal-open");
  const target = initialFocus || focusables(modal)[0];
  if (target) requestAnimationFrame(() => target.focus());
}

function closeModal(modal) {
  const i = modal ? stack.findIndex(m => m.modal === modal) : stack.length - 1;
  if (i < 0) return;
  const [{ modal: el, opener }] = stack.splice(i, 1);
  el.classList.remove("open");
  el.inert = true;
  const top = stack[stack.length - 1];
  if (top) top.modal.inert = false;
  else {
    background().forEach(b => { b.inert = false; });
    document.body.classList.remove("modal-open");
  }
  if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
}

const isOpen = modal => stack.some(m => m.modal === modal);

document.addEventListener("keydown", e => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeModal(top.modal);
    return;
  }
  if (e.key !== "Tab") return;
  const items = focusables(top.modal);
  if (!items.length) { e.preventDefault(); return; }
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || !top.modal.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !top.modal.contains(document.activeElement))) {
    e.preventDefault();
    first.focus();
  }
});

document.addEventListener("click", e => {
  const top = stack[stack.length - 1];
  if (top && e.target === top.modal) closeModal(top.modal);
});

  __exports.openModal = openModal;
  __exports.closeModal = closeModal;
  __exports.isOpen = isOpen;
  })(__mods.mod_10_modal);

  // === catalogue-search.js ===
  __mods.mod_11_catalogue_search = {};
  (function(__exports) {
// Local catalogue discovery never calls an external AI or transmits the query.
function searchCatalogue(vehicles, query) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return vehicles.filter(v => words.every(word => [
    v.make, v.model, v.name, v.trim, v.year, v.body, v.fuel, v.pt, v.power, v.torque, v.transmission, v.drivetrain, v.km, v.safety, v.features,
    ...(v.offers ? v.offers.flatMap(o => [o.name, o.trim, o.fuel]) : [])
  ].join(" ").toLowerCase().includes(word)));
}

  __exports.searchCatalogue = searchCatalogue;
  })(__mods.mod_11_catalogue_search);

  // === official-photo-data.js ===
  __mods.mod_14_official_photo_data = {};
  (function(__exports) {
// Generated from attributable official galleries. Images remain representative until visual review.
const OFFICIAL_PHOTOS = {
  "Toyota Yaris Cross": {
    "img": "assets/images/review-thumbnails/03914997015bd3849f229e89.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/yaris-cross/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/yaris-cross/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/07/toyota-yaris-cross-side-thumbnail.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Yaris Cross",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Corolla Cross": {
    "img": "assets/images/review-thumbnails/e1777f0f0ab49ed834dc7e7b.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/corolla-cross/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/corolla-cross/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/Corolla-Cross-Entry.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Corolla Cross",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Rush": {
    "img": "assets/images/review-thumbnails/34f363f8d02899442c31d315.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/rush/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/rush/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/Rush-Manual-Transmission.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Rush",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Raize": {
    "img": "assets/images/review-thumbnails/39d19e78a21aac0b25c767ce.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/raize/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/raize/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/toyota-raize-1-0l-turbo-mlp-thumbnail.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Raize",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota RAV4 2026": {
    "img": "assets/images/review-thumbnails/d80a2da244e06b2b294ffa2e.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/rav4-2026/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/rav4-2026/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/RAV4-2.0L.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "RAV4 2026",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Land Cruiser 250": {
    "img": "assets/images/review-thumbnails/1a72058d12b2c5dc4a9ea0d0.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/land-cruiser-250/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/land-cruiser-250/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/07/002_LandCruiser250-scaled.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Land Cruiser 250",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Land Cruiser 300": {
    "img": "assets/images/review-thumbnails/50a368b5900dbc654ae80f67.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/land-cruiser-300/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/land-cruiser-300/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/toyota-lc300-thumbnail-nav.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Land Cruiser 300",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Fortuner": {
    "img": "assets/images/review-thumbnails/067e2c8f73ef5041e4a83a01.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/fortuner/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/fortuner/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/05/toyota-fortuner-thumbnail-nav.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Fortuner",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Prius": {
    "img": "assets/images/review-thumbnails/eb8c88ebc746a7949ad30eb2.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/prius/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/prius/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/2024_toyota_prius_sideview-removebg-preview-e1727019832140.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Prius",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Wigo": {
    "img": "assets/images/review-thumbnails/039d788233435d9ae46db2a7.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/wigo/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/wigo/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/toyota-wigo-thumb.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Wigo",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Yaris Ativ": {
    "img": "assets/images/review-thumbnails/48ccbf217eb126ad8416c317.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/yaris-ativ/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/yaris-ativ/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/09/Untitled-design-15.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Yaris Ativ",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Corolla": {
    "img": "assets/images/review-thumbnails/c3463e9af05a3f2bfd934d8d.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/corolla/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/corolla/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/07/9e56xtdt.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Corolla",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Camry Hybrid": {
    "img": "assets/images/review-thumbnails/c05e27c857063d4faada073c.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/camry/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/camry/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/ModelDesignSection_1890x1004_2.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Camry Hybrid",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Urban Cruiser Hyryder V": {
    "img": "assets/images/review-thumbnails/7bb42e1ade83d47587d5cb9d.webp",
    "author": "Toyota · toyotabharat.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyotabharat.com/showroom/urbancruiser-hyryder/",
    "sourceUrl": "https://www.toyotabharat.com/showroom/urbancruiser-hyryder/",
    "originalUrl": "https://static3.toyotabharat.com/images/showroom/urbancruiser-hyryder/exterior/exterior-1.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Urban Cruiser Hyryder V",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Urban Cruiser Taisor": {
    "img": "assets/images/review-thumbnails/c088b7ac1e0dcc3eb33c08a5.webp",
    "author": "Toyota · toyotabharat.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyotabharat.com/showroom/urbancruiser-taisor/",
    "sourceUrl": "https://www.toyotabharat.com/showroom/urbancruiser-taisor/",
    "originalUrl": "https://static3.toyotabharat.com/images/showroom/form/like.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Urban Cruiser Taisor",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Raize Hybrid Z": {
    "img": "assets/images/review-thumbnails/50f37a77a52f25f4a1529d64.webp",
    "author": "Toyota · cartivatemotors.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://cartivatemotors.lk/make/toyota/",
    "sourceUrl": "https://cartivatemotors.lk/make/toyota/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/toyota-raize-1-0l-turbo-mlp-thumbnail.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Raize Hybrid Z",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Corolla Cross Z": {
    "img": "assets/images/review-thumbnails/5e7e394eac2e6ee62a2da7e1.webp",
    "author": "Toyota · cartivatemotors.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://cartivatemotors.lk/advanced-search/",
    "sourceUrl": "https://cartivatemotors.lk/advanced-search/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/Corolla-Cross-Entry.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Corolla Cross Z",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Yaris": {
    "img": "assets/images/review-thumbnails/847086779f2de0f96061976c.webp",
    "author": "Toyota · global.toyota",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://global.toyota/en/mobility/toyota-brand/gallery/yaris.html",
    "sourceUrl": "https://global.toyota/en/mobility/toyota-brand/gallery/yaris.html",
    "originalUrl": "https://global.toyota/pages/models/images/yaris/rendition/yaris_001_W610_H407.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Yaris",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Aqua": {
    "img": "assets/images/review-thumbnails/1e340c25f76d8fd6284bf112.webp",
    "author": "Toyota · global.toyota",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://global.toyota/en/newsroom/toyota/35584064.html",
    "sourceUrl": "https://global.toyota/en/newsroom/toyota/35584064.html",
    "originalUrl": "https://global.toyota/pages/news/images/2021/07/19/1330/001.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Aqua",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Pixis Epoch": {
    "img": "assets/images/review-thumbnails/9e4c241f79aab14e3c6a029c.webp",
    "author": "Toyota · global.toyota",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://global.toyota/en/newsroom/toyota/40999453.html",
    "sourceUrl": "https://global.toyota/en/newsroom/toyota/40999453.html",
    "originalUrl": "https://global.toyota/pages/news/images/2017/05/12/1330/rendition/20170512_01_01_W610_H407.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Pixis Epoch",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Harrier": {
    "img": "assets/images/review-thumbnails/9af8a4e0fdeff2f7ef065b1f.webp",
    "author": "Toyota · global.toyota",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://global.toyota/en/newsroom/toyota/32732641.html",
    "sourceUrl": "https://global.toyota/en/newsroom/toyota/32732641.html",
    "originalUrl": "https://global.toyota/pages/news/images/2020/06/17/1330/001.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Harrier",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki S-Presso Auto": {
    "img": "assets/images/review-thumbnails/13c5b3160413da0242577660.webp",
    "author": "Suzuki · globalsuzuki.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.globalsuzuki.com/automobile/lineup/s-presso/",
    "sourceUrl": "https://www.globalsuzuki.com/automobile/lineup/s-presso/",
    "originalUrl": "https://www.globalsuzuki.com/automobile/lineup/s-presso/img/ex_img01.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "S-Presso Auto",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Celerio": {
    "img": "assets/images/review-thumbnails/29aa3dd9cd1d630987829df2.webp",
    "author": "Suzuki · suzuki.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.lk/vehicles/celerio.html",
    "sourceUrl": "https://www.suzuki.lk/vehicles/celerio.html",
    "originalUrl": "https://www.suzuki.lk/wp-content/uploads/celerio.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Celerio",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Fronx": {
    "img": "assets/images/review-thumbnails/7cf2baee14ffdffd76679ede.webp",
    "author": "Suzuki · suzuki.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.lk/vehicles/fronx-auto/",
    "sourceUrl": "https://www.suzuki.lk/vehicles/fronx-auto/",
    "originalUrl": "https://www.suzuki.lk/wp-content/uploads/fronx.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Fronx",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Brezza": {
    "img": "assets/images/review-thumbnails/dd5bb9d58edf8b504125a4a2.webp",
    "author": "Suzuki · suzuki.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.lk/vehicles/",
    "sourceUrl": "https://www.suzuki.lk/vehicles/",
    "originalUrl": "https://www.suzuki.lk/wp-content/uploads/Brezza.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Brezza",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Jimny": {
    "img": "assets/images/review-thumbnails/0c578c4db71b866ccdedfac1.webp",
    "author": "Suzuki · suzuki.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.lk/vehicles/jimny/",
    "sourceUrl": "https://www.suzuki.lk/vehicles/jimny/",
    "originalUrl": "https://www.suzuki.lk/wp-content/uploads/Main-Image-e1764564489839.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Jimny",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Dzire": {
    "img": "assets/images/review-thumbnails/4628be31a3cfac819aa37f1e.webp",
    "author": "Suzuki · suzuki.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.lk/vehicles/",
    "sourceUrl": "https://www.suzuki.lk/vehicles/",
    "originalUrl": "https://www.suzuki.lk/wp-content/uploads/Dzire-1.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Dzire",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Grand Vitara": {
    "img": "assets/images/review-thumbnails/29b54c1c2733a760f71414ed.webp",
    "author": "Suzuki · suzuki.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.lk/vehicles/grand-vitara/",
    "sourceUrl": "https://www.suzuki.lk/vehicles/grand-vitara/",
    "originalUrl": "https://www.suzuki.lk/wp-content/uploads/Arctic-White.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Grand Vitara",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Alto K10": {
    "img": "assets/images/review-thumbnails/1f02d4526e700e8eb8458d31.webp",
    "author": "Suzuki · suzuki.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.lk/vehicles/alto.html",
    "sourceUrl": "https://www.suzuki.lk/vehicles/alto.html",
    "originalUrl": "https://www.suzuki.lk/wp-content/uploads/Navigation_1920x1080_Alto-e1768729904367.jpeg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Alto K10",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Swift MZ": {
    "img": "assets/images/review-thumbnails/31343673d1c3f9ba46564b70.webp",
    "author": "Suzuki · suzuki.co.jp",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.co.jp/car/swift/",
    "sourceUrl": "https://www.suzuki.co.jp/car/swift/",
    "originalUrl": "https://www.suzuki.co.jp/car/swift/assets/img/exterior/img-exterior-01_pc.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Swift MZ",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Wagon R": {
    "img": "assets/images/review-thumbnails/3671b1249c082ffb6384d0b2.webp",
    "author": "Suzuki · suzuki.co.jp",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.co.jp/car/wagonr/",
    "sourceUrl": "https://www.suzuki.co.jp/car/wagonr/",
    "originalUrl": "https://www.suzuki.co.jp/car/wagonr/common/meta/ogp.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Wagon R",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Alto": {
    "img": "assets/images/review-thumbnails/1f02d4526e700e8eb8458d31.webp",
    "author": "Suzuki · suzuki.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.lk/vehicles/",
    "sourceUrl": "https://www.suzuki.lk/vehicles/",
    "originalUrl": "https://www.suzuki.lk/wp-content/uploads/Navigation_1920x1080_Alto-e1768729904367.jpeg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Alto",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Hustler": {
    "img": "assets/images/review-thumbnails/fabb6821c766473579f42ddd.webp",
    "author": "Suzuki · suzuki.co.jp",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.co.jp/car/hustler/",
    "sourceUrl": "https://www.suzuki.co.jp/car/hustler/",
    "originalUrl": "https://www.suzuki.co.jp/car/hustler/common/img/ogp.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Hustler",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Lapin": {
    "img": "assets/images/review-thumbnails/0d304d7f7ae224681063a8e6.webp",
    "author": "Suzuki · suzuki.co.jp",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.co.jp/car/lapin/",
    "sourceUrl": "https://www.suzuki.co.jp/car/lapin/",
    "originalUrl": "https://www.suzuki.co.jp/car/lapin/assets/images/home/img-main_visual.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Lapin",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Wagon R Stingray": {
    "img": "assets/images/review-thumbnails/3671b1249c082ffb6384d0b2.webp",
    "author": "Suzuki · suzuki.co.jp",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.co.jp/car/wagonr/",
    "sourceUrl": "https://www.suzuki.co.jp/car/wagonr/",
    "originalUrl": "https://www.suzuki.co.jp/car/wagonr/common/meta/ogp.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Wagon R Stingray",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD ATTO 1": {
    "img": "assets/images/review-thumbnails/d3d0a83ea3d8f3d49c7744f3.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-atto-1-dynamic/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-atto-1-dynamic/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2025/07/BYD-ATTO-1-Dynamic-800x800-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "ATTO 1",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD ATTO 2": {
    "img": "assets/images/review-thumbnails/290194319dd0db563663b121.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-atto-2/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-atto-2/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2025/07/BYD-ATTO-2-520x275-2.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "ATTO 2",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD Dolphin": {
    "img": "assets/images/review-thumbnails/30f7c5f039c2ee2e998a7ee7.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-dolphin-dynamic-49/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-dolphin-dynamic-49/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2025/02/DOLPHIN-f-v1800x800.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Dolphin",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD ATTO 3": {
    "img": "assets/images/review-thumbnails/f63b300eb48b41190d315f04.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-atto-3-advanced/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-atto-3-advanced/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2025/02/BYD-Atto-3-v2-1200x630-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "ATTO 3",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD Seal": {
    "img": "assets/images/review-thumbnails/69eaffdbdbb787fa7565aaf3.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-seal-dynamic/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-seal-dynamic/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2025/02/BYD-SEAL-f-800x800-1.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Seal",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD Sealion 5": {
    "img": "assets/images/review-thumbnails/3d7f8aa30595d8b122f90023.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-sealion-5-premium/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-sealion-5-premium/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2025/09/BYD-SEALION-5-1200x630-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Sealion 5",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD Sealion 6": {
    "img": "assets/images/review-thumbnails/823ea878c02593582517242d.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-sealion-6-superior/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-sealion-6-superior/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2025/02/BYD-Sealion-6-1200x630-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Sealion 6",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD Sealion 8": {
    "img": "assets/images/review-thumbnails/ca397463dcc7714915b5f8f6.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-sealion-8-dynamic/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-sealion-8-dynamic/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2026/03/BYD-SEALION-8-800x800-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Sealion 8",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Nissan Magnite": {
    "img": "assets/images/review-thumbnails/cfaf4e4d98b7e7b96ed6344f.webp",
    "author": "Nissan · nissanlk.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.nissanlk.com/nissan-magnite/",
    "sourceUrl": "https://www.nissanlk.com/nissan-magnite/",
    "originalUrl": "https://www.nissanlk.com/wp-content/uploads/Menu-Magnite-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Magnite",
    "make": "Nissan",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Nissan Almera": {
    "img": "assets/images/review-thumbnails/ca74d826901b0559922575bf.webp",
    "author": "Nissan · nissanlk.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.nissanlk.com/",
    "sourceUrl": "https://www.nissanlk.com/",
    "originalUrl": "https://www.nissanlk.com/wp-content/uploads/Menu-Almera-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Almera",
    "make": "Nissan",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Nissan X-Trail e-4ORCE": {
    "img": "assets/images/review-thumbnails/14831b072d3404e1bd4cf227.webp",
    "author": "Nissan · nissanlk.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.nissanlk.com/",
    "sourceUrl": "https://www.nissanlk.com/",
    "originalUrl": "https://www.nissanlk.com/wp-content/uploads/Menu-Xtrail.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "X-Trail e-4ORCE",
    "make": "Nissan",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia Sportage": {
    "img": "assets/images/review-thumbnails/a07ba66f475b117f4b8d9067.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "sourceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2025/06/sportage-kia-thumbnail.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Sportage",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia Sorento": {
    "img": "assets/images/review-thumbnails/a80a71a4bbc8ae1530426c3c.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "sourceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2025/06/sorento-1.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Sorento",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia Picanto": {
    "img": "assets/images/review-thumbnails/c056fd50bf54f6a1e9ebcdf6.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "sourceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2025/06/picanto-test.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Picanto",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia Sonet": {
    "img": "assets/images/review-thumbnails/bec19655bb2b8e2518084af5.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "sourceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2025/06/sonet-model-image.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Sonet",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia Seltos": {
    "img": "assets/images/review-thumbnails/e2a07caeb3771dfe178d9db2.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "sourceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2025/06/seltos-1.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Seltos",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia EV3": {
    "img": "assets/images/review-thumbnails/7315aaaff3d9e53b34810db6.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "sourceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2025/06/ev3-kia.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "EV3",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia EV5": {
    "img": "assets/images/review-thumbnails/2784f22a27342fbe02d7aa0c.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "sourceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2025/06/ev5.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "EV5",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia EV9": {
    "img": "assets/images/review-thumbnails/78276e3f97e20ddabe673c18.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "sourceUrl": "https://www.kia.lk/brand-new-cars-suvs/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2025/06/kia-9.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "EV9",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia Syros": {
    "img": "assets/images/review-thumbnails/4bf11c7d0032e8c7b88410ef.webp",
    "author": "Kia · kia.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.com/in/our-vehicles/syros/showroom.html",
    "sourceUrl": "https://www.kia.com/in/our-vehicles/syros/showroom.html",
    "originalUrl": "https://www.kia.com/content/dam/kia2/in/en/images/360vr/syros/8ww5k2g1upp021/exterior/ebb/08-d.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Syros",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Hyundai Grand i10": {
    "img": "assets/images/review-thumbnails/486578c2549f15e7017dd23e.webp",
    "author": "Hyundai · hyundaisrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://hyundaisrilanka.lk/vehicles",
    "sourceUrl": "https://hyundaisrilanka.lk/vehicles",
    "originalUrl": "https://hyundaisrilanka.lk/images/upload/category/grand-i10/category.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Grand i10",
    "make": "Hyundai",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Hyundai Accent": {
    "img": "assets/images/review-thumbnails/881e71b97015b2322c968633.webp",
    "author": "Hyundai · hyundaisrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://hyundaisrilanka.lk/vehicles",
    "sourceUrl": "https://hyundaisrilanka.lk/vehicles",
    "originalUrl": "https://hyundaisrilanka.lk/images/upload/category/accent/category.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Accent",
    "make": "Hyundai",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Hyundai Creta": {
    "img": "assets/images/review-thumbnails/22fcb5b5db4d426f59e36c18.webp",
    "author": "Hyundai · hyundaisrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://hyundaisrilanka.lk/vehicles",
    "sourceUrl": "https://hyundaisrilanka.lk/vehicles",
    "originalUrl": "https://hyundaisrilanka.lk/images/upload/modal/CARS/creta.png?tr=w-640",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Creta",
    "make": "Hyundai",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Hyundai Tucson": {
    "img": "assets/images/review-thumbnails/01f416f6365ffc3305d7b487.webp",
    "author": "Hyundai · hyundaisrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://hyundaisrilanka.lk/vehicles",
    "sourceUrl": "https://hyundaisrilanka.lk/vehicles",
    "originalUrl": "https://hyundaisrilanka.lk/images/upload/modal/CARS/tucson.png?tr=w-640",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Tucson",
    "make": "Hyundai",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Hyundai Santa Fe": {
    "img": "assets/images/review-thumbnails/0ff3465edd997871d0c98f94.webp",
    "author": "Hyundai · hyundaisrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://hyundaisrilanka.lk/vehicles",
    "sourceUrl": "https://hyundaisrilanka.lk/vehicles",
    "originalUrl": "https://hyundaisrilanka.lk/images/upload/category/santa-fe/category.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Santa Fe",
    "make": "Hyundai",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Hyundai Palisade": {
    "img": "assets/images/review-thumbnails/26414914a07acc4b7e1058e9.webp",
    "author": "Hyundai · hyundaisrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://hyundaisrilanka.lk/vehicles",
    "sourceUrl": "https://hyundaisrilanka.lk/vehicles",
    "originalUrl": "https://hyundaisrilanka.lk/images/upload/category/palisade/category.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Palisade",
    "make": "Hyundai",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Hyundai Ioniq 5": {
    "img": "assets/images/review-thumbnails/5bbc42d46c6a5e43b1ce2587.webp",
    "author": "Hyundai · hyundaisrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://hyundaisrilanka.lk/vehicles",
    "sourceUrl": "https://hyundaisrilanka.lk/vehicles",
    "originalUrl": "https://hyundaisrilanka.lk/images/upload/category/ioniq_5/category.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Ioniq 5",
    "make": "Hyundai",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Hyundai Ioniq 9": {
    "img": "assets/images/review-thumbnails/0dc2d8d6005153777bf5f745.webp",
    "author": "Hyundai · hyundaisrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://hyundaisrilanka.lk/vehicles",
    "sourceUrl": "https://hyundaisrilanka.lk/vehicles",
    "originalUrl": "https://hyundaisrilanka.lk/images/upload/category/ioniq_9/category.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Ioniq 9",
    "make": "Hyundai",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "GWM Haval H6": {
    "img": "assets/images/review-thumbnails/5e8f05d40b3c00927a578138.webp",
    "author": "GWM · gwmsrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.gwmsrilanka.lk/vehicles/haval-h6",
    "sourceUrl": "https://www.gwmsrilanka.lk/vehicles/haval-h6",
    "originalUrl": "https://www.gwmsrilanka.lk/storage/vehicles/content/lTeuDwUR3eNi1Sr1sBfsc1anl5tLQpK6IrKdNzC7.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Haval H6",
    "make": "GWM",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "GWM Haval H6 GT": {
    "img": "assets/images/review-thumbnails/9c6f5402b659f81785d387ae.webp",
    "author": "GWM · gwmsrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.gwmsrilanka.lk/vehicles/haval-h6-gt",
    "sourceUrl": "https://www.gwmsrilanka.lk/vehicles/haval-h6-gt",
    "originalUrl": "https://www.gwmsrilanka.lk/storage/vehicles/banners/G4P5gRYQ7RL9bhrSVGA7tziqAqTmr7egAnPhn2Vn.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Haval H6 GT",
    "make": "GWM",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "GWM Tank 300": {
    "img": "assets/images/review-thumbnails/76ee41d0217f0f8d6db499fe.webp",
    "author": "GWM · gwmsrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.gwmsrilanka.lk/vehicles/tank-300",
    "sourceUrl": "https://www.gwmsrilanka.lk/vehicles/tank-300",
    "originalUrl": "https://www.gwmsrilanka.lk/storage/vehicles/banners/MmpsODFjONTbKYuZA5NNe3XLhloLeN95vxGcgRLX.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Tank 300",
    "make": "GWM",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "GWM Tank 500": {
    "img": "assets/images/review-thumbnails/eb76e8a9c14cc075beabc93f.webp",
    "author": "GWM · gwmsrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.gwmsrilanka.lk/vehicles/tank-500",
    "sourceUrl": "https://www.gwmsrilanka.lk/vehicles/tank-500",
    "originalUrl": "https://www.gwmsrilanka.lk/storage/vehicles/banners/6NwZPfiHp4fswx3dcHSuqsatyrGde7OJiNGxhfXZ.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Tank 500",
    "make": "GWM",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "GWM Haval Jolion": {
    "img": "assets/images/review-thumbnails/8fad471c76d1207e58535d65.webp",
    "author": "GWM · gwm.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://gwm.lk/gwm-haval-jolion/index.html",
    "sourceUrl": "https://gwm.lk/gwm-haval-jolion/index.html",
    "originalUrl": "https://gwm.lk/assets/uploads/2025/07/haval-jolion-color-new-4-1024x540.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Haval Jolion",
    "make": "GWM",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Chery Tiggo 4 Pro": {
    "img": "assets/images/review-thumbnails/8e68e8d0494a1dc24b3a98ba.webp",
    "author": "Chery · cherysrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.cherysrilanka.lk/tiggo4pro.html",
    "sourceUrl": "https://www.cherysrilanka.lk/tiggo4pro.html",
    "originalUrl": "https://www.cherysrilanka.lk/img/banners/chery-tiggo4pro-banner.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Tiggo 4 Pro",
    "make": "Chery",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Chery Tiggo Cross Hybrid": {
    "img": "assets/images/review-thumbnails/36a0be4d772e9452fabf1c3c.webp",
    "author": "Chery · cherysrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.cherysrilanka.lk/tiggo-cross-hybrid.html",
    "sourceUrl": "https://www.cherysrilanka.lk/tiggo-cross-hybrid.html",
    "originalUrl": "https://www.cherysrilanka.lk/img/car-models/tiggo-cross-hybrid/tiggo-cross-hybrid-banner-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Tiggo Cross Hybrid",
    "make": "Chery",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Chery Tiggo 9 PHEV": {
    "img": "assets/images/review-thumbnails/c9db41289d5ad5de3a359e88.webp",
    "author": "Chery · cherysrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.cherysrilanka.lk/tiggo9-phev.html",
    "sourceUrl": "https://www.cherysrilanka.lk/tiggo9-phev.html",
    "originalUrl": "https://www.cherysrilanka.lk/img/car-models/tiggo9phev/tiggo9-phev-banner-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Tiggo 9 PHEV",
    "make": "Chery",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Tata Punch": {
    "img": "assets/images/review-thumbnails/20d732567bfea7e98452bf7d.webp",
    "author": "Tata · cars.tatamotors.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://cars.tatamotors.lk/",
    "sourceUrl": "https://cars.tatamotors.lk/",
    "originalUrl": "https://cars.tatamotors.lk/images/banner/Punch.ev_02_1920x960.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Punch",
    "make": "Tata",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Tata Nexon": {
    "img": "assets/images/review-thumbnails/65e47e98637d5ee28ded2e47.webp",
    "author": "Tata · cars.tatamotors.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://cars.tatamotors.lk/",
    "sourceUrl": "https://cars.tatamotors.lk/",
    "originalUrl": "https://cars.tatamotors.lk/images/home-nexon-thumbnail.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Nexon",
    "make": "Tata",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Tata Curvv": {
    "img": "assets/images/review-thumbnails/fb62d713f1316c8738d9e320.webp",
    "author": "Tata · cars.tatamotors.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://cars.tatamotors.lk/",
    "sourceUrl": "https://cars.tatamotors.lk/",
    "originalUrl": "https://cars.tatamotors.lk/images/banner/Curvv.ev_02_1920x960.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Curvv",
    "make": "Tata",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Tata Tiago.ev": {
    "img": "assets/images/review-thumbnails/7c88e7fb91ea151bd7773ca6.webp",
    "author": "Tata · cars.tatamotors.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://cars.tatamotors.lk/",
    "sourceUrl": "https://cars.tatamotors.lk/",
    "originalUrl": "https://cars.tatamotors.lk/images/banner/Tiago.ev_02_1920x960.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Tiago.ev",
    "make": "Tata",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Renault Kwid": {
    "img": "assets/images/review-thumbnails/36b9afd8f8b41a540f45a780.webp",
    "author": "Renault · renault.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.renault.lk/vehicles/",
    "sourceUrl": "https://www.renault.lk/vehicles/",
    "originalUrl": "https://www.renault.lk/wp-content/uploads/2026/09/KWID-desktop.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Kwid",
    "make": "Renault",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Renault Kiger": {
    "img": "assets/images/review-thumbnails/55754f502d53faf298a9ade9.webp",
    "author": "Renault · renault.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.renault.lk/vehicles/",
    "sourceUrl": "https://www.renault.lk/vehicles/",
    "originalUrl": "https://www.renault.lk/wp-content/uploads/2026/09/Kiger-desktop.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Kiger",
    "make": "Renault",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Perodua Axia": {
    "img": "assets/images/review-thumbnails/f025a74267c6005e7e16bb50.webp",
    "author": "Perodua · peroduasl.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.peroduasl.lk/",
    "sourceUrl": "https://www.peroduasl.lk/",
    "originalUrl": "https://www.peroduasl.lk/img/navigation/axia-g/vehicle.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Axia",
    "make": "Perodua",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Perodua Bezza": {
    "img": "assets/images/review-thumbnails/f2faec2f8c2906984413353e.webp",
    "author": "Perodua · peroduasl.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.peroduasl.lk/",
    "sourceUrl": "https://www.peroduasl.lk/",
    "originalUrl": "https://www.peroduasl.lk/img/navigation/bezza-g/vehicle.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Bezza",
    "make": "Perodua",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Perodua Myvi": {
    "img": "assets/images/review-thumbnails/85ed63a184c2a6630dcd84da.webp",
    "author": "Perodua · peroduasl.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.peroduasl.lk/",
    "sourceUrl": "https://www.peroduasl.lk/",
    "originalUrl": "https://www.peroduasl.lk/img/navigation/myvi-g/vehicle.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Myvi",
    "make": "Perodua",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Perodua Ativa": {
    "img": "assets/images/review-thumbnails/4b8333c717e1bfebb0bc772c.webp",
    "author": "Perodua · peroduasl.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.peroduasl.lk/",
    "sourceUrl": "https://www.peroduasl.lk/",
    "originalUrl": "https://www.peroduasl.lk/img/navigation/ativa/vehicle.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Ativa",
    "make": "Perodua",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Perodua Aruz": {
    "img": "assets/images/review-thumbnails/1dd01f298e98d726efcc27e3.webp",
    "author": "Perodua · peroduasl.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.peroduasl.lk/",
    "sourceUrl": "https://www.peroduasl.lk/",
    "originalUrl": "https://www.peroduasl.lk/img/navigation/aruz/vehicle.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Aruz",
    "make": "Perodua",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Perodua Traz": {
    "img": "assets/images/review-thumbnails/6b65d351594d90c245bdffa2.webp",
    "author": "Perodua · peroduasl.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.peroduasl.lk/",
    "sourceUrl": "https://www.peroduasl.lk/",
    "originalUrl": "https://www.peroduasl.lk/img/navigation/traz/vehicle.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Traz",
    "make": "Perodua",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi A3": {
    "img": "assets/images/review-thumbnails/598d23b72d43f706545e6bd1.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCEtzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grz-7G7wGi0-dulDgrxaXTw3o5W-NpDQMrUBfjJSDBIgIk-KKABEc4A5gEmbcQRJwE8ZnMmRkYWCuAjEgGEODjKy3KKUgsSszVK89MKckQ1DAgEgizu7iGOHr6BAMABIUZb-kAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "A3",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi A4": {
    "img": "assets/images/review-thumbnails/fe44573f051c86eade4ac656.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCEtzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grzw4diUen1aUj9-25-0Sh5KA9s0uUPQMrUBdjCJBgfgkk-OYBCY4ABjAJMq8AROwG8ZksmRkYWCuAjEgGEODjKy3KKUgsSszVK89MKckQ1DAgEgizu7iGOHr6BAMAu6Iu_ukAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "A4",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi A5": {
    "img": "assets/images/review-thumbnails/1e1817134a7491c6d9dabec9.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCEtzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grz-qGjy_23vk_keVTC7eDwMP4wp7gEwysQF2MJUCCRQFI8E0CEhy2DGASZF4DiLgI4jNZMDMwsFYAGZEMIMDHV1qUU5BYlJirV56ZUpIhqGFAJBBmd3ENcfT0CQYAYbooJukAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "A5",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi A6": {
    "img": "assets/images/review-thumbnails/118b8913a0d6e5a459dccaf9.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCEtzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grz_Sv61bMkVrEn38rXiGSo_O8kPjWrwysQF2MCkCC-ROQ4NsKJDiCGcAkyDwfELEWxGeyYmZgYK0AMiIZQICPr7QopyCxKDFXrzwzpSRDUMOASCDM7uIa4ujpEwwA_YfRY-kAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "A6",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi A7": {
    "img": "assets/images/review-thumbnails/0cf7059793a896a0661fca75.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCEtzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grz8N4q-ezD3NYzNl4Y_91jcNTGoyuVTKwAnUxigMJFkYgwfcDSHC4MoBJkHkxIOIoiM9kzszAwFoBZEQygAAfX2lRTkFiUWKuXnlmSkmGoIYBkUCY3cU1xNHTJxgAoVVf1OkAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "A7",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi A8": {
    "img": "assets/images/review-thumbnails/51f0fd926d6a1bf90d0fe6b0.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCEtzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grD9e15-F1PjfYpq5nVGd7-nnBd2EBTgZWkK4_QIKFH0jw7wQSHKEMYBIk4wYiDoP4TAbMDAysFUBGJAMI8PGVFuUUJBYl5uqVZ6aUZAhqGBAJhNldXEMcPX2CATO6Yx3pAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "A8",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi Q2": {
    "img": "assets/images/review-thumbnails/235f60da1cc4fc4198733bba.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCEtzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grD8cCyUu7M04nnLD6Mctp47xQtjWX5RhYgbqYlIEE81sgwbsDSHBEMoBJkHm7QcRWEJ_JgpmBgbUCyIhkAAE-vtKinILEosRcvfLMlJIMQQ0DIoEwu4triKOnTzAAkMFQZukAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Q2",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi Q3": {
    "img": "assets/images/review-thumbnails/419d1b2318c7cfc0ef77dc9a.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCEtzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grj_2WTztL-3sd3F7XyC8xruJa_ni1DQMrUBfjZyDB_BxI8MkDCY4OBjAJMm8hiJgF4jOZMTMwsFYAGZEMIMDHV1qUU5BYlJirV56ZUpIhqGFAJBBmd3ENcfT0CQYAUS-_ZekAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Q3",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi Q5": {
    "img": "assets/images/review-thumbnails/bd6f557cdcfffbabbe6fbf4e.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCElzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grT4rVX_2m-OnF3yeX2X8U2uvxR_7AXAZWoC7G6UCC-SyQ4GcAEhzrISTIvBoQMRHEZzJkZmBgrQAyIhlAQFDDgEggzO7iGuLo6RMMAKi1Je3ZAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Q5",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi Q7": {
    "img": "assets/images/review-thumbnails/06e7c3e997f10636a97df4dc.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCEtzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grD2OyqLTKt_wJhe_4iuV9t21dFR34mIEVqItRBUgwzwYSfF-ABMdRBjAJMi8DRFSC-EyWzAwMrBVARiQDCPDxlRblFCQWJebqlWemlGQIahgQCYTZXVxDHD19ggErcR9B6QAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Q7",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Audi TT": {
    "img": "assets/images/review-thumbnails/118b8913a0d6e5a459dccaf9.webp",
    "author": "Audi · audi.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.audi.lk/en/models/",
    "sourceUrl": "https://www.audi.lk/en/models/",
    "originalUrl": "https://mediaservice.audi.com/media/fast/H4sIAAAAAAAAAFvzloG1tIiBOTrayfuvpGh6-m1zJgaGigIGBgZGoDhTtNOaz-I_2DhCHsCEtzEwF-SlMwJZKUycmbmJ6an6QD4_I3taTmV-aUkxO0grz_Sv61bMkVrEn38rXiGSo_O8kPjWrwysQF2MCkCC-ROQ4NsKJDiCGcAkyDwfELEWxGeyYmZgYK0AMiIZQICPr7QopyCxKDFXrzwzpSRDUMOASCDM7uIa4ujpEwwA_YfRY-kAAAA",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "TT",
    "make": "Audi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Jetour Dashing": {
    "img": "assets/images/review-thumbnails/983ebb06322e3781b4b82341.webp",
    "author": "Jetour · jetourglobal.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.jetourglobal.com/",
    "sourceUrl": "https://www.jetourglobal.com/",
    "originalUrl": "https://www.jetourglobal.com/new-static/images/header/vehicles/dashing.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Dashing",
    "make": "Jetour",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Jetour X70 Plus": {
    "img": "assets/images/review-thumbnails/a5d160f0ca584496e6616bf8.webp",
    "author": "Jetour · jetourglobal.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.jetourglobal.com/",
    "sourceUrl": "https://www.jetourglobal.com/",
    "originalUrl": "https://www.jetourglobal.com/new-static/images/header/vehicles/x70.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "X70 Plus",
    "make": "Jetour",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Jetour T2": {
    "img": "assets/images/review-thumbnails/f49bbce16315c404bf203f2d.webp",
    "author": "Jetour · jetourglobal.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.jetourglobal.com/t2",
    "sourceUrl": "https://www.jetourglobal.com/t2",
    "originalUrl": "https://www.jetourglobal.com/new-static/exterior/T2/silver_snow/23.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "T2",
    "make": "Jetour",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "MG ZS MCE": {
    "img": "assets/images/review-thumbnails/ebd7f28757ebbdaad7dc2c75.webp",
    "author": "MG · mgsrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://mgsrilanka.lk/models/mg-zs-mce/",
    "sourceUrl": "https://mgsrilanka.lk/models/mg-zs-mce/",
    "originalUrl": "https://mgsrilanka.lk/wp-content/uploads/2025/07/MG-ZS-MCE-Model.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "ZS MCE",
    "make": "MG",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "MG ZS Hybrid+": {
    "img": "assets/images/review-thumbnails/5052e4424aa5e6edac27dd31.webp",
    "author": "MG · mgsrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://mgsrilanka.lk/models/mg-zs-hybrid/",
    "sourceUrl": "https://mgsrilanka.lk/models/mg-zs-hybrid/",
    "originalUrl": "https://mgsrilanka.lk/wp-content/uploads/2025/07/MG-ZS-MCE-Model.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "ZS Hybrid+",
    "make": "MG",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "MG HS Plug-In Hybrid": {
    "img": "assets/images/review-thumbnails/ac4ba765e8b23db08508dec5.webp",
    "author": "MG · mgsrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://mgsrilanka.lk/models/mg-hs-plug-in-hybrid/",
    "sourceUrl": "https://mgsrilanka.lk/models/mg-hs-plug-in-hybrid/",
    "originalUrl": "https://mgsrilanka.lk/wp-content/uploads/2026/01/MG-HS-Plug-In-Hybrid-Hampstead-Grey.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "HS Plug-In Hybrid",
    "make": "MG",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "MG S5 EV": {
    "img": "assets/images/review-thumbnails/7bf940c6b9d8de8a593c639d.webp",
    "author": "MG · mgsrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://mgsrilanka.lk/models/mg-s5-ev/",
    "sourceUrl": "https://mgsrilanka.lk/models/mg-s5-ev/",
    "originalUrl": "https://mgsrilanka.lk/wp-content/uploads/2025/07/MG-S5-EV-Model.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "S5 EV",
    "make": "MG",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "MG 4 Electric": {
    "img": "assets/images/review-thumbnails/17322ab21dd315066f3d19ec.webp",
    "author": "MG · mgsrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://mgsrilanka.lk/models/mg4-urban-ev/",
    "sourceUrl": "https://mgsrilanka.lk/models/mg4-urban-ev/",
    "originalUrl": "https://mgsrilanka.lk/wp-content/uploads/elementor/thumbs/600-x-400-rswg12tpqvflbh15cj9fdn2p9c6oxyj1avgw12ybog.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "4 Electric",
    "make": "MG",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "MG HS Hybrid+": {
    "img": "assets/images/review-thumbnails/77b8a01ca2e862c8993c4c19.webp",
    "author": "MG · mgsrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://mgsrilanka.lk/models/mg-hs-hybrid/",
    "sourceUrl": "https://mgsrilanka.lk/models/mg-hs-hybrid/",
    "originalUrl": "https://mgsrilanka.lk/wp-content/uploads/2026/01/MG-HS-Hybrid-White-Pearl.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "HS Hybrid+",
    "make": "MG",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Mahindra XUV 3XO": {
    "img": "assets/images/review-thumbnails/afb8475f6c99915c33ba6dd1.webp",
    "author": "Mahindra · mahindrasrilanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://mahindrasrilanka.lk/",
    "sourceUrl": "https://mahindrasrilanka.lk/",
    "originalUrl": "https://mahindrasrilanka.lk/wp-content/uploads/2025/10/XUV3XO11.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "XUV 3XO",
    "make": "Mahindra",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Volkswagen Virtus Chrome": {
    "img": "assets/images/review-thumbnails/a7024d897b28a650fcaa6935.webp",
    "author": "Volkswagen · volkswagen.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.volkswagen.lk/en/models.html",
    "sourceUrl": "https://www.volkswagen.lk/en/models.html",
    "originalUrl": "https://assets.volkswagen.com/is/image/volkswagenag/virtus-chrome-mofa-1?Zm10PXdlYnAtYWxwaGEmcWx0PTc5JndpZD05NjAmYmZjPW9mZiZiZjg0",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Virtus Chrome",
    "make": "Volkswagen",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Volkswagen Taigun": {
    "img": "assets/images/review-thumbnails/728f0f57295ac304ba80d307.webp",
    "author": "Volkswagen · volkswagen.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.volkswagen.lk/en/models.html",
    "sourceUrl": "https://www.volkswagen.lk/en/models.html",
    "originalUrl": "https://assets.volkswagen.com/is/image/volkswagenag/mofa-the-new-taigun-final?Zm10PXdlYnAtYWxwaGEmcWx0PTc5JndpZD05NjAmYmZjPW9mZiZiZjg0",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Taigun",
    "make": "Volkswagen",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Volkswagen T-Cross": {
    "img": "assets/images/review-thumbnails/728f0f57295ac304ba80d307.webp",
    "author": "Volkswagen · autoxolk.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://autoxolk.com/",
    "sourceUrl": "https://autoxolk.com/",
    "originalUrl": "https://autoxolk.com/wp-content/uploads/2026/02/VW-T-Cross-R-Line-1-746x516.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "T-Cross",
    "make": "Volkswagen",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Honda Vezel e:HEV Z": {
    "img": "assets/images/review-thumbnails/cc95b1b94a248d8b82d1f8f8.webp",
    "author": "Honda · global.honda",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://global.honda/en/design/award/2022hrvvezel/",
    "sourceUrl": "https://global.honda/en/design/award/2022hrvvezel/",
    "originalUrl": "https://global.honda/en/design/award/2022hrvvezel/images/main.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Vezel e:HEV Z",
    "make": "Honda",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Honda WR-V": {
    "img": "assets/images/review-thumbnails/524ac0b00bdbb135ff1d812a.webp",
    "author": "Honda · honda.co.jp",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.honda.co.jp/WR-V/",
    "sourceUrl": "https://www.honda.co.jp/WR-V/",
    "originalUrl": "https://www.honda.co.jp/WR-V/top/images/img_mainvisual.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "WR-V",
    "make": "Honda",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Mitsubishi Outlander": {
    "img": "assets/images/review-thumbnails/f05323074c3961860176faef.webp",
    "author": "Mitsubishi · cartivatemotors.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://cartivatemotors.lk/advanced-search/",
    "sourceUrl": "https://cartivatemotors.lk/advanced-search/",
    "originalUrl": "https://cartivatemotors.lk/wp-content/uploads/2025/09/541986022_1356202863173034_2039660065645516720_n-660x471.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Outlander",
    "make": "Mitsubishi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Mitsubishi Montero Sport": {
    "img": "assets/images/review-thumbnails/2d25e6f301a0f20c0bb2124a.webp",
    "author": "Mitsubishi · unitedmotors.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.unitedmotors.lk/personal/suvs/mitsubishi/montero-sport",
    "sourceUrl": "https://www.unitedmotors.lk/personal/suvs/mitsubishi/montero-sport",
    "originalUrl": "https://www.unitedmotors.lk/images/personal-vehicle/montero-sport/montero-sport-banner.jpg.pagespeed.ce.UuXvRHRVBv.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Montero Sport",
    "make": "Mitsubishi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Mitsubishi Destinator": {
    "img": "assets/images/review-thumbnails/7bd8d6afa648c116a55fa620.webp",
    "author": "Mitsubishi · mitsubishisl.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.mitsubishisl.lk/destinator",
    "sourceUrl": "https://www.mitsubishisl.lk/destinator",
    "originalUrl": "https://www.mitsubishisl.lk/img/vehicle-intro/destinator.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Destinator",
    "make": "Mitsubishi",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Peugeot 5008 Allure Premium": {
    "img": "assets/images/review-thumbnails/60ed05ecb979d126aa38541b.webp",
    "author": "Peugeot · media.stellantis.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.media.stellantis.com/br-pt/peugeot/peugeot-5008-2018-a-2019",
    "sourceUrl": "https://www.media.stellantis.com/br-pt/peugeot/peugeot-5008-2018-a-2019",
    "originalUrl": "https://www.media.stellantis.com/cache/8/d/c/f/9/8dcf98e47288cb47c083a0a7dce1af263959bd35.jpeg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "5008 Allure Premium",
    "make": "Peugeot",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BMW 530e M Sport": {
    "img": "assets/images/review-thumbnails/3978cf91491acda0f6319ec3.webp",
    "author": "BMW · press.bmwgroup.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.press.bmwgroup.com/global/photo/compilation/T0318970EN/the-new-bmw-5-series-sedan-additional-pictures",
    "sourceUrl": "https://www.press.bmwgroup.com/global/photo/compilation/T0318970EN/the-new-bmw-5-series-sedan-additional-pictures",
    "originalUrl": "https://mediapool.bmwgroup.com/cache/P9/202010/P90403976/P90403976-the-new-bmw-530e-sedan-bernina-grey-amber-effect-10-2020-2250px.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "530e M Sport",
    "make": "BMW",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Mercedes-Benz E200 Avantgarde": {
    "img": "assets/images/review-thumbnails/cd5d7f520ce8523da52bd1cc.webp",
    "author": "Mercedes-Benz · mercedes-benz-media.co.uk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://mercedes-benz-media.co.uk/models/all-models-saloons-e-class-saloon",
    "sourceUrl": "https://mercedes-benz-media.co.uk/models/all-models-saloons-e-class-saloon",
    "originalUrl": "https://mercedes-benz-media.co.uk/assets/images/hero/45223-2311E300e0008.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "E200 Avantgarde",
    "make": "Mercedes-Benz",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Daihatsu Mira e:S": {
    "img": "assets/images/review-thumbnails/18df03bb5c7fc67376a75313.webp",
    "author": "Daihatsu · daihatsu.co.jp",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.daihatsu.co.jp/lineup/mira_e-s/",
    "sourceUrl": "https://www.daihatsu.co.jp/lineup/mira_e-s/",
    "originalUrl": "https://www.daihatsu.co.jp/lineup/mira_e-s/h4o2fg000000sb4d-img/mira_e-s_01_mv_pc-01.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Mira e:S",
    "make": "Daihatsu",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Land Rover Range Rover": {
    "img": "assets/images/review-thumbnails/af5285f593fd268f0ee4e1fa.webp",
    "author": "Land Rover · landrover.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.landrover.lk/range-rover/range-rover/overview",
    "sourceUrl": "https://www.landrover.lk/range-rover/range-rover/overview",
    "originalUrl": "https://media.cdn-jaguarlandrover.com/api/v2/images/124761/w/1600.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Range Rover",
    "make": "Land Rover",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Land Rover Range Rover Sport": {
    "img": "assets/images/review-thumbnails/d48e6b725f13ec639cdbf3b3.webp",
    "author": "Land Rover · landrover.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.landrover.lk/range-rover/range-rover-sport/overview",
    "sourceUrl": "https://www.landrover.lk/range-rover/range-rover-sport/overview",
    "originalUrl": "https://media.cdn-jaguarlandrover.com/api/v2/images/105475/w/1600.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Range Rover Sport",
    "make": "Land Rover",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Land Rover Range Rover Velar": {
    "img": "assets/images/review-thumbnails/397c3a87e3bd21fb271bc798.webp",
    "author": "Land Rover · landrover.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.landrover.lk/range-rover/range-rover-velar/overview",
    "sourceUrl": "https://www.landrover.lk/range-rover/range-rover-velar/overview",
    "originalUrl": "https://media.cdn-jaguarlandrover.com/api/v2/images/117709/w/1600.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Range Rover Velar",
    "make": "Land Rover",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Land Rover Range Rover Evoque": {
    "img": "assets/images/review-thumbnails/c5702700c3d54d65e760dbe8.webp",
    "author": "Land Rover · landrover.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.landrover.lk/range-rover/range-rover-evoque/overview",
    "sourceUrl": "https://www.landrover.lk/range-rover/range-rover-evoque/overview",
    "originalUrl": "https://media.cdn-jaguarlandrover.com/api/v2/images/119854/w/1600/h/900.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Range Rover Evoque",
    "make": "Land Rover",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Land Rover Discovery": {
    "img": "assets/images/review-thumbnails/e94a4ade78079bae92aaa670.webp",
    "author": "Land Rover · landrover.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.landrover.lk/discovery/discovery/overview",
    "sourceUrl": "https://www.landrover.lk/discovery/discovery/overview",
    "originalUrl": "https://media.cdn-jaguarlandrover.com/api/v2/images/97721/w/1600.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Discovery",
    "make": "Land Rover",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Land Rover Discovery Sport": {
    "img": "assets/images/review-thumbnails/8c7719ce76bf03fef5bdfdba.webp",
    "author": "Land Rover · landrover.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.landrover.lk/discovery/discovery-sport/overview",
    "sourceUrl": "https://www.landrover.lk/discovery/discovery-sport/overview",
    "originalUrl": "https://media.cdn-jaguarlandrover.com/api/v2/images/59895/w/1216/h/684.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Discovery Sport",
    "make": "Land Rover",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Land Rover Defender": {
    "img": "assets/images/review-thumbnails/5257ceb11148ca11794e122e.webp",
    "author": "Land Rover · media.cdn-jaguarlandrover.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://media.cdn-jaguarlandrover.com/api/v2/images/120883/w/1600.jpg",
    "sourceUrl": "https://media.cdn-jaguarlandrover.com/api/v2/images/120883/w/1600.jpg",
    "originalUrl": "https://media.cdn-jaguarlandrover.com/api/v2/images/120883/w/1600.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Defender",
    "make": "Land Rover",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Mazda CX-3": {
    "img": "assets/images/review-thumbnails/62b6554db05da007b4f0e3c0.webp",
    "author": "Mazda · mazdalanka.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://mazdalanka.lk/",
    "sourceUrl": "https://mazdalanka.lk/",
    "originalUrl": "https://mazdalanka.lk/assets/img/cars/cx3/cx-3-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "CX-3",
    "make": "Mazda",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Porsche 911": {
    "img": "assets/images/review-thumbnails/b8a80dfd91223a6c5d53bfa6.webp",
    "author": "Porsche · models.porsche.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://models.porsche.com/en-LK/model-start/911",
    "sourceUrl": "https://models.porsche.com/en-LK/model-start/911",
    "originalUrl": "https://images.porsche.com/f/285489813253582/5000x1485/a203ff742b/model-9921b2-side-shot_c0332ade044b4b01b7e09d445787a5f5.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "911",
    "make": "Porsche",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Leapmotor C10 REEV": {
    "img": "assets/images/review-thumbnails/92c9787b0cde8fa8ca871f61.webp",
    "author": "Leapmotor · leapmotor.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://leapmotor.lk/",
    "sourceUrl": "https://leapmotor.lk/",
    "originalUrl": "https://cdn.bitrix24.com/b31747087/landing/601/6012832cee50b2074275387e4bbc216b/hero_2x.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "C10 REEV",
    "make": "Leapmotor",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "GAC Aion V": {
    "img": "assets/images/review-thumbnails/3ca93dbf0d2857de06f0aca6.webp",
    "author": "GAC · gacsrilanka.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://gacsrilanka.com/",
    "sourceUrl": "https://gacsrilanka.com/",
    "originalUrl": "https://gacsrilanka.com/wp-content/uploads/2025/10/1409bb3b-e2f5-461e-9246-d0d9aee78beb.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Aion V",
    "make": "GAC",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "GAC Aion ES": {
    "img": "assets/images/review-thumbnails/864d4dd60dbc6bad79a38890.webp",
    "author": "GAC · gacsrilanka.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://gacsrilanka.com/",
    "sourceUrl": "https://gacsrilanka.com/",
    "originalUrl": "https://gacsrilanka.com/wp-content/uploads/2025/10/Aion-ES.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Aion ES",
    "make": "GAC",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "GAC Aion UT": {
    "img": "assets/images/review-thumbnails/319cedfaaa83152e2adb79bd.webp",
    "author": "GAC · gacsrilanka.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://gacsrilanka.com/",
    "sourceUrl": "https://gacsrilanka.com/",
    "originalUrl": "https://gacsrilanka.com/wp-content/uploads/2025/10/gac-banner.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Aion UT",
    "make": "GAC",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Alphard": {
    "img": "assets/images/review-thumbnails/16b29cc13a622bde1dec394b.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/alphard/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/alphard/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/07/download-e1730237431143.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Alphard",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Hiace": {
    "img": "assets/images/review-thumbnails/0ed26ed9724783da0f5b6db0.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/hiace/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/hiace/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/07/2.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Hiace",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Coaster": {
    "img": "assets/images/review-thumbnails/ae504158457117589a000801.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/coaster/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/coaster/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2024/06/toyota-coaster-mlp-thumbnail.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Coaster",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Toyota Hilux 2026": {
    "img": "assets/images/review-thumbnails/5441c711f2d9529d10367e10.webp",
    "author": "Toyota · toyota.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.toyota.lk/vehicle-model/hilux-2026/",
    "sourceUrl": "https://www.toyota.lk/vehicle-model/hilux-2026/",
    "originalUrl": "https://www.toyota.lk/wp-content/uploads/2026/07/Hilux_2026-removebg-preview.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Hilux 2026",
    "make": "Toyota",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki Ertiga": {
    "img": "assets/images/review-thumbnails/306647f60b7efd27cc2c9bdd.webp",
    "author": "Suzuki · suzuki.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.lk/vehicles/",
    "sourceUrl": "https://www.suzuki.lk/vehicles/",
    "originalUrl": "https://www.suzuki.lk/wp-content/uploads/Ertiga.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Ertiga",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Suzuki XL6": {
    "img": "assets/images/review-thumbnails/9da77e24fad1ddfffd16364d.webp",
    "author": "Suzuki · suzuki.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.suzuki.lk/vehicles/",
    "sourceUrl": "https://www.suzuki.lk/vehicles/",
    "originalUrl": "https://www.suzuki.lk/wp-content/uploads/XL6.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "XL6",
    "make": "Suzuki",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia Carnival": {
    "img": "assets/images/review-thumbnails/b72178efccac8c5817235a0c.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/carnival/",
    "sourceUrl": "https://www.kia.lk/carnival/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2026/09/kia-carnival-2.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Carnival",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia Carens Clavis EV": {
    "img": "assets/images/review-thumbnails/b89b30c6f206eac2b3be58bc.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/clavis/",
    "sourceUrl": "https://www.kia.lk/clavis/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2026/04/Clavis-Cover-Image-Final_FL-1.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Carens Clavis EV",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Kia Tasman": {
    "img": "assets/images/review-thumbnails/24b13ce07037ed6358eacefb.webp",
    "author": "Kia · kia.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.kia.lk/tasman/",
    "sourceUrl": "https://www.kia.lk/tasman/",
    "originalUrl": "https://kia.sgp1.digitaloceanspaces.com/wp-content/uploads/2026/04/kia-tasman-front.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Tasman",
    "make": "Kia",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD M6": {
    "img": "assets/images/review-thumbnails/54c252e349cc6704d8b16d9d.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-m6-standard-captain/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-m6-standard-captain/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2025/02/BYD-M6-f-800x800-1.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "M6",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD Shark 6": {
    "img": "assets/images/review-thumbnails/0c184dc66e201fdac84faf89.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-shark-6-premium/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-shark-6-premium/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2025/02/BYD-SHARK-6-f-800x800-1.png",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Shark 6",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "BYD Racco": {
    "img": "assets/images/review-thumbnails/542d28f70f64c01e01d9c384.webp",
    "author": "BYD · johnkeellscgauto.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.johnkeellscgauto.com/product/byd-racco/",
    "sourceUrl": "https://www.johnkeellscgauto.com/product/byd-racco/",
    "originalUrl": "https://www.johnkeellscgauto.com/wp-content/uploads/2026/10/BYD-RACCO-v1-800x800-2.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Racco",
    "make": "BYD",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Perodua Alza": {
    "img": "assets/images/review-thumbnails/494064790497f81f625c9648.webp",
    "author": "Perodua · peroduasl.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.peroduasl.lk/alza",
    "sourceUrl": "https://www.peroduasl.lk/alza",
    "originalUrl": "https://www.peroduasl.lk/img/color-varients/alza/black/top-rect.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Alza",
    "make": "Perodua",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Renault Triber": {
    "img": "assets/images/review-thumbnails/d83a20afc7398c4b66bbdd30.webp",
    "author": "Renault · renault.lk",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://www.renault.lk/renault-triber/",
    "sourceUrl": "https://www.renault.lk/renault-triber/",
    "originalUrl": "https://www.renault.lk/wp-content/uploads/2026/08/Triber-desktop-1024x576.webp",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "Triber",
    "make": "Renault",
    "variantNote": "Representative official image; generation, grade and market may differ."
  },
  "Isuzu D-Max": {
    "img": "assets/images/review-thumbnails/fb2503e508aab024354c3040.webp",
    "author": "Isuzu · sathosamotorsplc.com",
    "licence": "Official source · rights reserved",
    "licenceUrl": "https://sathosamotorsplc.com/d-max.php",
    "sourceUrl": "https://sathosamotorsplc.com/d-max.php",
    "originalUrl": "https://sathosamotorsplc.com/img/d-max-key-feat-1.jpg",
    "sourceKind": "official",
    "aspectRatio": "8:5",
    "model": "D-Max",
    "make": "Isuzu",
    "variantNote": "Representative official image; generation, grade and market may differ."
  }
};

  __exports.OFFICIAL_PHOTOS = OFFICIAL_PHOTOS;
  })(__mods.mod_14_official_photo_data);

  // === photo-credits.js ===
  __mods.mod_13_photo_credits = {};
  (function(__exports) {
// Manufacturer / authorised distributor photos only. No community-photo fallback.
const {  OFFICIAL_PHOTOS  } = __mods.mod_14_official_photo_data;
const {  esc  } = __mods.mod_2_calculator;
const PHOTO_CREDITS = OFFICIAL_PHOTOS;
const tokens = name => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const records = Object.entries(OFFICIAL_PHOTOS).sort(([a],[b])=>b.length-a.length);
function creditFor(vehicleOrName) {
  if (!vehicleOrName) return null;
  const name = typeof vehicleOrName === 'string' ? vehicleOrName : `${vehicleOrName.make || ''} ${vehicleOrName.model || ''}`.trim() || vehicleOrName.name;
  if (OFFICIAL_PHOTOS[name]) return OFFICIAL_PHOTOS[name];
  const query = ' '+tokens(name)+' ';
  return records.find(([model])=>query.includes(' '+tokens(model)+' '))?.[1] || null;
}
const photoForModel = value => creditFor(value)?.img || '';
function formatCreditHtml(credit, compact = true) {
  if (!credit?.author || !/^https:\/\//.test(credit.sourceUrl || '')) return '';
  return `<a class="photo-source" href="${esc(credit.sourceUrl)}" target="_blank" rel="noopener noreferrer" title="${esc(`Photo: ${credit.author} · ${credit.licence}`)}">${compact ? 'Photo Source' : esc(credit.author)}<span class="${compact ? 'sr-only' : 'photo-rights'}">: ${esc(credit.author)} · ${esc(credit.licence)}</span> ↗</a>`;
}

  __exports.creditFor = creditFor;
  __exports.formatCreditHtml = formatCreditHtml;
  __exports.PHOTO_CREDITS = PHOTO_CREDITS;
  __exports.photoForModel = photoForModel;
  })(__mods.mod_13_photo_credits);

  // === image-fetcher.js ===
  __mods.mod_12_image_fetcher = {};
  (function(__exports) {
// Resolve only the local, source-attributed official catalogue. No network fallback.
const {  photoForModel  } = __mods.mod_13_photo_credits;
const NO_PHOTO = '<div class="ph"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="3"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M14 21v-4a2 2 0 0 0-4 0v4"/></svg><span>No photo</span></div>';
const localStudioPhoto = modelName => photoForModel(modelName);
async function fetchVehicleStudioImage(modelName) { return photoForModel(modelName); }

  __exports.fetchVehicleStudioImage = fetchVehicleStudioImage;
  __exports.NO_PHOTO = NO_PHOTO;
  __exports.localStudioPhoto = localStudioPhoto;
  })(__mods.mod_12_image_fetcher);

  // === identity-data.js ===
  __mods.mod_15_identity_data = {};
  (function(__exports) {
const identity = {
  "brands": {
    "BMW": {
      "localPath": "../assets/identity/bmw.svg",
      "sourceUrl": "https://www.bmw.co.uk/content/dam/bmw/common/images/logo-icons/BMW/BMW_White_Logo.svg.asset.1670245093434.svg",
      "dark": false,
      "adaptive": false
    },
    "Changan": {
      "localPath": "../assets/identity/changan.svg",
      "sourceUrl": "https://www.globalchangan.com/static/clientlibs/changancms/images/header/changan-auto-logo.png",
      "dark": false,
      "adaptive": false
    },
    "Daihatsu": {
      "localPath": "../assets/identity/daihatsu.png",
      "sourceUrl": "https://download.logo.wine/logo/Daihatsu/Daihatsu-Logo.wine.png",
      "dark": false,
      "adaptive": false
    },
    "DFSK": {
      "localPath": "../assets/identity/dfsk.webp",
      "sourceUrl": "https://www.dfsk.com/static_/dfsk-black-DglH9b2Z.webp",
      "dark": false,
      "adaptive": false
    },
    "Ford": {
      "localPath": "../assets/identity/ford.webp",
      "sourceUrl": "https://ford.lk/assets/logo-lg-76IkHtvU.webp",
      "dark": false,
      "adaptive": false
    },
    "GAC": {
      "localPath": "../assets/identity/gac.png",
      "sourceUrl": "https://br-www-resouce-cdn.gacgroup.com/www/static/png/GAC-1792653511873.174115eb.png",
      "dark": false,
      "adaptive": false
    },
    "GWM": {
      "localPath": "../assets/identity/gwm.png",
      "sourceUrl": "https://www.gwm-global.com/dist/images/home-page/cc_logo-20250120.png",
      "dark": false,
      "adaptive": false
    },
    "Geely": {
      "localPath": "../assets/identity/geely.png",
      "sourceUrl": "https://logos-world.net/wp-content/uploads/2021/09/Geely-Auto-Logo.png",
      "dark": false,
      "adaptive": false
    },
    "Honda": {
      "localPath": "../assets/identity/honda.png",
      "sourceUrl": "https://images.seeklogo.com/logo-png/53/2/honda-new-logo-png_seeklogo-531543.png",
      "dark": false,
      "adaptive": false
    },
    "Isuzu": {
      "localPath": "../assets/identity/isuzu.png",
      "sourceUrl": "https://www.isuzu.co.jp/world/app-files/img/cmn_logo02.png",
      "dark": false,
      "adaptive": false
    },
    "Land Rover": {
      "localPath": "../assets/identity/land-rover.svg",
      "sourceUrl": "https://www.landrover.co.uk/",
      "dark": false,
      "adaptive": false
    },
    "Mercedes-Benz": {
      "localPath": "../assets/identity/mercedes-benz.png",
      "sourceUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/Mercedes-Benz_Logo_2010.svg/3840px-Mercedes-Benz_Logo_2010.svg.png",
      "dark": false,
      "adaptive": false
    },
    "MG": {
      "localPath": "../assets/identity/mg.png",
      "sourceUrl": "https://mgsrilanka.lk/wp-content/uploads/2025/05/MG-Cars-Logo.png",
      "dark": false,
      "adaptive": false
    },
    "Micro": {
      "localPath": "../assets/identity/micro.png",
      "sourceUrl": "https://microcars.lk/wp-content/uploads/2025/12/Micro-Logo.png",
      "dark": false,
      "adaptive": false
    },
    "Mitsubishi": {
      "localPath": "../assets/identity/mitsubishi.png",
      "sourceUrl": "https://wieck-mmna-production.s3.amazonaws.com/photos/dd6a25afee219fc074f97ffc380ace7d33f2d144/preview-928x522.jpg",
      "dark": false,
      "adaptive": false
    },
    "Perodua": {
      "localPath": "../assets/identity/perodua.svg",
      "sourceUrl": "https://www.peroduasl.lk/img/navigation/perodua-logo.svg",
      "dark": false,
      "adaptive": false
    },
    "Porsche": {
      "localPath": "../assets/identity/porsche.png",
      "sourceUrl": "https://www.edigitalagency.com.au/wp-content/uploads/Porsche-logo-PNG-large-size.png + https://cdn.freebiesupply.com/logos/large/2x/porsche-1-logo-black-and-white.png",
      "dark": false,
      "adaptive": false
    },
    "Suzuki": {
      "localPath": "../assets/identity/suzuki.svg",
      "sourceUrl": "https://www.suzuki.co.jp/",
      "dark": false,
      "adaptive": false
    },
    "Tata": {
      "localPath": "../assets/identity/tata.svg",
      "sourceUrl": "https://www.tatamotors.com/wp-content/themes/TataMotors/images/Tata-Motors-logo.svg",
      "dark": false,
      "adaptive": false
    },
    "Toyota": {
      "localPath": "../assets/identity/toyota.png",
      "sourceUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Logo_Toyota.svg/960px-Logo_Toyota.svg.png",
      "dark": false,
      "adaptive": false
    },
    "Volkswagen": {
      "localPath": "../assets/identity/volkswagen.png",
      "sourceUrl": "https://uploads.vw-mms.de/system/production/images/vwn/030/145/images/7a0d84d3b718c9a621100e43e581278433114c82/DB2019AL01950_web_1600.jpg",
      "dark": false,
      "adaptive": false
    },
    "Audi": {
      "localPath": "../assets/identity/audi.svg",
      "sourceUrl": "https://static.audi.com/assets/images/frontend/Audi_Rings_wh-RGB-5SRAGCO4.svg",
      "dark": false,
      "adaptive": true
    },
    "BYD": {
      "localPath": "../assets/identity/byd.svg",
      "sourceUrl": "https://www.byd.com/static_material/byd/overseas/public-icon/logo.svg",
      "dark": false,
      "adaptive": false
    },
    "Chery": {
      "localPath": "../assets/identity/chery.png",
      "sourceUrl": "https://logos-world.net/wp-content/uploads/2021/08/Chery-Emblem.png",
      "dark": false,
      "adaptive": false
    },
    "Deepal": {
      "localPath": "../assets/identity/deepal.svg",
      "sourceUrl": "https://deepal.lk/images/deepal.svg",
      "dark": false,
      "adaptive": true
    },
    "Hyundai": {
      "localPath": "../assets/identity/hyundai.png",
      "sourceUrl": "https://www.hyundai.com/worldwide/en",
      "dark": false,
      "adaptive": true
    },
    "Jaguar": {
      "localPath": "../assets/identity/jaguar.png",
      "sourceUrl": "https://www.jaguar.lk/_nuxt/icons/icon_144x144.cca3cc.png + https://images.seeklogo.com/logo-png/56/2/jaguar-new-2025-logo-png_seeklogo-563810.png",
      "dark": false,
      "adaptive": false
    },
    "Jeep": {
      "localPath": "../assets/identity/jeep.png",
      "sourceUrl": "https://www.jeep.com/content/dam/fca-brands/na/jeep/en_us/global/header/logo-jeep.png",
      "dark": false,
      "adaptive": true
    },
    "Jetour": {
      "localPath": "../assets/identity/jetour.svg",
      "sourceUrl": "Jetour Official Inline SVG",
      "dark": false,
      "adaptive": true
    },
    "Kia": {
      "localPath": "../assets/identity/kia.png",
      "sourceUrl": "https://logos-world.net/wp-content/uploads/2021/03/Kia-Logo.png",
      "dark": false,
      "adaptive": false
    },
    "Leapmotor": {
      "localPath": "../assets/identity/leapmotor.png",
      "sourceUrl": "https://images.seeklogo.com/logo-png/50/2/leapmotor-logo-png_seeklogo-505249.png",
      "dark": false,
      "adaptive": false
    },
    "Lexus": {
      "localPath": "../assets/identity/lexus.svg",
      "sourceUrl": "https://www.lexus.com/content/dam/lexus/content-fragments/navigation/global-nav-v2/assets/lexus-logo.svg",
      "dark": false,
      "adaptive": true
    },
    "Mahindra": {
      "localPath": "../assets/identity/mahindra.png",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/d/da/Mahindra_Automotive_new_logo.png",
      "dark": false,
      "adaptive": false
    },
    "Mazda": {
      "localPath": "../assets/identity/mazda.png",
      "sourceUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Mazda_logo_2024.svg/1920px-Mazda_logo_2024.svg.png",
      "dark": false,
      "adaptive": false
    },
    "MINI": {
      "localPath": "../assets/identity/mini.svg",
      "sourceUrl": "https://www.mini.com/etc.clientlibs/settings/wcm/designs/minidigital-white/images/logo/resources/mini-logo.svg",
      "dark": false,
      "adaptive": true
    },
    "Nissan": {
      "localPath": "../assets/identity/nissan.png",
      "sourceUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Nissan_2020_logo.svg/1280px-Nissan_2020_logo.svg.png",
      "dark": false,
      "adaptive": false
    },
    "Peugeot": {
      "localPath": "../assets/identity/peugeot.png",
      "sourceUrl": "https://thumb.wikimedia.org/wikipedia/en/thumb/9/9d/Peugeot_2021_Logo.svg/1280px-Peugeot_2021_Logo.svg.png",
      "dark": false,
      "adaptive": true
    },
    "Renault": {
      "localPath": "../assets/identity/renault.png",
      "sourceUrl": "https://logos-world.net/wp-content/uploads/2021/04/Renault-Logo.png",
      "dark": false,
      "adaptive": true
    }
  },
  "models": {
    "Suzuki Celerio": {
      "localPath": "../assets/identity/model-27a0f01c2a9088f46b3b.png",
      "sourceUrl": "https://www.suzuki.lk/vehicles/celerio-auto/",
      "imageUrl": "https://www.suzuki.lk/wp-content/uploads/Celerio-Logo-White-PNG.png"
    },
    "Suzuki Fronx": {
      "localPath": "../assets/identity/model-08ee5153a8d064eac4ba.png",
      "sourceUrl": "https://www.suzuki.lk/vehicles/fronx-auto/",
      "imageUrl": "https://www.suzuki.lk/wp-content/uploads/Fronx-Logo-White-PNG.png"
    }
  }
};

  __exports.identity = identity;
  })(__mods.mod_15_identity_data);

  // === bulk-selection.js ===
  __mods.mod_16_bulk_selection = {};
  (function(__exports) {
const {  validPrice  } = __mods.mod_7_vehicle_validation;
// Bulk selection is independent of pagination and never creates duplicate records.
function prepareBulkSelection(vehicles, selectedIds = []) {
  const selected = new Set(selectedIds), seen = new Set(), eligible = [], skipped = [];
  for (const v of vehicles) {
    if (selected.has(v.id) || seen.has(v.id)) continue;
    seen.add(v.id);
    if (!validPrice(v.price) || v.priceBasis === 'conflicting') { skipped.push(v); continue; }
    eligible.push(v);
  }
  return { eligible, skipped };
}

  __exports.prepareBulkSelection = prepareBulkSelection;
  })(__mods.mod_16_bulk_selection);

  // === catalogue-browser.js ===
  __mods.mod_5_catalogue_browser = {};
  (function(__exports) {
const {  formatDate: displayDate  } = __mods.mod_1_dates;
const {  baseVehicles: fallbackCatalogue  } = __mods.mod_6_market_catalogue;
const {  fmt, esc, minDownFor  } = __mods.mod_2_calculator;
const {  parseMoneyText, formatMoneyText, attachMoneyInput  } = __mods.mod_3_money_input;
const {  validPrice  } = __mods.mod_7_vehicle_validation;
const {  newVehicleId  } = __mods.mod_8_storage;
const {  openModal, closeModal  } = __mods.mod_10_modal;
const {  searchCatalogue  } = __mods.mod_11_catalogue_search;
const {  localStudioPhoto, NO_PHOTO  } = __mods.mod_12_image_fetcher;
const {  creditFor, photoForModel, formatCreditHtml  } = __mods.mod_13_photo_credits;
const {  identity: fallbackIdentity  } = __mods.mod_15_identity_data;
const {  prepareBulkSelection  } = __mods.mod_16_bulk_selection;
const getIdentity = () => (typeof window !== "undefined" && window.__VAHANAIQ_IDENTITY__) || fallbackIdentity;

function getUnifiedCatalogue(fallbackList = fallbackCatalogue) {
  const unified = (typeof window !== "undefined" && window.__VAHANAIQ_CATALOGUE__) || null;
  if (!unified?.models?.length) return fallbackList;

  const fallbackMap = new Map();
  for (const v of fallbackList) {
    fallbackMap.set(v.id, v);
    fallbackMap.set(`${v.make} ${v.model || v.name}`.toLowerCase(), v);
  }

  return unified.models.map(m => {
    const pricedOffers = (m.offers || []).filter(o => Number.isFinite(o.amount) && o.amount > 0);
    const best = pricedOffers.reduce((b, o) => !b || o.amount < b.amount ? o : b, null) || m.offers?.[0] || null;
    const existing = fallbackMap.get(m.id) || fallbackMap.get(best?.id) || fallbackMap.get(`${m.make} ${m.model || m.name}`.toLowerCase()) || {};

    const photo = m.images?.[0]?.smallSrc || m.images?.[0]?.src || existing.img || "";
    const price = best && Number.isFinite(best.amount) && best.amount > 0 ? best.amount : (existing.price || null);
    const priceBasis = best && price ? (["official", "dealer", "launch"].includes(best.kind) ? (best.kind === "launch" ? "starting" : "published") : "estimated") : (existing.priceBasis || "unpublished");
    const cond = best?.condition || existing.cond || "New";
    const fuel = best?.fuel || m.offers?.find(o => o.fuel)?.fuel || existing.fuel || "";
    const route = best?.route === "Distributor" ? "Official" : best?.route === "Dealer Listing" ? "Dealer" : (existing.w || "Grey");
    const normBody = (m.body || "").toLowerCase() === "passenger car" ? "Passenger car" : m.body;

    let pt = existing.pt || (fuel ? `${fuel} Powertrain` : "");
    if (!existing.pt && best?.name && /turbo/i.test(best.name)) {
      pt = `${best.name.replace(m.make, "").trim()} Turbo`;
    }

    return {
      id: m.id,
      make: m.make,
      model: m.model,
      name: m.name,
      body: normBody,
      trim: best?.trim || existing.trim || null,
      year: best?.year || existing.year || null,
      fuel: fuel,
      pt: pt,
      km: existing.km || "",
      w: route,
      cond: cond,
      price: price,
      priceBasis: priceBasis,
      priceCheckedMonth: "2026-10",
      pricePublishedMonth: null,
      priceSourceUrl: (best?.sourceUrl || m.sourceUrl || "").replace(/^http:\/\//, "https://"),
      sourceUrl: (m.sourceUrl || "").replace(/^http:\/\//, "https://"),
      checkedOn: m.checkedOn || "2026-10-23",
      availability: best?.sourceStatus === "estimated" ? "estimated" : (existing.availability || "marketed"),
      img: photo,
      custom: false,
      priceVerification: price ? "confirmed" : "unverified",
      priceScope: "model",
      priceVerifiedOn: m.checkedOn || "2026-10-23",
      power: existing.power || "",
      torque: existing.torque || "",
      transmission: existing.transmission || "",
      drivetrain: existing.drivetrain || "FWD",
      seats: existing.seats || 5,
      groundClearance: existing.groundClearance || "",
      dimensions: existing.dimensions || "",
      safety: existing.safety || "",
      features: existing.features || "",
      warranty: existing.warranty || (route === "Official" ? "Official Agent Warranty" : "Importer / Seller Warranty"),
      offers: m.offers || []
    };
  });
}

const routeLabel = v => v.w === "Official" ? "Official agent range" : v.w === "Grey" ? "Importer listing" : "Independent seller listing";
const availabilityLabel = v => ({ "used-listed": "Used listing: confirm registration age", "import-service": "Past import example: enquire about availability", "brochure-listed": "Local brochure: enquire about availability", "configurator-listed": "Local configurator: enquire about availability" }[v.availability] || "Confirm stock with seller");
const safeUrl = url => /^https:\/\//.test(url || "") ? url : "";
const bodyLabel = body => body === "Passenger car" ? "Car" : body;
const FUELS = { Petrol: "Petrol", Diesel: "Diesel", HEV: "Hybrid", PHEV: "Plug-in hybrid", BEV: "Electric" };
const UNKNOWN_SPEC = "Specifications to confirm";
const photoFor = v => photoForModel(v);
const hasPrice = v => validPrice(v.price);
const publishedPrice = v => hasPrice(v) && ['published', 'starting'].includes(v.priceBasis);
// Published prices first, then conflicting sources, then price on request
const priceRank = v => publishedPrice(v) ? 0 : hasPrice(v) && v.priceBasis !== "conflicting" ? 1 : 2;
const byName = (a, b) => a.make.localeCompare(b.make) || a.name.localeCompare(b.name);
const SORTS = {
  priced: (a, b) => priceRank(a) - priceRank(b) || byName(a, b),
  "price-asc": (a, b) => priceRank(a) - priceRank(b) || (hasPrice(a) ? a.price - b.price : 0) || byName(a, b),
  "price-desc": (a, b) => priceRank(a) - priceRank(b) || (hasPrice(a) ? b.price - a.price : 0) || byName(a, b),
  name: byName
};
const FILTERS = ["catalogueMake", "catalogueBody", "catalogueFuel", "catalogueRoute", "cataloguePriceFilter", "catalogueAffordability"];

function matchesFilters(v, f) {
  if (f.catalogueMake && v.make !== f.catalogueMake) return false;
  if (f.catalogueBody && v.body !== f.catalogueBody) return false;
  if (f.catalogueFuel && (f.catalogueFuel === "unknown" ? v.fuel : v.fuel !== f.catalogueFuel)) return false;
  if (f.catalogueRoute && v.w !== f.catalogueRoute) return false;
  if (f.cataloguePriceFilter === "priced" && !publishedPrice(v)) return false;
  return true;
}

// terms() returns { f, down }: the rental per rupee financed and the chosen down payment (%)
function initCatalogue({ isSelected, onAdd, onAddBatch, terms }) {
  const $ = id => document.getElementById(id);
  if (!$("openCatalogueBtn")) return () => {}; // Non-browser verification hosts.
  const pageSize = 12;
  let page = 0, pending = null, selection = "";

  const catalogue = getUnifiedCatalogue();

  const count = (key, value) => catalogue.filter(v => v[key] === value).length;
  $("catalogueMake").insertAdjacentHTML("beforeend", [...new Set(catalogue.map(v => v.make))].sort()
    .map(m => `<option value="${esc(m)}">${esc(m)} (${count("make", m)})</option>`).join(""));
  $("catalogueFuel").insertAdjacentHTML("beforeend", Object.entries(FUELS).filter(([k]) => count("fuel", k))
    .map(([k, label]) => `<option value="${k}">${label} (${count("fuel", k)})</option>`).join("") +
    `<option value="unknown">Not yet confirmed (${catalogue.filter(v => !v.fuel).length})</option>`);

  const filterValues = () => Object.fromEntries(FILTERS.map(id => [id, $(id).value]));

  // Estimated rental for a priced car, at its legal minimum down payment or the chosen one if higher
  function rentalLine(v, t) {
    if (!hasPrice(v) || v.priceBasis === 'conflicting' || !t || !(t.f > 0)) return "";
    const down = Math.max(t.down, minDownFor(v.cond, v.financeClass, v.firstRegisteredOn));
    return down < 100 ? `About LKR ${fmt(v.price * (1 - down / 100) * t.f)} a month with ${down}% down` : "";
  }

  // One line for every car without a price: what each LKR 1.00 million of quote costs a month
  function perMillionLine(t) {
    if (!t || !(t.f > 0)) return "";
    const down = Math.max(t.down, minDownFor("New"));
    return down < 100 ? `No price yet? Each LKR 1.00 million of a brand-new car's quote is about LKR ${fmt(1e6 * (1 - down / 100) * t.f)} a month with ${down}% down.` : "";
  }

  function priceText(v) {
    if (v.priceBasis === 'conflicting') return 'Price needs confirmation';
    if (hasPrice(v) && !publishedPrice(v)) return `Unverified estimate · LKR ${fmt(v.price)}`;
    if (hasPrice(v)) return `${v.priceBasis === "starting" ? "From " : ""}LKR ${fmt(v.price)}`;
    return v.priceBasis === "conflicting" ? "Prices differ between sources" : "Price on request";
  }

  function card(v, t) {
    const ident = getIdentity();
    const selected = isSelected(v.id);
    const photo = v.img || photoFor(v);
    const candidateCredit = creditFor(v);
    const credit = candidateCredit?.img === photo ? candidateCredit : null;
    const specs = [v.pt && v.pt !== UNKNOWN_SPEC ? v.pt : "", v.km].filter(Boolean).join(" · ");
    const pills = [v.trim, v.power, v.drivetrain, v.seats ? `${v.seats} seats` : "", v.groundClearance ? `${v.groundClearance} clearance` : ""].filter(Boolean).slice(0, 3);
    const detailRows = [
      ["Trim", v.trim],
      ["Output", [v.power, v.torque].filter(Boolean).join(" · ")],
      ["Drive & Gearbox", [v.transmission, v.drivetrain].filter(Boolean).join(" · ")],
      ["Dimensions", v.dimensions],
      ["Safety", v.safety],
      ["Features", v.features],
      ["Warranty", v.warranty]
    ].filter(([, val]) => val);
    const link = hasPrice(v) ? { href: v.priceSourceUrl || v.sourceUrl, text: "View Price Source" } : { href: v.sourceUrl, text: "Request a Price" };
    const rent = rentalLine(v, t);
    return `<article class="catalogue-card">
        <div class="catalogue-photo${photo ? "" : " is-empty"}">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" width="400" height="250">` : NO_PHOTO}</div>
        <div class="catalogue-card-head">
          <span class="catalogue-category">${ident.brands?.[v.make] ? `<img class="brand-mark" src="${esc(ident.brands[v.make].localPath.replace("../", ""))}" alt="">` : ""}${esc(bodyLabel(v.body))} · ${esc(v.make)}</span>
          ${ident.models?.[`${v.make} ${v.model}`] ? `<img class="model-mark" src="${esc(ident.models[`${v.make} ${v.model}`].localPath.replace("../", ""))}" alt="">` : ""}
        </div>
        <h3>${esc(v.name)}${v.year ? ` (${v.year})` : ""}</h3>
        ${specs ? `<p class="hint catalogue-specs-line">${esc(specs)}</p>` : ""}
        ${pills.length ? `<div class="catalogue-spec-pills">${pills.map(p => `<span class="spec-pill">${esc(p)}</span>`).join("")}</div>` : ""}
        <div class="catalogue-price-block">
          <p class="catalogue-price${hasPrice(v) ? "" : " is-unpriced"}">${priceText(v)}</p>
          ${rent ? `<p class="hint catalogue-rent">${rent}</p>` : ""}
        </div>
        ${detailRows.length ? `<details class="catalogue-spec-details"><summary>Specifications &amp; trim details</summary><dl class="catalogue-spec-grid">${detailRows.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join("")}</dl></details>` : ""}
        <div class="catalogue-card-foot">
          <p class="hint catalogue-provenance">${esc(routeLabel(v))} · ${esc(availabilityLabel(v))}${v.priceVerifiedOn ? ` · Verified ${displayDate(v.priceVerifiedOn)}` : ""}</p>
          <div class="source-links"><a href="${esc(safeUrl(link.href))}" target="_blank" rel="noopener noreferrer">${link.text}<span class="sr-only"> for ${esc(v.name)}</span> ↗</a>${credit ? formatCreditHtml(credit) : ""}</div>
          <button class="btn-outline" type="button" data-catalogue-id="${esc(v.id)}" ${selected ? "disabled" : ""} aria-label="${selected ? "In comparison" : "Choose"} ${esc(v.name)}">${selected ? "In Comparison ✓" : "Choose & Add"}</button>
        </div>
      </article>`;
  }

  function render() {
    const f = filterValues();
    const t = terms ? terms() : null;
    const active = FILTERS.filter(id => f[id]).length;
    const matches = searchCatalogue(catalogue, $("catalogueSearch").value).filter(v => matchesFilters(v, f) && fitsBudget(v, f, t))
      .sort(SORTS[$("catalogueSort").value] || SORTS.priced);
    page = Math.min(page, Math.max(0, Math.ceil(matches.length / pageSize) - 1));
    const start = page * pageSize;
    const priced = matches.filter(v => hasPrice(v) && ['published', 'starting'].includes(v.priceBasis)).length;
    $("catalogueCount").textContent = matches.length
      ? `${start + 1}–${Math.min(start + pageSize, matches.length)} of ${matches.length} vehicles · ${priced} with a published price`
      : "No matching vehicles. Try another make or model, or clear the filters.";
    $("catalogueClearFilters").hidden = !active && !$("catalogueSearch").value;
    $("catalogueFiltersCount").textContent = active ? `(${active})` : "";
    $("cataloguePerMillion").textContent = f.catalogueAffordability === 'within' && !t?.income ? 'Enter your net income and loan terms above to filter by monthly budget.' : f.catalogueAffordability === 'within' ? `Using your income, existing payments, insurance, ${t.down}% down and current loan terms. Source-backed prices only; starting prices may increase. Deposit savings are checked in the planner.` : priced ? '' : perMillionLine(t);
    $("catalogueResults").innerHTML = matches.slice(start, start + pageSize).map(v => card(v, t)).join("");
    $("cataloguePrev").disabled = page === 0;
    $("catalogueNext").disabled = start + pageSize >= matches.length;
    $("cataloguePage").textContent = `Page ${page + 1} of ${Math.max(1, Math.ceil(matches.length / pageSize))}`;
    for (const [id, scope] of [["catalogueAddAll", catalogue], ["catalogueAddSearch", searchCatalogue(catalogue, $("catalogueSearch").value)], ["catalogueAddFiltered", matches]]) {
      const b = $(id); if (!b) continue;
      const pending = scope.filter(v => !isSelected(v.id));
      const { eligible } = prepareBulkSelection(pending);
      const isSearchBtn = id === 'catalogueAddSearch';
      const hasSearch = Boolean($("catalogueSearch").value.trim());
      b.disabled = !eligible.length || (isSearchBtn && !hasSearch);
      b.querySelector('.bulk-count').textContent = (isSearchBtn && !hasSearch) ? '0' : eligible.length;
    }
  }

  for (const id of ['catalogueAddAll', 'catalogueAddSearch', 'catalogueAddFiltered']) if ($(id)) $(id).addEventListener('click', () => {
    const searched = searchCatalogue(catalogue, $("catalogueSearch").value);
    const scope = id === 'catalogueAddAll' ? catalogue : id === 'catalogueAddSearch' ? searched : searched.filter(v => matchesFilters(v, filterValues()) && fitsBudget(v, filterValues(), terms?.()));
    const { eligible, skipped } = prepareBulkSelection(scope, catalogue.filter(v => isSelected(v.id)).map(v => v.id));
    if (!eligible.length || !onAddBatch) return;
    const batch = eligible.map(v => ({ ...v, id: newVehicleId(), catalogueId: v.id, cond: v.cond || 'New', conditionAssumed: !v.cond, img: v.img || photoFor(v), custom: true, legacy: false }));
    if (!onAddBatch(batch, skipped.length)) return;
    closeModal($("catalogueModal"));
    $("h-list").focus(); render();
  });

  function fitsBudget(v, f, t) {
    if (f.catalogueAffordability !== 'within') return true;
    if (!t?.income || !publishedPrice(v) || v.priceBasis === 'conflicting' || t.room < 0) return false;
    const down = Math.max(t.down, minDownFor(v.cond, v.financeClass, v.firstRegisteredOn));
    return v.price * (1 - down / 100) * t.f <= t.room;
  }

  const open = opener => {
    render();
    openModal($("catalogueModal"), opener, $("catalogueSearch"));
  };
  for (const id of ["addVehicleBtn", "openCatalogueBtn"]) if ($(id)) $(id).addEventListener("click", () => open($(id)));
  $("browseEmptyBtn").addEventListener("click", () => open($("browseEmptyBtn")));
  $("closeCatalogueBtn").addEventListener("click", () => closeModal($("catalogueModal")));
  $("catalogueSearch").addEventListener("input", () => { page = 0; render(); });
  for (const id of [...FILTERS, "catalogueSort"]) $(id).addEventListener("change", () => { page = 0; render(); });
  $("catalogueClearFilters").addEventListener("click", () => {
    $("catalogueSearch").value = "";
    for (const id of FILTERS) $(id).value = "";
    page = 0;
    render();
    $("catalogueSearch").focus();
  });
  $("catalogueFiltersToggle").addEventListener("click", () => {
    const open = $("catalogueFiltersToggle").getAttribute("aria-expanded") !== "true";
    $("catalogueFiltersToggle").setAttribute("aria-expanded", String(open));
    $("catalogueFilters").classList.toggle("collapsed", !open);
  });
  for (const [id, delta] of [["cataloguePrev", -1], ["catalogueNext", 1]]) $(id).addEventListener("click", () => { page += delta; render(); $("catalogueCount").focus(); });

  $("catalogueResults").addEventListener("click", event => {
    const button = event.target.closest("button[data-catalogue-id]");
    if (!button) return;
    pending = catalogue.find(v => v.id === button.dataset.catalogueId);
    if (!pending || isSelected(pending.id)) return;
    $("catalogueAddTitle").textContent = `Compare ${pending.name}`;
    $("catalogueName").value = pending.name + (pending.year ? ` (${pending.year})` : "");
    $("catalogueCondition").value = pending.cond || "";
    $("cataloguePrice").value = validPrice(pending.price) && pending.priceBasis !== 'conflicting' ? formatMoneyText(String(pending.price)) : "";
    $("cataloguePriceNote").textContent = pending.priceBasis === "conflicting" ? "The source does not establish a reliable price for this variant. Enter a confirmed quote." : publishedPrice(pending) ? "Source-backed asking/starting amount, checked " + displayDate(pending.priceVerifiedOn || pending.checkedOn) + ". Confirm the exact specification and current quote." : validPrice(pending.price) ? "Unverified catalogue estimate. Replace it with a seller quote before relying on the calculation." : "No verified price is published here. Enter your quote to calculate a lease.";
    $("catalogueAddError").textContent = "";

    if ($("catalogueTrimWrap") && $("catalogueTrimSelect")) {
      const offers = pending.offers || [];
      if (offers.length > 1) {
        $("catalogueTrimWrap").hidden = false;
        $("catalogueTrimSelect").innerHTML = offers.map((o, idx) =>
          `<option value="${idx}">${esc(o.name || o.trim || pending.name)}${o.amount ? ` · LKR ${fmt(o.amount)}` : ""}${o.condition ? ` (${esc(o.condition)})` : ""}</option>`
        ).join("");
        $("catalogueTrimSelect").value = "0";
      } else {
        $("catalogueTrimWrap").hidden = true;
      }
    }

    openModal($("catalogueAddModal"), button, $("cataloguePrice"));
  });

  if ($("catalogueTrimSelect")) {
    $("catalogueTrimSelect").addEventListener("change", () => {
      if (!pending?.offers) return;
      const o = pending.offers[Number($("catalogueTrimSelect").value)];
      if (!o) return;
      $("catalogueName").value = o.name || (pending.name + (o.trim ? ` ${o.trim}` : ""));
      $("catalogueCondition").value = o.condition || pending.cond || "New";
      $("cataloguePrice").value = validPrice(o.amount) ? formatMoneyText(String(o.amount)) : "";
      $("cataloguePriceNote").textContent = o.amount ? `Source-backed amount (${o.kind || "published"}), checked ${displayDate(o.checkedOn || pending.checkedOn)}. Confirm current quote.` : "No published price for this variant; enter quote.";
    });
  }

  for (const id of ["closeCatalogueAddBtn", "cancelCatalogueAddBtn"]) $(id).addEventListener("click", () => closeModal($("catalogueAddModal")));
  attachMoneyInput($("cataloguePrice"));
  window.addEventListener("vahanaiq:copy-reset", () => { pending = null; });
  $("catalogueAddForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!pending) return;
    const price = parseMoneyText($("cataloguePrice").value);
    const name = $("catalogueName").value.trim();
    const cond = $("catalogueCondition").value;
    if (!name || !validPrice(price) || !["New", "Recond", "Recent", "Used"].includes(cond)) {
      $("catalogueAddError").textContent = "Enter a vehicle name, a price greater than zero and a condition.";
      return;
    }
    const published = price === pending.price && cond === pending.cond;
    const vehicle = { ...pending, id: newVehicleId(), catalogueId: pending.id, name, price, cond,
      img: pending.img || photoFor(pending),
      custom: true, legacy: false, priceBasis: published ? pending.priceBasis : "user-entered",
      priceSourceUrl: published ? pending.priceSourceUrl : null, priceCheckedMonth: published ? pending.priceCheckedMonth : null };
    if (!onAdd(vehicle)) return;
    closeModal($("catalogueAddModal"));
    closeModal($("catalogueModal"));
    $("h-list").focus();
    render();
  });
  const checked = catalogue.map(v => v.checkedOn).filter(Boolean).sort().pop();
  $("catalogueCoverage").textContent = `${catalogue.length} vehicles across ${new Set(catalogue.map(v => v.make)).size} makes, sources checked ${displayDate(checked)}. Published prices and unverified estimates are labelled separately. Ask the seller for a current quote. Photos may differ from the exact trim. Pickup/van registration classes and lender valuations need confirmation. Further brands, trims and used models are still being checked.`;
  render();
  return () => {
    const next = catalogue.filter(v => isSelected(v.id)).map(v => v.id).join("|");
    if (next !== selection) { selection = next; render(); }
  };
}

  __exports.getUnifiedCatalogue = getUnifiedCatalogue;
  __exports.initCatalogue = initCatalogue;
  })(__mods.mod_5_catalogue_browser);

  // === canvas-utils.js ===
  __mods.mod_17_canvas_utils = {};
  (function(__exports) {
// HTML5 Canvas Normalisation Engine: 8:5 Studio Plate on Pure White (#FFFFFF)
function normalizeImageToStudio(src, callback) {
  if (!src || typeof src !== "string" || !src.trim()) {
    callback("");
    return;
  }
  const cleanSrc = src.trim();
  if (typeof window !== "undefined" && (cleanSrc === window.location.href || cleanSrc === window.location.origin + window.location.pathname)) {
    callback("");
    return;
  }

  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 250;
      const ctx = canvas.getContext("2d");

      // Solid white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 250);

      // Scale to fit within 360 x 210 with 20px padding
      const maxW = 360, maxH = 210;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      const dx = (400 - dw) / 2, dy = (250 - dh) / 2;

      // Soft ground contact shadow beneath tyres
      const sy = dy + dh - 4;
      const grad = ctx.createRadialGradient(200, sy, dw * 0.15, 200, sy, dw * 0.5);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.18)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(200, sy, dw * 0.45, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw vehicle
      ctx.drawImage(img, dx, dy, dw, dh);
      callback(canvas.toDataURL("image/jpeg", 0.88));
    } catch (err) {
      // Tainted canvas due to CORS or local origin - pass raw src through
      callback(cleanSrc);
    }
  };

  img.onerror = () => {
    // If CORS-enabled load failed, try loading without crossOrigin to verify if image exists
    const fallbackImg = new Image();
    fallbackImg.onload = () => {
      // Image exists but doesn't allow CORS for canvas manipulation; pass through valid URL
      callback(cleanSrc);
    };
    fallbackImg.onerror = () => {
      // Image truly failed (404, broken URL, etc.); return empty string so broken URL is never saved
      callback("");
    };
    fallbackImg.src = cleanSrc;
  };

  img.src = cleanSrc;
}
  __exports.normalizeImageToStudio = normalizeImageToStudio;
  })(__mods.mod_17_canvas_utils);

  // === gemini.js ===
  __mods.mod_18_gemini = {};
  (function(__exports) {
// Vehicle search through the VahanaIQ proxy, which holds the Gemini key and model choice
const {  getProxyUrl  } = __mods.mod_8_storage;
const {  expectsComparison, validateSearchResponse  } = __mods.mod_7_vehicle_validation;
const VEHICLE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_available_in_sri_lanka: { type: "BOOLEAN" },
    is_multi_vehicle: {
      type: "BOOLEAN",
      description: "Set to true if user asked to compare multiple vehicles or find best vehicles in a budget"
    },
    discovered_vehicles: {
      type: "ARRAY",
      description: "List of discovered or compared vehicles when is_multi_vehicle is true",
      items: {
        type: "OBJECT",
        properties: {
          model_name: { type: "STRING" },
          year: { type: "INTEGER" },
          trim_name: { type: "STRING" },
          powertrain: { type: "STRING" },
          fuel_economy_kml: { type: "STRING" },
          condition: { type: "STRING", enum: ["New", "Recond", "Used"] },
          warranty_type: { type: "STRING", enum: ["Official", "Grey"] },
          price_lkr: { type: "INTEGER" },
          wikipedia_slug: { type: "STRING" }
        },
        required: ["model_name", "year", "trim_name", "powertrain", "condition", "warranty_type", "price_lkr"]
      }
    },
    model_name: {
      type: "STRING",
      description: "Canonical make + model without year, e.g. Toyota Yaris Cross"
    },
    wikipedia_slug: {
      type: "STRING",
      description: "Canonical English Wikipedia page title for image lookup, e.g. Toyota_Yaris_Cross"
    },
    availability_notes: { type: "STRING" },
    import_route: {
      type: "STRING",
      enum: ["Official Agent", "Grey Import", "Registered Fleet"]
    },
    seller_price_lkr: {
      type: "INTEGER",
      description: "Seller asking price in LKR if extracted from classified ad text, listing, or auction sheet, else 0"
    },
    detected_condition: {
      type: "STRING",
      enum: ["New", "Recond", "Used"]
    },
    reason: {
      type: "STRING",
      description: "Reason if vehicle is unavailable or not road-legal in Sri Lanka"
    },
    alternatives: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    model_years: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          year: { type: "INTEGER" },
          trims: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                trim_name: { type: "STRING" },
                powertrain: { type: "STRING" },
                fuel_economy_kml: { type: "STRING" },
                warranty_type: {
                  type: "STRING",
                  enum: ["Official", "Grey"]
                },
                condition_prices: {
                  type: "OBJECT",
                  properties: {
                    brand_new: { type: "INTEGER" },
                    recond: { type: "INTEGER" },
                    used_low: { type: "INTEGER" },
                    used_med: { type: "INTEGER" }
                  },
                  required: ["brand_new", "recond", "used_low", "used_med"]
                }
              },
              required: ["trim_name", "powertrain", "fuel_economy_kml", "warranty_type", "condition_prices"]
            }
          }
        },
        required: ["year", "trims"]
      }
    }
  },
  required: [
    "is_available_in_sri_lanka",
    "is_multi_vehicle",
    "discovered_vehicles",
    "model_name",
    "wikipedia_slug",
    "availability_notes",
    "import_route",
    "model_years"
  ]
};

async function searchVehicle(query, imageObj = null) {
  const proxy = getProxyUrl();
  if (!proxy) throw new Error("No search proxy configured");
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(proxy, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, image: imageObj, comparison: expectsComparison(query) }),
        signal: controller.signal
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const busy = err.error === "upstream_unavailable" &&
          ([503, 504].includes(err.upstream_status) || /high demand/i.test(err.detail || ""));
        if (attempt === 0 && busy) continue; // One retry on the same model; never retry a quota error.
        const error = new Error(`${err.error || "http_error"}: ${err.detail || "HTTP " + res.status}`);
        error.code = err.error;
        throw error;
      }
      return validateSearchResponse(await res.json(), query);
    } finally {
      clearTimeout(timer);
    }
  }
}

  __exports.searchVehicle = searchVehicle;
  __exports.VEHICLE_RESPONSE_SCHEMA = VEHICLE_RESPONSE_SCHEMA;
  })(__mods.mod_18_gemini);

  // === inputs.js ===
  __mods.mod_19_inputs = {};
  (function(__exports) {
// Loan-term inputs: validation, snapping to the value actually used, and saving/sharing
const {  num, getSettings, flatToEffective, DOWN_MIN  } = __mods.mod_2_calculator;
const {  notifySaved  } = __mods.mod_8_storage;
const STORE_KEY = "vahanaiq_inputs_v1";

// Field id -> URL parameter and default value
const FIELDS = {
  rate: { param: "rate", def: "16" },
  rateType: { param: "rt", def: "reducing" },
  tenure: { param: "n", def: "84" },
  down: { param: "down", def: "60" },
  income: { param: "inc", def: "" },
  debt: { param: "debt", def: "" },
  dti: { param: "dti", def: "0.4" },
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
  rate: { key: "rateInput", check: v => v === "" ? "Enter an interest rate." : !(num(v) >= 0 && num(v) <= 40) ? "Enter a rate between 0 and 40%." : "" },
  tenure: { key: "n", check: v => v === "" || !isFinite(num(v)) ? "Enter a tenure in months." : "", snap: true },
  down: { key: "down", check: v => v === "" || !isFinite(num(v)) ? "Enter a down payment percentage." : num(v) < (Number($("down")?.min) || 40) || num(v) > 100 ? `Enter a down payment from ${Number($("down")?.min) || 40}% to 100%. New and recent passenger vehicles require at least 60% down (at most 40% financed).` : "", snap: true },
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

function fieldError(id) {
  const el = $(id);
  return el && RULES[id] ? RULES[id].check(String(el.value).trim()) : "";
}

// Reads the inputs, falling back to the last valid value for any invalid field
function readSettings() {
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
function snapField(id) {
  const el = $(id);
  if (!el || !RULES[id] || !RULES[id].snap) return;
  const hint = hintFor(id);
  const raw = String(el.value).trim();
  if (fieldError(id)) {
    if (id in lastValid) el.value = String(id === "down" ? Math.max(Number(el.min) || DOWN_MIN, lastValid[id]) : lastValid[id]);
    else if (id === "down") el.value = String(Number(el.min) || 60);
    snapNotes[id] = "Invalid entry replaced with the last valid value within the current limits.";
    return;
  }
  const used = id === "tenure" ? Math.min(84, Math.max(6, Math.round(num(raw)))) : Math.min(100, Math.max(Number(el.min) || DOWN_MIN, DOWN_MIN, num(raw)));
  if (used !== num(raw)) {
    snapNotes[id] = hint && hint.className.includes("warn") ? hint.textContent : (id === "tenure" ? "Set to the nearest allowed tenure" : "Set to the nearest allowed down payment");
    el.value = String(used);
  }
}

const clearSnapNote = id => { delete snapNotes[id]; };

// --- Persistence: a shared link's values win over this browser's saved values, which win
// over the defaults. Inputs are saved in this browser; the address bar is cleaned after
// a shared link is read, so income never stays in the URL or browser history. When the person
// signs in, js/account.js keeps a copy with their account too.

// Fields left out of a shared link unless the person chooses to include them
const PRIVATE_FIELDS = ["income", "debt"];
const SHARED_CARS_PARAM = "cars";

function loadState() {
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
function sharedCarsFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get(SHARED_CARS_PARAM);
    if (!raw) return [];
    const json = decodeURIComponent(escape(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))));
    const list = JSON.parse(json);
    return Array.isArray(list) ? list.slice(0, 30) : [];
  } catch (e) {
    return [];
  }
}

// Removes the shared link's values from the address bar once they're applied
function cleanUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (![SHARED_CARS_PARAM, ...Object.values(FIELDS).map(f => f.param)].some(k => params.has(k))) return;
    history.replaceState(null, "", window.location.pathname + window.location.hash);
  } catch (e) {}
}

// A link with the given inputs and vehicles; income and payments only when asked
function buildShareLink(state, cars, includePrivate) {
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
function saveState(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const diff = {};
    for (const [id, f] of Object.entries(FIELDS)) {
      if (state[id] !== undefined && String(state[id]) !== f.def) diff[id] = String(state[id]);
    }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(diff)); } catch (e) {}
    notifySaved();
  }, 400);
}

function clearState() {
  clearTimeout(saveTimer);
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  for (const id of Object.keys(lastValid)) delete lastValid[id];
  for (const id of Object.keys(snapNotes)) delete snapNotes[id];
}

  __exports.fieldError = fieldError;
  __exports.readSettings = readSettings;
  __exports.snapField = snapField;
  __exports.loadState = loadState;
  __exports.sharedCarsFromUrl = sharedCarsFromUrl;
  __exports.cleanUrl = cleanUrl;
  __exports.buildShareLink = buildShareLink;
  __exports.saveState = saveState;
  __exports.clearState = clearState;
  __exports.STORE_KEY = STORE_KEY;
  __exports.FIELDS = FIELDS;
  __exports.clearSnapNote = clearSnapNote;
  __exports.PRIVATE_FIELDS = PRIVATE_FIELDS;
  })(__mods.mod_19_inputs);

  // === toast.js ===
  __mods.mod_20_toast = {};
  (function(__exports) {
// Undo toast: one polite live region, about 6 seconds, paused while hovered or focused
const DURATION = 6000;
let el = null, timer = null, onTimeout = null, generation = 0;

// The live region (#toast) is in the page from the start so screen readers announce its updates
function ensure() {
  if (el) return el;
  el = document.getElementById("toast");
  const pause = () => clearTimeout(timer);
  const resume = () => { if (el.classList.contains("show") && !el.contains(document.activeElement) && !el.matches(":hover")) start(); };
  el.addEventListener("mouseenter", pause);
  el.addEventListener("focusin", pause);
  el.addEventListener("mouseleave", resume);
  el.addEventListener("focusout", () => setTimeout(resume, 0));
  return el;
}

function start() {
  clearTimeout(timer);
  timer = setTimeout(() => hide(true), DURATION);
}

function hide(expired) {
  if (!el) return;
  clearTimeout(timer);
  const hadFocus = el.contains(document.activeElement);
  el.classList.remove("show");
  el.textContent = "";
  if (hadFocus && onTimeout) onTimeout(expired);
}

// Shows "message [actionLabel]". afterHide() runs if focus was in the toast when it closes.
function showToast(message, actionLabel, onAction, afterHide) {
  const token = ++generation;
  const t = ensure();
  t.textContent = "";
  const span = document.createElement("span");
  span.textContent = message;
  t.appendChild(span);
  onTimeout = afterHide || null;
  let btn = null;
  if (actionLabel) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-outline btn-sm";
    btn.textContent = actionLabel;
    btn.addEventListener("click", () => { if (token !== generation) return; onTimeout = null; hide(false); onAction(); });
    t.appendChild(btn);
  }
  t.classList.add("show");
  start();
  return btn;
}

// Cancel retained actions before replacing an account-owned copy.
function clearToast() { generation++; onTimeout = null; hide(false); }

  __exports.showToast = showToast;
  __exports.clearToast = clearToast;
  })(__mods.mod_20_toast);

  // === planner-store.js ===
  __mods.mod_22_planner_store = {};
  (function(__exports) {
const {  notifySaved  } = __mods.mod_8_storage;
const PLANNER_KEY = 'vahanaiq_planner_v1';
const DRAFT_FIELDS = ['plannerVehicle','plannerGoal','plannerSaved','plannerMode','plannerPercent','plannerMonthly','plannerDate'];
const cleanDraft = value => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(DRAFT_FIELDS.filter(k => typeof value[k] === 'string').map(k => [k, value[k].slice(0,200)])) : {};
function cleanPlanner(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const draft = cleanDraft(value.draft);
  const scenarios = Array.isArray(value.scenarios) ? value.scenarios.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string' && s.draft && typeof s.draft === 'object' && !Array.isArray(s.draft)).slice(0,30).map(s => ({ id: s.id.slice(0,100), name: s.name.slice(0,100), draft: cleanDraft(s.draft), ...(typeof s.savedOn === 'string' ? {savedOn:s.savedOn.slice(0,10)} : {}) })) : [];
  return Object.keys(draft).length || scenarios.length ? { version: 1, draft, scenarios } : null;
}
function loadPlanner() { try { return cleanPlanner(JSON.parse(localStorage.getItem(PLANNER_KEY) || 'null')) || { version: 1, draft: {}, scenarios: [] }; } catch { return { version: 1, draft: {}, scenarios: [] }; } }
function savePlanner(value) { try { localStorage.setItem(PLANNER_KEY, JSON.stringify(cleanPlanner(value))); notifySaved(); return true; } catch { return false; } }

  __exports.cleanPlanner = cleanPlanner;
  __exports.loadPlanner = loadPlanner;
  __exports.savePlanner = savePlanner;
  __exports.PLANNER_KEY = PLANNER_KEY;
  })(__mods.mod_22_planner_store);

  // === account.js ===
  __mods.mod_21_account = {};
  (function(__exports) {
// Google sign-in and sync. Firebase (Google's sign-in and database service) loads only when
// someone opens the account dialog, or on a later visit once they have signed in, so the
// calculator never waits for it. Each person has one Firestore document, users/{uid}, with the
// same inputs and comparison this browser keeps in localStorage; firestore.rules let only its
// owner read, change or delete it. Before every write the account's copy is read and compared
// with the copy both sides last agreed on, so a change made on another device is never
// overwritten without asking.
const {  firebaseConfig, FIREBASE_SDK, GOOGLE_CLIENT_ID, GOOGLE_SIGN_IN_SRC  } = __mods.mod_9_config;
const {  openModal, closeModal, isOpen  } = __mods.mod_10_modal;
const {  showToast  } = __mods.mod_20_toast;
const {  COMPARISON_KEY, SAVED_EVENT  } = __mods.mod_8_storage;
const {  STORE_KEY  } = __mods.mod_19_inputs;
const {  PLANNER_KEY, cleanPlanner  } = __mods.mod_22_planner_store;
const SIGNED_IN_KEY = "vahanaiq_account_v1"; // set while signed in, so the next visit restores the session
const AGREED_KEY = "vahanaiq_synced_v1"; // fingerprint of the copy this browser and the account last agreed on
const WRITE_DELAY = 1500;
const MAX_SIZE = 900000; // firestore.rules refuse anything larger

const $ = id => document.getElementById(id);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  remove: k => { try { localStorage.removeItem(k); } catch (e) {} }
};

// --- What is synced (pure, tested in test/account.test.mjs)

// The copy kept in the account. Photos made in this browser (data: URLs) stay on this device:
// they are large, and the person can add them again.
function cloudCopy(inputs, comparison, planner = null) {
  const cars = Array.isArray(comparison?.cars) ? comparison.cars.filter(c => c && typeof c === "object") : [];
  const copy = {
    inputs: inputs && typeof inputs === "object" && !Array.isArray(inputs) ? inputs : {},
    cars: cars.map(c => /^data:/i.test(c.img || "") ? { ...c, img: "" } : c)
  };
  const clean = cleanPlanner(planner);
  if (clean) copy.planner = clean;
  return copy;
}

function parseCloud(data) {
  try {
    const parsed = JSON.parse(data?.data);
    return cloudCopy(parsed?.inputs, { cars: parsed?.cars }, parsed?.planner);
  } catch (e) {
    return cloudCopy(null, null);
  }
}

const isEmptyCopy = copy => !copy.cars.length && !Object.keys(copy.inputs).length && !copy.planner;

// A short hash (cyrb53) of a copy, so this browser can remember what it last agreed on
function fingerprint(copy) {
  const str = JSON.stringify(copy);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Which way to sync: "same", "upload", "download", "deleted" (removed from another device)
// or "ask" (both changed since they last agreed)
function syncDirection(local, cloud, agreed) {
  const l = fingerprint(local);
  if (!cloud) {
    if (agreed) return "deleted";
    return isEmptyCopy(local) ? "same" : "upload";
  }
  const c = fingerprint(cloud);
  if (l === c) return "same";
  if (c === agreed) return "upload";
  if (l === agreed) return "download";
  if (isEmptyCopy(local)) return "download";
  if (isEmptyCopy(cloud)) return "upload";
  return "ask";
}

// --- Firebase

let fb = null;
let loading = null;
let user = null;
let restoring = !!store.get(SIGNED_IN_KEY);
let conflict = null; // the account's copy while the person chooses which to keep
let failed = false;
let syncing = null, again = false, writeTimer = null;
let hooks = { reload: () => {}, beforeApply: () => {} };
let generation = 0;
let localSignOut = null;
let deleting = null;
const session = () => user && ({ uid: user.uid, generation, identity: user, firebase: fb });
const current = ctx => !!ctx && user?.uid === ctx.uid && generation === ctx.generation && fb === ctx.firebase;

function loadFirebase() {
  if (fb) return Promise.resolve(fb);
  loading = loading || Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-auth.js`),
    import(`${FIREBASE_SDK}/firebase-firestore-lite.js`)
  ]).then(([app, A, F]) => {
    const firebaseApp = app.initializeApp(firebaseConfig);
    // No pop-up helper up front: sign-in normally comes from Google's button (signInWithCredential)
    const auth = A.initializeAuth(firebaseApp, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence] });
    fb = { A, F, auth, db: F.getFirestore(firebaseApp) };
    A.onAuthStateChanged(fb.auth, onUser);
    return fb;
  }).catch(e => {
    loading = null;
    restoring = false;
    renderAccount();
    throw e;
  });
  return loading;
}

function onUser(u) {
  const previous = user;
  const storedOwner = store.get(SIGNED_IN_KEY);
  if (!previous && restoring && (!u || (storedOwner !== "1" && storedOwner !== u.uid))) {
    applyCopy(cloudCopy(null, null));
  }
  if (previous?.uid !== u?.uid) {
    generation++;
    clearTimeout(writeTimer);
    writeTimer = null;
    syncing = null;
    again = false;
    conflict = null;
    deleting = null;
    failed = false;
    // Initial anonymous use keeps its guest draft. A departed account never leaves its
    // private UI in another tab or gives it to a different account.
    if (previous && !(localSignOut?.uid === previous.uid && !u)) applyCopy(cloudCopy(null, null));
    store.remove(AGREED_KEY);
  }
  user = u;
  restoring = false;
  if (u) {
    store.set(SIGNED_IN_KEY, u.uid);
    syncNow();
  } else {
    store.remove(SIGNED_IN_KEY);
    store.remove(AGREED_KEY);
    conflict = null;
  }
  renderAccount();
}

const userDoc = ctx => ctx.firebase.F.doc(ctx.firebase.db, "users", ctx.uid);

function localCopy() {
  const read = k => { try { return JSON.parse(store.get(k) || "null"); } catch (e) { return null; } };
  return cloudCopy(read(STORE_KEY), read(COMPARISON_KEY), read(PLANNER_KEY));
}

const agree = copy => store.set(AGREED_KEY, fingerprint(copy));

async function upload(copy, ctx = session()) {
  if (!current(ctx)) return;
  const data = JSON.stringify(copy);
  if (data.length > MAX_SIZE) throw new Error("Comparison too large to sync");
  await ctx.firebase.F.setDoc(userDoc(ctx), { version: 1, data, updatedAt: ctx.firebase.F.serverTimestamp() });
  if (current(ctx)) agree(copy);
}

// Writes a copy to this browser and shows it, keeping this device's own photos
function applyCopy(copy) {
  hooks.beforeApply();
  const own = new Map();
  try {
    for (const c of JSON.parse(store.get(COMPARISON_KEY) || "{}")?.cars || []) {
      if (/^data:/i.test(c?.img || "")) own.set(c.id, c.img);
    }
  } catch (e) {}
  const cars = copy.cars.map(c => !c.img && own.has(c.id) ? { ...c, img: own.get(c.id) } : c);
  store.set(STORE_KEY, JSON.stringify(copy.inputs));
  store.set(COMPARISON_KEY, JSON.stringify({ version: 3, cars }));
  if (copy.planner) store.set(PLANNER_KEY, JSON.stringify(copy.planner));
  else store.remove(PLANNER_KEY);
  hooks.reload();
}

async function runSync(ctx) {
  try {
    const snap = await ctx.firebase.F.getDoc(userDoc(ctx));
    if (!current(ctx)) return;
    const cloud = snap.exists() ? parseCloud(snap.data()) : null;
    const local = localCopy();
    const direction = syncDirection(local, cloud, store.get(AGREED_KEY));
    if (direction === "same") agree(local);
    else if (direction === "upload") await upload(local, ctx);
    else if (direction === "download") {
      applyCopy(cloud);
      agree(cloud);
      showToast("Updated with the inputs and vehicles saved in your account.");
    } else if (direction === "deleted") {
      await signOutHere("Your saved data was deleted on another device, so this browser signed out and cleared it.", { flush: false, clear: "always" });
    } else {
      conflict = { copy: cloud, session: ctx };
      openAccount();
    }
    if (current(ctx)) failed = false;
  } catch (e) {
    if (!current(ctx)) return;
    console.warn("Account sync failed:", e);
    failed = true;
  }
}

function syncNow() {
  if (!user || conflict || current(deleting)) return Promise.resolve();
  if (syncing) { again = true; return syncing; }
  clearTimeout(writeTimer);
  writeTimer = null;
  const ctx = session();
  const pending = runSync(ctx).finally(() => {
    if (!current(ctx) || syncing !== pending) return;
    syncing = null;
    renderAccount();
    if (again) { again = false; syncNow(); }
  });
  syncing = pending;
  renderAccount();
  return pending;
}

function scheduleSync() {
  if (!user || conflict || current(deleting)) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(syncNow, WRITE_DELAY);
}

// --- Account dialog

function signInMessage(e) {
  switch (e?.code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Allow pop-ups for this site, then try again.";
    case "auth/network-request-failed":
      return "Couldn't reach Google. Check your connection and try again.";
    case "auth/unauthorized-domain":
    case "auth/operation-not-allowed":
      return "Google sign-in isn't available on this address.";
    default:
      return "Couldn't sign in. Try again in a moment.";
  }
}

function setError(message) {
  $("accountError").textContent = message;
  $("accountError").hidden = !message;
}

// Google's sign-in button, loaded with the dialog. Its callback gets an ID token, and Firebase
// signs in with it; no Firebase pop-up is involved, so Safari's storage rules don't get in the way.
let gsi = null;
function loadGoogleButton() {
  gsi = gsi || new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) { resolve(window.google.accounts.id); return; }
    const script = document.createElement("script");
    script.src = GOOGLE_SIGN_IN_SRC;
    script.async = true;
    script.onload = () => window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google sign-in unavailable"));
    script.onerror = () => reject(new Error("Couldn't load Google sign-in"));
    document.head.appendChild(script);
  }).then(id => {
    id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleCredential, ux_mode: "popup", context: "signin", locale: "en", auto_select: false });
    return id;
  }).catch(e => {
    gsi = null;
    throw e;
  });
  return gsi;
}

async function onGoogleCredential(response) {
  setError("");
  try {
    const f = await loadFirebase();
    await f.A.signInWithCredential(f.auth, f.A.GoogleAuthProvider.credential(response.credential));
  } catch (e) {
    setError(signInMessage(e));
  }
}

const darkTheme = () => {
  const set = document.documentElement.getAttribute("data-theme");
  return set ? set === "dark" : !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
};

function showPopupFallback() {
  $("googleSignIn").textContent = "";
  $("signInBtn").hidden = false;
}

// When Google refuses this site's address it leaves a placeholder and never shows its real
// button (an iframe), so after a few seconds without one, the Firebase pop-up button is offered
const GOOGLE_BUTTON_WAIT = 5000;
let fallbackTimer = null;

function renderGoogleButton() {
  clearTimeout(fallbackTimer);
  loadGoogleButton().then(id => {
    const box = $("googleSignIn");
    box.textContent = "";
    $("signInBtn").hidden = true;
    const boxWidth = Math.floor(box.getBoundingClientRect().width);
    const width = Math.max(200, Math.min(400, boxWidth || 400));
    id.renderButton(box, { type: "standard", theme: darkTheme() ? "filled_black" : "outline", size: "large", text: "signin_with", shape: "rectangular", logo_alignment: "left", width, locale: "en" });
    fallbackTimer = setTimeout(() => {
      if (![...box.querySelectorAll("iframe")].some(f => f.getBoundingClientRect().height > 0)) showPopupFallback();
    }, GOOGLE_BUTTON_WAIT);
  }, showPopupFallback);
}

function signIn() {
  if (!fb) return;
  setError("");
  // The popup opens straight from the click (Firebase is already loaded), so browsers allow it
  fb.A.signInWithPopup(fb.auth, new fb.A.GoogleAuthProvider(), fb.A.browserPopupRedirectResolver).catch(e => setError(signInMessage(e)));
}

// Signing out takes the account's inputs and vehicles out of this browser, unless some changes
// never reached the account. flush sends a pending change first (a sync already running passes
// false, since it is that sync); clear "always" removes them even then.
async function signOutHere(message, { flush = true, clear = "if-synced" } = {}) {
  const ctx = session();
  if (!current(ctx)) return;
  if (flush && (writeTimer || syncing)) await syncNow();
  if (!current(ctx)) return;
  clearTimeout(writeTimer);
  writeTimer = null;
  const unsynced = fingerprint(localCopy()) !== store.get(AGREED_KEY);
  conflict = null;
  store.remove(SIGNED_IN_KEY);
  store.remove(AGREED_KEY);
  localSignOut = ctx;
  try { await ctx.firebase.A.signOut(ctx.firebase.auth); } catch (e) { localSignOut = null; setError("Couldn’t sign out. Check your connection and try again."); return; }
  localSignOut = null;
  // Auth callbacks may already have ended this session. A replacement account owns
  // everything after that transition; the older operation must not touch it.
  if (user && !current(ctx)) return;
  window.google?.accounts?.id?.disableAutoSelect?.();
  user = null;
  if (isOpen($("accountModal"))) closeModal($("accountModal"));
  renderAccount();
  if (clear === "always" || !unsynced) {
    applyCopy(cloudCopy(null, null));
    showToast(message || "Signed out. Your inputs and vehicles are in your account, not this browser.");
  } else {
    showToast("Signed out. Some changes hadn't reached your account, so this browser kept them.");
  }
}

async function deleteData() {
  const ctx = session();
  if (!current(ctx)) return;
  if (current(deleting)) return;
  deleting = ctx;
  again = false;
  const btn = $("confirmDeleteBtn");
  btn.disabled = true;
  clearTimeout(writeTimer);
  writeTimer = null;
  try {
    if (syncing) await syncing;
    if (!current(ctx)) return;
    await ctx.firebase.F.deleteDoc(userDoc(ctx));
    if (!current(ctx)) return;
    // Also removes the sign-in record when Google allows it (it needs a recent sign-in)
    // Removing the app document is sufficient. The Google/Firebase identity may
    // be shared by an in-flight sign-in, so never delete or retarget that identity.
    await signOutHere("Deleted your saved inputs and vehicles from your account and this browser.", { flush: false, clear: "always" });
  } catch (e) {
    if (!current(ctx)) return;
    console.warn("Couldn't delete account data:", e);
    $("syncStatus").textContent = "Couldn't delete your saved data. Check your connection and try again.";
  } finally {
    if (deleting === ctx) deleting = null;
    if (user && !current(ctx)) return;
    btn.disabled = false;
    $("deleteConfirm").hidden = true;
  }
}

function resolveConflict(useAccount) {
  const choice = conflict;
  if (!choice || !current(choice.session) || current(deleting)) return;
  const { copy: cloud, session: ctx } = choice;
  conflict = null;
  if (useAccount) {
    applyCopy(cloud);
    agree(cloud);
    showToast("Now showing the inputs and vehicles saved in your account.");
    renderAccount();
  } else {
    const pending = upload(localCopy(), ctx).then(() => { if (current(ctx)) failed = false; }, e => { if (current(ctx)) { console.warn("Account sync failed:", e); failed = true; } })
      .finally(() => { if (current(ctx) && syncing === pending) { syncing = null; renderAccount(); } });
    syncing = pending;
    renderAccount();
  }
}

const count = copy => copy.cars.length === 1 ? "1 vehicle" : `${copy.cars.length} vehicles`;

function statusText() {
  if (conflict) return "Not syncing until you choose which copy to keep.";
  if (syncing) return "Syncing…";
  if (failed) return "Couldn't reach your account. VahanaIQ will try again when you next make a change.";
  return "Synced. Changes you make here are saved to your account.";
}

function renderAccount() {
  const btn = $("accountBtn");
  if (!btn) return;
  const name = user ? (user.displayName || "").trim().split(/\s+/)[0] || "Account" : "";
  btn.textContent = user ? name : restoring ? "Account" : "Sign In";
  btn.classList.toggle("needs-attention", !!user && (!!conflict || failed));
  btn.setAttribute("aria-label", user ? `Account: ${user.email || name}. ${statusText()}` : restoring ? "Account" : "Sign in to sync");

  $("accountSignedOut").hidden = !!user;
  $("accountSignedIn").hidden = !user;
  $("signInBtn").disabled = !fb;
  $("signInBtn").textContent = fb ? "Sign In with Google" : "Loading…";
  if (!user) {
    for (const id of ["accountEmail", "syncStatus", "syncConflictCounts"]) $(id).textContent = "";
    $("syncConflict").hidden = true;
    $("deleteConfirm").hidden = true;
    const avatar = $("accountAvatar");
    if (avatar) avatar.textContent = "";
    const dot = $("syncDot");
    if (dot?.classList) {
      dot.classList.toggle("ok", false);
      dot.classList.toggle("syncing", false);
      dot.classList.toggle("failed", false);
      dot.classList.toggle("conflict", false);
    }
    return;
  }
  $("accountEmail").textContent = user.email || user.displayName || "your Google account";
  $("syncStatus").textContent = statusText();
  $("syncConflict").hidden = !conflict;
  if (conflict) $("syncConflictCounts").textContent = `Your account has ${count(conflict.copy)}. This browser has ${count(localCopy())}.`;
  const avatar = $("accountAvatar");
  if (avatar) {
    const raw = (user.displayName || user.email || "A").trim();
    avatar.textContent = raw.charAt(0).toUpperCase() || "A";
  }
  const dot = $("syncDot");
  if (dot?.classList) {
    dot.classList.toggle("ok", !syncing && !failed && !conflict);
    dot.classList.toggle("syncing", !!syncing);
    dot.classList.toggle("failed", !!failed);
    dot.classList.toggle("conflict", !!conflict);
  }
}

function openAccount() {
  if (!fb) {
    loadFirebase().then(renderAccount, () => setError("Couldn't load Google sign-in. Check your connection and try again."));
  }
  setError("");
  $("deleteConfirm").hidden = true;
  renderAccount();
  if (!isOpen($("accountModal"))) openModal($("accountModal"), $("accountBtn"));
  if (!user) renderGoogleButton();
}

// reload() shows inputs and vehicles that sync wrote to this browser
function initAccount({ reload, beforeApply = () => {} }) {
  if (!$("accountBtn") || typeof window.addEventListener !== "function") return;
  hooks = { reload, beforeApply };
  $("accountBtn").addEventListener("click", openAccount);
  for (const id of ["closeAccountBtn", "cancelAccountBtn"]) $(id).addEventListener("click", () => closeModal($("accountModal")));
  $("signInBtn").addEventListener("click", signIn);
  $("signOutBtn").addEventListener("click", () => signOutHere());
  $("deleteDataBtn").addEventListener("click", () => { $("deleteConfirm").hidden = false; $("cancelDeleteBtn").focus(); });
  $("cancelDeleteBtn").addEventListener("click", () => { $("deleteConfirm").hidden = true; $("deleteDataBtn").focus(); });
  $("confirmDeleteBtn").addEventListener("click", deleteData);
  $("useCloudBtn").addEventListener("click", () => resolveConflict(true));
  $("keepLocalBtn").addEventListener("click", () => resolveConflict(false));

  window.addEventListener(SAVED_EVENT, scheduleSync);
  window.addEventListener("online", () => syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncNow();
    else if (writeTimer) syncNow(); // send a pending change before the tab is put away
  });
  if (restoring) loadFirebase().catch(e => console.warn("Couldn't restore sign-in:", e));
  renderAccount();
}

  __exports.cloudCopy = cloudCopy;
  __exports.parseCloud = parseCloud;
  __exports.fingerprint = fingerprint;
  __exports.syncDirection = syncDirection;
  __exports.initAccount = initAccount;
  __exports.isEmptyCopy = isEmptyCopy;
  })(__mods.mod_21_account);

  // === savings.js ===
  __mods.mod_25_savings = {};
  (function(__exports) {
const {  minDownFor  } = __mods.mod_2_calculator;
function addMonths(date, months) {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  d.setDate(Math.min(date.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

function savingsPlan({ price, condition, financeClass, firstRegisteredOn, down = 60, cash = false, fees = 0, insurance = 0,
  saved = 0, income = 0, debt = 0, mode = 'percent', contribution = 20, targetDate = '' }, today = new Date()) {
  const valid = n => Number.isFinite(n) && n >= 0;
  if (!(price > 0) || !valid(price)) return { error: 'Choose a vehicle with a valid price or enter a quote first.' };
  if (![fees, insurance, saved, income, debt, contribution, down].every(valid) || down > 100 || (mode === 'percent' && contribution > 100)) return { error: 'Enter valid positive amounts and percentages between 0 and 100.' };
  const downPct = cash ? 100 : Math.max(down, minDownFor(condition, financeClass, firstRegisteredOn, today));
  const deposit = price * downPct / 100, target = deposit + fees + insurance;
  const remaining = Math.max(0, target - saved);
  const monthly = mode === 'percent' ? income * contribution / 100 : contribution;
  const percent = income > 0 ? monthly / income * 100 : null;
  const months = remaining === 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly) : null;
  const date = months === null || months > 1200 ? null : addMonths(today, months);
  let required = null, targetMonths = null, targetError = '';
  if (targetDate) {
    const end = new Date(targetDate + 'T12:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || !Number.isFinite(end.getTime()) || end.getFullYear() !== +targetDate.slice(0,4) || end.getMonth()+1 !== +targetDate.slice(5,7) || end.getDate() !== +targetDate.slice(8,10)) targetError = 'Choose a valid target date.';
    else {
      targetMonths = (end.getFullYear() - today.getFullYear()) * 12 + end.getMonth() - today.getMonth();
      if (targetMonths > 0 && addMonths(today, targetMonths) > end) targetMonths--;
      if (targetMonths > 1200) targetError = 'Choose a target within the next 100 years.';
      else if (remaining === 0) required = 0;
      else if (targetMonths < 1) targetError = 'The target must allow at least one monthly contribution.';
      else required = remaining / targetMonths;
    }
  }
  return { deposit, downPct, fees, insurance, target, remaining, monthly, percent, months, date,
    progress: Math.min(100, saved / target * 100), required, targetMonths, targetError,
    requiredPercent: required !== null && income > 0 ? required / income * 100 : null,
    fitsKnownCommitments: income > 0 ? monthly <= Math.max(0, income - debt) : null };
}

  __exports.addMonths = addMonths;
  __exports.savingsPlan = savingsPlan;
  })(__mods.mod_25_savings);

  // === date-picker.js ===
  __mods.mod_24_date_picker = {};
  (function(__exports) {
const {  formatDate  } = __mods.mod_1_dates;
const {  addMonths  } = __mods.mod_25_savings;
function dateInputValue(value) {
  const raw=String(value||'').trim();
  if (!raw) return '';
  const iso=/^\d{2}-\d{2}-\d{4}$/.test(raw)?raw.split('-').reverse().join('-'):raw;
  return formatDate(iso)==='Date unavailable'?raw:iso;
}
const isoDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const months=Array.from({length:12},(_,i)=>new Date(2026,i,1).toLocaleDateString('en-GB',{month:'long'}));
function attachDatePicker(input, button) {
  const dialog=document.createElement('dialog');dialog.className='date-dialog';
  dialog.setAttribute('aria-labelledby','calendarTitle');dialog.setAttribute('aria-describedby','calendarHelp');
  dialog.innerHTML='<div class="calendar-heading"><h2 id="calendarTitle">Choose a Target Date</h2><button class="close-btn" type="button" data-calendar-close aria-label="Close Calendar">×</button></div><div class="calendar-nav"><button class="btn-outline" type="button" data-calendar-prev aria-label="Previous Month">‹</button><label class="sr-only" for="calendarMonth">Month</label><select id="calendarMonth"></select><label class="sr-only" for="calendarYear">Year</label><select id="calendarYear"></select><button class="btn-outline" type="button" data-calendar-next aria-label="Next Month">›</button></div><p id="calendarMonthTitle" class="sr-only" aria-live="polite"></p><table class="calendar-grid" role="grid" aria-labelledby="calendarMonthTitle"><thead><tr>'+['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=>'<th scope="col" abbr="'+d+'">'+d.slice(0,2)+'</th>').join('')+'</tr></thead><tbody></tbody></table><p class="hint" id="calendarHelp">Arrow keys move by day or week. Page Up/Down changes month. Escape closes.</p><div class="calendar-actions"><button class="link-btn" type="button" data-calendar-clear>Clear Date</button><button class="btn-outline" type="button" data-calendar-close>Cancel</button></div>';
  document.body.append(dialog);
  const $=s=>dialog.querySelector(s),month=$('#calendarMonth'),year=$('#calendarYear'),body=$('tbody');
  let today,focus,chosen='';
  month.innerHTML=months.map((name,i)=>'<option value="'+i+'">'+name+'</option>').join('');
  const present=()=>{const iso=dateInputValue(input.value);if(iso&&formatDate(iso)!=='Date unavailable')input.value=formatDate(iso,{numeric:true});button.setAttribute('aria-label',iso&&formatDate(iso)!=='Date unavailable'?'Change Target Date, '+formatDate(iso):'Choose Target Date');};
  const close=()=>dialog.close();
  function render(moveFocus=false) {
    const minDate=addMonths(today,1);
    const y=focus.getFullYear(),m=focus.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,last=new Date(y,m+1,0).getDate();
    month.value=String(m);year.value=String(y);$('#calendarMonthTitle').textContent=months[m]+' '+y;
    let html='';
    for(let row=0;row<Math.ceil((offset+last)/7);row++) {
      html+='<tr>';
      for(let col=0;col<7;col++) {
        const day=row*7+col-offset+1;
        if(day<1||day>last){html+='<td></td>';continue;}
        const d=new Date(y,m,day,12),iso=isoDate(d),disabled=d<minDate;
        html+='<td'+(iso===chosen?' aria-selected="true"':'')+'><button type="button" data-date="'+iso+'" aria-label="'+formatDate(iso)+'"'+(iso===isoDate(today)?' aria-current="date"':'')+' tabindex="'+(!disabled&&day===focus.getDate()?'0':'-1')+'"'+(disabled?' disabled':'')+'>'+day+'</button></td>';
      }
      html+='</tr>';
    }
    body.innerHTML=html;
    if(moveFocus)body.querySelector('[tabindex="0"]')?.focus();
  }
  function moveMonth(count) { focus=addMonths(focus,count);const minDate=addMonths(today,1);if(focus<minDate)focus=new Date(minDate);render(true); }
  function apply(value){input.value=value?formatDate(value,{numeric:true}):'';input.dispatchEvent(new Event('input',{bubbles:true}));present();close();}
  input.addEventListener('blur',present);
  button.addEventListener('click',()=>{
    today=new Date();today.setHours(12,0,0,0);chosen=dateInputValue(input.value);
    const minDate=addMonths(today,1);
    focus=/^\d{4}-\d{2}-\d{2}$/.test(chosen)&&formatDate(chosen)!=='Date unavailable'?new Date(chosen+'T12:00:00'):new Date(minDate);
    if(focus<minDate)focus=new Date(minDate);
    const firstYear=minDate.getFullYear(),lastYear=Math.max(firstYear+100,focus.getFullYear());
    year.innerHTML=Array.from({length:lastYear-firstYear+1},(_,i)=>'<option>'+String(firstYear+i)+'</option>').join('');
    render();dialog.showModal();body.querySelector('[tabindex="0"]')?.focus();
  });
  dialog.addEventListener('close',()=>button.focus());
  dialog.addEventListener('click',e=>{
    if(e.target.closest('[data-calendar-close]'))close();
    else if(e.target.closest('[data-calendar-clear]'))apply('');
    else if(e.target.closest('[data-calendar-prev]'))moveMonth(-1);
    else if(e.target.closest('[data-calendar-next]'))moveMonth(1);
    else if(e.target.closest('[data-date]'))apply(e.target.closest('[data-date]').dataset.date);
  });
  for(const el of [month,year])el.addEventListener('change',()=>{const minDate=addMonths(today,1);focus=new Date(Number(year.value),Number(month.value),1,12);if(focus<minDate)focus=new Date(minDate);render(true);});
  body.addEventListener('keydown',e=>{
    if(!e.target.matches('[data-date]'))return;
    const minDate=addMonths(today,1);
    const day=(focus.getDay()+6)%7,delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-day,End:6-day}[e.key];
    if(delta!==undefined){e.preventDefault();focus.setDate(focus.getDate()+delta);if(focus<minDate)focus=new Date(minDate);render(true);}
    else if(['PageUp','PageDown'].includes(e.key)){e.preventDefault();moveMonth((e.key==='PageUp'?-1:1)*(e.shiftKey?12:1));}
  });
  window.addEventListener('vahanaiq:copy-reset',()=>{if(dialog.open)dialog.close();});
  present();
}

  __exports.dateInputValue = dateInputValue;
  __exports.attachDatePicker = attachDatePicker;
  })(__mods.mod_24_date_picker);

  // === planner.js ===
  __mods.mod_23_planner = {};
  (function(__exports) {
const {  dateInputValue, attachDatePicker  } = __mods.mod_24_date_picker;
const {  formatDate  } = __mods.mod_1_dates;
const {  savingsPlan, addMonths  } = __mods.mod_25_savings;
const {  loadPlanner, savePlanner  } = __mods.mod_22_planner_store;
const {  fmt, esc  } = __mods.mod_2_calculator;
const {  attachMoneyInput, parseMoneyText  } = __mods.mod_3_money_input;
const {  showToast  } = __mods.mod_20_toast;
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
      markersHtml += `<circle cx="${x}" cy="${y}" r="6" class="trajectory-marker marker-goal"><title>Month ${m}${effectiveDate ? ' (' + effectiveDate + ')' : ''}: Target Reached LKR ${fmt(target)}</title></circle>`;
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

function initPlanner({ vehicles, settings }) {
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
        vehicleBadgeEl.innerHTML = `<span class="cbsl-statutory-badge ${isUsed ? 'mid' : 'ok'}"><span class="glyph glyph-badge-check" aria-hidden="true"></span> ${esc(v.cond || 'Vehicle')} · ${isUsed ? 'Eligible for CBSL 40% Minimum Deposit' : 'CBSL 60% Statutory Floor Required'}</span>`;
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
    const cbslBadgeClass = r.downPct === 40 ? 'mid' : 'ok';
    const cbslBadgeText = r.downPct === 100 ? '100% Cash Purchase' : r.downPct === 40 ? 'CBSL Compliant (>1yr Reg Only)' : 'CBSL Compliant (' + r.downPct + '% Down)';

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

    $('plannerResult').innerHTML = `<div class="planner-hero"><div class="planner-hero-icon"><span class="glyph glyph-target" aria-hidden="true"></span></div><div class="planner-hero-content"><div class="planner-hero-title">${end}</div><div class="planner-hero-sub">${r.months && date ? 'Estimated completion: '+date : (r.targetMonths && targetDateStr ? 'Target date: ' + targetDateStr + ' · Required: LKR ' + fmt(r.required) + ' / mo' : 'No investment growth or future price changes assumed')}</div></div>${r.months !== null && r.months <= 12 ? '<span class="tag ok">Fast Track</span>' : ''}</div><div class="planner-progress-card"><div class="planner-progress-header"><span class="planner-progress-label">Savings Progress</span><span class="planner-progress-pct">${r.progress.toFixed(1)}%</span></div><div class="planner-progress-track"><div class="planner-progress-fill" style="width:${r.progress.toFixed(1)}%"></div></div><div class="planner-progress-sub"><span>LKR ${fmt(savedAmount)} saved</span><span>LKR ${fmt(r.remaining)} remaining</span></div><label class="sr-only" for="savingsProgress">Savings progress</label><progress id="savingsProgress" class="sr-only" max="100" value="${r.progress}">${r.progress.toFixed(1)}%</progress></div><div class="planner-metrics"><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">Target Upfront</span><span class="glyph glyph-wallet" aria-hidden="true"></span></div><div class="telemetry-card-val">LKR ${fmt(r.target)}</div><div class="telemetry-card-sub"><span>Deposit + fees</span></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">Already Saved</span><span class="glyph glyph-circle-check" aria-hidden="true"></span></div><div class="telemetry-card-val">LKR ${fmt(savedAmount)}</div><div class="telemetry-card-sub"><span>${r.progress.toFixed(1)}% of target</span></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">Still to Save</span><span class="glyph glyph-piggy-bank" aria-hidden="true"></span></div><div class="telemetry-card-val val-rental">LKR ${fmt(r.remaining)}</div><div class="telemetry-card-sub"><span>Cash gap needed</span></div></div><div class="telemetry-card highlight"><div class="telemetry-card-top"><span class="telemetry-card-title">Monthly Saving</span><span class="glyph glyph-chart-no-axes-combined" aria-hidden="true"></span></div><div class="telemetry-card-val">LKR ${fmt(r.monthly)}</div><div class="telemetry-card-sub"><span>${r.percent !== null ? r.percent.toFixed(1) + '% of income' : 'Fixed contribution'}</span></div></div></div>${visualTrajectoryHtml}<div class="planner-breakdown-card"><div class="planner-breakdown-header"><span class="planner-breakdown-title">Upfront Cost Composition</span><span class="tag ${cbslBadgeClass}">${cbslBadgeText}</span></div><div class="planner-cost-split-bar" role="progressbar" aria-label="Upfront cost composition"><div class="cost-split-seg seg-deposit" style="width:${depPct}%" title="Statutory Deposit: LKR ${fmt(r.deposit)} (${depPct}%)"></div><div class="cost-split-seg seg-fees" style="width:${feePct}%" title="Fees &amp; Insurance: LKR ${fmt(r.fees+r.insurance)} (${feePct}%)"></div></div><div class="planner-cost-split-legend"><span class="split-legend-item"><span class="legend-swatch swatch-deposit"></span> Statutory Deposit: ${depPct}%</span><span class="split-legend-item"><span class="legend-swatch swatch-fees"></span> Fees &amp; Insurance: ${feePct}%</span></div><dl class="planner-breakdown"><div><dt>${r.downPct===100?'Cash price':'Statutory cash deposit ('+r.downPct+'%)'}</dt><dd>LKR ${fmt(r.deposit)}</dd></div><div><dt>Fees &amp; first-year comprehensive insurance</dt><dd>LKR ${fmt(r.fees+r.insurance)}</dd></div></dl></div>${targetCardHtml}${r.percent !== null ? `<p class="hint planner-insight-hint">${r.percent.toFixed(1)}% of net income saved each month${r.fitsKnownCommitments ? ' · fits income after entered loan payments, before living costs' : ''}.</p>` : '<p class="hint planner-insight-hint">Enter income above to see the percentage saved.</p>'}${r.fitsKnownCommitments === false ? '<p class="bad planner-warn-box">This contribution exceeds income after your existing loan payments.</p>' : ''}${r.targetError ? `<p class="bad planner-warn-box">${esc(r.targetError)}</p>` : ''}<p class="hint planner-disclaimer">${['published','starting','user-entered','seller-listed'].includes(v.priceBasis)?'Using the selected price; confirm it before purchase.':'This vehicle has an unverified estimate. Enter a seller quote before relying on this goal.'} A saved deposit does not guarantee lease approval. Projections assume monthly contributions, no investment growth, and no vehicle price changes.</p>`;
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

  __exports.initPlanner = initPlanner;
  })(__mods.mod_23_planner);

  // === app.js ===
  __mods.mod_0_app = {};
  (function(__exports) {
const {  formatDate  } = __mods.mod_1_dates;
const {  fmt, esc, num, computeLeaseTable, rental, yearlySchedule, rateLabel, CONDITIONS, minDownFor  } = __mods.mod_2_calculator;
const {  baseVehicles  } = __mods.mod_4_catalog;
const {  initCatalogue  } = __mods.mod_5_catalogue_browser;
const {  APP_VERSION  } = __mods.mod_9_config;
const {  normalizeImageToStudio  } = __mods.mod_17_canvas_utils;
const {  searchVehicle  } = __mods.mod_18_gemini;
const {  fetchVehicleStudioImage, NO_PHOTO  } = __mods.mod_12_image_fetcher;
const {  clearLegacyKeys, loadSavedCars, saveCars, newVehicleId  } = __mods.mod_8_storage;
const {  openModal, closeModal, isOpen  } = __mods.mod_10_modal;
const {  FIELDS, readSettings, fieldError, snapField, clearSnapNote, loadState, saveState, clearState, sharedCarsFromUrl, cleanUrl, buildShareLink  } = __mods.mod_19_inputs;
const {  baseVehicles: marketCatalogue  } = __mods.mod_6_market_catalogue;
const {  showToast, clearToast  } = __mods.mod_20_toast;
const {  initAccount  } = __mods.mod_21_account;
const {  attachMoneyInput, formatMoneyText  } = __mods.mod_3_money_input;
const {  validPrice, vehicleBatchError, conditionPrice  } = __mods.mod_7_vehicle_validation;
const {  creditFor, photoForModel, formatCreditHtml, PHOTO_CREDITS  } = __mods.mod_13_photo_credits;
const {  initPlanner  } = __mods.mod_23_planner;
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

function formatVehicleTitle(modelName, trimName, year) {
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

function matchesQuickFilter(r, qf) {
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
  const isPinned = pinnedKeys.has(r._key);
  return `<button class="row-btn pin-btn${isPinned ? " active" : ""}" type="button" data-act="pin" data-key="${r._key}" aria-pressed="${isPinned}" aria-label="${isPinned ? "Pinned for head-to-head comparison" : "Compare head-to-head"}, ${name}">${isPinned ? "Pinned" : "Compare"}</button><button class="row-btn" type="button" data-act="details" data-key="${r._key}" aria-label="Lease details, ${name}">Details</button><button class="link" type="button" data-act="remove" data-key="${r._key}" aria-label="Remove ${name}">Remove</button>`;
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
  tr.innerHTML = `<td class="name"><div class="car"><span class="thumb"></span><div><div class="v-title-row"><b class="v-name"></b><span class="v-badge-lowest"></span></div><small class="v-spec"></small><div class="warr"><span class="v-warr"></span><button type="button" class="cond-tag" data-act="cond" data-key="${key}" title="Change condition (Brand New, Reconditioned, Registered under a year, Registered Used)"><span class="v-cond"></span> <span class="cycle-icon" aria-hidden="true">⇄</span></button><span class="v-ltv"></span></div></div></div></td>
<td class="n price-cell" data-label="Price (LKR)"><span class="price-wrap"><span class="price-val"></span><button type="button" class="icon-btn edit-price" data-act="price" data-key="${key}" title="Edit price">✎</button></span></td>
<td class="n v-dp" data-label="Down payment (LKR)"><div class="cell-metric"><span class="dp-wrap"><span class="v-dp-val"></span><button type="button" class="icon-btn edit-dp" data-act="dp" data-key="${key}" title="Override down payment % for this vehicle">✎</button></span><span class="micro-sub v-dp-sub"></span></div></td>
<td class="n" data-label="Monthly rental (LKR)"><div class="cell-metric"><b class="v-rent"></b><span class="micro-sub v-rent-sub"></span></div></td>
<td class="v-bar" data-label="Share of your budget"></td>
<td class="n v-interest secondary" data-label="Total Interest (LKR)"></td>
<td class="n v-total secondary" data-label="Total outlay (LKR)"></td>
<td class="n v-need" data-label="Income needed (LKR)"><div class="cell-metric"><span class="v-need-val"></span><span class="micro-sub v-need-sub"></span></div></td>
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
  setHtml(q(".v-ltv"), r.downCustom
    ? `<span class="dp-custom-badge" title="Custom down payment override (${r.downPct}%) set for this vehicle">${r.downPct}% down (custom)</span>`
    : r.downRaised
    ? `<span class="ltv-warn" title="CBSL Directions No. 01 of 2026, cl. 2.1: brand new, reconditioned and recently registered cars need at least ${r.downPct}% down, so this car is calculated at ${r.downPct}% instead of ${s.down}%">${r.downPct}% down (CBSL minimum)</span>`
    : "");
  setHtml(q(".row-actions"), rowActions(r));
  q(".price-val").textContent = fmt(r.price);
  q(".edit-price").setAttribute("aria-label", `Edit price, ${r.name}`);
  if (q(".edit-dp")) q(".edit-dp").setAttribute("aria-label", `Override down payment percentage, ${r.name}`);
  q(".v-rent").textContent = fmt(r.rental);

  if (q(".v-rent-sub")) {
    if (r.downPct >= 100) {
      setHtml(q(".v-rent-sub"), '<small class="micro-sub ok">100% Cash</small>');
    } else if (s.insurance) {
      const insMonthly = s.insurance / 12;
      setHtml(q(".v-rent-sub"), `<small class="micro-sub" title="LKR ${fmt(insMonthly)}/mo insurance included in budget">+Ins LKR ${fmt(insMonthly)}/mo</small>`);
    } else {
      setHtml(q(".v-rent-sub"), `<small class="micro-sub" title="Monthly lease repayment over ${s.n} months">${s.n} installments</small>`);
    }
  }

  if (q(".v-dp-val")) {
    q(".v-dp-val").textContent = fmt(r.dp);
  } else {
    q(".v-dp").textContent = fmt(r.dp);
  }
  if (q(".v-dp-sub")) {
    const resetBtn = r.downCustom ? ` · <button type="button" class="dp-reset-btn" data-act="reset-dp" data-key="${r._key}" aria-label="Reset custom down payment for ${esc(r.name)}">Reset</button>` : "";
    if (r.downPct >= 100) {
      setHtml(q(".v-dp-sub"), `<small class="micro-sub ok">100% paid upfront${resetBtn}</small>`);
    } else if (s.fees) {
      setHtml(q(".v-dp-sub"), `<small class="micro-sub" title="LKR ${fmt(r.dp)} deposit + LKR ${fmt(s.fees)} fees">${r.downPct}%${r.downCustom ? " custom" : " down"} · Upfront: LKR ${fmt(r.upfront)}${resetBtn}</small>`);
    } else {
      setHtml(q(".v-dp-sub"), `<small class="micro-sub">${r.downPct}% ${r.downCustom ? "custom deposit" : "cash deposit"}${resetBtn}</small>`);
    }
  }

  const w = Math.min(100, r.rental / scale * 100);
  const markPos = Math.min(100, room / scale * 100);
  let barMicro = "";
  if (s.income) {
    if (r.downPct >= 100) {
      barMicro = `<div class="bar-micro-metric ok">Full room: LKR ${fmt(room)}/mo</div>`;
    } else if (r.rental <= room) {
      barMicro = `<div class="bar-micro-metric ok">+LKR ${fmt(room - r.rental)}/mo buffer</div>`;
    } else {
      barMicro = `<div class="bar-micro-metric bad">-LKR ${fmt(r.rental - room)}/mo over limit</div>`;
    }
  }
  setHtml(q(".v-bar"), s.income
    ? `<div class="v-bar-inner"><div class="track" role="img" aria-label="Rental LKR ${fmt(r.rental)} against your highest affordable rental of LKR ${fmt(room)}"><span class="fill ${r.status}" style="width:${w}%"></span><span class="mark" style="left:${markPos}%" title="Your highest affordable rental"></span></div>${barMicro}</div>`
    : `<span class="na bar-empty">Add income to compare</span>`);

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
      setHtml(q(".v-need-sub"), `<small class="micro-sub">At ${Math.round(s.dti * 100)}% limit</small>`);
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
      if (limit === 50 && carDti > 40) {
        statusHtml = `<span class="tag mid" title="${carDtiStr} of income fits within 50% stretch limit (exceeds 40% standard limit)">Stretch limit · ${carDtiStr}</span>`;
      } else {
        statusHtml = `<span class="tag ok" title="${carDtiStr} of monthly income (Limit: ${limit}%)">Within limit · ${carDtiStr}</span>`;
      }
    } else {
      if (limit === 40 && carDti <= 50) {
        statusHtml = `<span class="tag mid" title="${carDtiStr} exceeds 40% standard limit, but fits within 50% stretch limit">Stretch only · ${carDtiStr}</span>`;
      } else {
        statusHtml = `<span class="tag bad" title="${carDtiStr} of monthly income (Exceeds ${limit}% limit)">Above limit · ${carDtiStr}</span>`;
      }
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
    pillsEl.innerHTML = pinnedRows.map(r => `<span class="h2h-pill"><span class="h2h-pill-name">${esc(r.name)}</span><button type="button" class="h2h-pill-remove" data-unpin-key="${r._key}" aria-label="Unpin ${esc(r.name)} from head-to-head">&times;</button></span>`).join("");
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
        ? `LKR ${fmt(propRent)} / month rental`
        : `LKR ${fmt(propRent)} / LKR 1M price`;

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
        const card1Title = rows.length > 0 ? "Vehicle Lease Rental" : "Monthly Rental / LKR 1M";
        const card1Tag = rows.length > 0 ? "Proposed" : "Standard";
        const card1Val = propRent;
        const card1Sub = rows.length > 0 ? esc(rows[0].name) : "Per LKR 1.00M vehicle price";

        const card2Title = "Existing Commitments";
        const card2Tag = s.debt > 0 ? "Loans / Cards" : "Zero Debt";
        const card2TagClass = s.debt > 0 ? "mid" : "ok";
        const card2Val = s.debt;
        const card2Sub = "Existing monthly payments";

        const card3Title = "Net Income Needed / LKR 1M";
        const card3Tag = `${limit}% Limit`;
        const card3Val = 1e6 * f * (1 - s.down / 100) / s.dti;
        const card3Sub = `At ${limit}% limit per LKR 1.00M price`;

        const card4Title = "Down Payment";
        const card4Tag = "CBSL 2026";
        const card4Val = 1e6 * (s.down / 100);
        const card4Sub = `${s.down}% CBSL minimum per LKR 1M`;

        const zeroW = 0;
        const downW = Math.min(100, Math.max(0, Math.round(s.down)));

        gridEl.innerHTML = `<div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card1Title}</span><span class="tag ok">${card1Tag}</span></div><div class="telemetry-card-val val-rental">LKR ${fmt(card1Val)}</div><div class="telemetry-card-sub"><span>${card1Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-rental" style="width:${downW}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card2Title}</span><span class="tag ${card2TagClass}">${card2Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card2Val)}</div><div class="telemetry-card-sub"><span>${card2Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-debt" style="width:${zeroW}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card3Title}</span><span class="tag ok">${card3Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card3Val)}</div><div class="telemetry-card-sub"><span>${card3Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-price" style="width:${downW}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card4Title}</span><span class="tag ok">${card4Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card4Val)}</div><div class="telemetry-card-sub"><span>${card4Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-upfront" style="width:${downW}%"></div></div></div>`;
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
      if (subEl) subEl.textContent = `LKR ${fmt(totalMonthlyDebt)} / month`;

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
      if (labelEl) labelEl.textContent = `LKR ${fmt(totalMonthlyDebt)} / LKR ${fmt(s.income)} (${dtiStr})`;

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
          card1Sub = "100% cash purchase — LKR 0.00 rental";
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

        gridEl.innerHTML = `<div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card1Title}</span><span class="tag ${card1TagClass}">${card1Tag}</span></div><div class="telemetry-card-val val-rental">LKR ${fmt(card1Val)}</div><div class="telemetry-card-sub"><span>${card1Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-rental" style="width:${bar1W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card2Title}</span><span class="tag ${card2TagClass}">${card2Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card2Val)}</div><div class="telemetry-card-sub"><span>${card2Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-debt" style="width:${bar2W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card3Title}</span><span class="tag ${card3TagClass}">${card3Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card3Val)}</div><div class="telemetry-card-sub"><span>${card3Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-price" style="width:${bar3W}%"></div></div></div><div class="telemetry-card"><div class="telemetry-card-top"><span class="telemetry-card-title">${card4Title}</span><span class="tag ${card4TagClass}">${card4Tag}</span></div><div class="telemetry-card-val">LKR ${fmt(card4Val)}</div><div class="telemetry-card-sub"><span>${card4Sub}</span></div><div class="telemetry-micro-bar"><div class="telemetry-micro-fill bar-upfront" style="width:${bar4W}%"></div></div></div>`;
      }
    }
  }

  let sentence = "", bar = "";
  if (!s.income) {
    sentence = `Monthly rental is LKR ${fmt(1e6 * f * (1 - s.down / 100))} for every LKR 1.00 million of price.`;
  } else if (s.down >= 100) {
    sentence = "100% cash purchase, no lease rental.";
  } else if (room <= 0) {
    sentence = bar = `Your existing payments already use up your ${limit}% limit. No room for a lease rental.`;
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
  for (const id of ["rate", "tenure", "down", "plannerPercent"]) {
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
      btn.disabled = false;
      btn.title = "CBSL minimum 40% deposit (for vehicles registered over 1 year)";
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
      const min = el.min !== "" && !isNaN(Number(el.min)) ? Number(el.min) : (id === "down" ? 40 : id === "tenure" ? 6 : 0);
      const max = el.max !== "" && !isNaN(Number(el.max)) ? Number(el.max) : (id === "down" ? 100 : id === "tenure" ? 84 : 40);
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
      if ($("tenure")) $("tenure").value = "84";
      if ($("down")) $("down").value = "60";
      if ($("rateType")) $("rateType").value = "reducing";
    } else if (strat === "fast-payoff") {
      if ($("tenure")) $("tenure").value = "36";
      if ($("down")) $("down").value = "60";
      if ($("rateType")) $("rateType").value = "reducing";
    } else if (strat === "min-cash") {
      if ($("tenure")) $("tenure").value = "84";
      if ($("down")) {
        $("down").min = "40";
        $("down").value = "40";
      }
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
    focusRowControl(key, "cond");
    // The price was for the old condition, so offer to change it
    showToast(`${car.name} is now ${condLabel(car.cond)}. Check its price for this condition.`, "Edit Price", () => {
      const edit = $("rows").querySelector(`[data-key="${key}"][data-act="price"]`);
      if (edit) startPriceEdit(edit, car);
    });
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
  const photo = photoForModel(car);
  const candidateCredit = creditFor(car);
  const credit = candidateCredit?.img === photo ? candidateCredit : null;
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
      } else if (limit === 40 && carDti <= 50) {
        statusPill = `<span class="tag mid">Stretch only · ${carDtiStr}</span>`;
      } else {
        statusPill = `<span class="tag bad">Above limit · ${carDtiStr}</span>`;
      }
    }

    html += `<article class="h2h-col-card" data-h2h-key="${r._key}">
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
        <button type="button" class="btn-outline btn-sm" data-h2h-details="${r._key}">Full Lease Schedule</button>
        <button type="button" class="link" data-unpin-key="${r._key}">Unpin</button>
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
  $("aiCondSelect").innerHTML = options.map(o => `<option value="${o.id}" data-p="${validPrice(o.price) ? o.price : ""}" data-c="${o.c}" ${o === selected ? "selected" : ""}>${o.name}: ${validPrice(o.price) ? "LKR " + fmt(o.price) : "no price, enter one"}</option>`).join("");
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
  if ($(id)) $(id).addEventListener("click", () => $("guide")?.showModal());
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
        if (typeof target.scrollIntoView === "function") target.scrollIntoView({ behavior: "smooth" });
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

  __exports.formatVehicleTitle = formatVehicleTitle;
  __exports.matchesQuickFilter = matchesQuickFilter;
  })(__mods.mod_0_app);
})();
