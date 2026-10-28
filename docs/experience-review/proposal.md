# VahanaIQ experience proposal

27/10/2026 · Initial investigation. Implementation status updated 28/10/2026 below.

Reviewed the user-supplied preview at http://127.0.0.1:8123/index.html and catalogue.html, plus the local guidance, catalogue, token and layout code. The review covers the first-use experience, desktop hierarchy and catalogue search. Screenshots are in this folder. Font specimens are in fonts.html.

## Recommended first-use journey

1. **Welcome.** Full-page introduction: “The vehicle finance calculator for Sri Lanka.” Supporting text: “Choose cars you like, estimate their monthly lease payments and plan your deposit — in LKR.” Primary action: “Choose your cars”. Explain that sign-in is optional and results are estimates.
2. **Find your cars.** Search by make or model, with optional body-type and price filters. Require a shortlist before continuing. Proposed threshold: two distinct vehicles, with three encouraged; Akila requested “at least a few”, not an exact number. Keep a visible selected-cars tray and count. Preserve selections through searches and pagination; support removal and show year, trim, condition, price type and source date. Do not count duplicate cards for the same vehicle twice. Resolve purchase options explicitly rather than silently choosing the lowest price. An unpriced car can remain on the shortlist with “Quote needed”, never a zero rental. If catalogue loading fails, provide Retry and manual quote entry.
3. **Set your finance terms.** Explain deposit, lender's interest quote, reducing versus flat rates and term one at a time. Present any starting values as assumptions requiring review. Reuse the existing calculation functions and validations.
4. **Check your budget.** Explain income and commitments. Entering personal income remains optional; explicitly continuing without it means no personal affordability judgement is shown. Completing the learning step is required, disclosing income is not.
5. **See your comparison.** Use the selected cars immediately: price, deposit, financed amount and monthly rental. Explain totals and unknown prices. “Open my calculator” completes onboarding. Savings planning is a next action, not another compulsory lesson.

Mandatory once for new users, resumable after reload, with Back at every step and no general Skip. Preserve existing comparisons. Existing users with genuine saved work should retain it and be offered the new guide; a previously dismissed welcome alone must not count as completed onboarding. Gate direct Calculator and Catalogue entry consistently, while keeping Help, Privacy and Terms accessible. Store a versioned completion state separately from financial inputs. If persistence is unavailable, continue in memory and explain that progress cannot survive closing the tab. Do not require account creation or invent account-level completion sync.

## Desktop and tablet layout

Make the comparison the main working surface. Remove the introductory banner after onboarding. Replace the large empty affordability gauge with a short “Add income to check affordability” prompt until it can show a meaningful result. Present monthly rental, deposit and total cost before secondary charts. Move Print, theme preferences and Photo Studio into secondary navigation; keep Calculator, Catalogue and Help easy to find.

**Loan Terms should fit the available desktop height in its default state.** Use a roughly 320–360px sidebar beside the comparison, sticky below the header, with height bounded by the viewport minus header and margins. Core rate, term and deposit controls remain visible; presets, income, fees and detailed explanations use disclosures. Remove duplicated sliders/presets where the number input already suffices. Do not reduce type or touch-target size to make it fit.

Expanded content may scroll within the sidebar only on sufficiently wide and tall screens; it needs a clear scroll affordance, visible focus and no clipped popovers. At tablet portrait widths, short landscape heights and high browser zoom, return to document flow with a compact terms summary and an “Edit loan terms” disclosure. Test available width and height rather than classifying every tablet as desktop. Suggested starting breakpoint for a persistent sidebar: 1100px wide and 720px high, to be validated with the real controls.

**Remove the “CBSL Directions 2026” hero strip.** It competes with the product explanation and groups unlike figures beneath one regulatory heading. Put applicable deposit-rule context next to the deposit control, with the source in Help/footer. Treat term limits, lender policies and DTI planning assumptions separately and verify their sources before describing them as statutory. This is a UI recommendation, not a legal determination about required disclosures.

## Catalogue price history

The local JSON contains 227 model records and 303 offers. Offers have amount, kind, source URL, checked date and sometimes publication date; there is no dedicated history series in the inspected schema. The browser renders 229 vehicle cards after catalogue transformation; model records and visible cards must not be treated as identical counts.

Build **recorded price history**, not a fabricated market index. Append reviewed observations keyed by model, variant, year, condition, import/distributor route, source and price kind. Store amount in LKR, observed date, source publication date, source URL and verification status. A rechecked old article is not a new historical price. Corrections and changed variants must not appear as market movements. Estimated prices stay separate from observed asking/distributor prices; launch prices are historical reference points only when their original dates and matching variants are supported.

Show current recorded price and last checked date on cards; put the full chart and accessible data table in vehicle details. Enable period comparisons only when comparable observations cover the stated period. With one point show “Price history is being collected”; with none show “No recorded history”. Do not label sparse unchanged records as a stable market. Compute change as (latest − earlier) / earlier only for comparable positive values, and label actual dates. Do not infer transaction prices from asking prices.

Integrate snapshots into the reviewed price-update process, preserving prior observations when current offers change. Inspect historical repository revisions for potential backfill, but only admit source-supported dated observations. The existing monthly refresh decision does not itself prove a history collection pipeline exists.

## Typography choices

Open fonts.html for identical text and fictional numeric samples in three options:

- A: Inter throughout — restrained and practical.
- B: Manrope headings, Inter controls and figures — recommended balance of identity and readability.
- C: Plus Jakarta Sans throughout — friendlier; check table widths carefully.

Use tabular figures for money, a consistent 16px body, 14px control labels, restrained uppercase labels and fewer competing weights. Self-host the selected licensed files, keep licence notices, use font-display: swap and cache for offline use. Change design-system/tokens.json and regenerate css/tokens.css through scripts/build-tokens.mjs; do not patch the generated tokens alone. Ensure the catalogue's standalone font declarations use the same family tokens. Sinhala/Tamil support would require explicit script coverage and suitable fallback fonts if localisation is added.

Sources: [Inter](https://rsms.me/inter/), [Manrope](https://fonts.google.com/specimen/Manrope), [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans).

## Current flow evidence

1. **First arrival — needs clearer priority.** Two introductions precede useful input; the mobile view puts many header controls before the welcome. Captures: 01-first-visit.png, 02-desktop.png.
2. **Existing tour — usable guidance, not mandatory onboarding.** Four explanatory steps can be advanced without entering values or selecting a car. Skip and Minimise remain available; the floating card overlaps the working area. Captures: 03-tour.png, 04-tour-shortlist.png, 05-tour-finish.png. The income step was inspected through the accessibility tree rather than captured separately.
3. **Catalogue search — useful foundation.** Searching Toyota visibly returns matching cards. A broad guidance banner remains above results; review controls and comparison selection represent different actions. Reuse search and imagery, but give onboarding one clearly named shortlist action. Capture: 06-catalogue-search.png.

Visible accessibility concerns: small uppercase labels, multiple controls competing for attention, and a floating tour overlapping content. The existing semantic labels and focus movement are useful foundations. This targeted review is not a contrast audit, screen-reader certification or complete mobile/tablet test; keyboard sequences, zoom, both themes, storage failures and responsive transitions need testing during implementation.

## Implementation sequence and acceptance

1. Add a shared shortlist adapter and a versioned onboarding state machine in the guidance modules. Build welcome/search/terms/budget/results stages and entry gating. Reuse catalogue search, stable identities, comparison persistence and calculator maths; do not maintain two independent selection stores.
2. Simplify the working layout and terms panel in index.html/css/style.css. Remove the hero strip, relocate source explanations, apply the selected typography through tokens and regenerate bundled resources/service-worker entries.
3. Add a validated historical observation file, importer and rendering module; integrate catalogue detail history and empty states. Real trend claims wait for adequate verified data.

Acceptance: fresh entry cannot bypass the shortlist; two distinct selected vehicles (proposed minimum) unlock Continue; duplicate cards do not increase the count; search/pagination/back/reload preserve choices; finishing produces the same cars and reviewed terms in the calculator. Existing saved work survives migration. Unknown prices remain unknown. Catalogue failure has a recovery path. Keyboard focus, progress announcements and selection state are accessible. At 1440×900, 1280×720, 1024×768 and 768×1024, essential controls remain usable without clipped content; also check 200% zoom. Run the existing calculator/storage/guidance/catalogue suites and update browser tests for the new mandatory flow. No financial formula change is intended.

## Implementation status, 28/10/2026

Implemented on the existing PR #29 branch: mandatory five-step first use, a minimum of two distinct cars with three encouraged, search and purchase-option selection, quoted-car fallback, draft recovery, reviewed terms and optional income, and comparison transfer. Existing valid saved comparisons remain usable. Unpriced catalogue options require a user quote before comparison; no zero-price estimate is fabricated.

Option C (Plus Jakarta Sans) is self-hosted with its licence and shared design token. The calculator puts comparison before affordability, removes the CBSL hero strip and folds presets and income. Loan Terms uses a viewport-bounded sticky sidebar on screens at least 1366px wide and 720px tall; narrower/shorter layouts stay in document flow. This preserves the existing table-width breakpoint. The proposal to move header tools into secondary navigation is deferred.

Catalogue details now render recorded price history with a chart, actual-date change, source-linked table and empty/one-point states. The initial dataset is empty because the current catalogue does not establish a verified historical series. The reviewed import procedure is documented in price-history.md; no trend backfill or automatic monthly capture is claimed.

See implementation-verification.md for test evidence and limitations. Earlier screenshots capture the original experience; 09–11 capture the implementation.
