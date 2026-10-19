import { fmt, esc, num, computeLeaseTable } from "./calculator.js?v=2.6.0";
import { baseVehicles } from "./catalog.js?v=2.6.0";
import { normalizeImageToStudio } from "./canvas-utils.js?v=2.6.0";
import { discoverActiveModel, searchVehicleWithGemini } from "./gemini.js?v=2.6.0";
import { fetchVehicleStudioImage } from "./image-fetcher.js?v=2.6.0";
import { getApiKey, getProxyUrl, setApiKey, removeApiKey, initMagicLink, cloneBaseCars, loadSavedCars, saveCars } from "./storage.js?v=2.6.0";

// Force purge any legacy cached model entry holding 3.8 flash
if (typeof localStorage !== "undefined" && localStorage.getItem("sl_lease_gemini_model")?.includes("gemini-3.8-flash")) {
  localStorage.removeItem("sl_lease_gemini_model");
  localStorage.removeItem("sl_lease_gemini_model_v");
}

const $ = id => document.getElementById(id);

let cars = loadSavedCars(baseVehicles);
let sortKey = "price", sortDir = -1;
let currentAiData = null;
let currentAiImgSrc = "";
let pendingAdImage = null;
let currentDiscoveredVehicles = [];

export function formatVehicleTitle(modelName, trimName, year) {
  let m = (modelName || "").trim();
  let t = (trimName || "").trim();
  const y = String(year || "").trim();

  // Strip existing (YYYY) or standalone 4-digit year from modelName and trimName
  m = m.replace(/\s*\(\d{4}\)/g, "").replace(/\b(19|20)\d{2}\b/g, "").trim();
  t = t.replace(/\s*\(\d{4}\)/g, "").replace(/\b(19|20)\d{2}\b/g, "").trim();

  // If trimName starts with modelName (or parts of it), strip redundant prefix
  if (t && m) {
    const mLower = m.toLowerCase();
    const tLower = t.toLowerCase();
    if (tLower.startsWith(mLower)) {
      t = t.slice(m.length).trim();
    } else {
      const words = m.split(/\s+/);
      if (words.length > 1) {
        const withoutMake = words.slice(1).join(" ").toLowerCase();
        if (tLower.startsWith(withoutMake)) {
          t = t.slice(withoutMake.length).trim();
        }
      }
    }
  }

  // If trim is empty or "Standard" / "Standard Trim" or equals model
  if (!t || /^standard(\s+trim)?$/i.test(t) || t.toLowerCase() === m.toLowerCase()) {
    return y ? `${m} (${y})` : m;
  }

  return y ? `${m} ${t} (${y})` : `${m} ${t}`;
}

const cols = [
  ["name", "Vehicle"],
  ["price", "Price", "n"],
  ["rental", "Monthly rental", "n"],
  ["bar", "Share of your budget"],
  ["interest", "Total interest", "n"],
  ["total", "Total outlay", "n"],
  ["need", "Income needed", "n"],
  ["status", "Status"]
];

function render() {
  const { s, f, rows, room } = computeLeaseTable(cars);
  
  // Summary Stats
  let sum = "";
  if (s.income) {
    if (s.down >= 100) {
      sum += `<div class="stat"><b>100% Cash</b><span>100% cash purchase — Rs. 0 monthly lease loan</span></div>`;
      sum += `<div class="stat"><b>Rs. 0</b><span>Monthly lease rental commitment</span></div>`;
      sum += `<div class="stat"><b>Rs. ${fmt(room)}</b><span>Monthly room available for other commitments</span></div>`;
    } else {
      const maxLoan = room / f;
      const maxPrice = maxLoan / (1 - s.down / 100);
      sum += `<div class="stat"><b>Rs. ${fmt(room)}</b><span>Highest monthly rental at a ${Math.round(s.dti * 100)}% limit${s.debt ? " after existing payments" : ""}</span></div>`;
      sum += `<div class="stat"><b>Rs. ${fmt(maxPrice)}</b><span>Highest vehicle price you can finance with ${s.down}% down</span></div>`;
      sum += `<div class="stat"><b>Rs. ${fmt(maxPrice * s.down / 100)}</b><span>Cash needed up front for that vehicle</span></div>`;
    }
  } else {
    if (s.down >= 100) {
      sum += `<div class="stat"><b>Rs. 0</b><span>Monthly rental (100% down payment)</span></div>`;
      sum += `<div class="stat"><b>100% Cash</b><span>Zero lease financing needed</span></div>`;
      sum += `<div class="stat"><span>Enter your net monthly income above to evaluate affordability and budget room.</span></div>`;
    } else {
      sum += `<div class="stat"><b>Rs. ${fmt(1e6 * f * (1 - s.down / 100))}</b><span>Monthly rental for every Rs. 1 million of vehicle price</span></div>`;
      sum += `<div class="stat"><b>Rs. ${fmt(1e6 * f * (1 - s.down / 100) / s.dti)}</b><span>Net income needed per Rs. 1 million of price at a ${Math.round(s.dti * 100)}% limit</span></div>`;
      sum += `<div class="stat"><span>Enter your net monthly income above to see which vehicles fit and the highest price you can finance.</span></div>`;
    }
  }
  $("summary").innerHTML = sum;

  // Preferential Rate Interactive Hint
  const rateHint = $("rateHint");
  if (rateHint) {
    if (s.income > 200000 && num("rate") === 16) {
      rateHint.innerHTML = `<button type="button" id="applyPrefRateBtn" style="color:var(--accent);font-weight:600;cursor:pointer;background:none;border:none;padding:0;font:inherit">You earn over Rs. 200,000 — click to apply 15% preferential rate</button>`;
      const prefBtn = $("applyPrefRateBtn");
      if (prefBtn) {
        prefBtn.onclick = () => {
          $("rate").value = "15";
          render();
        };
      }
    } else if (num("rate") === 15 && s.income > 200000) {
      rateHint.textContent = "✓ 15% preferential rate applied";
    } else {
      rateHint.textContent = "15% may apply if you earn over Rs. 200,000";
    }
  }

  // Filters
  const maxP = num("maxprice") > 0 ? num("maxprice") * 1e6 : Infinity;
  const wFilter = $("warr").value;
  const cFilter = $("condFilter").value;
  const affordVal = $("afford").value;

  let list = rows.filter(r => {
    if (r.price > maxP) return false;
    if (wFilter === "official" && r.w !== "Official") return false;
    if (wFilter === "grey" && r.w !== "Grey") return false;
    if (cFilter !== "all" && (r.cond || "New") !== cFilter) return false;
    if (affordVal === "ok") {
      if (!s.income) return false;
      if (r.rental > room) return false;
    }
    return true;
  });

  const key = sortKey === "bar" ? "rental" : sortKey;
  list.sort((a, b) => {
    const x = a[key], y = b[key];
    if (typeof x === "string") return sortDir * x.localeCompare(y);
    return sortDir * (x - y);
  });

  // Table Header (making bar non-sortable)
  $("head").innerHTML = cols.map(c => {
    const sortable = c[0] !== "status" && c[0] !== "bar";
    const k = c[0];
    const cur = k === sortKey ? (sortDir === -1 ? "descending" : "ascending") : "none";
    const arrow = k === sortKey ? (sortDir === -1 ? " ▾" : " ▴") : "";
    return `<th class="${c[2] || ""}" aria-sort="${cur}">${sortable ? `<button type="button" data-k="${k}">${c[1]}${arrow}</button>` : c[1]}</th>`;
  }).join("");

  $("sort").value = [...$("sort").options].some(o => o.value === sortKey + "|" + sortDir) ? sortKey + "|" + sortDir : "";

  const maxRent = Math.max(1, ...rows.map(r => r.rental));
  const scale = s.income ? Math.max(room, maxRent) : maxRent;
  const labels = { ok: "Comfortable", mid: "Stretching", bad: "Out of reach", na: "" };

  const hasCustom = cars.some(c => c.custom);
  $("resetCatalogWrap").hidden = !hasCustom;

  // Table Body Rows
  $("rows").innerHTML = list.map(r => {
    const w = Math.min(100, r.rental / scale * 100);
    const mk = s.income ? `<span class="mark" style="left:${Math.min(100, room / scale * 100)}%" title="Your highest rental"></span>` : "";
    const fillCol = r.status === "bad" ? "var(--bad)" : r.status === "mid" ? "var(--mid)" : "var(--accent)";
    const condLabel = r.cond === "Used" ? "Registered Used" : r.cond === "Recond" ? "Reconditioned" : "Brand New";
    const isUnreg = (r.cond || "New") !== "Used";
    const showLtvWarn = s.down < 50 && isUnreg;
    const ltvWarnBadge = showLtvWarn ? `<span class="ltv-warn" title="CBSL Directions No. 01 of 2026 mandates min. 50% down payment for unregistered & reconditioned vehicles (current down payment: ${s.down}%)">⚠️ &lt;50% down</span>` : "";
    
    return `<tr>
<td class="name"><div class="car">${r.img ? `<img src="${esc(r.img)}" alt="${esc(r.name)}" loading="lazy" onerror="this.onerror=null;this.outerHTML='<div class=\\'ph\\'><svg width=\\'22\\' height=\\'22\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' style=\\'opacity:0.55\\'><rect width=\\'18\\' height=\\'18\\' x=\\'3\\' y=\\'3\\' rx=\\'3\\'/><path d=\\'m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9\\'/><path d=\\'M14 21v-4a2 2 0 0 0-4 0v4\\'/></svg><span>No photo</span></div>';">` : '<div class="ph"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.55"><rect width="18" height="18" x="3" y="3" rx="3"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M14 21v-4a2 2 0 0 0-4 0v4"/></svg><span>No photo</span></div>'}<div><b>${esc(r.name)}</b><small>${esc(r.pt || "")}${r.km ? " · " + esc(r.km) : ""}</small><div class="warr">${r.w === "Official" ? "Official warranty" : "Grey market"}<span class="cond-tag clickable-cond" data-idx="${r._idx}" title="Click to cycle condition (Brand New ⇄ Reconditioned ⇄ Registered Used)">${condLabel} <span class="cycle-icon" aria-hidden="true">⇄</span></span>${ltvWarnBadge}${r.custom ? ` · <button class="link" type="button" data-del="${r._idx}" aria-label="Remove ${esc(r.name)}">remove</button>` : ""}</div></div></div></td>
<td class="n price-cell" data-label="Price (Rs.)" data-idx="${r._idx}" title="Click to edit price inline">${fmt(r.price)} <span class="edit-icon" aria-hidden="true">✎</span></td>
<td class="n" data-label="Monthly rental (Rs.)"><b>${fmt(r.rental)}</b></td>
<td data-label="Share of your budget"><div class="track" role="img" aria-label="Rental is ${Math.round(w)}% of the scale"><span class="fill" style="width:${w}%;background:${fillCol}"></span>${mk}</div></td>
<td class="n" data-label="Total interest (Rs.)">${fmt(r.interest)}</td>
<td class="n" data-label="Total outlay (Rs.)">${fmt(r.total)}</td>
<td class="n" data-label="Income needed (Rs.)">${fmt(r.need)}</td>
<td data-label="Status">${r.status === "na" ? '<span class="na">-</span>' : `<span class="tag ${r.status}">${labels[r.status]}</span>`}</td></tr>`;
  }).join("");

  if (list.length === 0) {
    if (affordVal === "ok" && !s.income) {
      $("empty").textContent = "Enter your net monthly income above to filter vehicles you can afford.";
    } else {
      $("empty").textContent = "No vehicles match these filters.";
    }
    $("empty").hidden = false;
  } else {
    $("empty").hidden = true;
  }
}

// Global Event Listeners
document.addEventListener("input", e => {
  if (e.target.id === "sort" && e.target.value) {
    const [k, d] = e.target.value.split("|");
    sortKey = k; sortDir = +d;
  }
  if (e.target.tagName === "SELECT") return; // Let change handler process select elements
  if (e.target.closest("#h-terms,.panel") && !e.target.closest(".modal")) render();
});

document.addEventListener("change", e => {
  if (e.target.id === "sort" && e.target.value) {
    const [k, d] = e.target.value.split("|");
    sortKey = k; sortDir = +d;
  }
  if (e.target.tagName === "SELECT" && !e.target.closest(".modal")) render();
});

$("head").addEventListener("click", e => {
  const b = e.target.closest("button[data-k]");
  if (!b) return;
  const k = b.dataset.k;
  if (k === sortKey) sortDir = -sortDir; else { sortKey = k; sortDir = k === "name" ? 1 : -1; }
  render();
});

// Interactive Table Actions: Remove, Condition Cycling, Inline Price Editing
$("rows").addEventListener("click", e => {
  // 1. Delete vehicle
  const b = e.target.closest("button[data-del]");
  if (b) {
    const idx = +b.dataset.del;
    if (cars[idx] && cars[idx].custom) {
      if (typeof cars[idx]._baseId === "number" && baseVehicles[cars[idx]._baseId]) {
        const bId = cars[idx]._baseId;
        cars[idx] = Object.assign({}, baseVehicles[bId], { _baseId: bId, custom: false });
      } else {
        cars.splice(idx, 1);
      }
      saveCars(cars);
      render();
    }
    return;
  }

  // 2. Condition Quick-Switch Cycling
  const condTag = e.target.closest(".cond-tag.clickable-cond");
  if (condTag) {
    const idx = +condTag.dataset.idx;
    if (cars[idx]) {
      const cur = cars[idx].cond || "New";
      const cycle = { "New": "Recond", "Recond": "Used", "Used": "New" };
      cars[idx].cond = cycle[cur] || "New";
      cars[idx].custom = true;
      saveCars(cars);
      render();
    }
    return;
  }

  // 3. Inline Price Editing
  const priceCell = e.target.closest(".price-cell");
  if (priceCell && !priceCell.querySelector("input")) {
    const idx = +priceCell.dataset.idx;
    if (!cars[idx]) return;
    const curP = cars[idx].price;
    priceCell.innerHTML = `<input type="number" class="inline-price-input" value="${curP}" step="50000" min="0" inputmode="numeric">`;
    const input = priceCell.querySelector("input");
    input.focus();
    input.select();

    const commitPrice = () => {
      const newP = parseFloat(input.value);
      if (newP > 0 && newP !== curP) {
        cars[idx].price = newP;
        cars[idx].custom = true;
        saveCars(cars);
      }
      render();
    };

    input.addEventListener("keydown", evt => {
      if (evt.key === "Enter") {
        input.blur();
      } else if (evt.key === "Escape") {
        render();
      }
    });

    input.addEventListener("blur", commitPrice, { once: true });
    return;
  }
});

$("resetCatalogBtn").addEventListener("click", () => {
  if (confirm("Reset catalogue to default 12 vehicles? Custom vehicles and inline modifications will be removed.")) {
    localStorage.removeItem("sl_lease_custom_cars_v2");
    cars = cloneBaseCars(baseVehicles);
    render();
  }
});

// API Settings UI
function updateKeyStatusUI() {
  const k = getApiKey();
  const proxy = getProxyUrl();
  if (k) {
    $("apiKeyInput").value = k;
    $("keyStatus").innerHTML = `<span style="color:var(--ok)">✓ Personal API Key saved (${k.slice(0, 6)}...${k.slice(-4)})</span>`;
  } else if (proxy) {
    $("apiKeyInput").value = "";
    $("keyStatus").innerHTML = `<span style="color:var(--accent)">✓ Connected via built-in VahanaIQ cloud proxy. (Or provide your own Google AI Studio key above for unlimited personal quota).</span>`;
  } else {
    $("apiKeyInput").value = "";
    $("keyStatus").textContent = "No key set. AI vehicle search requires a free Google AI Studio key or cloud proxy.";
  }
}

$("openSettingsBtn").addEventListener("click", () => {
  updateKeyStatusUI();
  $("settingsModal").classList.add("open");
  setTimeout(() => $("apiKeyInput").focus(), 50);
});
$("closeSettingsBtn").addEventListener("click", () => { $("settingsModal").classList.remove("open"); });

$("saveKeyBtn").addEventListener("click", () => {
  const val = $("apiKeyInput").value.trim();
  if (!val) { alert("Please enter a valid Google AI Studio API key."); return; }
  setApiKey(val);
  updateKeyStatusUI();
  $("settingsModal").classList.remove("open");
});

$("clearKeyBtn").addEventListener("click", () => {
  removeApiKey();
  localStorage.removeItem("sl_lease_gemini_model");
  localStorage.removeItem("sl_lease_gemini_model_v");
  updateKeyStatusUI();
});

$("testKeyBtn").addEventListener("click", async () => {
  const val = $("apiKeyInput").value.trim();
  if (!val) { alert("Please enter an API key to test."); return; }
  $("keyStatus").innerHTML = '<span class="spin"></span>Detecting available models & testing connection...';
  try {
    const model = await discoverActiveModel(val, true);
    const cleanName = model.replace("models/", "");
    $("keyStatus").innerHTML = `<span style="color:var(--ok);font-weight:600">✓ Connection successful! Active model: ${cleanName}</span>`;
  } catch (e) {
    $("keyStatus").innerHTML = `<span style="color:var(--bad)">Connection failed: ${e.message}</span>`;
  }
});

// AI Search Modal UI
$("openAiModalBtn").addEventListener("click", () => {
  $("aiModal").classList.add("open");
  setTimeout(() => $("aiSearchQuery").focus(), 50);

  if (!getApiKey() && !getProxyUrl()) {
    $("aiSearchMsg").innerHTML = '<span style="color:var(--mid)">Tip: Configure your free Gemini key in settings (⚙️) for live Sri Lankan vehicle valuation and trims.</span>';
  } else if (getProxyUrl() && !getApiKey()) {
    $("aiSearchMsg").innerHTML = '<span class="hint" style="color:var(--mute)">Connected via VahanaIQ Cloud Proxy.</span>';
  } else {
    $("aiSearchMsg").textContent = "";
  }
});

$("closeAiModalBtn").addEventListener("click", () => { $("aiModal").classList.remove("open"); });
$("aiCancelBtn").addEventListener("click", () => { $("aiModal").classList.remove("open"); });
$("mCancelBtn").addEventListener("click", () => { $("aiModal").classList.remove("open"); });

// Modal Backdrop Click & Escape Key Handling
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    $("aiModal").classList.remove("open");
    $("settingsModal").classList.remove("open");
  }
});

$("aiModal").addEventListener("click", e => {
  if (e.target === $("aiModal")) $("aiModal").classList.remove("open");
});

$("settingsModal").addEventListener("click", e => {
  if (e.target === $("settingsModal")) $("settingsModal").classList.remove("open");
});

// Enter key bindings
$("aiSearchQuery").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("aiSearchBtn").click();
  }
});

$("apiKeyInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("saveKeyBtn").click();
  }
});

$("paneManual").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.tagName === "INPUT") {
    e.preventDefault();
    $("mAddBtn").click();
  }
});

$("tabAiBtn").addEventListener("click", () => {
  $("tabAiBtn").classList.add("active"); $("tabManualBtn").classList.remove("active");
  $("paneAi").hidden = false; $("paneManual").hidden = true;
});
$("tabManualBtn").addEventListener("click", () => {
  $("tabManualBtn").classList.add("active"); $("tabAiBtn").classList.remove("active");
  $("paneAi").hidden = true; $("paneManual").hidden = false;
});

// Classified Ad / Auction Sheet Screenshot Upload & Clipboard Paste
function setAttachedAdImage(file) {
  const reader = new FileReader();
  reader.onload = evt => {
    pendingAdImage = {
      mimeType: file.type || "image/jpeg",
      data: evt.target.result.split(",")[1]
    };
    $("aiAttachedAdLabel").textContent = `📷 ${file.name || "Screenshot"} attached`;
    $("aiAttachedAdBox").style.display = "flex";
  };
  reader.readAsDataURL(file);
}

$("aiAdFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) setAttachedAdImage(file);
});

$("aiRemoveAdImgBtn").addEventListener("click", () => {
  pendingAdImage = null;
  $("aiAdFile").value = "";
  $("aiAttachedAdBox").style.display = "none";
});

// Support paste anywhere inside aiModal
$("aiModal").addEventListener("paste", e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        setAttachedAdImage(file);
        e.preventDefault();
        break;
      }
    }
  }
});

// Search execution
$("aiSearchBtn").addEventListener("click", async () => {
  const query = $("aiSearchQuery").value.trim();
  if (!query && !pendingAdImage) {
    $("aiSearchMsg").textContent = "Please enter a vehicle name, paste an ad, or attach a screenshot.";
    return;
  }
  const key = getApiKey();
  const proxy = getProxyUrl();
  if (!key && !proxy) {
    $("aiModal").classList.remove("open");
    $("settingsModal").classList.add("open");
    alert("Please configure your free Google AI Studio API key in settings or connect a proxy.");
    return;
  }

  $("aiSearchMsg").innerHTML = '<span class="spin"></span>Analyzing Sri Lankan market availability, trims, and valuations...';
  $("aiUnavailBox").hidden = true;
  $("aiResultForm").hidden = true;
  $("aiDiscoveryBox").hidden = true;

  try {
    const parsed = await searchVehicleWithGemini(query, key, pendingAdImage);
    currentAiData = parsed;
    renderAiResults(parsed);
  } catch (e) {
    const isProxyIssue = e.message.includes("proxy") || e.message.includes("policy") || e.message.includes("HTTP 403") || e.message.includes("404") || e.message.includes("Failed to fetch");
    const guide = isProxyIssue
      ? `<br><small style="margin-top:6px;display:block;color:var(--mute)">Cloud proxy unavailable? You can add a free Google AI Studio key in <button type="button" class="link" id="errSettingsLink" style="font-weight:600">Settings</button> to use gemini-2.5-flash directly.</small>`
      : "";
    $("aiSearchMsg").innerHTML = `<span style="color:var(--bad)">Search error: ${esc(e.message)}</span>${guide}`;
    const link = $("errSettingsLink");
    if (link) {
      link.addEventListener("click", () => {
        $("aiModal").classList.remove("open");
        $("settingsModal").classList.add("open");
      });
    }
  }
});

async function renderAiResults(data) {
  $("aiSearchMsg").textContent = "";

  // 1. Multi-vehicle discovery / comparative query
  if (data.is_multi_vehicle && Array.isArray(data.discovered_vehicles) && data.discovered_vehicles.length > 1) {
    renderDiscoveryChecklist(data.discovered_vehicles);
    return;
  }

  // 2. Unavailable in Sri Lanka
  if (!data.is_available_in_sri_lanka) {
    $("aiUnavailBox").hidden = false;
    $("aiUnavailBox").innerHTML = `<b>⚠️ Not available in Sri Lanka:</b> ${esc(data.reason || "This model is not road-legal or actively imported into Sri Lanka.")}<br><small style="margin-top:4px;display:block"><b>Popular Sri Lankan alternatives:</b> ${esc(Array.isArray(data.alternatives) ? data.alternatives.join(", ") : data.alternatives || "Toyota Corolla Cross, Honda Vezel, BYD Sealion")}</small>`;
    $("aiResultForm").hidden = true;
    $("aiDiscoveryBox").hidden = true;
    return;
  }

  // 3. Single vehicle result form
  $("aiUnavailBox").hidden = true;
  $("aiDiscoveryBox").hidden = true;
  $("aiResultForm").hidden = false;

  $("aiAvailNotes").textContent = data.availability_notes || "Actively traded in Sri Lanka";
  const isOfficial = (data.import_route || "").toLowerCase().includes("official");
  $("aiRouteBadge").textContent = data.import_route || "Available in SL";
  $("aiRouteBadge").className = `callout-badge ${isOfficial ? "badge-official" : "badge-grey"}`;

  const years = data.model_years || [];
  if (!years.length) {
    $("aiYearSelect").innerHTML = '<option value="2024">2024</option>';
  } else {
    $("aiYearSelect").innerHTML = years.map(y => {
      const yVal = typeof y === "object" ? y.year : y;
      return `<option value="${yVal}">${yVal}</option>`;
    }).join("");
  }

  updateAllTrimsYearLabel();
  updateTrimDropdown();

  // Zero-touch image fetcher
  const modelName = data.model_name || $("aiSearchQuery").value.trim();
  const wikiSlug = data.wikipedia_slug || data.wikipedia_Slug || "";
  setAiImgPreview("");
  $("aiImgUrl").value = "";
  try {
    const fetchedImg = await fetchVehicleStudioImage(modelName, wikiSlug);
    if (fetchedImg) {
      normalizeImageToStudio(fetchedImg, procImg => {
        setAiImgPreview(procImg || fetchedImg);
        $("aiImgUrl").value = procImg || fetchedImg;
      });
    }
  } catch (e) {
    console.warn("Studio photo resolution error:", e);
  }
}

function updateAllTrimsYearLabel() {
  const yr = $("aiYearSelect").value;
  const label = $("aiTrimsYearLabel");
  if (label) label.textContent = yr;
}

function getSelectedYearData() {
  if (!currentAiData) return null;
  const yrVal = String($("aiYearSelect").value);
  const years = currentAiData.model_years || [];
  return years.find(y => String(typeof y === "object" ? y.year : y) === yrVal) || years[0] || null;
}

function updateTrimDropdown() {
  updateAllTrimsYearLabel();
  const yData = getSelectedYearData();
  const trims = yData?.trims || [];
  if (!trims.length) {
    $("aiTrimSelect").innerHTML = '<option value="0">Standard Trim</option>';
  } else {
    $("aiTrimSelect").innerHTML = trims.map((t, i) => `<option value="${i}">${esc(t.trim_name || "Trim " + (i + 1))}</option>`).join("");
  }
  updateConditionAndSpecs();
}

function getSelectedTrimData() {
  const yData = getSelectedYearData();
  const trims = yData?.trims || [];
  const idx = +$("aiTrimSelect").value || 0;
  return trims[idx] || trims[0] || {};
}

function updateConditionAndSpecs() {
  const tData = getSelectedTrimData();
  $("aiKmInput").value = tData.fuel_economy_kml || "";
  $("aiWarrSelect").value = tData.warranty_type === "Official" ? "Official" : "Grey";

  const condPrices = tData.condition_prices || {};
  const baseP = condPrices.brand_new || 0;
  const recondP = condPrices.recond || Math.round(baseP * 0.88);
  const usedLowP = condPrices.used_low || Math.round(baseP * 0.75);
  const usedMedP = condPrices.used_med || Math.round(baseP * 0.65);

  const options = [];

  // If seller price was extracted from classified ad / auction sheet
  const sellerP = currentAiData?.seller_price_lkr || 0;
  if (sellerP > 0) {
    const detCond = currentAiData?.detected_condition || "Used";
    options.push({
      id: "seller_price",
      name: `Listed / Seller Asking Price (from Ad)`,
      price: sellerP,
      c: detCond,
      selected: true
    });
  }

  options.push(
    { id: "brand_new", name: "Brand New (Unregistered) - 0 km", price: baseP, c: "New" },
    { id: "recond", name: "Reconditioned (Grade 4.5+) - Under 25k km", price: recondP, c: "Recond" },
    { id: "used_low", name: "Registered Used (< 50,000 km)", price: usedLowP, c: "Used" },
    { id: "used_med", name: "Registered Used (50,000 - 100,000 km)", price: usedMedP, c: "Used" }
  );

  $("aiCondSelect").innerHTML = options.map(o => `<option value="${o.id}" data-p="${o.price}" data-c="${o.c}" ${o.selected ? "selected" : ""}>${o.name} - Rs. ${fmt(o.price)}</option>`).join("");
  updateSelectedPrice();
}

function updateSelectedPrice() {
  const selOpt = $("aiCondSelect").selectedOptions[0];
  const p = +selOpt?.dataset.p || 0;
  $("aiPriceInput").value = p;
}

$("aiYearSelect").addEventListener("change", updateTrimDropdown);
$("aiTrimSelect").addEventListener("change", updateConditionAndSpecs);
$("aiCondSelect").addEventListener("change", updateSelectedPrice);
$("aiResetPriceBtn").addEventListener("click", updateSelectedPrice);

function setAiImgPreview(src) {
  currentAiImgSrc = (src && src.trim() && src !== window.location.href) ? src.trim() : "";
  const preview = $("aiImgPreview");
  const previewBox = preview.closest(".preview-box");
  let existingPh = previewBox.querySelector(".pimg-ph");

  if (!currentAiImgSrc) {
    preview.src = "";
    preview.style.display = "none";
    if (!existingPh) {
      existingPh = document.createElement("div");
      existingPh.className = "ph pimg-ph";
      existingPh.style.cssText = "width:140px;height:88px;border-radius:6px;border:1px solid var(--line);background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--mute);font-size:0.75rem;gap:4px";
      existingPh.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.55"><rect width="18" height="18" x="3" y="3" rx="3"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M14 21v-4a2 2 0 0 0-4 0v4"/></svg><span>No photo</span>`;
      preview.parentNode.insertBefore(existingPh, preview);
    }
    existingPh.style.display = "flex";
  } else {
    if (existingPh) existingPh.style.display = "none";
    preview.style.display = "block";
    preview.src = currentAiImgSrc;
  }
}

$("aiImgPreview").addEventListener("error", () => {
  setAiImgPreview("");
});

$("aiImgUrl").addEventListener("input", e => {
  setAiImgPreview(e.target.value);
});

$("aiImgFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    setAiImgPreview(evt.target.result);
    $("aiImgUrl").value = "";
  };
  reader.readAsDataURL(file);
});

$("aiConfirmAddBtn").addEventListener("click", () => {
  const tData = getSelectedTrimData();
  const yr = $("aiYearSelect").value;
  const trimName = tData.trim_name || "";
  const modelName = currentAiData.model_name || $("aiSearchQuery").value.trim();
  const fullName = formatVehicleTitle(modelName, trimName, yr);
  const price = parseFloat($("aiPriceInput").value);
  if (!(price > 0)) { alert("Please enter a valid price in LKR."); return; }
  const condOpt = $("aiCondSelect").selectedOptions[0];
  const cond = condOpt?.dataset.c || "New";
  const w = $("aiWarrSelect").value;
  const km = $("aiKmInput").value.trim();
  const pt = tData.powertrain || "";

  normalizeImageToStudio(currentAiImgSrc, procImg => {
    cars.push({
      name: fullName,
      pt: pt,
      km: km,
      w: w,
      price: price,
      cond: cond,
      img: procImg,
      custom: true
    });
    saveCars(cars);
    render();
    $("aiModal").classList.remove("open");
  });
});

$("aiAddAllTrimsBtn").addEventListener("click", () => {
  const yData = getSelectedYearData();
  const yr = $("aiYearSelect").value;
  const modelName = currentAiData?.model_name || $("aiSearchQuery").value.trim();
  const trims = yData?.trims || [];
  if (!trims.length) {
    $("aiConfirmAddBtn").click();
    return;
  }

  const condOpt = $("aiCondSelect").selectedOptions[0];
  const condId = $("aiCondSelect").value;
  const cond = condOpt?.dataset.c || "New";

  normalizeImageToStudio(currentAiImgSrc, procImg => {
    trims.forEach(t => {
      const fullName = formatVehicleTitle(modelName, t.trim_name, yr);
      const condPrices = t.condition_prices || {};
      let p = 0;
      if (condId === "seller_price") {
        p = currentAiData?.seller_price_lkr || condPrices.brand_new || 0;
      } else {
        p = condPrices[condId] || condPrices.brand_new || 0;
      }
      cars.push({
        name: fullName,
        pt: t.powertrain || "",
        km: t.fuel_economy_kml || "",
        w: t.warranty_type || "Grey",
        price: p,
        cond: cond,
        img: procImg,
        custom: true
      });
    });
    saveCars(cars);
    render();
    $("aiModal").classList.remove("open");
  });
});

// Multi-vehicle Discovery Checklist Implementation
function renderDiscoveryChecklist(vehicles) {
  currentDiscoveredVehicles = vehicles;
  $("aiUnavailBox").hidden = true;
  $("aiResultForm").hidden = true;
  $("aiDiscoveryBox").hidden = false;
  $("aiDiscoveryTitle").textContent = `Discovered ${vehicles.length} Vehicles Matching Your Query`;

  const listContainer = $("aiDiscoveryList");
  listContainer.innerHTML = vehicles.map((v, i) => {
    const title = formatVehicleTitle(v.model_name, v.trim_name, v.year);
    const condLabel = v.condition === "Used" ? "Registered Used" : v.condition === "Recond" ? "Reconditioned" : "Brand New";
    return `<label class="discovery-item selected" data-i="${i}">
      <input type="checkbox" class="disc-check" data-idx="${i}" checked style="width:auto">
      <img class="discovery-thumb" id="discThumb${i}" src="" alt="${esc(title)}">
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
          <b>${esc(title)}</b>
          <b style="color:var(--accent);font-variant-numeric:tabular-nums">Rs. ${fmt(v.price_lkr)}</b>
        </div>
        <div style="font-size:0.78rem;color:var(--mute)">${esc(v.powertrain || "")}${v.fuel_economy_kml ? " · " + esc(v.fuel_economy_kml) : ""}</div>
        <div style="margin-top:2px">
          <span class="callout-badge ${v.warranty_type === "Official" ? "badge-official" : "badge-grey"}" style="font-size:0.68rem">${v.warranty_type || "Grey"}</span>
          <span class="cond-tag" style="font-size:0.68rem">${condLabel}</span>
        </div>
      </div>
    </label>`;
  }).join("");

  updateSelectedCount();

  // Async load thumbnails
  vehicles.forEach(async (v, i) => {
    try {
      const imgUrl = await fetchVehicleStudioImage(v.model_name, v.wikipedia_slug);
      const imgEl = $(`discThumb${i}`);
      if (imgEl && imgUrl) {
        normalizeImageToStudio(imgUrl, normalized => {
          if (imgEl) imgEl.src = normalized || imgUrl;
        });
      }
    } catch (e) {}
  });
}

function updateSelectedCount() {
  const checked = document.querySelectorAll(".disc-check:checked").length;
  $("aiAddSelectedBtn").textContent = `Add selected (${checked}) to comparison`;
}

$("aiDiscoveryList").addEventListener("change", e => {
  if (e.target.classList.contains("disc-check")) {
    const item = e.target.closest(".discovery-item");
    if (item) item.classList.toggle("selected", e.target.checked);
    updateSelectedCount();
  }
});

$("aiToggleSelectAllBtn").addEventListener("click", () => {
  const checks = document.querySelectorAll(".disc-check");
  const anyUnchecked = [...checks].some(c => !c.checked);
  checks.forEach(c => {
    c.checked = anyUnchecked;
    c.closest(".discovery-item")?.classList.toggle("selected", anyUnchecked);
  });
  updateSelectedCount();
});

$("aiDiscoveryBackBtn").addEventListener("click", () => {
  $("aiDiscoveryBox").hidden = true;
  $("aiResultForm").hidden = false;
});

$("aiAddSelectedBtn").addEventListener("click", () => {
  const checks = document.querySelectorAll(".disc-check:checked");
  if (!checks.length) {
    alert("Please select at least one vehicle to add.");
    return;
  }

  for (const c of checks) {
    const idx = +c.dataset.idx;
    const v = currentDiscoveredVehicles[idx];
    if (!v) continue;
    const title = formatVehicleTitle(v.model_name, v.trim_name, v.year);
    const thumbEl = $(`discThumb${idx}`);
    const rawImg = thumbEl?.getAttribute("src") || "";

    cars.push({
      name: title,
      pt: v.powertrain || "",
      km: v.fuel_economy_kml || "",
      w: v.warranty_type || "Grey",
      price: v.price_lkr,
      cond: v.condition || "New",
      img: rawImg,
      custom: true
    });
  }

  saveCars(cars);
  render();
  $("aiModal").classList.remove("open");
});

// Quick Manual Entry Add Button
$("mAddBtn").addEventListener("click", () => {
  const name = $("mName").value.trim();
  const price = parseFloat($("mPrice").value);
  if (!name) { $("mErr").textContent = "Enter a vehicle name."; return; }
  if (!(price > 0)) { $("mErr").textContent = "Enter a price greater than zero."; return; }
  $("mErr").textContent = "";
  const cond = $("mCond").value;
  const w = $("mWarr").value;
  const pt = $("mPt").value.trim() || "Custom entry";
  const rawImg = $("mImgUrl").value.trim();

  normalizeImageToStudio(rawImg, procImg => {
    cars.push({
      name: name,
      pt: pt,
      km: "",
      w: w,
      price: price,
      cond: cond,
      img: procImg,
      custom: true
    });
    saveCars(cars);
    render();
    $("mName").value = ""; $("mPrice").value = ""; $("mImgUrl").value = "";
    $("aiModal").classList.remove("open");
  });
});

// Theme Switcher (☀️ / 🌙)
function applyTheme(theme) {
  if (typeof document !== "undefined" && document.documentElement && typeof document.documentElement.setAttribute === "function") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  const btn = $("themeToggleBtn");
  if (btn) {
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.title = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
    if (typeof btn.setAttribute === "function") {
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
  }
}

function initTheme() {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem("vahanaiq_theme") : null;
  const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

const themeBtn = $("themeToggleBtn");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const cur = (typeof document !== "undefined" && document.documentElement && typeof document.documentElement.getAttribute === "function" && document.documentElement.getAttribute("data-theme")) || 
      (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("vahanaiq_theme", next);
    }
    applyTheme(next);
  });
}

initTheme();

// Initialise magic link and initial render
initMagicLink();
render();