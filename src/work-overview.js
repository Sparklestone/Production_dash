import {dateKey,projectIsDone} from './schedule.js';
import {weekWindow,shiftDate} from './insights.js';
export function workOverview(items,projects,today){
 const open=items.filter(i=>i.status!=='done'&&!projectIsDone(projects[i.project_id],projects)),{start,end}=weekWindow(today);
 const waiting=i=>['waiting','blocked'].includes(i.status)||projects[i.project_id]?.status==='waiting';
 const filters={all:open,in_progress:open.filter(i=>i.status==='in_progress'),today:open.filter(i=>dateKey(i.due_date)===today),week:open.filter(i=>dateKey(i.due_date)>=start&&dateKey(i.due_date)<=end),waiting:open.filter(waiting),past:open.filter(i=>dateKey(i.due_date)&&dateKey(i.due_date)<today)};
 const buckets={past:[],attention:[],today:[],upcoming:[],undated:[]},reasons={};
 for(const i of open){const due=dateKey(i.due_date);reasons[i.id]=[...(waiting(i)?[i.status==='blocked'?'Blocked':'Waiting on others']:[]),...(!i.owner_id?['No owner']:[]),...(due&&due>=today&&due<=shiftDate(today,2)?[due===today?'Due today':due===shiftDate(today,1)?'Due tomorrow':'Due '+due]:[])];
 if(due&&due<today)buckets.past.push(i);else if(reasons[i.id].length)buckets.attention.push(i);else if(due===today)buckets.today.push(i);else if(due)buckets.upcoming.push(i);else buckets.undated.push(i);
 }
 for(const rows of Object.values(buckets))rows.sort((a,b)=>(dateKey(a.due_date)||'9999').localeCompare(dateKey(b.due_date)||'9999')||a.title.localeCompare(b.title));
 return {filters,buckets,reasons};
}
export function workloadSignal(week){return week>6?'heavy':week===0?'available':'steady';}
export function ownerInitials(name){return (name||'Unassigned').trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();}
