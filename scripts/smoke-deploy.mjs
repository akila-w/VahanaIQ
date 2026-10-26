// Confirms the published site really is the release in this checkout. Run it after a deploy, or
// let .github/workflows/smoke-deploy.yml run it on every push to main. It also proves the working
// folders that _config.yml excludes (docs/, test/, scripts/) are not being served.
//
//   node scripts/smoke-deploy.mjs
//   SITE_URL=http://127.0.0.1:8765 SMOKE_ATTEMPTS=1 node scripts/smoke-deploy.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.SITE_URL || "https://akila-w.github.io/VahanaIQ").replace(/\/+$/, "");
const ATTEMPTS = Number(process.env.SMOKE_ATTEMPTS || 12);
const DELAY_MS = Number(process.env.SMOKE_DELAY_MS || 15000);

const version = fs.readFileSync(path.join(ROOT, "js/config.js"), "utf8").match(/APP_VERSION = "([^"]+)"/)?.[1];
if (!version) { console.error("Could not read APP_VERSION from js/config.js"); process.exit(1); }

const PAGES = ["catalogue.html", "studio.html", "about.html", "privacy.html", "terms.html"];
const ASSETS = [
  "css/tokens.css", "css/style.css", "css/style.min.css", "css/curated-catalogue.css", "css/catalogue-studio.css", "js/app.js", "js/config.js",
  "js/catalogue-data.js", "js/curated-catalogue.js", "js/catalogue-studio.js", "js/catalogue-photo-overlay.js",
  "js/catalogue-photos.js", "js/catalogue-photo-store.js", "js/photo-frame.js", "js/official-photo-data.js", "sw.js",
  "manifest.json", "sitemap.xml", "robots.txt", "data/catalogue.json", "data/identity.json",
  "assets/icons/favicon.svg", "assets/icons/og-image.png",
  "assets/icons/logo-v-mark-transparent-light.svg", "assets/icons/logo-v-mark-transparent-dark.svg"
];
const BLOCKED = [
  "docs/catalogue-review.html", "docs/catalogue-rebuild/catalogue.json", "docs/photo-review.html",
  "docs/catalogue-rebuild/sources", "test/verify.mjs", "scripts/apply-studio-photos.mjs",
  "scripts/smoke-deploy.mjs", "serverless/gcp-cloud-function/index.js", "README.md", "firestore.rules",
  "design-system/tokens.json", ".github/workflows/test.yml", "_config.yml",
  // A Photo Studio export carries photo pixels inline, so it must never be served.
  "vahanaiq-studio-photos-2026-10-23.json"
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async url => {
  try {
    const res = await fetch(url, { redirect: "follow" });
    return { status: res.status, text: await res.text(), type: res.headers.get("content-type") || "" };
  } catch (e) { return { status: 0, text: "", type: "", error: String(e) }; }
};

const failures = [];
const note = (ok, label, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures.push(label);
};

// Wait for the release marker, since Pages takes a minute or two to build.
let deployed = false;
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const index = await get(`${BASE}/`);
  if (index.status === 200 && index.text.includes(`app.js?v=${version}`)) { deployed = true; break; }
  console.log(`waiting for ${version} to be served (attempt ${attempt}/${ATTEMPTS}, HTTP ${index.status})`);
  if (attempt < ATTEMPTS) await sleep(DELAY_MS);
}
if (!deployed) {
  console.error(`\nTimed out waiting for version ${version} at ${BASE}`);
  process.exit(1);
}

console.log(`\nChecking ${BASE} serves ${version}\n`);
const index = await get(`${BASE}/`);
note(index.status === 200, "GET / is 200", `HTTP ${index.status}`);
note(index.text.includes(`style.min.css?v=${version}`), `index.html requests style.min.css?v=${version}`);
note(index.text.includes(`tokens.css?v=${version}`), `index.html requests tokens.css?v=${version}`);
note(!/["'(]\.?\/?docs\//.test(index.text), "index.html does not link the unpublished docs/ tree");
note(/<h1[^>]*>/.test(index.text), "index.html renders a heading");
note(!/\{\{\s*[a-z]+\s*\}\}/i.test(index.text), "index.html has no unrendered template placeholders");

for (const page of PAGES) {
  const res = await get(`${BASE}/${page}`);
  note(res.status === 200 && res.text.includes("<html"), `GET ${page} is 200`, `HTTP ${res.status}`);
  note(!/["'(]\.?\/?docs\//.test(res.text), `${page} does not link the unpublished docs/ tree`);
}
for (const asset of ASSETS) {
  const res = await get(`${BASE}/${asset}`);
  note(res.status === 200, `GET ${asset} is 200`, `HTTP ${res.status}`);
}
for (const blocked of BLOCKED) {
  const res = await get(`${BASE}/${blocked}`);
  note(res.status === 404, `not published: ${blocked}`, `HTTP ${res.status}`);
}

// The catalogue page's images must actually resolve, not just the JSON that names them.
const data = await get(`${BASE}/data/catalogue.json`);
if (data.status === 200) {
  try {
    const catalogue = JSON.parse(data.text);
    const sample = catalogue.models.find(m => m.images?.length)?.images[0];
    note(catalogue.models.length >= 100, `data/catalogue.json lists ${catalogue.models.length} models`);
    if (sample) {
      const image = await get(`${BASE}/${sample.smallSrc}`);
      note(image.status === 200 && image.type.startsWith("image/"), `sample catalogue image resolves: ${sample.smallSrc}`,
        `HTTP ${image.status} ${image.type}`);
    }
  } catch (e) { note(false, "data/catalogue.json is valid JSON", String(e)); }
} else {
  note(false, "data/catalogue.json is published", `HTTP ${data.status}`);
}

// robots.txt must not invite crawlers into the excluded working folders.
const robots = await get(`${BASE}/robots.txt`);
note(robots.text.includes("Disallow: /docs/"), "robots.txt disallows /docs/");

if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nDeploy smoke test passed: ${version} is live at ${BASE}`);