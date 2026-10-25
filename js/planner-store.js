import { notifySaved } from './storage.js?v=2.11.6';
export const PLANNER_KEY = 'vahanaiq_planner_v1';
const DRAFT_FIELDS = ['plannerVehicle','plannerGoal','plannerSaved','plannerMode','plannerPercent','plannerMonthly','plannerDate'];
const cleanDraft = value => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(DRAFT_FIELDS.filter(k => typeof value[k] === 'string').map(k => [k, value[k].slice(0,200)])) : {};
export function cleanPlanner(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const draft = cleanDraft(value.draft);
  const scenarios = Array.isArray(value.scenarios) ? value.scenarios.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string' && s.draft && typeof s.draft === 'object' && !Array.isArray(s.draft)).slice(0,30).map(s => ({ id: s.id.slice(0,100), name: s.name.slice(0,100), draft: cleanDraft(s.draft), ...(typeof s.savedOn === 'string' ? {savedOn:s.savedOn.slice(0,10)} : {}) })) : [];
  return Object.keys(draft).length || scenarios.length ? { version: 1, draft, scenarios } : null;
}
export function loadPlanner() { try { return cleanPlanner(JSON.parse(localStorage.getItem(PLANNER_KEY) || 'null')) || { version: 1, draft: {}, scenarios: [] }; } catch { return { version: 1, draft: {}, scenarios: [] }; } }
export function savePlanner(value) { try { localStorage.setItem(PLANNER_KEY, JSON.stringify(cleanPlanner(value))); notifySaved(); return true; } catch { return false; } }
