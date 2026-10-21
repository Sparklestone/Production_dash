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
 assert.ok(!lines.includes('Logo'),'root project header merged into brand head: '+lines.join('|'));
 assert.ok(lines.indexOf('files moved')===lines.indexOf('Acme: CX Riley')+2,'note straight under brand head: '+lines.join('|'));
 assert.ok(lines.indexOf('files moved')<lines.indexOf('Print - No owner - Due Oct 23'),'root project content before subprojects');
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

import {statusOutlineHtml,brandOutlineHtml} from '../src/daily-status.js';
test('outline spacing and HTML hierarchy for Teams paste',()=>{
 const projects={p:{id:'p',name:'Logo',client_id:'c',status:'active',cx:['Riley']},q:{id:'q',name:'Deck',client_id:'d',status:'active'}};
 const clients=[{id:'c',name:'Acme'},{id:'d',name:'Zed'}];
 const mm={m1:{id:'m1',name:'Aaron F.'}};
 const items=[
  {id:'1',project_id:'p',title:'Kickoff & deck',status:'pending',due_date:'2026-10-17',owner_id:'m1'},
  {id:'3',project_id:'q',title:'Print',status:'pending',due_date:'2026-10-23',owner_id:null}];
 const r=ds2({items,updates:[],projects,clients,today:'2026-10-19',now});
 const text=statusOutline(r,{projects,mm});
 assert.ok(text.includes('\n\n\n'),'triple break between brands: '+JSON.stringify(text.slice(0,200)));
 assert.ok(text.includes('Acme: CX Riley\n\nKickoff & deck - Aaron F. - Past due Oct 17\n'),'root project content merged under brand head: '+JSON.stringify(text.slice(0,200)));
 const html=statusOutlineHtml(r,{projects,mm});
 assert.ok(html.includes('<p><b>Acme: CX Riley</b><br>Kickoff &amp; deck - Aaron F. - Past due Oct 17</p>'),'root project folds into brand head paragraph: '+html.slice(0,300));
 assert.ok(!html.includes('<p><b>Logo</b>'),'no duplicate root project head: '+html.slice(0,300));
 assert.ok(html.includes('<p><br></p>'),'empty paragraph between brands');
 const projHtml=brandOutlineHtml(r.brands.find(b=>b.name==='Acme'),{projects,mm,projectId:'p'});
 assert.ok(projHtml.startsWith('<p><b>Logo: CX Riley</b></p>'),'project-scoped head: '+projHtml);
 assert.ok(!projHtml.includes('Zed'),'project html scoped');
});

import {doneWindowStart,dayKey} from '../src/daily-status.js';
test('doneWindowStart spans 5 working days, skipping weekends',()=>{
 assert.equal(doneWindowStart('2026-10-21'),'2026-10-15'); // Wed: 15,16,19,20,21
 assert.equal(doneWindowStart('2026-10-19'),'2026-10-13'); // Mon: 13,14,15,16,19
 assert.equal(doneWindowStart('2026-10-26'),'2026-10-20'); // next Mon: 20,21,22,23,26
});
test('Done subsection lists steps completed in the last 5 working days',()=>{
 const projects={p:{id:'p',name:'Logo',client_id:'c',status:'active',cx:[]},q:{id:'q',name:'Deck',client_id:'d',status:'active'}};
 const clients=[{id:'c',name:'Acme'},{id:'d',name:'Zed'}];
 const mm={m2:{id:'m2',name:'Pat M.'}};
 const items=[
  {id:'1',project_id:'p',title:'Recent fix',status:'done',updated_at:'2026-10-20T15:00:00Z',owner_id:'m2'},
  {id:'2',project_id:'p',title:'Friday fix',status:'done',updated_at:'2026-10-16T20:00:00Z',owner_id:null},
  {id:'3',project_id:'p',title:'Edge fix',status:'done',updated_at:'2026-10-15T14:00:00Z',owner_id:null},
  {id:'4',project_id:'p',title:'Too old',status:'done',updated_at:'2026-10-14T23:00:00Z',owner_id:null},
  {id:'5',project_id:'p',title:'RETIRED (client pause): Old ask',status:'done',updated_at:'2026-10-20T15:00:00Z',owner_id:null},
  {id:'6',project_id:'q',title:'Open step',status:'pending',due_date:'2026-10-22',owner_id:null}];
 const r=dailyStatus({items,updates:[],projects,clients,today:'2026-10-21',now:new Date('2026-10-21T16:00:00Z')});
 const acme=r.brands.find(b=>b.name==='Acme');
 assert.deepEqual(acme.rdone.map(x=>x.item.id),['1','2','3'],'in-window done only, newest first: '+JSON.stringify(acme.rdone.map(x=>x.item.id)));
 const text=statusOutline(r,{projects,mm});
 const lines=text.split('\n');
 const head=lines.indexOf('Done (last 5 working days):');
 assert.ok(head>-1,'Done subsection present: '+text);
 assert.ok(lines.includes('Recent fix - Pat M. - Done Oct 20'),'owner + done date: '+text);
 assert.ok(lines.includes('Edge fix - No owner - Done Oct 15'),'window edge included: '+text);
 assert.ok(!text.includes('Too old'),'older than 5 working days excluded');
 assert.ok(!text.includes('RETIRED'),'retired excluded');
 assert.ok(lines.indexOf('Recent fix - Pat M. - Done Oct 20')>head,'done lines under the subsection head');
 const proj=brandOutline(acme,{projects,mm,projectId:'p'});
 assert.ok(proj.includes('Done (last 5 working days):'),'project-scoped copy includes Done subsection');
 assert.ok(!proj.includes('Open step - No owner - Due Oct 22'),'project scoping still holds');
 const html=statusOutlineHtml(r,{projects,mm});
 assert.ok(html.includes('Done (last 5 working days):'),'HTML copy includes Done subsection');
 assert.equal(dayKey(new Date('2026-10-21T05:59:00Z').getTime()),'2026-10-20','late-night UTC still prior Denver day');
});
