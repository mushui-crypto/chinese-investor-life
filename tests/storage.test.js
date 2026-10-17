import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRun, chooseEvent, continueStory, nextTurn, eligibleChoices, act, settleRun, resumeRun } from '../src/game/narrative.js';
import { applyEffects, advanceTurn, getLegalStatus, PRODUCTS } from '../src/game/core.js';
import { encodeSave, decodeSave, saveSlot, loadSlot, listSlots, checksum, setSaveCatalog, validateState, getCollection, updateCollection } from '../src/game/storage.js';
const read = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url)));
const catalog = { events: read('events').events, families: read('families'), history: read('history'), endings: read('endings'), characters: read('characters') };
setSaveCatalog(catalog);
const sample = () => createRun({ seed: 'storage-verification', name: '小林' }, catalog);
const plain = s => JSON.parse(JSON.stringify(s));
const wrap = s => ({ format: '中国式赌狗', version: 1, state: s, checksum: checksum(JSON.stringify(s)) });
function chooseSafe(s) { const event = catalog.events.find(e => e.id === s.activeEvent.eventId); const choices = eligibleChoices(s, event); const choice = choices.find(c => !c.disabled && ['observe', 'family', 'rest', 'self_study'].includes(c.profile)) || choices.find(c => !c.disabled); return chooseEvent(s, event.id, choice.id, catalog); }
function planning(s) { let count = 0; while (s.phase === 'event' || s.phase === 'result') { s = s.phase === 'event' ? chooseSafe(s) : continueStory(s, catalog); assert(++count < 20); } return s; }
function adult() { let s = planning(sample()); while (s.age < 18) s = planning(nextTurn(s, catalog)); s.marketProgress = { firstExperienceAge:18, simulations:2, unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true])) }; s.cash = 100_000_000; s.monthlyIncome = 1_500_000; return s; }

test('real opening save preserves every locked outcome and RNG across a detached snapshot', () => {
  const s = sample(); const envelope = encodeSave(s);
  assert.deepEqual(decodeSave(JSON.stringify(envelope)), s);
  s.cash++; assert.notEqual(envelope.state.cash, s.cash);
  assert.equal(decodeSave(envelope).activeEvent.outcomes.MAIN01_1, envelope.state.activeEvent.outcomes.MAIN01_1);
});
test('bad checksum, malformed JSON and unsupported version are clearly rejected', () => {
  const e = encodeSave(sample()); e.state.cash++; assert.throws(() => decodeSave(e), /校验/);
  assert.throws(() => decodeSave('{broken'), /JSON/);
  assert.throws(() => decodeSave({ ...encodeSave(sample()), version: 2 }), /v1 系列/);
});
test('each runtime-required field cannot be omitted, even with a recalculated checksum', () => {
  const s = sample();
  const required = ['id', 'name', 'seed', 'rng', 'familyId', 'familyName', 'familyReserve', 'adultGift', 'giftReceived', 'mode', 'birthYear', 'age', 'turn', 'cash', 'stats', 'flags', 'positions', 'debts', 'claims', 'businesses', 'relationships', 'household', 'occupation', 'monthlyIncome', 'actionPoints', 'logs', 'ledger', 'netWorthHistory', 'peakNetWorth', 'wipeouts', 'debtFreeTurns', 'serial', 'markets', 'realizedEquityProceeds', 'appliedEffectIds', 'investmentHistory', 'repairCount', 'restStreak', 'riskExitTurn', 'guarantees', 'phase', 'activeEvent', 'eventQueue', 'seenEvents', 'pending', 'lastResult', 'ending', 'matchedEndings', 'discoveredHistory', 'storyHistory', 'dueAnchors', 'runStats'];
  for (const key of required) { const broken = plain(s); delete broken[key]; assert.throws(() => decodeSave(wrap(broken)), /存档|版本/, key); }
  for (const key of ['choices', 'actions', 'categoryCounts', 'interests', 'remixPlan', 'worldQueue', 'shocksApplied', 'expiredChains', 'settlements', 'worldLog']) { const broken = plain(s); delete broken.runStats[key]; assert.throws(() => decodeSave(wrap(broken)), /存档/, `runStats.${key}`); }
});
test('wrong types and unsafe values never reach the core', () => {
  const changes = [s => s.cash = .25, s => s.stats.health = Infinity, s => s.rng = -1, s => s.monthlyIncome = '5000', s => s.household.partner = 'true', s => s.relationships = [], s => s.flags.employed = 1, s => s.markets.stock = 0, s => s.runStats.worldQueue = {}, s => s.appliedEffectIds = null, s => s.runStats.actions = NaN, s => s.pending = [{ eventId: 'NOPE', dueTurn: 1, expiresTurn: 3 }]];
  for (const mutate of changes) { const s = sample(); mutate(s); assert.throws(() => encodeSave(s), /存档/); }
});
test('active event integrity rejects unknown, missing, cross-event and cross-choice outcomes', () => {
  const mutations = [s => s.activeEvent.eventId = 'MAIN99', s => s.activeEvent.outcomes = {}, s => delete s.activeEvent.outcomes.MAIN01_1, s => s.activeEvent.outcomes.MAIN01_1 = 'MAIN02_1_1', s => s.activeEvent.outcomes.MAIN01_1 = s.activeEvent.outcomes.MAIN01_2, s => s.activeEvent.outcomes.extra = 'MAIN01_1_1', s => s.seenEvents.push('MAIN01'), s => s.phase = 'planning'];
  for (const mutate of mutations) { const s = sample(); mutate(s); assert.throws(() => decodeSave(wrap(s)), /剧情|进度|阶段/); }
});
test('all positions, loans, businesses and claims round-trip, required financial fields are checked', () => {
  for (const [kind, p] of Object.entries(PRODUCTS)) {
    const base=adult();if(kind==='ponzi')base.age=24;const s = act(base, { type: 'invest', product: kind, amount: p.min }, catalog);
    assert.equal(s.lastResult.error, undefined); assert.deepEqual(decodeSave(encodeSave(s)), plain(s));
    for (const key of ['value', 'cost', 'lockUntilTurn', 'entryPrice', 'underlying']) { const bad = plain(s); delete bad.positions[0][key]; assert.throws(() => decodeSave(wrap(bad)), /存档/, `${kind}.${key}`); }
  }
  let s = adult(); s = applyEffects(s, [{ op: 'loan', principal_yuan: 50000, apr_bps: 800, term_months: 24, purpose: 'approved_use' }, { op: 'freeze_investment', stake_fraction: .1, claim_mark_bps: 1000 }]).state;
  s = act(s, { type: 'business_start', amount: 500_000 }, catalog); assert.deepEqual(decodeSave(encodeSave(s)), plain(s));
  for (const [array, field] of [['debts', 'interest'], ['debts', 'monthsLeft'], ['claims', 'face'], ['businesses', 'monthlyProfit']]) { const broken = plain(s); delete broken[array][0][field]; assert.throws(() => decodeSave(wrap(broken)), /存档/); }
});
test('individually safe integers whose totals overflow are rejected', () => {
  let s = act(adult(), { type: 'invest', product: 'stock', amount: 100_000 }, catalog);
  s.cash = Number.MAX_SAFE_INTEGER; assert.throws(() => decodeSave(wrap(s)), /合计.*金额/);
  s = adult(); s = applyEffects(s, [{ op: 'loan', principal_yuan: 50000, apr_bps: 800, term_months: 24, purpose: 'approved_use' }]).state;
  s.debts[0].principal = Number.MAX_SAFE_INTEGER; s.debts[0].interest = 1; assert.throws(() => decodeSave(wrap(s)), /合计.*金额/);
});
test('three independent slots isolate a corrupt file; invalid slots cannot overwrite other keys', () => {
  const data = new Map(); const store = { setItem: (k, v) => data.set(k, v), getItem: k => data.get(k), removeItem: k => data.delete(k) };
  saveSlot(0, sample(), store); const b = sample(); b.name = '阿豪'; saveSlot(1, b, store);
  assert.equal(loadSlot(0, store).name, '小林'); assert.equal(loadSlot(1, store).name, '阿豪'); data.set('cng-v1-slot-2', 'broken');
  const slots = listSlots(store); assert.equal(slots[0].state.name, '小林'); assert(slots[2].error);
  assert.throws(() => saveSlot('../settings', sample(), store), /存档槽/);
});
test('all four phases, pending story queues and an entire 0–80 life survive validation and reload', () => {
  let s = sample(), funded=false; // Fund only the adult test fixture; keep gift rules realistic.
 const phases = new Set(); let steps = 0;
  while (s.phase !== 'ended') {
    if(s.age>=18&&!funded){s.cash+=1e9;funded=true;}
    if(s.age>=18&&s.stats.health<=30&&s.phase==='planning')s=act(s,{type:'hospital'},catalog);
    phases.add(s.phase); const reloaded = decodeSave(JSON.stringify(encodeSave(s))); assert.deepEqual(reloaded, plain(s)); s = reloaded;
    if (s.phase === 'event') s = chooseSafe(s);
    else if (s.phase === 'result') s = continueStory(s, catalog);
    else { if (s.age >= 18 && s.actionPoints) s = act(s, { type: 'seek_job' }, catalog); s = nextTurn(s, catalog); }
    assert(++steps < 1000);
  }
  phases.add(s.phase); assert.deepEqual([...phases].sort(), ['ended', 'event', 'planning', 'result']); assert.equal(s.age, 80); assert.deepEqual(decodeSave(encodeSave(s)), plain(s));
});
test('early settlement resumes from the same saved assets and does not reroll the next story', () => {
  let s = adult(); s.age = 55; s = settleRun(s, catalog); assert.equal(s.phase, 'ended');
  const restored = decodeSave(encodeSave(s)); assert.deepEqual(resumeRun(restored, catalog), resumeRun(s, catalog));
  const broken = plain(restored); broken.ending = null; assert.throws(() => validateState(broken), /结局/);
});

test('collection lights every displayed matching ending and keeps discoveries after resuming', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
  try {
    let s = adult(); s.age = 55; s.stats.trust = 80; s = settleRun(s, catalog);
    assert(s.matchedEndings.length >= 2);
    const discovered = updateCollection(s);
    assert.deepEqual(new Set(discovered.endings), new Set(s.matchedEndings.map(e => e.id)));
    assert(discovered.endings.includes(s.ending.id));
    assert.deepEqual(getCollection().endings, discovered.endings);
    assert.deepEqual(updateCollection(s).endings, discovered.endings);
    assert.deepEqual(updateCollection(resumeRun(s, catalog)).endings, discovered.endings);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage; }
});

test('old version 1 saves without legal state migrate only after checksum passes and keep locked decisions', () => {
  const legacy = plain(sample()); delete legacy.legal;
  delete legacy.runStats.legalNoticeIds; delete legacy.runStats.legalMilestones; delete legacy.runStats.deferredEvents;
  const restored = decodeSave(wrap(legacy));
  assert.deepEqual(restored.legal, { cases: [], prisonMonthsLeft: 0, totalPrisonMonths: 0, servedPrisonMonths: 0, releaseCount: 0 });
  assert.deepEqual(restored.activeEvent, legacy.activeEvent); assert.equal(restored.rng, legacy.rng); assert.deepEqual(restored.ledger, legacy.ledger);
  assert.deepEqual(restored.runStats.legalNoticeIds, []); assert.deepEqual(restored.runStats.legalMilestones, []); assert.deepEqual(restored.runStats.deferredEvents, []);
  const damaged = encodeSave(sample()); delete damaged.state.legal; assert.throws(() => decodeSave(damaged), /校验/);
});

test('pending, investigated, convicted and released legal saves all round-trip with fixed deadlines', () => {
  let s = adult(); s = applyEffects(s, [{ op: 'legal_case', case_type: 'account_rental', profit_yuan: 5000 }]).state;
  const observed = new Set();
  for (let turn = 0; turn < 8; turn++) {
    observed.add(s.legal.cases[0].status);
    const restored = decodeSave(encodeSave(s)); assert.deepEqual(restored, plain(s));
    assert.deepEqual(advanceTurn(restored), advanceTurn(s));
    const advanced = advanceTurn(s); assert.equal(advanced.result.error, undefined); s = advanced.state;
  }
  assert.deepEqual([...observed], ['pending', 'exposed', 'investigating', 'convicted']);
  assert(s.flags.ever_released); assert.equal(getLegalStatus(s).inPrison, false); assert.deepEqual(decodeSave(encodeSave(s)), plain(s));
});

test('invalid legal types, missing liabilities, sentence mismatches and forged debt references are rejected', () => {
  let s = adult(); s = applyEffects(s, [{ op: 'legal_case', case_type: 'fraud', profit_yuan: 0 }]).state; s.cash = 0;
  for (let i = 0; i < 4; i++) s = advanceTurn(s).state;
  assert(getLegalStatus(s).legalDebt > 0);
  const mutations = [
    state => delete state.legal.cases[0].fine,
    state => state.legal.cases[0].type = 'unknown',
    state => state.legal.cases[0].profit = .1,
    state => state.legal.prisonMonthsLeft++,
    state => state.legal.cases[0].settled = false,
    state => state.legal.cases[0].resolutionTurn++,
    state => state.debts.find(d => d.kind === 'legal').legalCaseId = 'missing-case',
    state => state.monthlyIncome = 1_000_000,
  ];
  for (const mutate of mutations) { const broken = plain(s); mutate(broken); assert.throws(() => decodeSave(wrap(broken)), /案件|服刑|金额|法律/); }
});
