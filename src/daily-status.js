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
// Denver calendar-day key for a timestamp, and the earliest day of the
// trailing N-working-day window (weekends skipped), counting today.
const dayFmts={};
export const dayKey=(ms,zone='America/Denver')=>(dayFmts[zone]||=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'})).format(ms);
export function doneWindowStart(today,days=5,zone='America/Denver'){
 let d=today,n=0;
 while(true){const w=weekdayOf(Date.parse(d+'T12:00:00Z'),zone);if(w!=='Sat'&&w!=='Sun')n++;if(n>=days)return d;d=shiftDate(d,-1);}
}
// Only notes tagged [Daily] (a plain-words event: delay, new date, delivery, client decision) are shown.
export const DAILY=/^\s*\[Daily\]\s*/i;
const blocked=i=>['blocked','waiting'].includes(i.status);
// Each brand (client) gets four sections. Urgent, Next few days and This week
// never repeat a step (highest priority wins); Changed is a log and may overlap.
export function dailyStatus({items,updates=[],projects,clients=[],today,now=new Date(),nextDays=3}){
 const cm=Object.fromEntries(clients.map(c=>[c.id,c])),start=businessWindowStart(now).getTime(),end=shiftDate(today,7),horizon=shiftDate(today,nextDays),doneStart=doneWindowStart(today);
 const rootOf=p=>{let n=p,s=0;while(n?.parent_id&&projects[n.parent_id]&&s++<20)n=projects[n.parent_id];return n;};
 const brands={};
 const brand=p=>{const root=rootOf(p),c=cm[p?.client_id]||cm[root?.client_id],name=(c?(c.aka?c.name+'/'+c.aka:c.name):null)||root?.name||'No client',key=c?.id||'p:'+(root?.id||'none');return brands[key]||(brands[key]={key,name,project_id:root?.id||p?.id,changed:[],urgent:[],next:[],week:[],active:[],rdone:[]});};
 const seen=new Set();
 for(const i of items){
  const p=projects[i.project_id];if(!p)continue;
  const b=brand(p),when=i.updated_at?new Date(i.updated_at).getTime():0;
  const added=i.created_at&&new Date(i.created_at).getTime()>=start;
  if(i.status==='done'&&when>=start&&when<=now.getTime()&&!added&&!/^RETIRED/i.test(i.title))b.changed.push({kind:'done',item:i,project:p,at:i.updated_at,text:'Done'});
  if(i.status==='done'&&i.updated_at&&!/^RETIRED/i.test(i.title)&&dayKey(when)>=doneStart)b.rdone.push({item:i,project:p,at:i.updated_at});
  if(i.status==='done'||projectIsDone(p,projects))continue;
  const due=dateKey(i.due_date);
  const mark=x=>{seen.add(i.id);return x;};
  if(due&&due<today)b.urgent.push(mark({item:i,project:p,due,why:'Past due'}));
  else if(due===today)b.urgent.push(mark({item:i,project:p,due,why:'Due today'}));
  else if(blocked(i))b.urgent.push(mark({item:i,project:p,due,why:i.status==='blocked'?'Blocked':'Waiting on others'}));
  else if(due&&due<=horizon)b.next.push(mark({item:i,project:p,due}));
  else if(due&&due<=end)b.week.push(mark({item:i,project:p,due}));
  // Started work never drops off the status (Aaron, Oct 26): an in-progress
  // step with no near date still shows, independent of when it was edited.
  else if(i.status==='in_progress')b.active.push(mark({item:i,project:p,due}));
 }
 for(const u of updates){
  const p=projects[u.project_id];if(!p||!u.created_at)continue;const at=new Date(u.created_at).getTime();
  if(at>=start&&at<=now.getTime()&&DAILY.test(u.note||''))brand(p).changed.push({kind:'note',project:p,at:u.created_at,text:u.note.replace(DAILY,'').trim()});
 }
 const byDue=(a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.item.title.localeCompare(b.item.title);
 const list=Object.values(brands).filter(b=>b.changed.length+b.urgent.length+b.next.length+b.week.length+b.active.length+b.rdone.length);
 for(const b of list){b.urgent.sort(byDue);b.next.sort(byDue);b.week.sort(byDue);b.active.sort(byDue);b.changed.sort((x,y)=>y.at.localeCompare(x.at));b.rdone.sort((x,y)=>y.at.localeCompare(x.at));}
 list.sort((a,b)=>b.urgent.length-a.urgent.length||a.name.localeCompare(b.name));
 return {brands:list,since:new Date(start),totals:list.reduce((t,b)=>({changed:t.changed+b.changed.length,urgent:t.urgent+b.urgent.length,next:t.next+b.next.length,week:t.week+b.week.length,active:t.active+b.active.length,rdone:t.rdone+b.rdone.length}),{changed:0,urgent:0,next:0,week:0,active:0,rdone:0})};
}

// Plain-text and HTML outlines of the daily status, for pasting into Teams.
// Same grouping and order as the on-screen briefing: brand with CX, then
// per-project [Daily] notes and step lines "step - owner - Due Oct 23 /
// Past due / Blocked / Done". Text uses blank lines for hierarchy (double
// between projects, triple between brands); HTML bolds brand/project heads.
const OUTLINE_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const outlineDate=d=>{if(!d)return '';const[,m,day]=d.split('-');return `${OUTLINE_MONTHS[+m-1]} ${+day}`;};
const outlineEsc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const outlineProjects=(b)=>{
 const projs=new Map();
 const get=p=>projs.get(p.id)||(projs.set(p.id,{p,notes:[],done:[],steps:[],rdone:[]}),projs.get(p.id));
 for(const x of b.changed){const g=get(x.project);(x.kind==='note'?g.notes:g.done).push(x);}
 for(const x of b.rdone||[])get(x.project).rdone.push(x);
 for(const [k,rows] of [['urgent',b.urgent],['next',b.next],['week',b.week],['active',b.active||[]]])for(const x of rows)get(x.project).steps.push({...x,cat:k});
 const rank=g=>g.steps.some(s=>s.cat==='urgent')?0:1,first=g=>g.steps.map(s=>s.due||'9999').sort()[0]||'9999';
 // The brand's root project (direct steps) lists first, matching the panel.
 const root=g=>g.p.id===b.project_id?0:1;
 return [...projs.values()].sort((x,y)=>root(x)-root(y)||rank(x)-rank(y)||first(x).localeCompare(first(y))||x.p.name.localeCompare(y.p.name));
};
const outlineModel=(b,{projects,mm,projectId}={})=>{
 const owner=i=>ownerNames(i,mm||{},'No owner');
 let gs=outlineProjects(b);
 if(projectId)gs=gs.filter(g=>g.p.id===projectId);
 if(!gs.length)return null;
 const cx=projectCx(projects?.[projectId||b.project_id],projects||{});
 const named=projectId?gs[0].p.name:b.name;
 const head=cx.length?`${named}: CX ${cx.join(', ')}`:named;
 const groups=gs.map(g=>{
  const lines=[];
  for(const n of g.notes)lines.push(n.text);
  for(const x of g.steps.sort((a,b2)=>(a.due||'9999').localeCompare(b2.due||'9999')))
   lines.push(`${x.item.title} - ${owner(x.item)} - ${x.cat==='urgent'?x.why:x.cat==='active'?'In progress':'Due'}${x.due?' '+outlineDate(x.due):''}`);
  for(const x of g.done)lines.push(`${x.item.title} - ${owner(x.item)} - Done`);
  if(g.rdone?.length){lines.push('Done (last 5 working days):');for(const x of g.rdone)lines.push(`${x.item.title} - ${owner(x.item)} - Done ${outlineDate(dayKey(new Date(x.at).getTime()))}`);}
  return {name:g.p.name,id:g.p.id,merged:!projectId&&g.p.id===b.project_id,lines};
 });
 return {head,headId:(projectId?gs[0].p.id:b.project_id)||null,groups,projectScoped:!!projectId};
};
const modelText=m=>{
 const blocks=[m.head,''];
 // Plain text cannot carry size: subprojects indent two spaces instead.
 for(const g of m.groups)blocks.push(...((m.projectScoped||g.merged)?g.lines:['  '+g.name,...g.lines.map(l=>'  '+l)]),'');
 return blocks.join('\n').trim();
};
const modelHtml=m=>{
 const link=(id,text)=>id?`<a href="https://productiondash.vercel.app/#project=${id}">${text}</a>`:text;
 // Brand head h2, subproject head h3: heading tags are what survives a
 // Teams paste (its sanitizer strips inline styles but keeps headings), so
 // the brand/subproject size hierarchy holds in the actual paste (Oct 26).
 const head=`<h2 style="margin:0">${link(m.headId,outlineEsc(m.head))}</h2>`;
 const parts=[head];
 for(const g of m.groups){
  const body=g.lines.map(outlineEsc).join('<br>');
  if(!g.merged||!body){parts.push(m.projectScoped?`<p>${body}</p>`:`<h3 style="margin:8px 0 0 14px">${link(g.id,outlineEsc(g.name))}</h3><p style="margin:0 0 0 14px">${body}</p>`);continue;}
  parts.push(`<p style="margin:0">${body}</p>`);
 }
 return parts.join('');
};
// One brand (optionally one project within it).
export function brandOutline(b,opts={}){const m=outlineModel(b,opts);return m?modelText(m):'';}
export function brandOutlineHtml(b,opts={}){const m=outlineModel(b,opts);return m?modelHtml(m):'';}
// Every brand, in panel order, separated by a triple break (text) or an empty
// paragraph (HTML) so brands read as separate cards when pasted.
export function statusOutline({brands},{projects,mm}={}){
 return brands.map(b=>brandOutline(b,{projects,mm})).filter(Boolean).join('\n\n\n');
}
export function statusOutlineHtml({brands},{projects,mm}={}){
 return brands.map(b=>brandOutlineHtml(b,{projects,mm})).filter(Boolean).join('<p><br></p>');
}
