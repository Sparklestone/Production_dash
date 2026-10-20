export async function saveStepOwner(client,item,owner){const {data,error}=await client.rpc('set_dashboard_step_owner',{target_id:item.id,new_owner:owner||null,expected_owner:item.owner_id||null});if(error||data?.id!==item.id||(data.owner_id||null)!==(owner||null))throw Error('Assignment not confirmed');return data;}

export const ownerNames=(item,mm,fallback)=>{const ids=[item.owner_id,...(item.co_owner_ids||[])].filter(Boolean),names=ids.map(id=>mm[id]?.name).filter(Boolean);return names.length?names.join(' & '):fallback;};
export async function saveStepCoOwners(client,item,next){const {data,error}=await client.rpc('set_dashboard_step_co_owners',{target_id:item.id,new_co:next,expected_co:item.co_owner_ids||[]});if(error||data?.id!==item.id)throw Error('Co-owners not confirmed');return data;}
export async function saveProjectCx(client,p,next){const {data,error}=await client.rpc('set_dashboard_project_cx',{target_id:p.id,new_cx:next,expected_cx:p.cx||[]});if(error||data?.id!==p.id)throw Error('CX not confirmed');return data;}
export const projectCx=(p,pm)=>{let n=p,s=0;while(n&&!(n.cx||[]).length&&n.parent_id&&pm[n.parent_id]&&s++<20)n=pm[n.parent_id];return n?.cx||[];};
