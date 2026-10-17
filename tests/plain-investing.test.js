import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contractExamples,renderContractRisk} from '../src/ui/market-information.js';
import {createRun,evaluateEndings} from '../src/game/narrative.js';
import {applyAction,applyEffects,getMetrics} from '../src/game/core.js';
const catalog={};for(const key of ['events','families','history','endings','characters']){const d=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?d.events:d;}
function adult(){const s=createRun({seed:'plain-investing',familyId:'F03'},catalog);Object.assign(s,{age:60,turn:60,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:500000000,giftReceived:true});return s;}
const free=s=>evaluateEndings(s,catalog).some(e=>e.id==='E30');
test('100x examples include fees but never claim a loss beyond the isolated stake',()=>{
 for(const direction of ['long','short']){const x=contractExamples({product:'crypto_perp',amount:100000,leverage:100,direction});assert.equal(x.fee,2000);assert.equal(x.distance,.48);assert.deepEqual(x.rows[0],{percent:1,gain:98000,loss:100000,liquidated:true});assert.ok(x.rows.every(r=>r.loss<=100000));const html=renderContractRisk({product:'crypto_perp',amount:100000,leverage:100,direction},{money:n=>'¥'+n/100});assert.ok(html.includes('触发强平，最多亏损 ¥1000'));assert.ok(html.includes('预计盈利 ¥980'));assert.ok(!html.includes('300%'));}
});
test('lower leverage explains actual cash loss and a wider distance, without rendering RNG changes',()=>{
 const a={product:'futures',amount:100000,leverage:2,direction:'long'},copy=structuredClone(a),x=contractExamples(a);assert.equal(x.fee,40);assert.equal(x.distance,44.98);assert.deepEqual(x.rows[0],{percent:1,gain:1960,loss:2040,liquidated:false});assert.deepEqual(a,copy);assert.equal(contractExamples({product:'stock',amount:100000}),null);assert.equal(contractExamples({...a,amount:NaN}),null);assert.equal(contractExamples({...a,amount:Number.MAX_SAFE_INTEGER}),null);
});
test('ordinary investment can earn the freedom ending without an option jackpot or inherited-only reward',()=>{
 const s=adult();assert.equal(free(s),false);const n=applyAction(s,{type:'invest',product:'fund',amount:100000}).state;assert.ok(n.flags.fund_investor);assert.ok(getMetrics(n).retirement_cover_months>=600);assert.ok(free(n));assert.ok(!n.flags.option_big_win);assert.equal(evaluateEndings(n,catalog)[0].id,'E30');
});
test('freedom counts sale fees and excludes locked, frozen, trapped and leveraged wealth',()=>{
 const s=adult();s.flags.stock_investor=true;s.cash=0;const price=500000000;s.positions=[{id:'plain',kind:'stock',cost:price,value:price,lockUntilTurn:0}];const m=getMetrics(s);assert.equal(m.retirement_cover_months,(price-Math.round(price*.002))/m.monthlyExpense);assert.ok(free(s));
 for(const patch of [{frozen:true},{lockUntilTurn:100},{kind:'angel'},{kind:'housing'},{kind:'crypto_perp'},{kind:'ponzi'}]){const copy=structuredClone(s);Object.assign(copy.positions[0],patch);assert.equal(getMetrics(copy).retirement_cover_months,0);assert.equal(free(copy),false);}
 s.positions=[];s.claims=[{id:'claim',face:price,value:price}];assert.equal(free(s),false);
});
test('debt and unresolved cases cannot be called financial freedom',()=>{
 const s=adult();s.flags.bond_investor=true;assert.ok(free(s));s.debts=[{id:'loan',principal:100,interest:0,aprBps:0,monthsLeft:1}];assert.equal(free(s),false);s.debts=[];
 const r=applyEffects(s,[{op:'legal_case',case_type:'gambling',profit_yuan:1000}]);assert.equal(r.result.error,undefined);assert.equal(getMetrics(r.state).pending_case_count,1);assert.equal(free(r.state),false);
});
