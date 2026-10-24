// Where the Photo Studio's work lives: the photos uploaded for a catalogue entry and the frames set
// on them, kept in this browser's IndexedDB. Photos are large, so they are stored as blobs rather
// than in localStorage, and nothing is ever sent anywhere.
const DB_NAME = "vahanaiq_catalogue_photos";
const STORE = "edits";
const DB_VERSION = 1;

let opening = null;

// Resolves to null when the browser will not give us a database (private windows that have sealed
// storage, for instance), so the studio can say so instead of failing silently.
export function openStudioDb() {
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

export function readEdit(modelId) {
  return withStore("readonly", store => store.get(modelId));
}

// Every saved record, with any row that cannot be read treated as absent.
export function readEdits() {
  return withStore("readonly", store => store.getAll()).then(rows => (Array.isArray(rows) ? rows : []));
}

// The same, but giving up after a moment. A database the browser will not open must not hold up the
// catalogue page: the studio's photos are a convenience on top of the published ones.
export function readEditsWithin(timeoutMs = 1500) {
  return Promise.race([
    readEdits(),
    new Promise(resolve => setTimeout(() => resolve([]), timeoutMs))
  ]);
}

export function writeEdit(record) {
  return withStore("readwrite", store => store.put(record));
}

export function deleteEdit(modelId) {
  return withStore("readwrite", store => store.delete(modelId));
}

export function clearEdits() {
  return withStore("readwrite", store => store.clear());
}