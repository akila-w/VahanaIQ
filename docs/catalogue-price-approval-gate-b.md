# Catalogue Price Approval — Gate B

**Related issue:** #39. **Base:** `a13f2fa9a9cb6696bd87b656dad754d89643ab00`.

Gate B defines an **independent review contract**, not an automatic verified-price pipeline. It changes no published price, runtime UI, JSON catalogue, service worker, or photo selection. The new `scripts/catalogue-price-approval.mjs` has no file-write, network, or runtime publication functions.

## Candidate manifest contract
```json
{
  "schemaVersion": 1,
  "candidates": [{
    "offerId": "existing-curated-offer-id",
    "modelId": "owner-model-id",
    "expectedFingerprint": "sha256-of-current-offer",
    "proposed": {
      "amount": 10000000,
      "currency": "LKR",
      "kind": "official",
      "sourceStatus": "ok",
      "sourceUrl": "https://example.com/exact-offer",
      "checkedOn": "2026-10-30",
      "sourcePublishedOn": "2026-10-29",
      "evidence": "LKR 10,000,000",
      "note": ""
    }
  }]
}
```
This illustrates the **shape only**. It is not a real vehicle price or an approved source.

Required controls:
- Existing exact `offerId` and matching `modelId` — no fuzzy make/model match.
- Fingerprint of the current offer's price and identity fields — stale or altered offers blocked.
- Exactly the proposed price/evidence fields; no image, registration, specs, comparison, or user-data edits.
- Positive LKR amount or an explicit quote (no price); valid dates and HTTPS source.
- `sourceStatus: "ok"` cannot exceed the existing `offerEvidenceStatus` classifier and contradictory notes always block.
- Estimates are never silently converted into verified prices.
- Duplicate IDs, unsupported currency, future publication relative to checked date, and invalid amounts are blocked.
- Every otherwise valid proposal remains `pending-human-review`.

## Review decision contract
Each decision references the exact `offerId` and `proposalFingerprint`. A declared approval requires reviewer, review date, meaningful reason, and all five explicit attestations:
- Matching model and trim
- Matching market and condition
- Matching amount and currency
- Source page and publication date checked
- No contradictory evidence

The function `previewOfferPriceDecisions` only returns `attestation-complete-not-published`. It **cannot authenticate the reviewer or verify the truth of attestations**, and returns `canPublish: false` even when complete. Identity-backed approval and controlled publication belong to later gates.

## Build-input gap
The current catalogue generator references `docs/catalogue-rebuild/prices.json`, which is absent from tracked `main`. Before Gate D, choose a tracked canonical input and a reproducible dual-output generation process for `data/catalogue.json` and `js/catalogue-data.js`. Do not attempt to regenerate the current catalogue with missing inputs.

## Verification
`node test/catalogue-price-approval.test.mjs` runs review gating, fingerprints, disputes, currency/date/source validation, duplicate candidate rejection and non-mutation tests.

**Out of scope:** source scraping, automated approver identities, changes to finance/photography/runtime, published prices, a service-worker cache bump, and PhotoHarvest PR #38.
