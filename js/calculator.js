// VahanaIQ: Sri Lankan Lease & Actuarial Calculator Logic
// Down-payment rules follow CBSL Directions No. 01 of 2026, cl. 2.1 (motor cars):
// at most 40% financed for unregistered cars and cars registered under a year (60% down),
// at most 60% financed for cars registered over a year (40% down).

import { parseMoneyText, formatMoneyAmount } from "./money-input.js?v=2.12.0";
import { safeUrl, safeImageUrl } from "./safe-url.js?v=2.12.0";
import {
  DOWN_MIN,
  DOWN_MIN_UNREG,
  MAX_TENURE,
  MIN_TENURE,
  DOWN_MAX,
  CONDITIONS,
  DEFAULT_RATE,
  DEFAULT_TENURE,
  DEFAULT_DOWN,
  DEFAULT_RATE_TYPE,
  DEFAULT_DTI,
  DEFAULT_INCOME,
  DEFAULT_DEBT,
  DTI_MIN,
  DTI_MAX,
  DTI_STANDARD,
  DTI_STRETCH,
  MAX_RATE,
  MAX_SAFE_AMOUNT,
  MAX_SAFE_PRECISION,
  MAX_SCHEDULE_MONTHS
} from "./constants.js?v=2.12.0";

// Backward compatibility re-exports
export {
  DOWN_MIN,
  DOWN_MIN_UNREG,
  MAX_TENURE,
  MIN_TENURE,
  DOWN_MAX,
  CONDITIONS,
  DEFAULT_RATE,
  DEFAULT_TENURE,
  DEFAULT_DOWN,
  DEFAULT_RATE_TYPE,
  DEFAULT_DTI,
  DTI_STANDARD,
  DTI_STRETCH
};

// The lowest down payment the Direction allows for a condition. Only "Used" (registered in
// Sri Lanka for over a year) may go down to 40%; an unknown condition is treated as unregistered.
export function minDownFor(cond, financeClass, firstRegisteredOn, today = new Date()) {
  if (financeClass === "commercial") return DOWN_MIN;
  if (firstRegisteredOn !== undefined && firstRegisteredOn !== null && firstRegisteredOn !== '') {
    const dateStr = String(firstRegisteredOn).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return DOWN_MIN_UNREG;
    const first = new Date(dateStr + 'T12:00:00');
    if (!Number.isFinite(first.getTime()) || first.toISOString().slice(0, 10) !== dateStr) return DOWN_MIN_UNREG;
    const anniversary = new Date(first); anniversary.setFullYear(first.getFullYear() + 1);
    const safeToday = (today instanceof Date && Number.isFinite(today.getTime())) ? today : new Date();
    return cond === "Used" && new Date(safeToday.getFullYear(), safeToday.getMonth(), safeToday.getDate()) > new Date(anniversary.getFullYear(), anniversary.getMonth(), anniversary.getDate()) ? DOWN_MIN : DOWN_MIN_UNREG;
  }
  return cond === "Used" ? DOWN_MIN : DOWN_MIN_UNREG;
}

export const fmt = formatMoneyAmount;
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export { safeUrl, safeImageUrl };

// Parses a numeric/currency value from an element ID, an element reference, or a primitive.
// Sanitizes non-numeric strings, NaNs, and infinities, enforcing reasonable precision bounds.
export const num = id => {
  const el = typeof document !== "undefined" && typeof id === "string" ? document.getElementById(id) : id;
  const raw = el && typeof el === "object" && "value" in el ? el.value : id;
  if (typeof raw === "number") return Number.isFinite(raw) && Math.abs(raw) < MAX_SAFE_PRECISION ? raw : NaN;
  if (raw === null || raw === undefined || raw === "") return NaN;
  return parseMoneyText(raw);
};

// Computes the monthly reducing-balance rental.
// Formula: rental = [loan × i] / [1 - (1 + i)^(-n)] where i = annual_rate / 100 / 12.
// Fully hardened against division by zero (n <= 0, denom == 0), negative tenures,
// NaNs, and infinite inputs. Returns 0 for non-positive loans or tenures.
export function rental(loan, rate, n) {
  // Guard against non-finite, zero, or negative loans and tenures
  if (!Number.isFinite(loan) || loan <= 0) return 0;
  if (!Number.isFinite(n) || n <= 0) return 0;

  // Non-finite or negative interest rates safely default to 0% interest (equal capital repayment)
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  if (safeRate === 0) {
    return loan / n;
  }

  const i = safeRate / 100 / 12;
  const denom = 1 - Math.pow(1 + i, -n);

  // Guard against division by zero or floating-point underflow in denominator
  if (denom === 0 || !Number.isFinite(denom)) {
    return loan / n;
  }

  const pay = (loan * i) / denom;
  return Number.isFinite(pay) && pay >= 0 ? pay : 0;
}

// A flat rate charges interest on the whole amount financed for the whole term:
// rental = loan × (1 + flat × years) / months. This returns the reducing-balance annual rate
// (monthly compounding) with the same rental, so every other figure can use one formula.
// Hardened against non-finite values, non-positive tenure, and runaway loops.
export function flatToEffective(flat, n) {
  if (!Number.isFinite(flat) || flat <= 0 || !Number.isFinite(n) || n <= 0) {
    return Math.max(0, Number.isFinite(flat) ? flat : 0);
  }
  const target = (1 + (flat / 100) * (n / 12)) / n;
  let lo = 0, hi = 5;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (rental(1, mid * 100, n) < target) lo = mid; else hi = mid;
  }
  const result = ((lo + hi) / 2) * 100;
  return Number.isFinite(result) ? result : 0;
}

// Year-by-year totals of a reducing-balance loan: rentals paid, interest, principal and the
// balance left at the end of each year (the last year may be shorter than 12 months).
// Hardened against non-finite values, infinite loops, and negative loan inputs.
export function yearlySchedule(loan, rate, n) {
  // Input sanitization: non-finite or non-positive tenure returns an empty schedule
  if (!Number.isFinite(n) || n <= 0) return [];
  // Cap tenure at 600 months (50 years) to prevent memory exhaustion and DoS from huge loops
  const totalMonths = Math.min(MAX_SCHEDULE_MONTHS, Math.floor(n));
  if (totalMonths <= 0) return [];

  const safeLoan = Number.isFinite(loan) && loan > 0 ? loan : 0;
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  const i = safeRate / 100 / 12;
  const pay = rental(safeLoan, safeRate, totalMonths);

  const years = [];
  let balance = safeLoan;

  for (let m = 1; m <= totalMonths; m++) {
    const interest = balance * i;
    const principal = Math.min(balance, pay - interest);
    balance = Math.max(0, balance - principal);

    // Prevent floating-point residue on final payment
    if (m === totalMonths && balance < 0.01) {
      balance = 0;
    }

    if ((m - 1) % 12 === 0) {
      years.push({ year: years.length + 1, months: 0, paid: 0, interest: 0, principal: 0, balance: 0 });
    }
    const y = years[years.length - 1];
    y.months += 1;
    y.paid += pay;
    y.interest += interest;
    y.principal += principal;
    y.balance = balance;
  }
  return years;
}

// Reads and sanitizes all financing and budgeting parameters from the DOM.
// Enforces CBSL Direction No. 01 of 2026 LTV bounds (40% floor for used cars, 60% for new/recent),
// statutory 84-month tenure ceiling, and 6-month tenure floor.
// Sanitizes non-numeric strings, NaNs, infinities, and negative numbers into safe defaults.
export function getSettings() {
  const rawRate = num("rate");
  let rate;
  if (!Number.isFinite(rawRate) || rawRate < 0) {
    rate = DEFAULT_RATE;
  } else if (rawRate > MAX_RATE) {
    rate = MAX_RATE;
  } else {
    rate = rawRate;
  }

  const rawN = num("tenure");
  const rawDown = num("down");

  let n;
  let nCap = false;
  let nLow = false;
  if (!Number.isFinite(rawN)) {
    n = DEFAULT_TENURE;
  } else if (rawN > MAX_TENURE) {
    n = MAX_TENURE;
    nCap = true;
  } else if (rawN < MIN_TENURE) {
    n = MIN_TENURE;
    nLow = true;
  } else {
    n = Math.round(rawN);
  }

  const inputMinimum = (typeof document !== "undefined" && Number(document.getElementById("down")?.min)) || DOWN_MIN;
  let down;
  let downLow = false;
  if (!Number.isFinite(rawDown)) {
    down = DEFAULT_DOWN;
  } else if (rawDown < DOWN_MIN) {
    down = Math.max(inputMinimum, DOWN_MIN);
    downLow = true;
  } else if (rawDown > DOWN_MAX) {
    down = DOWN_MAX;
  } else {
    down = Math.max(inputMinimum, rawDown);
  }

  const tenureHint = typeof document !== "undefined" ? document.getElementById("tenureHint") : null;
  const downHint = typeof document !== "undefined" ? document.getElementById("downHint") : null;

  if (tenureHint) {
    if (nCap) {
      tenureHint.textContent = `Capped at the ${MAX_TENURE}-month maximum`;
      tenureHint.className = "hint warn";
    } else if (nLow) {
      tenureHint.textContent = `Minimum ${MIN_TENURE} months`;
      tenureHint.className = "hint warn";
    } else {
      tenureHint.textContent = `Maximum ${MAX_TENURE}`;
      tenureHint.className = "hint";
    }
  }

  if (downHint) {
    if (downLow) {
      downHint.textContent = `Raised to the ${DOWN_MIN}% minimum down payment`;
      downHint.className = "hint warn";
    } else if (down < DOWN_MIN_UNREG) {
      downHint.textContent = `Below ${DOWN_MIN_UNREG}%, only cars registered over a year qualify. Others are calculated at ${DOWN_MIN_UNREG}%.`;
      downHint.className = "hint";
    } else {
      downHint.textContent = inputMinimum >= DOWN_MIN_UNREG
        ? `Minimum ${DOWN_MIN_UNREG}% for new and recent passenger vehicles. A larger deposit reduces the amount financed.`
        : `Minimum ${DOWN_MIN}% (cars registered over a year). Brand new, reconditioned and recently registered cars need ${DOWN_MIN_UNREG}%, so they're calculated at ${DOWN_MIN_UNREG}% below that.`;
      downHint.className = "hint";
    }
  }

  const rawIncome = num("income");
  const income = Number.isFinite(rawIncome) && rawIncome > 0 ? Math.min(rawIncome, MAX_SAFE_AMOUNT) : DEFAULT_INCOME;

  const rawDebt = num("debt");
  const debt = Number.isFinite(rawDebt) && rawDebt > 0 ? Math.min(rawDebt, MAX_SAFE_AMOUNT) : DEFAULT_DEBT;

  const dtiEl = typeof document !== "undefined" ? document.getElementById("dti") : null;
  const rawDti = dtiEl && typeof dtiEl.value !== "undefined" ? parseFloat(dtiEl.value) : DEFAULT_DTI;
  const dti = Number.isFinite(rawDti) && rawDti > DTI_MIN && rawDti <= DTI_MAX ? rawDti : DEFAULT_DTI;

  const typeEl = typeof document !== "undefined" ? document.getElementById("rateType") : null;
  const rateType = typeEl && typeEl.value === "flat" ? "flat" : DEFAULT_RATE_TYPE;

  const extra = id => {
    if (typeof document === "undefined") return 0;
    const el = document.getElementById(id);
    if (!el) return 0;
    const val = num(id);
    return Number.isFinite(val) && val > 0 ? Math.min(val, MAX_SAFE_AMOUNT) : 0;
  };

  const effectiveRate = rateType === "flat" ? flatToEffective(rate, n) : rate;
  const safeEffectiveRate = Number.isFinite(effectiveRate) && effectiveRate >= 0 ? effectiveRate : DEFAULT_RATE;

  return {
    rate: safeEffectiveRate,
    rateInput: rate,
    rateType,
    n,
    down,
    income,
    debt,
    dti,
    insurance: extra("insurance"),
    fees: extra("fees")
  };
}

// "16% a year (reducing balance)" or "14% flat (about 25.17% a year reducing balance)"
export const rateLabel = s => {
  if (!s || typeof s !== "object") return "";
  const rate = Number.isFinite(s.rate) ? s.rate : 0;
  const rateInput = Number.isFinite(s.rateInput) ? s.rateInput : rate;
  return s.rateType === "flat"
    ? `${rateInput}% flat (about ${rate.toFixed(2)}% a year reducing balance)`
    : `${rate}% a year (reducing balance)`;
};

export function computeLeaseTable(cars, settings = getSettings()) {
  if (!Array.isArray(cars)) return { s: settings, f: 0, rows: [], room: 0 };
  const s = (settings && typeof settings === "object") ? settings : getSettings();

  const safeRate = Number.isFinite(s.rate) && s.rate >= 0 ? s.rate : DEFAULT_RATE;
  const safeN = Number.isFinite(s.n) && s.n > 0 ? s.n : DEFAULT_TENURE;
  const f = rental(1, safeRate, safeN);

  const insurance = Number.isFinite(s.insurance) && s.insurance > 0 ? s.insurance : 0;
  const fees = Number.isFinite(s.fees) && s.fees > 0 ? s.fees : 0;
  const debt = Number.isFinite(s.debt) && s.debt > 0 ? s.debt : DEFAULT_DEBT;
  const income = Number.isFinite(s.income) && s.income > 0 ? s.income : DEFAULT_INCOME;
  const dti = Number.isFinite(s.dti) && s.dti > DTI_MIN && s.dti <= DTI_MAX ? s.dti : DEFAULT_DTI;
  const baseDown = Number.isFinite(s.down) ? Math.min(DOWN_MAX, Math.max(DOWN_MIN, s.down)) : DOWN_MIN_UNREG;

  const rows = cars.map((c, idx) => {
    if (!c || typeof c !== "object") return null;
    const price = Number.isFinite(c.price) && c.price >= 0 ? c.price : (num(c.price) > 0 ? num(c.price) : 0);
    let loan, dp, rent, interest, total, need;
    const minDown = minDownFor(c.cond, c.financeClass, c.firstRegisteredOn);
    const hasCustomDown = Number.isFinite(c.downOverride) && c.downOverride > 0;
    const targetDown = hasCustomDown ? Math.min(DOWN_MAX, Math.max(minDown, c.downOverride)) : baseDown;
    // Each car is calculated at its legal minimum down payment, or the chosen one if higher
    const downPct = targetDown >= DOWN_MAX ? DOWN_MAX : Math.max(targetDown, minDown);
    if (downPct >= DOWN_MAX) {
      loan = 0;
      dp = price;
      rent = 0;
      interest = 0;
      total = price;
      need = (debt + insurance / 12) / dti;
    } else {
      loan = price * (1 - downPct / 100);
      dp = price - loan;
      rent = loan * f;
      interest = rent * safeN - loan;
      total = dp + rent * safeN;
      need = (rent + debt + insurance / 12) / dti;
    }
    // Optional costs: up-front fees and comprehensive insurance over the term
    const upfront = dp + fees;
    const monthlyCost = rent + insurance / 12;
    total += fees + (insurance * safeN) / 12;
    let status = "na";
    if (income) {
      const load = (monthlyCost + debt) / income;
      status = load <= dti ? "ok" : "bad";
    }
    return Object.assign({}, c, {
      _idx: idx,
      loan,
      dp,
      downPct,
      downCustom: hasCustomDown,
      downRaised: !hasCustomDown && downPct > baseDown,
      upfront,
      monthlyCost,
      rental: rent,
      interest,
      total,
      need,
      status
    });
  }).filter(Boolean);

  const room = income ? Math.max(0, income * dti - debt - insurance / 12) : 0;
  return { s, f, rows, room };
}
