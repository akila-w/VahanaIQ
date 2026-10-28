# Task 02 — Firefox onboarding rate investigation

28/10/2026 · PR #31 · initial blocked revision `5950f33`

## Cause and evidence

The deferred animation-frame callback in `render()` focused the next-step button unconditionally. If the user focused the new rate field before that callback ran, the callback could take focus away between selection and keyboard input. Linux Firefox then left the number field at its default 16. This was an entry/focus defect; the calculator did not replace a correctly received 12 with 16.

The original failed job was [122699673886](https://github.com/akila-w/VahanaIQ/actions/runs/40653733214/job/122699673886). It retained the failed assertion (expected `12`, received `16`) but no trace or screenshot artefact. Its exact historical event ordering cannot be reconstructed retrospectively.

A focused diagnostic on Ubuntu 24.04 with Node 22 and the locked Playwright/Firefox version captured DOM values, live `terms.rate`, persisted drafts, focus calls, input events, completion payloads and calculator value writes. Twenty ordinary repetitions passed on the PR and twenty passed on `main`; repetition alone did not establish the cause.

[Controlled diagnostic run 40658027363](https://github.com/akila-w/VahanaIQ/actions/runs/40658027363/job/122713745416) then delivered the pending step-focus callback between the selection and text-entry phases used by Playwright for a number fill. It reproduced the exact 16% outcome in Linux Firefox on both the PR and baseline `a0bf238`. Both positive `12` assertions failed. Traces and screenshots are retained in the `onboarding-rate-diagnostic` artefact for seven days.

| Checkpoint | PR controlled case | Main controlled case |
| --- | --- | --- |
| After attempted text entry | Field / live terms / draft: `16`; focus on Continue | Same |
| After leaving the field | Terms / draft: `16` | Same |
| Before completion | Terms / draft: `16` | Same |
| Completion event | `terms.rate: "16"` | Same |
| After calculator listener | Calculator: `16` | Same |

Successful ordinary traces showed `12` in the field, live terms and draft after fill, `12` in the completion payload and calculator immediately after its listener, and `12` after storage settled and the page reloaded. This distinguishes the entry race from calculations, persistence restoration or service-worker migration. The relevant onboarding implementation was unchanged between the main baseline and Task 02 before this fix.

## Targeted repair

The callback now preserves focus when the user has already focused a control inside the onboarding body. It retains its existing default button focus when no such user focus exists. There is no change to formulas, defaults, data schemas, pricing, module URLs or import order.

Because `onboarding.js` is cached, the worker cache advances to `vahanaiq-v2.12.0-offline-2`. The new content fingerprint is appended to `test/fixtures/offline-shell-revisions.json`; the previous record is preserved. Migration assertions now name the new revision.

The original browser test retains its normal `fill('12')` and all original assertions. It additionally verifies the field, persisted draft after each step, completion event, immediate calculator application, durable input state and exact value after reload. It waits for the application's debounced durable state, rather than sleeping before reload.

A regression case delivers the deferred callback after the field is selected and asserts that focus remains on that field before entering `12`. This assertion detects the defect in every browser, including Chromium, whose insertion behaviour can otherwise conceal a lost-focus problem. Both scenarios retain `reviewed-rate-state.json`, a screenshot and failure traces. The temporary source/prototype instrumentation was removed from the final implementation.

## Files changed by the repair

- `js/onboarding.js`: preserve an already-focused control in the deferred callback.
- `sw.js`: advance the immutable cache revision.
- `test/browser/onboarding.spec.mjs`: retain the original scenario, add the focus-order regression, checkpoints and exact post-reload assertions.
- `test/browser/offline.spec.mjs`: update current-cache expectations.
- `test/fixtures/offline-shell-revisions.json`: append the new shell fingerprint.
- `.github/workflows/onboarding-rate.yml`: required repeated Linux Firefox verification with artefacts.
- `.github/workflows/test.yml`: retain evidence when a full browser job fails.
- `Task-02-report.md` and this report: link the investigation and current cache policy.

Temporary diagnostic workflow/source instrumentation existed only in investigation commits and is absent from the final application and test tree.

## Verification and reproduction

The dedicated Linux Firefox job runs both scenarios once with complete traces and then repeats each scenario twenty times with two workers. Every assertion is required to pass; there are no skips, expected failures, increased assertion timeouts or `continue-on-error` in the final verification job.

```sh
npx playwright test test/browser/onboarding.spec.mjs --browser=firefox \
  --grep 'guided setup requires|deferred step focus' --repeat-each=20 --workers=2
```

The final revision also requires the complete Verify VahanaIQ workflow: all 27 Node suites, all onboarding and offline cases in Chromium/WebKit/Firefox, and the existing CI checks. Exact final-commit statuses and links are maintained in [PR #31](https://github.com/akila-w/VahanaIQ/pull/31) after that run completes. The report alone is not a substitute for a successful final run.

## Limits

Linux CI supplies the Firefox evidence because the installed macOS Firefox cannot launch. No physical device, authenticated cloud action, merge or deployment was performed. The historical failing job has no retained trace; the causal proof is the controlled Linux reproduction on both unchanged implementations and its regression verification after repair. Diagnostic artefacts expire after seven days; this report preserves the observed state chain and run references.
