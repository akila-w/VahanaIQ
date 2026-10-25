// VahanaIQ offline support: pages and files from this site are fetched from the network
// first and kept in a cache, so the calculator still opens without a connection.
// Searches (the AI proxy) and photos from other sites are never cached.
const CACHE = "vahanaiq-v2.11.6";
const SHELL = ["./", "index.html", "js/boot.js?v=2.11.6", "css/tokens.css?v=2.11.6", "css/style.css?v=2.11.6", "js/app.js?v=2.11.6", "manifest.json", "assets/icons/favicon.svg?v=20261020", "assets/icons/logo-option-1-apex.svg?v=20261020"];

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
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request, { ignoreSearch: event.request.mode === "navigate" })
    .then(cached => cached || (event.request.mode === "navigate" ? caches.match("index.html") : undefined))));
});
