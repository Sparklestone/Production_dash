import {dateKey,projectIsDone} from './schedule.js';
import {ownerNames,projectCx} from './step-assignment.js';
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

// Plain-text outline of the daily status, for pasting into Teams. Same grouping
// and order as the on-screen briefing: brand with CX, then per-project [Daily]
// notes and step lines "step - owner - Due Oct 23 / Past due / Blocked / Done".
const OUTLINE_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const outlineDate=d=>{if(!d)return '';const[,m,day]=d.split('-');return `${OUTLINE_MONTHS[+m-1]} ${+day}`;};
const outlineProjects=(b)=>{
 const projs=new Map();
 const get=p=>projs.get(p.id)||(projs.set(p.id,{p,notes:[],done:[],steps:[]}),projs.get(p.id));
 for(const x of b.changed){const g=get(x.project);(x.kind==='note'?g.notes:g.done).push(x);}
 for(const [k,rows] of [['urgent',b.urgent],['next',b.next],['week',b.week]])for(const x of rows)get(x.project).steps.push({...x,cat:k});
 const rank=g=>g.steps.some(s=>s.cat==='urgent')?0:1,first=g=>g.steps.map(s=>s.due||'9999').sort()[0]||'9999';
 return [...projs.values()].sort((x,y)=>rank(x)-rank(y)||first(x).localeCompare(first(y))||x.p.name.localeCompare(y.p.name));
};
const projectLines=(g,owner)=>{
 const lines=[g.p.name];
 for(const n of g.notes)lines.push(n.text);
 for(const x of g.steps.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')))
  lines.push(`${x.item.title} - ${owner(x.item)} - ${x.cat==='urgent'?x.why:'Due'}${x.due?' '+outlineDate(x.due):''}`);
 for(const x of g.done)lines.push(`${x.item.title} - ${owner(x.item)} - Done`);
 return lines;
};
// One brand (optionally one project within it) as outline text.
export function brandOutline(b,{projects,mm,projectId}={}){
 const owner=i=>ownerNames(i,mm||{},'No owner');
 let gs=outlineProjects(b);
 if(projectId)gs=gs.filter(g=>g.p.id===projectId);
 if(!gs.length)return '';
 const cx=projectCx(projects?.[projectId||b.project_id],projects||{});
 const named=projectId?gs[0].p.name:b.name;
 const head=cx.length?`${named}: CX ${cx.join(', ')}`:named;
 const lines=[head,''];
 for(const g of gs){lines.push(...(projectId?projectLines(g,owner).slice(1):projectLines(g,owner)),'');}
 return lines.join('\n').trim();
};
// Every brand, in panel order, separated by a blank line.
export function statusOutline({brands},{projects,mm}={}){
 return brands.map(b=>brandOutline(b,{projects,mm})).filter(Boolean).join('\n\n');
}
