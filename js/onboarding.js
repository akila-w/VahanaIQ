import { ONBOARDING_KEY, MIN_SHORTLIST, readOnboarding, validTerms, mergeShortlist } from './onboarding-state.js?v=2.12.0';
import { searchCatalogue } from './catalogue-search.js?v=2.12.0';
import { rental, flatToEffective, minDownFor } from './calculator.js?v=2.12.0';
import { validPrice, vehicleBatchError } from './vehicle-validation.js?v=2.12.0';
import { safeImageUrl } from './safe-url.js?v=2.12.0';
import { DEFAULT_RATE, DEFAULT_TENURE, DEFAULT_DOWN, CONDITIONS, READY_SHORTLISTS } from './constants.js?v=2.12.0';

// Each trigger has one stable listener for the lifetime of this page.
function handleRestartClick(event) {
  event.preventDefault();
  restartOnboarding();
}
document.querySelectorAll('#startOnboardingBtn, #restartOnboardingBtn, .onboarding-restart-btn, [data-trigger="onboarding"]').forEach(btn => {
  btn.addEventListener('click', handleRestartClick);
});

const calculatorPage = !!document.querySelector('#loanTermsHead');
if (calculatorPage || document.querySelector('#vehicles') || document.querySelector('#models') || document.querySelector('#restartOnboardingBtn')) {
  init();
}

export function restartOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem('vahanaiq_onboarding_draft_v1');
  } catch {}
  document.querySelectorAll('dialog#onboarding').forEach(d => { d.close(); d.remove(); });
  document.body.classList.remove('onboarding-active');
  init(true);
}

// Opens setup without clearing a saved draft, e.g. from the landing introduction.
export function openOnboarding() {
  if (document.querySelector('dialog#onboarding')) return;
  init(true);
}

function init(forcedOpen = false) {
  let storage;
  try { storage = localStorage; } catch {}
  const read = (key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const progress = readOnboarding(storage);
  const urlParams = new URLSearchParams(window.location.search);
  const forced = forcedOpen || urlParams.has('onboarding') || window.location.hash === '#onboarding';

  // If completed and not forced, do not auto-open modal
  const comparison = read('vahanaiq_comparison_v3', null);
  const hasComparison = comparison?.version === 3 && Array.isArray(comparison.cars) &&
    comparison.cars.length > 0 && !vehicleBatchError(comparison.cars);
  if ((progress.completed || hasComparison) && !forced) {
    return;
  }
  // First visits to the Lease page open on the landing introduction; its Get Started opens this.
  if (!forced && document.documentElement.classList.contains('landing-pending')) return;

  const draft = read('vahanaiq_onboarding_draft_v1', {});
  let selected = Array.isArray(draft.cars) ? draft.cars.filter(c => !vehicleBatchError([c])).slice(0, 12) : [];

  // Clean Sri Lankan market defaults: 16.0% reducing balance, 84 months, 60% down (CBSL compliant)
  let terms = {
    rate: String(DEFAULT_RATE),
    rateType: 'reducing',
    tenure: String(DEFAULT_TENURE),
    down: String(DEFAULT_DOWN),
    income: '',
    debt: ''
  };
  if (validTerms(draft.terms)) {
    terms = { ...terms, ...draft.terms };
  }

  // Steps: 0 Cars, 1 Income, 2 Loan Length, 3 Down Payment, 4 Your Result. Cars come first so
  // every later step shows rentals for the visitor's own shortlist.
  let step = selected.length < MIN_SHORTLIST ? 0 : progress.step;
  let models = window.__VAHANAIQ_CATALOGUE__?.models || [];
  let query = '', storageOK = true;

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  const button = (text, action, cls = 'btn-outline') => {
    const node = el('button', cls, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };

  const formatLKR = n => {
    const num = Number(n);
    if (!Number.isFinite(num) || num <= 0) return 'LKR 0';
    return 'LKR ' + Math.round(num).toLocaleString('en-LK');
  };

  const parseNumber = str => {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const clean = String(str).replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return Number.isFinite(num) ? num : 0;
  };

  // The same down payment and rental the calculator uses for each shortlisted car.
  const effectiveRate = () => terms.rateType === 'flat' ? flatToEffective(Number(terms.rate), Number(terms.tenure)) : Number(terms.rate);
  const carDown = car => Math.max(Number(terms.down), minDownFor(car.cond, car.financeClass, car.firstRegisteredOn));
  const carRental = car => rental(car.price * (1 - carDown(car) / 100), effectiveRate(), Number(terms.tenure));

  // Build the dialog
  const dialog = el('dialog', 'onboarding');
  dialog.id = 'onboarding';
  dialog.setAttribute('aria-labelledby', 'onboardingTitle');

  // Allow Escape key and cancel event to close dialog
  dialog.addEventListener('cancel', () => exitOnboarding());

  const top = el('header', 'onboarding-head');
  const brandGroup = el('div', 'onboarding-brand-group');
  for (const theme of ['light', 'dark']) {
    const mark = el('img', `onboarding-mark logo-${theme}`);
    mark.src = `assets/icons/logo-v-mark-transparent-${theme}.svg`;
    mark.alt = '';
    mark.width = 28;
    mark.height = 28;
    brandGroup.append(mark);
  }
  const brandTitle = el('strong', 'onboarding-brand', 'VahanaIQ');
  const badge = el('span', 'onboarding-badge', 'Guided Setup');
  brandGroup.append(brandTitle, badge);

  // Stepper Progress Indicator - Interactive & Clickable
  const stepper = el('nav', 'onboarding-stepper');
  stepper.setAttribute('aria-label', 'Onboarding progress navigation');
  const stepLabels = ['Cars', 'Income', 'Loan Length', 'Down Payment', 'Your Result'];
  const stepItems = stepLabels.map((lbl, idx) => {
    const item = el('button', `onboarding-step-pill ${idx === step ? 'active' : idx < step ? 'done' : ''}`);
    item.type = 'button';
    item.setAttribute('aria-label', `Navigate to Step ${idx + 1}: ${lbl}`);
    item.title = `Go to Step ${idx + 1}: ${lbl}`;
    const num = el('span', 'step-num', idx < step ? '✓' : String(idx + 1));
    const text = el('span', 'step-label', lbl);
    item.append(num, text);
    item.addEventListener('click', () => handleStepClick(idx));
    return item;
  });
  const progressBar = el('div', 'onboarding-progress-bar');
  const progressLine = el('div', 'onboarding-progress-fill');
  progressBar.append(progressLine);
  stepper.append(progressBar, ...stepItems);

  // Refined Minimalist Close Button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'onboarding-close-btn';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Exit onboarding');
  closeBtn.title = 'Exit onboarding';
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="onboarding-close-icon"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
  closeBtn.addEventListener('click', () => exitOnboarding());

  top.append(brandGroup, stepper, closeBtn);

  const body = el('div', 'onboarding-body');
  const foot = el('footer', 'onboarding-foot');
  const status = el('p', 'onboarding-status');
  status.setAttribute('role', 'status');

  dialog.append(top, body, status, foot);
  document.body.append(dialog);
  document.body.classList.add('onboarding-active');
  dialog.showModal();
  render();

  function exitOnboarding() {
    write(ONBOARDING_KEY, { version: 1, completed: true, step });
    dialog.close();
    dialog.remove();
    document.body.classList.remove('onboarding-active');
  }

  function persist() {
    storageOK = write('vahanaiq_onboarding_draft_v1', { cars: selected, terms }) &&
                write(ONBOARDING_KEY, { version: 1, completed: false, step });
    if (!storageOK) status.textContent = 'Browser storage is unavailable. Keep this tab open to retain your progress.';
  }

  function validateStep(s) {
    if (s === 0) return selected.length >= MIN_SHORTLIST && !vehicleBatchError(selected);
    if (s === 2 || s === 3) return validTerms(terms);
    return true; // Income is optional
  }

  function handleStepClick(targetStep) {
    if (targetStep === step) return;

    // Reset error highlights
    stepItems.forEach(item => item.classList.remove('is-error', 'shake'));

    if (targetStep < step) {
      // Going backward is always permitted
      step = targetStep;
      persist();
      render();
      return;
    }

    // Moving forward: validate all steps up to targetStep
    let firstIncomplete = -1;
    for (let s = 0; s < targetStep; s++) {
      if (!validateStep(s)) {
        if (firstIncomplete === -1) firstIncomplete = s;
        // Highlight incomplete step in RED
        stepItems[s]?.classList.add('is-error', 'shake');
      }
    }

    if (firstIncomplete !== -1) {
      if (firstIncomplete === 0) {
        status.textContent = `Choose at least ${MIN_SHORTLIST} cars in Step 1 before moving on.`;
      } else {
        status.textContent = `Enter valid loan terms in Step ${firstIncomplete + 1} before moving on.`;
      }

      if (step !== firstIncomplete) {
        step = firstIncomplete;
        persist();
        render();
        setTimeout(() => {
          stepItems[firstIncomplete]?.classList.add('is-error', 'shake');
        }, 60);
      }
      return;
    }

    // All steps up to targetStep are valid
    step = targetStep;
    persist();
    render();
  }

  function updateStepper() {
    stepItems.forEach((item, idx) => {
      item.className = `onboarding-step-pill ${idx === step ? 'active' : idx < step ? 'done' : ''}`;
      if (idx === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
      const numSpan = item.querySelector('.step-num');
      if (numSpan) numSpan.textContent = idx < step ? '✓' : String(idx + 1);
    });
    const pct = (step / (stepLabels.length - 1)) * 100;
    progressLine.setAttribute('style', `width:${pct}%`);
  }

  function title(headText, subText, eyebrow) {
    const wrap = el('div', 'onboarding-title-wrap');
    if (eyebrow) wrap.append(el('p', 'onboarding-eyebrow', eyebrow));
    const h = el('h1', 'onboarding-heading', headText);
    h.id = 'onboardingTitle';
    wrap.append(h);
    if (subText) wrap.append(el('p', 'onboarding-intro', subText));
    body.append(wrap);
    return h;
  }

  function next() {
    step++;
    persist();
    render();
  }

  function render() {
    body.replaceChildren();
    foot.replaceChildren();
    status.textContent = '';
    updateStepper();
    body.dataset.step = String(step);

    if (step > 0) {
      foot.append(button('← Back', () => { step--; persist(); render(); }, 'btn-outline'));
    }

    if (step === 0) {
      renderCars();
    } else if (step === 1) {
      renderIncome();
    } else if (step === 2) {
      renderTenure();
    } else if (step === 3) {
      renderDown();
    } else {
      renderResult();
    }

    // Exit to Lease button in footer
    const exitFootBtn = button('Exit to Lease', () => exitOnboarding(), 'btn-outline onboarding-exit-foot-btn');
    foot.prepend(exitFootBtn);

    body.scrollTop = 0;

    // Do NOT focus the close button upon dialog opening
    requestAnimationFrame(() => {
      const primaryBtn = foot.querySelector('.btn-primary') || body.querySelector('input');
      // A user may have focused a field before this deferred callback runs.
      // Preserve that focus so pending keyboard input still reaches the field.
      if (primaryBtn && !body.contains(document.activeElement)) primaryBtn.focus({ preventScroll: true });
    });
  }

  // A choice of one, drawn as large buttons that say which is chosen (tick and pressed state).
  function optionGroup(label, options, current, onPick, cls = '') {
    const group = el('div', `onboarding-options ${cls}`.trim());
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    const paint = value => group.querySelectorAll('.onboarding-option').forEach(opt => {
      const on = opt.dataset.val === value;
      opt.classList.toggle('active', on);
      opt.setAttribute('aria-pressed', String(on));
    });
    for (const opt of options) {
      const node = el('button', 'onboarding-option');
      node.type = 'button';
      node.dataset.val = opt.value;
      node.append(el('span', 'option-title', opt.title));
      if (opt.hint) node.append(el('span', 'option-hint', opt.hint));
      node.addEventListener('click', () => { paint(opt.value); onPick(opt.value); });
      group.append(node);
    }
    paint(current);
    return group;
  }

  // Rentals for each shortlisted car on the terms chosen so far.
  function ticker(showDeposit) {
    const aside = el('aside', 'onboarding-terms-ticker');
    aside.setAttribute('aria-live', 'polite');
    const list = el('div', 'ticker-list');
    aside.append(el('strong', 'ticker-title', 'Your shortlist on these terms'), list);
    const update = () => {
      list.replaceChildren();
      for (const car of selected) {
        const row = el('div', 'ticker-row');
        const name = el('span', 'ticker-car-name', car.name);
        if (showDeposit) name.append(el('small', 'ticker-car-deposit', `${formatLKR(car.price * carDown(car) / 100)} down (${carDown(car)}%)`));
        row.append(name, el('strong', 'ticker-car-rental', `${formatLKR(carRental(car))} / mo`));
        list.append(row);
      }
    };
    update();
    return { aside, update };
  }

  function carFromOffer(model, offer) {
    return {
      id: model.id,
      catalogueId: model.id,
      name: [model.name, offer.trim, offer.year].filter(Boolean).join(' ').slice(0, 200),
      price: offer.amount,
      cond: offer.condition || 'New',
      financeClass: model.financeClass,
      firstRegisteredOn: offer.firstRegisteredOn,
      w: offer.route === 'Distributor' ? 'Official' : 'Grey',
      pt: offer.fuel || '',
      km: '',
      img: model.images?.[0]?.smallSrc || '',
      custom: true,
      priceBasis: offer.kind || 'Published price',
      priceSourceUrl: offer.sourceUrl
    };
  }

  // STEP 1: CARS
  function renderCars() {
    title(
      'Which cars are you considering?',
      `Pick at least ${MIN_SHORTLIST} to compare. Start from a quick pick or search the Showroom, then add or remove cars freely.`,
      'Step 1 of 5 · Cars'
    );

    // Quick picks add real catalogue cars; the visitor still reviews and edits the shortlist.
    const quickPicks = READY_SHORTLISTS.map(([label, ids]) => [label, ids.map(id => models.find(m => m.id === id)).filter(Boolean)
      .map(model => [model, (model.offers || []).find(o => validPrice(o.amount))]).filter(([, offer]) => offer)])
      .filter(([, cars]) => cars.length >= MIN_SHORTLIST);
    if (quickPicks.length) {
      const picks = el('div', 'onboarding-quick-picks');
      picks.setAttribute('role', 'group');
      picks.setAttribute('aria-label', 'Quick picks');
      picks.append(el('span', 'quick-picks-label', 'Quick picks'));
      for (const [label, cars] of quickPicks) {
        const pick = button('', () => {
          const added = [];
          for (const [model, offer] of cars) {
            if (selected.length >= 12 || selected.some(c => c.catalogueId === model.id)) continue;
            selected.push(carFromOffer(model, offer));
            added.push(model.name);
          }
          persist();
          paint();
          status.textContent = added.length ? `Added ${added.join(', ')}.` : 'These cars are already in your shortlist.';
        }, 'onboarding-quick-pick');
        pick.append(el('span', 'quick-pick-title', `+ ${label}`), el('span', 'quick-pick-cars', cars.map(([m]) => m.name).join(', ')));
        picks.append(pick);
      }
      body.append(picks);
    }

    const searchWrap = el('div', 'onboarding-search-wrap');
    const search = el('input', 'onboarding-search');
    search.type = 'search';
    search.placeholder = 'Search by make or model, e.g. Toyota, BYD, Vezel';
    search.setAttribute('aria-label', 'Search vehicles');
    search.value = query;
    searchWrap.append(search);
    body.append(searchWrap);

    const tray = el('div', 'onboarding-tray');
    tray.setAttribute('aria-label', 'Selected vehicles shortlist');
    body.append(tray);

    const results = el('div', 'onboarding-cars');
    body.append(results);

    const more = button('Show more vehicles', () => { limit += 12; paint(); }, 'btn-outline onboarding-more-btn');
    body.append(more);

    // Manual quote entry
    const manual = el('details', 'onboarding-manual');
    const summary = el('summary', '', 'Can’t find your vehicle? Enter a custom quote');
    manual.append(summary);

    const form = el('form', 'onboarding-manual-form');
    const nameInput = el('input');
    nameInput.required = true;
    nameInput.maxLength = 160;
    nameInput.placeholder = 'Vehicle Make & Model (e.g. 2024 Honda Civic RS)';
    nameInput.setAttribute('aria-label', 'Vehicle name');

    const priceInput = el('input');
    priceInput.type = 'number';
    priceInput.min = '100000';
    priceInput.max = '999999999999';
    priceInput.required = true;
    priceInput.placeholder = 'Quoted price in LKR (e.g. 18500000)';
    priceInput.setAttribute('aria-label', 'Quoted price in LKR');

    const conditionSelect = el('select');
    conditionSelect.setAttribute('aria-label', 'Vehicle condition');
    for (const [key, text] of Object.entries(CONDITIONS)) {
      const opt = el('option', '', text);
      opt.value = key;
      conditionSelect.append(opt);
    }

    const addManualBtn = button('+ Add Quoted Vehicle', () => {
      if (!form.reportValidity() || !nameInput.value.trim() || selected.length >= 12) return;
      const id = 'quote-' + nameInput.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100);
      if (selected.some(c => c.id === id)) {
        status.textContent = 'This vehicle is already in your shortlist.';
        return;
      }
      selected.push({
        id,
        name: nameInput.value.trim(),
        price: Number(priceInput.value),
        cond: conditionSelect.value,
        w: 'Unknown',
        pt: '',
        km: '',
        custom: true,
        priceBasis: 'Your quote'
      });
      persist();
      paint();
      nameInput.value = '';
      priceInput.value = '';
      manual.open = false;
    }, 'btn');

    form.append(nameInput, priceInput, conditionSelect, addManualBtn);
    manual.append(form);
    body.append(manual);

    const continueButton = button('Continue to Income →', next, 'btn btn-primary');
    foot.append(continueButton);

    let limit = 12;
    search.addEventListener('input', () => {
      query = search.value;
      limit = 12;
      paint();
    });

    function paint() {
      tray.replaceChildren();
      results.replaceChildren();

      // Shortlist tray counter
      const trayHeader = el('div', 'tray-header');
      const trayTitle = el('strong', '', `Shortlist (${selected.length} of 12 selected)`);
      const trayHint = el('span', 'tray-hint', selected.length < MIN_SHORTLIST ? `Need at least ${MIN_SHORTLIST - selected.length} more` : 'Ready to continue');
      trayHeader.append(trayTitle, trayHint);
      tray.append(trayHeader);

      const trayPills = el('div', 'tray-pills');
      for (const car of selected) {
        const pill = el('div', 'tray-car-pill');
        const pillName = el('span', 'pill-name', car.name);
        const pillPrice = el('span', 'pill-price', formatLKR(car.price));
        const remBtn = button('✕', () => {
          selected = selected.filter(c => c.id !== car.id);
          persist();
          paint();
        }, 'pill-remove-btn');
        remBtn.setAttribute('aria-label', `Remove ${car.name}`);
        pill.append(pillName, pillPrice, remBtn);
        trayPills.append(pill);
      }
      if (!selected.length) {
        trayPills.append(el('p', 'tray-empty-text', 'No cars yet. Use a quick pick, or search and add below.'));
      }
      tray.append(trayPills);

      continueButton.disabled = selected.length < MIN_SHORTLIST;

      const found = searchCatalogue(models, query);
      more.hidden = found.length <= limit;
      status.textContent = storageOK
        ? `${found.length} vehicles found. ${selected.length} in your shortlist.`
        : 'Browser storage is unavailable. Keep this tab open.';

      for (const model of found.slice(0, limit)) {
        const card = el('article', 'onboarding-car');

        // Image
        const imgWrap = el('div', 'onboarding-car-img-wrap');
        const img = el('img', 'onboarding-car-img');
        img.src = safeImageUrl(model.images?.[0]?.smallSrc || model.images?.[0]?.src || '');
        img.alt = model.name;
        img.loading = 'lazy';
        imgWrap.append(img);
        card.append(imgWrap);

        // Header info
        const info = el('div', 'onboarding-car-info');
        const nameHeading = el('h3', 'onboarding-car-title', model.name);
        info.append(nameHeading);

        // Dynamic price display
        const priceDisplay = el('div', 'onboarding-car-price');
        const priceVal = el('strong', 'price-val', '—');
        const priceBasis = el('span', 'price-basis', '');
        priceDisplay.append(priceVal, priceBasis);
        info.append(priceDisplay);

        // Trims dropdown — ALWAYS ENABLED
        const offers = Array.isArray(model.offers) && model.offers.length ? model.offers : [];
        const options = el('select', 'onboarding-trim-select');
        options.setAttribute('aria-label', `Trim and variant for ${model.name}`);

        for (const [i, offer] of offers.entries()) {
          const opt = el('option', '', `${offer.trim || offer.name || 'Standard'} · ${offer.year || 'New'} · ${validPrice(offer.amount) ? formatLKR(offer.amount) : 'Quote needed'}`);
          opt.value = i;
          options.append(opt);
        }

        // Action button container
        const btnRow = el('div', 'onboarding-car-actions');
        const selectBtn = button('+ Add to Shortlist', null, 'btn onboarding-car-btn');
        const removeBtn = button('Remove', null, 'btn-outline onboarding-car-remove-btn');

        const updateTrimState = () => {
          const offer = offers[Number(options.value)] || offers[0];
          if (offer && validPrice(offer.amount)) {
            priceVal.textContent = formatLKR(offer.amount);
            priceBasis.textContent = offer.kind || (offer.route === 'Distributor' ? 'Official Agent' : 'Market Offer');
          } else {
            priceVal.textContent = 'Price on Request';
            priceBasis.textContent = 'Quote required';
          }

          const existingCarIndex = selected.findIndex(c => c.catalogueId === model.id);
          const isSelected = existingCarIndex !== -1;
          const currentCar = isSelected ? selected[existingCarIndex] : null;

          if (!isSelected) {
            card.classList.remove('is-selected');
            selectBtn.textContent = '+ Add to Shortlist';
            selectBtn.className = 'btn onboarding-car-btn';
            selectBtn.disabled = selected.length >= 12;
            removeBtn.hidden = true;
          } else {
            card.classList.add('is-selected');
            removeBtn.hidden = false;
            const offerTitle = [model.name, offer.trim, offer.year].filter(Boolean).join(' ').slice(0, 200);
            if (currentCar.name === offerTitle && currentCar.price === offer.amount) {
              selectBtn.textContent = 'Shortlisted ✓';
              selectBtn.className = 'btn-outline onboarding-car-btn is-added';
              selectBtn.disabled = true;
            } else {
              selectBtn.textContent = 'Switch to this Trim';
              selectBtn.className = 'btn btn-primary onboarding-car-btn is-switch';
              selectBtn.disabled = false;
            }
          }
        };

        options.addEventListener('change', updateTrimState);
        updateTrimState();

        selectBtn.addEventListener('click', () => {
          const offer = offers[Number(options.value)];
          if (!offer || !validPrice(offer.amount)) {
            status.textContent = 'This vehicle needs a price. Use “Enter a custom quote” below to compare it.';
            return;
          }
          const existingIndex = selected.findIndex(c => c.catalogueId === model.id);
          const carObj = carFromOffer(model, offer);

          if (existingIndex !== -1) {
            selected[existingIndex] = carObj;
          } else {
            selected.push(carObj);
          }
          persist();
          paint();
        });

        removeBtn.addEventListener('click', () => {
          selected = selected.filter(c => c.catalogueId !== model.id && c.id !== model.id);
          persist();
          paint();
        });

        btnRow.append(selectBtn, removeBtn);
        info.append(options, btnRow);
        card.append(info);
        results.append(card);
      }

      if (!found.length) {
        results.append(
          el('div', 'onboarding-no-results', [
            el('p', '', models.length ? 'No matching vehicles found. Try another make or model name, or enter a quote below.' : 'Loading catalogue database…')
          ])
        );
      }
    }

    paint();
  }

  // STEP 2: INCOME (optional)
  function renderIncome() {
    title(
      'What do you take home each month?',
      'Used only to check what you can afford. It stays in this browser and is never sent anywhere.',
      'Step 2 of 5 · Income'
    );

    const layout = el('div', 'onboarding-affordability-layout');
    const form = el('form', 'onboarding-fields onboarding-affordability-form');

    // Monthly take-home pay
    const incGroup = el('div', 'terms-field-group');
    const incLabel = el('label', 'field-label', 'Net Monthly Take-Home Pay (LKR)');
    const incWrap = el('div', 'currency-input-wrap');
    const incPrefix = el('span', 'currency-prefix', 'LKR');
    const incInput = el('input', 'currency-input');
    incInput.type = 'text';
    incInput.inputMode = 'numeric';
    incInput.placeholder = 'After tax, e.g. 250,000';
    incInput.value = terms.income ? Math.round(parseNumber(terms.income)).toLocaleString('en-LK') : '';
    incWrap.append(incPrefix, incInput);
    incLabel.append(incWrap);

    // Preset chips for income
    const incChips = el('div', 'terms-chip-row');
    [['150000', 'LKR 150k'], ['250000', 'LKR 250k'], ['400000', 'LKR 400k'], ['600000', 'LKR 600k']].forEach(([val, label]) => {
      const chip = button(label, () => {
        terms.income = val;
        incInput.value = Math.round(Number(val)).toLocaleString('en-LK');
        highlightChip(incChips, val);
        updateDtiMeter();
        persist();
      }, `terms-preset-chip ${parseNumber(terms.income) === Number(val) ? 'active' : ''}`);
      chip.dataset.val = val;
      incChips.append(chip);
    });
    incGroup.append(incLabel, incChips);

    // Existing monthly debts
    const debtGroup = el('div', 'terms-field-group');
    const debtLabel = el('label', 'field-label', 'Existing Monthly Loan & Card Repayments (LKR)');
    const debtWrap = el('div', 'currency-input-wrap');
    const debtPrefix = el('span', 'currency-prefix', 'LKR');
    const debtInput = el('input', 'currency-input');
    debtInput.type = 'text';
    debtInput.inputMode = 'numeric';
    debtInput.placeholder = 'Monthly total, 0 if none';
    debtInput.value = terms.debt ? Math.round(parseNumber(terms.debt)).toLocaleString('en-LK') : '';
    debtWrap.append(debtPrefix, debtInput);
    debtLabel.append(debtWrap);

    // Preset chips for debt
    const debtChips = el('div', 'terms-chip-row');
    [['0', 'None'], ['25000', 'LKR 25k'], ['50000', 'LKR 50k'], ['100000', 'LKR 100k']].forEach(([val, label]) => {
      const chip = button(label, () => {
        terms.debt = val;
        debtInput.value = val === '0' ? '0' : Math.round(Number(val)).toLocaleString('en-LK');
        highlightChip(debtChips, val);
        updateDtiMeter();
        persist();
      }, `terms-preset-chip ${parseNumber(terms.debt) === Number(val) ? 'active' : ''}`);
      chip.dataset.val = val;
      debtChips.append(chip);
    });
    debtGroup.append(debtLabel, debtChips);

    form.append(incGroup, debtGroup);
    layout.append(form);

    // Interactive DTI feedback card
    const dtiCard = el('div', 'onboarding-dti-card');
    const dtiHeader = el('strong', 'dti-card-title', 'How your shortlist fits');
    const dtiMeter = el('div', 'onboarding-dti-meter');
    const dtiBar = el('div', 'onboarding-dti-bar');
    const dtiFill = el('div', 'onboarding-dti-fill');
    dtiBar.append(dtiFill);
    const dtiText = el('p', 'dti-feedback-text', '');
    dtiMeter.append(dtiBar);
    dtiCard.append(dtiHeader, dtiMeter, dtiText);
    layout.append(dtiCard);

    body.append(layout);

    incInput.addEventListener('input', () => {
      const raw = parseNumber(incInput.value);
      terms.income = raw > 0 ? String(raw) : '';
      if (raw > 0) incInput.value = Math.round(raw).toLocaleString('en-LK');
      updateDtiMeter();
      persist();
    });

    debtInput.addEventListener('input', () => {
      const raw = parseNumber(debtInput.value);
      terms.debt = raw > 0 ? String(raw) : '';
      if (raw > 0) debtInput.value = Math.round(raw).toLocaleString('en-LK');
      updateDtiMeter();
      persist();
    });

    function highlightChip(container, activeVal) {
      container.querySelectorAll('.terms-preset-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.val === activeVal);
      });
    }

    function updateDtiMeter() {
      const income = parseNumber(terms.income);
      const debt = parseNumber(terms.debt);

      if (!income) {
        dtiFill.setAttribute('style', `width:${0}%`);
        dtiFill.className = 'onboarding-dti-fill';
        dtiText.innerHTML = `<strong>Optional:</strong> add your income to see which cars are comfortable, a stretch or out of reach. You can skip this and add it later.`;
        return;
      }

      const avgRental = selected.length ? selected.reduce((acc, car) => acc + carRental(car), 0) / selected.length : 0;
      const totalCommitments = debt + avgRental;
      const dtiPct = Math.round((totalCommitments / income) * 100);
      const cappedBar = Math.min(100, Math.max(5, dtiPct));
      dtiFill.setAttribute('style', `width:${cappedBar}%`);

      if (dtiPct <= 40) {
        dtiFill.className = 'onboarding-dti-fill safe';
        const buffer = Math.round((income * 0.4) - totalCommitments);
        dtiText.innerHTML = `<span class="tag ok">Comfortable (${dtiPct}% of income)</span> An average car on your shortlist fits within the recommended 40% limit, with <strong>${formatLKR(buffer)} a month</strong> to spare.`;
      } else if (dtiPct <= 50) {
        dtiFill.className = 'onboarding-dti-fill mid';
        dtiText.innerHTML = `<span class="tag mid">Stretching (${dtiPct}% of income)</span> Within the 50% maximum, but it leaves less room for insurance, fuel and upkeep.`;
      } else {
        dtiFill.className = 'onboarding-dti-fill bad';
        dtiText.innerHTML = `<span class="tag bad">Out of reach (${dtiPct}% of income)</span> Above the 50% maximum. A longer term or a larger down payment lowers the rental; you can try both next.`;
      }
    }

    updateDtiMeter();

    foot.append(
      button('Skip Income', () => {
        terms.income = '';
        terms.debt = '';
        next();
      }, 'btn-outline'),
      button('Continue to Loan Length →', next, 'btn btn-primary')
    );
  }

  // STEP 3: LOAN LENGTH AND RATE
  function renderTenure() {
    title(
      'How long would you like to pay?',
      'Longer terms lower the monthly rental but cost more interest overall. You can change this any time.',
      'Step 3 of 5 · Loan Length'
    );

    const wrap = el('div', 'onboarding-terms-layout');
    const form = el('form', 'onboarding-fields onboarding-terms-form');
    const live = ticker(false);

    const tenureGroup = el('div', 'terms-field-group');
    tenureGroup.append(el('span', 'field-label', 'Loan Tenure'));
    tenureGroup.append(optionGroup('Loan tenure', [36, 48, 60, 72, 84].map(m => ({ value: String(m), title: `${m}m`, hint: `${m / 12} years` })),
      String(terms.tenure), value => { terms.tenure = value; live.update(); persist(); }, 'onboarding-options-tenure'));

    // Rate: the planner's typical 16% reducing balance, editable for a lender's quote.
    const rateGroup = el('div', 'terms-field-group onboarding-rate-row');
    const rateLabel = el('label', 'field-label', 'Annual Interest Rate (%)');
    const rateInput = el('input');
    rateInput.type = 'number';
    rateInput.min = '0';
    rateInput.max = '40';
    rateInput.step = '0.1';
    rateInput.required = true;
    rateInput.value = terms.rate || String(DEFAULT_RATE);
    rateInput.addEventListener('input', () => {
      terms.rate = rateInput.value;
      live.update();
      persist();
    });
    rateLabel.append(rateInput);

    const typeLabel = el('label', 'field-label', 'Rate Type');
    const typeSelect = el('select');
    [['reducing', 'Reducing balance'], ['flat', 'Flat rate']].forEach(([val, text]) => {
      const opt = el('option', '', text);
      opt.value = val;
      typeSelect.append(opt);
    });
    typeSelect.value = terms.rateType || 'reducing';
    typeSelect.addEventListener('change', () => {
      terms.rateType = typeSelect.value;
      live.update();
      persist();
    });
    typeLabel.append(typeSelect);
    rateGroup.append(rateLabel, typeLabel,
      el('p', 'field-hint', 'We start you at a typical 16% reducing balance. Enter your lender’s quote if you have one; flat-rate quotes are converted for you.'));

    form.append(tenureGroup, rateGroup);
    wrap.append(form, live.aside);
    body.append(wrap);

    foot.append(button('Continue to Down Payment →', () => {
      if (!form.reportValidity() || !validTerms(terms)) return;
      next();
    }, 'btn btn-primary'));
  }

  // STEP 4: DOWN PAYMENT
  function renderDown() {
    title(
      'How much will you put down?',
      'CBSL Directions No. 01 of 2026 set the minimum: 60% for a new or recently registered car, 40% once it has been registered for over a year.',
      'Step 4 of 5 · Down Payment'
    );

    const wrap = el('div', 'onboarding-terms-layout');
    const form = el('form', 'onboarding-fields onboarding-down-form');
    const live = ticker(true);
    form.append(optionGroup('Down payment', [
      { value: '40', title: '40%', hint: 'Registered over a year' },
      { value: '50', title: '50%', hint: 'Above the used minimum' },
      { value: '60', title: '60%', hint: 'New or recently registered' },
      { value: '70', title: '70%', hint: 'Lower monthly rental' }
    ], String(terms.down), value => { terms.down = value; live.update(); persist(); }, 'onboarding-options-down'),
    el('p', 'field-hint', 'A car that needs more than you choose uses its own CBSL minimum, shown beside it.'));
    wrap.append(form, live.aside);
    body.append(wrap);

    foot.append(button('See My Result →', () => {
      if (!validTerms(terms)) return;
      next();
    }, 'btn btn-primary'));
  }

  // STEP 5: RESULT
  function renderResult() {
    title(
      'Here is where you stand.',
      `${terms.tenure} months at ${terms.rate}% ${terms.rateType === 'flat' ? 'flat' : 'reducing balance'}, with at least ${terms.down}% down. Everything can be changed in the planner.`,
      'Step 5 of 5 · Your Result'
    );

    const income = parseNumber(terms.income);
    const debt = parseNumber(terms.debt);
    const summary = el('div', 'onboarding-summary');
    if (income) {
      // The most a new car can cost while rental plus existing payments stay within 40%.
      const down = Math.max(Number(terms.down), minDownFor('New'));
      const perMillion = rental(1e6 * (1 - down / 100), effectiveRate(), Number(terms.tenure));
      const room = income * 0.4 - debt;
      summary.append(el('span', 'summary-label', 'You can comfortably consider new cars up to'),
        el('strong', 'summary-value', room > 0 && perMillion > 0 ? formatLKR(room / perMillion * 1e6) : 'No room yet'),
        el('span', 'summary-note', room > 0
          ? `Keeps the rental and your existing payments within 40% of your ${formatLKR(income)} take-home pay.`
          : 'Your existing payments already use 40% of your income. A larger down payment or longer term will help.'));
    } else {
      summary.append(el('span', 'summary-label', 'Monthly rentals for your shortlist'),
        el('span', 'summary-note', 'Add your income in the planner to see which cars are comfortable and your budget ceiling.'));
    }
    body.append(summary);

    const list = el('div', 'onboarding-results');
    for (const car of selected) {
      const d = carDown(car);
      const monthly = carRental(car);
      const card = el('article', 'onboarding-result');
      if (car.img) {
        const thumb = el('img', 'result-thumb');
        thumb.src = safeImageUrl(car.img);
        thumb.alt = car.name;
        card.append(thumb);
      }
      card.append(
        el('h3', 'result-name', car.name),
        el('p', 'result-price', `${formatLKR(car.price)} · ${car.priceBasis || 'Published'}`),
        el('strong', 'result-rental', `${formatLKR(monthly)} / mo`),
        el('p', 'result-meta', `${formatLKR(car.price * d / 100)} down (${d}%) · ${terms.tenure} months`)
      );
      if (income) {
        const share = (monthly + debt) / income;
        const [cls, word] = share <= 0.4 ? ['ok', 'Comfortable'] : share <= 0.5 ? ['mid', 'Stretching'] : ['bad', 'Out of reach'];
        card.append(el('span', `tag ${cls} result-fit`, `${word} · ${Math.round(share * 100)}%`));
      }
      list.append(card);
    }
    body.append(list);

    const tourBtn = button('Take a 60-Second Guided Tour', () => {
      finish(true);
    }, 'btn-outline onboarding-tour-btn');

    const openBtn = button('Open My Lease →', () => {
      finish(false);
    }, 'btn btn-primary');

    foot.append(tourBtn, openBtn);
  }

  function finish(startTour = false) {
    if (selected.length < MIN_SHORTLIST || vehicleBatchError(selected) || !validTerms(terms)) return;

    const cars = [...selected];
    const previous = read('vahanaiq_comparison_v3', { version: 3, cars: [] });
    const existing = Array.isArray(previous?.cars) ? previous.cars : [];
    const mergedCars = mergeShortlist(existing, cars);
    const mergedTerms = { ...read('vahanaiq_inputs_v1', {}), ...terms };
    const savedCars = calculatorPage || write('vahanaiq_comparison_v3', { version: 3, cars: mergedCars });
    const savedTerms = calculatorPage || write('vahanaiq_inputs_v1', mergedTerms);

    if (!calculatorPage && (!savedCars || !savedTerms)) {
      status.textContent = 'Browser storage could not save this comparison. Ensure cookies/storage are enabled.';
      return;
    }

    write(ONBOARDING_KEY, { version: 1, completed: true, step: 4 });
    try { storage.removeItem('vahanaiq_onboarding_draft_v1'); } catch {}

    const guidance = read('vahanaiq_guidance_v1', { version: 1, tours: {} });
    write('vahanaiq_guidance_v1', { ...guidance, welcomed: true, tips: false });

    if (calculatorPage) {
      window.dispatchEvent(new CustomEvent('vahanaiq:onboarding-complete', { detail: { cars, terms } }));
      dialog.close();
      dialog.remove();
      document.body.classList.remove('onboarding-active');
      document.querySelector('.guide-invitation')?.setAttribute('hidden', '');
      document.querySelector('#h-list')?.focus();

      if (startTour) {
        window.dispatchEvent(new CustomEvent('vahanaiq:start-tour', { detail: { page: 'calculator' } }));
      }
    } else {
      location.href = startTour ? 'index.html?guide=tour#loanTermsHead' : 'index.html#comparisonPanel';
    }
  }
}

// --- Landing introduction (index.html) ---------------------------------------------
// js/boot.js decides before first paint whether this visit opens on the landing introduction.
const root = document.documentElement;
const landing = document.getElementById('landing');

// Popular models first; any that leave the catalogue are skipped, and the belts are topped up
// from the rest of the priced catalogue so they are never empty.
const FEATURED = ['toyota-raize', 'suzuki-fronx', 'toyota-aqua', 'byd-atto-3', 'honda-vezel', 'suzuki-swift', 'toyota-yaris-cross',
  'byd-sealion-5', 'kia-sportage', 'nissan-x-trail', 'suzuki-wagon-r', 'byd-dolphin', 'toyota-corolla-cross-z', 'mitsubishi-triton'];

const lkr = n => 'LKR ' + Math.round(n).toLocaleString('en-LK');

// The rental each card shows: catalogue price, the CBSL minimum (never below the planner's
// default), the planner's default rate and tenure. The same sums the planner itself runs.
function quote(model) {
  const offer = (model.offers || []).find(o => validPrice(o.amount));
  const photo = model.images?.[0]?.smallSrc || model.images?.[0]?.src;
  if (!offer || !photo) return null;
  const down = Math.max(DEFAULT_DOWN, minDownFor(offer.condition || 'New', model.financeClass, offer.firstRegisteredOn));
  return { model, photo, price: offer.amount, down, monthly: rental(offer.amount * (1 - down / 100), DEFAULT_RATE, DEFAULT_TENURE) };
}

function pickModels(models) {
  const byId = new Map(models.map(m => [m.id, m]));
  const chosen = FEATURED.map(id => byId.get(id)).filter(Boolean).map(quote).filter(Boolean);
  for (const model of models) {
    if (chosen.length >= 14) break;
    if (!FEATURED.includes(model.id)) { const q = quote(model); if (q) chosen.push(q); }
  }
  return chosen;
}

function tile(q, copy) {
  const li = document.createElement('li');
  if (copy) li.setAttribute('aria-hidden', 'true');
  const a = document.createElement('a');
  a.className = 'landing-tile';
  a.href = 'catalogue.html';
  a.dataset.landingLeave = '';
  if (copy) a.tabIndex = -1;
  a.setAttribute('aria-label', `${q.model.name}, from ${lkr(q.price)}, about ${lkr(q.monthly)} a month. Open the Showroom`);
  const photo = document.createElement('span');
  photo.className = 'landing-tile-photo';
  const img = document.createElement('img');
  img.src = safeImageUrl(q.photo);
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  photo.append(img);
  const text = document.createElement('span');
  text.className = 'landing-tile-text';
  const name = document.createElement('span');
  name.className = 'landing-tile-name';
  name.textContent = q.model.name;
  const price = document.createElement('span');
  price.className = 'landing-tile-price';
  price.textContent = lkr(q.price);
  const monthly = document.createElement('span');
  monthly.className = 'landing-tile-rental';
  monthly.append(lkr(q.monthly));
  const per = document.createElement('small');
  per.textContent = ' /mo';
  monthly.append(per);
  text.append(name, price, monthly);
  a.append(photo, text);
  li.append(a);
  return li;
}

// Each belt holds its cars twice; the CSS moves it by half its width, so the loop is seamless.
// The second copy is hidden from assistive technology and the tab order.
function fillBelt(list, quotes) {
  list.replaceChildren(...quotes.map(q => tile(q, false)), ...quotes.map(q => tile(q, true)));
}

function fillExample(q) {
  const figure = document.getElementById('landingExample');
  if (!figure || !q) return;
  const img = figure.querySelector('img');
  img.src = safeImageUrl(q.model.images?.[0]?.src || q.photo);
  img.alt = `${q.model.name}, manufacturer image`;
  figure.querySelector('.landing-example-label').textContent = `Example · ${q.model.name} · ${lkr(q.price)}`;
  const rentalLine = figure.querySelector('.landing-example-rental');
  const per = document.createElement('small');
  per.textContent = ' a month';
  rentalLine.replaceChildren(lkr(q.monthly), per);
  figure.querySelector('.landing-example-terms').textContent =
    `${lkr(q.price * q.down / 100)} down (${q.down}%) · ${DEFAULT_TENURE} months at ${DEFAULT_RATE}%`;
  figure.hidden = false;
}

// Once the visitor moves on, the introduction leaves the page, so the planner keeps its
// single h1 and returning visitors never carry the extra markup.
function closeLanding() {
  root.classList.remove('landing-pending');
  landing?.remove();
}

// Leaving for the planner or Showroom counts as dismissing setup, as Exit to Lease does; the
// Guided Setup button stays in the header for later.
function dismissLanding() {
  try {
    const saved = JSON.parse(localStorage.getItem(ONBOARDING_KEY) || 'null');
    if (!saved?.completed) localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ version: 1, completed: true, step: Number.isInteger(saved?.step) ? saved.step : 0 }));
  } catch {}
}

if (landing && !root.classList.contains('landing-pending')) landing.remove();
else if (landing) {
  const quotes = pickModels(window.__VAHANAIQ_CATALOGUE__?.models || []);
  if (quotes.length >= 4) {
    const half = Math.ceil(quotes.length / 2);
    fillBelt(document.getElementById('landingRowA'), quotes.slice(0, half));
    fillBelt(document.getElementById('landingRowB'), quotes.slice(half));
    document.getElementById('landingBelts').hidden = false;
  }
  fillExample(quotes[0]);

  landing.addEventListener('click', event => {
    const start = event.target.closest('[data-landing-start]');
    const leave = event.target.closest('[data-landing-leave]');
    if (start) {
      closeLanding();
      window.scrollTo({ top: 0, behavior: 'instant' });
      openOnboarding();
    } else if (leave) {
      dismissLanding();
      // The planner is this page: reveal it without a reload.
      if (new URL(leave.href).pathname === location.pathname) {
        event.preventDefault();
        closeLanding();
        history.replaceState(null, '', location.pathname);
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.getElementById('h-terms')?.focus({ preventScroll: true });
      }
    }
  });

  const pause = document.getElementById('landingPause');
  pause.addEventListener('click', () => {
    const paused = landing.classList.toggle('is-paused');
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? 'Play Animation' : 'Pause Animation';
  });
}
