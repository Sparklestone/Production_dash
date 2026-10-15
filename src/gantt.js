import {addDays} from './live-calendar.js';
import {isWeekend} from './schedule.js';

const dayFmt=(k,opts)=>new Date(k+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',...opts});

// Weekday axis for one range mode. Columns group days for labels and gridlines;
// bars are positioned in day units, so every mode shares the same math.
export function ganttAxis(anchor,mode){
 const days=[];
 const pushMonth=mfirst=>{const probe=new Date(mfirst+'T12:00:00Z');probe.setUTCMonth(probe.getUTCMonth()+1);probe.setUTCDate(0);for(let n=0;n<probe.getUTCDate();n++){const k=addDays(mfirst,n);if(!isWeekend(k))days.push(k);}};
 if(mode==='month')pushMonth(anchor.slice(0,7)+'-01');
 else if(mode==='quarter'){const y=Number(anchor.slice(0,4)),qm=Math.floor((Number(anchor.slice(5,7))-1)/3)*3+1;for(let mo=0;mo<3;mo++)pushMonth(new Date(Date.UTC(y,qm-1+mo,1)).toISOString().slice(0,10));}
 else if(mode==='year'){for(let mo=1;mo<=12;mo++)pushMonth(`${anchor.slice(0,4)}-${String(mo).padStart(2,'0')}-01`);}
 else{const wd=new Date(anchor+'T12:00:00Z').getUTCDay(),first=addDays(anchor,-((wd+6)%7));for(let n=0;n<5;n++)days.push(addDays(first,n));}
 const columns=[];
 if(mode==='quarter'){for(let i=0;i<days.length;i+=5)columns.push({offset:i,span:Math.min(5,days.length-i),label:dayFmt(days[i],{month:'short',day:'numeric'})});}
 else if(mode==='year'){let i=0;while(i<days.length){const mk=days[i].slice(0,7);let j=i;while(j<days.length&&days[j].slice(0,7)===mk)j++;columns.push({offset:i,span:j-i,label:dayFmt(days[i],{month:'short'})});i=j;}}
 else days.forEach((k,i)=>columns.push({offset:i,span:1,label:dayFmt(k,mode==='week'?{weekday:'short',day:'numeric'}:{day:'numeric'})}));
 return {days,columns,start:days[0],end:days[days.length-1]};
}

// Left edge = first axis day >= start; right edge = first axis day past end.
export function ganttPosition(axis,start,end){
 let left=axis.days.findIndex(d=>d>=start);if(left<0)left=axis.days.length;
 const ri=axis.days.findIndex(d=>d>end),right=ri<0?axis.days.length:ri;
 return {left,right};
}

// groups: [{rows:[calendarEntries rows], head?: html}]. ctx: {esc,mode,chip,barClass,barTitle,rowMeta,todayKey}
export function ganttChart(axis,groups,ctx){
 const {esc,chip,barClass,barTitle,rowMeta,todayKey,mode}=ctx,total=axis.days.length,pct=n=>(n/total*100).toFixed(3)+'%';
 const gridlines=axis.columns.map(c=>`<span style="left:${pct(c.offset)};width:${pct(c.span)}"></span>`).join('');
 let weekendHidden=0;
 const sections=groups.map((g,gi)=>{
  const rows=[];
  for(const r of g.rows){
   const {left,right}=ganttPosition(axis,r.date,r.last_date||r.date);
   if(right<=left){if(r.date<=axis.end&&(r.last_date||r.date)>=axis.start)weekendHidden++;continue;}
   const before=r.date<axis.start,after=(r.last_date||r.date)>axis.end;
   rows.push(`<div class="gantt-row"><div class="gantt-rail"><strong>${esc(r.title)}</strong><small>${esc(rowMeta(r))}</small></div><div class="gantt-track"><button type="button" class="gantt-bar ${barClass(r)}" style="left:${pct(left)};width:${pct(Math.max(right-left,0.35))}" data-open="${esc(r.project_id)}" ${r.item_id?`data-target-item="${esc(r.item_id)}" data-calendar-item="${esc(r.item_id)}"`:''} title="${esc(barTitle(r))}">${esc((before?'← ':'')+chip(r)+(after?' →':''))}</button></div></div>`);
  }
  if(!rows.length)return '';
  const inRange=todayKey>=axis.start&&todayKey<=axis.end,tpos=inRange?axis.days.findIndex(d=>d>=todayKey):-1;
  const marker=tpos>=0?`<div class="gantt-today" style="left:${pct(tpos+0.5)}">${gi===0?'<span class="gantt-today-label">TODAY</span>':''}</div>`:'';
  return `<section class="gantt-group">${g.head||''}<div class="gantt-rows"><div class="gantt-gridlines" aria-hidden="true">${gridlines}</div>${marker}${rows.join('')}</div></section>`;
 }).join('');
 const html=`<div class="gantt-scroll"><div class="gantt mode-${mode}" role="group" aria-label="Gantt schedule chart"><div class="gantt-header"><div class="gantt-rail" aria-hidden="true"></div><div class="gantt-cols">${axis.columns.map(c=>`<span class="gantt-col" style="left:${pct(c.offset)};width:${pct(c.span)}">${esc(c.label)}</span>`).join('')}</div></div>${sections||'<p class="empty" style="padding:14px">No dated items in this range.</p>'}</div></div>`;
 return {html,weekendHidden};
}
