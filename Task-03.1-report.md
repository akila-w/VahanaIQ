# VahanaIQ Task 03.1 — Firefox font-metrics verification

28/10/2026 · Baseline `72f86cf9f31f1b4f1ae062a81f8ca165cfbc1890` · Branch `codex/task-03-1-font-metrics`

## Verdict and scope

**PASS WITH LIMITATIONS.** The correction addresses a demonstrated test-design defect. Final-commit CI evidence is recorded in the delivery PR's description. It does not change the deployed fonts or application. No merge, deployment, rollback or Task 04 work is authorised or performed.

The final PR description records the immutable tested head, full CI run and results. No earlier successful run substitutes for that final-commit gate. The evidence and executed checks below describe the investigation and focused verification.

## Publication-boundary correction

The previous approved head `4337508f736b3aaaa4d363318a75db4b412d3ef9` was not merged after release preflight. Existing `_config.yml` exclusions covered internal directories but not root task reports. A read-only production request returned the exact `Task-03-report.md` body, while `docs/`, `scripts/` and `test/` examples returned 404. An accessible report establishes a publication-scope mismatch; it is not evidence that secrets were exposed.

This candidate retains the complete Firefox fix and makes a separate, narrow publication correction:

- `_config.yml` adds only the quoted pattern **`Task-*-report.md`**, preserving all existing exclusions. It covers `Task-02-report.md`, `Task-03-report.md`, `Task-03.1-report.md` and future matching root Markdown reports. `.nojekyll` is neither introduced nor used.
- `scripts/smoke-deploy.mjs` checks representative known root reports plus all matching root report names found in the checkout, including their generated `.html` paths. Each must return **404**; 403, 200 and network errors do not pass. Existing positive page/asset/catalogue/image checks remain, now supplemented with exact content hashes and WOFF2 MIME checks.
- Smoke readiness requires both the application version and the root-report publication contract. A configuration-only deployment cannot pass merely because the unchanged version is already served. A local negative control with the correct version and a public report was rejected.
- `scripts/verify-publication.mjs` prepares a tracked-source fixture, adds two future report examples (plain Markdown and front-matter-bearing Markdown), and a public `.txt` near-match. It verifies **generated output**, not just the YAML text.
- `.github/workflows/test.yml` builds this fixture with the **same official Pages action and exact action commit** used by the production legacy Pages builder: `actions/jekyll-build-pages@44a6e6beabd48582f863aeeb6cb2151cc1716697`, image v1.0.13, **github-pages 232 / Jekyll 3.10.0**. No deploy step, Pages write permission or Pages artefact publication is added.

The publication job must finish first. It checks absence of all current/future report Markdown and HTML outputs and existing internal directories/files, while requiring all 76 application-shell bodies, the worker and legitimate public information (`LICENSE`, `CHANGELOG.md`, `SECURITY.md`, sitemap and robots) to remain byte-identical. The near-matching public text fixture must remain published.

It then runs the production smoke tool against the actual generated directory. Controlled HTTP mutations must be rejected: a report Markdown leak, an HTML leak, a 403 instead of 404, and stale token CSS despite an unchanged version marker. The unmodified generated site must pass. Build/output inventories, runtime hashes and each positive/negative smoke log are retained as the **publication-verification** CI artefact.

Node and browser jobs depend on this focused publication job. They use an explicit first-step result assertion under `always()`, so a failed publication build makes required jobs **fail** rather than silently satisfying required checks through skipped jobs. Repository protection rules are unchanged. Only after publication verification succeeds do all 27 Node suites and the complete 241-case browser matrix run, with the existing extra WebKit lifecycle checks. Final immutable-head job results and artefact links are recorded in PR #33's description.

### Root inventory and preserved public content

The root contains three task reports. Existing working files `README.md`, `firestore.rules`, dependency manifests/locks and optional Ruby build files remain excluded. Internal material under `docs/`, `test/`, `scripts/`, `qa/`, `serverless/`, `design-system/`, `data/batches/` and the existing vendor/working-file patterns retain their current exclusions. Public application pages, `manifest.json`, `sw.js`, `robots.txt`, `sitemap.xml`, `LICENSE`, `SECURITY.md`, `CHANGELOG.md`, icons and runtime assets are preserved. No additional public information is reclassified.

### Additional CI failure investigated

The first publication candidate (`598ddb5`) passed the real Pages build, Node, Firefox and CodeQL checks, but Chromium failed the existing older-guidance-module compatibility case. It expected the older article fallback text and received the current quick-help text instead. A focused local repetition reproduced **2 failures / 8 passes** without changing the application.

Response instrumentation in fresh disposable Chromium contexts confirmed the cause: with workers allowed, the substituted-module route was hit **zero** times, the response reported `fromServiceWorker: true`, and it contained the current `quickHelp` export. Blocking workers for this synthetic fixture produced **one** route hit, `fromServiceWorker: false`, no `quickHelp` export, and the expected older article text. The worker had raced the test fixture; the assertion was not exercising the intended older module.

Only this compatibility case now uses a worker-blocked context. It additionally requires route delivery, a non-worker response and absence of the newer export before retaining both original UI assertions. The real offline/lifecycle suites retain their worker coverage. Twenty focused Chromium repetitions pass after this correction. This verification-only change is included because the complete candidate CI exposed the defect; no application behaviour, assertion tolerance or retry policy changes.

### Runtime/cache compatibility and limitations

The correction does not alter application HTML/CSS/JS, font files, typography, financial calculations, authentication/synchronisation, catalogue data or browser storage. The cached shell and revision ledger are unchanged from production `72f86cf`: **`vahanaiq-v2.12.0-offline-3`**, fingerprint **`8e38d91748dbf346a49bec2b2359750710b6d1d4486fbca8f7a3c2730baee61b`**. No cache advance is necessary. The original Firefox test correction remains intact.

Pre-merge verification uses the official Pages builder and examines its real output, but does not deploy that output. Live-site removal and CDN propagation can only be confirmed after a separately approved release. The current deployed baseline is not represented as corrected. Full final-head CI, exact commit identity and the final verdict are recorded in the delivery PR description without adding a commit after testing.

## Confirmed cause

The old assertion compared canvas metrics for **platform fallback glyphs in separate fresh browser contexts**, treating them as if the converted font files supplied those glyphs. Linux Firefox can select different native fallback faces as its font-list/cmap state is initialised. `document.fonts.ready` and two loaded application faces did not control that platform state. The comparison therefore attributed a native fallback change to TTF versus WOFF2.

This was reproduced with **identical TTF against identical TTF**, and then **identical WOFF2 against identical WOFF2**, in fresh contexts. Reversing TTF/WOFF2 order also reproduced the discrepancy. The format is not the distinguishing variable. Neither font's cmap contains the Sinhala, Tamil or vehicle emoji characters. Manrope additionally lacks `₨`, which was mixed into its supposedly primary-font currency sample.

The concrete heavy Tamil difference is:

| Sample at 24px, weight 650 | Width | Ink ascent | Ink descent |
| --- | ---: | ---: | ---: |
| Cold native fallback result | 51.88333511352539 | 20 | 8 |
| Other native fallback result | 55.849998474121094 | 17.5 | 7 |
| Explicit `FreeSerif` control | 51.88333511352539 | 20 | 8 |
| Explicit `FreeSans` control | 55.849998474121094 | 17.5 | 7 |

Both native families are installed in the Linux environment. Firefox's native logs show their cmap initialisation around the Tamil probes. The exact metric fingerprints match the explicit family controls; the fontconfig candidate list also includes both. The standard canvas API does not expose per-glyph selected font names, so these fingerprints and native logs are distinguished from a direct per-glyph inspector result.

For Inter weight 650, the mixed `සිංහල தமிழ் 🚗` sample consequently measured **153.53334045410156 / 22.238531494140624 / 8**, versus **157.5 / 22.238531494140624 / 7** (width / ascent / descent). This reproduces the original CI failure. The isolated Sinhala and emoji probes did not account for this heavy-Tamil change. Exact samples at weights **200, 400, 650, 750 and 800** are retained in the raw measurements, including individual scripts, emoji, mixed text and explicit system-font controls.

Text exercise before measurement often makes contexts agree, but the cold-browser controls show that it is **not a universal guarantee**: one WOFF2/WOFF2 pair still differed after exercise, and a reversed shared-context pair converged only on another measurement. The repair therefore does not rely solely on a delay, retry, larger tolerance or readiness promise.

The internal Gecko font-cache implementation was not modified or traced to a specific upstream code defect. The verified root cause here is the test's uncontrolled cross-context fallback comparison, demonstrated independently of conversion format.

## Baseline and historical environment

The repository was clean on `main` at `72f86cf`, which remained the latest Pages deployment. The fetched deployed worker's SHA-256 matched the baseline. A dedicated branch was created from refreshed `main`.

Candidate **`02a2dd9f8a331f0e789459dfca76dccd05162121`** and squash **`72f86cf9f31f1b4f1ae062a81f8ca165cfbc1890`** have the identical Git tree **`d3db2512de5b68302c8fb6d246ec0b39307671ae`**. There is no application, font, test, dependency-lock or workflow-body difference between them.

| Environment | Passing candidate | Failing squash |
| --- | --- | --- |
| CI | [40693163253](https://github.com/akila-w/VahanaIQ/actions/runs/40693163253) | [40695315786](https://github.com/akila-w/VahanaIQ/actions/runs/40695315786/job/122840418893) |
| OS | Ubuntu 24.04.5 | Ubuntu 24.04.5 |
| Runner image | 20261012.334.1 | 20261025.353.1 |
| Browser | Firefox 157.0, Playwright build 1555 | Firefox 157.0, Playwright build 1555 |
| Node / Playwright | Node 22 / package-lock pinned 1.64.1 | Same |
| Relevant logged font packages | FreeFont 20211204+svn4273-2; Noto Color Emoji 2.047-0ubuntu0.24.04.1; fontconfig 2.15.0-1.1ubuntu2 | Same logged versions |
| Result | All 240 browser cases passed | 234 passed; all six font comparisons failed |

The runner image changed, but the historical runs did not retain a complete font inventory or per-glyph selection. The image change is not asserted to be causal. The original assertion also produced both passing and failing cases on a single later image. What made the earlier run pass was not captured at per-glyph level; its green result did not make an uncontrolled fallback comparison sound.

The failure artefacts were downloaded and inspected. Their font cases contain error-context assertions, rather than a trace of native fallback selection. The [environment comparison](docs/task-031-evidence/environment-comparison.json) separates recorded historical facts from newly captured inventory.

## Reproduction and isolation

Only `test/browser/fonts.spec.mjs` was run during initial Linux diagnosis, plus a purpose-built font isolation script. No complete browser matrix was rerun while investigating the assertion.

1. [First Linux diagnostic](https://github.com/akila-w/VahanaIQ/actions/runs/40697950790), Ubuntu image 20261026.354.1: original font test repeated three times, **17 failed / 1 passed**. An identical-TTF fresh-context control differed in 20 rows; after text exercise its two contexts agreed. Primary converted-glyph metrics did not change.
2. [Cold-browser diagnostic](https://github.com/akila-w/VahanaIQ/actions/runs/40698627354): a fresh Firefox process per pair, native logging, both orders, both same-format controls, shared-context navigation and simultaneous loaded format aliases. Its cold comparison counts are below. These counts include native `sans-serif` controls and composite samples, not just converted-font glyphs.

| Control | Different rows on first measurement | Converted-glyph differences |
| --- | ---: | ---: |
| TTF → TTF, fresh contexts | 18 | 0 |
| WOFF2 → WOFF2, fresh contexts | 18 | 0 |
| TTF → WOFF2, fresh contexts | 18 | 0 |
| WOFF2 → TTF, fresh contexts | 12 | 0 |
| TTF → WOFF2, shared browser context / separate documents | 20 | 0 |
| WOFF2 → TTF, shared browser context / separate documents | 19 | 0 |

The simultaneous-format document loads independent TTF/WOFF2 aliases, exercises the exact text/weights and compares both within one controlled document. This avoids assuming that two documents chose identical native fallbacks. The corrected mixed-script test enforces exact metrics **and raster pixels** in that environment.

Evidence includes [isolation summary](docs/task-031-evidence/isolation-summary.json), [readable script measurements](docs/task-031-evidence/isolated-script-metrics.json), compressed [first raw measurements](docs/task-031-evidence/diagnostic-1-measurements.json.gz) and [cold raw measurements](docs/task-031-evidence/diagnostic-2-measurements.json.gz), [native log excerpt](docs/task-031-evidence/native-font-excerpt.log), [diagnostic rendering](docs/task-031-evidence/simultaneous-script-rendering.png) and [corrected rendering](docs/task-031-evidence/corrected-mixed-script.png). Decompress raw JSON before inspecting it. Complete native logs, inventory and screenshots are retained in the linked diagnostic run artefacts and local ignored QA directory.

## Targeted correction

`test/browser/fonts.spec.mjs` retains six real-page loading cases and adds one controlled mixed-script case. Shared probe code is in `test/browser/font-metrics.mjs`.

- **Strict conversion equivalence remains:** exact width, ink ascent and ink descent for strings fully supplied by both converted fonts; Inter's `₨` remains a strict primary-font check. Intermediate weights 650 and 750 remain included.
- **Meaningful fallback checks:** individual Sinhala, Tamil and emoji samples are rendered at all five weights with the application family and compared to the **same document's generic system fallback**, with exact metrics, identical raster pixels and non-empty ink. Manrope's unsupported `₨` receives the same fallback check.
- **Mixed text remains covered:** original TTF and WOFF2 aliases coexist in one document. The complete mixed sample, including primary-font spaces, must have identical metrics and pixels at every weight, and a repeated measurement must agree.
- **Actual text is exercised:** DOM layout renders the relevant probes, all matching webfont faces are explicitly loaded, and layout frames complete before measuring. This complements the controlled comparisons; it is not treated as sufficient to freeze every independent context's native fallback cache.
- **No weakened assertions:** no numeric tolerance, skipped script, increased timeout, retry-until-pass or substituted financial/application fixture was added. Each page still requires exactly two successful local font loads, correct source-format URLs and loaded faces.
- **Six-page layout coverage:** exact geometry/family/weight comparisons cover the visible controls and headings in the source and WOFF2 variants. Application-ready signals are awaited. Closed dialogs with asynchronously populated catalogue controls are excluded from visible-page geometry, rather than comparing hidden modal contents at arbitrary times.
- JSON measurements and the mixed-script screenshot are attached to test results for inspection.

## Verification

| Check | Result |
| --- | --- |
| Focused Linux Firefox repetition | **70/70 pass**, ten repetitions of all seven cases |
| Focused Linux Chromium repetition | **21/21 pass**, three repetitions |
| Focused Linux WebKit repetition | **21/21 pass**, three repetitions |
| Local WebKit fonts | **7/7 pass** |
| Local Chromium fonts | Primary/fallback cases passed; an initial added geometry assertion included hidden asynchronous dialog contents. Visible-page correction passed the index case **three consecutive times**; final complete CI covers all seven cases |
| All 27 Node regression commands | **27/27 pass** locally |
| Existing Chromium offline/lifecycle tests | **16/16 pass** locally |
| Existing WebKit offline/lifecycle tests | **16/16 pass** locally |
| Font glyph/variation/table equivalence | Pass, both original TTF / WOFF2 pairs |
| Generated token CSS and immutable shell guard | Pass; original `offline-3` fingerprint retained |
| Complete final PR-commit CI | Final head, run URL and job outcomes recorded in the delivery PR description |

Repeated focused Linux results: [run 40699662178](https://github.com/akila-w/VahanaIQ/actions/runs/40699662178), retained [Firefox repeat log](docs/task-031-evidence/corrected-firefox-repeat.log). The visible-page geometry correction followed those repetitions; the primary/fallback/mixed comparison logic is unchanged. The complete final-head CI is required before delivery.

The existing font equivalence tool still verifies every cmap entry, glyph order, glyph coordinates and hint instructions, variation and layout tables. [Fresh equivalence results](docs/task-031-evidence/font-equivalence.json) match the prior release. Original font bytes and all cached shell bodies are unchanged, so there is **no cache revision or ledger change**. The `offline-3` combined fingerprint remains `8e38d91748dbf346a49bec2b2359750710b6d1d4486fbca8f7a3c2730baee61b`.

## Production impact and limits

No evidence identifies a WOFF2 conversion regression or a missing converted glyph. The discrepancy occurs with the original TTFs alone, with WOFF2 alone and even with a generic system-family control. It therefore does not justify a production rollback or a font-delivery change. The observed native fallback selection/metric variation can occur during first use with either format; this report does not claim that all possible platform fallback behaviour is stable or unaffected.

No production application change is proposed. Task 03's **404,352 encoded WOFF2 bytes** and its measured transfer savings remain intact because the assets and delivery configuration are byte-identical. There was no need to repeat the five-sample performance fixture for a test-only patch.

Exact per-glyph font names were not available through the standard Firefox canvas API. Explicit-family metrics, fontconfig candidates, native cmap logs and visible screenshots support the fallback attribution; an upstream Gecko internals diagnosis is not claimed. Complete old runner font inventories and historical warmup state cannot be reconstructed from the retained CI artefacts. Physical devices and every operating-system fallback configuration are outside this hotfix's validation scope.

## Files changed and reproduction

Publication correction delta from the previously approved candidate: `_config.yml`, `scripts/smoke-deploy.mjs`, new `scripts/verify-publication.mjs`, `.github/workflows/test.yml`, the single synthetic compatibility case in `test/browser/guidance.spec.mjs`, and this report. Existing Firefox fix/evidence files are preserved.

- `test/browser/fonts.spec.mjs`: separate source-font equivalence, same-document fallback controls and mixed-script checks; visible layout comparison; attachments.
- `test/browser/font-metrics.mjs`: shared samples, explicit text exercise, exact metrics and raster probes.
- `scripts/diagnose-font-metrics.mjs`: repeatable Linux Firefox format/order/context isolation and native font logging; no application dependency.
- `.github/workflows/font-diagnostics.yml`: manual, focused three-engine font verification with repeated cases and retained evidence. Temporary branch-only push diagnosis was removed before the final PR commit.
- `Task-03.1-report.md`, `docs/task-031-evidence/`: investigation and verification evidence.

To reproduce: serve the repository at `127.0.0.1:8123`, run `node scripts/diagnose-font-metrics.mjs` in Linux Firefox's Playwright environment, then run `npx playwright test test/browser/fonts.spec.mjs --browser=firefox --workers=1 --repeat-each=10`. Replace the engine for focused Chromium/WebKit verification. The retained diagnostic commits/runs reproduce the original failing assertion; the final test suite verifies the corrected contract.

No financial formula, catalogue data, storage schema, authentication flow, production CSS/HTML/JS, font asset or runtime dependency changes. No deployment, merge, rollback or Task 04 work was performed.
