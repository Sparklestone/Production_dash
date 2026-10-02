import {createClient} from '@supabase/supabase-js';
import {timingSafeEqual} from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).end('Method not allowed');
  if(!equal(req.headers['x-comment-secret'],process.env.COMMENT_PUSH_SECRET))return res.status(401).end('Unauthorized');
  let body=req.body; if(typeof body==='string'){try{body=JSON.parse(body);}catch{return res.status(400).end('Bad JSON');}}
  const id=body?.comment_id;
  if(typeof id!=='string'||!uuid.test(id))return res.status(400).end('Bad comment ID');
  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,BREVO_API_KEY}=process.env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!BREVO_API_KEY)return res.status(503).end('Not configured');
  const db=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:comment,error:lookup}=await db.from('dashboard_comments').select('id').eq('id',id).maybeSingle();
  if(lookup)return res.status(503).end('Lookup failed');
  if(!comment)return res.status(404).end('Not found');
  const {error:claim}=await db.from('dashboard_comment_pushes').insert({comment_id:id,status:'sending'});
  if(claim?.code==='23505')return res.status(200).json({accepted:true,duplicate:true});
  if(claim)return res.status(503).end('Claim failed');
  try{
    const response=await fetch('https://api.brevo.com/v3/smtp/email',{
      method:'POST',headers:{'api-key':BREVO_API_KEY,'Content-Type':'application/json','accept':'application/json'},
      body:JSON.stringify({sender:{name:'Aaron Finkelstein',email:'finkelstein.aaron@gmail.com'},to:[{email:'d1fo1h@mail.instinct.com'}],subject:'New dashboard comment',textContent:`New comment: ${id}\nhttps://productiondash.vercel.app/`,headers:{'Idempotency-Key':id}}),signal:AbortSignal.timeout(10000)
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok){await db.from('dashboard_comment_pushes').update({status:'failed',http_status:response.status}).eq('comment_id',id);return res.status(502).end('Email rejected; durable inbox retained');}
    const {error:saved}=await db.from('dashboard_comment_pushes').update({status:'sent',provider_message_id:result.messageId??null,sent_at:new Date().toISOString()}).eq('comment_id',id);
    if(saved)return res.status(500).end('Email accepted; receipt save failed');
    return res.status(200).json({accepted:true});
  }catch{await db.from('dashboard_comment_pushes').update({status:'uncertain'}).eq('comment_id',id);return res.status(502).end('Delivery uncertain; durable inbox retained');}
}