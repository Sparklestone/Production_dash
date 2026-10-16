import {addDays} from './live-calendar.js';
import {isWeekend} from './schedule.js';

const dayFmt=(k,opts)=>new Date(k+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',...opts});
const shiftMonthKey=(ym,n)=>{const d=new Date(ym+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7);};

function monthDays(mfirst){
 const probe=new Date(mfirst+'T12:00:00Z');probe.setUTCMonth(probe.getUTCMonth()+1);probe.setUTCDate(0);
 const out=[];for(let n=0;n<probe.getUTCDate();n++){const k=addDays(mfirst,n);if(!isWeekend(k))out.push(k);}
 return out;
}

export function shiftGanttPeriod(anchor,mode,n){
 if(mode==='week')return addDays(anchor,n*7);
 if(mode==='month')return shiftMonthKey(anchor.slice(0,7),n)+'-01';
 if(mode==='2mo')return shiftMonthKey(anchor.slice(0,7),n*2)+'-01';
 if(mode==='quarter')return shiftMonthKey(anchor.slice(0,7),n*3)+'-01';
 return String(Number(anchor.slice(0,4))+n)+anchor.slice(4);
}

export function twoMonthStart(anchor){
 return anchor.slice(0,7);
}

function periodDays(anchor,mode){
 if(mode==='week'){const wd=new Date(anchor+'T12:00:00Z').getUTCDay(),first=addDays(anchor,-((wd+6)%7)),out=[];for(let n=0;n<5;n++)out.push(addDays(first,n));return out;}
 if(mode==='month')return monthDays(anchor.slice(0,7)+'-01');
 if(mode==='2mo'){const k=twoMonthStart(anchor);return monthDays(k+'-01').concat(monthDays(shiftMonthKey(k,1)+'-01'));}
 if(mode==='quarter'){const y=Number(anchor.slice(0,4)),qm=Math.floor((Number(anchor.slice(5,7))-1)/3)*3+1,out=[];for(let mo=0;mo<3;mo++)out.push(...monthDays(new Date(Date.UTC(y,qm-1+mo,1)).toISOString().slice(0,10)));return out;}
 const out=[];for(let mo=1;mo<=12;mo++)out.push(...monthDays(`${anchor.slice(0,4)}-${String(mo).padStart(2,'0')}-01`));return out;
}

// Weekday axis covering pad periods on each side of the anchor period, so the
// chart can side-scroll into the past and future. Columns group days for
// labels and gridlines; bars are positioned in day units, so every mode
// shares the same math. monthStarts marks exact month boundaries for the
// darker separator lines; bounds locates the anchor period for scroll snap.
export function ganttAxis(anchor,mode,pad=1){
 const days=[],bounds=[0];
 for(let k=-pad;k<=pad;k++){days.push(...periodDays(shiftGanttPeriod(anchor,mode,k),mode));bounds.push(days.length);}
 const monthStarts=[];days.forEach((k,i)=>{if(i>0&&k.slice(0,7)!==days[i-1].slice(0,7))monthStarts.push(i);});
 const monthChanged=i=>i>0&&days[i].slice(0,7)!==days[i-1].slice(0,7);
 const columns=[];
 if(mode==='quarter'){
  let i=0;while(i<days.length){let j=i+1;while(j<days.length&&new Date(days[j]+'T12:00:00Z').getUTCDay()!==1)j++;columns.push({offset:i,span:j-i,label:dayFmt(days[i],{month:'short',day:'numeric'})});i=j;}
 }else if(mode==='year'){
  let i=0;while(i<days.length){const mk=days[i].slice(0,7);let j=i;while(j<days.length&&days[j].slice(0,7)===mk)j++;columns.push({offset:i,span:j-i,label:dayFmt(days[i],{month:'short'})+(days[i].slice(5,7)==='01'?" '"+days[i].slice(2,4):''),major:true});i=j;}
 }else{
  days.forEach((k,i)=>{
   const label=mode==='week'
    ?dayFmt(k,(i===0||monthChanged(i))?{weekday:'short',month:'short',day:'numeric'}:{weekday:'short',day:'numeric'})
    :dayFmt(k,(i===0||monthChanged(i))?{month:'short',day:'numeric'}:{day:'numeric'});
   columns.push({offset:i,span:1,label});
  });
 }
 const anchorIdx=bounds[pad],anchorEnd=bounds[pad+1];
 return {days,columns,start:days[0],end:days[days.length-1],monthStarts,bounds,anchorIdx,anchorStart:days[anchorIdx],anchorEnd:days[anchorEnd-1],periodLen:anchorEnd-anchorIdx};
}

// Left edge = first axis day >= start; right edge = first axis day past end.
export function ganttPosition(axis,start,end){
 let left=axis.days.findIndex(d=>d>=start);if(left<0)left=axis.days.length;
 const ri=axis.days.findIndex(d=>d>end),right=ri<0?axis.days.length:ri;
 return {left,right};
}

// groups: [{sections:[{rows,subhead?}], head?: html, collapsed?: bool}]. ctx: {esc,mode,chip,barClass,barTitle,rowMeta,todayKey,scope,scheduleKey}
export function ganttChart(axis,groups,ctx){
 const {esc,chip,barClass,barTitle,rowMeta,todayKey,mode}=ctx,total=axis.days.length,pct=n=>(n/total*100).toFixed(3)+'%';
 const majors=new Set(axis.monthStarts);
 if(mode==='week'||mode==='month'||mode==='2mo')axis.days.forEach((k,i)=>{if(new Date(k+'T12:00:00Z').getUTCDay()===1)majors.add(i);});
 const gridlines=axis.columns.map(c=>`<span style="left:${pct(c.offset)};width:${pct(c.span)}"${c.major?' class="major"':''}></span>`).join('')
  +[...majors].map(i=>`<span class="gantt-major-line" style="left:${pct(i)}"></span>`).join('');
 let weekendHidden=0;
 const sections=groups.map((g,gi)=>{
  let rowsHtml='',rowCount=0;
  for(const sec of g.sections){
   const rows=[];
   for(const r of sec.rows){
    const {left,right}=ganttPosition(axis,r.date,r.last_date||r.date);
    if(right<=left){if(r.date<=axis.end&&(r.last_date||r.date)>=axis.start)weekendHidden++;continue;}
    const before=r.date<axis.start,after=(r.last_date||r.date)>axis.end;
    rows.push(`<div class="gantt-row"><div class="gantt-rail"><strong>${esc(r.title)}</strong><small>${esc(rowMeta(r))}</small></div><div class="gantt-track"><button type="button" class="gantt-bar ${barClass(r)}" style="left:${pct(left)};width:${pct(Math.max(right-left,0.35))}" data-open="${esc(r.project_id)}" ${r.item_id?`data-target-item="${esc(r.item_id)}" data-calendar-item="${esc(r.item_id)}"`:''} title="${esc(barTitle(r))}">${esc((before?'← ':'')+chip(r)+(after?' →':''))}</button></div></div>`);
   }
   if(rows.length){rowsHtml+=(sec.subhead?`<div class="gantt-subhead"><div class="gantt-rail">${sec.subhead}</div><div class="gantt-track"></div></div>`:'')+rows.join('');rowCount+=rows.length;}
  }
  if(!rowCount)return '';
  const inRange=todayKey>=axis.start&&todayKey<=axis.end,tpos=inRange?axis.days.findIndex(d=>d>=todayKey):-1;
  const marker=tpos>=0?`<div class="gantt-today" style="left:${pct(tpos+0.5)}">${gi===0?'<span class="gantt-today-label">TODAY</span>':''}</div>`:'';
  return `<section class="gantt-group ${g.collapsed?'is-collapsed':''}">${g.head||''}${g.collapsed?'':`<div class="gantt-rows"><div class="gantt-lines" aria-hidden="true"><div class="gantt-gridlines">${gridlines}</div>${marker}</div>${rowsHtml}</div>`}</section>`;
 }).join('');
 const tIdx=(todayKey>=axis.start&&todayKey<=axis.end)?axis.days.findIndex(d=>d>=todayKey):-1,todayFrac=tIdx>=0?((tIdx+0.5)/total).toFixed(5):(axis.anchorIdx/total).toFixed(5);
 const perMin={week:700,month:950,'2mo':1150,quarter:900,year:1000}[mode]||800;
 const html=`<div class="gantt-scroll" data-gantt-scroll data-scope="${esc(ctx.scope||'live')}" data-schedule-key="${esc(ctx.scheduleKey||'')}" data-anchor-frac="${(axis.anchorIdx/total).toFixed(5)}" data-today-frac="${todayFrac}" data-period-frac="${(axis.periodLen/total).toFixed(5)}"><div class="gantt mode-${mode}" style="min-width:${3*perMin}px" role="group" aria-label="Gantt schedule chart"><div class="gantt-header"><div class="gantt-rail" aria-hidden="true"></div><div class="gantt-cols">${axis.columns.map(c=>`<span class="gantt-col" style="left:${pct(c.offset)};width:${pct(c.span)}">${esc(c.label)}</span>`).join('')}</div></div>${sections||'<p class="empty" style="padding:14px">No dated items in this range.</p>'}</div></div>`;
 return {html,weekendHidden};
}
