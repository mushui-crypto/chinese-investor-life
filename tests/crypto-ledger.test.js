import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {PRODUCTS} from '../src/game/core.js';
import {appendMarketJournal} from '../src/game/crypto-records.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {cryptoHistory,renderCryptoLedger} from '../src/ui/crypto-ledger.js';
import {renderDesk} from '../src/ui/market-desks.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(){const s=createRun({seed:'crypto-records',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1e7,giftReceived:true});s.stats.insight=90;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const go=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);return n;};
const ctx={money:n=>'¥'+(n/100).toFixed(2),esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),icon:()=>''};

test('buy, partial exit and full exit record actual cash flows and realized net profit exactly once',()=>{
 let s=adult(),cash=s.cash;s=go(s,{type:'desk_order',product:'crypto',instrument:'BTCUSDT',amount:100000});
 let trade=cryptoHistory(s,'spot').trades[0].crypto;
 assert.equal(trade.action,'buy');assert.equal(trade.cashFlow,s.cash-cash);assert.equal(trade.pnl,undefined);
 const p=s.positions[0],id=p.id,cost=p.cost;cash=s.cash;s=go(s,{type:'desk_sell',id,bps:5000});
 trade=cryptoHistory(s,'spot').trades[0].crypto;assert.equal(trade.action,'sell');assert.equal(trade.cashFlow,s.cash-cash);assert.equal(trade.pnl,trade.cashFlow-(cost-s.positions[0].cost));
 const remainingCost=s.positions[0].cost;cash=s.cash;s=go(s,{type:'desk_sell',id,bps:10000});trade=cryptoHistory(s,'spot').trades[0].crypto;
 assert.equal(trade.cashFlow,s.cash-cash);assert.equal(trade.pnl,trade.cashFlow-remainingCost);assert.equal(cryptoHistory(s,'spot').trades.length,3);
 assert.deepEqual(decodeSave(encodeSave(s)),s);
});
test('quote churn does not erase the retained executions and stays within the old save limit',()=>{
 const s=go(adult(),{type:'desk_order',product:'crypto',instrument:'BTCUSDT',amount:100000});
 for(let i=0;i<90;i++)appendMarketJournal(s,`币圈快讯 · BTCUSDT 本段变化 ${i}%`);
 assert.equal(s.trading.journal.length,60);assert.equal(cryptoHistory(s,'spot').trades.length,1);assert.equal(cryptoHistory(s,'spot').news.length,59);
 assert.deepEqual(decodeSave(encodeSave(s)),s);
});
test('legacy executions keep their text; stock commentary and crypto quotes do not become trades',()=>{
 const s=adult();s.trading.journal=[{day:0,phase:0,text:'BTC / USDT买入成交，买入金额 ¥1,000。'}, {day:0,phase:1,text:'午间行情。A 股：市场震荡。'}, {day:0,phase:3,text:'24:00 每日结算。BTC / USDT · 日内合约当日结清 ¥900。'}, {day:0,phase:2,text:'16:00 行情。币圈快讯 · DOGEUSDT 本段上涨 2%。'}];
 assert.equal(cryptoHistory(s,'spot').trades.length,1);assert.equal(cryptoHistory(s,'spot').news.length,2);
 const html=renderCryptoLedger(s,'spot',[],{...ctx,cryptoLedgerTab:'trades'});assert.match(html,/买入金额 ¥1,000/);assert.doesNotMatch(html,/A 股：市场震荡/);
});
test('spot and contracts are separated, controls remain actionable, and rendering never mutates holdings',()=>{
 let s=go(adult(),{type:'desk_order',product:'crypto',instrument:'BTCUSDT',amount:100000});
 s=go(s,{type:'desk_order',product:'crypto_perp',instrument:'ETHUSDT',amount:100000,direction:'short',leverage:10});
 assert.equal(cryptoHistory(s,'spot').trades.length,1);assert.equal(cryptoHistory(s,'perp').trades.length,1);
 const before=structuredClone(s),spot=renderDesk(s,'crypto','BTCUSDT','spot',ctx),perp=renderDesk(s,'crypto','ETHUSDT','perp',ctx);
 assert.match(spot,/持仓成本/);assert.match(spot,/全部卖出/);assert.match(perp,/当前权益/);assert.match(perp,/做空 · 10 倍/);assert.match(perp,/追加保证金/);assert.deepEqual(s,before);
});
test('malformed new record metadata is rejected, while old journal entries remain loadable',()=>{
 const s=go(adult(),{type:'desk_order',product:'crypto',instrument:'BTCUSDT',amount:100000});
 for(const mutate of [j=>j.crypto.cashFlow=NaN,j=>j.crypto.action='fabricated',j=>j.date='2006-02-31',j=>j.crypto.pnl=Infinity]){const bad=structuredClone(s);mutate(bad.trading.journal.find(j=>j.crypto));assert.throws(()=>decodeSave(encodeSave(bad)));}
 const old=structuredClone(s);for(const j of old.trading.journal){delete j.crypto;delete j.date;delete j.clock;}assert.deepEqual(decodeSave(encodeSave(old)),old);
});
test('automatic contract settlement or liquidation appears once with the actual returned cash',()=>{
 let s=go(adult(),{type:'desk_order',product:'crypto_perp',instrument:'BTCUSDT',amount:100000,direction:'long',leverage:10});
 const cost=s.positions[0].cost;
 for(let i=0;i<3&&s.positions.some(p=>p.kind==='crypto_perp');i++)s=go(s,{type:'market_tick',market:'crypto'});
 const exits=cryptoHistory(s,'perp').trades.filter(j=>['liquidation','settlement'].includes(j.crypto.action));
 assert.equal(exits.length,1);assert.equal(exits[0].crypto.pnl,exits[0].crypto.cashFlow-cost);
 const paid=s.ledger.filter(e=>e.account==='cash'&&['日内逐仓强平','加密日内合约每日结清'].includes(e.label)).reduce((n,e)=>n+e.amount,0);
 assert.equal(exits[0].crypto.cashFlow,paid);assert.deepEqual(decodeSave(encodeSave(s)),s);
});
