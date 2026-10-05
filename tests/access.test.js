import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accessProfile,isFreelancer,canCompleteItem,workloadCounts} from '../src/access.js';
import {projectIsDone} from '../src/schedule.js';
test('role profile fails closed on invalid roles',()=>{assert.throws(()=>accessProfile(null));assert.throws(()=>accessProfile({role:'admin'}));assert.equal(accessProfile({role:'team'}).role,'team');});
test('freelancers complete only their own assigned steps',()=>{const p={role:'freelancer',team_member_id:'me'};assert.equal(isFreelancer(p),true);assert.equal(canCompleteItem(p,{owner_id:'other'}),false);assert.equal(canCompleteItem(p,{owner_id:'me'}),true);assert.equal(canCompleteItem({role:'freelancer'},{owner_id:null}),false);});
test('workload excludes done items and completed project descendants',()=>{const projects={p:{id:'p',status:'active'},done:{id:'done',status:'done'},child:{id:'child',parent_id:'done',status:'active'}};const items=[{project_id:'p',status:'in_progress',due_date:'2026-10-04'},{project_id:'p',status:'pending',due_date:'2026-10-05'},{project_id:'p',status:'done'},{project_id:'child',status:'pending'}];assert.deepEqual(workloadCounts(items,projects,projectIsDone,'2026-10-05'),{open:2,inProgress:1,past:1,due:1});});
