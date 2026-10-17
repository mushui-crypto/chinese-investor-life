import {resultMood} from './story-presentation.js';
/** Read-only projections and presentations. Never draw RNG or settle a transaction here. */
import { applyEffects, getMetrics, getLegalStatus, getTurnMonths } from './core.js';

const STAKE_LABELS = new Set(['故事原型本次投入', '认购锁定权益', '资金盘本次投入冻结']);
const range = values => ({ min: Math.min(...values), max: Math.max(...values) });

export function previewChoice(state, choice) {
  // Evaluate every possible branch on the core's private clone. The locked branch is never read.
  const branches = choice.outcomes.map(outcome => {
    const applied = applyEffects(state, outcome.effects, { profile: choice.profile });
    const entries = applied.state.ledger.slice(state.ledger.length);
    return {
      stake: -entries.filter(e => e.account === 'cash' && (e.storyStake || STAKE_LABELS.has(e.label))).reduce((n,e) => n + e.amount, 0),
      spending: -entries.filter(e => e.account === 'cash' && e.label === '剧情支出').reduce((n,e) => n + e.amount, 0),
      repayment: -entries.filter(e => e.account === 'cash' && e.label === '偿还本息').reduce((n,e) => n + e.amount, 0),
      error: applied.result.error,
    };
  });
  const effects = choice.outcomes.flatMap(o => o.effects);
  const metrics = getMetrics(state);
  return {
    stake: range(branches.map(b => b.stake)), spending: range(branches.map(b => b.spending)), repayment: range(branches.map(b => b.repayment)),
    livingReserve: metrics.livingReserve, available: metrics.availableCash,
    lockTurns: range(choice.outcomes.map(o => Math.max(0,...o.effects.map(e => e.lock_turns ?? 0)))),
    loan: range(choice.outcomes.map(o => o.effects.filter(e => e.op === 'loan').reduce((n,e) => n + Math.round(e.principal_yuan * 100),0))),
    aprBps: Math.max(0,...effects.map(e => e.apr_bps ?? 0)),
    termMonths: Math.max(0,...effects.map(e => e.term_months ?? 0)),
    guarantee: Math.max(0,...effects.map(e => e.op === 'guarantee' ? Math.round(e.limit_yuan * 100) : 0)),
    excessLoss: effects.some(e => e.loss_debt_multiple > 0),
    legal: effects.some(e => e.op === 'legal_case'),
    frozen: effects.some(e => e.op === 'freeze_investment'),
    conditional: branches.some(b => b.error),
  };
}

export function characterAppearance(state,result=state.lastResult) {
  const ageIndex = state.age < 18 ? 0 : state.age < 35 ? 1 : state.age < 60 ? 2 : 3;
  const mood=resultMood(state,result);
  const condition = getLegalStatus(state).inPrison ? 3 : state.age >= 18 && (state.stats.health < 35 || mood==='loss' || (mood!=='profit' && state.wipeouts > 0 && getMetrics(state).assets===0)) ? 2 : state.age >= 18 && getMetrics(state).netWorth >= 50000000 ? 1 : 0;
  return { ageIndex, condition, label: mood==='loss'&&condition===2?'这笔亏了，缓一缓':condition===0&&mood==='profit'?'松了一口气':['日常模样','春风得意','低谷之中','服刑岁月'][condition], ageLabel: ['童年','青年','中年','老年'][ageIndex] };
}

export function sharedHistory(state, npcId, catalog) {
  const ids = new Set(catalog.events.filter(e => e.character_ids?.includes(npcId)).map(e => e.id));
  return state.storyHistory.filter(entry => ids.has(entry.eventId));
}

/** Called only after successful engine transitions. Presentations are persisted separately from money. */
export function registerPresentations(before, after) {
  if (after.lastResult?.error || after === before) return after;
  // A further gameplay decision also moves past the previous presentation. Reload alone does not.
  const pending = [];
  const b = getMetrics(before), a = getMetrics(after);
  const add = (id, kind, amount = 0, months = 0) => {
    if (!pending.some(p => p.id === id)) pending.push({ id, kind, amount, months, age: after.age, turn: after.turn });
  };
  const beforeClear=b.netWorth-b.pendingLegalBills,afterClear=a.netWorth-a.pendingLegalBills;
  if (beforeClear < 100000000 && afterClear >= 100000000 && !before.flags.first_million_scene) {
    after.flags.first_million_scene = true; add('first-million', 'wealth', afterClear);
  }
  if (after.wipeouts > before.wipeouts) add(`wipeout-${after.wipeouts}`, 'wipeout', a.cash);
  for (const c of after.legal?.cases ?? []) {
    if (c.settled && !(before.legal?.cases ?? []).find(old => old.id === c.id)?.settled) add(`judgment-${c.id}`, 'judgment', c.fine + c.confiscation + c.restitution, c.sentenceMonths);
  }
  if ((after.legal?.releaseCount ?? 0) > (before.legal?.releaseCount ?? 0)) add(`release-${after.legal.releaseCount}`, 'release', a.debt);
  after.presentations = pending;
  return after;
}

export function dismissPresentation(state, id) {
  return { ...state, presentations: (state.presentations ?? []).filter(p => p.id !== id) };
}
