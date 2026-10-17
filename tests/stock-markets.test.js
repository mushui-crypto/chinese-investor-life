import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyAction,advanceTurn,getActionAvailability,getMetrics,PRODUCTS} from '../src/game/core.js';
import {quoteFor,partialExitShares,partialExitLabel} from '../src/game/market-play.js';
import {STOCKS,STOCK_MARKETS,stockMarket,stockLot} from '../src/game/stock-markets.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
setSaveCatalog({events:read('events').events,families:read('families'),history:read('history'),endings:read('endings')});
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};
function adult(seed='regions'){const s=createRun({seed,familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000000,monthlyIncome:800000,giftReceived:true});s.stats.insight=90;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
function action(s,a){const r=applyAction(s,a);assert.equal(r.result.error,undefined,r.result.error);return r.state;}
function buy(s,instrument,shares=stockLot(instrument)){return action(s,{type:'desk_order',product:'stock',instrument,shares,amount:shares*quoteFor(s,'stock',instrument).price});}
const reload=s=>decodeSave(encodeSave(s));
const tick=s=>action(s,{type:'market_tick'});
function closeDay(s){while(s.trading.phase<3)s=tick(s);return s;}

test('three markets offer four distinct companies each',()=>{assert.equal(STOCKS.length,12);assert.equal(new Set(STOCKS.map(i=>i.id)).size,12);for(const id of Object.keys(STOCK_MARKETS))assert.equal(STOCKS.filter(i=>i.market===id).length,4);});
test('A shares remain locked per lot; Hong Kong and US can be sold on purchase day including from assets',()=>{
 for(const id of ['chip','hk_platform','us_compute']){let s=buy(adult(),id),p=s.positions[0];
  for(const type of ['sell','desk_sell'])assert.equal(getActionAvailability(s,{type,id:p.id,bps:10000}).allowed,id!=='chip');
  assert.deepEqual(reload(s),s);if(id!=='chip'){s=action(s,{type:'desk_sell',id:p.id,bps:10000});assert.equal(s.positions.length,0);assert.equal(s.cash,1000000000-Math.round(p.cost*.002));}
 }
});
test('each Hong Kong lot size is enforced, and US one-share order is affordable below generic stock minimum',()=>{
 for(const id of ['hk_property','hk_health','hk_income','us_cloud']){let s=adult(),lot=stockLot(id);const r=applyAction(s,{type:'desk_order',product:'stock',instrument:id,shares:lot-.5,amount:1000});assert.ok(r.result.error);s=buy(s,id);assert.equal(s.positions[0].shares,lot);assert.deepEqual(reload(s),s);}
 const s=buy(adult(),'us_cloud');assert.equal(s.positions[0].cost,1000);
});
test('partial sells respect market units and never dispose of the wrong number of shares',()=>{
 for(const id of ['hk_property','us_cloud']){let s=buy(adult(),id,stockLot(id)*3),p=s.positions[0];assert.equal(partialExitShares(p),stockLot(id));assert.equal(partialExitLabel(p),id==='us_cloud'?'卖出 1 股':'卖出 1 手');s=action(s,{type:'desk_sell',id:p.id,bps:5000});assert.equal(s.positions[0].shares,stockLot(id)*2);assert.deepEqual(reload(s),s);}
});
test('cross-market buys and sells share six operations while time can still advance',()=>{
 let s=buy(adult(),'chip');s=buy(s,'hk_platform');s=buy(s,'us_compute');assert.equal(s.trading.energy,3);
 s=action(s,{type:'desk_sell',id:s.positions.at(-1).id,bps:10000});s=buy(s,'us_cloud');s=buy(s,'us_consumer');assert.equal(s.trading.energy,0);
 assert.ok(applyAction(s,{type:'desk_order',product:'stock',instrument:'us_cloud',shares:1,amount:1000}).result.error);
 assert.ok(applyAction(s,{type:'desk_sell',id:s.positions.at(-1).id,bps:10000}).result.error);assert.ok(getActionAvailability(s,{type:'market_tick'}).allowed);
});

test('all three quotes and indices advance together and reload cannot reroll paths',()=>{
 let s=buy(adult(),'chip');s=buy(s,'hk_platform');s=buy(s,'us_compute');const n=tick(s);assert.deepEqual(tick(reload(s)),n);
 for(const p of n.positions){assert.equal(p.value,p.shares*n.markets[p.underlying]);assert.equal(p.lastPrice,n.trading.quotes[p.underlying].price);}
 for(const w of Object.values(n.trading.stockWorld))assert.equal(w.history.length,2);
 assert.equal(new Set(Object.values(n.trading.stockWorld).map(w=>w.index)).size,3);
});
test('multi-seed price paths allow both rallies and losses in every region; only A shares have 10 percent daily caps',()=>{
 const signs=Object.fromEntries(Object.keys(STOCK_MARKETS).map(id=>[id,{up:0,down:0,outside:0,regimes:new Set()}]));
 for(let k=0;k<120;k++){const s=closeDay(adult('regional-path-'+k));for(const i of STOCKS){const q=s.trading.quotes['stock:'+i.id],x=signs[i.market];if(q.price>q.open)x.up++;if(q.price<q.open)x.down++;if(q.price<Math.round(q.open*.9)||q.price>Math.round(q.open*1.1))x.outside++;}for(const [id,w] of Object.entries(s.trading.stockWorld))signs[id].regimes.add(w.regime);}
 for(const [id,x] of Object.entries(signs)){assert.ok(x.up>0&&x.down>0,id);assert.equal(x.regimes.size,4);if(id==='a')assert.equal(x.outside,0);else assert.ok(x.outside>0);}
});
test('index is calculated from the four actual stock returns',()=>{
 const s=tick(adult());
 for(const id of Object.keys(STOCK_MARKETS)){const avg=STOCKS.filter(i=>i.market===id).reduce((n,i)=>n+s.markets['stock:'+i.id]/1000-1,0)/4;assert.ok(Math.abs(s.trading.stockWorld[id].index-10000*(1+avg))<=1);}
});
test('life-period advance preserves market differences, all same-company lots agree with quotes and ledger',()=>{
 let s=buy(adult(),'us_compute',3);s=tick(s);s=buy(s,'us_compute',2);s=buy(s,'chip');s=buy(s,'hk_platform');
 const r=advanceTurn(s);assert.ok(!r.result.error,r.result.error);const n=r.state;
 for(const p of n.positions){assert.equal(p.value,p.shares*p.lastPrice);assert.equal(p.lastPrice,n.markets[p.underlying]);assert.equal(p.lastPrice,n.trading.quotes[p.underlying]?.price||n.markets[p.underlying]);}
 assert.equal(n.positions[0].lastPrice,n.positions[1].lastPrice);assert.deepEqual(reload(n),n);
 const marked=n.ledger.filter(e=>e.account==='position').reduce((v,e)=>v+e.amount,0);assert.equal(marked,n.positions.reduce((v,p)=>v+p.value,0));
 assert.equal(n.lastTurnSummary.receipt.netWorthDelta,getMetrics(n).netWorth-getMetrics(s).netWorth);
});
test('regional shocks affect only matching exposures during life advance',()=>{
 let s=buy(adult(),'us_compute');s=buy(s,'hk_platform');const before=s.positions[0].lastPrice;
 const r=advanceTurn(s,{returns:{stock:-.5},exposureFilter:{underlyings:['stock:us_compute']}});assert.ok(!r.result.error);const n=r.state;assert.equal(n.positions[0].lastPrice,Math.round(before*.5));assert.notEqual(n.positions[1].lastPrice,500);
});
test('old save migration adds market metadata without changing money, prices, cards, trades or RNG',()=>{
 const s=buy(adult(),'chip');delete s.trading.stockWorld;const before=structuredClone(s),n=reload(s);delete n.trading.stockWorld;assert.deepEqual(n,before);
});
test('malformed regional state, invalid lot, cross-market identity and sell-date tampering are rejected',()=>{
 const s=buy(adult(),'hk_property');for(const mutate of [x=>x.trading.stockWorld=null,x=>x.trading.stockWorld.hk.regime='guaranteed_profit',x=>x.trading.stockWorld.us.index=-1,x=>x.trading.stockWorld.a.history=[],x=>x.positions[0].shares=100,x=>x.positions[0].availableDay++,x=>x.positions[0].instrument='chip']){const bad=structuredClone(s);mutate(bad);assert.throws(()=>encodeSave(bad));}
});
