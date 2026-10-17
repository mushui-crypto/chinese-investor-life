import {migrateSchemeStoryChoices} from './scheme-save-migration.js';
import {validateSchemeLife} from './scheme-life.js';
import {validateCryptoLifeFinance} from './crypto-life-finance.js';
import {validateCryptoLife,cryptoLifeSummary} from './crypto-life.js';
import {validateOnlineGambling} from './online-gambling.js';
import {validateStudentStories} from './student-stories.js';
import {validateFamily} from './family-life.js';
import {validateJobSearch} from './job-search.js';
import {validateMarketNotices} from './market-notices.js';
import {repairLegacyWipeouts} from './legacy-wipeout.js';
import {validateStagePlan} from './stage-plan.js';
import {validateAttendance} from './attendance.js';
import {migrateFamilyGift} from './family-gift.js';
import {validateLivingPlan} from './living-plan.js';
import {validateRoutinePlan} from './routine-plan.js';
import {validateChapters} from './life-chapters.js';
import {validateWorkStories} from './work-stories.js';
import {validatePeople} from './people.js';
import {ECONOMY_REVISION,jobMonthlyPay,validateWorkEconomy} from './work-economy.js';
import {validateEmployment} from './employment.js';
import {validatePayroll} from './payroll.js';
import {validateCollegeSupport} from './college-support.js';
import {validateLivingCosts} from './living-costs.js';
import {validateRoutine} from './day-routine.js';
import {validGameDate} from './game-calendar.js';
import {CRYPTO_LEVERAGES,memeKind,isRugged,cryptoClock} from './crypto-markets.js';
import {validateDailyQuotes} from './daily-quotes.js';
import {validateRiskLife} from './risk-ending.js';
import {validateIntelligence} from './market-intelligence.js';
import {POCKET_MONEY_AGE,validateChildhood} from './childhood-state.js';
import {validateLifeArcs,captureWage} from './life-arcs.js';
import {validateJourney} from './play-guide.js';
import {stockMarket,stockLot,stockInstrument,validateStockWorld} from './stock-markets.js';
import {validateDebtClock} from './debt-calendar.js';
import {validateBehavior} from './behavior.js';
import {validateSurvival} from './survival.js';
import {validateGambling} from './gambling.js';
import { getMetrics, getEndingMetrics, PRODUCTS } from './core.js';
import { createLegalState, getLegalStatus, validateLegalState } from './legal.js';
import {newTrading,INSTRUMENTS} from './market-play.js';
import {HISTORY_WINDOWS} from './crypto-history.js';
import {isCollegeStudent,validateEducation} from './education.js';
export const SAVE_VERSION = 1;
const PREFIX = 'cng-v1', MAX_RECORDS = 20_000, MAX_FILE_CHARS = 20_000_000;
let catalog = null;

/** Install the already-loaded catalog before using save slots or importing files. */
export function setSaveCatalog(value) {
  if (!value || !['events', 'families', 'history', 'endings'].every(key => Array.isArray(value[key]) && value[key].length)) throw Error('请先完整加载剧情目录，再使用存档。');
  catalog = { events: new Map(value.events.map(x => [x.id, x])), families: new Set(value.families.map(x => x.id)), history: new Map(value.history.map(x => [x.id, x])), endings: new Map(value.endings.map(x => [x.id, x])) };
}
export function checksum(text) { let hash = 2166136261; for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16); }
function fail(label) { throw Error(`存档中的${label}缺失、损坏或超出范围。`); }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(label); return value; }
function text(value, label, max = 10_000, empty = false) { if (typeof value !== 'string' || value.length > max || (!empty && !value.length)) fail(label); return value; }
function number(value, label, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) { if (!Number.isFinite(value) || value < min || value > max) fail(label); return value; }
function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(value) || value < min || value > max) fail(label); return value; }
function bool(value, label) { if (typeof value !== 'boolean') fail(label); }
function money(value, label, signed = false) { return integer(value, `${label}金额`, signed ? -Number.MAX_SAFE_INTEGER : 0); }
function array(value, label, max = MAX_RECORDS) { if (!Array.isArray(value) || value.length > max) fail(label); return value; }
function optional(value, validate) { if (value !== undefined && value !== null) validate(value); }
function ids(values, label, valid, unique = true) { array(values, label); for (const id of values) { text(id, label, 150); if (valid && !valid.has(id)) fail(`${label}引用`); } if (unique && new Set(values).size !== values.length) fail(`${label}重复记录`); }
function recordIds(items, label) { array(items, label); const seen = new Set(); for (const item of items) { object(item, label); text(item.id, `${label}编号`, 200); if (seen.has(item.id)) fail(`${label}重复编号`); seen.add(item.id); } }
function progress(item, label) { integer(item.turn, `${label}回合`, 0, 10_000); number(item.age, `${label}年龄`, 0, 80); }
function safeTree(value, ancestors = new Set(), depth = 0, budget = { nodes: 0 }) {
  if (depth > 40 || ++budget.nodes > 500_000) fail('记录大小');
  if (value === undefined || value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('非有限数值'); return; }
  if (typeof value !== 'object' || ancestors.has(value)) fail('对象结构');
  if (!Array.isArray(value)) object(value, '对象结构');
  ancestors.add(value);
  for (const [key, child] of Object.entries(value)) { if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('对象字段'); safeTree(child, ancestors, depth + 1, budget); }
  ancestors.delete(value);
}
function choiceRecord(eventId, choiceId, outcomeId, label) { const event = catalog.events.get(eventId); if (!event) fail(`${label}事件引用`); const choice = event.choices.find(x => x.id === choiceId); if (!choice) fail(`${label}选项引用`); if (!choice.outcomes.some(x => x.id === outcomeId)) fail(`${label}结果引用`); }
function endingRecord(ending, label) { object(ending, label); if (!catalog.endings.has(ending.id)) fail(`${label}引用`); text(ending.title, label); text(ending.epilogue, label); array(ending.open_directions, label, 20).forEach(x => text(x, label)); }
function resultRecord(value) {
  object(value, '结算反馈'); text(value.title, '反馈标题'); text(value.text, '反馈正文', 50_000, true);
  optional(value.error, x => text(x, '反馈错误')); optional(value.details, x => text(x, '反馈详情', 50_000, true));
  optional(value.changes, changes => array(changes, '资金变化', 100).forEach(change => { object(change, '资金变化'); text(change.label, '资金变化标签'); money(change.value, '资金变化', true); }));
  optional(value.investmentChanges, changes => array(changes, '投资结算变化', 100).forEach(change => { object(change,'投资结算变化'); if(!['venture','illiquid','freeze_investment','crypto_life'].includes(change.op))fail('投资结算类型'); text(change.profile,'投资类别'); money(change.value,'投资结算金额',true); }));
  optional(value.context,c=>{object(c,'结果场景');if(!['investment','study','observe','life'].includes(c.activity))fail('结果活动');text(c.profile,'结果类别',100,true);bool(c.marketRelated,'市场场景');if(c.activity==='investment'){if(!['realized','valuation','frozen'].includes(c.settlement))fail('结算状态');if(c.pnl!==null)money(c.pnl,'结算盈亏',true);}});
  optional(value.statChanges, changes => array(changes, '属性变化', 20).forEach(change => { object(change, '属性变化'); text(change.key, '属性变化标签'); number(change.value, '属性变化', -100, 100); }));
  optional(value.sceneContext, c => { object(c,'日常场景'); integer(c.day,'场景日期',0); integer(c.stage,'场景时段',0,8); text(c.action,'场景动作',60); optional(c.event,x=>text(x,'场景事件',80)); optional(c.choice,x=>text(x,'场景选择',80)); });
  optional(value.routineRun, r => { object(r, '作息回执'); integer(r.days,'作息天数',0,30); integer(r.steps,'作息步数',0,600); text(r.reason,'作息停止原因',5000); array(r.handled,'已处理的小事',60).forEach(h=>{object(h,'小事记录');integer(h.day,'小事日期',1,30);text(h.title,'小事标题');text(h.choice,'小事选择');}); });
  if (value.choiceId || value.outcomeId) choiceRecord(value.eventId, value.choiceId, value.outcomeId, '反馈剧情');
}

export function validateState(s) {
  if (!catalog) throw Error('剧情目录尚未加载，请稍后再读取存档。');
  object(s, '存档'); safeTree(s);
  validateWorkEconomy(s);validatePayroll(s);validateCollegeSupport(s);validateAttendance(s);validateChapters(s);validateStagePlan(s);
  if (s.version !== SAVE_VERSION) throw Error('这个存档的版本暂不支持。');
  // v1 saves created before legal stories existed retain their original draws and ledger.
  if (s.legal === undefined) s.legal = createLegalState();
  for (const key of ['id', 'name', 'seed', 'familyName', 'occupation']) text(s[key], `角色${key}`, key === 'seed' ? 1000 : 100);
  if (!catalog.families.has(s.familyId)) fail('家庭引用');
  integer(s.birthYear, '出生年份', 1900, 2026); progress(s, '人生');
  if (!['remix', 'history'].includes(s.mode) || !['event', 'planning', 'result', 'ended'].includes(s.phase)) fail('进度状态');
  integer(s.rng, '随机种子状态', 0, 0xffffffff); integer(s.actionPoints, '精力', 0, 2);
  for (const key of ['cash', 'familyReserve', 'adultGift', 'peakNetWorth', 'monthlyIncome', 'realizedEquityProceeds']) money(s[key], key);
  for (const key of ['giftReceived', 'investmentHistory']) bool(s[key], key);
  for (const key of ['wipeouts', 'debtFreeTurns', 'serial', 'repairCount', 'restStreak']) integer(s[key], key);
  optional(s.wipeoutEvidence,e=>{object(e,'归零依据');if(e.version!==1||e.capitalAfter!==0)fail('归零依据');integer(e.turn,'归零回合',0,s.turn);integer(e.count,'归零次数',1);integer(e.capitalBefore,'归零前资金',1);});
  if (s.riskExitTurn !== null) integer(s.riskExitTurn, '封盘回合', 0, s.turn);
  optional(s.retirementIncome, value => money(value, '养老金'));
  object(s.stats, '人物状态'); validateEducation(s); for (const key of ['health', 'stress', 'academic', 'discipline', 'skill', 'insight', 'trust', 'fame', 'credit']) number(s.stats[key], `人物状态${key}`, 0, 100);
  object(s.flags, '剧情标记'); for (const [key, value] of Object.entries(s.flags)) { text(key, '标记名称', 100); bool(value, `标记${key}`); }
  optional(s.household?.childBornAge, age=>number(age,'子女出生时年龄',0,s.age));
  object(s.household, '家庭成员'); for (const key of ['partner', 'hasChild', 'livingParent']) bool(s.household[key], `家庭成员${key}`);
  if (s.marketProgress === undefined) {
    const kinds = new Set(s.positions.map(p => p.kind));
    const byProfile = { stock:'stock', allin:'stock', fund:'fund', options:'option', option_sell:'option_short', contract:'futures', crypto:'crypto', ponzi:'ponzi', angel:'angel', housing:'housing' };
    // Honor actually experienced products in legacy saves, without changing money or locked outcomes.
    const ages = [];
    for (const h of s.storyHistory ?? []) { const e = catalog.events.get(h.eventId); const c = e?.choices.find(c => c.id === h.choiceId); const o = c?.outcomes.find(o => o.id === h.outcomeId); if (byProfile[c?.profile] && o?.effects.some(x => ['venture','illiquid','freeze_investment'].includes(x.op))) { kinds.add(byProfile[c.profile]); ages.push(h.age); } }
    for (const entry of s.ledger ?? []) if (entry.account === 'cash' && entry.amount < 0 && entry.label?.startsWith('投入')) ages.push(entry.age);
    s.marketProgress = { firstExperienceAge: ages.length ? Math.min(...ages) : null, simulations:0, unlocked:Object.fromEntries([...kinds].map(k => [k,true])) };
  }
  validateMarketNotices(s,fail);
  object(s.marketProgress, '市场经历');
  if (s.marketProgress.firstExperienceAge !== null) number(s.marketProgress.firstExperienceAge, '首次市场经历', 18, s.age);
  integer(s.marketProgress.simulations, '模拟次数', 0, 20000);
  object(s.marketProgress.unlocked, '已开通市场'); for (const [kind,value] of Object.entries(s.marketProgress.unlocked)) { if (!PRODUCTS[kind]) fail('市场权限引用'); bool(value,'市场权限'); }
  if(s.trading===undefined)s.trading=newTrading(s);
  const t=s.trading;object(t,'交易时钟');integer(t.day,'交易日',0,1000000);integer(t.dayInTurn,'本期交易日',0,2);integer(t.phase,'盘中阶段',0,3);integer(t.energy,'日内操作次数',0,6);
  if(t.calendar!==undefined){object(t.calendar,'游戏日期');integer(t.calendar.turn,'日期回合',0,s.turn);integer(t.calendar.day,'日期交易日',0,t.day);if(!validGameDate(t.calendar.date))fail('游戏日期');}
  validateStockWorld(s,fail);validateIntelligence(s);
  if(t.cryptoReplay===undefined)t.cryptoReplay=null;
  if(t.cryptoReplay!==null){object(t.cryptoReplay,'历史行情');if(!HISTORY_WINDOWS.some(w=>w.id===t.cryptoReplay.scenario))fail('历史行情时段');integer(t.cryptoReplay.step,'历史行情进度',0,9);optional(t.cryptoReplay.lastClock,v=>integer(v,'行情发生时间',0,cryptoClock(s)));optional(t.cryptoReplay.anchors,a=>{object(a,'行情锚点');const w=HISTORY_WINDOWS.find(w=>w.id===t.cryptoReplay.scenario);if(Object.keys(a).length!==Object.keys(w.symbols).length)fail('行情锚点');for(const id of Object.keys(w.symbols))integer(a[id],'行情锚点',1);});}
  optional(t.cryptoEncounter,e=>{object(e,'加密事件');if(!['waiting','quiet','active','done'].includes(e.status)||!(e.scenario===null||HISTORY_WINDOWS.some(w=>w.id===e.scenario))||(e.status==='quiet')!==(e.scenario===null))fail('加密事件');integer(e.due,'事件日期',0,cryptoClock(s)+6);});
  optional(t.memeProjects,p=>{object(p,'Meme 项目');for(const [id,v] of Object.entries(p)){if(memeKind(s,id)!=='rug')fail('Meme 项目');object(v,'项目进度');integer(v.due,'项目日期',0,cryptoClock(s)+6);bool(v.failed,'项目归零');}});
  object(t.stockCards,'行情卡');for(const key of ['bull','bear'])integer(t.stockCards[key],'卡片余量',0,1);if(t.cardUsedDay!==null)integer(t.cardUsedDay,'出牌日期',0,t.day);text(t.stockNews,'股票消息',5000);object(t.influences,'卡片影响');for(const [key,v] of Object.entries(t.influences)){if(!INSTRUMENTS.stock.some(i=>'stock:'+i.id===key)||![-.06,.06].includes(v))fail('行情卡影响');}
  object(t.quotes,'行情');for(const [key,q] of Object.entries(t.quotes)){text(key,'行情标的',64);object(q,'报价');const min=isRugged(s,key)?0:1;integer(q.price,'最新价格',min);integer(q.open,'开盘价格',min);if(min===0&&q.price!==0)fail('归零项目报价');optional(q.baseUSDT,v=>number(v,'历史基准价格',Number.MIN_VALUE));optional(q.scale,v=>integer(v,'历史价格精度',1));if((q.baseUSDT===undefined)!==(q.scale===undefined))fail('历史报价基准');array(q.history,'行情轨迹',24).forEach(n=>integer(n,'历史价格',min));validateDailyQuotes(s,q,q.price,min===0);}
  object(t.research,'研究记录');for(const [key,day] of Object.entries(t.research)){text(key,'研究对象',100);integer(day,'研究日期',0,t.day);}
  array(t.journal,'交易记录',60).forEach(j=>{
    integer(j.day,'交易记录日期',0,t.day);integer(j.phase,'记录阶段',0,3);text(j.text,'交易记录正文',5000);
    optional(j.date,v=>{if(!validGameDate(v))fail('成交日期');});optional(j.clock,v=>text(v,'成交时段',32));
    optional(j.crypto,c=>{object(c,'加密成交');if(!['crypto','crypto_perp'].includes(c.product)||!['buy','sell','open','close','liquidation','settlement'].includes(c.action))fail('加密成交类型');text(c.instrument,'成交币种',64);text(c.name,'成交名称',160);integer(c.cashFlow,'成交资金变化',-Number.MAX_SAFE_INTEGER);optional(c.pnl,v=>integer(v,'成交盈亏',-Number.MAX_SAFE_INTEGER));optional(c.direction,v=>{if(!['long','short'].includes(v))fail('成交方向');});optional(c.leverage,v=>integer(v,'成交杠杆',1,1000));});
  });
  array(t.plans,'定投计划',6).forEach(p=>{if(!INSTRUMENTS.fund.some(i=>i.id===p.instrument))fail('定投标的');integer(p.amount,'定投金额',100000);});
  if(new Set(t.plans.map(p=>p.instrument)).size!==t.plans.length)fail('重复定投');
  validateGambling(t.gambling,t.day);
  validateSurvival(s);validateRoutine(s);validateLivingPlan(s);validateRoutinePlan(s);validateWorkStories(s);validateLivingCosts(s);validateDebtClock(s);validateEmployment(s);validateJobSearch(s);validateBehavior(s);validateOnlineGambling(s);validateCryptoLife(s);validateSchemeLife(s);validateCryptoLifeFinance(s);validateJourney(s);validateLifeArcs(s);validateChildhood(s);validateStudentStories(s);validateRiskLife(s);
  object(s.relationships, '人物关系'); for (const [key, value] of Object.entries(s.relationships)) { text(key, '关系名称', 100); number(value, '人物关系', 0, 100); }
  object(s.markets, '市场指数'); for (const key of ['stock', 'bond', 'crypto', 'housing']) integer(s.markets[key], `市场指数${key}`, 1);
  for (const [key, value] of Object.entries(s.markets)) { text(key, '市场标的', 64); integer(value, '市场指数', isRugged(s,key)?0:1); }
  ids(s.appliedEffectIds, '已结算效果');
  if (s.presentations === undefined) s.presentations = [];
  recordIds(s.presentations, '人生时刻');
  for (const p of s.presentations) {
    if (!['wealth', 'wipeout', 'judgment', 'release'].includes(p.kind)) fail('人生时刻类别');
    progress(p, '人生时刻'); money(p.amount, '人生时刻金额'); integer(p.months, '人生时刻月份', 0, 20000);
  }
  optional(s.lastTurnSummary?.receipt, r => { object(r, '本期账本'); for (const key of ['cashIn','cashOut','cashDelta','netWorthDelta','debtDelta']) money(r[key], '本期账本' + key, key.endsWith('Delta')); });

  recordIds(s.positions, '持仓'); recordIds(s.debts, '债务'); recordIds(s.claims, '债权'); recordIds(s.businesses, '经营资产');
  for (const p of s.positions) {
    optional(p.optionTimeValue,x=>money(x,'期权时间价值'));optional(p.optionRemainingAtOpen,x=>number(x,'期权开仓剩余期限',1/3,5));
    text(p.name, '资产名称'); if (!PRODUCTS[p.kind]) fail('资产种类');
    money(p.cost, '持仓成本'); money(p.value, '持仓估值'); integer(p.lockUntilTurn, '解锁回合', 0, 20_000);
    text(p.underlying, '投资标的', 64); integer(p.entryPrice, '入场价格', 1); integer(p.lastPrice, '标记价格', p.underlying === 'WTI_2020_05' ? -Number.MAX_SAFE_INTEGER : 0);
    optional(p.units, x => money(x, '持有份额')); optional(p.frozen, x => bool(x, '冻结标记')); optional(p.storyValuation, x => bool(x, '剧情估值标记'));
    optional(p.openedTurn, x => integer(x, '开仓回合', 0, s.turn)); optional(p.openedLifeDay,x=>integer(x,'买入生活日',0,s.debtClock?.day||0)); optional(p.suspendedUntilTurn, x => integer(x, '停牌回合', 0, 20_000));
    optional(p.openedDay,x=>integer(x,'开仓交易日',0,t.day));optional(p.availableDay,x=>{integer(x,'可卖交易日',0,t.day+1);if(!['stock','fund'].includes(p.kind)||x!==p.openedDay+(p.kind==='fund'?1:stockMarket(p).sellDelay))fail('T+1 日期');});
    optional(p.instrument,x=>text(x,'产品标的',64));optional(p.managed,x=>bool(x,'交易室持仓'));optional(p.fundStyle,x=>{if(!INSTRUMENTS.fund.some(i=>i.id===x))fail('基金风格');});
    optional(p.shares,x=>{integer(x,'股票股数',stockLot(p));if(p.kind!=='stock'||x%stockLot(p)!==0)fail('股票交易手数');});
    if(p.kind==='stock'&&p.managed){const i=stockInstrument(p.underlying);if(!i||i.id!==p.instrument)fail('股票所属市场');}
    optional(p.honeypot,x=>{bool(x,'貔貅币标记');if(p.kind!=='crypto'||memeKind(s,p.instrument)!=='honey'||p.value!==0)fail('貔貅币估值');money(p.bookBalance,'骗局账面');});optional(p.historyPricedTurn,x=>integer(x,'历史价格结算回合',0,s.turn));
    optional(p.couponBps,x=>integer(x,'债券票息',0,10000));optional(p.maturityAge,x=>number(x,'债券到期年龄',0,100));optional(p.rentBps,x=>integer(x,'租金率',0,10000));optional(p.renovated,x=>bool(x,'装修状态'));
    optional(p.mortgageId, x => { if (!s.debts.some(d => d.id === x)) fail('房屋按揭引用'); });
    if (['option', 'option_short', 'futures','crypto_perp'].includes(p.kind)) { if (!['long', 'short'].includes(p.direction)) fail('合约方向'); money(p.units, '合约名义本金'); money(p.margin, '保证金'); }
    if (p.kind === 'futures') { if (![2, 5, 10].includes(p.leverage)) fail('合约杠杆'); money(p.liquidation, '维持保证金'); money(p.feesPaid, '资金费用'); }
    if(p.kind==='crypto_perp'){if(!CRYPTO_LEVERAGES.includes(p.leverage)||p.sameDay!==true)fail('加密日内合约规则');money(p.liquidation,'维持保证金');money(p.feesPaid,'日内费用');integer(p.openedDay,'日内开仓日',0,t.day);}
    if (p.kind === 'option' || p.kind === 'option_short') { integer(p.strike, '行权价格', 1);if(p.expiryDay!==undefined){integer(p.expiryDay,'期权到期交易日',0,t.day+4);if(![1,3,5].includes(p.optionDays))fail('期权期限');}else integer(p.expiryTurn, '期权到期回合', 0, 20_000); }
    if (p.kind === 'option_short') { money(p.premium, '卖方权利金'); bool(p.premiumPaid, '权利金状态'); }
    if (p.kind === 'ponzi') { money(p.bookBalance, '平台账面余额'); money(p.withdrawals, '平台已提现'); }
    optional(p.ownershipBps, x => integer(x, '股权份额', 0, 10_000));
  }
  for (const d of s.debts) {
    text(d.name, '债务名称'); text(d.purpose, '借款用途'); text(d.kind, '债务类型', 50);
    for (const key of ['principal', 'interest', 'originalPrincipal', 'paid']) money(d[key], `债务${key}`);
    integer(d.aprBps, '借款年利率', 0, 100_000); integer(d.monthsLeft, '借款剩余月份', 0, 120_000); bool(d.overdue, '逾期状态'); integer(d.createdTurn, '债务创建回合', 0, s.turn);
    optional(d.overdueTurns, x => integer(x, '连续逾期回合')); optional(d.collateralId, x => { if (!s.positions.some(p => p.id === x)) fail('抵押品引用'); });
  }
  for (const c of s.claims) { text(c.name, '债权名称'); for (const key of ['face', 'value', 'recovered']) money(c[key], `债权${key}`); if (c.value > c.face) fail('债权估值'); integer(c.createdTurn, '债权创建回合', 0, s.turn); }
  for (const b of s.businesses) { text(b.name, '生意名称'); money(b.value, '经营资产'); money(b.monthlyProfit, '月经营利润', true); integer(b.managedTurn, '经营管理回合', 0, s.turn); integer(b.openedTurn, '开业回合', 0, s.turn); optional(b.openedLifeDay,x=>integer(x,'开业生活日',0,s.debtClock?.day||0)); }
  recordIds(s.guarantees, '担保'); for (const g of s.guarantees) { money(g.limit, '担保额度'); bool(g.called, '担保追索状态'); }
  const globalIds = [...s.positions, ...s.debts, ...s.claims, ...s.businesses, ...s.guarantees].map(item => item.id); if (new Set(globalIds).size !== globalIds.length) fail('资产与负债重复编号');

  recordIds(s.logs, '人生日志'); for (const item of s.logs) { progress(item, '日志'); text(item.title, '日志标题'); text(item.text, '日志正文', 50_000, true); if (!['story', 'income', 'loss', 'system'].includes(item.kind)) fail('日志类型'); }
  recordIds(s.ledger, '账本'); for (const item of s.ledger) { progress(item, '账本'); money(item.amount, '账本', true); text(item.label, '账本说明'); if(item.date!==undefined&&!validGameDate(item.date))fail('账本日期'); if(item.lifeDay!==undefined&&(!Number.isSafeInteger(item.lifeDay)||item.lifeDay<0))fail('账本日期'); if(item.storyStake!==undefined&&typeof item.storyStake!=='boolean')fail('剧情投入标记'); if (!['cash', 'debt', 'position', 'claim', 'business'].includes(item.account)) fail('账本账户'); }
  array(s.netWorthHistory, '净值记录'); for (const item of s.netWorthHistory) { object(item, '净值记录'); progress(item, '净值记录'); money(item.value, '历史净值', true); }
  ids(s.seenEvents, '已发生事件', catalog.events); ids(s.eventQueue, '事件队列', catalog.events); ids(s.dueAnchors, '待发生章节', catalog.events);
  for (const id of s.dueAnchors) if (catalog.events.get(id).kind !== 'anchor') fail('待发生章节类型');
  ids(s.discoveredHistory, '历史图鉴', catalog.history);
  array(s.pending, '预约剧情'); for (const item of s.pending) { object(item, '预约剧情'); if (!catalog.events.has(item.eventId)) fail('预约事件引用'); integer(item.dueTurn, '预约回合', 0, 20_000); integer(item.expiresTurn, '预约有效期', item.dueTurn, 20_000); optional(item.reason, x => text(x, '预约原因')); optional(item.sourceEventId, x => { if (!catalog.events.has(x)) fail('预约来源'); }); }
  array(s.storyHistory, '剧情记录'); for (const item of s.storyHistory) { object(item, '剧情记录'); progress(item, '剧情记录'); choiceRecord(item.eventId, item.choiceId, item.outcomeId, '剧情记录'); text(item.title, '剧情标题'); text(item.choice, '剧情选择'); text(item.text, '剧情结果', 50_000, true); }
  object(s.runStats, '人生统计'); const r = s.runStats;
  // Scheduler fields introduced with the legal-story expansion are optional in old v1 files.
  for (const key of ['legalNoticeIds', 'legalMilestones', 'deferredEvents']) if (r[key] === undefined) r[key] = [];
  ids(r.legalNoticeIds, '案件通知队列', catalog.events); ids(r.deferredEvents, '延期事件', catalog.events);
  array(r.legalMilestones, '案件进度记录');
  for (const item of r.legalMilestones) {
    object(item, '案件进度记录'); progress(item, '案件进度');
    if (!Array.isArray(s.legal?.cases) || !s.legal.cases.some(c => c.id === item.caseId) || !['pending', 'exposed', 'investigating', 'convicted', 'admin_closed'].includes(item.status)) fail('案件进度引用');
  }
  for (const key of ['choices', 'actions']) integer(r[key], `人生统计${key}`);
  for (const key of ['categoryCounts', 'interests']) { object(r[key], `人生统计${key}`); for (const value of Object.values(r[key])) integer(value, `人生统计${key}`); }
  ids(r.worldQueue, '历史队列', catalog.history); ids(r.shocksApplied, '已发生历史冲击', catalog.history);
  array(r.remixPlan, '时代乱流计划', 24); for (const item of r.remixPlan) { object(item, '时代计划'); if (!catalog.history.has(item.eventId)) fail('时代计划事件引用'); number(item.age, '时代计划年龄', 0, 80); }
  array(r.expiredChains, '过期支线'); for (const item of r.expiredChains) { object(item, '过期支线'); if (!catalog.events.has(item.eventId)) fail('过期支线引用'); integer(item.turn, '支线过期回合', 0, s.turn); }
  array(r.worldLog, '世界事件记录'); for (const item of r.worldLog) { object(item, '世界事件记录'); progress(item, '世界事件'); if (!catalog.history.has(item.eventId) || !['remix', 'history'].includes(item.mode)) fail('世界事件引用'); text(item.historicalDate, '世界事件日期', 30); }
  array(r.settlements, '人生结算记录'); for (const item of r.settlements) { object(item, '结算记录'); progress(item, '结算记录'); if (!catalog.endings.has(item.endingId)) fail('结算结局引用'); ids(item.matchedIds, '结算多重结局', catalog.endings); money(item.netWorth, '结算净资产', true); }

  if (s.activeEvent !== null) {
    object(s.activeEvent, '当前剧情'); const event = catalog.events.get(s.activeEvent.eventId); if (!event) fail('当前剧情引用');
    optional(s.activeEvent.instanceId, id=>{text(id,'剧情实例',200);if(!(event.onlineGambling||event.cryptoLife)||!id.startsWith(`${event.cryptoLife?'crypto':'online'}:${event.id}:`))fail('剧情实例');});
    object(s.activeEvent.outcomes, '当前剧情预先确定的结果'); if (Object.keys(s.activeEvent.outcomes).length !== event.choices.length) fail('当前剧情结果数量');
    for (const choice of event.choices) choiceRecord(event.id, choice.id, s.activeEvent.outcomes[choice.id], '当前剧情');
  }
  if (s.phase === 'event') {
    const active=s.activeEvent,event=active&&catalog.events.get(active.eventId);
    const repeat=(event?.schemeLife||event?.onlineGambling?.repeatable||event?.cryptoLife?.repeatable)&&active.instanceId&&!s.appliedEffectIds.includes(active.instanceId);
    if(!active||s.seenEvents.includes(active.eventId)&&!repeat||active.instanceId&&s.appliedEffectIds.includes(active.instanceId))fail('当前剧情与进度');
  }
  if (['planning', 'ended'].includes(s.phase) && s.activeEvent !== null) fail('当前剧情与阶段');
  if (s.phase === 'result' && (!s.lastResult || !s.activeEvent)) fail('待展示剧情结果');
  if (s.lastResult !== null) resultRecord(s.lastResult);
  array(s.matchedEndings, '匹配结局', catalog.endings.size).forEach(value => endingRecord(value, '匹配结局')); if (s.ending !== null) endingRecord(s.ending, '主结局');
  if(s.ending?.id==='E29'&&!s.survival.failed)fail('生存失败结局');
  const cryptoEnding=s.ending?.id==='E34'&&s.flags.crypto_final_loss&&cryptoLifeSummary(s,getEndingMetrics(s)).ending?.id==='bankruptcy';
  if(s.ending?.id==='E34'&&!cryptoEnding)fail('Crypto破产结局');
  if (s.phase === 'ended' && ((s.age < 55 && !(s.age>=18&&(cryptoEnding||s.survival.failed&&(s.ending?.id==='E29'||s.ending?.id==='E31'&&s.riskLife?.terminal?.kind==='gambling')))) || !s.ending || !s.matchedEndings.length)) fail('已结束人生结局');
  if (s.phase !== 'ended' && s.ending !== null) fail('未结算人生的结局');
  optional(s.lastTurnSummary, value => { object(value, '回合小结'); integer(value.months, '回合经过月份', 1, 72); number(value.fromAge, '回合起始年龄', 0, 80); number(value.toAge, '回合结束年龄', value.fromAge, 80); array(value.notes, '回合说明').forEach(note => text(note, '回合说明', 50_000, true)); });
  validatePeople(s,catalog.events);
  validateFamily(s);
  validateLegalState(s.legal, s);
  for (const c of s.legal.cases) if (c.sourceEventId !== null && !catalog.events.has(c.sourceEventId)) fail('案件来源事件');
  const legal = getLegalStatus(s);
  if (legal.inPrison && s.age < 18) fail('未成年服刑状态');
  if (legal.inPrison && s.monthlyIncome !== 0) fail('服刑期间外部工资');
  // Individually valid integers can still overflow when added together.
  try { const metrics = getMetrics(s); for (const key of ['cash', 'assets', 'debt', 'netWorth', 'availableCash', 'monthlyIncome', 'monthlyExpense']) money(metrics[key], `合计${key}`, key === 'netWorth'); } catch { fail('合计资产或债务金额'); }
  return s;
}

export function encodeSave(state) { validateState(state); const payload = JSON.stringify(state); if (payload.length > MAX_FILE_CHARS) fail('文件大小'); return { format: '中国式赌狗', version: SAVE_VERSION, savedAt: new Date().toISOString(), checksum: checksum(payload), state: JSON.parse(payload) }; }
export function decodeSave(value) {
  if (typeof value === 'string' && value.length > MAX_FILE_CHARS) fail('文件大小');
  let wrapper; try { wrapper = typeof value === 'string' ? JSON.parse(value) : value; } catch { throw Error('存档不是完整的 JSON 文件，请重新选择导出的存档。'); }
  if (wrapper?.format !== '中国式赌狗' || wrapper.version !== SAVE_VERSION) throw Error('请导入《中国式赌狗》v1 系列兼容的存档文件。');
  object(wrapper.state, '存档内容'); safeTree(wrapper.state); const payload = JSON.stringify(wrapper.state); if (payload.length > MAX_FILE_CHARS) fail('文件大小');
  if (typeof wrapper.checksum !== 'string' || checksum(payload) !== wrapper.checksum) throw Error('文件校验未通过，可能已损坏或不完整。');
  const restored=JSON.parse(payload);
  migrateSchemeStoryChoices(restored,catalog?.events.get(restored.activeEvent?.eventId));
  const s=validateState(restored);
  repairLegacyWipeouts(s);
  migrateFamilyGift(s);
  if(s.age<POCKET_MONEY_AGE && s.cash>0){
    // Preserve legacy funds in the household, outside the child's spendable cash.
    // cash=0 makes subsequent save/load cycles a no-op; never redraw story outcomes.
    const amount=s.cash, reserve=s.familyReserve+amount;
    money(reserve,'家长保管资金');
    s.familyReserve=reserve;s.cash=0;
    s.ledger.push({id:`entry-${s.turn}-${++s.serial}`,turn:s.turn,age:s.age,account:'cash',amount:-amount,label:'学龄前零花钱改由家长保管'});
    s.logs.push({id:`log-${s.turn}-${++s.serial}`,turn:s.turn,age:s.age,kind:'system',title:'这笔钱由家长保管',text:'满 6 岁后，家里才开始给零花钱。'});
  }
  if(s.economyRevision===undefined){
    // Keep already paid wages/cash/ledger; change only future earnings, once per save.
    captureWage(s);
    s.monthlyIncome=Math.min(s.occupation==='退休'?147000:jobMonthlyPay(s),Math.round(s.monthlyIncome*.5));
    if(s.retirementIncome!==undefined)s.retirementIncome=Math.min(147000,Math.round(s.retirementIncome*.5));
    captureWage(s);
    const offers={shift:[10000,0],repair:[30000,0],referral:[0,280000],apprentice:[0,240000],reentry:[24000,220000],preorder:[70000,0]};
    for(const j of s.lifeArcs.jobs){const terms=offers[j.id];if(terms){j.pay=Math.min(j.pay,terms[0]);j.wage=Math.min(j.wage,terms[1]);}}
    for(const b of s.businesses)if(b.monthlyProfit>0)b.monthlyProfit=Math.round(b.monthlyProfit*.5);
    s.economyRevision=ECONOMY_REVISION;
  }
  if(isCollegeStudent(s)&&s.monthlyIncome>0){
    s.monthlyIncome=0;s.occupation='大学生';s.flags.employed=false;s.behavior.leaveDays=0;s.behavior.jobStartsTomorrow=false;
    s.lifeArcs.wageRate=0;s.lifeArcs.wageAdjustment=0;
    s.logs.push({id:`log-${s.turn}-${++s.serial}`,turn:s.turn,age:s.age,kind:'system',title:'在读期间只做兼职',text:'正式工作将在 22 岁毕业后开放。原有现金保留，固定工资停止计入。'});
  }
  // Older story choices cleared employment even for students with no job.
  // Repair identity only; do not replay events or change cash and paid receipts.
  if(isCollegeStudent(s)&&!s.legal?.prisonMonthsLeft){
    s.occupation='大学生';s.flags.employed=false;s.behavior.leaveDays=0;s.behavior.jobStartsTomorrow=false;
    if(s.employment)Object.assign(s.employment,{active:false,title:'',wage:0,tenure:0});
  }
  return validateState(s);
}
function slotNumber(slot) { integer(slot, '存档槽', 0, 2); }
export function saveSlot(slot, state, store = globalThis.localStorage) { slotNumber(slot); const envelope = encodeSave(state); store.setItem(`${PREFIX}-slot-${slot}`, JSON.stringify(envelope)); return envelope; }
export function loadSlot(slot, store = globalThis.localStorage) { slotNumber(slot); const value = store.getItem(`${PREFIX}-slot-${slot}`); return value ? decodeSave(value) : null; }
export function listSlots(store = globalThis.localStorage) { return [0, 1, 2].map(slot => { try { const raw = store.getItem(`${PREFIX}-slot-${slot}`); const envelope = raw ? JSON.parse(raw) : null; return { slot, state: envelope ? decodeSave(envelope) : null, savedAt: envelope?.savedAt ?? null, error: null }; } catch (error) { return { slot, state: null, error: error.message }; } }); }
export function removeSlot(slot, store = globalThis.localStorage) { slotNumber(slot); store.removeItem(`${PREFIX}-slot-${slot}`); }
export function getSettings() { try { return { sound: false, reduced: false, ...JSON.parse(localStorage.getItem(`${PREFIX}-settings`) || '{}') }; } catch { return { sound: false, reduced: false }; } }
export function setSettings(s) { try { localStorage.setItem(`${PREFIX}-settings`, JSON.stringify(s)); return true; } catch { return false; } }
export function getCollection() { const empty = { events: [], history: [], endings: [], lives: [], lifeMemories: [], completedRuns:[], playtests:[], runs: 0 }; try { const value = JSON.parse(localStorage.getItem(`${PREFIX}-collection`) || '{}'); return { completedRuns:Array.isArray(value.completedRuns)?value.completedRuns.filter(r=>r&&['key','name','family','ending'].every(k=>typeof r[k]==='string')&&['age','worth','peak','wipeouts','markets'].every(k=>Number.isFinite(r[k]))&&(r.opening===null||Number.isSafeInteger(r.opening))).slice(-30):[],playtests:Array.isArray(value.playtests)?value.playtests.filter(r=>r&&typeof r.date==='string'&&typeof r.note==='string').slice(-30):[],lifeMemories:Array.isArray(value.lifeMemories)?value.lifeMemories.filter(x=>x&&typeof x.title==='string'&&typeof x.text==='string').slice(-200):[], lives: Array.isArray(value.lives)?value.lives.filter(x=>typeof x==='string'):[], events: Array.isArray(value.events) ? value.events.filter(x => typeof x === 'string') : [], history: Array.isArray(value.history) ? value.history.filter(x => typeof x === 'string') : [], endings: Array.isArray(value.endings) ? value.endings.filter(x => typeof x === 'string') : [], runs: Number.isSafeInteger(value.runs) && value.runs >= 0 ? value.runs : 0 }; } catch { return empty; } }
export function updateCollection(state) {
  const c = getCollection();
  c.lives=[...new Set([...c.lives,...(state.lifeArcs?.seen||[])])];
  for(const h of state.lifeArcs?.history||[])if(!c.lifeMemories.some(x=>x.title===h.title&&x.text===h.text))c.lifeMemories.push({title:h.title,text:h.text});
  c.lifeMemories=c.lifeMemories.slice(-200);
  c.events = [...new Set([...c.events, ...(state.seenEvents || [])])];
  c.history = [...new Set([...c.history, ...(state.discoveredHistory || []).map(h => typeof h === 'string' ? h : h.id)])];
  if (state.ending) {
    const key=[state.id,state.familyId,state.mode,state.birthYear].join(':');
    c.completedRuns=c.completedRuns.filter(r=>r.key!==key);
    c.completedRuns.push({key,name:state.name,family:state.familyName,path:state.childhood?.summary?.path||null,opening:state.childhood?.summary?.cash??null,age:state.age,ending:state.ending.title,worth:getEndingMetrics(state).netWorth,peak:state.peakNetWorth,wipeouts:state.wipeouts,markets:Object.keys(state.marketProgress?.unlocked||{}).length});c.completedRuns=c.completedRuns.slice(-30);

    const displayedEndings = [state.ending, ...(state.matchedEndings || [])].map(ending => ending?.id).filter(id => typeof id === 'string');
    c.endings = [...new Set([...c.endings, ...displayedEndings])];
  }
  try { localStorage.setItem(`${PREFIX}-collection`, JSON.stringify(c)); } catch {}
  return c;
}

export function savePlaytest(state,answers){const allowed={firstTrade:['不到 1 分钟','1–3 分钟','3–5 分钟','超过 5 分钟','还没完成首单'],recovery:['知道，并实际走通了','知道入口，但还没尝试','找不到或走不通','本次还没遇到亏损'],replay:['已经重开了','想，试试另一条路','暂时不想','还没决定']};for(const [key,values] of Object.entries(allowed))if(!values.includes(answers[key]))throw Error('请按实际体验选择三项反馈');const c=getCollection();c.playtests.push({date:new Date().toISOString(),version:'1.13',run:state?.id||null,age:state?.age??null,...Object.fromEntries(Object.keys(allowed).map(k=>[k,answers[k]])),note:String(answers.note||'').slice(0,1000),source:'player-reported'});c.playtests=c.playtests.slice(-30);localStorage.setItem(`${PREFIX}-collection`,JSON.stringify(c));return c;}
