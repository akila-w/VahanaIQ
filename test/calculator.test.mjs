import assert from 'node:assert/strict';
import { rental, yearlySchedule, minDownFor } from '../js/calculator.js';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

// Rs. 4,200,000 financed at 16% over 84 months
const pay = rental(4200000, 16, 84);
near(pay, 83420.67);
const years = yearlySchedule(4200000, 16, 84);
assert.equal(years.length, 7);
assert.ok(years.every(y => y.months === 12));
near(years.reduce((t, y) => t + y.principal, 0), 4200000, 0.5);
near(years.reduce((t, y) => t + y.paid, 0), pay * 84, 0.5);
near(years.at(-1).balance, 0, 0.5);
assert.ok(years[0].interest > years[6].interest, 'Interest falls as the balance is repaid');

// A tenure that is not a whole number of years ends with a shorter year
const odd = yearlySchedule(1000000, 12, 30);
assert.deepEqual(odd.map(y => y.months), [12, 12, 6]);
near(odd.at(-1).balance, 0, 0.5);

// Interest-free loans repay in equal parts
const free = yearlySchedule(1200000, 0, 12);
near(free[0].interest, 0);
near(free[0].principal, 1200000);

// Legal minimum down payments (CBSL Directions No. 01 of 2026)
assert.equal(minDownFor('Used'), 40);
assert.equal(minDownFor('New'), 60);
assert.equal(minDownFor('Recond'), 60);
assert.equal(minDownFor(null), 60, 'An unknown condition is treated as unregistered');

console.log('Calculator checks passed');

// Flat rates: the reducing-balance equivalent gives exactly the flat rental
import { flatToEffective, computeLeaseTable } from '../js/calculator.js';
const eff = flatToEffective(14, 84);
near(rental(1000000, eff, 84), 1000000 * (1 + 0.14 * 7) / 84, 0.001);
assert.ok(eff > 22 && eff < 22.5, `14% flat over 84 months is about 22.24% reducing (got ${eff})`);
near(flatToEffective(0, 60), 0);

// Each car uses its legal minimum down payment, or the chosen one if higher
const base = { rate: 16, n: 84, down: 40, income: 0, debt: 0, dti: 0.4, insurance: 0, fees: 0 };
const cars = [{ name: 'New', price: 10000000, cond: 'New' }, { name: 'Recent', price: 10000000, cond: 'Recent' }, { name: 'Used', price: 10000000, cond: 'Used' }];
const t = computeLeaseTable(cars, base);
assert.deepEqual(t.rows.map(r => r.downPct), [60, 60, 40]);
assert.deepEqual(t.rows.map(r => r.downRaised), [true, true, false]);
near(t.rows[0].dp, 6000000);
near(t.rows[2].dp, 4000000);
assert.deepEqual(computeLeaseTable(cars, { ...base, down: 70 }).rows.map(r => r.downPct), [70, 70, 70]);

// Optional costs: fees up front, insurance spread over the term, included in the personal monthly budget
const withCosts = computeLeaseTable([cars[0]], { ...base, down: 60, fees: 150000, insurance: 240000, income: 500000 }).rows[0];
const plain = computeLeaseTable([cars[0]], { ...base, down: 60, income: 500000 }).rows[0];
near(withCosts.upfront, withCosts.dp + 150000);
near(withCosts.monthlyCost, withCosts.rental + 20000);
near(withCosts.total, plain.total + 150000 + 240000 * 7);
near(withCosts.need, (withCosts.rental + 20000) / base.dti);
const tight = computeLeaseTable([cars[0]], { ...base, down: 60, insurance: 240000, income: 220000 });
assert.equal(tight.rows[0].status, 'bad');
near(tight.room, 220000 * base.dti - 20000);
assert.equal(computeLeaseTable([cars[0]], { ...base, income: 220000, dti: 0.5 }).rows[0].status, 'ok');

console.log('Flat-rate, legal down payment and extra-cost checks passed');

assert.equal(minDownFor('New', 'commercial'), 40);
assert.equal(computeLeaseTable([{ price: 20000000, cond: 'New', financeClass: 'commercial' }], base).rows[0].downPct, 40);

// An asserted "Used" condition cannot override a known recent first registration.
const today = new Date('2026-10-21T12:00:00');
assert.equal(minDownFor('Used', null, '2026-04-01', today), 60);
assert.equal(minDownFor('Used', null, '2025-10-21', today), 60);
assert.equal(minDownFor('Used', null, '2025-10-20', today), 40);
assert.equal(minDownFor('Used', null, '2026-02-30', today), 60);
assert.equal(minDownFor('Used', null, '2027-01-01', today), 60);
assert.equal(minDownFor('New', null, '2024-01-01', today), 60);
const recent = computeLeaseTable([{price: 10000000, cond: 'Used', firstRegisteredOn: '2026-10-01'}], {...base, down: 40}).rows[0];
assert.equal(recent.downPct, 60);
near(recent.loan, 4000000);
assert.equal(computeLeaseTable(cars, {...base, down: 100}).rows[0].loan, 0);

// ============================================================================
// Edge-case Hardening Verification Suite
// ============================================================================
import { num, getSettings, rateLabel } from '../js/calculator.js';

// 1. rental() division-by-zero & boundary hardening
assert.equal(rental(1000000, 16, 0), 0, 'Tenure of 0 must return 0 rental (no division by zero)');
assert.equal(rental(1000000, 0, 0), 0, '0% rate with tenure of 0 must return 0 rental');
assert.equal(rental(1000000, 16, -12), 0, 'Negative tenure must return 0 rental');
assert.equal(rental(1000000, 16, NaN), 0, 'NaN tenure must return 0 rental');
assert.equal(rental(1000000, 16, Infinity), 0, 'Infinity tenure must return 0 rental');
assert.equal(rental(0, 16, 84), 0, 'Zero loan must return 0 rental');
assert.equal(rental(-5000000, 16, 84), 0, 'Negative loan must return 0 rental');
assert.equal(rental(NaN, 16, 84), 0, 'NaN loan must return 0 rental');
assert.equal(rental(Infinity, 16, 84), 0, 'Infinity loan must return 0 rental');
near(rental(1200000, -10, 12), 100000, 0.01); // Negative rate treated as 0% interest
near(rental(1200000, NaN, 12), 100000, 0.01); // NaN rate treated as 0% interest

// 2. yearlySchedule() edge cases
assert.deepEqual(yearlySchedule(1000000, 16, 0), [], 'Tenure 0 returns empty yearly schedule');
assert.deepEqual(yearlySchedule(1000000, 16, -12), [], 'Negative tenure returns empty yearly schedule');
assert.deepEqual(yearlySchedule(1000000, 16, NaN), [], 'NaN tenure returns empty yearly schedule');
assert.deepEqual(yearlySchedule(1000000, 16, Infinity), [], 'Infinity tenure returns empty yearly schedule');
const hugeSchedule = yearlySchedule(1000000, 16, 100000);
assert.equal(hugeSchedule.length, 50, 'Huge finite tenure is safely bounded at 600 months (50 years)');
const zeroLoanSchedule = yearlySchedule(0, 16, 24);
assert.equal(zeroLoanSchedule.length, 2);
assert.equal(zeroLoanSchedule[0].paid, 0);
assert.equal(zeroLoanSchedule[0].balance, 0);
const negLoanSchedule = yearlySchedule(-1000000, 16, 12);
assert.equal(negLoanSchedule[0].paid, 0);
const negRateSchedule = yearlySchedule(1200000, -5, 12);
assert.equal(negRateSchedule[0].interest, 0);
near(negRateSchedule[0].principal, 1200000, 0.01);

// 3. flatToEffective() edge cases
assert.equal(flatToEffective(0, 60), 0);
assert.equal(flatToEffective(-5, 60), 0);
assert.equal(flatToEffective(NaN, 60), 0);
assert.equal(flatToEffective(Infinity, 60), 0);
assert.equal(flatToEffective(14, 0), 14);
assert.equal(flatToEffective(14, -10), 14);
assert.equal(flatToEffective(14, NaN), 14);

// 4. num() edge cases
assert.equal(num(0), 0);
assert.equal(num(150000), 150000);
assert.equal(num(-25000), -25000);
assert.ok(Number.isNaN(num(NaN)));
assert.ok(Number.isNaN(num(Infinity)));
assert.ok(Number.isNaN(num(-Infinity)));
assert.ok(Number.isNaN(num("Infinity")));
assert.ok(Number.isNaN(num("not_a_number")));
assert.ok(Number.isNaN(num("")));
assert.ok(Number.isNaN(num(null)));
assert.ok(Number.isNaN(num(undefined)));
assert.ok(Number.isNaN(num(1e308)), 'Huge floating point number beyond 10^15 returns NaN');
assert.equal(num("250,000"), 250000);
assert.equal(num("Rs. 1,500,000.50"), 1500000.50);

// 5. getSettings() headless fallback (when document is undefined or elements missing)
const headlessSettings = getSettings();
assert.equal(headlessSettings.rate, 16);
assert.equal(headlessSettings.rateInput, 16);
assert.equal(headlessSettings.rateType, 'reducing');
assert.equal(headlessSettings.n, 84);
assert.equal(headlessSettings.down, 60);
assert.equal(headlessSettings.income, 0);
assert.equal(headlessSettings.debt, 0);
assert.equal(headlessSettings.dti, 0.4);
assert.equal(headlessSettings.insurance, 0);
assert.equal(headlessSettings.fees, 0);

// 6. getSettings() DOM mock edge cases (NaN, Infinity, negative, very large numbers, non-numeric strings)
globalThis.document = {
  getElementById(id) {
    return this._elements[id] || null;
  },
  _elements: {
    rate: { value: '-10' },
    tenure: { value: 'Infinity' },
    down: { value: '-20' },
    income: { value: '-50000' },
    debt: { value: 'Infinity' },
    dti: { value: '-0.5' },
    rateType: { value: 'unknown_type' },
    insurance: { value: 'not_a_number' },
    fees: { value: '-100' },
    tenureHint: { textContent: '', className: '' },
    downHint: { textContent: '', className: '' }
  }
};
const hardenedSettings = getSettings();
assert.equal(hardenedSettings.rate, 16, 'Negative rate defaults to 16%');
assert.equal(hardenedSettings.n, 84, 'Infinity tenure defaults to safe 84 months');
assert.equal(hardenedSettings.down, 40, 'Negative down payment clamps to statutory 40% floor');
assert.equal(hardenedSettings.income, 0, 'Negative income defaults to 0');
assert.equal(hardenedSettings.debt, 0, 'Infinity debt defaults to 0');
assert.equal(hardenedSettings.dti, 0.4, 'Negative DTI defaults to 0.4');
assert.equal(hardenedSettings.rateType, 'reducing', 'Unknown rateType defaults to reducing');
assert.equal(hardenedSettings.insurance, 0, 'Non-numeric insurance defaults to 0');
assert.equal(hardenedSettings.fees, 0, 'Negative fees default to 0');

// Test very large numbers in DOM
document._elements.rate.value = '9999';
document._elements.tenure.value = '500';
document._elements.down.value = '350';
document._elements.income.value = '9999999999999999';
document._elements.debt.value = '9999999999999999';
const largeSettings = getSettings();
assert.equal(largeSettings.rateInput, 100, 'Extreme rate capped at 100%');
assert.equal(largeSettings.n, 84, 'Extreme tenure capped at 84 months');
assert.equal(largeSettings.down, 100, 'Extreme down payment capped at 100%');
assert.equal(largeSettings.income, 0, 'Extreme overflow income rejected to 0');
assert.equal(largeSettings.debt, 0, 'Extreme overflow debt rejected to 0');

// 7. computeLeaseTable() edge cases
assert.deepEqual(computeLeaseTable(null).rows, [], 'Null cars array returns empty rows');
assert.deepEqual(computeLeaseTable(undefined).rows, [], 'Undefined cars array returns empty rows');
const edgeCars = [
  null,
  { price: -1000000, cond: 'New' },
  { price: NaN, cond: 'Used' },
  { price: 10000000, cond: 'Used', downOverride: -5 },
  { price: 10000000, cond: 'Used', downOverride: 150 }
];
const edgeTable = computeLeaseTable(edgeCars, { ...base, dti: 0, n: 0, rate: -5 });
assert.equal(edgeTable.rows.length, 4, 'Null car filtered out');
assert.equal(edgeTable.rows[0].price, -1000000);
assert.equal(edgeTable.rows[0].loan, 0);
assert.equal(edgeTable.rows[1].price, NaN);
assert.equal(edgeTable.rows[1].loan, 0);
assert.equal(edgeTable.rows[3].downPct, 100, 'Over-100 downOverride capped at 100%');

// 8. rateLabel() edge cases
assert.equal(rateLabel(null), '');
assert.equal(rateLabel({ rateType: 'reducing', rate: 16 }), '16% a year (reducing balance)');
assert.equal(rateLabel({ rateType: 'flat', rateInput: 14, rate: 22.24 }), '14% flat (about 22.24% a year reducing balance)');
assert.equal(rateLabel({ rateType: 'flat', rateInput: NaN, rate: NaN }), '0% flat (about 0.00% a year reducing balance)');

// 9. Centralized constants and backward compatibility verification
import * as Constants from '../js/constants.js';
import * as Calculator from '../js/calculator.js';

// Verify constants values
assert.equal(Constants.DOWN_MIN, 40, 'DOWN_MIN must be 40');
assert.equal(Constants.DOWN_MIN_UNREG, 60, 'DOWN_MIN_UNREG must be 60');
assert.equal(Constants.MAX_TENURE, 84, 'MAX_TENURE must be 84');
assert.equal(Constants.MIN_TENURE, 6, 'MIN_TENURE must be 6');
assert.equal(Constants.DOWN_MAX, 100, 'DOWN_MAX must be 100');
assert.equal(Constants.DEFAULT_RATE, 16, 'DEFAULT_RATE must be 16');
assert.equal(Constants.DEFAULT_TENURE, 84, 'DEFAULT_TENURE must be 84');
assert.equal(Constants.DEFAULT_DOWN, 60, 'DEFAULT_DOWN must be 60');
assert.equal(Constants.DEFAULT_RATE_TYPE, 'reducing', 'DEFAULT_RATE_TYPE must be reducing');
assert.equal(Constants.DEFAULT_DTI, 0.4, 'DEFAULT_DTI must be 0.4');
assert.equal(Constants.DTI_STANDARD, 0.4, 'DTI_STANDARD must be 0.4');
assert.equal(Constants.DTI_STRETCH, 0.5, 'DTI_STRETCH must be 0.5');
assert.equal(Constants.DTI_MIN, 0, 'DTI_MIN must be 0');
assert.equal(Constants.DTI_MAX, 1.0, 'DTI_MAX must be 1.0');
assert.deepEqual(Constants.STRATEGY_PRESETS.LOWEST_RENTAL, { tenure: 84, down: 60, rateType: 'reducing' });
assert.deepEqual(Constants.STRATEGY_PRESETS.FAST_PAYOFF, { tenure: 36, down: 60, rateType: 'reducing' });
assert.deepEqual(Constants.STRATEGY_PRESETS.MIN_CASH, { tenure: 84, down: 40, rateType: 'reducing' });
assert.deepEqual(Constants.STRATEGY_PRESETS.CASH_PURCHASE, { down: 100 });

// Verify backward compatibility: calculator.js re-exports all constants
assert.equal(Calculator.DOWN_MIN, Constants.DOWN_MIN, 'calculator.js must re-export DOWN_MIN');
assert.equal(Calculator.DOWN_MIN_UNREG, Constants.DOWN_MIN_UNREG, 'calculator.js must re-export DOWN_MIN_UNREG');
assert.equal(Calculator.MAX_TENURE, Constants.MAX_TENURE, 'calculator.js must re-export MAX_TENURE');
assert.equal(Calculator.MIN_TENURE, Constants.MIN_TENURE, 'calculator.js must re-export MIN_TENURE');
assert.equal(Calculator.DOWN_MAX, Constants.DOWN_MAX, 'calculator.js must re-export DOWN_MAX');
assert.equal(Calculator.DEFAULT_RATE, Constants.DEFAULT_RATE, 'calculator.js must re-export DEFAULT_RATE');
assert.equal(Calculator.DEFAULT_TENURE, Constants.DEFAULT_TENURE, 'calculator.js must re-export DEFAULT_TENURE');
assert.equal(Calculator.DEFAULT_DOWN, Constants.DEFAULT_DOWN, 'calculator.js must re-export DEFAULT_DOWN');
assert.equal(Calculator.DEFAULT_DTI, Constants.DEFAULT_DTI, 'calculator.js must re-export DEFAULT_DTI');
assert.equal(Calculator.DTI_STANDARD, Constants.DTI_STANDARD, 'calculator.js must re-export DTI_STANDARD');
assert.equal(Calculator.DTI_STRETCH, Constants.DTI_STRETCH, 'calculator.js must re-export DTI_STRETCH');
assert.deepEqual(Calculator.CONDITIONS, Constants.CONDITIONS, 'calculator.js must re-export CONDITIONS');

console.log('Centralized constants checks passed');

console.log('Edge-case hardening checks passed');
