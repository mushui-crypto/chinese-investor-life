import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyEffects,applyAction,getActionAvailability,getMetrics,PRODUCTS,rngNext} from '../src/game/core.js';
import {cryptoLifeState,ensureCryptoLife} from '../src/game/crypto-life.js';
import {cryptoLifeActionPreview,cryptoLifeActionReason,cryptoLifeHoldings,validateCryptoLifeFinance} from '../src/game/crypto-life-finance.js';
import {INSTRUMENTS} from '../src/game/market-play.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
function adult(seed='crypto-finance'){
 const s=createRun({seed,familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000,monthlyIncome:0,giftReceived:true});
 s.flags.crypto_aware=true;s.flags.ponzi_exposed=true;s.marketProgress={firstExperienceAge:18,simulations:0,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};ensureCryptoLife(s);return s;
}
function effect(s,e,id){const out=applyEffects(s,[{op:'crypto_life',...e}],id?{resolutionId:id}:{});assert.equal(out.result.error,undefined,out.result.error);return out.state;}
function act(s,a){const out=applyAction(s,a);assert.equal(out.result.error,undefined,out.result.error);return out.state;}
function clock(s,days){const n=structuredClone(s);n.debtClock.day+=days;const out=applyEffects(n,[]);assert.equal(out.result.error,undefined,out.result.error);return out.state;}
function ledger(s){for(const account of ['position','claim'])assert.equal(s.ledger.filter(e=>e.account===account).reduce((n,e)=>n+e.amount,0),(account==='position'?s.positions:s.claims).reduce((n,p)=>n+p.value,0),account);}
function firstDrawBelow(s,n){while(rngNext(s.rng).value>=n)s.rng=rngNext(s.rng).seed;}

test('a 100-yuan fictional spot buy is a real position, with no immediate invented return',()=>{
 const s=adult(),preview=cryptoLifeActionPreview(s,{action:'buy',branch:'spot',amount:10000});assert.deepEqual([preview.cashCost,preview.fee],[10000,0]);
 const n=effect(s,{action:'buy',branch:'spot',amount:10000},'crypto:test:first');assert.equal(n.cash,s.cash-10000);assert.equal(n.positions[0].instrument,'CLG');assert.equal(n.positions[0].value,10000);assert.equal(getMetrics(n).netWorth,getMetrics(s).netWorth);assert.equal(cryptoLifeState(n).invested,10000);assert.ok(cryptoLifeState(n).memories.firstCryptoBuy);ledger(n);
 const twice=applyEffects(n,[{op:'crypto_life',action:'buy',amount:10000}],{resolutionId:'crypto:test:first'});assert.equal(twice.result.alreadyApplied,true);assert.strictEqual(twice.state,n);
 assert.deepEqual(decodeSave(encodeSave(n)),n);
});

test('spot principal withdrawal uses real sale proceeds and cannot withdraw a removed position twice',()=>{
 let s=effect(adult(),{action:'buy',amount:10000});const p=s.positions[0],id=p.id;p.value=20000;p.lastPrice*=2;s.markets.CLG=p.lastPrice;s.ledger.push({id:'proof-gain',turn:s.turn,age:s.age,account:'position',amount:10000,label:'测试行情盯市'});
 const quote=cryptoLifeActionPreview(s,{action:'sell_principal',branch:'spot'}),before=s.cash;s=effect(s,{action:'sell_principal',branch:'spot'});assert.equal(s.cash-before,quote.proceeds);assert.ok(s.cash-before>=10000);assert.ok(s.positions[0].value>0);ledger(s);
 s=effect(s,{action:'sell',positionId:id});const cash=s.cash,bad=applyEffects(s,[{op:'crypto_life',action:'sell',positionId:id}]);assert.match(bad.result.error,/没有|重复/);assert.equal(bad.state.cash,cash);ledger(s);
});

test('old desk buys and full sells share long-term Crypto receipts',()=>{
 let s=act(adult(),{type:'desk_order',product:'crypto',instrument:'CHI',amount:100000});assert.equal(s.positions[0].cryptoLifeBranch,'alt');assert.equal(cryptoLifeState(s).branches.alt.invested,100000);
 s=act(s,{type:'desk_sell',id:s.positions[0].id,bps:10000});assert.equal(cryptoLifeState(s).branches.alt.returned,99800);assert.equal(cryptoLifeState(s).realizedProfit,-200);ledger(s);
});

test('permanently exited or closed-leverage state blocks new risk but leaves exits available',()=>{
 let s=effect(adult(),{action:'buy',amount:10000});s.behavior.cryptoLife.status='CRYPTO_EXITED';assert.match(cryptoLifeActionReason(s,{action:'buy',amount:10000}),/退出/);assert.equal(cryptoLifeActionReason(s,{action:'sell'}),'');assert.equal(getActionAvailability(s,{type:'desk_order',product:'crypto',instrument:'CLG',amount:100000}).allowed,false);
 s.behavior.cryptoLife.status='ACTIVE';s.behavior.cryptoLife.leverageClosed=true;assert.match(cryptoLifeActionReason(s,{action:'open_leverage',amount:10000}),/永久关闭/);assert.equal(cryptoLifeActionReason(s,{action:'buy',branch:'spot',amount:10000}),'');
});

test('only an explicit later-life relapse choice can reopen an exited Crypto path',()=>{
 let s=effect(adult(),{action:'buy',amount:10000});s=effect(s,{action:'sell'});s=clock(s,720);assert.equal(cryptoLifeState(s).status,'CRYPTO_EXITED');
 assert.equal(getActionAvailability(s,{type:'desk_order',product:'crypto',instrument:'CLG',amount:100000,allowRelapse:true}).allowed,false);
 const choice={op:'crypto_life',action:'buy',amount:10000,allowRelapse:true};assert.match(applyEffects(s,[choice]).result.error,/复入/);
 const out=applyEffects(s,[choice],{eventId:'CL39',choiceId:'B',resolutionId:'crypto:CL39:proof'});assert.equal(out.result.error,undefined);assert.equal(cryptoLifeState(out.state).relapseCount,1);assert.equal(out.state.positions.length,1);assert.equal(cryptoLifeState(out.state).memories.cryptoRelapse.eventId,'CL39');
});

test('scheme pays actual cash for the initial six months exactly once and preserves principal',()=>{
 const base=adult();let s=effect(base,{action:'scheme_join',amount:100000});assert.equal(s.cash,base.cash-100000);const paid0=s.cash;
 s=clock(s,29);assert.equal(s.cash,paid0);s=clock(s,151);assert.equal(s.cash,paid0+15000);assert.equal(cryptoLifeState(s).schemePayments,6);assert.equal(s.positions[0].value,100000);assert.equal(s.positions[0].cryptoScheme.status,'mature');ledger(s);
 s=clock(s,0);assert.equal(s.cash,paid0+15000);assert.equal(cryptoLifeState(s).schemePayments,6);assert.deepEqual(decodeSave(encodeSave(s)),s);
 const before=s.cash;s=effect(s,{action:'scheme_withdraw'});assert.equal(s.cash-before,100000);assert.equal(s.positions.length,0);assert.equal(cryptoLifeState(s).branches.scheme.returned,115000);assert.equal(cryptoLifeState(s).branches.scheme.realizedProfit,15000);ledger(s);
});

test('adding project capital never pays for days before that contribution existed',()=>{
 let s=effect(adult(),{action:'scheme_join',amount:100000});s=clock(s,29);s=effect(s,{action:'scheme_add',amount:100000});const before=s.cash;s=clock(s,1);assert.equal(s.cash-before,2500+83);assert.equal(s.positions[0].value,200000);ledger(s);
});

test('project warning cannot be skipped by long fast-forward, then failure leaves only a zero-value claim',()=>{
 let s=effect(adult(),{action:'scheme_join',amount:100000});s=clock(s,180);s.positions[0].cryptoScheme.status='warning';s.positions[0].cryptoScheme.warningDay=s.debtClock.day;s.positions[0].cryptoScheme.warningSeen=false;
 s=clock(s,720);assert.equal(s.positions[0].cryptoScheme.status,'warning');assert.equal(s.positions[0].value,100000);assert.equal(s.claims.length,0);
 s=effect(s,{action:'scheme_ack'});firstDrawBelow(s,.3);s=clock(s,30);assert.equal(s.positions[0].cryptoScheme.status,'frozen');assert.equal(s.positions[0].value,0);assert.match(cryptoLifeActionReason(s,{action:'scheme_withdraw'}),/冻结/);ledger(s);
 const frozenCash=s.cash,frozenRng=s.rng;s=clock(s,720);assert.equal(s.positions[0].cryptoScheme.status,'frozen');assert.equal(s.positions[0].cryptoScheme.maintenanceSeen,false);assert.equal(s.claims.length,0);assert.equal(s.cash,frozenCash);assert.equal(s.rng,frozenRng);
 // Older frozen saves have not necessarily shown the maintenance story either.
 delete s.positions[0].cryptoScheme.maintenanceSeen;s=decodeSave(encodeSave(s));s=clock(s,360);assert.equal(s.positions[0].cryptoScheme.status,'frozen');
 s=effect(s,{action:'scheme_ack'});assert.equal(s.positions[0].cryptoScheme.maintenanceSeen,true);const acknowledged=s.positions[0].cryptoScheme.lastTransitionDay;s=clock(s,29);assert.equal(s.positions[0].cryptoScheme.status,'frozen');s=effect(s,{action:'scheme_ack'});assert.equal(s.positions[0].cryptoScheme.lastTransitionDay,acknowledged);
 firstDrawBelow(s,.3);s=clock(s,1);assert.equal(s.positions.length,0);assert.equal(s.claims.length,1);assert.equal(s.claims[0].value,0);assert.equal(s.claims[0].face,100000);assert.equal(cryptoLifeState(s).schemeFailed,true);ledger(s);
 const cash=s.cash,loss=cryptoLifeState(s).realizedProfit;s=clock(s,60);assert.equal(s.cash,cash);assert.equal(cryptoLifeState(s).realizedProfit,loss);assert.deepEqual(decodeSave(encodeSave(s)),s);
});

test('project exits after a warning pay only existing principal and stop future payment',()=>{
 let s=effect(adult(),{action:'scheme_join',amount:100000});s=clock(s,30);s.positions[0].cryptoScheme.status='warning';s.positions[0].cryptoScheme.warningDay=s.debtClock.day;s=effect(s,{action:'scheme_ack'});const prior=s.cash;s=effect(s,{action:'scheme_withdraw'});assert.equal(s.cash-prior,100000);assert.ok(cryptoLifeState(s).schemeExitedAfterWarning);const out=s.cash;s=clock(s,360);assert.equal(s.cash,out);ledger(s);
});

test('story contracts use existing daily settlement and never erase real debt',()=>{
 let s=adult();s=applyEffects(s,[{op:'loan',principal_yuan:1000,apr_bps:800,term_months:12,purpose:'game'}]).state;const debts=structuredClone(s.debts);s=effect(s,{action:'open_leverage',tier:'high',amount:10000});assert.equal(cryptoLifeHoldings(s,'leverage').length,1);for(let n=0;n<3;n++)s=act(s,{type:'market_tick'});assert.equal(cryptoLifeHoldings(s,'leverage').length,0);assert.deepEqual(s.debts,debts);assert.ok(cryptoLifeState(s).contractWins+cryptoLifeState(s).contractLosses>0);ledger(s);
});

test('malformed scheme state is rejected without rewriting balances',()=>{
 const s=effect(adult(),{action:'scheme_join',amount:100000}),bad=structuredClone(s);bad.positions[0].cryptoScheme.lastPaidDay=1e9;assert.throws(()=>validateCryptoLifeFinance(bad));assert.equal(bad.cash,s.cash);
});

test('confirmed later failure of an exited project changes memory without a second financial loss',()=>{
 let s=effect(adult(),{action:'scheme_join',amount:100000});s=clock(s,30);s.positions[0].cryptoScheme.status='warning';s.positions[0].cryptoScheme.warningDay=s.debtClock.day;s=effect(s,{action:'scheme_ack'});s=effect(s,{action:'scheme_withdraw'});
 const cash=s.cash,profit=cryptoLifeState(s).realizedProfit,trades=cryptoLifeState(s).totalTrades;s=clock(s,720);assert.equal(cryptoLifeState(s).schemeFailureConfirmed,false);
 s.behavior.onlineGambling.ordinaryEvents+=2;firstDrawBelow(s,.25);s=clock(s,30);assert.equal(cryptoLifeState(s).schemeFailureConfirmed,true);assert.equal(s.cash,cash);assert.equal(cryptoLifeState(s).realizedProfit,profit);assert.equal(cryptoLifeState(s).totalTrades,trades);assert.equal(s.claims.length,0);assert.deepEqual(decodeSave(encodeSave(s)),s);
});

test('explicit Crypto borrowing creates real debt and repayment spends cash without investing it',()=>{
 let s=adult();s.stats.trust=90;const before=s.cash;s=effect(s,{action:'borrow',amount:10000});assert.equal(s.cash,before+10000);assert.equal(s.positions.length,0);assert.equal(s.debts[0].principal,10000);assert.equal(cryptoLifeState(s).borrowed,10000);assert.equal(cryptoLifeState(s).returned,0);
 const quote=cryptoLifeActionPreview(s,{action:'repay',amount:5000});s=effect(s,{action:'repay',amount:5000});assert.equal(quote.cashCost,5000);assert.equal(s.cash,before+5000);assert.equal(s.debts[0].principal,5000);assert.equal(cryptoLifeState(s).invested,0);
});

test('lowering risk closes only current contracts and leaves ordinary spot holdings intact',()=>{
 let s=effect(adult(),{action:'buy',amount:10000});s=effect(s,{action:'open_leverage',amount:10000,tier:'low'});const spot=s.positions.find(p=>p.kind==='crypto').id,before=s.cash,quote=cryptoLifeActionPreview(s,{action:'reduce'});s=effect(s,{action:'reduce'});assert.equal(s.positions.length,1);assert.equal(s.positions[0].id,spot);assert.equal(s.cash-before,quote.proceeds);assert.equal(cryptoLifeState(s).leverageClosed,false);ledger(s);
});

test('fictional quote keys do not disturb existing coin quotes or the shared RNG sequence',()=>{
 const s=adult('same-legacy-quotes'),full=act(s,{type:'market_tick'}),original=INSTRUMENTS.crypto;
 let baseline;try{INSTRUMENTS.crypto=original.filter(i=>!['CLG','CHI'].includes(i.id));baseline=act(s,{type:'market_tick'});}finally{INSTRUMENTS.crypto=original;}
 assert.equal(full.rng,baseline.rng);for(const [key,quote]of Object.entries(baseline.trading.quotes))assert.deepEqual(full.trading.quotes[key],quote,key);assert.equal(full.cash,baseline.cash);assert.deepEqual(full.positions,baseline.positions);assert.ok(full.trading.quotes.CLG);assert.ok(full.trading.quotes.CHI);
});
