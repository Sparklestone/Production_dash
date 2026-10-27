export function selectedSteps(ids,items,projects){const wanted=new Set(ids);return items.filter(i=>wanted.has(i.id)&&projects[i.project_id]);}
export const stepSnapshot = item => ({id:item.id,project_id:item.project_id,status:item.status,start_date:item.start_date||null,due_date:item.due_date||null});
export function workstreamChoices(projects){return Object.values(projects).filter(p=>p.parent_id&&p.status!=='done'&&projects[p.parent_id]?.status!=='done');}
export async function applyBulk(client,items,action,extra={}){
 const {data,error}=await client.rpc('apply_dashboard_bulk',{payload:{action,items:items.map(stepSnapshot),...extra}});
 if(error||!data?.ok)throw Error(error?.message||'Changes not confirmed');return data;
}
export function combineOptions(ids,projects,items){
 if(ids.length!==2)return null;
 const [a,b]=ids.map(id=>projects[id]);if(!a||!b)return null;
 const count=id=>items.filter(i=>i.project_id===id).length;
 return [{keep:a,source:b,keepCount:count(a.id),gainCount:count(b.id)},{keep:b,source:a,keepCount:count(b.id),gainCount:count(a.id)}];
}
export function combinePlan(ids,keepId,projects,items){
 const opt=(combineOptions(ids,projects,items)||[]).find(o=>o.keep.id===keepId);
 if(!opt)return null;
 return {keep:opt.keep,source:opt.source,items:items.filter(i=>i.project_id===opt.source.id)};
}
export async function executeCombine(client,plan,author){
 if(!plan||!plan.items.length)throw Error('No steps to move');
 return applyBulk(client,plan.items,'move',{target_id:plan.keep.id,author_name:author});
}
