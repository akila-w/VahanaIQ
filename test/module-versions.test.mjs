// VahanaIQ Module & Asset Versions Test Suite
// Verifies unified asset versioning across all shipped HTML pages,
// relative ES module imports, and the service worker offline cache.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION } from '../js/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHIPPED_PAGES = [
  'index.html',
  'catalogue.html',
  'studio.html',
  'about.html',
  'privacy.html',
  'terms.html'
];

console.log('=== RUNNING VAHANAIQ MODULE VERSIONS TEST SUITE ===\n');

// ============================================================================
// TEST 1: APP_VERSION Format and Presence in js/config.js
// ============================================================================
console.log(`TEST 1: Canonical APP_VERSION (${APP_VERSION})`);
assert.ok(APP_VERSION, 'APP_VERSION must be defined in js/config.js');
assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/, 'APP_VERSION must be a semantic version string (e.g. 2.12.0)');
console.log(`✓ APP_VERSION is "${APP_VERSION}"\n`);

// ============================================================================
// TEST 2: Every Relative Import Between js/*.js Files Ends in ?v=APP_VERSION
// ============================================================================
console.log('TEST 2: Relative ES Module Imports in js/*.js');

const jsDir = path.join(ROOT, 'js');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
let totalRelativeImports = 0;

for (const file of jsFiles) {
  const filePath = path.join(jsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Static imports and exports: import ... from "..." or export ... from "..."
  const fromRegex = /(?:import|export)\s+[\s\S]*?\s+from\s*["'](\.[^"']+)["']/g;
  for (const match of content.matchAll(fromRegex)) {
    const specifier = match[1];
    totalRelativeImports++;
    assert.ok(
      specifier.endsWith(`?v=${APP_VERSION}`),
      `In js/${file}: import/export specifier "${specifier}" must end in ?v=${APP_VERSION}`
    );
  }

  // Bare imports: import "..."
  const bareRegex = /import\s+["'](\.[^"']+)["']/g;
  for (const match of content.matchAll(bareRegex)) {
    const specifier = match[1];
    totalRelativeImports++;
    assert.ok(
      specifier.endsWith(`?v=${APP_VERSION}`),
      `In js/${file}: bare import "${specifier}" must end in ?v=${APP_VERSION}`
    );
  }

  // Dynamic imports: import("...")
  const dynamicRegex = /import\s*\(\s*["'](\.[^"']+)["']\s*\)/g;
  for (const match of content.matchAll(dynamicRegex)) {
    const specifier = match[1];
    totalRelativeImports++;
    assert.ok(
      specifier.endsWith(`?v=${APP_VERSION}`),
      `In js/${file}: dynamic import "${specifier}" must end in ?v=${APP_VERSION}`
    );
  }
}

assert.ok(totalRelativeImports > 0, 'Must check at least one relative import');
console.log(`✓ Checked ${totalRelativeImports} relative imports across ${jsFiles.length} JS files; all end in ?v=${APP_VERSION}\n`);

// ============================================================================
// TEST 3: No Shipped *.html or js/*.js Contains a ?v= Other Than APP_VERSION
// ============================================================================
console.log('TEST 3: Shipped Asset Version Query Strings');

// Check script and link references in shipped HTML pages
let checkedHtmlAssets = 0;
for (const page of SHIPPED_PAGES) {
  const pagePath = path.join(ROOT, page);
  const html = fs.readFileSync(pagePath, 'utf8');

  // Match all script tags with local src
  const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/gi;
  for (const match of html.matchAll(scriptRegex)) {
    const src = match[1];
    if (src.includes('?v=')) {
      checkedHtmlAssets++;
      assert.ok(
        src.endsWith(`?v=${APP_VERSION}`),
        `In ${page}: script src "${src}" has ?v= but does not match ?v=${APP_VERSION}`
      );
    }
  }

  // Match stylesheet and preload link tags with local href
  const linkRegex = /<link\s+[^>]*href=["']([^"']+)["']/gi;
  for (const match of html.matchAll(linkRegex)) {
    const href = match[1];
    // Check local styles and scripts (tokens.css, style.css, app.js, etc.)
    if (/\.(?:js|css)\?v=/.test(href)) {
      checkedHtmlAssets++;
      assert.ok(
        href.endsWith(`?v=${APP_VERSION}`),
        `In ${page}: link href "${href}" has ?v= but does not match ?v=${APP_VERSION}`
      );
    }
  }

  // Ensure no historical or mismatched version queries exist in any form
  const mismatchedVersions = [...html.matchAll(/\?v=(2\.\d+\.\d+)/g)].filter(m => m[1] !== APP_VERSION);
  assert.equal(
    mismatchedVersions.length,
    0,
    `In ${page}: found mismatched version queries: ${mismatchedVersions.map(m => m[0]).join(', ')}`
  );
}
assert.ok(checkedHtmlAssets > 0, 'Must check at least one HTML asset link/script');
console.log(`✓ Checked ${checkedHtmlAssets} asset tags across ${SHIPPED_PAGES.length} HTML pages; all match ?v=${APP_VERSION}`);

// Check all js/*.js files for mismatched version queries
for (const file of jsFiles) {
  const filePath = path.join(jsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const mismatchedVersions = [...content.matchAll(/\?v=(2\.\d+\.\d+)/g)].filter(m => m[1] !== APP_VERSION);
  assert.equal(
    mismatchedVersions.length,
    0,
    `In js/${file}: found mismatched version queries: ${mismatchedVersions.map(m => m[0]).join(', ')}`
  );
}
console.log(`✓ No shipped HTML or JS file contains a ?v= other than ${APP_VERSION}\n`);

// ============================================================================
// TEST 4: sw.js CACHE String Contains APP_VERSION
// ============================================================================
console.log('TEST 4: Service Worker Offline Cache String');
const swPath = path.join(ROOT, 'sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');
const cacheMatch = swContent.match(/const\s+CACHE\s*=\s*["']([^"']+)["']/);
assert.ok(cacheMatch, 'sw.js must declare const CACHE');
assert.ok(
  cacheMatch[1].includes(APP_VERSION),
  `sw.js CACHE string "${cacheMatch[1]}" must contain APP_VERSION "${APP_VERSION}"`
);
assert.equal(cacheMatch[1], `vahanaiq-v${APP_VERSION}`, `sw.js CACHE should equal "vahanaiq-v${APP_VERSION}"`);
console.log(`✓ sw.js CACHE string is "${cacheMatch[1]}" containing "${APP_VERSION}"\n`);

console.log('==================================================');
console.log('ALL MODULE VERSION TESTS PASSED SUCCESSFULLY! (100%)');
console.log('==================================================');
