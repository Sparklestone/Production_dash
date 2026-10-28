export function personDraft(values){
 const name=String(values.name||'').trim(),email=String(values.email||'').trim().toLowerCase(),team=String(values.team||'').trim(),type=values.member_type||'internal';
 if(!name||name.length>120)throw Error('Enter a name of 1-120 characters');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email or leave it blank');
 if(!['internal','freelance'].includes(type)||team.length>60)throw Error('Choose a valid type and team');
 return {name,email:email||null,workload_team:team||null,member_type:type};
}
export async function addPerson(client,values){const p=personDraft(values);const {data,error}=await client.rpc('add_dashboard_person',{person:p});if(error||!data?.id||data.name!==p.name)throw Error(error?.message||'Person not confirmed');return data;}

export async function renameRoster(client,kind,target,expected,name){name=name.trim();if(!['person','team'].includes(kind)||!target||!name||name.length>(kind==='team'?60:120))throw Error('Enter a valid name');const {data,error}=await client.rpc('rename_dashboard_roster',{kind,target,expected,new_name:name});if(error||data?.name!==name||!data?.ok)throw Error(error?.message||'Rename not confirmed');return data;}
