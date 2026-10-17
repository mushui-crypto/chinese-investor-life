import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayableRun} from '../src/game/quick-start.js';
import {createRun,chooseEvent,continueStory,nextTurn,eligibleChoices} from '../src/game/narrative.js';
import {continueChildhood,skipBirth} from '../src/game/childhood.js';
import {birthStory,BIRTH_STORIES,isBirthIntro,advanceBirthPage} from '../src/game/birth-story.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const data=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?data.events:data;}setSaveCatalog(catalog);
const options={seed:'birth-tests',familyId:'F01',startAt:'birth'},born=opts=>createPlayableRun({...options,...opts},catalog),saved=s=>decodeSave(encodeSave(s));
const choose=(s,id='MAIN01_1')=>chooseEvent(s,'MAIN01',id,catalog);
test('all 12 families start at zero with distinct stories and unchanged initial finances',()=>{
 assert.equal(Object.keys(BIRTH_STORIES).length,catalog.families.length);
 const texts=new Set(),scenes=new Set();for(const f of catalog.families){const s=born({familyId:f.id}),baseline=createRun({...options,familyId:f.id},catalog);assert.equal(s.age,0);assert.equal(s.activeEvent.eventId,'MAIN01');assert.ok(isBirthIntro(s));assert.equal(s.giftReceived,false);assert.ok(!s.seenEvents.includes('MAIN01'));
 for(const key of ['cash','familyReserve','adultGift','rng','ledger','stats','activeEvent','debts'])assert.deepEqual(s[key],baseline[key]);
 const story=birthStory(s);texts.add(story.pages.map(p=>p.text.join('')).join(''));scenes.add(story.scene);assert.equal(story.pages.length,2);assert.ok(s.logs.some(l=>l.title.startsWith('出生：')&&l.text.includes(story.pages[0].text[0])));assert.deepEqual(saved(s),s);}
 assert.equal(texts.size,12);assert.equal(scenes.size,3);
 assert.ok(!JSON.stringify(BIRTH_STORIES.F11).includes('爸爸'));assert.ok(JSON.stringify(BIRTH_STORIES.F12).includes('外婆'));
});
test('reading pages persists without spending cash, applying effects, or redrawing outcomes',()=>{
 let s=born(),before=structuredClone(s);for(let page=0;page<2;page++){s=advanceBirthPage(s,page);assert.equal(s.childhood.birth.page,page+1);assert.deepEqual(saved(s),s);for(const key of ['cash','rng','stats','activeEvent','ledger','storyHistory','seenEvents','actionPoints'])assert.deepEqual(s[key],before[key]);}
 assert.equal(before.childhood.birth.page,0);assert.equal(advanceBirthPage(s,0),s);assert.equal(advanceBirthPage(s,2),s);assert.equal(advanceBirthPage(s,99),s);assert.equal(continueChildhood(s,catalog),s);
});
test('birth choice applies once, reload keeps the result, then stage childhood and adulthood follow',()=>{
 for(const id of ['MAIN01_1','MAIN01_2','MAIN01_3']){let s=advanceBirthPage(advanceBirthPage(born(),0),1);const original=structuredClone(s);s=choose(s,id);assert.equal(s.phase,'result');assert.deepEqual(saved(s),s);assert.equal(advanceBirthPage(s,2),s);assert.equal(s.storyHistory.filter(h=>h.eventId==='MAIN01').length,1);assert.equal(s.cash,original.cash);assert.ok(isBirthIntro(s));const again=choose(s,id);assert.ok(again.lastResult.error);assert.deepEqual(again.stats,s.stats);assert.equal(again.storyHistory.length,s.storyHistory.length);
 s=continueChildhood(s,catalog);assert.equal(s.age,3);assert.ok(!isBirthIntro(s));assert.ok(s.childhood.birth.complete);assert.equal(s.giftReceived,false);assert.equal(s.storyHistory.find(h=>h.eventId==='MAIN01').choiceId,id);assert.deepEqual(saved(s),s);
 s=continueChildhood(s,catalog,{fast:true});assert.equal(s.age,6);for(let guard=0;s.age<18&&guard<60;guard++){if(s.phase==='event'){const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),c=eligibleChoices(s,e).find(c=>!c.disabled);s=chooseEvent(s,e.id,c.id,catalog);}else s=continueChildhood(s,catalog,{fast:true});}assert.equal(s.age,18);assert.equal(s.ledger.filter(l=>l.label==='成年一次性赠与').length,1);assert.deepEqual(saved(s),s);assert.equal(continueChildhood(s,catalog,{fast:true}),s);}
});
test('skipping any opening page reaches kindergarten once and keeps an already made birth choice',()=>{
 for(const page of [0,1,2]){let s=born();for(let p=0;p<page;p++)s=advanceBirthPage(s,p);const a=skipBirth(s,catalog),b=skipBirth(saved(s),catalog);assert.deepEqual(a,b);assert.equal(a.age,3);assert.ok(!a.giftReceived);assert.equal(a.seenEvents.filter(id=>id==='MAIN01').length,1);assert.equal(skipBirth(a,catalog),a);assert.deepEqual(saved(a),a);}
 const a=skipBirth(choose(born(),'MAIN01_3'),catalog);assert.equal(a.storyHistory.find(h=>h.eventId==='MAIN01').choiceId,'MAIN01_3');
});
test('adult quick start and old saves have no new prologue; generic event progression also completes it',()=>{
 const adult=born({startAt:'adult'});assert.equal(adult.age,18);assert.equal(adult.childhood.birth,undefined);assert.ok(!isBirthIntro(adult));
 for(const age of [0,6,18]){const old=createRun(options,catalog);if(age)Object.assign(old,{age,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[]});const s=saved(old);assert.equal(s.childhood.birth,undefined);assert.ok(!isBirthIntro(s));}
 let s=continueStory(choose(born()),catalog);assert.equal(s.childhood.birth.complete,true);assert.deepEqual(saved(s),s);s=nextTurn(s,catalog);assert.ok(s.age>0);assert.deepEqual(saved(s),s);
});
test('corrupt birth progress is rejected instead of trapping a loaded game',()=>{
 for(const birth of [null,{}, {version:1,page:-1,complete:false},{version:1,page:3,complete:false},{version:1,page:.5,complete:false},{version:1,page:0,complete:'false'},{version:2,page:0,complete:false}]){const s=born();s.childhood.birth=birth;assert.throws(()=>encodeSave(s));}
 for(const change of [s=>s.age=6,s=>s.phase='planning',s=>s.activeEvent=null,s=>s.activeEvent.eventId='MAIN02']){const s=born();change(s);assert.throws(()=>encodeSave(s));}
});
