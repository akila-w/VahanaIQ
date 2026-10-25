// Resolve only the local, source-attributed official catalogue. No network fallback.
import { photoForModel } from './photo-credits.js?v=2.11.6';
export const NO_PHOTO = '<div class="ph"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="3"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M14 21v-4a2 2 0 0 0-4 0v4"/></svg><span>No photo</span></div>';
export const localStudioPhoto = modelName => photoForModel(modelName);
export async function fetchVehicleStudioImage(modelName) { return photoForModel(modelName); }
