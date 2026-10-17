import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlayableRun} from '../src/game/quick-start.js';
import {applyAction,getActionAvailability,PRODUCTS,getTurnMonths} from '../src/game/core.js';
import {continuation} from '../src/game/continuation.js';
import {quoteFor} from '../src/game/market-play.js';
import {renderDailyChart} from '../src/ui/daily-chart.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
function adult(){const s=createPlayableRun({seed:'crypto-clock',familyId:'F08',startAt:'adult'},catalog);Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000000,monthlyIncome:800000});s.education.college=false;s.flags.college_student=false;s.flags.college_not_admitted=true;s.lifeArcs.pending=null;s.behavior.pending=null;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const step=(s,a)=>{const r=applyAction(s,a);assert.equal(r.result.error,undefined,r.result.error);return r.state;};
const buy=(amount=100000)=>({type:'desk_order',product:'crypto',instrument:'BTCUSDT',amount});
const tick={type:'market_tick',market:'crypto'};
function close(s){while(s.trading.phase<3)s=step(s,{type:'market_tick'});return s;}
test('crypto crosses midnight into a live new day and charges each day exactly once',()=>{
 let s=adult();const cash=s.cash,startDay=s.trading.day,age=s.age,turn=s.turn;
 for(let day=1;day<=4;day++){
  for(let segment=0;segment<3;segment++)s=step(s,tick);
  assert.equal(s.trading.phase,0);assert.equal(s.trading.day,startDay+day);assert.equal(s.trading.energy,6);assert.equal(s.survival.days,day);assert.equal(s.debtClock.periodDays,day);
  assert.equal(s.cash,cash+s.survival.salaryPaid-s.survival.livingAccrued);assert.equal(s.age,age);assert.equal(s.turn,turn);assert.ok(getActionAvailability(s,buy()).allowed);
  assert.deepEqual(decodeSave(encodeSave(s)),s);
 }
});
test('a crypto order from the stock close opens the next day without billing twice',()=>{
 const s=close(adult()),daily=structuredClone(s.survival),next=step(s,buy());
 assert.equal(next.trading.day,s.trading.day+1);assert.equal(next.trading.phase,0);assert.equal(next.trading.energy,5);assert.equal(next.cash,s.cash-100000);assert.deepEqual(next.survival,daily);
 const sold=step(next,{type:'desk_sell',id:next.positions[0].id,bps:10000});assert.equal(sold.positions.length,0);assert.equal(sold.trading.day,next.trading.day);
});
test('a spot holding can also sell at the day boundary while stocks remain closed',()=>{
 const s=close(step(adult(),buy())),p=s.positions[0],stock={type:'desk_order',product:'stock',instrument:'chip',shares:100,amount:100*quoteFor(s,'stock','chip').price};
 assert.match(getActionAvailability(s,stock).reason,/收盘/);
 const n=step(s,{type:'desk_sell',id:p.id,bps:10000});assert.equal(n.positions.length,0);assert.equal(n.trading.day,s.trading.day+1);assert.equal(n.survival.days,s.survival.days);
});
test('invalid midnight orders do not advance the calendar, refill actions or change money',()=>{
 const s=close(adult()),snapshot=structuredClone(s);
 for(const a of [buy(s.cash+1),{...buy(),instrument:'FAKE'},{...buy(),product:'crypto_perp',leverage:1001}]){const r=applyAction(s,a);assert.ok(r.result.error);assert.strictEqual(r.state,s);assert.deepEqual(s,snapshot);}
});
test('daily crypto contracts still settle before the next midnight quote opens',()=>{
 let s=step(adult(),{...buy(),product:'crypto_perp',leverage:10,direction:'long'});
 for(let n=0;n<3;n++)s=step(s,tick);
 assert.equal(s.trading.phase,0);assert.equal(s.positions.filter(p=>p.kind==='crypto_perp').length,0);assert.equal(s.survival.days,1);assert.ok(s.cash>=0);
 assert.equal(s.ledger.filter(e=>e.account==='position').reduce((n,e)=>n+e.amount,0),0);
});
test('crypto continuation uses 24h segments and preserves story and period boundaries',()=>{
 let s=adult();assert.equal(continuation(s,{market:'crypto'}).label,'到 09:30 · 上午上班');
 s=close(s);s.lifeArcs.pending=null;s.behavior.pending=null;s.trading.dayInTurn=2;const next=continuation(s,{market:'crypto'});assert.deepEqual(next.action,{type:'day_next'});assert.ok(getActionAvailability(s,next.action).allowed);
 s.lifeArcs.pending='comfort';assert.equal(continuation(s,{market:'crypto'}).kind,'life');s.lifeArcs.pending=null;
 s.debtClock.periodDays=getTurnMonths(s)*30;s.survival.days=getTurnMonths(s)*30;assert.equal(continuation(s,{market:'crypto'}).kind,'period');assert.equal(getActionAvailability(s,buy()).allowed,false);assert.equal(getActionAvailability(s,next.action).allowed,false);
});
test('last day settles once without opening a day outside the life period',()=>{
 let s=adult();s.debtClock.periodDays=getTurnMonths(s)*30-1;s.debtClock.day=s.debtClock.periodDays;s.survival.days=getTurnMonths(s)*30-1;
 for(let n=0;n<3;n++)s=step(s,tick);
 s.lifeArcs.pending=null;s.behavior.pending=null;assert.equal(s.trading.phase,3);assert.equal(s.debtClock.periodDays,getTurnMonths(s)*30);assert.equal(continuation(s,{market:'crypto'}).kind,'period');assert.equal(getActionAvailability(s,buy()).allowed,false);
});
test('crypto candle completion is distinct from exchange closing',()=>{
 const s=close(adult()),q=quoteFor(s,'crypto','BTCUSDT');const crypto=renderDailyChart(s,q,{continuous:true}),stock=renderDailyChart(s,q);
 assert.ok(crypto.includes('日线已完成'));assert.ok(!crypto.includes('已收盘'));assert.ok(stock.includes('已收盘'));
});
