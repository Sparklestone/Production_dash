import QRCode from 'qrcode';
import './style.css';
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const app = document.querySelector('#app');
const LINE = '+16502484031';
const TZ = 'America/Denver';
const state = { data: null, view: 'today', member: 'all', client: 'all', status: 'open', search: '', open: null, busy: false };
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
async function q(table,params){const r=await fetch(`${URL_}/rest/v1/${table}?${params}`,{headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}});if(!r.ok)throw Error('Data request failed');return r.json();}
async function load(){
 if(state.busy)return;state.busy=true;
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
function projectCard(p,d){
 const next=(d.sch[p.id]||[]).filter(i=>i.status!=='done' && i.due_date && i.due_date>=today())[0];
 const ds=due(next?.due_date||p.due_date,p.status);
 return `<article class="project-card"><div class="card-top"><span class="eyebrow">${esc(d.cm[p.client_id]?.name||'No client')}</span><span class="pill ${esc(p.status)}">${esc(label(p.status))}</span></div><h3><button class="title-button" data-open="${p.id}">${esc(shortName(p,d))}</button></h3>${latest(p,d)}<div class="card-meta"><span>Lead: ${esc(d.mm[p.owner_id]?.name||'Not assigned')}</span><span class="${ds.cls}">${esc(ds.text)}${next?' · '+esc(next.title):''}</span></div><footer><button class="text-button" data-open="${p.id}">Details & links →</button>${commentButton(p)}</footer></article>`;
}
function taskCard(i,d){const p=d.pm[i.project_id];if(!p)return '';const dt=due(i.due_date,i.status);return `<article class="task-card"><div class="task-date ${dt.cls}">${esc(dt.text)}</div><h3><button class="title-button" data-open="${p.id}">${esc(i.title)}</button></h3><p class="task-context">${esc(d.cm[p.client_id]?.name||'')} / ${esc(shortName(p,d))}</p>${i.notes?`<p class="task-note">${esc(i.notes)}</p>`:''}<footer><span class="owner">${esc(d.mm[i.owner_id]?.name||'Not assigned')} · ${esc(label(i.status))}</span>${commentButton(p,i)}</footer></article>`;}
function todayView(d){
 const top=state.data.projects.filter(p=>!p.parent_id&&p.status!=='done');
 const open=state.data.sched.filter(i=>i.status!=='done'&&d.pm[i.project_id]?.status!=='done');
 const mine=open.filter(i=>i.owner_id===d.aaron), past=mine.filter(i=>i.due_date&&i.due_date<today());
 const upcoming=mine.filter(i=>!i.due_date||i.due_date>=today()).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
 const next=[...upcoming.filter(i=>i.due_date).slice(0,2),...upcoming.filter(i=>!i.due_date).slice(0,1)];
 if(next.length<3)next.push(...upcoming.filter(i=>!next.includes(i)).slice(0,3-next.length));
 const waiting=top.filter(p=>['waiting','blocked'].includes(p.status));
 const recent=[...top].sort((a,b)=>(d.upd[b.id]?.[0]?.created_at||'').localeCompare(d.upd[a.id]?.[0]?.created_at||'')).slice(0,4);
 return `<section class="hero"><div><span class="eyebrow">YOUR DAILY VIEW</span><h1>What needs your attention.</h1><p>Your assignments first. The team picture below.</p></div><div class="hero-count"><b>${top.length}</b><span>open projects<br>across ${new Set(top.map(p=>p.client_id)).size} clients</span></div></section>
 <section class="focus-section"><div class="section-heading"><div><h2>On your plate <span class="number">${mine.length-past.length}</span></h2><p>Your next dates and undated work. ${next.length} of ${upcoming.length} open assignments shown.</p></div><button class="text-button" data-view="schedule" data-mine>See your schedule →</button></div><div class="task-grid">${next.length?next.map(i=>taskCard(i,d)).join(''):'<p class="empty">No upcoming assignments recorded for you.</p>'}</div></section>
 ${past.length?`<details class="status-check"><summary><span class="check-dot"></span>${past.length} past-due record${past.length>1?'s':''} to check <span class="summary-hint">Verify status, not a new ask</span></summary><p>These items still show open in the feed. They may already be complete. Comment to correct them.</p><div class="task-grid">${past.map(i=>taskCard(i,d)).join('')}</div></details>`:''}
 <section><div class="section-heading"><div><h2>Waiting on others <span class="number">${waiting.length}</span></h2><p>Projects marked waiting or blocked. Latest recorded context.</p></div></div><div class="project-grid waiting-grid">${waiting.length?waiting.map(p=>projectCard(p,d)).join(''):'<p class="empty">No waiting projects recorded.</p>'}</div></section>
 <section><div class="section-heading"><div><h2>Latest across the team</h2><p>The most recently updated projects, with source timestamps.</p></div><button class="text-button" data-view="projects">All projects →</button></div><div class="project-grid">${recent.map(p=>projectCard(p,d)).join('')}</div></section>`;
}
function filtered(d){return state.data.projects.filter(p=>!p.parent_id&&(state.status==='all'||state.status==='open'&&p.status!=='done'||state.status===p.status)&&(state.member==='all'||p.owner_id===state.member||(d.sch[p.id]||[]).some(i=>i.owner_id===state.member))&&(state.client==='all'||p.client_id===state.client)&&[p.name,p.description,d.cm[p.client_id]?.name,...(d.upd[p.id]||[]).map(u=>u.note)].join(' ').toLowerCase().includes(state.search.toLowerCase()));}
const opt=(v,cur,t)=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(t)}</option>`;
function filters(schedule=false){return `<div class="filters"><label class="search-label">Search<input id="search" type="search" placeholder="Find a project, client or update" value="${esc(state.search)}"></label><label>Team member<select id="member">${opt('all',state.member,'Everyone')}${state.data.members.map(m=>opt(m.id,state.member,m.name)).join('')}</select></label><label>Client<select id="client">${opt('all',state.client,'All clients')}${state.data.clients.map(c=>opt(c.id,state.client,c.name)).join('')}</select></label><label>Status<select id="status">${opt('open',state.status,'Open')}${opt('all',state.status,'Including done')}${(schedule?['pending','in_progress','waiting','blocked','done']:['active','waiting','blocked','not_started','done']).map(s=>opt(s,state.status,label(s))).join('')}</select></label></div>`;}
function projectsView(d){const list=filtered(d);const groups=by(list,'client_id');return `<div class="page-title"><h1>All projects</h1><p>Find the work, latest context and every project link.</p></div>${filters()}<p class="results">${list.length} projects shown</p>${list.length?Object.keys(groups).sort((a,b)=>(d.cm[a]?.name||'').localeCompare(d.cm[b]?.name||'')).map(c=>`<section><div class="section-heading"><h2>${esc(d.cm[c]?.name||'No client')} <span class="number">${groups[c].length}</span></h2></div><div class="project-grid">${groups[c].map(p=>projectCard(p,d)).join('')}</div></section>`).join(''):'<p class="empty">Nothing matches. Try another filter.</p>'}`;}
function scheduleView(d){
 const xs=state.data.sched.filter(i=>(state.status==='all'||state.status==='open'&&i.status!=='done'||i.status===state.status)&&(state.member==='all'||i.owner_id===state.member)&&(state.client==='all'||d.pm[i.project_id]?.client_id===state.client)&&[i.title,i.notes,d.pm[i.project_id]?.name,d.cm[d.pm[i.project_id]?.client_id]?.name].join(' ').toLowerCase().includes(state.search.toLowerCase()));
 const groups=[['Check recorded status',xs.filter(i=>i.status!=='done'&&i.due_date&&i.due_date<today())],['Upcoming dates',xs.filter(i=>i.status!=='done'&&i.due_date&&i.due_date>=today())],['No date set',xs.filter(i=>i.status!=='done'&&!i.due_date)],['Completed',xs.filter(i=>i.status==='done')]];
 return `<div class="page-title"><h1>Schedule</h1><p>Recorded milestones and assignments, not a live calendar.</p></div>${filters(true)}<p class="results">${xs.length} items shown · Dates are Mountain time. Past dates need a status check.</p>${groups.filter(([,v])=>v.length).map(([name,v])=>`<section><div class="section-heading"><h2>${name} <span class="number">${v.length}</span></h2></div><div class="task-grid">${v.map(i=>taskCard(i,d)).join('')}</div></section>`).join('')||'<p class="empty">No schedule items match.</p>'}`;
}
function safeLink(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function detail(p,d){const us=d.upd[p.id]||[],ls=d.lnk[p.id]||[],ss=d.sch[p.id]||[],subs=d.subs[p.id]||[];
 return `<div class="dialog-head"><span class="eyebrow">${esc(d.cm[p.client_id]?.name||'PROJECT')}</span><button class="close" data-close aria-label="Close project details">×</button></div><h2 id="dialog-title">${esc(p.name)}</h2><div class="detail-meta"><span class="pill ${esc(p.status)}">${esc(label(p.status))}</span><span>Lead: ${esc(d.mm[p.owner_id]?.name||'Not assigned')}</span>${commentButton(p)}</div>${p.description?`<details class="background"><summary>Project background</summary><p>${esc(p.description)}</p><small>Background may predate the latest updates below.</small></details>`:''}
 <h3 class="detail-heading">Latest update</h3>${latest(p,d,true)}<h3 class="detail-heading">Files & links <span class="number">${ls.length+subs.reduce((n,s)=>n+(d.lnk[s.id]||[]).length,0)}</span></h3>${[...ls,...subs.flatMap(s=>d.lnk[s.id]||[])].map(l=>{const href=safeLink(l.url);return href?`<a class="file-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} <span>↗</span></a>`:`<div class="file-link disabled">${esc(l.label)}<small>URL not recorded</small></div>`;}).join('')||'<p class="muted">No links recorded yet. Comment to add one.</p>'}
 <h3 class="detail-heading">Schedule</h3>${ss.map(i=>taskCard(i,d)).join('')||'<p class="muted">No schedule items recorded.</p>'}${subs.length?`<h3 class="detail-heading">Subprojects</h3>${subs.map(s=>`<article class="subproject"><h4>${esc(s.name)}</h4><span class="pill ${esc(s.status)}">${esc(label(s.status))}</span><p>${esc(s.description)}</p>${commentButton(s)}</article>`).join('')}`:''}
 <details class="history"><summary>Earlier updates (${Math.max(0,us.length-1)})</summary>${us.slice(1).map(u=>`<article><small>${esc(stamp(u.created_at))} MT</small><p>${esc(u.note)}</p></article>`).join('')||'<p class="muted">No earlier updates.</p>'}</details>`;
}
let lastFocus;
function openDetail(id){const d=derive(),p=d.pm[id];if(!p)return;lastFocus=document.activeElement;state.open=id;const dialog=document.querySelector('#detail');dialog.innerHTML=detail(p,d);bind(dialog);dialog.showModal();dialog.querySelector('[data-close]').focus();}
function smsLink(body,android=false){return `sms:${LINE}${android?'?':'&'}body=${encodeURIComponent(body)}`;}
async function openComment(pid,iid){
 const d=derive(),p=d.pm[pid],i=state.data.sched.find(x=>x.id===iid);if(!p)return;
 const body=`Re: ${d.cm[p.client_id]?.name||'Production'} / ${p.name}${i?' / '+i.title:''}\n[Project ${p.id}${i?'; item '+i.id:''}]\n\nMy update: `;
 const mobile=matchMedia('(max-width: 700px)').matches && /iPhone|iPad|Android/i.test(navigator.userAgent);
 if(mobile){window.location.href=smsLink(body,/Android/i.test(navigator.userAgent));return;}
 lastFocus=document.activeElement;
 const dialog=document.querySelector('#comment-dialog');
 dialog.innerHTML=`<div class="dialog-head"><span class="eyebrow">COMMENT TO INSTINCT</span><button class="close" data-close aria-label="Close comment">×</button></div><h2 id="comment-title">Send an update about this.</h2><p>${esc(i?.title||p.name)}</p><p class="muted">Scan with your phone. The text includes the project ID so I know what to change. Add your note and tap Send in Messages.</p><div class="qr-row"><div id="qr" aria-label="QR code to open a project-context text"></div><div><label for="phone-type">Your phone</label><select id="phone-type"><option value="iphone">iPhone</option><option value="android">Android</option></select><p class="muted">Nothing is sent automatically.</p></div></div><label for="comment-body">Context included in your draft</label><textarea id="comment-body" rows="5"></textarea><div class="comment-actions"><a id="sms-open" class="primary">Open Messages</a><button id="copy-context">Copy context</button></div><p id="copy-status" role="status"></p>`;
 dialog.querySelector('#comment-body').value=body;
 let revision=0;
 const refresh=async()=>{const version=++revision;const link=smsLink(dialog.querySelector('#comment-body').value,dialog.querySelector('#phone-type').value==='android');dialog.querySelector('#sms-open').href=link;try{const image=await QRCode.toDataURL(link,{width:240,margin:4,errorCorrectionLevel:'M',color:{dark:'#132a25',light:'#ffffff'}});if(version===revision)dialog.querySelector('#qr').innerHTML=`<img width="240" height="240" src="${image}" alt="Scan to draft a text to Instinct">`;}catch{dialog.querySelector('#qr').textContent='Draft too long for a QR code. Use Copy context instead.';}};
 dialog.querySelector('#phone-type').onchange=refresh;dialog.querySelector('#comment-body').oninput=refresh;
 dialog.querySelector('#copy-context').onclick=async()=>{try{await navigator.clipboard.writeText(dialog.querySelector('#comment-body').value);dialog.querySelector('#copy-status').textContent='Copied. Paste it into your text to Instinct.';}catch{dialog.querySelector('#comment-body').select();dialog.querySelector('#copy-status').textContent='Select and copy the context above.';}};
 bind(dialog);dialog.showModal();dialog.querySelector('[data-close]').focus();await refresh();
}
function bind(root){
 root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDetail(b.dataset.open));
 root.querySelectorAll('[data-comment]').forEach(b=>b.onclick=()=>openComment(b.dataset.comment,b.dataset.item));
 root.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.search='';state.member=b.hasAttribute('data-mine')?derive().aaron:'all';state.client='all';state.status='open';render();window.scrollTo({top:0});});
}
function render(){
 const d=derive(), newest=state.data.updates[0]?.created_at;
 app.innerHTML=`<header class="site-header"><a class="brand" href="#" id="home"><span class="brand-mark" aria-hidden="true">P</span><span>Production<small>MONIGLE / TEAM WORKSPACE</small></span></a><div class="sync"><span class="live-dot"></span>${state.error?'Refresh failed. Showing last loaded data.':`Loaded ${state.loaded.toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit'})} MT`}<button id="refresh" aria-label="Refresh data">↻</button></div></header>
 <nav aria-label="Dashboard views">${[['today','Today'],['projects','Projects'],['schedule','Schedule']].map(([v,t])=>`<button data-view="${v}" ${state.view===v?'aria-current="page"':''}>${t}</button>`).join('')}</nav><main>${state.view==='today'?todayView(d):state.view==='projects'?projectsView(d):scheduleView(d)}</main><div class="footnote">Latest feed entry: ${newest?esc(stamp(newest))+' MT':'none recorded'}. Loading this page does not mean every project was checked.<br>Missing a change? Use Comment on any project or schedule item.</div><dialog id="detail" aria-labelledby="dialog-title"></dialog><dialog id="comment-dialog" aria-labelledby="comment-title"></dialog>`;
 bind(app);document.querySelector('#refresh').onclick=load;document.querySelector('#home').onclick=e=>{e.preventDefault();state.view='today';render();};
 for(const [id,key] of [['member','member'],['client','client'],['status','status']])document.getElementById(id)?.addEventListener('change',e=>{state[key]=e.target.value;render();document.getElementById(id).focus();});
 document.getElementById('search')?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.search=e.target.value;render();const el=document.getElementById('search');el.focus();el.setSelectionRange(pos,pos);});
 document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>{state.open=null;lastFocus?.focus();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});});
}
load();
// Do not refresh underneath a draft or while someone is reading a project.
setInterval(()=>{if(!document.hidden&&!document.querySelector('dialog[open]'))load();},5*60*1000);
