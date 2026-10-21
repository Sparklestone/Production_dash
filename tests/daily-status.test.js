import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyStatus,businessWindowStart} from '../src/daily-status.js';
const projects={p:{id:'p',name:'Logo',client_id:'c',status:'active'},q:{id:'q',name:'Deck',client_id:'d',status:'active'}};
const clients=[{id:'c',name:'Acme'},{id:'d',name:'Zed'}];
const now=new Date('2026-10-19T15:37:00Z');
test('24 business hours skips the weekend',()=>{assert.equal(businessWindowStart(now).toISOString(),'2026-10-16T15:37:00.000Z');});
test('groups by brand, dedupes urgent/next/week, logs changes',()=>{
 const items=[
  {id:'1',project_id:'p',title:'a',status:'pending',due_date:'2026-10-17'},
  {id:'2',project_id:'p',title:'b',status:'pending',due_date:'2026-10-19'},
  {id:'3',project_id:'p',title:'c',status:'pending',due_date:'2026-10-21'},
  {id:'4',project_id:'p',title:'d',status:'pending',due_date:'2026-10-23'},
  {id:'5',project_id:'q',title:'e',status:'blocked',due_date:null},
  {id:'6',project_id:'q',title:'f',status:'done',due_date:'2026-10-16',updated_at:'2026-10-19T14:00:00Z'},
  {id:'7',project_id:'q',title:'g',status:'pending',due_date:'2026-11-30'}];
 const r=dailyStatus({items,updates:[{project_id:'q',created_at:'2026-10-16T20:00:00Z',note:'added steps'},{project_id:'q',created_at:'2026-10-16T21:00:00Z',note:'[Daily] n2'},{project_id:'q',created_at:'2026-10-10T20:00:00Z',note:'old'}],projects,clients,today:'2026-10-19',now});
 const acme=r.brands.find(b=>b.name==='Acme'),zed=r.brands.find(b=>b.name==='Zed');
 assert.deepEqual(acme.urgent.map(x=>x.item.id),['1','2']);
 assert.deepEqual(acme.next.map(x=>x.item.id),['3']);
 assert.deepEqual(acme.week.map(x=>x.item.id),['4']);
 assert.deepEqual(zed.urgent.map(x=>x.item.id),['5']);
 assert.deepEqual(zed.changed.map(x=>x.kind+':'+(x.text||'')),['done:Done','note:n2']);
 assert.equal(r.brands[0].name,'Acme');
});

import {dailyStatus as ds2,statusOutline,brandOutline} from '../src/daily-status.js';
test('statusOutline renders brand/CX head, notes, owner and date tags',()=>{
 const projects={p:{id:'p',name:'Logo',client_id:'c',status:'active',cx:['Riley']},q:{id:'q',name:'Deck',client_id:'d',status:'active'}};
 const clients=[{id:'c',name:'Acme'},{id:'d',name:'Zed'}];
 const mm={m1:{id:'m1',name:'Aaron F.'},m2:{id:'m2',name:'Pat M.'}};
 const items=[
  {id:'1',project_id:'p',title:'Kickoff deck',status:'pending',due_date:'2026-10-17',owner_id:'m1'},
  {id:'2',project_id:'p',title:'Build',status:'blocked',due_date:null,owner_id:'m1',co_owner_ids:['m2']},
  {id:'3',project_id:'q',title:'Print',status:'pending',due_date:'2026-10-23',owner_id:null},
  {id:'4',project_id:'p',title:'Old step',status:'done',due_date:'2026-10-16',updated_at:'2026-10-19T14:00:00Z',owner_id:'m2'}];
 const r=ds2({items,updates:[{project_id:'p',created_at:'2026-10-19T10:00:00Z',note:'[Daily] files moved'}],projects,clients,today:'2026-10-19',now});
 const text=statusOutline(r,{projects,mm});
 const lines=text.split('\n');
 assert.ok(lines.includes('Acme: CX Riley'),'head: '+lines[0]);
 assert.ok(lines.includes('Logo'),'project line');
 assert.ok(lines.includes('files moved'),'note line');
 assert.ok(lines.includes('Kickoff deck - Aaron F. - Past due Oct 17'),'past due line: '+text);
 assert.ok(lines.includes('Build - Aaron F. & Pat M. - Blocked'),'blocked co-owner line: '+text);
 assert.ok(lines.includes('Old step - Pat M. - Done'),'done line: '+text);
 assert.ok(lines.includes('Print - No owner - Due Oct 23'),'due line: '+text);
 const acme=r.brands.find(b=>b.name==='Acme');
 assert.equal(brandOutline(acme,{projects,mm}).split('\n')[0],'Acme: CX Riley');
 const proj=brandOutline(acme,{projects,mm,projectId:'p'});
 assert.ok(proj.startsWith('Logo: CX Riley'),'project copy head: '+proj.split('\n')[0]);
 assert.ok(!proj.includes('Zed'),'project copy scoped');
});
