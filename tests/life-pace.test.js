import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,nextTurn,chooseEvent,continueStory,eligibleChoices} from '../src/game/narrative.js';
import {applyEffects,getMetrics,getActionAvailability,getWorkOffer,PRODUCTS} from '../src/game/core.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {continuation} from '../src/game/continuation.js';
import {refreshBehavior,behaviorEvent} from '../src/game/behavior.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {quoteFor} from '../src/game/market-play.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(seed='pace',cash=1e7,wage=300000){const s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:wage,giftReceived:true});s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];s.stats.credit=80;s.stats.skill=50;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const go=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,JSON.stringify(a)+': '+n.lastResult?.error);assert.equal(n.cash-s.cash,n.ledger.slice(s.ledger.length).filter(e=>e.account==='cash').reduce((n,e)=>n+e.amount,0));return n;};
const save=s=>decodeSave(encodeSave(s));
function quiet(s){s.behavior.pending=null;s.behavior.seen=Object.keys(BEHAVIOR_EVENTS);return s;}
function through(s,day){let n=0;while(s.debtClock.day<day&&n++<100)s=go(s,{type:'live_days',days:Math.min(30,day-s.debtClock.day)});assert.equal(s.debtClock.day,day);return s;}
test('living advance matches 30 daily settlements, coalesces receipts and remains deterministic after reload',()=>{
 const s=adult(),before=structuredClone(s),n=through(s,30);let daily=s;for(let i=0;i<30;i++)daily=go(daily,{type:'calendar_day'});
 assert.deepEqual(s,before);assert.equal(n.cash,daily.cash);assert.equal(n.survival.salaryPaid,daily.survival.salaryPaid);assert.equal(n.survival.livingAccrued,daily.survival.livingAccrued);assert.equal(n.rng,daily.rng);assert.deepEqual(n.markets,daily.markets);assert.equal(n.debtClock.day,30);assert.equal(n.actionPoints,2);assert.equal(n.ledger.length<daily.ledger.length,true);assert.deepEqual(through(save(s),30),n);assert.deepEqual(save(n),n);
});
test('life button skips blank sessions while the market button keeps precise intraday control after day three',()=>{
 const s=adult();s.trading.dayInTurn=2;s.trading.phase=1;
 assert.equal(continuation(s,{skipMarket:true}).action.type,'live_days');assert.equal(continuation(s,{market:'stock'}).action.type,'day_next');s.trading.phase=3;assert.equal(continuation(s,{market:'stock'}).action.type,'day_next');
 const done=through(adult(),30);const opened=go(save(done),{type:'market_day'});assert.equal(opened.survival.days,30);assert.equal(opened.cash,done.cash);assert.equal(opened.trading.energy,6);assert.equal(getWorkOffer(opened).daily,true);
});
test('fast life stops before a bill, then services it once and preserves an appointment decision',()=>{
 let s=applyEffects(adult(),[{op:'loan',principal_yuan:3600,apr_bps:1200,term_months:12,purpose:'approved_use'}],{profile:'bank'}).state;
 s=through(s,29);assert.equal(s.debtClock.day,29);assert.equal(s.debts[0].principal,360000);s=go(save(s),{type:'live_days',days:30});assert.equal(s.debtClock.day,30);assert.equal(s.lifeArcs.audit.repaid,33600);assert.equal(s.lifeArcs.audit.interestPaid,3600);
 s=adult();s.lifeArcs.promises.push({id:'N01',day:7,status:'open'});s=go(s,{type:'live_days',days:30});assert.equal(s.debtClock.day,6);assert.equal(s.lifeArcs.promises[0].status,'open');
});
test('delivery and subsistence interrupt a batch but retired cooldowns do not without bonus cash or skipped bills',()=>{
 const met=adult();met.peopleMet.push('N12');let s=go(met,{type:'life_offer',id:'repair'});s=go(s,{type:'live_days',days:30});assert.equal(s.debtClock.day,3);assert.equal(s.lifeArcs.jobs.length,0);assert.equal(s.ledger.filter(e=>e.label==='完成repair实际收款').length,1);
 s=quiet(adult());s.behavior.cooldownUntil=7;const base=structuredClone(s);base.behavior.cooldownUntil=0;const normal=go(base,{type:'live_days',days:30});s=go(s,{type:'live_days',days:30});assert.equal(s.debtClock.day,normal.debtClock.day);assert.equal(s.cash,normal.cash);assert.doesNotMatch(s.lastResult.text,/冷静期/);
 s=go(adult('empty',18000,0),{type:'live_days',days:30});assert.equal(s.debtClock.day,1);assert.equal(s.cash,0);assert.equal(s.survival.active,true);assert.equal(continuation(s,{skipMarket:true}).action.type,'day_next');assert.equal(getActionAvailability(s,{type:'live_days',days:30}).allowed,false);
});
test('holding jumps stop within the current day, preserving the remaining time and sell rules',()=>{
 let s=adult('stock-halt'),price=quoteFor(s,'stock','chip').price;
 s=quiet(go(s,{type:'desk_order',product:'stock',instrument:'chip',shares:100,amount:price*100}));const cost=s.positions[0].cost,id=s.positions[0].id;
 s=go(s,{type:'live_days',days:30});assert.ok(s.debtClock.day<30);assert.ok(s.positions.some(p=>p.id===id));assert.equal(s.positions[0].cost,cost);assert.equal(s.positions[0].shares,100);assert.ok(Math.abs(s.positions[0].value-cost)>=cost*.2);assert.ok(s.lastResult.text.includes('20%'));assert.deepEqual(save(s),s);
});
test('contracts may expire or liquidate during fast life, but it stops instead of opening a replacement',()=>{
 let s=quiet(go(adult('contract'),{type:'desk_order',product:'crypto_perp',instrument:'BTCUSDT',amount:100000,leverage:1000,direction:'long'}));let manual=structuredClone(s);for(let i=0;i<3;i++)manual=go(manual,{type:'market_tick'});
 for(let i=0;i<3&&s.positions.length;i++)s=go(s,{type:'live_days',days:30});assert.ok(s.debtClock.day<=1);assert.equal(s.positions.length,0);assert.equal(s.cash,manual.cash);assert.equal(s.rng,manual.rng);assert.equal(s.trading.energy,5);assert.deepEqual(save(s),s);
});
test('pending choices and invalid day counts never move time, money or RNG',()=>{
 for(const update of [s=>s.behavior.pending='tilt',s=>s.lifeArcs.pending='request',s=>s.phase='event',s=>s.legal.prisonMonthsLeft=3]){const s=adult();update(s);const n=act(s,{type:'live_days',days:30},catalog);assert.ok(n.lastResult.error);assert.equal(n.cash,s.cash);assert.equal(n.rng,s.rng);assert.equal(n.debtClock.day,s.debtClock.day);}
 for(const days of [0,-1,31,Infinity,1.5])assert.equal(getActionAvailability(adult(),{type:'live_days',days}).allowed,false);
});
test('the final days bill once, and the next life period does not charge them again',()=>{
 let s=adult();s=through(s,180);assert.equal(s.debtClock.periodDays,180);assert.equal(s.survival.livingAccrued,3240000);assert.equal(getActionAvailability(s,{type:'market_day'}).allowed,false);assert.equal(continuation(s,{skipMarket:true}).kind,'period');const cash=s.cash;
 s=nextTurn(s,catalog);assert.equal(s.lastResult?.error,undefined);assert.equal(s.cash,cash);assert.equal(s.age,25.5);assert.equal(s.debtClock.periodDays,0);assert.deepEqual(save(s),s);
});
test('repeated risk stories require both elapsed time and new player risk actions',()=>{
 let s=adult();s.behavior.pending='tilt';s=go(s,{type:'behavior_choice',scene:'tilt',choice:'review'});s.behavior.group='muted';s.behavior.seen.push('hot_hand','drawdown','night_watch','work_warning');
 s=through(s,30);s.behavior.lossStreak=2;refreshBehavior(s,getMetrics(s));assert.equal(s.behavior.pending,null);
 s.behavior.riskActions+=6;refreshBehavior(s,getMetrics(s));assert.equal(s.behavior.pending,'tilt');assert.match(behaviorEvent(s).text,/又是/);s=go(save(s),{type:'behavior_choice',scene:'tilt',choice:'cool'});assert.equal(s.behavior.history.filter(h=>h.scene==='tilt').length,2);s.behavior.riskActions+=6;refreshBehavior(s,getMetrics(s));assert.equal(s.behavior.pending,null);assert.deepEqual(save(s),s);
});
test('old behavior histories load untouched and repeating scenes never reopen paid scam branches',()=>{
 const s=adult();s.behavior.seen=['platform_invite'];s.behavior.history.push({scene:'platform_invite',choice:'decline',day:0,turn:20,age:25,title:BEHAVIOR_EVENTS.platform_invite.title,text:'关掉了邀请。'});s.behavior.group='joined';s.behavior.platform='declined';s.behavior.riskActions=30;s.behavior.lastSceneAction=0;const n=save(s);assert.deepEqual(n.behavior.history,s.behavior.history);assert.equal(n.rng,s.rng);
 n.behavior.seen.push('group_tip','group_invite');refreshBehavior(n,getMetrics(n));assert.equal(n.behavior.pending,null);
});
