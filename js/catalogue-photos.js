// The Photo Studio's record for one catalogue entry: which photos it shows, in what order, which one
// is the cover, and how each photo is framed. Pure data handling, shared by the studio page, the
// catalogue overlay and scripts/apply-studio-photos.mjs, and checked in Node.
import { defaultFrame, isDefaultFrame, normaliseFrame } from "./photo-frame.js?v=2.11.6";

export const RECORD_VERSION = 1;
export const MANIFEST_VERSION = 1;
export const OFFICIAL = "official";
export const UPLOAD = "upload";

export const officialKey = sha256 => `${OFFICIAL}:${sha256}`;
export const uploadKey = id => `${UPLOAD}:${id}`;

// The published photos of an entry, as the studio shows them before anything is changed.
export function officialItems(model) {
  return (model?.images || []).map((image, index) => ({
    id: officialKey(image.sha256 || `${model.id}-${index}`),
    kind: OFFICIAL,
    sha256: image.sha256 || "",
    url: image.url || "",
    sourcePage: image.sourcePage || "",
    caption: image.caption || "",
    src: image.src || "",
    smallSrc: image.smallSrc || "",
    frame: defaultFrame()
  }));
}

export function newRecord(model, at) {
  const items = officialItems(model);
  return {
    version: RECORD_VERSION,
    modelId: model.id,
    name: model.name || model.id,
    updatedAt: at || new Date().toISOString(),
    coverId: items[0] ? items[0].id : null,
    items
  };
}

let uploadCounter = 0;

// An uploaded file. The blob stays with the record on this device, and is never uploaded anywhere.
export function uploadItem(file, at) {
  uploadCounter += 1;
  const id = globalThis.crypto?.randomUUID?.() || `u${Date.now().toString(36)}-${uploadCounter}`;
  return {
    id: uploadKey(id),
    kind: UPLOAD,
    name: file.name || "Photo",
    type: file.type || "image/jpeg",
    size: Number(file.size) || 0,
    addedAt: at || new Date().toISOString(),
    blob: file,
    frame: defaultFrame()
  };
}

export function itemById(record, id) {
  return (record?.items || []).find(item => item.id === id) || null;
}

// Anything read back from the browser is treated as untrusted.
export function normaliseRecord(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.modelId !== "string" || !raw.modelId) return null;
  const items = (Array.isArray(raw.items) ? raw.items : []).map(item => {
    if (!item || typeof item.id !== "string" || !item.id) return null;
    return {
      ...item,
      kind: item.kind === UPLOAD ? UPLOAD : OFFICIAL,
      frame: normaliseFrame(item.frame),
      name: typeof item.name === "string" ? item.name : "",
      caption: typeof item.caption === "string" ? item.caption : ""
    };
  }).filter(Boolean);
  if (!items.length) return null;
  return {
    version: RECORD_VERSION,
    modelId: raw.modelId,
    name: typeof raw.name === "string" ? raw.name : raw.modelId,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    coverId: items.some(item => item.id === raw.coverId) ? raw.coverId : items[0].id,
    items
  };
}

// The catalogue shows the cover first, then the rest in the arranged order.
export function orderedItems(record) {
  const items = record?.items || [];
  const cover = items.find(item => item.id === record.coverId);
  return cover ? [cover, ...items.filter(item => item !== cover)] : items.slice();
}

export function setCover(record, id) {
  return itemById(record, id) ? { ...record, coverId: id } : record;
}

export function moveItem(record, id, delta) {
  const index = record.items.findIndex(item => item.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= record.items.length) return record;
  const items = record.items.slice();
  items.splice(target, 0, ...items.splice(index, 1));
  return { ...record, items };
}

// The catalogue always shows at least one photo, so the last one cannot go.
export function removeItem(record, id) {
  if (!itemById(record, id)) return { record, error: "That photo is not in this entry any more." };
  if (record.items.length < 2) return { record, error: "A catalogue entry must keep at least one photo." };
  const items = record.items.filter(item => item.id !== id);
  return { record: { ...record, items, coverId: record.coverId === id ? items[0].id : record.coverId } };
}

export function addItem(record, item) {
  return { ...record, items: [...record.items, item], coverId: record.coverId || item.id };
}

export function updateFrame(record, id, frame) {
  return {
    ...record,
    items: record.items.map(item => (item.id === id ? { ...item, frame: normaliseFrame(frame) } : item))
  };
}

export function resetFrame(record, id) {
  return { ...record, items: record.items.map(item => (item.id === id ? { ...item, frame: defaultFrame() } : item)) };
}

// True when the record would change what the published catalogue entry shows, so the studio can mark
// edited entries and the page can say whose photo is on the card.
export function recordIsEdited(record, model) {
  if (!record || !model) return false;
  const published = officialItems(model);
  if (record.items.length !== published.length) return true;
  if (record.items.some(item => item.kind === UPLOAD)) return true;
  for (const item of record.items) {
    if (!published.some(known => known.id === item.id)) return true;
    if (!isDefaultFrame(item.frame)) return true;
  }
  return record.coverId !== (published[0] ? published[0].id : null);
}

export function editedModelIds(records) {
  return Object.values(records || {}).filter(Boolean).map(record => record.modelId).sort();
}

// ---------------------------- export ----------------------------

// The framed pixels are encoded by the browser, which can read the photo and draw the frame, and the
// manifest carries them, so scripts/apply-studio-photos.mjs needs no image library of its own.
export function fileNameFor(modelId, index, size) {
  return `${modelId}-studio-${index + 1}${size === "small" ? "-640" : ""}.jpg`;
}

// encoded maps an item id to { large, small } data URLs.
export function buildManifest({ models, capturedAt, catalogueDate, appVersion }) {
  return {
    manifestVersion: MANIFEST_VERSION,
    generatedAt: capturedAt || new Date().toISOString(),
    catalogueDate: catalogueDate || "",
    appVersion: appVersion || "",
    models: (models || []).map(({ record, model, encoded }) => ({
      modelId: record.modelId,
      name: model && model.name ? model.name : (record.name || record.modelId),
      images: orderedItems(record).map((item, index) => ({
        index,
        kind: item.kind,
        id: item.id,
        cover: index === 0,
        frame: normaliseFrame(item.frame),
        name: item.name || "",
        caption: item.caption || "",
        sha256: item.sha256 || "",
        sourcePage: item.sourcePage || "",
        url: item.url || "",
        file: fileNameFor(record.modelId, index, "large"),
        smallFile: fileNameFor(record.modelId, index, "small"),
        encoded: (encoded && encoded[item.id]) || null
      }))
    }))
  };
}

export function manifestFileName(at = new Date()) {
  return `vahanaiq-studio-photos-${at.toISOString().slice(0, 10)}.json`;
}

// The problems the studio shows before offering a file, and that the bake script refuses to apply.
export function manifestProblems(manifest) {
  const problems = [];
  const models = manifest?.models;
  if (!Array.isArray(models) || !models.length) problems.push("Nothing to export: no entry has been changed yet.");
  for (const model of models || []) {
    const label = model?.modelId || "An entry";
    if (!model?.modelId) problems.push("An entry is missing its catalogue id.");
    if (!Array.isArray(model?.images) || !model.images.length) problems.push(`${label} has no photos.`);
    (model?.images || []).forEach((image, index) => {
      for (const size of ["large", "small"]) {
        if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image?.encoded?.[size] || "")) {
          problems.push(`${label} photo ${index + 1} has no framed ${size === "large" ? "1280x800" : "640x400"} pixels.`);
        }
      }
      if (!/^[a-z0-9][a-z0-9-]*(-640)?\.jpg$/.test(image?.file || "")) problems.push(`${label} photo ${index + 1} has an unsafe file name.`);
      if (!/^[a-z0-9][a-z0-9-]*-640\.jpg$/.test(image?.smallFile || "")) problems.push(`${label} photo ${index + 1} has an unsafe thumbnail name.`);
    });
  }
  return problems;
}