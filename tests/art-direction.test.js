import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRun,chooseEvent,getEventPresentation,eligibleChoices} from '../src/game/narrative.js';
import {applyEffects,applyAction} from '../src/game/core.js';
import {setSaveCatalog,decodeSave,encodeSave} from '../src/game/storage.js';
import {storyContextAllowed} from '../src/game/story-context.js';
import {currentResultCopy} from '../src/game/story-presentation.js';
import {employmentStatus} from '../src/game/employment.js';
import {ensureCareer} from '../src/game/careers.js';
import {advanceEducation} from '../src/game/education.js';
import {eventArt,resultArtKey} from '../src/ui/event-art.js';
import {DORM_KINDS,dormArt} from '../src/ui/dorm-art.js';
import {dailyScene} from '../src/ui/daily-scene.js';
import {wakeTransitionData,nightTransitionData} from '../src/ui/night-transition.js';
const read=n=>JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),history:read('history'),endings:read('endings'),characters:read('characters')};setSaveCatalog(catalog);
const event=id=>catalog.events.find(e=>e.id===id);
function student(){const s=createRun({familyId:'F01',seed:'art-context'},catalog);Object.assign(s,{age:20.5,turn:11,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000,monthlyIncome:0,giftReceived:true,occupation:'大学生'});s.education.college=true;s.flags.college_student=true;s.flags.college_not_admitted=false;s.flags.employed=false;return s;}
function resolve(s,e,index){s=structuredClone(s);s.phase='event';s.activeEvent={eventId:e.id,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes[0].id]))};return chooseEvent(s,e.id,e.choices[index].id,catalog);}
test('two dorm variants exist for every supported activity; rendering does not draw RNG',()=>{
 const s=student(),original=JSON.stringify(s);
 for(const kind of DORM_KINDS){const a=dormArt(s,kind),b=dormArt({...s,trading:{...s.trading,day:s.trading.day+1}},kind);assert.notEqual(a.src,b.src,kind);assert.deepEqual(dormArt(s,kind),a);for(const art of [a,b])assert.ok(existsSync(art.src),art.src);}
 assert.equal(JSON.stringify(s),original);s.age=22;for(const kind of DORM_KINDS)assert.equal(dormArt(s,kind),null);
});
test('college home activities use dorms, while class and night gigs retain their real location',()=>{
 const s=student();
 for(const [stage,choice,kind] of [[0,'breakfast','meal'],[3,'coursework','study-day'],[5,'learn','study-night'],[3,'rest','rest'],[3,'review','market-day'],[7,'stay','market-night'],[6,'rest','bedtime']]){
  s.dayRoutine={...s.dayRoutine,day:s.trading.day,stage,choices:{[stage]:choice},pending:null};assert.match(dailyScene(s).src,new RegExp('/dorm/'+kind+'-'));
 }
 s.dayRoutine={...s.dayRoutine,stage:1,choices:{1:'attend_class'}};assert.match(dailyScene(s).src,/daily\/college/);
 s.dayRoutine={...s.dayRoutine,stage:5,choices:{5:'night_gig'}};assert.match(dailyScene(s).src,/gig-night/);
});
test('sleep and all three wake outcomes retain dorm identity and outcome distinctions',()=>{
 const before=student();before.dayRoutine={...before.dayRoutine,stage:6,nightStreak:0};
 for(const wakeKind of ['fresh','alarm','late']){const after=structuredClone(before);after.trading.day++;after.debtClock.day++;after.dayRoutine={...after.dayRoutine,wakeKind,stage:wakeKind==='late'?2:0};after.behavior.fatigue=0;
  assert.match(wakeTransitionData(before,after).src,new RegExp('/dorm/wake-'+wakeKind+'-'));
  assert.match(nightTransitionData(before,after,{type:'calendar_day'}).src,/\/dorm\/sleep-/);
 }
});
test('adult relationships do not reuse a small child and college learning does not show a private apartment',()=>{
 const s=student();s.age=23;assert.equal(eventArt('XIA01',s).key,'relationships');
 assert.equal(eventArt('REC07',s).key,'personal-budget');
 assert.equal(eventArt('FAM01',{...s,age:50}).key,'personal-budget');
 assert.equal(eventArt('FAM01',{...s,familyId:'F11'}).key,'personal-budget');
 assert.equal(eventArt('FAM01',{...s,household:{...s.household,livingParent:false}}).key,'personal-budget');
 s.age=20;for(const id of ['AGE18U','AGE20U','OPT06','FND01','FUT01','REC07','FAM01'])assert.equal(eventArt(id,s).location,'dorm',id);
});
test('realized PnL and frozen funds choose distinct dorm images, independent of market direction',()=>{
 const s=student();for(const [settlement,pnl,kind] of [['realized',50000,'profit'],['realized',-10000,'loss'],['frozen',0,'frozen']]){
  const r={eventId:'FND01',context:{activity:'investment',profile:'fund',settlement,pnl}};
  assert.match(eventArt(r.eventId,s,undefined,resultArtKey(s,r)).src,new RegExp('/dorm/'+kind+'-'));
 }
});
test('homeowner problems require a home; old pending student housing event has concrete free choices',()=>{
 const s=student(),e=event('HOU07');assert.equal(storyContextAllowed(s,e),false);assert.equal(storyContextAllowed({...s,positions:[{kind:'housing',value:100000}]},e),true);
 for(const e of catalog.events.filter(e=>/^HOU/.test(e.id)))assert.equal(storyContextAllowed(s,e),e.id==='HOU01',e.id);
 const p=getEventPresentation(s,e,catalog);assert.match(p.title,/毕业后租房/);assert.doesNotMatch(p.title,/第一次认真算买房/);assert.match(p.prompt,/不需要交钱/);assert.equal(eventArt(e.id,s,p).location,'dorm');
 assert.ok(eligibleChoices(s,e).every(c=>!c.disabled));
 for(let i=0;i<3;i++){const n=resolve(s,e,i);assert.ok(!n.lastResult.error);assert.equal(n.cash,s.cash);assert.deepEqual(n.positions,s.positions);assert.equal(n.occupation,'大学生');assert.match(n.lastResult.text,/没有花钱|没有付款|没有支出/);}
});
test('homeowner information is free and does not sell unrelated assets or end employment',()=>{
 const s=student();Object.assign(s,{age:28,monthlyIncome:262000,occupation:'普通职员'});s.flags.employed=true;s.positions=[{kind:'housing',value:10000000}];
 for(const c of event('HOU07').choices)for(const o of c.outcomes)assert.ok(!o.effects.some(e=>['spend','liquidate_asset'].includes(e.op)||e.op==='flag'&&e.key==='employed'));
 s.positions=[];ensureCareer(s);const n=resolve(s,event('HOU07'),0);assert.ok(!n.lastResult.error,n.lastResult.text);assert.equal(n.cash,s.cash);assert.equal(n.monthlyIncome,s.monthlyIncome);assert.equal(n.occupation,s.occupation);
});
test('old paid housing receipts are not falsely relabelled as free',()=>{
 const s=student(),e=event('HOU07'),c=e.choices[0];s.lastResult={eventId:e.id,choiceId:c.id,outcomeId:c.outcomes[0].id,changes:[{label:'现金',value:-100000}],details:'支出 1000 元'};
 const before=JSON.stringify(s),r=currentResultCopy(s,catalog);assert.match(r.title,/此前已支付/);assert.equal(r.details,'支出 1000 元');assert.equal(JSON.stringify(s),before);
});
test('clearing an employment flag does not turn students, retirees or never-employed adults into resigned workers',()=>{
 for(const [age,occupation,income,next] of [[20.5,'大学生',0,'大学生'],[25,'待业青年',0,'待业青年'],[65,'退休',147000,'退休'],[25,'普通职员',262000,'离职待业']]){
  const s=student();Object.assign(s,{age,occupation,monthlyIncome:income});s.flags.employed=occupation==='普通职员';
  const {state:n,result}=applyEffects(s,[{op:'flag',key:'employed',value:false}]);assert.ok(!result.error);assert.equal(n.occupation,next);assert.equal(n.monthlyIncome,occupation==='普通职员'?0:income);
 }
});
test('legacy zero-income student identity repairs on load without replaying money or receipts',()=>{
 const s=student();s.occupation='离职待业';s.flags.employed=false;const n=decodeSave(encodeSave(s));
 assert.equal(n.occupation,'大学生');assert.equal(employmentStatus(n).label,'在读');assert.equal(n.cash,s.cash);assert.deepEqual(n.ledger,s.ledger);assert.deepEqual(n.logs,s.logs);assert.deepEqual(decodeSave(encodeSave(n)),n);
 advanceEducation(n,21.5,22);n.age=22;assert.equal(n.occupation,'应届毕业生');assert.equal(employmentStatus(n).key,'unemployed');
});
