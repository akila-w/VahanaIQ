import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fingerprintCurrentOffer, previewOfferPriceDecisions } from '../scripts/catalogue-price-approval.mjs';
import { stageResearchedOfferPrices, renderPriceResearchReview } from '../scripts/stage-catalogue-price-research.mjs';

const model = {
  id: 'example-e1', make: 'Example', model: 'E1', name: 'Example E1',
  offers: [{
    id: 'example-e1-premium', name: 'Example E1 Premium', trim: 'Premium',
    year: 2026, condition: 'New', route: 'Distributor', fuel: 'Petrol',
    amount: 10000000, currency: 'LKR', kind: 'estimated',
    sourceStatus: 'estimated', sourceUrl: 'https://example.invalid/old',
    checkedOn: '2026-10-21', sourcePublishedOn: '2026-10-20',
    evidence: 'Previously estimated LKR 10,000,000', note: 'Estimate for testing only.'
  }]
};
const catalogue = { schemaVersion: 1, models: [model] };
const initial = JSON.stringify(catalogue);
const offer = model.offers[0];
const proposed = {
  amount: 11000000, currency: 'LKR', kind: 'dealer', sourceStatus: 'ok',
  sourceUrl: 'https://example.invalid/new', checkedOn: '2026-10-29',
  sourcePublishedOn: '2026-10-28', evidence: 'Example E1 Premium LKR 11,000,000', note: ''
};
const entry = {
  offerId: offer.id, modelId: model.id,
  expectedFingerprint: fingerprintCurrentOffer(offer, model), proposed,
  observed: {
    make: 'Example', model: 'E1', trim: 'Premium', year: 2026,
    condition: 'New', route: 'Distributor', market: 'Sri Lanka',
    sourceTitle: 'Example price list (fictional test only)',
    sourceUrl: proposed.sourceUrl, sourceExcerpt: proposed.evidence,
    sourcePublishedOn: proposed.sourcePublishedOn, checkedOn: proposed.checkedOn,
    conflicts: []
  }
};
const manifest = entries => ({ schemaVersion: 1, researchedBy: 'Fixture researcher', entries });
const run = (entries, c = catalogue) => stageResearchedOfferPrices(c, manifest(entries), { asOf: '2026-10-30' });
const bad = (mutated, c) => run([mutated], c).queue[0];
const problem = (mutated, reason, c) =>
  assert.ok(bad(mutated, c).problems.includes(reason), reason);

const empty = run([]);
assert.deepEqual(empty.summary, { total: 0, blocked: 0, pendingHumanReview: 0, flagged: 0 });
assert.equal(empty.canPublish, false);
const ok = run([entry]);
assert.equal(ok.mode, 'research-dry-run-only');
assert.equal(ok.queue[0].status, 'pending-human-review');
assert.equal(ok.queue[0].reviewFlags[0], 'verification_upgrade_requires_human_review');
assert.equal(ok.summary.pendingHumanReview, 1);
assert.equal(ok.queue[0].proposalFingerprint.length, 64);
assert.equal(ok.canPublish, false);
assert.equal(ok.requiresIndependentHumanReview, true);
assert.equal(renderPriceResearchReview(ok).includes('NO PRICES PUBLISHED OR APPROVED'), true);
assert.equal(renderPriceResearchReview(ok).includes('example-e1-premium'), true);

const fail = (changed, reason) => problem({ ...entry, ...changed }, reason);
fail({ offerId: 'not-a-curated-id' }, 'unknown_exact_offer_id');
fail({ modelId: 'wrong-owner' }, 'wrong_model_owner');
fail({ expectedFingerprint: '0'.repeat(64) }, 'stale_or_invalid_fingerprint');
fail({ observed: { ...entry.observed, route: 'Grey' } }, 'observed_identity_mismatch_route');
fail({ observed: { ...entry.observed, trim: 'Standard' } }, 'observed_identity_mismatch_trim');
fail({ observed: { ...entry.observed, year: null } }, 'observed_identity_mismatch_year');
fail({ observed: { ...entry.observed, make: 'Different' } }, 'observed_identity_mismatch_make');
fail({ observed: { ...entry.observed, market: 'Other market' } }, 'unsupported_market');
fail({ observed: { ...entry.observed, sourceTitle: '' } }, 'missing_source_title');
fail({ observed: { ...entry.observed, sourceUrl: 'https://example.invalid/other' } }, 'source_url_mismatch');
fail({ observed: { ...entry.observed, sourceExcerpt: 'An unrelated price' } }, 'source_excerpt_mismatch');
fail({ observed: { ...entry.observed, sourceExcerpt: 'Price for another model' } }, 'contradictory_source_excerpt');
fail({ observed: { ...entry.observed, conflicts: [{ url: 'https://example.invalid/conflict' }] } }, 'conflicting_sources');
fail({ observed: { ...entry.observed, conflicts: null } }, 'missing_conflict_review');
fail({ observed: { ...entry.observed, checkedOn: '2026-08-01' } }, 'stale_or_future_source_check');
fail({ observed: { ...entry.observed, sourcePublishedOn: '2026-01-01' } }, 'stale_or_future_publication');
fail({ observed: { ...entry.observed, sourcePublishedOn: null } }, 'missing_or_mismatched_source_publication');
fail({ observed: { ...entry.observed, extra: true } }, 'invalid_observation_fields');
fail({ extra: true }, 'invalid_research_fields');
fail({ proposed: { ...proposed, amount: 13000000, evidence: 'Example E1 Premium LKR 13,000,000' },
  observed: { ...entry.observed, sourceExcerpt: 'Example E1 Premium LKR 13,000,000' } }, 'price_change_over_25_percent');
fail({ proposed: { ...proposed, currency: 'USD' } }, 'unsupported_currency');
fail({ proposed: { ...proposed, note: 'Price is for another model' } }, 'contradictory_evidence');
assert.ok(run([entry, entry]).queue.every(x => x.status === 'blocked'), 'All duplicate IDs blocked');
assert.ok(run([entry, entry]).queue.every(x => x.problems.includes('missing_or_duplicate_offer_id')));

const stale = structuredClone(catalogue);
stale.models[0].offers[0].amount += 1;
problem(entry, 'stale_or_invalid_fingerprint', stale);
const rename = structuredClone(catalogue);
rename.models[0].name = 'Renamed model';
problem(entry, 'stale_or_invalid_fingerprint', rename);

assert.equal(JSON.stringify(catalogue), initial, 'Must never mutate the curated catalogue');
assert.equal(JSON.stringify(entry.proposed), JSON.stringify(proposed), 'No mutation of research');
assert.equal(JSON.stringify(run([entry])), JSON.stringify(run([entry])), 'Reports are deterministic');
assert.throws(() => stageResearchedOfferPrices(catalogue, manifest([entry]), { asOf: 'bad' }), TypeError);
assert.throws(() => stageResearchedOfferPrices(catalogue,
  { schemaVersion: 1, researchedBy: '', entries: [] }), TypeError);

const stage = {
  schemaVersion: 1, mode: 'preview-only',
  proposals: [{
    offerId: ok.queue[0].offerId, status: 'pending-human-review',
    proposalFingerprint: ok.queue[0].proposalFingerprint, proposed
  }]
};
assert.equal(previewOfferPriceDecisions(stage, { schemaVersion: 1, decisions: [] }).canPublish, false);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanaiq-gate-c-'));
try {
  const catalogueFile = path.join(dir, 'catalogue.json');
  const researchFile = path.join(dir, 'research.json');
  fs.writeFileSync(catalogueFile, JSON.stringify(catalogue));
  fs.writeFileSync(researchFile, JSON.stringify(manifest([entry])));
  const args = ['scripts/stage-catalogue-price-research.mjs',
    '--from-file', researchFile, '--catalogue', catalogueFile, '--as-of', '2026-10-30'];
  const json = JSON.parse(execFileSync(process.execPath, [...args, '--format', 'json'], { encoding: 'utf8' }));
  assert.equal(json.summary.pendingHumanReview, 1);
  assert.equal(json.canPublish, false);
  const md = execFileSync(process.execPath, [...args, '--format', 'markdown'], { encoding: 'utf8' });
  assert.ok(md.includes('PREVIEW ONLY'));
  assert.equal(fs.readFileSync(catalogueFile, 'utf8'), JSON.stringify(catalogue));
  assert.equal(fs.readFileSync(researchFile, 'utf8'), JSON.stringify(manifest([entry])));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('Catalogue price research Gate C: PASS (dry-run only, exact IDs, independent human review)');
