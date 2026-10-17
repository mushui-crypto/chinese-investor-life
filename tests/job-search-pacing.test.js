import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,eligibleChoices} from '../src/game/narrative.js';
import {applyAction,applyEffects,getActionAvailability} from '../src/game/core.js';
import {startCareer,advanceCareer,careerStatus} from '../src/game/careers.js';
import {syncEmployment,advanceEmployment} from '../src/game/employment.js';
import {startJobSearch,jobSearchState,jobSearchWait} from '../src/game/job-search.js';
import {jobOpportunities} from '../src/game/job-opportunities.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {rebuildOffers,advanceLifeDays} from '../src/game/life-arcs.js';
import {renderJobOpportunities} from '../src/ui/job-opportunities.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','history','endings','characters']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const save=s=>decodeSave(encodeSave(s));
function worker(seed='search-pacing'){
 const s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],occupation:'待业青年',cash:10000000});s.flags.college_not_admitted=true;s.flags.college_student=false;s.education.college=false;Object.assign(s.stats,{skill:80,discipline:80,health:100});s.behavior.fatigue=0;s.behavior.pending=null;s.lifeArcs.pending=null;ensureRoutine(s);resetRoutineDay(s,1);startCareer(s);syncEmployment(s);s.debtClock.day=60;s.career.lastDay=60;s.employment.lastDay=60;s.employment.tenure=60;return s;
}
function lose(s){s.monthlyIncome=0;s.occupation='离职待业';s.flags.employed=false;startJobSearch(s,{source:'layoff'});syncEmployment(s);return s;}
const api={cashChange:(s,n)=>s.cash+=n,charge:(s,n)=>{s.cash-=n;return 0;},stat:(s,v)=>{for(const [k,n] of Object.entries(v))s.stats[k]=Math.min(100,Math.max(0,s.stats[k]+n));}};
test('job losses persist one random 90–270 day wait without rerolling money, wages or market RNG',()=>{
 const waits=new Set();for(let i=0;i<80;i++){
  let s=lose(worker('search-'+i)),q=structuredClone(s.jobSearch);waits.add(q.readyOn-q.lostOn);assert.ok(q.readyOn-q.lostOn>=90&&q.readyOn-q.lostOn<=270);
  const before=structuredClone(s);for(let n=0;n<3;n++){jobOpportunities(s);jobSearchWait(s);s=save(s);assert.deepEqual(s,before);startJobSearch(s,{source:'layoff'});assert.deepEqual(s.jobSearch,q);}
  s.debtClock.day=q.lostOn+89;assert.ok(jobSearchWait(s));s.debtClock.day=q.readyOn-1;assert.ok(jobSearchWait(s));s.debtClock.day=q.readyOn;assert.equal(jobSearchWait(s),'');assert.equal(jobOpportunities(s).length,3);
  const {state:n,result}=applyAction(s,{type:'job_accept',offerId:jobOpportunities(s)[0].id});assert.equal(result.error,undefined);assert.ok(n.monthlyIncome>0);assert.equal(n.cash,s.cash);assert.equal(n.jobSearch.completedOn,q.readyOn);assert.deepEqual(save(n),n);
 }assert.ok(waits.size>30);
});
test('direct, daily, story and referral entries cannot bypass the search wait; temporary gigs remain usable',()=>{
 const s=lose(worker()),before=structuredClone(s);assert.equal(getActionAvailability(s,{type:'seek_job'}).allowed,false);assert.strictEqual(applyAction(s,{type:'seek_job'}).state,s);assert.throws(()=>startCareer(structuredClone(s)),/录用/);
 const effects=[{op:'flag',key:'employed',value:true}];assert.equal(applyEffects(s,effects,{profile:'job'}).state,s);
 const e={id:'qa-job',choices:[{id:'hire',label:'入职',profile:'job',outcomes:[{effects}]}]};assert.ok(eligibleChoices(s,e)[0].disabled);
 assert.ok(rebuildOffers(s).filter(o=>o.wage).every(o=>!o.allowed));assert.deepEqual(s,before);
 const day=applyAction(s,{type:'day_activity',choice:'job_hunt'});assert.equal(day.result.error,undefined);assert.equal(day.state.monthlyIncome,0);assert.deepEqual(day.state.jobSearch,s.jobSearch);
 assert.ok(getActionAvailability(s,{type:'day_activity',choice:'day_gig'}).allowed);
 const html=renderJobOpportunities(s,{esc:String,money:n=>'¥'+n/100});assert.match(html,/求职还在进行中/);assert.doesNotMatch(html,/90|270|[3-9].?个月|job-accept|readyOn/);
});
test('an already arranged referral defers the permanent job, pays trial work only once, and retains the same wait',()=>{
 const s=lose(worker()),q=structuredClone(s.jobSearch);s.lifeArcs.jobs=[{id:'reentry',due:60,kind:'work',pay:24000,wage:220000}];let cash=s.cash;
 advanceLifeDays(s,api);assert.equal(s.cash,cash+24000);assert.equal(s.monthlyIncome,0);assert.equal(s.lifeArcs.jobs[0].due,q.readyOn);advanceLifeDays(s,api);assert.equal(s.cash,cash+24000);
 s.debtClock.day=q.readyOn;advanceLifeDays(s,api);assert.equal(s.cash,cash+24000);assert.equal(s.monthlyIncome,220000);assert.equal(s.lifeArcs.jobs.length,0);
});
test('actual seeded layoff creates the window and legacy loss saves derive it from the original loss date',()=>{
 let laid;for(let i=0;i<15000;i++){const s=worker('actual-layoff-'+i);advanceEmployment(s,1,api,{startDate:'2013-03-01'});s.debtClock.day=61;if(s.employment.history.at(-1)?.kind==='layoff'){laid=s;break;}}
 assert.ok(laid);assert.equal(laid.jobSearch.lostOn,61);assert.ok(jobSearchWait(laid));const q=structuredClone(laid.jobSearch);delete laid.jobSearch;assert.deepEqual(jobSearchState(laid),q);syncEmployment(laid);assert.deepEqual(laid.jobSearch,q);assert.deepEqual(save(laid),laid);
 for(const mutate of [q=>q.readyOn=q.lostOn+89,q=>q.readyOn=q.lostOn+271,q=>q.lostOn=999999,q=>q.completedOn=q.lostOn,q=>q.source='unknown']){const n=structuredClone(laid);mutate(n.jobSearch);assert.throws(()=>save(n));}
});
test('promotion needs one year first, two more years next; a recent work incident restarts the 30-day review',()=>{
 const s=worker();s.career.lastDay=0;s.career.daysInLevel=0;
 for(let d=1;d<360;d++){s.debtClock.day=d;assert.equal(advanceCareer(s,d),null);}
 s.dayRoutine.wagePenalty=true;s.debtClock.day=360;assert.equal(advanceCareer(s,360),null);assert.equal(s.career.lastSetback,360);s.dayRoutine.wagePenalty=false;
 for(let d=361;d<390;d++){s.debtClock.day=d;assert.equal(advanceCareer(s,d),null);}
 s.debtClock.day=390;assert.ok(advanceCareer(s,390));assert.equal(s.career.level,1);assert.equal(careerStatus(s).needs[0].target,720);
 const saved=save(s);assert.equal(saved.career.lastSetback,360);
});
