// studio.html: an ordinary not-found page, unless the administrator is signed in (js/admin.js).
// Only then is the Photo Studio taken out of its template and its scripts loaded, so nobody else
// downloads the studio, sees anything that names it, or gets the guided setup over the not-found page.
import { confirmAdmin, renderAdminLinks } from "./admin.js?v=2.12.0";

const $ = id => document.getElementById(id);

function showStudio() {
  const view = $("adminView").content;
  $("main").replaceWith(view.querySelector("main"));
  document.querySelector(".site-header").append(view.querySelector(".header-actions"));
  document.querySelector("footer.foot").prepend(view.querySelector(".foot-cols"));
  document.body.append(view.querySelector("#exportDialog"));
  document.title = "Photo Studio · VahanaIQ";
  $("skipLink").href = "#models";
  $("skipLink").textContent = "Skip to Catalogue Entries";
  renderAdminLinks();
  document.querySelector('nav[aria-label="Main"]').append(view.querySelector("#restartOnboardingBtn"));
  for (const link of document.querySelectorAll("a[data-admin-link]")) link.setAttribute("aria-current", "page");
  const badge = document.createElement("span");
  badge.className = "admin-badge";
  badge.textContent = "Admin";
  document.querySelector('nav[aria-label="Main"] a[data-admin-link]')?.append(badge);
  // Sync only loads on the calculator, which records the signed-in name for this page to show
  const name = localStorage.getItem("vahanaiq_account_name_v1") || "Account";
  $("accountBtn").textContent = name;
  $("accountBtn").setAttribute("aria-label", `Account: ${name}`);
  $("accountBtn").addEventListener("click", () => { location.href = "index.html#account"; });
}

const admin = await confirmAdmin();
if (admin) showStudio();
document.documentElement.classList.remove("account-pending");
if (admin) {
  await import("./catalogue-data.js?v=2.12.0");
  await Promise.all([import("./catalogue-studio.js?v=2.12.0"), import("./onboarding.js?v=2.12.0")]);
}
