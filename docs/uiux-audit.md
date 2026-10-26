# VahanaIQ UI/UX Audit — v2.11.6 Baseline

**Date:** 26/10/2026
**Scope:** `index.html` (Calculator), `catalogue.html`, `studio.html`, `about.html`, `privacy.html`, `terms.html`
**Build audited:** local checkout at `4402dc3` (v2.11.6). The live site at `https://akila-w.github.io/VahanaIQ/` serves the same v2.11.6 and reproduces every layout defect below that was re-checked there (catalogue overflow at 390px, catalogue CLS 0.49 at 1440px, studio CLS 0.16).

This report records what was observed **before** any change; the Status and Verified columns were filled in after implementation. Fixes and their verification are in [uiux-improvements.md](uiux-improvements.md) and [uiux-qa-results.md](uiux-qa-results.md). "Verified" means verified with device emulation in Chromium and WebKit and, for the items marked so, by hand in iOS Safari in the iOS 27 Simulator (iPhone 18 Pro). Firefox runs only in CI (pending at the time of writing); no physical device was used.

## 1. Method

| Area | How it was measured |
|---|---|
| Rendering | Playwright 1.64 with Chromium 1248 (headless) against `node test/serve-qa-fixtures.mjs` (`http://127.0.0.1:8765`, no external AI calls). Mobile widths used `isMobile`, `hasTouch` and DPR 2. |
| Viewports | 320×568, 360×800, 375×812, 390×844, 414×896, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080 and 844×390 (landscape phone). |
| States | Empty first visit, and a **populated** comparison: 25 Toyota catalogue entries added through the real catalogue bulk-add button, net income LKR 650,000 and existing payments LKR 40,000. |
| Overflow | `documentElement.scrollWidth` against the viewport, plus every visible element whose box leaves the viewport outside a scroll container. |
| Targets | Every visible button, link, input, select, summary, tab and radio label: under 24×24 (fails WCAG 2.2 SC 2.5.8) and under 44×44 (below the project's own `--touch-target`). |
| Focus | Pressing Tab up to 120 times per page and checking each focused control for an outline or ring. Controls that show focus through a wrapper's `:focus-within` were then checked by hand. |
| Layout shift | `PerformanceObserver('layout-shift')` with source attribution, 2.5s after load. |
| Lab performance | Chromium with 4× CPU throttle, 1.6 Mbps / 150 ms RTT, 390×844 DPR 3, 3 runs, median. The QA server sends files **uncompressed**; GitHub Pages compresses them, so byte counts and LCP here overstate the field. These are laboratory estimates, not field (CrUX) data — no field data was available. |

Baseline screenshots, metrics and the scripts that produced them were kept outside the repository (session scratch space); the figures quoted below are copied from those runs.

## 2. Scores (evidence-based)

| Dimension | Baseline result | Basis |
|---|---|---|
| **Mobile responsiveness** | **28 of 42** phone page-states pass (67%) — **0 of 7** for the populated calculator | A state passes when the document is no wider than the viewport and no financial amount is clipped. Calculator (populated) 0/7, catalogue 1/7, studio 6/7, information pages 21/21. |
| **Wide-screen layout** | Populated calculator overflows the page at 768, 1024 and 1280px (815, 1398 and 1408px wide documents) | `scrollWidth` with the seeded comparison. |
| **Layout stability** | Catalogue CLS 0.31–0.82 and Studio 0.09–0.46 at ≥768px; Calculator ≤0.016 | Lab CLS. Google's "good" threshold is 0.1. |
| **Keyboard focus** | 7 controls on the calculator have **no** visible focus: the 3 loan-term sliders and 4 footer links/buttons. Catalogue, Studio and About: none found | Tab sweep, confirmed against the CSS. |
| **Target size** | Calculator 4 controls below 24px (footer links, 17px tall) and 25 between 24 and 44px on phones; Catalogue 55 and Studio 28 between 24 and 44px | Measured at 390×844, coarse pointer. |
| **Performance (lab)** | Calculator LCP 4.1s, 1.40 MB uncompressed; Catalogue LCP 4.0s; Studio LCP 1.2s; longest interaction 48ms (all pages) | Throttled lab run (see Method). INP proxy is the longest Event Timing entry for real taps and typing. |
| **Motion** | 9 effects with 6 different hard-coded timings; 3 timing tokens and one easing (`ease`); no motion on dialog content; navigation always delayed 180ms, even with reduced motion | CSS and JS inventory (§5). |

## 3. Overall assessment

**UI.** The visual identity (Forest Ink / Ceylon Emerald, editorial eyebrows, glass panels over a soft aurora) is distinctive and consistent between pages in both themes. Desktop is the strongest presentation. Polish suffers from accumulated overrides: `css/curated-catalogue.css` carries a minified base, a later expanded rewrite of the same selectors and three copies of the footer rules, which is how the catalogue's mobile hero came to be overridden (UX-02).

**UX.** The calculator's information architecture (terms → budget → comparison → savings) is sound and the financial outputs are clear on desktop. The mobile journey breaks at its most important point: as soon as a buyer adds vehicles, cards outgrow the screen, amounts are cut off and the page zooms out (UX-01).

**Accessibility.** Strong foundations — skip links, `inert` backgrounds, a focus trap with focus return, Escape to close, live regions for budget changes and the undo toast, labelled icon buttons, status always paired with words. Gaps are concentrated: invisible focus on the sliders and footer, small targets and a few contrast slips.

**Performance.** Interaction latency is good (≤48ms under 4× throttle). Load is dominated by render-blocking CSS (`style.css` 206 KB uncompressed) and the 370 KB catalogue data the calculator preloads. Catalogue cards each apply `backdrop-filter: blur(16px)` over a fixed, blurred background — expensive to scroll on low-end phones.

**Animation.** Motion is sparse and inconsistent rather than excessive. Dialog content appears without transition, the gauge needle and bars jump, and timing values are scattered literals.

## 4. Issue inventory

Severity: **P0** blocks or corrupts a core task; **P1** serious usability or accessibility defect; **P2** noticeable quality issue; **P3** polish.

| ID | Page / component | Description | Sev | Viewports | User impact | Recommended solution | Status | Verified |
|---|---|---|---|---|---|---|---|---|
| UX-01 | Calculator — comparison cards | Below 700px `#rows` is a grid with no column template, so its implicit track sizes to the widest card's max-content (446px on a 390px phone). Price, down payment and rental values are clipped; the actions cell keeps its desktop `width:1%` (4px), so Compare / Details / Remove render off-screen to the left; the page grows to 474–478px and phones zoom the whole page out. | P0 | 320–699px (populated) | Cannot read or act on the comparison on a phone | `grid-template-columns: minmax(0,1fr)`; let spec pills wrap; give the actions cell full width with 44px buttons | Fixed | Verified — Chromium, 7 phone sizes, populated; browser spec |
| UX-02 | Catalogue — hero | The ≤650px rule sets `.hero{display:block}`, but a later unconditional `.hero{display:flex}` wins. The headline is squeezed to one word per line and the metrics strip runs off-screen; the document is 663px wide on every phone. | P0 | 320–430px | Sideways panning on the catalogue's first screen | Re-state the stacked hero after the expanded rules; let the metrics wrap | Fixed | Verified — Chromium, 6 phone widths; browser spec |
| UX-03 | Calculator — comparison table | The visually hidden "Actions" header (`.sr-only`, `position:absolute`) has `<body>` as its containing block, so it sits at the table's far edge and widens the page (1398px at 1024). Long spec pills (`white-space:nowrap`) push the Vehicle column to 422px, so at 1024–1280px the Affordability column is clipped mid-figure and the row actions sit behind an unannounced horizontal scroll. | P0 | 768–1280px (populated) | Clipped affordability figures; page scrolls sideways | Make `.wrap` the containing block; wrap pills; cap the name column; keep the status tag inside its cell | Fixed (one-column layout up to 1365px, so no column scrolls) | Verified — Chromium and WebKit 768–1920px; browser spec |
| UX-04 | Catalogue, Studio — load | The grid (catalogue) and model list (studio) render after script runs; pagination, review bar and footer are first painted in the viewport and then pushed down. | P1 | ≥768px | Content jumps under the cursor; CLS 0.31–0.82 | Reserve space for the empty grid/list until it renders | Fixed | Verified — max CLS 0.027 across 144 states |
| UX-05 | Calculator — mobile header and hero | Header takes 3 rows (~180px: brand + nav, actions, theme switch alone on a row). Hero and the CBSL metrics card take another ~400px with large empty gaps inside the card. Loan terms start at y≈663 of an 844px screen. | P1 | ≤650px | The calculator is below the fold on first visit | One compact action row; tighter hero and a 3-up metric strip on phones | Fixed | Verified — header 183→121px, terms 663→479px at 390×844 |
| UX-06 | Calculator, Studio — header nav | At 320px the main nav overflows (Studio link ends at 347px / 344px). | P1 | 320px | Page pans sideways | Let the nav shrink and the brand tighten at ≤360px | Fixed | Verified — 320px |
| UX-07 | Calculator — hero (landscape) | At 844×390 the CBSL metric strip runs to 886px. | P1 | Landscape phone | Sideways panning | Allow the metric strip to wrap | Fixed | Verified — 812×375, 844×390, 932×430 |
| UX-08 | Calculator — loan-term sliders | `input[type=range].terms-slider{outline:none}` out-ranks `.terms-slider:focus-visible`, so keyboard focus is invisible. The input box is 6px tall, so touches just above or below the track miss. | P1 | All | Keyboard users lose their place (WCAG 2.4.7); imprecise touch | Raise the focus rule's specificity; 28px hit area (44px on touch) with a 6px drawn track | Fixed | Verified — focus sweep and browser spec |
| UX-09 | Calculator — footer meta | `all: unset` removes focus indicators from the CBSL PDF, GitHub, Source Guide and Photo Credits controls; they are 17px tall. | P1 | All | Invisible focus; targets below 24px (WCAG 2.5.8) | Restore a focus ring; 24px minimum (44px on touch) | Fixed | Verified — focus sweep, 24px/44px measured |
| UX-10 | Calculator — sticky budget bar | With UX-01 the layout viewport widens, so the fixed bar's text is cut off ("Max price LKR 27,690…"). | P1 | ≤640px (populated) | Key budget figure unreadable | Resolved by UX-01; also allow the bar text to wrap and respect safe areas | Fixed | Verified — Chromium phones |
| UX-11 | Calculator — cashflow spectrum | The 40%/50% threshold labels are absolutely positioned at the top of the card and overlap its heading and total ("NET INCOME CASHFLOW S[40% CBSL Limit]…"); threshold lines run through the in-bar label. | P2 | All | Hard-to-read key chart | Put the labels in their own row above the bar | Fixed | Verified — screenshots 390–1440px |
| UX-12 | All — touch targets | On coarse pointers: preset chips 26px, segmented buttons 30px, step buttons 40×36, strategy pills 37px, studio photo actions 26×34 and guide toggles 30px, catalogue Reset Filters 36px and source links 30px. | P2 | Touch | Mis-taps | Apply `--touch-target` (44px) under `pointer:coarse` | Fixed | Verified — coarse-pointer measurement; browser spec |
| UX-13 | Calculator — head-to-head dialog | On phones the three finalists stack as tall cards; comparing one metric means scrolling past each photo. | P2 | ≤700px | Slow comparison | Add a compact metric-by-metric matrix above the cards on phones | Fixed | Verified — browser spec; screenshot |
| UX-14 | All dialogs | Only the scrim fades (150ms); the dialog panel appears without motion. Dialogs use `90vh`, so mobile browser toolbars can cover the bottom. | P2 | All / mobile | Abrupt; occasional hidden actions | Shared enter/exit transition; bottom sheet on phones; `dvh` heights | Fixed | Verified — transition timing, rapid open/close, reduced motion |
| UX-15 | All — page transitions | Internal links always wait 180ms before navigating, even under `prefers-reduced-motion`; `main` already has no entrance animation. | P2 | All | Slower navigation; ignores the preference | Skip the delay when motion is reduced; shorten it | Fixed | Verified — 117ms navigation under reduced motion |
| UX-16 | Catalogue — cards | Every card applies `backdrop-filter: blur(16px) saturate(160%)` over a fixed full-screen blurred aurora. | P2 | Low-end phones | Janky scrolling | Use the opaque glass fill on touch devices | Fixed | Implemented; benefit not measured on a real low-end phone |
| UX-17 | Studio — mobile | Choosing an entry in the list does not bring the editor into view; on phones it is ~600px further down. | P2 | ≤1020px | Unclear that anything happened | Scroll the editor into view after a choice on single-column layouts | Fixed | Verified — browser spec |
| UX-18 | Catalogue — theme | Pressed "compare" buttons and active chips use `color:#fff` on the accent; only the explicit Dark theme overrides it, so System on a dark device shows white on teal (#2dd4bf, about 1.9:1). | P2 | System + dark OS | Unreadable labels | Use `var(--on-accent)` | Fixed | Verified — 1.86:1 → 9.59:1 |
| UX-19 | Calculator — hero metrics card | On phones the metrics wrap into a 2+1 layout with large empty gaps. | P3 | ≤650px | Wasted space | Compact 3-up strip | Fixed | Verified — screenshots |
| UX-20 | Catalogue — card actions | View Details / Mark for Review / Add to Comparison wrap unevenly on phones. | P3 | ≤650px | Untidy, inconsistent tap targets | Two-column action grid with the primary action full-width | Fixed | Verified — screenshots |
| UX-21 | Design system — motion | Only `--duration-fast`, `--duration-base`, `--duration-spin` and `--easing-standard: ease`; the stylesheets also use literal .12s, .15s, .18s, .28s and .35s. | P3 | All | Inconsistent feel | Add motion tokens and use them | Fixed for new rules; older literals remain | Verified — tokens test |
| UX-22 | Information pages | "Back to calculator" link-button is 23px tall. | P3 | Touch | Small target | 44px on touch | Fixed | Verified — 155×44px; saved theme applied |

Found after the first pass, during WebKit testing (26/10/2026):

| ID | Page / component | Description | Sev | Viewports | User impact | Recommended solution | Status | Verified |
|---|---|---|---|---|---|---|---|---|
| UX-23 | Catalogue, Studio — dropdowns | WebKit draws native menus at its own 20px height on phones and ignores the 46px minimum and padding | P2 | WebKit phones | Small, inconsistent targets | Draw the chevron with `appearance: none` | Fixed | Verified — 46px in WebKit and Chromium |
| UX-24 | All — form fields | Fields under 16px (catalogue 12–15px, Studio 12px, calculator dialogs 12.5–15px) make iOS Safari zoom the page on focus | P1 | iOS Safari | Page jumps while entering values | 16px on phones and touch screens | Fixed | Verified — browser spec, both engines |
| UX-25 | Calculator — savings date picker | Below 980px the calendar table collapses into a 1,368px column with the weekday row hidden (also on the live site) | P1 | ≤979px | Hard to pick a date | Keep the table layout | Fixed | Verified — browser spec, both engines |

Found during the pre-release review and hands-on iOS Simulator testing (26/10/2026). All five are present in v2.11.6 and on the live site:

| ID | Page / component | Description | Sev | Viewports | User impact | Recommended solution | Status | Verified |
|---|---|---|---|---|---|---|---|---|
| UX-26 | Calculator — "Add a Vehicle" sheet | The results list is its own scroll box inside a fixed-height sheet: 111px tall at 375×635 (a fraction of one card) and 14px in landscape at 844×340, where the sheet also made the page 886px wide. | P1 | Phones, short landscape | The catalogue is hard to browse on a phone | On phones and short screens the whole sheet scrolls and the list grows to its content | Fixed | Verified — WebKit 402/375/844px; iOS Simulator; browser spec |
| UX-27 | Calculator — phone comparison cards | An older card rule's `flex: 1` collapsed the rental-against-limit bar to 0px tall, leaving only the limit mark | P2 | ≤979px | The bar that shows how close a rental is to the limit is missing | Keep the track's own height inside the stacked cell | Fixed | Verified — 8px bar at 402 and 768px; iOS Simulator; browser spec |
| UX-28 | All app pages — landscape iPhone | The pages use `viewport-fit=cover` but no side safe-area padding, so the camera housing covers the left edge of the content in landscape ("SRI LANKA" and the "K" of the headline hidden) | P2 | Phones in landscape | Clipped text | Page gutters grow to the safe area in landscape; dialogs keep clear of it | Fixed | Verified — iOS Simulator (calculator, catalogue); header fit measured with simulated insets |
| UX-29 | Catalogue — vehicle details dialog | "Mark for Review" keeps the light theme's white fill in Dark and System-dark while its text turns pale: #f1f5f9 on #ffffff, about 1.1:1 | P1 | Dark themes | Unreadable button (WCAG 1.4.3) | Use the panel, border and ink tokens | Fixed | Verified — 13.35:1 at rest, 7.26:1 pressed; iOS Simulator; browser spec |
| UX-30 | All — focused fields on iPhone | iOS Safari scrolls a focused field above the keyboard, then puts the page back when its toolbar changes the visible area, leaving the field (for example Net Monthly Income) behind the keyboard. Reproduced on the live site; bisection showed no script on the page causes it. | P1 | iOS Safari, portrait | You type into a field you cannot see | When the visible area changes, or the page scrolls within a second of that, and the focused field is out of sight, scroll it back to the middle (`js/page-transitions.js`) | Fixed | Verified — iOS Simulator (field stays visible; typed 650,000); browser spec, both engines |

Seen and left as it is: after switching between Light and Dark with the page's own switch, iOS Safari keeps the previous colour behind the status bar until the page is reloaded, although the page updates its `theme-color` tags. It is a Safari behaviour and cosmetic (P3).

### Checked and found sound

- Theme initialisation: `js/boot.js` sets `data-theme` before the stylesheets load, so no wrong-theme flash was observed.
- Dialogs: `js/modal.js` makes the background `inert`, traps Tab, closes on Escape and the scrim, and returns focus to the opener.
- Live regions: budget sentence (`#budgetLive`, debounced 500ms), comparison count, toast, planner result.
- No console errors or page errors on any page at any viewport in either theme.
- Information pages (generated by `scripts/build-info-pages.mjs`) reflow cleanly at every width.

## 5. Motion inventory (baseline)

| Effect | Where | Trigger | Duration / easing | Reduced motion |
|---|---|---|---|---|
| Scrim fade | `.modal-bg` | open/close | 150ms `ease` | Off |
| Toast slide | `.toast` | show | 200ms `ease` | Off |
| Spinner | `.spinner` | AI search | 800ms linear | Off |
| Page exit fade | `main.page-exit` | internal link | 180ms `ease-in` + 180ms JS delay | CSS off, **delay kept** |
| Button lift | `.btn`, `.btn-outline` | hover / press | 120–150ms `ease` | Partly |
| Card fade-in | catalogue `#vehicles.initial-load > .card` | first render | 280ms `cubic-bezier(.16,1,.3,1)` | Off |
| Photo zoom | catalogue `.photo-button img` | hover | 350ms `ease` | Off |
| Slider thumb scale | `.terms-slider` thumb | hover | 150ms | Not covered |
| Aurora background | `body::before/after` | — | animation set to `none` | — |

Not animated: dialog panels, drawers (Optional costs, LTV structure, savings planner), gauge needle, cashflow and rental bars, budget figures, head-to-head tray, row add/remove.

## 6. Prioritised plan

1. **P0 — Comparison and catalogue layout** (UX-01, UX-02, UX-03, UX-10): contain the table's positioned descendants, constrain the phone card grid, wrap pills, fit the desktop table, fix the catalogue hero cascade.
2. **P1 — Stability, header and focus** (UX-04 to UX-09): reserve list space, compact mobile header and hero, focus rings and hit areas for sliders and footer controls.
3. **P2 — Touch, dialogs and mobile flows** (UX-11 to UX-18): 44px targets on touch, chart label layout, phone matrix in head-to-head, bottom-sheet dialogs, Studio scroll-to-editor, catalogue blur on touch, theme token fix.
4. **Motion system** (UX-14, UX-15, UX-21): motion tokens, dialog and drawer transitions, value-change feedback that never shows an intermediate figure, chart transitions, full reduced-motion coverage.
5. **P3 polish** (UX-19, UX-20, UX-22).

Financial formulas, CBSL thresholds, rounding and number formatting are out of scope and are not to change.
