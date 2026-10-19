// Rupee inputs: plain text with a numeric keypad, thousands separators added as you type
const MAX_DIGITS = 15;

export function formatMoneyText(text) {
  const neg = String(text).trim().startsWith("-");
  const digits = String(text).replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS);
  if (!digits) return neg ? "-" : "";
  return (neg ? "-" : "") + Number(digits).toLocaleString("en-LK");
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
    try { el.setSelectionRange(pos, pos); } catch (e) {}
  });
}
