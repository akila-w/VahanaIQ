// The catalogue page renders from js/catalogue-data.js and falls back to data/catalogue.json.
// This fails if those two ever disagree, if a referenced image is missing, or if a shipped file
// still reaches into the docs/ tree that _config.yml keeps off the published site.
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const href = file => new URL(`../${file}`, import.meta.url);
const abs = file => fileURLToPath(href(file));
const readJson = file => JSON.parse(fs.readFileSync(href(file), "utf8"));

// runInThisContext keeps the host realm, so deepStrictEqual can compare prototypes: objects made
// inside vm.createContext carry that context's Object.prototype and would never compare equal.
globalThis.window = {};
vm.runInThisContext(fs.readFileSync(href("js/catalogue-data.js"), "utf8"));
const baked = { catalogue: globalThis.window.__VAHANAIQ_CATALOGUE__, identity: globalThis.window.__VAHANAIQ_IDENTITY__ };
delete globalThis.window;
assert.ok(baked.catalogue, "js/catalogue-data.js must define window.__VAHANAIQ_CATALOGUE__");
assert.ok(baked.identity, "js/catalogue-data.js must define window.__VAHANAIQ_IDENTITY__");

const catalogue = readJson("data/catalogue.json");
const identity = readJson("data/identity.json");
assert.deepEqual(baked.catalogue, catalogue,
  "js/catalogue-data.js has drifted from data/catalogue.json; re-run scripts/build-curated-catalogue.py");
assert.deepEqual(baked.identity, identity,
  "js/catalogue-data.js has drifted from data/identity.json; re-run scripts/build-curated-catalogue.py");

assert.ok(catalogue.models.length >= 100, "Guard against publishing an incomplete catalogue");
assert.match(catalogue.checkedOn, /^\d{4}-\d{2}-\d{2}$/, "The catalogue must state when it was checked");
assert.ok(catalogue.models.every(m => /^[a-z0-9-]+$/.test(m.id)), "Every model needs a stable id");
assert.ok(Object.keys(identity.brands || {}).length >= 10, "Brand marks must be available for the cards");

// Every image the page can show must be in the published tree, so nothing 404s in production.
let images = 0;
for (const model of catalogue.models) {
  assert.ok(model.images.length, `${model.id} has no gallery images`);
  for (const image of model.images) {
    for (const key of ["src", "smallSrc"]) {
      assert.match(image[key], /^assets\/images\/curated-catalogue\//,
        `${model.id} ${key} must live in the published image tree`);
      assert.ok(fs.existsSync(abs(image[key])), `Missing image for ${model.id}: ${image[key]}`);
      images++;
    }
  }
  for (const offer of model.offers) {
    if (!offer.image) continue;
    assert.ok(fs.existsSync(abs(offer.image.smallSrc)), `Missing variant image: ${offer.image.smallSrc}`);
  }
}
for (const group of [identity.brands, identity.models]) {
  for (const [key, entry] of Object.entries(group || {})) {
    if (!entry.localPath) continue;
    const file = entry.localPath.replace(/^\.\.\//, "");
    assert.match(file, /^assets\/identity\//, `${key} must point into the published identity tree`);
    assert.ok(fs.existsSync(abs(file)), `Missing brand mark for ${key}: ${file}`);
  }
}

// A page that still reached into docs/ would 404 once docs/ is excluded from the build.
for (const file of ["index.html", "catalogue.html", "studio.html", "about.html", "privacy.html", "terms.html", "sw.js",
  "js/curated-catalogue.js", "js/catalogue-studio.js", "js/catalogue-photo-overlay.js", "js/catalogue-photos.js",
  "js/catalogue-photo-store.js", "js/photo-frame.js"]) {
  assert.ok(!/["'(]\.?\/?docs\//.test(fs.readFileSync(href(file), "utf8")),
    `${file} must not reference the unpublished docs/ tree`);
}

// The catalogue page must render from the baked copy, with the JSON only as a fallback/download.
const page = fs.readFileSync(href("catalogue.html"), "utf8");
assert.match(page, /src="js\/catalogue-data\.js/, "catalogue.html must load the baked catalogue data");
assert.match(page, /href="data\/catalogue\.json"/, "catalogue.html must link the published catalogue data");
assert.ok(fs.existsSync(abs("_config.yml")), "The published build must be configured to exclude working folders");
assert.ok(!fs.existsSync(abs(".nojekyll")), ".nojekyll would disable Jekyll and publish the working folders");

console.log(`Catalogue data: ${catalogue.models.length} models, ${images} gallery images and ` +
  `${Object.keys(identity.brands || {}).length} brand marks agree with js/catalogue-data.js; no shipped file uses docs/`);