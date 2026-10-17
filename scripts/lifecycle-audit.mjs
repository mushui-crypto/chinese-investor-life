import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {act,nextTurn,chooseEvent,continueStory,eligibleChoices,leaveUnavailableEvent} from '../src/game/narrative.js';
import {gameDate} from '../src/game/game-calendar.js';
import {DAILY_EVENTS} from '../src/game/day-routine.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
import {lifeScene} from '../src/game/life-arcs.js';
import {getActionAvailability,getMetrics} from '../src/game/core.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const out='reports/v1.45/logic-audit',runs=[],failures=[];await mkdir(out,{recursive:true});
const safe=['observe','rest','uw_quit','self_study','school','prison_study','prison_reflect','prison_letter','legal_cooperate','family','network','repair','job','work'];
for(const family of catalog.families)for(const mode of ['history','remix']){
 let s=createPlayableRun({seed:`lifecycle-${family.id}-${mode}`,familyId:family.id,mode,startAt:'birth'},catalog),funded=false,steps=0,choices=0,saves=0,ages=new Set();
 try{
 while(s.phase!=='ended'&&steps++<1500){
  const before=s,date=gameDate(s);ages.add(s.age);
  if(s.age<6)assert.equal(s.cash,0,'preschool cash');
  // Controlled QA fixture: enough starting capital to exercise late life, not a difficulty test.
  if(s.age>=18&&!funded){s.cash+=1e9;funded=true;}
  if(s.phase==='event'){
   const event=catalog.events.find(e=>e.id===s.activeEvent.eventId),options=eligibleChoices(s,event).filter(c=>!c.disabled).sort((a,b)=>(safe.indexOf(a.profile)<0?99:safe.indexOf(a.profile))-(safe.indexOf(b.profile)<0?99:safe.indexOf(b.profile)));
   if(!options.length)s=leaveUnavailableEvent(s,catalog);
   else{let resolved;for(const c of options){const n=chooseEvent(s,event.id,c.id,catalog);if(!n.lastResult?.error){resolved=n;choices++;break;}}assert.ok(resolved,`No working choice ${event.id}`);s=resolved;}
  }else if(s.phase==='result')s=continueStory(s,catalog);
  else{
   let action;
   if(s.dayRoutine?.pending)action={type:'day_event_choice',choice:DAILY_EVENTS[s.dayRoutine.pending].choices.at(-1)[0]};
   else if(s.behavior?.pending){const e=BEHAVIOR_EVENTS[s.behavior.pending];action=e.choices.map(c=>({type:'behavior_choice',scene:s.behavior.pending,choice:c.id})).find(a=>getActionAvailability(s,a).allowed);}
   else if(s.lifeArcs?.pending){const e=lifeScene(s);action=e.choices.map(c=>({type:'life_choice',scene:s.lifeArcs.pending,choice:c[0]})).find(a=>getActionAvailability(s,a).allowed);}
   s=action?act(s,action,catalog):nextTurn(s,catalog);
  }
  assert.ok(!s.lastResult?.error,s.lastResult?.error);assert.ok(s.age>=before.age);assert.ok(gameDate(s)>=date,`calendar went backwards ${date} -> ${gameDate(s)}`);assert.ok(s.cash>=0);assert.ok(Number.isSafeInteger(getMetrics(s).netWorth));
  if(steps%10===0){assert.deepEqual(decodeSave(encodeSave(s)),s);saves++;}
 }
 assert.equal(s.phase,'ended');assert.equal(s.age,80);assert.deepEqual(decodeSave(encodeSave(s)),s);runs.push({family:family.id,mode,age:s.age,ending:s.ending.id,steps,choices,saves,ages:[...ages]});console.log('PASS',family.id,mode,s.ending.id,steps);
 }catch(e){failures.push({family:family.id,mode,age:s.age,phase:s.phase,event:s.activeEvent?.eventId,error:e.stack});console.error('FAIL',failures.at(-1));}
}
await writeFile(`${out}/lifetime.json`,JSON.stringify({passed:!failures.length,fixture:'10 million yuan QA capital at adulthood; checks lifecycle, not balance',runs,failures},null,2));if(failures.length)process.exitCode=1;
