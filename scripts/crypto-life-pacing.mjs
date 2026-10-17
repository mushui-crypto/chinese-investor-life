import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRun,chooseEvent,continueStory,nextTurn,act,eligibleChoices,getEventCandidates} from '../src/game/narrative.js';
import {getActionAvailability} from '../src/game/core.js';
import {lifeScene} from '../src/game/life-arcs.js';
import {behaviorEvent} from '../src/game/behavior.js';
import {DAILY_EVENTS} from '../src/game/day-routine.js';
import {cryptoLifeState,cryptoLifeSummary} from '../src/game/crypto-life.js';
import {cryptoLifeHoldings} from '../src/game/crypto-life-finance.js';

const read=name=>JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
const sourceFiles=[...readdirSync(new URL('../src/game/',import.meta.url)).filter(n=>n.endsWith('.js')).map(n=>'src/game/'+n),'data/events.json','data/endings.json'];
const sourceHashes=()=>Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex')]));
const sourcesBefore=sourceHashes();
const catalog={events:read('events').events,families:read('families'),endings:read('endings'),history:read('history'),characters:read('characters')};
const selectedSeedIndices=process.env.PACING_SEEDS?.split(',').map(Number)||null;
const byId=new Map(catalog.events.map(e=>[e.id,e])),count=selectedSeedIndices?.length||Number(process.env.PACING_RUNS||32),runs=[];
if(!Number.isInteger(count)||count<1||count>100)throw Error('PACING_RUNS must be an integer from 1 to 100');
const policies=['spot_holder','mixed_continue','early_exit','observer'];
if(selectedSeedIndices?.some(n=>!Number.isInteger(n)||n<0||n>10000)||selectedSeedIndices&&new Set(selectedSeedIndices).size!==selectedSeedIndices.length)throw Error('PACING_SEEDS must contain unique nonnegative integers');
if(process.env.PACING_POLICY&&!policies.includes(process.env.PACING_POLICY))throw Error('PACING_POLICY is unknown');
const risk=new Set(['buy','add','alt_buy','dip_buy','leverage_open','scheme_join','scheme_add']);
function choiceFor(s,e,policy,index){
 const choices=eligibleChoices(s,e).filter(c=>!c.disabled);if(!choices.length)return null;
 if(e.cryptoLife){
  const branch=e.cryptoLife.branch||'spot';let preferred;
  if(e.id==='CL01')preferred=['curious','inspect'];
  else if(policy==='observer')preferred=['inspect','remember','wait','refuse'];
  else if(policy==='spot_holder')preferred=branch==='spot'?['buy','hold','remember','inspect','refuse']:['refuse','remember','inspect','reduce'];
  else if(policy==='early_exit')preferred=e.id==='CL39'?['buy']:['sell','principal','scheme_withdraw','quit','reduce','buy','alt_buy','leverage_open','scheme_join','curious','remember','inspect'];
  else preferred=['buy','alt_buy','dip_buy','leverage_open','scheme_join','hold','wait','curious','ambition','confidence','fomo','inspect','remember'];
  if(policy==='mixed_continue'&&choices.some(c=>c.cryptoAction==='leverage_open')){
   const tier=index%3===0?'low':index%3===1?'high':'medium';const c=choices.find(c=>c.cryptoAction==='leverage_open'&&c.cryptoTier===tier);if(c)return c;
  }
  return preferred.map(a=>choices.find(c=>c.cryptoAction===a)).find(Boolean)||choices.find(c=>!risk.has(c.cryptoAction))||choices[0];
 }
 return ['school','self_study','study','rest','observe','family','network','repair'].map(p=>choices.find(c=>c.profile===p&&!c.onlineAction)).find(Boolean)||choices.find(c=>!c.onlineAction)||choices.find(c=>['leave','decline','inspect','quit','remember'].includes(c.onlineAction))||choices[0];
}
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
const fingerprint=s=>JSON.stringify([s.phase,s.age,s.turn,s.trading.day,s.trading.phase,s.debtClock.day,s.activeEvent?.eventId,s.familyLife?.pending,s.lifeArcs?.pending,s.behavior?.pending,s.dayRoutine?.pending,s.runStats.choices,s.runStats.actions]);
const sum=xs=>xs.reduce((a,b)=>a+b,0);
function accountIssues(s){return ['position','claim'].filter(account=>sum(s.ledger.filter(e=>e.account===account).map(e=>e.amount))!==sum((account==='position'?s.positions:s.claims).map(p=>p.value)));}
const counts=Object.fromEntries(catalog.events.filter(e=>e.cryptoLife).map(e=>[e.id,{title:e.title,eligibleRuns:0,selectedRuns:0,selected:0}]));
for(let iteration=0;iteration<count;iteration++){
 const index=selectedSeedIndices?.[iteration]??iteration;
 const seed=`crypto-natural-${index}`,mode=index%2?'history':'remix',policy=process.env.PACING_POLICY||policies[index%policies.length];
 let s=createRun({seed,mode,birthYear:1988,familyId:`F${String(index%12+1).padStart(2,'0')}`},catalog),steps=0,stagnant=0,failure=null,funded=0,healthResets=0,jobTurn=-1,marketTurn=-1,marketTicks=0;
 const events=[],eligible=new Set(),selected=new Set(),pricingSamples=[],ledgerIssues=[],firstPositions=new Map();let firstSpotMove=null,firstAltMove=null;
 function observe(){
  for(const p of cryptoLifeHoldings(s).filter(p=>['spot','alt'].includes(p.cryptoLifeBranch))){
   if(!firstPositions.has(p.cryptoLifeBranch))firstPositions.set(p.cryptoLifeBranch,{id:p.id,cost:p.cost,entry:p.entryPrice,day:s.debtClock.day});
   const first=firstPositions.get(p.cryptoLifeBranch);
   if(first.id===p.id&&p.lastPrice!==first.entry){const out={branch:p.cryptoLifeBranch,day:s.debtClock.day,age:s.age,price:p.lastPrice,entry:first.entry,returnBps:Math.round((p.lastPrice/first.entry-1)*10000)};if(p.cryptoLifeBranch==='spot'&&!firstSpotMove)firstSpotMove=out;if(p.cryptoLifeBranch==='alt'&&!firstAltMove)firstAltMove=out;}
  }
 }
 for(;steps<5000&&s.phase!=='ended';steps++){
  // Survival-only fixtures. Do not alter clocks, queues, prices, positions, Crypto memories,
  // tendencies, RNG, or selected outcomes. Investments still debit real in-game cash.
  if(s.age>=18&&s.cash<10_000_000){funded+=10_000_000-s.cash;s.cash=10_000_000;}
  if(s.age>=18&&s.stats.health<70){s.stats.health=70;healthResets++;}
  if(s.age>=18)for(const e of getEventCandidates(s,catalog))if(e.cryptoLife)eligible.add(e.id);
  const before=fingerprint(s);observe();
  if(s.phase==='event'){
   const e=byId.get(s.activeEvent.eventId),c=choiceFor(s,e,policy,index);if(!c){failure=`no choice: ${e.id}`;break;}
   if(e.cryptoLife){const g=cryptoLifeState(s),ordinary=s.behavior.onlineGambling.ordinaryEvents,last=g.eventLastDays[e.id];events.push({id:e.id,age:s.age,day:s.debtClock.day,choice:c.id,action:c.cryptoAction,branch:e.cryptoLife.branch,daysSincePrevious:g.lastEventDay===null?null:s.debtClock.day-g.lastEventDay,ordinarySincePrevious:g.lastEventDay===null?null:ordinary-g.ordinaryAtLastEvent,daysSinceSame:last===undefined?null:s.debtClock.day-last,requiredCooldown:e.cryptoLife.cooldown||0,minAge:e.cryptoLife.ageStage[0]});selected.add(e.id);eligible.add(e.id);}
   s=chooseEvent(s,e.id,c.id,catalog);
  }else if(s.phase==='result')s=continueStory(s,catalog);
  else{
   const action=ordinaryAction(s),g=cryptoLifeState(s);
   if(action)s=act(s,action,catalog);
   // Read one actual trading day per life period after exposure. This creates real
   // quotes and settles open daily contracts; it does not force an outcome or trade.
   else if(g.exposed&&marketTurn!==s.turn&&s.trading.phase<3&&getActionAvailability(s,{type:'market_tick'}).allowed){
    const held=cryptoLifeHoldings(s).map(p=>({id:p.id,branch:p.cryptoLifeBranch,cost:p.cost,value:p.value,price:p.lastPrice})),priceBefore={CLG:s.markets.CLG,CHI:s.markets.CHI};s=act(s,{type:'market_tick'},catalog);marketTicks++;
    if(pricingSamples.length<8)pricingSamples.push({turn:s.turn,day:s.debtClock.day,before:priceBefore,after:{CLG:s.markets.CLG,CHI:s.markets.CHI},heldBefore:held,heldAfter:cryptoLifeHoldings(s).map(p=>({id:p.id,branch:p.cryptoLifeBranch,cost:p.cost,value:p.value,price:p.lastPrice}))});
    if(s.trading.phase===3)marketTurn=s.turn;
   }else if(s.age>=22&&s.age<60&&!s.monthlyIncome&&jobTurn!==s.turn&&getActionAvailability(s,{type:'seek_job'}).allowed){jobTurn=s.turn;s=act(s,{type:'seek_job'},catalog);}
   else{s=nextTurn(s,catalog);}
  }
  observe();if(s.lastResult?.error){failure=s.lastResult.error;break;}
  if(steps%30===0){const bad=accountIssues(s);if(bad.length&&ledgerIssues.length<5)ledgerIssues.push({step:steps,age:s.age,accounts:bad});}
  stagnant=fingerprint(s)===before?stagnant+1:0;if(stagnant>=3){failure='three unchanged progress attempts';break;}
 }
 if(steps>=5000)failure='5000-step guard';
 for(const id of eligible)counts[id].eligibleRuns++;for(const id of selected)counts[id].selectedRuns++;for(const e of events)counts[e.id].selected++;
 const g=cryptoLifeState(s),summary=cryptoLifeSummary(s),violations=events.filter(e=>e.age<e.minAge||e.daysSincePrevious!==null&&(e.daysSincePrevious<90||e.ordinarySincePrevious<2)||e.daysSinceSame!==null&&e.daysSinceSame<e.requiredCooldown);
 const run={seed,mode,policy,familyId:s.familyId,ended:s.phase==='ended',finalAge:s.age,steps,failure,fundedCents:funded,healthResets,marketTicks,firstSpotMove,firstAltMove,firstExposureAge:events.find(e=>e.id==='CL01')?.age??null,cryptoEvents:events.length,eligibleEvents:[...eligible],selectedEvents:[...selected],violations,ledgerIssues,totalTrades:g.totalTrades,firstWin:g.memories.firstCryptoWin,firstLoss:g.memories.firstCryptoLoss,firstContractResult:g.history.find(h=>h.kind==='trade'&&h.branch==='leverage'&&['settlement','liquidation','close'].includes(h.action))||null,branches:summary.branches,contractWins:g.contractWins,contractLosses:g.contractLosses,liquidations:g.liquidations,schemePayments:g.schemePayments,schemeFailed:g.schemeFailed,schemeFailureConfirmed:g.schemeFailureConfirmed,relapses:g.relapseCount,status:g.status,ending:summary.ending?.title||null,pricingSamples,events};runs.push(run);
 console.log(JSON.stringify({seed,policy,ended:run.ended,finalAge:s.age,failure,cryptoEvents:events.length,trades:g.totalTrades,firstSpotReturnBps:firstSpotMove?.returnBps,selected:[...selected]}));
}
const moves=runs.map(r=>r.firstSpotMove).filter(Boolean),summary={runs:count,ended:runs.filter(r=>r.ended).length,failures:runs.filter(r=>r.failure).length,exposed:runs.filter(r=>r.firstExposureAge!==null).length,totalCryptoEvents:sum(runs.map(r=>r.cryptoEvents)),trades:sum(runs.map(r=>r.totalTrades)),eventCoverage:Object.values(counts).filter(c=>c.selectedRuns).length,eligibleCoverage:Object.values(counts).filter(c=>c.eligibleRuns).length,pacingViolations:runs.filter(r=>r.violations.length).length,ledgerIssues:runs.filter(r=>r.ledgerIssues.length).length,firstSpotUp:moves.filter(m=>m.returnBps>0).length,firstSpotDown:moves.filter(m=>m.returnBps<0).length,contractWins:sum(runs.map(r=>r.contractWins)),contractLosses:sum(runs.map(r=>r.contractLosses)),schemeFailed:runs.filter(r=>r.schemeFailed).length,schemeEscapedConfirmed:runs.filter(r=>r.schemeFailureConfirmed).length,relapses:sum(runs.map(r=>r.relapses))};
const sourcesAfter=sourceHashes(),sourceChanges=sourceFiles.filter(path=>sourcesBefore[path]!==sourcesAfter[path]);
const report={createdAt:new Date().toISOString(),method:'Production create/choose/continue/act/nextTurn with full seeded lives and real market ticks. Four transparent deterministic choice policies. Adult cash floor ¥100,000 and health floor 70 are survival-only fixtures. No direct insertion of events, modification of Crypto state/holdings/quotes/RNG, or forced winning/losing outcomes. Coverage is observed sampling, not proof that unsampled rare events are unreachable.',selectedSeedIndices,policyOverride:process.env.PACING_POLICY||null,sourceChanges,sourcesBefore,sourcesAfter,summary,coverage:counts,runs};
const dir=new URL('../reports/v1.61.0/',import.meta.url);mkdirSync(dir,{recursive:true});writeFileSync(new URL(process.env.PACING_REPORT||'crypto-pacing.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
if(summary.failures||summary.pacingViolations||summary.ledgerIssues)process.exitCode=1;
