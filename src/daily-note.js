const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export const dailyNoteKey=n=>JSON.stringify([n.project?.id,n.at,n.text]);
export function dailyNote(n,date,expanded=false){
 const key=esc(dailyNoteKey(n)),text=esc(n.text),stamp=esc(date);
 return `<div class="brief-note${expanded?' is-expanded':''}" data-daily-note="${key}"><div class="brief-note-line"><span class="brief-note-preview"${expanded?' hidden':''}>${text}</span><span class="daily-meta">${stamp}</span><button class="daily-note-expand" data-daily-note-toggle="${key}" aria-label="Expand communication message" aria-expanded="${expanded}"${expanded?' hidden':''}>…</button></div><p class="brief-note-full"${expanded?'':' hidden'}>${text} <button class="daily-note-compress" data-daily-note-toggle="${key}" aria-expanded="${expanded}">compress message</button></p></div>`;
}
export function toggleDailyNote(container,expanded){
 container.classList.toggle('is-expanded',expanded);
 container.querySelector('.brief-note-preview').hidden=expanded;
 container.querySelector('.daily-note-expand').hidden=expanded;
 container.querySelector('.brief-note-full').hidden=!expanded;
 container.querySelectorAll('[data-daily-note-toggle]').forEach(b=>b.setAttribute('aria-expanded',String(expanded)));
 container.querySelector(expanded?'.daily-note-compress':'.daily-note-expand').focus({preventScroll:true});
}
