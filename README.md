<p align="center">
  <a href="https://akila-w.github.io/VahanaIQ/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/icons/logo-full-lockup-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="assets/icons/logo-full-lockup-light.svg">
      <img src="assets/icons/logo-full-lockup.svg" alt="VahanaIQ Logo" width="380">
    </picture>
  </a>
</p>

# VahanaIQ

**VahanaIQ** is a Sri Lankan vehicle lease calculator and affordability discovery platform. Its down-payment rules follow Central Bank of Sri Lanka (CBSL) Directions No. 01 of 2026, clause 2.1.

🔗 **Live Public App:** [https://akila-w.github.io/VahanaIQ/](https://akila-w.github.io/VahanaIQ/)

## Features
- **CBSL Regulatory Engine:** 60% minimum down payment (40% maximum LTV) for brand new, reconditioned and recently registered cars and 40% for cars registered over a year, applied to each car automatically; 40%/50% DTI ceilings; terms of up to 84 months (the Direction itself sets no tenure limit).
- **CBSL Regulatory LTV Split Bar:** Real-time visual split between statutory down-payment floors (60% / 40%) and maximum financed amounts, with dynamic regulatory compliance badges.
- **Interactive Budget & DTI Telemetry Console:** Real-time SVG speedometer gauge (`0%` to `60%` DTI) and stacked Net Income Cashflow Spectrum bar measuring against standard `40%` and stretch `50%` DTI ceilings.
- **Synchronised Range Sliders & Financing Strategy Presets:** Two-way reactive sliders for Interest Rate, Tenure, and Down Payment with instant real-time calculation, plus one-tap financing strategy presets (*Lowest Rental*, *Fast Payoff*, *Minimum Cash*, *100% Cash Purchase*).
- **Flat or reducing rates:** Lessors often quote flat rates. Choose the rate type and a flat rate is converted to its reducing-balance equivalent, so rentals, interest and the yearly schedule are right either way.
- **Curated Catalogue with photos, trims, specs and filters:** 227 models across 38 makes spanning cars, SUVs, MPVs, passenger vans, minibuses and pickups, backed by 504 standardized 8:5 official gallery assets. Filter and search by make, body, fuel, trim, specification, seller route, price status, and calculated budget fit.
- **Quick Sri Lankan Market Segment Filters:** Instant one-tap filter chips (*Under LKR 15M*, *Hybrid & EV*, *High Clearance ≥170mm*, *40% Min Down*, *Official Agent*).
- **Bulk comparison & Head-to-Head Shortlist:** Add the whole eligible catalogue, all search matches or all filtered matches across pages. Pin up to 3 finalists to a sticky Head-to-Head comparison modal with rental, cash upfront, interest, and outlay deltas. Remove all and Undo are available.
- **Interactive Lease Details & Amortisation Curve:** Vehicle details modal with interactive hover inspection for the cost composition donut chart (monthly vs lifetime outlay) and annual amortisation paydown curve.
- **Smart Multi-Input AI Extraction:** Analyzes vehicle names, comparative queries, raw classified ad text (Ikman, Riyasewana, Patpat, FB Marketplace), or uploaded/clipboard screenshots of Japanese auction sheets via Google Gemini.
- **Official-source & Catalogue-Superior Imagery:** The Curated Catalogue serves as the canonical authority for vehicle photography across both the catalogue and calculator, with automatic fallback and Photo Studio overlay integration.
- **Catalogue Photo Studio:** The Photo Studio (`studio.html`, served over HTTP) arranges photos for any catalogue entry by hand: upload your own pictures (file picker, drag-and-drop, or clipboard paste), frame each at 8:5 (*Automatic*, *Vehicle on a white plate*, *Fill the frame*), adjust zoom and nudging, set cover order, and preview changes immediately across the catalogue via IndexedDB.
- **Savings planner:** Plan a deposit or cash purchase using current vehicle prices and your entered income, savings, monthly contributions, fees and insurance. Features an interactive SVG accumulation horizon curve, upfront cost composition bar, target date pacing (`DD-MM-YYYY`), and saved named scenarios.
- **Inline Table Editing:** Quick-edit LKR prices inline and cycle conditions (Brand New ⇄ Reconditioned ⇄ Registered under a year ⇄ Registered Used) with live recalculation.
- **Two-Decimal & South Asian Currency Engine:** Dynamic input formatting with comma grouping, two decimal places (`LKR 12,500,000.00`), and South Asian numbering notation (`1,50,00,000`).
- **A4 Statutory Lease Financing Quotation:** Unified `@media print` stylesheet formatted as an official bank quotation under CBSL Direction No. 01 of 2026.
- **Google Gemini AI search via a serverless proxy:** The browser never holds an API key. The proxy (`serverless/`) calls `gemini-3.6-flash` by default, set with the `GEMINI_MODEL` environment variable. The monthly price refresh uses a separate model, `PRICE_MODEL` (`gemini-2.5-flash-lite` by default), so it never uses the app's daily free allowance. Everything runs on the Gemini free tier.
- **Sri Lankan Market Availability Gatekeeper:** Validates if searched vehicles are actively traded in Sri Lanka or road-legal (RHD, tax brackets), suggesting local alternatives if not.
- **Hierarchical Selector:** Multi-tier Model Year and Trim selector with condition grading.
- **Dynamic LKR Pricing:** Market valuations automatically update as condition or trim changes.
- **HTML5 Canvas Studio Normaliser:** Automatically centres, scales, and pads any car photo onto an 8:5 pure white plate (`#FFFFFF`) with tyre contact shadow.
- **Private by default, shareable on request:** Loan terms, income, sort and filters are saved in this browser unless you sign in. **Share** builds a link with the terms, filters and vehicles; income and existing payments are left out unless you tick the box. The address bar is cleaned after a shared link opens.
- **Optional Google sign-in and sync:** Signing in keeps your inputs and comparison in your account (Firebase Firestore), so another device picks them up with pre-write conflict detection.
- **Works offline:** A service worker (`sw.js`) keeps the app's own files, so the calculator opens without a connection. AI search needs one.

## Folder Structure
```
vahanaiq/
├── index.html            # Main web application entry point (Calculator & Planner)
├── catalogue.html        # Curated catalogue with photos, trims, specs and sourced prices
├── studio.html           # Photo Studio: upload, crop, zoom, order and cover for catalogue photos
├── about.html, privacy.html, terms.html   # Public information pages (generated by scripts/build-info-pages.mjs)
├── manifest.json         # PWA manifest (192 and 512px PNG icons)
├── sw.js                 # Offline support: network first, cached copy when offline
├── robots.txt, sitemap.xml
├── _config.yml           # Which folders GitHub Pages must NOT publish (see Deploying)
├── firestore.rules       # Who may read and write synced data (paste into the Firebase console)
├── README.md             # Project documentation
├── LICENSE               # MIT for the original code; third-party material is excluded
├── SECURITY.md           # How to report a vulnerability, and what is intentional
├── data/                 # Published catalogue records (catalogue.json, identity.json)
├── design-system/
│   └── tokens.json       # Design tokens: colours, type, spacing, radii, shadows (source of truth)
├── docs/                 # Working artefacts: PRD, brand guide, research, review pages. NOT published.
│   ├── PRD.md            # Product Requirements Document for VahanaIQ v2.11.5
│   ├── VahanaIQ_PRD.pdf  # Compiled PDF Product Requirements Document
│   ├── testsprite-standard-prd.json # Standardized machine-readable PRD
│   ├── brand-guide.md    # Brand identity, design system & typography specs
│   ├── catalogue-review.html # Review page for vehicle candidates and pricing evidence
│   └── review-findings.md# Substantiated price evidence and research logs
├── css/
│   ├── tokens.css        # Generated from design-system/tokens.json (do not edit)
│   ├── style.css         # Responsive styles & consolidated A4 statutory print stylesheet
│   ├── curated-catalogue.css # Styles for catalogue.html
│   ├── catalogue-studio.css  # Styles for studio.html (tokens only, no literals)
│   └── test-builds.css   # Diagnostic badge styles for automated testing
├── js/
│   ├── boot.js           # Early theme and photo-overlay bootstrap loaded before stylesheets
│   ├── app.js            # Main application UI, telemetry gauges and event coordinator
│   ├── calculator.js     # Actuarial lease formulas, CBSL floors, DTI & budget room
│   ├── constants.js      # Centralised CBSL regulatory floors, tenures, DTI limits & presets
│   ├── safe-url.js       # Shared safeUrl() and safeImageUrl() scheme and data-URI validators
│   ├── catalog.js        # Frozen original 12 estimates, used for legacy migration
│   ├── market-catalogue.js # Current source-backed model and variant catalogue (281 vehicles)
│   ├── catalogue-data.js # Generated: catalogue.html records (mirrors data/catalogue.json)
│   ├── curated-catalogue.js # Catalogue page: filters, sorting, detail dialog and review
│   ├── catalogue-browser.js # Browse, review a quote and select comparison vehicles
│   ├── bulk-selection.js # Bulk add, filter-match, clear and comparison coordinator
│   ├── catalogue-search.js  # Search indexing and filter queries across catalogue entries
│   ├── vehicle-validation.js # Sri Lankan market availability and CBSL compliance rules
│   ├── catalogue-studio.js   # Photo Studio page: uploads, crop stage, arrangement, export
│   ├── catalogue-photo-overlay.js # Applies studio's saved photos across the app
│   ├── catalogue-photos.js   # Photo record management: order, cover, frames, manifest
│   ├── catalogue-photo-store.js # IndexedDB storage for studio photos (this device only)
│   ├── photo-credits.js  # Canonical vehicle imagery authority, credits and fallbacks
│   ├── official-photo-data.js # Pre-baked manufacturer candidate photo catalog
│   ├── photo-frame.js    # 8:5 frame geometry, shared with bake script and studio
│   ├── planner.js, planner-store.js, savings.js # Savings planner, target dates and saved goals
│   ├── canvas-utils.js   # 8:5 white studio plate image normaliser
│   ├── gemini.js         # Proxy search call & response schema
│   ├── image-fetcher.js  # Official local photo-manifest resolver
│   ├── storage.js        # Saved vehicles, comparisons, and legacy-key cleanup
│   ├── account.js        # Google sign-in and sync with Firebase (loaded only when used)
│   ├── inputs.js         # Input validation, saved inputs and shareable URL
│   ├── modal.js          # Accessible modal focus trapping and keyboard handling
│   ├── money-input.js    # Currency inputs with thousands separators and South Asian notation
│   ├── dates.js, date-picker.js # Date formatting (DD-MM-YYYY) and target-date controls
│   ├── page-transitions.js # View transition coordination
│   ├── toast.js          # Undo toast notifications
│   └── config.js         # Cloud proxy, Firebase web config, APP_VERSION and endpoints
├── scripts/
│   ├── build-tokens.mjs          # Builds css/tokens.css from design-system/tokens.json
│   ├── smoke-deploy.mjs          # Checks the live site really is this release
│   ├── prune-thumbnails.mjs      # Keeps review thumbnails to the ones the site uses
│   ├── scan-prices.mjs           # Reads price sites and writes a prices file and review report
│   ├── price-matches.json        # Which site listing belongs to which catalogue entry
│   ├── refresh-prices.mjs        # Applies researched prices to catalogue, with checks
│   ├── apply-studio-photos.mjs   # Publishes a Photo Studio export into the catalogue
│   ├── build-info-pages.mjs      # Generates about.html, privacy.html and terms.html (--check verifies them)
│   ├── open-price-pr.sh          # Opens the monthly prices pull request
│   └── price-research-task.md    # Instructions for monthly Claude research task
├── test/
│   ├── browser/
│   │   └── csp.spec.mjs          # Browser integration suite: zero CSP violations, GIS & photo overlay
│   ├── verify.mjs                # App verification suite (actuarial, edge cases, deduplication)
│   ├── verify-graphics.test.mjs  # Telemetry gauges, CBSL split bar, SVG speedometer & curves
│   ├── calculator.test.mjs       # Rentals, flat-rate conversion, legal down payments & schedules
│   ├── catalogue-calculator-imagery.test.mjs # Catalogue canonical imagery authority tests
│   ├── e2e-journeys.test.mjs     # Automated end-to-end user journeys (14 test journeys)
│   ├── tokens.test.mjs           # Design tokens are in sync and only source of CSS variables
│   ├── account.test.mjs          # Firebase sync decisions, UTF-8 byte budget & Firestore rules
│   ├── account-session.test.mjs  # Google Sign-In session lifecycle and conflict detection
│   ├── catalogue.test.mjs        # Catalogue model grouping, filters, sorting and detail dialogs
│   ├── catalogue-data.test.mjs   # data/catalogue.json, baked copy and published image tree agree
│   ├── catalogue-studio.test.mjs # Photo Studio frames, records, export and bake script
│   ├── planner.test.mjs          # Savings planner formulas, trajectory curves & target-date pacing
│   ├── print.test.mjs            # A4 statutory quotation print layout & noise suppression
│   ├── copy-privacy.test.mjs     # Privacy safeguards, link stripping & local storage limits
│   ├── savings-bulk.test.mjs     # Bulk catalogue selection & calendar boundary conditions
│   ├── scan-prices.test.mjs      # Monthly price scraping parser verification
│   ├── refresh-prices.test.mjs   # Price refresh tests against a mocked proxy
│   ├── proxy-price-mode.test.mjs # Proxy price mode tests with Gemini stubbed
│   ├── proxy-search.test.mjs     # Proxy AI search schema and fallback verification
│   ├── client-ip.test.mjs        # Hop-counted X-Forwarded-For client IP resolution tests
│   ├── csp.test.mjs              # Content Security Policy and js/boot.js verification
│   ├── module-versions.test.mjs  # Unified APP_VERSION query string & service worker cache checks
│   ├── security.test.mjs         # XSS, URL schemes, rate limits, magic bytes & proxy security
│   └── qa-regressions.test.mjs   # Historical bug fixes and edge-case regression suite
├── .github/workflows/
│   ├── test.yml                  # Continuous integration: runs 24 Node suites + Chromium CSP spec
│   ├── smoke-deploy.yml          # Post-deployment live asset and version smoke tests
│   └── refresh-prices.yml        # Monthly price scan and pull request
├── serverless/
│   ├── shared/
│   │   └── proxy-logic.js                  # Shared schemas, prompts, rate limiting & validation
│   ├── cloudflare-worker.js                # Cloudflare Worker proxy ($0 / 100k req/day)
│   └── gcp-cloud-function/
│       ├── Dockerfile                      # Node 22 slim non-root image (built from serverless/)
│       ├── index.js                        # Google Cloud Run / Cloud Function proxy
│       └── package.json, package-lock.json # Pinned @google-cloud/functions-framework 3.4.0
└── assets/
    ├── icons/
    │   ├── logo-full-lockup.svg              # Universal vector lockup & social preview
    │   ├── logo-full-lockup-light.svg        # Clean vector lockup for light backgrounds
    │   ├── logo-full-lockup-dark.svg         # High-contrast vector lockup for dark backgrounds
    │   ├── logo-v-mark-transparent-light.svg # V-mark brand symbol (light theme)
    │   ├── logo-v-mark-transparent-dark.svg  # V-mark brand symbol (dark theme)
    │   ├── favicon.svg                       # 64x64 Vector brand icon & favicon
    │   ├── apple-touch-icon.png              # Full-bleed iOS touch icon
    │   └── lucide/                           # Bundled vector glyphs
    └── images/
        ├── curated-catalogue/                # Published 8:5 WebP vehicle photography (504 assets)
        └── review-thumbnails/                # 140 official candidate cover thumbnails
```

## Catalogue Photo Studio

The Photo Studio (`studio.html`) is where the catalogue's pictures are arranged by hand. Serve the site over HTTP (`python3 -m http.server 8000` or `node test/serve-qa-fixtures.mjs`), open it from the
catalogue's header (**Photo Studio**) or its footer, pick an entry, and:

- **Add photos** with the *Add Photos* button (any number at once), by dragging files onto the strip,
  or by pasting a screenshot with ⌘V/Ctrl+V. A file must be an image and no larger than 12 MB, and an
  entry keeps at most 12 photos.
- **Frame a photo** by dragging it in the preview, scrolling to zoom (or using the slider, **+**/**−**),
  nudging with the arrow keys, or using **Fit**, **Centre** and **Reset this frame**. **Framing** offers
  *Automatic*, *Vehicle on a white plate* and *Fill the frame (8:5 crop)*.
- **Choose the cover** and the running order with *Cover*, **←** and **→**, and remove a photo with
  *Remove*. The first photo of an entry that has none of its own becomes the cover as soon as it is
  added; after that the cover only changes when you say so.

Everything is kept in this browser's own IndexedDB (`vahanaiq_catalogue_photos`) and never leaves the
device; a photo is not sent to the AI service or synced to an account. **Undo My Changes** restores one
entry's published photos, and the export dialog's *Remove all studio photos* clears the browser's copy.
The catalogue page applies the saved photos as it loads, marks the card **Your Photo** and hides the
manufacturer source link for uploaded photos, which have no published origin.

### Publishing a studio change

The photos on the live site only change when you apply an export:

```bash
# 1. Photo Studio → Export My Photos → Download The Export File   (vahanaiq-studio-photos-DATE.json)
# 2. From the project folder:
node scripts/apply-studio-photos.mjs vahanaiq-studio-photos-DATE.json --dry-run   # report only
node scripts/apply-studio-photos.mjs vahanaiq-studio-photos-DATE.json
```

The export carries the framed pixels drawn by the browser (1280×800 and 640×400 JPEG), so the script
needs no image library. It writes them into `assets/images/curated-catalogue/`, then rewrites
`data/catalogue.json` and `js/catalogue-data.js` **together**, so the two can never drift. Prices,
other entries and the catalogue's own notes are untouched. Review the diff, then commit and push.

The script refuses an export whose photos are missing pixels, whose file names are unsafe, whose entry
id is not in the catalogue, or whose JPEG is incomplete; it never invents a photo or a source. Run the
checks with:

```bash
node test/catalogue-studio.test.mjs    # frames, records, the export and the bake script
node test/catalogue-data.test.mjs      # the catalogue and its baked copy still agree
```

The exports are git-ignored and excluded from the published build, because they carry photo pixels
inline. Keep them as working files.

## Running Locally
For deterministic browser QA without calling Gemini, run `node test/serve-qa-fixtures.mjs` and open `http://127.0.0.1:8765`. Searches containing `compare`, `incomplete compare`, `mixed`, `seller`, `unavailable` or `transient` exercise the corresponding fixtures. This local server overrides the proxy URL only in the response it serves; it does not change the app configuration. `?qa-print` previews the print CSS as screen styles for layout checks; it does not emulate pagination or a physical printer.

Search retries a transient upstream failure once on the same model and bounds each attempt to 30 seconds. After changing anything in `serverless/`, redeploy the proxy for the live site to pick it up.

Run the regression suites with:
```bash
node test/verify.mjs
node test/verify-graphics.test.mjs
node test/qa-regressions.test.mjs
node test/catalogue.test.mjs
node test/client-ip.test.mjs
node test/proxy-search.test.mjs
node test/proxy-price-mode.test.mjs
node test/security.test.mjs
node test/csp.test.mjs
node test/module-versions.test.mjs
node test/refresh-prices.test.mjs
node test/tokens.test.mjs
node test/calculator.test.mjs
node test/account.test.mjs
node test/account-session.test.mjs
node test/copy-privacy.test.mjs
node test/catalogue-data.test.mjs
node test/catalogue-calculator-imagery.test.mjs
node test/catalogue-studio.test.mjs
node test/planner.test.mjs
node test/print.test.mjs
node test/scan-prices.test.mjs
node test/savings-bulk.test.mjs
node test/e2e-journeys.test.mjs
```

### Browser Integration Testing (Playwright)

To assert zero Content Security Policy violations, verify Google Identity Services iframe attachment, and validate runtime photo overlay initialization in a real headless browser:

```bash
# Install Playwright test runner and Chromium browser (one-time setup)
npm install
npx playwright install chromium

# Start the local web server on port 8123 in the background and run the browser spec
python3 -m http.server 8123 &
npx playwright test test/browser/csp.spec.mjs
```

The browser suite starts nothing itself and assumes a local web server at `BASE_URL` (defaulting to `http://127.0.0.1:8123`).

### Changing colours, spacing, radii, shadows, sizes and timings
Edit `design-system/tokens.json`, then run `node scripts/build-tokens.mjs` to regenerate `css/tokens.css`. Don't edit `css/tokens.css` by hand, don't declare custom properties in `css/style.css`, and style new markup with a class rather than a `style` attribute; `test/tokens.test.mjs` checks all three. See `docs/brand-guide.md` for the palette and usage rules.

To run VahanaIQ locally with full ES module support:
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your web browser. No Node.js build step or package installation required.

## Deploying the site (GitHub Pages)

The site is published from this repository by GitHub Pages, which copies **every** file that the
Jekyll build does not exclude. `_config.yml` therefore lists the folders that must never be public:
`docs/` (351 verbatim copies of publisher pages, the review pages and the QA evidence), `test/`,
`scripts/`, `serverless/`, `design-system/` and the catalogue build inputs. **Do not add a
`.nojekyll` file** — it switches Jekyll off and would publish all of them.

Because of that, no shipped page may read from `docs/`. The catalogue is published from `data/`
(`data/catalogue.json`, `data/identity.json`) and `js/catalogue-data.js`; `catalogue.html` renders
from the baked copy and falls back to the JSON. `test/catalogue-data.test.mjs` fails if the two
drift, if a referenced image is missing, or if a shipped file reaches into `docs/`.

After pushing to `main`, GitHub Pages takes a minute or two to rebuild. Confirm the live site really
is the release you just pushed:

```bash
node scripts/smoke-deploy.mjs                 # waits for the version marker, then checks every page
SITE_URL=http://127.0.0.1:8765 SMOKE_ATTEMPTS=1 node scripts/smoke-deploy.mjs   # against a local server
```

It waits for `js/config.js`'s `APP_VERSION` to appear in the served `index.html`, then asserts every
page and asset returns 200 and that `docs/`, `test/`, `scripts/`, `README.md` and `firestore.rules`
are **not** published. `.github/workflows/smoke-deploy.yml` runs the same check on every push, so a
successful-but-stale deployment (which previously occurred when the site sat on v2.10.1 while the checkout was
v2.11.3, now v2.11.6) fails the build instead of passing quietly.

## Repository size and working artefacts

Only what the site serves is committed: the pages, CSS, JS, the two published image folders
(`assets/images/curated-catalogue` and the referenced subset of `assets/images/review-thumbnails`)
and the catalogue records in `data/`. That is roughly 40 MB of images plus the code.

The catalogue build inputs and the review libraries are deliberately **not** committed — they are
well over a gigabyte in total (`assets/images/review-catalogue` 743 MB,
`assets/images/catalogue-rebuild-originals` 499 MB, `assets/images/catalogue` 178 MB,
`assets/images/official-candidates` 18 MB, `docs/catalogue-rebuild/sources` 35 MB of scraped
publisher pages). They are listed in `.gitignore` and in `_config.yml`, so they are neither pushed
nor published. Keep them on disk: the build scripts read them.

`assets/images/review-thumbnails` holds only the 140 covers that `js/official-photo-data.js`
references. The library is generated for every candidate (2,614 files), so after regenerating it
run:

```bash
node scripts/prune-thumbnails.mjs            # delete the unreferenced files
node scripts/prune-thumbnails.mjs --check    # report only; fails if any reappear (also run in CI)
```

Agent tools used to leave checkpoint refs (`refs/cline/checkpoints/…`, `refs/codex/turn-diffs/…`)
holding snapshots of untracked files. That accounted for ~1.3 GB of the object store, and
`.git` was 1.34 GB. Every path under those refs also existed on disk, so nothing unique was in
them; deleting the refs and running `git gc --prune=now` brought `.git` to ~99 MB. Do not
recreate them, and never add one back "just in case" — it re-inflates the repository.

## Deploying the search proxy (Cloud Run)
The proxy runs containerised on Node 22 (`node:22-slim`) as a non-root user (`node`, UID 1000) with `@google-cloud/functions-framework` pinned to `3.4.0` and a committed `package-lock.json`. An `overrides` entry pins `uuid` to `^11.1.1`, because `cloudevents` still declares `uuid ^8.3.2` and that version carries `GHSA-w5hq-g745-h8pq`; `cloudevents` only ever calls `v4()`, so the newer major is safe here.

Because `serverless/gcp-cloud-function/index.js` loads `./shared/proxy-logic.js` and `serverless/gcp-cloud-function/Dockerfile` copies both `gcp-cloud-function/` and `shared/` into `/app`, the Docker build context is **`serverless/`** (not `serverless/gcp-cloud-function/`):

```bash
cd serverless

# The project ID, not the project number: 71962876227 is only the number that
# appears in the service URL, and `--project 71962876227` fails to resolve.
export PROJECT_ID=gen-lang-client-0189736840
export IMAGE=asia-south1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/vahanaiq-search:latest

# On Apple Silicon the default build is an arm64 OCI index, which Cloud Run
# rejects with "must support amd64/linux"; build a single amd64 manifest instead.
docker buildx build --platform linux/amd64 --provenance=false --sbom=false --push \
  -f gcp-cloud-function/Dockerfile -t "$IMAGE" .

gcloud run deploy vahanaiq-search \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region asia-south1 \
  --allow-unauthenticated
```
A routine deploy needs nothing else: `--image` with `--allow-unauthenticated` keeps every literal variable and both secret references, and `--update-env-vars` merges when one changes. `IMAGE` is tagged `:latest`, so rebuild and push before deploying, or the revision silently rolls back to the previous image.

Both `PRICE_TOKEN` and `GEMINI_API_KEY` are read from Secret Manager, so neither appears in shell history, the deploy command, or the revision's plain environment. Create each secret once and grant the Cloud Run service account (`71962876227-compute@developer.gserviceaccount.com`) `roles/secretmanager.secretAccessor`; the Secret Manager API must be enabled first (`gcloud services enable secretmanager.googleapis.com`):

```bash
export PROJECT_ID=gen-lang-client-0189736840

printf '%s' '<price-token>' | gcloud secrets create PRICE_TOKEN \
  --data-file=- --replication-policy=automatic --project "$PROJECT_ID"
printf '%s' '<gemini-api-key>' | gcloud secrets create GEMINI_API_KEY \
  --data-file=- --replication-policy=automatic --project "$PROJECT_ID"

for secret in PRICE_TOKEN GEMINI_API_KEY; do
  gcloud secrets add-iam-policy-binding "$secret" --project "$PROJECT_ID" \
    --member="serviceAccount:71962876227-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

Add the `PRICE_TOKEN` value to the GitHub repository settings as the `PRICE_TOKEN` secret for the monthly price refresh; the Gemini key is needed only by the service.

Converting an existing literal into a secret reference is the one case that needs both flags in a single update, as `PRICE_TOKEN` and `GEMINI_API_KEY` each did once: `--remove-env-vars GEMINI_API_KEY --update-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest`. Cloud Run refuses to change a variable's type otherwise (`Cannot update environment variable [...] to the given type because it has already been set with a different type`).

To rotate the Gemini key, create a new one in Google AI Studio, then add it as a new secret version and roll a revision — `read -s` keeps the value out of shell history:

```bash
read -s NEW_GEMINI_KEY
printf '%s' "$NEW_GEMINI_KEY" | gcloud secrets versions add GEMINI_API_KEY \
  --data-file=- --project "$PROJECT_ID"
unset NEW_GEMINI_KEY
gcloud run services update vahanaiq-search --project "$PROJECT_ID" --region asia-south1 \
  --update-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

Delete the superseded version afterwards (`gcloud secrets versions destroy <version> --secret GEMINI_API_KEY`). Upstream errors are written to the Cloud Run logs.

The live revision is `vahanaiq-search-00043-v65`, deployed 26/10/2026 after rotating `GEMINI_API_KEY` to secret version `3` (created in free-tier project `gen-lang-client-0537485762`, because `gen-lang-client-0189736840` has prepaid billing attached with a zero balance and new keys created there return HTTP `402`) and destroying versions `1` and `2`; it was preceded by `00040-8kd` (the `uuid` override), `00039-h7w` (both secrets in Secret Manager) and `00038-dm6` (the hardened deploy).

There is **no automatic deployment**. Pushing to `main` updates GitHub Pages but does not rebuild or redeploy the proxy; the Cloud Build trigger that once did was deleted on 25/10/2026 after it stopped firing, so the block above is the only route and must be run deliberately after a change to `serverless/`.

### Proxy environment variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ALLOWED_ORIGINS` | `https://akila-w.github.io` | Comma-separated origins permitted to call the proxy. Search requests without an `Origin` header or from unlisted origins receive HTTP `403 forbidden`. Add `http://localhost:8000` when testing locally against a proxy instance. |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Gemini model used for vehicle search queries. |
| `RATE_LIMIT` | `30` | Maximum requests per client IP per 10-minute sliding window on each instance (up to 5,000 tracked IPs). Requests over the limit receive HTTP `429 rate_limited`. |
| `TRUSTED_PROXY` | unset (`false`) | When set to `"true"`, `resolveClientIp()` extracts the client IP from `X-Forwarded-For` by counting `TRUSTED_PROXY_HOPS` from the right. When unset or anything other than `"true"`, `X-Forwarded-For` is ignored and rate limiting keys on `req.socket.remoteAddress` (or `"shared-proxy"`). |
| `TRUSTED_PROXY_HOPS` | `1` | Number of trusted reverse-proxy hops appended to the right of `X-Forwarded-For` when `TRUSTED_PROXY=true`. If the header chain has fewer entries than `TRUSTED_PROXY_HOPS` or contains invalid characters, the proxy falls back to the socket IP. |
| `PRICE_TOKEN` | unset (disabled) | Secret token required in the `X-Price-Token` header for `{"mode": "price"}` requests, compared in constant time (`safeCompareTokens`). When unset or blank, price mode is closed and returns HTTP `503 price_mode_disabled`. |

Request bodies declaring `Content-Length > 6000000` bytes, or serialising to more than 6,000,000 UTF-8 bytes after JSON parsing, are rejected with HTTP `413 image_too_large`. The body ceiling is deliberately larger than the image ceiling because base64 inflates a screenshot by a third: a 4 MiB image arrives as about 5.6 MB of JSON. Attached screenshots must be JPEG, PNG, WebP or GIF, match their magic bytes, and decode to at most 4 MiB (`4,194,304` bytes); one byte over that decoded limit is rejected. Error details sent to the browser are stripped of credentials and shortened to 200 characters.

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

Nissan Sri Lanka is left out (its robots.txt blocks nearly every bot except Google's), as are classified marketplaces: ikman's terms forbid copying its content, and Riyasewana and Patpat block automated access. Coverage varies by agent and model. The separate October review includes official published BYD prices and other individually checked sources; inherited figures without matching evidence remain labelled estimates.

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
node test/catalogue-studio.test.mjs
```

## Current review and ownership

Photo Studio (`studio.html`) is the manual counterpart to the automated build: it uploads, frames, orders and covers an entry's photos, and `scripts/apply-studio-photos.mjs` publishes the result.

The live curated catalogue serves **227 models across 38 makes** with **504 standardized 8:5 WebP gallery assets** (252 full + 252 thumbnails) and 281 market catalogue entries, specified in the official [Product Requirements Document](docs/PRD.md). The earlier October 21 review interface ([docs/catalogue-review.html](docs/catalogue-review.html)) and [review notes](docs/review-findings.md) remain preserved as internal working artefacts with 144 model groups, 191 trim entries and 77 substantiated prices.

VahanaIQ is Akila Wickramasinghe’s personal project. © 2026 Akila Wickramasinghe for original site material; third-party photo, logo and icon rights remain with their owners. See About, Privacy, Terms & notices and Photo Credits in the site. Human-readable dates use friendly British-English dates (for example 24 Oct 2026); storage uses ISO values.
