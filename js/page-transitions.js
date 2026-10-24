// VahanaIQ Page Transitions
// Lightweight, zero-dependency navigation transition handler that runs reliably
// across file://, localhost, and production without module CORS constraints.
'use strict';
(() => {
  function transitionNavigate(href) {
    if (!href) return;
    const main = document.querySelector('main');
    if (main) main.classList.add('page-exit');
    setTimeout(() => {
      window.location.href = href;
    }, 180);
  }

  // Expose helper globally so buttons (e.g. Add Vehicle, Sign In) can reuse it
  window.transitionNavigate = transitionNavigate;

  function initLinks() {
    const selector = '.site-header nav a, .site-header .brand, .site-links a, .editor-actions a, a.transition-link';
    document.querySelectorAll(selector).forEach(link => {
      link.addEventListener('click', e => {
        if (link.hasAttribute('aria-current') || link.getAttribute('aria-current') === 'page') return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return;

        // Clean target path and current path
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const targetPath = href.split('#')[0].split('?')[0];

        // Do not self-navigate if already on that page
        if (currentPath === targetPath || (currentPath === '' && targetPath === 'index.html') || ((currentPath === 'index.html' || currentPath === '') && (targetPath === 'index.html' || targetPath === './'))) {
          return;
        }

        // Only intercept internal HTML page transitions
        const isInternalPage = targetPath.endsWith('.html') || targetPath === 'index.html' || targetPath === './';
        if (!isInternalPage) return;

        e.preventDefault();
        const main = document.querySelector('main');
        if (main) main.classList.add('page-exit');

        // Update header active nav indicator to the destination tab
        document.querySelectorAll('.site-header nav a').forEach(a => {
          const aHref = a.getAttribute('href');
          if (aHref === targetPath) a.setAttribute('aria-current', 'page');
          else a.removeAttribute('aria-current');
        });

        setTimeout(() => {
          window.location.href = href;
        }, 180);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLinks);
  } else {
    initLinks();
  }

  function syncAuroraDelay() {
    try {
      const now = Date.now() / 1000;
      const s = document.documentElement.style;
      s.setProperty('--aurora-delay-1', `-${(now % 44).toFixed(2)}s`);
      s.setProperty('--aurora-delay-2', `-${(now % 56).toFixed(2)}s`);
    } catch (_) {}
  }

  // Sync on initial execution
  syncAuroraDelay();

  window.addEventListener('pageshow', () => {
    const main = document.querySelector('main');
    if (main) main.classList.remove('page-exit');
    syncAuroraDelay();
  });

  // Theme Switcher: Zero-dependency theme handler that runs reliably across file://, localhost, and production
  const THEME_KEY = "vahanaiq_theme";
  function applyTheme(choice) {
    const root = document.documentElement;
    if (root && typeof root.setAttribute === "function") {
      if (choice === "light" || choice === "dark") root.setAttribute("data-theme", choice);
      else root.removeAttribute("data-theme");
    }
    const themeMetas = typeof document.querySelectorAll === "function" ? [...document.querySelectorAll('meta[name="theme-color"]')] : [];
    themeMetas.forEach(m => { if (!m.dataset.content) m.dataset.content = m.content; });
    const fixed = themeMetas.find(m => {
      const media = m.getAttribute?.("media") || m.media || "";
      return media.includes(choice);
    });
    themeMetas.forEach(m => {
      const def = m.dataset?.content || m.getAttribute?.("content") || m.content || "";
      m.content = fixed ? (fixed.dataset?.content || fixed.getAttribute?.("content") || fixed.content || def) : def;
    });
    const radio = document.querySelector('input[name="theme"][value="' + choice + '"]');
    if (radio) radio.checked = true;
  }

  function initTheme() {
    let savedTheme = null;
    try { savedTheme = localStorage.getItem(THEME_KEY); } catch (_) {}
    applyTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system");

    document.addEventListener("change", e => {
      if (!e.target || e.target.name !== "theme") return;
      const choice = e.target.value;
      try {
        if (choice === "system") localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, choice);
      } catch (_) {}
      applyTheme(choice);
    });

    const themeSwitchEl = document.getElementById("themeSwitch");
    if (themeSwitchEl) {
      themeSwitchEl.addEventListener("click", e => {
        const label = e.target.closest("label");
        if (!label) return;
        const input = label.querySelector('input[name="theme"]');
        if (input && !input.checked) {
          input.checked = true;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }

})();
