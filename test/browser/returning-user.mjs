import fs from 'node:fs';

// Read the application's key without Playwright treating its .js module as CommonJS.
const source = fs.readFileSync(new URL('../../js/onboarding-state.js', import.meta.url), 'utf8');
export const ONBOARDING_KEY = source.match(/export const ONBOARDING_KEY = '([^']+)'/)[1];

export const ADMIN_UID = fs.readFileSync(new URL('../../js/config.js', import.meta.url), 'utf8').match(/export const ADMIN_UID = "([^"]*)"/)[1];

// studio.html opens only for the administrator (js/admin.js), so every context carries that sign-in
// record on that page alone. Offline, or with blockFirebase below, the record decides. Routing turns
// off the HTTP cache, so only tests that open the studio online call blockFirebase.
// test/browser/onboarding.spec.mjs covers the visitor's not-found page.
export const seedStudioAdmin = context => context.addInitScript(uid => {
  if (location.pathname.endsWith('/studio.html')) localStorage.setItem('vahanaiq_account_v1', uid);
  else localStorage.removeItem('vahanaiq_account_v1');
}, ADMIN_UID);

export const blockFirebase = context => context.route(/firebase-(app|auth)\.js/, route => route.abort());

export const seedReturning = async context => {
  await context.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({ version: 1, completed: true, step: 4 }));
  }, ONBOARDING_KEY);
  await seedStudioAdmin(context);
};
