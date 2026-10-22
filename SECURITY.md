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
  endpoint. Its per-instance quotas are a safeguard, not a guarantee; abuse resistance beyond
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
set as an environment variable on the proxy host, and an optional `PRICE_TOKEN` guards the
proxy's price mode. `scripts/smoke-deploy.mjs` checks that the working folders which contain
scraped publisher pages and internal review material are not published by GitHub Pages.