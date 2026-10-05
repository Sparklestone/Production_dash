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
