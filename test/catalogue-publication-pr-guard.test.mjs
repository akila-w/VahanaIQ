// Adversarial end-to-end tests for the actual required publication PR guard.
// ALL keys and price data are ephemeral fixtures; no real vehicle price is touched.
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintCurrentOffer } from '../scripts/catalogue-price-approval.mjs';
import { stageResearchedOfferPrices } from '../scripts/stage-catalogue-price-research.mjs';
import {
  canonicalJSON, digestValue, prepareApprovedCataloguePatch,
  renderCatalogueScript
} from '../scripts/prepare-catalogue-publication.mjs';
import { verifyPublicationDiff } from '../scripts/verify-catalogue-publication-pr.mjs';

const dayOffset = delta => new Date(Date.now() + delta * 86_400_000).toISOString().slice(0, 10);
const today = dayOffset(0);
const base = {
  schemaVersion: 1, checkedOn: dayOffset(-5),
  models: [{
    id: 'fiction-e1', make: 'Fiction', model: 'E1', name: 'Fiction E1',
    images: [{ src: 'assets/images/curated-catalogue/fiction.webp' }],
    offers: [{
      id: 'fiction-e1-premium', name: 'Fiction E1 Premium',
      trim: 'Premium', year: 2026, condition: 'New', route: 'Distributor',
      fuel: 'Petrol', amount: 10000000, currency: 'LKR', kind: 'estimated',
      sourceStatus: 'estimated', sourceUrl: 'https://example.invalid/old',
      checkedOn: dayOffset(-9), sourcePublishedOn: dayOffset(-10),
      evidence: 'Estimate LKR 10,000,000', note: 'Fictional estimate'
    }]
  }]
};
const baseIdentity = { brands: { Fiction: { localPath: 'assets/identity/fiction.svg' } }, models: {} };
const model = base.models[0], offer = model.offers[0];
const proposed = {
  amount: 11000000, currency: 'LKR', kind: 'dealer', sourceStatus: 'ok',
  sourceUrl: 'https://example.invalid/new', checkedOn: dayOffset(-1),
  sourcePublishedOn: dayOffset(-2), evidence: 'Fiction E1 Premium LKR 11,000,000', note: ''
};
const research = {
  schemaVersion: 1, researchedBy: 'Fixture Researcher',
  entries: [{
    offerId: offer.id, modelId: model.id,
    expectedFingerprint: fingerprintCurrentOffer(offer, model),
    proposed,
    observed: {
      make: model.make, model: model.model, trim: offer.trim, year: offer.year,
      condition: offer.condition, route: offer.route, market: 'Sri Lanka',
      sourceTitle: 'Fictional pricing fixture', sourceUrl: proposed.sourceUrl,
      sourceExcerpt: proposed.evidence, sourcePublishedOn: proposed.sourcePublishedOn,
      checkedOn: proposed.checkedOn, conflicts: []
    }
  }]
};
const staged = stageResearchedOfferPrices(base, research, { asOf: today });
assert.equal(staged.queue[0].status, 'pending-human-review');
const flags = Object.fromEntries([
  'matchingModelAndTrim', 'matchingMarketAndCondition', 'matchingAmountAndCurrency',
  'sourcePageAndPublicationDate', 'noContradictoryEvidence'
].map(k => [k, true]));
const reviews = {
  schemaVersion: 1, decisions: [{
    offerId: offer.id, proposalFingerprint: staged.queue[0].proposalFingerprint,
    decision: 'approved', reviewer: 'Fixture Reviewer', reviewedOn: today,
    reason: 'Checked the exact fictional offer and supporting source.', attestations: flags
  }]
};
const reviewer = generateKeyPairSync('ed25519'), researcher = generateKeyPairSync('ed25519');
const pem = k => k.export({ type: 'spki', format: 'pem' });
const trust = {
  schemaVersion: 2,
  approvers: [{ keyId: 'fixture-reviewer', reviewerId: 'Fixture Reviewer',
    enabled: true, publicKeyPem: pem(reviewer.publicKey) }],
  researchers: [{ keyId: 'fixture-researcher', researcherId: 'Fixture Researcher',
    enabled: true, publicKeyPem: pem(researcher.publicKey) }]
};
const envelope = (keyId, payload, privateKey) => ({
  schemaVersion: 1, keyId, payload,
  signature: sign(null, Buffer.from(canonicalJSON(payload)), privateKey).toString('base64')
});
const researchAuth = envelope('fixture-researcher', {
  schemaVersion: 1, purpose: 'vahanaiq-independent-price-research',
  researcherId: 'Fixture Researcher', researchedOn: today,
  catalogueDigest: digestValue(base), identityDigest: digestValue(baseIdentity),
  researchDigest: digestValue(research), offerIds: [offer.id]
}, researcher.privateKey);
const reviewerAuth = envelope('fixture-reviewer', {
  schemaVersion: 1, purpose: 'vahanaiq-manual-price-publication',
  reviewerId: 'Fixture Reviewer', reviewedOn: today,
  catalogueDigest: digestValue(base), identityDigest: digestValue(baseIdentity),
  researchDigest: digestValue(research), reviewDigest: digestValue(reviews),
  researchAuthorisationDigest: digestValue(researchAuth),
  offerIds: [offer.id], allowSourceStatusPromotionIds: [offer.id]
}, reviewer.privateKey);
const bundle = {
  schemaVersion: 1, research, researchAuthorisation: researchAuth,
  reviews, authorisation: reviewerAuth
};
const result = prepareApprovedCataloguePatch(base, baseIdentity, research,
  reviews, researchAuth, reviewerAuth, trust, { asOf: today });
const DATA = 'data/catalogue.json', JS = 'js/catalogue-data.js';
const EVIDENCE = 'docs/catalogue-publication-evidence/approval-bundle.json';
const paths = [DATA, JS, EVIDENCE];
const check = (files = paths, json = result.files[DATA], js = result.files[JS],
  evidence = bundle, registry = trust, options = { asOf: today }) =>
  verifyPublicationDiff(files, base, baseIdentity, json, js, evidence, registry, options);
const blocked = (fn, label) => assert.throws(fn, /./, label);
const valid = check();
assert.equal(valid.status, 'signed-price-diff-verified');
assert.equal(valid.canPublish, false);
assert.equal(valid.summary.updatedOffers, 1);
assert.equal(check([], '', '', null, null).status, 'not-a-price-publication');
blocked(() => check([DATA]), 'Price-only publication must fail');
blocked(() => check([DATA, JS]), 'Missing evidence file must fail');
blocked(() => check([JS]), 'JS-only publication must fail');
blocked(() => check([EVIDENCE]), 'Evidence-only change must fail');
blocked(() => check([...paths, 'config/catalogue-publication-approvers.json']),
  'Price PR modifying its own trust registry must fail');
blocked(() => check([...paths, '.github/workflows/test.yml']),
  'Price PR modifying its own workflow must fail');
blocked(() => check([DATA, DATA, JS, EVIDENCE]), 'Repeated changed paths must fail');
blocked(() => check(paths, JSON.stringify(JSON.parse(result.files[DATA]))),
  'Whitespace-only catalogue byte drift must fail');
blocked(() => check(paths, result.files[DATA].replace('11000000', '11000001')),
  'Tampered numerical price must fail');
blocked(() => check(paths, result.files[DATA], result.files[JS] + '\n'),
  'Mismatched generated JS bytes must fail');
blocked(() => check(paths, result.files[DATA], renderCatalogueScript(base, baseIdentity)),
  'Old JS with new JSON must fail');
blocked(() => check(paths, result.files[DATA], result.files[JS], null),
  'Missing evidence object must fail');
blocked(() => check(paths, result.files[DATA], result.files[JS], { ...bundle, extra: 1 }),
  'Unknown bundle key must fail');
blocked(() => check(paths, result.files[DATA], result.files[JS],
  { ...bundle, authorisation: { ...reviewerAuth, signature: 'AA==' } }),
  'Forged reviewer signature must fail');
blocked(() => check(paths, result.files[DATA], result.files[JS],
  { ...bundle, researchAuthorisation: { ...researchAuth, signature: 'AA==' } }),
  'Forged researcher signature must fail');
blocked(() => check(paths, result.files[DATA], result.files[JS], bundle,
  { schemaVersion: 2, approvers: [], researchers: [] }),
  'Untrusted reviewer/researcher keys must fail');
blocked(() => check(paths, result.files[DATA], result.files[JS], bundle,
  { ...trust, approvers: [{ ...trust.approvers[0], enabled: false }] }),
  'Revoked reviewer key must fail');
blocked(() => check(paths, result.files[DATA], result.files[JS], bundle,
  { ...trust, researchers: [{ ...trust.researchers[0], enabled: false }] }),
  'Revoked researcher key must fail');
blocked(() => check(paths, result.files[DATA], result.files[JS], bundle, trust,
  { asOf: dayOffset(50) }), 'Stale sources must fail at publication time');

// The trusted workflow must re-run when a PR is edited, notably when the base
// branch is retargeted, so a passing result recorded for the original event
// cannot survive a base change; the guard then fails closed for non-default
// base refs (see the first workflow step).
assert.match(readFileSync(
  new URL('../.github/workflows/catalogue-publication-trusted.yml', import.meta.url),
  'utf8'), /types:\s*\[[^\]]*\bedited\b/,
  'Trusted workflow must re-run on edited PR events (base-branch retargeting)');

// Exercise the real CLI in disposable Git repos, not just the imported helper.
// This catches mistakes in diff-file detection, base SHA use and file loading.
const tmp = mkdtempSync(path.join(tmpdir(), 'vahanaiq-pr-guard-fixture-'));
try {
  const git = (...args) => execFileSync('git', args, {
    cwd: tmp, encoding: 'utf8', maxBuffer: 10_000_000
  }).trim();
  const write = (filename, content) => {
    const full = path.join(tmp, filename);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  };
  git('init', '-q');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'Guard Fixture');
  write(DATA, JSON.stringify(base, null, 2) + '\n');
  write(JS, renderCatalogueScript(base, baseIdentity));
  write('data/identity.json', JSON.stringify(baseIdentity, null, 2) + '\n');
  write('config/catalogue-publication-approvers.json', JSON.stringify(trust, null, 2) + '\n');
  git('add', '.');
  git('commit', '-qm', 'fixture base');
  const baseSHA = git('rev-parse', 'HEAD');
  const entry = fileURLToPath(new URL('../scripts/verify-catalogue-publication-pr.mjs', import.meta.url));
  const invoke = (env = {}) => {
    // The trusted runner identifies the event by its default-branch GITHUB_SHA;
    // a candidate variant may override any binding (an empty string forces
    // the default to be unset, modelling a missing trusted event SHA).
    const overrides = { ...env };
    const headSHA = overrides.PR_HEAD_SHA ?? git('rev-parse', 'HEAD');
    delete overrides.PR_HEAD_SHA;
    try {
      return { ok: true, stdout: execFileSync(process.execPath, [entry], {
        cwd: tmp, encoding: 'utf8', env: {
          ...process.env, GITHUB_EVENT_NAME: 'pull_request_target', PR_BASE_SHA: baseSHA,
          PR_HEAD_SHA: headSHA, GITHUB_SHA: baseSHA, ...overrides
        }
      }) };
    } catch (error) {
      return { ok: false, stderr: String(error.stderr || '') };
    }
  };
  const candidate = (edits) => {
    git('checkout', '-q', '-B', 'candidate', baseSHA);
    git('clean', '-fdq');
    for (const [filename, content] of Object.entries(edits)) {
      if (content === null) git('rm', '-q', '-f', filename);
      else write(filename, content);
    }
    git('add', '.');
    git('commit', '-qm', 'fixture candidate');
    const headSHA = git('rev-parse', 'HEAD');
    // Mirror the trusted runner: the checked-out worktree remains on the exact
    // base SHA while candidate commits exist only as fetched Git objects.
    git('checkout', '-q', '--detach', baseSHA);
    git('clean', '-fdq');
    return invoke({ PR_HEAD_SHA: headSHA });
  };
  const approved = {
    [DATA]: result.files[DATA], [JS]: result.files[JS],
    [EVIDENCE]: JSON.stringify(bundle, null, 2) + '\n'
  };
  const positive = candidate(approved);
  assert.equal(positive.ok, true, 'Valid signed price PR CLI must pass: ' + positive.stderr);
  assert.match(positive.stdout, /PASS/);
  const unsigned = candidate({ [DATA]: result.files[DATA] });
  assert.equal(unsigned.ok, false, 'Price edit without JS/evidence must fail CLI');
  assert.match(unsigned.stderr, /BLOCKED/);
  const missing = candidate({ [DATA]: result.files[DATA], [JS]: result.files[JS] });
  assert.equal(missing.ok, false, 'Missing evidence bundle must fail CLI');
  const tampered = candidate({
    ...approved, [DATA]: result.files[DATA].replace('11000000', '11000001')
  });
  assert.equal(tampered.ok, false, 'Altered price must fail CLI');
  const forged = candidate({
    ...approved, [EVIDENCE]: JSON.stringify({
      ...bundle, authorisation: { ...reviewerAuth, signature: 'AA==' }
    })
  });
  assert.equal(forged.ok, false, 'Forged reviewer signature must fail CLI');
  const extraWorkflow = candidate({
    ...approved, '.github/workflows/test.yml': '# Attempted bypass\n'
  });
  assert.equal(extraWorkflow.ok, false, 'Changes to guard workflow in price PR must fail when guard runs');
  const extraRegistry = candidate({
    ...approved, 'config/catalogue-publication-approvers.json':
      JSON.stringify({ schemaVersion: 2, approvers: [], researchers: [] })
  });
  assert.equal(extraRegistry.ok, false, 'Price PR must not substitute a trust registry');
  const nonPrice = candidate({ 'docs/maintenance-fixture.txt': 'unrelated documentation\n' });
  const legacy = candidate({ 'js/market-catalogue.js': '// changed prices\n' });
  assert.equal(legacy.ok, false, 'Unsigned legacy market price update must fail');
  assert.equal(nonPrice.ok, true, 'Unrelated PR must not require price approval');
  assert.equal(invoke({ PR_BASE_SHA: '0'.repeat(40) }).ok, false,
    'Unavailable base SHA cannot authorise price publication');
  assert.equal(invoke({ GITHUB_EVENT_NAME: 'push' }).ok, false,
    'Guard must reject untrusted event context');
  // The guard must fail closed when the trusted event, the PR base SHA and the
  // checked-out HEAD disagree, or when the trusted event SHA is missing.
  const eventMismatch = invoke({ GITHUB_SHA: git('rev-parse', 'candidate') });
  assert.equal(eventMismatch.ok, false,
    'Trusted event GITHUB_SHA must equal the PR base SHA');
  assert.match(eventMismatch.stderr, /does not equal the trusted/);
  assert.equal(invoke({ GITHUB_SHA: '' }).ok, false,
    'Missing trusted event GITHUB_SHA must fail closed');
  git('checkout', '-q', '--detach', git('rev-parse', 'candidate'));
  const headMismatch = invoke();
  assert.equal(headMismatch.ok, false,
    'Checked-out HEAD must equal the trusted default-branch GITHUB_SHA');
  assert.match(headMismatch.stderr, /Checked-out HEAD/);
  git('checkout', '-q', '--detach', baseSHA);
  // Deleting a protected catalogue file must never be treated as publication.
  const deleted = candidate({ [DATA]: null });
  assert.equal(deleted.ok, false, 'Deleting a protected catalogue file must fail closed');
  assert.match(deleted.stderr, /BLOCKED/);
  const deletedAmongApproved = candidate({
    [DATA]: null, [JS]: result.files[JS], [EVIDENCE]: JSON.stringify(bundle, null, 2) + '\n'
  });
  assert.equal(deletedAmongApproved.ok, false,
    'Deleting a protected catalogue file inside an approved-looking diff must fail closed');
  assert.match(deletedAmongApproved.stderr, /BLOCKED/);
  console.log('Catalogue approval PR guard: PASS (signed positive and adversarial CLI fixtures)');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
