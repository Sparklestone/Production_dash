import test from 'node:test';import assert from 'node:assert/strict';import {saveStepOwner} from '../src/step-assignment.js';
test('assignment-only stale protected save supports unassigned',async()=>{let sent;await saveStepOwner({rpc:async(n,a)=>{sent=a;return {data:{id:'a',owner_id:null}};}},{id:'a',owner_id:'m'},'');assert.deepEqual(sent,{target_id:'a',new_owner:null,expected_owner:'m'});});
test('unconfirmed assignment does not pass',async()=>{await assert.rejects(()=>saveStepOwner({rpc:async()=>({data:{id:'wrong',owner_id:'m'}})},{id:'a'},'m'));});
