# Catalogue Price Research — Gate C (dry-run only)

**Tracking:** #39. **Depends on:** Gate B (#41), merged as `342d3917`.

This adds a read-only CLI and a pure staging function. It performs **no web research**, URL fetching, user-data access, pricing-file writes, approval decisions, or publication. The monthly workflow and legacy `js/market-catalogue.js` stay unchanged. Gate D is required before any controlled canonical publication.

## Invocation

Prepare an external JSON research manifest yourself after independent source review:

```sh
node scripts/stage-catalogue-price-research.mjs \
  --from-file /path/to/curated-offer-research.json \
  --format markdown > /path/to/price-review.md

node scripts/stage-catalogue-price-research.mjs \
  --from-file /path/to/curated-offer-research.json \
  --format json > /path/to/price-review.json
```

The CLI reads `data/catalogue.json` by default and writes **only to stdout**. The shell redirection above writes a report outside the repository. `--catalogue` and `--as-of YYYY-MM-DD` are supported for fixtures. Never substitute the legacy scan or price-research JSON directly: its IDs can be ambiguous or unmatched in the curated offer inventory, and it carries different verification semantics.

## Research manifest schema

```json
{
  "schemaVersion": 1,
  "researchedBy": "Human researcher (unverified declaration)",
  "entries": [{
    "offerId": "exact-existing-curated-offer-id",
    "modelId": "exact-owning-curated-model-id",
    "expectedFingerprint": "current-Gate-B-offer-and-model-sha256",
    "proposed": {
      "amount": 11000000,
      "currency": "LKR",
      "kind": "dealer",
      "sourceStatus": "ok",
      "sourceUrl": "https://example.invalid/price",
      "checkedOn": "2026-10-29",
      "sourcePublishedOn": "2026-10-28",
      "evidence": "LKR 11,000,000",
      "note": ""
    },
    "observed": {
      "make": "Example",
      "model": "E1",
      "trim": "Premium",
      "year": 2026,
      "condition": "New",
      "route": "Distributor",
      "market": "Sri Lanka",
      "sourceTitle": "Example price list",
      "sourceUrl": "https://example.invalid/price",
      "sourceExcerpt": "LKR 11,000,000",
      "sourcePublishedOn": "2026-10-28",
      "checkedOn": "2026-10-29",
      "conflicts": []
    }
  }]
}
```

The example is deliberately fictional: **it is not approved evidence or a real vehicle price**. Compute `expectedFingerprint` by importing `fingerprintCurrentOffer(offer, model)` from `scripts/catalogue-price-approval.mjs`. Use exact IDs from the curated catalogue. The observer's identity claims must match the owning model and offer exactly; the validator does not interpret fuzzy names, infer aliases or authenticate the researcher.

## Fail-closed checks

- Gate B exact offer ID/owner and stale fingerprint checks; all repeated offer IDs are blocked.
- Strict proposed fields, positive LKR price (or explicit quote), source/status consistency, and HTTPS URL.
- Exact observed model, trim, year, condition, route, and Sri Lankan market.
- Source title/excerpt/URL and publication/check date consistency with the proposed price.
- Maximum source age: **183 days**, maximum last check age: **31 days** (inclusive), computed relative to `--as-of`/current UTC date. Missing, future-dated or conflicting evidence is blocked.
- Any explicitly listed contradictory research sources block the candidate, as does a change exceeding **25%** from an existing positive price.
- Classifier upgrades from estimated/unverified/disputed to `ok` are flagged for **independent human review**, never treated as approval.

Every otherwise acceptable entry is `pending-human-review`, and the entire result permanently has `canPublish: false`. The automatic evidence classifier checks for numeric/source consistency, not whether the page actually supports the exact vehicle and context. Human reviewers must independently inspect each underlying source and complete a separate Gate B attestation, including matching currency, model, trim, year, condition, route, market and absence of contradiction. Neither the report nor the declared researcher provides an authenticated or signed approval.

## Tests and release boundaries

`node test/catalogue-price-research.test.mjs` covers valid and blocked paths, stale fingerprints, duplicates, source conflicts, identities, price bounds, date freshness, deterministic output, and read-only CLI execution. It is part of required CI.

No change is made to `data/catalogue.json`, `js/catalogue-data.js`, `js/market-catalogue.js`, `docs/catalogue-rebuild/prices.json`, images, finance, saved comparisons, service workers, scheduled workflows or PhotoHarvest PR #38. The missing tracked canonical builder input must be resolved separately in Gate D.
