// Read-only, bounded Pages propagation gate. Kept separate for deterministic controls.
import { createHash, randomUUID } from 'node:crypto';
export const sha256 = body => createHash('sha256').update(body).digest('hex');
export function boundedInteger(value, fallback, name, min, max) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw Error(`${name} must be an integer from ${min} to ${max}`);
  return number;
}
export async function getResource(url, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  try {
    const fresh = new URL(url);
    fresh.searchParams.set('_smoke', randomUUID());
    const res = await fetchImpl(fresh, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' } });
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, body, text: body.toString('utf8'), type: res.headers.get('content-type') || '',
      sha256: sha256(body), url: res.url || String(fresh), headers: Object.fromEntries(res.headers) };
  } catch (error) {
    return { status: 0, body: Buffer.alloc(0), text: '', type: '', sha256: null, headers: {}, error: String(error) };
  }
}
export async function pagesDeployment({ expectedSHA, repository, token, fetchImpl = fetch, timeoutMs = 10000 }) {
  const api = async route => {
    const res = await fetchImpl(`https://api.github.com/repos/${repository}/${route}`, {
      signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28', 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) throw Error(`Pages identity API HTTP ${res.status}`);
    return res.json();
  };
  try {
    const deployments = await api(`deployments?sha=${expectedSHA}&environment=github-pages&per_page=100`);
    const exact = deployments.filter(d => d.sha === expectedSHA && d.environment === 'github-pages');
    // The latest deployment for this commit must itself have succeeded. Never
    // accept an older success beneath a newer failed/pending deployment.
    const deployment = exact.sort((a, b) => b.id - a.id)[0];
    if (!deployment) return { ready: false, expectedSHA, reason: 'No exact github-pages deployment' };
    const statuses = await api(`deployments/${deployment.id}/statuses?per_page=100`);
    const status = statuses[0];
    return { ready: status?.state === 'success', expectedSHA, actualSHA: deployment.sha, deploymentId: deployment.id,
      state: status?.state || 'missing', environmentURL: status?.environment_url };
  } catch (error) { return { ready: false, expectedSHA, reason: String(error) }; }
}
export async function waitForRelease({ base, resources, reportPaths, version, identity,
  attempts = 24, delayMs = 15000, timeoutMs = 480000, requestTimeoutMs = 10000,
  fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now, log = console.log }) {
  if (identity && (!/^[a-f0-9]{40}$/.test(identity.expectedSHA || '') ||
    !/^[\w.-]+\/[\w.-]+$/.test(identity.repository || '') || !identity.token)) throw Error('Exact Pages identity requires a full SHA, repository and token');
  const deadline = now() + timeoutMs;
  let last;
  for (let attempt = 1; attempt <= attempts && now() < deadline; attempt++) {
    const request = url => getResource(url, { fetchImpl, timeoutMs: Math.max(1, Math.min(requestTimeoutMs, deadline - now())) });
    const [deployment, assets, boundary] = await Promise.all([
      identity ? pagesDeployment({ ...identity, fetchImpl, timeoutMs: Math.max(1, Math.min(requestTimeoutMs, deadline - now())) }) : { ready: true, mode: 'resource hashes (local verification)' },
      Promise.all([...resources].map(async ([file, expected]) => {
        const actual = await request(`${base}/${file}`);
        return { file, expectedSHA256: expected, actualSHA256: actual.sha256, status: actual.status, headers: actual.headers, error: actual.error,
          marker: file !== 'index.html' || actual.text.includes(`app.js?v=${version}`) };
      })),
      Promise.all(reportPaths.map(async file => {
        const actual = await request(`${base}/${file}`);
        return { file, status: actual.status, headers: actual.headers, error: actual.error };
      }))
    ]);
    const mismatches = assets.filter(r => r.status !== 200 || r.expectedSHA256 !== r.actualSHA256 || !r.marker);
    const publishedReports = boundary.filter(r => r.status !== 404);
    last = { attempt, deployment, mismatches, publishedReports };
    if (deployment.ready && !mismatches.length && !publishedReports.length && now() < deadline) {
      log(`Release ready: ${resources.size} exact resource hashes and ${reportPaths.length} report exclusions; ${JSON.stringify(deployment)}`);
      return { ready: true, ...last };
    }
    log(`Waiting for intended release (${attempt}/${attempts}): ${JSON.stringify(last)}`);
    if (attempt < attempts && now() < deadline) await sleep(Math.min(delayMs, deadline - now()));
  }
  log(`Readiness deadline/attempt limit reached: ${JSON.stringify(last)}`);
  return { ready: false, ...last };
}
