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
