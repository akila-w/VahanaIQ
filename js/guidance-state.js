export const GUIDANCE_KEY = 'vahanaiq_guidance_v1';
const fresh = () => ({ version: 1, welcomed: false, tips: true, tours: {} });

export function readGuidance(storage) {
  try {
    const raw = JSON.parse(storage.getItem(GUIDANCE_KEY));
    if (raw?.version !== 1) return fresh();
    const state = fresh();
    state.welcomed = raw.welcomed === true;
    state.tips = raw.tips !== false;
    for (const page of ['calculator', 'catalogue', 'studio']) {
      const tour = raw.tours?.[page];
      if (tour && ['active', 'skipped', 'completed'].includes(tour.status) && Number.isInteger(tour.step) && tour.step >= 0 && tour.step < 4) {
        state.tours[page] = { status: tour.status, step: tour.step };
      }
    }
    return state;
  } catch { return fresh(); }
}

export function writeGuidance(storage, state) {
  try { storage.setItem(GUIDANCE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
