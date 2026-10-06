import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingRevisions,revisionTargets} from '../src/revisions.js';
const projects=[{id:'p'},{id:'s',parent_id:'p'},{id:'other'}];
test('only pending comments for visible projects, oldest first',()=>{
 assert.deepEqual(pendingRevisions([{id:'2',project_id:'s',created_at:'2026-10-06T18:00',reviewed_at:null},{id:'1',project_id:'p',created_at:'2026-10-06T17:00'},{id:'done',project_id:'p',reviewed_at:'now'},{id:'hidden',project_id:'secret'}],projects).map(x=>x.id),['1','2']);
});
test('step request marks step and containing project ancestors, not other steps',()=>{
 const t=revisionTargets([{project_id:'s',schedule_item_id:'step'}],projects);
 assert.deepEqual([...t.stepIds],['step']);assert.deepEqual([...t.projectIds],['s','p']);
});
test('project request marks project but does not invent affected steps',()=>{
 const t=revisionTargets([{project_id:'p',schedule_item_id:null}],projects);
 assert.equal(t.stepIds.size,0);assert.deepEqual([...t.projectIds],['p']);
});
test('cycles and deleted references do not invent cards',()=>{
 const t=revisionTargets([{project_id:'a',schedule_item_id:null}], [{id:'a',parent_id:'b'},{id:'b',parent_id:'a'}]);assert.equal(t.projectIds.size,2);
 assert.equal(revisionTargets([],projects).projectIds.size,0);
});
