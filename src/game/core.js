import {schemeLifeState,validateSchemeLife,advanceSchemeLife,recordSchemeInterlude,recordSchemeTrade} from './scheme-life.js';
import {ensureCryptoLife,validateCryptoLife,advanceCryptoLife,recordCryptoLifeTrade} from './crypto-life.js';
import {executeCryptoLifeEffect,cryptoLifeActionReason,settleCryptoLifeSchemes,validateCryptoLifeFinance} from './crypto-life-finance.js';
import {housingQuote} from './housing.js';
import {jobSearchWait} from './job-search.js';
import {FAMILY_ACTIONS,familyActionReason,executeFamilyAction,familyAssetValue,familyScene,familyTimeActive,ensureFamily} from './family-life.js';
import {startCareer,careerOffer} from './careers.js';
import {acceptJobOpportunity,jobOfferReason} from './job-opportunities.js';
import {storyCashLabel} from './story-presentation.js';
import {stagePlanReason,selectStagePlan,validateStagePlan} from './stage-plan.js';
import {recordChapterProgress,validateChapters} from './life-chapters.js';
import {chapterDaysReason,runChapterDays} from './chapter-days.js';
import {recordCryptoTrade} from './crypto-records.js';
import {queueRealizedProfit as noteRealizedProfit,flushRealizedProfit} from './consumption.js';
import {FUTURES_INSTRUMENTS,futuresPeriodPrices,futurePrice} from './futures-markets.js';
import {isCollegeStudent,COLLEGE_JOB_REASON} from './education.js';
import {ADULT_GIFT_CAP,cappedGiftRange} from './family-gift.js';
import {welcomeChild,childAge} from './household.js';
import {validateAttendance,dismissedToday} from './attendance.js';
import {livingPlanReason,changeLivingPlan,livingPlanEffects,validateLivingPlan} from './living-plan.js';
import {routinePlanReason,runRoutinePlan,validateRoutinePlan} from './routine-plan.js';
import {validateWorkStories} from './work-stories.js';
import {hasMetPerson,meetPerson,personRelation,setPersonRelation} from './people.js';
import {tradeTerms,orderLabel} from './trade-terms.js';
import {syncEmployment,advanceEmployment,validateEmployment} from './employment.js';
import {fatigueAffectsIncome,fatigueIncomeReason,hasSalariedJob,preservePension,monthlyReceipts,ECONOMY_REVISION,jobMonthlyPay,fullDayPay,fullDayWorkReason,recordWork,validateWorkEconomy,markNewJobStart} from './work-economy.js';
import {livingCostBreakdown,advanceLivingCosts} from './living-costs.js';
import {DAY_ACTIONS,ensureRoutine,resetRoutineDay,routineAvailability,chooseActivity,chooseDayEvent,arriveRoutineSlot,finishRoutineSleep,workDistraction,marketActivity,completeRoutineWork,routineClock,aShareSession} from './day-routine.js';
import {CRYPTO_LEVERAGES,cryptoMaintenanceRate,isRugged,cryptoCoin} from './crypto-markets.js';
import {ensureGameCalendar,gameDate,addGameDays,periodDate} from './game-calendar.js';
import {newPayroll,payrollBase,settlePayroll,validatePayroll} from './payroll.js';
import {newCollegeSupport,settleCollegeSupport,validateCollegeSupport} from './college-support.js';
import {settleMemeProjects} from './crypto-events.js';
import {upbringing} from './market-intelligence.js';
import {newRiskLife,recordRiskOrder,recordRiskCommitment,riskEndingKind,validateRiskLife} from './risk-ending.js';
import {growthDelta} from './growth.js';
import {childhoodActivity,CHILD_REBEL_ACTIONS} from './childhood-activities.js';
import {nextChildhoodAge,childhoodStageYears} from './childhood-stages.js';
import {settleChildhoodAllowance} from './childhood-economy.js';
import {POCKET_MONEY_AGE,CHILD_ACTIONS,childAvailability,executeChild,validateChildhood,childhoodValue} from './childhood-state.js';
import {orderCost} from './order-budget.js';
import {newLifeArcs,lifeArcs,captureWage,LIFE_ACTIONS,lifeAvailability,executeLife,noteLifeAction,observeLife,advanceLifeDays,validateLifeArcs} from './life-arcs.js';
import {newJourney,validateJourney} from './play-guide.js';
import {STOCKS,stockInstrument,stockMarket,stockLot,stockPeriodMoves,markStockSegment} from './stock-markets.js';
import {newDebtClock,debtClock,attachSchedule,advanceDebtClock,validateDebtClock,calendarRows,extensionTerms,extendDebt,storyExtension} from './debt-calendar.js';
import {newBehavior,behaviorState,storyRiskAction,BEHAVIOR_ACTIONS,behaviorAvailability,executeBehavior,trackRisk,afterLifeAction,refreshBehavior,advanceBehaviorDays,fatigueWage,validateBehavior,recordDisciplineLiquidation} from './behavior.js';
import {advanceOnlineGambling,recordOnlineQuit,recordOnlineRefusal,recordOnlineOrdinaryEvent,validateOnlineGambling} from './online-gambling.js';
import {newSurvival,remainingLiving,survivalStatus,syncSurvival,settleSurvivalDay,resetSurvivalPeriod,validateSurvival,survivalActionReason,secureFood,HOSPITAL_COST} from './survival.js';
import {LOAN_TYPES,loanTerms} from './loans.js';
/** 中国式赌狗：可重放的整数分账本。模型为游戏虚构规则，不连接真实市场。 */
import { LEGAL_TYPES, createLegalState, getLegalStatus, validateLegalState } from './legal.js';
import { getMarketAccess, recordMarketExperience, rememberOpenMarkets, PROFILE_PRODUCT } from './market-access.js';
import { MARKET_ACTIONS, marketAvailability, executeMarket as executeMarketRaw, newTrading, tradingState, stockSellReason, finishTradingPeriod as finishTradingPeriodRaw, resetTradingPeriod, tickMarket as tickMarketRaw, openTradingDay, skipSleepingMorning, executePlans } from './market-play.js';
import {newEducation,advanceEducation,validateEducation,ensureLearningStats} from './education.js';
export { getLegalStatus } from './legal.js';
const SCALE = 1_000_000;
const MAX = Number.MAX_SAFE_INTEGER;
const STATS = ['health', 'stress', 'academic', 'discipline', 'skill', 'insight', 'trust', 'fame', 'credit'];
const STAT_DEFAULTS = { health: 70, stress: 20, academic: 10, discipline: 35, skill: 10, insight: 10, trust: 50, fame: 0, credit: 60 };
export const PRODUCTS = Object.freeze({
  crypto_perp: { name:'加密日内合约', min:100_000, risk:'极高', description:'10 至 1000 倍逐仓，日内可平仓，每日结算时自动结清；亏掉借来的保证金，借款仍需偿还。' },
  stock: { name: '股票自选组合', min: 100_000, risk: '中高', description: 'A 股 T+1；港股、美股日内可卖。三地走势不同，均有回撤与交易受限的可能。' },
  fund: { name: '混合基金', min: 100_000, risk: '中', description: '分散配置；新申购下一交易日可赎回，赎回费 1%。' },
  bond: { name: '企业债券', min: 100_000, risk: '中低', description: '票息 3% / 6% / 9%，按实际持有时长付息；价格可能下跌，发行方可能违约。' },
  option: { name: '买入期权', min: 100_000, risk: '极高', description: '认购或认沽，可选今日、第 3 或第 5 个交易日到期；最大损失为权利金。' },
  option_short: { name: '卖出期权', min: 1_000_000, risk: '追索风险', description: '缴纳保证金，按类型、行权价和期限收取权利金；赔付可能超过保证金并形成债务。' },
  futures: { name: '期货与外汇', min: 100_000, risk: '极高', description: '2 / 5 / 10 倍杠杆；权益低于初始保证金 10% 时强平。逐仓保护不会形成穿仓债。' },
  crypto: { name: '加密现货', min: 100_000, risk: '高', description: '持有现货，无杠杆；托管平台可能冻结资产，币价上涨也无法立即提现。' },
  ponzi: { name: '高息资金盘', min: 100_000, risk: '危险', description: '收益仅为平台账面数字；每回合有冻结风险，退出时也可能遭遇提现失败。' },
  angel: { name: '天使轮股权', min: 1_000_000, risk: '极高', description: '锁定 6 回合；估值不是现金，会融资稀释、失败或产生大额退出收益。' },
  housing: { name: '个人房产', min: 5_000_000, risk: '中高', description: '出租房投资，锁定 2 回合；不减免自己的住宿费。租金扣除维护与空置成本，出售折价 5%。可另选按揭模式。' },
});

const clone = value => structuredClone(value);
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
function checked(n, label = '金额') {
  if (!Number.isSafeInteger(n)) throw new Error(`${label}超出可计算范围`);
  return n;
}
function nonnegative(n, label = '金额') {
  checked(n, label);
  if (n < 0) throw new Error(`${label}不能为负数`);
  return n;
}
function sum(values) { return values.reduce((a, b) => checked(a + checked(b)), 0); }
function mul(n, factor) {
  checked(n);
  if (!Number.isFinite(factor) || Math.abs(factor) > MAX / SCALE) throw new Error('倍率超出可计算范围');
  const numerator = BigInt(n) * BigInt(Math.round(factor * SCALE));
  const negative = numerator < 0n;
  const result = Number(((negative ? -numerator : numerator) + BigInt(SCALE / 2)) / BigInt(SCALE));
  return checked(negative ? -result : result);
}
function yuan(n) { if (!Number.isFinite(n)) throw new Error('金额格式无效'); return nonnegative(mul(100, n)); }
function fraction(n, name = '比例') { if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error(`${name}必须在 0–1 之间`); return n; }
function uid(s, prefix) { s.serial = checked((s.serial || 0) + 1); return `${prefix}-${s.turn}-${s.serial}`; }
function hashSeed(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function rngNext(seedNumber) {
  let seed = (Number(seedNumber) + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return { value: ((t ^ t >>> 14) >>> 0) / 4294967296, seed };
}
function draw(s) { const r = rngNext(s.rng); s.rng = r.seed; return r.value; }
export function random(state) { const s = clone(state); return [draw(s), s]; }
function sampleRange(s, range, fallback = [0, 0]) {
  const [min, max] = range || fallback;
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || max < min) throw new Error('家庭金额区间无效');
  return yuan(min + Math.floor(draw(s) * (max - min + 1)));
}
export function getTurnMonths(state) {
  if (state.age >= 80) return 0;
  if (state.age < 18) return Math.round((nextChildhoodAge(state.age)-state.age) * 12);
  const regular = Math.round(Math.min(state.age < 36 ? 0.5 : 1, 80 - state.age) * 12);
  const left = state.legal?.prisonMonthsLeft || 0;
  return left > 0 ? Math.min(regular, left) : regular;
}
function log(s, title, text, kind = 'system', extra = {}) {
  s.logs.push({ id: uid(s, 'log'), turn: s.turn, age: s.age, title, text, kind, ...extra });
}
function record(s, account, amount, label, extra = {}) {
  checked(amount);
  amount = amount === 0 ? 0 : amount;
  s.ledger.push({ id: uid(s, 'entry'), turn: s.turn, age: s.age, account, amount, label, date:gameDate(s), lifeDay:s.debtClock?.day||0, ...extra });
}
function cashChange(s, amount, label, extra = {}) {
  const next = checked(s.cash + checked(amount));
  if (next < 0) throw new Error('现金不足，操作未发生');
  s.cash = next;
  record(s, 'cash', amount, label, extra);
}
function stat(s, delta = {}) {
  for (const [key, value] of Object.entries(delta)) {
    if (!STATS.includes(key) || !Number.isFinite(value)) throw new Error('属性变化格式无效');
    if (!Number.isFinite(s.stats[key])) s.stats[key] = STAT_DEFAULTS[key];
    // Sleep cannot replace meals while hunger is unresolved.
    const gain=key==='health'&&value>0&&(s.survival?.hungryDays||0)>0?0:value;
    s.stats[key] = clamp(s.stats[key] + growthDelta(s,key,gain));
  }
}
function activityStats(s,child,fallback){
 if(!child)return stat(s,fallback);
 for(let year=0;year<childhoodStageYears(s);year++)stat(s,child.delta);
}
function debtTotal(s) { return sum(s.debts.map(d => checked(d.principal + d.interest))); }
function expense(s) { return livingCostBreakdown(s).total; }
function income(s) { return s.legal?.prisonMonthsLeft > 0 ? 0 : checked(monthlyReceipts(s) + sum(s.businesses.map(b => Math.max(0, b.monthlyProfit)))); }
function isSaleable(s, p) { return !stockSellReason(s,p) && !p.frozen && (p.lockUntilTurn || 0) <= s.turn && (p.suspendedUntilTurn || 0) <= s.turn && p.value > 0; }
function installment(d) { return checked(Math.ceil(d.principal / Math.max(1, d.monthsLeft)) + mul(d.principal, d.aprBps / 120000) + d.interest); }
export function getMetrics(state) {
  const positions = sum(state.positions.map(p => p.value))+familyAssetValue(state);
  const claims = sum(state.claims.map(c => c.value));
  const businesses = checked(sum(state.businesses.map(b => b.value))+childhoodValue(state));
  const assets = sum([state.cash, positions, claims, businesses]);
  const debt = debtTotal(state);
  const netWorth = checked(assets - debt);
  const monthlyExpense = expense(state);
  const monthlyIncome = income(state);
  const livingReserve=remainingLiving(state,monthlyExpense,getTurnMonths(state));
  const availableCash = Math.max(0, checked(state.cash - livingReserve));
  const cashableAssets=familyAssetValue(state)+sum([...state.positions.filter(p=>isSaleable(state,p)&&!['ponzi','option_short'].includes(p.kind)).map(p=>{const rate=p.kind==='housing'?.05:p.kind==='fund'?.01:p.kind==='angel'?.08:.002;const d=state.debts.find(d=>d.id===p.mortgageId);return Math.max(0,p.value-mul(p.value,rate)-(d?d.principal+d.interest:0));}),...state.businesses.map(b=>mul(b.value,.8))]);
  const liquid = checked(state.cash + sum(state.positions.filter(p => isSaleable(state, p) && !['angel', 'housing', 'ponzi'].includes(p.kind)).map(p => p.value)));
  const pendingCases=(state.legal?.cases||[]).filter(c=>!c.settled);
  const pendingBills=sum(pendingCases.map(c=>sum([c.confiscation,c.fine,c.restitution])));
  const plainSavings=checked(state.cash+sum(state.positions.filter(p=>['stock','fund','bond'].includes(p.kind)&&isSaleable(state,p)).map(p=>Math.max(0,p.value-mul(p.value,p.kind==='fund'?.01:.002))))-debt-pendingBills);
  return {
    cash: state.cash, assets, debt, netWorth, availableCash, monthlyIncome, monthlyExpense, livingReserve, cashableAssets,
    invested: positions, claims, businesses, liquid, debtService: sum(state.debts.map(installment)),
    cash_yuan: state.cash / 100, assets_yuan: assets / 100, net_worth_yuan: netWorth / 100,
    debt_yuan: debt / 100, claims_yuan: claims / 100,
    peak_net_worth_yuan: state.peakNetWorth / 100,
    monthly_income_yuan: monthlyIncome / 100, monthly_expense_yuan: monthlyExpense / 100,
    private_equity_yuan: sum(state.positions.filter(p => p.kind === 'angel').map(p => p.value)) / 100,
    realized_equity_proceeds_yuan: (state.realizedEquityProceeds || 0) / 100,
    business_cashflow_yuan: state.legal?.prisonMonthsLeft > 0 ? 0 : sum(state.businesses.map(b => b.monthlyProfit)) / 100,
    business_count: state.businesses.filter(b => b.value > 0).length,
    liquid_ratio: assets > 0 ? liquid / assets : 0,
    reserve_months: monthlyExpense ? state.cash / monthlyExpense : 0,
    investable_equity_yuan: checked(availableCash + positions - debt) / 100,
    debt_free_turns: state.debtFreeTurns, wipeouts: state.wipeouts,
    pendingLegalBills:pendingBills,
    plain_investor:Number(['stock','fund','bond'].some(k=>state.flags[`${k}_investor`])),
    retirement_cover_months:monthlyExpense?Math.max(0,plainSavings)/monthlyExpense:0,
    pending_case_count:pendingCases.length,
    legal_debt_yuan: getLegalStatus(state).legalDebt / 100,
    prison_months_left: state.legal?.prisonMonthsLeft || 0, total_prison_months: state.legal?.totalPrisonMonths || 0,
    ...state.stats,
  };
}
export function getSurvivalStatus(s){return survivalStatus(s,getMetrics(s));}
/** The preview and the payment share one quote; daily work never pays a whole period. */
export function getWorkOffer(s,type='work'){
  const daily=true;
  const base=Math.round(fullDayPay(s,type));
  const pay=fatigueAffectsIncome(s)?mul(base,.75):base;
  const specialist=upbringing(s)==='practical'&&s.childhood.workBonusTurn!==s.turn;
  const bonus=specialist?mul(pay,.1):0;
  return {daily,pay,bonus,total:checked(pay+bonus),specialist,reason:fatigueIncomeReason(s)};
}
/** Closing projection only: unfinished case bills remain payable, without charging them early. */
export function getEndingMetrics(s){const m=getMetrics(s),netWorth=checked(m.netWorth-m.pendingLegalBills),debt=checked(m.debt+m.pendingLegalBills);return {...m,netWorth,debt,net_worth_yuan:netWorth/100,debt_yuan:debt/100,reserve_months:m.monthlyExpense?Math.max(0,m.cash-m.pendingLegalBills)/m.monthlyExpense:0};}
export function getDebtCalendar(s){return calendarRows(s,getTurnMonths(s));}
export function getDebtExtension(s,id){return extensionTerms(s,s.debts.find(d=>d.id===id));}
export function getBehaviorStatus(s){const b=behaviorState(s),m=getMetrics(s);return {...b,day:debtClock(s).day,cooldownDays:0,dailyLimit:null,wealthPeak:s.peakNetWorth,wealthDrawdown:Math.max(0,s.peakNetWorth-m.netWorth),marketDrawdown:Math.max(0,b.marketPeak-b.marketPnl),hiddenDebt:Math.max(0,m.debt-b.reportedDebt)};}
function sync(s) {
  s.legal ??= createLegalState();
  const legal = getLegalStatus(s);
  s.flags.in_prison = legal.inPrison;
  s.flags.under_investigation = legal.underInvestigation;
  s.flags.legal_debt = legal.legalDebt > 0;
  if (legal.cases.some(c => c.status === 'convicted')) s.flags.ever_convicted = true;
  if (legal.releaseCount > 0) s.flags.ever_released = true;
  const debt = debtTotal(s);
  s.flags.has_debt = debt > 0;
  if (debt > 0) s.flags.ever_indebted = true;
  s.flags.overdue = s.debts.some(d => d.overdue && d.principal + d.interest > 0);
  s.flags.claim_exists = s.claims.some(c => c.face > 0);
  s.flags.saleable_asset = s.positions.some(p => isSaleable(s, p)) || s.businesses.some(b => b.value > 0);
  s.flags.partner = s.household.partner;
  s.flags.has_child = s.household.hasChild;
  s.flags.living_parent = s.household.livingParent;
  s.flags.employed = hasSalariedJob(s);
  syncEmployment(s);
  s.flags.business_owner = s.businesses.some(b => b.value > 0);
  s.peakNetWorth = Math.max(s.peakNetWorth, getMetrics(s).netWorth);
  if (debt === 0) s.flags.restructuring = false;
  syncSurvival(s,getMetrics(s));
}
function validate(s) {
  ensureLearningStats(s);validateEducation(s);
  validateWorkEconomy(s);validatePayroll(s);validateCollegeSupport(s);validateAttendance(s);validateLivingPlan(s);validateRoutinePlan(s);validateWorkStories(s);validateChapters(s);validateStagePlan(s);
  nonnegative(s.cash, '现金'); nonnegative(s.familyReserve, '家庭储备'); nonnegative(s.adultGift, '成年赠与');
  nonnegative(s.monthlyIncome, '工资'); nonnegative(s.peakNetWorth, '历史峰值');
  if (!Number.isFinite(s.age) || s.age < 0 || s.age > 80 || !Number.isSafeInteger(s.turn) || s.turn < 0) throw new Error('年龄或回合数据无效');
  if (!Number.isSafeInteger(s.actionPoints) || s.actionPoints < 0 || s.actionPoints > 2) throw new Error('精力数据无效');
  for (const key of STATS) if (!Number.isFinite(s.stats[key]) || s.stats[key] < 0 || s.stats[key] > 100) throw new Error('属性数据无效');
  for (const p of s.positions) { nonnegative(p.cost); nonnegative(p.value); if (p.margin !== undefined) nonnegative(p.margin); }
  for (const d of s.debts) { nonnegative(d.principal); nonnegative(d.interest); if (!Number.isFinite(d.aprBps) || d.aprBps < 0 || !Number.isFinite(d.monthsLeft)) throw new Error('债务数据无效'); }
  for (const c of s.claims) { nonnegative(c.face); nonnegative(c.value); }
  for (const b of s.businesses) { nonnegative(b.value); checked(b.monthlyProfit); }
  validateLegalState(s.legal || createLegalState(), s);
  validateSurvival(s);validateDebtClock(s);validateBehavior(s);validateOnlineGambling(s);validateCryptoLife(s);validateSchemeLife(s);validateCryptoLifeFinance(s);validateJourney(s);validateLifeArcs(s);validateChildhood(s);validateRiskLife(s);getMetrics(s);
}
function result(before, after, title, text, extra = {}) {
  const b = getMetrics(before); const a = getMetrics(after);
  return { title, text, changes: [
    { label: '现金', value: checked(a.cash - b.cash) },
    { label: '净资产', value: checked(a.netWorth - b.netWorth) },
    { label: '负债', value: checked(a.debt - b.debt) },
  ].filter(c => c.value !== 0), statChanges: STATS.filter(key=>after.stats[key]!==before.stats[key]).map(key=>({key,value:after.stats[key]-before.stats[key]})), ...extra };
}
function commit(before, s, title, text, extra = {}) {
  // Leaving a cash crisis cannot turn today's remaining actions into half-year jobs.
  // A new life period resets the clock separately in advanceTurn.
  if(getSurvivalStatus(s).active||before.turn===s.turn&&(before.debtClock?.dailyWork||before.debtClock?.dailyMode||getSurvivalStatus(before).active)){
    s.debtClock??=newDebtClock();s.debtClock.dailyWork=true;
  }
  recordChapterProgress(before,s,{automatic:Boolean(extra.chapterRun)});
  const cryptoNotes=[];settleCryptoLifeSchemes(s,0,marketApi,cryptoNotes);if(cryptoNotes.length)text+='\n'+cryptoNotes.join('\n');
  rememberOpenMarkets(s,before);sync(s);advanceOnlineGambling(s,getMetrics(s));advanceCryptoLife(s,getMetrics(s));advanceSchemeLife(s,getMetrics(s));refreshBehavior(s,getMetrics(s));flushRealizedProfit(s);observeLife(before,s,title);validate(s);validateEmployment(s);
  log(s, title, text, extra.kind || 'system');
  return { state: s, result: result(before, s, title, text, extra) };
}
function failed(state, error) { return { state, result: { title: '这一步没有发生', text: error.message || String(error), error: error.message || String(error) } }; }

export function createState({ family, seed = '中国式赌狗', name = '阿财', mode = 'remix', birthYear = 1988 } = {}) {
  if (!family || !family.id) throw new Error('必须提供有效的家庭');
  if (!['remix', 'history'].includes(mode)) throw new Error('模式无效');
  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > 2026) throw new Error('出生年份须为 1900–2026');
  const initial = hashSeed(seed);
  const s = {
    presentations: [], marketProgress: { firstExperienceAge: null, simulations: 0, unlocked: {} }, education:newEducation(),
    economyRevision: ECONOMY_REVISION, version: 1, id: `life-${initial.toString(36)}`, name: String(name || '阿财').slice(0, 24), seed: String(seed), rng: initial,
    familyId: family.id, familyName: family.name, familyReserve: 0, adultGift: 0, giftReceived: false,
    mode, birthYear, age: 0, turn: 0, cash: 0, stats: { ...STAT_DEFAULTS, ...family.stat_overrides },
    flags: { living_parent: true }, positions: [], debts: [], claims: [], businesses: [],
    peopleMet: ['N10'], relationships: {}, household: { partner: false, hasChild: false, livingParent: true },
    occupation: '尚在襁褓', monthlyIncome: 0, actionPoints: 2, logs: [], ledger: [], netWorthHistory: [],
    peakNetWorth: 0, wipeouts: 0, wipeoutRepairVersion:1, debtFreeTurns: 0, serial: 0,
    markets: { stock: 10000, bond: 10000, crypto: 10000, housing: 10000 },
    realizedEquityProceeds: 0, appliedEffectIds: [], investmentHistory: false,
    repairCount: 0, restStreak: 0, riskExitTurn: null, guarantees: [],
    legal: createLegalState(), survival:newSurvival(), payroll:newPayroll(), collegeSupport:newCollegeSupport(), debtClock:newDebtClock(),behavior:newBehavior(),journey:newJourney(),
  };
  s.trading=newTrading(s);
  s.adultGift = sampleRange(s, cappedGiftRange(family.adult_gift_yuan));
  s.familyReserve = sampleRange(s, family.family_reserve_yuan);
  // 学龄前由家长承担开销；家庭储备和成年赠与不计入个人现金。
  s.lifeArcs=newLifeArcs(s);ensureFamily(s);sync(s); validate(s);
  s.netWorthHistory.push({ turn: 0, age: 0, value: getMetrics(s).netWorth });
  log(s, '人生开局', family.opening || `你出生在${family.name}。`, 'story');
  return s;
}

function loanCap(s, kind) {
  const monthly = income(s);
  const debt = debtTotal(s);
  const balance=sum(s.debts.filter(d=>d.kind===kind).map(d=>checked(d.principal+d.interest)));
  if (kind === 'family') return s.stats.trust >= 25 ? Math.min(s.familyReserve, 10_000_000) : 0;
  if (kind === 'friend') return Math.max(0,Math.min(1_000_000,Math.floor(s.stats.trust)*10_000)-balance);
  if (kind === 'card') return Math.max(0,Math.min(1_000_000,Math.floor(s.stats.credit)*10_000)-balance);
  if (kind === 'shark') return Math.max(0,500_000-balance);
  if (kind === 'bank') return Math.max(0, Math.min(50_000_000, checked(mul(monthly, 24) - debt)));
  return Math.max(0, Math.min(5_000_000, checked(mul(monthly, 6) - debt)));
}
function loanAllowed(s, kind, amount = 0) {
  if (getLegalStatus(s).inPrison) return '服刑期间不能申请新的外部借款';
  if (s.age < 18 || s.age >= 80) return '成年后才能申请借款';
  if (!Object.hasOwn(LOAN_TYPES,kind)) return '借款类型无效';
  if (kind === 'family') {
    if(s.behavior?.aidBlocked)return '上次隐瞒后，家人暂时关闭援助；先重新摊开账本';
    if (s.stats.trust < 25) return '亲友暂时不愿出借，先修复关系';
    if (s.familyReserve <= 0) return '亲友没有可出借的储备';
  } else if(kind==='friend') {
    if(s.stats.trust<50)return '人缘达到 50 后，朋友才愿意帮忙';
    if(s.debts.some(d=>['family','friend'].includes(d.kind)&&d.overdue))return '还有逾期人情债，朋友暂时不愿再借';
  } else if(kind==='card') {
    if(s.age<21)return '21 岁后才有可用的信用卡额度';
    if(s.stats.credit<50)return '信用不足 50，可用卡额度已被冻结';
    if(s.debts.some(d=>d.overdue))return '存在逾期，可用卡额度已被冻结';
  } else if(kind==='shark') {
    if(s.debts.some(d=>d.kind==='shark'&&d.overdue))return '高利贷已逾期，对方只催还款，不再出借';
  } else {
    if (s.stats.credit < (kind === 'bank' ? 50 : 35)) return '信用不足，申请会被拒绝';
    if (income(s) <= 0) return '需要可验证的工作或经营收入';
    if (s.debts.some(d => d.overdue)) return '存在逾期，先还款或协商';
    const requestedService = amount ? Math.ceil(amount / (kind === 'bank' ? 24 : 12)) + mul(amount, kind === 'bank' ? 0.08 / 12 : 0.18 / 12) : 0;
    if (checked(sum(s.debts.map(installment)) + requestedService) > mul(income(s), 0.7)) return '预计月还款超过收入的 70%，无法新增授信';
  }
  if (loanCap(s, kind) <= 0 || amount > loanCap(s, kind)) return '申请金额超出可用授信或家庭储备';
  return null;
}
export function getLoanOffer(s,kind,amount) {
  if(!Object.hasOwn(LOAN_TYPES,kind))throw Error('借款类型无效');const meta=LOAN_TYPES[kind];
  const cap=loanCap(s,kind),shortage=Math.max(0,getSurvivalStatus(s).buffer-s.cash);
  const suggested=Math.min(cap,Math.max(10000,Math.ceil(shortage/(1-meta.feeBps/10000)/10000)*10000));
  const quote=loanTerms(kind,amount??(cap<=0?10000:getSurvivalStatus(s).active?Math.max(1,suggested):Math.max(1,Math.min(cap,1_000_000))));
  const availability=getActionAvailability(s,{type:'borrow',kind,amount:quote.principal});
  const reason=s.phase!=='planning'?'先处理眼前的故事，再安排周转。':availability.reason;
  return {...quote,cap,allowed:!reason&&availability.allowed,reason,approval:kind==='family'?.85:kind==='friend'?.55+s.stats.trust/300:kind==='shark'?.95:.65+s.stats.credit/400};
}
export function getLoanOffers(s){return Object.keys(LOAN_TYPES).map(kind=>getLoanOffer(s,kind));}
export function getGamblingLoanReason(s){return loanAllowed(s,'friend',10000)||'';}
export function getEligibility(state, key) {
  switch (key) {
    case 'adult': return state.age >= 18;
    case 'family_reserve_positive': return !state.behavior?.aidBlocked && state.familyReserve > 0 && state.stats.trust >= 25 && !state.flags.family_aid_refused;
    case 'debt_positive': return debtTotal(state) > 0;
    case 'saleable_asset_positive': return state.positions.some(p => isSaleable(state, p)) || state.businesses.some(b => b.value > 0);
    case 'claim_positive': return state.claims.some(c => c.face > 0);
    case 'bank_eligible': return !loanAllowed(state, 'bank', 5_000_000);
    case 'consumer_credit_eligible': return !loanAllowed(state, 'net', 1_500_000);
    default: return Boolean(state.flags[key]);
  }
}
export function getActionAvailability(state, action = {}) {
  try {
    if(state.survival?.failed)return {allowed:false,reason:'这段人生已因生存失败结束'};
    if(state.familyLife?.pending&&['calendar_day','survival_day','wait_days','live_days','chapter_days','routine_days','market_tick','market_day','day_next','day_activity'].includes(action.type))return {allowed:false,reason:'先处理和林夏的这件事，再推进时间'};
    if(FAMILY_ACTIONS.has(action.type)){const reason=familyActionReason(state,action);return {allowed:!reason,reason};}
    if(state.dayRoutine?.pending&&['calendar_day','survival_day','wait_days','live_days','chapter_days','routine_days','market_tick','market_day'].includes(action.type))return {allowed:false,reason:'先选完眼前这件日常小事，再推进时间'};
    if(action.type==='stage_plan'){const reason=stagePlanReason(state,action.focus);return {allowed:!reason,reason};}
    if(action.type==='chapter_days'){const reason=chapterDaysReason(state,action,{survival:getSurvivalStatus,months:getTurnMonths});return {allowed:!reason,reason};}
    if(['secure_food','hospital'].includes(action.type)){const reason=survivalActionReason(state,action,{...getMetrics(state),turnDays:getTurnMonths(state)*30});return {allowed:!reason,reason};}
    if(action.type==='living_plan'){const reason=livingPlanReason(state,action);return {allowed:!reason,reason};}
    if(action.type==='routine_days'){const reason=routinePlanReason(state,action,{survival:getSurvivalStatus,months:getTurnMonths});return {allowed:!reason,reason};}
    if(CHILD_ACTIONS.has(action.type)){const reason=childAvailability(state,action);return {allowed:!reason,reason};}
    if(LIFE_ACTIONS.has(action.type)){const reason=lifeAvailability(state,action);return {allowed:!reason,reason};}
    if(DAY_ACTIONS.has(action.type)){const reason=routineAvailability(state,action,getTurnMonths(state));return {allowed:!reason,reason};}
    if(action.type==='live_days'){
      const ok=state.phase==='planning'&&state.age>=18&&state.age<80&&!getLegalStatus(state).inPrison&&Number.isSafeInteger(action.days)&&action.days>0&&action.days<=30&&(state.debtClock?.periodDays||0)<getTurnMonths(state)*30&&!getSurvivalStatus(state).active&&!getSurvivalStatus(state).needsCare&&!state.lifeArcs?.pending&&!state.behavior?.pending&&!state.dayRoutine?.pending;
      return {allowed:ok,reason:ok?'':'先处理眼前的故事、消息或求生安排，再过日子'};
    }
    if(action.type==='wait_days'){const ok=state.phase==='planning'&&state.age>=18&&state.age<80&&!getLegalStatus(state).inPrison&&state.trading.phase===3&&Number.isSafeInteger(action.days)&&action.days>0&&action.days<=360&&(state.debtClock?.periodDays||0)<getTurnMonths(state)*30&&!state.positions.some(p=>p.kind==='crypto_perp'||p.expiryDay!==undefined);return {allowed:ok,reason:ok?'':'先处理今日行情与到期合约，再推进生活日'};}
    if(BEHAVIOR_ACTIONS.has(action.type)){const reason=behaviorAvailability(state,action,getMetrics(state));return {allowed:!reason,reason};}
    if(['survival_day','calendar_day'].includes(action.type)){const ok=state.phase==='planning'&&state.age>=18&&!getLegalStatus(state).inPrison&&(action.type==='calendar_day'||getSurvivalStatus(state).active)&&state.age<80&&(state.survival?.days||0)<getTurnMonths(state)*30;return {allowed:ok,reason:ok?'':(state.survival?.days||0)>=getTurnMonths(state)*30?'本期天数已过完，请推进下一期人生':action.type==='calendar_day'?'先处理当前故事，回到可以安排生活的成年阶段':'当前不在应急求生阶段'};}
    if(MARKET_ACTIONS.has(action.type)){const reason=marketAvailability(state,action,marketApi);return {allowed:!reason,reason};}
    if (state.age >= 80 || state.phase === 'ended') return { allowed: false, reason: '本次人生已结算' };
    if (state.actionPoints <= 0) return { allowed: false, reason: '精力已用完，结算后恢复' };
    const types = ['work', 'gig', 'study', 'rest', 'social', 'seek_job', 'job_accept', 'business_start', 'business_run', 'borrow', 'repay', 'debt_extend', 'invest', 'sell', 'claim', 'relationship', 'exit_risk', 'prison_study', 'prison_reflect', 'prison_letter', 'legal_cooperate', 'quit_gambling', 'market_practice', 'market_review'];
    if (!types.includes(action.type)&&!CHILD_REBEL_ACTIONS.includes(action.type)) return { allowed: false, reason: '未知行动' };
    if(CHILD_REBEL_ACTIONS.includes(action.type)){
      const child=childhoodActivity(state,action.type);
      if(!child)return {allowed:false,reason:'这项活动不属于当前学段'};
      if(child.cost>state.cash)return {allowed:false,reason:`零花钱不足，需要 ¥${child.cost/100}`};
    }
    const legal = getLegalStatus(state);
    if (legal.inPrison && !['prison_study', 'prison_reflect', 'prison_letter', 'legal_cooperate'].includes(action.type)) return { allowed: false, reason: '服刑期间不能进行外部工作、投资、借贷、经营或关系行动，请选择狱中安排' };
    if (action.type.startsWith('prison_') && !legal.inPrison) return { allowed: false, reason: '这项行动仅在服刑期间开放' };
    if (action.type === 'legal_cooperate' && !legal.cases.some(c => ['exposed', 'investigating'].includes(c.status) && !c.cooperated)) return { allowed: false, reason: '当前没有尚待配合的调查' };
    if (action.type === 'quit_gambling' && (!state.flags.gambling_history || state.flags.gambling_quit)) return { allowed: false, reason: state.flags.gambling_quit ? '已经记录停止参与的决定' : '当前没有网络赌博参与记录' };
    if (state.age < 18 && !childhoodActivity(state,action.type)) return { allowed: false, reason: '这项安排还没到合适的年龄' };
    if(action.type==='seek_job'&&jobSearchWait(state))return {allowed:false,reason:jobSearchWait(state)};
    if(action.type==='seek_job'&&isCollegeStudent(state))return {allowed:false,reason:COLLEGE_JOB_REASON};
    if(['seek_job','job_accept'].includes(action.type)&&dismissedToday(state))return {allowed:false,reason:'今天刚离开原岗位，先整理求职和生活安排'};
    if(action.type==='job_accept'){const reason=jobOfferReason(state,action.offerId);return {allowed:!reason,reason};}
    if(['work','gig'].includes(action.type)){const reason=fullDayWorkReason(state);if(reason)return {allowed:false,reason};}
    if (action.type === 'invest') {
      const cryptoReason=cryptoLifeActionReason(state,action);if(cryptoReason)return {allowed:false,reason:cryptoReason};
      const product = PRODUCTS[action.product];
      if (!product) return { allowed: false, reason: '未知投资类型' };
      if ((state.flags.voluntary_exit || state.flags.exit_intent) && ['option', 'option_short', 'futures', 'crypto_perp', 'ponzi', 'angel'].includes(action.product)) return { allowed: false, reason: '你已封盘，不再新增高风险仓位' };
      const access = getMarketAccess(state, action.product);
      if (!access.unlocked) return { allowed: false, reason: access.reason };
      nonnegative(action.amount);
      const minimum=action.product==='stock'&&action.shares?1:product.min;
      if(action.product==='stock'&&action.shares!==undefined){const lot=stockLot(action.underlying);if(!stockInstrument(action.underlying)||!Number.isSafeInteger(action.shares)||action.shares<lot||action.shares%lot!==0||action.amount!==action.shares*(state.markets[action.underlying]||1000))return {allowed:false,reason:'股票手数或报价不匹配'};}
      if (action.amount < minimum) return { allowed: false, reason: `最低投入 ${product.min / 100} 元` };
      if (orderCost(action).total > state.cash) return { allowed: false, reason: '现金不足，锁定资产不能当现金使用' };
      if (action.direction && !['long', 'short'].includes(action.direction)) return { allowed: false, reason: '方向无效' };
      if (action.underlying !== undefined && (typeof action.underlying !== 'string' || !action.underlying.trim() || action.underlying.length > 64)) return { allowed: false, reason: '标的名称无效' };
      if (action.product === 'futures' && ![2, 5, 10].includes(action.leverage ?? 2)) return { allowed: false, reason: '杠杆只能选择 2、5、10 倍' };
      if(action.product==='crypto'&&isRugged(state,action.underlying))return {allowed:false,reason:'这个项目已经归零，停止交易'};
      if (action.product === 'crypto_perp' && !CRYPTO_LEVERAGES.includes(action.leverage??10)) return {allowed:false,reason:'请选择 10 至 1000 倍之间的可用杠杆'};
      if(action.product==='housing'&&action.propertyPrice!==undefined){const quote=housingQuote(action.propertyPrice,Boolean(action.financed));if(!quote||quote.payment!==action.amount)return {allowed:false,reason:'房屋总价与付款金额不一致，请重新确认购房方案'};}
      if (action.financed && action.product === 'housing' && (income(state) <= 0 || state.stats.credit < 50 || state.debts.some(d => d.overdue))) return { allowed: false, reason: '按揭需要收入、信用和正常履约记录' };
    }
    if (action.type === 'borrow') {
      nonnegative(action.amount);
      if (action.amount <= 0) return { allowed: false, reason: '借款金额必须大于零' };
      const reason = loanAllowed(state, action.kind, action.amount);
      if (reason) return { allowed: false, reason };
    }
    if(action.type==='debt_extend'){const q=getDebtExtension(state,action.id);if(q.reason)return {allowed:false,reason:q.reason};}
    if (action.type === 'repay') {
      if(action.id&&!state.debts.some(d=>d.id===action.id))return {allowed:false,reason:'这笔债务已经不存在'};
      nonnegative(action.amount);
      if (action.amount <= 0 || debtTotal(state) <= 0) return { allowed: false, reason: '没有可偿还的债务或金额为零' };
      if (Math.min(action.amount, debtTotal(state)) > state.cash) return { allowed: false, reason: '可用现金不足' };
    }
    if (action.type === 'sell') {
      const p = state.positions.find(p => p.id === action.id);
      const b = state.businesses.find(b => b.id === action.id);
      if (!p && !b) return { allowed: false, reason: '资产不存在' };
      if(p?.kind==='stock'&&p.managed&&stockMarket(p).id==='a'&&state.dayRoutine&&![1,3].includes(state.dayRoutine.stage))return {allowed:false,reason:aShareSession(state).reason};
      if (p && stockSellReason(state,p)) return {allowed:false,reason:stockSellReason(state,p)};
      if(p?.honeypot)return {allowed:false,reason:'貔貅币限制卖出，账面涨幅无法兑现，可留证追偿'};
      if (p?.frozen) return { allowed: false, reason: '资产被冻结，暂时不能提现' };
      if (p && (p.lockUntilTurn || 0) > state.turn) return { allowed: false, reason: `还需 ${p.lockUntilTurn - state.turn} 回合解锁` };
      if (p && (p.suspendedUntilTurn || 0) > state.turn) return { allowed: false, reason: '市场停牌或赎回限制，下一回合再看' };
    }
    if (action.type === 'claim' && !state.claims.some(c => c.id === action.id && c.face > 0)) return { allowed: false, reason: '没有这笔可追偿债权' };
    if (action.type === 'business_start') {
      const amount = action.amount ?? 500_000; nonnegative(amount);
      if (amount < 300_000) return { allowed: false, reason: '小生意至少需要 3000 元启动资金' };
      if (amount > state.cash) return { allowed: false, reason: '启动现金不足，可以先做零工' };
      if (state.businesses.length >= 12) return { allowed: false, reason: '现有业务已达到管理上限' };
    }
    if (action.type === 'business_run' && !state.businesses.some(b => b.value > 0)) return { allowed: false, reason: '需要先开一家仍在经营的店' };
    if (action.type === 'relationship') {
      if(action.kind==='partner')return {allowed:false,reason:'到林夏的关系安排中表达心意，共同确认恋爱关系'};
      if(action.kind==='child')return {allowed:false,reason:'先完成结婚与生育计划，再按孕期迎接孩子'};
      if (!['partner', 'child', 'repair', 'succession'].includes(action.kind)) return { allowed: false, reason: '关系行动无效' };
      if (action.kind === 'partner' && (state.age < 20 || state.household.partner)) return { allowed: false, reason: state.household.partner ? '已有伴侣' : '20 岁后开放伴侣关系' };
      if (action.kind === 'partner' && (!hasMetPerson(state,'N02') || personRelation(state,'N02')<60)) return {allowed:false,reason:hasMetPerson(state,'N02')?'与林夏的信任达到 60 后可结伴':'还没有认识林夏'};
      if (action.kind === 'repair' && !state.household.partner) return {allowed:false,reason:'有伴侣后可修复关系'};
      if (action.kind === 'child' && (!state.household.partner || state.household.hasChild || state.age < 22)) return { allowed: false, reason: '需要已有伴侣、年满 22 岁，且尚未有子女' };
      if (action.kind === 'succession' && state.household.hasChild && (childAge(state)===null||childAge(state)<18)) return {allowed:false,reason:'等孩子成年后，再商量往后的安排'};
      if (action.kind === 'succession' && (!state.household.hasChild || state.age < 55)) return { allowed: false, reason: '55 岁后有子女才能安排传承' };
    }
    if (action.type === 'exit_risk' && state.age < 55) return { allowed: false, reason: '55 岁后可选择正式封盘' };
    return { allowed: true, reason: '' };
  } catch (error) { return { allowed: false, reason: error.message }; }
}

function createDebt(s, { name, principal, aprBps = 0, monthsLeft = 12, purpose = 'unpaid', kind = 'obligation', overdue = false, collateralId }) {
  nonnegative(principal); if (!principal) return null;
  if (!Number.isFinite(aprBps) || aprBps < 0 || !Number.isSafeInteger(monthsLeft) || monthsLeft < 0) throw new Error('债务条款无效');
  const d = { id: uid(s, 'debt'), name, principal, interest: 0, aprBps, monthsLeft, purpose, kind, overdue, originalPrincipal: principal, paid: 0, collateralId: collateralId ?? null, createdTurn: s.turn };
  if(Object.hasOwn(LOAN_TYPES,kind))attachSchedule(s,d);
  s.debts.push(d); record(s, 'debt', principal, name, { debtId: d.id }); s.flags.ever_indebted = true;
  return d;
}
function issueLoan(s, kind, amount, { aprBps, monthsLeft, purpose } = {}) {
  const denied = loanAllowed(s, kind, amount); if (denied) throw new Error(denied);
  const terms=loanTerms(kind,amount);
  const d = createDebt(s, { name: terms.name, principal: amount, aprBps: aprBps ?? terms.aprBps, monthsLeft: monthsLeft ?? terms.months, purpose: purpose || (kind === 'net' ? 'consumption' : 'approved_use'), kind });
  cashChange(s, amount, `${terms.name}放款`);
  if(terms.fee)cashChange(s,-terms.fee,`${terms.name}前置费用`);
  if (kind === 'family') { s.familyReserve = checked(s.familyReserve - amount); stat(s, { trust: -2 }); }
  if(kind==='friend')stat(s,{trust:-4});
  if(kind==='card')stat(s,{credit:-8});
  if(kind==='shark')stat(s,{stress:12,health:-2});
  return d;
}
function payDebt(s, amount, debtId) {
  nonnegative(amount);
  const debts = debtId ? s.debts.filter(d => d.id === debtId) : [...s.debts].sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.aprBps - a.aprBps);
  let remaining = Math.min(amount, s.cash, sum(debts.map(d => checked(d.principal + d.interest))));
  const payment = remaining;
  for (const d of debts) {
    const interestPaid = Math.min(remaining, d.interest); d.interest -= interestPaid; remaining -= interestPaid;
    const principalPaid = Math.min(remaining, d.principal); d.principal -= principalPaid; remaining -= principalPaid;
    if(d.calendar){d.calendar.principalDue=Math.max(0,d.calendar.principalDue-principalPaid);if(d.calendar.principalDue+d.interest===0)d.overdue=false;}
    const total = checked(principalPaid + interestPaid); d.paid = checked((d.paid || 0) + total);
    if (d.kind === 'family') s.familyReserve = checked(s.familyReserve + principalPaid);
    if (d.principal + d.interest === 0) d.overdue = false;
    if(total){lifeArcs(s).audit.interestPaid+=interestPaid;lifeArcs(s).audit.repaid+=total;}
    if (total) record(s, 'debt', -total, `偿还${d.name}`, { debtId: d.id });
    if (remaining <= 0) break;
  }
  if (payment) cashChange(s, -payment, '偿还本息');
  const repaidIds = new Set(s.debts.filter(d => d.principal + d.interest === 0).map(d => d.id));
  for (const p of s.positions) if (repaidIds.has(p.mortgageId)) delete p.mortgageId;
  s.debts = s.debts.filter(d => d.principal + d.interest > 0);
  return payment;
}
function charge(s, amount, label, { aprBps = 0, overdue = false } = {}) {
  nonnegative(amount);
  const paid = Math.min(s.cash, amount); if (paid) cashChange(s, -paid, label);
  const shortage = checked(amount - paid);
  if (shortage > 0) {
    const existing = s.debts.find(d => d.kind === 'arrears' && d.name === label);
    if (existing) { existing.principal = checked(existing.principal + shortage); record(s, 'debt', shortage, label, {debtId:existing.id}); }
    else createDebt(s, { name: label, principal: shortage, aprBps, monthsLeft: 12, purpose: 'living_or_contract_obligation', kind: 'arrears', overdue });
    stat(s, { stress: 5 });
    s.flags.cashflow_crisis = true;
  }
  return shortage;
}
function openLegalCase(s, e, context) {
  if (s.age < 18 || getLegalStatus(s).inPrison) throw new Error('该成人风险剧情当前不能参与');
  const rules = LEGAL_TYPES[e.case_type];
  if (!rules || !Number.isSafeInteger(e.profit_yuan) || e.profit_yuan < 0) throw new Error('案件类型或收益金额无效');
  s.legal ??= createLegalState();
  if (s.legal.cases.length >= 1000) throw new Error('案件记录已达上限');
  const profit = yuan(e.profit_yuan);
  const c = {
    id: uid(s, 'case'), type: e.case_type, status: 'pending', profit,
    openedTurn: s.turn, exposedTurn: s.turn + 2, investigatingTurn: s.turn + 3, resolutionTurn: s.turn + 4,
    fine: yuan(rules.fineYuan), restitution: yuan(rules.restitutionYuan), confiscation: profit,
    sentenceMonths: rules.sentenceMonths, criminal: rules.criminal, cooperated: false, settled: false,
    resolvedTurn: null, sourceEventId: context.eventId || null,
  };
  s.legal.cases.push(c);
  if (profit) cashChange(s, profit, `${rules.name}本次所得（责任尚未结算）`);
  if (['gambling', 'gambling_promotion'].includes(c.type)) { s.flags.gambling_history = true; s.flags.gambling_quit = false; }
  s.flags.illicit_history = true;
  return c;
}
function cooperate(s) {
  const cases = getLegalStatus(s).cases.filter(c => ['exposed', 'investigating'].includes(c.status) && !c.cooperated);
  if (!cases.length) throw new Error('当前没有尚待配合的调查');
  for (const c of cases) c.cooperated = true;
  s.flags.legal_cooperated = true; stat(s, { stress: -3, trust: 1 });
  return '你把经过说清楚，签下了笔录。案件和账单继续处理。';
}
function quitGambling(s) {
  if (getLegalStatus(s).inPrison) throw new Error('服刑期间请先处理狱中安排');
  if (!s.flags.gambling_history) {recordOnlineRefusal(s,{source:'gamble_leave',choice:'拒绝邀请'},getMetrics(s));return '你拒绝了邀请，关掉消息。';}
  if (s.flags.gambling_quit) return '你保持此前停止参与的决定，拒绝再次进场。已有损失与责任照常处理。';
  recordOnlineQuit(s,{source:'gamble_leave',choice:'离开赌桌'},getMetrics(s));
  s.flags.gambling_quit = true; stat(s, { stress: -5, insight: 4 });afterLifeAction(s,{type:'quit_gambling'},marketApi);
  return '你切断新的参与，把账目交回现实生活。已有损失和未结案件仍需处理。';
}
function assessLegalPayment(s, c, component) {
  const amount = c[component];
  if (!amount) return;
  const labels = { confiscation: '违法所得追缴', fine: '案件罚款', restitution: '案件退赔' };
  const label = `${LEGAL_TYPES[c.type].name}：${labels[component]}`;
  const paid = Math.min(s.cash, amount);
  if (paid) cashChange(s, -paid, label);
  const shortfall = checked(amount - paid);
  if (shortfall) {
    const debt = createDebt(s, { name: label, principal: shortfall, aprBps: 0, monthsLeft: 36, purpose: `legal_${component}`, kind: 'legal' });
    debt.legalCaseId = c.id; debt.legalComponent = component;
  }
}
function advanceLegal(s, months, wasInPrison, notes) {
  s.legal ??= createLegalState();
  if (wasInPrison) {
    const served = Math.min(months, s.legal.prisonMonthsLeft);
    s.legal.prisonMonthsLeft -= served; s.legal.servedPrisonMonths = checked(s.legal.servedPrisonMonths + served);
    notes.push(`服刑经过 ${served} 个月；未偿债务仍保留，狱外工作与亲自经营暂停。`);
  }
  for (const c of s.legal.cases) {
    if (c.settled) continue;
    if (c.status === 'pending' && s.turn >= c.exposedTurn) {
      c.status = 'exposed';
      log(s, '案卷被翻开', `有关${LEGAL_TYPES[c.type].name}的记录出现了。这还不是裁定，暂不追缴或罚款。`, 'story', { caseId: c.id });
      notes.push('一段灰色经历进入案卷，责任尚待查明。');
    }
    if (c.status === 'exposed' && s.turn >= c.investigatingTurn) {
      c.status = 'investigating';
      log(s, '调查开始', '你收到配合调查的通知。违法所得、损失与责任正在分别核实，未定案不提前扣款。', 'story', { caseId: c.id });
    }
    if (c.status === 'investigating' && s.turn >= c.resolutionTurn) {
      c.settled = true; c.resolvedTurn = s.turn; c.status = c.criminal ? 'convicted' : 'admin_closed';
      for (const component of ['confiscation', 'fine', 'restitution']) assessLegalPayment(s, c, component);
      const liability = sum([c.confiscation, c.fine, c.restitution]);
      const sentence = c.criminal ? `，新增 ${c.sentenceMonths} 个月虚构刑期` : '，本案没有刑事服刑';
      log(s, '虚构案件裁定', `${LEGAL_TYPES[c.type].name}：追缴、罚款与退赔共 ${liability / 100} 元${sentence}。未付部分单独留在债务表。此为游戏剧情规则。`, 'loss', { caseId: c.id });
      notes.push(`案件定案，应付 ${liability / 100} 元${sentence}。`);
      stat(s, { stress: c.criminal ? 20 : 8, trust: c.criminal ? -18 : -6, credit: c.criminal ? -20 : -5 });
      if (c.criminal) {
        s.legal.prisonMonthsLeft = checked(s.legal.prisonMonthsLeft + c.sentenceMonths);
        s.legal.totalPrisonMonths = checked(s.legal.totalPrisonMonths + c.sentenceMonths);
        s.monthlyIncome = 0; s.occupation = '服刑中'; s.flags.ever_convicted = true; s.flags.reentry_employed = false;
      }
    }
  }
  if (wasInPrison && s.legal.prisonMonthsLeft === 0) {
    s.legal.releaseCount++; s.flags.ever_released = true; s.monthlyIncome = 0; s.occupation = '出狱后待业';
    log(s, '刑期结束，重新出发', '你走出大门，已有债务与案件记录仍在。正规求职、学习和修复关系重新开放。', 'story');
    notes.push('刑期届满后恢复自由，需要重新求职，原工资不会自动恢复。');
  }
}
function addClaim(s, face, mark, name) {
  nonnegative(face); nonnegative(mark);
  if (face <= 0) throw new Error('追偿本金必须大于零');
  const c = { id: uid(s, 'claim'), name, face, value: Math.min(face, mark), recovered: 0, createdTurn: s.turn };
  s.claims.push(c); record(s, 'claim', c.value, name); return c;
}
function recoverClaim(s, c, bps = 3000) {
  if (!c || c.face <= 0) throw new Error('不存在可追偿债权');
  if (!Number.isFinite(bps) || bps < 0 || bps > 10000) throw new Error('追偿比例无效');
  const oldFace = c.face; const oldValue = c.value;
  const recovered = Math.min(oldFace, mul(oldFace, bps / 10000));
  if (recovered > 0) {
    c.face -= recovered; c.value = oldFace ? mul(oldValue, c.face / oldFace) : 0;
    c.recovered = checked((c.recovered || 0) + recovered);
    cashChange(s, recovered, `${c.name}追偿回款`);
    record(s, 'claim', c.value - oldValue, '追偿后剩余债权估值');
    if(c.cryptoLifeBranch==='scheme')recordCryptoLifeTrade(s,{id:c.id,kind:'ponzi',cryptoLifeBranch:'scheme',cost:0,value:0},{action:'recovery',cashFlow:recovered,pnl:recovered,source:'claim_recovery'});
    if(c.cryptoLifeBranch==='scheme')recordSchemeTrade(s,{id:c.id,kind:'ponzi',schemeLife:c.schemeLife,projectKey:c.projectKey,cryptoScheme:{projectKey:c.projectKey},cost:0,value:0},{action:'recovery',cashFlow:recovered,pnl:recovered,source:'claim_recovery'});
  }
  s.claims = s.claims.filter(x => x.face > 0); return recovered;
}
function registerInvestment(s, product) {
  if (PRODUCTS[product]) recordMarketExperience(s, product);
  s.investmentHistory = true;
  s.flags[`${product}_investor`] = true;
  if (product === 'stock') s.flags.stock_watchlist = true;
  if (product === 'angel') s.flags.angel_investor = true;
  if (s.wipeouts > 0) s.flags.rebuilding = true;
}
function invest(s, action) {
  if(['crypto','crypto_perp'].includes(action.product))ensureCryptoLife(s);
  const kind = action.product; const amount = action.amount; const product = PRODUCTS[kind];
  const underlying = action.underlying || (kind==='crypto_perp'?'crypto':['option', 'option_short', 'futures', 'fund'].includes(kind) ? 'stock' : kind);
  const entryPrice = kind==='futures'?futurePrice(s,underlying):s.markets[underlying]||10000;
  const p = { id: uid(s, 'asset'), name: product.name, kind, cost: amount, value: amount, lockUntilTurn: s.turn, underlying, entryPrice, lastPrice: entryPrice, units: 0, openedTurn: s.turn, openedLifeDay:debtClock(s).day };
  if(kind==='stock'){p.openedDay=tradingState(s).day;p.availableDay=p.openedDay+stockMarket(underlying).sellDelay;if(action.shares!==undefined)p.shares=action.shares;}
  cashChange(s, -orderCost(action).total, `投入${p.name}`);
  if (kind === 'fund') p.lockUntilTurn = s.turn + 1;
  if (kind === 'option' || kind === 'option_short') {
    p.direction = action.direction || 'long'; p.strike = entryPrice; p.expiryTurn = s.turn + 1;
    p.margin = kind === 'option_short' ? amount : 0;
    p.units = mul(amount, kind === 'option_short' ? 3 : 10); // 标的涨幅每 1.0 对应的结算名义金额
    if (kind === 'option_short') {
      p.premium = mul(amount, 0.12); p.premiumPaid = false;
      // 权利金在到期净额中结算，避免开仓重复提现与无成本循环。
    }
  } else if (kind === 'futures' || kind === 'crypto_perp') {
    p.margin = amount; p.leverage = action.leverage ?? (kind==='crypto_perp'?10:2); p.direction = action.direction || 'long'; p.liquidation = kind==='crypto_perp'?mul(amount*p.leverage,cryptoMaintenanceRate(p.leverage)):mul(amount, 0.1);
    p.units = mul(amount, p.leverage); p.feesPaid = 0;
    if(kind==='crypto_perp'){s.trading??=newTrading(s);p.sameDay=true;p.openedDay=s.trading.day;}
  } else if (kind === 'angel') { p.lockUntilTurn = s.turn + 6; p.ownershipBps = 1000; }
  else if (kind === 'housing') {
    p.lockUntilTurn = s.turn + 2;
    if (action.financed) {
      const price = action.propertyPrice??mul(amount, 1 / 0.3); const principal = checked(price - amount);
      const debt = createDebt(s, { name: '房屋按揭', principal, aprBps: 450, monthsLeft: 240, purpose: 'housing', kind: 'mortgage', collateralId: p.id });
      p.cost = price; p.value = price; p.mortgageId = debt.id;
    }
  } else if (kind === 'ponzi') { p.bookBalance = amount; p.withdrawals = 0; }
  if (['stock', 'fund', 'bond', 'crypto', 'housing'].includes(kind)) p.units = Number(BigInt(p.value) * BigInt(SCALE) / BigInt(entryPrice));
  checked(p.units, '份额');
  s.positions.push(p); record(s, 'position', p.value, `取得${p.name}`, { positionId: p.id });
  registerInvestment(s, kind); return p;
}
function closePosition(s, p, proceeds, label) {
  nonnegative(proceeds);
  if (['crypto','crypto_perp'].includes(p.kind)||p.cryptoLifeBranch) advanceCryptoLife(s,getMetrics(s));advanceSchemeLife(s,getMetrics(s));
  s.positions = s.positions.filter(x => x.id !== p.id);
  record(s, 'position', -p.value, label, { positionId: p.id });
  if (proceeds) cashChange(s, proceeds, label);
  noteRealizedProfit(s,proceeds-p.cost);
  recordCryptoTrade(s,p,{action:label.includes('强平')?'liquidation':label.includes('每日结清')?'settlement':p.kind==='crypto_perp'?'close':'sell',cashFlow:proceeds,pnl:proceeds-p.cost,text:`${label}，到账 ¥${proceeds/100}。`});
  if (p.kind === 'angel' && proceeds > 0) { s.flags.equity_exit = true; s.realizedEquityProceeds = checked(s.realizedEquityProceeds + proceeds); }
  if (p.kind === 'option' && proceeds >= mul(p.cost, 10)) s.flags.option_big_win = true;
  if (p.mortgageId) { const d = s.debts.find(x => x.id === p.mortgageId); if (d) { payDebt(s, Math.min(proceeds, d.principal + d.interest), d.id); if (s.debts.includes(d)) { d.kind = 'arrears'; d.collateralId = null; d.name = '售房后剩余按揭'; } } }
}
function freezePosition(s, p, label) {
  const claim = addClaim(s, p.cost, mul(p.cost, 0.1), label);
  s.positions = s.positions.filter(x => x.id !== p.id);
  record(s, 'position', -p.value, '平台冻结转追偿债权', { positionId: p.id });
  if (p.kind === 'ponzi') s.flags.ponzi_loss = true;
  return claim;
}
function sell(s, id) {
  const p = s.positions.find(p => p.id === id);
  if (!p) {
    const b = s.businesses.find(b => b.id === id); if (!b) throw new Error('资产不存在');
    const value = mul(b.value, 0.8); s.businesses = s.businesses.filter(x => x.id !== id);
    cashChange(s, value, `转让${b.name}`); record(s, 'business', -b.value, '业务转让'); return `店铺转让到账 ${value / 100} 元，原有债务仍需履行。`;
  }
  if(p.cryptoLifeBranch==='scheme')return executeCryptoLifeEffect(s,{action:'scheme_withdraw',positionId:id},marketApi);
  if (p.kind === 'ponzi' && draw(s) < 0.35) { freezePosition(s, p, '资金盘提现失败债权'); return '提现按钮变灰了。账面收益没有到账，本金转入追偿记录。'; }
  const rate = p.kind === 'housing' ? 0.05 : p.kind === 'fund' ? 0.01 : p.kind === 'angel' ? 0.08 : 0.002;
  const proceeds = Math.max(0, checked(p.value - mul(p.value, rate)));
  const beforeCash=s.cash,loan=s.debts.find(d=>d.id===p.mortgageId),mortgagePaid=loan?Math.min(proceeds,loan.principal+loan.interest):0;
  closePosition(s, p, proceeds, `${p.name}${tradeTerms(p.kind).close}结算`);
  if(p.kind==='housing'&&mortgagePaid)return `${p.name}出售，扣除 5% 费用后房款 ${proceeds/100} 元，其中偿还按揭 ${mortgagePaid/100} 元，净到账 ${(s.cash-beforeCash)/100} 元。${loan&&s.debts.includes(loan)?'售房后仍有欠款，继续按账单偿还。':''}`;
  return `${p.name}${tradeTerms(p.kind).close}，实际到账 ${proceeds / 100} 元，已扣除 ${Math.round(rate * 1000) / 10}% ${tradeTerms(p.kind).fee}。`;
}
// Only investment operations can cause this milestone; budgets, bills and debt are not losses.
function investmentCapital(s){return sum([s.cash,...s.positions.map(p=>p.value),...s.claims.map(c=>c.value),...s.businesses.map(b=>b.value)]);}
function wipeoutCheck(s,beforeCapital){
  if(beforeCapital>0&&investmentCapital(s)===0&&s.investmentHistory&&s.lastWipeoutTurn!==s.turn){
    s.lastWipeoutTurn=s.turn;s.wipeouts++;s.flags.ever_wipeout=true;s.flags.rebuilding=true;
    stat(s,{stress:15});log(s,'投资资金亏光了','本次投资损失后，现金与资产价值已耗尽；借款仍需偿还。','loss');
    // Evidence distinguishes new confirmed losses from old budget-only false positives.
    s.wipeoutEvidence={version:1,turn:s.turn,count:s.wipeouts,capitalBefore:beforeCapital,capitalAfter:0};
  }
}
function investmentTransition(s,run){const before=investmentCapital(s),value=run();wipeoutCheck(s,before);return value;}
function executeMarket(s,a,api){return ['gamble','gamble_observe'].includes(a.type)?executeMarketRaw(s,a,api):investmentTransition(s,()=>executeMarketRaw(s,a,api));}
function tickMarket(s,api,...args){return investmentTransition(s,()=>tickMarketRaw(s,api,...args));}
function finishTradingPeriod(s,api,notes){return investmentTransition(s,()=>finishTradingPeriodRaw(s,api,notes));}

function completeFullDayWork(s){
 const r=ensureRoutine(s);r.choices[1]='day_gig';r.choices[3]='day_gig';s.behavior.fatigue=clamp(s.behavior.fatigue+20);
 const beforeNet=getMetrics(s).netWorth;
 while(s.trading.phase<2)executeMarket(s,{type:'market_tick'},marketApi);
 tickMarket(s,marketApi,true,true);trackRisk(s,{type:'market_tick'},getMetrics(s).netWorth-beforeNet,marketApi);
 r.stage=5;arriveRoutineSlot(s,marketApi);
}

export function applyAction(state, action) {
  const availability = getActionAvailability(state, action);
  if (!availability.allowed) return failed(state, new Error(availability.reason));
  try {
    if(FAMILY_ACTIONS.has(action.type)){const s=clone(state),r=executeFamilyAction(s,action,marketApi);return commit(state,s,r.title,r.text,{kind:'story'});}
    if(action.type==='stage_plan'){const s=clone(state);return commit(state,s,'阶段生活安排',selectStagePlan(s,action.focus));}
    if(action.type==='secure_food'){const s=clone(state);return commit(state,s,'今天先吃饱',secureFood(s,marketApi));}
    if(action.type==='living_plan'){const s=clone(state);return commit(state,s,'日常开支调整',changeLivingPlan(s,action,marketApi));}
    if(action.type==='routine_days'){
      const run=runRoutinePlan(state,action,{...marketApi,available:getActionAvailability},applyAction);
      const out=commit(state,run.state,run.days?`按作息过了 ${run.days} 天`:'作息暂时停下',run.reason,{days:run.days,routineRun:{days:run.days,steps:run.steps,handled:run.handled,reason:run.reason}});
      if(run.handled.length)out.state.logs.at(-1).text+='\n'+run.handled.map(h=>`第 ${h.day} 天 · ${h.title}：${h.choice}`).join('\n');
      return out;
    }
    if(CHILD_ACTIONS.has(action.type)){const s=clone(state);return commit(state,s,'集市上的一笔小生意',executeChild(s,action,marketApi));}
    if(LIFE_ACTIONS.has(action.type)){const title=action.type==='life_choice'&&action.scene==='family'?familyScene(state)?.title:null;const s=clone(state);let text=executeLife(s,action,marketApi);if(action.type==='life_choice'){recordOnlineOrdinaryEvent(s,{eventId:'life:'+action.scene+':'+(action.event||action.choice)});recordSchemeInterlude(s);}if(action.type==='life_offer'&&action.id==='shift'){completeFullDayWork(s);stat(s,{health:-2,stress:3});text+=' 已到 18:30，今天不能再接整天的活。';}return commit(state,s,title||'生活里的一次决定',text,{kind:'story'});}
    if(DAY_ACTIONS.has(action.type)){
      const s=clone(state),r=ensureRoutine(s),t=s.trading,fromStage=r.stage,fromDay=t.day,oldWage=hasSalariedJob(s)?s.monthlyIncome:0;ensureGameCalendar(s);s.debtClock.dailyWork=true;
      let text='';
      if(action.type==='day_event_choice'){const eventId=r.pending,overtime=eventId==='overtime'&&action.choice==='accept';text=chooseDayEvent(s,action,marketApi);recordOnlineOrdinaryEvent(s,{eventId:'daily:'+eventId});recordSchemeInterlude(s);if(overtime){const before=getMetrics(s).netWorth;tickMarket(s,marketApi,true,true);trackRisk(s,{type:'market_tick'},getMetrics(s).netWorth-before,marketApi);}}
      else if(action.type==='day_activity'){text=chooseActivity(s,action,marketApi);if(['stay','night_gig'].includes(action.choice)){const before=getMetrics(s).netWorth;tickMarket(s,marketApi,true,true);trackRisk(s,{type:'market_tick'},getMetrics(s).netWorth-before,marketApi);}}
      const completesActivity=action.type==='day_activity'&&!marketActivity(action.choice)&&action.choice!=='night_gig';
      if(action.type==='day_next'||completesActivity){
        if([1,3].includes(r.stage))completeRoutineWork(s,r.stage);
        if(r.stage>=6){
          const beforeNet=getMetrics(s).netWorth;
          while(t.phase<3)executeMarket(s,{type:'market_tick'},marketApi);
          trackRisk(s,{type:'market_tick'},getMetrics(s).netWorth-beforeNet,marketApi);
          const billed=s.survival.lastBilledDay===t.day;
          text=[text,settleSurvivalDay(s,marketApi)].filter(Boolean).join('\n');
          if(!billed)text+='\n'+finishRoutineSleep(s,marketApi);
          s.actionPoints=2;
          if(!s.survival.failed&&s.debtClock.periodDays<getTurnMonths(s)*30){const before=getMetrics(s).netWorth;executeMarket(s,{type:'market_day'},marketApi);trackRisk(s,{type:'market_tick'},getMetrics(s).netWorth-before,marketApi);}
        }else{
          r.stage++;
          if([2,4].includes(r.stage)){
            const beforeNet=getMetrics(s).netWorth;
            const target=r.stage===2?1:2;
            while(t.phase<target)text=[text,executeMarket(s,{type:'market_tick'},marketApi)].filter(Boolean).join('\n');
            trackRisk(s,{type:'market_tick'},getMetrics(s).netWorth-beforeNet,marketApi);
          }
          if([5,6].includes(r.stage)){const before=getMetrics(s).netWorth;tickMarket(s,marketApi,true,true);trackRisk(s,{type:'market_tick'},getMetrics(s).netWorth-before,marketApi);}
          arriveRoutineSlot(s,marketApi);
          text=[text,`已到 ${routineClock(s)}。`].filter(Boolean).join('\n');
        }
      }
      if(r.stage!==fromStage&&r.stage===6&&action.type!=='day_next'&&!completesActivity)arriveRoutineSlot(s,marketApi);
      if(action.type==='day_activity'&&action.choice==='job_hunt'&&!oldWage&&s.monthlyIncome){markNewJobStart(s,oldWage);if(s.behavior.jobStartsTomorrow)text=text.replace('每月 10 号发上月工资','明天入职后计薪，每月 10 号发上月工资');}
      afterLifeAction(s,action,marketApi);
      
      return commit(state,s,'今天的安排',text,action.type==='day_activity'?{routineActivity:{choice:action.choice,day:fromDay,from:fromStage,to:s.dayRoutine.stage}}:{});
    }
    if(action.type==='chapter_days'){
      const run=runChapterDays(state,action,{...marketApi,ensureCalendar:ensureGameCalendar,completeWork:completeRoutineWork,
        openDay:openTradingDay,resetRoutine:resetRoutineDay,sleepingMorning:recordSleepingMorning,captureWage,
        tick:s=>executeMarket(s,{type:'market_tick'},marketApi),track:(s,pnl)=>trackRisk(s,{type:'market_tick'},pnl,marketApi),
        settle:s=>settleSurvivalDay(s,marketApi),sleep:s=>finishRoutineSleep(s,marketApi)});
      return commit(state,run.state,run.days?`这段生活过了 ${run.days} 天`:'生活暂时停下',run.reason||'日常收支已经记入账本。',
        {days:run.days,chapterRun:{days:run.days,kind:run.kind,reason:run.reason},marketPnl:run.marketPnl});
    }
    if(action.type==='live_days'){
      const s=clone(state),start=s.ledger.length,startDay=debtClock(s).day,t=s.trading;
      ensureGameCalendar(s);s.debtClock.dailyWork=true;
      const target=Math.min(action.days,getTurnMonths(s)*30-debtClock(s).periodDays);
      const watch=new Map(s.positions.filter(p=>!p.frozen&&!['housing','angel','ponzi'].includes(p.kind)).map(p=>[p.id,p.value]));
      let reason='',marketPnl=0;
      while(debtClock(s).day-startDay<target){
        const day=debtClock(s).day,elapsed=day-startDay;
        // Give the player a chance to raise cash or keep a promise before it is due.
        const billTomorrow=s.debts.some(d=>d.calendar?.nextDay===day+1);
        const appointment=s.lifeArcs.promises.some(p=>p.status==='open'&&p.day<=day+1);
        if(elapsed&&(billTomorrow||appointment)){reason=billTomorrow?'明天有一笔还款，先看看钱够不够。':'约定的日子快到了，先把这件事安排好。';break;}
        const jobDue=s.lifeArcs.jobs.some(j=>j.due<=day+1);
        if(t.phase===3){t.day++;t.dayInTurn=Math.min(2,t.dayInTurn+1);t.phase=0;t.energy=6;openTradingDay(s);resetRoutineDay(s,1);recordSleepingMorning(s);}
        if(s.dayRoutine?.pending){reason='睡过头了，先处理今天的迟到。';break;}
        while(t.phase<3){
          const beforeNet=getMetrics(s).netWorth;
          executeMarket(s,{type:'market_tick'},marketApi);
          if(s.dayRoutine)s.dayRoutine.stage=[1,2,4,8][t.phase];
          const pnl=getMetrics(s).netWorth-beforeNet;marketPnl+=pnl;
          trackRisk(s,{type:'market_tick'},pnl,marketApi);
          
          const changed=[...watch].find(([id,value])=>{const p=s.positions.find(p=>p.id===id);return !p||value>0&&Math.abs(p.value-value)>=value*.2;});
          if(changed)reason=s.positions.some(p=>p.id===changed[0])?'有一笔持仓涨跌达到 20%，先看看要不要处理。':'有持仓到期、强平或项目归零，先看结算。';
          if(s.behavior.pending||s.lifeArcs.pending)reason='收到一条新消息。';
          if(reason)break;
        }
        // An interrupted intraday path stays at that moment. A completed day bills once.
        if(t.phase===3){captureWage(s);settleSurvivalDay(s,marketApi);finishRoutineSleep(s,marketApi);s.actionPoints=2;}
        if(getSurvivalStatus(s).needsCare)reason='健康已到就医线，先去医院。';
        else if(getSurvivalStatus(s).active||s.survival.failed)reason='生活费不够了，先安排今天的周转。';
        else if(s.lifeArcs.pending||s.behavior.pending)reason='收到一条新消息。';
        else if(!reason&&(s.employment?.history.at(-1)?.day||0)>(state.employment?.history.at(-1)?.day||0))reason=s.employment.history.at(-1).text;
        else if(!reason&&(s.livingCosts?.lastAny||0)>(state.livingCosts?.lastAny||0))reason='有一笔临时开销，看看这次账单。';
        else if(!reason&&billTomorrow&&t.phase===3)reason='到期账单已结算，看看还款结果。';
        else if(!reason&&jobDue&&t.phase===3)reason='接下的活有结果了。';
        if(reason)break;
      }
      const merged=new Map(),rows=[];
      for(const e of s.ledger.slice(start)){
        const merge=e.account==='cash'&&['当日工资结算','基本生活费欠款'].includes(e.label);
        if(merge&&merged.has(e.label))merged.get(e.label).amount+=e.amount;
        else{if(merge)merged.set(e.label,e);rows.push(e);}
      }
      s.ledger.splice(start,s.ledger.length-start,...rows);
      const days=debtClock(s).day-startDay;
      return commit(state,s,days?`日子过了 ${days} 天`:'先停下来看看',reason||(debtClock(s).periodDays>=getTurnMonths(s)*30?'本期日账已结清，可以进入下一段人生。':'这段日子过去了，接下来继续盯盘或安排生活。'),{days,marketPnl});
    }
    if(action.type==='wait_days'){
      const s=clone(state),start=s.ledger.length,startDay=debtClock(s).day;ensureGameCalendar(s);let last='';const target=Math.min(action.days,getTurnMonths(s)*30-debtClock(s).periodDays);
      for(let i=0;i<target;i++){
        if(s.lifeArcs?.pending||s.behavior?.pending||getSurvivalStatus(s).active||getSurvivalStatus(s).needsCare)break;
        const dueNow=s.debts.some(d=>d.calendar?.nextDay===debtClock(s).day+1)||s.lifeArcs.jobs.some(j=>j.due<=debtClock(s).day+1);
        s.debtClock??=newDebtClock();s.debtClock.dailyWork=true;
        captureWage(s);s.trading.day++;resetRoutineDay(s,8);if(s.dayRoutine?.pending){s.trading.phase=0;s.trading.energy=6;openTradingDay(s);recordSleepingMorning(s);last='睡过头了，先处理今天的迟到。';break;}settleMemeProjects(s,marketApi);last=settleSurvivalDay(s,marketApi);s.actionPoints=2;
        if(dueNow||s.lifeArcs.jobs.some(j=>j.due===debtClock(s).day+1)||s.survival.failed||(s.employment?.history.at(-1)?.day||0)>(state.employment?.history.at(-1)?.day||0))break;
      }
      // Quiet days share a receipt; retain every bill and job entry separately.
      const merged=new Map(),rows=[];for(const e of s.ledger.slice(start)){if(['当日工资结算','基本生活费欠款'].includes(e.label)&&e.account==='cash'){const prior=merged.get(e.label);if(prior)prior.amount+=e.amount;else{merged.set(e.label,e);rows.push(e);}}else rows.push(e);}s.ledger.splice(start,s.ledger.length-start,...rows);
      return commit(state,s,'日历翻过 '+(debtClock(s).day-startDay)+' 天',last||'有一件事需要先处理，时间停在原处。',{days:debtClock(s).day-startDay});
    }
    if(BEHAVIOR_ACTIONS.has(action.type)){const s=clone(state),text=executeBehavior(s,action,marketApi);return commit(state,s,'盘外的一次决定',text,{kind:'story'});}
    if(['survival_day','calendar_day','hospital'].includes(action.type)){
      const s=clone(state),t=s.trading,notes=[];ensureGameCalendar(s);s.debtClock??=newDebtClock();s.debtClock.dailyWork=true;if(action.type==='calendar_day')s.debtClock.dailyMode=true;
      const hospital=action.type==='hospital';
      // Reserve the full fee before time or holdings can change cash. No medical credit.
      if(hospital)cashChange(s,-HOSPITAL_COST,'住院医疗费');
      if(t.phase===3){t.day++;t.dayInTurn=Math.min(2,t.dayInTurn+1);t.phase=0;t.energy=6;openTradingDay(s);resetRoutineDay(s,1);recordSleepingMorning(s);}
      if(s.dayRoutine?.pending&&action.type!=='hospital')return commit(state,s,'睡过头了','已经 11:30，上午时段已错过，先处理今天的迟到。');
      const priorNet=getMetrics(s).netWorth;while(t.phase<3)executeMarket(s,{type:'market_tick'},marketApi);trackRisk(s,{type:'market_tick'},getMetrics(s).netWorth-priorNet,marketApi);
      if(hospital){ensureRoutine(s);s.dayRoutine.pending=null;notes.push(`住院治疗与观察一天，医疗费 ¥${HOSPITAL_COST/100} 已用现金付清。当天不计工资，原持仓照常结算。`);s.dayRoutine.choices[6]='sleep';}
      notes.push(settleSurvivalDay(s,marketApi,{hospital}));notes.push(finishRoutineSleep(s,marketApi));s.actionPoints=2;
      if(hospital){s.behavior.fatigue=Math.min(s.behavior.fatigue,20);s.dayRoutine.last='住院治疗一天，健康恢复至 60；医疗费与生活账已结算。';}
      return commit(state,s,s.survival.failed?'这一次，生活没有周转过来':action.type==='hospital'?'住院治疗结束':action.type==='calendar_day'?'一天的生活账':'应急日结',notes.join('\n'));
    }
    if(MARKET_ACTIONS.has(action.type)){
      const s=clone(state);
      const priorNet=getMetrics(s).netWorth;let text=executeMarket(s,action,marketApi);if(action.type==='market_tick'&&s.dayRoutine)s.dayRoutine.stage=[1,2,4,8][s.trading.phase];if(['desk_order','desk_sell','gamble'].includes(action.type)){const note=workDistraction(s,marketApi);if(note)text+='\n'+note;}recordRiskOrder(s,state,action);trackRisk(s,action,getMetrics(s).netWorth-priorNet,marketApi);afterLifeAction(s,action,marketApi);if(action.type==='market_tick'&&s.trading.phase===3){const daily=settleSurvivalDay(s,marketApi);if(daily){text+='\n'+daily;const sleep=finishRoutineSleep(s,marketApi);if(sleep)text+='\n'+sleep;}if(getSurvivalStatus(state).active||getSurvivalStatus(s).active||s.debtClock?.dailyMode||s.debtClock?.dailyWork||s.survival.days>=3){s.actionPoints=2;s.debtClock.dailyWork=true;}if(action.market==='crypto'&&!s.survival.failed&&(s.debtClock?.periodDays||0)<getTurnMonths(s)*30){const before=getMetrics(s).netWorth;executeMarket(s,{type:'market_day',market:'crypto'},marketApi);trackRisk(s,{type:'market_tick'},getMetrics(s).netWorth-before,marketApi);}}
      return commit(state,s,action.type==='gamble'?'这一局已结算':action.type==='market_tick'?'行情更新':action.type==='desk_order'?orderLabel(action.product,action.direction)+'成交':action.type==='desk_sell'?tradeTerms(state.positions.find(p=>p.id===action.id)?.kind).close+'结果':'市场操作已记录',text);
    }
    const s = clone(state); s.actionPoints--; let title = '行动完成'; let text = '';
    if (action.type !== 'rest') s.restStreak = 0;
    switch (action.type) {
      case 'job_accept': {
        preservePension(s);
        const accepted=acceptJobOpportunity(s,action.offerId);
        markNewJobStart(s,accepted.oldWage);
        if(s.flags.ever_released)s.flags.reentry_employed=true;
        title=accepted.oldWage?'新的工作安排定下来了':'工作定下来了';
        text=accepted.text+(s.behavior.jobStartsTomorrow?'\n明天正式入职，今天不重复计薪。':'');
        break;
      }
      case 'work': case 'gig': {
        recordWork(s,2);s.debtClock.dailyWork=true;
        const {specialist,total:amount,reason}=getWorkOffer(s,action.type);
        if(specialist)s.childhood.workBonusTurn=s.turn;
        cashChange(s, amount, action.type === 'work' ? '集中接活收入' : '零工收入');
        stat(s, { skill: action.type === 'work' ? 3 : 1, health: -2, stress: 3 });
        s.flags.career_history = true; if (s.wipeouts) s.flags.rebuilding = true;
        completeFullDayWork(s);
        title = action.type === 'work' ? '今天的工钱，今天算数' : '先把日子接上'; text = `${reason}一整天的活干完，已经 18:30。到账 ${amount / 100} 元${specialist?'（含本期一次的熟练加价）':''}。白天的行情也已推进，生活费睡前结算。`; break;
      }
      case 'seek_job': {
        const offer=careerOffer(s),wage=offer.wage,previousWage=hasSalariedJob(s)?s.monthlyIncome:0;
        if (hasSalariedJob(s) && wage <= s.monthlyIncome) { stat(s, { skill: 3 }); title = '简历又多了一行'; text = '眼下没有更合适的工资，你保留原工作，并补上了一项技能。'; }
        else { preservePension(s);startCareer(s,{offer,wage});markNewJobStart(s,previousWage); s.flags.employed = true; s.flags.career_history = true; if (s.flags.ever_released) s.flags.reentry_employed = true; title = '工牌重新挂上'; text = `${offer.entry}\n你找到${s.occupation}岗位，月净工资 ${wage / 100} 元，${s.behavior.jobStartsTomorrow?'明天开始计薪，':''}每月 10 号发上月工资。`; }
        break;
      }
      case 'child_game': case 'child_talkback': case 'child_skipclass': case 'child_latenight': {
        const child=childhoodActivity(s,action.type);
        if(child.cost)cashChange(s,-child.cost,child.label+'花销');
        activityStats(s,child,{});title=child.title;text=child.text;break;
      }
      case 'study': {
        const child=childhoodActivity(s,action.type);
        activityStats(s,child,{discipline:2,skill:4,insight:3,stress:2});
        title=child?.title??'书翻过一页';text=child?.text??'你跟着课程做完练习，把做错的地方重新试了一遍。';break;
      }
      case 'market_review': {
        stat(s, { insight: 3, stress: -2 });
        title = '这一笔，先不动'; text = '你核对了现金、旧仓和还款安排，决定保留当前配置。没有新增投入，也没有提前结算收益；眼力见 +3，压力 -2。'; break;
      }
      case 'market_practice': {
        recordMarketExperience(s); s.marketProgress.simulations++; stat(s, { insight: 10, skill: 2 });
        title = '先在模拟盘里交学费'; text = '你完成了一次虚拟练习，眼力见 +10，模拟经历 +1。练习不投入现金，也不产生收益。'; break;
      }
      case 'rest': {
        if (s.stats.health < 40) s.flags.ever_low_health = true;
        const child=childhoodActivity(s,action.type);
        s.restStreak++; activityStats(s,child,{ health: 10, stress: -14 });
        if (s.flags.ever_low_health && s.restStreak >= 2) s.flags.recovering_health = true;
        title = child?.title??'今天先睡个好觉'; text = child?.text??((s.survival?.hungryDays||0)>0?'休息缓解了压力，但还没吃饱，健康暂时无法恢复。':'手机放到够不着的地方。你关了灯，好好睡了一觉。'); break;
      }
      case 'social': {
        const child=childhoodActivity(s,action.type);
        activityStats(s,child,{trust:5,stress:-4,fame:1});
        if(!child||child.family)setPersonRelation(s,'N10',personRelation(s,'N10')+5);
        title=child?.title??'一起吃了顿饭';text=child?.text??'你陪家人吃完饭，聊了聊最近的事。';break;
      }
      case 'borrow': {
        const approved = draw(s) < getLoanOffer(s,action.kind,action.amount).approval;
        if (!approved) { title = '借款申请未通过'; text = '这次没有到账，也没有新增本金。你仍可做零工、求职或调整开支。'; }
        else { const terms=loanTerms(action.kind,action.amount),d = issueLoan(s, action.kind, action.amount); stat(s, { stress: 4 }); title = '到账的每一元都有还款日'; text = `${d.name}实际到账 ${terms.net / 100} 元${terms.fee?`，已扣费用 ${terms.fee/100} 元`:''}，新增本金 ${action.amount/100} 元，年利率 ${d.aprBps / 100}%，期限 ${d.monthsLeft} 个月。${terms.consequence}借款压力 +4，欠款按原账期结算。`; }
        break;
      }
      case 'debt_extend':title='还款日往后挪了一格';text=extendDebt(s,s.debts.find(d=>d.id===action.id),marketApi);break;
      case 'repay': { const paid = payDebt(s, action.amount,action.id); stat(s, { credit: 3, stress: -4 }); title = '还款表少了一行'; text = action.id?`这笔债务实际偿还 ${paid / 100} 元，先付利息再减本金；未付清的到期款仍记为逾期。`:`实际偿还 ${paid / 100} 元，先付逾期与高息借款的利息，再减本金。`; break; }
      case 'invest': { const beforeCash=s.cash;const order=['crypto','crypto_perp'].includes(action.product)?{...action,underlying:action.underlying||'CLG'}:action;const p = invest(s, order);if(['crypto','crypto_perp'].includes(p.kind)){p.instrument=p.underlying;p.cryptoLifeBranch=p.kind==='crypto_perp'?'leverage':p.instrument==='CHI'?'alt':'spot';p.name=cryptoCoin(p.instrument)?.name||p.name;recordCryptoTrade(s,p,{action:p.kind==='crypto_perp'?'open':'buy',cashFlow:s.cash-beforeCash,text:`${p.name}买入成交`});}recordRiskOrder(s,state,action); title = `${orderLabel(p.kind,p.direction)}成交`; text = `${p.name}${orderLabel(p.kind,p.direction)}，${tradeTerms(p.kind).amount} ${action.amount / 100} 元。${PRODUCTS[p.kind].description}`; break; }
      case 'sell': title = `${tradeTerms(state.positions.find(p=>p.id===action.id)?.kind).close}结果`; text = sell(s, action.id); break;
      case 'claim': {
        const c = s.claims.find(c => c.id === action.id); const success = draw(s) < 0.4;
        const recovered = success ? recoverClaim(s, c, 3000) : 0; stat(s, { stress: success ? -3 : 3 });
        title = recovered ? '回来的是真钱' : '追偿仍在排队'; text = recovered ? `实际追回 ${recovered / 100} 元；其余债权继续保留，不能重复领取。` : '你补交了记录，没有收到款项。债权仍在，生活继续。'; break;
      }
      case 'business_start': {
        const amount = action.amount ?? 500_000; cashChange(s, -amount, '开店投入');
        const names = ['巷口早餐铺', '手机维修摊', '旧物杂货店', '社区洗衣店', '路口小饭馆', '生活服务工作室'];
        const chosenName = typeof action.name === 'string' ? Array.from(action.name.trim()).slice(0, 24).join('') : '';
        const b = { id: uid(s, 'shop'), name: chosenName || names[s.businesses.length % names.length], value: amount, monthlyProfit: mul(amount, 0.008 + s.stats.skill / 12500), managedTurn: s.turn, openedTurn: s.turn, openedLifeDay:debtClock(s).day };
        s.businesses.push(b); record(s, 'business', amount, '开店取得经营资产');
        s.flags.business_owner = true; if (s.wipeouts) s.flags.rebuilding = true;
        title = '招牌挂起来了'; text = `${b.name}开门。投入 ${amount / 100} 元，预计月净利润 ${b.monthlyProfit / 100} 元；进货、房租与人工已经扣除，订单仍会变化。`; break;
      }
      case 'business_run': {
        const b = s.businesses.find(b => b.id === action.id) || [...s.businesses].sort((a, b) => (a.managedTurn ?? -1) - (b.managedTurn ?? -1))[0];
        b.managedTurn = s.turn; b.monthlyProfit = mul(b.monthlyProfit, 1.06); b.value = mul(b.value, 1.025);
        stat(s, { skill: 2, stress: 3 }); title = '老客带来一个新客'; text = `你亲自盯了一轮${b.name}的订单和成本，预计月净利润调到 ${b.monthlyProfit / 100} 元。钱要等本回合结算才到账。`; break;
      }
      case 'relationship': {
        const key = action.kind;
        if (key === 'partner') { s.household.partner = true; s.flags.shared_household = true; setPersonRelation(s,'N02',Math.max(60,personRelation(s,'N02'))); stat(s, { trust: 8, stress: -4 }); title = '从我，到我们'; text = '你们决定认真一起生活，约定大额财务决定先说清楚。每月共同生活开支增加 900 元。'; }
        if (key === 'child') { welcomeChild(s); setPersonRelation(s,'N09',60); stat(s, { trust: 5, stress: 5 }); title = '家里多了一双小鞋'; text = '小满来到你们的生活。每月照护开支增加 2000 元，时间也要重新分配。'; }
        if (key === 'repair') { s.repairCount++; setPersonRelation(s,'N02',personRelation(s,'N02')+10); stat(s, { trust: 10, stress: -5 }); if (s.repairCount >= 2 && s.stats.trust > 60) s.flags.relationship_repaired = true; title = '这次把话讲完'; text = '你没有用下一次暴富作保证，而是说清了今天能兑现的事。关系要靠一次次守约慢慢回来。'; }
        if (key === 'succession') { s.flags.succession_released = true; stat(s, { trust: 8 }); title = '他们有自己的路'; text = '你列清资产、债务和权属，也给孩子留下不接班的余地。你名下的资产没有因此凭空转走。'; }
        break;
      }
      case 'exit_risk': s.riskExitTurn = s.turn; s.flags.exit_intent = true; title = '先关掉新仓按钮'; text = '你决定停止新增高风险投资。坚持两回合后完成封盘，旧仓和旧债照常结算。'; break;
      case 'prison_study': stat(s, { skill: 5, insight: 3, stress: 1 }); title = '把书读到下一页'; text = '你完成了狱中的课程，本事有所提升。'; break;
      case 'prison_reflect': stat(s, { health: 4, stress: -8, insight: 2 }); title = '把那段路重新想一遍'; text = '你整理了自己做过的选择。反思帮助你维持状态，既有责任仍需履行。'; break;
      case 'prison_letter': stat(s, { trust: 3, stress: -3 }); setPersonRelation(s,'N10',personRelation(s,'N10')+3); title = '一封家书'; text = '你在信里写了近况，托家人保重身体。'; break;
      case 'legal_cooperate': title = '如实说明'; text = cooperate(s); break;
      case 'quit_gambling': title = '停止追下一把'; text = quitGambling(s); break;
    }
    if(['invest','sell','claim'].includes(action.type))trackRisk(s,action,getMetrics(s).netWorth-getMetrics(state).netWorth,marketApi);
    afterLifeAction(s,action,marketApi);const introduction=noteLifeAction(s,action);if(introduction)text+='\n'+introduction;
    return commit(state, s, title, text);
  } catch (error) { return failed(state, error); }
}

function recordSleepingMorning(s){const before=getMetrics(s).netWorth;skipSleepingMorning(s,marketApi);trackRisk(s,{type:'market_tick'},getMetrics(s).netWorth-before,marketApi);}
const marketApi={mul,draw,issueLoan,stat,syncEmployment,cashChange,noteRealizedProfit,record,payDebt,addClaim,invest,sell,closePosition,freezePosition,charge,openLegalCase,quitGambling,metrics:getMetrics,months:getTurnMonths,survival:getSurvivalStatus,dailyMode:s=>Boolean(s.debtClock?.dailyMode),dailyWage:(s,base)=>{completeRoutineWork(s);return fatigueWage(s,base);},settleDay:(s,workday)=>{const notes=[];livingPlanEffects(s,1,marketApi,workday);const work=advanceEmployment(s,1,marketApi,workday);if(work.text)notes.push(work.text);advanceDebtClock(s,1,marketApi,notes);advanceBehaviorDays(s,1,marketApi);advanceLifeDays(s,marketApi,notes);const cost=advanceLivingCosts(s,1,marketApi);if(cost)notes.push(cost);return notes.join('\n');},
  orderAvailability:(s,a)=>getActionAvailability({...s,actionPoints:2},a)};

function profileFlags(s, profile, effects, context) {
  const productive = effects.some(e => ['earn', 'venture', 'illiquid'].includes(e.op));
  if (profile === 'job' && effects.some(e => e.op === 'flag' && e.key === 'employed' && e.value)) { const oldWage=hasSalariedJob(s)?s.monthlyIncome:0;preservePension(s);if(oldWage){s.monthlyIncome=Math.max(oldWage,jobMonthlyPay(s));}else{startCareer(s,{source:context.eventId||'story-job',wage:jobMonthlyPay(s)});}markNewJobStart(s,oldWage); s.flags.career_history = true; if (s.flags.ever_released) s.flags.reentry_employed = true; }
  if (['work', 'job'].includes(profile) && productive) { s.flags.career_history = true; if (s.wipeouts) s.flags.rebuilding = true; }
  if (profile === 'repair' && effects.some(e => e.op === 'stat' && (e.delta?.trust || 0) >= 10)) {
    s.repairCount++; if (s.repairCount >= 2 && s.stats.trust > 60) s.flags.relationship_repaired = true;
    if (/^FAMO0[56]$/.test(context.eventId || '') && s.stats.trust >= 50) s.flags.public_truth = true;
  }
  if (profile === 'rest') { if (s.stats.health < 50) s.flags.ever_low_health = true; s.restStreak++; if (s.flags.ever_low_health && s.restStreak >= 2) s.flags.recovering_health = true; }
}
export function applyEffects(state, effects, context = {}) {
  try {
    if (!Array.isArray(effects)) throw new Error('事件效果必须为数组');
    if(jobSearchWait(state)&&effects.some(e=>e.op==='flag'&&e.key==='employed'&&e.value))throw Error(jobSearchWait(state));
    if(isCollegeStudent(state)&&effects.some(e=>e.op==='flag'&&e.key==='employed'&&e.value))throw Error(COLLEGE_JOB_REASON);
    if (effects.some(e => e.op === 'legal_case') && effects.some(e => e.op === 'earn')) throw new Error('涉案所得须由 legal_case 统一发放登记，不能叠加 earn 重复入账');
    if (getLegalStatus(state).inPrison && (context.profile === 'job' || effects.some(e => !['stat', 'flag', 'schedule', 'legal_cooperate'].includes(e.op)))) throw new Error('服刑期间只能处理狱中生活与调查，外部收入和投资操作暂不开放');
    if ((state.flags.exit_intent || state.flags.voluntary_exit) && ['options', 'option_sell', 'contract', 'ponzi', 'angel'].includes(context.profile) && effects.some(e => ['venture', 'illiquid', 'freeze_investment'].includes(e.op))) throw new Error('你已决定封盘，不再新增高风险投资');
    if(schemeLifeState(state).forbidRisk && context.profile==='ponzi' && effects.some(e=>['venture','illiquid','freeze_investment'].includes(e.op)))throw new Error('你已永久拒绝类似项目，仍可处理旧款项');
    const marketProduct = PROFILE_PRODUCT[context.profile];
    const storyRisk=storyRiskAction(state,effects,marketProduct,context.profile,state.cash);
    if (marketProduct && effects.some(e => ['venture','illiquid'].includes(e.op))) {
      const access = getMarketAccess(state, marketProduct);
      if (!access.unlocked) throw new Error(access.reason);
    }
    const key = context.resolutionId || (context.eventId ? `${state.turn}:${context.eventId}` : null);
    if (key && (state.appliedEffectIds || []).includes(key)) return { state, result: { title: '这件事已经结算', text: '同一事件不会再次扣款或发钱。', alreadyApplied: true } };
    for (const prerequisite of context.prerequisites || []) if (!getEligibility(state, prerequisite)) throw new Error('当前条件不满足：' + prerequisite);
    if (context.min_cash_yuan && state.cash < yuan(context.min_cash_yuan)) throw new Error('现金不足，无法执行这一选项');
    const s = clone(state);
    const details = [], investmentChanges = [];
    const stake = (effect) => { fraction(effect.stake_fraction); const amount = mul(s.cash, effect.stake_fraction); if (amount <= 0) throw new Error('当前没有可投入现金');recordRiskCommitment(s,s.cash,marketProduct||context.profile||'stock',amount); return amount; };
    for (const e of effects) {
      if (!e || typeof e.op !== 'string') throw new Error('事件效果格式无效');
      if (s.age < 18 && ['loan', 'guarantee', 'venture', 'illiquid', 'freeze_investment', 'liquidate_asset','crypto_life'].includes(e.op)) throw new Error('未成年人不能执行成人金融操作');
      const capitalBeforeEffect=investmentCapital(s);
      const investmentEffect=['venture','illiquid','freeze_investment','crypto_life'].includes(e.op);
      const netBeforeEffect=investmentEffect?getMetrics(s).netWorth:0;
      switch (e.op) {
        case 'crypto_life': details.push(executeCryptoLifeEffect(s,e,marketApi,context)); break;
        case 'legal_case': { const c = openLegalCase(s, e, context); details.push(`本次收到 ${c.profit / 100} 元，责任记录已固定，后续调查不会因读档重抽`); break; }
        case 'legal_cooperate': details.push(cooperate(s)); break;
        case 'quit_gambling': details.push(quitGambling(s)); break;
        case 'relationship': {
          if (!/^N(?:0[1-9]|1[0-2])$/.test(e.character_id) || !Number.isInteger(e.change) || Math.abs(e.change) > 100) throw new Error('人物关系变化无效');
          meetPerson(s,e.character_id);setPersonRelation(s,e.character_id,personRelation(s,e.character_id)+e.change); break;
        }
        case 'stat': stat(s, e.delta); break;
        case 'flag': {
          if (typeof e.key !== 'string' || !e.key || typeof e.value !== 'boolean') throw new Error('标记格式无效');
          s.flags[e.key] = e.value;
          if(e.key==='employed'&&!e.value&&(isCollegeStudent(s)||hasSalariedJob(s))){s.monthlyIncome=0;s.occupation=isCollegeStudent(s)?'大学生':'离职待业';s.behavior.leaveDays=0;s.behavior.jobStartsTomorrow=false;}
          if (e.key === 'partner') {s.household.partner = e.value;if(e.value)meetPerson(s,'N02');}
          if (e.key === 'has_child') {if(e.value){welcomeChild(s);meetPerson(s,'N09');}else{s.household.hasChild=false;delete s.household.childBornAge;}}
          if (e.key === 'living_parent') s.household.livingParent = e.value;
          break;
        }
        case 'earn': { const amount = yuan(e.amount_yuan); cashChange(s, amount, context.onlineGambling?'网赌返还（含本金）':'剧情劳动 / 外部收入'); details.push(`收入 ${amount / 100} 元`); break; }
        case 'spend': { const amount = yuan(e.amount_yuan); cashChange(s, -amount, context.onlineGambling?'网赌下注':'剧情支出'); details.push(`支出 ${amount / 100} 元`); break; }
        case 'family_transfer': {
          if (!getEligibility(s, 'family_reserve_positive')) throw new Error('家庭没有可提供的援助');
          const amount = Math.min(s.familyReserve, yuan(e.cap_yuan));
          s.familyReserve -= amount; cashChange(s, amount, '家庭有限援助'); details.push(`家庭援助 ${amount / 100} 元`); break;
        }
        case 'loan': {
          const kind = e.purpose === 'online_gambling' ? 'friend' : e.purpose === 'consumption' || context.profile === 'netloan' ? 'net' : 'bank';
          issueLoan(s, kind, yuan(e.principal_yuan), { aprBps: e.apr_bps, monthsLeft: e.term_months, purpose: e.purpose });
          details.push(`借入 ${e.principal_yuan} 元，同时形成等额本金`); break;
        }
        case 'repay': {
          if (debtTotal(s) <= 0) throw new Error('当前没有可偿还的债务');
          const amount = e.amount_yuan !== undefined ? yuan(e.amount_yuan) : mul(s.cash, fraction(e.cash_fraction));
          const paid = payDebt(s, amount); if (paid <= 0) throw new Error('没有可用于还款的现金'); details.push(`偿还 ${paid / 100} 元`); break;
        }
        case 'extend_debt': {
          if (debtTotal(s) <= 0) throw new Error('当前没有可协商的债务');
          if (!Number.isInteger(e.turns) || e.turns <= 0 || e.turns > 20) throw new Error('展期时长无效');
          const plan=storyExtension(s);if(plan.reason)throw Error(plan.reason);
          for(const d of plan.legacy){d.monthsLeft+=Math.max(6,getTurnMonths(s))*e.turns;d.overdue=false;}
          if(plan.legacy.length)details.push(`旧约展期 ${e.turns} 回合，本金和已计利息保留`);
          if(plan.modern)details.push(extendDebt(s,plan.modern,marketApi));
          s.flags.restructuring=true;break;
        }
        case 'guarantee': {
          const amount = yuan(e.limit_yuan); if (s.age < 18) throw new Error('未成年人不能签署担保');
          s.guarantees ??= []; s.guarantees.push({ id: uid(s, 'guarantee'), limit: amount, called: !!e.called });
          if (e.called) { charge(s, amount, '担保追索款', { aprBps: 600 }); details.push(`担保被追索 ${amount / 100} 元`); }
          break;
        }
        case 'venture': {
          const amount = stake(e); if (!Number.isFinite(e.gross_multiple) || e.gross_multiple < 0) throw new Error('投资返还倍率无效');
          const gross = mul(amount, e.gross_multiple); cashChange(s, -amount, storyCashLabel(context.profile), {storyStake:true}); cashChange(s, gross, storyCashLabel(context.profile,true));
          if (e.loss_debt_multiple) createDebt(s, { name: '卖方期权追索债务', principal: mul(amount, e.loss_debt_multiple), aprBps: 600, monthsLeft: 24, kind: 'derivative' });
          const product = ({ options: 'option', option_sell: 'option_short', contract: 'futures', allin: 'stock', business: 'business', expand: 'business' })[context.profile] || context.profile || 'stock';
          registerInvestment(s, product);
          if(!['uw_gamble','uw_chase'].includes(context.profile))noteRealizedProfit(s,gross-amount-(e.loss_debt_multiple?mul(amount,e.loss_debt_multiple):0));
          if (product === 'option' && e.gross_multiple >= 10) s.flags.option_big_win = true;
          if (product === 'business' && gross > amount) {
            s.flags.business_history = true;
            // 成功的经营故事保留部分回款在店里；现金转经营资产，不额外赠送财富。
            const retained = Math.min(amount, mul(gross, 0.35));
            details.push(`回款中 ${retained / 100} 元留作经营资产，未计入可用现金`);
            cashChange(s, -retained, '经营回款留在店铺周转');
            if (context.profile === 'expand' && s.businesses.length) {
              const b = s.businesses[0]; b.value = checked(b.value + retained); b.monthlyProfit = checked(b.monthlyProfit + mul(retained, 0.025));
            } else {
              s.businesses.push({ id: uid(s, 'shop'), name: '故事里的小店', value: retained, monthlyProfit: mul(retained, 0.008 + s.stats.skill / 12500), managedTurn: s.turn, openedTurn: s.turn, openedLifeDay:debtClock(s).day });
            }
            record(s, 'business', retained, '经营回款保留为实际业务资产');
          }
          details.push(`${storyCashLabel(context.profile)} ${amount / 100} 元，结算回款（含本金）${gross / 100} 元，${gross>=amount?'盈利':'亏损'} ${Math.abs(gross-amount) / 100} 元`); break;
        }
        case 'illiquid': {
          const amount = stake(e); if (!Number.isFinite(e.gross_multiple) || e.gross_multiple < 0 || !Number.isInteger(e.lock_turns) || e.lock_turns < 0) throw new Error('锁定资产条款无效');
          const kind = context.profile === 'housing' ? 'housing' : 'angel';
          cashChange(s, -amount, '认购锁定权益');
          const p = { id: uid(s, 'asset'), name: kind === 'housing' ? '剧情个人房产' : '剧情天使股权', kind, cost: amount, value: mul(amount, e.gross_multiple), lockUntilTurn: s.turn + e.lock_turns, underlying: kind, entryPrice: 10000, lastPrice: 10000, storyValuation: true };
          s.positions.push(p); record(s, 'position', p.value, '锁定权益估值'); registerInvestment(s, kind);
          details.push(`投入 ${amount / 100} 元，锁定 ${e.lock_turns} 回合，估值不发现金`); break;
        }
        case 'freeze_investment': {
          const amount = stake(e); cashChange(s, -amount, '资金盘本次投入冻结');
          if (!Number.isFinite(e.claim_mark_bps) || e.claim_mark_bps < 0 || e.claim_mark_bps > 10000) throw new Error('债权估值比例无效');
          addClaim(s, amount, mul(amount, e.claim_mark_bps / 10000), '待追偿资金盘本金');
          registerInvestment(s, 'ponzi'); s.flags.ponzi_loss = true; details.push(`冻结本金 ${amount / 100} 元，进入追偿记录`); break;
        }
        case 'claim': { const amount = yuan(e.face_yuan ?? e.amount_yuan); addClaim(s, amount, yuan(e.value_yuan ?? 0), e.name || '待到账债权'); break; }
        case 'recover_claim': {
          if (!getEligibility(s, 'claim_positive')) throw new Error('当前没有可追偿债权');
          let recovered = 0; for (const c of [...s.claims]) recovered = checked(recovered + recoverClaim(s, c, e.recovery_bps));
          details.push(`实际追回 ${recovered / 100} 元`); break;
        }
        case 'liquidate_asset': {
          fraction(e.fraction); if (!Number.isFinite(e.haircut_bps) || e.haircut_bps < 0 || e.haircut_bps > 10000) throw new Error('折价比例无效');
          const available = s.positions.filter(p => isSaleable(s, p) && (!(['crypto','crypto_perp'].includes(p.kind)||p.cryptoLifeBranch==='scheme') || !cryptoLifeActionReason(s,{action:'sell',positionId:p.id})));
          const shops = s.businesses.filter(b => b.value > 0);
          if (!available.length && !shops.length) throw new Error('没有可出售的个人资产');
          let total = 0;
          for (const p of available) {
            if (['crypto','crypto_perp'].includes(p.kind)||p.cryptoLifeBranch==='scheme') {
              const beforeCash=s.cash;
              executeCryptoLifeEffect(s,{action:'liquidate',positionId:p.id,fraction:e.fraction,haircut_bps:e.haircut_bps},marketApi,context);
              total=checked(total+(s.cash-beforeCash));continue;
            }
            const sale = mul(p.value, e.fraction); if (!sale) continue;
            const prior = p.value; p.value -= sale; p.cost = mul(p.cost, 1 - e.fraction); if (p.units) p.units = mul(p.units, 1 - e.fraction); if (p.margin) p.margin = mul(p.margin, 1 - e.fraction);
            for (const field of ['premium', 'feesPaid', 'liquidation']) if (p[field]) p[field] = mul(p[field], 1 - e.fraction);
            const proceeds = mul(sale, 1 - e.haircut_bps / 10000); cashChange(s, proceeds, '折价出售个人资产'); record(s, 'position', p.value - prior, '部分资产出售'); total = checked(total + proceeds);
            if (p.kind === 'angel' && proceeds) { s.flags.equity_exit = true; s.realizedEquityProceeds = checked(s.realizedEquityProceeds + proceeds); }
          }
          for (const b of shops) { const sale = mul(b.value, e.fraction); b.value -= sale; b.monthlyProfit = mul(b.monthlyProfit, 1 - e.fraction); const proceeds = mul(sale, 1 - e.haircut_bps / 10000); cashChange(s, proceeds, '折价出售部分经营资产'); record(s, 'business', -sale, '部分经营资产出售'); total = checked(total + proceeds); }
          s.positions = s.positions.filter(p => p.value > 0 || p.kind === 'option_short' || ['crypto','crypto_perp'].includes(p.kind) || p.cryptoLifeBranch==='scheme'); s.businesses = s.businesses.filter(b => b.value > 0);
          for (const d of s.debts) if (d.collateralId && !s.positions.some(p => p.id === d.collateralId)) { d.collateralId = null; d.kind = 'arrears'; d.name = '处置抵押物后剩余借款'; }
          details.push(`资产出售到账 ${total / 100} 元`); break;
        }
        case 'schedule': {
          if (!e.event_id && !e.eventId) throw new Error('预约缺少事件编号');
          const after = e.after_turns ?? e.turns ?? 1;
          const expiry = e.expires_after_turns ?? Math.max(5, after + 3);
          if (!Number.isSafeInteger(after) || !Number.isSafeInteger(expiry) || after < 1 || expiry < after || expiry > 1000) throw new Error('预约回合或有效期无效');
          s.pending ??= []; s.pending.push({ id: uid(s, 'pending'), eventId: e.event_id || e.eventId, dueTurn: s.turn + after, expiresTurn: s.turn + expiry, sourceEventId: context.eventId, reason: e.reason, fallback: e.fallback }); break;
        }
        default: throw new Error(`未知效果操作：${e.op}`);
      }
      if(investmentEffect)investmentChanges.push({op:e.op,profile:context.profile||'stock',value:getMetrics(s).netWorth-netBeforeEffect});
      if(['venture','illiquid','freeze_investment','liquidate_asset'].includes(e.op))wipeoutCheck(s,capitalBeforeEffect);
    }
    profileFlags(s, context.profile, effects, context);
    if(s.career?.jobs>(state.career?.jobs||0)&&context.profile==='job')details.push(`${s.career.entry} 当前岗位：${s.occupation}，月薪 ¥${s.monthlyIncome/100}，每月 10 号发上月工资。`);
    if(storyRisk)trackRisk(s,storyRisk,getMetrics(s).netWorth-getMetrics(state).netWorth,marketApi);if(context.profile==='rest')afterLifeAction(s,{type:'rest'},marketApi);
    if (key) { s.appliedEffectIds ??= []; s.appliedEffectIds.push(key); }
    return commit(state, s, '选择已落地', details.join('；') || '这件事改变了你看待生活的方式。', { eventId: context.eventId, ...(investmentChanges.length?{investmentChanges}:{}) });
  } catch (error) { return failed(state, error); }
}

function appliesShock(p, shock) {
  if (!shock) return false;
  const filter = shock.exposureFilter;
  if (filter?.underlyings && !filter.underlyings.includes(p.underlying)) return false;
  if (filter?.kinds && !filter.kinds.includes(p.kind)) return false;
  return true;
}
function settlePositions(s, months, shock, notes) {
  const years = months / 12;
  const unpricedYears=Math.max(0,months*30-(s.survival?.days||0))/360;
  const endLifeDay=debtClock(s).day+Math.max(0,months*30-debtClock(s).periodDays);
  const marketDraw = draw(s); const market = (marketDraw - 0.43) * 0.55 * Math.sqrt(unpricedYears);
  const independent = { stock: market, fund: market * 0.65 + 0.015 * unpricedYears, bond: (draw(s) - 0.48) * 0.12 * Math.sqrt(unpricedYears), crypto: market * 1.5 + (draw(s) - 0.48) * 0.6 * Math.sqrt(unpricedYears), housing: (marketDraw - 0.43) * 0.55 * Math.sqrt(years) * 0.28 + (draw(s) - 0.5) * 0.12 * Math.sqrt(years) };
  // 同一敞口共享冲击与市场方向。仅对现有仓位结算，不对现金乘世界收益率。
  const shocks = shock?.returns || {};
  for (const value of Object.values(shocks)) if (!Number.isFinite(value)) throw new Error('市场冲击收益率无效');
  // One price per listed company, whether held or not; all lots share the same path.
  s.trading??=newTrading(s);
  const regionalMoves=stockPeriodMoves(s,unpricedYears,{draw}),regionalPrices={},regionalReturns={};
  for(const i of STOCKS){const key='stock:'+i.id,pseudo={kind:'stock',underlying:key};
    const forced=shocks.stock??shocks[key];
    if(appliesShock(pseudo,shock)&&forced!==undefined)regionalMoves[key]=forced;
    const previous=s.markets[key]||s.positions.find(p=>p.underlying===key)?.lastPrice||1000;
    regionalPrices[key]=Math.max(1,mul(previous,Math.max(.0001,1+regionalMoves[key])));
    regionalReturns[i.id]=regionalPrices[key]/previous-1;
  }
  markStockSegment(s,regionalReturns,mul);
  const futurePrices=futuresPeriodPrices(s,unpricedYears,{draw,mul});
  for(const i of FUTURES_INSTRUMENTS){const override=shocks.futures??shocks[i.id];if(override!==undefined&&i.group!=='indices'&&i.group!=='fx'&&appliesShock({kind:'futures',underlying:i.id},shock))futurePrices[i.id]=Math.max(1,mul(s.markets[i.id]??10000,Math.max(.0001,1+override)));}
  s.trading.stockNews=Object.entries(s.trading.stockWorld).map(([id,w])=>`${stockMarket(STOCKS.find(i=>i.market===id).id).name}：${w.news}`).join(' ');
  for (const p of [...s.positions]) {
    if(p.cryptoLifeBranch==='scheme'||p.honeypot||p.historyPricedTurn===s.turn)continue;
    if (p.frozen) continue;
    const prior = p.value;
    const heldYears=p.openedLifeDay===undefined?years:Math.min(years,Math.max(0,endLifeDay-p.openedLifeDay)/360);
    const match = appliesShock(p, shock);
    let move = independent[p.kind] ?? independent[p.underlying] ?? market;
    if(p.kind==='stock'&&regionalMoves[p.underlying]!==undefined)move=regionalMoves[p.underlying];
    if(p.fundStyle)move=market*({balanced:.65,growth:1.2,defensive:.2}[p.fundStyle]??.65);
    const specific = shocks[p.kind] ?? shocks[p.underlying] ?? (p.kind === 'fund' ? shocks.stock : undefined);
    if (match && specific !== undefined) move = specific * (p.kind === 'fund' && shocks.fund === undefined ? 0.65 : 1);
    if (p.kind === 'futures' || p.kind === 'option' || p.kind === 'option_short') {
      const direction = p.direction === 'short' ? -1 : 1;
      if (p.kind === 'futures') {
        const nextPrice = futurePrices[p.underlying] ?? (p.underlying === 'WTI_2020_05' ? mul(p.lastPrice, 1 + move) : Math.max(0, mul(p.lastPrice, 1 + Math.max(-1, move))));
        const pnl = mul(p.units, ((nextPrice - p.entryPrice) / p.entryPrice) * direction);
        const fee = mul(p.units, 0.001 * unpricedYears); p.feesPaid = checked((p.feesPaid || 0) + fee);
        const equity = checked(p.margin + pnl - p.feesPaid);
        if (equity <= p.liquidation) {
          const returned = Math.max(0, equity); closePosition(s, p, returned, '逐仓合约强平后剩余保证金');
          recordDisciplineLiquidation(s,p,marketApi);s.flags.futures_liquidated = true; s.flags.had_margin_crisis = true; stat(s, { stress: 12 }); notes.push(`${p.name}因保证金低于维持线强平，返还 ${returned / 100} 元，逐仓本金以外不追索。`);
        } else { p.value = equity; p.lastPrice = nextPrice; }
      } else {
        p.lastPrice = Math.max(0, mul(p.lastPrice, 1 + Math.max(-1, move)));
        const relative = p.entryPrice ? (p.lastPrice - p.strike) / p.entryPrice : 0;
        const obligation = mul(p.units, Math.max(0, relative * direction));
        if (s.turn >= p.expiryTurn) {
          if (p.kind === 'option') { closePosition(s, p, obligation, '买方期权到期结算'); notes.push(`期权到期：权利金 ${p.cost / 100} 元，收到 ${obligation / 100} 元。`); }
          else {
            const collateral = checked(p.margin + p.premium); const cashBack = Math.max(0, checked(collateral - obligation)); const extraLoss = Math.max(0, checked(obligation - collateral));
            closePosition(s, p, cashBack, '卖方期权保证金与权利金净额结算');
            if (extraLoss) charge(s, extraLoss, '卖方期权超保证金赔付', { aprBps: 600 });
            notes.push(`卖方期权赔付 ${obligation / 100} 元；保证金外另付 ${extraLoss / 100} 元。`);
          }
        } else p.value = p.kind === 'option' ? obligation : Math.max(0, p.margin + p.premium - obligation);
      }
    } else if (p.kind === 'ponzi') {
      if (draw(s) < 0.2 || (match && (specific <= -0.5 || (shock?.channels || []).includes('ponzi')))) { freezePosition(s, p, '资金盘停付追偿债权'); notes.push('资金盘停止提现，账面数字转为低估值追偿债权。'); }
      else { p.value = mul(p.value, 1 + 0.18 * heldYears); p.bookBalance = p.value; }
    } else if (p.kind === 'angel') {
      if (match && specific !== undefined) p.value = mul(p.value, Math.max(0, 1 + specific));
      else if (p.storyValuation) { /* 剧情已指定估值，解锁前不再套用第二次剧情倍率。 */ }
      else {
        const roll = draw(s);
        if (roll < 0.12) { p.value = 0; p.failed = true; notes.push('一家天使项目耗尽现金，股权估值归零。'); }
        else if (roll > 0.91) { p.value = mul(p.value, 3.5); p.ownershipBps = mul(p.ownershipBps, 0.85); notes.push('一轮新融资完成：估值上涨，持股被稀释，钱仍没有退出。'); }
        else p.value = mul(p.value, 0.85 + roll * 0.5);
      }
    } else {
      p.value = Math.max(0, mul(p.value, Math.max(0, 1 + move)));
      if (p.lastPrice) p.lastPrice = regionalPrices[p.underlying]??Math.max(1, mul(p.lastPrice, Math.max(0.0001, 1 + move)));
      if(p.shares!==undefined)p.value=checked(p.shares*p.lastPrice);
      if (p.kind === 'stock') {
        if (move < -0.25) { p.suspendedUntilTurn = s.turn + 1; notes.push('股票组合触发交易限制，本回合暂时无法卖出。'); }
        const dividend = mul(p.value, 0.012 * heldYears); if (dividend) { cashChange(s, dividend, '股票现金分红');noteRealizedProfit(s,dividend); s.flags.received_dividend = true; }
      }
      if (p.kind === 'bond') {
        const creditFailure=p.instrument && draw(s)<({solid:.005,industrial:.03,stressed:.12}[p.instrument]||0)*years;
        if (move <= -0.45 || creditFailure) { const face = p.cost; s.positions = s.positions.filter(x => x.id !== p.id); addClaim(s, face, mul(p.value, 0.5), '债券违约待偿本金'); record(s, 'position', -prior, '违约债券移出持仓'); notes.push('债券违约，停止票息并进入追偿。'); }
        else {const accrual=p.maturityAge===undefined?heldYears:Math.max(0,Math.min(heldYears,p.maturityAge-(s.age-years)));const coupon=mul(p.cost, (p.couponBps??300)/10000 * accrual);cashChange(s, coupon, '债券现金票息');noteRealizedProfit(s,coupon);if(p.maturityAge!==undefined&&s.age>=p.maturityAge){closePosition(s,p,p.cost,'债券到期本金兑付');notes.push(`${p.name}到期兑付本金。`);}}
      }
      if (p.kind === 'crypto' && match && (shock?.freezeKinds || []).includes('crypto')) { freezePosition(s, p, '加密托管冻结追偿债权'); notes.push('托管平台冻结提现，现货转入追偿记录。'); }
      if (p.kind === 'housing') {
        const occupied = draw(s) > 0.18;
        const rental = occupied ? mul(p.value, (p.rentBps??300)/10000 * heldYears) : 0;
        const maintenance = mul(p.value, 0.01 * heldYears);
        if (rental) cashChange(s, rental, '房屋租金');
        charge(s, maintenance, '房屋维修支出');noteRealizedProfit(s,rental-maintenance);
        if (!occupied) notes.push('房屋空置了一段时间，仍有维修支出。');
      }
    }
    if (s.positions.some(x => x.id === p.id) && p.value !== prior) record(s, 'position', checked(p.value - prior), `${p.name}估值变化`, { positionId: p.id });
  }
  Object.assign(s.markets,regionalPrices,futurePrices);
  for (const [key, value] of Object.entries(s.markets)) {
    if(regionalPrices[key]!==undefined||futurePrices[key]!==undefined||isRugged(s,key))continue;
    if(s.positions.some(p=>p.underlying===key&&p.historyPricedTurn===s.turn))continue;
    const marked=s.positions.find(p=>p.managed&&p.underlying===key&&p.lastPrice>0&&!p.honeypot);
    if(marked){s.markets[key]=marked.lastPrice;continue;}
    // 展示用市场指数不作为现金；定价保持整数并有下限。
    const move = independent[key] ?? market;
    s.markets[key] = Math.max(1, mul(value, Math.max(0.0001, 1 + move)));
  }
}

export function advanceTurn(state, shock = null) {
  try {
    if(state.familyLife?.pending)throw Error('先处理和林夏的这件事，再推进时间');
    if(familyTimeActive(state)&&state.age>=18.5&&state.age<80&&!state.legal?.prisonMonthsLeft&&(state.debtClock?.periodDays||0)<getTurnMonths(state)*30)return applyAction(state,{type:'chapter_days',days:30});
    if(state.dayRoutine?.pending)throw Error('先选完眼前这件日常小事，再推进时间');
    if (state.survival?.failed || state.age >= 80 || state.phase === 'ended') throw new Error('人生已到结算节点');
    const s = clone(state);captureWage(s);syncEmployment(s); s.legal ??= createLegalState(); const months = getTurnMonths(s); const startAge = s.age;
    const employmentDate=addGameDays(gameDate(s),s.survival?.lastBilledDay===s.trading.day?1:0);
    const wasInPrison = getLegalStatus(s).inPrison;
    const notes = [];
    const closingNet=getMetrics(s).netWorth;finishTradingPeriod(s,marketApi,notes);trackRisk(s,{type:'period_close'},getMetrics(s).netWorth-closingNet,marketApi);
    const outgoingExpense = expense(s);
    if(startAge<18&&startAge+months/12>=18&&s.childhood?.inventory)notes.push(executeChild(s,{type:'child_clear'},marketApi));
    s.turn++; s.age = Math.min(80, Math.round((s.age * 12 + months)) / 12); s.actionPoints = 2;
    advanceEducation(s,startAge,s.age);
    if (startAge < 18) {
      stat(s,{stress:-Math.min(8,months/6)});
      notes.push(...settleChildhoodAllowance(s,startAge,{draw,cashChange}));
    }
    if (s.age >= 18 && !s.giftReceived) { s.adultGift=Math.min(s.adultGift,ADULT_GIFT_CAP);cashChange(s, s.adultGift, '成年一次性赠与'); s.giftReceived = true; notes.push(`家里约定的成年赠与 ${s.adultGift / 100} 元到账，仅有这一次。`); }
    if (startAge >= 18) {
      s.flags.cashflow_crisis = false;
      const capitalBeforeMarket = investmentCapital(s);
      const marketNetBefore=getMetrics(s).netWorth;settlePositions(s, months, shock, notes);trackRisk(s,{type:'period_market'},getMetrics(s).netWorth-marketNetBefore,marketApi);
      // 工资和生活费属于随后发生的现金流，不能覆盖这一刻真实发生的投资归零。
      wipeoutCheck(s,capitalBeforeMarket);
        const incomeFactor = shock?.incomeFactor ?? 1;
      if (!Number.isFinite(incomeFactor) || incomeFactor < 0 || incomeFactor > 10) throw new Error('收入冲击倍率无效');
      // Compressed time follows the same civil paydays; never pay a lump sum at rollover.
      let salary=0,support=0;
      if(s.survival?.lastBilledDay===s.trading.day&&s.dayRoutine){s.dayRoutine.lateForWork=false;s.dayRoutine.wagePenalty=false;}
      for(let i=0,days=Math.max(0,months*30-debtClock(s).periodDays);i<days;i++){
        const date=addGameDays(employmentDate,i),base=payrollBase(s,date,{age:startAge,prison:wasInPrison});
        const worked=!wasInPrison&&hasSalariedJob(s)&&!s.behavior.leaveDays&&!s.behavior.jobStartsTomorrow;
        const earned=Math.max(0,fatigueWage(s,base.total)-base.pension);
        salary+=settlePayroll(s,marketApi,{date,gross:mul(base.wage,incomeFactor),earned:mul(earned,incomeFactor)});
        support+=settleCollegeSupport(s,marketApi,{date,age:startAge,prison:wasInPrison});
        if(base.pension){const pension=mul(base.pension,incomeFactor);cashChange(s,pension,'养老金日结');salary+=pension;}
        const employment=advanceEmployment(s,1,marketApi,{startDay:debtClock(s).day+i,startDate:date,age:startAge,prison:wasInPrison,worked});
        if(employment.text)notes.push(employment.text);
        // A saved late arrival or one-off work error applies only to its actual day.
        if(s.dayRoutine){s.dayRoutine.lateForWork=false;s.dayRoutine.wagePenalty=false;}
      }
      // Life chapters use 30-day billing months. Include the few calendar dates
      // elided at their boundary so a fully employed civil month retains its full pay.
      const end=periodDate(s),last=s.payroll?.lastAccruedDate;
      if(last&&end>last&&end<=addGameDays(last,8)){
        for(let date=addGameDays(last,1);date<end;date=addGameDays(date,1)){
          const base=payrollBase(s,date,{age:startAge,prison:wasInPrison});
          salary+=settlePayroll(s,marketApi,{date,gross:mul(base.wage,incomeFactor),earned:mul(base.wage,incomeFactor)});
          support+=settleCollegeSupport(s,marketApi,{date,age:startAge,prison:wasInPrison});
        }
      }
      if(salary){s.flags.career_history=true;notes.push(`经过的发薪日与养老金合计到账 ${salary/100} 元；未到发薪日的工资继续保留。`);}
      if(support)notes.push(`大学期间家里按月发放生活费，本期到账 ${support/100} 元。`);
      for (const b of wasInPrison ? [] : s.businesses) {
        const demand = 0.65 + draw(s) * 0.7;
        const attended = b.managedTurn === s.turn - 1 ? 1.15 : 0.9;
        const endDay=debtClock(s).day+Math.max(0,months*30-debtClock(s).periodDays);
        const heldMonths=b.openedLifeDay===undefined?months:Math.min(months,Math.max(0,endDay-b.openedLifeDay)/30);
        const profit = mul(b.monthlyProfit, heldMonths * demand * attended * incomeFactor);
        if (profit >= 0) cashChange(s, profit, `${b.name}净经营回款`); else charge(s, -profit, `${b.name}经营亏损`);
        const oldValue = b.value;
        if (draw(s) < 0.08) { const loss = mul(b.value, 0.2); charge(s, loss, `${b.name}库存和客户坏账`); b.value = mul(b.value, 0.8); b.monthlyProfit = mul(b.monthlyProfit, 0.85); notes.push(`${b.name}出现库存或回款损失。`); }
        else { b.value = mul(b.value, 0.98 + demand * 0.035); b.monthlyProfit = mul(b.monthlyProfit, 0.98 + demand * 0.025); }
        if (b.value !== oldValue) record(s, 'business', b.value - oldValue, `${b.name}经营资产估值`);
      }
      const living = mul(outgoingExpense, Math.max(0,months*30-(s.survival?.days||0))/30); charge(s, living, '基本生活费欠款'); notes.push(`本期 ${months} 个月必要生活费补结 ${living / 100} 元，已日结 ${s.survival?.livingAccrued/100||0} 元不重复收取。`);
      livingPlanEffects(s,Math.max(0,months*30-debtClock(s).periodDays),marketApi,{age:startAge,prison:wasInPrison});
      const unexpected=advanceLivingCosts(s,Math.max(0,months*30-debtClock(s).periodDays),marketApi,{age:startAge,prison:wasInPrison});if(unexpected)notes.push(unexpected);
      advanceDebtClock(s,Math.max(0,months*30-debtClock(s).periodDays),marketApi,notes);
      // 新签借款已按月履约；旧档借款保持原来的阶段条款。
      // 每笔存量借款按经过月份计息；当回合新形成的欠款从下一回合起计息。
      for (const d of [...s.debts]) {
        if (d.calendar || d.createdTurn === s.turn) continue;
        const interest = mul(d.principal, d.aprBps / 10000 * months / 12);
        d.interest = checked(d.interest + interest); if (interest) record(s, 'debt', interest, `${d.name}本回合单利`, { debtId: d.id });
        const duePrincipal = d.monthsLeft > 0 ? Math.min(d.principal, mul(d.principal, Math.min(months, d.monthsLeft) / d.monthsLeft)) : d.principal;
        const due = checked(duePrincipal + d.interest);
        const paid = payDebt(s, Math.min(s.cash, due), d.id);
        d.monthsLeft = Math.max(0, d.monthsLeft - months);
        if (s.debts.includes(d) && paid < due) {
          d.overdue = true; stat(s, { credit: -5, stress: 5 }); notes.push(`${d.name}本期不足 ${Math.round((due - paid) / 100)} 元，债务继续保留。`);
          if(['family','friend'].includes(d.kind)){stat(s,{trust:-6});notes.push('欠着的人情债没有兑现，人缘下降 6 点。');}
          if(d.kind==='shark'){stat(s,{stress:10,health:-2});notes.push('催收电话打乱了生活，压力增加 10 点，健康下降 2 点；尚欠本息继续保留。');}
          if(d.kind==='card'){stat(s,{credit:-5});notes.push('信用卡额度被冻结，信用额外下降 5 点；套现欠款仍需归还。');}
          if (d.kind === 'mortgage') {
            d.overdueTurns = (d.overdueTurns || 0) + 1;
            if (d.overdueTurns >= 2) {
              const p = s.positions.find(p => p.id === d.collateralId);
              if (p) { closePosition(s, p, mul(p.value, 0.7), '按揭逾期房屋处置'); notes.push('连续断供后，房屋折价处置抵债；不足部分仍需偿还。'); }
            }
          }
        } else if (s.debts.includes(d)) { d.overdue = false; d.overdueTurns = 0; }
      }
      stat(s, { health: s.stats.stress > 75 ? -3 : s.age >= 60 ? -1 : 0, stress: income(s) >= expense(s) ? -1 : 2 });
      if (s.stats.health < 40) s.flags.ever_low_health = true;
      if (!wasInPrison && s.age >= 65 && startAge < 65 && s.monthlyIncome > 0) { s.retirementIncome = mul(s.monthlyIncome, 0.35); s.monthlyIncome = s.retirementIncome; s.occupation = '退休';s.behavior.leaveDays=0;s.behavior.jobStartsTomorrow=false; notes.push('你办理了退休，后续领取原工资 35% 的游戏内养老金；仍可以重新求职。'); }
    }
    advanceLifeDays(s,marketApi,notes);
    advanceLegal(s, months, wasInPrison, notes);
    if(startAge>=18)advanceBehaviorDays(s,Math.max(0,months*30-(s.survival?.days||0)),marketApi);
    s.debtClock??=newDebtClock();s.debtClock.periodDays=0;s.debtClock.dailyMode=false;s.debtClock.dailyWork=false;s.behavior??=newBehavior();s.behavior.lostWages=0;
    resetSurvivalPeriod(s);
    resetTradingPeriod(s,marketApi,notes);
    if(s.age>=18&&s.age<80)executePlans(s,marketApi,notes);
    if (s.riskExitTurn !== null && s.turn - s.riskExitTurn >= 2) s.flags.voluntary_exit = true;
    sync(s);
    s.debtFreeTurns = debtTotal(s) === 0 ? s.debtFreeTurns + 1 : 0;
    s.netWorthHistory.push({ turn: s.turn, age: s.age, value: getMetrics(s).netWorth });
    const beforeMetrics = getMetrics(state), afterMetrics = getMetrics(s);
    const cashEntries = s.ledger.slice(state.ledger.length).filter(e => e.account === 'cash');
    const receipt = { cashIn: sum(cashEntries.filter(e => e.amount > 0).map(e => e.amount)), cashOut: Math.abs(sum(cashEntries.filter(e => e.amount < 0).map(e => e.amount))), cashDelta: afterMetrics.cash - beforeMetrics.cash, netWorthDelta: afterMetrics.netWorth - beforeMetrics.netWorth, debtDelta: afterMetrics.debt - beforeMetrics.debt };
    s.lastTurnSummary = { receipt, months, fromAge: startAge, toAge: s.age, shockId: shock?.id || null, notes };
    return commit(state, s, `${s.age} 岁，日子翻过一页`, notes.join('\n') || '这一阶段没有大起大落，你又长大了一些。', { months, shockId: shock?.id || null });
  } catch (error) { return failed(state, error); }
}

/** Select a ledger-based epilogue without changing assets, debts, cases or RNG. */
export function settleRiskEpilogue(state){
  if(state.riskLife?.terminal)return state; // Preserve completed legacy records.
  const s=clone(state),kind=riskEndingKind(s,getEndingMetrics(s));
  s.flags.gambling_final_loss=kind==='gambling';
  s.flags.allin_final_loss=kind==='allin';
  return s;
}
