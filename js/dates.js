// ISO values stay in storage; people see a friendly British-English date.
export function formatDate(value, { numeric = false } = {}) {
  const raw = String(value || '');
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : /^\d{2}[/-]\d{2}[/-]\d{4}$/.test(raw) ? raw.slice(6)+'-'+raw.slice(3,5)+'-'+raw.slice(0,2) : '';
  if (!iso) return 'Date unavailable';
  const date = new Date(iso+'T12:00:00');
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== +iso.slice(0,4) || date.getMonth()+1 !== +iso.slice(5,7) || date.getDate() !== +iso.slice(8,10)) return 'Date unavailable';
  return numeric ? iso.split('-').reverse().join('-') : date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
export function formatMonth(value) {
  return /^\d{4}-\d{2}$/.test(String(value||'')) ? formatDate(value+'-01').replace(/^1 /,'') : 'Date unavailable';
}
