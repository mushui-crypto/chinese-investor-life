import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun,continueStory,chooseEvent,getEventCandidates,eligibleChoices,nextTurn,settleRun,resumeRun} from '../src/game/narrative.js';
import {applyEffects,applyAction,getMetrics,getEndingMetrics,PRODUCTS,rngNext} from '../src/game/core.js';
import {ensureCryptoLife,cryptoLifeState,advanceCryptoLife,cryptoEventAllowed,recordCryptoLifeEvent} from '../src/game/crypto-life.js';
import {onlineEventAllowed} from '../src/game/online-gambling.js';
import {cryptoStoryPresentation} from '../src/game/crypto-life-stories.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};
for(const id of ['INT_LIFE_A','INT_LIFE_B']){const e=structuredClone(catalog.events.find(e=>e.id==='CL01'));delete e.cryptoLife;Object.assign(e,{id,title:'普通生活',prompt:'今天把普通日子过完。',category:'关系与人生',choices:[{id:id+'_1',label:'继续生活',profile:'observe',requirements:{all:[]},outcomes:[{id:id+'_outcome',weight:1,text:'普通的一天。',effects:[],schedule:[]}]}]});catalog.events.push(e);}
setSaveCatalog(catalog);
const event=id=>catalog.events.find(e=>e.id===id);
const save=s=>decodeSave(encodeSave(s));
function adult(age=25){const s=createRun({seed:'crypto-life-integrate',familyId:'F08'},catalog);Object.assign(s,{age,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000,monthlyIncome:0,giftReceived:true});s.flags.crypto_aware=true;s.flags.ponzi_exposed=true;s.marketProgress={firstExperienceAge:18,simulations:0,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};ensureCryptoLife(s);return s;}
function show(s,id){if(s.phase==='result')s=continueStory(s,catalog);const n=structuredClone(s);n.phase='planning';n.activeEvent=null;n.eventQueue=[id];const out=continueStory(n,catalog);assert.equal(out.activeEvent?.eventId,id,`activation ${id}: ${out.lastResult?.error||out.phase}`);return out;}
function pick(s,id,action){const c=eligibleChoices(s,event(id)).find(c=>(c.cryptoAction||c.onlineAction)===action)||eligibleChoices(s,event(id)).find(c=>c.id===action);assert.ok(c,action);assert.equal(c.disabled,false,c.reason);const n=chooseEvent(s,id,c.id,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);return n;}
function gap(s,days=90){const n=structuredClone(s);n.debtClock.day+=days;n.age+=days/360;n.turn++;return n;}
function ordinary(s){for(const id of ['INT_LIFE_A','INT_LIFE_B']){s.seenEvents=s.seenEvents.filter(x=>x!==id);s=pick(show(s,id),id,id+'_1');}return continueStory(s,catalog);}
function effect(s,e,id){const r=applyEffects(s,[{op:'crypto_life',...e}],id?{resolutionId:id}:{});assert.equal(r.result.error,undefined,r.result.error);return r.state;}

test('an actual exposure and buy resume ordinary life without fixed schedules or duplicated money',()=>{
 let s=show(adult(),'CL01');const money=s.cash,rng=s.rng,locked=structuredClone(s.activeEvent);const restored=save(s);assert.deepEqual(restored.activeEvent,locked);assert.equal(restored.rng,rng);s=pick(restored,'CL01','curious');assert.equal(s.cash,money);assert.equal(s.positions.length,0);assert.equal(s.behavior.onlineGambling.ordinaryEvents,0);assert.equal(s.pending.filter(p=>p.sourceEventId==='CL01').length,0);s=continueStory(s,catalog);assert.equal(s.phase,'planning');assert.equal(getEventCandidates(s,catalog).some(e=>e.id==='CL02'),false);
 s=ordinary(gap(s));s=show(s,'CL02');const before=s.cash,instance=s.activeEvent.instanceId;s=pick(save(s),'CL02','buy');assert.equal(s.cash,before-10000);assert.equal(cryptoLifeState(s).invested,10000);assert.equal(s.positions.length,1);assert.ok(s.appliedEffectIds.includes(instance));assert.equal(cryptoLifeState(s).memories.firstCryptoBuy.choice,'买 100 元试试。');assert.equal(s.behavior.onlineGambling.ordinaryEvents,2);
 const again=chooseEvent(save(s),'CL02','CL02_1',catalog);assert.ok(again.lastResult.error);assert.equal(again.cash,s.cash);assert.equal(again.positions.length,1);assert.equal(cryptoLifeState(again).totalTrades,1);
});
test('Crypto and online gambling never count as one another\'s ordinary life gap',()=>{
 let s=pick(show(adult(),'CL01'),'CL01','curious');s=continueStory(s,catalog);s=gap(s);assert.equal(onlineEventAllowed(s,event('OG01')),false);s=ordinary(s);assert.equal(onlineEventAllowed(s,event('OG01')),true);s=pick(show(s,'OG01'),'OG01','curious');assert.equal(s.behavior.onlineGambling.ordinaryEvents,2);s=continueStory(s,catalog);s=gap(s);assert.equal(cryptoEventAllowed(s,event('CL02')),false);s=ordinary(s);assert.equal(cryptoEventAllowed(s,event('CL02')),true);
});
test('a real household Crypto disclosure cannot count itself toward either risk story ordinary gap',()=>{
 let s=effect(adult(),{action:'buy',branch:'spot',amount:10000});s.household.partner=true;s.flags.partner=true;s.flags.shared_household=true;s=show(s,'REL02');
 const c=eligibleChoices(s,event('REL02')).find(c=>c.cryptoAction==='disclose');assert.ok(c);assert.equal(c.disabled,false);assert.equal(c.outcomes[0].cryptoResolution.active,false);
 const count=s.behavior.onlineGambling.ordinaryEvents,cash=s.cash;s=pick(s,'REL02','disclose');assert.equal(s.cash,cash);assert.equal(s.behavior.onlineGambling.ordinaryEvents,count);assert.equal(cryptoLifeState(s).ordinaryAtLastEvent,count);assert.equal(cryptoLifeState(s).eventCounts.REL02,1);s=gap(continueStory(save(s),catalog));
 const check=allowed=>{assert.equal(cryptoEventAllowed(s,event('CL08')),allowed);assert.equal(onlineEventAllowed(s,event('OG01')),allowed);};check(false);
 s=continueStory(pick(show(s,'INT_LIFE_A'),'INT_LIFE_A','INT_LIFE_A_1'),catalog);assert.equal(s.behavior.onlineGambling.ordinaryEvents,count+1);check(false);
 s=continueStory(pick(show(s,'INT_LIFE_B'),'INT_LIFE_B','INT_LIFE_B_1'),catalog);assert.equal(s.behavior.onlineGambling.ordinaryEvents,count+2);check(true);
});
test('repeatable Crypto instances keep locked outcomes across save and replay only after both gates',()=>{
 let s=effect(adult(),{action:'buy',branch:'spot',amount:10000});const p=s.positions[0];p.value=15000;s.ledger.push({id:'integration-mark',turn:s.turn,age:s.age,account:'position',amount:5000,label:'实际测试报价盯市'});advanceCryptoLife(s);s=show(s,'CL03');const first=s.activeEvent.instanceId,before=structuredClone(s),loaded=save(s);assert.deepEqual(loaded.activeEvent,before.activeEvent);assert.equal(loaded.rng,before.rng);s=pick(loaded,'CL03','hold');assert.equal(s.cash,before.cash);assert.equal(cryptoLifeState(s).eventCounts.CL03,1);assert.equal(s.behavior.onlineGambling.ordinaryEvents,0);s=ordinary(gap(continueStory(s,catalog),239));assert.equal(cryptoEventAllowed(s,event('CL03')),false);s=gap(s,1);s=show(s,'CL03');assert.notEqual(s.activeEvent.instanceId,first);assert.deepEqual(save(s).activeEvent,s.activeEvent);s=pick(s,'CL03','hold');assert.equal(cryptoLifeState(s).eventCounts.CL03,2);assert.equal(s.cash,before.cash);
});
test('an unresolved Crypto story blocks fast-forward without touching age, money, or locked outcomes',()=>{
 const s=show(adult(),'CL01'),before=structuredClone(s),n=nextTurn(s,catalog);assert.ok(n.lastResult.error);assert.equal(n.age,before.age);assert.equal(n.debtClock.day,before.debtClock.day);assert.equal(n.cash,before.cash);assert.deepEqual(n.activeEvent,before.activeEvent);assert.deepEqual(s,before);
});
test('a normal life epilogue observes real Crypto receipts without liquidating holdings or rerolling',()=>{
 let s=effect(adult(55),{action:'buy',branch:'spot',amount:10000});const before=structuredClone(s),n=settleRun(s,catalog);assert.equal(n.phase,'ended');for(const key of ['cash','positions','debts','claims','ledger','rng','trading','behavior'])assert.deepEqual(n[key],before[key],key);assert.equal(getEndingMetrics(n).netWorth,getEndingMetrics(before).netWorth);assert.deepEqual(save(n),n);assert.deepEqual(s,before);
});
test('save migration imports only actual old participation and preserves active locked stories',()=>{
 let s=effect(adult(),{action:'buy',branch:'spot',amount:10000});delete s.behavior.cryptoLife;const before=structuredClone(s),n=save(s);assert.equal(cryptoLifeState(n).legacyImported,true);assert.equal(cryptoLifeState(n).memories.firstCryptoBuy,null);assert.equal(cryptoLifeState(n).invested,0);for(const k of ['cash','positions','ledger','rng'])assert.deepEqual(n[k],before[k]);assert.equal(getMetrics(n).netWorth,getMetrics(before).netWorth);
});
test('ordinary-life partial asset sales enter Crypto returns and cost-basis receipts once',()=>{
 let s=effect(adult(),{action:'buy',branch:'spot',amount:100000}),before=s.cash;const r=applyEffects(s,[{op:'liquidate_asset',fraction:.5,haircut_bps:1000}],{eventId:'INT_LIFE_A'});assert.equal(r.result.error,undefined);s=r.state;assert.equal(s.cash-before,45000);assert.equal(s.positions[0].cost,50000);assert.equal(cryptoLifeState(s).returned,45000);assert.equal(cryptoLifeState(s).realizedProfit,-5000);assert.equal(cryptoLifeState(s).totalTrades,2);assert.deepEqual(save(s),s);
});
test('partial generic project sale reduces every contribution before later real payment',()=>{
 let s=effect(adult(),{action:'scheme_join',amount:100000});s=effect(s,{action:'scheme_add',amount:100000});const before=s.cash,r=applyEffects(s,[{op:'liquidate_asset',fraction:.5,haircut_bps:0}]);assert.equal(r.result.error,undefined);s=r.state;assert.equal(s.cash-before,100000);assert.equal(s.positions[0].cost,100000);const paidBefore=s.cash;s.debtClock.day+=30;s=applyEffects(s,[]).state;assert.equal(s.cash-paidBefore,2500);assert.equal(cryptoLifeState(s).branches.scheme.returned,102500);assert.deepEqual(save(s),s);
});
test('material mixed Crypto losses reach the actual early bankruptcy ending without another debit',()=>{
 let s=adult();s.stats.trust=90;s=effect(s,{action:'borrow',amount:100000});s=effect(s,{action:'buy',branch:'alt',amount:400000});s=effect(s,{action:'scheme_join',amount:300000});s=effect(s,{action:'open_leverage',tier:'high',amount:400000});recordCryptoLifeEvent(s,{eventId:'CL17',choice:'再放一点进去',action:'chase',branch:'leverage'});
 const loss=applyEffects(s,[{op:'liquidate_asset',fraction:1,haircut_bps:10000}]);assert.equal(loss.result.error,undefined);s=loss.state;assert.equal(s.cash,0);assert.equal(s.positions.length,0);const before=structuredClone(s),n=settleRun(s,catalog);assert.equal(n.phase,'ended');assert.equal(n.ending.id,'E34');assert.equal(n.flags.crypto_final_loss,true);for(const key of ['cash','positions','debts','claims','ledger','rng','trading','behavior'])assert.deepEqual(n[key],before[key],key);assert.deepEqual(save(n),n);assert.match(resumeRun(n,catalog).lastResult.error,/破产/);assert.deepEqual(s,before);
});
test('a real project warning can be exited immediately without first acknowledging it',()=>{
 let s=effect(adult(),{action:'scheme_join',amount:100000});s.debtClock.day+=30;s=applyEffects(s,[]).state;const q=s.positions[0].cryptoScheme;q.status='warning';q.warningDay=s.debtClock.day;q.warningSeen=false;const before=s.cash;s=effect(s,{action:'scheme_withdraw'});assert.equal(s.cash-before,100000);assert.ok(cryptoLifeState(s).memories.firstSchemeWarning);assert.equal(cryptoLifeState(s).schemeExitedAfterWarning,true);assert.equal(s.trading.cryptoSchemeFollowups.length,1);assert.deepEqual(save(s),s);
});
test('selling ordinary assets leaves a frozen zero-value Crypto project and its principal intact',()=>{
 let s=effect(adult(),{action:'scheme_join',amount:100000});s=effect(s,{action:'buy',branch:'spot',amount:100000});const p=s.positions.find(p=>p.kind==='ponzi');p.frozen=true;p.value=0;p.cryptoScheme.status='frozen';p.cryptoScheme.warningDay=s.debtClock.day;p.cryptoScheme.warningSeen=true;s.ledger.push({id:'frozen-mark',turn:s.turn,age:s.age,account:'position',amount:-100000,label:'实际冻结估值'});const before=s.cash,r=applyEffects(s,[{op:'liquidate_asset',fraction:1,haircut_bps:0}]);assert.equal(r.result.error,undefined);s=r.state;assert.equal(s.cash-before,100000);assert.equal(s.positions.length,1);assert.equal(s.positions[0].id,p.id);assert.equal(s.positions[0].cost,100000);assert.equal(s.positions[0].value,0);assert.equal(cryptoLifeState(s).branches.scheme.returned,0);assert.notEqual(cryptoLifeState(s).status,'CRYPTO_EXITED');assert.deepEqual(save(s),s);
});
test('an early Crypto bankruptcy save needs matching financial history, not a forged ending flag',()=>{
 const s=adult();s.phase='ended';s.ending=structuredClone(catalog.endings.find(e=>e.id==='E34'));s.matchedEndings=[s.ending];s.flags.crypto_final_loss=true;s.lastResult={title:s.ending.title,text:s.ending.epilogue};assert.throws(()=>encodeSave(s),/Crypto破产结局/);
});
test('choosing to cash out the last profitable spot records an actual quit and walk-away ending',()=>{
 let s=effect(adult(),{action:'buy',branch:'spot',amount:10000});const p=s.positions[0];p.value=15000;s.ledger.push({id:'cashout-mark',turn:s.turn,age:s.age,account:'position',amount:5000,label:'实际测试报价盯市'});advanceCryptoLife(s);s=pick(show(s,'CL03'),'CL03','sell');assert.equal(s.positions.length,0);assert.equal(cryptoLifeState(s).status,'QUIT');assert.equal(cryptoLifeState(s).quitCount,1);assert.equal(cryptoLifeState(s).memories.cryptoQuit.choice,'卖掉这部分现货。');assert.deepEqual(save(s),s);
});
function actualLiquidationAndChase(){
 let s=adult();s.stats.trust=90;s=effect(s,{action:'open_leverage',tier:'extreme',amount:10000});
 let r=applyAction(s,{type:'market_tick'});assert.equal(r.result.error,undefined);s=r.state;assert.equal(cryptoLifeState(s).liquidations,1);
 s=show(s,'CL17');assert.equal(eligibleChoices(s,event('CL17')).some(c=>c.cryptoAction==='borrow'),false);
 s=pick(s,'CL17','leverage_open');assert.ok(cryptoLifeState(s).tendencies.chasing>0);s=continueStory(s,catalog);
 for(let i=0;i<2;i++){r=applyAction(s,{type:'market_tick'});assert.equal(r.result.error,undefined);s=r.state;}
 return ordinary(gap(s,360));
}
test('a later liquidation story can lend 100 after a real chosen chase without opening a position',()=>{
 let s=show(actualLiquidationAndChase(),'CL17'),choice=eligibleChoices(s,event('CL17')).find(c=>c.cryptoAction==='borrow');assert.ok(choice);assert.equal(choice.disabled,false);assert.match(choice.planHint,/借入 ¥100/);assert.match(choice.planHint,/8%/);assert.match(choice.planHint,/不自动加仓/);
 const before=structuredClone(s),worth=getMetrics(s).netWorth,invested=cryptoLifeState(s).invested,returned=cryptoLifeState(s).returned;s=pick(s,'CL17','borrow');
 assert.equal(s.cash,before.cash+10000);assert.equal(getMetrics(s).netWorth,worth);assert.deepEqual(s.positions,before.positions);assert.equal(cryptoLifeState(s).borrowed,10000);assert.equal(cryptoLifeState(s).invested,invested);assert.equal(cryptoLifeState(s).returned,returned);
 const debt=s.debts.find(d=>d.purpose==='crypto');assert.ok(debt);assert.equal(debt.kind,'friend');assert.equal(debt.principal,10000);assert.equal(debt.aprBps,800);assert.equal(debt.monthsLeft,12);assert.deepEqual(save(s),s);
 s=continueStory(s,catalog);assert.equal(eligibleChoices(s,event('CL17')).some(c=>c.cryptoAction==='borrow'),false);
 const cash=s.cash,debts=structuredClone(s.debts);s=effect(s,{action:'buy',branch:'spot',amount:10000});assert.equal(s.cash,cash-10000);assert.equal(s.positions.length,1);assert.deepEqual(s.debts,debts);assert.equal(cryptoLifeState(s).borrowed,10000);assert.deepEqual(save(s),s);
});
test('the loan option enforces friend eligibility and borrowed cash can instead be repaid',()=>{
 let s=show(actualLiquidationAndChase(),'CL17'),bad=structuredClone(s);bad.stats.trust=49;let c=eligibleChoices(bad,event('CL17')).find(c=>c.cryptoAction==='borrow');assert.equal(c.disabled,true);assert.match(c.reason,/人缘/);assert.ok(eligibleChoices(bad,event('CL17')).some(c=>c.cryptoAction==='quit'&&!c.disabled));
 bad=structuredClone(s);bad.debts.push({id:'overdue-proof',kind:'friend',principal:100,interest:0,overdue:true});c=eligibleChoices(bad,event('CL17')).find(c=>c.cryptoAction==='borrow');assert.equal(c.disabled,true);assert.match(c.reason,/逾期/);
 s=pick(s,'CL17','borrow');const before=s.cash,positions=structuredClone(s.positions);s=effect(s,{action:'repay',amount:10000});assert.equal(s.cash,before-10000);assert.equal(s.debts.filter(d=>d.purpose==='crypto').length,0);assert.deepEqual(s.positions,positions);assert.equal(cryptoLifeState(s).borrowed,10000);assert.deepEqual(save(s),s);
});

function markCrypto(s,id,value){const p=s.positions.find(p=>p.id===id),delta=value-p.value;p.value=value;s.ledger.push({id:`crypto-audit-mark-${s.ledger.length}`,turn:s.turn,age:s.age,account:'position',amount:delta,label:'测试真实持仓估值'});advanceCryptoLife(s);return s;}
test('the actual double-and-continue choice remembers paper wealth without inventing realized income',()=>{
 let s=effect(adult(),{action:'buy',branch:'spot',amount:10000});markCrypto(s,s.positions[0].id,20000);const cash=s.cash;s=pick(show(s,'CL04'),'CL04','ambition');
 assert.equal(s.cash,cash);assert.equal(cryptoLifeState(s).tendencies.bigWinMemory,10);assert.equal(cryptoLifeState(s).realizedProfit,0);assert.equal(cryptoLifeState(s).memories.firstCryptoWin,null);assert.match(cryptoStoryPresentation(s,event('CL33')).prompt,/账面数字/);assert.deepEqual(save(s),s);
});
test('selling the real ten-percent remainder awards principal protection after the position is removed',()=>{
 let s=effect(adult(),{action:'buy',branch:'alt',amount:100000});markCrypto(s,s.positions[0].id,10000);const cash=s.cash;s=pick(show(s,'CL12'),'CL12','sell');
 assert.equal(s.positions.length,0);assert.equal(s.cash-cash,9980);assert.ok(cryptoLifeState(s).achievements.principal_protection);assert.equal(cryptoLifeState(s).branches.alt.realizedProfit,-90020);assert.deepEqual(save(s),s);
});
test('the wage comparison displays the same qualifying settled receipt that makes its choice available',()=>{
 let s=effect(adult(),{action:'open_leverage',amount:10000,tier:'low'});markCrypto(s,s.positions[0].id,100000);s=effect(s,{action:'sell',branch:'leverage'});s=effect(s,{action:'open_leverage',amount:10000,tier:'low'});markCrypto(s,s.positions[0].id,10021);s=effect(s,{action:'sell',branch:'leverage'});s.monthlyIncome=600000;
 assert.equal(cryptoLifeState(s).history.findLast(h=>h.kind==='trade').pnl,1);s=show(s,'CL21');const prose=cryptoStoryPresentation(s,event('CL21'));assert.match(prose.prompt,/盈利 ¥898/);assert.match(prose.prompt,/4.5 天工资/);assert.doesNotMatch(prose.prompt,/盈利 ¥0\.01|最近一笔/);const cash=s.cash;s=pick(s,'CL21','refuse');assert.equal(s.cash,cash);assert.deepEqual(save(s),s);
});
test('real scheme claim recoveries repair Crypto totals once without creating another trade or relapse',()=>{
 let s=effect(adult(),{action:'scheme_join',amount:100000});s.debtClock.day+=180;s=applyEffects(s,[]).state;const q=s.positions[0].cryptoScheme;q.status='warning';q.warningDay=s.debtClock.day;s=effect(s,{action:'scheme_ack'});
 const low=()=>{while(rngNext(s.rng).value>=.3)s.rng=rngNext(s.rng).seed;};low();s.debtClock.day+=30;s=applyEffects(s,[]).state;assert.equal(s.positions[0].cryptoScheme.status,'frozen');s=effect(s,{action:'scheme_ack'});low();s.debtClock.day+=30;s=applyEffects(s,[]).state;assert.equal(s.positions.length,0);assert.equal(s.claims[0].cryptoLifeBranch,'scheme');
 const before=structuredClone(s),r=applyEffects(s,[{op:'recover_claim',recovery_bps:3000}],{resolutionId:'crypto:claim:first'});assert.equal(r.result.error,undefined);s=r.state;const g=cryptoLifeState(s),prior=cryptoLifeState(before);assert.equal(s.cash-before.cash,30000);assert.equal(g.returned-prior.returned,30000);assert.equal(g.realizedProfit-prior.realizedProfit,30000);assert.equal(g.totalTrades,prior.totalTrades);assert.equal(g.branches.scheme.sells,prior.branches.scheme.sells);assert.equal(g.lastBehaviorDay,prior.lastBehaviorDay);assert.equal(g.relapseCount,prior.relapseCount);assert.deepEqual(save(s),s);
 const repeated=applyEffects(s,[{op:'recover_claim',recovery_bps:3000}],{resolutionId:'crypto:claim:first'});assert.equal(repeated.result.alreadyApplied,true);assert.deepEqual(repeated.state,s);
 const final=applyEffects(s,[{op:'recover_claim',recovery_bps:10000}]);assert.equal(final.result.error,undefined);s=final.state;assert.equal(s.claims.length,0);assert.equal(cryptoLifeState(s).realizedProfit,15000);assert.ok(cryptoLifeState(s).memories.firstRecovery);assert.deepEqual(save(s),s);
});
