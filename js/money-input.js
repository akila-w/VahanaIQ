// Rupee inputs: plain text with a numeric keypad, thousands separators added as you type
const MAX_DIGITS = 15;
const moneyFormatter = new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Round only for presentation; calculations and saved amounts retain their precision.
export const formatMoneyAmount = value => moneyFormatter.format(Math.abs(value) < 0.005 ? 0 : (value || 0));

// Keep decimals and reject ambiguous input instead of silently changing its value.
// Supports plain digits, standard thousands grouping (groups of 3), and South Asian lakh/crore grouping.
export function parseMoneyText(text) {
  const raw = String(text ?? "").trim().replace(/^(?:LKR|Rs\.?|₨)\s*/i, "");
  if (!/^-?(?:(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3})(?:\.\d{0,2})?|\.\d{1,2})$/.test(raw)) return NaN;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && Math.abs(value) < 10 ** MAX_DIGITS ? value : NaN;
}

export function formatMoneyText(text, { editing = false, grouping = true } = {}) {
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

export function attachMoneyInput(el, { grouping = true } = {}) {
  if (!el || !el.addEventListener) return;
  const finishEditing = () => { el.value = formatMoneyText(el.value, { grouping }); };
  finishEditing();
  el.addEventListener("blur", finishEditing);
  el.addEventListener("input", () => {
    const value = el.value;
    const caret = el.selectionStart == null ? value.length : el.selectionStart;
    const digitsBefore = value.slice(0, caret).replace(/\D/g, "").length;
    // Do not pad cents mid-keystroke: the user must be able to enter "250000.5".
    const formatted = formatMoneyText(value, { editing: true, grouping });
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
