import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { generateKeyPairSync, createPublicKey, sign } from 'node:crypto';
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
// Finite numbers keep their exact JSON formatting; non-finite values must be
// rejected instead of silently serialising as "null" inside signed digests.
assert.equal(canonicalJSON(1.5), '1.5', 'Valid finite number formatting unchanged');
assert.equal(canonicalJSON({ b: 1.5, a: -2 }), '{"a":-2,"b":1.5}',
  'Valid finite number formatting unchanged in objects');
for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  assert.throws(() => canonicalJSON(bad), /Non-finite numbers cannot be signed/,
    'Non-finite top-level value must fail canonical signing');
  assert.throws(() => canonicalJSON({ b: bad, a: 0 }), /Non-finite numbers cannot be signed/,
    'Non-finite nested value must fail canonical signing');
  assert.throws(() => digestValue({ b: bad }), /Non-finite numbers cannot be signed/,
    'Digesting non-finite values must fail');
}

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
const { publicKey: researchPublicKey, privateKey: researchPrivateKey } = generateKeyPairSync('ed25519');
const trust = { schemaVersion: 2, approvers: [{
  keyId: 'key-a', reviewerId: 'Reviewer A', enabled: true,
  publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' })
}], researchers: [{
  keyId: 'key-research', researcherId: 'Researcher B', enabled: true,
  publicKeyPem: researchPublicKey.export({ type: 'spki', format: 'pem' })
}] };
const researchPayload = {
  schemaVersion: 1, purpose: 'vahanaiq-independent-price-research',
  researcherId: 'Researcher B', researchedOn: '2026-10-30',
  catalogueDigest: digestValue(catalogue), identityDigest: digestValue(identity),
  researchDigest: digestValue(research), offerIds: [offer.id]
};
const signResearch = (body = researchPayload, key = researchPrivateKey) => ({
  schemaVersion: 1, keyId: 'key-research', payload: body,
  signature: sign(null, Buffer.from(canonicalJSON(body)), key).toString('base64')
});
const researchApproval = signResearch();
const payload = {
  schemaVersion: 1, purpose: 'vahanaiq-manual-price-publication',
  reviewerId: 'Reviewer A', reviewedOn: '2026-10-30',
  catalogueDigest: digestValue(catalogue), identityDigest: digestValue(identity),
  researchDigest: digestValue(research), reviewDigest: digestValue(reviews),
  researchAuthorisationDigest: digestValue(researchApproval),
  offerIds: [offer.id], allowSourceStatusPromotionIds: [offer.id]
};
const authorise = (body = payload, key = privateKey) => ({
  schemaVersion: 1, keyId: 'key-a', payload: body,
  signature: sign(null, Buffer.from(canonicalJSON(body)), key).toString('base64')
});
const valid = authorise();
const build = (c = catalogue, i = identity, r = research, v = reviews, a = valid, t = trust,
  ra = researchApproval) => prepareApprovedCataloguePatch(c, i, r, v, ra, a, t,
    { asOf: '2026-10-30' });
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
  { schemaVersion: 2, approvers: [], researchers: trust.researchers }), 'No trusted approvers must fail');
rejects(() => build(catalogue, identity, research, reviews, valid,
  { ...trust, approvers: [{ ...trust.approvers[0], enabled: false }] }), 'Disabled key must fail');
rejects(() => build(catalogue, identity, research, reviews,
  { ...valid, signature: Buffer.alloc(64).toString('base64') }), 'Forged signature must fail');
rejects(() => build(catalogue, identity, research, reviews, valid, trust,
  { ...researchApproval, signature: Buffer.alloc(64).toString('base64') }),
  'Forged research signature must fail');
// A decoded Ed25519 signature must be exactly 64 bytes even when the base64
// envelope itself is well-formed; shorter or longer blobs fail closed.
const resizeSignature = (base64, length) => Buffer.from(base64, 'base64')
  .subarray(0, length).toString('base64');
const extendSignature = (base64) => Buffer.concat([
  Buffer.from(base64, 'base64'), Buffer.alloc(1)
]).toString('base64');
rejects(() => build(catalogue, identity, research, reviews,
  { ...valid, signature: resizeSignature(valid.signature, 63) }),
  'Truncated (63-byte) reviewer signature must fail');
rejects(() => build(catalogue, identity, research, reviews,
  { ...valid, signature: extendSignature(valid.signature) }),
  'Extended (65-byte) reviewer signature must fail');
rejects(() => build(catalogue, identity, research, reviews, valid, trust,
  { ...researchApproval, signature: resizeSignature(researchApproval.signature, 63) }),
  'Truncated (63-byte) research signature must fail');
rejects(() => build(catalogue, identity, research, reviews, valid, trust,
  { ...researchApproval, signature: extendSignature(researchApproval.signature) }),
  'Extended (65-byte) research signature must fail');
// An approval dated before the authenticated research date is impossible and
// must fail even though every digest in the freshly signed payload is intact.
const earlyReviews = {
  schemaVersion: 1,
  decisions: [{ ...reviews.decisions[0], reviewedOn: '2026-10-29' }]
};
assert.throws(() => build(catalogue, identity, research, earlyReviews,
  authorise({ ...payload, reviewedOn: '2026-10-29',
    reviewDigest: digestValue(earlyReviews) })),
  /Reviewer attestations differ/,
  'Reviewer approval dated before authenticated research must fail');
rejects(() => build(catalogue, identity, research, reviews, valid,
  { ...trust, researchers: [] }), 'Missing trusted researcher must fail');
rejects(() => build(catalogue, identity, research, reviews, valid,
  { ...trust, researchers: [{ ...trust.researchers[0], enabled: false }] }),
  'Disabled researcher key must fail');
rejects(() => build(catalogue, identity, research, reviews, valid, trust,
  signResearch({ ...researchPayload, researcherId: 'Someone else' })),
  'Changed researcher identity must fail');
rejects(() => build(catalogue, identity, research, reviews, valid, trust,
  signResearch({ ...researchPayload, researchedOn: '2026-10-28' })),
  'Research signed before evidence collection must fail');
rejects(() => build(catalogue, identity, research, reviews, valid,
  { ...trust, approvers: [{ ...trust.approvers[0], keyId: 'key-research',
    publicKeyPem: trust.researchers[0].publicKeyPem }] }),
  'Same research and reviewer key must fail');
const sameKeyCrLf = trust.researchers[0].publicKeyPem.replaceAll('\n', '\r\n');
assert.notEqual(sameKeyCrLf, trust.researchers[0].publicKeyPem);
assert.deepEqual(
  createPublicKey(sameKeyCrLf).export({ type: 'spki', format: 'der' }),
  createPublicKey(trust.researchers[0].publicKeyPem).export({ type: 'spki', format: 'der' }),
  'Both PEM encodings must identify the same public key');
rejects(() => build(catalogue, identity, research, reviews,
  authorise(payload, researchPrivateKey),
  { ...trust, approvers: [{ ...trust.approvers[0], publicKeyPem: sameKeyCrLf }] }),
  'Different PEM encoding must not bypass same-signing-key detection');
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
// Two reviewer identities must never share one approval manifest: the signed
// authorisation binds exactly one reviewer, so every decision in the manifest
// has to come from that authenticated reviewer/date. Build a second fictional
// offer so the manifest can carry two decisions for two distinct offer IDs.
const twinOffer = {
  ...model.offers[0], id: 'example-e1-standard', name: 'Example E1 Standard',
  trim: 'Standard', amount: 12000000, evidence: 'Estimate for test offer only.'
};
const twinCatalogue = { ...catalogue,
  models: [{ ...model, offers: [model.offers[0], twinOffer] }] };
const twinProposed = {
  amount: 13000000, currency: 'LKR', kind: 'dealer', sourceStatus: 'ok',
  sourceUrl: 'https://example.invalid/twin', checkedOn: '2026-10-29',
  sourcePublishedOn: '2026-10-28', evidence: 'LKR 13,000,000 second fixture',
  note: ''
};
const twinResearch = { ...research, entries: [research.entries[0], {
  offerId: twinOffer.id, modelId: model.id,
  expectedFingerprint: fingerprintCurrentOffer(twinOffer, model),
  proposed: twinProposed,
  observed: {
    make: 'Example', model: 'E1', trim: 'Standard', year: 2026,
    condition: 'New', route: 'Distributor', market: 'Sri Lanka',
    sourceTitle: 'Second fictional fixture', sourceUrl: twinProposed.sourceUrl,
    sourceExcerpt: twinProposed.evidence, sourcePublishedOn: twinProposed.sourcePublishedOn,
    checkedOn: twinProposed.checkedOn, conflicts: []
  }
}] };
const twinStaged = stageResearchedOfferPrices(twinCatalogue, twinResearch,
  { asOf: '2026-10-30' });
assert.equal(twinStaged.summary.blocked, 0, 'Both twin candidates must stage cleanly');
assert.equal(twinStaged.queue.length, 2);
const twinIds = ['example-e1-premium', 'example-e1-standard'];
const twinResearchAuth = signResearch({ ...researchPayload,
  catalogueDigest: digestValue(twinCatalogue),
  researchDigest: digestValue(twinResearch), offerIds: twinIds });
const twinPayload = { ...payload,
  catalogueDigest: digestValue(twinCatalogue),
  researchDigest: digestValue(twinResearch),
  researchAuthorisationDigest: digestValue(twinResearchAuth),
  offerIds: twinIds, allowSourceStatusPromotionIds: twinIds };
const mismatchedReviews = { schemaVersion: 1, decisions: [
  reviews.decisions[0],
  { offerId: twinOffer.id, proposalFingerprint: twinStaged.queue[1].proposalFingerprint,
    decision: 'approved', reviewer: 'Second Reviewer', reviewedOn: '2026-10-30',
    reason: 'Independently checked the second fictional offer.', attestations }
] };
const unsharedReviews = { schemaVersion: 1, decisions: [
  reviews.decisions[0],
  { ...mismatchedReviews.decisions[1], reviewer: 'Reviewer A' }
] };
const twinAuthorisation = reviewsFor => authorise({ ...twinPayload,
  reviewDigest: digestValue(reviewsFor) });
assert.equal(build(twinCatalogue, identity, twinResearch, unsharedReviews,
  twinAuthorisation(unsharedReviews), trust, twinResearchAuth).summary.updatedOffers, 2,
  'One authenticated reviewer behind all decisions stays valid');
assert.throws(() => build(twinCatalogue, identity, twinResearch, mismatchedReviews,
  twinAuthorisation(mismatchedReviews), trust, twinResearchAuth),
  /Reviewer attestations differ/,
  'A second reviewer identity in the same approval manifest must fail');
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
assert.equal(productionTrust.schemaVersion, 2);
assert.ok(Array.isArray(productionTrust.approvers) && Array.isArray(productionTrust.researchers));
assert.ok([...productionTrust.approvers, ...productionTrust.researchers].every(x =>
  !Object.hasOwn(x, 'privateKeyPem') && !Object.hasOwn(x, 'privateKey')),
  'Never commit private key material');
assert.ok(!JSON.stringify(productionTrust).includes('key-research'), 'Test signer must not be trusted in production');
assert.throws(() => execFileSync(process.execPath,
  ['scripts/prepare-catalogue-publication.mjs'], { stdio: 'pipe' }));
console.log('Catalogue publication Gate D: PASS (signed, deterministic, no automatic publication)');
