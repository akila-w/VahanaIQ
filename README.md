<p align="center">
  <img src="assets/icons/logo-full-lockup.svg" alt="VahanaIQ Logo" width="360">
</p>

# VahanaIQ

**VahanaIQ** is a Sri Lankan vehicle lease calculator and affordability discovery platform. Its down-payment rules follow Central Bank of Sri Lanka (CBSL) Directions No. 01 of 2026, clause 2.1.

🔗 **Live Public App:** [https://akila-w.github.io/vahanaiq/](https://akila-w.github.io/vahanaiq/)

## Features
- **CBSL Regulatory Engine:** 60% minimum down payment (40% maximum LTV) for brand new, reconditioned and recently registered cars, 40% minimum for cars registered over a year, an 84-month tenure cap, 40%/50% DTI ceilings, and LTV warnings.
- **Smart Multi-Input AI Extraction:** Analyzes vehicle names, comparative queries, raw classified ad text (Ikman, Riyasewana, Patpat, FB Marketplace), or uploaded/clipboard screenshots of Japanese auction sheets.
- **Zero-Touch Studio Photos:** Automatically resolves studio car press photos via local catalog, Wikipedia REST API, and Wikimedia Commons, normalising them onto 8:5 pure white studio plates.
- **One-Click Batch Add & Discovery:** Compare multiple vehicles side-by-side or add all trim levels for any model year in a single click.
- **Inline Table Editing:** Quick-edit LKR prices inline and cycle conditions (Brand New ⇄ Reconditioned ⇄ Registered Used) with live actuarial recalculation.
- **Google Gemini AI search via a serverless proxy:** The browser never holds an API key. The proxy (`serverless/`) calls `gemini-3.6-flash` by default, set with the `GEMINI_MODEL` environment variable. The monthly price refresh uses a separate model, `PRICE_MODEL` (`gemini-2.5-flash-lite` by default), so it never uses the app's daily free allowance. Everything runs on the Gemini free tier.
- **Sri Lankan Market Availability Gatekeeper:** Validates if searched vehicles are actively traded in Sri Lanka or road-legal (RHD, tax brackets), suggesting local alternatives if not.
- **Hierarchical Selector:** Multi-tier Model Year and Trim selector with condition grading.
- **Dynamic LKR Pricing:** Market valuations automatically update as condition or trim changes.
- **HTML5 Canvas Studio Normaliser:** Automatically centres, scales, and pads any car photo onto an 8:5 pure white plate (`#FFFFFF`) with tyre contact shadow.
- **Shareable scenarios:** Loan terms, income, sort and filters are saved in the browser and mirrored to the URL, so a link restores the same scenario.

## Folder Structure
```
vahanaiq/
├── index.html            # Main web application entry point
├── manifest.json         # PWA Manifest (multi-size maskable icons)
├── README.md             # Project documentation
├── docs/
│   └── brand-guide.md    # Brand identity, design system & typography specs
├── css/
│   └── style.css         # Modern responsive styles & dark/light theme
├── js/
│   ├── app.js            # Main application UI and event coordinator
│   ├── calculator.js     # Actuarial lease formulas, DTI & budget room
│   ├── catalog.js        # Default 12 Sri Lankan vehicles
│   ├── canvas-utils.js   # 8:5 white studio plate image normaliser
│   ├── gemini.js         # Proxy search call & response schema
│   ├── image-fetcher.js  # Zero-touch Wikipedia & Wikimedia photo resolver
│   ├── storage.js        # Saved vehicles and legacy-key cleanup
│   ├── inputs.js         # Input validation, saved inputs and shareable URL
│   ├── modal.js          # Accessible modal focus handling
│   ├── money-input.js    # Rupee inputs with thousands separators
│   ├── toast.js          # Undo toast
│   └── config.js         # Cloud proxy and endpoint configuration
├── scripts/
│   └── refresh-prices.mjs  # Monthly catalogue price refresh (run by GitHub Actions)
├── test/
│   ├── verify.mjs                # App verification suite
│   ├── refresh-prices.test.mjs   # Price refresh tests against a mocked proxy
│   └── proxy-price-mode.test.mjs # Proxy price mode tests with Gemini stubbed
├── .github/workflows/
│   └── refresh-prices.yml        # Monthly price refresh pull request
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

The same service has a second, **price mode** (`POST {"mode": "price", "queries": ["...", "..."]}`, up to 12 vehicles), used only by the monthly price refresh. It turns on Grounding with Google Search, so Gemini looks up current Sri Lankan prices instead of relying on its training data. It runs on its own model, set with the `PRICE_MODEL` environment variable (`gemini-2.5-flash-lite` by default), whose free daily allowance is separate from the app's. It returns `{ vehicles[], sources[], search_queries[], model }`, where each vehicle lists its trims with price, model year, basis, month and the site the price came from, and `sources` are the web pages Gemini cited. A quota error says whether the daily or per-minute limit was hit (`"quota": "daily"`). Requests without `mode` are handled exactly as before. To use a different model for the refresh, add `PRICE_MODEL=<model>` to `--update-env-vars`. On the free tier it has to be a Gemini 2.x or 2.5 model: AI Studio gives Gemini 3 and newer no free Google Search grounding, and `gemini-2.5-flash` is closed to new users. If Gemini refuses the model, the refresh stops after one request and says so.

## Monthly catalogue price refresh
`.github/workflows/refresh-prices.yml` runs at 14:00 Sri Lanka time on the 1st of each month, just after Gemini's free daily limits reset at midnight Pacific time, and on demand from the Actions tab (**Run workflow**, with an optional dry run). It runs `scripts/refresh-prices.mjs`, which asks the search proxy's price mode (a Google Search lookup, see above) for the brand-new price of each of the 12 built-in vehicles and matches the trim by name. Only the `price` values and `catalogMeta.priceUpdated` in `js/catalog.js` are rewritten; every other field and the file's formatting stay as they are. A vehicle is skipped, and its price left alone, if the answer is missing or zero, no trim matches, the site given for the price is not among the pages Gemini cited, the price is marked as an estimate or was published more than 6 months ago, or the change is more than ±25%. To stay within the Gemini free tier, vehicles are asked about 4 at a time, so a run makes 3 requests, spaced 13 seconds apart. A request that fails is retried twice, honouring Gemini's "retry in" hint. If Gemini's daily free limit is used up, the run stops at once; it also stops after 2 failed requests in a row. When the matching trims differ only by gearbox (for example "V 1.0L Turbo AT" and "V 1.0L Turbo MT"), the automatic is priced.

The workflow never commits to `main`. It pushes a `prices/YYYY-MM` branch and opens a pull request whose description shows the old price, new price, % change and the sources Gemini cited for each vehicle, plus the skipped list. **The prices are AI estimates: check them against the linked sources before merging.** No pull request is opened if nothing changed.

One-time setup: in the repository's **Settings → Actions → General**, allow GitHub Actions to create pull requests, otherwise `gh pr create` is refused. The proxy URL comes from `config.proxyUrl` in `js/config.js`, or from a `PROXY_URL` repository variable if one is set.

To try it locally without writing anything:
```bash
node scripts/refresh-prices.mjs --dry-run
```
This calls the live proxy. The tests use a mocked proxy and a stubbed Gemini instead:
```bash
node test/refresh-prices.test.mjs
node test/proxy-price-mode.test.mjs
```
