// Gate B: pure staging and human-review attestation model. No file/network writes.
// The existing curated catalogue remains authoritative until Gate C is approved.
import { createHash } from 'node:crypto';
import { offerEvidenceStatus, validPrice } from '../js/vehicle-validation.js';

export const PRICE_APPROVAL_SCHEMA = 1;
const KIND = new Set(['official', 'dealer', 'launch', 'estimated', 'quote']);
const SOURCE_STATUS = new Set(['ok', 'unverified', 'estimated', 'tariff-bracket-estimate', 'quote']);
const PROPOSAL_FIELDS = new Set(['offerId', 'modelId', 'expectedFingerprint', 'proposed']);
const PRICE_FIELDS = new Set([
  'amount', 'currency', 'kind', 'sourceStatus', 'sourceUrl',
  'checkedOn', 'sourcePublishedOn', 'evidence', 'note'
]);
const SNAPSHOT_FIELDS = [
  'id', 'name', 'trim', 'year', 'condition', 'route', 'fuel',
  'amount', 'currency', 'kind', 'sourceStatus', 'sourceUrl',
  'checkedOn', 'sourcePublishedOn', 'evidence', 'note'
];
const ATTESTATIONS = [
  'matchingModelAndTrim', 'matchingMarketAndCondition',
  'matchingAmountAndCurrency', 'sourcePageAndPublicationDate',
  'noContradictoryEvidence'
];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonblank = value => typeof value === 'string' && value.trim().length > 0;
const digest = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const sorted = rows => rows.sort((a, b) => String(a.offerId).localeCompare(String(b.offerId)));
const validDay = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const httpsUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
};

// The hash locks only offer identity and provenance fields; photo edits do not
// invalidate a pending price review. Model ownership is checked separately.
export function fingerprintCurrentOffer(offer, model) {
  if (!record(offer) || !record(model) || !nonblank(model.id)) {
    throw new TypeError('Offer and owning model with an ID are required');
  }
  // Lock the owning vehicle identity as well as the offer. Model metadata
  // changes must invalidate evidence attested against an earlier variant.
  return digest([
    [model.id, model.make ?? null, model.model ?? null, model.name ?? null],
    SNAPSHOT_FIELDS.map(field => offer[field] ?? null)
  ]);
}

function canonicalIndex(catalogue) {
  if (!Array.isArray(catalogue?.models) || !catalogue.models.length) {
    throw new TypeError('Canonical catalogue must contain models');
  }
  const models = new Set();
  const offers = new Map();
  for (const model of catalogue.models) {
    if (!nonblank(model?.id) || models.has(model.id) || !Array.isArray(model.offers)) {
      throw new Error('Invalid or duplicate canonical model ID/offers');
    }
    models.add(model.id);
    for (const offer of model.offers) {
      if (!nonblank(offer?.id) || offers.has(offer.id)) throw new Error('Invalid or duplicate canonical offer ID');
      offers.set(offer.id, { offer, model });
    }
  }
  return offers;
}

function proposedPriceIssues(proposed) {
  const issues = [];
  if (!record(proposed)) return ['missing_proposed_price'];
  if (Object.keys(proposed).some(key => !PRICE_FIELDS.has(key)) ||
      [...PRICE_FIELDS].some(key => !Object.hasOwn(proposed, key))) {
    issues.push('invalid_proposed_fields');
  }
  if (!KIND.has(proposed.kind) || !SOURCE_STATUS.has(proposed.sourceStatus)) issues.push('invalid_price_classification');
  if (proposed.currency !== 'LKR') issues.push('unsupported_currency');
  if (proposed.amount !== null && !validPrice(proposed.amount)) issues.push('invalid_amount');
  if (!validDay(proposed.checkedOn)) issues.push('invalid_checked_on');
  if (proposed.sourcePublishedOn !== null && !validDay(proposed.sourcePublishedOn)) issues.push('invalid_source_published_on');
  if (validDay(proposed.checkedOn) && validDay(proposed.sourcePublishedOn) &&
      proposed.sourcePublishedOn > proposed.checkedOn) issues.push('publication_after_check');
  const today = new Date().toISOString().slice(0, 10);
  if (validDay(proposed.checkedOn) && proposed.checkedOn > today) issues.push('future_check_date');
  if (validDay(proposed.sourcePublishedOn) && proposed.sourcePublishedOn > today) issues.push('future_publication_date');
  if (!nonblank(proposed.sourceUrl) || !httpsUrl(proposed.sourceUrl)) issues.push('invalid_https_source');
  if (typeof proposed.evidence !== 'string' || typeof proposed.note !== 'string') issues.push('invalid_evidence_or_note');
  if ((proposed.amount === null) !== (proposed.kind === 'quote') ||
      (proposed.kind === 'quote') !== (proposed.sourceStatus === 'quote')) issues.push('quote_amount_mismatch');
  if (proposed.kind === 'estimated' &&
      !['estimated', 'tariff-bracket-estimate'].includes(proposed.sourceStatus)) issues.push('estimate_status_mismatch');
  if (['estimated', 'tariff-bracket-estimate'].includes(proposed.sourceStatus) &&
      proposed.kind !== 'estimated') issues.push('estimate_kind_mismatch');
  if (proposed.sourceStatus === 'ok' && !['official', 'dealer', 'launch'].includes(proposed.kind)) {
    issues.push('ok_status_kind_mismatch');
  }
  if (proposed.sourceStatus === 'ok' && offerEvidenceStatus(proposed) !== 'confirmed') {
    issues.push('unsupported_claim_of_source_backing');
  }
  if (offerEvidenceStatus(proposed) === 'disputed') issues.push('contradictory_evidence');
  return [...new Set(issues)].sort();
}

// Input is a deliberately strict manifest; no make/model guesswork, price edits,
// source scraping, promotion or persistence occurs.
export function stageOfferPriceCandidates(catalogue, manifest) {
  const index = canonicalIndex(catalogue);
  if (!record(manifest) || manifest.schemaVersion !== PRICE_APPROVAL_SCHEMA ||
      !Array.isArray(manifest.candidates)) throw new TypeError('Expected a version 1 price-candidate manifest');
  const counts = new Map();
  for (const candidate of manifest.candidates) {
    const id = typeof candidate?.offerId === 'string' ? candidate.offerId : '';
    if (nonblank(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const proposals = [];
  for (const candidate of manifest.candidates) {
    const problems = [];
    const offerId = typeof candidate?.offerId === 'string' ? candidate.offerId : '';
    const modelId = typeof candidate?.modelId === 'string' ? candidate.modelId : '';
    if (!record(candidate) || Object.keys(candidate).some(key => !PROPOSAL_FIELDS.has(key))) {
      problems.push('invalid_candidate_fields');
    }
    if (!nonblank(offerId) || (counts.get(offerId) ?? 0) > 1) problems.push('missing_or_duplicate_offer_id');
    const current = index.get(offerId);
    if (!current) problems.push('unknown_exact_offer_id');
    else if (current.model.id !== modelId) problems.push('wrong_model_owner');
    if (!/^[a-f0-9]{64}$/.test(String(candidate?.expectedFingerprint ?? '')) ||
        (current && candidate.expectedFingerprint !== fingerprintCurrentOffer(current.offer, current.model))) {
      problems.push('stale_or_invalid_fingerprint');
    }
    problems.push(...proposedPriceIssues(candidate?.proposed));
    const proposed = record(candidate?.proposed) ? candidate.proposed : null;
    const evidenceStatus = proposed ? offerEvidenceStatus(proposed) : 'unavailable';
    // A candidate never becomes "confirmed" just because the evidence classifier
    // accepts an amount in a snippet. Human review is mandatory for every change.
    proposals.push({
      offerId, modelId,
      expectedFingerprint: candidate?.expectedFingerprint ?? null,
      proposalFingerprint: digest([
        offerId, modelId, candidate?.expectedFingerprint ?? null,
        [...PRICE_FIELDS].map(key => proposed?.[key] ?? null)
      ]),
      proposedEvidenceStatus: evidenceStatus,
      status: problems.length ? 'blocked' : 'pending-human-review',
      problems: [...new Set(problems)].sort(),
      proposed: proposed ? Object.fromEntries([...PRICE_FIELDS].map(key => [key, proposed[key]])) : null
    });
  }
  sorted(proposals);
  return {
    schemaVersion: PRICE_APPROVAL_SCHEMA, mode: 'preview-only',
    canPublish: false, requiresIndependentHumanReview: true,
    summary: { total: proposals.length, blocked: proposals.filter(p => p.status === 'blocked').length,
      pendingReview: proposals.filter(p => p.status === 'pending-human-review').length },
    proposals
  };
}

// Verify structured declarations, not the truth of human identities/attestations.
// Independent review and a separate publication procedure are mandatory.
export function previewOfferPriceDecisions(staged, reviewManifest) {
  if (staged?.schemaVersion !== PRICE_APPROVAL_SCHEMA || staged.mode !== 'preview-only' ||
      !Array.isArray(staged.proposals)) throw new TypeError('Expected staged review preview');
  if (!record(reviewManifest) || reviewManifest.schemaVersion !== PRICE_APPROVAL_SCHEMA ||
      !Array.isArray(reviewManifest.decisions)) throw new TypeError('Expected version 1 review decisions');
  const decisions = new Map();
  const duplicateReviewIds = new Set();
  const errors = [];
  for (const decision of reviewManifest.decisions) {
    const id = decision?.offerId;
    if (!nonblank(id) || decisions.has(id)) {
      if (nonblank(id)) duplicateReviewIds.add(id);
      errors.push({ offerId: id ?? '', reason: 'missing_or_duplicate_review_id' });
      continue;
    }
    decisions.set(id, decision);
  }
  const validIds = new Set(staged.proposals.map(p => p.offerId));
  for (const id of decisions.keys()) if (!validIds.has(id)) errors.push({ offerId: id, reason: 'unknown_review_target' });
  const results = staged.proposals.map(proposal => {
    const decision = decisions.get(proposal.offerId);
    if (proposal.status === 'blocked') return { offerId: proposal.offerId, status: 'blocked', problems: proposal.problems };
    if (!decision) return { offerId: proposal.offerId, status: 'pending-human-review', problems: [] };
    const problems = [];
    if (duplicateReviewIds.has(proposal.offerId)) problems.push('duplicate_review_id');
    if (!['approved', 'rejected'].includes(decision.decision)) problems.push('invalid_review_decision');
    if (decision.proposalFingerprint !== proposal.proposalFingerprint) problems.push('stale_review_fingerprint');
    if (!nonblank(decision.reviewer) || !validDay(decision.reviewedOn) ||
        !nonblank(decision.reason) || decision.reason.trim().length < 10) problems.push('missing_review_record');
    if (validDay(decision.reviewedOn) && validDay(proposal.proposed?.checkedOn) &&
        decision.reviewedOn < proposal.proposed.checkedOn) problems.push('review_predates_source_check');
    if (validDay(decision.reviewedOn) &&
        decision.reviewedOn > new Date().toISOString().slice(0, 10)) problems.push('future_review_date');
    if (decision.decision === 'approved' && (!record(decision.attestations) ||
        ATTESTATIONS.some(check => decision.attestations[check] !== true))) problems.push('missing_human_evidence_attestations');
    return {
      offerId: proposal.offerId,
      status: problems.length ? 'review-invalid' :
        decision.decision === 'rejected' ? 'rejected' : 'attestation-complete-not-published',
      problems: problems.sort()
    };
  });
  return {
    schemaVersion: PRICE_APPROVAL_SCHEMA, mode: 'review-preview-only', canPublish: false,
    requiresIndependentHumanReview: true,
    summary: {
      total: results.length, attestationsComplete: results.filter(r => r.status === 'attestation-complete-not-published').length,
      pendingReview: results.filter(r => r.status === 'pending-human-review').length,
      rejected: results.filter(r => r.status === 'rejected').length,
      blockedOrInvalid: results.filter(r => ['blocked', 'review-invalid'].includes(r.status)).length,
      manifestErrors: errors.length
    },
    manifestErrors: errors.sort((a, b) => String(a.offerId).localeCompare(String(b.offerId))),
    results
  };
}
