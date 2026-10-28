// VahanaIQ offline & fast-navigation support: core pages, stylesheets, and versioned
// scripts are precached so tab switches between Calculator, Catalogue, and Studio
// resolve immediately from cache while staying fresh in the background.
// Searches (the AI proxy) and photos from other sites are never cached.
const CACHE = "vahanaiq-v2.12.0";
const SHELL = [
  "./",
  "js/price-history.js?v=2.12.0",
  "data/price-history.json",
  "css/experience.css?v=2.12.0",
  "js/experience.js?v=2.12.0",
  "js/onboarding.js?v=2.12.0",
  "js/onboarding-state.js?v=2.12.0",
  "js/catalogue-search.js?v=2.12.0",
  "assets/fonts/manrope/Manrope-variable.ttf",
  "assets/fonts/inter/Inter-variable.ttf",
  "index.html",
  "catalogue.html",
  "studio.html",
  "about.html",
  "privacy.html",
  "terms.html",
  "manifest.json",
  "css/guidance.css?v=2.12.0",
  "assets/icons/lucide/circle-help.svg",
  "js/guidance.js?v=2.12.0",
  "js/guidance-content.js?v=2.12.0",
  "js/guidance-state.js?v=2.12.0",
  "css/tokens.css?v=2.12.0",
  "css/style.css?v=2.12.0",
  "css/style.min.css?v=2.12.0",
  "css/curated-catalogue.css?v=2.12.0",
  "css/catalogue-studio.css?v=2.12.0",
  "js/boot.js?v=2.12.0",
  "js/page-transitions.js?v=2.12.0",
  "js/catalogue-data.js?v=2.12.0",
  "js/app.js?v=2.12.0",
  "js/curated-catalogue.js?v=2.12.0",
  "js/catalogue-studio.js?v=2.12.0",
  "js/catalogue-photo-overlay.js?v=2.12.0",
  "js/calculator.js?v=2.12.0",
  "js/constants.js?v=2.12.0",
  "js/inputs.js?v=2.12.0",
  "js/storage.js?v=2.12.0",
  "js/dates.js?v=2.12.0",
  "js/money-input.js?v=2.12.0",
  "js/modal.js?v=2.12.0",
  "js/toast.js?v=2.12.0",
  "js/safe-url.js?v=2.12.0",
  "js/config.js?v=2.12.0",
  "js/catalog.js?v=2.12.0",
  "js/vehicle-validation.js?v=2.12.0",
  "js/photo-credits.js?v=2.12.0",
  "js/image-fetcher.js?v=2.12.0",
  "js/catalogue-browser.js?v=2.12.0",
  "js/planner.js?v=2.12.0",
  "js/account.js?v=2.12.0",
  "js/photo-frame.js?v=2.12.0",
  "js/catalogue-photos.js?v=2.12.0",
  "js/catalogue-photo-store.js?v=2.12.0",
  "assets/icons/favicon.svg?v=20261020",
  "assets/icons/logo-option-1-apex.svg?v=20261020"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("vahanaiq-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Review originals and source evidence are large working artefacts, outside the app shell.
  if (/\/docs\/|\/assets\/images\/review-/.test(url.pathname)) return;

  // Version-pinned static assets (?v=...) can be served cache-first with background revalidation
  // so switching between Calculator, Catalogue, and Studio never blocks on network round-trips.
  if (url.searchParams.has("v") && event.request.mode !== "navigate") {
    event.respondWith(caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
        }
        return response;
      });
      return cached || networkFetch;
    }));
    return;
  }

  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request, { ignoreSearch: event.request.mode === "navigate" })
    .then(cached => cached || (event.request.mode === "navigate" ? caches.match("index.html") : undefined))));
});
