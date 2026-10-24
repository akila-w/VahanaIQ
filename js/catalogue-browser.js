import { formatDate as displayDate } from "./dates.js?v=2.11.5";
import { baseVehicles as fallbackCatalogue } from "./market-catalogue.js?v=2.11.5";
import { fmt, esc, minDownFor } from "./calculator.js?v=2.11.5";
import { parseMoneyText, formatMoneyText, attachMoneyInput } from "./money-input.js?v=2.11.5";
import { validPrice } from "./vehicle-validation.js?v=2.11.5";
import { newVehicleId } from "./storage.js?v=2.11.5";
import { openModal, closeModal } from "./modal.js?v=2.11.5";
import { searchCatalogue } from "./catalogue-search.js?v=2.11.5";
import { localStudioPhoto, NO_PHOTO } from "./image-fetcher.js?v=2.11.5";
import { creditFor, photoForModel, formatCreditHtml } from "./photo-credits.js?v=2.11.5";
import { identity as fallbackIdentity } from "./identity-data.js?v=2.11.5";
import { prepareBulkSelection } from "./bulk-selection.js?v=2.11.5";

const getIdentity = () => (typeof window !== "undefined" && window.__VAHANAIQ_IDENTITY__) || fallbackIdentity;

export function getUnifiedCatalogue(fallbackList = fallbackCatalogue) {
  const unified = (typeof window !== "undefined" && window.__VAHANAIQ_CATALOGUE__) || null;
  if (!unified?.models?.length) return fallbackList;

  const fallbackMap = new Map();
  for (const v of fallbackList) {
    fallbackMap.set(v.id, v);
    fallbackMap.set(`${v.make} ${v.model || v.name}`.toLowerCase(), v);
  }

  return unified.models.map(m => {
    const pricedOffers = (m.offers || []).filter(o => Number.isFinite(o.amount) && o.amount > 0);
    const best = pricedOffers.reduce((b, o) => !b || o.amount < b.amount ? o : b, null) || m.offers?.[0] || null;
    const existing = fallbackMap.get(m.id) || fallbackMap.get(best?.id) || fallbackMap.get(`${m.make} ${m.model || m.name}`.toLowerCase()) || {};

    const photo = m.images?.[0]?.smallSrc || m.images?.[0]?.src || existing.img || "";
    const price = best && Number.isFinite(best.amount) && best.amount > 0 ? best.amount : (existing.price || null);
    const priceBasis = best && price ? (["official", "dealer", "launch"].includes(best.kind) ? (best.kind === "launch" ? "starting" : "published") : "estimated") : (existing.priceBasis || "unpublished");
    const cond = best?.condition || existing.cond || "New";
    const fuel = best?.fuel || m.offers?.find(o => o.fuel)?.fuel || existing.fuel || "";
    const route = best?.route === "Distributor" ? "Official" : best?.route === "Dealer Listing" ? "Dealer" : (existing.w || "Grey");
    const normBody = (m.body || "").toLowerCase() === "passenger car" ? "Passenger car" : m.body;

    let pt = existing.pt || (fuel ? `${fuel} Powertrain` : "");
    if (!existing.pt && best?.name && /turbo/i.test(best.name)) {
      pt = `${best.name.replace(m.make, "").trim()} Turbo`;
    }

    return {
      id: m.id,
      make: m.make,
      model: m.model,
      name: m.name,
      body: normBody,
      trim: best?.trim || existing.trim || null,
      year: best?.year || existing.year || null,
      fuel: fuel,
      pt: pt,
      km: existing.km || "",
      w: route,
      cond: cond,
      price: price,
      priceBasis: priceBasis,
      priceCheckedMonth: "2026-10",
      pricePublishedMonth: null,
      priceSourceUrl: (best?.sourceUrl || m.sourceUrl || "").replace(/^http:\/\//, "https://"),
      sourceUrl: (m.sourceUrl || "").replace(/^http:\/\//, "https://"),
      checkedOn: m.checkedOn || "2026-10-23",
      availability: best?.sourceStatus === "estimated" ? "estimated" : (existing.availability || "marketed"),
      img: photo,
      custom: false,
      priceVerification: price ? "confirmed" : "unverified",
      priceScope: "model",
      priceVerifiedOn: m.checkedOn || "2026-10-23",
      power: existing.power || "",
      torque: existing.torque || "",
      transmission: existing.transmission || "",
      drivetrain: existing.drivetrain || "FWD",
      seats: existing.seats || 5,
      groundClearance: existing.groundClearance || "",
      dimensions: existing.dimensions || "",
      safety: existing.safety || "",
      features: existing.features || "",
      warranty: existing.warranty || (route === "Official" ? "Official Agent Warranty" : "Importer / Seller Warranty"),
      offers: m.offers || []
    };
  });
}

const routeLabel = v => v.w === "Official" ? "Official agent range" : v.w === "Grey" ? "Importer listing" : "Independent seller listing";
const availabilityLabel = v => ({ "used-listed": "Used listing: confirm registration age", "import-service": "Past import example: enquire about availability", "brochure-listed": "Local brochure: enquire about availability", "configurator-listed": "Local configurator: enquire about availability" }[v.availability] || "Confirm stock with seller");
const safeUrl = url => /^https:\/\//.test(url || "") ? url : "";
const bodyLabel = body => body === "Passenger car" ? "Car" : body;
const FUELS = { Petrol: "Petrol", Diesel: "Diesel", HEV: "Hybrid", PHEV: "Plug-in hybrid", BEV: "Electric" };
const UNKNOWN_SPEC = "Specifications to confirm";
const photoFor = v => photoForModel(v);
const hasPrice = v => validPrice(v.price);
const publishedPrice = v => hasPrice(v) && ['published', 'starting'].includes(v.priceBasis);
// Published prices first, then conflicting sources, then price on request
const priceRank = v => publishedPrice(v) ? 0 : hasPrice(v) && v.priceBasis !== "conflicting" ? 1 : 2;
const byName = (a, b) => a.make.localeCompare(b.make) || a.name.localeCompare(b.name);
const SORTS = {
  priced: (a, b) => priceRank(a) - priceRank(b) || byName(a, b),
  "price-asc": (a, b) => priceRank(a) - priceRank(b) || (hasPrice(a) ? a.price - b.price : 0) || byName(a, b),
  "price-desc": (a, b) => priceRank(a) - priceRank(b) || (hasPrice(a) ? b.price - a.price : 0) || byName(a, b),
  name: byName
};
const FILTERS = ["catalogueMake", "catalogueBody", "catalogueFuel", "catalogueRoute", "cataloguePriceFilter", "catalogueAffordability"];

function matchesFilters(v, f) {
  if (f.catalogueMake && v.make !== f.catalogueMake) return false;
  if (f.catalogueBody && v.body !== f.catalogueBody) return false;
  if (f.catalogueFuel && (f.catalogueFuel === "unknown" ? v.fuel : v.fuel !== f.catalogueFuel)) return false;
  if (f.catalogueRoute && v.w !== f.catalogueRoute) return false;
  if (f.cataloguePriceFilter === "priced" && !publishedPrice(v)) return false;
  return true;
}

// terms() returns { f, down }: the rental per rupee financed and the chosen down payment (%)
export function initCatalogue({ isSelected, onAdd, onAddBatch, terms }) {
  const $ = id => document.getElementById(id);
  if (!$("openCatalogueBtn")) return () => {}; // Non-browser verification hosts.
  const pageSize = 12;
  let page = 0, pending = null, selection = "";

  const catalogue = getUnifiedCatalogue();

  const count = (key, value) => catalogue.filter(v => v[key] === value).length;
  $("catalogueMake").insertAdjacentHTML("beforeend", [...new Set(catalogue.map(v => v.make))].sort()
    .map(m => `<option value="${esc(m)}">${esc(m)} (${count("make", m)})</option>`).join(""));
  $("catalogueFuel").insertAdjacentHTML("beforeend", Object.entries(FUELS).filter(([k]) => count("fuel", k))
    .map(([k, label]) => `<option value="${k}">${label} (${count("fuel", k)})</option>`).join("") +
    `<option value="unknown">Not yet confirmed (${catalogue.filter(v => !v.fuel).length})</option>`);

  const filterValues = () => Object.fromEntries(FILTERS.map(id => [id, $(id).value]));

  // Estimated rental for a priced car, at its legal minimum down payment or the chosen one if higher
  function rentalLine(v, t) {
    if (!hasPrice(v) || v.priceBasis === 'conflicting' || !t || !(t.f > 0)) return "";
    const down = Math.max(t.down, minDownFor(v.cond, v.financeClass, v.firstRegisteredOn));
    return down < 100 ? `About LKR ${fmt(v.price * (1 - down / 100) * t.f)} a month with ${down}% down` : "";
  }

  // One line for every car without a price: what each LKR 1.00 million of quote costs a month
  function perMillionLine(t) {
    if (!t || !(t.f > 0)) return "";
    const down = Math.max(t.down, minDownFor("New"));
    return down < 100 ? `No price yet? Each LKR 1.00 million of a brand-new car's quote is about LKR ${fmt(1e6 * (1 - down / 100) * t.f)} a month with ${down}% down.` : "";
  }

  function priceText(v) {
    if (v.priceBasis === 'conflicting') return 'Price needs confirmation';
    if (hasPrice(v) && !publishedPrice(v)) return `Unverified estimate · LKR ${fmt(v.price)}`;
    if (hasPrice(v)) return `${v.priceBasis === "starting" ? "From " : ""}LKR ${fmt(v.price)}`;
    return v.priceBasis === "conflicting" ? "Prices differ between sources" : "Price on request";
  }

  function card(v, t) {
    const ident = getIdentity();
    const selected = isSelected(v.id);
    const photo = v.img || photoFor(v);
    const candidateCredit = creditFor(v);
    const credit = candidateCredit?.img === photo ? candidateCredit : null;
    const specs = [v.pt && v.pt !== UNKNOWN_SPEC ? v.pt : "", v.km].filter(Boolean).join(" · ");
    const pills = [v.trim, v.power, v.drivetrain, v.seats ? `${v.seats} seats` : "", v.groundClearance ? `${v.groundClearance} clearance` : ""].filter(Boolean).slice(0, 3);
    const detailRows = [
      ["Trim", v.trim],
      ["Output", [v.power, v.torque].filter(Boolean).join(" · ")],
      ["Drive & Gearbox", [v.transmission, v.drivetrain].filter(Boolean).join(" · ")],
      ["Dimensions", v.dimensions],
      ["Safety", v.safety],
      ["Features", v.features],
      ["Warranty", v.warranty]
    ].filter(([, val]) => val);
    const link = hasPrice(v) ? { href: v.priceSourceUrl || v.sourceUrl, text: "View Price Source" } : { href: v.sourceUrl, text: "Request a Price" };
    const rent = rentalLine(v, t);
    return `<article class="catalogue-card">
        <div class="catalogue-photo${photo ? "" : " is-empty"}">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" width="400" height="250">` : NO_PHOTO}</div>
        <div class="catalogue-card-head">
          <span class="catalogue-category">${ident.brands?.[v.make] ? `<img class="brand-mark" src="${esc(ident.brands[v.make].localPath.replace("../", ""))}" alt="">` : ""}${esc(bodyLabel(v.body))} · ${esc(v.make)}</span>
          ${ident.models?.[`${v.make} ${v.model}`] ? `<img class="model-mark" src="${esc(ident.models[`${v.make} ${v.model}`].localPath.replace("../", ""))}" alt="">` : ""}
        </div>
        <h3>${esc(v.name)}${v.year ? ` (${v.year})` : ""}</h3>
        ${specs ? `<p class="hint catalogue-specs-line">${esc(specs)}</p>` : ""}
        ${pills.length ? `<div class="catalogue-spec-pills">${pills.map(p => `<span class="spec-pill">${esc(p)}</span>`).join("")}</div>` : ""}
        <div class="catalogue-price-block">
          <p class="catalogue-price${hasPrice(v) ? "" : " is-unpriced"}">${priceText(v)}</p>
          ${rent ? `<p class="hint catalogue-rent">${rent}</p>` : ""}
        </div>
        ${detailRows.length ? `<details class="catalogue-spec-details"><summary>Specifications &amp; trim details</summary><dl class="catalogue-spec-grid">${detailRows.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join("")}</dl></details>` : ""}
        <div class="catalogue-card-foot">
          <p class="hint catalogue-provenance">${esc(routeLabel(v))} · ${esc(availabilityLabel(v))}${v.priceVerifiedOn ? ` · Verified ${displayDate(v.priceVerifiedOn)}` : ""}</p>
          <div class="source-links"><a href="${esc(safeUrl(link.href))}" target="_blank" rel="noopener noreferrer">${link.text}<span class="sr-only"> for ${esc(v.name)}</span> ↗</a>${credit ? formatCreditHtml(credit) : ""}</div>
          <button class="btn-outline" type="button" data-catalogue-id="${esc(v.id)}" ${selected ? "disabled" : ""} aria-label="${selected ? "In comparison" : "Choose"} ${esc(v.name)}">${selected ? "In Comparison ✓" : "Choose & Add"}</button>
        </div>
      </article>`;
  }

  function render() {
    const f = filterValues();
    const t = terms ? terms() : null;
    const active = FILTERS.filter(id => f[id]).length;
    const matches = searchCatalogue(catalogue, $("catalogueSearch").value).filter(v => matchesFilters(v, f) && fitsBudget(v, f, t))
      .sort(SORTS[$("catalogueSort").value] || SORTS.priced);
    page = Math.min(page, Math.max(0, Math.ceil(matches.length / pageSize) - 1));
    const start = page * pageSize;
    const priced = matches.filter(v => hasPrice(v) && ['published', 'starting'].includes(v.priceBasis)).length;
    $("catalogueCount").textContent = matches.length
      ? `${start + 1}–${Math.min(start + pageSize, matches.length)} of ${matches.length} vehicles · ${priced} with a published price`
      : "No matching vehicles. Try another make or model, or clear the filters.";
    $("catalogueClearFilters").hidden = !active && !$("catalogueSearch").value;
    $("catalogueFiltersCount").textContent = active ? `(${active})` : "";
    $("cataloguePerMillion").textContent = f.catalogueAffordability === 'within' && !t?.income ? 'Enter your net income and loan terms above to filter by monthly budget.' : f.catalogueAffordability === 'within' ? `Using your income, existing payments, insurance, ${t.down}% down and current loan terms. Source-backed prices only; starting prices may increase. Deposit savings are checked in the planner.` : priced ? '' : perMillionLine(t);
    $("catalogueResults").innerHTML = matches.slice(start, start + pageSize).map(v => card(v, t)).join("");
    $("cataloguePrev").disabled = page === 0;
    $("catalogueNext").disabled = start + pageSize >= matches.length;
    $("cataloguePage").textContent = `Page ${page + 1} of ${Math.max(1, Math.ceil(matches.length / pageSize))}`;
    for (const [id, scope] of [["catalogueAddAll", catalogue], ["catalogueAddSearch", searchCatalogue(catalogue, $("catalogueSearch").value)], ["catalogueAddFiltered", matches]]) {
      const b = $(id); if (!b) continue;
      const pending = scope.filter(v => !isSelected(v.id));
      const { eligible } = prepareBulkSelection(pending);
      const isSearchBtn = id === 'catalogueAddSearch';
      const hasSearch = Boolean($("catalogueSearch").value.trim());
      b.disabled = !eligible.length || (isSearchBtn && !hasSearch);
      b.querySelector('.bulk-count').textContent = (isSearchBtn && !hasSearch) ? '0' : eligible.length;
    }
  }

  for (const id of ['catalogueAddAll', 'catalogueAddSearch', 'catalogueAddFiltered']) if ($(id)) $(id).addEventListener('click', () => {
    const searched = searchCatalogue(catalogue, $("catalogueSearch").value);
    const scope = id === 'catalogueAddAll' ? catalogue : id === 'catalogueAddSearch' ? searched : searched.filter(v => matchesFilters(v, filterValues()) && fitsBudget(v, filterValues(), terms?.()));
    const { eligible, skipped } = prepareBulkSelection(scope, catalogue.filter(v => isSelected(v.id)).map(v => v.id));
    if (!eligible.length || !onAddBatch) return;
    const batch = eligible.map(v => ({ ...v, id: newVehicleId(), catalogueId: v.id, cond: v.cond || 'New', conditionAssumed: !v.cond, img: v.img || photoFor(v), custom: true, legacy: false }));
    if (!onAddBatch(batch, skipped.length)) return;
    closeModal($("catalogueModal"));
    $("h-list").focus(); render();
  });

  function fitsBudget(v, f, t) {
    if (f.catalogueAffordability !== 'within') return true;
    if (!t?.income || !publishedPrice(v) || v.priceBasis === 'conflicting' || t.room < 0) return false;
    const down = Math.max(t.down, minDownFor(v.cond, v.financeClass, v.firstRegisteredOn));
    return v.price * (1 - down / 100) * t.f <= t.room;
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
    $("cataloguePrice").value = validPrice(pending.price) && pending.priceBasis !== 'conflicting' ? formatMoneyText(String(pending.price)) : "";
    $("cataloguePriceNote").textContent = pending.priceBasis === "conflicting" ? "The source does not establish a reliable price for this variant. Enter a confirmed quote." : publishedPrice(pending) ? "Source-backed asking/starting amount, checked " + displayDate(pending.priceVerifiedOn || pending.checkedOn) + ". Confirm the exact specification and current quote." : validPrice(pending.price) ? "Unverified catalogue estimate. Replace it with a seller quote before relying on the calculation." : "No verified price is published here. Enter your quote to calculate a lease.";
    $("catalogueAddError").textContent = "";

    if ($("catalogueTrimWrap") && $("catalogueTrimSelect")) {
      const offers = pending.offers || [];
      if (offers.length > 1) {
        $("catalogueTrimWrap").hidden = false;
        $("catalogueTrimSelect").innerHTML = offers.map((o, idx) =>
          `<option value="${idx}">${esc(o.name || o.trim || pending.name)}${o.amount ? ` · LKR ${fmt(o.amount)}` : ""}${o.condition ? ` (${esc(o.condition)})` : ""}</option>`
        ).join("");
        $("catalogueTrimSelect").value = "0";
      } else {
        $("catalogueTrimWrap").hidden = true;
      }
    }

    openModal($("catalogueAddModal"), button, $("cataloguePrice"));
  });

  if ($("catalogueTrimSelect")) {
    $("catalogueTrimSelect").addEventListener("change", () => {
      if (!pending?.offers) return;
      const o = pending.offers[Number($("catalogueTrimSelect").value)];
      if (!o) return;
      $("catalogueName").value = o.name || (pending.name + (o.trim ? ` ${o.trim}` : ""));
      $("catalogueCondition").value = o.condition || pending.cond || "New";
      $("cataloguePrice").value = validPrice(o.amount) ? formatMoneyText(String(o.amount)) : "";
      $("cataloguePriceNote").textContent = o.amount ? `Source-backed amount (${o.kind || "published"}), checked ${displayDate(o.checkedOn || pending.checkedOn)}. Confirm current quote.` : "No published price for this variant; enter quote.";
    });
  }

  for (const id of ["closeCatalogueAddBtn", "cancelCatalogueAddBtn"]) $(id).addEventListener("click", () => closeModal($("catalogueAddModal")));
  attachMoneyInput($("cataloguePrice"));
  window.addEventListener("vahanaiq:copy-reset", () => { pending = null; });
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
      img: pending.img || photoFor(pending),
      custom: true, legacy: false, priceBasis: published ? pending.priceBasis : "user-entered",
      priceSourceUrl: published ? pending.priceSourceUrl : null, priceCheckedMonth: published ? pending.priceCheckedMonth : null };
    if (!onAdd(vehicle)) return;
    closeModal($("catalogueAddModal"));
    closeModal($("catalogueModal"));
    $("h-list").focus();
    render();
  });
  const checked = catalogue.map(v => v.checkedOn).filter(Boolean).sort().pop();
  $("catalogueCoverage").textContent = `${catalogue.length} vehicles across ${new Set(catalogue.map(v => v.make)).size} makes, sources checked ${displayDate(checked)}. Published prices and unverified estimates are labelled separately. Ask the seller for a current quote. Photos may differ from the exact trim. Pickup/van registration classes and lender valuations need confirmation. Further brands, trims and used models are still being checked.`;
  render();
  return () => {
    const next = catalogue.filter(v => isSelected(v.id)).map(v => v.id).join("|");
    if (next !== selection) { selection = next; render(); }
  };
}
