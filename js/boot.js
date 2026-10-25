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

// js/catalogue-photo-overlay.js fills this in with the photos saved by the Photo Studio. The
// promise is made here, before any deferred script runs, so the page can wait for the overlay
// whichever of the two finishes first.
window.__VAHANAIQ_PHOTOS__ = { apply: null, resolve: null };
window.__VAHANAIQ_PHOTOS__.ready = new Promise(function (resolve) { window.__VAHANAIQ_PHOTOS__.resolve = resolve; });
