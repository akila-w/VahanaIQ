import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fingerprintCurrentOffer, stageOfferPriceCandidates, previewOfferPriceDecisions } from '../scripts/catalogue-price-approval.mjs';

const catalogue = JSON.parse(fs.readFileSync(new URL('../data/catalogue.json', import.meta.url), 'utf8'));
const original = JSON.stringify(catalogue);
const model = catalogue.models.find(m => m.offers.some(o => o.sourceStatus === 'ok' && o.evidence && o.amount));
const offer = model.offers.find(o => o.sourceStatus === 'ok' && o.evidence && o.amount);
assert.ok(model && offer);
const fields = ['amount','currency','kind','sourceStatus','sourceUrl','checkedOn','sourcePublishedOn','evidence','note'];
const proposed = Object.fromEntries(fields.map(k => [k, offer[k] ?? null]));
const item = { offerId: offer.id, modelId: model.id, expectedFingerprint: fingerprintCurrentOffer(offer), proposed };
const stage = xs => stageOfferPriceCandidates(catalogue, { schemaVersion: 1, candidates: xs });
const empty = stage([]);
assert.deepEqual(empty.summary, { total: 0, blocked: 0, pendingReview: 0 });
const ok = stage([item]);
assert.equal(ok.proposals[0].status, 'pending-human-review');
assert.equal(ok.canPublish, false);
assert.equal(ok.requiresIndependentHumanReview, true);
assert.equal(ok.proposals[0].proposedEvidenceStatus, 'confirmed');
assert.equal(JSON.stringify(catalogue), original, 'Staging cannot edit the published catalogue');

const review = decisions => previewOfferPriceDecisions(ok, { schemaVersion: 1, decisions });
assert.equal(review([]).results[0].status, 'pending-human-review');
const attestations = Object.fromEntries(['matchingModelAndTrim','matchingMarketAndCondition','matchingAmountAndCurrency',
  'sourcePageAndPublicationDate','noContradictoryEvidence'].map(key=>[key,true]));
const approve = { offerId: offer.id, proposalFingerprint: ok.proposals[0].proposalFingerprint,
  decision: 'approved', reviewer: 'Reviewer A', reviewedOn: '2026-10-30',
  reason: 'Manually inspected the matching published source and exact variant.', attestations };
assert.equal(review([approve]).results[0].status, 'attestation-complete-not-published');
assert.equal(review([approve]).canPublish, false, 'Even signed review declarations do not publish automatically');
assert.equal(review([{ ...approve, proposalFingerprint: 'f'.repeat(64) }]).results[0].status, 'review-invalid');
assert.equal(review([{ ...approve, attestations: { ...attestations, matchingAmountAndCurrency: false } }]).results[0].status, 'review-invalid');
assert.equal(review([{ ...approve, reviewedOn: '2020-01-01' }]).results[0].status, 'review-invalid');
assert.equal(review([{ ...approve, decision: 'rejected' }]).results[0].status, 'rejected');
assert.equal(review([approve, approve]).summary.manifestErrors, 1);
assert.equal(review([{ ...approve, offerId: 'no-such-offer' }]).summary.manifestErrors, 1);

const blocked = candidate => stage([candidate]).proposals[0];
assert.equal(blocked({ ...item, offerId: 'missing-id' }).status, 'blocked');
assert.ok(blocked({ ...item, modelId: 'wrong-model' }).problems.includes('wrong_model_owner'));
assert.ok(blocked({ ...item, expectedFingerprint: '0'.repeat(64) }).problems.includes('stale_or_invalid_fingerprint'));
assert.ok(blocked({ ...item, proposed: { ...proposed, amount: -1 } }).problems.includes('invalid_amount'));
assert.ok(blocked({ ...item, proposed: { ...proposed, currency: 'USD' } }).problems.includes('unsupported_currency'));
assert.ok(blocked({ ...item, proposed: { ...proposed, sourceUrl: 'http://bad.example' } }).problems.includes('invalid_https_source'));
assert.ok(blocked({ ...item, proposed: { ...proposed, note: 'The price is for another model' } }).problems.includes('contradictory_evidence'));
assert.ok(blocked({ ...item, proposed: { ...proposed, amount: 99999999 } }).problems.includes('unsupported_claim_of_source_backing'));
assert.ok(blocked({ ...item, proposed: { ...proposed, sourcePublishedOn: '2099-01-01' } }).problems.includes('publication_after_check'));
assert.ok(blocked({ ...item, proposed: { ...proposed, kind: 'quote', amount: null, sourceStatus: 'ok' } }).problems.includes('quote_amount_mismatch'));
assert.ok(blocked({ ...item, proposed: { ...proposed, kind: 'estimated', sourceStatus: 'ok' } }).problems.includes('estimate_status_mismatch'));
assert.ok(blocked({ ...item, proposed: { ...proposed, id: 'injected' } }).problems.includes('invalid_proposed_fields'));
assert.ok(blocked({ ...item, extra: 'bypass' }).problems.includes('invalid_candidate_fields'));
assert.equal(stage([item,item]).summary.blocked, 1);
assert.equal(fingerprintCurrentOffer(offer), fingerprintCurrentOffer({ ...offer, image: { changed: true } }));
assert.notEqual(fingerprintCurrentOffer(offer), fingerprintCurrentOffer({ ...offer, amount: 123 }));
assert.equal(JSON.stringify(catalogue), original);
console.log('Catalogue approval Gate B: PASS (preview-only; no published price updates)');
