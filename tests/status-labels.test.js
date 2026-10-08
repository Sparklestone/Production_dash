import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {statusLabel} from '../src/status-labels.js';
import {workloadCounts} from '../src/access.js';
test('all not-started variants share Planned display label',()=>{
 for(const value of ['not_started','pending','planned'])assert.equal(statusLabel(value),'Planned');
 assert.equal(statusLabel('in_progress'),'In progress');assert.equal(statusLabel('done'),'Done');
 assert.equal(statusLabel('blocked'),'Blocked');assert.equal(statusLabel('waiting'),'Waiting');
});
test('label cleanup keeps counters based on recorded values',()=>{
 const items=['not_started','pending','planned','in_progress','done'].map(status=>({status,project_id:'p'}));
 assert.deepEqual(workloadCounts(items,{p:{}},()=>false,'2026-10-07'),{open:4,inProgress:1,past:0,due:0});
 assert.deepEqual(items.map(i=>i.status),['not_started','pending','planned','in_progress','done']);
});
test('all ordinary task/project/calendar labels use shared mapping',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/const label = statusLabel;/);assert.doesNotMatch(source,/Not started/);
 assert.match(source,/text:'Planned',kind:'pending'/);
});
