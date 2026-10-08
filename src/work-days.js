export function validWorkDays(value){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=260?n:null;}
export async function saveWorkDays(client,item,value){const days=validWorkDays(value);if(days===null)throw Error('Choose 1 to 260 work days');const {data,error}=await client.rpc('set_dashboard_work_days',{target_id:item.id,days,expected_days:item.work_days_needed||null});if(error||data?.id!==item.id||data?.work_days_needed!==days)throw Error('Days not confirmed');return data;}
export const suggestedDateLabel = item => item.due_date_suggested?'Suggested ':'';
