// studio.html: an ordinary not-found page, unless the administrator is signed in (js/admin.js).
// Only then is the Photo Studio taken out of its template and js/catalogue-studio.js loaded, so
// nobody else downloads the studio or sees anything that names it.
import { confirmAdmin, renderAdminLinks } from "./admin.js?v=2.12.0";

const $ = id => document.getElementById(id);

function showStudio() {
  const view = $("adminView").content;
  $("main").replaceWith(view.querySelector("main"));
  document.querySelector(".header-actions").prepend(view.querySelector("#exportBtn"));
  document.querySelector("footer.foot").prepend(view.querySelector(".foot-cols"));
  document.body.append(view.querySelector("#exportDialog"));
  document.title = "Photo Studio · VahanaIQ";
  $("skipLink").href = "#models";
  $("skipLink").textContent = "Skip to Catalogue Entries";
  renderAdminLinks();
  for (const link of document.querySelectorAll("a[data-admin-link]")) link.setAttribute("aria-current", "page");
  const badge = document.createElement("span");
  badge.className = "admin-badge";
  badge.textContent = "Admin";
  document.querySelector('nav[aria-label="Main"] a[data-admin-link]')?.append(badge);
}

const admin = await confirmAdmin();
if (admin) showStudio();
document.documentElement.classList.remove("account-pending");
if (admin) await import("./catalogue-studio.js?v=2.12.0");
