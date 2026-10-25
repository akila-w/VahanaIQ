# Changelog

All notable changes to the VahanaIQ platform are documented in this file.
This project adheres to British English conventions and date format DD/MM/YYYY.

---

## [Unreleased] - 25/10/2026

### Security Hardening Pass (`security/hardening-pass`)

A comprehensive security hardening and architectural audit pass was conducted across the VahanaIQ platform (OWASP WSTG v4.2 and ASVS v4.0 L2 alignment, CBSL Directions No. 01 of 2026 regulatory compliance).

#### Added
- **Automated Security Test Suite (`test/security.test.mjs`)**: Dedicated 9-suite regression test framework covering 80+ assertions for HTML/XSS injection, URL scheme hardening, rate limiter sliding windows and LRU bounding, origin validation and CORS spoofing defenses, image type and size validation, resilient malformed JSON recovery, `safeDetail` credential stripping, price mode validation, and serverless proxy security integration. Integrated into `.github/workflows/test.yml`.
- **Constant-Time Authentication Comparison (`SEC-PRX-01`)**: Implemented `safeCompareTokens()` using SHA-256 hashing and `crypto.timingSafeEqual()` in `serverless/gcp-cloud-function/index.js`, eliminating timing side-channel vulnerabilities during `X-Price-Token` verification.
- **Gateway Payload Size Limits (`SEC-PRX-04`)**: Enforced gateway-level `Content-Length` inspection (< 6 MB) with HTTP 413 `image_too_large` responses across both Cloud Run and Cloudflare Worker proxies before body parsing.
- **Shared Serverless Proxy Domain Logic (`SEC-PRX-06`)**: Consolidated shared proxy schemas (`VEHICLE_RESPONSE_SCHEMA`), prompt builders, rate limiting helpers (`createRateLimiter`, `checkRateLimit`), validation helpers, and Gemini utilities into `serverless/shared/proxy-logic.js`, eliminating duplication between the Cloudflare Worker (ES modules) and Google Cloud Run / Cloud Functions (CommonJS).
- **Declarative Content Security Policy (`SEC-DOM-01`)**: Added strict `<meta http-equiv="Content-Security-Policy">` tags across all 6 HTML documents (`index.html`, `catalogue.html`, `studio.html`, `about.html`, `terms.html`, `privacy.html`), restricting script origins to `'self'`, Firebase CDN (`https://www.gstatic.com`), and Google APIs (`https://apis.google.com`), disabling objects and framing (`frame-src 'none'`, `object-src 'none'`).
- **Strict Referrer Policy (`SEC-DOM-03`)**: Added `<meta name="referrer" content="strict-origin-when-cross-origin">` to the `<head>` of all 6 HTML documents to prevent path leakage to third-party endpoints.
- **Resource Hints & Network Preloading (`SEC-DOM-09`)**: Added preload hints for critical stylesheet bundles (`css/tokens.css`, `css/style.css`, `css/curated-catalogue.css`) and script modules (`js/catalogue-data.js`, `js/app.js`, `js/curated-catalogue.js`), alongside `preconnect` and `dns-prefetch` for Firebase CDN, Google APIs, Cloud Firestore, and the Cloud Run search proxy.
- **Centralized Regulatory Constants (`SEC-CALC-02`)**: Created `js/constants.js` centralizing CBSL statutory macroprudential limits (60% passenger / 40% registered commercial down payments, 84-month maximum tenure), financing defaults, DTI boundaries (40% standard / 50% stretch), and UI presets.
- **Progressive Disclosure UI Drawers**: Added accessible collapsible drawers (`drawer-toggle`) for Optional Incidental Costs, Vehicle Valuation Financing Structure, and the Savings Planner on `index.html`.
- **Comparison Table Column Toggle**: Added `toggleColsBtn` to the Comparison panel to toggle full detail columns on demand.

#### Changed
- **URL & Image Scheme Hardening (`SEC-DOM-05`)**: Standardized `safeUrl()` and `safeImageUrl()` in `js/calculator.js`, `js/curated-catalogue.js`, and `js/catalogue-browser.js`; hardened regular expressions to reject `data:text/html` payloads without requiring trailing colons.
- **Actuarial Engine & Boundary Protections (`SEC-CALC-01`)**: Hardened `js/calculator.js` against arithmetic edge cases: division-by-zero protection in `rental()`, non-negative rate fallback, safe defaults and boundary clamping in `getSettings()`, 600-month (50-year) finite tenure bounds in `yearlySchedule()` to prevent memory exhaustion DoS, and maximum safe integer precision bounds in `num()`.
- **DOM Sink Sanitization (`SEC-DOM-04`)**: Audited and sanitized all dynamic `.innerHTML` assignments across `js/app.js`, `js/curated-catalogue.js`, `js/planner.js`, `js/catalogue-browser.js`, and `js/date-picker.js`.
- **Reverse Proxy IP Resolution (`SEC-PRX-02`)**: Added `TRUSTED_PROXY=true` guard for `X-Forwarded-For` extraction in `serverless/gcp-cloud-function/index.js`, preventing forged header rotation while enabling isolated per-client rate limiting behind Cloud Run load balancers.
- **Upstream Credential Stripping (`SEC-PRX-05`)**: Expanded `safeDetail()` in `serverless/shared/proxy-logic.js` to strip Google API keys (`key=[removed]`), authorization tokens (`Bearer [removed]`), and GCP project paths (`projects/[removed]`), truncating error responses to 200 characters.
- **Catalogue Lazy Loading (`SEC-DOM-08`)**: Added `loading="lazy"` across catalogue cards, variant images, and modal thumbnails; preserved eager loading (`loading="eager"`, `fetchpriority="high"`) strictly for first-page above-the-fold cards (`page === 0 && i < 3`) with off-thread `IntersectionObserver` pre-decoding.
- **CI/CD Supply Chain Hardening (`SEC-CI-01`, `SEC-CI-02`)**: Pinned all GitHub Action dependencies to full immutable commit SHAs across `.github/workflows/test.yml`, `.github/workflows/smoke-deploy.yml`, and `.github/workflows/refresh-prices.yml`; enforced explicit least-privilege `permissions: contents: read` on test and smoke workflows.

---

## [2.11.5] - 24/10/2026

### Added
- Expanded full market catalogue coverage across Sri Lankan automotive market: 227 vehicle models across 38 makes.
- Regulatory graphics telemetry: CBSL LTV split bar, DTI speedometer gauge, cashflow spectrum console, vehicle details modal with donut outlay and amortization paydown curve.
- Photo Studio for local cropping, aspect framing (1280x800), and cover selection stored in IndexedDB (`vahanaiq_studio_v1`).
- Unified A4 portrait statutory lease quotation print stylesheet under CBSL Directions No. 01 of 2026.
