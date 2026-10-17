import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createState, applyAction, applyEffects, advanceTurn, getMetrics, getEligibility, getActionAvailability, getTurnMonths, getLegalStatus, PRODUCTS, rngNext, random } from '../src/game/core.js';
import { LEGAL_TYPES } from '../src/game/legal.js';

const families = JSON.parse(fs.readFileSync(new URL('../data/families.json', import.meta.url)));
const profiles = JSON.parse(fs.readFileSync(new URL('../data/effect_profiles.json', import.meta.url)));
const family = families[0];
function newborn(seed = 'test-seed') { return createState({ family, seed, name: '测试阿财' }); }
function adult({ cash = 10_000_000, age = 18, wage = 0, seed = 'test-seed' } = {}) {
  const s = newborn(seed); s.marketProgress = { firstExperienceAge:18, simulations:2, unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true])) }; Object.assign(s, { age, cash, monthlyIncome: wage, giftReceived: true, occupation: wage ? '职员' : '待业青年' }); return s;
}
function ok(out) { assert.equal(out.result.error, undefined, out.result.error); return out.state; }
function act(s, a) { return ok(applyAction(s, a)); }
function effect(s, effects, context) { return ok(applyEffects(s, effects, context)); }
function next(s, shock) { return ok(advanceTurn(s, shock)); }

test('same seed reproduces all family amounts, ids and RNG; JSON save preserves next draw', () => {
  assert.deepEqual(newborn(), newborn());
  assert.deepEqual(rngNext(123), rngNext(123));
  const s = newborn(); const saved = JSON.parse(JSON.stringify(s));
  assert.deepEqual(random(s), random(saved)); assert.equal(s.rng, saved.rng);
  assert.notEqual(newborn('other').rng, s.rng);
});

test('family reserve is not personal wealth; adulthood gift is paid exactly once', () => {
  let s = newborn(); const original = getMetrics(s);
  assert.equal(original.assets, s.cash); assert.equal(original.debt, 0);
  while (s.age < 18) s = next(s);
  assert.equal(s.giftReceived, true);
  const giftEntries = s.ledger.filter(x => x.label === '成年一次性赠与');
  assert.equal(giftEntries.length, 1); assert.equal(giftEntries[0].amount, s.adultGift);
  s = next(s); assert.equal(s.ledger.filter(x => x.label === '成年一次性赠与').length, 1);
});

test('a cared-for life uses childhood milestones, six month and annual adult turns; debt alone does not end it', () => {
  let s = createState({ family: families[4], seed: 'poor' });
  let turns = 0;
  while (s.age < 80) { s.stats.health=100; s = next(s); turns++; assert(Number.isSafeInteger(s.cash)); assert(s.cash >= 0); }
  assert.equal(turns, 90); assert.equal(s.age, 80); assert.equal(getTurnMonths(s), 0);
  assert(advanceTurn(s).result.error); assert(s.debts.length > 0);
  assert.equal(getTurnMonths({ age: 35.5 }), 6); assert.equal(getTurnMonths({ age: 36 }), 12);
});

test('minor restrictions and two action points prevent unlimited same-turn operations', () => {
  let s = newborn(); const blocked = applyAction(s, { type: 'borrow', kind: 'family', amount: 1000 });
  assert.equal(blocked.state, s); assert(blocked.result.error);
  s = act(s, { type: 'study' }); s = act(s, { type: 'social' });
  assert.equal(s.actionPoints, 0); assert(applyAction(s, { type: 'rest' }).result.error);
  assert.equal(next(s).actionPoints, 2);
});

test('zero cash still permits free study, work, job seeking and recovery', () => {
  let s = adult({ cash: 0 });
  s = act(s, { type: 'work' }); assert(s.cash > 0);
  s = act(s, { type: 'seek_job' }); assert(s.monthlyIncome > 0);assert.equal(s.behavior.jobStartsTomorrow,true);
  s = next(s); assert.equal(s.cash,0); assert(s.debts.some(d=>d.kind==='arrears')); assert(s.flags.career_history);
});

test('approved loan increases cash and principal equally, not net wealth; family loan uses finite reserve', () => {
  let s = adult({ wage: 1_500_000 }); const prior = getMetrics(s);
  s = effect(s, [{ op: 'loan', principal_yuan: 50000, apr_bps: 800, term_months: 24, purpose: 'approved_use' }], { profile: 'bank' });
  assert.equal(s.cash - prior.cash, 5_000_000); assert.equal(getMetrics(s).debt, 5_000_000); assert.equal(getMetrics(s).netWorth, prior.netWorth);
  const poor = adult({ wage: 0 }); assert.equal(getEligibility(poor, 'bank_eligible'), false);
  const beforeReserve = s.familyReserve;
  for (let i = 0; i < 20; i++) { const attempt = applyAction(s, { type: 'borrow', kind: 'family', amount: 100_000 }); if (!attempt.result.error && attempt.state.cash > s.cash) { s = attempt.state; break; } s.rng++; }
  assert.equal(s.familyReserve, beforeReserve - 100_000);
});

test('salary and living expenses cover the same passed months; interest uses single principal', () => {
  let s = adult({ cash: 10_000_000, wage: 1_000_000 }); const before = s.cash;
  s = next(s); assert.equal(s.cash, before + 5_000_000 - 1_800_000 - (s.livingCosts?.total||0));
  let debtor = adult({ cash: 0 });
  debtor.debts = [{ id: 'bank', name: '测试借款', principal: 1_000_000, interest: 0, aprBps: 1200, monthsLeft: 24, purpose: 'test', kind: 'bank', overdue: false }];
  debtor = next(debtor); const d = debtor.debts.find(x => x.id === 'bank');
  assert.equal(d.interest, 60_000); assert.equal(d.principal, 1_000_000); assert.equal(d.monthsLeft, 18); assert(d.overdue);
  assert.equal(debtor.cash, 0); assert(debtor.debts.some(x => x.kind === 'arrears'));
});

test('repayment consumes only owed cash, removes actual debt and cannot reward debt-free state', () => {
  let s = adult({ wage: 1_500_000 });
  s = effect(s, profiles.bank.outcomes[0].effects, { profile: 'bank' });
  const cashBefore = s.cash;
  s = act(s, { type: 'repay', amount: 8_000_000 });
  assert.equal(s.cash, cashBefore - 5_000_000); assert.equal(getMetrics(s).debt, 0);
  const rejected = applyEffects(s, profiles.repay.outcomes[0].effects, { profile: 'repay' });
  assert(rejected.result.error); assert.equal(rejected.state, s);
});

test('venture settles its new stake once without touching old positions; atomic failures roll everything back', () => {
  let s = adult(); s = act(s, { type: 'invest', product: 'stock', amount: 1_000_000 });
  const snapshot = structuredClone(s); const stake = Math.round(s.cash * 0.3);
  s = effect(s, [{ op: 'venture', stake_fraction: 0.3, gross_multiple: 2.5 }], { eventId: 'V1', profile: 'stock' });
  assert.equal(s.cash, snapshot.cash - stake + Math.round(stake * 2.5)); assert.deepEqual(s.positions, snapshot.positions);
  const repeat = applyEffects(s, [{ op: 'earn', amount_yuan: 100000 }], { eventId: 'V1' }); assert.equal(repeat.state, s); assert(repeat.result.alreadyApplied);
  const bad = applyEffects(s, [{ op: 'earn', amount_yuan: 100 }, { op: 'spend', amount_yuan: 10 ** 10 }]);
  assert(bad.result.error); assert.equal(bad.state, s);
});

test('every listed product opens a distinct legal position; lockups cannot be sold early', () => {
  assert.equal(Object.keys(PRODUCTS).length, 11);
  for (const [kind, meta] of Object.entries(PRODUCTS)) {
    const s = act(adult({ cash: 100_000_000, age: kind === 'ponzi' ? 24 : 18 }), { type: 'invest', product: kind, amount: meta.min });
    assert.equal(s.positions[0].kind, kind);
    assert.equal(s.cash, 100_000_000 - meta.min);
    assert.equal(getMetrics(s).netWorth, 100_000_000);
    if (['angel', 'housing', 'fund'].includes(kind)) assert(applyAction(s, { type: 'sell', id: s.positions[0].id }).result.error);
  }
});

test('option buyer loses at most premium, or settles intrinsic value once at expiry', () => {
  let losing = act(adult(), { type: 'invest', product: 'option', amount: 1_000_000, direction: 'long' });
  losing = next(losing, { id: 'down', returns: { stock: -0.7 } });
  assert.equal(losing.positions.length, 0); assert.equal(getMetrics(losing).debt, 0);
  assert.equal(losing.cash, 10_000_000 - 1_000_000 - 1_800_000 - (losing.livingCosts?.total||0));
  let winning = act(adult(), { type: 'invest', product: 'option', amount: 1_000_000, direction: 'short' });
  winning = next(winning, { id: 'down', returns: { stock: -0.5 } });
  assert.equal(winning.cash, 10_000_000 - 1_000_000 + 5_000_000 - 1_800_000 - (winning.livingCosts?.total||0));
  assert.equal(winning.ledger.filter(x => x.label === '买方期权到期结算' && x.account === 'cash').length, 1);
  winning = next(winning); assert.equal(winning.ledger.filter(x => x.label === '买方期权到期结算' && x.account === 'cash').length, 1);
});

test('short option losses exceed its initial margin and survive as debt', () => {
  let s = act(adult({ cash: 1_000_000 }), { type: 'invest', product: 'option_short', amount: 1_000_000, useLivingReserve: true });
  s = next(s, { id: 'squeeze', returns: { stock: 2 } });
  assert.equal(s.positions.length, 0); assert.equal(s.cash, 0);
  const obligation = s.debts.find(d => d.name === '卖方期权超保证金赔付');
  assert.equal(obligation.principal, 4_880_000); assert.equal(obligation.interest, 0);
  assert(getMetrics(s).netWorth < -4_000_000);
});

test('leveraged futures liquidate from margin state; losing borrowed stake never erases the loan', () => {
  let s = adult({ cash: 0, wage: 1_500_000 });
  s = effect(s, profiles.bank.outcomes[0].effects, { profile: 'bank' });
  s = act(s, { type: 'invest', product: 'futures', amount: 5_000_000, leverage: 10, useLivingReserve: true });
  s.monthlyIncome = 0; s = next(s, { id: 'crash', returns: { futures: -0.2 } });
  assert.equal(s.positions.length, 0); assert(s.flags.futures_liquidated);
  assert(s.debts.some(d => d.kind === 'bank' && d.principal === 5_000_000));
  assert.equal(s.debts.filter(d => d.kind === 'derivative').length, 0);
  assert.equal(s.wipeouts, 1); assert(s.flags.had_margin_crisis);
});

test('a lost position does not mean total wipeout while cash remains', () => {
  let s = adult({ cash: 2_080_000, wage: 1_000_000 });
  s = act(s, { type: 'invest', product: 'futures', amount: 1_000_000, leverage: 10 });
  s = next(s, { returns: { futures: -0.2 } });
  assert.equal(s.wipeouts, 0); assert(s.cash > 0); assert.ok(!s.flags.ever_wipeout);
  const baby = next(newborn()); assert.equal(baby.wipeouts, 0);
});

test('futures profit marks to entry and current underlying price across several turns', () => {
  let s = act(adult({ cash: 100_000_000 }), { type: 'invest', product: 'futures', amount: 1_000_000, leverage: 2 });
  s = next(s, { returns: { futures: 0.1 } }); s = next(s, { returns: { futures: 0.1 } });
  const p = s.positions[0]; assert.equal(p.lastPrice, 12100);
  assert.equal(p.value, 1_000_000 + 420_000 - 2000);
});

test('a special historical shock affects only its explicit exposure; it never multiplies cash', () => {
  let s = adult({ cash: 100_000_000 });
  s = act(s, { type: 'invest', product: 'futures', amount: 1_000_000, leverage: 10, underlying: 'stock' });
  const ordinary = next(s, { returns: { futures: -1.2 }, exposureFilter: { underlyings: ['WTI_2020_05'] } });
  const control = next(s); assert.deepEqual(ordinary.positions, control.positions); assert.equal(ordinary.cash, control.cash);
  const cashOnly = adult(); const shocked = next(cashOnly, { returns: { stock: -0.9, crypto: -0.9 } });
  assert.equal(shocked.cash, next(cashOnly).cash);
});

test('ponzi collapse creates marked claim without cash, and partial recovery cannot repeat full face', () => {
  let s = act(adult({ age: 24 }), { type: 'invest', product: 'ponzi', amount: 1_000_000 });
  s = next(s, { id: 'ponzi', returns: { ponzi: -1 } });
  assert.equal(s.positions.length, 0); assert.equal(s.claims[0].face, 1_000_000); assert.equal(s.claims[0].value, 100_000); assert(s.flags.ponzi_loss);
  const cashBefore = s.cash;
  s = effect(s, [{ op: 'recover_claim', recovery_bps: 3000 }]);
  assert.equal(s.cash, cashBefore + 300_000); assert.equal(s.claims[0].face, 700_000);
  s = effect(s, [{ op: 'recover_claim', recovery_bps: 3000 }]);
  assert.equal(s.cash, cashBefore + 510_000); assert.equal(s.claims[0].face, 490_000);
});

test('angel book gains remain locked, then genuine sale creates equity exit proceeds', () => {
  let s = adult(); const beforeCash = s.cash;
  s = effect(s, [{ op: 'illiquid', stake_fraction: 0.3, gross_multiple: 20, lock_turns: 6 }], { profile: 'angel' });
  assert(s.cash < beforeCash); assert.equal(s.flags.equity_exit, undefined);
  const p = s.positions[0]; assert.equal(getMetrics(s).private_equity_yuan, p.value / 100);
  assert.equal(getActionAvailability(s, { type: 'sell', id: p.id }).allowed, false);
  s.turn += 6; s = act(s, { type: 'sell', id: p.id });
  assert(s.flags.equity_exit); assert(s.realizedEquityProceeds > 0);
});

test('housing mortgage records full property and matching debt; sale repays debt and leaves any shortfall', () => {
  let s = adult({ cash: 10_000_000, wage: 1_000_000 }); const before = getMetrics(s).netWorth;
  s = act(s, { type: 'invest', product: 'housing', amount: 5_000_000, financed: true });
  assert.equal(getMetrics(s).netWorth, before); assert.equal(s.debts[0].kind, 'mortgage');
  const p = s.positions[0]; s.turn += 2; s.cash = 0; p.value = 1_000_000;
  s = act(s, { type: 'sell', id: p.id });
  assert.equal(s.positions.length, 0); assert(s.debts[0].principal > 0); assert.equal(s.debts[0].name, '售房后剩余按揭'); assert.equal(s.cash, 0);
});

test('working business has capital and net cash flow; successful story business conserves total value', () => {
  let s = adult(); const initial = getMetrics(s).netWorth;
  s = act(s, { type: 'business_start', amount: 1_000_000 });
  assert.equal(getMetrics(s).netWorth, initial); assert(s.businesses[0].monthlyProfit > 0); assert(s.flags.business_owner);
  const before = adult(); const stake = Math.round(before.cash * 0.25);
  const story = effect(before, profiles.business.outcomes[0].effects, { profile: 'business' });
  assert.equal(getMetrics(story).netWorth, before.cash - stake + Math.round(stake * 1.8));
  assert(story.flags.business_owner); assert(story.businesses[0].value > 0);
});

test('business names use the supplied trimmed name up to 24 characters, otherwise the default', () => {
  const named = act(adult(), { type: 'business_start', amount: 500_000, name: '  阿财翻身面馆  ' });
  assert.equal(named.businesses[0].name, '阿财翻身面馆');
  assert(named.logs.at(-1).text.includes('阿财翻身面馆'));
  const unnamed = act(adult(), { type: 'business_start', amount: 500_000, name: '   ' });
  assert.equal(unnamed.businesses[0].name, '巷口早餐铺');
  const long = act(adult(), { type: 'business_start', amount: 500_000, name: '财'.repeat(25) });
  assert.equal(long.businesses[0].name, '财'.repeat(24));
});

test('failed job and failed relationship repair do not claim success; successful repairs need repetition', () => {
  let s = adult(); s = effect(s, profiles.job.outcomes[1].effects, { profile: 'job' });
  assert.equal(s.monthlyIncome, 0); assert.equal(s.flags.employed, false);
  s = effect(s, profiles.repair.outcomes[1].effects, { profile: 'repair' }); assert.equal(s.repairCount, 0);
  s = effect(s, profiles.repair.outcomes[0].effects, { profile: 'repair' }); assert.equal(s.flags.relationship_repaired, undefined);
  s = effect(s, profiles.repair.outcomes[0].effects, { profile: 'repair' }); assert(s.flags.relationship_repaired);
  s = effect(s, profiles.job.outcomes[0].effects, { profile: 'job' }); assert(s.monthlyIncome > 0); assert(s.flags.employed);
});

test('all fourteen original effect operations remain supported alongside legal effects', () => {
  let s = adult({ cash: 100_000_000, wage: 2_000_000 });
  s = effect(s, [{ op: 'stat', delta: { skill: 2 } }, { op: 'flag', key: 'test', value: true }, { op: 'earn', amount_yuan: 100 }, { op: 'spend', amount_yuan: 50 }, { op: 'family_transfer', cap_yuan: 100 }]);
  s = effect(s, [{ op: 'loan', principal_yuan: 50000, apr_bps: 800, term_months: 24, purpose: 'approved_use' }]);
  s = effect(s, [{ op: 'repay', cash_fraction: 0.01 }, { op: 'extend_debt', turns: 2 }, { op: 'guarantee', limit_yuan: 500, called: true }]);
  s = effect(s, [{ op: 'venture', stake_fraction: 0.01, gross_multiple: 1.2 }, { op: 'illiquid', stake_fraction: 0.01, gross_multiple: 1.2, lock_turns: 0 }]);
  s = effect(s, [{ op: 'liquidate_asset', fraction: 0.3, haircut_bps: 1000 }, { op: 'freeze_investment', stake_fraction: 0.01, claim_mark_bps: 1000 }, { op: 'recover_claim', recovery_bps: 3000 }]);
  assert(Number.isSafeInteger(s.cash)); assert(s.flags.test); assert(s.flags.restructuring); assert(s.claims.length > 0);
  const operations = new Set(Object.values(profiles).flatMap(p => p.outcomes.flatMap(o => o.effects.map(e => e.op))));
  for (const op of ['stat', 'flag', 'earn', 'spend', 'family_transfer', 'loan', 'repay', 'extend_debt', 'guarantee', 'venture', 'illiquid', 'liquidate_asset', 'freeze_investment', 'recover_claim']) assert(operations.has(op));
});

test('scheduled effects use narrative queue fields with valid dates and unique identities', () => {
  const s = effect(adult(), [{ op: 'schedule', event_id: 'BUS03', after_turns: 2, expires_after_turns: 5 }], { eventId: 'BUS01' });
  assert.equal(s.pending[0].eventId, 'BUS03'); assert.equal(s.pending[0].dueTurn, 2); assert.equal(s.pending[0].expiresTurn, 5); assert(s.pending[0].id);
  assert(applyEffects(s, [{ op: 'schedule', event_id: 'BUS03', after_turns: 4, expires_after_turns: 2 }]).result.error);
});

test('NaN, unsafe integers and overflowing effects are rejected atomically', () => {
  const s = adult();
  for (const amount of [NaN, Infinity, -10, Number.MAX_SAFE_INTEGER + 1, 1.5]) {
    const out = applyAction(s, { type: 'invest', product: 'stock', amount }); assert(out.result.error); assert.equal(out.state, s);
  }
  const out = applyEffects(s, [{ op: 'earn', amount_yuan: Number.MAX_SAFE_INTEGER }]); assert(out.result.error); assert.equal(out.state, s);
  const shock = advanceTurn(s, { returns: { stock: NaN } }); assert(shock.result.error); assert.equal(shock.state, s);
});

test('living expenses are advisory for investments and businesses; actual cash is enforced', () => {
  const s = adult({ cash: 1_200_000 });
  assert.equal(getMetrics(s).availableCash, 0);
  assert.equal(applyAction(s, { type: 'invest', product: 'stock', amount: 500_000 }).result.error, undefined);
  assert(applyAction(s, { type: 'invest', product: 'stock', amount: s.cash + 1 }).result.error);
  assert.equal(applyAction(s, { type: 'business_start', amount: 500_000 }).result.error, undefined);
  assert(applyAction(s, { type: 'business_start', amount: s.cash + 1 }).result.error);
  assert.equal(applyAction(s, { type: 'invest', product: 'stock', amount: 100_000 }).result.error, undefined);
  const minor = newborn(); const out = applyEffects(minor, [{ op: 'venture', stake_fraction: 1, gross_multiple: 5 }]);
  assert(out.result.error); assert.equal(out.state, minor);
});

test('ending metrics are all present and simultaneous health, family and retirement routes remain playable', () => {
  let s = adult({ age: 55 });
  for (const item of JSON.parse(fs.readFileSync(new URL('../data/endings.json', import.meta.url)))) {
    for (const condition of item.condition.all) if (condition.metric) assert.equal(typeof getMetrics(s)[condition.metric], 'number', condition.metric);
  }
  s.peopleMet.push('N02'); s.relationships.N02=60;
  assert.equal(getActionAvailability(s,{type:'relationship',kind:'partner'}).allowed,false);
  assert.equal(getActionAvailability(s,{type:'relationship',kind:'child'}).allowed,false);
  s.household.partner=true;s.household.hasChild=true;s.peopleMet.push('N09');
  // Existing adult-child household: the separate family suite exercises dating and birth.
  // This ending fixture has an adult child; newborn eligibility is tested separately.
  s.household.childBornAge = 30;
  s = act(s, { type: 'relationship', kind: 'succession' }); assert(s.flags.succession_released);
  s = act(s, { type: 'exit_risk' }); s = next(s); s = next(s); assert(s.flags.voluntary_exit);
  assert.equal(getActionAvailability(s, { type: 'invest', product: 'futures', amount: 100_000 }).allowed, false);
  assert(applyEffects(s, [{ op: 'venture', stake_fraction: .1, gross_multiple: 5 }], { profile: 'contract' }).result.error);
});

test('a complete seeded investment life is reproducible after serializing every turn', () => {
  function play(reload) {
    let s = newborn('whole-life'); let i = 0;
    while (s.age < 80) {
      if (s.age < 18) { s = act(s, { type: 'study' }); s = act(s, { type: 'social' }); }
      else {
        s = act(s, { type: getActionAvailability(s,{type:'seek_job'}).allowed?'seek_job':'study' });
        if (s.cash >= 200_000 && i % 3 === 0) s = act(s, { type: 'invest', product: 'stock', amount: 200_000 });
        else s = act(s, { type: 'rest' });
      }
      s = next(s); i++; if (reload) s = JSON.parse(JSON.stringify(s));
    }
    return s;
  }
  assert.deepEqual(play(false), play(true));
});

function registerCase(s, type = 'fraud', profit = 1000, context = {}) { return effect(s, [{ op: 'legal_case', case_type: type, profit_yuan: profit }], context); }
function adjudicate(s) { for (let i = 0; i < 4; i++) s = next(s); return s; }

test('case income is paid and registered once; mixed earn and illegal income is atomically rejected', () => {
  const original = adult(); const s = registerCase(original, 'fraud', 1000, { eventId: 'CASE-TEST' });
  assert.equal(s.cash, original.cash + 100_000); assert.equal(s.legal.cases[0].profit, 100_000); assert.equal(s.legal.cases[0].status, 'pending');
  const repeat = applyEffects(s, [{ op: 'legal_case', case_type: 'fraud', profit_yuan: 1000 }], { eventId: 'CASE-TEST' });
  assert.equal(repeat.state, s); assert(repeat.result.alreadyApplied);
  const duplicate = applyEffects(original, [{ op: 'legal_case', case_type: 'fraud', profit_yuan: 1000 }, { op: 'earn', amount_yuan: 1000 }]);
  assert(duplicate.result.error); assert.equal(duplicate.state, original);
  assert(applyEffects(newborn(), [{ op: 'legal_case', case_type: 'fraud', profit_yuan: 0 }]).result.error);
});

test('legal stages have fixed deadlines; liability is assessed only at determination, without reroll', () => {
  let s = registerCase(adult({ cash: 100_000_000 }), 'gambling', 5000);
  const c = s.legal.cases[0]; assert.deepEqual([c.exposedTurn, c.investigatingTurn, c.resolutionTurn], [2, 3, 4]);
  s = next(s); assert.equal(s.legal.cases[0].status, 'pending');
  s = next(s); assert.equal(s.legal.cases[0].status, 'exposed'); assert(s.flags.under_investigation);
  s = act(s, { type: 'legal_cooperate' }); const saved = JSON.parse(JSON.stringify(s));
  s = next(s); assert.deepEqual(s, next(saved)); assert.equal(s.legal.cases[0].status, 'investigating');
  assert.equal(s.ledger.filter(e => e.label.includes('案件罚款') || e.label.includes('违法所得追缴')).length, 0);
  s = next(s); assert.equal(s.legal.cases[0].status, 'admin_closed'); assert(s.legal.cases[0].settled);
  assert.equal(s.legal.prisonMonthsLeft, 0); assert.equal(s.flags.ever_convicted, undefined); assert.equal(s.flags.under_investigation, false);
  const assessed = s.ledger.filter(e => e.label.includes('案件罚款') || e.label.includes('违法所得追缴')).length;
  s = next(s); assert.equal(s.ledger.filter(e => e.label.includes('案件罚款') || e.label.includes('违法所得追缴')).length, assessed);
});

test('administrative gambling never becomes prison; all explicit criminal case types have separate consequences', () => {
  for (const [type, rule] of Object.entries(LEGAL_TYPES)) {
    const s = adjudicate(registerCase(adult({ cash: 100_000_000 }), type, 100));
    assert.equal(s.legal.cases[0].status, rule.criminal ? 'convicted' : 'admin_closed');
    assert.equal(s.legal.prisonMonthsLeft, rule.sentenceMonths); assert.equal(s.flags.in_prison, rule.criminal);
    assert.equal(s.legal.cases[0].confiscation, 10_000);
  }
});

test('unpaid confiscation, fines and restitution remain distinct legal debts; payment never buys sentence reduction', () => {
  let s = adjudicate(registerCase(adult({ cash: 0 }), 'fraud', 0));
  const legal = getLegalStatus(s); assert(legal.unpaidPenalty > 0); assert(legal.unpaidRestitution > 0); assert.equal(legal.unpaidConfiscation, 0);
  const debts = s.debts.filter(d => d.kind === 'legal'); assert.equal(debts.length, 2);
  assert(debts.every(d => d.legalCaseId === s.legal.cases[0].id)); assert(s.flags.legal_debt);
  const sentence = s.legal.prisonMonthsLeft; s.cash = 1_000_000_000;
  assert(applyAction(s, { type: 'repay', amount: 100_000 }).result.error); // no external action during custody
  s = next(s); assert.equal(s.legal.prisonMonthsLeft, sentence - 6);
  assert(s.legal.cases[0].settled); assert(s.debts.filter(d => d.kind === 'legal').length <= debts.length);
});

test('custody offers two internal actions, blocks external economic actions and cannot be bypassed by stories', () => {
  let s = adjudicate(registerCase(adult({ cash: 100_000_000, wage: 1_000_000 }), 'account_rental', 2000));
  assert.equal(s.monthlyIncome, 0); assert.equal(s.occupation, '服刑中');
  for (const action of [{ type: 'work' }, { type: 'seek_job' }, { type: 'borrow', kind: 'family', amount: 100 }, { type: 'invest', product: 'stock', amount: 100_000 }, { type: 'business_start', amount: 300_000 }, { type: 'relationship', kind: 'partner' }]) assert(applyAction(s, action).result.error, action.type);
  for (const effects of [[{ op: 'earn', amount_yuan: 100 }], [{ op: 'venture', stake_fraction: .1, gross_multiple: 5 }], [{ op: 'legal_case', case_type: 'fraud', profit_yuan: 100 }]]) assert(applyEffects(s, effects).result.error);
  assert(applyEffects(s, [{ op: 'flag', key: 'employed', value: true }], { profile: 'job' }).result.error);
  const cash = s.cash; const months = s.legal.prisonMonthsLeft;
  s = act(s, { type: 'prison_study' }); s = act(s, { type: 'prison_letter' }); assert.equal(s.cash, cash); assert.equal(s.legal.prisonMonthsLeft, months); assert.equal(s.actionPoints, 0);
  assert(applyAction(s, { type: 'prison_reflect' }).result.error);
});

test('existing passive positions and debt interest keep settling while wages and owner-operated shops pause', () => {
  let s = adult({ cash: 100_000_000, wage: 1_000_000 });
  s = act(s, { type: 'business_start', amount: 1_000_000 }); s = act(s, { type: 'invest', product: 'bond', amount: 1_000_000 });
  s = adjudicate(registerCase(s, 'account_rental', 0));
  const before = s.ledger.length; const shop = structuredClone(s.businesses[0]);
  s = next(s, { returns: { bond: 0 } });
  const entries = s.ledger.slice(before);
  assert(entries.some(e => e.label === '债券现金票息')); assert(!entries.some(e => e.label.includes('个月工资') || e.label.includes('净经营回款')));
  assert.deepEqual(s.businesses[0], shop); assert.equal(getMetrics(s).monthlyIncome, 0);
});

test('remaining custody months shorten the final turn; release needs a new job and preserves legal history', () => {
  let s = adjudicate(registerCase(adult({ age: 40, cash: 100_000_000, wage: 1_000_000 }), 'account_rental', 0));
  const convictionAge = s.age; assert.equal(s.legal.prisonMonthsLeft, 18);
  s = next(s); assert.equal(s.legal.prisonMonthsLeft, 6); assert.equal(getTurnMonths(s), 6);
  s = next(s); assert.equal(s.age, convictionAge + 1.5); assert.equal(s.legal.prisonMonthsLeft, 0); assert.equal(s.monthlyIncome, 0);
  assert(s.flags.ever_released); assert(s.flags.ever_convicted); assert.equal(s.legal.servedPrisonMonths, 18);
  s = act(s, { type: 'seek_job' }); assert(s.monthlyIncome > 0); assert(s.flags.reentry_employed);
  assert(applyAction(s, { type: 'prison_study' }).result.error);
});

test('story job after release also records reentry, while cooperation and quitting never erase past responsibility', () => {
  let s = registerCase(adult({ cash: 100_000_000 }), 'gambling', 0); s = act(s, { type: 'quit_gambling' }); assert(s.flags.gambling_quit);
  assert(applyAction(s, { type: 'quit_gambling' }).result.error);
  s = next(next(s)); s = effect(s, [{ op: 'legal_cooperate' }]); assert(s.legal.cases[0].cooperated);
  s = next(next(s)); assert(s.legal.cases[0].settled); assert.equal(s.legal.cases[0].fine, 150_000);
  s.flags.ever_released = true; s = effect(s, [{ op: 'flag', key: 'employed', value: true }], { profile: 'job' }); assert(s.flags.reentry_employed);
});

test('refusal effects work before gambling and after quitting without inventing history or farming rewards', () => {
  const beginner = adult(); const refused = effect(beginner, [{ op: 'quit_gambling' }]);
  assert.equal(refused.flags.gambling_history, undefined); assert.equal(refused.flags.gambling_quit, undefined); assert.deepEqual(refused.stats, beginner.stats);
  let s = registerCase(adult(), 'gambling', 0); s = effect(s, [{ op: 'quit_gambling' }]); const afterFirst = structuredClone(s.stats);
  s = effect(s, [{ op: 'quit_gambling' }]); assert(s.flags.gambling_history); assert(s.flags.gambling_quit); assert.deepEqual(s.stats, afterFirst);
});

test('legal deadline, sentence and debt state replay identically across every custody save', () => {
  function run(reload) {
    let s = registerCase(adult({ cash: 0 }), 'fraud', 6000);
    for (let i = 0; i < 20; i++) {
      if (getLegalStatus(s).inPrison) s = act(s, { type: 'prison_reflect' });
      s = next(s); if (reload) s = JSON.parse(JSON.stringify(s));
    }
    return s;
  }
  assert.deepEqual(run(false), run(true));
});

test('age 80 can retain an unfinished sentence for an open epilogue without forced release', () => {
  let s = adjudicate(registerCase(adult({ age: 74, cash: 0 }), 'illegal_fundraising', 0));
  assert.equal(s.age, 78); while (s.age < 80) s = next(s);
  assert.equal(s.age, 80); assert(s.legal.prisonMonthsLeft > 0); assert(s.flags.in_prison); assert.equal(getTurnMonths(s), 0);
});
