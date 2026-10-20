#!/usr/bin/env node
// Monthly catalogue price refresh, run by .github/workflows/refresh-prices.yml.
// Asks the search proxy for the brand-new price of each built-in vehicle, matches
// the trim by name and rewrites only the `price` values and catalogMeta.priceUpdated
// in js/catalog.js. Answers that are missing, zero or more than ±25% from the
// current price are skipped and listed. No npm dependencies (Node 20+).
// Requests are paced for the Gemini free tier (5 a minute), so a full run takes about 3 minutes.
//
//   node scripts/refresh-prices.mjs [--dry-run] [--report <file>] [--proxy <url>]
//                                   [--catalog <file>] [--month YYYY-MM] [--delay <ms>]
//
// --dry-run prints the diff and the report without writing js/catalog.js.
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
const MAX_ATTEMPTS = 3;             // per vehicle
const MAX_RETRY_WAIT_MS = 90000;
const MAX_FAILED_IN_A_ROW = 3;      // stop asking once the proxy is clearly down or out of quota
// Gearbox words in trim names. The catalogue names no gearbox, so when trims differ only
// by gearbox the automatic is priced (Akila's decision of 20/10/2026).
const AUTOMATIC = new Set(["at", "cvt", "ecvt", "amt", "dct", "ivt", "auto", "automatic"]);
const MANUAL = new Set(["mt", "manual"]);

// Lower-case words; engine sizes lose their unit so "1.0L", "1.0" and "1.0 L" all read "1 0"
const tokens = s => String(s ?? "").toLowerCase().replace(/(\d)\s*(l|cc)\b/g, "$1").split(/[^a-z0-9]+/).filter(Boolean);
const oneLine = (s, max = 200) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
};
const cell = s => String(s).replace(/\|/g, "\\|");
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const fmtLkr = n => "LKR " + Math.round(n).toLocaleString("en-GB");
export const fmtPct = x => (x > 0 ? "+" : x < 0 ? "−" : "±") + Math.abs(x * 100).toFixed(1) + "%";

export function buildQuery(v) {
  const route = v.w === "Official" ? "from the official agent" : "grey import";
  return `${v.name}, ${v.pt}, brand new ${route}: current price in Sri Lanka`;
}

// Picks the trim in the proxy answer whose name best matches the catalogue name.
// Make and model words are ignored, so "Toyota Corolla Cross Z (Adventure)" is matched
// on "z adventure". Every word of the trim name must appear in the catalogue name or
// its powertrain (so "e:HEV X" never matches "e:HEV Z", while "Alpha 1.0L Turbo MHEV"
// matches "Alpha (Turbo)" with powertrain "1.0L Turbo MHEV"), and the trim covering
// most of the catalogue name wins. Gearbox words are allowed, and the automatic wins a tie.
// Returns { year, trimName, price } or { reason } when nothing fits.
export function matchTrim(vehicle, answer) {
  if (!answer || typeof answer !== "object") return { reason: "empty answer from the proxy" };
  if (answer.is_available_in_sri_lanka === false) return { reason: "proxy says it is not available in Sri Lanka" };

  const ignore = new Set([...tokens(answer.model_name), tokens(vehicle.name)[0]]);
  const trimTokens = s => tokens(s).filter(t => !ignore.has(t));
  const want = new Set(trimTokens(vehicle.name).length ? trimTokens(vehicle.name) : tokens(vehicle.name));
  const powertrain = new Set(tokens(vehicle.pt));
  // Words that only describe the powertrain ("turbo") never count towards a match
  const grade = [...want].filter(t => !powertrain.has(t));
  const scored = new Set(grade.length ? grade : want);

  const candidates = [];
  for (const my of answer.model_years || []) {
    for (const trim of my.trims || []) {
      const have = new Set(trimTokens(trim.trim_name));
      if ([...have].some(t => !want.has(t) && !powertrain.has(t) && !AUTOMATIC.has(t) && !MANUAL.has(t))) continue;
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
  return { year, trimName: trim.trim_name, price: trim.condition_prices?.brand_new };
}

// Applies the sanity checks to a proposed price. Returns { price, change } or { reason }.
export function vetPrice(oldPrice, newPrice) {
  if (typeof newPrice !== "number" || !Number.isFinite(newPrice) || newPrice <= 0) {
    return { reason: "no brand-new price in the answer" };
  }
  const price = Math.round(newPrice / ROUND_TO) * ROUND_TO;
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
  for (const [name, price] of prices) {
    const start = out.indexOf(`name: ${JSON.stringify(name)}`);
    if (start < 0) throw new Error(`Vehicle not found in catalogue source: ${name}`);
    const end = out.indexOf("}", start);
    const row = out.slice(start, end);
    if ((row.match(/\bprice: \d+/g) || []).length !== 1) throw new Error(`Expected one price for ${name}`);
    out = out.slice(0, start) + row.replace(/\bprice: \d+/, `price: ${price}`) + out.slice(end);
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
        if (k !== "price" && v[k] !== w[k]) throw new Error(`Field ${k} of ${v.name} changed`);
      }
      if (!Number.isInteger(w.price) || w.price <= 0) throw new Error(`Invalid price for ${v.name}`);
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

export function renderReport({ month, updated, skipped }) {
  const out = [
    `Monthly refresh of the 12 built-in catalogue prices for ${month}, from the VahanaIQ search proxy.`,
    "",
    "> [!WARNING]",
    "> These prices are AI estimates (Gemini through the search proxy), not dealer quotes. " +
      "Check each one against a dealer price list or current listings before merging.",
    ""
  ];
  if (updated.length) {
    out.push(
      "| Vehicle | Matched trim | Old price | New price | Change |",
      "| --- | --- | ---: | ---: | ---: |",
      ...updated.map(r => `| ${cell(r.name)} | ${cell(r.trim)} | ${fmtLkr(r.old)} | ${fmtLkr(r.new)} | ${fmtPct(r.change)} |`),
      "",
      `New prices are rounded to the nearest LKR ${ROUND_TO.toLocaleString("en-GB")}. ` +
        `\`catalogMeta.priceUpdated\` is set to \`${month}\`, so the footer shows the new month.`
    );
  } else {
    out.push("No vehicle passed the checks, so `js/catalog.js` was left unchanged.");
  }
  out.push("", `### Skipped (${skipped.length})`, "");
  out.push(...(skipped.length
    ? skipped.map(s => `- **${s.name}**: ${oneLine(s.reason, 300)}. Price left as it was.`)
    : ["None."]));
  out.push(
    "",
    `Answers are skipped when the price is missing or zero, when no trim matches the catalogue name, ` +
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

async function fetchAnswer(proxy, query, delay) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(proxy, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(oneLine(`HTTP ${res.status}${err.error ? ` ${err.error}` : ""}${err.detail ? `: ${err.detail}` : ""}`));
      }
      return await res.json();
    } catch (e) {
      lastError = e;
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
      proxy: { type: "string" },
      catalog: { type: "string" },
      month: { type: "string" },
      delay: { type: "string", default: "13000" } // 5 requests a minute on the Gemini free tier
    }
  });
  const catalogPath = path.resolve(opts.catalog || path.join(ROOT, "js/catalog.js"));
  const proxy = opts.proxy || process.env.PROXY_URL ||
    (await import(pathToFileURL(path.join(ROOT, "js/config.js")).href)).config.proxyUrl;
  const month = opts.month || new Date().toISOString().slice(0, 7);
  const delay = Number(opts.delay);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(`--month must be YYYY-MM, got ${month}`);

  const source = fs.readFileSync(catalogPath, "utf8");
  const { baseVehicles } = await importCatalog(catalogPath);
  console.log(`Refreshing ${baseVehicles.length} catalogue prices for ${month} from ${proxy}${opts["dry-run"] ? " (dry run)" : ""}\n`);

  const updated = [];
  const skipped = [];
  let failures = 0;
  let failedInARow = 0;
  for (const [i, v] of baseVehicles.entries()) {
    if (failedInARow >= MAX_FAILED_IN_A_ROW) {
      failures++;
      skipped.push({ name: v.name, reason: `not asked, after ${MAX_FAILED_IN_A_ROW} proxy failures in a row` });
      continue;
    }
    if (i) await sleep(delay);
    let answer;
    try {
      answer = await fetchAnswer(proxy, buildQuery(v), delay);
    } catch (e) {
      failures++;
      failedInARow++;
      skipped.push({ name: v.name, reason: `proxy request failed (${e.message})` });
      console.log(`✗ ${v.name}: proxy request failed (${e.message})`);
      continue;
    }
    failedInARow = 0;
    const match = matchTrim(v, answer);
    const vetted = match.reason ? match : vetPrice(v.price, match.price);
    if (vetted.reason) {
      const reason = match.trimName ? `${match.trimName} (${match.year}): ${vetted.reason}` : vetted.reason;
      skipped.push({ name: v.name, reason });
      console.log(`✗ ${v.name}: ${reason}`);
      continue;
    }
    updated.push({ name: v.name, trim: `${match.trimName} (${match.year})`, old: v.price, new: vetted.price, change: vetted.change });
    console.log(`✓ ${v.name}: ${fmtLkr(v.price)} → ${fmtLkr(vetted.price)} (${fmtPct(vetted.change)})`);
  }

  const report = renderReport({ month, updated, skipped });
  if (opts.report) fs.writeFileSync(opts.report, report);

  if (failures === baseVehicles.length) {
    console.error("\nEvery proxy request failed; js/catalog.js left unchanged.");
    return 1;
  }
  if (!updated.length) {
    console.log("\nNo vehicle passed the checks; js/catalog.js left unchanged.\n\n" + report);
    return 0;
  }

  const next = rewriteCatalog(source, updated.map(r => [r.name, r.new]), month);
  await verifyRewrite(source, next);
  console.log(`\n--- ${path.relative(ROOT, catalogPath)}\n+++ ${path.relative(ROOT, catalogPath)} (refreshed)\n${formatDiff(source, next)}\n`);
  console.log(report);
  if (opts["dry-run"]) {
    console.log("Dry run: js/catalog.js not written.");
  } else {
    fs.writeFileSync(catalogPath, next);
    console.log(`Wrote ${path.relative(ROOT, catalogPath)}.`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }, e => { console.error(e); process.exitCode = 1; });
}
