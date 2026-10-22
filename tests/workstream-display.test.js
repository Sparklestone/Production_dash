import test from 'node:test';import assert from 'node:assert/strict';import {projectPath,workstreamLabel,flatProjectBranches,brandClient} from '../src/workstream-display.js';
const projects={p:{id:'p',name:'Ametros',status:'active'},c:{id:'c',name:'Ametros - Collateral',parent_id:'p'},g:{id:'g',name:'Print files',parent_id:'c'},d:{id:'d',name:'Done',parent_id:'p',status:'done'}};
test('breadcrumb preserves exact hierarchy, with concise child names',()=>{assert.deepEqual(projectPath(projects.g,projects).map(x=>x.id),['p','c','g']);assert.equal(workstreamLabel(projects.c,projects),'Collateral');assert.equal(workstreamLabel(projects.g,projects),'Print files');});
test('workstreams are flat siblings, not nested duplicate card shells',()=>{assert.deepEqual(flatProjectBranches(projects.p,projects,true).map(x=>[x.project.id,x.depth]),[['p',0],['c',1],['g',2]]);});
test('cycles stop and stored names remain untouched',()=>{const p={id:'x',name:'X',parent_id:'x'};assert.equal(projectPath(p,{x:p}).length,1);assert.equal(flatProjectBranches(p,{x:p}).length,1);assert.equal(projects.c.name,'Ametros - Collateral');});
test('card breadcrumb names the brand from the project or root client',()=>{
 const clients={bill:{id:'bill',name:'Billings (One Sky)'}};
 assert.equal(brandClient({id:'a',name:'Activation',client_id:'bill'},projects,clients).name,'Billings (One Sky)');
 const root={id:'r',name:'Logo Suite',client_id:'bill'},child={id:'w',name:'Color',parent_id:'r'};
 const pm={r:root,w:child};
 assert.equal(brandClient(child,pm,clients).name,'Billings (One Sky)');
 assert.equal(brandClient({id:'n',name:'Internal'},projects,clients),null);
});
