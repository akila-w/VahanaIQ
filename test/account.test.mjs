// Account sync decisions (js/account.js): what is copied to the account and which way to sync
import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.document = { addEventListener() {}, getElementById: () => null };
globalThis.window = {};
const { cloudCopy, parseCloud, isEmptyCopy, fingerprint, syncDirection } = await import('../js/account.js');

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
assert.match(account, /MAX_SIZE = 900000/);
assert.match(rules, /data\.size\(\) <= 900000/);

console.log('Account sync checks passed');

const planner = { version: 1, draft: { plannerVehicle: 'test-car', plannerSaved: '125000.25' }, scenarios: [{ id: 'goal-a', name: 'Deposit', draft: { plannerVehicle: 'test-car' }, savedOn: '2026-10-21' }] };
const planned = cloudCopy({}, { cars: [] }, planner);
assert.ok(!isEmptyCopy(planned));
assert.deepEqual(parseCloud({ data: JSON.stringify(planned) }).planner, planner);
assert.notEqual(fingerprint(planned), fingerprint(empty));
assert.equal(syncDirection(empty, planned, null), 'download');
