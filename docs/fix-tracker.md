# VahanaIQ Security Hardening & Fix Tracker

**Branch:** `fix/csp-and-proxy-hardening`  
**Base commit:** `f60c302` (`main`)  
**Updated:** 25/10/2026 (review follow-up in `1b92cec`)  

This document records the actual state of each item from the October 2026 security review and hardening pass, the commit SHA that implements it on this branch, the test or command that verifies it locally, and the residual risks that remain by design or pending deployment.

---

## Fix-Tracker Table

| Item | State | Commit SHA | Test or command that proves it |
| :--- | :--- | :--- | :--- |
| **SEC-DOM-01** — Move inline `<head>` bootstrap into `js/boot.js`, remove `'unsafe-inline'` from `script-src`, and allow Google Identity Services (`https://accounts.google.com` in `script-src`, `connect-src`, `frame-src`) across all 6 HTML pages | Fixed | `4c5e69f`, `1d13ad6`, `fc9ea53` | `node test/csp.test.mjs && npx playwright test test/browser/csp.spec.mjs` |
| **SEC-DOM-02** — Clickjacking protection (`frame-ancestors` / `X-Frame-Options`) via `<meta>` CSP on GitHub Pages (browsers ignore `frame-ancestors` in `<meta>` tags, `frame-src` only governs child iframes, and GitHub Pages does not support custom HTTP response headers) | Not applicable | `1d13ad6` | `node test/csp.test.mjs` |
| **SEC-DOM-03** — Enforce `<meta name="referrer" content="strict-origin-when-cross-origin">` across all 6 shipped HTML pages | Fixed | `4c5e69f` | `node test/security.test.mjs` |
| **SEC-DOM-04** — Escape dynamic interpolations in `.innerHTML` sinks via `esc()` across `js/app.js`, `js/curated-catalogue.js`, `js/planner.js`, `js/catalogue-browser.js`, and `js/date-picker.js` (`.innerHTML` sinks remain in use rather than declarative DOM nodes) | Partly fixed | `4c5e69f` | `node test/security.test.mjs && node test/verify.mjs` |
| **SEC-DOM-05** — Consolidate `safeUrl()` and `safeImageUrl()` in `js/safe-url.js` (blocking `javascript:`, `vbscript:`, `data:text/html`, and SVG data URLs) and remove dead modules (`js/pricing-engine.js`, `js/test-builds.js`) | Fixed | `4c5e69f`, `3723246` | `node test/security.test.mjs && node test/verify.mjs` |
| **SEC-DOM-06** — Keep Photo Studio uploads device-local in IndexedDB (`vahanaiq_catalogue_photos`, max 12 MB per file, max 12 photos per entry) and remove the 1,549-line `js/studio-file-fallback.js` `file://` bundle | Fixed | `4c5e69f`, `45713e5` | `node test/catalogue-studio.test.mjs && node test/e2e-journeys.test.mjs` |
| **SEC-DOM-07** — Clamp dynamic SVG coordinates and angles with `Number.isFinite()` in `js/app.js` and `js/planner.js` | Fixed | `4c5e69f` | `node test/verify-graphics.test.mjs && node test/planner.test.mjs` |
| **SEC-DOM-08** — Default catalogue card and modal images to `loading="lazy"`, keeping `loading="eager"` and `fetchpriority="high"` only on the first 3 above-the-fold cards | Fixed | `4c5e69f` | `node test/catalogue.test.mjs && node test/e2e-journeys.test.mjs` |
| **SEC-DOM-09** — Add resource hints (`preload`, `modulepreload`, `preconnect`, `dns-prefetch`) and unify all HTML, ES module import, and service-worker asset versions on `?v=2.11.6` so modules are not loaded twice | Fixed | `4c5e69f`, `7d69a65` | `node test/module-versions.test.mjs` |
| **SEC-PRX-01** — Close price mode by default (`503 price_mode_disabled` when `PRICE_TOKEN` is unset on Cloud Run; `400 price_mode_unsupported` on Cloudflare Worker) and verify `X-Price-Token` in constant time (`safeCompareTokens` via SHA-256 + `crypto.timingSafeEqual`) | Fixed | `4c5e69f`, `448a19f` | `node test/proxy-price-mode.test.mjs && node test/refresh-prices.test.mjs && node test/security.test.mjs` |
| **SEC-PRX-02** — Resolve client IP by counting `TRUSTED_PROXY_HOPS` (default `1`) from the right of `X-Forwarded-For` when `TRUSTED_PROXY=true` (`resolveClientIp`), falling back to socket IP when unset; rate limiting remains in-memory per instance | Partly fixed | `4c5e69f`, `dcca22a` | `node test/client-ip.test.mjs && node test/proxy-search.test.mjs && node test/security.test.mjs` |
| **SEC-PRX-03** — Enforce exact `ALLOWED_ORIGINS` matching (`isOriginAllowed`) and require an allowlisted `Origin` header on search requests in both Cloud Run and Cloudflare Worker (browser CORS gate only, not client authentication) | Partly fixed | `4c5e69f`, `24f3328` | `node test/proxy-search.test.mjs && node test/security.test.mjs` |
| **SEC-PRX-04** — Enforce `Content-Length <= 6,000,000` pre-check, `6,000,000`-byte (`MAX_BODY_BYTES`) post-parse serialized JSON body cap measured with `Buffer.byteLength`, `4 MiB` decoded base64 image limit, magic-byte MIME verification (`JPEG`/`PNG`/`WebP`/`GIF`), and `400` on malformed JSON (Functions Framework still buffers up to Cloud Run's 32 MiB cap before handler execution when `Content-Length` is omitted) | Partly fixed | `4c5e69f`, `a2d1cc8`, `8793af5` | `node test/security.test.mjs && node test/proxy-search.test.mjs` |
| **SEC-PRX-05** — Send `GEMINI_API_KEY` via `x-goog-api-key` header instead of URL query string and strip `key=`, `Bearer`, and `projects/` identifiers from upstream errors via `safeDetail()` | Fixed | `4c5e69f`, `8793af5` | `node test/proxy-search.test.mjs && node test/proxy-price-mode.test.mjs && node test/security.test.mjs` |
| **SEC-PRX-06** — Consolidate proxy logic in `serverless/shared/proxy-logic.js`, remove broken `serverless/gcp-cloud-function/shared` symlink, build Docker image from `serverless/` on `node:22-slim` as non-root `USER node` with `@google-cloud/functions-framework` pinned to `3.4.0` and lockfile | Fixed | `4c5e69f`, `b0e880b` | `node test/proxy-search.test.mjs && node test/proxy-price-mode.test.mjs` |
| **SEC-CALC-01** — Guard `rental()` against division by zero, clamp `getSettings()` inputs, and cap `yearlySchedule()` at 600 months | Fixed | `4c5e69f` | `node test/calculator.test.mjs && node test/verify.mjs` |
| **SEC-CALC-02** — Centralise CBSL Directions No. 01 of 2026 macroprudential floors, tenures, DTI limits, and presets in `js/constants.js` | Fixed | `4c5e69f` | `node test/calculator.test.mjs` |
| **SEC-DB-01** — Enforce `700,000` UTF-8 byte client sync limit via `TextEncoder` in `js/account.js` with visible failure states; `firestore.rules` `data.size() <= 900000` counts CEL characters on a single `users/{uid}` document | Partly fixed | `4c5e69f`, `a2d1cc8` | `node test/account.test.mjs` |
| **SEC-DB-02** — Wrap `localStorage` JSON parsing in `try/catch` with schema recovery (`cleanPlanner()`, default input fallbacks) | Fixed | `4c5e69f` | `node test/verify.mjs && node test/planner.test.mjs` |
| **SEC-DB-03** — Purge cached sign-in keys (`vahanaiq_account_v1`, `vahanaiq_synced_v1`), cancel pending sync timers, and isolate departing account state on sign-out | Fixed | `4c5e69f` | `node test/account-session.test.mjs` |
| **SEC-SW-01** — Restrict `sw.js` caching to same-origin `GET` responses with `response.ok && response.type === "basic"` inside `event.waitUntil()`, excluding `/docs/` and `/assets/images/review-` | Fixed | `4c5e69f`, `310ad2a` | `node test/module-versions.test.mjs && node test/copy-privacy.test.mjs` |
| **SEC-SW-02** — Precache `js/boot.js?v=2.11.6` in `sw.js` (`CACHE = "vahanaiq-v2.11.6"`) and delete prior `vahanaiq-*` caches on activate | Fixed | `7d69a65`, `310ad2a` | `node test/module-versions.test.mjs` |
| **SEC-CI-01** — Declare explicit top-level `permissions: contents: read` in `test.yml` and `smoke-deploy.yml`, scoping write permissions solely to `refresh-prices.yml` | Fixed | `4c5e69f` | `grep -n "permissions:" .github/workflows/*.yml` |
| **SEC-CI-02** — Pin GitHub Actions (`actions/checkout`, `actions/setup-node`) to full commit SHAs across all workflows | Fixed | `4c5e69f` | `grep -n "uses:" .github/workflows/*.yml` |
| **SEC-CI-03** — Verify unpublished paths (`docs/`, `test/`, `scripts/`, `README.md`, `firestore.rules`) return HTTP 404 in `scripts/smoke-deploy.mjs` | Fixed | `022429c` | `SITE_URL=http://127.0.0.1:8765 SMOKE_ATTEMPTS=1 node scripts/smoke-deploy.mjs` |
| **SEC-TST-01** — Add unit and browser regression suites for security controls (`test/security.test.mjs`, `test/csp.test.mjs`, `test/client-ip.test.mjs`, `test/module-versions.test.mjs`, `test/browser/csp.spec.mjs`) | Fixed | `4c5e69f`, `1d13ad6`, `7d69a65`, `dcca22a`, `fc9ea53` | `node test/security.test.mjs && node test/csp.test.mjs && node test/client-ip.test.mjs && node test/module-versions.test.mjs && npx playwright test test/browser/csp.spec.mjs` |
| **SEC-OPS-01** — Deploy the hardened `serverless/` container to Cloud Run and merge `2.11.6` to `main` | Fixed | `b543d23` | Revision `vahanaiq-search-00038-dm6` (25/10/2026, project `gen-lang-client-0189736840`) serves 100% of traffic with `TRUSTED_PROXY=true`, `TRUSTED_PROXY_HOPS=1` and `PRICE_TOKEN` from Secret Manager; no `Origin` → `403 forbidden`, foreign origin → `403`, missing or wrong `X-Price-Token` → `401`, 7,000,000-byte body → `413`, 31st request → `429`, real search → `200`. GitHub Pages serves `2.11.6`. |
| **SEC-OPS-02** — Move `GEMINI_API_KEY` from a literal environment variable to Secret Manager, and rotate the key that had been readable in the revision configuration | Partly fixed | `—` | Revision `vahanaiq-search-00039-h7w` reads `GEMINI_API_KEY` and `PRICE_TOKEN` from Secret Manager, and a live search returns `200` through the secret; `00040-8kd` preserves both secret references. Rotation is outstanding: create a key in Google AI Studio, `gcloud secrets versions add GEMINI_API_KEY`, roll a revision, then destroy version 1 |
| **SEC-OPS-03** — Delete the dormant Cloud Build trigger `rmgpgab-vahanaiq-search-asia-south1-akila-w-vahanaiq--malni`, which had produced no build since 22/10/2026 and so no longer redeployed the proxy on a push to `main` | Fixed | `—` | `gcloud builds triggers list --project gen-lang-client-0189736840` returns empty; `gcloud builds list --limit 5` shows no build after 22/10/2026 |
| **SEC-DEP-01** — Dependabot alert 1: `uuid < 11.1.1` (`GHSA-w5hq-g745-h8pq`, missing buffer bounds check in `v3`/`v5`/`v6` when `buf` is provided), reached through `@google-cloud/functions-framework` 3.4.0 → `cloudevents` → `uuid ^8.3.2` | Fixed | `—` | `cloudevents` 10.0.0 still pins `^8.3.2`, so an upstream bump does not clear it; the only call is `v4()` with no buffer at `cloudevents/dist/event/cloudevent.js:35`, outside the advisory. Pinned `"overrides": { "uuid": "^11.1.1" }` in `serverless/gcp-cloud-function/package.json`: `npm audit --omit=dev` reports 0 vulnerabilities, `npm ls uuid` resolves `11.1.1 overridden`, a scratch `CloudEvent` gets a valid v4 id, the amd64 image loads `uuid` 11.1.1 and answers all gates (`403`, `403`, `401`, `413`), and all 24 suites exit 0. Deployed as revision `vahanaiq-search-00040-8kd` from the same image digest (`sha256:e23e9d10…`), where the live gates returned `403`, `403`, `401`, `413` and a real search returned `200`; Dependabot reports 0 open alerts |

---

## Review follow-up (25/10/2026)

Verifying this branch against the audit IDs above found five defects that the earlier passes had missed. All are fixed in `1b92cec` and covered by tests.

| Defect | Effect before the fix | Fix | Proof |
| :--- | :--- | :--- | :--- |
| `style-src 'self' 'unsafe-inline'` omitted `https://accounts.google.com` on all six pages | Google Identity Services injects `<link href="https://accounts.google.com/gsi/style">`; CSP blocked it, so the Sign in with Google button rendered unstyled while the iframe still attached | Added the origin to `style-src` and to the canonical policy in `test/csp.test.mjs` | `node test/csp.test.mjs`; the GIS case in `test/browser/csp.spec.mjs` fails without the fix and passes with it |
| Post-parse body cap compared `JSON.stringify(body).length` (UTF-16 units) with `MAX_IMAGE_BYTES` (4,194,304) | Any screenshot above roughly 3 MiB was refused with `413 image_too_large`, although `validateImage()` allows 4 MiB; multi-byte text was under-counted | New `MAX_BODY_BYTES` (6,000,000 UTF-8 bytes) measured with `Buffer.byteLength`, shared with the worker and the `Content-Length` guard | `node test/security.test.mjs` covers a full-size 4 MiB image passing the gate, one group over the image limit failing, and 3.1 million two-byte characters (6.2 MB) being refused |
| `scripts/build-info-pages.mjs` emitted no CSP and no referrer meta | One run stripped both from `about.html`, `privacy.html` and `terms.html`, breaking the identical-policy assertion | Generator copies both meta tags from `index.html` and gains `--check`, which fails on drift | `node scripts/build-info-pages.mjs --check` and TEST 5 of `node test/csp.test.mjs` |
| Rate limiting ran after `JSON.parse` and a second `JSON.stringify` | A client over quota still cost a full parse and re-serialise before the `429` | IP resolution and quota check moved ahead of validation and re-serialisation (the `Content-Length` guard stays first). It cannot precede parsing: the functions framework parses the JSON body before the handler is invoked | `node test/proxy-search.test.mjs`, `node test/security.test.mjs` |
| `safeImageUrl()` allowed `data:image/svg+xml` while SEC-DOM-05 said SVG data URLs were blocked | Documentation overstated the guard | `safeImageUrl()` now rejects `data:image/svg` (case-insensitive); ordinary `data:image/jpeg` uploads still pass | `node test/security.test.mjs`, TEST 2.6 |

Also in `1b92cec`: the README deploys `PRICE_TOKEN` with `--set-secrets` instead of an inline `--update-env-vars` value (which exposed the token in shell history and the revision's plain environment), the `browser` CI job polls the local server before Playwright starts, and the GIS browser test asserts that no CSP console message mentions `style-src` or `accounts.google.com`.

---

## Production deployment verification (25/10/2026)

`2.11.6` merged to `main` as `b543d23` and GitHub Pages serves it (`?v=2.11.6` on every asset, `sw.js` caching `vahanaiq-v2.11.6`, `style-src` carrying `https://accounts.google.com`). The proxy was deployed by hand as `vahanaiq-search-00038-dm6` in project `gen-lang-client-0189736840` (project number `71962876227`). A follow-up revision, `vahanaiq-search-00039-h7w`, moved `GEMINI_API_KEY` out of the literal environment and into Secret Manager, and `vahanaiq-search-00040-8kd` (26/10/2026) rebuilt the same image with the `uuid` override; all three were probed against the live URL:

| Probe | Result |
| :--- | :--- |
| `POST /` with no `Origin` | `403 forbidden` — "Search requests must come from the VahanaIQ site" |
| `POST /` with `Origin: https://evil.example` | `403 forbidden` — "This origin may not use the VahanaIQ search proxy" |
| `{"mode":"price"}` with no or a wrong `X-Price-Token` | `401 unauthorised` (the token is configured, so the `503 price_mode_disabled` path no longer applies) |
| 6,200,000-byte and 7,000,000-byte bodies | `413 image_too_large`, before any Gemini call |
| 5,720,000-byte body (approximately a 4 MiB screenshot in base64) | parsed, then rejected only by image-type validation, so the byte ceiling does not refuse a legitimate 4 MiB screenshot |
| 31st request from one client IP | `429 rate_limited` with `Access-Control-Allow-Origin` preserved |
| Real search from the site origin | `200` with a schema-valid response |

Two behaviours differ from what the audit text implied, and both are now recorded rather than fixed:

1. **Rate limiting cannot precede parsing.** `@google-cloud/functions-framework` parses the JSON body before the handler runs, so the quota check saves validation and re-serialisation, not the parse itself. The body ceiling is still enforced: `Content-Length` is checked first, then the post-parse UTF-8 byte count.
2. **Malformed JSON is answered by the framework, not by `index.js`.** Invalid syntax returns the framework's plain `400 Bad Request` HTML before the handler sees it; the handler's JSON `400 {"detail":"Malformed JSON body"}` covers valid-but-non-object bodies such as `[]` or `123`. Both refuse the request, but only the second carries the documented JSON error shape.

The deploy was manual because the continuous-deployment path was already dead: the Cloud Build trigger on `main` had no build after 22/10/2026, which is why production stayed on revision `00036` while `main` moved to `2.11.5` and then `2.11.6`. Deleting it was chosen over repairing it, since a trigger that silently stops firing is worse than no trigger and the manual sequence in `README.md` is the supported route.

---

## Known residual risk

1. **Origin checks are not authentication:** Both proxies require an allowlisted `Origin` header on search requests (`ALLOWED_ORIGINS`, defaulting to `https://akila-w.github.io`), which stops third-party websites from calling the proxy from a victim's browser. It does not authenticate the caller: any non-browser script or CLI tool can send `Origin: https://akila-w.github.io`.
2. **In-memory rate limits are per instance:** Rate limiting (`RATE_LIMIT`, default 30 requests per 10-minute sliding window per client IP, capped at 5,000 tracked IPs) is stored in process memory inside each Cloud Run container or Cloudflare Worker isolate. Counters reset on cold starts and are not shared across instances when Cloud Run scales horizontally.
3. **No request authentication on search:** Because the calculator and AI search are designed to work without signing in, search requests carry no user token or attestation. Cost and abuse exposure are bounded by the per-instance IP rate limiter, closed-by-default price mode (`PRICE_TOKEN`), and upstream Gemini API quotas rather than per-user authentication (enforcing real client attestation would require Firebase App Check or mandatory sign-in).
4. **Firestore document ceiling:** Each signed-in user's synced state lives in a single Firestore document (`users/{uid}`) with payload string `data`. In `firestore.rules`, Common Expression Language `request.resource.data.data.size() <= 900000` measures Unicode code points rather than UTF-8 byte length. Although `js/account.js` enforces a stricter `700,000`-byte UTF-8 budget via `TextEncoder` so multi-byte text (such as Sinhala or Tamil) does not hit Firestore's 1 MiB document ceiling, a caller writing directly to the Firestore REST API with their own Firebase ID token is constrained only by the 900,000-character rule and Firestore's 1 MiB hard limit.
