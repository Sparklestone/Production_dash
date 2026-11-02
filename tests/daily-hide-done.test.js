import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dailyStatus,statusOutline,statusOutlineHtml} from '../src/daily-status.js';
const now=new Date('2026-11-02T23:45:00Z'),today='2026-11-02';
const projects={p:{id:'p',name:'Open branch',client_id:'c',status:'active'},q:{id:'q',name:'Finished branch',client_id:'c',status:'active'},r:{id:'r',name:'All finished',client_id:'d',status:'done'},e:{id:'e',name:'Empty active',client_id:'e',status:'active'},parent:{id:'parent',name:'Completed parent',client_id:'f',status:'done'},child:{id:'child',parent_id:'parent',name:'Open child',client_id:'f',status:'active'}};
const clients=['c','d','e','f'].map(id=>({id,name:id}));
const items=[['open','p','pending'],['done','p','done'],['finished','q','done'],['all-done','r','done'],['child-open','child','blocked']].map(([id,project_id,status])=>({id,title:id,project_id,status,due_date:today,updated_at:'2026-11-02T23:00:00Z'}));
const updates=Object.keys(projects).map(project_id=>({project_id,created_at:'2026-11-02T23:00:00Z',note:'[Daily] note '+project_id}));
const data={items,updates,projects,clients,today,now};
test('Daily hide done removes finished steps and finished-only project/client branches globally, preserving open and empty active context',()=>{
 const before=JSON.stringify(data),r=dailyStatus({...data,hideDone:true});
 assert.deepEqual(r.brands.map(b=>b.key),['c','e','f']);
 assert.deepEqual(r.brands.flatMap(b=>b.changed.map(n=>n.project.id)),['p','e','parent','child']);
 assert.equal(r.totals.rdone,0);assert.equal(r.totals.changed,4);
 assert.deepEqual(r.brands.flatMap(b=>b.urgent.map(n=>n.item.id)),['open']);
 assert.equal(JSON.stringify(data),before,'view filter must not mutate source records');
 const text=statusOutline(r,{projects});assert.ok(!text.includes('finished'));assert.ok(!statusOutlineHtml(r,{projects}).includes('finished'));
 const restored=dailyStatus(data);assert.equal(restored.totals.rdone,3);assert.ok(statusOutline(restored,{projects}).includes('finished'));
});
test('Daily repeated controls share one state, invalidate model cache and are independent of Clients filter',()=>{
 const js=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(js,/dailyHideDoneControl\(b.key\)\}\$\{b.project_id/);assert.match(js,/dailyHideDoneControl\('summary'\)/);
 assert.match(js,/Math.floor\(Date.now\(\)\/60000\),state.dailyHideDone/);
 assert.match(js,/state.dailyHideDone=e.target.checked;render\(\)/);
 assert.match(js,/querySelectorAll\('\[data-daily-hide-done\]'\)/);
 assert.match(js,/target.focus\(\{preventScroll:true\}\)/);
});
