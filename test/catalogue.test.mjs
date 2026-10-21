import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { baseVehicles as legacy } from '../js/catalog.js';
import { baseVehicles as catalogue } from '../js/market-catalogue.js';
import { loadSavedCars, saveCars, LEGACY_BASE_IDS, COMPARISON_KEY } from '../js/storage.js';
import { searchCatalogue } from '../js/catalogue-search.js';
import { vehicleBatchError } from '../js/vehicle-validation.js';
import { readResearch, rewriteCatalog, verifyRewrite, vetPrice } from '../scripts/refresh-prices.mjs';
import { PHOTO_CREDITS, creditFor, photoForModel, formatCreditHtml } from '../js/photo-credits.js';

globalThis.localStorage = {
  data: new Map(), getItem(k) { return this.data.get(k) ?? null; },
  setItem(k, v) { this.data.set(k, String(v)); }, removeItem(k) { this.data.delete(k); }
};
assert.deepEqual(loadSavedCars(legacy), [], 'Fresh comparison must not expand to the whole catalogue');
localStorage.setItem('sl_lease_custom_cars_v2', JSON.stringify([
  { ...legacy[0], _baseId: 0, price: 28900000.25, cond: 'Recond', custom: true },
  { ...legacy[10], _baseId: 10, hidden: true, custom: true },
  { name: 'My quoted car', price: 8750000.5, custom: true }
]));
const migrated = loadSavedCars([...legacy].reverse());
assert.equal(migrated.length, 13);
const edited = migrated.find(v => v.id === LEGACY_BASE_IDS[0]);
assert.equal(edited.name, legacy[0].name, 'Old index zero must still mean Corolla Cross after a reorder');
assert.equal(edited.price, 28900000.25);
assert.equal(edited.cond, 'Recond');
assert.equal(migrated.find(v => v.id === LEGACY_BASE_IDS[10]).hidden, true);
assert.equal(migrated.find(v => v.name === 'My quoted car').price, 8750000.5);
assert.ok(migrated.every(v => v.id && !('_baseId' in v)));
assert.deepEqual(loadSavedCars(legacy), migrated, 'Migration must be idempotent');
assert.ok(localStorage.getItem('sl_lease_custom_cars_v2'), 'Keep legacy backup during migration');

saveCars([]);
assert.deepEqual(loadSavedCars(legacy), [], 'An intentionally empty comparison must stay empty despite a v2 backup');
const selected = { ...catalogue[0], id: 'user-test', catalogueId: catalogue[0].id, price: 18765432.75, custom: true };
saveCars([selected]);
assert.equal(loadSavedCars([...legacy].reverse())[0].price, selected.price, 'Catalogue updates must not overwrite a user quote');
assert.equal(loadSavedCars([])[0].catalogueId, selected.catalogueId, 'Retired catalogue entries remain in personal comparisons');
saveCars([{ ...selected, hidden: true }]);
assert.equal(loadSavedCars(legacy)[0].hidden, true);
const saved = JSON.parse(localStorage.getItem(COMPARISON_KEY));
saved.cars.push({ name: 'Bad price', price: 0 });
localStorage.setItem(COMPARISON_KEY, JSON.stringify(saved));
let invalid = 0;
assert.equal(loadSavedCars(legacy, n => { invalid = n; }).length, 1);
assert.equal(invalid, 1);

assert.equal(new Set(catalogue.map(v => v.id)).size, catalogue.length);
assert.ok(catalogue.length >= 100, 'Guard against accidentally publishing an incomplete generated file');
for (const v of catalogue) {
  assert.match(v.id, /^[a-z0-9-]+$/);
  assert.ok(['Passenger car', 'SUV'].includes(v.body), v.name + ' is outside the requested scope');
  assert.match(v.sourceUrl, /^https:\/\//);
  assert.match(v.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(v.price === null || (Number.isFinite(v.price) && v.price > 0));
  if (v.price === null) assert.match(vehicleBatchError([v]), /greater than zero/);
  else { assert.match(v.priceSourceUrl, /^https:\/\//); assert.ok(v.trim); }
}
for (const excluded of ['Hilux', 'Hiace', 'Coaster', 'Alphard', 'Ertiga', 'XL6', 'Carnival', 'Clavis', 'Tasman', 'Triber', 'M6', 'Shark 6', 'Alza']) {
  assert.ok(!catalogue.some(v => v.model === excluded), excluded + ' must not enter this catalogue');
}
assert.ok(searchCatalogue(catalogue, 'NISSAN turbo').every(v => v.make === 'Nissan' && v.pt.includes('Turbo')));
assert.equal(searchCatalogue(catalogue, 'zz-no-such-model').length, 0);
assert.ok(searchCatalogue(catalogue, 'BYD electric').length >= 5);
const source = fs.readFileSync(new URL('../js/market-catalogue.js', import.meta.url), 'utf8');
const priced = catalogue.find(v => v.priceBasis === 'published');
const evidence = { priceCheckedMonth: '2026-11', pricePublishedMonth: '2026-10', priceSourceUrl: priced.sourceUrl };
const rewritten = rewriteCatalog(source, [[priced.id, priced.price + 10000, evidence]], '2026-11');
await verifyRewrite(source, rewritten);
assert.match(rewritten, /priceCheckedMonth: "2026-11"/);
assert.equal((rewritten.match(/price: null/g) || []).length, catalogue.filter(v => v.price === null).length);
await assert.rejects(verifyRewrite(source, rewritten.replace(`id: "${priced.id}"`, 'id: "wrong-vehicle"')), /Field id/);
assert.match(vetPrice(null, 10000000).reason, /first price needs individual review/);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanaiq-catalogue-test-'));
try {
  const file = path.join(temp, 'prices.json');
  fs.writeFileSync(file, JSON.stringify({ vehicles: [{ id: priced.id, name: 'An old display label', model_name: priced.model, prices: [] }] }));
  const research = readResearch(file, [...catalogue].reverse());
  assert.equal(research.reply.vehicles[0].query_index, [...catalogue].reverse().findIndex(v => v.id === priced.id) + 1, 'Refresh must match stable ID even after a rename and reorder');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }

// Photo credits registry & attribution tests
const creditEntries = Object.entries(PHOTO_CREDITS);
assert.ok(creditEntries.length >= 120, `Expected at least 120 photo credits, got ${creditEntries.length}`);
for (const [key, c] of creditEntries) {
  assert.ok(typeof key === 'string' && key.length > 0, 'Credit key must be non-empty');
  assert.match(c.img, /^https:\/\//, `${key}: img must be an https URL`);
  assert.ok(typeof c.author === 'string' && c.author.trim().length > 0, `${key}: author must be non-empty`);
  assert.ok(!c.licence.toUpperCase().includes('-NC'), `${key}: licence must not prohibit commercial reuse (-NC)`);
  assert.ok(!c.licence.toUpperCase().includes('NONCOMMERCIAL'), `${key}: licence must not be non-commercial`);
  assert.match(c.licence, /^(CC0(\s+1\.0)?|Public domain|CC BY(\s+[2-4]\.0)?|CC BY-SA(\s+[2-4]\.0)?)$/, `${key}: licence must be strictly CC0, Public domain, CC BY, or CC BY-SA`);
  assert.match(c.licenceUrl, /^https?:\/\//, `${key}: licenceUrl must be a valid URL`);
  assert.match(c.sourceUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, `${key}: sourceUrl must be a Wikimedia Commons File URL`);
}

// creditFor and photoForModel lookup tests
const yarisCredit = creditFor('Toyota Yaris Cross');
assert.ok(yarisCredit, 'Must find credit for Toyota Yaris Cross');
assert.equal(creditFor({ make: 'Toyota', model: 'Yaris Cross' }), yarisCredit, 'Object lookup must match string lookup');
assert.equal(photoForModel('Toyota Yaris Cross'), yarisCredit.img);
assert.equal(creditFor('Nonexistent Supercar 9000'), null, 'Unknown vehicle must return null');
assert.equal(photoForModel('Nonexistent Supercar 9000'), '', 'Unknown vehicle must return empty photo string');

// formatCreditHtml tests
const creditHtml = formatCreditHtml(yarisCredit);
assert.match(creditHtml, /^<span class="photo-credit">Photo: <a href="https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
assert.match(creditHtml, /rel="noopener noreferrer">/);
assert.equal(formatCreditHtml(null), '');
assert.equal(formatCreditHtml({}), '');

console.log(`Catalogue: ${catalogue.length} entries; photo credits: ${creditEntries.length} verified; migration, selection, source contracts, unknown prices and stable-ID refresh checks passed`);
