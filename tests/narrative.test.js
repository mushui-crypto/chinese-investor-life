import {seedStudentStories,queueStudentStory} from '../src/game/student-stories.js';
import {DAILY_EVENTS} from '../src/game/day-routine.js';
import {TEEN_STORY_STEPS,teenStoryAge} from '../src/game/teen-stories.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, chooseEvent, continueStory, act, nextTurn, eligibleChoices, getEventCandidates, evaluateEndings, settleRun, resumeRun, historyShock, getEventPresentation } from '../src/game/narrative.js';
import { getActionAvailability, getMetrics, applyEffects, advanceTurn, getLegalStatus, PRODUCTS } from '../src/game/core.js';
import {newOnlineGambling,recordOnlineExposure,recordOnlineBet,recordOnlineBorrow,recordOnlineQuit} from '../src/game/online-gambling.js';
import {newCryptoLife,recordCryptoLifeTrade,cryptoEventAllowed} from '../src/game/crypto-life.js';
import {gameDate} from '../src/game/game-calendar.js';
import {attachSchemeFixture} from './helpers/scheme-life-fixture.js';

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const manifest = read('content_manifest');
const catalog = { events: read('events').events, families: read('families'), endings: read('endings'), history: read('history'), characters: read('characters') };
const copy = state => structuredClone(state);
const eventAt = id => catalog.events.find(event => event.id === id);
const legacyOnline = new Set(['AGE20U','AGE20N','UG01','UG02','UG03','UG11','UG12']);
const legacyScheme = new Set(['AGE24A',...Array.from({length:8},(_,i)=>`PON${String(i+1).padStart(2,'0')}`)]);
function born(seed = 'narrative-test', extra = {}) { return createRun({ seed, familyId: 'F01', name: '测试玩家', ...extra }, catalog); }
function resolve(state, preferred = null) {
  let next = state;
  for (let guard = 0; ['event', 'result'].includes(next.phase); guard++) {
    assert.ok(guard < 20, '同一回合的事件队列必须能清空');
    if (next.phase === 'result') { next = continueStory(next, catalog); continue; }
    const event = eventAt(next.activeEvent.eventId);
    const available = eligibleChoices(next, event).filter(choice => !choice.disabled);
    assert.ok(available.length, `${event.id} 应至少有一个可继续的选项`);
    const choice = available.find(choice => choice.profile === preferred) ?? available.find(choice => ['observe', 'family', 'rest', 'school', 'self_study'].includes(choice.profile)) ?? available[0];
    next = chooseEvent(next, event.id, choice.id, catalog);
    assert.equal(next.lastResult.error, undefined, `${event.id} / ${choice.id} 应可结算：${next.lastResult.error}`);
  }
  return next;
}
function prepared(age = 25) {
  const state = resolve(born());
  delete state.studentStories; // Explicit event fixtures do not start a fresh random school itinerary.
  state.age = age; state.phase = 'planning'; state.activeEvent = null; state.eventQueue = []; state.seenEvents = []; state.dueAnchors = [];
  state.cash = 100000000; state.monthlyIncome = 2000000; state.occupation = '稳定职业';
  state.stats = { health: 80, stress: 20, academic:70, discipline:70, skill: 70, insight: 70, trust: 80, fame: 30, credit: 90 };
  state.household = { partner: true, hasChild: true, livingParent: true };
  state.marketProgress = { firstExperienceAge: state.age >= 18 ? 18 : null, simulations:2, unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true])) };
  state.flags = { employed: true, shared_household: true, ever_indebted: true, career_history: true };
  return state;
}
const legalFixtures = new Map();
function attachLegalFixture(state, event, choice = null) {
  if (['legal', 'release'].includes(event.scene_scope)) state.runStats.legalNoticeIds = [event.id];
  const type = event.scene_scope === 'prison' || event.id === 'LAW02' ? 'prison' : event.id === 'LAW03' ? 'prison-investigation' : event.required_flags.includes('ever_released') ? 'released' : event.required_flags.includes('under_investigation') || choice?.profile === 'legal_cooperate' ? 'exposed' : null;
  if (!type) return state;
  if (!legalFixtures.has(type)) {
    let fixture = prepared(25); fixture.cash = 0; fixture.monthlyIncome = 0;
    fixture = applyEffects(fixture, [{ op: 'legal_case', case_type: 'fraud', profit_yuan: 0 }], { eventId: 'fixture-first' }).state;
    for (let i = 0; i < 2; i++) fixture = advanceTurn(fixture).state;
    if (type === 'prison-investigation') fixture = applyEffects(fixture, [{ op: 'legal_case', case_type: 'account_rental', profit_yuan: 0 }], { eventId: 'fixture-second' }).state;
    if (type !== 'exposed') for (let i = 0; i < 2; i++) fixture = advanceTurn(fixture).state;
    if (type === 'released') for (let guard = 0; getLegalStatus(fixture).inPrison; guard++) { assert.ok(guard < 30); fixture = advanceTurn(fixture).state; }
    legalFixtures.set(type, fixture);
  }
  const fixture = copy(legalFixtures.get(type));
  state.legal = fixture.legal; state.turn = fixture.turn;
  state.debts.push(...fixture.debts.filter(debt => debt.kind === 'legal'));
  for (const key of ['in_prison', 'under_investigation', 'ever_convicted', 'ever_released', 'legal_debt']) state.flags[key] = Boolean(fixture.flags[key]);
  state.runStats.legalNoticeIds = ['legal', 'release'].includes(event.scene_scope) ? [event.id] : [];
  return state;
}
function attachSchoolFixture(state,event){
 if(!event.studentStory)return;
 seedStudentStories(state,'fixture');state.age=event.age_min;state.studentStories.traits.riskTaking=30;
 const parent=eventAt(event.id.replace('_MORE',''));queueStudentStory(state,{events:[parent]});
 state.studentStories.pending=event.id;
}
function attachEncounterIdentity(state,event){
 if(!event.id.startsWith('ENC_'))return;
 state.age=Math.max(event.age_min,Math.min(event.age_max,state.age));
 const student=event.id.startsWith('ENC_COL'),retired=event.id.startsWith('ENC_RET'),employed=event.id.startsWith('ENC_JOB');
 state.education.college=student;state.flags.college_student=student;state.flags.college_not_admitted=!student;
 state.monthlyIncome=employed?300000:retired?200000:0;
 state.occupation=student?'大学生':retired?'退休':employed?'普通职员':'待业青年';
 if(event.id.startsWith('ENC_SEEK'))state.businesses=[];
 if(event.id.startsWith('ENC_BIZ'))state.businesses.push({id:'encounter-shop',name:'自己的小店',value:500000,monthlyProfit:10000,managedTurn:state.turn,openedTurn:state.turn,openedLifeDay:state.debtClock.day});
}
function attachOnlineFixture(state,event){
 if(!event.onlineGambling&&!event.choices.some(c=>c.onlineSpecial))return;
 const required=event.onlineGambling?.requiredState||[];
 state.age=Math.max(event.age_min,Math.min(event.age_max,state.age));
 state.behavior.onlineGambling=newOnlineGambling();
 if(event.id!=='OG01')recordOnlineExposure(state);
 if(event.id!=='OG01'&&!required.includes('neverBet')){
  recordOnlineBet(state,{stake:1000,returned:0,chasing:true});
  recordOnlineBorrow(state,{amount:10000,debtId:'debt'});
  recordOnlineBet(state,{stake:1000,returned:500000,bigWin:true});
  if(required.includes('lastLoss'))recordOnlineBet(state,{stake:1000,returned:0});
  if(required.includes('lastGuruWin'))recordOnlineBet(state,{stake:1000,returned:1500,action:'guru'});
  if(required.includes('lastModelWin'))recordOnlineBet(state,{stake:1000,returned:1500,action:'model'});
  if(required.includes('lastModelLoss'))recordOnlineBet(state,{stake:1000,returned:0,action:'model'});
  if(required.includes('borrowedWin'))recordOnlineBet(state,{stake:10000,returned:15000,action:'borrow',borrowed:10000});
  Object.assign(state.behavior.onlineGambling.tendencies,{chasing:30,confidence:30,casualGambling:30,guruDependence:30,patternBelief:30,bigWinMemory:30});
 }
 if(required.includes('QUIT')){
  recordOnlineQuit(state);state.debtClock.day+=180;
 }
 if(required.includes('yearsSinceExposure'))state.debtClock.day+=1800;
 if(required.includes('livingPressure'))state.cash=20000;
 if(required.includes('payday')){
  const date=gameDate(state),[y,m]=date.split('-').map(Number),month=new Date(Date.UTC(y,m-3,1)).toISOString().slice(0,7),payday=new Date(Date.UTC(y,m-2,10)).toISOString().slice(0,10);
  state.payroll={version:1,lastAccruedDate:date,pending:[],history:[{month,gross:100000,net:100000,payday}]};
 }
 if(required.includes('recentPromotion')){
  state.debtClock.day=Math.max(360,state.debtClock.day);
  Object.assign(state.employment,{lastDay:state.debtClock.day,tenure:360});
  state.employment.history.push({kind:'promotion',day:state.debtClock.day,date:gameDate(state),amount:50000,owed:0,wage:state.monthlyIncome-50000,tenure:360,text:'岗位晋升，工资提高。'});
 }
}
// Every dynamic node gets evidence for its own prerequisite, rather than unlocking all
// branches at once. Frozen withdrawal choices are tested as explicit rejected actions.
function attachCryptoFixture(state,event){
 if(event.schemeLife)return;
 if(!event.cryptoLife&&!event.choices.some(c=>c.cryptoSpecial))return;
 state.age=Math.max(event.age_min,Math.min(event.age_max,state.age));state.debtClock.day=Math.max(state.debtClock.day,1000);
 const g=state.behavior.cryptoLife=newCryptoLife(),now=state.debtClock.day,required=event.cryptoLife?.requiredState||[];
 if(event.id!=='CL01')Object.assign(g,{exposed:true,status:'EXPOSED',exposedDay:0});
 let serial=0;
 const buy=(branch,value=100000)=>{const p={id:'crypto-fixture-'+serial++,name:'测试虚构资产',kind:branch==='scheme'?'ponzi':branch==='leverage'?'crypto_perp':'crypto',cryptoLifeBranch:branch,cost:100000,value,underlying:branch==='alt'?'CHI':'CLG',instrument:branch==='alt'?'CHI':'CLG',entryPrice:10000,lastPrice:10000,lockUntilTurn:0,openedLifeDay:now,units:10000,margin:100000,leverage:100,direction:'long',liquidation:1000,feesPaid:0,sameDay:true,openedDay:state.trading.day};if(branch==='scheme'){p.bookBalance=100000;p.cryptoScheme={status:'paying',joinedDay:now,lastPaidDay:now,lastTransitionDay:now,paymentCount:0,paid:0,warningDay:null,warningSeen:false,lastPageBalance:100000};}state.positions.push(p);recordCryptoLifeTrade(state,p,{action:'buy',cashFlow:-100000});return p;};
 const close=(p,returned,extra={})=>{state.positions=state.positions.filter(x=>x!==p);recordCryptoLifeTrade(state,p,{action:'sell',cashFlow:returned,pnl:returned-p.cost,...extra});};
 let spot;if(required.includes('spotHeld')||required.includes('cryptoHeld')||event.id==='REL02')spot=buy('spot',event.id==='CL05'?60000:event.id==='CL04'?220000:125000);
 if(event.id==='CL06'){spot.value=100000;g.positionHistory[spot.id].minReturnBps=-3000;}
 if(required.includes('altcoinHeld'))buy('alt',event.id==='CL12'?1000:220000);
 if(required.includes('altcoinExposed'))g.altcoinExposed=true;
 if(required.includes('FOMO'))g.tendencies.FOMO=30;
 state.trading.quotes.CHI={price:15000,open:10000,history:[10000,12000,15000]};state.trading.quotes.CLG={price:13000,open:10000,history:[10000,11000,13000]};
 if(required.includes('leverageExposed'))g.leverageExposed=true;
 if(required.includes('firstLeverage')||required.includes('highLeverage'))buy('leverage');
 if(required.some(k=>['leverageSettledWin','leverageLiquidated','directionCorrect','overnightLoss','wageWin'].includes(k))){const p=buy('leverage');close(p,required.includes('leverageSettledWin')||required.includes('wageWin')?300000:0,{action:required.includes('leverageSettledWin')||required.includes('wageWin')?'close':'liquidation',directionCorrect:required.includes('directionCorrect'),overnightLoss:required.includes('overnightLoss')});}
 if(event.id==='CL32')g.highLeverage=true;
 // The later CL17 borrowing option follows an earlier chosen chase; the real
 // liquidation, chase and loan sequence is covered by the integration suite.
 if(event.id==='CL17')g.tendencies.chasing=8;
 if(required.includes('schemeExposed'))g.schemeExposed=true;
 if(required.includes('schemeHeld')||required.includes('schemePaidOnce')){const p=buy('scheme');if(required.some(k=>['schemePaidOnce','schemePaidMany'].includes(k))){for(let i=0;i<6;i++)recordCryptoLifeTrade(state,p,{action:'payment',cashFlow:1000,pnl:1000});p.cryptoScheme.paymentCount=6;p.cryptoScheme.paid=6000;}
  if(required.includes('schemeWarning')){p.cryptoScheme.status='warning';p.cryptoScheme.warningDay=now;recordCryptoLifeTrade(state,p,{action:'warning',cashFlow:0,schemeWarning:true});}
  if(required.includes('schemeMaintenance')||required.includes('schemeSilent')){p.cryptoScheme.status='frozen';p.cryptoScheme.warningDay=now;p.frozen=true;p.value=0;}
 }
 if(required.includes('schemeFailed')){const p=buy('scheme');close(p,0,{action:'scheme_failure',schemeFailure:true});}
 if(required.includes('schemeEscapedFailure')){const p=buy('scheme');recordCryptoLifeTrade(state,p,{action:'warning',cashFlow:0,schemeWarning:true});close(p,100000);recordCryptoLifeTrade(state,p,{action:'scheme_failure_news',cashFlow:0,schemeFailureNews:true});}
 if(required.includes('lifeSalary')){const date=gameDate(state),[y,m]=date.split('-').map(Number),month=new Date(Date.UTC(y,m-3,1)).toISOString().slice(0,7),payday=new Date(Date.UTC(y,m-2,10)).toISOString().slice(0,10);state.payroll={version:1,lastAccruedDate:date,pending:[],history:[{month,gross:100000,net:100000,payday}]};}
 if(required.includes('lifeUnemployed')){state.age=Math.max(22,state.age);state.monthlyIncome=0;state.occupation='离职待业';}
 if(required.includes('bigWinMemory')||event.id==='ENC_JOB03')g.tendencies.bigWinMemory=30;
 if(required.includes('lifeHome'))state.flags.housing_plan=true;
 if(required.includes('lifeGathering'))state.flags.friend_gathering=true;
 if(required.includes('workTrouble'))state.flags.work_trouble=true;
 if(required.includes('exited')||required.includes('recovered')){const p=buy('spot');close(p,100000);Object.assign(g,{status:'CRYPTO_EXITED',emptySinceDay:0,lastBehaviorDay:0,quitDay:0,exitedDay:now});}
}
function show(state, eventId, choice = null) {
 const event=eventAt(eventId);attachSchoolFixture(state,event);attachEncounterIdentity(state,event);attachOnlineFixture(state,event);attachCryptoFixture(state,event);
 attachSchemeFixture(state,event,choice);
 const prepared={...state,seenEvents:[...state.seenEvents,...TEEN_STORY_STEPS.map(r=>r.id)].filter(id=>id!==eventId),phase:'planning',activeEvent:null,eventQueue:[eventId]};
 // These entries are retired from the new pool, but an old save may already be displaying one.
 if(legacyOnline.has(eventId)||legacyScheme.has(eventId))return {...prepared,phase:'event',eventQueue:[],activeEvent:{eventId,outcomes:Object.fromEntries(event.choices.map(c=>[c.id,c.outcomes[0].id]))}};
 return continueStory(prepared,catalog);
}

// These assertions use the production catalog, not a reduced test-only pool.
test('the complete catalog and all categories participate in eligibility', () => {
  assert.equal(catalog.events.length, manifest.events);
  const reached = new Set();
  for (const event of catalog.events) {
    const state = prepared(Math.max(event.age_min, teenStoryAge(event.id)||0, ['REC02','REC03'].includes(event.id)?22:event.kind === 'world' ? 20 : 0));
    for (const key of event.required_flags) state.flags[key] = true;
    if(event.id==='REL03')state.household.childBornAge=state.age-6;
    state.debts = [{ id: 'test-debt', name: '测试债务', principal: 10000, interest: 0, aprBps: 800, monthsLeft: 12, overdue: true, purpose: 'test' }];
    state.claims = [{ id: 'test-claim', name: '待追偿', face: 10000, value: 10000 }];
    state.positions = [{ id: 'test-stock', name: '测试股票', kind: 'stock', cost: 10000, value: 10000, lockUntilTurn: 0 }];
    if(event.id==='HOU07')state.positions.push({id:'owned-home',kind:'housing',cost:10000000,value:10000000,lockUntilTurn:0,underlying:'housing',entryPrice:10000,lastPrice:10000});
    if(event.id==='REC07')Object.assign(state.debts[0],{kind:'friend',overdue:true});
    attachLegalFixture(state, event);
    attachEncounterIdentity(state,event);
    attachSchoolFixture(state,event);
    attachOnlineFixture(state,event);
    attachCryptoFixture(state,event);
    attachSchemeFixture(state,event);
    if(event.studentStory)state.eventQueue=[]; // Candidate listing excludes events already queued.
    if (event.kind === 'anchor') state.dueAnchors.push(event.id);
    if (event.kind === 'world') state.runStats.worldQueue.push(event.id);
    assert.equal(getEventCandidates(state, catalog).some(item => item.id === event.id), !legacyOnline.has(event.id)&&!legacyScheme.has(event.id), `${event.id} 候选资格与当前/兼容目录不符`);
    reached.add(event.category);
  }
  assert.equal(reached.size, manifest.categories);
});

test('random family selection is seeded, supports all twelve families, and explicit selection works', () => {
  assert.deepEqual(born('same', { familyId: undefined }), born('same', { familyId: undefined }));
  const families = new Set();
  for (let i = 0; i < 1200; i++) families.add(born(`family-${i}`, { familyId: undefined }).familyId);
  assert.equal(families.size, 12);
  for (const family of catalog.families) assert.equal(born('chosen', { familyId: family.id }).familyId, family.id);
});

test('outcomes are locked before choice and survive JSON save / reload without reroll', () => {
  const active = show(prepared(), 'OPT01');
  assert.equal(active.phase, 'event');
  assert.deepEqual(continueStory(active, catalog).activeEvent, active.activeEvent);
  const choice = eligibleChoices(active, eventAt('OPT01')).find(item => !item.disabled);
  const replay = JSON.parse(JSON.stringify(active));
  const a = chooseEvent(active, 'OPT01', choice.id, catalog);
  const b = chooseEvent(replay, 'OPT01', choice.id, catalog);
  assert.deepEqual(a, b);
  assert.equal(a.lastResult.outcomeId, active.activeEvent.outcomes[choice.id]);
  const duplicate = chooseEvent(a, 'OPT01', choice.id, catalog);
  assert.ok(duplicate.lastResult.error);
  assert.equal(duplicate.cash, a.cash);
  assert.equal(duplicate.storyHistory.length, a.storyHistory.length);
});

test('all childhood and world-memory events retain a safe choice; adult finance is blocked', () => {
  for (const event of catalog.events.filter(item => item.age_min < 18 || item.kind === 'world')) {
    const state = prepared(12);
    const choices = eligibleChoices(state, event);
    assert.ok(choices.some(choice => !choice.disabled), event.id);
    for (const choice of choices) if (['stock', 'contract', 'options', 'bank', 'netloan', 'angel', 'business', 'ponzi'].includes(choice.profile)) assert.ok(choice.disabled);
  }
  const noDebt = prepared(); noDebt.debts = [];
  assert.ok(eligibleChoices(noDebt, eventAt('DEB08')).filter(choice => choice.profile === 'repay').every(choice => choice.disabled));
});

test('all authored chain edges register concrete due dates exactly once', () => {
  let checked = 0;
  for (const event of catalog.events) for (const choice of event.choices) for (const outcome of choice.outcomes) {
    if (!outcome.schedule.length) continue;
    const state = prepared(event.age_max < 18 ? event.age_max : Math.max(18, event.age_min));
    for (const key of event.required_flags) state.flags[key] = true;
    if(event.id==='REL03')state.household.childBornAge=state.age-6;
    state.debts = [{ id: 'debt', name: '债务', principal: 100000, interest: 0, aprBps: 800, monthsLeft: 24, overdue: false, purpose: 'test' }];
    state.claims = [{ id: 'claim', name: '待追偿', face: 100000, value: 100000 }];
    let active = show(state, event.id);
    // Force an authored branch here to prove every edge is wired, independently of its probability.
    active.activeEvent.outcomes[choice.id] = outcome.id;
    const result = chooseEvent(active, event.id, choice.id, catalog);
    assert.equal(result.lastResult.error, undefined, `${event.id}: ${result.lastResult.error}`);
    for (const edge of outcome.schedule) {
      const item = result.pending.find(pending => pending.eventId === edge.event_id);
      if(legacyOnline.has(event.id)||legacyScheme.has(event.id)){assert.equal(item,undefined,'旧风险事件完成后不得指定下一风险事件');continue;}
      assert.ok(item, `${event.id} → ${edge.event_id}`);
      assert.equal(item.dueTurn, state.turn + edge.after_turns);
      assert.ok(item.expiresTurn >= item.dueTurn);
    }
    assert.equal(chooseEvent(result, event.id, choice.id, catalog).pending.length, result.pending.length);
    checked += outcome.schedule.length;
  }
  assert.equal(checked, manifest.scheduled_edges);
});

test('ineligible scheduled stories wait then expire without inventing a relationship or asset', () => {
  let state = prepared();
  state.household.partner = false;
  state.pending = [{ id: 'missing-partner', eventId: 'REL01', dueTurn: 0, expiresTurn: 0, reason: '以前的邀约' }];
  state = nextTurn(state, catalog);
  assert.equal(state.pending.length, 0);
  assert.equal(state.household.partner, false);
  assert.ok(state.runStats.expiredChains.some(item => item.eventId === 'REL01'));
  assert.ok(state.logs.some(log => log.id === 'chain-expired-missing-partner'));
});

test('late anchors survive their original exact-age window', () => {
  const state = prepared(23);
  state.dueAnchors = ['MAIN05'];
  const next = nextTurn(state, catalog);
  assert.ok(next.activeEvent.eventId === 'MAIN05' || next.eventQueue.includes('MAIN05'));
  const completed = resolve(next);
  assert.ok(completed.seenEvents.includes('MAIN05'));
});

test('every remix has six to ten distinct spaced prototypes', () => {
  for (let seed = 0; seed < 40; seed++) {
    const plan = born(`remix-${seed}`).runStats.remixPlan;
    assert.ok(plan.length >= 6 && plan.length <= 10);
    assert.equal(new Set(plan.map(item => item.eventId)).size, plan.length);
    assert.ok(plan.every(item => item.age >= 18 && item.age < 80));
    for (let i = 1; i < plan.length; i++) assert.ok(plan[i].age - plan[i - 1].age >= 3, '冲击间应有生活回合');
  }
});

test('historical news is not announced before its real date and never hits more than once per turn', () => {
  let state = born('historical', { mode: 'history', birthYear: 1988 });let funded=false; // Isolate the historical schedule.

  let guard = 0;
  while (state.phase !== 'ended') {
    assert.ok(guard++ < 150);
    state = resolve(state);
    if (state.phase === 'ended') break;
    if(state.age>=18&&!funded){state.cash+=1e9;funded=true;}
    if(state.age>=18&&state.stats.health<=30)state=act(state,{type:'hospital'},catalog);
    if(state.age>=18&&state.monthlyIncome<getMetrics(state).monthlyExpense&&state.actionPoints>0)state=act(state,{type:'seek_job'},catalog);
    state = nextTurn(state, catalog);
    for (const item of state.runStats.worldLog) {
      const parts = item.historicalDate.split('-').map(Number);
      const date = parts[0] + ((parts[1] ?? 1) - 1) / 12 + ((parts[2] ?? 1) - 1) / 366;
      assert.ok(state.birthYear + item.age >= date, item.eventId);
    }
  }
  const logs = state.runStats.worldLog;
  assert.equal(new Set(logs.map(item => item.turn)).size, logs.length);
  assert.equal(new Set(logs.map(item => item.eventId)).size, logs.length);
  assert.ok(!state.discoveredHistory.includes('HST01'));
  assert.ok(!state.discoveredHistory.includes('HST02'));
  assert.ok(state.discoveredHistory.includes('HST24'));
});

test('historical special shocks target the named exposure instead of every asset', () => {
  const shock = id => historyShock(catalog.history.find(item => item.id === id));
  assert.deepEqual(shock('HST18').exposureFilter.underlyings, ['WTI_2020_05']);
  assert.deepEqual(shock('HST21').exposureFilter.underlyings, ['UST', 'LUNA']);
  assert.deepEqual(shock('HST23').exposureFilter.underlyings, ['FTX']);
  assert.deepEqual(shock('HST12').returns, {});
  assert.ok(catalog.history.every(item => historyShock(item).channels.length));
});

test('full lifetime resolves all twelve chapters and ends at 80, with deterministic replay', () => {
  function play(seed) {
    let state = born(seed),funded=false; // Fund the full-chapter fixture.

    let turns = 0;
    while (state.phase !== 'ended') {
      state = resolve(state);
      if (state.phase === 'ended') break;
      if(state.age>=18&&!funded){state.cash+=1e9;funded=true;}
      if(state.age>=18&&state.stats.health<=30)state=act(state,{type:'hospital'},catalog);
      if (state.age >= 18) {if(state.monthlyIncome<getMetrics(state).monthlyExpense*1.3)state=act(state,{type:'seek_job'},catalog);state = act(state, { type: 'work' }, catalog);}
      if(state.dayRoutine?.pending){const e=DAILY_EVENTS[state.dayRoutine.pending],choice=e.choices.find(c=>getActionAvailability(state,{type:'day_event_choice',choice:c[0]}).allowed);assert.ok(choice);state=act(state,{type:'day_event_choice',choice:choice[0]},catalog);}
      state = nextTurn(state, catalog);
      assert.ok(turns++ < 140, '全人生必须有终点');
    }
    assert.equal(state.age, 80);
    assert.equal(state.seenEvents.filter(id => id.startsWith('MAIN')).length, 12);
    assert.equal(state.dueAnchors.length, 0);
    assert.equal(state.runStats.shocksApplied.length, state.runStats.remixPlan.length);
    assert.ok(state.ending);
    assert.equal(new Set(state.seenEvents).size, state.seenEvents.length);
    return state;
  }
  assert.deepEqual(play('whole-life'), play('whole-life'));
});

test('settlement and resume preserve assets and debts and do not rerun the current turn', () => {
  let state = prepared(55);
  state.debts = [{ id: 'keep', name: '未清债务', principal: 100000, interest: 100, aprBps: 800, monthsLeft: 12, purpose: 'test', overdue: false }];
  const before = { cash: state.cash, debts: copy(state.debts), turn: state.turn, age: state.age };
  state = settleRun(state, catalog);
  assert.equal(state.phase, 'ended');
  assert.ok(state.matchedEndings.some(item => item.id === 'E24'));
  state = resumeRun(state, catalog);
  assert.equal(state.phase, 'planning');
  assert.deepEqual({ cash: state.cash, debts: state.debts, turn: state.turn, age: state.age }, before);
  assert.ok(settleRun(prepared(54), catalog).lastResult.error);
  assert.ok(resumeRun(settleRun(prepared(80), catalog), catalog).lastResult.error);
});

test('financial, debt, health and relationship endings use distinct current conditions', () => {
  const wealth = prepared(60); wealth.cash = 11000000000;
  assert.equal(evaluateEndings(wealth, catalog)[0].id, 'E01');
  const debtor = prepared(60); debtor.cash = 0; debtor.flags.restructuring = true;
  debtor.debts = [{ id: 'debt', name: '债务', principal: 10000000, interest: 0, monthsLeft: 12, aprBps: 1800, overdue: true, purpose: 'test' }];
  assert.ok(evaluateEndings(debtor, catalog).some(item => item.id === 'E09'));
  assert.ok(evaluateEndings(debtor, catalog).some(item => item.id === 'E10'));
  const health = prepared(60); health.flags.recovering_health = true; health.stats.health = 70; health.stats.stress = 20;
  assert.ok(evaluateEndings(health, catalog).some(item => item.id === 'E21'));
  const family = prepared(60); family.flags.succession_released = true;
  assert.ok(evaluateEndings(family, catalog).some(item => item.id === 'E22'));
  assert.ok(getMetrics(debtor).debt > 0);
});

test('presentation replaces author instructions and labels remixed and childhood history', () => {
  const state = prepared(28);
  for (const id of ['MAIN06', 'MAIN07', 'MAIN08']) assert.doesNotMatch(getEventPresentation(state, eventAt(id), catalog).prompt, /按当前|替换|插入|玩家/);
  assert.match(getEventPresentation(state, eventAt('HST01'), catalog).modeLabel, /乱流/);
  state.age = 12; state.mode = 'history';
  assert.match(getEventPresentation(state, eventAt('HST01'), catalog).prompt, /还没有自己的投资账户/);
});

test('all authored outcomes execute through the real core without an unimplemented operation', () => {
  let count = 0;
  for (const event of catalog.events) for (const choice of event.choices) for (const outcome of choice.outcomes) {
    const state = prepared(event.category==='成长年记'?event.age_min:event.age_max < 18 ? event.age_max : Math.max(55, event.age_min));
    for (const key of event.required_flags) state.flags[key] = true;
    if(event.id==='REL03')state.household.childBornAge=state.age-6;
    state.debts = [{ id: 'debt', name: '债务', principal: 100000, interest: 0, aprBps: 800, monthsLeft: 24, overdue: event.required_flags.includes('overdue'), purpose: 'test' }];
    state.claims = [{ id: 'claim', name: '待追偿', face: 100000, value: 100000 }];
    state.positions = [{ id: 'stock', name: '可售股票', kind: 'stock', cost: 100000, value: 100000, lockUntilTurn: 0, underlying: 'stock', entryPrice: 10000, lastPrice: 10000, units: 10 }];
    state.businesses = [{ id: 'shop', name: '经营小店', value: 100000, monthlyProfit: 100000 }];
    if(event.id==='HOU07')state.positions.push({id:'owned-home',kind:'housing',cost:10000000,value:10000000,lockUntilTurn:0,underlying:'housing',entryPrice:10000,lastPrice:10000});
    if(event.id==='REC07')Object.assign(state.debts[0],{kind:'friend',overdue:true});
    attachLegalFixture(state, event, choice);
    const active = show(state, event.id, choice);
    assert.equal(active.activeEvent?.eventId, event.id);
    active.activeEvent.outcomes[choice.id] = outcome.id;
    const completed = chooseEvent(active, event.id, choice.id, catalog);
    if(['CL29','CL30'].includes(event.id)&&choice.schemeAction==='withdraw'){
      const shown=eligibleChoices(active,event).find(c=>c.id===choice.id);assert.equal(shown.disabled,true);assert.match(shown.reason,/冻结|限制/);assert.match(completed.lastResult.error,/冻结|限制/);assert.equal(completed.cash,active.cash);assert.deepEqual(completed.positions,active.positions);assert.deepEqual(completed.ledger,active.ledger);count++;continue;
    }
    assert.equal(completed.lastResult.error, undefined, `${outcome.id}: ${completed.lastResult.error}`);
    assert.equal(completed.phase, 'result');
    assert.ok(Number.isSafeInteger(getMetrics(completed).netWorth));
    count += 1;
  }
  assert.equal(count, manifest.outcomes);
});

test('each authored ending predicate can be satisfied by real state fields', () => {
  const fixtures = {
    E01: s => { s.cash = 11000000000; },
    E02: s => { s.flags.option_big_win = true; s.cash = 200000000; },
    E03: s => { s.wipeouts = 1; s.flags.rebuilding = true; s.cash = 200000000; },
    E04: s => { s.cash = 100000; s.positions = [{ id: 'angel', kind: 'angel', cost: 1000000000, value: 1100000000, lockUntilTurn: 100 }]; },
    E05: s => { s.peakNetWorth = 1100000000; s.wipeouts = 1; s.cash = 100000; },
    E06: s => { s.flags.business_owner = true; s.flags.rebuilding = true; s.businesses = [{ id: 'b', value: 100000, monthlyProfit: 10000 }]; },
    E07: s => { s.stats.skill = 80; s.flags.career_history = true; },
    E08: s => { s.flags.ever_indebted = true; s.debts = []; s.debtFreeTurns = 3; },
    E09: s => { s.flags.restructuring = true; s.debts = [{ id: 'd', principal: 100000, interest: 0, monthsLeft: 24, aprBps: 800 }]; },
    E10: s => { s.flags.employed = true; s.cash = 0; s.debts = [{ id: 'd', principal: 100000, interest: 0, monthsLeft: 24, aprBps: 800 }]; },
    E11: s => { s.flags.ponzi_loss = true; s.claims = [{ id: 'c', face: 100000, value: 10000 }]; },
    E12: s => { s.flags.recruited = true; s.stats.trust = 10; },
    E13: s => { s.flags.angel_investor = true; s.cash = 0; s.positions = [{ id: 'a', kind: 'angel', cost: 1000000, value: 1000000, lockUntilTurn: 99 }]; },
    E14: s => { s.flags.equity_exit = true; s.realizedEquityProceeds = 200000000; },
    E15: s => { s.businesses = [1, 2, 3].map(id => ({ id: String(id), value: 100000, monthlyProfit: 10000 })); },
    E16: s => { s.stats.trust = 80; s.cash = 100000000; s.debts = []; },
    E17: s => { s.cash = 1100000000; s.stats.trust = 10; },
    E18: s => { s.flags.relationship_repaired = true; s.stats.trust = 80; },
    E19: s => { s.stats.fame = 80; s.cash = 100000; },
    E20: s => { s.stats.fame = 80; s.flags.public_truth = true; s.stats.trust = 80; },
    E21: s => { s.flags.recovering_health = true; s.stats.health = 80; s.stats.stress = 10; },
    E22: s => { s.flags.succession_released = true; s.stats.trust = 80; },
    E23: s => { s.flags.voluntary_exit = true; s.cash = 100000000; s.debts = []; },
    E24: () => {},
    E25: s => { attachLegalFixture(s, eventAt('JAIL01')); },
    E26: s => { attachLegalFixture(s, eventAt('LAW03')); },
    E27: s => { attachLegalFixture(s, eventAt('RE01')); s.flags.reentry_employed = true; },
    E29: s => { s.flags.survival_failed=true; },
    E33: s => { s.flags.survival_failed=true;s.flags.health_failed=true;s.stats.health=0; },
    E31: s => { s.flags.gambling_final_loss=true; },
    E32: s => { s.flags.allin_final_loss=true; },
    E34: s => { s.flags.crypto_final_loss=true; },
    E30: s => { s.flags.fund_investor=true; s.cash=1000000000; },
    E28: s => { s.flags.gambling_history = true; s.flags.gambling_quit = true; },
  };
  for (const ending of catalog.endings) {
    const state = prepared(60);
    fixtures[ending.id](state);
    assert.ok(evaluateEndings(state, catalog).some(item => item.id === ending.id), `${ending.id}: ${ending.title}`);
  }
});

test('zero cash and zero investable cash never disable every event choice or basic survival actions', () => {
  for (const event of catalog.events) {
    const state = prepared(event.age_max < 18 ? event.age_max : Math.max(55, event.age_min));
    state.cash = 0; state.monthlyIncome = 0; state.familyReserve = 0;
    state.debts = []; state.claims = []; state.positions = []; state.businesses = [];
    assert.equal(getMetrics(state).availableCash, 0);
    assert.ok(eligibleChoices(state, event).some(choice => !choice.disabled), event.id);
  }
  const state = prepared(25); state.cash = 0; state.monthlyIncome = 0; state.familyReserve = 0; state.stats.health = 0;
  for (const type of ['work', 'gig', 'seek_job', 'rest', 'study']) {
    const next = act(state, { type }, catalog);
    assert.equal(next.lastResult.error, undefined, type);
    assert.equal(next.actionPoints, state.actionPoints - 1, type);
  }
});

test('criminal choices trigger visible investigation, prison-only stories, release, and delayed life chapters', () => {
  let state = prepared(19); state.cash = 1000000;
  state = show(state, 'UG01'); state.activeEvent.outcomes.UG01_1 = 'UG01_1_2';
  state = chooseEvent(state, 'UG01', 'UG01_1', catalog); state = resolve(state);
  state = show(state, 'UG03'); state = chooseEvent(state, 'UG03', 'UG03_1', catalog); state = resolve(state);
  assert.equal(state.legal.cases.length, 2);
  const seenDuringPrison = []; let entered = false; let released = false;
  for (let turn = 0; turn < 20 && !released; turn++) {
    state = nextTurn(state, catalog);
    assert.equal(state.lastResult?.error, undefined);
    const prison = getLegalStatus(state).inPrison;
    if (prison) {
      entered = true;
      const ids = [state.activeEvent?.eventId, ...state.eventQueue].filter(Boolean);
      for (const id of ids) {
        const event = eventAt(id);
        // World news can be queued by the economic turn, but activateNext defers it before display.
        if (event.kind !== 'world') assert.ok(['prison', 'legal'].includes(event.scene_scope) || event.kind === 'anchor' && event.age_min >= 60, id);
      }
    }
    while (['event', 'result'].includes(state.phase)) {
      if (state.phase === 'result') { state = continueStory(state, catalog); continue; }
      const event = eventAt(state.activeEvent.eventId);
      if (getLegalStatus(state).inPrison) {
        seenDuringPrison.push(event.id);
        assert.ok(['prison', 'legal'].includes(event.scene_scope) || event.kind === 'anchor' && event.age_min >= 60, event.id);
      }
      const available = eligibleChoices(state, event).filter(choice => !choice.disabled);
      const choice = available.find(choice => ['observe', 'family', 'prison_reflect', 'rest', 'self_study'].includes(choice.profile)) ?? available.at(-1);
      assert.ok(choice, event.id);
      state = chooseEvent(state, event.id, choice.id, catalog);
      assert.equal(state.lastResult.error, undefined, event.id);
    }
    released = entered && !getLegalStatus(state).inPrison;
  }
  assert.ok(entered && released);
  assert.ok(state.seenEvents.includes('LAW01'));
  assert.ok(state.seenEvents.includes('LAW02'));
  assert.ok(state.seenEvents.includes('RE01'));
  assert.ok(seenDuringPrison.some(id => id.startsWith('JAIL')));
  assert.ok(state.seenEvents.includes('MAIN05'), '服刑期间跨过22岁，释放后补上主线');
  assert.ok(state.legal.cases.some(item => item.status === 'convicted'));
  assert.ok(state.legal.cases.some(item => item.status === 'admin_closed'));
  state = act(state, { type: 'seek_job' }, catalog);
  assert.ok(state.flags.reentry_employed);
  assert.ok(evaluateEndings(state, catalog).some(item => item.id === 'E27'));
});

test('an imprisoned player reaching 80 completes the adapted chapter and keeps remaining sentence and debt', () => {
  let state = attachLegalFixture(prepared(79), eventAt('JAIL01'));
  const debt = getMetrics(state).debt;
  state = nextTurn(state, catalog);
  const prisonChapter = [...(state.activeEvent ? [state.activeEvent.eventId] : []), ...state.eventQueue].find(id => id === 'MAIN12');
  assert.equal(prisonChapter, 'MAIN12');
  state = resolve(state);
  assert.equal(state.phase, 'ended');
  assert.equal(state.age, 80);
  assert.ok(state.legal.prisonMonthsLeft > 0);
  assert.ok(getMetrics(state).debt >= 0 && debt > 0);
  assert.equal(state.ending.id, 'E25');
  assert.ok(state.seenEvents.includes('MAIN12'));
});

test('an uninformed fraud victim gains a claim and never receives a criminal case', () => {
  const state = show(prepared(25), 'UG10');
  const next = chooseEvent(state, 'UG10', 'UG10_1', catalog);
  assert.equal(next.lastResult.error, undefined);
  assert.equal(next.legal.cases.length, 0);
  assert.ok(next.flags.fraud_victim);
  assert.ok(next.claims.length > 0);
  assert.equal(Boolean(next.flags.ever_convicted), false);
});

test('refusal works before gambling and after quitting without inventing a gambling history', () => {
  const first = show(prepared(), 'UG01');
  const refused = chooseEvent(first, 'UG01', 'UG01_3', catalog);
  assert.equal(refused.lastResult.error, undefined);
  assert.equal(Boolean(refused.flags.gambling_history), false);
  assert.equal(Boolean(refused.flags.gambling_quit), false);
  const repeat = prepared(); repeat.flags.gambling_history = true; repeat.flags.gambling_quit = true;
  const active = show(repeat, 'UG12');
  const refusedAgain = chooseEvent(active, 'UG12', 'UG12_1', catalog);
  assert.equal(refusedAgain.lastResult.error, undefined);
  assert.ok(refusedAgain.flags.gambling_quit);
});
