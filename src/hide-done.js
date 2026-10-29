// A reversible view filter, never a status change or database deletion.
export function visibleCards(rows,hideDone=false){return hideDone?rows.filter(row=>row.status!=='done'):rows;}

// Keep a project when any recorded step in its branch is unfinished. Empty
// active projects remain discoverable; completed parents cannot hide open children.
export function visibleProjects(rows,projects,steps,hideDone=false){
 if(!hideDone)return rows;
 const children=new Map(),byProject=new Map();
 Object.values(projects).forEach(p=>{const ids=children.get(p.parent_id)||[];ids.push(p.id);children.set(p.parent_id,ids);});
 steps.forEach(s=>{const items=byProject.get(s.project_id)||[];items.push(s);byProject.set(s.project_id,items);});
 return rows.filter(p=>{const seen=new Set(),items=[];function visit(id){if(seen.has(id))return;seen.add(id);items.push(...(byProject.get(id)||[]));(children.get(id)||[]).forEach(visit);}visit(p.id);return items.length?items.some(s=>s.status!=='done'):p.status!=='done';});
}
