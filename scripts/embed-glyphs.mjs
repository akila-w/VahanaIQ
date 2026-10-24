import fs from 'node:fs';
import path from 'node:path';

const ICONS_DIR = 'assets/icons/lucide';
const STYLE_CSS = 'css/style.css';

const files = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.svg')).sort();
console.log(`Found ${files.length} SVG icons in ${ICONS_DIR}`);

const glyphRules = files.map(file => {
  const name = path.basename(file, '.svg');
  let svg = fs.readFileSync(path.join(ICONS_DIR, file), 'utf8');
  // Replace stroke="currentColor" with stroke="black" for full alpha in CSS masks
  svg = svg.replace(/stroke="currentColor"/g, 'stroke="black"');
  // Collapse whitespace
  svg = svg.replace(/\s+/g, ' ').trim();
  const encoded = encodeURIComponent(svg);
  const dataUri = `data:image/svg+xml,${encoded}`;
  return `.glyph-${name} { mask-image: url("${dataUri}"); -webkit-mask-image: url("${dataUri}"); }`;
});

let style = fs.readFileSync(STYLE_CSS, 'utf8');

// Remove trailing .glyph-circle-help and .glyph-trash-2 if they are around lines 1990+
style = style.replace(/\n\.glyph-circle-help\s*\{[^}]+\}/g, '');
style = style.replace(/\n\.glyph-trash-2\s*\{[^}]+\}/g, '');

// Find the block of existing glyph rules
const firstGlyphIndex = style.indexOf('.glyph-search {');
const lastGlyphTarget = '.glyph-bookmark { mask-image: url("../assets/icons/lucide/bookmark.svg"); -webkit-mask-image: url("../assets/icons/lucide/bookmark.svg"); }';
let lastGlyphIndex = style.indexOf(lastGlyphTarget);
if (lastGlyphIndex === -1) {
  // Try regex
  const match = style.match(/\.glyph-[a-z0-9-]+\s*\{[^}]+\}/g);
  console.log('Matches found:', match ? match.length : 0);
  throw new Error('Could not locate existing glyph block');
}

const glyphBlockReplacement = glyphRules.join('\n');
style = style.slice(0, firstGlyphIndex) + glyphBlockReplacement + '\n' + style.slice(lastGlyphIndex + lastGlyphTarget.length);

fs.writeFileSync(STYLE_CSS, style, 'utf8');
console.log(`Successfully embedded ${glyphRules.length} glyphs as data URIs in ${STYLE_CSS}`);
