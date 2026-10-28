# VahanaIQ — Modernisation Task 03

28/10/2026 · Baseline `0494ecdbb362dbd6c39cc2ee5aadbd9ae73108ad` · Branch `codex/task-03-font-delivery` · Draft [PR #32](https://github.com/akila-w/VahanaIQ/pull/32)

## Verdict

**PASS WITH LIMITATIONS.** The measured improvement, full glyph preservation, visual comparisons, offline migration and complete three-engine CI matrix pass. Limits concern the local lab fixture, unavailable original Task 01 artefacts and untested physical devices; they are detailed below. The draft PR is ready for review. Nothing has been merged or deployed.

## Baseline and font inventory

The working tree was clean before fetching and fast-forwarding `main` to the approved Task 02 release, then creating the dedicated branch. Task 02's implementation report and final production evidence were reviewed. The original Task 01 report and temporary artefacts are absent from the checkout, Git history and temporary directory. Its stated **537,786 encoded font bytes** were reproduced exactly with the supplied mobile fixture; missing Task 01 measurements were not inferred.

All six pages load `css/tokens.css?v=2.12.0`, which contains two upright variable faces. Calculator, Catalogue and Studio also preload that stylesheet, but **no page preloads a font**. CSS discovers one resource per family. Headings, wordmarks and display text use Manrope; body text, controls and financial figures use Inter. Existing non-integer weights, including 650 and 750, require variable coverage; no weights were removed. Italic text continues to use existing browser synthesis rather than a separately downloaded italic face.

| Face | CSS weights / style | Actual axes | Fallback stack |
| --- | --- | --- | --- |
| Inter | 100–900, normal | `wght` 100–900; `opsz` 14–32 | `-apple-system`, `BlinkMacSystemFont`, Segoe UI, Roboto, sans-serif |
| Manrope | 200–800, normal | `wght` 200–800 | `-apple-system`, `BlinkMacSystemFont`, Segoe UI, sans-serif |

Both use `font-display: swap`. Source declarations, styles and weights are in `design-system/tokens.json`; other stylesheets consume the family variables. There were two font requests, no duplicate font preload and no unnecessary static weight downloads to remove. The avoidable transfer was delivery of full variable TTFs instead of compressed webfont containers. Under the gzip fixture, Inter contributed **468,926 bytes** and Manrope **68,860 bytes**.

## Selected and rejected options

- **Selected: full-coverage variable WOFF2**, generated directly from the existing TTFs. This preserves all supported characters, variation, metrics, hinting, shaping and names while reducing encoded transfer by 24.8%. The existing token generator needs no modification.
- **Retained: `swap` and system fallbacks.** Early fallback text remains visible; no runtime font loader or network dependency is introduced. Browsers that cannot use WOFF2 retain the existing system stack. Original TTFs remain conversion sources, outside the application dependency graph and offline manifest.
- **Rejected: glyph subsetting and weight/optical-size instancing.** Full coverage already produces a useful measured reduction. Closed Latin-only subsets would restrict user-entered content; split Unicode ranges add files and cache cases. Instancing would remove optical sizing or intermediate weights. None is needed for this improvement.
- **No font preload added.** Existing discovery produces exactly two font loads; the returning-user LCP occurs before either version finishes loading Inter. Adding route-wide priority hints would change competition with critical CSS/modules without an established need. This task does not claim a measured preload improvement.
- **No fallback metric overrides added.** Font metrics remain equivalent, all compared text/control geometry is identical and CLS does not deteriorate. A single local system-font calibration would not establish correct metrics across the different operating-system fallbacks.
- **No TTF URL appended as another CSS source.** The supported browser engines load WOFF2, and system fallback remains available. Keeping TTF in the offline dependency graph would force the installation to retain its large transfer cost.

## Performance: five samples per case and version

`scripts/measure-fonts.mjs` serves the immutable baseline token CSS/worker and the current checkout from the same local origin. Non-font application bodies are identical. Text, SVG and TTF responses use gzip; WOFF2 and images use their native encoded bodies. The fixture uses Chromium **156.0.8078.4**, Playwright **1.64.1** ([fixture metadata](docs/task-03-evidence/fixture.json)), **390 × 844, DPR 3, CPU 4×, 1.6 Mbps down, 750 kbps up and 150 ms latency**. Variants alternate order between samples. External optional services are blocked identically. Measurements were collected without other local browser test runs.

First-use and returning-cold sessions have fresh browser contexts, empty HTTP caches and blocked service workers to isolate initial page delivery. Returning-cold seeds only the real completed-onboarding key. Installed-warm sessions install the real worker, acquire control, then navigate again. Each of the six groups has **five samples**, 30 navigations total. Local gzip and emulated transport reproduce the supplied font payload, not every GitHub Pages or physical-phone network behaviour.

Values are **median [minimum–maximum]**, milliseconds unless shown otherwise. Percentages compare medians. `font loadingdone` records the face loading/render-readiness event; it is separate from the last font response and final LCP paint.

| Metric | First-use before | First-use after | Change |
| --- | ---: | ---: | ---: |
| Encoded font bytes | 537,786 [537,786–537,786] | 404,352 [404,352–404,352] | **−24.81%** |
| Font requests | 2 [2–2] | 2 [2–2] | 0% |
| Last font response | 4,965 [4,951–5,023] | 4,298 [4,290–4,313] | −13.44% |
| Font loadingdone | 5,101 [5,094–5,168] | 4,445 [4,426–4,450] | −12.86% |
| LCP | 5,128 [5,120–5,192] | 4,472 [4,452–4,476] | −12.79% |
| CLS | .03474 [.03474–.03622] | .03474 [.03474–.03474] | 0% |
| Initial subresource transfer, bytes | 845,052 [845,052–845,052] | 711,614 [711,614–711,614] | **−15.79%** |

| Metric | Returning-cold before | Returning-cold after | Change |
| --- | ---: | ---: | ---: |
| Encoded font bytes | 537,786 [537,786–537,786] | 404,352 [404,352–404,352] | **−24.81%** |
| Font requests | 2 [2–2] | 2 [2–2] | 0% |
| Last font response | 4,966 [4,958–5,041] | 4,299 [4,290–4,304] | −13.44% |
| Font loadingdone | 5,091 [5,090–5,210] | 4,440 [4,420–4,472] | −12.79% |
| LCP | 1,384 [1,352–1,604] | 1,364 [1,356–1,408] | −1.45%; overlapping ranges |
| CLS | .03474 [.03474–.03698] | .03474 [.03474–.03622] | 0% |
| Initial subresource transfer, bytes | 845,052 [845,052–845,052] | 711,614 [711,614–711,614] | **−15.79%** |

| Metric | Installed-warm before | Installed-warm after | Change |
| --- | ---: | ---: | ---: |
| Font network bytes / requests | 0 / 0 [all samples] | 0 / 0 [all samples] | Unchanged |
| Last cached font response | 92 [89–109] | 87 [85–116] | −4.80%; overlapping ranges |
| Font loadingdone | 231 [214–257] | 231 [195–299] | −0.17%; overlapping ranges |
| LCP | 156 [144–160] | 148 [132–180] | −5.13%; overlapping ranges |
| CLS | 0 [0–0] | 0 [0–0] | Unchanged |
| Initial subresource transfer, bytes | 16,143 [16,143–16,143] | 16,143 [16,143–16,143] | 0% |

Warm resource timing still contains two logical font loads served by Cache Storage; their transfer size is zero. The remaining warm network traffic is optional identity/image assets outside the immutable shell. No warm-font speed gain is claimed. Subresource totals sum Resource Timing `transferSize`, excluding the document and worker installation; the initial document is identical. Non-font encoded body sizes are unchanged except token CSS being four encoded bytes smaller. No new initial page resource is introduced.

### LCP trace interpretation

The first sample of each cold case retains a browser trace and [extracted timeline](docs/task-03-evidence/trace-summary.json). First-use traces show an initial `p.intro` candidate, then the larger **`p.onboarding-intro` text** as final LCP. Before: Inter's `RemoteFontLoaded` event at **5,030 ms**, final candidate at **5,190 ms**. After: Inter at **4,312 ms**, candidate at **4,469 ms**. Module evaluation occurs earlier, around 2.9–3.1 seconds. The nearly equal font-to-candidate gaps support a font contribution to the earlier first-use text rendering in this fixture. They do not establish that every LCP difference is caused solely by fonts: script execution, modal scheduling and machine variation also participate.

Returning-user traces retain **`p.intro`** as LCP at roughly 1.4 seconds, before Inter completes; no meaningful returning-user LCP improvement is claimed. Fallback text is visible while the fonts load, and cold CLS remains around .035 in both versions. The optimisation reduces font delivery time; it does not remove all existing startup layout movement.

Raw [30 samples](docs/task-03-evidence/performance-samples.json), [summary](docs/task-03-evidence/performance-summary.json), and compressed [before first-use](docs/task-03-evidence/before-first-trace.json.gz), [after first-use](docs/task-03-evidence/after-first-trace.json.gz), [before returning](docs/task-03-evidence/before-returning-trace.json.gz), [after returning](docs/task-03-evidence/after-returning-trace.json.gz) traces are retained. Decompress traces before loading them into browser performance tools.

## Glyph coverage and licensing

| Family | Original TTF bytes | WOFF2 bytes | Glyphs / Unicode codepoints | Coverage retained |
| --- | ---: | ---: | ---: | --- |
| Inter | 876,576 | 350,460 | 2,933 / 2,849 | 100% |
| Manrope | 164,700 | 53,892 | 742 / 678 | 100% |

Raw combined font size falls **61.17%**, from 1,041,276 to 404,352 bytes. The smaller encoded improvement above compares against already-gzipped TTFs, avoiding an inflated performance claim.

FontTools **4.63.0**, Brotli **1.2.1** were installed only in a temporary build environment. No project dependency changed. `scripts/verify-fonts.py` compares character maps, glyph ordering, every glyph's coordinates and hint instructions, variation and other font tables with the original TTFs. WOFF2 lossless reconstruction changes container/head/loca representation; those container differences are excluded from table comparison. Both files pass. Full results: [coverage.json](docs/task-03-evidence/coverage.json). The conversion follows [FontTools' WOFF2 tooling](https://fonttools.readthedocs.io/en/stable/ttLib/woff2.html) and the [WOFF2 specification](https://www.w3.org/TR/WOFF2/).

Both source fonts include Latin extensions, Greek and Cyrillic, `£`, `€` and `₹`. Inter includes `₨`; Manrope does not. Neither source includes Sinhala or Tamil. Those scripts continue through system per-character fallback, with no glyph removed by this change. Browser font tests compare source/candidate text metrics at five weights, including intermediate weights, using currency, punctuation, accented text, Greek, Cyrillic, Sinhala, Tamil and emoji. On this Mac, an actual platform-font probe confirms **Sinhala Sangam MN** and **Tamil Sangam MN**, rather than empty glyphs: [font evidence](docs/task-03-evidence/fallback-fonts.json) and [rendering](docs/task-03-evidence/fallback-fonts.png). Availability of those scripts on other systems still depends on their installed fallback fonts, as before.

Both original **SIL OFL 1.1** licence files remain unmodified beside the assets. The original Inter Project Authors and Manrope Project Authors notices and font name tables are preserved. No font is renamed, subsetted or distributed separately from its licence. The retained TTFs and READMEs document provenance and regeneration.

## Visual, functional and accessibility regression

`scripts/compare-font-rendering.mjs` compares the baseline font declarations with the optimised declarations against otherwise identical pages. Six routes cover phone/wide light/dark, print media, reduced motion and failed-font fallback, plus first-use onboarding: **43 screenshot pairs**. Every pair has identical measured text/control geometry. **40/43 are pixel identical**; three differences are restricted to 1–3px-high navigation edge rasterisation at the top of the page, with identical geometry and no changed text. These differences were inspected rather than accepting new screenshots indiscriminately. Animations are frozen consistently for static comparison; existing browser motion tests exercise normal and reduced-motion behaviour separately.

Evidence: [all comparison results](docs/task-03-evidence/visual-results.json), Calculator phone [before](docs/task-03-evidence/index-phone-light-before.png) / [after](docs/task-03-evidence/index-phone-light-after.png), Catalogue wide dark [before](docs/task-03-evidence/catalogue-wide-dark-before.png) / [after](docs/task-03-evidence/catalogue-wide-dark-after.png). The complete captures and geometry records remain locally in `qa/2026-10-28-task03/visual/`.

Existing browser cases also exercise populated figures, gauge boundaries, table/card overflow, modal layouts, keyboard focus, narrow and wide viewports, onboarding, and light/dark states. Node print checks and print-media screenshots pass. No financial formula, price, regulatory constant, storage schema, authentication flow, markup, layout rule or font hierarchy changes.

## Offline and cache compatibility

The shell advances from **`vahanaiq-v2.12.0-offline-2`** to **`vahanaiq-v2.12.0-offline-3`**. Only the two font URLs change in the manifest. The new fingerprint **`8e38d91748dbf346a49bec2b2359750710b6d1d4486fbca8f7a3c2730baee61b`** is appended; both previous records remain unchanged. Dependency coverage and the content-fingerprint guard pass without being weakened.

The 76-entry shell decreases from **3,551,786 to 2,914,860 raw body bytes** (−17.93%). This is the measured baseline `offline-2` shell, which differs slightly from Task 02's earlier review checkpoint. The worker still installs a complete shell, bypasses the HTTP cache during installation, waits while old controlled tabs exist, activates and removes old VahanaIQ caches without touching unrelated caches, and serves immutable shell responses.

A new migration case uses the exact released Task 02 worker fixture and its matching TTF font CSS. It verifies that an open tab retains the TTF shell while WOFF2 waits, then closes the tab, observes activation, checks that only the WOFF2 font entries remain, disconnects and loads fonts on all six routes. Saved comparison, inputs, planner data and IndexedDB edits remain valid. Existing tests cover clean installation, direct entry under `/VahanaIQ/`, failed installation recovery, older legacy-worker migration, cache rollback and uploaded photo bytes across update/restart. No storage migration is introduced.

## Verification results

Implementation under test: **`9743912`**. [CI evidence](docs/task-03-evidence/ci-results.json) records the successful immutable head. Later changes to this report and `docs/task-03-evidence/` contain evidence only.

| Check | Result |
| --- | --- |
| All 27 Node regression commands from CI | **27/27 pass** locally; CI verify passes |
| Full Chromium browser run | **232/234 pass initially**; two lifecycle timing cases pass **three consecutive isolated repeats each**, without increased timeouts or application changes |
| Full WebKit browser run | **234/234 pass** |
| New six-page font checks | **6/6 pass in Chromium**, **6/6 pass in WebKit** |
| Offline installation/lifecycle | Full WebKit set passes; Chromium cases pass across full run and repeated lifecycle verification, including actual Task 02 → Task 03 font migration |
| Firefox locally | Cannot launch: “Could not find profile folder”; no local pass claimed |
| Remote Chromium / WebKit / Firefox | **240/240 pass in each engine**; WebKit lifecycle ordering also passes five repeats. [Green run 40691609506](https://github.com/akila-w/VahanaIQ/actions/runs/40691609506) |
| Token CSS generation, information-page generation | Pass |
| Offline dependency graph and immutable fingerprint | Pass |
| Published asset pruning, whitespace checks | Pass |
| Font glyph/table equivalence | Pass, both fonts |

Initial migration assertions hard-coded `offline-2`; they were updated to read the current cache revision, preserving exact-name assertions. Separate early Node runs required local-server permission for mocked HTTP tests; the final full 27-command run passes. The final local Chromium run's lifecycle timings were investigated through the six repeated cases above. No tests were skipped or relaxed.

Reproduce Node commands from `.github/workflows/test.yml`. Serve the site at `127.0.0.1:8123` for browser tests. `npx playwright test test/browser/fonts.spec.mjs test/browser/offline.spec.mjs --browser=chromium --workers=1` runs focused coverage; replace the browser for other engines. The CI workflow runs the complete suite in all three engines and repeats WebKit lifecycle ordering five times. `node scripts/build-tokens.mjs --check` and `node test/module-versions.test.mjs` check generated CSS and shell consistency. `node scripts/measure-fonts.mjs` reproduces the lab measurements; `python scripts/verify-fonts.py` requires the temporary FontTools environment described above.

## Exact files changed

| Files | Purpose |
| --- | --- |
| `assets/fonts/inter/Inter-variable.woff2`, `assets/fonts/manrope/Manrope-variable.woff2` | Full-coverage compressed fonts |
| `assets/fonts/inter/README.md`, `assets/fonts/manrope/README.md` | Source, delivery and regeneration notes |
| `design-system/tokens.json`, `css/tokens.css` | Source and generated WOFF2 declarations |
| `sw.js`, `test/fixtures/offline-shell-revisions.json` | New font manifest, cache revision and appended fingerprint |
| `test/fixtures/task02-sw-offline2.js` | Exact released Task 02 worker for migration coverage |
| `test/browser/offline-server.mjs`, `test/browser/offline.spec.mjs` | WOFF2 MIME, prior-font fixture, migration evidence, current revision assertions |
| `test/browser/fonts.spec.mjs`, `.github/workflows/test.yml` | Six-page request/metrics coverage in every CI browser |
| `scripts/verify-fonts.py`, `scripts/measure-fonts.mjs`, `scripts/compare-font-rendering.mjs` | Build-time coverage and repeatable lab/visual checks |
| `Task-03-report.md`, `docs/task-03-evidence/*` | Report, samples, traces and selected visual evidence |

## Limits and Task 04 recommendation

This is a local lab result, not a production deployment or field Core Web Vitals claim. Physical phones, assistive-technology sessions and unsupported legacy browsers were not tested. Cold delivery deliberately isolates page traffic from first-install worker downloads; shell size and actual installation are assessed separately. No authenticated external service operation was needed for this font-only change. The original Task 01 report is unavailable; only its supplied fixture and font payload were reproduced.

Recommended Task 04: profile initial module/catalogue delivery and first-use modal scheduling using the retained traces. Returning-cold LCP already occurs before custom fonts finish, so further font tuning should not be assumed to improve it. Task 04 has not begun. No merge or deployment has been performed.
