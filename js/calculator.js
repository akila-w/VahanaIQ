// VahanaIQ: Sri Lankan Lease & Actuarial Calculator Logic
// Follows CBSL Directions No. 01 of 2026

export const fmt = n => Math.round(n).toLocaleString("en-LK");
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const num = id => {
  const v = parseFloat(document.getElementById(id).value);
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
  if (!(down >= 0)) down = 50;
  
  const nCap = n > 84;
  n = Math.min(84, Math.max(1, Math.round(n)));
  down = Math.min(100, Math.max(30, down));

  const tenureHint = document.getElementById("tenureHint");
  const downHint = document.getElementById("downHint");
  
  tenureHint.textContent = nCap ? "Capped at the 84-month maximum" : "Maximum 84";
  tenureHint.className = "hint" + (nCap ? " warn" : "");
  downHint.textContent = down < 50 ? "Lower than 50% down (applicable for registered used vehicles)" : "Minimum 50% for unregistered cars";
  downHint.className = "hint";

  const income = num("income");
  const debt = Math.max(0, num("debt") || 0);
  const dti = parseFloat(document.getElementById("dti").value);

  return { rate, n, down, income: income > 0 ? income : 0, debt, dti };
}

export function computeLeaseTable(cars) {
  const s = getSettings();
  const f = rental(1, s.rate, s.n);
  const rows = cars.map(c => {
    const loan = c.price * (1 - s.down / 100);
    const dp = c.price - loan;
    const rent = loan * f;
    const interest = rent * s.n - loan;
    const total = dp + rent * s.n;
    const need = (rent + s.debt) / s.dti;
    let status = "na";
    if (s.income) {
      const load = (rent + s.debt) / s.income;
      status = load <= 0.4 ? "ok" : load <= 0.5 ? "mid" : "bad";
    }
    return Object.assign({}, c, { loan, dp, rental: rent, interest, total, need, status });
  });

  const room = s.income ? Math.max(0, s.income * s.dti - s.debt) : 0;
  return { s, f, rows, room };
}