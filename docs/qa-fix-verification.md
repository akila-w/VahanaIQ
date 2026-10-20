# v2.7.1 QA fix verification — 20/10/2026

The five functional defects from the live v2.7.0 QA pass are addressed:

| Defect | Changed behaviour | Verification |
| --- | --- | --- |
| Decimal amounts inflated by 100× | Currency retains up to two decimal places, rejects ambiguous strings, and preserves fractional values through saving, sharing and inline editing | Parser/input regressions and browser checks with `250,000.00`, `20,000.50` and `10,000,000.50` |
| Batch-add created free vehicles | All entry paths require a finite positive price; a whole batch is checked before any row is added. Missing condition prices are labelled unavailable. Invalid saved entries are excluded with a notice; invalid base overrides restore the catalogue entry | Valid, zero-price and mixed-price batches; single add rejection; reload; storage migration regressions |
| Comparative search omitted a model | Comparisons require distinct valid results. Incomplete comparisons show a recovery message instead of a single-model form. Proxy schemas require explicit discovery fields and prompts require every requested model | Incomplete-result rejection; two-model checklist; select-all/none; empty selection; adding only checked rows; Back returns to search |
| Zero maximum price meant unlimited | Zero is a valid zero limit; blank input is unlimited | Browser: zero yields no catalogue rows |
| Stale budget legend after reset | The legend's hidden state takes precedence over its flex layout | Browser: reset produces a zero-height hidden legend |

Additional corrections retain sortable header labels and table layout in print, including mobile layouts; print colours no longer inherit the dark theme. Search status is announced through a live region, duplicate submissions are prevented, and a high-demand upstream error is retried once on the same model. Quota failures are not retried; each request attempt has a 30-second timeout. Photo loading does not hold up the search control, and an old photo response cannot replace a newer result's photo.

## Automated verification

- `node test/verify.mjs`: all ten existing verification groups pass.
- `node test/qa-regressions.test.mjs`: 81 assertions pass.
- `node test/proxy-search.test.mjs`: Cloud Run and Cloudflare request/schema/error tests pass with Gemini stubbed.
- `node test/proxy-price-mode.test.mjs`: existing price-mode tests pass.
- `node test/refresh-prices.test.mjs`: existing price-refresh tests pass, including its loopback mock-server integration checks.
- The earlier eight-group QA reproduction script now passes, including both decimal-input checks.
- The new `Verify VahanaIQ` workflow runs the five maintained suites on pull requests and pushes to main, without external AI calls.

## Browser verification

The actual frontend was served by `test/serve-qa-fixtures.mjs` with a local deterministic proxy. Checks covered decimal parsing and persistence, malformed amounts, filter/reset states, valid/invalid AI batches, two-model comparison selection, unavailable-market alternatives, transient retry recovery, manual fractional prices, inline editing and reload, plus a 375 px dark-theme comparison and desktop layout.

The print CSS was applied as screen styles through the fixture server's `?qa-print` view. All six sortable header labels remain visible. This verifies the CSS cascade and table layout; physical printing and pagination are still outside this check.

## Release boundary

This is a source/local verification, not a claim that production already runs v2.7.1. Merging publishes the frontend through GitHub Pages. Redeploy the Cloud Run proxy from `serverless/gcp-cloud-function` to use its stronger comparison prompt and required discovery fields. The frontend also rejects incomplete comparisons against the existing proxy. Upstream model availability remains an external dependency.
## Currency presentation follow-up — 20/10/2026

The user requested two decimal places for all prices and currency amounts. The shared currency formatter now retains cents and pads whole amounts with `.00`; summaries, table cells, AI prices and print use it. Money inputs are formatted on initialisation, restoration and blur while preserving unfinished decimals during typing. The maximum-price filter also displays two decimal places. Calculations retain full precision.

All five maintained automated suites pass; `qa-regressions.test.mjs` now has 95 assertions. Local browser checks confirmed `250000.5` becomes `250,000.50`, the maximum-price filter becomes `12.50`, both restore after the existing autosave completes and the page reloads, and every rendered currency table cell has two decimal places. Browser screenshot: `qa/2026-10-20/fixes/currency-two-decimals.jpg`. No production deployment is claimed for this follow-up.
