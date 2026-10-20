import { baseVehicles as catalogue } from "./market-catalogue.js?v=2.8.0";
import { fmt, esc } from "./calculator.js?v=2.8.0";
import { parseMoneyText, formatMoneyText, attachMoneyInput } from "./money-input.js?v=2.8.0";
import { validPrice } from "./vehicle-validation.js?v=2.8.0";
import { newVehicleId } from "./storage.js?v=2.8.0";
import { openModal, closeModal } from "./modal.js?v=2.8.0";
import { searchCatalogue } from "./catalogue-search.js?v=2.8.0";

const displayDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date.split("-").reverse().join("/") : "Date unavailable";
const routeLabel = v => v.w === "Official" ? "Official agent range" : v.w === "Grey" ? "Importer listing" : "Independent seller listing";
const availabilityLabel = v => ({ "used-listed": "Used listing: confirm registration age", "import-service": "Past import example: enquire about availability", "brochure-listed": "Local brochure: enquire about availability", "configurator-listed": "Local configurator: enquire about availability" }[v.availability] || "Confirm stock with seller");
const safeUrl = url => /^https:\/\//.test(url || "") ? url : "";

export function initCatalogue({ isSelected, onAdd }) {
  const $ = id => document.getElementById(id);
  if (!$("openCatalogueBtn")) return () => {}; // Non-browser verification hosts.
  const pageSize = 12;
  let page = 0, pending = null, selection = "";
  const sorted = [...catalogue].sort((a, b) => a.make.localeCompare(b.make) || a.name.localeCompare(b.name));

  function render() {
    const matches = searchCatalogue(sorted, $("catalogueSearch").value);
    page = Math.min(page, Math.max(0, Math.ceil(matches.length / pageSize) - 1));
    const start = page * pageSize;
    $("catalogueCount").textContent = matches.length ? `${start + 1}–${Math.min(start + pageSize, matches.length)} of ${matches.length} entries` : "No matching vehicles. Try a make or model name.";
    $("catalogueResults").innerHTML = matches.slice(start, start + pageSize).map(v => {
      const selected = isSelected(v.id);
      const price = validPrice(v.price) ? `${v.priceBasis === "starting" ? "From " : ""}LKR ${fmt(v.price)}` : "Price not published";
      return `<article class="catalogue-card">
        <span class="catalogue-category">${esc(v.body)} · ${esc(v.make)}</span>
        <h3>${esc(v.name)}${v.year ? ` (${v.year})` : ""}</h3>
        <p class="hint">${esc(v.pt)}${!v.trim ? " · Trim to confirm" : ""}</p>
        <p class="catalogue-price">${price}</p>
        <p class="hint">${esc(routeLabel(v))} · ${esc(availabilityLabel(v))}</p>
        <p class="hint">Source checked ${displayDate(v.checkedOn)}${validPrice(v.price) ? ` · Price checked ${(v.priceCheckedMonth || "").split("-").reverse().join("/")}` : ""}</p>
        <a href="${esc(safeUrl(v.sourceUrl))}" target="_blank" rel="noopener noreferrer">View local source<span class="sr-only"> for ${esc(v.name)}</span> ↗</a>
        <button class="btn-outline" type="button" data-catalogue-id="${esc(v.id)}" ${selected ? "disabled" : ""} aria-label="${selected ? "In comparison" : "Choose"} ${esc(v.name)}">${selected ? "In comparison ✓" : "Choose & add"}</button>
      </article>`;
    }).join("");
    $("cataloguePrev").disabled = page === 0;
    $("catalogueNext").disabled = start + pageSize >= matches.length;
    $("cataloguePage").textContent = `Page ${page + 1} of ${Math.max(1, Math.ceil(matches.length / pageSize))}`;
  }

  const open = opener => {
    render();
    openModal($("catalogueModal"), opener, $("catalogueSearch"));
  };
  $("openCatalogueBtn").addEventListener("click", () => open($("openCatalogueBtn")));
  $("browseEmptyBtn").addEventListener("click", () => open($("browseEmptyBtn")));
  $("closeCatalogueBtn").addEventListener("click", () => closeModal($("catalogueModal")));
  $("catalogueSearch").addEventListener("input", () => { page = 0; render(); });
  for (const [id, delta] of [["cataloguePrev", -1], ["catalogueNext", 1]]) $(id).addEventListener("click", () => { page += delta; render(); $("catalogueCount").focus(); });

  $("catalogueResults").addEventListener("click", event => {
    const button = event.target.closest("button[data-catalogue-id]");
    if (!button) return;
    pending = catalogue.find(v => v.id === button.dataset.catalogueId);
    if (!pending || isSelected(pending.id)) return;
    $("catalogueAddTitle").textContent = `Compare ${pending.name}`;
    $("catalogueName").value = pending.name + (pending.year ? ` (${pending.year})` : "");
    $("catalogueCondition").value = pending.cond || "";
    $("cataloguePrice").value = validPrice(pending.price) ? formatMoneyText(String(pending.price)) : "";
    $("cataloguePriceNote").textContent = pending.priceBasis === "conflicting" ? "The source shows multiple prices for this variant. Enter a confirmed price." : validPrice(pending.price) ? "Published asking/starting price, checked " + displayDate(pending.checkedOn) + ". Confirm the exact specification and current quote." : "No verified price is published here. Enter your quote to calculate a lease.";
    $("catalogueAddError").textContent = "";
    openModal($("catalogueAddModal"), button, $("cataloguePrice"));
  });
  for (const id of ["closeCatalogueAddBtn", "cancelCatalogueAddBtn"]) $(id).addEventListener("click", () => closeModal($("catalogueAddModal")));
  attachMoneyInput($("cataloguePrice"));
  $("catalogueAddForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!pending) return;
    const price = parseMoneyText($("cataloguePrice").value);
    const name = $("catalogueName").value.trim();
    const cond = $("catalogueCondition").value;
    if (!name || !validPrice(price) || !["New", "Recond", "Used"].includes(cond)) {
      $("catalogueAddError").textContent = "Enter a vehicle name, a price greater than zero and a condition.";
      return;
    }
    const published = price === pending.price && cond === pending.cond;
    const vehicle = { ...pending, id: newVehicleId(), catalogueId: pending.id, name, price, cond,
      custom: true, legacy: false, priceBasis: published ? pending.priceBasis : "user-entered",
      priceSourceUrl: published ? pending.priceSourceUrl : null, priceCheckedMonth: published ? pending.priceCheckedMonth : null };
    if (!onAdd(vehicle)) return;
    closeModal($("catalogueAddModal"));
    closeModal($("catalogueModal"));
    $("h-list").focus();
    render();
  });
  $("catalogueCoverage").textContent = `${catalogue.length} entries across ${new Set(catalogue.map(v => v.make)).size} makes. Source-backed first release; further brands, trims and used models are still being checked.`;
  render();
  return () => {
    const next = catalogue.filter(v => isSelected(v.id)).map(v => v.id).join("|");
    if (next !== selection) { selection = next; render(); }
  };
}
