import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {nightTransitionData} from '../src/ui/night-transition.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
function bedtime(){const s=createRun({seed:'night-cutscene',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000,monthlyIncome:300000});s.lifeArcs.pending=null;s.behavior.pending=null;s.behavior.fatigue=30;ensureRoutine(s);resetRoutineDay(s,6);s.dayRoutine.choices={1:'focus',3:'focus'};s.trading.phase=2;return s;}
test('sleep transition reads a completed single day and leaves the saved ledger and RNG untouched',()=>{
 const before=bedtime(),action={type:'day_activity',choice:'sleep'},after=act(before,action,catalog),snapshot=structuredClone(after),scene=nightTransitionData(before,after,action);
 assert.equal(after.lastResult.error,undefined);// Daily recovery (-3) and sleep (-12) are both reflected in the actual total.
 assert.equal(scene.kind,'sleep');assert.match(scene.effects,/疲劳 −15/);assert.equal(scene.next,'次日 07:00 · 起床');assert.deepEqual(after,snapshot);
 const saved=decodeSave(encodeSave(after));assert.deepEqual(saved,after);assert.equal(nightTransitionData(saved,saved,action),null);
});
test('entering the late market never shows settlement; sleeping afterward uses actual night penalties',()=>{
 const before=bedtime(),stay={type:'day_activity',choice:'stay'},late=act(before,stay,catalog);
 assert.equal(nightTransitionData(before,late,stay),null);assert.equal(late.dayRoutine.stage,7);
 const action={type:'day_next'},after=act(late,action,catalog),scene=nightTransitionData(late,after,action);
 assert.equal(scene.kind,'night');assert.equal(scene.time,'次日 02:00');assert.match(scene.effects,/疲劳 \+21/);assert.match(scene.effects,/健康 −1/);assert.match(scene.effects,/压力 \+5/);
});
test('one-day emergency settlement shows once; reopening a billed day or bulk fast-forward does not replay it',()=>{
 const before=bedtime(),action={type:'calendar_day'},after=act(before,action,catalog);assert.equal(nightTransitionData(before,after,action).kind,'sleep');assert.equal(nightTransitionData(before,after,action).next,'今天已结清');
 const wake=act(after,{type:'day_next'},catalog);assert.equal(nightTransitionData(after,wake,{type:'day_next'}).kind,'wake-fresh');assert.equal(nightTransitionData(wake,wake,{type:'day_next'}),null);
 assert.equal(nightTransitionData(before,after,{type:'live_days',days:3}),null);assert.equal(nightTransitionData(before,{...after,phase:'ended'},action),null);
});
