import {dateKey,milestoneKind,projectIsDone} from './schedule.js';
import {addDays} from './live-calendar.js';
export function isWorkDay(day,holidays=[]){const n=new Date(day+'T12:00:00Z').getUTCDay();return n!==0&&n!==6&&!holidays.includes(day);}
export function shiftWorkDays(day,n,holidays=[]){if(!Number.isInteger(n)||Math.abs(n)>1040)throw Error('Choose whole work days');let key=day;const direction=n<0?-1:1;while(n){key=addDays(key,direction);if(isWorkDay(key,holidays))n-=direction;}return key;}
export function workDayDistance(from,to,holidays=[]){let n=0,key=from;if(from===to)return 0;const direction=from<to?1:-1;while(key!==to){key=addDays(key,direction);if(isWorkDay(key,holidays))n+=direction;}return n;}
export function workDayCount(from,to,holidays=[]){let n=0;for(let key=from;key<=to;key=addDays(key,1))if(isWorkDay(key,holidays))n++;return n;}
export function dueChange(item,due,holidays=[]){if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||Number.isNaN(Date.parse(due+'T12:00:00Z'))||new Date(due+'T12:00:00Z').toISOString().slice(0,10)!==due||!isWorkDay(due,holidays))throw Error('Choose a work day, excluding Monigle holidays');const old=dateKey(item.due_date);return {due_date:due,start_date:item.start_date&&old?shiftWorkDays(dateKey(item.start_date),workDayDistance(old,due,holidays),holidays):item.start_date||null};}
export function footprint(item,holidays=[]){
 const due=dateKey(item.due_date),start=dateKey(item.start_date),days=item.work_days_needed||1;
 if(start)return {start,end:due&&due>shiftWorkDays(start,days-1,holidays)?due:shiftWorkDays(start,days-1,holidays)};
 return due?{start:shiftWorkDays(due,-(days-1),holidays),end:due}:null;
}
export function schedulingIssues(items,projects,holidays=[]){
 const out={};const rows=items.filter(i=>i.status!=='done'&&!projectIsDone(projects[i.project_id],projects));
 for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++){const x=rows[a],y=rows[b];if(x.project_id!==y.project_id)continue;const fx=footprint(x,holidays),fy=footprint(y,holidays);if(!fx||!fy||fx.start>fy.end||fy.start>fx.end||!workDayCount(fx.start>fy.start?fx.start:fy.start,fx.end<fy.end?fx.end:fy.end,holidays))continue;(out[x.id]||=[]).push(y.title);(out[y.id]||=[]).push(x.title);}
 return out;
}
export function timingPlan(items,projects,changes,holidays=[],coverage=[]){
 const byId=Object.fromEntries(items.map(i=>[i.id,{...i}])),explicit=new Set(Object.keys(changes)),affected=new Set(),automatic=new Set();
 for(const [id,change] of Object.entries(changes)){const item=byId[id];if(!item||item.status==='done'||projectIsDone(projects[item.project_id],projects))throw Error('Step not editable');if(item.starts_at)throw Error('Timed meetings need their exact time updated separately');Object.assign(item,change,{due_date_suggested:false});affected.add(item.project_id);}
 for(const pid of affected){const original=items.filter(i=>i.project_id===pid&&i.status!=='done'&&(dateKey(i.due_date)||explicit.has(i.id))).sort((a,b)=>(a.due_date||byId[a.id].due_date).localeCompare(b.due_date||byId[b.id].due_date)||a.id.localeCompare(b.id));let barrier=null;
  for(const old of original){const item=byId[old.id],f=footprint(item,holidays);if(!f)continue;
   if(explicit.has(item.id)){barrier=barrier&&barrier>f.end?barrier:f.end;continue;}
   if(barrier&&f.start<=barrier&&!milestoneKind(item)&&item.auto_adjust!==false){const start=shiftWorkDays(barrier,1,holidays),end=shiftWorkDays(start,Math.max(item.work_days_needed||1,workDayCount(f.start,f.end,holidays))-1,holidays);item.start_date=start;item.due_date=end;item.due_date_suggested=true;automatic.add(item.id);}
   const adjusted=footprint(item,holidays);if(barrier)barrier=adjusted.end>barrier?adjusted.end:barrier;
  }
 }
 const scoped=Object.values(byId).filter(i=>affected.has(i.project_id));
 const changed=Object.values(byId).filter(i=>{const old=items.find(x=>x.id===i.id);return old.start_date!==i.start_date||old.due_date!==i.due_date;});
 if(scoped.some(i=>{const f=footprint(i,holidays);if(!f)return false;for(let month=f.start.slice(0,7);month<=f.end.slice(0,7);){if(!coverage.includes(month))return true;const [y,m]=month.split('-').map(Number);month=`${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,'0')}`;}return false;}))throw Error('Monigle holiday coverage is not verified for these dates');
 return {affected:[...affected],explicit:Object.entries(changes).map(([id,change])=>({id,...change})),changes:changed.map(i=>({id:i.id,start_date:i.start_date||null,due_date:i.due_date||null,due_date_suggested:i.due_date_suggested||false,automatic:automatic.has(i.id)})),issues:schedulingIssues(Object.values(byId),projects,holidays),items:Object.values(byId)};
}
