# Security policy

VahanaIQ is a personal project. It is a static site on GitHub Pages, a small serverless
search proxy, and optional Google sign-in with Firebase. Security reports are welcome and
will be looked at on a best-effort basis. There is no bug bounty.

## Reporting a vulnerability

Please use GitHub's private reporting for anything exploitable:
**Security → Report a vulnerability** on https://github.com/akila-w/vahanaiq

For everything else (a hardening idea, a misconfiguration, a dependency concern), the public
issue tracker is fine: https://github.com/akila-w/vahanaiq/issues

Do not put secrets, account identifiers, financial details or private screenshots in a public
issue. If you are unsure whether something is sensitive, use private reporting.

## Security architecture & controls

The platform employs defense-in-depth across client, serverless proxy, and cloud storage layers:

1. **Content Security Policy & Browser Headers**
   - Declarative CSP meta tag (`<meta http-equiv="Content-Security-Policy">`) restricts script execution to `'self'`, Firebase CDN (`https://www.gstatic.com`), and Google APIs (`https://apis.google.com`).
   - Network connections are restricted strictly to `'self'`, Google APIs (`https://*.googleapis.com`), Firebase endpoints (`https://*.firebaseio.com`, `https://*.firebaseapp.com`), and the Cloud Run proxy (`https://vahanaiq-search-71962876227.asia-south1.run.app`).
   - Frames and objects are disabled (`frame-src 'none'`, `object-src 'none'`).
   - Strict referrer policy (`<meta name="referrer" content="strict-origin-when-cross-origin">`) is enforced across all HTML documents.

2. **Serverless Search Proxy (`serverless/`)**
   - Consolidated shared proxy logic (`serverless/shared/proxy-logic.js`) enforces strict OpenAPI schemas, rate limiting, and request validation across both Cloud Run and Cloudflare Worker.
   - Pinned dependencies (`@google-cloud/functions-framework: 3.4.0`), committed lockfile, and reproducible builds (`npm ci --omit=dev`) running on Node >=22 (`node:22-slim`).
   - Non-root container execution (`USER node`, UID 1000) dropping root privileges in the Docker image.
   - Container build executed from `serverless/`:
     ```bash
     docker build -f gcp-cloud-function/Dockerfile -t vahanaiq-search .
     ```
   - Configuration via environment variables:
     - `ALLOWED_ORIGINS`: Comma-separated allowlist of origins permitted to use the search endpoint (default: `https://akila-w.github.io`). Requests without an Origin or from unlisted origins receive 403.
     - `GEMINI_MODEL`: Gemini model for vehicle search (default: `gemini-3.6-flash`).
     - `TRUSTED_PROXY`: When `true`, proxy counts trusted proxy hops from the right in `X-Forwarded-For` to resolve client IP. When `false` or unset, falls back strictly to `req.socket.remoteAddress` or `shared-proxy` to prevent spoofed header rotation.
     - `TRUSTED_PROXY_HOPS`: Number of trusted proxy hops from the right when `TRUSTED_PROXY=true` (default: 1).
     - `PRICE_TOKEN`: Secret token required for price mode via the `X-Price-Token` header. When missing or empty, price mode requests are rejected with HTTP 503 (`price_mode_disabled`).
     - `RATE_LIMIT`: Per-instance client IP request limit per 10-minute sliding window (default: 30).
   - Client IP resolution behind reverse proxies is guarded via `TRUSTED_PROXY=true` in `serverless/gcp-cloud-function/index.js`, preventing forged `X-Forwarded-For` rate-limit rotation.
   - Sliding-window rate limiting (30 requests / 10 minutes) with in-memory map bounding (5,000 max entries) protects against memory exhaustion.
   - Gateway-level payload inspection rejects payloads exceeding 6 MB (`413 image_too_large`).
   - Upstream Gemini error details are stripped of API keys (`key=[removed]`), authorization tokens (`Bearer [removed]`), and GCP project IDs (`projects/[removed]`).
   - Price mode authentication (`X-Price-Token`) uses constant-time comparison (`safeCompareTokens` via SHA-256 digests and `crypto.timingSafeEqual`) to prevent timing side-channel attacks.
   - Search mode requires an allowlisted `Origin` header (`isOriginAllowed`). Requiring an `Origin` is not authentication (any script can send one); the real cost brakes are the rate limit and the closed price mode, and Firebase App Check is the only real attestation if the proxy is ever abused.

3. **DOM & Input Sanitization (`js/`)**
   - Strict escaping via `esc()` across all interpolated user, catalogue, and AI data.
   - URL scheme validation via `safeUrl()` and `safeImageUrl()`, rejecting dangerous schemes (`javascript:`, `vbscript:`, `data:text/html`, and active SVG).
   - Dynamic SVG elements clamp coordinates and angles with `Number.isFinite()` to prevent attribute breakouts.
   - Actuarial calculations in `js/calculator.js` enforce division-by-zero guards in `rental()`, non-negative rate fallbacks, and a 600-month cap in `yearlySchedule()` to prevent memory DoS.
   - Centralized regulatory constants in `js/constants.js` eliminate magic numbers.

4. **Storage & Device Boundary**
   - Photo Studio file uploads (`vahanaiq_studio_v1` in IndexedDB) remain 100% device-local and are never transmitted over the network or exposed to AI models.
   - Cloud synchronization (`firestore.rules`) enforces strict authenticated ownership (`request.auth.uid == uid`), document size limits (`<= 900000` characters, with client-side `700000` UTF-8 byte budget in `js/account.js`), and key whitelisting.

5. **Automated Security Verification**
   - Dedicated security test suite (`test/security.test.mjs`) tests 9 critical attack vectors: XSS injection, URL scheme hardening, rate limiter sliding windows & LRU bounding, CORS allowlisting, image MIME/size validation, malformed JSON recovery, credential stripping, price request validation, and proxy integration.
   - Integrated into continuous integration via `.github/workflows/test.yml`.

## What is worth testing

- **The search proxy** (`serverless/gcp-cloud-function/index.js`, and the Cloudflare Worker
  alternative). It holds the Gemini API key, so anything that leaks the key, bypasses the
  origin allow-list or the rate limit, or turns a malformed request into server-side execution
  matters most.
- **`firestore.rules`**, which decides who can read or write synced data.
- **The browser app** (`js/`), particularly input handling and anything that renders catalogue
  or AI-derived text.
- **The service worker** (`sw.js`), which controls what is cached and served offline.

## Things that are intentional, and not vulnerabilities

- **The Firebase web config in `js/config.js` is public by design.** Firebase identifies the
  project by it; `firestore.rules` is what protects the data, not the config.
- **There is no API key in the browser.** AI search goes through the proxy so that the key
  never reaches the client. Finding a key in the repository or in bundled JavaScript would be a
  real finding; finding the Firebase web config is not.
- **The app has no server session.** Sign-in is optional and only syncs a person's own saved
  inputs and comparison to their own document.
- **The app is unauthenticated for guests.** That is the intended behaviour.
- **The proxy has no authenticated end-user.** It is a public, origin-restricted, rate-limited
  endpoint. Requiring an Origin is not authentication (any script can send one); the real cost brakes are the rate limit and the closed price mode, and Firebase App Check is the only real attestation if the proxy is ever abused. Its per-instance quotas are a safeguard, not a guarantee; abuse resistance beyond
  that is a known limitation rather than a defect.

## Please do not

- Run denial-of-service tests, load tests or automated scanners against the live proxy or the
  live site. The proxy runs on a personal free tier and the quota is shared with real use.
- Access, modify or delete another person's synced data. If you believe you can, report it
  privately instead of demonstrating it against a real account.
- Copy, scrape or republish the third-party vehicle photographs, brand marks or quoted prices.
  Those rights belong to their owners and are not granted by this project's licence. See
  `LICENSE`, and the Terms & notices and Photo Credits in the site.

## Handling of secrets

No API keys, tokens or credentials are stored in this repository. A `GEMINI_API_KEY` must be
set as an environment variable on the proxy host.

Price mode is closed unless `PRICE_TOKEN` is configured on the proxy deployment. If `PRICE_TOKEN`
is missing or empty, price mode requests are rejected with HTTP 503 (`price_mode_disabled`).
When configured, callers must supply the token in the `X-Price-Token` header, which is compared
in constant time to prevent timing side-channel attacks. The monthly price refresh workflow
(`.github/workflows/refresh-prices.yml`) requires the matching `PRICE_TOKEN` repository secret.

`scripts/smoke-deploy.mjs` checks that the working folders which contain scraped publisher pages
and internal review material are not published by GitHub Pages.
