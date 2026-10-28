export function isProductionManagement(member){return String(member?.workload_team||'').trim().toLowerCase()==='production management';}
export function visibleWorkItem(item,scope,viewer,members,includeUnassigned){
 const ids=new Set(members.map(m=>m.id));
 const owners=[item.owner_id,...(item.co_owner_ids||[])].filter(id=>id&&ids.has(id));
 if(!owners.length)return includeUnassigned;
 return scope==='team'||Boolean(viewer&&owners.includes(viewer));
}
