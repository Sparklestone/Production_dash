import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('function updateSelectionUI(){'),source.indexOf('function destinationClients'));
test('selection reconciliation derives once per invocation, with current data and permissions',()=>{
 let derives=0;
 const state={data:{sched:[{id:'open',project_id:'p'},{id:'done-project',project_id:'q'},{id:'restricted',project_id:'p'}]},selectedSteps:['open','done-project','restricted','removed'],access:{},selectedClients:[],selectedProjects:[]};
 const projects={p:{status:'active'},q:{status:'done'}};
 const ctx=vm.createContext({state,derive:()=>{derives++;return {pm:projects};},canCompleteItem:(_,i)=>i.id!=='restricted',projectIsDone:p=>p?.status==='done',document:{querySelectorAll:()=>[]}});
 vm.runInContext(body+';updateSelectionUI();',ctx);
 assert.equal(derives,1);assert.deepEqual([...state.selectedSteps],['open']);
 projects.p.status='done';vm.runInContext('updateSelectionUI()',ctx);
 assert.equal(derives,2);assert.deepEqual([...state.selectedSteps],[]);
});
test('large reconciliation does not rebuild indexes for each step',()=>{
 let derives=0;const state={data:{sched:Array.from({length:1200},(_,n)=>({id:String(n),project_id:'p'}))},selectedSteps:['1','1199'],access:{},selectedClients:[],selectedProjects:[]};
 const ctx=vm.createContext({state,derive:()=>{derives++;return {pm:{p:{status:'active'}}};},canCompleteItem:()=>true,projectIsDone:()=>false,document:{querySelectorAll:()=>[]}});
 vm.runInContext(body+';updateSelectionUI();',ctx);assert.equal(derives,1);assert.deepEqual([...state.selectedSteps],['1','1199']);
});
