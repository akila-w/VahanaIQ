// Account sync decisions (js/account.js): what is copied to the account and which way to sync
import assert from 'node:assert/strict';
import fs from 'node:fs';

let lastToast = null;
globalThis.document = {
  addEventListener() {},
  getElementById: (id) => {
    if (id === 'toast') {
      return {
        classList: { add() {}, remove() {}, contains: () => false },
        textContent: '',
        contains: () => false,
        matches: () => false,
        appendChild(child) {
          if (child && child.textContent) lastToast = child.textContent;
        },
        addEventListener() {}
      };
    }
    return null;
  },
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    textContent: '',
    classList: { add() {}, remove() {} },
    appendChild() {},
    addEventListener() {}
  })
};
globalThis.window = {};
const { cloudCopy, parseCloud, isEmptyCopy, fingerprint, syncDirection, upload, MAX_SIZE } = await import('../js/account.js');

// Photos made in the browser stay on the device; other fields are copied as they are
const car = { id: 'user-a', name: 'Toyota Raize', price: 9000000, img: 'https://example.com/raize.jpg' };
const copy = cloudCopy({ rate: '15' }, { version: 3, cars: [car, { ...car, id: 'user-b', img: 'data:image/jpeg;base64,AAAA' }] });
assert.deepEqual(copy.inputs, { rate: '15' });
assert.equal(copy.cars[0].img, car.img);
assert.equal(copy.cars[1].img, '', 'data: photos are not uploaded');
assert.deepEqual(cloudCopy(null, null), { inputs: {}, cars: [] });
assert.deepEqual(cloudCopy(['x'], { cars: 'nope' }), { inputs: {}, cars: [] });
assert.ok(isEmptyCopy(cloudCopy(null, null)));
assert.ok(!isEmptyCopy(copy));

// The account stores the copy as a JSON string; a damaged one reads as empty
assert.deepEqual(parseCloud({ data: JSON.stringify(copy) }), copy);
assert.deepEqual(parseCloud({ data: '{not json' }), { inputs: {}, cars: [] });
assert.deepEqual(parseCloud(undefined), { inputs: {}, cars: [] });

// Fingerprints are stable and change with the content
assert.equal(fingerprint(copy), fingerprint(JSON.parse(JSON.stringify(copy))));
assert.notEqual(fingerprint(copy), fingerprint({ ...copy, inputs: { rate: '16' } }));

// Which way to sync, against the copy both sides last agreed on
const empty = cloudCopy(null, null);
const a = cloudCopy({ rate: '15' }, { cars: [car] });
const b = cloudCopy({ rate: '18' }, { cars: [] });
const c = cloudCopy({ rate: '12' }, { cars: [car, { ...car, id: 'user-c' }] });
assert.equal(syncDirection(empty, null, null), 'same', 'nothing here and nothing in the account');
assert.equal(syncDirection(a, null, null), 'upload', 'first sign-in with a new account');
assert.equal(syncDirection(a, null, fingerprint(a)), 'deleted', 'the account copy was deleted elsewhere');
assert.equal(syncDirection(a, a, null), 'same');
assert.equal(syncDirection(b, a, fingerprint(a)), 'upload', 'only this browser changed');
assert.equal(syncDirection(a, b, fingerprint(a)), 'download', 'only the account changed');
assert.equal(syncDirection(b, c, fingerprint(a)), 'ask', 'both changed');
assert.equal(syncDirection(b, c, null), 'ask', 'first sign-in on a browser with different data');
assert.equal(syncDirection(empty, c, null), 'download', 'first sign-in on an empty browser');
assert.equal(syncDirection(c, empty, null), 'upload', 'the account copy is empty');

// The rules only let a person reach their own document, with the shape js/account.js writes
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
assert.match(rules, /match \/users\/\{uid\}/);
assert.match(rules, /allow read, delete: if request\.auth != null && request\.auth\.uid == uid;/);
assert.match(rules, /hasOnly\(\["version", "data", "updatedAt"\]\)/);
assert.doesNotMatch(rules, /allow read, write: if true/);
const account = fs.readFileSync(new URL('../js/account.js', import.meta.url), 'utf8');
assert.match(account, /setDoc\(userDoc\(ctx\), \{ version: 1, data, updatedAt: ctx\.firebase\.F\.serverTimestamp\(\) \}\)/);
assert.match(account, /MAX_SIZE = 700000/);
assert.match(rules, /data\.size\(\) <= 900000/);

console.log('Account sync checks passed');

const planner = { version: 1, draft: { plannerVehicle: 'test-car', plannerSaved: '125000.25' }, scenarios: [{ id: 'goal-a', name: 'Deposit', draft: { plannerVehicle: 'test-car' }, savedOn: '2026-10-21' }] };
const planned = cloudCopy({}, { cars: [] }, planner);
assert.ok(!isEmptyCopy(planned));
assert.deepEqual(parseCloud({ data: JSON.stringify(planned) }).planner, planner);
assert.notEqual(fingerprint(planned), fingerprint(empty));
assert.equal(syncDirection(empty, planned, null), 'download');

// Sinhala and Tamil-sized payload testing (3 UTF-8 bytes per character)
// Budget is 700,000 UTF-8 bytes.
const baseVehicle = { id: 'car-sl', name: 'Toyota Aqua', price: 8500000, img: '' };
function makePayload(targetBytes) {
  const enc = new TextEncoder();
  let notes = '';
  let copy = cloudCopy({ notes }, { version: 3, cars: [baseVehicle] });
  let currentBytes = enc.encode(JSON.stringify(copy)).length;
  const diff = targetBytes - currentBytes;
  if (diff > 0) {
    const mix = 'සිංහල' + 'தமிழ்'; // 10 chars, 30 bytes
    const blocks = Math.floor(diff / 30);
    notes = mix.repeat(blocks);
    currentBytes = enc.encode(JSON.stringify(cloudCopy({ notes }, { version: 3, cars: [baseVehicle] }))).length;
    const remaining = targetBytes - currentBytes;
    notes += 'A'.repeat(remaining);
  }
  return cloudCopy({ notes }, { version: 3, cars: [baseVehicle] });
}

// Just under budget: target 699,950 UTF-8 bytes
const underCopy = makePayload(699950);
const underEncodedLen = new TextEncoder().encode(JSON.stringify(underCopy)).length;

assert.equal(underEncodedLen, 699950);
assert.ok(underEncodedLen <= MAX_SIZE, `Under payload must be <= ${MAX_SIZE} bytes (got ${underEncodedLen})`);
// In UTF-16 character length, it is ~233,000 characters, well within Firestore rules character limit (900,000)
assert.ok(JSON.stringify(underCopy).length < 900000, 'UTF-16 char length is well under 900,000');

// Under budget payload syncs without throwing
let writtenData = null;
const mockCtxUnder = {
  uid: 'test-user',
  generation: 1,
  firebase: {
    db: {},
    F: {
      doc: () => 'users/test-user',
      setDoc: async (_doc, data) => { writtenData = data; },
      serverTimestamp: () => 12345
    }
  }
};
await upload(underCopy, mockCtxUnder);
assert.ok(writtenData, 'Under budget payload was written successfully');

// Just over budget: target 700,050 UTF-8 bytes
const overCopy = makePayload(700050);
const overEncodedLen = new TextEncoder().encode(JSON.stringify(overCopy)).length;

assert.equal(overEncodedLen, 700050);
assert.ok(overEncodedLen > MAX_SIZE, `Over payload must be > ${MAX_SIZE} bytes (got ${overEncodedLen})`);
// But notice: in UTF-16 character length, it is STILL under 900,000 characters!
assert.ok(JSON.stringify(overCopy).length < 900000, 'UTF-16 char length is still under 900,000, showing byte-vs-char divergence');

// Over budget payload throws and shows the visible toast message
lastToast = null;
await assert.rejects(
  () => upload(overCopy, mockCtxUnder),
  /Comparison too large to sync/
);
assert.equal(lastToast, 'Too large to sync; photos stay on this device', 'Visible toast message shown on size failure');

// Verifying syncDirection does not mark it agreed:
// Since upload failed, agreed fingerprint remains that of the underCopy
const agreedFingerprint = fingerprint(underCopy);
assert.equal(syncDirection(overCopy, underCopy, agreedFingerprint), 'upload', 'syncDirection remains upload and is not marked agreed');

// Clear any toast timeouts so Node process exits immediately
const { clearToast } = await import('../js/toast.js?v=2.12.0');
clearToast();

// The Photo Studio is the administrator's alone (js/admin.js). Its check reads the record this file
// writes, by the same names, and identifies the administrator by Firebase UID, never by email.
const admin = await import('../js/admin.js?v=2.12.0');
const { ADMIN_UID } = await import('../js/config.js?v=2.12.0');
assert.equal(admin.SIGNED_IN_KEY, account.match(/const SIGNED_IN_KEY = "([^"]+)"/)[1], 'js/admin.js must read the key js/account.js writes');
assert.equal(admin.ACCOUNT_EVENT, account.match(/export const ACCOUNT_EVENT = "([^"]+)"/)[1], 'js/admin.js must listen for the event js/account.js fires');
assert.equal(typeof ADMIN_UID, 'string');
assert.doesNotMatch(ADMIN_UID, /@/, 'ADMIN_UID is a Firebase UID, never an email address');
assert.equal(admin.isAdminHint(null), false);
assert.equal(admin.isAdminHint('1'), false, 'the legacy "1" record never identifies the administrator');
assert.equal(admin.isAdminHint('someone-else'), false);
assert.equal(admin.isAdminHint(''), false, 'an empty ADMIN_UID or record admits nobody');
if (ADMIN_UID) assert.equal(admin.isAdminHint(ADMIN_UID), true);
// Studio photos stay in the browser; should anything of the studio's reach Firestore, the rules must
// check the same UID.
for (const file of ['admin.js', 'studio-page.js', 'catalogue-studio.js', 'catalogue-photo-store.js', 'catalogue-photo-overlay.js']) {
  assert.doesNotMatch(fs.readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8'), /firestore/i, `js/${file} must not write to Firestore`);
}
if (/studio/i.test(rules)) assert.ok(ADMIN_UID && rules.includes(ADMIN_UID), 'Studio rules in firestore.rules must check ADMIN_UID');
console.log("Studio admin: identified by Firebase UID from the record js/account.js writes");
