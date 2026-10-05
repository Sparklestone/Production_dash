// Provenance links only. A project-level source is never presented as a step source.
export function sourceLinks(project,item,links=[]){
 const candidates=links.filter(l=>l.project_id===project?.id&&(!l.schedule_item_id||l.schedule_item_id===item?.id));
 return candidates.flatMap(l=>{
  let url;try{url=new URL(l.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return [];}catch{return [];}
  const host=url.hostname.toLowerCase();
  const kind=l.kind==='teams'?'teams':(/^email\s*:/i.test(l.label||'')||['outlook.office.com','outlook.office365.com','outlook.live.com','mail.google.com'].includes(host))?'email':null;
  if(!kind)return [];
  return [{url:url.href,kind,label:l.label||'',scope:l.schedule_item_id?'step':'project'}];
 }).filter((l,n,a)=>a.findIndex(x=>x.url===l.url)===n).sort((a,b)=>(a.scope==='step'?0:1)-(b.scope==='step'?0:1));
}
