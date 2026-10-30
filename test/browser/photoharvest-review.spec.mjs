// End-to-end, offline-fixture-only PhotoHarvest -> VahanaIQ review test.
// Playwright drives the actual Studio UI; the Python importer builds each bundle.
// No websites are crawled, no photos are approved or published.
import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { offlineServer } from "./offline-server.mjs";
import { seedReturning } from "./returning-user.mjs";

test.use({ serviceWorkers: "block" });
test.setTimeout(60_000);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOGUE = JSON.parse(await readFile(path.join(ROOT, "data/catalogue.json"), "utf8"));
const MODELS = [...CATALOGUE.models].sort((a, b) => a.name.localeCompare(b.name));
const FIRST = MODELS[0].id;
const SECOND = MODELS.find(model => model.id !== FIRST).id;
const SEED = "https://fixture.example/vehicles";
const IMAGE_URL = "https://cdn.fixture.example/original.png";

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(kind, payload) {
  const type = Buffer.from(kind);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(Buffer.concat([type, payload])));
  return Buffer.concat([length, type, payload, sum]);
}

// Small deterministic *valid* 1024x720 RGB PNG, not a real copyrighted car photo.
function makePng() {
  const width = 1024, height = 720;
  const rows = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 3);
    for (let x = 0; x < width; x++) {
      const i = offset + 1 + x * 3;
      rows[i] = (x * 17 + y * 3) & 255;
      rows[i + 1] = (x * 5 + y * 11) & 255;
      rows[i + 2] = (x * 7 + y * 13) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PNG = makePng();
const DIGEST = createHash("sha256").update(PNG).digest("hex");
let site;
const scratch = [];

test.beforeEach(async ({ context }) => {
  site = await offlineServer();
  await seedReturning(context);
  await context.route(/^https:\/\//, route => route.abort());
});
test.afterEach(async () => {
  if (site) await site.close();
  for (const folder of scratch.splice(0)) await rm(folder, { recursive: true, force: true });
});

async function createReview(modelId, { corrupted = false, incomplete = false, unsafeName = false } = {}) {
  const base = await mkdtemp(path.join(tmpdir(), "photoharvest-fixture-"));
  scratch.push(base);
  const input = path.join(base, "acquired");
  const output = path.join(base, "review-bundle");
  await mkdir(input);
  const filename = "001_vehicle.png";
  const imagePath = path.join(input, filename);
  await writeFile(imagePath, PNG);
  const acquired = {
    manifestVersion: 1,
    kind: "photoharvest-acquisition",
    tool: "PhotoHarvest",
    seedUrl: SEED,
    status: incomplete ? "in-progress" : "completed",
    images: [{
      filename: unsafeName ? "../escape.png" : filename,
      sha256: DIGEST,
      bytes: PNG.length,
      width: 1024,
      height: 720,
      sourcePageUrl: SEED,
      requestedImageUrl: IMAGE_URL,
      resolvedImageUrl: IMAGE_URL,
      sourceKind: "web-url",
      deliveryMethod: "playwright-request",
      acquiredAt: "2026-10-30T00:00:00Z",
      contentType: "image/png",
      reviewStatus: "pending",
      rightsStatus: "unverified",
    }],
  };
  await writeFile(path.join(input, "photoharvest-manifest.json"), JSON.stringify(acquired));
  const args = [
    path.join(ROOT, "scripts/import-photoharvest.py"), "--input-dir", input,
    "--model-id", modelId, "--output-dir", output, "--source-page", SEED,
  ];
  if (incomplete || unsafeName) {
    let failed = false;
    try { execFileSync("python3", args, { cwd: ROOT, stdio: "pipe" }); }
    catch { failed = true; }
    expect(failed).toBe(true);
    return null;
  }
  execFileSync("python3", args, { cwd: ROOT, stdio: "pipe" });
  if (corrupted) {
    const target = path.join(output, "images", DIGEST.slice(0, 24) + ".png");
    await writeFile(target, Buffer.concat([PNG, Buffer.from("tampered")]));
  }
  return output;
}

async function openStudio(page, mount = "") {
  const failures = [];
  page.on("pageerror", error => failures.push(error.message));
  await page.goto(site.origin + mount + "/studio.html");
  await expect(page.locator("#editorWork")).toBeVisible();
  await expect(page.locator("#harvestFolder")).toBeAttached();
  expect((await page.evaluate(() => location.hash)).includes(FIRST)).toBe(true);
  expect(failures).toEqual([]);
}

for (const mount of ["", "/VahanaIQ"]) {
  test("verified synthetic acquisition previews locally at " + (mount || "/"), async ({ page }) => {
    const review = await createReview(FIRST);
    await openStudio(page, mount);
    const original = await page.locator("#filmstrip .film").count();
    await page.locator("#harvestFolder").setInputFiles(review);
    await expect(page.locator("#harvestSummary")).toContainText("1 candidate photo(s)");
    await expect(page.locator("#harvestCandidates img")).toHaveCount(1);
    const image = page.locator("#harvestCandidates img");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBe(1024);
    await expect(page.locator("#harvestCandidates")).toContainText(IMAGE_URL);
    await expect(page.locator("#harvestCandidates")).toContainText("rights unverified");
    expect(await page.locator("#filmstrip .film").count()).toBe(original);
    const edits = await page.evaluate(async () => {
      const { readEdits } = await import("./js/catalogue-photo-store.js?v=2.12.0");
      return await readEdits();
    });
    expect(edits).toEqual([]);
    await page.locator("#exportBtn").click();
    await expect(page.locator("#exportDownload")).toBeDisabled();
    await page.locator("#exportClose").click();
    await page.locator("#harvestClear").click();
    await expect(page.locator("#harvestReview")).toBeHidden();
    await expect(page.locator("#harvestCandidates img")).toHaveCount(0);
  });
}

test("tampered review image is refused before previews appear", async ({ page }) => {
  const review = await createReview(FIRST, { corrupted: true });
  await openStudio(page);
  await page.locator("#harvestFolder").setInputFiles(review);
  await expect(page.locator("#harvestSummary")).toContainText("Review refused");
  await expect(page.locator("#harvestSummary")).toContainText("modified reviewed image");
  await expect(page.locator("#harvestCandidates img")).toHaveCount(0);
});

test("review bundle for another model is refused", async ({ page }) => {
  const review = await createReview(SECOND);
  await openStudio(page);
  await page.locator("#harvestFolder").setInputFiles(review);
  await expect(page.locator("#harvestSummary")).toContainText("Review refused");
  await expect(page.locator("#harvestCandidates img")).toHaveCount(0);
});

test("interrupted or path-traversing acquisition is refused by importer", async () => {
  expect(await createReview(FIRST, { incomplete: true })).toBeNull();
  expect(await createReview(FIRST, { unsafeName: true })).toBeNull();
});
