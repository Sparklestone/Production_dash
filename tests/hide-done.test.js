import {test} from 'node:test';import assert from 'node:assert/strict';
import {visibleCards} from '../src/hide-done.js';
test('unchecked preserves all cards and order',()=>{const rows=[{id:'a',status:'done'},{id:'b',status:'pending'}];assert.equal(visibleCards(rows),rows);});
test('checked hides only explicitly done cards, without mutating rows',()=>{const rows=[{id:'a',status:'done'},{id:'b',status:'in_progress'},{id:'c',status:'pending'},{id:'d',status:'waiting'},{id:'e'}];const before=JSON.stringify(rows);assert.deepEqual(visibleCards(rows,true).map(r=>r.id),['b','c','d','e']);assert.equal(JSON.stringify(rows),before);assert.equal(visibleCards(rows,false).length,5);});
