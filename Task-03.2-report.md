# Task 03.2 — WebKit onboarding investigation

Prepared 29/10/2026. Production baseline: `02f8b335ace5bf219c2c9b0e1e653e89c2a5675c`. Branch: `codex/task-03-2-webkit-onboarding`. This is an investigation and draft release candidate; no merge or deployment is authorised. Final immutable-head CI results accompany the draft PR and the local QA closeout report, after this report's commit.

## Confirmed cause and correction

Automatic scroll anchoring in the animated, dynamically rebuilt `.onboarding-body` causes sustained one-pixel scroll oscillation in Linux WebKit. The smallest effective correction is `overflow-anchor: none` on that scrollport. Existing animations, containment, dimensions, focus handling and application JavaScript are preserved. The original `test/browser/onboarding.spec.mjs`, including `scrollIntoViewIfNeeded()`, viewport, real-click, shortlist and finance assertions, is byte-identical to the production baseline.

This conclusion rests on measured geometry and a same-runner intervention/reversal, rather than the timeout message. In a preserved failure, the same button (observer ID 4) alternated between y=390.046875 and 391.046875 while its scrollport alternated scrollTop=368/369. This continued for 27,274 ms across 150 samples. The last result/tray mutation was at 2,876 ms; the image was already complete at 2,905 ms with naturalWidth=640. The button remained enabled and its centre hit the button in every sample. The scrollport and dialog geometry were otherwise constant. The finite entrance animation had finished; only the step indicator's box-shadow pulse remained. No JavaScript scrolling loop was found. Two further failures retained the same one-pixel pattern for 7,394 ms and 15,415 ms. See [measurements](docs/task032-evidence/scroll-oscillation.json) and compressed raw observations.

The fractional scrollport height (490.5 CSS px, clientHeight 491) is recorded, but is not claimed as the sole cause: an integer-size experiment still failed. The exact upstream WebKit rounding implementation has not been established.

### Decisive controlled experiment

[Run 40802130909](https://github.com/akila-w/VahanaIQ/actions/runs/40802130909), commit `f26892e7be21d34c628ea0de94d01d9acad84adc`, used the same Linux runner, original strict journeys, two workers and actual stylesheet/service-worker delivery:

| Condition | Passed | Failed |
| --- | ---: | ---: |
| Original stylesheet | 26/30 | 4 |
| Only scoped `overflow-anchor: none` appended | 30/30 | 0 |
| Original stylesheet restored | 12/15 | 3 |

Raw logs are retained as `same-runner-{original,anchor-none,reversal}.log` in [evidence](docs/task032-evidence/). Diagnostic stages deliberately continued after failures so the reversal could run; their green aggregate workflow status must not be substituted for these raw outcomes. Artefact 12867210929 has ZIP SHA-256 `5749989619d61ac68e564c0aa193020c740e1e869352aae60e400c2bd6b7b6f7`.

## Original evidence and environment

Original logs, failure screenshots, error contexts and Playwright traces were preserved before tests were modified. The local manifest `qa/2026-10-28-task032/original-evidence-manifest.json` hashes 18 original evidence files. Original evidence remains in that QA directory, including `evidence/post-merge-webkit` and `evidence/earlier-webkit`.

| Run / job | Result | Runner image |
| --- | --- | --- |
| [40741747089 / 123005211684](https://github.com/akila-w/VahanaIQ/actions/runs/40741747089/job/123005211684) | 240 passed, 1 failed; Catalogue `selectCars()` stability timeout | 20261025.353.1 |
| [40708293077 / 122886550017](https://github.com/akila-w/VahanaIQ/actions/runs/40708293077/job/122886550017) | 239 passed, 2 failed; draft reload and Catalogue setup | 20261012.334.1 |

Both used Ubuntu 24.04, Playwright 1.64.1 and WebKit 27.2/build 2370. Focused diagnosis used Ubuntu 24.04.5, image 20261026.354.1, the same pinned Playwright/browser build, 1280×720 default viewport and normal motion. Service workers were allowed except in explicitly controlled stylesheet-routing or held-image fixtures. Image-version changes are documented, not asserted causal. The standard browser matrix uses two workers; diagnosis also exercised one effective worker and long-lived processes. A failure in the first long-lived Catalogue case rules out prolonged browser age as necessary.

## Other experiments and rejected approaches

[experiments.json](docs/task032-evidence/experiments.json) records exact counts, commits and limitations. No complete browser matrix was run during diagnosis.

| Experiment | Result | Interpretation |
| --- | --- | --- |
| Original strict interaction, two workers | 16 passed / 2 failed | Reproduced |
| Original interaction, one worker; reduced motion | 12/12 each | Finite passing samples, not proof of a fix |
| Long-lived explicit interaction | 47 passed / 1 failed | Reproduced without concurrency |
| Normal click auto-scroll, initial sample | 48/48 | Promising but insufficient |
| Normal click only, stronger original-journey repetitions | 23 passed / 7 failed | Rejected and reverted |
| Native wheel; DOM scroll; actual font/image/finite-animation readiness | 24/24 each | Diagnostic controls only |
| Routed CSS baseline and anchoring disabled | 24/24 each | Baseline did not reproduce; inconclusive |
| Integer-size scrollport | 23 passed / 1 failed | Rejected |
| Native focus before typing, original anchoring | 0/24 | Focus alone is insufficient |

An initial click experiment incorrectly required viewport visibility before allowing click auto-scroll; its 18 failures are explicitly invalid and excluded from causal rates. A malformed workflow YAML run executed no tests. Neither is counted as an application finding. No failed application run was blindly retried until green.

## Actual-user relevance

The oscillation is a real rendered scroll-position defect, observed after DOM/image/entrance settling; the automated stability requirement makes its impact particularly visible. A user could see jitter or have a moving selection target. The recordings also show the button remained hit-testable, so they do not establish that every manual click would fail. Native wheel and pointer journeys completed in the diagnostic controls. No physical Safari/iPhone user incidence, field failure rate or saved-data loss is claimed. Linux Playwright WebKit coverage does not replace physical-device validation.

The fix removes automatic scroll compensation only within this modal body. Explicit user scrolling and keyboard/pointer selection remain available. All entrance and reduced-motion behaviour is retained. The original strict tests remain meaningful regression protection.

## Focused verification of the actual correction

[Run 40803532166](https://github.com/akila-w/VahanaIQ/actions/runs/40803532166), head `389499e4a493cca225fc4a14389f03c0cd24b4de`, passed every stage:

| Engine | Original affected journeys | Interaction variants | Exact offline-3 migration | Total |
| --- | ---: | ---: | ---: | ---: |
| WebKit | 30/30 | 12/12 | 1/1 | 43/43 |
| Chromium | 9/9 | 12/12 | 1/1 | 22/22 |
| Firefox | 9/9 | 12/12 | 1/1 | 22/22 |

The three original tests cover Catalogue, Studio and draft reload. Variants cover both entry points with saved comparison and insurance/fees/DTI, pointer at 1280×720, native keyboard at 390×844, pointer with held images at 1440×844, and normal/reduced motion. Held-image fixtures block workers to prevent cache bypass, assert incomplete images, then release and decode them. Both selected cars and the existing saved car must reach the calculator; saved finance inputs are checked.

The corrected raw observation ends with scrollTop=369 and button y=391.046875 across the final samples at 5,906, 6,149 and 6,375 ms, with anchoring `none`, image complete, and the target hit-testable. [after-fix-selection.jpeg](docs/task032-evidence/after-fix-selection.jpeg) is an unedited native trace frame showing both selections; its provenance is recorded separately. `native-click-*` evidence belongs to the rejected click-only control, not the accepted correction.

No arbitrary UI sleeps, timeout increases, retries, forced clicks, synthetic click dispatch or skipped assertions were introduced. Diagnostic observer code is opt-in and is not shipped. The final manual diagnostic workflow fails when a verification stage fails.

### Reproduce

With the pinned package lock and Playwright Linux system libraries installed, serve the repository on 127.0.0.1:8123, then run:

```sh
npx playwright test test/browser/onboarding.spec.mjs --browser=webkit --grep 'setup from catalogue|setup from studio|draft survives reload' --repeat-each=10 --workers=2 --reporter=line
```

The manual `Focused onboarding stability verification` workflow additionally stages the opt-in diagnostics from `test/diagnostics/` into ignored QA output. `current` validates the fix. Its `baseline-auto` control restores automatic anchoring via CSS routing (workers blocked); that routed control is useful but is less representative than the actual-file A/B/reversal above. The original run commits and logs permit inspection of that stronger experiment without mutating this candidate.

## Runtime, cache and publication compatibility

The sole application change is three CSS lines (comment plus property). `sw.js` changes only its immutable cache name to `vahanaiq-v2.12.0-offline-4`; the 76-file shell and application version 2.12.0 remain unchanged. The ledger appends fingerprint `1c002bb8a3f6959f3f6cf65a0818e9cfd3810e01dcf792425ec3304783473f2e` and preserves all three previous records.

The new migration regression uses byte-exact deployed offline-3 worker and old CSS fixtures. It verifies that an existing controlled tab still receives the old CSS while the complete new cache waits; after the last old tab closes, a fresh offline tab receives the new CSS. Both cache and fetched CSS hashes are asserted. Existing saved comparison, finance, planner and photo data survive, without forced worker activation or storage/schema changes. This passed in all three engines.

[runtime-integrity.json](docs/task032-evidence/runtime-integrity.json) records exact baseline/candidate hashes. Inter/Manrope WOFF2 and `css/tokens.css` are byte-identical; the fonts remain 404,352 bytes in total, retaining Task 03's 24.81% delivery saving. Financial calculations, catalogue data, authentication, synchronisation and application JavaScript are unchanged. Real user profiles/data were not used.

The existing actual GitHub Pages/Jekyll verification is retained. Root `Task-*-report.md`, `docs/`, `test/`, QA and workflow files remain excluded. The full candidate gate must confirm the new root report and diagnostic evidence do not appear in publishing output, together with the existing future-report and smoke negative controls. No publication configuration or deployment workflow changes are proposed.

## Exact change inventory

| File | Purpose |
| --- | --- |
| `css/experience.css` | Scoped scroll-anchoring correction |
| `sw.js` | Immutable offline-4 name only |
| `test/fixtures/offline-shell-revisions.json` | Append offline-4 fingerprint |
| `test/browser/offline-server.mjs` | Serve exact deployed old CSS/worker in migration fixture |
| `test/browser/offline.spec.mjs` | Atomic offline-3→4 CSS/data regression |
| `test/fixtures/task031-sw-offline3.js` | Byte-exact deployed worker |
| `test/fixtures/task031-experience.css.gz` | Deterministically compressed deployed CSS |
| `test/diagnostics/onboarding-observer.mjs` | Geometry, mutation, image, animation, focus and trusted-event evidence |
| `test/diagnostics/onboarding-stability.mjs` | Opt-in controlled native journeys |
| `test/diagnostics/playwright.config.mjs` | Explicit discovery for staged ignored diagnostic specs |
| `.github/workflows/onboarding-stability.yml` | Manual focused verification; no deployment |
| `Task-03.2-report.md` | This excluded investigation report |
| `docs/task032-evidence/*` | Raw selected logs/observations, screenshots, experiment and integrity records; exact names/digests in `manifest.json` |

## Final delivery gate and limitations

The focused gate above is complete. The final report/evidence commit must receive successful publication verification, all 27 Node suites, all 242 browser tests per engine (241 existing plus the new migration test), five additional WebKit lifecycle repetitions, and CodeQL. These results are not claimed in advance: the final PR description and local `qa/2026-10-28-task032/Final-report.md` record the exact candidate SHA, check identities/results and final verdict after completion. This avoids changing the candidate after its CI run merely to insert its own hash.

Remaining limitations are physical Safari/iOS coverage, finite repetition samples, no quantified production user incidence, and no attribution to a particular upstream WebKit source defect. CI artefacts expire after their retention period; selected raw measurements/logs/screenshots and hashes are preserved here. The draft candidate does not repair the already-deployed baseline until separately reviewed and authorised. No merge, deployment, rollback, protection change or Task 04 work is included.
