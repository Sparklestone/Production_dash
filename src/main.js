import { createClient } from '@supabase/supabase-js';
import './style.css';
import { dateKey, groupAssignments, projectIsDone, clientMilestone, milestoneKind, isWeekend, monthCells, shiftMonth, nextMilestone, timelineSteps, timelineStepState } from './schedule.js';
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const app = document.querySelector('#app');
const supabase = createClient(URL_, KEY);
let session = null;
const TZ = 'America/Denver';
const state = { data: null, view: 'today', member: 'all', client: 'all', status: 'open', search: '', open: null, busy: false, scheduleModes: {}, calendarMonths: {}, completing: false, openDay: null, focusedTask: null };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = { active:'In progress', in_progress:'In progress', waiting:'Waiting', pending:'Planned', not_started:'Not started', done:'Done', blocked:'Blocked' };
const label = s => labels[s] || String(s || 'Unknown').replaceAll('_',' ');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:TZ, year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
const fmtDate = d => d ? new Date(d.slice(0,10)+'T12:00:00').toLocaleDateString('en-US', {month:'short',day:'numeric'}) : 'Date not set';
const stamp = ts => new Date(ts).toLocaleString('en-US',{timeZone:TZ,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const shortName = (p,d) => { const c=d.cm[p.client_id]?.name; return c && p.name.toLowerCase().startsWith(c.toLowerCase()+' ') ? p.name.slice(c.length+1) : p.name; };
const due = (date,status) => {
 if(status==='done') return {text:date?`Done · recorded date ${fmtDate(date)}`:'Completed',cls:'done'};
 if(!date) return {text:'Date not set',cls:'muted'};
 const t=today(), dt=date.slice(0,10), days=Math.round((Date.parse(dt)-Date.parse(t))/864e5);
 return days<0?{text:`Past recorded due · ${fmtDate(dt)}`,cls:'late'}:days===0?{text:'Due today',cls:'soon'}:days===1?{text:'Due tomorrow',cls:'soon'}:{text:`Due ${fmtDate(dt)}`,cls:''};
};
const by = (xs,key) => xs.reduce((a,x)=>((a[x[key]] ||= []).push(x),a),{});
function derive(){
 const {clients,projects,members,updates,links,sched}=state.data;
 const cm=Object.fromEntries(clients.map(x=>[x.id,x])), pm=Object.fromEntries(projects.map(x=>[x.id,x])), mm=Object.fromEntries(members.map(x=>[x.id,x]));
 const aaron=members.find(x=>x.name==='Aaron Finkelstein')?.id;
 return {cm,pm,mm,aaron,upd:by(updates,'project_id'),lnk:by(links,'project_id'),sch:by(sched,'project_id'),subs:by(projects.filter(p=>p.parent_id),'parent_id')};
}
async function q(table,params){const r=await fetch(`${URL_}/rest/v1/${table}?${params}`,{headers:{apikey:KEY,Authorization:`Bearer ${session.access_token}`}});if(!r.ok)throw Error('Data request failed');return r.json();}
async function load(){
 if(!session){loginView();return;}if(state.busy)return;state.busy=true;
 if(!state.data)app.innerHTML='<div class="loading"><span class="eyebrow">PRODUCTION / MONIGLE</span><h1>Getting the latest...</h1></div>';
 try {
  if(!URL_||!KEY)throw Error('Configuration missing');
  const [clients,projects,members,updates,links,sched]=await Promise.all([q('clients','select=*&order=name'),q('projects','select=*&order=sort_order,name'),q('team_members','select=*&active=eq.true&order=name'),q('project_updates','select=*&order=created_at.desc'),q('project_links','select=*&order=created_at'),q('schedule_items','select=*&order=due_date.asc.nullslast')]);
  state.data={clients,projects,members,updates,links,sched};state.loaded=new Date();state.error=false;render();
 }catch(e){state.error=true;if(state.data)render();else app.innerHTML='<div class="loading"><h1>Could not load production.</h1><p>Nothing has been changed. Try again in a moment.</p><button id="retry">Try again</button></div>';document.querySelector('#retry')?.addEventListener('click',load);}
 finally{state.busy=false;}
}
function commentButton(p,item){return `<button class="comment" data-comment="${esc(p.id)}" ${item?`data-item="${esc(item.id)}"`:''} aria-label="Comment to Instinct about ${esc(item?.title||p.name)}"><span aria-hidden="true">↗</span> Comment</button>`;}
function latest(p,d,full=false){const u=d.upd[p.id]?.[0];return `<div class="update"><div class="caption">LATEST UPDATE <span>${u?esc(stamp(u.created_at))+' MT':''}</span></div><p class="${full?'':'clamp'}">${esc(u?.note || p.description || 'No update recorded yet.')}</p></div>`;}
function timeline(p,d){
 const steps=timelineSteps(p,state.data.sched,d.pm);if(!steps.length)return '';
 return `<ol class="mini-timeline" aria-label="Steps for ${esc(p.name)}">${steps.map(i=>`<li class="timeline-step step-${timelineStepState(i)}" title="${esc(i.title)} · ${esc(label(i.status))}${i.due_date?' · '+esc(fmtDate(i.due_date)):''}" aria-label="${esc(i.title)}: ${esc(label(i.status))}${milestoneKind(i)?', '+milestoneKind(i):''}"><span class="step-circle" aria-hidden="true"></span></li>`).join('')}</ol>`;
}
function projectCard(p,d){
 const next=(d.sch[p.id]||[]).filter(i=>i.status!=='done' && i.due_date && i.due_date>=today())[0];
 const ds=due(next?.due_date||p.due_date,p.status);
 const milestone=p.status==='done'?null:nextMilestone(p,state.data.sched,d.pm,today());
 return `<article class="project-card ${timelineSteps(p,state.data.sched,d.pm).some(i=>i.status==='in_progress')?'has-current-step':''}">${timeline(p,d)}<div class="card-top"><span class="eyebrow">${esc(d.cm[p.client_id]?.name||'No client')}</span><span class="pill ${esc(p.status)}">${esc(label(p.status))}</span></div><h3><button class="title-button" data-open="${p.id}">${esc(shortName(p,d))}</button></h3>${latest(p,d)}${milestone?`<p class="next-milestone milestone-${milestoneKind(milestone)}"><strong>Next ${milestoneKind(milestone)==='review'?'REVIEW':'RELEASE'}</strong> · ${esc(fmtDate(milestone.due_date))}<span>${esc(milestone.title)}</span></p>`:''}<div class="card-meta"><span>Lead: ${esc(d.mm[p.owner_id]?.name||'Not assigned')}</span><span class="${ds.cls}">${esc(ds.text)}${next?' · '+esc(next.title):''}</span></div><footer><button class="text-button" data-open="${p.id}">Details & links →</button>${commentButton(p)}</footer></article>`;
}
function milestoneLegend(){return '<div class="calendar-legend" aria-label="Milestone colors"><span class="legend-review">REVIEW · Client review / approval</span><span class="legend-release">RELEASE · Release / client delivery</span></div>';}
function taskCard(i,d){
 const p=d.pm[i.project_id];if(!p)return '';const dt=due(i.due_date,i.status),kind=milestoneKind(i);
 return `<article class="task-card ${i.status==='in_progress'?'has-current-step':''} ${kind?`client-milestone milestone-${kind}`:''}" data-task-card="${esc(i.id)}" tabindex="-1" ${state.focusedTask===i.id?'data-task-highlight="true"':''}>${timeline(p,d)}${kind?`<span class="client-label">${kind==='review'?'REVIEW':'RELEASE'}</span>`:''}<div class="task-date ${dt.cls}">${esc(dt.text)}</div><h3><button class="title-button" data-open="${esc(p.id)}" data-target-item="${esc(i.id)}" aria-label="Open project and find task: ${esc(i.title)}">${esc(i.title)}</button></h3><p class="task-context">${esc(d.cm[p.client_id]?.name||'')} / ${esc(shortName(p,d))}</p>${i.notes?`<p class="task-note">${esc(i.notes)}</p>`:''}<span class="owner">${esc(d.mm[i.owner_id]?.name||'Not assigned')} · ${esc(label(i.status))}</span><footer><button class="text-button" data-open="${esc(p.id)}" data-target-item="${esc(i.id)}">Open project →</button>${i.status!=='done'&&!projectIsDone(p,d.pm)?`<button class="primary task-done" data-complete-task="${esc(i.id)}" aria-label="Mark task done: ${esc(i.title)}">✓ Mark task done</button>`:''}${commentButton(p,i)}</footer><p class="task-complete-status" role="status" aria-live="polite"></p></article>`;
}
function assignmentGroups(items,d){
 return groupAssignments(items,d.pm).map(group=>`<section class="assignment-group"><div class="assignment-heading"><h3><button class="title-button" data-open="${esc(group.project.id)}">${esc(d.cm[group.project.client_id]?.name||'Production')} / ${esc(shortName(group.project,d))}</button></h3><span class="number" aria-label="${group.count} assignments">${group.count}</span></div>${[...group.branches.values()].map(branch=>`${branch.project.id!==group.project.id?`<h4 class="branch-heading"><button class="title-button" data-open="${esc(branch.project.id)}">${esc(shortName(branch.project,d))}</button><span>${branch.items.length} assignment${branch.items.length===1?'':'s'}</span></h4>`:''}<div class="task-grid">${branch.items.map(i=>taskCard(i,d)).join('')}</div>`).join('')}</section>`).join('');
}
function projectSchedule(p,d){
 const items=(d.sch[p.id]||[]).filter(i=>i.status!=='done'||i.id===state.focusedTask),mode=state.scheduleModes[p.id]||'list';
 const month=state.calendarMonths[p.id]||today().slice(0,7);state.calendarMonths[p.id]=month;
 const monthName=new Date(month+'-01T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
 return `<section class="project-schedule"><div class="schedule-heading"><h3 class="detail-heading">Schedule <span class="number">${items.length}</span></h3><div class="schedule-tabs" role="tablist" aria-label="Schedule view for ${esc(p.name)}">${['list','calendar'].map(v=>`<button role="tab" id="tab-${esc(p.id)}-${v}" aria-controls="schedule-${esc(p.id)}" aria-selected="${mode===v}" data-schedule-mode="${v}" data-project="${esc(p.id)}">${v==='list'?'List':'Calendar'}</button>`).join('')}</div></div><div id="schedule-${esc(p.id)}" role="tabpanel" aria-labelledby="tab-${esc(p.id)}-${mode}">${mode==='list'?items.map(i=>taskCard(i,d)).join('')||'<p class="muted">No schedule items recorded.</p>':`<div class="calendar-toolbar"><button data-month-step="-1" data-project="${esc(p.id)}" aria-label="Previous month">‹</button><h4 aria-live="polite">${esc(monthName)}</h4><button data-month-step="1" data-project="${esc(p.id)}" aria-label="Next month">›</button></div><p class="calendar-hint">Weekdays only. Tap a date for all cards.</p>${milestoneLegend()}<div class="calendar-grid">${['Mon','Tue','Wed','Thu','Fri'].map(day=>`<span class="weekday">${day}</span>`).join('')}${monthCells(month).map(key=>{if(!key)return '<span class="calendar-blank" aria-hidden="true"></span>';const daily=items.filter(i=>dateKey(i.due_date)===key),client=daily.some(clientMilestone);return `<button class="calendar-day ${key===today()?'is-today':''} " data-calendar-date="${key}" data-project="${esc(p.id)}" aria-label="${esc(fmtDate(key))}, ${daily.length} schedule items${client?', includes client milestone':''}" ${key===today()?'aria-current="date"':''}><span>${Number(key.slice(8))}</span>${daily.length?`<span class="calendar-events">${daily.slice(0,3).map(i=>`<span class="calendar-event ${milestoneKind(i)?`event-${milestoneKind(i)}`:''}" title="${esc(i.title)}">${esc(i.title)}</span>`).join('')}${daily.length>3?`<span class="calendar-more">+${daily.length-3} more</span>`:''}</span>`:''}</button>`;}).join('')}</div>${weekendSchedule(items,month,p.id,d)}${items.some(i=>!dateKey(i.due_date))?`<div class="undated"><h4>No date set</h4>${items.filter(i=>!dateKey(i.due_date)).map(i=>taskCard(i,d)).join('')}</div>`:''}`}</div></section>`;
}
function weekendSchedule(items,month,pid,d){
 const weekend=items.filter(i=>dateKey(i.due_date)?.startsWith(month)&&isWeekend(dateKey(i.due_date)));
 if(!weekend.length)return '';
 return `<details class="weekend-schedule"><summary>Weekend dates (${weekend.length})</summary><p class="calendar-hint">These records stay available outside the weekday grid.</p>${Object.entries(by(weekend.map(i=>({...i,day:dateKey(i.due_date)})),'day')).map(([key,rows])=>`<button class="text-button" data-calendar-date="${key}" data-project="${esc(pid)}">${esc(fmtDate(key))} · ${rows.length} card${rows.length===1?'':'s'} →</button>${rows.map(i=>taskCard(i,d)).join('')}`).join('')}</details>`;
}
function refreshDetail(){const dialog=document.querySelector('#detail');dialog.innerHTML=detail(derive().pm[state.open],derive());bind(dialog);}
function openDay(pid,key){
 const d=derive(),p=d.pm[pid],items=(d.sch[pid]||[]).filter(i=>i.status!=='done'&&dateKey(i.due_date)===key),dialog=document.querySelector('#day-dialog');
 state.openDay={pid,key};dayFocus=document.activeElement;
 dialog.innerHTML=`<div class="dialog-head"><span class="eyebrow">${esc(p.name)}</span><button class="close" data-close aria-label="Close date cards">×</button></div><h2 id="day-title">${esc(new Date(key+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}))}</h2><p class="day-summary">${items.length} schedule item${items.length===1?'':'s'}</p>${items.map(i=>taskCard(i,d)).join('')||'<p class="empty">Nothing scheduled on this date.</p>'}`;
 bind(dialog);
 dialog.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{dialog.close();openDetail(b.dataset.open,b.dataset.targetItem);});
 dialog.querySelectorAll('[data-comment]').forEach(b=>b.onclick=()=>{dialog.close();openComment(b.dataset.comment,b.dataset.item);});
 dialog.showModal();dialog.querySelector('[data-close]').focus();
}
async function completeTask(id){
 if(state.completing)return;
 const item=state.data.sched.find(i=>i.id===id);if(!item||item.status==='done')return;
 if(!window.confirm(`Mark task "${item.title}" done? Only this task will be completed, not its project. It will leave open task lists.`))return;
 state.completing=true;
 const cards=[...document.querySelectorAll('[data-task-card]')].filter(c=>c.dataset.taskCard===id);
 cards.forEach(c=>{c.querySelector('[data-complete-task]').disabled=true;c.querySelector('.task-complete-status').textContent='Saving completion...';});
 try{
  const {data,error}=await supabase.rpc('complete_dashboard_task',{target_schedule_item_id:id});
  if(error||data?.id!==id||data?.status!=='done')throw Error('Completion not confirmed');
  item.status='done';if(state.focusedTask===id)state.focusedTask=null;
  const projectId=state.open,day=document.querySelector('#day-dialog').open?state.openDay:null;
  const detailScroll=document.querySelector('#detail').scrollTop;
  render();
  if(projectId){openDetail(projectId,state.focusedTask);document.querySelector('#detail').scrollTop=detailScroll;}
  if(day)openDay(day.pid,day.key);
 }catch{
  cards.forEach(c=>{c.querySelector('.task-complete-status').textContent='Could not confirm completion. This task has not been removed. Try again or use Comment.';c.querySelector('[data-complete-task]').disabled=false;});
 }finally{state.completing=false;}
}
async function completeProject(id){
 if(state.completing)return;
 const p=derive().pm[id];if(!p||p.status==='done')return;
 const descendants=state.data.projects.filter(x=>x.parent_id===id).length;
 if(!window.confirm(`Mark "${p.name}" complete? It will leave the open list.${descendants?' Subprojects will be hidden with it, but their statuses will not change.':''} You can still find it using Including done.`))return;
 state.completing=true;
 const dialog=document.querySelector('#detail'),button=dialog.querySelector('[data-complete]'),status=dialog.querySelector('#complete-status');
 button.disabled=true;status.textContent='Saving completion...';
 try{
  const {data,error}=await supabase.rpc('complete_dashboard_project',{target_project_id:id});
  if(error||data?.id!==id||data?.status!=='done')throw Error('Completion not confirmed');
  p.status='done';dialog.close();render();
 }catch{
  status.textContent='Could not confirm completion. Nothing has been removed from your list. Try again or use Comment.';button.disabled=false;
 }finally{state.completing=false;}
}
function todayView(d){
 const top=state.data.projects.filter(p=>!p.parent_id&&p.status!=='done');
 const open=state.data.sched.filter(i=>i.status!=='done'&&!projectIsDone(d.pm[i.project_id],d.pm));
 const mine=open.filter(i=>i.owner_id===d.aaron), past=mine.filter(i=>i.due_date&&i.due_date<today());
 const upcoming=mine.filter(i=>!i.due_date||i.due_date>=today()).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
 const waiting=top.filter(p=>['waiting','blocked'].includes(p.status));
 const recent=[...top].sort((a,b)=>(d.upd[b.id]?.[0]?.created_at||'').localeCompare(d.upd[a.id]?.[0]?.created_at||'')).slice(0,4);
 return `<section class="hero"><div><span class="eyebrow">YOUR DAILY VIEW</span><h1>What needs your attention.</h1><p>Your assignments first. The team picture below.</p></div><div class="hero-count"><b>${top.length}</b><span>open projects<br>across ${new Set(top.map(p=>p.client_id)).size} clients</span></div></section>
 <section class="focus-section"><div class="section-heading"><div><h2>On your plate <span class="number">${mine.length-past.length}</span></h2><p>Your next dates and undated work. All ${upcoming.length} open assignments, grouped by project and subproject.</p></div><button class="text-button" data-view="schedule" data-mine>See your schedule →</button></div>${milestoneLegend()}${upcoming.length?assignmentGroups(upcoming,d):'<p class="empty">No upcoming assignments recorded for you.</p>'}</section>
 ${past.length?`<details class="status-check"><summary><span class="check-dot"></span>${past.length} past-due record${past.length>1?'s':''} to check <span class="summary-hint">Verify status, not a new ask</span></summary><p>These items still show open in the feed. They may already be complete. Comment to correct them.</p>${assignmentGroups(past,d)}</details>`:''}
 <section><div class="section-heading"><div><h2>Waiting on others <span class="number">${waiting.length}</span></h2><p>Projects marked waiting or blocked. Latest recorded context.</p></div></div><div class="project-grid waiting-grid">${waiting.length?waiting.map(p=>projectCard(p,d)).join(''):'<p class="empty">No waiting projects recorded.</p>'}</div></section>
 <section><div class="section-heading"><div><h2>Latest across the team</h2><p>The most recently updated projects, with source timestamps.</p></div><button class="text-button" data-view="projects">All projects →</button></div><div class="project-grid">${recent.map(p=>projectCard(p,d)).join('')}</div></section>`;
}
function filtered(d){return state.data.projects.filter(p=>!p.parent_id&&(state.status==='all'||state.status==='open'&&p.status!=='done'||state.status===p.status)&&(state.member==='all'||p.owner_id===state.member||(d.sch[p.id]||[]).some(i=>i.owner_id===state.member))&&(state.client==='all'||p.client_id===state.client)&&[p.name,p.description,d.cm[p.client_id]?.name,...(d.upd[p.id]||[]).map(u=>u.note)].join(' ').toLowerCase().includes(state.search.toLowerCase()));}
const opt=(v,cur,t)=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(t)}</option>`;
function filters(schedule=false){return `<div class="filters"><label class="search-label">Search<input id="search" type="search" placeholder="Find a project, client or update" value="${esc(state.search)}"></label><label>Team member<select id="member">${opt('all',state.member,'Everyone')}${state.data.members.map(m=>opt(m.id,state.member,m.name)).join('')}</select></label><label>Client<select id="client">${opt('all',state.client,'All clients')}${state.data.clients.map(c=>opt(c.id,state.client,c.name)).join('')}</select></label><label>Status<select id="status">${opt('open',state.status,'Open')}${opt('all',state.status,'Including done')}${(schedule?['pending','in_progress','waiting','blocked','done']:['active','waiting','blocked','not_started','done']).map(s=>opt(s,state.status,label(s))).join('')}</select></label></div>`;}
function projectsView(d){const list=filtered(d);const groups=by(list,'client_id');return `<div class="page-title"><h1>All projects</h1><p>Find the work, latest context and every project link.</p></div>${filters()}<p class="results">${list.length} projects shown</p>${list.length?Object.keys(groups).sort((a,b)=>(d.cm[a]?.name||'').localeCompare(d.cm[b]?.name||'')).map(c=>`<section><div class="section-heading"><h2>${esc(d.cm[c]?.name||'No client')} <span class="number">${groups[c].length}</span></h2></div><div class="project-grid">${groups[c].map(p=>projectCard(p,d)).join('')}</div></section>`).join(''):'<p class="empty">Nothing matches. Try another filter.</p>'}`;}
function scheduleView(d){
 const xs=state.data.sched.filter(i=>(state.status==='all'||state.status==='open'&&i.status!=='done'&&!projectIsDone(d.pm[i.project_id],d.pm)||state.status!=='open'&&i.status===state.status)&&(state.member==='all'||i.owner_id===state.member)&&(state.client==='all'||d.pm[i.project_id]?.client_id===state.client)&&[i.title,i.notes,d.pm[i.project_id]?.name,d.cm[d.pm[i.project_id]?.client_id]?.name].join(' ').toLowerCase().includes(state.search.toLowerCase()));
 const groups=[['Check recorded status',xs.filter(i=>i.status!=='done'&&i.due_date&&i.due_date<today())],['Upcoming dates',xs.filter(i=>i.status!=='done'&&i.due_date&&i.due_date>=today())],['No date set',xs.filter(i=>i.status!=='done'&&!i.due_date)],['Completed',xs.filter(i=>i.status==='done')]];
 return `<div class="page-title"><h1>Schedule</h1><p>Recorded milestones and assignments, not a live calendar.</p></div>${filters(true)}${milestoneLegend()}<p class="results">${xs.length} items shown · Dates are Mountain time. Past dates need a status check.</p>${groups.filter(([,v])=>v.length).map(([name,v])=>`<section><div class="section-heading"><h2>${name} <span class="number">${v.length}</span></h2></div><div class="task-grid">${v.map(i=>taskCard(i,d)).join('')}</div></section>`).join('')||'<p class="empty">No schedule items match.</p>'}`;
}
function safeLink(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function detail(p,d){const us=d.upd[p.id]||[],ls=d.lnk[p.id]||[],ss=d.sch[p.id]||[],subs=d.subs[p.id]||[];
 return `<div class="dialog-head"><span class="eyebrow">${esc(d.cm[p.client_id]?.name||'PROJECT')}</span>${p.status!=='done'?`<button class="primary complete-button" data-complete="${esc(p.id)}">✓ Complete project</button>`:''}<button class="close" data-close aria-label="Close project details">×</button></div><h2 id="dialog-title">${esc(p.name)}</h2><div class="detail-meta"><span class="pill ${esc(p.status)}">${esc(label(p.status))}</span><span>Lead: ${esc(d.mm[p.owner_id]?.name||'Not assigned')}</span>${commentButton(p)}</div><p id="complete-status" role="status" aria-live="polite"></p>${p.description?`<details class="background"><summary>Project background</summary><p>${esc(p.description)}</p><small>Background may predate the latest updates below.</small></details>`:''}
 <h3 class="detail-heading">Latest update</h3>${latest(p,d,true)}<h3 class="detail-heading">Files & links <span class="number">${ls.length+subs.reduce((n,s)=>n+(d.lnk[s.id]||[]).length,0)}</span></h3>${[...ls,...subs.flatMap(s=>d.lnk[s.id]||[])].map(l=>{const href=safeLink(l.url);return href?`<a class="file-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} <span>↗</span></a>`:`<div class="file-link disabled">${esc(l.label)}<small>URL not recorded</small></div>`;}).join('')||'<p class="muted">No links recorded yet. Comment to add one.</p>'}
 ${projectSchedule(p,d)}${subs.length?`<h3 class="detail-heading">Subprojects</h3>${subs.map(s=>`<article class="subproject"><h4><button class="title-button" data-open="${esc(s.id)}">${esc(s.name)} →</button></h4><span class="pill ${esc(s.status)}">${esc(label(s.status))}</span><p>${esc(s.description)}</p>${commentButton(s)}${projectSchedule(s,d)}</article>`).join('')}`:''}
 <details class="history"><summary>Earlier updates (${Math.max(0,us.length-1)})</summary>${us.slice(1).map(u=>`<article><small>${esc(stamp(u.created_at))} MT</small><p>${esc(u.note)}</p></article>`).join('')||'<p class="muted">No earlier updates.</p>'}</details>`;
}
let lastFocus, dayFocus;
function openDetail(id,itemId){state.focusedTask=itemId||null;if(itemId)state.scheduleModes[id]='list';const d=derive(),p=d.pm[id];if(!p)return;lastFocus=document.activeElement;state.open=id;const dialog=document.querySelector('#detail');dialog.innerHTML=detail(p,d);bind(dialog);if(!dialog.open)dialog.showModal();dialog.querySelector('[data-close]').focus();if(itemId)requestAnimationFrame(()=>{const card=[...dialog.querySelectorAll('[data-task-card]')].find(c=>c.dataset.taskCard===itemId);if(card){card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'instant'});}});}
async function openComment(pid,iid){
 const d=derive(),p=d.pm[pid],i=state.data.sched.find(x=>x.id===iid);if(!p)return;
 lastFocus=document.activeElement;
 const dialog=document.querySelector('#comment-dialog');
 dialog.innerHTML=`<div class="dialog-head"><span class="eyebrow">MESSAGE TO INSTINCT</span><button class="close" data-close aria-label="Close comment">×</button></div><h2 id="comment-title">What should I know?</h2><p class="comment-context">${esc(d.cm[p.client_id]?.name||'Production')} / ${esc(p.name)}${i?' / '+esc(i.title):''}</p><form id="comment-form"><label for="comment-name">Your name</label><input id="comment-name" name="name" required maxlength="120" autocomplete="name" value="${esc(session.user.user_metadata?.display_name||'')}"><label for="comment-note">Your message</label><textarea id="comment-note" name="note" required maxlength="5000" rows="5" placeholder="Share an update, correction or question"></textarea><p class="muted">Saved with your signed-in email and the project context. Instinct checks new messages every few minutes. A message does not change the project automatically.</p><button class="primary" type="submit">Send to Instinct</button><p id="comment-status" role="status" aria-live="polite"></p></form>`;
 bind(dialog);dialog.showModal();dialog.querySelector('#comment-name').focus();
 dialog.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const name=dialog.querySelector('#comment-name').value.trim(),note=dialog.querySelector('#comment-note').value.trim();
  if(!name||!note)return;const button=dialog.querySelector('[type="submit"]'),status=dialog.querySelector('#comment-status');button.disabled=true;status.textContent='Saving your message...';
  const {data,error}=await supabase.from('dashboard_comments').insert({project_id:p.id,schedule_item_id:i?.id||null,author_name:name,note}).select('id,created_at').single();
  if(error){status.textContent='Could not save. Your message is still here. Check your connection or sign-in, then try again.';button.disabled=false;return;}
  status.textContent=`Saved at ${stamp(data.created_at)} MT. Instinct will review it on the next check.`;button.textContent='Message saved';dialog.querySelector('#comment-note').readOnly=true;dialog.querySelector('#comment-name').readOnly=true;
 };
}
function bind(root){
 root.querySelectorAll('[data-complete-task]').forEach(b=>b.onclick=()=>completeTask(b.dataset.completeTask));
 root.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>completeProject(b.dataset.complete));
 root.querySelectorAll('[data-schedule-mode]').forEach(b=>b.onclick=()=>{state.scheduleModes[b.dataset.project]=b.dataset.scheduleMode;refreshDetail();document.querySelector(`[data-project="${b.dataset.project}"][data-schedule-mode="${b.dataset.scheduleMode}"]`)?.focus();});
 root.querySelectorAll('[role="tablist"]').forEach(list=>list.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const tabs=[...list.querySelectorAll('[role="tab"]')],index=tabs.indexOf(document.activeElement);if(index<0)return;
  e.preventDefault();tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length].click();
 });
 root.querySelectorAll('[data-month-step]').forEach(b=>b.onclick=()=>{state.calendarMonths[b.dataset.project]=shiftMonth(state.calendarMonths[b.dataset.project]||today().slice(0,7),Number(b.dataset.monthStep));refreshDetail();document.querySelector(`[data-project="${b.dataset.project}"][data-month-step="${b.dataset.monthStep}"]`)?.focus();});
 root.querySelectorAll('[data-calendar-date]').forEach(b=>b.onclick=()=>openDay(b.dataset.project,b.dataset.calendarDate));
 root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDetail(b.dataset.open,b.dataset.targetItem));
 root.querySelectorAll('[data-comment]').forEach(b=>b.onclick=()=>openComment(b.dataset.comment,b.dataset.item));
 root.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.search='';state.member=b.hasAttribute('data-mine')?derive().aaron:'all';state.client='all';state.status='open';render();window.scrollTo({top:0});});
}
function render(){
 const d=derive(), newest=state.data.updates[0]?.created_at;
 app.innerHTML=`<header class="site-header"><a class="brand" href="#" id="home"><span class="brand-mark" aria-hidden="true">P</span><span>Production<small>MONIGLE / TEAM WORKSPACE</small></span></a><div class="sync"><span class="live-dot"></span>${state.error?'Refresh failed. Showing last loaded data.':`Loaded ${state.loaded.toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit'})} MT`}<button id="refresh" aria-label="Refresh data">↻</button><button id="signout">Sign out</button></div></header>
 <nav aria-label="Dashboard views">${[['today','Today'],['projects','Projects'],['schedule','Schedule']].map(([v,t])=>`<button data-view="${v}" ${state.view===v?'aria-current="page"':''}>${t}</button>`).join('')}</nav><main>${state.view==='today'?todayView(d):state.view==='projects'?projectsView(d):scheduleView(d)}</main><div class="footnote">Latest feed entry: ${newest?esc(stamp(newest))+' MT':'none recorded'}. Loading this page does not mean every project was checked.<br>Missing a change? Use Comment on any project or schedule item.</div><dialog id="detail" aria-labelledby="dialog-title"></dialog><dialog id="comment-dialog" aria-labelledby="comment-title"></dialog><dialog id="day-dialog" aria-labelledby="day-title"></dialog>`;
 bind(app);document.querySelector('#signout').onclick=()=>supabase.auth.signOut();document.querySelector('#refresh').onclick=load;document.querySelector('#home').onclick=e=>{e.preventDefault();state.view='today';render();};
 for(const [id,key] of [['member','member'],['client','client'],['status','status']])document.getElementById(id)?.addEventListener('change',e=>{state[key]=e.target.value;render();document.getElementById(id).focus();});
 document.getElementById('search')?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.search=e.target.value;render();const el=document.getElementById('search');el.focus();el.setSelectionRange(pos,pos);});
 document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>{if(dialog.id==='detail')state.open=null;if(dialog.id==='day-dialog')state.openDay=null;(dialog.id==='day-dialog'?dayFocus:lastFocus)?.focus();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});});
}
function loginView(message=''){
 app.innerHTML=`<main class="login-shell"><section class="login-card"><span class="eyebrow">PRODUCTION / MONIGLE</span><h1>Your team workspace.</h1><p>Sign in to see projects and send messages to Instinct.</p><form id="login-form"><label for="email">Your approved team email</label><input id="email" type="email" autocomplete="username" required placeholder="you@example.com"><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required><button class="primary" type="submit">Sign in</button></form><button id="forgot" class="text-button">Forgot your password?</button><p id="login-status" role="status">${esc(message)}</p><p class="muted">Access is limited to the team's approved email list. Ask Aaron if you need access.</p></section></main>`;
 const status=document.querySelector('#login-status');
 document.querySelector('#login-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;status.textContent='Signing in...';const {error}=await supabase.auth.signInWithPassword({email:document.querySelector('#email').value.trim().toLowerCase(),password:document.querySelector('#password').value});b.disabled=false;if(error)status.textContent='Sign-in did not work. Check your email and password, or ask Aaron to check your access.';};
 document.querySelector('#forgot').onclick=async()=>{const email=document.querySelector('#email').value.trim();if(!email){status.textContent='Enter your email above first.';return;}const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/#reset'});status.textContent=error?'Could not request a reset. Try again later.':'If that address has an account, a reset link will arrive by email.';};
}
function passwordView(){
 app.innerHTML='<main class="login-shell"><section class="login-card"><h1>Set your own password.</h1><p>Use a password only you know.</p><form id="password-form"><label for="new-password">New password</label><input id="new-password" type="password" autocomplete="new-password" required minlength="10"><button class="primary">Save password</button><p id="password-status" role="status"></p></form></section></main>';
 document.querySelector('form').onsubmit=async e=>{e.preventDefault();const {error}=await supabase.auth.updateUser({password:document.querySelector('#new-password').value});if(error){document.querySelector('#password-status').textContent='Could not change the password. Try again.';return;}history.replaceState({},'',window.location.pathname);startSession(session);};
}
async function startSession(next){
 session=next;state.data=null;
 if(!session){loginView();return;}
 app.innerHTML='<div class="loading"><h1>Checking team access...</h1></div>';
 const {data,error}=await supabase.rpc('is_dashboard_member');
 if(error||!data){app.innerHTML='<main class="login-shell"><section class="login-card"><h1>Team access is not enabled for this email.</h1><p>Ask Aaron to add your exact sign-in email to the approved list.</p><button id="signout">Sign out</button></section></main>';document.querySelector('#signout').onclick=()=>supabase.auth.signOut();return;}
 load();
}
supabase.auth.onAuthStateChange((event,next)=>{setTimeout(()=>{session=next;if(event==='PASSWORD_RECOVERY'||next&&window.location.hash==='#reset')passwordView();else startSession(next);},0);});
// Do not refresh underneath a draft or while someone is reading a project.
setInterval(()=>{if(session&&state.data&&!document.hidden&&!document.querySelector('dialog[open]'))load();},5*60*1000);
