import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRun,act,chooseEvent,getEventCandidates,eligibleChoices} from '../src/game/narrative.js';
import {recordCryptoLifeEvent,recordCryptoLifeTrade} from '../src/game/crypto-life.js';
import {cryptoStoryChoice} from '../src/game/crypto-life-stories.js';
import {recordSchemeEvent,recordSchemeTrade,recordSchemeInterlude,schemeLifeState} from '../src/game/scheme-life.js';
import {schemeStoryChoice} from '../src/game/scheme-life-stories.js';
import {getActionAvailability} from '../src/game/core.js';
import {recordOnlineExposure,adjustOnlineTendencies} from '../src/game/online-gambling.js';
import {onlineStoryChoice} from '../src/game/online-gambling-stories.js';
import {LIFE_ENCOUNTERS} from '../src/game/life-encounters.js';
import {dailyEventPool,ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {selectStagePlan,offerStageEvent} from '../src/game/stage-plan.js';
import {chapterPause,advanceChapterStep,chapterTrip} from '../src/game/chapter-progress.js';
import {startJobSearch,jobSearchWait} from '../src/game/job-search.js';
import {ensureCareer} from '../src/game/careers.js';
import {updateJourney} from '../src/game/play-guide.js';
import {dailyScene} from '../src/ui/daily-scene.js';
import {eventArt,resultArtKey} from '../src/ui/event-art.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const name of ['events','families','characters','history','endings']){const x=JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url)));catalog[name]=name==='events'?x.events:x;}
setSaveCatalog(catalog);
const roundtrip=s=>decodeSave(encodeSave(s));
const stories=catalog.events.filter(e=>e.id.startsWith('ENC_'));
const prefixes={student:'COL',employed:'JOB',unemployed:'SEEK',self:'BIZ',retired:'RET'};
function fixture(role='student',stage=1){
 const s=createRun({seed:'life-encounters',familyId:'F01'},catalog);
 Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],pending:[],seenEvents:[],age:role==='student'?20:role==='retired'?67:30,cash:100000,occupation:role==='student'?'大学生':role==='retired'?'退休':role==='employed'?'普通职员':role==='self'?'个体经营':'离职待业',monthlyIncome:role==='employed'?300000:role==='retired'?200000:0});
 s.education.college=role==='student';s.flags.college_student=role==='student';s.flags.college_not_admitted=role!=='student';
 for(const key of Object.keys(s.stats))s.stats[key]=50;
 s.behavior.pending=null;s.lifeArcs.pending=null;s.behavior.fatigue=30;s.behavior.heat=0;s.household.livingParent=true;
 if(role==='self')s.businesses.push({id:'encounter-shop',name:'自己的小店',value:500000,monthlyProfit:10000,managedTurn:s.turn,openedTurn:s.turn,openedLifeDay:s.debtClock.day});
 if(role==='employed')ensureCareer(s);
 ensureRoutine(s);resetRoutineDay(s,stage);return s;
}
test('new stories respect actual identity, seen history, age and prison status',()=>{
 assert.equal(stories.length,12);
 for(const [role,prefix] of Object.entries(prefixes)){
  const s=fixture(role),found=getEventCandidates(s,catalog).filter(e=>e.id.startsWith('ENC_'));
  assert.ok(found.length);assert.ok(found.every(e=>e.id.startsWith(`ENC_${prefix}`)),role);
  s.seenEvents.push(...found.map(e=>e.id));assert.equal(getEventCandidates(s,catalog).filter(e=>e.id.startsWith('ENC_')).length,0);
  s.seenEvents=[];s.age=12;assert.equal(getEventCandidates(s,catalog).filter(e=>e.id.startsWith('ENC_')).length,0);
  s.age=67;s.legal.prisonMonthsLeft=3;assert.equal(getEventCandidates(s,catalog).filter(e=>e.id.startsWith('ENC_')).length,0);
 }
});
test('new daily encounters never treat paid leave as unemployment or a deceased parent as a caller',()=>{
 assert.equal(Object.keys(LIFE_ENCOUNTERS).length,30);
 const s=fixture('employed');s.behavior.leaveDays=1;
 for(const id of dailyEventPool(s))assert.ok(!LIFE_ENCOUNTERS[id]?.roles.some(r=>['unemployed','self'].includes(r)),id);
 const college=fixture();college.household.livingParent=false;assert.ok(!dailyEventPool(college).includes('weekend_call'));
});
test('every new encounter offers a cash-free route; optional spending is exact and cannot overdraft',()=>{
 for(const [id,e] of Object.entries(LIFE_ENCOUNTERS)){
  const s=fixture(e.roles[0]||'unemployed',e.stages[0]);s.cash=0;s.dayRoutine.pending=id;
  const free=e.choices.filter(([c])=>!e.effects[c].cost);assert.ok(free.length,id);
  for(const [choice]of free){assert.ok(getActionAvailability(s,{type:'day_event_choice',choice}).allowed,id);const n=act(s,{type:'day_event_choice',choice},catalog);assert.equal(n.cash,0);assert.equal(n.dayRoutine.pending,null);}
  for(const [choice]of e.choices.filter(([c])=>e.effects[c].cost)){
   const a={type:'day_event_choice',choice};assert.equal(getActionAvailability(s,a).allowed,false);
   const rejected=act(s,a,catalog);assert.equal(rejected.cash,0);assert.equal(rejected.dayRoutine.pending,id);
   s.cash=e.effects[choice].cost;const paid=act(s,a,catalog);assert.equal(paid.cash,0);assert.match(paid.ledger.at(-1).label,/日常事件/);assert.deepEqual(roundtrip(paid),paid);s.cash=0;
  }
 }
});
test('all authored story branches resolve once, preserve finances and employment, and survive saves',()=>{
 for(const e of stories)for(const choice of e.choices){
  const role=Object.keys(prefixes).find(r=>e.id.startsWith(`ENC_${prefixes[r]}`)),s=fixture(role);
  if(role==='unemployed')startJobSearch(s);
  s.cash=0;
  if(choice.cryptoSpecial){s.cash=100000;recordCryptoLifeEvent(s,{eventId:'CL01',action:'curious',exposure:true});recordCryptoLifeTrade(s,{kind:'crypto',cryptoLifeBranch:'spot'},{action:'buy',cashFlow:-10000});recordCryptoLifeTrade(s,{kind:'crypto',cryptoLifeBranch:'spot'},{action:'sell',cashFlow:50000,pnl:40000});s.behavior.cryptoLife.tendencies.bigWinMemory=10;s.debtClock.day+=180;s.behavior.onlineGambling.ordinaryEvents+=2;}
  if(choice.onlineSpecial){s.cash=100000;recordOnlineExposure(s,'curious');adjustOnlineTendencies(s,{chasing:10,confidence:10});}
  if(choice.schemeSpecial){recordSchemeEvent(s,{eventId:'CL22',action:'curious',exposure:true,projectKey:'fixture-paid',projectName:'长灯计划'});recordSchemeTrade(s,{id:'fixture-paid',cryptoLifeBranch:'scheme',name:'长灯计划'},{action:'payment',cashFlow:2500,pnl:2500});schemeLifeState(s).projects['fixture-paid'].trust=40;s.debtClock.day+=180;recordSchemeInterlude(s);recordSchemeInterlude(s);}
  s.phase='event';s.activeEvent={eventId:e.id,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes[0].id]))};
  assert.ok(eligibleChoices(s,e).every(c=>!c.disabled),e.id);
  const saved=roundtrip(s),n=chooseEvent(saved,e.id,choice.id,catalog),outcome=onlineStoryChoice(saved,e,choice).outcomes[0];
  if(choice.onlineSpecial){
   assert.equal(n.phase,'result');assert.equal(n.lastResult.error,undefined);assert.equal(n.lastResult.title,outcome.title);assert.equal(n.cash,s.cash+outcome.onlineResolution.net);assert.equal(n.behavior.onlineGambling.totalBets,1);
   for(const key of ['monthlyIncome','occupation','positions','debts','businesses','jobSearch'])assert.deepEqual(n[key],s[key],`${e.id} ${key}`);
   assert.deepEqual(roundtrip(n),n);assert.ok(chooseEvent(n,e.id,choice.id,catalog).lastResult.error);continue;
  }
  if(choice.cryptoSpecial){const dynamic=cryptoStoryChoice(saved,e,choice).outcomes[0];assert.equal(n.lastResult.error,undefined);assert.equal(n.phase,'result');assert.equal(n.lastResult.text,dynamic.text);assert.equal(n.behavior.cryptoLife.eventCounts[e.id],1);assert.equal(n.cash,s.cash);assert.deepEqual(roundtrip(n),n);continue;}
  if(choice.schemeSpecial){const dynamic=schemeStoryChoice(saved,e,choice).outcomes[0];assert.equal(n.lastResult.error,undefined);assert.equal(n.phase,'result');assert.equal(n.lastResult.text,dynamic.text);assert.equal(schemeLifeState(n).eventCounts[e.id],1);assert.equal(n.behavior.cryptoLife.eventCounts[e.id],undefined);for(const key of ['cash','monthlyIncome','occupation','positions','debts','businesses','jobSearch'])assert.deepEqual(n[key],s[key],`${e.id} ${key}`);assert.deepEqual(roundtrip(n),n);continue;}
  assert.equal(n.phase,'result');assert.equal(n.lastResult.error,undefined);assert.equal(n.lastResult.title,outcome.title);assert.equal(n.lastResult.text,outcome.text);
  for(const [key,delta]of Object.entries(outcome.effects[0].delta))assert.equal(n.stats[key],s.stats[key]+delta,`${e.id} ${choice.id} ${key}`);
  for(const key of ['cash','monthlyIncome','occupation','positions','debts','businesses','jobSearch'])assert.deepEqual(n[key],s[key],`${e.id} ${key}`);
  if(role==='unemployed')assert.equal(jobSearchWait(n),jobSearchWait(s));
  assert.deepEqual(roundtrip(n),n);const repeat=chooseEvent(n,e.id,choice.id,catalog);assert.ok(repeat.lastResult.error);assert.deepEqual(repeat.stats,n.stats);
  const art=eventArt(e.id,n,e,resultArtKey(n,n.lastResult));assert.ok(existsSync(new URL(`../${art.src}`,import.meta.url)));assert.ok(!/investment-profit|investment-loss|derivatives/.test(art.src));
  if(role==='student')assert.equal(art.location,'dorm');
 }
});
test('new daily artwork follows the encounter before and after a choice without drawing randomness',()=>{
 for(const [id,e]of Object.entries(LIFE_ENCOUNTERS)){
  const role=e.roles[0]||'student',s=fixture(role,e.stages[0]);s.dayRoutine.pending=id;
  const before=structuredClone(s),scene=dailyScene(s);assert.deepEqual(s,before);assert.ok(existsSync(new URL(`../${scene.src}`,import.meta.url)),id);
  if(role==='student')assert.equal(scene.location,'dorm',id);
  if(role==='retired'||role==='self')assert.equal(scene.environmentOnly,true,id);
  const action={type:'day_event_choice',choice:e.choices[0][0]},n=updateJourney(s,act(s,action,catalog),action);assert.equal(dailyScene(n).key,scene.key,id);
 }
});
test('stage progression pauses for a new encounter and resumes only after the player chooses',()=>{
 const s=fixture('student',0);s.cash=1000000;s.debtClock.day=60;s.debtClock.periodDays=60;
 selectStagePlan(s,'steady');const poolState=structuredClone(s);poolState.dayRoutine.stage=3;
 const pool=dailyEventPool(poolState),index=pool.indexOf('dorm_quiet');assert.ok(index>=0);
 assert.equal(offerStageEvent(s,{draw:()=> (index+.1)/pool.length}),true);assert.equal(s.dayRoutine.pending,'dorm_quiet');
 assert.equal(chapterPause(s).kind,'event');const resumed=roundtrip(s),before=structuredClone(resumed);
 const stopped=advanceChapterStep(resumed,catalog,chapterTrip(resumed));assert.equal(stopped.state.dayRoutine.pending,'dorm_quiet');assert.equal(stopped.state.debtClock.day,before.debtClock.day);assert.deepEqual(stopped.state.stats,before.stats);
 const n=act(resumed,{type:'day_event_choice',choice:'agree'},catalog);assert.equal(n.dayRoutine.pending,null);assert.equal(chapterPause(n),null);
 assert.equal(offerStageEvent(n,{draw:()=>{throw Error('same-day repeat');}}),false);
});
