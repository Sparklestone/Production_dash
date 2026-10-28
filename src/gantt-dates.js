export function ganttDates(item,esc,fmt){
 if(!item)return '';
 const start=item.start_date?.slice(0,10)||'',end=item.due_date?.slice(0,10)||'';
 if(item.starts_at||item.status==='done')return `<small class="gantt-recorded-dates">${esc(start?fmt(start):'Start not set')} - ${esc(end?fmt(end):'End not set')}${item.starts_at?' · timed event':''}</small>`;
 return `<form class="gantt-date-control" data-card-dates="${esc(item.id)}"><label>Start<input name="start" type="date" value="${esc(start)}" aria-label="Start date for ${esc(item.title)}"></label><span aria-hidden="true">-</span><label>End<input name="due" type="date" required value="${esc(end)}" aria-label="End date for ${esc(item.title)}"></label><button type="submit" class="sr-only">Review dates for ${esc(item.title)}</button></form>`;
}
