# Changelog

All notable changes to the VahanaIQ platform are documented in this file.
This project adheres to British English conventions and date format DD/MM/YYYY.

---

## [2.11.6] - 25/10/2026

### Added
- **Externalised Bootstrap (`js/boot.js`)**: Extracted the early theme (`vahanaiq_theme`), aurora animation phase, and `window.__VAHANAIQ_PHOTOS__` readiness promise into `js/boot.js`, loaded before stylesheets on `index.html`, `catalogue.html`, and `studio.html` and precached in `sw.js` (`vahanaiq-v2.11.6`) so no shipped HTML page uses inline `<script>` tags.
- **CSP, Client-IP, Module-Version & Browser Regression Suites**: Added `test/csp.test.mjs`, `test/client-ip.test.mjs`, `test/module-versions.test.mjs`, `test/security.test.mjs`, and the Playwright Chromium browser suite `test/browser/csp.spec.mjs` (verifying zero CSP violations, Google Identity Services iframe attachment, dark theme bootstrap, and photo overlay readiness).
- **Centralised Regulatory Constants (`js/constants.js`)**: Extracted CBSL Directions No. 01 of 2026 statutory down-payment floors, tenures, DTI ceilings, and UI strategy presets into `js/constants.js`.
- **Shared URL Sanitizers (`js/safe-url.js`)**: Consolidated `safeUrl()` and `safeImageUrl()` into `js/safe-url.js`, blocking `javascript:`, `vbscript:`, `data:text/html`, and SVG data URLs.

### Changed
- **CSP Repair & Google Sign-In (`index.html`, `catalogue.html`, `studio.html`, `about.html`, `privacy.html`, `terms.html`)**: Repaired `<meta http-equiv="Content-Security-Policy">` across all six shipped HTML pages to drop `'unsafe-inline'` from `script-src` while permitting Google Identity Services (`https://accounts.google.com` in `script-src`, `connect-src`, and `frame-src`) alongside Firebase CDN (`https://www.gstatic.com`), Google APIs (`https://apis.google.com`), and the Cloud Run search proxy. Added `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- **Hop-Counted Rate Limiter (`serverless/shared/proxy-logic.js`, `serverless/gcp-cloud-function/index.js`)**: Replaced leftmost `X-Forwarded-For` parsing with `resolveClientIp()`. When `TRUSTED_PROXY=true`, the proxy counts `TRUSTED_PROXY_HOPS` (default `1`) from the right of `X-Forwarded-For`, normalises bracketed IPv6 and `IPv4:port` entries, and falls back to `req.socket.remoteAddress` (or `"shared-proxy"`) when `TRUSTED_PROXY` is unset/false or the header chain is shorter than `TRUSTED_PROXY_HOPS` or malformed.
- **Closed Price Mode (`serverless/gcp-cloud-function/index.js`, `serverless/cloudflare-worker.js`, `scripts/refresh-prices.mjs`, `.github/workflows/refresh-prices.yml`)**: Closed `{"mode": "price"}` by default on Cloud Run (`503 price_mode_disabled` when `PRICE_TOKEN` is unset or blank; constant-time SHA-256 + `crypto.timingSafeEqual` verification of `X-Price-Token` via `safeCompareTokens()` when set) and rejected price mode with `400 price_mode_unsupported` on the Cloudflare Worker. Wired `PRICE_TOKEN` into `scripts/refresh-prices.mjs` and `.github/workflows/refresh-prices.yml`.
- **Byte-Accurate Limits & Malformed JSON Handling (`serverless/`, `js/account.js`, `js/app.js`, `firestore.rules`)**: Enforced `Content-Length <= 6,000,000` at proxy entry, a post-parse `4 MiB` (`4,194,304`-byte) serialized JSON body limit on Cloud Run, a `4 MiB` decoded binary limit on base64 screenshots with magic-byte MIME verification (`image/jpeg`, `image/png`, `image/webp`, `image/gif`), HTTP `400` responses on malformed JSON, and a `700,000` UTF-8 byte client sync budget (`TextEncoder`) in `js/account.js` with visible sync error states below `firestore.rules`'s `900,000`-character CEL limit.
- **Proxy Packaging, Runtime & Header Hardening (`serverless/`)**: Moved the Cloud Run Docker build context to `serverless/` (`serverless/gcp-cloud-function/Dockerfile`) so `shared/proxy-logic.js` and `gcp-cloud-function/index.js` are copied directly without the broken `serverless/gcp-cloud-function/shared` symlink; pinned `@google-cloud/functions-framework` to `3.4.0` with a committed `package-lock.json` (`npm ci --omit=dev`); upgraded the container base image to `node:22-slim` running as non-root `USER node` (UID 1000); moved `GEMINI_API_KEY` from the upstream URL query string to the `x-goog-api-key` header; required an allowlisted `Origin` header on search requests; and wrapped service-worker cache writes in `event.waitUntil()`.
- **Unified `2.11.6` Asset Versioning**: Synchronised `?v=2.11.6` across all shipped HTML asset tags, relative ES module imports in `js/*.js`, `js/config.js`, and `sw.js` so modules are never instantiated twice.

### Removed
- **Removed `file://` Fallback Bundle & Dead Modules**: Deleted the 1,549-line `js/studio-file-fallback.js` `file://` bundle from `studio.html` and removed unused modules `js/pricing-engine.js` and `js/test-builds.js`.

---

## [2.11.5] - 24/10/2026

### Added
- Expanded full market catalogue coverage across Sri Lankan automotive market: 227 vehicle models across 38 makes.
- Regulatory graphics telemetry: CBSL LTV split bar, DTI speedometer gauge, cashflow spectrum console, vehicle details modal with donut outlay and amortization paydown curve.
- Photo Studio for local cropping, aspect framing (1280x800), and cover selection stored in IndexedDB (`vahanaiq_catalogue_photos`).
- Unified A4 portrait statutory lease quotation print stylesheet under CBSL Directions No. 01 of 2026.
