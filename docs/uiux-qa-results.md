# VahanaIQ UI/UX Pass — QA Results

**Date:** 26/10/2026 (final re-run after the pre-release review and iOS Simulator fixes) · **Build tested:** local working tree on `4402dc3` (v2.11.6) with the changes in [uiux-improvements.md](uiux-improvements.md)
**Baseline:** an untouched export of `4402dc3` served side by side (port 8766), and the live site `https://akila-w.github.io/VahanaIQ/` (also v2.11.6)
**Environment:** macOS 27.0.1, Node 22.11, Playwright 1.64.1 with Chromium 1248 and WebKit 27.2 (headless). Mobile widths used device emulation (`isMobile`, `hasTouch`). Hands-on testing used Mobile Safari on iOS 27.0 in the Xcode Simulator (iPhone 18 Pro). **Firefox has not been verified (it runs in CI only after a push) and no physical device was used** (see §8).

Raw data, screenshots and the measurement scripts are in `qa/2026-10-26-uiux/` (git-ignored; kept on disk).

## 1. Test suites

| Suite | Before | After |
|---|---|---|
| 24 Node suites (`node test/*.mjs`, as in CI) | 24 passed | **24 passed** |
| `scripts/prune-thumbnails.mjs --check` | passed | passed |
| `scripts/build-info-pages.mjs --check` | passed | passed (pages regenerated) |
| `scripts/build-tokens.mjs --check` | passed | passed (tokens regenerated) |
| `test/browser/csp.spec.mjs` (Playwright, 5 tests) | not run at baseline | **5 passed in Chromium and in WebKit**; now also fails on any CSP violation |
| `test/browser/ui-responsive.spec.mjs` (new, 40 tests) | 4 newest tests **fail** against v2.11.6 | **40 passed in Chromium and in WebKit** on `python3 -m http.server` (as CI serves it) |
| All of the above after the 2.12.0 version bump | — | **24/24 Node suites, all three checks, 45/45 browser tests in each engine, 0 figure differences** |
| Both specs in Firefox | — | **Not run.** The CI matrix includes Firefox; the run needs a push |

Not run: nothing in `serverless/` changed, so no proxy deployment checks were run; `scripts/smoke-deploy.mjs` was not run because nothing was deployed. The CSP spec's sign-in test loads Google's sign-in script (no sign-in was attempted); no AI search, Firebase write or paid call was made by any test.

## 2. Layout across viewports

Every page (Calculator, Catalogue, Studio, About, Privacy, Terms) at 320×568, 360×800, 375×812, 390×844, 414×896, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080 and 844×390, in Light and Dark, re-run on the final build: **144 states in Chromium and 144 in WebKit, 0 wider than the screen, 0 console or page errors, and no phone control under 24px in either engine** (the visually hidden skip link, 1×1 until focused, excluded). CLS stays at or below 0.028 in Chromium; WebKit does not implement the Layout Instability API, so CLS was measured in Chromium only. The same 12-state set under reduced motion: 0 failures.

**Calculator with 24 vehicles** (the state that failed most at baseline):

| Width | Page width before → after | Comparison before → after |
|---|---|---|
| 320 / 360 / 375 / 390 / 414 / 430 | 474–478px → **= screen** | Cards 446px wide, 3 figures clipped per card, actions off-screen → **cards fit, 0 clipped figures or actions** |
| 768 | 815 → **768** | 2-up cards; pills overflowed → fit |
| 1024 | 1398 → **1024** | Table 1028px in a 504px box (1 of 6 columns fully visible) → **892px in 892px, all columns** (one-column layout) |
| 1280 | 1408 → **1280** | 3 of 6 columns visible → **all columns** (one-column layout up to 1365px) |
| 1366 | 1411 → **1366** | 4 of 6 → **819px in 819px, all columns** |
| 1440 / 1920 | = screen | 4 of 6 visible (Affordability clipped, actions hidden) → **all columns** |

Average table row height on laptops: 139px → 151–167px (see Remaining issues).

**First screen on phones** (where the loan terms start):

| Viewport | Header before → after | Loan-terms panel top before → after |
|---|---|---|
| 360×800 | 183 → 121px | 728 → 479px |
| 390×844 | 183 → 121px | 663 → 479px |
| 844×390 | 141 → 71px | 680 → 353px |
| 1024×768 | 141 → 71px | 398 → 347px (first input 820 → 593px) |

## 3. Financial regression

Every figure the calculator displays was extracted with the same 24-vehicle comparison under 8 scenarios — default terms; 12.5% flat rate; 36 months; 70% down; 40% down; 50% DTI limit; insurance LKR 180,000 and fees LKR 95,000; 100% cash — from the modified build and from the live v2.11.6 site. Fields compared per vehicle: name, price, down payment and its note, rental and its note, total interest, total outlay, income needed, affordability bar text, status and LTV warning; plus the DTI readout, its sub-line and status pill, cashflow label and segments, telemetry cards, LTV structure, the `#budgetLive` sentence, the comparison count and the gauge needle angle.

**Result: 0 differences** in Chromium and again in WebKit, on the final build (8 scenarios × 24 vehicle rows plus the budget figures). The engines were each compared with the live site's Chromium extraction, so they also format every figure identically.

The motion code was also checked directly: after a rate change the new DTI text is present in the same frame (no counting), and the needle's `rotate()` attribute holds the final angle immediately (`ui-responsive.spec.mjs`, `behaviour.log`).

## 4. Behaviour checks (11/11 passed in Chromium; 10/11 in WebKit, see note)

| Check | Result |
|---|---|
| Studio: choosing an entry on a phone scrolls the editor into view | editor top 24px |
| Section switcher marks the section in view | `aria-current="location"` on Save |
| Section switcher sticks at the top on phones | top 0 |
| Reduced motion: no entrance animations | 0 running |
| Reduced motion: no animations while using terms and opening a dialog | 0 running; dialog panel untransformed |
| Reduced motion: internal navigation not delayed | 117ms including load |
| New DTI shown in full immediately | 89.3% → 90.5% in the same frame |
| Needle attribute holds the final angle | `rotate(90.0, 160, 150)` |
| Dialog panel transitions from offset to rest | scale 0.996 at 60ms → none |
| Rapid open/close (×6) | closed, `inert`, background not inert, focus on the opener |
| Keyboard focus on sliders and footer controls | 3px solid outline on all six |

WebKit note: this harness reaches the controls with Tab, and Safari's default Tab order skips sliders, buttons and links (Option-Tab reaches them), so the controls were never focused. Focused by keyboard another way, all four show `:focus-visible` with a 3px solid outline in WebKit; the browser spec uses that method and passes in both engines.

## 5. Accessibility

| Item | Before | After |
|---|---|---|
| Controls without a visible keyboard focus (calculator) | 7 (3 sliders, 4 footer controls) | **0** (the 7 inputs the sweep still lists show focus on their wrapper through `:focus-within`, checked by hand) |
| Controls below 24×24 on phones (WCAG 2.5.8), average per page | Calculator 4, Catalogue 3, Studio 3, info pages 1 ("Back to calculator", 23px), excluding the visually hidden skip links | **0 on every page** |
| Controls between 24 and 44px on phones, average per page | Calculator 25, Catalogue 55, Studio 28, info pages 7 | Calculator 9, Catalogue 9, Studio 9, info pages 3 — all are 44px tall but narrower than 44px (short links such as "Studio" and "About") or the theme radios (36×38 labels whose inputs fill the 44px group); all exceed the 24px minimum |
| Pressed "In Comparison" button, System theme on a dark device | 1.86:1 (white on #2dd4bf) | **9.59:1** (same as explicit Dark) |
| Saved Light theme on information pages under a dark device | ignored (page dark) | applied |
| Dialogs: focus trap, Escape, focus return | sound | unchanged, re-verified with rapid open/close |
| `prefers-reduced-motion` | partly honoured; 180ms navigation delay kept | complete; navigation immediate |

Automated checks do not prove accessibility. Not done: a screen-reader pass (VoiceOver, TalkBack or NVDA), Windows High Contrast, 200–400% browser zoom beyond the 320px reflow check, and voice control.

## 6. Performance (laboratory only)

Chromium, 390×844 at DPR 3, 4× CPU throttle, 1.6 Mbps / 150ms RTT, 5 runs per sample, two interleaved rounds, median. These are lab estimates; no field (CrUX) data was available.

**Served with gzip** (as GitHub Pages serves it):

| Page | LCP before → after | CLS before → after | TBT before → after | Longest interaction before → after |
|---|---|---|---|---|
| Calculator | 1.22–1.26s → 1.38–1.45s | 0.003 → 0.008 | 74–91 → 89–94ms | 48 → 48ms |
| Catalogue | 1.89s → 1.79–1.80s | 0 → 0 | 0 → 0ms | 48 → 48–56ms |
| Studio | 0.73s → 0.76–0.86s | **0.120 → 0.008** | 0 → 0–14ms | 32 → 32–48ms |

Served **uncompressed** by the QA fixture server, the calculator's LCP is 4.2–4.3s → 4.9s; the difference is the same cause magnified.

The calculator's LCP element (the hero introduction text) is the same before and after and is not animated. Stripping the new CSS while delivering the stylesheet unthrottled gave identical LCP (≈0.72–0.76s with and without it), so the new rules add no measurable rendering cost; the throttled difference comes from the stylesheet growing by about 6 KB gzipped (30.9 → 36.9 KB) on a slow link. Interaction latency is unchanged and far inside 200ms. The catalogue's phone LCP improved slightly, consistent with removing per-card background blur on touch screens.

## 7. Visual regression

Matched before/after screenshots (same seed and scroll position) are in `qa/2026-10-26-uiux/before` and `/after`: calculator first screen, comparison (Light and Dark), head-to-head, lease details, landscape, 1024px budget, 1366px comparison, 1440px first screen, catalogue on a phone and in Dark at 1440px, Studio on a phone, About in Dark. Every difference was reviewed by eye; all are intended. Desktop at 1440px is unchanged apart from the cashflow labels moving to their own row and the comparison table now fitting its panel.

## 8. Browser coverage

| Engine | Coverage |
|---|---|
| Chromium (desktop) | Full: suites, audit, behaviour, performance |
| Chromium mobile emulation (Android-like touch, DPR 2–3) | Full |
| WebKit 27.2 (Playwright; the engine behind Safari), desktop and iPhone-style emulation | Both browser specs (41/41), the 144-state layout audit, the 88-group figure comparison, behaviour checks and screenshots. Emulation is not iOS Safari itself: the on-screen keyboard, toolbars and native pickers were not exercised. |
| iOS Safari, iOS 27.0 Simulator (iPhone 18 Pro, 402×874) | By hand: calculator terms and keyboard, section switcher, catalogue sheet and add flow, comparison card, savings planner menu and date picker, Dark theme, landscape, catalogue page and vehicle dialog, Photo Studio. Five defects found and fixed (§8b). A second simulator (iPhone SE) was created for another size, but its device-access request was not answered, so other sizes were covered by WebKit emulation only. |
| Firefox 157 | **Not verified.** The Playwright Firefox build would not start on this Mac ("Could not find profile folder"). This was not retried. The CI workflow now runs both specs in Firefox on Ubuntu, one job per engine, but that run happens only after a push. |
| Physical devices | **None** |

## 8a. Found and fixed during cross-engine testing

| Issue | Engines | Evidence | Fix |
|---|---|---|---|
| Catalogue and Studio dropdowns 20px tall on phones | WebKit only | Native menus ignore the stylesheet's padding and 46px minimum (computed `min-height` 18px) | Menus draw their own chevron with `appearance: none`, as the calculator already does: 46px in both engines |
| Fields under 16px make iOS Safari zoom on focus | All (pre-existing) | Catalogue search 15px and filters 12px; Studio menus 12px; calculator dialogs: catalogue filters 12.5px, share link 13px, AI search box 15px, calendar menus 13px | Every text field and menu is 16px on phones and touch screens |
| Savings planner date picker collapsed into one column | All (pre-existing; live site too) | Below 980px the comparison's card rules turned the calendar table into a 1,368px column with the weekday row hidden | The calendar keeps its table layout: a 7-column grid 321px tall, 44px day buttons on touch |

## 8b. Found and fixed in iOS Safari (Simulator) and the pre-release review

| Issue | Evidence | Fix | Verified |
|---|---|---|---|
| **UX-30**: the focused field ends up behind the keyboard | Trace on the real page: Safari scrolls `#income` above the keyboard (visual viewport 754 → 410 high), then scrolls the page back to where it was when its toolbar changes (410 → 510). The live site does the same. Bisection: copies with any one script or block removed still failed, so no script causes it. | Guard in `js/page-transitions.js`: after the visible area changes, and for any scroll within the next second, a focused field that is out of sight is scrolled back to the middle | Simulator: the trace shows the guard catching Safari's undo; the field stays visible; typing on the keypad shows 650,000. Browser spec (simulated resize) passes in both engines and fails on v2.11.6 |
| **UX-26**: catalogue sheet results in a tiny inner scroll box | WebKit: results box 226px tall at 402×754, 111px at 375×635 and 14px at 844×340 (page 886px wide) | The whole sheet scrolls on phones and short screens | 0 inner scroll boxes; page width = screen; Simulator; spec |
| **UX-27**: phone card rental bar 0px tall | WebKit and Chromium: track height 0 at 402 and 768px | Track keeps its height | 8px; Simulator; spec |
| **UX-28**: content under the camera housing in landscape | Simulator screenshots | Safe-area gutters in landscape; dialogs too | Simulator (calculator, catalogue); header has no overlaps at 812–932px with simulated 44–62px insets |
| **UX-29**: "Mark for Review" unreadable in Dark | #f1f5f9 on #ffffff in Dark and System-dark, in v2.11.6 too | Theme tokens | 13.35:1 at rest, 7.26:1 pressed (5.71:1 in Light); spec |
| Table at 1200–1365px hid the affordability status and rental behind the sticky actions column | Review screenshots | One-column layout extended to 1365px | Audit; spec at 1280 and 1366px |
| Catalogue and Studio links waited a fixed 180ms under reduced motion | Code review | Use the shared transition | Code; reduced-motion spec |

## 9. Remaining issues

| Item | Severity | Note |
|---|---|---|
| Firefox verification | P1 (verification gap) | Runs in CI after the release branch is pushed. Do not merge until it is green. |
| Real-device verification | P2 (verification gap) | iOS Safari was tested in the Simulator. Use [iphone-qa-checklist.md](iphone-qa-checklist.md) on a real iPhone. |
| Status-bar colour after a live theme switch on iPhone | P3 | Safari keeps the previous colour until reload, although the page updates its `theme-color` tags. |
| Laptop table rows 12–20% taller | P3 | Trade-off for showing every column. |
| Calculator lab LCP +150–180ms on throttled slow 4G | P3 | Still ~1.4s. Splitting rarely used rules (print, account, credits) out of `style.css` would recover more than was added. |
| Older literal timings and duplicated rules in the stylesheets | P3 | Left as they were to keep the change bounded. |
