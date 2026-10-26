# VahanaIQ UI/UX Improvements — Implementation Report

**Date:** 26/10/2026 (updated after the pre-release review and iOS Simulator testing) · **Base:** v2.11.6 (`4402dc3`) · **State:** uncommitted local changes; nothing committed, pushed or deployed
**Companion reports:** [uiux-audit.md](uiux-audit.md) (findings), [uiux-qa-results.md](uiux-qa-results.md) (verification), [motion-design.md](motion-design.md) (motion system)

## Approach

The product's identity, architecture and calculations were kept. Every change is a scoped CSS rule, a small markup change or a contained JavaScript helper:

- New rules sit in one clearly marked section at the end of `css/style.css` and of `css/curated-catalogue.css`, screen-only, so the consolidated A4 print block is untouched and `test/print.test.mjs` still finds exactly one `@media print`.
- New values are design tokens in `design-system/tokens.json`, regenerated into `css/tokens.css` with `node scripts/build-tokens.mjs`; no stylesheet declares a custom property (`test/tokens.test.mjs`).
- No inline styles, no `element.style.x =` assignments, no new files under `js/`, no new dependencies, no new external requests. The version moves to 2.12.0 (see [release-readiness.md](release-readiness.md)).
- No formula, threshold, rounding or number format changed. A side-by-side extraction of every figure the calculator shows, for 8 term scenarios × 24 vehicles, is identical to the live v2.11.6 site ([QA §3](uiux-qa-results.md#3-financial-regression)).

## Files changed

| File | Change |
|---|---|
| `design-system/tokens.json`, `css/tokens.css` (generated) | Added `--duration-instant`, `--duration-moderate`, `--duration-slow`, `--duration-chart`, `--duration-enter`, `--easing-out`, `--easing-in`, `--easing-in-out`, `--slider-hit`, `--slider-thumb`, `--slider-thumb-touch`. |
| `css/style.css` | Refinement section (≈700 lines): comparison layout fixes, phone header and hero, section switcher, single-column 980–1365px layout, laptop table fit, budget telemetry, sliders, focus rings, touch targets, head-to-head phone matrix, dialogs and bottom sheets, the catalogue sheet scrolling as a whole on phones, the phone rental bar, landscape safe-area gutters, drawers, motion and reduced motion, information pages. |
| `css/curated-catalogue.css` | Refinement section: hero cascade fix, layout-shift reservations, phone and landscape header, card blur on touch, on-accent text, the dialog's "Mark for Review" colours, card action grid, touch targets, footer focus and size, card and dialog motion, landscape safe-area gutters, reduced motion. |
| `css/catalogue-studio.css` | Zoom slider hit area and focus ring, 44px photo/zoom/guide controls on touch, transitions with reduced-motion fallback. |
| `index.html` | "Add a Vehicle" keeps its name (`aria-label`) while phones show "Add"; a Terms link and `id="loanTermsHead"` for the section switcher; the gauge needle's shapes wrapped in a `.dial-needle-swing` group. |
| `js/app.js` | `setFigure()`, `setNeedle()`, `setBars()`, `setBarHtml()` motion helpers (no-ops under reduced motion or without the Web Animations API); the head-to-head phone matrix; the section switcher scrolls instantly under reduced motion. |
| `js/page-transitions.js` | No navigation delay under reduced motion or where the browser cross-fades pages natively (140ms elsewhere, was 180ms); scroll-spy for the section switcher; the focused-field guard for the iPhone keyboard (UX-30). |
| `js/curated-catalogue.js` | Catalogue and Studio links use the shared page transition, so they no longer wait a fixed 180ms under reduced motion. |
| `js/catalogue-studio.js` | Choosing an entry on single-column layouts scrolls the editor into view. |
| `scripts/build-info-pages.mjs`, `about.html`, `privacy.html`, `terms.html` (regenerated) | Information pages load `js/boot.js`, so a saved Light/Dark choice applies there too. |
| `test/browser/ui-responsive.spec.mjs` (new) | 40 Playwright checks for layout, touch, focus, phone journeys, the date picker, 16px fields, the keyboard guard, the catalogue sheet, the phone rental bar, dark-theme dialog contrast and motion; portable across Chromium, WebKit and Firefox. |
| `test/browser/csp.spec.mjs` | Also fails on any Content Security Policy violation the page reports. |
| `.github/workflows/test.yml`, `README.md` | The browser job runs both specs in Chromium, WebKit and Firefox (one job per engine); README documents it. |
| `docs/brand-guide.md` | Motion and touch guidance updated to the new tokens. |
| `docs/uiux-audit.md`, `docs/uiux-improvements.md`, `docs/uiux-qa-results.md`, `docs/motion-design.md`, `docs/iphone-qa-checklist.md`, `docs/release-readiness.md` (new) | Reports. |
| `qa/2026-10-26-uiux/` (git-ignored) | Before/after screenshots, raw metrics and the measurement scripts. |

## Changes by issue

| ID | Original problem | Solution | Expected benefit |
|---|---|---|---|
| UX-01 | Phone comparison cards 446px wide on a 390px screen; amounts clipped; actions off-screen; page zoomed out | `#rows` grid gets `minmax(0, 1fr)`; spec pills wrap; card captions may wrap; the actions cell becomes a full-width row of 44px buttons (Compare · Details · ×) | Every figure and action readable and tappable at 320–430px |
| UX-02 | Catalogue hero pushed the page to 663px on phones | Re-stated the stacked hero after the expanded rules; 3-up figure strip; space reserved for the figures that load later | No sideways panning; shorter first screen |
| UX-03 | `.sr-only` "Actions" header widened the page (1398px at 1024); Vehicle column 422px; Affordability clipped; actions behind an unannounced scroll | `.wrap` is the containing block; laptop table pills keep to one line with an ellipsis and clamp at two lines; 64px thumbnails up to 1599px; the over-limit line may wrap; actions column sticky at the right with a soft edge; **one-column layout from 980 to 1365px** | Whole table visible at every width from 768 to 1920px |
| UX-04 | Catalogue CLS up to 0.82, Studio 0.46 | Reserved height for the empty grid and entry list; catalogue hero stacked below 1100px so late figures cannot re-wrap it | CLS ≤ 0.027 everywhere |
| UX-05 | Phone header 183px in three rows; loan terms started at y=663 of 844 | Two-row header (brand and pages; one action row), compact hero with a 3-up CBSL strip | Header 121px; loan terms at y=479 (360 and 390px phones) |
| UX-06 | Header nav overflowed at 320px | Tighter brand and gaps at ≤374px | No overflow at 320px |
| UX-07 | Landscape phone hero ran to 886px | Hero wraps; compact hero and one-row header in landscape (780–1199px) | Header 71px and loan terms at y=353 at 844×390 (were 141 and 680) |
| UX-08 | Sliders had no focus ring; 6px hit area | Higher-specificity `:focus-visible` ring; 28px hit area (44px on touch) around a 6px drawn track; 20/26px thumbs | Visible keyboard focus; easier dragging |
| UX-09 | Footer controls lost focus rings; 17px tall | Focus rings restored; 24px minimum (44px on touch) on every page | Meets WCAG 2.4.7 and 2.5.8 |
| UX-10 | Sticky budget figure cut off | Fixed by UX-01; the bar text wraps, respects side safe areas, and hides while a field is being typed into on phones | Always readable; never covers the keyboard area |
| UX-11 | Cashflow 40%/50% labels overlapped the card heading | Labels on their own row; lines stop at the bar; the Rental label starts at the left of its segment | Legible chart at every width |
| UX-12 | Many 24–36px controls on touch screens | `pointer: coarse` brings chips, segments, steppers, pills, drawers, row actions, edit icons, header links, adorned inputs, Studio and catalogue controls to 44px | Fewer mis-taps |
| UX-13 | Head-to-head on phones was three tall stacked cards | "At a Glance (LKR)" matrix grouped by metric (rental, cash up front, total interest, total outlay) with **Lowest** and +difference text, then swipeable finalist cards with the next one peeking | Compare finalists without scrolling past photos; full precision kept |
| UX-14 | Dialogs appeared without motion; `90vh` on phones | Shared rise transition; phone bottom sheets at `92dvh` with safe-area padding; native dialogs animate in | Calmer, native-feeling dialogs; actions not hidden by toolbars |
| UX-15 | 180ms navigation delay, even with reduced motion | Skipped under reduced motion and where native view transitions run; 140ms otherwise | Faster navigation; respects the preference |
| UX-16 | Every catalogue card blurred the fixed background | No `backdrop-filter` on cards for touch screens and ≤760px | Cheaper scrolling on phones |
| UX-17 | Studio choice on phones gave no visible result | Editor scrolls into view (smooth, or instant under reduced motion); focus stays on the list | Clear cause and effect |
| UX-18 | Pressed compare buttons and active chips were white on teal under System-dark (1.86:1) | `color: var(--on-accent)` | 9.59:1, same as explicit Dark |
| UX-19 | Phone CBSL metrics card had empty gaps | 3-up strip in a compact card | Denser, clearer |
| UX-20 | Catalogue card actions wrapped unevenly | Primary "Add to Comparison" full-width, two secondary actions side by side | Clear hierarchy and equal targets |
| UX-21 | Scattered timings | Motion tokens; the new rules use them | Consistent feel |
| UX-22 | "Back to calculator" 23px; info pages ignored the saved theme | Real 44px button; reading width; pages load `js/boot.js` | Usable target; theme consistent on every page |

Found during WebKit testing and fixed:

- **UX-23 — WebKit dropdowns**: catalogue and Studio menus were 20px tall on phones in WebKit, because native menus ignore the stylesheet's sizing. They now draw their own chevron (`appearance: none`), as the calculator's already did, and are 46px in every engine.
- **UX-24 — iOS focus zoom**: every text field and menu is 16px on phones and touch screens, so iOS Safari no longer zooms the page when one is focused (the catalogue search, filters and Studio menus, and the calculator's catalogue filters, share link, AI search box and calendar menus were 12–15px).
- **UX-25 — date picker**: the savings planner's calendar keeps a 7-column month grid on phones (it had collapsed into a 1,368px single column with the weekday row hidden, also on the live site); its day buttons are 44px on touch.

Found during the pre-release review and hands-on testing in iOS Safari (iOS 27 Simulator), all present in v2.11.6:

| ID | Original problem | Solution | Expected benefit |
|---|---|---|---|
| UX-26 | The "Add a Vehicle" sheet's results were an inner scroll box 111px tall at 375×635 and 14px in landscape (where the page also grew to 886px) | On phones and short screens the whole sheet scrolls and the list grows to its content | Whole cards visible; one natural scroll |
| UX-27 | The phone card's rental-against-limit bar had collapsed to 0px, leaving only the limit mark | The track keeps its 8px height in the stacked cell | The bar is visible again |
| UX-28 | In landscape the camera housing covered the left edge of every page (`viewport-fit=cover` without side safe-area padding) | Gutters grow to the safe area in landscape; dialogs keep clear of it | Nothing hidden behind the camera housing |
| UX-29 | "Mark for Review" in the catalogue dialog was pale text on white in Dark (about 1.1:1) | Panel, border and ink tokens | 13.35:1 (7.26:1 pressed) |
| UX-30 | On iPhone, Safari put the page back after scrolling a focused field above the keyboard, so the field (such as Net Monthly Income) ended up behind it | A guard in `js/page-transitions.js` brings the focused field back to the middle of the visible area when it has ended up out of sight | You can see what you type |

Pre-release review fixes (no visible change intended):

- The catalogue and Studio page links waited a fixed 180ms even under reduced motion; they now use the shared transition.
- The section switcher's smooth scroll is instant under reduced motion.
- Duplicate head-to-head matrix and footer touch-target rules were removed, and the phone `sheetUp` keyframes moved out of a media query.
- The table layout band was extended from 1199 to 1365px after the review found the affordability status and rental hidden behind the sticky actions column at 1200–1365px.

Additional refinements found during implementation:

- **Budget telemetry at 980–1279px** (not in the original inventory): figures ran past their cards and a tag spilled out at 1024px. Card headings now wrap above their tags, and the cards stack in one column where the budget column is narrow (and below 420px).
- **Header at 780–1199px**: now one 71px row (Print as an icon with its accessible name unchanged; "Add" short label up to 1100px; tagline hidden below 1024px).
- **Section switcher**: sticky on phones, tablets and small laptops, frosted, with a Terms link and `aria-current="location"` for the section in view.
- **Gauge needle**: the old matrix transition drifted off the hub; the new hub-centred rotation keeps the needle on its pivot (verified by computing the tip position mid-animation).

## Mobile enhancements in one place

Two-row 121px header · compact hero with a 3-up CBSL strip · sticky section switcher with "you are here" · loan terms on the first screen · one-column comparison cards with every figure visible and a 44px action row · head-to-head matrix and swipeable finalist cards · bottom-sheet dialogs at `92dvh` · 44px targets on touch · sliders with a 44px hit area · budget bar that wraps and gets out of the keyboard's way · catalogue hero, card actions and no per-card blur · Studio scroll-to-editor and 44px photo controls · one-row headers in landscape.

## Remaining limitations

- **Laptop row height**: table rows average 151–167px (were 139px, when two of the six columns were clipped or hidden), because the vehicle column is narrower and its specification pills wrap onto a second line.
- **Lab LCP on the calculator** is ~150–180ms higher on a throttled slow-4G profile (1.22–1.26s → 1.38–1.45s with gzip), from ~6 KB more gzipped CSS. The new rules' CPU cost measured as negligible. All pages remain well inside the 2.5s threshold in the lab; no field data exists to compare.
- **Browsers**: verified in Chromium 1248 and WebKit 27.2 with device emulation, and by hand in iOS Safari in the iOS 27 Simulator (iPhone 18 Pro). Firefox 157 would not start on this Mac; the CI workflow now runs both specs in Firefox, but that run happens only after a push, so Firefox is **not yet verified**. No physical device was used.
- Older rules in the stylesheets still carry literal timings and some duplication; they were left alone to avoid an unbounded refactor.
- Version: bumped to 2.12.0, including `?v=2.12.0` on the three assets that used to load without a version (`js/page-transitions.js`, `css/curated-catalogue.css`, `css/catalogue-studio.css`). Not yet committed; see [release-readiness.md](release-readiness.md).
