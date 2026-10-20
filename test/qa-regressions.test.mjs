import assert from 'node:assert/strict';
import { formatMoneyText, parseMoneyText, attachMoneyInput } from '../js/money-input.js';
import { fmt } from '../js/calculator.js';
import { validPrice, vehicleBatchError, conditionPrice, validateSearchResponse } from '../js/vehicle-validation.js';
import { loadSavedCars, saveCars, COMPARISON_KEY } from '../js/storage.js';
import { searchVehicle } from '../js/gemini.js';

let assertions = 0;
const eq = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
const ok = value => { assert.ok(value); assertions++; };

for (const [input, formatted, number] of [
  ['250000', '250,000.00', 250000], ['250,000.00', '250,000.00', 250000],
  ['250000.50', '250,000.50', 250000.5], ['10,000,000.00', '10,000,000.00', 10000000],
  ['Rs. 250,000.25', '250,000.25', 250000.25], ['LKR 10000000', '10,000,000.00', 10000000],
  ['-250,000.50', '-250,000.50', -250000.5], ['0.', '0.00', 0], ['0.05', '0.05', 0.05],
  ['.5', '0.50', 0.5], ['-.5', '-0.50', -0.5]
]) {
  eq(formatMoneyText(input), formatted);
  eq(parseMoneyText(input), number);
}
for (const input of ['12,34', '250000.123', '10 million', '250,000xyz', '1e6', 'Infinity', 'NaN', '1.000,00', '', '-', '1000000000000000']) {
  ok(Number.isNaN(parseMoneyText(input)));
  eq(formatMoneyText(input), input); // Invalid input remains visible so validation can explain it.
}
for (const [number, display] of [[0, '0.00'], [-0, '0.00'], [-0.001, '0.00'], [12500000.5, '12,500,000.50'], [1234.567, '1,234.57'], [1234.564, '1,234.56']]) eq(fmt(number), display);
const handlers = {};
const input = { value: '250000', selectionStart: 6, addEventListener: (name, fn) => { handlers[name] = fn; }, setSelectionRange(a) { this.selectionStart = a; } };
attachMoneyInput(input);
eq(input.value, '250,000.00');
input.value = '250000.00'; input.selectionStart = 9; handlers.input();
eq(input.value, '250,000.00'); eq(input.selectionStart, 10);
input.value = '250000.'; input.selectionStart = 7; handlers.input();
eq(input.value, '250,000.'); eq(input.selectionStart, 8);
input.value += '5'; input.selectionStart = 9; handlers.input();
eq(input.value, '250,000.5'); handlers.blur(); eq(input.value, '250,000.50');
input.value = ''; handlers.blur(); eq(input.value, '');
input.value = '12,34'; handlers.blur(); eq(input.value, '12,34');
input.value = '12.5'; attachMoneyInput(input, { grouping: false }); handlers.blur(); eq(input.value, '12.50');

for (const price of [0, -1, NaN, Infinity, '12000000', null, 1e15]) ok(!validPrice(price));
ok(validPrice(12500000.5));
const good = { name: 'Toyota Yaris Cross', price: 12500000 };
eq(vehicleBatchError([good]), '');
ok(vehicleBatchError([good, { name: 'Honda Vezel', price: 0 }]).includes('No vehicles were added'));
const trim = { condition_prices: { brand_new: 0, recond: 15500000, used_low: 12500000 } };
ok(Number.isNaN(conditionPrice(trim, 'brand_new')));
ok(Number.isNaN(conditionPrice(trim, 'used_med'))); // No brand-new or depreciation fallback.
eq(conditionPrice(trim, 'recond'), 15500000);
eq(conditionPrice(trim, 'seller_price', 12000000), 12000000);

globalThis.localStorage = {
  data: new Map(), getItem(key) { return this.data.get(key) || null; },
  setItem(key, value) { this.data.set(key, value); }, removeItem(key) { this.data.delete(key); }
};
localStorage.setItem('sl_lease_custom_cars_v2', JSON.stringify([
  { ...good, _baseId: 0, price: 0 }, { name: 'Invalid saved vehicle', price: 0 },
  { name: 'Valid saved vehicle', price: 5000000.25 }
]));
let removed = 0;
const loaded = loadSavedCars([good], count => { removed = count; });
eq(removed, 2); eq(loaded.length, 2); eq(loaded[0].price, good.price); eq(loaded[1].price, 5000000.25);
eq(loadSavedCars([good]).length, 2);
saveCars([...loaded, { name: 'Cannot persist', price: 0, custom: true }]);
eq(JSON.parse(localStorage.getItem(COMPARISON_KEY)).cars.length, 2);

const single = { is_available_in_sri_lanka: true, model_name: 'Toyota Yaris Cross', model_years: [{ year: 2021, trims: [trim] }] };
const comparison = { ...single, is_multi_vehicle: true, discovered_vehicles: [
  { model_name: 'Toyota Yaris Cross', year: 2021, trim_name: 'Z', price_lkr: 12500000 },
  { model_name: 'Honda Vezel', year: 2021, trim_name: 'Z', price_lkr: 14000000 }
] };
eq(validateSearchResponse(single, 'Toyota Yaris Cross'), single);
assert.throws(() => validateSearchResponse(single, 'Compare Toyota Yaris Cross and Honda Vezel'), { code: 'incomplete_comparison' }); assertions++;
eq(validateSearchResponse({ ...comparison, is_multi_vehicle: false }, 'Compare Toyota and Honda').is_multi_vehicle, true);
assert.throws(() => validateSearchResponse({ ...comparison, discovered_vehicles: comparison.discovered_vehicles.map(v => ({ ...v, model_name: 'Toyota Yaris Cross' })) }, 'Compare Toyota Yaris Cross and Honda Vezel'), { code: 'incomplete_comparison' }); assertions++;
assert.throws(() => validateSearchResponse({ ...comparison, discovered_vehicles: [comparison.discovered_vehicles[0], { ...comparison.discovered_vehicles[1], price_lkr: 0 }] }, 'Compare Toyota and Honda'), /greater than zero/); assertions++;
eq(validateSearchResponse({ is_available_in_sri_lanka: false, alternatives: ['Toyota Yaris Cross'] }, 'Unavailable model').is_available_in_sri_lanka, false);

const realFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    eq(JSON.parse(init.body).comparison, true);
    if (calls === 1) return { ok: false, status: 502, json: async () => ({ error: 'upstream_unavailable', upstream_status: 503 }) };
    return { ok: true, json: async () => comparison };
  };
  eq((await searchVehicle('Compare Toyota and Honda')).discovered_vehicles.length, 2); eq(calls, 2);
  calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 502, json: async () => ({ error: 'quota' }) }; };
  await assert.rejects(searchVehicle('Toyota'), /quota/); assertions++;
  eq(calls, 1);
  calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 502, json: async () => ({ error: 'upstream_unavailable', upstream_status: 503 }) }; };
  await assert.rejects(searchVehicle('Toyota'), /upstream_unavailable/); assertions++;
  eq(calls, 2);
  globalThis.fetch = async () => ({ ok: true, json: async () => single });
  await assert.rejects(searchVehicle('Compare Toyota and Honda'), { code: 'incomplete_comparison' }); assertions++;
} finally { globalThis.fetch = realFetch; }
console.log(`QA regressions: ${assertions} assertions passed`);
