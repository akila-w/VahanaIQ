# Design migration plan — main site to the catalogue design language

**Prepared:** 22 October 2026
**Review document:** [`docs/design-review.html`](design-review.html) — open it in a browser for the side-by-side mock-ups.
**Status:** awaiting sign-off. Nothing in the site has been changed.

---

## 1. The problem

`catalogue.html` was built with a warm, editorial design language (bone page, forest-green ink, display
type with tight tracking, hairline rules). `index.html` — the lease calculator — still uses the older
slate-and-teal application style from the original design system. The two pages read as different products.

## 2. The target language, in six rules

1. **Warm bone ground** — page background `#f5f6f3`, cards pure white.
2. **Forest-green ink** — text `#142a25`, muted text sage `#586b62`, never neutral grey.
3. **Two greens only** — `#103e36` for structure, `#168265` for interaction and focus.
4. **Display type, tight tracking** — h1 `clamp(42px, 5.6vw, 78px)` / 650 / −3.5px; body stays small.
5. **Hairlines over boxes** — 1px `#dce3db` rules under the header and above the footer; whitespace does the rest.
6. **Editorial voice** — eyebrow labels, a hero statement, 4vw gutters on a 1440px canvas, 11–12px captions.

## 3. What changes, and what does not

**Unchanged:** all lease maths, affordability logic, CBSL 2026 thresholds, every element `id`, every event
handler, the logo assets, the catalogue page, account / share / print / AI-search behaviour.

**Changed:** colours, type scale, radii, spacing, borders, shadows, and the page structure of `index.html`.

## 4. File-by-file changes

| File | Type | Change |
|---|---|---|
| `design-system/tokens.json` | Core | New light palette (bone / forest / sage), re-tuned dark theme to a deep forest, catalogue card shadow, new type groups (eyebrow, caption), new radius and spacing steps. |
| `css/tokens.css` | Generated | Regenerate with `node scripts/build-tokens.mjs`. Never hand-edited. |
| `css/style.css` | Major | Header → catalogue `.site-header`; new `.hero`; panels → white cards on bone; labels 11px sage; inputs and buttons 10px radius / 600 weight / 46px min height; table with uppercase sage headings; filled chips; modals 20px radius with a sticky white header; hairline footer; print styles re-pointed. |
| `index.html` | Medium | New `<header class="site-header">` with brand + `Calculator / Catalogue` nav + existing actions; new `<section class="hero">`; anchor strip folded into the nav; `.eyebrow` labels above section headings; theme-colour metas updated. **All ids preserved.** |
| `about.html`, `terms.html`, `privacy.html` | Small | They already load `tokens.css` + `style.css`, so they inherit the palette; add the catalogue eyebrow treatment and hairline footer. |
| `docs/brand-guide.md` | Docs | Update the colour table, contrast figures and role descriptions to match the new palette. |
| `scripts/build-tokens.mjs` | — | No change expected. |

## 5. Token values

### Light

| Token | Now | Proposed | Contrast |
|---|---|---|---|
| `--bg` | `#f8fafc` | `#f5f6f3` | — |
| `--panel` | `#ffffff` | `#ffffff` | — |
| `--ink` | `#0f172a` | `#142a25` | 15.1:1 on panel |
| `--mute` | `#64748b` | `#586b62` | 5.7:1 on panel |
| `--line` | `#e2e8f0` | `#dce3db` | decorative |
| `--control-border` | `#7f8ea3` | `#86968c` | 3.11:1 on panel |
| `--accent` | `#0f766e` | `#103e36` | 11.9:1 with white |
| `--accent-bright` | `#2dd4bf` | `#168265` | 4.8:1 on panel |
| `--ok-ink` | `#047857` | `#1f5138` | 9.2:1 on panel |
| `--mid-ink` | `#92400e` | `#80520b` | 6.7:1 on panel |
| `--badge-bg` | `#ccfbf1` | `#e5ebe2` | — |
| `--bar` | `#cbd5e1` | `#dfe5dc` | — |

### Dark

| Token | Now | Proposed | Contrast |
|---|---|---|---|
| `--bg` | `#0b1120` | `#0e1a16` | — |
| `--panel` | `#0f172a` | `#152320` | — |
| `--ink` | `#f1f5f9` | `#e8f0ea` | 14.0:1 on panel |
| `--mute` | `#94a3b8` | `#9bb0a5` | 7.1:1 on panel |
| `--line` | `#1e293b` | `#253730` | decorative |
| `--control-border` | `#5b6b82` | `#5c7469` | 3.2:1 on panel |
| `--accent` | `#2dd4bf` | `#5eead4` | 11.0:1 on panel |

### Deliberate deviations from the catalogue

- **Control border.** The catalogue uses `#a9b6af` — 2.10:1 on white, under WCAG 1.4.11's 3:1 for control
  boundaries. Proposed `#86968c` (3.11:1) is near-identical in appearance and compliant.
- **Caption grey.** The catalogue's `#64756a` on the `#f3f5f0` chip is 4.45:1, just under 4.5:1.
  Proposed `#5e6e64` (4.92:1).

## 6. Decisions required

1. **Dark mode** — keep it re-themed to deep forest (recommended), or go light-only for exact catalogue parity?
2. **Display scale** — cap the hero at `clamp(38px, 4.4vw, 60px)` (recommended), or use the catalogue's full 78px?
3. **Hero section** — add a compact editorial opening with the 60% / 84-month / 50% DTI figures (recommended)?
4. **Palette fidelity** — adopt the accessible deviations above (recommended), or copy the catalogue exactly?
5. **Accent change** — move from teal-emerald `#0f766e` to forest `#103e36`, keeping teal in the logo and dark theme?
6. **Reach** — restyle the modals, AI panel, catalogue picker and the three information pages as well (recommended)?

## 7. Verification

- `node scripts/build-tokens.mjs` then `node test/tokens.test.mjs` — token contract and generated-CSS sync.
- Full regression: every suite listed in `.github/workflows/test.yml`.
- `test/verify.mjs` — confirms the sort options and element ids are intact.
- Visual pass in light and dark at 1440 / 1020 / 650px, plus the printed quotation.
- Re-measure every changed contrast pair and write the figures back into `docs/brand-guide.md`.

## 8. Known risk

The comparison table has ten columns and collapses into stacked cards at narrow widths. Those breakpoints
are hand-tuned in the stylesheet and will need a second pass after the palette lands. The colours are safe;
the layout needs watching.

## 9. Out of scope

Lease maths, catalogue page, logo and app-icon assets, account / share / print / AI-search behaviour, and the
`2.11.3` version string (unless a release bump is wanted alongside this).
