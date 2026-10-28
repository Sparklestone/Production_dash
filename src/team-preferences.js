export function teamDefaults(user,scope,fallback){
 const saved=user?.user_metadata?.dashboard_team_defaults?.[scope];
 if(saved===null&&['clients','schedule'].includes(scope))return null;
 return Array.isArray(saved)&&saved.every(t=>typeof t==='string'&&t.length<=60)?[...saved]:fallback===null?null:[...fallback];
}
export async function saveTeamDefault(auth,user,scope,teams){
 if(!user?.id||!['clients','workload','schedule'].includes(scope)||!(teams===null&&['clients','schedule'].includes(scope))&&(!Array.isArray(teams)||teams.some(t=>typeof t!=='string'||t.length>60)))throw Error('Invalid default');
 const value={...(user.user_metadata?.dashboard_team_defaults||{}),[scope]:teams};
 const {data,error}=await auth.updateUser({data:{dashboard_team_defaults:value}});
 if(error||data?.user?.id!==user.id||JSON.stringify(data.user.user_metadata?.dashboard_team_defaults?.[scope])!==JSON.stringify(teams))throw Error('Default not confirmed');
 return data.user;
}
export async function addWorkloadTeam(client,name){
 name=name.trim();if(!name||name.length>60||name==='No team set')throw Error('Use a team name of 1-60 characters');
 const {data,error}=await client.from('workload_teams').upsert({name},{onConflict:'name'}).select('name').single();
 if(error||data?.name!==name)throw Error('Team not confirmed');return data.name;
}
