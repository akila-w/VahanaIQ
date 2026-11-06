// Fail-closed tests for the app check publisher and the workflow that runs it.
// The key is ephemeral and the GitHub API is faked; no network is used.
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CHECK_NAME, appJwt, conclusionFor, publishCheck } from '../scripts/publish-catalogue-check.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const head = 'a'.repeat(40), base = 'b'.repeat(40);
const env = {
  CHECK_PUBLISHER_KEY: pem, CHECK_PUBLISHER_APP_ID: '5560876', GUARD_RESULT: 'success',
  GITHUB_REPOSITORY: 'akila-w/VahanaIQ', GITHUB_REPOSITORY_ID: '1425560809', PR_NUMBER: '7',
  PR_BASE_SHA: base, PR_HEAD_SHA: head, RUN_URL: 'https://github.com/akila-w/VahanaIQ/actions/runs/1'
};

function fakeGitHub(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const route = init.method + ' ' + url.replace('https://api.github.com', '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ route, body, authorization: init.headers.Authorization });
    const respond = (status, json) => ({ ok: status < 400, status, json: async () => json });
    if (overrides[route]) return respond(...overrides[route](body));
    if (route === 'GET /repos/akila-w/VahanaIQ/installation') return respond(200, { id: 99, app_id: 5560876 });
    if (route === 'POST /app/installations/99/access_tokens') {
      return respond(201, { token: 'installation-token', permissions: { checks: 'write', metadata: 'read' } });
    }
    if (route === 'POST /repos/akila-w/VahanaIQ/check-runs') {
      return respond(201, { app: { id: 5560876 }, head_sha: body.head_sha, conclusion: body.conclusion });
    }
    if (route === 'DELETE /installation/token') return respond(204);
    throw new Error('Unexpected call: ' + route);
  };
  return { calls, fetchImpl };
}
const posted = calls => calls.find(call => call.route.endsWith('/check-runs'));
const revoked = calls => calls.some(call => call.route === 'DELETE /installation/token');

// Only an exact success can ever publish success.
assert.equal(conclusionFor('success'), 'success');
for (const result of ['failure', 'cancelled', 'skipped', 'neutral', '', undefined, 'SUCCESS']) {
  assert.equal(conclusionFor(result), 'failure', 'Must fail closed for ' + result);
}

// The JWT is correctly signed, short-lived and names the app.
const jwt = appJwt(5560876, pem, 1000).split('.');
assert.equal(JSON.parse(Buffer.from(jwt[1], 'base64url')).iss, 5560876);
assert.equal(JSON.parse(Buffer.from(jwt[1], 'base64url')).exp, 1540);
assert.equal(verify('RSA-SHA256', Buffer.from(jwt[0] + '.' + jwt[1]), publicKey,
  Buffer.from(jwt[2], 'base64url')), true);

// Success: a narrow token, a check bound to the exact head, and revocation.
const good = fakeGitHub();
assert.deepEqual(await publishCheck(env, good.fetchImpl), { conclusion: 'success', headSHA: head });
const tokenRequest = good.calls.find(call => call.route.endsWith('/access_tokens'));
assert.deepEqual(tokenRequest.body, { repository_ids: [1425560809], permissions: { checks: 'write' } });
assert.equal(posted(good.calls).body.name, CHECK_NAME);
assert.equal(posted(good.calls).body.head_sha, head);
assert.equal(posted(good.calls).body.conclusion, 'success');
assert.equal(posted(good.calls).authorization, 'Bearer installation-token');
assert.equal(revoked(good.calls), true);
assert.equal(JSON.stringify(good.calls).includes('PRIVATE KEY'), false, 'Key must never be sent');

// A guard that did not pass publishes failure rather than nothing.
const failed = fakeGitHub();
await publishCheck({ ...env, GUARD_RESULT: 'cancelled' }, failed.fetchImpl);
assert.equal(posted(failed.calls).body.conclusion, 'failure');

// Invalid input stops before any network call.
for (const change of [
  { CHECK_PUBLISHER_KEY: '' }, { CHECK_PUBLISHER_APP_ID: 'x' }, { PR_HEAD_SHA: 'main' },
  { PR_BASE_SHA: '' }, { PR_NUMBER: '7;' }, { GITHUB_REPOSITORY: 'a/b/c' },
  { GITHUB_REPOSITORY_ID: '' }, { RUN_URL: 'https://example.invalid/' }
]) {
  const fake = fakeGitHub();
  await assert.rejects(publishCheck({ ...env, ...change }, fake.fetchImpl), /Missing|Invalid/);
  assert.equal(fake.calls.length, 0, 'No call for ' + JSON.stringify(Object.keys(change)));
}

// The wrong app's installation never gets a token.
const wrongApp = fakeGitHub({
  'GET /repos/akila-w/VahanaIQ/installation': () => [200, { id: 99, app_id: 15368 }]
});
await assert.rejects(publishCheck(env, wrongApp.fetchImpl), /another app/);
assert.equal(wrongApp.calls.some(call => call.route.endsWith('/access_tokens')), false);

// A token wider than requested publishes nothing and is revoked.
const wide = fakeGitHub({
  'POST /app/installations/99/access_tokens': () =>
    [201, { token: 'wide', permissions: { checks: 'write', contents: 'write' } }]
});
await assert.rejects(publishCheck(env, wide.fetchImpl), /wider/);
assert.equal(posted(wide.calls), undefined);
assert.equal(revoked(wide.calls), true);

// A wrong or failed publication is an error, and the token is still revoked.
for (const [response, reason] of [
  [[201, { app: { id: 15368 }, head_sha: head, conclusion: 'success' }], /not published by the app/],
  [[201, { app: { id: 5560876 }, head_sha: base, conclusion: 'success' }], /wrong commit/],
  [[201, { app: { id: 5560876 }, head_sha: head, conclusion: 'failure' }], /wrong conclusion/],
  [[403, {}], /returned 403/]
]) {
  const fake = fakeGitHub({ 'POST /repos/akila-w/VahanaIQ/check-runs': () => response });
  await assert.rejects(publishCheck(env, fake.fetchImpl), reason);
  assert.equal(revoked(fake.calls), true);
}

// Workflow shape: the key is confined to a job that never touches PR content.
const workflow = readFileSync(
  new URL('../.github/workflows/catalogue-publication-trusted.yml', import.meta.url), 'utf8')
  .split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
const [guardJob, publishJob] = workflow.split(/\n  catalogue-publication-publish:\n/);
assert.ok(publishJob, 'Publish job must exist');
assert.match(workflow, /^on:\n  pull_request_target:/m);
assert.doesNotMatch(workflow, /^\s+pull_request:/m, 'Must not run workflow code from a PR');
assert.match(guardJob, /\n  catalogue-publication-trusted:\n/);
assert.doesNotMatch(guardJob, /secrets\.|environment:/, 'Guard job reads PR data, so holds no key');
assert.match(publishJob, /needs: catalogue-publication-trusted/);
assert.match(publishJob, /if: \$\{\{ always\(\) \}\}/);
assert.match(publishJob, /name: catalogue-publisher/);
assert.match(publishJob, /secrets\.CHECK_PUBLISHER_KEY/);
assert.doesNotMatch(publishJob, /refs\/pull|head\.ref|git fetch|persist-credentials: true/,
  'Publish job must not fetch PR content');
assert.equal((workflow.match(/secrets\./g) ?? []).length, 1, 'Only the publisher key may be used');
assert.match(workflow, /^permissions:\n  contents: read$/m);

console.log('Catalogue check publisher: PASS (fail-closed publisher and workflow shape)');
