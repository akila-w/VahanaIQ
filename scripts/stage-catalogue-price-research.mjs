#!/usr/bin/env node
// Gate C: deterministic, read-only research staging. No scraping, catalogue writes,
// review decisions, sourceStatus promotion, or publication.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { stageOfferPriceCandidates, PRICE_APPROVAL_SCHEMA } from './catalogue-price-approval.mjs';
import { offerEvidenceStatus } from '../js/vehicle-validation.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonblank = value => typeof value === 'string' && value.trim().length > 0;
const ENTRY_KEYS = new Set(['offerId', 'modelId', 'expectedFingerprint', 'proposed', 'observed']);
const OBSERVED_KEYS = new Set([
  'make', 'model', 'trim', 'year', 'condition', 'route', 'market',
  'sourceTitle', 'sourceUrl', 'sourceExcerpt', 'sourcePublishedOn',
  'checkedOn', 'conflicts'
]);
const MAX_CHECK_AGE_DAYS = 31;
const MAX_SOURCE_AGE_DAYS = 183;
const validDay = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(day.valueOf()) && day.toISOString().slice(0, 10) === value;
};
const ageDays = (before, after) => Math.round((Date.parse(after + 'T00:00:00Z') -
  Date.parse(before + 'T00:00:00Z')) / 86_400_000);
const sorted = (a, b) => String(a?.offerId ?? '').localeCompare(String(b?.offerId ?? ''));
const canonicalOffers = catalogue => {
  const index = new Map();
  for (const model of catalogue.models) {
    for (const offer of model.offers) index.set(offer.id, { model, offer });
  }
  return index;
};

// All records must explicitly refer to current curated offer IDs. Never infer an
// offer from a make/model string or legacy market catalogue listing.
export function stageResearchedOfferPrices(catalogue, manifest, options = {}) {
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  if (!validDay(asOf)) throw new TypeError('Expected a valid as-of date');
  if (!record(manifest) || manifest.schemaVersion !== PRICE_APPROVAL_SCHEMA ||
      !nonblank(manifest.researchedBy) || !Array.isArray(manifest.entries) ||
      Object.keys(manifest).some(key => !['schemaVersion', 'researchedBy', 'entries'].includes(key))) {
    throw new TypeError('Expected a version 1 research manifest with researcher and entries');
  }
  const byOffer = canonicalOffers(catalogue);
  const entries = [...manifest.entries].sort(sorted);
  const base = stageOfferPriceCandidates(catalogue, {
    schemaVersion: PRICE_APPROVAL_SCHEMA,
    candidates: entries.map(entry => ({
      offerId: entry?.offerId, modelId: entry?.modelId,
      expectedFingerprint: entry?.expectedFingerprint, proposed: entry?.proposed
    }))
  });
  const queue = entries.map((entry, i) => {
    const proposal = base.proposals[i];
    const found = byOffer.get(proposal.offerId);
    const observed = entry?.observed;
    const proposed = entry?.proposed;
    const problems = new Set(proposal.problems);
    const flags = [];
    if (!record(entry) || Object.keys(entry).some(k => !ENTRY_KEYS.has(k))) problems.add('invalid_research_fields');
    if (!record(observed) || Object.keys(observed).some(k => !OBSERVED_KEYS.has(k)) ||
        [...OBSERVED_KEYS].some(k => !Object.hasOwn(observed, k))) {
      problems.add('invalid_observation_fields');
    }
    if (found && record(observed)) {
      for (const [key, expected] of [
        ['make', found.model.make], ['model', found.model.model],
        ['trim', found.offer.trim ?? null], ['year', found.offer.year ?? null],
        ['condition', found.offer.condition ?? null], ['route', found.offer.route ?? null]
      ]) if (observed[key] !== (expected ?? null)) problems.add('observed_identity_mismatch_' + key);
    }
    if (!record(observed) || observed.market !== 'Sri Lanka') problems.add('unsupported_market');
    if (!nonblank(observed?.sourceTitle)) problems.add('missing_source_title');
    if (!nonblank(observed?.sourceExcerpt) || observed.sourceExcerpt !== proposed?.evidence) {
      problems.add('source_excerpt_mismatch');
    }
    if (nonblank(observed?.sourceExcerpt) &&
        /\b(?:another model|different model|wrong model|price mismatch|not verified|cannot be verified|unsupported price)\b/i.test(observed.sourceExcerpt)) {
      problems.add('contradictory_source_excerpt');
    }
    if (!nonblank(observed?.sourceUrl) || observed.sourceUrl !== proposed?.sourceUrl) {
      problems.add('source_url_mismatch');
    }
    if (!validDay(observed?.checkedOn) || observed.checkedOn !== proposed?.checkedOn) {
      problems.add('research_check_date_mismatch');
    } else if (ageDays(observed.checkedOn, asOf) > MAX_CHECK_AGE_DAYS ||
               ageDays(observed.checkedOn, asOf) < 0) problems.add('stale_or_future_source_check');
    if (!validDay(observed?.sourcePublishedOn) ||
        observed.sourcePublishedOn !== proposed?.sourcePublishedOn) {
      problems.add('missing_or_mismatched_source_publication');
    } else if (ageDays(observed.sourcePublishedOn, asOf) > MAX_SOURCE_AGE_DAYS ||
               ageDays(observed.sourcePublishedOn, asOf) < 0) problems.add('stale_or_future_publication');
    if (!Array.isArray(observed?.conflicts)) problems.add('missing_conflict_review');
    else if (observed.conflicts.length) problems.add('conflicting_sources');
    if (found && typeof proposed?.amount === 'number' && typeof found.offer.amount === 'number' &&
        found.offer.amount > 0 &&
        Math.abs(proposed.amount - found.offer.amount) / found.offer.amount > 0.25) {
      problems.add('price_change_over_25_percent');
    }
    if (proposed?.sourceStatus === 'ok' &&
        found && offerEvidenceStatus(found.offer) !== 'confirmed') flags.push('verification_upgrade_requires_human_review');
    if (found && proposed?.amount === found.offer.amount) flags.push('same_amount_evidence_may_have_changed');
    const issues = [...problems].sort();
    return {
      offerId: proposal.offerId, modelId: proposal.modelId,
      status: issues.length ? 'blocked' : 'pending-human-review',
      problems: issues, reviewFlags: flags,
      expectedFingerprint: proposal.expectedFingerprint,
      proposalFingerprint: proposal.proposalFingerprint,
      current: found ? {
        amount: found.offer.amount, currency: found.offer.currency,
        sourceStatus: found.offer.sourceStatus, evidenceClassification: offerEvidenceStatus(found.offer)
      } : null,
      proposed: proposal.proposed,
      observed: record(observed) ? Object.fromEntries([...OBSERVED_KEYS].map(k => [k, observed[k] ?? null])) : null
    };
  });
  return {
    schemaVersion: PRICE_APPROVAL_SCHEMA,
    mode: 'research-dry-run-only',
    canPublish: false,
    requiresIndependentHumanReview: true,
    researchedBy: manifest.researchedBy,
    asOf,
    summary: {
      total: queue.length,
      blocked: queue.filter(x => x.status === 'blocked').length,
      pendingHumanReview: queue.filter(x => x.status === 'pending-human-review').length,
      flagged: queue.filter(x => x.reviewFlags.length).length
    },
    reviewInstructions: 'Inspect source, market, model, trim, year, condition, route, amount and dates independently. No approval or price publication occurs here.',
    queue
  };
}

const cell = value => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
const amount = value => typeof value === 'number' ? 'LKR ' + value.toLocaleString('en-GB') : 'Quote / unavailable';
export function renderPriceResearchReview(report) {
  if (report?.mode !== 'research-dry-run-only' || !Array.isArray(report.queue)) {
    throw new TypeError('Expected a Gate C research report');
  }
  const lines = [
    '# Catalogue price research — Gate C dry-run',
    '',
    '**PREVIEW ONLY — NO PRICES PUBLISHED OR APPROVED.**',
    '',
    'Researcher (unverified declaration): ' + cell(report.researchedBy),
    'As of: ' + cell(report.asOf),
    '',
    '| Total | Blocked | Pending independent review | Flagged |',
    '|---:|---:|---:|---:|',
    '| ' + report.summary.total + ' | ' + report.summary.blocked + ' | ' +
      report.summary.pendingHumanReview + ' | ' + report.summary.flagged + ' |',
    ''
  ];
  for (const item of report.queue) {
    lines.push('## Offer: ' + cell(item.offerId), '',
      '- Status: **' + item.status + '**',
      '- Owner model ID: ' + cell(item.modelId),
      '- Current price: ' + amount(item.current?.amount) +
        ' (' + cell(item.current?.evidenceClassification) + ')',
      '- Proposed price: ' + amount(item.proposed?.amount) +
        ' (' + cell(item.proposed?.sourceStatus) + ' — not verified)',
      '- Source: ' + cell(item.observed?.sourceTitle) + ' — ' + cell(item.observed?.sourceUrl),
      '- Published: ' + cell(item.observed?.sourcePublishedOn) +
        '; checked: ' + cell(item.observed?.checkedOn),
      '- Evidence excerpt: ' + cell(item.observed?.sourceExcerpt),
      '- Fingerprint for independent review: ' + cell(item.proposalFingerprint),
      '- Problems: ' + cell(item.problems.join(', ') || 'none'),
      '- Review flags: ' + cell(item.reviewFlags.join(', ') || 'none'), '');
  }
  lines.push('**Human-review requirement:** ' + report.reviewInstructions, '',
    'Gate B attestation decisions require their own independently reviewed manifest.',
    'This report is not a publisher and does not create, sign or accept approval decisions.', '');
  return lines.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { values } = parseArgs({
      options: {
        'from-file': { type: 'string' },
        catalogue: { type: 'string', default: 'data/catalogue.json' },
        format: { type: 'string', default: 'markdown' },
        'as-of': { type: 'string' }
      },
      strict: true
    });
    if (!values['from-file'] || !['markdown', 'json'].includes(values.format)) {
      throw new Error('Usage: node scripts/stage-catalogue-price-research.mjs --from-file <research.json> [--catalogue data/catalogue.json] [--format markdown|json] [--as-of YYYY-MM-DD]');
    }
    const catalogue = JSON.parse(readFileSync(values.catalogue, 'utf8'));
    const manifest = JSON.parse(readFileSync(values['from-file'], 'utf8'));
    const result = stageResearchedOfferPrices(catalogue, manifest, { asOf: values['as-of'] });
    process.stdout.write(values.format === 'json' ? JSON.stringify(result, null, 2) + '\n' :
      renderPriceResearchReview(result));
  } catch (error) {
    process.stderr.write('Gate C research dry-run failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
