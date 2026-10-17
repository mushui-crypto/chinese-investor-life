import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyAction,advanceTurn} from '../src/game/core.js';
import {gameDate,addGameDays,quoteDates,resetGameCalendar} from '../src/game/game-calendar.js';
import {dailyQuotes} from '../src/game/daily-quotes.js';
import {quoteFor} from '../src/game/market-play.js';
import {marketChartBars} from '../src/ui/market-chart.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const x=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?x.events:x;}setSaveCatalog(catalog);
function adult(){const s=createRun({seed:'calendar-dates',familyId:'F08',birthYear:1988},catalog);Object.assign(s,{age:18,turn:11,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000000,giftReceived:true});return s;}
function step(s,type,extra={}){const r=applyAction(s,{type,...extra});assert.equal(r.result.error,undefined,r.result.error);return r.state;}
const tick=s=>step(s,'market_tick'),reload=s=>decodeSave(encodeSave(s)),quoted=s=>s.trading.quotes['stock:chip'];

test('all markets derive thirty dated candles from the virtual birthday year',()=>{
 const s=adult(),snapshot=JSON.stringify(s);assert.equal(gameDate(s),'2006-01-01');
 for(const [kind,id] of [['stock','chip'],['stock','hk_platform'],['stock','us_compute'],['fund','balanced'],['crypto','btc']]){
  const q=quoteFor(s,kind,id),dates=quoteDates(s,marketChartBars(s,kind+':'+id,q));
  assert.equal(dates.length,30);assert.equal(dates[0],'2005-12-03');assert.equal(dates.at(-1),'2006-01-01');
 }
 assert.equal(JSON.stringify(s),snapshot);
});
test('intraday updates and close retain their date; tomorrow advances exactly once',()=>{
 let s=adult();for(let i=0;i<3;i++){s=tick(s);assert.equal(gameDate(s),'2006-01-01');assert.equal(quoted(s).daily.at(-1).date,'2006-01-01');}
 assert.equal(s.debtClock.periodDays,1);s=step(s,'market_day');assert.equal(gameDate(s),'2006-01-02');assert.equal(quoted(s).daily.at(-1).date,'2006-01-02');assert.deepEqual(reload(s),s);
});
test('virtual calendar handles month, leap-day and year boundaries without local-time offsets',()=>{
 for(const [date,next] of [['2008-02-28','2008-02-29'],['2008-02-29','2008-03-01'],['2006-02-28','2006-03-01'],['2006-12-31','2007-01-01']]){
  let s=adult();s.trading.calendar={turn:s.turn,day:s.trading.day,date};s=tick(tick(tick(s)));s=step(s,'market_day');assert.equal(gameDate(s),next);assert.equal(quoted(s).daily.at(-1).date,next);assert.equal(addGameDays(date,1),next);
 }
});
test('quiet days and life-period jumps preserve the original dates and prices',()=>{
 let s=tick(tick(tick(adult()))),before=structuredClone(quoted(s).daily);s.lifeArcs.pending=null;s.behavior.pending=null;s=step(s,'wait_days',{days:5});
 assert.equal(gameDate(s),addGameDays('2006-01-01',s.debtClock.periodDays-1));assert.deepEqual(dailyQuotes(s,quoted(s)),before);
 const next=advanceTurn(s);assert.equal(next.result.error,undefined);s=next.state;assert.equal(gameDate(s),'2006-07-01');assert.deepEqual(quoted(s).daily.slice(0,-1),before);assert.equal(quoted(s).daily.at(-1).date,'2006-07-01');assert.deepEqual(reload(s),s);
 const last=advanceTurn(s);assert.equal(last.result.error,undefined);assert.equal(gameDate(last.state),'2007-01-01');
});
test('old saves gain dates on the next action without changing load or historical OHLC',()=>{
 let s=tick(tick(tick(adult())));s=step(s,'market_day');s=tick(s);delete s.trading.calendar;
 for(const q of [...Object.values(s.trading.quotes),...Object.values(s.trading.stockWorld)])for(const b of q.daily||[])delete b.date;
 const before=structuredClone(s),dates=quoteDates(s,quoted(s).daily);assert.deepEqual(dates,['2006-01-01','2006-01-02']);assert.deepEqual(reload(s),before);assert.deepEqual(s,before);
 const after=tick(s);assert.deepEqual(quoteDates(after,quoted(after).daily),dates);assert.deepEqual(quoted(after).daily[0],{...quoted(before).daily[0],date:dates[0]});
});
test('legacy older periods recover dates from saved age and preserve skipped-day gaps',()=>{
 const s=adult();s.age=18.5;s.turn=12;s.trading.day=50;s.netWorthHistory.push({turn:11,age:18,value:0});
 const bars=[{day:45,turn:11},{day:47,turn:11},{day:50,turn:12}];assert.deepEqual(quoteDates(s,bars),['2006-01-01','2006-01-03','2006-07-01']);
});
test('short life periods cannot make virtual dates run backwards',()=>{
 const s=adult();s.age=18+2/12;s.turn=12;s.trading.day=35;s.trading.calendar={turn:11,day:31,date:'2006-02-28'};resetGameCalendar(s);assert.equal(gameDate(s),'2006-03-04');
});
test('save validation rejects malformed virtual dates and anchors while retaining old saves',()=>{
 const s=tick(adult());for(const change of [s=>s.trading.calendar.date='2006-02-30',s=>s.trading.calendar.date='bad',s=>s.trading.calendar.day=s.trading.day+1,s=>s.trading.calendar.turn=s.turn+1,s=>quoted(s).daily[0].date='2006-13-01']){const bad=structuredClone(s);change(bad);assert.throws(()=>encodeSave(bad),/日期|日线/);}
});
