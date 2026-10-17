import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,continueStory,chooseEvent,act} from '../src/game/narrative.js';
import {applyAction,getActionAvailability} from '../src/game/core.js';
import {hasMetPerson,meetPerson,validatePeople,personRelation} from '../src/game/people.js';
import {rebuildOffers,newLifeArcs} from '../src/game/life-arcs.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {renderPeoplePage,peopleDirectory,personPortrait} from '../src/ui/people.js';
import {renderRebuild} from '../src/ui/life-panel.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const ctx={esc:s=>String(s).replaceAll('"','&quot;'),money:n=>'¥'+n/100,icon:()=>'',ageText:n=>n+' 岁'};
function adult(){const s=createRun({familyId:'F01',seed:'people-check'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1e6,monthlyIncome:0,presentations:[]});s.lifeArcs=newLifeArcs(s);s.behavior.pending=null;return s;}
const go=(s,a)=>{const next=act(s,a,catalog);assert.equal(next.lastResult?.error,undefined,next.lastResult?.error);return next;};
test('only encountered people appear; render and rejected actions preserve state and RNG',()=>{
 const s=adult(),before=structuredClone(s),html=renderPeoplePage(s,catalog,ctx);
 assert.deepEqual(s.peopleMet,['N10']);assert.match(html,/data-person-id="N10"/);
 for(const id of ['N01','N02','N04','N07','N09','N12'])assert.ok(!html.includes(`data-person-id="${id}"`));
 assert.ok(!renderRebuild(s,ctx).includes('赵姨'));
 for(const a of [{type:'life_visit',id:'N04'},{type:'life_offer',id:'shift'},{type:'life_offer',id:'repair'},{type:'relationship',kind:'partner'}])assert.ok(applyAction(s,a).result.error);
 assert.deepEqual(s,before);assert.ok(rebuildOffers(s).every(o=>!o.allowed));
});
test('activation discovers displayed characters before choosing, but queued branches stay hidden',()=>{
 let s=adult();s.eventQueue=['HAO01'];assert.equal(hasMetPerson(s,'N01'),false);
 s=continueStory(s,catalog);assert.equal(s.activeEvent.eventId,'HAO01');assert.ok(hasMetPerson(s,'N01'));assert.ok(!hasMetPerson(s,'N02'));
 const e=catalog.events.find(e=>e.id==='HAO01');s=chooseEvent(s,e.id,e.choices[0].id,catalog);assert.ok(!s.lastResult.error);
 assert.deepEqual(decodeSave(encodeSave(s)).peopleMet,s.peopleMet);
});
test('legacy migration reconstructs actual stories and visits without revealing future outcomes',()=>{
 const s=adult();delete s.peopleMet;s.lifeArcs.memories.N04=[{age:25,day:0,text:'见过老周'}];
 s.eventQueue=['XIA01'];s.pending=[{eventId:'HAO01',dueTurn:21,expiresTurn:25}];
 const events=new Map([['seen',{title:'旧事',prompt:'陈经理递来表格。',choices:[{label:'签字',outcomes:[{text:'以后认识沈岚'}]}]}]]);
 s.seenEvents=['seen'];const rng=s.rng,cash=s.cash;validatePeople(s,events);
 assert.deepEqual(new Set(s.peopleMet),new Set(['N10','N04','N05']));assert.equal(s.rng,rng);assert.equal(s.cash,cash);
 const legacy=adult();delete legacy.peopleMet;legacy.household.partner=true;legacy.relationships.partner=64;
 const restored=decodeSave(encodeSave(legacy));assert.ok(hasMetPerson(restored,'N02'));assert.equal(personRelation(restored,'N02'),64);assert.deepEqual(decodeSave(encodeSave(restored)),restored);
 for(const invalid of [['N99'],['N10','N10'],'N10',['__proto__']]){const bad=adult();bad.peopleMet=invalid;assert.throws(()=>encodeSave(bad),/已认识人物/);}
});
test('work, job search and study introduce their contacts in the actual result',()=>{
 for(const [type,id,name] of [['work','N07','赵姨'],['gig','N07','赵姨'],['seek_job','N04','老周'],['study','N12','吴师傅']]){
  const s=go(adult(),{type});assert.ok(hasMetPerson(s,id));assert.ok(s.lastResult.text.includes(name));assert.ok(s.lifeArcs.memories[id].length);assert.ok(renderPeoplePage(s,catalog,ctx).includes(`data-person-id="${id}"`));
 }
});
test('visits build individual trust, fulfill promises, and unlock a named job',()=>{
 let s=adult();meetPerson(s,'N04');s.stats.trust=100;assert.equal(personRelation(s,'N04'),50);
 assert.ok(!rebuildOffers(s).find(o=>o.id==='referral').allowed);
 s.lifeArcs.promises.push({id:'N04',day:7,status:'open'});s=go(s,{type:'life_visit',id:'N04'});
 assert.equal(personRelation(s,'N04'),58);assert.equal(s.lifeArcs.promises[0].status,'kept');assert.equal(s.actionPoints,1);
 assert.ok(!getActionAvailability(s,{type:'life_visit',id:'N04'}).allowed);
 assert.ok(rebuildOffers(s).find(o=>o.id==='referral').allowed);
 const cash=s.cash;s=go(s,{type:'life_offer',id:'referral'});assert.equal(s.cash,cash);assert.equal(s.lifeArcs.jobs[0].due,2);assert.equal(s.actionPoints,0);
 assert.match(renderPeoplePage(s,catalog,ctx),/已接下 · 2 天后交付/);
});
test('family actions belong to known people and keep one consistent relationship value',()=>{
 let s=adult();assert.ok(!getActionAvailability(s,{type:'relationship',kind:'repair'}).allowed);
 meetPerson(s,'N02');s.relationships.N02=59;assert.ok(!getActionAvailability(s,{type:'relationship',kind:'partner'}).allowed);
 s.relationships.N02=64;assert.equal(getActionAvailability(s,{type:'relationship',kind:'partner'}).allowed,false);
 s.familyLife.metOn='2000-01-01';s.familyLife.visits=3;s=go(s,{type:'family_start'});s=go(s,{type:'life_choice',scene:'family',choice:'date'});assert.equal(s.relationships.partner,69);
 s=go(s,{type:'relationship',kind:'repair'});assert.equal(s.relationships.N02,79);assert.equal(s.relationships.partner,79);
 s.actionPoints=2;assert.equal(getActionAvailability(s,{type:'relationship',kind:'child'}).allowed,false);assert.ok(!hasMetPerson(s,'N09'));
 const alone=adult();alone.age=56;const next=go(alone,{type:'life_succession'});assert.ok(!hasMetPerson(next,'N12'));assert.equal(next.cash,alone.cash);
 const mourning=adult();mourning.household.livingParent=false;assert.ok(!getActionAvailability(mourning,{type:'life_visit',id:'N10'}).allowed);assert.match(renderPeoplePage(mourning,catalog,ctx),/已离世/);
});
test('directory filters and selection never expose strangers or consume game actions',()=>{
 const s=adult();for(const id of ['N04','N07','N02'])meetPerson(s,id);
 s.lifeArcs.promises=[{id:'N04',day:7,status:'open'}];const before=structuredClone(s);
 assert.equal(peopleDirectory(s,catalog,{selectedId:'N99'}).selected.id,'N04');
 assert.deepEqual(peopleDirectory(s,catalog,{filter:'promises',selectedId:'N02'}).filtered.map(p=>p.id),['N04']);
 assert.deepEqual(new Set(peopleDirectory(s,catalog,{filter:'work'}).filtered.map(p=>p.id)),new Set(['N04','N07']));
 const html=renderPeoplePage(s,catalog,ctx,{selectedId:'N02'});assert.match(html,/id="contact-detail" data-person-id="N02"/);assert.ok(!html.includes('data-person-id="N12"'));
 assert.deepEqual(s,before);
});
test('portraits honor the family opening and history does not duplicate story memory',()=>{
 const s=adult();assert.equal(personPortrait(s,'N10'),'/assets/people/N10.webp');
 s.familyId='F11';assert.equal(personPortrait(s,'N10'),'/assets/people/N10-single.webp');s.familyId='F12';assert.equal(personPortrait(s,'N10'),'/assets/people/N10-elders.webp');
 const e=catalog.events.find(e=>e.id==='HAO01');meetPerson(s,'N01');s.storyHistory=[{eventId:e.id,age:25,title:e.title,text:'阿豪收起了账本。'}];s.lifeArcs.memories.N01=[{age:25,day:0,text:e.title+'：你选择了听听。'}];
 const html=renderPeoplePage(s,catalog,ctx,{selectedId:'N01'});assert.match(html,/往来记录 <span>1 条/);assert.ok(!html.slice(html.indexOf('<details class="contact-history"')).includes('你选择了听听'));
});
