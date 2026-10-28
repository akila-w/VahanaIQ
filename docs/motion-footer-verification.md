# Motion, hover and Calculator footer verification

27/10/2026. Local working tree only; no commit, push, merge or deployment.

## Checklist

- [x] Inspect current motion rules, tokens and actual rendered behaviour.
- [x] Probe interrupted chart animation and a live reduced-motion preference change.
- [x] Check hover feedback on Calculator, Catalogue and Studio with mouse, touch and reduced motion.
- [x] Refine contextual-help entrances and control transitions.
- [x] Refine the Calculator footer supplied in the user's screenshot.
- [x] Capture and inspect real mobile/tablet/desktop screenshots.
- [x] Add automated motion, hover and footer tests to browser CI.

## Confirmed behaviour and changes

The original probe found no contextual-popover entrance; two simultaneous needle effects after rapid rate changes; and ongoing chart/tint effects after turning reduced motion on. Desktop Add a Vehicle lifted by 1px with a transition covering only background/border, causing an abrupt positional change. Its hover transform also applied with a coarse pointer and under reduced motion. Catalogue card photos were already intentionally stationary.

Contextual popovers now use the existing 150ms entrance, Help Centre a consistent 200ms entrance on all three routes, and guidance controls 150ms colour transitions. Escape, outside click and repeated-icon dismissal remain immediate. Effects do not lock fields or delay financial readings.

Chart effects are tracked per element and replaced on interruption. The needle retargets from the visible angle; bars start from the visible width. Figure tints do not accumulate. A live reduced-motion change cancels outstanding JavaScript effects and reveals the already-final readings. The dedicated browser test pauses an actual in-flight needle/bar at 100ms, changes the real interest-rate field, and asserts continuity of the next keyframe and only one needle effect. It then changes the media preference and verifies that no running or paused effect remains. No calculation formula was changed.

The stronger bar assertion initially failed because repeated input/change renders replaced unchanged graphic markup, discarding its active animation. Identical bar markup is now retained, which preserves the in-flight effect and avoids unnecessary DOM replacement. The assertion was retained.

Button hover now transitions transform/shadow as well as colour. Calculator hover movement is limited to fine pointers without reduced motion; Catalogue movement is explicitly removed on coarse pointers and under reduced motion, including selectors with higher specificity. Help icon targets stay stationary. Card lift remains 2px on desktop, and photos retain their established framing.

The Calculator footer has a short introduction with the financial-advice notice always visible, three native disclosure rows preserving the original explanations, Explore/Information link groups, and compact source/credit links. Touch links remain at least 44px high. Source Guide explicitly focuses its opener before showing the native dialog so Safari can return focus correctly. Print events open all explanations and restore their previous disclosure state afterwards. Regulatory wording, source links and live price-date updates were retained.

The existing token regression test also identified direct style assignments in the preceding popover implementation. Popover geometry now uses runtime CSS custom properties; the stylesheet owns width/height/position declarations. The test was not weakened.

## Verification

New suite: `test/browser/motion.spec.mjs`, 16 cases per engine. It checks full/reduced guidance motion at 320/390/768/1440px across Calculator/Catalogue/Studio, live preference changes, rapid reopening, needle/bar continuity, desktop/reduced/touch hover, stationary photos, footer disclosures, keyboard operation, touch target bounds, print state restoration and source-dialog focus return.

Commands:

```sh
npx playwright test test/browser/motion.spec.mjs --browser=chromium --workers=2 --reporter=list
npx playwright test test/browser/motion.spec.mjs --browser=webkit --workers=2 --reporter=list
npx playwright test test/browser/csp.spec.mjs test/browser/ui-responsive.spec.mjs test/browser/guidance.spec.mjs test/browser/help-alignment.spec.mjs --browser=chromium --workers=2 --reporter=list
npx playwright test test/browser/csp.spec.mjs test/browser/ui-responsive.spec.mjs test/browser/guidance.spec.mjs test/browser/help-alignment.spec.mjs --browser=webkit --workers=2 --reporter=list
```

All 25 `test/*.test.mjs` suites and the separate `test/verify.mjs` runner were executed. The end-to-end and print suites were rerun after the final source-dialog/print changes. Generated `css/style.min.css` was rebuilt and checked, and `git diff --check` was run.

Results: all 25 Node suites and the separate verification runner passed. The 16 new motion/hover/footer cases passed in each engine, along with all 110 existing CSP/responsive/guidance/alignment cases per engine. The expanded needle-and-bar continuity case was rerun in both engines after the final unchanged-markup correction; end-to-end, graphics and QA regressions were rerun too. These are 126 distinct browser cases per engine, 252 total; targeted reruns are not counted as extra coverage.

Initial failures were investigated: the restricted test process could not bind its local test server, so it was rerun with local execution access; the token check identified the preceding popover style assignments; hover tests exposed Catalogue specificity overrides; and the footer focus test identified Safari's pointer-focus behaviour. No failure was suppressed and no assertion was weakened.

## Visual evidence and limits

Local artefacts: `qa/2026-10-27-motion/` (ignored by Git). `capture.cjs` produces footer screenshots at 320/390/768/1440px, a dark phone view, closed/expanded explanations, and popover frames at 0/75/150ms. `probe.cjs` and `hover-probe.cjs` record rendered animation/transform states. The frames and mobile/desktop footer screenshots were inspected, and the existing in-app preview was refreshed.

Selected images: `footer-phone.png`, `footer-phone-expanded.png`, `footer-phone-dark.png`, `footer-small-phone.png`, `footer-tablet.png`, `footer-desktop.png`, and `popover-75.png`. A screenshot sequence plus actual animation-state measurements verifies the transitions; this does not claim measured frame rates on physical phones.

Firefox still cannot launch on this Mac; no physical phone, assistive-technology session or live deployment was tested. Mobile checks are browser emulation. No universal pixel-perfect or performance-certification claim is made.

## Files for this follow-up

`js/app.js`, `js/guidance.js`, `css/guidance.css`, `css/style.css`, generated `css/style.min.css`, `css/curated-catalogue.css`, `index.html`, `test/browser/motion.spec.mjs`, `.github/workflows/test.yml`, `docs/motion-design.md`, and this report. Earlier uncommitted work was preserved. No dependency was added.

## Footer density follow-up, 27/10/2026

The user's subsequent review found the footer too spacious. Navigation now flows in compact rows instead of two tall columns; the two navigation landmarks keep their accessible names and visually hidden headings. Introductory spacing, disclosure padding and section gaps are smaller. Touch targets remain 44px. The three explanations stack below 600px and share a single row from 600px upwards; tablet summaries reserve equal height to accommodate wrapping, avoiding a stranded third card. Desktop uses the available width for one navigation row and a compact legal/source area.

Visual captures cover 320, 390, 600, 768, 980, 1024, 1280, 1440 and 1920px, each in light/dark, using touch emulation through 768px. Actual screenshots were inspected at phone, tablet and desktop sizes, including the tablet correction after finding the uneven two-plus-one layout. Local evidence is `qa/2026-10-27-footer-density/`; `capture.cjs` is repeatable. The 390px touch footer measures approximately 522px high; the 1440px desktop footer approximately 258px high. Expanded content is intentionally allowed to grow.

The existing footer browser test now covers all nine widths in both themes (18 cases per engine), with a closed-height guard, keyboard disclosure checks, print state restoration, touch target bounds, page overflow and source-dialog focus return. Print, token and generated-CSS checks and `git diff --check` were rerun. Only `index.html`, `css/style.css`, generated `css/style.min.css`, the existing browser test and this report changed in this density follow-up. No commit or deployment was made.

Outcome: WebKit passed 18/18. Chromium passed 17/18 on the final matrix run; the 980px dark case hit the overall 30-second test timeout while concurrent local runs were active. That unchanged case passed when rerun alone. All 36 distinct cases therefore have passing evidence, with the initial timeout explicitly retained here. The earlier Chromium matrix also passed 18/18. No timeout or assertion was relaxed.
