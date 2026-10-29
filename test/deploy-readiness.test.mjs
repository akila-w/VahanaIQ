import assert from 'node:assert/strict';
import { test } from 'node:test';
import { waitForRelease, sha256, pagesDeployment, boundedInteger } from '../scripts/deploy-readiness.mjs';
const sha = 'a'.repeat(40), previous = 'b'.repeat(40);
const index = '<html><script src="app.js?v=2.12.0"></script></html>';
const resources = new Map([['index.html', sha256(index)], ['sw.js', sha256('offline-4')], ['css/experience.css', sha256('anchor-none')]]);
const options = { base: 'https://site.test/VahanaIQ', resources, reportPaths: ['Task-03-report.md', 'Task-03-report.html'], version: '2.12.0', attempts: 3, delayMs: 1, log: () => {} };
function fixture({ staleUntil = 0, staleFile = 'sw.js', identitySHA = sha, state = 'success', apiStatus = 200, hanging = false, leak = false } = {}) {
  let polls = 0;const requests = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url); requests.push({ url: String(url), init });
    if (hanging) return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
    if (u.hostname === 'api.github.com') {
      return new Response(JSON.stringify(u.pathname.endsWith('/statuses') ? [{ state }] : [{ id: 42, sha: identitySHA, environment: 'github-pages' }]), { status: apiStatus });
    }
    const file = u.pathname.replace('/VahanaIQ/', '');
    if (file === 'index.html') polls++;
    let body = { 'index.html': index, 'sw.js': 'offline-4', 'css/experience.css': 'anchor-none' }[file];
    if (file === staleFile && polls <= staleUntil) body = 'old release';
    return new Response(body || 'report', { status: body || leak ? 200 : 404,
      headers: { ETag: 'fixture-etag', Age: '104', 'Cache-Control': 'max-age=600', 'X-Cache': 'HIT' } });
  };
  return { fetchImpl, requests, polls: () => polls };
}
test('same version and exclusions cannot accept stale worker or changed CSS; propagation converges', async () => {
  for (const staleFile of ['sw.js', 'css/experience.css']) {
    const f = fixture({ staleFile, staleUntil: 1 });
    const result = await waitForRelease({ ...options, fetchImpl: f.fetchImpl });
    assert.equal(result.ready, true);assert.equal(result.attempt, 2);
    const site = f.requests.filter(r => new URL(r.url).hostname === 'site.test');
    assert.ok(site.every(r => new URL(r.url).searchParams.has('_smoke')));
    assert.equal(new Set(site.map(r => new URL(r.url).searchParams.get('_smoke'))).size, site.length);
    assert.ok(site.every(r => r.init.headers['Cache-Control'].includes('no-cache')));
  }
});
test('persistently stale response fails after the exact attempt bound with hash/cache evidence', async () => {
  const f = fixture({ staleUntil: Infinity });const logs = [];
  const result = await waitForRelease({ ...options, fetchImpl: f.fetchImpl, log: line => logs.push(line) });
  assert.equal(result.ready, false);assert.equal(f.polls(), 3);
  const mismatch = result.mismatches[0];assert.equal(mismatch.file, 'sw.js');
  assert.equal(mismatch.expectedSHA256, sha256('offline-4'));assert.equal(mismatch.actualSHA256, sha256('old release'));
  assert.equal(mismatch.headers.age, '104');assert.equal(mismatch.headers.etag, 'fixture-etag');
  assert.match(logs.at(-1), /deadline\/attempt limit/);
});
test('exact successful Pages deployment is required even if every application byte is unchanged', async () => {
  for (const variant of [{ identitySHA: previous }, { state: 'pending' }, { state: 'failure' }, { apiStatus: 403 }]) {
    const f = fixture(variant);
    const result = await waitForRelease({ ...options, fetchImpl: f.fetchImpl, identity: { expectedSHA: sha, repository: 'owner/repo', token: 'test-only' } });
    assert.equal(result.ready, false);assert.equal(result.mismatches.length, 0);
  }
  const f = fixture();const result = await waitForRelease({ ...options, fetchImpl: f.fetchImpl, identity: { expectedSHA: sha, repository: 'owner/repo', token: 'test-only' } });
  assert.equal(result.ready, true);assert.equal(result.deployment.deploymentId, 42);
});
test('newest exact deployment status wins over historical success', async () => {
  const result = await pagesDeployment({ expectedSHA: sha, repository: 'owner/repo', token: 'test-only', fetchImpl: async url => new Response(JSON.stringify(
    url.includes('/statuses') ? [{ state: 'failure' }, { state: 'success' }] : [{ id: 41, sha, environment: 'github-pages' }, { id: 42, sha, environment: 'github-pages' }])) });
  assert.equal(result.ready, false);assert.equal(result.deploymentId, 42);
});
test('exact deployment can become successful during bounded propagation', async () => {
  const f = fixture();let reads = 0;
  const result = await waitForRelease({ ...options, identity: { expectedSHA: sha, repository: 'owner/repo', token: 'test-only' }, fetchImpl: async (url, init) => {
    if (String(url).includes('/statuses')) return new Response(JSON.stringify([{ state: ++reads === 1 ? 'pending' : 'success' }]));
    return f.fetchImpl(url, init);
  } });
  assert.equal(result.ready, true);assert.equal(result.attempt, 2);
});
test('published reports still fail readiness', async () => {
  const f = fixture({ leak: true });const result = await waitForRelease({ ...options, fetchImpl: f.fetchImpl });
  assert.equal(result.ready, false);assert.equal(result.publishedReports.length, 2);
});
test('wall-clock deadline bounds slow responses independently of the attempt count', async () => {
  let time = 0, sleeps = 0;const f = fixture({ staleUntil: Infinity });
  const result = await waitForRelease({ ...options, fetchImpl: f.fetchImpl, timeoutMs: 5, delayMs: 10,
    now: () => time, sleep: async ms => { time += ms; sleeps++; } });
  assert.equal(result.ready, false);assert.equal(f.polls(), 1);assert.equal(sleeps, 1);assert.equal(time, 5);
});
test('HTTP requests are aborted and cannot turn timeouts into success', async () => {
  const f = fixture({ hanging: true });const keepAlive = setInterval(() => {}, 100);
  try {
    const result = await waitForRelease({ ...options, attempts: 1, requestTimeoutMs: 20, fetchImpl: f.fetchImpl });
    assert.equal(result.ready, false);assert.ok(result.mismatches.every(r => r.status === 0 && /Timeout/.test(r.error)));
  } finally { clearInterval(keepAlive); }
});
test('missing identity credentials and invalid retry limits fail closed', async () => {
  await assert.rejects(waitForRelease({ ...options, identity: { expectedSHA: sha } }), /requires a full SHA/);
  for (const n of ['NaN', 'Infinity', '-1', '0', '31', '1.5']) assert.throws(() => boundedInteger(n, 24, 'attempts', 1, 30));
  assert.equal(boundedInteger(undefined, 24, 'attempts', 1, 30), 24);
});
