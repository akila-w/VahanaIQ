// Rupee inputs: plain text with a numeric keypad, thousands separators added as you type
const MAX_DIGITS = 15;

// Keep decimals and reject ambiguous input instead of silently changing its value.
export function parseMoneyText(text) {
  const raw = String(text ?? "").trim().replace(/^(?:LKR|Rs\.?|₨)\s*/i, "");
  if (!/^-?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?|\.\d{1,2})$/.test(raw)) return NaN;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && Math.abs(value) < 10 ** MAX_DIGITS ? value : NaN;
}

export function formatMoneyText(text) {
  const raw = String(text ?? "");
  if (!Number.isFinite(parseMoneyText(raw))) return raw;
  const clean = raw.trim().replace(/^(?:LKR|Rs\.?|₨)\s*/i, "").replace(/,/g, "");
  const [whole, fraction] = clean.split(".");
  const formatted = (clean.startsWith("-") ? "-" : "") + Number(whole.replace(/^-/, "") || "0").toLocaleString("en-LK");
  return fraction === undefined ? formatted : formatted + "." + fraction;
}

export function attachMoneyInput(el) {
  if (!el || !el.addEventListener) return;
  el.addEventListener("input", () => {
    const value = el.value;
    const caret = el.selectionStart == null ? value.length : el.selectionStart;
    const digitsBefore = value.slice(0, caret).replace(/\D/g, "").length;
    const formatted = formatMoneyText(value);
    if (formatted === value) return;
    el.value = formatted;
    // Put the caret back after the same number of digits
    let pos = formatted.startsWith("-") ? 1 : 0;
    for (let seen = 0; pos < formatted.length && seen < digitsBefore; pos++) {
      if (/\d/.test(formatted[pos])) seen++;
    }
    if (value.slice(0, caret).endsWith(".") && formatted[pos] === ".") pos++;
    if (caret === value.length) pos = formatted.length;
    try { el.setSelectionRange(pos, pos); } catch (e) {}
  });
}
