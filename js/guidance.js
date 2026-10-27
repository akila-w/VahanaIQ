import * as guidanceContent from './guidance-content.js?v=2.12.0';
import { readGuidance, writeGuidance } from './guidance-state.js?v=2.12.0';

// An already-open tab may briefly receive an earlier content file while the
// service worker refreshes this unreleased version's assets in the background.
const { articles, tours, quickHelp = {} } = guidanceContent;

// Guidance has no dependency on financial state, authentication or synchronisation.
let storage;
try { storage = window.localStorage; } catch { /* In-memory preferences still work. */ }
let state = readGuidance(storage);
const page = document.querySelector('#loanTermsHead') ? 'calculator' : document.querySelector('#vehicles') ? 'catalogue' : document.querySelector('#models') ? 'studio' : null;
const $ = selector => document.querySelector(selector);
const make = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
};
const button = (text, action, className = 'guide-button') => {
  const el = make('button', className, text);
  el.type = 'button';
  el.addEventListener('click', action);
  return el;
};
const persist = () => writeGuidance(storage, state);
const focusElement = el => {
  if (!el) return;
  if (!el.matches('input, select, button, a, [tabindex]')) {
    el.setAttribute('tabindex', '-1');
    el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true });
  }
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
};

const helpButton = button('Help Centre', event => openHelp(undefined, event.currentTarget), 'guide-launch');
helpButton.id = 'helpCentreButton';
helpButton.setAttribute('aria-haspopup', 'dialog');
($('.site-header nav') || $('.info-header') || $('main')).append(helpButton);

const help = make('dialog', 'guide-help');
help.id = 'helpCentre';
help.setAttribute('aria-labelledby', 'guideHelpTitle');
help.innerHTML = `<div class="guide-help-head"><div><p class="guide-eyebrow">A little clarity, whenever you need it</p><h2 id="guideHelpTitle">Help Centre</h2></div></div>
  <div class="guide-help-body"><p class="guide-intro">Get to know VahanaIQ, one step at a time.</p>
  <section aria-labelledby="guideToursTitle"><h3 id="guideToursTitle">Explore with a guide</h3><div class="guide-tour-links"></div></section>
  <label class="guide-search-label" for="guideSearch">Find an explanation</label><input id="guideSearch" class="guide-search" type="search" placeholder="Try deposit, interest or saving…" autocomplete="off">
  <p id="guideSearchStatus" class="guide-meta" role="status"></p><div class="guide-articles"></div>
  <section class="guide-preferences" aria-labelledby="guidePreferencesTitle"><h3 id="guidePreferencesTitle">Make yourself at home</h3><label><input type="checkbox" id="guideTips"> Show next-step suggestions</label><p class="guide-meta">Guidance preferences stay in this browser. Your financial data is separate.</p></section></div>`;
const helpClose = button('Close', () => help.close(), 'guide-button guide-close');
help.querySelector('.guide-help-head').append(helpClose);
document.body.append(help);
// The static quick-start remains available if modules fail or JavaScript is off.
// With guidance loaded, Help Centre is the single place for these explanations.
if ($('#quickStartGuide')) $('#quickStartGuide').hidden = true;
let helpOpener;
function openHelp(articleId, opener) {
  closeContext(false);
  helpOpener = opener || document.activeElement;
  $('#guideSearch').value = '';
  renderArticles('', articleId);
  renderTourLinks();
  $('#guideTips').checked = state.tips;
  if (!help.open) help.showModal();
  document.body.classList.add('guide-help-open');
  const article = articleId && help.querySelector(`[data-article="${articleId}"]`);
  (article?.querySelector('summary') || helpClose).focus();
  article?.scrollIntoView({ block: 'nearest' });
}
help.addEventListener('close', () => {
  document.body.classList.remove('guide-help-open');
  if (helpOpener?.isConnected) helpOpener.focus({ preventScroll: true });
});
help.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); help.close(); return; }
  if (event.key !== 'Tab') return;
  const items = [...help.querySelectorAll('button:not(:disabled), a[href], input, summary')].filter(el => el.getClientRects().length && (el.tagName === 'SUMMARY' || !el.closest('details:not([open])')));
  // Safari can skip buttons/checkboxes according to the OS keyboard preference.
  // Give this modal a consistent complete keyboard sequence in every engine.
  const current = items.indexOf(document.activeElement);
  event.preventDefault();
  items[(current + (event.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
});
help.addEventListener('click', event => {
  if (event.target !== help) return;
  const rect = help.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) help.close();
});
function renderArticles(query = '', selected) {
  const list = help.querySelector('.guide-articles');
  list.replaceChildren();
  const words = query.toLocaleLowerCase('en-GB').trim().split(/\s+/).filter(Boolean);
  const matches = articles.filter(a => words.every(word => `${a.title} ${a.text} ${a.category}`.toLocaleLowerCase('en-GB').includes(word)));
  for (const article of matches) {
    const detail = make('details', 'guide-article');
    detail.dataset.article = article.id;
    detail.open = article.id === selected || words.length > 0;
    const summary = make('summary');
    summary.append(make('span', 'guide-meta', article.category), make('span', '', article.title));
    detail.append(summary, make('p', '', article.text));
    if (article.link) {
      const link = make('a', '', article.linkText);
      link.href = article.link;
      detail.append(link);
    }
    list.append(detail);
  }
  $('#guideSearchStatus').textContent = matches.length ? `${matches.length} explanations` : 'No explanations found. Try “rate”, “price” or “data”.';
}
$('#guideSearch').addEventListener('input', e => renderArticles(e.target.value));
const updateTips = e => {
  if (state.tips === e.target.checked) return;
  state.tips = e.target.checked;
  persist();
  renderInvitation();
};
$('#guideTips').addEventListener('input', updateTips);
$('#guideTips').addEventListener('change', updateTips);
function renderTourLinks() {
  const links = help.querySelector('.guide-tour-links');
  links.replaceChildren();
  for (const [key, tour] of Object.entries(tours)) {
    const progress = state.tours[key];
    if (key === page) {
      if (progress?.status === 'active') links.append(button(`Resume ${tour.name} tour`, () => startFromHelp(progress.step)));
      links.append(button(`${progress ? 'Restart' : 'Start'} ${tour.name} tour`, () => startFromHelp(0)));
    } else {
      const link = make('a', 'guide-button', `${tour.name} tour`);
      link.href = `${tour.href}?guide=tour`;
      links.append(link);
    }
  }
}
function startFromHelp(step) {
  helpOpener = null; // The tour takes focus; the queued dialog close must not steal it.
  help.close();
  startTour(step);
  tourOpener = helpButton;
}

let invitation;
if (page) {
  invitation = make('section', 'guide-invitation');
  invitation.setAttribute('aria-label', 'Getting started with VahanaIQ');
  const hero = $('main > .hero');
  const anchor = $('main > section') || $('main > header');
  if (hero) hero.append(invitation);
  else if (anchor) anchor.after(invitation);
  else $('main').prepend(invitation);
}
function renderInvitation() {
  if (!invitation) return;
  invitation.replaceChildren();
  invitation.hidden = state.welcomed && !state.tips;
  invitation.classList.toggle('guide-invitation-compact', state.welcomed);
  const copy = make('div');
  copy.append(make('p', 'guide-eyebrow', state.welcomed ? 'At your own pace' : 'Welcome to VahanaIQ'));
  const progress = state.tours[page];
  const heading = !state.welcomed ? 'A clearer route to your next vehicle.' : progress?.status === 'completed' ? 'You’re ready to explore.' : 'A little guidance goes a long way.';
  copy.append(make('h2', '', heading));
  copy.append(make('p', 'guide-intro', !state.welcomed ? 'Explore vehicles, understand the monthly cost and plan your deposit. Start with a short guide, or find your own way.' : nextSuggestion()));
  const actions = make('div', 'guide-actions');
  actions.append(button(progress?.status === 'active' ? 'Resume tour' : 'Show me around', event => startTour(progress?.status === 'active' ? progress.step : 0, event.currentTarget), 'guide-button guide-primary'));
  actions.append(button(state.welcomed ? 'Help Centre' : 'I’ll explore myself', event => {
    if (state.welcomed) openHelp(undefined, event.currentTarget);
    else { state.welcomed = true; state.tips = false; persist(); renderInvitation(); helpButton.focus(); }
  }));
  if (state.welcomed) actions.append(button('Hide suggestions', () => { state.tips = false; persist(); renderInvitation(); helpButton.focus(); }, 'guide-text-button'));
  invitation.append(copy, actions);
}
function nextSuggestion() {
  if (page === 'calculator') {
    if (!$('#rows tr')) return 'Next: add a vehicle from the catalogue or enter a quote to begin your comparison.';
    if (!Number(($('#income')?.value || '').replaceAll(',', ''))) return 'Next: add your income for an optional affordability check, or compare the rental and total cost.';
    return 'Next: compare your shortlisted vehicles, then explore the Savings Planner for the up-front cash.';
  }
  return page === 'catalogue' ? 'Next: open a vehicle to check the price source and variant before adding it to your comparison.' : 'Next: choose an entry to arrange its photos. Your edits stay on this device.';
}
renderInvitation();
// Refresh suggestions only on relevant interactions; never store or copy input values.
document.addEventListener('change', () => { if (state.welcomed && state.tips) renderInvitation(); });
if ($('#rows')) new MutationObserver(() => { if (state.welcomed && state.tips) renderInvitation(); }).observe($('#rows'), { childList: true });

// Native auto popovers provide top-layer rendering, light dismissal and Escape.
// They stay non-modal: the surrounding calculator remains available.
const contextPopover = make('div', 'guide-popover');
contextPopover.id = 'guideContextHelp';
contextPopover.setAttribute('popover', 'auto');
contextPopover.setAttribute('role', 'dialog');
contextPopover.setAttribute('aria-labelledby', 'guideContextTitle');
contextPopover.setAttribute('aria-describedby', 'guideContextText');
document.body.append(contextPopover);
let contextOpener;
function closeContext(restoreFocus = true) {
  if (!contextPopover.matches(':popover-open')) return;
  contextPopover.hidePopover();
  if (restoreFocus) contextOpener?.focus({ preventScroll: true });
}
function positionContext() {
  if (!contextOpener || !contextPopover.matches(':popover-open')) return;
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
  const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
  const anchor = contextOpener.getBoundingClientRect();
  if (!contextOpener.getClientRects().length || anchor.bottom < top || anchor.top > top + height) { closeContext(false); return; }
  contextPopover.style.setProperty('--guide-width', `${Math.min(340, width - 24)}px`);
  contextPopover.style.setProperty('--guide-max-height', `${height - 24}px`);
  const box = contextPopover.getBoundingClientRect();
  const below = anchor.bottom + 8;
  const y = below + box.height <= top + height - 12 ? below : anchor.top - box.height - 8;
  const rowLeft = contextOpener.parentElement.getBoundingClientRect().left;
  contextPopover.style.setProperty('--guide-left', `${Math.max(left + 12, Math.min(rowLeft, left + width - box.width - 12))}px`);
  contextPopover.style.setProperty('--guide-top', `${Math.max(top + 12, Math.min(y, top + height - box.height - 12))}px`);
}
function openContext(id, trigger) {
  if (contextOpener === trigger && contextPopover.matches(':popover-open')) { closeContext(); return; }
  closeContext(false);
  contextOpener = trigger;
  const article = articles.find(a => a.id === id);
  const heading = make('h2', '', article.title);
  heading.id = 'guideContextTitle';
  const copy = make('p', '', quickHelp[id] || article.text.split(/(?<=\.)\s+/).slice(0, 2).join(' '));
  copy.id = 'guideContextText';
  const head = make('div', 'guide-popover-head');
  const close = button('Close', () => closeContext(), 'guide-text-button');
  close.setAttribute('aria-label', 'Close explanation');
  head.append(make('p', 'guide-eyebrow', 'Quick explanation'), close);
  contextPopover.replaceChildren(head, heading, copy, button('More details', () => {
    closeContext(false);
    openHelp(id, trigger);
  }, 'guide-button'));
  trigger.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('popovertarget', contextPopover.id);
  trigger.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  contextPopover.showPopover();
  positionContext();
  close.focus({ preventScroll: true });
}
contextPopover.addEventListener('beforetoggle', event => {
  if (event.newState === 'closed') {
    contextOpener?.setAttribute('aria-expanded', 'false');
    contextOpener?.removeAttribute('popovertarget');
  }
});
contextPopover.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeContext(); }
  if (event.key === 'Tab') {
    // Safari's OS keyboard preference can skip buttons. Keep both actions reachable
    // without trapping focus: Tab at either outer edge still leaves the popover.
    const actions = [...contextPopover.querySelectorAll('button')];
    const next = actions.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1);
    if (next >= 0 && next < actions.length) { event.preventDefault(); actions[next].focus(); }
  }
});
document.addEventListener('focusin', event => {
  if (!contextPopover.contains(event.target) && event.target !== contextOpener) closeContext(false);
});
document.addEventListener('scroll', positionContext, { capture: true, passive: true });
window.addEventListener('resize', positionContext);
window.visualViewport?.addEventListener('resize', positionContext);
window.visualViewport?.addEventListener('scroll', positionContext);

const context = page === 'calculator' ? [
  ['#rateTypeLabel', 'rate'], ['label[for="down"]', 'deposit'], ['#h-sum', 'budget'], ['#h-list', 'compare'], ['#h-savings', 'savings']
] : page === 'catalogue' ? [['#resultCount', 'prices'], ['#reviewHeading', 'compare']] : page === 'studio' ? [['#modelsTitle', 'studio']] : [];
for (const [selector, id] of context) {
  const anchor = $(selector);
  if (!anchor) continue;
  const article = articles.find(a => a.id === id);
  const trigger = button('', event => { event.preventDefault(); openContext(id, event.currentTarget); }, 'guide-context');
  trigger.setAttribute('aria-label', `Help: ${article.title}`);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', contextPopover.id);
  trigger.setAttribute('aria-expanded', 'false');
  const row = make('div', 'guide-context-row');
  row.dataset.guideFor = anchor.id || anchor.getAttribute('for') || id;
  anchor.before(row);
  row.append(anchor, trigger);
}

let tourPanel, currentStep = 0, tourOpener, highlighted;
function clearHighlight() {
  highlighted?.classList.remove('guide-target');
  highlighted = null;
}
function startTour(step, opener) {
  closeContext(false);
  if (!page) return;
  tourOpener = opener || helpButton;
  state.welcomed = true;
  currentStep = Math.min(step, tours[page].steps.length - 1);
  if (!tourPanel) {
    tourPanel = make('section', 'guide-tour');
    tourPanel.id = 'guidedTour';
    tourPanel.setAttribute('role', 'region');
    tourPanel.setAttribute('aria-label', `${tours[page].name} guided tour`);
    document.body.append(tourPanel);
  }
  tourPanel.hidden = false;
  document.body.classList.add('guide-touring');
  renderStep();
  renderInvitation();
}
function renderStep() {
  clearHighlight();
  const steps = tours[page].steps;
  const step = steps[currentStep];
  state.tours[page] = { status: 'active', step: currentStep };
  persist();
  tourPanel.replaceChildren();
  tourPanel.classList.remove('guide-tour-mini');
  const top = make('div', 'guide-tour-top');
  top.append(make('p', 'guide-eyebrow', `${tours[page].name} · ${currentStep + 1} of ${steps.length}`), button('Skip tour', () => finishTour('skipped'), 'guide-text-button'));
  const title = make('h2', '', step.title);
  title.tabIndex = -1;
  const detail = make('div', 'guide-tour-detail');
  detail.append(make('p', 'guide-intro', step.text));
  const tryRow = make('div', 'guide-actions');
  tryRow.append(button(step.action, () => {
    minimiseTour(false);
    const expand = step.expand && $(step.expand);
    if (expand?.getAttribute('aria-expanded') === 'false') expand.click();
    const target = $(step.focus);
    if (step.click) target?.click(); else focusElement(target);
  }), button('Explain this', event => openHelp(step.article, event.currentTarget), 'guide-text-button'));
  detail.append(tryRow);
  const controls = make('div', 'guide-tour-controls');
  const back = button('Back', () => { currentStep--; renderStep(); });
  back.disabled = currentStep === 0;
  controls.append(back, button('Minimise', () => minimiseTour(true), 'guide-text-button'), button(currentStep === steps.length - 1 ? 'Finish tour' : 'Next', () => {
    if (currentStep === steps.length - 1) finishTour('completed'); else { currentStep++; renderStep(); }
  }, 'guide-button guide-primary'));
  tourPanel.append(top, title, detail, controls);
  highlighted = $(step.target);
  highlighted?.classList.add('guide-target');
  highlighted?.scrollIntoView({ block: 'start', behavior: 'instant' });
  title.focus({ preventScroll: true });
}
function minimiseTour(focus) {
  tourPanel.classList.add('guide-tour-mini');
  let resume = tourPanel.querySelector('.guide-resume');
  if (!resume) {
    resume = button('Expand guide', () => renderStep(), 'guide-button guide-resume');
    tourPanel.append(resume);
  }
  if (focus) resume.focus();
}
function finishTour(status) {
  state.tours[page] = { status, step: currentStep };
  persist();
  clearHighlight();
  tourPanel.hidden = true;
  document.body.classList.remove('guide-touring');
  renderInvitation();
  if (tourOpener?.isConnected) tourOpener.focus({ preventScroll: true }); else helpButton.focus({ preventScroll: true });
  announcement.textContent = status === 'completed' ? 'Tour complete. Revisit any guide in Help Centre.' : 'Tour skipped. You can restart it in Help Centre.';
}
const announcement = make('p', 'guide-sr');
announcement.setAttribute('role', 'status');
document.body.append(announcement);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && tourPanel && !tourPanel.hidden && !document.querySelector('dialog[open], .modal-bg.open, .guide-popover:popover-open')) {
    e.preventDefault(); finishTour('skipped');
  }
}, true);
// Existing calculator modals and native catalogue dialogs always take priority.
new MutationObserver(() => {
  if (!tourPanel) return;
  const obscured = !!document.querySelector('dialog[open], .modal-bg.open');
  if (tourPanel.classList.contains('guide-tour-obscured') !== obscured) tourPanel.classList.toggle('guide-tour-obscured', obscured);
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open', 'class'] });
if (page && new URLSearchParams(location.search).get('guide') === 'tour') {
  const url = new URL(location.href);
  url.searchParams.delete('guide');
  history.replaceState(history.state, '', url);
  startTour(0);
}
window.addEventListener('storage', event => {
  if (event.key === 'vahanaiq_guidance_v1' || event.key === null) {
    state = readGuidance(storage);
    renderInvitation();
    if (help.open) { $('#guideTips').checked = state.tips; renderTourLinks(); }
  }
});
