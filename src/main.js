import {defaultWorkloadTeams,memberTeam,workloadTeams,saveMemberTeam} from './workload-teams.js';
import {workOverview,workloadSignal,ownerInitials} from './work-overview.js';
import {saveStepOwner,saveProjectOwner} from './step-assignment.js';
import {calendarSpan,itemOnCalendarDay} from './calendar-spans.js';
import {timingPattern} from './timing-patterns.js';
import {officeHolidays,officeHolidayCoverage} from './office-holidays.js';
import {timingPlan,schedulingIssues,shiftWorkDays,dueChange,isWorkDay} from './timing.js';
import {saveWorkDays,suggestedDateLabel} from './work-days.js';
import {selectedSteps,applyBulk,combineOptions,combinePlan,executeCombine} from './bulk-actions.js';
import {projectPath,displayProjectPath,workstreamLabel,flatProjectBranches,brandClient,breadcrumbParts,flattenedListings,effectiveClientId} from './workstream-display.js';
import {stepStatusOptions,statusChoice,saveStepStatus} from './step-status.js';
import {statusLabel} from './status-labels.js';
import {unresolvedPastDue} from './past-due.js';
import {dailyStatus,statusOutline,brandOutline,statusOutlineHtml,brandOutlineHtml,dayKey} from './daily-status.js';
import {ownerNames,saveStepCoOwners,saveProjectCx,projectCx} from './step-assignment.js';
import {visibleCards} from './hide-done.js';
import {pendingRevisions,revisionTargets} from './revisions.js';
import {recapQuestionGroups} from './recap-questions.js';
import {stuckPrerequisites} from './stuck-steps.js';
import {workloadColumns} from './workload-table.js';
import { createClient } from '@supabase/supabase-js';
import './style.css';
import {calendarEntries,addDays,mountainTime} from './live-calendar.js';
import {ganttAxis,ganttChart,twoMonthStart} from './gantt.js';
import {readOutbox,saveOutbox,deliverComment} from './comment-outbox.js';
import {sourceLinks,recordSourceLinks} from './source-links.js';
import {parentheticalName,joinedNames} from './card-display.js';
import {shiftDate,weekWindow,needsAttention,weeklyCounts,matchUpdate,lateDependencies,recordedDay,normalizeDependencies} from './insights.js';
import { accessProfile, isFreelancer, canCompleteItem, workloadCounts, signedInIdentity } from './access.js';
import { dateKey, groupAssignments, projectIsDone, clientMilestone, milestoneKind, isWeekend, shiftMonth, nextMilestone, timelineSteps, timelineStepState } from './schedule.js';
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const app = document.querySelector('#app');
const supabase = createClient(URL_, KEY);
let session = null;
let activeUserId=null;
const TZ = 'America/Denver';
const state = { data: null, view: 'today', member: 'all', client: 'all', status: 'open', search: '', open: null, busy: false, scheduleModes: {}, calendarMonths: {}, completing: false, openDay: null, focusedTask: null, expandedProjects: {}, hideDone: false, scheduleHideDone: {}, workloadExpanded: {}, sectionModes: {}, access: null, accessReady: false, workloadMember: 'all', workScope: 'mine', calendarMode: 'week', ganttRanges: {}, ganttCollapsed: {}, ganttHideDone: true, stepRowOpen: {}, workFilter:'today', myHideDone: false, myWorkView: 'list', finishedOpen: false, calendarAnchor: null, calendarScrollTo: 'today', calendarOwner: 'all', calendarProject: 'all', liveState: 'Connecting', livePending: false, legendOpen: false, revisionsOpen: false, revisions: [], revisionsAvailable: true, commentHistory: [], commentsAvailable: false, outbox: [], outboxBusy: {}, questionBusy: {}, questionDrafts: {}, questionsAvailable: false, quickDrafts: {}, pastDateDrafts: {}, selectedSteps: [], selectedProjects: [], combineFeedback: '', bulkBusy: false, bulkFeedback: '', workloadTeamFilter: [...defaultWorkloadTeams], teamBusy: {}, teamFeedback: {}, ownerBusy: {}, ownerFeedback: {}, addCo: {}, stepStatusBusy: {}, stepStatusFeedback: {}, pastDateBusy: {}, pastDateFeedback: {}, matchText: '', matchItem: null, matchSaving: false, matchFeedback: '', dependencyEdges: [], dependencyAvailable: false };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label = statusLabel;
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
 const identity=signedInIdentity(session?.user,state.access,members),aaron=identity.team_member_id;
 return {cm,pm,mm,aaron,identity,upd:by(updates,'project_id'),lnk:by(links,'project_id'),sch:by(sched,'project_id'),subs:by(projects.filter(p=>p.parent_id),'parent_id')};
}
async function q(table,params){const r=await fetch(`${URL_}/rest/v1/${table}?${params}`,{headers:{apikey:KEY,Authorization:`Bearer ${session.access_token}`}});if(!r.ok)throw Error('Data request failed');return r.json();}
const isCanceledTitle=t=>/^canceled[:\s]/i.test(t||'');
const SNAP_KEY='pdash-snap-v1-';
function saveSnapshot(){try{if(session?.user?.id&&state.data)localStorage.setItem(SNAP_KEY+session.user.id,JSON.stringify({t:Date.now(),data:state.data,access:state.access,accessReady:state.accessReady}));}catch{}}
function readSnapshot(uid){try{const s=JSON.parse(localStorage.getItem(SNAP_KEY+uid));return s&&s.data?s:null;}catch{return null;}}
let loadingSlowTimer;
function loadingView(msg){
 app.innerHTML=`<div class="loading loading-skeleton" aria-busy="true"><span class="eyebrow">PRODUCTION (MONIGLE)</span><div class="skel skel-hero"></div><div class="skel-nav"><span class="skel skel-pill"></span><span class="skel skel-pill"></span><span class="skel skel-pill"></span><span class="skel skel-pill"></span></div><div class="skel-grid"><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div></div><p class="loading-note">${esc(msg)}</p><p class="loading-slow" id="load-slow" hidden>Taking longer than usual. The data service can be slow to wake. Hang on, or <button type="button" id="retry-load">try again</button>.</p></div>`;
 document.querySelector('#retry-load')?.addEventListener('click',()=>{state.busy=false;load();});
 clearTimeout(loadingSlowTimer);loadingSlowTimer=setTimeout(()=>{const n=document.querySelector('#load-slow');if(n)n.hidden=false;},12000);
}
async function load(){
 if(!session){loginView();return;}if(state.busy)return;state.busy=true;
 if(!state.data)loadingView('Getting the latest...');
 try {
  if(!URL_||!KEY)throw Error('Configuration missing');
  const revP=refreshRevisions(false),histP=refreshCommentHistory();
  const [clients,projects,members,updates,links,sched,questions,dependencies]=await Promise.all([q('clients','select=*&order=name'),q('projects','select=*&order=sort_order,name'),q('team_members','select=*&active=eq.true&order=name'),q('project_updates','select=*&order=created_at.desc&limit=2000'),q('project_links','select=*&order=created_at'),q('schedule_items','select=*&order=due_date.asc.nullslast'),q('dashboard_questions','select=*&order=created_at').catch(()=>null),isFreelancer(state.access)?Promise.resolve(null):q('schedule_dependencies','select=item_id,depends_on_id').catch(()=>null)]);
  state.questionsAvailable=Array.isArray(questions);
  state.dependencyAvailable=Array.isArray(dependencies);state.dependencyEdges=normalizeDependencies(Array.isArray(dependencies)?dependencies:[]);
  await Promise.all([revP,histP]);
  state.data={questions:questions||[],clients:clients.map(x=>({...x,name:parentheticalName(x.name)})),projects:projects.map(x=>({...x,name:parentheticalName(x.name)})),members,updates,links,sched:sched.map(x=>({...x,title:parentheticalName(x.title)}))};state.loaded=new Date();state.livePending=false;state.error=false;clearTimeout(loadingSlowTimer);saveSnapshot();render();const hm=location.hash.match(/#project=([0-9a-fA-F-]{36})/);if(hm&&derive().pm[hm[1]])openDetail(hm[1]);
 }catch(e){state.error=true;clearTimeout(loadingSlowTimer);if(state.data)render();else app.innerHTML='<div class="loading"><h1>Could not load production.</h1><p>Nothing has been changed. Try again in a moment.</p><button id="retry">Try again</button></div>';document.querySelector('#retry')?.addEventListener('click',load);}
 finally{state.busy=false;}
}
function dashboardLegend(){
 const cards=[['client-milestone milestone-meeting','Client meeting','Blue. Explicitly marked client meeting; wins over review/release and in-progress tint.'],['client-milestone milestone-review','Client review / approval','Orange.'],['client-milestone milestone-release','Release / client delivery','Purple.'],['has-current-step','In progress','Teal for ordinary, review or release cards marked in progress.'],['is-finished','Finished','Grey card.'],['','Other step','White when no type or current status applies.']];
 const dot=(kind,status)=>`<ol class="mini-timeline legend-timeline" aria-hidden="true"><li class="timeline-step kind-${kind} ${status}"><span class="step-circle"></span></li></ol>`;
 return `<details class="dashboard-legend" ${state.legendOpen?'open':''}><summary>Legend <span>Card colors & timeline</span></summary><div class="legend-layout"><section><h3>Card colors</h3>${cards.map(([classes,title,note])=>`<div class="legend-row"><span class="task-card legend-card-sample ${classes}" aria-hidden="true"></span><div><strong>${title}</strong><p>${note}</p></div></div>`).join('')}<p class="legend-note">Chips and expanded cards use the same colors. Status labels still show waiting, blocked or planned.</p><div class="legend-row"><span class="step-stuck">Waiting</span><div><strong>Waiting on a previous step</strong><p>Red Waiting means an explicit prerequisite step is not done. Dates and timeline order do not create dependencies. On expanded cards, Waiting / Blocked status alone does not prove a prerequisite. Collapsed chips show Done, Waiting (prerequisite or waiting/blocked status), Unassigned, In progress, or Planned. Planned means assigned, not handed off yet. In progress means handed off or started. Assignment alone does not mean work has started. Missing dependency records cannot be assessed.</p></div></div></section><section><h3>Timeline dots</h3><div class="legend-dot-types">${[['normal','Other'],['meeting','Meeting'],['review','Review'],['release','Release']].map(([k,t])=>`<span>${dot(k,'step-upcoming')}<small>${t}</small></span>`).join('')}</div><div class="legend-row">${dot('review','step-review')}<div><strong>Solid dot</strong><p>Step type. It does not mean the step is finished.</p></div></div><div class="legend-row">${dot('review','step-current')}<div><strong>White center, type-colored outline</strong><p>The step shown by this card, or a step marked in progress. An outline alone does not distinguish those two.</p></div></div><div class="legend-row">${dot('normal','step-done')}<div><strong>Faded dot</strong><p>Finished step. A finished step shown by this card can still have a white center and type-colored outline.</p></div></div><p class="legend-note">Dates below dots are recorded due dates; TBD means no date. Dots follow date order, then undated steps. The connecting line is order, not a dependency. A heavier faded link joins two finished steps.</p><p class="legend-note">A teal outline around a whole card marks the step opened from a card. It is focus, not completion or approval.</p></section></div></details>`;
}
function revisionsView(){
 const rows=pendingRevisions(state.revisions.filter(r=>!r.disregarded_at),state.data?.projects||[]);
 if(!rows.length)return state.revisionsAvailable?'':'<p class="revision-unavailable" role="status">Revision status is unavailable. Refresh to try again.</p>';
 const projects=Object.fromEntries((state.data?.projects||[]).map(p=>[p.id,p]));
 return `<details class="revisions-panel" ${state.revisionsOpen?'open':''}><summary><span>revisions in progress</span><span class="revision-count">${rows.length}</span></summary><div class="revisions-body">${state.revisionsAvailable?'':'<p class="revision-unavailable" role="status">Could not refresh revision status. Showing the last confirmed queue.</p>'}<p>Submitted changes awaiting processing. Your visible submissions are shown here; the card highlight clears after each change is applied.</p>${rows.map(r=>`<article class="revision-entry"><div><strong>${esc(projects[r.project_id]?.name||r.context?.project_name||'Project')}${r.schedule_item_id?` · ${esc(r.context?.schedule_title||state.data.sched.find(i=>i.id===r.schedule_item_id)?.title||'Step')}`:''}</strong><span class="revision-state">Queued for processing</span></div><p>${esc(r.note)}</p><small>${r.created_at?esc(stamp(r.created_at))+' MT':''}</small></article>`).join('')}</div></details>`;
}
function updateDailyPendingUI(){
 if(!state.data)return;
 const targets=revisionTargets(pendingRevisions(state.revisions.filter(r=>!r.disregarded_at),state.data.projects),state.data.projects);
 document.querySelectorAll('.brief-steps li').forEach(li=>{
  const button=li.querySelector('[data-target-item]');if(!button)return;
  const id=button.dataset.targetItem;
  const pending=!!state.stepStatusBusy[id]||!!state.ownerBusy[id]||targets.stepIds.has(id);
  li.classList.toggle('brief-updating',pending);
  const old=li.querySelector('[data-updating-prefix]');
  if(pending&&!old){const prefix=document.createElement('b');prefix.dataset.updatingPrefix='';prefix.textContent='[Updating] ';li.prepend(prefix);}
  else if(!pending&&old)old.remove();
 });
}
function updateRevisionUI(){
 if(!state.data)return;
 updateDailyPendingUI();
 const area=document.querySelector('#revisions-area');
 if(area){const focused=area.contains(document.activeElement);area.innerHTML=revisionsView();area.querySelector('details')?.addEventListener('toggle',e=>{state.revisionsOpen=e.target.open;});if(focused)area.querySelector('summary')?.focus();}
 const rows=pendingRevisions(state.revisions.filter(r=>!r.disregarded_at),state.data.projects),targets=revisionTargets(rows,state.data.projects);
 document.querySelectorAll('[data-revision-badge]').forEach(x=>x.remove());
 document.querySelectorAll('.is-revising').forEach(x=>x.classList.remove('is-revising'));
 document.querySelectorAll('[data-card-item],[data-task-card],[data-finished-task],[data-project-listing],[data-revision-project],.project-card,.calendar-all-event').forEach(el=>{
  const step=el.dataset.taskCard||el.dataset.finishedTask||el.dataset.cardItem||el.dataset.targetItem;
  const project=el.dataset.projectListing||el.dataset.revisionProject||el.dataset.cardOpen||el.dataset.open;
  if(!(step?targets.stepIds.has(step):targets.projectIds.has(project)))return;
  el.classList.add('is-revising');
  const badge=document.createElement('span');badge.className='revision-badge';badge.dataset.revisionBadge='';badge.textContent='revising';
  const summary=el.tagName==='DETAILS'?el.querySelector(':scope > summary'):null;
  (summary||el).prepend(badge);
 });
}
let revisionsBusy=false;
async function refreshRevisions(update=true){
 if(!session||revisionsBusy)return;revisionsBusy=true;const uid=session.user.id;
 try{const rows=await q('dashboard_comments','select=id,project_id,schedule_item_id,note,context,created_at,reviewed_at,disregarded_at&reviewed_at=is.null&disregarded_at=is.null&order=created_at');if(session?.user?.id!==uid)return;state.revisions=rows;state.revisionsAvailable=true;}
 catch{if(session?.user?.id===uid)state.revisionsAvailable=false;}
 finally{revisionsBusy=false;if(update&&session?.user?.id===uid)updateRevisionUI();}
}
function outboxView(){return state.outbox.length?`<section class="comment-outbox" aria-label="Messages not sent yet"><h2>Not sent yet <span class="number">${state.outbox.length}</span></h2><p>Delivery not confirmed. Saved on this device for your signed-in account. Only messages you pressed Send on retry once when you reconnect.</p>${state.outbox.map(r=>`<article><strong>${esc(r.context)}</strong><p>${esc(r.note)}</p><small>${state.outboxBusy[r.id]?'Checking delivery...':'Not sent yet. Will retry on reconnect.'}</small><div><button data-retry-comment="${esc(r.id)}" ${state.outboxBusy[r.id]?'disabled':''}>Retry now</button><button data-discard-comment="${esc(r.id)}" ${state.outboxBusy[r.id]?'disabled':''}>Stop retrying</button></div></article>`).join('')}</section>`:'';}
function persistOutbox(){try{saveOutbox(localStorage,session.user.id,state.outbox);return true;}catch{return false;}}
function updateOutboxUI(){const area=document.querySelector('#comment-outbox-area');if(area){area.innerHTML=outboxView();bindOutbox(area);}}
async function retryComment(id){const row=state.outbox.find(r=>r.id===id),uid=session?.user?.id;if(!row||row.user!==uid||state.outboxBusy[id])return null;state.outboxBusy[id]=true;updateOutboxUI();try{const receipt=await deliverComment(supabase,row,()=>session?.user?.id===uid);if(session?.user?.id!==uid)return null;state.revisions=[...state.revisions.filter(r=>r.id!==id),{...row,created_at:receipt.created_at,reviewed_at:null,context:{project_name:state.data?.projects.find(p=>p.id===row.project_id)?.name,schedule_title:state.data?.sched.find(i=>i.id===row.schedule_item_id)?.title}}];updateRevisionUI();refreshRevisions();state.outbox=state.outbox.filter(r=>r.id!==id);persistOutbox();document.querySelectorAll('[data-quick-update]').forEach(form=>{if(form.dataset.quickProject===row.project_id&&(form.dataset.quickItem||null)===row.schedule_item_id&&form.querySelector('textarea').value.trim()===row.note){form.querySelector('textarea').value='';delete state.quickDrafts[form.dataset.quickUpdate];form.querySelector('[role=status]').textContent='Saved. Queued for processing.';}});if(state.matchText.trim()===row.note&&state.matchItem===row.schedule_item_id){state.matchText='';state.matchItem=null;state.matchFeedback='Saved and queued for processing.';}const dialog=document.querySelector('#comment-dialog');if(dialog?.open&&dialog.dataset.commentProject===row.project_id&&(dialog.dataset.commentItem||null)===row.schedule_item_id&&dialog.querySelector('#comment-note')?.value.trim()===row.note){dialog.querySelector('#comment-status').textContent='Saved. Queued for processing.';dialog.querySelector('#comment-note').readOnly=true;dialog.querySelector('[type=submit]').disabled=true;}return receipt;}catch{return null;}finally{delete state.outboxBusy[id];if(session?.user?.id===uid)updateOutboxUI();}}
async function queueComment(payload,context){const uid=session?.user?.id;if(!uid)return null;let row=state.outbox.find(r=>r.user===uid&&r.project_id===payload.project_id&&r.schedule_item_id===(payload.schedule_item_id||null)&&r.note===payload.note&&r.author_name===payload.author_name);if(!row){row={...payload,schedule_item_id:payload.schedule_item_id||null,id:crypto.randomUUID(),user:uid,context};state.outbox.push(row);}const durable=persistOutbox();updateOutboxUI();const receipt=await retryComment(row.id);return {receipt,durable};}
function bindOutbox(root){root.querySelectorAll('[data-retry-comment]').forEach(b=>b.onclick=()=>retryComment(b.dataset.retryComment));root.querySelectorAll('[data-discard-comment]').forEach(b=>b.onclick=()=>{state.outbox=state.outbox.filter(r=>r.id!==b.dataset.discardComment);persistOutbox();updateOutboxUI();});}

window.addEventListener('online',async()=>{for(const row of [...state.outbox]){if(row.user===session?.user?.id)await retryComment(row.id);}});
let quickSequence=0;
function quickInput(p,item){
 const key=item?.id||'project-'+p.id,fieldId='quick-'+(++quickSequence);
 return `<form class="quick-update" data-quick-update="${esc(key)}" data-quick-project="${esc(p.id)}" ${item?`data-quick-item="${esc(item.id)}"`:''}><label for="${fieldId}">Quick update</label><div class="quick-entry"><textarea id="${fieldId}" rows="1" maxlength="5000" required placeholder="Progress, blocker or a date change...">${esc(state.quickDrafts[key]||'')}</textarea><button type="submit">Send</button></div><span class="quick-feedback" role="status" aria-live="polite"></span></form>`;
}
async function refreshCommentHistory(){
 try{state.commentHistory=await q('dashboard_comments','select=id,project_id,schedule_item_id,note,created_at,reviewed_at,disregarded_at,undo_status,undo_note&order=created_at.desc');state.commentsAvailable=true;}catch{state.commentsAvailable=false;}
}
function commentHistory(p,item){
 const rows=state.commentHistory.filter(c=>c.project_id===p.id&&(!item||c.schedule_item_id===item.id));
 return `<details class="comment-history"><summary>Your comment history (${rows.length})</summary><p class="muted">Only your comments are shown. Disregard keeps the history but ignores the direction. Tracked changes can be restored without replacing later edits.</p>${!state.commentsAvailable?'<p role="status">Comment history is unavailable. Refresh to try again.</p>':rows.map(c=>`<article class="comment-history-entry ${c.disregarded_at?'is-disregarded':''}"><div><small>${esc(stamp(c.created_at))} MT</small><span class="comment-state">${c.disregarded_at?'Disregarded':c.reviewed_at?'Processed':'Queued'}</span></div><p>${esc(c.note)}</p>${c.disregarded_at?`<p class="undo-note">${esc(c.undo_note||'Direction ignored.')}</p>`:`<button data-disregard-comment="${esc(c.id)}">Disregard</button>`}</article>`).join('')||'<p class="muted">No comments yet.</p>'}</details>`;
}
function openDisregard(id){
 const c=state.commentHistory.find(c=>c.id===id);if(!c||c.disregarded_at)return;
 const dialog=document.querySelector('#comment-dialog');
 dialog.innerHTML=`<div class="dialog-head"><h2>Disregard this comment?</h2><button data-close aria-label="Close">×</button></div><p class="disregard-quote">${esc(c.note)}</p><p>The direction will be ignored. The comment stays in your history as Disregarded.</p><label class="restore-choice"><input type="checkbox" id="restore-comment" checked> Restore the changes made from this comment</label><p class="muted">All tracked changes are restored together only when their changed fields still match. Later edits are kept. Older comments without a saved prior state, or conflicting changes, go to review instead. Nothing is guessed.</p><button class="primary" id="confirm-disregard">Save disregard</button><p role="status" id="disregard-status"></p>`;
 bind(dialog);dialog.showModal();
 dialog.querySelector('#confirm-disregard').onclick=async()=>{
  const b=dialog.querySelector('#confirm-disregard'),status=dialog.querySelector('#disregard-status'),restore=dialog.querySelector('#restore-comment').checked;
  b.disabled=true;status.textContent='Saving...';
  try{const {data,error}=await supabase.rpc('disregard_dashboard_comment',{target_comment_id:id,restore_changes:restore});if(error)throw error;status.textContent=data.note;b.textContent='Saved';dialog.querySelector('#restore-comment').disabled=true;await refreshCommentHistory();await refreshRevisions();if(data.status==='restored'){const [projects,sched,updates,links,questions]=await Promise.all([q('projects','select=*&order=sort_order,name'),q('schedule_items','select=*&order=due_date.asc.nullslast'),q('project_updates','select=*&order=created_at.desc'),q('project_links','select=*&order=created_at'),q('dashboard_questions','select=*&order=created_at')]);Object.assign(state.data,{projects,sched,updates,links,questions});}state.livePending=true;if(state.open)refreshDetail();}
  catch{status.textContent='Not saved. Refresh and try again.';b.disabled=false;}
 };
}
function commentButton(p,item){return `<button class="comment" data-comment="${esc(p.id)}" ${item?`data-item="${esc(item.id)}"`:''} aria-label="Comment to Instinct about ${esc(item?.title||p.name)}"><span aria-hidden="true">↗</span> Update</button>`;}
function latest(p,d,full=false){const u=d.upd[p.id]?.[0];return `<div class="update"><div class="caption">LATEST UPDATE <span>${u?esc(stamp(u.created_at))+' MT':''}</span></div><p class="${full?'':'clamp'}">${esc(u?.note || p.description || 'No update recorded yet.')}</p>${originalSourceControls(u)}</div>`;}
function timeline(p,d,representedItem=null,representedProject=null){
 const steps=timelineSteps(p,state.data.sched,d.pm);if(!steps.length)return '';
 return `<ol class="mini-timeline" aria-label="Steps for ${esc(p.name)}">${steps.map(i=>`<li class="timeline-step step-${timelineStepState(i)} kind-${milestoneKind(i)||'normal'}${(representedItem?.id===i.id||representedProject?.id===i.project_id)?' step-represented':''}" ><button class="timeline-step-target" data-timeline-project="${esc(i.project_id)}" data-timeline-step="${esc(i.id)}" data-step-name="${esc(i.title)}" data-step-date="${dateKey(i.due_date)?`${Number(dateKey(i.due_date).slice(5,7))}/${Number(dateKey(i.due_date).slice(8,10))}`:'TBD'}" aria-label="Open step: ${esc(i.title)}"><span class="step-circle" aria-hidden="true"></span></button><span class="step-date" aria-hidden="true">${dateKey(i.due_date)?`${Number(dateKey(i.due_date).slice(5,7))}/${Number(dateKey(i.due_date).slice(8,10))}`:'TBD'}</span></li>`).join('')}</ol>`;
}
function projectCard(p,d){
 const next=(d.sch[p.id]||[]).filter(i=>i.status!=='done' && i.due_date && i.due_date>=today())[0];
 const ds=due(next?.due_date||p.due_date,p.status);
 const milestone=p.status==='done'?null:nextMilestone(p,state.data.sched,d.pm,today());
 return `<article data-card-open="${esc(p.id)}" tabindex="0" aria-label="Open details for ${esc(p.name)}" class="project-card ${timelineSteps(p,state.data.sched,d.pm).some(i=>i.status==='in_progress')?'has-current-step':''}">${timeline(p,d,null,p.parent_id?p:null)}<div class="card-top"><span class="eyebrow">${esc(d.cm[p.client_id]?.name||'No client')}</span><span class="pill ${esc(p.status)}">${esc(label(p.status))}</span></div><h3><button class="title-button" data-open="${p.id}">${esc(shortName(p,d))}</button></h3>${latest(p,d)}${milestone?`<p class="next-milestone milestone-${milestoneKind(milestone)}"><strong>Next ${milestoneKind(milestone)==='meeting'?'CLIENT MEETING':milestoneKind(milestone)==='review'?'REVIEW':'RELEASE'}</strong> · ${esc(fmtDate(milestone.due_date))}<span>${esc(milestone.title)}</span></p>`:''}<div class="card-meta"><span>Lead: ${projectOwnerControl(p,d)}</span>${projectCx(p,d.pm).length?`<span>CX: ${esc(projectCx(p,d.pm).join(', '))}</span>`:''}<span class="${ds.cls}">${esc(ds.text)}${next?' · '+esc(next.title):''}</span></div>${questionsArea(p,null)}<footer>${sourceControls(p,null,d)}<button class="text-button" data-open="${p.id}">Details & links →</button>${commentButton(p)}</footer></article>`;
}
function milestoneLegend(){return '<div class="calendar-legend" aria-label="Milestone colors"><span class="legend-meeting">CLIENT MEETING</span><span class="legend-review">REVIEW · Client review / approval</span><span class="legend-release">RELEASE · Release / client delivery</span></div>';}
function questionsArea(p,i,openOnly=false){
 const rows=(state.data.questions||[]).filter(q=>(!openOnly||q.status==='open')&&q.project_id===p.id&&(i?q.schedule_item_id===i.id:!q.schedule_item_id));
 if(!state.questionsAvailable)return '<p class="question-unavailable">Questions unavailable</p>';
 if(!rows.length)return '';
 const open=rows.filter(q=>q.status==='open'),answered=rows.filter(q=>q.status==='answered');
 return `<section class="card-questions" aria-label="Questions from Instinct"><h4>Questions from Instinct <span>${open.length} open</span></h4>${open.map(q=>`<form data-question-answer="${esc(q.id)}"><label>${esc(q.question)}<textarea maxlength="5000" rows="2" required placeholder="Your answer...">${esc(state.questionDrafts[q.id]||'')}</textarea></label><button type="submit">Send answer</button><span class="question-feedback" role="status" aria-live="polite"></span></form>`).join('')}${answered.length?`<details class="answered-questions"><summary>${answered.length} answered question${answered.length===1?'':'s'}</summary>${answered.map(q=>`<div><strong>${esc(q.question)}</strong><p>${esc(q.answer)}</p><small>Answered by ${esc(q.answered_name||q.answered_email||'team member')} · ${esc(stamp(q.answered_at))} MT</small></div>`).join('')}</details>`:''}</section>`;
}
function originalSourceControls(record){
 const links=recordSourceLinks(record);
 return links.length?`<span class="source-links original-source-links">${links.map(l=>`<a class="source-link source-${l.kind}" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Open original ${l.kind==='teams'?'Teams message':'Outlook message'} ↗</a>`).join('')}</span>`:'';
}
function sourceControls(p,i,d,compact=false){
 const direct=originalSourceControls(i);
 const links=sourceLinks(p,i,state.data.links).filter(l=>!recordSourceLinks(i).some(x=>x.url===l.url));
 if(!links.length)return direct||(compact?'':`<span class="source-missing" title="No Teams message or email link recorded">Source not linked</span>`);
 return `${direct}<span class="source-links ${compact?'source-links-compact':''}">${links.map(l=>{const title=`${l.scope==='project'?'Client ':''}${l.kind==='teams'?'Teams message':'Email'}`;return `<a class="source-link source-${l.kind}" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(title)} for ${esc(i?.title||p.name)}" title="${esc(title)}${l.label?' · '+esc(l.label):''}">${compact?`<span aria-hidden="true">${l.kind==='teams'?'T':'✉'}</span>`:esc(title)+' ↗'}</a>`;}).join('')}</span>`;
}
function chipStatus(item){
 if(item.status==='done')return {text:'Done',kind:'done'};
 if(state.dependencyAvailable&&stuckPrerequisites(item,state.data.sched,state.dependencyEdges).length||['waiting','blocked'].includes(item.status))return {text:'Waiting',kind:'waiting'};
 if(!item.owner_id)return {text:'Unassigned',kind:'unassigned'};
 if(['in_progress','active'].includes(item.status))return {text:'In progress',kind:'in_progress'};
 if(['pending','not_started','planned'].includes(item.status))return {text:'Planned',kind:'pending'};
 return {text:label(item.status),kind:'unknown'};
}
function chipStatusBadge(item){const status=chipStatus(item);return `<span class="chip-status chip-status-${status.kind}">${esc(status.text)}</span>`;}
function stuckBadge(item){const upstream=state.dependencyAvailable?stuckPrerequisites(item,state.data.sched,state.dependencyEdges):[];return upstream.length?`<div class="step-stuck-row"><span class="step-stuck" title="${esc('Waiting on: '+upstream.map(i=>i.title).join(', '))}">Waiting</span></div>`:'';}
function stepStatusControl(item,d){
 if(projectIsDone(d.pm[item.project_id],d.pm)||!canCompleteItem(state.access,item))return '';
 const selected=statusChoice(item.status);
 return `<label class="step-status-control">Status<select data-step-status="${esc(item.id)}" aria-label="Status for ${esc(item.title)}" ${state.stepStatusBusy[item.id]?'disabled':''}>${stepStatusOptions.map(o=>`<option value="${o.value}" ${selected===o.value?'selected':''}>${o.label}</option>`).join('')}</select></label><span class="step-status-feedback" data-step-status-feedback="${esc(item.id)}" role="status" aria-live="polite">${esc(state.stepStatusFeedback[item.id]||'')}</span>`;
}
function stepStatusPill(item,d){
 const staticPill=`<span class="pill ${esc(item.status)}">${esc(label(item.status))}</span>`;
 if(projectIsDone(d.pm[item.project_id],d.pm)||!canCompleteItem(state.access,item))return staticPill;
 const selected=statusChoice(item.status);
 return `<select class="pill ${esc(item.status)}" data-step-status="${esc(item.id)}" aria-label="Change status for ${esc(item.title)}" ${state.stepStatusBusy[item.id]?'disabled':''}>${stepStatusOptions.map(o=>`<option value="${o.value}" ${selected===o.value?'selected':''}>${o.label}</option>`).join('')}</select>`;
}
async function changeStepStatus(id,next){
 const item=state.data.sched.find(i=>i.id===id),uid=session?.user?.id;
 if(!item||state.stepStatusBusy[id]||!canCompleteItem(state.access,item))return;
 if(next===statusChoice(item.status))return;
 const copies=()=>[...document.querySelectorAll('[data-step-status]')].filter(el=>el.dataset.stepStatus===id);
 const feedback=text=>document.querySelectorAll('[data-step-status-feedback]').forEach(el=>{if(el.dataset.stepStatusFeedback===id)el.textContent=text;});
 state.stepStatusBusy[id]=true;updateDailyPendingUI();copies().forEach(el=>el.disabled=true);feedback('Saving...');
 try{
  await saveStepStatus(supabase,item,next);
  if(session?.user?.id!==uid)return;
  item.status=next;dailyMemo=null;dailyHtmlMemo=null;state.stepStatusFeedback[id]='Status saved.';
  const project=state.open,day=document.querySelector('#day-dialog')?.open?state.openDay:null,scroll=document.querySelector('#detail')?.scrollTop??0;
  delete state.stepStatusBusy[id];render();
  if(project){openDetail(project,state.focusedTask,true);const detailEl=document.querySelector('#detail');if(detailEl)detailEl.scrollTop=scroll;}
  if(day)openDay(day.pid,day.key,day.rollup);
 }catch{
  if(session?.user?.id===uid){state.stepStatusFeedback[id]='Not saved. Refresh and try again.';copies().forEach(el=>{el.value=statusChoice(item.status);el.disabled=false;});feedback(state.stepStatusFeedback[id]);}
 }finally{delete state.stepStatusBusy[id];updateDailyPendingUI();}
}
function projectOwnerControl(p,d){
 if(isFreelancer(state.access)||projectIsDone(p,d.pm))return esc(d.mm[p.owner_id]?.name||'Not assigned');
 return `<span class="inline-owner"><select data-project-owner="${esc(p.id)}" aria-label="Assign client ${esc(p.name)}">${opt('',p.owner_id||'','Unassigned')}${state.data.members.map(m=>opt(m.id,p.owner_id,m.name)).join('')}</select><span role="status"></span></span>`;
}
const ADD_CO='__add_additional__',REMOVE_CO='__remove_additional__';
function coOwnerSelect(item,d,transient){
 const co=item.co_owner_ids||[];
 const extras=co.slice(1).map(id=>d.mm[id]?.name).filter(Boolean);
 const cur=transient?'':co[0];
 let memberOpts=state.data.members.filter(m=>m.id!==item.owner_id).map(m=>opt(m.id,cur,m.name)).join('');
 if(!transient&&cur&&!state.data.members.some(m=>m.id===cur))memberOpts=opt(cur,cur,d.mm[cur]?.name||'Former member')+memberOpts;
 return `<span class="inline-coowners"> & </span><select data-step-co="${esc(item.id)}" aria-label="Second assignee for ${esc(item.title)}" ${state.ownerBusy[item.id]?'disabled':''}>${transient?opt('','','Unassigned'):''}${memberOpts}${opt(REMOVE_CO,'','remove additional')}</select>${extras.length?`<span class="inline-coowners"> & ${esc(extras.join(' & '))}</span>`:''}`;
}
function inlineOwner(item,d){
 if(isFreelancer(state.access)||projectIsDone(d.pm[item.project_id],d.pm))return esc(ownerNames(item,d.mm,'Unassigned'));
 const hasCo=(item.co_owner_ids||[]).length>0,transient=!!state.addCo[item.id];
 const addOpt=(!hasCo&&!transient)?opt(ADD_CO,'','add additional'):'';
 return `<span class="inline-owner"><select data-step-owner="${esc(item.id)}" aria-label="Assign ${esc(item.title)}" ${state.ownerBusy[item.id]?'disabled':''}>${opt('',item.owner_id||'','Unassigned')}${state.data.members.map(m=>opt(m.id,item.owner_id,m.name)).join('')}${addOpt}</select>${hasCo||transient?coOwnerSelect(item,d,transient):''}<span data-owner-feedback="${esc(item.id)}" role="status">${esc(state.ownerFeedback[item.id]||'')}</span></span>`;
}
async function changeStepOwner(id,next){
 const item=state.data.sched.find(i=>i.id===id),uid=session?.user?.id;
 if(!item||state.ownerBusy[id]||next===(item.owner_id||''))return;
 const old=item.owner_id;
 state.ownerBusy[id]=true;state.ownerFeedback[id]='Saving...';
 const copies=()=>[...document.querySelectorAll('[data-step-owner]')].filter(el=>el.dataset.stepOwner===id);
 const feedback=()=>document.querySelectorAll('[data-owner-feedback]').forEach(el=>{if(el.dataset.ownerFeedback===id)el.textContent=state.ownerFeedback[id]||'';});
 copies().forEach(el=>el.disabled=true);feedback();updateDailyPendingUI();
 try{await saveStepOwner(supabase,item,next);if(session?.user?.id!==uid)return;item.owner_id=next||null;state.ownerFeedback[id]='Saved.';delete state.ownerBusy[id];dailyMemo=null;dailyHtmlMemo=null;render();if(state.open)refreshDetail();}
 catch{if(session?.user?.id===uid){state.ownerFeedback[id]='Not saved. Try again.';copies().forEach(el=>{el.value=old||'';el.disabled=false;});feedback();}}
 finally{delete state.ownerBusy[id];updateDailyPendingUI();}
}
function stepOwnerControl(item,d){
 if(isFreelancer(state.access)||projectIsDone(d.pm[item.project_id],d.pm))return '';
 const hasCo=(item.co_owner_ids||[]).length>0,transient=!!state.addCo[item.id];
 const addOpt=(!hasCo&&!transient)?opt(ADD_CO,'','add additional'):'';
 return `<label class="step-owner-control">Assigned to<select data-step-owner="${esc(item.id)}" aria-label="Assign ${esc(item.title)}" ${state.ownerBusy[item.id]?'disabled':''}>${opt('',item.owner_id||'','Unassigned')}${state.data.members.map(m=>opt(m.id,item.owner_id,m.name)).join('')}${addOpt}</select>${hasCo||transient?coOwnerSelect(item,d,transient):''}<span data-owner-feedback="${esc(item.id)}" role="status"></span></label>`;
}
async function changeStepCo(id,next){
 const item=state.data.sched.find(i=>i.id===id),uid=session?.user?.id;
 if(!item||state.ownerBusy[id])return;
 const transient=!!state.addCo[id],extras=(item.co_owner_ids||[]).slice(1);
 if(next===REMOVE_CO&&transient){delete state.addCo[id];render();if(state.open)refreshDetail();return;}
 if(!next&&transient)return;
 const arr=next===REMOVE_CO?extras:[next,...extras];
 const old=item.co_owner_ids||[];
 state.ownerBusy[id]=true;state.ownerFeedback[id]='Saving...';
 const copies=()=>[...document.querySelectorAll('[data-step-co]')].filter(el=>el.dataset.stepCo===id);
 const feedback=()=>document.querySelectorAll('[data-owner-feedback]').forEach(el=>{if(el.dataset.ownerFeedback===id)el.textContent=state.ownerFeedback[id]||'';});
 copies().forEach(el=>el.disabled=true);feedback();updateDailyPendingUI();
 try{const r=await saveStepCoOwners(supabase,item,arr);if(session?.user?.id!==uid)return;item.co_owner_ids=r.co_owner_ids||[];delete state.addCo[id];state.ownerFeedback[id]='Saved.';delete state.ownerBusy[id];dailyMemo=null;dailyHtmlMemo=null;render();if(state.open)refreshDetail();}
 catch{if(session?.user?.id===uid){state.ownerFeedback[id]='Not saved. Try again.';copies().forEach(el=>{el.value=old[0]||'';el.disabled=false;});feedback();}}
 finally{delete state.ownerBusy[id];updateDailyPendingUI();}
}
function timingWarning(item){
 const issues=schedulingIssues(state.data.sched,derive().pm,officeHolidays)[item.id];
 return issues?`<span class="timing-warning" title="${esc('Overlaps: '+issues.join(', '))}" role="status">⚠ Overlaps with ${esc(issues.join(', '))}</span>`:'';
}
function applyTimingWarnings(){
 const issues=schedulingIssues(state.data.sched,derive().pm,officeHolidays);
 document.querySelectorAll('[data-task-card],[data-card-item],[data-calendar-item]').forEach(el=>{const id=el.dataset.taskCard||el.dataset.cardItem||el.dataset.calendarItem;el.classList.toggle('schedule-conflict',Boolean(issues[id]));if(issues[id]&&!el.querySelector(':scope > .timing-warning')){const warning=document.createElement('span');warning.className='timing-warning';warning.textContent='⚠ Overlaps with '+issues[id].join(', ');warning.title='Overlaps: '+issues[id].join(', ');el.prepend(warning);}if(!issues[id])el.querySelectorAll(':scope > .timing-warning').forEach(x=>x.remove());});
}
function openTiming(ids,initial=null){
 const d=derive(),items=selectedSteps(ids,state.data.sched,d.pm),dialog=document.querySelector('#bulk-dialog');if(!items.length)return;
 dialog.innerHTML=`<div class="dialog-head"><h2>Change date</h2><button data-close aria-label="Close timing review">×</button></div><p>Within each workstream. Weekends and verified Monigle office holidays are skipped. Client/review/release dates never move automatically.</p>${officeHolidayCoverage.length?'':'<p class="timing-warning">Monigle holiday calendar is not verified yet. Preview and save are unavailable.</p>'}<p class="timing-save-hint">Choose a date, review any automatic pushes, then tap Save reviewed dates. Nothing changes until you save.</p><form id="timing-form">${items.length===1?`<label>Start date<input name="start" type="date" value="${esc(initial?.start_date??dateKey(items[0].start_date)??'')}"></label><label>Due date<input name="due" type="date" required value="${esc(initial?.due_date??dateKey(items[0].due_date)??'')}"></label>`:'<label>Shift by work days<input name="shift" type="number" min="-260" max="260" step="1" required value="1"></label>'}<button type="submit" ${officeHolidayCoverage.length?'':'disabled'}>Review date changes</button></form><div id="timing-preview" aria-live="polite"></div>`;
 bind(dialog);dialog.querySelector('form').onsubmit=e=>{
 e.preventDefault();const values=new FormData(e.target),preview=dialog.querySelector('#timing-preview');
 try{
  const changes=Object.fromEntries(items.map(i=>{if(items.length===1){const due=String(values.get('due'));let start=String(values.get('start')||'');const shifted=dueChange(i,due,officeHolidays);if(!initial&&due!==dateKey(i.due_date)&&start===(dateKey(i.start_date)||'')){start=shifted.start_date||'';dialog.querySelector('[name=start]').value=start;}if(start){dueChange(i,start,officeHolidays);if(start>due)throw Error('Start date must be on or before due date');}return [i.id,{due_date:due,start_date:start||null}];}if(!i.due_date)throw Error('A selected step has no due date. Set a date first.');const n=Number(values.get('shift'));if(!Number.isInteger(n)||!n)throw Error('Choose a nonzero whole number of work days');return [i.id,{due_date:shiftWorkDays(dateKey(i.due_date),n,officeHolidays),start_date:i.start_date?shiftWorkDays(dateKey(i.start_date),n,officeHolidays):null}];}));
  const plan=timingPlan(state.data.sched,d.pm,changes,officeHolidays,officeHolidayCoverage);
  if(!plan.changes.length)throw Error('No dates changed');
  const snapshots=state.data.sched.filter(i=>plan.affected.includes(i.project_id));const protectedIssues=plan.items.filter(i=>plan.issues[i.id]&&milestoneKind(i)&&plan.affected.includes(i.project_id));
  preview.innerHTML=`<h3>Review ${plan.changes.length} date changes</h3><ul class="bulk-review">${plan.changes.map(c=>{const old=state.data.sched.find(i=>i.id===c.id);return `<li><strong>${esc(old.title)}</strong><small>Start ${esc(fmtDate(old.start_date))} → ${esc(fmtDate(c.start_date))} · Due ${esc(fmtDate(old.due_date))} → ${c.automatic?'Suggested ':''}${esc(fmtDate(c.due_date))}${c.automatic?' · automatic push':' · selected change'}</small>${plan.issues[c.id]?'<span class="timing-warning">⚠ Overlap remains. Protected/manual dates are unchanged.</span>':''}</li>`;}).join('')}</ul>${protectedIssues.length?`<p class="timing-warning">⚠ Protected dates stay fixed: ${protectedIssues.map(i=>esc(i.title)+' ('+esc(fmtDate(i.due_date))+')').join(', ')}</p>`:''}<div class="timing-save-actions"><button id="apply-timing" class="primary" type="button">Save reviewed dates</button><span>These changes are not saved yet.</span></div><p role="status" id="timing-result"></p>`;
  preview.querySelector('button').onclick=async()=>{
   const button=preview.querySelector('button'),feedback=preview.querySelector('#timing-result');if(button.disabled)return;button.disabled=true;feedback.textContent='Saving...';
   try{const {data,error}=await supabase.rpc('apply_dashboard_timing',{payload:{items:snapshots.map(i=>({id:i.id,project_id:i.project_id,status:i.status,start_date:i.start_date||null,due_date:i.due_date||null,work_days_needed:i.work_days_needed||null,auto_adjust:i.auto_adjust,step_type:i.step_type,title:i.title,updated_at:i.updated_at})),explicit:plan.explicit,changes:plan.changes}});if(error||!data?.ok)throw Error(error?.message||'Save not confirmed');state.selectedSteps=[];dialog.close();await load();}catch(error){feedback.textContent='Not saved. '+error.message;button.disabled=false;}
  };
 }catch(error){preview.textContent=error.message;}
 };dialog.querySelectorAll('#timing-form input').forEach(input=>input.addEventListener('change',()=>dialog.querySelector('#timing-form').requestSubmit()));dialog.showModal();if(initial)dialog.querySelector('#timing-form').requestSubmit();
}
function workDaysControl(item){
 if(!canCompleteItem(state.access,item)||projectIsDone(derive().pm[item.project_id],derive().pm))return '';
 const pattern=timingPattern(item),span=calendarSpan(item,officeHolidays),start=dateKey(item.start_date)||span?.start||'',due=dateKey(item.due_date)||'';
 return `${!item.due_date&&pattern?`<small class="timing-pattern">Tentative reference window: ${pattern}. Based on recorded creation-to-due windows, not measured effort. Choose work days below.</small>`:''}<form class="work-days-control" data-work-days="${esc(item.id)}"><label>Work days needed<input type="number" min="1" max="260" step="1" required value="${item.work_days_needed||''}" aria-label="Work days needed for ${esc(item.title)}" placeholder="Not set"></label><button type="submit">Save days</button><span role="status" class="work-days-feedback"></span></form><form class="card-date-control" data-card-dates="${esc(item.id)}"><label>Start date<input name="start" type="date" value="${esc(start)}" aria-label="Start date for ${esc(item.title)}"></label><label>Due date<input name="due" type="date" required value="${esc(due)}" aria-label="Due date for ${esc(item.title)}"></label><button type="submit">Review date changes</button><small>${!item.start_date&&start?'Start is calculated from the due date and work days. Changes need review and save.':'Dates change only after review and save.'}${!item.work_days_needed?' Work days are not recorded; the calendar uses the date window or a one-day default.':''}</small></form>`;
}
function stepCheckbox(item){
 if(!canCompleteItem(state.access,item)||projectIsDone(derive().pm[item.project_id],derive().pm))return '';
 return `<label class="step-select"><input type="checkbox" data-select-step="${esc(item.id)}" aria-label="Select ${esc(item.title)}" ${state.selectedSteps.includes(item.id)?'checked':''}><span>Select</span></label>`;
}
function projectSelectControl(p){
 return `<label class="step-select project-select"><input type="checkbox" data-select-project="${esc(p.id)}" aria-label="Select ${esc(p.name)}" ${state.selectedProjects.includes(p.id)?'checked':''}><span>Select</span></label>`;
}
function combineBar(){
 const n=state.selectedProjects.length;
 return `<aside id="combine-bar" class="bulk-toolbar" ${n<1?'hidden':''} aria-label="Selected project actions"><strong data-project-selection-count>${n} project${n===1?'':'s'} selected</strong><button data-combine-projects ${n!==2?'disabled':''}>Combine</button><button data-rename-project ${n!==1?'disabled':''}>Rename</button><button data-clear-project-selection>Clear selection</button><span role="status" id="combine-feedback">${esc(state.combineFeedback)}</span></aside>`;
}
async function openProjectRename(){
 if(state.selectedProjects.length!==1)return;
 const d=derive(),p=d.pm[state.selectedProjects[0]];if(!p)return;
 const dialog=document.querySelector('#combine-dialog');
 dialog.innerHTML=`<div class="dialog-head"><h2>Rename project</h2><button data-close aria-label="Close rename">×</button></div><p>Only the name changes. Steps, dates, owners and history stay the same.</p><form id="project-rename-form"><label>New name<input name="new_name" maxlength="120" required value="${esc(p.name)}"></label><button class="primary" type="submit">Rename</button><p role="status" id="rename-save-status"></p></form>`;
 bind(dialog);
 dialog.querySelector('#project-rename-form').onsubmit=async e=>{
  e.preventDefault();const feedback=dialog.querySelector('#rename-save-status'),newName=String(new FormData(e.target).get('new_name')||'').trim();
  if(!newName){feedback.textContent='Enter the new name.';return;}
  e.target.querySelector('button[type=submit]').disabled=true;feedback.textContent='Saving...';
  const uid=session?.user?.id;
  try{const {data,error}=await supabase.rpc('rename_dashboard_project',{target_project_id:p.id,expected_name:p.name,new_name:newName});if(session?.user?.id!==uid)return;if(error||!data?.ok)throw Error(error?.message||'Rename not confirmed');state.selectedProjects=[];state.combineFeedback='Renamed.';dialog.close();await load();}
  catch(error){if(session?.user?.id===uid){feedback.textContent='Not saved. '+error.message;e.target.querySelector('button[type=submit]').disabled=false;}}
 };
 dialog.showModal();
}
function openCombine(){
 const d=derive(),ids=state.selectedProjects;
 const opts=combineOptions(ids,d.pm,state.data.sched);if(!opts)return;
 const dialog=document.querySelector('#combine-dialog');
 dialog.innerHTML=`<div class="dialog-head"><h2>Combine projects</h2><button data-close aria-label="Close combine">×</button></div><p>Every step - open and done - moves into the project you keep. The other project stays in place, empty. Dates, owners, statuses and history move with the steps.</p><form id="combine-form"><fieldset><legend>Which project keeps all the steps?</legend>${opts.map(o=>`<label class="combine-choice"><input type="radio" name="keep" value="${esc(o.keep.id)}" required> <span><strong>${esc(o.keep.name)}</strong><small>keeps its ${o.keepCount} steps and gains ${o.gainCount} from ${esc(o.source.name)}</small></span></label>`).join('')}</fieldset><button class="primary" type="submit">Combine projects</button><p role="status" id="combine-save-status"></p></form>`;
 bind(dialog);dialog.showModal();
 dialog.querySelector('#combine-form').onsubmit=async e=>{
  e.preventDefault();
  const plan=combinePlan(ids,new FormData(e.target).get('keep'),d.pm,state.data.sched);
  const fb=dialog.querySelector('#combine-save-status'),btn=e.target.querySelector('button[type=submit]');
  if(!plan)return;
  if(!plan.items.length){fb.textContent=`${plan.source.name} has no steps to move.`;return;}
  btn.disabled=true;fb.textContent='Saving...';
  try{await executeCombine(supabase,plan,state.access?.display_name||session.user.email);state.selectedProjects=[];state.combineFeedback='Projects combined.';dialog.close();await load();}
  catch(error){fb.textContent='Not saved. '+error.message;btn.disabled=false;}
 };
}
function bulkToolbar(){
 const count=state.selectedSteps.length;
 return `<aside id="bulk-toolbar" class="bulk-toolbar" ${count<1?'hidden':''} aria-label="Selected step actions"><strong data-selection-count>${count} step${count===1?'':'s'} selected</strong><button data-bulk-action="comment">Comment</button><button data-bulk-action="done">Mark done</button><button data-bulk-action="workstream">Add to project</button><button data-bulk-action="move">Move to project</button><button data-bulk-action="timing">Adjust timing</button><button data-bulk-action="rename" ${count!==1?'disabled':''}>Rename</button><button data-clear-selection>Clear selection</button><span role="status" id="bulk-feedback">${esc(state.bulkFeedback)}</span></aside>`;
}
function updateSelectionUI(){
 const allowed=new Set(state.data.sched.filter(i=>canCompleteItem(state.access,i)&&!projectIsDone(derive().pm[i.project_id],derive().pm)).map(i=>i.id));
 state.selectedSteps=state.selectedSteps.filter(id=>allowed.has(id));
 document.querySelectorAll('[data-select-step]').forEach(el=>{el.checked=state.selectedSteps.includes(el.dataset.selectStep);el.closest('[data-task-card],[data-card-item],.calendar-selectable')?.classList.toggle('is-selected',el.checked);});
 document.querySelectorAll('#bulk-toolbar').forEach(toolbar=>{toolbar.hidden=state.selectedSteps.length<1;toolbar.querySelector('[data-selection-count]').textContent=state.selectedSteps.length+' step'+(state.selectedSteps.length===1?'':'s')+' selected';const rb=toolbar.querySelector('[data-bulk-action="rename"]');if(rb)rb.disabled=state.selectedSteps.length!==1;});
 document.querySelectorAll('[data-select-project]').forEach(el=>{el.checked=state.selectedProjects.includes(el.dataset.selectProject);});
 document.querySelectorAll('#combine-bar').forEach(bar=>{bar.hidden=state.selectedProjects.length<1;bar.querySelector('[data-project-selection-count]').textContent=state.selectedProjects.length+' project'+(state.selectedProjects.length===1?'':'s')+' selected';const cb=bar.querySelector('[data-combine-projects]');if(cb)cb.disabled=state.selectedProjects.length!==2;const rp=bar.querySelector('[data-rename-project]');if(rp)rp.disabled=state.selectedProjects.length!==1;const fb=bar.querySelector('#combine-feedback');if(fb)fb.textContent=state.combineFeedback;});
}
function destinationClients(d){
 const out={};
 for(const p of state.data.projects){const cid=p.client_id||'',e=out[cid]=out[cid]||{name:d.cm[cid]?.name||'No client',projects:[],activeRoot:false};e.projects.push(p);if(!p.parent_id&&p.status!=='done')e.activeRoot=true;}
 return Object.entries(out).filter(([,e])=>e.activeRoot||e.projects.some(p=>p.status!=='done')).sort((a,b)=>a[1].name.localeCompare(b[1].name));
}
function destinationProjectOptions(entry){
 const opts=entry.projects.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${esc(p.id)}" ${p.status==='done'?'disabled':''}>${esc(p.name)}${p.status==='done'?' (done)':''}</option>`).join('');
 return opts+(entry.activeRoot?`<option value="new">Create new project</option>`:'');
}
function openBulk(action){
 if(action==='timing'){openTiming(state.selectedSteps);return;}
 const d=derive(),items=selectedSteps(state.selectedSteps,state.data.sched,d.pm);if(!items.length)return;
 const selClients=[...new Set(items.map(i=>d.pm[i.project_id]?.client_id).filter(Boolean))],mixNote=selClients.length>1?` Selection spans ${selClients.length} clients: ${esc(selClients.map(c=>d.cm[c]?.name||'Unknown').join(', '))}.`:'',destClients=destinationClients(d);
 const dialog=document.querySelector('#bulk-dialog'),titles={comment:'Comment on selected steps',done:'Mark selected steps done',workstream:'Add selected steps to project',move:'Move selected steps to project',rename:'Rename selected step'};
 
 dialog.innerHTML=`<div class="dialog-head"><h2>${titles[action]}</h2><button data-close aria-label="Close bulk actions">×</button></div><p>${items.length} selected step${items.length===1?'':'s'}.${mixNote} Review the exact list before saving.</p><ul class="bulk-review">${items.map(i=>`<li><strong>${esc(i.title)}</strong><small>${esc(d.pm[i.project_id].name)} · ${esc(label(i.status))} · ${esc(fmtDate(i.due_date))}</small></li>`).join('')}</ul><form id="bulk-form">${action==='comment'?'<label>Comment<textarea name="note" maxlength="5000" required rows="3"></textarea></label>':['move','workstream'].includes(action)?`<label>Destination client<select name="target_client" required><option value="">Choose client</option>${destClients.map(([cid,e])=>`<option value="${esc(cid)}">${esc(e.name)}</option>`).join('')}</select></label><label>Project<select name="target" required><option value="">Choose a client first</option></select></label><div id="new-workstream" hidden><label>Under project<select name="parent"><option value="">Choose project</option></select></label><label>Project name<input name="new_name" maxlength="120" placeholder="Collateral"></label></div>`:action==='rename'?`<label>New name<input name="new_name" maxlength="120" required value="${esc(items[0].title)}"></label><p>Only this step's name changes. Its project, dates and status stay the same.</p>`:'<p>Only these steps will be completed. Their projects and dates will not change.</p>'}<button class="primary" type="submit">${action==='comment'?'Send comment':action==='rename'?'Rename':'Apply to '+items.length+' step'+(items.length===1?'':'s')}</button><p role="status" id="bulk-save-status"></p></form>`;
 bind(dialog);
 const clientSel=dialog.querySelector('[name=target_client]'),projSel=dialog.querySelector('[name=target]');
 if(clientSel&&projSel){
  const fillProjects=cid=>{const entry=destClients.find(([id])=>id===cid)?.[1];projSel.innerHTML=entry?'<option value="">Choose project</option>'+destinationProjectOptions(entry):'<option value="">Choose a client first</option>';const roots=(entry?.projects||[]).filter(p=>!p.parent_id&&p.status!=='done'),parentSel=dialog.querySelector('[name=parent]');if(parentSel)parentSel.innerHTML=(roots.length===1?'':'<option value="">Choose project</option>')+roots.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');};
  clientSel.addEventListener('change',()=>{fillProjects(clientSel.value);dialog.querySelector('#new-workstream')?.setAttribute('hidden','');});
  if(selClients.length===1&&destClients.some(([cid])=>cid===selClients[0])){clientSel.value=selClients[0];fillProjects(selClients[0]);}
 }
 projSel?.addEventListener('change',e=>{dialog.querySelector('#new-workstream')?.toggleAttribute('hidden',e.target.value!=='new');});
 dialog.querySelector('form').onsubmit=async e=>{
 e.preventDefault();if(state.bulkBusy)return;const values=new FormData(e.target),target=values.get('target'),feedback=dialog.querySelector('#bulk-save-status');
 const extra={};if(action==='comment')extra.note=String(values.get('note')||'').trim();
 if(action==='rename'){extra.new_name=String(values.get('new_name')||'').trim();if(!extra.new_name){feedback.textContent='Enter the new name.';return;}extra.expected_title=items[0].title;}
 if(['move','workstream'].includes(action)){if(!target){feedback.textContent='Choose a destination.';return;}if(target==='new'){extra.parent_id=values.get('parent');extra.new_name=String(values.get('new_name')||'').trim();if(!extra.parent_id||!extra.new_name){feedback.textContent='Choose a project and enter a name.';return;}}else extra.target_id=target;}
 state.bulkBusy=true;feedback.textContent='Saving...';e.target.querySelector('button[type=submit]').disabled=true;
 const uid=session?.user?.id;
 try{const result=await applyBulk(supabase,items,action==='workstream'?'move':action,{...extra,author_name:state.access?.display_name||session.user.email});if(session?.user?.id!==uid)return;state.selectedSteps=[];state.bulkFeedback=action==='comment'?'Comments saved. Queued for processing.':'Changes saved.';dialog.close();await load();}
 catch(error){if(session?.user?.id===uid){feedback.textContent='Not saved. '+error.message;e.target.querySelector('button[type=submit]').disabled=false;}}
 finally{state.bulkBusy=false;}
 };
 dialog.showModal();
}
function taskCard(i,d,expanded=false){
 if(state.view==='projects'&&state.hideDone&&i.status==='done')return '';
 const p=d.pm[i.project_id];if(!p)return '';const dt=due(i.due_date,i.status),kind=milestoneKind(i);
 if(i.status==='done'&&!expanded)return `<details class="finished-task" data-finished-task="${esc(i.id)}" data-finished-lazy="${esc(i.id)}"><summary>${stepCheckbox(i)}<span class="finished-check" aria-hidden="true">✓</span><span class="finished-title">${esc(i.title)}</span><span class="finished-date">${suggestedDateLabel(i)}${i.due_date?esc(fmtDate(i.due_date)):'No date'}</span><span class="owner">${inlineOwner(i,d)}</span><span class="finished-label">Done</span></summary></details>`;

 return `<details class="task-card compact-task step-row ${i.status==='in_progress'?'has-current-step':i.status==='done'?'is-finished':''} ${kind?`client-milestone milestone-${kind}`:''}" data-step-row="${esc(i.id)}" data-task-card="${esc(i.id)}" data-card-open="${esc(p.id)}" data-card-item="${esc(i.id)}" ${state.stepRowOpen[i.id]||expanded?'open':''} aria-label="Open details for ${esc(i.title)}" ${state.focusedTask===i.id?'data-task-highlight="true"':''}><summary>${stepCheckbox(i)}<span class="task-kind kind-${kind||'normal'}" title="${kind==='meeting'?'Client meeting':kind==='review'?'Client review':kind==='release'?'Client delivery':'Task'}" aria-hidden="true"></span><div class="task-row-title">${taskBreadcrumb(p,d)}<h3 class="task-step-name"><button class="title-button" data-open="${esc(p.id)}" data-target-item="${esc(i.id)}">${esc(i.title)}</button></h3></div>${stuckBadge(i)}<span class="task-date ${dt.cls}">${suggestedDateLabel(i)}${esc(dt.text)}</span><span class="owner">${inlineOwner(i,d)}</span>${stepStatusPill(i,d)}${kind?`<span class="compact-milestone">${kind==='meeting'?'Client meeting':kind==='review'?'Review':'Release'}</span>`:''}<span class="row-chevron" aria-hidden="true">▸</span></summary><div class="step-row-body">${state.dependencyAvailable&&(lateDeps()[i.id]||[]).length?`<div class="risk-badge">At risk: late upstream · ${lateDeps()[i.id].map(x=>esc(x.title)).join(', ')}</div>`:''}${timeline(p,d,i)}${questionsArea(p,i)}${quickInput(p,i)}${commentHistory(p,i)}
 <div class="task-row-actions"><details class="card-edit-controls" ${expanded?'open':''}><summary><span class="edit-expand">Expand card</span><span class="edit-collapse">Card controls</span></summary><div class="card-edit-fields">${stepStatusControl(i,d)}${stepOwnerControl(i,d)}${workDaysControl(i)}</div></details><button class="text-button" data-adjust-timing="${esc(i.id)}">Adjust timing</button>${sourceControls(p,i,d)}${i.status!=='done'&&!projectIsDone(p,d.pm)&&canCompleteItem(state.access,i)?`<button class="compact-done" data-complete-task="${esc(i.id)}" aria-label="Mark task done: ${esc(i.title)}">✓ Done</button>`:''}</div><details class="task-more"><summary>Context</summary>${i.notes?`<p class="task-note">${esc(i.notes)}</p>${originalSourceControls(i)}`:''}<footer><button class="text-button" data-open="${esc(p.id)}" data-target-item="${esc(i.id)}">Open project →</button></footer></details><p class="task-complete-status" role="status" aria-live="polite"></p></div></details>`;

}
function populateFinishedCard(el){
 const id=el.dataset.finishedLazy;if(!id||el.dataset.finishedFilled)return;
 const item=state.data?.sched.find(x=>x.id===id);if(!item)return;
 el.dataset.finishedFilled='1';
 el.insertAdjacentHTML('beforeend',taskCard(item,derive(),true));
 bind(el);applyTimingWarnings();
}
let lateDepsMemo=null;
function lateDeps(){
 const key=[state.data?.sched,state.dependencyEdges,today()];
 return (lateDepsMemo&&lateDepsMemo.key.every((v,i)=>v===key[i]))?lateDepsMemo.value:(lateDepsMemo={key,value:lateDependencies(state.data.sched,state.dependencyEdges,today())}).value;
}
function assignmentGroups(items,d){
 return groupAssignments(items,d.pm).map(group=>`<section class="assignment-group"><div class="assignment-heading"><h3><button class="title-button" data-open="${esc(group.project.id)}">${esc(joinedNames(d.cm[group.project.client_id]?.name||'Production',shortName(group.project,d)))}</button></h3><span class="number" aria-label="${group.count} assignments">${group.count}</span></div>${[...group.branches.values()].map(branch=>`${branch.project.id!==group.project.id?`<h4 class="branch-heading"><button class="title-button" data-open="${esc(branch.project.id)}">${esc(shortName(branch.project,d))}</button><span>${branch.items.length} assignment${branch.items.length===1?'':'s'}</span></h4>`:''}<div class="task-grid">${branch.items.map(i=>taskCard(i,d)).join('')}</div>`).join('')}</section>`).join('');
}
function workstreamHeading(p,d,items){
 return `<header class="workstream-heading"><div class="workstream-identity"><span class="hierarchy-label">${p.parent_id?'PROJECT':'PROJECT STEPS'}</span><h4><button class="title-button" data-open="${esc(p.id)}">${esc(p.parent_id?workstreamLabel(p,d.pm):p.name)}</button></h4><span class="workstream-count">${items.filter(i=>i.status!=='done').length} open / ${items.length} steps</span></div><div class="workstream-timeline">${timeline(p,d)}</div></header>`;
}
function projectStepListings(p,d,hideDone=state.view==='projects'&&state.hideDone){
 return flatProjectBranches(p,d.pm,state.view==='projects'&&state.hideDone).map(({project:branch,depth})=>{
 const items=visibleCards(d.sch[branch.id]||[],hideDone);
 if(!depth&&!items.length)return '';
 return `<section class="page-step-group ${depth?'workstream-group':'direct-step-group'}" data-workstream="${esc(branch.id)}" data-revision-project="${esc(branch.id)}" aria-label="${esc(branch.name)} steps">${workstreamHeading(branch,d,items)}${depth?`<details class="workstream-context"><summary>Workstream context & updates</summary>${latest(branch,d)}${questionsArea(branch,null)}${commentButton(branch)}</details>`:''}<div class="task-grid">${items.map(i=>taskCard(i,d)).join('')||'<p class="muted">No direct steps recorded.</p>'}</div></section>`;
 }).join('');
}
function taskBreadcrumb(p,d){
 const {brand,path}=breadcrumbParts(p,d.pm,d.cm),parts=path.map((part,n)=>`${n||brand?'<span class="breadcrumb-separator" aria-hidden="true">›</span>':''}<button class="text-button" data-open="${esc(part.id)}">${esc(n?workstreamLabel(part,d.pm):part.name)}</button>`).join('');
 return `<span class="task-breadcrumb">${brand?`<span class="breadcrumb-brand">${esc(brand.name)}</span>`:''}${parts}</span>`;
}
function projectSchedule(p,d,rollup=false){
 const key=rollup?'page-'+p.id:p.id,hideDone=state.scheduleHideDone[key]??(state.view==='projects'&&state.hideDone);
 const items=visibleCards(rollup?timelineSteps(p,state.data.sched,d.pm):d.sch[p.id]||[],hideDone),mode=state.scheduleModes[key]||'list';
 let chart=null,ganttTools='',dated=[],undated=[];
 if(mode==='calendar'){
  const range=state.ganttRanges[key]||(state.ganttRanges[key]={mode:'week',anchor:today(),scrollTo:'anchor'});
  const axis=ganttAxis(range.anchor,range.mode,{week:8,month:6,'2mo':3,quarter:2,year:1}[range.mode]||3),entries=calendarEntries([],items,i=>calendarSpan(i,officeHolidays),day=>isWorkDay(day,officeHolidays));
  dated=entries.filter(r=>r.date).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));undated=entries.filter(r=>!r.date);
  const gh=ganttHelpers(d,range.mode,rollup?p.id:null,axis);gh.scope='range';gh.scheduleKey=key;
 chart=ganttChart(axis,[{id:p.id,sections:[{rows:dated}]}],gh);
  ganttTools=`<div class="gantt-toolbar"><div class="calendar-view-modes" aria-label="Schedule range">${GANTT_MODES.map(([m,t])=>`<button data-gantt-mode="${m}" data-schedule-key="${esc(key)}" data-project="${esc(p.id)}" aria-pressed="${range.mode===m}">${t}</button>`).join('')}</div><div class="gantt-nav"><button data-gantt-move="-1" data-schedule-key="${esc(key)}" data-project="${esc(p.id)}" aria-label="Previous period">&#8249;</button><button data-gantt-today data-schedule-key="${esc(key)}" data-project="${esc(p.id)}">Today</button><button data-gantt-move="1" data-schedule-key="${esc(key)}" data-project="${esc(p.id)}" aria-label="Next period">&#8250;</button></div></div>`;
 }
 return `<section class="project-schedule"><div class="schedule-heading"><h3 class="detail-heading">Schedule <span class="number">${items.length}</span></h3><label class="hide-done-control"><input type="checkbox" data-schedule-hide-done="${esc(key)}" ${hideDone?'checked':''}> Hide done</label><div class="schedule-tabs" role="tablist" aria-label="Schedule view for ${esc(p.name)}">${['list','calendar'].map(v=>`<button role="tab" id="tab-${esc(key)}-${v}" aria-controls="schedule-${esc(key)}" aria-selected="${mode===v}" data-schedule-mode="${v}" data-project="${esc(p.id)}" data-schedule-key="${esc(key)}">${v==='list'?'List':'Calendar'}</button>`).join('')}</div></div><div id="schedule-${esc(key)}" role="tabpanel" aria-labelledby="tab-${esc(key)}-${mode}">${mode==='list'?(rollup?projectStepListings(p,d,hideDone):items.map(i=>taskCard(i,d)).join(''))||'<p class="muted">No schedule items recorded.</p>':`${ganttTools}<p class="calendar-hint">Gantt view: bars run from recorded start to due date across weekdays. Click a bar for its card.</p>${milestoneLegend()}${chart.html}${chart.weekendHidden?'<p class="calendar-hint">'+chart.weekendHidden+' weekend-dated item(s) are hidden here. Their dates are unchanged; use List to view them.</p>':''}${undated.length?`<div class="undated"><h4>No date set</h4>${items.filter(i=>!dateKey(i.due_date)).map(i=>taskCard(i,d)).join('')}</div>`:''}`}</div></section>`;
}

function refreshDetail(){const dialog=document.querySelector('#detail');dialog.innerHTML=detail(derive().pm[state.open],derive());bind(dialog);applyTimingWarnings();}
function openDay(pid,key,rollup=false){
 const d=derive(),p=d.pm[pid],items=visibleCards(rollup?timelineSteps(p,state.data.sched,d.pm):d.sch[pid]||[],state.view==='projects'&&state.hideDone).filter(i=>itemOnCalendarDay(i,key,officeHolidays)),dialog=document.querySelector('#day-dialog');
 state.openDay={pid,key,rollup};dayFocus=document.activeElement;
 dialog.innerHTML=`${bulkToolbar()}<div class="dialog-head"><span class="eyebrow">${esc(p.name)}</span><button class="close" data-close aria-label="Close date cards">×</button></div><h2 id="day-title">${esc(new Date(key+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}))}</h2><p class="day-summary">${items.length} schedule item${items.length===1?'':'s'}</p>${items.map(i=>taskCard(i,d)).join('')||'<p class="empty">Nothing scheduled on this date.</p>'}`;
 bind(dialog);applyTimingWarnings();
 dialog.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{dialog.close();openDetail(b.dataset.open,b.dataset.targetItem);});
 dialog.querySelectorAll('[data-comment]').forEach(b=>b.onclick=()=>{dialog.close();openComment(b.dataset.comment,b.dataset.item);});
 dialog.showModal();dialog.querySelector('[data-close]').focus();
}
async function completeTask(id){
 if(state.completing)return;
 const item=state.data.sched.find(i=>i.id===id);if(!item||item.status==='done'||!canCompleteItem(state.access,item))return;
 if(!window.confirm(`Mark task "${item.title}" done? Only this task will be completed, not its client. It will move to Finished steps.`))return;
 state.completing=true;
 const cards=[...document.querySelectorAll('[data-task-card]')].filter(c=>c.dataset.taskCard===id);
 cards.forEach(c=>{c.querySelector('[data-complete-task]').disabled=true;c.querySelector('.task-complete-status').textContent='Saving completion...';});
 try{
  const {data,error}=await supabase.rpc('complete_dashboard_task',{target_schedule_item_id:id});
  if(error||data?.id!==id||data?.status!=='done')throw Error('Completion not confirmed');
  item.status='done';if(state.focusedTask===id)state.focusedTask=null;
  const projectId=state.open,day=document.querySelector('#day-dialog')?.open?state.openDay:null;
  const detailScroll=document.querySelector('#detail')?.scrollTop??0;
  render();
  if(projectId){openDetail(projectId,state.focusedTask,true);const detailEl=document.querySelector('#detail');if(detailEl)detailEl.scrollTop=detailScroll;}
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
function taskSection(key,name,rows,d,{compact=true,description='',reasons={},className='work-bucket'}={}){
 const collapsed=state.sectionModes[key]??false,bodyId='section-'+key;
 return `<section class="${className}" data-task-section="${esc(key)}"><div class="section-heading"><h2>${esc(name)} <span class="number">${rows.length}</span></h2>${description?`<p>${esc(description)}</p>`:''}<button class="section-toggle" data-section-toggle="${esc(key)}" aria-expanded="${!collapsed}" aria-controls="${esc(bodyId)}" aria-label="${collapsed?'Expand':'Collapse'} ${esc(name)}">${collapsed?'Expand':'Collapse'}</button></div><div id="${esc(bodyId)}" class="task-grid"${collapsed?' hidden':''}>${rows.map(i=>taskCard(i,d)).join('')||'<p class="muted">No matching items.</p>'}</div></section>`;
}
function needsYou(d,items){const matches=needsAttention(items,d.pm,today(),d.aaron);return taskSection('today-attention','Needs attention',matches.map(x=>x.item),d,{compact:true,className:'needs-you',description:'Blocked on the selected owner, due within two days, or missing an owner.',reasons:Object.fromEntries(matches.map(x=>[x.item.id,x.reasons]))});}
function textUpdateView(d){const candidates=matchUpdate(state.matchText,state.data.sched,d.pm);return `<details class="text-update" ${state.matchText||state.matchFeedback?'open':''}><summary>Text an update</summary><p>Type a project or step and an update. Choose the exact step below before sending. This uses your signed-in dashboard identity.</p><label for="match-text">Update text</label><textarea id="match-text" maxlength="5000" ${state.matchSaving?'disabled':''} rows="2" placeholder="CareCredit proofs done">${esc(state.matchText)}</textarea><p class="match-feedback" role="status">${esc(state.matchFeedback)}</p>${state.matchText?`<div class="match-results">${candidates.map(i=>`<button data-match-item="${esc(i.id)}" ${state.matchSaving?'disabled':''} aria-pressed="${state.matchItem===i.id}">${esc(joinedNames(d.pm[i.project_id]?.name,i.title))}</button>`).join('')||'<p>No exact keyword match. Use the update box on the step itself.</p>'}</div>${state.matchItem&&candidates.some(i=>i.id===state.matchItem)?`<form id="matched-update"><p>Send to <strong>${esc(joinedNames(d.pm[state.data.sched.find(i=>i.id===state.matchItem)?.project_id]?.name,state.data.sched.find(i=>i.id===state.matchItem)?.title))}</strong></p><button type="submit" ${state.matchSaving?'disabled':''}>Send this update</button><span role="status"></span></form>`:''}`:''}</details>`;}
function recapQuestions(d){
 if(!state.questionsAvailable)return '<section class="recap-questions"><h2>Questions</h2><p class="question-unavailable">Questions unavailable. Refresh to try again; no coverage can be assessed.</p></section>';
 const result=recapQuestionGroups(state.data.projects,state.data.sched,state.data.questions);
 return `<section class="recap-questions" aria-labelledby="recap-questions-heading"><h2 id="recap-questions-heading">Questions <span class="number">${result.count}</span></h2><p class="recap-questions-intro">Open questions from Instinct, grouped by project and exact step. Anyone with access can answer. Answers are saved for review; they do not change a project automatically.</p><p class="recap-question-coverage">${result.projectsWithoutOpenQuestions} active projects and ${result.stepsWithoutOpenQuestions} open steps have no open question recorded. This is coverage, not proof those records are complete.${result.unresolvedCount?` ${result.unresolvedCount} open question(s) have unavailable project/step context.`:''}</p>${result.groups.map(g=>`<article class="recap-question-project"><h3><button class="title-button" data-open="${esc(g.project.id)}">${esc(g.project.name)}</button></h3><p class="task-context">${esc(d.cm[g.project.client_id]?.name||'No client')} · ${esc(label(g.project.status))}</p>${g.projectQuestions.length?`<div class="recap-question-scope"><h4>Project questions</h4>${questionsArea(g.project,null,true)}</div>`:''}${g.steps.map(({item})=>`<div class="recap-question-scope"><h4><button class="title-button" data-open="${esc(g.project.id)}" data-target-item="${esc(item.id)}">${esc(item.title)}</button></h4><p class="task-context">${inlineOwner(item,d)} · ${esc(label(item.status))}</p>${questionsArea(g.project,item,true)}</div>`).join('')}</article>`).join('')||'<p class="empty">No open questions recorded. The feed is responsible for adding grounded questions; an empty list does not mean all work is complete.</p>'}</section>`;
}
function recapView(d){const {start,end}=weekWindow(today()),items=state.data.sched,open=items.filter(i=>i.status!=='done'&&!projectIsDone(d.pm[i.project_id],d.pm)),past=open.filter(i=>dateKey(i.due_date)&&dateKey(i.due_date)<today()),waiting=open.filter(i=>i.status==='waiting'||d.pm[i.project_id]?.status==='waiting');return `<div class="page-title"><h1>Weekly recap</h1><p>${esc(fmtDate(start))} - ${esc(fmtDate(end))} · live snapshot, not timesheet hours</p></div><p class="recap-caveat">This feed has no step completion timestamps or step-level date history, so weekly completions and actual deadline slips cannot be counted. A completion is not proof of client delivery. Past dates are not proof a deadline slipped. A recorded date-change history is needed for that.</p>${[['Past dates needing status check',past],['Waiting',waiting]].map(([name,rows])=>taskSection('recap-'+name.replaceAll(' ','-'),name,rows,d,{className:'recap-group'})).join('')}${recapQuestions(d)}<section class="recap-group"><h2>Completed this week</h2><p class="muted">Unavailable: this feed does not record when a step was completed.</p></section><section><h2>Recorded project updates this week</h2>${state.data.updates.filter(u=>recordedDay(u.created_at)>=start&&recordedDay(u.created_at)<=end).map(u=>`<article class="recap-note"><strong>${esc(d.pm[u.project_id]?.name)}</strong><small>${esc(stamp(u.created_at))} MT</small><p>${esc(u.note)}</p>${originalSourceControls(u)}</article>`).join('')||'<p class="muted">No recorded updates this week.</p>'}</section>`;}
function pastDueSection(d,scope,provided=null){
 const rows=provided??unresolvedPastDue(state.data.sched,d.pm,today(),scope==='team'?null:(d.aaron||'__unlinked__'));
 return `<section class="past-due-section" aria-labelledby="past-due-heading"><div class="section-heading"><h2 id="past-due-heading">Past due - mark done or change date <span class="number">${rows.length}</span></h2></div><p class="past-due-intro">${scope==='team'?'Unresolved past dates across the team.':'Your unresolved past dates.'} Mark a task done, or choose a new due date. Review date changes and any automatic pushes before saving.</p><div class="past-due-list">${rows.map(i=>{const p=d.pm[i.project_id],allowed=canCompleteItem(state.access,i);return `<article class="past-due-item" data-task-card="${esc(i.id)}" data-past-due-item="${esc(i.id)}">${stepCheckbox(i)}<div class="past-due-context">${taskBreadcrumb(p,d)}<h3><button class="title-button" data-open="${esc(p.id)}" data-target-item="${esc(i.id)}">${esc(p.name)}</button></h3><p>${esc(i.title)}</p><small>${suggestedDateLabel(i)}Past due ${esc(fmtDate(i.due_date))} · ${inlineOwner(i,d)} · ${esc(label(i.status))}</small></div><div class="past-due-controls">${allowed?`<button data-complete-task="${esc(i.id)}" aria-label="Mark task done: ${esc(i.title)}">✓ Mark done</button>`:''}<button data-adjust-timing="${esc(i.id)}">Change date</button></div><p class="past-date-feedback" role="status" aria-live="polite">${esc(state.pastDateFeedback[i.id]||'')}</p><p class="task-complete-status" role="status" aria-live="polite"></p></article>`;}).join('')||'<p class="past-due-empty">No unresolved past due dates in this view.</p>'}</div></section>`;
}
function myWorkCalendar(d,items){
 const anchor=state.workFilter==='nextweek'?shiftGanttAnchor(today(),'week',1):today();
 const axis=ganttAxis(anchor,'week',12);
 const entries=calendarEntries([],items,i=>calendarSpan(i,officeHolidays),day=>isWorkDay(day,officeHolidays));
 const dated=entries.filter(r=>r.date),undated=entries.filter(r=>!r.date);
 const byProject={};for(const r of dated)(byProject[r.project_id] ||= []).push(r);
 const sortRows=rows=>rows.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
 const subsOf={};for(const p of state.data.projects)if(p.parent_id&&d.pm[p.parent_id])(subsOf[p.parent_id] ||= []).push(p);
 const groups=[];
 for(const p of state.data.projects){
  if(p.parent_id&&d.pm[p.parent_id])continue;
  const sections=[],own=sortRows(byProject[p.id]||[]);
  if(own.length)sections.push({rows:own});
  for(const s of subsOf[p.id]||[]){const rows=sortRows(byProject[s.id]||[]);if(rows.length)sections.push({subhead:esc(s.name),rows});}
  if(!sections.length)continue;
  const all=sections.flatMap(s=>s.rows),collapsed=!!state.ganttCollapsed['my-'+p.id];
  groups.push({id:p.id,collapsed,sections,head:`<div class="gantt-group-head"><div class="gantt-group-head-inner"><button class="gantt-chevron" data-gantt-toggle="my-${esc(p.id)}" aria-expanded="${!collapsed}" aria-label="${collapsed?'Expand':'Collapse'} ${esc(p.name)}">${collapsed?'▸':'▾'}</button><h4><button class="title-button" data-open="${esc(p.id)}">${esc(p.name)}</button></h4><span class="gantt-count">${all.length} step${all.length===1?'':'s'}</span></div></div>`});
 }
 const lh=ganttHelpers(d,'week',null,axis);lh.scope='mywork';lh.scheduleKey='mywork';
 const chart=ganttChart(axis,groups,lh);
 return `<section class="my-work-calendar"><h2 class="calendar-period-title">${esc(ganttPeriodTitle(anchor,'week',axis))}</h2>${chart.html}${undated.length?`<section class="my-work-undated"><h2 class="calendar-period-title undated-title">No date <span class="number">${undated.length}</span></h2><div class="task-grid">${items.filter(i=>!dateKey(i.due_date)).map(i=>taskCard(i,d)).join('')}</div></section>`:''}${groups.length?'':'<p class="empty">No dated steps in this filter.</p>'}</section>`;
}
let dailyMemo=null;
const DAILY_COLS=[['urgent','urgent','Urgent (whole team, all brands): steps that are past due, due today, or blocked / waiting on others. My work > Needs attention is only your own steps, so its count is smaller. Click to show only these.'],['changed','changed','Changed in the last 24 business hours: steps finished plus plain-words [Daily] notes (date moves, delays, deliveries, decisions). Click to list them.'],['active','in progress','Open steps that are started (in progress) but not past due, due soon, or blocked. Started work always shows here so it never drops off the status. Click to show only these.'],['next','next few days','Open steps due in the next 3 days that are not already urgent. Click to show only these.'],['week','later (7 days)','Open steps due from day 4 through the next 7 days that are not already urgent. Click to show only these.']];
function briefing(b,d){
 const owner=i=>ownerNames(i,d.mm,"No owner");
 const keep=k=>!state.dailyFocus||state.dailyFocus===k;
 const projs=new Map();
 const get=p=>projs.get(p.id)||(projs.set(p.id,{p,notes:[],done:[],steps:[],rdone:[]}),projs.get(p.id));
 for(const x of b.changed)if(keep('changed')){const g=get(x.project);(x.kind==='note'?g.notes:g.done).push(x);}
 for(const x of b.rdone||[])get(x.project).rdone.push(x);
 for(const [k,rows] of [['urgent',b.urgent],['next',b.next],['week',b.week],['active',b.active||[]]])if(keep(k))for(const x of rows)get(x.project).steps.push({...x,cat:k});
 const rank=g=>g.steps.some(s=>s.cat==='urgent')?0:1,first=g=>g.steps.map(s=>s.due||'9999').sort()[0]||'9999';
 // The brand's root project (direct steps, no subproject) lists first, merged
 // under the brand header - its own header row would duplicate the brand.
 const root=g=>g.p.id===b.project_id?0:1;
 const gs=[...projs.values()].sort((x,y)=>root(x)-root(y)||rank(x)-rank(y)||first(x).localeCompare(first(y))||x.p.name.localeCompare(y.p.name));
 return `<ul class="brief">${gs.map(g=>`<li class="brief-proj">${g.p.id===b.project_id?'':`<div class="daily-line"><b><button class="title-button" data-open="${esc(g.p.id)}">${esc(g.p.name)}</button></b>${commentButton(g.p,null)} <button class="comment daily-copy" data-copy-brand="${esc(b.key)}" data-copy-project="${esc(g.p.id)}">Copy text</button></div>`}${g.notes.map(n=>`<p class="brief-note">${esc(n.text)} <span class="daily-meta">${esc(stamp(n.at))}</span></p>`).join('')}<ul class="brief-steps">${g.steps.sort((x,y)=>(x.due||'9999').localeCompare(y.due||'9999')).map(x=>`<li>${stepCheckbox(x.item)}<button class="title-button" data-open="${esc(x.project.id)}" data-target-item="${esc(x.item.id)}">${esc(x.item.title)}</button> - ${inlineOwner(x.item,d)} - <span class="brief-tag brief-${x.cat}">${esc(x.cat==='urgent'?x.why:x.cat==='active'?'In progress':'Due')}</span>${x.due?' '+esc(fmtDate(x.due)):''}</li>`).join('')}${g.done.map(x=>`<li>${stepCheckbox(x.item)}<button class="title-button" data-open="${esc(x.project.id)}" data-target-item="${esc(x.item.id)}">${esc(x.item.title)}</button> - ${inlineOwner(x.item,d)} - <span class="brief-tag brief-done">Done</span> ${esc(stamp(x.at))}</li>`).join('')}${g.rdone.length?`<li class="brief-done-subhead">Done (last 5 working days)</li>`+g.rdone.map(x=>`<li class="brief-rdone">${stepCheckbox(x.item)}<button class="title-button" data-open="${esc(x.project.id)}" data-target-item="${esc(x.item.id)}">${esc(x.item.title)}</button> - ${inlineOwner(x.item,d)} - <span class="brief-tag brief-done">Done</span> ${esc(fmtDate(dayKey(new Date(x.at).getTime())))}</li>`).join(''):''}</ul></li>`).join('')}</ul>`;
}
function currentDaily(d){
 const memoKey=[state.data,today(),Math.floor(Date.now()/60000)];
 return (dailyMemo&&dailyMemo.key.every((v,i)=>v===memoKey[i]))?dailyMemo.value:(dailyMemo={key:memoKey,value:dailyStatus({items:state.data.sched,updates:state.data.updates,projects:d.pm,clients:state.data.clients,today:today()})}).value;
}
let dailyHtmlMemo=null;
function dailyStatusView(d){
 if(isFreelancer(state.access))return '';
 const r=currentDaily(d),memoKey=[r,state.dailyOpen,state.dailyFocus||'',Object.keys(state.addCo).sort().join(',')];
 if(dailyHtmlMemo&&dailyHtmlMemo.key.every((v,i)=>v===memoKey[i]))return dailyHtmlMemo.value;
 const html=buildDailyStatusView(d,r);
 dailyHtmlMemo={key:memoKey,value:html};
 return html;
}
function buildDailyStatusView(d,r){
 const t=r.totals;
 const line=(x,extra)=>`<li><div class="daily-line"><span>${x.kind==='note'?`<span class="daily-what">${esc(x.text)}</span>`:`<button class="title-button" data-open="${esc(x.project.id)}"${x.item?` data-target-item="${esc(x.item.id)}"`:''}>${esc(x.item?joinedNames(x.project.name,x.item.title):x.project.name)}</button>`}${x.kind==='note'?` <button class="title-button daily-proj" data-open="${esc(x.project.id)}">${esc(x.project.name)}</button>`:''}</span>${commentButton(x.project,x.item)}</div>${extra?`<span class="daily-meta">${esc(extra)}</span>`:''}</li>`;
 const owner=i=>ownerNames(i,d.mm,'No owner');
 const list=(rows,fn)=>rows.length?`<ul>${rows.map(fn).join('')}</ul>`:'<p class="muted">Nothing.</p>';
 const block=(name,rows,fn)=>`<div class="daily-col"><h4>${name} <span class="number">${rows.length}</span></h4>${list(rows,fn)}</div>`;
 const focus=k=>!state.dailyFocus||state.dailyFocus===k;
 const short=s=>{const x=String(s||'').replace(/\s+/g,' ').trim();return x.length>140?x.slice(0,137)+'...':x;};
 return `<details class="daily-status" ${state.dailyOpen?'open':''}><summary><b>Daily status</b> <span class="daily-sum">${DAILY_COLS.map(([k,n,tip])=>`<span class="daily-chip" role="button" tabindex="0" data-daily-focus="${k}" aria-pressed="${state.dailyFocus===k}" title="${esc(tip)}">${t[k]} ${n}</span>`).join(' · ')}</span> <button class="comment daily-copy" data-copy-status>Copy text</button></summary><p class="daily-note">By brand, then by project, in the same shape as the Production Team status post: what changed, who owns each step, and what is due over the next 7 days. Changes cover the last 24 business hours (since ${esc(stamp(r.since))} MT, weekends skipped) and lists only completions and events the team needs to know about, in plain words. Past due, due today and blocked steps are tagged in red.</p>${!state.dailyOpen?'':(state.dailyFocus?`<p class="daily-focus">Showing only <b>${esc(DAILY_COLS.find(x=>x[0]===state.dailyFocus)[1])}</b> (${t[state.dailyFocus]}). <button class="title-button" data-daily-focus="">Show all lists</button></p>`:'')+r.brands.filter(b=>!state.dailyFocus||b[state.dailyFocus].length).map(b=>`<article class="daily-brand"><div class="daily-brand-head"><h3>${b.project_id&&d.pm[b.project_id]?`<button class="title-button" data-open="${esc(b.project_id)}">${esc(b.name)}</button>`:esc(b.name)}${(()=>{const cx=projectCx(d.pm[b.project_id],d.pm);return cx.length?` <span class="daily-cx">CX: ${esc(cx.join(', '))}</span>`:'';})()}</h3>${b.project_id&&d.pm[b.project_id]?`<button class="comment" data-comment="${esc(b.project_id)}" data-brand="${esc(b.name)}" aria-label="Comment to Instinct about the whole ${esc(b.name)} brand"><span aria-hidden="true">↗</span> Update</button>`:''}<button class="comment daily-copy" data-copy-brand="${esc(b.key)}">Copy text</button></div><div class="daily-brief">${briefing(b,d)}</div></article>`).join('')||'<p class="muted">No activity or dated work to show.</p>'}</details>`;
}
function weekdayWorkList(items,d){
 const groups=new Map();for(const item of items){const key=dateKey(item.due_date)||'undated';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([day,rows])=>taskSection('week-day-'+day,day==='undated'?'No date set':new Date(day+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'short',day:'numeric'}),rows,d)).join('')||'<p class="muted">No steps due this week.</p>';
}
function todayView(d){
 const scope=isFreelancer(state.access)?'mine':state.workScope,first=d.identity.display_name?.trim().split(/\s+/)[0];
 const selected=state.data.sched.filter(i=>!projectIsDone(d.pm[i.project_id],d.pm)&&(scope==='team'||i.owner_id===d.aaron||(i.co_owner_ids||[]).includes(d.aaron)||(!isFreelancer(state.access)&&!i.owner_id)));
 const overview=workOverview(selected,d.pm,today()),filtered=overview.filters[state.workFilter]||overview.filters.all,result=filtered===overview.filters.all?overview:workOverview(filtered,d.pm,today());
 const tiles=[['all','Open steps'],['in_progress','In progress'],['today','Due today'],['week','Due this week'],['nextweek','Due next week'],['waiting','Waiting on others'],['past','Past dates']];
 const myView=state.myWorkView||'list';
 return `<section class="hero"><div><span class="eyebrow">${scope==='team'?'TEAM WORK':'MY WORK'}</span><h1>${scope==='team'?'The team at a glance.':esc(first?`Hi ${first}. Here's what needs your attention.`:"Here's what needs your attention.")}</h1><p>${scope==='team'?'Open work across everyone.':'Your work, plus unassigned steps needing an owner.'} Each step appears once, in its highest-priority section.</p></div>${!isFreelancer(state.access)?`<div class="work-scope" aria-label="Work scope"><button data-work-scope="mine" aria-pressed="${scope==='mine'}">My work</button><button data-work-scope="team" aria-pressed="${scope==='team'}">Team work</button></div>`:''}</section>
 <div class="work-stats" aria-label="Filter work">${tiles.map(([key,name])=>`<button data-work-filter="${key}" aria-pressed="${state.workFilter===key}"><b>${overview.filters[key].length}</b> ${name}</button>`).join('')}</div><div class="my-work-controls"><p>${filtered.length} matching open steps${state.workFilter!=='all'?' · '+tiles.find(x=>x[0]===state.workFilter)?.[1]:''}. Unassigned work is included in these counts.</p><label><input type="checkbox" data-my-hide-done ${state.myHideDone?'checked':''}> Hide done</label></div>
 <div class="work-scope my-view-toggle" aria-label="My work view"><button data-my-view="list" aria-pressed="${myView!=='calendar'}">List</button><button data-my-view="calendar" aria-pressed="${myView==='calendar'}">Calendar</button></div>
 ${!d.aaron&&scope==='mine'?'<p class="access-note">Your login is not linked to a team member yet.</p>':''}
 ${myView==='calendar'?myWorkCalendar(d,filtered):state.workFilter==='week'?weekdayWorkList(filtered,d):`${pastDueSection(d,scope,overview.buckets.past)}${taskSection('today-attention','Needs attention',result.buckets.attention,d,{reasons:result.reasons,className:'needs-you',description:'Waiting, blocked, missing an owner, or due soon. Dates and reasons are shown on each card.'})}${textUpdateView(d)}
 <section class="focus-section">${[['today','Today'],['upcoming','Coming up'],['undated','No date set']].filter(([key])=>result.buckets[key].length).map(([key,name])=>taskSection('today-'+key,name,result.buckets[key],d)).join('')}</section>
 ${!state.myHideDone&&state.workFilter==='all'?`<details class="finished-work" ${state.finishedOpen?'open':''}><summary>Finished steps <span class="number">${selected.filter(i=>i.status==='done').length}</span></summary>${taskSection('today-finished','Finished steps',selected.filter(i=>i.status==='done'),d,{className:'completed-work'})}</details>`:''}`}`;
}
function workloadStep(i,d){return taskCard(i,d);}
function workloadGroups(items,d){
 const groups=[],byKey={};
 items.forEach(i=>{const p=d.pm[i.project_id];const path=p?displayProjectPath(p,d.pm):[{id:'',name:'Unknown project'}];const root=path[0],brand=p?brandClient(p,d.pm,d.cm):null,groupKey=brand?('client:'+(brand.id||brand.name)):('project:'+(root.id||root.name)),groupName=brand?.name||root.name||'Unknown project';
 // Project path listed before subproject/step names; drop a root that just repeats the client.
 const parts=path.map((part,n)=>n?workstreamLabel(part,d.pm):part.name);
 while(parts.length&&String(parts[0]||'').trim().toLowerCase()===String(groupName||'').trim().toLowerCase())parts.shift();
 const sub=parts.join(' › ');
 let g=byKey[groupKey];if(!g){g={project:{id:root.id,name:groupName},subs:[],bySub:{},count:0};byKey[groupKey]=g;groups.push(g);}
 let s=g.bySub[sub];if(!s){s={name:sub,items:[]};g.bySub[sub]=s;g.subs.push(s);}
 s.items.push(i);g.count++;});
 // Direct project steps (sub key '') always list before subproject groups.
 for(const g of groups)g.subs.sort((a,b)=>(a.name===''?0:1)-(b.name===''?0:1));
 return groups;
}
function workloadPeriod(){const anchor=state.calendarAnchor||today(),mode=state.calendarMode;return {anchor,mode,axis:ganttAxis(anchor,mode,{week:12,month:6,'2mo':4,quarter:3,year:2}[mode]||4)};}
function workloadToolbar(wm,anchor,mode,axis){
 return `<div class="calendar-all-toolbar workload-toolbar"><div class="calendar-view-modes" aria-label="Workload layout"><button data-workload-view="list" aria-pressed="${wm==='list'}">List</button><button data-workload-view="gantt" aria-pressed="${wm==='gantt'}">Gantt</button></div><div class="calendar-view-modes" aria-label="Time period">${GANTT_MODES.map(([m,t])=>`<button data-calendar-mode="${m}" aria-pressed="${mode===m}">${t}</button>`).join('')}</div><div><button data-calendar-move="-1" aria-label="Previous period">&#8249;</button><button data-calendar-today>Today</button><button data-calendar-move="1" aria-label="Next period">&#8250;</button></div><label>Jump to date<input type="date" id="calendar-date" value="${anchor}"></label></div><h2 class="calendar-period-title">${esc(ganttPeriodTitle(anchor,mode,axis))}</h2>`;
}
function workloadGantt(columns,d,axis,mode){
 const groups=[];
 for(const m of columns){
  const entries=calendarEntries([],m.items,i=>calendarSpan(i,officeHolidays),day=>isWorkDay(day,officeHolidays)).filter(r=>r.date);
  if(!entries.length)continue;
  const byP={};for(const r of entries)(byP[r.project_id] ||= []).push(r);
  const sections=Object.keys(byP).sort((x,y)=>(d.pm[x]?.name||'').localeCompare(d.pm[y]?.name||'')).map(pid=>({subhead:esc(d.pm[pid]?.name||'Unknown project'),rows:byP[pid].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title))}));
  const key='wl-'+m.id,collapsed=!!state.ganttCollapsed[key];
  groups.push({id:key,collapsed,sections,head:`<div class="gantt-group-head"><div class="gantt-group-head-inner"><button class="gantt-chevron" data-gantt-toggle="${esc(key)}" aria-expanded="${!collapsed}" aria-label="${collapsed?'Expand':'Collapse'} ${esc(m.name)}">${collapsed?'▸':'▾'}</button><h4>${esc(m.name)}</h4><span class="gantt-count">${entries.filter(r=>r.item_id).length} steps</span></div></div>`});
 }
 const lh=ganttHelpers(d,mode,null,axis);lh.scope='live';lh.scheduleKey='workload';
 const chart=ganttChart(axis,groups,lh);
 return `${chart.html}${groups.length?'':'<p class="empty">No dated steps for anyone in this period.</p>'}`;
}
function workloadTeamControls(){
 const teams=[...new Set([...workloadTeams(state.data.members),...(state.customTeams||[])])].sort(),selected=state.workloadTeamFilter;
 return `<div class="workload-team-controls"><details class="team-filter-popup" ${state.teamFilterOpen?'open':''}><summary>Filter teams (${selected.length})</summary><div class="team-filter-menu">${teams.map(t=>`<label><input type="checkbox" data-team-filter="${esc(t)}" ${selected.includes(t)?'checked':''}> ${esc(t)}</label>`).join('')}<button data-team-reset>Reset</button><p>Reset shows Production and Freelancers only.</p></div></details><details class="team-manager" ${state.teamManagerOpen?'open':''}><summary>Assign people to teams</summary><p>These groups organize Workload only. They do not change sign-in access or work assignments. No team set means membership is unknown.</p>${state.data.members.map(m=>`<label class="member-team-row">${esc(m.name)}<select data-member-team="${esc(m.id)}" ${state.teamBusy[m.id]?'disabled':''}>${opt('',m.workload_team||'',m.workload_team?'Use recorded role/type default':memberTeam(m)+' (from role/type)')}${teams.filter(t=>t!=='No team set').map(t=>opt(t,m.workload_team,t)).join('')}</select><span role="status" data-team-feedback="${esc(m.id)}">${esc(state.teamFeedback[m.id]||'')}</span></label>`).join('')}<form id="new-workload-team"><label>New team name<input name="team" maxlength="60" required></label><button>Add team to options</button></form></details></div>`;
}
function workloadView(d){
 const wm=state.workloadView==='gantt'?'gantt':'list',{anchor,mode,axis}=workloadPeriod();
 const columns=workloadColumns(state.data.members.filter(m=>state.workloadTeamFilter.includes(memberTeam(m))),state.data.sched,d.pm),open=state.data.sched.filter(i=>i.status!=='done'&&!projectIsDone(d.pm[i.project_id],d.pm));
 const unassigned=open.filter(i=>!i.owner_id||!d.mm[i.owner_id]);
 const inPeriod=new Set(calendarEntries([],columns.flatMap(m=>m.items),i=>calendarSpan(i,officeHolidays),day=>isWorkDay(day,officeHolidays)).filter(r=>r.date&&r.item_id&&r.date<=axis.anchorEnd&&(r.last_date||r.date)>=axis.anchorStart).map(r=>r.item_id));
 columns.forEach(m=>{m.shown=m.items.filter(i=>inPeriod.has(i.id)||!dateKey(i.due_date));});
 if(wm==='gantt')return `<div class="page-title"><h1>Team workload</h1><p>Each person's open dated steps, grouped by client. Bars run from start to due date across weekdays. Steps with no date are not drawn; switch to List to see them.</p></div>${workloadTeamControls()}${workloadToolbar(wm,anchor,mode,axis)}<div class="gantt-controls"><button data-gantt-expand-all>Expand all</button><button data-gantt-collapse-all>Collapse all</button></div>${workloadGantt(columns,d,axis,mode)}`;
 return `<div class="page-title"><h1>Team workload</h1><p>Open assigned steps under each person.</p>${!state.dependencyAvailable?'<p class="dependency-note">Upstream risk checks are unavailable until explicit dependency records are connected. No links are inferred from timeline order.</p>':''}</div>${workloadTeamControls()}${workloadToolbar(wm,anchor,mode,axis)}<div class="workload-header-strip"><button data-show-unassigned class="unassigned-count">Unassigned: ${unassigned.length}</button><span>Weekly load: 0 = capacity · 1-6 = steady · 7+ = heavy. Counts, not hour estimates.</span></div><div class="project-expand-controls workload-expand-controls"><button data-expand-workload="true">Expand all</button><button data-expand-workload="false">Collapse all</button></div><p class="workload-table-hint" id="workload-table-hint">Click a step to expand it. People run down the left; scroll down to see more.</p><div class="workload-table-scroll" tabindex="0" role="region" aria-label="Workload by person" aria-describedby="workload-table-hint"><table class="workload-table"><caption class="sr-only">Open steps by assigned team member</caption><tbody>${columns.map(m=>{const c=workloadCounts(m.items,d.pm,projectIsDone,today());return `<tr><th scope="row" data-workload-owner="${esc(m.id)}"><strong>${esc(m.name)}</strong><small>${c.open} open · ${c.inProgress} in progress</small><span class="load-count load-${workloadSignal(weeklyCounts(m.items,d.pm,today()).week)}">${weeklyCounts(m.items,d.pm,today()).week} due this week · ${workloadSignal(weeklyCounts(m.items,d.pm,today()).week)==='available'?'Capacity':workloadSignal(weeklyCounts(m.items,d.pm,today()).week)==='heavy'?'Heavy':'Steady'}</span><small>${c.past} past dates</small></th><td data-workload-column="${esc(m.id)}"><div class="workload-column-steps">${m.shown.length?workloadGroups(m.shown,d).map(g=>`<details class="workload-project-group" open><summary><span class="workload-project-name">${esc(g.project.name)}</span><span class="number">${g.count}</span></summary>${g.subs.map(s=>`${s.name?`<h5 class="workload-sub-heading">${esc(s.name)}</h5>`:''}<div class="workload-group-steps">${s.items.map(i=>workloadStep(i,d)).join('')}</div>`).join('')}</details>`).join(''):`<p class="workload-column-empty">${m.items.length?'No steps in this period':'No open assigned steps'}</p>`}</div></td></tr>`;}).join('')}</tbody></table>${!columns.length?'<p class="empty">No visible team members.</p>':''}</div>${unassigned.length?`<details class="workload-unassigned"><summary>Unassigned steps (${unassigned.length})</summary><p class="muted">These steps are not assigned to a current team member.</p><div class="task-grid">${unassigned.map(i=>taskCard(i,d)).join('')}</div></details>`:''}`;
}

function filtered(d){return flattenedListings(d.pm).filter(p=>{const cid=effectiveClientId(p,d.pm);return (state.status==='all'||state.status==='open'&&p.status!=='done'||state.status===p.status)&&(state.member==='all'||p.owner_id===state.member||(d.sch[p.id]||[]).some(i=>i.owner_id===state.member))&&(state.client==='all'||cid===state.client)&&[p.name,p.description,d.cm[cid]?.name,...(d.upd[p.id]||[]).map(u=>u.note)].join(' ').toLowerCase().includes(state.search.toLowerCase());});}
const opt=(v,cur,t)=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(t)}</option>`;
function filters(schedule=false){return `<div class="filters"><label class="search-label">Search<input id="search" type="search" placeholder="Find a workstream, client or update" value="${esc(state.search)}"></label><label>Team member<select id="member">${opt('all',state.member,'Everyone')}${state.data.members.map(m=>opt(m.id,state.member,m.name)).join('')}</select></label><label>Client<select id="client">${opt('all',state.client,'All clients')}${state.data.clients.map(c=>opt(c.id,state.client,c.name)).join('')}</select></label><label>Status<select id="status">${opt('open',state.status,schedule?'Active projects + finished steps':'Open')}${opt('all',state.status,'Including done')}${(schedule?['pending','in_progress','waiting','blocked','done']:['active','waiting','blocked','not_started','done']).map(s=>opt(s,state.status,label(s))).join('')}</select></label></div>`;}
function nowNext(p,d){
 const steps=timelineSteps(p,state.data.sched,d.pm);
 if(!steps.length)return '';
 const cur=steps.find(i=>i.status==='in_progress');
 const next=steps.find(i=>i!==cur&&i.status!=='done');
 const owner=i=>ownerNames(i,d.mm,'Unassigned');
 const parts=[];
 if(cur)parts.push(`Now: ${esc(cur.title)} (${inlineOwner(cur,d)}, ${esc(cur.due_date?fmtDate(cur.due_date):'TBD')})`);
 if(next)parts.push(`Next: ${esc(next.title)}${next.due_date?' ('+esc(fmtDate(next.due_date))+')':''}`);
 const noDates=steps.every(i=>!i.due_date);
 if(!parts.length&&!noDates)return '';
 return `<span class="listing-nownext">${parts.join(' · ')}${noDates?'<span class="no-dates-flag" title="No step on this client has a due date">No dates</span>':''}</span>`;
}
function projectListing(p,d){
 return `<div class="project-question-wrap"><details class="project-listing" data-project-listing="${esc(p.id)}" ${state.expandedProjects[p.id]?'open':''}><summary>${projectSelectControl(p)}<span class="hierarchy-label project-level-label">PROJECT</span><span class="listing-name">${esc(p.name)}</span>${timeline(p,d)}<span class="pill ${esc(p.status)}">${esc(label(p.status))}</span>${nowNext(p,d)}${sourceControls(p,null,d,true)}<span class="listing-chevron" aria-hidden="true">▸</span></summary>${state.expandedProjects[p.id]?`<div class="listing-content">${latest(p,d)}<div class="listing-actions">${sourceControls(p,null,d)}<button class="text-button" data-open="${esc(p.id)}">Details & links →</button>${commentButton(p)}</div>${quickInput(p)}${projectSchedule(p,d,false)}</div>`:''}</details>${questionsArea(p,null)}</div>`;
}
function projectsView(d){const list=visibleCards(filtered(d),state.hideDone),groups={};list.forEach(p=>{const cid=effectiveClientId(p,d.pm)||'';(groups[cid]=groups[cid]||[]).push(p);});return `<div class="page-title"><h1>All clients</h1><p>Find the work, latest context and every client link.</p></div>${filters()}${combineBar()}<div class="project-expand-controls"><button data-expand-projects="true">Expand all</button><button data-expand-projects="false">Collapse all</button><label class="hide-done-control"><input type="checkbox" id="hide-done" ${state.hideDone?'checked':''}> Hide done</label></div><p class="results">${list.length} projects shown</p>${list.length?Object.keys(groups).sort((a,b)=>{const an=d.cm[a]?.name||'',bn=d.cm[b]?.name||'';if(!an&&bn)return 1;if(an&&!bn)return -1;return an.localeCompare(bn);}).map(c=>`<section><div class="section-heading"><h2>${esc(d.cm[c]?.name||'No client')} <span class="number">${groups[c].length}</span></h2></div><div class="project-listings">${groups[c].map(p=>projectListing(p,d)).join('')}</div></section>`).join(''):'<p class="empty">Nothing matches. Try another filter.</p>'}`;}
function ganttHelpers(d,mode,pagePid=null,axis=null){
 return {esc,mode,todayKey:today(),rowOwner:r=>{const i=state.data.sched.find(i=>i.id===r.item_id);return i?inlineOwner(i,d):'';},
 chip:r=>{
  if(r.kind==='meeting')return 'MEETING'+(r.starts_at?' · '+mountainTime(r.starts_at).replace(/ (MDT|MST)$/,''):'');
  if(r.status==='done')return 'DONE';
  const end=r.last_date||r.date,days=Math.round((Date.parse(end)-Date.parse(today()))/864e5);
  return label(r.status).toUpperCase()+(days<0?' · PAST DUE':' · '+days+'D');
 },
 barClass:r=>`${r.kind?'event-'+r.kind:''} ${r.status==='done'?'event-done':r.status==='in_progress'?'event-current':''} ${r.status==='blocked'?'gantt-blocked':''}${isCanceledTitle(r.title)?' is-canceled':''}`,
 barTitle:r=>`${r.title} · ${d.mm[r.owner_id]?.name||'Unassigned'} · ${fmtDate(r.date)}${r.last_date&&r.last_date!==r.date?' - '+fmtDate(r.last_date):''} · ${label(r.status)}`,
 rowMeta:r=>{const end=r.last_date||r.date,outBefore=axis&&end<axis.anchorStart,outAfter=axis&&r.date>axis.anchorEnd;return `${outBefore?'◂ ':''}${pagePid&&r.project_id!==pagePid?(d.pm[r.project_id]?.name||'Subproject')+' · ':''}${fmtDate(r.date)}${r.last_date&&r.last_date!==r.date?' - '+fmtDate(r.last_date):''}${outAfter?' ▸':''}`;}};
}
function shiftGanttAnchor(anchor,mode,n){
 if(mode==='week')return addDays(anchor,n*7);
 if(mode==='month')return shiftMonth(anchor.slice(0,7),n)+'-01';
 if(mode==='2mo')return shiftMonth(anchor.slice(0,7),n*2)+'-01';
 if(mode==='quarter')return shiftMonth(anchor.slice(0,7),n*3)+'-01';
 return String(Number(anchor.slice(0,4))+n)+anchor.slice(4);
}
const GANTT_MODES=[['week','Week'],['month','Month'],['2mo','2 Months'],['quarter','Quarter'],['year','Year']];
function ganttPeriodTitle(anchor,mode,axis){
 if(mode==='month')return new Date(anchor.slice(0,7)+'-01T12:00:00Z').toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
 if(mode==='2mo'){const f=twoMonthStart(anchor),s=shiftMonth(f,1),name=(ym,year)=>new Date(ym+'-01T12:00:00Z').toLocaleDateString('en-US',year?{month:'long',year:'numeric',timeZone:'UTC'}:{month:'long',timeZone:'UTC'});return name(f,f.slice(0,4)!==s.slice(0,4))+' - '+name(s,true);}
 if(mode==='quarter')return 'Q'+(Math.floor((Number(anchor.slice(5,7))-1)/3)+1)+' '+anchor.slice(0,4);
 if(mode==='year')return anchor.slice(0,4);
 return 'Week of '+fmtDate(axis.anchorStart)+' - '+fmtDate(axis.anchorEnd);
}
function scheduleView(d){
 const anchor=state.calendarAnchor||today(),mode=state.calendarMode;
 const axis=ganttAxis(anchor,mode,{week:12,month:6,'2mo':4,quarter:3,year:2}[mode]||4);
 const entries=calendarEntries(state.data.projects,state.data.sched,i=>calendarSpan(i,officeHolidays),day=>isWorkDay(day,officeHolidays)).filter(r=>(state.calendarOwner==='all'||(r.owner_id||'unassigned')===state.calendarOwner)&&(state.calendarProject==='all'||r.project_id===state.calendarProject));
 const dated=entries.filter(r=>r.date),undated=entries.filter(r=>!r.date);
 const hideDone=state.ganttHideDone,visible=r=>!hideDone||(r.status!=='done'&&!isCanceledTitle(r.title)&&(r.last_date||r.date)>=axis.anchorStart);
 const byProject={};for(const r of dated)(byProject[r.project_id] ||= []).push(r);
 const sortRows=rows=>rows.sort((a,b)=>((a.item_id?1:0)-(b.item_id?1:0))||a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
 const subsOf={};for(const p of state.data.projects)if(p.parent_id&&d.pm[p.parent_id])(subsOf[p.parent_id] ||= []).push(p);
 const groups=[];
 for(const p of state.data.projects){
  if(p.parent_id&&d.pm[p.parent_id])continue;
  const sections=[];
  const own=sortRows((byProject[p.id]||[]).filter(visible));
  if(own.length)sections.push({rows:own});
  for(const s of subsOf[p.id]||[]){const rows=sortRows((byProject[s.id]||[]).filter(visible));if(rows.length)sections.push({subhead:esc(s.name),rows});}
  if(!sections.length)continue;
  const all=sections.flatMap(s=>s.rows),steps=all.filter(r=>r.item_id),open=steps.filter(r=>r.status!=='done').length,collapsed=!!state.ganttCollapsed[p.id];
  groups.push({id:p.id,collapsed,sections,head:`<div class="gantt-group-head"><div class="gantt-group-head-inner"><button class="gantt-chevron" data-gantt-toggle="${esc(p.id)}" aria-expanded="${!collapsed}" aria-label="${collapsed?'Expand':'Collapse'} ${esc(p.name)}">${collapsed?'▸':'▾'}</button><h4><button class="title-button" data-open="${esc(p.id)}">${esc(p.name)}</button></h4><span class="gantt-count">${open} open / ${steps.length} steps</span></div></div>`});
 }
 const lh=ganttHelpers(d,mode,null,axis);lh.scope='live';
 const chart=ganttChart(axis,groups,lh);
 const undatedEvent=r=>`<div class="calendar-undated-row"><button data-open="${esc(r.project_id)}" ${r.item_id?`data-target-item="${esc(r.item_id)}"`:''} class="calendar-all-event ${r.kind?'event-'+r.kind:''} ${r.status==='done'?'event-done':''}${isCanceledTitle(r.title)?' is-canceled':''}"><span class="calendar-workstream">${esc(d.pm[r.project_id]?.name||'Client')}</span><strong>${esc(r.title||r.label)}</strong></button>${r.item_id&&state.data.sched.find(i=>i.id===r.item_id)?inlineOwner(state.data.sched.find(i=>i.id===r.item_id),d):`<small>${esc(d.mm[r.owner_id]?.name||'Unassigned')}</small>`}</div>`;
 return `<div class="page-title"><h1>Live calendar</h1><p>Dashboard dates and client-related meetings recorded by the feed. Verified times are shown in Mountain (MST / MDT); date-only rows stay untimed.</p></div><div class="calendar-live-status" role="status">${esc(state.liveState)} · Last loaded ${esc(state.loaded.toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit'}))} MT${state.livePending?' · New data available; finish your draft or close details, then refresh.':''}</div><div class="calendar-all-toolbar"><div class="calendar-view-modes" aria-label="Calendar view">${GANTT_MODES.map(([m,t])=>`<button data-calendar-mode="${m}" aria-pressed="${mode===m}">${t}</button>`).join('')}</div><div><button data-calendar-move="-1" aria-label="Previous period">&#8249;</button><button data-calendar-today>Today</button><button data-calendar-move="1" aria-label="Next period">&#8250;</button></div><label>Jump to date<input type="date" id="calendar-date" value="${anchor}"></label></div><div class="calendar-all-filters"><label>Owner<select id="calendar-owner">${opt('all',state.calendarOwner,'Everyone')}${state.data.members.map(m=>opt(m.id,state.calendarOwner,m.name)).join('')}${opt('unassigned',state.calendarOwner,'Unassigned')}</select></label><label>Client / subproject<select id="calendar-project">${opt('all',state.calendarProject,'All clients')}${state.data.projects.map(p=>opt(p.id,state.calendarProject,p.name)).join('')}</select></label></div><div class="gantt-controls"><button data-gantt-expand-all>Expand all</button><button data-gantt-collapse-all>Collapse all</button><label class="hide-done-control"><input type="checkbox" id="gantt-hide-done" ${hideDone?'checked':''}> Hide done, canceled & past</label></div><h2 class="calendar-period-title">${esc(ganttPeriodTitle(anchor,mode,axis))}</h2><p class="calendar-scope-note">Gantt view: one row per step or client deadline, grouped by client. Bars run from recorded start to due date across weekdays, skipping weekends and Monigle office holidays; arrows mark bars continuing past the visible range. The green line is today. Finished items stay grey. Click a bar for its card. Scroll the chart sideways to move through time; Today returns to today.</p>${chart.html}${chart.weekendHidden?`<p class="calendar-hint">${chart.weekendHidden} weekend-dated item(s) are hidden in this chart, not deleted or moved. Use Clients / List to view their original dates.</p>`:''}<details class="calendar-undated"><summary>No date set (${undated.length})</summary><div class="calendar-undated-items">${undated.map(undatedEvent).join('')||'<p>No undated steps match.</p>'}</div></details>`;
}
function safeLink(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function detail(p,d){const us=d.upd[p.id]||[],ls=d.lnk[p.id]||[],ss=d.sch[p.id]||[],subs=visibleCards(d.subs[p.id]||[],state.view==='projects'&&state.hideDone);
 return `${bulkToolbar()}<div data-revision-project="${esc(p.id)}" class="revision-detail-heading"><div class="dialog-head"><span class="eyebrow">${esc(d.cm[p.client_id]?.name||'CLIENT')}</span>${p.status!=='done'&&!isFreelancer(state.access)?`<button class="primary complete-button" data-complete="${esc(p.id)}">✓ Complete project</button>`:''}<button class="close" data-close aria-label="Close project details">×</button></div><h2 id="dialog-title">${esc(p.name)}</h2></div><div class="detail-meta"><span class="pill ${esc(p.status)}">${esc(label(p.status))}</span><span>Lead: ${projectOwnerControl(p,d)}</span>${isFreelancer(state.access)?`<span>CX: ${esc(projectCx(p,d.pm).join(', ')||'Not set')}</span>`:`<label class="cx-edit">CX <input data-project-cx="${esc(p.id)}" value="${esc(projectCx(p,d.pm).join(', '))}" placeholder="Names, comma separated" ${p.cx?.length?'':''}><span role="status"></span></label>`}${commentButton(p)}</div><p id="complete-status" role="status" aria-live="polite"></p>${p.description?`<details class="background"><summary>Project background</summary><p>${esc(p.description)}</p><small>Background may predate the latest updates below.</small></details>`:''}
 ${questionsArea(p,null)}<h3 class="detail-heading">Latest update</h3>${latest(p,d,true)}<h3 class="detail-heading">Files & links <span class="number">${ls.length+subs.reduce((n,s)=>n+(d.lnk[s.id]||[]).length,0)}</span></h3>${[...ls,...subs.flatMap(s=>d.lnk[s.id]||[])].map(l=>{const href=safeLink(l.url);return href?`<a class="file-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} <span>↗</span></a>`:`<div class="file-link disabled">${esc(l.label)}<small>URL not recorded</small></div>`;}).join('')||'<p class="muted">No links recorded yet. Comment to add one.</p>'}
 ${projectSchedule(p,d,true)}${commentHistory(p)}
 <details class="history"><summary>Earlier updates (${Math.max(0,us.length-1)})</summary>${us.slice(1).map(u=>`<article><small>${esc(stamp(u.created_at))} MT</small><p>${esc(u.note)}</p>${originalSourceControls(u)}</article>`).join('')||'<p class="muted">No earlier updates.</p>'}</details>`;
}
let lastFocus, dayFocus;
function openDetail(id,itemId,preserveMode=false){state.focusedTask=itemId||null;if(itemId&&!preserveMode)state.scheduleModes['page-'+id]='list';const d=derive(),p=d.pm[id];if(!p)return;lastFocus=document.activeElement;state.open=id;const dialog=document.querySelector('#detail');dialog.innerHTML=detail(p,d);bind(dialog);applyTimingWarnings();if(!dialog.open)dialog.showModal();dialog.querySelector('[data-close]').focus();if(itemId)requestAnimationFrame(()=>{const finished=[...dialog.querySelectorAll('[data-finished-task]')].find(c=>c.dataset.finishedTask===itemId);if(finished){finished.open=true;populateFinishedCard(finished);}const card=[...dialog.querySelectorAll('[data-task-card]')].find(c=>c.dataset.taskCard===itemId);if(card){card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'instant'});}});}
async function openComment(pid,iid,brand=''){
 const d=derive(),p=d.pm[pid],i=state.data.sched.find(x=>x.id===iid);if(!p)return;
 lastFocus=document.activeElement;
 const dialog=document.querySelector('#comment-dialog');
 dialog.dataset.commentProject=pid;dialog.dataset.commentItem=iid||'';
 dialog.innerHTML=`<div class="dialog-head"><span class="eyebrow">MESSAGE TO INSTINCT</span><button class="close" data-close aria-label="Close comment">×</button></div><h2 id="comment-title">What should I know?</h2><p class="comment-context">${brand?esc('Whole brand: '+brand+' (filed under '+p.name+')'):esc(joinedNames(d.cm[p.client_id]?.name||'Production',p.name,i?.title))}</p><form id="comment-form"><label for="comment-name">Your name</label><input id="comment-name" name="name" required maxlength="120" autocomplete="name" value="${esc(session.user.user_metadata?.display_name||'')}"><label for="comment-note">Your message</label><textarea id="comment-note" name="note" required maxlength="5000" rows="5" placeholder="Share an update, correction or question"></textarea><p class="muted">Saved with your signed-in email and the client context. Instinct checks new messages every few minutes. A message does not change the client automatically.</p><button class="primary" type="submit">Send to Instinct</button><p id="comment-status" role="status" aria-live="polite"></p></form>`;
 bind(dialog);dialog.showModal();dialog.querySelector('#comment-name').focus();
 dialog.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const name=dialog.querySelector('#comment-name').value.trim(),note=dialog.querySelector('#comment-note').value.trim();
  if(!name||!note)return;const tag=brand?`[Whole brand: ${brand}] `:'';const button=dialog.querySelector('[type="submit"]'),status=dialog.querySelector('#comment-status');button.disabled=true;status.textContent='Saving your message...';
  const uid=session?.user?.id;const result=await queueComment({project_id:p.id,schedule_item_id:i?.id||null,author_name:name,note:tag+note},joinedNames(p.name,i?.title));if(session?.user?.id!==uid)return;const data=result?.receipt,error=!data;
  if(error){status.textContent=result?.durable?'Not sent yet. Saved on this device in the retry area; retries on reconnect.':'Not sent yet. Keep this page open: device storage is unavailable.';button.disabled=false;return;}
  status.textContent=`Saved at ${stamp(data.created_at)} MT. Instinct will review it on the next check.`;button.textContent='Message saved';dialog.querySelector('#comment-note').readOnly=true;dialog.querySelector('#comment-name').readOnly=true;
 };
}
function growTextField(field){
 if(!field?.isConnected||!field.getClientRects().length)return;
 field.style.height='auto';
 const style=getComputedStyle(field),border=parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
 field.style.height=Math.ceil(Math.max(parseFloat(style.minHeight)||0,field.scrollHeight+border))+'px';
}
function growVisibleTextFields(){document.querySelectorAll('textarea').forEach(growTextField);}
document.addEventListener('input',e=>{if(e.target.matches('textarea')){growTextField(e.target);requestAnimationFrame(growVisibleTextFields);}},true);
document.addEventListener('toggle',()=>requestAnimationFrame(growVisibleTextFields),true);
window.addEventListener('resize',()=>requestAnimationFrame(growVisibleTextFields));
function hideStepPreview(){document.querySelectorAll('.timeline-step-preview').forEach(el=>el.remove());}
function showStepPreview(button){
 hideStepPreview();const preview=document.createElement('div');preview.className='timeline-step-preview';preview.textContent=button.dataset.stepName+(button.dataset.stepDate?' · '+button.dataset.stepDate:'');preview.setAttribute('role','tooltip');
 (button.closest('dialog[open]')||document.body).append(preview);
 const box=button.getBoundingClientRect(),size=preview.getBoundingClientRect();
 preview.style.left=Math.max(8,Math.min(innerWidth-size.width-8,box.left+box.width/2-size.width/2))+'px';
 preview.style.top=(box.top>size.height+12?box.top-size.height-8:Math.min(innerHeight-size.height-8,box.bottom+8))+'px';
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideStepPreview();});
window.addEventListener('scroll',hideStepPreview,true);window.addEventListener('resize',hideStepPreview);
function bind(root){
 root.querySelectorAll('[data-project-owner]').forEach(el=>{el.onclick=e=>e.stopPropagation();el.onchange=async()=>{const p=state.data.projects.find(x=>x.id===el.dataset.projectOwner),old=p.owner_id,next=el.value,fb=el.parentElement.querySelector('[role=status]');el.disabled=true;fb.textContent='Saving...';try{await saveProjectOwner(supabase,p,next);p.owner_id=next||null;render();if(state.open)refreshDetail();}catch{el.value=old||'';el.disabled=false;fb.textContent='Not saved. Try again.';}};});
 root.querySelector('.team-manager')?.addEventListener('toggle',e=>state.teamManagerOpen=e.target.open);
 root.querySelector('.team-filter-popup')?.addEventListener('toggle',e=>state.teamFilterOpen=e.target.open);
 root.querySelectorAll('[data-team-filter]').forEach(el=>el.onchange=()=>{state.workloadTeamFilter=[...root.querySelectorAll('[data-team-filter]:checked')].map(x=>x.dataset.teamFilter);render();});
 root.querySelector('[data-team-reset]')?.addEventListener('click',()=>{state.workloadTeamFilter=[...defaultWorkloadTeams];render();});
 root.querySelector('#new-workload-team')?.addEventListener('submit',e=>{e.preventDefault();const name=new FormData(e.target).get('team').trim();if(name){state.customTeams=[...new Set([...(state.customTeams||[]),name])];render();}});
 root.querySelectorAll('[data-member-team]').forEach(el=>el.onchange=async()=>{const m=state.data.members.find(x=>x.id===el.dataset.memberTeam),old=m.workload_team||'',next=el.value,fb=el.parentElement.querySelector('[role=status]');state.teamBusy[m.id]=true;el.disabled=true;fb.textContent='Saving...';try{const r=await saveMemberTeam(supabase,m,next);m.workload_team=r.workload_team;state.teamFeedback[m.id]='Saved.';delete state.teamBusy[m.id];render();}catch{el.value=old;fb.textContent='Not saved. Try again.';el.disabled=false;}finally{delete state.teamBusy[m.id];}});

 root.querySelectorAll('[data-workload-step]').forEach(el=>el.addEventListener('toggle',()=>{state.workloadExpanded[el.dataset.workloadStep]=el.open;}));
 root.querySelectorAll('[data-step-row]').forEach(el=>el.ontoggle=()=>{state.stepRowOpen[el.dataset.stepRow]=el.open;});
 root.querySelectorAll('[data-finished-lazy]').forEach(el=>el.addEventListener('toggle',()=>{if(el.open)populateFinishedCard(el);}));
 root.querySelectorAll('[data-step-row]>summary,.workload-step>summary,.finished-task>summary,.project-listing>summary').forEach(s=>{
  // Record the pre-click checkbox state on mousedown: browsers pre-toggle the checkbox before
  // the click handler runs and revert on preventDefault, so the click handler cannot infer intent.
  // Selects inside expandable summaries: input clicks toggle natively (their own listener
  // stops propagation so the details never opens); label-text clicks are handled manually
  // here. Never preventDefault an input's own click - the browser reverts the toggle.
  s.addEventListener('click',e=>{if(e.target.closest('.inline-owner')){e.preventDefault();return;}const sel=e.target.closest('.step-select');if(!sel||!s.contains(sel))return;const inp=sel.querySelector('input');if(!inp||e.target===inp)return;
  e.preventDefault();inp.checked=!inp.checked;inp.dispatchEvent(new Event('change',{bubbles:true}));});
 });
 root.querySelectorAll('.step-select input').forEach(inp=>inp.addEventListener('click',e=>e.stopPropagation()));
 root.querySelectorAll('[data-expand-workload]').forEach(b=>b.onclick=()=>{const expanded=b.dataset.expandWorkload==='true';root.querySelectorAll('.workload-table [data-step-row],.workload-unassigned [data-step-row]').forEach(el=>{state.stepRowOpen[el.dataset.stepRow]=expanded;el.open=expanded;});});
 root.querySelector('#hide-done')?.addEventListener('change',e=>{state.hideDone=e.target.checked;render();document.querySelector('#hide-done')?.focus();});
 updateRevisionUI();
 hideStepPreview();
 root.querySelectorAll('[data-timeline-step]').forEach(button=>{
  button.onmouseenter=()=>showStepPreview(button);button.onmouseleave=hideStepPreview;
  button.onfocus=()=>showStepPreview(button);button.onblur=hideStepPreview;
  button.onclick=e=>{e.preventDefault();e.stopPropagation();hideStepPreview();button.closest('#day-dialog')?.close();openDetail(button.dataset.timelineProject,button.dataset.timelineStep);};
 });
 requestAnimationFrame(growVisibleTextFields);
 bindOutbox(root);
 root.querySelectorAll('[data-calendar-mode]').forEach(b=>b.onclick=()=>{state.calendarMode=b.dataset.calendarMode;state.calendarScrollTo='anchor';render();});
 root.querySelectorAll('[data-calendar-move]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.calendarMove),anchor=state.calendarAnchor||today();state.calendarAnchor=shiftGanttAnchor(anchor,state.calendarMode,n);state.calendarScrollTo='anchor';render();});
 root.querySelectorAll('[data-gantt-mode]').forEach(b=>b.onclick=()=>{const key=b.dataset.scheduleKey,r=state.ganttRanges[key]||(state.ganttRanges[key]={mode:'week',anchor:today(),scrollTo:'anchor'});r.mode=b.dataset.ganttMode;r.scrollTo='anchor';if(b.closest('dialog'))refreshDetail();else render();});
 root.querySelectorAll('[data-gantt-move]').forEach(b=>b.onclick=()=>{const key=b.dataset.scheduleKey,r=state.ganttRanges[key]||(state.ganttRanges[key]={mode:'week',anchor:today(),scrollTo:'anchor'});r.anchor=shiftGanttAnchor(r.anchor,r.mode,Number(b.dataset.ganttMove));r.scrollTo='anchor';if(b.closest('dialog'))refreshDetail();else render();});
 root.querySelectorAll('[data-gantt-today]').forEach(b=>b.onclick=()=>{const key=b.dataset.scheduleKey,r=state.ganttRanges[key]||(state.ganttRanges[key]={mode:'week',anchor:today(),scrollTo:'anchor'});r.anchor=today();r.scrollTo='anchor';if(b.closest('dialog'))refreshDetail();else render();});
 root.querySelectorAll('[data-my-view]').forEach(b=>b.onclick=()=>{state.myWorkView=b.dataset.myView;render();});
 root.querySelectorAll('[data-gantt-toggle]').forEach(b=>b.onclick=()=>{const id=b.dataset.ganttToggle;state.ganttCollapsed[id]=!state.ganttCollapsed[id];render();});
 root.querySelectorAll('[data-gantt-expand-all]').forEach(b=>b.onclick=()=>{state.ganttCollapsed={};render();});
 root.querySelectorAll('[data-gantt-collapse-all]').forEach(b=>b.onclick=()=>{for(const p of state.data.projects)if(!p.parent_id)state.ganttCollapsed[p.id]=true;for(const m of state.data.members)state.ganttCollapsed['wl-'+m.id]=true;render();});
 root.querySelector('#gantt-hide-done')?.addEventListener('change',e=>{state.ganttHideDone=e.target.checked;render();});
 root.querySelectorAll('[data-gantt-scroll]').forEach(el=>{
  const scope=el.dataset.scope,key=el.dataset.scheduleKey;
  const st=scope==='live'?state:(state.ganttRanges[key]||(state.ganttRanges[key]={mode:'week',anchor:today(),scrollTo:'today'}));
  const prop=scope==='live'?'calendarScrollTo':'scrollTo';
  const centerToday=()=>{const f=parseFloat(el.dataset.todayFrac||el.dataset.anchorFrac||'0');el.scrollLeft=Math.max(0,el.scrollWidth*f-el.clientWidth/2);};
  const target=st[prop]===undefined?'today':st[prop];
  if(target!=null){
   if(target==='anchor')el.scrollLeft=el.scrollWidth*parseFloat(el.dataset.anchorFrac);
   else if(target==='today')centerToday();
   else el.scrollLeft=Math.max(0,target);
   st[prop]=null;
  }
  else if(st.lastScroll!=null)el.scrollLeft=Math.min(st.lastScroll,Math.max(0,el.scrollWidth-el.clientWidth));
  else centerToday();
  el.dataset.setPos=el.scrollLeft;
  el.addEventListener('scroll',()=>{
   if(el.scrollWidth<=el.clientWidth+40)return;
   if(Math.abs(el.scrollLeft-parseFloat(el.dataset.setPos||'0'))<4)return;
   st.lastScroll=el.scrollLeft;el.dataset.setPos=String(el.scrollLeft);
  });
 });

 root.querySelector('[data-calendar-today]')?.addEventListener('click',()=>{state.calendarAnchor=today();state.calendarScrollTo='today';render();});
 for(const [id,key] of [['calendar-owner','calendarOwner'],['calendar-project','calendarProject'],['calendar-date','calendarAnchor']])root.querySelector('#'+id)?.addEventListener('change',e=>{if(e.target.value){state[key]=e.target.value;if(key==='calendarAnchor')state.calendarScrollTo='anchor';render();}});
 root.querySelector('.dashboard-legend')?.addEventListener('toggle',e=>{state.legendOpen=e.target.open;});
 root.querySelectorAll('[data-question-answer]').forEach(form=>{const id=form.dataset.questionAnswer,field=form.querySelector('textarea'),feedback=form.querySelector('[role="status"]'),button=form.querySelector('button');field.oninput=()=>{state.questionDrafts[id]=field.value;document.querySelectorAll(`[data-question-answer="${id}"] textarea`).forEach(copy=>{if(copy!==field){copy.value=field.value;growTextField(copy);}});};form.onsubmit=async e=>{e.preventDefault();const text=field.value.trim(),uid=session?.user?.id;if(!text||state.questionBusy[id]||state.data.questions.find(q=>q.id===id)?.status!=='open')return;state.questionBusy[id]=true;button.disabled=true;feedback.textContent='Saving answer...';try{const {data,error}=await supabase.rpc('answer_dashboard_question',{target_question_id:id,answer_text:text});if(session?.user?.id!==uid)return;if(error||!data?.question?.answer_comment_id)throw Error('Answer not saved');state.revisions=[...state.revisions.filter(r=>r.id!==data.question.answer_comment_id),{id:data.question.answer_comment_id,project_id:data.question.project_id||state.data.questions.find(q=>q.id===id)?.project_id,schedule_item_id:data.question.schedule_item_id||state.data.questions.find(q=>q.id===id)?.schedule_item_id,note:text,created_at:new Date().toISOString(),reviewed_at:null}];updateRevisionUI();refreshRevisions();state.data.questions=state.data.questions.map(q=>q.id===id?data.question:q);delete state.questionDrafts[id];field.value='';field.disabled=true;button.hidden=true;feedback.textContent='Answer saved. Queued for Instinct to apply.';form.dataset.questionSaved='true';document.querySelectorAll(`[data-question-answer="${id}"]`).forEach(copy=>{copy.querySelector('textarea').value=text;copy.querySelector('textarea').disabled=true;copy.querySelector('button').hidden=true;copy.querySelector('[role=status]').textContent='Answer saved. Queued for Instinct to apply.';});}catch{if(session?.user?.id===uid){feedback.textContent='Not saved. Your answer is still here. Try again, or refresh if someone already answered.';button.disabled=false;}}finally{delete state.questionBusy[id];}};});

 root.querySelectorAll('[data-card-open]').forEach(card=>{const activate=e=>{if(e.target.closest('button,a,input,textarea,select,label,summary,form,[role="tab"]')||window.getSelection()?.toString())return;if(card.closest('#day-dialog'))card.closest('dialog').close();openDetail(card.dataset.cardOpen,card.dataset.cardItem);};card.onclick=activate;card.onkeydown=e=>{if(e.target!==card||!['Enter',' '].includes(e.key))return;e.preventDefault();if(card.closest('#day-dialog'))card.closest('dialog').close();openDetail(card.dataset.cardOpen,card.dataset.cardItem);};});
 root.querySelectorAll('[data-section-toggle]').forEach(b=>b.onclick=()=>{const key=b.dataset.sectionToggle;state.sectionModes[key]=b.getAttribute('aria-expanded')==='true';render();root===app&&document.querySelector(`[data-section-toggle="${key}"]`)?.focus();});
 root.querySelector('#match-text')?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.matchText=e.target.value;state.matchItem=null;state.matchFeedback='';render();const el=document.querySelector('#match-text');el.focus();el.setSelectionRange(pos,pos);});
 root.querySelectorAll('[data-match-item]').forEach(b=>b.onclick=()=>{state.matchItem=b.dataset.matchItem;render();});
 const matched=root.querySelector('#matched-update');if(matched)matched.onsubmit=async e=>{e.preventDefault();if(state.matchSaving)return;const i=state.data.sched.find(x=>x.id===state.matchItem);if(!i||!matchUpdate(state.matchText,state.data.sched,derive().pm).some(x=>x.id===i.id))return;const note=state.matchText.trim(),uid=session.user.id;state.matchSaving=true;state.matchFeedback='Saving...';render();try{const result=await queueComment({project_id:i.project_id,schedule_item_id:i.id,author_name:state.access?.display_name||session.user.email,note},joinedNames(derive().pm[i.project_id]?.name,i.title));const data=result?.receipt,error=!data;if(session?.user?.id!==uid)return;if(error||!data?.id)state.matchFeedback='Not sent yet. Your text is still here; submitted message retries on reconnect.';else{state.matchText='';state.matchItem=null;state.matchFeedback='Saved and queued for processing. No direct status change was made.';}}catch{if(session?.user?.id===uid)state.matchFeedback='Not sent yet. Your text is still here; submitted message retries on reconnect.';}finally{if(session?.user?.id===uid){state.matchSaving=false;render();}}};
 root.querySelectorAll('[data-work-filter]').forEach(b=>b.onclick=()=>{state.workFilter=b.dataset.workFilter;render();});
 root.querySelector('[data-my-hide-done]')?.addEventListener('change',e=>{state.myHideDone=e.target.checked;render();});
 root.querySelector('.finished-work')?.addEventListener('toggle',e=>{state.finishedOpen=e.target.open;});
 root.querySelectorAll('[data-daily-focus]').forEach(el=>{const go=e=>{e.preventDefault();e.stopPropagation();state.dailyFocus=el.dataset.dailyFocus&&state.dailyFocus!==el.dataset.dailyFocus?el.dataset.dailyFocus:'';if(el.dataset.dailyFocus)state.dailyOpen=true;render();document.querySelector('.daily-status')?.scrollIntoView({block:'start'});};el.addEventListener('click',go);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')go(e);});});
 root.querySelector('.daily-status')?.addEventListener('toggle',e=>{if(state.dailyOpen!==e.target.open){state.dailyOpen=e.target.open;render();}});
 root.querySelectorAll('.daily-copy').forEach(btn=>btn.addEventListener('click',async e=>{
  e.preventDefault();e.stopPropagation();
  const d=derive(),r=currentDaily(d);
  let text='',html='';
  if(btn.hasAttribute('data-copy-status')){text=statusOutline(r,{projects:d.pm,mm:d.mm});html=statusOutlineHtml(r,{projects:d.pm,mm:d.mm});}
  else{const b=r.brands.find(x=>x.key===btn.dataset.copyBrand);if(b){const opts={projects:d.pm,mm:d.mm,projectId:btn.dataset.copyProject||''};text=brandOutline(b,opts);html=brandOutlineHtml(b,opts);}}
  if(!text)return;
  try{
   if(window.ClipboardItem&&navigator.clipboard.write)await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);
   else await navigator.clipboard.writeText(text);
  }catch{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}finally{ta.remove();}}
  if(!btn.dataset.copyLabel)btn.dataset.copyLabel=btn.textContent;
  btn.textContent='Copied';setTimeout(()=>{btn.textContent=btn.dataset.copyLabel;},2000);
 }));
 root.querySelector('[data-show-unassigned]')?.addEventListener('click',()=>{const el=root.querySelector('.workload-unassigned');if(el){el.open=true;el.scrollIntoView({block:'start'});}});
 root.querySelectorAll('[data-work-scope]').forEach(b=>b.onclick=()=>{state.workScope=b.dataset.workScope;state.workFilter=b.dataset.workScope==='mine'?'today':'all';render();});
 root.querySelectorAll('[data-workload-view]').forEach(b=>b.onclick=()=>{state.workloadView=b.dataset.workloadView;state.calendarScrollTo='anchor';render();});
 root.querySelectorAll('[data-workload-person]').forEach(b=>b.onclick=()=>{state.workloadMember=b.dataset.workloadPerson;render();});
 root.querySelectorAll('[data-quick-update]').forEach(form=>{
  const textarea=form.querySelector('textarea'),key=form.dataset.quickUpdate;
  textarea.oninput=()=>{state.quickDrafts[key]=textarea.value;growTextField(textarea);};
  textarea.onkeydown=e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();form.requestSubmit();}};
  form.onsubmit=async e=>{e.preventDefault();const note=textarea.value.trim();if(!note)return;const button=form.querySelector('button'),feedback=form.querySelector('[role="status"]');if(button.disabled)return;button.disabled=true;feedback.textContent='Saving...';const uid=session?.user?.id;const result=await queueComment({project_id:form.dataset.quickProject,schedule_item_id:form.dataset.quickItem||null,author_name:state.access?.display_name||session.user.user_metadata?.display_name||session.user.email,note},joinedNames(derive().pm[form.dataset.quickProject]?.name,state.data.sched.find(i=>i.id===form.dataset.quickItem)?.title));if(session?.user?.id!==uid)return;button.disabled=false;if(!result?.receipt){feedback.textContent=result?.durable?'Not sent yet. Saved on this device; retry on reconnect.':'Not sent yet. Keep this page open: device storage is unavailable.';return;}delete state.quickDrafts[key];textarea.value='';growTextField(textarea);feedback.textContent=`Saved ${stamp(result.receipt.created_at)} MT. Queued for processing.`;
  };
 });
 root.querySelectorAll('[data-project-listing]').forEach(el=>el.ontoggle=()=>{if(!el.isConnected)return;state.expandedProjects[el.dataset.projectListing]=el.open;if(el.open&&!el.querySelector('.listing-content'))render();});
 root.querySelectorAll('[data-expand-projects]').forEach(b=>b.onclick=()=>{const expanded=b.dataset.expandProjects==='true';root.querySelectorAll('[data-project-listing]').forEach(el=>{state.expandedProjects[el.dataset.projectListing]=expanded;el.open=expanded;});render();});
 root.querySelectorAll('.card-edit-controls').forEach(el=>{if(el.closest('dialog')||el.closest('.workload-step[open]'))el.open=true;});
 root.querySelectorAll('[data-step-co]').forEach(el=>{el.onclick=e=>{e.stopPropagation();};el.onchange=()=>changeStepCo(el.dataset.stepCo,el.value);});
 root.querySelectorAll('[data-project-cx]').forEach(el=>el.onchange=async()=>{const p=state.data.projects.find(x=>x.id===el.dataset.projectCx),fb=el.parentElement.querySelector('[role=status]');el.disabled=true;fb.textContent='Saving...';try{const r=await saveProjectCx(supabase,p,el.value.split(',').map(x=>x.trim()).filter(Boolean));p.cx=r.cx;render();if(state.open)refreshDetail();}catch{fb.textContent='Not saved. Refresh and try again.';el.disabled=false;}});
 root.querySelectorAll('[data-step-owner]').forEach(el=>{el.onclick=e=>{e.stopPropagation();};el.onchange=()=>{if(el.value===ADD_CO){state.addCo[el.dataset.stepOwner]=true;render();if(state.open)refreshDetail();return;}changeStepOwner(el.dataset.stepOwner,el.value);};});
 root.querySelectorAll('[data-step-status]').forEach(el=>el.onchange=()=>changeStepStatus(el.dataset.stepStatus,el.value));
 root.querySelectorAll('select.pill[data-step-status]').forEach(el=>el.onclick=e=>e.preventDefault());
 root.querySelectorAll('[data-schedule-hide-done]').forEach(el=>el.onchange=()=>{state.scheduleHideDone[el.dataset.scheduleHideDone]=el.checked;if(state.open)refreshDetail();else render();});
 root.querySelectorAll('[data-card-dates]').forEach(form=>{const review=e=>{e.preventDefault();const values=new FormData(form);openTiming([form.dataset.cardDates],{start_date:String(values.get('start')||''),due_date:String(values.get('due')||'')});};form.onsubmit=review;form.querySelectorAll('input').forEach(input=>input.onchange=review);});
 root.querySelectorAll('[data-adjust-timing]').forEach(b=>b.onclick=()=>openTiming([b.dataset.adjustTiming]));
 root.querySelectorAll('[data-work-days]').forEach(form=>form.onsubmit=async e=>{
 e.preventDefault();const item=state.data.sched.find(i=>i.id===form.dataset.workDays),button=form.querySelector('button'),field=form.querySelector('input'),feedback=form.querySelector('[role=status]'),uid=session?.user?.id;
 if(button.disabled)return;button.disabled=true;feedback.textContent='Saving...';
 try{const data=await saveWorkDays(supabase,item,field.value);if(session?.user?.id!==uid)return;item.work_days_needed=data.work_days_needed;document.querySelectorAll('[data-work-days]').forEach(copy=>{if(copy.dataset.workDays===item.id){copy.querySelector('input').value=data.work_days_needed;copy.querySelector('[role=status]').textContent='Days saved. Existing dates unchanged.';const dates=copy.parentElement.querySelector('[data-card-dates]');if(dates&&!item.start_date){dates.querySelector('[name=start]').value=calendarSpan(item,officeHolidays)?.start||'';}}});applyTimingWarnings();}catch(error){feedback.textContent='Not saved. '+error.message;}finally{button.disabled=false;}
 });
 root.querySelectorAll('[data-select-step]').forEach(el=>el.onchange=()=>{const id=el.dataset.selectStep;state.selectedSteps=el.checked?[...new Set([...state.selectedSteps,id])]:state.selectedSteps.filter(x=>x!==id);updateSelectionUI();});
 root.querySelectorAll('[data-bulk-action]').forEach(b=>b.onclick=()=>openBulk(b.dataset.bulkAction));
 root.querySelectorAll('[data-clear-selection]').forEach(b=>b.onclick=()=>{state.selectedSteps=[];updateSelectionUI();});
 root.querySelectorAll('[data-select-project]').forEach(el=>el.onchange=()=>{const id=el.dataset.selectProject;state.selectedProjects=el.checked?[...new Set([...state.selectedProjects,id])]:state.selectedProjects.filter(x=>x!==id);state.combineFeedback='';updateSelectionUI();});
 root.querySelectorAll('[data-clear-project-selection]').forEach(b=>b.onclick=()=>{state.selectedProjects=[];state.combineFeedback='';updateSelectionUI();});
 root.querySelectorAll('[data-combine-projects]').forEach(b=>b.onclick=openCombine);root.querySelectorAll('[data-rename-project]').forEach(b=>b.onclick=openProjectRename);
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
 root.querySelectorAll('[data-disregard-comment]').forEach(b=>b.onclick=()=>openDisregard(b.dataset.disregardComment));
 root.querySelectorAll('[data-comment]').forEach(b=>b.onclick=()=>openComment(b.dataset.comment,b.dataset.item,b.dataset.brand||''));
 root.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(b.dataset.view==='projects'&&state.view!=='projects')state.expandedProjects={};if(b.dataset.view==='workload'&&state.view!=='workload')state.workloadExpanded={};if(isFreelancer(state.access)&&b.dataset.view==='workload')return;state.view=b.dataset.view;state.search='';state.member=b.hasAttribute('data-mine')?derive().aaron:'all';state.client='all';state.status='open';render();window.scrollTo({top:0});});
}
function render(){
 quickSequence=0;const d=derive(), newest=state.data.updates[0]?.created_at;
 app.innerHTML=`<header class="site-header"><a class="brand brand-compact" href="#" id="home"><span class="brand-mark" aria-hidden="true">P</span><span>Monigle Production Team Workspace</span></a><div class="sync"><span class="live-dot"></span>${state.error?'Refresh failed. Showing last loaded data.':`Loaded ${state.loaded.toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit'})} MT`}<button id="refresh" aria-label="Refresh data">↻</button><button id="signout">Sign out</button></div></header>
 <nav aria-label="Dashboard views">${[['today','My work'],...(!isFreelancer(state.access)?[['workload','Workload']]:[]),['projects','Clients'],['schedule','Schedule'],['recap','Recap']].map(([v,t])=>`<button data-view="${v}" ${state.view===v?'aria-current="page"':''}>${t}</button>`).join('')}${dashboardLegend()}</nav><main>${dailyStatusView(d)}<div id="revisions-area">${revisionsView()}</div>${bulkToolbar()}<div id="comment-outbox-area">${outboxView()}</div>${state.view==='today'?todayView(d):state.view==='projects'?projectsView(d):state.view==='workload'&&!isFreelancer(state.access)?workloadView(d):state.view==='recap'?recapView(d):scheduleView(d)}</main><div class="footnote">Latest feed entry: ${newest?esc(stamp(newest))+' MT':'none recorded'}. Loading this page does not mean every client was checked.<br>Missing a change? Use Update on any client or schedule item.</div><dialog id="bulk-dialog" aria-label="Bulk step actions"></dialog><dialog id="combine-dialog" aria-label="Combine projects"></dialog><dialog id="detail" aria-labelledby="dialog-title"></dialog><dialog id="comment-dialog" aria-labelledby="comment-title"></dialog><dialog id="day-dialog" aria-labelledby="day-title"></dialog>`;
 bind(app);updateRevisionUI();updateSelectionUI();applyTimingWarnings();document.querySelector('#signout').onclick=()=>supabase.auth.signOut();document.querySelector('#refresh').onclick=load;document.querySelector('#home').onclick=e=>{e.preventDefault();state.view='today';render();};
 for(const [id,key] of [['member','member'],['client','client'],['status','status']])document.getElementById(id)?.addEventListener('change',e=>{state[key]=e.target.value;render();document.getElementById(id).focus();});
 document.getElementById('search')?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.search=e.target.value;render();const el=document.getElementById('search');el.focus();el.setSelectionRange(pos,pos);});
 document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>{if(dialog.id==='detail')state.open=null;if(dialog.id==='day-dialog')state.openDay=null;(dialog.id==='day-dialog'?dayFocus:lastFocus)?.focus();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});});
}
function loginView(message=''){
 app.innerHTML=`<main class="login-shell"><section class="login-card"><span class="eyebrow">PRODUCTION (MONIGLE)</span><h1>Your team workspace.</h1><p>Sign in to see clients and send messages to Instinct.</p><form id="login-form"><label for="email">Your approved team email</label><input id="email" type="email" autocomplete="username" required placeholder="you@example.com"><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required><button class="primary" type="submit">Sign in</button></form><button id="forgot" class="text-button">Forgot your password?</button><p id="login-status" role="status">${esc(message)}</p><p class="muted">Access is limited to the team's approved email list. Ask Aaron if you need access.</p></section></main>`;
 const status=document.querySelector('#login-status');
 document.querySelector('#login-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;status.textContent='Signing in...';const {error}=await supabase.auth.signInWithPassword({email:document.querySelector('#email').value.trim().toLowerCase(),password:document.querySelector('#password').value});b.disabled=false;if(error)status.textContent='Sign-in did not work. Check your email and password, or ask Aaron to check your access.';};
 document.querySelector('#forgot').onclick=async()=>{const email=document.querySelector('#email').value.trim();if(!email){status.textContent='Enter your email above first.';return;}const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/#reset'});status.textContent=error?'Could not request a reset. Try again later.':'If that address has an account, a reset link will arrive by email.';};
}
function passwordView(){
 app.innerHTML='<main class="login-shell"><section class="login-card"><h1>Set your own password.</h1><p>Use a password only you know.</p><form id="password-form"><label for="new-password">New password</label><input id="new-password" type="password" autocomplete="new-password" required minlength="10"><button class="primary">Save password</button><p id="password-status" role="status"></p></form></section></main>';
 document.querySelector('form').onsubmit=async e=>{e.preventDefault();const {error}=await supabase.auth.updateUser({password:document.querySelector('#new-password').value});if(error){document.querySelector('#password-status').textContent='Could not change the password. Try again.';return;}history.replaceState({},'',window.location.pathname);startSession(session);};
}
let liveChannel,liveDebounce;document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.livePending)safeLiveRefresh();});
function safeLiveRefresh(){if(!session||!state.data)return;if(document.hidden||document.querySelector('dialog[open]')||Object.values(state.quickDrafts).some(Boolean)||state.bulkBusy||state.selectedSteps.length||state.selectedProjects.length||Object.keys(state.stepStatusBusy).length||Object.keys(state.ownerBusy).length||Object.values(state.pastDateDrafts).some(Boolean)||Object.values(state.questionDrafts).some(Boolean)||state.matchText){state.livePending=true;const status=document.querySelector('.calendar-live-status');if(status)status.textContent='New data available. Finish your draft or close details, then refresh.';return;}load();}
function connectLive(){if(liveChannel)supabase.removeChannel(liveChannel);liveChannel=null;if(!session)return;state.liveState='Connecting';liveChannel=supabase.channel('dashboard-calendar-'+session.user.id);for(const table of ['projects','schedule_items','project_links','dashboard_questions','dashboard_comments'])liveChannel.on('postgres_changes',{event:'*',schema:'public',table},()=>{refreshRevisions();clearTimeout(liveDebounce);liveDebounce=setTimeout(safeLiveRefresh,250);});liveChannel.subscribe(status=>{state.liveState=status==='SUBSCRIBED'?'Realtime connected (published tables only)':status==='CHANNEL_ERROR'||status==='TIMED_OUT'?'Realtime unavailable; 5-minute fallback':'Connecting';const el=document.querySelector('.calendar-live-status');if(el)el.textContent=state.liveState;});}
let sessionInitBusy=false;
async function startSession(next){
 if(next&&activeUserId===next.user?.id&&(state.data||sessionInitBusy)){session=next;return;}
 if(activeUserId!==next?.user?.id){state.workloadTeamFilter=[...defaultWorkloadTeams];state.ownerBusy={};state.ownerFeedback={};state.teamBusy={};state.teamFeedback={};state.calendarOwner='all';state.calendarProject='all';state.livePending=false;state.outbox=next?.user?.id?readOutbox(localStorage,next.user.id):[];state.outboxBusy={};state.questionDrafts={};state.questionBusy={};state.questionsAvailable=false;state.commentHistory=[];state.commentsAvailable=false;state.revisions=[];state.revisionsAvailable=true;state.revisionsOpen=false;state.quickDrafts={};state.selectedSteps=[];state.selectedProjects=[];state.combineFeedback='';state.bulkBusy=false;state.bulkFeedback='';state.stepStatusBusy={};state.stepStatusFeedback={};state.pastDateDrafts={};state.pastDateBusy={};state.pastDateFeedback={};state.matchText='';state.matchItem=null;state.matchSaving=false;state.matchFeedback='';state.workloadMember='all';state.workScope='mine';state.expandedProjects={};state.hideDone=false;state.ganttHideDone=true;state.workloadExpanded={};state.sectionModes={};state.stepRowOpen={};}activeUserId=next?.user?.id||null;session=next;state.data=null;
 if(!session){if(liveChannel)supabase.removeChannel(liveChannel);liveChannel=null;sessionInitBusy=false;loginView();return;}
 const snap=readSnapshot(session.user.id);
 if(snap){state.data=snap.data;state.access=snap.access||null;state.accessReady=!!snap.accessReady;state.loaded=new Date(snap.t);if(isFreelancer(state.access))state.view='today';render();}
 else loadingView('Checking team access...');
 sessionInitBusy=true;let memberRes,profileRes;
 try{[memberRes,profileRes]=await Promise.all([supabase.rpc('is_dashboard_member'),supabase.rpc('dashboard_access_profile')]);}finally{sessionInitBusy=false;}
 const {data,error}=memberRes;
 if(error||!data){app.innerHTML='<main class="login-shell"><section class="login-card"><h1>Team access is not enabled for this email.</h1><p>Ask Aaron to add your exact sign-in email to the approved list.</p><button id="signout">Sign out</button></section></main>';document.querySelector('#signout').onclick=()=>supabase.auth.signOut();return;}
 const {data:profile,error:profileError}=profileRes;
 if(profileError){
  if(profileError.code==='PGRST202'){state.access={role:'team',team_member_id:null};state.accessReady=false;}
  else{app.innerHTML='<div class="loading"><h1>Could not verify your access.</h1><p>Reload to try again. No work data was loaded.</p></div>';return;}
 }else{try{state.access=accessProfile(profile);state.accessReady=true;}catch{app.innerHTML='<div class="loading"><h1>Access profile needs setup.</h1></div>';return;}}
 if(isFreelancer(state.access))state.view='today';
 connectLive();load();
}
supabase.auth.onAuthStateChange((event,next)=>{setTimeout(()=>{session=next;if(event==='PASSWORD_RECOVERY'||next&&window.location.hash==='#reset')passwordView();else startSession(next);},0);});
// Do not refresh underneath a draft or while someone is reading a project.
setInterval(()=>{if(session&&state.data&&!document.hidden&&!document.querySelector('dialog[open]')&&!Object.values(state.quickDrafts).some(Boolean)&&!state.bulkBusy&&!state.selectedSteps.length&&!Object.keys(state.stepStatusBusy).length&&!Object.values(state.pastDateDrafts).some(Boolean)&&!Object.values(state.questionDrafts).some(Boolean)&&!state.matchText)load();},5*60*1000);

// Read only queue status without replacing drafts or open dialogs.
setInterval(()=>{if(session&&state.data&&!document.hidden)refreshRevisions();},60*1000);
