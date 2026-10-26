import { formatDate, dateInputValue } from './dates.js?v=2.12.0';
import { addMonths } from './savings.js?v=2.12.0';
export { dateInputValue } from './dates.js?v=2.12.0';
const isoDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const months=Array.from({length:12},(_,i)=>new Date(2026,i,1).toLocaleDateString('en-GB',{month:'long'}));
export function attachDatePicker(input, button) {
  const dialog=document.createElement('dialog');dialog.className='date-dialog';
  dialog.setAttribute('aria-labelledby','calendarTitle');dialog.setAttribute('aria-describedby','calendarHelp');
  dialog.innerHTML='<div class="calendar-heading"><h2 id="calendarTitle">Choose a Target Date</h2><button class="close-btn" type="button" data-calendar-close aria-label="Close Calendar">×</button></div><div class="calendar-nav"><button class="btn-outline" type="button" data-calendar-prev aria-label="Previous Month">‹</button><label class="sr-only" for="calendarMonth">Month</label><select id="calendarMonth"></select><label class="sr-only" for="calendarYear">Year</label><select id="calendarYear"></select><button class="btn-outline" type="button" data-calendar-next aria-label="Next Month">›</button></div><p id="calendarMonthTitle" class="sr-only" aria-live="polite"></p><table class="calendar-grid" role="grid" aria-labelledby="calendarMonthTitle"><thead><tr>'+['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=>'<th scope="col" abbr="'+d+'">'+d.slice(0,2)+'</th>').join('')+'</tr></thead><tbody></tbody></table><p class="hint" id="calendarHelp">Arrow keys move by day or week. Page Up/Down changes month. Escape closes.</p><div class="calendar-actions"><button class="link-btn" type="button" data-calendar-clear>Clear Date</button><button class="btn-outline" type="button" data-calendar-close>Cancel</button></div>';
  document.body.append(dialog);
  const $=s=>dialog.querySelector(s),month=$('#calendarMonth'),year=$('#calendarYear'),body=$('tbody');
  let today,focus,chosen='';
  month.innerHTML=months.map((name,i)=>'<option value="'+i+'">'+name+'</option>').join('');
  const present=()=>{const iso=dateInputValue(input.value);if(iso&&formatDate(iso)!=='Date unavailable')input.value=formatDate(iso,{numeric:true});button.setAttribute('aria-label',iso&&formatDate(iso)!=='Date unavailable'?'Change Target Date, '+formatDate(iso):'Choose Target Date');};
  const close=()=>dialog.close();
  function render(moveFocus=false) {
    const minDate=addMonths(today,1);
    const y=focus.getFullYear(),m=focus.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,last=new Date(y,m+1,0).getDate();
    month.value=String(m);year.value=String(y);$('#calendarMonthTitle').textContent=months[m]+' '+y;
    let html='';
    for(let row=0;row<Math.ceil((offset+last)/7);row++) {
      html+='<tr>';
      for(let col=0;col<7;col++) {
        const day=row*7+col-offset+1;
        if(day<1||day>last){html+='<td></td>';continue;}
        const d=new Date(y,m,day,12),iso=isoDate(d),disabled=d<minDate;
        html+='<td'+(iso===chosen?' aria-selected="true"':'')+'><button type="button" data-date="'+iso+'" aria-label="'+formatDate(iso)+'"'+(iso===isoDate(today)?' aria-current="date"':'')+' tabindex="'+(!disabled&&day===focus.getDate()?'0':'-1')+'"'+(disabled?' disabled':'')+'>'+day+'</button></td>';
      }
      html+='</tr>';
    }
    body.innerHTML=html;
    if(moveFocus)body.querySelector('[tabindex="0"]')?.focus();
  }
  function moveMonth(count) { focus=addMonths(focus,count);const minDate=addMonths(today,1);if(focus<minDate)focus=new Date(minDate);render(true); }
  function apply(value){input.value=value?formatDate(value,{numeric:true}):'';input.dispatchEvent(new Event('input',{bubbles:true}));present();close();}
  input.addEventListener('blur',present);
  button.addEventListener('click',()=>{
    today=new Date();today.setHours(12,0,0,0);chosen=dateInputValue(input.value);
    const minDate=addMonths(today,1);
    focus=/^\d{4}-\d{2}-\d{2}$/.test(chosen)&&formatDate(chosen)!=='Date unavailable'?new Date(chosen+'T12:00:00'):new Date(minDate);
    if(focus<minDate)focus=new Date(minDate);
    const firstYear=minDate.getFullYear(),lastYear=Math.max(firstYear+100,focus.getFullYear());
    year.innerHTML=Array.from({length:lastYear-firstYear+1},(_,i)=>'<option>'+String(firstYear+i)+'</option>').join('');
    render();dialog.showModal();body.querySelector('[tabindex="0"]')?.focus();
  });
  dialog.addEventListener('close',()=>button.focus());
  dialog.addEventListener('click',e=>{
    if(e.target.closest('[data-calendar-close]'))close();
    else if(e.target.closest('[data-calendar-clear]'))apply('');
    else if(e.target.closest('[data-calendar-prev]'))moveMonth(-1);
    else if(e.target.closest('[data-calendar-next]'))moveMonth(1);
    else if(e.target.closest('[data-date]'))apply(e.target.closest('[data-date]').dataset.date);
  });
  for(const el of [month,year])el.addEventListener('change',()=>{const minDate=addMonths(today,1);focus=new Date(Number(year.value),Number(month.value),1,12);if(focus<minDate)focus=new Date(minDate);render(true);});
  body.addEventListener('keydown',e=>{
    if(!e.target.matches('[data-date]'))return;
    const minDate=addMonths(today,1);
    const day=(focus.getDay()+6)%7,delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-day,End:6-day}[e.key];
    if(delta!==undefined){e.preventDefault();focus.setDate(focus.getDate()+delta);if(focus<minDate)focus=new Date(minDate);render(true);}
    else if(['PageUp','PageDown'].includes(e.key)){e.preventDefault();moveMonth((e.key==='PageUp'?-1:1)*(e.shiftKey?12:1));}
  });
  window.addEventListener('vahanaiq:copy-reset',()=>{if(dialog.open)dialog.close();});
  present();
}
