import {dateKey,projectIsDone} from './schedule.js';

// A recorded past date is a prompt to reconcile work, never inferred completion.
export function unresolvedPastDue(items,projects,today,owner=null){
 return items.filter(i=>projects[i.project_id]&&i.status!=='done'&&!projectIsDone(projects[i.project_id],projects)&&(owner===null||i.owner_id===owner)&&dateKey(i.due_date)&&dateKey(i.due_date)<today)
  .sort((a,b)=>dateKey(a.due_date).localeCompare(dateKey(b.due_date))||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
}
export function dateChangeNote(item,newDate){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate)||new Date(newDate+'T12:00:00Z').toISOString().slice(0,10)!==newDate)throw Error('Choose a valid date');
 if(newDate===dateKey(item.due_date))throw Error('Choose a different date');
 return `Change due date for "${item.title}" from ${dateKey(item.due_date)} to ${newDate}. Keep the task status unchanged. Requested from the past due section.`;
}
