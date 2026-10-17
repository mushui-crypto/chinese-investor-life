import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayableRun} from '../src/game/quick-start.js';
import {applyAction,advanceTurn,getSurvivalStatus,getMetrics} from '../src/game/core.js';
import {addGameDays} from '../src/game/game-calendar.js';
import {livingCostBreakdown} from '../src/game/living-costs.js';
import {settleChildhoodAllowance} from '../src/game/childhood-economy.js';
import {newCollegeSupport,collegeSupportStatus,settleCollegeSupport,validateCollegeSupport} from '../src/game/college-support.js';
import {fixedIncomeCashflow} from '../src/game/payroll.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
function student(date='2006-01-01'){
 const s=createPlayableRun({seed:'college-allowance',familyId:'F01',startAt:'adult'},catalog);
 Object.assign(s,{age:18,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash:1e8,monthlyIncome:0,occupation:'大学生',collegeSupport:newCollegeSupport()});
 s.education.college=true;s.flags.college_student=true;s.flags.college_not_admitted=false;
 s.behavior.pending=null;s.lifeArcs.pending=null;s.trading.calendar={turn:s.turn,day:s.trading.day,date};return s;
}
const save=s=>decodeSave(encodeSave(s));
const go=s=>{const r=applyAction(s,{type:'calendar_day'});assert.equal(r.result.error,undefined,r.result.error);return r.state;};
const api={cashChange:(s,n)=>{s.cash+=n;}};
test('each civil month pays exactly 2000 once, including February and year changes',()=>{
 for(const date of ['2006-01-31','2008-02-29','2006-12-31']){
  const s=student(date),cash=s.cash,reserve=s.familyReserve;
  assert.equal(settleCollegeSupport(s,api,{date}),200000);assert.equal(settleCollegeSupport(s,api,{date}),0);
  assert.equal(settleCollegeSupport(s,api,{date:addGameDays(date,1)}),200000);
  assert.equal(s.cash,cash+400000);assert.equal(s.familyReserve,reserve);assert.equal(s.collegeSupport.totalPaid,400000);
 }
});
test('daily allowance arrives before food costs, does not become wage, and survives saving without duplication',()=>{
 let s=student();s.cash=0;s.behavior.fatigue=90;
 const v=getSurvivalStatus(s);assert.equal(v.dailySalary,0);assert.equal(v.dailyIncome,200000);assert.equal(v.shortage,0);assert.equal(v.foodShortage,0);
 s=go(s);assert.equal(s.survival.last.support,200000);assert.equal(s.survival.last.salary,0);assert.equal(s.survival.last.healthLost,0);
 assert.equal(s.ledger.filter(e=>e.label.includes('家庭生活费')).length,1);assert.deepEqual(save(s),s);
 s=go(save(s));assert.equal(s.survival.last.support,0);assert.equal(s.collegeSupport.totalPaid,200000);
});
test('legacy saves receive only the current month on next settlement, never cash on load',()=>{
 const s=student('2006-07-16');s.age=18.5;delete s.collegeSupport;const cash=s.cash;
 const loaded=save(s);assert.equal(loaded.cash,cash);assert.equal(loaded.collegeSupport,undefined);
 const n=go(loaded);assert.equal(n.collegeSupport.lastPaidMonth,'2006-07');assert.equal(n.collegeSupport.totalPaid,200000);
 assert.equal(n.ledger.filter(e=>e.label.includes('家庭生活费')).length,1);
});
test('family support stops at graduation and is not paid to nonstudents, children, or prisoners',()=>{
 for(const patch of [{age:17},{age:22},{education:{college:false}},{legal:{prisonMonthsLeft:1}}]){
  const s=Object.assign(student(),patch),cash=s.cash;
  assert.equal(collegeSupportStatus(s).monthly,0);assert.equal(settleCollegeSupport(s,api),0);assert.equal(s.cash,cash);
 }
});
test('college daily costs fit within the monthly allowance and graduation restores adult costs',()=>{
 const s=student();
 assert.equal(getMetrics(s).monthlyExpense,180000);
 for(const days of [28,29,30,31])assert.ok(getSurvivalStatus(s).dailyExpense*days<=collegeSupportStatus(s).monthly);
 s.age=21.5;assert.equal(livingCostBreakdown(s).base,180000);
 s.age=22;assert.equal(livingCostBreakdown(s).base,300000);
 s.age=18;s.education.college=false;assert.equal(livingCostBreakdown(s).base,300000);
});
test('college saving plans reduce costs without the adult minimum cancelling the discount',()=>{
 const s=student();s.livingPlan={housing:'standard',food:'cook',movedDay:null};
 assert.equal(getMetrics(s).monthlyExpense,158400);
 s.livingPlan.housing='shared';assert.equal(getMetrics(s).monthlyExpense,120000);
 s.age=22;assert.equal(getMetrics(s).monthlyExpense,240000);
});
test('college settlement charges the reduced cost with no additional pocket money',()=>{
 let s=student();const entries=s.ledger.length;s.cash=0;s=go(s);
 assert.equal(s.survival.last.due,6000);assert.equal(s.cash,194000);
 assert.equal(s.ledger.slice(entries).filter(e=>e.label==='成长阶段零花钱').length,0);
 const cash=s.cash;assert.deepEqual(settleChildhoodAllowance(s,18,{...api,draw:()=>.5}),[]);assert.equal(s.cash,cash);
 const prior=s.survival.livingAccrued;s.survival.livingAccrued+=4000;
 const n=go(save(s));assert.equal(n.survival.livingAccrued,prior+4000+6000);
});
test('budget forecasts include twelve monthly payments without modifying the save or double counting received months',()=>{
 const s=student(),before=structuredClone(s);s.cash=0;before.cash=0;
 assert.equal(fixedIncomeCashflow(s,360).income,2400000);assert.deepEqual(s,before);
 settleCollegeSupport(s,api);assert.equal(fixedIncomeCashflow(s,360).income,2200000);
 assert.equal(fixedIncomeCashflow(s,10,10000).lowestCash,100000);
});
test('compressed half years and mixed daily/period settlement receive six months, not a seventh at rollover',()=>{
 for(const days of [0,1,32]){
  let s=student();for(let i=0;i<days;i++)s=go(s);
  const r=advanceTurn(s);assert.equal(r.result.error,undefined,r.result.error);
  assert.equal(r.state.collegeSupport.totalPaid,1200000);assert.equal(r.state.collegeSupport.lastPaidMonth,'2006-06');
  assert.deepEqual(save(r.state),r.state);assert.equal(collegeSupportStatus(r.state).due,200000);
 }
});
test('the final college period receives its remaining months and the graduation month is not paid',()=>{
 const s=student('2009-07-01');s.age=21.5;
 const r=advanceTurn(s);assert.equal(r.result.error,undefined,r.result.error);assert.equal(r.state.age,22);
 assert.equal(r.state.collegeSupport.totalPaid,1200000);assert.equal(r.state.collegeSupport.lastPaidMonth,'2009-12');assert.equal(collegeSupportStatus(r.state).due,0);
 assert.equal(-r.state.ledger.find(e=>e.label==='基本生活费欠款').amount,180000*6);
});
test('invalid monthly records cannot introduce duplicated or malformed support payments',()=>{
 for(const p of [{version:1,lastPaidMonth:null,totalPaid:1},{version:1,lastPaidMonth:'2006-13',totalPaid:200000},{version:1,lastPaidMonth:'2007-01',totalPaid:200000},{version:1,lastPaidMonth:'2006-01',totalPaid:0}]){
  const s=student();s.collegeSupport=p;assert.throws(()=>validateCollegeSupport(s));assert.throws(()=>save(s));
 }
});
