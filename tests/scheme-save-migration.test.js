import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,chooseEvent,getEventPresentation,getEventCandidates} from '../src/game/narrative.js';
import {applyEffects} from '../src/game/core.js';
import {recordSchemeInterlude} from '../src/game/scheme-life.js';
import {getMarketAccess} from '../src/game/market-access.js';
import {setSaveCatalog,encodeSave,decodeSave,checksum} from '../src/game/storage.js';
const read=n=>JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
function oldState(id='CL24'){
 const s=createRun({seed:'scheme-old-save',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'event',eventQueue:[],dueAnchors:[],giftReceived:true});
 const e=catalog.events.find(e=>e.id===id),n=id==='CL31'?1:id==='CL42'?3:4;
 s.activeEvent={eventId:id,instanceId:`crypto:${id}:20:legacy`,outcomes:Object.fromEntries(e.choices.slice(0,n).map(c=>[c.id,c.outcomes[0].id]))};s.lastResult=null;
 delete s.behavior.cryptoLife.schemeLife;
 return s;
}
const envelope=s=>({format:'中国式赌狗',version:1,state:structuredClone(s),checksum:checksum(JSON.stringify(s)),savedAt:'2026-09-28T00:00:00Z'});
test('v1.61 active scheme choices migrate without rerolling previous draws, cash or history',()=>{
 for(const id of ['CL22','CL23','CL24','CL25','CL26','CL27','CL28','CL29','CL30','CL31','CL42']){
  const old=oldState(id),before=structuredClone(old),wrapped=envelope(old),a=decodeSave(wrapped),b=decodeSave(wrapped),e=catalog.events.find(e=>e.id===id);
  assert.deepEqual(a.activeEvent,b.activeEvent);assert.equal(Object.keys(a.activeEvent.outcomes).length,e.choices.length);
  for(const [key,value]of Object.entries(old.activeEvent.outcomes))assert.equal(a.activeEvent.outcomes[key],value);
  for(const key of ['cash','familyReserve','rng','positions','debts','ledger','storyHistory'])assert.deepEqual(a[key],before[key],`${id}: ${key}`);
  assert.deepEqual(wrapped.state,before,'migration must not mutate supplied envelope');
  assert.deepEqual(decodeSave(encodeSave(a)),a,'migration is idempotent');
 }
});
test('already resolved legacy story remains paid and preserves displayed receipt',()=>{
 let s=oldState('CL22');s.activeEvent.outcomes=Object.fromEntries(catalog.events.find(e=>e.id==='CL22').choices.map(c=>[c.id,c.outcomes[0].id]));
 s=chooseEvent(s,'CL22','CL22_1',catalog);assert.equal(s.phase,'result');
 delete s.behavior.cryptoLife.schemeLife;
 const before={cash:s.cash,rng:s.rng,result:structuredClone(s.lastResult),history:structuredClone(s.storyHistory)};
 const restored=decodeSave(envelope(s));assert.equal(restored.phase,'result');assert.equal(restored.cash,before.cash);assert.equal(restored.rng,before.rng);assert.deepEqual(restored.lastResult,before.result);assert.deepEqual(restored.storyHistory,before.history);
});
test('migration rejects forged old draws and incomplete current saves instead of repairing them',()=>{
 const old=oldState();old.activeEvent.outcomes.CL24_1='invented';assert.throws(()=>decodeSave(envelope(old)),/剧情/);
 const current=decodeSave(envelope(oldState()));delete current.activeEvent.outcomes.CL24_1;assert.throws(()=>decodeSave(envelope(current)),/剧情/);
});
test('authored project introduction is not prefixed with a second generic market story',()=>{
 const s=oldState('CL22'),e=catalog.events.find(e=>e.id==='CL22'),p=getEventPresentation(s,e,catalog);
 assert.equal(p.title,e.title);assert.ok(p.prompt.includes('长灯计划'));assert.equal(p.artKey,null);
});
test('new asynchronous exposure replaces the fixed-age introduction and grants actual market awareness without buying',()=>{
 for(const c of catalog.events.find(e=>e.id==='CL22').choices){
  const s=oldState('CL22');assert.equal(getMarketAccess(s,'ponzi').unlocked,false);
  const next=chooseEvent(s,'CL22',c.id,catalog);assert.equal(next.lastResult.error,undefined);assert.equal(next.flags.ponzi_exposed,true);assert.equal(next.education.ponziExposureAge,next.age);assert.equal(getMarketAccess(next,'ponzi').unlocked,true);assert.equal(next.cash,s.cash);assert.deepEqual(next.positions,s.positions);
 }
 const s=oldState('CL22');s.age=24;s.phase='planning';s.activeEvent=null;assert.equal(getEventCandidates(s,catalog).some(e=>e.id==='AGE24A'),false);
});
test('the next project has its own first-payment story, locked draw and save record',()=>{
 let s=oldState('CL22');s.phase='planning';s.activeEvent=null;s.cash=1000000;s.flags.ponzi_exposed=true;
 const step=effects=>{const r=applyEffects(s,effects);assert.equal(r.result.error,undefined,r.result.error);s=r.state;};
 const days=n=>{s.debtClock.day+=n;s.age+=n/360;step([]);};
 const activate=id=>{const e=catalog.events.find(e=>e.id===id);s.phase='event';s.activeEvent={eventId:id,instanceId:`crypto:${id}:${s.turn}:${++s.serial}`,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes[0].id]))};s.lastResult=null;};
 step([{op:'crypto_life',schemeLife:true,action:'scheme_join',amount:100000}]);days(30);const key1=s.positions[0].projectKey;
 activate('CL24');s=chooseEvent(s,'CL24','CL24_1',catalog);assert.equal(s.phase,'result');assert.equal(s.positions.length,0);
 s.phase='planning';s.activeEvent=null;s.lastResult=null;days(180);recordSchemeInterlude(s);recordSchemeInterlude(s);
 step([{op:'crypto_life',schemeLife:true,action:'scheme_join',amount:100000}]);days(30);const key2=s.positions[0].projectKey;assert.notEqual(key1,key2);
 assert.ok(getEventCandidates(s,catalog).some(e=>e.id==='CL24'));
 activate('CL24');s=decodeSave(encodeSave(s));const before=s.cash;s=chooseEvent(s,'CL24','CL24_2',catalog);assert.equal(s.phase,'result');assert.equal(s.lastResult.error,undefined);assert.equal(s.cash,before);
 assert.equal(s.behavior.cryptoLife.schemeLife.projects[key1].eventCounts.CL24,1);assert.equal(s.behavior.cryptoLife.schemeLife.projects[key2].eventCounts.CL24,1);assert.deepEqual(decodeSave(encodeSave(s)),s);
});
