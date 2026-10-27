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

// Workstreams are displayed exactly one level under the root project.
export function displayProjectPath(project,projects){const path=projectPath(project,projects);return path.length>2?[path[0],path.at(-1)]:path;}

// Brand for a card: the project's own client, else the root project's client.
export function brandClient(project,projects,clients){
 const root=projectPath(project,projects)[0]||project;
 return clients?.[project.client_id]||clients?.[root?.client_id]||null;
}

// Card breadcrumb: brand plus project path, dropping a root that repeats the brand.
export function breadcrumbParts(project,projects,clients){
 const brand=brandClient(project,projects,clients);
 let path=displayProjectPath(project,projects);
 if(brand&&path.length){const rootName=String(path[0].name||'').toLowerCase();if(rootName===String(brand.name||'').toLowerCase()||brand.aka&&rootName===String(brand.aka).toLowerCase())path=path.slice(1);}
 return {brand,path};
}

// One flat listing of every project: each root followed by its descendants (tree order),
// then any orphans whose parent is missing. Projects and workstreams are the same level.
export function flattenedListings(projects){
 const byParent={};Object.values(projects).forEach(p=>{(byParent[p.parent_id||'']=byParent[p.parent_id||'']||[]).push(p);});
 const result=[],seen=new Set();
 function visit(p){if(!p||seen.has(p.id))return;seen.add(p.id);result.push(p);(byParent[p.id]||[]).forEach(visit);}
 (byParent['']||[]).forEach(visit);
 Object.values(projects).forEach(visit);
 return result;
}

// Effective client: the project's own client, else its root project's.
export function effectiveClientId(project,projects){return project.client_id||projectPath(project,projects)[0]?.client_id||null;}
