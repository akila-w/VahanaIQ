#!/usr/bin/env node
// Monthly catalogue price refresh. Gets the brand-new price of each built-in vehicle,
// matches research by stable ID and updates prices and source/month evidence in
// js/market-catalogue.js. Answers that are missing, zero, not backed by
// a source page, marked as estimates, more than 6 months old or more than ±25% from the
// current price are skipped and listed.
// Prices come from one of two places:
// - --from-file <prices.json>: prices read from the sites by scripts/scan-prices.mjs (the
//   monthly route, run by .github/workflows/refresh-prices.yml), or researched by the Claude
//   scheduled task (scripts/price-research-task.md), each with the page it came from
// - otherwise the search proxy's price mode (a Google Search-grounded Gemini lookup). No free
//   Gemini model on the project can search Google any more, so this route currently fails.
// No npm dependencies (Node 20+).
// Eligible priced variants are asked about 4 at a time on the proxy's PRICE_MODEL,
// which the app does not use, and the run stops at once
// if Gemini's daily free limit is used up.
//
//   node scripts/refresh-prices.mjs [--dry-run] [--report <file>] [--from-file <prices.json>]
//                                   [--proxy <url>] [--catalog <file>] [--month YYYY-MM]
//                                   [--delay <ms>] [--batch <n>]
//
// --dry-run prints the diff and report without writing the catalogue.
// The proxy URL defaults to PROXY_URL, then config.proxyUrl in js/config.js.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MAX_CHANGE = 0.25;     // skip answers more than ±25% from the current price
const ROUND_TO = 10000;             // new prices are rounded to the nearest LKR 10,000
const MIN_TRIM_SCORE = 0.5;         // token overlap needed to accept a trim name match
const REQUEST_TIMEOUT_MS = 120000;
const BATCH_SIZE = 4;               // vehicles per proxy request
const MAX_ATTEMPTS = 3;             // per request
const MAX_RETRY_WAIT_MS = 90000;
const MAX_FAILED_IN_A_ROW = 2;      // stop asking once the proxy is clearly down
const MAX_SOURCE_AGE_MONTHS = 6;    // skip prices published longer ago than this
// Gearbox words in trim names. The catalogue names no gearbox, so when trims differ only
// by gearbox the automatic is priced (Akila's decision of 20/10/2026).
const AUTOMATIC = new Set(["at", "cvt", "ecvt", "amt", "dct", "ivt", "auto", "automatic"]);
const MANUAL = new Set(["mt", "manual"]);
// Words sources add that describe the listing, not the grade ("Top Variant – V Hybrid",
// "Tekna+ 1.0 Litre Turbo"), seen in the first research run on 20/10/2026
const FILLER = new Set(["top", "variant", "grade", "spec", "litre", "liter", "ltr"]);
const HYBRID_POWERTRAIN = /\b(hev|mhev|phev|hybrid)\b/i;

// Lower-case words; engine sizes lose their unit so "1.0L", "1.0" and "1.0 L" all read "1 0"
// Lower-case words; "+" reads as "plus" ("Tekna+"), and engine sizes lose their unit
const tokens = s => String(s ?? "").toLowerCase().replace(/\+/g, " plus ")
  .replace(/(\d)\s*(l|cc)\b/g, "$1").split(/[^a-z0-9]+/).filter(Boolean);
const oneLine = (s, max = 200) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
};
const cell = s => String(s ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const fmtLkr = n => "LKR " + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtPct = x => (x > 0 ? "+" : x < 0 ? "−" : "±") + Math.abs(x * 100).toFixed(1) + "%";

export function buildQuery(v) {
  const route = v.w === "Official" ? "from the official agent" : "grey import";
  return `${v.name}, ${v.pt}, brand new ${route}`;
}

// Price-mode answers ({ model_name, trims[], sources[] }) are reshaped like the app's
// search answers (model_years[].trims[].condition_prices.brand_new) so one matcher
// handles both. An answer from a proxy without price mode comes back with no sources.
export function normaliseAnswer(raw) {
  if (!raw || typeof raw !== "object") return raw;
  if (!Array.isArray(raw.trims)) return { ...raw, sources: raw.sources || [] };
  const years = new Map();
  for (const t of raw.trims) {
    const year = Number(t.model_year) || 0;
    if (!years.has(year)) years.set(year, { year, trims: [] });
    years.get(year).trims.push({
      trim_name: t.trim_name,
      condition_prices: { brand_new: t.brand_new_price_lkr },
      price_basis: t.price_basis,
      as_of: t.as_of,
      source_site: t.source_site
    });
  }
  return {
    is_available_in_sri_lanka: raw.available_new_in_sri_lanka,
    model_name: raw.model_name,
    model_years: [...years.values()],
    sources: Array.isArray(raw.sources) ? raw.sources.filter(s => s && /^https?:\/\//.test(s.uri)) : []
  };
}

// Picks the trim in the proxy answer whose name best matches the catalogue name.
// Make and model words are ignored, so "Toyota Corolla Cross Z (Adventure)" is matched
// on "z adventure". Every word of the trim name must appear in the catalogue name or
// its powertrain (so "e:HEV X" never matches "e:HEV Z", while "Alpha 1.0L Turbo MHEV"
// matches "Alpha (Turbo)" with powertrain "1.0L Turbo MHEV"), and the trim covering
// most of the catalogue name wins. Gearbox words are allowed, and the automatic wins a tie.
// Returns { year, trimName, price } or { reason } when nothing fits.
export function matchTrim(vehicle, raw) {
  const answer = normaliseAnswer(raw);
  if (!answer || typeof answer !== "object") return { reason: "no price given for this vehicle" };
  if (answer.is_available_in_sri_lanka === false) return { reason: "proxy says it is not available in Sri Lanka" };

  const ignore = new Set([...tokens(answer.model_name), tokens(vehicle.name)[0]]);
  const trimTokens = s => tokens(s).filter(t => !ignore.has(t));
  const want = new Set(trimTokens(vehicle.name).length ? trimTokens(vehicle.name) : tokens(vehicle.name));
  const powertrain = new Set(tokens(vehicle.pt));
  // "Hybrid" in a trim name only restates a hybrid powertrain, unless the catalogue name
  // itself says Hybrid (Raize Z Hybrid vs the petrol Raize Z), where it must match
  if (HYBRID_POWERTRAIN.test(vehicle.pt) && !want.has("hybrid")) powertrain.add("hybrid");
  // Words that only describe the powertrain ("turbo") never count towards a match
  const grade = [...want].filter(t => !powertrain.has(t));
  const scored = new Set(grade.length ? grade : want);

  const candidates = [];
  for (const my of answer.model_years || []) {
    for (const trim of my.trims || []) {
      const have = new Set(trimTokens(trim.trim_name));
      if ([...have].some(t => !want.has(t) && !powertrain.has(t) && !AUTOMATIC.has(t) && !MANUAL.has(t) && !FILLER.has(t))) continue;
      // A catalogue hybrid never takes the price of a non-hybrid trim (petrol Raize Z)
      if (want.has("hybrid") && !tokens(trim.trim_name).some(t => HYBRID_POWERTRAIN.test(t))) continue;
      const named = [...have].filter(t => scored.has(t));
      if (!named.length) continue;
      const score = named.length / scored.size;
      candidates.push({ year: Number(my.year) || 0, trim, score });
    }
  }
  const offered = (answer.model_years || []).flatMap(my => (my.trims || []).map(t => t.trim_name));
  if (!offered.length) return { reason: "no trims in the answer" };

  const best = Math.max(0, ...candidates.map(c => c.score));
  if (best < MIN_TRIM_SCORE) {
    return { reason: `no trim matching the catalogue name (answer had: ${oneLine([...new Set(offered)].slice(0, 5).join(", "))})` };
  }
  const top = candidates.filter(c => c.score === best);
  const year = Math.max(...top.map(c => c.year));
  let inYear = top.filter(c => c.year === year);
  const automatic = inYear.filter(c => tokens(c.trim.trim_name).some(t => AUTOMATIC.has(t)));
  if (automatic.length && automatic.length < inYear.length) inYear = automatic;
  if (new Set(inYear.map(c => c.trim.condition_prices?.brand_new)).size > 1) {
    return { reason: `ambiguous trim match: ${inYear.map(c => c.trim.trim_name).join(", ")}` };
  }
  const { trim } = inYear[0];
  return {
    year, trimName: trim.trim_name, price: trim.condition_prices?.brand_new,
    basis: trim.price_basis, asOf: trim.as_of, site: trim.source_site
  };
}

// The answer for the index-th vehicle (1-based) of a batched price-mode reply, carrying the
// reply's cited sources. null when Gemini left that vehicle out.
export function answerFor(reply, index) {
  if (!Array.isArray(reply?.vehicles)) return reply;
  const v = reply.vehicles.find(x => Number(x?.query_index) === index);
  return v ? { ...v, sources: v.sources || reply.sources || [] } : null;
}

// Reads a prices file from the research task and shapes it like one batched price-mode
// reply covering the whole catalogue, each vehicle carrying its own source pages:
// { researched_by, researched_on: "YYYY-MM-DD", vehicles: [{ name, model_name, prices: [
//   { trim_name, model_year, brand_new_price_lkr, price_basis, as_of, source_title, source_url }] }] }
export function readResearch(file, vehicles) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(data?.vehicles)) throw new Error(`${file}: expected a "vehicles" list`);
  const host = url => { try { return new URL(url).hostname; } catch { return ""; } };
  const replyVehicles = [];
  for (const entry of data.vehicles) {
    const index = vehicles.findIndex(v => entry?.id ? v.id === entry.id : v.name === entry?.name);
    if (index < 0) {
      console.warn(`! ${file}: "${entry?.name}" is not a catalogue vehicle name; ignored`);
      continue;
    }
    const prices = (Array.isArray(entry.prices) ? entry.prices : []).filter(p => p && typeof p === "object");
    replyVehicles.push({
      query_index: index + 1,
      model_name: entry.model_name,
      available_new_in_sri_lanka: true,
      trims: prices.map(p => ({
        trim_name: p.trim_name, model_year: p.model_year, brand_new_price_lkr: p.brand_new_price_lkr,
        price_basis: p.price_basis, as_of: p.as_of, source_site: host(p.source_url)
      })),
      sources: prices.filter(p => host(p.source_url)).map(p => ({ title: p.source_title || host(p.source_url), uri: p.source_url }))
    });
  }
  return {
    reply: { vehicles: replyVehicles, sources: [] },
    origin: `researched by ${oneLine(data.researched_by || "the research task", 80)}` +
      (/^\d{4}-\d{2}-\d{2}$/.test(data.researched_on || "") ? ` on ${data.researched_on.split("-").reverse().join("/")}` : "")
  };
}

// "https://www.riyasewana.com/x", "Riyasewana" and "m.riyasewana.com" all give "riyasewana"
const siteKey = s => String(s ?? "").toLowerCase().trim()
  .replace(/^https?:\/\//, "").split("/")[0].split(".")
  .filter((part, i, all) => !(i === 0 && all.length > 1 && ["www", "m", "amp"].includes(part)))[0] || "";

// Checks that a matched price comes from a recent published source, and that the site
// Gemini names for it is one of the pages it actually cited (a batch shares one list).
// Returns { sources } (the cited pages from that site) or { reason }.
export function vetSource(match, raw, month) {
  const cited = normaliseAnswer(raw)?.sources || [];
  if (!cited.length) {
    return { reason: Array.isArray(raw?.trims)
      ? "answer not backed by a web source: no source page given"
      : "answer not backed by a web source: the proxy has no price mode yet (redeploy it)" };
  }
  if (match.basis === "estimate") return { reason: "the proxy marked this price as an estimate, not a published price" };
  const site = siteKey(match.site);
  const sources = site ? cited.filter(s => siteKey(s.title) === site || siteKey(s.uri) === site) : [];
  if (!sources.length) {
    const titles = [...new Set(cited.map(s => s.title))].slice(0, 4).join(", ");
    return { reason: `price source ${match.site ? `"${oneLine(match.site, 60)}"` : "not given"} is not among the pages Gemini cited (${oneLine(titles, 120)})` };
  }
  const asOf = /^(\d{4})-(\d{2})$/.exec(match.asOf || "");
  const [y, m] = month.split("-").map(Number);
  if (!asOf || Number(asOf[2]) < 1 || Number(asOf[2]) > 12) return { reason: "price publication month is missing or invalid" };
  if ((Number(asOf[1]) * 12 + Number(asOf[2])) > y * 12 + m) return { reason: "price publication month is in the future" };
  if (asOf && (y * 12 + m) - (Number(asOf[1]) * 12 + Number(asOf[2])) > MAX_SOURCE_AGE_MONTHS) {
    return { reason: `price published in ${match.asOf}, more than ${MAX_SOURCE_AGE_MONTHS} months before ${month}` };
  }
  return { sources };
}

// Applies the sanity checks to a proposed price. Returns { price, change } or { reason }.
// Prices from a prices file are copied from a page, so they stay exact; the proxy's are rounded
export function vetPrice(oldPrice, newPrice, { exact = false } = {}) {
  if (typeof newPrice !== "number" || !Number.isFinite(newPrice) || newPrice <= 0) {
    return { reason: "no brand-new price in the answer" };
  }
  if (!(typeof oldPrice === "number" && Number.isFinite(oldPrice) && oldPrice > 0)) {
    return { reason: "no baseline price; the first price needs individual review" };
  }
  const price = exact ? Math.round(newPrice) : Math.round(newPrice / ROUND_TO) * ROUND_TO;
  const change = (price - oldPrice) / oldPrice;
  if (Math.abs(change) > MAX_CHANGE) {
    return { reason: `${fmtLkr(price)} is ${fmtPct(change)} from ${fmtLkr(oldPrice)}, outside ±${MAX_CHANGE * 100}%` };
  }
  return { price, change };
}

// Rewrites only the `price: <n>` of each named vehicle and catalogMeta.priceUpdated,
// leaving every other character of the file as it was.
export function rewriteCatalog(source, prices, month) {
  let out = source;
  for (const [name, price, evidence] of prices) {
    const byId = out.indexOf(`id: ${JSON.stringify(name)}`);
    const start = byId >= 0 ? byId : out.indexOf(`name: ${JSON.stringify(name)}`);
    if (start < 0) throw new Error(`Vehicle not found in catalogue source: ${name}`);
    const end = out.indexOf("}", start);
    const row = out.slice(start, end);
    if ((row.match(/\bprice: (?:null|\d+(?:\.\d+)?)/g) || []).length !== 1) throw new Error(`Expected one price for ${name}`);
    let next = row.replace(/\bprice: (?:null|\d+(?:\.\d+)?)/, `price: ${price}`);
    if (evidence) for (const key of ["priceCheckedMonth", "pricePublishedMonth", "priceSourceUrl"]) {
      next = next.replace(new RegExp(`\\b${key}: (?:null|"[^"]*")`), `${key}: ${JSON.stringify(evidence[key] ?? null)}`);
    }
    out = out.slice(0, start) + next + out.slice(end);
  }
  const meta = /(priceUpdated: ")\d{4}-\d{2}(")/;
  if (!meta.test(out)) throw new Error("catalogMeta.priceUpdated not found in catalogue source");
  return out.replace(meta, `$1${month}$2`);
}

async function importCatalog(file) {
  return import(`${pathToFileURL(file).href}?t=${Date.now()}-${Math.random()}`);
}

// Loads both versions as modules and checks that only prices and priceUpdated differ.
export async function verifyRewrite(oldSource, newSource) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vahanaiq-catalog-"));
  try {
    fs.writeFileSync(path.join(dir, "old.mjs"), oldSource);
    fs.writeFileSync(path.join(dir, "new.mjs"), newSource);
    const before = await importCatalog(path.join(dir, "old.mjs"));
    const after = await importCatalog(path.join(dir, "new.mjs"));
    if (after.baseVehicles.length !== before.baseVehicles.length) throw new Error("Vehicle count changed");
    before.baseVehicles.forEach((v, i) => {
      const w = after.baseVehicles[i];
      const keys = new Set([...Object.keys(v), ...Object.keys(w)]);
      for (const k of keys) {
        if (!["price", "priceCheckedMonth", "pricePublishedMonth", "priceSourceUrl"].includes(k) && JSON.stringify(v[k]) !== JSON.stringify(w[k])) throw new Error(`Field ${k} of ${v.name} changed`);
      }
      if (!(v.price === null && w.price === null) && (!Number.isFinite(w.price) || w.price <= 0)) throw new Error(`Invalid price for ${v.name}`);
    });
    if (!/^\d{4}-\d{2}$/.test(after.catalogMeta?.priceUpdated)) throw new Error("Invalid catalogMeta.priceUpdated");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function formatDiff(oldSource, newSource) {
  const a = oldSource.split("\n");
  const b = newSource.split("\n");
  const lines = [];
  a.forEach((line, i) => {
    if (line !== b[i]) lines.push(`@@ line ${i + 1} @@`, `- ${line}`, `+ ${b[i]}`);
  });
  return lines.join("\n");
}

// "dealer listing, 2026-10: [riyasewana.com](…), [ikman.lk](…)". Links are the pages
// Gemini cited for the whole answer, not necessarily for this one trim.
const sourceCell = r => {
  const label = [r.basis, r.asOf].filter(Boolean).join(", ");
  const links = (r.sources || []).slice(0, 3)
    .map(s => `[${cell(oneLine(s.title, 40)).replace(/[[\]]/g, "")}](${s.uri.replace(/[()\s]/g, encodeURIComponent)})`).join(", ");
  return [label, links].filter(Boolean).join(": ") || "–";
};

export function renderReport({ month, updated, skipped, origin = "from the VahanaIQ search proxy", exact = false }) {
  const out = [
    `Monthly refresh of eligible built-in catalogue prices for ${month}, ${origin}.`,
    "",
    "> [!WARNING]",
    "> These prices are AI estimates, not dealer quotes. An AI model found them on the web, but it can " +
      "misread a page or pick the wrong trim. Check each one against its linked sources before merging.",
    ""
  ];
  if (updated.length) {
    out.push(
      "| Vehicle | Matched trim | Old price | New price | Change | Source |",
      "| --- | --- | ---: | ---: | ---: | --- |",
      ...updated.map(r => `| ${cell(r.name)} | ${cell(r.trim)} | ${fmtLkr(r.old)} | ${fmtLkr(r.new)} | ${fmtPct(r.change)} | ${sourceCell(r)} |`),
      "",
      (exact ? "New prices are as published. " : `New prices are rounded to the nearest ${fmtLkr(ROUND_TO)}. `) +
        `Updated entries retain their own price-check month, publication month and source URL.`
    );
  } else {
    out.push("No vehicle passed the checks, so the catalogue file was left unchanged.");
  }
  out.push("", `### Skipped (${skipped.length})`, "");
  out.push(...(skipped.length
    ? skipped.map(s => `- **${s.name}**: ${oneLine(s.reason, 300)}. Price left as it was.`)
    : ["None."]));
  out.push(
    "",
    `Answers are skipped when the price is missing or zero, when no trim matches the catalogue name, ` +
      `when the site given for the price is not among the pages Gemini cited, when the proxy marks the price as an estimate, ` +
      `when the price was published more than ${MAX_SOURCE_AGE_MONTHS} months ago, ` +
      `or when the change is more than ±${MAX_CHANGE * 100}%.`
  );
  return out.join("\n") + "\n";
}

// How long to wait before retrying. Gemini quota errors say "Please retry in 58.7s",
// which is honoured; otherwise the wait grows with each attempt. Capped at 90 seconds.
export function retryWait(message, attempt, delay) {
  const hint = /retry in ([\d.]+)\s*s/i.exec(message || "");
  const ms = hint ? Math.ceil(Number(hint[1]) * 1000) + 1000 : delay * 2 * attempt;
  return Math.min(ms, MAX_RETRY_WAIT_MS);
}

// Quota errors that only clear at midnight Pacific time are not worth retrying
const isDailyLimit = e => e.quota === "daily" || /per ?day/i.test(e.message);
// Nor is a model Gemini will not serve, e.g. "models/gemini-2.5-flash is no longer
// available to new users" (seen on 20/10/2026)
const isModelUnavailable = e => [401, 403, 404].includes(e.upstreamStatus) ||
  /no longer available|is not found for API version|not supported for generateContent/i.test(e.message);

async function fetchAnswer(proxy, queries, delay) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(proxy, {
        method: "POST",
        // The proxy only answers price mode with its PRICE_TOKEN, when one is set
        headers: { "Content-Type": "application/json", ...(process.env.PRICE_TOKEN ? { "X-Price-Token": process.env.PRICE_TOKEN } : {}) },
        body: JSON.stringify({ queries, mode: "price" }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Full text kept here: Gemini's "Please retry in Ns" hint comes at the end
        throw Object.assign(
          new Error(oneLine(`HTTP ${res.status}${err.error ? ` ${err.error}` : ""}${err.detail ? `: ${err.detail}` : ""}`, Infinity)),
          { status: res.status, quota: err.quota, upstreamStatus: err.upstream_status });
      }
      return await res.json();
    } catch (e) {
      lastError = e;
      if (isDailyLimit(e) || isModelUnavailable(e) || e.status === 400) break;
      if (attempt < MAX_ATTEMPTS) {
        const wait = retryWait(e.message, attempt, delay);
        console.log(`  … attempt ${attempt} failed (${oneLine(e.message, 120)}); retrying in ${Math.round(wait / 1000)} s`);
        await sleep(wait);
      }
    }
  }
  throw lastError;
}

export async function main(argv = process.argv.slice(2)) {
  const { values: opts } = parseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      report: { type: "string" },
      "from-file": { type: "string" },
      proxy: { type: "string" },
      catalog: { type: "string" },
      month: { type: "string" },
      delay: { type: "string", default: "13000" }, // 5 requests a minute on the Gemini free tier
      batch: { type: "string", default: String(BATCH_SIZE) }
    }
  });
  const catalogPath = path.resolve(opts.catalog || path.join(ROOT, "js/market-catalogue.js"));
  const fromFile = opts["from-file"] && path.resolve(opts["from-file"]);
  const proxy = fromFile ? null : opts.proxy || process.env.PROXY_URL ||
    (await import(pathToFileURL(path.join(ROOT, "js/config.js")).href)).config.proxyUrl;
  const month = opts.month || new Date().toISOString().slice(0, 7);
  const delay = Number(opts.delay);
  const batchSize = Number(opts.batch);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 12) throw new Error(`--batch must be 1 to 12, got ${opts.batch}`);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(`--month must be YYYY-MM, got ${month}`);

  const source = fs.readFileSync(catalogPath, "utf8");
  const { baseVehicles } = await importCatalog(catalogPath);
  console.log(`Refreshing ${baseVehicles.length} catalogue prices for ${month} from ${fromFile || proxy}${opts["dry-run"] ? " (dry run)" : ""}\n`);
  const updated = [];
  const skipped = [];
  const eligible = baseVehicles.filter(v => {
    const reason = v.price === null ? "no baseline price; first price needs individual review" : v.cond && v.cond !== "New" ? "not a brand-new catalogue entry" : "";
    if (reason) skipped.push({ name: v.name, reason });
    return !reason;
  });
  const research = fromFile ? readResearch(fromFile, eligible) : null;
  let failures = 0;
  let failedInARow = 0;
  let stopReason = null;
  const batches = [];
  const size = research ? Math.max(1, eligible.length) : batchSize;
  for (let i = 0; i < eligible.length; i += size) batches.push(eligible.slice(i, i + size));

  for (const [b, group] of batches.entries()) {
    if (stopReason) {
      failures += group.length;
      group.forEach(v => skipped.push({ name: v.name, reason: stopReason }));
      continue;
    }
    if (b) await sleep(delay);
    let reply;
    try {
      reply = research ? research.reply : await fetchAnswer(proxy, group.map(buildQuery), delay);
    } catch (e) {
      failures += group.length;
      failedInARow++;
      group.forEach(v => skipped.push({ name: v.name, reason: `proxy request failed (${oneLine(e.message)})` }));
      console.log(`✗ ${group.map(v => v.name).join(", ")}: proxy request failed (${e.message})`);
      if (isDailyLimit(e)) stopReason = "not asked: Gemini's free daily limit is used up (it resets at midnight Pacific time)";
      else if (isModelUnavailable(e)) stopReason = "not asked: Gemini will not serve the proxy's price model (set PRICE_MODEL on Cloud Run to one it does)";
      else if (e.status === 400) stopReason = "not asked: the proxy rejected the request (is it redeployed with batched price mode?)";
      else if (failedInARow >= MAX_FAILED_IN_A_ROW) stopReason = `not asked, after ${MAX_FAILED_IN_A_ROW} failed requests in a row`;
      continue;
    }
    failedInARow = 0;
    if (reply?.model) console.log(`  (answered by ${reply.model})`);

    for (const [j, v] of group.entries()) {
      const answer = answerFor(reply, j + 1);
      const match = matchTrim(v, answer);
      const grounded = match.reason ? match : vetSource(match, answer, month);
      const vetted = grounded.reason ? grounded : vetPrice(v.price, match.price, { exact: !!research });
      if (vetted.reason) {
        const reason = match.trimName ? `${match.trimName} (${match.year}): ${vetted.reason}` : vetted.reason;
        skipped.push({ name: v.name, reason });
        console.log(`✗ ${v.name}: ${reason}`);
        continue;
      }
      updated.push({
        id: v.id, name: v.name, trim: `${match.trimName} (${match.year})`, old: v.price, new: vetted.price, change: vetted.change,
        basis: match.basis, asOf: match.asOf, sources: grounded.sources
      });
      console.log(`✓ ${v.name}: ${fmtLkr(v.price)} → ${fmtLkr(vetted.price)} (${fmtPct(vetted.change)})`);
    }
  }

  const report = renderReport({ month, updated, skipped, ...(research ? { origin: research.origin, exact: true } : {}) });
  if (opts.report) fs.writeFileSync(opts.report, report);

  if (eligible.length && failures === eligible.length) {
    console.error("\nEvery proxy request failed; catalogue left unchanged.");
    return 1;
  }
  if (!updated.length) {
    console.log("\nNo vehicle passed the checks; catalogue left unchanged.\n\n" + report);
    return 0;
  }

  const next = rewriteCatalog(source, updated.map(r => [r.id || r.name, r.new, { priceCheckedMonth: month, pricePublishedMonth: r.asOf || null, priceSourceUrl: r.sources?.[0]?.uri || null }]), month);
  await verifyRewrite(source, next);
  console.log(`\n--- ${path.relative(ROOT, catalogPath)}\n+++ ${path.relative(ROOT, catalogPath)} (refreshed)\n${formatDiff(source, next)}\n`);
  console.log(report);
  if (opts["dry-run"]) {
    console.log("Dry run: catalogue not written.");
  } else {
    fs.writeFileSync(catalogPath, next);
    console.log(`Wrote ${path.relative(ROOT, catalogPath)}.`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }, e => { console.error(e); process.exitCode = 1; });
}
