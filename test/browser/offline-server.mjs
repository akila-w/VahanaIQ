// A real HTTP origin per test, with no HTTP cache or external services. Serve the
// same files at / and the GitHub Pages mount; lifecycle variants only change cache
// names and a harmless boot marker, never the checked-in application files.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
const root = path.resolve(import.meta.dirname, '../..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
export async function offlineServer() {
  const state = { revision: '', previousFonts: false, previousAnchoring: false, fail: '', legacy: false, disconnected: false, requests: [] };
  const legacyWorker = await fs.readFile(path.join(root, 'test/fixtures/legacy-sw-v2.12.0.js'));
  const task031Worker = await fs.readFile(path.join(root, 'test/fixtures/task031-sw-offline3.js'));
  const task031Experience = gunzipSync(await fs.readFile(path.join(root, 'test/fixtures/task031-experience.css.gz')));
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    state.requests.push(url.pathname + url.search);
    if (state.disconnected) { req.socket.destroy(); return; }
    res.setHeader('Cache-Control', 'no-store');
    const relative = decodeURIComponent(url.pathname).replace(/^\/VahanaIQ\//, '/').replace(/^\//, '') || 'index.html';
    if (relative === '__blank.html') { res.setHeader('Content-Type', 'text/html'); res.end('<title>Install probe</title>'); return; }
    const target = path.resolve(root, relative);
    try {
      if (!target.startsWith(root + path.sep) || (state.fail && relative === state.fail)) throw Error('Unavailable');
      let data = await fs.readFile(target);
      if (state.previousAnchoring && relative === 'sw.js') data = task031Worker;
      if (state.previousAnchoring && relative === 'css/experience.css') data = task031Experience;
      if (state.previousFonts && relative === 'sw.js') data = await fs.readFile(path.join(root, 'test/fixtures/task02-sw-offline2.js'));
      if (state.previousFonts && relative === 'css/tokens.css') data = Buffer.from(data.toString().replaceAll('-variable.woff2', '-variable.ttf').replaceAll('format("woff2")', 'format("truetype")'));
      if (state.legacy && relative === 'sw.js') data = legacyWorker;
      if (state.legacy && relative === 'js/boot.js') data = Buffer.from(data.toString().split('\n// Shared by every page, including direct Catalogue')[0]);
      if (state.legacy && relative === 'js/app.js') data = Buffer.from(data.toString().replace('applyState(loadState());', `// Offline support (see sw.js); browsers without service workers simply skip it
if (typeof navigator !== \"undefined\" && \"serviceWorker\" in navigator && window.location.protocol === \"https:\") {
  navigator.serviceWorker.register(\"sw.js\").catch(e => console.warn(\"Offline support unavailable:\", e));
}

applyState(loadState());`));
      if (state.revision && relative === 'sw.js') data = Buffer.from(data.toString().replace(/(const CACHE = ")[^"]+/, `$1vahanaiq-test-${state.revision}`));
      if (relative.startsWith('js/')) data = Buffer.from(data.toString() + `\n(window.__offlineModules ||= {})[${JSON.stringify(relative)}] = ${JSON.stringify(state.revision)};`);
      if (relative === 'js/boot.js') data = Buffer.from(data.toString() + `\nwindow.__offlineRevision = ${JSON.stringify(state.revision)};`);
      res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream'); res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { state, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
