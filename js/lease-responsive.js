/* Lease header: keep primary action visible and secondary controls accessible on phones. */
(() => {
  const toggle = document.getElementById('mobileToolsToggle');
  const controls = document.getElementById('headerUtilityControls');
  if (!toggle || !controls) return;

  const mobile = window.matchMedia('(max-width: 650px)');
  const close = () => {
    toggle.setAttribute('aria-expanded', 'false');
    controls.classList.remove('mobile-tools-open');
  };
  const sync = () => {
    toggle.hidden = !mobile.matches;
    const tour = document.getElementById('restartOnboardingMobileBtn');
    if (tour) tour.hidden = !mobile.matches;
    if (!mobile.matches) close();
  };
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    controls.classList.toggle('mobile-tools-open', !expanded);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      close();
      toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!toggle.contains(event.target) && !controls.contains(event.target)) close();
  });
  mobile.addEventListener?.('change', sync);
  sync();
})();
