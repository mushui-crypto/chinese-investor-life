import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {getLoanOffer,getLoanOffers,getActionAvailability,getMetrics,getSurvivalStatus,advanceTurn} from '../src/game/core.js';
import {acknowledgeRescue,shouldOfferRescue,syncSurvival} from '../src/game/survival.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(seed='rescue-loan'){const s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:0,monthlyIncome:0,giftReceived:true,familyReserve:1000000});s.stats.trust=70;s.stats.credit=70;syncSurvival(s,getMetrics(s));return s;}
function attempt(kind,amount=100000,approved=true){for(let i=0;i<100;i++){const s=adult('loan-'+i),n=act(s,{type:'borrow',kind,amount},catalog);assert.equal(n.lastResult?.error,undefined);if((n.cash>0)===approved)return {s,n};}throw Error('No deterministic fixture found');}
test('rescue offers are read-only, distinguish six channels, and explain real eligibility',()=>{
 const s=adult(),before=structuredClone(s),offers=getLoanOffers(s);assert.deepEqual(s,before);assert.equal(offers.length,6);
 for(const kind of ['bank','net'])assert.match(offers.find(o=>o.kind===kind).reason,/收入/);
 for(const kind of ['family','friend','card','shark'])assert.ok(offers.find(o=>o.kind===kind).allowed);
 s.stats.trust=10;s.familyReserve=0;s.stats.credit=10;assert.equal(getLoanOffers(s).filter(o=>o.allowed).map(o=>o.kind).join(),'shark');
 s.actionPoints=0;assert.ok(getLoanOffers(s).every(o=>!o.allowed));
 s.actionPoints=2;s.age=17;assert.ok(getLoanOffers(s).every(o=>!o.allowed));
 s.age=25;s.legal.prisonMonthsLeft=6;assert.ok(getLoanOffers(s).every(o=>!o.allowed));
});
test('fee-bearing borrowing credits net cash, records full principal and reduces wealth by the fee',()=>{
 for(const [kind,fee,apr,months] of [['card',5000,2400,6],['shark',10000,7200,3]]){
  const {s,n}=attempt(kind),quote=getLoanOffer(s,kind,100000),d=n.debts.find(d=>d.kind===kind);
  assert.equal(quote.net,n.cash);assert.equal(quote.fee,fee);assert.equal(n.cash,100000-fee);assert.equal(d.principal,100000);assert.equal(d.aprBps,apr);assert.equal(d.monthsLeft,months);
  assert.equal(getMetrics(n).netWorth-getMetrics(s).netWorth,-fee);assert.equal(getSurvivalStatus(n).active,true);
  assert.deepEqual(decodeSave(encodeSave(n)),n);assert.equal(n.actionPoints,s.actionPoints-1);
  if(kind==='card')assert.equal(n.stats.credit,s.stats.credit-8);else assert.equal(n.stats.health,s.stats.health-2);
 }
});
test('a declined risky loan never charges a fee, creates a debt, or harms credit',()=>{
 for(const kind of ['card','shark']){const {s,n}=attempt(kind,100000,false);assert.equal(n.cash,0);assert.deepEqual(n.debts,s.debts);assert.deepEqual(n.stats,s.stats);assert.equal(n.actionPoints,s.actionPoints-1);assert.match(n.lastResult.title,/未通过/);}
});
test('friend borrowing is separate from finite family aid and outstanding balances consume its cap',()=>{
 const {s,n}=attempt('friend');assert.equal(n.familyReserve,s.familyReserve);assert.equal(n.stats.trust,s.stats.trust-4);assert.equal(n.debts[0].aprBps,0);
 assert.equal(getLoanOffer(n,'friend').cap,Math.floor(n.stats.trust)*10000-100000);
 const family=attempt('family');assert.equal(family.n.familyReserve,family.s.familyReserve-100000);
 n.debts[0].overdue=true;assert.match(getLoanOffer(n,'friend').reason,/逾期人情债/);
});
test('caps and credit gates prevent unlimited risky refinancing while existing debts survive',()=>{
 const s=adult();s.age=20;assert.match(getLoanOffer(s,'card').reason,/21 岁/);s.age=25;
 assert.equal(getActionAvailability(s,{type:'borrow',kind:'shark',amount:500001}).allowed,false);
 const {n}=attempt('shark',500000);n.actionPoints=2;assert.equal(getLoanOffer(n,'shark').cap,0);assert.equal(getLoanOffer(n,'shark').allowed,false);
 n.debts[0].overdue=true;assert.match(getLoanOffer(n,'card').reason,/逾期/);assert.match(getLoanOffer(n,'shark').reason,/催还款/);
});
test('normal period settlement charges new channels interest and applies their specific overdue consequences',()=>{
 for(const kind of ['friend','card','shark']){
  const {n}=attempt(kind);n.cash=0;n.monthlyIncome=0;const before=structuredClone(n),next=advanceTurn(n).state,d=next.debts.find(d=>d.kind===kind);
  assert.ok(d.overdue);assert.equal(d.principal,100000);assert.equal(d.interest,kind==='shark'?36000:kind==='card'?12000:0);
  if(kind==='friend')assert.ok(next.stats.trust<before.stats.trust);if(kind==='shark')assert.ok(next.lastTurnSummary.notes.some(x=>x.includes('催收电话')));if(kind==='card')assert.ok(next.lastTurnSummary.notes.some(x=>x.includes('额度被冻结')));
  assert.deepEqual(decodeSave(encodeSave(next)),next);
 }
});
test('rescue prompt is once per crisis, persistent, deferred during stories, and available again on relapse',()=>{
 let s=adult();assert.ok(shouldOfferRescue(s,getMetrics(s)));const before=structuredClone(s);s=acknowledgeRescue(s);assert.equal(s.cash,before.cash);assert.equal(s.rng,before.rng);assert.equal(s.actionPoints,before.actionPoints);assert.equal(before.survival.rescuePromptSeen,false);
 s=decodeSave(encodeSave(s));assert.equal(shouldOfferRescue(s,getMetrics(s)),false);s.cash=126000;syncSurvival(s,getMetrics(s));assert.equal(s.survival.rescuePromptSeen,false);
 s.cash=0;syncSurvival(s,getMetrics(s));assert.ok(shouldOfferRescue(s,getMetrics(s)));s.phase='event';assert.equal(shouldOfferRescue(s,getMetrics(s)),false);
 s.phase='planning';delete s.survival.rescuePromptSeen;s=decodeSave(encodeSave(s));assert.equal(s.survival.rescuePromptSeen,false);assert.ok(shouldOfferRescue(s,getMetrics(s)));
 s.survival.rescuePromptSeen='yes';assert.throws(()=>encodeSave(s),/生存/);
});
