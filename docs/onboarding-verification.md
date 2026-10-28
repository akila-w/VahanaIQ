# Onboarding verification — 27/10/2026

Local implementation in `/Users/Shared/vahanaiq`. No commit, push, merge or deployment was made. The detailed requirements promised after the request's final sentence were not attached; the implemented scope is the five listed feature groups and the stated completion criteria.

## Automated checks

| Check | Result |
| --- | --- |
| `node --test test/*.test.mjs` | 25 suites passed, including the new guidance state suite |
| `node test/verify.mjs` | All 11 verification groups passed |
| Chromium browser suites | 75 checks passed: 24 guidance, 46 responsive/UI and 5 CSP/integration checks |
| WebKit browser suites | 24 guidance checks passed; all 51 existing browser checks passed (75 total) |
| Firefox launch | Unverified: Playwright Firefox exits before opening a page with “Could not find profile folder” on this Mac |
| Information-page generator | `node scripts/build-info-pages.mjs --check` passed |
| Design-token generator | `node scripts/build-tokens.mjs --check` passed |
| Published image assets | `node scripts/prune-thumbnails.mjs --check` passed: 140 referenced thumbnails |
| Module versions | Version checks passed, including all new imports |
| Diff whitespace | `git diff --check` passed |
| Unrelated changes | 12 pre-existing file diffs outside the intended integration files match the initial snapshot byte-for-byte |

The final preference-toggle refinement was also repeated three times successfully in Chromium.

The initial sandboxed regression run could not bind the mock server used by the price-refresh suite. The authorised local-server run passed. A session interruption stopped the preview server; those connection-refused test runs were discarded and rerun against the restarted server. Parallel browser execution also produced a one-off timeout in an existing responsive test; the single-worker rerun passed. These are recorded to distinguish infrastructure retries from successful application verification.

## Behaviour exercised

- First visit has an inline invitation, with no automatic modal or tour. Dismissal persists on reload and across pages.
- Tours start, move backwards and forwards, minimise, skip, resume after reload, restart from Help Centre and complete. Completing/skipping removes highlights and restores focus. Explicit cross-page tour links remove their transient query parameter after launch.
- Real calculator controls remain usable. A saved non-default rate and deposit, and all other stored app data, remain unchanged after the guide is explored. Existing finance, planner and account regression suites remain green.
- Calculator suggestions change after vehicles are added. Hiding suggestions works immediately, persists and propagates to another tab. Help Centre can re-enable them.
- Help search filters explanations, handles zero results and treats HTML-like queries as text. Contextual buttons open the relevant article. Help is present on all six shipped pages.
- Existing calculator modals take priority while a tour is active; closing them returns to the same tour step.
- Unavailable/corrupt storage does not prevent help or touring. Unit checks cover failed writes, unknown versions and invalid progress.
- A real service-worker installation caches the new assets; catalogue help and its tour work with the browser offline. A project-subpath route checks relative assets and cross-page navigation under `/VahanaIQ/`.
- No page errors or CSP violations were observed in the guidance touch/landscape journey; existing CSP browser checks also passed.

## Accessibility and responsive checks

- Guidance tested at 320, 390, 768 and 1440 CSS pixels in both system light and system dark, with reduced motion. Existing layout checks also exercise 360, 430, 1024, 1280 and 1366 pixels, wide fallback fonts and populated comparisons.
- Touch emulation exercises real fields, 44px tour controls, a 390px phone viewport and an 844 × 390 landscape viewport. The guide minimises before moving focus to a field; the focused rate field remains above the guide.
- Help dialog keyboard traversal includes every visible control and stays within the dialog. Escape closes it even when a search field contains text. Contextual help and tour launches explicitly preserve the opener in Safari, where mouse clicks do not necessarily focus buttons.
- Tour steps focus their headings; Skip/Finish are announced through a status region. The tour is intentionally non-modal so the actual app remains usable. Existing dialogs temporarily hide it.
- Reduced motion disables tour animation; existing dialog motion rules respect the same preference. Printing suppresses welcome, tours, help and contextual controls.
- Measured Help Centre body/meta text contrast: 5.68:1 light and 5.71:1 dark. Eyebrows: 6.75:1 / 9.89:1. Headings: 15.13:1 / 13.35:1. These are rendered colour measurements, not a claim of a complete accessibility certification.

## Visual review and refinements

Actual Chromium screenshots were inspected for the Calculator, Catalogue and Studio on a 390px phone in light/dark, a 320px phone and a 1440px desktop. The capture script is `qa/2026-10-27-onboarding/capture.cjs`.

The review led to: minimising the tour during real input; moving the welcome inside the hero to preserve the desktop two-column layout; separating the mobile welcome from the metrics card; replacing stranded disclosure markers with aligned plus/minus controls; and aligning field help buttons with their labels.

Selected local screenshots (the existing `qa/` exclusion keeps these working artefacts out of Git):

- [Mobile welcome](../qa/2026-10-27-onboarding/mobile-light-welcome.png)
- [320px Calculator tour](../qa/2026-10-27-onboarding/small-phone-index-tour.png)
- [Dark Help Centre](../qa/2026-10-27-onboarding/mobile-dark-help.png)
- [Dark Catalogue tour](../qa/2026-10-27-onboarding/mobile-dark-catalogue-tour.png)
- [Mobile Photo Studio tour](../qa/2026-10-27-onboarding/mobile-light-studio-tour.png)
- [Desktop welcome](../qa/2026-10-27-onboarding/desktop-welcome.png)
- [Desktop tour](../qa/2026-10-27-onboarding/desktop-index-tour.png)

## Limits of verification

No physical phone, VoiceOver/NVDA session, authenticated Google sign-in or live cross-device account synchronisation was exercised. Mobile checks use Playwright viewport/touch emulation and WebKit; they do not establish every behaviour of a physical iOS keyboard. Firefox remains a platform launch limitation; the existing three-engine CI matrix now includes the guidance suite and awaits an authorised push. Local project-path and offline tests do not claim a live GitHub Pages deployment. No regulatory calculation or underlying financial rule was changed.

## Follow-up: contextual help alignment, 27/10/2026

The user correctly identified awkward help-button placement after the broader review. The earlier viewport checks did not assert local icon/text alignment. Their passing results must not be interpreted as proof of universal pixel-perfect alignment.

Contextual buttons now sit beside their labels/headings in explicit flex rows, rather than inside them. Headings retain their own accessible names, labels remain associated only with their form controls, and wrapped headings align their icon with the first line. All eight contextual buttons use the existing Lucide circle-help asset, a fixed 44 × 44px hit target and 4px layout gap. Specific component styles can no longer enlarge the Catalogue Review help button or change its height. Catalogue price help is beside the result count instead of floating as a third toolbar item. Financing labels reserve consistent row height and bottom spacing so neighbouring input top edges align. The icon is included in the offline shell.

`test/browser/help-alignment.spec.mjs` adds 32 checks covering sixteen widths from 320 to 1920px in light/dark, each visiting Calculator, Catalogue and Studio. It checks actual button size, text/first-line alignment, spacing, viewport bounds, semantic placement and focus return. Together with the 24 existing guidance checks, 56 checks passed in each of Chromium and WebKit. Eight cases per engine were rechecked after the final field-spacing correction, including an explicit common top-edge assertion for adjacent finance controls. State and module-version suites and `git diff --check` also passed. The focused suite is included in the CI browser command.

Screenshots were captured before and after and visually inspected. Close-ups and full viewport examples are in `qa/2026-10-27-help-alignment/`; `help-alignment.png` shows the final placement on all three pages and the savings heading. This is a scoped correction and verification, not a new claim that every element in every state is perfectly aligned.

## Follow-up: quick explanations, 27/10/2026

At the user's request, all eight contextual icons now open a compact, non-modal explanation. More details opens the matching Help Centre article; closing that dialog returns focus to the original icon. The permanent Help Centre and tour explanations remain available. Copy is separate, concise UK English text for rates, deposits, budgets, comparison, catalogue prices, savings and photos.

Implementation uses the browser's native auto-popover top layer, with no dependency, backdrop or page scroll lock. Outside click, Close, Escape, repeated-icon toggle and focus leaving the panel dismiss it. Keyboard actions receive focus explicitly and remain reachable under Safari's keyboard preferences. Only the active icon is exposed as expanded; Escape from a popover does not skip an active tour. Position follows the heading/label row, flips above when necessary and is clamped to the visual viewport with 12px edges. Resizing or scrolling updates the position; browsers may dismiss a popover on rotation, and it can be reopened at the new size. Financial and guidance storage remain unchanged by contextual help.

The content-module import tolerates an earlier cached copy while this unreleased version's service-worker cache refreshes. A dedicated test supplies the previous content module and verifies that help remains available. Offline checks now exercise a quick explanation and its More details route too.

Verification commands for this follow-up:

```sh
npx playwright test test/browser/guidance.spec.mjs test/browser/help-alignment.spec.mjs --browser=chromium --workers=2 --reporter=list
npx playwright test test/browser/guidance.spec.mjs test/browser/help-alignment.spec.mjs --browser=webkit --workers=2 --reporter=list
npx playwright test test/browser/csp.spec.mjs test/browser/ui-responsive.spec.mjs --browser=chromium --workers=2 --reporter=list
npx playwright test test/browser/csp.spec.mjs test/browser/ui-responsive.spec.mjs --browser=webkit --workers=2 --reporter=list
node test/guidance.test.mjs
node test/module-versions.test.mjs
git diff --check
```

Results: all 59 guidance/alignment cases passed in each engine (27 guidance, 32 alignment), and all 51 existing CSP/responsive cases passed in each engine: 110 distinct cases per engine, 220 total. Both Node suites and `git diff --check` passed. The 32 alignment/placement cases were rerun per engine after the final horizontal-position refinement. Coverage includes all three contextual-help pages, sixteen widths from 320–1920px, light/dark, reduced motion, 320 × 568px touch and 844 × 390px landscape, keyboard actions, focus return, dismissal, article links, offline use and the project subpath. No new Firefox or physical-device coverage is claimed; the earlier environment limitations still apply. This follow-up does not rerun the financial suites because no financial code was changed.

During verification, the first browser run could not connect because the local server had stopped; it was restarted and those results were discarded. Safari's skipped-button navigation was corrected. An initial Safari suggestion-preference assertion failed; its targeted rerun and subsequent full run passed without suppressing or weakening that assertion. The rotation check waits for two layout frames before inspecting native dismissal. Test failures were investigated before rerunning.

Screenshots were visually reviewed in light/dark at 320px, 390px and 1440px, including Calculator, Catalogue and Studio. Desktop review prompted aligning the panel with its own heading row to avoid extending into the neighbouring column. The current in-app Calculator preview was refreshed and its real popover inspected. Capture script and PNGs: `qa/2026-10-27-help-popovers/` (local, ignored). Main example: `mobile-light.png`.

Changed for popovers: `js/guidance.js`, `js/guidance-content.js`, `css/guidance.css`, `test/browser/guidance.spec.mjs`, `test/browser/help-alignment.spec.mjs` and the two onboarding documents. The preceding alignment change also added the existing help icon to `sw.js` and the alignment suite to `.github/workflows/test.yml`. No dependency, commit, push, merge or deployment was made.
