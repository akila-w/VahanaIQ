import { baseVehicles as catalogue } from "./market-catalogue.js?v=2.10.0";
import { fmt, esc, minDownFor } from "./calculator.js?v=2.10.0";
import { parseMoneyText, formatMoneyText, attachMoneyInput } from "./money-input.js?v=2.10.0";
import { validPrice } from "./vehicle-validation.js?v=2.10.0";
import { newVehicleId } from "./storage.js?v=2.10.0";
import { openModal, closeModal } from "./modal.js?v=2.10.0";
import { searchCatalogue } from "./catalogue-search.js?v=2.10.0";
import { localStudioPhoto, NO_PHOTO } from "./image-fetcher.js?v=2.10.0";

const displayDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date.split("-").reverse().join("/") : "Date unavailable";
const routeLabel = v => v.w === "Official" ? "Official agent range" : v.w === "Grey" ? "Importer listing" : "Independent seller listing";
const availabilityLabel = v => ({ "used-listed": "Used listing: confirm registration age", "import-service": "Past import example: enquire about availability", "brochure-listed": "Local brochure: enquire about availability", "configurator-listed": "Local configurator: enquire about availability" }[v.availability] || "Confirm stock with seller");
const safeUrl = url => /^https:\/\//.test(url || "") ? url : "";
const bodyLabel = body => body === "Passenger car" ? "Car" : body;
const FUELS = { Petrol: "Petrol", Diesel: "Diesel", HEV: "Hybrid", PHEV: "Plug-in hybrid", BEV: "Electric" };
const UNKNOWN_SPEC = "Specifications to confirm";
const photoFor = v => v.img || localStudioPhoto(`${v.make} ${v.model}`);
const hasPrice = v => validPrice(v.price);
// Published prices first, then conflicting sources, then price on request
const priceRank = v => hasPrice(v) ? 0 : v.priceBasis === "conflicting" ? 1 : 2;
const byName = (a, b) => a.make.localeCompare(b.make) || a.name.localeCompare(b.name);
const SORTS = {
  priced: (a, b) => priceRank(a) - priceRank(b) || byName(a, b),
  "price-asc": (a, b) => priceRank(a) - priceRank(b) || (hasPrice(a) ? a.price - b.price : 0) || byName(a, b),
  "price-desc": (a, b) => priceRank(a) - priceRank(b) || (hasPrice(a) ? b.price - a.price : 0) || byName(a, b),
  name: byName
};
const FILTERS = ["catalogueMake", "catalogueBody", "catalogueFuel", "catalogueRoute", "cataloguePriceFilter"];

function matchesFilters(v, f) {
  if (f.catalogueMake && v.make !== f.catalogueMake) return false;
  if (f.catalogueBody && v.body !== f.catalogueBody) return false;
  if (f.catalogueFuel && (f.catalogueFuel === "unknown" ? v.fuel : v.fuel !== f.catalogueFuel)) return false;
  if (f.catalogueRoute && v.w !== f.catalogueRoute) return false;
  if (f.cataloguePriceFilter === "priced" && !hasPrice(v)) return false;
  return true;
}

// terms() returns { f, down }: the rental per rupee financed and the chosen down payment (%)
export function initCatalogue({ isSelected, onAdd, terms }) {
  const $ = id => document.getElementById(id);
  if (!$("openCatalogueBtn")) return () => {}; // Non-browser verification hosts.
  const pageSize = 12;
  let page = 0, pending = null, selection = "";

  const count = (key, value) => catalogue.filter(v => v[key] === value).length;
  $("catalogueMake").insertAdjacentHTML("beforeend", [...new Set(catalogue.map(v => v.make))].sort()
    .map(m => `<option value="${esc(m)}">${esc(m)} (${count("make", m)})</option>`).join(""));
  $("catalogueFuel").insertAdjacentHTML("beforeend", Object.entries(FUELS).filter(([k]) => count("fuel", k))
    .map(([k, label]) => `<option value="${k}">${label} (${count("fuel", k)})</option>`).join("") +
    `<option value="unknown">Not yet confirmed (${catalogue.filter(v => !v.fuel).length})</option>`);

  const filterValues = () => Object.fromEntries(FILTERS.map(id => [id, $(id).value]));

  // Estimated rental for a priced car, at its legal minimum down payment or the chosen one if higher
  function rentalLine(v, t) {
    if (!hasPrice(v) || !t || !(t.f > 0)) return "";
    const down = Math.max(t.down, minDownFor(v.cond));
    return down < 100 ? `About Rs. ${fmt(v.price * (1 - down / 100) * t.f)} a month with ${down}% down` : "";
  }

  // One line for every car without a price: what each Rs. 1.00 million of quote costs a month
  function perMillionLine(t) {
    if (!t || !(t.f > 0)) return "";
    const down = Math.max(t.down, minDownFor("New"));
    return down < 100 ? `No price yet? Each Rs. 1.00 million of a brand-new car's quote is about Rs. ${fmt(1e6 * (1 - down / 100) * t.f)} a month with ${down}% down.` : "";
  }

  function priceText(v) {
    if (hasPrice(v)) return `${v.priceBasis === "starting" ? "From " : ""}LKR ${fmt(v.price)}`;
    return v.priceBasis === "conflicting" ? "Prices differ between sources" : "Price on request";
  }

  function card(v, t) {
    const selected = isSelected(v.id);
    const photo = photoFor(v);
    const specs = [v.pt && v.pt !== UNKNOWN_SPEC ? v.pt : "", v.km].filter(Boolean).join(" · ");
    const link = hasPrice(v) ? { href: v.priceSourceUrl || v.sourceUrl, text: "View price source" } : { href: v.sourceUrl, text: "Ask the seller for a price" };
    const rent = rentalLine(v, t);
    return `<article class="catalogue-card">
        <div class="catalogue-photo${photo ? "" : " is-empty"}">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" width="400" height="250">` : NO_PHOTO}</div>
        <span class="catalogue-category">${esc(bodyLabel(v.body))} · ${esc(v.make)}</span>
        <h3>${esc(v.name)}${v.year ? ` (${v.year})` : ""}</h3>
        ${specs ? `<p class="hint">${esc(specs)}</p>` : ""}
        <p class="catalogue-price${hasPrice(v) ? "" : " is-unpriced"}">${priceText(v)}</p>
        ${rent ? `<p class="hint catalogue-rent">${rent}</p>` : ""}
        <p class="hint">${esc(routeLabel(v))} · ${esc(availabilityLabel(v))}${hasPrice(v) && v.priceCheckedMonth ? ` · Price checked ${v.priceCheckedMonth.split("-").reverse().join("/")}` : ""}</p>
        <a href="${esc(safeUrl(link.href))}" target="_blank" rel="noopener noreferrer">${link.text}<span class="sr-only"> for ${esc(v.name)}</span> ↗</a>
        <button class="btn-outline" type="button" data-catalogue-id="${esc(v.id)}" ${selected ? "disabled" : ""} aria-label="${selected ? "In comparison" : "Choose"} ${esc(v.name)}">${selected ? "In Comparison ✓" : "Choose & Add"}</button>
      </article>`;
  }

  function render() {
    const f = filterValues();
    const active = FILTERS.filter(id => f[id]).length;
    const matches = searchCatalogue(catalogue, $("catalogueSearch").value).filter(v => matchesFilters(v, f))
      .sort(SORTS[$("catalogueSort").value] || SORTS.priced);
    page = Math.min(page, Math.max(0, Math.ceil(matches.length / pageSize) - 1));
    const start = page * pageSize;
    const priced = matches.filter(hasPrice).length;
    $("catalogueCount").textContent = matches.length
      ? `${start + 1}–${Math.min(start + pageSize, matches.length)} of ${matches.length} vehicles · ${priced} with a published price`
      : "No matching vehicles. Try another make or model, or clear the filters.";
    $("catalogueClearFilters").hidden = !active && !$("catalogueSearch").value;
    $("catalogueFiltersCount").textContent = active ? `(${active})` : "";
    const t = terms ? terms() : null;
    $("cataloguePerMillion").textContent = perMillionLine(t);
    $("catalogueResults").innerHTML = matches.slice(start, start + pageSize).map(v => card(v, t)).join("");
    $("cataloguePrev").disabled = page === 0;
    $("catalogueNext").disabled = start + pageSize >= matches.length;
    $("cataloguePage").textContent = `Page ${page + 1} of ${Math.max(1, Math.ceil(matches.length / pageSize))}`;
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
    if (!name || !validPrice(price) || !["New", "Recond", "Recent", "Used"].includes(cond)) {
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
  const checked = catalogue.map(v => v.checkedOn).filter(Boolean).sort().pop();
  $("catalogueCoverage").textContent = `${catalogue.length} vehicles across ${new Set(catalogue.map(v => v.make)).size} makes, sources checked ${displayDate(checked)}. Most Sri Lankan agents don't publish prices, so many cars are price on request: ask the seller and enter your quote. Photos show the model and may differ from the exact trim. Further brands, trims and used models are still being checked.`;
  render();
  return () => {
    const next = catalogue.filter(v => isSelected(v.id)).map(v => v.id).join("|");
    if (next !== selection) { selection = next; render(); }
  };
}
