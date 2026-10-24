import assert from "node:assert/strict";
import fs from "node:fs";
import { PHOTO_CREDITS, creditFor, photoForModel, formatCreditHtml, findCatalogueModel } from "../js/photo-credits.js";

const catalogue = JSON.parse(fs.readFileSync("data/catalogue.json", "utf8"));

console.log("=== VAHANAIQ CATALOGUE-SUPERIOR IMAGERY TEST SUITE ===\n");

// 1. Verification without Catalogue loaded (Fallback Mode)
console.log("TEST 1: Fallback to OFFICIAL_PHOTOS when Catalogue is absent");
const fallbackCredit = creditFor("Toyota Yaris Cross");
assert.ok(fallbackCredit, "Must find fallback credit for Toyota Yaris Cross");
assert.match(fallbackCredit.img, /^assets\/images\/review-thumbnails\//, "Fallback must use review thumbnails");
assert.equal(photoForModel("Toyota Yaris Cross"), fallbackCredit.img);
assert.equal(creditFor("Nonexistent Car 12345"), null);
assert.equal(photoForModel("Nonexistent Car 12345"), "");
console.log("✓ Fallback mode PASSED\n");

// 2. Verification with Catalogue loaded (Catalogue Superior Mode)
console.log("TEST 2: Catalogue is always superior to Calculator");
globalThis.window = { __VAHANAIQ_CATALOGUE__: catalogue };

// 2.1 Standard catalogue entry
const yarisCatCredit = creditFor("Toyota Yaris Cross");
assert.ok(yarisCatCredit, "Must find catalogue credit for Toyota Yaris Cross");
assert.equal(yarisCatCredit.isCatalogue, true);
assert.match(yarisCatCredit.img, /^assets\/images\/curated-catalogue\/toyota-yaris-cross-[a-f0-9]+-640\.webp$/);
assert.match(yarisCatCredit.largeImg, /^assets\/images\/curated-catalogue\/toyota-yaris-cross-[a-f0-9]+\.webp$/);
assert.equal(photoForModel("Toyota Yaris Cross"), yarisCatCredit.img);
assert.match(yarisCatCredit.sourceUrl, /^https:\/\//);
assert.equal(yarisCatCredit.aspectRatio, "8:5");

// 2.2 Model from Batches 1-4 (e.g. BYD Shark 6, Audi A3)
const sharkCatCredit = creditFor("BYD Shark 6");
assert.ok(sharkCatCredit, "BYD Shark 6 must resolve from Catalogue");
assert.match(sharkCatCredit.img, /^assets\/images\/curated-catalogue\/byd-shark-6-/);
assert.equal(photoForModel("BYD Shark"), sharkCatCredit.img, "Fuzzy BYD Shark query must match BYD Shark 6");

const audiCatCredit = creditFor({ make: "Audi", model: "A3" });
assert.ok(audiCatCredit, "Audi A3 object lookup must resolve from Catalogue");
assert.match(audiCatCredit.img, /^assets\/images\/curated-catalogue\/audi-a3-/);

// 2.3 Explicit img priority for custom Studio framing
const customStudioCar = {
  id: "toyota-yaris-cross",
  catalogueId: "toyota-yaris-cross",
  name: "Toyota Yaris Cross",
  img: "data:image/webp;base64,mockCustomFramedDataUrl"
};
const customCredit = creditFor(customStudioCar);
assert.equal(customCredit.img, "data:image/webp;base64,mockCustomFramedDataUrl", "Studio framed data URL must take precedence");
assert.equal(photoForModel(customStudioCar), "data:image/webp;base64,mockCustomFramedDataUrl");

// 2.4 HTML credit attribution formatting
const officialHtml = formatCreditHtml(yarisCatCredit);
assert.match(officialHtml, /<a class="photo-source"/);
assert.match(officialHtml, /Photo Source/);
assert.match(officialHtml, /rel="noopener noreferrer"/);

const studioUploadCredit = { origin: "owner-upload", author: "User" };
const studioHtml = formatCreditHtml(studioUploadCredit);
assert.equal(studioHtml, '<span class="studio-credit">Photo Studio · This Device</span>');

assert.equal(formatCreditHtml(null), "");
assert.equal(formatCreditHtml({}), "");

console.log("✓ Catalogue superiority & attribution PASSED\n");

console.log("==================================================");
console.log("ALL CATALOGUE-SUPERIOR IMAGERY TESTS PASSED! (100%)");
console.log("==================================================");
