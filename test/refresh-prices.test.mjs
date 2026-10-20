// Tests for scripts/refresh-prices.mjs against a mocked search proxy (no network).
//   node test/refresh-prices.test.mjs

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { matchTrim, answerFor, vetPrice, vetSource, rewriteCatalog, verifyRewrite, retryWait, fmtLkr, fmtPct } from "../scripts/refresh-prices.mjs";
import { baseVehicles } from "../js/catalog.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts/refresh-prices.mjs");
const CATALOG = path.join(ROOT, "js/catalog.js");

console.log("=== REFRESH-PRICES TESTS ===\n");

// Builds a proxy answer in the VEHICLE_RESPONSE_SCHEMA shape
const answer = (model, trims, year = 2026) => ({
  is_available_in_sri_lanka: true,
  model_name: model,
  wikipedia_slug: model.replace(/ /g, "_"),
  availability_notes: "",
  import_route: "Grey Import",
  model_years: [{
    year,
    trims: trims.map(([trim_name, brand_new]) => ({
      trim_name, powertrain: "", fuel_economy_kml: "", warranty_type: "Grey",
      condition_prices: { brand_new, recond: 0, used_low: 0, used_med: 0 }
    }))
  }]
});
// Builds one vehicle's grounded price-mode answer: an entry of the proxy's `vehicles`
// list for POST { mode: "price", queries }, with the reply's cited sources attached
const SOURCES = [
  { title: "riyasewana.com", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc" },
  { title: "ikman.lk", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/def" }
];
const priceAnswer = (model, trims, { year = 2026, basis = "dealer listing", asOf = "2026-10", site = "riyasewana.com", sources = SOURCES } = {}) => ({
  model_name: model,
  available_new_in_sri_lanka: true,
  trims: trims.map(([trim_name, brand_new_price_lkr]) => ({
    trim_name, model_year: year, brand_new_price_lkr, price_basis: basis, as_of: asOf, source_site: site
  })),
  sources
});
const car = name => baseVehicles.find(v => v.name.startsWith(name));

// -------------------------------------------------------------
console.log("TEST 1: Trim matching");
let m = matchTrim(car("Toyota Corolla Cross"), answer("Toyota Corolla Cross", [["G", 26000000], ["Z", 31000000]]));
assert.equal(m.trimName, "Z");
assert.equal(m.price, 31000000);
m = matchTrim(car("BYD Sealion 6"), answer("BYD Sealion 6", [["Dynamic", 22000000], ["Premium AWD", 27000000], ["Premium FWD", 25000000]]));
assert.equal(m.trimName, "Premium AWD", "AWD in the catalogue name must pick the AWD trim");
m = matchTrim(car("Toyota Raize"), answer("Toyota Raize", [["G Hybrid", 13000000], ["Z Hybrid", 15000000], ["Z", 12500000]]));
assert.equal(m.trimName, "Z Hybrid");
m = matchTrim(car("Honda Vezel"), {
  ...answer("Honda Vezel", [["e:HEV Z", 20000000]], 2025),
  model_years: [answer("Honda Vezel", [["e:HEV Z", 20000000]], 2025).model_years[0], answer("Honda Vezel", [["e:HEV Z", 21500000]], 2026).model_years[0]]
});
assert.deepEqual([m.year, m.price], [2026, 21500000], "The newest model year must win");
assert.match(matchTrim(car("Honda Vezel"), answer("Honda Vezel", [["e:HEV X", 18000000]])).reason, /no trim matching/);
assert.match(matchTrim(car("Honda Vezel"), { is_available_in_sri_lanka: false }).reason, /not available/);
assert.match(matchTrim(car("Honda Vezel"), { is_available_in_sri_lanka: true, model_name: "Honda Vezel", model_years: [] }).reason, /no trims/);
assert.match(matchTrim(car("Toyota Raize"), answer("Toyota Raize", [["Z Hybrid", 15000000], ["Hybrid Z", 14000000]])).reason, /ambiguous/);
// Trim names from the first live run (20/10/2026), which carry powertrain and gearbox words
assert.equal(matchTrim(car("Suzuki Fronx"), answer("Suzuki Fronx", [["Alpha 1.0L Turbo MHEV", 12500000]])).trimName, "Alpha 1.0L Turbo MHEV",
  "Powertrain words in the trim name may come from the catalogue powertrain");
m = matchTrim(car("Nissan Magnite"), answer("Nissan Magnite", [["Tekna 1.0 Turbo", 9500000], ["Tekna Plus 1.0 Turbo", 10000000]]));
assert.equal(m.trimName, "Tekna Plus 1.0 Turbo", "1.0 and 1.0L must read the same");
m = matchTrim(car("Toyota Urban Cruiser Taisor"), answer("Toyota Urban Cruiser Taisor", [["V 1.0L Turbo MT", 11500000], ["V 1.0L Turbo AT", 12000000]]));
assert.deepEqual([m.trimName, m.price], ["V 1.0L Turbo AT", 12000000], "When trims differ only by gearbox, the automatic is priced");
m = matchTrim(car("Toyota Urban Cruiser Taisor"), answer("Toyota Urban Cruiser Taisor", [["G 1.0L Turbo AT", 10500000], ["V 1.0L Turbo MT", 11500000]]));
assert.equal(m.trimName, "V 1.0L Turbo MT", "The gearbox preference never overrides the grade");
assert.match(matchTrim(car("Suzuki Fronx"), answer("Suzuki Fronx", [["1.0L Turbo MHEV", 12500000]])).reason, /no trim matching/,
  "A trim named only by its powertrain must not match");
assert.match(matchTrim(car("Honda Vezel"), answer("Honda Vezel", [["e:HEV X 1.5L", 18000000]])).reason, /no trim matching/);
console.log("✓ Trim matching PASSED\n");

// -------------------------------------------------------------
console.log("TEST 1b: Grounded price-mode answers");
const taisor = priceAnswer("Toyota Urban Cruiser Taisor", [["V 1.0L Turbo MT", 11500000], ["V 1.0L Turbo AT", 12000000]]);
m = matchTrim(car("Toyota Urban Cruiser Taisor"), taisor);
assert.deepEqual([m.trimName, m.year, m.price, m.basis, m.asOf], ["V 1.0L Turbo AT", 2026, 12000000, "dealer listing", "2026-10"]);
assert.equal(m.site, "riyasewana.com");
assert.deepEqual(vetSource(m, taisor, "2026-10").sources, [SOURCES[0]], "Only the cited pages from the named site are linked");
assert.deepEqual(vetSource({ ...m, site: "Riyasewana" }, taisor, "2026-10").sources, [SOURCES[0]], "A site name matches its domain");
assert.deepEqual(vetSource({ ...m, site: "https://www.ikman.lk/en/ad/x" }, taisor, "2026-10").sources, [SOURCES[1]]);
assert.match(vetSource({ ...m, site: "carmudi.lk" }, taisor, "2026-10").reason,
  /price source "carmudi\.lk" is not among the pages Gemini cited \(riyasewana\.com, ikman\.lk\)/);
assert.match(vetSource({ ...m, site: undefined }, taisor, "2026-10").reason, /price source not given/);
assert.match(vetSource(m, { ...taisor, sources: [] }, "2026-10").reason, /not backed by a web source: Gemini cited none/);
assert.match(vetSource(m, answer("Toyota Urban Cruiser Taisor", [["V", 12000000]]), "2026-10").reason, /no price mode yet \(redeploy it\)/,
  "An answer from a proxy without price mode is never accepted");
assert.match(vetSource({ ...m, basis: "estimate" }, taisor, "2026-10").reason, /estimate/);
assert.equal(vetSource({ ...m, asOf: "2026-04" }, taisor, "2026-10").reason, undefined, "6 months old is allowed");
assert.match(vetSource({ ...m, asOf: "2026-03" }, taisor, "2026-10").reason, /published in 2026-03, more than 6 months/);
assert.match(vetSource({ ...m, asOf: "2025-12" }, taisor, "2026-07").reason, /more than 6 months/, "Year boundaries count correctly");
const reply = { vehicles: [{ query_index: 2, ...taisor, sources: undefined }], sources: SOURCES, model: "gemini-2.5-flash" };
assert.deepEqual(answerFor(reply, 2).sources, SOURCES, "Each vehicle gets the reply's cited sources");
assert.equal(answerFor(reply, 1), null);
assert.match(matchTrim(car("Toyota Urban Cruiser Taisor"), answerFor(reply, 1)).reason, /no answer for this vehicle/);
console.log("✓ Grounded price-mode answers PASSED\n");

// -------------------------------------------------------------
console.log("TEST 2: Price checks");
assert.match(vetPrice(10000000, undefined).reason, /no brand-new price/);
assert.match(vetPrice(10000000, 0).reason, /no brand-new price/);
assert.match(vetPrice(10000000, "11000000").reason, /no brand-new price/);
assert.match(vetPrice(10000000, 12600000).reason, /outside ±25%/);
assert.match(vetPrice(10000000, 7400000).reason, /outside ±25%/);
assert.deepEqual(vetPrice(10000000, 12500000), { price: 12500000, change: 0.25 }, "Exactly +25% is allowed");
assert.equal(vetPrice(10000000, 10234567).price, 10230000, "Prices round to the nearest LKR 10,000");
console.log("✓ Price checks PASSED\n");

// -------------------------------------------------------------
console.log("TEST 2b: Retry timing");
assert.equal(retryWait("HTTP 502 quota: ... Please retry in 58.713294748s.", 1, 13000), 59714, "Gemini's retry hint is honoured");
assert.equal(retryWait("HTTP 502 quota: Please retry in 300s.", 1, 13000), 90000, "Waits are capped at 90 s");
assert.equal(retryWait("HTTP 502 upstream_unavailable: high demand", 1, 13000), 26000);
assert.equal(retryWait("HTTP 502 upstream_unavailable: high demand", 2, 13000), 52000, "Waits grow with each attempt");
console.log("✓ Retry timing PASSED\n");

// -------------------------------------------------------------
console.log("TEST 3: Rewrite touches only prices and priceUpdated");
const source = fs.readFileSync(CATALOG, "utf8");
const rewritten = rewriteCatalog(source, [["Honda Vezel e:HEV Z", 21500000], ["Suzuki Wagon R Custom Z", 9100000]], "2026-11");
const before = source.split("\n");
const after = rewritten.split("\n");
assert.equal(after.length, before.length);
const changed = before.map((l, i) => [l, after[i]]).filter(([a, b]) => a !== b);
assert.equal(changed.length, 3, "Exactly two vehicle lines and the meta line change");
for (const [a, b] of changed) {
  assert.equal(a.replace(/price: \d+|"\d{4}-\d{2}"/g, ""), b.replace(/price: \d+|"\d{4}-\d{2}"/g, ""));
}
assert.match(rewritten, /priceUpdated: "2026-11"/);
assert.match(rewritten, /name: "Honda Vezel e:HEV Z", pt: "1.5L Strong HEV", km: "24-28 km\/l", w: "Grey", price: 21500000,/);
await verifyRewrite(source, rewritten);
assert.throws(() => rewriteCatalog(source, [["No Such Car", 1]], "2026-11"), /not found/);
console.log("✓ Rewrite PASSED\n");

// -------------------------------------------------------------
console.log("TEST 4: CLI dry run and write against a mocked proxy");
// One canned answer per catalogue vehicle, keyed by the start of its query. Prices are
// relative to the current catalogue so the test still passes after a monthly refresh.
// Batches of 4 in catalogue order: [Corolla, Sealion 6, Vezel, Sealion 5],
// [Yaris, Hyryder, Raize, Swift], [Fronx, Taisor, Magnite, Wagon R].
const at = (name, factor) => Math.round(car(name).price * factor / 10000) * 10000;
const OTHER_SOURCE = { title: "patpat.lk", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/ghi" };
const mock = {
  "Toyota Corolla Cross Z (Adventure)": priceAnswer("Toyota Corolla Cross", [["G", at("Toyota Corolla", 0.85)], ["Z", at("Toyota Corolla", 1.023)]]),
  "BYD Sealion 6 Premium (AWD)": priceAnswer("BYD Sealion 6", [["Dynamic", at("BYD Sealion 6", 0.8)], ["Premium AWD", at("BYD Sealion 6", 1)]],
    { basis: "dealer price list", site: "ikman.lk" }),
  "Honda Vezel e:HEV Z": priceAnswer("Honda Vezel", [["e:HEV X", at("Honda Vezel", 0.88)], ["e:HEV Z", at("Honda Vezel", 1.022) + 4321]]),
  "BYD Sealion 5 Premium": priceAnswer("BYD Sealion 5", [["Premium", at("BYD Sealion 5", 0.98)]], { basis: "estimate" }),        // estimate
  "Toyota Yaris Cross Z": priceAnswer("Toyota Yaris Cross", [["Z", at("Toyota Yaris", 1.05)]], { site: "patpat.lk", sources: [OTHER_SOURCE] }),
  "Toyota Urban Cruiser Hyryder V": priceAnswer("Toyota Urban Cruiser Hyryder", [["V", at("Toyota Urban Cruiser Hyryder", 0.97)]],
    { site: "carmudi.lk", sources: [] }),                                                                          // site not cited
  "Toyota Raize Z Hybrid": priceAnswer("Toyota Raize", [["Z Hybrid", 0]]),                                       // zero price
  "Suzuki Swift MZ Hybrid": priceAnswer("Suzuki Swift", [["MZ", at("Suzuki Swift", 1.4)]]),                     // +40%
  "Suzuki Fronx Alpha (Turbo)": priceAnswer("Suzuki Fronx", [["Alpha 1.0L Turbo MHEV", at("Suzuki Fronx", 1.01)]], { asOf: "2025-12" }), // stale
  "Toyota Urban Cruiser Taisor V": priceAnswer("Toyota Urban Cruiser Taisor", [["V 1.0L Turbo MT", at("Toyota Urban Cruiser Taisor", 0.97)],
    ["V 1.0L Turbo AT", at("Toyota Urban Cruiser Taisor", 1.04)]]),                                              // automatic wins
  "Nissan Magnite Tekna Plus": priceAnswer("Nissan Magnite", [["Tekna 1.0 Turbo", at("Nissan Magnite", 0.95)], ["Tekna Plus 1.0 Turbo", at("Nissan Magnite", 1.03)]]),
  "Suzuki Wagon R Custom Z": null                                                                                 // left out of the reply
};
const requests = [];
let behaviour = "normal"; // normal | blip (first try of batch 2 fails) | daily | down | old-proxy
const quotaError = (quota, hint) => ({ error: "quota", ...(quota ? { quota } : {}),
  detail: `You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.\n\n* Quota exceeded for metric: free_tier_requests, limit: 5\nPlease retry in ${hint}s.` });
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", c => { body += c; });
  req.on("end", () => {
    const { queries, mode } = JSON.parse(body);
    assert.equal(mode, "price", "The refresh always asks for the grounded price mode");
    assert.ok(Array.isArray(queries) && queries.length >= 1 && queries.length <= 4, "Vehicles go 4 to a request");
    requests.push(queries);
    const send = (status, json) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(json)); };
    const isBatch2 = queries[0].startsWith("Toyota Yaris Cross Z,");
    if (behaviour === "old-proxy") return send(400, { error: "bad_request", detail: "Missing query or image parameter" });
    if (behaviour === "daily") return send(502, quotaError("daily", "40000"));
    if (behaviour === "down") return send(502, quotaError("minute", "0.01"));
    if (behaviour === "blip" && isBatch2 && requests.filter(q => q[0] === queries[0]).length === 1) {
      return send(502, quotaError(undefined, "0.01")); // per-minute limit, no quota field: retried
    }
    const answers = queries.map(q => mock[Object.keys(mock).find(k => q.startsWith(k + ","))]);
    const sources = [...new Map(answers.filter(Boolean).flatMap(a => a.sources).map(s => [s.uri, s])).values()];
    send(200, {
      vehicles: answers.map((a, i) => a && { query_index: i + 1, ...a, sources: undefined }).filter(Boolean),
      sources, search_queries: ["price sri lanka"], model: "gemini-2.5-flash"
    });
  });
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const proxy = `http://127.0.0.1:${server.address().port}`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vahanaiq-refresh-test-"));
const tmpCatalog = path.join(tmp, "catalog.js");
fs.copyFileSync(CATALOG, tmpCatalog);
const run = (...extra) => promisify(execFile)(process.execPath, [
  SCRIPT, "--proxy", proxy, "--catalog", tmpCatalog, "--month", "2026-11", "--delay", "0", ...extra
]);
const failedRun = (...extra) => run(...extra).then(() => null, e => e);

try {
  // Dry run: prints the diff and report, writes nothing. Batch 2 hits a per-minute limit once.
  behaviour = "blip";
  const dry = await run("--dry-run", "--report", path.join(tmp, "report.md"));
  assert.equal(fs.readFileSync(tmpCatalog, "utf8"), source, "Dry run must not write the catalogue");
  assert.equal(requests.length, 4, "3 batches of 4, plus one retry");
  assert.match(dry.stdout, /attempt 1 failed .*; retrying in 1 s/, "The retry hint at the end of a long message is honoured");
  assert.match(dry.stdout, /\(answered by gemini-2\.5-flash\)/);
  const vezel = car("Honda Vezel");
  const vezelNew = at("Honda Vezel", 1.022);
  assert.ok(dry.stdout.includes(`- ${source.split("\n").find(l => l.includes(vezel.name))}`));
  assert.match(dry.stdout, new RegExp(`\\+ .*name: "Honda Vezel e:HEV Z".*price: ${vezelNew},`), "New price is rounded to LKR 10,000");
  assert.match(dry.stdout, /\+ export const catalogMeta = \{ priceUpdated: "2026-11" \};/);
  assert.match(dry.stdout, /Dry run: js\/catalog.js not written\./);

  const report = fs.readFileSync(path.join(tmp, "report.md"), "utf8");
  assert.match(report, /AI estimates/);
  assert.ok(report.includes(`| Honda Vezel e:HEV Z | e:HEV Z (2026) | ${fmtLkr(vezel.price)} | ${fmtLkr(vezelNew)} | ` +
    `${fmtPct((vezelNew - vezel.price) / vezel.price)} | dealer listing, 2026-10: [riyasewana.com](${SOURCES[0].uri}) |`),
    "Each row links only the cited pages from the site its price came from");
  assert.match(report, /\| BYD Sealion 6 Premium \(AWD\) \|.*\| dealer price list, 2026-10: \[ikman\.lk\]/);
  assert.match(report, /\| Toyota Yaris Cross Z \|.*\[patpat\.lk\]/);
  assert.match(report, /\| Toyota Urban Cruiser Taisor V \| V 1\.0L Turbo AT \(2026\) \|/);
  assert.match(report, /### Skipped \(6\)/);
  assert.match(report, /BYD Sealion 5 Premium\*\*: Premium \(2026\): the proxy marked this price as an estimate/);
  assert.match(report, /Hyryder V\*\*: V \(2026\): price source "carmudi\.lk" is not among the pages Gemini cited/);
  assert.match(report, /Toyota Raize Z Hybrid\*\*: Z Hybrid \(2026\): no brand-new price/);
  assert.match(report, /Suzuki Swift MZ Hybrid\*\*: MZ \(2026\): LKR [\d,]+ is \+4\d\.\d% from LKR [\d,]+, outside ±25%/);
  assert.match(report, /Fronx Alpha \(Turbo\)\*\*: Alpha 1\.0L Turbo MHEV \(2026\): price published in 2025-12, more than 6 months before 2026-11/);
  assert.match(report, /Suzuki Wagon R Custom Z\*\*: no answer for this vehicle from the proxy/);
  const skippedLines = report.split("### Skipped")[1].trim().split("\n").slice(2).filter(Boolean);
  assert.ok(skippedLines.slice(0, 6).every(l => l.startsWith("- **")), "Each skipped vehicle stays on one line");

  // Real run on the temporary copy
  behaviour = "normal";
  await run();
  const written = await import(`file://${tmpCatalog}?t=${Date.now()}`);
  assert.equal(written.catalogMeta.priceUpdated, "2026-11");
  const unchanged = name => car(name).price;
  const expected = {
    "Toyota Corolla Cross Z (Adventure)": at("Toyota Corolla", 1.023), "Honda Vezel e:HEV Z": vezelNew,
    "Toyota Urban Cruiser Taisor V": at("Toyota Urban Cruiser Taisor", 1.04), "Nissan Magnite Tekna Plus": at("Nissan Magnite", 1.03),
    // skipped vehicles keep their price
    "BYD Sealion 5 Premium": unchanged("BYD Sealion 5"), "Toyota Urban Cruiser Hyryder V": unchanged("Toyota Urban Cruiser Hyryder"),
    "Toyota Raize Z Hybrid": unchanged("Toyota Raize"), "Suzuki Swift MZ Hybrid": unchanged("Suzuki Swift"),
    "Suzuki Fronx Alpha (Turbo)": unchanged("Suzuki Fronx"), "Suzuki Wagon R Custom Z": unchanged("Suzuki Wagon R")
  };
  written.baseVehicles.forEach((v, i) => {
    const { price, ...rest } = v;
    const { price: oldPrice, ...oldRest } = baseVehicles[i];
    assert.deepEqual(rest, oldRest, `${v.name}: only the price may change`);
    if (v.name in expected) assert.equal(price, expected[v.name], v.name);
  });
  assert.equal(fs.readFileSync(CATALOG, "utf8"), source, "The real js/catalog.js must be untouched");

  // Daily free limit used up: one request, no retries, nothing else asked, exit 1
  behaviour = "daily";
  requests.length = 0;
  fs.copyFileSync(CATALOG, tmpCatalog);
  let failed = await failedRun("--report", path.join(tmp, "daily.md"));
  assert.equal(failed?.code, 1, "Exit code 1 when no vehicle could be asked");
  assert.equal(requests.length, 1, "A daily limit is never retried");
  assert.equal((fs.readFileSync(path.join(tmp, "daily.md"), "utf8").match(/not asked: Gemini's free daily limit is used up/g) || []).length, 8);

  // Per-minute limit that never clears: 2 batches × 3 attempts, then stop
  behaviour = "down";
  requests.length = 0;
  failed = await failedRun("--report", path.join(tmp, "down.md"));
  assert.equal(failed?.code, 1);
  assert.equal(requests.length, 6, "Two batches, three attempts each, then stop");
  assert.match(fs.readFileSync(path.join(tmp, "down.md"), "utf8"), /not asked, after 2 failed requests in a row/);

  // A proxy not yet redeployed rejects { queries }: stop at once
  behaviour = "old-proxy";
  requests.length = 0;
  failed = await failedRun("--report", path.join(tmp, "old.md"));
  assert.equal(failed?.code, 1);
  assert.equal(requests.length, 1, "A rejected request is never retried");
  assert.match(fs.readFileSync(path.join(tmp, "old.md"), "utf8"), /is it redeployed with batched price mode\?/);
  assert.equal(fs.readFileSync(tmpCatalog, "utf8"), source, "Nothing is written when no vehicle could be asked");
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log("✓ CLI dry run and write PASSED\n");

console.log("ALL REFRESH-PRICES TESTS PASSED");
