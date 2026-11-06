// Runs before the stylesheets on every page so the saved theme is applied before first paint,
// and so the catalogue's photo overlay has a promise to fill in.
try {
  var theme = localStorage.getItem("vahanaiq_theme");
  if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
} catch (e) {}
try {
  var now = Date.now() / 1000;
  var rootStyle = document.documentElement.style;
  rootStyle.setProperty("--aurora-delay-1", "-" + (now % 44).toFixed(2) + "s");
  rootStyle.setProperty("--aurora-delay-2", "-" + (now % 56).toFixed(2) + "s");
} catch (e) {}

// A signed-in visit to studio.html shows nothing until js/studio-page.js has decided between its
// two views, so neither flashes first; a visit with no sign-in sees the not-found view at once.
try {
  if (localStorage.getItem("vahanaiq_account_v1")) document.documentElement.classList.add("account-pending");
} catch (e) {}

// First visit to the Lease page: show the landing introduction instead of the calculator.
// Decided here, before first paint, so the calculator never flashes first. js/onboarding.js
// takes over from this class; anyone who finished or dismissed setup, or already has
// vehicles saved, goes straight to the calculator.
try {
  var onLeasePage = /\/(?:index\.html)?$/.test(location.pathname);
  var asked = /[?&]onboarding\b/.test(location.search) || location.hash === "#onboarding";
  var welcome = /[?&]welcome\b/.test(location.search);
  var setup = JSON.parse(localStorage.getItem("vahanaiq_onboarding_v3") || "null");
  var saved = JSON.parse(localStorage.getItem("vahanaiq_comparison_v3") || "null");
  var returning = (setup && setup.completed === true) || (saved && Array.isArray(saved.cars) && saved.cars.length > 0);
  if (onLeasePage && !asked && (welcome || !returning)) document.documentElement.classList.add("landing-pending");
} catch (e) {}

// js/catalogue-photo-overlay.js fills this in with the photos saved by the Photo Studio. The
// promise is made here, before any deferred script runs, so the page can wait for the overlay
// whichever of the two finishes first.
window.__VAHANAIQ_PHOTOS__ = { apply: null, resolve: null };
window.__VAHANAIQ_PHOTOS__.ready = new Promise(function (resolve) { window.__VAHANAIQ_PHOTOS__.resolve = resolve; });

// Shared by every page, including direct Catalogue and Photo Studio visits.
// Resolve from this script, preserving both root hosting and /VahanaIQ/ scope.
if (window.isSecureContext && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(new URL("../sw.js", document.currentScript.src), {
    updateViaCache: "none"
  }).catch(e => console.warn("Offline support unavailable:", e));
}
