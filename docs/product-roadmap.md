# VahanaIQ product roadmap

Updated: 20/10/2026. Work proceeds one milestone at a time, with a working local preview and verification at each milestone.

## Confirmed requirements

- Catalogue scope: **passenger cars and SUVs**, including hatchbacks, saloons, estates, coupes, convertibles and crossovers. Exclude MPVs, vans, pickups, motorcycles, three-wheelers, buses and heavy trucks. Check ambiguous body classifications against model specifications.
- Cover vehicles offered in Sri Lanka and remove unsupported or out-of-scope records using evidence. A missing distributor listing alone does not disprove grey-import or used-market availability.
- Add filters and the ability to remove vehicles from a user's comparison.
- Add a savings planner: percentage of income saved, monthly savings and time to afford a vehicle.
- Add Google sign-in so users can save and synchronise their vehicles, changes and financial amounts.
- Show **two decimal places for every currency amount** across inputs, results, summaries, print and future exports. Preserve calculation precision; add trailing cents when editing finishes so typing remains usable. Percentages, years and distances are separate units.
- Refine the UI against an agreed visual reference, with responsive and accessible behaviour.

Vehicle type scope is confirmed. Condition coverage was not separately narrowed by the answer: retain the app's existing new/reconditioned/used capability and verify market evidence separately for each condition. The public catalogue scope does not change the owner's personal purchase preferences.

## Delivery order

| Milestone | Deliverable | Completion criteria |
| --- | --- | --- |
| 0. Baseline and currency | Keep the fixes in [PR #10](https://github.com/akila-w/vahanaiq/pull/10) as the development baseline; apply the two-decimal formatting requirement now. | Currency values retain cents, show `.00` for whole amounts, survive save/reload, and work while editing. Existing suites pass. PR merge, Pages deployment and the separate proxy deployment are release steps; local completion is not production completion. |
| 1. Catalogue | An evidence-backed model/variant inventory; stable identifiers; catalogue browsing separated from the selected comparison; additions and justified retirements in reviewable brand batches. | Every published record has a stable ID, correct body type, route/condition, source and checked date. Market-specific trims and powertrains are distinct. Unknown facts stay unknown. Legacy saved edits migrate to the same vehicle. Each brand has a coverage status and unresolved list. |
| 2. Filters | Make/model search, body type, price range, condition, petrol/diesel/BEV/MHEV/HEV/PHEV, year, official/grey import and affordability; seats, transmission and drivetrain where verified. | Filters combine correctly, offer useful sorting, show active chips and a result count, clear cleanly, and behave on mobile. Missing data has an explicit unknown state. Unpriced vehicles are not treated as free or affordable. |
| 3. Removal and shortlist | One clear **Remove from comparison** action for catalogue and custom vehicles, Undo, clear comparison and add back from the catalogue. | Selection persists through reload and catalogue updates; removed rows stay removed; Undo restores the correct vehicle and focus. User removal does not delete the shared catalogue record. |
| 4. Savings planner | A selected-car savings goal, existing savings, contribution as percentage of net income or monthly LKR amount, upfront cost breakdown, target date and saved scenarios. | Forward calculation shows time to target; reverse calculation shows required monthly saving and income percentage. Zero saving, already funded goals, missing prices and unaffordable target dates have clear states. All currency is shown to two decimals. |
| 5. Google accounts and sync | Real Google authentication, private per-user storage and account controls for saved cars, price edits, budgets, planner inputs and scenarios. | Sign-in/out, expired sessions, account switching, offline failures, guest-data migration and conflicting edits work. A second device can restore the same account's changes. Users cannot read or change another account's data. Sign-out clears account data from the active view. |
| 6. UI refinement and release | A consistent catalogue → compare → save journey, polished light/dark themes and a final full regression run. | Match agreed reference screens at 375, 768 and 1440 CSS pixels; check typography, spacing, numerical alignment, vehicle images, focus, touch targets, contrast, empty/loading/error states and print. Verify the deployed site after release. |

## Milestone 1: start here

1. Build a manufacturer/distributor coverage register, then check importer and reconditioned/used evidence. Start from [the research inventory](catalogue-research.md); it is a seed, not a complete national catalogue.
2. Review each of the existing 12 variants against primary local sources. Produce **keep / correct / add / retire / unverified** decisions with URLs, checked dates and reasons. Retire only where evidence supports it; lack of a price is not lack of availability.
3. Define records with `id`, make, model, generation/market, year/trim, body type, structured powertrain, condition/import route and source metadata. Separate model availability from current seller stock and from price evidence.
4. Replace positional `_baseId` storage with stable IDs before reordering the catalogue. Migrate the original 12 indices using an explicit immutable mapping; preserve custom cars and user prices. Migration must be safe to run more than once.
5. Support `price: null` plus a status such as “Price on request”. Such vehicles can be browsed, but calculations require a valid entered or verified price. Never substitute zero, a different trim's price or invented depreciation.
6. Build catalogue browsing and add-to-comparison controls so a large catalogue does not automatically produce hundreds of comparison rows. Then publish verified additions brand by brand.
7. Update the existing monthly price-refresh process to use stable IDs and individual price/source dates without overwriting personal price edits.

Use official local distributor/manufacturer pages and their price lists first, followed by dealers/importers' own published material. Keep availability evidence separate from warranty and price evidence. Do not scrape sites that prohibit it or bypass access blocks. Announcements and “coming soon” listings need a separate status. Images should match the variant where possible and use a consistent fallback when unavailable.

The coverage target is a documented, maintainable Sri Lankan market catalogue. Do not claim that every historical or privately imported vehicle has been verified. Report remaining brands, conditions and variants explicitly.

## Savings planner details

The default target is the selected vehicle's deposit plus user-entered purchase costs. Offer full cash purchase as an alternative. Reuse the existing income amount and the applicable deposit calculation; show every component so the goal is understandable.

- `remaining = max(0, target upfront cost − existing savings)`.
- `monthly savings = net monthly income × savings percentage / 100`, or a directly entered monthly amount.
- `months to goal = ceil(remaining / monthly savings)` when a positive balance remains and monthly saving is positive.
- For a target in `N` months: `required monthly saving = remaining / N`; show the corresponding income percentage when income is positive.
- Use a visible no-investment-growth assumption initially. Do not assume interest, investment returns or future vehicle price appreciation. Future assumptions must be explicit and editable.
- Show whether the proposed contribution fits income after existing commitments; do not imply that a saved deposit guarantees lease eligibility.
- Save the chosen vehicle, price/date, deposit choice, cost items, existing savings, contribution and target date as one scenario.

## Accounts and saved data

GitHub Pages remains the static frontend. The account milestone needs a managed Google authentication and database service; provider selection and project configuration belong to that milestone. Google sign-in alone does not store budgets.

Keep guest mode usable. On first sign-in, offer to import local changes, with explicit merge/replace choices if the account already has data. Define record ownership, schema versions, save status, conflict handling, deletion and account-data export. Financial inputs must remain private by default; sharing requires a deliberate user action. Do not place secrets in the repository or rely on UI-only access restrictions.

A live end-to-end account test needs a real configured project, the deployed site's authorised origin and appropriate database access rules. Request only the missing setup when reaching that milestone; do not display a simulated successful sign-in.

## Other useful features to prioritise later

After the requested savings and account work: price/source freshness indicators, named comparison scenarios, an editable running-cost estimate, and improved share/print/export. Rank these against the existing journey before implementation; this list is a proposal, not a promise to ship every item.

## Working method

Finish and verify one milestone before broadening the implementation. Use small reviewable changes, retain saved-data compatibility and report local, merged and deployed status separately. Every milestone gets focused checks; reserve the full visual and end-to-end regression for the integrated release as well.

Current status: milestone 1 is in progress. Its first catalogue batch has 146 entries across 27 makes, with source/status metadata, local browsing and stable-ID saved-comparison migration implemented. Eight entries carry published/starting amounts; other prices require a quote. Automated migration and data checks pass. The 25 browser checks pass, including search, quote validation, save/reload, removal/Undo, keyboard focus and responsive catalogue layouts; further makes, trims and used generations remain in the research register. Savings planning has not been implemented. The catalogue batch is deployed; since then the catalogue gained photos, filters and priced-first sorting, and the comparison gained lease details, flat-rate support and per-car legal down payments (v2.9.0), and v2.10.0 added optional Google sign-in that syncs inputs and the comparison across devices.
