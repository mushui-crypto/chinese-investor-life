import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState,applyAction,getActionAvailability,advanceTurn,getMetrics} from '../src/game/core.js';
import {childhoodActivities,childhoodActivityPreview,CHILD_REBEL_ACTIONS} from '../src/game/childhood-activities.js';
import {createPlayableRun} from '../src/game/quick-start.js';
import {createRun,act} from '../src/game/narrative.js';
import {updateJourney} from '../src/game/play-guide.js';
import {renderChildhoodOperations} from '../src/ui/childhood-scene.js';
import {childMarketSession} from '../src/game/childhood-state.js';
import {ADULT_GIFT_CAP} from '../src/game/family-gift.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const fixture=age=>Object.assign(createRun({seed:'feedback-test',familyId:'F08'},catalog),{age,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:age<6?0:100000});
const step=(s,a)=>{const out=applyAction(s,a);assert.equal(out.result.error,undefined,out.result.error);return out;};
const save=s=>decodeSave(encodeSave(s));
const helpers={esc:s=>String(s),icon:()=>''};

test('every childhood preview matches actual capped effects, including negative and high stats',()=>{
 for(const age of [1,3,5,6,11,12,14,15,17])for(const value of [0,10,50,74,75,98,100])for(const activity of childhoodActivities({age})){
  const s=fixture(age);for(const key of Object.keys(s.stats))s.stats[key]=value;
  const before=structuredClone(s),preview=childhoodActivityPreview(s,activity.type);
  assert.deepEqual(s,before);
  const out=step(s,{type:activity.type});
  for(const change of preview)assert.equal(change.value,out.state.stats[change.key]-s.stats[change.key],`${age}/${value}/${activity.type}/${change.key}`);
  assert.deepEqual(out.result.statChanges,preview.filter(c=>c.value!==0).sort((a,b)=>Object.keys(s.stats).indexOf(a.key)-Object.keys(s.stats).indexOf(b.key)));
  assert.equal(out.state.actionPoints,1);assert.equal(out.state.rng,s.rng);assert.equal(out.state.cash,s.cash-(activity.cost||0));
 }
});
test('rebellion is age-specific, shares energy, and cannot spend unavailable pocket money',()=>{
 for(const age of [0,3,6,11,18,30])for(const type of CHILD_REBEL_ACTIONS)assert.equal(getActionAvailability(fixture(age),{type}).allowed,false);
 const middle=fixture(12);assert.equal(getActionAvailability(middle,{type:'child_skipclass'}).allowed,false);
 const high=fixture(15);high.cash=2999;const before=structuredClone(high);assert.ok(applyAction(high,{type:'child_skipclass'}).result.error);assert.deepEqual(high,before);
 high.cash=3000;let out=step(high,{type:'child_skipclass'});assert.equal(out.state.cash,0);assert.ok(out.state.stats.academic<high.stats.academic);
 out=step(out.state,{type:'child_latenight'});assert.equal(out.state.actionPoints,0);assert.ok(applyAction(out.state,{type:'study'}).result.error);
 assert.deepEqual(save(out.state),out.state);
});
test('activity feedback survives save/load and keeps real losses visible',()=>{
 const s=fixture(15);s.stats.stress=50;const a={type:'child_latenight'},next=updateJourney(s,act(s,a,catalog),a),restored=save(next);
 const html=renderChildhoodOperations(restored,helpers);
 assert.match(html,/已完成：熬夜看小说/);assert.match(html,/健康 −2/);assert.match(html,/压力 −8/);assert.match(html,/眼力见 \+1/);assert.match(html,/消耗 1 点精力/);
 assert.deepEqual(restored,next);
});
test('adolescent alternatives each offer growth and relief with a visible tradeoff',()=>{
 for(const age of [12,14,15,17])for(const action of childhoodActivities({age}).filter(a=>CHILD_REBEL_ACTIONS.includes(a.type))){
  const s=fixture(age);for(const key of Object.keys(s.stats))s.stats[key]=50;
  const out=step(s,{type:action.type}),changes=out.result.statChanges;
  assert.ok(changes.some(c=>c.key!=='stress'&&c.value>0),action.type+' offers growth');
  assert.ok(changes.some(c=>c.key==='stress'&&c.value<0),action.type+' relieves stress');
  assert.ok(changes.some(c=>c.key!=='stress'&&c.value<0),action.type+' has a tradeoff');
 }
});
test('renamed activities preserve old saved feedback without replaying their new rewards',()=>{
 for(const age of [12,15])for(const activity of childhoodActivities({age}).filter(a=>a.legacyTitle)){
  const s=fixture(age);s.actionPoints=1;s.journey.lastAction=activity.type;
  s.lastResult={title:activity.legacyTitle,text:'上次活动的原始结果',statChanges:[{key:'discipline',value:-6}]};
  const before=structuredClone(s),restored=save(s),html=renderChildhoodOperations(restored,helpers);
  assert.ok(html.includes('已完成：'+activity.label));assert.match(html,/自律 −6/);
  assert.match(html,/上次活动的原始结果/);assert.deepEqual(s,before);assert.deepEqual(restored,before);
 }
});
test('all new family gifts are <= 100000 yuan and the engine caps old unpaid gifts too',()=>{
 for(const family of catalog.families){assert.ok(family.adult_gift_yuan[1]<=100000);for(let n=0;n<20;n++)assert.ok(createState({family,seed:`gift-${n}`}).adultGift<=ADULT_GIFT_CAP);}
 const s=fixture(17);s.adultGift=80000000;const out=advanceTurn(s);assert.equal(out.result.error,undefined);assert.equal(out.state.adultGift,ADULT_GIFT_CAP);assert.equal(out.state.ledger.find(e=>e.label==='成年一次性赠与').amount,ADULT_GIFT_CAP);
});
function oldOpening(){
 const s=createPlayableRun({familyId:'F08',seed:'old-rich-opening',startAt:'adult'},catalog),excess=32342000-s.adultGift;
 s.adultGift+=excess;s.cash+=excess;s.ledger.find(e=>e.label==='成年一次性赠与').amount+=excess;
 s.childhood.summary.gift+=excess;s.childhood.summary.cash+=excess;s.netWorthHistory.at(-1).value+=excess;s.peakNetWorth+=excess;s.lifeArcs.audit.peak+=excess;
 return s;
}
test('old untouched adult opening returns only excess gift, with one correction and no RNG or story changes',()=>{
 const s=oldOpening(),before=structuredClone(s),excess=s.adultGift-ADULT_GIFT_CAP,next=save(s);
 assert.equal(next.cash,s.cash-excess);assert.equal(next.familyReserve,s.familyReserve+excess);assert.equal(getMetrics(next).netWorth,getMetrics(s).netWorth-excess);
 assert.equal(next.cash-next.adultGift,s.cash-s.adultGift);assert.deepEqual(next.activeEvent,s.activeEvent);assert.equal(next.rng,s.rng);assert.deepEqual(s,before);
 assert.equal(next.ledger.at(-1).amount,-excess);assert.equal(next.childhood.summary.gift,ADULT_GIFT_CAP);assert.equal(next.childhood.summary.cash,next.cash);
 assert.deepEqual(save(next),next);
});
test('gift migration caps unpaid old saves but never unwinds later trading or working lives',()=>{
 const child=fixture(12);child.adultGift=80000000;const next=save(child);assert.equal(next.adultGift,ADULT_GIFT_CAP);assert.equal(next.cash,child.cash);assert.deepEqual(next.ledger,child.ledger);
 const traded=oldOpening();traded.ledger.push({id:`entry-${traded.turn}-${++traded.serial}`,turn:traded.turn,age:18,account:'cash',amount:-100,label:'买入股票'});traded.cash-=100;assert.deepEqual(save(traded),traded);
 const later=oldOpening();later.age=19;assert.deepEqual(save(later),later);
});
test('market keeps three-item limit but renews buyers at high school, without rerolling an old offer',()=>{
 let s=fixture(12);for(let i=0;i<3;i++){s=step(s,{type:'child_buy',good:'book',quantity:3}).state;s=step(s,{type:'child_price',markup:1.25}).state;s=step(s,{type:'child_sell'}).state;}
 assert.ok(applyAction(s,{type:'child_buy',good:'book',quantity:1}).result.error);s.age=15;
 assert.equal(childMarketSession(s).rounds,0);assert.ok(applyAction(s,{type:'child_buy',good:'book',quantity:4}).result.error);
 s=step(s,{type:'child_buy',good:'book',quantity:3}).state;assert.equal(s.childhood.rounds,0);assert.equal(s.childhood.marketStage,15);assert.deepEqual(save(s),s);
 let carry=step(fixture(12),{type:'child_buy',good:'toy',quantity:2}).state;carry=step(carry,{type:'child_price',markup:1.75}).state;carry.age=15;
 const bid=structuredClone(carry.childhood.offer),rng=carry.rng;carry=save(carry);assert.deepEqual(carry.childhood.offer,bid);assert.equal(carry.rng,rng);
 carry=step(carry,{type:'child_sell'}).state;assert.equal(childMarketSession(carry).rounds,0);assert.equal(carry.rng,rng);
});
test('manual clearance returns half the cost without allowing stat farming',()=>{
 let s=fixture(12);const before=structuredClone(s);
 for(let n=0;n<3;n++){s=step(s,{type:'child_buy',good:'book',quantity:3}).state;s=step(s,{type:'child_clear'}).state;}
 assert.equal(s.cash,before.cash-5400);assert.deepEqual(s.stats,before.stats);assert.equal(s.actionPoints,2);assert.equal(s.rng,before.rng);assert.equal(s.childhood.inventory,null);
});
