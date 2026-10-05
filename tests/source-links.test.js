import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceLinks} from '../src/source-links.js';
const p={id:'p'},i={id:'i'};
const links=[{project_id:'p',kind:'teams',url:'https://teams.microsoft.com/message/project',label:'Teams: Project thread'},{project_id:'p',schedule_item_id:'i',kind:'other',url:'https://outlook.office.com/mail/id/example',label:'Email: Approval'},{project_id:'p',schedule_item_id:'other',kind:'teams',url:'https://teams.microsoft.com/message/other'},{project_id:'q',kind:'teams',url:'https://teams.microsoft.com/message/wrong'}];
test('exact step source first, project sources explicitly scoped',()=>{assert.deepEqual(sourceLinks(p,i,links).map(l=>[l.kind,l.scope]),[['email','step'],['teams','project']]);});
test('project cards never borrow a step source',()=>{assert.deepEqual(sourceLinks(p,null,links).map(l=>l.kind),['teams']);});
test('missing, unsafe and file links do not masquerade as sources',()=>{assert.deepEqual(sourceLinks(p,i,[{project_id:'p',kind:'teams',url:'javascript:alert(1)'},{project_id:'p',kind:'teams',url:'https://user:password@example.invalid'},{project_id:'p',kind:'teams',url:null},{project_id:'p',kind:'figma',url:'https://figma.com/file/test'}]),[]);});
test('email label works without schema kind change; URL duplicates removed',()=>{const l={project_id:'p',kind:'other',label:'Email: Brief',url:'https://example.invalid/mail'};assert.equal(sourceLinks(p,i,[l,l]).length,1);});
