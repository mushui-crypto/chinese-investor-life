import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRun,chooseEvent,continueStory,nextTurn,act,eligibleChoices,getEventCandidates} from '../src/game/narrative.js';
import {getActionAvailability,getMetrics} from '../src/game/core.js';
import {lifeScene} from '../src/game/life-arcs.js';
import {behaviorEvent} from '../src/game/behavior.js';
import {DAILY_EVENTS} from '../src/game/day-routine.js';
import {schemeLifeState,schemeLifeSummary} from '../src/game/scheme-life.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';

const read=name=>JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
const sourceFiles=[...readdirSync(new URL('../src/game/',import.meta.url)).filter(n=>n.endsWith('.js')).map(n=>'src/game/'+n),'data/events.json','data/endings.json'];
const hashes=()=>Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex')])),sourcesBefore=hashes();
const policies=['hold_cash','early_exit','hold_retain','family_hold','warning_exit','relapse','permanent_refuse','observer'];
const selectedSeeds=process.env.PACING_SEEDS?.split(',').map(Number),count=selectedSeeds?.length||Number(process.env.PACING_RUNS||32);
if(!Number.isInteger(count)||count<1||count>100||selectedSeeds?.some(n=>!Number.isInteger(n)||n<0)||selectedSeeds&&new Set(selectedSeeds).size!==selectedSeeds.length)throw Error('Invalid pacing seed count');
if(process.env.PACING_POLICY&&!policies.includes(process.env.PACING_POLICY))throw Error('Unknown pacing policy');
const byId=new Map(catalog.events.map(e=>[e.id,e])),runs=[],coverage=Object.fromEntries(catalog.events.filter(e=>e.schemeLife).map(e=>[e.id,{title:e.title,eligibleRuns:0,selectedRuns:0,selected:0}]));
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const fingerprint=s=>JSON.stringify([s.phase,s.age,s.turn,s.debtClock.day,s.activeEvent?.eventId,s.lifeArcs?.pending,s.behavior?.pending,s.dayRoutine?.pending,s.runStats.choices,s.runStats.actions]);
const balanceFingerprint=s=>JSON.stringify(Object.fromEntries(['cash','familyReserve','positions','claims','debts','ledger','rng','trading','behavior'].map(k=>[k,s[k]])));
const financialSnapshot=s=>({cash:s.cash,familyReserve:s.familyReserve,personalNetWorth:getMetrics(s).netWorth,personalPositionValue:sum(s.positions.map(p=>p.value))});
function choose(s,e,policy){
 const cs=eligibleChoices(s,e).filter(c=>!c.disabled);if(!cs.length)return null;
 const scheme=cs.filter(c=>c.schemeAction);
 if(scheme.length){
  let actions;
  if(policy==='observer')actions=['refuse','boundary','remember','analyze'];
  else if(policy==='early_exit')actions=['withdraw','family_withdraw','join','curious','remember','refuse'];
  else if(policy==='warning_exit'&&['delay','recovered','rumor','slow','last_payment'].includes(e.schemeLife?.stage))actions=['withdraw','family_withdraw','partial','analyze'];
  else if(policy==='family_hold')actions=['family_join','friend_info','trust','join','continue','wait_payment','screenshot','wait','curious','contact','acknowledge','analyze'];
  else if(policy==='hold_retain')actions=['retain','join','continue','wait_payment','screenshot','wait','curious','trust','contact','acknowledge','analyze'];
  else if(policy==='relapse')actions=['next_project','join','trust','fomo','friend_certified','continue','wait_payment','screenshot','wait','curious','contact','acknowledge','analyze'];
  else if(policy==='permanent_refuse')actions=['permanent_refuse','join','continue','wait_payment','screenshot','wait','curious','trust','contact','acknowledge','analyze'];
  else actions=['join','continue','wait_payment','screenshot','wait','curious','trust','contact','acknowledge','analyze','remember'];
  return actions.map(a=>scheme.find(c=>c.schemeAction===a)).find(Boolean)||scheme[0];
 }
 if(e.cryptoLife)return ['curious','buy','hold','remember','reduce','refuse','inspect'].map(a=>cs.find(c=>c.cryptoAction===a)).find(Boolean)||cs[0];
 if(e.onlineGambling)return ['curious','inspect','remember','refuse','quit','withdraw','leave'].map(a=>cs.find(c=>c.onlineAction===a)).find(Boolean)||cs[0];
 return ['school','self_study','study','rest','observe','family','network','repair'].map(p=>cs.find(c=>c.profile===p)).find(Boolean)||cs[0];
}
function ordinaryAction(s){
 if(s.lifeArcs?.pending){const scene=lifeScene(s);if(!scene)return null;return [...scene.choices].sort((a,b)=>Number(['friends','steady','decline','leave','no_child','unmarried'].includes(b[0]))-Number(['friends','steady','decline','leave','no_child','unmarried'].includes(a[0]))).map(c=>({type:'life_choice',scene:scene.key,choice:c[0],...(scene.key==='family'?{event:`${s.familyLife.pending}:${s.familyLife.pendingOn}`}:{})})).find(a=>getActionAvailability(s,a).allowed);}
 if(s.dayRoutine?.pending)return DAILY_EVENTS[s.dayRoutine.pending]?.choices.map(c=>({type:'day_event_choice',choice:c[0]})).find(a=>getActionAvailability(s,a).allowed);
 if(s.behavior?.pending)return behaviorEvent(s)?.choices.map(c=>({type:'behavior_choice',scene:s.behavior.pending,choice:c.id})).find(a=>getActionAvailability(s,a).allowed);
 return null;
}
for(let iteration=0;iteration<count;iteration++){
 const index=selectedSeeds?.[iteration]??iteration,seed=`scheme-natural-${index}`,policy=process.env.PACING_POLICY||policies[index%policies.length];
 let s=createRun({seed,mode:index%2?'history':'remix',birthYear:1988,familyId:`F${String(index%12+1).padStart(2,'0')}`},catalog),steps=0,stagnant=0,failure=null,funded=0,healthResets=0,jobTurn=-1,reloads=0;
 const events=[],transitions=[],eligible=new Set(),selected=new Set(),ledgerIssues=[],reloadIssues=[],interludes=[],knownStages=new Map();
 function observe(){for(const p of [...s.positions,...s.trading.schemeFamilyProjects||[]].filter(p=>p.schemeLife)){const q=p.cryptoScheme;if(knownStages.get(p.projectKey)!==q.stage){knownStages.set(p.projectKey,q.stage);transitions.push({projectKey:p.projectKey,age:s.age,day:s.debtClock.day,stage:q.stage,paymentCount:q.paymentCount,paid:q.paid,invested:q.invested,returned:q.returned,value:p.value,familyPrincipal:q.familyPrincipal||0,familyValue:q.familyValue||0});}}}
 for(;steps<5000&&s.phase!=='ended';steps++){
  // Explicit survival fixtures only: no clocks, project state, queues, choices, RNG, or outcomes are set.
  if(s.age>=18&&s.cash<10000000){funded+=10000000-s.cash;s.cash=10000000;}
  if(s.age>=18&&s.stats.health<70){s.stats.health=70;healthResets++;}
  if(s.age>=24)for(const e of getEventCandidates(s,catalog))if(e.schemeLife)eligible.add(e.id);
  const prior=fingerprint(s);observe();
  try{
   if(s.phase==='event'){
    const e=byId.get(s.activeEvent.eventId),c=choose(s,e,policy);if(!c){failure=`No available choice for ${e.id}`;break;}
    if(e.schemeLife||c.schemeAction){const g=schemeLifeState(s),meta=e.schemeLife||{minDelay:90,cooldown:180,ageStage:[24,80]},last=g.eventLastDays[e.id];events.push({id:e.id,age:s.age,day:s.debtClock.day,choice:c.id,action:c.schemeAction,stage:meta.stage,projectKey:c.outcomes[0]?.schemeResolution?.projectKey||g.currentProjectKey,daysSincePrevious:g.lastEventDay===null?null:s.debtClock.day-g.lastEventDay,interludesSincePrevious:g.lastEventDay===null?null:g.interludes-g.interludesAtLastEvent,daysSinceSame:last===undefined?null:s.debtClock.day-last,minDelay:meta.minDelay,cooldown:meta.cooldown,minAge:meta.ageStage[0],interludeKinds:[...new Set(interludes)]});interludes.length=0;selected.add(e.id);eligible.add(e.id);}
    else interludes.push(e.onlineGambling?'online':e.cryptoLife?'crypto':'ordinary');
    const financialBefore=e.schemeLife||c.schemeAction?financialSnapshot(s):null;
    s=chooseEvent(s,e.id,c.id,catalog);
    if(financialBefore)Object.assign(events.at(-1),{financialBefore,financialAfter:financialSnapshot(s)});
   }else if(s.phase==='result')s=continueStory(s,catalog);
   else {const a=ordinaryAction(s);if(a){interludes.push('life_action');s=act(s,a,catalog);}else if(s.age>=22&&s.age<60&&!s.monthlyIncome&&jobTurn!==s.turn&&getActionAvailability(s,{type:'seek_job'}).allowed){jobTurn=s.turn;s=act(s,{type:'seek_job'},catalog);}else s=nextTurn(s,catalog);}
   observe();if(s.lastResult?.error){failure=s.lastResult.error;break;}
   if(steps%30===0){const bad=['position','claim'].filter(a=>sum(s.ledger.filter(e=>e.account===a).map(e=>e.amount))!==sum((a==='position'?s.positions:s.claims).map(p=>p.value)));if(bad.length)ledgerIssues.push({step:steps,accounts:bad});}
   if(steps%80===0&&schemeLifeState(s).exposed){const before=balanceFingerprint(s),restored=decodeSave(encodeSave(s));reloads++;if(before!==balanceFingerprint(restored))reloadIssues.push({step:steps,age:s.age});s=restored;}
   stagnant=fingerprint(s)===prior?stagnant+1:0;if(stagnant>=3){failure='Three unchanged progress attempts';break;}
  }catch(error){failure=error.stack||error.message;break;}
 }
 if(steps>=5000)failure='5000-step guard';
 for(const id of eligible){coverage[id]??={title:byId.get(id)?.title,eligibleRuns:0,selectedRuns:0,selected:0};coverage[id].eligibleRuns++;}for(const id of selected)coverage[id].selectedRuns++;for(const e of events)coverage[e.id].selected++;
 const g=schemeLifeState(s),summary=schemeLifeSummary(s,getMetrics(s)),violations=events.filter(e=>e.age<e.minAge||e.daysSincePrevious!==null&&(e.daysSincePrevious<e.minDelay||e.interludesSincePrevious<2)||e.daysSinceSame!==null&&e.daysSinceSame<e.cooldown);
 const run={seed,policy,familyId:s.familyId,ended:s.phase==='ended',finalAge:s.age,steps,failure,fixtureCashCents:funded,healthResets,reloads,reloadIssues,ledgerIssues,violations,schemeEvents:events.length,firstExposureAge:events[0]?.age??null,eligible:[...eligible],selected:[...selected],forbidRisk:g.forbidRisk,relapses:g.relapseCount,totals:summary.totals,projects:summary.projects.map(p=>({key:p.key,name:p.name,status:p.status,stage:p.stage,paymentCount:p.paymentCount,maxNormalPaymentStreak:p.maxNormalPaymentStreak,invested:p.invested,returned:p.returned,paid:p.paid,realizedProfit:p.realizedProfit,principalReturned:p.principalReturned,retainedProfit:p.retainedProfit,peakBalance:p.peakBalance,recoveryCount:p.recoveryCount,maintenanceCount:p.maintenanceCount,familyInvested:p.familyInvested,familyReturned:p.familyReturned,familyRealizedProfit:p.familyRealizedProfit,ending:p.ending?.id,escapedFailure:p.escapedFailure})),events,transitions};runs.push(run);console.log(JSON.stringify({seed,policy,ended:run.ended,age:s.age,error:failure,events:events.length,projects:run.projects.map(p=>({name:p.name,status:p.status,stage:p.stage,payments:p.paymentCount,ending:p.ending}))}));
}
const projects=runs.flatMap(r=>r.projects),summary={runs:count,ended:runs.filter(r=>r.ended).length,failures:runs.filter(r=>r.failure).length,schemeEvents:sum(runs.map(r=>r.schemeEvents)),eventCoverage:Object.values(coverage).filter(e=>e.selected).length,eligibleCoverage:Object.values(coverage).filter(e=>e.eligibleRuns).length,projects:projects.filter(p=>p.invested).length,longPaid:projects.filter(p=>p.paymentCount>=12).length,coveredInitial:projects.filter(p=>p.invested>0&&p.paid>=p.invested).length,recovered:projects.filter(p=>p.recoveryCount>0).length,collapsed:projects.filter(p=>p.status==='COLLAPSED').length,quit:projects.filter(p=>p.status==='QUIT_SCHEME').length,familyParticipated:projects.filter(p=>p.familyInvested>0).length,relapses:sum(runs.map(r=>r.relapses)),permanentRefusals:runs.filter(r=>r.forbidRisk).length,reloads:sum(runs.map(r=>r.reloads)),pacingViolations:sum(runs.map(r=>r.violations.length)),ledgerIssues:sum(runs.map(r=>r.ledgerIssues.length)),reloadIssues:sum(runs.map(r=>r.reloadIssues.length)),withCryptoInterludes:runs.filter(r=>r.events.some(e=>e.interludeKinds.includes('crypto'))).length,withOnlineInterludes:runs.filter(r=>r.events.some(e=>e.interludeKinds.includes('online'))).length};
const sourcesAfter=hashes(),report={createdAt:new Date().toISOString(),method:'Natural production scheduler from birth to ending, using actual chooseEvent/continueStory/act/nextTurn settlement. Eight deterministic choice policies. Adult cash floor ¥100,000 and health floor 70 are explicit survival fixtures; family reserve is never replenished. No event queue injection, direct project-state/RNG/clock changes, forced trades, or forced outcomes. Periodic encode/decode checks preserve actual finances. Unobserved events are not proved unreachable.',selectedSeeds,policyOverride:process.env.PACING_POLICY||null,sourceChanges:sourceFiles.filter(p=>sourcesBefore[p]!==sourcesAfter[p]),sourcesBefore,sourcesAfter,summary,coverage,runs};
const dir=new URL('../reports/v1.62.0/',import.meta.url);mkdirSync(dir,{recursive:true});writeFileSync(new URL(process.env.PACING_REPORT||'scheme-pacing.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
if(summary.failures||summary.pacingViolations||summary.ledgerIssues||summary.reloadIssues)process.exitCode=1;
