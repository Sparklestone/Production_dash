import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyNote,dailyNoteKey} from '../src/daily-note.js';
const n={project:{id:'p'},at:'2026-11-02T17:10:00Z',text:'A full source message with <markup> & https://example.org/source'};
test('communication starts one line with date and accessible ellipsis, preserving source',()=>{
 const h=dailyNote(n,'Nov 2, 10:10 AM');
 assert.ok(h.includes('brief-note-preview'));assert.ok(h.includes('aria-label="Expand communication message"'));assert.ok(h.includes('aria-expanded="false"'));
 assert.ok(h.includes('Nov 2, 10:10 AM'));assert.ok(h.includes('&lt;markup&gt; &amp; https://example.org/source'));
 assert.ok(h.includes('class="brief-note-full" hidden'));
});
test('expanded communication shows full escaped text ending with compress control',()=>{
 const h=dailyNote(n,'Nov 2, 10:10 AM',true);
 assert.ok(h.includes('brief-note is-expanded'));assert.ok(h.includes('class="brief-note-preview" hidden'));
 assert.ok(h.includes('>compress message</button></p>'));assert.ok(!h.includes('class="brief-note-full" hidden'));
 assert.equal(dailyNoteKey(n),dailyNoteKey({...n}));assert.notEqual(dailyNoteKey(n),dailyNoteKey({...n,text:'different'}));
});
