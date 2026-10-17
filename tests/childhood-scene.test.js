import test from 'node:test';
import assert from 'node:assert/strict';
import {childhoodScene,completedChildhoodActivity} from '../src/ui/childhood-scene.js';
import {childhoodActivity} from '../src/game/childhood-activities.js';

test('preschool scenes respect age and do not replace birth or adult scenes',()=>{
 for(const age of [0,6,12,18,80])assert.equal(childhoodScene({age,phase:'planning'}),null);
 for(const age of [1,2,3,5]){
  const state={age,phase:'planning',actionPoints:2},before=structuredClone(state);
  assert.equal(childhoodScene(state).key,age<3?'toddler-play':'preschool-home');
  assert.deepEqual(state,before);
 }
});
test('a completed toddler nap persists but does not leak into next year or story',()=>{
 const state={age:1,phase:'planning',actionPoints:1,journey:{lastAction:'rest'}};
 state.lastResult={title:childhoodActivity(state,'rest').title};
 assert.equal(childhoodScene(state).key,'toddler-nap');
 assert.equal(childhoodScene(JSON.parse(JSON.stringify(state))).key,'toddler-nap');
 assert.equal(childhoodScene({...state,actionPoints:2}).key,'toddler-play');
 assert.equal(childhoodScene({...state,phase:'event'}).key,'toddler-play');
 assert.equal(childhoodScene({...state,lastResult:{title:'另一件事'}}).key,'toddler-play');
 assert.equal(completedChildhoodActivity({...state,age:3}),null);
});
