// Storage helpers
import { config } from "./config.js?v=2.11.3";
import { vehicleBatchError } from "./vehicle-validation.js?v=2.11.3";

export const getProxyUrl = () => config.proxyUrl || "";

// Tells the account sync (js/account.js) that this browser's saved inputs or vehicles changed
export const SAVED_EVENT = "vahanaiq:saved";
export function notifySaved() {
  try { window.dispatchEvent(new Event(SAVED_EVENT)); } catch (e) {}
}

// Earlier versions stored a personal Gemini key, a proxy override and a cached model name.
// None of these are used any more, so remove them from the browser.
export function clearLegacyKeys() {
  try {
    ["sl_lease_gemini_key", "sl_lease_gemini_proxy", "sl_lease_gemini_model", "sl_lease_gemini_model_v"].forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

export function cloneBaseCars(base) {
  return base.map(c => ({ ...c, id: c.id || legacyIdByName.get(c.name) || newVehicleId(), legacy: true, custom: false }));
}

// Immutable mapping from v2's ORIGINAL array positions. Never derive this from a
// reordered live catalogue; a saved override must keep its original identity.
export const LEGACY_BASE_IDS = Object.freeze([
  "legacy-corolla-cross-z-adventure", "legacy-byd-sealion-6-premium-awd", "legacy-vezel-ehev-z",
  "legacy-byd-sealion-5-premium", "legacy-yaris-cross-z", "legacy-hyryder-v",
  "legacy-raize-z-hybrid", "legacy-swift-mz", "legacy-fronx-alpha-turbo",
  "legacy-taisor-v", "legacy-magnite-tekna-plus", "legacy-wagon-r-custom-z"
]);
const legacyNames = [
  "Toyota Corolla Cross Z (Adventure)", "BYD Sealion 6 Premium (AWD)", "Honda Vezel e:HEV Z",
  "BYD Sealion 5 Premium", "Toyota Yaris Cross Z", "Toyota Urban Cruiser Hyryder V",
  "Toyota Raize Z Hybrid", "Suzuki Swift MZ Hybrid", "Suzuki Fronx Alpha (Turbo)",
  "Toyota Urban Cruiser Taisor V", "Nissan Magnite Tekna Plus", "Suzuki Wagon R Custom Z"
];
const legacyIdByName = new Map(legacyNames.map((name, i) => [name, LEGACY_BASE_IDS[i]]));
export const COMPARISON_KEY = "vahanaiq_comparison_v3";
export const newVehicleId = () => "user-" + (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const safeId = id => typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,150}$/.test(id);

export function loadSavedCars(base, onInvalid = () => {}) {
  let list = [];
  let invalid = 0;
  try {
    const current = localStorage.getItem(COMPARISON_KEY);
    if (current !== null) {
      const parsed = JSON.parse(current);
      if (parsed?.version !== 3 || !Array.isArray(parsed.cars)) throw new Error("Unsupported comparison data");
      const seen = new Set();
      for (const item of parsed.cars) {
        if (vehicleBatchError([item])) { invalid++; continue; }
        const id = safeId(item.id) && !seen.has(item.id) ? item.id : newVehicleId();
        const { _baseId, _key, ...record } = item;
        list.push({ ...record, id });
        seen.add(id);
      }
      if (invalid) onInvalid(invalid);
      return list;
    }
    const saved = localStorage.getItem("sl_lease_custom_cars_v2");
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Invalid legacy comparison data");
      list = cloneBaseCars(base);
      for (const item of parsed) {
        if (vehicleBatchError([item])) { invalid++; continue; }
        const { _baseId, _key, ...record } = item;
        const id = LEGACY_BASE_IDS[_baseId];
        const at = id ? list.findIndex(c => c.id === id) : -1;
        if (at >= 0) list[at] = { ...list[at], ...record, id, legacy: true, custom: true };
        else list.push({ ...record, id: newVehicleId(), legacy: true, custom: true });
      }
      saveCars(list); // v3 is authoritative after migration; retain v2 as a backup.
    }
  } catch (e) {
    console.error("Failed to load saved comparison", e);
    invalid++;
  }
  if (invalid) onInvalid(invalid);
  return list;
}

export function saveCars(cars) {
  try {
    const records = cars.filter(c => !vehicleBatchError([c])).map(c => {
      if (!safeId(c.id)) c.id = newVehicleId();
      const { _key, _baseId, ...record } = c;
      return record;
    });
    localStorage.setItem(COMPARISON_KEY, JSON.stringify({ version: 3, cars: records }));
    notifySaved();
    return true;
  } catch (e) {
    console.error("Failed to save comparison", e);
    return false;
  }
}
