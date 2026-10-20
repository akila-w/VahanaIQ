// Tests for the Cloud Run proxy's grounded price mode, with Gemini stubbed (no network,
// no npm install): the real serverless/gcp-cloud-function/index.js is loaded against a
// stand-in for @google-cloud/functions-framework.
//   node test/proxy-price-mode.test.mjs

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
console.log("=== PROXY PRICE-MODE TESTS ===\n");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vahanaiq-proxy-test-"));
const fw = path.join(tmp, "node_modules/@google-cloud/functions-framework");
fs.mkdirSync(fw, { recursive: true });
fs.writeFileSync(path.join(fw, "index.js"), "exports.http = (name, fn) => { globalThis.__proxyHandler = fn; };");
fs.copyFileSync(path.join(ROOT, "serverless/gcp-cloud-function/index.js"), path.join(tmp, "index.js"));

process.env.GEMINI_API_KEY = "test-key";
const calls = [];
let replies = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body) });
  const { status = 200, json } = replies.shift();
  return { ok: status < 300, status, json: async () => json };
};
const quiet = console.error;
console.error = console.warn = () => {};

createRequire(path.join(tmp, "index.js"))("./index.js");
const handler = globalThis.__proxyHandler;

const call = async body => {
  const res = {
    statusCode: 200, body: undefined,
    set() {}, status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; }, send(b) { this.body = b; }
  };
  await handler({ method: "POST", body }, res);
  return res;
};
const geminiReply = (text, grounding) => ({
  json: { candidates: [{ content: { parts: [{ text }] }, ...(grounding ? { groundingMetadata: grounding } : {}) }] }
});
const priceJson = {
  vehicles: [
    { query_index: 1, model_name: "Toyota Yaris Cross", available_new_in_sri_lanka: true,
      trims: [{ trim_name: "Z", model_year: 2026, brand_new_price_lkr: 17900000, price_basis: "dealer listing", as_of: "2026-10", source_site: "riyasewana.com" }] },
    { query_index: 2, model_name: "Toyota Raize", available_new_in_sri_lanka: true, trims: [] }
  ]
};
const grounding = {
  webSearchQueries: ["Toyota Yaris Cross Z price Sri Lanka"],
  groundingChunks: [
    { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a", title: "riyasewana.com" } },
    { retrievedContext: {} },
    { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/b" } }
  ]
};
const queries = ["Toyota Yaris Cross Z, 1.5L Strong HEV, brand new grey import", "Toyota Raize Z Hybrid, 1.2L Strong HEV, brand new grey import"];

try {
  // -------------------------------------------------------------
  console.log("TEST 1: Batched grounded price lookup on its own model");
  replies = [geminiReply("Here you go:\n```json\n" + JSON.stringify(priceJson) + "\n```", grounding)];
  let res = await call({ mode: "price", queries });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.vehicles, priceJson.vehicles);
  assert.deepEqual(res.body.sources, [
    { title: "riyasewana.com", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a" },
    { title: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/b", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/b" }
  ], "Web sources come from groundingMetadata; other chunk kinds are ignored");
  assert.deepEqual(res.body.search_queries, grounding.webSearchQueries);
  assert.equal(res.body.model, "gemini-2.5-flash-lite");
  assert.equal(calls.length, 1, "One Gemini request for the whole batch");
  assert.match(calls[0].url, /\/models\/gemini-2\.5-flash-lite:generateContent/, "Price mode uses PRICE_MODEL, not the app's model");
  const sent = calls[0].body;
  assert.deepEqual(sent.tools, [{ google_search: {} }], "Price mode turns on Google Search");
  assert.equal(sent.generationConfig.responseSchema, undefined, "No response schema, so any model with Google Search works");
  assert.equal(sent.generationConfig.temperature, 0);
  const prompt = sent.contents[0].parts[0].text;
  assert.ok(prompt.includes(`Today is ${new Date().toISOString().slice(0, 10)}`), "The prompt carries today's date");
  assert.ok(prompt.includes(`1. "${queries[0]}"\n2. "${queries[1]}"`), "Vehicles are numbered in the prompt");
  assert.match(prompt, /source_site/);
  console.log("✓ Batched grounded price lookup PASSED\n");

  // -------------------------------------------------------------
  console.log("TEST 2: Errors and request checks");
  replies = [{ status: 429, json: { error: {
    message: "Quota exceeded. Please retry in 30s.",
    details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }]
  } } }];
  res = await call({ mode: "price", queries });
  assert.deepEqual([res.statusCode, res.body.error, res.body.quota], [502, "quota", "daily"], "A daily quota error is labelled as daily");
  assert.match(res.body.detail, /retry in 30s/, "Gemini's message, with its retry hint, reaches the refresh script");
  replies = [{ status: 429, json: { error: { message: "Slow down",
    details: [{ violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }] }] } } }];
  res = await call({ mode: "price", queries });
  assert.equal(res.body.quota, "minute");
  replies = [{ status: 404, json: { error: { message: "This model models/gemini-2.5-flash is no longer available to new users." } } }];
  res = await call({ mode: "price", queries });
  assert.deepEqual([res.statusCode, res.body.upstream_status], [502, 404], "Gemini's own status reaches the refresh script");
  replies = [{ status: 503, json: { error: { message: "This model is currently experiencing high demand." } } }];
  res = await call({ mode: "price", queries });
  assert.deepEqual([res.statusCode, res.body.error, res.body.quota], [502, "upstream_unavailable", undefined]);
  for (const bad of [undefined, [], ["ok", ""], [1], Array(13).fill("Toyota Aqua")]) {
    res = await call({ mode: "price", queries: bad });
    assert.deepEqual([res.statusCode, res.body.error], [400, "bad_request"], `queries ${JSON.stringify(bad)?.slice(0, 30)} is rejected`);
  }
  res = await call({ mode: "price", query: "Toyota Aqua" });
  assert.equal(res.statusCode, 400, "Price mode takes queries, not query");
  replies = [geminiReply("Sorry, I could not find a price.", grounding)];
  res = await call({ mode: "price", queries });
  assert.deepEqual([res.statusCode, res.body.error], [500, "internal"]);
  console.log("✓ Errors and request checks PASSED\n");

  // -------------------------------------------------------------
  console.log("TEST 4: The app's own search is unchanged");
  calls.length = 0;
  const search = { is_available_in_sri_lanka: true, model_name: "Toyota Aqua", model_years: [] };
  replies = [geminiReply(JSON.stringify(search))];
  res = await call({ query: "Toyota Aqua 2024" });
  assert.deepEqual(res.body, search);
  assert.equal(calls[0].body.tools, undefined, "Search mode does not use Google Search");
  assert.match(calls[0].url, /\/models\/gemini-3\.6-flash:generateContent/, "Search mode keeps the app's model");
  assert.ok(calls[0].body.generationConfig.responseSchema.properties.model_years, "Search mode keeps VEHICLE_RESPONSE_SCHEMA");
  console.log("✓ Search mode unchanged PASSED\n");
} finally {
  globalThis.fetch = realFetch;
  console.error = quiet;
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("ALL PROXY PRICE-MODE TESTS PASSED");
