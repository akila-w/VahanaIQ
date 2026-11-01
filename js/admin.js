// The Photo Studio belongs to the site's administrator alone (ADMIN_UID in js/config.js). Everyone
// else never sees a link to it, and studio.html shows them an ordinary not-found page. Links follow
// the sign-in record js/account.js keeps in this browser; the studio page also asks Firebase whether
// that sign-in is still current before it opens. The studio's photos stay in this browser, so there
// is no server data behind this check: it decides what the page shows.
import { ADMIN_UID, FIREBASE_SDK, firebaseConfig } from "./config.js?v=2.12.0";

// The same names as in js/account.js, which this page may not load (test/account.test.mjs checks them)
export const SIGNED_IN_KEY = "vahanaiq_account_v1"; // the signed-in uid
export const ACCOUNT_EVENT = "vahanaiq:account"; // fired when someone signs in or out
const VERIFY_WAIT = 6000;

const signedInAs = () => { try { return localStorage.getItem(SIGNED_IN_KEY); } catch (e) { return null; } };

// Whether this browser's last sign-in was the administrator. It needs no network, so every page
// can ask it before drawing anything.
export const isAdminHint = (uid = signedInAs()) => !!ADMIN_UID && uid === ADMIN_UID;

// Who Firebase says is signed in, read with the same app and persistence as js/account.js: the uid,
// null for nobody, or undefined when Firebase cannot be reached (offline, or blocked).
function firebaseUid() {
  const ask = Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-auth.js`)
  ]).then(async ([app, A]) => {
    const firebaseApp = app.getApps().length ? app.getApp() : app.initializeApp(firebaseConfig);
    const auth = A.initializeAuth(firebaseApp, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence] });
    await auth.authStateReady();
    return auth.currentUser ? auth.currentUser.uid : null;
  }).catch(() => undefined);
  return Promise.race([ask, new Promise(resolve => setTimeout(resolve, VERIFY_WAIT))]);
}

// The studio page's decision. Only the administrator's record leads to Firebase at all; when
// Firebase cannot answer, the record decides, as it does for the links, so the studio still opens
// offline.
export async function confirmAdmin() {
  if (!isAdminHint()) return false;
  const uid = await firebaseUid();
  return uid === undefined ? true : uid === ADMIN_UID;
}

// The Studio link, after Showroom in the header and footer navigation, for the administrator only.
// It is never part of a page's own markup, so visitors' pages carry no trace of it.
export function renderAdminLinks(doc = document) {
  const admin = isAdminHint();
  for (const nav of doc.querySelectorAll('nav[aria-label="Main"], nav[aria-label="Explore"]')) {
    const existing = nav.querySelector("a[data-admin-link]");
    if (!admin) { existing?.remove(); continue; }
    if (existing) continue;
    const link = doc.createElement("a");
    link.href = "studio.html";
    link.textContent = "Studio";
    link.dataset.adminLink = "";
    const showroom = nav.querySelector('a[href="catalogue.html"]');
    if (showroom) showroom.after(link);
    else nav.append(link);
  }
}

export function watchAdminLinks() {
  renderAdminLinks();
  window.addEventListener(ACCOUNT_EVENT, () => renderAdminLinks());
  window.addEventListener("storage", event => { if (event.key === SIGNED_IN_KEY || event.key === null) renderAdminLinks(); });
}
