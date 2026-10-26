# VahanaIQ — Release Readiness

**Date:** 26/10/2026 · **Candidate:** v2.12.0, the uncommitted working tree on `4402dc3`, on the local branch `feature/v2.12.0-release` · **Live site:** v2.11.6
**Nothing has been committed, pushed, merged, tagged or deployed.**

## Recommendation: conditional GO

The candidate is ready to release **as v2.12.0** once one condition is met.

1. ~~Version bump~~ **Done (26/10/2026, uncommitted).** `APP_VERSION`, every `?v=`, the service-worker cache and the version-pinning tests are 2.12.0. The three assets that loaded without a version now load with `?v=2.12.0`. All suites were rerun on the bumped build (below).
2. **Firefox not yet verified.** The CI workflow now runs both browser specs in Firefox, but that run needs a push. Firefox must not be counted as passing until the CI job is green.

Also recommended before or straight after release: a short pass on a real iPhone of the five iOS fixes (checklist items 3, 7, 9, 14 and 16 in [iphone-qa-checklist.md](iphone-qa-checklist.md)).

## Evidence

| Check | Result | Where |
|---|---|---|
| 24 Node suites, as CI runs them, on the 2.12.0 build | **24 passed** (one assertion in `test/catalogue-studio.test.mjs` now expects the versioned studio stylesheet) | `node test/*.mjs` |
| `prune-thumbnails`, `build-info-pages`, `build-tokens` `--check` | **All pass** | `scripts/` |
| Browser specs (`csp.spec.mjs` 5 + `ui-responsive.spec.mjs` 40), on the 2.12.0 build | **45/45 in Chromium, 45/45 in WebKit** | Playwright 1.64.1 |
| The four new regression tests run against untouched v2.11.6 | **All four fail there**, so they detect the bugs they cover | WebKit |
| Layout audit: 6 pages × 12 viewports × Light/Dark | **144 states in each engine: 0 wider than the screen, 0 page or console errors, max CLS 0.027** | [QA §2](uiux-qa-results.md) |
| Every displayed figure, 24 vehicles × 8 term scenarios, against the live v2.11.6 site | **0 differences** in Chromium and in WebKit, before and after the version bump | [QA §3](uiux-qa-results.md) |
| Hands-on iOS Safari (iOS 27 Simulator, iPhone 18 Pro) | 5 real iOS defects found and fixed; all flows tried pass | [iphone-qa-checklist.md](iphone-qa-checklist.md) |
| Firefox 157 | **Not verified.** Will not start on this Mac; runs in CI after a push | `.github/workflows/test.yml` |
| Real iPhone or Android device | **Not done** | — |

## Version: 2.12.0

A minor release. It adds user-facing features (section switcher, head-to-head matrix, motion system, iPhone keyboard guard) and fixes layout and accessibility defects. It changes no calculation, CBSL rule, rounding, number format, stored data or URL, so nothing breaks for existing users. A patch (2.11.7) would understate the change; nothing justifies a major version.

## What is in the candidate

45 changed files and 7 new ones (1,451 lines added, 172 removed in tracked files; most of the changed files are the version bump):

- **Styles**: `css/style.css`, `css/curated-catalogue.css`, `css/catalogue-studio.css`, plus `design-system/tokens.json` and the generated `css/tokens.css`.
- **Markup**: `index.html`, plus `scripts/build-info-pages.mjs` and the three information pages it generates.
- **Scripts**: `js/app.js`, `js/page-transitions.js`, `js/catalogue-studio.js`, `js/curated-catalogue.js`.
- **Version 2.12.0**: `js/config.js`, `sw.js`, the `?v=` queries in every HTML page and `js/*.js` import, and the tests that pin the version.
- **Tests and CI**: `test/browser/ui-responsive.spec.mjs` (new), `test/browser/csp.spec.mjs`, `test/catalogue-studio.test.mjs`, `.github/workflows/test.yml`.
- **Docs**: `README.md`, `CHANGELOG.md`, `docs/brand-guide.md`, and new `docs/uiux-audit.md`, `uiux-improvements.md`, `uiux-qa-results.md`, `motion-design.md`, `iphone-qa-checklist.md` and this file.

Nothing under `serverless/`, `firestore.rules`, `js/calculator.js`, `js/constants.js` or the catalogue data changed. The Content Security Policy is unchanged on every page.

## Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Stale assets after deploy. GitHub Pages sends `Cache-Control: max-age=600` (checked on the live site). | Low / low | Resolved by the bump: every local script and stylesheet now carries `?v=2.12.0`, so a new release always requests new files. The HTML itself can still be up to 10 minutes old, which is normal for Pages. |
| The keyboard guard is a workaround for Safari behaviour. It acts only when a text field or menu has focus, the visible area has just changed, and the field is out of sight. Then it scrolls the field to the middle. Pinch-zooming away from a focused field would also bring it back. | Low / low | Verified on iOS 27 in the Simulator and by a simulated resize in Chromium and WebKit. A real-device check is item 3 of the checklist. |
| Firefox-only layout differences | Low / medium | CI runs Firefox once pushed; hold the merge until it is green. |
| Calculator lab LCP +150–180ms on throttled slow 4G (about 6 KB more gzipped CSS) | Certain / low | Still about 1.4s in the lab. Splitting rarely used rules out of `style.css` is a follow-up. |
| Laptop table rows 12–20% taller (every column now visible) | Certain / low | Accepted trade-off. |
| Untested on a real device | — / medium | Use the checklist on an iPhone after deploy; revert if a P0 appears. |

## Release procedure (each step needs your approval)

1. ~~Bump the version~~ and ~~rerun the suites~~: done. The CHANGELOG entry is dated `[2.12.0] - 26/10/2026`; change the date if the release goes out on another day.
2. Review the diff (`git diff`), then commit on `feature/v2.12.0-release`.
3. Push the branch (not `main`) and open a pull request, so CI runs the Node suites and the browser job in Chromium, WebKit and **Firefox**.
4. Merge only when all three browser jobs are green. GitHub Pages then deploys `main`.
5. After deploy, run `node scripts/smoke-deploy.mjs` (`.github/workflows/smoke-deploy.yml` also runs it on push to `main`). Open the live site in a private tab on an iPhone and work through the checklist.

**Rollback:** revert the merge commit on `main` and let Pages redeploy v2.11.6. The service worker is network-first and deletes caches whose name differs from its own, so visitors get the restored files on their next load. No stored data or URL format changed, so a rollback needs no data migration.
