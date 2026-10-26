# Changelog

All notable changes to the VahanaIQ platform are documented in this file.
This project adheres to British English conventions and date format DD/MM/YYYY.

---

## [2.12.0] - 26/10/2026

UI/UX pass: mobile layout, touch, focus and motion. No calculation, threshold, rounding or number format changed; every displayed figure was checked against the live v2.11.6 site for 8 term scenarios. Reports: `docs/uiux-audit.md`, `docs/uiux-improvements.md`, `docs/uiux-qa-results.md`, `docs/motion-design.md`, `docs/iphone-qa-checklist.md`, `docs/release-readiness.md`.

### Added
- **Motion and touch tokens (`design-system/tokens.json`)**: `--duration-instant`, `--duration-moderate`, `--duration-slow`, `--duration-chart`, `--duration-enter`, `--easing-out`, `--easing-in`, `--easing-in-out`, `--slider-hit`, `--slider-thumb` and `--slider-thumb-touch`.
- **Section switcher on phones, tablets and small laptops**: sticky, with a Terms link and the section in view marked (`aria-current="location"`).
- **Head-to-head "At a Glance" matrix on phones**: rental, cash up front, total interest and total outlay grouped by metric with **Lowest** and the difference; finalist cards swipe sideways below it.
- **Browser suite `test/browser/ui-responsive.spec.mjs`**: 40 checks for page width at phone, tablet and laptop sizes (with and without a filled comparison), 44px touch targets, keyboard focus, phone journeys, the date picker, 16px fields, the iPhone keyboard guard, the catalogue sheet, the phone rental bar, dark-theme dialog contrast and reduced motion; passing in Chromium and WebKit.
- **Firefox and WebKit in CI (`.github/workflows/test.yml`)**: the browser job runs both browser specs once per engine (Chromium, WebKit, Firefox). The Firefox run has not happened yet: it needs a push.
- **iPhone keyboard guard (`js/page-transitions.js`)**: when iOS Safari leaves a focused field behind the on-screen keyboard after its toolbar changes the visible area, the field is brought back into view.

### Changed
- **Asset version 2.12.0**: `APP_VERSION`, every `?v=` query, the service-worker cache (`vahanaiq-v2.12.0`) and the tests that pin the version. `js/page-transitions.js`, `css/curated-catalogue.css` and `css/catalogue-studio.css` now load with `?v=2.12.0` too, so returning visitors cannot keep an older copy of them after a release.
- **Comparison layout**: phone cards fit the screen with every figure visible and a 44px Compare · Details · Remove row; the table fits its panel at every width from 768 to 1920px, with the actions column kept in view; the page stays in one column from 980 to 1365px.
- **Headers and heroes**: a two-row 121px header on phones (was 183px) and one 71px row from 780 to 1199px; compact heroes with a three-figure CBSL strip; loan terms start at y=479 on a 390×844 phone (was 663).
- **Dialogs**: panels rise into place; phones get bottom sheets sized to `92dvh` with safe-area padding.
- **Gauge and bars**: graphics ease from their previous value while figures change at once; the needle now turns about its hub.
- **Sliders**: larger hit area (44px on touch) and a visible keyboard focus ring.
- **Photo Studio**: choosing an entry on a phone scrolls the editor into view; 44px photo, zoom and guide controls on touch.
- **Page transitions**: no navigation delay under reduced motion or where the browser cross-fades pages itself; 140ms otherwise (was 180ms). The catalogue and Studio use the same handler, and the section switcher scrolls instantly under reduced motion.
- **"Add a Vehicle" on phones**: the whole sheet scrolls, instead of a results box that showed a fraction of one card (111px at 375×635, 14px in landscape).
- **Information pages** load `js/boot.js`, so a saved Light or Dark choice applies there too.

### Fixed
- Comparison cards wider than the phone screen, clipping prices, deposits and rentals and pushing the row actions off-screen; the page zoomed out on phones.
- The table's visually hidden "Actions" label widened the whole page at 768–1366px.
- Catalogue hero overflowing every phone width (663px page).
- Layout shift on load: catalogue up to 0.82 and Studio up to 0.46 CLS, now at most 0.027.
- Budget telemetry figures running past their cards between 980 and 1279px; cashflow 40%/50% labels overlapping the card heading.
- Footer links and buttons without focus rings and only 17px tall.
- White-on-teal (1.86:1) pressed compare buttons and active chips under the System theme on a dark device.
- Catalogue and Photo Studio dropdowns drawn 20px tall by WebKit on phones; they now draw their own chevron and are 46px in every engine.
- iOS Safari zooming the page on focus: every text field and menu is now 16px on phones and touch screens.
- The savings planner's date picker collapsing into a single 1,368px column of days on phones; it is a 7-column month grid again.
- The affordability status and rental hidden behind the sticky actions column at 1200–1365px.
- The rental-against-limit bar in phone comparison cards drawn 0px tall.
- Content under the camera housing on iPhones in landscape: page gutters now grow to the safe area there.
- "Mark for Review" in the catalogue's vehicle dialog was pale text on white in Dark (about 1.1:1); it now follows the theme (13.35:1).
- On iPhone, the field being typed into (such as Net Monthly Income) could end up behind the keyboard.

---

## [2.11.6] - 25/10/2026

### Added
- **Externalised Bootstrap (`js/boot.js`)**: Extracted the early theme (`vahanaiq_theme`), aurora animation phase, and `window.__VAHANAIQ_PHOTOS__` readiness promise into `js/boot.js`, loaded before stylesheets on `index.html`, `catalogue.html`, and `studio.html` and precached in `sw.js` (`vahanaiq-v2.11.6`) so no shipped HTML page uses inline `<script>` tags.
- **CSP, Client-IP, Module-Version & Browser Regression Suites**: Added `test/csp.test.mjs`, `test/client-ip.test.mjs`, `test/module-versions.test.mjs`, `test/security.test.mjs`, and the Playwright Chromium browser suite `test/browser/csp.spec.mjs` (verifying zero CSP violations, Google Identity Services iframe attachment, dark theme bootstrap, and photo overlay readiness).
- **Centralised Regulatory Constants (`js/constants.js`)**: Extracted CBSL Directions No. 01 of 2026 statutory down-payment floors, tenures, DTI ceilings, and UI strategy presets into `js/constants.js`.
- **Shared URL Sanitizers (`js/safe-url.js`)**: Consolidated `safeUrl()` and `safeImageUrl()` into `js/safe-url.js`, blocking `javascript:`, `vbscript:`, `data:text/html`, and SVG data URLs.

### Changed
- **CSP Repair & Google Sign-In (`index.html`, `catalogue.html`, `studio.html`, `about.html`, `privacy.html`, `terms.html`)**: Repaired `<meta http-equiv="Content-Security-Policy">` across all six shipped HTML pages to drop `'unsafe-inline'` from `script-src` while permitting Google Identity Services (`https://accounts.google.com` in `script-src`, `connect-src`, `frame-src`, and `style-src` — GIS injects its own `gsi/style` stylesheet, which a `'self'`-only `style-src` blocks and leaves the button unstyled) alongside Firebase CDN (`https://www.gstatic.com`), Google APIs (`https://apis.google.com`), and the Cloud Run search proxy. Added `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- **Hop-Counted Rate Limiter (`serverless/shared/proxy-logic.js`, `serverless/gcp-cloud-function/index.js`)**: Replaced leftmost `X-Forwarded-For` parsing with `resolveClientIp()`. When `TRUSTED_PROXY=true`, the proxy counts `TRUSTED_PROXY_HOPS` (default `1`) from the right of `X-Forwarded-For`, normalises bracketed IPv6 and `IPv4:port` entries, and falls back to `req.socket.remoteAddress` (or `"shared-proxy"`) when `TRUSTED_PROXY` is unset/false or the header chain is shorter than `TRUSTED_PROXY_HOPS` or malformed.
- **Closed Price Mode (`serverless/gcp-cloud-function/index.js`, `serverless/cloudflare-worker.js`, `scripts/refresh-prices.mjs`, `.github/workflows/refresh-prices.yml`)**: Closed `{"mode": "price"}` by default on Cloud Run (`503 price_mode_disabled` when `PRICE_TOKEN` is unset or blank; constant-time SHA-256 + `crypto.timingSafeEqual` verification of `X-Price-Token` via `safeCompareTokens()` when set) and rejected price mode with `400 price_mode_unsupported` on the Cloudflare Worker. Wired `PRICE_TOKEN` into `scripts/refresh-prices.mjs` and `.github/workflows/refresh-prices.yml`.
- **Byte-Accurate Limits & Malformed JSON Handling (`serverless/`, `js/account.js`, `js/app.js`, `firestore.rules`)**: Enforced `Content-Length <= 6,000,000` at proxy entry, a post-parse `6,000,000`-byte (`MAX_BODY_BYTES`, measured with `Buffer.byteLength`) serialized JSON body limit on Cloud Run, a `4 MiB` decoded binary limit on base64 screenshots with magic-byte MIME verification (`image/jpeg`, `image/png`, `image/webp`, `image/gif`), HTTP `400` responses on malformed JSON, and a `700,000` UTF-8 byte client sync budget (`TextEncoder`) in `js/account.js` with visible sync error states below `firestore.rules`'s `900,000`-character CEL limit. The body ceiling is larger than the image ceiling on purpose: base64 turns a 4 MiB screenshot into roughly 5.6 MB of JSON, so an equal cap would refuse screenshots that `validateImage()` accepts.
- **Proxy Packaging, Runtime & Header Hardening (`serverless/`)**: Moved the Cloud Run Docker build context to `serverless/` (`serverless/gcp-cloud-function/Dockerfile`) so `shared/proxy-logic.js` and `gcp-cloud-function/index.js` are copied directly without the broken `serverless/gcp-cloud-function/shared` symlink; pinned `@google-cloud/functions-framework` to `3.4.0` with a committed `package-lock.json` (`npm ci --omit=dev`); upgraded the container base image to `node:22-slim` running as non-root `USER node` (UID 1000); moved `GEMINI_API_KEY` from the upstream URL query string to the `x-goog-api-key` header; required an allowlisted `Origin` header on search requests; and wrapped service-worker cache writes in `event.waitUntil()`.
- **Unified `2.11.6` Asset Versioning**: Synchronised `?v=2.11.6` across all shipped HTML asset tags, relative ES module imports in `js/*.js`, `js/config.js`, and `sw.js` so modules are never instantiated twice.
- **Rate Limiting Before Body Parsing (`serverless/gcp-cloud-function/index.js`)**: The client IP is resolved and the quota checked before the request body is parsed or re-serialised, so a client that has spent its quota is rejected without paying for JSON work first.
- **Information-Page Generator Keeps the Policy (`scripts/build-info-pages.mjs`)**: The generator now copies the CSP and referrer meta from `index.html`, and gains a `--check` mode that renders the three pages in memory and fails on drift, so regenerating `about.html`, `privacy.html` and `terms.html` can no longer strip the policy. `test/csp.test.mjs` runs `--check`.
- **Browser Suite Waits for the Server (`.github/workflows/test.yml`)**: The `browser` job polls `http://127.0.0.1:8123/index.html` until it answers before starting Playwright, removing a start-up race, and the Google Identity Services test now asserts that no CSP message mentions `style-src` or `accounts.google.com` after the dialog opens, which is what catches a blocked GIS stylesheet.

### Removed
- **Removed `file://` Fallback Bundle & Dead Modules**: Deleted the 1,549-line `js/studio-file-fallback.js` `file://` bundle from `studio.html` and removed unused modules `js/pricing-engine.js` and `js/test-builds.js`.

---

## [2.11.5] - 24/10/2026

### Added
- Expanded full market catalogue coverage across Sri Lankan automotive market: 227 vehicle models across 38 makes.
- Regulatory graphics telemetry: CBSL LTV split bar, DTI speedometer gauge, cashflow spectrum console, vehicle details modal with donut outlay and amortization paydown curve.
- Photo Studio for local cropping, aspect framing (1280x800), and cover selection stored in IndexedDB (`vahanaiq_catalogue_photos`).
- Unified A4 portrait statutory lease quotation print stylesheet under CBSL Directions No. 01 of 2026.
