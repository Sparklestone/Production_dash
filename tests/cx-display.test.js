import {test} from 'node:test';import assert from 'node:assert/strict';
import {clientCx,cxText} from '../src/cx-display.js';import {projectCx} from '../src/step-assignment.js';
test('client CX summarizes own and inherited project values without duplicates or other clients',()=>{
 const pm={a:{id:'a',client_id:'x',cx:['Sara','Drew']},b:{id:'b',parent_id:'a',cx:[]},c:{id:'c',parent_id:'b',cx:['Ann','Sara']},d:{id:'d',client_id:'y',cx:['Other']}};
 const before=JSON.stringify(pm);assert.deepEqual(clientCx('x',pm),['Sara','Drew','Ann']);assert.deepEqual(projectCx(pm.b,pm),['Sara','Drew']);assert.deepEqual(projectCx(pm.c,pm),['Ann','Sara']);assert.equal(JSON.stringify(pm),before);
});
test('missing CX is explicit, no owner inference',()=>{const pm={a:{id:'a',client_id:'x',owner_id:'someone',cx:[]}};assert.deepEqual(clientCx('x',pm),[]);assert.equal(cxText([]),'Not set');assert.equal(cxText(['Sara','Drew']),'Sara, Drew');});

test('unlinked projects retain CX in No client group',()=>{assert.deepEqual(clientCx('',{a:{id:'a',cx:['Ann']}}),['Ann']);});
