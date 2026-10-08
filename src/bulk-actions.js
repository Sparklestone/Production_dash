export function selectedSteps(ids,items,projects){const wanted=new Set(ids);return items.filter(i=>wanted.has(i.id)&&projects[i.project_id]);}
export const stepSnapshot = item => ({id:item.id,project_id:item.project_id,status:item.status,start_date:item.start_date||null,due_date:item.due_date||null});
export function workstreamChoices(projects){return Object.values(projects).filter(p=>p.parent_id&&p.status!=='done'&&projects[p.parent_id]?.status!=='done');}
export async function applyBulk(client,items,action,extra={}){
 const {data,error}=await client.rpc('apply_dashboard_bulk',{payload:{action,items:items.map(stepSnapshot),...extra}});
 if(error||!data?.ok)throw Error(error?.message||'Changes not confirmed');return data;
}
