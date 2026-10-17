import {stockLot} from '../src/game/stock-markets.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {act,nextTurn,chooseEvent,continueStory,eligibleChoices,leaveUnavailableEvent} from '../src/game/narrative.js';
import {getActionAvailability,getMetrics,getLoanOffers,PRODUCTS} from '../src/game/core.js';
import {instruments,quoteFor,DESKS} from '../src/game/market-play.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {newJourney,nextStep,updateJourney} from '../src/game/play-guide.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${n}.json`));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
const out=process.env.QA_REPORT_DIR||'reports/v1.9';await mkdir(out,{recursive:true});let checks=0,used=1234567;const rand=n=>{used=(Math.imul(used,1664525)+1013904223)>>>0;return used%n;},runs=[],errors=[];
for(let run=0;run<24;run++){
 let s=createPlayableRun({seed:`explore-${run}`,familyId:catalog.families[run%12].id,startAt:'adult',childhood:run%2?'social':'study'},catalog),trace=[],steps=0;
 try{for(;steps<300&&s.phase!=='ended';steps++){
  const before=s,ledgerAt=s.ledger.length;let a;
  if(s.phase==='event'){const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),cs=eligibleChoices(s,e).filter(c=>!c.disabled);if(cs.length){const c=cs[rand(cs.length)];s=chooseEvent(s,e.id,c.id,catalog);a={event:e.id,choice:c.id};}else{s=leaveUnavailableEvent(s,catalog);a={skip:e.id};}}
  else if(s.phase==='result'){s=continueStory(s,catalog);a={continue:true};}
  else {
   const opts=[{type:'rest'},{type:'gig'},{type:'seek_job'},{type:'market_practice'},{type:'market_tick'},{type:'market_day'},{type:'calendar_day'},{type:'repay',amount:Math.min(s.cash,100000)},{type:'business_start',name:'探索小店',amount:300000}];
   for(const kind of Object.keys(PRODUCTS)){const i=instruments(kind)[rand(instruments(kind).length)];opts.push({type:'desk_order',product:kind,instrument:i.id,amount:kind==='stock'?stockLot(i.id)*quoteFor(s,'stock',i.id).price:PRODUCTS[kind].min,shares:stockLot(i.id),direction:rand(2)?'long':'short',leverage:kind==='crypto_perp'?100:2,duration:1,strikeRatio:1});}
   for(const p of s.positions){opts.push({type:'desk_sell',id:p.id,bps:rand(2)?5000:10000});}
   if(run%3===0)opts.push({type:'gamble',game:'redblack',pick:'red',amount:s.cash,reckless:true});
   if(run%3===1)for(const offer of getLoanOffers(s))opts.push({type:'borrow',kind:offer.kind,amount:offer.principal});
   if(s.behavior.pending){for(const c of BEHAVIOR_EVENTS[s.behavior.pending].choices)opts.push({type:'behavior_choice',scene:s.behavior.pending,choice:c.id});}
   const candidates=opts.filter(a=>getActionAvailability(s,a).allowed);
   if(!candidates.length||rand(6)===0){s=nextTurn(s,catalog);a={nextTurn:true};}else{a=candidates[rand(candidates.length)];s=updateJourney(s,act(s,a,catalog),a);}
  }
  trace.push(a);if(trace.length>15)trace.shift();assert.ok(!s.lastResult?.error,`${JSON.stringify(a)}: ${s.lastResult?.error}`);checks++;
  // Every actual change of cash must be backed by real cash ledger entries, including crisis bills.
  const cashFlow=s.ledger.slice(ledgerAt).filter(e=>e.account==='cash').reduce((sum,e)=>sum+e.amount,0);assert.equal(s.cash-before.cash,cashFlow);checks++;
  assert.equal(getMetrics(s).netWorth,s.cash+s.positions.reduce((sum,p)=>sum+p.value,0)+s.businesses.reduce((sum,p)=>sum+p.value,0)+s.claims.reduce((sum,p)=>sum+p.value,0)-s.debts.reduce((sum,d)=>sum+d.principal+d.interest,0));checks++;
  if(steps%15===0){const round=decodeSave(encodeSave(s));assert.deepEqual(round,s);s=round;checks++;}
  if(s.phase==='planning')for(const desk of [null,...Object.keys(DESKS)]){const route=nextStep(s,desk).route;if(route.type==='command')assert.ok(getActionAvailability(s,route.command).allowed,JSON.stringify(route));if(route.type==='life-action')assert.ok(getActionAvailability(s,{type:route.action}).allowed,JSON.stringify(route));checks++;}
 }
 runs.push({seed:run,steps,age:s.age,phase:s.phase,ending:s.ending?.id||null,positions:s.positions.length,debts:s.debts.length});console.log('PASS',run,steps,s.age,s.phase);
 }catch(e){errors.push({seed:run,steps,age:s.age,phase:s.phase,error:e.stack,trace});await writeFile(`${out}/exploration-failure-${run}.json`,JSON.stringify({state:s,trace,error:e.stack},null,2));console.error('FAIL',errors.at(-1));break;}
}
await writeFile(`${out}/exploration.json`,JSON.stringify({passed:!errors.length,checks,runs,errors,date:new Date().toISOString()},null,2));if(errors.length)process.exitCode=1;
