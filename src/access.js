// Presentation follows the server profile. Database policies remain the access gate.
export function accessProfile(value) {
 if (!value || !['team','freelancer'].includes(value.role)) throw new Error('Invalid access profile');
 return {role:value.role,team_member_id:value.team_member_id||null,display_name:value.display_name||null};
}
export const isFreelancer = profile => profile?.role==='freelancer';
export const canCompleteItem = (profile,item) => !isFreelancer(profile)||Boolean(profile.team_member_id&&profile.team_member_id===item.owner_id);
export function workloadCounts(items,projects,projectIsDone,today) {
 const open=items.filter(i=>i.status!=='done'&&!projectIsDone(projects[i.project_id],projects));
 return {open:open.length,inProgress:open.filter(i=>i.status==='in_progress').length,past:open.filter(i=>i.due_date&&i.due_date<today).length,due:open.filter(i=>i.due_date===today).length};
}

// Display identity only. Server policies remain the authority for data and writes.
export function signedInIdentity(user,profile,members=[]){
 const email=String(user?.email||'').trim().toLowerCase();
 const matches=email?members.filter(m=>String(m.email||'').trim().toLowerCase()===email):[];
 const matched=matches.length===1?matches[0]:null;
 const linked=members.find(m=>m.id===profile?.team_member_id);
 // Duplicate email mappings are ambiguous, never silently pick the first row.
 const member=matched||(matches.length===0?linked:null);
 const metadata=user?.user_metadata||{};
 const displayName=member?.name||profile?.display_name||metadata.display_name||metadata.full_name||metadata.name||null;
 return {team_member_id:member?.id||null,display_name:displayName};
}
