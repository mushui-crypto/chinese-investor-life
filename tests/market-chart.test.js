import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyAction,advanceTurn,PRODUCTS} from '../src/game/core.js';
import {INSTRUMENTS,quoteFor} from '../src/game/market-play.js';
import {STOCK_MARKETS,stockWorld} from '../src/game/stock-markets.js';
import {dailyQuotes} from '../src/game/daily-quotes.js';
import {marketChartBars} from '../src/ui/market-chart.js';
import {renderDesk} from '../src/ui/market-desks.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {gameDate} from '../src/game/game-calendar.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const x=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?x.events:x;}setSaveCatalog(catalog);
function adult(seed='market-history'){const s=createRun({seed,familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1e9,monthlyIncome:800000,giftReceived:true});s.stats.insight=90;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const step=(s,a)=>{const r=applyAction(s,a);assert.equal(r.result.error,undefined,r.result.error);return r.state;},tick=s=>step(s,{type:'market_tick'}),reload=s=>decodeSave(encodeSave(s));
const bars=(s,kind='stock',id='chip')=>marketChartBars(s,kind+':'+id,quoteFor(s,kind,id),{vol:INSTRUMENTS[kind].find(i=>i.id===id).vol});
const preview=bs=>bs.filter(b=>b.preview);
const ctx={money:n=>'¥'+n/100,esc:s=>String(s),icon:()=>''};
function valid(bs){assert.equal(bs.length,30);assert.equal(preview(bs).length,29);assert.ok(bs.some(b=>b.close>b.open));assert.ok(bs.some(b=>b.close<b.open));for(const [i,b] of bs.entries()){assert.ok(['open','high','low','close'].every(k=>Number.isSafeInteger(b[k])&&b[k]>0));assert.ok(b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close));if(i)assert.equal(bs[i-1].close,b.open);}}

test('all 12 stocks, funds, bonds and futures open with thirty distinct seeded days',()=>{
 const s=adult(),before=structuredClone(s),series=[];
 for(const kind of ['stock','fund','bond','futures'])for(const i of INSTRUMENTS[kind]){const bs=bars(s,kind,i.id);valid(bs);series.push(JSON.stringify(bs));assert.equal(bs.at(-1).close,quoteFor(s,kind,i.id).price);}
 assert.equal(new Set(series).size,series.length);assert.deepEqual(s,before);
});
test('all three indices connect simulated prehistory to their actual opening index',()=>{
 const s=adult(),before=structuredClone(s);for(const id of Object.keys(STOCK_MARKETS)){const q=stockWorld(s)[id],bs=marketChartBars(s,'index:'+id,q,{price:q.index,vol:.014});valid(bs);assert.equal(bs.at(-1).close,q.index);}assert.deepEqual(s,before);
});
test('reloading or changing future RNG never redraws the chart or changes saved money',()=>{
 const s=tick(adult()),before=structuredClone(s),original=bars(s);assert.deepEqual(bars(reload(s)),original);const future=structuredClone(s);future.rng+=7919;future.trading.stockWorld.a.regime='retreat';assert.deepEqual(bars(future),original);assert.deepEqual(s,before);assert.notDeepEqual(bars(adult('different-life')),original);
});
test('intraday ticks only update today and tomorrow replaces the oldest preview day',()=>{
 let s=adult();const initial=bars(s);for(let i=0;i<3;i++){s=tick(s);const next=bars(s);assert.deepEqual(preview(next),preview(initial));assert.equal(next.at(-1).close,quoteFor(s,'stock','chip').price);assert.equal(next.filter(b=>!b.preview).length,1);}
 const today=structuredClone(s.trading.quotes['stock:chip'].daily[0]);s=step(s,{type:'market_day'});assert.deepEqual(preview(bars(s)),preview(initial).slice(1));assert.deepEqual(bars(s).at(-2),today);assert.equal(bars(s).at(-1).open,today.close);assert.deepEqual(bars(reload(s)),bars(s));
});
test('after thirty played days the whole visible window comes from actual recorded quotes',()=>{
 let s=adult();for(let i=0;i<31;i++)s=step(s,{type:'calendar_day'});for(const kind of ['stock','fund','bond','futures'])for(const i of INSTRUMENTS[kind]){const bs=bars(s,kind,i.id);assert.equal(preview(bs).length,0);assert.deepEqual(bs,dailyQuotes(s,quoteFor(s,kind,i.id)));assert.equal(bs.slice(-30).length,30);}assert.deepEqual(reload(s),s);
});
test('old saves gain a preview without rewriting their incomplete records or cross-period gaps',()=>{
 let s=tick(adult());for(const q of [...Object.values(s.trading.quotes),...Object.values(s.trading.stockWorld)])delete q.daily;const old=reload(s),before=structuredClone(old),bs=bars(old);valid(bs);assert.ok(bs.at(-1).partial);assert.deepEqual(old,before);
 s=tick(tick(tick(adult())));const recorded=structuredClone(dailyQuotes(s,quoteFor(s,'stock','chip')));s=advanceTurn(s).state;const next=bars(s);assert.deepEqual(next.filter(b=>!b.preview).slice(0,-1),recorded);assert.equal(next.filter(b=>!b.preview).length,2);assert.ok(next.at(-1).day>next.at(-2).day+1);
});
test('stock, fund, index and derivative screens use the complete opening chart',()=>{
 const s=adult();for(const kind of ['stock','fund','bond','futures','option','option_short'])for(const item of INSTRUMENTS[kind]||[{id:'stock'}]){const html=renderDesk(s,kind,item.id,'spot',ctx);const count=(html.match(/data-daily-point='/g)||[]).length;assert.equal(count,kind==='stock'?60:30,kind+':'+item.id);assert.ok(html.includes('data-info="daily-chart"'));assert.ok(!html.includes('<small>开盘前为模拟走势'));if(kind==='fund')assert.ok(!html.includes('daily-wick'));}
});
test('before A shares open, hide today placeholder and preserve all historical prices and saves',()=>{
 for(const played of [0,3,32]){
  let s=adult();for(let i=0;i<played;i++){s=tick(tick(tick(s)));s=step(s,{type:'market_day'});}
  ensureRoutine(s);resetRoutineDay(s,0);const before=structuredClone(s),q=quoteFor(s,'stock','chip'),all=bars(s);
  const history=marketChartBars(s,'stock:chip',q,{vol:INSTRUMENTS.stock[0].vol,beforeOpen:true});
  assert.deepEqual(history,all.filter(b=>b.turn!==s.turn||b.day!==s.trading.day));assert.ok(history.length);assert.ok(history.at(-1).date<gameDate(s));
  assert.equal(history.at(-1).close,q.open);
  const html=renderDesk(s,'stock','chip','spot',ctx);assert.match(html,/盘前消息/);assert.match(html,/最近收盘/);assert.match(html,/今日尚未开盘/);
  assert.ok(!html.includes('今日未收盘'));assert.deepEqual(s,before);assert.deepEqual(reload(s),s);
  resetRoutineDay(s,1);const opened=renderDesk(s,'stock','chip','spot',ctx);assert.ok(!opened.includes('stock-premarket'));assert.ok(opened.includes('今日未收盘'));assert.equal(bars(s).at(-1).date,gameDate(s));
 }
});
