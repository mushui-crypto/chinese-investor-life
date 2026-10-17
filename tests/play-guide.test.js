import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,nextTurn,chooseEvent,continueStory,eligibleChoices,leaveUnavailableEvent} from '../src/game/narrative.js';
import {createPlayableRun} from '../src/game/quick-start.js';
import {timePreview,nextStep,newJourney,updateJourney,setGoal,toggleWatch,goalStatus} from '../src/game/play-guide.js';
import {getMetrics,applyEffects} from '../src/game/core.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
const adult=()=>{const s=createRun({seed:'guide-test',familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000,monthlyIncome:400000,giftReceived:true});return s;};
test('adult openings simulate valid childhoods for all families and preserve the single gift and story history',()=>{
 for(const family of catalog.families)for(const childhood of ['study','practical','social']){const s=createPlayableRun({seed:'adult-'+family.id,familyId:family.id,startAt:'adult',childhood},catalog);assert.equal(s.age,18);assert.ok(s.giftReceived);assert.equal(s.journey.start,'adult');assert.ok(s.seenEvents.includes('MAIN01'));assert.ok(s.storyHistory.length>3);assert.equal(s.positions.length,0);assert.equal(s.ledger.filter(e=>e.label==='成年一次性赠与').length,1);assert.deepEqual(decodeSave(encodeSave(s)),s);}
});
test('quick opening is deterministic and the full life starts at birth',()=>{
 const opt={seed:'quick-again',familyId:'F01',startAt:'adult',childhood:'social'};assert.deepEqual(createPlayableRun(opt,catalog),createPlayableRun(opt,catalog));const a=createPlayableRun({...opt,startAt:'birth'},catalog),b=createPlayableRun({...opt,startAt:'birth'},catalog);assert.deepEqual(a,b);assert.equal(a.age,0);assert.equal(a.activeEvent.eventId,'MAIN01');assert.ok(!a.seenEvents.includes('MAIN01'));assert.equal(a.giftReceived,false);
});
test('time preview reads known wage living and monthly contract bills without changing cash RNG or future outcomes',()=>{
 const r=applyEffects(adult(),[{op:'loan',principal_yuan:3600,apr_bps:1200,term_months:12,purpose:'approved_use'}],{profile:'bank'}),s=r.state,before=structuredClone(s),p=timePreview(s);assert.equal(p.salary,2000000);assert.equal(p.living,3240000);assert.equal(p.debt,197100);assert.equal(p.days,180);assert.equal(p.ageAfter,25.5);assert.deepEqual(s,before);
 const n=act(s,{type:'calendar_day'},catalog),q=timePreview(n);assert.equal(q.salary,p.salary);assert.equal(q.living,p.living-18000);assert.equal(q.days,179);assert.equal(q.debt,p.debt);
});
test('survival projections switch to one day, prison exempts wages and living, childhood forecasts no adult bill',()=>{
 const poor=adult();poor.cash=0;poor.monthlyIncome=0;const p=timePreview(poor);assert.ok(p.dayMode);assert.equal(p.days,1);assert.equal(p.ageAfter,25);assert.equal(p.living,18000);const child=createRun({seed:'child',familyId:'F01'},catalog);assert.equal(timePreview(child).living,0);
 const prison=adult();prison.legal.prisonMonthsLeft=3;assert.equal(timePreview(prison).salary,0);assert.equal(timePreview(prison).living,0);assert.equal(timePreview(prison).months,3);
});
test('guidance always exposes a relevant route for event result zero-action closed-market and survival states',()=>{
 const s=adult();s.phase='event';assert.equal(nextStep(s).route.tab,'life');s.phase='result';assert.equal(nextStep(s).route.type,'continue');s.phase='planning';s.trading.energy=0;assert.equal(nextStep(s,'stock').route.command.type,'day_next');s.trading.phase=3;assert.equal(nextStep(s,'stock').route.command.type,'day_next');s.trading.dayInTurn=2;assert.equal(nextStep(s,'stock').route.command.type,'day_next');s.cash=0;s.monthlyIncome=0;s.actionPoints=0;assert.equal(nextStep(s).route.action,'survival_day');
});
test('goals and watch choices are persisted, reversible and grant no financial reward',()=>{
 let s=adult(),before=s.cash,rng=s.rng;s=setGoal(s,'practice');assert.ok(!goalStatus(s).done);s=updateJourney(s,act(s,{type:'market_practice'},catalog),{type:'market_practice'});assert.ok(goalStatus(s).done);assert.ok(s.journey.completed.includes('practice'));assert.equal(s.cash,before);assert.equal(s.rng,rng);s=toggleWatch(s,'crypto');assert.ok(s.journey.watchlist.includes('crypto'));s=toggleWatch(s,'crypto');assert.ok(!s.journey.watchlist.includes('crypto'));assert.deepEqual(decodeSave(encodeSave(s)),s);assert.throws(()=>setGoal(s,'debt'),/没有欠款/);
});
test('debt goal includes new borrowing, persists completion and cannot be rewarded by switching goals',()=>{
 const r=applyEffects(adult(),[{op:'loan',principal_yuan:1000,apr_bps:0,term_months:12,purpose:'approved_use'}],{profile:'bank'});let s=setGoal(r.state,'debt');assert.equal(goalStatus(s).current,0);s=updateJourney(s,act(s,{type:'repay',amount:100000},catalog),{type:'repay'});assert.ok(goalStatus(s).done);assert.equal(getMetrics(s).debt,0);assert.equal(s.cash,adult().cash);
});
test('unavailable-event exit is guarded and never executes a blocked reward or consumes RNG',()=>{
 const s=adult(),e={...catalog.events.find(e=>e.id==='STK01'),id:'STK01'};assert.ok(e);s.phase='event';s.activeEvent={eventId:e.id,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes[0].id]))};s.behavior.cooldownUntil=7;
 const blockedCatalog={...catalog,events:catalog.events.map(x=>x.id===e.id?{...x,choices:x.choices.map(c=>({...c,requirements:{min_cash_yuan:1e12,all:[]}}))}:x)};
 const next=leaveUnavailableEvent(s,blockedCatalog);assert.ok(!next.lastResult?.error);assert.equal(next.cash,s.cash);assert.equal(next.rng,s.rng);assert.equal(next.phase,'planning');assert.equal(next.storyHistory.length,s.storyHistory.length);assert.ok(next.logs.at(-1).title.startsWith('没能参与'));
 const normal=createRun({seed:'normal',familyId:'F01'},catalog);assert.ok(leaveUnavailableEvent(normal,catalog).lastResult.error);
});
test('legacy saves receive neutral guidance and corrupted goal or watch data is rejected',()=>{
 const s=adult();delete s.journey;const n=decodeSave(encodeSave(s));assert.deepEqual(n.journey,newJourney());assert.equal(n.cash,s.cash);assert.equal(n.rng,s.rng);
 for(const mutate of [s=>s.journey.goal='bad',s=>s.journey.watchlist=['invented'],s=>s.journey.completed=['debt','debt'],s=>s.journey.debtStart=-1]){const s=adult();mutate(s);assert.throws(()=>encodeSave(s),/存档/);}
});

test('pending T+1 holdings guide to a usable market tick and zero living actions do not dead-end goals',()=>{
 let s=adult();s.marketProgress.unlocked.stock=true;s=act(s,{type:'desk_order',product:'stock',instrument:'chip',shares:100,amount:100000},catalog);assert.equal(s.positions.length,1);assert.equal(nextStep(s,'stock').route.command.type,'day_next');s.positions=[];s.marketProgress.simulations=1;s.journey.goal='buffer';s.cash=100000;s.monthlyIncome=200000;s.actionPoints=0;assert.equal(nextStep(s).route.tab,'market');
});


test('a first investment does not require practice guidance; explicitly chosen practice stays available',()=>{
 const s=adult();s.cash=100000;s.monthlyIncome=500000;s.journey.goal='buffer';
 assert.equal(s.marketProgress.simulations,0);assert.notEqual(nextStep(s).route.action,'market_practice');
 const chosen=setGoal(s,'practice');assert.equal(nextStep(chosen).route.action,'market_practice');
});
