export const defaultWorkloadTeams=['Production','Freelancers'];
export function memberTeam(m){
 if(m.workload_team)return m.workload_team;
 if(m.member_type==='freelance')return 'Freelancers';
 if(/production/i.test(m.role||''))return 'Production';
 return 'No team set';
}
export function workloadTeams(members){return [...new Set([...defaultWorkloadTeams,'Creative','No team set',...members.map(memberTeam)])].sort();}
export async function saveMemberTeam(client,member,next){
 const {data,error}=await client.rpc('set_dashboard_member_team',{target_id:member.id,new_team:next||null,expected_team:member.workload_team||null});
 if(error||data?.id!==member.id||(data.workload_team||null)!==(next||null))throw Error('Team not confirmed');
 return data;
}
export function projectMatchesTeams(project,projects,items,members,teams){
 if(teams===null)return true;
 const mm=Object.fromEntries(members.map(m=>[m.id,m]));
 const matches=id=>mm[id]&&teams.includes(memberTeam(mm[id]));
 const scope=new Set([project.id]);let changed=true;
 while(changed){changed=false;for(const p of Object.values(projects))if(scope.has(p.parent_id)&&!scope.has(p.id)){scope.add(p.id);changed=true;}}
 return [...scope].some(id=>matches(projects[id]?.owner_id))||items.some(i=>scope.has(i.project_id)&&[i.owner_id,...(i.co_owner_ids||[])].some(matches));
}
