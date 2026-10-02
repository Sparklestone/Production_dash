import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, groupAssignments, projectIsDone, clientMilestone, monthCells, shiftMonth } from '../src/schedule.js';
test('calendar keeps date-only values stable and handles leap years',()=>{
 assert.equal(dateKey('2026-10-05T00:00:00Z'),'2026-10-05');
 assert.equal(dateKey(null),null);
 assert.equal(monthCells('2024-02').filter(Boolean).length,29);
 assert.equal(monthCells('2026-10').indexOf('2026-10-01'),4);
 assert.equal(shiftMonth('2026-12',1),'2027-01');
 assert.equal(shiftMonth('2026-01',-1),'2025-12');
});
test('assignments group descendants under the root without losing siblings',()=>{
 const projects={p:{id:'p'},s:{id:'s',parent_id:'p'},n:{id:'n',parent_id:'s'}};
 const items=[{project_id:'p'},{project_id:'s'},{project_id:'n'},{project_id:'s'}];
 const groups=groupAssignments(items,projects);
 assert.equal(groups.length,1);assert.equal(groups[0].count,4);assert.equal(groups[0].branches.size,3);
 projects.p.status='done';assert.equal(projectIsDone(projects.n,projects),true);
});
test('client milestone metadata wins; title fallback avoids background notes',()=>{
 for(const title of ['Client review meeting','Send final files to client','Meeting with the client','Files to client'])assert.equal(clientMilestone({title}),true,title);
 assert.equal(clientMilestone({title:'Internal proof review',notes:'Client meeting next week'}),false);
 assert.equal(clientMilestone({title:'Internal proof review',milestone_type:'client_delivery'}),true);
 assert.equal(clientMilestone({title:'Client meeting',milestone_type:'internal'}),false);
});
