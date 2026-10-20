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
