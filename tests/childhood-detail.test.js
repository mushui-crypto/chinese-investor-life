import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRun,chooseEvent,continueStory,nextTurn,eligibleChoices,getEventCandidates} from '../src/game/narrative.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const data=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?data.events:data;}setSaveCatalog(catalog);
const byId=id=>catalog.events.find(e=>e.id===id);
function atEvent(e,choice=e.choices[0],outcome=choice.outcomes[0]){
 const s=createRun({seed:'childhood-detail',familyId:'F01'},catalog);
 Object.assign(s,{age:e.age_min,cash:0,phase:'event',eventQueue:[],dueAnchors:[],activeEvent:{eventId:e.id,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes[0].id]))}});
 s.activeEvent.outcomes[choice.id]=outcome.id;return s;
}
test('every preschool story outcome preserves cash and adult/academic stats',()=>{
 const events=catalog.events.filter(e=>e.age_max<6);
 assert.equal(events.length,16);
 for(const e of events)for(const c of e.choices)for(const o of c.outcomes){
  const s=atEvent(e,c,o),snapshot=structuredClone(s),n=chooseEvent(s,e.id,c.id,catalog);
  assert.equal(n.lastResult.error,undefined,`${e.id}/${c.id}`);
  for(const key of ['academic','skill','fame','credit'])assert.equal(n.stats[key],s.stats[key],`${o.id}/${key}`);
  for(const key of ['cash','familyReserve','adultGift','monthlyIncome','rng','marketProgress'])assert.deepEqual(n[key],s[key]);
  assert.equal(n.lastResult.text,o.text);assert.deepEqual(s,snapshot);
  assert.equal(n.phase,'result');assert.equal(n.storyHistory.at(-1).outcomeId,o.id);
 }
});
test('school stories teach school subjects without professional skill or fame rewards',()=>{
 for(let age=6;age<=16;age++){
  const e=byId(`AGE${String(age).padStart(2,'0')}A`),c=e.choices[0],s=atEvent(e),n=chooseEvent(s,e.id,c.id,catalog);
  assert.ok(n.stats.academic>s.stats.academic,`age ${age}`);
  assert.equal(n.stats.skill,s.stats.skill);assert.equal(n.stats.fame,s.stats.fame);
 }
});
test('market, vocational and pre-adult stories respect their childhood age gates',()=>{
 const s=atEvent(byId('AGE06A'));s.activeEvent=null;
 const ids=age=>{s.age=age;return new Set(getEventCandidates(s,catalog).map(e=>e.id));};
 for(const age of [6,8,12,14,15]){
  const available=ids(age);for(const id of ['FAM02','FAM06','YOU02','YOU03','YOU05','YOU08'])assert.equal(available.has(id),false,`${age}/${id}`);
 }
 const sixteen=ids(16);for(const id of ['FAM06','YOU03'])assert.ok(sixteen.has(id));
 assert.equal(sixteen.has('FAM02'),false);assert.equal(sixteen.has('YOU02'),false);
 const seventeen=ids(17);for(const id of ['FAM02','YOU02','YOU05'])assert.ok(seventeen.has(id));assert.ok(seventeen.has('YOU08'));
 assert.doesNotMatch(byId('YOU08').prompt,/明天|最后一晚/);
 assert.match(byId('AGE14A').prompt,/升学/);assert.doesNotMatch(byId('AGE14A').title,/分科/);
});
test('first pocket-money purchase costs one yuan exactly once, with a free zero-cash choice',()=>{
 const e=byId('MAIN02'),c=e.choices[0],s=atEvent(e);s.cash=100;
 const n=chooseEvent(s,e.id,c.id,catalog);assert.equal(n.lastResult.error,undefined);assert.equal(n.cash,0);
 const repeated=chooseEvent(n,e.id,c.id,catalog);assert.ok(repeated.lastResult.error);assert.equal(repeated.cash,0);
 const fail=atEvent(e,c,c.outcomes[1]);fail.cash=100;assert.equal(chooseEvent(fail,e.id,c.id,catalog).cash,100);
 const broke=atEvent(e);assert.ok(eligibleChoices(broke,e)[0].disabled);assert.ok(eligibleChoices(broke,e).slice(1).every(c=>!c.disabled));
 assert.equal(chooseEvent(broke,e.id,e.choices[1].id,catalog).lastResult.error,undefined);
});
test('a saved one-year-old coin event resolves the replacement scene without reroll or replay',()=>{
 const e=byId('AGE01B'),s=atEvent(e),restored=decodeSave(encodeSave(s));
 assert.deepEqual(restored,s);assert.equal(restored.activeEvent.eventId,'AGE01B');
 const n=chooseEvent(restored,e.id,e.choices[1].id,catalog);
 assert.equal(n.lastResult.title,'小布球藏哪儿了');assert.match(n.lastResult.text,/毛巾|布球/);
 assert.equal(n.rng,s.rng);assert.equal(n.cash,0);assert.deepEqual(decodeSave(encodeSave(n)),n);
 assert.equal(chooseEvent(n,e.id,e.choices[1].id,catalog).seenEvents.filter(id=>id===e.id).length,1);
});
test('normal progression across all preschool years cannot acquire wages, allowance or academic training',()=>{
 for(const pick of [0,1,2]){
  let s=createRun({seed:`early-child-${pick}`,familyId:'F01'},catalog),base=structuredClone(s);
  for(let guard=0;s.age<6&&guard<100;guard++){
   if(s.phase==='event'){const e=byId(s.activeEvent.eventId);s=chooseEvent(s,e.id,e.choices[pick].id,catalog);}
   else s=s.phase==='result'?continueStory(s,catalog):nextTurn(s,catalog);
   assert.equal(s.lastResult?.error,undefined);
   if(s.age<6){assert.equal(s.cash,0);assert.equal(s.stats.academic,base.stats.academic);assert.equal(s.stats.skill,base.stats.skill);}
  }
  assert.equal(s.age,6);assert.ok(s.cash>0);assert.equal(s.monthlyIncome,0);
 }
});
test('the content authoring pass preserves all saved IDs, delayed edges and outcome weights and is repeatable',()=>{
 const code=`import sys,json;sys.path.insert(0,'scripts')\nfrom expand_random_events import expand_random_events\nfrom refine_childhood_events import refine_childhood_events\nes=json.load(sys.stdin)\nexpand_random_events(es)\nrefine_childhood_events(es)\nrefine_childhood_events(es)\nprint(json.dumps(es,ensure_ascii=False))`;
 const rebuilt=JSON.parse(execFileSync('python3',['-c',code],{input:JSON.stringify(catalog.events),maxBuffer:8*1024*1024}));
 assert.deepEqual(rebuilt,catalog.events);
 for(const e of catalog.events)for(const c of e.choices)assert.equal(c.outcomes.reduce((n,o)=>n+o.weight,0),100);
});
