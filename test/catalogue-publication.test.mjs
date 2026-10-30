import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { generateKeyPairSync, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fingerprintCurrentOffer } from '../scripts/catalogue-price-approval.mjs';
import { stageResearchedOfferPrices } from '../scripts/stage-catalogue-price-research.mjs';
import { prepareApprovedCataloguePatch, canonicalJSON, digestValue, renderCatalogueScript } from '../scripts/prepare-catalogue-publication.mjs';

const tracked = JSON.parse(fs.readFileSync(new URL('../data/catalogue.json', import.meta.url), 'utf8'));
const trackedIdentity = JSON.parse(fs.readFileSync(new URL('../data/identity.json', import.meta.url), 'utf8'));
const originalTracked = JSON.stringify(tracked);
const script = renderCatalogueScript(tracked, trackedIdentity);
const context = { window: {} };
vm.runInNewContext(script, context);
assert.equal(JSON.stringify(context.window.__VAHANAIQ_CATALOGUE__), JSON.stringify(tracked));
assert.equal(JSON.stringify(context.window.__VAHANAIQ_IDENTITY__), JSON.stringify(trackedIdentity));
assert.equal(canonicalJSON({ b: 2, a: [3, { z: 1, b: 2 }] }),
  '{"a":[3,{"b":2,"z":1}],"b":2}');

const model = {
  id: 'example-e1', make: 'Example', model: 'E1', name: 'Example E1',
  images: [{ src: 'assets/images/curated-catalogue/example.webp' }],
  offers: [{
    id: 'example-e1-premium', name: 'Example E1 Premium', trim: 'Premium',
    year: 2026, condition: 'New', route: 'Distributor', fuel: 'Petrol',
    amount: 10000000, currency: 'LKR', kind: 'estimated',
    sourceStatus: 'estimated', sourceUrl: 'https://example.invalid/old',
    checkedOn: '2026-10-21', sourcePublishedOn: '2026-10-20',
    evidence: 'Previously estimated LKR 10,000,000', note: 'Estimate for testing only.'
  }]
};
const catalogue = { schemaVersion: 1, checkedOn: '2026-10-25', models: [model] };
const original = JSON.stringify(catalogue);
const identity = { brands: { Example: { localPath: 'assets/identity/example.svg' } }, models: {} };
const offer = model.offers[0];
const proposed = {
  amount: 11000000, currency: 'LKR', kind: 'dealer', sourceStatus: 'ok',
  sourceUrl: 'https://example.invalid/new', checkedOn: '2026-10-29',
  sourcePublishedOn: '2026-10-28', evidence: 'Example E1 Premium LKR 11,000,000', note: ''
};
const research = {
  schemaVersion: 1, researchedBy: 'Researcher B', entries: [{
    offerId: offer.id, modelId: model.id,
    expectedFingerprint: fingerprintCurrentOffer(offer, model), proposed,
    observed: {
      make: 'Example', model: 'E1', trim: 'Premium', year: 2026,
      condition: 'New', route: 'Distributor', market: 'Sri Lanka',
      sourceTitle: 'Fictional price list', sourceUrl: proposed.sourceUrl,
      sourceExcerpt: proposed.evidence, sourcePublishedOn: proposed.sourcePublishedOn,
      checkedOn: proposed.checkedOn, conflicts: []
    }
  }]
};
const staged = stageResearchedOfferPrices(catalogue, research, { asOf: '2026-10-30' });
assert.equal(staged.queue[0].status, 'pending-human-review');
const attestations = Object.fromEntries(['matchingModelAndTrim', 'matchingMarketAndCondition',
  'matchingAmountAndCurrency', 'sourcePageAndPublicationDate',
  'noContradictoryEvidence'].map(key => [key, true]));
const reviews = {
  schemaVersion: 1, decisions: [{
    offerId: offer.id, proposalFingerprint: staged.queue[0].proposalFingerprint,
    decision: 'approved', reviewer: 'Reviewer A', reviewedOn: '2026-10-30',
    reason: 'Independently checked exact vehicle, market and matching amount.', attestations
  }]
};
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const trust = { schemaVersion: 1, approvers: [{
  keyId: 'key-a', reviewerId: 'Reviewer A', enabled: true,
  publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' })
}] };
const payload = {
  schemaVersion: 1, purpose: 'vahanaiq-manual-price-publication',
  reviewerId: 'Reviewer A', reviewedOn: '2026-10-30',
  catalogueDigest: digestValue(catalogue), identityDigest: digestValue(identity),
  researchDigest: digestValue(research), reviewDigest: digestValue(reviews),
  offerIds: [offer.id], allowSourceStatusPromotionIds: [offer.id]
};
const authorise = (body = payload, key = privateKey) => ({
  schemaVersion: 1, keyId: 'key-a', payload: body,
  signature: sign(null, Buffer.from(canonicalJSON(body)), key).toString('base64')
});
const valid = authorise();
const build = (c = catalogue, i = identity, r = research, v = reviews, a = valid, t = trust) =>
  prepareApprovedCataloguePatch(c, i, r, v, a, t, { asOf: '2026-10-30' });
const prepared = build();
assert.equal(prepared.mode, 'manual-git-pr-only');
assert.equal(prepared.canPublish, false);
assert.equal(prepared.reviewVerifiedWithTrustedKey, true);
assert.equal(prepared.summary.updatedOffers, 1);
assert.equal(prepared.summary.authorisedStatusPromotions, 1);
const changed = JSON.parse(prepared.files['data/catalogue.json']);
assert.equal(changed.models[0].offers[0].amount, 11000000);
assert.equal(changed.models[0].offers[0].sourceStatus, 'ok');
assert.deepEqual(changed.models[0].images, model.images);
assert.equal(changed.models[0].offers[0].fuel, 'Petrol');
assert.equal(JSON.stringify(catalogue), original, 'Must not mutate source');
const out = { window: {} };
vm.runInNewContext(prepared.files['js/catalogue-data.js'], out);
assert.equal(JSON.stringify(out.window.__VAHANAIQ_CATALOGUE__), JSON.stringify(changed));
assert.equal(JSON.stringify(out.window.__VAHANAIQ_IDENTITY__), JSON.stringify(identity));
assert.deepEqual(build().hashes, prepared.hashes, 'Deterministic bytes');

const rejects = (fn, msg) => assert.throws(fn, /./, msg);
rejects(() => build(catalogue, identity, research, reviews, valid,
  { schemaVersion: 1, approvers: [] }), 'No trusted approvers must fail');
rejects(() => build(catalogue, identity, research, reviews, valid,
  { schemaVersion: 1, approvers: [{ ...trust.approvers[0], enabled: false }] }), 'Disabled key must fail');
rejects(() => build(catalogue, identity, research, reviews,
  { ...valid, signature: Buffer.alloc(64).toString('base64') }), 'Forged signature must fail');
rejects(() => build(catalogue, identity, research, reviews,
  authorise({ ...payload, allowSourceStatusPromotionIds: [] })), 'Unsigned source promotion must fail');
rejects(() => build(catalogue, identity, research, reviews,
  authorise({ ...payload, offerIds: [] })), 'Incomplete ID selection must fail');
rejects(() => build(catalogue, identity, research, reviews,
  authorise({ ...payload, reviewerId: 'Researcher B' })), 'Self review must fail');
rejects(() => build(catalogue, identity, research,
  { schemaVersion: 1, decisions: [] }), 'Missing review must fail');
rejects(() => build(catalogue, identity, research,
  { schemaVersion: 1, decisions: [...reviews.decisions, ...reviews.decisions] }),
  'Duplicate approval must fail');
rejects(() => build(catalogue, identity, research,
  { schemaVersion: 1, decisions: [{ ...reviews.decisions[0], decision: 'rejected' }] }),
  'Rejected offer must fail');
rejects(() => build({ ...catalogue, checkedOn: '2026-10-26' }), 'Modified catalogue invalidates signature');
rejects(() => build(catalogue, { brands: {}, models: {} }), 'Modified identity invalidates signature');
rejects(() => build(catalogue, identity, { ...research, researchedBy: 'Different' }),
  'Modified research invalidates signature');
rejects(() => build(catalogue, identity, { ...research, entries: [research.entries[0], research.entries[0]] }),
  'Duplicates must fail');
rejects(() => build(catalogue, identity, { ...research, entries: [] }), 'Empty research must fail');
const stale = structuredClone(catalogue);
stale.models[0].offers[0].amount = 12000000;
rejects(() => build(stale), 'Stale offer fingerprint must fail');
const invalidResearch = structuredClone(research);
invalidResearch.entries[0].proposed.amount = 17000000;
invalidResearch.entries[0].proposed.evidence = 'LKR 17,000,000';
invalidResearch.entries[0].observed.sourceExcerpt = 'LKR 17,000,000';
rejects(() => build(catalogue, identity, invalidResearch), 'Over 25% changes must fail');
assert.equal(JSON.stringify(catalogue), original);
assert.equal(JSON.stringify(tracked), originalTracked);

const productionTrust = JSON.parse(fs.readFileSync(
  new URL('../config/catalogue-publication-approvers.json', import.meta.url), 'utf8'));
assert.deepEqual(productionTrust, { schemaVersion: 1, approvers: [] },
  'Production trust must not contain fixture keys.');
assert.throws(() => execFileSync(process.execPath,
  ['scripts/prepare-catalogue-publication.mjs'], { stdio: 'pipe' }));
console.log('Catalogue publication Gate D: PASS (signed, deterministic, no automatic publication)');
