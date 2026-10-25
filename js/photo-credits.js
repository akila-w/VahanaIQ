// Manufacturer / authorised distributor photos only. No community-photo fallback.
// The Curated Catalogue is the canonical authority over vehicle imagery.
import { OFFICIAL_PHOTOS } from './official-photo-data.js?v=2.11.5';
import { esc, safeUrl } from './calculator.js?v=2.11.5';

export const PHOTO_CREDITS = OFFICIAL_PHOTOS;

const tokens = name => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const records = Object.entries(OFFICIAL_PHOTOS).sort(([a],[b]) => b.length - a.length);

function getCatalogue() {
  if (typeof globalThis !== 'undefined' && globalThis.window?.__VAHANAIQ_CATALOGUE__?.models?.length) {
    return globalThis.window.__VAHANAIQ_CATALOGUE__;
  }
  return null;
}

export function findCatalogueModel(vehicleOrName) {
  const cat = getCatalogue();
  if (!cat || !vehicleOrName) return null;

  // 1. Match by catalogueId or id
  const id = typeof vehicleOrName === 'object' ? (vehicleOrName.catalogueId || vehicleOrName.id) : null;
  if (id) {
    const byId = cat.models.find(m => m.id === id);
    if (byId) return byId;
  }

  const rawName = typeof vehicleOrName === 'string'
    ? vehicleOrName
    : ((vehicleOrName.make ? vehicleOrName.make + ' ' : '') + (vehicleOrName.model || vehicleOrName.name || '')).trim() || vehicleOrName.name || '';
  if (!rawName) return null;
  const nameClean = tokens(rawName);
  if (!nameClean) return null;

  // 2. Exact match on model.name or model.id
  const exact = cat.models.find(m => tokens(m.name) === nameClean || m.id.toLowerCase() === nameClean);
  if (exact) return exact;

  // 3. Exact match on make + model if available on vehicle object
  if (typeof vehicleOrName === 'object' && vehicleOrName.make && vehicleOrName.model) {
    const mm = cat.models.find(m => tokens(m.make) === tokens(vehicleOrName.make) && tokens(m.model) === tokens(vehicleOrName.model));
    if (mm) return mm;
  }

  // 4. Token-based matching: query contains full model name (e.g. "Toyota Yaris Cross Z 2024" contains "Toyota Yaris Cross")
  const cleanPadded = ' ' + nameClean + ' ';
  let best = null, bestLen = 0;
  for (const m of cat.models) {
    const mPadded = ' ' + tokens(m.name) + ' ';
    if (cleanPadded.includes(mPadded)) {
      if (mPadded.length > bestLen) {
        best = m;
        bestLen = mPadded.length;
      }
    }
  }
  if (best) return best;

  // 5. If make matches (explicitly or prefix in name), find candidate where query model tokens match catalogue model tokens
  const vMake = typeof vehicleOrName === 'object' && vehicleOrName.make ? tokens(vehicleOrName.make) : '';
  for (const m of cat.models) {
    const mMake = tokens(m.make);
    const hasMake = (vMake && vMake === mMake) || cleanPadded.startsWith(' ' + mMake + ' ');
    if (!hasMake) continue;

    const mModelTokens = tokens(m.model).split(' ').filter(Boolean);
    const queryModelText = cleanPadded.replace(' ' + mMake + ' ', ' ').trim();
    const qTokens = queryModelText.split(' ').filter(Boolean);

    const matched = qTokens.filter(t => mModelTokens.includes(t));
    if (matched.length > 0 && matched.length === qTokens.length) {
      if (matched.length > bestLen) {
        best = m;
        bestLen = matched.length;
      }
    }
  }

  return best;
}

export function creditFor(vehicleOrName) {
  if (!vehicleOrName) return null;

  // 1. Catalogue is always superior: check Curated Catalogue first
  const catModel = findCatalogueModel(vehicleOrName);
  if (catModel && catModel.images?.length) {
    const primaryImg = catModel.images[0];
    const explicitImg = (typeof vehicleOrName === 'object' && vehicleOrName.img) ? vehicleOrName.img : '';
    const imgUrl = (explicitImg && (explicitImg.startsWith('assets/images/curated-catalogue/') || explicitImg.startsWith('data:') || explicitImg.startsWith('blob:')))
      ? explicitImg
      : (primaryImg.smallSrc || primaryImg.src);

    const host = primaryImg.sourcePage ? (() => { try { return new URL(primaryImg.sourcePage).hostname.replace(/^www\./, ''); } catch { return ''; } })() : '';
    const author = primaryImg.caption
      ? `${catModel.make} · ${primaryImg.caption}`
      : (host ? `${catModel.make} · ${host}` : `${catModel.make} · Official`);

    return {
      img: imgUrl,
      largeImg: primaryImg.src || imgUrl,
      author,
      licence: 'Official source · rights reserved',
      licenceUrl: primaryImg.sourcePage || catModel.sourceUrl || '',
      sourceUrl: primaryImg.sourcePage || catModel.sourceUrl || '',
      originalUrl: primaryImg.url || '',
      sourceKind: 'official',
      aspectRatio: primaryImg.aspectRatio || '8:5',
      model: catModel.model,
      make: catModel.make,
      variantNote: primaryImg.note || 'Equipment and appearance may differ by market, year and trim.',
      isCatalogue: true
    };
  }

  // 2. If object has a direct valid curated/studio img but wasn't matched above
  if (typeof vehicleOrName === 'object' && vehicleOrName.img) {
    const img = vehicleOrName.img;
    if (img.startsWith('assets/images/curated-catalogue/') || img.startsWith('data:') || img.startsWith('blob:')) {
      const make = vehicleOrName.make || '';
      return {
        img,
        largeImg: img,
        author: make ? `${make} · Official` : 'Official source',
        licence: 'Official source · rights reserved',
        licenceUrl: vehicleOrName.sourceUrl || '',
        sourceUrl: vehicleOrName.sourceUrl || '',
        sourceKind: 'official',
        aspectRatio: '8:5',
        model: vehicleOrName.model || '',
        make,
        variantNote: 'Representative official image.',
        isCatalogue: true
      };
    }
  }

  // 3. Fallback to legacy OFFICIAL_PHOTOS (review-thumbnails)
  const name = typeof vehicleOrName === 'string'
    ? vehicleOrName
    : `${vehicleOrName.make || ''} ${vehicleOrName.model || ''}`.trim() || vehicleOrName.name;
  if (OFFICIAL_PHOTOS[name]) return OFFICIAL_PHOTOS[name];
  const query = ' ' + tokens(name) + ' ';
  return records.find(([model]) => query.includes(' ' + tokens(model) + ' '))?.[1] || null;
}

export const photoForModel = value => creditFor(value)?.img || '';

export function formatCreditHtml(credit, compact = true) {
  if (!credit) return '';
  const safeSource = credit.sourceUrl ? safeUrl(credit.sourceUrl) : '#';
  if (safeSource !== '#') {
    return `<a class="photo-source" href="${safeSource}" target="_blank" rel="noopener noreferrer" title="${esc(`Photo: ${credit.author || 'Official'} · ${credit.licence || 'Official source'}`)}">${compact ? 'Photo Source' : esc(credit.author || 'Official')}<span class="${compact ? 'sr-only' : 'photo-rights'}">: ${esc(credit.author || 'Official')} · ${esc(credit.licence || 'Official source')}</span> ↗</a>`;
  }
  if (credit.origin === 'owner-upload' || (credit.isStudio && !credit.sourceUrl)) {
    return `<span class="studio-credit">Photo Studio · This Device</span>`;
  }
  return '';
}
