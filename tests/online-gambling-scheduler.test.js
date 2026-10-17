import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,chooseEvent,continueStory,nextTurn,eligibleChoices,getEventCandidates,getEventPresentation} from '../src/game/narrative.js';
import {getMetrics} from '../src/game/core.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
import {ensureOnlineGambling,onlineGamblingState,recordOnlineExposure,recordOnlineBet,recordOnlineEvent,recordOnlineOrdinaryEvent} from '../src/game/online-gambling.js';

const read=name=>JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
const lifeEvent=id=>({id,title:'把今天的生活安排好',prompt:'学习、工作和朋友的消息照常继续。',kind:'personal',category:'关系与人生',age_min:18,age_max:80,weight:10,priority:10,required_flags:[],excluded_flags:[],choices:[{id:`${id}_1`,label:'先把手头的事做完',profile:'observe',requirements:{all:[],min_cash_yuan:0},outcomes:[{id:`${id}_1_1`,weight:1,text:'今天的事做完了。',effects:[{op:'stat',delta:{insight:1}}],schedule:[]}]}]});
const catalog={events:[...read('events').events,...Array.from({length:8},(_,i)=>lifeEvent(`TEST_LIFE_${i}`))],families:read('families'),endings:read('endings'),history:read('history'),characters:read('characters')};
const eventAt=id=>catalog.events.find(e=>e.id===id);
const copy=s=>structuredClone(s);
function adult(seed='online-scheduler'){
 const s=createRun({seed,familyId:'F01'},catalog);
 Object.assign(s,{age:25,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000,occupation:'待业青年',monthlyIncome:0});
 s.flags.college_student=false;s.flags.college_not_admitted=true;s.education.college=false;
 ensureOnlineGambling(s);return s;
}
function show(s,id,queue=[]){return continueStory({...copy(s),phase:'planning',activeEvent:null,eventQueue:[id,...queue]},catalog);}
function choose(s,action){
 const event=eventAt(s.activeEvent?.eventId),choice=eligibleChoices(s,event).find(c=>!c.disabled&&(c.onlineAction===action||c.id===action));
 assert.ok(choice,`${event?.id} has an available ${action} choice`);
 const next=chooseEvent(s,event.id,choice.id,catalog);assert.equal(next.lastResult.error,undefined);return next;
}
function ordinary(s,index){const active=show(s,`TEST_LIFE_${index}`);return continueStory(choose(active,`TEST_LIFE_${index}_1`),catalog);}
function later(s,days=181){const n=copy(s);n.debtClock.day+=days;return n;}
function participant(){const s=adult();recordOnlineExposure(s);recordOnlineBet(s,{stake:2000,returned:1000,eventId:'fixture',choice:'试一点'});return s;}

test('all four first-contact choices expose a memory without betting or directly scheduling a follow-up',()=>{
 for(const action of ['curious','wait','inspect','refuse']){
  const start=show(adult(action),'OG01'),before=getMetrics(start),next=choose(start,action),g=onlineGamblingState(next);
  assert.equal(next.phase,'result');assert.equal(g.exposed,true);assert.equal(g.totalBets,0);
  assert.equal(next.cash,before.cash);assert.equal(next.pending.some(p=>/^OG/.test(p.eventId)),false);
  const resumed=continueStory(next,catalog);assert.equal(resumed.phase,'planning');assert.equal(resumed.activeEvent,null);
 }
});

test('time alone or ordinary events alone cannot bypass the shared online-story gap',()=>{
 let s=continueStory(choose(show(adult(),'OG01'),'curious'),catalog);
 const eligible=x=>getEventCandidates(x,catalog).some(e=>e.id==='OG02');
 assert.equal(eligible(s),false);
 const twoEvents=ordinary(ordinary(s,0),1);assert.equal(eligible(twoEvents),false,'ordinary choices do not replace elapsed days');
 s=later(s,91);assert.equal(eligible(s),false,'elapsed days do not replace ordinary life');
 s=ordinary(s,0);assert.equal(eligible(s),false);
 s=ordinary(s,1);assert.equal(eligible(s),true);
 assert.equal(getEventCandidates(s,catalog).some(e=>e.id==='OG08'),false,'participation is required for another wager story');
});

test('a pre-existing queue cannot activate two online scenes back to back',()=>{
 const active=show(participant(),'OG08',['OG05']);
 const result=choose(active,'small'),next=continueStory(result,catalog);
 assert.equal(next.phase,'planning');assert.equal(next.activeEvent,null);
 assert.equal(onlineGamblingState(next).eventCounts.OG08,1);
 assert.equal(onlineGamblingState(next).eventCounts.OG05,undefined);
});

test('repeatable catalog events use a fresh settlement identity and survive save/load with locked outcomes',()=>{
 setSaveCatalog(catalog);
 let s=show(participant(),'OG08');const firstId=s.activeEvent.instanceId;
 const original=copy(s.activeEvent.outcomes),reloaded=decodeSave(encodeSave(s));assert.deepEqual(reloaded.activeEvent.outcomes,original);
 s=choose(reloaded,'small');const firstBets=onlineGamblingState(s).totalBets,firstCash=s.cash;
 const duplicate=chooseEvent(s,'OG08','OG08_1',catalog);assert.ok(duplicate.lastResult.error);assert.equal(duplicate.cash,firstCash);
 s=continueStory(s,catalog);s=ordinary(ordinary(later(s),0),1);s=show(s,'OG08');
 assert.equal(s.phase,'event');assert.notEqual(s.activeEvent.instanceId,firstId);
 const secondReload=decodeSave(encodeSave(s));assert.deepEqual(secondReload.activeEvent,s.activeEvent);
 const result=choose(secondReload,'small');assert.equal(onlineGamblingState(result).totalBets,firstBets+1);
 assert.equal(result.seenEvents.filter(id=>id==='OG08').length,1);
 assert.equal(result.storyHistory.filter(h=>h.eventId==='OG08').length,2);
 assert.equal(new Set(result.logs.map(h=>h.id)).size,result.logs.length);
 assert.equal(result.appliedEffectIds.filter(id=>id.startsWith('online:OG08:')).length,2);
 assert.doesNotThrow(()=>decodeSave(encodeSave(result)));
});

test('ordinary relationship and career stories keep normal options while memory wagers obey the same gap',()=>{
 let s=participant();s.behavior.onlineGambling.tendencies.chasing=30;
 for(const id of ['XIA01','ENC_JOB02'])assert.ok(eligibleChoices(s,eventAt(id)).some(c=>c.onlineSpecial));
 recordOnlineEvent(s,{eventId:'OG08',choice:'只再玩一次'});
 for(const id of ['XIA01','ENC_JOB02']){
  const choices=eligibleChoices(s,eventAt(id));assert.ok(choices.length>=3);assert.ok(choices.every(c=>!c.onlineSpecial));
 }
 s=later(s,91);recordOnlineOrdinaryEvent(s,{id:'study'});recordOnlineOrdinaryEvent(s,{id:'friend'});
 assert.ok(eligibleChoices(s,eventAt('XIA01')).some(c=>c.onlineSpecial));
 const active=show(s,'XIA01'),next=choose(active,'chase'),g=onlineGamblingState(next);
 assert.equal(next.lastResult.onlineGambling,true);assert.equal(g.ordinaryEvents,g.ordinaryAtLastEvent,'a wager hidden in a life event is not a separate ordinary interlude');
 assert.equal(getEventCandidates(continueStory(next,catalog),catalog).some(e=>e.onlineGambling),false);
});

test('recovered memories never offer wagers and the repeated last-bet wording evolves',()=>{
 const s=participant(),g=ensureOnlineGambling(s);g.status='RECOVERED';g.quitDay=0;g.recoveredDay=0;
 for(const id of ['OG26','OG27'])assert.ok(eligibleChoices(s,eventAt(id)).every(c=>!c.outcomes.some(o=>o.onlineResolution?.active)));
 g.status='ACTIVE';g.eventCounts.OG08=9;g.eventLastDays.OG08=0;
 assert.match(getEventPresentation(s,eventAt('OG08'),catalog).prompt,/最后一把？/);
 assert.match(eligibleChoices(s,eventAt('OG08')).find(c=>c.onlineAction==='small').label,/嗯/);
});

test('retired linear gambling stories stay out of new pools while already-active old saves can finish',()=>{
 const s=adult();s.flags.gambling_history=true;s.flags.gambling_exposed=true;
 const retired=['AGE20U','AGE20N','UG01','UG02','UG03','UG11','UG12'];
 assert.ok(getEventCandidates(s,catalog).every(e=>!retired.includes(e.id)));
 const e=eventAt('UG01'),active={...s,phase:'event',activeEvent:{eventId:e.id,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes[0].id]))}};
 const result=choose(active,'UG01_3');assert.equal(result.phase,'result');assert.equal(result.pending.some(p=>p.eventId==='UG02'),false);
});
test('a quit or recovered old save cannot wager through an already-active legacy story',()=>{
 for(const status of ['QUIT','RECOVERED'])for(const id of ['UG01','UG02']){
  const s=participant(),e=eventAt(id);s.behavior.onlineGambling.status=status;s.flags.gambling_quit=true;
  Object.assign(s,{phase:'event',activeEvent:{eventId:id,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes[0].id]))}});
  const bet=eligibleChoices(s,e).find(c=>['uw_gamble','uw_chase'].includes(c.profile));assert.equal(bet.disabled,true);
  const blocked=chooseEvent(s,id,bet.id,catalog);assert.ok(blocked.lastResult.error);assert.equal(blocked.cash,s.cash);assert.equal(blocked.rng,s.rng);assert.deepEqual(blocked.behavior,s.behavior);
  const free=eligibleChoices(s,e).find(c=>!c.disabled&&['uw_quit','observe','rest','family','repair'].includes(c.profile))||eligibleChoices(s,e).find(c=>!c.disabled);
  assert.ok(free);const next=chooseEvent(s,id,free.id,catalog);assert.equal(next.lastResult.error,undefined);assert.equal(next.behavior.onlineGambling.totalBets,s.behavior.onlineGambling.totalBets);
 }
});
test('weighted selection uses actual living costs rather than a lower fallback household budget',()=>{
 const s=participant();Object.assign(s,{age:25,turn:1,cash:50000,giftReceived:true});s.stats.health=80;
 // This period has already been paid day by day; nextTurn now only selects the
 // next ordinary story, with ¥500 remaining against ¥5,400 actual monthly costs.
 s.debtClock.day=180;s.debtClock.periodDays=180;s.survival.days=180;s.survival.livingAccrued=540000*6;
 const onlyPressure={...catalog,events:[eventAt('OG18')],history:[]};
 assert.equal(getMetrics(s).monthlyExpense,540000);assert.ok(getEventCandidates(s,onlyPressure).some(e=>e.id==='OG18'));
 const next=nextTurn(s,onlyPressure);assert.equal(next.lastResult?.error,undefined);assert.equal(next.phase,'event');assert.equal(next.activeEvent.eventId,'OG18');assert.equal(next.cash,50000);
});
