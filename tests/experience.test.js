import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun,chooseEvent,continueStory,nextTurn,eligibleChoices,getEventCandidates,act} from '../src/game/narrative.js';
import {applyAction,applyEffects,advanceTurn,getMetrics,PRODUCTS} from '../src/game/core.js';
import {previewChoice,characterAppearance,sharedHistory,registerPresentations,dismissPresentation} from '../src/game/experience.js';
import {getMarketAccess,marketCapital,marketExperience} from '../src/game/market-access.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
const event=id=>catalog.events.find(e=>e.id===id);
function adult(age=25){const s=createRun({familyId:'F08',seed:'experience-proof'},catalog);Object.assign(s,{age,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000000,monthlyIncome:1000000});s.stats.insight=60;return s;}
function expert(){const s=adult();s.marketProgress={firstExperienceAge:18,simulations:2,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
function show(s,id){return continueStory({...s,phase:'planning',eventQueue:[id],activeEvent:null},catalog);}
function choose(s,id,index=0){const e=event(id);s=show(s,id);assert.equal(s.activeEvent?.eventId,id);const n=chooseEvent(s,id,e.choices[index].id,catalog);assert.ok(!n.lastResult?.error,n.lastResult?.error);return n;}
function drain(s){for(let i=0;['event','result'].includes(s.phase)&&i<30;i++){if(s.phase==='result')s=continueStory(s,catalog);else{const e=event(s.activeEvent.eventId),c=eligibleChoices(s,e).find(c=>!c.disabled&&['observe','uw_quit','prison_study','prison_reflect','prison_letter','legal_cooperate','self_study','rest','family','school'].includes(c.profile))??eligibleChoices(s,e).find(c=>!c.disabled);s=chooseEvent(s,e.id,c.id,catalog);assert.ok(!s.lastResult?.error,s.lastResult?.error);}}return s;}

test('choice previews use actual cents and every branch without reading locked outcomes or mutating RNG',()=>{
 const s=expert();s.cash=23456789;const c=event('OPT01').choices.find(c=>c.profile==='options'),snapshot=structuredClone(s);
 const p=previewChoice(s,c);assert.deepEqual(s,snapshot);assert.ok(p.stake.min>0);assert.equal(p.livingReserve,getMetrics(s).monthlyExpense*6);
 for(const o of c.outcomes){const a=applyEffects(s,o.effects,{profile:c.profile});const paid=-a.state.ledger.slice(s.ledger.length).filter(e=>e.storyStake).reduce((n,e)=>n+e.amount,0);assert.ok(paid>=p.stake.min&&paid<=p.stake.max);}
 const locked={...s,activeEvent:{eventId:'OPT01',outcomes:{[c.id]:c.outcomes.at(-1).id}}};assert.deepEqual(previewChoice(locked,c),p);
 const repay={profile:'repay',outcomes:[{effects:[{op:'repay',cash_fraction:.5}]}]};s.debts=[{id:'debt',name:'借款',principal:100000,interest:10000,aprBps:0,monthsLeft:12,overdue:false}];assert.equal(previewChoice(s,repay).repayment.max,110000);
});
test('age, own financial capital and knowledge gate orders; experience and practice are not required',()=>{
 const s=adult(17);s.cash=500000000;s.stats.insight=100;assert.equal(getMarketAccess(s,'fund').unlocked,false);
 s.age=18;s.cash=50000000;s.marketProgress.firstExperienceAge=18;
 let a=getMarketAccess(s,'option');assert.deepEqual(a.missing,[]);assert.equal(a.unlocked,true);assert.ok(a.requirements.every(r=>r.key!=='experience'));
 const before=structuredClone(s);const immediate=applyAction(s,{type:'invest',product:'option',amount:100000});assert.equal(immediate.result.error,undefined);assert.deepEqual(s,before);
 const practiced=applyAction(s,{type:'market_practice'}).state;assert.equal(practiced.cash,s.cash);assert.equal(practiced.actionPoints,s.actionPoints-1);assert.equal(practiced.marketProgress.simulations,1);assert.equal(marketExperience(practiced).months,0);
 practiced.age=18.5;assert.equal(getMarketAccess(practiced,'option').unlocked,true);
 const bought=applyAction(practiced,{type:'invest',product:'option',amount:100000});assert.ok(!bought.result.error);assert.equal(bought.state.marketProgress.unlocked.option,true);
 bought.state.cash=0;assert.equal(getMarketAccess(bought.state,'option').unlocked,true);assert.equal(applyAction({...bought.state,actionPoints:2},{type:'invest',product:'option',amount:100000}).state.cash,0);
});
test('borrowed funds, household reserves, illiquid property and private valuations cannot buy eligibility',()=>{
 const s=adult();s.cash=45000000;s.positions=[{kind:'housing',value:900000000},{kind:'angel',value:900000000}];s.familyReserve=999999999;assert.equal(marketCapital(s),45000000);
 s.cash+=10000000;s.debts=[{principal:10000000,interest:0}];assert.equal(marketCapital(s),45000000);assert.equal(getMarketAccess(s,'option').requirements.find(r=>r.key==='capital').met,false);
 s.positions.push({kind:'stock',value:5000000});assert.equal(marketCapital(s),50000000);
 s.positions.at(-1).frozen=true;assert.equal(marketCapital(s),45000000);
});
test('special encounters cannot be unlocked as regular regulated markets, and previews remain inspectable',()=>{
 const s=adult();s.cash=999999999;s.stats.insight=100;assert.equal(getMarketAccess(s,'ponzi').unlocked,false);assert.equal(getMarketAccess(s,'crypto').unlocked,false);
 s.flags.ponzi_exposed=true;s.flags.crypto_aware=true;assert.equal(getMarketAccess(s,'ponzi').unlocked,true);assert.equal(getMarketAccess(s,'crypto').unlocked,true);
});
test('story investments obey the same gate, and always retain a cash-free way forward',()=>{
 let s=adult(18);s.stats.insight=39;s=show(s,'OPT01');const choices=eligibleChoices(s,event('OPT01'));assert.equal(choices.find(c=>c.profile==='options').disabled,true);assert.ok(choices.some(c=>!c.disabled));
 const rejected=applyEffects(s,event('OPT01').choices.find(c=>c.profile==='options').outcomes[0].effects,{profile:'options'});assert.ok(rejected.result.error);assert.strictEqual(rejected.state,s);
});
test('character age and circumstances change independently of the room',()=>{
 for(const [age,index] of [[6,0],[18,1],[45,2],[72,3]])assert.equal(characterAppearance(adult(age)).ageIndex,index);
 const s=adult();assert.equal(characterAppearance(s).condition,1);s.cash=0;s.wipeouts=1;assert.equal(characterAppearance(s).condition,2);s.legal.prisonMonthsLeft=12;assert.equal(characterAppearance(s).condition,3);
});
test('major moments persist but skipping or refreshing never repeats settlement',()=>{
 const before=expert();before.cash=90000000;before.peakNetWorth=90000000;
 const after=structuredClone(before);after.cash=110000000;after.peakNetWorth=110000000;
 let shown=registerPresentations(before,after);assert.equal(shown.presentations[0].kind,'wealth');shown=decodeSave(encodeSave(shown));assert.equal(shown.cash,110000000);assert.equal(shown.presentations.length,1);
 const skip=dismissPresentation(shown,shown.presentations[0].id);assert.equal(skip.cash,shown.cash);assert.equal(skip.rng,shown.rng);assert.equal(skip.presentations.length,0);
 const later={...skip,cash:120000000};assert.equal(registerPresentations(skip,later).presentations.length,0);
 const loss={...later,wipeouts:1,cash:0};assert.equal(registerPresentations(later,loss).presentations.at(-1).kind,'wipeout');
});
test('market access and new presentation/receipt save fields are validated',()=>{
 const s=expert();for(const mutate of [x=>x.marketProgress.firstExperienceAge=81,x=>x.marketProgress.simulations=-1,x=>x.marketProgress.unlocked.fake=true,x=>x.marketProgress.unlocked.stock=1,x=>x.presentations=[{id:'x',kind:'fake',amount:0,months:0,turn:0,age:0}]]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>encodeSave(bad));}
 const legacy=structuredClone(s);delete legacy.marketProgress;delete legacy.presentations;const restored=decodeSave(encodeSave(legacy));assert.equal(restored.cash,s.cash);assert.equal(restored.rng,s.rng);
});
test('all three familiar people branch, wait for their appointments, and retain actual shared memories after reload',()=>{
 for(const [prefix,npc] of [['HAO','N01'],['XIA','N02'],['ZHOU','N04']]){
  const s=expert(),first=event(prefix+'01');const left=choose(s,first.id,0),right=choose(s,first.id,prefix==='XIA'?1:2);
  const target=a=>a.pending.find(p=>p.sourceEventId===first.id).eventId;assert.notEqual(target(left),target(right));assert.equal(sharedHistory(left,npc,catalog).length,1);
  for(let branch of [left,right]){const nextId=target(branch);assert.equal(getEventCandidates(branch,catalog).some(e=>e.id===nextId),false);branch.turn+=3;branch=choose(branch,nextId,0);const final=branch.pending.find(p=>p.sourceEventId===nextId).eventId;branch.turn+=6;branch=choose(branch,final,0);const loaded=decodeSave(encodeSave(branch));assert.equal(sharedHistory(loaded,npc,catalog).length,3);assert.ok(loaded.relationships[npc]>=50);assert.deepEqual(loaded.storyHistory,branch.storyHistory);}
 }
});
test('period receipt reconciles to the cash ledger and counts appreciation only in net worth',()=>{
 const s=expert();const after=advanceTurn(s).state,r=after.lastTurnSummary.receipt;assert.equal(r.cashIn-r.cashOut,after.cash-s.cash);assert.equal(r.cashDelta,after.cash-s.cash);assert.equal(r.netWorthDelta,getMetrics(after).netWorth-getMetrics(s).netWorth);assert.deepEqual(decodeSave(encodeSave(after)).lastTurnSummary,after.lastTurnSummary);
});
test('market-first pacing completes all chapters and invitations without random-story flooding',()=>{
 let s=createRun({seed:'market-first-life',familyId:'F08'},catalog),adultStoryCount=0,adultTurns=0,funded=false; // Fund at adulthood; childhood cash belongs to the family.

 while(s.phase!=='ended'){
  if(s.age>=18&&!funded){s.cash+=1e9;funded=true;}
  if(s.phase==='planning'&&s.age>=18&&s.stats.health<=30)s=act(s,{type:'hospital'},catalog);
  const prior=s.storyHistory.length;s=drain(s);if(s.age>=18)adultStoryCount+=s.storyHistory.length-prior;
  if(s.phase==='ended')break;if(s.age>=18){adultTurns++;if(s.monthlyIncome<getMetrics(s).monthlyExpense&&s.actionPoints>0)s=act(s,{type:'seek_job'},catalog);}
  s=nextTurn(s,catalog);
 }
 assert.equal(s.age,80);assert.equal(s.seenEvents.filter(id=>id.startsWith('MAIN')).length,12);for(const id of ['HAO01','XIA01','ZHOU01'])assert.ok(s.seenEvents.includes(id),id);
 // A personal story per chapter now supports long-lived memories; anchors can add a second.
 assert.ok(adultStoryCount<adultTurns*1.25,`adult narrative interruptions ${adultStoryCount}/${adultTurns}`);
 const designedMarketShare=(adultTurns*2)/(adultTurns*2+adultStoryCount);assert.ok(designedMarketShare>=.60&&designedMarketShare<=.82);
 fs.mkdirSync(new URL('../reports/v1.5/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('../reports/v1.5/pacing.json',import.meta.url),JSON.stringify({seed:s.seed,adultTurns,adultStoryCount,designedMarketOpportunities:adultTurns*2,designedMarketShare,note:'Counts two optional market arrangements per adult turn. This is a pacing capacity ratio, not measured player behavior or screen time.',chapters:s.seenEvents.filter(id=>id.startsWith('MAIN')),npcFirstMeetings:['HAO01','XIA01','ZHOU01'].filter(id=>s.seenEvents.includes(id)),ending:s.ending.id},null,2));
});

test('option buyers and sellers share all access conditions and both engine entry points',()=>{
 const ready=adult(18.5);ready.cash=50000000;ready.stats.insight=40;ready.marketProgress={firstExperienceAge:18,simulations:0,unlocked:{}};
 for(const change of [s=>s.age=17,s=>s.cash--,s=>s.stats.insight--]){
  const s=structuredClone(ready);change(s);
  const buyer=getMarketAccess(s,'option'),seller=getMarketAccess(s,'option_short');assert.equal(buyer.unlocked,false);assert.deepEqual(seller.requirements,buyer.requirements);assert.equal(seller.reason,buyer.reason);
  for(const product of ['option','option_short'])for(const type of ['invest','desk_order']){const r=applyAction(s,{type,product,instrument:'stock',amount:PRODUCTS[product].min,direction:'long',duration:3,strikeRatio:1});assert.ok(r.result.error);assert.strictEqual(r.state,s);}
 }
 for(const product of ['option','option_short']){
  const r=applyAction(ready,{type:'desk_order',product,instrument:'stock',amount:PRODUCTS[product].min,direction:'short',duration:3,strikeRatio:1});assert.equal(r.result.error,undefined);assert.equal(r.state.positions[0].kind,product);assert.equal(r.state.positions[0].direction,'short');assert.equal(r.state.marketProgress.unlocked.option,true);assert.equal(r.state.marketProgress.unlocked.option_short,true);
  // Opening access does not waive the current order's cash or minimum requirements.
  const poor=structuredClone(r.state);poor.cash=1;poor.stats.insight=0;
  assert.ok(getMarketAccess(poor,'option').unlocked&&getMarketAccess(poor,'option_short').unlocked);
  assert.match(applyAction(poor,{type:'invest',product,amount:PRODUCTS[product].min}).result.error,/现金不足/);
 }
});
test('either legacy option permission opens both sides without rewriting balances or positions',()=>{
 for(const side of ['option','option_short']){
  const s=adult();s.cash=100000;s.stats.insight=0;s.marketProgress={firstExperienceAge:null,simulations:0,unlocked:{[side]:true}};
  const saved=decodeSave(encodeSave(s)),before=structuredClone(saved);
  assert.ok(getMarketAccess(saved,'option').unlocked);assert.ok(getMarketAccess(saved,'option_short').unlocked);assert.deepEqual(saved,before);
  saved.age=17;assert.equal(getMarketAccess(saved,'option').unlocked,false);assert.equal(getMarketAccess(saved,'option_short').unlocked,false);
 }
});


test('zero practice permits derivative orders when all remaining requirements are met, including after reload',()=>{
 const ready=adult();ready.marketProgress={firstExperienceAge:18,simulations:0,unlocked:{}};ready.flags.crypto_aware=true;
 for(const product of ['option','option_short','futures','crypto_perp']){
  const s=decodeSave(encodeSave(ready)),before=structuredClone(s),access=getMarketAccess(s,product);
  assert.equal(access.unlocked,true,product);assert.ok(!access.requirements.some(r=>r.key==='simulation'));assert.deepEqual(s,before);
  const order={type:'desk_order',product,instrument:product==='crypto_perp'?'BTCUSDT':product==='futures'?'INDEX_A':'stock',amount:PRODUCTS[product].min,direction:'long',duration:3,strikeRatio:1,leverage:product==='crypto_perp'?10:2};
  const bought=applyAction(s,order);assert.equal(bought.result.error,undefined,product);assert.equal(bought.state.positions.at(-1).kind,product);assert.equal(bought.state.marketProgress.simulations,0);
 }
});
