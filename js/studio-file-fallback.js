(function() {
  if (typeof window !== "undefined" && window.location.protocol !== "file:") return;
  const __mods = {};
  // === config.js ===
  __mods.mod_1_config = {};
  (function(__exports) {
// VahanaIQ Platform Configuration
// -------------------------------------------------------------
// AI vehicle search goes through a serverless proxy (see /serverless) that
// holds the Gemini API key and model choice, so no key is ever in the browser.
const APP_VERSION = "2.11.6";

const config = {
  proxyUrl: "https://vahanaiq-search-71962876227.asia-south1.run.app"
};

// Google sign-in and sync (js/account.js). This web config is public by design: Firebase
// identifies the project with it, and firestore.rules decide who can read or write what.
const firebaseConfig = {
  apiKey: "AIzaSyB7y80tXqmjxVf_jy9SOTo2x_yXWYhVquU",
  authDomain: "vahanaiq-sign-in.firebaseapp.com",
  projectId: "vahanaiq-sign-in",
  storageBucket: "vahanaiq-sign-in.firebasestorage.app",
  messagingSenderId: "376324722920",
  appId: "1:376324722920:web:c20f16fe322420ecfaf95d"
};

// Google's own sign-in button (Google Identity Services) for the project's web OAuth client.
// Firebase's sign-in pop-up stalls in Safari, which blocks the cross-site storage it relies on;
// this button hands an ID token straight to the page, and Firebase signs in with it.
const GOOGLE_CLIENT_ID = "376324722920-0btrupeuvlepdl7rtsckljq8g3fftpq8.apps.googleusercontent.com";
const GOOGLE_SIGN_IN_SRC = "https://accounts.google.com/gsi/client?hl=en";

// Firebase's modular SDK, loaded from Google's CDN only when someone signs in
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/12.19.0";

  __exports.APP_VERSION = APP_VERSION;
  __exports.config = config;
  __exports.firebaseConfig = firebaseConfig;
  __exports.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
  __exports.GOOGLE_SIGN_IN_SRC = GOOGLE_SIGN_IN_SRC;
  __exports.FIREBASE_SDK = FIREBASE_SDK;
  })(__mods.mod_1_config);

  // === photo-frame.js ===
  __mods.mod_2_photo_frame = {};
  (function(__exports) {
// The 8:5 catalogue frame, shared by the Photo Studio, the catalogue overlay and the bake script.
// The geometry mirrors scripts/build-curated-catalogue.py, so a frame set by hand here exports to
// the same pixels the build produces: a photo on a plain background is trimmed to the vehicle and
// fitted onto a white plate, and any other photo is cropped to 8:5 around the chosen focus point.
// Everything apart from the canvas helpers is pure, so the geometry is checked in Node.

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 800;
const THUMB_WIDTH = 640;
const THUMB_HEIGHT = 400;
const FRAME_RATIO = FRAME_WIDTH / FRAME_HEIGHT;
// The box a vehicle is fitted into at zoom 1 (the build script uses 1160 x 680).
const PLATE_WIDTH = 1160;
const PLATE_HEIGHT = 680;
const MODES = ["auto", "plate", "scene"];
const MIN_ZOOM = 1;
const MIN_PLATE_ZOOM = 0.5;
const MAX_ZOOM = 3;
// The build treats a pixel as content when its distance from white passes this (0-255).
const TRIM_THRESHOLD = 24;
// The corners are read from a small copy of the photo, which is averaged; a white studio backdrop
// stays well above the build's 238.
const WHITE_CORNER = 238;
const MEASURE_SIDE = 512;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);

function defaultFrame() {
  return { zoom: 1, focusX: 0.5, focusY: 0.5, mode: "auto" };
}

function zoomRange(mode) {
  return mode === "scene" ? { min: MIN_ZOOM, max: MAX_ZOOM } : { min: MIN_PLATE_ZOOM, max: MAX_ZOOM };
}

function clampZoom(mode, zoom) {
  const range = zoomRange(mode);
  return clamp(finite(zoom, 1), range.min, range.max);
}

// Keeps a frame inside its limits, whatever a stored record or a crafted file claims.
function normaliseFrame(frame) {
  const mode = MODES.includes(frame?.mode) ? frame.mode : "auto";
  return {
    mode,
    zoom: clampZoom(mode, frame?.zoom),
    focusX: clamp(finite(frame?.focusX, 0.5), 0, 1),
    focusY: clamp(finite(frame?.focusY, 0.5), 0, 1)
  };
}

function isDefaultFrame(frame) {
  const f = normaliseFrame(frame);
  return f.zoom === 1 && f.focusX === 0.5 && f.focusY === 0.5 && f.mode === "auto";
}

// Reads a sample of pixels (see measurePhoto) the way the build reads the original: a fully opaque
// photo over white corners is a studio shot, anything else is a scene.
function backgroundKind(sample) {
  const { width, height, data } = sample;
  let transparent = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) { transparent = true; break; }
  }
  const corner = (x, y) => {
    const i = (y * width + x) * 4;
    return Math.min(data[i], data[i + 1], data[i + 2]);
  };
  const white = [corner(0, 0), corner(width - 1, 0), corner(0, height - 1), corner(width - 1, height - 1)]
    .every(value => value > WHITE_CORNER);
  return { transparent, white };
}

// Which of the two frames a photo gets. 'auto' asks the photo itself, and an explicit choice wins.
function resolveMode(frame, background) {
  const mode = MODES.includes(frame?.mode) ? frame.mode : "auto";
  if (mode !== "auto") return mode;
  return background && (background.transparent || background.white) ? "plate" : "scene";
}

// Everything that is not the background, found the way the build finds it: flatten onto white, then
// keep what differs by more than the threshold. Null when the photo is blank.
function detectTrimBox(sample, threshold = TRIM_THRESHOLD) {
  const { width, height, data } = sample;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3] / 255;
      // Flattened onto white, so a photo with transparency behaves like the build's composite: the
      // difference from white is the channel value cut down by its own alpha.
      const distance = 0.299 * alpha * (255 - data[i])
        + 0.587 * alpha * (255 - data[i + 1])
        + 0.114 * alpha * (255 - data[i + 2]);
      if (distance > threshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < left || bottom < top) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

// The 8:5 window over the photo: its size follows the zoom and the focus point moves it. At zoom 1
// with the centred focus this is exactly the build's ImageOps.fit centre crop.
function sceneCropBox(source, frame) {
  const zoom = clampZoom("scene", frame?.zoom);
  const focusX = clamp(finite(frame?.focusX, 0.5), 0, 1);
  const focusY = clamp(finite(frame?.focusY, 0.5), 0, 1);
  let width, height;
  if (source.width / source.height >= FRAME_RATIO) {
    height = source.height;
    width = FRAME_RATIO * source.height;
  } else {
    width = source.width;
    height = source.width / FRAME_RATIO;
  }
  width /= zoom;
  height /= zoom;
  return { x: (source.width - width) * focusX, y: (source.height - height) * focusY, width, height };
}

// The plate frame: the trimmed vehicle is fitted into a plate that grows with the zoom, whatever
// runs past the frame is trimmed around the focus point, and the rest sits centred on white.
function plateLayout(source, trim, frame) {
  const f = normaliseFrame(frame);
  const box = trim && trim.width > 0 && trim.height > 0
    ? trim
    : { x: 0, y: 0, width: source.width, height: source.height };
  const scale = Math.min((PLATE_WIDTH * f.zoom) / box.width, (PLATE_HEIGHT * f.zoom) / box.height);
  const plateW = Math.max(1, Math.round(box.width * scale));
  const plateH = Math.max(1, Math.round(box.height * scale));
  const width = Math.min(plateW, FRAME_WIDTH);
  const height = Math.min(plateH, FRAME_HEIGHT);
  const left = Math.round((plateW - width) * f.focusX);
  const top = Math.round((plateH - height) * f.focusY);
  return {
    mode: "plate",
    scale,
    plate: { width: plateW, height: plateH },
    overflow: { x: plateW - width, y: plateH - height },
    source: { x: box.x + left / scale, y: box.y + top / scale, width: width / scale, height: height / scale },
    dest: {
      x: Math.floor((FRAME_WIDTH - width) * (1 - f.focusX)),
      y: Math.floor((FRAME_HEIGHT - height) * (1 - f.focusY)),
      width,
      height
    }
  };
}

function sceneLayout(source, frame) {
  return {
    mode: "scene",
    scale: 1,
    plate: null,
    overflow: { x: 0, y: 0 },
    source: sceneCropBox(source, frame),
    dest: { x: 0, y: 0, width: FRAME_WIDTH, height: FRAME_HEIGHT }
  };
}

// spec is { background, trim }, both taken from measurePhoto.
function layoutFor(source, spec, frame) {
  const resolved = resolveMode(frame, spec?.background);
  return resolved === "plate" ? plateLayout(source, spec?.trim, frame) : sceneLayout(source, frame);
}

// Dragging the photo keeps the pixel under the pointer in place. The distance arrives in view
// pixels, so the same drag feels the same at any preview size.
function dragFrame(source, spec, frame, view, deltaX, deltaY) {
  const f = normaliseFrame(frame);
  const layout = layoutFor(source, spec, f);
  const visible = layout.source;
  const viewW = Math.max(1, finite(view?.width, FRAME_WIDTH));
  const viewH = Math.max(1, finite(view?.height, FRAME_HEIGHT));
  const stepX = visible.width / viewW;
  const stepY = visible.height / viewH;
  if (layout.mode === "plate") {
    const overflow = layout.overflow;
    const slackX = FRAME_WIDTH - layout.dest.width;
    const slackY = FRAME_HEIGHT - layout.dest.height;
    const left = (layout.plate.width - visible.width * layout.scale) * f.focusX;
    const top = (layout.plate.height - visible.height * layout.scale) * f.focusY;
    return normaliseFrame({
      ...f,
      focusX: overflow.x > 0
        ? (left - deltaX * stepX * layout.scale) / overflow.x
        : (slackX > 0 ? f.focusX - (deltaX * (FRAME_WIDTH / viewW)) / slackX : f.focusX),
      focusY: overflow.y > 0
        ? (top - deltaY * stepY * layout.scale) / overflow.y
        : (slackY > 0 ? f.focusY - (deltaY * (FRAME_HEIGHT / viewH)) / slackY : f.focusY)
    });
  }
  const freeX = source.width - visible.width;
  const freeY = source.height - visible.height;
  return normaliseFrame({
    ...f,
    focusX: freeX > 0 ? f.focusX - (deltaX * stepX) / freeX : f.focusX,
    focusY: freeY > 0 ? f.focusY - (deltaY * stepY) / freeY : f.focusY
  });
}

// Zooming about a point of the frame (the centre unless asked otherwise) leaves that point where it
// is. On the plate the photo is centred first and trimmed afterwards, so the focus point is kept.
function zoomFrame(source, spec, frame, factor, anchor) {
  const f = normaliseFrame(frame);
  const mode = resolveMode(f, spec?.background);
  const zoom = clampZoom(mode, f.zoom * finite(factor, 1));
  if (mode === "plate") return normaliseFrame({ ...f, zoom });
  const ax = clamp(finite(anchor?.x, 0.5), 0, 1);
  const ay = clamp(finite(anchor?.y, 0.5), 0, 1);
  const before = sceneCropBox(source, f);
  const point = { x: before.x + ax * before.width, y: before.y + ay * before.height };
  const after = sceneCropBox(source, { ...f, zoom });
  const freeX = source.width - after.width;
  const freeY = source.height - after.height;
  return normaliseFrame({
    ...f,
    zoom,
    focusX: freeX > 0 ? (point.x - ax * after.width) / freeX : 0.5,
    focusY: freeY > 0 ? (point.y - ay * after.height) / freeY : 0.5
  });
}

// The frame that shows as much of the photo as the mode allows: the plate fits the whole vehicle,
// while a scene crop cannot show more than the frame holds.
function fillFrame(source, spec, frame) {
  const f = normaliseFrame(frame);
  const zoom = resolveMode(f, spec?.background) === "plate" ? MIN_PLATE_ZOOM : MIN_ZOOM;
  return normaliseFrame({ ...f, zoom, focusX: 0.5, focusY: 0.5 });
}

// ---------------------------- browser helpers ----------------------------

function loadPhoto(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That photo could not be read."));
    image.src = source;
  });
}

function photoSource(image) {
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height
  };
}

// Measures a small copy of the photo: its background, and the box the vehicle occupies. Reading a
// 512-pixel copy keeps a full-size pixel scan off the main thread; the box is scaled back, so the
// build's own maths sees the same numbers.
function measurePhoto(image, maxSide = MEASURE_SIDE) {
  const source = photoSource(image);
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  const sample = { width, height, data: pixels.data };
  const background = backgroundKind(sample);
  const trim = detectTrimBox(sample);
  const back = 1 / scale;
  return {
    source,
    background,
    trimmed: Boolean(trim),
    trim: trim ? { x: trim.x * back, y: trim.y * back, width: trim.width * back, height: trim.height * back } : null
  };
}

// Draws the framed photo: a pure-white plate with the photo on it. Returns the layout it used.
function renderFrame(canvas, image, spec, frame, size) {
  const width = Math.max(1, Math.round(size?.width || FRAME_WIDTH));
  const height = Math.max(1, Math.round(size?.height || FRAME_HEIGHT));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const layout = layoutFor(photoSource(image), spec, frame);
  const k = width / FRAME_WIDTH;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image,
    layout.source.x, layout.source.y, layout.source.width, layout.source.height,
    layout.dest.x * k, layout.dest.y * k, layout.dest.width * k, layout.dest.height * k);
  return layout;
}

function bakePhoto(image, spec, frame, size) {
  const canvas = document.createElement("canvas");
  renderFrame(canvas, image, spec, frame, size);
  return canvas;
}

function canvasDataUrl(canvas, type = "image/jpeg", quality = 0.86) {
  return canvas.toDataURL(type, quality);
}
  __exports.defaultFrame = defaultFrame;
  __exports.zoomRange = zoomRange;
  __exports.clampZoom = clampZoom;
  __exports.normaliseFrame = normaliseFrame;
  __exports.isDefaultFrame = isDefaultFrame;
  __exports.backgroundKind = backgroundKind;
  __exports.resolveMode = resolveMode;
  __exports.detectTrimBox = detectTrimBox;
  __exports.sceneCropBox = sceneCropBox;
  __exports.plateLayout = plateLayout;
  __exports.sceneLayout = sceneLayout;
  __exports.layoutFor = layoutFor;
  __exports.dragFrame = dragFrame;
  __exports.zoomFrame = zoomFrame;
  __exports.fillFrame = fillFrame;
  __exports.loadPhoto = loadPhoto;
  __exports.photoSource = photoSource;
  __exports.measurePhoto = measurePhoto;
  __exports.renderFrame = renderFrame;
  __exports.bakePhoto = bakePhoto;
  __exports.canvasDataUrl = canvasDataUrl;
  __exports.FRAME_WIDTH = FRAME_WIDTH;
  __exports.FRAME_HEIGHT = FRAME_HEIGHT;
  __exports.THUMB_WIDTH = THUMB_WIDTH;
  __exports.THUMB_HEIGHT = THUMB_HEIGHT;
  __exports.FRAME_RATIO = FRAME_RATIO;
  __exports.PLATE_WIDTH = PLATE_WIDTH;
  __exports.PLATE_HEIGHT = PLATE_HEIGHT;
  __exports.MODES = MODES;
  __exports.MIN_ZOOM = MIN_ZOOM;
  __exports.MIN_PLATE_ZOOM = MIN_PLATE_ZOOM;
  __exports.MAX_ZOOM = MAX_ZOOM;
  __exports.TRIM_THRESHOLD = TRIM_THRESHOLD;
  })(__mods.mod_2_photo_frame);

  // === catalogue-photos.js ===
  __mods.mod_3_catalogue_photos = {};
  (function(__exports) {
// The Photo Studio's record for one catalogue entry: which photos it shows, in what order, which one
// is the cover, and how each photo is framed. Pure data handling, shared by the studio page, the
// catalogue overlay and scripts/apply-studio-photos.mjs, and checked in Node.
const {  defaultFrame, isDefaultFrame, normaliseFrame  } = __mods.mod_2_photo_frame;
const RECORD_VERSION = 1;
const MANIFEST_VERSION = 1;
const OFFICIAL = "official";
const UPLOAD = "upload";

const officialKey = sha256 => `${OFFICIAL}:${sha256}`;
const uploadKey = id => `${UPLOAD}:${id}`;

// The published photos of an entry, as the studio shows them before anything is changed.
function officialItems(model) {
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

function newRecord(model, at) {
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
function uploadItem(file, at) {
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

function itemById(record, id) {
  return (record?.items || []).find(item => item.id === id) || null;
}

// Anything read back from the browser is treated as untrusted.
function normaliseRecord(raw) {
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
function orderedItems(record) {
  const items = record?.items || [];
  const cover = items.find(item => item.id === record.coverId);
  return cover ? [cover, ...items.filter(item => item !== cover)] : items.slice();
}

function setCover(record, id) {
  return itemById(record, id) ? { ...record, coverId: id } : record;
}

function moveItem(record, id, delta) {
  const index = record.items.findIndex(item => item.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= record.items.length) return record;
  const items = record.items.slice();
  items.splice(target, 0, ...items.splice(index, 1));
  return { ...record, items };
}

// The catalogue always shows at least one photo, so the last one cannot go.
function removeItem(record, id) {
  if (!itemById(record, id)) return { record, error: "That photo is not in this entry any more." };
  if (record.items.length < 2) return { record, error: "A catalogue entry must keep at least one photo." };
  const items = record.items.filter(item => item.id !== id);
  return { record: { ...record, items, coverId: record.coverId === id ? items[0].id : record.coverId } };
}

function addItem(record, item) {
  return { ...record, items: [...record.items, item], coverId: record.coverId || item.id };
}

function updateFrame(record, id, frame) {
  return {
    ...record,
    items: record.items.map(item => (item.id === id ? { ...item, frame: normaliseFrame(frame) } : item))
  };
}

function resetFrame(record, id) {
  return { ...record, items: record.items.map(item => (item.id === id ? { ...item, frame: defaultFrame() } : item)) };
}

// True when the record would change what the published catalogue entry shows, so the studio can mark
// edited entries and the page can say whose photo is on the card.
function recordIsEdited(record, model) {
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

function editedModelIds(records) {
  return Object.values(records || {}).filter(Boolean).map(record => record.modelId).sort();
}

// ---------------------------- export ----------------------------

// The framed pixels are encoded by the browser, which can read the photo and draw the frame, and the
// manifest carries them, so scripts/apply-studio-photos.mjs needs no image library of its own.
function fileNameFor(modelId, index, size) {
  return `${modelId}-studio-${index + 1}${size === "small" ? "-640" : ""}.jpg`;
}

// encoded maps an item id to { large, small } data URLs.
function buildManifest({ models, capturedAt, catalogueDate, appVersion }) {
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

function manifestFileName(at = new Date()) {
  return `vahanaiq-studio-photos-${at.toISOString().slice(0, 10)}.json`;
}

// The problems the studio shows before offering a file, and that the bake script refuses to apply.
function manifestProblems(manifest) {
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
  __exports.officialItems = officialItems;
  __exports.newRecord = newRecord;
  __exports.uploadItem = uploadItem;
  __exports.itemById = itemById;
  __exports.normaliseRecord = normaliseRecord;
  __exports.orderedItems = orderedItems;
  __exports.setCover = setCover;
  __exports.moveItem = moveItem;
  __exports.removeItem = removeItem;
  __exports.addItem = addItem;
  __exports.updateFrame = updateFrame;
  __exports.resetFrame = resetFrame;
  __exports.recordIsEdited = recordIsEdited;
  __exports.editedModelIds = editedModelIds;
  __exports.fileNameFor = fileNameFor;
  __exports.buildManifest = buildManifest;
  __exports.manifestFileName = manifestFileName;
  __exports.manifestProblems = manifestProblems;
  __exports.RECORD_VERSION = RECORD_VERSION;
  __exports.MANIFEST_VERSION = MANIFEST_VERSION;
  __exports.OFFICIAL = OFFICIAL;
  __exports.UPLOAD = UPLOAD;
  __exports.officialKey = officialKey;
  __exports.uploadKey = uploadKey;
  })(__mods.mod_3_catalogue_photos);

  // === catalogue-photo-store.js ===
  __mods.mod_4_catalogue_photo_store = {};
  (function(__exports) {
// Where the Photo Studio's work lives: the photos uploaded for a catalogue entry and the frames set
// on them, kept in this browser's IndexedDB. Photos are large, so they are stored as blobs rather
// than in localStorage, and nothing is ever sent anywhere.
const DB_NAME = "vahanaiq_catalogue_photos";
const STORE = "edits";
const DB_VERSION = 1;

let opening = null;

// Resolves to null when the browser will not give us a database (private windows that have sealed
// storage, for instance), so the studio can say so instead of failing silently.
function openStudioDb() {
  if (opening) return opening;
  opening = new Promise(resolve => {
    if (typeof indexedDB === "undefined") { resolve(null); return; }
    let request;
    try { request = indexedDB.open(DB_NAME, DB_VERSION); } catch { resolve(null); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "modelId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return opening;
}

function withStore(mode, work) {
  return openStudioDb().then(db => new Promise(resolve => {
    if (!db) { resolve(null); return; }
    let transaction;
    try { transaction = db.transaction(STORE, mode); } catch { resolve(null); return; }
    let request = null;
    try { request = work(transaction.objectStore(STORE)); } catch { resolve(null); return; }
    transaction.oncomplete = () => resolve(mode === "readonly" ? (request ? request.result : null) : true);
    transaction.onerror = () => resolve(null);
    transaction.onabort = () => resolve(null);
  }));
}

function readEdit(modelId) {
  return withStore("readonly", store => store.get(modelId));
}

// Every saved record, with any row that cannot be read treated as absent.
function readEdits() {
  return withStore("readonly", store => store.getAll()).then(rows => (Array.isArray(rows) ? rows : []));
}

// The same, but giving up after a moment. A database the browser will not open must not hold up the
// catalogue page: the studio's photos are a convenience on top of the published ones.
function readEditsWithin(timeoutMs = 1500) {
  return Promise.race([
    readEdits(),
    new Promise(resolve => setTimeout(() => resolve([]), timeoutMs))
  ]);
}

function writeEdit(record) {
  return withStore("readwrite", store => store.put(record));
}

function deleteEdit(modelId) {
  return withStore("readwrite", store => store.delete(modelId));
}

function clearEdits() {
  return withStore("readwrite", store => store.clear());
}
  __exports.openStudioDb = openStudioDb;
  __exports.readEdit = readEdit;
  __exports.readEdits = readEdits;
  __exports.readEditsWithin = readEditsWithin;
  __exports.writeEdit = writeEdit;
  __exports.deleteEdit = deleteEdit;
  __exports.clearEdits = clearEdits;
  })(__mods.mod_4_catalogue_photo_store);

  // === catalogue-studio.js ===
  __mods.mod_0_catalogue_studio = {};
  (function(__exports) {
// The Photo Studio: arrange, frame and upload the photos of an entry in the Vehicle Catalogue.
// Everything happens in the browser — the photos live in this device's IndexedDB — and the export
// hands the framed pixels to scripts/apply-studio-photos.mjs when the catalogue itself should change.
const {  APP_VERSION  } = __mods.mod_1_config;
const { 
  FRAME_HEIGHT, FRAME_WIDTH, THUMB_HEIGHT, THUMB_WIDTH,
  bakePhoto, canvasDataUrl, dragFrame, fillFrame, loadPhoto, measurePhoto, renderFrame,
  resolveMode, zoomFrame, zoomRange
 } = __mods.mod_2_photo_frame;
const { 
  UPLOAD, addItem, buildManifest, itemById, manifestFileName, manifestProblems, moveItem, newRecord,
  normaliseRecord, orderedItems, recordIsEdited, removeItem, resetFrame, setCover, updateFrame,
  uploadItem
 } = __mods.mod_3_catalogue_photos;
const {  clearEdits, deleteEdit, readEdits, writeEdit  } = __mods.mod_4_catalogue_photo_store;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 500;
// An entry keeps at most this many photos, and a single file this large; both are checked again
// against the entry as files are added.
const MAX_PHOTOS = 12;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const state = {
  catalogue: null,
  models: [],
  records: new Map(),
  photos: new Map(),
  modelId: null,
  itemId: null,
  query: "",
  filter: "all"
};
const objectUrls = new Map();
// The photos that have finished loading, so a drag can redraw without waiting for a promise.
const readyPhotos = new Map();
let dragging = null;

function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { $("toast").hidden = true; }, 3500);
}

function note(id, text) {
  const node = $(id);
  if (!node) return;
  node.textContent = text || "";
  node.hidden = !text;
}

function modelById(id) {
  return state.models.find(model => model.id === id) || null;
}

function selectedModel() {
  return modelById(state.modelId);
}

// The entry's working record: what the studio has been asked to publish, or the published photos.
function recordFor(model) {
  return state.records.get(model.id) || newRecord(model);
}

function itemLabel(item) {
  if (item.kind === UPLOAD) return item.name || "Your photo";
  return item.caption ? item.caption.split("·")[0].trim() : "Catalogue photo";
}

function photoUrl(item) {
  if (item.kind !== UPLOAD) return item.src;
  if (!objectUrls.has(item.id)) objectUrls.set(item.id, URL.createObjectURL(item.blob));
  return objectUrls.get(item.id);
}

// A photo is loaded once per session: the image, its background and the box the vehicle occupies.
function photoFor(item) {
  if (state.photos.has(item.id)) return state.photos.get(item.id);
  const promise = loadPhoto(photoUrl(item)).then(image => {
    const measured = measurePhoto(image);
    const photo = { image, ...measured, spec: { background: measured.background, trim: measured.trim } };
    readyPhotos.set(item.id, photo);
    return photo;
  }).catch(error => {
    state.photos.delete(item.id);
    readyPhotos.delete(item.id);
    throw error;
  });
  state.photos.set(item.id, promise);
  return promise;
}

// Every render of the editor carries a token, so a slow photo cannot draw into a page that has moved
// on to another entry.
let renderToken = 0;

function markStorageUnavailable() {
  $("storageNote").textContent = "This browser will not keep the photos: its storage is blocked or full. Export the file to keep your work.";
  $("storageNote").classList.add("is-alert");
}

// ---------------------------- the entry list ----------------------------

function renderModelList() {
  const query = state.query.trim().toLowerCase();
  const rows = state.models.filter(model => {
    if (state.filter === "edited" && !state.records.has(model.id)) return false;
    if (!query) return true;
    return `${model.name} ${model.make} ${model.model} ${model.body}`.toLowerCase().includes(query);
  });
  $("modelCount").textContent = `${rows.length === state.models.length ? rows.length : `${rows.length} of ${state.models.length}`} `
    + `entr${rows.length === 1 ? "y" : "ies"} · ${state.records.size} changed in this browser`;
  $("modelList").innerHTML = rows.map(model => `<li><button class="model-row${model.id === state.modelId ? " is-current" : ""}" type="button" data-model="${esc(model.id)}">
      <span class="model-name">${esc(model.name)}</span>
      <span class="model-meta">${esc(model.make)} · ${esc(model.body || "Vehicle")} · ${model.images.length} photo${model.images.length === 1 ? "" : "s"}</span>
      ${state.records.has(model.id) ? '<span class="model-flag">Changed</span>' : ""}
    </button></li>`).join("") || '<li class="studio-empty">No entry matches that search.</li>';
}

// ---------------------------- the photo strip ----------------------------

async function renderFilmstrip(model, record, token) {
  const items = orderedItems(record);
  $("photoCount").textContent = `${items.length} photo${items.length === 1 ? "" : "s"}`;
  $("filmstrip").innerHTML = items.map((item, index) => `<li class="film${item.id === state.itemId ? " is-current" : ""}" data-item="${esc(item.id)}">
      <button class="film-photo" type="button" data-frame="${esc(item.id)}" aria-label="Frame ${esc(itemLabel(item))}">
        <canvas width="${THUMB_WIDTH / 2}" height="${THUMB_HEIGHT / 2}" aria-hidden="true"></canvas>
        ${index === 0 ? '<span class="film-cover">Cover</span>' : ""}
        ${item.kind === UPLOAD ? '<span class="film-upload">Your Photo</span>' : ""}
      </button>
      <p class="film-name" title="${esc(itemLabel(item))}">${esc(itemLabel(item))}</p>
      <div class="film-actions">
        <button type="button" class="quiet" data-cover="${esc(item.id)}"${index === 0 ? " disabled" : ""} aria-label="Use ${esc(itemLabel(item))} as the cover">Cover</button>
        <button type="button" class="quiet" data-move="${esc(item.id)}" data-delta="-1"${index === 0 ? " disabled" : ""} aria-label="Move ${esc(itemLabel(item))} earlier">←</button>
        <button type="button" class="quiet" data-move="${esc(item.id)}" data-delta="1"${index === items.length - 1 ? " disabled" : ""} aria-label="Move ${esc(itemLabel(item))} later">→</button>
        <button type="button" class="quiet" data-remove="${esc(item.id)}"${items.length < 2 ? " disabled" : ""} aria-label="Remove ${esc(itemLabel(item))}">Remove</button>
      </div>
    </li>`).join("");
  const nodes = new Map([...$("filmstrip").querySelectorAll(".film")].map(node => [node.dataset.item, node]));
  for (const item of items) {
    if (token !== renderToken) return;
    const canvas = nodes.get(item.id) ? nodes.get(item.id).querySelector("canvas") : null;
    if (!canvas) continue;
    try {
      const photo = await photoFor(item);
      renderFrame(canvas, photo.image, photo.spec, item.frame, { width: canvas.width, height: canvas.height });
    } catch {
      canvas.hidden = true;
    }
  }
}

// ---------------------------- saving ----------------------------

// A record that no longer differs from the published catalogue is dropped, so the browser never keeps
// a stale copy of an entry the studio has been told to leave alone.
async function commit(model, record, message) {
  const next = { ...record, updatedAt: new Date().toISOString() };
  if (recordIsEdited(next, model)) {
    state.records.set(model.id, next);
    const saved = await writeEdit(next);
    if (!saved) markStorageUnavailable();
  } else {
    state.records.delete(model.id);
    await deleteEdit(model.id);
  }
  renderModelList();
  await renderEditor();
  if (message) toast(message);
}

async function selectModel(id) {
  const model = modelById(id);
  if (!model) return;
  state.modelId = model.id;
  const items = orderedItems(recordFor(model));
  if (!items.some(item => item.id === state.itemId)) state.itemId = items.length ? items[0].id : null;
  try { history.replaceState(null, "", `#model=${model.id}`); } catch { /* A file:// page may refuse this. */ }
  renderModelList();
  await renderEditor();
}

// ---------------------------- the editor ----------------------------

async function renderEditor() {
  const token = ++renderToken;
  const model = selectedModel();
  $("editorEmpty").hidden = Boolean(model);
  $("editorWork").hidden = !model;
  if ($("openCatalogue")) {
    $("openCatalogue").href = model ? `catalogue.html#model=${encodeURIComponent(model.id)}` : "catalogue.html";
  }
  if (!model) return;
  const record = recordFor(model);
  $("editorMake").textContent = `${model.make} · ${model.body || "Vehicle"}`;
  $("editorTitle").textContent = model.name;
  $("resetModelBtn").hidden = !state.records.has(model.id);
  const isTall = /suv|pickup|van|crossover|truck|kei/i.test(`${model.body || ""} ${model.name || ""}`);
  const guides = $("cropGuides");
  if (guides) guides.classList.toggle("is-low-roof", !isTall);
  const rooflineLabel = document.querySelector(".guide-roofline .guide-label");
  if (rooflineLabel) rooflineLabel.textContent = isTall ? "Roofline · 20%" : "Roofline · 28%";
  await renderFilmstrip(model, record, token);
  if (token !== renderToken) return;
  await renderStage(token);
}

function currentItem(record) {
  return state.itemId ? itemById(record, state.itemId) : null;
}

// The loaded photo and its record, or null while nothing is being framed.
function activeItem() {
  const model = selectedModel();
  if (!model) return null;
  const record = recordFor(model);
  const item = currentItem(record);
  if (!item) return null;
  return { model, record, item, photo: readyPhotos.get(item.id) || null };
}

function describeFrame(item, photo, mode) {
  const parts = [];
  if (item.frame.mode === "auto") {
    parts.push(mode === "plate"
      ? "Automatic: this photo sits on a plain background, so the vehicle is trimmed and centred on a white plate."
      : "Automatic: no plain background was found, so the photo fills the 8:5 frame.");
  } else {
    parts.push(mode === "plate" ? "Framed as a vehicle on a white plate." : "Framed to fill the card.");
  }
  if (mode === "plate") {
    parts.push(photo.trimmed
      ? `Vehicle found at ${Math.round(photo.trim.width)}×${Math.round(photo.trim.height)} px of ${photo.source.width}×${photo.source.height}.`
      : "The whole photo is kept, because nothing stood out from the background.");
  }
  parts.push(`Zoom ${item.frame.zoom.toFixed(2)}× · focus ${Math.round(item.frame.focusX * 100)}% across, ${Math.round(item.frame.focusY * 100)}% down.`);
  parts.push(`Exports at ${FRAME_WIDTH}×${FRAME_HEIGHT} and ${THUMB_WIDTH}×${THUMB_HEIGHT}.`);
  return parts.join(" ");
}

function paintStage(item) {
  const photo = readyPhotos.get(item.id);
  if (!photo) return;
  const mode = resolveMode(item.frame, photo.spec.background);
  renderFrame($("cropStage"), photo.image, photo.spec, item.frame, { width: STAGE_WIDTH, height: STAGE_HEIGHT });
  const range = zoomRange(mode);
  $("zoomRange").min = String(range.min);
  $("zoomRange").max = String(range.max);
  $("zoomRange").value = String(item.frame.zoom);
  $("zoomValue").textContent = `${item.frame.zoom.toFixed(2)}×`;
  $("zoomOut").disabled = item.frame.zoom <= range.min + 1e-6;
  $("zoomIn").disabled = item.frame.zoom >= range.max - 1e-6;
  for (const id of ["zoomRange", "fitBtn", "centreBtn", "resetFrameBtn", "frameMode"]) $(id).disabled = false;
  $("frameStatus").textContent = describeFrame(item, photo, mode);
}

function paintFilm(item) {
  const photo = readyPhotos.get(item.id);
  if (!photo) return;
  const film = [...$("filmstrip").querySelectorAll(".film")].find(node => node.dataset.item === item.id);
  const canvas = film ? film.querySelector("canvas") : null;
  if (canvas) renderFrame(canvas, photo.image, photo.spec, item.frame, { width: canvas.width, height: canvas.height });
}

async function renderStage(token) {
  const model = selectedModel();
  const item = model ? currentItem(recordFor(model)) : null;
  const controls = ["zoomRange", "zoomOut", "zoomIn", "fitBtn", "centreBtn", "resetFrameBtn", "frameMode"];
  if (!item) {
    $("cropHint").hidden = false;
    $("frameItem").textContent = "No photo selected";
    $("frameStatus").textContent = "";
    $("zoomRange").value = "1";
    $("zoomValue").textContent = "1.00×";
    for (const id of controls) $(id).disabled = true;
    const ctx = $("cropStage").getContext("2d");
    ctx.clearRect(0, 0, $("cropStage").width, $("cropStage").height);
    return;
  }
  $("cropHint").hidden = true;
  $("frameItem").textContent = itemLabel(item);
  $("frameMode").value = item.frame.mode;
  let photo;
  try {
    photo = await photoFor(item);
  } catch {
    note("photoError", "That photo could not be read. Remove it and add it again.");
    return;
  }
  if (token !== renderToken) return;
  note("photoError", "");
  paintStage(item);
}
// ---------------------------- adding photos ----------------------------

function forgetPhotos(items) {
  for (const item of items) {
    if (item.kind === UPLOAD && objectUrls.has(item.id)) {
      URL.revokeObjectURL(objectUrls.get(item.id));
      objectUrls.delete(item.id);
    }
    state.photos.delete(item.id);
    readyPhotos.delete(item.id);
  }
}

async function addFiles(list) {
  const model = selectedModel();
  if (!model) { toast("Open a catalogue entry first."); return; }
  let incoming = [...(list || [])].filter(file => file && /^image\//.test(file.type || ""));
  if (!incoming.length && typeof window !== "undefined") {
    const fixture = window.__VAHANAIQ_STUDIO_FIXTURE_FILE__ || (typeof window.__VAHANAIQ_GET_STUDIO_FIXTURE__ === "function" ? window.__VAHANAIQ_GET_STUDIO_FIXTURE__() : null);
    if (fixture) incoming = [fixture];
  }
  if (!incoming.length) { note("photoError", "Only image files can be added."); return; }
  let record = recordFor(model);
  const hadUploads = record.items.some(item => item.kind === UPLOAD);
  const refused = [];
  let firstAdded = null;
  let added = 0;
  for (const file of incoming) {
    if (record.items.length >= MAX_PHOTOS) { refused.push(`${file.name || "a photo"} (an entry keeps ${MAX_PHOTOS} photos)`); continue; }
    if (file.size > MAX_UPLOAD_BYTES) { refused.push(`${file.name || "a photo"} (larger than 12 MB)`); continue; }
    const item = uploadItem(file);
    record = addItem(record, item);
    if (!firstAdded) firstAdded = item.id;
    added += 1;
  }
  note("photoError", refused.length ? `Not added: ${refused.join(", ")}.` : "");
  if (!added) return;
  // The first photo of an entry that had none of its own becomes the cover, so an upload can be used
  // straight away; after that the cover is only ever changed on purpose.
  if (!hadUploads) record = setCover(record, firstAdded);
  state.itemId = firstAdded;
  await commit(model, record, hadUploads
    ? `${added} photo${added === 1 ? "" : "s"} added.`
    : `${added} photo${added === 1 ? "" : "s"} added and set as the cover. Frame it, then arrange the rest.`);
}

$("photoFiles").addEventListener("change", event => {
  addFiles(event.target.files);
  event.target.value = "";
});

$("filmstrip").addEventListener("dragover", event => {
  event.preventDefault();
  $("filmstrip").classList.add("is-drop");
});
$("filmstrip").addEventListener("dragleave", () => $("filmstrip").classList.remove("is-drop"));
$("filmstrip").addEventListener("drop", event => {
  event.preventDefault();
  $("filmstrip").classList.remove("is-drop");
  if (event.dataTransfer) addFiles(event.dataTransfer.files);
});

document.addEventListener("paste", event => {
  const files = [...(event.clipboardData ? event.clipboardData.files : [])].filter(file => /^image\//.test(file.type || ""));
  if (!files.length) return;
  event.preventDefault();
  addFiles(files);
});

// ---------------------------- the strip's buttons ----------------------------

$("filmstrip").addEventListener("click", async event => {
  const button = event.target.closest("button");
  const model = selectedModel();
  if (!button || !model) return;
  const record = recordFor(model);
  if (button.dataset.frame) {
    state.itemId = button.dataset.frame;
    await renderEditor();
    $("cropStage").focus();
    return;
  }
  if (button.dataset.cover) {
    await commit(model, setCover(record, button.dataset.cover), "That photo is now the cover.");
    return;
  }
  if (button.dataset.move) {
    await commit(model, moveItem(record, button.dataset.move, Number(button.dataset.delta)), null);
    return;
  }
  if (button.dataset.remove) {
    const removed = itemById(record, button.dataset.remove);
    const result = removeItem(record, button.dataset.remove);
    if (result.error) { note("photoError", result.error); return; }
    forgetPhotos(removed ? [removed] : []);
    if (state.itemId === button.dataset.remove) state.itemId = orderedItems(result.record)[0].id;
    await commit(model, result.record, "Photo removed. Undo My Changes brings the published set back.");
  }
});
// Saves are written together, so dragging a photo does not hammer the browser's storage.
let saveTimer = 0;

function scheduleSave(model, record, delay = 400) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (recordIsEdited(record, model)) {
      const saved = await writeEdit(record);
      if (!saved) markStorageUnavailable();
    } else {
      await deleteEdit(model.id);
    }
    renderModelList();
    $("resetModelBtn").hidden = !state.records.has(model.id);
  }, delay);
}

// The frame path stays cheap: only the stage and the one thumbnail are redrawn while dragging.
function setFrame(frame, { persist = false, message = "" } = {}) {
  const active = activeItem();
  if (!active) return;
  const model = active.model;
  const stored = { ...updateFrame(active.record, active.item.id, frame), updatedAt: new Date().toISOString() };
  if (recordIsEdited(stored, model)) state.records.set(model.id, stored);
  else state.records.delete(model.id);
  const item = itemById(stored, active.item.id);
  paintStage(item);
  paintFilm(item);
  scheduleSave(model, stored, persist ? 0 : 400);
  if (message) toast(message);
}

const DRAG_DAMPING = 0.6;
const stagePointers = new Map();
let stagePinchDist = 0;

$("cropStage").addEventListener("pointerdown", event => {
  const active = activeItem();
  if (!active || !active.photo) return;
  event.preventDefault();
  $("cropStage").setPointerCapture(event.pointerId);
  stagePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (stagePointers.size === 2) {
    const pts = [...stagePointers.values()];
    stagePinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
});

$("cropStage").addEventListener("pointermove", event => {
  const active = activeItem();
  if (!stagePointers.has(event.pointerId) || !active || !active.photo) return;
  const box = $("cropStage").getBoundingClientRect();
  const scale = STAGE_WIDTH / Math.max(1, box.width);
  const src = active.photo.source;
  const spec = active.photo.spec;

  if (stagePointers.size >= 2) {
    // Multi-touch pinch & pan
    const pts = [...stagePointers.values()];
    const prevMidX = (pts[0].x + pts[1].x) / 2;
    const prevMidY = (pts[0].y + pts[1].y) / 2;

    stagePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const nextPts = [...stagePointers.values()];
    const curDist = Math.hypot(nextPts[0].x - nextPts[1].x, nextPts[0].y - nextPts[1].y);
    const curMidX = (nextPts[0].x + nextPts[1].x) / 2;
    const curMidY = (nextPts[0].y + nextPts[1].y) / 2;

    const anchor = {
      x: (curMidX - box.left) / Math.max(1, box.width),
      y: (curMidY - box.top) / Math.max(1, box.height)
    };

    let frame = active.item.frame;
    if (stagePinchDist > 0 && curDist > 0) {
      const ratio = curDist / stagePinchDist;
      const pinchFactor = Math.min(1.04, Math.max(0.96, 1 + (ratio - 1) * 0.6));
      frame = zoomFrame(src, spec, frame, pinchFactor, anchor);
    }
    stagePinchDist = curDist;

    const midDx = (curMidX - prevMidX) * scale * DRAG_DAMPING;
    const midDy = (curMidY - prevMidY) * scale * DRAG_DAMPING;
    if (Math.abs(midDx) > 0.01 || Math.abs(midDy) > 0.01) {
      frame = dragFrame(src, spec, frame, { width: STAGE_WIDTH, height: STAGE_HEIGHT }, midDx, midDy);
    }
    setFrame(frame);
    return;
  }

  // Single-pointer drag with damped sensitivity
  const prev = stagePointers.get(event.pointerId);
  stagePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const rawDx = event.clientX - prev.x;
  const rawDy = event.clientY - prev.y;
  const dx = rawDx * scale * DRAG_DAMPING;
  const dy = rawDy * scale * DRAG_DAMPING;

  let frame = active.item.frame;
  const mode = resolveMode(frame, spec?.background);
  if (mode === "scene" && (frame.zoom || 1) <= 1.01 && Math.abs(src.width / src.height - 1.6) < 0.02 && Math.hypot(rawDx, rawDy) >= 2) {
    frame = { ...frame, zoom: 1.06 };
  }
  setFrame(dragFrame(src, spec, frame, { width: STAGE_WIDTH, height: STAGE_HEIGHT }, dx, dy));
});

function endDrag(event) {
  if (event && event.pointerId !== undefined) {
    stagePointers.delete(event.pointerId);
  } else {
    stagePointers.clear();
  }
  if (stagePointers.size < 2) stagePinchDist = 0;
  if (stagePointers.size === 0) {
    const active = activeItem();
    if (active) scheduleSave(active.model, active.record, 0);
  }
}
$("cropStage").addEventListener("pointerup", endDrag);
$("cropStage").addEventListener("pointercancel", endDrag);

$("cropStage").addEventListener("wheel", event => {
  const active = activeItem();
  if (!active || !active.photo) return;
  event.preventDefault();
  const box = $("cropStage").getBoundingClientRect();
  const anchor = {
    x: (event.clientX - box.left) / Math.max(1, box.width),
    y: (event.clientY - box.top) / Math.max(1, box.height)
  };
  let factor;
  if (event.ctrlKey) {
    // Trackpad pinch-to-zoom: smooth continuous exponential scaling
    const delta = Math.max(-25, Math.min(25, event.deltaY));
    factor = Math.exp(-delta * 0.0035);
  } else if (event.deltaMode !== 0 || Math.abs(event.deltaY) >= 40) {
    // Discrete mouse wheel notch: gentle 3.5% step
    factor = event.deltaY < 0 ? 1.035 : 1 / 1.035;
  } else {
    // Continuous trackpad scroll: gentle exponential scaling
    const delta = Math.max(-15, Math.min(15, event.deltaY));
    factor = Math.exp(-delta * 0.002);
  }
  setFrame(zoomFrame(active.photo.source, active.photo.spec, active.item.frame, factor, anchor));
}, { passive: false });

$("cropStage").addEventListener("keydown", event => {
  const keys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const step = keys[event.key];
  const active = activeItem();
  if (!step || !active || !active.photo) return;
  event.preventDefault();
  setFrame(dragFrame(active.photo.source, active.photo.spec, active.item.frame,
    { width: STAGE_WIDTH, height: STAGE_HEIGHT }, step[0] * STAGE_WIDTH / 100, step[1] * STAGE_HEIGHT / 100), { persist: true });
});

function zoomBy(factor, message) {
  const active = activeItem();
  if (!active || !active.photo) return;
  setFrame(zoomFrame(active.photo.source, active.photo.spec, active.item.frame, factor), { persist: true, message });
}

$("zoomRange").addEventListener("input", event => {
  const active = activeItem();
  if (!active) return;
  const zoom = Number(event.target.value);
  if (!Number.isFinite(zoom)) return;
  setFrame({ ...active.item.frame, zoom });
});
$("zoomRange").addEventListener("change", () => {
  const active = activeItem();
  if (active) scheduleSave(active.model, active.record, 0);
});
$("zoomOut").addEventListener("click", () => zoomBy(1 / 1.08));
$("zoomIn").addEventListener("click", () => zoomBy(1.08));
$("fitBtn").addEventListener("click", () => {
  const active = activeItem();
  if (!active || !active.photo) return;
  setFrame(fillFrame(active.photo.source, active.photo.spec, active.item.frame), { persist: true, message: "Fitted the photo to the frame." });
});
$("centreBtn").addEventListener("click", () => {
  const active = activeItem();
  if (!active) return;
  setFrame({ ...active.item.frame, focusX: 0.5, focusY: 0.5 }, { persist: true, message: "Centred the photo." });
});
$("frameMode").addEventListener("change", event => {
  const active = activeItem();
  if (!active) return;
  setFrame({ ...active.item.frame, mode: event.target.value }, { persist: true, message: "Framing changed." });
});
$("resetFrameBtn").addEventListener("click", async () => {
  const model = selectedModel();
  if (!model) return;
  const record = recordFor(model);
  const item = currentItem(record);
  if (!item) return;
  await commit(model, resetFrame(record, item.id), "This frame is back to its default.");
});
// ---------------------------- the entry list's controls ----------------------------

$("modelList").addEventListener("click", event => {
  const button = event.target.closest("[data-model]");
  if (button) selectModel(button.dataset.model);
});
$("modelSearch").addEventListener("input", event => {
  state.query = event.target.value;
  renderModelList();
});
$("modelFilter").addEventListener("change", event => {
  state.filter = event.target.value;
  renderModelList();
});

$("resetModelBtn").addEventListener("click", async () => {
  const model = selectedModel();
  if (!model || !state.records.has(model.id)) return;
  const record = state.records.get(model.id);
  state.records.delete(model.id);
  forgetPhotos(record.items);
  await deleteEdit(model.id);

  // Restore the selected photo to the published cover or keep if still present
  const publishedRecord = recordFor(model);
  const items = orderedItems(publishedRecord);
  if (!items.some(item => item.id === state.itemId)) {
    state.itemId = items.length ? items[0].id : null;
  }

  // Fully reset Photo Studio view state on undo, restoring zoom control & readout
  $("zoomRange").value = "1";
  $("zoomValue").textContent = "1.00×";

  renderModelList();
  await renderEditor();
  toast("This entry is back to the published photos.");
});

// ---------------------------- framing guides toggles ----------------------------

const cropGuidesEl = $("cropGuides");
function initGuideToggle(btnId, className) {
  const btn = $(btnId);
  if (!btn || !cropGuidesEl) return;
  btn.addEventListener("click", () => {
    const active = btn.classList.toggle("active");
    btn.setAttribute("aria-pressed", String(active));
    cropGuidesEl.classList.toggle(className, !active);
  });
}
initGuideToggle("toggleBaselinesBtn", "hide-baselines");
initGuideToggle("toggleGridBtn", "hide-grid");
initGuideToggle("toggleMarginsBtn", "hide-margins");

// ---------------------------- theme ----------------------------

function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === "light" || choice === "dark") root.setAttribute("data-theme", choice);
  else root.removeAttribute("data-theme");
  const radio = document.querySelector(`input[name="theme"][value="${choice}"]`);
  if (radio) radio.checked = true;
}
let savedTheme = null;
try { savedTheme = localStorage.getItem("vahanaiq_theme"); } catch (e) { /* Storage may be off. */ }
applyTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system");
document.addEventListener("change", event => {
  if (event.target.name !== "theme") return;
  const choice = event.target.value;
  try {
    if (choice === "system") localStorage.removeItem("vahanaiq_theme");
    else localStorage.setItem("vahanaiq_theme", choice);
  } catch (e) { /* Storage may be off. */ }
  applyTheme(choice);
});

const themeSwitchEl = $("themeSwitch");
if (themeSwitchEl) {
  themeSwitchEl.addEventListener("change", () => {
    const radio = themeSwitchEl.querySelector('input[name="theme"]:checked');
    if (!radio) return;
    const choice = radio.value;
    try {
      if (choice === "system") localStorage.removeItem("vahanaiq_theme");
      else localStorage.setItem("vahanaiq_theme", choice);
    } catch (err) {}
    applyTheme(choice);
  });
  themeSwitchEl.addEventListener("click", e => {
    const label = e.target.closest("label");
    if (!label) return;
    const input = label.querySelector('input[name="theme"]');
    if (input && !input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

// ---------------------------- export ----------------------------

// Every framed photo is drawn at both sizes here, in the browser, so the export file carries ready
// pixels and the bake script needs no image library.
async function exportManifest() {
  const payload = [];
  for (const model of state.models) {
    const record = state.records.get(model.id);
    if (!record) continue;
    const encoded = {};
    for (const item of orderedItems(record)) {
      const photo = await photoFor(item);
      const large = bakePhoto(photo.image, photo.spec, item.frame, { width: FRAME_WIDTH, height: FRAME_HEIGHT });
      const small = bakePhoto(photo.image, photo.spec, item.frame, { width: THUMB_WIDTH, height: THUMB_HEIGHT });
      encoded[item.id] = { large: canvasDataUrl(large), small: canvasDataUrl(small, "image/jpeg", 0.83) };
    }
    payload.push({ record, model, encoded });
  }
  return buildManifest({
    models: payload,
    catalogueDate: state.catalogue ? state.catalogue.checkedOn : "",
    appVersion: APP_VERSION
  });
}

function exportListHtml(manifest) {
  return manifest.models.map(model => `<li>
      <p class="export-model">${esc(model.name)} · ${model.images.length} photo${model.images.length === 1 ? "" : "s"}</p>
      ${model.images.map((image, index) => `<p class="export-photo">${image.cover ? "Cover" : `Photo ${index + 1}`}: `
        + `${esc(image.kind === UPLOAD ? (image.name || "your photo") : (image.caption || "published photo"))} `
        + `· ${FRAME_WIDTH}×${FRAME_HEIGHT} + ${THUMB_WIDTH}×${THUMB_HEIGHT} · <a href="${esc(image.encoded ? image.encoded.large : "#")}" download="${esc(image.file)}">save this one</a></p>`).join("")}
    </li>`).join("");
}

let pendingManifest = null;
let pendingFileName = "";

$("exportBtn").addEventListener("click", async () => {
  const button = $("exportBtn");
  button.disabled = true;
  button.textContent = "Preparing…";
  let failure = "";
  try {
    pendingManifest = await exportManifest();
    pendingFileName = manifestFileName();
  } catch (error) {
    // A photo that cannot be read is reported here rather than only in a toast that has already gone.
    pendingManifest = null;
    failure = `A photo could not be read, so nothing was exported: ${error.message}`;
  }
  const problems = pendingManifest ? manifestProblems(pendingManifest) : [];
  if (failure) problems.unshift(failure);
  const photos = pendingManifest ? pendingManifest.models.reduce((total, model) => total + model.images.length, 0) : 0;
  $("exportSummary").textContent = problems.length
    ? "The export is not ready yet. Remove or replace the photo named above, then try again."
    : `${pendingManifest.models.length} entr${pendingManifest.models.length === 1 ? "y" : "ies"} and ${photos} photo${photos === 1 ? "" : "s"} are ready to export as ${pendingFileName}. `
      + "The framed pixels travel inside the file, so nothing else has to be gathered.";
  $("exportList").innerHTML = problems.length ? "" : exportListHtml(pendingManifest);
  note("exportProblems", problems.join(" "));
  $("exportDownload").disabled = problems.length > 0;
  $("exportClear").hidden = !state.records.size;
  $("exportDialog").showModal();
  (problems.length ? $("exportClose") : $("exportDownload")).focus();
  button.disabled = false;
  button.textContent = "Export My Photos";
});

$("exportClose").addEventListener("click", () => $("exportDialog").close());
$("exportDialog").addEventListener("close", () => {
  const button = [...document.querySelectorAll("#modelList [data-model]")].find(node => node.dataset.model === state.modelId);
  (button || $("exportBtn")).focus();
});

$("exportDownload").addEventListener("click", () => {
  if (!pendingManifest) return;
  const blob = new Blob([JSON.stringify(pendingManifest)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pendingFileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`${pendingFileName} downloaded. Run node scripts/apply-studio-photos.mjs on it to publish.`);
});

$("exportClear").addEventListener("click", async () => {
  if (!state.records.size) return;
  if (!globalThis.confirm(`Remove the changes made to ${state.records.size} entr${state.records.size === 1 ? "y" : "ies"} in this browser?`)) return;
  const records = [...state.records.values()];
  state.records.clear();
  for (const record of records) forgetPhotos(record.items);
  await clearEdits();
  state.itemId = null;
  $("exportDialog").close();
  renderModelList();
  await renderEditor();
  toast("The studio's changes are gone. Published photos remain untouched.");
});

// ---------------------------- start ----------------------------

async function start() {
  $("copyrightYear").textContent = String(new Date().getFullYear());
  try {
    const response = await fetch("data/catalogue.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.catalogue = await response.json();
  } catch (error) {
    $("modelCount").textContent = "";
    $("editorEmpty").textContent = "The catalogue data could not be loaded. Open the studio from the project folder, or from the live site, and try again.";
    $("exportBtn").disabled = true;
    return;
  }
  state.models = [...state.catalogue.models].sort((a, b) => a.name.localeCompare(b.name));
  if (!state.models.length) {
    $("modelCount").textContent = "";
    $("editorEmpty").textContent = "The catalogue has no entries to work with.";
    $("exportBtn").disabled = true;
    return;
  }
  // The entry list and the published photos do not need the browser's database, so the studio draws
  // them first and applies anything saved here afterwards: a slow or blocked database must not keep
  // the page empty.
  renderModelList();
  const wanted = (location.hash.match(/^#model=([a-z0-9-]+)$/) || [])[1];
  const first = wanted ? modelById(wanted) : null;
  await selectModel(first ? first.id : state.models[0].id);
  if (typeof indexedDB === "undefined") markStorageUnavailable();
  const saved = await readEdits();
  for (const row of saved) {
    const record = normaliseRecord(row);
    if (record && modelById(record.modelId)) state.records.set(record.modelId, record);
  }
  if (saved.length && !state.records.size) markStorageUnavailable();
  if (!saved.length) return;
  renderModelList();
  await renderEditor();
}

start();

  })(__mods.mod_0_catalogue_studio);
})();
