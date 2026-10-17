import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayableRun} from '../src/game/quick-start.js';
import {skipBirth,continueChildhood} from '../src/game/childhood.js';
import {nextChildhoodAge} from '../src/game/childhood-stages.js';
import {act,chooseEvent,continueStory,eligibleChoices,nextTurn} from '../src/game/narrative.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';

const catalog={};
for(const key of ['events','families','characters','history','endings']){
 const data=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));
 catalog[key]=key==='events'?data.events:data;
}
setSaveCatalog(catalog);
function resolve(s){
 for(let n=0;n<40&&s.phase!=='planning';n++){
  if(s.phase==='result')s=continueStory(s,catalog);
  else{
   const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),c=eligibleChoices(s,e).find(c=>!c.disabled);
   s=chooseEvent(s,e.id,c.id,catalog);
  }
 }
 assert.equal(s.phase,'planning');return s;
}
const birth=()=>createPlayableRun({seed:'manual-year-end',familyId:'F01',startAt:'birth'},catalog);
function planning(age){
 let s=resolve(skipBirth(birth(),catalog));
 while(nextChildhoodAge(s.age)<=age)s=resolve(continueChildhood(s,catalog));
 s.age=age; // Includes legacy saves between the new milestones.
 if(age<6)delete s.childhood.allowanceThroughMonth;
 return s;
}

for(const remaining of [2,1,0])test(`ending a stage with ${remaining} energy never performs an extra activity`,()=>{
 for(const age of [1,5,12,17]){
  let s=planning(age);
  for(let n=2;n>remaining;n--)s=act(s,{type:n===2?'study':'social'},catalog);
  const before=structuredClone(s),expected=nextTurn(s,catalog),actual=continueChildhood(s,catalog);
  assert.equal(actual.age,nextChildhoodAge(age));assert.equal(actual.actionPoints,2);
  assert.equal(actual.runStats.actions,s.runStats.actions);
  for(const key of ['stats','cash','familyReserve','relationships','rng','activeEvent','eventQueue','education'])assert.deepEqual(actual[key],expected[key],`${age}: ${key}`);
  assert.deepEqual(s,before);
  assert.deepEqual(decodeSave(encodeSave(actual)),actual);
  assert.equal(actual.ledger.filter(e=>e.label==='成年一次性赠与').length,age===17?1:0);
  if(age===1)assert.equal(actual.cash,0);
  if(age===5)assert.ok(actual.cash>s.cash);
 }
});
test('a pending stage event blocks ending the stage; its result returns to the same stage',()=>{
 const event=skipBirth(birth(),catalog),before=structuredClone(event);
 assert.equal(event.age,3);assert.equal(event.phase,'event');
 assert.equal(continueChildhood(event,catalog),event);assert.deepEqual(event,before);
 const e=catalog.events.find(e=>e.id===event.activeEvent.eventId),c=eligibleChoices(event,e).find(c=>!c.disabled);
 const result=chooseEvent(event,e.id,c.id,catalog),next=continueChildhood(result,catalog);
 assert.equal(next.age,3);assert.equal(next.actionPoints,2);assert.equal(next.runStats.actions,0);
});
test('explicit fast-forward retains automatic activities and only pays the adult gift once',()=>{
 const s=planning(1),before=structuredClone(s),fast=continueChildhood(s,catalog,{fast:true});
 assert.equal(fast.age,6);assert.match(fast.activeEvent.eventId,/^STU_[A-H]1$/);assert.ok(fast.runStats.actions>s.runStats.actions);
 assert.equal(fast.ledger.filter(e=>e.label==='成年一次性赠与').length,0);
 let grown=fast;for(let guard=0;grown.age<18&&guard<20;guard++)grown=continueChildhood(resolve(grown),catalog,{fast:true});
 assert.equal(grown.age,18);
 assert.equal(grown.ledger.filter(e=>e.label==='成年一次性赠与').length,1);
 assert.deepEqual(s,before);assert.deepEqual(decodeSave(encodeSave(fast)),fast);
 assert.equal(continueChildhood(grown,catalog,{fast:true}),grown);
});
test('skipping the birth introduction does not choose a hidden daily activity',()=>{
 const s=skipBirth(birth(),catalog);
 assert.equal(s.age,3);assert.equal(s.actionPoints,2);assert.equal(s.runStats.actions,0);
});
