// css/style.min.css is what the calculator page loads; it must be the current build of css/style.css.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildStyleMin } from '../scripts/build-css.mjs';

const min = fs.readFileSync('css/style.min.css', 'utf8');
assert.equal(min, await buildStyleMin(), 'css/style.min.css is out of date: run node scripts/build-css.mjs');
assert.ok(fs.readFileSync('index.html', 'utf8').includes('css/style.min.css?v='), 'index.html must load css/style.min.css');
assert.ok(fs.readFileSync('sw.js', 'utf8').includes('css/style.min.css?v='), 'sw.js must precache css/style.min.css');
console.log('✓ css/style.min.css is current and referenced by index.html and sw.js');
