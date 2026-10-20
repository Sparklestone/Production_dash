import {dateKey,projectIsDone} from './schedule.js';
import {shiftDate} from './insights.js';

// 24 business hours back from `now`: weekend hours do not count.
// Monday 9:37am looks back to Friday 9:37am.
const fmts={};
const weekdayOf=(ms,zone)=>(fmts[zone]||=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short'})).format(ms);
export function businessWindowStart(now,hours=24,zone='America/Denver'){
 const isWeekend=ms=>{const w=weekdayOf(ms,zone);return w==='Sat'||w==='Sun';};
 // Step back 15 minutes at a time; the formatter is built once.
 let ms=now.getTime(),left=hours*4;
 while(left>0){ms-=900000;if(!isWeekend(ms))left--;}
 return new Date(ms);
}
// Only notes tagged [Daily] (a plain-words event: delay, new date, delivery, client decision) are shown.
export const DAILY=/^\s*\[Daily\]\s*/i;
const blocked=i=>['blocked','waiting'].includes(i.status);
// Each brand (client) gets four sections. Urgent, Next few days and This week
// never repeat a step (highest priority wins); Changed is a log and may overlap.
export function dailyStatus({items,updates=[],projects,clients=[],today,now=new Date(),nextDays=3}){
 const cm=Object.fromEntries(clients.map(c=>[c.id,c])),start=businessWindowStart(now).getTime(),end=shiftDate(today,7),horizon=shiftDate(today,nextDays);
 const rootOf=p=>{let n=p,s=0;while(n?.parent_id&&projects[n.parent_id]&&s++<20)n=projects[n.parent_id];return n;};
 const brands={};
 const brand=p=>{const root=rootOf(p),c=cm[p?.client_id]||cm[root?.client_id],name=c?.name||root?.name||'No client',key=c?.id||'p:'+(root?.id||'none');return brands[key]||(brands[key]={key,name,project_id:root?.id||p?.id,changed:[],urgent:[],next:[],week:[]});};
 const seen=new Set();
 for(const i of items){
  const p=projects[i.project_id];if(!p)continue;
  const b=brand(p),when=i.updated_at?new Date(i.updated_at).getTime():0;
  const added=i.created_at&&new Date(i.created_at).getTime()>=start;
  if(i.status==='done'&&when>=start&&when<=now.getTime()&&!added&&!/^RETIRED/i.test(i.title))b.changed.push({kind:'done',item:i,project:p,at:i.updated_at,text:'Done'});
  if(i.status==='done'||projectIsDone(p,projects))continue;
  const due=dateKey(i.due_date);seen.add(i.id);
  if(due&&due<today)b.urgent.push({item:i,project:p,due,why:'Past due'});
  else if(due===today)b.urgent.push({item:i,project:p,due,why:'Due today'});
  else if(blocked(i))b.urgent.push({item:i,project:p,due,why:i.status==='blocked'?'Blocked':'Waiting on others'});
  else if(due&&due<=horizon)b.next.push({item:i,project:p,due});
  else if(due&&due<=end)b.week.push({item:i,project:p,due});
 }
 for(const u of updates){
  const p=projects[u.project_id];if(!p||!u.created_at)continue;const at=new Date(u.created_at).getTime();
  if(at>=start&&at<=now.getTime()&&DAILY.test(u.note||''))brand(p).changed.push({kind:'note',project:p,at:u.created_at,text:u.note.replace(DAILY,'').trim()});
 }
 const byDue=(a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.item.title.localeCompare(b.item.title);
 const list=Object.values(brands).filter(b=>b.changed.length+b.urgent.length+b.next.length+b.week.length);
 for(const b of list){b.urgent.sort(byDue);b.next.sort(byDue);b.week.sort(byDue);b.changed.sort((x,y)=>y.at.localeCompare(x.at));}
 list.sort((a,b)=>b.urgent.length-a.urgent.length||a.name.localeCompare(b.name));
 return {brands:list,since:new Date(start),totals:list.reduce((t,b)=>({changed:t.changed+b.changed.length,urgent:t.urgent+b.urgent.length,next:t.next+b.next.length,week:t.week+b.week.length}),{changed:0,urgent:0,next:0,week:0})};
}
