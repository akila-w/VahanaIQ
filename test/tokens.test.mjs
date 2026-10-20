import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTokensCss, readTokens, TOKENS_CSS } from '../scripts/build-tokens.mjs';

const tokens = readTokens();
const tokensCss = fs.readFileSync(TOKENS_CSS, 'utf8');
const style = fs.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.equal(tokensCss, buildTokensCss(tokens), 'css/tokens.css is out of date: run node scripts/build-tokens.mjs');

// Every custom property the stylesheet reads must come from the design tokens
const defined = new Set([...tokensCss.matchAll(/--([A-Za-z0-9_.-]+):/g)].map(m => m[1]));
const used = new Set([...style.matchAll(/var\(--([A-Za-z0-9_.-]+)/g)].map(m => m[1]));
for (const name of used) assert.ok(defined.has(name), `css/style.css reads --${name}, which design-system/tokens.json does not define`);

// tokens.json is the only place theme values are set
assert.doesNotMatch(style, /^\s*--[A-Za-z0-9_.-]+\s*:/m, 'css/style.css must not declare custom properties; add them to design-system/tokens.json');

// Token names are unique across families, and every theme has the values the app relies on
const names = ['color', 'shadow', 'spacing', 'radius', 'size', 'opacity', 'duration', 'easing', 'zIndex', 'breakpoint'].flatMap(f => (tokens[f]?.tokens ?? []).map(t => t.name));
assert.equal(new Set(names).size, names.length, 'design token names must be unique');
const color = Object.fromEntries(tokens.color.tokens.map(t => [t.name, t.value]));
for (const name of ['bg', 'panel', 'ink', 'mute', 'line', 'accent', 'bad', 'ok-ink', 'mid-ink']) {
  for (const theme of ['light', 'dark', 'print']) assert.ok(color[name]?.[theme], `--${name} needs a ${theme} value`);
}

// Dark mode follows the OS unless the toggle picked light; print overrides any toggle
assert.match(tokensCss, /@media \(prefers-color-scheme: dark\) \{\n  :root:not\(\[data-theme="light"\]\) \{/);
assert.match(tokensCss, /:root\[data-theme="dark"\] \{/);
assert.match(tokensCss, /@media print \{\n  :root, :root\[data-theme\] \{/);

// Markup is styled through classes; only values computed at runtime (a bar's width, the tick's position) stay inline
const jsFiles = fs.readdirSync(new URL('../js/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => `js/${f}`);
for (const file of ['index.html', ...jsFiles]) {
  const text = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const [, decls] of text.matchAll(/style="([^"]*)"/g)) {
    for (const decl of decls.split(';').map(d => d.trim()).filter(Boolean)) {
      assert.match(decl, /^(width|left):\$\{[^}]+\}%$/, `${file} sets an inline style (${decl}); add a class to css/style.css`);
    }
  }
  assert.doesNotMatch(text, /\.style\.[A-Za-z]+\s*=/, `${file} sets element.style; toggle hidden or a class instead`);
}

// The page loads the tokens before the stylesheet that reads them
const tokensLink = html.indexOf('href="css/tokens.css?v=2.10.1"');
assert.ok(tokensLink > -1, 'index.html must load css/tokens.css');
assert.ok(tokensLink < html.indexOf('href="css/style.css?v=2.10.1"'), 'css/tokens.css must load before css/style.css');

console.log('Design token checks passed');
