'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? esc(u.href) : '#'; } catch { return '#'; } };
  const money = n => 'LKR ' + n.toLocaleString('en-LK', {maximumFractionDigits:0});
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'Date Not Specified';
  const kinds = {official:'Distributor Price',dealer:'Dealer Asking Price',launch:'Published Launch Price',estimated:'Estimated Price',quote:'Price on Request'};
  let data, identity = {}, page = 0, reviewOnly = false, current = null, imageIndex = 0, opener = null;
  const size = 18;
  let review = {flags:{},notes:{}};
  try {
    const saved = JSON.parse(localStorage.getItem('vahanaiq_curated_review_v1') || '{}');
    if (saved && typeof saved === 'object') {
      review.flags = saved.flags && typeof saved.flags === 'object' && !Array.isArray(saved.flags) ? saved.flags : {};
      review.notes = saved.notes && typeof saved.notes === 'object' && !Array.isArray(saved.notes) ? saved.notes : {};
    }
  } catch {}
  function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 3500); }
  function save() { try { localStorage.setItem('vahanaiq_curated_review_v1',JSON.stringify(review)); } catch { toast('Browser storage is unavailable. Export your review to keep it.'); } }
  const priced = m => m.offers.filter(o => Number.isFinite(o.amount) && o.amount > 0);
  const lowest = m => priced(m).reduce((best,o) => !best || o.amount < best.amount ? o : best, null);
  const shortName = m => m.name.startsWith(m.make+' ') ? m.name.slice(m.make.length+1) : m.model;
  function mark(m) { const path = identity.brands?.[m.make]?.localPath; return path ? `<img class="make-logo ${['BYD','Leapmotor'].includes(m.make)?'dark':''}" src="${esc(path.replace('../',''))}" alt="" width="26" height="22">` : ''; }
  function photo(p, name, eager = false) { return `<img src="${esc(p.smallSrc)}" srcset="${esc(p.smallSrc)} 640w, ${esc(p.src)} 1280w" sizes="(max-width:650px) calc(100vw - 36px), (max-width:1020px) 44vw, 29vw" width="1280" height="800" alt="${esc(name)} — official manufacturer image" loading="${eager?'eager':'lazy'}" decoding="async">`; }
  function list() {
    const q = $('search').value.trim().toLowerCase(), type = $('priceType').value;
    let result = data.models.filter(m => (!$('make').value || m.make === $('make').value) && (!$('body').value || m.body === $('body').value) && (!reviewOnly || review.flags[m.id] || review.notes[m.id]) && (!q || [m.name,m.body,...m.offers.flatMap(o => [o.name,o.trim,o.year,o.fuel])].join(' ').toLowerCase().includes(q)) && (!type || type === 'priced' && priced(m).length || type === 'quote' && !priced(m).length || ['official','dealer','launch','estimated'].includes(type) && m.offers.some(o => o.kind === type && o.amount)));
    const sort = $('sort').value;
    return result.sort((a,b) => {
      const x = lowest(a)?.amount, y = lowest(b)?.amount;
      if (sort !== 'make') { if (x === undefined && y !== undefined) return 1; if (y === undefined && x !== undefined) return -1; if (x !== undefined && y !== undefined && x !== y) return sort === 'low' ? x-y : y-x; }
      return a.name.localeCompare(b.name);
    });
  }
  function render() {
    const all = list(); page = Math.max(0, Math.min(page, Math.ceil(all.length/size)-1));
    $('resultCount').textContent = `${all.length} ${all.length===1?'Model':'Models'} · ${all.reduce((n,m) => n+m.offers.length,0)} Purchase Options`;
    $('reviewCount').textContent = '('+data.models.filter(m => review.flags[m.id] || review.notes[m.id]).length+')';
    $('reviewFilter').setAttribute('aria-pressed',String(reviewOnly));
    $('vehicles').innerHTML = all.slice(page*size,page*size+size).map((m,i) => {
      const p = m.images[0], low = lowest(m), fuels = [...new Set(m.offers.map(o => o.fuel).filter(Boolean))];
      return `<article class="card"><button class="photo-button" data-open="${esc(m.id)}" aria-label="View ${esc(m.name)}">${photo(p,m.name,i<3)}${m.images.length>1?`<span class="photo-count">${m.images.length} Views</span>`:''}</button><div class="card-body"><p class="make-line">${mark(m)}${esc(m.make)}</p><h3>${esc(shortName(m))}</h3><div class="card-meta"><span><img src="assets/icons/lucide/car.svg" alt="">${esc(m.body)}</span>${fuels.length?`<span><img src="assets/icons/lucide/fuel.svg" alt="">${esc(fuels.join(' / '))}</span>`:''}</div><div class="price-area"><p class="price ${low?'':'quote'}">${low?`${priced(m).length>1?'From ':''}${money(low.amount)}`:'Price on Request'}</p><p class="price-label">${low?`${kinds[low.kind]}${low.year?' · '+low.year:''}`:'Request a Matching Current Quotation'}</p></div><div class="sources"><a href="${safeUrl(p.sourcePage)}" target="_blank" rel="noopener noreferrer" title="${esc(m.make)} · Official Website · Rights Reserved">Photo Source ↗</a>${low?`<a href="${safeUrl(low.sourceUrl)}" target="_blank" rel="noopener noreferrer">Price Source ↗</a>`:''}</div><div class="card-actions"><button data-open="${esc(m.id)}">${m.offers.length>1?'Compare Purchase Options':'View Details'} <span aria-hidden="true">↗</span></button><button class="flag" data-flag="${esc(m.id)}" aria-label="Mark ${esc(m.name)} for review" aria-pressed="${Boolean(review.flags[m.id])}">${review.flags[m.id]?'✓ Marked':'Mark for Review'}</button></div></div></article>`;
    }).join('') || '<div class="empty"><h3>No Vehicles Found</h3><p>Try a different search or reset the filters.</p></div>';
    $('pageCount').textContent = `${all.length?page+1:0} / ${Math.ceil(all.length/size)}`;
    $('previous').disabled = page === 0; $('next').disabled = (page+1)*size >= all.length;
  }
  function gallery() {
    const p = current.images[imageIndex];
    $('galleryImage').innerHTML = photo(p,current.name,true);
    $('galleryPosition').textContent = `${imageIndex+1} of ${current.images.length}`;
    $('gallerySource').href = p.sourcePage; $('galleryOriginal').href = p.url;
    $('photoNote').textContent = p.note;
    $('galleryPrevious').disabled = imageIndex === 0; $('galleryNext').disabled = imageIndex === current.images.length-1;
  }
  function open(m, button) {
    current = m; imageIndex = 0; opener = button;
    $('detailMake').textContent = m.make; $('detailTitle').textContent = shortName(m);
    $('detailBody').innerHTML = `<div class="detail-layout"><section class="detail-gallery" aria-label="Official Vehicle Images"><div class="photo-frame" id="galleryImage"></div><div class="gallery-controls"><button id="galleryPrevious" aria-label="Previous Photo">←</button><span id="galleryPosition" role="status"></span><button id="galleryNext" aria-label="Next Photo">→</button></div><div class="sources gallery-source"><a id="gallerySource" target="_blank" rel="noopener noreferrer">Photo Source ↗</a><a id="galleryOriginal" target="_blank" rel="noopener noreferrer">Original Image ↗</a></div><p class="photo-note" id="photoNote"></p></section><section aria-label="Purchase Options"><h3>Purchase Options</h3><div class="offer-stack">${m.offers.map(o => `<article class="offer"><span class="tag ${esc(o.kind)}">${esc(kinds[o.kind])}</span><h3>${esc(o.name)}</h3><p class="offer-meta">${esc([o.trim,o.year,o.condition,o.route].filter(Boolean).join(' · '))}</p><p class="price ${o.amount?'':'quote'}">${o.amount?money(o.amount):'Price on Request'}</p><p class="offer-meta">Checked ${date(o.checkedOn)}${o.sourcePublishedOn?' · Published '+date(o.sourcePublishedOn):''}</p>${o.note?`<p class="offer-note">${esc(o.note)}</p>`:''}<a href="${safeUrl(o.sourceUrl)}" target="_blank" rel="noopener noreferrer">${o.amount?'View Price Source':'Visit Source / Request a Quote'} ↗</a>${o.image?`<img class="variant-image" src="${esc(o.image.smallSrc)}" width="640" height="400" alt="${esc(o.name)}"><p class="photo-note">${esc(o.image.caption || 'Japanese Market Image')} · <a href="${safeUrl(o.image.sourcePage)}" target="_blank" rel="noopener noreferrer">Photo Source ↗</a></p>`:''}</article>`).join('')}</div></section></div><div class="review-note"><label for="note">Your Review Note</label><textarea id="note" maxlength="3000" placeholder="Anything you would like changed for this vehicle…"></textarea><p>Saved locally in this browser. Included when you export your review.</p></div>`;
    $('note').value = typeof review.notes[m.id] === 'string' ? review.notes[m.id] : '';
    $('note').addEventListener('input',() => { if ($('note').value.trim()) review.notes[m.id] = $('note').value; else delete review.notes[m.id]; save(); });
    $('galleryPrevious').addEventListener('click',() => { imageIndex = Math.max(0,imageIndex-1); gallery(); });
    $('galleryNext').addEventListener('click',() => { imageIndex = Math.min(current.images.length-1,imageIndex+1); gallery(); });
    gallery(); $('detail').showModal(); $('closeDetail').focus();
  }
  $('vehicles').addEventListener('click',e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.open) { const m = data.models.find(m => m.id === b.dataset.open); if (m) open(m,b); }
    if (b.dataset.flag) { const id = b.dataset.flag; if (review.flags[id]) delete review.flags[id]; else review.flags[id] = true; save(); render(); const replacement = [...$('vehicles').querySelectorAll('[data-flag]')].find(x => x.dataset.flag === id); (replacement || $('reviewFilter')).focus(); }
  });
  $('closeDetail').addEventListener('click',() => $('detail').close());
  $('detail').addEventListener('close',() => { render(); const id = current?.id; current = null; const replacement = [...$('vehicles').querySelectorAll('[data-open]')].find(x => x.dataset.open === id); (replacement || opener || $('reviewFilter')).focus(); });
  $('sourceGuide').addEventListener('click',() => $('guide').showModal());
  $('closeGuide').addEventListener('click',() => $('guide').close());
  // Source guidance is also available on small screens through the footer.
  const guideLink = document.createElement('button'); guideLink.className = 'quiet'; guideLink.textContent = 'Source Guide'; guideLink.addEventListener('click',() => $('guide').showModal()); document.querySelector('footer>div').append(guideLink);
  for (const id of ['search','make','body','priceType','sort']) $(id).addEventListener(id === 'search' ? 'input' : 'change',() => { if (!data) return; page = 0; render(); });
  $('clear').addEventListener('click',() => { if (!data) return; for (const id of ['search','make','body','priceType']) $(id).value = ''; $('sort').value = 'make'; reviewOnly = false; page = 0; render(); });
  $('reviewFilter').addEventListener('click',() => { if (!data) return; reviewOnly = !reviewOnly; page = 0; render(); });
  function turn(delta) { page += delta; render(); $('vehicles').scrollIntoView({block:'start'}); $('vehicles').focus({preventScroll:true}); }
  $('previous').addEventListener('click',() => turn(-1)); $('next').addEventListener('click',() => turn(1));
  $('export').addEventListener('click',() => {
    if (!data) return;
    const entries = data.models.filter(m => review.flags[m.id] || review.notes[m.id]).map(m => ({id:m.id,name:m.name,marked:Boolean(review.flags[m.id]),note:review.notes[m.id] || ''}));
    const blob = new Blob([JSON.stringify({catalogueDate:data.checkedOn,exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'vahanaiq-catalogue-review.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); toast(`Exported ${entries.length} Review Entries`);
  });
  $('copyrightYear').textContent = String(new Date().getFullYear());
  async function load() {
    try {
      // js/catalogue-data.js bakes in the same records as data/catalogue.json, so a normal visit
      // needs no extra request; the published JSON is the fallback (and is what people download).
      // scripts/build-catalogue-data.mjs regenerates the baked copy, and
      // test/catalogue-data.test.mjs fails if the two ever drift apart.
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
      for (const [id,key] of [['make','make'],['body','body']]) $(id).innerHTML += [...new Set(data.models.map(m => m[key]))].sort().map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
      $('metrics').innerHTML = [[data.models.length,'Models'],[data.models.filter(m => priced(m).length).length,'With Published Prices'],[new Set(data.models.map(m => m.make)).size,'Makes']].map(([n,label]) => `<div><strong>${n}</strong><span>${label}</span></div>`).join('');
      render();
    } catch { $('resultCount').textContent = 'Catalogue Unavailable'; $('vehicles').innerHTML = '<div class="load-error"><h3>The Catalogue Could Not Be Loaded</h3><p>Please refresh the page to try again.</p></div>'; $('previous').disabled = true; $('next').disabled = true; }
  }
  document.addEventListener('error',e => { if (e.target instanceof HTMLImageElement) { const frame = e.target.closest('.photo-button,.photo-frame'); if (frame) { e.target.hidden = true; const label = document.createElement('span'); label.className = 'error-art'; label.textContent = 'Image Unavailable · Open Photo Source'; frame.append(label); } else e.target.hidden = true; } },true);
  load();
})();
