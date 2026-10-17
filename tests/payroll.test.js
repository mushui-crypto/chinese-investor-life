import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newPayroll,paydayFor,payrollBase,payrollStatus,settlePayroll,fixedIncomeCashflow,validatePayroll} from '../src/game/payroll.js';
import {addGameDays} from '../src/game/game-calendar.js';
import {dailyWageQuote} from '../src/game/work-economy.js';
import {createPlayableRun} from '../src/game/quick-start.js';
import {applyAction,advanceTurn,getSurvivalStatus} from '../src/game/core.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
function worker(date='2006-01-01'){
 const s=createPlayableRun({seed:'monthly-payday',familyId:'F01',startAt:'adult'},catalog);
 Object.assign(s,{age:25,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash:1e8,monthlyIncome:248000,occupation:'普通职员'});
 s.behavior.pending=null;s.lifeArcs.pending=null;s.trading.calendar={turn:s.turn,day:s.trading.day,date};s.payroll=newPayroll();return s;
}
const api={cashChange:(s,n)=>{s.cash+=n;}};
function earn(s,date){const base=payrollBase(s,date);return settlePayroll(s,api,{date,gross:base.wage,earned:dailyWageQuote(s,base.total)-base.pension});}
function month(s,m){for(let date=m+'-01';date.startsWith(m);date=addGameDays(date,1))earn(s,date);}
const go=(s,a)=>{const r=applyAction(s,a);assert.equal(r.result.error,undefined,r.result.error);return r.state;};
test('a fixed salary is exact in 28/29/30/31-day months; cash arrives only on the following 10th',()=>{
 for(const m of ['2006-02','2008-02','2006-04','2006-12']){
  const s=worker(m+'-01'),cash=s.cash;month(s,m);
  assert.equal(s.cash,cash);assert.equal(s.payroll.pending[0].net,248000);assert.equal(s.payroll.pending[0].gross,248000);
  const payday=paydayFor(m);earn(s,addGameDays(payday,-1));assert.equal(s.cash,cash);
  assert.equal(earn(s,payday),248000);assert.equal(s.cash,cash+248000);
  const p=structuredClone(s.payroll);earn(s,payday);assert.deepEqual(s.payroll,p);assert.equal(s.cash,cash+248000);
 }
});
test('joining mid-month accrues only days worked; leave, late arrival and fatigue reduce that month rather than cash',()=>{
 const s=worker('2006-04-16'),cash=s.cash;
 for(let i=16;i<=30;i++){
  s.behavior.leaveDays=i===16?1:0;s.behavior.fatigue=i===18?65:0;s.dayRoutine={lateForWork:i===17};
  earn(s,`2006-04-${i}`);
 }
 const row=s.payroll.pending[0];assert.equal(row.gross,124000);assert.equal(row.net,124000-8266-826-2066);assert.equal(s.cash,cash);
 s.monthlyIncome=0;s.occupation='离职待业';assert.equal(earn(s,'2006-05-10'),row.net);assert.equal(s.cash,cash+row.net);
});
test('already-earned salary survives firing, prison and a period boundary',()=>{
 for(const kind of ['fired','prison','rollover']){
  const s=worker('2006-01-10');month(s,'2006-01');
  if(kind==='fired'){s.monthlyIncome=0;s.occupation='离职待业';}
  if(kind==='prison')s.legal.prisonMonthsLeft=1;
  if(kind==='rollover')s.turn++;
  assert.equal(earn(s,'2006-02-10'),248000);assert.equal(s.payroll.history[0].month,'2006-01');
 }
});
test('payday money is available to daily food accounting; future salary cannot feed the player',()=>{
 let s=worker('2006-02-09');s.cash=0;s.payroll={version:1,lastAccruedDate:'2006-02-08',pending:[{month:'2006-01',gross:248000,net:248000}],history:[]};
 const before=getSurvivalStatus(s);assert.equal(before.dailySalary,0);assert.equal(before.foodShortage,2000);
 s=go(s,{type:'calendar_day'});assert.equal(s.survival.last.salary,0);assert.equal(s.survival.last.healthLost,10);
 s=go(s,{type:'calendar_day'});assert.equal(s.survival.last.salary,248000);assert.equal(s.survival.last.foodPaid,2000);assert.equal(s.survival.last.healthLost,0);
 assert.equal(s.ledger.filter(e=>e.label.includes('2006-02-10 发薪')).length,1);
 assert.deepEqual(decodeSave(encodeSave(s)),s);
});
test('old daily-paid saves receive no retroactive wages and no cash on loading',()=>{
 const old=worker('2006-07-06');delete old.payroll;old.survival.salaryPaid=41330;
 const cash=old.cash,loaded=decodeSave(encodeSave(old));assert.equal(loaded.cash,cash);assert.equal(loaded.payroll,undefined);
 let n=go(loaded,{type:'calendar_day'});assert.equal(n.survival.last.salary,0);assert.equal(n.payroll.pending[0].net,8000);
 n.trading.calendar={turn:n.turn,day:n.trading.day,date:'2006-07-10'};n=go(n,{type:'calendar_day'});
 assert.equal(n.survival.last.salary,0);assert.equal(n.payroll.history.length,0);
});
test('monthly cash forecasting is read-only and catches a cash gap before payday',()=>{
 const s=worker('2006-01-01');s.cash=0;const before=structuredClone(s);
 const forecast=fixedIncomeCashflow(s,41,2000);assert.equal(forecast.income,248000);assert.ok(forecast.lowestCash<0);assert.deepEqual(s,before);
 assert.equal(payrollStatus(s).nextPayday,'2006-02-10');
});
test('compressed periods preserve the final unpaid month and only create dated payday cash entries',()=>{
 const s=worker('2006-01-01'),r=advanceTurn(s);assert.equal(r.result.error,undefined,r.result.error);
 assert.ok(r.state.payroll.history.length>0);assert.ok(r.state.payroll.pending.length>0);
 assert.ok(r.state.payroll.history.every(h=>h.payday.endsWith('-10')));
 assert.equal(r.state.ledger.some(e=>/个月工资|当日工资结算/.test(e.label)),false);
 assert.deepEqual(decodeSave(encodeSave(r.state)),r.state);
});
test('malformed payroll and duplicate months are rejected',()=>{
 for(const mutate of [p=>p.pending[0].net=-1,p=>p.pending[0].net=999999,p=>p.pending.push({...p.pending[0]}),p=>p.lastAccruedDate='bad',p=>p.pending[0].month='2006-13']){
  const s=worker();earn(s,'2006-01-01');mutate(s.payroll);assert.throws(()=>validatePayroll(s));
 }
});

test('payday still pays previously earned wages during hospital admission or high fatigue',()=>{
 for(const hospital of [false,true]){
  let s=worker('2006-02-10');s.cash=1e6;s.stats.health=hospital?30:80;s.behavior.fatigue=80;
  s.payroll={version:1,lastAccruedDate:'2006-02-09',pending:[{month:'2006-01',gross:248000,net:230000}],history:[]};
  s=go(s,{type:hospital?'hospital':'calendar_day'});
  assert.equal(s.survival.last.salary,230000);assert.equal(s.payroll.history[0].net,230000);
  assert.equal(s.survival.last.earned===0,hospital);
  const loaded=decodeSave(encodeSave(s));assert.deepEqual(loaded.payroll,s.payroll);
  s=go(loaded,{type:'calendar_day'});assert.equal(s.survival.last.salary,0);
  assert.equal(s.ledger.filter(e=>e.label.includes('2006-02-10 发薪')).length,1);
 }
});
test('a civil-month boundary elided by chapter billing still earns the full fixed salary',()=>{
 const s=worker('2013-01-01');const r=advanceTurn(s);assert.equal(r.result.error,undefined);
 assert.equal(r.state.monthlyIncome,248000);
 assert.equal(r.state.payroll.history.reduce((n,p)=>n+p.gross,0),248000*5);
 assert.equal(r.state.payroll.pending[0].gross,248000);
 assert.equal(r.state.payroll.lastAccruedDate,'2013-06-30');
});
