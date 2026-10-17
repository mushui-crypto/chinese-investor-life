import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlayableRun} from '../src/game/quick-start.js';
import {continueChildhood} from '../src/game/childhood.js';
import {createRun,chooseEvent,continueStory,nextTurn,eligibleChoices,getEventPresentation,getEventCandidates} from '../src/game/narrative.js';
import {isTeenStory,TEEN_STORY_STEPS} from '../src/game/teen-stories.js';
import {seedStudentStories,queueStudentStory,isStudentStory,studentEventWeight,studentChoice,studentPresentation,STUDENT_TRAITS,STUDENT_AGES} from '../src/game/student-stories.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {eventArt,resultArtKey} from '../src/ui/event-art.js';
import {currentResultCopy} from '../src/game/story-presentation.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const d=JSON.parse(fs.readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?d.events:d;}setSaveCatalog(catalog);
const byId=id=>catalog.events.find(e=>e.id===id),save=s=>decodeSave(encodeSave(s));
function fixture(id){
 const e=byId(id),s=createRun({seed:'student-fixture',familyId:'F01'},catalog);
 Object.assign(s,{age:e.age_min,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000});s.studentStories.traits.riskTaking=30;
 s.seenEvents=TEEN_STORY_STEPS.map(x=>x.id);
 queueStudentStory(s,{events:[byId(id.replace('_MORE',''))]});s.studentStories.pending=id;s.eventQueue=[id];
 return continueStory(s,catalog);
}
function play(seed,preference='allin',birthYear=1988){
 let s=createPlayableRun({seed,familyId:'F01',startAt:'teen',birthYear},catalog);
 for(let guard=0;s.age<18&&guard<100;guard++){
  if(s.phase==='event'&&(isStudentStory(s.activeEvent.eventId)||isTeenStory(s.activeEvent.eventId))){const e=byId(s.activeEvent.eventId),cs=eligibleChoices(s,e).filter(c=>!c.disabled);const c=cs.find(c=>c.studentAction===preference)||cs.find(c=>c.studentAction==='leave')||cs[0];s=chooseEvent(s,e.id,c.id,catalog);assert.equal(s.lastResult.error,undefined);}
  else s=continueChildhood(s,catalog,{fast:true});
 }
 assert.equal(s.age,18);return s;
}
test('forty core scenes cover eight lines at five school stages; only the matching selected scene can enter the pool',()=>{
 const cores=catalog.events.filter(e=>e.studentStory&&!e.studentStory.followup);assert.equal(cores.length,40);
 for(const age of STUDENT_AGES)assert.equal(cores.filter(e=>e.age_min===age&&e.age_max===age).length,8);
 const s=createRun({seed:'pool'},catalog);s.age=13;s.activeEvent=null;s.eventQueue=[];
 assert.equal(getEventCandidates(s,catalog).filter(e=>e.studentStory).length,0);
 queueStudentStory(s,catalog);assert.equal(s.studentStories.selected.length,1);assert.equal(s.studentStories.selected[0].slot,3);
});
test('48 fresh lives cross lines and retain exactly five deliberate decisions alongside all protected teen stories',()=>{
 const signatures=new Set(),bySlot=STUDENT_AGES.map(()=>new Set());let cross=0;
 for(let seed=0;seed<48;seed++){
  const s=play('variety-'+seed,seed%2?'observe':'allin'),h=s.studentStories.history.filter(h=>!h.followup);
  assert.equal(h.length,5);assert.deepEqual(h.map(h=>h.age),STUDENT_AGES);assert.equal(s.studentStories.summary.events.length,5);
  h.forEach((h,i)=>bySlot[i].add(h.line));signatures.add(h.map(h=>h.line).join(''));if(new Set(h.map(h=>h.line)).size>=3)cross++;
  assert.deepEqual(s.storyHistory.filter(h=>isTeenStory(h.eventId)).map(h=>h.eventId),TEEN_STORY_STEPS.map(h=>h.id));
  assert.deepEqual(save(s),s);
 }
 assert.ok(signatures.size>=40);assert.ok(cross>=40);for(const lines of bySlot)assert.equal(lines.size,8);
});
test('selection is driven by actual choice history and relationships as well as traits',()=>{
 const s=fixture('STU_A1'),d=byId('STU_D3'),f=byId('STU_F3'),e=byId('STU_E3');
 const baseD=studentEventWeight(s,d),baseF=studentEventWeight(s,f),baseE=studentEventWeight(s,e);
 s.studentStories.history.push({line:'A',variant:'loss',action:'borrow',resource:'marbles'});
 assert.ok(studentEventWeight(s,d)>baseD);assert.ok(studentEventWeight(s,f)>baseF);
 s.studentStories.traits.analysis=90;assert.ok(studentEventWeight(s,e)>baseE);
 const before=studentEventWeight(s,f);s.studentStories.friend.relationship=90;assert.ok(studentEventWeight(s,f)>before);
 const risk=play('diverge','allin'),observe=play('diverge','observe');
 assert.notDeepEqual(risk.studentStories.traits,observe.studentStories.traits);
 assert.notDeepEqual(risk.studentStories.selected,observe.studentStories.selected);
});
test('same choices and seed reproduce; birth year does not constrain age-appropriate availability',()=>{
 assert.deepEqual(play('replay'),play('replay'));
 for(const year of [1950,1988,2008])assert.deepEqual(play('school-years','observe',year).studentStories.history.filter(h=>!h.followup).map(h=>h.age),STUDENT_AGES);
});
test('fast-forward and advancing cannot skip a pending core event; reload and repeated rendering do not reroll',()=>{
 const s=createPlayableRun({seed:'fast-student',startAt:'teen'},catalog),before=structuredClone(s);
 assert.equal(s.age,6);assert.ok(isStudentStory(s.activeEvent.eventId));
 assert.deepEqual(continueChildhood(s,catalog,{fast:true}),before);assert.ok(nextTurn(s,catalog).lastResult.error);
 const e=byId(s.activeEvent.eventId);for(let i=0;i<5;i++){eligibleChoices(s,e);getEventPresentation(s,e,catalog);}
 assert.deepEqual(s,before);assert.deepEqual(save(s),before);
 const c=eligibleChoices(s,e).find(c=>!c.disabled);assert.deepEqual(chooseEvent(s,e.id,c.id,catalog),chooseEvent(save(s),e.id,c.id,catalog));
});
test('all 912 school outcome branches settle real cash or age-appropriate tokens exactly once, with coherent receipts',()=>{
 let count=0;
 for(const e of catalog.events.filter(e=>e.studentStory)){
  const s=fixture(e.id);
  for(const c of eligibleChoices(s,e).filter(c=>!c.disabled))for(const o of c.outcomes){
   const before=structuredClone(s);before.activeEvent.outcomes[c.id]=o.id;
   const n=chooseEvent(before,e.id,c.id,catalog);assert.equal(n.lastResult.error,undefined,o.id);
   assert.equal(n.cash-before.cash,o.studentResolution.delta*100,o.id);assert.ok(n.cash>=0);
   assert.ok(n.studentStories.resources.available>=0);assert.deepEqual(n.debts,before.debts);assert.deepEqual(n.positions,before.positions);
   if(e.age_max<16&&e.studentStory.resource!=='packs')assert.equal(n.cash,before.cash);
   if(e.studentStory.resource==='packs')assert.ok(before.cash-n.cash<=1200);
   if(e.studentStory.resource==='cash')assert.ok(Math.abs(n.cash-before.cash)<=10000);
   assert.doesNotMatch(n.lastResult.text,/这一次的选择留下了具体的结果/);
   assert.deepEqual(currentResultCopy(n,catalog),n.lastResult);
   const duplicate=chooseEvent(n,e.id,c.id,catalog);assert.ok(duplicate.lastResult.error);assert.deepEqual(duplicate.studentStories,n.studentStories);assert.equal(duplicate.cash,n.cash);
   for(const key of STUDENT_TRAITS)assert.ok(Number.isFinite(n.studentStories.traits[key]));count++;
  }
 }
 assert.ok(count>=850,`checked ${count}`);
});
test('opening packets costs money whether the card is found or not; a followup stays in the same core slot',()=>{
 const s=fixture('STU_A2'),e=byId('STU_A2'),c=eligibleChoices(s,e).find(c=>c.studentAction==='buy');
 for(const variant of ['win','loss']){
  const before=structuredClone(s);before.activeEvent.outcomes[c.id]=c.outcomes.find(o=>o.studentOutcome===variant).id;
  const n=chooseEvent(before,e.id,c.id,catalog);assert.equal(n.cash,s.cash-200);
  if(variant==='loss'){assert.equal(n.studentStories.pending,'STU_A2_MORE');const next=continueStory(save(n),catalog);assert.equal(next.age,10);assert.equal(next.activeEvent.eventId,'STU_A2_MORE');assert.equal(next.studentStories.selected.length,1);assert.equal(next.studentStories.resources.available,5);}
 }
});
test('exhausted packet budget disables another purchase but always permits stopping',()=>{
 const s=fixture('STU_D2'),e=byId('STU_D2'),c=eligibleChoices(s,e).find(c=>c.studentAction==='allin');s.activeEvent.outcomes[c.id]=c.outcomes.find(o=>o.studentOutcome==='loss').id;
 const n=continueStory(chooseEvent(s,e.id,c.id,catalog),catalog),choices=eligibleChoices(n,byId(n.activeEvent.eventId));
 assert.equal(n.activeEvent.eventId,'STU_D2_MORE');assert.ok(choices.find(c=>c.studentAction==='chase').disabled);assert.ok(!choices.find(c=>c.studentAction==='leave').disabled);
});
test('risk opens a special arcade choice, and earlier analysis changes relevant outcome weights without guaranteeing a win',()=>{
 const s=fixture('STU_A3'),e=byId('STU_A3');s.studentStories.traits.riskTaking=10;assert.equal(eligibleChoices(s,e).length,4);s.studentStories.traits.riskTaking=20;assert.equal(eligibleChoices(s,e).length,5);
 const sports=fixture('STU_E4'),ev=byId('STU_E4'),c=ev.choices[1];const before=studentChoice(sports,ev,c).outcomes.find(o=>o.studentOutcome==='win').weight;
 sports.studentStories.traits.analysis=90;const after=studentChoice(sports,ev,c);assert.ok(after.outcomes.find(o=>o.studentOutcome==='win').weight>before);assert.ok(after.outcomes.find(o=>o.studentOutcome==='loss').weight>0);
});
test('streak variants require a real preceding outcome; graduation does not invent prior losses or a shared marble game',()=>{
 const s=fixture('STU_A5'),e=byId('STU_A5');assert.match(studentPresentation(s,e).prompt,/阿川把自己小时候/);
 assert.doesNotMatch(eligibleChoices(s,e).find(c=>c.studentAction==='chase').label,/赢回来/);
 const cs=eligibleChoices(s,e);assert.ok(cs.flatMap(c=>c.outcomes).filter(o=>o.studentOutcome?.startsWith('streak')).every(o=>o.weight===0));
 const f=fixture('STU_F5');f.studentStories.friend.relationship=30;assert.match(eligibleChoices(f,byId('STU_F5')).find(c=>c.studentAction==='partner').label,/各算各的/);
});
test('borrowing tokens leaves a remembered obligation, never a financial loan or cash',()=>{
 const s=fixture('STU_D3'),e=byId('STU_D3'),c=eligibleChoices(s,e).find(c=>c.studentAction==='borrow');s.activeEvent.outcomes[c.id]=c.outcomes.find(o=>o.studentOutcome==='loss').id;
 const n=chooseEvent(s,e.id,c.id,catalog);assert.equal(n.studentStories.friend.borrowed,3);assert.equal(n.cash,s.cash);assert.deepEqual(n.debts,s.debts);assert.equal(n.studentStories.resources.available,2);
 s.studentStories.friend.relationship=30;assert.ok(eligibleChoices(s,e).find(c=>c.studentAction==='borrow').disabled);
});
test('legacy adults are not rewound; malformed school state is rejected',()=>{
 const s=createRun({seed:'legacy-school'},catalog);delete s.studentStories;s.age=25;s.phase='planning';s.activeEvent=null;s.eventQueue=[];s.dueAnchors=[];
 assert.equal(continueStory(save(s),catalog).studentStories,undefined);
 for(const mutate of [s=>s.studentStories.traits.chasing=101,s=>s.studentStories.rng=-1,s=>s.studentStories.friend.borrowed=40,s=>s.studentStories.selected.push({...s.studentStories.selected[0]}),s=>s.studentStories.pending='STU_Z1']){const n=fixture('STU_A1');mutate(n);assert.throws(()=>encodeSave(n));}
});
test('all school images exist as native 3:1 illustrations and do not hijack college profit art',()=>{
 const keys=new Set();for(const e of catalog.events.filter(e=>e.studentStory)){
  const s=fixture(e.id),art=eventArt(e.id,s,e);keys.add(art.key);assert.equal(art.key,`student-${e.studentStory.art}`);
  const png=fs.readFileSync(new URL('../'+art.src.replace('./',''),import.meta.url));assert.equal(png.readUInt32BE(16),3*png.readUInt32BE(20),art.src);
  const c=eligibleChoices(s,e).find(c=>!c.disabled),n=chooseEvent(s,e.id,c.id,catalog);assert.equal(resultArtKey(n,n.lastResult),art.key);
 }
 assert.equal(keys.size,10);
 const college={age:19,education:{college:true}};assert.match(eventArt('x',college,{id:'x'},'student-profit').src,/dorm\/profit/);
});
