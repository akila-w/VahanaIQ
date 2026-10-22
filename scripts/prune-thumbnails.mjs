// Keeps assets/images/review-thumbnails to exactly the images the site uses.
//
// The review library is generated for every official photo candidate (2,614 files), but
// js/official-photo-data.js only ever references the 140 that were chosen as covers. Committing
// the rest added ~56 MB of dead weight, so only the referenced subset is kept. Regenerating the
// library (scripts/optimise-review-photos.py) writes all of them again, so run this afterwards.
//
//   node scripts/prune-thumbnails.mjs            # delete the unreferenced files
//   node scripts/prune-thumbnails.mjs --check     # report only; exits 1 if any are unreferenced
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = "assets/images/review-thumbnails";
const checkOnly = process.argv.includes("--check");

// Files that can reference a thumbnail: the generated photo data, plus anything else shipped.
const SOURCES = [
  "js/official-photo-data.js", "js/photo-credits.js", "js/image-fetcher.js", "js/market-catalogue.js",
  "js/catalogue-data.js", "js/identity-data.js", "sw.js", "manifest.json",
  "index.html", "catalogue.html", "about.html", "privacy.html", "terms.html"
];

const referenced = new Set();
for (const file of SOURCES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  for (const m of fs.readFileSync(full, "utf8").matchAll(/review-thumbnails\/([a-f0-9]+\.webp)/g)) referenced.add(m[1]);
}

const dir = path.join(ROOT, DIR);
if (!fs.existsSync(dir)) { console.error(`${DIR} is missing`); process.exit(1); }
const present = fs.readdirSync(dir).filter(f => f.endsWith(".webp"));
const unreferenced = present.filter(f => !referenced.has(f));
const missing = [...referenced].filter(f => !present.includes(f));

// A referenced-but-absent image would 404 in the app, so that is always a failure.
if (missing.length) {
  console.error(`${missing.length} referenced thumbnail(s) are missing:`);
  for (const f of missing.slice(0, 10)) console.error(`  ${DIR}/${f}`);
  process.exit(1);
}

console.log(`${present.length} thumbnails present; ${referenced.size} referenced`);
if (!unreferenced.length) {
  console.log("Nothing to prune: every thumbnail is referenced by the site.");
  process.exit(0);
}
if (checkOnly) {
  console.error(`${unreferenced.length} unreferenced thumbnail(s) present, totalling ` +
    `${(unreferenced.reduce((t, f) => t + fs.statSync(path.join(dir, f)).size, 0) / 1048576).toFixed(1)} MB. ` +
    "Run: node scripts/prune-thumbnails.mjs");
  process.exit(1);
}
for (const f of unreferenced) fs.rmSync(path.join(dir, f));
console.log(`Pruned ${unreferenced.length} unreferenced thumbnail(s). ${referenced.size} remain.`);