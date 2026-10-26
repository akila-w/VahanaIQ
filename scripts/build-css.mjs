#!/usr/bin/env node
// Builds css/style.min.css, the minified stylesheet the calculator page loads, from css/style.css.
// css/style.css stays the file to edit and the one the tests read; the minified copy is committed
// because GitHub Pages serves the repository as it is.
//
//   node scripts/build-css.mjs           write css/style.min.css
//   node scripts/build-css.mjs --check   exit 1 if css/style.min.css is out of date
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(root, 'css/style.css');
const OUTPUT = path.join(root, 'css/style.min.css');

export async function buildStyleMin() {
  const { code } = await transform(fs.readFileSync(SOURCE, 'utf8'), {
    loader: 'css', minify: true, target: ['safari15', 'chrome100', 'firefox100'], legalComments: 'none'
  });
  return code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = await buildStyleMin();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
    if (current !== code) { console.error('css/style.min.css is out of date: run node scripts/build-css.mjs'); process.exit(1); }
    console.log('css/style.min.css matches css/style.css');
  } else {
    fs.writeFileSync(OUTPUT, code);
    console.log(`Wrote css/style.min.css (${(fs.statSync(SOURCE).size / 1024).toFixed(0)} KiB -> ${(code.length / 1024).toFixed(0)} KiB)`);
  }
}
