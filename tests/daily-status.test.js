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
 assert.ok(lines.includes('  Logo'),'distinct root project name visible: '+lines.join('|'));
 assert.ok(lines.includes('  files moved'),'note under named project: '+lines.join('|'));
 assert.ok(lines.indexOf('  files moved')<lines.indexOf('  Print - No owner - Due Oct 23'),'root project content before subprojects');
 assert.ok(lines.includes('  Kickoff deck - Aaron F. - Past due Oct 17'),'past due line: '+text);
 assert.ok(lines.includes('  Build - Aaron F. & Pat M. - Blocked'),'blocked co-owner line: '+text);
 assert.ok(lines.includes('  Old step - Pat M. - Done Oct 19'),'done line: '+text);
 assert.ok(lines.includes('  Print - No owner - Due Oct 23'),'due line: '+text);
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
 assert.ok(text.includes('Acme: CX Riley\n\n  Logo\n  Kickoff & deck - Aaron F. - Past due Oct 17'),'distinct project visible under brand: '+text);
 const html=statusOutlineHtml(r,{projects,mm});
 assert.ok(html.includes('>Logo</a></h3>'),'distinct project heading visible: '+html);
 assert.ok(!html.includes('<b>Logo</b><br>'),'no duplicate root project head: '+html.slice(0,300));
 assert.ok(html.includes('<p><br></p>'),'empty paragraph between brands');
 const projHtml=brandOutlineHtml(r.brands.find(b=>b.name==='Acme'),{projects,mm,projectId:'p'});
 assert.ok(projHtml.startsWith('<h2 style="margin:0"><a href="https://productiondash.vercel.app/#project=p">Logo: CX Riley</a></h2>'),'project-scoped linked head: '+projHtml);
 assert.ok(!projHtml.includes('Zed'),'project html scoped');
});
test('subproject and brand heads link to their cards in HTML copy',()=>{
 const projects={p:{id:'p',name:'Illustrations',client_id:'c',status:'active'},s:{id:'s',name:'Social Ads',client_id:'c',status:'active',parent_id:'p'}};
 const clients=[{id:'c',name:'DPP'}];
 const items=[
  {id:'1',project_id:'p',title:'Root work',status:'pending',due_date:'2026-10-23',owner_id:null},
  {id:'2',project_id:'s',title:'Intake',status:'blocked',due_date:null,owner_id:null}];
 const r=ds2({items,updates:[],projects,clients,today:'2026-10-19',now});
 const html=statusOutlineHtml(r,{projects,mm:{}});
 assert.ok(html.includes('<h2 style="margin:0"><a href="https://productiondash.vercel.app/#project=p">DPP</a></h2>'),'brand head h2 and links to root card: '+html);
 assert.ok(html.includes('<h3 style="margin:8px 0 0 14px"><a href="https://productiondash.vercel.app/#project=s">Social Ads</a></h3>'),'subproject head h3: '+html);
 assert.ok(html.includes('<h3 style="margin:8px 0 0 14px"><a href="https://productiondash.vercel.app/#project=s">Social Ads</a></h3>'),'subproject head indented under the brand and links to its card: '+html);
 const text=statusOutline(r,{projects,mm:{}});
 assert.ok(!text.includes('http'),'plain text copy stays link-free');
 assert.ok(text.includes('\n  Social Ads\n  Intake'),'plain-text copy indents subproject under brand: '+JSON.stringify(text.slice(0,200)));
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
 const head=lines.indexOf('  Done (last 5 working days):');
 assert.ok(head>-1,'Done subsection present: '+text);
 assert.ok(lines.includes('  Recent fix - Pat M. - Done Oct 20'),'owner + done date: '+text);
 assert.ok(lines.includes('  Edge fix - No owner - Done Oct 15'),'window edge included: '+text);
 assert.ok(!text.includes('Too old'),'older than 5 working days excluded');
 assert.ok(!text.includes('RETIRED'),'retired excluded');
 assert.ok(lines.indexOf('  Recent fix - Pat M. - Done Oct 20')>head,'done lines under the subsection head');
 const proj=brandOutline(acme,{projects,mm,projectId:'p'});
 assert.ok(proj.includes('Done (last 5 working days):'),'project-scoped copy includes Done subsection');
 assert.ok(!proj.includes('Open step - No owner - Due Oct 22'),'project scoping still holds');
 const html=statusOutlineHtml(r,{projects,mm});
 assert.ok(html.includes('Done (last 5 working days):'),'HTML copy includes Done subsection');
 assert.equal(dayKey(new Date('2026-10-21T05:59:00Z').getTime()),'2026-10-20','late-night UTC still prior Denver day');
});

test('started work never drops off: in-progress steps always show (no edit-age limit)',()=>{
 const items=[
  {id:'1',project_id:'p',title:'Receive brand kit',status:'in_progress',due_date:null},
  {id:'2',project_id:'p',title:'Backlog idea',status:'pending',due_date:null},
  {id:'3',project_id:'p',title:'Far-dated started step',status:'in_progress',due_date:'2026-12-15'},
  {id:'4',project_id:'p',title:'Due today started step',status:'in_progress',due_date:'2026-10-19'}];
 const r=dailyStatus({items,updates:[],projects,clients,today:'2026-10-19',now});
 const acme=r.brands.find(b=>b.name==='Acme');
 assert.deepEqual(acme.active.map(x=>x.item.id),['3','1']);
 assert.deepEqual(acme.urgent.map(x=>x.item.id),['4']);
 assert.equal(r.totals.active,2);
 const text=brandOutline(acme,{projects,mm:{}});
 assert.ok(text.includes('Receive brand kit - No owner - In progress'),text);
 assert.ok(!text.includes('Backlog idea'),text);
});

import {dailyProjectGroups} from '../src/daily-status.js';
test('recent completion renders once below Done divider in screen and copied status',()=>{
 const item={id:'recent',project_id:'p',title:'Recent completion',status:'done',updated_at:'2026-10-19T14:00:00Z'};
 const r=dailyStatus({items:[item],projects,clients,today:'2026-10-19',now});
 const b=r.brands[0];
 assert.equal(b.changed.length,1,'completion still contributes to Changed');
 for(const focus of ['', 'changed']){const [g]=dailyProjectGroups(b,focus);assert.equal(g.done.length,0);assert.equal(g.rdone.length,1);}
 for(const text of [statusOutline(r,{projects}),statusOutlineHtml(r,{projects})])assert.equal(text.split('Recent completion').length-1,1);
});

test('clients sorted alphabetically regardless of urgent count',()=>{const r=dailyStatus({projects,clients,items:[{id:'a',project_id:'p',title:'later',status:'pending',due_date:'2026-10-21'},{id:'z',project_id:'q',title:'urgent',status:'blocked'}],today:'2026-10-19',now});assert.deepEqual(r.brands.map(b=>b.name),['Acme','Zed']);});

 test('matching brand and root names avoid duplicate headings but distinct first project stays visible',()=>{
  const projects={p:{id:'p',name:'Acme',client_id:'c'}};
  const r=dailyStatus({items:[{id:'s',project_id:'p',title:'Build',status:'pending',due_date:'2026-10-22'}],projects,clients:[{id:'c',name:'Acme'}],today:'2026-10-21',now:new Date('2026-10-21T16:00:00Z')});
  assert.equal(statusOutline(r,{projects,mm:{}}).split('Acme').length-1,1);
  projects.p.name='Acme Engagement';
  assert.ok(statusOutline(r,{projects,mm:{}}).includes('  Acme Engagement'));
 });
