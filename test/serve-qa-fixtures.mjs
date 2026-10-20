// Local-only deterministic browser QA: node test/serve-qa-fixtures.mjs
// Serves the real app, overriding only its proxy URL. No external AI requests.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.QA_PORT || 8765);
const calls = new Map();
const prices = { brand_new: 0, recond: 15500000, used_low: 12500000, used_med: 11800000 };
const trim = name => ({ trim_name: name, powertrain: '1.5L Hybrid', fuel_economy_kml: '25', warranty_type: 'Grey', condition_prices: { ...prices } });
const single = () => ({ is_available_in_sri_lanka: true, is_multi_vehicle: false, discovered_vehicles: [], model_name: 'Toyota Yaris Cross', wikipedia_slug: 'Toyota_Yaris_Cross', availability_notes: 'Synthetic local QA result', import_route: 'Grey Import', model_years: [{ year: 2021, trims: [trim('Z Hybrid'), trim('G Hybrid')] }, { year: 2024, trims: [{ ...trim('Z'), condition_prices: { ...prices, brand_new: 18000000 } }] }] });
const discovered = () => [
  { model_name: 'Toyota Yaris Cross', year: 2024, trim_name: 'Z', powertrain: '1.5L Hybrid', condition: 'New', warranty_type: 'Grey', price_lkr: 18000000 },
  { model_name: 'Honda Vezel', year: 2024, trim_name: 'Z', powertrain: '1.5L Hybrid', condition: 'Used', warranty_type: 'Grey', price_lkr: 14000000 }
];
const types = { '.html': 'text/html', '.txt': 'text/plain', '.xml': 'application/xml', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/__proxy' && req.method === 'POST') {
    let text = ''; for await (const chunk of req) text += chunk;
    const { query = '', image } = JSON.parse(text);
    const count = (calls.get(query) || 0) + 1; calls.set(query, count);
    let data = single();
    if (/mixed/i.test(query)) data.model_years[0].trims[1].condition_prices.recond = 0;
    if (/unavailable/i.test(query)) data = { is_available_in_sri_lanka: false, reason: 'Not available in this QA fixture', alternatives: ['Toyota Yaris Cross', 'Honda Vezel'] };
    else if (/compare/i.test(query) && !/incomplete/i.test(query)) data = { ...data, is_multi_vehicle: true, discovered_vehicles: discovered() };
    if (/seller/i.test(query) || image) data = { ...data, seller_price_lkr: 12500000, detected_condition: 'Used' };
    res.setHeader('Content-Type', 'application/json');
    if (/transient/i.test(query) && count === 1) { res.writeHead(502); res.end(JSON.stringify({ error: 'upstream_unavailable', upstream_status: 503 })); return; }
    res.end(JSON.stringify(data)); return;
  }
  try {
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\//, '');
    if (!/^(?:index\.html|manifest\.json|favicon\.ico|sw\.js|robots\.txt|sitemap\.xml|(?:js|css|assets)\/)/.test(relative)) throw new Error('Not served');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) throw new Error('Outside root');
    let data = await fs.readFile(target);
    if (relative === 'index.html' && new URL(req.url, 'http://localhost').searchParams.has('qa-print')) {
      // The print palette lives in tokens.css and the print layout in style.css
      const printBlock = css => css.slice(css.indexOf('@media print {')).replace('@media print {', '@media all {');
      const printRules = printBlock(await fs.readFile(path.join(root, 'css/tokens.css'), 'utf8')) + printBlock(await fs.readFile(path.join(root, 'css/style.css'), 'utf8'));
      data = Buffer.from(data.toString().replace('</head>', `<style>${printRules}</style></head>`));
    }
    if (relative === 'js/config.js') data = Buffer.from(data.toString().replace(/proxyUrl:\s*"[^"]*"/, `proxyUrl: "http://127.0.0.1:${port}/__proxy"`));
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream'); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`QA fixture app: http://127.0.0.1:${port}`));
