import {cryptoChartBars} from '../src/ui/crypto-chart.js';
import {assetExit} from '../src/ui/asset-exit.js';
import {receiptSummary,renderMarketFocus} from '../src/ui/play-guide-panel.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyAction,advanceTurn,PRODUCTS,applyEffects} from '../src/game/core.js';
import {instruments,tickMarket,quoteFor} from '../src/game/market-play.js';
import {CRYPTO_COINS,FICTIONAL_CRYPTO_COINS,MEME_COINS,CRYPTO_LEVERAGES,memeKind,cryptoClock,isRugged,cryptoMaintenanceRate} from '../src/game/crypto-markets.js';
import {enterCrypto,advanceCryptoEncounter} from '../src/game/crypto-events.js';
import {CRYPTO_HISTORY,historicalIndex,historicalSegment} from '../src/game/crypto-history.js';
import {renderDesk} from '../src/ui/market-desks.js';
import {contractExamples} from '../src/ui/market-information.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(seed='crypto-v129'){const s=createRun({seed,familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1e9,monthlyIncome:800000,giftReceived:true});s.stats.insight=90;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const step=(s,a)=>{const r=applyAction(s,a);assert.equal(r.result.error,undefined,r.result.error);return r.state;};
const reload=s=>decodeSave(encodeSave(s));
const order=(s,id='BTCUSDT',leverage)=>step(s,{type:'desk_order',product:leverage?'crypto_perp':'crypto',instrument:id,amount:100000,direction:'long',...(leverage?{leverage}:{})});
function tick(s){if(s.trading.phase===3)s=step(s,{type:'market_day'});return step(s,{type:'market_tick'});}
const ctx={money:n=>'¥'+(n/100),esc:s=>String(s).replaceAll('&','&amp;').replaceAll("'",'&#39;').replaceAll('"','&quot;').replaceAll('<','&lt;'),icon:()=>''};

test('fictional story coins extend the existing spot and contract series; meme identities remain seed stable at 5/3/2',()=>{
 assert.equal(CRYPTO_COINS.length,12);assert.equal(FICTIONAL_CRYPTO_COINS.length,2);assert.deepEqual(instruments('crypto_perp').map(c=>c.id),CRYPTO_COINS.map(c=>c.id));assert.equal(MEME_COINS.length,10);
 const patterns=new Set();for(let i=0;i<20;i++){const s=adult('meme-'+i),kinds=MEME_COINS.map(c=>memeKind(s,c.id));assert.equal(kinds.filter(k=>k==='honey').length,5);assert.equal(kinds.filter(k=>k==='rug').length,3);assert.equal(kinds.filter(k=>k==='random').length,2);assert.deepEqual(MEME_COINS.map(c=>memeKind(reload(s),c.id)),kinds);patterns.add(kinds.join(','));}assert.ok(patterns.size>5);
});
test('viewing and switching all crypto screens neither reveals scenarios nor rerolls the game',()=>{
 const s=adult(),before=structuredClone(s);
 for(const mode of ['spot','perp','meme']){const html=renderDesk(s,'crypto',null,mode,ctx);assert.equal((html.match(/class="coin-row /g)||[]).length,mode==='meme'?MEME_COINS.length:CRYPTO_COINS.length);assert.doesNotMatch(html,/crypto-scenario|crypto_replay|历史价格片段|march2020|断头台|貔貅/);if(mode==='perp')assert.match(html,/1000 倍/);}
 assert.deepEqual(s,before);let untouched=tick(s);assert.equal(untouched.trading.cryptoEncounter,undefined);assert.equal(untouched.trading.cryptoReplay,null);
});
test('actual entry schedules quiet days or one hidden event, including rallies and crashes',()=>{
 const seen=new Set();let quiet=0;
 for(let i=0;i<80;i++){const s=adult('encounter-'+i),n=order(s),e=n.trading.cryptoEncounter;assert.deepEqual(order(reload(s)),n);assert.equal(n.trading.cryptoReplay,null);assert.ok(e.due>cryptoClock(n));if(e.scenario)seen.add(e.scenario);else quiet++;
 const again=order(n,'ETHUSDT');assert.deepEqual(again.trading.cryptoEncounter,e);}
 assert.equal(seen.size,5);assert.ok(quiet>0);
});
test('hidden event anchors existing prices, never reveals or reprices entry before its due tick',()=>{
 let s=order(adult());s.trading.cryptoEncounter={scenario:'doge2021',due:cryptoClock(s)+2,status:'waiting'};
 s=tick(s);const before=structuredClone(s);assert.equal(s.trading.cryptoReplay,null);s=tick(s);const w=CRYPTO_HISTORY.windows.doge2021,ratio=Number(w.symbols.BTCUSDT.candles[31][4])/Number(w.symbols.BTCUSDT.candles[23][4]);
 assert.equal(s.trading.cryptoReplay.anchors.BTCUSDT,before.trading.quotes.BTCUSDT.price);assert.equal(s.trading.quotes.BTCUSDT.price,Math.round(before.trading.quotes.BTCUSDT.price*ratio));assert.deepEqual(tick(reload(before)),s);assert.deepEqual(reload(s),s);
 const bar=s.trading.quotes.BTCUSDT.daily.at(-1),path=historicalSegment(s,'BTCUSDT');assert.ok(bar.high>=Math.max(...path.map(c=>historicalIndex(s,'BTCUSDT',c[2]))));assert.ok(bar.low<=Math.min(...path.map(c=>historicalIndex(s,'BTCUSDT',c[3]))));
});
test('completed historical segment does not replay its last move on every later tick',()=>{
 const s=adult(),w=CRYPTO_HISTORY.windows.doge2021;s.trading.cryptoReplay={scenario:w.id,step:8,anchors:Object.fromEntries(Object.keys(w.symbols).map(id=>[id,10000]))};s.trading.phase=1;advanceCryptoEncounter(s);assert.ok(historicalSegment(s,'BTCUSDT'));s.trading.phase=2;advanceCryptoEncounter(s);assert.equal(historicalSegment(s,'BTCUSDT'),null);
});
test('all five honeypots block full and partial sales, retain zero realizable value and allow evidence',()=>{
 const fixture=adult();for(const coin of MEME_COINS.filter(c=>memeKind(fixture,c.id)==='honey')){let s=order(fixture,coin.id),id=s.positions[0].id;assert.equal(s.positions[0].value,0);assert.ok(s.positions[0].honeypot);for(const bps of [5000,10000])assert.ok(applyAction(s,{type:'desk_sell',id,bps}).result.error);assert.ok(applyAction(s,{type:'desk_order',product:'crypto_perp',instrument:coin.id,amount:100000,leverage:1000}).result.error);s=tick(s);assert.equal(s.positions[0].value,0);s=reload(s);s=step(s,{type:'desk_manage',id,operation:'evidence'});assert.equal(s.claims[0].value,0);assert.deepEqual(reload(s),s);}
});
test('three delayed rugs stay tradable before their timer, then erase holdings and cannot resurrect',()=>{
 const fixture=adult();for(const coin of MEME_COINS.filter(c=>memeKind(fixture,c.id)==='rug')){let s=order(fixture,coin.id),due=s.trading.memeProjects[coin.id].due;assert.ok(due>cryptoClock(s));s=step(s,{type:'desk_sell',id:s.positions[0].id,bps:5000});s=order(s,coin.id);assert.equal(s.trading.memeProjects[coin.id].due,due);const before=reload(s);
 const run=x=>{for(let i=0;i<8&&!isRugged(x,coin.id);i++)x=tick(x);return x;};s=run(s);assert.deepEqual(run(before),s);assert.equal(s.trading.quotes[coin.id].price,0);assert.equal(s.positions.length,0);assert.equal(s.trading.quotes[coin.id].daily.at(-1).low,0);assert.equal(s.ledger.filter(e=>e.account==='position').reduce((a,e)=>a+e.amount,0),0);assert.deepEqual(reload(s),s);s=tick(s);assert.equal(s.trading.quotes[coin.id].price,0);assert.ok(applyAction(s,{type:'desk_order',product:'crypto',instrument:coin.id,amount:100000}).result.error);const n=advanceTurn(s);assert.equal(n.result.error,undefined);assert.equal(n.state.markets[coin.id],0);assert.deepEqual(reload(n.state),n.state);}
});
test('skipping a period or quiet calendar days still settles scheduled project failure',()=>{
 for(const path of ['period','quiet']){let s=adult('rug-time'),id=MEME_COINS.find(c=>memeKind(s,c.id)==='rug').id;s=order(s,id);s.trading.memeProjects[id].due=cryptoClock(s)+6;
 if(path==='period'){const r=advanceTurn(s);assert.equal(r.result.error,undefined);s=r.state;}else{while(s.trading.phase<3)s=tick(s);s.behavior.pending=null;s.lifeArcs.pending=null;s=step(s,{type:'wait_days',days:2});}
 assert.ok(isRugged(s,id));assert.equal(s.positions.length,0);assert.equal(s.markets[id],0);assert.deepEqual(reload(s),s);}
});
test('two random meme projects allow T+0 exit and can rise or fall without trap timers',()=>{
 const fixture=adult();for(const coin of MEME_COINS.filter(c=>memeKind(fixture,c.id)==='random')){let s=order(fixture,coin.id);assert.equal(s.trading.memeProjects,undefined);assert.equal(s.positions[0].honeypot,undefined);s=tick(s);assert.ok(s.positions[0].value>0);s=step(s,{type:'desk_sell',id:s.positions[0].id,bps:10000});assert.equal(s.positions.length,0);}
});
test('10 through 1000x are real order settings; higher or unsupported leverage is rejected atomically',()=>{
 for(const leverage of CRYPTO_LEVERAGES){const s=order(adult(),'BTCUSDT',leverage),p=s.positions[0],example=contractExamples({product:'crypto_perp',amount:100000,leverage,direction:'long'});assert.equal(p.units,100000*leverage);assert.equal(p.liquidation,Math.round(p.units*cryptoMaintenanceRate(leverage)));assert.ok(p.liquidation<100000-example.fee);assert.deepEqual(reload(s),s);assert.ok(example.distance>0);}
 for(const leverage of [0,-1,101,1001,2000]){const s=adult(),r=applyAction(s,{type:'desk_order',product:'crypto_perp',instrument:'BTCUSDT',amount:100000,leverage,direction:'long'});assert.ok(r.result.error);assert.strictEqual(r.state,s);}
});
test('1000x survives flat prices at first update but a tiny adverse move liquidates without touching loans',()=>{
 for(const direction of ['long','short']){let s=applyEffects(adult('max-'+direction),[{op:'loan',principal_yuan:10000,apr_bps:800,term_months:24,purpose:'game'}]).state;s=step(s,{type:'desk_order',product:'crypto_perp',instrument:'BTCUSDT',amount:100000,leverage:1000,direction});const debts=structuredClone(s.debts),p=s.positions[0];
 const preview=contractExamples({product:'crypto_perp',amount:p.margin,leverage:p.leverage,direction});assert.equal(preview.fee,20000);assert.ok(Math.abs(preview.distance-.055)<1e-9);assert.ok(p.margin-preview.fee>p.liquidation);
 s.trading.cryptoEncounter={scenario:'march2020',due:cryptoClock(s)+2,status:'waiting'};for(let j=0;j<3;j++)s=tick(s);assert.equal(s.positions.length,0);assert.deepEqual(s.debts,debts);assert.ok(s.cash>=0);assert.deepEqual(reload(s),s);}
});
test('new event timers and zero prices reject malformed saves but old saves remain untouched',()=>{
 let s=order(adult());for(const mutate of [x=>x.trading.cryptoEncounter.due=NaN,x=>x.trading.cryptoEncounter.scenario='future',x=>x.trading.cryptoEncounter.status='bad']){const n=structuredClone(s);mutate(n);assert.throws(()=>encodeSave(n));}
 const old=adult();assert.deepEqual(reload(old),old);const bad=structuredClone(old);bad.trading.quotes.BTCUSDT={price:0,open:10000,history:[0]};assert.throws(()=>encodeSave(bad));
});

test('1000x engine keeps a flat-price position open and liquidates on a 0.07 percent adverse move',()=>{
 for(const direction of ['long','short']){let s=step(adult(),{type:'desk_order',product:'crypto_perp',instrument:'BTCUSDT',amount:100000,leverage:1000,direction});s.trading.cryptoEncounter={scenario:null,due:cryptoClock(s)+2,status:'quiet'};
 const api={draw:()=>.5,mul:(a,b)=>Math.round(a*b),record:()=>{},stat:()=>{},closePosition:(state,p,amount,label)=>{state.cash+=amount;state.positions=state.positions.filter(x=>x.id!==p.id);state.testClose={amount,label};}};
 tickMarket(s,api);assert.equal(s.positions.length,1);assert.equal(s.positions[0].value,80000);assert.equal(s.flags.futures_liquidated,undefined);
 api.draw=()=>direction==='long'?.49:.51;tickMarket(s,api);assert.equal(s.positions.length,0);assert.ok(s.flags.futures_liquidated);assert.equal(s.testClose.amount,0);assert.match(s.testClose.label,/强平/);}
});

test('long-held scam dashboard balances cannot overflow or block life progression',()=>{
 let s=order(adult(),'PIXIU');s.positions[0].bookBalance=Number.MAX_SAFE_INTEGER;s=tick(reload(s));assert.equal(s.positions[0].bookBalance,Number.MAX_SAFE_INTEGER);assert.equal(s.positions[0].value,0);const n=advanceTurn(s);assert.equal(n.result.error,undefined);assert.deepEqual(reload(n.state),n.state);
});

test('asset management returns to the correct crypto series, and old replay receipts stay hidden',()=>{
 for(const [id,leverage,mode] of [['BTCUSDT',undefined,'spot'],['ETHUSDT',1000,'perp'],['PIXIU',undefined,'meme']]){const s=order(adult(),id,leverage),p=s.positions[0];assert.equal(assetExit(s,p).mode,mode);assert.ok(renderMarketFocus(s,ctx).includes('data-mode="'+mode+'"'));}
 const s=adult();s.journey.lastAction='crypto_replay';s.lastResult={text:'进入某段历史行情',title:'旧记录'};const before=structuredClone(s);assert.equal(receiptSummary(s),null);assert.deepEqual(s,before);
});

test('all crypto series have labelled simulated prehistory without touching saves or future events',()=>{
 const s=adult(),before=structuredClone(s);
 for(const coin of [...CRYPTO_COINS,...MEME_COINS]){const q=quoteFor(s,'crypto',coin.id),bars=cryptoChartBars(s,coin.id,q);assert.equal(bars.length,30);assert.equal(bars.filter(b=>b.preview).length,29);assert.equal(bars.at(-2).close,bars.at(-1).open);assert.ok(bars.some(b=>b.open!==b.close));for(const b of bars){assert.ok(b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close));}assert.deepEqual(cryptoChartBars(reload(s),coin.id,q),bars);}
 assert.deepEqual(s,before);
 const a=cryptoChartBars(s,'BTCUSDT',quoteFor(s,'crypto','BTCUSDT'));const other=structuredClone(s);other.trading.cryptoEncounter={scenario:'doge2021',due:5,status:'waiting'};assert.deepEqual(cryptoChartBars(other,'BTCUSDT',quoteFor(other,'crypto','BTCUSDT')),a);
 const html=renderDesk(s,'crypto',null,'spot',ctx);assert.match(html,/data-info="daily-chart"/);assert.match(html,/>现货<\/button>/);assert.match(html,/>合约<\/button>/);assert.doesNotMatch(html,/现货 · T\+0<\/button>|合约 · 最高/);
});
test('recorded crypto days replace background candles without rewriting their overlapping past',()=>{
 let s=adult(),id='BTCUSDT';const first=cryptoChartBars(s,id,quoteFor(s,'crypto',id));for(let j=0;j<3;j++)s=tick(s);s=step(s,{type:'market_day'});const next=cryptoChartBars(s,id,quoteFor(s,'crypto',id));assert.deepEqual(next.filter(b=>b.preview),first.filter(b=>b.preview).slice(1));assert.equal(next.filter(b=>!b.preview).length,2);assert.equal(s.trading.quotes[id].daily.length,2);assert.equal(next.at(-2).close,s.trading.quotes[id].daily[0].close);
});
