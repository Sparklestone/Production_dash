import test from 'node:test';import assert from 'node:assert/strict';
import {combineOptions,combinePlan,executeCombine} from '../src/bulk-actions.js';

const projects={a:{id:'a',name:'Alpha'},b:{id:'b',name:'Beta'}};
// fixture: Alpha has open+done steps, Beta has open steps - mirrors real mixed-status data
const items=[
 {id:'a1',project_id:'a',status:'pending',start_date:'2026-10-20',due_date:'2026-10-28'},
 {id:'a2',project_id:'a',status:'done',start_date:null,due_date:'2026-10-21'},
 {id:'b1',project_id:'b',status:'in_progress',start_date:'2026-10-22',due_date:'2026-10-29'},
 {id:'b2',project_id:'b',status:'pending',start_date:null,due_date:null},
 {id:'b3',project_id:'b',status:'done',start_date:'2026-10-01',due_date:'2026-10-10'},
 {id:'x1',project_id:'x',status:'pending'} // unrelated workstream - must never move
];
const stub=capture=>({rpc:async(name,args)=>{capture.push({name,args});return {data:{ok:true,count:args.payload.items.length,target_id:args.payload.target_id}};}});

test('combine options offer both destination choices with accurate counts',()=>{
 const opts=combineOptions(['a','b'],projects,items);
 assert.equal(opts.length,2);
 assert.deepEqual([opts[0].keep.id,opts[0].source.id,opts[0].keepCount,opts[0].gainCount],['a','b',2,3]);
 assert.deepEqual([opts[1].keep.id,opts[1].source.id,opts[1].keepCount,opts[1].gainCount],['b','a',3,2]);
 assert.equal(combineOptions(['a'],projects,items),null);
 assert.equal(combineOptions(['a','missing'],projects,items),null);
});

test('plan resolves either destination choice and includes every open and done step of the source',()=>{
 const keepA=combinePlan(['a','b'],'a',projects,items);
 assert.deepEqual(keepA.items.map(i=>i.id).sort(),['b1','b2','b3']); // open AND done
 assert.ok(keepA.items.some(i=>i.status==='done')&&keepA.items.some(i=>i.status!=='done'));
 const keepB=combinePlan(['a','b'],'b',projects,items);
 assert.deepEqual(keepB.items.map(i=>i.id).sort(),['a1','a2']);
 assert.equal(combinePlan(['a','b'],'x',projects,items),null); // not one of the pair
});

test('submission moves only the source steps into the keep target, with snapshots for stale-check',async()=>{
 const calls=[];const plan=combinePlan(['a','b'],'a',projects,items);
 const res=await executeCombine(stub(calls),plan,'Aaron Finkelstein');
 assert.equal(calls.length,1); // single atomic RPC payload - all-or-nothing server transaction
 const p=calls[0].args.payload;
 assert.equal(calls[0].name,'apply_dashboard_bulk');
 assert.equal(p.action,'move');
 assert.equal(p.target_id,'a');
 assert.equal(p.author_name,'Aaron Finkelstein');
 assert.deepEqual(p.items.map(i=>i.id).sort(),['b1','b2','b3']);
 assert.ok(!p.items.some(i=>i.id==='a1'||i.id==='x1')); // keep-side and unrelated steps untouched
 assert.deepEqual(p.items.find(i=>i.id==='b3'),{id:'b3',project_id:'b',status:'done',start_date:'2026-10-01',due_date:'2026-10-10'}); // done step keeps status+dates in snapshot
 assert.equal(res.target_id,'a');
});

test('failure surfaces the server message and writes nothing further',async()=>{
 const plan=combinePlan(['a','b'],'a',projects,items);
 await assert.rejects(executeCombine({rpc:async()=>({error:{message:'Step changed. Refresh before applying.'}})},plan,'A'),/Step changed/);
 await assert.rejects(executeCombine({rpc:async()=>({data:{ok:false}})},plan,'A'),/Changes not confirmed/);
 // server side (supabase/005-bulk-actions.sql) runs in one transaction: any raised error rolls the whole move back - no partial writes possible
});

test('empty source stays unavailable before any RPC call',()=>{
 const few={a:{id:'a',name:'Alpha'},b:{id:'b',name:'Beta'}};
 const empty=combinePlan(['a','b'],'a',few,[{id:'a1',project_id:'a',status:'pending'},{id:'a2',project_id:'a',status:'pending'}]);
 assert.equal(empty.items.length,0); // handler shows "no steps to move", no RPC
});

test('single-step source combines (server migration 013 allows 1-100 with explicit target)',async()=>{
 const few={a:{id:'a',name:'Alpha'},b:{id:'b',name:'Beta'}};
 const one=combinePlan(['a','b'],'a',few,[{id:'b1',project_id:'b',status:'pending',due_date:'2026-10-30'},{id:'a1',project_id:'a',status:'pending'}]);
 assert.equal(one.items.length,1);
 const calls=[];const res=await executeCombine(stub(calls),one,'Aaron Finkelstein');
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0].args.payload.items.map(i=>i.id),['b1']);
 assert.equal(calls[0].args.payload.target_id,'a');
 assert.equal(res.target_id,'a');
});

test('over-100-step source stops with a clear message before any RPC call',async()=>{
 const few={a:{id:'a',name:'Alpha'},b:{id:'b',name:'Beta'}};
 const many=Array.from({length:101},(_,i)=>({id:'b'+i,project_id:'b',status:'pending'}));
 const plan=combinePlan(['a','b'],'a',few,many);
 assert.equal(plan.items.length,101);
 const calls=[];
 await assert.rejects(executeCombine(stub(calls),plan,'A'),/at most 100 steps at once/);
 assert.equal(calls.length,0); // never reaches the server - no silent partial move
});
