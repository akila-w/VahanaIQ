// Display choices from settings.html. Stored and calculated amounts never change; only what people read.
const settings = (() => {
  try { return JSON.parse(localStorage.getItem("vahanaiq_settings_v1")) || {}; } catch (e) { return {}; }
})();
const group = (n, digits) => n.toLocaleString("en-LK", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const trim = (n, unit) => `${n.toLocaleString("en-LK", { maximumFractionDigits: 2 })}${unit}`;

// The amount after a currency label, by the visitor's choices
export function shown(value, choices = settings) {
  const n = Number(value);
  if (!Number.isFinite(n)) return group(0, 2);
  if (choices.large === "short" && Math.abs(n) >= 1e6) return trim(n / 1e6, "M");
  if (choices.large === "lakhs" && Math.abs(n) >= 1e5) return trim(n / 1e5, " lakhs");
  return group(n, choices.cents === "no" ? 0 : 2);
}

export const numericDates = (choices = settings) => choices.date === "numeric";

// Rs. instead of LKR wherever the page writes the label, including text drawn later
function relabel(root) {
  const swap = text => text.replace(/\bLKR\b/g, "Rs.");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue.includes("LKR")) node.nodeValue = swap(node.nodeValue);
  }
}
if (settings.currency === "rs" && typeof document !== "undefined" && typeof MutationObserver === "function") {
  const start = () => {
    relabel(document.body);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "characterData") { if (record.target.nodeValue.includes("LKR")) relabel(record.target.parentNode); }
        else for (const node of record.addedNodes) if (node.nodeType === 1) relabel(node); else if (node.nodeType === 3 && node.nodeValue.includes("LKR")) relabel(node.parentNode);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
}
