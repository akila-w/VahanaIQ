# Independent integration and responsive verification

Date: 27/10/2026. Working branch: `feature/v2.12.0-release`, HEAD `72dba7d`. No commit, push, merge or deployment was performed.

## Checklist and scope

- [x] Read the three supplied transcripts and compare their claims with the current working tree.
- [x] Preserve existing changes; snapshot the initial diff before this pass.
- [x] Capture the current site before implementing corrections.
- [x] Review the complete tracked diff and onboarding source, including generated-asset inputs.
- [x] Run all six routes at the twelve requested widths plus breakpoint-adjacent widths in light/dark.
- [x] Exercise populated comparisons, charts, long-horizon savings, sharing and dialogs in portrait/landscape.
- [x] Independently reconcile financial results and check the official regulatory document.
- [x] Correct confirmed defects and add browser regressions.
- [x] Complete the final combined browser runs and record their results below.

This review tests the combined Gemini and Codex working tree. Earlier reports and static test assertions are context, not proof that a rendered control is correct. The screenshots used below were captured in this review.

## Interaction between the two implementations

Gemini's transcripts describe the earlier standalone quick-start, financial display, catalogue, planner and static-asset changes. Codex added the shared guidance system alongside those changes. There are no unresolved Git merge markers. Fifteen previously modified tracked-file diffs outside this pass's intended edits were preserved byte-for-byte against the initial snapshot.

The desktop grid warning in Gemini's third transcript describes an earlier intermediate implementation. The current welcome is a child of `.hero`, not an extra grid item under `main`. It therefore does not add a row beside the sticky terms panel. Existing exact alignment checks and the new desktop matrix verify the current arrangement; Gemini's proposed row-number CSS patch is unnecessary for this structure.

There was a real overlap in purpose: Gemini's quick-start and the shared welcome/Help Centre both appeared above the calculator. The guidance module now hides the static quick-start once Help Centre has mounted. The original content remains available when JavaScript/modules do not load. Skipping, resuming and restarting the shared tours still work.

## Confirmed corrections in this pass

| Area | Evidence and correction | Regression coverage |
| --- | --- | --- |
| Off-scale badge | An SVG `<g>` does not implement `HTMLElement.hidden`. The code assigned a property but left the `hidden` attribute in place, so the badge remained `display:none` even at 110.1%. Update the attribute as well. | Actual SVG visibility at all 17 ratio boundaries in both engines; previous mock-DOM assertions retained. |
| Cashflow overflow | The 82% commitment / 18% shortfall split compressed the income scale and clipped the shortfall on phones. Keep the track on 0–100% of income and place excess in a separate wrapping notice with exact amounts and a component breakdown. | Exact 110.1% case, all boundaries, populated-page clipping checks and fresh 320/390px screenshots. |
| Catalogue interest | `parseFloat(rate) || DEFAULT_RATE` converted a legitimate 0% quote to 16%. Preserve finite zero and the core's maximum-rate bound. | Independent zero-interest calculation compared to both rendered pages. |
| Catalogue precision | The summary sentence had cents, but the metric tiles still rounded rentals and deposits to whole rupees. Display two decimal places. | Exact two-decimal rental and deposit reconciliation across eight scenarios. |
| Catalogue transfer | Adding a catalogue vehicle omitted its finance class and first-registration date. Preserve both in the comparison record so the same deposit basis reaches the Calculator. | Actual catalogue add action, stored-record inspection and the resulting Calculator deposit. |
| Information pages | Global desktop `main` grid styles placed About/Privacy/Terms headings, introduction, content and footer in calculator columns. Scope `main.info-page` to block layout; align its header controls responsively. | Full content width and display-mode assertions for all three pages across all widths/themes. |
| Studio System/light fields | An unconditional `:root:not([data-theme="light"])` rule gave the System theme dark field backgrounds even on light devices. Remove the override and use the existing adaptive tokens. | Rendered search-field background compared with `--select-bg` in both themes at every matrix width. |
| Savings at 320px | Populated results expanded the grid's intrinsic minimum width; the trajectory's right edge reached 328px on a 320px screen. Use zero-minimum grid tracks/children and wrap the composition header. Draw the SVG at its container width so axis labels retain their size instead of shrinking a 680px plot. Give the collapsed planner a sufficiently specific hide rule so its later grid rule cannot leave its controls visible. | Populated long-horizon planner and clipping assertions at all tested widths. |
| Financial text contrast | Insurance and available-buffer segment labels used light text on relatively light fills. Use the existing darker semantic tokens in light mode, which also adapt in dark mode. | Token checks, rendered screenshots and existing theme regressions. |
| Regulatory comment | A calculator comment called the 84-month product limit statutory. Correct the comment without changing any formula or limit. | Primary document review; calculation regressions unchanged. |

Files edited in this pass: `js/app.js`, `js/calculator.js` (comment only), `js/curated-catalogue.js`, `js/planner.js` (responsive SVG width, resize observation and equivalent simplification of its horizon condition), `js/guidance.js`, `css/style.css`, regenerated `css/style.min.css`, `css/catalogue-studio.css`, `css/guidance.css`, `test/browser/ui-responsive.spec.mjs` (wait for sticky layout to settle), `test/browser/guidance.spec.mjs` (deterministic static-file project-path fixture), `test/e2e-journeys.test.mjs` (check an actual zero-contribution projection rather than an obsolete source substring), and `.github/workflows/test.yml`. Added `test/browser/independent-qa.spec.mjs` and this report. The comprehensive audit has an independent-verification addendum.

## Independent financial and regulatory checks

The exact fixture uses a zero-rate 12-month quote with a price of LKR 7,269,515.40 and 60% down. This produces the requested LKR 242,317.18 rental without deriving the expected value from the application's finance functions. With income LKR 220,000.00 and no other costs, the independent result is 110.14417%, displayed as **110.1%**, with **LKR 22,317.18** monthly shortfall. Visible text, the actual off-scale SVG badge and the cashflow accessible description are asserted.

The eight cross-page scenarios use an independent annuity formula or the direct flat-interest repayment formula, not imports from the implementation. They cover zero interest, reducing/new minimum deposit, flat/reconditioned, used/40%, recently registered, explicit commercial class, fees/insurance and full cash with insurance/debt. Both pages match the expected rental and deposit to two decimal places. All 17 ratios requested in the transcript are exercised: 0, 10, 39.9, 40, 40.1, 49.9, 50, 50.1, 59.9, 60, 60.1, 75, 99.9, 100, 110.1, 150 and 200%.

Correction to the original audit: the earlier flat-rate factor `1/n + rate/1200` is algebraically identical to `loan * (1 + rate*n/1200) / n`. Replacing it with an effective-rate conversion is useful for sharing logic, but is not itself evidence of a 3–8% formula error. The original narrative overstated that issue. Deposit floors, omitted costs, zero-rate fallback and rounding were the concrete discrepancies.

The six-page [CBSL Act Directions No. 01 of 2026](https://www.cbsl.gov.lk/sites/default/files/cbslweb_documents/laws/CBSL_Act_Directions_No_1_of_2026_e.pdf) was downloaded from the official site and rendered for inspection. Clause 2.1 and Table 1 distinguish registration age and DMT class. They support the existing ordinary passenger-vehicle deposit basis and the explicit commercial-class treatment. The table names light trucks and single cabs within class B; it does not support automatically classifying every double cab/pickup as commercial, as Gemini's transcript suggested. Existing lender/classification caveats remain appropriate. Annexure I contains transitional LC provisions, which the app does not model. The Direction contains no personal DTI threshold or lease-tenure cap; 40%/50% DTI and 6–84 months remain product planning assumptions. This inspection is not a claim that every exceptional vehicle/LC situation is modelled.

## Recheck of the original 16 items

| Original item | Independent outcome |
| --- | --- |
| AUD-FIN-01 | Retained shared finance functions; corrected zero-rate handling, metric precision and classification transfer; eight formula scenarios pass. Corrected the original flat-formula narrative above. |
| AUD-SEC-01 | Actual JPEG fixture accepted; corrupt JPEG and SVG refused with inline errors and no additional photo. This confirms the upload behaviour, not the original report's exploit/severity claim. |
| AUD-GAUGE-01 | Corrected the real SVG visibility failure; off-scale behaviour now checked in a browser. |
| AUD-GAUGE-02 | Pending income behaviour retained; existing mock and browser suites pass. |
| AUD-CASH-01 | Corrected compressed income scale and narrow-screen notice clipping; true ratio/shortfall retained. |
| AUD-CASH-02 | Insurance still included in commitments and chart representation. |
| AUD-REG-01 | Statutory deposits remain distinct from app DTI guidelines; primary source inspected. |
| AUD-CASH-03 | Numeric telemetry and overflow descriptions checked on populated pages. |
| AUD-TERM-01 | Net-income commitment explanation remains in Help Centre and the static fallback. |
| AUD-PLAN-01 | Long-horizon trajectory remains; actual populated planner checked and 320px overflow corrected. |
| AUD-ONB-01 | Unified entry point; static fallback retained; all 24 shared-guidance browser checks remain. |
| AUD-A11Y-01 | Cashflow actual values remain in accessible descriptions and visible text. Keyboard/focus/reduced-motion checks pass; no screen-reader certification claimed. |
| AUD-PWA-01 | Shell additions preserved; actual offline guidance journey and version checks pass. |
| AUD-UX-01 | Filter reset preserved and existing regression checks retained. |
| AUD-LOC-01 | British spelling retained. |
| AUD-SEO-01 | Metadata changes preserved; generator checks pass. |

## Coverage and results

Widths: **320, 360, 375, 390, 414, 430, 600, 768, 979, 980, 1024, 1280, 1365, 1366, 1440 and 1920 CSS px**. Each width visits all six routes in System/light and System/dark and opens/closes Help Centre: **192 route/theme/width states per engine, 384 across Chromium and WebKit**. Populated journeys additionally use **844 × 390 landscape** and all sixteen widths above.

Alignment is checked numerically: page width, viewport bounds of major headings/controls/figures, full information-page content width, desktop terms/budget top alignment and the existing exact sticky/bottom-alignment assertions. The populated test checks readable financial figures and shortfall text, chart bounds and modal bounds. This establishes the named states; it cannot establish that every possible data value, font, browser zoom or device renders identically.

| Command/check | Outcome |
| --- | --- |
| `node --test test/*.test.mjs` | 25 passed, 0 failed |
| `node test/verify.mjs` | All 11 verification groups passed |
| `npx playwright test test/browser/*.spec.mjs --browser=chromium --workers=2 --reporter=list` | Latest full run: 134 passed; one project-path fixture teardown race. After correcting the fixture, all 24 guidance checks passed; the path case also passed three consecutive runs. All 135 distinct checks are verified. |
| Same command with `--browser=webkit` | 135 passed, 0 failed |
| Final responsive-chart rechecks | 17 populated viewport tests passed in each engine after the last visual refinement; planner unit suite also passed |
| Firefox 390px route sweep attempt | Cannot launch: “Could not find profile folder”; no Firefox pass claimed |
| `node scripts/build-css.mjs --check` | Passed |
| `node scripts/build-info-pages.mjs --check` | Passed |
| `node scripts/build-tokens.mjs --check` | Passed |
| `node scripts/prune-thumbnails.mjs --check` | Passed: 140 referenced thumbnails |
| `git diff --check` | Passed |

Test-observation corrections were not product fixes: the upload error is shown in `#photoError`, not the success toast; and exact sticky measurements now wait one animation frame after scrolling. All original alignment assertions remain unchanged. The target-date Node journey now executes the SVG generator and checks its projection output, replacing a brittle assertion about the spelling of a numeric limit in the source. The corrected upload/sticky tests passed three consecutive Chromium runs. The final Chromium full run exposed an additional speculative-fetch teardown race in the project-path test fixture. That fixture now serves the real local files directly at the project prefix; the entire 24-check guidance suite passes after the correction, as do three repeated path checks. The WebKit path check also passes with the updated fixture. No application failure was suppressed. WebKit fixture interception was moved before the initial navigation so its resource cache could not replace the test data with the real catalogue. Those failed/intermediate runs are not described as passes.

## Visual evidence and remaining limits

The in-app browser's current calculator was inspected first. Fresh Playwright screenshots cover all six routes at 320, 390, 600, 768, 1440 and 1920px in both themes and both engines. Images were saved in `qa/2026-10-27-independent/`; that existing ignored QA area also contains measurements, contact sheets and final Git snapshots.

1. **Welcome and navigation:** initial and returning states fit; duplicate quick-start removed when guidance is active. See `chromium-390-light-index.png`.
2. **Affordability and overflow:** actual ratio, badge and complete shortfall notice visible on phones. See `final-390-light-gauge.png` and `final-320-dark-cashflow.png`.
3. **Catalogue and comparison:** filters/details and financial results reconcile; classification survives transfer. See the catalogue route screenshots and formula tests.
4. **Savings and dialogs:** long-horizon chart and composition fit at 320px; details and sharing stay within bounds in portrait/landscape. See `final-savings-320.png`.
5. **Photo Studio:** System/light inputs use light adaptive tokens; valid/invalid uploads exercised. See `chromium-390-light-studio.png`.
6. **Information routes:** full-width reading layout restored at desktop and headers wrap consistently on phones. See `chromium-1440-light-about.png` and the privacy/terms equivalents.

Screenshots at the named routes/states were inspected individually or in route contact sheets. A screenshot is not a complete accessibility audit. No physical phone, assistive-technology session, authenticated Google sign-in, live account synchronisation or live AI response was tested. Browser zoom/physical virtual-keyboard behaviour is not exhaustively verified. Firefox still requires its configured Ubuntu CI job. The new suite is added to the existing three-engine CI command, but no CI run or deployment has been triggered.

Release recommendation: the combined changes are ready for user review based on 270 passing local browser checks and the Node/build results above. Hold publishing until the Firefox CI result and explicit release approval are available. No local critical journey failure remains in the tested Chromium/WebKit states. No physical-device or live-service certification is claimed.



## Final Git snapshot

No commit or deployment was made. Tracked diff statistics exclude the new untracked files listed by status.

```text
 M .github/workflows/test.yml
 M about.html
 M catalogue.html
 M css/catalogue-studio.css
 M css/style.css
 M css/style.min.css
 M index.html
 M js/app.js
 M js/calculator.js
 M js/catalogue-studio.js
 M js/curated-catalogue.js
 M js/planner.js
 M manifest.json
 M privacy.html
 M scripts/build-info-pages.mjs
 M sitemap.xml
 M studio.html
 M sw.js
 M terms.html
 M test/browser/ui-responsive.spec.mjs
 M test/catalogue-studio.test.mjs
 M test/e2e-journeys.test.mjs
 M test/planner.test.mjs
 M test/verify-graphics.test.mjs
 M test/verify.mjs
?? css/guidance.css
?? docs/comprehensive-website-audit.md
?? docs/independent-integration-qa.md
?? docs/onboarding-implementation.md
?? docs/onboarding-verification.md
?? js/guidance-content.js
?? js/guidance-state.js
?? js/guidance.js
?? test/browser/guidance.spec.mjs
?? test/browser/independent-qa.spec.mjs
?? test/guidance.test.mjs
```

```text
 .github/workflows/test.yml          |   3 +-
 about.html                          |   2 +-
 catalogue.html                      |  14 +++
 css/catalogue-studio.css            |  10 +-
 css/style.css                       | 178 +++++++++++++++++++++++++++++++++--
 css/style.min.css                   |   2 +-
 index.html                          |  48 +++++++---
 js/app.js                           | 183 ++++++++++++++++++++++++++++--------
 js/calculator.js                    |   2 +-
 js/catalogue-studio.js              |  44 +++++++++
 js/curated-catalogue.js             |  52 +++++-----
 js/planner.js                       |  32 +++++--
 manifest.json                       |   4 +-
 privacy.html                        |   2 +-
 scripts/build-info-pages.mjs        |   6 +-
 sitemap.xml                         |  10 +-
 studio.html                         |   2 +
 sw.js                               |   8 ++
 terms.html                          |   2 +-
 test/browser/ui-responsive.spec.mjs |   7 +-
 test/catalogue-studio.test.mjs      |   4 +
 test/e2e-journeys.test.mjs          |   3 +-
 test/planner.test.mjs               |  26 ++++-
 test/verify-graphics.test.mjs       |  99 ++++++++++++++++++-
 test/verify.mjs                     |  19 +++-
 25 files changed, 637 insertions(+), 125 deletions(-)
```
