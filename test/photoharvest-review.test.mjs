import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  validHarvestApproval, validateReviewDocument, readReviewFolder,
} from "../js/photoharvest-review.js";

const bytes = new TextEncoder().encode("example image bytes!");
const hash = createHash("sha256").update(bytes).digest("hex");
const candidate = {
  id: hash.slice(0, 24), file: "images/" + hash.slice(0, 24) + ".jpg",
  sha256: hash, bytes: bytes.length + 2048, width: 1200, height: 800,
  reviewStatus: "pending", rightsStatus: "unverified", modelMatchStatus: "unverified",
  originPageUrl: "https://maker.example/model", sourceImageUrl: "https://maker.example/car.jpg",
  resolvedImageUrl: "https://cdn.example/car.jpg", sourceKind: "web-url",
};
const manifest = {
  schemaVersion: 1, kind: "vahanaiq-photoharvest-review",
  publicationAllowed: false, catalogueModelId: "test-car",
  acquisitionManifest: { version: 1, status: "completed", sha256: "a".repeat(64) },
  candidates: [candidate],
};
assert.equal(validateReviewDocument(manifest, "test-car"), manifest);
for (const altered of [
  { ...manifest, publicationAllowed: true },
  { ...manifest, catalogueModelId: "other-car" },
  { ...manifest, acquisitionManifest: { ...manifest.acquisitionManifest, status: "in-progress" } },
  { ...manifest, candidates: [{ ...candidate, file: "../outside.jpg" }] },
  { ...manifest, candidates: [{ ...candidate, rightsStatus: "approved" }] },
  { ...manifest, candidates: [{ ...candidate, sourceImageUrl: "javascript:alert(1)" }] },
]) assert.throws(() => validateReviewDocument(altered, "test-car"));

const item = {
  kind: "harvest", sha256: hash, sourcePage: "https://maker.example/model",
  url: "https://maker.example/car.jpg", reviewStatus: "pending",
};
assert.equal(validHarvestApproval(item), false);
item.reviewStatus = "approved";
item.approval = {
  modelConfirmed: true, rightsConfirmed: true, rightsBasis: "licensed",
  rightsEvidenceUrl: "https://maker.example/licence", approvedAt: "2026-10-30T00:00:00Z",
};
assert.equal(validHarvestApproval(item), true);
item.approval.rightsConfirmed = false;
assert.equal(validHarvestApproval(item), false);

// Folder picker validation fails before decoding if the user did not supply
// exactly one folder, or the manifest is malformed.
await assert.rejects(() => readReviewFolder([], "test-car"), /Choose one/);
await assert.rejects(() => readReviewFolder([{ webkitRelativePath: "../bad", size: 1 }], "test-car"), /must be selected/);
console.log("PhotoHarvest browser review contract verified");
