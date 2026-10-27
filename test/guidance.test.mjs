import assert from 'node:assert/strict';
import { readGuidance, writeGuidance, GUIDANCE_KEY } from '../js/guidance-state.js';
import { articles, tours } from '../js/guidance-content.js';

const data = new Map([['financial-data', 'untouched']]);
const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
const fresh = readGuidance(storage);
assert.deepEqual(fresh, { version: 1, welcomed: false, tips: true, tours: {} });
fresh.welcomed = true;
fresh.tours.calculator = { status: 'active', step: 2 };
assert.equal(writeGuidance(storage, fresh), true);
assert.deepEqual(readGuidance(storage), fresh);
assert.equal(data.get('financial-data'), 'untouched');
assert.equal(data.size, 2);
for (const invalid of ['broken', 'null', '{"version":2}', '{"version":1,"tours":{"calculator":{"status":"completed","step":-1}}}']) {
  storage.setItem(GUIDANCE_KEY, invalid);
  assert.deepEqual(readGuidance(storage), { version: 1, welcomed: false, tips: true, tours: {} });
}
const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } };
assert.equal(readGuidance(blocked).welcomed, false);
assert.equal(writeGuidance(blocked, fresh), false);
assert.equal(readGuidance(undefined).tips, true);
assert.equal(writeGuidance(undefined, fresh), false);
for (const tour of Object.values(tours)) {
  assert.ok(tour.steps.length >= 3);
  for (const step of tour.steps) assert.ok(articles.some(article => article.id === step.article));
}
assert.equal(new Set(articles.map(a => a.id)).size, articles.length);
console.log('Guidance persistence, malformed/blocked storage, isolation and content checks passed.');
