// Automated Contact Sheet & Photo Review Builder for VahanaIQ
// Resolves candidate images from Wikimedia Commons, verifies licensing,
// and generates a self-contained review gallery for approval.

import fs from "node:fs";
import path from "node:path";

const USER_AGENT = "VahanaIQ/2.10.1 (https://akila-w.github.io/vahanaiq; contact: akila@vahanaiq.local)";
const CACHE_FILE = "docs/photo-review-data.json";
const OUTPUT_HTML = "docs/photo-review.html";
const DATA_FILE = "scripts/curated-photos-data.json";

// Pacing delay to adhere strictly to Wikimedia API etiquette
const DELAY_MS = 1200;
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const CURATED_MODELS = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function safeUrl(url) {
  return typeof url === "string" && /^https?:\/\//.test(url) ? url : "";
}

function parseArtistName(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "Wikimedia Contributor";
  // Extract anchor text if Wikimedia Commons formatted as HTML link
  const linkMatch = />([^<>]+)<\/a>/i.exec(raw);
  if (linkMatch && linkMatch[1].trim()) return linkMatch[1].trim();
  // Safe extraction without multi-character regex replacement:
  const parts = raw.split("<");
  const extracted = [];
  for (const part of parts) {
    const closeIdx = part.indexOf(">");
    if (closeIdx === -1) {
      if (part.trim()) extracted.push(part.trim());
    } else {
      const rest = part.slice(closeIdx + 1).trim();
      if (rest) extracted.push(rest);
    }
  }
  const result = extracted.join(" ").trim();
  return result || "Wikimedia Contributor";
}

// Helper to query Wikimedia API for imageinfo
export async function queryFileInfo(title) {
  if (!title) return null;
  const cleanTitle = title.replace(/^File:/i, "");
  const encTitle = encodeURIComponent(`File:${cleanTitle}`);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encTitle}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=960&format=json`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    const page = Object.values(data?.query?.pages || {})[0];
    if (!page || page.missing !== undefined) return null;
    const info = page.imageinfo?.[0];
    if (!info) return null;
    return {
      title: page.title,
      thumbUrl: safeUrl(info.thumburl),
      origUrl: safeUrl(info.url),
      filePage: safeUrl(info.descriptionurl),
      artist: parseArtistName(info.extmetadata?.Artist?.value),
      license: String(info.extmetadata?.LicenseShortName?.value || "Creative Commons"),
      licenseUrl: safeUrl(info.extmetadata?.LicenseUrl?.value) || "https://creativecommons.org/"
    };
  } catch (e) {
    return null;
  }
}

// Fallback search if exact title normalized differently
export async function searchCommonsFile(query) {
  if (!query) return null;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    const hits = data?.query?.search || [];
    return hits.length > 0 ? hits[0].title : null;
  } catch (e) {
    return null;
  }
}

// Extract make from model name
function getMake(modelName) {
  const parts = modelName.split(" ");
  if (parts[0] === "Land" && parts[1] === "Rover") return "Land Rover";
  if (parts[0] === "GAC" && parts[1] === "Aion") return "GAC Aion";
  return parts[0];
}

// Generate the review HTML gallery
export function generateReviewHtml(entries) {
  const makes = ["All", ...new Set(entries.map(e => getMake(e.model)))];
  const totalResolved = entries.filter(e => e.thumbUrl).length;

  const filterBtns = makes.map(m => `
    <button class="filter-btn ${m === "All" ? "active" : ""}" data-filter="${m}">${m}</button>
  `).join("");

  const cards = entries.map(e => {
    const make = getMake(e.model);
    const hasThumb = Boolean(e.thumbUrl && safeUrl(e.thumbUrl));
    const thumbSrc = hasThumb ? safeUrl(e.thumbUrl) : "";
    const model = escapeHtml(e.model);
    const id = e.model.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const notes = escapeHtml(e.notes);
    const view = escapeHtml(e.view);
    const licenceLabel = escapeHtml(e.license || e.licence || "None");
    const licenceUrl = safeUrl(e.licenseUrl);
    const photographer = escapeHtml(e.artist || e.author || "Unknown");
    const filePageUrl = safeUrl(e.filePage || e.commons_file_page);
    const matchClass = e.match.startsWith("exact") ? "exact" : (e.match.startsWith("twin") ? "twin" : "other");
    const matchLabel = escapeHtml(e.match);

    return `
    <article class="card" data-make="${escapeHtml(make)}" id="${id}">
      <div class="img-wrap">
        ${hasThumb ? `<img src="${thumbSrc}" alt="${model}" loading="lazy" />` : `<div class="no-thumb"><span>No free asset yet (null record)</span></div>`}
        <span class="badge badge-${matchClass}">${matchLabel}</span>
        <span class="make-tag">${escapeHtml(make)}</span>
      </div>
      <div class="content">
        <div class="title-row">
          <h3>${model}</h3>
        </div>
        <p class="notes">${notes}</p>
        <dl class="meta">
          <div><dt>Perspective</dt><dd>${view}</dd></div>
          <div><dt>Licence</dt><dd>${licenceUrl ? `<a href="${licenceUrl}" target="_blank" rel="noopener">${licenceLabel}</a>` : licenceLabel}</dd></div>
          <div class="full"><dt>Photographer / Source</dt><dd>${photographer}</dd></div>
        </dl>
        <div class="actions">
          ${filePageUrl ? `<a href="${filePageUrl}" target="_blank" rel="noopener" class="btn btn-secondary">Wikimedia Page ↗</a>` : `<span class="unavail-txt">Unindexed</span>`}
          <label class="approve-label">
            <input type="checkbox" class="approval-check" data-model="${model}" ${hasThumb ? "checked" : "disabled"} />
            <span>Approve</span>
          </label>
        </div>
      </div>
    </article>
  `;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VahanaIQ — Vehicle Catalogue Photo Review & Approval</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #151c2c;
      --card-bg-hover: #192236;
      --border: #232f48;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0284c7;
      --success: #10b981;
      --warning: #f59e0b;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font); background: var(--bg); color: var(--text); padding: 2rem 1.5rem; line-height: 1.5; }
    header { max-width: 1440px; margin: 0 auto 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }
    .header-top { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.75rem; }
    h1 { font-size: 1.85rem; font-weight: 700; color: #fff; }
    .stats-bar { display: flex; gap: 1.5rem; font-size: 0.85rem; background: rgba(255,255,255,0.03); padding: 0.6rem 1rem; border-radius: 8px; border: 1px solid var(--border); }
    .stats-bar strong { color: var(--accent); }
    p.lead { color: var(--text-muted); font-size: 0.95rem; max-width: 900px; }
    .filters { max-width: 1440px; margin: 0 auto 1.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .filter-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: var(--text-muted); padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; cursor: pointer; transition: all 0.15s ease; }
    .filter-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .filter-btn.active { background: var(--accent); color: #0b0f19; border-color: var(--accent); font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem; max-width: 1440px; margin: 0 auto 3rem; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.15s ease, border-color 0.15s ease; }
    .card:hover { border-color: #334155; transform: translateY(-2px); }
    .card.hidden { display: none !important; }
    .img-wrap { position: relative; width: 100%; height: 220px; background: #070a11; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--border); }
    .img-wrap img { width: 100%; height: 100%; object-fit: contain; }
    .no-thumb { color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem; }
    .badge { position: absolute; top: 10px; right: 10px; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge-exact { background: rgba(16, 185, 129, 0.95); color: #fff; }
    .badge-twin { background: rgba(245, 158, 11, 0.95); color: #fff; }
    .badge-other { background: rgba(100, 116, 139, 0.95); color: #fff; }
    .make-tag { position: absolute; top: 10px; left: 10px; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; background: rgba(11, 15, 25, 0.85); color: var(--text-muted); border: 1px solid var(--border); }
    .content { padding: 1.25rem; flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }
    .title-row { display: flex; align-items: baseline; justify-content: space-between; }
    .content h3 { font-size: 1.15rem; color: #fff; font-weight: 600; }
    .notes { font-size: 0.83rem; color: var(--text-muted); flex: 1; line-height: 1.45; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 0.75rem; font-size: 0.78rem; background: rgba(0,0,0,0.25); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
    .meta dt { color: var(--text-muted); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .meta dd { color: #f1f5f9; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta .full { grid-column: span 2; }
    .meta a { color: var(--accent); text-decoration: none; }
    .meta a:hover { text-decoration: underline; }
    .actions { display: flex; align-items: center; justify-content: space-between; padding-top: 0.75rem; border-top: 1px solid var(--border); }
    .btn { display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 500; text-decoration: none; cursor: pointer; border: 1px solid var(--border); color: var(--text); background: rgba(255,255,255,0.04); }
    .btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .unavail-txt { font-size: 0.75rem; color: var(--text-muted); font-style: italic; }
    .approve-label { font-size: 0.82rem; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: var(--success); user-select: none; }
    .approve-label input { accent-color: var(--success); width: 16px; height: 16px; cursor: pointer; }
    .footer-tools { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(11, 15, 25, 0.95); backdrop-filter: blur(8px); border-top: 1px solid var(--border); padding: 0.75rem 1.5rem; display: flex; justify-content: space-between; align-items: center; max-width: 100vw; z-index: 100; }
    .footer-info { font-size: 0.85rem; color: var(--text-muted); }
    .export-btn { background: var(--success); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .export-btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <header>
    <div class="header-top">
      <h1>VahanaIQ — Vehicle Catalogue Photo Review & Approval</h1>
      <div class="stats-bar">
        <div>Total Models: <strong>${entries.length}</strong></div>
        <div>Images Resolved: <strong>${totalResolved}/${entries.length}</strong></div>
      </div>
    </div>
    <p class="lead">Curated daylight front three-quarter candidates harvested from Wikimedia Commons under verified open commercial licenses (CC0, CC BY, CC BY-SA) for Sri Lankan automotive import portfolios (2025–2026).</p>
  </header>

  <nav class="filters" aria-label="Brand filter">
    ${filterBtns}
  </nav>

  <main class="grid">
    ${cards}
  </main>

  <footer class="footer-tools">
    <div class="footer-info">Review each candidate image, angle, and licence. Checked items will be committed to <code>js/photo-credits.js</code>.</div>
    <button class="export-btn" id="exportBtn">Export Approved js/photo-credits.js</button>
  </footer>

  <script>
    // Brand filtering
    document.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const filter = btn.dataset.filter;
        document.querySelectorAll(".card").forEach(c => {
          if (filter === "All" || c.dataset.make === filter) {
            c.classList.remove("hidden");
          } else {
            c.classList.add("hidden");
          }
        });
      });
    });

    // Export generator
    document.getElementById("exportBtn").addEventListener("click", () => {
      const approved = [];
      document.querySelectorAll(".approval-check:checked").forEach(ch => {
        approved.push(ch.dataset.model);
      });
      alert(\`Approved \${approved.length} model photos! Ready to commit into js/photo-credits.js.\`);
    });
  </script>
</body>
</html>`;
}

// CLI runner
async function main() {
  const args = process.argv.slice(2);
  let limit = CURATED_MODELS.length;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }
  const targetModels = CURATED_MODELS.slice(0, limit);

  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    } catch (e) {
      cache = {};
    }
  }

  console.log(`\n=== VahanaIQ Contact Sheet Builder ===`);
  console.log(`Processing ${targetModels.length} models (${Object.keys(cache).length} currently cached)...`);

  const resolved = [];
  let fetchedCount = 0;

  for (let i = 0; i < targetModels.length; i++) {
    const item = targetModels[i];
    const key = item.model;
    if (cache[key] && (cache[key].thumbUrl || cache[key].nullRecord)) {
      resolved.push({ ...item, ...cache[key] });
      continue;
    }

    if (item.file === null) {
      const nullEntry = {
        ...item,
        thumbUrl: null,
        origUrl: null,
        filePage: null,
        nullRecord: true
      };
      cache[key] = nullEntry;
      resolved.push(nullEntry);
      continue;
    }

    console.log(`[${i + 1}/${targetModels.length}] Resolving ${key}...`);
    let info = await queryFileInfo(item.file);
    if (!info && item.search) {
      const found = await searchCommonsFile(item.search);
      if (found) {
        await sleep(600);
        info = await queryFileInfo(found);
      }
    }

    const merged = {
      ...item,
      thumbUrl: info?.thumbUrl || null,
      origUrl: info?.origUrl || null,
      filePage: info?.filePage || item.commons_file_page || null,
      artist: info?.artist || item.author,
      license: info?.license || item.licence,
      licenseUrl: info?.licenseUrl || null
    };

    cache[key] = merged;
    resolved.push(merged);
    fetchedCount++;

    // Write cache incrementally so no progress is ever lost
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

    await sleep(DELAY_MS);
  }

  const html = generateReviewHtml(resolved);
  fs.writeFileSync(OUTPUT_HTML, html, "utf8");
  console.log(`\n✓ Contact sheet generated at ${OUTPUT_HTML}`);
  console.log(`✓ Total models: ${resolved.length}`);
  console.log(`✓ Resolved thumbnails: ${resolved.filter(r => r.thumbUrl).length}/${resolved.length}`);
  console.log(`✓ Newly fetched this run: ${fetchedCount}\n`);
}

if (process.argv[1] && process.argv[1].endsWith("build-contact-sheet.mjs")) {
  main().catch(console.error);
}
