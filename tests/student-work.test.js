import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,eligibleChoices,chooseEvent,getEventPresentation} from '../src/game/narrative.js';
import {applyAction,applyEffects,advanceTurn,getActionAvailability,getMetrics} from '../src/game/core.js';
import {isCollegeStudent} from '../src/game/education.js';
import {hasSalariedJob} from '../src/game/work-economy.js';
import {rebuildOffers,advanceLifeDays} from '../src/game/life-arcs.js';
import {dayOptions,ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {decodeSave,encodeSave,setSaveCatalog} from '../src/game/storage.js';
import {renderDailyStatus} from '../src/ui/day-routine.js';
import {renderEmployment} from '../src/ui/employment.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
function student(age=18){const s=createRun({seed:'student-work',familyId:'F01'},catalog);Object.assign(s,{age,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],giftReceived:true,cash:10000000,occupation:'大学生'});s.education.college=true;s.flags.college_student=true;s.stats.skill=70;s.stats.trust=80;s.relationships.N04=80;s.peopleMet=['N10','N04','N07','N12'];ensureRoutine(s);resetRoutineDay(s);return s;}
const ok=o=>{assert.equal(o.result.error,undefined,o.result.error);return o.state;};
const reload=s=>decodeSave(encodeSave(s));
test('enrolled students cannot get fixed wages through direct, daily, story or referral routes',()=>{
 for(const age of [18,20,21.5]){
  const s=student(age),before=structuredClone(s);
  assert.equal(getActionAvailability(s,{type:'seek_job'}).allowed,false);
  assert.equal(applyAction(s,{type:'seek_job'}).state,s);
  assert.equal(applyEffects(s,[{op:'flag',key:'employed',value:true}],{profile:'job'}).state,s);
  s.dayRoutine.stage=1;assert.ok(!dayOptions(s).some(o=>o[0]==='job_hunt'));
  assert.ok(applyAction(s,{type:'day_activity',choice:'job_hunt'}).result.error);
  for(const id of ['referral','apprentice','reentry']){assert.equal(rebuildOffers(s).find(o=>o.id===id).allowed,false);assert.ok(applyAction(s,{type:'life_offer',id}).result.error);}
  s.dayRoutine.stage=before.dayRoutine.stage;assert.deepEqual(s,before);
 }
});
test('college half-day and evening jobs pay once, keep student status and have no fixed salary',()=>{
 for(const [stage,choice] of [[1,'day_gig'],[5,'night_gig']]){
  const s=student();s.dayRoutine.stage=stage;
  const next=ok(applyAction(s,{type:'day_activity',choice}));
  assert.ok(next.cash>s.cash);assert.equal(next.monthlyIncome,0);assert.ok(isCollegeStudent(next));
  assert.equal(next.cash-s.cash,next.ledger.slice(s.ledger.length).filter(e=>e.account==='cash').reduce((n,e)=>n+e.amount,0));
  assert.ok(applyAction(next,{type:'day_activity',choice}).result.error);assert.deepEqual(reload(next),next);
 }
});
test('adulthood story offers part-time contact to students without lying about a salary',()=>{
 const event=catalog.events.find(e=>e.id==='MAIN04'),s=student();s.phase='event';
 const choice=eligibleChoices(s,event).find(c=>c.id==='MAIN04_1');assert.equal(choice.label,'找份课余兼职');assert.ok(!choice.disabled);
 for(const outcome of choice.outcomes){const current=structuredClone(s);current.activeEvent={eventId:event.id,outcomes:Object.fromEntries(event.choices.map(c=>[c.id,c.id===choice.id?outcome.id:c.outcomes[0].id]))};const n=chooseEvent(current,event.id,choice.id,catalog);assert.ok(!n.lastResult.error);assert.equal(n.monthlyIncome,0);assert.equal(n.occupation,'大学生');assert.equal(n.cash,current.cash);assert.deepEqual(reload(n),n);}
 assert.match(getEventPresentation(s,event,catalog).prompt,/课余兼职/);
});
test('four-year college graduates at 22; noncollege adults can seek a job from 18',()=>{
 const before=student(21.5);assert.ok(isCollegeStudent(before));
 const s=ok(advanceTurn(before));assert.equal(s.age,22);assert.ok(s.education.graduated);assert.equal(s.flags.college_student,false);assert.equal(s.occupation,'应届毕业生');assert.ok(getActionAvailability(s,{type:'seek_job'}).allowed);assert.ok(ok(applyAction(s,{type:'seek_job'})).monthlyIncome>0);
 const other=student();other.education.college=false;other.flags.college_student=false;other.flags.college_not_admitted=true;other.occupation='待业青年';assert.ok(getActionAvailability(other,{type:'seek_job'}).allowed);
});
test('legacy student salaries stop without changing paid cash, and migration only runs once',()=>{
 const old=student(20);old.monthlyIncome=350000;old.occupation='专业职员';old.flags.employed=true;old.lifeArcs.wageRate=350000;
 assert.equal(hasSalariedJob(old),false);assert.equal(getMetrics(old).monthlyIncome,0);
 const n=reload(old);assert.equal(n.monthlyIncome,0);assert.equal(n.occupation,'大学生');assert.equal(n.flags.employed,false);
 for(const key of ['cash','ledger','rng','stats','storyHistory'])assert.deepEqual(n[key],old[key]);assert.deepEqual(reload(n),n);
 assert.match(renderEmployment(n,{esc:x=>x,money:x=>'¥'+x/100}),/22 岁毕业/);
 const help=renderDailyStatus(n,{esc:x=>x,money:x=>'¥'+x/100,icon:()=>''});assert.match(help,/22 岁毕业/);assert.doesNotMatch(help,/上午可求职|被开除/);
});
test('old scheduled formal jobs do not hire students; paid material fees are refunded once',()=>{
 const s=student(20);s.lifeArcs.jobs=[{id:'apprentice',due:0,kind:'work',pay:0,wage:240000}];const cash=s.cash,notes=[];
 advanceLifeDays(s,{cashChange:(s,n)=>s.cash+=n,stat:()=>{}},notes);assert.equal(s.monthlyIncome,0);assert.equal(s.cash,cash+20000);assert.equal(s.lifeArcs.jobs.length,0);
 advanceLifeDays(s,{cashChange:(s,n)=>s.cash+=n,stat:()=>{}},notes);assert.equal(s.cash,cash+20000);
});
