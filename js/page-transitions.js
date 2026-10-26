// VahanaIQ Page Transitions
// Lightweight, zero-dependency navigation transition handler that runs reliably
// across file://, localhost, and production without module CORS constraints.
'use strict';
(() => {
  // Navigation starts immediately without artificial JS exit delays; native CSS cross-document
  // view transitions (@view-transition { navigation: auto }) handle visual smoothing.
  const EXIT_MS = 0;
  const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const nativeTransition = () => typeof window.CSSViewTransitionRule !== 'undefined';
  const exitDelay = () => (reducedMotion() || nativeTransition() ? 0 : EXIT_MS);

  const prefetched = new Set();
  function prefetchPage(href) {
    if (!href || typeof document.createElement !== 'function' || !document.head) return;
    if (window.location && window.location.protocol === 'file:') return;
    const targetPath = href.split('#')[0].split('?')[0];
    if (!targetPath || (!targetPath.endsWith('.html') && targetPath !== './')) return;
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPath === targetPath || ((currentPath === 'index.html' || currentPath === '') && (targetPath === 'index.html' || targetPath === './'))) return;
    if (prefetched.has(targetPath)) return;
    prefetched.add(targetPath);
    try {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = targetPath;
      link.as = 'document';
      document.head.appendChild(link);
    } catch (_) {}
  }

  function go(href) {
    const delay = exitDelay();
    if (!delay) { window.location.href = href; return; }
    const main = document.querySelector('main');
    if (main) main.classList.add('page-exit');
    setTimeout(() => {
      window.location.href = href;
    }, delay);
  }

  function transitionNavigate(href) {
    if (!href) return;
    go(href);
  }

  // Expose helper globally so buttons (e.g. Add Vehicle, Sign In) can reuse it
  window.transitionNavigate = transitionNavigate;

  function initLinks() {
    const selector = '.site-header nav a, .site-header .brand, .site-links a, .editor-actions a, a.transition-link';
    document.querySelectorAll(selector).forEach(link => {
      const warm = () => prefetchPage(link.getAttribute('href'));
      link.addEventListener('pointerenter', warm, { passive: true, once: true });
      link.addEventListener('focus', warm, { passive: true, once: true });
      link.addEventListener('touchstart', warm, { passive: true, once: true });

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

        // Update header active nav indicator to the destination tab immediately while letting native navigation proceed
        document.querySelectorAll('.site-header nav a').forEach(a => {
          const aHref = a.getAttribute('href');
          if (aHref === targetPath) a.setAttribute('aria-current', 'page');
          else a.removeAttribute('aria-current');
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLinks);
  } else {
    initLinks();
  }

  // The calculator's in-page section switcher marks the section in view, so the sticky bar
  // on phones and tablets doubles as a "you are here" indicator.
  function initSectionSpy() {
    const nav = document.querySelector('.page-nav');
    if (!nav || typeof IntersectionObserver !== 'function') return;
    const links = [...nav.querySelectorAll('a[href^="#"]')];
    const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    if (!targets.length) return;
    const visible = new Map();
    const mark = () => {
      let best = null;
      for (const t of targets) if ((visible.get(t) || 0) > 0 && !best) best = t;
      links.forEach(a => {
        if (best && a.getAttribute('href') === '#' + best.id) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    };
    const io = new IntersectionObserver(entries => {
      for (const e of entries) visible.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
      mark();
    }, { rootMargin: '-80px 0px -45% 0px', threshold: [0, 0.01, 0.25] });
    targets.forEach(t => io.observe(t));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSectionSpy);
  } else {
    initSectionSpy();
  }

  // iOS Safari scrolls a focused field above the on-screen keyboard, but when its toolbar then
  // changes the visible area it can put the page back where it was, leaving the field behind
  // the keyboard (reproduced on iOS 27 in the Simulator; the live site does it too). When the
  // visible area changes while a text field or menu has focus and that field is out of sight,
  // it is brought back to the middle of what is visible. Safari can undo its scroll just after
  // the last resize, so scrolling is checked the same way for a moment afterwards.
  const FIELD = 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]), select, textarea';
  function initFocusedFieldGuard() {
    const vv = window.visualViewport;
    if (!vv || typeof vv.addEventListener !== 'function') return;
    let timer = 0;
    let settleUntil = 0;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(reveal, 80); };
    const reveal = () => {
      const el = document.activeElement;
      if (!el || typeof el.matches !== 'function' || !el.matches(FIELD)) return;
      // iOS Safari measures element boxes from the visible area (its scrollY is the visual
      // viewport's pageTop); other browsers measure from the layout viewport.
      const top = Math.abs(window.scrollY - vv.pageTop) < 1 ? 0 : vv.offsetTop;
      const box = el.getBoundingClientRect();
      if (box.top >= top && box.bottom <= top + vv.height) return;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    };
    vv.addEventListener('resize', () => { settleUntil = Date.now() + 1000; schedule(); });
    window.addEventListener('scroll', () => { if (Date.now() < settleUntil) schedule(); }, { passive: true });
  }
  initFocusedFieldGuard();

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
