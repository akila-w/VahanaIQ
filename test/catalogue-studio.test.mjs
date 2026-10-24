// The Photo Studio's frame geometry, its catalogue records and the export the bake script applies.
// Pure logic is checked directly; scripts/apply-studio-photos.mjs is run against a throwaway copy of
// the catalogue, so a bad export cannot touch the real data.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  defaultFrame, isDefaultFrame, normaliseFrame, zoomRange, clampZoom, backgroundKind, resolveMode,
  detectTrimBox, sceneCropBox, plateLayout, sceneLayout, layoutFor, dragFrame, zoomFrame, fillFrame,
  FRAME_WIDTH, FRAME_HEIGHT, FRAME_RATIO
} from "../js/photo-frame.js";
import {
  OFFICIAL, UPLOAD, officialItems, newRecord, uploadItem, normaliseRecord, orderedItems, setCover,
  moveItem, removeItem, addItem, updateFrame, resetFrame, recordIsEdited, editedModelIds, buildManifest,
  manifestFileName, manifestProblems, fileNameFor, officialKey
} from "../js/catalogue-photos.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHA = "a".repeat(64);
const close = (value, expected, tolerance = 0.01) =>
  assert.ok(Math.abs(value - expected) <= tolerance, `expected ${value} to be within ${tolerance} of ${expected}`);

// ---------------------------------------------------------------- frames

assert.deepEqual(defaultFrame(), { zoom: 1, focusX: 0.5, focusY: 0.5, mode: "auto" });
assert.ok(isDefaultFrame({}), "An empty frame is the default frame");
assert.deepEqual(normaliseFrame({ zoom: 99, focusX: -5, focusY: 40, mode: "nonsense" }),
  { zoom: 3, focusX: 0, focusY: 1, mode: "auto" }, "A frame is clamped and its mode falls back");
assert.equal(normaliseFrame({ mode: "scene", zoom: 0.2 }).zoom, 1, "A scene crop cannot be smaller than the frame");
assert.equal(normaliseFrame({ mode: "plate", zoom: 0.2 }).zoom, 0.5, "A plate may shrink to half size");
assert.deepEqual(zoomRange("scene"), { min: 1, max: 3 });
assert.deepEqual(zoomRange("auto"), { min: 0.5, max: 3 });
assert.equal(clampZoom("auto", 0.1), 0.5);

// 1920x1440 is 4:3, so an 8:5 window is 1920x1200 with 120 pixels to move over.
const wide = { width: 1920, height: 1440 };
assert.deepEqual(sceneCropBox(wide, { zoom: 1, focusX: 0.5, focusY: 0.5 }),
  { x: 0, y: 120, width: 1920, height: 1200 }, "At zoom 1 the scene crop is a centred fit");
assert.deepEqual(sceneCropBox(wide, { zoom: 2, focusX: 0.5, focusY: 0.5 }),
  { x: 480, y: 420, width: 960, height: 600 }, "Zoom 2 halves the window");
assert.deepEqual(sceneCropBox(wide, { zoom: 2, focusX: 0, focusY: 0 }), { x: 0, y: 0, width: 960, height: 600 });
assert.deepEqual(sceneCropBox(wide, { zoom: 2, focusX: 1, focusY: 1 }), { x: 960, y: 840, width: 960, height: 600 });
const tall = sceneCropBox({ width: 800, height: 1200 }, defaultFrame());
assert.equal(tall.width, 800);
close(tall.height, 500);
close(tall.y, 350);

// The plate keeps a photo smaller than the plate whole, centred, at zoom 1.
const plate = plateLayout({ width: 1000, height: 500 }, null, defaultFrame());
assert.deepEqual(plate.plate, { width: 1160, height: 580 });
assert.deepEqual(plate.dest, { x: 60, y: 110, width: 1160, height: 580 });
assert.deepEqual(plate.source.x, 0);
assert.deepEqual(plate.source.y, 0);
close(plate.source.width, 1000, 0.001);
close(plate.source.height, 500, 0.001);

// Zooming the plate past the frame trims it around the focus point.
const trimmed = plateLayout(wide, { x: 100, y: 50, width: 800, height: 400 }, { zoom: 2, mode: "plate" });
assert.deepEqual(trimmed.dest, { x: 0, y: 0, width: FRAME_WIDTH, height: FRAME_HEIGHT });
assert.deepEqual(trimmed.overflow, { x: 1040, y: 360 });
close(trimmed.source.x, 100 + 520 / 2.9);
close(trimmed.source.y, 50 + 180 / 2.9);
close(trimmed.source.width, 1280 / 2.9, 0.001);

assert.equal(sceneLayout(wide, defaultFrame()).dest.width, FRAME_WIDTH);
assert.equal(layoutFor(wide, { background: { white: true } }, defaultFrame()).mode, "plate");
assert.equal(layoutFor(wide, { background: { white: false } }, defaultFrame()).mode, "scene");
assert.equal(layoutFor(wide, { background: { white: true } }, { mode: "scene" }).mode, "scene");

// Dragging moves the window the other way, at any preview size.
const dragged = dragFrame(wide, null, { zoom: 2, focusX: 0.5, focusY: 0.5, mode: "scene" }, { width: 800, height: 500 }, 100, 0);
close(dragged.focusX, 0.375);
assert.equal(dragged.focusY, 0.5);
const plateDragged = dragFrame(wide, { trim: { x: 100, y: 50, width: 800, height: 400 } },
  { zoom: 2, focusX: 0.5, focusY: 0.5, mode: "plate" }, { width: 800, height: 500 }, 100, 0);
close(plateDragged.focusX, (520 - 100 * (441.379 / 800) * 2.9) / 1040, 0.002);
close(plateDragged.focusY, 0.5);
assert.deepEqual(dragFrame({ width: 1920, height: 1200 }, null, { zoom: 1, focusX: 0.4, focusY: 0.4 }, { width: 800, height: 500 }, 50, 50),
  { zoom: 1, focusX: 0.4, focusY: 0.4, mode: "auto" }, "A photo with no room to move stays put");

const zoomed = zoomFrame(wide, null, { zoom: 1, focusX: 0.2, focusY: 0.2, mode: "scene" }, 2, { x: 0.5, y: 0.5 });
close(zoomed.zoom, 2);
// Zooming about a point keeps that point of the frame over the same pixel of the photo, which for an
// off-centre photo is not the same as re-centring it.
const beforeZoom = sceneCropBox(wide, { zoom: 1, focusX: 0.2, focusY: 0.2 });
const afterZoom = sceneCropBox(wide, zoomed);
close(afterZoom.x + 0.5 * afterZoom.width, beforeZoom.x + 0.5 * beforeZoom.width, 0.001);
close(afterZoom.y + 0.5 * afterZoom.height, beforeZoom.y + 0.5 * beforeZoom.height, 0.001);
close(afterZoom.width, beforeZoom.width / 2, 0.001);
const edgeZoom = zoomFrame(wide, null, { zoom: 1, focusX: 0.5, focusY: 0.5, mode: "scene" }, 2, { x: 1, y: 0 });
close(edgeZoom.focusX, 1);
const edgeBox = sceneCropBox(wide, edgeZoom);
close(edgeBox.x + edgeBox.width, 1920, 0.001);
close(edgeBox.y, 120, 0.001);
const centreZoom = zoomFrame({ width: 1920, height: 1200 }, null, defaultFrame(), 2, { x: 0.5, y: 0.5 });
close(centreZoom.focusX, 0.5);
close(centreZoom.focusY, 0.5);
assert.equal(zoomFrame(wide, null, { zoom: 2.9, mode: "scene" }, 5).zoom, 3, "Zoom stops at its limit");
assert.equal(zoomFrame(wide, null, defaultFrame(), 2).zoom, 2, "The plate keeps its focus while zooming");
assert.deepEqual(fillFrame(wide, { background: { white: true } }, { zoom: 2, mode: "auto" }),
  { zoom: 0.5, focusX: 0.5, focusY: 0.5, mode: "auto" });
assert.equal(fillFrame(wide, null, { zoom: 2, mode: "scene" }).zoom, 1);

// Backgrounds and the vehicle box, read the way scripts/build-curated-catalogue.py reads them.
const pixels = rows => ({ width: rows[0].length / 4, height: rows.length, data: Uint8ClampedArray.from(rows.flat()) });
const white = pixels([[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]);
assert.deepEqual(backgroundKind(white), { transparent: false, white: true });
assert.equal(backgroundKind(pixels([[255, 255, 255, 250, 255, 255, 255, 255]])).transparent, true);
const coloured = pixels([[10, 20, 30, 255, 200, 40, 60, 255], [30, 30, 30, 255, 40, 50, 60, 255]]);
assert.deepEqual(backgroundKind(coloured), { transparent: false, white: false });
assert.equal(resolveMode({ mode: "auto" }, { transparent: false, white: true }), "plate");
assert.equal(resolveMode({ mode: "auto" }, { transparent: false, white: false }), "scene");
assert.equal(resolveMode({ mode: "plate" }, { white: false }), "plate");
assert.equal(resolveMode({ mode: "scene" }, { white: true }), "scene");

const grid = (size, square) => {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const inside = square && x >= square.x && x < square.x + square.width && y >= square.y && y < square.y + square.height;
      row.push(inside ? 20 : 255, inside ? 20 : 255, inside ? 20 : 255, 255);
    }
    rows.push(row);
  }
  return pixels(rows);
};
assert.deepEqual(detectTrimBox(grid(6, { x: 2, y: 2, width: 2, height: 2 })), { x: 2, y: 2, width: 2, height: 2 });
assert.equal(detectTrimBox(grid(4, null)), null, "A blank photo has nothing to trim to");
close(FRAME_RATIO, 1.6, 0.0001);

console.log(`Studio frames: ${FRAME_WIDTH}x${FRAME_HEIGHT} geometry agrees with the build script`);
// ---------------------------------------------------------------- records

const TEST_MODEL = {
  id: "test-car",
  name: "Test Car",
  images: [{
    sha256: SHA,
    url: "https://example.com/photo.jpg",
    sourcePage: "https://example.com/model",
    caption: "Test Car · Official Exterior",
    src: "assets/images/curated-catalogue/test-car-aaaaaaaaaaaa.webp",
    smallSrc: "assets/images/curated-catalogue/test-car-aaaaaaaaaaaa-640.webp",
    note: "Equipment and appearance may differ by market, year and trim."
  }]
};

const publishedItems = officialItems(TEST_MODEL);
assert.equal(publishedItems.length, 1);
assert.equal(publishedItems[0].id, officialKey(SHA));
assert.equal(publishedItems[0].kind, OFFICIAL);
assert.equal(publishedItems[0].sourcePage, "https://example.com/model");
assert.deepEqual(publishedItems[0].frame, defaultFrame());

const fresh = newRecord(TEST_MODEL, "2026-10-23T09:00:00.000Z");
assert.equal(fresh.coverId, publishedItems[0].id, "A fresh record is covered by the published cover");
assert.equal(fresh.modelId, "test-car");
assert.equal(recordIsEdited(fresh, TEST_MODEL), false, "A fresh record is not an edit");

const upload = uploadItem({ name: "my-front.jpg", type: "image/jpeg", size: 2048 }, "2026-10-23T09:00:00.000Z");
assert.equal(upload.kind, UPLOAD);
assert.equal(upload.name, "my-front.jpg");
assert.match(upload.id, /^upload:/);
assert.deepEqual(upload.frame, defaultFrame());

let record = addItem(fresh, upload);
assert.equal(record.items.length, 2);
assert.equal(recordIsEdited(record, TEST_MODEL), true, "An uploaded photo is an edit");
record = setCover(record, upload.id);
assert.deepEqual(orderedItems(record).map(item => item.id), [upload.id, publishedItems[0].id], "The cover is shown first");
assert.equal(orderedItems(record)[0].kind, UPLOAD);
record = setCover(record, publishedItems[0].id);
assert.deepEqual(orderedItems(record).map(item => item.id), [publishedItems[0].id, upload.id], "and again when the cover changes back");

const moved = moveItem(record, upload.id, -1);
assert.deepEqual(moved.items.map(item => item.id), [upload.id, publishedItems[0].id]);
assert.equal(moveItem(moved, upload.id, -1), moved, "A photo cannot move past the start");
assert.equal(moveItem(record, upload.id, 1), record, "or past the end");

assert.equal(removeItem(newRecord(TEST_MODEL), publishedItems[0].id).error, "A catalogue entry must keep at least one photo.");
assert.equal(removeItem(newRecord(TEST_MODEL), "official:nope").error, "That photo is not in this entry any more.");
const removed = removeItem(record, upload.id);
assert.equal(removed.error, undefined);
assert.equal(removed.record.items.length, 1);
const coverRemoved = removeItem(setCover(record, upload.id), upload.id);
assert.equal(coverRemoved.record.coverId, publishedItems[0].id, "Removing the cover passes it to the first remaining photo");

const reframed = updateFrame(record, publishedItems[0].id, { zoom: 99, focusX: -1, focusY: 0.25, mode: "plate" });
assert.deepEqual(reframed.items[0].frame, { zoom: 3, focusX: 0, focusY: 0.25, mode: "plate" });
assert.deepEqual(resetFrame(reframed, publishedItems[0].id).items[0].frame, defaultFrame());
assert.equal(recordIsEdited(reframed, TEST_MODEL), true, "A changed frame is an edit");
assert.equal(recordIsEdited(updateFrame(fresh, publishedItems[0].id, { zoom: 2, mode: "auto" }), TEST_MODEL), true);
assert.equal(recordIsEdited(resetFrame(reframed, publishedItems[0].id), TEST_MODEL), true, "The upload still makes it an edit");

assert.equal(normaliseRecord(null), null);
assert.equal(normaliseRecord({ modelId: "test-car", items: [] }), null, "A record with no photos is unusable");
const stored = normaliseRecord({ modelId: "test-car", coverId: "ghost", items: [{ id: upload.id, kind: "upload", frame: { zoom: 5 } }] });
assert.equal(stored.coverId, upload.id, "An unknown cover falls back to the first photo");
assert.equal(stored.items[0].frame.zoom, 3, "A stored frame is clamped on the way in");
assert.deepEqual(editedModelIds({ a: { modelId: "b" }, b: null, c: { modelId: "a" } }), ["a", "b"]);

console.log("Studio records: cover, order, removal and edits behave as the page expects");

// ---------------------------------------------------------------- the export

const fakeJpeg = size => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size, 7), Buffer.from([0xff, 0xd9])]);
const dataUrl = size => `data:image/jpeg;base64,${fakeJpeg(size).toString("base64")}`;

const exportRecord = setCover(record, upload.id);
const order = orderedItems(exportRecord);
assert.equal(order.length, 2);
const encoded = {
  [order[0].id]: { large: dataUrl(120), small: dataUrl(60) },
  [order[1].id]: { large: dataUrl(140), small: dataUrl(70) }
};
const manifest = buildManifest({
  models: [{ record: exportRecord, model: TEST_MODEL, encoded }],
  capturedAt: "2026-10-23T10:00:00.000Z",
  catalogueDate: "2026-10-23",
  appVersion: "2.11.3"
});
const manifestImages = manifest.models[0].images;
assert.equal(manifest.manifestVersion, 1);
assert.deepEqual(manifestImages.map(image => image.kind), [UPLOAD, OFFICIAL], "The export follows the cover order");
assert.deepEqual(manifestImages.map(image => image.cover), [true, false]);
assert.equal(manifestImages[0].name, "my-front.jpg");
assert.equal(manifestImages[1].sourcePage, "https://example.com/model");
assert.equal(manifestImages[0].file, "test-car-studio-1.jpg");
assert.equal(manifestImages[1].smallFile, "test-car-studio-2-640.jpg");
assert.equal(fileNameFor("test-car", 0, "large"), "test-car-studio-1.jpg");
assert.equal(fileNameFor("test-car", 1, "small"), "test-car-studio-2-640.jpg");
assert.match(manifestFileName(new Date("2026-10-23T10:00:00Z")), /^vahanaiq-studio-photos-2026-10-23\.json$/);
assert.deepEqual(manifestProblems(manifest), [], "A complete export reports no problems");
assert.equal(manifestProblems({ models: [] }).length, 1);
assert.ok(manifestProblems({ ...manifest, models: [{ ...manifest.models[0], images: [{ ...manifestImages[0], encoded: null }] }] }).length,
  "An export without framed pixels is refused");
assert.ok(manifestProblems({ ...manifest, models: [{ ...manifest.models[0], images: [{ ...manifestImages[0], file: "../escape.jpg" }] }] }).length,
  "An export that names a file outside the image folder is refused");

console.log("Studio export: the manifest carries both sizes, the order and the cover");

// ---------------------------------------------------------------- the bake script

const SCRIPT = path.join(ROOT, "scripts/apply-studio-photos.mjs");
const run = args => execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
const runFail = args => {
  try {
    execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", stdio: "pipe" });
    return null;
  } catch (error) {
    return { status: error.status, stderr: String(error.stderr || "") };
  }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vahanaiq-studio-"));
const otherImages = [{
  ...TEST_MODEL.images[0],
  src: "assets/images/curated-catalogue/other-car-aaaaaaaaaaaa.webp",
  smallSrc: "assets/images/curated-catalogue/other-car-aaaaaaaaaaaa-640.webp"
}];
const catalogue = {
  schemaVersion: 1,
  checkedOn: "2026-10-23",
  models: [
    { id: "test-car", make: "Test", model: "Car", name: "Test Car", body: "SUV", sourceUrl: "https://example.com", images: TEST_MODEL.images, offers: [] },
    { id: "other-car", make: "Other", model: "Car", name: "Other Car", body: "SUV", sourceUrl: "https://example.com", images: otherImages, offers: [] }
  ],
  scope: "test scope",
  imagePolicy: "test policy",
  pricePolicy: "test policy"
};
fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
fs.mkdirSync(path.join(tmp, "js"), { recursive: true });
fs.writeFileSync(path.join(tmp, "data/catalogue.json"), JSON.stringify(catalogue, null, 2));
fs.writeFileSync(path.join(tmp, "js/catalogue-data.js"),
  `window.__VAHANAIQ_CATALOGUE__ = ${JSON.stringify(catalogue)};\nwindow.__VAHANAIQ_IDENTITY__ = {"brands":{"Test":{"localPath":"../assets/identity/test.svg"}}};\n`);
const manifestFile = path.join(tmp, "vahanaiq-studio-photos-2026-10-23.json");
fs.writeFileSync(manifestFile, JSON.stringify(manifest));

const dry = run([manifestFile, "--root", tmp, "--dry-run"]);
assert.match(dry, /Would write 4 image file\(s\)/);
assert.ok(!fs.existsSync(path.join(tmp, "assets/images/curated-catalogue/test-car-studio-1.jpg")), "--dry-run writes no files");
assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, "data/catalogue.json"), "utf8")).models[0].images[0].src, TEST_MODEL.images[0].src,
  "--dry-run leaves the catalogue alone");
const output = run([manifestFile, "--root", tmp]);
assert.match(output, /Updated data\/catalogue\.json/);
const baked = JSON.parse(fs.readFileSync(path.join(tmp, "data/catalogue.json"), "utf8"));
const car = baked.models.find(model => model.id === "test-car");
assert.equal(car.images.length, 2);
assert.equal(car.images[0].src, "assets/images/curated-catalogue/test-car-studio-1.jpg");
assert.equal(car.images[0].smallSrc, "assets/images/curated-catalogue/test-car-studio-1-640.jpg");
assert.equal(car.images[0].width, 1280);
assert.equal(car.images[0].height, 800);
assert.equal(car.images[0].aspectRatio, "8:5");
assert.equal(car.images[0].origin, "owner-upload");
assert.equal(car.images[0].caption, "Owner Photo · my-front.jpg");
assert.equal(car.images[0].reviewedOn, "2026-10-23");
assert.equal(car.images[0].note.includes("site owner"), true);
assert.equal(car.images[0].url, undefined, "An owner photo claims no source page");
assert.match(car.images[0].sha256, /^[a-f0-9]{64}$/, "The published hash is of the baked file");
assert.deepEqual(car.images[0].frame, defaultFrame());
assert.equal(car.images[1].origin, "official-reframe");
assert.equal(car.images[1].url, "https://example.com/photo.jpg");
assert.equal(car.images[1].sourcePage, "https://example.com/model");
assert.equal(car.images[1].sourceSha256, SHA, "The original candidate hash is kept for traceability");
assert.equal(car.images[1].caption, "Test Car · Official Exterior");
assert.equal(baked.models.find(model => model.id === "other-car").images[0].src, otherImages[0].src,
  "An entry the export does not mention is untouched");
assert.equal(baked.scope, "test scope", "The catalogue's own words are kept");

const imageFolder = path.join(tmp, "assets/images/curated-catalogue");
for (const file of ["test-car-studio-1.jpg", "test-car-studio-1-640.jpg", "test-car-studio-2.jpg", "test-car-studio-2-640.jpg"]) {
  assert.ok(fs.existsSync(path.join(imageFolder, file)), `${file} should have been written`);
}
assert.equal(fs.statSync(path.join(imageFolder, "test-car-studio-1.jpg")).size, fakeJpeg(120).length);

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(path.join(tmp, "js/catalogue-data.js"), "utf8"));
assert.deepEqual(globalThis.window.__VAHANAIQ_CATALOGUE__, baked, "js/catalogue-data.js matches data/catalogue.json");
assert.deepEqual(globalThis.window.__VAHANAIQ_IDENTITY__, { brands: { Test: { localPath: "../assets/identity/test.svg" } } },
  "The identity line beside it is left alone");
delete globalThis.window;

const missing = runFail([path.join(tmp, "nope.json"), "--root", tmp]);
assert.equal(missing.status, 1);
assert.match(missing.stderr, /No such file/);

const ghostFile = path.join(tmp, "ghost.json");
fs.writeFileSync(ghostFile, JSON.stringify({ ...manifest, models: [{ ...manifest.models[0], modelId: "ghost-car" }] }));
const ghost = runFail([ghostFile, "--root", tmp]);
assert.equal(ghost.status, 1);
assert.match(ghost.stderr, /no entry with the id ghost-car/);

const traversalFile = path.join(tmp, "traversal.json");
fs.writeFileSync(traversalFile, JSON.stringify({
  ...manifest,
  models: [{ ...manifest.models[0], images: [{ ...manifestImages[0], file: "../../escape.jpg" }] }]
}));
const traversal = runFail([traversalFile, "--root", tmp]);
assert.equal(traversal.status, 1);
assert.match(traversal.stderr, /unsafe file/);
assert.ok(!fs.existsSync(path.join(tmp, "escape.jpg")), "No file escapes the image folder");

const truncatedFile = path.join(tmp, "truncated.json");
const cutInHalf = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).toString("base64")}`;
fs.writeFileSync(truncatedFile, JSON.stringify({
  ...manifest,
  models: [{
    ...manifest.models[0],
    images: [{ ...manifestImages[0], encoded: { ...manifestImages[0].encoded, large: cutInHalf } }]
  }]
}));
const truncated = runFail([truncatedFile, "--root", tmp]);
assert.equal(truncated.status, 1);
assert.match(truncated.stderr, /not a complete JPEG/);

const unknownOption = runFail([manifestFile, "--root", tmp, "--publish"]);
assert.equal(unknownOption.status, 1);
assert.match(unknownOption.stderr, /Unknown option/);
assert.match(run(["--help"]), /Usage: node scripts\/apply-studio-photos\.mjs/);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("Studio bake: the export becomes catalogue files, and a bad export changes nothing");

// ---------------------------------------------------------------- the page's contract

// The studio script reaches for elements by id at load time, so every id it asks for must be in the
// page. This catches a renamed or missing control long before a browser sees it.
const studioHtml = fs.readFileSync(path.join(ROOT, "studio.html"), "utf8");
const studioScript = fs.readFileSync(path.join(ROOT, "js/catalogue-studio.js"), "utf8");
const pageIds = new Set([...studioHtml.matchAll(/id="([^"]+)"/g)].map(match => match[1]));
for (const [, id] of studioScript.matchAll(/\$\("([^"]+)"\)/g)) {
  assert.ok(pageIds.has(id), `js/catalogue-studio.js uses #${id}, which studio.html does not define`);
}
for (const id of ["photoFiles", "filmstrip", "cropStage", "zoomRange", "frameMode", "fitBtn", "centreBtn",
  "resetFrameBtn", "exportBtn", "exportDialog", "exportDownload", "modelList", "modelSearch", "storageNote"]) {
  assert.ok(pageIds.has(id), `studio.html is missing #${id}`);
}
assert.match(studioHtml, /type="file"[^>]*multiple/, "The upload control must accept several files at once");
assert.match(studioHtml, /accept="image\/\*"/);
assert.match(studioHtml, /type="module" src="js\/catalogue-studio\.js\?v=2\.11\.5"/, "studio.html must load the studio script");
assert.match(studioHtml, /href="css\/catalogue-studio\.css"/);
assert.match(studioHtml, /href="css\/tokens\.css\?v=2\.11\.5"/, "studio.html must load the design tokens");
assert.match(studioHtml, /id="cropStage"[^>]*aspect|role="img"/, "The crop stage is described to assistive technology");
assert.ok(!/[\"'(]\.?\/?docs\//.test(studioHtml), "studio.html must not reach into the unpublished docs/ tree");

// The catalogue page hands the overlay a promise before any deferred script runs.
const catalogueHtml = fs.readFileSync(path.join(ROOT, "catalogue.html"), "utf8");
assert.match(catalogueHtml, /window\.__VAHANAIQ_PHOTOS__ = \{ apply: null, resolve: null \};/,
  "catalogue.html must set up the studio hand-off before its scripts run");
assert.match(catalogueHtml, /src="js\/catalogue-photo-overlay\.js\?v=2\.11\.5"/);
assert.ok(catalogueHtml.indexOf("__VAHANAIQ_PHOTOS__") < catalogueHtml.indexOf("js/curated-catalogue.js"),
  "The hand-off must come before the script that waits on it");
assert.match(fs.readFileSync(path.join(ROOT, "js/catalogue-photo-overlay.js"), "utf8"),
  /globalThis\.__VAHANAIQ_PHOTOS__/, "The overlay must resolve the hand-off promise");
assert.match(fs.readFileSync(path.join(ROOT, "js/curated-catalogue.js"), "utf8"), /__VAHANAIQ_PHOTOS__/);

// The studio's own stylesheet reads design tokens rather than repeating colours.
const studioCss = fs.readFileSync(path.join(ROOT, "css/catalogue-studio.css"), "utf8");
assert.ok(studioCss.includes("var(--accent"), "css/catalogue-studio.css should use the design tokens");
assert.doesNotMatch(studioCss, /^\s*--[A-Za-z0-9_.-]+\s*:/m, "css/catalogue-studio.css must not declare custom properties");
assert.match(studioCss, /@media print/, "The studio needs a print rule, like the rest of the site");

// The published vocabulary for a studio photo, shared with scripts/apply-studio-photos.mjs.
const overlayVocabulary = fs.readFileSync(path.join(ROOT, "js/catalogue-photo-overlay.js"), "utf8");
assert.match(overlayVocabulary, /"owner-upload"/, "The overlay must mark an uploaded photo as an owner upload");
assert.match(overlayVocabulary, /"official-reframe"/, "The overlay must mark a re-framed published photo");
assert.match(fs.readFileSync(path.join(ROOT, "js/curated-catalogue.js"), "utf8"), /origin === "owner-upload"/,
  "The catalogue card must single out a photo that you added");
assert.match(fs.readFileSync(path.join(ROOT, "scripts/apply-studio-photos.mjs"), "utf8"), /owner-upload/,
  "The bake script must write the same vocabulary");

console.log("Studio page: every control the script asks for is in studio.html, and the overlay hand-off is wired");