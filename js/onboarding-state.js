export const ONBOARDING_KEY = 'vahanaiq_onboarding_v3';
export const MIN_SHORTLIST = 2;
export function readOnboarding(storage) {
  try {
    const value = JSON.parse(storage.getItem(ONBOARDING_KEY));
    if (value?.version === 1 && value.completed === true) return { version: 1, completed: true, step: 4 };
    if (value?.version === 1) return { version: 1, completed: false, step: Number.isInteger(value.step) ? Math.max(0, Math.min(4, value.step)) : 0 };
  } catch {}
  return { version: 1, completed: false, step: 0 };
}
export function validTerms(t) {
  if (!t || typeof t !== 'object') return false;
  return ['rate','tenure','down'].every(k => t[k] !== '' && Number.isFinite(Number(t[k]))) &&
    Number(t.rate) >= 0 && Number(t.rate) <= 40 && Number.isInteger(Number(t.tenure)) && Number(t.tenure) >= 6 && Number(t.tenure) <= 84 &&
    Number(t.down) >= 40 && Number(t.down) <= 100 && ['flat','reducing'].includes(t.rateType);
}
export function mergeShortlist(existing, selected) {
  const result = [...existing];
  for (const car of selected) if (!result.some(c => c.id === car.id || (c.catalogueId && c.catalogueId === car.catalogueId))) result.push(car);
  return result;
}
