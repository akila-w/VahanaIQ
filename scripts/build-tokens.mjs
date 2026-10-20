#!/usr/bin/env node
// Builds css/tokens.css from design-system/tokens.json, the VahanaIQ design system's
// tokens. tokens.json is the one place to change a colour, shadow, spacing step, radius, size or timing;
// css/style.css only reads the custom properties this writes.
// Colours and shadows follow the theme: Light on :root, Dark under prefers-color-scheme
// (unless the toggle picked Light) and [data-theme="dark"], and Print under @media print.
// A token with no value for a theme keeps its Light value there. Breakpoints are not
// written, because media queries cannot read custom properties.
// No npm dependencies (Node 20+).
//
//   node scripts/build-tokens.mjs           write css/tokens.css
//   node scripts/build-tokens.mjs --check   exit 1 if css/tokens.css is out of date
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TOKENS_JSON = path.join(root, 'design-system/tokens.json');
export const TOKENS_CSS = path.join(root, 'css/tokens.css');
const PLAIN_FAMILIES = ['spacing', 'radius', 'size', 'opacity', 'duration', 'easing', 'zIndex'];

// A colour may alias another colour token as "{name}"
const cssValue = v => String(v).replace(/^\{([A-Za-z0-9_.-]+)\}$/, 'var(--$1)');
const valueFor = (token, theme, first) =>
  typeof token.value === 'string' ? (theme === first ? token.value : undefined) : token.value[theme];

function block(selector, decls, indent = '') {
  if (!decls.length) return '';
  return `${indent}${selector} {\n${decls.map(d => `${indent}  ${d}`).join('\n')}\n${indent}}\n`;
}

export function buildTokensCss(tokens) {
  const themes = tokens.color.themes.map(t => t.id);
  const [first] = themes;
  for (const id of ['light', 'dark', 'print']) {
    if (!themes.includes(id)) throw new Error(`tokens.json must define the ${id} theme`);
  }
  if (first !== 'light') throw new Error('tokens.json must list the light theme first');
  const themed = [...tokens.color.tokens, ...(tokens.shadow?.tokens ?? [])];
  const decls = theme => themed
    .filter(t => valueFor(t, theme, first) !== undefined)
    .map(t => `--${t.name}: ${cssValue(valueFor(t, theme, first))};`);

  const plain = PLAIN_FAMILIES.flatMap(f => (tokens[f]?.tokens ?? []).map(t => `--${t.name}: ${t.value};`));
  const fonts = Object.entries(tokens.type?.families ?? {}).map(([key, stack]) => `--font-${key}: ${stack};`);
  const dark = decls('dark');

  return `/* ${tokens.name} design tokens, generated from design-system/tokens.json by
   scripts/build-tokens.mjs. Do not edit: change tokens.json and run the script. */

${block(':root', [...decls('light'), ...plain, ...fonts])}
@media (prefers-color-scheme: dark) {
${block(':root:not([data-theme="light"])', dark, '  ')}}

${block(':root[data-theme="dark"]', dark)}
@media print {
${block(':root, :root[data-theme]', decls('print'), '  ')}}
`;
}

export function readTokens(file = TOKENS_JSON) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const css = buildTokensCss(readTokens());
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(TOKENS_CSS) ? fs.readFileSync(TOKENS_CSS, 'utf8') : '';
    if (current !== css) {
      console.error('css/tokens.css is out of date. Run: node scripts/build-tokens.mjs');
      process.exit(1);
    }
    console.log('css/tokens.css matches design-system/tokens.json');
  } else {
    fs.writeFileSync(TOKENS_CSS, css);
    console.log(`Wrote ${path.relative(root, TOKENS_CSS)}`);
  }
}
