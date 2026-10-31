import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hydrateCardBody} from '../src/lazy-card-body.js';
test('lazy body fills once and binds only its new subtree',()=>{
 const body={dataset:{},innerHTML:''};let builds=0,binds=0;
 assert.equal(hydrateCardBody(body,()=>{builds++;return '<textarea>draft</textarea>';},node=>{assert.equal(node,body);binds++;}),true);
 body.innerHTML='edited draft';
 assert.equal(hydrateCardBody(body,()=>{throw Error('must not replace draft');},()=>{throw Error('must not bind twice');}),false);
 assert.equal(body.innerHTML,'edited draft');assert.equal(builds,1);assert.equal(binds,1);
 assert.equal(hydrateCardBody(null,()=>'',()=>{}),false);
});
test('failed body construction remains retryable',()=>{
 const body={dataset:{},innerHTML:''};assert.throws(()=>hydrateCardBody(body,()=>{throw Error('failed');},()=>{}));assert.equal(body.dataset.bodyFilled,undefined);
});
test('task summaries stay eager, open and expanded editors stay full; toggle hydrates',()=>{
 const s=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(s,/state\.stepRowOpen\[i\.id\]\|\|expanded\?taskCardBody\(i,d,expanded\):''/);
 assert.match(s,/if\(el\.open\)populateTaskCard\(el\)/);
 assert.match(s,/hydrateCardBody\(body,\(\)=>taskCardBody\(item,derive\(\)\),node=>\{bind\(node\)/);
});
test('summary and extracted body preserve prior full-card markup',()=>{
 const current=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 // Context, history, editors and update forms remain in the deferred body.
 const body=current.slice(current.indexOf('function taskCardBody'),current.indexOf('function populateTaskCard'));
 for(const token of ['timeline(p,d,i)','questionsArea(p,i)','quickInput(p,i)','commentHistory(p,i)','stepStatusControl(i,d)','stepOwnerControl(i,d)','workDaysControl(i)','sourceControls(p,i,d)','originalSourceControls(i)','task-complete-status'])assert.ok(body.includes(token),token);
 const card=current.slice(current.indexOf('function taskCard('),current.indexOf('function taskCardBody'));
 for(const token of ['stepCheckbox(i)','inlineOwner(i,d)','stepStatusPill(i,d)','taskBreadcrumb(p,d)','data-target-item','data-step-row'])assert.ok(card.includes(token),token);
});
