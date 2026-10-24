// The catalogue page shows the photos kept by the Photo Studio: the same records the studio writes,
// read back here and framed into the published image shape. Nothing is uploaded and nothing is
// committed — the published catalogue only changes through scripts/apply-studio-photos.mjs.
//
// catalogue.html creates window.__VAHANAIQ_PHOTO_READY__ synchronously, so this module and the page
// can finish in either order: the page waits for it, and it hands back the function that applies the
// saved photos to the loaded catalogue.
import {
  FRAME_HEIGHT, FRAME_WIDTH, THUMB_HEIGHT, THUMB_WIDTH, bakePhoto, canvasDataUrl, loadPhoto,
  measurePhoto, renderFrame, resolveMode, dragFrame, zoomFrame, fillFrame, defaultFrame
} from "./photo-frame.js?v=2.11.3";
import {
  UPLOAD, OFFICIAL, newRecord, uploadItem, addItem, removeItem, setCover, updateFrame,
  normaliseRecord, orderedItems, recordIsEdited
} from "./catalogue-photos.js?v=2.11.3";
import { readEdit, writeEdit, deleteEdit, readEditsWithin } from "./catalogue-photo-store.js?v=2.11.3";

const STUDIO_NOTE = "Framed in the VAHANAIQ Photo Studio on this device.";
const STUDIO_CAPTION = "Photo added in the Photo Studio";

async function framed(item, published) {
  const objectUrl = item.kind === UPLOAD ? URL.createObjectURL(item.blob) : "";
  const image = await loadPhoto(objectUrl || item.src);
  const measured = measurePhoto(image);
  const spec = { background: measured.background, trim: measured.trim };
  const sized = size => canvasDataUrl(bakePhoto(image, spec, item.frame, { width: size.width, height: size.height }));
  const result = {
    sha256: item.sha256 || "",
    url: item.url || "",
    sourcePage: item.sourcePage || "",
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    src: sized({ width: FRAME_WIDTH, height: FRAME_HEIGHT }),
    smallSrc: sized({ width: THUMB_WIDTH, height: THUMB_HEIGHT }),
    caption: item.kind === UPLOAD ? STUDIO_CAPTION : (published ? published.caption : item.caption) || STUDIO_CAPTION,
    note: item.kind === UPLOAD ? "Your own photo. It stays in this browser and is not published." : (published ? published.note : "") || STUDIO_NOTE,
    studio: true,
    // The same vocabulary scripts/apply-studio-photos.mjs writes, so a card behaves identically
    // whether the photo is only in this browser or has been published.
    origin: item.kind === UPLOAD ? "owner-upload" : "official-reframe"
  };
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  return result;
}

// Replaces the published photos of every entry the studio has changed. An entry whose photos all
// fail to load keeps what the catalogue already had.
async function applyPhotos(data) {
  if (!data || !Array.isArray(data.models)) return false;
  for (const model of data.models) {
    if (!model.originalImages) model.originalImages = (model.images || []).slice();
  }
  let records = [];
  try {
    records = await readEditsWithin();
  } catch {
    return false;
  }
  let applied = 0;
  for (const row of records) {
    const record = normaliseRecord(row);
    const model = record ? data.models.find(entry => entry.id === record.modelId) : null;
    if (!model) continue;
    const published = new Map((model.originalImages || model.images || []).map(image => [image.sha256, image]));
    const images = [];
    for (const item of orderedItems(record)) {
      const original = published.get(item.sha256);
      try {
        images.push(await framed(item, original));
      } catch {
        // A photo that cannot be read is left out rather than breaking the page, except for a
        // published image, where the entry keeps exactly what the catalogue already had.
        if (original) images.push(original);
      }
    }
    if (!images.length) continue;
    model.images = images;
    applied += 1;
  }
  return applied > 0;
}

async function setCoverPhoto(model, photoIndex) {
  if (!model || !model.images || photoIndex < 0 || photoIndex >= model.images.length) return null;
  const modelId = model.modelId || model.id;
  const existing = await readEdit(modelId);
  let record = existing ? normaliseRecord(existing) : newRecord(model);
  const items = orderedItems(record);
  const targetItem = items[photoIndex];
  if (!targetItem) return null;
  record = setCover(record, targetItem.id);
  await writeEdit(record);

  const published = new Map((model.originalImages || model.images).map(img => [img.sha256, img]));
  const images = [];
  for (const item of orderedItems(record)) {
    const original = published.get(item.sha256);
    try {
      images.push(await framed(item, original));
    } catch {
      if (original) images.push(original);
    }
  }
  model.images = images;
  return { success: true, images };
}

async function addPhotos(model, fileList) {
  if (!model || !fileList || !fileList.length) return null;
  const incoming = [...fileList].filter(f => f && /^image\//.test(f.type || ""));
  if (!incoming.length) return null;
  const modelId = model.modelId || model.id;
  const existing = await readEdit(modelId);
  let record = existing ? normaliseRecord(existing) : newRecord(model);
  for (const file of incoming) {
    const item = uploadItem(file);
    record = addItem(record, item);
  }
  await writeEdit(record);

  const published = new Map((model.originalImages || model.images).map(img => [img.sha256, img]));
  const images = [];
  for (const item of orderedItems(record)) {
    const original = published.get(item.sha256);
    try {
      images.push(await framed(item, original));
    } catch {
      if (original) images.push(original);
    }
  }
  model.images = images;
  return { success: true, addedCount: incoming.length, images };
}

async function removePhoto(model, photoIndex) {
  if (!model || !model.images || model.images.length < 2 || photoIndex < 0 || photoIndex >= model.images.length) {
    return { success: false, error: "A catalogue entry must keep at least one photo." };
  }
  const modelId = model.modelId || model.id;
  const existing = await readEdit(modelId);
  let record = existing ? normaliseRecord(existing) : newRecord(model);
  const items = orderedItems(record);
  const targetItem = items[photoIndex];
  if (!targetItem) return { success: false, error: "Photo not found." };
  const res = removeItem(record, targetItem.id);
  if (res.error) return { success: false, error: res.error };
  record = res.record;
  if (!recordIsEdited(record, model)) {
    await deleteEdit(modelId);
  } else {
    await writeEdit(record);
  }

  const published = new Map((model.originalImages || model.images).map(img => [img.sha256, img]));
  const images = [];
  for (const item of orderedItems(record)) {
    const original = published.get(item.sha256);
    try {
      images.push(await framed(item, original));
    } catch {
      if (original) images.push(original);
    }
  }
  model.images = images;
  return { success: true, images };
}

async function resetModel(model) {
  if (!model) return false;
  const modelId = model.modelId || model.id;
  await deleteEdit(modelId);
  if (model.originalImages) {
    model.images = [...model.originalImages];
  }
  return { success: true, images: model.images };
}

async function hasEdits(modelId) {
  if (!modelId) return false;
  const row = await readEdit(modelId);
  return Boolean(row);
}

// Loads the un-framed photo, background and trim box for inline canvas editing
async function getPhotoDetails(model, photoIndex) {
  if (!model || !model.images || photoIndex < 0 || photoIndex >= model.images.length) return null;
  const modelId = model.modelId || model.id;
  const existing = await readEdit(modelId);
  let record = existing ? normaliseRecord(existing) : newRecord(model);
  const items = orderedItems(record);
  const item = items[photoIndex];
  if (!item) return null;
  const objectUrl = item.kind === UPLOAD ? URL.createObjectURL(item.blob) : "";
  const image = await loadPhoto(objectUrl || item.src);
  const measured = measurePhoto(image);
  const spec = { source: measured.source, background: measured.background, trim: measured.trim };
  return {
    item,
    image,
    source: measured.source,
    spec,
    frame: { ...(item.frame || defaultFrame()) },
    objectUrl
  };
}

// Updates framing for a photo and re-renders framed pixels
async function updatePhotoFrame(model, photoIndex, frame) {
  if (!model || !model.images || photoIndex < 0 || photoIndex >= model.images.length) return null;
  const modelId = model.modelId || model.id;
  const existing = await readEdit(modelId);
  let record = existing ? normaliseRecord(existing) : newRecord(model);
  const items = orderedItems(record);
  const item = items[photoIndex];
  if (!item) return null;
  record = updateFrame(record, item.id, frame);
  await writeEdit(record);

  const published = new Map((model.originalImages || model.images).map(img => [img.sha256, img]));
  const images = [];
  for (const it of orderedItems(record)) {
    const original = published.get(it.sha256);
    try {
      images.push(await framed(it, original));
    } catch {
      if (original) images.push(original);
    }
  }
  model.images = images;
  return { success: true, images };
}

// catalogue.html sets up window.__VAHANAIQ_PHOTOS__ synchronously, so this module and the page can
// finish in either order: the page waits on the ready promise, and this hands it the function that
// applies the saved photos to the loaded catalogue.
const studio = globalThis.__VAHANAIQ_PHOTOS__;
if (studio) {
  studio.apply = applyPhotos;
  studio.setCover = setCoverPhoto;
  studio.addPhotos = addPhotos;
  studio.removePhoto = removePhoto;
  studio.resetModel = resetModel;
  studio.hasEdits = hasEdits;
  studio.getPhotoDetails = getPhotoDetails;
  studio.updateFrame = updatePhotoFrame;
  studio.loadPhoto = loadPhoto;
  studio.renderFrame = renderFrame;
  studio.resolveMode = resolveMode;
  studio.dragFrame = dragFrame;
  studio.zoomFrame = zoomFrame;
  studio.fillFrame = fillFrame;
  studio.defaultFrame = defaultFrame;
  if (typeof studio.resolve === "function") studio.resolve(applyPhotos);
}