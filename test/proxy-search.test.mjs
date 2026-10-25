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
fs.mkdirSync(path.join(tmp, 'shared'), { recursive: true });
fs.copyFileSync(new URL('../serverless/shared/proxy-logic.js', import.meta.url), path.join(tmp, 'shared', 'proxy-logic.js'));
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

  // Origins, screenshots and the rate limit
  const cloudRunWith = async (body, headers, peer) => {
    const res = { statusCode: 200, headers: {}, set(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(b) { this.body = b; }, send() {} };
    await globalThis.__searchHandler({ method: 'POST', body, headers, socket: peer ? { remoteAddress: peer } : undefined }, res);
    return res;
  };
  const cloudflareWith = async (body, headers, env = {}) => {
    const res = await worker.fetch(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify(body), headers }), { GEMINI_API_KEY: 'test-placeholder', ...env });
    return { statusCode: res.status, body: await res.json(), allow: res.headers.get('Access-Control-Allow-Origin') };
  };
  upstreamStatus = 200;
  let r = await cloudRunWith({ query: 'Toyota' }, { origin: 'https://evil.example' });
  assert.deepEqual([r.statusCode, r.body.error], [403, 'forbidden']);
  r = await cloudRunWith({ query: 'Toyota' }, { origin: 'https://akila-w.github.io' });
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://akila-w.github.io', 'The allowed origin is echoed, not *');
  r = await cloudflareWith({ query: 'Toyota' }, { Origin: 'https://evil.example' });
  assert.equal(r.statusCode, 403);
  r = await cloudflareWith({ query: 'Toyota' }, { Origin: 'https://akila-w.github.io' });
  assert.deepEqual([r.statusCode, r.allow], [200, 'https://akila-w.github.io']);
  for (const [name, call] of [['Cloud Run', b => cloudRunWith(b, {})], ['Cloudflare', b => cloudflareWith(b, {})]]) {
    r = await call({ image: { mimeType: 'application/pdf', data: 'abc' } });
    assert.deepEqual([r.statusCode, r.body.error], [400, 'bad_request'], `${name} rejects a non-image`);
    r = await call({ image: { mimeType: 'image/png', data: 'a'.repeat(5600001) } });
    assert.deepEqual([r.statusCode, r.body.error], [413, 'image_too_large'], `${name} rejects a huge image`);
  }
  r = { statusCode: 200 };
  for (let i = 0; i < 31 && r.statusCode !== 429; i++) r = await cloudRunWith({ query: 'Toyota' }, { 'x-forwarded-for': '203.0.113.9' });
  assert.deepEqual([r.statusCode, r.body.error], [429, 'rate_limited'], 'Cloud Run limits one IP to 30 requests per 10 minutes');
  r = { statusCode: 200 };
  for (let i = 0; i < 4 && r.statusCode !== 429; i++) r = await cloudflareWith({ query: 'Toyota' }, { 'CF-Connecting-IP': '203.0.113.10' }, { RATE_LIMIT: '2' });
  assert.equal(r.statusCode, 429, 'Cloudflare honours RATE_LIMIT');
  // Forged forwarded headers cannot rotate the quota for a single transport peer.
  upstreamStatus = 200;
  for (let i = 0; i < 30; i++) assert.equal((await cloudRunWith({ query: 'Toyota' }, { 'x-forwarded-for': `198.51.100.${i}, 203.0.113.9`, 'x-real-ip': `198.51.100.${i}` }, '192.0.2.1')).statusCode, 200);
  for (const body of [{query:'Toyota'}, {image:{mimeType:'image/png',data:'AAAA'}}, {mode:'price',queries:['Toyota']}]) {
    r = await cloudRunWith(body, {'x-forwarded-for':'new-forged-prefix'}, '192.0.2.1');
    assert.equal(r.statusCode,429);
  }
  assert.equal((await cloudRunWith({query:'Toyota'}, {}, '192.0.2.2')).statusCode,200,'Another transport peer has its own budget');
  console.log('Both proxies: origins, screenshots and rate limits passed; forged IP prefixes cannot bypass the Cloud Run quota');

  // When TRUSTED_PROXY=true is set, the first IP from X-Forwarded-For is trusted for client rate limiting
  process.env.TRUSTED_PROXY = 'true';
  const savedLog = console.log;
  console.log = () => {};
  try {
    for (let i = 0; i < 30; i++) {
      assert.equal((await cloudRunWith({ query: 'Toyota' }, { 'x-forwarded-for': '198.51.100.200, 192.0.2.99' }, '192.0.2.99')).statusCode, 200);
    }
    // 31st request from same client IP behind proxy is rate limited
    assert.equal((await cloudRunWith({ query: 'Toyota' }, { 'x-forwarded-for': '198.51.100.200, 192.0.2.99' }, '192.0.2.99')).statusCode, 429);
    // Distinct client IP behind the same proxy peer has its own quota
    assert.equal((await cloudRunWith({ query: 'Toyota' }, { 'x-forwarded-for': '198.51.100.201, 192.0.2.99' }, '192.0.2.99')).statusCode, 200);
    // Fallback to socket IP when X-Forwarded-For is missing
    assert.equal((await cloudRunWith({ query: 'Toyota' }, {}, '192.0.2.88')).statusCode, 200);
  } finally {
    console.log = savedLog;
    delete process.env.TRUSTED_PROXY;
  }
  console.log('TRUSTED_PROXY=true: correctly isolates client quotas behind shared proxy via X-Forwarded-For');
} finally {
  globalThis.fetch = realFetch; console.error = realError;
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
  delete globalThis.__searchHandler;
  fs.rmSync(tmp, { recursive: true, force: true });
}
