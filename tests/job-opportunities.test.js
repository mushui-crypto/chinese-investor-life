import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyAction,getActionAvailability} from '../src/game/core.js';
import {startCareer,careerIdentity,advanceCareer,CAREERS} from '../src/game/careers.js';
import {syncEmployment} from '../src/game/employment.js';
import {jobOpportunities,jobOfferReason} from '../src/game/job-opportunities.js';
import {payrollBase} from '../src/game/payroll.js';
import {dailyWageQuote} from '../src/game/work-economy.js';
import {attendanceReason} from '../src/game/attendance.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {gameDate,addGameDays} from '../src/game/game-calendar.js';
import {renderJobOpportunities} from '../src/ui/job-opportunities.js';
import {renderCareerArrangements} from '../src/ui/day-routine.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?d.events:d;}setSaveCatalog(catalog);
const save=s=>decodeSave(encodeSave(s));
const ctx={esc:String,money:n=>'¥'+(n/100).toLocaleString('en-US'),icon:()=>''};
function adult(employed=true){
 const s=createRun({seed:'job-choices',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000,occupation:'待业青年',monthlyIncome:0});s.education.college=false;s.flags.college_student=false;s.flags.college_not_admitted=true;Object.assign(s.stats,{skill:60,academic:60,discipline:60,health:100});s.behavior.fatigue=0;s.behavior.pending=null;s.lifeArcs.pending=null;ensureRoutine(s);resetRoutineDay(s,1);
 if(employed){startCareer(s,{source:'job:apprentice',wage:320000});syncEmployment(s);s.debtClock.day=60;s.career.lastDay=60;s.career.daysInLevel=40;s.employment.lastDay=60;s.employment.tenure=60;}
 return s;
}
const accept=(s,key)=>{const o=jobOpportunities(s).find(o=>o.key===key);assert.ok(o);const out=applyAction(s,{type:'job_accept',offerId:o.id});assert.equal(out.result.error,undefined,out.result.error);return out;};
test('viewing and reloading opportunities does not change money, energy, RNG or job; company/industry combinations are genuine',()=>{
 const s=adult(),before=structuredClone(s),current=careerIdentity(s),offers=jobOpportunities(s);
 assert.equal(offers.length,4);assert.deepEqual(jobOpportunities(s),offers);assert.deepEqual(jobOpportunities(save(s)),offers);renderJobOpportunities(s,ctx);assert.deepEqual(s,before);
 const [same,internal,both,lateral]=offers;assert.notEqual(same.company,current.company);assert.equal(same.industry,current.industry);assert.equal(same.track,current.track);assert.ok(same.delta>0);
 assert.equal(internal.company,current.company);assert.notEqual(internal.industry,current.industry);assert.equal(internal.delta,0);assert.equal(internal.promotionDays,288);
 assert.notEqual(both.company,current.company);assert.notEqual(both.industry,current.industry);assert.notEqual(lateral.company,current.company);assert.equal(lateral.delta,0);
});
test('internal transfers retain company tenure and attendance, change career and actually use the faster promotion route',()=>{
 const s=adult(),before=careerIdentity(s),n=accept(s,'internal-transfer').state;
 assert.equal(n.cash,s.cash);assert.equal(n.monthlyIncome,s.monthlyIncome);assert.equal(n.actionPoints,s.actionPoints-1);assert.equal(n.employment.tenure,60);assert.equal(n.career.company,before.company);assert.notEqual(n.career.track,before.track);assert.equal(n.career.daysInLevel,0);assert.deepEqual(save(n),n);
 for(let day=61;day<348;day++){n.debtClock.day=day;assert.equal(advanceCareer(n,day),null);}
 n.debtClock.day=348;assert.ok(advanceCareer(n,348));assert.equal(n.career.level,1);assert.ok(n.monthlyIncome>s.monthlyIncome);
});
test('changing companies carries only relevant experience and cannot erase pending salary or pay cash on acceptance',()=>{
 const s=adult();s.payroll={version:1,lastAccruedDate:'2006-01-02',pending:[{month:'2006-01',gross:10000,net:10000}],history:[]};
 for(const key of ['same-industry','cross-industry','lateral-growth']){
  const o=jobOpportunities(s).find(o=>o.key===key),{state:n}=accept(s,key);
  assert.equal(n.employment.tenure,0);assert.equal(n.career.daysInLevel,key==='same-industry'?20:0);assert.deepEqual(n.payroll,s.payroll);assert.equal(n.cash,s.cash);assert.equal(n.monthlyIncome,o.wage);assert.equal(n.career.jobs,s.career.jobs+1);assert.match(jobOfferReason(n,o.id),/变化/);
 }
});
test('transfer day keeps the previous daily rate; the following date uses the selected salary',()=>{
 const s=adult(),date=gameDate(s),old=payrollBase(s,date).wage,{state:n}=accept(s,'same-industry');
 assert.equal(payrollBase(n,date).wage,old);const tomorrow=addGameDays(date,1),d=+tomorrow.slice(8),days=new Date(Date.UTC(+tomorrow.slice(0,4),+tomorrow.slice(5,7),0)).getUTCDate();
 assert.equal(payrollBase(n,date).pension,0);
 assert.equal(payrollBase(n,tomorrow).wage,Math.floor(n.monthlyIncome*d/days)-Math.floor(n.monthlyIncome*(d-1)/days));
});
test('two transfers on one date preserve the original daily rate and do not turn a pay rise into pension cash',()=>{
 const s=adult(),date=gameDate(s),base=payrollBase(s,date),once=accept(s,'same-industry').state,twice=accept(once,'cross-industry').state;
 assert.deepEqual(payrollBase(twice,date),base);assert.deepEqual(save(twice),twice);
 s.retirementIncome=60000;assert.equal(payrollBase(accept(s,'same-industry').state,date).pension,2000);
});
test('switching employer does not undo leave, lateness or a work-error deduction already incurred that day',()=>{
 const s=adult(),date=gameDate(s);s.attendance={job:1,lateDay:null,records:[{day:s.debtClock.day,job:1,kind:'leave',fired:false}]};s.behavior.leaveDays=1;
 const n=accept(s,'same-industry').state;assert.equal(n.behavior.leaveDays,1);assert.match(attendanceReason(n),/今天已经记录/);assert.equal(dailyWageQuote(n,payrollBase(n,date).total),0);assert.deepEqual(save(n),n);
 s.behavior.leaveDays=0;s.dayRoutine.lateForWork=true;s.dayRoutine.wagePenalty=true;
 const m=accept(s,'cross-industry').state;assert.equal(dailyWageQuote(m,payrollBase(m,date).total),dailyWageQuote(s,payrollBase(s,date).total));
});
test('first jobs include training and higher requirements; eligibility is enforced and failed choices cost nothing',()=>{
 const s=adult(false);s.stats.skill=5;s.stats.discipline=20;const offers=jobOpportunities(s);assert.equal(offers.length,3);assert.ok(offers[0].allowed);assert.equal(offers[1].promotionDays,288);assert.ok(offers[1].wage<offers[0].wage);assert.equal(offers[2].allowed,false);
 const a={type:'job_accept',offerId:offers[2].id};assert.equal(getActionAvailability(s,a).allowed,false);assert.equal(applyAction(s,a).state,s);
 const {state:n}=accept(s,'first-job');assert.ok(n.monthlyIncome>0);assert.equal(n.cash,s.cash);assert.equal(n.actionPoints,1);assert.deepEqual(save(n),n);
 const high=adult(false);high.stats.skill=80;high.stats.discipline=80;assert.equal(accept(high,'experienced').state.career.level,1);
});
test('a high current salary can receive a lower quote; no job, wage or energy changes until the player accepts',()=>{
 const s=adult();s.monthlyIncome=1000000;const before=structuredClone(s),offers=jobOpportunities(s);assert.ok(offers[0].delta<0);assert.ok(offers[2].delta<0);assert.equal(offers[1].delta,0);assert.match(renderJobOpportunities(s,ctx),/降薪/);assert.deepEqual(s,before);
 s.actionPoints=0;assert.match(renderJobOpportunities(s,ctx),/精力已用完/);assert.doesNotMatch(renderCareerArrangements(s,ctx),/disabled/);assert.equal(applyAction(s,{type:'job_accept',offerId:offers[0].id}).state,s);
});
test('college and underage lives do not get full-time opportunities; old career saves migrate without changing wages',()=>{
 const s=adult(false);s.age=20;s.education.college=true;assert.deepEqual(jobOpportunities(s),[]);s.age=17;s.education.college=false;assert.deepEqual(jobOpportunities(s),[]);
 const old=adult();delete old.career.company;delete old.career.industry;delete old.career.development;const wage=old.monthlyIncome;syncEmployment(old);assert.ok(old.career.company);assert.ok(old.career.industry);assert.equal(old.monthlyIncome,wage);assert.deepEqual(save(old),old);
});
