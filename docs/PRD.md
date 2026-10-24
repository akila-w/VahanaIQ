# Product Specification: VahanaIQ Frontend

---

## 1. Product Overview

**Product Name:** VahanaIQ  
**Tagline:** Sri Lanka Vehicle Finance Intelligence & Lease Affordability Discovery Platform  

**Description:**  
VahanaIQ is an interactive web platform that automates Sri Lankan vehicle lease calculations, regulatory down-payment compliance, market catalogue discovery, and deposit savings planning. Designed around Central Bank of Sri Lanka (CBSL) Directions No. 01 of 2026 (clause 2.1), it delivers the capabilities of a financial planning and vehicle comparison workstation — calculating reducing-balance and flat-rate lease rentals, visualising Debt-to-Income (DTI) affordability, comparing curated and AI-extracted vehicles side by side, and planning upfront deposit savings with zero server-side tracking by default.

---

## 2. Goals & Objectives

- **Automate** statutory lease down-payment and Loan-to-Value (LTV) calculations under CBSL Directions No. 01 of 2026 (60% minimum deposit for brand-new, reconditioned, and <1-year registered passenger vehicles; 40% minimum deposit for >1-year registered used vehicles and commercial D-class minibuses).
- **Enhance** buyer financial clarity with real-time Debt-to-Income (DTI) telemetry, interactive SVG speedometer gauges, cashflow spectrum bars, and annual amortisation schedules.
- **Empower** prospective buyers to discover, filter, and compare 227 Sri Lankan vehicle models across 38 makes using sourced pricing, official 8:5 photography, AI-assisted classified ad extraction, and 3-vehicle Head-to-Head matrices.
- **Support** end-to-end purchase preparation through an integrated Deposit & Cash Savings Planner, on-device Catalogue Photo Studio, privacy-safe shareable links, A4 bank-style print quotations, and optional Google account synchronisation.

---

## 3. Target Users

- Individual prospective car buyers and lessees in Sri Lanka evaluating monthly affordability before visiting a showroom or bank
- Vehicle researchers and enthusiasts comparing official distributor models against grey-market and used alternatives
- Household financial planners modelling upfront deposit targets, monthly savings pace, and debt-to-income commitments

---

## 4. Core Features

### 4.1 CBSL Regulatory Lease Calculator & Strategy Presets
Calculates monthly rentals, required deposits, total interest, and total outlay across tenures of 6 to 84 months and interest rates of 0% to 40%. Supports both reducing-balance and flat-rate quotes (converting flat rates to effective reducing equivalents), one-tap strategy presets (*Lowest Rental*, *Fast Payoff*, *Minimum Cash*, *100% Cash*), and a live CBSL LTV Split Bar.

### 4.2 Interactive Budget & DTI Telemetry Console
Visualises borrower affordability in real time using an interactive SVG speedometer dial (`0%` to `60%` DTI) and a stacked Net Income Cashflow Spectrum bar against standard `40%` and stretch `50%` DTI ceilings.

### 4.3 Multi-Vehicle Comparison Table & Head-to-Head Finalists
Provides a sortable, filterable comparison table with quick Sri Lankan market segment chips (*Under LKR 15M*, *Hybrid & EV*, *High Clearance ≥170mm*, *40% Min Down*, *Official Agent*), inline LKR price editing, inline condition cycling, per-vehicle down-payment overrides, per-vehicle lease detail modals (with cost composition donut and SVG amortisation curve), and a sticky 3-vehicle Side-by-Side Head-to-Head comparison modal.

### 4.4 Curated Sri Lankan Vehicle Catalogue
Offers a dedicated catalogue (`catalogue.html` and in-app modal) covering 227 models across 38 makes and 504 official 8:5 gallery images. Labels price provenance (*Distributor Price*, *Dealer Asking Price*, *Published Launch Price*, *Estimated Price*, or *Price on Request*), supports bulk comparison selection (*All*, *Search*, *Filtered*), and includes personal review bookmarking and export.

### 4.5 AI-Powered Vehicle Search & Ad Extraction
Integrates with Google Gemini via a serverless proxy to look up single vehicles, resolve multi-vehicle comparative queries, extract prices and conditions from pasted classified ads or uploaded Japanese auction sheet screenshots, and validate Sri Lankan market availability (RHD and local import eligibility).

### 4.6 Deposit & Cash Purchase Savings Planner
Calculates forward time-to-goal (months required) and reverse target-date pacing (`DD-MM-YYYY`) for a vehicle's statutory deposit plus insurance and upfront fees (or full cash purchase). Includes an interactive SVG accumulation trajectory curve, upfront cost composition bar, and named saved scenarios.

### 4.7 On-Device Catalogue Photo Studio
Provides a browser-based canvas studio (`studio.html`) to upload custom vehicle photos (file picker, drag-and-drop, or clipboard paste), frame them to standardized 8:5 proportions (*Automatic*, *Vehicle on a white plate*, or *Fill the frame*), adjust zoom and nudging, set cover order, and preview changes immediately across the catalogue via `IndexedDB`.

### 4.8 Unified Cross-Device Sync, Sharing & Statutory Print Quotation
Supports guest-first local persistence, privacy-safe shareable URLs (excluding income and debt unless explicitly ticked), optional Google Sign-In with Firebase Firestore synchronisation and conflict resolution, system/light/dark themes, and a consolidated A4 statutory print stylesheet.

---

## 5. Architecture Overview

VahanaIQ follows a modular, zero-build static web architecture paired with serverless cloud endpoints, optimized for instant load times, offline resilience, and strict client-side privacy. The system is composed of the following high-level components:

- **Frontend Web App:** Built with semantic HTML5, CSS3 design-system tokens (`design-system/tokens.json` → `css/tokens.css`), and native ES6 JavaScript modules across `index.html` (Calculator & Planner), `catalogue.html` (Curated Collection), `studio.html` (Photo Studio), and informational pages (`about.html`, `privacy.html`, `terms.html`).
- **Actuarial & Regulatory Engine:** Client-side financial calculation modules (`js/calculator.js`, `js/savings.js`, `js/money-input.js`) enforcing CBSL Direction No. 01 of 2026 LTV floors, flat-to-reducing rate conversion, and two-decimal LKR currency formatting (including South Asian numbering support).
- **Curated Data & Asset Layer:** Static JSON and pre-baked JavaScript data (`data/catalogue.json`, `data/identity.json`, `js/catalogue-data.js`) serving 227 vehicle models, 38 brand marks, and 504 standardized 8:5 WebP/JPEG gallery assets.
- **On-Device Storage & Offline Layer:** Uses `localStorage` for loan terms, vehicle comparisons, price edits, and savings scenarios; `IndexedDB` (`vahanaiq_catalogue_photos`) for Photo Studio imagery; and a Service Worker (`sw.js`) for network-first offline caching.
- **Serverless AI Proxy Gateway:** A Google Cloud Run / Cloudflare Worker service (`serverless/`) that securely holds the Gemini API key (`gemini-3.6-flash`), enforces origin allowlists and per-IP rate limits, and routes vehicle search and screenshot extraction requests without exposing credentials to the browser.
- **Authentication and Cloud Datastore:** Optional Google Identity Services OAuth login coupled with Firebase Firestore (`js/account.js`, `firestore.rules`) to store per-user calculation documents (`users/{uid}`) with pre-write conflict detection.
- **Automated Price Refresh Pipeline:** A scheduled GitHub Actions workflow and Node.js scraper/validator suite (`scripts/scan-prices.mjs`, `scripts/refresh-prices.mjs`) that scans permitted Sri Lankan distributor and importer listings monthly and opens a reviewed pull request.

---

## 6. Requirements

### 6.1 Functional Requirements

- Users can configure loan parameters (Rate Type: Reducing Balance or Flat Rate, Interest Rate: `0%–40%`, Tenure: `6–84` months, Down Payment: `40%–100%`) via number inputs, stepper buttons, synchronised range sliders, or one-tap strategy preset pills.
- The system automatically enforces statutory CBSL minimum down payments per vehicle (`60%` for Brand New, Reconditioned, and Registered `<1` year passenger vehicles; `40%` for Registered Used `>1` year vehicles and D-class commercial minibuses) and clamps out-of-range tenure (`<6` or `>84` months) and deposit (`<40%`) inputs with visible warning hints.
- Users can enter optional Net Monthly Income, Existing Monthly Debt, Debt-to-Income limit (`40% Standard` or `50% Stretch`), Annual Insurance, and Upfront Fees to dynamically update the SVG DTI speedometer gauge, cashflow spectrum bar, and per-vehicle affordability badges.
- Users can browse and filter the 227-model Sri Lankan catalogue by keyword, make, body type (*SUV*, *Car*, *MPV*, *Passenger van*, *Minibus*, *Pickup*), fuel/powertrain, seller route (*Official*, *Grey*, *Independent*), price status, and monthly budget fit, and add vehicles individually or in bulk (*All*, *Search*, *Filtered*).
- Vehicles with multiple trims or `Price on Request` (`price: null`) require a valid user-confirmed positive LKR quote before being added to the active lease comparison.
- Users can edit vehicle prices inline, cycle vehicle conditions inline, set a per-vehicle custom down-payment percentage override (bounded between the vehicle's CBSL floor and `100%`), view per-vehicle Lease Details (cost donut chart and annual amortisation curve), and remove vehicles (individually or all at once) with an interactive `Undo` toast.
- Users can pin up to 3 comparison vehicles to the Head-to-Head tray and open a side-by-side comparison modal highlighting the lowest monthly rental, upfront cash, total interest, and total outlay deltas.
- Users can search for vehicles or paste classified ad text / upload ad or auction-sheet screenshots via the AI Search modal, or add custom vehicles via the Manual Entry form.
- Users can model deposit or full-cash savings goals in the Savings Planner by percentage of net income or fixed monthly LKR contribution, validate optional target dates (`DD-MM-YYYY`, minimum 1 month ahead), inspect the SVG accumulation trajectory curve, and save, load, or delete named scenarios.
- Users can upload, crop/frame at 8:5, reorder, and export custom catalogue photos in the Photo Studio (`studio.html`), with changes reflected immediately on `catalogue.html` as **Your Photo**.
- Users can switch themes (*System*, *Light*, *Dark*), generate shareable comparison URLs (with opt-in income inclusion), print an A4 statutory lease quotation, and optionally sign in with Google to synchronise or delete cloud-saved data.

### 6.2 Non-Functional Requirements

- The system must provide real-time, zero-reload UI recalculation and visual telemetry feedback for all user-initiated input, slider, filter, and sort actions.
- Every currency value across inputs (upon blur), tables, summaries, modals, and print views must format with comma thousands separators and exactly two decimal places (e.g., `LKR 12,500,000.00`), while supporting mid-keystroke comma re-grouping and South Asian numbering (`1,50,00,000`).
- All modal dialogs must enforce accessible keyboard focus trapping, `inert` background isolation, `Escape` key dismissal, focus restoration, and WCAG AA colour contrast across both light and dark themes.
- Client-side privacy must be preserved by default: no API keys in browser code, no third-party analytics trackers, local-only `IndexedDB` storage for Photo Studio uploads, and strict per-UID Firestore security rules for signed-in users.
- The core calculator, curated catalogue, and photo studio must function offline via Service Worker caching (`sw.js`) and render responsively across mobile (`375px`), tablet (`768px`), desktop (`1440px`), and A4 `@media print` viewports.
