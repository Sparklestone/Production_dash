import test from 'node:test';import assert from 'node:assert/strict';
import {ownerNames,projectCx} from '../src/step-assignment.js';
const mm={a:{name:'Aaron'},b:{name:'Pat'}};
test('owner names join primary and co-owners',()=>{assert.equal(ownerNames({owner_id:'a',co_owner_ids:['b']},mm,'x'),'Aaron & Pat');assert.equal(ownerNames({owner_id:null},mm,'No owner'),'No owner');});
test('project CX inherits from parent',()=>{const pm={r:{id:'r',cx:['Sara']},c:{id:'c',parent_id:'r',cx:[]}};assert.deepEqual(projectCx(pm.c,pm),['Sara']);});
