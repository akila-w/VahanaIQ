# Catalogue Pricing Parity — Read-Only Audit

**Task:** #39 · **Baseline:** `2782a6ec85048c414a3796a1420679a2d1fe2f66` · **Date:** 30 October 2026

## Verdict: Architectural gap confirmed — no runtime modification approved

The monthly refresh job (`.github/workflows/refresh-prices.yml`) runs `scripts/scan-prices.mjs` followed by `scripts/refresh-prices.mjs`, and writes `js/market-catalogue.js`. Both `index.html` and `catalogue.html` load `js/catalogue-data.js` (generated from `data/catalogue.json`) first. The calculator's `getUnifiedCatalogue()` reads that baked curated catalogue when present, using market data only as fallback/enrichment. A successful monthly market-file refresh therefore does **not** automatically refresh prices displayed on either page.

## Grounded inventory

| Property | Curated `data/catalogue.json` | Market `js/market-catalogue.js` |
| --- | ---: | ---: |
| Vehicle models / records | 227 models | 277 records |
| Offer rows | 303 | 277 |
| Numeric positive prices | Most curated offers, with varying source status | 166 |
| Identifiers | Stable offer ID | Market entry ID |
| Verification field | `sourceStatus` + `evidence` | `priceVerification` + `priceBasis` |
| Refresh authority today | `docs/catalogue-rebuild/prices.json` via builder | Monthly refresh workflow |

**Exact-ID join** (`market.id === curatedOffer.id`): 181 matching entries. Among those, 76 have positive prices in both datasets, with zero amount differences at this baseline; 105 have `null` market price but a positive curated price. Thus, a numeric difference-only test would miss the main discrepancy: availability and source-evidence semantics.

**Non-matching identifiers:** 96 market records have no exact curated offer ID; 122 curated offers have no market ID. At make/model level, all 227 curated models appear in market records, but 29 curated models have multiple market variants. Do **not** use a same-name or make/model-only join to update an offer.

**Verification:** Current market records include 153 with historical `priceVerification: "confirmed"`, whereas curated evidence uses stricter excerpt/status checks established in #36. The two labels are **not equivalent**. The #36 price-evidence CI flags 190 of 303 curated offers for manual review. Neither the 153 market labels nor the remaining curated offers should be treated as independently audited seller quotes.

## Key compatibility boundaries

1. **One offer-level price key:** Match stable curated offer IDs first; unmatched or ambiguous entries go to review. Preserve model, variant, year, gearbox, route, fuel, currency and condition when vetting candidate changes.
2. **Separate evidence from price:** A plausible amount or historic `confirmed` label cannot establish source authenticity. Require approved source evidence, contradiction detection, freshness checks and explicit human acceptance.
3. **Do not bypass canonical inputs:** `scripts/build-curated-catalogue.py` consumes `docs/catalogue-rebuild/prices.json`, generates `data/catalogue.json`, and bakes `js/catalogue-data.js`. Editing only one published output risks drift or a future overwrite.
4. **Keep fallback compatible:** `js/market-catalogue.js` contains specifications and legacy variants; it cannot be deleted merely because the curated gallery is loaded. Separate specification enrichment from canonical price provenance.
5. **Preserve user records:** `vahanaiq_comparison_v3` and catalogue-selected cars must retain stable IDs, financing class, condition, registration date, quote provenance and user-entered values.
6. **Isolate PhotoHarvest:** Draft PR #38 changes Photo Studio, its import workflow, and offline/service-worker files. Task 02 should not touch those files until integration is reviewed.
7. **Offline and CI:** Any runtime file change requires a fresh immutable offline-shell revision fingerprint, followed by Node, Chromium, Firefox, WebKit, Pages deployment and live smoke validation.

## Suggested implementation sequence

**A — Inventory tests (no changes to runtime):** Add a deterministic parity analyzer reading both datasets, printing a machine-readable diff and explicit review queues; fail only on structural regressions, not current known discrepancies.

**B — Canonical approval model:** Model offer price candidates and evidence in a non-published staging format; approval gate before curated price promotion; unmatched/ambiguous entries blocked by default.

**C — Deterministic publish pipeline:** Update curated canonical inputs, regenerate the published JSON/JS together and validate exact parity. Market data remains a compatibility projection or fallback until all consumers migrate.

**D — Release gates:** Regression fixtures for multiple-trim variants, null-versus-positive mismatches, disputed Audi sources, illustrative finance and saved comparisons, plus three-engine browser/production smoke checks.

## Explicit non-goals

- No price rewriting, source scraping, source-status promotion or network-derived claims.
- No changes to `main`, existing user records, vehicle photographs, service worker or PhotoHarvest PR #38.
- No automatic merge/deployment from this report.

**Outcome:** Audit-only baseline and risk register for #39. Implementation must be a separate scoped PR with tested acceptance criteria.
