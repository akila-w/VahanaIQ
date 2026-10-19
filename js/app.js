import { fmt, esc, num, computeLeaseTable } from "./calculator.js";
import { baseVehicles } from "./catalog.js";
import { normalizeImageToStudio } from "./canvas-utils.js";
import { discoverActiveModel, searchVehicleWithGemini } from "./gemini.js";
import { getApiKey, setApiKey, removeApiKey, initMagicLink, loadSavedCars, saveCars } from "./storage.js";

const $ = id => document.getElementById(id);

let cars = loadSavedCars(baseVehicles);
let sortKey = "price", sortDir = -1;
let currentAiData = null;

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
    const maxLoan = room / f;
    const maxPrice = maxLoan / (1 - s.down / 100);
    sum += `<div class="stat"><b>Rs. ${fmt(room)}</b><span>Highest monthly rental at a ${Math.round(s.dti * 100)}% limit${s.debt ? " after existing payments" : ""}</span></div>`;
    sum += `<div class="stat"><b>Rs. ${fmt(maxPrice)}</b><span>Highest vehicle price you can finance with ${s.down}% down</span></div>`;
    sum += `<div class="stat"><b>Rs. ${fmt(maxPrice * s.down / 100)}</b><span>Cash needed up front for that vehicle</span></div>`;
  } else {
    sum += `<div class="stat"><b>Rs. ${fmt(1e6 * f * (1 - s.down / 100))}</b><span>Monthly rental for every Rs. 1 million of vehicle price</span></div>`;
    sum += `<div class="stat"><b>Rs. ${fmt(1e6 * f * (1 - s.down / 100) / s.dti)}</b><span>Net income needed per Rs. 1 million of price at a ${Math.round(s.dti * 100)}% limit</span></div>`;
    sum += `<div class="stat"><span>Enter your net monthly income above to see which vehicles fit and the highest price you can finance.</span></div>`;
  }
  $("summary").innerHTML = sum;

  // Filters
  const maxP = num("maxprice") > 0 ? num("maxprice") * 1e6 : Infinity;
  const wFilter = $("warr").value;
  const cFilter = $("condFilter").value;
  let list = rows.filter(r => {
    if (r.price > maxP) return false;
    if (wFilter === "official" && r.w !== "Official") return false;
    if (wFilter === "grey" && r.w !== "Grey") return false;
    if (cFilter !== "all" && (r.cond || "New") !== cFilter) return false;
    if ($("afford").value === "ok" && r.status !== "ok" && r.status !== "mid") return false;
    return true;
  });

  const key = sortKey === "bar" ? "rental" : sortKey;
  list.sort((a, b) => {
    const x = a[key], y = b[key];
    if (typeof x === "string") return sortDir * x.localeCompare(y);
    return sortDir * (x - y);
  });

  // Table Header
  $("head").innerHTML = cols.map(c => {
    const sortable = c[0] !== "status";
    const k = c[0] === "bar" ? "rental" : c[0];
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
    const idx = cars.indexOf(r);
    const condLabel = r.cond === "Used" ? "Registered Used" : r.cond === "Recond" ? "Reconditioned" : "Brand New";
    return `<tr>
<td class="name"><div class="car">${r.img ? `<img src="${r.img}" alt="${esc(r.name)}" loading="lazy">` : '<div class="ph">No photo</div>'}<div><b>${esc(r.name)}</b><small>${esc(r.pt || "")}${r.km ? " · " + esc(r.km) : ""}</small><div class="warr">${r.w === "Official" ? "Official warranty" : "Grey market"}<span class="cond-tag">${condLabel}</span>${r.custom ? ` · <button class="link" type="button" data-del="${idx}" aria-label="Remove ${esc(r.name)}">remove</button>` : ""}</div></div></div></td>
<td class="n" data-label="Price (Rs.)">${fmt(r.price)}</td>
<td class="n" data-label="Monthly rental (Rs.)"><b>${fmt(r.rental)}</b></td>
<td data-label="Share of your budget"><div class="track" role="img" aria-label="Rental is ${Math.round(w)}% of the scale"><span class="fill" style="width:${w}%;background:${fillCol}"></span>${mk}</div></td>
<td class="n" data-label="Total interest (Rs.)">${fmt(r.interest)}</td>
<td class="n" data-label="Total outlay (Rs.)">${fmt(r.total)}</td>
<td class="n" data-label="Income needed (Rs.)">${fmt(r.need)}</td>
<td data-label="Status">${r.status === "na" ? '<span class="na">-</span>' : `<span class="tag ${r.status}">${labels[r.status]}</span>`}</td></tr>`;
  }).join("");
  $("empty").hidden = list.length > 0;
}

// Global Event Listeners
document.addEventListener("input", e => {
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

$("rows").addEventListener("click", e => {
  const b = e.target.closest("button[data-del]");
  if (!b) return;
  const idx = +b.dataset.del;
  if (cars[idx] && cars[idx].custom) {
    cars.splice(idx, 1);
    saveCars(cars);
    render();
  }
});

$("resetCatalogBtn").addEventListener("click", () => {
  if (confirm("Reset catalogue to default 12 vehicles? Custom vehicles will be removed.")) {
    cars = baseVehicles.slice();
    saveCars(cars);
    render();
  }
});

// API Settings UI
function updateKeyStatusUI() {
  const k = getApiKey();
  if (k) {
    $("apiKeyInput").value = k;
    $("keyStatus").innerHTML = `<span style="color:var(--ok)">✓ API Key saved locally (${k.slice(0, 6)}...${k.slice(-4)})</span>`;
  } else {
    $("apiKeyInput").value = "";
    $("keyStatus").textContent = "No key set. AI vehicle search requires a free key.";
  }
}

$("openSettingsBtn").addEventListener("click", () => {
  updateKeyStatusUI();
  $("settingsModal").classList.add("open");
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
  updateKeyStatusUI();
});

$("testKeyBtn").addEventListener("click", async () => {
  const val = $("apiKeyInput").value.trim();
  if (!val) { alert("Please enter an API key to test."); return; }
  $("keyStatus").innerHTML = '<span class="spin"></span>Detecting available models & testing connection...';
  try {
    const model = await discoverActiveModel(val);
    const cleanName = model.replace("models/", "");
    const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${val}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
    });
    if (testRes.ok) {
      $("keyStatus").innerHTML = `<span style="color:var(--ok);font-weight:600">✓ Connection successful! Active model: ${cleanName} (Free Tier)</span>`;
    } else {
      const err = await testRes.json().catch(() => ({}));
      $("keyStatus").innerHTML = `<span style="color:var(--bad)">Connection failed on ${cleanName}: ${err.error?.message || "HTTP " + testRes.status}</span>`;
    }
  } catch (e) {
    $("keyStatus").innerHTML = `<span style="color:var(--bad)">Connection error: ${e.message}</span>`;
  }
});

// AI Search Modal UI
$("openAiModalBtn").addEventListener("click", () => {
  $("aiModal").classList.add("open");
  if (!getApiKey()) {
    $("aiSearchMsg").innerHTML = '<span style="color:var(--mid)">Tip: Configure your free Gemini key in settings (⚙️) for live Sri Lankan vehicle valuation and trims.</span>';
  } else {
    $("aiSearchMsg").textContent = "";
  }
});

$("closeAiModalBtn").addEventListener("click", () => { $("aiModal").classList.remove("open"); });
$("aiCancelBtn").addEventListener("click", () => { $("aiModal").classList.remove("open"); });
$("mCancelBtn").addEventListener("click", () => { $("aiModal").classList.remove("open"); });

$("tabAiBtn").addEventListener("click", () => {
  $("tabAiBtn").classList.add("active"); $("tabManualBtn").classList.remove("active");
  $("paneAi").hidden = false; $("paneManual").hidden = true;
});
$("tabManualBtn").addEventListener("click", () => {
  $("tabManualBtn").classList.add("active"); $("tabAiBtn").classList.remove("active");
  $("paneAi").hidden = true; $("paneManual").hidden = false;
});

// Search execution
$("aiSearchBtn").addEventListener("click", async () => {
  const query = $("aiSearchQuery").value.trim();
  if (!query) { $("aiSearchMsg").textContent = "Please enter a vehicle name to search."; return; }
  const key = getApiKey();
  if (!key) {
    $("aiModal").classList.remove("open");
    $("settingsModal").classList.add("open");
    alert("Please enter your free Google AI Studio API key first. (Zero cost, no credit card required).");
    return;
  }

  $("aiSearchMsg").innerHTML = '<span class="spin"></span>Analyzing Sri Lankan market availability, trims, and valuations...';
  $("aiUnavailBox").hidden = true;
  $("aiResultForm").hidden = true;

  try {
    const parsed = await searchVehicleWithGemini(query, key);
    currentAiData = parsed;
    renderAiResults(parsed);
  } catch (e) {
    $("aiSearchMsg").innerHTML = `<span style="color:var(--bad)">Search error: ${e.message}</span>`;
  }
});

function renderAiResults(data) {
  $("aiSearchMsg").textContent = "";
  if (!data.is_available_in_sri_lanka) {
    $("aiUnavailBox").hidden = false;
    $("aiUnavailBox").innerHTML = `<b>⚠️ Not available in Sri Lanka:</b> ${esc(data.reason || "This model is not road-legal or actively imported into Sri Lanka.")}<br><small style="margin-top:4px;display:block"><b>Popular Sri Lankan alternatives:</b> ${esc(Array.isArray(data.alternatives) ? data.alternatives.join(", ") : data.alternatives || "Toyota Corolla Cross, Honda Vezel, BYD Sealion")}</small>`;
    $("aiResultForm").hidden = true;
    return;
  }

  $("aiUnavailBox").hidden = true;
  $("aiResultForm").hidden = false;
  $("aiAvailNotes").textContent = data.availability_notes || data.market_status || "Actively traded in Sri Lanka";
  $("aiRouteBadge").textContent = data.import_route || "Available in SL";

  const years = data.model_years || data.years || [];
  if (!years.length) {
    $("aiYearSelect").innerHTML = '<option value="2024">2024</option>';
  } else {
    $("aiYearSelect").innerHTML = years.map(y => {
      const yVal = typeof y === "object" ? y.year : y;
      return `<option value="${yVal}">${yVal}</option>`;
    }).join("");
  }

  updateTrimDropdown();
}

function getSelectedYearData() {
  if (!currentAiData) return null;
  const yr = +$("aiYearSelect").value;
  const years = currentAiData.model_years || currentAiData.years || [];
  return years.find(y => (typeof y === "object" ? y.year : y) === yr) || years[0] || null;
}

function updateTrimDropdown() {
  const yData = getSelectedYearData();
  const trims = yData?.trims || currentAiData?.trims || [];
  if (!trims.length) {
    $("aiTrimSelect").innerHTML = '<option value="Standard">Standard Trim</option>';
  } else {
    $("aiTrimSelect").innerHTML = trims.map((t, i) => `<option value="${i}">${esc(t.trim_name || t.name || "Trim " + (i + 1))}</option>`).join("");
  }
  updateConditionAndSpecs();
}

function getSelectedTrimData() {
  const yData = getSelectedYearData();
  const trims = yData?.trims || currentAiData?.trims || [];
  const idx = +$("aiTrimSelect").value || 0;
  return trims[idx] || trims[0] || {};
}

function updateConditionAndSpecs() {
  const tData = getSelectedTrimData();
  $("aiKmInput").value = tData.fuel_economy_kml || tData.fuel_economy || "";
  $("aiWarrSelect").value = tData.warranty_type === "Official" ? "Official" : "Grey";

  const condPrices = tData.condition_prices || tData.prices || {};
  const options = [
    { id: "brand_new", name: "Brand New (Unregistered) - 0 km", price: condPrices.brand_new || tData.price_lkr || tData.price || 0, c: "New" },
    { id: "recond", name: "Reconditioned (Grade 4.5+) - Under 25k km", price: condPrices.recond || Math.round((condPrices.brand_new || tData.price || 0) * 0.88), c: "Recond" },
    { id: "used_low", name: "Registered Used (< 50,000 km)", price: condPrices.used_low || Math.round((condPrices.brand_new || tData.price || 0) * 0.75), c: "Used" },
    { id: "used_med", name: "Registered Used (50,000 - 100,000 km)", price: condPrices.used_med || Math.round((condPrices.brand_new || tData.price || 0) * 0.65), c: "Used" }
  ];

  $("aiCondSelect").innerHTML = options.map(o => `<option value="${o.id}" data-p="${o.price}" data-c="${o.c}">${o.name} - Rs. ${fmt(o.price)}</option>`).join("");
  updateSelectedPrice();

  const photoUrl = tData.studio_photo_url || currentAiData.studio_photo_url || "";
  $("aiImgUrl").value = photoUrl;
  $("aiImgPreview").src = photoUrl || "";
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

$("aiImgUrl").addEventListener("input", e => {
  $("aiImgPreview").src = e.target.value;
});

$("aiImgFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    $("aiImgPreview").src = evt.target.result;
    $("aiImgUrl").value = "";
  };
  reader.readAsDataURL(file);
});

$("aiConfirmAddBtn").addEventListener("click", () => {
  const tData = getSelectedTrimData();
  const yr = $("aiYearSelect").value;
  const trimName = tData.trim_name || tData.name || "";
  const modelName = currentAiData.model_name || currentAiData.query_name || $("aiSearchQuery").value.trim();
  const fullName = `${modelName} ${trimName} (${yr})`.trim();
  const price = parseFloat($("aiPriceInput").value);
  if (!(price > 0)) { alert("Please enter a valid price in LKR."); return; }
  const condOpt = $("aiCondSelect").selectedOptions[0];
  const cond = condOpt?.dataset.c || "New";
  const w = $("aiWarrSelect").value;
  const km = $("aiKmInput").value.trim();
  const pt = tData.powertrain || "";

  const rawImg = $("aiImgPreview").src || "";
  normalizeImageToStudio(rawImg, procImg => {
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

// Initialise magic link and initial render
initMagicLink();
render();