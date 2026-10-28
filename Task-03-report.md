# VahanaIQ — Modernisation Task 03

28/10/2026 · Baseline `0494ecdbb362dbd6c39cc2ee5aadbd9ae73108ad` · Branch `codex/task-03-font-delivery`

## Review checkpoint

Verification is in progress. This draft is not a release recommendation. No merge or deployment is authorised.

The implementation delivers the same Inter and Manrope variable fonts as full-coverage WOFF2 files. The first matched cold mobile sample reproduces Task 01's **537,786 encoded font bytes**, versus **404,352 bytes** for WOFF2 (**24.8% less**). Repeated measurements and final browser results will be added before delivery.

## Implementation and coverage

`design-system/tokens.json` remains the source of truth. The existing generator writes the two changed declarations to `css/tokens.css`; no generator change is required. Family names, CSS weight ranges, styles, `font-display: swap`, fallback stacks, typography and layout rules remain unchanged. No preloads or third-party font service are introduced. TTF files remain as reproducible conversion sources, but are no longer page dependencies or part of the offline shell.

Conversion uses FontTools 4.63.0 and Brotli 1.2.1 in a temporary build environment, with no project dependency change. `scripts/verify-fonts.py` checks character maps, every glyph's coordinates and hint instructions, variation and other font tables against the original TTF files. The WOFF2 lossless container reconstruction accounts for head/loca changes. Source licences, notices and font names remain intact.

| Family | TTF bytes | WOFF2 bytes | Glyphs / Unicode codepoints | Preserved axes |
| --- | ---: | ---: | ---: | --- |
| Inter | 876,576 | 350,460 | 2,933 / 2,849 | weight 100–900; optical size 14–32 |
| Manrope | 164,700 | 53,892 | 742 / 678 | weight 200–800 |

Neither source font covers Sinhala or Tamil; those scripts continue through system per-character fallback. Inter includes the rupee sign `₨`; Manrope does not and retains its existing fallback. Both include `£`, `€` and `₹`. No source glyph is removed.

## Offline compatibility

Cache revision advances from `vahanaiq-v2.12.0-offline-2` to `vahanaiq-v2.12.0-offline-3`. Only the two font URLs change in the manifest. The new content fingerprint is appended to the immutable ledger; both earlier records are preserved. The fingerprint and dependency guards remain intact. Existing waiting/activation rules continue to keep old tabs on their old complete shell. No storage schema or application logic changes.

A dedicated test uses the exact released Task 02 worker with its TTF manifest and corresponding font CSS, upgrades to WOFF2, then checks offline font loading across all six pages and preservation of comparison, inputs, planner and IndexedDB data. Existing installation, failure recovery, legacy migration, restart and rollback cases remain required.

## Verification evidence so far

- All 27 Node regression commands pass.
- Generated token CSS, generated information pages, offline fingerprint and published-thumbnail checks pass.
- 43 baseline/candidate screenshot pairs: identical measured text/control geometry; 40 exact pixel matches, three with differences limited to 1–3px navigation edge rasterisation.
- Font table/glyph equivalence checks pass for both files.
- Full local browser suites, repeated lab measurements and CI results are pending.

The original Task 01 report and its temporary artefacts are absent from this checkout/history and temporary directory. Task 02's report and final release evidence were reviewed. Task 01's stated font payload and mobile fixture are reproduced directly rather than assuming its missing measurements.
