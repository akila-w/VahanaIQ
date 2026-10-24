// Publishes the photos arranged in the Photo Studio. The studio exports one JSON file with the framed
// pixels already drawn (both the 1280x800 card image and its 640x400 thumbnail), so this script needs
// no image library: it writes the files, then updates data/catalogue.json and js/catalogue-data.js
// together, so the two can never drift (test/catalogue-data.test.mjs checks that they agree).
//
//   node scripts/apply-studio-photos.mjs vahanaiq-studio-photos-2026-10-23.json
//   node scripts/apply-studio-photos.mjs export.json --dry-run
//   node scripts/apply-studio-photos.mjs export.json --root /tmp/catalogue-copy
//
// Nothing is committed and nothing is pushed: review the diff, then commit it yourself.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { manifestProblems, UPLOAD } from "../js/catalogue-photos.js";

const IMAGE_DIR = "assets/images/curated-catalogue";
const SAFE_FILE = /^[a-z0-9][a-z0-9-]*\.jpg$/;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readArguments(argv) {
  const args = { file: null, root: ROOT, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--dry-run") args.dryRun = true;
    else if (value === "--root") args.root = path.resolve(argv[++i] || "");
    else if (value === "--help" || value === "-h") args.help = true;
    else if (value.startsWith("--")) throw new Error(`Unknown option: ${value}`);
    else if (!args.file) args.file = path.resolve(value);
    else throw new Error(`Unexpected argument: ${value}`);
  }
  return args;
}

const USAGE = `Usage: node scripts/apply-studio-photos.mjs <export.json> [--root <folder>] [--dry-run]

  <export.json>  The file downloaded from the Photo Studio page.
  --root         The catalogue to update (default: this checkout).
  --dry-run      Report what would change without writing anything.`;

function decodeJpeg(dataUrl, label) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) throw new Error(`${label} is not a base64 JPEG.`);
  const bytes = Buffer.from(match[1], "base64");
  // A JPEG starts with FF D8 and ends with FF D9, so a truncated export is caught here.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new Error(`${label} is not a complete JPEG.`);
  }
  return bytes;
}

// The published entry for one studio photo, in the shape the catalogue page already reads.
function catalogueImage(image, photo, generatedOn) {
  const owner = image.kind === UPLOAD;
  return {
    sha256: photo.large.sha256,
    sourceSha256: owner ? undefined : (image.sha256 || undefined),
    url: owner ? undefined : (image.url || undefined),
    sourcePage: owner ? undefined : (image.sourcePage || undefined),
    width: 1280,
    height: 800,
    src: `${IMAGE_DIR}/${image.file}`,
    smallSrc: `${IMAGE_DIR}/${image.smallFile}`,
    caption: owner ? (image.name ? `Owner Photo · ${image.name}` : "Owner Photo") : (image.caption || "Manufacturer Image"),
    origin: owner ? "owner-upload" : "official-reframe",
    frame: image.frame,
    reviewedOn: generatedOn,
    aspectRatio: "8:5",
    note: owner
      ? "A photo supplied by the site owner, kept in the Photo Studio. It is not a manufacturer image."
      : "Framed in the VahanaIQ Photo Studio."
  };
}

// undefined values are dropped, so an owner photo carries no claim about an official source.
const clean = value => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

function loadManifest(file) {
  if (!file) throw new Error("Give the path to the Photo Studio export.");
  if (!fs.existsSync(file)) throw new Error(`No such file: ${file}`);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`The export is not valid JSON: ${error.message}`);
  }
  const problems = manifestProblems(manifest);
  if (manifest?.manifestVersion !== 1) problems.push(`Unsupported export version: ${manifest?.manifestVersion ?? "none"}.`);
  for (const model of manifest?.models || []) {
    const files = (model.images || []).flatMap(image => [image.file, image.smallFile]);
    for (const file of files) {
      if (!SAFE_FILE.test(String(file))) problems.push(`${model.modelId || "An entry"} names an unsafe file: ${file}`);
    }
  }
  if (problems.length) throw new Error(`The export cannot be applied:\n  - ${problems.join("\n  - ")}`);
  return manifest;
}

function writeCatalogueData(root, catalogue) {
  const file = path.join(root, "js/catalogue-data.js");
  if (!fs.existsSync(file)) throw new Error(`Missing ${path.relative(ROOT, file)}; is --root pointing at a checkout?`);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const index = lines.findIndex(line => line.startsWith("window.__VAHANAIQ_CATALOGUE__ = "));
  if (index < 0) throw new Error("js/catalogue-data.js does not define window.__VAHANAIQ_CATALOGUE__ (re-run scripts/build-curated-catalogue.py).");
  // The identity line beside it is left exactly as it is.
  lines[index] = `window.__VAHANAIQ_CATALOGUE__ = ${JSON.stringify(catalogue)};`;
  fs.writeFileSync(file, lines.join("\n"));
}

function main() {
  const args = readArguments(process.argv.slice(2));
  if (args.help) { console.log(USAGE); return; }
  const manifest = loadManifest(args.file);
  const catalogueFile = path.join(args.root, "data/catalogue.json");
  if (!fs.existsSync(catalogueFile)) throw new Error(`Missing ${catalogueFile}; is --root pointing at a checkout?`);
  const catalogue = JSON.parse(fs.readFileSync(catalogueFile, "utf8"));
  const generatedOn = String(manifest.generatedAt || new Date().toISOString()).slice(0, 10);
  const written = [];
  const changed = [];

  for (const entry of manifest.models) {
    const model = (catalogue.models || []).find(item => item.id === entry.modelId);
    if (!model) throw new Error(`The catalogue has no entry with the id ${entry.modelId}.`);
    const images = [];
    for (const [index, image] of entry.images.entries()) {
      const large = { bytes: decodeJpeg(image.encoded.large, `${entry.modelId} photo ${index + 1}`) };
      const small = { bytes: decodeJpeg(image.encoded.small, `${entry.modelId} photo ${index + 1} thumbnail`) };
      large.sha256 = crypto.createHash("sha256").update(large.bytes).digest("hex");
      for (const [file, part] of [[image.file, large], [image.smallFile, small]]) {
        written.push({ file: `${IMAGE_DIR}/${file}`, bytes: part.bytes.length });
        if (!args.dryRun) {
          const target = path.join(args.root, IMAGE_DIR, file);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, part.bytes);
        }
      }
      images.push(clean(catalogueImage(image, { large }, generatedOn)));
    }
    if (!images.length) throw new Error(`${entry.modelId} would end up with no photos.`);
    const before = (model.images || []).map(image => image.src).join(",");
    const after = images.map(image => image.src).join(",");
    if (before !== after) changed.push(`${entry.modelId}: ${(model.images || []).length} photo(s) -> ${images.length}`);
    model.images = images;
  }

  if (!args.dryRun) {
    fs.writeFileSync(catalogueFile, JSON.stringify(catalogue, null, 2));
    writeCatalogueData(args.root, catalogue);
  }

  const total = written.reduce((sum, file) => sum + file.bytes, 0);
  console.log(`${args.dryRun ? "Would write" : "Wrote"} ${written.length} image file(s) (${(total / 1024 / 1024).toFixed(1)} MB) for ${manifest.models.length} catalogue entr${manifest.models.length === 1 ? "y" : "ies"}.`);
  for (const line of changed) console.log(`  changed ${line}`);
  for (const file of written) console.log(`  ${args.dryRun ? "would write" : "wrote"} ${file.file} (${Math.round(file.bytes / 1024)} KB)`);
  if (!args.dryRun) {
    console.log(`Updated ${path.relative(args.root, catalogueFile) || "data/catalogue.json"} and `
      + `${path.relative(args.root, path.join(args.root, "js/catalogue-data.js"))} in ${args.root}`);
    console.log("Review the diff, then commit. Run: node test/catalogue-data.test.mjs");
  }
}

try {
  main();
} catch (error) {
  console.error(String(error.message || error));
  process.exitCode = 1;
}