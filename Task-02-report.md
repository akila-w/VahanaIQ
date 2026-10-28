# VahanaIQ — Modernisation Task 02

28/10/2026 · Baseline `a0bf238` · Branch `codex/task-02-offline-loading`

## Repair and root cause

The first-install cache omitted six statically imported modules: `canvas-utils.js`, `market-catalogue.js`, `official-photo-data.js`, `bulk-selection.js`, `savings.js` and `planner-store.js`. A first online visit could download these without adding them to the worker cache. Offline navigation before a controlled online reload therefore broke the application import graph. Calculator alone registered the worker.

The repair keeps the native modules and their existing URLs/order. `sw.js` now precaches the complete dependency graph, including the three lazy modules (`date-picker.js`, `identity-data.js`, `gemini.js`), JSON fallback/export data, fonts and small interface assets. Registration lives in the existing shared `boot.js`, so direct Calculator, Catalogue, Studio and information-page visits all install it. Secure loopback is supported alongside HTTPS. Resolving the worker from the boot script preserves `/VahanaIQ/` scope.

The explicit manifest contains **76 distinct files, 3,551,587 raw bytes**. Root navigation maps to the cached `index.html`; the two existing favicon URLs share one entry. Source and minified main CSS are both required: the information pages use the source stylesheet. Vehicle photographs, external services and review artefacts are never added to the cache.

## Cache lifecycle and compatibility

- Cache `vahanaiq-v2.12.0-offline-1` separates the worker revision from the unchanged application version. **Every subsequent shell change must use a new cache revision**, including changes to unversioned HTML/JSON, registration code and catalogue data. Deploy worker and shell files together.
- Installation fetches the whole shell with HTTP-cache bypass and commits it through `addAll`. A failed installation deletes its candidate cache and leaves the active worker usable.
- Cached shell responses are immutable for that worker. There is no background per-file refresh or unrestricted runtime caching. Controlled repeat visits make no JS/CSS network requests.
- Updates wait while old controlled tabs exist. A reload can retain the old version; close all tabs for this application and reopen to activate the waiting version. Activation removes previous VahanaIQ caches and claims clients. This avoids replacing dependencies beneath an open page.
- Page paths and navigation query strings resolve to their own HTML. Unknown routes receive no Calculator fallback. JavaScript query versions remain exact.
- No localStorage key/schema, IndexedDB database/version/store, formula, price, regulatory constant, CSP, HTML, stylesheet or print rule changed. IndexedDB photo bytes were verified through update, offline reload and browser restart. Optional online search, sign-in and cloud sync still require connectivity.

## Files changed

| Files | Purpose |
| --- | --- |
| `sw.js` | Complete manifest, immutable shell, independent cache revision, safe waiting/cleanup, exact page routing |
| `js/boot.js`, `js/app.js` | Move registration into the common bootstrap without altering application imports |
| `test/module-versions.test.mjs` | Walk imports from all six pages, including lazy imports and CSS assets; reject missing dependencies, duplicate bodies and missing files |
| `test/browser/offline.spec.mjs`, `test/browser/offline-server.mjs` | Thirteen deterministic first-install, direct-route, storage, lifecycle, failure and restart cases |
| `test/browser/independent-qa.spec.mjs` | Block workers in synthetic-data tests so Playwright catalogue substitutions reach the page |
| `.github/workflows/test.yml` | Include offline coverage in Chromium/WebKit/Firefox CI |
| `Task-02-report.md` | Completion evidence and operating constraints |

## Before and after evidence

The supplied Task 01 report and `/private/tmp/vahanaiq-task01/offline.json` were reviewed. Before editing the worker, the new isolated Chromium test installed the baseline worker from a blank page, disconnected, then navigated to Calculator. It failed with **exactly the six module requests listed above**. The installer had never loaded an application module, preventing HTTP/runtime cache warming from hiding the defect.

After repair, the same test loads Calculator offline with zero failed mandatory JS/CSS requests and zero page exceptions. The dependency guard checks 49 page/module/CSS/asset URLs reachable from Calculator, 29 from Catalogue, 28 from Studio and 11 from each information page, all against exact cache URLs.

The browser coverage also verifies:

- Each of the three entry pages installs independently at `/` and `/VahanaIQ/`, then all three pages and the directory root load offline with the correct title and working controls.
- Empty-storage onboarding completes offline and produces a two-car comparison.
- A saved LKR 7,269,515.40 comparison retains its values, displays **110.1% DTI** and **LKR 22,317.18** monthly shortfall, then recalculates to **0.0% DTI** at 100% down payment offline.
- Planner data and IndexedDB frame edits survive reload, update and rollback. A persistent browser profile additionally retains an uploaded PNG byte-for-byte through update, offline reload and browser restart.
- Controlled A → B → A cache transitions keep every executed application module on the expected revision; old tabs retain A until closed; obsolete caches are removed. A candidate with a missing `savings.js` fails installation while A and its saved data remain usable.
- Uncached catalogue photos show the existing image-unavailable fallback while core controls continue working. No image catalogue appears in the cache.

## Test results

| Verification | Result |
| --- | --- |
| Existing Node suites from CI | **27/27 passed**; final dependency guard also rerun after cache deduplication |
| Chromium offline suite | **13/13 passed** |
| WebKit offline suite | **13/13 passed** |
| Existing Chromium browser suite | **213 cases passed across initial run and focused reruns**: initial 204/213, then eight synthetic-data checks passed after worker isolation, and one page-load timeout passed on rerun |
| Existing WebKit browser suite | **213/213 passed** |
| Firefox locally | **Unverified**: browser launch exits with “Could not find profile folder” before opening a test page; no Firefox pass claimed |
| CSP, figures, navigation, print | Existing CSP/browser figure checks and Node print suite passed; offline direct-route cases record zero CSP violations |
| Whitespace check | `git diff --check` passed |

Reproduce offline coverage with `npx playwright test test/browser/offline.spec.mjs --browser=chromium --workers=1` (replace the browser with `webkit` or `firefox`). It starts isolated local origins automatically; it needs no external server or live account. The existing browser specs use the server on port 8123 as configured in CI. All 27 Node commands and the complete browser command remain in `.github/workflows/test.yml`.

Local logs are in `/tmp/vahanaiq-task02/` and `/tmp/task02-*.log`; temporary evidence may be cleared by macOS. The baseline failure log is `/tmp/task02-before.log`. Final offline logs are `/tmp/task02-final-chromium.log` and `/tmp/task02-final-webkit.log`. No dependency was installed.

## Limits and next task

Offline readiness requires successful installation and retained browser storage; eviction or an interrupted first installation requires an online visit. Optional uncached vehicle photos remain unavailable offline, including published Studio source images; uploaded local photo data is retained. No physical device, authenticated cloud operation, production deployment or production-origin migration was tested. Lifecycle tests use controlled served variants of this repaired worker; they do not certify an atomic hosting deployment or every transition from a previously deployed legacy worker. Firefox requires CI on a supported runner.

Recommended Task 03: measure and optimise font delivery using the Task 01 mobile fixture, preserving the intended family, glyphs, layout and print output. No Task 03 implementation was started. This branch is for review; do not merge or deploy without Akila's approval.


## Final release-readiness review — 28/10/2026

Review in progress; final CI evidence will be added after the focused safeguards reach the PR.

- The deployed `https://akila-w.github.io/VahanaIQ/sw.js` was fetched and matched baseline `a0bf238` exactly: SHA-256 `f9e2b29fd07b3febd96c2edd6bf05e37b1a02c73e09c4a6d8ea5aad0bf9c9a09`. `test/fixtures/legacy-sw-v2.12.0.js` preserves those bytes. The test server reconstructs the baseline boot/app sources, verified against their Git versions before adding test-only markers.
- Initial PR CI on `e58fbac`: Node verification and Chromium passed. Firefox passed all 213 existing cases but failed the thirteen new offline cases with `NS_ERROR_OFFLINE` during navigation. Its worker had installed, acquired control and passed readiness checks before disruption. Linux Firefox failures are distinct from the local Mac launch restriction.
- Two added migration tests passed in Chromium and WebKit. They exercise warmed legacy dependencies, two live tabs, stale JS/image cache entries, an unrelated cache, localStorage comparison/input/planner data and IndexedDB frame edits. The new worker waits until both controlled tabs close, removes only VahanaIQ caches and loads all mandatory modules offline. A legacy first-install cache missing `savings.js` also survives a failed candidate and migrates on retry.
- Firefox now uses an actual origin socket outage in the offline harness, with external HTTPS blocked and HTTP caching disabled. A separate four-case diagnostic compares explicit offline emulation and origin outage, both with and without request interception; explicit-mode errors are recorded as diagnostic outcomes, not reported as successful offline coverage. Origin-outage controls must pass, including an uncached network probe that must fail. The CI result is required before drawing a Firefox release conclusion.
- Cache revision `vahanaiq-v2.12.0-offline-1` remains unchanged because no worker or cached asset changed during review. `test/fixtures/offline-shell-revisions.json` now pins SHA-256 `e95d487ffe2f916f4edad8b01bf6d4da22da3e4bec3669e62f0f1bca06503259` across the worker, every manifest URL and every cached file body. A future shell change must bump `CACHE` and add a new fingerprint entry; released entries must never be overwritten. The version guard now checks content as well as graph coverage.

The migration guarantee applies after the new worker finishes installation and activates. While old tabs remain open, the legacy worker retains its existing background-refresh behaviour; it cannot be retroactively made immutable. This repair changes only registration in the cached application JS, so the overlap remains compatible. An offline legacy client that has not downloaded the new worker still needs connectivity once to receive the repair. Closing all application tabs is needed for a waiting update; refreshing one tab is insufficient. Broader rollback to the legacy worker would restore its immediate-activation/incomplete-cache behaviour and is not recommended as an offline-safe rollback. Forward recovery under a new revision is preferred.
