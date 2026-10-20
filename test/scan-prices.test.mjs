// Price scan (scripts/scan-prices.mjs): page parsers on small pages shaped like each site's,
// matching to catalogue entries, and a prices file that refresh-prices.mjs accepts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseMg, parseGwmVehicle, gwmVehicleLinks, parseCartivate, cartivatePageCount, parseImportcar, matchListings, buildPricesFile, renderScanReport } from '../scripts/scan-prices.mjs';
import { baseVehicles } from '../js/market-catalogue.js';

// MG: price in millions, then the model name
const mg = parseMg(`<h5 class="t">Rs. 12.989</h5><p>/Million</p><a href="x">Explore</a><h5 class="t">MG ZS MCE</h5>
  <h5 class="t">Rs. 21.450</h5><p>/Million</p><h5 class="t">MG HS Hybrid+</h5>`, 'https://mgsrilanka.lk/');
assert.deepEqual(mg.map(l => [l.title, l.price, l.condition]), [['MG ZS MCE', 12989000, 'New'], ['MG HS Hybrid+', 21450000, 'New']]);

// GWM: vehicle links on the home page, and a "Driveaway from" price on each vehicle page
assert.deepEqual(gwmVehicleLinks('<a href="/vehicles/haval-h6">x</a><a href="https://www.gwmsrilanka.lk/vehicles/tank-300">y</a><a href="/vehicles/haval-h6">z</a>', 'https://www.gwmsrilanka.lk/'),
  ['https://www.gwmsrilanka.lk/vehicles/haval-h6', 'https://www.gwmsrilanka.lk/vehicles/tank-300']);
const gwm = parseGwmVehicle('<title>Haval H6</title><h1 class="main-title">Haval H6</h1><div class="price-bar"><div class="price-label">DRIVEAWAY FROM</div> <div class="price-value">LKR 19,995,000</div></div>', 'https://www.gwmsrilanka.lk/vehicles/haval-h6');
assert.deepEqual(gwm.map(l => [l.title, l.price, l.basis]), [['Haval H6', 19995000, 'starting']]);
assert.deepEqual(parseGwmVehicle('<h1>Tank 500</h1><a>Request Quotation</a>', 'u'), [], 'No price, no listing');

// Cartivate: 0 km is brand new, anything driven is used
const cart = parseCartivate(`
  <div class="card">Hatchback Toyota Taisor G Grade 2026 LKR 11,150,000 <li><span>Fuel type</span><p>Petrol</p></li><li><span>Mileage</span><p>0</p></li>
  <a title="Toyota Taisor G Grade 2026" href="https://cartivatemotors.lk/listing/taisor-g/" class="btn-listing">View Details</a></div>
  <div class="card">Toyota Raize Z Hybrid 2025 LKR 13,950,000 <span>Mileage</span><p>5000 km</p>
  <a title="Toyota Raize Z Hybrid 2025" href="https://cartivatemotors.lk/listing/raize-used/" class="btn-listing">View Details</a></div>`);
assert.deepEqual(cart.map(l => [l.title, l.price, l.mileageKm, l.condition, l.year]),
  [['Toyota Taisor G Grade 2026', 11150000, 0, 'New', 2026], ['Toyota Raize Z Hybrid 2025', 13950000, 5000, 'Used', 2025]]);
assert.equal(cartivatePageCount('<a href="/listing/page/2/">2</a><a href="/listing/page/3/">3</a>'), 3);

// importcar.lk: auction grade 4.5 is reconditioned; "brand new" grade or 0 km is new
const item = (name, ...fields) => `<h2 class="elementor-heading-title">${name}</h2><ul>${fields.map(f => `<li><span class="elementor-icon-list-text">${f}</span></li>`).join('')}</ul>`;
const ic = parseImportcar(`<h2 class="elementor-heading-title">LOWEST PRICE LIST (Updated on 08th Oct 2026)</h2>
  ${item('DAIHATSU- MIRA ES- L', 'Price : 6.4M', 'Model : LA350S L', 'Auction grade : 4.5 or up')}
  ${item('WAGON R ZL', 'Price : 8.25M', 'Auction grade : brand New')}
  ${item('WAGON R CUSTOM Z', 'Model : MH95S (HYBRID)', 'Price : 8.3M', 'Milage : 0Km', 'Year : 2025')}`, 'https://importcar.lk/');
assert.deepEqual(ic.map(l => [l.title, l.price, l.condition, l.year]),
  [['DAIHATSU MIRA ES L', 6400000, 'Recond', null], ['WAGON R ZL', 8250000, 'New', null], ['WAGON R CUSTOM Z', 8300000, 'New', 2025]]);
assert.match(ic[0].evidence, /updated on 08th Oct 2026/);

// Matching: only brand-new listings from the rule's site, lowest price first, exclusions honoured
const taisor = baseVehicles.find(v => v.id === 'toyota-urban-cruiser-taisor-range-grey');
const raize = baseVehicles.find(v => v.id === 'toyota-raize-hybrid-z-range-grey');
const tank = baseVehicles.find(v => v.id === 'gwm-tank-300-range-official');
assert.ok(taisor?.price && raize?.price && tank && !tank.price, 'fixture entries exist');
const listings = [
  { source: 'cartivate', title: 'Toyota Taisor G Grade 2026', price: 11400000, condition: 'New', url: 'https://c/1', year: 2026 },
  { source: 'cartivate', title: 'Toyota Taisor G Grade 2026 Red', price: 11200000, condition: 'New', url: 'https://c/2', year: 2026 },
  { source: 'cartivate', title: 'Toyota Taisor G Grade 2025', price: 9000000, condition: 'Used', url: 'https://c/3' },
  { source: 'cartivate', title: 'Toyota Raize Z Hybrid BSM BodyKit 2026', price: 14850000, condition: 'New', url: 'https://c/4' },
  { source: 'importcar', title: 'TOYOTA TAISOR G', price: 8000000, condition: 'New', url: 'https://i/' },
  { source: 'gwm', title: 'Tank 300', price: 33995000, condition: 'New', url: 'https://g/tank-300', basis: 'starting' },
  { source: 'cartivate', title: 'Hyundai Venue N Line 2026', price: 13550000, condition: 'New', url: 'https://c/5' }
];
const rules = [
  { id: taisor.id, source: 'cartivate', title: '\\bTaisor G( Grade)?\\b' },
  { id: raize.id, source: 'cartivate', title: '\\bRaize Z\\b.*\\bHybrid\\b', exclude: 'body ?kit' },
  { id: tank.id, source: 'gwm', title: '^Tank 300$' },
  { id: 'no-such-entry', source: 'gwm', title: 'x' }
];
const { matches, unmatched } = matchListings(rules, listings, baseVehicles);
assert.deepEqual(matches[0].found.map(l => l.price), [11200000, 11400000], 'Taisor: new listings only, cheapest first, other sites ignored');
assert.equal(matches[1].found.length, 0, 'Raize: the BodyKit listing is excluded');
assert.equal(matches[2].found[0].price, 33995000);
assert.match(matches[3].problem, /no catalogue entry/);
assert.ok(unmatched.some(l => l.title.startsWith('Hyundai Venue')), 'Unmatched listings are kept for the report');

// The prices file carries only already-priced entries; first prices go to the report
const file = buildPricesFile(matches, '2026-10-21');
assert.deepEqual(file.vehicles.map(v => v.id), [taisor.id]);
assert.equal(file.vehicles[0].prices[0].brand_new_price_lkr, 11200000);
assert.equal(file.vehicles[0].prices[0].as_of, '2026-10');
const report = renderScanReport({ date: '2026-10-21', matches, unmatched, catalogue: baseVehicles, errors: [], rules });
assert.match(report, /First prices to review[\s\S]*GWM Tank 300 \| LKR 33,995,000/);
assert.match(report, /Priced entries not listed this month[\s\S]*Toyota Raize Hybrid Z/);
assert.match(report, /Brand-new listings with no catalogue entry[\s\S]*Hyundai Venue N Line 2026/);
assert.match(report, /Not scanned, check by hand: .*Nissan Magnite/);

// refresh-prices.mjs accepts the file, keeps the exact price and applies it within ±25%
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'));
try {
  const pricesFile = path.join(temp, 'prices.json');
  fs.writeFileSync(pricesFile, JSON.stringify(file));
  const run = spawnSync(process.execPath, [new URL('../scripts/refresh-prices.mjs', import.meta.url).pathname, '--from-file', pricesFile, '--dry-run', '--month', '2026-10'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(`✓ ${taisor.name}: .* → LKR 11,200,000\\.00`), 'Exact scanned price applied');
  assert.doesNotMatch(run.stdout, /is not a catalogue vehicle name/);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('Price scan checks passed');
