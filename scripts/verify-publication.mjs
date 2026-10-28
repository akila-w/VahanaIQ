// Build fixture and output verification for the official GitHub Pages action.
// No deployment is performed. Runtime files are copied and checked byte-for-byte.
// node scripts/verify-publication.mjs prepare
// node scripts/verify-publication.mjs check qa/publication-check-XXXXXX
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPattern = /^Task-.*-report\.md$/;
const sha = body => createHash('sha256').update(body).digest('hex');
const futureReports = ['Task-2099.12-report.md', 'Task-future-extra-stage-report.md'];
const publicControl = 'Task-2099.12-report.txt';
const excludedDirectories = ['docs', 'test', 'scripts', 'serverless', 'design-system', 'qa', 'node_modules', '.github', 'data/batches'];
const excludedFiles = ['README.md', 'firestore.rules', 'package.json', 'package-lock.json', 'Gemfile', 'Gemfile.lock', '_config.yml', '.nojekyll'];
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const exists = async file => { try { await fs.access(file); return true; } catch { return false; } };

async function prepare() {
  assert.equal(await exists(path.join(ROOT, '.nojekyll')), false, 'Do not disable the Pages/Jekyll publishing boundary');
  await fs.mkdir(path.join(ROOT, 'qa'), { recursive: true });
  const work = await fs.mkdtemp(path.join(ROOT, 'qa/publication-check-'));
  const source = path.join(work, 'source'), destination = path.join(work, 'site');
  await fs.mkdir(source);
  // Include staged edits/new verification files during local development, while
  // ignored review libraries, node_modules and QA outputs never enter the fixture.
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of files) {
    const target = path.join(source, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(ROOT, file), target);
  }
  await fs.writeFile(path.join(source, futureReports[0]), '# Future task report exclusion fixture\n');
  // A front-matter-bearing report would generate HTML if it were not excluded.
  await fs.writeFile(path.join(source, futureReports[1]), '---\nlayout: null\n---\nFuture internal task report fixture.\n');
  await fs.writeFile(path.join(source, publicControl), 'Public near-match control: only Markdown task reports are excluded.\n');
  const metadata = { source: path.relative(ROOT, source), destination: path.relative(ROOT, destination), work: path.relative(ROOT, work), sourceFiles: files.length, futureReports, publicControl };
  await fs.writeFile(path.join(work, 'fixture.json'), JSON.stringify(metadata, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, Object.entries(metadata).filter(([, v]) => typeof v === 'string').map(([k, v]) => `${k}=${v}\n`).join(''));
  console.log(JSON.stringify(metadata, null, 2));
}

async function serve(site, mutation) {
  const server = http.createServer(async (req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    if (mutation?.path === relative) {
      res.writeHead(mutation.status, { 'Content-Type': mutation.type || 'text/plain' }); res.end(mutation.body || 'Publication regression fixture'); return;
    }
    const target = path.resolve(site, relative);
    try {
      if (!target.startsWith(site + path.sep)) throw Error('Outside site');
      const body = await fs.readFile(target);
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'text/plain' }); res.end(body);
    } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
async function smoke(site, mutation) {
  const server = await serve(site, mutation);
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(ROOT, 'scripts/smoke-deploy.mjs')], {
        cwd: ROOT, env: { ...process.env, SITE_URL: server.url, SMOKE_ATTEMPTS: '1', SMOKE_DELAY_MS: '0' }, stdio: ['ignore', 'pipe', 'pipe']
      });
      let log = ''; child.stdout.on('data', b => { log += b; }); child.stderr.on('data', b => { log += b; });
      child.on('error', reject); child.on('exit', code => resolve({ code, log }));
    });
  } finally { await server.close(); }
}
async function walk(directory, prefix = '') {
  const rows = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) rows.push(...await walk(path.join(directory, entry.name), relative)); else rows.push(relative);
  }
  return rows.sort();
}
async function check(argument) {
  const work = path.resolve(ROOT, argument || '');
  assert.ok(work.startsWith(path.join(ROOT, 'qa/publication-check-')), 'Check only the prepared publication fixture');
  const metadata = JSON.parse(await fs.readFile(path.join(work, 'fixture.json'), 'utf8'));
  const source = path.join(ROOT, metadata.source), site = path.join(ROOT, metadata.destination);
  const reports = (await fs.readdir(source)).filter(name => reportPattern.test(name)).sort();
  for (const name of ['Task-02-report.md', 'Task-03-report.md', 'Task-03.1-report.md', ...futureReports]) assert.ok(reports.includes(name), `Missing report fixture: ${name}`);
  for (const report of reports) for (const output of [report, report.replace(/\.md$/, '.html')]) assert.equal(await exists(path.join(site, output)), false, `Internal report was published: ${output}`);
  for (const directory of excludedDirectories) assert.equal(await exists(path.join(site, directory)), false, `Internal directory published: ${directory}`);
  for (const file of excludedFiles) assert.equal(await exists(path.join(site, file)), false, `Working file published: ${file}`);

  const sw = await fs.readFile(path.join(source, 'sw.js'), 'utf8');
  const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
  const publicFiles = [...new Set([...shell.map(file => file.split('?')[0]), 'sw.js', 'LICENSE', 'CHANGELOG.md', 'SECURITY.md', 'sitemap.xml', 'robots.txt', publicControl])];
  const hashes = [];
  for (const file of publicFiles) {
    const original = await fs.readFile(path.join(source, file)), published = await fs.readFile(path.join(site, file));
    assert.ok(original.equals(published), `Public content changed during Jekyll build: ${file}`);
    hashes.push({ file, sha256: sha(published), bytes: published.length });
  }
  const results = [];
  const cases = [
    { name: 'generated-site', mutation: null, expected: 0 },
    // Every mutation retains the correct application version marker. It must not
    // turn a stale/leaking build into a successful smoke result.
    { name: 'report-markdown-leak', mutation: { path: 'Task-03-report.md', status: 200 }, expected: 1 },
    { name: 'report-html-leak', mutation: { path: 'Task-03.1-report.html', status: 200, type: 'text/html' }, expected: 1 },
    { name: 'report-forbidden-is-not-not-found', mutation: { path: 'Task-02-report.md', status: 403 }, expected: 1 },
    { name: 'stale-stylesheet-with-unchanged-version', mutation: { path: 'css/tokens.css', status: 200, type: 'text/css', body: '/* Deliberately stale fixture */' }, expected: 1 }
  ];
  for (const entry of cases) {
    const result = await smoke(site, entry.mutation);
    await fs.writeFile(path.join(work, `${entry.name}.log`), result.log);
    assert.equal(result.code, entry.expected, `${entry.name}: expected exit ${entry.expected}, got ${result.code}\n${result.log}`);
    results.push({ name: entry.name, expectedExit: entry.expected, actualExit: result.code });
  }
  const result = { verdict: 'PASS', reportsAbsent: reports.flatMap(file => [file, file.replace(/\.md$/, '.html')]), futureReports, publicNearMatchRetained: publicControl,
    excludedDirectories, excludedFiles, runtimeShellFiles: shell.length, publicFilesUnchanged: hashes, smokeRegressions: results, publishedFiles: await walk(site) };
  await fs.writeFile(path.join(work, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`PASS: ${reports.length} report sources and their HTML outputs absent, ${shell.length} shell files unchanged, ${results.length} smoke regression controls passed`);
}
if (process.argv[2] === 'prepare') await prepare();
else if (process.argv[2] === 'check') await check(process.argv[3]);
else throw new Error('Use prepare, or check <prepared-work-directory>');
