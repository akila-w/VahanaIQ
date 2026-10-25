// Google sign-in and sync. Firebase (Google's sign-in and database service) loads only when
// someone opens the account dialog, or on a later visit once they have signed in, so the
// calculator never waits for it. Each person has one Firestore document, users/{uid}, with the
// same inputs and comparison this browser keeps in localStorage; firestore.rules let only its
// owner read, change or delete it. Before every write the account's copy is read and compared
// with the copy both sides last agreed on, so a change made on another device is never
// overwritten without asking.
import { firebaseConfig, FIREBASE_SDK, GOOGLE_CLIENT_ID, GOOGLE_SIGN_IN_SRC } from "./config.js?v=2.11.6";
import { openModal, closeModal, isOpen } from "./modal.js?v=2.11.6";
import { showToast } from "./toast.js?v=2.11.6";
import { COMPARISON_KEY, SAVED_EVENT } from "./storage.js?v=2.11.6";
import { STORE_KEY } from "./inputs.js?v=2.11.6";
import { PLANNER_KEY, cleanPlanner } from "./planner-store.js?v=2.11.6";

const SIGNED_IN_KEY = "vahanaiq_account_v1"; // set while signed in, so the next visit restores the session
const AGREED_KEY = "vahanaiq_synced_v1"; // fingerprint of the copy this browser and the account last agreed on
const WRITE_DELAY = 1500;
export const MAX_SIZE = 700000; // 700,000-byte budget (below firestore.rules 900,000-character limit)

const $ = id => document.getElementById(id);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  remove: k => { try { localStorage.removeItem(k); } catch (e) {} }
};

// --- What is synced (pure, tested in test/account.test.mjs)

// The copy kept in the account. Photos made in this browser (data: URLs) stay on this device:
// they are large, and the person can add them again.
export function cloudCopy(inputs, comparison, planner = null) {
  const cars = Array.isArray(comparison?.cars) ? comparison.cars.filter(c => c && typeof c === "object") : [];
  const copy = {
    inputs: inputs && typeof inputs === "object" && !Array.isArray(inputs) ? inputs : {},
    cars: cars.map(c => /^data:/i.test(c.img || "") ? { ...c, img: "" } : c)
  };
  const clean = cleanPlanner(planner);
  if (clean) copy.planner = clean;
  return copy;
}

export function parseCloud(data) {
  try {
    const parsed = JSON.parse(data?.data);
    return cloudCopy(parsed?.inputs, { cars: parsed?.cars }, parsed?.planner);
  } catch (e) {
    return cloudCopy(null, null);
  }
}

export const isEmptyCopy = copy => !copy.cars.length && !Object.keys(copy.inputs).length && !copy.planner;

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
let restoring = !!store.get(SIGNED_IN_KEY);
let conflict = null; // the account's copy while the person chooses which to keep
let failed = false;
let syncing = null, again = false, writeTimer = null;
let hooks = { reload: () => {}, beforeApply: () => {} };
let generation = 0;
let localSignOut = null;
let deleting = null;
const session = () => user && ({ uid: user.uid, generation, identity: user, firebase: fb });
const current = ctx => !!ctx && user?.uid === ctx.uid && generation === ctx.generation && fb === ctx.firebase;

function loadFirebase() {
  if (fb) return Promise.resolve(fb);
  loading = loading || Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-auth.js`),
    import(`${FIREBASE_SDK}/firebase-firestore-lite.js`)
  ]).then(([app, A, F]) => {
    const firebaseApp = app.initializeApp(firebaseConfig);
    // No pop-up helper up front: sign-in normally comes from Google's button (signInWithCredential)
    const auth = A.initializeAuth(firebaseApp, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence] });
    fb = { A, F, auth, db: F.getFirestore(firebaseApp) };
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
  const previous = user;
  const storedOwner = store.get(SIGNED_IN_KEY);
  if (!previous && restoring && (!u || (storedOwner !== "1" && storedOwner !== u.uid))) {
    applyCopy(cloudCopy(null, null));
  }
  if (previous?.uid !== u?.uid) {
    generation++;
    clearTimeout(writeTimer);
    writeTimer = null;
    syncing = null;
    again = false;
    conflict = null;
    deleting = null;
    failed = false;
    // Initial anonymous use keeps its guest draft. A departed account never leaves its
    // private UI in another tab or gives it to a different account.
    if (previous && !(localSignOut?.uid === previous.uid && !u)) applyCopy(cloudCopy(null, null));
    store.remove(AGREED_KEY);
  }
  user = u;
  restoring = false;
  if (u) {
    store.set(SIGNED_IN_KEY, u.uid);
    syncNow();
  } else {
    store.remove(SIGNED_IN_KEY);
    store.remove(AGREED_KEY);
    conflict = null;
  }
  renderAccount();
}

const userDoc = ctx => ctx.firebase.F.doc(ctx.firebase.db, "users", ctx.uid);

function localCopy() {
  const read = k => { try { return JSON.parse(store.get(k) || "null"); } catch (e) { return null; } };
  return cloudCopy(read(STORE_KEY), read(COMPARISON_KEY), read(PLANNER_KEY));
}

const agree = copy => store.set(AGREED_KEY, fingerprint(copy));

export async function upload(copy, ctx = session()) {
  if (fb && !current(ctx)) return;
  const data = JSON.stringify(copy);
  const bytes = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(data).length
    : (typeof Buffer !== "undefined" ? Buffer.byteLength(data, "utf8") : data.length);
  if (bytes > MAX_SIZE) {
    showToast("Too large to sync; photos stay on this device");
    throw new Error("Comparison too large to sync");
  }
  if (!ctx?.firebase) return;
  await ctx.firebase.F.setDoc(userDoc(ctx), { version: 1, data, updatedAt: ctx.firebase.F.serverTimestamp() });
  if (current(ctx)) agree(copy);
}

// Writes a copy to this browser and shows it, keeping this device's own photos
function applyCopy(copy) {
  hooks.beforeApply();
  const own = new Map();
  try {
    for (const c of JSON.parse(store.get(COMPARISON_KEY) || "{}")?.cars || []) {
      if (/^data:/i.test(c?.img || "")) own.set(c.id, c.img);
    }
  } catch (e) {}
  const cars = copy.cars.map(c => !c.img && own.has(c.id) ? { ...c, img: own.get(c.id) } : c);
  store.set(STORE_KEY, JSON.stringify(copy.inputs));
  store.set(COMPARISON_KEY, JSON.stringify({ version: 3, cars }));
  if (copy.planner) store.set(PLANNER_KEY, JSON.stringify(copy.planner));
  else store.remove(PLANNER_KEY);
  hooks.reload();
}

async function runSync(ctx) {
  try {
    const snap = await ctx.firebase.F.getDoc(userDoc(ctx));
    if (!current(ctx)) return;
    const cloud = snap.exists() ? parseCloud(snap.data()) : null;
    const local = localCopy();
    const direction = syncDirection(local, cloud, store.get(AGREED_KEY));
    if (direction === "same") agree(local);
    else if (direction === "upload") await upload(local, ctx);
    else if (direction === "download") {
      applyCopy(cloud);
      agree(cloud);
      showToast("Updated with the inputs and vehicles saved in your account.");
    } else if (direction === "deleted") {
      await signOutHere("Your saved data was deleted on another device, so this browser signed out and cleared it.", { flush: false, clear: "always" });
    } else {
      conflict = { copy: cloud, session: ctx };
      openAccount();
    }
    if (current(ctx)) failed = false;
  } catch (e) {
    if (!current(ctx)) return;
    console.warn("Account sync failed:", e);
    failed = true;
  }
}

function syncNow() {
  if (!user || conflict || current(deleting)) return Promise.resolve();
  if (syncing) { again = true; return syncing; }
  clearTimeout(writeTimer);
  writeTimer = null;
  const ctx = session();
  const pending = runSync(ctx).finally(() => {
    if (!current(ctx) || syncing !== pending) return;
    syncing = null;
    renderAccount();
    if (again) { again = false; syncNow(); }
  });
  syncing = pending;
  renderAccount();
  return pending;
}

function scheduleSync() {
  if (!user || conflict || current(deleting)) return;
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

// Google's sign-in button, loaded with the dialog. Its callback gets an ID token, and Firebase
// signs in with it; no Firebase pop-up is involved, so Safari's storage rules don't get in the way.
let gsi = null;
function loadGoogleButton() {
  gsi = gsi || new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) { resolve(window.google.accounts.id); return; }
    const script = document.createElement("script");
    script.src = GOOGLE_SIGN_IN_SRC;
    script.async = true;
    script.onload = () => window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google sign-in unavailable"));
    script.onerror = () => reject(new Error("Couldn't load Google sign-in"));
    document.head.appendChild(script);
  }).then(id => {
    id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleCredential, ux_mode: "popup", context: "signin", locale: "en", auto_select: false });
    return id;
  }).catch(e => {
    gsi = null;
    throw e;
  });
  return gsi;
}

async function onGoogleCredential(response) {
  setError("");
  try {
    const f = await loadFirebase();
    await f.A.signInWithCredential(f.auth, f.A.GoogleAuthProvider.credential(response.credential));
  } catch (e) {
    setError(signInMessage(e));
  }
}

const darkTheme = () => {
  const set = document.documentElement.getAttribute("data-theme");
  return set ? set === "dark" : !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
};

function showPopupFallback() {
  $("googleSignIn").textContent = "";
  $("signInBtn").hidden = false;
}

// When Google refuses this site's address it leaves a placeholder and never shows its real
// button (an iframe), so after a few seconds without one, the Firebase pop-up button is offered
const GOOGLE_BUTTON_WAIT = 5000;
let fallbackTimer = null;

function renderGoogleButton() {
  clearTimeout(fallbackTimer);
  loadGoogleButton().then(id => {
    const box = $("googleSignIn");
    box.textContent = "";
    $("signInBtn").hidden = true;
    const boxWidth = Math.floor(box.getBoundingClientRect().width);
    const width = Math.max(200, Math.min(400, boxWidth || 400));
    id.renderButton(box, { type: "standard", theme: darkTheme() ? "filled_black" : "outline", size: "large", text: "signin_with", shape: "rectangular", logo_alignment: "left", width, locale: "en" });
    fallbackTimer = setTimeout(() => {
      if (![...box.querySelectorAll("iframe")].some(f => f.getBoundingClientRect().height > 0)) showPopupFallback();
    }, GOOGLE_BUTTON_WAIT);
  }, showPopupFallback);
}

function signIn() {
  if (!fb) return;
  setError("");
  // The popup opens straight from the click (Firebase is already loaded), so browsers allow it
  fb.A.signInWithPopup(fb.auth, new fb.A.GoogleAuthProvider(), fb.A.browserPopupRedirectResolver).catch(e => setError(signInMessage(e)));
}

// Signing out takes the account's inputs and vehicles out of this browser, unless some changes
// never reached the account. flush sends a pending change first (a sync already running passes
// false, since it is that sync); clear "always" removes them even then.
async function signOutHere(message, { flush = true, clear = "if-synced" } = {}) {
  const ctx = session();
  if (!current(ctx)) return;
  if (flush && (writeTimer || syncing)) await syncNow();
  if (!current(ctx)) return;
  clearTimeout(writeTimer);
  writeTimer = null;
  const unsynced = fingerprint(localCopy()) !== store.get(AGREED_KEY);
  conflict = null;
  store.remove(SIGNED_IN_KEY);
  store.remove(AGREED_KEY);
  localSignOut = ctx;
  try { await ctx.firebase.A.signOut(ctx.firebase.auth); } catch (e) { localSignOut = null; setError("Couldn’t sign out. Check your connection and try again."); return; }
  localSignOut = null;
  // Auth callbacks may already have ended this session. A replacement account owns
  // everything after that transition; the older operation must not touch it.
  if (user && !current(ctx)) return;
  window.google?.accounts?.id?.disableAutoSelect?.();
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
  const ctx = session();
  if (!current(ctx)) return;
  if (current(deleting)) return;
  deleting = ctx;
  again = false;
  const btn = $("confirmDeleteBtn");
  btn.disabled = true;
  clearTimeout(writeTimer);
  writeTimer = null;
  try {
    if (syncing) await syncing;
    if (!current(ctx)) return;
    await ctx.firebase.F.deleteDoc(userDoc(ctx));
    if (!current(ctx)) return;
    // Also removes the sign-in record when Google allows it (it needs a recent sign-in)
    // Removing the app document is sufficient. The Google/Firebase identity may
    // be shared by an in-flight sign-in, so never delete or retarget that identity.
    await signOutHere("Deleted your saved inputs and vehicles from your account and this browser.", { flush: false, clear: "always" });
  } catch (e) {
    if (!current(ctx)) return;
    console.warn("Couldn't delete account data:", e);
    $("syncStatus").textContent = "Couldn't delete your saved data. Check your connection and try again.";
  } finally {
    if (deleting === ctx) deleting = null;
    if (user && !current(ctx)) return;
    btn.disabled = false;
    $("deleteConfirm").hidden = true;
  }
}

function resolveConflict(useAccount) {
  const choice = conflict;
  if (!choice || !current(choice.session) || current(deleting)) return;
  const { copy: cloud, session: ctx } = choice;
  conflict = null;
  if (useAccount) {
    applyCopy(cloud);
    agree(cloud);
    showToast("Now showing the inputs and vehicles saved in your account.");
    renderAccount();
  } else {
    const pending = upload(localCopy(), ctx).then(() => { if (current(ctx)) failed = false; }, e => { if (current(ctx)) { console.warn("Account sync failed:", e); failed = true; } })
      .finally(() => { if (current(ctx) && syncing === pending) { syncing = null; renderAccount(); } });
    syncing = pending;
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
  if (!user) {
    for (const id of ["accountEmail", "syncStatus", "syncConflictCounts"]) $(id).textContent = "";
    $("syncConflict").hidden = true;
    $("deleteConfirm").hidden = true;
    const avatar = $("accountAvatar");
    if (avatar) avatar.textContent = "";
    const dot = $("syncDot");
    if (dot?.classList) {
      dot.classList.toggle("ok", false);
      dot.classList.toggle("syncing", false);
      dot.classList.toggle("failed", false);
      dot.classList.toggle("conflict", false);
    }
    return;
  }
  $("accountEmail").textContent = user.email || user.displayName || "your Google account";
  $("syncStatus").textContent = statusText();
  $("syncConflict").hidden = !conflict;
  if (conflict) $("syncConflictCounts").textContent = `Your account has ${count(conflict.copy)}. This browser has ${count(localCopy())}.`;
  const avatar = $("accountAvatar");
  if (avatar) {
    const raw = (user.displayName || user.email || "A").trim();
    avatar.textContent = raw.charAt(0).toUpperCase() || "A";
  }
  const dot = $("syncDot");
  if (dot?.classList) {
    dot.classList.toggle("ok", !syncing && !failed && !conflict);
    dot.classList.toggle("syncing", !!syncing);
    dot.classList.toggle("failed", !!failed);
    dot.classList.toggle("conflict", !!conflict);
  }
}

function openAccount() {
  if (!fb) {
    loadFirebase().then(renderAccount, () => setError("Couldn't load Google sign-in. Check your connection and try again."));
  }
  setError("");
  $("deleteConfirm").hidden = true;
  renderAccount();
  if (!isOpen($("accountModal"))) openModal($("accountModal"), $("accountBtn"));
  if (!user) renderGoogleButton();
}

// reload() shows inputs and vehicles that sync wrote to this browser
export function initAccount({ reload, beforeApply = () => {} }) {
  if (!$("accountBtn") || typeof window.addEventListener !== "function") return;
  hooks = { reload, beforeApply };
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
