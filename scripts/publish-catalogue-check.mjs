#!/usr/bin/env node
// Publishes the trusted guard's verdict as the required check, under the dedicated
// GitHub App. Runs only from default-branch code, in a job that never reads PR
// content. Only an exact `success` result publishes success; anything else fails.
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const CHECK_NAME = 'catalogue-publication-trusted';
const API = 'https://api.github.com';
const SHA = /^[a-f0-9]{40}$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const requireTrue = (ok, reason) => { if (!ok) throw new Error(reason); };
const base64url = value => Buffer.from(value).toString('base64url');

export function conclusionFor(guardResult) {
  return guardResult === 'success' ? 'success' : 'failure';
}

export function appJwt(appId, privateKeyPem, nowSeconds) {
  const unsigned = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
    base64url(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: appId }));
  const signature = sign('RSA-SHA256', Buffer.from(unsigned), createPrivateKey(privateKeyPem));
  return unsigned + '.' + signature.toString('base64url');
}

function readInputs(env) {
  const input = {
    privateKey: env.CHECK_PUBLISHER_KEY, appId: env.CHECK_PUBLISHER_APP_ID,
    guardResult: env.GUARD_RESULT, repository: env.GITHUB_REPOSITORY,
    repositoryId: env.GITHUB_REPOSITORY_ID, prNumber: env.PR_NUMBER,
    baseSHA: env.PR_BASE_SHA, headSHA: env.PR_HEAD_SHA, runURL: env.RUN_URL
  };
  requireTrue(input.privateKey, 'Missing publisher key');
  requireTrue(POSITIVE_INTEGER.test(input.appId ?? ''), 'Invalid app id');
  requireTrue(REPOSITORY.test(input.repository ?? ''), 'Invalid repository');
  requireTrue(POSITIVE_INTEGER.test(input.repositoryId ?? ''), 'Invalid repository id');
  requireTrue(POSITIVE_INTEGER.test(input.prNumber ?? ''), 'Invalid PR number');
  requireTrue(SHA.test(input.baseSHA ?? ''), 'Invalid base SHA');
  requireTrue(SHA.test(input.headSHA ?? ''), 'Invalid head SHA');
  requireTrue((input.runURL ?? '').startsWith('https://github.com/'), 'Invalid run URL');
  return input;
}

export async function publishCheck(env, fetchImpl = fetch, nowMs = Date.now()) {
  const input = readInputs(env);
  const call = async (method, url, token, body) => {
    const response = await fetchImpl(API + url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        Authorization: 'Bearer ' + token, 'User-Agent': 'vahanaiq-catalogue-check-publisher',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    // Error bodies are deliberately not logged: only the status is needed.
    requireTrue(response.ok, method + ' ' + url + ' returned ' + response.status);
    return response.status === 204 ? null : response.json();
  };

  const jwt = appJwt(Number(input.appId), input.privateKey, Math.floor(nowMs / 1000));
  const installation = await call('GET', '/repos/' + input.repository + '/installation', jwt);
  requireTrue(String(installation.app_id) === input.appId, 'Installation belongs to another app');
  const access = await call('POST', '/app/installations/' + installation.id + '/access_tokens', jwt, {
    repository_ids: [Number(input.repositoryId)], permissions: { checks: 'write' }
  });
  try {
    const { checks, metadata, ...other } = access.permissions ?? {};
    requireTrue(checks === 'write' && (metadata === undefined || metadata === 'read') &&
      Object.keys(other).length === 0, 'Token permissions are wider than requested');
    const conclusion = conclusionFor(input.guardResult);
    const published = await call('POST', '/repos/' + input.repository + '/check-runs', access.token, {
      name: CHECK_NAME, head_sha: input.headSHA, status: 'completed', conclusion,
      completed_at: new Date(nowMs).toISOString(), details_url: input.runURL,
      external_id: createHash('sha256').update([input.repositoryId, input.prNumber,
        input.baseSHA, input.headSHA, conclusion].join('|')).digest('hex'),
      output: {
        title: conclusion === 'success' ? 'Trusted guard passed' : 'Trusted guard did not pass',
        summary: 'PR #' + input.prNumber + '\nBase: ' + input.baseSHA + '\nHead: ' + input.headSHA +
          '\nGuard result: ' + conclusion + '\nRun: ' + input.runURL
      }
    });
    requireTrue(String(published.app?.id) === input.appId, 'Check was not published by the app');
    requireTrue(published.head_sha === input.headSHA, 'Check is bound to the wrong commit');
    requireTrue(published.conclusion === conclusion, 'Check has the wrong conclusion');
    return { conclusion, headSHA: input.headSHA };
  } finally {
    await call('DELETE', '/installation/token', access.token);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  publishCheck(process.env).then(result => {
    process.stdout.write('Catalogue check published: ' + JSON.stringify(result) + '\n');
  }).catch(error => {
    process.stderr.write('Catalogue check not published: ' + error.message + '\n');
    process.exitCode = 1;
  });
}
