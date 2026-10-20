// VahanaIQ: Sri Lankan Lease & Actuarial Calculator Logic
// Down-payment rules follow CBSL Directions No. 01 of 2026, cl. 2.1 (motor cars):
// at most 40% financed for unregistered cars and cars registered under a year (60% down),
// at most 60% financed for cars registered over a year (40% down).

import { parseMoneyText, formatMoneyAmount } from "./money-input.js?v=2.8.1";

export const DOWN_MIN = 40;          // lowest down payment any car can have (registered over a year)
export const DOWN_MIN_UNREG = 60;    // brand new, reconditioned and recently registered cars

// Vehicle conditions. "Recent" is a car registered in Sri Lanka for under a year, which the
// Direction treats like an unregistered one.
export const CONDITIONS = { New: "Brand New", Recond: "Reconditioned", Recent: "Registered under a year", Used: "Registered Used" };

// The lowest down payment the Direction allows for a condition. Only "Used" (registered in
// Sri Lanka for over a year) may go down to 40%; an unknown condition is treated as unregistered.
export const minDownFor = cond => cond === "Used" ? DOWN_MIN : DOWN_MIN_UNREG;

export const fmt = formatMoneyAmount;
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const num = id => {
  const el = typeof id === "string" ? document.getElementById(id) : id;
  const raw = el && typeof el === "object" && "value" in el ? el.value : id;
  if (typeof raw === "number") return isFinite(raw) ? raw : NaN;
  if (raw === null || raw === undefined || raw === "") return NaN;
  return parseMoneyText(raw);
};

export function rental(loan, rate, n) {
  const i = rate / 100 / 12;
  return i === 0 ? loan / n : (loan * i) / (1 - Math.pow(1 + i, -n));
}

// A flat rate charges interest on the whole amount financed for the whole term:
// rental = loan × (1 + flat × years) / months. This returns the reducing-balance annual rate
// (monthly compounding) with the same rental, so every other figure can use one formula.
export function flatToEffective(flat, n) {
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
export function yearlySchedule(loan, rate, n) {
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

export function getSettings() {
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
  down = Math.min(100, Math.max(DOWN_MIN, down));

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
      downHint.textContent = "Minimum 40% (cars registered over a year). Brand new, reconditioned and recently registered cars need 60%, so they're calculated at 60% below that.";
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
export const rateLabel = s => s.rateType === "flat"
  ? `${s.rateInput}% flat (about ${s.rate.toFixed(2)}% a year reducing balance)`
  : `${s.rate}% a year (reducing balance)`;

export function computeLeaseTable(cars, settings = getSettings()) {
  const s = settings;
  const f = rental(1, s.rate, s.n);
  const insurance = s.insurance || 0, fees = s.fees || 0;
  const rows = cars.map((c, idx) => {
    let loan, dp, rent, interest, total, need;
    // Each car is calculated at its legal minimum down payment, or the chosen one if higher
    const downPct = s.down >= 100 ? 100 : Math.max(s.down, minDownFor(c.cond));
    if (downPct >= 100) {
      loan = 0;
      dp = c.price;
      rent = 0;
      interest = 0;
      total = c.price;
      need = s.debt / s.dti;
    } else {
      loan = c.price * (1 - downPct / 100);
      dp = c.price - loan;
      rent = loan * f;
      interest = rent * s.n - loan;
      total = dp + rent * s.n;
      need = (rent + s.debt) / s.dti;
    }
    // Optional costs: up-front fees and comprehensive insurance over the term
    const upfront = dp + fees;
    const monthlyCost = rent + insurance / 12;
    total += fees + insurance * s.n / 12;
    let status = "na";
    if (s.income) {
      const load = (rent + s.debt) / s.income;
      status = load <= 0.4 ? "ok" : load <= 0.5 ? "mid" : "bad";
    }
    return Object.assign({}, c, { _idx: idx, loan, dp, downPct, downRaised: downPct > s.down, upfront, monthlyCost, rental: rent, interest, total, need, status });
  });

  const room = s.income ? Math.max(0, s.income * s.dti - s.debt) : 0;
  return { s, f, rows, room };
}
