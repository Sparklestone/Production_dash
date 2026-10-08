export const stepStatusOptions = [{value:'pending',label:'Planned'},{value:'in_progress',label:'In progress'},{value:'blocked',label:'Blocked'},{value:'done',label:'Done'}];
export const statusChoice = status => ['not_started','planned'].includes(status)?'pending':status==='active'?'in_progress':status;
export async function saveStepStatus(client,item,next){
 if(!stepStatusOptions.some(o=>o.value===next))throw Error('Invalid status');
 const {data,error}=await client.rpc('set_dashboard_step_status',{target_schedule_item_id:item.id,new_status:next,expected_status:item.status});
 if(error||data?.id!==item.id||data?.status!==next)throw Error('Status not confirmed');
 return data;
}
