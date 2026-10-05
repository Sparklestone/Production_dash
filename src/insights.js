import {dateKey,projectIsDone} from './schedule.js';
export const shiftDate=(key,days)=>new Date(Date.parse(key+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export function weekWindow(key){const day=new Date(key+'T12:00:00Z').getUTCDay();const start=shiftDate(key,-((day+6)%7));return {start,end:shiftDate(start,6)};}
export function needsAttention(items,projects,today,owner=null){
 const end=shiftDate(today,2);
 return items.filter(i=>i.status!=='done'&&!projectIsDone(projects[i.project_id],projects)).map(i=>({item:i,reasons:[...(i.status==='blocked'&&(!owner||i.owner_id===owner)?['Blocked']:[]),...(!i.owner_id?['No owner']:[]),...(dateKey(i.due_date)>=today&&dateKey(i.due_date)<=end?['Due within 2 days']:[])]})).filter(x=>x.reasons.length);
}
export function weeklyCounts(items,projects,today){const {start,end}=weekWindow(today);const open=items.filter(i=>i.status!=='done'&&!projectIsDone(projects[i.project_id],projects));return {open:open.length,week:open.filter(i=>dateKey(i.due_date)>=start&&dateKey(i.due_date)<=end).length,past:open.filter(i=>dateKey(i.due_date)&&dateKey(i.due_date)<today).length};}
export function matchUpdate(text,items,projects){
 const normalized=text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 if(normalized.length<3)return [];
 const words=normalized.split(' ').filter(w=>w.length>2&&!['done','finished','ready','blocked','waiting','update','completed','the','for','and'].includes(w));
 if(!words.length)return [];
 return items.map(item=>{const p=projects[item.project_id],hay=[item.title,p?.name].join(' ').toLowerCase().replace(/[^a-z0-9]+/g,' ');return {item,score:words.filter(w=>hay.includes(w)).length/words.length};}).filter(x=>x.score===1).map(x=>x.item);
}
// Explicit dependency edges only. No inferred order from a timeline date.
export function lateDependencies(items,edges,today){const byId=Object.fromEntries(items.map(i=>[i.id,i]));const result={};for(const edge of edges){const upstream=byId[edge.upstream_id],downstream=byId[edge.downstream_id];if(upstream&&downstream&&upstream.status!=='done'&&downstream.status!=='done'&&dateKey(upstream.due_date)&&dateKey(upstream.due_date)<today)(result[downstream.id]||=[]).push(upstream);}return result;}

export function recordedDay(value){if(!value)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const date=new Date(value);if(Number.isNaN(date.getTime()))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
