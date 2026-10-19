// Storage & Magic Link Importer
import { config } from "./config.js?v=2.5.1";

export const getApiKey = () => localStorage.getItem("sl_lease_gemini_key") || config.apiKey || "";
export const setApiKey = k => localStorage.setItem("sl_lease_gemini_key", k.trim());
export const removeApiKey = () => localStorage.removeItem("sl_lease_gemini_key");

export const getProxyUrl = () => localStorage.getItem("sl_lease_gemini_proxy") || config.proxyUrl || "";
export const setProxyUrl = url => localStorage.setItem("sl_lease_gemini_proxy", url.trim());

export function initMagicLink() {
  if (window.location.hash.includes("apiKey=")) {
    const match = window.location.hash.match(/apiKey=([^&]+)/);
    if (match && match[1]) {
      setApiKey(decodeURIComponent(match[1]));
      try {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (e) {}
      alert("VahanaIQ: Gemini API key configured successfully on this device!");
    }
  }
}

export function loadSavedCars(base) {
  let list = base.slice();
  try {
    const saved = localStorage.getItem("sl_lease_custom_cars_v2");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) list = list.concat(parsed);
    }
  } catch (e) {
    console.error("Failed to load custom cars", e);
  }
  return list;
}

export function saveCars(cars) {
  try {
    const custom = cars.filter(c => c.custom);
    localStorage.setItem("sl_lease_custom_cars_v2", JSON.stringify(custom));
  } catch (e) {
    console.error("Failed to save custom cars", e);
  }
}