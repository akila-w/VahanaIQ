import assert from 'node:assert/strict';
import { offerEvidenceStatus, representativePriceOffer } from '../js/vehicle-validation.js';
import fs from 'node:fs';

const catalogue = JSON.parse(fs.readFileSync(new URL('../data/catalogue.json', import.meta.url), 'utf8'));
const offers = catalogue.models.flatMap(model => model.offers.map(offer => ({ model: model.name, ...offer })));
const audi = offers.find(o => o.model === 'Audi A3');
assert.equal(offerEvidenceStatus(audi), 'disputed', 'Audi A3 cannot rely on an Audi Q2 source');
const estimated = offers.find(o => o.kind === 'estimated');
assert.equal(offerEvidenceStatus(estimated), 'estimated');
const valid = offers.find(o => o.sourceStatus === 'ok' && o.evidence && offerEvidenceStatus(o) === 'confirmed');
assert.ok(valid, 'At least one excerpt-backed price must remain confirmed');
assert.equal(offerEvidenceStatus(valid), 'confirmed');
assert.equal(offerEvidenceStatus({ ...valid, evidence: 'An unrelated car is LKR 123,456' }), 'unverified');
assert.equal(offerEvidenceStatus({ ...valid, sourceUrl: 'javascript:alert(1)' }), 'unverified');
assert.equal(offerEvidenceStatus({ ...valid, note: 'The linked page is for another model' }), 'disputed');
assert.equal(offerEvidenceStatus({ ...valid, amount: null }), 'unavailable');
assert.equal(representativePriceOffer([estimated, valid]), valid, 'Confirmed offers take precedence over cheaper estimates');
assert.equal(representativePriceOffer([audi, estimated]), estimated, 'Estimates must not be promoted to confirmed');
assert.equal(representativePriceOffer([]), null);

const exceptions = offers.filter(o => Number.isFinite(o.amount) && o.amount > 0 && offerEvidenceStatus(o) !== 'confirmed');
assert.ok(exceptions.length > 0, 'Audit must retain a visible review queue');
// Regression: no unsupported offer is silently elevated merely because it has a positive number.
for (const o of offers) {
  if (['estimated', 'tariff-bracket-estimate'].includes(o.sourceStatus)) assert.notEqual(offerEvidenceStatus(o), 'confirmed', o.model);
  if (/another model|not verified|could not be retrieved/i.test(o.note || '')) assert.notEqual(offerEvidenceStatus(o), 'confirmed', o.model);
}
const browser = fs.readFileSync(new URL('../js/catalogue-browser.js', import.meta.url), 'utf8');
assert.match(browser, /priceVerification: evidenceStatus === "confirmed"/);
assert.match(browser, /const publishedPrice = v => hasPrice\(v\) && v.priceVerification === "confirmed"/);
console.log('Price evidence classification: PASS; ' + exceptions.length + ' of ' + offers.length + ' offers need review.');
