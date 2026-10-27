# Reviewed price history

28/10/2026

`data/price-history.json` starts empty. Current catalogue prices, estimates and rechecked launch articles are not a historical market series. The catalogue detail view explains this until verified observations exist.

For each reviewed price update, retain source evidence and prepare an array of observations with these fields: `modelId`, `offerId`, `seriesId`, `sourceUrl` (HTTPS), `observedOn` (YYYY-MM-DD), `amount` (positive LKR number), `currency: "LKR"`, `kind` (`official` or `dealer`), `reviewed: true`, and explicit string values for `year`, `trim`, `condition`, `route`. Model identifiers must match the catalogue's underlying model, not its transformed year-card ID. `seriesId` identifies the continuing comparable price source and vehicle specification.

Run `node scripts/import-price-history.mjs path/to/reviewed-observations.json`, inspect the diff, and commit it alongside the reviewed catalogue update. This is a manual review step; the monthly refresh script does not automatically claim observations are verified. Keep the original observation when an offer changes. The importer ignores identical duplicates and rejects conflicting prices for the same source/specification/date before writing anything.

Only like-for-like specification, price kind and source URL are grouped. Different years, trims, condition, route or sources form separate series. The chart and table show actual dates, and percentage change requires two distinct dates with positive values. Dealer observations remain asking prices, not completed sale prices. Duplicate dates invalidate a displayed series until corrected. Estimated and launch prices are excluded from trend calculations.

No historical backfill has been verified in this change. A source URL changing requires explicit review of continuity rather than silently joining unrelated prices.
