// VahanaIQ: Sri Lankan Lease & Actuarial Calculator Logic
// Down-payment rules follow CBSL Directions No. 01 of 2026, cl. 2.1 (motor cars):
// at most 40% financed for unregistered cars and cars registered under a year (60% down),
// at most 60% financed for cars registered over a year (40% down).

export const DOWN_MIN = 40;          // lowest down payment any car can have (registered over a year)
export const DOWN_MIN_UNREG = 60;    // brand new, reconditioned and recently registered cars

export const fmt = n => (Math.round(n) || 0).toLocaleString("en-LK"); // "|| 0" turns -0 into 0
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const num = id => {
  const el = typeof id === "string" ? document.getElementById(id) : id;
  const raw = el && typeof el === "object" && "value" in el ? el.value : id;
  if (typeof raw === "number") return isFinite(raw) ? raw : NaN;
  if (raw === null || raw === undefined || raw === "") return NaN;
  const clean = String(raw).replace(/,/g, "").trim();
  const v = parseFloat(clean);
  return isFinite(v) ? v : NaN;
};

export function rental(loan, rate, n) {
  const i = rate / 100 / 12;
  return i === 0 ? loan / n : (loan * i) / (1 - Math.pow(1 + i, -n));
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
      downHint.textContent = "Below 60%: only cars registered over a year qualify. Others are flagged ⚠️.";
      downHint.className = "hint";
    } else {
      downHint.textContent = "Minimum 40% (cars registered over a year). Brand new, reconditioned and recently registered cars need 60%; they're flagged ⚠️ below that.";
      downHint.className = "hint";
    }
  }

  const income = num("income");
  const debt = Math.max(0, num("debt") || 0);
  const dti = parseFloat(document.getElementById("dti").value);

  return { rate, n, down, income: income > 0 ? income : 0, debt, dti };
}

export function computeLeaseTable(cars, settings = getSettings()) {
  const s = settings;
  const f = rental(1, s.rate, s.n);
  const rows = cars.map((c, idx) => {
    let loan, dp, rent, interest, total, need;
    if (s.down >= 100) {
      loan = 0;
      dp = c.price;
      rent = 0;
      interest = 0;
      total = c.price;
      need = s.debt / s.dti;
    } else {
      loan = c.price * (1 - s.down / 100);
      dp = c.price - loan;
      rent = loan * f;
      interest = rent * s.n - loan;
      total = dp + rent * s.n;
      need = (rent + s.debt) / s.dti;
    }
    let status = "na";
    if (s.income) {
      const load = (rent + s.debt) / s.income;
      status = load <= 0.4 ? "ok" : load <= 0.5 ? "mid" : "bad";
    }
    return Object.assign({}, c, { _idx: idx, loan, dp, rental: rent, interest, total, need, status });
  });

  const room = s.income ? Math.max(0, s.income * s.dti - s.debt) : 0;
  return { s, f, rows, room };
}