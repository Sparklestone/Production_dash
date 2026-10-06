// Only rows already visible under the signed-in user's RLS policy enter this view.
export function pendingRevisions(rows,projects=[]){
 const visible=new Set(projects.map(p=>p.id));
 return rows.filter(r=>r.id&&r.reviewed_at==null&&visible.has(r.project_id))
  .sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
}
export function revisionTargets(rows,projects=[]){
 const pm=new Map(projects.map(p=>[p.id,p])),projectIds=new Set(),stepIds=new Set();
 for(const r of rows){
  if(r.schedule_item_id)stepIds.add(r.schedule_item_id);
  let id=r.project_id;const seen=new Set();
  while(id&&pm.has(id)&&!seen.has(id)){seen.add(id);projectIds.add(id);id=pm.get(id).parent_id;}
 }
 return {projectIds,stepIds};
}
