import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accessProfile,isFreelancer,canCompleteItem,workloadCounts,signedInIdentity} from '../src/access.js';
import {projectIsDone} from '../src/schedule.js';
test('role profile fails closed on invalid roles',()=>{assert.throws(()=>accessProfile(null));assert.throws(()=>accessProfile({role:'admin'}));assert.equal(accessProfile({role:'team'}).role,'team');});
test('freelancers complete only their own assigned steps',()=>{const p={role:'freelancer',team_member_id:'me'};assert.equal(isFreelancer(p),true);assert.equal(canCompleteItem(p,{owner_id:'other'}),false);assert.equal(canCompleteItem(p,{owner_id:'me'}),true);assert.equal(canCompleteItem({role:'freelancer'},{owner_id:null}),false);});
test('workload excludes done items and completed project descendants',()=>{const projects={p:{id:'p',status:'active'},done:{id:'done',status:'done'},child:{id:'child',parent_id:'done',status:'active'}};const items=[{project_id:'p',status:'in_progress',due_date:'2026-10-04'},{project_id:'p',status:'pending',due_date:'2026-10-05'},{project_id:'p',status:'done'},{project_id:'child',status:'pending'}];assert.deepEqual(workloadCounts(items,projects,projectIsDone,'2026-10-05'),{open:2,inProgress:1,past:1,due:1});});

const members=[{id:'aaron',name:'Aaron Finkelstein',email:'aaron@example.invalid'},{id:'pat',name:'Pat',email:'pat@example.invalid'}];
test('signed-in email wins over stale Aaron profile for greeting and own work',()=>{assert.deepEqual(signedInIdentity({email:' PAT@example.invalid '},{team_member_id:'aaron',display_name:'Aaron'},members),{team_member_id:'pat',display_name:'Pat'});});
test('known account needs no profile mapping to show its own assignments',()=>{assert.equal(signedInIdentity({email:'pat@example.invalid'},null,members).team_member_id,'pat');});
test('unknown account never defaults to Aaron',()=>{assert.deepEqual(signedInIdentity({email:'other@example.invalid'},null,members),{team_member_id:null,display_name:null});});
test('explicit profile and metadata are fallback identity only',()=>{assert.equal(signedInIdentity({email:'unmapped@example.invalid'},{team_member_id:'pat'},members).display_name,'Pat');assert.equal(signedInIdentity({user_metadata:{display_name:'Taylor'}},null,members).display_name,'Taylor');});
test('duplicate email mapping fails closed instead of first-row selection',()=>{assert.equal(signedInIdentity({email:'pat@example.invalid'},{team_member_id:'aaron'},[...members,{id:'duplicate',name:'Other Pat',email:'pat@example.invalid'}]).team_member_id,null);});
