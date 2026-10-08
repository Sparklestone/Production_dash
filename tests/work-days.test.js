import test from 'node:test';import assert from 'node:assert/strict';import {validWorkDays,saveWorkDays,suggestedDateLabel} from '../src/work-days.js';
test('days are positive bounded integers',()=>{for(const v of ['',0,-1,1.5,261,'x'])assert.equal(validWorkDays(v),null);assert.equal(validWorkDays('5'),5);});
test('saving effort never sends dates or status',async()=>{let p;await saveWorkDays({rpc:async(n,args)=>{p=args;return {data:{id:'s',work_days_needed:3}};}},{id:'s',work_days_needed:2,due_date:'2026-11-01'},3);assert.deepEqual(p,{target_id:'s',days:3,expected_days:2});});
test('suggested date label is explicit metadata only',()=>{assert.equal(suggestedDateLabel({due_date_suggested:true}),'Suggested ');assert.equal(suggestedDateLabel({due_date:'2026-10-10'}),'');});
