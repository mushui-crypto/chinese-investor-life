import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import * as productionNarrative from '../src/game/narrative.js';
import {getActionAvailability} from '../src/game/core.js';
import {lifeScene} from '../src/game/life-arcs.js';
import {behaviorEvent} from '../src/game/behavior.js';
import {DAILY_EVENTS} from '../src/game/day-routine.js';
import {onlineGamblingState} from '../src/game/online-gambling.js';

const read=name=>JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
const crosscuttingFixture=process.env.PACING_CROSSCUTTING==='1';
let narrative=productionNarrative;
if(crosscuttingFixture){
 const target='marketCategories.has(e.category) === preferMarket';
 const source=readFileSync(new URL('../src/game/narrative.js',import.meta.url),'utf8');
 if(!source.includes(target))throw Error('Preferred-pool fixture no longer matches the production source');
 const patched=source.replace(target,'(marketCategories.has(e.category) === preferMarket || onlineStory(e))').replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL(path,new URL('../src/game/narrative.js',import.meta.url)).href}'`);
 narrative=await import('data:text/javascript;base64,'+Buffer.from(patched).toString('base64'));
}
const {createRun,chooseEvent,continueStory,nextTurn,act,eligibleChoices}=narrative;
const catalog={events:read('events').events,families:read('families'),endings:read('endings'),history:read('history'),characters:read('characters')};
const count=Number(process.env.PACING_RUNS||20),runs=[];
const followupWeightMultiplier=Number(process.env.PACING_FOLLOWUP_MULTIPLIER||1);
if(followupWeightMultiplier!==1)for(const e of catalog.events)if(e.onlineGambling&&e.id!=='OG01'){e.weight*=followupWeightMultiplier;e.onlineGambling.weight*=followupWeightMultiplier;}
const activeActions=new Set(['bonus','small','raise','chase','allin','borrow','guru','model']);
function choiceFor(s,e){
 const available=eligibleChoices(s,e).filter(c=>!c.disabled);
 if(e.onlineGambling){
  const preferred=e.id==='OG01'?['curious']:['small','bonus','inspect','wait','watch','hold','work','keep'];
  return preferred.map(a=>available.find(c=>c.onlineAction===a)).find(Boolean)||available.find(c=>!activeActions.has(c.onlineAction))||available[0];
 }
 return ['school','self_study','study','rest','observe','family','network','repair'].map(p=>available.find(c=>c.profile===p&&!c.onlineAction)).find(Boolean)||available.find(c=>!c.onlineAction)||available[0];
}
const fingerprint=s=>JSON.stringify([s.phase,s.age,s.turn,s.debtClock.day,s.activeEvent?.eventId,s.familyLife?.pending,s.lifeArcs?.pending,s.behavior?.pending,s.dayRoutine?.pending,s.runStats.choices,s.runStats.actions]);
function ordinaryAction(s){
 if(s.lifeArcs?.pending){
  const scene=lifeScene(s);if(!scene)return null;
  const choices=[...scene.choices].sort((a,b)=>Number(['friends','steady','decline','leave','no_child','unmarried'].includes(b[0]))-Number(['friends','steady','decline','leave','no_child','unmarried'].includes(a[0])));
  return choices.map(c=>({type:'life_choice',scene:scene.key,choice:c[0],...(scene.key==='family'?{event:`${s.familyLife.pending}:${s.familyLife.pendingOn}`}:{})})).find(a=>getActionAvailability(s,a).allowed);
 }
 if(s.dayRoutine?.pending)return DAILY_EVENTS[s.dayRoutine.pending]?.choices.map(c=>({type:'day_event_choice',choice:c[0]})).find(a=>getActionAvailability(s,a).allowed);
 if(s.behavior?.pending)return behaviorEvent(s)?.choices.map(c=>({type:'behavior_choice',scene:s.behavior.pending,choice:c.id})).find(a=>getActionAvailability(s,a).allowed);
 return null;
}
for(let index=0;index<count;index++){
 const seed=`online-natural-${index}`,mode=index%2?'history':'remix';
 let s=createRun({seed,mode,birthYear:1988,familyId:`F${String(index%12+1).padStart(2,'0')}`},catalog),steps=0,stagnant=0,failure=null,funded=0,healthResets=0,jobTurn=-1;
 const events=[],allEvents=[];
 for(;steps<5000&&s.phase!=='ended';steps++){
  // Isolate narrative pacing: only funding and health are stabilized. Never touch
  // event queues, gambling state, age, clocks, traits, random state or outcomes.
  if(s.age>=18&&s.cash<10_000_000){funded+=10_000_000-s.cash;s.cash=10_000_000;}
  if(s.age>=18&&s.stats.health<70){s.stats.health=70;healthResets++;}
  const before=fingerprint(s);
  if(s.phase==='event'){
   const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),c=choiceFor(s,e);
   if(!c){failure=`no choice: ${e.id}`;break;}
   const g=onlineGamblingState(s),item={id:e.id,age:s.age,day:s.debtClock.day,ordinary:g.ordinaryEvents,choice:c.id,action:c.onlineAction||null};
   if(e.onlineGambling||c.onlineAction){item.daysSincePrevious=g.lastEventDay===null?null:s.debtClock.day-g.lastEventDay;item.ordinarySincePrevious=g.lastEventDay===null?null:g.ordinaryEvents-g.ordinaryAtLastEvent;events.push(item);}
   allEvents.push(item);s=chooseEvent(s,e.id,c.id,catalog);
  }else if(s.phase==='result')s=continueStory(s,catalog);
  else{
   const a=ordinaryAction(s);
   if(a)s=act(s,a,catalog);
   else if(s.age>=22&&s.age<60&&!s.monthlyIncome&&jobTurn!==s.turn&&getActionAvailability(s,{type:'seek_job'}).allowed){jobTurn=s.turn;s=act(s,{type:'seek_job'},catalog);}
   else s=nextTurn(s,catalog);
  }
  if(s.lastResult?.error){failure=s.lastResult.error;break;}
  stagnant=fingerprint(s)===before?stagnant+1:0;
  if(stagnant>=3){failure='three unchanged progress attempts';break;}
 }
 if(steps>=5000)failure='5000-step guard';
 const gaps=events.slice(1),g=onlineGamblingState(s);
 const run={seed,mode,familyId:s.familyId,ended:s.phase==='ended',finalAge:s.age,steps,failure,onlineEvents:events.length,firstExposureAge:events.find(e=>e.id==='OG01')?.age??null,onlyIntroduction:events.length===1&&events[0].id==='OG01',totalBets:g.totalBets,ordinaryEvents:g.ordinaryEvents,consecutiveViolation:gaps.some(e=>e.daysSincePrevious<90||e.ordinarySincePrevious<2),fundedCents:funded,healthResets,events,adultStoryCount:allEvents.filter(e=>e.age>=18).length};
 runs.push(run);console.log(JSON.stringify({...run,events:events.map(e=>`${e.id}@${e.age}`)}));
}
const exposed=runs.filter(r=>r.firstExposureAge!==null),summary={runs:runs.length,ended:runs.filter(r=>r.ended).length,failures:runs.filter(r=>r.failure).length,exposed:exposed.length,onlyIntroduction:runs.filter(r=>r.onlyIntroduction).length,noIntroduction:runs.length-exposed.length,totalOnlineEvents:runs.reduce((n,r)=>n+r.onlineEvents,0),minOnlineEvents:Math.min(...runs.map(r=>r.onlineEvents)),maxOnlineEvents:Math.max(...runs.map(r=>r.onlineEvents)),medianFirstExposure:exposed.map(r=>r.firstExposureAge).sort((a,b)=>a-b)[Math.floor(exposed.length/2)]??null,consecutiveViolations:runs.filter(r=>r.consecutiveViolation).length};
const report={createdAt:new Date().toISOString(),method:'Seeded full lives (alternating history/remix), real create/choose/continue/act/nextTurn paths. Adult cash floor ¥100,000 and health floor 70 are fixture-only survival support. No direct OG queue insertion or gambling-state manipulation. Prefer curious introduction, ¥20/bonus participation when offered, otherwise ordinary safe decisions; no deliberate debt/chasing/escalation.',fixtureFollowupWeightMultiplier:followupWeightMultiplier,fixtureCrosscuttingPreferredPool:crosscuttingFixture,summary,runs};
mkdirSync(new URL('../reports/v1.60.0/',import.meta.url),{recursive:true});writeFileSync(new URL(`../reports/v1.60.0/${process.env.PACING_REPORT||'pacing.json'}`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
