import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {getWorkOffer} from '../src/game/core.js';
import {dailyWageQuote} from '../src/game/work-economy.js';
import {dayOptions,dayGigPay,ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {renderCharacterStats,fatigueTransitionNotice} from '../src/ui/character-stats.js';

const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}
function adult(fatigue=65){const s=createRun({seed:'fatigue-feedback',familyId:'F01'},catalog);Object.assign(s,{age:25,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1e7,monthlyIncome:0});s.stats.skill=50;s.behavior.fatigue=fatigue;ensureRoutine(s);resetRoutineDay(s,1);return s;}

test('fatigue 64 pays normally, 65 explains the discounted quote before a gig and its receipt',()=>{
 for(const fatigue of [64,65]){
  const s=adult(fatigue),expected=fatigue===65?3750:5000;
  assert.equal(dayGigPay(s),expected);
  const note=dayOptions(s).find(c=>c[0]==='day_gig')[2];
  assert.equal(note.includes('疲劳导致工作出错'),fatigue===65);
  assert.equal(getWorkOffer(s).reason.includes('减少 25%'),fatigue===65);
  const n=act(s,{type:'day_activity',choice:'day_gig'},catalog);
  assert.equal(n.lastResult.error,undefined);assert.equal(n.cash-s.cash,expected);
  assert.equal(n.lastResult.text.includes('疲劳导致工作出错'),fatigue===65);
 }
});
test('fatigue only reduces salary, not pension, and does not stack with slacking',()=>{
 const s=adult();s.monthlyIncome=300000;s.retirementIncome=60000;s.occupation='职员';
 assert.equal(dailyWageQuote(s,12000),9500);
 s.dayRoutine.wagePenalty=true;assert.equal(dailyWageQuote(s,12000),9500);
 s.behavior.fatigue=64;assert.equal(dailyWageQuote(s,12000),9500);
 s.dayRoutine.wagePenalty=false;assert.equal(dailyWageQuote(s,12000),12000);
 s.occupation='退休';s.behavior.fatigue=100;assert.equal(dailyWageQuote(s,2000),2000);
});
test('wage settlement records the fatigue reason before overnight recovery',()=>{
 const s=adult();s.monthlyIncome=300000;s.occupation='职员';
 const n=act(s,{type:'calendar_day'},catalog);
 assert.equal(n.lastResult.error,undefined);assert.equal(n.survival.last.salary,0);assert.equal(n.survival.last.earned,7258);
 assert.match(n.lastResult.text,/疲劳导致工作出错/);
});
test('fatigue display reads behavior rather than action points and keeps young children free of adult fatigue',()=>{
 const s=adult(73),before=structuredClone(s),html=renderCharacterStats(s,{icon:()=>''});
 assert.match(html,/aria-label="疲劳"[^>]*aria-valuenow="73"/);assert.match(html,/工作收入 −25%/);
 assert.deepEqual(s,before);s.age=5;assert.doesNotMatch(renderCharacterStats(s,{icon:()=>''}),/data-stat="fatigue"/);
 s.age=18;delete s.behavior;assert.match(renderCharacterStats(s,{icon:()=>''}),/aria-label="疲劳"[^>]*aria-valuenow="0"/);
});
test('threshold notifications fire once on crossing, and recovery does not claim other penalties ended',()=>{
 const low=adult(64),high=adult(65);
 assert.match(fatigueTransitionNotice(low,high),/工作容易出错/);
 assert.equal(fatigueTransitionNotice(high,adult(80)),'');
 assert.match(fatigueTransitionNotice(high,low),/疲劳造成的收入扣减已解除/);
 assert.equal(fatigueTransitionNotice(low,{...high,lastResult:{error:'拒绝'}}),'');
});
