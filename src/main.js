import { createClient } from '@supabase/supabase-js';
import './style.css';
import {shiftDate,weekWindow,needsAttention,weeklyCounts,matchUpdate,lateDependencies,recordedDay,normalizeDependencies} from './insights.js';
import { accessProfile, isFreelancer, canCompleteItem, workloadCounts } from './access.js';
import { dateKey, groupAssignments, projectIsDone, clientMilestone, milestoneKind, isWeekend, monthCells, shiftMonth, nextMilestone, timelineSteps, timelineStepState } from './schedule.js';
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const app = document.querySelector('#app');
const supabase = createClient(URL_, KEY);
let session = null;
let activeUserId=null;
const TZ = 'America/Denver';
const state = { data: null, view: 'today', member: 'all', client: 'all', status: 'open', search: '', open: null, busy: false, scheduleModes: {}, calendarMonths: {}, completing: false, openDay: null, focusedTask: null, expandedProjects: {}, sectionModes: {}, access: null, accessReady: false, workloadMember: 'all', workScope: 'mine', quickDrafts: {}, matchText: '', matchItem: null, matchSaving: false, matchFeedback: '', dependencyEdges: [], dependencyAvailable: false };
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
 const aaron=state.access?.team_member_id||(!state.accessReady?members.find(x=>x.name==='Aaron Finkelstein')?.id:null);
 return {cm,pm,mm,aaron,upd:by(updates,'project_id'),lnk:by(links,'project_id'),sch:by(sched,'project_id'),subs:by(projects.filter(p=>p.parent_id),'parent_id')};
}
async function q(table,params){const r=await fetch(`${URL_}/rest/v1/${table}?${params}`,{headers:{apikey:KEY,Authorization:`Bearer ${session.access_token}`}});if(!r.ok)throw Error('Data request failed');return r.json();}
async function load(){
 if(!session){loginView();return;}if(state.busy)return;state.busy=true;
 if(!state.data)app.innerHTML='<div class="loading"><span class="eyebrow">PRODUCTION / MONIGLE</span><h1>Getting the latest...</h1></div>';
 try {
  if(!URL_||!KEY)throw Error('Configuration missing');
  const [clients,projects,members,updates,links,sched]=await Promise.all([q('clients','select=*&order=name'),q('projects','select=*&order=sort_order,name'),q('team_members','select=*&active=eq.true&order=name'),q('project_updates','select=*&order=created_at.desc'),q('project_links','select=*&order=created_at'),q('schedule_items','select=*&order=due_date.asc.nullslast')]);
  const dependencies=isFreelancer(state.access)?null:await q('schedule_dependencies','select=item_id,depends_on_id').catch(()=>null);
  state.dependencyAvailable=Array.isArray(dependencies);state.dependencyEdges=normalizeDependencies(Array.isArray(dependencies)?dependencies:[]);
  state.data={clients,projects,members,updates,links,sched};state.loaded=new Date();state.error=false;render();
 }catch(e){state.error=true;if(state.data)render();else app.innerHTML='<div class="loading"><h1>Could not load production.</h1><p>Nothing has been changed. Try again in a moment.</p><button id="retry">Try again</button></div>';document.querySelector('#retry')?.addEventListener('click',load);}
 finally{state.busy=false;}
}
let quickSequence=0;
function quickInput(p,item){
 const key=item?.id||'project-'+p.id,fieldId='quick-'+(++quickSequence);
 return `<form class="quick-update" data-quick-update="${esc(key)}" data-quick-project="${esc(p.id)}" ${item?`data-quick-item="${esc(item.id)}"`:''}><label for="${fieldId}">Quick update</label><div class="quick-entry"><textarea id="${fieldId}" rows="1" maxlength="5000" required placeholder="Progress, blocker or a date change...">${esc(state.quickDrafts[key]||'')}</textarea><button type="submit">Send</button></div><span class="quick-feedback" role="status" aria-live="polite"></span></form>`;
}
function commentButton(p,item){return `<button class="comment" data-comment="${esc(p.id)}" ${item?`data-item="${esc(item.id)}"`:''} aria-label="Comment to Instinct about ${esc(item?.title||p.name)}"><span aria-hidden="true">↗</span> Update</button>`;}
function latest(p,d,full=false){const u=d.upd[p.id]?.[0];return `<div class="update"><div class="caption">LATEST UPDATE <span>${u?esc(stamp(u.created_at))+' MT':''}</span></div><p class="${full?'':'clamp'}">${esc(u?.note || p.description || 'No update recorded yet.')}</p></div>`;}
function timeline(p,d,representedItem=null,representedProject=null){
 const steps=timelineSteps(p,state.data.sched,d.pm);if(!steps.length)return '';
 return `<ol class="mini-timeline" aria-label="Steps for ${esc(p.name)}">${steps.map(i=>`<li class="timeline-step step-${timelineStepState(i)} kind-${milestoneKind(i)||'normal'}${(representedItem?.id===i.id||representedProject?.id===i.project_id)?' step-represented':''}" title="${esc(i.title)} · ${esc(label(i.status))}${i.due_date?' · '+esc(fmtDate(i.due_date)):''}" aria-label="${esc(i.title)}: ${esc(label(i.status))}${milestoneKind(i)?', '+milestoneKind(i):''}"><span class="step-circle" aria-hidden="true"></span><span class="step-date" aria-hidden="true">${dateKey(i.due_date)?`${Number(dateKey(i.due_date).slice(5,7))}/${Number(dateKey(i.due_date).slice(8,10))}`:'TBD'}</span></li>`).join('')}</ol>`;
}
function projectCard(p,d){
 const next=(d.sch[p.id]||[]).filter(i=>i.status!=='done' && i.due_date && i.due_date>=today())[0];
 const ds=due(next?.due_date||p.due_date,p.status);
 const milestone=p.status==='done'?null:nextMilestone(p,state.data.sched,d.pm,today());
 return `<article class="project-card ${timelineSteps(p,state.data.sched,d.pm).some(i=>i.status==='in_progress')?'has-current-step':''}">${timeline(p,d,null,p.parent_id?p:null)}<div class="card-top"><span class="eyebrow">${esc(d.cm[p.client_id]?.name||'No client')}</span><span class="pill ${esc(p.status)}">${esc(label(p.status))}</span></div><h3><button class="title-button" data-open="${p.id}">${esc(shortName(p,d))}</button></h3>${latest(p,d)}${milestone?`<p class="next-milestone milestone-${milestoneKind(milestone)}"><strong>Next ${milestoneKind(milestone)==='review'?'REVIEW':'RELEASE'}</strong> · ${esc(fmtDate(milestone.due_date))}<span>${esc(milestone.title)}</span></p>`:''}<div class="card-meta"><span>Lead: ${esc(d.mm[p.owner_id]?.name||'Not assigned')}</span><span class="${ds.cls}">${esc(ds.text)}${next?' · '+esc(next.title):''}</span></div><footer><button class="text-button" data-open="${p.id}">Details & links →</button>${commentButton(p)}</footer></article>`;
}
function milestoneLegend(){return '<div class="calendar-legend" aria-label="Milestone colors"><span class="legend-review">REVIEW · Client review / approval</span><span class="legend-release">RELEASE · Release / client delivery</span></div>';}
function taskCard(i,d,expanded=false){
 const p=d.pm[i.project_id];if(!p)return '';const dt=due(i.due_date,i.status),kind=milestoneKind(i);
 if(i.status==='done'&&!expanded)return `<details class="finished-task" data-finished-task="${esc(i.id)}"><summary><span class="finished-check" aria-hidden="true">✓</span><span class="finished-title">${esc(i.title)}</span><span class="finished-date">${i.due_date?esc(fmtDate(i.due_date)):'No date'}</span><span class="finished-label">Done</span></summary>${taskCard(i,d,true)}</details>`;

 return `<article class="task-card compact-task ${i.status==='in_progress'?'has-current-step':i.status==='done'?'is-finished':''} ${kind?`client-milestone milestone-${kind}`:''}" data-task-card="${esc(i.id)}" tabindex="-1" ${state.focusedTask===i.id?'data-task-highlight="true"':''}>
 <div class="task-row-main"><span class="task-kind kind-${kind||'normal'}" title="${kind==='review'?'Client review':kind==='release'?'Client delivery':'Task'}" aria-hidden="true"></span><div class="task-row-title"><h3><button class="title-button" data-open="${esc(p.id)}" data-target-item="${esc(i.id)}">${esc(i.title)}</button></h3><p class="task-context">${esc(d.cm[p.client_id]?.name||'')} / ${esc(shortName(p,d))}</p></div><span class="task-date ${dt.cls}">${esc(dt.text)}</span></div>
 <div class="task-row-meta"><span class="owner">${esc(d.mm[i.owner_id]?.name||'Unassigned')}</span><span class="pill ${esc(i.status)}">${esc(label(i.status))}</span>${kind?`<span class="compact-milestone">${kind==='review'?'Review':'Release'}</span>`:''}</div>
 ${state.dependencyAvailable&&(lateDependencies(state.data.sched,state.dependencyEdges,today())[i.id]||[]).length?`<div class="risk-badge">At risk: late upstream · ${lateDependencies(state.data.sched,state.dependencyEdges,today())[i.id].map(x=>esc(x.title)).join(', ')}</div>`:''}${timeline(p,d,i)}${quickInput(p,i)}
 <div class="task-row-actions">${i.status!=='done'&&!projectIsDone(p,d.pm)&&canCompleteItem(state.access,i)?`<button class="compact-done" data-complete-task="${esc(i.id)}" aria-label="Mark task done: ${esc(i.title)}">✓ Done</button>`:''}</div><details class="task-more"><summary>Context</summary>${i.notes?`<p class="task-note">${esc(i.notes)}</p>`:''}<footer><button class="text-button" data-open="${esc(p.id)}" data-target-item="${esc(i.id)}">Open project →</button></footer></details><p class="task-complete-status" role="status" aria-live="polite"></p></article>`;

}
function assignmentGroups(items,d){
 return groupAssignments(items,d.pm).map(group=>`<section class="assignment-group"><div class="assignment-heading"><h3><button class="title-button" data-open="${esc(group.project.id)}">${esc(d.cm[group.project.client_id]?.name||'Production')} / ${esc(shortName(group.project,d))}</button></h3><span class="number" aria-label="${group.count} assignments">${group.count}</span></div>${[...group.branches.values()].map(branch=>`${branch.project.id!==group.project.id?`<h4 class="branch-heading"><button class="title-button" data-open="${esc(branch.project.id)}">${esc(shortName(branch.project,d))}</button><span>${branch.items.length} assignment${branch.items.length===1?'':'s'}</span></h4>`:''}<div class="task-grid">${branch.items.map(i=>taskCard(i,d)).join('')}</div>`).join('')}</section>`).join('');
}
function projectStepListings(p,d,seen=new Set()){
 if(seen.has(p.id))return '';seen.add(p.id);
 const items=d.sch[p.id]||[];
 return `<section class="page-step-group"><h4><button class="title-button" data-open="${esc(p.id)}">${esc(shortName(p,d))}</button></h4><div class="task-grid">${items.map(i=>taskCard(i,d)).join('')||'<p class="muted">No direct steps recorded.</p>'}</div>${(d.subs[p.id]||[]).map(child=>projectStepListings(child,d,seen)).join('')}</section>`;
}
function projectSchedule(p,d,rollup=false){
 const key=rollup?'page-'+p.id:p.id;
 const items=rollup?timelineSteps(p,state.data.sched,d.pm):d.sch[p.id]||[],mode=state.scheduleModes[key]||'list';
 const month=state.calendarMonths[key]||today().slice(0,7);state.calendarMonths[key]=month;
 const monthName=new Date(month+'-01T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
 return `<section class="project-schedule"><div class="schedule-heading"><h3 class="detail-heading">Schedule <span class="number">${items.length}</span></h3><div class="schedule-tabs" role="tablist" aria-label="Schedule view for ${esc(p.name)}">${['list','calendar'].map(v=>`<button role="tab" id="tab-${esc(key)}-${v}" aria-controls="schedule-${esc(key)}" aria-selected="${mode===v}" data-schedule-mode="${v}" data-project="${esc(p.id)}" data-schedule-key="${esc(key)}">${v==='list'?'List':'Calendar'}</button>`).join('')}</div></div><div id="schedule-${esc(key)}" role="tabpanel" aria-labelledby="tab-${esc(key)}-${mode}">${mode==='list'?(rollup?projectStepListings(p,d):items.map(i=>taskCard(i,d)).join(''))||'<p class="muted">No schedule items recorded.</p>':`<div class="calendar-toolbar"><button data-month-step="-1" data-project="${esc(p.id)}" data-schedule-key="${esc(key)}" aria-label="Previous month">‹</button><h4 aria-live="polite">${esc(monthName)}</h4><button data-month-step="1" data-project="${esc(p.id)}" data-schedule-key="${esc(key)}" aria-label="Next month">›</button></div><p class="calendar-hint">Weekdays only. Tap a date for all cards.</p>${milestoneLegend()}<div class="calendar-grid">${['Mon','Tue','Wed','Thu','Fri'].map(day=>`<span class="weekday">${day}</span>`).join('')}${monthCells(month).map(key=>{if(!key)return '<span class="calendar-blank" aria-hidden="true"></span>';const daily=items.filter(i=>dateKey(i.due_date)===key),client=daily.some(clientMilestone);return `<button class="calendar-day ${key===today()?'is-today':''} " data-calendar-date="${key}" data-project="${esc(p.id)}" ${rollup?'data-rollup="true"':''} aria-label="${esc(fmtDate(key))}, ${daily.length} schedule items${client?', includes client milestone':''}" ${key===today()?'aria-current="date"':''}><span>${Number(key.slice(8))}</span>${daily.length?`<span class="calendar-events">${daily.slice(0,3).map(i=>`<span class="calendar-event ${milestoneKind(i)?`event-${milestoneKind(i)}`:''} ${i.status==='done'?'event-done':''}" title="${esc(i.title)}">${esc(i.title)}</span>`).join('')}${daily.length>3?`<span class="calendar-more">+${daily.length-3} more</span>`:''}</span>`:''}</button>`;}).join('')}</div>${weekendSchedule(items,month,p.id,d,rollup)}${items.some(i=>!dateKey(i.due_date))?`<div class="undated"><h4>No date set</h4>${items.filter(i=>!dateKey(i.due_date)).map(i=>taskCard(i,d)).join('')}</div>`:''}`}</div></section>`;
}
function weekendSchedule(items,month,pid,d,rollup=false){
 const weekend=items.filter(i=>dateKey(i.due_date)?.startsWith(month)&&isWeekend(dateKey(i.due_date)));
 if(!weekend.length)return '';
 return `<details class="weekend-schedule"><summary>Weekend dates (${weekend.length})</summary><p class="calendar-hint">These records stay available outside the weekday grid.</p>${Object.entries(by(weekend.map(i=>({...i,day:dateKey(i.due_date)})),'day')).map(([key,rows])=>`<button class="text-button" data-calendar-date="${key}" data-project="${esc(pid)}" ${rollup?'data-rollup="true"':''}>${esc(fmtDate(key))} · ${rows.length} card${rows.length===1?'':'s'} →</button>${rows.map(i=>taskCard(i,d)).join('')}`).join('')}</details>`;
}
function refreshDetail(){const dialog=document.querySelector('#detail');dialog.innerHTML=detail(derive().pm[state.open],derive());bind(dialog);}
function openDay(pid,key,rollup=false){
 const d=derive(),p=d.pm[pid],items=(rollup?timelineSteps(p,state.data.sched,d.pm):d.sch[pid]||[]).filter(i=>dateKey(i.due_date)===key),dialog=document.querySelector('#day-dialog');
 state.openDay={pid,key,rollup};dayFocus=document.activeElement;
 dialog.innerHTML=`<div class="dialog-head"><span class="eyebrow">${esc(p.name)}</span><button class="close" data-close aria-label="Close date cards">×</button></div><h2 id="day-title">${esc(new Date(key+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}))}</h2><p class="day-summary">${items.length} schedule item${items.length===1?'':'s'}</p>${items.map(i=>taskCard(i,d)).join('')||'<p class="empty">Nothing scheduled on this date.</p>'}`;
 bind(dialog);
 dialog.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{dialog.close();openDetail(b.dataset.open,b.dataset.targetItem);});
 dialog.querySelectorAll('[data-comment]').forEach(b=>b.onclick=()=>{dialog.close();openComment(b.dataset.comment,b.dataset.item);});
 dialog.showModal();dialog.querySelector('[data-close]').focus();
}
async function completeTask(id){
 if(state.completing)return;
 const item=state.data.sched.find(i=>i.id===id);if(!item||item.status==='done'||!canCompleteItem(state.access,item))return;
 if(!window.confirm(`Mark task "${item.title}" done? Only this task will be completed, not its project. It will move to Finished steps.`))return;
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
  if(projectId){openDetail(projectId,state.focusedTask,true);document.querySelector('#detail').scrollTop=detailScroll;}
  if(day)openDay(day.pid,day.key,day.rollup);
 }catch{
  cards.forEach(c=>{c.querySelector('.task-complete-status').textContent='Could not confirm completion. This task has not been removed. Try again or use Comment.';c.querySelector('[data-complete-task]').disabled=false;});
 }finally{state.completing=false;}
}
async function completeProject(id){
 if(state.completing)return;
 const p=derive().pm[id];if(!p||p.status==='done'||isFreelancer(state.access))return;
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
function taskSection(key,name,rows,d,{compact=false,description='',reasons={},className='work-bucket'}={}){
 const collapsed=state.sectionModes[key]??compact,bodyId='section-'+key;
 return `<section class="${className}" data-task-section="${esc(key)}"><div class="section-heading"><h2>${esc(name)} <span class="number">${rows.length}</span></h2>${description?`<p>${esc(description)}</p>`:''}<button class="section-toggle" data-section-toggle="${esc(key)}" aria-expanded="${!collapsed}" aria-controls="${esc(bodyId)}" aria-label="${collapsed?'Expand':'Collapse'} ${esc(name)}">${collapsed?'Expand':'Collapse'}</button></div><div id="${esc(bodyId)}" class="${collapsed?'needs-strip':'task-grid'}">${rows.map(i=>collapsed?`<button class="needs-item" data-open="${esc(i.project_id)}" data-target-item="${esc(i.id)}"><strong>${esc(i.title)}</strong><span>${esc(d.pm[i.project_id]?.name)}</span><small>${esc((reasons[i.id]||[]).join(' · ')||due(i.due_date,i.status).text)} · ${esc(d.mm[i.owner_id]?.name||'Unassigned')}</small></button>`:taskCard(i,d,i.status==='done')).join('')||'<p class="muted">No matching items.</p>'}</div></section>`;
}
function needsYou(d,items){const matches=needsAttention(items,d.pm,today(),d.aaron);return taskSection('today-attention','Needs attention',matches.map(x=>x.item),d,{compact:true,className:'needs-you',description:'Blocked on the selected owner, due within two days, or missing an owner.',reasons:Object.fromEntries(matches.map(x=>[x.item.id,x.reasons]))});}
function textUpdateView(d){const candidates=matchUpdate(state.matchText,state.data.sched,d.pm);return `<details class="text-update" ${state.matchText||state.matchFeedback?'open':''}><summary>Text an update</summary><p>Type a project or step and an update. Choose the exact step below before sending. This uses your signed-in dashboard identity.</p><label for="match-text">Update text</label><textarea id="match-text" maxlength="5000" ${state.matchSaving?'disabled':''} rows="2" placeholder="CareCredit proofs done">${esc(state.matchText)}</textarea><p class="match-feedback" role="status">${esc(state.matchFeedback)}</p>${state.matchText?`<div class="match-results">${candidates.map(i=>`<button data-match-item="${esc(i.id)}" ${state.matchSaving?'disabled':''} aria-pressed="${state.matchItem===i.id}">${esc(d.pm[i.project_id]?.name)} / ${esc(i.title)}</button>`).join('')||'<p>No exact keyword match. Use the update box on the step itself.</p>'}</div>${state.matchItem&&candidates.some(i=>i.id===state.matchItem)?`<form id="matched-update"><p>Send to <strong>${esc(d.pm[state.data.sched.find(i=>i.id===state.matchItem)?.project_id]?.name)} / ${esc(state.data.sched.find(i=>i.id===state.matchItem)?.title)}</strong></p><button type="submit" ${state.matchSaving?'disabled':''}>Send this update</button><span role="status"></span></form>`:''}`:''}</details>`;}
function recapView(d){const {start,end}=weekWindow(today()),items=state.data.sched,open=items.filter(i=>i.status!=='done'&&!projectIsDone(d.pm[i.project_id],d.pm)),past=open.filter(i=>dateKey(i.due_date)&&dateKey(i.due_date)<today()),waiting=open.filter(i=>i.status==='waiting'||d.pm[i.project_id]?.status==='waiting');return `<div class="page-title"><h1>Weekly recap</h1><p>${esc(fmtDate(start))} - ${esc(fmtDate(end))} · live snapshot, not timesheet hours</p></div><p class="recap-caveat">This feed has no step completion timestamps or step-level date history, so weekly completions and actual deadline slips cannot be counted. A completion is not proof of client delivery. Past dates are not proof a deadline slipped. A recorded date-change history is needed for that.</p>${[['Past dates needing status check',past],['Waiting',waiting]].map(([name,rows])=>taskSection('recap-'+name.replaceAll(' ','-'),name,rows,d,{className:'recap-group'})).join('')}<section class="recap-group"><h2>Completed this week</h2><p class="muted">Unavailable: this feed does not record when a step was completed.</p></section><section><h2>Recorded project updates this week</h2>${state.data.updates.filter(u=>recordedDay(u.created_at)>=start&&recordedDay(u.created_at)<=end).map(u=>`<article class="recap-note"><strong>${esc(d.pm[u.project_id]?.name)}</strong><small>${esc(stamp(u.created_at))} MT</small><p>${esc(u.note)}</p></article>`).join('')||'<p class="muted">No recorded updates this week.</p>'}</section>`;}
function todayView(d){
 const open=state.data.sched.filter(i=>!projectIsDone(d.pm[i.project_id],d.pm));
 const scope=isFreelancer(state.access)?'mine':state.workScope;
 const selected=scope==='team'?open:open.filter(i=>i.owner_id===d.aaron);
 const outstanding=selected.filter(i=>i.status!=='done');
 const counts=workloadCounts(selected,d.pm,projectIsDone,today());
 const buckets=[['Past dates',outstanding.filter(i=>i.due_date&&i.due_date<today())],['Today',outstanding.filter(i=>i.due_date===today())],['Coming up',outstanding.filter(i=>i.due_date&&i.due_date>today()).sort((a,b)=>a.due_date.localeCompare(b.due_date))],['No date set',outstanding.filter(i=>!i.due_date)]];
 return `<section class="hero"><div><span class="eyebrow">${scope==='team'?'TEAM WORK':'MY WORK'}</span><h1>${scope==='team'?'The team at a glance.':'What needs attention.'}</h1><p>${scope==='team'?'Open work across everyone. Filter by person in Workload.':'Your next steps, grouped by date. Add an update without leaving the list.'}</p></div>${!isFreelancer(state.access)?`<div class="work-scope" aria-label="Work scope"><button data-work-scope="mine" aria-pressed="${scope==='mine'}">My work</button><button data-work-scope="team" aria-pressed="${scope==='team'}">Team work</button></div>`:''}</section>
 <div class="work-stats"><span><b>${counts.open}</b> Open steps</span><span><b>${counts.inProgress}</b> In progress</span><span><b>${counts.due}</b> Due today</span><span><b>${counts.past}</b> Past dates</span></div>
 ${!d.aaron&&scope==='mine'?'<p class="access-note">Your login is not linked to a team member yet. A manager can set that up. Use Workload to choose a person if you have team access.</p>':''}
 ${needsYou(d,scope==='team'?open:[...selected,...(!isFreelancer(state.access)?open.filter(i=>!i.owner_id):[])])}${textUpdateView(d)}<section class="focus-section">${buckets.filter(([,rows])=>rows.length).map(([name,rows])=>taskSection('today-'+name.replaceAll(' ','-'),name,rows,d,{description:name==='Past dates'?'Recorded dates. Check status before treating these as new asks.':''})).join('')||'<p class="empty">No open steps in this view.</p>'}</section>
 ${taskSection('today-finished','Finished steps',selected.filter(i=>i.status==='done'),d,{compact:true,className:'completed-work'})}`;
}
function workloadView(d){
 const open=state.data.sched.filter(i=>i.status!=='done'&&!projectIsDone(d.pm[i.project_id],d.pm));
 const rows=state.workloadMember==='all'?open:open.filter(i=>(i.owner_id||'unassigned')===state.workloadMember);
 const maxWeek=Math.max(1,...state.data.members.map(m=>weeklyCounts(open.filter(i=>i.owner_id===m.id),d.pm,today()).week));
 const owners=[...state.data.members.map(m=>({id:m.id,name:m.name})),{id:'unassigned',name:'Unassigned'}];
 return `<div class="page-title"><h1>Team workload</h1><p>Open steps by owner. Bars compare steps due this week. They are relative counts, not hours or capacity.</p>${!state.dependencyAvailable?'<p class="dependency-note">Upstream risk checks are unavailable until explicit dependency records are connected. No links are inferred from timeline order.</p>':''}</div><div class="workload-people"><button data-workload-person="all" aria-pressed="${state.workloadMember==='all'}"><strong>Everyone</strong><span>${open.length} open</span></button>${owners.map(m=>{const items=open.filter(i=>(i.owner_id||'unassigned')===m.id),c=workloadCounts(items,d.pm,projectIsDone,today());return `<button data-workload-person="${esc(m.id)}" aria-pressed="${state.workloadMember===m.id}"><strong>${esc(m.name)}</strong><span>${c.open} open · ${c.inProgress} in progress</span><span>${weeklyCounts(items,d.pm,today()).week} due this week · ${c.past} past dates</span><span class="workload-bar" aria-hidden="true"><i style="width:${Math.round(weeklyCounts(items,d.pm,today()).week/maxWeek*100)}%"></i></span></button>`;}).join('')}</div>${taskSection('workload-steps','Assigned steps',rows.sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999')),d,{className:'workload-rows'})}`;
}
function filtered(d){return state.data.projects.filter(p=>!p.parent_id&&(state.status==='all'||state.status==='open'&&p.status!=='done'||state.status===p.status)&&(state.member==='all'||p.owner_id===state.member||(d.sch[p.id]||[]).some(i=>i.owner_id===state.member))&&(state.client==='all'||p.client_id===state.client)&&[p.name,p.description,d.cm[p.client_id]?.name,...(d.upd[p.id]||[]).map(u=>u.note)].join(' ').toLowerCase().includes(state.search.toLowerCase()));}
const opt=(v,cur,t)=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(t)}</option>`;
function filters(schedule=false){return `<div class="filters"><label class="search-label">Search<input id="search" type="search" placeholder="Find a project, client or update" value="${esc(state.search)}"></label><label>Team member<select id="member">${opt('all',state.member,'Everyone')}${state.data.members.map(m=>opt(m.id,state.member,m.name)).join('')}</select></label><label>Client<select id="client">${opt('all',state.client,'All clients')}${state.data.clients.map(c=>opt(c.id,state.client,c.name)).join('')}</select></label><label>Status<select id="status">${opt('open',state.status,schedule?'Active projects + finished steps':'Open')}${opt('all',state.status,'Including done')}${(schedule?['pending','in_progress','waiting','blocked','done']:['active','waiting','blocked','not_started','done']).map(s=>opt(s,state.status,label(s))).join('')}</select></label></div>`;}
function projectListing(p,d){
 return `<details class="project-listing" data-project-listing="${esc(p.id)}" ${state.expandedProjects[p.id]?'open':''}><summary><span class="listing-name">${esc(shortName(p,d))}</span>${timeline(p,d)}<span class="pill ${esc(p.status)}">${esc(label(p.status))}</span><span class="listing-chevron" aria-hidden="true">▸</span></summary><div class="listing-content">${latest(p,d)}<div class="listing-actions"><button class="text-button" data-open="${esc(p.id)}">Details & links →</button>${commentButton(p)}</div>${quickInput(p)}${projectSchedule(p,d,true)}</div></details>`;
}
function projectsView(d){const list=filtered(d);const groups=by(list,'client_id');return `<div class="page-title"><h1>All projects</h1><p>Find the work, latest context and every project link.</p></div>${filters()}<div class="project-expand-controls"><button data-expand-projects="true">Expand all</button><button data-expand-projects="false">Collapse all</button></div><p class="results">${list.length} projects shown</p>${list.length?Object.keys(groups).sort((a,b)=>(d.cm[a]?.name||'').localeCompare(d.cm[b]?.name||'')).map(c=>`<section><div class="section-heading"><h2>${esc(d.cm[c]?.name||'No client')} <span class="number">${groups[c].length}</span></h2></div><div class="project-listings">${groups[c].map(p=>projectListing(p,d)).join('')}</div></section>`).join(''):'<p class="empty">Nothing matches. Try another filter.</p>'}`;}
function scheduleView(d){
 const xs=state.data.sched.filter(i=>(state.status==='all'||state.status==='open'&&!projectIsDone(d.pm[i.project_id],d.pm)||state.status!=='open'&&i.status===state.status)&&(state.member==='all'||i.owner_id===state.member)&&(state.client==='all'||d.pm[i.project_id]?.client_id===state.client)&&[i.title,i.notes,d.pm[i.project_id]?.name,d.cm[d.pm[i.project_id]?.client_id]?.name].join(' ').toLowerCase().includes(state.search.toLowerCase()));
 const groups=[['Previous dates',xs.filter(i=>i.due_date&&i.due_date<today())],['Upcoming dates',xs.filter(i=>i.due_date&&i.due_date>=today())],['No date set',xs.filter(i=>!i.due_date)]];
 return `<div class="page-title"><h1>Schedule</h1><p>Recorded milestones and assignments, not a live calendar.</p></div>${filters(true)}${milestoneLegend()}<p class="results">${xs.length} items shown · Dates are Mountain time. Past dates need a status check.</p>${groups.filter(([,v])=>v.length).map(([name,v])=>taskSection('schedule-'+name.replaceAll(' ','-'),name,v,d)).join('')||'<p class="empty">No schedule items match.</p>'}`;
}
function safeLink(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function detail(p,d){const us=d.upd[p.id]||[],ls=d.lnk[p.id]||[],ss=d.sch[p.id]||[],subs=d.subs[p.id]||[];
 return `<div class="dialog-head"><span class="eyebrow">${esc(d.cm[p.client_id]?.name||'PROJECT')}</span>${p.status!=='done'&&!isFreelancer(state.access)?`<button class="primary complete-button" data-complete="${esc(p.id)}">✓ Complete project</button>`:''}<button class="close" data-close aria-label="Close project details">×</button></div><h2 id="dialog-title">${esc(p.name)}</h2><div class="detail-meta"><span class="pill ${esc(p.status)}">${esc(label(p.status))}</span><span>Lead: ${esc(d.mm[p.owner_id]?.name||'Not assigned')}</span>${commentButton(p)}</div><p id="complete-status" role="status" aria-live="polite"></p>${p.description?`<details class="background"><summary>Project background</summary><p>${esc(p.description)}</p><small>Background may predate the latest updates below.</small></details>`:''}
 <h3 class="detail-heading">Latest update</h3>${latest(p,d,true)}<h3 class="detail-heading">Files & links <span class="number">${ls.length+subs.reduce((n,s)=>n+(d.lnk[s.id]||[]).length,0)}</span></h3>${[...ls,...subs.flatMap(s=>d.lnk[s.id]||[])].map(l=>{const href=safeLink(l.url);return href?`<a class="file-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} <span>↗</span></a>`:`<div class="file-link disabled">${esc(l.label)}<small>URL not recorded</small></div>`;}).join('')||'<p class="muted">No links recorded yet. Comment to add one.</p>'}
 ${projectSchedule(p,d)}${subs.length?`<h3 class="detail-heading">Subprojects</h3>${subs.map(s=>`<article class="subproject">${timeline(s,d,null,s)}<h4><button class="title-button" data-open="${esc(s.id)}">${esc(s.name)} →</button></h4><span class="pill ${esc(s.status)}">${esc(label(s.status))}</span><p>${esc(s.description)}</p>${commentButton(s)}${projectSchedule(s,d)}</article>`).join('')}`:''}
 <details class="history"><summary>Earlier updates (${Math.max(0,us.length-1)})</summary>${us.slice(1).map(u=>`<article><small>${esc(stamp(u.created_at))} MT</small><p>${esc(u.note)}</p></article>`).join('')||'<p class="muted">No earlier updates.</p>'}</details>`;
}
let lastFocus, dayFocus;
function openDetail(id,itemId,preserveMode=false){state.focusedTask=itemId||null;if(itemId&&!preserveMode)state.scheduleModes[id]='list';const d=derive(),p=d.pm[id];if(!p)return;lastFocus=document.activeElement;state.open=id;const dialog=document.querySelector('#detail');dialog.innerHTML=detail(p,d);bind(dialog);if(!dialog.open)dialog.showModal();dialog.querySelector('[data-close]').focus();if(itemId)requestAnimationFrame(()=>{const finished=[...dialog.querySelectorAll('[data-finished-task]')].find(c=>c.dataset.finishedTask===itemId);if(finished)finished.open=true;const card=[...dialog.querySelectorAll('[data-task-card]')].find(c=>c.dataset.taskCard===itemId);if(card){card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'instant'});}});}
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
 root.querySelectorAll('[data-section-toggle]').forEach(b=>b.onclick=()=>{const key=b.dataset.sectionToggle;state.sectionModes[key]=b.getAttribute('aria-expanded')==='true';render();root===app&&document.querySelector(`[data-section-toggle="${key}"]`)?.focus();});
 root.querySelector('#match-text')?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.matchText=e.target.value;state.matchItem=null;state.matchFeedback='';render();const el=document.querySelector('#match-text');el.focus();el.setSelectionRange(pos,pos);});
 root.querySelectorAll('[data-match-item]').forEach(b=>b.onclick=()=>{state.matchItem=b.dataset.matchItem;render();});
 const matched=root.querySelector('#matched-update');if(matched)matched.onsubmit=async e=>{e.preventDefault();if(state.matchSaving)return;const i=state.data.sched.find(x=>x.id===state.matchItem);if(!i||!matchUpdate(state.matchText,state.data.sched,derive().pm).some(x=>x.id===i.id))return;const note=state.matchText.trim(),uid=session.user.id;state.matchSaving=true;state.matchFeedback='Saving...';render();try{const {data,error}=await supabase.from('dashboard_comments').insert({project_id:i.project_id,schedule_item_id:i.id,author_name:state.access?.display_name||session.user.email,note}).select('id,created_at').single();if(session?.user?.id!==uid)return;if(error||!data?.id)state.matchFeedback='Not saved. Your text is still here.';else{state.matchText='';state.matchItem=null;state.matchFeedback='Saved and queued for processing. No direct status change was made.';}}catch{if(session?.user?.id===uid)state.matchFeedback='Not saved. Your text is still here.';}finally{if(session?.user?.id===uid){state.matchSaving=false;render();}}};
 root.querySelectorAll('[data-work-scope]').forEach(b=>b.onclick=()=>{state.workScope=b.dataset.workScope;render();});
 root.querySelectorAll('[data-workload-person]').forEach(b=>b.onclick=()=>{state.workloadMember=b.dataset.workloadPerson;render();});
 root.querySelectorAll('[data-quick-update]').forEach(form=>{
  const textarea=form.querySelector('textarea'),key=form.dataset.quickUpdate;
  textarea.oninput=()=>{state.quickDrafts[key]=textarea.value;textarea.style.height='auto';textarea.style.height=Math.min(150,Math.max(34,textarea.scrollHeight))+'px';};
  textarea.onkeydown=e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();form.requestSubmit();}};
  form.onsubmit=async e=>{e.preventDefault();const note=textarea.value.trim();if(!note)return;const button=form.querySelector('button'),feedback=form.querySelector('[role="status"]');button.disabled=true;feedback.textContent='Saving...';
   const {data,error}=await supabase.from('dashboard_comments').insert({project_id:form.dataset.quickProject,schedule_item_id:form.dataset.quickItem||null,author_name:state.access?.display_name||session.user.user_metadata?.display_name||session.user.email,note}).select('id,created_at').single();
   if(error||!data?.id){feedback.textContent='Not saved. Your text is still here. Try again.';button.disabled=false;return;}
   delete state.quickDrafts[key];textarea.value='';feedback.textContent=`Saved ${stamp(data.created_at)} MT. Queued for processing; task details update after it is processed.`;button.disabled=false;
  };
 });
 root.querySelectorAll('[data-project-listing]').forEach(el=>el.ontoggle=()=>{state.expandedProjects[el.dataset.projectListing]=el.open;});
 root.querySelectorAll('[data-expand-projects]').forEach(b=>b.onclick=()=>{const expanded=b.dataset.expandProjects==='true';root.querySelectorAll('[data-project-listing]').forEach(el=>{state.expandedProjects[el.dataset.projectListing]=expanded;el.open=expanded;});});
 root.querySelectorAll('[data-complete-task]').forEach(b=>b.onclick=()=>completeTask(b.dataset.completeTask));
 root.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>completeProject(b.dataset.complete));
 root.querySelectorAll('[data-schedule-mode]').forEach(b=>b.onclick=()=>{state.scheduleModes[b.dataset.scheduleKey||b.dataset.project]=b.dataset.scheduleMode;if(b.closest('dialog'))refreshDetail();else render();document.querySelector(`[data-project="${b.dataset.project}"][data-schedule-mode="${b.dataset.scheduleMode}"]`)?.focus();});
 root.querySelectorAll('[role="tablist"]').forEach(list=>list.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const tabs=[...list.querySelectorAll('[role="tab"]')],index=tabs.indexOf(document.activeElement);if(index<0)return;
  e.preventDefault();tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length].click();
 });
 root.querySelectorAll('[data-month-step]').forEach(b=>b.onclick=()=>{const key=b.dataset.scheduleKey||b.dataset.project;state.calendarMonths[key]=shiftMonth(state.calendarMonths[key]||today().slice(0,7),Number(b.dataset.monthStep));if(b.closest('dialog'))refreshDetail();else render();document.querySelector(`[data-project="${b.dataset.project}"][data-month-step="${b.dataset.monthStep}"]`)?.focus();});
 root.querySelectorAll('[data-calendar-date]').forEach(b=>b.onclick=()=>openDay(b.dataset.project,b.dataset.calendarDate,b.dataset.rollup==='true'));
 root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDetail(b.dataset.open,b.dataset.targetItem));
 root.querySelectorAll('[data-comment]').forEach(b=>b.onclick=()=>openComment(b.dataset.comment,b.dataset.item));
 root.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(b.dataset.view==='projects'&&state.view!=='projects')state.expandedProjects={};if(isFreelancer(state.access)&&b.dataset.view==='workload')return;state.view=b.dataset.view;state.search='';state.member=b.hasAttribute('data-mine')?derive().aaron:'all';state.client='all';state.status='open';render();window.scrollTo({top:0});});
}
function render(){
 quickSequence=0;const d=derive(), newest=state.data.updates[0]?.created_at;
 app.innerHTML=`<header class="site-header"><a class="brand" href="#" id="home"><span class="brand-mark" aria-hidden="true">P</span><span>Production<small>MONIGLE / TEAM WORKSPACE</small></span></a><div class="sync"><span class="live-dot"></span>${state.error?'Refresh failed. Showing last loaded data.':`Loaded ${state.loaded.toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit'})} MT`}<button id="refresh" aria-label="Refresh data">↻</button><button id="signout">Sign out</button></div></header>
 <nav aria-label="Dashboard views">${[['today','My work'],...(!isFreelancer(state.access)?[['workload','Workload']]:[]),['projects','Projects'],['schedule','Schedule'],['recap','Recap']].map(([v,t])=>`<button data-view="${v}" ${state.view===v?'aria-current="page"':''}>${t}</button>`).join('')}</nav><main>${state.view==='today'?todayView(d):state.view==='projects'?projectsView(d):state.view==='workload'&&!isFreelancer(state.access)?workloadView(d):state.view==='recap'?recapView(d):scheduleView(d)}</main><div class="footnote">Latest feed entry: ${newest?esc(stamp(newest))+' MT':'none recorded'}. Loading this page does not mean every project was checked.<br>Missing a change? Use Update on any project or schedule item.</div><dialog id="detail" aria-labelledby="dialog-title"></dialog><dialog id="comment-dialog" aria-labelledby="comment-title"></dialog><dialog id="day-dialog" aria-labelledby="day-title"></dialog>`;
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
 if(activeUserId!==next?.user?.id){state.quickDrafts={};state.matchText='';state.matchItem=null;state.matchSaving=false;state.matchFeedback='';state.workloadMember='all';state.workScope='mine';state.expandedProjects={};state.sectionModes={};}activeUserId=next?.user?.id||null;session=next;state.data=null;
 if(!session){loginView();return;}
 app.innerHTML='<div class="loading"><h1>Checking team access...</h1></div>';
 const {data,error}=await supabase.rpc('is_dashboard_member');
 if(error||!data){app.innerHTML='<main class="login-shell"><section class="login-card"><h1>Team access is not enabled for this email.</h1><p>Ask Aaron to add your exact sign-in email to the approved list.</p><button id="signout">Sign out</button></section></main>';document.querySelector('#signout').onclick=()=>supabase.auth.signOut();return;}
 const {data:profile,error:profileError}=await supabase.rpc('dashboard_access_profile');
 if(profileError){
  if(profileError.code==='PGRST202'){state.access={role:'team',team_member_id:null};state.accessReady=false;}
  else{app.innerHTML='<div class="loading"><h1>Could not verify your access.</h1><p>Reload to try again. No work data was loaded.</p></div>';return;}
 }else{try{state.access=accessProfile(profile);state.accessReady=true;}catch{app.innerHTML='<div class="loading"><h1>Access profile needs setup.</h1></div>';return;}}
 if(isFreelancer(state.access))state.view='today';
 load();
}
supabase.auth.onAuthStateChange((event,next)=>{setTimeout(()=>{session=next;if(event==='PASSWORD_RECOVERY'||next&&window.location.hash==='#reset')passwordView();else startSession(next);},0);});
// Do not refresh underneath a draft or while someone is reading a project.
setInterval(()=>{if(session&&state.data&&!document.hidden&&!document.querySelector('dialog[open]')&&!Object.values(state.quickDrafts).some(Boolean)&&!state.matchText)load();},5*60*1000);
