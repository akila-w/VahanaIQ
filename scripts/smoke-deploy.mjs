// Verify the published application and its publication boundary. The unchanged
// app version alone cannot establish that a configuration-only release is live.
// SITE_URL=http://127.0.0.1:8765 SMOKE_ATTEMPTS=1 node scripts/smoke-deploy.mjs
import fs from 'node:fs';
import path from 'node:path';
import { sha256 as hash, getResource, waitForRelease, boundedInteger } from './deploy-readiness.mjs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.SITE_URL || 'https://akila-w.github.io/VahanaIQ').replace(/\/+$/, '');
const ATTEMPTS = boundedInteger(process.env.SMOKE_ATTEMPTS, 24, 'SMOKE_ATTEMPTS', 1, 30);
const DELAY_MS = boundedInteger(process.env.SMOKE_DELAY_MS, 15000, 'SMOKE_DELAY_MS', 0, 30000);
const TIMEOUT_MS = boundedInteger(process.env.SMOKE_TIMEOUT_MS, 480000, 'SMOKE_TIMEOUT_MS', 1, 480000);
const version = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8').match(/APP_VERSION = "([^"]+)"/)?.[1];
if (!version) throw new Error('Could not read APP_VERSION from js/config.js');
const reports = [...new Set([
  'Task-02-report.md', 'Task-03-report.md', 'Task-03.1-report.md',
  ...fs.readdirSync(ROOT).filter(name => /^Task-.*-report\.md$/.test(name))
])];
// Jekyll can publish both the original Markdown and a generated HTML page.
const REPORT_PATHS = reports.flatMap(name => [name, name.replace(/\.md$/, '.html')]);
const PAGES = ['catalogue.html', 'studio.html', 'about.html', 'privacy.html', 'terms.html'];
const ASSETS = [
  'css/experience.css', 'css/tokens.css', 'css/style.css', 'css/style.min.css', 'css/curated-catalogue.css', 'css/catalogue-studio.css', 'js/app.js', 'js/config.js',
  'js/catalogue-data.js', 'js/curated-catalogue.js', 'js/catalogue-studio.js', 'js/catalogue-photo-overlay.js',
  'js/catalogue-photos.js', 'js/catalogue-photo-store.js', 'js/photo-frame.js', 'js/official-photo-data.js', 'sw.js',
  'manifest.json', 'sitemap.xml', 'robots.txt', 'data/catalogue.json', 'data/identity.json',
  'assets/icons/favicon.svg', 'assets/icons/og-image.png',
  'assets/icons/logo-v-mark-transparent-light.svg', 'assets/icons/logo-v-mark-transparent-dark.svg',
  'assets/fonts/inter/Inter-variable.woff2', 'assets/fonts/manrope/Manrope-variable.woff2'
];
const BLOCKED = [
  ...REPORT_PATHS,
  'docs/catalogue-review.html', 'docs/catalogue-rebuild/catalogue.json', 'docs/photo-review.html',
  'docs/catalogue-rebuild/sources', 'test/verify.mjs', 'scripts/apply-studio-photos.mjs',
  'scripts/smoke-deploy.mjs', 'serverless/gcp-cloud-function/index.js', 'README.md', 'firestore.rules',
  'design-system/tokens.json', '.github/workflows/test.yml', '_config.yml',
  'docs/task-031-evidence/environment-comparison.json', 'docs/task-031-evidence/diagnostic-2-measurements.json.gz',
  'scripts/diagnose-font-metrics.mjs', 'test/browser/font-metrics.mjs',
  // Photo Studio exports carry inline photo pixels and are working files.
  'vahanaiq-studio-photos-2026-10-23.json'
];
const get = url => getResource(url);
// Include the complete cached shell as well as every existing published-resource
// assertion. This covers changed CSS/JS/JSON/fonts even without a version bump.
const shell = JSON.parse(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
const resourcePaths = [...new Set(['index.html', ...PAGES, ...ASSETS, ...shell.map(file => file.split('?')[0])])];
const resources = new Map(resourcePaths.map(file => [file, hash(fs.readFileSync(path.join(ROOT, file)))]));
const identity = process.env.SMOKE_EXPECTED_SHA ? {
  expectedSHA: process.env.SMOKE_EXPECTED_SHA, repository: process.env.SMOKE_REPOSITORY, token: process.env.SMOKE_GITHUB_TOKEN
} : undefined;
if (process.env.GITHUB_ACTIONS === 'true' && !process.env.SITE_URL && !identity) throw Error('Production Actions smoke requires exact Pages deployment identity');

export async function smoke() {
  const failures = [];
  const note = (ok, label, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
    if (!ok) failures.push(label);
  };
  const readiness = await waitForRelease({ base: BASE, resources, reportPaths: REPORT_PATHS, version, identity,
    attempts: ATTEMPTS, delayMs: DELAY_MS, timeoutMs: TIMEOUT_MS });
  if (!readiness.ready) {
    console.error(`Timed out waiting for the intended deployment, exact resource hashes AND root-report 404 responses at ${BASE}`);
    process.exitCode = 1; return false;
  }

  console.log(`\nChecking ${BASE} serves ${version} with the publication boundary\n`);
  const index = await get(`${BASE}/`);
  note(index.status === 200, 'GET / is 200', `HTTP ${index.status}`);
  note(index.text.includes(`style.min.css?v=${version}`), `index.html requests style.min.css?v=${version}`);
  note(index.text.includes(`tokens.css?v=${version}`), `index.html requests tokens.css?v=${version}`);
  note(!/["'(]\.?\/?docs\//.test(index.text), 'index.html does not link the unpublished docs/ tree');
  note(/<h1[^>]*>/.test(index.text), 'index.html renders a heading');
  note(!/\{\{\s*[a-z]+\s*\}\}/i.test(index.text), 'index.html has no unrendered template placeholders');
  note(hash(index.body) === hash(fs.readFileSync(path.join(ROOT, 'index.html'))), 'index.html content matches checkout');
  for (const page of PAGES) {
    const res = await get(`${BASE}/${page}`);
    note(res.status === 200 && res.text.includes('<html'), `GET ${page} is 200`, `HTTP ${res.status}`);
    note(!/["'(]\.?\/?docs\//.test(res.text), `${page} does not link the unpublished docs/ tree`);
    note(hash(res.body) === hash(fs.readFileSync(path.join(ROOT, page))), `${page} content matches checkout`);
  }
  for (const asset of ASSETS) {
    const res = await get(`${BASE}/${asset}`);
    note(res.status === 200, `GET ${asset} is 200`, `HTTP ${res.status}`);
    note(hash(res.body) === hash(fs.readFileSync(path.join(ROOT, asset))), `${asset} content matches checkout`,
      JSON.stringify({ expectedSHA256: resources.get(asset), actualSHA256: res.sha256, status: res.status, headers: res.headers }));
    if (asset.endsWith('.woff2')) note(res.type.startsWith('font/woff2'), `${asset} has WOFF2 MIME`, res.type);
  }
  for (const blocked of BLOCKED) {
    const res = await get(`${BASE}/${blocked}`);
    note(res.status === 404, `not published: ${blocked}`, `HTTP ${res.status}`);
  }

  const data = await get(`${BASE}/data/catalogue.json`);
  if (data.status === 200) {
    try {
      const catalogue = JSON.parse(data.text), sample = catalogue.models.find(model => model.images?.length)?.images[0];
      note(catalogue.models.length >= 100, `data/catalogue.json lists ${catalogue.models.length} models`);
      if (sample) {
        const image = await get(`${BASE}/${sample.smallSrc}`);
        note(image.status === 200 && image.type.startsWith('image/'), `sample catalogue image resolves: ${sample.smallSrc}`, `HTTP ${image.status} ${image.type}`);
      }
    } catch (error) { note(false, 'data/catalogue.json is valid JSON', String(error)); }
  } else note(false, 'data/catalogue.json is published', `HTTP ${data.status}`);
  const robots = await get(`${BASE}/robots.txt`);
  note(robots.text.includes('Disallow: /docs/'), 'robots.txt disallows /docs/');
  if (failures.length) {
    console.error(`\n${failures.length} smoke check(s) failed:\n${failures.map(f => `  - ${f}`).join('\n')}`);
    process.exitCode = 1; return false;
  }
  console.log(`\nDeploy smoke test passed: ${version} and report exclusions are live at ${BASE}`);
  return true;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await smoke();
