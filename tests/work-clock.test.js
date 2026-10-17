import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {applyAction,advanceTurn,getMetrics,getSurvivalStatus,getWorkOffer,getActionAvailability} from '../src/game/core.js';
import {createPlayableRun} from '../src/game/quick-start.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const value=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?value.events:value;}setSaveCatalog(catalog);
function adult(cash=5000000){const s=createRun({seed:'work-clock',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:0,giftReceived:true});s.stats.skill=80;return s;}
const go=(s,a)=>{const next=act(s,a,catalog);assert.equal(next.lastResult?.error,undefined,next.lastResult?.error);return next;};
const save=s=>decodeSave(encodeSave(s));
const earn=(s,type)=>{const quote=getWorkOffer(s,type),next=go(s,{type});assert.equal(next.cash-s.cash,quote.total);return next;};
test('cheap emergency work remains daily, with one shared daily allowance across work and gigs',()=>{
 let s=adult(40000);s.survival.active=true;assert.ok(getSurvivalStatus(s).active);assert.equal(getWorkOffer(s,'gig').total,9600);
 s=earn(s,'gig');assert.equal(s.cash,49600);assert.equal(getSurvivalStatus(s).active,true);assert.equal(s.debtClock.dailyWork,true);assert.equal(s.actionPoints,1);
 const before=save(s),blocked=applyAction(s,{type:'work'});assert.match(blocked.result.error,/做满/);assert.equal(blocked.state,s);assert.deepEqual(save(s),before);
});
test('a closed day cannot be worked retroactively; opening tomorrow restores one real day of work',()=>{
 let s=adult();s.trading.phase=3;s.trading.dayInTurn=2;s=go(s,{type:'wait_days',days:1});assert.match(getActionAvailability(s,{type:'work'}).reason,/明天/);s=go(s,{type:'market_day'});assert.equal(getWorkOffer(s).total,11200);s=earn(s,'work');assert.equal(getActionAvailability(s,{type:'gig'}).allowed,false);
 s.lifeArcs.pending=null;s.behavior.pending=null;s=go(s,{type:'calendar_day'});assert.equal(s.actionPoints,2);s=go(s,{type:'market_day'});assert.equal(getWorkOffer(s).total,11320);assert.ok(getActionAvailability(s,{type:'gig'}).allowed);assert.deepEqual(save(s),s);
});
test('fatigue cuts daily pay, with a practical upbringing bonus once per period',()=>{
 let s=createPlayableRun({seed:'daily-bonus',familyId:'F01',startAt:'adult',childhood:'practical'},catalog);Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:5000000,actionPoints:2});s.education.college=false;s.flags.college_student=false;s.flags.college_not_admitted=true;s.stats.skill=80;s.childhood.workBonusTurn=null;s.debtClock.dailyWork=true;s.behavior.fatigue=70;
 const q=getWorkOffer(s,'work');assert.equal(q.pay,8400);assert.equal(q.bonus,840);s=earn(s,'work');assert.equal(getWorkOffer(s,'gig').bonus,0);assert.deepEqual(save(s),s);
});
test('period reset cannot restore the old batch payout or duplicate daily salary and bills',()=>{
 let s=adult();s.monthlyIncome=300000;s=go(s,{type:'calendar_day'});const cash=s.cash,n=advanceTurn(s);assert.equal(n.result.error,undefined);s=n.state;
 const workEvents=s.employment.history.reduce((sum,h)=>sum+(h.kind==='penalty'?-h.amount:h.amount),0);
 assert.equal(s.cash,cash+300000*5-(540000*6-18000)-(s.livingCosts?.total||0)+workEvents);assert.equal(s.debtClock.dailyWork,false);assert.equal(getWorkOffer(s).daily,true);assert.equal(getWorkOffer(s).total,11200);assert.deepEqual(save(s),s);
});
test('work leaves holdings, old debt and the fixed salary unchanged even when the money is inadequate',()=>{
 let s=adult();s=go(s,{type:'borrow',kind:'family',amount:100000});s.cash=0;s.actionPoints=2;s.survival.active=true;const debt=structuredClone(s.debts),assets=structuredClone(s.positions),income=s.monthlyIncome;s=earn(s,'gig');assert.equal(getActionAvailability(s,{type:'work'}).allowed,false);assert.deepEqual(s.debts,debt);assert.deepEqual(s.positions,assets);assert.equal(s.monthlyIncome,income);assert.ok(getMetrics(s).debt>0);
});
test('old daily clock flags migrate without money or RNG changes and invalid records are rejected',()=>{
 let s=go(adult(),{type:'calendar_day'}),original=structuredClone(s);delete s.debtClock.dailyWork;const n=save(s);assert.equal(n.debtClock.dailyWork,true);assert.equal(n.cash,original.cash);assert.equal(n.rng,original.rng);assert.equal(n.actionPoints,original.actionPoints);const bad=structuredClone(n);bad.debtClock.dailyWork='yes';assert.throws(()=>encodeSave(bad));
});
