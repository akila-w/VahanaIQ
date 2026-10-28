// One complete, immutable offline shell per worker revision. Bump the cache
// revision whenever a shell file changes, even when APP_VERSION stays the same.
// Tests walk the entry-point dependency graph to guard this explicit manifest.
const CACHE = "vahanaiq-v2.12.0-offline-1";
const SHELL = [
  "js/price-history.js?v=2.12.0",
  "data/price-history.json",
  "data/catalogue.json",
  "data/identity.json",
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
  "js/canvas-utils.js?v=2.12.0",
  "js/market-catalogue.js?v=2.12.0",
  "js/official-photo-data.js?v=2.12.0",
  "js/bulk-selection.js?v=2.12.0",
  "js/savings.js?v=2.12.0",
  "js/planner-store.js?v=2.12.0",
  "js/date-picker.js?v=2.12.0",
  "js/identity-data.js?v=2.12.0",
  "js/gemini.js?v=2.12.0",
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
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/favicon.svg",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/logo-option-1-apex.svg",
  "assets/icons/logo-v-mark-transparent-light.svg",
  "assets/icons/logo-v-mark-transparent-dark.svg",
  "assets/icons/lucide/search.svg",
  "assets/icons/lucide/car.svg",
  "assets/icons/lucide/fuel.svg",
  "assets/icons/lucide/download.svg",
  "assets/identity/gemini.png"
];

const shellURLs = new Set(SHELL.map(asset => new URL(asset, self.registration.scope).href));
const faviconPath = new URL("assets/icons/favicon.svg", self.registration.scope).pathname;

self.addEventListener("install", event => {
  // addAll commits the batch only if every dependency succeeds. Do not skip the
  // waiting phase: existing tabs must finish using their complete old shell.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    SHELL.map(asset => new Request(new URL(asset, self.registration.scope), { cache: "reload" }))
  )).catch(async error => {
    await caches.delete(CACHE);
    throw error;
  }));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("vahanaiq-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Both existing favicon URLs share one cache entry. Module queries stay exact.
  if (url.pathname === faviconPath) url.search = "";
  // Only the declared shell is cached. Vehicle photos, review originals and
  // external APIs remain optional network requests and never fill this cache.
  if (event.request.mode === "navigate") {
    url.search = "";
    if (url.href === self.registration.scope) url.pathname += "index.html";
  }
  if (!shellURLs.has(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(url.href);
    // A missing entry means storage was evicted. Recover online if possible;
    // never substitute Calculator HTML for another page or a JS/CSS dependency.
    return cached || fetch(event.request);
  }));
});
