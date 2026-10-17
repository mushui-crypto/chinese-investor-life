import {DAILY_EVENTS} from '../src/game/day-routine.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {act,nextTurn,chooseEvent,continueStory,eligibleChoices,leaveUnavailableEvent} from '../src/game/narrative.js';
import {getActionAvailability,getMetrics,getSurvivalStatus} from '../src/game/core.js';
import {continuation} from '../src/game/continuation.js';
import {lifeScene} from '../src/game/life-arcs.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
import {quoteFor} from '../src/game/market-play.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.34/lifetimes';await mkdir(dir,{recursive:true});
const runs=[],errors=[];
for(const familyId of ['F01','F04','F08'])for(const policy of ['salary','market','gamble']){
 let s=createPlayableRun({seed:`pace-${familyId}-${policy}`,familyId,startAt:'adult'},catalog),steps=0,handledTurn=-1,orders=0,skippedDays=0;
 const go=a=>{if(!getActionAvailability(s,a).allowed)return false;const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);if(a.type==='live_days')skippedDays+=n.lastResult.days||0;s=n;return true;};
 try{
  while(s.phase!=='ended'&&steps++<3000){
   if(s.phase==='result'){s=continueStory(s,catalog);continue;}
   if(s.phase==='event'){const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),cs=eligibleChoices(s,e).filter(c=>!c.disabled),c=cs.find(c=>['observe','rest','family','school','self_study','job'].includes(c.profile))||cs[0];s=c?chooseEvent(s,e.id,c.id,catalog):leaveUnavailableEvent(s,catalog);assert.ok(!s.lastResult?.error,s.lastResult?.error);continue;}
   if(getSurvivalStatus(s).active&&s.actionPoints){if(s.monthlyIncome<getMetrics(s).monthlyExpense)go({type:'seek_job'});if(getSurvivalStatus(s).active)go({type:'gig'});}
   const p=continuation(s,{skipMarket:true});
   if(p.kind==='daily'){go({type:'day_event_choice',choice:s.dayRoutine.pending==='overtime'?'decline':DAILY_EVENTS[s.dayRoutine.pending].choices.at(-1)[0]});continue;}
   if(p.kind==='life'){const e=lifeScene(s),c=e.choices.find(c=>['steady','cut','decline','tell','leave','read'].includes(c[0])&&getActionAvailability(s,{type:'life_choice',scene:e.key,choice:c[0]}).allowed)||e.choices.find(c=>getActionAvailability(s,{type:'life_choice',scene:e.key,choice:c[0]}).allowed);assert.ok(c);go({type:'life_choice',scene:e.key,choice:c[0]});continue;}
   if(p.kind==='behavior'){const key=s.behavior.pending,e=BEHAVIOR_EVENTS[key],preferred={tilt:'review',hot_hand:'ground',drawdown:'ledger',night_watch:'sleep',work_warning:'rest',relapse:'keep',group_invite:'mute',family_call:'honest',family_exposed:'truth',rebuild:'plan'}[key];const c=e.choices.find(c=>c.id===preferred&&getActionAvailability(s,{type:'behavior_choice',scene:key,choice:c.id}).allowed)||e.choices.find(c=>getActionAvailability(s,{type:'behavior_choice',scene:key,choice:c.id}).allowed);assert.ok(c);go({type:'behavior_choice',scene:key,choice:c.id});continue;}
   if(handledTurn!==s.turn&&!s.legal.prisonMonthsLeft&&!getSurvivalStatus(s).active){
    if(s.dayRoutine?.stage===0){go({type:'day_next'});continue;}
    handledTurn=s.turn;if(s.monthlyIncome<getMetrics(s).monthlyExpense*1.5)go({type:'seek_job'});
    if(s.stats.health<60)go({type:'rest'});
    if(policy==='market'){
     for(const pos of [...s.positions])if(getActionAvailability(s,{type:'desk_sell',id:pos.id,bps:10000}).allowed)go({type:'desk_sell',id:pos.id,bps:10000});
     if(!s.marketProgress.simulations)go({type:'market_practice'});
     const price=quoteFor(s,'stock','chip').price,amount=price*100;if(amount<s.cash*.4&&go({type:'desk_order',product:'stock',instrument:'chip',shares:100,amount}))orders++;
    }
    if(policy==='gamble'&&s.cash>10000){if(go({type:'gamble',game:'redblack',pick:'red',amount:Math.min(100000,Math.floor(s.cash/3))}))orders++;}
    continue;
   }
   if(p.kind==='period'){s=nextTurn(s,catalog);assert.ok(!s.lastResult?.error,s.lastResult?.error);}
   else if(p.kind==='action'){assert.ok(go(p.action));}
   else assert.fail(JSON.stringify(p));
   if(steps%25===0){const restored=decodeSave(encodeSave(s));assert.deepEqual(restored,s);s=restored;}
  }
  assert.equal(s.phase,'ended');assert.ok(s.age===80||s.survival.failed);assert.deepEqual(decodeSave(encodeSave(s)),s);
  const r={familyId,policy,age:s.age,steps,orders,skippedDays,ending:s.ending.id,cash:s.cash,netWorth:getMetrics(s).netWorth};runs.push(r);console.log('PASS',JSON.stringify(r));
 }catch(e){errors.push({familyId,policy,age:s.age,steps,error:e.stack});console.error('FAIL',errors.at(-1));}
}
await writeFile(`${dir}/results.json`,JSON.stringify({passed:!errors.length,runs,errors},null,2));if(errors.length)process.exitCode=1;
