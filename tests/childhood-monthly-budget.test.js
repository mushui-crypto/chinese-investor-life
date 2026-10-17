import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {advanceTurn,applyAction} from '../src/game/core.js';
import {settleChildhoodAllowance,childhoodSpending} from '../src/game/childhood-economy.js';
import {decodeSave,encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const born=()=>{const s=createRun({seed:'monthly-pocket',familyId:'F01'},catalog);s.phase='planning';s.activeEvent=null;s.dueAnchors=[];return s;};
const ok=o=>{assert.equal(o.result.error,undefined,o.result.error);return o.state;};
const reload=s=>decodeSave(encodeSave(s));
test('144 eligible months have bounded spending; settled months cannot be paid again',()=>{
 for(const draw of [0,.999999]){const s={age:18,childhood:{},cash:0};let draws=0;const api={draw:()=>{draws++;return draw;},cashChange:(s,n)=>s.cash+=n};settleChildhoodAllowance(s,0,api);assert.equal(draws,144);const expenses=72*(draw?180:120)+36*(draw?190:150)+36*(draw?200:170);assert.equal(s.cash,(144*200-expenses)*100);const before=structuredClone(s);settleChildhoodAllowance(s,0,api);assert.deepEqual(s,before);assert.equal(draws,144);}
 assert.equal(childhoodSpending(5),null);assert.equal(childhoodSpending(18),null);
});
test('stage cashflow replays after saves and reload does not draw expenses',()=>{
 let live=born(),loaded=born();for(const age of [3,6,10,12,13,14,15,16,17,18]){live=ok(advanceTurn(live));loaded=ok(advanceTurn(reload(loaded)));assert.equal(live.age,age);assert.deepEqual(live,loaded);assert.deepEqual(reload(live),live);}
});
test('legacy school-age saves bill future months only, without rewriting old funds',()=>{
 for(const age of [6,11,12,17]){const s=born();s.age=age;s.cash=45678;s.childhood.allowanceThroughMonth=undefined;delete s.childhood.allowanceThroughMonth;const saved=reload(s);assert.deepEqual(saved,s);const n=ok(advanceTurn(s)),months=Math.min(215,n.age*12)-age*12;assert.equal(n.ledger.filter(e=>e.label==='成长阶段零花钱').reduce((sum,e)=>sum+e.amount,0),months*20000);assert.deepEqual(reload(n),n);}
});
test('phase habits cost one energy, affect multiple years, and advancing adds no hidden activity',()=>{
 const primary=born();primary.age=6;primary.stats.academic=10;
 const n=ok(applyAction(primary,{type:'study'}));assert.equal(n.actionPoints,1);assert.ok(n.stats.academic-primary.stats.academic>5);
 const advanced=ok(advanceTurn(n));assert.equal(advanced.age,10);assert.equal(advanced.stats.academic,n.stats.academic);assert.equal(advanced.actionPoints,2);
});
