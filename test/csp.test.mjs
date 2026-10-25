// VahanaIQ Content-Security-Policy Test Suite
// Verifies Content-Security-Policy headers across all shipped HTML pages,
// ensures no inline scripts exist, and validates early boot script ordering.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHIPPED_PAGES = [
  'index.html',
  'catalogue.html',
  'studio.html',
  'about.html',
  'privacy.html',
  'terms.html'
];

const EXPECTED_CSP = "default-src 'self'; script-src 'self' https://www.gstatic.com https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://accounts.google.com https://vahanaiq-search-71962876227.asia-south1.run.app; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self';";

const CLOUD_RUN_PROXY_ORIGIN = 'https://vahanaiq-search-71962876227.asia-south1.run.app';

console.log('=== RUNNING VAHANAIQ CONTENT-SECURITY-POLICY TEST SUITE ===\n');

// ============================================================================
// TEST 1: Identical CSP Meta Tag Across All Six Shipped Pages
// ============================================================================
console.log('TEST 1: Identical CSP Meta Tag Across All Six Shipped Pages');

const cspByPage = new Map();
for (const page of SHIPPED_PAGES) {
  const filePath = path.join(ROOT, page);
  assert.ok(fs.existsSync(filePath), `${page} must exist`);
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(["'])(.*?)\1/i);
  assert.ok(match, `${page} must contain a Content-Security-Policy meta tag`);
  cspByPage.set(page, match[2]);
}

for (const [page, csp] of cspByPage.entries()) {
  assert.equal(csp, EXPECTED_CSP, `${page} CSP does not match the canonical CSP policy`);
}
console.log('✓ All six pages carry identical CSP policy\n');

// ============================================================================
// TEST 2: Policy Directive Specifics
// ============================================================================
console.log('TEST 2: Policy Directive Specifics');

const directives = Object.fromEntries(
  EXPECTED_CSP.split(';')
    .map(d => d.trim())
    .filter(Boolean)
    .map(d => {
      const parts = d.split(/\s+/);
      return [parts[0], parts.slice(1)];
    })
);

// script-src contains 'self' and https://accounts.google.com, and contains neither 'unsafe-inline' nor 'unsafe-eval'
assert.ok(directives['script-src'], 'script-src must be defined in CSP');
assert.ok(directives['script-src'].includes("'self'"), "script-src must contain 'self'");
assert.ok(directives['script-src'].includes('https://accounts.google.com'), 'script-src must contain https://accounts.google.com');
assert.ok(!directives['script-src'].includes("'unsafe-inline'"), "script-src must not contain 'unsafe-inline'");
assert.ok(!directives['script-src'].includes("'unsafe-eval'"), "script-src must not contain 'unsafe-eval'");
console.log("✓ script-src contains 'self' and Google Identity Services, without unsafe-inline or unsafe-eval");

// frame-src contains https://accounts.google.com and is not 'none'
assert.ok(directives['frame-src'], 'frame-src must be defined in CSP');
assert.ok(directives['frame-src'].includes('https://accounts.google.com'), 'frame-src must contain https://accounts.google.com');
assert.ok(!directives['frame-src'].includes("'none'"), "frame-src must not be 'none'");
console.log("✓ frame-src allows https://accounts.google.com and is not 'none'");

// connect-src contains https://accounts.google.com and the Cloud Run proxy origin
assert.ok(directives['connect-src'], 'connect-src must be defined in CSP');
assert.ok(directives['connect-src'].includes('https://accounts.google.com'), 'connect-src must contain https://accounts.google.com');
assert.ok(directives['connect-src'].includes(CLOUD_RUN_PROXY_ORIGIN), `connect-src must contain ${CLOUD_RUN_PROXY_ORIGIN}`);
console.log('✓ connect-src contains https://accounts.google.com and Cloud Run proxy origin');

// style-src allows the Google Identity Services stylesheet, which GIS injects
// into the document as <link href="https://accounts.google.com/gsi/style">
assert.ok(directives['style-src'], 'style-src must be defined in CSP');
assert.ok(directives['style-src'].includes('https://accounts.google.com'), 'style-src must contain https://accounts.google.com so the GIS stylesheet loads');
console.log('✓ style-src allows the Google Identity Services stylesheet');

// object-src 'none', base-uri 'self', form-action 'self' are present
assert.ok(directives['object-src'] && directives['object-src'].includes("'none'"), "object-src 'none' must be present");
assert.ok(directives['base-uri'] && directives['base-uri'].includes("'self'"), "base-uri 'self' must be present");
assert.ok(directives['form-action'] && directives['form-action'].includes("'self'"), "form-action 'self' must be present");
console.log("✓ object-src 'none', base-uri 'self', and form-action 'self' verified\n");

// ============================================================================
// TEST 3: No Inline Scripts in Any Shipped Page
// ============================================================================
console.log('TEST 3: No Inline Scripts in Any Shipped Page');

const inlineScriptRegex = /<script(?![^>]*\bsrc=)/i;
for (const page of SHIPPED_PAGES) {
  const content = fs.readFileSync(path.join(ROOT, page), 'utf8');
  assert.doesNotMatch(content, inlineScriptRegex, `${page} must not contain inline <script> tags without src`);
}
console.log('✓ No shipped page contains inline <script> without src\n');

// ============================================================================
// TEST 4: js/boot.js Existence and Early Loading Order
// ============================================================================
console.log('TEST 4: js/boot.js Existence and Early Loading Order');

const bootPath = path.join(ROOT, 'js/boot.js');
assert.ok(fs.existsSync(bootPath), 'js/boot.js must exist');

const SCRIPT_PAGES = ['index.html', 'catalogue.html', 'studio.html'];
for (const page of SCRIPT_PAGES) {
  const content = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const bootIndex = content.indexOf('js/boot.js');
  assert.ok(bootIndex !== -1, `${page} must reference js/boot.js`);

  const firstStylesheetIndex = content.search(/<link[^>]+rel=["'](?:stylesheet|preload["'][^>]+as=["']style)["']/i);
  assert.ok(firstStylesheetIndex !== -1, `${page} must contain a stylesheet or style preload link`);
  assert.ok(bootIndex < firstStylesheetIndex, `${page} must reference js/boot.js before the first stylesheet`);
}
console.log('✓ js/boot.js is loaded before stylesheets in index.html, catalogue.html and studio.html\n');

// ============================================================================
// TEST 5: The information-page generator reproduces the shipped pages
// ============================================================================
console.log('TEST 5: The information-page generator reproduces the shipped pages');

// scripts/build-info-pages.mjs rebuilds about.html, privacy.html and terms.html.
// --check renders them in memory and compares with disk, so a stale or hand-edited
// page (or a generator that drops the CSP and referrer meta tags) fails here rather
// than after the next regeneration silently strips the policy.
try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-info-pages.mjs'), '--check'], { cwd: ROOT, stdio: 'pipe' });
} catch (error) {
  assert.fail(`scripts/build-info-pages.mjs --check failed: ${error.stdout?.toString() || error.message}`);
}
console.log('✓ about.html, privacy.html and terms.html match the generator, CSP and referrer included\n');

console.log('==================================================');
console.log('ALL CSP TESTS PASSED SUCCESSFULLY! (100%)');
console.log('==================================================');
