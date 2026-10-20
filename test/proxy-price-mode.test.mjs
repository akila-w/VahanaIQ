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
  model_name: "Toyota Yaris Cross",
  available_new_in_sri_lanka: true,
  trims: [{ trim_name: "Z", model_year: 2026, brand_new_price_lkr: 17900000, price_basis: "dealer listing", as_of: "2026-10" }]
};
const grounding = {
  webSearchQueries: ["Toyota Yaris Cross Z price Sri Lanka"],
  groundingChunks: [
    { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a", title: "riyasewana.com" } },
    { retrievedContext: {} },
    { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/b" } }
  ]
};

try {
  // -------------------------------------------------------------
  console.log("TEST 1: Grounded price lookup with a response schema");
  replies = [geminiReply(JSON.stringify(priceJson), grounding)];
  let res = await call({ mode: "price", query: "Toyota Yaris Cross Z, 1.5L Strong HEV, brand new grey import" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.trims, priceJson.trims);
  assert.deepEqual(res.body.sources, [
    { title: "riyasewana.com", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a" },
    { title: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/b", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/b" }
  ], "Web sources come from groundingMetadata; other chunk kinds are ignored");
  assert.deepEqual(res.body.search_queries, grounding.webSearchQueries);
  assert.equal(res.body.structured, true);
  const sent = calls[0].body;
  assert.deepEqual(sent.tools, [{ google_search: {} }], "Price mode turns on Google Search");
  assert.ok(sent.generationConfig.responseSchema.properties.trims, "Price mode uses its own schema");
  assert.equal(sent.generationConfig.temperature, 0);
  const prompt = sent.contents[0].parts[0].text;
  assert.ok(prompt.includes(`Today is ${new Date().toISOString().slice(0, 10)}`), "The prompt carries today's date");
  assert.ok(prompt.includes('"Toyota Yaris Cross Z, 1.5L Strong HEV, brand new grey import"'));
  console.log("✓ Grounded price lookup PASSED\n");

  // -------------------------------------------------------------
  console.log("TEST 2: Falls back to JSON in the prompt if the schema is refused with tools");
  calls.length = 0;
  replies = [
    { status: 400, json: { error: { message: "Tool use with a response schema is unsupported" } } },
    geminiReply("Here you go:\n```json\n" + JSON.stringify(priceJson) + "\n```", grounding)
  ];
  res = await call({ mode: "price", query: "Toyota Yaris Cross Z" });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.generationConfig.responseSchema, undefined);
  assert.deepEqual(calls[1].body.tools, [{ google_search: {} }], "Search stays on in the fallback");
  assert.equal(res.body.structured, false);
  assert.equal(res.body.trims[0].brand_new_price_lkr, 17900000);
  console.log("✓ Schema fallback PASSED\n");

  // -------------------------------------------------------------
  console.log("TEST 3: Errors");
  replies = [{ status: 429, json: { error: { message: "Quota exceeded. Please retry in 30s." } } }];
  res = await call({ mode: "price", query: "Toyota Yaris Cross Z" });
  assert.deepEqual([res.statusCode, res.body.error], [502, "quota"]);
  assert.match(res.body.detail, /retry in 30s/, "Gemini's message, with its retry hint, reaches the refresh script");
  res = await call({ mode: "price", image: { data: "x" } });
  assert.deepEqual([res.statusCode, res.body.error], [400, "bad_request"], "Price mode needs a text query");
  replies = [geminiReply("Sorry, I could not find a price.", grounding)];
  res = await call({ mode: "price", query: "Toyota Yaris Cross Z" });
  assert.deepEqual([res.statusCode, res.body.error], [500, "internal"]);
  console.log("✓ Errors PASSED\n");

  // -------------------------------------------------------------
  console.log("TEST 4: The app's own search is unchanged");
  calls.length = 0;
  const search = { is_available_in_sri_lanka: true, model_name: "Toyota Aqua", model_years: [] };
  replies = [geminiReply(JSON.stringify(search))];
  res = await call({ query: "Toyota Aqua 2024" });
  assert.deepEqual(res.body, search);
  assert.equal(calls[0].body.tools, undefined, "Search mode does not use Google Search");
  assert.ok(calls[0].body.generationConfig.responseSchema.properties.model_years, "Search mode keeps VEHICLE_RESPONSE_SCHEMA");
  console.log("✓ Search mode unchanged PASSED\n");
} finally {
  globalThis.fetch = realFetch;
  console.error = quiet;
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("ALL PROXY PRICE-MODE TESTS PASSED");
