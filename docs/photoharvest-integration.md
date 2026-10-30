# PhotoHarvest → VahanaIQ: Phase 1 (local review bundles)

This integration is **curator-only** and **does not publish photos**. PhotoHarvest remains an independent private repository: https://github.com/akila-w/PhotoHarvest.

## Compatibility boundary

PhotoHarvest currently downloads accepted images into `~/Downloads/PhotoHarvest_…/`. It does **not** write an image-by-image source URL manifest, and its output is **not** the `manifestVersion: 1` export accepted by `scripts/apply-studio-photos.mjs`. Therefore, do **not** feed the review manifest directly to the publishing script or label images as manufacturer-approved.

The importer in this PR operates on **local files only**: no browser automation, URL fetching, uploads, or edits to `data/catalogue.json`, `js/catalogue-data.js`, Photo Studio IndexedDB, or public image assets. The `--source-page` argument records the page you *intended* PhotoHarvest to visit, **not** proof that each image originated there. For each candidate, the actual image URL remains `null`, rights and model association remain unverified.

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

If the dry run shows suitable candidates, repeat without `--dry-run`. By default a new, timestamped review bundle is created in `~/Downloads/VahanaIQ-PhotoHarvest-review/`; use `--output-dir` to pick a **new** directory outside the repository.

## Review bundle format

- `review-manifest.json` — `schemaVersion: 1`, `kind: "vahanaiq-photoharvest-review"`, exact catalogue ID and name, crawl seed, and all candidates marked `pending`
- `images/<sha256-prefix>.<ext>` — copied, verified image bytes (not re-encoded or published)
- Candidate metadata: original file name, pixel size, byte length, SHA-256, 64-bit dHash, possible visual duplicate, missing original image URL, and unverified model/rights status
- `skipped` — rejected candidate names and reasons

Constraints: regular raster files only; symlinks are skipped; raster magic/decoding and pixel size are verified by Pillow; default minimum resolution is 1000×700; default file maximum 12 MiB, maximum 80 candidate images, and 40 million decoded pixels. SHA-256 identifies exact duplicates and dHash provides *possible* near-duplicate hints only. No candidate is auto-approved or auto-published. The scanner does not inspect filenames for correct model attribution; a curator must verify actual vehicle generation and trim.

## Review-to-publication procedure (future milestone)

1. Inspect every candidate, reject irrelevant or duplicated imagery.
2. Verify and record the individual original URL and page, model/trim accuracy, permission/licensing, and attribution.
3. Import only approved **image files** into the existing Photo Studio using its Upload control (or implement an explicit audited import UI in Phase 2).
4. Frame in 8:5 and export from Photo Studio.
5. Review the export, run `node scripts/apply-studio-photos.mjs <export.json> --dry-run` against an isolated checkout, and only later consider publication through the regular review process.

**Important:** the current Photo Studio treats added files as owner uploads, not manufacturer originals. Do not publish downloaded third-party content through that route until its provenance and rights-handling semantics have been implemented and verified.

## Known limitations / next engineering tasks

PhotoHarvest has no per-image provenance, robust SSRF protection or total download budget. Do not expose it as a network service. Before implementing a direct bridge, extend PhotoHarvest to emit source URL, final URL, page URL, redirects and acquisition timestamp, and apply rate/size/access constraints at every request. This phase intentionally does not modify PhotoHarvest itself, change the calculator, or add an external scraping endpoint.
