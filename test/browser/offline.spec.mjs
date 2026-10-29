import { test, expect, chromium, webkit, firefox } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { offlineServer } from './offline-server.mjs';
import { seedReturning } from './returning-user.mjs';
const CURRENT_CACHE = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8').match(/const CACHE = "([^"]+)"/)[1];
const stylesheetDigest = body => createHash('sha256').update(body).digest('hex');
const PREVIOUS_EXPERIENCE_DIGEST = stylesheetDigest(gunzipSync(readFileSync(new URL('../fixtures/task031-experience.css.gz', import.meta.url))));
const CURRENT_EXPERIENCE_DIGEST = stylesheetDigest(readFileSync(new URL('../../css/experience.css', import.meta.url)));
let site;
test.beforeEach(async ({ context }) => {
  site = await offlineServer();
  await seedReturning(context);
  // Optional account/search integrations are outside the offline shell.
  await context.route(/https:\/\//, route => route.abort());
  await context.addInitScript(() => {
    window.__offlineCSP = [];
    document.addEventListener('securitypolicyviolation', e => window.__offlineCSP.push(e.violatedDirective));
  });
});
test.afterEach(async () => { await site?.close(); });

// Firefox's explicit offline/interception path is diagnosed separately. Cut the
// actual test origin's sockets there; external HTTPS is already blocked. This
// includes worker-origin traffic and does not depend on HTTP cache warming.
async function setOffline(context, value) {
  if (test.info().project.use.browserName === 'firefox') site.state.disconnected = value;
  else await context.setOffline(value);
}

async function installed(page) {
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state)).toBe('activated');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

function errors(page) {
  const failed = [], exceptions = [];
  page.on('requestfailed', req => { if (/\/(js|css)\/.*\.(js|css)(\?|$)/.test(req.url()) && req.url().startsWith(site.origin)) failed.push(req.url()); });
  page.on('pageerror', e => exceptions.push(e.message));
  return { failed, exceptions };
}

// Isolates precaching from opportunistic runtime/HTTP caching: the installer has
// never loaded any application module before going offline.
test('isolated first install loads calculator modules offline', async ({ page, context }) => {
  await page.goto(site.origin + '/__blank.html');
  await page.evaluate(() => navigator.serviceWorker.register('sw.js'));
  await installed(page);
  await setOffline(context, true);
  const observed = errors(page);
  await page.goto(site.origin + '/index.html');
  await expect(page.locator('#helpCentreButton')).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('assets/icons/favicon.svg?v=20261020')).ok)).toBe(true);
  expect(observed.failed).toEqual([]);
  expect(observed.exceptions).toEqual([]);
});

const car = { id: 'offline-car', name: 'Offline comparison', price: 7269515.4, cond: 'New', pt: 'Petrol', w: 'Official', img: '', custom: true };
async function saveData(page) {
  await expect(page.locator('#rate')).not.toHaveValue('');
  await page.evaluate(async car => {
    const storage = await import('./js/storage.js?v=2.12.0');
    if (!storage.saveCars([car])) throw Error('Could not save comparison');
    for (const [id, value] of Object.entries({ income: '220000', rate: '0', tenure: '12', down: '60' })) {
      const field = document.getElementById(id); field.value = value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const planner = await import('./js/planner-store.js?v=2.12.0');
    planner.savePlanner({ version: 1, draft: { plannerSaved: '100000' }, scenarios: [] });
    const photos = await import('./js/catalogue-photo-store.js?v=2.12.0');
    if (!await photos.writeEdit({ version: 1, modelId: 'offline-probe', name: 'Persistent photo fixture', coverId: 'official:probe', items: [{ id: 'official:probe', kind: 'official', frame: { scale: 1.2, x: 0.1, y: 0 } }] })) throw Error('Could not save photo edit');
  }, car);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_inputs_v1') || '{}').income)).toBe('220000');
}
async function checkData(page) {
  await expect(page.locator('#rows')).toContainText(car.name);
  await expect(page.locator('#budgetDtiHero')).toHaveText('110.1% DTI');
  await expect(page.locator('#budgetCashflowLabel')).toContainText('Monthly shortfall: LKR 22,317.18');
  expect(await page.evaluate(async () => {
    const { readEdit } = await import('./js/catalogue-photo-store.js?v=2.12.0');
    return (await readEdit('offline-probe')).items[0].frame;
  })).toEqual({ scale: 1.2, x: 0.1, y: 0 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vahanaiq_planner_v1')).draft.plannerSaved)).toBe('100000');
}
async function functional(page, route) {
  await expect(page.locator('#helpCentreButton')).toBeVisible();
  if (route === 'index.html') {
    await expect(page.locator('#toggleSavingsDrawer')).toBeVisible();
    await page.locator('#toggleSavingsDrawer').click();
    await page.locator('#plannerCalendar').click();
    await expect(page.locator('.calendar-grid')).toBeVisible();
    await page.keyboard.press('Escape');
  } else if (route === 'catalogue.html') {
    await expect(page.locator('#vehicles .card').first()).toBeVisible();
  } else {
    await page.locator('#modelList [data-model]').nth(2).click();
    await expect(page.locator('.studio-editor')).toBeVisible();
  }
  expect(await page.evaluate(() => window.__offlineCSP)).toEqual([]);
}

for (const mount of ['/', '/VahanaIQ/']) for (const entry of ['index.html', 'catalogue.html', 'studio.html']) {
  test(`fresh direct ${mount}${entry}: install, offline entry and navigation`, async ({ page, context }) => {
    await page.goto(site.origin + mount + entry);
    await installed(page);
    const registration = await page.evaluate(async () => ({ scope: (await navigator.serviceWorker.getRegistration()).scope }));
    expect(registration.scope).toBe(site.origin + mount);
    // Check no image catalogue was fetched by installation, nor duplicated root HTML.
    const cachePaths = await page.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).map(r => new URL(r.url).pathname));
    expect(cachePaths.some(p => p.includes('/assets/images/'))).toBe(false);
    expect(cachePaths.filter(p => p === mount)).toEqual([]);
    await setOffline(context, true); // No second controlled online page load.
    const observed = errors(page);
    for (const route of ['index.html', 'catalogue.html', 'studio.html']) {
      await page.goto(site.origin + mount + route + '?offline=1');
      await functional(page, route);
      await expect(page).toHaveTitle(route === 'index.html' ? /Lease/ : route === 'catalogue.html' ? /Catalogue/ : /Studio/);
    }
    await page.goto(site.origin + mount);
    await expect(page.locator('#toggleSavingsDrawer')).toBeVisible();
    expect(observed.failed).toEqual([]);
    expect(observed.exceptions).toEqual([]);
  });
}

test('returning comparison, exact figures and photo edits survive offline reload', async ({ page, context }) => {
  await page.goto(site.origin + '/index.html');
  await installed(page);
  await saveData(page);
  site.state.requests.length = 0;
  await page.reload();
  await checkData(page);
  expect(site.state.requests.filter(url => /\/(js|css)\//.test(url))).toEqual([]);
  await setOffline(context, true);
  const observed = errors(page);
  await page.reload();
  await checkData(page);
  // Recalculate through the real controls while offline.
  if (!await page.locator('#down').isVisible()) await page.locator('#toggleTerms').click();
  await page.locator('#down').fill('100');
  await page.locator('#down').dispatchEvent('change');
  await expect(page.locator('#budgetDtiHero')).toHaveText('0.0% DTI');
  expect(observed.failed).toEqual([]);
  expect(observed.exceptions).toEqual([]);
});

async function update(page) {
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting?.state)).toBe('installed');
}
async function activatedFromObserver(observer) {
  // Cache cleanup happens inside activate, before clients.claim resolves. Opening
  // a controlled document during that transition can race claiming in WebKit.
  // Observe the actual state from outside the scope before starting navigation.
  await expect.poll(() => observer.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration('/VahanaIQ/'))?.active?.state
  )).toBe('activated');
}

async function activate(context, page, revision) {
  // The observer is outside /VahanaIQ/, so it cannot keep the old worker alive.
  const observer = await context.newPage();
  await observer.goto(site.origin + '/__blank.html');
  await page.close();
  await expect.poll(() => observer.evaluate(() => caches.keys())).toEqual([`vahanaiq-test-${revision}`]);
  await activatedFromObserver(observer);
  const next = await context.newPage();
  await next.goto(site.origin + '/VahanaIQ/index.html');
  await installed(next);
  await observer.close();
  return next;
}
async function consistent(page, revision) {
  expect(await page.evaluate(() => [...new Set(Object.values(window.__offlineModules))])).toEqual([revision]);
}

test('two complete cache revisions wait, activate, clean up and roll back without data loss', async ({ page, context }) => {
  site.state.revision = 'A';
  await page.goto(site.origin + '/VahanaIQ/index.html');
  await installed(page);
  await saveData(page);
  site.state.revision = 'B';
  await update(page);
  await page.reload(); // Reload alone retains the waiting update while this tab lives.
  await consistent(page, 'A');
  await checkData(page);
  await page.goto(site.origin + '/VahanaIQ/catalogue.html');
  await consistent(page, 'A');
  await setOffline(context, true);
  await page.goto(site.origin + '/VahanaIQ/index.html');
  await checkData(page);
  await consistent(page, 'A');
  await setOffline(context, false);
  let current = await activate(context, page, 'B');
  await consistent(current, 'B');
  await checkData(current);
  site.state.revision = 'A'; // Controlled rollback installs the original shell again.
  await update(current);
  await consistent(current, 'B');
  current = await activate(context, current, 'A');
  await setOffline(context, true);
  await current.reload();
  await consistent(current, 'A');
  await checkData(current);
});

test('failed update leaves the active complete shell and saved data usable', async ({ page, context }) => {
  site.state.revision = 'A';
  await page.goto(site.origin + '/VahanaIQ/index.html');
  await installed(page);
  await saveData(page);
  site.state.revision = 'broken';
  site.state.fail = 'js/savings.js';
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const failure = new Promise(resolve => reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(); });
    }, { once: true }));
    await reg.update(); await failure;
  });
  expect(await page.evaluate(() => caches.keys())).toEqual(['vahanaiq-test-A']);
  await setOffline(context, true);
  await page.reload();
  await consistent(page, 'A');
  await checkData(page);
});

test('uncached vehicle images fail gracefully while catalogue controls work', async ({ page, context }) => {
  await page.goto(site.origin + '/__blank.html');
  await page.evaluate(() => navigator.serviceWorker.register('sw.js'));
  await installed(page);
  await setOffline(context, true);
  const observed = errors(page);
  await page.goto(site.origin + '/catalogue.html');
  await expect(page.locator('.error-art').first()).toBeVisible();
  await page.locator('#helpCentreButton').click();
  await expect(page.locator('#helpCentre')).toBeVisible();
  expect(observed.failed).toEqual([]);
  expect(observed.exceptions).toEqual([]);
});

test('empty-profile first-use setup remains functional immediately offline', async ({ browser }) => {
  const context = await browser.newContext();
  await context.route(/https:\/\//, route => route.abort());
  try {
    const page = await context.newPage();
    await page.goto(site.origin + '/index.html');
    await installed(page);
    await setOffline(context, true);
    const observed = errors(page);
    await page.reload();
    await page.getByRole('button', { name: 'Start Guided Setup (Takes 2 min) →', exact: true }).click();
    const search = page.getByRole('searchbox', { name: 'Search vehicles', exact: true });
    for (const name of ['Toyota Aqua', 'Toyota Camry Hybrid']) {
      await search.fill(name);
      await page.locator('.onboarding-car').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('button', { name: '+ Add to Shortlist', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Continue to Loan Terms →', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to Affordability Check →', exact: true }).click();
    await page.getByRole('button', { name: 'Skip Income', exact: true }).click();
    await page.getByRole('button', { name: 'Open My Lease →', exact: true }).click();
    await expect(page.locator('#rows tr')).toHaveCount(2);
    expect(observed.failed).toEqual([]);
    expect(observed.exceptions).toEqual([]);
  } finally { await context.close(); }
});


// WebKit's disposable contexts reject IndexedDB Blob writes. A persistent profile
// exercises the normal saved-browser contract for uploaded photos on every engine.
test('uploaded photo bytes survive an update, offline reload and browser restart', async ({ browserName }) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'vahanaiq-offline-'));
  const engine = { chromium, webkit, firefox }[browserName];
  let context;
  async function open() {
    const profile = await engine.launchPersistentContext(directory);
    await seedReturning(profile);
    await profile.route(/https:\/\//, route => route.abort());
    return profile;
  }
  async function photoBytes(page) {
    return page.evaluate(async () => {
      const { readEdit } = await import('./js/catalogue-photo-store.js?v=2.12.0');
      return [...new Uint8Array(await (await readEdit('offline-upload')).items[0].blob.arrayBuffer())];
    });
  }
  try {
    context = await open();
    site.state.revision = 'upload-A';
    let page = context.pages()[0];
    await page.goto(site.origin + '/VahanaIQ/index.html');
    await installed(page);
    await saveData(page);
    const expected = await page.evaluate(async () => {
      const { writeEdit } = await import('./js/catalogue-photo-store.js?v=2.12.0');
      const { uploadItem } = await import('./js/catalogue-photos.js?v=2.12.0');
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII='), c => c.charCodeAt(0));
      const item = uploadItem(new File([bytes], 'offline.png', { type: 'image/png' }));
      if (!await writeEdit({ version: 1, modelId: 'offline-upload', coverId: item.id, items: [item] })) throw Error('Could not save uploaded photo');
      return [...bytes];
    });
    site.state.revision = 'upload-B';
    await update(page);
    page = await activate(context, page, 'upload-B');
    await setOffline(context, true);
    await page.reload();
    await checkData(page);
    expect(await photoBytes(page)).toEqual(expected);
    await context.close();
    context = await open();
    await setOffline(context, true);
    page = context.pages()[0];
    await page.goto(site.origin + '/VahanaIQ/index.html');
    await checkData(page);
    expect(await photoBytes(page)).toEqual(expected);
  } finally {
    await context?.close();
    await rm(directory, { recursive: true, force: true });
  }
});


// The fixture is the deployed a0bf238 worker, SHA-256 recorded in the review.
// Its registration bootstrap and app are reconstructed byte-for-byte by the server.
test('deployed legacy worker migrates with warm assets, two tabs and saved data', async ({ page, context }) => {
  site.state.legacy = true;
  await page.goto(site.origin + '/VahanaIQ/index.html');
  await page.evaluate(() => navigator.serviceWorker.register('sw.js'));
  await installed(page);
  await saveData(page);
  await page.reload(); // Warm the six dependencies missing from the legacy shell.
  await checkData(page);
  const second = await context.newPage();
  await second.goto(site.origin + '/VahanaIQ/catalogue.html');
  await expect(second.locator('#vehicles .card').first()).toBeVisible();
  const observer = await context.newPage();
  await observer.goto(site.origin + '/__blank.html');
  await observer.evaluate(async origin => {
    const old = await caches.open('vahanaiq-v2.12.0');
    await old.put(origin + '/VahanaIQ/obsolete.js', new Response('old asset'));
    await old.put(origin + '/VahanaIQ/assets/images/old-photo.webp', new Response('old photo'));
    await (await caches.open('unrelated-app')).put(origin + '/unrelated', new Response('keep'));
  }, site.origin);
  site.state.legacy = false;
  await update(page);
  expect(await observer.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(['vahanaiq-v2.12.0', CURRENT_CACHE, 'unrelated-app']));
  // An old tab can keep calculating and saving while the new worker waits.
  await page.reload();
  await checkData(page);
  await setOffline(context, true);
  await page.reload();
  await checkData(page);
  await setOffline(context, false);
  await page.close();
  expect(await second.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting?.state)).toBe('installed');
  await second.close();
  await expect.poll(() => observer.evaluate(() => caches.keys())).toEqual(['unrelated-app', CURRENT_CACHE]);
  await activatedFromObserver(observer);
  const current = await context.newPage();
  await setOffline(context, true);
  const observed = errors(current);
  await current.goto(site.origin + '/VahanaIQ/index.html');
  await checkData(current);
  expect(await current.evaluate(() => window.__offlineCSP)).toEqual([]);
  expect(observed.failed).toEqual([]);
  expect(observed.exceptions).toEqual([]);
  expect(await current.evaluate(async () => !!await caches.match(new URL('obsolete.js', location.href)))).toBe(false);
});


test('legacy first-install gaps survive a failed migration and repair on retry', async ({ page, context }) => {
  site.state.legacy = true;
  await page.goto(site.origin + '/VahanaIQ/__blank.html');
  await page.evaluate(() => navigator.serviceWorker.register('sw.js'));
  await installed(page);
  expect(await page.evaluate(async () => !!await caches.match(new URL('js/savings.js?v=2.12.0', location.href)))).toBe(false);
  // Seed existing state without importing or warming the missing application graph.
  await page.evaluate(async car => {
    localStorage.setItem('vahanaiq_comparison_v3', JSON.stringify({ version: 3, cars: [car] }));
    localStorage.setItem('vahanaiq_inputs_v1', JSON.stringify({ income: '220000', rate: '0', tenure: '12', down: '60' }));
    localStorage.setItem('vahanaiq_planner_v1', JSON.stringify({ version: 1, draft: { plannerSaved: '100000' }, scenarios: [] }));
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('vahanaiq_catalogue_photos', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('edits', { keyPath: 'modelId' });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('edits', 'readwrite');
        tx.objectStore('edits').put({ modelId: 'offline-probe', items: [{ frame: { scale: 1.2, x: 0.1, y: 0 } }] });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
  }, car);
  site.state.legacy = false;
  site.state.fail = 'js/savings.js';
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const failed = new Promise(resolve => reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(); });
    }, { once: true }));
    await reg.update(); await failed;
  });
  expect(await page.evaluate(() => caches.keys())).toEqual(['vahanaiq-v2.12.0']);
  site.state.fail = '';
  await update(page);
  const observer = await context.newPage();
  await observer.goto(site.origin + '/__blank.html');
  await page.close();
  await expect.poll(() => observer.evaluate(() => caches.keys())).toEqual([CURRENT_CACHE]);
  await activatedFromObserver(observer);
  await setOffline(context, true);
  const current = await context.newPage();
  const observed = errors(current);
  await current.goto(site.origin + '/VahanaIQ/index.html');
  await checkData(current);
  expect(observed.failed).toEqual([]);
  expect(observed.exceptions).toEqual([]);
});

// Exact worker/CSS fixtures from deployed 02f8b335, not a renamed new shell.
test('deployed offline-3 stylesheet upgrades atomically without losing saved data', async ({ page, context }) => {
  const previous = 'vahanaiq-v2.12.0-offline-3';
  const cachedStylesheet = (probe, name) => probe.evaluate(async name => {
    const url = new URL('/VahanaIQ/css/experience.css?v=2.12.0', location.href);
    const response = name ? await (await caches.open(name)).match(url) : await fetch(url);
    if (!response) throw Error('Cached experience stylesheet is missing');
    const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }, name);
  site.state.previousAnchoring = true;
  await page.goto(site.origin + '/VahanaIQ/index.html');
  await installed(page);
  await saveData(page);
  expect(await cachedStylesheet(page, previous)).toBe(PREVIOUS_EXPERIENCE_DIGEST);
  expect(await cachedStylesheet(page)).toBe(PREVIOUS_EXPERIENCE_DIGEST);
  const observer = await context.newPage();
  await observer.goto(site.origin + '/__blank.html');
  site.state.previousAnchoring = false;
  await update(page);
  await expect.poll(() => observer.evaluate(() => caches.keys())).toEqual(expect.arrayContaining([previous, CURRENT_CACHE]));
  // The active tab keeps its original stylesheet while the complete new shell waits.
  await page.reload();
  await checkData(page);
  expect(await cachedStylesheet(page, previous)).toBe(PREVIOUS_EXPERIENCE_DIGEST);
  expect(await cachedStylesheet(page)).toBe(PREVIOUS_EXPERIENCE_DIGEST);
  expect(await cachedStylesheet(observer, CURRENT_CACHE)).toBe(CURRENT_EXPERIENCE_DIGEST);
  await page.close();
  await expect.poll(() => observer.evaluate(() => caches.keys())).toEqual([CURRENT_CACHE]);
  await activatedFromObserver(observer);
  const current = await context.newPage();
  await setOffline(context, true);
  const observed = errors(current);
  await current.goto(site.origin + '/VahanaIQ/index.html');
  await checkData(current);
  expect(await cachedStylesheet(current, CURRENT_CACHE)).toBe(CURRENT_EXPERIENCE_DIGEST);
  expect(await cachedStylesheet(current)).toBe(CURRENT_EXPERIENCE_DIGEST);
  expect(await current.evaluate(() => window.__offlineCSP)).toEqual([]);
  expect(observed.failed).toEqual([]);
  expect(observed.exceptions).toEqual([]);
});

// Exercise the released Task 02 font URLs, not just two names of the new shell.
test('Task 02 TTF shell upgrades atomically to WOFF2 with saved data and offline fonts', async ({ page, context }) => {
  site.state.previousFonts = true;
  site.state.revision = 'task02';
  await page.goto(site.origin + '/VahanaIQ/index.html');
  await installed(page);
  await saveData(page);
  const fontUrls = p => p.evaluate(async () => {
    const cache = await caches.open((await caches.keys())[0]);
    return (await cache.keys()).map(r => new URL(r.url).pathname).filter(p => /\.(ttf|woff2)$/.test(p)).sort();
  });
  expect((await fontUrls(page)).every(p => p.endsWith('.ttf'))).toBe(true);
  site.state.previousFonts = false;
  site.state.revision = 'task03';
  await update(page);
  await page.reload();
  await consistent(page, 'task02');
  expect(await page.evaluate(() => [...document.fonts].every(f => f.status === 'loaded'))).toBe(true);
  expect((await fontUrls(page)).some(p => p.endsWith('.ttf'))).toBe(true);
  let current = await activate(context, page, 'task03');
  await checkData(current);
  const fonts = await fontUrls(current);
  expect(fonts).toHaveLength(2);
  expect(fonts.every(p => p.endsWith('.woff2'))).toBe(true);
  await setOffline(context, true);
  for (const route of ['index', 'catalogue', 'studio', 'about', 'privacy', 'terms']) {
    await current.goto(site.origin + '/VahanaIQ/' + route + '.html');
    await current.evaluate(() => document.fonts.ready);
    expect(await current.evaluate(() => [...document.fonts].every(f => f.status === 'loaded'))).toBe(true);
    await consistent(current, 'task03');
  }
  await current.goto(site.origin + '/VahanaIQ/index.html');
  await checkData(current);
});
