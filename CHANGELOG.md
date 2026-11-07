# Changelog

All notable changes to the VahanaIQ platform are documented in this file.
This project adheres to British English conventions and date format DD/MM/YYYY.

---

## [Unreleased] - 01/11/2026

Landing introduction, a redesigned guided setup and an answer-first Lease page, from the VahanaIQ Redesign canvas. No calculation, threshold or rounding changed, and numbers read as before unless a visitor chooses otherwise in Settings. Asset version stays 2.12.0; the offline shell moves to revision `vahanaiq-v2.12.0-offline-15`.

### Added
- **Hero result card**: the landing page shows the answer VahanaIQ gives on round example figures (a LKR 12,000,000 car and LKR 350,000 take-home pay), with the rental counting up and the debt-to-income bar filling. It replaces the photo of one car, so no vehicle is singled out.
- **Information pages**: a shared header, a side list and a reading column. How Rentals Are Worked Out and Prices and Sources are now their own pages, `rentals.html` and `prices.html`, with their wording unchanged.
- **Settings**: a section list, a live preview that works out a real rental from the choices made, and a sync row that opens the account dialog.
- **Showroom**: a Clear Brand button and a Compare Monthly Rentals link once cars are on the shortlist.
- **Settings page (`settings.html`)**: theme, text size, motion, loan defaults, Showroom choices, tips, data download and delete. Numbers and Dates choose the currency label, whole rupees, millions or lakhs, and the date format; these change what is displayed, never a calculation.
- **Phone tabs**: Home, Lease, Showroom and Settings stay at the bottom of the screen on phones.
- **Showroom**: a brand strip that filters by brand, the monthly rental and fit on each card, the terms in use with Change Terms, and Only Cars Within My Budget.
- **About page**: How Rentals Are Worked Out, and Prices and Sources.
- **Photo Studio is the administrator's alone**: `studio.html` is an ordinary not-found page unless the signed-in Firebase account matches `ADMIN_UID`. Studio links, photo tools, guided tour, help and policy text no longer appear for anyone else. The check decides what the page shows; the studio's photos stay in that browser and there is no server data behind it.
- **Landing introduction on the Lease page (`index.html`)**: first-time visitors see what VahanaIQ is before the calculator: a headline, an example rental for a real Showroom car, two belts of Showroom cars with their rentals at the planner's default terms, how it works, and Get Started. The hero runs a slow emerald gradient with a drifting Apex monogram matrix; every animation moves only transform, there is a Pause Animation button, and reduced motion stops it all. `js/boot.js` decides before first paint (`html.landing-pending`), so returning visitors, anyone who finished or dismissed setup, and `?onboarding` links go straight to the calculator; `?welcome` shows the introduction again.
- **Quick picks in setup**: Compact SUVs, Hybrids and Electric, and Family SUVs add real catalogue cars to the shortlist, which the visitor still reviews.
- **Answer first on the Lease page**: the chosen car's monthly rental, debt-to-income meter, down payment, amount financed, income needed and the budget ceiling now lead the page. Every figure comes from the rows the comparison already uses. Show Above picks the car, Undo Removal restores a removed one, and an empty shortlist offers the ready-made shortlists. Behind the solid cards, drifting emerald glows and a faint monogram grid move slowly and stop under reduced motion.
- **Browser checks** for the landing (first visit, dismissal, returning visitors, quick picks, pause and reduced motion) in `test/browser/onboarding.spec.mjs`.

### Changed
- **Planner layout**: Loan Terms and a new Your Income card sit beside the answer. Flat rates, presets, insurance, fees and the valuation structure moved under Advanced, the gauge and cash flow under Full Budget Breakdown, and filters behind Filters & Sort. No control was removed and no sum changed.
- **Phone header**: the brand and Guided Setup only. The theme and sign-in are in Settings, and Print is hidden on phones.
- **After guided setup**: the planner opens at the top with the rental, not partway down at the shortlist.
- **Background**: the logo pattern appears only on Landing and Guided Setup. The Lease, Showroom, Settings and Information pages use the moving gradient without it, and Studio uses a plain surface.
- **Photo Studio's admin view** follows the Studio artboard (offline shell revision `vahanaiq-v2.12.0-offline-17`). The heading is "Frame every Showroom photo." with a note that changes stay in this browser until exported. The left list has search, All and Edited counts and an Edited tag; the model header has View in Showroom and Upload Photos; the stage has a Cover badge above thumbnails with Add Photo; and the header has Export Changes (.json) and a Signed in · Admin pill. A Frame panel holds Zoom (now shown as a percentage), Position, Background, Save Frame and a reset link. Position and Background are two views of the existing framing setting, so saved records and the export format are unchanged. Frames still save as they change; Save Frame writes any waiting save and confirms it. Reset to original photos, formerly Undo My Changes, now asks first. −, +, Fit, Centre, Reset this frame and the baseline, grid and margin guides moved under More framing tools.
- **Guided setup**: five one-question steps, cars first: Cars, Income, Loan Length (tenure and rate), Down Payment (CBSL minimums explained) and Your Result, which leads with the budget ceiling and marks each car Comfortable, Stretching or Out of reach. Later steps show live rentals for the visitor's own shortlist. The welcome step is gone: the landing introduction does that job on the Lease page. The two-car minimum, saved drafts, Escape, Exit to Lease and the hand-over to the calculator are unchanged.
- **Setup on phones** is a true full-screen sheet (the browser's default dialog gutters are removed) with its header and footer padded clear of the Dynamic Island and home indicator. The backdrop is a still emerald gradient with the monogram matrix, with no blur.
- **Home-screen app on iPhone**: `apple-mobile-web-app-status-bar-style` is `black-translucent` on the Lease, Showroom and Studio pages, so the page runs under the status bar.
- **Favicon**: the SVG favicon has no background tile; it uses deep teals on light browser tabs and bright teals on dark ones. The app icons keep their tile.

### Fixed
- **One name for each thing**: the site now says Lease Planner, Showroom, Comparison and Terms & Notices everywhere, in menus, buttons, messages and Help Centre. File names and addresses such as `catalogue.html` are unchanged, so existing links still work.
- **Prices on the landing belt and in guided setup** now use the site's own price rule (confirmed evidence first, then the lowest amount), as the Showroom and ready-made shortlists already did. The calculation is unchanged, but some shown figures move: Toyota Raize LKR 12,500,000 and Suzuki Fronx LKR 11,350,000. The first trim offered, in setup and in Add a Vehicle, follows the same rule, and the Settings preview now uses the Raize's price.
- **Logo**: on every page it opens the landing page.
- **The rental card** no longer covers the Shortlist or Budget Breakdown while scrolling on a wide screen.
- **Printing the Lease page**: Loan Terms labels no longer sit behind their values, the chosen Debt-to-Income limit prints, every money column fits on A4, the shortlist starts its own page, and closed sections, hidden budget views, filter controls and footer links stay off the paper. Status is left out because Affordability says the same. The printed header says this is an estimate and that down payments follow CBSL Directions No. 01 of 2026.
- **Settings header** has the same Lease, Showroom and Settings links as other pages, and its footer lines up with the page. Settings section buttons and toggles are styled consistently.
- **Footer**: Help Centre lines up with the text beside it on information pages, has a full touch target on a phone Showroom, and the footer columns start level.
- **Accessibility**: darker text for low-contrast labels, larger Loan Terms slider targets, one main landmark, one header and footer landmark in guided setup, and no skipped heading levels in guided setup or the Showroom.
- **Page titles** no longer repeat the name on About.
- **Missing pages** now show a VahanaIQ "Page Not Found" page with links back, in place of GitHub's.
- **Photo Studio's reset control and other hidden elements** no longer show when marked hidden: shared button rules gave them a display value that beat the `hidden` attribute, so Undo My Changes showed with nothing changed.
- **Photo Studio animation**: colour, border and shadow transitions on its controls are gone, and the guides no longer use a drop-shadow filter; only transform and opacity animate, and all of it stops under reduced motion.
- **Photo Studio saves**: each entry now has its own waiting save, so saving or changing one entry can no longer cancel another's, and a waiting save can no longer undo a reset.
- **Grid guide colour in light mode**: the page no longer applies the dark theme's grid colour when the theme follows the device.
- **Page no longer jumps back to a focused field on a desktop or after the keyboard closes**: the iPhone keyboard guard in `js/page-transitions.js` treated every change to the visible area as a keyboard opening. With a text field focused, resizing a desktop window threw a visitor who had scrolled away back to that field, with or without scrolling afterwards, and pinch zoom did the same. It now acts only while a keyboard is open, when the visible area falls well short of the layout viewport. WebKit also reports a resize at first layout, which made `test/browser/ui-responsive.spec.mjs` fail intermittently. No calculation, threshold or rounding changed.
- **Showroom verdicts**: a disputed, estimated or unverified price no longer says Comfortable, Stretching or Out of Reach, and no longer passes Only Cars Within My Budget. Its rental stays, marked Illustrative only · Price unverified. No calculation changed.
- **Settings interest rate**: the rate chosen in Settings now reaches the planner, and a blank box no longer counts as 0%.
- **Budget bar on phones**: it now sits above the bottom tabs, which stay tappable, and the end of the page and any toast clear both.

---

## [2.12.0] - 26/10/2026

UI/UX pass: mobile layout, touch, focus and motion. No calculation, threshold, rounding or number format changed; every displayed figure was checked against the live v2.11.6 site for 8 term scenarios. Reports: `docs/uiux-audit.md`, `docs/uiux-improvements.md`, `docs/uiux-qa-results.md`, `docs/motion-design.md`, `docs/iphone-qa-checklist.md`, `docs/release-readiness.md`.

### Added
- **Motion and touch tokens (`design-system/tokens.json`)**: `--duration-instant`, `--duration-moderate`, `--duration-slow`, `--duration-chart`, `--duration-enter`, `--easing-out`, `--easing-in`, `--easing-in-out`, `--slider-hit`, `--slider-thumb` and `--slider-thumb-touch`.
- **Section switcher on phones, tablets and small laptops**: sticky, with a Terms link and the section in view marked (`aria-current="location"`).
- **Head-to-head "At a Glance" matrix on phones**: rental, cash up front, total interest and total outlay grouped by metric with **Lowest** and the difference; finalist cards swipe sideways below it.
- **Browser suite `test/browser/ui-responsive.spec.mjs`**: 40 checks for page width at phone, tablet and laptop sizes (with and without a filled comparison), 44px touch targets, keyboard focus, phone journeys, the date picker, 16px fields, the iPhone keyboard guard, the catalogue sheet, the phone rental bar, dark-theme dialog contrast and reduced motion; passing in Chromium and WebKit.
- **Firefox and WebKit in CI (`.github/workflows/test.yml`)**: the browser job runs both browser specs once per engine (Chromium, WebKit, Firefox). The Firefox run has not happened yet: it needs a push.
- **iPhone keyboard guard (`js/page-transitions.js`)**: when iOS Safari leaves a focused field behind the on-screen keyboard after its toolbar changes the visible area, the field is brought back into view.

### Changed
- **Asset version 2.12.0**: `APP_VERSION`, every `?v=` query, the service-worker cache (`vahanaiq-v2.12.0`) and the tests that pin the version. `js/page-transitions.js`, `css/curated-catalogue.css` and `css/catalogue-studio.css` now load with `?v=2.12.0` too, so returning visitors cannot keep an older copy of them after a release.
- **Comparison layout**: phone cards fit the screen with every figure visible and a 44px Compare · Details · Remove row; the table fits its panel at every width from 768 to 1920px, with the actions column kept in view; the page stays in one column from 980 to 1365px.
- **Headers and heroes**: a two-row 121px header on phones (was 183px) and one 71px row from 780 to 1199px; compact heroes with a three-figure CBSL strip; loan terms start at y=479 on a 390×844 phone (was 663).
- **Dialogs**: panels rise into place; phones get bottom sheets sized to `92dvh` with safe-area padding.
- **Gauge and bars**: graphics ease from their previous value while figures change at once; the needle now turns about its hub.
- **Sliders**: larger hit area (44px on touch) and a visible keyboard focus ring.
- **Photo Studio**: choosing an entry on a phone scrolls the editor into view; 44px photo, zoom and guide controls on touch.
- **Page transitions**: no navigation delay under reduced motion or where the browser cross-fades pages itself; 140ms otherwise (was 180ms). The catalogue and Studio use the same handler, and the section switcher scrolls instantly under reduced motion.
- **"Add a Vehicle" on phones**: the whole sheet scrolls, instead of a results box that showed a fraction of one card (111px at 375×635, 14px in landscape).
- **Information pages** load `js/boot.js`, so a saved Light or Dark choice applies there too.

### Fixed
- Comparison cards wider than the phone screen, clipping prices, deposits and rentals and pushing the row actions off-screen; the page zoomed out on phones.
- The table's visually hidden "Actions" label widened the whole page at 768–1366px.
- Catalogue hero overflowing every phone width (663px page).
- Layout shift on load: catalogue up to 0.82 and Studio up to 0.46 CLS, now at most 0.027.
- Budget telemetry figures running past their cards between 980 and 1279px; cashflow 40%/50% labels overlapping the card heading.
- Footer links and buttons without focus rings and only 17px tall.
- White-on-teal (1.86:1) pressed compare buttons and active chips under the System theme on a dark device.
- Catalogue and Photo Studio dropdowns drawn 20px tall by WebKit on phones; they now draw their own chevron and are 46px in every engine.
- iOS Safari zooming the page on focus: every text field and menu is now 16px on phones and touch screens.
- The savings planner's date picker collapsing into a single 1,368px column of days on phones; it is a 7-column month grid again.
- The affordability status and rental hidden behind the sticky actions column at 1200–1365px.
- The rental-against-limit bar in phone comparison cards drawn 0px tall.
- Content under the camera housing on iPhones in landscape: page gutters now grow to the safe area there.
- "Mark for Review" in the catalogue's vehicle dialog was pale text on white in Dark (about 1.1:1); it now follows the theme (13.35:1).
- On iPhone, the field being typed into (such as Net Monthly Income) could end up behind the keyboard.
- With a wider device font (Linux's DejaVu Sans, found by the first Firefox and WebKit CI runs), the header's page links and the savings planner's drawer subtitle ran past a 320px screen; the links now wrap below the brand and the subtitle wraps beside its label.

---

## [2.11.6] - 25/10/2026

### Added
- **Externalised Bootstrap (`js/boot.js`)**: Extracted the early theme (`vahanaiq_theme`), aurora animation phase, and `window.__VAHANAIQ_PHOTOS__` readiness promise into `js/boot.js`, loaded before stylesheets on `index.html`, `catalogue.html`, and `studio.html` and precached in `sw.js` (`vahanaiq-v2.11.6`) so no shipped HTML page uses inline `<script>` tags.
- **CSP, Client-IP, Module-Version & Browser Regression Suites**: Added `test/csp.test.mjs`, `test/client-ip.test.mjs`, `test/module-versions.test.mjs`, `test/security.test.mjs`, and the Playwright Chromium browser suite `test/browser/csp.spec.mjs` (verifying zero CSP violations, Google Identity Services iframe attachment, dark theme bootstrap, and photo overlay readiness).
- **Centralised Regulatory Constants (`js/constants.js`)**: Extracted CBSL Directions No. 01 of 2026 statutory down-payment floors, tenures, DTI ceilings, and UI strategy presets into `js/constants.js`.
- **Shared URL Sanitizers (`js/safe-url.js`)**: Consolidated `safeUrl()` and `safeImageUrl()` into `js/safe-url.js`, blocking `javascript:`, `vbscript:`, `data:text/html`, and SVG data URLs.

### Changed
- **CSP Repair & Google Sign-In (`index.html`, `catalogue.html`, `studio.html`, `about.html`, `privacy.html`, `terms.html`)**: Repaired `<meta http-equiv="Content-Security-Policy">` across all six shipped HTML pages to drop `'unsafe-inline'` from `script-src` while permitting Google Identity Services (`https://accounts.google.com` in `script-src`, `connect-src`, `frame-src`, and `style-src` — GIS injects its own `gsi/style` stylesheet, which a `'self'`-only `style-src` blocks and leaves the button unstyled) alongside Firebase CDN (`https://www.gstatic.com`), Google APIs (`https://apis.google.com`), and the Cloud Run search proxy. Added `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- **Hop-Counted Rate Limiter (`serverless/shared/proxy-logic.js`, `serverless/gcp-cloud-function/index.js`)**: Replaced leftmost `X-Forwarded-For` parsing with `resolveClientIp()`. When `TRUSTED_PROXY=true`, the proxy counts `TRUSTED_PROXY_HOPS` (default `1`) from the right of `X-Forwarded-For`, normalises bracketed IPv6 and `IPv4:port` entries, and falls back to `req.socket.remoteAddress` (or `"shared-proxy"`) when `TRUSTED_PROXY` is unset/false or the header chain is shorter than `TRUSTED_PROXY_HOPS` or malformed.
- **Closed Price Mode (`serverless/gcp-cloud-function/index.js`, `serverless/cloudflare-worker.js`, `scripts/refresh-prices.mjs`, `.github/workflows/refresh-prices.yml`)**: Closed `{"mode": "price"}` by default on Cloud Run (`503 price_mode_disabled` when `PRICE_TOKEN` is unset or blank; constant-time SHA-256 + `crypto.timingSafeEqual` verification of `X-Price-Token` via `safeCompareTokens()` when set) and rejected price mode with `400 price_mode_unsupported` on the Cloudflare Worker. Wired `PRICE_TOKEN` into `scripts/refresh-prices.mjs` and `.github/workflows/refresh-prices.yml`.
- **Byte-Accurate Limits & Malformed JSON Handling (`serverless/`, `js/account.js`, `js/app.js`, `firestore.rules`)**: Enforced `Content-Length <= 6,000,000` at proxy entry, a post-parse `6,000,000`-byte (`MAX_BODY_BYTES`, measured with `Buffer.byteLength`) serialized JSON body limit on Cloud Run, a `4 MiB` decoded binary limit on base64 screenshots with magic-byte MIME verification (`image/jpeg`, `image/png`, `image/webp`, `image/gif`), HTTP `400` responses on malformed JSON, and a `700,000` UTF-8 byte client sync budget (`TextEncoder`) in `js/account.js` with visible sync error states below `firestore.rules`'s `900,000`-character CEL limit. The body ceiling is larger than the image ceiling on purpose: base64 turns a 4 MiB screenshot into roughly 5.6 MB of JSON, so an equal cap would refuse screenshots that `validateImage()` accepts.
- **Proxy Packaging, Runtime & Header Hardening (`serverless/`)**: Moved the Cloud Run Docker build context to `serverless/` (`serverless/gcp-cloud-function/Dockerfile`) so `shared/proxy-logic.js` and `gcp-cloud-function/index.js` are copied directly without the broken `serverless/gcp-cloud-function/shared` symlink; pinned `@google-cloud/functions-framework` to `3.4.0` with a committed `package-lock.json` (`npm ci --omit=dev`); upgraded the container base image to `node:22-slim` running as non-root `USER node` (UID 1000); moved `GEMINI_API_KEY` from the upstream URL query string to the `x-goog-api-key` header; required an allowlisted `Origin` header on search requests; and wrapped service-worker cache writes in `event.waitUntil()`.
- **Unified `2.11.6` Asset Versioning**: Synchronised `?v=2.11.6` across all shipped HTML asset tags, relative ES module imports in `js/*.js`, `js/config.js`, and `sw.js` so modules are never instantiated twice.
- **Rate Limiting Before Body Parsing (`serverless/gcp-cloud-function/index.js`)**: The client IP is resolved and the quota checked before the request body is parsed or re-serialised, so a client that has spent its quota is rejected without paying for JSON work first.
- **Information-Page Generator Keeps the Policy (`scripts/build-info-pages.mjs`)**: The generator now copies the CSP and referrer meta from `index.html`, and gains a `--check` mode that renders the three pages in memory and fails on drift, so regenerating `about.html`, `privacy.html` and `terms.html` can no longer strip the policy. `test/csp.test.mjs` runs `--check`.
- **Browser Suite Waits for the Server (`.github/workflows/test.yml`)**: The `browser` job polls `http://127.0.0.1:8123/index.html` until it answers before starting Playwright, removing a start-up race, and the Google Identity Services test now asserts that no CSP message mentions `style-src` or `accounts.google.com` after the dialog opens, which is what catches a blocked GIS stylesheet.

### Removed
- **Removed `file://` Fallback Bundle & Dead Modules**: Deleted the 1,549-line `js/studio-file-fallback.js` `file://` bundle from `studio.html` and removed unused modules `js/pricing-engine.js` and `js/test-builds.js`.

---

## [2.11.5] - 24/10/2026

### Added
- Expanded full market catalogue coverage across Sri Lankan automotive market: 227 vehicle models across 38 makes.
- Regulatory graphics telemetry: CBSL LTV split bar, DTI speedometer gauge, cashflow spectrum console, vehicle details modal with donut outlay and amortization paydown curve.
- Photo Studio for local cropping, aspect framing (1280x800), and cover selection stored in IndexedDB (`vahanaiq_catalogue_photos`).
- Unified A4 portrait statutory lease quotation print stylesheet under CBSL Directions No. 01 of 2026.
