import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlayableRun} from '../src/game/quick-start.js';
import {getMarketAccess,getGamblingAccess} from '../src/game/market-access.js';
import {educationStage,collegeAdmissionScore,advanceEducation} from '../src/game/education.js';
import {disciplineStatus,recordDisciplineExit,recordDisciplineMargin,recordDisciplineLiquidation,trackRisk} from '../src/game/behavior.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
import {createRun,chooseEvent} from '../src/game/narrative.js';

const read=name=>JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};
setSaveCatalog(catalog);
const start=(focus,seed='education')=>createPlayableRun({seed,familyId:'F01',startAt:'adult',childhood:focus},catalog);
const api={stat(s,delta){for(const [key,value] of Object.entries(delta))s.stats[key]=Math.max(0,Math.min(100,s.stats[key]+value));},metrics:s=>({cash:s.cash})};

test('ages one through sixteen each have three random authored growth events and fixed school stages',()=>{
 for(let age=1;age<=16;age++)assert.equal(catalog.events.filter(e=>e.category==='成长年记'&&e.age_min===age&&e.age_max===age).length,3,`age ${age}`);
 const s=start('study');for(const [age,name] of [[0,'学龄前'],[3,'幼儿园'],[6,'小学'],[12,'初中'],[15,'高中'],[18,'大学'],[22,'大学毕业后']]){s.age=age;assert.equal(educationStage(s).name,name);}
});

test('study attributes drive college admission while a low academic route can enter society',()=>{
 const study=start('study','college-study'),social=createRun({seed:'low-academic',familyId:'F01'},catalog);
 Object.assign(social.stats,{academic:8,discipline:20,skill:10,insight:10,stress:60});social.age=18;advanceEducation(social,17,18);
 assert.equal(study.education.college,true);assert.equal(study.flags.college_student,true);assert.ok(study.education.admissionScore>=38);assert.ok(study.seenEvents.includes('AGE18U'));
 assert.equal(social.education.college,false);assert.equal(social.flags.college_not_admitted,true);assert.ok(social.education.admissionScore<38);assert.ok(catalog.events.find(e=>e.id==='AGE18N').required_flags.includes('college_not_admitted'));
 const score=collegeAdmissionScore(study);study.stats.trust=0;assert.ok(Math.abs(collegeAdmissionScore(study)-score)<=5,'人缘不应主导升学');
 assert.deepEqual(decodeSave(encodeSave(study)),study);
});

test('stock, crypto, gambling and ponzi follow the 16/18/20/24 knowledge timeline',()=>{
 const s=start('study','access-story');s.marketProgress={firstExperienceAge:null,simulations:0,unlocked:{}};
 s.age=17.9;assert.equal(getMarketAccess(s,'stock').unlocked,false);
 s.age=18;assert.equal(s.flags.stock_aware,true);assert.equal(s.flags.crypto_aware,true);assert.equal(getMarketAccess(s,'stock').unlocked,true);assert.equal(getMarketAccess(s,'crypto').unlocked,true);
 assert.equal(getGamblingAccess(s).unlocked,false);s.age=20;s.flags.gambling_exposed=true;assert.equal(getGamblingAccess(s).unlocked,true);
 s.age=23.5;assert.equal(getMarketAccess(s,'ponzi').unlocked,false);s.age=24;s.flags.ponzi_exposed=true;assert.equal(getMarketAccess(s,'ponzi').unlocked,true);
});

test('crypto introduction choices teach or discuss without spending or changing employment',()=>{
 const event=catalog.events.find(e=>e.id==='AGE18N');
 for(const choice of event.choices){
  const s=createRun({seed:'crypto-introduction',familyId:'F01'},catalog);
  Object.assign(s,{age:18,phase:'event',activeEvent:{eventId:event.id,outcomes:Object.fromEntries(event.choices.map(c=>[c.id,c.outcomes[0].id]))}});
  s.flags.college_not_admitted=true;for(const key of Object.keys(s.stats))s.stats[key]=50;
  const restored=decodeSave(encodeSave(s)),next=chooseEvent(restored,event.id,choice.id,catalog);
  assert.equal(next.lastResult.error,undefined);assert.equal(next.flags.crypto_aware,true);
  for(const key of ['cash','familyReserve','positions','monthlyIncome','occupation'])assert.deepEqual(next[key],s[key]);
  assert.equal(next.flags.employed,s.flags.employed);assert.equal(next.lastResult.choice,choice.label);
  assert.equal(next.lastResult.text,choice.outcomes[0].text);assert.ok(next.lastResult.statChanges.length>0);
 }
});

test('discipline reacts to stop-loss, holding losers, liquidation and all-in behavior',()=>{
 const s=start('study','discipline');s.age=25;s.phase='planning';s.activeEvent=null;s.cash=1000000;s.behavior.heat=0;s.stats.stress=20;s.stats.discipline=70;
 assert.equal(disciplineStatus(s).level,'稳');const loser={kind:'futures',cost:500000,value:300000};assert.match(recordDisciplineExit(s,loser,api),/自律 \+2/);assert.equal(s.flags.strict_stop_loss,true);
 s.stats.discipline=25;s.behavior.heat=70;assert.equal(disciplineStatus(s).level,'上头风险高');assert.match(recordDisciplineMargin(s,loser,api),/自律 -2/);assert.equal(s.flags.held_loser,true);
 recordDisciplineLiquidation(s,loser,api);assert.equal(s.flags.discipline_liquidation,true);
 s.cash=100000;const before=s.stats.discipline;trackRisk(s,{type:'desk_order',product:'futures',amount:900000},0,api);assert.ok(s.stats.discipline<before);assert.equal(s.flags.impulsive_allin,true);
});
