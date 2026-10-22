> Historical baseline. Scope was expanded on 21/10/2026 to passenger vehicles and pickups; see [the current review](review-findings.md) and [visual catalogue](catalogue-review.html). Earlier exclusions and counts below are superseded.

# Catalogue batch verification — 20/10/2026

Version: v2.8.0. Status: deployed to GitHub Pages on 20/10/2026 (PR #10 onwards). Catalogue coverage remains in progress. This page records the checks run for that first batch.

## Data and migration

- 146 entries across 27 makes, each with a stable ID, body scope, source URL, checked date and availability evidence status.
- Eight numeric published/starting amounts. Other prices remain null and cannot enter lease calculations without a valid quote.
- The frozen 12-vehicle shortlist is used only to migrate existing v2 browser data. An explicit immutable index-to-ID mapping preserves the right price edits even if the input array is reordered. The old key remains as a backup; the v3 snapshot is authoritative, including an intentionally empty comparison.
- Personal price edits and removed catalogue entries remain in saved comparisons; catalogue refreshes do not overwrite them.
- The original 12 entries' review decisions and remaining coverage work are in [catalogue-research.md](catalogue-research.md). Range listings, historical import examples and seller listings do not guarantee stock or exact specification.

## Automated verification

All six suites passed on the final code:

```sh
node test/verify.mjs
node test/qa-regressions.test.mjs
node test/catalogue.test.mjs
node test/proxy-search.test.mjs
node test/proxy-price-mode.test.mjs
node test/refresh-prices.test.mjs
```

The new catalogue suite covers migration after reordering, custom and hidden records, idempotence, empty-selection persistence, invalid prices, quote preservation, stable-ID research matching, source metadata, excluded body classes and refreshes that leave unknown prices null. Existing currency/search regressions retain 95 assertions. Syntax and whitespace checks also passed.

## Browser verification

25 checks passed against the real frontend served by `test/serve-qa-fixtures.mjs` (external AI calls are replaced only by that test server's deterministic proxy fixture):

- Legacy-origin preview retains its original comparison; a separate new guest origin starts empty.
- Catalogue count, pagination, make/model search and no-results state.
- Four distinct Nissan Magnite variants; the conflicting turbo Tekna+ price stays blank.
- Blank/zero quote rejection; valid decimal quote entry, two-place display and one-row addition.
- Reload preserves the entered quote; selected catalogue entries disable duplicate addition.
- Published price prefill and separate confirmation of a used listing's registration condition.
- Missing condition rejection; Escape returns from setup to the catalogue.
- Remove and Undo restore the same car and quoted amount.
- Keyboard focus remains inside the open catalogue; desktop/light and mobile/dark flows were exercised.
- Catalogue has no internal horizontal overflow at 375, 768 and 1440 CSS pixels. The 375px and 768px screenshots were visually inspected. This is focused catalogue QA, not completion of the later full UI-refinement milestone.

Local evidence under `qa/2026-10-20/fixes/`: `catalogue-browser-checks.json`, `catalogue-mobile.jpg`, `catalogue-tablet.jpg`. These are local review artifacts, not deployed assets. The HTTP preview approval initially failed because its review service hit a usage limit, then succeeded; browser checks were completed after recovery.

## Release boundary

This first batch and the currency presentation follow-up are proposed together after the existing QA baseline in PR #10. Further brand/trim/used-generation research, richer filters, the savings planner, account sync and final visual refinement remain separate work. No merge, production deployment or live stock verification is claimed.
