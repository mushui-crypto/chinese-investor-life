import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {act,nextTurn,chooseEvent,continueStory,eligibleChoices,leaveUnavailableEvent} from '../src/game/narrative.js';
import {quoteFor} from '../src/game/market-play.js';
import {getActionAvailability,getMetrics} from '../src/game/core.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${n}.json`));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
const safe=['observe','uw_quit','self_study','school','rest','prison_study','prison_reflect','prison_letter','legal_cooperate','family','network','repair','job','work'];
const runs=[],errors=[],out=process.env.QA_REPORT_DIR||'reports/v1.8';await mkdir(out,{recursive:true});
for(const f of catalog.families)for(const policy of ['salary','market','rebuild']){
 let s=createPlayableRun({seed:`flow-${f.id}-${policy}`,familyId:f.id,startAt:policy==='salary'?'birth':'adult',childhood:policy==='market'?'study':'social'},catalog),steps=0,blocked=0,actions=0;
 const go=a=>{if(!getActionAvailability(s,a).allowed)return false;const n=act(s,a,catalog);assert.ok(!n.lastResult?.error,n.lastResult?.error);s=n;actions++;return true;};
 try{
  while(s.phase!=='ended'&&steps++<1300){
   if(s.phase==='result'){s=continueStory(s,catalog);continue;}
   if(s.phase==='event'){const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),choices=eligibleChoices(s,e).filter(c=>!c.disabled).sort((a,b)=>(safe.indexOf(a.profile)<0?99:safe.indexOf(a.profile))-(safe.indexOf(b.profile)<0?99:safe.indexOf(b.profile)));if(!choices.length){s=leaveUnavailableEvent(s,catalog);blocked++;continue;}let next;for(const c of choices){const n=chooseEvent(s,e.id,c.id,catalog);if(!n.lastResult?.error){next=n;break;}}assert.ok(next,`No executable choice in ${e.id}`);s=next;continue;}
   if(s.age>=18){
    if(s.monthlyIncome<getMetrics(s).monthlyExpense)go({type:'seek_job'});
    if(policy==='rebuild'&&s.turn%8===0){go({type:'gamble',game:'redblack',pick:'red',amount:Math.min(s.cash,100000),reckless:true});if(s.behavior.pending){const scene=s.behavior.pending,catalogue=await import('../src/game/behavior-events.js');for(const c of catalogue.BEHAVIOR_EVENTS[scene].choices){if(go({type:'behavior_choice',scene,choice:c.id}))break;}}}
    if(policy==='market'){if(!s.marketProgress.simulations)go({type:'market_practice'});if(s.cash>getMetrics(s).livingReserve+100000&&!s.positions.some(p=>p.kind==='stock'))go({type:'desk_order',product:'stock',instrument:'chip',shares:100,amount:100*quoteFor(s,'stock','chip').price});if(s.positions.length){for(let tick=0;tick<3;tick++)go({type:'market_tick'});go({type:'market_day'});for(const p of [...s.positions])go({type:'desk_sell',id:p.id,bps:10000});}}
    if(s.actionPoints>0)go({type:s.stats.health<50?'rest':'gig'});
   }
   if(s.phase!=='ended'){s=nextTurn(s,catalog);assert.ok(!s.lastResult?.error,s.lastResult?.error);}
   if(steps%20===0)s=decodeSave(encodeSave(s));
  }
  assert.ok(s.phase==='ended',`did not finish at age ${s.age}`);assert.ok(s.age===80||s.ending.id==='E29');assert.deepEqual(decodeSave(encodeSave(s)),s);
  runs.push({family:f.id,policy,age:s.age,turn:s.turn,ending:s.ending.id,steps,actions,blocked});console.log('PASS',f.id,policy,s.age,s.ending.id);
 }catch(e){errors.push({family:f.id,policy,age:s.age,phase:s.phase,event:s.activeEvent?.eventId,error:e.stack});console.error('FAIL',errors.at(-1));}
}
await writeFile(`${out}/flow-simulation.json`,JSON.stringify({passed:!errors.length,runs,errors,date:new Date().toISOString()},null,2));if(errors.length)process.exitCode=1;
