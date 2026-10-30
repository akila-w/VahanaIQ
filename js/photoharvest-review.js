// Client-only import of VahanaIQ's unapproved PhotoHarvest review folders.
// A folder picker never uploads bytes; signatures and hashes are checked locally.
export const HARVEST = "harvest";
const SHA256 = /^[0-9a-f]{64}$/;
const IMAGE_NAME = /^images\/[0-9a-f]{24}\.(?:jpe?g|png|webp|gif)$/;
const MAX_MANIFEST = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_CANDIDATES = 80;

const isHttps = url => {
  if (typeof url !== "string" || !url || /[\s\\]/.test(url)) return false;
  try { const parsed = new URL(url); return parsed.protocol === "https:" && !!parsed.hostname && !parsed.username && !parsed.password; }
  catch { return false; }
};
const isOptionalHttps = url => url == null || isHttps(url);

export function validHarvestApproval(item) {
  if (!item || item.kind !== HARVEST || item.reviewStatus !== "approved") return false;
  const approval = item.approval;
  return !!(approval && approval.modelConfirmed === true && approval.rightsConfirmed === true
    && ["licensed", "owner-permission", "public-domain"].includes(approval.rightsBasis)
    && isHttps(approval.rightsEvidenceUrl) && isHttps(item.sourcePage)
    && isHttps(item.url) && SHA256.test(item.sha256 || "")
    && typeof approval.approvedAt === "string" && !Number.isNaN(Date.parse(approval.approvedAt)));
}

export function validateReviewDocument(document, expectedModelId) {
  if (!document || document.schemaVersion !== 1 || document.kind !== "vahanaiq-photoharvest-review"
    || document.publicationAllowed !== false || document.catalogueModelId !== expectedModelId
    || !Array.isArray(document.candidates) || !document.candidates.length
    || document.candidates.length > MAX_CANDIDATES) {
    throw Error("This is not a compatible pending PhotoHarvest review for the selected catalogue model.");
  }
  if (!document.acquisitionManifest || document.acquisitionManifest.version !== 1
    || document.acquisitionManifest.status !== "completed" || !SHA256.test(document.acquisitionManifest.sha256 || "")) {
    throw Error("An incomplete, legacy or unprovenanced review cannot be imported through Photo Studio.");
  }
  const names = new Set(), digests = new Set();
  for (const candidate of document.candidates) {
    if (!candidate || !IMAGE_NAME.test(candidate.file || "")
      || !SHA256.test(candidate.sha256 || "")
      || !candidate.file.startsWith("images/" + candidate.sha256.slice(0, 24) + ".")
      || candidate.id !== candidate.sha256.slice(0, 24)
      || !Number.isSafeInteger(candidate.bytes) || candidate.bytes < 1024 || candidate.bytes > MAX_FILE_BYTES
      || !Number.isSafeInteger(candidate.width) || candidate.width < 240
      || !Number.isSafeInteger(candidate.height) || candidate.height < 120
      || candidate.width * candidate.height > 40_000_000
      || candidate.reviewStatus !== "pending" || candidate.rightsStatus !== "unverified"
      || candidate.modelMatchStatus !== "unverified"
      || !isOptionalHttps(candidate.originPageUrl)
      || !isOptionalHttps(candidate.sourceImageUrl)
      || !isOptionalHttps(candidate.resolvedImageUrl)
      || !["inline-data", "web-url"].includes(candidate.sourceKind)
      || names.has(candidate.file) || digests.has(candidate.sha256)) {
      throw Error("Review bundle contains malformed or unexpectedly approved image metadata.");
    }
    names.add(candidate.file);
    digests.add(candidate.sha256);
  }
  return document;
}

export async function readReviewFolder(fileList, expectedModelId, { digest } = {}) {
  const files = [...(fileList || [])];
  if (!files.length || files.length > 300) throw Error("Choose one PhotoHarvest review folder (at most 300 files).");
  const roots = new Map();
  for (const file of files) {
    const rel = file.webkitRelativePath || "";
    if (!rel || rel.startsWith("/") || rel.includes("\\") || rel.split("/").includes("..")) {
      throw Error("A PhotoHarvest folder must be selected, not individual files.");
    }
    const slash = rel.indexOf("/");
    if (slash < 1) throw Error("Expected one review folder root.");
    const root = rel.slice(0, slash), rest = rel.slice(slash + 1);
    if (!rest || (roots.has(root) && roots.get(root).has(rest))) throw Error("Duplicate or invalid folder entries.");
    if (!roots.has(root)) roots.set(root, new Map());
    roots.get(root).set(rest, file);
  }
  if (roots.size !== 1) throw Error("Select exactly one review folder.");
  const filesByPath = [...roots.values()][0], manifestFile = filesByPath.get("review-manifest.json");
  if (!manifestFile || manifestFile.size > MAX_MANIFEST || manifestFile.size < 1) {
    throw Error("Review folder has no valid review-manifest.json.");
  }
  const document = validateReviewDocument(JSON.parse(await manifestFile.text()), expectedModelId);
  if (!globalThis.crypto?.subtle && !digest) throw Error("This browser needs WebCrypto to verify image hashes.");
  const sha = digest || (async bytes => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map(value => value.toString(16).padStart(2, "0")).join(""));
  const matched = [];
  for (const item of document.candidates) {
    const file = filesByPath.get(item.file);
    if (!file || file.size !== item.bytes) throw Error("Missing or modified reviewed image: " + item.file);
    const bytes = await file.arrayBuffer();
    const actual = await sha(bytes);
    if (actual !== item.sha256) throw Error("SHA-256 mismatch for " + item.file);
    // A digest match proves consistency with this manifest, not source ownership.
    matched.push({ file, candidate: item });
  }
  return { modelId: expectedModelId, manifest: document, matched };
}
