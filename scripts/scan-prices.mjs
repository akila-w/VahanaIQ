#!/usr/bin/env node
// Monthly price scan. Reads the few Sri Lankan sites that publish brand-new car prices,
// matches their listings to catalogue entries with the rules in scripts/price-matches.json,
// and writes a prices file for scripts/refresh-prices.mjs --from-file, plus a report for review.
// No AI and no npm dependencies (Node 20+).
//
// Sites, chosen because their robots.txt allows it and they publish prices (21/10/2026):
// - MG Sri Lanka (official): prices on the home page
// - GWM Sri Lanka (official): "Driveaway from" prices on each vehicle page
// - Cartivate Motors (grey importer): stock listings with price and mileage
// - importcar.lk (grey importer): a price list with each car's auction grade
// Left out: Nissan Sri Lanka (its robots.txt blocks nearly every bot but Google's),
// AutoXo (publishes no prices), and classified marketplaces (see README.md).
//
// Only brand-new cars are priced: 0 km on Cartivate, "brand new" grade or 0 km on importcar.lk.
// Auction-grade cars are reconditioned and are listed for review, never priced as new.
//
//   node scripts/scan-prices.mjs [--out <dir>] [--catalog <file>] [--month YYYY-MM] [--delay <ms>]
//
// Writes <dir>/prices.json, <dir>/report.md and <dir>/listings.json (default dir: price-scan).

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER_AGENT = "VahanaIQ price check (+https://akila-w.github.io/vahanaiq/)";
const REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_DELAY_MS = 1500;      // between requests to the same site
const MAX_LISTING_PAGES = 10;       // Cartivate stock pages
const NEW_MAX_KM = 100;             // delivery mileage still counts as brand new
const PRICE_SPREAD_WARN = 0.05;     // flag matches whose listings differ by more than 5%

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- Page text helpers

const decode = s => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export const textOf = html => decode(String(html)
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, " ")
  .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const lkr = s => Number(String(s).replace(/[^\d]/g, ""));

// --- Parsers: each takes a page's HTML and returns listings
// { title, price, condition: "New" | "Recond" | "Used" | null, year, mileageKm, url }

// MG home page: an <h5>Rs. 12.989</h5> price in millions, then "/Million", then the model's <h5> name
export function parseMg(html, pageUrl) {
  const listings = [];
  const re = /<h5[^>]*>\s*Rs\.\s*([\d.]+)\s*<\/h5>([\s\S]{0,4000}?)<h5[^>]*>([^<]{2,60})<\/h5>/gi;
  for (const m of html.matchAll(re)) {
    if (!/\/\s*Million/i.test(m[2])) continue;
    const price = Math.round(Number(m[1]) * 1e6);
    if (price > 0) listings.push({ title: decode(m[3]).trim(), price, condition: "New", year: null, mileageKm: null, url: pageUrl, evidence: `Rs. ${m[1]} /Million ${decode(m[3]).trim()}` });
  }
  return listings;
}

// GWM vehicle page: <title>Haval H6 GT</title> and a "DRIVEAWAY FROM" price bar
export function parseGwmVehicle(html, pageUrl) {
  const title = decode((/<h1[^>]*>([^<]+)<\/h1>/i.exec(html) || /<title>([^<]+)<\/title>/i.exec(html) || [])[1] || "").trim();
  const m = /DRIVEAWAY FROM\s*(?:<[^>]+>\s*)*LKR\s*([\d,]+)/i.exec(html);
  if (!title || !m) return [];
  return [{ title, price: lkr(m[1]), condition: "New", year: null, mileageKm: null, url: pageUrl, basis: "starting", evidence: `${title}: DRIVEAWAY FROM LKR ${m[1]}` }];
}

// GWM home page: links to each vehicle page
export const gwmVehicleLinks = (html, base) =>
  [...new Set([...html.matchAll(/href="((?:https:\/\/www\.gwmsrilanka\.lk)?\/vehicles\/[a-z0-9-]+)"/gi)].map(m => new URL(m[1], base).href))];

// Cartivate stock page: each card ends with <a title="…" href="…" class="btn-listing">;
// the text before it has the price, fuel type and mileage
export function parseCartivate(html) {
  const listings = [];
  const re = /<a\s+title="([^"]+)"\s+href="([^"]+)"\s+class="btn-listing"/gi;
  let from = 0;
  for (const m of html.matchAll(re)) {
    const card = textOf(html.slice(from, m.index));
    from = m.index + m[0].length;
    const price = [...card.matchAll(/LKR\s*([\d,]{7,})/g)].pop();
    const km = /Mileage\s*([\d,]+)\s*(?:km)?/i.exec(card.slice(price ? price.index : 0));
    if (!price) continue;
    const title = decode(m[1]).trim();
    const mileageKm = km ? lkr(km[1]) : null;
    const year = Number((/\b(19|20)\d{2}\b/.exec(title) || [])[0]) || null;
    listings.push({
      title, price: lkr(price[1]), year, mileageKm, url: m[2],
      condition: mileageKm === null ? null : mileageKm <= NEW_MAX_KM ? "New" : "Used",
      evidence: `${title} LKR ${price[1]}, mileage ${km ? km[1] : "not shown"}`
    });
  }
  return listings;
}

// Cartivate page links to the next stock pages
export const cartivatePageCount = html =>
  Math.max(1, ...[...html.matchAll(/\/listing\/page\/(\d+)\//g)].map(m => Number(m[1])));

// importcar.lk home page: each car is an <h2> name followed by "Price : 6.4M", "Model : …",
// "Auction grade : 4.5 or up" (reconditioned) or "brand new", and sometimes "Milage : 0Km", "Year : 2025"
export function parseImportcar(html, pageUrl) {
  const listings = [];
  const updated = /Updated on\s*([^)<]+)\)/i.exec(textOf(html));
  const heads = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)];
  heads.forEach((h, i) => {
    const block = html.slice(h.index + h[0].length, i + 1 < heads.length ? heads[i + 1].index : undefined);
    const fields = {};
    for (const f of block.matchAll(/class="elementor-icon-list-text">\s*([^<:]+?)\s*:\s*([^<]*)</gi)) fields[f[1].trim().toLowerCase()] = decode(f[2]).trim();
    const priceM = /^([\d.]+)\s*M$/i.exec(fields.price || "");
    if (!priceM) return;
    const grade = (fields["auction grade"] || "").toLowerCase();
    const mileage = /^([\d,]+)\s*km$/i.exec(fields.milage || fields.mileage || "");
    const mileageKm = mileage ? lkr(mileage[1]) : null;
    const condition = grade.includes("brand new") || (mileageKm !== null && mileageKm <= NEW_MAX_KM) ? "New"
      : grade ? "Recond" : null;
    const title = decode(h[1]).replace(/\s*-\s*/g, " ").replace(/\s+/g, " ").trim();
    listings.push({
      title, price: Math.round(Number(priceM[1]) * 1e6), condition, mileageKm, url: pageUrl,
      year: Number(fields.year) || null, model: fields.model || null, grade: fields["auction grade"] || null,
      evidence: `${decode(h[1]).trim()} Price : ${fields.price}${fields.model ? `, Model : ${fields.model}` : ""}${grade ? `, Auction grade : ${fields["auction grade"]}` : ""}${mileage ? `, Milage : ${fields.milage}` : ""}` +
        (updated ? ` (price list updated on ${updated[1].trim()})` : "")
    });
  });
  return listings;
}

// --- Sources: how to fetch each site, with its basis for refresh-prices.mjs

export const SOURCES = {
  mg: { name: "MG Sri Lanka", route: "official", basis: "dealer price list" },
  gwm: { name: "GWM Sri Lanka", route: "official", basis: "dealer price list" },
  cartivate: { name: "Cartivate Motors", route: "grey", basis: "dealer listing" },
  importcar: { name: "importcar.lk", route: "grey", basis: "dealer price list" }
};

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: "follow" });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

async function scanSource(key, delay) {
  const listings = [];
  const add = items => listings.push(...items.map(l => ({ ...l, source: key })));
  if (key === "mg") {
    add(parseMg(await get("https://mgsrilanka.lk/"), "https://mgsrilanka.lk/"));
  } else if (key === "gwm") {
    const home = "https://www.gwmsrilanka.lk/";
    for (const url of gwmVehicleLinks(await get(home), home)) {
      await sleep(delay);
      add(parseGwmVehicle(await get(url), url));
    }
  } else if (key === "cartivate") {
    const first = await get("https://cartivatemotors.lk/listing/");
    add(parseCartivate(first));
    const pages = Math.min(cartivatePageCount(first), MAX_LISTING_PAGES);
    for (let p = 2; p <= pages; p++) {
      await sleep(delay);
      add(parseCartivate(await get(`https://cartivatemotors.lk/listing/page/${p}/`)));
    }
  } else if (key === "importcar") {
    add(parseImportcar(await get("https://importcar.lk/"), "https://importcar.lk/"));
  }
  // A listing shown on several pages (featured cars) counts once
  const seen = new Set();
  return listings.filter(l => { const k = `${l.url}|${l.title}|${l.price}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// --- Matching listings to catalogue entries

// Rules: [{ id, source, title: "regex", exclude?: "regex", condition?: "New" }]
export function matchListings(rules, listings, catalogue) {
  const byId = new Map(catalogue.map(v => [v.id, v]));
  const used = new Set();
  const matches = [];
  for (const rule of rules) {
    const vehicle = byId.get(rule.id);
    if (!vehicle) { matches.push({ rule, vehicle: null, found: [], problem: `no catalogue entry with ID ${rule.id}` }); continue; }
    const want = new RegExp(rule.title, "i");
    const skip = rule.exclude ? new RegExp(rule.exclude, "i") : null;
    const condition = rule.condition || "New";
    const found = listings.filter(l => l.source === rule.source && l.condition === condition && want.test(l.title) && !(skip && skip.test(l.title)))
      .sort((a, b) => a.price - b.price);
    found.forEach(l => used.add(l));
    matches.push({ rule, vehicle, found });
  }
  return { matches, unmatched: listings.filter(l => !used.has(l)) };
}

// The prices file refresh-prices.mjs reads: one price per matched, already-priced entry (the
// lowest listing), named like the catalogue entry so its trim matching accepts it. First prices
// stay in the report for review, since refresh-prices.mjs never sets them.
export function buildPricesFile(matches, date) {
  const month = date.slice(0, 7);
  return {
    researched_by: "scripts/scan-prices.mjs",
    researched_on: date,
    vehicles: matches.filter(m => m.vehicle?.price && m.found.length).map(({ vehicle, found, rule }) => {
      const best = found[0];
      const source = SOURCES[rule.source];
      return {
        id: vehicle.id,
        name: vehicle.name,
        model_name: vehicle.make,
        prices: [{
          trim_name: vehicle.name.replace(new RegExp(`^${vehicle.make}\\s+`, "i"), ""),
          model_year: best.year || vehicle.year || null,
          brand_new_price_lkr: best.price,
          price_basis: source.basis,
          as_of: month,
          source_title: `${source.name}: ${best.title}`,
          source_url: best.url,
          evidence: best.evidence
        }]
      };
    })
  };
}

const fmt = n => "LKR " + n.toLocaleString("en-GB");
const pct = (a, b) => { const x = (b - a) / a; return (x > 0 ? "+" : x < 0 ? "−" : "±") + Math.abs(x * 100).toFixed(1) + "%"; };
const cell = s => String(s ?? "").replace(/\|/g, "\\|");
const link = l => `[${cell(l.title)}](${l.url})`;

export function renderScanReport({ date, matches, unmatched, catalogue, errors, rules }) {
  const lines = [`## Price scan, ${date.split("-").reverse().join("/")}`, ""];
  const changes = matches.filter(m => m.vehicle?.price && m.found.length);
  const firsts = matches.filter(m => m.vehicle && !m.vehicle.price && m.found.length);
  const missing = matches.filter(m => m.vehicle?.price && !m.found.length);
  const covered = new Set(rules.map(r => r.id));
  const manual = catalogue.filter(v => v.price && !covered.has(v.id));

  lines.push("### Priced entries", "");
  if (changes.length) {
    lines.push("| Entry | Catalogue | Found | Change | Listing |", "|---|---|---|---|---|");
    for (const { vehicle, found } of changes) {
      const spread = found.length > 1 && (found[found.length - 1].price - found[0].price) / found[0].price > PRICE_SPREAD_WARN
        ? ` (${found.length} listings, up to ${fmt(found[found.length - 1].price)})` : found.length > 1 ? ` (${found.length} listings)` : "";
      lines.push(`| ${cell(vehicle.name)} | ${fmt(vehicle.price)} | ${fmt(found[0].price)}${spread} | ${vehicle.price === found[0].price ? "no change" : pct(vehicle.price, found[0].price)} | ${link(found[0])} |`);
    }
  } else lines.push("No priced entry was found on the scanned sites.");
  lines.push("");

  if (missing.length) {
    lines.push("### Priced entries not listed this month", "", "Their prices are left as they are. A grey importer may have sold the car.", "");
    for (const { vehicle, rule } of missing) lines.push(`- ${vehicle.name} (${SOURCES[rule.source].name})`);
    lines.push("");
  }

  if (firsts.length) {
    lines.push("### First prices to review", "", "These entries have no price yet, so nothing was applied. Check the listing and add the price by hand if it fits the entry.", "");
    lines.push("| Entry | Found | Listing |", "|---|---|---|");
    for (const { vehicle, found } of firsts) lines.push(`| ${cell(vehicle.name)} | ${fmt(found[0].price)} | ${link(found[0])} |`);
    lines.push("");
  }

  const fresh = unmatched.filter(l => l.condition === "New");
  if (fresh.length) {
    lines.push("### Brand-new listings with no catalogue entry", "", "Candidates for new entries.", "");
    lines.push("| Source | Listing | Price |", "|---|---|---|");
    for (const l of fresh.sort((a, b) => a.source.localeCompare(b.source) || a.title.localeCompare(b.title))) lines.push(`| ${SOURCES[l.source].name} | ${link(l)} | ${fmt(l.price)} |`);
    lines.push("");
  }

  const recond = unmatched.filter(l => l.condition === "Recond");
  if (recond.length) lines.push(`${recond.length} reconditioned (auction-grade) listings were skipped; they are in listings.json.`, "");
  if (manual.length) lines.push(`Not scanned, check by hand: ${manual.map(v => v.name).join(", ")}.`, "");
  if (errors.length) lines.push("### Sites that could not be read", "", ...errors.map(e => `- ${e}`), "");
  return lines.join("\n");
}

async function importCatalog(file) {
  return (await import(pathToFileURL(file).href + `?t=${Date.now()}`)).baseVehicles;
}

export async function main(argv = process.argv.slice(2)) {
  const { values: opts } = parseArgs({
    args: argv,
    options: {
      out: { type: "string", default: path.join(ROOT, "price-scan") },
      catalog: { type: "string", default: path.join(ROOT, "js/market-catalogue.js") },
      rules: { type: "string", default: path.join(ROOT, "scripts/price-matches.json") },
      month: { type: "string" },
      delay: { type: "string", default: String(DEFAULT_DELAY_MS) }
    }
  });
  const today = new Date().toISOString().slice(0, 10);
  const date = opts.month ? `${opts.month}-01` : today;
  const catalogue = await importCatalog(path.resolve(opts.catalog));
  const rules = JSON.parse(fs.readFileSync(opts.rules, "utf8"));
  const delay = Number(opts.delay) || 0;

  const listings = [];
  const errors = [];
  for (const key of Object.keys(SOURCES)) {
    try {
      const found = await scanSource(key, delay);
      console.log(`${SOURCES[key].name}: ${found.length} listings (${found.filter(l => l.condition === "New").length} brand new)`);
      if (!found.length) errors.push(`${SOURCES[key].name}: no prices found; the page layout may have changed`);
      listings.push(...found);
    } catch (e) {
      errors.push(`${SOURCES[key].name}: ${e.message}`);
      console.warn(`! ${SOURCES[key].name}: ${e.message}`);
    }
    await sleep(delay);
  }

  const { matches, unmatched } = matchListings(rules, listings, catalogue);
  for (const m of matches.filter(m => m.problem)) errors.push(m.problem);
  const out = path.resolve(opts.out);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "listings.json"), JSON.stringify(listings, null, 2) + "\n");
  fs.writeFileSync(path.join(out, "prices.json"), JSON.stringify(buildPricesFile(matches, date), null, 2) + "\n");
  fs.writeFileSync(path.join(out, "report.md"), renderScanReport({ date, matches, unmatched, catalogue, errors, rules }) + "\n");
  console.log(`Wrote ${path.relative(ROOT, out) || out}/prices.json, report.md and listings.json`);
  return errors.length && !listings.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => process.exit(code), e => { console.error(e); process.exit(1); });
}
