import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
test('Daily bands alternate whole project groups, not individual step rows',()=>{
 assert.match(css,/\.daily-brief>\.brief>\.brief-proj:nth-child\(even\)\{background:#f1f3f2\}/);
});
test('Daily client bar includes the entire header and keeps readable controls',()=>{
 assert.match(css,/\.daily-brand-head\{background:#111;color:#fff;/);
 assert.match(css,/\.daily-brand-head>\.client-select\{color:#fff\}/);
 assert.match(css,/\.daily-brand-head>\.comment\{background:#fff;color:#241f20;/);
 assert.match(css,/\.daily-brand-head h3\{flex-basis:100%\}/);
});
