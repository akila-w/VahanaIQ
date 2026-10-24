// The Photo Studio: arrange, frame and upload the photos of an entry in the Vehicle Catalogue.
// Everything happens in the browser — the photos live in this device's IndexedDB — and the export
// hands the framed pixels to scripts/apply-studio-photos.mjs when the catalogue itself should change.
import { APP_VERSION } from "./config.js?v=2.11.3";
import {
  FRAME_HEIGHT, FRAME_WIDTH, THUMB_HEIGHT, THUMB_WIDTH,
  bakePhoto, canvasDataUrl, dragFrame, fillFrame, loadPhoto, measurePhoto, renderFrame,
  resolveMode, zoomFrame, zoomRange
} from "./photo-frame.js?v=2.11.3";
import {
  UPLOAD, addItem, buildManifest, itemById, manifestFileName, manifestProblems, moveItem, newRecord,
  normaliseRecord, orderedItems, recordIsEdited, removeItem, resetFrame, setCover, updateFrame,
  uploadItem
} from "./catalogue-photos.js?v=2.11.3";
import { clearEdits, deleteEdit, readEdits, writeEdit } from "./catalogue-photo-store.js?v=2.11.3";

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
  const incoming = [...(list || [])].filter(file => file && /^image\//.test(file.type || ""));
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
  state.itemId = null;
  forgetPhotos(record.items);
  await deleteEdit(model.id);
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