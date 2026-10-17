import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,chooseEvent,continueStory,eligibleChoices} from '../src/game/narrative.js';
import {getMetrics,getActionAvailability,getSurvivalStatus,PRODUCTS,applyEffects} from '../src/game/core.js';
import {LIFE_CHAPTERS,lifeChapter,recordChapterProgress} from '../src/game/life-chapters.js';
import {chapterTrip,advanceChapterStep} from '../src/game/chapter-progress.js';
import {quoteFor} from '../src/game/market-play.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {renderChapterEntry,renderChapterPlan,renderChapterReceipt,chapterMontageShots} from '../src/ui/life-chapters.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?d.events:d;}setSaveCatalog(catalog);
function fixture({age=25,cash=1e7,wage=600000,seed='chapters'}={}){
 const s=createRun({seed,familyId:'F01'},catalog);
 Object.assign(s,{age,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:wage,giftReceived:true,occupation:wage?'普通职员':'待业'});
 s.education.college=false;s.flags.college_student=false;s.flags.college_not_admitted=true;
 s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];
 s.behavior.seen=Object.keys(BEHAVIOR_EVENTS);s.behavior.pending=null;s.behavior.fatigue=0;
 s.workStories={zhou:{stage:'done',due:0},wu:{stage:'done',due:0}};
 s.chapterPace={start:lifeChapter(s).start,experienced:3};
 s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};
 ensureRoutine(s);resetRoutineDay(s,0);return s;
}
const save=s=>decodeSave(encodeSave(s));
const go=(s,a={type:'chapter_days',days:30})=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);assert.equal(n.cash-s.cash,n.ledger.slice(s.ledger.length).filter(e=>e.account==='cash').reduce((sum,e)=>sum+e.amount,0));return n;};
test('34 contiguous adult chapters cover 18 to 80 with the agreed age ranges',()=>{
 assert.equal(LIFE_CHAPTERS.length,34);assert.equal(LIFE_CHAPTERS[0].start,18);assert.equal(LIFE_CHAPTERS.at(-1).end,80);
 assert.equal(LIFE_CHAPTERS.filter(c=>c.start<22).length,4);assert.equal(LIFE_CHAPTERS.filter(c=>c.start>=22&&c.start<36).length,14);
 assert.equal(LIFE_CHAPTERS.filter(c=>c.start>=36&&c.start<60).length,12);assert.equal(LIFE_CHAPTERS.filter(c=>c.start>=60).length,4);
 for(let i=1;i<34;i++)assert.equal(LIFE_CHAPTERS[i-1].end,LIFE_CHAPTERS[i].start);
 for(const age of [0,17,80])assert.equal(lifeChapter({age}),null);
 assert.equal(lifeChapter({age:18.5}).number,1);assert.equal(lifeChapter({age:65}).number,32);
});
test('legacy day 12 and new chapters can progress immediately without a mandatory daily-play gate',()=>{
 const s=fixture({age:18});delete s.chapterPace;s.debtClock.day=s.debtClock.periodDays=12;const before=structuredClone(s);
 assert.equal(lifeChapter(s).ready,true);assert.deepEqual(s,before);
 const next=structuredClone(s);next.age=19;next.debtClock.periodDays=0;recordChapterProgress(s,next);assert.equal(lifeChapter(next).experienced,0);
 next.debtClock.day+=2;recordChapterProgress({...next,debtClock:{...next.debtClock,day:12}},next);assert.equal(lifeChapter(next).experienced,2);
 const old=structuredClone(next);next.debtClock.day++;recordChapterProgress(old,next);assert.equal(lifeChapter(next).ready,true);
});
test('advance stops before unaffordable living expense, never borrowing, liquidating or taking health away',()=>{
 let s=fixture({cash:19000,wage:0}),n=go(s);assert.equal(n.debtClock.day,1);assert.equal(n.cash,1000);assert.equal(n.lastResult.chapterRun.kind,'living');
 assert.equal(n.survival.unpaidDays,0);assert.equal(n.stats.health,s.stats.health);assert.deepEqual(n.debts,s.debts);assert.deepEqual(n.positions,s.positions);
 const stopped=go(save(n));assert.equal(stopped.cash,n.cash);assert.equal(stopped.debtClock.day,n.debtClock.day);assert.equal(stopped.survival.livingAccrued,n.survival.livingAccrued);
 // Raising cash is a player action; resuming bills only the next unbilled day.
 n=applyEffects(stopped,[{op:'earn',amount_yuan:180}],{}).state;n=go(n,{type:'chapter_days',days:1});assert.equal(n.debtClock.day,2);assert.equal(n.survival.livingAccrued,36000);
});
test('ordinary batch matches daily salary, living cost, debt, prices and fatigue accounting',()=>{
 const s=fixture({seed:'pace'});let batch=s,daily=s;
 for(let guard=0;batch.debtClock.day<30&&guard<30;guard++)batch=go(batch,{type:'chapter_days',days:Math.min(30,30-batch.debtClock.day)});
 assert.equal(batch.debtClock.day,30);
 for(let i=0;i<30;i++)daily=go(daily,{type:'calendar_day'});
 for(const k of ['cash','rng','monthlyIncome'])assert.equal(batch[k],daily[k],k);
 for(const k of ['salaryPaid','livingAccrued'])assert.equal(batch.survival[k],daily.survival[k],k);
 assert.deepEqual(batch.markets,daily.markets);assert.equal(batch.behavior.fatigue,daily.behavior.fatigue);assert.deepEqual(save(batch),batch);
 assert.equal(batch.stats.skill,s.stats.skill);assert.equal(batch.stats.academic,s.stats.academic);
});
test('a small expense gap at zero energy can be settled once, preserving debt and restoring options',()=>{
 let s=fixture({age:18,cash:8266,wage:248000});s.actionPoints=0;s.stats.health=98;
 s.livingPlan={housing:'standard',food:'cook',movedDay:null};s.dayRoutine.stage=5;s.trading.phase=2;
 assert.equal(getSurvivalStatus(s).shortage,534);assert.equal(getActionAvailability(s,{type:'borrow',kind:'family',amount:10000}).allowed,false);
 const blocked=advanceChapterStep(s,catalog,chapterTrip(s));assert.equal(blocked.trip.days,0);assert.equal(blocked.stop.kind,'living');
 const settled=advanceChapterStep(blocked.state,catalog,chapterTrip(blocked.state),{settleDay:true}),n=settled.state;
 assert.equal(settled.trip.days,1);assert.equal(n.cash,0);assert.equal(n.survival.last.salary,0);assert.ok(n.survival.last.earned>0);assert.equal(n.survival.last.due,8800);
 assert.equal(n.survival.last.shortfall,534);assert.equal(settled.trip.debt,534);assert.equal(n.stats.health,98);assert.equal(n.actionPoints,2);
 assert.equal(n.survival.last.healthLost,0);assert.deepEqual(save(n),n);
 assert.ok(getActionAvailability(n,{type:'living_plan',housing:'shared',food:'cook',cutExtras:false}).allowed);
 const cheaper=go(n,{type:'living_plan',housing:'shared',food:'cook',cutExtras:false});assert.equal(getSurvivalStatus(cheaper).shortage,8000);cheaper.cash=8000; // Fund one actual day; future salary is not spendable.;
 const resume=advanceChapterStep(cheaper,catalog,chapterTrip(cheaper));assert.equal(resume.trip.days,1);assert.equal(resume.stop?.kind,'living');
});
test('accepting a one-day shortfall does not erase hunger, pending events, or create an unlimited debt fast-forward',()=>{
 const s=fixture({age:18,cash:0,wage:0});s.actionPoints=0;s.stats.health=50;
 const n=go(s,{type:'chapter_days',days:1,acceptDebt:true});assert.equal(n.debtClock.day,s.debtClock.day+1);assert.equal(n.stats.health,40);
 assert.equal(n.survival.last.healthLost,10);assert.ok(getMetrics(n).debt>getMetrics(s).debt);
 for(const a of [{days:2,acceptDebt:true},{days:30,acceptDebt:true},{days:1,acceptDebt:'yes'}])assert.equal(getActionAvailability(s,{type:'chapter_days',...a}).allowed,false);
 for(const key of ['dayRoutine','lifeArcs','behavior']){const pending=structuredClone(s);pending[key].pending=key==='dayRoutine'?'work_rumor':'pressure';assert.equal(getActionAvailability(pending,{type:'chapter_days',days:1,acceptDebt:true}).allowed,false);}
 const sick=structuredClone(s);sick.stats.health=30;assert.equal(getActionAvailability(sick,{type:'chapter_days',days:1,acceptDebt:true}).allowed,false);
 const normal=go(s);assert.equal(normal.debtClock.day,s.debtClock.day);assert.equal(normal.stats.health,s.stats.health);
});
test('settlement escape is visible in both the stage plan and stop receipt at zero energy',()=>{
 const s=fixture({age:18,cash:8266,wage:248000});s.actionPoints=0;
 const ctx={esc:String,money:n=>`¥${n/100}`};
 assert.match(renderChapterPlan(s,ctx),/data-action="chapter-settle-day"/);
 const r=advanceChapterStep(s,catalog,chapterTrip(s)).trip;
 assert.match(renderChapterReceipt(s,r,ctx),/先结算今天 · 未付固定费用记欠款/);
});
test('repeated explicit day settlement applies hunger every day and exposes the actual food result',()=>{
 let s=fixture({age:18,cash:0,wage:0});s.stats.health=70;
 const display={esc:String,money:n=>`¥${n/100}`};
 for(let day=1;day<=4;day++){
  const step=advanceChapterStep(s,catalog,chapterTrip(s),{settleDay:true});s=save(step.state);
  assert.equal(s.stats.health,70-day*10);assert.equal(s.survival.hungryDays,day);
  assert.equal(s.survival.unpaidDays,day);assert.equal(s.survival.last.healthLost,10);
  assert.equal(s.survival.last.foodPaid,0);assert.equal(step.trip.changes.health,-10);
  assert.equal(s.chapterSummary.lastFood.healthLost,10);
  const html=renderChapterReceipt(s,step.trip,display);
  assert.match(html,/上次伙食已付 ¥0 \/ ¥20/);assert.match(html,/缺食扣健康 <strong>−10/);
 }
 assert.equal(getSurvivalStatus(s).needsCare,true);
 assert.equal(advanceChapterStep(s,catalog,chapterTrip(s),{settleDay:true}).stop.kind,'health');
 const snapshot=structuredClone(s.chapterSummary);s.survival.last.foodPaid=2000;s.survival.last.healthLost=0;
 assert.match(renderChapterReceipt(s,snapshot,display),/缺食扣健康 <strong>−10/);
 for(const value of [-1,11,NaN]){const bad=structuredClone(s);bad.chapterSummary.lastFood.healthLost=value;assert.throws(()=>save(bad));}
});
test('paying for food interrupts consecutive hunger without clearing rent arrears or restoring health',()=>{
 let s=fixture({age:18,cash:0,wage:0});s.stats.health=80;
 for(let day=0;day<2;day++)s=advanceChapterStep(s,catalog,chapterTrip(s),{settleDay:true}).state;
 s.cash=1000;s=advanceChapterStep(save(s),catalog,chapterTrip(s),{settleDay:true}).state;
 assert.equal(s.stats.health,55);assert.equal(s.survival.last.healthLost,5);assert.equal(s.survival.hungryDays,3);
 s.cash=2000;s=advanceChapterStep(save(s),catalog,chapterTrip(s),{settleDay:true}).state;
 assert.equal(s.stats.health,55);assert.equal(s.survival.hungryDays,0);assert.equal(s.survival.unpaidDays,4);
 assert.equal(s.survival.last.foodPaid,2000);assert.equal(s.survival.last.healthLost,0);
 assert.deepEqual(save(s),s);
 s.cash=0;const stopped=advanceChapterStep(s,catalog,chapterTrip(s));
 assert.equal(stopped.trip.days,0);assert.equal(stopped.trip.lastFood,undefined);
 assert.doesNotMatch(renderChapterReceipt(s,stopped.trip,{esc:String,money:String}),/food-settlement-result/);
});
test('unpaid living debt does not trap a fully billed period or charge its living costs twice',()=>{
 let s=fixture({age:18,cash:0,wage:0});s=go(s,{type:'chapter_days',days:1,acceptDebt:true});
 s.survival.days=180;s.survival.livingAccrued=1800000;s.debtClock.day=s.debtClock.periodDays=180;
 const oldDebt=getMetrics(s).debt,oldAccrued=s.ledger.filter(e=>e.label==='基本生活费欠款'&&e.account==='cash').reduce((n,e)=>n+e.amount,0);
 assert.equal(advanceChapterStep(s,catalog,chapterTrip(s)).stop.kind,'bill');
 const html=renderChapterPlan(s,{esc:String,money:String});assert.match(html,/进入下一账期 · 保留欠款/);
 const next=advanceChapterStep(s,catalog,chapterTrip(s),{settleDay:true}).state;
 assert.equal(next.age,18.5);assert.equal(next.debtClock.periodDays,0);assert.ok(getMetrics(next).debt>=oldDebt);
 assert.equal(next.ledger.filter(e=>e.label==='基本生活费欠款'&&e.account==='cash').reduce((n,e)=>n+e.amount,0),oldAccrued);
 assert.equal(next.cash,0);assert.equal(next.actionPoints,2);assert.deepEqual(save(next),next);
});
test('fatigue crossing 65 during today work reduces the quoted wage before deciding to fast forward',()=>{
 const s=fixture({cash:0,wage:540000});s.behavior.fatigue=60;const n=go(s);
 assert.equal(n.debtClock.day,0);assert.equal(n.cash,0);assert.equal(n.behavior.fatigue,60);assert.equal(n.lastResult.chapterRun.kind,'living');
});
test('a due bill without enough cash interrupts before payment, affordable bills settle once',()=>{
 let s=applyEffects(fixture(),[{op:'loan',principal_yuan:3600,apr_bps:1200,term_months:12,purpose:'approved_use'}],{profile:'bank'}).state;
 s.debts[0].calendar.nextDay=1;s.cash=19000;s.monthlyIncome=0;let n=go(s);assert.equal(n.debtClock.day,0);assert.equal(n.lastResult.chapterRun.kind,'bill');assert.deepEqual(n.debts,s.debts);
 s.cash=1e6;n=go(s,{type:'chapter_days',days:1});assert.equal(n.lifeArcs.audit.repaid,33600);assert.equal(n.debts[0].calendar.nextDay,31);
 const after=go(save(n),{type:'chapter_days',days:1});assert.equal(after.lifeArcs.audit.repaid,33600);
});
test('pending decisions, appointments and overdue work stories remain playable rather than being chosen silently',()=>{
 for(const update of [s=>s.behavior.pending='tilt',s=>s.lifeArcs.pending='request',s=>s.dayRoutine.pending='coworker',s=>s.phase='event']){
  const s=fixture();update(s);const n=advanceChapterStep(s,catalog,chapterTrip(s));assert.ok(n.stop);assert.equal(n.state,s);assert.equal(n.state.rng,s.rng);
 }
 const s=fixture();s.lifeArcs.promises.push({id:'N01',day:2,status:'open'});const n=go(s);assert.equal(n.debtClock.day,1);assert.equal(n.lastResult.chapterRun.kind,'promise');assert.equal(n.lifeArcs.promises[0].status,'open');
 const w=fixture();w.workStories.wu={stage:'review',due:0};const after=go(w);assert.equal(after.dayRoutine.pending,'wu_review');assert.equal(after.debtClock.day,0);assert.deepEqual(save(after),after);
});
test('saved oversleep interrupts before the next bill and still skips the whole morning',()=>{
 let s=go(fixture(),{type:'calendar_day'});s.dayRoutine.nextWakeLate=true;const n=go(save(s));
 assert.equal(n.dayRoutine.stage,2);assert.equal(n.dayRoutine.pending,'overslept_work');assert.equal(n.trading.phase,1);assert.equal(n.survival.livingAccrued,s.survival.livingAccrued);
});
test('chapter simulation accepts zero experience days and rejects invalid chunks',()=>{
 const s=fixture();assert.equal(lifeChapter(go(s,{type:'chapter_days',days:1})).experienced,3);
 for(const days of [-1,0,31,Infinity,1.5])assert.equal(getActionAvailability(s,{type:'chapter_days',days}).allowed,false);
 s.chapterPace.experienced=0;assert.equal(getActionAvailability(s,{type:'chapter_days',days:1}).allowed,true);
 const n=go(s,{type:'calendar_day'});assert.equal(lifeChapter(n).experienced,1);
 const archived=save({...n,age:26});assert.equal(lifeChapter(archived).experienced,0);assert.equal(archived.chapterPace.start,25);
});
test('a chapter receipt balances, survives reload and offers actionable living-expense recovery',()=>{
 const s=fixture({age:18,cash:12000,wage:0}),step=advanceChapterStep(s,catalog,chapterTrip(s));
 const r=step.trip;assert.equal(r.days,1);assert.equal(r.spending,10000);assert.equal(r.cash,r.income-r.spending);assert.equal(r.kind,'living');assert.deepEqual(save(step.state),step.state);
 const ctx={esc:String,money:n=>'¥'+n/100};const before=structuredClone(step.state);
 assert.match(renderChapterReceipt(step.state,r,ctx),/data-action="rescue-options"/);assert.match(renderChapterEntry(step.state,ctx),/回到阶段安排/);assert.match(renderChapterPlan(step.state,ctx),/安排生活费/);assert.deepEqual(step.state,before);
 for(const change of [n=>n.chapterPace.experienced=9,n=>n.chapterSummary.days=-1,n=>n.chapterSummary.spending=Infinity]){const n=structuredClone(step.state);change(n);assert.throws(()=>save(n));}
});
test('fully paid billing periods advance the chapter without billing the same days again; new stories stop it',()=>{
 let s=fixture({age:18,wage:0,cash:1e8}),trip=chapterTrip(s);
 // Rich, unemployed fixture: isolate period rollover from job interruptions.
 for(let guard=0;s.debtClock.periodDays<180&&guard<40;guard++){
  const step=advanceChapterStep(s,catalog,trip);s=step.state;trip=step.trip;
  assert.notEqual(step.stop?.kind,'error',step.stop?.reason);
  if(s.lifeArcs.pending||s.behavior.pending)assert.fail('Unexpected fixture decision: '+JSON.stringify(step.stop));
 }
 assert.equal(s.debtClock.periodDays,180);assert.equal(s.survival.livingAccrued,1800000);
 const billed=s.ledger.length,beforeCash=s.cash,step=advanceChapterStep(save(s),catalog,trip);
 assert.equal(step.state.age,18.5);assert.equal(step.state.debtClock.periodDays,0);assert.equal(lifeChapter(step.state).experienced,3);
 assert.equal(step.state.ledger.slice(billed).filter(e=>e.label==='基本生活费欠款').reduce((sum,e)=>sum+e.amount,0),0);
 assert.equal(step.trip.cash,step.trip.income-step.trip.spending);assert.equal(step.state.cash-beforeCash,step.state.ledger.slice(billed).filter(e=>e.account==='cash').reduce((sum,e)=>sum+e.amount,0));
 assert.deepEqual(save(step.state),step.state);
 let last=step;
 for(let i=0;last.state.age<19&&i<40;i++){
  for(let g=0;['event','result'].includes(last.state.phase)&&g<10;g++){
   const blocked=advanceChapterStep(last.state,catalog,last.trip);assert.equal(blocked.trip.days,last.trip.days);
   if(last.state.phase==='result')last.state=continueStory(last.state,catalog);
   else {const event=catalog.events.find(e=>e.id===last.state.activeEvent.eventId),choice=eligibleChoices(last.state,event).find(c=>!c.disabled&&['observe','family','rest','research'].includes(c.profile))||eligibleChoices(last.state,event).find(c=>!c.disabled);last.state=chooseEvent(last.state,event.id,choice.id,catalog);assert.equal(last.state.lastResult.error,undefined);}
  }
  assert.equal(last.state.phase,'planning');last=advanceChapterStep(last.state,catalog,last.trip);assert.notEqual(last.stop?.kind,'error',last.stop?.reason);
 }
 assert.equal(last.state.age,19);assert.equal(last.trip.days,360);assert.equal(lifeChapter(last.state).experienced,0);
 assert.ok(['complete','event'].includes(last.stop.kind));assert.deepEqual(save(last.state),last.state);
 const stopped=advanceChapterStep(last.state,catalog,last.trip);assert.equal(stopped.state,last.state);assert.equal(stopped.trip.days,last.trip.days);
});
test('a price move and a daily contract expiry pause with real holdings and a balanced ledger',()=>{
 let s=fixture();s.dayRoutine.stage=1;s.trading.phase=0;
 s=go(s,{type:'desk_order',product:'stock',instrument:'chip',shares:100,amount:quoteFor(s,'stock','chip').price*100});
 const id=s.positions[0].id,before=s.positions[0].value;
 for(let i=0;i<6;i++){
  const n=go(s);s=n;
  if(n.lastResult.chapterRun.kind==='position')break;
 }
 assert.equal(s.lastResult.chapterRun.kind,'position');assert.ok(Math.abs(s.positions.find(p=>p.id===id).value-before)>=before*.2);
 let future=fixture();future=go(future,{type:'desk_order',product:'crypto_perp',instrument:'BTCUSDT',amount:100000,leverage:1000,direction:'long'});
 let n=future;for(let i=0;i<4&&n.positions.some(p=>p.kind==='crypto_perp');i++)n=go(n);assert.equal(n.positions.some(p=>p.kind==='crypto_perp'),false);assert.equal(n.lastResult.chapterRun.kind,'position');assert.ok(n.debtClock.day<=1);assert.deepEqual(save(n),n);
});
test('montage follows identity and time without replaying a stale activity or mutating the save',()=>{
 const s=fixture(),before=structuredClone(s),worker=chapterMontageShots(s);assert.equal(worker[1].key,'work');assert.equal(worker[2].key,'bedtime');assert.deepEqual(s,before);
 s.monthlyIncome=0;s.age=18;s.education.college=true;s.occupation='大学生';assert.equal(chapterMontageShots(s)[1].key,'study-day');
 s.education.college=false;s.age=65;s.occupation='退休';assert.equal(chapterMontageShots(s)[1].key,'outside');
});
test('a five-year late chapter can finish through bounded batches and ends at 80 with all days billed',()=>{
 const quietCatalog={...catalog,events:[],history:[]};
 let s=fixture({age:75,wage:0,cash:1e9}),trip=chapterTrip(s),step;
 s.household.livingParent=false;s.lifeArcs.seen.push('legacy');s.occupation='退休';
 for(let i=0;s.age<80&&i<130;i++){
  step=advanceChapterStep(s,quietCatalog,trip);assert.notEqual(step.stop?.kind,'error',step.stop?.reason);s=step.state;trip=step.trip;
  assert.equal(s.phase==='event',false);assert.equal(s.lifeArcs.pending,null);assert.equal(s.behavior.pending,null);
 }
 assert.equal(s.age,80);assert.equal(trip.days,1800);assert.equal(trip.cash,trip.income-trip.spending);assert.ok(['complete','ended'].includes(step.stop.kind));assert.deepEqual(save(s),s);
});

import {stageOptions,stagePlan,applyStageShift,settleStageFocus} from '../src/game/stage-plan.js';
import {DAILY_EVENTS,dayGigPay} from '../src/game/day-routine.js';
import {renderPeriodConsole} from '../src/ui/readability.js';
const ctx={esc:String,money:n=>'¥'+n/100,icon:()=>'',ageText:String};
function student(){const s=fixture({age:18,wage:0});s.education.college=true;s.flags.college_student=true;s.flags.college_not_admitted=false;s.occupation='大学生';return s;}
const chooseFocus=(s,focus)=>go(s,{type:'stage_plan',focus});
function passDays(s,days){const target=s.debtClock.day+days;for(let i=0;s.debtClock.day<target&&i<60;i++){
 if(s.dayRoutine.pending){const choice=DAILY_EVENTS[s.dayRoutine.pending].choices.find(c=>getActionAvailability(s,{type:'day_event_choice',choice:c[0]}).allowed);s=go(s,{type:'day_event_choice',choice:choice[0]});}
 else s=go(s,{type:'chapter_days',days:Math.min(30,target-s.debtClock.day)});
 }assert.equal(s.debtClock.day,target);return s;}
test('stage choices match student, worker and retired identities without affecting cash or RNG',()=>{
 const s=student(),before=structuredClone(s);assert.match(stageOptions(s).find(o=>o.id==='parttime').title,/课余/);
 let n=chooseFocus(s,'study');for(const focus of ['social','recover','study','steady','study'])n=chooseFocus(n,focus);
 assert.equal(n.cash,s.cash);assert.equal(n.rng,s.rng);assert.deepEqual(n.stats,s.stats);assert.equal(n.debtClock.day,s.debtClock.day);assert.equal(n.actionPoints,s.actionPoints);assert.deepEqual(s,before);assert.deepEqual(save(n),n);
 const retired=fixture({age:65});retired.occupation='退休';assert.equal(stageOptions(retired).some(o=>o.id==='parttime'),false);assert.equal(getActionAvailability(retired,{type:'stage_plan',focus:'parttime'}).allowed,false);
});
test('stage study accrues only on completed automatic days, survives reload and has no switching reward exploit',()=>{
 const base=student();let a=chooseFocus(base,'study'),b=chooseFocus(base,'steady');
 a=passDays(a,29);b=passDays(b,29);assert.equal(a.stats.academic,Math.min(100,b.stats.academic+58));
 a=chooseFocus(save(a),'social');a=chooseFocus(a,'study');a=passDays(a,1);b=passDays(b,1);
 assert.equal(a.stats.academic,Math.min(100,b.stats.academic+60));assert.equal(a.stats.discipline,b.stats.discipline);
 assert.equal(stagePlan(a).counts.study,30);assert.equal(a.survival.livingAccrued,180000);assert.equal(a.cash,b.cash);
 const n=chooseFocus(a,'study');assert.deepEqual(n.stats,a.stats);assert.equal(stagePlan(n).counts.study,30);
});
test('a pre-bill pause applies no focus rewards and cannot farm recovery at zero cash',()=>{
 let s=fixture({cash:0,wage:0});s=chooseFocus(s,'recover');s.stagePlan.counts.recover=6;const n=go(s);
 assert.equal(n.debtClock.day,s.debtClock.day);assert.equal(n.stats.health,s.stats.health);assert.equal(n.stagePlan.counts.recover,6);assert.equal(n.lastResult.chapterRun.kind,'living');
});
test('explicit part-time plan earns a real evening wage once, respects manual shift choices and fatigue',()=>{
 let s=chooseFocus(student(),'parttime');s.debtClock.day=s.debtClock.periodDays=1;s.stagePlan.lastDay=1;const cash=s.cash,amount=dayGigPay(s);
 let n=go(s,{type:'chapter_days',days:1});assert.equal(n.ledger.filter(e=>e.label==='晚班零工收入').length,1);
 assert.equal(n.cash,cash+amount+200000-6000);assert.equal(n.survival.last.support,200000);assert.equal(n.stats.health,s.stats.health-1);assert.equal(n.workday.units,1);
 n=save(n);const after=go(n,{type:'chapter_days',days:1});assert.equal(after.ledger.filter(e=>e.label==='晚班零工收入').length,1);
 const occupied=structuredClone(s);occupied.dayRoutine.stage=6;occupied.dayRoutine.choices[5]='rest';assert.equal(go(occupied,{type:'chapter_days',days:1}).ledger.some(e=>e.label==='晚班零工收入'),false);
 const tired=structuredClone(s);tired.behavior.fatigue=65;const paid=go(tired,{type:'chapter_days',days:1});assert.equal(paid.ledger.find(e=>e.label==='晚班零工收入').amount,Math.floor(amount*.75));
});
test('projected part-time income allows an affordable day but does not invent cash before completing it',()=>{
 let s=chooseFocus(student(),'parttime');s.debtClock.day=s.debtClock.periodDays=1;s.stagePlan.lastDay=1;s.cash=6000-dayGigPay(s);
 // This month's family allowance was already received and spent: isolate the shift's cash gap.
 s.collegeSupport={version:1,lastPaidMonth:'2006-01',totalPaid:200000};
 const n=go(s,{type:'chapter_days',days:1});assert.equal(n.cash,0);assert.equal(n.debtClock.day,2);assert.equal(n.survival.unpaidDays,0);
 const poor=structuredClone(s);poor.cash--;const stopped=go(poor,{type:'chapter_days',days:1});assert.equal(stopped.cash,poor.cash);assert.equal(stopped.debtClock.day,poor.debtClock.day);assert.equal(stopped.workday,undefined);
});
test('ordinary life presents a representative stage event and resumes the same plan without silently choosing it',()=>{
 const s=chooseFocus(student(),'steady');s.debtClock.day=s.debtClock.periodDays=59;s.stagePlan.lastDay=59;const n=go(s);assert.equal(n.debtClock.day,60);assert.ok(n.dayRoutine.pending);assert.equal(n.lastResult.chapterRun.kind,'event');assert.equal(n.dayRoutine.stage,3);assert.equal(n.trading.phase,1);
 const same=advanceChapterStep(save(n),catalog,chapterTrip(n));assert.equal(same.state.debtClock.day,60);assert.equal(same.state.dayRoutine.pending,n.dayRoutine.pending);
 const chosen=DAILY_EVENTS[n.dayRoutine.pending].choices.find(c=>getActionAvailability(n,{type:'day_event_choice',choice:c[0]}).allowed)[0];
 const done=go(n,{type:'day_event_choice',choice:chosen}),continued=go(save(done),{type:'chapter_days',days:1});assert.equal(continued.debtClock.day,61);assert.equal(continued.dayRoutine.pending,null);assert.equal(stagePlan(continued).focus,'steady');
});
test('stage mode preserves the next-day attendance decision after staying up',()=>{
 const s=chooseFocus(fixture(),'steady');s.dayRoutine.nightStreak=1;const n=go(s);
 assert.equal(n.lastResult.chapterRun.kind,'attendance');assert.equal(n.debtClock.day,0);assert.equal(n.cash,s.cash);
 const answered=go(n,{type:'day_activity',choice:'breakfast'});assert.equal(passDays(answered,1).debtClock.day,1);
});
test('main life surface offers one stage advance, hides routine stepping, and keeps detailed days and events available',()=>{
 const s=chooseFocus(student(),'study'),before=structuredClone(s),html=renderPeriodConsole(s,ctx,true,true);
 assert.match(html,/按安排快进/);assert.match(html,/展开今天/);assert.match(html,/多花心思学习/);assert.doesNotMatch(html,/体验日|安排几天作息|data-action="day-continue"|data-kind="day_activity"/);
 const detail=renderPeriodConsole(s,{...ctx,detailedDay:true},true,true);assert.match(detail,/data-kind="day_activity"/);assert.match(detail,/回到阶段安排/);assert.deepEqual(s,before);
 s.dayRoutine.pending='family';assert.match(renderPeriodConsole(s,ctx,true,true),/daily-event-title/);
});
test('focus plans reject malformed saves and reset selection at a new chapter without resetting money',()=>{
 const s=chooseFocus(fixture(),'study');for(const update of [n=>n.stagePlan.focus='win',n=>n.stagePlan.lastDay=Infinity,n=>n.stagePlan.counts.study=-1,n=>n.stagePlan.start=99]){const n=structuredClone(s);update(n);assert.throws(()=>save(n));}
 const old=save({...s,age:26});assert.equal(stagePlan(old),null);assert.equal(old.cash,s.cash);const chosen=chooseFocus(old,'social');assert.deepEqual(chosen.stagePlan.counts,{});assert.deepEqual(save(chosen),chosen);
});

import {stageScene} from '../src/ui/stage-scene.js';
test('unselected chapter scenes follow identity without choosing a focus or changing the saved clock',()=>{
 const college=student(),employee=fixture(),jobseeker=fixture({wage:0}),owner=fixture({wage:0}),retired=fixture({age:65});
 college.age=19;
 owner.businesses=[{name:'自己的小店'}];retired.occupation='退休';
 for(const [s,key] of [[college,'college'],[employee,'work'],[jobseeker,'job-search'],[owner,'gig'],[retired,'outside']]){
  for(const slot of [0,2,6]){
   resetRoutineDay(s,slot);const before=structuredClone(s),scene=stageScene(s);
   assert.equal(scene.key,key);assert.ok(scene.title);assert.ok(scene.line);assert.equal(scene.night,false);
   assert.equal(stagePlan(s),null);assert.deepEqual(s,before);
  }
 }
 const resumed=save(college);assert.equal(stageScene(resumed).key,'college');assert.deepEqual(resumed,college);
 const next=chooseFocus(student(),'recover');next.age=19;assert.equal(stagePlan(next),null);assert.equal(stageScene(next).key,'college');
 college.dayRoutine.pending='overslept_class';college.dayRoutine.stage=2;assert.equal(stageScene(college).title,'睡过头了');
 for(const phase of ['event','result','ended']){employee.phase=phase;assert.equal(stageScene(employee),null);}
});
test('campus arrival is only the first college chapter entry, before a focus or any lived days',()=>{
 const s=student(),before=structuredClone(s),scene=stageScene(s);
 assert.equal(scene.key,'campus-arrival');assert.match(scene.title,/踏入大学/);assert.equal(scene.night,false);
 assert.ok(readFileSync(new URL('../'+scene.src,import.meta.url)).length>0);assert.deepEqual(s,before);
 assert.equal(stageScene(save(s)).key,'campus-arrival');
 assert.equal(stageScene(chooseFocus(s,'steady')).key,'college');
 const later=structuredClone(s);later.debtClock.periodDays=1;assert.equal(stageScene(later).key,'college');
 const worker=fixture({age:18});assert.equal(stageScene(worker).key,'work');
 s.dayRoutine.pending='overslept_class';s.dayRoutine.stage=2;assert.equal(stageScene(s).title,'睡过头了');
});
test('stage illustration represents the selected life focus while event art and the real trading clock stay intact',()=>{
 const s=chooseFocus(student(),'study'),before=structuredClone(s),scene=stageScene(s);assert.equal(scene.key,'study-day');assert.equal(s.dayRoutine.stage,0);assert.match(scene.line,/课后/);assert.deepEqual(s,before);
 const w=chooseFocus(fixture(),'market');assert.equal(stageScene(w).key,'slack');
 const retired=fixture({age:65});retired.occupation='退休';const r=chooseFocus(retired,'recover');assert.equal(stageScene(r).key,'rest');
 s.dayRoutine.pending='overslept_class';s.dayRoutine.stage=2;s.dayRoutine.wakeKind='late';assert.equal(stageScene(s).title,'睡过头了');
});
test('a selected stage reaches its next age through real bills and explicit events, then requires a new focus',()=>{
 let s=chooseFocus(fixture({age:18,wage:0,cash:1e8}),'steady'),trip=chapterTrip(s),events=0;
 for(let i=0;s.age<19&&i<100;i++){
  if(s.dayRoutine.pending){events++;const choice=DAILY_EVENTS[s.dayRoutine.pending].choices.find(c=>getActionAvailability(s,{type:'day_event_choice',choice:c[0]}).allowed);s=go(s,{type:'day_event_choice',choice:choice[0]});continue;}
  const step=advanceChapterStep(s,{...catalog,events:[],history:[]},trip);assert.notEqual(step.stop?.kind,'error',step.stop?.reason);s=step.state;trip=step.trip;
 }
 assert.equal(s.age,19);assert.ok(events<=3&&events>=1);assert.equal(trip.days,360);assert.equal(stagePlan(s),null);assert.deepEqual(save(s),s);
 assert.equal(s.ledger.filter(e=>e.label==='基本生活费欠款').reduce((n,e)=>n-e.amount,0),3600000);
});
