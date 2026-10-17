import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {applyAction,advanceTurn,getActionAvailability,getMetrics} from '../src/game/core.js';
import {ensureRoutine,resetRoutineDay,dayOptions,DAILY_EVENTS} from '../src/game/day-routine.js';
import {attendanceStatus,shouldOfferDayOff} from '../src/game/attendance.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
import {behaviorEvent} from '../src/game/behavior.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const x=JSON.parse(fs.readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?x.events:x;}setSaveCatalog(catalog);
function worker(){const s=createRun({seed:'attendance',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000,monthlyIncome:300000,occupation:'普通职员'});s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];s.behavior.pending=null;s.behavior.seen=Object.keys(BEHAVIOR_EVENTS);s.workStories={zhou:{stage:'done',due:0},wu:{stage:'done',due:0}};ensureRoutine(s);resetRoutineDay(s);return s;}
const step=(s,a)=>{if(a.type==='calendar_day'&&s.dayRoutine.pending)s=step(s,{type:'day_event_choice',choice:DAILY_EVENTS[s.dayRoutine.pending].choices.at(-1)[0]});const n=act(s,a,catalog);assert.equal(n.lastResult.error,undefined,n.lastResult.error);assert.equal(n.cash-s.cash,n.ledger.slice(s.ledger.length).filter(e=>e.account==='cash').reduce((v,e)=>v+e.amount,0));return n;};
const save=s=>decodeSave(encodeSave(s));
function tomorrow(s){s=step(s,{type:'calendar_day'});s=step(s,{type:'day_next'});s.dayRoutine.pending=null;s.behavior.pending=null;return s;}
function rough(s){s.dayRoutine.nightStreak=1;return s;}

test('only an employed rough morning offers absence, without changing time or saved choices on read',()=>{
 const s=worker(),before=structuredClone(s);assert.equal(shouldOfferDayOff(s),false);dayOptions(s);assert.deepEqual(s,before);rough(s);assert.ok(shouldOfferDayOff(s));assert.deepEqual(dayOptions(s).map(x=>x[0]),['breakfast','day_leave','day_absent']);
 for(const change of [x=>x.monthlyIncome=0,x=>x.occupation='退休',x=>x.behavior.jobStartsTomorrow=true,x=>x.behavior.leaveDays=1,x=>x.dayRoutine.stage=2]){const n=structuredClone(s);change(n);assert.equal(shouldOfferDayOff(n),false);}
 assert.deepEqual(save(s),s);
});
test('staying up creates a next-morning choice; leave removes salary but not living costs',()=>{
 let s=worker();resetRoutineDay(s,6);s.trading.phase=2;s=step(s,{type:'day_activity',choice:'stay'});s=step(s,{type:'calendar_day'});s.dayRoutine.nextWakeLate=false;s=step(s,{type:'day_next'});assert.equal(s.dayRoutine.wakeKind,'alarm');assert.ok(shouldOfferDayOff(s));const wage=s.survival.salaryPaid,cash=s.cash;
 if(s.dayRoutine.pending?.startsWith('overslept_'))s=step(s,{type:'day_event_choice',choice:'ack'});s=step(save(s),{type:'day_activity',choice:'day_leave'});assert.equal(attendanceStatus(s).leave,1);assert.equal(s.monthlyIncome,300000);assert.equal(s.behavior.leaveDays,1);assert.ok(dayOptions(s).every(c=>!['focus','slack'].includes(c[0])));s=step(s,{type:'calendar_day'});assert.equal(s.survival.salaryPaid,wage);assert.equal(s.cash,cash-18000);assert.equal(s.behavior.leaveDays,0);assert.deepEqual(save(s),s);
});
test('a real late casino bet creates the morning option; daytime bets do not',()=>{
 for(const stage of [1,6]){let s=worker();s.flags.gambling_exposed=true;resetRoutineDay(s,stage);s.trading.phase=stage===1?0:2;s=step(s,{type:'gamble',game:'redblack',pick:'red',amount:10000});assert.equal(s.attendance?.lateDay,stage===6?0:undefined);s=tomorrow(s);assert.equal(shouldOfferDayOff(s),stage===6);assert.deepEqual(save(s),s);}
});
test('fourth leave in 30 days dismisses without severance or a same-day rehiring loophole',()=>{
 let s=worker();for(let n=1;n<=4;n++){rough(s);const cash=s.cash;if(s.dayRoutine.pending?.startsWith('overslept_'))s=step(s,{type:'day_event_choice',choice:'ack'});s=step(s,{type:'day_activity',choice:'day_leave'});assert.equal(s.cash,cash);assert.equal(attendanceStatus(s).leave,n);assert.equal(s.monthlyIncome,n===4?0:300000);if(n<4)s=tomorrow(s);}
 assert.match(s.occupation,/开除/);assert.match(s.lastResult.text,/没有补偿金/);assert.ok(!getActionAvailability(s,{type:'seek_job'}).allowed);assert.ok(!getActionAvailability(s,{type:'day_activity',choice:'job_hunt'}).allowed);assert.ok(!s.ledger.some(e=>/裁员补偿/.test(e.label)));const paid=s.survival.salaryPaid;s=step(save(s),{type:'calendar_day'});assert.equal(s.survival.salaryPaid,paid);assert.deepEqual(save(s),s);
});
test('second absence dismisses; same-day duplicate and reload cannot add records or wages',()=>{
 let s=rough(worker());s=step(s,{type:'day_activity',choice:'day_absent'});assert.equal(attendanceStatus(s).absent,1);assert.equal(s.monthlyIncome,300000);const before=save(s),blocked=applyAction(before,{type:'day_activity',choice:'day_absent'});assert.ok(blocked.result.error);assert.strictEqual(blocked.state,before);
 s=rough(tomorrow(s));s=step(s,{type:'day_activity',choice:'day_absent'});assert.equal(s.monthlyIncome,0);assert.equal(s.attendance.records.at(-1).fired,true);assert.equal(attendanceStatus(s).absent,2);assert.deepEqual(save(s),s);
});
test('rolling counts expire after 30 days and a new job starts its own count',()=>{
 const s=worker();s.attendance={job:0,lateDay:null,records:[{day:0,job:0,kind:'leave',fired:false}]};s.debtClock.day=29;assert.equal(attendanceStatus(s).leave,1);s.debtClock.day=30;assert.equal(attendanceStatus(s).leave,0);
 let n=rough(worker());n=step(n,{type:'day_activity',choice:'day_absent'});n=rough(tomorrow(n));n=step(n,{type:'day_activity',choice:'day_absent'});n=tomorrow(n);assert.ok(!getActionAvailability(n,{type:'seek_job'}).allowed);n.debtClock.day=n.jobSearch.readyOn;n=step(n,{type:'seek_job'});assert.ok(n.monthlyIncome>0);assert.equal(n.attendance.job,1);assert.equal(attendanceStatus(n).absent,0);assert.equal(n.attendance.records.length,2);assert.deepEqual(save(n),n);
});
test('existing warning route shares counts and presents the actual remaining allowance',()=>{
 let s=worker();s.behavior.pending='work_warning';s=step(s,{type:'behavior_choice',scene:'work_warning',choice:'rest'});assert.equal(attendanceStatus(s).leave,1);s.behavior.pending='work_warning';assert.match(behaviorEvent(s).choices.find(c=>c.id==='rest').hint,/1\/3/);assert.ok(!getActionAvailability(s,{type:'behavior_choice',scene:'work_warning',choice:'rest'}).allowed);
 s=tomorrow(s);s.attendance.records.push({day:s.debtClock.day,job:0,kind:'absent',fired:false});s=tomorrow(s);s.behavior.pending='work_warning';s=step(s,{type:'behavior_choice',scene:'work_warning',choice:'ignore'});assert.equal(s.monthlyIncome,0);assert.equal(attendanceStatus(s).absent,2);assert.deepEqual(save(s),s);
});
test('routine stops at a rough morning and can continue after choosing normal attendance',()=>{
 let s=rough(worker());s=step(s,{type:'routine_days',days:7,evening:'rest',smallEvents:'habit'});assert.equal(s.lastResult.days,0);assert.match(s.lastResult.text,/上不上班/);assert.equal(s.attendance,undefined);s=step(s,{type:'day_activity',choice:'breakfast'});s.dayRoutine.pending=null;assert.equal(shouldOfferDayOff(s),false);s=step(s,{type:'routine_days',days:1,evening:'rest',smallEvents:'habit'});assert.equal(s.lastResult.days,1);assert.equal(s.survival.last.salary,0);assert.equal(s.survival.last.earned,9677);
});
test('firing preserves earned salary for its payday and adds no compensation',()=>{
 let s=worker();s=tomorrow(s);assert.equal(s.survival.salaryPaid,0);assert.equal(s.payroll.pending[0].net,9677);s=rough(s);s=step(s,{type:'day_activity',choice:'day_absent'});s=tomorrow(s);s=rough(s);s=step(s,{type:'day_activity',choice:'day_absent'});const start=s.ledger.length,out=advanceTurn(s);assert.equal(out.result.error,undefined);assert.equal(out.state.ledger.slice(start).filter(e=>e.account==='cash'&&/工资/.test(e.label)).reduce((n,e)=>n+e.amount,0),9677);assert.equal(out.state.ledger.slice(start).filter(e=>/补偿/.test(e.label)).length,0);assert.deepEqual(save(out.state),out.state);
});
test('invalid attendance histories are rejected and legacy leave is not retroactively counted',()=>{
 const s=worker();s.behavior.leaveDays=1;const restored=save(s);assert.equal(restored.attendance,undefined);assert.equal(attendanceStatus(restored).leave,0);
 for(const records of [[{day:1,job:0,kind:'leave',fired:false}],[{day:0,job:0,kind:'fake',fired:false}],[{day:0,job:0,kind:'leave',fired:false},{day:0,job:0,kind:'absent',fired:true}]]){const x=worker();x.attendance={job:0,lateDay:null,records};assert.throws(()=>save(x));}
});
