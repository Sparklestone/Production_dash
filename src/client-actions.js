export const clientSnapshot=c=>({id:c.id,name:c.name,aka:c.aka||''});
export function clientCombinePlan(ids,keepId,clients,projects){
 if(ids.length!==2||new Set(ids).size!==2||!ids.includes(keepId))throw Error('Select two clients and choose the name to keep.');
 const keep=clients.find(c=>c.id===keepId),source=clients.find(c=>c.id===ids.find(id=>id!==keepId));
 if(!keep||!source)throw Error('Client missing. Refresh.');
 return {keep:clientSnapshot(keep),source:clientSnapshot(source),projects:projects.filter(p=>p.client_id===source.id).map(p=>({id:p.id,client_id:p.client_id,updated_at:p.updated_at}))};
}
export async function saveClientNames(client,c,name,aka){
 const {data,error}=await client.rpc('set_dashboard_client_names',{target_client_id:c.id,expected_name:c.name,expected_aka:c.aka||'',new_name:name.trim(),new_aka:aka.trim()||null});
 if(error||!data?.ok)throw Error(error?.message||'Save not confirmed');return data;
}
export async function combineClients(client,plan){const {data,error}=await client.rpc('combine_dashboard_clients',{payload:plan});if(error||!data?.ok)throw Error(error?.message||'Combine not confirmed');return data;}
