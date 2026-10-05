import test from 'node:test';import assert from 'node:assert/strict';import {deliverComment,readOutbox,saveOutbox} from '../src/comment-outbox.js';
const row={id:'uuid',user:'a',project_id:'p',schedule_item_id:'i',author_name:'A',note:'Release Friday'};
function client({saved=false,fail=false,lost=false,readFails=false}={}){
 let writes=0;
 return {get writes(){return writes;},from(){
  return {
   select(){return {eq(){return {async maybeSingle(){return {data:saved?{id:'uuid',created_at:'now'}:null,error:readFails?{}:null};}};}};},
   insert(payload){writes++;assert.equal(payload.id,row.id);if(!fail)saved=true;
    return {select(){return {async single(){return {data:!fail&&!lost?{id:'uuid',created_at:'now'}:null,error:fail||lost?{}:null};}};}};
   }
  };
 }};
}
test('successful send retains stable UUID',async()=>{const c=client();assert.equal((await deliverComment(c,row)).id,'uuid');assert.equal(c.writes,1);});
test('lost response reconciled from own row without duplicate',async()=>{const c=client({lost:true});await deliverComment(c,row);await deliverComment(c,row);assert.equal(c.writes,1);});
test('existing receipt does not resend',async()=>{const c=client({saved:true});await deliverComment(c,row);assert.equal(c.writes,0);});
test('failed or unverifiable send remains pending',async()=>{const c=client({fail:true});await assert.rejects(deliverComment(c,row));const d=client({readFails:true});await assert.rejects(deliverComment(d,row));assert.equal(d.writes,0);});
test('outbox is isolated by account and survives reload',()=>{const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};saveOutbox(storage,'a',[row]);assert.deepEqual(readOutbox(storage,'a'),[row]);assert.deepEqual(readOutbox(storage,'b'),[]);});
