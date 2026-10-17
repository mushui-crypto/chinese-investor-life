import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {advanceTurn,getActionAvailability,getMetrics,PRODUCTS} from '../src/game/core.js';
import {ensureRoutine,resetRoutineDay,finishRoutineSleep,lateWakeChance,dayOptions,routineClock,aShareSession,completeRoutineWork,DAILY_EVENTS} from '../src/game/day-routine.js';
import {dailyWageQuote} from '../src/game/work-economy.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {nightTransitionData,wakeTransitionData} from '../src/ui/night-transition.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
function fixture(role='work'){
 const s=createRun({seed:'sleep-rules',familyId:'F01'},catalog);
 Object.assign(s,{age:role==='student'?18:role==='retired'?65:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1e7,monthlyIncome:role==='work'?300000:role==='retired'?180000:0,occupation:role==='work'?'普通职员':role==='student'?'大学生':role==='retired'?'退休':'待业'});
 s.education.college=role==='student';s.flags.college_student=role==='student';s.flags.college_not_admitted=role!=='student';
 s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];
 s.behavior.pending=null;s.behavior.seen=Object.keys(BEHAVIOR_EVENTS);s.behavior.fatigue=20;
 s.workStories={zhou:{stage:'done',due:0},wu:{stage:'done',due:0}};s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};
 ensureRoutine(s);resetRoutineDay(s,6);s.dayRoutine.checked=['event'];s.dayRoutine.choices={1:'focus',3:'focus'};s.trading.phase=2;
 return s;
}
const save=s=>decodeSave(encodeSave(s));
function go(s,a){const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);assert.equal(n.cash-s.cash,n.ledger.slice(s.ledger.length).filter(e=>e.account==='cash').reduce((v,e)=>v+e.amount,0));return n;}
function quiet(s){s.behavior.pending=null;s.lifeArcs.pending=null;if(s.dayRoutine.pending&&!s.dayRoutine.pending.startsWith('overslept_'))s=go(s,{type:'day_event_choice',choice:DAILY_EVENTS[s.dayRoutine.pending].choices.at(-1)[0]});return s;}
function pendingMorning(role='work',late=true){
 let s=go(fixture(role),{type:'day_activity',choice:'stay'});s=quiet(go(s,{type:'calendar_day'}));
 // Force an already-sampled saved result; opening the next day must never reroll it.
 s.dayRoutine.nextWakeLate=late;s=go(save(s),{type:'day_next'});return s;
}
test('late wake chance rises with consecutive nights and caps at 75%; ordinary sleep draws nothing',()=>{
 assert.deepEqual([1,2,3,4,20].map(lateWakeChance),[.3,.45,.6,.75,.75]);
 const s=fixture();let draws=0;const api={draw:()=>{draws++;return .29;},stat:(s,changes)=>{for(const [k,v]of Object.entries(changes))s.stats[k]+=v;}};
 s.dayRoutine.choices[6]='stay';finishRoutineSleep(s,api);assert.equal(s.dayRoutine.nextWakeLate,true);assert.equal(draws,1);const copy=structuredClone(s);finishRoutineSleep(s,api);assert.deepEqual(s,copy);assert.equal(draws,1);
 const normal=fixture();normal.dayRoutine.nightStreak=4;normal.dayRoutine.choices[6]='sleep';finishRoutineSleep(normal,api);assert.equal(normal.dayRoutine.nextWakeLate,false);assert.equal(normal.dayRoutine.nightStreak,0);assert.equal(draws,1);assert.match(dayOptions(fixture())[0][2],/结束连续熬夜/);
});
test('both chance outcomes are fixed at settlement and survive saved next-morning routes',()=>{
 for(const late of [true,false]){const s=pendingMorning('work',late);assert.equal(s.dayRoutine.wakeKind,late?'late':'alarm');assert.equal(s.dayRoutine.stage,late?2:0);assert.equal(s.dayRoutine.pending,late?'overslept_work':null);assert.equal(s.dayRoutine.nextWakeLate,undefined);assert.deepEqual(save(s),s);const before=structuredClone(s);dayOptions(s);routineClock(s);assert.deepEqual(s,before);}
});
test('late class arrival costs learning and discipline once, without a cash penalty',()=>{
 let s=pendingMorning('student'),before=structuredClone(s);assert.match(routineClock(s),/^11:30/);
 for(const type of ['day_next','calendar_day','live_days','routine_days','market_day'])assert.equal(getActionAvailability(s,{type,days:1}).allowed,false);
 s=go(s,{type:'day_event_choice',choice:'ack'});assert.equal(s.stats.academic,before.stats.academic-2);assert.equal(s.stats.discipline,before.stats.discipline-1);assert.equal(s.cash,before.cash);assert.equal(s.dayRoutine.lateForWork,undefined);
 const retry=act(save(s),{type:'day_event_choice',choice:'ack'},catalog);assert.ok(retry.lastResult.error);assert.equal(retry.cash,s.cash);assert.deepEqual(retry.stats,s.stats);
});
test('late work costs 10% of the day wage at settlement, independently of fatigue, exactly once',()=>{
 let s=pendingMorning(),before=structuredClone(s);s=go(s,{type:'day_event_choice',choice:'ack'});
 assert.equal(s.cash,before.cash);assert.equal(s.stats.discipline,before.stats.discipline-1);assert.equal(s.stats.trust,before.stats.trust-1);assert.equal(s.attendance?.records.length||0,0);
 s.behavior.fatigue=0;assert.equal(dailyWageQuote(s,10000),9000);s.behavior.fatigue=65;assert.equal(dailyWageQuote(s,10000),6500);
 const lost=s.behavior.lostWages;s=go(s,{type:'calendar_day'});assert.equal(s.survival.last.salary,0);assert.equal(s.survival.last.earned,6291);assert.equal(s.behavior.lostWages-lost,3386);assert.match(s.lastResult.text,/迟到.*10%（¥9.67）/);
 const wage=s.survival.salaryPaid;s=go(s,{type:'day_next'});assert.equal(s.survival.salaryPaid,wage);assert.equal(s.dayRoutine.lateForWork,undefined);assert.deepEqual(save(s),s);
});
test('lateness never docks a pension, an unpaid leave day, or a job not yet started',()=>{
 const s=pendingMorning();s.dayRoutine.pending=null;s.dayRoutine.lateForWork=true;s.retirementIncome=60000;s.behavior.fatigue=0;
 assert.equal(dailyWageQuote(s,12000),11000);s.behavior.fatigue=65;assert.equal(dailyWageQuote(s,12000),8500);
 s.behavior.leaveDays=1;assert.equal(dailyWageQuote(s,12000),2000);s.behavior.leaveDays=0;s.behavior.jobStartsTomorrow=true;assert.equal(dailyWageQuote(s,12000),2000);
 for(const role of ['free','retired']){let n=pendingMorning(role);assert.equal(n.dayRoutine.pending,'overslept_free');const before=structuredClone(n);n=go(n,{type:'day_event_choice',choice:'ack'});assert.equal(n.cash,before.cash);assert.deepEqual(n.stats,before.stats);}
});
test('batch and calendar shortcuts stop at the saved late-waking event before billing the new day',()=>{
 let base=go(fixture(),{type:'day_activity',choice:'stay'});base=quiet(go(base,{type:'calendar_day'}));base.dayRoutine.nextWakeLate=true;
 for(const a of [{type:'live_days',days:3},{type:'wait_days',days:3},{type:'calendar_day'},{type:'market_day'},{type:'day_next'}]){const n=go(save(base),a);assert.equal(n.dayRoutine.pending,'overslept_work',a.type);assert.equal(n.debtClock.day,base.debtClock.day,a.type);assert.equal(n.survival.salaryPaid,base.survival.salaryPaid,a.type);assert.deepEqual(save(n),n);}
});
test('month-end settlement does not refund a late deduction',()=>{
 let s=pendingMorning();s=go(s,{type:'day_event_choice',choice:'ack'});s.behavior.fatigue=0;s=quiet(go(s,{type:'calendar_day'}));const deducted=s.behavior.lostWages;assert.equal(deducted,967);
 s.behavior.fatigue=0;const before=s.survival.salaryPaid,count=s.ledger.length,out=advanceTurn(s);assert.equal(out.result.error,undefined,out.result.error);
 const remaining=out.state.ledger.slice(count).filter(e=>e.account==='cash'&&/工资 · .* 发薪/.test(e.label)).reduce((v,e)=>v+e.amount,0);assert.equal(remaining+before,1500000-deducted);assert.equal(out.state.payroll.pending[0].net,300000);
});
test('new fields validate without requiring them in legacy saves',()=>{
 const s=pendingMorning();assert.deepEqual(save(s),s);
 for(const mutate of [r=>r.nextWakeLate='true',r=>r.wakeKind='made-up',r=>r.lateForWork=1,r=>r.wakeKind='fresh']){const n=structuredClone(s);mutate(n.dayRoutine);assert.throws(()=>save(n));}
 const old=fixture();delete old.dayRoutine.wakeKind;delete old.dayRoutine.nextWakeLate;delete old.dayRoutine.lateForWork;assert.deepEqual(save(old),old);
});
test('sleep and waking shots match the persisted outcome and never draw or apply effects',()=>{
 for(const late of [true,false]){let s=go(fixture('student'),{type:'day_activity',choice:'stay'});s=go(s,{type:'calendar_day'});s.dayRoutine.nextWakeLate=late;const after=go(save(s),{type:'day_next'}),before=structuredClone(after);const shot=nightTransitionData(s,after,{type:'day_next'});assert.equal(shot.kind,late?'wake-late':'wake-alarm');assert.equal(shot.time,late?'11:30':'07:00');assert.deepEqual(after,before);assert.equal(wakeTransitionData(after,after),null);}
 const before=fixture(),after=go(before,{type:'day_activity',choice:'sleep'}),snapshot=structuredClone(after),scene=nightTransitionData(before,after,{type:'day_activity',choice:'sleep'});assert.equal(scene.kind,'sleep');assert.equal(scene.wake.kind,'wake-fresh');assert.equal(scene.wake.date,'2013-01-02');assert.deepEqual(after,snapshot);
});

test('oversleep skips breakfast and morning actions, settles morning prices once and starts at lunch',()=>{
 for(const role of ['work','student','free']){
  let s=pendingMorning(role);assert.equal(s.dayRoutine.stage,2);assert.equal(s.trading.phase,1);assert.equal(aShareSession(s).label,'午间休市');
  assert.equal(s.trading.journal.filter(j=>j.day===s.trading.day&&j.phase===1&&/午间行情/.test(j.text)).length,1);
  const saved=save(s);assert.equal(saved.trading.phase,1);assert.equal(saved.rng,s.rng);
  s=go(saved,{type:'day_event_choice',choice:'ack'});
  for(const choice of ['breakfast','focus','attend_class','job_hunt','day_gig'])assert.equal(getActionAvailability(s,{type:'day_activity',choice}).allowed,false,role+':'+choice);
  assert.equal(getActionAvailability(s,{type:'gig'}).allowed,false);
  const fatigue=s.behavior.fatigue;completeRoutineWork(s,1);assert.equal(s.dayRoutine.choices[1],undefined);assert.equal(s.behavior.fatigue,fatigue);
  assert.ok(dayOptions(s).some(c=>c[0]==='nap'));s=go(s,{type:'day_activity',choice:'nap'});assert.equal(s.dayRoutine.stage,3);assert.equal(s.trading.phase,1);assert.equal(aShareSession(s).open,true);
 }
});
test('held positions include skipped morning changes in the behavioral profit ledger once',()=>{
 let s=fixture();s.dayRoutine.stage=3;s.trading.phase=1;s=go(s,{type:'desk_order',product:'crypto',instrument:'BTCUSDT',amount:100000});s.dayRoutine.stage=6;
 s=go(s,{type:'day_activity',choice:'stay'});s=quiet(go(s,{type:'calendar_day'}));s.dayRoutine.nextWakeLate=true;
 const before=getMetrics(s).netWorth,pnl=s.behavior.marketPnl,after=go(save(s),{type:'day_next'});
 assert.equal(after.trading.phase,1);assert.equal(after.behavior.marketPnl-pnl,getMetrics(after).netWorth-before);assert.equal(after.survival.salaryPaid,s.survival.salaryPaid);
});
