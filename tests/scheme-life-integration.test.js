// Controlled activation fixtures test integration contracts. Natural scheduling is audited separately by scheme-life-pacing.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun,chooseEvent,continueStory,eligibleChoices,nextTurn} from '../src/game/narrative.js';
import {applyEffects,applyAction,getActionAvailability,getMetrics,PRODUCTS} from '../src/game/core.js';
import {ensureCryptoLife,cryptoLifeState} from '../src/game/crypto-life.js';
import {schemeLifeState,schemeEventAllowed} from '../src/game/scheme-life.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};
const interludeIds=['SCHEME_INTERLUDE_A','SCHEME_INTERLUDE_B','SCHEME_INTERLUDE_C','SCHEME_INTERLUDE_D'];
for(const id of interludeIds){const e=structuredClone(catalog.events.find(e=>e.id==='CL01'));delete e.cryptoLife;delete e.schemeLife;Object.assign(e,{id,title:'普通日子',prompt:'今天还有生活要处理。',category:'关系与人生',choices:[{id:id+'_1',label:'继续生活',profile:'observe',requirements:{all:[]},outcomes:[{id:id+'_out',weight:100,text:'你处理了今天的一件普通小事。',effects:[],schedule:[]}]}]});catalog.events.push(e);}setSaveCatalog(catalog);
const event=id=>catalog.events.find(e=>e.id===id),save=s=>decodeSave(encodeSave(s));
function adult(seed='scheme-integration'){
 const s=createRun({seed,familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000,familyReserve:1000000,monthlyIncome:0,occupation:'离职待业',giftReceived:true});s.flags.crypto_aware=true;s.flags.ponzi_exposed=true;s.marketProgress={firstExperienceAge:18,simulations:0,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};ensureCryptoLife(s);return s;
}
function show(s,id){if(s.phase==='result')s=continueStory(s,catalog);const n=structuredClone(s);n.phase='planning';n.activeEvent=null;n.eventQueue=[id];const r=continueStory(n,catalog);assert.equal(r.activeEvent?.eventId,id,r.lastResult?.error);return r;}
function pick(s,id,action){const c=eligibleChoices(s,event(id)).find(c=>(c.schemeAction||c.cryptoAction||c.onlineAction||c.id)===action);assert.ok(c,`${id}/${action}`);assert.equal(c.disabled,false,c.reason);const n=chooseEvent(s,id,c.id,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);return n;}
function clock(s,days){const n=structuredClone(s);n.debtClock.day+=days;n.age+=days/360;if(days)n.turn++;const r=applyEffects(n,[]);assert.equal(r.result.error,undefined,r.result.error);return r.state;}
function ordinary(s){const ids=interludeIds.filter(id=>!s.seenEvents.includes(id)).slice(0,2);assert.equal(ids.length,2);for(const id of ids)s=pick(show(s,id),id,id+'_1');return continueStory(s,catalog);}
function joined(){let s=pick(show(adult(),'CL22'),'CL22','curious');s=ordinary(clock(continueStory(s,catalog),90));return pick(show(s,'CL23'),'CL23','join');}
function finance(s,e){const r=applyEffects(s,[{op:'crypto_life',schemeLife:true,...e}]);assert.equal(r.result.error,undefined,r.result.error);return r.state;}

test('scheme cooldown counts chosen Crypto and online events as two separate interludes without changing their counters itself',()=>{
 let s=pick(show(adult(),'CL22'),'CL22','curious'),g=schemeLifeState(s);assert.equal(g.interludes,0);assert.equal(cryptoLifeState(s).lastEventDay,null);assert.equal(s.behavior.onlineGambling.lastEventDay,null);
 assert.equal(schemeEventAllowed(s,event('CL23')),false);s=continueStory(s,catalog);s=clock(s,90);assert.equal(schemeEventAllowed(s,event('CL23')),false);
 s=pick(show(s,'OG01'),'OG01','curious');assert.equal(schemeLifeState(s).interludes,1);assert.equal(schemeEventAllowed(s,event('CL23')),false);
 s=ordinary(clock(continueStory(s,catalog),90));const interludes=schemeLifeState(s).interludes;s=pick(show(s,'CL01'),'CL01','curious');assert.equal(schemeLifeState(s).interludes,interludes+1);assert.equal(schemeEventAllowed(s,event('CL23')),true);const before=s.cash;s=pick(show(s,'CL23'),'CL23','join');assert.equal(s.cash,before-10000);assert.equal(schemeLifeState(s).interludesAtLastEvent,interludes+1);assert.equal(s.pending.some(p=>p.sourceEventId==='CL23'),false);
});

test('locked project choices and actual monthly receipts survive reload and cannot be applied twice',()=>{
 let s=show(adult(),'CL22'),saved=save(s);assert.deepEqual(saved.activeEvent,s.activeEvent);assert.equal(saved.rng,s.rng);s=pick(saved,'CL22','curious');s=ordinary(clock(continueStory(s,catalog),90));s=show(s,'CL23');const instance=s.activeEvent.instanceId,before=s.cash;s=pick(save(s),'CL23','join');assert.equal(s.cash,before-10000);assert.ok(s.appliedEffectIds.includes(instance));
 const again=chooseEvent(save(s),'CL23','CL23_1',catalog);assert.ok(again.lastResult.error);assert.equal(again.cash,s.cash);s=continueStory(s,catalog);const paidBefore=s.cash;s=clock(s,30);assert.equal(s.cash-paidBefore,250);const p=s.positions.find(p=>p.schemeLife),count=p.cryptoScheme.paymentCount,restored=save(s);s=clock(restored,0);assert.equal(s.cash,restored.cash);assert.equal(s.positions[0].cryptoScheme.paymentCount,count);assert.deepEqual(save(s),s);
});

test('the same first-payment position can be genuinely exited or left at risk without narrative money',()=>{
 let base=continueStory(joined(),catalog);base=ordinary(clock(base,90));const eventState=show(base,'CL24'),before=eventState.cash,amount=eventState.positions.find(p=>p.schemeLife).value;
 const exited=pick(save(eventState),'CL24','withdraw'),held=pick(save(eventState),'CL24','continue');assert.equal(exited.cash-before,amount);assert.equal(exited.positions.length,0);assert.equal(held.cash,before);assert.equal(held.positions.length,1);assert.equal(getMetrics(exited).netWorth,getMetrics(held).netWorth);
 const exitLater=clock(continueStory(exited,catalog),1800),holdLater=clock(continueStory(held,catalog),1800);assert.equal(exitLater.cash,exited.cash);assert.ok(holdLater.positions[0].cryptoScheme.warningDay!==null);assert.ok(holdLater.cash>held.cash);assert.equal(holdLater.positions[0].cost,amount);assert.deepEqual(save(exitLater),exitLater);
});

test('actual family story choices debit family reserve and allow player and household to exit independently',()=>{
 let s=ordinary(clock(continueStory(joined(),catalog),90));s=show(s,'SL06');const cash=s.cash,reserve=s.familyReserve,worth=getMetrics(s).netWorth;s=pick(s,'SL06','family_join');assert.equal(s.cash,cash);assert.equal(s.familyReserve,reserve-100000);assert.equal(getMetrics(s).netWorth,worth);
 s=finance(s,{action:'scheme_withdraw'});assert.equal(s.positions.length,0);assert.equal(s.trading.schemeFamilyProjects.length,1);const own=s.cash,house=s.familyReserve;s=clock(s,30);assert.equal(s.cash,own);assert.equal(s.familyReserve-house,2500);s=finance(s,{action:'scheme_family_withdraw'});assert.equal(s.cash,own);assert.equal(s.familyReserve,house+102500);assert.equal(s.trading.schemeFamilyProjects.length,0);assert.deepEqual(save(s),s);
});

test('permanent refusal chosen in a story closes new and legacy ponzi purchases while old exits and ordinary Crypto remain available',()=>{
 let s=show(ordinary(clock(continueStory(joined(),catalog),90)),'SL19');s=pick(s,'SL19','permanent_refuse');assert.equal(schemeLifeState(s).forbidRisk,true);s=continueStory(s,catalog);for(const action of [{type:'invest',product:'ponzi',amount:100000},{type:'desk_order',product:'ponzi',instrument:'PZ01',amount:100000}]){const gate=getActionAvailability(s,action);assert.equal(gate.allowed,false);assert.match(gate.reason,/永久拒绝/);const result=applyAction(s,action);assert.ok(result.result.error);assert.equal(result.state.cash,s.cash);}
 const oldLegacy=applyEffects(s,[{op:'venture',stake_yuan:100,win_chance_bps:5000,gross_multiple:2}],{profile:'ponzi'});assert.match(oldLegacy.result.error,/永久拒绝/);assert.equal(oldLegacy.state.cash,s.cash);const ordinaryCrypto=getActionAvailability(s,{type:'invest',product:'crypto',amount:100000,underlying:'CLG'});assert.equal(ordinaryCrypto.allowed,true,ordinaryCrypto.reason);s=finance(s,{action:'scheme_withdraw'});assert.equal(s.positions.length,0);assert.deepEqual(save(s),s);
});

test('pending scheme story blocks a time skip and preserves its locked outcomes and cash',()=>{
 const s=show(ordinary(clock(continueStory(joined(),catalog),90)),'CL24'),before=structuredClone(s),n=nextTurn(s,catalog);assert.ok(n.lastResult.error);assert.equal(n.age,before.age);assert.equal(n.debtClock.day,before.debtClock.day);assert.equal(n.cash,before.cash);assert.deepEqual(n.activeEvent,before.activeEvent);
});

test('an active project cannot satisfy a fresh trial or renewed introduction through a missing project fallback',()=>{
 const s=ordinary(clock(continueStory(joined(),catalog),180));assert.equal(schemeLifeState(s).projects[s.positions[0].projectKey].status,'ACTIVE');assert.equal(schemeEventAllowed(s,event('CL23')),false);assert.equal(schemeEventAllowed(s,event('SL22')),false);
});
