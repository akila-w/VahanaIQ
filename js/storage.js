// Storage helpers
import { config } from "./config.js?v=2.7.1";
import { vehicleBatchError } from "./vehicle-validation.js?v=2.7.1";

export const getProxyUrl = () => config.proxyUrl || "";

// Earlier versions stored a personal Gemini key, a proxy override and a cached model name.
// None of these are used any more, so remove them from the browser.
export function clearLegacyKeys() {
  try {
    ["sl_lease_gemini_key", "sl_lease_gemini_proxy", "sl_lease_gemini_model", "sl_lease_gemini_model_v"].forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

export function cloneBaseCars(base) {
  return base.map((c, i) => Object.assign({}, c, { _baseId: i, custom: false }));
}

export function loadSavedCars(base, onInvalid = () => {}) {
  let list = cloneBaseCars(base);
  let invalid = 0;
  try {
    const saved = localStorage.getItem("sl_lease_custom_cars_v2");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (vehicleBatchError([item])) { invalid++; continue; }
          if (typeof item._baseId === "number" && list[item._baseId]) {
            list[item._baseId] = Object.assign({}, list[item._baseId], item, { custom: true });
          } else {
            list.push(Object.assign({}, item, { custom: true }));
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to load custom cars", e);
  }
  if (invalid) {
    saveCars(list);
    onInvalid(invalid);
  }
  return list;
}

export function saveCars(cars) {
  try {
    const custom = cars.filter(c => c.custom && !vehicleBatchError([c])).map(({ _key, ...c }) => c);
    localStorage.setItem("sl_lease_custom_cars_v2", JSON.stringify(custom));
  } catch (e) {
    console.error("Failed to save custom cars", e);
  }
}
