import {TEEN_STORY_STEPS} from '../src/game/teen-stories.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,chooseEvent,eligibleChoices} from '../src/game/narrative.js';
import {createPlayableRun} from '../src/game/quick-start.js';
import {continueChildhood} from '../src/game/childhood.js';
import {newChildhood} from '../src/game/childhood-state.js';
import {continuation} from '../src/game/continuation.js';
import {applyAction,getMetrics,getActionAvailability,getSurvivalStatus,PRODUCTS,advanceTurn} from '../src/game/core.js';
import {instruments,quoteFor} from '../src/game/market-play.js';
import {STOCKS,stockLot} from '../src/game/stock-markets.js';
import {maximumOrder,cashBudget,orderCost} from '../src/game/order-budget.js';
import {renderCashBudget,renderSpendingWarning} from '../src/ui/cash-budget.js';
import {actionQuip} from '../src/ui/action-motion.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
function adult({cash=2000000,wage=0}={}){const s=createRun({seed:'budget',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:wage,giftReceived:true});s.stats.insight=90;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
function step(s,a){const o=applyAction(s,a);assert.equal(o.result.error,undefined,o.result.error);return o.state;}
const save=s=>decodeSave(encodeSave(s));
const choose=s=>{const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),c=eligibleChoices(s,e).find(c=>!c.disabled);return chooseEvent(s,e.id,c.id,catalog);};
function teen(){let s=createRun({seed:'young-v112',familyId:'F01'},catalog);Object.assign(s,{age:12,turn:6,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000});s.childhood=newChildhood(s);return s;}
const money=n=>'¥'+(n/100).toFixed(2);

test('budget is advisory, exact, floored, and subtracts already billed days without mutating money',()=>{
 let s=adult({cash:10000});const m=getMetrics(s),before=structuredClone(s),b=cashBudget(s,m,10000);assert.equal(b.spare,0);assert.equal(b.shortage,m.livingReserve-10000);assert.equal(b.after,0);assert.deepEqual(s,before);
 s=step(s,{type:'calendar_day'});const n=getMetrics(s);assert.equal(n.livingReserve,m.livingReserve-s.survival.livingAccrued);assert.equal(s.cash,10000-s.survival.last.paid);
 const html=renderCashBudget(s,{money},s.cash);for(const label of ['当前现金','本期剩余生活费','留足生活费后剩余','生活费还差','仍可买入','去打工'])assert.ok(html.includes(label));assert.ok(!html.includes('disabled'));assert.ok(renderSpendingWarning(s,s.cash+1,{money}).includes('实际现金不足'));
});
test('spare-covered and living-money orders both execute; only actual insufficient cash fails atomically',()=>{
 const s=adult();for(const amount of [100000,1500000,s.cash]){const a={type:'desk_order',product:'fund',instrument:'balanced',amount};assert.ok(getActionAvailability(s,a).allowed);const next=step(s,a);assert.equal(next.cash,s.cash-amount);assert.equal(next.positions[0].cost,amount);assert.equal(getMetrics(next).netWorth,getMetrics(s).netWorth);}
 const a={type:'desk_order',product:'fund',instrument:'balanced',amount:s.cash+1},r=applyAction(s,a);assert.match(r.result.error,/现金不足/);assert.equal(r.state,s);
 const locked=adult();locked.marketProgress.unlocked={};locked.stats.insight=0;assert.ok(applyAction(locked,{type:'desk_order',product:'option',instrument:instruments('option')[0].id,amount:100000}).result.error);
});
test('all-in rounds down for every A HK US company and cannot afford another lot or share',()=>{
 for(const i of STOCKS){const s=adult({cash:2378491}),price=quoteFor(s,'stock',i.id).price,max=maximumOrder(s.cash,{product:'stock',instrument:i.id,price}),lot=stockLot(i.id);assert.equal(max.shares%lot,0);assert.equal(max.fee,0);assert.ok(max.total<=s.cash);assert.ok(max.total+lot*price>s.cash);
 const a={type:'desk_order',product:'stock',instrument:i.id,amount:max.amount,shares:max.shares},n=step(s,a);assert.equal(n.cash,s.cash-max.total);assert.equal(n.positions[0].shares,max.shares);assert.deepEqual(save(n),n);
 assert.ok(applyAction(s,{...a,shares:max.shares+lot,amount:max.amount+lot*price}).result.error);
 const tiny=maximumOrder(price*lot-1,{product:'stock',instrument:i.id,price});assert.equal(tiny.shares,0);assert.ok(applyAction(s,{...a,shares:0,amount:0}).result.error);
 }
});
test('all-in supports each cash-denominated product with existing minimum, leverage and exit fee rules',()=>{
 for(const product of Object.keys(PRODUCTS).filter(k=>k!=='stock')){const s=adult({cash:100000001}),max=maximumOrder(s.cash,{product}),a={type:'desk_order',product,instrument:instruments(product)[0].id,amount:max.amount,direction:'long',leverage:product==='crypto_perp'?100:2,strikeRatio:1,duration:1};const n=step(s,a);assert.equal(n.cash,0,product);assert.equal(orderCost(a).total,s.cash);assert.ok(applyAction(s,{...a,amount:PRODUCTS[product].min-1}).result.error);}
 const s=adult(),i='us_compute',price=quoteFor(s,'stock',i).price,m=maximumOrder(s.cash,{product:'stock',instrument:i,price});let n=step(s,{type:'desk_order',product:'stock',instrument:i,amount:m.amount,shares:m.shares});const cash=n.cash,p=n.positions[0];n=step(n,{type:'desk_sell',id:p.id,bps:10000});assert.equal(n.cash,cash+p.value-Math.round(p.value*.002));
});
test('all-in to a locked legacy fund retains holdings and loans; unpaid bills trigger the seven-day ending',()=>{
 let s=adult({cash:100000,wage:400000}),originalDebt;s=step(s,{type:'borrow',kind:'net',amount:100000});s.monthlyIncome=0;originalDebt=structuredClone(s.debts);s=step(s,{type:'invest',product:'fund',amount:s.cash});const held=structuredClone(s.positions);assert.equal(s.cash,0);assert.ok(getSurvivalStatus(s).active);assert.deepEqual(s.debts,originalDebt);
 for(let i=0;i<7;i++){s=act(s,{type:'survival_day'},catalog);assert.equal(s.lastResult?.error,undefined);assert.equal(s.cash,0);assert.deepEqual(s.positions.map(p=>[p.id,p.cost,p.quantity]),held.map(p=>[p.id,p.cost,p.quantity]));assert.equal(s.survival.unpaidDays,i+1);assert.ok(getMetrics(s).debt>originalDebt.reduce((n,d)=>n+d.principal,0));}
 assert.ok(s.survival.failed);assert.equal(s.phase,'ended');assert.ok(s.survival.livingAccrued>0);
});
test('work and gigs pay immediately; seeking a job pays with time and living is never waived',()=>{
 const s=adult({cash:0});for(const type of ['work','gig'])assert.ok(step(s,{type}).cash>0);
 let employed=step(s,{type:'seek_job'});assert.equal(employed.cash,0);assert.ok(employed.monthlyIncome>0);employed=step(employed,{type:'calendar_day'});assert.equal(employed.survival.salaryPaid,0);assert.ok(employed.payroll.pending[0].net>0);assert.ok(employed.survival.livingAccrued>0);assert.equal(employed.cash,Math.max(0,employed.survival.salaryPaid-employed.survival.livingAccrued));
});
test('all families reach 18 through key school stages',()=>{
 for(const f of catalog.families){let s=createPlayableRun({seed:'short-'+f.id,familyId:f.id,startAt:'birth'},catalog),choices=0,moves=0;assert.equal(s.age,0);while(s.age<18&&moves<45){if(s.phase==='event'){s=choose(s);choices++;}else{s=continueChildhood(s,catalog);moves++;}assert.equal(s.lastResult?.error,undefined);}
 assert.equal(s.age,18);assert.ok(choices>=22&&choices<=33,`${f.id}: ${choices}`);assert.ok(moves<=40,`${f.id}: ${moves}`);assert.deepEqual(s.storyHistory.filter(h=>TEEN_STORY_STEPS.some(r=>r.id===h.eventId)).map(h=>h.eventId),TEEN_STORY_STEPS.map(r=>r.id));for(const age of [3,6,12,13,14,15,16])assert.ok(s.seenEvents.some(id=>id.startsWith(`AGE${String(age).padStart(2,'0')}`)),`${f.id} age ${age}`);assert.ok(s.childhood.summary);assert.equal(s.ledger.filter(l=>l.label==='成年一次性赠与').length,1);assert.deepEqual(save(s),s);}
});
test('existing childhood fast-forward preserves previous choices and never repeats the adult gift',()=>{
 let s=createRun({seed:'old-young',familyId:'F01'},catalog);s=choose(s);const history=structuredClone(s.storyHistory);delete s.childhood;s=save(s);const a=continueChildhood(s,catalog,{fast:true}),b=continueChildhood(s,catalog,{fast:true});assert.deepEqual(a,b);assert.deepEqual(a.storyHistory.slice(0,history.length),history);assert.equal(a.age,6);assert.match(a.activeEvent.eventId,/^STU_[A-H]1$/);assert.equal(a.ledger.filter(l=>l.label==='成年一次性赠与').length,0);let grown=a;for(let guard=0;grown.age<18&&guard<60;guard++)grown=grown.phase==='event'?choose(grown):continueChildhood(grown,catalog,{fast:true});assert.equal(grown.age,18);assert.equal(grown.ledger.filter(l=>l.label==='成年一次性赠与').length,1);assert.equal(continueChildhood(grown,catalog,{fast:true}),grown);
});
test('child market conserves inventory value, locks buyer offer across reload, pays once and affects skill',()=>{
 const original=teen(),worth=getMetrics(original).netWorth;let s=step(original,{type:'child_buy',good:'game',quantity:2});assert.equal(s.cash,original.cash-9600);assert.equal(getMetrics(s).netWorth,worth);assert.ok(applyAction(s,{type:'child_buy',good:'book',quantity:1}).result.error);
 s=step(s,{type:'child_price',markup:1.75});const locked=save(s);assert.deepEqual(locked.childhood.offer,s.childhood.offer);assert.ok(applyAction(s,{type:'child_price',markup:.9}).result.error);const offered=s.childhood.offer.total,before=s.cash,skill=s.stats.skill;s=step(s,{type:'child_sell'});assert.equal(s.cash,before+offered);assert.equal(getMetrics(s).netWorth,worth-9600+offered);assert.equal(s.stats.skill,skill+1);assert.ok(s.flags.childhood_merchant);assert.ok(s.relationships.N07>original.relationships.N07||s.relationships.N07>0);assert.ok(applyAction(s,{type:'child_sell'}).result.error);assert.deepEqual(save(s),s);
});
test('three buyers cap random draws; unsold inventory clears once on adulthood with real loss',()=>{
 let s=step(teen(),{type:'child_buy',good:'toy',quantity:3});for(let i=0;i<3;i++){s=step(s,{type:'child_price',markup:1.25});s=step(s,{type:'child_decline'});}assert.ok(applyAction(s,{type:'child_price',markup:.9}).result.error);const cash=s.cash,cost=s.childhood.inventory.cost;assert.equal(s.childhood.rounds,3);
 s.age=17;s.turn=11;s=step(s,{type:'rest'});const out=advanceTurn(s);assert.equal(out.result.error,undefined);s=out.state;assert.equal(s.age,18);assert.equal(s.childhood.inventory,null);assert.equal(s.cash,cash+Math.floor(cost*.5)+s.adultGift+s.ledger.filter(e=>e.age===18&&['成长阶段零花钱','童年日常花销'].includes(e.label)).reduce((n,e)=>n+e.amount,0));assert.equal(s.childhood.receipts,Math.floor(cost*.5));assert.equal(s.ledger.filter(l=>l.label==='童年余货五折清仓').length,1);
});
test('child market input and saved inventory corruption are rejected',()=>{
 for(const a of [{type:'child_buy',good:'bogus',quantity:1},{type:'child_buy',good:'book',quantity:4},{type:'child_buy',good:'book',quantity:1.2}])assert.ok(applyAction(teen(),a).result.error);
 const poor=teen();poor.cash=0;assert.ok(applyAction(poor,{type:'child_buy',good:'book',quantity:1}).result.error);
 const s=step(teen(),{type:'child_buy',good:'book',quantity:1});s.childhood.inventory.cost++;assert.throws(()=>encodeSave(s));
});
test('continuation labels match childhood jumps and memes reveal no future state',()=>{
 const s=teen();assert.equal(continuation(s).label,'继续这一学年 → 13 岁');s.phase='result';assert.equal(continuation(s).label,'安排这一阶段');
 const a=adult({cash:0});a.journey.lastAction='desk_order';const before=structuredClone(a);assert.match(actionQuip(a),/钱包空了/);assert.deepEqual(a,before);
});
