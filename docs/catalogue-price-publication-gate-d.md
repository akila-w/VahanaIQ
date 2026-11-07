# VahanaIQ catalogue publication — Gate D (signed patch preparation)

Tracking: issue #39. Source: merged Gate C squash f40123c6. This PR does not modify any published prices.

## Canonical input and provenance

The tracked data/catalogue.json is the single authoritative catalogue price/offer snapshot.
The tracked data/identity.json remains authoritative for manufacturer/model identity marks.
js/catalogue-data.js must be deterministically generated from these two snapshots, then
included with data/catalogue.json in the SAME reviewed, CI-gated Git commit.

Do not use scripts/build-curated-catalogue.py for price publication: it requires
untracked, gitignored docs/catalogue-rebuild/seed.json, selections.json and prices.json,
and also rebuilds imagery. Do not fabricate those missing inputs. The existing model
and offer IDs, fuel, trims, order and all selected images must remain unchanged.

## Independent human approval must be authenticated

Gate B attestation previews alone are unverified reviewer declarations. Gate D therefore
requires a separate Ed25519-signed authorisation bound to the exact canonical catalogue,
identity assets, complete Gate C research batch, individual Gate B approvals and offer IDs.

The PUBLIC approval registry at config/catalogue-publication-approvers.json is deliberately
empty in this PR. Until a real reviewer's public key is independently verified and
onboarded via a separate, approved PR, ALL publication preparations fail closed.
Never put an Ed25519 private key in this repository or a PR. Test keys exist only in
the in-memory regression fixtures. The reviewer must be independent of the researcher.

An authorisation JSON envelope has exactly these fields:

    {
      "schemaVersion": 1,
      "keyId": "independently-onboarded-public-key-ID",
      "payload": {
        "schemaVersion": 1,
        "purpose": "vahanaiq-manual-price-publication",
        "reviewerId": "independent approved reviewer",
        "reviewedOn": "2026-10-30",
        "catalogueDigest": "sha256-of-canonical-json",
        "identityDigest": "sha256-of-canonical-json",
        "researchDigest": "sha256-of-canonical-json",
        "reviewDigest": "sha256-of-canonical-json",
        "offerIds": ["exact-offer-ID"],
        "allowSourceStatusPromotionIds": []
      },
      "signature": "base64-Ed25519-signature"
    }

Each digest is computed using digestValue(value) from
scripts/prepare-catalogue-publication.mjs; this uses sorted-object-key canonical JSON
and preserves arrays. The signature covers the UTF-8 bytes of canonicalJSON(payload)
with NO newline. offerIds must be sorted and must name EVERY research candidate,
not an arbitrary subset. allowSourceStatusPromotionIds must be a sorted subset of
offerIds. Any upgrade from unverified/estimated/disputed to sourceStatus ok
REQUIRES an explicit ID here and the signature of the trusted human approver.
The reviewer string/date in every Gate B decision must match the signed reviewer.

The signing key belongs only to the independently approved human reviewer; the
key ID and public key, explicitly enabled, must be pinned in the repo's trust file.
Never allow a CLI-supplied replacement trust file or let an AI researcher sign for
the approving reviewer.

## Safe invocation

Run from the repository root with externally prepared and independently inspected
research, review and signed authorisation files:

    node scripts/prepare-catalogue-publication.mjs \
      --research /outside/research.json \
      --reviews /outside/review.json \
      --authorisation /outside/approval.json

The default prints an inspectable summary and SHA-256 content digests, with ZERO writes.

To prepare a proposed two-file patch, explicitly add --emit. This writes only into
a NEW OS temporary directory, never into the checkout or live production site:

    node scripts/prepare-catalogue-publication.mjs \
      --research /outside/research.json \
      --reviews /outside/review.json \
      --authorisation /outside/approval.json \
      --emit

After validation, copy the generated catalogue.json and catalogue-data.js into
a NEW isolated publication branch and inspect both as a single Git diff.
Obtain approval on the protected publication PR and run the full CI, including
catalogue parity, Node, all browsers, offline, finance and saved-comparison checks.
Only a separately authorised squash merge can deploy the two files as one Git tree.

## Fail-closed invariants

- Non-empty and entirely valid Gate C staging: exact existing offer ID/model owner,
  fingerprints, source evidence, checked and published dates, price delta, condition,
  market, trim and no contradictions. No legacy model-name matching.
- All entries must have independent complete, nonduplicated Gate B attestations.
- One enabled, PINNED Ed25519 reviewer key must validate the signed envelope.
- The signature binds the entire catalogue, identity, research, review, exact offer
  selection and explicit verified-status promotion allowlist. Stale inputs fail.
- Only nine price/evidence fields of existing offers may change. Models/offer IDs,
  variant data, all photography, fuel, order and identity marks stay untouched.
- No changes to the legacy market fallback, monthly refresh, service worker, UI,
  saved user comparisons, finance or PhotoHarvest PR #38.
- The CLI never writes to the source checkout or to GitHub. Its return value has
  canPublish: false even with a valid signature; protected Git review is separate.

## Tests and release limitations

Run: node test/catalogue-publication.test.mjs
It exercises valid ephemeral signature fixtures, invalid and disabled keys, stale
fingerprints, duplicate/rejected approvals, missing promotion authorisation, price
limits, immutable photography and parity between the generated JSON and JS.

Before using this for real prices, manually onboard a human review key and increase
main-branch rules from zero required approving reviews to at least one INDEPENDENT
approval. This security governance work is not silently performed by this PR.

Gate D is only publication preparation: this PR adds no new prices and cannot
auto-merge or auto-publish. Gate E will verify a future controlled publication.
