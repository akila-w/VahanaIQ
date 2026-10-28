import { ONBOARDING_KEY, MIN_SHORTLIST, readOnboarding, validTerms, mergeShortlist } from './onboarding-state.js?v=2.12.0';
import { searchCatalogue } from './catalogue-search.js?v=2.12.0';
import { rental, flatToEffective, minDownFor } from './calculator.js?v=2.12.0';
import { validPrice, vehicleBatchError } from './vehicle-validation.js?v=2.12.0';
import { safeImageUrl } from './safe-url.js?v=2.12.0';
import { DEFAULT_RATE, DEFAULT_TENURE, DEFAULT_DOWN, CONDITIONS } from './constants.js?v=2.12.0';

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

  let step = selected.length < MIN_SHORTLIST ? Math.min(progress.step, 1) : progress.step;
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

  // Build the dialog
  const dialog = el('dialog', 'onboarding');
  dialog.id = 'onboarding';
  dialog.setAttribute('aria-labelledby', 'onboardingTitle');

  // Allow Escape key and cancel event to close dialog
  dialog.addEventListener('cancel', () => exitOnboarding());

  const top = el('header', 'onboarding-head');
  const brandGroup = el('div', 'onboarding-brand-group');
  const brandTitle = el('strong', 'onboarding-brand', 'VahanaIQ');
  const badge = el('span', 'onboarding-badge', 'Sri Lanka Edition');
  brandGroup.append(brandTitle, badge);

  // Stepper Progress Indicator - Interactive & Clickable
  const stepper = el('nav', 'onboarding-stepper');
  stepper.setAttribute('aria-label', 'Onboarding progress navigation');
  const stepLabels = ['Welcome', 'Shortlist', 'Loan Terms', 'Affordability', 'Comparison'];
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
    if (s === 0) return true;
    if (s === 1) return selected.length >= MIN_SHORTLIST && !vehicleBatchError(selected);
    if (s === 2) return validTerms(terms);
    if (s === 3) return true; // Income is optional
    return true;
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
      if (firstIncomplete === 1) {
        status.textContent = `Shortlist requires at least ${MIN_SHORTLIST} vehicles. Please complete Step 2 before proceeding.`;
      } else if (firstIncomplete === 2) {
        status.textContent = 'Please enter valid loan terms in Step 3 before proceeding.';
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
      const numSpan = item.querySelector('.step-num');
      if (numSpan) numSpan.textContent = idx < step ? '✓' : String(idx + 1);
    });
    const pct = (step / (stepLabels.length - 1)) * 100;
    progressLine.setAttribute('style', `width:${pct}%`);
  }

  function title(headText, subText, eyebrow = 'Sri Lanka Vehicle Finance Intelligence') {
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

    if (step > 0) {
      foot.append(button('← Back', () => { step--; persist(); render(); }, 'btn-outline'));
    }

    if (step === 0) {
      renderWelcome();
    } else if (step === 1) {
      renderShortlist();
    } else if (step === 2) {
      renderTerms();
    } else if (step === 3) {
      renderAffordability();
    } else {
      renderComparison();
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

  // STEP 0: WELCOME SCREEN (NO EMOJIS, Professional Cards & Numerals)
  function renderWelcome() {
    title(
      'Know your true monthly vehicle lease before visiting a showroom.',
      'VahanaIQ is an independent vehicle finance calculator built specifically for the Sri Lankan automotive market — with Central Bank regulations, distributor prices, and private affordability checks.',
      'Sri Lanka Vehicle Finance Intelligence'
    );

    const pillars = el('div', 'onboarding-pillars');

    const p1 = el('div', 'onboarding-pillar-card');
    p1.append(
      el('span', 'pillar-num', '01'),
      el('h3', '', 'Sri Lankan Market Database'),
      el('p', '', 'Over 220+ verified passenger models with official distributor prices and grey-market dealer asking prices in LKR.')
    );

    const p2 = el('div', 'onboarding-pillar-card');
    p2.append(
      el('span', 'pillar-num', '02'),
      el('h3', '', 'CBSL Regulated Leases'),
      el('p', '', 'Calculates true reducing-balance repayments and enforces Central Bank Directions No. 01 of 2026 (60% down for new/recond, 40% for >1yr reg).')
    );

    const p3 = el('div', 'onboarding-pillar-card');
    p3.append(
      el('span', 'pillar-num', '03'),
      el('h3', '', 'Affordability & DTI Gauge'),
      el('p', '', 'See how lease rentals fit your take-home pay under standard 40% prudent and 50% stretch Debt-to-Income (DTI) banking benchmarks.')
    );

    pillars.append(p1, p2, p3);
    body.append(pillars);

    const note = el('div', 'onboarding-privacy-badge');
    note.innerHTML = `<strong>Client-Side &amp; Private:</strong> No account required, no phone number, and your financial details never leave this browser.`;
    body.append(note);

    const startBtn = button('Start Guided Setup (Takes 2 min) →', next, 'btn btn-primary onboarding-cta-btn');
    foot.append(startBtn);
  }

  // STEP 1: SEARCH & SHORTLIST
  function renderShortlist() {
    title(
      'Choose at least 2 vehicles to compare',
      'Select vehicles from the curated Sri Lankan catalogue or enter a dealer quote. Choose your preferred trim or variant for each model.',
      'Step 2 of 5 · Build Your Shortlist'
    );

    const searchWrap = el('div', 'onboarding-search-wrap');
    const search = el('input', 'onboarding-search');
    search.type = 'search';
    search.placeholder = 'Search by make or model (e.g. Toyota, BYD, Suzuki, Vezel, Taisor)…';
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

    const continueButton = button('Continue to Loan Terms →', next, 'btn btn-primary');
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
      const trayHint = el('span', 'tray-hint', selected.length < MIN_SHORTLIST ? `Need at least ${MIN_SHORTLIST - selected.length} more` : 'Ready to proceed');
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
        trayPills.append(el('p', 'tray-empty-text', 'No vehicles selected yet. Browse below or search by make/model.'));
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
          const carObj = {
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
            el('p', '', models.length ? 'No matching vehicles found. Try another make or model name, or enter a quote above.' : 'Loading catalogue database…')
          ])
        );
      }
    }

    paint();
  }

  // STEP 2: LOAN TERMS
  function renderTerms() {
    title(
      'Set your lease financing terms',
      'Under Sri Lankan Central Bank regulations (CBSL Directions No. 01 of 2026), vehicle leases follow strict down payment and tenure guidelines.',
      'Step 3 of 5 · Financing Parameters'
    );

    const wrap = el('div', 'onboarding-terms-layout');
    const form = el('form', 'onboarding-fields onboarding-terms-form');

    // Interest rate
    const rateGroup = el('div', 'terms-field-group');
    const rateLabel = el('label', 'field-label', 'Annual Interest Rate (%)');
    const rateInput = el('input');
    rateInput.type = 'number';
    rateInput.min = '0';
    rateInput.max = '40';
    rateInput.step = '0.1';
    rateInput.required = true;
    rateInput.value = terms.rate || '16.0';
    rateInput.addEventListener('input', () => {
      terms.rate = rateInput.value;
      updateLiveTicker();
      persist();
    });
    rateLabel.append(rateInput);

    const ratePresets = el('div', 'terms-chip-row');
    [['14.0', '14.0% (Prime Bank)'], ['16.0', '16.0% (Standard)'], ['18.5', '18.5% (Finance Co)']].forEach(([val, label]) => {
      const chip = button(label, () => {
        terms.rate = val;
        rateInput.value = val;
        highlightChip(ratePresets, val);
        updateLiveTicker();
        persist();
      }, `terms-preset-chip ${terms.rate === val ? 'active' : ''}`);
      chip.dataset.val = val;
      ratePresets.append(chip);
    });
    rateGroup.append(rateLabel, ratePresets);

    // Rate type
    const typeGroup = el('div', 'terms-field-group');
    const typeLabel = el('label', 'field-label', 'Interest Calculation Type');
    const typeSelect = el('select');
    typeSelect.setAttribute('aria-label', 'Rate type');
    [['reducing', 'Reducing Balance (Standard for Leases)'], ['flat', 'Flat Rate (Fixed on Initial Principal)']].forEach(([val, text]) => {
      const opt = el('option', '', text);
      opt.value = val;
      typeSelect.append(opt);
    });
    typeSelect.value = terms.rateType || 'reducing';
    typeSelect.addEventListener('change', () => {
      terms.rateType = typeSelect.value;
      updateLiveTicker();
      persist();
    });
    typeLabel.append(typeSelect);
    const typeHint = el('p', 'field-hint', 'Regulated Sri Lankan leases use reducing balance. Flat rate quotes look lower but cost significantly more in total interest.');
    typeGroup.append(typeLabel, typeHint);

    // Tenure
    const tenureGroup = el('div', 'terms-field-group');
    const tenureLabel = el('label', 'field-label', 'Loan Tenure (Months)');
    const tenureInput = el('input');
    tenureInput.type = 'number';
    tenureInput.min = '6';
    tenureInput.max = '84';
    tenureInput.step = '1';
    tenureInput.required = true;
    tenureInput.value = terms.tenure || '84';
    tenureInput.addEventListener('input', () => {
      terms.tenure = tenureInput.value;
      updateLiveTicker();
      persist();
    });
    tenureLabel.append(tenureInput);

    const tenurePresets = el('div', 'terms-chip-row');
    [['36', '36m (3 yrs)'], ['60', '60m (5 yrs)'], ['84', '84m (CBSL Max 7 yrs)']].forEach(([val, label]) => {
      const chip = button(label, () => {
        terms.tenure = val;
        tenureInput.value = val;
        highlightChip(tenurePresets, val);
        updateLiveTicker();
        persist();
      }, `terms-preset-chip ${terms.tenure === val ? 'active' : ''}`);
      chip.dataset.val = val;
      tenurePresets.append(chip);
    });
    tenureGroup.append(tenureLabel, tenurePresets);

    // Down payment
    const downGroup = el('div', 'terms-field-group');
    const downLabel = el('label', 'field-label', 'Down Payment (% of vehicle price)');
    const downInput = el('input');
    downInput.type = 'number';
    downInput.min = '40';
    downInput.max = '100';
    downInput.step = '1';
    downInput.required = true;
    downInput.value = terms.down || '60';
    downInput.addEventListener('input', () => {
      terms.down = downInput.value;
      updateLiveTicker();
      persist();
    });
    downLabel.append(downInput);

    const downPresets = el('div', 'terms-chip-row');
    [['40', '40% Min (>1yr Reg)'], ['60', '60% Min (New / Recond)'], ['70', '70% (Higher Equity)']].forEach(([val, label]) => {
      const chip = button(label, () => {
        terms.down = val;
        downInput.value = val;
        highlightChip(downPresets, val);
        updateLiveTicker();
        persist();
      }, `terms-preset-chip ${terms.down === val ? 'active' : ''}`);
      chip.dataset.val = val;
      downPresets.append(chip);
    });
    downGroup.append(downLabel, downPresets);

    form.append(rateGroup, typeGroup, tenureGroup, downGroup);
    wrap.append(form);

    // Live Rental Preview Box
    const ticker = el('aside', 'onboarding-terms-ticker');
    const tickerTitle = el('strong', 'ticker-title', 'Shortlist Monthly Lease Estimates');
    const tickerList = el('div', 'ticker-list');
    ticker.append(tickerTitle, tickerList);
    wrap.append(ticker);

    body.append(wrap);

    function highlightChip(container, activeVal) {
      container.querySelectorAll('.terms-preset-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.val === activeVal);
      });
    }

    function updateLiveTicker() {
      tickerList.replaceChildren();
      const r = Number(terms.rate);
      const tenure = Number(terms.tenure);
      const effRate = terms.rateType === 'flat' ? flatToEffective(r, tenure) : r;

      if (!selected.length) {
        tickerList.append(el('p', 'ticker-empty', 'Select at least 2 vehicles in Step 2 to see live rental estimates.'));
        return;
      }

      for (const car of selected) {
        const d = Math.max(Number(terms.down), minDownFor(car.cond, car.financeClass, car.firstRegisteredOn));
        const financed = car.price * (1 - d / 100);
        const monthly = rental(financed, effRate, tenure);

        const row = el('div', 'ticker-row');
        row.append(
          el('span', 'ticker-car-name', car.name),
          el('strong', 'ticker-car-rental', `${formatLKR(monthly)} / mo`)
        );
        tickerList.append(row);
      }
    }

    updateLiveTicker();

    foot.append(button('Continue to Affordability Check →', () => {
      if (!form.reportValidity() || !validTerms(terms)) return;
      next();
    }, 'btn btn-primary'));
  }

  // STEP 3: AFFORDABILITY & CURRENCY INPUT (NO EMOJIS)
  function renderAffordability() {
    title(
      'Test your monthly affordability',
      'Sri Lankan financial institutions follow prudent Debt-to-Income (DTI) thresholds — standard 40% prudent limit and 50% maximum stretch ceiling.',
      'Step 4 of 5 · Net Income & Commitments'
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
    incInput.placeholder = 'e.g. 250,000 (Optional)';
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
    debtInput.placeholder = '0 if none';
    debtInput.value = terms.debt ? Math.round(parseNumber(terms.debt)).toLocaleString('en-LK') : '';
    debtWrap.append(debtPrefix, debtInput);
    debtLabel.append(debtWrap);

    // Preset chips for debt
    const debtChips = el('div', 'terms-chip-row');
    [['0', 'LKR 0 (No debts)'], ['25000', 'LKR 25k'], ['50000', 'LKR 50k'], ['100000', 'LKR 100k']].forEach(([val, label]) => {
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
    const dtiHeader = el('strong', 'dti-card-title', 'Affordability & DTI Feedback');
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
        dtiText.innerHTML = `<strong>Optional:</strong> Entering your income unlocks your personal Debt-to-Income gauge and cashflow spectrum. You can skip this step at any time.`;
        return;
      }

      let avgRental = 0;
      if (selected.length) {
        const r = Number(terms.rate);
        const tenure = Number(terms.tenure);
        const effRate = terms.rateType === 'flat' ? flatToEffective(r, tenure) : r;
        const total = selected.reduce((acc, car) => {
          const d = Math.max(Number(terms.down), minDownFor(car.cond, car.financeClass, car.firstRegisteredOn));
          return acc + rental(car.price * (1 - d / 100), effRate, tenure);
        }, 0);
        avgRental = total / selected.length;
      }

      const totalCommitments = debt + avgRental;
      const dtiPct = Math.round((totalCommitments / income) * 100);
      const cappedBar = Math.min(100, Math.max(5, dtiPct));
      dtiFill.setAttribute('style', `width:${cappedBar}%`);

      if (dtiPct <= 40) {
        dtiFill.className = 'onboarding-dti-fill safe';
        const buffer = Math.round((income * 0.4) - totalCommitments);
        dtiText.innerHTML = `<span class="tag ok">Prudent (${dtiPct}% DTI)</span> Total debt servicing is comfortably within Sri Lankan 40% prudent lending guidelines. Buffer remaining: <strong>${formatLKR(buffer)} / month</strong>.`;
      } else if (dtiPct <= 50) {
        dtiFill.className = 'onboarding-dti-fill mid';
        dtiText.innerHTML = `<span class="tag warn">Stretch (${dtiPct}% DTI)</span> Within the CBSL 50% ceiling, but leaves less buffer for comprehensive insurance, fuel and vehicle upkeep.`;
      } else {
        dtiFill.className = 'onboarding-dti-fill bad';
        dtiText.innerHTML = `<span class="tag alert">High Commitment (${dtiPct}% DTI)</span> Exceeds prudent 50% debt-to-income benchmarks. Consider a higher down payment or longer tenure to lower the monthly payment.`;
      }
    }

    updateDtiMeter();

    foot.append(
      button('Skip Income', () => {
        terms.income = '';
        terms.debt = '';
        next();
      }, 'btn-outline'),
      button('See My Comparison →', next, 'btn btn-primary')
    );
  }

  // STEP 4: COMPARISON SCREEN (NO EMOJIS)
  function renderComparison() {
    title(
      'Your vehicle finance comparison is ready',
      `Based on ${terms.rate}% ${terms.rateType} rate over ${terms.tenure} months with a ${terms.down}% baseline deposit. Everything can be adjusted live in the calculator.`,
      'Step 5 of 5 · Summary & Review'
    );

    const list = el('div', 'onboarding-results');
    const r = Number(terms.rate);
    const tenure = Number(terms.tenure);
    const effRate = terms.rateType === 'flat' ? flatToEffective(r, tenure) : r;

    for (const car of selected) {
      const d = Math.max(Number(terms.down), minDownFor(car.cond, car.financeClass, car.firstRegisteredOn));
      const financed = car.price * (1 - d / 100);
      const monthly = rental(financed, effRate, tenure);
      const depositAmount = car.price * (d / 100);

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
        el('p', 'result-meta', `${formatLKR(depositAmount)} deposit (${d}%) · ${tenure} months`)
      );
      list.append(card);
    }
    body.append(list);

    const tourPrompt = el('div', 'onboarding-tour-callout');
    tourPrompt.innerHTML = `<strong>Guided App Tour Available:</strong> Take a 60-second interactive tour of the loan terms, affordability gauge, and comparison schedules.`;
    body.append(tourPrompt);

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
