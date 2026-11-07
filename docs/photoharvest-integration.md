# PhotoHarvest → VahanaIQ: Phase 1 (local review bundles)

This integration is **curator-only** and **does not publish photos**. PhotoHarvest remains an independent private repository: https://github.com/akila-w/PhotoHarvest.

## Compatibility boundary

PhotoHarvest draft PR #1 now writes `photoharvest-manifest.json` alongside downloads. VahanaIQ validates that acquisition manifest and still produces a **different**, curator-only review manifest. Neither is the `manifestVersion: 1` Photo Studio export accepted by `scripts/apply-studio-photos.mjs`. Therefore, do **not** feed the review manifest directly to the publishing script or label images as manufacturer-approved.

The importer in this PR operates on **local files only**: no browser automation, URL fetching, uploads, or edits to `data/catalogue.json`, `js/catalogue-data.js`, Photo Studio IndexedDB, or public image assets. By default the importer requires a **completed PhotoHarvest v1 acquisition manifest**. It checks the recorded filenames, SHA-256, bytes, dimensions, source fields and seed. Per-image source URLs are retained as observations—not as proof of ownership, manufacturer origin or licensing. All images remain pending.

## Local setup

Use an isolated Python virtual environment rather than modifying system Python:

```sh
cd /Users/Shared/vahanaiq
python3 -m venv .venv-photoharvest
.venv-photoharvest/bin/python -m pip install Pillow
```

The importer needs Python **3.10+** and Pillow. Keep PhotoHarvest installed separately according to its README. Do not commit the virtual environment or downloaded images. For an example catalogue ID `audi-a3`, first run the PhotoHarvest CLI on a permitted source page; the command below illustrates the resulting *local* import, not automatic crawling:

```sh
.venv-photoharvest/bin/python scripts/import-photoharvest.py \
  --model-id audi-a3 \
  --input-dir "$HOME/Downloads/PhotoHarvest_example.com_audi_a3" \
  --source-page https://example.com/audi-a3 \
  --dry-run
```

The optional `--source-page` must match PhotoHarvest's recorded seed; omit it to use that seed directly. Historical exports lacking `photoharvest-manifest.json` require BOTH `--legacy-without-manifest` and `--source-page`; the resulting review has no per-image attribution. Interrupted harvests are rejected unless `--allow-incomplete` is passed explicitly. If the dry run shows suitable candidates, repeat without `--dry-run`. By default a new, timestamped review bundle is created in `~/Downloads/VahanaIQ-PhotoHarvest-review/`; use `--output-dir` to pick a **new** directory outside the repository.

## Review bundle format

- `review-manifest.json` — `schemaVersion: 1`, `kind: "vahanaiq-photoharvest-review"`, exact catalogue ID and name, crawl seed, and all candidates marked `pending`
- `images/<sha256-prefix>.<ext>` — copied, verified image bytes (not re-encoded or published)
- Candidate metadata: original file name, pixel size, byte length, SHA-256, 64-bit dHash, possible visual duplicate, observed page/requested/final image URLs, acquisition time and delivery method, and unverified model/rights status
- `skipped` — rejected candidate names and reasons

Constraints: regular raster files only; symlinks are skipped; raster magic/decoding and pixel size are verified by Pillow; default minimum resolution is 1000×700; default file maximum 12 MiB, maximum 80 candidate images, and 40 million decoded pixels. SHA-256 identifies exact duplicates and dHash provides *possible* near-duplicate hints only. No candidate is auto-approved or auto-published. The scanner does not inspect filenames for correct model attribution; a curator must verify actual vehicle generation and trim.

## Photo Studio review-folder inspection (implemented in the draft PR)

Open the updated `studio.html` in a browser with folder selection support, choose the same catalogue model used for import, then select **Inspect PhotoHarvest Review Folder** and pick the newly generated review-bundle folder. The client reads `review-manifest.json` and locally hashes every listed file before showing the candidate filename, pixel dimensions, source page, requested image URL and pending status.

**This is inspection, not catalogue import or approval.** Browser-based inspection does not add files to IndexedDB, mark a candidate approved or allow Photo Studio publication. This is intentional: a folder's recorded source URL does not grant permission to republish an image, and the existing Photo Studio would otherwise misclassify third-party images as `owner-upload`.

Support depends on browser `webkitdirectory` and `crypto.subtle` (HTTPS or localhost). Firefox and Safari require manual compatibility checks. No automatic live URL requests are made by this feature. A separate, explicit rights-cleared curation/export process still needs engineering and legal/rights verification before a complete production publication workflow can be claimed.

## Review-to-publication procedure (future milestone)

1. Inspect every candidate, reject irrelevant or duplicated imagery.
2. Verify and record the individual original URL and page, model/trim accuracy, permission/licensing, and attribution.
3. Import only approved **image files** into the existing Photo Studio using its Upload control (or implement an explicit audited import UI in Phase 2).
4. Frame in 8:5 and export from Photo Studio.
5. Review the export, run `node scripts/apply-studio-photos.mjs <export.json> --dry-run` against an isolated checkout, and only later consider publication through the regular review process.

**Important:** the current Photo Studio treats added files as owner uploads, not manufacturer originals. Do not publish downloaded third-party content through that route until its provenance and rights-handling semantics have been implemented and verified.

## Known limitations / next engineering tasks

PhotoHarvest's per-image provenance is implemented in draft PR #1, not yet merged into `main`. The importer and its validation are in VahanaIQ draft PR #38. Both must be reviewed and verified together before real-image end-to-end testing. PhotoHarvest still lacks robust SSRF protection, explicit robots enforcement and a total download budget; do not expose it as a network service. Acquisition records may contain null URLs where no browser response URL exists, and manual licensing review remains mandatory. This phase intentionally does not modify PhotoHarvest itself, change the calculator, or add an external scraping endpoint.

## Synthetic end-to-end browser verification (Milestone 3)

`test/browser/photoharvest-review.spec.mjs` generates a valid deterministic PNG without downloading third-party photographs, writes an acquisition manifest compatible with PhotoHarvest PR #1, invokes the actual Python `scripts/import-photoharvest.py`, then chooses the resulting local folder through the real Studio folder input in Playwright.

Coverage: SHA-256 verification and preview image decoding, source attribution display, unchanged filmstrip and IndexedDB, disabled export when no owner edits exist, refusal of altered image bytes, wrong catalogue model, incomplete acquisition and path traversal. Repeat on both the root and GitHub Pages `/VahanaIQ/` mount.

CI runs the fixture suite against **Chromium, Firefox and WebKit** using isolated local HTTP origins, blocked service workers for this test and aborted external HTTPS; no crawling or deployment happens. Full site-wide CI is a separate release gate.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install 'Pillow>=10,<13'
npm ci
npx playwright install chromium firefox webkit
# Ensure the importer gets Pillow through PATH or activate the venv first:
source .venv/bin/activate
npx playwright test test/browser/photoharvest-review.spec.mjs --browser=chromium --workers=1
```

Automated browser tests simulate directory selection, not the physical macOS Finder folder picker. Before release, perform a manual Mac check of the chosen review directory in Safari and Firefox; verify browser focus, keyboard access, PNG decoding and temporary object-URL cleanup.

