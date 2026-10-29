import {test} from 'node:test';import assert from 'node:assert/strict';
import {visibleCards} from '../src/hide-done.js';
test('unchecked preserves all cards and order',()=>{const rows=[{id:'a',status:'done'},{id:'b',status:'pending'}];assert.equal(visibleCards(rows),rows);});
test('checked hides only explicitly done cards, without mutating rows',()=>{const rows=[{id:'a',status:'done'},{id:'b',status:'in_progress'},{id:'c',status:'pending'},{id:'d',status:'waiting'},{id:'e'}];const before=JSON.stringify(rows);assert.deepEqual(visibleCards(rows,true).map(r=>r.id),['b','c','d','e']);assert.equal(JSON.stringify(rows),before);assert.equal(visibleCards(rows,false).length,5);});

import {visibleProjects} from '../src/hide-done.js';
test('Clients hide done removes all-done branches regardless of active project status',()=>{
 const rows=[{id:'root',status:'active'},{id:'child',parent_id:'root',status:'active'},{id:'other',status:'active'}],pm=Object.fromEntries(rows.map(p=>[p.id,p]));
 const steps=[{project_id:'root',status:'done'},{project_id:'child',status:'done'},{project_id:'other',status:'pending'}];
 const before=JSON.stringify({rows,steps});assert.deepEqual(visibleProjects(rows,pm,steps,true).map(p=>p.id),['other']);assert.equal(JSON.stringify({rows,steps}),before);assert.equal(visibleProjects(rows,pm,steps,false),rows);
});
test('Nested unfinished work retains ancestors, including done parent; done siblings disappear',()=>{
 const rows=[{id:'a',status:'done'},{id:'b',parent_id:'a',status:'active'},{id:'c',parent_id:'b',status:'active'},{id:'d',parent_id:'a',status:'active'}],pm=Object.fromEntries(rows.map(p=>[p.id,p]));
 assert.deepEqual(visibleProjects(rows,pm,[{project_id:'c',status:'blocked'},{project_id:'d',status:'done'}],true).map(p=>p.id),['a','b','c']);
});
test('Empty active projects remain, empty done projects hide; cycles terminate',()=>{
 const rows=[{id:'empty',status:'active'},{id:'done',status:'done'},{id:'a',parent_id:'b'},{id:'b',parent_id:'a'}],pm=Object.fromEntries(rows.map(p=>[p.id,p]));assert.deepEqual(visibleProjects(rows,pm,[],true).map(p=>p.id),['empty','a','b']);
});
