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
│   ├── inputs.js         # Input validation, saved inputs and shareable URL
│   ├── modal.js          # Accessible modal focus handling
│   ├── money-input.js    # Rupee inputs with thousands separators
│   ├── toast.js          # Undo toast
│   └── config.js         # Cloud proxy and endpoint configuration
├── scripts/
│   ├── build-tokens.mjs          # Builds css/tokens.css from design-system/tokens.json
│   ├── refresh-prices.mjs        # Applies researched prices to the catalogue, with checks
│   ├── open-price-pr.sh          # Opens the monthly prices pull request
│   └── price-research-task.md    # Instructions for the monthly Claude research task
├── test/
│   ├── verify.mjs                # App verification suite
│   ├── tokens.test.mjs           # Design tokens are in sync and the only source of CSS variables
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
For deterministic browser QA without calling Gemini, run `node test/serve-qa-fixtures.mjs` and open `http://127.0.0.1:8765`. Searches containing `compare`, `incomplete compare`, `mixed`, `seller`, `unavailable` or `transient` exercise the corresponding fixtures. This local server overrides the proxy URL only in the response it serves; it does not change the app configuration. `?qa-print` previews the print CSS as screen styles for layout checks; it does not emulate pagination or a physical printer.

The v2.7.1 QA fixes preserve decimal currency amounts (including when saved or shared), reject missing/zero vehicle prices across individual, batch and saved-entry paths, explain incomplete AI comparisons, treat a zero maximum price as a real limit, and hide the budget legend without income. Search retries a transient upstream failure once on the same model and bounds each attempt to 30 seconds. The search proxy templates now require explicit discovery fields; redeploy the proxy to pick up their comparison-prompt changes.

Run the regression suites with:
```bash
node test/verify.mjs
node test/qa-regressions.test.mjs
node test/proxy-price-mode.test.mjs
node test/proxy-search.test.mjs
node test/refresh-prices.test.mjs
node test/tokens.test.mjs
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

The same service has a second, **price mode** (`POST {"mode": "price", "queries": ["...", "..."]}`, up to 12 vehicles), used only by the monthly price refresh. It turns on Grounding with Google Search, so Gemini looks up current Sri Lankan prices instead of relying on its training data. It runs on its own model, set with the `PRICE_MODEL` environment variable (`gemini-2.5-flash-lite` by default), whose free daily allowance is separate from the app's. It returns `{ vehicles[], sources[], search_queries[], model }`, where each vehicle lists its trims with price, model year, basis, month and the site the price came from, and `sources` are the web pages Gemini cited. A quota error says whether the daily or per-minute limit was hit (`"quota": "daily"`). Requests without `mode` are handled exactly as before. To use a different model for the refresh, add `PRICE_MODEL=<model>` to `--update-env-vars`. On the free tier it has to be a Gemini 2.x or 2.5 model: AI Studio gives Gemini 3 and newer no free Google Search grounding, and `gemini-2.5-flash` is closed to new users. If Gemini refuses the model, the refresh stops after one request and says so.

## Monthly catalogue price refresh
Once a month, a **Claude scheduled task** ("VahanaIQ price research", in the Claude desktop app on Akila's Mac, on his Claude Pro plan) researches eligible priced, brand-new catalogue variants. Entries without a baseline price require individual review before joining automatic refreshes. It follows [`scripts/price-research-task.md`](scripts/price-research-task.md):
- It uses only official agents', distributors', dealers' and importers' own price lists, plus reputable news reports. It doesn't use classified marketplaces: ikman's terms forbid copying its content, and Riyasewana and Patpat block automated access.
- It writes each price, with the page it came from, to a prices file.
- It runs `scripts/refresh-prices.mjs --from-file <prices.json>`, which applies the checks below.
- It opens a pull request with `scripts/open-price-pr.sh`.

The task runs while the Claude app is open. If the app is closed when it's due, it runs on the next launch.

`scripts/refresh-prices.mjs` matches stable vehicle IDs and updates prices and their source/month evidence in `js/market-catalogue.js`. The frozen legacy snapshot is not refreshed. Personal price edits are stored separately and are never replaced by a catalogue update. A vehicle is skipped, and its price left alone, if:
- the price is missing or zero
- no trim matches the catalogue name
- no source page is given
- the price is marked as an estimate
- the price was published more than 6 months ago
- the change is more than ±25%

When the matching trims differ only by gearbox (for example "V 1.0L Turbo AT" and "V 1.0L Turbo MT"), the automatic is priced.

Nothing is ever committed to `main`. `scripts/open-price-pr.sh` pushes a `prices/YYYY-MM` branch and opens a pull request. Its description shows the old price, new price, % change and source link for each vehicle, plus the skipped list. **The prices are AI estimates: check them against the linked sources before merging.** No pull request is opened if nothing changed.

To check a prices file locally without writing anything:
```bash
node scripts/refresh-prices.mjs --from-file prices.json --dry-run
```

### The GitHub workflow (paused)
`.github/workflows/refresh-prices.yml` is the earlier route. It asks the search proxy's price mode (a Google Search-grounded Gemini lookup, see above) and opens the same kind of pull request. **Its monthly schedule is paused** (20/10/2026): Gemini 2.5 Flash and 2.5 Flash Lite are closed to new users, and on the free tier Gemini 3 and newer get no Google Search grounding, so there is no free model for the lookup. It can still be run from the Actions tab (**Run workflow**, with an optional dry run). It needs the repository setting **Settings → Actions → General → allow GitHub Actions to create pull requests**. The proxy URL comes from `config.proxyUrl` in `js/config.js`, or from a `PROXY_URL` repository variable.

The tests use a mocked proxy, sample prices files and a stubbed Gemini:
```bash
node test/refresh-prices.test.mjs
node test/proxy-price-mode.test.mjs
node test/catalogue.test.mjs
```
