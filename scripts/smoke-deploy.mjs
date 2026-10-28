// Verify the published application and its publication boundary. The unchanged
// app version alone cannot establish that a configuration-only release is live.
// SITE_URL=http://127.0.0.1:8765 SMOKE_ATTEMPTS=1 node scripts/smoke-deploy.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.SITE_URL || 'https://akila-w.github.io/VahanaIQ').replace(/\/+$/, '');
const ATTEMPTS = Number(process.env.SMOKE_ATTEMPTS || 12);
const DELAY_MS = Number(process.env.SMOKE_DELAY_MS || 15000);
const version = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8').match(/APP_VERSION = "([^"]+)"/)?.[1];
if (!version) throw new Error('Could not read APP_VERSION from js/config.js');
const hash = body => createHash('sha256').update(body).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const reports = [...new Set([
  'Task-02-report.md', 'Task-03-report.md', 'Task-03.1-report.md',
  ...fs.readdirSync(ROOT).filter(name => /^Task-.*-report\.md$/.test(name))
])];
// Jekyll can publish both the original Markdown and a generated HTML page.
const REPORT_PATHS = reports.flatMap(name => [name, name.replace(/\.md$/, '.html')]);
const PAGES = ['catalogue.html', 'studio.html', 'about.html', 'privacy.html', 'terms.html'];
const ASSETS = [
  'css/tokens.css', 'css/style.css', 'css/style.min.css', 'css/curated-catalogue.css', 'css/catalogue-studio.css', 'js/app.js', 'js/config.js',
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
async function get(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'Cache-Control': 'no-cache' } });
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, body, text: body.toString('utf8'), type: res.headers.get('content-type') || '' };
  } catch (error) { return { status: 0, body: Buffer.alloc(0), text: '', type: '', error: String(error) }; }
}

export async function smoke() {
  const failures = [];
  const note = (ok, label, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
    if (!ok) failures.push(label);
  };
  // Wait for both the version AND the changed publication contract. A config-only
  // deployment must not silently accept the previous site's unchanged version.
  let deployed = false;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const index = await get(`${BASE}/`);
    const boundary = await Promise.all(REPORT_PATHS.map(async report => ({ report, ...(await get(`${BASE}/${report}`)) })));
    const unexpected = boundary.filter(result => result.status !== 404);
    if (index.status === 200 && index.text.includes(`app.js?v=${version}`) && !unexpected.length) { deployed = true; break; }
    console.log(`waiting for ${version} and report exclusions (attempt ${attempt}/${ATTEMPTS}, index HTTP ${index.status}; ${unexpected.map(r => `${r.report}: HTTP ${r.status}`).join(', ') || 'reports return 404'})`);
    if (attempt < ATTEMPTS) await sleep(DELAY_MS);
  }
  if (!deployed) {
    console.error(`Timed out waiting for version ${version} AND root-report 404 responses at ${BASE}`);
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
    note(hash(res.body) === hash(fs.readFileSync(path.join(ROOT, asset))), `${asset} content matches checkout`);
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
