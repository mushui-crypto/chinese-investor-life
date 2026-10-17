import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,chooseEvent,continueStory} from '../src/game/narrative.js';
import {getMetrics,PRODUCTS,getActionAvailability} from '../src/game/core.js';
import {ensureOnlineGambling,recordOnlineQuit,recordOnlineRefusal,advanceOnlineGambling,onlineGamblingSummary} from '../src/game/online-gambling.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const key of ['events','families','history','endings','characters']){const d=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(seed='og-bridge'){
 const s=createRun({seed,familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000,monthlyIncome:400000,giftReceived:true});s.flags.gambling_exposed=true;s.stats.credit=100;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;
}
const step=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);return n;};
const bet=s=>step(s,{type:'gamble',game:'redblack',pick:'red',amount:10000});
const save=s=>decodeSave(encodeSave(s));
function story(s,id,action,variant){
 const e=catalog.events.find(e=>e.id===id),c=e.choices.find(c=>c.onlineAction===action),outcome=c.outcomes.find(o=>o.onlineOutcome===variant)||c.outcomes[0];
 const n=structuredClone(s);n.phase='event';n.activeEvent={eventId:id,instanceId:`online:${id}:${n.turn}:${++n.serial}`,outcomes:Object.fromEntries(e.choices.map(choice=>[choice.id,choice.id===c.id?outcome.id:choice.outcomes[0].id]))};
 const next=chooseEvent(n,id,c.id,catalog);assert.equal(next.lastResult?.error,undefined,next.lastResult?.error);return next;
}

test('the real casino bridges one actual settlement exactly once into lifelong totals',()=>{
 const s=adult(),n=bet(s),g=n.behavior.onlineGambling,casino=n.trading.gambling;
 assert.equal(g.totalBets,1);assert.equal(g.staked,casino.staked);assert.equal(g.returned,casino.returned);assert.equal(n.cash-s.cash,g.netProfit);assert.equal(n.ledger.slice(s.ledger.length).filter(e=>e.account==='cash').reduce((sum,e)=>sum+e.amount,0),g.netProfit);
 assert.deepEqual(save(n),n);const twice=bet(n);assert.equal(twice.behavior.onlineGambling.totalBets,2);assert.equal(twice.behavior.onlineGambling.staked,20000);assert.equal(twice.trading.gambling.rounds,2);
});
test('legacy casino migration never counts an already settled round twice',()=>{
 let old=bet(adult());delete old.behavior.onlineGambling;const imported=save(old),g=imported.behavior.onlineGambling;assert.equal(g.totalBets,1);assert.equal(g.legacyImported,true);const next=bet(imported);assert.equal(next.behavior.onlineGambling.totalBets,2);assert.equal(next.behavior.onlineGambling.staked,next.trading.gambling.staked);assert.equal(next.behavior.onlineGambling.returned,next.trading.gambling.returned);assert.equal(next.behavior.onlineGambling.memories.firstBet,null);
});
test('watching a table and investing after quitting do not add gambling bets or relapses',()=>{
 const watch=step(adult(),{type:'gamble_observe',game:'baccarat'});assert.equal(watch.behavior.onlineGambling.totalBets,0);
 const quit=step(bet(adult()),{type:'gamble_leave'}),old=structuredClone(quit.behavior.onlineGambling),n=step(quit,{type:'desk_order',product:'fund',instrument:'balanced',amount:100000});assert.equal(n.behavior.onlineGambling.totalBets,old.totalBets);assert.equal(n.behavior.onlineGambling.relapseCount,0);assert.equal(n.behavior.onlineGambling.status,'QUIT');assert.equal(n.behavior.onlineGambling.quitCount,1);
 const rejected=act(quit,{type:'gamble_leave'},catalog);assert.ok(rejected.lastResult.error);assert.equal(rejected.behavior.onlineGambling.quitCount,1);
});
test('new story winnings use the existing cash ledger and do not automatically create an old casino case',()=>{
 const s=adult();ensureOnlineGambling(s);const n=story(s,'OG02','small','big_win');const g=n.behavior.onlineGambling;
 assert.ok(n.cash>s.cash);assert.equal(n.cash-s.cash,g.netProfit);assert.equal(n.legal.cases.length,s.legal.cases.length);assert.equal(g.totalBets,1);assert.ok(g.memories.firstBigWin);assert.equal(g.exitOpportunities,1);assert.deepEqual(save(n),n);
 const continued=continueStory(n,catalog);assert.equal(continued.phase,'planning');assert.equal(continued.activeEvent,null);
});
test('trial credit pays only real returns and can be lost without charging cash',()=>{
 for(const outcome of ['zero','big_win']){const s=adult(),n=story(s,'OG02','bonus',outcome),g=n.behavior.onlineGambling;assert.equal(g.staked,0);assert.equal(g.freeCredit,2000);assert.equal(n.cash-s.cash,g.returned);assert.equal(g.netProfit,g.returned);assert.equal(g.firstOutcome,outcome==='zero'?'loss':'win');assert.deepEqual(save(n),n);}
});
test('RECOVERED blocks legacy casino attempts without mutating money or randomness',()=>{
 const s=bet(adult());recordOnlineQuit(s);s.debtClock.day+=720;s.age+=2;recordOnlineRefusal(s);recordOnlineRefusal(s);advanceOnlineGambling(s);assert.equal(s.behavior.onlineGambling.status,'RECOVERED');
 const before=structuredClone(s),a={type:'gamble',game:'redblack',pick:'red',amount:10000};assert.equal(getActionAvailability(s,a).allowed,false);const n=act(s,a,catalog);assert.ok(n.lastResult.error);assert.equal(n.cash,before.cash);assert.equal(n.rng,before.rng);assert.deepEqual(n.behavior.onlineGambling,before.behavior.onlineGambling);assert.equal(onlineGamblingSummary(s).status,'RECOVERED');
});
