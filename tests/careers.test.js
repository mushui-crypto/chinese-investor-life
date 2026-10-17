import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {applyAction,applyEffects} from '../src/game/core.js';
import {PROMOTION_DAYS,CAREERS,careerOffer,startCareer,ensureCareer,careerStatus,advanceCareer,validateCareer} from '../src/game/careers.js';
import {syncEmployment,advanceEmployment,validateEmployment} from '../src/game/employment.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {careerArt} from '../src/ui/career-art.js';
import {dailyScene,renderDailyStage} from '../src/ui/daily-scene.js';
import {renderEmployment} from '../src/ui/employment.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(seed='career-check'){
 const s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000,monthlyIncome:0,occupation:'待业青年',giftReceived:true});
 s.education.college=false;s.flags.college_student=false;s.flags.college_not_admitted=true;Object.assign(s.stats,{skill:80,discipline:80,academic:60,health:100});s.behavior.fatigue=0;s.behavior.pending=null;s.lifeArcs.pending=null;
 ensureRoutine(s);resetRoutineDay(s,1);return s;
}
const save=s=>decodeSave(encodeSave(s));
const api={cashChange:(s,n)=>s.cash+=n,charge:(s,n)=>{s.cash-=n;return 0;},stat:(s,v)=>{for(const [k,n] of Object.entries(v))s.stats[k]+=n;}};
const work=(s,day,options)=>{s.debtClock.day=day;return advanceCareer(s,day,options);};
test('job offers are story-dependent and seeded; reading or saving never rerolls a job',()=>{
 const tracks=new Set();for(let i=0;i<50;i++){const s=adult('career-'+i),before=structuredClone(s),o=careerOffer(s);assert.deepEqual(careerOffer(s),o);assert.deepEqual(s,before);tracks.add(o.track);}
 assert.equal(tracks.size,4);
 const s=adult();for(const [source,track] of [['job:apprentice','technical'],['job:referral','operations'],['job:reentry','logistics'],['ZHOU01','operations']])assert.equal(careerOffer(s,source).track,track);
 startCareer(s,{source:'job:apprentice'});const route=structuredClone(s.career);assert.deepEqual(save(s).career,route);ensureCareer(s);assert.deepEqual(s.career,route);
 s.age=20;s.education.college=true;assert.equal(careerOffer(s),null);s.age=16;assert.equal(startCareer(s),null);
});
test('each career promotes only with actual attendance and skills, one level at a time, without a cash payout',()=>{
 for(const [track,route] of Object.entries(CAREERS)){
  const s=adult();startCareer(s,{offer:{track,title:route.roles[0],wage:300000,entry:route.entry}});const cash=s.cash;
  for(let i=1;i<360;i++)assert.equal(work(s,i),null);
  assert.equal(s.occupation,route.roles[0]);s.stats.skill=0;assert.equal(work(s,360),null);s.stats.skill=80;s.stats.discipline=0;assert.equal(work(s,361),null);s.stats.discipline=80;
  const p=work(s,362);assert.equal(p.to,route.roles[1]);assert.equal(s.monthlyIncome,300000+route.raises[1]*100);assert.equal(s.cash,cash);assert.equal(s.career.daysInLevel,0);
  assert.equal(work(s,362),null);assert.equal(s.career.daysInLevel,0);
  for(let i=363;i<1083;i++)work(s,i);assert.equal(s.occupation,route.roles[2]);assert.equal(s.career.daysInLevel,0);validateCareer(s);
 }
});
test('leave, fatigue, lateness, work errors and poor health do not grant an unexplained promotion',()=>{
 for(const reason of ['off','fatigue','late','error','health']){
  const s=adult();startCareer(s,{source:'job:apprentice'});s.career.daysInLevel=359;s.career.lastDay=359;s.debtClock.day=359;
  if(reason==='fatigue')s.behavior.fatigue=65;if(reason==='late')s.dayRoutine.lateForWork=true;if(reason==='error')s.dayRoutine.wagePenalty=true;if(reason==='health')s.stats.health=34;
  assert.equal(work(s,360,{worked:reason!=='off'}),null,reason);assert.equal(s.career.level,0);assert.equal(s.career.daysInLevel,reason==='off'?359:360);
 }
});
test('promotion creates a saved work receipt; old salary is not back-paid and old service is not invented',()=>{
 const s=adult('promotion-0');s.monthlyIncome=350000;s.occupation='普通职员';const cash=s.cash;syncEmployment(s);assert.equal(s.monthlyIncome,350000);assert.equal(s.career.daysInLevel,0);assert.equal(s.cash,cash);
 s.debtClock.day=359;s.career.lastDay=359;s.career.daysInLevel=359;s.employment.lastDay=359;s.employment.tenure=359;
 // Find an ordinary assessment day, excluding independently seeded layoff/penalty events.
 const n=structuredClone(s);advanceEmployment(n,1,api,{startDate:'2006-03-01'});
 n.debtClock.day=360;assert.equal(n.employment.history.at(-1).kind,'promotion');assert.equal(n.cash,cash);assert.match(n.employment.history.at(-1).text,/次日计薪.*每月 10/);validateEmployment(n);assert.deepEqual(save(n).career,n.career);
 const tenure=n.employment.tenure;syncEmployment(n);assert.equal(n.employment.tenure,tenure);
 n.monthlyIncome=0;n.flags.employed=false;syncEmployment(n);n.debtClock.day=n.jobSearch.readyOn;startCareer(n,{source:'job:apprentice'});assert.equal(n.career.level,0);assert.equal(n.career.daysInLevel,0);assert.equal(n.career.jobs,2);
});
test('daily payroll uses the old wage on promotion day and new wage the following day',()=>{
 let s=adult('promotion-0');startCareer(s,{source:'job:apprentice',wage:310000});syncEmployment(s);s.debtClock.day=359;s.career.lastDay=359;s.career.daysInLevel=359;s.employment.lastDay=359;s.employment.tenure=359;s.trading.calendar={turn:s.turn,day:s.trading.day,date:'2006-03-01'};
 let out=applyAction(s,{type:'calendar_day'});assert.ok(!out.result.error,out.result.error);s=out.state;assert.equal(s.career.level,1);assert.equal(s.survival.last.earned,10000);assert.equal(s.survival.last.salary,0);
 out=applyAction(s,{type:'calendar_day'});assert.ok(!out.result.error,out.result.error);assert.equal(out.state.survival.last.earned,12258);assert.equal(out.state.survival.last.salary,0);assert.deepEqual(save(out.state).career,out.state.career);
});
test('student part-time work and unrelated authored outcomes never silently resign from a job',()=>{
 const unexpected=[];for(const e of catalog.events)for(const c of e.choices)for(const o of c.outcomes)if(o.effects.some(f=>f.op==='flag'&&f.key==='employed'&&f.value===false)&&e.id!=='JOB05'&&o.id!=='STK08_2_1')unexpected.push(o.id);
 assert.deepEqual(unexpected,[]);
 const s=adult();s.age=20.5;s.education.college=true;s.flags.college_student=true;s.flags.college_not_admitted=false;s.occupation='大学生';const {state:n,result}=applyEffects(s,[{op:'earn',amount_yuan:80}],{profile:'work'});assert.ok(!result.error);assert.equal(n.occupation,'大学生');assert.equal(n.monthlyIncome,0);assert.equal(n.career,undefined);
});
test('four occupations have two workplace variants and matching promotion UI; no orphan dialogue floats in empty rooms',()=>{
 const ctx={esc:String,money:n=>'¥'+n/100};for(const [track,route] of Object.entries(CAREERS)){
  const s=adult();startCareer(s,{offer:{track,title:route.roles[0],wage:300000,entry:route.entry}});syncEmployment(s);
  const a=careerArt(s),b=careerArt({...s,trading:{...s.trading,day:s.trading.day+1}});assert.notEqual(a.src,b.src);assert.ok(existsSync(a.src));assert.ok(existsSync(b.src));
  const scene=dailyScene(s);assert.equal(scene.src,a.src);assert.doesNotMatch(renderDailyStage(s,ctx),/daily-scene-caption/);const html=renderEmployment(s,ctx);assert.match(html,new RegExp(route.roles.join('|')));assert.match(html,/下一步/);assert.match(html,/360天/);
 }
});
test('invalid career tracks and future progress clocks cannot enter a save',()=>{
 const s=adult();startCareer(s);for(const mutate of [n=>n.career.track='unknown',n=>n.career.level=4,n=>n.career.daysInLevel=-1,n=>n.career.lastDay++,n=>n.career.jobs=0]){const n=structuredClone(s);mutate(n);assert.throws(()=>save(n));}
});
