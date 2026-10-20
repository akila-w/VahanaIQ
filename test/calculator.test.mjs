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

// Optional costs: fees up front, insurance spread over the term, neither counted as debt
const withCosts = computeLeaseTable([cars[0]], { ...base, down: 60, fees: 150000, insurance: 240000, income: 500000 }).rows[0];
const plain = computeLeaseTable([cars[0]], { ...base, down: 60, income: 500000 }).rows[0];
near(withCosts.upfront, withCosts.dp + 150000);
near(withCosts.monthlyCost, withCosts.rental + 20000);
near(withCosts.total, plain.total + 150000 + 240000 * 7);
assert.equal(withCosts.status, plain.status, 'Insurance and fees do not change the debt-to-income status');

console.log('Flat-rate, legal down payment and extra-cost checks passed');
