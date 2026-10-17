import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {childhoodActivities,childhoodActivity,childhoodFocusNames} from '../src/game/childhood-activities.js';
import {createState,applyAction,advanceTurn,getActionAvailability} from '../src/game/core.js';
import {createRun} from '../src/game/narrative.js';
import {createPlayableRun} from '../src/game/quick-start.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const data=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?data.events:data;}setSaveCatalog(catalog);
const child=age=>Object.assign(createState({family:catalog.families[0],seed:'activities'}),{age,phase:'planning'});
const ok=out=>{assert.equal(out.result.error,undefined,out.result.error);return out.state;};

test('activity choices change at each childhood boundary and use existing action IDs',()=>{
 for(const [age,label] of [[0,'感官探索'],[1,'玩耍探索'],[2,'玩耍探索'],[3,'亲子阅读'],[5,'亲子阅读'],[6,'上课做作业'],[11,'上课做作业'],[12,'复习功课'],[14,'复习功课'],[15,'备考积累'],[17,'备考积累']]){
  assert.equal(childhoodActivity({age},'study').label,label);
  assert.deepEqual(childhoodActivities({age}).slice(0,3).map(a=>a.type),['study','rest','social']);
 }
 assert.deepEqual(childhoodActivities({age:18}),[]);
 assert.equal(childhoodFocusNames({age:1}).social,'家人陪伴');
 assert.equal(childhoodFocusNames({age:3}).study,'故事与绘本');
});
test('toddler play does not teach homework, job skills or public fame',()=>{
 for(const age of [0,1,2,3,4,5])for(const type of ['study','rest','social']){
  const s=child(age),before=structuredClone(s),out=applyAction(s,{type}),next=ok(out);
  for(const key of ['academic','skill','fame'])assert.equal(next.stats[key],s.stats[key]);
  for(const key of ['cash','familyReserve','adultGift','rng','monthlyIncome','marketProgress'])assert.deepEqual(next[key],s[key]);
  assert.equal(next.actionPoints,1);assert.deepEqual(s,before);
  assert.equal(out.result.title,childhoodActivity(s,type).title);
  assert.doesNotMatch(out.result.text,/做题|学业|课程|手机|账户|行情|工钱/);
 }
});
test('school study raises academic progress and social play is not recorded as a family dinner',()=>{
 for(const age of [6,12,15]){
  const s=child(age),next=ok(applyAction(s,{type:'study'}));
  assert.ok(next.stats.academic>s.stats.academic);assert.equal(next.stats.skill,s.stats.skill);
  const social=ok(applyAction(s,{type:'social'}));
  assert.equal(social.stats.fame,s.stats.fame);assert.deepEqual(social.lifeArcs.memories,s.lifeArcs.memories);
 }
 const toddler=ok(applyAction(child(1),{type:'social'}));
 assert.match(toddler.lifeArcs.memories.N10.at(-1).text,/家人/);
 assert.deepEqual(toddler.peopleMet,['N10']);
});
test('age-specific activities still cost one arrangement, enforce limits, and never open adult jobs',()=>{
 for(const age of [0,1,3,6,12,17]){
  let s=child(age);s=ok(applyAction(s,{type:'study'}));s=ok(applyAction(s,{type:'rest'}));
  assert.equal(s.actionPoints,0);assert.equal(getActionAvailability(s,{type:'social'}).allowed,false);
  for(const type of ['work','gig','seek_job','borrow','invest'])assert.equal(getActionAvailability(child(age),{type}).allowed,false);
 }
});
test('old childhood saves retain past progress; the next action and birthday use current-age behavior',()=>{
 const s=createRun({seed:'old-activity',familyId:'F01'},catalog);Object.assign(s,{age:2,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[]});
 const restored=decodeSave(encodeSave(s));assert.deepEqual(restored,s);
 const after=ok(applyAction(restored,{type:'study'}));assert.equal(after.logs.at(-1).title,'在玩耍中长大');
 const older=ok(advanceTurn(after));assert.equal(older.age,3);assert.equal(childhoodActivity(older,'study').label,'亲子阅读');
});
test('adult quick start uses age-appropriate early memories and pays the adult gift once',()=>{
 for(const focus of ['study','practical','social']){
  const s=createPlayableRun({familyId:'F01',seed:'age-fast-forward',startAt:'adult',childhood:focus},catalog);
  assert.equal(s.age,18);assert.equal(s.ledger.filter(e=>e.label==='成年一次性赠与').length,1);
  const early=s.logs.filter(e=>e.age<3&&['在玩耍中长大','睡足了再去玩','家里总有人陪你','一点点认识周围','吃饱，睡好','熟悉的怀抱'].includes(e.title));
  assert.ok(early.length>0);assert.ok(early.every(e=>!/手机|账户|做题/.test(e.text)));
  assert.deepEqual(decodeSave(encodeSave(s)),s);
 }
});
