'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? esc(u.href) : '#'; } catch { return '#'; } };
  const money = n => 'LKR ' + n.toLocaleString('en-LK', {maximumFractionDigits:0});
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'Date Not Specified';
  const fmt = n => Number(n).toLocaleString('en-LK', {minimumFractionDigits:2, maximumFractionDigits:2});
  const kinds = {official:'Distributor Price',dealer:'Dealer Asking Price',launch:'Published Launch Price',estimated:'Estimated Price',quote:'Price on Request'};
  let data, identity = {}, cards = [], page = 0, reviewOnly = false, current = null, imageIndex = 0, opener = null;
  let selectedAffordabilityVehicle = null;
  const size = 18;
  let review = {flags:{},notes:{},comparison:{}};
  try {
    const saved = JSON.parse(localStorage.getItem('vahanaiq_curated_review_v1') || '{}');
    if (saved && typeof saved === 'object') {
      review.flags = saved.flags && typeof saved.flags === 'object' && !Array.isArray(saved.flags) ? saved.flags : {};
      review.notes = saved.notes && typeof saved.notes === 'object' && !Array.isArray(saved.notes) ? saved.notes : {};
      review.comparison = saved.comparison && typeof saved.comparison === 'object' && !Array.isArray(saved.comparison) ? saved.comparison : {};
    }
  } catch {}
  function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 3500); }
  function save() { try { localStorage.setItem('vahanaiq_curated_review_v1',JSON.stringify(review)); } catch { toast('Browser storage is unavailable. Export your review to keep it.'); } }
  const priced = m => m.offers.filter(o => Number.isFinite(o.amount) && o.amount > 0);
  const lowest = m => priced(m).reduce((best,o) => !best || o.amount < best.amount ? o : best, null);
  function getOfferForCard(m, type) {
    const pOffers = priced(m);
    if (!pOffers.length) return { offer: null, count: 0 };
    let matching = pOffers;
    if (type === 'official' || type === 'dealer' || type === 'launch' || type === 'estimated') {
      const filtered = pOffers.filter(o => o.kind === type);
      if (filtered.length) matching = filtered;
    } else if (type === 'priced') {
      const filtered = pOffers.filter(o => o.kind === 'launch' || o.kind === 'official');
      if (filtered.length) matching = filtered;
    }
    const best = matching.reduce((prev, o) => !prev || o.amount < prev.amount ? o : prev, null);
    return { offer: best, count: matching.length };
  }
  const shortName = m => m.name.startsWith(m.make+' ') ? m.name.slice(m.make.length+1) : m.model;

  function getSavedComparisonCars() {
    try {
      const raw = localStorage.getItem('vahanaiq_comparison_v3');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === 3 && Array.isArray(parsed.cars)) return parsed.cars;
      }
    } catch {}
    return [];
  }

  function saveComparisonCars(cars) {
    try {
      localStorage.setItem('vahanaiq_comparison_v3', JSON.stringify({ version: 3, cars }));
      try { window.dispatchEvent(new Event('vahanaiq:saved')); } catch {}
    } catch {}
  }

  function isCarInComparison(m) {
    if (!m) return false;
    const modelId = m.modelId || m.id;
    if (review.comparison?.[m.id] || review.comparison?.[modelId]) return true;
    const saved = getSavedComparisonCars();
    return saved.some(c => c.id === m.id || c.catalogueId === m.id || c.catalogueId === modelId || c.name === m.name || (c.make === m.make && c.model === m.model));
  }

  function toggleComparison(m, offer = null) {
    if (!m) return;
    const modelId = m.modelId || m.id;
    const inComp = isCarInComparison(m);
    let saved = getSavedComparisonCars();

    if (inComp) {
      delete review.comparison[m.id];
      delete review.comparison[modelId];
      saved = saved.filter(c => c.id !== m.id && c.catalogueId !== m.id && c.catalogueId !== modelId && c.name !== m.name);
      saveComparisonCars(saved);
      save();
      toast(`Removed ${m.name} from comparison.`);
    } else {
      if (!review.comparison) review.comparison = {};
      review.comparison[m.id] = true;
      save();
      const currentType = $('priceType')?.value || '';
      const low = offer || (currentType ? getOfferForCard(m, currentType).offer : null) || lowest(m) || m.offers?.[0] || {};
      const cleanName = shortName(m).replace(/\s+(202[0-9])$/, '');
      const cardTitle = cleanName.toLowerCase().startsWith(m.make.toLowerCase()) ? cleanName : `${m.make} ${cleanName}`;
      const carRecord = {
        id: m.id,
        catalogueId: modelId,
        name: `${cardTitle} ${m.cardYear || ''}`.trim(),
        make: m.make,
        model: m.model || cleanName,
        price: low.amount || 0,
        cond: low.condition || 'New',
        pt: low.fuel ? `${low.fuel} Powertrain` : (m.offers?.find(o => o.fuel)?.fuel ? `${m.offers.find(o => o.fuel).fuel} Powertrain` : 'Petrol'),
        km: '',
        w: low.route === 'Distributor' ? 'Official' : (low.route === 'Dealer Listing' ? 'Dealer' : 'Grey'),
        img: m.images?.[0]?.smallSrc || m.images?.[0]?.src || '',
        custom: true,
        legacy: false
      };
      if (!saved.some(c => c.id === m.id || c.catalogueId === modelId || c.name === carRecord.name)) {
        saved.push(carRecord);
      }
      saveComparisonCars(saved);
      toast(`Added ${m.name} to comparison.`);
    }

    selectedAffordabilityVehicle = m;
    render();
  }

  function getBudgetSettings() {
    try {
      const raw = localStorage.getItem('vahanaiq_inputs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        const income = parseFloat(String(parsed.income ?? '').replace(/,/g, '')) || 0;
        const debt = parseFloat(String(parsed.debt ?? '').replace(/,/g, '')) || 0;
        const dti = parseFloat(parsed.dti) || 0.4;
        let maxprice = parseFloat(String(parsed.maxprice ?? '').replace(/,/g, '')) || 0;
        if (maxprice > 0 && maxprice < 1000) maxprice *= 1000000;
        const down = parseFloat(parsed.down) || 60;
        const tenure = parseFloat(parsed.tenure) || 84;
        const rate = parseFloat(parsed.rate) || 16;
        const rateType = parsed.rateType === 'flat' ? 'flat' : 'reducing';
        return { income, debt, dti, maxprice, down, tenure, rate, rateType };
      }
    } catch {}
    return { income: 0, debt: 0, dti: 0.4, maxprice: 0, down: 60, tenure: 84, rate: 16, rateType: 'reducing' };
  }

  function buildAffordabilityHtml(m) {
    if (!m) return '';
    const settings = getBudgetSettings();
    const currentType = $('priceType')?.value || '';
    const low = (currentType ? getOfferForCard(m, currentType).offer : null) || lowest(m);
    const price = low?.amount || 0;
    const cleanName = shortName(m).replace(/\s+(202[0-9])$/, '');
    const vehicleTitle = cleanName.toLowerCase().startsWith(m.make.toLowerCase()) ? cleanName : `${m.make} ${cleanName}`;

    const income = settings.income;
    const debt = settings.debt;
    const dti = settings.dti;
    const maxprice = settings.maxprice;
    const downPct = settings.down;
    const tenure = settings.tenure;
    const rate = settings.rate;

    let f = 0;
    if (settings.rateType === 'flat') {
      f = (1 / tenure) + (rate / 100 / 12);
    } else {
      const r = (rate / 100) / 12;
      f = r > 0 ? (r / (1 - Math.pow(1 + r, -tenure))) : (1 / tenure);
    }

    const loan = price * (1 - downPct / 100);
    const rental = loan * f;
    const monthlyCommitment = rental + debt;
    const monthlyRoom = income > 0 ? Math.max(0, (income * dti) - debt) : 0;
    const dtiPct = income > 0 ? (monthlyCommitment / income * 100) : null;

    let statusTag = '';
    let summaryText = '';

    if (income > 0) {
      if (dtiPct <= dti * 100) {
        statusTag = `<span class="tag ok">Within Budget · ${dtiPct.toFixed(1)}% DTI</span>`;
        summaryText = `At LKR ${fmt(rental)}/mo (${downPct}% down, ${tenure}m @ ${rate}%), this vehicle fits within your ${Math.round(dti * 100)}% DTI monthly budget ceiling of LKR ${fmt(monthlyRoom)}.`;
      } else if (dtiPct <= 50) {
        statusTag = `<span class="tag mid">Stretch Budget · ${dtiPct.toFixed(1)}% DTI</span>`;
        summaryText = `At LKR ${fmt(rental)}/mo, this vehicle exceeds your standard ${Math.round(dti * 100)}% DTI limit but remains within the 50% stretch limit.`;
      } else {
        statusTag = `<span class="tag bad">Above Budget · ${dtiPct.toFixed(1)}% DTI</span>`;
        summaryText = `Total monthly commitment (LKR ${fmt(monthlyCommitment)}) exceeds the 50% DTI ceiling on your entered monthly income of LKR ${fmt(income)}.`;
      }
    } else if (maxprice > 0) {
      if (price <= maxprice) {
        statusTag = `<span class="tag ok">Within Budget</span>`;
        summaryText = `At LKR ${fmt(price)}, this vehicle is LKR ${fmt(maxprice - price)} under your entered budget ceiling of LKR ${fmt(maxprice)}.`;
      } else {
        statusTag = `<span class="tag bad">Above Budget</span>`;
        summaryText = `At LKR ${fmt(price)}, this vehicle is LKR ${fmt(price - maxprice)} above your entered budget ceiling of LKR ${fmt(maxprice)}.`;
      }
    } else {
      statusTag = `<span class="tag ok">Indicative Quote</span>`;
      summaryText = price > 0
        ? `Estimated monthly lease rental: LKR ${fmt(rental)}/mo (${downPct}% down payment: LKR ${fmt(price * downPct / 100)}, ${tenure} months). Configure your income in the Calculator to test DTI affordability.`
        : `Request a verified quote to calculate monthly lease rental and test affordability against your budget.`;
    }

    return `
      <div class="affordability-card">
        <div class="affordability-card-head">
          <div class="affordability-title-group">
            <span class="eyebrow">Affordability Summary</span>
            <h4>Budget &amp; Affordability Review for ${esc(vehicleTitle)}</h4>
          </div>
          ${statusTag}
        </div>
        <div class="affordability-metrics">
          <div class="afford-stat">
            <span class="afford-stat-label">Vehicle Price</span>
            <span class="afford-stat-val">${price > 0 ? money(price) : 'Price on Request'}</span>
          </div>
          <div class="afford-stat">
            <span class="afford-stat-label">Entered Budget</span>
            <span class="afford-stat-val">${income > 0 ? money(income) + ' / mo' : maxprice > 0 ? money(maxprice) : 'Standard Terms'}</span>
          </div>
          <div class="afford-stat">
            <span class="afford-stat-label">Estimated Rental</span>
            <span class="afford-stat-val">${price > 0 ? money(Math.round(rental)) + ' / mo' : 'Quote Needed'}</span>
          </div>
          <div class="afford-stat">
            <span class="afford-stat-label">Statutory Down (${downPct}%)</span>
            <span class="afford-stat-val">${price > 0 ? money(Math.round(price * downPct / 100)) : '—'}</span>
          </div>
        </div>
        <p class="affordability-summary-line">${esc(summaryText)}</p>
      </div>
    `;
  }

  function renderAffordabilityPanel() {
    const el = $('affordabilityPanel');
    if (!el) return;

    const compCards = cards.filter(c => isCarInComparison(c));
    const markedCards = cards.filter(c => review.flags[c.id] || review.flags[c.modelId]);

    let target = selectedAffordabilityVehicle;
    if (target && !cards.some(c => c.id === target.id)) target = null;
    if (!target && compCards.length > 0) target = compCards[0];
    if (!target && markedCards.length > 0) target = markedCards[0];
    if (!target) target = cards.find(c => c.make === 'Audi' && c.model === 'A3') || cards[0];

    if (!target) {
      el.innerHTML = '<div class="affordability-empty"><p>Select or mark vehicles to compare against your budget.</p></div>';
      return;
    }

    const pool = [...new Set([...compCards, ...markedCards])];
    const switchers = pool.length > 1 ? `
      <div class="affordability-switcher">
        <span class="switcher-label">Reviewing:</span>
        <div class="switcher-chips">
          ${pool.map(c => `
            <button type="button" class="btn-xs chip-btn ${c.id === target.id ? 'active' : ''}" data-afford-select="${esc(c.id)}">
              ${esc(c.make)} ${esc(shortName(c).replace(/\s+(202[0-9])$/, ''))}
            </button>
          `).join('')}
        </div>
      </div>
    ` : '';

    el.innerHTML = `
      <div class="affordability-panel-inner">
        ${switchers}
        ${buildAffordabilityHtml(target)}
      </div>
    `;
  }

  function mark(m) { const brand = identity.brands?.[m.make]; const path = brand?.localPath; if (!path) return ''; const cleanPath = path.startsWith('../') ? path.slice(3) : path; const isAdaptive = Boolean(brand.adaptive); return `<img class="make-logo ${isAdaptive ? 'adaptive' : ''}" src="${esc(cleanPath)}" alt="" height="27" loading="lazy">`; }
  function photo(p, name, eager = false) { return `<img src="${esc(p.smallSrc)}" srcset="${esc(p.smallSrc)} 640w, ${esc(p.src)} 1280w" sizes="(max-width:650px) calc(100vw - 36px), (max-width:1020px) 44vw, 29vw" width="1280" height="800" alt="${esc(name)} — official manufacturer image" loading="${eager?'eager':'lazy'}" decoding="async">`; }

  function buildCards(models) {
    const list = [];
    for (const m of models) {
      const years = [...new Set(m.offers.map(o => o.year).filter(Boolean))];
      if (years.length > 1) {
        years.sort((a, b) => a - b);
        for (const yr of years) {
          let yrOffers = m.offers.filter(o => o.year === yr || (!o.year && o.sourcePublishedOn?.startsWith(String(yr))));
          if (yr === years[years.length - 1]) {
            const coveredIds = new Set(years.flatMap(y => m.offers.filter(o => o.year === y || (!o.year && o.sourcePublishedOn?.startsWith(String(y)))).map(o => o.id)));
            const remaining = m.offers.filter(o => !coveredIds.has(o.id));
            yrOffers = [...yrOffers, ...remaining];
          }
          const cardYear = String(yr);
          list.push({
            ...m,
            id: `${m.id}-${cardYear}`,
            modelId: m.id,
            cardYear,
            offers: yrOffers
          });
        }
      } else {
        let cardYear = years[0] ? String(years[0]) : null;
        if (!cardYear) {
          const match = m.name.match(/\b(202[0-9])\b/);
          cardYear = match ? match[1] : '2026';
        }
        list.push({
          ...m,
          modelId: m.id,
          cardYear,
          offers: m.offers
        });
      }
    }
    return list;
  }

  function list() {
    const q = $('search').value.trim().toLowerCase(), type = $('priceType').value;
    let result = cards.filter(m => (!$('make').value || m.make === $('make').value) && (!$('body').value || m.body === $('body').value) && (!reviewOnly || review.flags[m.id] || review.flags[m.modelId] || review.notes[m.id] || review.notes[m.modelId]) && (!q || [m.name,m.body,m.cardYear,...m.offers.flatMap(o => [o.name,o.trim,o.year,o.fuel])].join(' ').toLowerCase().includes(q)) && (!type || type === 'priced' && priced(m).length || type === 'quote' && !priced(m).length || ['official','dealer','launch','estimated'].includes(type) && m.offers.some(o => o.kind === type && o.amount)));
    const sort = $('sort')?.value || 'make';
    return result.sort((a,b) => {
      const x = (getOfferForCard(a, type).offer || lowest(a))?.amount;
      const y = (getOfferForCard(b, type).offer || lowest(b))?.amount;
      if (sort === 'low') {
        if (x === undefined && y !== undefined) return 1;
        if (y === undefined && x !== undefined) return -1;
        if (x !== undefined && y !== undefined && x !== y) return x - y;
        const makeCmp = a.make.localeCompare(b.make);
        if (makeCmp !== 0) return makeCmp;
      } else if (sort === 'high') {
        if (x === undefined && y !== undefined) return 1;
        if (y === undefined && x !== undefined) return -1;
        if (x !== undefined && y !== undefined && x !== y) return y - x;
        const makeCmp = a.make.localeCompare(b.make);
        if (makeCmp !== 0) return makeCmp;
      } else if (sort === 'year-desc') {
        const yrA = parseInt(a.cardYear, 10) || 0;
        const yrB = parseInt(b.cardYear, 10) || 0;
        if (yrA !== yrB) return yrB - yrA;
        const makeCmp = a.make.localeCompare(b.make);
        if (makeCmp !== 0) return makeCmp;
      } else if (sort === 'year-asc') {
        const yrA = parseInt(a.cardYear, 10) || 0;
        const yrB = parseInt(b.cardYear, 10) || 0;
        if (yrA !== yrB) return yrA - yrB;
        const makeCmp = a.make.localeCompare(b.make);
        if (makeCmp !== 0) return makeCmp;
      } else if (sort === 'model') {
        const nameA = shortName(a).replace(/\s+(202[0-9])$/, '');
        const nameB = shortName(b).replace(/\s+(202[0-9])$/, '');
        const cmp = nameA.localeCompare(nameB);
        if (cmp !== 0) return cmp;
        const makeCmp = a.make.localeCompare(b.make);
        if (makeCmp !== 0) return makeCmp;
      } else if (sort === 'model-desc') {
        const nameA = shortName(a).replace(/\s+(202[0-9])$/, '');
        const nameB = shortName(b).replace(/\s+(202[0-9])$/, '');
        const cmp = nameB.localeCompare(nameA);
        if (cmp !== 0) return cmp;
        const makeCmp = a.make.localeCompare(b.make);
        if (makeCmp !== 0) return makeCmp;
      } else if (sort === 'make-desc') {
        const cmp = b.make.localeCompare(a.make);
        if (cmp !== 0) return cmp;
      } else {
        // Default: 'make' (Make A to Z)
        const cmp = a.make.localeCompare(b.make);
        if (cmp !== 0) return cmp;
      }
      return a.name.localeCompare(b.name) || a.cardYear.localeCompare(b.cardYear);
    });
  }

  function render() {
    const all = list(); page = Math.max(0, Math.min(page, Math.ceil(all.length/size)-1));
    $('resultCount').textContent = `${all.length} ${all.length===1?'Vehicle':'Vehicles'} · ${all.reduce((n,m) => n+m.offers.length,0)} Purchase Options`;
    $('reviewCount').textContent = '('+cards.filter(m => review.flags[m.id] || review.flags[m.modelId] || review.notes[m.id] || review.notes[m.modelId] || isCarInComparison(m)).length+')';
    $('reviewFilter').setAttribute('aria-pressed',String(reviewOnly));
    const type = $('priceType')?.value || '';
    $('vehicles').innerHTML = all.slice(page*size,page*size+size).map((m,i) => {
      const p = m.images[0];
      const { offer: low, count: offerCount } = getOfferForCard(m, type);
      const fuels = [...new Set(m.offers.map(o => o.fuel).filter(Boolean))];
      const cleanName = shortName(m).replace(/\s+(202[0-9])$/, '');
      const cardTitle = cleanName.toLowerCase().startsWith(m.make.toLowerCase()) ? cleanName : `${m.make} ${cleanName}`;
      const isMarked = Boolean(review.flags[m.id] || review.flags[m.modelId]);
      const inComp = isCarInComparison(m);
      return `<article class="card"><button class="photo-button" data-open="${esc(m.id)}" aria-label="View ${esc(m.name)}">${photo(p,m.name,i<3)}${mark(m)?`<span class="brand-badge" aria-label="${esc(m.make)}">${mark(m)}</span>`:''}${p.origin === "owner-upload" ? '<span class="photo-count">Your Photo</span>' : (m.images.length > 1 ? `<span class="photo-count">${m.images.length} Views</span>` : "")}</button><div class="card-body"><h3>${esc(cardTitle)} <span class="model-year">${esc(m.cardYear)}</span></h3><div class="card-meta"><span><img src="assets/icons/lucide/car.svg" alt="">${esc(m.body)}</span>${fuels.length?`<span><img src="assets/icons/lucide/fuel.svg" alt="">${esc(fuels.join(' / '))}</span>`:''}</div><div class="price-area"><p class="price ${low?'':'quote'}">${low?`${offerCount>1?'From ':''}${money(low.amount)}`:'Price on Request'}</p><p class="price-label">${low?`${kinds[low.kind]}${low.year?' · '+low.year:''}`:'Request a Matching Current Quotation'}</p>${low?.kind === 'estimated' ? '<p class="estimate-methodology">Estimated Price based on Sri Lanka Customs Tariff, engine capacity/EV tier &amp; distributor bracket</p>' : ''}</div><div class="sources">${p.sourcePage?`<a href="${safeUrl(p.sourcePage)}" target="_blank" rel="noopener noreferrer" title="${esc(m.make)} · Official Website · Rights Reserved">Photo Source ↗</a>`:'<span class="studio-credit">Photo Studio · This Device</span>'}${low?`<a href="${safeUrl(low.sourceUrl)}" target="_blank" rel="noopener noreferrer">Price Source ↗</a>`:''}</div><div class="card-actions"><button data-open="${esc(m.id)}">${m.offers.length>1?'Compare Purchase Options':'View Details'} <span aria-hidden="true">↗</span></button><button class="flag" data-flag="${esc(m.id)}" aria-label="Mark ${esc(m.name)} for review" aria-pressed="${isMarked}">${isMarked?'✓ Marked':'Mark for Review'}</button><button class="compare-btn" data-compare="${esc(m.id)}" aria-label="Add ${esc(m.name)} to comparison" aria-pressed="${inComp}">${inComp?'✓ In Comparison':'Add to Comparison'}</button></div></div></article>`;
    }).join('') || '<div class="empty"><h3>No Vehicles Found</h3><p>Try a different search or reset the filters.</p></div>';
    $('pageCount').textContent = `${all.length?page+1:0} / ${Math.ceil(all.length/size)}`;
    $('previous').disabled = page === 0; $('next').disabled = (page+1)*size >= all.length;
    renderAffordabilityPanel();
  }

  function gallery() {
    const p = current.images[imageIndex];
    $('galleryImage').innerHTML = photo(p,current.name,true);
    $('galleryPosition').textContent = `${imageIndex+1} of ${current.images.length}`;
    const sourcePage = /^https:\/\//.test(p.sourcePage || '') ? p.sourcePage : '';
    $('gallerySource').hidden = !sourcePage; $('galleryOriginal').hidden = !sourcePage;
    if (sourcePage) { $('gallerySource').href = sourcePage; $('galleryOriginal').href = p.url; }
    $('photoNote').textContent = p.note || '';
    $('galleryPrevious').disabled = imageIndex === 0; $('galleryNext').disabled = imageIndex === current.images.length-1;
    if ($('galleryCoverBadge')) $('galleryCoverBadge').hidden = imageIndex !== 0;
    if ($('galleryMakeCoverBtn')) $('galleryMakeCoverBtn').hidden = imageIndex === 0;
    if ($('galleryRemoveBtn')) $('galleryRemoveBtn').hidden = current.images.length < 2;
    const modelId = current.modelId || current.id;
    if ($('galleryUndoBtn') && window.__VAHANAIQ_PHOTOS__?.hasEdits) {
      window.__VAHANAIQ_PHOTOS__.hasEdits(modelId).then(hasEdits => {
        if ($('galleryUndoBtn')) $('galleryUndoBtn').hidden = !hasEdits;
      }).catch(() => {});
    }
  }

  function open(m, button) {
    current = m; imageIndex = 0; opener = button;
    selectedAffordabilityVehicle = m;
    const cleanName = shortName(m).replace(/\s+(202[0-9])$/, '');
    const modelId = m.modelId || m.id;
    const inComp = isCarInComparison(m);
    const isMarked = Boolean(review.flags[m.id] || review.flags[modelId]);
    $('detailMake').textContent = m.make; $('detailTitle').textContent = `${cleanName} ${m.cardYear}`;
    $('detailBody').innerHTML = `<div class="dialog-compare-bar"><button id="dialogCompareBtn" class="btn btn-compare" data-compare="${esc(m.id)}" type="button" aria-pressed="${inComp}">${inComp ? '✓ In Comparison' : '+ Add to Comparison'}</button><button class="flag" data-flag="${esc(m.id)}" aria-label="Mark ${esc(m.name)} for review" aria-pressed="${isMarked}">${isMarked ? '✓ Marked' : 'Mark for Review'}</button></div><div class="detail-layout"><section class="detail-gallery" aria-label="Official Vehicle Images"><div class="photo-frame" id="galleryImage"></div><div class="gallery-controls" id="galleryControls"><button id="galleryPrevious" aria-label="Previous Photo">←</button><span id="galleryPosition" role="status"></span><button id="galleryNext" aria-label="Next Photo">→</button></div><div class="gallery-toolbar" id="galleryToolbar"><span id="galleryCoverBadge" class="tag cover-tag" title="This photo is currently the cover photo on the catalogue card">★ Cover Photo</span><button id="galleryMakeCoverBtn" class="btn-outline btn-xs" type="button" title="Set this photo as the cover photo on the catalogue card">Set as Cover</button><button id="galleryCropBtn" class="btn-outline btn-xs crop-toggle-btn" type="button" title="Quickly adjust framing and crop for this photo">Crop &amp; Frame</button><a id="galleryStudioBtn" href="studio.html#model=${encodeURIComponent(modelId)}" class="btn-outline btn-xs studio-edit-btn" title="Open Photo Studio to crop, frame, add or arrange photos">Studio ↗</a><button id="galleryRemoveBtn" class="quiet btn-xs remove-btn" type="button" title="Remove this photo from this vehicle">Remove</button><button id="galleryUndoBtn" class="quiet btn-xs undo-btn" type="button" title="Revert to original published photos" hidden>Undo Changes</button></div><div class="modal-crop-toolbar" id="modalCropToolbar" hidden><div class="crop-tool-group"><button id="modalCropFitBtn" class="btn-outline btn-xs" type="button" title="Fit photo to frame">Fit</button><button id="modalCropCentreBtn" class="btn-outline btn-xs" type="button" title="Centre photo">Centre</button><button id="modalCropZoomOut" class="btn-outline btn-xs" type="button" aria-label="Zoom out">−</button><span id="modalCropZoomVal" class="zoom-chip">1.00×</span><button id="modalCropZoomIn" class="btn-outline btn-xs" type="button" aria-label="Zoom in">+</button></div><div class="crop-action-group"><button id="modalCropCancelBtn" class="quiet btn-xs" type="button">Cancel</button><button id="modalCropDoneBtn" class="btn btn-xs btn-primary-crop" type="button">Save</button></div></div><div class="sources gallery-source"><a id="gallerySource" target="_blank" rel="noopener noreferrer">Photo Source ↗</a><a id="galleryOriginal" target="_blank" rel="noopener noreferrer">Original Image ↗</a></div><p class="photo-note" id="photoNote"></p></section><section aria-label="Purchase Options"><h3>Purchase Options</h3><div class="offer-stack">${m.offers.map(o => `<article class="offer"><span class="tag ${esc(o.kind)}">${esc(kinds[o.kind])}</span><h3>${esc(o.name)}</h3><p class="offer-meta">${esc([o.trim,o.year,o.condition,o.route].filter(Boolean).join(' · '))}</p><p class="price ${o.amount?'':'quote'}">${o.amount?money(o.amount):'Price on Request'}</p><div class="offer-actions"><button class="btn-outline btn-xs offer-compare-btn" data-compare="${esc(m.id)}" data-offer-id="${esc(o.id)}" type="button" aria-pressed="${inComp}">${inComp ? '✓ In Comparison' : 'Add to Comparison'}</button></div><p class="offer-meta">Checked ${date(o.checkedOn)}${o.sourcePublishedOn?' · Published '+date(o.sourcePublishedOn):''}</p>${o.kind === 'estimated' ? '<p class="estimate-methodology">Estimated Price based on Sri Lanka Customs Tariff, engine capacity/EV tier &amp; distributor bracket</p>' : ''}${o.note?`<p class="offer-note">${esc(o.note)}</p>`:''}<a href="${safeUrl(o.sourceUrl)}" target="_blank" rel="noopener noreferrer">${o.amount?'View Price Source':'Visit Source / Request a Quote'} ↗</a>${o.image?`<img class="variant-image" src="${esc(o.image.smallSrc)}" width="640" height="400" alt="${esc(o.name)}"><p class="photo-note">${esc(o.image.caption || 'Japanese Market Image')} · <a href="${safeUrl(o.image.sourcePage)}" target="_blank" rel="noopener noreferrer">Photo Source ↗</a></p>`:''}</article>`).join('')}</div></section></div><section class="detail-affordability" aria-label="Affordability Summary">${buildAffordabilityHtml(m)}</section><div class="review-note"><label for="note">Your Review Note</label><textarea id="note" maxlength="3000" placeholder="Anything you would like changed for this vehicle…"></textarea><p>Saved locally in this browser. Included when you export your review.</p></div>`;
    $('dialogCompareBtn')?.addEventListener('click', () => {
      toggleComparison(m);
      const updatedInComp = isCarInComparison(m);
      $('dialogCompareBtn').setAttribute('aria-pressed', String(updatedInComp));
      $('dialogCompareBtn').textContent = updatedInComp ? '✓ In Comparison' : '+ Add to Comparison';
      $('detailBody').querySelectorAll('.offer-compare-btn').forEach(b => {
        b.setAttribute('aria-pressed', String(updatedInComp));
        b.textContent = updatedInComp ? '✓ In Comparison' : 'Add to Comparison';
      });
      const affordSec = $('detailBody').querySelector('.detail-affordability');
      if (affordSec) affordSec.innerHTML = buildAffordabilityHtml(m);
    });
    $('detailBody').querySelectorAll('.offer-compare-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const offerId = btn.dataset.offerId;
        const offer = m.offers.find(o => o.id === offerId) || null;
        toggleComparison(m, offer);
        const updatedInComp = isCarInComparison(m);
        $('dialogCompareBtn')?.setAttribute('aria-pressed', String(updatedInComp));
        if ($('dialogCompareBtn')) $('dialogCompareBtn').textContent = updatedInComp ? '✓ In Comparison' : '+ Add to Comparison';
        $('detailBody').querySelectorAll('.offer-compare-btn').forEach(b => {
          b.setAttribute('aria-pressed', String(updatedInComp));
          b.textContent = updatedInComp ? '✓ In Comparison' : 'Add to Comparison';
        });
        const affordSec = $('detailBody').querySelector('.detail-affordability');
        if (affordSec) affordSec.innerHTML = buildAffordabilityHtml(m);
      });
    });
    const dialogFlagBtn = $('detailBody').querySelector('.dialog-compare-bar .flag');
    if (dialogFlagBtn) {
      dialogFlagBtn.addEventListener('click', () => {
        if (review.flags[m.id] || review.flags[modelId]) {
          delete review.flags[m.id];
          delete review.flags[modelId];
        } else {
          review.flags[m.id] = true;
        }
        save();
        const marked = Boolean(review.flags[m.id] || review.flags[modelId]);
        dialogFlagBtn.setAttribute('aria-pressed', String(marked));
        dialogFlagBtn.textContent = marked ? '✓ Marked' : 'Mark for Review';
        render();
      });
    }
    const noteKey = review.notes[m.id] !== undefined ? m.id : (review.notes[m.modelId] !== undefined ? m.modelId : m.id);
    $('note').value = typeof review.notes[noteKey] === 'string' ? review.notes[noteKey] : '';
    $('note').addEventListener('input',() => {
      if ($('note').value.trim()) {
        review.notes[m.id] = $('note').value;
      } else {
        delete review.notes[m.id];
        delete review.notes[m.modelId];
      }
      save();
    });
    $('galleryPrevious').addEventListener('click',() => { imageIndex = Math.max(0,imageIndex-1); gallery(); });
    $('galleryNext').addEventListener('click',() => { imageIndex = Math.min(current.images.length-1,imageIndex+1); gallery(); });

    let isCropping = false, cropDetails = null, workingFrame = null;
    const DRAG_DAMPING = 0.6;
    const pointers = new Map();
    let pinchDist = 0;

    function redrawCrop() {
      const canvas = $('modalCropCanvas');
      if (!canvas || !cropDetails || !workingFrame) return;
      window.__VAHANAIQ_PHOTOS__.renderFrame(canvas, cropDetails.image, cropDetails.spec, workingFrame, { width: 800, height: 500 });
      if ($('modalCropZoomVal')) $('modalCropZoomVal').textContent = `${(workingFrame.zoom || 1).toFixed(2)}×`;
    }

    async function enterCropMode() {
      if (isCropping || !window.__VAHANAIQ_PHOTOS__?.getPhotoDetails) return;
      const target = data?.models?.find(mod => mod.id === (current.modelId || current.id)) || current;
      cropDetails = await window.__VAHANAIQ_PHOTOS__.getPhotoDetails(target, imageIndex);
      if (!cropDetails) {
        window.location.href = `studio.html#model=${encodeURIComponent(target.id)}`;
        return;
      }
      isCropping = true;
      workingFrame = { ...cropDetails.frame };
      pointers.clear();
      pinchDist = 0;
      if ($('galleryControls')) $('galleryControls').hidden = true;
      if ($('galleryToolbar')) $('galleryToolbar').hidden = true;
      if ($('modalCropToolbar')) $('modalCropToolbar').hidden = false;

      const isTall = /suv|pickup|van|crossover|truck|kei/i.test(`${current.body || ""} ${current.name || ""}`);
      $('galleryImage').innerHTML = `<div class="modal-crop-container"><canvas id="modalCropCanvas" width="800" height="500" tabindex="0" role="img" aria-label="Interactive crop canvas. Drag to move, scroll to zoom."></canvas><div class="crop-guides ${isTall ? '' : 'is-low-roof'}" id="modalCropGuides" aria-hidden="true"><div class="guide-grid"><span class="grid-line grid-v grid-v-1"></span><span class="grid-line grid-v grid-v-2"></span><span class="grid-line grid-h grid-h-1"></span><span class="grid-line grid-h grid-h-2"></span></div><div class="guide-margins"><span class="margin-line margin-left"></span><span class="margin-line margin-right"></span></div><div class="guide-line guide-roofline"><span class="guide-label">${isTall ? 'Roofline · 20%' : 'Roofline · 28%'}</span></div><div class="guide-line guide-tyreline"><span class="guide-label">Tyre Baseline</span></div></div></div>`;

      redrawCrop();

      const canvas = $('modalCropCanvas');
      canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const pts = [...pointers.values()];
          pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        }
      });

      canvas.addEventListener('pointermove', e => {
        if (!pointers.has(e.pointerId) || !cropDetails) return;
        const box = canvas.getBoundingClientRect();
        const scale = 800 / Math.max(1, box.width);
        const prev = pointers.get(e.pointerId);

        if (pointers.size >= 2) {
          // Multi-touch pinch & pan
          const pts = [...pointers.values()];
          const prevMidX = (pts[0].x + pts[1].x) / 2;
          const prevMidY = (pts[0].y + pts[1].y) / 2;

          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const nextPts = [...pointers.values()];
          const curDist = Math.hypot(nextPts[0].x - nextPts[1].x, nextPts[0].y - nextPts[1].y);
          const curMidX = (nextPts[0].x + nextPts[1].x) / 2;
          const curMidY = (nextPts[0].y + nextPts[1].y) / 2;

          const anchor = {
            x: (curMidX - box.left) / Math.max(1, box.width),
            y: (curMidY - box.top) / Math.max(1, box.height)
          };
          const src = cropDetails.spec.source || { width: cropDetails.image.naturalWidth, height: cropDetails.image.naturalHeight };

          if (pinchDist > 0 && curDist > 0) {
            const ratio = curDist / pinchDist;
            const pinchFactor = Math.min(1.04, Math.max(0.96, 1 + (ratio - 1) * 0.6));
            workingFrame = window.__VAHANAIQ_PHOTOS__.zoomFrame(src, cropDetails.spec, workingFrame, pinchFactor, anchor);
          }
          pinchDist = curDist;

          const midDx = (curMidX - prevMidX) * scale * DRAG_DAMPING;
          const midDy = (curMidY - prevMidY) * scale * DRAG_DAMPING;
          if (Math.abs(midDx) > 0.01 || Math.abs(midDy) > 0.01) {
            workingFrame = window.__VAHANAIQ_PHOTOS__.dragFrame(src, cropDetails.spec, workingFrame, { width: 800, height: 500 }, midDx, midDy);
          }
          redrawCrop();
          return;
        }

        // Single-pointer drag with damped sensitivity
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const rawDx = e.clientX - prev.x;
        const rawDy = e.clientY - prev.y;
        const dx = rawDx * scale * DRAG_DAMPING;
        const dy = rawDy * scale * DRAG_DAMPING;

        const src = cropDetails.spec.source || { width: cropDetails.image.naturalWidth, height: cropDetails.image.naturalHeight };
        const mode = window.__VAHANAIQ_PHOTOS__.resolveMode
          ? window.__VAHANAIQ_PHOTOS__.resolveMode(workingFrame, cropDetails.spec.background)
          : (workingFrame.mode || 'scene');

        if (mode === 'scene' && (workingFrame.zoom || 1) <= 1.01 && Math.abs(src.width / src.height - 1.6) < 0.02 && Math.hypot(rawDx, rawDy) >= 2) {
          workingFrame = { ...workingFrame, zoom: 1.06 };
        }
        workingFrame = window.__VAHANAIQ_PHOTOS__.dragFrame(
          src,
          cropDetails.spec,
          workingFrame,
          { width: 800, height: 500 },
          dx, dy
        );
        redrawCrop();
      });

      const endPointer = e => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchDist = 0;
      };
      canvas.addEventListener('pointerup', endPointer);
      canvas.addEventListener('pointercancel', endPointer);

      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        if (!cropDetails) return;
        const box = canvas.getBoundingClientRect();
        const anchor = {
          x: (e.clientX - box.left) / Math.max(1, box.width),
          y: (e.clientY - box.top) / Math.max(1, box.height)
        };
        let factor;
        if (e.ctrlKey) {
          // Trackpad pinch-to-zoom: smooth continuous exponential scaling
          const delta = Math.max(-25, Math.min(25, e.deltaY));
          factor = Math.exp(-delta * 0.0035);
        } else if (e.deltaMode !== 0 || Math.abs(e.deltaY) >= 40) {
          // Discrete mouse wheel notch: gentle 3.5% step
          factor = e.deltaY < 0 ? 1.035 : 1 / 1.035;
        } else {
          // Continuous trackpad scroll: gentle exponential scaling
          const delta = Math.max(-15, Math.min(15, e.deltaY));
          factor = Math.exp(-delta * 0.002);
        }
        workingFrame = window.__VAHANAIQ_PHOTOS__.zoomFrame(
          cropDetails.spec.source || { width: cropDetails.image.naturalWidth, height: cropDetails.image.naturalHeight },
          cropDetails.spec,
          workingFrame,
          factor,
          anchor
        );
        redrawCrop();
      }, { passive: false });
    }

    function exitCropMode() {
      isCropping = false;
      if (cropDetails?.objectUrl) {
        URL.revokeObjectURL(cropDetails.objectUrl);
      }
      cropDetails = null;
      workingFrame = null;
      pointers.clear();
      pinchDist = 0;
      if ($('galleryControls')) $('galleryControls').hidden = false;
      if ($('galleryToolbar')) $('galleryToolbar').hidden = false;
      if ($('modalCropToolbar')) $('modalCropToolbar').hidden = true;
      gallery();
    }

    $('galleryCropBtn')?.addEventListener('click', enterCropMode);

    $('modalCropFitBtn')?.addEventListener('click', () => {
      if (!cropDetails || !workingFrame) return;
      workingFrame = window.__VAHANAIQ_PHOTOS__.fillFrame(cropDetails.spec.source, cropDetails.spec, workingFrame);
      redrawCrop();
    });

    $('modalCropCentreBtn')?.addEventListener('click', () => {
      if (!workingFrame) return;
      workingFrame.focusX = 0.5;
      workingFrame.focusY = 0.5;
      redrawCrop();
    });

    $('modalCropZoomOut')?.addEventListener('click', () => {
      if (!cropDetails || !workingFrame) return;
      workingFrame = window.__VAHANAIQ_PHOTOS__.zoomFrame(cropDetails.spec.source, cropDetails.spec, workingFrame, 1 / 1.08);
      redrawCrop();
    });

    $('modalCropZoomIn')?.addEventListener('click', () => {
      if (!cropDetails || !workingFrame) return;
      workingFrame = window.__VAHANAIQ_PHOTOS__.zoomFrame(cropDetails.spec.source, cropDetails.spec, workingFrame, 1.08);
      redrawCrop();
    });

    $('modalCropCancelBtn')?.addEventListener('click', exitCropMode);

    $('modalCropDoneBtn')?.addEventListener('click', async () => {
      if (!cropDetails || !workingFrame) { exitCropMode(); return; }
      const target = data?.models?.find(mod => mod.id === (current.modelId || current.id)) || current;
      const res = await window.__VAHANAIQ_PHOTOS__.updateFrame(target, imageIndex, workingFrame);
      if (res?.success) {
        current.images = res.images;
        cards.filter(c => (c.modelId || c.id) === target.id).forEach(c => { c.images = res.images; });
        render();
        toast("Framing saved.");
      }
      exitCropMode();
    });

    $('galleryMakeCoverBtn')?.addEventListener('click', async () => {
      const studio = window.__VAHANAIQ_PHOTOS__;
      if (!studio?.setCover) return;
      const target = data?.models?.find(mod => mod.id === (current.modelId || current.id)) || current;
      const res = await studio.setCover(target, imageIndex);
      if (res?.success) {
        current.images = res.images;
        cards.filter(c => (c.modelId || c.id) === target.id).forEach(c => { c.images = res.images; });
        imageIndex = 0;
        gallery();
        render();
        toast("That photo is now the cover.");
      }
    });

    $('galleryRemoveBtn')?.addEventListener('click', async () => {
      if (current.images.length < 2) return;
      if (!globalThis.confirm("Remove this photo from this vehicle?")) return;
      const studio = window.__VAHANAIQ_PHOTOS__;
      if (!studio?.removePhoto) return;
      const target = data?.models?.find(mod => mod.id === (current.modelId || current.id)) || current;
      const res = await studio.removePhoto(target, imageIndex);
      if (res?.success) {
        current.images = res.images;
        cards.filter(c => (c.modelId || c.id) === target.id).forEach(c => { c.images = res.images; });
        imageIndex = Math.min(imageIndex, current.images.length - 1);
        gallery();
        render();
        toast("Photo removed.");
      } else if (res?.error) {
        toast(res.error);
      }
    });

    $('galleryUndoBtn')?.addEventListener('click', async () => {
      if (!globalThis.confirm("Revert this vehicle to its original published photos?")) return;
      const studio = window.__VAHANAIQ_PHOTOS__;
      if (!studio?.resetModel) return;
      const target = data?.models?.find(mod => mod.id === (current.modelId || current.id)) || current;
      const res = await studio.resetModel(target);
      if (res?.success) {
        current.images = res.images;
        cards.filter(c => (c.modelId || c.id) === target.id).forEach(c => { c.images = res.images; });
        imageIndex = 0;
        gallery();
        render();
        toast("Restored published photos.");
      }
    });
    gallery(); $('detail').showModal(); $('closeDetail').focus();
  }

  $('vehicles').addEventListener('click',e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.open) { const m = cards.find(m => m.id === b.dataset.open); if (m) open(m,b); }
    if (b.dataset.compare) {
      const id = b.dataset.compare;
      const card = cards.find(c => c.id === id);
      if (card) toggleComparison(card);
    }
    if (b.dataset.flag) {
      const id = b.dataset.flag;
      const card = cards.find(c => c.id === id);
      const modelId = card?.modelId || id;
      if (review.flags[id] || review.flags[modelId]) {
        delete review.flags[id];
        delete review.flags[modelId];
      } else {
        review.flags[id] = true;
      }
      save(); render();
      const replacement = [...$('vehicles').querySelectorAll('[data-flag]')].find(x => x.dataset.flag === id);
      (replacement || $('reviewFilter')).focus();
    }
  });

  if ($('reviewBar')) {
    $('reviewBar').addEventListener('click', e => {
      const b = e.target.closest('button[data-afford-select]');
      if (b) {
        const id = b.dataset.affordSelect;
        const card = cards.find(c => c.id === id);
        if (card) {
          selectedAffordabilityVehicle = card;
          renderAffordabilityPanel();
        }
      }
    });
  }

  $('closeDetail').addEventListener('click',() => $('detail').close());
  $('detail').addEventListener('close',() => { render(); const id = current?.id; current = null; const replacement = [...$('vehicles').querySelectorAll('[data-open]')].find(x => x.dataset.open === id); (replacement || opener || $('reviewFilter')).focus(); });
  $('closeGuide').addEventListener('click',() => $('guide').close());
  function transitionNavigate(href) {
    const main = document.querySelector('main');
    if (main) main.classList.add('page-exit');
    setTimeout(() => { window.location.href = href; }, 180);
  }
  if ($('addVehicleBtn')) $('addVehicleBtn').addEventListener('click', () => transitionNavigate('index.html#openAdd'));
  if ($('accountBtn')) $('accountBtn').addEventListener('click', () => transitionNavigate('index.html#account'));
  if ($('printBtn')) $('printBtn').addEventListener('click', () => { window.print(); });

  function applyTheme(choice) {
    const root = document.documentElement;
    if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
    else root.removeAttribute('data-theme');
    const radio = document.querySelector(`input[name="theme"][value="${choice}"]`);
    if (radio) radio.checked = true;
  }
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('vahanaiq_theme'); } catch (e) {}
  applyTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'system');
  document.addEventListener('change', e => {
    if (e.target.name !== 'theme') return;
    const choice = e.target.value;
    try {
      if (choice === 'system') localStorage.removeItem('vahanaiq_theme');
      else localStorage.setItem('vahanaiq_theme', choice);
    } catch (err) {}
    applyTheme(choice);
  });

  const themeSwitchEl = $('themeSwitch');
  if (themeSwitchEl) {
    themeSwitchEl.addEventListener('change', e => {
      const radio = themeSwitchEl.querySelector('input[name="theme"]:checked');
      if (!radio) return;
      const choice = radio.value;
      try {
        if (choice === 'system') localStorage.removeItem('vahanaiq_theme');
        else localStorage.setItem('vahanaiq_theme', choice);
      } catch (err) {}
      applyTheme(choice);
    });
    themeSwitchEl.addEventListener('click', e => {
      const label = e.target.closest('label');
      if (!label) return;
      const input = label.querySelector('input[name="theme"]');
      if (input && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  // Source guidance opens from the footer link, which is always in the page.
  if ($('footerSourceGuide')) $('footerSourceGuide').addEventListener('click', () => $('guide').showModal());
  ['search','make','body','priceType','sort'].forEach(id => { const el = $(id); if (!el) return; const handler = () => { if (!data) return; if ($('vehicles')) $('vehicles').classList.remove('initial-load'); page = 0; render(); }; el.addEventListener('input', handler); el.addEventListener('change', handler); });
  $('clear').addEventListener('click',() => { if (!data) return; if ($('vehicles')) $('vehicles').classList.remove('initial-load'); for (const id of ['search','make','body','priceType']) $(id).value = ''; $('sort').value = 'make'; reviewOnly = false; page = 0; render(); });
  $('reviewFilter').addEventListener('click',() => { if (!data) return; if ($('vehicles')) $('vehicles').classList.remove('initial-load'); reviewOnly = !reviewOnly; page = 0; render(); });
  function turn(delta) { if ($('vehicles')) $('vehicles').classList.remove('initial-load'); page += delta; render(); $('vehicles').scrollIntoView({block:'start'}); $('vehicles').focus({preventScroll:true}); }
  $('previous').addEventListener('click',() => turn(-1)); $('next').addEventListener('click',() => turn(1));
  $('export').addEventListener('click',() => {
    if (!cards.length) return;
    const entries = cards.filter(m => review.flags[m.id] || review.flags[m.modelId] || review.notes[m.id] || review.notes[m.modelId] || isCarInComparison(m)).map(m => ({
      id: m.id,
      name: `${m.make} ${shortName(m).replace(/\s+(202[0-9])$/, '')} ${m.cardYear}`,
      marked: Boolean(review.flags[m.id] || review.flags[m.modelId]),
      inComparison: isCarInComparison(m),
      note: review.notes[m.id] || review.notes[m.modelId] || ''
    }));
    const blob = new Blob([JSON.stringify({catalogueDate:data.checkedOn,exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'vahanaiq-catalogue-review.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); toast(`Exported ${entries.length} Review Entries`);
  });
  $('copyrightYear').textContent = String(new Date().getFullYear());

  async function load() {
    try {
      data = window.__VAHANAIQ_CATALOGUE__ || null;
      identity = window.__VAHANAIQ_IDENTITY__ || {};
      if (!data || !Object.keys(identity).length) {
        try {
          if (!data) {
            const response = await fetch('data/catalogue.json');
            if (response.ok) data = await response.json();
          }
          if (!Object.keys(identity).length) {
            const r = await fetch('data/identity.json');
            if (r.ok) identity = await r.json();
          }
        } catch {}
      }
      if (!data) throw new Error('Catalogue unavailable');
      // Photos arranged in the Photo Studio (js/catalogue-photo-overlay.js) replace the published ones for
      // the entries they cover, before any card is built. The overlay is waited for at most briefly: a
      // module that never loads must not keep the catalogue off the page.
      try {
        const studio = window.__VAHANAIQ_PHOTOS__;
        let applyStudioPhotos = studio ? studio.apply : null;
        if (studio && !applyStudioPhotos) {
          applyStudioPhotos = await Promise.race([
            studio.ready,
            new Promise(resolve => setTimeout(() => resolve(null), 2000))
          ]);
        }
        if (applyStudioPhotos) await applyStudioPhotos(data);
      } catch {}
      cards = buildCards(data.models);
      for (const [id,key] of [['make','make'],['body','body']]) $(id).innerHTML += [...new Set(cards.map(m => m[key]))].sort().map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
      $('metrics').innerHTML = [[cards.length,'Vehicles'],[cards.filter(m => priced(m).length).length,'With Published Prices'],[new Set(cards.map(m => m.make)).size,'Makes']].map(([n,label]) => `<div><strong>${n}</strong><span>${label}</span></div>`).join('');
      if ($('vehicles')) $('vehicles').classList.add('initial-load');
      render();
      const hashModel = (location.hash.match(/^#model=([a-z0-9-]+)$/) || [])[1];
      if (hashModel) {
        const targetCard = cards.find(c => c.id === hashModel || c.modelId === hashModel);
        if (targetCard) open(targetCard);
      }
    } catch { $('resultCount').textContent = 'Catalogue Unavailable'; $('vehicles').innerHTML = '<div class="load-error"><h3>The Catalogue Could Not Be Loaded</h3><p>Please refresh the page to try again.</p></div>'; $('previous').disabled = true; $('next').disabled = true; }
  }
  window.addEventListener('hashchange', () => {
    const hashModel = (location.hash.match(/^#model=([a-z0-9-]+)$/) || [])[1];
    if (hashModel && cards.length) {
      const targetCard = cards.find(c => c.id === hashModel || c.modelId === hashModel);
      if (targetCard) open(targetCard);
    }
  });
  document.addEventListener('error',e => { if (e.target instanceof HTMLImageElement) { const frame = e.target.closest('.photo-button,.photo-frame'); if (frame) { e.target.hidden = true; const label = document.createElement('span'); label.className = 'error-art'; label.textContent = 'Image Unavailable · Open Photo Source'; frame.append(label); } else e.target.hidden = true; } },true);
  load();
})();
