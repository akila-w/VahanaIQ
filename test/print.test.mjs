// ============================================================================
// VahanaIQ Print Stylesheet & Bank Quotation Layout Test Suite
// Verifies A4 page budgeting, interactive noise suppression, regulatory
// CBSL statutory disclosures, page-break hygiene, and print color preservation.
// ============================================================================

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const styleCss = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");
const tokensCss = fs.readFileSync(path.join(ROOT, "css", "tokens.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

console.log("=== RUNNING VAHANAIQ PRINT STYLESHEET TEST SUITE ===");

// 1. Single Consolidated @media print Block
const printMatches = [...styleCss.matchAll(/@media\s+print\s*\{/g)];
assert.equal(
  printMatches.length,
  1,
  `css/style.css must have exactly 1 consolidated @media print block, found ${printMatches.length}`
);
console.log("✓ Exactly 1 consolidated @media print block in css/style.css");

// Extract the print block
const printBlockStart = styleCss.indexOf("@media print {");
assert.ok(printBlockStart > -1, "css/style.css must contain @media print {");
const printCss = styleCss.slice(printBlockStart);

// 2. A4 Page Box Budgeting & Reset
assert.match(printCss, /size:\s*A4\s+portrait/i, "Print stylesheet must target A4 portrait");
assert.match(printCss, /-webkit-print-color-adjust:\s*exact/i, "Must preserve exact colors in WebKit engines");
assert.match(printCss, /print-color-adjust:\s*exact/i, "Must preserve exact colors in standard print engines");
console.log("✓ A4 portrait geometry and exact print-color-adjust verified");

// 3. Complete Interactive Noise Suppression
const suppressedSelectors = [
  ".site-header nav",
  ".header-actions",
  ".tools",
  "#toolsPanel",
  ".filters-toggle",
  ".comparison-tools",
  "#resetCatalogWrap",
  "#openCatalogueBtn",
  "#shareBtn",
  "#resetCatalogBtn",
  "#showMoreVehicles",
  ".show-more",
  ".bulk-actions",
  ".empty-state",
  "#empty",
  ".page-nav",
  ".calculation-basis",
  ".site-links",
  ".modal-bg",
  "dialog",
  "#catalogueModal",
  "#detailModal",
  "#aiModal",
  "#accountModal",
  ".toast",
  ".budget-bar",
  "#budgetLive",
  "#toggleTerms",
  ".compact-terms",
  "#resetInputsBtn",
  ".strategy-scenarios-wrap",
  ".savings-panel",
  ".terms-slider",
  'input[type="range"]',
  ".preset-chips",
  ".chip-btn",
  ".step-btn",
  "button[data-step-for]",
  "button[data-preset-for]",
  ".hint",
  ".cycle-icon",
  ".edit-price",
  ".icon-btn",
  "th.actions",
  "td.v-actions",
  "#footerSourceGuide",
  "#openPhotoCreditsBtn",
  "body::before",
  "body::after",
  ".aurora-glow",
  ".skip"
];

for (const sel of suppressedSelectors) {
  assert.ok(
    printCss.includes(sel),
    `Print stylesheet must explicitly suppress selector: ${sel}`
  );
}
console.log(`✓ All ${suppressedSelectors.length} interactive noise selectors suppressed in @media print`);

// 4. Page Break Hygiene (Uncut table rows, uncut panels, repeated thead)
assert.match(
  printCss,
  /tr\s*\{[^}]*break-inside:\s*avoid[^}]*page-break-inside:\s*avoid/i,
  "Table rows must enforce break-inside: avoid and page-break-inside: avoid"
);
assert.match(
  printCss,
  /thead\s*\{[^}]*display:\s*table-header-group/i,
  "Table header must repeat across multi-page printouts with display: table-header-group"
);
assert.match(
  printCss,
  /\.panel\s*\{[^}]*break-inside:\s*avoid/i,
  ".panel cards must avoid page breaks"
);
assert.match(
  printCss,
  /\.terms-panel\s*\{[^}]*break-inside:\s*avoid/i,
  ".terms-panel must avoid page breaks"
);
assert.match(
  printCss,
  /\.ltv-split-container\s*\{[^}]*break-inside:\s*avoid/i,
  ".ltv-split-container must avoid page breaks"
);
assert.match(
  printCss,
  /#budgetPanel\s*\{[^}]*break-inside:\s*avoid/i,
  "#budgetPanel must avoid page breaks"
);
assert.match(
  printCss,
  /footer\.foot\s*\{[^}]*break-inside:\s*avoid/i,
  "footer.foot must avoid breaking awkwardly across pages"
);
console.log("✓ Page break hygiene (tr, thead, .panel, .ltv-split-container, #budgetPanel, footer) verified");

// 5. Statutory Quotation Branding & CBSL Regulatory Disclosures
assert.match(
  printCss,
  /\.site-header::after\s*\{[^}]*STATUTORY LEASE FINANCING QUOTATION/i,
  "Site header must carry statutory quotation watermark / title in print"
);
assert.match(
  printCss,
  /\.site-header::after\s*\{[^}]*Central Bank of Sri Lanka Directions No\. 01 of 2026/i,
  "Site header must cite CBSL Directions No. 01 of 2026"
);
assert.match(
  printCss,
  /\.hero-aside\s*\{[^}]*background:\s*var\(--badge-bg\)/i,
  "Hero aside statutory metrics box must style cleanly with badge background"
);
console.log("✓ CBSL Directions No. 01 of 2026 quotation branding & watermarks verified");

// 6. Form Inputs & Two-Way Segment Controls Clean Presentation
assert.match(
  printCss,
  /\.stepper-wrap\s*\{[^}]*background:\s*var\(--print-field-bg\)/i,
  ".stepper-wrap must render as a clean print field"
);
assert.match(
  printCss,
  /\.input-adorn-wrap\s*\{[^}]*background:\s*var\(--print-field-bg\)/i,
  ".input-adorn-wrap must render as a clean print field with prefix"
);
assert.match(
  printCss,
  /\.seg-btn\.active\s*\{[^}]*display:\s*inline-flex/i,
  "Active segment button must be rendered as a prominent statutory choice badge"
);
assert.match(
  printCss,
  /\.seg-btn\s*\{[^}]*display:\s*none/i,
  "Inactive segment button must be hidden in print"
);
console.log("✓ Stepper, currency adornment, and 2-way segment controls verified");

// 7. Graphics & Visual Indicators Preservation
assert.match(
  printCss,
  /\.ltv-bar-track\s*\{[^}]*print-color-adjust:\s*exact/i,
  "LTV bar track must enforce exact print colors"
);
assert.match(
  printCss,
  /\.ltv-bar-dp\s*\{[^}]*print-color-adjust:\s*exact/i,
  "LTV deposit segment must enforce exact print colors"
);
assert.match(
  printCss,
  /\.ltv-bar-loan\s*\{[^}]*print-color-adjust:\s*exact/i,
  "LTV loan segment must enforce exact print colors"
);
assert.match(
  printCss,
  /\.dial-arc-safe\s*\{[^}]*print-color-adjust:\s*exact/i,
  "Budget speedometer safe arc must enforce exact print colors"
);
assert.match(
  printCss,
  /\.dial-arc-mid\s*\{[^}]*print-color-adjust:\s*exact/i,
  "Budget speedometer mid arc must enforce exact print colors"
);
assert.match(
  printCss,
  /\.dial-arc-bad\s*\{[^}]*print-color-adjust:\s*exact/i,
  "Budget speedometer bad arc must enforce exact print colors"
);
assert.match(
  printCss,
  /\.cashflow-bar\s*\{[^}]*print-color-adjust:\s*exact/i,
  "Cashflow spectrum bar must enforce exact print colors"
);
assert.match(
  printCss,
  /\.cashflow-seg-rental\s*\{[^}]*print-color-adjust:\s*exact/i,
  "Cashflow vehicle rental segment must enforce exact print colors"
);
console.log("✓ LTV split bar, speedometer SVG arcs, and cashflow spectrum colors verified");

// 8. Vehicle Quotation Table & Thumbnail Presentation
assert.match(
  printCss,
  /\.car\s+img,\s*\.car\s+\.ph\s*\{[^}]*print-color-adjust:\s*exact/i,
  "Vehicle thumbnail images must retain exact print colors and border"
);
assert.match(
  printCss,
  /button\.cond-tag\s*\{[^}]*print-color-adjust:\s*exact/i,
  "Vehicle condition tags must retain exact print colors"
);
assert.match(
  printCss,
  /\.v-bar\s+\.track\s*\{[^}]*print-color-adjust:\s*exact/i,
  "Mini budget share bar track must retain exact print colors"
);
assert.match(
  printCss,
  /\.tag\.ok\s*\{[^}]*background:\s*#f0fdf4/i,
  "Affordability OK tag must retain light green background in print"
);
console.log("✓ Vehicle thumbnail, condition tags, budget share and affordability pills verified");

// 9. Statutory Footnotes in 3 Columns
assert.match(
  printCss,
  /\.foot-cols\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/i,
  "Footer statutory notes must display in 3 neat columns"
);
console.log("✓ 3-column statutory disclaimers in footer verified");

// 10. Design Tokens Print Theme Mapping
assert.match(tokensCss, /@media print \{\n\s*:root, :root\[data-theme\] \{/, "Tokens must define print theme overrides");
assert.match(tokensCss, /--print-field-bg:\s*#f5f6f3;/, "Tokens must provide --print-field-bg");
assert.match(tokensCss, /--print-head-ink:\s*#334155;/, "Tokens must provide --print-head-ink");
assert.match(tokensCss, /--print-rule:\s*#e2e8f0;/, "Tokens must provide --print-rule");
console.log("✓ Design tokens print palette mappings verified");

console.log("\n==================================================");
console.log("ALL 10 PRINT STYLESHEET TEST SUITES PASSED (100%)");
console.log("==================================================");
