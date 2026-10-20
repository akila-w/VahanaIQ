// Exercise both deployable proxies with a stubbed Gemini; no network or npm install.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import worker from '../serverless/cloudflare-worker.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanaiq-search-test-'));
const framework = path.join(tmp, 'node_modules/@google-cloud/functions-framework');
fs.mkdirSync(framework, { recursive: true });
fs.writeFileSync(path.join(framework, 'index.js'), 'exports.http = (_, fn) => { globalThis.__searchHandler = fn; };');
fs.copyFileSync(new URL('../serverless/gcp-cloud-function/index.js', import.meta.url), path.join(tmp, 'index.js'));
const previousKey = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = 'test-placeholder';
const realFetch = globalThis.fetch, realError = console.error;
let upstreamStatus = 200, sent;
const answer = { is_available_in_sri_lanka: true, is_multi_vehicle: true, discovered_vehicles: [{ model_name: 'Toyota Yaris Cross' }, { model_name: 'Honda Vezel' }] };
globalThis.fetch = async (_url, init) => {
  sent = JSON.parse(init.body);
  return new Response(JSON.stringify(upstreamStatus === 200
    ? { candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }
    : { error: { message: upstreamStatus === 503 ? 'High demand' : 'Quota exceeded' } }), { status: upstreamStatus });
};
console.error = () => {};
createRequire(path.join(tmp, 'index.js'))('./index.js');
const cloudRun = async body => {
  const res = { statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; }, send() {} };
  await globalThis.__searchHandler({ method: 'POST', body }, res);
  return { status: res.statusCode, body: res.body };
};
const cloudflare = async body => {
  const res = await worker.fetch(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify(body) }), { GEMINI_API_KEY: 'test-placeholder' });
  return { status: res.status, body: await res.json() };
};
try {
  for (const [name, call] of [['Cloud Run', cloudRun], ['Cloudflare', cloudflare]]) {
    upstreamStatus = 200;
    assert.equal((await call({ query: 'Compare Toyota Yaris Cross and Honda Vezel' })).status, 200);
    assert.ok(sent.contents[0].parts[0].text.includes('This is a comparison request.'));
    assert.ok(sent.contents[0].parts[0].text.includes('every requested model'));
    assert.ok(sent.generationConfig.responseSchema.required.includes('is_multi_vehicle'));
    assert.ok(sent.generationConfig.responseSchema.required.includes('discovered_vehicles'));
    await call({ query: 'Toyota Yaris Cross', comparison: true });
    assert.ok(sent.contents[0].parts[0].text.includes('This is a comparison request.'));
    await call({ query: 'Toyota Yaris Cross' });
    assert.ok(!sent.contents[0].parts[0].text.includes('This is a comparison request.'));
    upstreamStatus = 503;
    assert.deepEqual(await call({ query: 'Toyota' }), { status: 502, body: { error: 'upstream_unavailable', detail: 'High demand', upstream_status: 503 } });
    upstreamStatus = 429;
    assert.deepEqual(await call({ query: 'Toyota' }), { status: 502, body: { error: 'quota', detail: 'Quota exceeded', upstream_status: 429 } });
    console.log(`${name}: comparison schema/prompt, single search and error metadata passed`);
  }
} finally {
  globalThis.fetch = realFetch; console.error = realError;
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
  delete globalThis.__searchHandler;
  fs.rmSync(tmp, { recursive: true, force: true });
}
