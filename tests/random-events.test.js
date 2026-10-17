import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {getActionAvailability} from '../src/game/core.js';
import {EXTRA_DAILY_EVENTS} from '../src/game/daily-events.js';
import {DAILY_EVENTS,ensureRoutine,resetRoutineDay,arriveRoutineSlot,dailyEventPool,dailyEventRole,dailyEventChance} from '../src/game/day-routine.js';
import {EXPENSE_EVENTS} from '../src/game/living-costs.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
import {dailyScene} from '../src/ui/daily-scene.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?d.events:d;}setSaveCatalog(catalog);
function fixture(role='employed',stage=1){
 const s=createRun({seed:'expanded-events',familyId:'F01'},catalog);
 Object.assign(s,{age:role==='student'?20:role==='retired'?67:30,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000,monthlyIncome:role==='employed'||role==='retired'?300000:0,occupation:role==='employed'?'普通职员':role==='retired'?'退休':role==='student'?'大学生':'待业青年'});
 for(const key of Object.keys(s.stats))s.stats[key]=50;
 s.education.college=role==='student';s.flags.college_student=role==='student';s.flags.college_not_admitted=role!=='student';s.flags.crypto_aware=true;s.flags.stock_aware=true;s.household.livingParent=true;s.behavior.heat=50;s.behavior.fatigue=40;s.behavior.pending=null;s.lifeArcs.pending=null;
 if(role==='self')s.businesses.push({id:'encounter-shop',name:'自己的小店',value:500000,monthlyProfit:10000,managedTurn:s.turn,openedTurn:s.turn,openedLifeDay:s.debtClock.day});
 ensureRoutine(s);resetRoutineDay(s,stage);return s;
}
const roundtrip=s=>decodeSave(encodeSave(s));
test('daily pool separates employment, college and retirement and reaches every new eligible event',()=>{
 const reached=new Set();
 for(const role of ['employed','unemployed','student','retired','self'])for(const stage of [0,1,2,3,4,5,6,7,8]){
  const s=fixture(role,stage);if(role==='employed')s.positions.push({});
  assert.equal(dailyEventRole(s),role);
  for(const id of dailyEventPool(s)){
   const e=DAILY_EVENTS[id];reached.add(id);assert.ok(e.stages.includes(stage));assert.ok(!e.roles.length||e.roles.includes(role));assert.ok(!e.when||e.when(s));
  }
 }
 for(const id of Object.keys(EXTRA_DAILY_EVENTS))assert.ok(reached.has(id),id);
 const s=fixture('unemployed',5);s.household.livingParent=false;s.flags.stock_aware=false;s.flags.crypto_aware=false;
 assert.ok(!dailyEventPool(s).includes('family'));assert.ok(!dailyEventPool(s).includes('unread_family'));assert.ok(!dailyEventPool(s).includes('price_alert'));
});
test('each daily choice applies its displayed effects and cash cost once and survives reload',()=>{
 for(const [id,e] of Object.entries(EXTRA_DAILY_EVENTS))for(const [choice] of e.choices){
  let s=fixture(e.roles[0]||'unemployed',e.stages[0]);s.dayRoutine.pending=id;s.dayRoutine.recent=[id];s=roundtrip(s);
  const n=act(s,{type:'day_event_choice',choice},catalog),effect=e.effects[choice];assert.equal(n.lastResult.error,undefined,id);
  for(const [key,delta] of Object.entries(effect.stats))assert.equal(n.stats[key],s.stats[key]+delta,`${id} ${choice} ${key}`);
  assert.equal(n.behavior.fatigue,s.behavior.fatigue+effect.fatigue,id);assert.equal(n.behavior.heat,s.behavior.heat+effect.heat,id);
  assert.equal(n.cash,s.cash-(effect.cost||0),id);assert.equal(n.cash-s.cash,n.ledger.slice(s.ledger.length).filter(x=>x.account==='cash').reduce((sum,x)=>sum+x.amount,0),id);assert.equal(n.dayRoutine.stage,s.dayRoutine.stage,id);assert.equal(n.dayRoutine.pending,null);assert.equal(n.dayRoutine.last,effect.text);
  assert.deepEqual(roundtrip(n),n,id);assert.ok(dailyScene(n)?.key,id);
  const twice=act(n,{type:'day_event_choice',choice},catalog);assert.ok(twice.lastResult.error);assert.deepEqual(twice.stats,n.stats);assert.equal(twice.rng,n.rng);assert.equal(twice.cash,n.cash);
 }
});
test('work shifts get more encounters while off-duty roles keep their existing rate and pool',()=>{
 for(const stage of [1,3]){
  const employed=fixture('employed',stage);assert.equal(dailyEventChance(employed),.4);arriveRoutineSlot(employed,{draw:()=>.3});assert.ok(employed.dayRoutine.pending);
  for(const role of ['unemployed','retired','student']){const s=fixture(role,stage);assert.equal(dailyEventChance(s),.12);arriveRoutineSlot(s,{draw:()=>.3});assert.equal(s.dayRoutine.pending,null);assert.ok(dailyEventPool(s).every(id=>!DAILY_EVENTS[id].roles.includes('employed')));}
  for(const flag of ['leaveDays','jobStartsTomorrow']){const s=fixture('employed',stage);s.behavior[flag]=flag==='leaveDays'?1:true;assert.equal(dailyEventChance(s),.12);assert.ok(dailyEventPool(s).every(id=>!DAILY_EVENTS[id].roles.includes('employed')));}
 }
 const s=fixture('employed',3);s.behavior.fatigue=34;s.flags.stock_aware=false;assert.ok(!dailyEventPool(s).includes('sleepy_shift'));assert.ok(!dailyEventPool(s).includes('office_group_tip'));
 s.behavior.fatigue=35;s.flags.stock_aware=true;assert.ok(dailyEventPool(s).includes('sleepy_shift'));assert.ok(dailyEventPool(s).includes('office_group_tip'));
 assert.equal(dailyEventChance(fixture('employed',2)),.12);
});
test('optional coffee and travel costs cannot overdraft cash or block a free alternative',()=>{
 for(const [event,paid,free,cost] of [['sleepy_shift','coffee','water',1200],['urgent_errand','metro','walk',600]]){
  const s=fixture('employed',1);s.cash=cost-1;s.dayRoutine.pending=event;
  const action={type:'day_event_choice',choice:paid};assert.match(getActionAvailability(s,action).reason,/现金不够/);
  const rejected=act(s,action,catalog);assert.ok(rejected.lastResult.error);assert.equal(rejected.cash,s.cash);assert.deepEqual(rejected.dayRoutine,s.dayRoutine);assert.equal(rejected.rng,s.rng);
  s.cash=0;assert.ok(getActionAvailability(s,{type:'day_event_choice',choice:free}).allowed);const resolved=act(s,{type:'day_event_choice',choice:free},catalog);assert.equal(resolved.dayRoutine.pending,null);assert.equal(resolved.cash,0);
  s.cash=cost;const paidState=act(s,action,catalog);assert.equal(paidState.cash,0);assert.deepEqual(roundtrip(paidState),paidState);
 }
});
test('recent events persist across days, pending choices cannot reroll, and ordinary events cap at one per day',()=>{
 const s=fixture('employed',1),api={draw:()=>0};arriveRoutineSlot(s,api);assert.ok(s.dayRoutine.pending);const first=s.dayRoutine.pending;
 arriveRoutineSlot(s,{draw:()=>{throw Error('pending must not reroll');}});assert.equal(s.dayRoutine.pending,first);
 s.dayRoutine.pending=null;s.dayRoutine.stage=2;arriveRoutineSlot(s,api);assert.equal(s.dayRoutine.pending,null);
 s.trading.day++;resetRoutineDay(s,1);assert.ok(s.dayRoutine.recent.includes(first));arriveRoutineSlot(s,api);assert.notEqual(s.dayRoutine.pending,first);
 const next=roundtrip(s);assert.deepEqual(next.dayRoutine,s.dayRoutine);
 for(let day=0;day<20;day++){s.trading.day++;resetRoutineDay(s,1);const last=s.dayRoutine.recent.at(-1);arriveRoutineSlot(s,api);assert.notEqual(s.dayRoutine.pending,last);assert.ok(s.dayRoutine.recent.length<=6);}
});
test('legacy routines need no history migration and malformed repetition history is rejected',()=>{
 const s=fixture();delete s.dayRoutine.recent;assert.deepEqual(roundtrip(s),s);
 for(const recent of [null,['invalid'],['family','family'],Array(7).fill('family'),[{}]]){const bad=structuredClone(s);bad.dayRoutine.recent=recent;assert.throws(()=>roundtrip(bad));}
});
test('extra expense eligibility respects age and family; charges remain within existing bands',()=>{
 assert.equal(new Set(EXPENSE_EVENTS.map(e=>e.id)).size,EXPENSE_EVENTS.length);
 const s=fixture('unemployed');s.household.hasChild=false;s.stats.health=100;
 for(const id of ['schooltrip','followup','care'])assert.equal(EXPENSE_EVENTS.find(e=>e.id===id).when(s),false,id);
 s.monthlyIncome=300000;s.household.hasChild=true;s.age=60;s.household.childBornAge=50;
 for(const id of ['schooltrip','followup','care'])assert.equal(EXPENSE_EVENTS.find(e=>e.id===id).when(s),true,id);
 for(const e of EXPENSE_EVENTS){assert.ok(e.min>0&&e.max>=e.min);assert.ok(e.max<={small:22000,medium:180000,large:800000}[e.tier]);}
});
