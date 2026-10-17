import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ensureRoutine} from '../src/game/day-routine.js';
import {createRun} from '../src/game/narrative.js';
import {applyAction,advanceTurn,getActionAvailability,getMetrics} from '../src/game/core.js';
import {instruments,quoteFor} from '../src/game/market-play.js';
import {FUTURES_GROUPS,FUTURES_INSTRUMENTS,futurePrice} from '../src/game/futures-markets.js';
import {marketChartBars,forexChartBars} from '../src/ui/market-chart.js';
import {renderDesk} from '../src/ui/market-desks.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
function adult(){const s=createRun({seed:'futures-v147',familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000000,monthlyIncome:800000,giftReceived:true});s.stats.insight=60;s.marketProgress.unlocked.futures=true;return s;}
const order=(id,direction='long',leverage=2)=>({type:'desk_order',product:'futures',instrument:id,direction,leverage,amount:100000});
const step=(s,a)=>{const r=applyAction(s,a);assert.equal(r.result.error,undefined,r.result.error);return r.state;};
const save=s=>decodeSave(encodeSave(s));
const ctx={money:n=>'¥'+n/100,esc:s=>String(s).replace(/'/g,'&#39;'),icon:()=>''};

test('five categories each expose exactly three distinct, playable instruments',()=>{
 assert.equal(instruments('futures').length,15);assert.equal(new Set(FUTURES_INSTRUMENTS.map(i=>i.id)).size,15);
 for(const [group] of FUTURES_GROUPS)assert.equal(FUTURES_INSTRUMENTS.filter(i=>i.group===group).length,3);
 for(const i of FUTURES_INSTRUMENTS)for(const dir of ['long','short'])for(const leverage of [2,5,10]){
  const s=adult(),worth=getMetrics(s).netWorth,n=step(s,order(i.id,dir,leverage)),p=n.positions.at(-1);
  assert.equal(p.entryPrice,quoteFor(s,'futures',i.id).price);assert.equal(p.units,100000*leverage);assert.equal(p.margin,100000);assert.equal(getMetrics(n).netWorth,worth);assert.deepEqual(save(n),n);
  const sold=step(n,{type:'desk_sell',id:p.id,bps:10000});assert.equal(getMetrics(sold).netWorth,worth-200);
 }
});
test('index contracts use the same live and preview series as their stock markets',()=>{
 let s=adult();for(const i of FUTURES_INSTRUMENTS.filter(i=>i.market))s=step(s,order(i.id));
 for(let tick=0;tick<3;tick++){
  s=step(s,{type:'market_tick'});
  for(const i of FUTURES_INSTRUMENTS.filter(i=>i.market)){
   const w=s.trading.stockWorld[i.market],q=quoteFor(s,'futures',i.id),p=s.positions.find(p=>p.instrument===i.id);
   assert.equal(q.price,w.index);assert.equal(s.markets[i.id],w.index);assert.equal(p.lastPrice,w.index);
   const vol={a:.012,hk:.017,us:.014}[i.market];assert.deepEqual(marketChartBars(s,'index:'+i.market,q,{vol}),marketChartBars(s,'index:'+i.market,w,{price:w.index,vol}));
  }
  assert.deepEqual(save(s),s);
 }
 const n=advanceTurn(s);assert.equal(n.result.error,undefined);s=n.state;
 for(const i of FUTURES_INSTRUMENTS.filter(i=>i.market)){assert.equal(s.markets[i.id],s.trading.stockWorld[i.market].index);const p=s.positions.find(p=>p.instrument===i.id);if(p)assert.equal(p.lastPrice,s.markets[i.id]);}
 assert.deepEqual(save(s),s);
});
test('three currency pairs obey one cross rate before, during and after a life period',()=>{
 let s=adult();for(const id of ['USD_CNY','EUR_CNY','EUR_USD'])s=step(s,order(id));
 const consistent=s=>{const usd=quoteFor(s,'futures','USD_CNY').price,eur=quoteFor(s,'futures','EUR_CNY').price,cross=quoteFor(s,'futures','EUR_USD').price;assert.equal(cross,Math.round(eur/usd*100000));};
 consistent(s);
 for(let n=0;n<3;n++){s=step(s,{type:'market_tick'});consistent(s);for(const p of s.positions)assert.equal(p.lastPrice,futurePrice(s,p.instrument));assert.deepEqual(save(s),s);}
 const result=advanceTurn(s);assert.equal(result.result.error,undefined);s=result.state;consistent(s);assert.deepEqual(save(s),s);
});
test('A share index follows A share sessions while energy and FX remain tradable',()=>{
 let s=adult();ensureRoutine(s);s.dayRoutine.stage=1;s=step(s,order('INDEX_A'));const id=s.positions[0].id;
 for(const stage of [0,2,4,5,6]){s.dayRoutine.stage=stage;assert.equal(getActionAvailability(s,order('INDEX_A')).allowed,false);assert.equal(getActionAvailability(s,{type:'desk_sell',id,bps:10000}).allowed,false);assert.ok(getActionAvailability(s,order('NATGAS')).allowed);assert.ok(getActionAvailability(s,order('EUR_USD')).allowed);}
 for(const stage of [1,3]){s.dayRoutine.stage=stage;assert.ok(getActionAvailability(s,order('INDEX_A')).allowed);assert.ok(getActionAvailability(s,{type:'desk_sell',id,bps:10000}).allowed);}
});
test('all lots in one commodity share period prices and old currency/oil contracts can exit',()=>{
 let s=step(step(adult(),order('COPPER')),order('COPPER','short'));
 const r=advanceTurn(s);assert.equal(r.result.error,undefined);s=r.state;for(const p of s.positions)assert.equal(p.lastPrice,s.markets.COPPER);assert.deepEqual(save(s),s);
 for(const underlying of ['GBP','CHF','WTI_2020_05','stock']){const old=step(adult(),{type:'invest',product:'futures',underlying,amount:100000,leverage:2,direction:'long'});old.positions[0].managed=true;old.positions[0].instrument=underlying;const n=save(old);assert.ok(getActionAvailability(n,{type:'desk_sell',id:n.positions[0].id,bps:10000}).allowed);assert.equal(step(n,{type:'desk_sell',id:n.positions[0].id,bps:10000}).positions.length,0);}
});
test('each category shows three choices, FX units and understandable direction labels',()=>{
 const s=adult();for(const i of FUTURES_INSTRUMENTS){const html=renderDesk(s,'futures',i.id,'spot',ctx);assert.match(html,/期货与外汇/);assert.equal((html.match(/class="instrument-option /g)||[]).length,3);assert.equal((html.match(/data-action="desk-instrument"/g)||[]).length,8);assert.ok(!/undefined|NaN/.test(html));if(i.group==='fx'){assert.ok(html.includes('做多'+i.base));assert.ok(html.includes('做空'+i.base));assert.ok(html.includes('保证金和盈亏以人民币结算'));}}
});


test('FX preview history also derives the EUR/USD cross from its two legs',()=>{
 const s=adult(),bars=id=>forexChartBars(s,id,quoteFor(s,'futures',id));
 const usd=bars('USD_CNY'),eur=bars('EUR_CNY'),cross=bars('EUR_USD');
 for(let n=0;n<30;n++){assert.equal(cross[n].close,Math.round(eur[n].close/usd[n].close*100000));assert.equal(cross[n].open,Math.round(eur[n].open/usd[n].open*100000));}
});

test('new energy contracts liquidate only their margin and currency lots share signed returns',()=>{
 let s=step(adult(),order('NATGAS','long',10));const amount=s.positions[0].margin;
 const n=advanceTurn(s,{returns:{NATGAS:-.95}});assert.equal(n.result.error,undefined);assert.ok(n.state.flags.futures_liquidated);assert.equal(n.state.positions.length,0);assert.ok(!n.state.debts.some(d=>/穿仓/.test(d.name)));assert.ok(amount>0);
 s=step(step(adult(),order('USD_CNY','long',5)),order('USD_CNY','short',5));
 const units=s.positions[0].units;s=step(s,{type:'desk_manage',id:s.positions[0].id,operation:'margin',amount:50000});assert.equal(s.positions[0].units,units);
 s=step(s,{type:'market_tick'});const [long,short]=s.positions;assert.equal(long.lastPrice,short.lastPrice);assert.equal((long.value-long.margin)+(short.value-short.margin),-(long.feesPaid+short.feesPaid));assert.deepEqual(save(s),s);
});
