<p align="center">
  <img src="assets/icons/logo-full-lockup.svg" alt="VahanaIQ Logo" width="360">
</p>

# VahanaIQ

**VahanaIQ** is a Sri Lankan vehicle lease calculator and affordability discovery platform. It aligns directly with Central Bank of Sri Lanka (CBSL) Directions No. 01 of 2026.

🔗 **Live Public App:** [https://akila-w.github.io/vahanaiq/](https://akila-w.github.io/vahanaiq/)

## Features
- **CBSL Regulatory Engine:** 50% down payment cap on unregistered passenger cars, 84-month tenure limit, 40%/50% DTI ceilings, and statutory LTV warnings.
- **Smart Multi-Input AI Extraction:** Analyzes vehicle names, comparative queries, raw classified ad text (Ikman, Riyasewana, Patpat, FB Marketplace), or uploaded/clipboard screenshots of Japanese auction sheets.
- **Zero-Touch Studio Photos:** Automatically resolves studio car press photos via local catalog, Wikipedia REST API, and Wikimedia Commons, normalising them onto 8:5 pure white studio plates.
- **One-Click Batch Add & Discovery:** Compare multiple vehicles side-by-side or add all trim levels for any model year in a single click.
- **Inline Table Editing:** Quick-edit LKR prices inline and cycle conditions (Brand New ⇄ Reconditioned ⇄ Registered Used) with live actuarial recalculation.
- **Zero-Cost Google Gemini AI Integration:** Auto-discovers active Flash models (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`) with dynamic version probing via Google AI Studio's free tier or serverless proxies.
- **Sri Lankan Market Availability Gatekeeper:** Validates if searched vehicles are actively traded in Sri Lanka or road-legal (RHD, tax brackets), suggesting local alternatives if not.
- **Hierarchical Selector:** Multi-tier Model Year and Trim selector with condition grading.
- **Dynamic LKR Pricing:** Market valuations automatically update as condition or trim changes.
- **HTML5 Canvas Studio Normaliser:** Automatically centres, scales, and pads any car photo onto an 8:5 pure white plate (`#FFFFFF`) with tyre contact shadow.
- **Zero-Exposure Magic Link:** Supports `#apiKey=...` fragment parameter to auto-configure trusted devices without hardcoding credentials in source code.

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
│   ├── gemini.js         # Google AI Studio API integration & OpenAPI schema
│   ├── image-fetcher.js  # Zero-touch Wikipedia & Wikimedia photo resolver
│   ├── storage.js        # LocalStorage persistence & magic link handler
│   └── config.js         # Cloud proxy and endpoint configuration
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