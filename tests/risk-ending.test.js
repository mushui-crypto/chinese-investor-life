import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,nextTurn,settleRun,resumeRun} from '../src/game/narrative.js';
import {applyEffects,applyAction,getMetrics,getEndingMetrics,PRODUCTS} from '../src/game/core.js';
import {maximumOrder} from '../src/game/order-budget.js';
import {quoteFor} from '../src/game/market-play.js';
import {hasGambled,riskEndingKind,newRiskLife} from '../src/game/risk-ending.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
import {renderOnlineGamblingLedger,onlineGamblingText} from '../src/ui/online-gambling-ledger.js';
const catalog={};for(const key of ['events','families','history','endings','characters']){const d=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(seed='risk-ending',age=55){const s=createRun({seed,familyId:'F08'},catalog);Object.assign(s,{age,turn:60,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:500000000,monthlyIncome:5000000,giftReceived:true});s.flags.gambling_exposed=true;s.stats.credit=100;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const go=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);return n;};
const save=s=>decodeSave(encodeSave(s));
const games=[['dragon_tiger','dragon'],['baccarat','banker'],['dragon_cut','cut'],['sicbo','small'],['roulette','red'],['slots','spin'],['redblack','red']];
function bet(s,game='redblack',pick='red'){if(game==='dragon_cut')s.trading.gambling.roads.baccarat=['banker','banker','banker'];return go(s,{type:'gamble',game,pick,amount:10000});}
function final(s){
 const before=structuredClone(s),n=settleRun(s,catalog);
 assert.equal(n.phase,'ended');
 for(const key of ['cash','positions','businesses','claims','debts','ledger','rng','familyReserve','trading','legal','netWorthHistory','riskLife'])assert.deepEqual(n[key],before[key],key+' must not change at settlement');
 assert.equal(getEndingMetrics(n).netWorth,getEndingMetrics(before).netWorth);
 assert.equal(n.riskLife.terminal,null);assert.deepEqual(s,before);assert.deepEqual(save(n),n);assert.equal(settleRun(n,catalog),n);
 if(n.age<80&&!n.survival.failed){const resumed=resumeRun(n,catalog);assert.equal(resumed.lastResult?.error,undefined);assert.equal(resumed.cash,n.cash);assert.equal(resumed.flags.gambling_final_loss,false);assert.equal(resumed.flags.allin_final_loss,false);}
 return n;
}
const kind=s=>riskEndingKind(s,getEndingMetrics(s));
function allInLoss(seed='actual-allin',age=55){
 let s=adult(seed,age);
 for(let i=0;i<3;i++){const r=applyEffects(s,[{op:'venture',stake_fraction:1,gross_multiple:i===2?0:1}],{profile:'allin',resolutionId:`allin-${i}`});assert.equal(r.result.error,undefined);s=r.state;}
 return s;
}
function gamblingLoss(age=55){
 for(let i=0;i<30;i++){const s=adult('actual-gambling-loss-'+i,age),n=go(s,{type:'gamble',game:'redblack',pick:'red',amount:s.cash});if(n.cash===0)return n;}
 throw Error('No losing fixture');
}

test('all seven paid games and quitting preserve actual wealth at 55 and 80',()=>{
 for(const age of [55,80])for(const [game,pick] of games)for(const quit of [false,true]){
  let s=bet(adult(`${age}-${game}-${quit}`),game,pick);if(quit)s=go(s,{type:'gamble_leave'});s.age=age;
  assert.ok(getEndingMetrics(s).netWorth>0);const n=final(s);assert.notEqual(n.ending.id,'E31');assert.ok(n.matchedEndings.every(e=>!['E31','E32'].includes(e.id)));
 }
});
test('work and investment remain available after a wager; watching has no gambling history',()=>{
 const player=adult('still-playing',25);player.monthlyIncome=0;let s=bet(player);s=go(s,{type:'gig'});s=go(s,{type:'desk_order',product:'fund',instrument:'balanced',amount:100000});assert.equal(s.positions.length,1);assert.equal(s.phase,'planning');assert.ok(settleRun(s,catalog).lastResult.error.includes('55'));
 let watch=go(adult('watch-only'),{type:'gamble_observe',game:'baccarat'});assert.equal(hasGambled(watch),false);final(watch);
});
test('gambling does not erase housing collateral, locked investments, business or claims',()=>{
 let s=adult('mixed-property');s=go(s,{type:'invest',product:'housing',amount:5000000,financed:true});s=go(s,{type:'business_start',amount:500000});s.claims.push({id:'unpaid-claim',name:'旧项目回款',face:100000,value:10000,recovered:0,createdTurn:60});s=bet(s);const n=final(s);assert.ok(n.debts.some(d=>d.collateralId));assert.equal(n.claims[0].value,10000);
});
test('story participation and a platform loss do not guarantee ruin',()=>{
 const result=applyEffects(adult('story-gamble'),[{op:'legal_case',case_type:'gambling',profit_yuan:5000}]);assert.equal(result.result.error,undefined);assert.notEqual(final(result.state).ending.id,'E31');
 let s=adult('platform');s.behavior.pending='platform_invite';s=go(s,{type:'behavior_choice',scene:'platform_invite',choice:'deposit'});assert.notEqual(final(s).ending.id,'E31');
 const inspect=adult('inspect-platform');inspect.behavior.pending='platform_invite';assert.equal(kind(go(inspect,{type:'behavior_choice',scene:'platform_invite',choice:'inspect'})),null);
});
function threeAllIns(seed){let s=adult(seed);for(let i=0;i<3;i++){const price=quoteFor(s,'stock','us_compute').price,a=maximumOrder(s.cash,{product:'stock',instrument:'us_compute',price});s=go(s,{type:'desk_order',product:'stock',instrument:'us_compute',...a});s=go(s,{type:'desk_sell',id:s.positions.at(-1).id,bps:10000});}assert.equal(s.riskLife.allIns,3);return s;}
test('profitable repeated all-ins never liquidate, regardless of the old fate seed',()=>{
 const seeds=Array.from({length:100},(_,i)=>`fate-${i}`);
 for(const seed of [seeds.find(seed=>newRiskLife({seed}).fate<85),seeds.find(seed=>newRiskLife({seed}).fate>=85)]){const s=threeAllIns(seed);assert.equal(kind(s),null);assert.notEqual(final(s).ending.id,'E32');}
});
test('actual all-in losses produce a reversible epilogue, then recovery clears the branch',()=>{
 const s=allInLoss();assert.equal(s.riskLife.allIns,3);assert.ok(s.riskLife.lastAllInCapital>0);assert.equal(kind(s),'allin');const end=final(s);assert.equal(end.ending.id,'E32');
 let recovered=resumeRun(end,catalog);const r=applyEffects(recovered,[{op:'earn',amount_yuan:100000}]);assert.equal(r.result.error,undefined);recovered=r.state;assert.equal(kind(recovered),null);assert.notEqual(final(recovered).ending.id,'E32');
});
test('gambling ruin describes real losses, without inventing another bet or deducting bills twice',()=>{
 const s=gamblingLoss(),end=final(s);assert.equal(kind(s),'gambling');assert.equal(end.ending.id,'E31');assert.ok(getEndingMetrics(end).pendingLegalBills>0);
 const recovered=applyEffects(resumeRun(end,catalog),[{op:'earn',amount_yuan:100000}]).state;assert.equal(kind(recovered),null);assert.notEqual(final(recovered).ending.id,'E31');
});
test('E31 uses recorded gambling totals and remaining wealth in both ending displays',()=>{
 const s=applyEffects(gamblingLoss(),[{op:'earn',amount_yuan:12.34}]).state;
 const before=structuredClone(s),authored=structuredClone(catalog.endings),g=s.behavior.onlineGambling,m=getEndingMetrics(s);
 assert.ok(m.assets>0);assert.ok(m.debt>m.assets);const end=final(s);
 const yuan=amount=>`¥${(amount/100).toFixed(2)}`;
 const expected=`账目里，累计现金下注 ${yuan(g.staked)}，累计返还（含本金）${yuan(g.returned)}。结算时，资产 ${yuan(m.assets)}，负债 ${yuan(m.debt)}。你曾经有 ${g.exitOpportunities} 次离场机会，记录中实际离场 ${g.quitCount} 次。`;
 assert.equal(end.ending.id,'E31');assert.equal(end.ending.epilogue,expected);assert.equal(end.lastResult.text,expected);
 assert.equal(end.matchedEndings.find(e=>e.id==='E31').epilogue,expected);
 assert.ok(renderOnlineGamblingLedger(end,{money:yuan},true).includes(`<dt>最终负债</dt><dd>${yuan(m.debt)}</dd>`));
 assert.ok(onlineGamblingText(end,yuan).includes(`最终负债：${yuan(m.debt)}`));
 assert.doesNotMatch(expected,/停下过的手|家当|余额停在零|再.*下注/);
 assert.deepEqual(end.behavior.onlineGambling,before.behavior.onlineGambling);assert.deepEqual(catalog.endings,authored);
 assert.deepEqual(end.runStats.settlements.at(-1).matchedIds,end.matchedEndings.map(e=>e.id));
});
test('unrelated later debt is not attributed to a small bet; sustained recovery changes the epilogue',()=>{
 const s=bet(adult('small-bet'));s.cash=0;assert.equal(kind(s),null);
 for(const state of [gamblingLoss(),allInLoss()]){state.behavior.stopped=true;state.behavior.cleanDays=30;assert.equal(kind(state),null);final(state);}
 const old=allInLoss();old.turn+=5;assert.equal(kind(old),null);
});
test('rejected and diversified purchases do not count as staking the whole estate',()=>{
 let s=adult();assert.ok(applyAction(s,{type:'invest',product:'stock',amount:s.cash+1}).result.error);assert.equal(s.riskLife.allIns,0);
 s=go(s,{type:'desk_order',product:'fund',instrument:'balanced',amount:450000000});s.trading.energy=6;
 for(let i=0;i<3;i++){const a=maximumOrder(s.cash,{product:'stock',instrument:'us_compute',price:quoteFor(s,'stock','us_compute').price});s=go(s,{type:'desk_order',product:'stock',instrument:'us_compute',...a});s=go(s,{type:'desk_sell',id:s.positions.at(-1).id,bps:10000});}
 assert.equal(s.riskLife.allIns,0);assert.equal(kind(s),null);final(s);
});
test('old running saves never acquire invented all-in history or a drawdown baseline',()=>{
 const s=bet(adult('old-playing'));delete s.riskLife;const n=save(s);assert.equal(n.riskLife.allIns,0);assert.equal(n.riskLife.lastAllInCapital,null);assert.equal(n.cash,s.cash);assert.equal(n.rng,s.rng);assert.notEqual(final(n).ending.id,'E31');
 const old=allInLoss();delete old.riskLife.lastAllInCapital;const restored=save(old);assert.equal(restored.riskLife.lastAllInCapital,null);assert.equal(kind(restored),null);final(restored);
});
test('completed legacy loss records still load unchanged and cannot lose money twice',()=>{
 let s=bet(adult('legacy-ended'));const cash=s.cash,start=s.ledger.length;s=applyEffects(s,[{op:'spend',amount_yuan:cash/100}]).state;
 const rows=s.ledger.slice(start);for(const row of rows)row.label='尾声清算：失去的存款';
 s.riskLife.terminal={kind:'gambling',age:s.age,turn:s.turn,cash,holdings:0,business:0,claims:0,inventory:0,total:cash,debt:0,ledgerIds:rows.map(e=>e.id)};
 s.flags.gambling_final_loss=true;s=settleRun(s,catalog);assert.equal(s.ending.id,'E31');assert.deepEqual(save(s),s);assert.equal(settleRun(s,catalog),s);assert.ok(resumeRun(s,catalog).lastResult.error);
 for(const change of [x=>x.cash=1,x=>x.riskLife.terminal.total++,x=>x.riskLife.terminal.debt++,x=>x.riskLife.terminal.ledgerIds=['missing'],x=>x.flags.gambling_final_loss=false,x=>x.riskLife.fate=(x.riskLife.fate+1)%100,x=>x.phase='planning']){const bad=structuredClone(s);change(bad);assert.throws(()=>encodeSave(bad));}
});
test('story all-in commitments are counted only once',()=>{
 let s=adult('story-risk');const r=applyEffects(s,[{op:'venture',stake_fraction:1,gross_multiple:1}],{profile:'allin',resolutionId:'story-once'});assert.equal(r.result.error,undefined);s=r.state;assert.equal(s.riskLife.allIns,1);assert.equal(s.riskLife.lastAllInCapital,500000000);
 assert.deepEqual(applyEffects(s,[{op:'venture',stake_fraction:1,gross_multiple:1}],{profile:'allin',resolutionId:'story-once'}).state,s);
});
test('seven unpaid days end as survival failure even after gambling or repeated all-ins',()=>{
 for(let s of [gamblingLoss(25),allInLoss('young-allin',25)]){s.monthlyIncome=0;for(let i=0;i<7;i++){s=nextTurn(s,catalog);assert.equal(s.lastResult?.error,undefined);}assert.equal(s.survival.failed,true);assert.equal(s.ending.id,'E29');assert.equal(s.riskLife.terminal,null);assert.ok(s.debts.some(d=>d.name==='基本生活费欠款'));assert.deepEqual(save(s),s);assert.equal(settleRun(s,catalog),s);assert.ok(resumeRun(s,catalog).lastResult.error);}
});
test('margin and follow-on track actual committed capital; rejected operations do not count',()=>{
 for(const [product,instrument,operation] of [['futures','INDEX_A','margin'],['angel','robot','follow']]){
  let s=adult('commit-'+product);s=go(s,{type:'desk_order',product,instrument,amount:1000000,leverage:2,direction:'long'});const id=s.positions[0].id;
  const refused=act(s,{type:'desk_manage',operation,id,amount:s.cash+1},catalog);assert.ok(refused.lastResult.error);assert.equal(refused.riskLife.allIns,0);
  const cash=s.cash;s=go(s,{type:'desk_manage',operation,id,amount:cash});assert.equal(s.cash,0);assert.equal(s.riskLife.allIns,1);assert.ok(s.riskLife.lastAllInCapital>=cash);assert.deepEqual(save(s),s);
 }
});
