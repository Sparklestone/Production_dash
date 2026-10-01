const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const app = document.getElementById('app');

const STATUS = {
  active: 'Active', waiting: 'Waiting', not_started: 'Not started', done: 'Done',
  in_progress: 'In progress', pending: 'Pending', blocked: 'Blocked',
};
const ORDER = { active: 0, in_progress: 0, blocked: 1, waiting: 2, pending: 3, not_started: 4, done: 5 };
const label = (s) => STATUS[s] || (s || '').replace(/_/g, ' ');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function q(table, params = '') {
  const r = await fetch(`${URL_}/rest/v1/${table}?${params}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${table}: ${r.status}`);
  return r.json();
}

const state = { data: null, status: 'open', member: 'all', client: 'all', search: '', open: null, view: 'projects' };

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + (d.length === 10 ? 'T12:00:00' : ''));
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function ago(ts) {
  const m = Math.round((Date.now() - new Date(ts)) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}
function dueClass(d, status) {
  if (!d || status === 'done') return '';
  const days = Math.round((new Date(d + 'T12:00:00') - Date.now()) / 864e5);
  return days < 0 ? 'late' : days <= 2 ? 'soon' : '';
}

async function load() {
  if (!URL_ || !KEY) {
    app.innerHTML = `<div class="msg"><h1>Missing configuration</h1><p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in Vercel, then redeploy.</p></div>`;
    return;
  }
  try {
    const [clients, projects, members, updates, links, sched] = await Promise.all([
      q('clients', 'select=*&order=name'),
      q('projects', 'select=*&order=sort_order,name'),
      q('team_members', 'select=*&active=eq.true&order=name'),
      q('project_updates', 'select=*&order=created_at.desc'),
      q('project_links', 'select=*&order=created_at'),
      q('schedule_items', 'select=*&order=due_date.asc.nullslast'),
    ]);
    state.data = { clients, projects, members, updates, links, sched };
    state.loaded = new Date();
    render();
  } catch (e) {
    app.innerHTML = `<div class="msg"><h1>Couldn't load data</h1><p>${esc(e.message)}</p></div>`;
  }
}

function derive() {
  const { clients, projects, members, updates, links, sched } = state.data;
  const cm = Object.fromEntries(clients.map((c) => [c.id, c]));
  const mm = Object.fromEntries(members.map((m) => [m.id, m]));
  const by = (arr, k) => arr.reduce((a, x) => ((a[x[k]] ||= []).push(x), a), {});
  return { cm, mm, upd: by(updates, 'project_id'), lnk: by(links, 'project_id'), sch: by(sched, 'project_id'),
    subs: by(projects.filter((p) => p.parent_id), 'parent_id') };
}

function filtered(d) {
  const s = state.search.toLowerCase();
  return state.data.projects.filter((p) => {
    if (p.parent_id) return false;
    if (state.status === 'open' && p.status === 'done') return false;
    if (!['open', 'all'].includes(state.status) && p.status !== state.status) return false;
    if (state.member !== 'all' && p.owner_id !== state.member &&
      !(d.sch[p.id] || []).some((i) => i.owner_id === state.member)) return false;
    if (state.client !== 'all' && p.client_id !== state.client) return false;
    if (s) {
      const hay = [p.name, p.description, d.cm[p.client_id]?.name].join(' ').toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });
}

function card(p, d) {
  const u = (d.upd[p.id] || [])[0];
  const owner = d.mm[p.owner_id];
  return `<article class="card" data-id="${p.id}">
    <div class="row"><span class="pill ${p.status}">${label(p.status)}</span>
      ${p.due_date ? `<span class="due ${dueClass(p.due_date, p.status)}">Due ${fmtDate(p.due_date)}</span>` : ''}</div>
    <h3>${esc(p.name)}</h3>
    <p class="latest">${u ? esc(u.note) : '<span class="muted">No updates yet</span>'}</p>
    <div class="meta">${u ? `<span>${ago(u.created_at)}</span>` : ''}${owner ? `<span>${esc(owner.name)}</span>` : ''}</div>
  </article>`;
}

function projectsView(d) {
  const list = filtered(d).sort((a, b) =>
    (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || (a.due_date || '9').localeCompare(b.due_date || '9'));
  if (!list.length) return `<p class="muted empty">Nothing matches those filters.</p>`;
  const groups = {};
  list.forEach((p) => (groups[p.client_id] ||= []).push(p));
  return Object.keys(groups)
    .sort((a, b) => (d.cm[a]?.name || '').localeCompare(d.cm[b]?.name || ''))
    .map((cid) => `<section><h2>${esc(d.cm[cid]?.name || 'No client')} <small>${groups[cid].length}</small></h2>
      <div class="grid">${groups[cid].map((p) => card(p, d)).join('')}</div></section>`).join('');
}

function scheduleView(d) {
  const pn = Object.fromEntries(state.data.projects.map((p) => [p.id, p]));
  let items = state.data.sched.filter((i) => i.status !== 'done');
  if (state.member !== 'all') items = items.filter((i) => i.owner_id === state.member);
  if (state.client !== 'all') items = items.filter((i) => pn[i.project_id]?.client_id === state.client);
  if (!items.length) return `<p class="muted empty">No open schedule items.</p>`;
  return `<div class="list">${items.map((i) => {
    const p = pn[i.project_id];
    return `<div class="item"><div class="date ${dueClass(i.due_date, i.status)}">${i.due_date ? fmtDate(i.due_date) : 'TBD'}</div>
      <div class="body"><b>${esc(i.title)}</b><span class="muted">${esc(d.cm[p?.client_id]?.name || '')} · ${esc(p?.name || '')}</span></div>
      <div class="who">${esc(d.mm[i.owner_id]?.name || '')}</div><span class="pill ${i.status}">${label(i.status)}</span></div>`;
  }).join('')}</div>`;
}

function detail(d) {
  const p = state.data.projects.find((x) => x.id === state.open);
  if (!p) return '';
  const subs = d.subs[p.id] || [];
  const upd = d.upd[p.id] || [], lnk = d.lnk[p.id] || [], sch = d.sch[p.id] || [];
  return `<div class="scrim" data-close></div><aside class="drawer">
    <button class="x" data-close aria-label="Close">×</button>
    <div class="row"><span class="pill ${p.status}">${label(p.status)}</span>${p.due_date ? `<span class="due ${dueClass(p.due_date, p.status)}">Due ${fmtDate(p.due_date)}</span>` : ''}</div>
    <p class="muted">${esc(d.cm[p.client_id]?.name || '')}${d.mm[p.owner_id] ? ' · ' + esc(d.mm[p.owner_id].name) : ''}</p>
    <h2>${esc(p.name)}</h2>
    ${p.description ? `<p>${esc(p.description)}</p>` : ''}
    <h4>Updates</h4>${upd.length ? upd.map((u) => `<div class="upd"><p>${esc(u.note)}</p><span class="muted">${ago(u.created_at)}${u.author ? ' · ' + esc(u.author) : ''}</span></div>`).join('') : '<p class="muted">None yet</p>'}
    <h4>Schedule</h4>${sch.length ? sch.map((i) => `<div class="mini"><span>${esc(i.title)}</span><span class="muted">${i.due_date ? fmtDate(i.due_date) : 'TBD'} · ${label(i.status)}</span></div>`).join('') : '<p class="muted">None yet</p>'}
    <h4>Links</h4>${lnk.length ? lnk.map((l) => l.url ? `<a class="link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}<small>${esc(l.kind || '')}</small></a>` : `<div class="link off">${esc(l.label)}<small>no URL yet</small></div>`).join('') : '<p class="muted">None yet</p>'}
    ${subs.length ? `<h4>Subprojects</h4>${subs.map((s) => `<div class="mini"><span>${esc(s.name)}</span><span class="muted">${label(s.status)}</span></div>`).join('')}` : ''}
  </aside>`;
}

function render() {
  const d = derive();
  const { clients, members, projects } = state.data;
  const top = projects.filter((p) => !p.parent_id);
  const count = (s) => top.filter((p) => p.status === s).length;
  const opt = (v, cur, t) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`;
  app.innerHTML = `<header>
    <div><h1>Production</h1><p class="muted">${top.filter((p) => p.status !== 'done').length} open projects · ${count('active')} active · ${count('waiting')} waiting · updated ${state.loaded.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div>
    <nav><button data-view="projects" class="${state.view === 'projects' ? 'on' : ''}">Projects</button><button data-view="schedule" class="${state.view === 'schedule' ? 'on' : ''}">Schedule</button></nav>
  </header>
  <div class="filters">
    <input id="s" type="search" placeholder="Search projects" value="${esc(state.search)}" />
    <select id="fm">${opt('all', state.member, 'Everyone')}${members.map((m) => opt(m.id, state.member, m.name)).join('')}</select>
    <select id="fc">${opt('all', state.client, 'All clients')}${clients.map((c) => opt(c.id, state.client, c.name)).join('')}</select>
    <select id="fs">${opt('open', state.status, 'Open')}${opt('all', state.status, 'All')}${['active', 'waiting', 'not_started', 'done'].map((s) => opt(s, state.status, label(s))).join('')}</select>
  </div>
  <main>${state.view === 'projects' ? projectsView(d) : scheduleView(d)}</main>${detail(d)}`;
  const s = document.getElementById('s');
  s.oninput = () => { state.search = s.value; const pos = s.selectionStart; render(); const n = document.getElementById('s'); n.focus(); n.setSelectionRange(pos, pos); };
  document.getElementById('fm').onchange = (e) => { state.member = e.target.value; render(); };
  document.getElementById('fc').onchange = (e) => { state.client = e.target.value; render(); };
  document.getElementById('fs').onchange = (e) => { state.status = e.target.value; render(); };
  app.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => { state.view = b.dataset.view; render(); }));
  app.querySelectorAll('.card').forEach((c) => (c.onclick = () => { state.open = c.dataset.id; render(); }));
  app.querySelectorAll('[data-close]').forEach((c) => (c.onclick = () => { state.open = null; render(); }));
}

load();
setInterval(() => { if (!state.open) load(); }, 5 * 60 * 1000);
