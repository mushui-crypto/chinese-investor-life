import {recordSchemeInterlude,schemeLifeState} from './scheme-life.js';
import {cryptoEventAllowed,cryptoEventWeight,cryptoLifeSummary} from './crypto-life.js';
import {cryptoStoryPresentation,cryptoStoryChoice,recordCryptoStory} from './crypto-life-stories.js';
import {cryptoLifeActionReason} from './crypto-life-finance.js';
import {seedStudentStories,queueStudentStory,studentEventAllowed,studentChoiceVisible,studentChoice as formativeChoice,studentPresentation,recordStudentChoice} from './student-stories.js';
import {familyTimeActive} from './family-life.js';
import {getGamblingLoanReason} from './core.js';
import {jobSearchWait} from './job-search.js';
import {syncMarketNotices} from './market-notices.js';
import {storyContextAllowed,contextualChoice,contextualStory} from './story-context.js';
import {outcomeTitle,marketStoryIntroduction,storyResultContext} from './story-presentation.js';
import {needsDailySettlement} from './survival.js';
import {isCollegeStudent,COLLEGE_JOB_REASON} from './education.js';
import {schoolAgeChild} from './household.js';
import {meetStoryPeople} from './people.js';
import {noteStoryPeople} from './life-arcs.js';
import {storyExtension} from './debt-calendar.js';
/** Deterministic life-story scheduler. Catalog data stays outside this module. */
import { createState, settleRiskEpilogue, applyAction, applyEffects, advanceTurn, getMetrics, getEndingMetrics, getEligibility, rngNext, getTurnMonths, getLegalStatus, getSurvivalStatus } from './core.js';
import { getMarketAccess, PROFILE_PRODUCT } from './market-access.js';
import { registerPresentations } from './experience.js';
import {recordEducationEvent} from './education.js';
import {TEEN_STORY_STEPS,isTeenStory,teenStoryAge,teenStoryOrder} from './teen-stories.js';
import {onlineEventAllowed,onlineEventWeight,recordOnlineOrdinaryEvent,onlineGamblingSummary} from './online-gambling.js';
import {onlineStoryPresentation,onlineStoryChoice,recordOnlineStory} from './online-gambling-stories.js';

const CHILD_PROFILES = new Set(['observe', 'family', 'rest', 'school', 'child_trade', 'self_study', 'study', 'repair', 'network']);
const RISK_PROFILES = new Set(['stock', 'allin', 'options', 'option_sell', 'contract', 'crypto', 'ponzi', 'ponzi_recruit', 'angel', 'housing', 'fund', 'antique']);
// Keep old catalog entries and already-active saves readable; new encounters use
// the shared life pool instead of the former prescribed gambling sequence.
const LEGACY_ONLINE_STORIES = new Set(['AGE20U','AGE20N','UG01','UG02','UG03','UG11','UG12']);
const LEGACY_SCHEME_STORIES = new Set(['AGE24A','PON01','PON02','PON03','PON04','PON05','PON06','PON07','PON08']);
const onlineStory = event => Boolean(event?.onlineGambling);
const cryptoStory = event => Boolean(event?.cryptoLife);
const asyncStory = event => onlineStory(event)||cryptoStory(event);
const cryptoBankrupt = state => !state.survival?.failed && cryptoLifeSummary(state,getEndingMetrics(state)).ending?.id==='bankruptcy';
const terminalLife = state => state.survival?.failed || cryptoBankrupt(state);
// Scheme nodes recur across different projects; their per-project limits are
// checked by schemeEventAllowed, independently of the global seen-events list.
const repeatableStory = event => Boolean(event?.schemeLife || event?.onlineGambling?.repeatable || event?.onlineGambling?.repeat || event?.cryptoLife?.repeatable);
const REQUIREMENT_NAMES = {
  adult: '年满 18 岁后开放', bank_eligible: '需要稳定收入或有效资产，以及足够银行授信',
  consumer_credit_eligible: '需要可验证收入、信用及剩余消费授信', debt_positive: '当前没有需要处理的债务',
  saleable_asset_positive: '当前没有已解锁的可出售资产', claim_positive: '当前没有待追偿债权',
  family_reserve_positive: '家中已经没有可援助的储备',
};
const PRODUCT_CATEGORY = {
  stock: '股票', fund: '基金与债券', bond: '基金与债券', option: '期权', option_short: '期权',
  futures: '期货与合约', crypto: '加密资产', ponzi: '资金盘与骗局', angel: '天使投资与创业股权', housing: '房产与大额资产',
};

function clone(value) { return structuredClone(value); }
function roll(state) { const r = rngNext(state.rng); state.rng = r.seed; return r.value; }
function hash(text) { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function pick(items, value, weight = item => item.weight ?? 1) {
  const valid = items.filter(item => Number.isFinite(weight(item)) && weight(item) > 0);
  const total = valid.reduce((sum, item) => sum + weight(item), 0);
  let cursor = value * total;
  for (const item of valid) { cursor -= weight(item); if (cursor < 0) return item; }
  return valid.at(-1) ?? null;
}
function error(state, message) { return { ...state, lastResult: { title: '这一步还不能进行', text: message, error: message } }; }
function eventById(catalog, id) { return catalog.events.find(event => event.id === id); }
function queued(state, id) { return state.activeEvent?.eventId === id || state.eventQueue.includes(id); }
function hasSeen(state, id) { return state.seenEvents.includes(id); }
function flag(state, key) {
  if (key === 'partner') return Boolean(state.household.partner);
  if (key === 'has_child') return Boolean(state.household.hasChild);
  if (key === 'living_parent') return Boolean(state.household.livingParent);
  if (key === 'has_debt') return getMetrics(state).debt > 0;
  if (key === 'claim_exists') return getEligibility(state, 'claim_positive');
  if (key === 'saleable_asset') return getEligibility(state, 'saleable_asset_positive');
  if (key === 'overdue') return state.debts.some(item => item.overdue);
  return Boolean(state.flags[key]);
}
function basicEligibility(state, event, { anchor = false, world = false, system = false } = {}) {
  if (!event || LEGACY_ONLINE_STORIES.has(event.id) || LEGACY_SCHEME_STORIES.has(event.id) || (hasSeen(state, event.id) && !repeatableStory(event)) || !studentEventAllowed(state,event) || !storyContextAllowed(state,event)) return false;
  if (!event.schemeLife && event.category==='资金盘与骗局' && schemeLifeState(state).forbidRisk) return false;
  if (onlineStory(event) && !onlineEventAllowed(state,event,getMetrics(state))) return false;
  if (cryptoStory(event) && !cryptoEventAllowed(state,event,getMetrics(state))) return false;
  if(isTeenStory(event.id)&&state.age<teenStoryAge(event.id))return false;
  if(event.id==='REL03'&&!schoolAgeChild(state))return false;
  const prison = getLegalStatus(state).inPrison;
  if (prison && !(event.scene_scope === 'prison' || event.scene_scope === 'legal' || (event.kind === 'anchor' && event.age_min >= 60))) return false;
  if (!prison && event.scene_scope === 'prison') return false;
  if (['legal', 'release'].includes(event.scene_scope) && !system && !(state.runStats.legalNoticeIds ?? []).includes(event.id)) return false;
  if (!anchor && !world && (state.age < event.age_min || state.age > event.age_max)) return false;
  if (state.pending.some(item => (item.eventId ?? item.event_id) === event.id && item.dueTurn > state.turn)) return false;
  if (!(event.required_flags ?? []).every(key => flag(state, key))) return false;
  if ((event.excluded_flags ?? []).some(key => flag(state, key))) return false;
  return true;
}

function studentChoice(state,event,choice){
 if(!isCollegeStudent(state)||event.id!=='MAIN04'||choice.profile!=='job')return choice;
 return {...choice,label:'找份课余兼职',profile:'study',outcomes:choice.outcomes.map(outcome=>{
  const hired=outcome.effects.some(e=>e.op==='flag'&&e.key==='employed'&&e.value);
  return {...outcome,text:hired?'你和店主留了联系方式。课余可以去接半天或晚班兼职，做完再结工钱。':'问过几家店，暂时没有合适的兼职。先把课上好，之后再找。',effects:outcome.effects.filter(e=>!(e.op==='flag'&&e.key==='employed')).concat(hired?[{op:'flag',key:'part_time_contact',value:true}]:[])};
 })};
}

export function eligibleChoices(state, event) {
  return (event?.choices ?? []).filter(c=>studentChoiceVisible(state,c)).map(original =>
    cryptoStoryChoice(state,event,onlineStoryChoice(state,event,formativeChoice(state,event,studentChoice(state,event,contextualChoice(state,event,original)))))
  ).filter(choice=>!choice.onlineHidden&&!choice.cryptoHidden&&!choice.schemeHidden).map(choice => {
    let reason = choice.schemeReason||choice.cryptoReason||choice.onlineReason||choice.studentReason||'', planHint=choice.planHint||'';
    if(!reason&&['uw_gamble','uw_chase'].includes(choice.profile)&&(state.flags.gambling_quit||['QUIT','RECOVERED'].includes(state.behavior?.onlineGambling?.status)))reason='已经决定停止参与，旧事件仍可选择离开';
    if(!reason&&choice.onlineAction==='borrow')reason=getGamblingLoanReason(state);
    if(!reason&&choice.cryptoAction==='borrow')reason=getGamblingLoanReason(state);
    if (state.age < 18 && !CHILD_PROFILES.has(choice.profile)) reason = '未成年只能观察、学习或参与家庭生活';
    const requirements = choice.requirements ?? {};
    if (!reason && state.cash < (requirements.min_cash_yuan ?? 0) * 100) reason = `至少需要 ¥${(requirements.min_cash_yuan ?? 0).toLocaleString('zh-CN')} 可用现金`;
    if (!reason) {
      const missing = (requirements.all ?? []).find(key => !getEligibility(state, key));
      if (missing) reason = REQUIREMENT_NAMES[missing] ?? '当前条件未满足';
    }
    const effects = choice.outcomes.flatMap(outcome => outcome.effects ?? []);
    if(!reason)for(const effect of effects.filter(e=>e.op==='crypto_life')){reason=cryptoLifeActionReason(state,effect)||'';if(reason)break;}
    if(!reason&&effects.some(e=>e.op==='flag'&&e.key==='employed'&&e.value))reason=jobSearchWait(state);
    if(!reason&&isCollegeStudent(state)&&(choice.profile==='job'||effects.some(e=>e.op==='flag'&&e.key==='employed'&&e.value)))reason=COLLEGE_JOB_REASON;
    if(effects.some(e=>e.op==='extend_debt')){const plan=storyExtension(state);if(!reason)reason=plan.reason;planHint=plan.hint;}
    const marketProduct = PROFILE_PRODUCT[choice.profile];
    if (!reason && marketProduct && effects.some(e => ['venture','illiquid'].includes(e.op))) { const access = getMarketAccess(state, marketProduct); if (!access.unlocked) reason = access.reason; }
    const legal = getLegalStatus(state);
    if (!reason && legal.inPrison && (choice.profile === 'job' || effects.some(effect => !['stat', 'flag', 'schedule', 'legal_cooperate'].includes(effect.op)))) reason = '服刑期间只能处理狱中生活，不能参加外部工作、投资或借贷';
    if (!reason && effects.some(effect => effect.op === 'legal_cooperate') && !legal.cases.some(item => ['exposed', 'investigating'].includes(item.status) && !item.cooperated)) reason = '目前没有尚待配合的调查；已裁定责任仍需履行';
    if (!reason && (state.flags.exit_intent || state.flags.voluntary_exit) && ['options', 'option_sell', 'contract', 'ponzi', 'angel'].includes(choice.profile)) reason = '你已决定封盘，不再新增这类高风险投入';
    if (!reason && effects.some(effect => ['venture', 'illiquid', 'freeze_investment'].includes(effect.op) && effect.stake_fraction > 0) && state.cash <= 0) {
      reason = '当前没有可投入的现金';
    }
    if (!reason && choice.profile === 'settle' && state.age < 55) reason = '55 岁后可以提前查看人生结算';
    return { ...choice, disabled: Boolean(reason), reason, planHint };
  });
}

/** Public for encyclopedia explanations and exhaustive scheduler verification. */
export function getEventCandidates(state, catalog) {
  return catalog.events.filter(event => {
    if (queued(state, event.id)) return false;
    if (event.kind === 'anchor') return state.dueAnchors.includes(event.id) && basicEligibility(state, event, { anchor: true });
    if (event.kind === 'world') return state.runStats.worldQueue.includes(event.id) && basicEligibility(state, event, { world: true });
    return basicEligibility(state, event);
  });
}

function registerAnchors(state, fromAge, toAge, catalog) {
  for (const event of catalog.events) {
    if (event.kind === 'anchor' && event.age_min > fromAge && event.age_min <= toAge && !hasSeen(state, event.id) && !state.dueAnchors.includes(event.id)) state.dueAnchors.push(event.id);
  }
}
function planRemix(state, catalog) {
  const count = 6 + Math.floor(roll(state) * 5);
  const bag = [...catalog.history];
  const selected = [];
  for (let i = 0; i < Math.min(count, bag.length); i++) selected.push(bag.splice(Math.floor(roll(state) * bag.length), 1)[0]);
  return selected.map((history, index) => ({ eventId: history.id, age: Math.round((19 + index * (57 / count) + roll(state) * 2) * 2) / 2 }));
}
function dateNumber(date) {
  const [year, month = 1, day = 1] = date.split('-').map(Number);
  return year + (month - 1) / 12 + (day - 1) / 366;
}
function registerWorlds(state, nextAge, catalog) {
  const registered = new Set([...state.runStats.worldQueue, ...state.runStats.shocksApplied]);
  if (state.mode === 'history') {
    const now = state.birthYear + nextAge;
    for (const history of [...catalog.history].sort((a, b) => dateNumber(a.date) - dateNumber(b.date))) {
      const at = dateNumber(history.date);
      if (at >= state.birthYear && at <= now && !registered.has(history.id)) {
        state.runStats.worldQueue.push(history.id); registered.add(history.id);
      }
    }
  } else {
    for (const entry of state.runStats.remixPlan) if (entry.age <= nextAge && !registered.has(entry.eventId)) {
      state.runStats.worldQueue.push(entry.eventId); registered.add(entry.eventId);
    }
  }
}

/** Returns are game parameters, never claims about historical asset returns. */
export function historyShock(history) {
  const templates = {
    oil_shock: { returns: { stock: -.10 }, incomeFactor: .9 },
    equity_crash: { returns: { stock: -.32, futures: -.32 } },
    fx_regime_break: { returns: { futures: -.22 }, exposureFilter: { underlyings: ['GBP'] } },
    regional_credit_crisis: { returns: { stock: -.27, bond: -.12 }, incomeFactor: .8 },
    correlation_break: { returns: { stock: -.15, bond: -.06, futures: -.18 } },
    growth_bust: { returns: { stock: -.4, angel: -.5 }, incomeFactor: .88 },
    operational_shock: { returns: { stock: -.08, futures: -.08 } },
    counterparty_crisis: { returns: { stock: -.35, bond: -.15, futures: -.3 }, incomeFactor: .8 },
    fraud_revelation: { returns: { ponzi: -.95 }, exposureFilter: { kinds: ['ponzi'] } },
    flash_liquidity: { returns: { stock: -.12, futures: -.15 } },
    supply_disruption: { returns: { stock: -.1 }, incomeFactor: .83 },
    bank_resolution: { returns: {}, exposureFilter: { underlyings: ['CYPRUS_UNINSURED'] } },
    fx_gap: { returns: { futures: .3 }, exposureFilter: { underlyings: ['CHF'] } },
    equity_deleveraging: { returns: { stock: -.36, futures: -.36 } },
    political_repricing: { returns: { futures: -.15 }, exposureFilter: { underlyings: ['GBP'] } },
    volatility_feedback: { returns: { stock: -.1, futures: -.16 } },
    pandemic_shock: { returns: { stock: -.3, crypto: -.3, futures: -.3 }, incomeFactor: .55 },
    delivery_dislocation: { returns: { futures: -1.4 }, exposureFilter: { underlyings: ['WTI_2020_05'] } },
    meme_mania: { returns: { stock: 1.8, futures: 1.8 }, exposureFilter: { underlyings: ['GME'] } },
    war_spillover: { returns: { stock: -.15, bond: -.08 }, incomeFactor: .82 },
    stablecoin_collapse: { returns: { crypto: -.99 }, exposureFilter: { underlyings: ['UST', 'LUNA'] } },
    collateral_spiral: { returns: { bond: -.22 }, exposureFilter: { underlyings: ['UK_GILT'] } },
    custody_failure: { returns: { crypto: -.95 }, exposureFilter: { underlyings: ['FTX'] } },
    bank_run: { returns: {}, exposureFilter: { underlyings: ['SVB_BUSINESS_DEPOSIT'] } },
  };
  return { id: history.id, title: history.name, channels: history.shock_channels, ...clone(templates[history.archetype] ?? { returns: {} }) };
}

function expirePending(state, catalog) {
  if (getLegalStatus(state).inPrison) for (const item of state.pending) {
    const event = eventById(catalog, item.eventId ?? item.event_id);
    if (!['prison', 'legal'].includes(event?.scene_scope)) { item.dueTurn += 1; item.expiresTurn += 1; }
  }
  state.pending = state.pending.filter(item => {
    const id = item.eventId ?? item.event_id;
    if (hasSeen(state, id)) return false;
    if (state.turn <= item.expiresTurn && eventById(catalog, id)) return true;
    state.logs.push({ id: `chain-expired-${item.id}`, turn: state.turn, age: state.age, title: '一封没能赴约的邀请', text: `${item.reason ?? '之前的约定'} 后来条件变了，这条支线没有继续。`, kind: 'story' });
    state.runStats.expiredChains.push({ eventId: id, turn: state.turn, reason: item.reason });
    return false;
  });
}
function eventWeight(state, event) {
  let weight = Math.max(1, event.weight ?? 10);
  const interest = state.runStats.interests[event.category] ?? 0;
  weight *= 1 + Math.min(3, interest * .4);
  if (!state.runStats.categoryCounts[event.category]) weight *= 1.5;
  if (event.category === '归零与翻身' && state.flags.ever_wipeout && getMetrics(state).netWorth < 1000000) weight *= 3;
  if (event.category === '贷款与债务' && state.debts.some(debt => debt.overdue)) weight *= 2;
  if(cryptoStory(event))return cryptoEventWeight(state,{...event,cryptoLife:{...event.cryptoLife,weight}},getMetrics(state));
  return onlineStory(event) ? onlineEventWeight(state,{...event,onlineGambling:{...event.onlineGambling,weight}},getMetrics(state)) : weight;
}
function registerLegalNotices(state, before, catalog) {
  state.runStats.legalNoticeIds ??= [];
  state.runStats.legalMilestones ??= [];
  const oldCases = new Map((before.legal?.cases ?? []).map(item => [item.id, item.status]));
  const add = id => {
    if (eventById(catalog, id) && !hasSeen(state, id) && !state.runStats.legalNoticeIds.includes(id)) state.runStats.legalNoticeIds.push(id);
  };
  for (const item of state.legal?.cases ?? []) {
    if (['exposed', 'investigating'].includes(item.status)) add('LAW01');
    if (item.status === 'convicted' && oldCases.get(item.id) !== 'convicted') add('LAW02');
    if (item.status === 'admin_closed' && oldCases.get(item.id) !== 'admin_closed') add('LAW04');
    if (oldCases.get(item.id) !== item.status) state.runStats.legalMilestones.push({ caseId: item.id, status: item.status, turn: state.turn, age: state.age });
  }
  if (state.flags.legal_debt) add('LAW03');
  if ((state.legal?.releaseCount ?? 0) > (before.legal?.releaseCount ?? 0)) add('RE01');
}

function prepareTurnEvents(state, catalog) {
  expirePending(state, catalog);
  const selected = [];
  const anchors = state.dueAnchors.map(id => eventById(catalog, id)).filter(event => event && !queued(state, event.id) && basicEligibility(state, event, { anchor: true }));
  const pending = state.pending.filter(item => item.dueTurn <= state.turn).sort((a, b) => a.dueTurn - b.dueTurn || (a.eventId ?? a.event_id).localeCompare(b.eventId ?? b.event_id));
  // A registered life chapter always gets one of the two personal slots.
  if (anchors.length) selected.push(anchors[0]);
  const growth = catalog.events.filter(event => !isTeenStory(event.id) && event.category === '成长年记' && event.age_min === state.age && event.age_max === state.age && !queued(state,event.id) && basicEligibility(state,event));
  if (growth.length && selected.length < 2) selected.push(pick(growth,roll(state)));
  const notice = (state.runStats.legalNoticeIds ?? []).map(id => eventById(catalog, id)).find(event => event && !queued(state, event.id) && basicEligibility(state, event, { system: true }));
  if (notice && selected.length < 2) selected.push(notice);
  const crisisCandidates = catalog.events.filter(event => {
    if (event.kind !== 'personal' || queued(state, event.id) || !basicEligibility(state, event)) return false;
    if (event.id === 'FUT04' && state.flags.had_margin_crisis) return true;
    if (event.id === 'DEB06' && state.debts.some(debt => debt.overdue)) return true;
    return event.category === '归零与翻身' && state.flags.ever_wipeout && state.cash < getMetrics(state).monthlyExpense;
  });
  for (const item of pending) {
    if (selected.length >= 2) break;
    const event = eventById(catalog, item.eventId ?? item.event_id);
    if (!(onlineStory(event) && selected.some(onlineStory)) && !selected.some(candidate => candidate.id === event?.id) && !queued(state, event?.id) && basicEligibility(state, event)) selected.push(event);
  }
  if (crisisCandidates.length && selected.length < 2) { const crisis = pick(crisisCandidates.filter(e => !selected.some(s => s.id === e.id)), roll(state), event => eventWeight(state, event)); if (crisis) selected.push(crisis); }
  // One personal encounter per life period keeps memories alive through long adult chapters.
  // Anchors and invitations still occupy their existing slots; no branch owns a slot.
  const randomSlots = 1;
  while (selected.length < randomSlots) {
    const candidates = catalog.events.filter(event => !isTeenStory(event.id) && event.kind === 'personal' && basicEligibility(state, event) && !queued(state, event.id) && !selected.some(candidate => candidate.id === event.id) && !(onlineStory(event) && selected.some(onlineStory)));
    const marketCategories = new Set(['股票','基金与债券','期权','期货与合约','加密资产','资金盘与骗局','天使投资与创业股权','房产与大额资产']);
    const preferMarket = state.age >= 18 && roll(state) < .7;
    // Gambling memories can interrupt either kind of day; they still compete
    // for this same slot and must pass the shared time / ordinary-event gap.
    const preferred = candidates.filter(e => marketCategories.has(e.category) === preferMarket || asyncStory(e));
    const pool=preferred.length?preferred:candidates;
    const weights=new Map(pool.map(event=>[event.id,eventWeight(state,event)]));
    const memoryWeight=pool.filter(asyncStory).reduce((sum,e)=>sum+Math.max(1,e.weight??10),0),ordinaryWeight=pool.filter(e=>!asyncStory(e)).reduce((sum,e)=>sum+weights.get(e.id),0);
    // Large ordinary catalogs must not starve a lived memory. Eligibility still requires
    // both elapsed time and ordinary events, and refusals retain their lower weights.
    const memoryScale=memoryWeight&&ordinaryWeight?Math.max(1,ordinaryWeight*.6/memoryWeight):1;
    const candidate = pick(pool, roll(state), event => weights.get(event.id)*(asyncStory(event)?memoryScale:1));
    if (!candidate) break;
    selected.push(candidate);
  }
  selected.sort((a, b) => {
    const priority = event => crisisCandidates.some(item => item.id === event.id) ? 90 : state.pending.some(item => (item.eventId ?? item.event_id) === event.id && item.dueTurn <= state.turn) ? 80 : event.priority;
    return priority(b) - priority(a) || a.id.localeCompare(b.id);
  });
  state.eventQueue.push(...selected.map(event => event.id));
  state.eventQueue.sort((a, b) => (eventById(catalog, b)?.priority ?? 0) - (eventById(catalog, a)?.priority ?? 0));
  queueTeenStories(state,catalog);
}
function queueTeenStories(state,catalog){
 if(state.age<12||state.age>=18)return false;
 for(const {id,age} of TEEN_STORY_STEPS){
  const event=eventById(catalog,id);
  if(state.age<age||!event||queued(state,id)||!basicEligibility(state,event))continue;
  state.eventQueue.push(id);
 }
 // Required stories keep their authored sequence even when priorities differ.
 state.eventQueue.sort((a,b)=>{const x=teenStoryOrder(a),y=teenStoryOrder(b);return x===y?0:x<y?-1:1;});
 return state.eventQueue.some(isTeenStory);
}
function activateNext(state, catalog) {
  queueStudentStory(state,catalog);
  while (state.eventQueue.length) {
    const id = state.eventQueue.shift();
    const event = eventById(catalog, id);
    if (!event) continue;
    if (getLegalStatus(state).inPrison && !(event.scene_scope === 'prison' || event.scene_scope === 'legal' || (event.kind === 'anchor' && event.age_min >= 60))) {
      state.runStats.deferredEvents ??= [];
      if (!hasSeen(state, id) && !state.runStats.deferredEvents.includes(id)) state.runStats.deferredEvents.push(id);
      continue;
    }
    if (!basicEligibility(state, event, { anchor: event.kind === 'anchor', world: event.kind === 'world', system: true })) continue;
    const outcomes = {};
    for (const original of event.choices) {
      const choice=cryptoStoryChoice(state,event,onlineStoryChoice(state,event,formativeChoice(state,event,original)));
      const outcome = pick(choice.outcomes, roll(state));
      if (!outcome) throw new Error(`事件 ${event.id} 的 ${choice.id} 没有有效结果`);
      outcomes[choice.id] = outcome.id;
    }
    state.activeEvent = { eventId: id, outcomes, ...(asyncStory(event) ? {instanceId:`${cryptoStory(event)?'crypto':'online'}:${id}:${state.turn}:${++state.serial}`} : {}) };
    syncMarketNotices(state,catalog);
    meetStoryPeople(state,event);
    state.phase = 'event';
    state.lastResult = null;
    return state;
  }
  state.activeEvent = null;
  state.phase = 'planning';
  state.lastResult = null;
  return state;
}

export function createRun(options = {}, catalog) {
  if (!catalog?.events?.length || !catalog?.families?.length) throw new Error('缺少游戏剧情或家庭数据');
  const seed = String(options.seed ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`);
  const family = options.familyId ? catalog.families.find(item => item.id === options.familyId) : pick(catalog.families, rngNext(hash(`${seed}:family`)).value);
  if (!family) throw new Error('不存在这个家庭开局');
  const state = createState({ ...options, seed, family });
  Object.assign(state, { phase: 'planning', presentations: [], activeEvent: null, eventQueue: [], seenEvents: [], pending: [], lastResult: null, ending: null,
    matchedEndings: [], discoveredHistory: [], storyHistory: [], dueAnchors: [],
    runStats: { choices: 0, actions: 0, categoryCounts: {}, interests: {}, remixPlan: [], worldQueue: [], shocksApplied: [], expiredChains: [], settlements: [], worldLog: [], legalNoticeIds: [], legalMilestones: [], deferredEvents: [] },
  });
  seedStudentStories(state,seed);
  state.runStats.remixPlan = state.mode === 'remix' ? planRemix(state, catalog) : [];
  registerAnchors(state, -1, state.age, catalog);
  state.eventQueue.push(...state.dueAnchors);
  return activateNext(state, catalog);
}

export function chooseEvent(state, eventId, choiceId, catalog) {
  const original = eventById(catalog, eventId);
  if (state.phase !== 'event' || state.activeEvent?.eventId !== eventId || (hasSeen(state, eventId) && !repeatableStory(original))) return error(state, '这段事件已经处理，或当前没有展示它。');
  const event = cryptoStoryPresentation(state,onlineStoryPresentation(state,studentPresentation(state,isTeenStory(eventId)?contextualStory(state,original):original)));
  const choice = eligibleChoices(state, event).find(item => item.id === choiceId);
  if (!choice) return error(state, '找不到这个选项。');
  if (choice.disabled) return error(state, choice.reason);
  const outcome = choice.outcomes.find(item => item.id === state.activeEvent.outcomes[choiceId]);
  if (!outcome) return error(state, '这次结果记录缺失，请恢复完整存档。');
  const applied = applyEffects(state, outcome.effects, { eventId, choiceId, outcomeId: outcome.id, profile: choice.profile, prerequisites: choice.requirements?.all, min_cash_yuan: choice.requirements?.min_cash_yuan, onlineGambling:Boolean(event.onlineGambling||outcome.onlineResolution?.active),cryptoLife:Boolean(event.cryptoLife||outcome.cryptoResolution||outcome.schemeResolution), ...(state.activeEvent.instanceId ? {resolutionId:state.activeEvent.instanceId} : {}) });
  if (applied.result.error) return error(state, applied.result.error);
  const next = clone(applied.state);
  recordEducationEvent(next,eventId);
  if (!hasSeen(next,eventId)) next.seenEvents.push(eventId);
  next.runStats.legalNoticeIds = (next.runStats.legalNoticeIds ?? []).filter(id => id !== eventId);
  next.runStats.deferredEvents = (next.runStats.deferredEvents ?? []).filter(id => id !== eventId);
  next.dueAnchors = next.dueAnchors.filter(id => id !== eventId);
  next.pending = next.pending.filter(item => (item.eventId ?? item.event_id) !== eventId);
  for (const [index, schedule] of (asyncStory(event) || LEGACY_ONLINE_STORIES.has(eventId) ? [] : outcome.schedule ?? []).entries()) {
    if (hasSeen(next, schedule.event_id) || next.pending.some(item => (item.eventId ?? item.event_id) === schedule.event_id)) continue;
    next.pending.push({ id: `${outcome.id}:${index}`, eventId: schedule.event_id, dueTurn: next.turn + schedule.after_turns,
      expiresTurn: next.turn + schedule.expires_after_turns, reason: schedule.reason, sourceEventId: eventId });
  }
  next.runStats.choices += 1;
  next.runStats.categoryCounts[event.category] = (next.runStats.categoryCounts[event.category] ?? 0) + 1;
  if (RISK_PROFILES.has(choice.profile)) next.runStats.interests[event.category] = (next.runStats.interests[event.category] ?? 0) + 1;
  const history = { eventId, choiceId, outcomeId: outcome.id, turn: next.turn, age: next.age, title: event.title, choice: choice.label, text: outcome.text };
  next.storyHistory.push(history);
  next.logs.push({ ...history, id: `story-${state.activeEvent.instanceId || eventId}`, kind: 'story' });
  noteStoryPeople(next,event,choice,outcome);
  recordOnlineStory(next,state,event,choice,outcome);
  recordCryptoStory(next,state,event,choice,outcome);
  if(!event.schemeLife&&!outcome.schemeResolution)recordSchemeInterlude(next);
  if (!asyncStory(event) && !outcome.cryptoResolution && !outcome.schemeResolution && !outcome.onlineResolution?.active && !LEGACY_ONLINE_STORIES.has(eventId)) recordOnlineOrdinaryEvent(next,event);
  next.phase = 'result';
  next.lastResult = { ...applied.result, title: outcomeTitle(event,choice,outcome), text: outcome.text, details: outcome.onlineResolution?.active ? outcome.onlineResolution.details : applied.result.text, statChanges: Object.keys(state.stats).filter(key => next.stats[key] !== state.stats[key]).map(key => ({ key, value: next.stats[key] - state.stats[key] })), eventId, choiceId, outcomeId: outcome.id, choice: choice.label, ...(onlineStory(event)||outcome.onlineResolution?.active?{onlineGambling:true}:{}),...(cryptoStory(event)||outcome.cryptoResolution||outcome.schemeResolution?{cryptoLife:true}:{}) };
  next.lastResult.context=storyResultContext(event,choice,outcome,next.lastResult);
  recordStudentChoice(next,event,choice,outcome);
  return terminalLife(next)?settleRun(next,catalog):registerPresentations(state, next);
}

export function continueStory(state, catalog) {
  if (state.phase === 'event' || state.phase === 'ended') return state;
  const next = clone(state);
  if (next.childhood?.birth && next.lastResult?.eventId === 'MAIN01') next.childhood.birth.complete = true;
  next.activeEvent = null;
  if (next.flags.wants_epilogue && next.age >= 55 && next.age < 80) return settleRun({ ...next, phase: 'planning' }, catalog);
  queueTeenStories(next,catalog);
  activateNext(next, catalog);
  if (next.phase === 'planning' && next.age >= 80) return settleRun(next, catalog);
  return next;
}

/** Only an event with no available choices can be left without executing an outcome. */
export function leaveUnavailableEvent(state,catalog){
 if(state.phase!=='event'||!state.activeEvent)return error(state,'当前没有待处理事件');
 const event=eventById(catalog,state.activeEvent.eventId);
 if(!event||eligibleChoices(state,event).some(c=>!c.disabled))return error(state,'这件事还有可用选项，请先做决定');
 const next=clone(state);next.logs.push({id:`unavailable-${next.turn}-${event.id}`,turn:next.turn,age:next.age,kind:'story',title:`没能参与 · ${event.title}`,text:'当时没有满足条件的选择。这次没有执行交易或获得奖励，生活继续。'});
 next.eventQueue=next.eventQueue.filter(id=>id!==event.id);next.dueAnchors=next.dueAnchors.filter(id=>id!==event.id);next.pending=next.pending.filter(p=>(p.eventId??p.event_id)!==event.id);
 next.activeEvent=null;next.phase='planning';next.lastResult=null;return continueStory(next,catalog);
}

export function act(state, action, catalog) {
  if (state.phase !== 'planning') return error(state, '请先读完当前事件，再安排这段时间。');
  const applied = applyAction(state, action);
  if (applied.result.error) return error(state, applied.result.error);
  const next = clone(applied.state);
  next.lastResult = applied.result;
  next.runStats.actions += 1;
  let category = ['invest','desk_order'].includes(action.type) ? PRODUCT_CATEGORY[action.product] : null;
  if (['work', 'gig', 'seek_job'].includes(action.type)) category = '打工与职业';
  if (action.type.startsWith('business')) category = '经营与生意';
  if (['borrow', 'repay'].includes(action.type)) category = '贷款与债务';
  if (action.type === 'relationship') category = '关系与人生';
  if (action.type === 'market_practice' || action.type === 'market_review') category = '投资研习';
  if (category) next.runStats.interests[category] = (next.runStats.interests[category] ?? 0) + 1;
  return terminalLife(next)?settleRun(next,catalog):registerPresentations(state, next);
}

export function nextTurn(state, catalog) {
  if (state.phase !== 'planning') return error(state, '请先完成当前事件，避免漏掉人生里的决定。');
  if(state.familyLife?.pending)return error(state,'先处理和林夏的这件事，再继续生活。');
  if (terminalLife(state)||state.age >= 80) return settleRun(state, catalog);
  if(state.age>=6&&state.age<18){const ready=clone(state);if(queueStudentStory(ready,catalog))return activateNext(ready,catalog);}
  // Older saves must read outstanding eligible stories before leaving this school year.
  if(state.age>=12&&state.age<18){const ready=clone(state);if(queueTeenStories(ready,catalog))return activateNext(ready,catalog);}
  if(needsDailySettlement(state,getMetrics(state),getTurnMonths(state)))return act(state,{type:'calendar_day'},catalog);
  // A relationship's calendar is real elapsed life, not one update per chapter.
  // Route compressed days through the daily engine so each pending milestone pauses it.
  if(familyTimeActive(state)&&state.age>=18.5&&state.age<80&&!state.legal?.prisonMonthsLeft&&(state.debtClock?.periodDays||0)<getTurnMonths(state)*30)return act(state,{type:'chapter_days',days:30},catalog);
  const prepared = clone(state);
  const nextAge = Math.min(80, state.age + getTurnMonths(state) / 12);
  registerWorlds(prepared, nextAge, catalog);
  const worldId = prepared.runStats.worldQueue[0];
  const history = catalog.history.find(item => item.id === worldId);
  const shock = history ? historyShock(history) : null;
  const advanced = advanceTurn(prepared, shock);
  if (advanced.result.error) return error(state, advanced.result.error);
  const next = clone(advanced.state);
  next.lastResult = advanced.result;
  if(terminalLife(next))return settleRun(next,catalog);
  if(next.turn===state.turn)return registerPresentations(state,next);
  next.activeEvent = null;
  registerAnchors(next, state.age, next.age, catalog);
  if (worldId && history) {
    next.runStats.worldQueue.shift();
    next.runStats.shocksApplied.push(worldId);
    next.discoveredHistory.push(worldId);
    next.runStats.worldLog.push({ eventId: worldId, age: next.age, turn: next.turn, historicalDate: history.date, mode: next.mode });
    if (!hasSeen(next, worldId)) next.eventQueue.push(worldId);
  }
  registerLegalNotices(next, state, catalog);
  if (!getLegalStatus(next).inPrison && next.runStats.deferredEvents?.length) {
    for (const id of next.runStats.deferredEvents) if (!hasSeen(next, id) && !next.eventQueue.includes(id)) next.eventQueue.push(id);
    next.runStats.deferredEvents = [];
  }
  prepareTurnEvents(next, catalog);
  return registerPresentations(state, activateNext(next, catalog));
}

function matchesCondition(condition, state, metrics) {
  if (condition.all) return condition.all.every(rule => matchesCondition(rule, state, metrics));
  if (condition.any) return condition.any.some(rule => matchesCondition(rule, state, metrics));
  if ('flag' in condition) return flag(state, condition.flag) === condition.is;
  const value = metrics[condition.metric] ?? state.stats[condition.metric];
  if (!Number.isFinite(value)) return false;
  switch (condition.op) {
    case 'gte': return value >= condition.value;
    case 'gt': return value > condition.value;
    case 'lte': return value <= condition.value;
    case 'lt': return value < condition.value;
    case 'eq': return value === condition.value;
    default: return false;
  }
}
export function evaluateEndings(state, catalog) {
  const metrics = getEndingMetrics(state);
  return catalog.endings.filter(ending => matchesCondition(ending.condition, state, metrics)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}
export function settleRun(state, catalog) {
  if (state.phase === 'ended') return state;
  if (!terminalLife(state) && state.age < 55) return error(state, '55 岁后可以提前结算，现在的人生还在展开。');
  if (state.phase === 'event'&&!terminalLife(state)) return error(state, '请先完成眼前这段剧情，再翻到人生后记。');
  const next = settleRiskEpilogue(clone(state));
  if(cryptoBankrupt(next))next.flags.crypto_final_loss=true;
  next.matchedEndings = evaluateEndings(next, catalog);
  if(next.flags.crypto_final_loss){
    const history=cryptoLifeSummary(next,getEndingMetrics(next)),yuan=n=>`¥${(n/100).toFixed(2)}`;
    const epilogue=`Crypto 历史最高持仓 ${yuan(history.highestCryptoWealth)}，实际累计回款 ${yuan(history.returned)}（含本金）。结算时，个人资产 ${yuan(history.finalAssets)}，负债 ${yuan(history.finalDebt)}。${history.ending?.text||''}`;
    next.matchedEndings=next.matchedEndings.map(e=>e.id==='E34'?{...e,epilogue}:e);
  }
  if (next.matchedEndings[0]?.id === 'E31' && next.behavior?.onlineGambling?.totalBets > 0) {
    const history = onlineGamblingSummary(next, getEndingMetrics(next));
    const yuan = amount => `¥${(amount / 100).toFixed(2)}`;
    const epilogue = `账目里，累计现金下注 ${yuan(history.staked)}，累计返还（含本金）${yuan(history.returned)}。结算时，资产 ${yuan(history.finalAssets)}，负债 ${yuan(history.finalDebt)}。你曾经有 ${history.exitOpportunities} 次离场机会，记录中实际离场 ${history.quitCount} 次。`;
    next.matchedEndings = next.matchedEndings.map(ending => ending.id === 'E31' ? { ...ending, epilogue } : ending);
  }
  next.ending = next.matchedEndings[0] ?? { id: 'E24', title: '明天照常开门', epilogue: '故事翻到这里，生活仍有下一页。', open_directions: ['再走一段', '换一个出身'] };
  next.runStats.settlements.push({ age: next.age, turn: next.turn, endingId: next.ending.id, matchedIds: next.matchedEndings.map(item => item.id), netWorth: getEndingMetrics(next).netWorth });
  next.phase = 'ended';
  next.activeEvent = null;
  next.lastResult = { title: next.ending.title, text: next.ending.epilogue };
  return next;
}
export function resumeRun(state, catalog) {
  if (state.phase !== 'ended') return error(state, '这段人生仍在进行。');
  if(state.flags?.crypto_final_loss)return error(state,'Crypto 破产已经结算，可以保留档案或开启新人生。');
  if(state.riskLife?.terminal)return error(state,'这篇清算尾声已经结束，可以保留档案或开启新人生。');
  if(state.survival?.failed)return error(state,'生存失败已经结算，可以保留档案或开启新人生。');
  if (state.age >= 80) return error(state, '这一生已经收盘，可以保留档案，开启平行人生。');
  const next = clone(state);
  next.ending = null;
  next.matchedEndings = [];
  next.flags.wants_epilogue = false;
  next.flags.gambling_final_loss = false;
  next.flags.allin_final_loss = false;
  next.phase = 'planning';
  next.lastResult = null;
  return activateNext(next, catalog);
}

export function getEventPresentation(state, event, catalog) {
  if (!event) return null;
  if(event.studentStory)return studentPresentation(state,event);
  const presented = { ...contextualStory(state,event) };
  if (event.id === 'MAIN01') presented.prompt = `${event.prompt}\n\n你出生在${state.familyName}。${catalog.families.find(family => family.id === state.familyId)?.opening ?? ''}`;
  if(event.id==='MAIN04'&&isCollegeStudent(state))presented.prompt='成年赠与已按家庭开局入账。大学四年刚刚开始，阿豪发来市场群，林夏转来课余兼职信息，父母问你到学校没有。';
  if (event.id === 'MAIN06') {
    const metrics = getMetrics(state);
    const title = state.businesses.length ? '老板' : state.stats.fame >= 50 ? '老师' : state.flags.ever_wipeout ? '那个曾经很有钱的人' : state.stats.skill >= 50 ? '师傅' : state.flags.employed ? '同事' : metrics.netWorth > 100000000 ? '大户' : '老同学';
    presented.prompt = `电话那头先喊了一声“${title}”。你愣了一下，原来这些年的日子，已经变成别人嘴里的称呼。今天，又有人把一个机会送到你面前。`;
  }
  if (event.id === 'MAIN07') presented.prompt = state.household.hasChild ? '家里的开销刚付，灯还亮着。一笔新的机会出现，这次你手里的筹码，每一枚都有名字。' : state.household.partner ? '你和伴侣刚算完家用，一笔新的机会又找上门。说好要留下的那笔钱，此刻变得格外显眼。' : '房租、长辈的电话，还有为未来留的钱。一笔新的机会找上门，你发现账户已经不只是一个数字。';
  if (event.id === 'MAIN08') {
    const metrics = getMetrics(state);
    const situation = metrics.netWorth >= Math.max(100000000, state.peakNetWorth * .9) ? '你站在过去没敢想过的高点。' : state.flags.ever_wipeout && metrics.netWorth > 0 ? '你刚从谷底爬回来，鞋上还有泥。' : '你还在找出路，不过这次已经认识了不少岔口。';
    presented.prompt = `${situation}四十二岁，半场还不是终场。一个旧人坐到你对面，把一份新计划推了过来。`;
  }
  if (event.kind === 'world') {
    const history = catalog.history.find(item => item.id === event.history_ref);
    presented.history = history;
    presented.modeLabel = state.mode === 'remix' ? '时代乱流 · 历史原型重组' : `${history?.date ?? event.historical_date} · 历史回放`;
    presented.scopeNote = `${presented.modeLabel}。冲击只结算相关持仓与收入；下方选择是冲击之后的新决定。`;
    if (state.age < 18) presented.prompt = `这年的新闻从家里的电视传出来。大人在饭桌边讨论，你还没有自己的投资账户。\n\n${history?.fact ?? event.prompt}`;
  }
  if (event.kind === 'anchor' && getLegalStatus(state).inPrison) {
    presented.title = `服刑中的 ${event.age_min} 岁 · ${event.id === 'MAIN12' ? '这一生的后记' : '人生仍有这一页'}`;
    presented.prompt = `你在服刑期间走到这个年龄。外面的生活没有为你停下，未偿责任和剩余刑期也不会被一次结算清除。今天，你可以在规定内学习、反思、写信，或从这里读一遍自己的后记。`;
  } else if (event.kind === 'anchor' && state.age > event.age_max + 1 && state.flags.ever_released) {
    presented.title = `迟到的人生章节 · ${event.title}`;
    presented.prompt = `这段生活曾因服刑而推迟。现在，你重新有机会面对它。\n\n${presented.prompt}`;
  }
  if(event.id==='MAIN05'&&state.education?.college&&!getLegalStatus(state).inPrison){presented.title='大学毕业了，接下来走哪条路';presented.prompt='学士帽的流苏拨到一旁，毕业合影终于拍完了。四年的课本和宿舍生活装进行李箱，同学们有人找工作，有人准备继续读书。家里的大学生活费从此停发，接下来的开支，要开始由自己安排。';presented.artKey='graduation';}
  if(event.id==='REC07')presented.artKey='personal-budget';
  if(event.id==='HAO01')presented.artKey='order-work';
  if(event.id==='HST15')presented.artKey='contract-intro';
  if(event.id==='OPT06'&&isCollegeStudent(state))presented.artKey='options-intro';
  if(event.id==='HST16')presented.artKey='volatility-news';
  const locked=[...new Set(event.choices.map(c=>PROFILE_PRODUCT[contextualChoice(state,event,c).profile]).filter(Boolean))].map(k=>[k,getMarketAccess(state,k)]).filter(([,a])=>!a.unlocked);
  if(locked.length)presented.scopeNote=[presented.scopeNote,...locked.map(([k,a])=>`${k==='futures'?'期货与外汇（含指数合约）':k==='option'||k==='option_short'?'期权':PRODUCT_CATEGORY[k]||k}：${a.reason}。故事引入后会在投资市场显示；满足条件后可交易。`)].filter(Boolean).join(' ');
  const intro=marketStoryIntroduction(state,event,catalog);
  if(intro&&!presented.housingIntroduction){presented.title=`${intro[0]} · ${presented.title}`;if(event.id!=='OPT06')presented.prompt=`${intro[1]}\n\n${presented.prompt}`;}
  return cryptoStoryPresentation(state,onlineStoryPresentation(state,presented));
}
