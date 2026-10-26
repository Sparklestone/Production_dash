import test from 'node:test';import assert from 'node:assert/strict';
import {ownerNames,projectCx} from '../src/step-assignment.js';
const mm={a:{name:'Aaron'},b:{name:'Pat'}};
test('owner names join primary and co-owners',()=>{assert.equal(ownerNames({owner_id:'a',co_owner_ids:['b']},mm,'x'),'Aaron & Pat');assert.equal(ownerNames({owner_id:null},mm,'No owner'),'No owner');});
test('project CX inherits from parent',()=>{const pm={r:{id:'r',cx:['Sara']},c:{id:'c',parent_id:'r',cx:[]}};assert.deepEqual(projectCx(pm.c,pm),['Sara']);});

import {saveStepOwner} from '../src/step-assignment.js';
test('owner save uses expected owner, preserves co-owners and rejects unconfirmed writes',async()=>{const item={id:'x',owner_id:'a',co_owner_ids:['b']};const before=JSON.stringify(item);let args;await saveStepOwner({rpc:async(n,a)=>{args=a;return {data:{id:'x',owner_id:'c'}};}},item,'c');assert.equal(args.expected_owner,'a');assert.equal(JSON.stringify(item),before);await assert.rejects(()=>saveStepOwner({rpc:async()=>({error:'fail'})},item,'c'));await assert.rejects(()=>saveStepOwner({rpc:async()=>({data:{id:'x',owner_id:'z'}})},item,'c'));});
