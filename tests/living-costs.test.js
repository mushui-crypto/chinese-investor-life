import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {advanceTurn,getMetrics,getActionAvailability,getSurvivalStatus,PRODUCTS} from '../src/game/core.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {ensureRoutine,resetRoutineDay,dayOptions,daySlots,arriveRoutineSlot,hasDayJob,dayGigPay} from '../src/game/day-routine.js';
import {livingCostBreakdown,advanceLivingCosts,validateLivingCosts,newLivingCosts} from '../src/game/living-costs.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {quoteFor} from '../src/game/market-play.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(seed='costs',wage=0){const s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000,monthlyIncome:wage,occupation:wage?'普通职员':'待业青年',giftReceived:true});s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];s.stats.skill=50;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const go=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);return n;};
const save=s=>decodeSave(encodeSave(s));
const api={charge:(s,n)=>{const paid=Math.min(n,s.cash);s.cash-=paid;return n-paid;},stat:(s,d)=>{for(const [k,n] of Object.entries(d))s.stats[k]=Math.max(0,Math.min(100,s.stats[k]+n));}};
test('age brackets set distinct daily costs; rental investments do not discount dependent household costs',()=>{
 const s=adult();for(const [age,daily] of [[17,0],[18,10000],[24.5,10000],[25,18000],[34.5,18000],[35,21000],[45,23000],[55,21000],[65,19000]]){s.age=age;assert.equal(getMetrics(s).monthlyExpense,daily*30+(age>=55?90000:0));}
 s.age=40;s.household.partner=true;s.household.hasChild=true;assert.equal(getMetrics(s).monthlyExpense,920000);s.positions.push({kind:'housing',value:1});assert.equal(livingCostBreakdown(s).total,920000);
});
test('already billed days are not repriced and reserve remains advisory',()=>{
 let s=adult('boundary',400000);s.age=24.5;s.lifeArcs=newLifeArcs(s);s=go(s,{type:'calendar_day'});assert.equal(s.survival.livingAccrued,10000);s.age=25;assert.equal(getMetrics(s).livingReserve,18000*179);const cash=s.cash;s=go(s,{type:'calendar_day'});assert.equal(s.survival.livingAccrued,28000);assert.equal(s.cash,cash-18000);
 s.cash=100000;assert.ok(getActionAvailability(s,{type:'invest',product:'fund',amount:100000}).allowed);assert.equal(getActionAvailability(s,{type:'invest',product:'fund',amount:100001}).allowed,false);
});
test('unemployed and retired days have no commuting, coworker or overtime events',()=>{
 for(const retired of [false,true])for(let stage of [1,2,5]){const s=adult('unemployed',retired?300000:0);if(retired)s.occupation='退休';ensureRoutine(s);resetRoutineDay(s,stage);arriveRoutineSlot(s,{draw:()=>0});assert.ok(['neighbour','lunch','family'].includes(s.dayRoutine.pending));assert.equal(hasDayJob(s),false);assert.equal(daySlots(s)[5][1],'傍晚');}
 const s=adult('worker',300000);ensureRoutine(s);resetRoutineDay(s,5);arriveRoutineSlot(s,{draw:()=>0});assert.equal(s.dayRoutine.pending,'overtime');assert.equal(daySlots(s)[5][1],'下班');
});
test('A-share sessions stay identical with or without a job',()=>{
 for(const wage of [0,300000])for(const stage of [0,1,2,3,4,5,6,7,8]){const s=adult('session',wage);ensureRoutine(s);resetRoutineDay(s,stage);const buy={type:'desk_order',product:'stock',instrument:'chip',shares:100,amount:quoteFor(s,'stock','chip').price*100};assert.equal(getActionAvailability(s,buy).allowed,[1,3].includes(stage));}
});
test('half-day gigs pay once per slot, persist, and reflect fatigue',()=>{
 let s=adult();ensureRoutine(s);resetRoutineDay(s,1);const before=s.cash,pay=dayGigPay(s),ap=s.actionPoints;s=go(s,{type:'day_activity',choice:'day_gig'});assert.equal(s.cash,before+pay);assert.equal(s.actionPoints,ap);assert.equal(s.dayRoutine.choices[1],'day_gig');s=save(s);assert.equal(getActionAvailability(s,{type:'day_activity',choice:'day_gig'}).allowed,false);resetRoutineDay(s,3);s.behavior.fatigue=65;assert.equal(dayGigPay(s),Math.floor((4000+s.stats.skill*20)*.75));assert.ok(dayOptions(s).some(c=>c[0]==='errands'));
});
test('successful job search changes later slots and does not back-pay days before hiring',()=>{
 let found;for(let i=0;i<30&&!found;i++){let s=adult('job-'+i);s=go(s,{type:'calendar_day'});s=go(s,{type:'calendar_day'});ensureRoutine(s);resetRoutineDay(s,1);s=go(s,{type:'day_activity',choice:'job_hunt'});if(s.monthlyIncome)found=s;}
 assert.ok(found);assert.ok(hasDayJob(found));assert.equal(found.lifeArcs.wageAdjustment,Math.round(found.monthlyIncome*2/30));assert.deepEqual(save(found),found);found.dayRoutine.stage=3;assert.ok(dayOptions(found).some(c=>c[0]==='focus'));assert.ok(!dayOptions(found).some(c=>c[0]==='day_gig'));
});
test('pension is not reduced by work distraction or fatigue',()=>{
 let s=adult('pension',400000);s.age=67;s.occupation='退休';s.behavior.fatigue=90;assert.equal(getSurvivalStatus(s).dailySalary,13333);s=go(s,{type:'calendar_day'});assert.equal(s.survival.last.salary,13333);assert.equal(s.behavior.lostWages,0);
});
test('unexpected costs are repeatable, bounded and use a separate RNG stream',()=>{
 const a=adult('expense-repeat',400000),b=structuredClone(a),rng=a.rng;advanceLivingCosts(a,720,api);for(let i=0;i<720;i++)advanceLivingCosts(b,1,api);assert.deepEqual(a,b);assert.equal(a.rng,rng);assert.ok(a.livingCosts.total>0);assert.equal(10000000-a.cash,a.livingCosts.total);assert.deepEqual(save(a),a);
});
test('small, medium and large bills respect quiet opening, cooldowns and monthly cap',()=>{
 const counts={small:0,medium:0,large:0};for(let seed=0;seed<80;seed++){const s=adult('rates-'+seed,500000);s.cash=1e9;s.age=40;let all=[];for(let i=0;i<720;i++){const day=s.livingCosts?.lastAny||0;advanceLivingCosts(s,1,api);if((s.livingCosts?.lastAny||0)>day)all.push(s.livingCosts.history.at(-1));}let last=0,medium=0,large=0;for(const e of all){assert.ok(e.day>=11&&e.day-last>=7);if(large)assert.ok(e.day-large>=14);if(e.tier==='medium'){assert.ok(e.day-medium>=45);medium=e.day;}if(e.tier==='large'){assert.ok(e.day-large>=180);large=e.day;}assert.ok(all.filter(h=>h.day<=e.day&&e.day-h.day<30).length<=3);last=e.day;counts[e.tier]++;}validateLivingCosts(s);}
 assert.ok(counts.small>counts.medium&&counts.medium>counts.large&&counts.large>0);
});
test('cash shortage becomes a bill without selling holdings; survival suppresses more random costs',()=>{
 let found;for(let seed=0;seed<100&&!found;seed++){const s=adult('owed-'+seed,500000);s.cash=18000;s.positions=[{kind:'stock',value:100000,id:'kept'}];advanceLivingCosts(s,90,api);if(s.livingCosts.history.some(h=>h.owed))found=s;}
 assert.ok(found);assert.ok(found.cash>=0);assert.equal(found.positions[0].id,'kept');const total=found.livingCosts.total;found.survival.active=true;advanceLivingCosts(found,90,api);assert.equal(found.livingCosts.total,total);
});
test('an actual large expense creates arrears, enters survival and survives reload',()=>{
 let found;
 for(let i=0;i<2000&&!found;i++){let s=adult('large-bill-'+i);s.age=35;s.cash=60000;s.livingCosts={...newLivingCosts(),days:179};s=go(s,{type:'calendar_day'});if(s.livingCosts.history.at(-1)?.tier==='large')found=s;}
 assert.ok(found);const h=found.livingCosts.history.at(-1);assert.equal(found.cash,0);assert.equal(h.owed,h.amount-39000);assert.equal(found.debts.filter(d=>d.kind==='arrears'&&d.name.startsWith('临时开销')).reduce((sum,d)=>sum+d.principal,0),h.owed);assert.equal(getSurvivalStatus(found).active,true);assert.equal(found.survival.failed,false);assert.deepEqual(save(found),found);
});
test('old saves acquire no historical charges and malformed new records are rejected',()=>{
 const s=adult(),before=structuredClone(s);assert.deepEqual(save(s),before);assert.equal(s.livingCosts,undefined);const n=adult();advanceLivingCosts(n,90,api);for(const patch of [v=>v.days=-1,v=>v.lastAny=v.days+1,v=>v.total=-1,v=>v.history[0].amount=-1]){const bad=structuredClone(n);patch(bad.livingCosts);assert.throws(()=>save(bad));}
});
test('compressed and daily periods both record unexpected bills once',()=>{
 const s=adult('period-costs',500000);let daily=structuredClone(s);for(let i=0;i<180;i++){daily.behavior.pending=null;daily.lifeArcs.pending=null;daily=go(daily,{type:'calendar_day'});}const bulk=advanceTurn(s);assert.equal(bulk.result.error,undefined);assert.deepEqual(bulk.state.livingCosts,daily.livingCosts);const total=daily.livingCosts.total;const done=advanceTurn(daily);assert.equal(done.result.error,undefined);assert.equal(done.state.livingCosts.total,total);assert.equal(done.state.cash,bulk.state.cash);
});
