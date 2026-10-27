# Onboarding and user guidance

Implementation checklist, 27/10/2026

- [x] Inspect repository, existing changes, tokens, storage, modals and test infrastructure.
- [x] Implement inline welcome, page-specific interactive tours and persistent Help Centre.
- [x] Add contextual explanations and optional progressive guidance.
- [x] Verify persistence, data isolation, keyboard access, themes, motion and mobile layouts.
- [x] Run regression suites and browser tests; inspect and refine screenshots.
- [x] Refine contextual icon alignment and replace direct Help Centre launches with quick-explanation popovers and a More details action.

Scope: the request lists welcome, tours, contextual help, a permanent Help Centre and progressive guidance. No further detailed requirements were attached. Preserve the pre-existing working tree; do not commit or deploy.

Design: use existing colours, spacing and motion tokens; native dialog semantics (already used by the catalogue) for Help Centre; a non-modal tour panel so users can operate real controls. Guidance never fills financial fields or changes saved comparisons. Store only versioned guidance preferences and tour position in a separate local key, without account sync or analytics. Help is available offline through the existing service-worker shell. Returning users receive no automatic modal or tour.

## Implemented behaviour

- Inline welcome with an optional tour or immediate dismissal. Dismissal follows the user between pages in the same browser.
- Four-step Calculator tour, three-step Catalogue tour and three-step Photo Studio tour. Each highlights a real section, offers a real control to explore, and links to a relevant explanation. Actions minimise the guide while the user works. Back, Next, Skip, Minimise, Resume, Restart and Finish are available without adding example vehicles or changing inputs.
- Tour position persists across reloads. An unfinished tour resumes only on request. A completed or skipped tour never starts automatically. Help Centre links can explicitly launch a tour on another page.
- Permanent Help Centre on the Calculator, Catalogue, Studio, About, Privacy and Terms pages. Eleven searchable explanations cover rates, deposits, affordability, comparison, prices, savings, AI, privacy, photos and offline use.
- Aligned, labelled contextual help buttons near relevant controls and headings open short non-modal popovers. More details opens the matching Help Centre article. Native popovers support outside dismissal, Escape, Close, repeated-icon toggling and focus return, and fit the visual viewport in either orientation. The native Help Centre dialog has a complete keyboard sequence, Escape, backdrop dismissal, a sticky Close button and explicit focus return (including Safari, which does not focus pointer-clicked buttons by default).
- Optional next-step suggestions on each main page; Calculator suggestions update after adding vehicles or changing inputs. They can be hidden and re-enabled in Help Centre.
- Local guidance key: `vahanaiq_guidance_v1`. Strictly bounded progress schema; malformed, unavailable and quota-limited storage fall back to in-memory behaviour. Cross-tab preference updates use the storage event. Financial values are neither copied into this key nor transmitted.
- Separate token-based stylesheet, reduced-motion support, print suppression, 44px buttons, responsive scrollable panels and safe-area offsets. Existing modals temporarily take precedence over tours.
- New resources are included in the existing service-worker shell. Relative URLs support project-path hosting. Existing asset version remains 2.12.0; no release/version change or deployment is performed.

## Files changed for this task

Created:

- `js/guidance.js` — shared UI and page integration.
- `js/guidance-content.js` — UK English explanations and tour definitions.
- `js/guidance-state.js` — isolated persistence and validation.
- `css/guidance.css` — responsive presentation using existing tokens.
- `test/guidance.test.mjs` — state, failure and isolation checks.
- `test/browser/guidance.spec.mjs` — browser journeys and accessibility/responsive assertions.
- `docs/onboarding-implementation.md` and `docs/onboarding-verification.md` — implementation scope and evidence.

Modified:

- `index.html`, `catalogue.html`, `studio.html` — load the shared guidance assets.
- `scripts/build-info-pages.mjs`, `about.html`, `privacy.html`, `terms.html` — retain generated-page parity, add Help Centre and document local guidance preferences.
- `sw.js` — cache guidance resources.
- `.github/workflows/test.yml` — run the state suite and the onboarding browser suite in the existing three-engine matrix.

All other pre-existing changes belong to the earlier work and were preserved. No dependencies were added. The screenshot capture script and PNGs live in the existing ignored `qa/2026-10-27-onboarding/` directory.

## Maintenance

Keep financial explanations aligned with the calculator and information pages when those change. Tour selectors reference static page anchors; adding or removing a page section should include updating its tour and browser checks. Guidance is deliberately independent of account sync. Changing a browser preference must not emit financial-save events or reset other storage.

Run `node test/guidance.test.mjs`. Serve the repository at `http://127.0.0.1:8123`, then run `npx playwright test test/browser/guidance.spec.mjs --browser=chromium` (or `--browser=webkit`). The CI workflow also runs Firefox.
