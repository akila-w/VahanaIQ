import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { baseVehicles } from '../js/market-catalogue.js';
import { auditCataloguePriceParity } from '../scripts/audit-catalogue-price-parity.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('../data/catalogue.json', import.meta.url), 'utf8'));
const actual = auditCataloguePriceParity(fixture, baseVehicles);
assert.equal(actual.mode, 'read-only');
assert.equal(actual.approvalRequired, true);
assert.equal(actual.automaticUpdates, false);
assert.equal(actual.summary.structuralErrors, 0);
assert.equal(actual.summary.curatedModels, 227);
assert.equal(actual.summary.curatedOffers, 303);
assert.equal(actual.summary.marketRecords, 277);
assert.equal(actual.summary.matchedIds, 181);
assert.equal(actual.summary.bothPriced, 76);
assert.equal(actual.summary.marketOnly, 96);
assert.equal(actual.summary.curatedOnly, 122);
assert.equal(actual.summary.availabilityDifferences, 105);
assert.equal(actual.summary.priceDifferences, 0);
assert.equal(actual.summary.multiVariantModels, 29);
assert.ok(actual.review.availabilityDifferences.some(x => x.id === 'toyota-yaris-cross-range-official' && x.marketAmount === null));
assert.ok(actual.review.multiVariantModels.some(x => x.model === 'byd seal'));
assert.equal(JSON.stringify(actual), JSON.stringify(auditCataloguePriceParity(fixture, baseVehicles)), 'Results must be deterministic');

const synthetic = { models: [{ id: 'test-model', make: 'Test', model: 'Car', offers: [
  { id: 'offer-1', amount: 1000000, currency: 'LKR', sourceStatus: 'estimated', kind: 'estimated' },
  { id: 'offer-2', amount: 2000000, currency: 'LKR', sourceStatus: 'estimated', kind: 'estimated' }
]}] };
const legacy = [
  { id: 'offer-1', make: 'Test', model: 'Car', price: 1300000, priceVerification: 'confirmed' },
  { id: 'legacy-only', make: 'Test', model: 'Car', price: null, priceVerification: 'historical' }
];
const report = auditCataloguePriceParity(synthetic, legacy);
assert.equal(report.summary.priceDifferences, 1);
assert.equal(report.summary.promotionRisks, 1);
assert.equal(report.summary.curatedOnly, 1);
assert.equal(report.summary.marketOnly, 1);
assert.equal(report.summary.multiVariantModels, 1);
assert.equal(report.review.promotionRisks[0].id, 'offer-1');
assert.equal(report.outcome, 'review-required');
assert.equal(legacy[0].priceVerification, 'confirmed', 'Audit must not mutate input records');
assert.equal(synthetic.models[0].offers[0].sourceStatus, 'estimated');
const duplicate = structuredClone(synthetic);
duplicate.models[0].offers.push({ ...duplicate.models[0].offers[0] });
assert.ok(auditCataloguePriceParity(duplicate, legacy).structuralErrors.some(x => x.code === 'duplicate_offer_id'));
const invalid = structuredClone(synthetic);
invalid.models[0].offers[0].amount = -10;
assert.ok(auditCataloguePriceParity(invalid, legacy).structuralErrors.some(x => x.code === 'invalid_curated_price'));

const output = JSON.parse(execFileSync(process.execPath, ['scripts/audit-catalogue-price-parity.mjs', '--json'], { encoding: 'utf8' }));
assert.deepEqual(output.summary, actual.summary, 'CLI JSON must agree with in-process audit');
console.log('Read-only catalogue price parity audit: PASS');
