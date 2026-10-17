import test from 'node:test';
import {syncSurvival} from '../src/game/survival.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,nextTurn,resumeRun} from '../src/game/narrative.js';
import {applyAction,advanceTurn,getMetrics,getSurvivalStatus,PRODUCTS} from '../src/game/core.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(cash=0,wage=0){const s=createRun({seed:'survival',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:wage,giftReceived:true});s.stats.insight=100;s.marketProgress={firstExperienceAge:18,simulations:2,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const action=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);return n;};
const close=s=>{for(let i=0;i<3;i++)s=action(s,{type:'market_tick'});return s;};
const save=s=>decodeSave(encodeSave(s));
test('adult daily expenses follow housing and household; minors and prison are exempt',()=>{
 const s=adult();assert.equal(getSurvivalStatus(s).dailyExpense,18000);s.positions=[{kind:'housing',value:100000,lockUntilTurn:100}];assert.equal(getSurvivalStatus(s).dailyExpense,18000);s.household.partner=true;s.household.hasChild=true;assert.equal(getSurvivalStatus(s).dailyExpense,27667);s.age=55;assert.equal(getSurvivalStatus(s).dailyExpense,33667);s.age=17;assert.equal(getSurvivalStatus(s).dailyExpense,0);s.age=25;s.legal.prisonMonthsLeft=12;assert.equal(getSurvivalStatus(s).dailyExpense,0);
});
test('only a day close bills salary and living once, with exact deduction from the later period',()=>{
 const s=adult(5000000,300000);let n=action(s,{type:'market_tick'});assert.equal(n.cash,s.cash);n=action(n,{type:'market_tick'});assert.equal(n.cash,s.cash);n=action(n,{type:'market_tick'});assert.equal(n.cash,s.cash-18000);assert.equal(n.survival.livingAccrued,18000);assert.equal(n.survival.salaryPaid,0);assert.equal(n.survival.last.earned,9677);assert.equal(getMetrics(n).livingReserve,3240000-18000);
 const before=save(n);assert.ok(applyAction(n,{type:'market_tick'}).result.error);assert.deepEqual(save(n),before);n=advanceTurn(n).state;assert.equal(n.cash,s.cash+1500000-3240000-(n.livingCosts?.total||0)+n.employment.history.reduce((sum,h)=>sum+(h.kind==='penalty'?-h.amount:h.amount),0));assert.equal(n.survival.livingAccrued,0);assert.equal(n.survival.salaryPaid,0);assert.deepEqual(save(n),n);
});
test('zero cash alone is safe; seven foodless days deplete a 70 health character',()=>{
 let s=adult();const age=s.age,turn=s.turn;assert.ok(getSurvivalStatus(s).active);for(let day=1;day<=7;day++){s=nextTurn(s,catalog);assert.equal(s.age,age);assert.equal(s.turn,turn);assert.equal(s.survival.unpaidDays,day);assert.equal(s.phase,day===7?'ended':'planning');assert.deepEqual(save(s),s);}
 assert.equal(s.ending.id,'E29');assert.equal(s.debts.find(d=>d.name==='基本生活费欠款').principal,112000);assert.ok(resumeRun(s,catalog).lastResult.error);assert.ok(applyAction(s,{type:'gig'}).result.error);assert.ok(advanceTurn(s).result.error);
});
test('a high monthly salary cannot pay for food before payday',()=>{
 let s=adult(0,540000);s.debts=[{id:'old-debt',name:'原有借款',principal:100000,interest:0,originalPrincipal:100000,paid:0,aprBps:0,monthsLeft:12,overdue:false,createdTurn:20,purpose:'test',kind:'family',collateralId:null}];s.cash=0;assert.ok(getMetrics(s).netWorth<0);assert.equal(getSurvivalStatus(s).active,true);s=close(s);assert.equal(s.cash,0);assert.equal(s.survival.unpaidDays,1);assert.equal(s.survival.last.healthLost,10);assert.equal(s.survival.failed,false);
});
test('book wealth cannot feed the player; liquid assets must be sold before health runs out',()=>{
 let locked=adult();locked=applyAction({...locked,cash:10000000},{type:'invest',product:'housing',amount:5000000,useLivingReserve:true}).state;locked.cash=0;locked.monthlyIncome=0;for(let i=0;i<7;i++)locked=nextTurn(locked,catalog);assert.equal(locked.ending.id,'E29');assert.ok(locked.positions.length);
 let liquid=adult();liquid.businesses=[{id:'shop',name:'旧摊位',value:200000,monthlyProfit:0,managedTurn:20,openedTurn:20}];for(let i=0;i<3;i++)liquid=nextTurn(liquid,catalog);assert.equal(liquid.phase,'planning');assert.equal(liquid.survival.failed,false);assert.equal(getSurvivalStatus(liquid).cashableAssets,160000);liquid=action(liquid,{type:'sell',id:'shop'});assert.equal(getSurvivalStatus(liquid).active,false);assert.equal(liquid.survival.unpaidDays,0);assert.ok(liquid.debts.length);
});
test('emergency work and an ordinary job ease a shortfall without clearing the crisis or old debt',()=>{
 let s=adult();s.stats.skill=0;s=nextTurn(s,catalog);const debt=s.debts[0].principal;s=action(s,{type:'market_day'});s=action(s,{type:'gig'});assert.equal(s.cash,8000);assert.ok(getSurvivalStatus(s).active);assert.equal(s.debts[0].principal,debt);assert.equal(s.actionPoints,1);s=action(s,{type:'seek_job'});assert.ok(s.monthlyIncome<getMetrics(s).monthlyExpense);assert.equal(getSurvivalStatus(s).active,true);assert.equal(s.survival.recoveries,0);assert.equal(s.debts[0].principal,debt);
});
test('fully paying a day breaks consecutive shortfalls; reload and menu operations never consume grace',()=>{
 let s=adult();for(let i=0;i<3;i++)s=nextTurn(s,catalog);s.cash=18000;const before=structuredClone(s);assert.deepEqual(save(s),s);getSurvivalStatus(s);getMetrics(s);assert.deepEqual(s,before);s=action(s,{type:'survival_day'});assert.equal(s.survival.unpaidDays,0);assert.equal(s.cash,0);s=nextTurn(s,catalog);assert.equal(s.survival.unpaidDays,1);
});
test('T+1 shares can unlock during rescue days and sell to fund living without erasing debt',()=>{
 let s=adult(2000000);s=action(s,{type:'desk_order',product:'stock',instrument:'chip',shares:100,amount:100000});s.cash=0;s=nextTurn(s,catalog);assert.equal(s.survival.unpaidDays,1);assert.ok(applyAction(s,{type:'sell',id:s.positions[0].id}).result.error);s=nextTurn(s,catalog);assert.equal(s.trading.day,1);s=action(s,{type:'sell',id:s.positions[0].id});assert.ok(s.cash>18000);assert.equal(getSurvivalStatus(s).active,true);assert.equal(s.survival.unpaidDays,2);s=action(s,{type:'survival_day'});assert.equal(s.survival.unpaidDays,0);assert.ok(s.debts.length);assert.deepEqual(save(s),s);
});
test('shortfall save fields reject corruption and legacy saves start with no invented overdue days',()=>{
 let s=nextTurn(adult(),catalog);for(const mutate of [v=>v.unpaidDays=8,v=>v.livingAccrued=-1,v=>v.salaryPaid=Infinity,v=>v.last.paid++,v=>v.lastBilledDay=10000,v=>v.failed=true]){const bad=structuredClone(s);mutate(bad.survival);assert.throws(()=>encodeSave(bad));}
 const old=adult();delete old.survival;delete old.flags.survival_failed;const n=save(old);assert.equal(n.survival.unpaidDays,0);assert.equal(n.cash,old.cash);assert.equal(n.rng,old.rng);assert.equal(n.phase,'planning');
});
test('prison does not run a starvation clock and retirement pensions count as daily income',()=>{
 let s=adult();s.legal.prisonMonthsLeft=12;s.survival.unpaidDays=4;s.survival.active=true;syncSurvival(s,getMetrics(s));assert.equal(s.survival.unpaidDays,0);assert.equal(getSurvivalStatus(s).active,false);assert.ok(applyAction(s,{type:'survival_day'}).result.error);s.legal.prisonMonthsLeft=0;s.age=67;s.household.livingParent=false;s.monthlyIncome=300000;s.occupation='退休';assert.equal(getSurvivalStatus(s).dailySalary,10000);assert.equal(getSurvivalStatus(s).active,true);
});

test('emergency market days continue after the usual three-day cap and refill daily work actions once',()=>{
 let s=adult();s.actionPoints=0;
 for(let day=1;day<=6;day++){
  s=close(s);assert.equal(s.survival.unpaidDays,day);assert.equal(s.actionPoints,2);assert.equal(s.survival.days,day);assert.deepEqual(save(s),s);
  s=action(s,{type:'market_day'});assert.equal(s.trading.day,day);assert.ok(s.trading.dayInTurn<=2);s.actionPoints=0;
 }
 s=close(s);assert.equal(s.ending.id,'E29');
});

test('saleable money uses the same fee rounding as an actual sale, including half-cent boundaries',()=>{
 let s=adult(2000000);s=action(s,{type:'invest',product:'fund',amount:100000});s.positions[0].value=6050;s.positions[0].lockUntilTurn=s.turn;const before=s.cash;assert.equal(getMetrics(s).cashableAssets,5989);s=action(s,{type:'sell',id:s.positions[0].id});assert.equal(s.cash-before,5989);
});
