import {updateJourney} from '../src/game/play-guide.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createPlayableRun} from '../src/game/quick-start.js';import {act} from '../src/game/narrative.js';
import {ensureRoutine,resetRoutineDay,dayOptions,DAILY_EVENTS,dailyEventPool} from '../src/game/day-routine.js';import {dailyScene,DAILY_SCENES} from '../src/ui/daily-scene.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(fs.readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(wage=0,stage=1){const s=createPlayableRun({seed:'scene-unit',familyId:'F01',startAt:'adult'},catalog);Object.assign(s,{age:25,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],monthlyIncome:wage,cash:1e7,presentations:[]});s.journey.lastAction='day_next';s.behavior.pending=null;s.lifeArcs.pending=null;ensureRoutine(s);resetRoutineDay(s,stage);return s;}
test('daily scene selection is read-only, including uninitialised legacy clocks',()=>{const s=adult();delete s.dayRoutine;const before=structuredClone(s);assert.ok(dailyScene(s));assert.deepEqual(s,before);});
test('unemployed and retired routines stay outside the office; home market and night have separate scenes',()=>{const free=adult();assert.equal(dailyScene(free).key,'job-search');const retired=adult(120000);retired.occupation='退休';assert.equal(dailyScene(retired).key,'outside');assert.equal(dailyScene(adult(320000)).key,'work');const home=adult(0,0);home.dayRoutine.choices[0]='phone';assert.equal(dailyScene(home).key,'home-trading');assert.equal(dailyScene(adult(0,7)).key,'night');});
test('a real activity and resolved family call retain their scenes through save and reload',()=>{let s=adult(320000);s=act(s,{type:'day_activity',choice:'slack'},catalog);assert.equal(s.lastResult.error,undefined);assert.equal(dailyScene(decodeSave(encodeSave(s))).key,'slack');resetRoutineDay(s,5);s.dayRoutine.pending='family';assert.equal(dailyScene(s).key,'phone');s=updateJourney(s,act(s,{type:'day_event_choice',choice:'talk'},catalog),{type:'day_event_choice',choice:'talk'});assert.equal(dailyScene(decodeSave(encodeSave(s))).key,'phone');});
test('story choices, childhood, prison and endings keep their own scenes',()=>{for(const patch of [{age:6},{phase:'event'},{phase:'result'},{age:80},{legal:{prisonMonthsLeft:1}}])assert.equal(dailyScene(Object.assign(adult(),patch)),null);});
test('every daily option has a installed illustration and no render changes the RNG',()=>{for(const wage of [0,320000])for(let stage=0;stage<=8;stage++){const s=adult(wage,stage);for(const [choice] of dayOptions(s)){s.dayRoutine.choices[stage]=choice;const before=structuredClone(s),v=dailyScene(s);assert.ok(DAILY_SCENES[v.key]);assert.ok(fs.existsSync(new URL('../'+v.src,import.meta.url)));assert.deepEqual(s,before);}}});

function student(stage){const s=adult(0,stage);s.age=18;s.occupation='大学生';s.education.college=true;return s;}
function action(s,a){const after=updateJourney(s,act(s,a,catalog),a);assert.equal(after.lastResult?.error,undefined,after.lastResult?.text);return after;}
function quiet(s){s.dayRoutine.checked=['event'];s.dayRoutine.recent=['overtime'];return s;}
test('finishing lunch rest enters afternoon self-study, including save/reload and stale legacy receipts',()=>{
 const before=quiet(student(2)),after=action(before,{type:'day_activity',choice:'nap'});
 assert.equal(after.dayRoutine.stage,3);assert.equal(dailyScene(after).key,'study-day');
 assert.equal(dailyScene(decodeSave(encodeSave(after))).key,'study-day');
 after.lastResult.sceneContext={day:after.trading.day,stage:2,action:'rest'};
 after.journey.lastAction='rest';assert.equal(dailyScene(after).key,'study-day');
});
test('breakfast, class, work, evening gigs and overtime follow the clock they actually reach',()=>{
 for(const [s,choice,stage,key] of [[student(0),'breakfast',1,'college'],[student(1),'attend_class',2,'meal'],[student(3),'coursework',4,'study-day'],[adult(320000,1),'focus',2,'meal'],[adult(0,5),'night_gig',6,'bedtime']]){
  const after=action(quiet(s),{type:'day_activity',choice});assert.equal(after.dayRoutine.stage,stage);assert.equal(dailyScene(after).key,key,choice);
 }
 const s=quiet(adult(320000,5));s.dayRoutine.pending='overtime';
 const after=action(s,{type:'day_event_choice',choice:'accept'});assert.equal(after.dayRoutine.stage,6);assert.equal(dailyScene(after).key,'bedtime');
});
test('taking the night market and then sleeping never leaves yesterday\'s screen behind',()=>{
 const before=quiet(adult(0,6)),late=action(before,{type:'day_activity',choice:'stay'});
 assert.equal(late.dayRoutine.stage,7);assert.equal(dailyScene(late).key,'night');
 const next=action(late,{type:'day_next'});assert.equal(next.dayRoutine.stage,next.dayRoutine.wakeKind==='late'?2:0);assert.equal(dailyScene(next).key,next.dayRoutine.wakeKind==='late'?'meal':'breakfast');
});
test('employment, college, leave, new-job and self-employment produce different daytime places',()=>{
 for(const stage of [1,3,4]){
  const employed=adult(320000,stage);assert.equal(dailyScene(employed).key,'work');
  employed.behavior.leaveDays=1;assert.equal(dailyScene(employed).key,'rest');
  employed.behavior.leaveDays=0;employed.behavior.jobStartsTomorrow=true;assert.equal(dailyScene(employed).key,'rest');
  assert.equal(dailyScene(student(stage)).key,stage===1?'college':'study-day');
  const shop=adult(0,stage);shop.businesses=[{name:'自己的小店'}];assert.equal(dailyScene(shop).key,'gig');assert.match(dailyScene(shop).title,/生意/);
 }
});
test('event branches preserve their own place and activity only within the same slot',()=>{
 const s=quiet(student(6));s.dayRoutine.pending='exam_week';assert.equal(dailyScene(s).key,'study-night');
 const study=action(s,{type:'day_event_choice',choice:'study'}),chart=action(s,{type:'day_event_choice',choice:'chart'});
 assert.equal(dailyScene(study).key,'study-night');assert.equal(dailyScene(chart).key,'night');
 assert.equal(dailyScene(decodeSave(encodeSave(study))).key,'study-night');
 chart.trading.day++;chart.dayRoutine.day++;chart.dayRoutine.stage=0;assert.equal(dailyScene(chart).key,'breakfast');
 const commute=adult(320000,1);commute.dayRoutine.pending='commute';assert.equal(dailyScene(commute).key,'commute');
 const phone=student(6);phone.dayRoutine.pending='unread_family';assert.equal(dailyScene(phone).key,'phone-night');
 assert.equal(dailyScene(action(phone,{type:'day_event_choice',choice:'text'})).key,'bedtime');
});
test('closed A-share screens use review copy, and every eligible event has an installed time-appropriate asset',()=>{
 for(const [stage,choice,term] of [[0,'phone','九点半'],[4,'review','收盘'],[5,'review','收盘']]){const s=adult(0,stage);s.dayRoutine.choices[stage]=choice;assert.match(dailyScene(s).line,new RegExp(term));}
 const roles=[student(1),adult(320000),adult(0),Object.assign(adult(120000),{occupation:'退休',age:65})];
 for(const s of roles)for(let stage=0;stage<=8;stage++){
  resetRoutineDay(s,stage);for(const id of dailyEventPool(s)){
   s.dayRoutine.pending=id;const before=structuredClone(s),v=dailyScene(s);
   assert.ok(fs.existsSync(new URL('../'+v.src,import.meta.url)),id+':'+v.src);
   if(stage>=6)assert.ok(['phone-night','study-night','bedtime','sleep','night'].includes(v.key),id+':'+v.key);
   assert.deepEqual(s,before);
  }
 }
 assert.ok(Object.keys(DAILY_EVENTS).length>40);
});
test('malformed optional scene context is rejected without affecting old saves',()=>{
 const s=adult();s.lastResult={title:'场景',text:'',sceneContext:{day:s.trading.day,stage:99,action:'rest'}};
 assert.throws(()=>decodeSave(encodeSave(s)),/场景/);delete s.lastResult.sceneContext;assert.ok(decodeSave(encodeSave(s)));
});
