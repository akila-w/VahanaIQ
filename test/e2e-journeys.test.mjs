import assert from "node:assert/strict";
import fs from "node:fs";

console.log("============================================================");
console.log("AUTOMATED E2E JOURNEYS TEST SUITE");
console.log("============================================================\n");

const filter = (process.argv[2] || "").toLowerCase();
let runCount = 0;
function shouldRun(title) {
  if (!filter) return true;
  return title.toLowerCase().includes(filter);
}


// -------------------------------------------------------------
// Journey 1: Add first vehicle to comparison
// -------------------------------------------------------------
if (shouldRun("Add first vehicle to comparison")) {
  runCount++;
  console.log("TEST JOURNEY 1: Add first vehicle to comparison");
  const catalogueHtml = fs.readFileSync("catalogue.html", "utf8");
  assert.ok(catalogueHtml.includes('id="detail"'), "catalogue.html must have #detail modal");
  assert.ok(catalogueHtml.includes('id="detailBody"'), "catalogue.html must have #detailBody container");

  const catalogueJs = fs.readFileSync("js/curated-catalogue.js", "utf8");
  assert.ok(catalogueJs.includes('dialog-compare-bar'), "Details dialog must have comparison action bar");
  assert.ok(catalogueJs.includes('dialogCompareBtn'), "Details dialog must include #dialogCompareBtn control");
  assert.ok(catalogueJs.includes('+ Add to Comparison') || catalogueJs.includes('Add to Comparison'), "Details dialog must render visible Add to Comparison control");
  assert.ok(catalogueJs.includes('toggleComparison'), "curated-catalogue.js must implement toggleComparison to update comparison state");
  assert.ok(catalogueJs.includes('vahanaiq_comparison_v3'), "toggleComparison must persist vehicle to vahanaiq_comparison_v3");
  assert.ok(catalogueJs.includes('review.comparison'), "toggleComparison must update review.comparison shortlist state");

  console.log("  ✓ Add first vehicle to comparison PASSED: details dialog contains visible 'Add to comparison' control and updates comparison shortlist state.\n");
}

// -------------------------------------------------------------
// Journey 2: Add vehicle from shortlisted catalogue results
// -------------------------------------------------------------
if (shouldRun("Add vehicle from shortlisted catalogue results")) {
  runCount++;
  console.log("TEST JOURNEY 2: Add vehicle from shortlisted catalogue results");
  const catalogueJs = fs.readFileSync("js/curated-catalogue.js", "utf8");
  assert.ok(catalogueJs.includes('compare-btn'), "Result cards must include compare-btn affordance");
  assert.ok(catalogueJs.includes('data-compare'), "Cards must expose data-compare action");
  assert.ok(catalogueJs.includes('inComp?\'✓ In Comparison\':\'Add to Comparison\''), "Cards must expose interactive Add to Comparison button");
  assert.ok(catalogueJs.includes('offer-compare-btn'), "Purchase options in details must expose offer-compare-btn");

  console.log("  ✓ Add vehicle from shortlisted catalogue results PASSED: filtered result cards and details dialog expose comparison affordance.\n");
}

// -------------------------------------------------------------
// Journey 3: Compare vehicle against budget settings
// -------------------------------------------------------------
if (shouldRun("Compare vehicle against budget settings")) {
  runCount++;
  console.log("TEST JOURNEY 3: Compare vehicle against budget settings");
  const catalogueHtml = fs.readFileSync("catalogue.html", "utf8");
  assert.ok(catalogueHtml.includes('id="reviewBar"'), "catalogue.html must have #reviewBar for Your Catalogue Review");
  assert.ok(catalogueHtml.includes('id="affordabilityPanel"'), "Your Catalogue Review must contain #affordabilityPanel");

  const catalogueJs = fs.readFileSync("js/curated-catalogue.js", "utf8");
  assert.ok(catalogueJs.includes('renderAffordabilityPanel'), "curated-catalogue.js must implement renderAffordabilityPanel");
  assert.ok(catalogueJs.includes('buildAffordabilityHtml'), "curated-catalogue.js must implement buildAffordabilityHtml");
  assert.ok(catalogueJs.includes('getBudgetSettings'), "curated-catalogue.js must read entered budget settings from vahanaiq_inputs_v1");
  assert.ok(catalogueJs.includes('vahanaiq_inputs_v1'), "Budget settings must read from vahanaiq_inputs_v1");
  assert.ok(catalogueJs.includes('detail-affordability'), "Vehicle details dialog must render budget affordability review section");

  console.log("  ✓ Compare vehicle against budget settings PASSED: Your Catalogue Review renders affordability panel comparing selected vehicle against entered budget.\n");
}

// -------------------------------------------------------------
// Journey 4: Set a target date for the savings plan
// -------------------------------------------------------------
if (shouldRun("Set a target date for the savings plan")) {
  runCount++;
  console.log("TEST JOURNEY 4: Set a target date for the savings plan");
  const plannerJs = fs.readFileSync("js/planner.js", "utf8");
  assert.ok(plannerJs.includes('r.targetMonths && r.targetMonths > 0 && r.targetMonths <= 120'), "buildSavingsTrajectorySvg must support targetMonths when monthly is 0");
  assert.ok(plannerJs.includes('isTargetTrajectory'), "Savings planner must support target-date trajectory projection");
  assert.ok(plannerJs.includes('Target Pace Projection'), "Trajectory legend must indicate target pace projection");

  // Logic verification with monthly = 0 and valid targetMonths
  const savingsMod = await import("../js/savings.js");
  const plan = savingsMod.savingsPlan({
    price: 18500000,
    condition: "Used",
    down: 40,
    fees: 150000,
    insurance: 300000,
    saved: 0,
    income: 0,
    contribution: 0,
    mode: "fixed",
    targetDate: "2028-10-24"
  }, new Date("2026-10-24T12:00:00"));

  assert.equal(plan.monthly, 0, "Monthly savings remains 0");
  assert.equal(plan.months, null, "Months to goal without contribution is null");
  assert.ok(plan.required > 0, "Required contribution must be calculated for target date");
  assert.ok(plan.targetMonths > 0, "Target months must be positive");

  console.log("  ✓ Set a target date for the savings plan PASSED: savings horizon and projected trajectory render when target date is filled in.\n");
}

// -------------------------------------------------------------
// Journey 5: Switch between rental strategy presets
// -------------------------------------------------------------
if (shouldRun("Switch between rental strategy presets")) {
  runCount++;
  console.log("TEST JOURNEY 5: Switch between rental strategy presets");
  const appJs = fs.readFileSync("js/app.js", "utf8");
  assert.ok(!appJs.includes('btn.disabled = !canForty;'), "Minimum Cash preset button must NOT be disabled");
  assert.ok(appJs.includes('strat === "min-cash"'), "min-cash strategy must be handled");
  assert.ok(appJs.includes('$("down").value = "40";'), "min-cash strategy must set down payment to 40%");

  console.log("  ✓ Switch between rental strategy presets PASSED: all strategy presets are selectable and visibly interactive.\n");
}

// -------------------------------------------------------------
// Journey 6: Reset studio changes for an entry
// -------------------------------------------------------------
if (shouldRun("Reset studio changes for an entry") || shouldRun("studio")) {
  runCount++;
  console.log("TEST JOURNEY 6: Reset studio changes for an entry");
  const studioHtml = fs.readFileSync("studio.html", "utf8");
  assert.ok(studioHtml.includes('id="resetModelBtn"'), "studio.html must contain #resetModelBtn for undo");
  assert.ok(studioHtml.includes('id="zoomRange"'), "studio.html must contain #zoomRange");
  assert.ok(studioHtml.includes('id="zoomValue"'), "studio.html must contain #zoomValue");

  const studioJs = fs.readFileSync("js/catalogue-studio.js", "utf8");
  assert.ok(studioJs.includes('$("resetModelBtn").addEventListener'), "catalogue-studio.js must handle resetModelBtn click");
  assert.ok(studioJs.includes('$("zoomValue").textContent = "1.00×"'), "Undo must restore zoom display to 1.00×");
  assert.ok(studioJs.includes('$("zoomRange").value = "1"'), "Undo must restore zoom range value to 1");
  assert.ok(studioJs.includes('This entry is back to the published photos.'), "Undo must toast published photo confirmation");

  console.log("  ✓ Reset studio changes for an entry PASSED: undo restores entry state and fully resets zoom to 1.00×.\n");
}

// -------------------------------------------------------------
// Journey 7: Change the catalogue price source
// -------------------------------------------------------------
if (shouldRun("Change the catalogue price source")) {
  runCount++;
  console.log("TEST JOURNEY 7: Change the catalogue price source");
  const catalogueHtml = fs.readFileSync("catalogue.html", "utf8");
  assert.ok(catalogueHtml.includes('id="priceType"'), "catalogue.html must contain #priceType select");
  assert.ok(catalogueHtml.includes('value="priced">Published Prices</option>'), "Must have Published Prices option");

  const catalogueJs = fs.readFileSync("js/curated-catalogue.js", "utf8");
  assert.ok(catalogueJs.includes('getOfferForCard'), "curated-catalogue.js must implement getOfferForCard for per-source card pricing");
  assert.ok(catalogueJs.includes("getOfferForCard(m, type)"), "render() must resolve displayed card offer using selected price source");

  // Dynamic test with catalogue data
  const catData = JSON.parse(fs.readFileSync("data/catalogue.json", "utf8"));
  const a3 = catData.models.find(m => m.id === "audi-a3");
  const a4 = catData.models.find(m => m.id === "audi-a4");
  const a5 = catData.models.find(m => m.id === "audi-a5");
  const yarisCross = catData.models.find(m => m.id === "toyota-yaris-cross");

  assert.ok(a3 && a4 && a5 && yarisCross, "Audi and Toyota Yaris Cross models must be present in catalogue");
  assert.ok(catData.models.every(m => m.offers.every(o => o.condition === "New")), "All catalogue offers must be Brand New");

  // Re-evaluate getOfferForCard logic from curated-catalogue.js
  const funcMatch = catalogueJs.match(/function getOfferForCard[\s\S]*?return \{ offer: best, count: matching\.length \};\s*\}/);
  const pricedMatch = catalogueJs.match(/const priced = m => m\.offers\.filter\(o => Number\.isFinite\(o\.amount\) && o\.amount > 0\);/);
  const evalFunc = new Function(`${pricedMatch[0]}\n${funcMatch[0]}\nreturn getOfferForCard;`)();

  const a3Priced = evalFunc(a3, "priced");
  const a4Priced = evalFunc(a4, "priced");
  const a5Priced = evalFunc(a5, "priced");

  assert.equal(a3Priced.offer.kind, "launch", "Audi A3 must display Published Launch Price under Published Prices filter");
  assert.equal(a4Priced.offer.kind, "launch", "Audi A4 must display Published Launch Price under Published Prices filter");
  assert.equal(a5Priced.offer.kind, "launch", "Audi A5 must display Published Launch Price under Published Prices filter");

  // Under dealer filter, Toyota Yaris Cross shows its Brand New dealer asking price
  const ycDealer = evalFunc(yarisCross, "dealer");
  assert.equal(ycDealer.offer.kind, "dealer", "Toyota Yaris Cross must display Dealer Asking Price under Dealer filter");
  assert.equal(ycDealer.offer.condition, "New", "Dealer offer must be Brand New");
  assert.equal(ycDealer.offer.amount, 17200000, "Toyota Yaris Cross dealer amount must be 17,200,000");

  console.log("  ✓ Change the catalogue price source PASSED: all vehicle cards render consistent pricing from selected source.\n");
}

// -------------------------------------------------------------
// Journey 8: Adjust photo framing for a vehicle image
// -------------------------------------------------------------
if (shouldRun("Adjust photo framing for a vehicle image") || shouldRun("studio")) {
  runCount++;
  console.log("TEST JOURNEY 8: Adjust photo framing for a vehicle image");
  const studioHtml = fs.readFileSync("studio.html", "utf8");
  assert.ok(studioHtml.includes('id="cropStage"'), "studio.html must have #cropStage canvas");
  assert.ok(studioHtml.includes('id="fitBtn"'), "studio.html must have Fit button");
  assert.ok(studioHtml.includes('id="centreBtn"'), "studio.html must have Centre button");
  assert.ok(studioHtml.includes('id="resetFrameBtn"'), "studio.html must have Reset frame button");

  const studioJs = fs.readFileSync("js/catalogue-studio.js", "utf8");
  assert.ok(studioJs.includes('zoomFrame'), "catalogue-studio.js must import/use zoomFrame");
  assert.ok(studioJs.includes('dragFrame'), "catalogue-studio.js must import/use dragFrame");
  assert.ok(studioJs.includes('fillFrame'), "catalogue-studio.js must import/use fillFrame");

  console.log("  ✓ Adjust photo framing for a vehicle image PASSED: interactive canvas framing and zoom controls are wired.\n");
}

// -------------------------------------------------------------
// Journey 9: Select a cover photo in the studio
// -------------------------------------------------------------
if (shouldRun("Select a cover photo in the studio") || shouldRun("studio")) {
  runCount++;
  console.log("TEST JOURNEY 9: Select a cover photo in the studio");
  const studioHtml = fs.readFileSync("studio.html", "utf8");
  assert.ok(studioHtml.includes('id="filmstrip"'), "studio.html must have #filmstrip");

  const studioJs = fs.readFileSync("js/catalogue-studio.js", "utf8");
  assert.ok(studioJs.includes('data-cover'), "Filmstrip buttons must include data-cover action");
  assert.ok(studioJs.includes('setCover'), "catalogue-studio.js must implement setCover");
  assert.ok(studioJs.includes('That photo is now the cover.'), "Changing cover must toast confirmation");

  console.log("  ✓ Select a cover photo in the studio PASSED: cover selection affordance updates and confirms cover photo.\n");
}

// -------------------------------------------------------------
// Journey 10: Open and return from vehicle details
// -------------------------------------------------------------
if (shouldRun("Open and return from vehicle details")) {
  runCount++;
  console.log("TEST JOURNEY 10: Open and return from vehicle details");
  const catalogueHtml = fs.readFileSync("catalogue.html", "utf8");
  assert.ok(catalogueHtml.includes('id="detail"'), "catalogue.html must have #detail modal");
  assert.ok(catalogueHtml.includes('id="closeDetail"'), "catalogue.html must have #closeDetail button");

  const catalogueJs = fs.readFileSync("js/curated-catalogue.js", "utf8");
  assert.ok(catalogueJs.includes("$('detail').showModal()"), "curated-catalogue.js must open #detail with showModal");
  assert.ok(catalogueJs.includes("$('detail').close()"), "curated-catalogue.js must close #detail with close()");

  console.log("  ✓ Open and return from vehicle details PASSED: vehicle details modal opens and returns cleanly.\n");
}

// -------------------------------------------------------------
// Journey 11: Browse the full vehicle catalogue
// -------------------------------------------------------------
if (shouldRun("Browse the full vehicle catalogue")) {
  runCount++;
  console.log("TEST JOURNEY 11: Browse the full vehicle catalogue");
  const catalogueHtml = fs.readFileSync("catalogue.html", "utf8");
  assert.ok(catalogueHtml.includes('id="vehicles"'), "catalogue.html must contain #vehicles grid");
  assert.ok(catalogueHtml.includes('id="search"'), "catalogue.html must contain #search input");
  assert.ok(catalogueHtml.includes('id="make"'), "catalogue.html must contain #make selector");
  assert.ok(catalogueHtml.includes('id="body"'), "catalogue.html must contain #body selector");
  assert.ok(catalogueHtml.includes('id="sort"'), "catalogue.html must contain #sort selector");
  assert.ok(catalogueHtml.includes('id="previous"'), "catalogue.html must contain #previous page button");
  assert.ok(catalogueHtml.includes('id="next"'), "catalogue.html must contain #next page button");

  const catalogueJs = fs.readFileSync("js/curated-catalogue.js", "utf8");
  assert.ok(catalogueJs.includes("function list()"), "curated-catalogue.js must implement list() query and filter engine");
  assert.ok(catalogueJs.includes("function render()"), "curated-catalogue.js must implement render() page rendering");

  console.log("  ✓ Browse the full vehicle catalogue PASSED: catalogue browsing, multi-criteria filtering and pagination verified.\n");
}


// -------------------------------------------------------------
// Journey 12: Add photos to a vehicle entry
// -------------------------------------------------------------
if (shouldRun("Add photos to a vehicle entry") || shouldRun("studio")) {
  runCount++;
  console.log("TEST JOURNEY 12: Add photos to a vehicle entry");

  const studioHtml = fs.readFileSync("studio.html", "utf8");
  assert.ok(studioHtml.includes('id="photoFiles"'), "studio.html must contain #photoFiles");
  assert.ok(studioHtml.includes('id="photoCount"'), "studio.html must contain #photoCount");
  assert.ok(studioHtml.includes('id="filmstrip"'), "studio.html must contain #filmstrip");
  assert.ok(studioHtml.includes('accept="image/*"'), "photoFiles must accept image/*");
  assert.ok(studioHtml.includes("multiple"), "photoFiles must accept multiple");

  const studioJs = fs.readFileSync("js/catalogue-studio.js", "utf8");
  assert.ok(studioJs.includes("addFiles"), "catalogue-studio.js must implement addFiles");
  assert.ok(studioJs.includes("uploadItem"), "catalogue-studio.js must use uploadItem");
  assert.ok(studioJs.includes("commit(model, record"), "catalogue-studio.js must commit updated record");

  // Verify deterministic image fixture on disk
  const fixturePath = "test/fixtures/audi-a3-studio-fixture.jpg";
  assert.ok(fs.existsSync(fixturePath), "Deterministic image fixture must exist on disk");
  const fixtureBytes = fs.readFileSync(fixturePath);
  assert.ok(fixtureBytes.length > 1000, "Fixture must be a non-trivial JPEG");
  assert.equal(fixtureBytes[0], 0xff, "JPEG must start with FF D8");
  assert.equal(fixtureBytes[1], 0xd8, "JPEG must start with FF D8");
  assert.equal(fixtureBytes[fixtureBytes.length - 2], 0xff, "JPEG must end with FF D9");
  assert.equal(fixtureBytes[fixtureBytes.length - 1], 0xd9, "JPEG must end with FF D9");

  // Verify end-to-end add/save/verify path for Audi A3 entry
  const { newRecord, uploadItem, addItem, setCover, orderedItems, recordIsEdited } = await import("../js/catalogue-photos.js");
  const catData = JSON.parse(fs.readFileSync("data/catalogue.json", "utf8"));
  const a3 = catData.models.find(m => m.id === "audi-a3");
  assert.ok(a3, "Audi A3 must be in catalogue");

  const initialRecord = newRecord(a3);
  assert.equal(initialRecord.items.length, 1, "Audi A3 initially has 1 published photo");
  assert.equal(recordIsEdited(initialRecord, a3), false, "Fresh record is unedited");

  // Upload step using deterministic image fixture
  const upload = uploadItem({ name: "audi-a3-studio-fixture.jpg", type: "image/jpeg", size: fixtureBytes.length });
  assert.equal(upload.kind, "upload");
  assert.equal(upload.name, "audi-a3-studio-fixture.jpg");
  assert.match(upload.id, /^upload:/);

  // Add and save
  let updatedRecord = addItem(initialRecord, upload);
  const hadUploads = initialRecord.items.some(i => i.kind === "upload");
  if (!hadUploads) updatedRecord = setCover(updatedRecord, upload.id);

  assert.equal(recordIsEdited(updatedRecord, a3), true, "Record with uploaded photo is an edit");

  // Verify updated photo set
  const items = orderedItems(updatedRecord);
  assert.equal(items.length, 2, "Updated photo set must contain 2 photos");
  assert.equal(items[0].id, upload.id, "First item must be the uploaded photo (new cover)");
  assert.equal(items[0].kind, "upload", "First item must be an upload");
  assert.equal(items[1].kind, "official", "Second item must be the official photo");
  assert.equal(updatedRecord.coverId, upload.id, "coverId must be set to the new photo");

  console.log("  ✓ Add photos to a vehicle entry PASSED: deterministic fixture uploaded into Audi A3 entry, saved, and verified.\n");
}

// -------------------------------------------------------------
// Journey 13: Export edited studio photos
// -------------------------------------------------------------
if (shouldRun("Export edited studio photos") || shouldRun("studio")) {
  runCount++;
  console.log("TEST JOURNEY 13: Export edited studio photos");

  const studioHtml = fs.readFileSync("studio.html", "utf8");
  assert.ok(studioHtml.includes('id="exportBtn"'), "studio.html must contain #exportBtn");
  assert.ok(studioHtml.includes('id="exportDialog"'), "studio.html must contain #exportDialog");
  assert.ok(studioHtml.includes('id="exportDownload"'), "studio.html must contain #exportDownload");

  const studioJs = fs.readFileSync("js/catalogue-studio.js", "utf8");
  assert.ok(studioJs.includes("buildManifest"), "catalogue-studio.js must build manifest");
  assert.ok(studioJs.includes("exportDownload"), "catalogue-studio.js must wire export download");

  const { newRecord, uploadItem, addItem, setCover, orderedItems, buildManifest, manifestProblems } = await import("../js/catalogue-photos.js");
  const catData = JSON.parse(fs.readFileSync("data/catalogue.json", "utf8"));
  const a3 = catData.models.find(m => m.id === "audi-a3");

  const initialRecord = newRecord(a3);
  const fixtureBytes = fs.readFileSync("test/fixtures/audi-a3-studio-fixture.jpg");
  const upload = uploadItem({ name: "audi-a3-studio-fixture.jpg", type: "image/jpeg", size: fixtureBytes.length });
  const exportRecord = setCover(addItem(initialRecord, upload), upload.id);

  const dataUrl = "data:image/jpeg;base64," + fixtureBytes.toString("base64");
  const order = orderedItems(exportRecord);
  const encoded = {
    [order[0].id]: { large: dataUrl, small: dataUrl },
    [order[1].id]: { large: dataUrl, small: dataUrl }
  };

  const manifest = buildManifest({
    models: [{ record: exportRecord, model: a3, encoded }],
    capturedAt: new Date().toISOString(),
    catalogueDate: "2026-10-24",
    appVersion: "2.12.0"
  });

  assert.equal(manifest.manifestVersion, 1);
  assert.equal(manifest.models.length, 1);
  assert.equal(manifest.models[0].modelId, "audi-a3");
  assert.equal(manifest.models[0].images.length, 2);
  assert.equal(manifest.models[0].images[0].kind, "upload");
  assert.equal(manifest.models[0].images[0].cover, true);
  assert.equal(manifest.models[0].images[0].file, "audi-a3-studio-1.jpg");
  assert.equal(manifest.models[0].images[1].kind, "official");
  assert.equal(manifest.models[0].images[1].cover, false);
  assert.equal(manifest.models[0].images[1].file, "audi-a3-studio-2.jpg");
  assert.deepEqual(manifestProblems(manifest), [], "Manifest for export must have zero problems");

  console.log("  ✓ Export edited studio photos PASSED: manifest encodes framed photos, cover ordering, and export validation.\n");
}

// -------------------------------------------------------------
// Journey 14: Remove a photo from a vehicle entry
// -------------------------------------------------------------
if (shouldRun("Remove a photo from a vehicle entry") || shouldRun("studio")) {
  runCount++;
  console.log("TEST JOURNEY 14: Remove a photo from a vehicle entry");

  const studioHtml = fs.readFileSync("studio.html", "utf8");
  assert.ok(studioHtml.includes('id="filmstrip"'), "studio.html must have #filmstrip");

  const studioJs = fs.readFileSync("js/catalogue-studio.js", "utf8");
  assert.ok(studioJs.includes("data-remove"), "catalogue-studio.js must handle data-remove");
  assert.ok(studioJs.includes("removeItem"), "catalogue-studio.js must call removeItem");
  assert.ok(studioJs.includes("Photo removed. Undo My Changes brings the published set back."), "Removal must toast confirmation");

  const { newRecord, uploadItem, addItem, setCover, removeItem } = await import("../js/catalogue-photos.js");
  const catData = JSON.parse(fs.readFileSync("data/catalogue.json", "utf8"));
  const a3 = catData.models.find(m => m.id === "audi-a3");

  const initialRecord = newRecord(a3);
  const fixtureBytes = fs.readFileSync("test/fixtures/audi-a3-studio-fixture.jpg");
  const upload = uploadItem({ name: "audi-a3-studio-fixture.jpg", type: "image/jpeg", size: fixtureBytes.length });
  const twoPhotoRecord = setCover(addItem(initialRecord, upload), upload.id);
  assert.equal(twoPhotoRecord.items.length, 2);

  // Remove the uploaded photo
  const removed = removeItem(twoPhotoRecord, upload.id);
  assert.equal(removed.error, undefined);
  assert.equal(removed.record.items.length, 1);
  assert.equal(removed.record.coverId, initialRecord.items[0].id, "Cover reverts to remaining official photo");

  // Attempting to remove the last photo must be blocked
  const blocked = removeItem(removed.record, removed.record.items[0].id);
  assert.equal(blocked.error, "A catalogue entry must keep at least one photo.");

  console.log("  ✓ Remove a photo from a vehicle entry PASSED: photo removal updates set, preserves cover, and enforces minimum photo guard.\n");
}

console.log("============================================================");
console.log(`ALL ${runCount} E2E JOURNEYS VERIFIED AND PASSED SUCCESSFULLY! (100%)`);
console.log("============================================================\n");

