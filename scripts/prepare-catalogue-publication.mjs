#!/usr/bin/env node
// Gate D: signed, deterministic price publication preparation. Never edits the checkout.
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { stageResearchedOfferPrices } from './stage-catalogue-price-research.mjs';
import { previewOfferPriceDecisions } from './catalogue-price-approval.mjs';
import { offerEvidenceStatus } from '../js/vehicle-validation.js';

const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonblank = x => typeof x === 'string' && x.trim().length > 0;
const sameKeys = (x, keys) => record(x) && Object.keys(x).sort().join('|') === [...keys].sort().join('|');
const day = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !Number.isNaN(Date.parse(x + 'T00:00:00Z')) &&
  new Date(x + 'T00:00:00Z').toISOString().slice(0, 10) === x;
const requireTrue = (ok, message) => { if (!ok) throw new Error(message); };
const sha256 = data => createHash('sha256').update(data).digest('hex');
const priceKeys = new Set(['amount','currency','kind','sourceStatus',
  'sourceUrl','checkedOn','sourcePublishedOn','evidence','note']);
const exactSortedIds = a => Array.isArray(a) && a.every(nonblank) &&
  a.length === new Set(a).size &&
  JSON.stringify(a) === JSON.stringify([...a].sort());

export function canonicalJSON(x) {
  if (Array.isArray(x)) return '[' + x.map(canonicalJSON).join(',') + ']';
  if (record(x)) return '{' + Object.keys(x).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalJSON(x[k])).join(',') + '}';
  // NaN/±Infinity serialise as "null", which would silently change signed
  // bytes. Fail closed; finite numbers keep their exact JSON formatting.
  if (typeof x === 'number' && !Number.isFinite(x)) {
    throw new TypeError('Non-finite numbers cannot be signed (' + String(x) + ')');
  }
  const data = JSON.stringify(x);
  if (data === undefined) throw new TypeError('Undefined cannot be signed');
  return data;
}
export const digestValue = x => sha256(canonicalJSON(x));

// Mirrors the Python builder's compact JS object formatting without rebuilding imagery.
export function pythonStyleJSON(x) {
  if (Array.isArray(x)) return '[' + x.map(pythonStyleJSON).join(', ') + ']';
  if (record(x)) return '{' + Object.entries(x)
    .map(([k,v]) => JSON.stringify(k) + ': ' + pythonStyleJSON(v)).join(', ') + '}';
  const result = JSON.stringify(x);
  if (result === undefined) throw new TypeError('Invalid catalogue data');
  return result;
}
export const renderCatalogueScript = (catalogue, identity) =>
  'window.__VAHANAIQ_CATALOGUE__ = ' + pythonStyleJSON(catalogue) + ';\n' +
  'window.__VAHANAIQ_IDENTITY__ = ' + pythonStyleJSON(identity) + ';\n';

const indexOffers = catalogue => {
  requireTrue(Array.isArray(catalogue?.models) && catalogue.models.length > 0,
    'Canonical catalogue has no models');
  const index = new Map();
  const modelIds = new Set();
  for (const model of catalogue.models) {
    requireTrue(nonblank(model?.id) && !modelIds.has(model.id) &&
      Array.isArray(model.offers), 'Invalid or duplicate canonical model');
    modelIds.add(model.id);
    for (const offer of model.offers) {
      requireTrue(nonblank(offer?.id) && !index.has(offer.id),
        'Invalid or duplicate canonical offer');
      index.set(offer.id, { model, offer });
    }
  }
  return index;
};


function verifyResearchAuthorisation(authorisation, trust, catalogue, identity,
  research, offerIds, asOf) {
  requireTrue(sameKeys(authorisation, ['schemaVersion','keyId','payload','signature']) &&
    authorisation.schemaVersion === 1 && nonblank(authorisation.keyId),
    'Invalid research signature envelope');
  const payload = authorisation.payload;
  requireTrue(sameKeys(payload, ['schemaVersion','purpose','researcherId','researchedOn',
    'catalogueDigest','identityDigest','researchDigest','offerIds']) &&
    payload.schemaVersion === 1 && payload.purpose === 'vahanaiq-independent-price-research' &&
    nonblank(payload.researcherId) && payload.researcherId === research.researchedBy &&
    day(payload.researchedOn) && payload.researchedOn <= asOf,
    'Invalid research identity or date');
  requireTrue(payload.catalogueDigest === digestValue(catalogue) &&
    payload.identityDigest === digestValue(identity) &&
    payload.researchDigest === digestValue(research) &&
    exactSortedIds(payload.offerIds) &&
    JSON.stringify(payload.offerIds) === JSON.stringify(offerIds),
    'Stale or incomplete signed research evidence');
  requireTrue(research.entries.every(entry => entry?.proposed?.checkedOn <= payload.researchedOn),
    'Research attestation predates evidence collection');
  requireTrue(record(trust) && trust.schemaVersion === 2 && Array.isArray(trust.researchers),
    'Missing trusted researcher registry');
  const matches = trust.researchers.filter(x => x?.keyId === authorisation.keyId);
  requireTrue(matches.length === 1 && matches[0].researcherId === payload.researcherId &&
    matches[0].enabled === true && nonblank(matches[0].publicKeyPem),
    'Research signer is not trusted and enabled');
  const signature = authorisation.signature;
  requireTrue(typeof signature === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(signature) &&
    Buffer.from(signature, 'base64').toString('base64') === signature,
    'Invalid research signature encoding');
  requireTrue(Buffer.from(signature, 'base64').length === 64,
    'Decoded Ed25519 research signature must be exactly 64 bytes');
  let verified = false;
  try {
    const key = createPublicKey(matches[0].publicKeyPem);
    verified = key.asymmetricKeyType === 'ed25519' &&
      verify(null, Buffer.from(canonicalJSON(payload)), key, Buffer.from(signature, 'base64'));
  } catch { verified = false; }
  requireTrue(verified, 'Researcher signature verification failed');
  return { payload, publicKeyPem: matches[0].publicKeyPem, keyId: matches[0].keyId };
}

function verifySignature(authorisation, trust, expected, researcher, asOf) {
  requireTrue(sameKeys(authorisation, ['schemaVersion','keyId','payload','signature']) &&
    authorisation.schemaVersion === 1 && nonblank(authorisation.keyId),
    'Invalid authorisation envelope');
  const payload = authorisation.payload;
  requireTrue(sameKeys(payload, [
    'schemaVersion','purpose','reviewerId','reviewedOn','catalogueDigest',
    'identityDigest','researchDigest','reviewDigest','researchAuthorisationDigest','offerIds','allowSourceStatusPromotionIds'
  ]) && payload.schemaVersion === 1 &&
    payload.purpose === 'vahanaiq-manual-price-publication' &&
    nonblank(payload.reviewerId) && day(payload.reviewedOn) &&
    payload.reviewedOn <= asOf, 'Invalid signed approval payload');
  for (const key of ['catalogueDigest','identityDigest','researchDigest','reviewDigest','researchAuthorisationDigest']) {
    requireTrue(typeof payload[key] === 'string' && /^[a-f0-9]{64}$/.test(payload[key]) &&
      payload[key] === expected[key], 'Invalid or stale signed ' + key);
  }
  requireTrue(exactSortedIds(payload.offerIds) && exactSortedIds(payload.allowSourceStatusPromotionIds) &&
    JSON.stringify(payload.offerIds) === JSON.stringify(expected.offerIds),
    'Signed offer selection must match the full research batch');
  requireTrue(payload.allowSourceStatusPromotionIds.every(id => payload.offerIds.includes(id)),
    'Signed status promotion list contains unknown offers');
  requireTrue(payload.reviewerId.trim().toLowerCase() !== researcher.payload.researcherId.trim().toLowerCase(),
    'Researcher and reviewer must be different');
  requireTrue(record(trust) && trust.schemaVersion === 2 && Array.isArray(trust.approvers),
    'Missing or invalid pinned reviewer registry');
  const matches = trust.approvers.filter(x => x?.keyId === authorisation.keyId);
  const fingerprint = pem => createHash('sha256').update(
    createPublicKey(pem).export({ type: 'spki', format: 'der' })).digest('hex');
  requireTrue(authorisation.keyId !== researcher.keyId &&
    !matches.some(x => fingerprint(x.publicKeyPem) === fingerprint(researcher.publicKeyPem)),
    'Research and review must use distinct trusted signing keys');
  requireTrue(matches.length === 1 && matches[0].reviewerId === payload.reviewerId &&
    matches[0].enabled === true && nonblank(matches[0].publicKeyPem),
    'Reviewer is not trusted and enabled');
  requireTrue(typeof authorisation.signature === 'string' &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(authorisation.signature) &&
    Buffer.from(authorisation.signature, 'base64').toString('base64') === authorisation.signature,
    'Invalid Ed25519 signature encoding');
  requireTrue(Buffer.from(authorisation.signature, 'base64').length === 64,
    'Decoded Ed25519 signature must be exactly 64 bytes');
  let accepted = false;
  try {
    const key = createPublicKey(matches[0].publicKeyPem);
    accepted = key.asymmetricKeyType === 'ed25519' &&
      verify(null, Buffer.from(canonicalJSON(payload)), key,
        Buffer.from(authorisation.signature, 'base64'));
  } catch { accepted = false; }
  requireTrue(accepted, 'Signed authorisation verification failed');
  return payload;
}

// Pure: signed approval permits generation of a patch for independent PR review,
// not automatic publication.
export function prepareApprovedCataloguePatch(catalogue, identity, research, reviews,
  researchAuthorisation, authorisation, trust, options = {}) {
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  requireTrue(day(asOf), 'Invalid as-of date');
  requireTrue(record(identity) && record(identity.brands) && record(identity.models),
    'Invalid identity source');
  const existing = indexOffers(catalogue);
  const staged = stageResearchedOfferPrices(catalogue, research, { asOf });
  requireTrue(staged.queue.length > 0 && staged.summary.blocked === 0 &&
    staged.summary.pendingHumanReview === staged.queue.length,
    'Gate C candidates are blocked, partial or empty');
  const gateB = {
    schemaVersion: 1, mode: 'preview-only',
    proposals: staged.queue.map(x => ({
      offerId: x.offerId, status: x.status, problems: x.problems,
      proposalFingerprint: x.proposalFingerprint, proposed: x.proposed
    }))
  };
  const review = previewOfferPriceDecisions(gateB, reviews);
  requireTrue(review.summary.manifestErrors === 0 &&
    review.summary.attestationsComplete === staged.queue.length &&
    review.results.every(x => x.status === 'attestation-complete-not-published'),
    'Every candidate needs an independent Gate B approval');
  const offerIds = staged.queue.map(x => x.offerId).sort();
  requireTrue(exactSortedIds(offerIds), 'Duplicate offer IDs');
  const researcher = verifyResearchAuthorisation(researchAuthorisation, trust,
    catalogue, identity, research, offerIds, asOf);
  const signed = verifySignature(authorisation, trust, {
    catalogueDigest: digestValue(catalogue),
    identityDigest: digestValue(identity),
    researchDigest: digestValue(research),
    reviewDigest: digestValue(reviews),
    researchAuthorisationDigest: digestValue(researchAuthorisation),
    offerIds
  }, researcher, asOf);
  requireTrue(signed.reviewedOn >= researcher.payload.researchedOn &&
    reviews.decisions.every(x => x.reviewer === signed.reviewerId &&
    x.reviewedOn === signed.reviewedOn),
    'Reviewer attestations differ from authenticated signed reviewer/date');
  for (const item of staged.queue) {
    const original = existing.get(item.offerId).offer;
    if (item.proposed.sourceStatus === 'ok' && offerEvidenceStatus(original) !== 'confirmed') {
      requireTrue(signed.allowSourceStatusPromotionIds.includes(item.offerId),
        'Unapproved verified-status promotion: ' + item.offerId);
    }
  }
  const prepared = structuredClone(catalogue);
  const target = indexOffers(prepared);
  requireTrue(target.size === existing.size, 'Offer count changed');
  for (const item of staged.queue) {
    requireTrue(Object.keys(item.proposed).length === priceKeys.size &&
      Object.keys(item.proposed).every(k => priceKeys.has(k)),
      'Proposed fields exceed the price/evidence allowlist');
    Object.assign(target.get(item.offerId).offer, item.proposed);
  }
  const nonPrice = value => Object.fromEntries(Object.entries(value)
    .filter(([key]) => !priceKeys.has(key)));
  for (const [id, old] of existing) {
    const next = target.get(id);
    requireTrue(next && next.model.id === old.model.id &&
      canonicalJSON(nonPrice(old.offer)) === canonicalJSON(nonPrice(next.offer)),
      'Offer identity, photography or non-price fields changed: ' + id);
  }
  const json = JSON.stringify(prepared, null, 2) + '\n';
  const js = renderCatalogueScript(prepared, identity);
  return {
    mode: 'manual-git-pr-only', canPublish: false,
    requiresIndependentHumanReview: true, reviewVerifiedWithTrustedKey: true,
    summary: {
      models: prepared.models.length, offers: target.size,
      updatedOffers: staged.queue.length,
      authorisedStatusPromotions: signed.allowSourceStatusPromotionIds.length
    },
    hashes: { catalogueSha256: sha256(json), scriptSha256: sha256(js) },
    files: { 'data/catalogue.json': json, 'js/catalogue-data.js': js }
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const { values } = parseArgs({ options: {
      research: { type: 'string' }, reviews: { type: 'string' },
      'research-authorisation': { type: 'string' },
      authorisation: { type: 'string' },
      emit: { type: 'boolean', default: false }
    }, strict: true });
    requireTrue(values.research && values.reviews && values['research-authorisation'] && values.authorisation,
      'Usage: --research file.json --research-authorisation researcher-signed.json --reviews file.json --authorisation reviewer-signed.json [--emit]');
    const load = file => JSON.parse(readFileSync(file, 'utf8'));
    const result = prepareApprovedCataloguePatch(
      load('data/catalogue.json'), load('data/identity.json'),
      load(values.research), load(values.reviews), load(values['research-authorisation']),
      load(values.authorisation), load('config/catalogue-publication-approvers.json'));
    const output = { mode: result.mode, canPublish: false,
      summary: result.summary, hashes: result.hashes };
    if (values.emit) {
      const dir = mkdtempSync(path.join(tmpdir(), 'vahanaiq-approved-pr-'));
      writeFileSync(path.join(dir, 'catalogue.json'), result.files['data/catalogue.json'], { flag: 'wx' });
      writeFileSync(path.join(dir, 'catalogue-data.js'), result.files['js/catalogue-data.js'], { flag: 'wx' });
      output.outputDirectory = dir;
      output.nextStep = 'Inspect both files and commit both in one protected-branch PR; never directly publish.';
    }
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  } catch (error) {
    process.stderr.write('Gate D publication preparation blocked: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
