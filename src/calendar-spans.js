import {footprint,isWorkDay} from './timing.js';
import {verifiedInstant,mountainDay} from './live-calendar.js';
export function calendarSpan(item,holidays=[]){return footprint(item,holidays);}
export function itemOnCalendarDay(item,day,holidays=[]){
 const instant=verifiedInstant(item.starts_at);
 if(instant){const end=verifiedInstant(item.ends_at),last=end&&end>instant?mountainDay(new Date(end.getTime()-1).toISOString()):mountainDay(item.starts_at);return day>=mountainDay(item.starts_at)&&day<=last;}
 const span=calendarSpan(item,holidays);return Boolean(span&&day>=span.start&&day<=span.end&&isWorkDay(day,holidays));
}
export function spanDayLabel(row,day){return row.date===row.last_date?row.label:day===row.date?'Starts':day===row.last_date?row.label:'Continues';}
