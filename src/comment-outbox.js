// Only explicit Send submissions enter the outbox. Storage is device-local and account-scoped.
export function readOutbox(storage,user){try{return JSON.parse(storage.getItem('production-comment-outbox:'+user)||'[]').filter(x=>x.user===user&&x.id&&x.note);}catch{return [];}}
export function saveOutbox(storage,user,rows){storage.setItem('production-comment-outbox:'+user,JSON.stringify(rows));}
export async function deliverComment(client,row,isCurrent=()=>true){
 const read=async()=>{const {data,error}=await client.from('dashboard_comments').select('id,created_at').eq('id',row.id).maybeSingle();if(error)throw Error('Cannot verify delivery');return data;};
 const existing=await read();if(existing)return existing;if(!isCurrent())throw Error('Account changed');
 const {data,error}=await client.from('dashboard_comments').insert({id:row.id,project_id:row.project_id,schedule_item_id:row.schedule_item_id||null,author_name:row.author_name,note:row.note}).select('id,created_at').single();
 if(!error&&data?.id)return data;
 // A lost response or unique violation may mean the first write succeeded.
 const receipt=await read();if(receipt)return receipt;
 throw Error('Not sent yet');
}
