// Google sign-in and sync. Firebase (Google's sign-in and database service) loads only when
// someone opens the account dialog, or on a later visit once they have signed in, so the
// calculator never waits for it. Each person has one Firestore document, users/{uid}, with the
// same inputs and comparison this browser keeps in localStorage; firestore.rules let only its
// owner read, change or delete it. Before every write the account's copy is read and compared
// with the copy both sides last agreed on, so a change made on another device is never
// overwritten without asking.
import { firebaseConfig, FIREBASE_SDK } from "./config.js?v=2.10.0";
import { openModal, closeModal, isOpen } from "./modal.js?v=2.10.0";
import { showToast } from "./toast.js?v=2.10.0";
import { COMPARISON_KEY, SAVED_EVENT } from "./storage.js?v=2.10.0";
import { STORE_KEY } from "./inputs.js?v=2.10.0";

const SIGNED_IN_KEY = "vahanaiq_account_v1"; // set while signed in, so the next visit restores the session
const AGREED_KEY = "vahanaiq_synced_v1"; // fingerprint of the copy this browser and the account last agreed on
const WRITE_DELAY = 1500;
const MAX_SIZE = 900000; // firestore.rules refuse anything larger

const $ = id => document.getElementById(id);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  remove: k => { try { localStorage.removeItem(k); } catch (e) {} }
};

// --- What is synced (pure, tested in test/account.test.mjs)

// The copy kept in the account. Photos made in this browser (data: URLs) stay on this device:
// they are large, and the person can add them again.
export function cloudCopy(inputs, comparison) {
  const cars = Array.isArray(comparison?.cars) ? comparison.cars.filter(c => c && typeof c === "object") : [];
  return {
    inputs: inputs && typeof inputs === "object" && !Array.isArray(inputs) ? inputs : {},
    cars: cars.map(c => /^data:/i.test(c.img || "") ? { ...c, img: "" } : c)
  };
}

export function parseCloud(data) {
  try {
    const parsed = JSON.parse(data?.data);
    return cloudCopy(parsed?.inputs, { cars: parsed?.cars });
  } catch (e) {
    return cloudCopy(null, null);
  }
}

export const isEmptyCopy = copy => !copy.cars.length && !Object.keys(copy.inputs).length;

// A short hash (cyrb53) of a copy, so this browser can remember what it last agreed on
export function fingerprint(copy) {
  const str = JSON.stringify(copy);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Which way to sync: "same", "upload", "download", "deleted" (removed from another device)
// or "ask" (both changed since they last agreed)
export function syncDirection(local, cloud, agreed) {
  const l = fingerprint(local);
  if (!cloud) {
    if (agreed) return "deleted";
    return isEmptyCopy(local) ? "same" : "upload";
  }
  const c = fingerprint(cloud);
  if (l === c) return "same";
  if (c === agreed) return "upload";
  if (l === agreed) return "download";
  if (isEmptyCopy(local)) return "download";
  if (isEmptyCopy(cloud)) return "upload";
  return "ask";
}

// --- Firebase

let fb = null;
let loading = null;
let user = null;
let restoring = store.get(SIGNED_IN_KEY) === "1";
let conflict = null; // the account's copy while the person chooses which to keep
let failed = false;
let syncing = null, again = false, writeTimer = null;
let hooks = { reload: () => {} };

function loadFirebase() {
  if (fb) return Promise.resolve(fb);
  loading = loading || Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-auth.js`),
    import(`${FIREBASE_SDK}/firebase-firestore-lite.js`)
  ]).then(([app, A, F]) => {
    const firebaseApp = app.initializeApp(firebaseConfig);
    fb = { A, F, auth: A.getAuth(firebaseApp), db: F.getFirestore(firebaseApp) };
    A.onAuthStateChanged(fb.auth, onUser);
    return fb;
  }).catch(e => {
    loading = null;
    restoring = false;
    renderAccount();
    throw e;
  });
  return loading;
}

function onUser(u) {
  user = u;
  restoring = false;
  if (u) {
    store.set(SIGNED_IN_KEY, "1");
    syncNow();
  } else {
    store.remove(SIGNED_IN_KEY);
    store.remove(AGREED_KEY);
    conflict = null;
  }
  renderAccount();
}

const userDoc = () => fb.F.doc(fb.db, "users", user.uid);

function localCopy() {
  const read = k => { try { return JSON.parse(store.get(k) || "null"); } catch (e) { return null; } };
  return cloudCopy(read(STORE_KEY), read(COMPARISON_KEY));
}

const agree = copy => store.set(AGREED_KEY, fingerprint(copy));

async function upload(copy) {
  const data = JSON.stringify(copy);
  if (data.length > MAX_SIZE) throw new Error("Comparison too large to sync");
  await fb.F.setDoc(userDoc(), { version: 1, data, updatedAt: fb.F.serverTimestamp() });
  agree(copy);
}

// Writes a copy to this browser and shows it, keeping this device's own photos
function applyCopy(copy) {
  const own = new Map();
  try {
    for (const c of JSON.parse(store.get(COMPARISON_KEY) || "{}")?.cars || []) {
      if (/^data:/i.test(c?.img || "")) own.set(c.id, c.img);
    }
  } catch (e) {}
  const cars = copy.cars.map(c => !c.img && own.has(c.id) ? { ...c, img: own.get(c.id) } : c);
  store.set(STORE_KEY, JSON.stringify(copy.inputs));
  store.set(COMPARISON_KEY, JSON.stringify({ version: 3, cars }));
  hooks.reload();
}

async function runSync() {
  try {
    const snap = await fb.F.getDoc(userDoc());
    if (!user) return;
    const cloud = snap.exists() ? parseCloud(snap.data()) : null;
    const local = localCopy();
    const direction = syncDirection(local, cloud, store.get(AGREED_KEY));
    if (direction === "same") agree(local);
    else if (direction === "upload") await upload(local);
    else if (direction === "download") {
      applyCopy(cloud);
      agree(cloud);
      showToast("Updated with the inputs and vehicles saved in your account.");
    } else if (direction === "deleted") {
      await signOutHere("Your saved data was deleted on another device, so this browser signed out and cleared it.", { flush: false, clear: "always" });
    } else {
      conflict = cloud;
      openAccount();
    }
    failed = false;
  } catch (e) {
    console.warn("Account sync failed:", e);
    failed = true;
  }
}

function syncNow() {
  if (!user || conflict) return Promise.resolve();
  if (syncing) { again = true; return syncing; }
  clearTimeout(writeTimer);
  writeTimer = null;
  syncing = runSync().finally(() => {
    syncing = null;
    renderAccount();
    if (again) { again = false; syncNow(); }
  });
  renderAccount();
  return syncing;
}

function scheduleSync() {
  if (!user || conflict) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(syncNow, WRITE_DELAY);
}

// --- Account dialog

function signInMessage(e) {
  switch (e?.code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Allow pop-ups for this site, then try again.";
    case "auth/network-request-failed":
      return "Couldn't reach Google. Check your connection and try again.";
    case "auth/unauthorized-domain":
    case "auth/operation-not-allowed":
      return "Google sign-in isn't available on this address.";
    default:
      return "Couldn't sign in. Try again in a moment.";
  }
}

function setError(message) {
  $("accountError").textContent = message;
  $("accountError").hidden = !message;
}

function signIn() {
  if (!fb) return;
  setError("");
  // The popup opens straight from the click (Firebase is already loaded), so browsers allow it
  fb.A.signInWithPopup(fb.auth, new fb.A.GoogleAuthProvider()).catch(e => setError(signInMessage(e)));
}

// Signing out takes the account's inputs and vehicles out of this browser, unless some changes
// never reached the account. flush sends a pending change first (a sync already running passes
// false, since it is that sync); clear "always" removes them even then.
async function signOutHere(message, { flush = true, clear = "if-synced" } = {}) {
  if (flush && (writeTimer || syncing)) await syncNow();
  clearTimeout(writeTimer);
  writeTimer = null;
  const unsynced = fingerprint(localCopy()) !== store.get(AGREED_KEY);
  conflict = null;
  store.remove(SIGNED_IN_KEY);
  store.remove(AGREED_KEY);
  if (fb) await fb.A.signOut(fb.auth).catch(() => {});
  user = null;
  if (isOpen($("accountModal"))) closeModal($("accountModal"));
  renderAccount();
  if (clear === "always" || !unsynced) {
    applyCopy(cloudCopy(null, null));
    showToast(message || "Signed out. Your inputs and vehicles are in your account, not this browser.");
  } else {
    showToast("Signed out. Some changes hadn't reached your account, so this browser kept them.");
  }
}

async function deleteData() {
  const btn = $("confirmDeleteBtn");
  btn.disabled = true;
  clearTimeout(writeTimer);
  writeTimer = null;
  try {
    if (syncing) await syncing;
    await fb.F.deleteDoc(userDoc());
    // Also removes the sign-in record when Google allows it (it needs a recent sign-in)
    await fb.A.deleteUser(user).catch(() => {});
    await signOutHere("Deleted your saved inputs and vehicles from your account and this browser.", { flush: false, clear: "always" });
  } catch (e) {
    console.warn("Couldn't delete account data:", e);
    $("syncStatus").textContent = "Couldn't delete your saved data. Check your connection and try again.";
  } finally {
    btn.disabled = false;
    $("deleteConfirm").hidden = true;
  }
}

function resolveConflict(useAccount) {
  const cloud = conflict;
  conflict = null;
  if (useAccount) {
    applyCopy(cloud);
    agree(cloud);
    showToast("Now showing the inputs and vehicles saved in your account.");
    renderAccount();
  } else {
    syncing = upload(localCopy()).then(() => { failed = false; }, e => { console.warn("Account sync failed:", e); failed = true; })
      .finally(() => { syncing = null; renderAccount(); });
    renderAccount();
  }
}

const count = copy => copy.cars.length === 1 ? "1 vehicle" : `${copy.cars.length} vehicles`;

function statusText() {
  if (conflict) return "Not syncing until you choose which copy to keep.";
  if (syncing) return "Syncing…";
  if (failed) return "Couldn't reach your account. VahanaIQ will try again when you next make a change.";
  return "Synced. Changes you make here are saved to your account.";
}

function renderAccount() {
  const btn = $("accountBtn");
  if (!btn) return;
  const name = user ? (user.displayName || "").trim().split(/\s+/)[0] || "Account" : "";
  btn.textContent = user ? name : restoring ? "Account" : "Sign In";
  btn.classList.toggle("needs-attention", !!user && (!!conflict || failed));
  btn.setAttribute("aria-label", user ? `Account: ${user.email || name}. ${statusText()}` : restoring ? "Account" : "Sign in to sync");

  $("accountSignedOut").hidden = !!user;
  $("accountSignedIn").hidden = !user;
  $("signInBtn").disabled = !fb;
  $("signInBtn").textContent = fb ? "Sign In with Google" : "Loading…";
  if (!user) return;
  $("accountEmail").textContent = user.email || user.displayName || "your Google account";
  $("syncStatus").textContent = statusText();
  $("syncConflict").hidden = !conflict;
  if (conflict) $("syncConflictCounts").textContent = `Your account has ${count(conflict)}. This browser has ${count(localCopy())}.`;
}

function openAccount() {
  if (!fb) {
    loadFirebase().then(renderAccount, () => setError("Couldn't load Google sign-in. Check your connection and try again."));
  }
  setError("");
  $("deleteConfirm").hidden = true;
  renderAccount();
  if (!isOpen($("accountModal"))) openModal($("accountModal"), $("accountBtn"));
}

// reload() shows inputs and vehicles that sync wrote to this browser
export function initAccount({ reload }) {
  if (!$("accountBtn") || typeof window.addEventListener !== "function") return;
  hooks = { reload };
  $("accountBtn").addEventListener("click", openAccount);
  for (const id of ["closeAccountBtn", "cancelAccountBtn"]) $(id).addEventListener("click", () => closeModal($("accountModal")));
  $("signInBtn").addEventListener("click", signIn);
  $("signOutBtn").addEventListener("click", () => signOutHere());
  $("deleteDataBtn").addEventListener("click", () => { $("deleteConfirm").hidden = false; $("cancelDeleteBtn").focus(); });
  $("cancelDeleteBtn").addEventListener("click", () => { $("deleteConfirm").hidden = true; $("deleteDataBtn").focus(); });
  $("confirmDeleteBtn").addEventListener("click", deleteData);
  $("useCloudBtn").addEventListener("click", () => resolveConflict(true));
  $("keepLocalBtn").addEventListener("click", () => resolveConflict(false));

  window.addEventListener(SAVED_EVENT, scheduleSync);
  window.addEventListener("online", () => syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncNow();
    else if (writeTimer) syncNow(); // send a pending change before the tab is put away
  });
  if (restoring) loadFirebase().catch(e => console.warn("Couldn't restore sign-in:", e));
  renderAccount();
}
