// Read-only audit of the two price catalogues. No proposed updates are applied.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { baseVehicles } from '../js/market-catalogue.js';
import { offerEvidenceStatus, validPrice } from '../js/vehicle-validation.js';

const idOrder = (a, b) => a.id.localeCompare(b.id);
const label = value => typeof value === 'string' ? value.trim() : '';
const modelKey = (make, model) => (label(make) + ' ' + label(model)).trim().toLowerCase().replace(/\s+/g, ' ');
const pricePresent = value => validPrice(value);
const structuralError = (code, id, detail) => ({ code, id, detail });

export function auditCataloguePriceParity(curatedCatalogue, marketVehicles) {
  const structuralErrors = [];
  const curatedModels = Array.isArray(curatedCatalogue?.models) ? curatedCatalogue.models : [];
  const legacyVehicles = Array.isArray(marketVehicles) ? marketVehicles : [];
  if (!Array.isArray(curatedCatalogue?.models)) structuralErrors.push(structuralError('invalid_curated_models', '', 'Expected models array'));
  if (!Array.isArray(marketVehicles)) structuralErrors.push(structuralError('invalid_market_vehicles', '', 'Expected market vehicles array'));
  if (!curatedModels.length) structuralErrors.push(structuralError('empty_curated_models', '', 'No curated models'));
  if (!legacyVehicles.length) structuralErrors.push(structuralError('empty_market_vehicles', '', 'No market vehicles'));

  const modelsSeen = new Set();
  const offersSeen = new Set();
  const marketSeen = new Set();
  const curatedOffers = [];
  const marketRows = [];
  const modelGroups = new Map();

  for (const model of curatedModels) {
    const id = label(model?.id);
    if (!id) structuralErrors.push(structuralError('missing_model_id', '', 'Every curated model needs a stable ID'));
    else if (modelsSeen.has(id)) structuralErrors.push(structuralError('duplicate_model_id', id, 'Repeated curated model ID'));
    modelsSeen.add(id);
    if (!label(model?.make) || !label(model?.model)) structuralErrors.push(structuralError('missing_model_identity', id, 'Make/model required'));
    if (!Array.isArray(model?.offers)) {
      structuralErrors.push(structuralError('invalid_model_offers', id, 'Expected offers array'));
      continue;
    }
    const key = modelKey(model.make, model.model);
    const group = modelGroups.get(key) || { make: model.make, model: model.model, curatedOfferIds: [], marketIds: [] };
    for (const offer of model.offers) {
      const offerId = label(offer?.id);
      if (!offerId) structuralErrors.push(structuralError('missing_offer_id', id, 'Every curated offer needs a stable ID'));
      else if (offersSeen.has(offerId)) structuralErrors.push(structuralError('duplicate_offer_id', offerId, 'Repeated curated offer ID'));
      offersSeen.add(offerId);
      if (offer?.amount != null && !pricePresent(offer.amount)) {
        structuralErrors.push(structuralError('invalid_curated_price', offerId, 'Only positive numeric prices or null are accepted'));
      }
      if (offer?.currency && offer.currency !== 'LKR') {
        structuralErrors.push(structuralError('unsupported_currency', offerId, 'Only LKR offers are comparable'));
      }
      curatedOffers.push({ id: offerId, modelId: id, make: model.make, model: model.model,
        amount: offer?.amount ?? null, evidenceStatus: offerEvidenceStatus(offer), sourceStatus: offer?.sourceStatus ?? null,
        sourceUrl: offer?.sourceUrl ?? null, offer });
      group.curatedOfferIds.push(offerId);
    }
    modelGroups.set(key, group);
  }

  for (const vehicle of legacyVehicles) {
    const id = label(vehicle?.id);
    if (!id) structuralErrors.push(structuralError('missing_market_id', '', 'Every market record needs a stable ID'));
    else if (marketSeen.has(id)) structuralErrors.push(structuralError('duplicate_market_id', id, 'Repeated market ID'));
    marketSeen.add(id);
    if (!label(vehicle?.make) || !label(vehicle?.model)) structuralErrors.push(structuralError('missing_market_identity', id, 'Make/model required'));
    if (vehicle?.price != null && !pricePresent(vehicle.price)) {
      structuralErrors.push(structuralError('invalid_market_price', id, 'Only positive numeric prices or null are accepted'));
    }
    const key = modelKey(vehicle?.make, vehicle?.model);
    const group = modelGroups.get(key) || { make: vehicle?.make, model: vehicle?.model, curatedOfferIds: [], marketIds: [] };
    group.marketIds.push(id);
    modelGroups.set(key, group);
    marketRows.push({ id, make: vehicle?.make, model: vehicle?.model,
      price: vehicle?.price ?? null, priceVerification: vehicle?.priceVerification ?? null,
      sourceUrl: vehicle?.priceSourceUrl ?? null });
  }

  const curatedById = new Map(curatedOffers.map(row => [row.id, row]));
  const marketById = new Map(marketRows.map(row => [row.id, row]));
  const marketOnly = marketRows.filter(row => !curatedById.has(row.id)).sort(idOrder);
  const curatedOnly = curatedOffers.filter(row => !marketById.has(row.id)).map(({ offer, ...row }) => row).sort(idOrder);
  const availabilityDifferences = [];
  const priceDifferences = [];
  const verificationDifferences = [];
  const sourceDifferences = [];
  const promotionRisks = [];
  let bothPriced = 0;

  const matches = [];
  for (const curated of curatedOffers) {
    const market = marketById.get(curated.id);
    if (!market) continue;
    matches.push(curated.id);
    const a = pricePresent(curated.amount);
    const b = pricePresent(market.price);
    if (a && b) {
      bothPriced++;
      if (curated.amount !== market.price) priceDifferences.push({
        id: curated.id, curatedAmount: curated.amount, marketAmount: market.price
      });
    } else if (a !== b) availabilityDifferences.push({
      id: curated.id, curatedAmount: curated.amount, marketAmount: market.price,
      reason: a ? 'market_missing_price' : 'curated_missing_price'
    });
    const curatedConfirmed = curated.evidenceStatus === 'confirmed';
    const marketConfirmed = b && market.priceVerification === 'confirmed';
    if (curatedConfirmed !== marketConfirmed) verificationDifferences.push({
      id: curated.id, curatedStatus: curated.evidenceStatus,
      marketVerification: market.priceVerification, marketPrice: market.price
    });
    if (a && b && curated.sourceUrl && market.sourceUrl && curated.sourceUrl !== market.sourceUrl) {
      sourceDifferences.push({ id: curated.id, curatedSourceUrl: curated.sourceUrl, marketSourceUrl: market.sourceUrl });
    }
    // Treat a legacy "confirmed" label as a review signal, NEVER as a promotion instruction.
    if (market.priceVerification === 'confirmed' && !curatedConfirmed) promotionRisks.push({
      id: curated.id, reason: 'legacy_confirmation_without_curated_evidence',
      curatedStatus: curated.evidenceStatus, marketAmount: market.price
    });
  }

  const byId = rows => rows.sort(idOrder);
  const multiVariantModels = [...modelGroups.values()]
    .filter(group => group.marketIds.length > 1 && group.curatedOfferIds.length)
    .map(group => ({ model: modelKey(group.make, group.model),
      marketIds: group.marketIds.sort(), curatedOfferIds: group.curatedOfferIds.sort() }))
    .sort((a, b) => a.model.localeCompare(b.model));

  const summary = {
    curatedModels: curatedModels.length, curatedOffers: curatedOffers.length,
    marketRecords: marketRows.length, matchedIds: matches.length,
    bothPriced, marketOnly: marketOnly.length, curatedOnly: curatedOnly.length,
    availabilityDifferences: availabilityDifferences.length, priceDifferences: priceDifferences.length,
    verificationDifferences: verificationDifferences.length, sourceDifferences: sourceDifferences.length,
    promotionRisks: promotionRisks.length, multiVariantModels: multiVariantModels.length,
    structuralErrors: structuralErrors.length
  };
  return {
    schemaVersion: 1, mode: 'read-only', approvalRequired: true, automaticUpdates: false,
    outcome: structuralErrors.length ? 'invalid-structure' : 'review-required',
    summary,
    structuralErrors: structuralErrors.sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id)),
    review: { marketOnly, curatedOnly, availabilityDifferences: byId(availabilityDifferences),
      priceDifferences: byId(priceDifferences), verificationDifferences: byId(verificationDifferences),
      sourceDifferences: byId(sourceDifferences), promotionRisks: byId(promotionRisks),
      multiVariantModels }
  };
}

function printSummary(report) {
  console.log('Catalogue price parity: ' + report.outcome + ' (READ ONLY)');
  for (const [key, value] of Object.entries(report.summary)) console.log('  ' + key + ': ' + value);
  console.log('Legacy confirmation and amount differences are review signals, never publication instructions.');
  if (report.structuralErrors.length) console.error('Structural errors: ' + JSON.stringify(report.structuralErrors));
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file://' + process.argv[1]));
if (isEntry) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--json', '--help'].includes(arg))) {
    console.error('Usage: node scripts/audit-catalogue-price-parity.mjs [--json|--help]');
    process.exitCode = 2;
  } else if (args.includes('--help')) {
    console.log('Read-only parity audit. --json prints the machine-readable review queues. Exits nonzero only on structural errors.');
  } else {
    const curated = JSON.parse(fs.readFileSync(new URL('../data/catalogue.json', import.meta.url), 'utf8'));
    const report = auditCataloguePriceParity(curated, baseVehicles);
    if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else printSummary(report);
    if (report.structuralErrors.length) process.exitCode = 1;
  }
}
