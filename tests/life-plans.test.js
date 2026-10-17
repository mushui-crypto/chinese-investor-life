import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {applyAction,applyEffects,advanceTurn,getMetrics,getActionAvailability,getSurvivalStatus} from '../src/game/core.js';
import {livingCostBreakdown} from '../src/game/living-costs.js';
import {livingPlan,livingPlanEffects} from '../src/game/living-plan.js';
import {routinePlan,plannedActivity} from '../src/game/routine-plan.js';
import {ensureRoutine,resetRoutineDay,DAILY_EVENTS,arriveRoutineSlot,dailyEventPool} from '../src/game/day-routine.js';
import {WORK_STORY_EVENTS,workStoryReady} from '../src/game/work-stories.js';
import {newLifeArcs,rebuildOffers} from '../src/game/life-arcs.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
import {hasMetPerson} from '../src/game/people.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const x=JSON.parse(fs.readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?x.events:x;}setSaveCatalog(catalog);
export function fixture(seed='life-plan',cash=1000000,wage=300000){
 const s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age:18,turn:11,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:wage,occupation:wage?'普通职员':'待业青年',giftReceived:true});
 s.stats.skill=40;s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];s.behavior.pending=null;s.behavior.seen=Object.keys(BEHAVIOR_EVENTS);s.education.college=false;s.flags.college_student=false;s.flags.college_not_admitted=true;ensureRoutine(s);resetRoutineDay(s);return s;
}
const step=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult.error,undefined,n.lastResult.error);assert.equal(n.cash-s.cash,n.ledger.slice(s.ledger.length).filter(e=>e.account==='cash').reduce((v,e)=>v+e.amount,0));return n;};
const save=s=>decodeSave(encodeSave(s));
const budget=(s,housing='shared',food='cook')=>step(s,{type:'living_plan',housing,food,cutExtras:false});
const run=(s,days=7,smallEvents='habit')=>step(s,{type:'routine_days',days,smallEvents,evening:'rest'});
const doneStories=s=>{s.workStories={zhou:{stage:'done',due:0},wu:{stage:'done',due:0}};return s;};
function answer(s){if(s.dayRoutine.pending)s=step(s,{type:'day_event_choice',choice:DAILY_EVENTS[s.dayRoutine.pending].choices.at(-1)[0]});if(s.behavior.pending)s=step(s,{type:'behavior_choice',choice:'later'});return s;}

test('older saves retain baseline costs and reading plan defaults is inert',()=>{
 const s=fixture(),before=structuredClone(s);assert.equal(livingCostBreakdown(s).total,300000);livingPlan(s);routinePlan(s);assert.deepEqual(s,before);assert.deepEqual(save(s),s);
 for(const age of [18,25,35,45,55,65]){s.age=age;assert.ok(livingCostBreakdown(s).total>=300000);}
});
test('zero-cash worker can reduce expenses but still needs actual cash before payday',()=>{
 const s=fixture('zero',0,260000);assert.ok(getSurvivalStatus(s).active);const n=budget(s);assert.equal(n.cash,0);assert.equal(n.actionPoints,1);assert.equal(livingCostBreakdown(n).base,300000);assert.equal(getMetrics(n).monthlyExpense,240000);assert.equal(getSurvivalStatus(n).active,true);assert.deepEqual(save(n),n);
 assert.equal(getActionAvailability(n,{type:'living_plan',housing:'shared',food:'cook',cutExtras:false}).allowed,false);
});
test('housing changes charge real moving costs once, enforce cooldown and preserve family costs',()=>{
 const s=fixture('housing'),n=budget(s,'outskirts');assert.equal(n.cash,s.cash-50000);assert.equal(getMetrics(n).monthlyExpense,240000);assert.match(getActionAvailability(n,{type:'living_plan',housing:'shared',food:'cook',cutExtras:false}).reason,/30 天/);
 const poor=fixture('poor',49999);assert.match(getActionAvailability(poor,{type:'living_plan',housing:'outskirts',food:'cook',cutExtras:false}).reason,/500/);
 const family=structuredClone(n);family.household.partner=true;family.household.hasChild=true;assert.equal(getMetrics(family).monthlyExpense,530000);family.legal.prisonMonthsLeft=1;assert.equal(livingCostBreakdown(family).home,0);
});
test('cost changes never refund prior days or double charge during compressed settlement',()=>{
 let s=step(fixture(),{type:'calendar_day'});assert.equal(s.survival.livingAccrued,10000);const cash=s.cash;s=budget(s);assert.equal(s.cash,cash);s=step(s,{type:'market_day'});s=step(s,{type:'calendar_day'});assert.equal(s.survival.livingAccrued,18000);
 const before=structuredClone(s),out=advanceTurn(s);assert.equal(out.result.error,undefined);const charge=out.state.ledger.slice(before.ledger.length).find(e=>e.label==='基本生活费欠款');assert.equal(-charge.amount,240000*178/30);assert.deepEqual(save(out.state),out.state);
});
test('saving choices apply their costs to stress and fatigue, with no commute for unemployed or retired',()=>{
 for(const [housing,working,stress,fatigue] of [['shared',true,2,3],['outskirts',true,0,9],['outskirts',false,0,3]]){
  const s=fixture();s.livingPlan={housing,food:'cook',movedDay:0};const old=s.stats.stress,oldF=s.behavior.fatigue;livingPlanEffects(s,1,{stat:(s,d)=>{for(const [k,n] of Object.entries(d))s.stats[k]+=n;}},{worked:working});assert.equal(s.stats.stress-old,stress);assert.equal(s.behavior.fatigue-oldF,fatigue);
 }
});
test('routine uses the manual engine and stops at the identical first event',()=>{
 const s=fixture('manual-equality');const automated=run(s,7,'pause');let manual=structuredClone(s),n=0;
 while(n++<automated.lastResult.routineRun.steps)manual=step(manual,plannedActivity(manual,{evening:'rest'}));
 for(const key of ['cash','stats','rng','dayRoutine','survival','debtClock','trading','ledger','relationships','workStories'])assert.deepEqual(automated[key],manual[key],key);
 assert.ok(automated.dayRoutine.pending);assert.equal(automated.lastResult.routineRun.handled.length,0);assert.deepEqual(save(automated),automated);
});
test('routine cannot silently resolve a pending event, and declared habits leave a receipt',()=>{
 const s=doneStories(fixture('habits'));s.dayRoutine.pending='coworker';const before=structuredClone(s);assert.ok(applyAction(s,{type:'routine_days',days:7,evening:'rest',smallEvents:'habit'}).result.error);assert.deepEqual(s,before);s.dayRoutine.pending=null;
 const n=run(s);assert.ok(n.lastResult.routineRun.handled.length>0);assert.ok(n.lastResult.days>0);assert.ok(n.lastResult.days<=7);assert.ok(n.lastResult.routineRun.handled.every(h=>typeof h.choice==='string'));assert.ok(n.logs.length-s.logs.length<n.lastResult.routineRun.steps);assert.ok(n.logs.at(-1).text.includes(n.lastResult.routineRun.handled[0].choice));assert.deepEqual(save(n),n);
});
test('ordinary worker with a cash buffer can reach payday without borrowing or gambling',()=>{
 let s=budget(doneStories(fixture('ordinary-month',320000,320000))),attempts=0;
 while(s.debtClock.day<30&&attempts++<60){s=run(s,30-s.debtClock.day);if(s.dayRoutine.pending)s=answer(s);assert.equal(s.survival.failed,false);if(getSurvivalStatus(s).active)break;}
 assert.equal(s.debtClock.day,30);assert.ok(s.cash>0);assert.equal(s.debts.length,0);assert.equal(s.positions.length,0);assert.equal(s.survival.salaryPaid,0);assert.ok(s.payroll.pending[0].net>0);assert.equal(s.survival.livingAccrued,240000);assert.ok(s.cash<=80000,'first-month salary remains pending');assert.deepEqual(save(s),s);
});
test('routine stops before tomorrow repayment and preserves the current time',()=>{
 const s=applyEffects(fixture(),[{op:'loan',principal_yuan:1000,apr_bps:800,term_months:12,purpose:'临时周转'}]).state;s.debts[0].calendar.nextDay=1;const r=applyAction(s,{type:'routine_days',days:7,evening:'rest',smallEvents:'habit'});assert.equal(r.result.days,0);assert.equal(r.state.debtClock.day,0);assert.equal(r.state.dayRoutine.stage,0);assert.match(r.result.text,/还款/);
});
test('routine retains already chosen late nights instead of erasing their health cost',()=>{
 let s=doneStories(fixture());resetRoutineDay(s,6);s.trading.phase=2;s=step(s,{type:'day_activity',choice:'stay'});const hp=s.stats.health,n=run(s,1);assert.equal(n.dayRoutine.nightStreak,1);assert.equal(n.stats.health,hp-1);assert.equal(n.survival.days,1);
});
test('due workplace followups get priority, introduce only their visible person, and wait until due',()=>{
 const s=fixture();s.workStories={zhou:{stage:'return',due:3}};s.debtClock.day=2;resetRoutineDay(s,2);arriveRoutineSlot(s,{draw:()=>.99});assert.equal(s.dayRoutine.pending,null);
 s.debtClock.day=3;arriveRoutineSlot(s,{draw:()=>.99});assert.equal(s.dayRoutine.pending,'zhou_return');assert.ok(hasMetPerson(s,'N04'));assert.equal(hasMetPerson(s,'N12'),false);assert.deepEqual(save(s),s);
});
function choose(s,id,choice){s.dayRoutine.pending=id;const e=WORK_STORY_EVENTS[id];s.dayRoutine.stage=e.stages[0];if(e.storyStage!=='new')s.debtClock.day=s.workStories[e.chain].due;return step(save(s),{type:'day_event_choice',choice});}
test('helping an old colleague returns days later, changes memory and unlocks his actual referral',()=>{
 let s=fixture();s.relationships.N04=50;s=choose(s,'zhou_cover','help');assert.equal(s.workStories.zhou.due,3);assert.equal(dailyEventPool(s).includes('zhou_cover'),false);s=choose(s,'zhou_return','learn');assert.equal(s.relationships.N04,55);s.monthlyIncome=0;s.occupation='待业';assert.ok(rebuildOffers(s).find(o=>o.id==='referral').allowed);s=choose(s,'zhou_request','help');assert.equal(s.dayRoutine.choices[5],'friends');const cash=s.cash;s=choose(s,'zhou_thanks','accept');assert.equal(s.cash-cash,8000);assert.equal(s.lifeArcs.memories.N04.length,4);assert.equal(workStoryReady(s,'zhou_thanks'),false);assert.deepEqual(save(s),s);
});
test('work error has separate honest, rushed and concealed endings with bounded one-off cash consequences',()=>{
 let honest=choose(fixture(),'wu_error','report');assert.equal(honest.workStories.wu.stage,'review');honest=choose(honest,'wu_review','check');const cash=honest.cash;honest=choose(honest,'wu_bonus','accept');assert.equal(honest.cash-cash,15000);assert.equal(honest.workStories.wu.stage,'done');assert.ok(hasMetPerson(honest,'N12'));assert.deepEqual(save(honest),honest);
 let rushed=choose(fixture(),'wu_error','report');rushed=choose(rushed,'wu_review','rush');assert.equal(rushed.workStories.wu.stage,'rework');rushed=choose(rushed,'wu_rework','repair');assert.equal(rushed.cash,1000000);
 let hidden=choose(fixture('broke',0),'wu_error','hide');hidden=choose(hidden,'wu_audit','argue');assert.equal(hidden.cash,0);assert.equal(getMetrics(hidden).debt,5000);assert.equal(hidden.lifeArcs.memories.N12.length,2);assert.deepEqual(save(hidden),hidden);
});
test('habit mode always pauses for a due character followup',()=>{
 const s=fixture();s.workStories={wu:{stage:'review',due:0}};const n=run(s);assert.equal(n.dayRoutine.pending,'wu_review');assert.equal(n.dayRoutine.stage,1);assert.equal(n.debtClock.day,0);assert.match(n.lastResult.text,/吴师傅/);assert.equal(n.lastResult.routineRun.handled.length,0);
});
test('invalid optional plan and story state cannot be imported',()=>{
 for(const update of [s=>s.livingPlan={housing:'free',food:'normal',movedDay:0},s=>s.livingPlan={housing:'shared',food:'cook',movedDay:100},s=>s.routinePlan={days:31,evening:'rest',smallEvents:'habit'},s=>s.workStories={zhou:{stage:'return',due:-1}},s=>s.workStories={fake:{stage:'done',due:0}}]){const s=fixture();update(s);assert.throws(()=>save(s));}
});
