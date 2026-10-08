// Keep hierarchy explicit without changing project records.
export function projectPath(project,projects){
 const path=[],seen=new Set();let current=project;
 while(current&&!seen.has(current.id)){seen.add(current.id);path.unshift(current);current=projects[current.parent_id];}
 return path;
}
export function workstreamLabel(project,projects){
 const parent=projects[project.parent_id];let name=String(project.name||'');
 if(parent){const candidates=[parent.name,projectPath(parent,projects)[0]?.name].filter(Boolean).sort((a,b)=>b.length-a.length);for(const prefix of candidates){if(name.toLowerCase().startsWith(prefix.toLowerCase())){const rest=name.slice(prefix.length).replace(/^\s*[-:>/]\s*|^\s+/,'').trim();if(rest)name=rest;break;}}}
 return name;
}
export function flatProjectBranches(project,projects,hideDone=false){
 const result=[],seen=new Set();function visit(p,depth){if(!p||seen.has(p.id)||(hideDone&&p.status==='done'))return;seen.add(p.id);result.push({project:p,depth});Object.values(projects).filter(c=>c.parent_id===p.id).forEach(c=>visit(c,depth+1));}visit(project,0);return result;
}
