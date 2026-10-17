import {isStudentStory} from '../src/game/student-stories.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayableRun} from '../src/game/quick-start.js';
import {continueChildhood} from '../src/game/childhood.js';
import {createRun,chooseEvent,continueStory,nextTurn,eligibleChoices,getEventPresentation} from '../src/game/narrative.js';
import {TEEN_STORY_STEPS,isTeenStory,teenStoryPresentation,teenStoryChoice} from '../src/game/teen-stories.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?d.events:d;}setSaveCatalog(catalog);
const byId=id=>catalog.events.find(e=>e.id===id),save=s=>decodeSave(encodeSave(s));
const pick=s=>{const e=byId(s.activeEvent.eventId),c=eligibleChoices(s,e).find(c=>!c.disabled);assert.ok(c,e.id);const n=chooseEvent(s,e.id,c.id,catalog);assert.equal(n.lastResult.error,undefined);return n;};
test('the quick start stops in primary school and every required story needs a deliberate choice, including repeated fast-forward and reload',()=>{
 for(const familyId of ['F01','F11','F12']){
  let s=createPlayableRun({seed:'teen-'+familyId,familyId,startAt:'teen'},catalog);
  assert.equal(s.age,6);assert.ok(isStudentStory(s.activeEvent.eventId));assert.equal(s.childhood.birth.complete,true);
  const read=[];
  for(let guard=0;s.age<18&&guard<100;guard++){
   if(s.phase==='event'&&(isTeenStory(s.activeEvent.eventId)||isStudentStory(s.activeEvent.eventId))){
    const before=structuredClone(s),id=s.activeEvent.eventId;
    assert.deepEqual(continueChildhood(s,catalog,{fast:true}),before);
    s=save(s);assert.deepEqual(s,before);if(isTeenStory(id))read.push({age:s.age,id});s=pick(s);
   }else s=continueChildhood(s,catalog,{fast:true});
  }
  assert.equal(s.age,18);assert.deepEqual(read,TEEN_STORY_STEPS);assert.equal(new Set(read.map(r=>r.id)).size,12);
  assert.equal(s.ledger.filter(e=>e.label==='成年一次性赠与').length,1);assert.deepEqual(save(s),s);
 }
});
test('ordinary progression keeps annual ages 12 through 17 and reaches the same ordered stories',()=>{
 let s=createPlayableRun({seed:'teen-normal',familyId:'F01',startAt:'teen'},catalog),read=[],ages=[];
 for(let guard=0;s.age<18&&guard<160;guard++){
  if(s.phase==='event'){if(isTeenStory(s.activeEvent.eventId))read.push({age:s.age,id:s.activeEvent.eventId});s=pick(s);}
  else if(s.phase==='result')s=continueStory(s,catalog);
  else{ages.push(s.age);s=continueChildhood(s,catalog);}
 }
 assert.equal(s.age,18);assert.deepEqual(read,TEEN_STORY_STEPS);assert.deepEqual(ages,[6,10,12,13,14,15,16,17]);
});
test('a legacy sixteen-year-old planning save cannot leave before its stock stories; adult saves never replay childhood',()=>{
 let s=createRun({seed:'legacy-teen',familyId:'F01'},catalog);Object.assign(s,{age:16,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[]});
 delete s.studentStories; // A genuinely legacy save has no new formative-story state.
 s.seenEvents.push(...TEEN_STORY_STEPS.filter(r=>r.age<16).map(r=>r.id),'FAM06');
 s=nextTurn(s,catalog);assert.equal(s.age,16);assert.equal(s.activeEvent.eventId,'AGE16A');
 for(const id of ['AGE16A','AGE16B','AGE16C']){assert.equal(s.activeEvent.eventId,id);s=continueStory(pick(s),catalog);}
 assert.equal(s.phase,'planning');assert.equal(s.seenEvents.filter(id=>id==='FAM06').length,1);
 s.age=22;s.activeEvent=null;s.phase='planning';s.eventQueue=[];s.seenEvents=[];s=continueStory(s,catalog);assert.equal(s.phase,'planning');
});
test('teen stock learning does not buy assets or invent income, and family narration does not invent parents or a family shop',()=>{
 for(const id of ['FAM06','AGE16A','AGE16B','AGE16C','FAM02','YOU02']){
  const e=byId(id);for(const c of e.choices)for(const o of c.outcomes){
   const s=createRun({seed:'paper-stock',familyId:'F12'},catalog);Object.assign(s,{age:Math.max(16,e.age_min),phase:'event',activeEvent:{eventId:id,outcomes:Object.fromEntries(e.choices.map(x=>[x.id,x.outcomes[0].id]))},cash:100000});s.activeEvent.outcomes[c.id]=o.id;
   const n=chooseEvent(s,id,c.id,catalog);assert.equal(n.lastResult.error,undefined);for(const key of ['cash','positions','debts','monthlyIncome'])assert.deepEqual(n[key],s[key]);
  }
 }
 const s={familyId:'F12',seenEvents:[]};assert.match(teenStoryPresentation(s,byId('MAIN03')).prompt,/外婆/);assert.doesNotMatch(teenStoryPresentation(s,byId('FAM05')).prompt,/店|父母/);
 assert.doesNotMatch(teenStoryPresentation(s,byId('AGE16A')).prompt,/看过旧股票/);s.seenEvents=['FAM06'];assert.match(teenStoryPresentation(s,byId('AGE16A')).prompt,/看过旧股票/);
 const e=byId('YOU05');for(const c of e.choices)assert.deepEqual(teenStoryChoice(s,e,c).outcomes.map(o=>o.schedule),c.outcomes.map(o=>o.schedule));
});
