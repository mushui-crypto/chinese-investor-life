import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,nextTurn} from '../src/game/narrative.js';
import {getMetrics,getActionAvailability} from '../src/game/core.js';
import {familyState,ensureFamily,familyCosts,familyStatus,refreshFamily,advanceFamilyDay,weddingQuote,familyScene} from '../src/game/family-life.js';
import {childAge} from '../src/game/household.js';
import {meetPerson,setPersonRelation} from '../src/game/people.js';
import {gameDate} from '../src/game/game-calendar.js';
import {livingLedger} from '../src/game/living-ledger.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {renderPeoplePage} from '../src/ui/people.js';
const catalog={};for(const name of ['events','families','characters','history','endings']){const x=JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url)));catalog[name]=name==='events'?x.events:x;}
setSaveCatalog(catalog);
function fixture(){
 const s=createRun({seed:'family-life',familyId:'F01',birthYear:1988},catalog);
 Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],age:25,cash:10000000,monthlyIncome:300000,occupation:'普通职员'});
 s.trading.calendar={turn:s.turn,day:s.trading.day,date:'2013-01-01'};
 s.education.college=false;s.flags.college_not_admitted=true;s.behavior.pending=null;s.lifeArcs.pending=null;s.behavior.fatigue=0;
 meetPerson(s,'N02');setPersonRelation(s,'N02',70);
 const f=ensureFamily(s);f.metOn='2011-01-01';f.visits=3;f.seen.lastStory='2013-01-01';
 return s;
}
const go=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);return n;};
const choose=(s,c)=>go(s,{type:'life_choice',scene:'family',choice:c,event:`${s.familyLife.pending}:${s.familyLife.pendingOn}`});
function at(s,date){s.trading.calendar={turn:s.turn,day:s.trading.day,date};return s;}
function pending(s,key){s.familyLife.pending=key;s.familyLife.pendingOn=gameDate(s);s.lifeArcs.pending='family';return s;}
function dating(){let s=go(fixture(),{type:'family_start'});s=choose(s,'date');s.familyLife.startedOn='2011-01-01';return s;}
function married(){let s=dating();pending(s,'marriage');s=choose(s,'plan');s.familyLife.wallet=200000;return go(s,{type:'family_wedding',gift:0,feast:300000,housing:'rent',transport:'public'});}
test('courtship has prerequisites and confirmation; dating is not cohabitation',()=>{
 const f=fixture();f.familyLife.visits=2;assert.equal(getActionAvailability(f,{type:'family_start'}).allowed,false);
 f.familyLife.visits=3;f.familyLife.metOn='2012-12-20';assert.equal(getActionAvailability(f,{type:'family_start'}).allowed,false);
 f.familyLife.metOn='2011-01-01';const s=go(f,{type:'family_start'});assert.equal(s.household.partner,false);assert.equal(s.familyLife.pending,'confession');
 const n=choose(s,'date');assert.equal(n.household.partner,true);assert.equal(n.familyLife.stage,'dating');assert.equal(familyCosts(n).partner,0);assert.equal(n.cash,f.cash);
 assert.equal(getActionAvailability(n,{type:'relationship',kind:'child'}).allowed,false);
 assert.equal(getActionAvailability(n,{type:'relationship',kind:'partner'}).allowed,false);
 assert.deepEqual(decodeSave(encodeSave(n)),n);
});
test('friendship and no-marriage choices remain available without paid loops',()=>{
 let s=choose(go(fixture(),{type:'family_start'}),'friends');assert.equal(s.familyLife.stage,'friends');refreshFamily(s);assert.equal(s.familyLife.pending,null);
 s=go(s,{type:'family_topic',topic:'romance'});s=choose(s,'date');s.familyLife.startedOn='2011-01-01';s=choose(pending(s,'marriage'),'unmarried');refreshFamily(s);assert.notEqual(s.familyLife.pending,'marriage');
});
test('wedding quote separates gifts, expenses, partner payment and vehicle asset',()=>{
 let s=dating();s=choose(pending(s,'marriage'),'plan');s.familyLife.wallet=500000;
 const q=weddingQuote(s,{gift:1880000,feast:1000000,housing:'rent',transport:'car'});
 assert.equal(q.partner,500000);assert.equal(q.player,5440000);
 const before=getMetrics(s);s=go(s,{type:'family_wedding',gift:1880000,feast:1000000,housing:'rent',transport:'car'});
 assert.equal(s.familyLife.stage,'married');assert.equal(s.familyLife.marriedOn,'2013-01-01');assert.equal(s.cash,before.cash-q.player);
 assert.equal(getMetrics(s).netWorth,before.netWorth-q.player+3000000);assert.equal(s.familyLife.wallet,0);
 assert.equal(s.familyLife.pending,'family_budget');assert.ok(livingLedger(s).some(e=>e.label.includes('彩礼')));
 s=choose(s,'balanced');const cash=s.cash;s=go(s,{type:'family_car_sell'});assert.equal(s.cash,cash+3000000);assert.equal(s.familyLife.car,null);
});
test('cannot overdraw a wedding or claim nonexistent housing; free smaller path exists',()=>{
 const s=dating();s.familyLife.stage='engaged';s.cash=100;
 assert.match(weddingQuote(s).reason,/还差/);assert.equal(getActionAvailability(s,{type:'family_wedding'}).allowed,false);
 s.cash=10000000;assert.match(weddingQuote(s,{housing:'owned'}).reason,/自有房产/);
});
test('pregnancy decisions and birth are date-based, saved, cannot be skipped or repeated',()=>{
 let s=choose(married(),'balanced');
 at(s,'2014-03-31');refreshFamily(s);assert.notEqual(s.familyLife.pending,'baby_plan');s.familyLife.pending=null;s.lifeArcs.pending=null;
 at(s,'2014-04-02');refreshFamily(s);assert.equal(s.familyLife.pending,'baby_plan');
 s=choose(s,'prepare');assert.equal(s.household.hasChild,false);assert.equal(s.familyLife.pregnancyOn,'2014-04-02');
 at(s,'2014-07-01');refreshFamily(s);assert.equal(s.familyLife.pending,'prenatal');
 const stopped=nextTurn(s,catalog);assert.equal(stopped.debtClock.day,s.debtClock.day);assert.match(stopped.lastResult.error,/林夏/);
 s=choose(s,'accompany');at(s,'2014-09-29');refreshFamily(s);assert.equal(s.familyLife.pending,'baby_supplies');s=choose(s,'help');
 at(s,'2014-12-28');refreshFamily(s);assert.equal(s.familyLife.pending,'birth');s=decodeSave(encodeSave(s));s=choose(s,'shared');
 assert.equal(childAge(s),0);assert.equal(s.household.childBornOn,'2014-12-28');assert.equal(s.familyLife.pregnancyOn,null);
 const cash=s.cash,again=act(s,{type:'life_choice',scene:'family',choice:'shared'},catalog);assert.ok(again.lastResult.error);assert.equal(again.cash,cash);
 at(s,'2015-06-28');assert.ok(childAge(s)>.49&&childAge(s)<.51);
});
test('no-child and postponement do not force pregnancy or charge expenses',()=>{
 let s=choose(married(),'balanced');at(s,'2014-06-01');pending(s,'baby_plan');let n=choose(s,'no_child');assert.equal(n.cash,s.cash);assert.equal(n.familyLife.pregnancyOn,null);refreshFamily(n);assert.notEqual(n.familyLife.pending,'baby_plan');
 n=choose(s,'postpone');assert.equal(n.familyLife.nextTopicOn,'2015-06-01');assert.equal(n.familyLife.pregnancyOn,null);
});
test('recurring dates honor budget, do not charge on reload and reciprocal gifts are not cash income',()=>{
 let s=dating();s.familyLife.nextTopicOn=null;s.familyLife.romanceBudget=20000;s.familyLife.wallet=100000;
 const api={cashChange:(x,n,label)=>{x.cash+=n;x.ledger.push({account:'cash',amount:n,label});},record:()=>{}};
 advanceFamilyDay(s,api);const cash=s.cash,wallet=s.familyLife.wallet;advanceFamilyDay(s,api);assert.equal(s.cash,cash);assert.equal(s.familyLife.wallet,wallet);
 at(s,'2013-01-16');advanceFamilyDay(s,api);assert.equal(s.cash,cash-10000);s.cash=0;at(s,'2013-02-01');advanceFamilyDay(s,api);assert.equal(s.cash,0);
 s=fixture();s.familyLife.stage='dating';s.household.partner=true;pending(s,'birthday');s=choose(s,'gift');const before=s.cash;s=choose(pending(s,'return_gift'),'thanks');assert.equal(s.cash,before);assert.equal(s.familyLife.giftValue,0);
});
test('legacy households retain relationships and unknown dates without fake past costs',()=>{
 const s=fixture();delete s.familyLife;s.household.partner=true;s.household.hasChild=true;s.household.childBornAge=24;
 const n=decodeSave(encodeSave(s));assert.equal(n.familyLife.stage,'together');assert.equal(n.familyLife.marriedOn,null);assert.equal(n.household.childBornOn,undefined);assert.equal(childAge(n),1);assert.equal(n.cash,s.cash);
});
test('people UI distinguishes player history age from child age and newborn care',()=>{
 let s=choose(married(),'balanced');s.household.hasChild=true;s.household.childBornOn='2013-01-01';meetPerson(s,'N09');
 const html=renderPeoplePage(s,catalog,{esc:x=>String(x),money:n=>'¥'+n/100,ageText:n=>n+'岁',icon:()=>''},{selectedId:'N09'});
 assert.match(html,/新生儿/);assert.match(html,/陪伴照护/);assert.doesNotMatch(html,/一起养育孩子|迎接孩子/);
});
test('stale family choices and unrelated pending stories cannot be overwritten by a wedding',()=>{
 let s=dating();const a={type:'life_choice',scene:'family',choice:'help',event:'baby_supplies:2012-01-01'};pending(s,'baby_supplies');
 assert.equal(getActionAvailability(s,a).allowed,false);assert.equal(act(s,a,catalog).cash,s.cash);
 s=dating();s.familyLife.stage='engaged';s.lifeArcs.pending='request';const wedding={type:'family_wedding',gift:0,feast:300000,housing:'rent',transport:'public'};
 assert.equal(getActionAvailability(s,wedding).allowed,false);assert.equal(act(s,wedding,catalog).lifeArcs.pending,'request');
});
test('lowering a monthly budget cannot charge above the revised remaining allowance',()=>{
 const s=dating();s.familyLife.romanceBudget=120000;const api={cashChange:(x,n)=>x.cash+=n,record:()=>{}};
 advanceFamilyDay(s,api);assert.equal(s.familyLife.dateSpent,60000);s.familyLife.romanceBudget=20000;
 at(s,'2013-01-16');const cash=s.cash;advanceFamilyDay(s,api);assert.equal(s.cash,cash);assert.equal(s.familyLife.dateSpent,60000);
});
test('birth with no money creates an ordinary bill and not an interest-bearing loan',()=>{
 let s=choose(married(),'balanced');s.cash=0;s.familyLife.wallet=0;s=choose(pending(s,'birth'),'shared');
 const bill=s.debts.find(d=>d.name==='家庭：分娩与初期照护');assert.equal(bill.principal,300000);assert.equal(bill.aprBps,0);assert.equal(bill.kind,'arrears');assert.equal(s.cash,0);assert.equal(s.household.hasChild,true);
 assert.ok(livingLedger(s).some(e=>e.unpaid===300000));assert.deepEqual(decodeSave(encodeSave(s)),s);
});
test('child milestones use calendar birthdays and unknown age cannot allow succession',()=>{
 const s=fixture();s.household.hasChild=true;s.household.childBornOn='2007-01-01';assert.equal(childAge(s),6);
 at(s,'2012-12-31');assert.ok(childAge(s)<6);delete s.household.childBornOn;s.age=60;assert.equal(getActionAvailability(s,{type:'relationship',kind:'succession'}).allowed,false);
});
test('save rejects future birth dates and mismatched family message records',()=>{
 const s=fixture();s.household.hasChild=true;s.household.childBornOn='2099-01-01';assert.throws(()=>encodeSave(s));
 const n=pending(fixture(),'meet');n.lifeArcs.pending=null;assert.throws(()=>encodeSave(n));
});
test('real daily settlement stops at a prenatal milestone and preserves it across every time shortcut',()=>{
 let s=choose(married(),'balanced');Object.assign(s.familyLife,{pregnancyOn:'2013-01-01',childPlan:'expecting',nextTopicOn:null});
 at(s,'2013-04-01');s.familyLife.seen.lastStory='2013-04-01';
 // A due family milestone is discovered by the same daily pipeline used in play.
 s=go(s,{type:'calendar_day'});assert.equal(s.familyLife.pending,'prenatal');
 const before=structuredClone(s);
 for(const action of [{type:'calendar_day'},{type:'survival_day'},{type:'wait_days',days:1},{type:'live_days',days:1},{type:'chapter_days',days:1},{type:'routine_days',days:1},{type:'market_tick'},{type:'market_day'},{type:'day_next'},{type:'day_activity',choice:'rest'}]){
  assert.equal(getActionAvailability(s,action).allowed,false,action.type);const n=act(s,action,catalog);assert.ok(n.lastResult.error);assert.equal(n.cash,before.cash);assert.equal(n.rng,before.rng);assert.equal(n.familyLife.pending,'prenatal');assert.equal(gameDate(n),gameDate(before));
 }
 s=choose(s,'accompany');assert.equal(s.familyLife.pending,null);assert.equal(s.familyLife.prenatal,true);assert.deepEqual(decodeSave(encodeSave(s)),s);
});
