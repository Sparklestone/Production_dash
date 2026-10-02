import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, groupAssignments, projectIsDone, clientMilestone, milestoneKind, isWeekend, monthCells, shiftMonth, nextMilestone, timelineSteps, timelineStepState } from '../src/schedule.js';
test('calendar keeps date-only values stable and handles leap years',()=>{
 assert.equal(dateKey('2026-10-05T00:00:00Z'),'2026-10-05');
 assert.equal(dateKey(null),null);
 assert.equal(monthCells('2024-02').filter(Boolean).length,21);
 assert.equal(monthCells('2026-10').indexOf('2026-10-01'),3);
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

test('client review and release have distinct classes',()=>{
 for(const title of ['Client review meeting','Meeting with the client','Client presentation'])assert.equal(milestoneKind({title}),'review');
 for(const title of ['Release','Send final files to client','Client delivery','Release approved files'])assert.equal(milestoneKind({title}),'release');
 assert.equal(milestoneKind({title:'Client review',milestone_type:'client_delivery'}),'release');
});
test('weekday grid excludes weekends and aligns months that start on a weekend',()=>{
 assert.equal(isWeekend('2026-10-03'),true);
 assert.equal(isWeekend('2026-10-05'),false);
 assert.equal(monthCells('2026-08')[0],'2026-08-03');
 for(const month of ['2026-10','2026-11','2026-08'])assert.ok(monthCells(month).filter(Boolean).every(key=>!isWeekend(key)));
});

test('approval milestones are reviews unless explicit metadata says otherwise',()=>{
 for(const title of ['Client approval','Vehicle deck final approval','Approval'])assert.equal(milestoneKind({title}),'review',title);
 assert.equal(milestoneKind({title:'Client approval',milestone_type:'internal'}),null);
 assert.equal(milestoneKind({title:'Approval',milestone_type:'client_delivery'}),'release');
});


test('next milestone badge selects dated open descendant milestones, not unrelated or completed work',()=>{
 const projects={p:{id:'p'},s:{id:'s',parent_id:'p'},x:{id:'x'}};
 const items=[{id:'normal',project_id:'p',title:'Internal proof',due_date:'2026-10-02'},
 {id:'past',project_id:'p',title:'Client review',due_date:'2026-09-30'},
 {id:'done',project_id:'p',title:'Client approval',due_date:'2026-10-02',status:'done'},
 {id:'other',project_id:'x',title:'Release',due_date:'2026-10-02'},
 {id:'undated',project_id:'p',title:'Release'},
 {id:'release',project_id:'p',title:'Release',due_date:'2026-10-07'},
 {id:'review',project_id:'s',title:'Client approval',due_date:'2026-10-05'}];
 assert.equal(nextMilestone(projects.p,items,projects,'2026-10-02').id,'review');
 projects.s.status='done';assert.equal(nextMilestone(projects.p,items,projects,'2026-10-02').id,'release');
 projects.p.status='done';assert.equal(nextMilestone(projects.p,items,projects,'2026-10-02'),null);
});


test('timeline shows all steps in date order with undated last and descendant rollups',()=>{
 const projects={p:{id:'p'},s:{id:'s',parent_id:'p'},x:{id:'x'}};
 const items=[{id:'u',project_id:'p',title:'Undated'}, {id:'r',project_id:'s',title:'Client review',due_date:'2026-10-05'},
 {id:'d',project_id:'p',title:'Release',due_date:'2026-10-01',status:'done'},
 {id:'c',project_id:'p',title:'Build',due_date:'2026-10-02',status:'in_progress'}, {id:'x',project_id:'x',title:'Other'}];
 assert.deepEqual(timelineSteps(projects.p,items,projects).map(i=>i.id),['d','c','r','u']);
 assert.deepEqual(timelineSteps(projects.s,items,projects).map(i=>i.id),['r']);
 assert.equal(timelineStepState(items[2]),'done');assert.equal(timelineStepState(items[3]),'current');
 assert.equal(timelineStepState(items[1]),'review');assert.equal(timelineStepState({title:'Release'}),'release');
 assert.equal(timelineStepState({title:'Internal'}),'upcoming');
 assert.equal(timelineStepState({title:'Client review',status:'in_progress'}),'current');
 assert.deepEqual(timelineSteps(projects.x,[],projects),[]);
});
