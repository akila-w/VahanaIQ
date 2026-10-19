<p align="center">
  <img src="assets/icons/logo-full-lockup.svg" alt="VahanaIQ Logo" width="360">
</p>

# VahanaIQ

**VahanaIQ** is a Sri Lankan vehicle lease calculator and affordability discovery platform. It aligns directly with Central Bank of Sri Lanka (CBSL) Directions No. 01 of 2026.

🔗 **Live Public App:** [https://akila-w.github.io/vahanaiq/](https://akila-w.github.io/vahanaiq/)

## Features
- **CBSL Regulatory Engine:** 50% down payment cap on unregistered passenger cars, 84-month tenure limit, 40%/50% DTI ceilings.
- **Zero-Cost Google Gemini AI Integration:** Auto-discovers active Flash models (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`) with dynamic version probing via Google AI Studio's free and pay-as-you-go tiers.
- **Sri Lankan Market Availability Gatekeeper:** Validates if searched vehicles are actively traded in Sri Lanka or road-legal (RHD, tax brackets), suggesting local alternatives if not.
- **Hierarchical Selector:** Multi-tier Model Year and Trim selector with condition grading (Brand New, Reconditioned Grade 4.5+, Registered Used).
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
│   ├── gemini.js         # Google AI Studio API integration & auto-discovery
│   └── storage.js        # LocalStorage persistence & magic link handler
└── assets/
    ├── icons/
    │   ├── favicon.svg                       # 64x64 Vector brand icon & favicon
    │   ├── logo-option-1-apex.svg            # 120x120 Standalone brand mark
    │   ├── logo-option-1-apex-transparent.svg# Clean vector mark (transparent)
    │   └── logo-full-lockup.svg              # Full brand lockup & social preview
    └── images/                               # High-resolution studio press photos (12 vehicles)
```

## Running Locally
Simply open `index.html` in any web browser. No npm build or local server required.