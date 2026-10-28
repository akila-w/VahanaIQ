// A real HTTP origin per test, with no HTTP cache or external services. Serve the
// same files at / and the GitHub Pages mount; lifecycle variants only change cache
// names and a harmless boot marker, never the checked-in application files.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
export async function offlineServer() {
  const state = { revision: '', fail: '', requests: [] };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    state.requests.push(url.pathname + url.search);
    res.setHeader('Cache-Control', 'no-store');
    const relative = decodeURIComponent(url.pathname).replace(/^\/VahanaIQ\//, '/').replace(/^\//, '') || 'index.html';
    if (relative === '__blank.html') { res.setHeader('Content-Type', 'text/html'); res.end('<title>Install probe</title>'); return; }
    const target = path.resolve(root, relative);
    try {
      if (!target.startsWith(root + path.sep) || (state.fail && relative === state.fail)) throw Error('Unavailable');
      let data = await fs.readFile(target);
      if (state.revision && relative === 'sw.js') data = Buffer.from(data.toString().replace(/(const CACHE = ")[^"]+/, `$1vahanaiq-test-${state.revision}`));
      if (relative.startsWith('js/')) data = Buffer.from(data.toString() + `\n(window.__offlineModules ||= {})[${JSON.stringify(relative)}] = ${JSON.stringify(state.revision)};`);
      if (relative === 'js/boot.js') data = Buffer.from(data.toString() + `\nwindow.__offlineRevision = ${JSON.stringify(state.revision)};`);
      res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream'); res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { state, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
