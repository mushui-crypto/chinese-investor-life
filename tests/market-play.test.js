import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun,act,nextTurn} from '../src/game/narrative.js';
import {applyAction,advanceTurn,getActionAvailability,getMetrics,PRODUCTS,applyEffects} from '../src/game/core.js';
import {DESKS,instruments,quoteFor,tradingState} from '../src/game/market-play.js';
import {stockMarket} from '../src/game/stock-markets.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
function adult(seed='desk-proof'){const s=createRun({seed,familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000000,monthlyIncome:800000,giftReceived:true});s.flags.gambling_exposed=true;s.stats.insight=90;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
function action(s,a){const out=applyAction(s,a);assert.equal(out.result.error,undefined,out.result.error);return out.state;}
function order(s,product,extra={}){const instrument=instruments(product)[0].id;return action(s,{type:'desk_order',product,instrument,amount:PRODUCTS[product].min,leverage:product==='crypto_perp'?50:2,direction:'long',duration:3,strikeRatio:1,...(product==='stock'?{shares:100,amount:100*quoteFor(s,'stock',instrument).price}:{}),...extra});}
function closeDay(s){while(s.trading.phase<3)s=action(s,{type:'market_tick'});return s;}
function roundtrip(s){return decodeSave(encodeSave(s));}

test('all 11 desks have a playable engine path, dedicated products round trip',()=>{
 assert.equal(Object.keys(DESKS).length,11);
 for(const product of Object.keys(PRODUCTS)){const s=order(adult(),product);assert.equal(s.positions[0].kind,product);assert.equal(s.actionPoints,2);assert.equal(s.trading.energy,['ponzi','housing','angel'].includes(product)?6:5);assert.deepEqual(roundtrip(s),s,product);}
});
test('T+1 applies per stock lot, survives reload and cannot be bypassed from assets',()=>{
 let s=order(adult(),'stock',{shares:200,amount:200000}),p=s.positions[0];
 for(const type of ['sell','desk_sell'])assert.match(getActionAvailability(s,{type,id:p.id,bps:10000}).reason,/T\+1/);
 s=roundtrip(s);const age=s.age,turn=s.turn;s=action(closeDay(s),{type:'market_day'});assert.equal(s.age,age);assert.equal(s.turn,turn);
 assert.ok(getActionAvailability(s,{type:'desk_sell',id:p.id,bps:5000}).allowed);
 s=order(s,'stock');const recent=s.positions.at(-1);assert.match(getActionAvailability(s,{type:'sell',id:recent.id}).reason,/T\+1/);
 const before=s.cash;s=action(s,{type:'desk_sell',id:p.id,bps:5000});assert.equal(s.positions.find(x=>x.id===p.id).shares,100);assert.equal(s.positions.find(x=>x.id===recent.id).shares,100);assert.ok(s.cash>before);
});
test('retired cards cannot change quotes and legacy pending cards remain loadable',()=>{
 let s=order(order(adult(),'stock'),'stock'),plain=structuredClone(s);
 for(const card of ['bull','bear']){const r=applyAction(s,{type:'stock_card',card,instrument:'chip'});assert.match(r.result.error,/已移除/);assert.strictEqual(r.state,s);}
 assert.deepEqual(s,plain);assert.deepEqual(s.trading.stockCards,{bull:0,bear:0});
 s.trading.stockCards={bull:0,bear:1};s.trading.cardUsedDay=s.trading.day;s.trading.influences={'stock:chip':.06};
 const saved=roundtrip(s);assert.deepEqual(saved,s);const a=action(saved,{type:'market_tick'}),baseline=action(plain,{type:'market_tick'});
 assert.deepEqual(a.trading.quotes,baseline.trading.quotes);assert.equal(a.rng,baseline.rng);assert.deepEqual(a.positions,baseline.positions);assert.deepEqual(a.trading.influences,{});
 assert.equal(a.positions[0].lastPrice,a.positions[1].lastPrice);
 for(const [key,q] of Object.entries(a.trading.quotes).filter(([k])=>k.startsWith('stock:')&&stockMarket(k).id==='a'))assert.ok(q.price>=Math.round(q.open*.9)&&q.price<=Math.round(q.open*1.1),key);
 const next=advanceTurn(saved);assert.equal(next.result.error,undefined);assert.deepEqual(next.state.trading.stockCards,{bull:0,bear:0});assert.deepEqual(next.state.trading.influences,{});
});

test('fractional lots, stale prices and unsafe market orders are rejected atomically',()=>{
 const s=adult(),before=structuredClone(s);
 for(const extra of [{shares:1,amount:1000},{shares:100,amount:999},{shares:NaN,amount:100000},{shares:100,instrument:'FAKE',amount:100000}]){const r=applyAction(s,{type:'desk_order',product:'stock',instrument:'chip',...extra});assert.ok(r.result.error);assert.strictEqual(r.state,s);}
 assert.deepEqual(s,before);
});
test('trading continues past day three while each close bills exactly one daily budget',()=>{
 let s=adult(),cash=s.cash;
 for(let day=0;day<3;day++){for(let j=0;j<3;j++)s=action(s,{type:'market_tick'});if(day<2)s=action(roundtrip(s),{type:'market_day'});}
 assert.equal(getActionAvailability(s,{type:'market_day'}).allowed,true);assert.ok(applyAction(s,{type:'market_tick'}).result.error);assert.equal(s.cash,cash+s.survival.salaryPaid-s.survival.livingAccrued);assert.equal(s.survival.days,3);assert.equal(s.actionPoints,2);assert.equal(s.age,25);
});
test('crypto spot is T+0 while 100x contracts settle the same day without consuming a life period',()=>{
 let s=order(adult(),'crypto'),id=s.positions[0].id;assert.ok(getActionAvailability(s,{type:'desk_sell',id,bps:10000}).allowed);s=action(s,{type:'desk_sell',id,bps:10000});
 const cash=s.cash;s=order(s,'crypto_perp',{leverage:100});assert.equal(s.positions[0].leverage,100);const before=roundtrip(s);s=closeDay(s);
 assert.equal(s.age,25);assert.equal(s.turn,20);assert.equal(s.positions.filter(p=>p.kind==='crypto_perp').length,0);assert.ok(s.cash>=cash-100000);assert.deepEqual(closeDay(before),s);
 const completed=s.cash;assert.ok(applyAction(s,{type:'market_tick'}).result.error);assert.equal(s.cash,completed);
});
test('skipping a life period completes short trading contracts exactly once before wages',()=>{
 let s=order(adult(),'crypto_perp',{leverage:100});s=order(s,'option',{duration:5});
 const result=advanceTurn(s);assert.ok(!result.result.error,result.result.error);const n=result.state;assert.equal(n.positions.filter(p=>p.kind==='crypto_perp'||p.expiryDay!==undefined).length,0);assert.ok(n.age>s.age);assert.deepEqual(roundtrip(n),n);
 const receipt=n.lastTurnSummary.receipt;assert.equal(receipt.cashIn-receipt.cashOut,n.cash-s.cash);
});
test('crypto leverage has actual liquidation across price paths and retains borrowing obligations',()=>{
 let liquidated=0;
 for(let i=0;i<25;i++){let s=adult('liquidation-'+i);s=applyEffects(s,[{op:'loan',principal_yuan:10000,apr_bps:800,term_months:24,purpose:'game'}]).state;const debts=structuredClone(s.debts);s=order(s,'crypto_perp',{leverage:100});s=closeDay(s);if(s.flags.futures_liquidated)liquidated++;assert.deepEqual(s.debts,debts);}
 assert.ok(liquidated>0);
});
test('margin top-up moves existing cash without multiplying exposure or forgiving losses',()=>{
 let s=order(adult(),'futures',{leverage:10});const p=structuredClone(s.positions[0]),cash=s.cash,net=getMetrics(s).netWorth;
 s=action(s,{type:'desk_manage',operation:'margin',id:p.id,amount:200000});assert.equal(s.cash,cash-200000);assert.equal(s.positions[0].units,p.units);assert.equal(s.positions[0].margin,p.margin+200000);assert.equal(getMetrics(s).netWorth,net);assert.deepEqual(roundtrip(s),s);
});
test('daily options decay, expire and short-side cash deficits remain liabilities',()=>{
 let s=order(adult(),'option',{duration:1,strikeRatio:1.05});s=closeDay(s);assert.equal(s.positions.length,0);
 // A saved underlying jumps against a seller at the next observed mark.
 s=order(adult(),'option_short',{duration:1});s.trading.quotes.stock={price:20000,open:20000,history:[10000,20000]};s=closeDay(s);assert.equal(s.positions.length,0);assert.ok(s.ledger.some(e=>e.label==='卖方期权超保证金赔付'));
});
test('fund plans lock the purchase, execute once per life period and skip insufficient money',()=>{
 let s=order(adult(),'fund',{recurring:true});assert.ok(applyAction(s,{type:'desk_sell',id:s.positions[0].id,bps:10000}).result.error);assert.equal(s.trading.plans.length,1);
 const n=advanceTurn(s).state;assert.equal(n.positions.filter(p=>p.kind==='fund').length,2);assert.deepEqual(roundtrip(n),n);
 s.cash=0;s.monthlyIncome=0;const poor=advanceTurn(s).state;assert.equal(poor.positions.filter(p=>p.kind==='fund').length,1);assert.ok(poor.lastTurnSummary.notes.some(n=>n.includes('定投')&&n.includes('跳过')));
});
test('bond maturity, angel follow-on and property renovation have different state effects',()=>{
 let s=order(adult(),'bond');for(let i=0;i<2;i++)s=advanceTurn(s).state;assert.equal(s.positions.filter(p=>p.kind==='bond').length,0);assert.ok(s.ledger.some(e=>e.label==='债券到期本金兑付'));
 s=order(adult(),'angel');const id=s.positions[0].id;s.turn+=5;s=action(s,{type:'desk_manage',operation:'follow',id,amount:1000000});assert.equal(s.positions[0].lockUntilTurn,s.turn+3);
 s=order(adult(),'housing');const p=s.positions[0],net=getMetrics(s).netWorth;s=action(s,{type:'desk_manage',operation:'renovate',id:p.id});assert.equal(s.positions[0].rentBps,330);assert.ok(getMetrics(s).netWorth<net);assert.ok(applyAction(s,{type:'desk_manage',operation:'renovate',id:p.id}).result.error);assert.deepEqual(roundtrip(s),s);
});
test('ponzi failure creates a real recovery claim, never withdraws the same book balance twice',()=>{
 let failed=false;
 for(let i=0;i<20;i++){let s=order(adult('ponzi'+i),'ponzi');const id=s.positions[0].id;s=action(s,{type:'desk_sell',id,bps:10000});assert.equal(s.positions.length,0);if(s.claims.length){failed=true;assert.equal(s.claims[0].face,100000);assert.ok(applyAction(s,{type:'desk_sell',id,bps:10000}).result.error);break;}}
 assert.ok(failed);
});
test('online gambling debits and returns exact cash, cannot reroll on load and leaves a delayed case',()=>{
 let s=adult();const before=s.cash,a={type:'gamble',pick:'red',amount:10000};const out=action(s,a);assert.deepEqual(action(roundtrip(s),a),out);const g=out.trading.gambling;assert.equal(out.cash,before-10000+g.last.returned);assert.equal(g.staked,10000);assert.equal(out.legal.cases.length,1);assert.equal(out.legal.cases[0].status,'pending');
 s=action(out,{type:'gamble_leave'});const saved=roundtrip(s);assert.ok(saved.flags.gambling_quit);assert.ok(applyAction(saved,a).result.error);assert.equal(saved.legal.cases.length,1);
 for(let i=0;i<4;i++)s=advanceTurn(s).state;assert.ok(s.legal.cases[0].settled);assert.equal(s.legal.cases[0].criminal,false);
});
test('age, knowledge, encounter, imprisonment and closed phase block specialized operations',()=>{
 const s=adult();s.age=17;assert.ok(applyAction(s,{type:'gamble',amount:10000,pick:'red'}).result.error);s.age=25;s.marketProgress.unlocked={};s.seenEvents=[];assert.ok(applyAction(s,{type:'desk_order',product:'crypto_perp',instrument:'crypto',amount:100000,leverage:100}).result.error);
 s.legal.prisonMonthsLeft=12;for(const a of [{type:'market_tick'},{type:'gamble',amount:10000,pick:'red'},{type:'stock_card',instrument:'chip',card:'bull'}])assert.match(getActionAvailability(s,a).reason,/服刑/);
});
test('forged trading fields are rejected and a genuine v1.2-shaped save migrates without money or RNG changes',()=>{
 const s=order(adult(),'stock');for(const mutate of [x=>x.trading.energy=7,x=>x.trading.phase=4,x=>x.trading.stockCards.bull=99,x=>x.trading.quotes.bad={price:-1,open:100,history:[]},x=>x.positions[0].availableDay=-1,x=>x.positions[0].shares=1]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>encodeSave(bad));}
 const legacy=adult();delete legacy.trading;const rng=legacy.rng,cash=legacy.cash;const restored=roundtrip(legacy);assert.equal(restored.rng,rng);assert.equal(restored.cash,cash);assert.equal(restored.trading.energy,6);
});

const {CRYPTO_HISTORY,visibleCandles,historicalIndex}=await import('../src/game/crypto-history.js');
function legacyReplay(s,scenario){const w=CRYPTO_HISTORY.windows[scenario];s.trading.cryptoReplay={scenario,step:0};for(const [id,data] of Object.entries(w.symbols)){s.trading.quotes[id]={price:1000000,open:1000000,history:[1000000],baseUSDT:Number(data.candles[23][4]),scale:1000000};s.markets[id]=1000000;}return s;}
test('offline history contains continuous verified price windows, including real rallies and crashes',()=>{
 const windows=Object.values(CRYPTO_HISTORY.windows);assert.equal(windows.length,5);let count=0;
 for(const w of windows)for(const data of Object.values(w.symbols)){assert.equal(data.candles.length,96);assert.match(data.source,/https:\/\/data.binance.vision\/data\/futures\/um\//);assert.match(data.sha256,/^[a-f0-9]{64}$/);for(let j=1;j<data.candles.length;j++)assert.equal(data.candles[j][0]-data.candles[j-1][0],3600000);count+=data.candles.length;}
 assert.equal(count,2592);
 const doge=CRYPTO_HISTORY.windows.doge2021.symbols.DOGEUSDT.candles;assert.ok(Number(doge.at(-1)[4])>Number(doge[23][4])*3);
 const crash=CRYPTO_HISTORY.windows.march2020.symbols.BTCUSDT.candles;assert.ok(Number(crash.at(-1)[4])<Number(crash[23][4])*.75);
 const rally=CRYPTO_HISTORY.windows.rally2021.symbols.BTCUSDT.candles;assert.ok(Math.max(...rally.slice(24).map(c=>Number(c[2])))>Number(rally[23][4])*1.1);
});
test('historical replay reveals only past candles and marks holdings at actual observed price ratios',()=>{
 let s=legacyReplay(adult(),'doge2021');assert.equal(visibleCandles(s,'DOGEUSDT').length,24);
 s=order(s,'crypto',{instrument:'DOGEUSDT',amount:1000000});const entry=s.positions[0].entryPrice;s=action(s,{type:'market_tick'});
 const c=CRYPTO_HISTORY.windows.doge2021.symbols.DOGEUSDT.candles[31];assert.equal(visibleCandles(s,'DOGEUSDT').length,32);assert.equal(s.positions[0].lastPrice,historicalIndex(s,'DOGEUSDT',c[4]));assert.ok(Math.abs(s.positions[0].value-1000000*s.positions[0].lastPrice/entry)<=1);
 assert.deepEqual(roundtrip(s),s);assert.ok(applyAction(s,{type:'crypto_replay',scenario:'march2020'}).result.error);
});
test('a historical rally increases actual spot equity and can liquidate a leveraged short',()=>{
 let s=legacyReplay(adult(),'doge2021');s=order(s,'crypto',{instrument:'DOGEUSDT',amount:1000000});s=order(s,'crypto_perp',{instrument:'DOGEUSDT',leverage:100,direction:'short'});
 const result=advanceTurn(s);assert.ok(!result.result.error,result.result.error);s=result.state;const spot=s.positions.find(p=>p.kind==='crypto');assert.ok(spot.value>3000000);assert.ok(s.flags.futures_liquidated);assert.equal(s.positions.filter(p=>p.kind==='crypto_perp').length,0);assert.equal(s.trading.cryptoReplay,null);assert.deepEqual(roundtrip(s),s);
});
test('coins absent from an old historical segment remain available as simulated quotes',()=>{
 const s=legacyReplay(adult(),'march2020'),r=applyAction(s,{type:'desk_order',product:'crypto_perp',instrument:'SOLUSDT',amount:100000,leverage:10});assert.equal(r.result.error,undefined);assert.equal(r.state.positions[0].instrument,'SOLUSDT');assert.equal(visibleCandles(s,'SOLUSDT').length,0);
});
test('manual history selection is retired and cannot mutate state',()=>{
 for(const scenario of ['random','doge2021','march2020']){const s=adult(),r=applyAction(s,{type:'crypto_replay',scenario});assert.match(r.result.error,/不能选择/);assert.strictEqual(r.state,s);}
});
test('honeypot book gains cannot be sold, leveraged, borrowed against or treated as spendable wealth',()=>{
 let s=adult(),net=getMetrics(s).netWorth;s=order(s,'crypto',{instrument:'PIXIU'});const p=s.positions[0];assert.equal(p.value,0);assert.equal(getMetrics(s).netWorth,net-100000);
 assert.match(getActionAvailability(s,{type:'sell',id:p.id}).reason,/貔貅/);assert.ok(applyAction(s,{type:'desk_order',product:'crypto_perp',instrument:'PIXIU',amount:100000,leverage:100}).result.error);
 s=action(s,{type:'market_tick'});assert.ok(s.positions[0].bookBalance>100000);assert.equal(s.positions[0].value,0);s=roundtrip(s);
 s=action(s,{type:'desk_manage',operation:'evidence',id:p.id});assert.equal(s.positions.length,0);assert.equal(s.claims[0].face,100000);assert.equal(s.claims[0].value,0);assert.equal(s.legal.cases.length,0);assert.deepEqual(roundtrip(s),s);
});

test('closed contracts and zero-valued scam claims reconcile to the position ledger',()=>{
 const verify=s=>{assert.equal(s.ledger.filter(e=>e.account==='position').reduce((n,e)=>n+e.amount,0),s.positions.reduce((n,p)=>n+p.value,0));assert.equal(s.ledger.filter(e=>e.account==='claim').reduce((n,e)=>n+e.amount,0),s.claims.reduce((n,p)=>n+p.value,0));};
 for(let i=0;i<20;i++){let s=order(adult('ledger-'+i),'crypto_perp',{leverage:10});for(let j=0;j<3;j++){s=action(s,{type:'market_tick'});verify(s);}}
 let s=order(adult(),'option_short',{duration:3});s.trading.quotes.stock={price:20000,open:20000,history:[10000,20000]};s=action(s,{type:'market_tick'});verify(s);
 s=order(adult(),'crypto',{instrument:'PIXIU'});s=action(s,{type:'desk_manage',operation:'evidence',id:s.positions[0].id});verify(s);
});
test('history quote currency anchors reject malformed save values',()=>{
 const s=legacyReplay(adult(),'rally2021');
 for(const mutate of [q=>q.baseUSDT=0,q=>q.baseUSDT=-1,q=>q.scale=0,q=>delete q.scale]){const bad=structuredClone(s);mutate(bad.trading.quotes.BTCUSDT);assert.throws(()=>encodeSave(bad));}
});
