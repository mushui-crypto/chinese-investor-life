import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,nextTurn,getEventCandidates} from '../src/game/narrative.js';
import {applyAction,applyEffects,advanceTurn,getActionAvailability,getSurvivalStatus} from '../src/game/core.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {ensureRoutine,resetRoutineDay,dayOptions,daySlots,routineMode,dailyEventRole} from '../src/game/day-routine.js';
import {plannedActivity} from '../src/game/routine-plan.js';
import {advanceEducation} from '../src/game/education.js';
import {employmentStatus} from '../src/game/employment.js';
import {dailyScene} from '../src/ui/daily-scene.js';
import {childAge,schoolAgeChild,welcomeChild} from '../src/game/household.js';
import {livingCostBreakdown,EXPENSE_EVENTS} from '../src/game/living-costs.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
export function fixture(age=25){const s=createRun({seed:'lifecycle-audit',familyId:'F01'},catalog);Object.assign(s,{age,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1e8,monthlyIncome:0,occupation:'待业青年',giftReceived:true});s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];ensureRoutine(s);resetRoutineDay(s,1);return s;}
const save=s=>decodeSave(encodeSave(s));
const go=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);return n;};
test('college routine, scene and status agree; graduation restores job search',()=>{
 let s=fixture(20);s.education.college=true;s.flags.college_student=true;s.occupation='大学生';
 assert.equal(routineMode(s),'大学生活');assert.equal(employmentStatus(s).label,'在读');assert.equal(dailyEventRole(s),'student');assert.equal(daySlots(s)[1][1],'上午上课');assert.equal(dailyScene(s).key,'college');
 assert.ok(!dayOptions(s).some(c=>c[0]==='job_hunt'));assert.equal(plannedActivity(s,{evening:'rest'}).choice,'attend_class');
 const academic=s.stats.academic,cash=s.cash;s=go(s,{type:'day_activity',choice:'attend_class'});assert.equal(s.stats.academic,academic+2);assert.equal(s.dayRoutine.stage,2);assert.equal(s.cash,cash);assert.deepEqual(save(s),s);
 resetRoutineDay(s,3);assert.equal(plannedActivity(s,{evening:'rest'}).choice,'coursework');s=go(s,{type:'day_activity',choice:'coursework'});assert.equal(s.dayRoutine.stage,4);assert.deepEqual(save(s),s);
 s.age=22;advanceEducation(s,21.5,22);resetRoutineDay(s,1);assert.equal(routineMode(s),'待业日常');assert.equal(dailyEventRole(s),'unemployed');assert.ok(dayOptions(s).some(c=>c[0]==='job_hunt'));
});
test('every explicit clock path preserves a pending event, money and RNG',()=>{
 for(const phase of [0,3]){const s=fixture();s.trading.phase=phase;s.dayRoutine.pending='lunch';
 for(const action of [{type:'day_next'},{type:'calendar_day'},{type:'survival_day'},{type:'wait_days',days:2},{type:'live_days',days:2},{type:'routine_days',days:2,evening:'rest',smallEvents:'habit'},{type:'market_tick'},{type:'market_day'}]){
  assert.equal(getActionAvailability(s,action).allowed,false,action.type);const n=applyAction(s,action);assert.ok(n.result.error);assert.deepEqual(n.state,s);
 }
 const n=nextTurn(s,catalog);assert.ok(n.lastResult.error);assert.equal(n.rng,s.rng);assert.equal(n.cash,s.cash);assert.equal(n.age,s.age);assert.equal(n.dayRoutine.pending,'lunch');
 }
 let s=fixture();s.dayRoutine.pending='lunch';s=go(s,{type:'day_event_choice',choice:'eat'});assert.ok(getActionAvailability(s,{type:'calendar_day'}).allowed);s=go(s,{type:'calendar_day'});assert.equal(s.survival.days,1);
});
test('a newborn cannot trigger school expenses or adult succession; expenses end after dependency',()=>{
 let s=fixture(30);s.household.partner=true;assert.equal(getActionAvailability(s,{type:'relationship',kind:'child'}).allowed,false);welcomeChild(s);assert.equal(childAge(s),0);assert.equal(s.household.childBornAge,30);assert.deepEqual(save(s),s);
 const trip=EXPENSE_EVENTS.find(e=>e.id==='schooltrip');assert.equal(trip.when(s),false);assert.equal(livingCostBreakdown(s).child,200000);
 assert.ok(!getEventCandidates(s,catalog).some(e=>e.id==='REL03'));
 s.age=36;assert.equal(schoolAgeChild(s),true);assert.equal(trip.when(s),true);assert.ok(getEventCandidates(s,catalog).some(e=>e.id==='REL03'));
 s.age=48;assert.equal(trip.when(s),false);assert.equal(livingCostBreakdown(s).child,200000);s.age=52;assert.equal(livingCostBreakdown(s).child,0);
 const late=fixture(56);late.household.partner=true;welcomeChild(late);const newborn=late;assert.equal(getActionAvailability(newborn,{type:'relationship',kind:'succession'}).allowed,false);
});
test('old family saves keep unknown birth age and past cash, explicit birth flags are idempotent',()=>{
 const old=fixture(45);old.household.hasChild=true;const before=structuredClone(old);assert.equal(childAge(old),null);assert.equal(livingCostBreakdown(old).child,200000);assert.deepEqual(save(old),before);
 old.logs.push({id:'birth-log',turn:old.turn,age:30,title:'家里多了一双小鞋',text:'小满来到家里。'});assert.equal(childAge(old),15);
 let s=fixture(30);let r=applyEffects(s,[{op:'flag',key:'has_child',value:true}]);assert.equal(r.result.error,undefined);s=r.state;assert.equal(childAge(s),0);s.age=32;r=applyEffects(s,[{op:'flag',key:'has_child',value:true}]);assert.equal(r.state.household.childBornAge,30);
 const bad=fixture();bad.household.childBornAge=26;assert.throws(()=>save(bad));
});
test('retirement pension survives a new job, unpaid leave, and losing the job',()=>{
 let s=fixture(67);s.retirementIncome=105000;s.monthlyIncome=105000;s.occupation='退休';s.lifeArcs=newLifeArcs(s);
 assert.equal(getSurvivalStatus(s).dailySalary,3500);assert.equal(dailyScene(s).key,'outside');s=go(s,{type:'seek_job'});assert.ok(s.monthlyIncome>105000);assert.equal(getSurvivalStatus(s).dailySalary,3500);
 s.behavior.leaveDays=1;assert.equal(getSurvivalStatus(s).dailySalary,3500);s=go(s,{type:'calendar_day'});assert.equal(s.survival.last.salary,3500);assert.deepEqual(save(s),s);
 s.monthlyIncome=0;s.occupation='离职待业';assert.equal(getSurvivalStatus(s).dailySalary,0);s=go(s,{type:'market_day'});assert.equal(getSurvivalStatus(s).dailySalary,3500);
});
test('daily and period settlement do not duplicate pensions for re-employed retirees',()=>{
 const s=fixture(67);s.monthlyIncome=300000;s.retirementIncome=105000;s.occupation='普通职员';s.lifeArcs=newLifeArcs(s);
 const bulk=advanceTurn(s);assert.equal(bulk.result.error,undefined);
 let daily=s;for(let i=0;i<30;i++){daily.dayRoutine.pending=null;daily=go(daily,{type:'calendar_day'});}const billed=daily.survival.salaryPaid;assert.equal(billed,105000);assert.ok(daily.payroll.pending[0].net>0);
 const rest=advanceTurn(daily);assert.equal(rest.result.error,undefined);assert.equal(rest.state.cash,bulk.state.cash);assert.deepEqual(save(rest.state),rest.state);
});
test('a retired midday hire starts tomorrow; legacy pensions are preserved at the job entry',()=>{
 let s=fixture(67);s.monthlyIncome=400000;s.occupation='退休';s.lifeArcs=newLifeArcs(s);resetRoutineDay(s,3);s.trading.phase=1;
 s=go(s,{type:'seek_job'});assert.notEqual(s.occupation,'退休');assert.equal(s.retirementIncome,400000);assert.equal(s.behavior.jobStartsTomorrow,true);assert.equal(getSurvivalStatus(s).dailySalary,13333);assert.deepEqual(save(s),s);
 s=go(s,{type:'calendar_day'});assert.equal(s.survival.last.salary,13333);
});
test('a midnight crypto order cannot implicitly discard an unresolved event',()=>{
 const s=fixture();s.trading.phase=3;s.dayRoutine.stage=8;s.dayRoutine.pending='family';const action={type:'desk_order',product:'crypto',instrument:'BTCUSDT',amount:100000};assert.match(getActionAvailability(s,action).reason,/先选完/);assert.deepEqual(applyAction(s,action).state,s);
});
