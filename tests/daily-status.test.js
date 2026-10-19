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
 const r=dailyStatus({items,updates:[{project_id:'q',created_at:'2026-10-16T20:00:00Z',note:'n'},{project_id:'q',created_at:'2026-10-10T20:00:00Z',note:'old'}],projects,clients,today:'2026-10-19',now});
 const acme=r.brands.find(b=>b.name==='Acme'),zed=r.brands.find(b=>b.name==='Zed');
 assert.deepEqual(acme.urgent.map(x=>x.item.id),['1','2']);
 assert.deepEqual(acme.next.map(x=>x.item.id),['3']);
 assert.deepEqual(acme.week.map(x=>x.item.id),['4']);
 assert.deepEqual(zed.urgent.map(x=>x.item.id),['5']);
 assert.equal(zed.changed.length,2);
 assert.equal(r.brands[0].name,'Acme');
});
