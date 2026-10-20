<p align="center">
  <img src="assets/icons/logo-full-lockup.svg" alt="VahanaIQ Logo" width="360">
</p>

# VahanaIQ

**VahanaIQ** is a Sri Lankan vehicle lease calculator and affordability discovery platform. Its down-payment rules follow Central Bank of Sri Lanka (CBSL) Directions No. 01 of 2026, clause 2.1.

🔗 **Live Public App:** [https://akila-w.github.io/vahanaiq/](https://akila-w.github.io/vahanaiq/)

## Features
- **CBSL Regulatory Engine:** 60% minimum down payment (40% maximum LTV) for brand new, reconditioned and recently registered cars and 40% for cars registered over a year, applied to each car automatically; 40%/50% DTI ceilings; terms of up to 84 months (the Direction itself sets no tenure limit).
- **Flat or reducing rates:** Lessors often quote flat rates. Choose the rate type and a flat rate is converted to its reducing-balance equivalent, so rentals, interest and the yearly schedule are right either way.
- **Catalogue with photos and filters:** 147 cars and SUVs sold in Sri Lanka, filterable by make, body type, fuel, seller and published price, with priced cars first and an estimated monthly rental on each.
- **Lease details:** Each vehicle's down payment, amount financed, rental, interest, total paid and a year-by-year balance, plus optional insurance and up-front fees.
- **Smart Multi-Input AI Extraction:** Analyzes vehicle names, comparative queries, raw classified ad text (Ikman, Riyasewana, Patpat, FB Marketplace), or uploaded/clipboard screenshots of Japanese auction sheets.
- **Zero-Touch Studio Photos:** Automatically resolves studio car press photos via local catalog, Wikipedia REST API, and Wikimedia Commons, normalising them onto 8:5 pure white studio plates.
- **One-Click Batch Add & Discovery:** Compare multiple vehicles side-by-side or add all trim levels for any model year in a single click.
- **Inline Table Editing:** Quick-edit LKR prices inline and cycle conditions (Brand New ⇄ Reconditioned ⇄ Registered under a year ⇄ Registered Used) with live recalculation.
- **Google Gemini AI search via a serverless proxy:** The browser never holds an API key. The proxy (`serverless/`) calls `gemini-3.6-flash` by default, set with the `GEMINI_MODEL` environment variable. The monthly price refresh uses a separate model, `PRICE_MODEL` (`gemini-2.5-flash-lite` by default), so it never uses the app's daily free allowance. Everything runs on the Gemini free tier.
- **Sri Lankan Market Availability Gatekeeper:** Validates if searched vehicles are actively traded in Sri Lanka or road-legal (RHD, tax brackets), suggesting local alternatives if not.
- **Hierarchical Selector:** Multi-tier Model Year and Trim selector with condition grading.
- **Dynamic LKR Pricing:** Market valuations automatically update as condition or trim changes.
- **HTML5 Canvas Studio Normaliser:** Automatically centres, scales, and pads any car photo onto an 8:5 pure white plate (`#FFFFFF`) with tyre contact shadow.
- **Private by default, shareable on request:** Loan terms, income, sort and filters are saved in this browser unless you sign in. **Share** builds a link with the terms, filters and vehicles; income and existing payments are left out unless you tick the box. The address bar is cleaned after a shared link opens.
- **Optional Google sign-in and sync:** Signing in keeps your inputs and comparison in your account (Firebase), so another device picks them up. Each change is checked against the account's copy first, so an edit made elsewhere is never overwritten without asking. Signing out removes them from the browser, and **Delete my saved data** removes them from the account.
- **Works offline:** A service worker (`sw.js`) keeps the app's own files, so the calculator opens without a connection. AI search needs one.

## Folder Structure
```
vahanaiq/
├── index.html            # Main web application entry point
├── manifest.json         # PWA manifest (192 and 512px PNG icons)
├── sw.js                 # Offline support: network first, cached copy when offline
├── robots.txt, sitemap.xml
├── firestore.rules       # Who may read and write synced data (paste into the Firebase console)
├── README.md             # Project documentation
├── design-system/
│   └── tokens.json       # Design tokens: colours, type, spacing, radii, shadows (source of truth)
├── docs/
│   └── brand-guide.md    # Brand identity, design system & typography specs
├── css/
│   ├── tokens.css        # Generated from design-system/tokens.json (do not edit)
│   └── style.css         # Responsive styles, reading the token variables
├── js/
│   ├── app.js            # Main application UI and event coordinator
│   ├── calculator.js     # Actuarial lease formulas, DTI & budget room
│   ├── catalog.js        # Frozen original 12 estimates, used for legacy migration
│   ├── market-catalogue.js # Current source-backed model and variant catalogue
│   ├── catalogue-browser.js # Browse, review a quote and select comparison vehicles
│   ├── canvas-utils.js   # 8:5 white studio plate image normaliser
│   ├── gemini.js         # Proxy search call & response schema
│   ├── image-fetcher.js  # Zero-touch Wikipedia & Wikimedia photo resolver
│   ├── storage.js        # Saved vehicles and legacy-key cleanup
│   ├── account.js        # Google sign-in and sync with Firebase (loaded only when used)
│   ├── inputs.js         # Input validation, saved inputs and shareable URL
│   ├── modal.js          # Accessible modal focus handling
│   ├── money-input.js    # Rupee inputs with thousands separators
│   ├── toast.js          # Undo toast
│   └── config.js         # Cloud proxy, Firebase web config and endpoints
├── scripts/
│   ├── build-tokens.mjs          # Builds css/tokens.css from design-system/tokens.json
│   ├── scan-prices.mjs           # Reads the price sites and writes a prices file and a review report
│   ├── price-matches.json        # Which site listing belongs to which catalogue entry
│   ├── refresh-prices.mjs        # Applies researched prices to the catalogue, with checks
│   ├── open-price-pr.sh          # Opens the monthly prices pull request
│   └── price-research-task.md    # Instructions for the monthly Claude research task
├── test/
│   ├── verify.mjs                # App verification suite
│   ├── tokens.test.mjs           # Design tokens are in sync and the only source of CSS variables
│   ├── calculator.test.mjs       # Rentals, flat-rate conversion, legal down payments and schedules
│   ├── account.test.mjs          # Sync decisions, what is uploaded and the Firestore rules' shape
│   ├── refresh-prices.test.mjs   # Price refresh tests against a mocked proxy
│   └── proxy-price-mode.test.mjs # Proxy price mode tests with Gemini stubbed
├── .github/workflows/
│   └── refresh-prices.yml        # Monthly price scan and pull request
├── serverless/
│   ├── cloudflare-worker.js         # Cloudflare Worker proxy ($0 / 100k req/day)
│   └── gcp-cloud-function/index.js  # Google Cloud Run / Cloud Function proxy
└── assets/
    ├── icons/
    │   ├── favicon.svg                       # 64x64 Vector brand icon & favicon
    │   ├── logo-option-1-apex.svg            # 120x120 Standalone brand mark
    │   ├── logo-option-1-apex-transparent.svg# Clean vector mark (transparent)
    │   └── logo-full-lockup.svg              # Full brand lockup & social preview
    └── images/                               # High-resolution studio press photos (12 vehicles)
```

## Running Locally
For deterministic browser QA without calling Gemini, run `node test/serve-qa-fixtures.mjs` and open `http://127.0.0.1:8765`. Searches containing `compare`, `incomplete compare`, `mixed`, `seller`, `unavailable` or `transient` exercise the corresponding fixtures. This local server overrides the proxy URL only in the response it serves; it does not change the app configuration. `?qa-print` previews the print CSS as screen styles for layout checks; it does not emulate pagination or a physical printer.

Search retries a transient upstream failure once on the same model and bounds each attempt to 30 seconds. After changing anything in `serverless/`, redeploy the proxy for the live site to pick it up.

Run the regression suites with:
```bash
node test/verify.mjs
node test/qa-regressions.test.mjs
node test/proxy-price-mode.test.mjs
node test/proxy-search.test.mjs
node test/refresh-prices.test.mjs
node test/tokens.test.mjs
node test/calculator.test.mjs
```

### Changing colours, spacing, radii, shadows, sizes and timings
Edit `design-system/tokens.json`, then run `node scripts/build-tokens.mjs` to regenerate `css/tokens.css`. Don't edit `css/tokens.css` by hand, don't declare custom properties in `css/style.css`, and style new markup with a class rather than a `style` attribute; `test/tokens.test.mjs` checks all three. See `docs/brand-guide.md` for the palette and usage rules.

To run VahanaIQ locally with full ES module support:
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your web browser. No Node.js build step or package installation required.

## Deploying the search proxy (Cloud Run)
From `serverless/gcp-cloud-function/`:
```bash
gcloud run deploy vahanaiq-search --source . --region asia-south1 --allow-unauthenticated --update-env-vars GEMINI_MODEL=gemini-3.6-flash
```
The `GEMINI_API_KEY` environment variable (or secret) must already be set on the service. Upstream errors are written to the Cloud Run logs.

The proxy protects its free Gemini allowance with three settings (the Cloudflare Worker reads the first two as Worker variables):

- `ALLOWED_ORIGINS`: comma-separated sites whose browsers may call it (default `https://akila-w.github.io`). Requests from any other site's pages get 403. Add e.g. `http://localhost:8000` to test against the real proxy locally.
- `RATE_LIMIT`: requests per client IP per 10 minutes on each instance (default 30). Over the limit, the proxy answers 429 `rate_limited`.
- `PRICE_TOKEN`: when set, price mode answers only requests with a matching `X-Price-Token` header. Set the same value as the repository secret `PRICE_TOKEN`, which the price workflow and `scripts/refresh-prices.mjs` send.

Screenshots must be JPEG, PNG, WebP or GIF and under about 4 MB, and error details sent to the browser are shortened.

The same service has a second, **price mode** (`POST {"mode": "price", "queries": ["...", "..."]}`, up to 12 vehicles), used only by the monthly price refresh. It turns on Grounding with Google Search, so Gemini looks up current Sri Lankan prices instead of relying on its training data. It runs on its own model, set with the `PRICE_MODEL` environment variable (`gemini-2.5-flash-lite` by default), whose free daily allowance is separate from the app's. It returns `{ vehicles[], sources[], search_queries[], model }`, where each vehicle lists its trims with price, model year, basis, month and the site the price came from, and `sources` are the web pages Gemini cited. A quota error says whether the daily or per-minute limit was hit (`"quota": "daily"`). Requests without `mode` are handled exactly as before. To use a different model for the refresh, add `PRICE_MODEL=<model>` to `--update-env-vars`. On the free tier it has to be a Gemini 2.x or 2.5 model: AI Studio gives Gemini 3 and newer no free Google Search grounding, and `gemini-2.5-flash` is closed to new users. If Gemini refuses the model, the refresh stops after one request and says so.

## Google sign-in and sync (Firebase)
The Firebase project is `vahanaiq-sign-in`, on the free Spark plan and separate from the proxy's Google Cloud project. Its web config in `js/config.js` is public by design; `firestore.rules` is what protects the data. The app loads Firebase 12.19.0 from Google's CDN only when someone opens the account dialog, or on a later visit once they have signed in.

Each person has one document, `users/{uid}`, holding their inputs and comparison as a JSON string. Photos made in the browser are not uploaded.

When `firestore.rules` changes, publish it: Firebase console → Firestore Database → Rules, paste the file, then **Publish**. In Authentication → Settings → Authorised domains, `akila-w.github.io` must be listed (`localhost` is there by default).

## Monthly catalogue price refresh
On the 1st of each month, the **Refresh catalogue prices** GitHub workflow (`.github/workflows/refresh-prices.yml`) runs [`scripts/scan-prices.mjs`](scripts/scan-prices.mjs). It needs no AI and no API key. It reads the few Sri Lankan sites that publish brand-new prices, chosen because their robots.txt allows it:
- **MG Sri Lanka** (official): prices on the home page
- **GWM Sri Lanka** (official): "Driveaway from" prices on each vehicle page
- **Cartivate Motors** (grey importer): stock listings with price and mileage
- **importcar.lk** (grey importer): a price list, with each car's auction grade, and 0 km stock

Nissan Sri Lanka is left out (its robots.txt blocks nearly every bot except Google's), as are classified marketplaces: ikman's terms forbid copying its content, and Riyasewana and Patpat block automated access. Most official agents (Toyota, Suzuki, Kia, Hyundai, BYD and others) publish no prices at all, so their cars stay "price on request".

Only brand-new cars are priced: 0 km on Cartivate, and a "brand new" grade or 0 km on importcar.lk. Auction-grade cars are reconditioned and are never priced as new. [`scripts/price-matches.json`](scripts/price-matches.json) says which listing belongs to which catalogue entry (a site and a title pattern, plus an optional exclusion). The lowest matching brand-new listing wins.

The scan writes a prices file, and `scripts/refresh-prices.mjs --from-file` applies it with the checks below. The pull request's description adds the scan report:
- prices found for priced entries, with the change and the listing
- priced entries no longer listed (a grey importer may have sold the car; the price is left as it is)
- **first prices to review**: entries with no price yet that a rule matched. These are never applied automatically; add them by hand after checking the listing
- brand-new listings with no catalogue entry, as candidates for new entries

To run it locally (writes `price-scan/`, which git ignores):
```bash
node scripts/scan-prices.mjs
node scripts/refresh-prices.mjs --from-file price-scan/prices.json --dry-run
```

`scripts/refresh-prices.mjs` matches stable vehicle IDs and updates prices and their source/month evidence in `js/market-catalogue.js`. The frozen legacy snapshot is not refreshed. Personal price edits are stored separately and are never replaced by a catalogue update. A vehicle is skipped, and its price left alone, if:
- the price is missing or zero
- no trim matches the catalogue name
- no source page is given
- the price is marked as an estimate
- the price was published more than 6 months ago
- the change is more than ±25%

Prices from a prices file are applied exactly as published. When the matching trims differ only by gearbox (for example "V 1.0L Turbo AT" and "V 1.0L Turbo MT"), the automatic is priced.

Nothing is ever committed to `main`. `scripts/open-price-pr.sh` pushes a `prices/YYYY-MM` branch and opens a pull request. Its description shows the old price, new price, % change and source link for each vehicle, plus the skipped list. Check the changes against the linked pages before merging. No pull request is opened if nothing changed. The workflow needs the repository setting **Settings → Actions → General → allow GitHub Actions to create pull requests**.

### The Claude research task
[`scripts/price-research-task.md`](scripts/price-research-task.md) describes the earlier monthly Claude scheduled task ("VahanaIQ price research", in the Claude desktop app). It writes the same kind of prices file from official sites and news reports. The scan now covers the sites that publish prices, so the task is only worth running for news of launch prices.

To check a prices file locally without writing anything:
```bash
node scripts/refresh-prices.mjs --from-file prices.json --dry-run
```

### The proxy's price mode
`scripts/refresh-prices.mjs` without `--from-file` asks the search proxy's price mode (a Google Search-grounded Gemini lookup, see above). On the free tier no Gemini model can use Google Search any more (20/10/2026), so this route currently fails and the workflow no longer uses it. The proxy URL comes from `config.proxyUrl` in `js/config.js`, or from a `PROXY_URL` repository variable.

The tests use small pages shaped like each site's, a mocked proxy, sample prices files and a stubbed Gemini:
```bash
node test/scan-prices.test.mjs
node test/refresh-prices.test.mjs
node test/proxy-price-mode.test.mjs
node test/catalogue.test.mjs
```
