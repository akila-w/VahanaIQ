// settings.html: preferences that apply straight away and stay in this browser. js/boot.js applies
// text size, motion and tips before first paint; js/curated-catalogue.js reads the Showroom choices.
import { shown } from "./number-format.js?v=2.12.0";

const SETTINGS_KEY = "vahanaiq_settings_v1";
const THEME_KEY = "vahanaiq_theme";
const INPUTS_KEY = "vahanaiq_inputs_v1";
const COMPARISON_KEY = "vahanaiq_comparison_v3";
// A sign-in is ended from the account menu, not by clearing saved data
const KEEP_ON_DELETE = ["vahanaiq_account_v1", "vahanaiq_account_name_v1", "vahanaiq_synced_v1"];

const $ = id => document.getElementById(id);
const read = key => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } };
const announce = text => { $("settingsSaved").textContent = text; };

function applyLook(settings) {
  const root = document.documentElement;
  if (settings.text === "large" || settings.text === "larger") root.dataset.text = settings.text;
  else delete root.dataset.text;
  if (settings.motion === "full" || settings.motion === "reduced") root.dataset.motion = settings.motion;
  else delete root.dataset.motion;
  if (settings.tips === false) root.dataset.tips = "off";
  else delete root.dataset.tips;
}

function saveSetting(name, value) {
  const settings = read(SETTINGS_KEY);
  settings[name] = value;
  applyLook(settings);
  announce(write(SETTINGS_KEY, settings) ? "Saved in this browser." : "This browser would not save that.");
  return settings;
}

function saveLoan(name, value) {
  const settings = read(SETTINGS_KEY);
  settings.loan = { ...settings.loan, [name]: value };
  const inputs = read(INPUTS_KEY);
  inputs[name] = value;
  announce(write(SETTINGS_KEY, settings) && write(INPUTS_KEY, inputs) ? "Saved in this browser." : "This browser would not save that.");
}

function applyTheme(choice) {
  if (choice === "light" || choice === "dark") {
    document.documentElement.setAttribute("data-theme", choice);
    try { localStorage.setItem(THEME_KEY, choice); } catch (e) {}
  } else {
    document.documentElement.removeAttribute("data-theme");
    try { localStorage.removeItem(THEME_KEY); } catch (e) {}
  }
  announce("Saved in this browser.");
}

function check(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function preview(settings) {
  const label = settings.currency === "rs" ? "Rs." : "LKR";
  const day = settings.date === "numeric" ? "22-10-2026" : "22 Oct 2026";
  $("numberPreview").textContent = `Price ${label} ${shown(12250000, settings)} · ${label} ${shown(97324.17, settings)} a month · Checked ${day}`;
}

function restore() {
  const settings = read(SETTINGS_KEY);
  const inputs = read(INPUTS_KEY);
  let theme = null;
  try { theme = localStorage.getItem(THEME_KEY); } catch (e) {}
  check("theme", theme || "system");
  check("text", settings.text || "standard");
  check("motion", settings.motion || "system");
  check("currency", settings.currency || "lkr");
  check("cents", settings.cents || "yes");
  check("large", settings.large || "full");
  check("date", settings.date || "friendly");
  preview(settings);
  check("rateType", inputs.rateType || settings.loan?.rateType || "reducing");
  check("tenure", inputs.tenure || settings.loan?.tenure || 84);
  check("down", inputs.down || settings.loan?.down || 60);
  check("dti", inputs.dti || settings.loan?.dti || 0.4);
  $("defaultRate").value = inputs.rate ?? settings.loan?.rate ?? 16;
  $("rentals").checked = settings.rentals !== false;
  $("budgetOnly").checked = settings.budgetOnly === true;
  $("hideEstimated").checked = settings.hideEstimated === true;
  $("tips").checked = settings.tips !== false;
}

document.addEventListener("change", event => {
  const { name, value, id, checked } = event.target;
  if (name === "theme") applyTheme(value);
  else if (name === "text" || name === "motion") saveSetting(name, value);
  else if (["currency", "cents", "large", "date"].includes(name)) { preview(saveSetting(name, value)); }
  else if (name === "rateType" || name === "tenure" || name === "down" || name === "dti") saveLoan(name, value);
  else if (["rentals", "budgetOnly", "hideEstimated", "tips"].includes(id)) saveSetting(id, checked);
});

$("defaultRate").addEventListener("change", event => {
  const entered = event.target.value.trim();
  const rate = Number(entered);
  if (entered === "" || !Number.isFinite(rate) || rate < 0 || rate > 100) {
    announce("Enter a rate between 0% and 100%.");
    return;
  }
  // The planner only restores strings, like the other loan fields.
  saveLoan("rate", String(rate));
});

$("exportData").addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    settings: read(SETTINGS_KEY),
    inputs: read(INPUTS_KEY),
    comparison: read(COMPARISON_KEY),
    savings: read("vahanaiq_planner_v1"),
    review: read("vahanaiq_curated_review_v1")
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "vahanaiq-data.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce("Your data was downloaded.");
});

$("askDelete").addEventListener("click", () => {
  $("confirmDelete").hidden = false;
  $("askDelete").hidden = true;
  $("keepData").focus();
});
$("keepData").addEventListener("click", () => {
  $("confirmDelete").hidden = true;
  $("askDelete").hidden = false;
  $("askDelete").focus();
});
$("deleteData").addEventListener("click", () => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("vahanaiq_") && !KEEP_ON_DELETE.includes(key)) localStorage.removeItem(key);
    }
  } catch (e) {}
  applyLook({});
  document.documentElement.removeAttribute("data-theme");
  restore();
  $("confirmDelete").hidden = true;
  $("askDelete").hidden = false;
  $("askDelete").focus();
  announce("Your saved data was deleted from this browser.");
});

restore();
