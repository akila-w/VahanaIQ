// Only explicitly reviewed observations belong in this dataset. Current offers are not history.
export function observationError(o) {
  if (!o || !['modelId','offerId','seriesId','sourceUrl'].every(k => typeof o[k]==='string' && o[k].length>0)) return 'Missing series identity or source';
  if (!/^https:\/\//.test(o.sourceUrl)) return 'Expected HTTPS source';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.observedOn) || Number.isNaN(Date.parse(o.observedOn+'T00:00:00Z')) || new Date(o.observedOn+'T00:00:00Z').toISOString().slice(0,10)!==o.observedOn) return 'Invalid observation date';
  if (o.currency!=='LKR' || !Number.isFinite(o.amount) || o.amount<=0 || o.amount>=1e15) return 'Invalid LKR amount';
  if (!['official','dealer'].includes(o.kind) || o.reviewed!==true) return 'Only reviewed distributor or asking prices are eligible';
  if (!['year','trim','condition','route'].every(k => typeof o[k]==='string' && o[k].trim())) return 'Variant identity must be explicit';
  return '';
}
export function historySeries(observations, modelId) {
  const groups=new Map();
  for(const o of observations) {
    if(observationError(o)||o.modelId!==modelId)continue;
    const key=JSON.stringify([o.seriesId,o.year,o.trim,o.condition,o.route,o.kind,o.sourceUrl]);
    if(!groups.has(key))groups.set(key,[]); groups.get(key).push(o);
  }
  return [...groups.values()].map(points=>points.sort((a,b)=>a.observedOn.localeCompare(b.observedOn))).filter(points=>new Set(points.map(p=>p.observedOn)).size===points.length);
}
export function priceChange(points) {
  if(points.length<2)return null;
  const first=points[0],last=points.at(-1);
  return {amount:last.amount-first.amount,percent:(last.amount-first.amount)/first.amount*100,from:first.observedOn,to:last.observedOn};
}
export function mountPriceHistory(parent, modelId, observations) {
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const section=el('section');section.className='price-history';section.setAttribute('aria-label','Recorded price history');section.append(el('h3','Recorded price history'));
  const series=historySeries(observations,modelId);
  if(!series.length){section.append(el('p','Price history is being collected. There are no verified historical observations for this vehicle yet.'),el('p','Current offers and launch prices are shown above. They are not evidence of a market trend.'));parent.append(section);return;}
  const select=el('select');select.setAttribute('aria-label','Price history purchase option');
  series.forEach((points,i)=>{const p=points[0];const option=el('option',`${p.trim} · ${p.year} · ${p.condition} · ${p.route} · ${p.kind==='dealer'?'Asking price':'Distributor price'}`);option.value=i;select.append(option);});
  const output=el('div');section.append(select,output);parent.append(section);
  const date=d=>d.split('-').reverse().join('/');const money=n=>'LKR '+n.toLocaleString('en-LK');
  function render(){
    output.replaceChildren();const points=series[Number(select.value)];const change=priceChange(points);
    output.append(el('p',change?`${change.percent>=0?'+':''}${change.percent.toFixed(1)}% (${money(change.amount)}) from ${date(change.from)} to ${date(change.to)}. Recorded prices, not completed sales.`:'One recorded observation. A trend needs at least two comparable dates.'));
    if (change) {
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 600 180');svg.setAttribute('role','img');
      svg.setAttribute('aria-label','Recorded price movement over the dates listed in the table. Vertical scale follows the observed price range.');
      const amounts=points.map(p=>p.amount), low=Math.min(...amounts), high=Math.max(...amounts);
      const start=Date.parse(points[0].observedOn), span=Date.parse(points.at(-1).observedOn)-start;
      const line=document.createElementNS(svg.namespaceURI,'polyline');
      line.setAttribute('points',points.map(p=>`${20+(Date.parse(p.observedOn)-start)/span*560},${high===low?90:160-(p.amount-low)/(high-low)*140}`).join(' '));
      line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','3');
      svg.append(line);output.append(svg);
    }
    const scroll=el('div');scroll.className='history-scroll';const table=el('table');const caption=el('caption','Comparable recorded prices in LKR');table.append(caption);const head=el('thead');const row=el('tr');['Observed','Price','Source'].forEach(t=>{const th=el('th',t);th.scope='col';row.append(th);});head.append(row);table.append(head);const tbody=el('tbody');
    for(const p of points){const tr=el('tr');tr.append(el('td',date(p.observedOn)),el('td',money(p.amount)));const source=el('td');const a=el('a','View source');a.href=p.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';source.append(a);tr.append(source);tbody.append(tr);}table.append(tbody);scroll.append(table);output.append(scroll);
  }select.onchange=render;render();
}
