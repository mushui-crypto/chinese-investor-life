import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyAction,advanceTurn,PRODUCTS,getMetrics} from '../src/game/core.js';
import {quoteFor,openTradingDay} from '../src/game/market-play.js';
import {dailyQuotes,DAILY_QUOTE_LIMIT} from '../src/game/daily-quotes.js';
import {renderDailyChart} from '../src/ui/daily-chart.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const x=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?x.events:x;}setSaveCatalog(catalog);
function adult(){const s=createRun({seed:'daily-prices',familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000000,monthlyIncome:800000,giftReceived:true});s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
function step(s,a){const r=applyAction(s,a);assert.equal(r.result.error,undefined,r.result.error);return r.state;}
const tick=s=>step(s,{type:'market_tick'}),reload=s=>decodeSave(encodeSave(s));
const stripDaily=s=>{s=structuredClone(s);for(const q of [...Object.values(s.trading.quotes),...Object.values(s.trading.stockWorld)])delete q.daily;return s;};

test('viewing daily charts is read only and never fabricates previous sessions',()=>{
 const s=adult(),before=structuredClone(s),q=quoteFor(s,'stock','chip'),bars=dailyQuotes(s,q);assert.equal(bars.length,1);assert.equal(bars[0].stage,0);assert.equal(bars[0].complete,false);assert.equal(bars[0].open,q.price);
 const html=renderDailyChart(s,q,{esc:String});assert.ok(html.includes('日 K'));assert.ok(html.includes('今日未收盘'));assert.deepEqual(s,before);
});
test('three intraday updates produce one daily OHLC bar per quoted instrument',()=>{
 let s=adult();const prices={};for(let phase=1;phase<=3;phase++){s=tick(s);for(const [key,q] of Object.entries(s.trading.quotes)){
  prices[key]??=[q.open];prices[key].push(q.price);const b=q.daily.at(-1);assert.equal(q.daily.length,1);assert.equal(b.open,q.open);assert.equal(b.high,Math.max(...prices[key]));assert.equal(b.low,Math.min(...prices[key]));assert.equal(b.close,q.price);assert.equal(b.complete,phase===3);assert.equal(b.partial,false);assert.equal(b.stage,phase);
 }assert.deepEqual(reload(s),s);}
 assert.equal(s.trading.quotes['fund:balanced'].daily[0].close,s.markets['fund:balanced']);
 for(const w of Object.values(s.trading.stockWorld)){assert.equal(w.daily.length,1);assert.equal(w.daily[0].close,w.index);assert.ok(w.daily[0].complete);}
});
test('tomorrow starts a new candle without editing yesterday; holdings use its same quote',()=>{
 let s=step(adult(),{type:'desk_order',product:'stock',instrument:'chip',shares:100,amount:100000});for(let i=0;i<3;i++)s=tick(s);
 const yesterday=structuredClone(s.trading.quotes['stock:chip'].daily[0]);s=step(s,{type:'market_day'});let q=s.trading.quotes['stock:chip'];assert.equal(q.daily.length,2);assert.equal(q.daily[1].open,yesterday.close);assert.equal(q.daily[1].stage,0);assert.deepEqual(q.daily[0],yesterday);
 s=tick(s);q=s.trading.quotes['stock:chip'];assert.equal(q.daily.length,2);assert.equal(s.positions[0].value,s.positions[0].shares*q.daily.at(-1).close);assert.deepEqual(q.daily[0],yesterday);assert.deepEqual(reload(s),s);
});
test('legacy saves remain unchanged on load; partial current days are labelled rather than rebuilt',()=>{
 const s=stripDaily(tick(tick(adult()))),before=structuredClone(s),loaded=reload(s);assert.deepEqual(loaded,before);
 const bars=dailyQuotes(loaded,loaded.trading.quotes['stock:chip']);assert.equal(bars.length,1);assert.ok(bars[0].partial);assert.deepEqual(loaded,before);
 const recorded=tick(loaded),fresh=tick(tick(tick(adult())));assert.deepEqual(stripDaily(recorded),stripDaily(fresh));assert.ok(recorded.trading.quotes['stock:chip'].daily[0].partial);assert.deepEqual(reload(recorded),recorded);
});
test('daily recording does not change money, positions, bills, debt, prices or random draws',()=>{
 const s=tick(adult()),a=tick(s),b=tick(stripDaily(s));assert.deepEqual(stripDaily(a),stripDaily(b));assert.deepEqual(getMetrics(a),getMetrics(b));
});
test('daily calendar mode creates one candle per day including three intraday segments',()=>{
 let s=adult();for(let i=0;i<4;i++)s=step(s,{type:'calendar_day'});
 assert.equal(s.debtClock.day,4);for(const q of Object.values(s.trading.quotes)){assert.equal(q.daily.length,4);assert.ok(q.daily.every(b=>b.complete&&b.stage===3));}assert.deepEqual(reload(s),s);
});
test('quiet calendar jumps do not fabricate daily prices and cross-period returns do not rewrite prior candles',()=>{
 let s=tick(tick(tick(adult())));s.lifeArcs.pending=null;s.behavior.pending=null;const before=structuredClone(s.trading.quotes['stock:chip'].daily);
 s=step(s,{type:'wait_days',days:5});assert.deepEqual(s.trading.quotes['stock:chip'].daily,before);assert.deepEqual(dailyQuotes(s,s.trading.quotes['stock:chip']),before);
 const r=advanceTurn(s);assert.equal(r.result.error,undefined);const after=r.state,q=after.trading.quotes['stock:chip'];assert.deepEqual(q.daily.slice(0,-1),before);assert.equal(q.daily.at(-1).open,q.price);assert.equal(q.daily.at(-1).stage,0);assert.equal(q.daily.at(-1).turn,after.turn);assert.deepEqual(reload(after),after);
});
test('unplayed opening candles do not accumulate across childhood or skipped periods',()=>{
 const s=adult();for(let i=0;i<8;i++){s.turn++;s.trading.day+=3;openTradingDay(s);}for(const w of Object.values(s.trading.stockWorld)){assert.equal(w.daily.length,1);assert.equal(w.daily[0].stage,0);}
});
test('retains the last sixty daily bars with bounded saves',()=>{
 let s=adult();for(let i=0;i<65;i++)s=step(s,{type:'calendar_day'});for(const q of Object.values(s.trading.quotes)){assert.equal(q.daily.length,DAILY_QUOTE_LIMIT);assert.equal(q.daily.at(-1).day-q.daily[0].day,59);}assert.deepEqual(reload(s),s);
});
test('save validation rejects impossible OHLC, future or duplicated days and current-quote mismatch',()=>{
 let s=tick(tick(tick(adult())));s=step(s,{type:'market_day'});s=tick(s);
 for(const mutate of [q=>q.daily[0].high=0,q=>q.daily[0].low=q.daily[0].high+1,q=>q.daily[0].day=s.trading.day+1,q=>q.daily[1].day=q.daily[0].day,q=>q.daily[1].turn=s.turn+1,q=>q.daily[1].close++,q=>q.daily[1].complete=true,q=>q.daily[1].stage=9,q=>q.daily[1].partial='yes',q=>q.daily=null]){const bad=structuredClone(s);mutate(bad.trading.quotes['stock:chip']);assert.throws(()=>encodeSave(bad),/日线/);}
 const bad=structuredClone(s);bad.trading.stockWorld.a.daily.at(-1).close++;assert.throws(()=>encodeSave(bad),/日线/);
});
test('fund daily charts display net value and selected-day figures without stock candles',()=>{
 const s=tick(tick(tick(adult()))),html=renderDailyChart(s,s.trading.quotes['fund:balanced'],{esc:String,line:true,title:'林间均衡 · 每日净值',unit:'净值'});assert.ok(html.includes('每日净值'));assert.ok(html.includes('daily-dot'));assert.ok(!html.includes('daily-wick'));assert.ok(html.includes('已收盘'));assert.ok(html.includes('data-daily-point'));
});
