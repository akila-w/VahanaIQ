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

1. **Content Security Policy & Browser Headers**
   - Every shipped HTML page (`index.html`, `catalogue.html`, `studio.html`, `about.html`, `privacy.html`, `terms.html`) carries an identical `<meta http-equiv="Content-Security-Policy">` tag.
   - Early theme and photo-overlay bootstrapping lives in external `js/boot.js`, so `script-src` allows `'self'`, Firebase CDN (`https://www.gstatic.com`), Google APIs (`https://apis.google.com`), and Google Identity Services (`https://accounts.google.com`) with no `'unsafe-inline'` or `'unsafe-eval'`.
   - `connect-src` is restricted to `'self'`, Google APIs (`https://*.googleapis.com`), Firebase (`https://*.firebaseio.com`, `https://*.firebaseapp.com`), Google Identity Services (`https://accounts.google.com`), and the Cloud Run proxy (`https://vahanaiq-search-71962876227.asia-south1.run.app`).
   - `frame-src` allows only `https://accounts.google.com` (used by the Google Sign-In button iframe), and `object-src` is `'none'`. Because GitHub Pages does not support custom HTTP response headers and browsers ignore `frame-ancestors` in `<meta>` tags, framing of the site itself cannot be blocked at the HTTP header layer.
   - Every shipped page sets `<meta name="referrer" content="strict-origin-when-cross-origin">`.

2. **Serverless Search Proxy (`serverless/`)**
   - Shared logic in `serverless/shared/proxy-logic.js` defines the OpenAPI response schema, request validators, client IP resolver, sliding-window rate limiter, and Gemini API helpers used by both Cloud Run (`serverless/gcp-cloud-function/index.js`) and the Cloudflare Worker (`serverless/cloudflare-worker.js`).
   - Container packaging (`serverless/gcp-cloud-function/Dockerfile`, built with `serverless/` as the Docker build context) runs on `node:22-slim` as non-root `USER node` (UID 1000), with `@google-cloud/functions-framework` pinned to `3.4.0` and a committed `package-lock.json` (`npm ci --omit=dev`).
   - **Body limit:** Both proxies inspect `Content-Length` at entry and reject requests with `Content-Length > 6000000` (6,000,000 bytes, allowing base64 and JSON overhead around a 4 MiB image) with HTTP `413 image_too_large`. After JSON parsing on Cloud Run, the handler also rejects requests where `JSON.stringify(body).length > 4194304` (`MAX_IMAGE_BYTES`, 4 MiB) with HTTP `413 image_too_large`. Note that `@google-cloud/functions-framework` buffers and parses `req.body` before the handler runs, so if `Content-Length` is omitted or chunked, memory is bounded externally by Cloud Run's 32 MiB request limit before the post-parse 4 MiB check executes. Malformed or non-object JSON returns HTTP `400 bad_request`.
   - **Image limit:** `validateImage()` requires `image.mimeType` to be `image/jpeg`, `image/png`, `image/webp`, or `image/gif`, requires `image.data` to be valid base64 whose **decoded binary size is at most 4 MiB** (`MAX_IMAGE_BYTES = 4 * 1024 * 1024` = 4,194,304 bytes; larger images return HTTP `413 image_too_large`), and inspects the first 12 decoded bytes (`detectImageMimeType()`) to confirm the file's magic bytes match the declared MIME type (otherwise HTTP `400 bad_request`).
   - **`TRUSTED_PROXY` and `TRUSTED_PROXY_HOPS`:**
     - `TRUSTED_PROXY` is off by default. When unset or anything other than `"true"`, `resolveClientIp()` ignores `X-Forwarded-For` completely and keys the rate limiter on `req.socket.remoteAddress` (or `"shared-proxy"` when unavailable), so callers cannot spoof `X-Forwarded-For` to rotate rate-limit buckets.
     - When `TRUSTED_PROXY=true`, `resolveClientIp()` counts `TRUSTED_PROXY_HOPS` (default `1`) entries from the right of `X-Forwarded-For` (`entries[entries.length - hops]`). Because Cloud Run and Google Cloud Load Balancing append one entry per hop to the right of `X-Forwarded-For`, earlier (leftmost) entries are caller-controlled and untrusted. The selected entry is normalised (stripping brackets and `IPv4:port` suffixes while keeping IPv6 intact) and validated against `[0-9a-fA-F:.]`; if the chain has fewer than `hops` entries or contains invalid characters, it falls back to `req.socket.remoteAddress` (or `"shared-proxy"`).
   - **Rate limiting:** In-memory sliding window (`RATE_LIMIT`, default 30 requests per 10 minutes per client IP, capped at 5,000 tracked IPs per instance). Because state is held in process memory, limits are per instance and reset on cold starts.
   - **Price mode closed by default:** On Cloud Run, `body.mode === "price"` is rejected with HTTP `503 price_mode_disabled` unless `PRICE_TOKEN` is set to a non-empty value on the service. When `PRICE_TOKEN` is configured, requests must supply a matching `X-Price-Token` header, verified in constant time by hashing both values with SHA-256 and comparing the 32-byte digests with `crypto.timingSafeEqual()` (`safeCompareTokens`, returning HTTP `401 unauthorised` on mismatch). On the Cloudflare Worker, price mode always returns HTTP `400 price_mode_unsupported`.
   - **Origin checks are not authentication:** Search requests must carry an `Origin` header listed in `ALLOWED_ORIGINS` (default `https://akila-w.github.io`); requests without an `Origin` header or from unlisted origins receive HTTP `403 forbidden`. Requiring an `Origin` header enforces browser CORS policy, **not authentication** — any non-browser script can send `Origin: https://akila-w.github.io`. The real cost brakes are the per-instance rate limit, closed-by-default price mode, and upstream Gemini quotas; Firebase App Check would be needed for real client attestation if the proxy is ever abused.
   - **Upstream secret handling:** The proxy sends `GEMINI_API_KEY` in the `x-goog-api-key` HTTP header (never in the URL query string), and `safeDetail()` strips `key=...`, `Bearer ...`, and `projects/...` tokens and truncates upstream error messages to 200 characters.

3. **DOM & Input Sanitization (`js/`)**
   - Interpolated values in `.innerHTML` templates pass through `esc()`.
   - Shared `safeUrl()` and `safeImageUrl()` in `js/safe-url.js` reject dangerous schemes (`javascript:`, `vbscript:`, `data:text/html`, and `data:image/svg+xml`).
   - Dynamic SVG gauges and curves clamp coordinates and angles with `Number.isFinite()`.
   - Actuarial helpers in `js/calculator.js` guard `rental()` against division by zero, clamp `getSettings()` inputs, and cap `yearlySchedule()` at 600 months.

4. **Storage & Device Boundary**
   - Photo Studio uploads (`vahanaiq_catalogue_photos` in IndexedDB, up to 12 MB per file and 12 photos per entry) stay on the device and are never uploaded to the proxy or Firebase.
   - Cloud sync (`firestore.rules` and `js/account.js`) restricts `users/{uid}` to the authenticated owner (`request.auth.uid == uid`) and whitelists fields (`version`, `data`, `updatedAt`). Because `firestore.rules` CEL `request.resource.data.data.size() <= 900000` counts characters rather than UTF-8 bytes, `js/account.js` enforces a stricter `700,000`-byte UTF-8 budget via `TextEncoder` before uploading and surfaces sync errors in the UI.

## What is worth testing

- **The search proxy** (`serverless/gcp-cloud-function/index.js`, `serverless/cloudflare-worker.js`, and `serverless/shared/proxy-logic.js`). It holds the Gemini API key, so anything that leaks the key, bypasses the origin check, price-mode token check, or rate limiter, or turns a malformed request into server-side execution matters most.
- **`firestore.rules`**, which decides who can read or write synced data.
- **The browser app** (`js/`), particularly input handling and anything that renders catalogue or AI-derived text.
- **The service worker** (`sw.js`), which controls what is cached and served offline.

## Things that are intentional, and not vulnerabilities

- **The Firebase web config in `js/config.js` is public by design.** Firebase identifies the project by it; `firestore.rules` is what protects the data, not the config.
- **There is no API key in the browser.** AI search goes through the proxy so that the key never reaches the client. Finding a key in the repository or in bundled JavaScript would be a real finding; finding the Firebase web config is not.
- **The app has no server session.** Sign-in is optional and only syncs a person's own saved inputs and comparison to their own document.
- **The app is unauthenticated for guests.** That is the intended behaviour.
- **The proxy has no authenticated end-user.** It is a public, origin-checked, rate-limited endpoint. Requiring an `Origin` header is not authentication (any script can send one); the real cost brakes are the per-instance rate limit and the closed price mode, and Firebase App Check is the only real attestation if the proxy is ever abused. Its per-instance quotas are a safeguard, not a guarantee; abuse resistance beyond that is a known limitation rather than a defect.

## Please do not

- Run denial-of-service tests, load tests or automated scanners against the live proxy or the live site. The proxy runs on a personal free tier and the quota is shared with real use.
- Access, modify or delete another person's synced data. If you believe you can, report it privately instead of demonstrating it against a real account.
- Copy, scrape or republish the third-party vehicle photographs, brand marks or quoted prices. Those rights belong to their owners and are not granted by this project's licence. See `LICENSE`, and the Terms & notices and Photo Credits in the site.

## Handling of secrets

No API keys, tokens or credentials are stored in this repository. `GEMINI_API_KEY` must be set as an environment variable or secret on the proxy host.

Price mode is closed by default (`503 price_mode_disabled`) unless `PRICE_TOKEN` is configured on the Cloud Run deployment. When configured, callers must supply the token in the `X-Price-Token` header, which is compared in constant time via SHA-256 digests and `crypto.timingSafeEqual`. The monthly price refresh workflow (`.github/workflows/refresh-prices.yml`) passes `secrets.PRICE_TOKEN` in the environment.

`scripts/smoke-deploy.mjs` checks that the working folders which contain scraped publisher pages and internal review material are not published by GitHub Pages.
