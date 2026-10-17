import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,nextTurn,chooseEvent,continueStory,eligibleChoices} from '../src/game/narrative.js';
import {applyEffects,getMetrics,getActionAvailability,getWorkOffer,PRODUCTS} from '../src/game/core.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {ensureRoutine,resetRoutineDay,routineState,DAILY_EVENTS} from '../src/game/day-routine.js';
import {continuation} from '../src/game/continuation.js';
import {refreshBehavior,behaviorEvent} from '../src/game/behavior.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {fullDayPay} from '../src/game/work-economy.js';
import {quoteFor} from '../src/game/market-play.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(seed='pace',cash=1e7,wage=300000){const s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:wage,giftReceived:true});s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];s.stats.credit=80;s.stats.skill=50;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const go=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,JSON.stringify(a)+': '+n.lastResult?.error);assert.equal(n.cash-s.cash,n.ledger.slice(s.ledger.length).filter(e=>e.account==='cash').reduce((n,e)=>n+e.amount,0));return n;};
const save=s=>decodeSave(encodeSave(s));
function quiet(s){s.behavior.pending=null;s.behavior.seen=Object.keys(BEHAVIOR_EVENTS);return s;}

function clock(s,stage=0){ensureRoutine(s);resetRoutineDay(s,stage);return s;}
function clear(s){if(s.dayRoutine?.pending)s=go(s,{type:'day_event_choice',choice:s.dayRoutine.pending==='overtime'?'decline':DAILY_EVENTS[s.dayRoutine.pending].choices.at(-1)[0]});s.behavior.pending=null;s.lifeArcs.pending=null;return s;}
function until(s,stage){for(let n=0;routineState(s).stage!==stage&&n<15;n++)s=clear(go(clear(s),{type:'day_next'}));assert.equal(routineState(s).stage,stage);return s;}
const buyA=s=>({type:'desk_order',product:'stock',instrument:'chip',shares:100,amount:quoteFor(s,'stock','chip').price*100});
const buyBTC={type:'desk_order',product:'crypto',instrument:'BTCUSDT',amount:100000};
test('reading morning news preserves pre-open quotes and only the clock advances to 09:30',()=>{
 let s=clock(adult());const quotes=structuredClone(s.trading.quotes),world=structuredClone(s.trading.stockWorld),cash=s.cash,ap=s.actionPoints;
 s=go(s,{type:'day_activity',choice:'phone'});assert.equal(s.dayRoutine.stage,0);assert.deepEqual(s.trading.quotes,quotes);assert.deepEqual(s.trading.stockWorld,world);assert.equal(s.cash,cash);assert.equal(s.actionPoints,ap);
 assert.match(getActionAvailability(s,buyA(s)).reason,/09:30/);assert.match(s.lastResult.text,/盘前消息/);assert.deepEqual(save(s),s);
 assert.equal(getActionAvailability(s,{type:'day_activity',choice:'phone'}).allowed,false);
 s=clear(go(save(s),{type:'day_next'}));assert.equal(s.dayRoutine.stage,1);assert.ok(getActionAvailability(s,buyA(s)).allowed);assert.deepEqual(s.trading.quotes,quotes);assert.equal(s.debtClock.day,0);
});
test('daily clock covers wake, both A sessions, lunch, closing, off work and bedtime',()=>{
 let s=clock(adult());const stages=[];for(let i=0;i<7;i++){stages.push(routineState(s).stage);s=clear(go(clear(s),{type:'day_next'}));assert.deepEqual(save(s),s);}
 assert.deepEqual(stages,[0,1,2,3,4,5,6]);assert.equal(s.dayRoutine.stage,0);assert.equal(s.debtClock.day,1);assert.equal(s.survival.days,1);assert.equal(s.trading.phase,0);assert.equal(s.actionPoints,2);
});
test('A shares only trade during morning and afternoon, T+1 remains, BTC trades after close',()=>{
 let s=clock(adult());assert.equal(getActionAvailability(s,buyA(s)).allowed,false);s=until(s,1);s=clear(go(s,buyA(s)));const id=s.positions[0].id;
 assert.match(getActionAvailability(s,{type:'desk_sell',id,bps:10000}).reason,/T\+1/);s=until(s,2);assert.equal(getActionAvailability(s,buyA(s)).allowed,false);s=until(s,3);assert.ok(getActionAvailability(s,buyA(s)).allowed);
 s=until(s,4);const price=quoteFor(s,'stock','chip').price;assert.equal(getActionAvailability(s,buyA(s)).allowed,false);s=go(s,buyBTC);assert.equal(s.dayRoutine.stage,4);assert.equal(s.debtClock.day,0);s=until(s,6);assert.equal(quoteFor(s,'stock','chip').price,price);
 s=until(s,0);assert.equal(quoteFor(s,'stock','chip').price,price);s=until(s,1);assert.ok(getActionAvailability(s,{type:'desk_sell',id,bps:10000}).allowed);s=go(s,{type:'desk_sell',id,bps:10000});assert.ok(!s.positions.some(p=>p.id===id));
});
test('activities finish their slot without spending life AP and invalid choices are inert',()=>{
 let s=clock(adult()),cash=s.cash,ap=s.actionPoints;s=go(s,{type:'day_activity',choice:'breakfast'});assert.equal(s.cash,cash);assert.equal(s.actionPoints,ap);assert.equal(s.stats.health,71);assert.equal(getActionAvailability(s,{type:'day_activity',choice:'phone'}).allowed,false);const n=act(s,{type:'day_activity',choice:'friends'},catalog);assert.ok(n.lastResult.error);assert.equal(n.rng,s.rng);assert.equal(n.cash,s.cash);assert.deepEqual(save(s),s);
});
test('sleep debt survives reload, hurts the next workday, repeated late nights hurt health more',()=>{
 let s=clock(adult());s.behavior.fatigue=50;s=until(s,6);const health=s.stats.health;s=go(s,{type:'day_activity',choice:'stay'});assert.equal(s.dayRoutine.stage,7);assert.equal(s.debtClock.day,0);s=clear(go(save(s),{type:'day_next'}));assert.equal(s.dayRoutine.nightStreak,1);assert.equal(s.stats.health,health-1);assert.ok(s.behavior.fatigue>=65);assert.equal(s.survival.last.salary,0);assert.equal(s.survival.last.earned,9677);assert.equal(getWorkOffer(s).pay,Math.floor(fullDayPay(s)*.75));
 s=until(s,6);const secondNightHealth=s.stats.health,lateDeduction=s.dayRoutine.lateForWork?967:0;s=go(s,{type:'day_activity',choice:'stay'});s=clear(go(s,{type:'day_next'}));assert.equal(s.dayRoutine.nightStreak,2);assert.equal(s.stats.health,secondNightHealth-3);assert.equal(s.survival.last.salary,0);assert.equal(s.survival.last.earned,7258-lateDeduction);
 s=until(s,6);const fatigue=s.behavior.fatigue;s=go(s,{type:'day_activity',choice:'sleep'});assert.equal(s.dayRoutine.nightStreak,0);assert.ok(s.behavior.fatigue<fatigue);assert.deepEqual(save(s),s);
});
test('night quotes move crypto but leave the A share daily close unchanged',()=>{
 let s=until(clock(adult()),4),a=quoteFor(s,'stock','chip').price,b=quoteFor(s,'crypto','BTCUSDT').price;s=until(s,6);assert.equal(quoteFor(s,'stock','chip').price,a);assert.notEqual(quoteFor(s,'crypto','BTCUSDT').price,b);const day=s.debtClock.day;s=go(s,buyBTC);assert.equal(s.debtClock.day,day);assert.deepEqual(save(s),s);
});
test('overtime is a saved decision, once-only pay, and consumes the evening slot',()=>{
 let s=until(clock(adult()),5);s.dayRoutine.pending='overtime';const cash=s.cash;assert.equal(continuation(s).kind,'daily');assert.equal(getActionAvailability(s,{type:'live_days',days:30}).allowed,false);s=go(save(s),{type:'day_event_choice',choice:'accept'});assert.equal(s.cash-cash,2000);assert.equal(s.dayRoutine.stage,6);assert.equal(s.dayRoutine.choices[5],'overtime');assert.equal(s.ledger.filter(e=>e.label==='当晚加班收入').length,1);assert.equal(getActionAvailability(s,{type:'day_event_choice',choice:'accept'}).allowed,false);assert.deepEqual(save(s),s);
});
test('slacking has a deterministic once-per-shift check and a real wage consequence',()=>{
 let caught;
 for(let n=0;n<40&&!caught;n++){let s=clock(adult('boss-'+n),1);s=go(s,{type:'day_activity',choice:'slack'});if(s.dayRoutine.wagePenalty)caught=s;}
 assert.ok(caught);assert.match(caught.lastResult.text,/少 25%/);const rng=caught.rng;const reloaded=save(caught);assert.equal(reloaded.rng,rng);caught=until(caught,0);assert.equal(caught.survival.last.salary,0);assert.equal(caught.survival.last.earned,7258);assert.equal(caught.dayRoutine.wagePenalty,false);
});
test('unemployed days do not offer salary activities or unpaid overtime',()=>{
 let s=clock(adult('free',1e7,0),1);assert.equal(getActionAvailability(s,{type:'day_activity',choice:'focus'}).allowed,false);assert.ok(getActionAvailability(s,{type:'day_activity',choice:'learn'}).allowed);s=until(s,5);assert.notEqual(s.dayRoutine.pending,'overtime');
});
test('fast life preserves an already chosen late night, bills once, and finishes the period',()=>{
 let s=until(clock(adult()),6);s=go(s,{type:'day_activity',choice:'stay'});s=clear(go(s,{type:'live_days',days:1}));assert.equal(s.debtClock.day,1);assert.equal(s.dayRoutine.nightStreak,1);assert.equal(s.dayRoutine.stage,8);const cash=s.cash;s=go(s,{type:'day_next'});assert.equal(s.cash,cash);assert.equal(s.debtClock.day,1);assert.equal(s.dayRoutine.stage,s.dayRoutine.wakeKind==='late'?2:0);s=clear(s);
 for(let i=0;i<20&&s.debtClock.periodDays<180;i++)s=clear(go(s,{type:'live_days',days:Math.min(30,180-s.debtClock.periodDays)}));assert.equal(s.debtClock.periodDays,180);assert.equal(s.survival.livingAccrued,3240000);assert.deepEqual(save(s),s);s=nextTurn(s,catalog);assert.ok(!s.lastResult?.error);assert.deepEqual(save(s),s);
});
test('legacy saves infer time read-only; corrupt daily routine records are rejected',()=>{
 const s=adult(),original=structuredClone(s);routineState(s);continuation(s);assert.deepEqual(s,original);assert.deepEqual(save(s),s);
 for(const update of [r=>r.stage=9,r=>r.day++,r=>r.pending='made-up',r=>r.choices[2]='invalid',r=>r.nightStreak=-1]){const n=clock(adult());update(n.dayRoutine);assert.throws(()=>save(n));}
});
test('ordinary activities complete their time slot; trading choices preserve the session',()=>{
 for(const [stage,choice,target] of [[0,'breakfast',1],[0,'phone',0],[1,'focus',2],[1,'slack',1],[2,'nap',3],[2,'walk',3],[3,'focus',4],[3,'slack',3],[4,'stretch',5],[4,'review',4],[5,'friends',6],[5,'learn',6],[5,'rest',6],[5,'night_gig',6],[6,'stay',7],[6,'sleep',0]]){
  const s=clock(adult('activity-'+choice),stage);s.trading.phase=stage<2?0:stage<4?1:2;
  if(stage>1)s.dayRoutine.choices[1]='focus';
  const n=go(s,{type:'day_activity',choice,day:s.trading.day,stage});
  assert.equal(n.dayRoutine.stage,target,choice);assert.equal(n.actionPoints,s.actionPoints,choice);
  assert.equal(n.debtClock.day,s.debtClock.day+(choice==='sleep'?1:0),choice);
  assert.deepEqual(save(n),n);
 }
});
test('half-day work consumes its actual session and a stale click cannot pay twice',()=>{
 const s=clock(adult('half-shift',1e7,0),1),a={type:'day_activity',choice:'day_gig',day:s.trading.day,stage:1};
 const n=go(s,a);assert.equal(n.dayRoutine.stage,2);assert.ok(n.cash>s.cash);assert.equal(n.workday.units,1);
 const twice=act(save(n),a,catalog);assert.match(twice.lastResult.error,/时段已变化/);assert.equal(twice.cash,n.cash);assert.equal(twice.rng,n.rng);assert.deepEqual(twice.dayRoutine,n.dayRoutine);
});
test('normal continuation cannot bypass work; old choices and market visits do not double charge fatigue',()=>{
 let s=clock(adult('ordinary-work'),1),n=go(s,{type:'day_next'});
 assert.equal(n.stats.skill,s.stats.skill);assert.equal(n.behavior.fatigue,s.behavior.fatigue+3);assert.equal(n.dayRoutine.choices[1],'focus');
 const old=clock(adult('old-work'),1);old.dayRoutine.choices[1]='focus';old.behavior.fatigue=8;
 n=go(save(old),{type:'day_next'});assert.equal(n.behavior.fatigue,8);assert.equal(n.stats.skill,old.stats.skill);
 s=clock(adult('slack-session'),1);s=clear(go(s,{type:'day_activity',choice:'slack'}));const fatigue=s.behavior.fatigue,skill=s.stats.skill;
 s=clear(go(s,buyA(s)));assert.equal(s.behavior.fatigue,fatigue+5); // Existing risk-trade fatigue, no second work-distraction charge.
 s=go(s,{type:'day_next'});assert.equal(s.dayRoutine.stage,2);assert.equal(s.behavior.fatigue,fatigue+5);assert.equal(s.stats.skill,skill);
});
test('arriving events block further time and resolving them restores the current activity choices',()=>{
 let found;
 for(let i=0;i<80&&!found;i++){const s=clock(adult('activity-event-'+i),1);const n=go(s,{type:'day_activity',choice:'focus'});if(n.dayRoutine.pending)found=n;}
 assert.ok(found);assert.equal(found.dayRoutine.stage,2);const day=found.trading.day,stage=found.dayRoutine.stage;
 for(const action of [{type:'day_next'},{type:'day_activity',choice:'nap'},{type:'live_days',days:1}])assert.equal(getActionAvailability(found,action).allowed,false);
 const next=go(save(found),{type:'day_event_choice',choice:DAILY_EVENTS[found.dayRoutine.pending].choices.at(-1)[0]});
 assert.equal(next.trading.day,day);assert.equal(next.dayRoutine.stage,stage);assert.equal(next.dayRoutine.pending,null);assert.ok(getActionAvailability(next,{type:'day_activity',choice:'nap'}).allowed);
});
