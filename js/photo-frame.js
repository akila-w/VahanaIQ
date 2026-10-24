// The 8:5 catalogue frame, shared by the Photo Studio, the catalogue overlay and the bake script.
// The geometry mirrors scripts/build-curated-catalogue.py, so a frame set by hand here exports to
// the same pixels the build produces: a photo on a plain background is trimmed to the vehicle and
// fitted onto a white plate, and any other photo is cropped to 8:5 around the chosen focus point.
// Everything apart from the canvas helpers is pure, so the geometry is checked in Node.

export const FRAME_WIDTH = 1280;
export const FRAME_HEIGHT = 800;
export const THUMB_WIDTH = 640;
export const THUMB_HEIGHT = 400;
export const FRAME_RATIO = FRAME_WIDTH / FRAME_HEIGHT;
// The box a vehicle is fitted into at zoom 1 (the build script uses 1160 x 680).
export const PLATE_WIDTH = 1160;
export const PLATE_HEIGHT = 680;
export const MODES = ["auto", "plate", "scene"];
export const MIN_ZOOM = 1;
export const MIN_PLATE_ZOOM = 0.5;
export const MAX_ZOOM = 3;
// The build treats a pixel as content when its distance from white passes this (0-255).
export const TRIM_THRESHOLD = 24;
// The corners are read from a small copy of the photo, which is averaged; a white studio backdrop
// stays well above the build's 238.
const WHITE_CORNER = 238;
const MEASURE_SIDE = 512;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);

export function defaultFrame() {
  return { zoom: 1, focusX: 0.5, focusY: 0.5, mode: "auto" };
}

export function zoomRange(mode) {
  return mode === "scene" ? { min: MIN_ZOOM, max: MAX_ZOOM } : { min: MIN_PLATE_ZOOM, max: MAX_ZOOM };
}

export function clampZoom(mode, zoom) {
  const range = zoomRange(mode);
  return clamp(finite(zoom, 1), range.min, range.max);
}

// Keeps a frame inside its limits, whatever a stored record or a crafted file claims.
export function normaliseFrame(frame) {
  const mode = MODES.includes(frame?.mode) ? frame.mode : "auto";
  return {
    mode,
    zoom: clampZoom(mode, frame?.zoom),
    focusX: clamp(finite(frame?.focusX, 0.5), 0, 1),
    focusY: clamp(finite(frame?.focusY, 0.5), 0, 1)
  };
}

export function isDefaultFrame(frame) {
  const f = normaliseFrame(frame);
  return f.zoom === 1 && f.focusX === 0.5 && f.focusY === 0.5 && f.mode === "auto";
}

// Reads a sample of pixels (see measurePhoto) the way the build reads the original: a fully opaque
// photo over white corners is a studio shot, anything else is a scene.
export function backgroundKind(sample) {
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
export function resolveMode(frame, background) {
  const mode = MODES.includes(frame?.mode) ? frame.mode : "auto";
  if (mode !== "auto") return mode;
  return background && (background.transparent || background.white) ? "plate" : "scene";
}

// Everything that is not the background, found the way the build finds it: flatten onto white, then
// keep what differs by more than the threshold. Null when the photo is blank.
export function detectTrimBox(sample, threshold = TRIM_THRESHOLD) {
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
export function sceneCropBox(source, frame) {
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
export function plateLayout(source, trim, frame) {
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

export function sceneLayout(source, frame) {
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
export function layoutFor(source, spec, frame) {
  const resolved = resolveMode(frame, spec?.background);
  return resolved === "plate" ? plateLayout(source, spec?.trim, frame) : sceneLayout(source, frame);
}

// Dragging the photo keeps the pixel under the pointer in place. The distance arrives in view
// pixels, so the same drag feels the same at any preview size.
export function dragFrame(source, spec, frame, view, deltaX, deltaY) {
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
export function zoomFrame(source, spec, frame, factor, anchor) {
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
export function fillFrame(source, spec, frame) {
  const f = normaliseFrame(frame);
  const zoom = resolveMode(f, spec?.background) === "plate" ? MIN_PLATE_ZOOM : MIN_ZOOM;
  return normaliseFrame({ ...f, zoom, focusX: 0.5, focusY: 0.5 });
}

// ---------------------------- browser helpers ----------------------------

export function loadPhoto(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That photo could not be read."));
    image.src = source;
  });
}

export function photoSource(image) {
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height
  };
}

// Measures a small copy of the photo: its background, and the box the vehicle occupies. Reading a
// 512-pixel copy keeps a full-size pixel scan off the main thread; the box is scaled back, so the
// build's own maths sees the same numbers.
export function measurePhoto(image, maxSide = MEASURE_SIDE) {
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
export function renderFrame(canvas, image, spec, frame, size) {
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

export function bakePhoto(image, spec, frame, size) {
  const canvas = document.createElement("canvas");
  renderFrame(canvas, image, spec, frame, size);
  return canvas;
}

export function canvasDataUrl(canvas, type = "image/jpeg", quality = 0.86) {
  return canvas.toDataURL(type, quality);
}