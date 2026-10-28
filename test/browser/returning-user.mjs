import fs from 'node:fs';

// Read the application's key without Playwright treating its .js module as CommonJS.
const source = fs.readFileSync(new URL('../../js/onboarding-state.js', import.meta.url), 'utf8');
export const ONBOARDING_KEY = source.match(/export const ONBOARDING_KEY = '([^']+)'/)[1];

export const seedReturning = context => context.addInitScript(key => {
  localStorage.setItem(key, JSON.stringify({ version: 1, completed: true, step: 4 }));
}, ONBOARDING_KEY);
