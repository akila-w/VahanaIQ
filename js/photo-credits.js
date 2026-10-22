// Manufacturer / authorised distributor photos only. No community-photo fallback.
import { OFFICIAL_PHOTOS } from './official-photo-data.js?v=2.11.3';
import { esc } from './calculator.js?v=2.11.3';
export const PHOTO_CREDITS = OFFICIAL_PHOTOS;
const tokens = name => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const records = Object.entries(OFFICIAL_PHOTOS).sort(([a],[b])=>b.length-a.length);
export function creditFor(vehicleOrName) {
  if (!vehicleOrName) return null;
  const name = typeof vehicleOrName === 'string' ? vehicleOrName : `${vehicleOrName.make || ''} ${vehicleOrName.model || ''}`.trim() || vehicleOrName.name;
  if (OFFICIAL_PHOTOS[name]) return OFFICIAL_PHOTOS[name];
  const query = ' '+tokens(name)+' ';
  return records.find(([model])=>query.includes(' '+tokens(model)+' '))?.[1] || null;
}
export const photoForModel = value => creditFor(value)?.img || '';
export function formatCreditHtml(credit, compact = true) {
  if (!credit?.author || !/^https:\/\//.test(credit.sourceUrl || '')) return '';
  return `<a class="photo-source" href="${esc(credit.sourceUrl)}" target="_blank" rel="noopener noreferrer" title="${esc(`Photo: ${credit.author} · ${credit.licence}`)}">${compact ? 'Photo Source' : esc(credit.author)}<span class="${compact ? 'sr-only' : 'photo-rights'}">: ${esc(credit.author)} · ${esc(credit.licence)}</span> ↗</a>`;
}
