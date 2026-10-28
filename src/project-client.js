// Reassign whole project trees without detaching children or moving steps.
export function projectClientPlan(ids,projects){
 const selected=new Set(ids),byId=Object.fromEntries(projects.map(p=>[p.id,p]));
 if(!selected.size)throw Error('Select at least one project.');
 for(const id of selected){const p=byId[id];if(!p||p.is_brand_bucket)throw Error('Project unavailable. Refresh.');if(p.parent_id&&!selected.has(p.parent_id))throw Error(`Select the parent project for ${p.name} to keep its hierarchy together.`);}
 const scope=new Set(selected);let changed=true;
 while(changed){changed=false;for(const p of projects)if(p.parent_id&&scope.has(p.parent_id)&&!scope.has(p.id)){scope.add(p.id);changed=true;}}
 return projects.filter(p=>scope.has(p.id)).map(p=>({id:p.id,name:p.name,parent_id:p.parent_id||null,client_id:p.client_id||null,updated_at:p.updated_at||null}));
}
export async function assignProjectsToClient(client,selected,items,target){
 if(!target)throw Error('Choose a client.');
 const {data,error}=await client.rpc('assign_dashboard_projects_client',{payload:{selected_ids:selected,items,target_client_id:target}});
 if(error||!data?.ok)throw Error(error?.message||'Assignment not confirmed.');return data;
}
