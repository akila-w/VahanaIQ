// VahanaIQ Experience Polish
// Clean enhancements for interactive drawers, modals, and responsive layout.

export function initExperience() {
  // Ensure all drawer toggles have accessible aria states
  const drawerToggles = document.querySelectorAll(".drawer-toggle");
  drawerToggles.forEach(btn => {
    // app.js owns these drawers, including their labels and planner lifecycle.
    if (["toggleCostsDrawer", "toggleLtvDrawer", "toggleSavingsDrawer"].includes(btn.id)) return;
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("aria-controls");
      const target = document.getElementById(targetId);
      if (!target) return;
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      target.classList.toggle("drawer-collapsed", expanded);
    });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initExperience);
  } else {
    initExperience();
  }
}
