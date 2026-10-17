import {INSTRUMENTS} from '../src/game/market-play.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyAction,getActionAvailability,getMetrics,PRODUCTS,getTurnMonths} from '../src/game/core.js';
import {housingQuote} from '../src/game/housing.js';
import {numberPresets} from '../src/ui/number-presets.js';
import {housingPosition} from '../src/ui/housing-desk.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {DAILY_EVENTS} from '../src/game/day-routine.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
function adult(seed='off-exchange'){
 const s=createRun({seed,familyId:'F08'},catalog);Object.assign(s,{age:35,turn:25,phase:'planning',activeEvent:null,eventQueue:[],cash:500000000,monthlyIncome:1200000,occupation:'普通职员'});s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};s.flags.gambling_exposed=true;s.flags.college_student=false;s.flags.employed=true;s.stats.credit=90;s.stats.insight=90;s.trading.phase=3;s.trading.energy=0;return s;
}
const run=(s,a)=>{const out=applyAction(s,a);assert.equal(out.result.error,undefined,out.result.error);return out.state;};
test('property total price determines exact deposit and mortgage without rounding away cents',()=>{
 const q=housingQuote(50000001,true,250);assert.equal(q.payment+q.principal,q.price);assert.equal(q.payment,15000000);
 let s=adult(),net=getMetrics(s).netWorth,cash=s.cash;s=run(s,{type:'desk_order',product:'housing',instrument:'suburb',propertyPrice:q.price,amount:q.payment,financed:true});const p=s.positions[0],d=s.debts.find(d=>d.id===p.mortgageId);
 assert.equal(p.value,q.price);assert.equal(p.cost,q.price);assert.equal(d.principal,q.principal);assert.equal(s.cash,cash-q.payment);assert.equal(getMetrics(s).netWorth,net);assert.deepEqual(decodeSave(encodeSave(s)),s);
 const html=housingPosition(p,{s,money:String,esc:String,button:()=>''});assert.ok(html.includes(String(q.principal)));assert.ok(html.includes('房产净值'));
});
test('invalid property quotes fail atomically and full payment has no mortgage',()=>{
 for(const propertyPrice of [NaN,0,-1,1.2,Number.MAX_SAFE_INTEGER+1,60000000]){const s=adult(),out=applyAction(s,{type:'desk_order',product:'housing',instrument:'suburb',propertyPrice,amount:15000000,financed:true});assert.ok(out.result.error);assert.strictEqual(out.state,s);}
 const s=run(adult(),{type:'desk_order',product:'housing',instrument:'center',propertyPrice:50000000,amount:50000000,financed:false});assert.equal(s.positions[0].value,50000000);assert.equal(s.positions[0].mortgageId,undefined);
});
test('project investments and gambling are available after close without moving the calendar',()=>{
 for(const product of ['ponzi','housing','angel']){
  const s=adult(),n=run(s,{type:'desk_order',product,instrument:INSTRUMENTS[product][0].id,amount:PRODUCTS[product].min});assert.equal(n.trading.day,s.trading.day);assert.equal(n.trading.phase,3);assert.equal(n.trading.energy,0);assert.equal(n.cash,s.cash-PRODUCTS[product].min);
 }
 const s=adult(),n=run(s,{type:'gamble',game:'redblack',pick:'red',amount:10000});assert.equal(n.trading.phase,3);assert.equal(n.trading.day,s.trading.day);assert.equal(n.trading.energy,0);
});
test('ponzi withdrawal is settled once after close; cash failure still becomes a claim',()=>{
 let failures=0,successes=0;
 for(let i=0;i<20;i++){let s=run(adult('project-'+i),{type:'desk_order',product:'ponzi',instrument:'ponzi',amount:100000});const id=s.positions[0].id,cash=s.cash;s=run(s,{type:'desk_sell',id,bps:10000});assert.equal(s.positions.length,0);assert.equal(s.trading.phase,3);if(s.claims.length){failures++;assert.equal(s.cash,cash);}else{successes++;assert.equal(s.cash,cash+99800);}const second=applyAction(s,{type:'desk_sell',id,bps:10000});assert.ok(second.result.error);assert.strictEqual(second.state,s);}
 assert.ok(failures>0&&successes>0);
});
test('offline opening does not remove property lock, credit checks, or cash constraints',()=>{
 let s=run(adult(),{type:'desk_order',product:'housing',instrument:'suburb',amount:5000000});assert.match(getActionAvailability(s,{type:'desk_sell',id:s.positions[0].id,bps:10000}).reason,/解锁/);
 s=adult();s.stats.credit=20;assert.match(getActionAvailability(s,{type:'desk_order',product:'housing',instrument:'suburb',amount:5000000,financed:true}).reason,/信用/);
 s=adult();s.cash=0;assert.match(getActionAvailability(s,{type:'desk_order',product:'ponzi',instrument:'ponzi',amount:100000}).reason,/现金/);
});
test('amount and quantity presets respect visible units and field bounds',()=>{
 assert.deepEqual(numberPresets({name:'quantity',min:1,max:3}).map(x=>x.value),[1,2,3]);
 assert.deepEqual(numberPresets({name:'lots',min:1,max:4}).map(x=>x.value),[1]);
 assert.equal(numberPresets({name:'amount',min:.01,max:52.35,step:.01})[0].value,52.35);
 assert.equal(numberPresets({name:'amount',min:1000,max:10,step:.01}).length,0);
 assert.deepEqual(numberPresets({name:'price',min:50000,step:.01,presets:'300000,500000,800000'}).map(x=>x.value),[300000,500000,800000]);
});
test('a daily event on the last billed day can still be answered',()=>{
 const s=adult();s.debtClock.periodDays=getTurnMonths(s)*30;s.debtClock.day=s.debtClock.periodDays;s.dayRoutine={day:s.trading.day,stage:5,choices:{},checked:['event'],pending:'overtime',nightStreak:0,wagePenalty:false,last:''};
 const choice=DAILY_EVENTS.overtime.choices.find(c=>getActionAvailability(s,{type:'day_event_choice',choice:c[0]}).allowed);assert.ok(choice);const next=run(s,{type:'day_event_choice',choice:choice[0]});assert.equal(next.dayRoutine.pending,null);
});

test('property sale receipt distinguishes gross proceeds, mortgage repayment and net cash',()=>{
 let s=run(adult(),{type:'desk_order',product:'housing',instrument:'suburb',propertyPrice:50000000,amount:15000000,financed:true});
 s.turn+=2;const cash=s.cash,id=s.positions[0].id,out=applyAction(s,{type:'desk_sell',id,bps:10000});
 assert.equal(out.result.error,undefined);assert.equal(out.state.cash-cash,12500000);assert.equal(out.state.debts.length,0);assert.match(out.result.text,/偿还按揭 350000 元/);assert.match(out.result.text,/净到账 125000 元/);
});
