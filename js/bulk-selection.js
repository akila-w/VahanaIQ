import { validPrice } from './vehicle-validation.js?v=2.11.3';

// Bulk selection is independent of pagination and never creates duplicate records.
export function prepareBulkSelection(vehicles, selectedIds = []) {
  const selected = new Set(selectedIds), seen = new Set(), eligible = [], skipped = [];
  for (const v of vehicles) {
    if (selected.has(v.id) || seen.has(v.id)) continue;
    seen.add(v.id);
    if (!validPrice(v.price) || v.priceBasis === 'conflicting') { skipped.push(v); continue; }
    eligible.push(v);
  }
  return { eligible, skipped };
}
