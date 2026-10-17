import {appendMarketJournal,recordCryptoTrade} from './crypto-records.js';
import {FUTURES_INSTRUMENTS,LEGACY_FUTURES,futuresNoise,futuresInstrument,futurePrice,syncLinkedFutures,moveFx} from './futures-markets.js';
import {optionQuote,optionMark} from './option-pricing.js';
import {tradeTerms,orderLabel} from './trade-terms.js';
import {ensureRoutine,resetRoutineDay,aShareSession} from './day-routine.js';
import {CRYPTO_COINS,MEME_COINS,CRYPTO_LEVERAGES,memeKind,isRugged,growScamBook} from './crypto-markets.js';
import {enterCrypto,advanceCryptoEncounter,settleMemeProjects,hasPendingCrypto} from './crypto-events.js';
import {openDailyQuote,recordDailyQuote} from './daily-quotes.js';
import {ensureGameCalendar,resetGameCalendar} from './game-calendar.js';
import {disclosureMove} from './market-intelligence.js';
import {newGambling,gamblingAvailability,executeGambling} from './gambling.js';
import {STOCKS,stockMarket,stockLot,newStockWorld,openStockDay,stockSegment,markStockSegment} from './stock-markets.js';
/** Fictional trading sessions inside a life period. No network or real orders. */
import {getMarketAccess,getGamblingAccess} from './market-access.js';
import {getLegalStatus} from './legal.js';
import {HISTORY_WINDOWS,replayWindow,historicalSegment,historicalIndex} from './crypto-history.js';
import {recordDisciplineExit,recordDisciplineMargin,recordDisciplineLiquidation} from './behavior.js';
import {cryptoLifeActionReason,executeCryptoLifeEffect} from './crypto-life-finance.js';
import {ensureCryptoLife,advanceCryptoLife,recordCryptoLifeTrade} from './crypto-life.js';

export const DESKS = {
  stock: {title:'股票交易室', subtitle:'选股票，看价格，买入或卖出。', icon:'chart', rule:'A 股 / 港股 / 美股 · 共享操作次数', theme:'stock'},
  fund: {title:'基金理财室', subtitle:'选一个风格，把计划坚持下去。', icon:'book', rule:'次日可赎回 · 赎回费 1%', theme:'fund'},
  bond: {title:'债券柜台', subtitle:'利息有约定，本金也有风险。', icon:'wallet', rule:'按期付息 · 到期兑付或违约', theme:'bond'},
  option: {title:'期权买方席', subtitle:'看对方向，还要赶上时间。', icon:'clock', rule:'权利金有限 · 到期可以归零', theme:'option'},
  option_short: {title:'期权卖方席', subtitle:'签下义务，也留下足够的保证金。', icon:'scales', rule:'保证金交易 · 超额赔付可形成债务', theme:'option'},
  futures: {title:'期货与外汇', subtitle:'金属、能源、农产品、三地指数与汇率。', icon:'chart', rule:'T+0 · 2 / 5 / 10 倍逐仓', theme:'futures'},
  crypto: {title:'币易交易所', subtitle:'夜深了，价格还在跳。', icon:'globe', rule:'现货 T+0 · 合约最高 1000 倍 · 可当日结算', theme:'crypto'},
  ponzi: {title:'熟人的项目群', subtitle:'截图里全是收益，提现却要等通知。', icon:'help', rule:'账面余额不等于现金 · 提现可能失败', theme:'ponzi'},
  angel: {title:'创业路演厅', subtitle:'看见未来之前，先看清这个人。', icon:'spark', rule:'股权锁定 6 回合 · 追加、稀释与退出', theme:'angel'},
  housing: {title:'街角房产行', subtitle:'一把钥匙，也是一张长期账单。', icon:'home', rule:'全款 / 按揭 · 租金、空置与维修', theme:'housing'},
  gambling: {title:'深夜赌局', subtitle:'“最后一把”，你已经说过几次？', icon:'scales', rule:'虚构网赌 · 即时输赢 · 记录与责任保留', theme:'gambling'},
};
export const INSTRUMENTS = {
  stock:STOCKS,
  fund:[{id:'balanced',name:'林间均衡',tag:'股债均衡',vol:.011,note:'经理分散配置，仍有净值回撤。'},{id:'growth',name:'追风成长',tag:'成长风格',vol:.026,note:'更集中于成长股，起落也更大。'},{id:'defensive',name:'慢行防御',tag:'偏债配置',vol:.006,note:'少一些起落，保留现金也会错过上涨。'}],
  bond:[{id:'solid',name:'海临公共事业债',tag:'3% · 12个月',vol:.004,coupon:300,months:12,note:'经营较稳定；信用变化仍可带来损失。'},{id:'industrial',name:'远山制造债',tag:'6% · 24个月',vol:.009,coupon:600,months:24,note:'扩产融资，回款与订单有关。'},{id:'stressed',name:'新城发展债',tag:'9% · 36个月',vol:.018,coupon:900,months:36,note:'现金紧张，较高票息伴随更高违约风险。'}],
  futures:FUTURES_INSTRUMENTS,
  crypto:[...CRYPTO_COINS,...MEME_COINS],
  angel:[{id:'robot',name:'小巷机器人',tag:'硬件创业',note:'样机已完成，量产要花下一轮的钱。'},{id:'care',name:'邻里照护',tag:'社区服务',note:'已有付费客户，复制门店需要管理能力。'},{id:'dream',name:'云梦宇宙',tag:'热门概念',note:'演示漂亮，商业收入尚未验证。'}],
  housing:[{id:'suburb',name:'城郊两居',tag:'低总价 · 租金 2.5%',rent:250,note:'交通在改善，出租要多等一等。'},{id:'center',name:'老城小户型',tag:'生活配套 · 租金 3.5%',rent:350,note:'租客好找，房龄带来维修开支。'},{id:'shop',name:'街角公寓',tag:'租金 4% · 波动较高',rent:400,note:'依赖周边商圈，空置时仍有按揭。'}],
  ponzi:[{id:'ponzi',name:'熟人高息项目',tag:'收益来源未验证',note:'账面数字与提现能力分开。'}],
};
export const MARKET_ACTIONS = new Set(['desk_order','desk_sell','desk_research','desk_manage','market_tick','market_day','stock_card','crypto_replay','gamble','gamble_leave','gamble_observe']);
// Zeroed card fields are retained for old-save compatibility; retired actions are rejected below.
export function newTrading(state) {return {day:state.turn*3,dayInTurn:0,phase:0,energy:6,quotes:{},research:{},disclosures:[],journal:[],plans:[],cryptoReplay:null,stockCards:{bull:0,bear:0},cardUsedDay:null,influences:{},stockNews:'三地市场开门了，先选市场，再看公司。',stockWorld:newStockWorld(),gambling:newGambling()};}
export function openTradingDay(s){for(const q of Object.values(s.trading.quotes)){q.open=q.price;openDailyQuote(s,q);}openStockDay(s);}
export function tradingState(state) {return state.trading ?? newTrading(state);}
export function deskOf(kind) {return kind==='crypto_perp'?'crypto':kind;}
export function instruments(kind) {return (kind==='crypto_perp'?CRYPTO_COINS:INSTRUMENTS[deskOf(kind)]) ?? [{id:'stock',name:'综合股指',tag:'平值附近'}];}
export function tradingAccess(s,kind) {return kind==='gambling'?getGamblingAccess(s):getMarketAccess(s,kind);}
export function stockSellReason(s,p) {return ['stock','fund'].includes(p.kind) && p.availableDay!==undefined && tradingState(s).day<p.availableDay?(p.kind==='fund'?'今日申购的基金，下一交易日才能赎回':'T+1：今日买入的这一笔，下一交易日才能卖出'):'';}
const checkMoney=n=>{if(!Number.isSafeInteger(n)||n<=0)throw Error('金额须为正整数分');};
export function partialExitShares(p){return p.shares===undefined?null:Math.floor(p.shares/(stockLot(p)*2))*stockLot(p);}
export function partialExitLabel(p){return p.shares===undefined?tradeTerms(p.kind).half:p.shares<stockLot(p)*2?(stockMarket(p).id==='us'?'不足两股':'不足两手'):`卖出 ${stockMarket(p).id==='us'?partialExitShares(p)+' 股':partialExitShares(p)/stockLot(p)+' 手'}`;}
const underlyingKey=(kind,id)=>['stock','fund','bond'].includes(kind)?`${kind}:${id}`:id;
export function quoteFor(s,kind,id) {const item=kind==='futures'?futuresInstrument(id):null;if(item?.market){const w=tradingState(s).stockWorld?.[item.market];if(w)return {...w,price:w.index};}const price=kind==='futures'&&futuresInstrument(id)?futurePrice(s,id):s.markets[underlyingKey(kind,id)]??(kind==='stock'?1000:10000);return tradingState(s).quotes[underlyingKey(kind,id)]??{price,open:price,history:[price]};}
const cryptoAction=(s,a)=>['desk_order','desk_sell','desk_manage'].includes(a.type)&&['crypto','crypto_perp'].includes(a.product??s.positions.find(p=>p.id===a.id)?.kind);
const offlineAction=(s,a)=>['ponzi','housing','angel','gambling'].includes(a.type.startsWith('gamble')?'gambling':a.product??s.positions.find(p=>p.id===a.id)?.kind);
export function marketAvailability(s,a,api) {
  try {
    if(s.age<18)return '年满 18 岁后开放';
    if(s.age>=80||s.phase==='ended')return '本次人生已结算';
    if(s.phase && s.phase!=='planning')return '先读完眼前的故事';
    if(getLegalStatus(s).inPrison)return '服刑期间暂停全部外部交易与赌局';
    if(a.type==='stock_card'||(a.type==='desk_research'&&a.product==='stock'))return '股票调查和行情卡已移除，请直接买入或卖出';
    const t=tradingState(s);
    if(a.type==='desk_manage'&&a.operation==='cancel_plan')return t.plans.some(p=>p.instrument===a.instrument)?'':'定投计划不存在';
    if(a.type==='market_day')return t.phase!==3?'先完成当日行情':(s.survival?.days||0)>=api.months(s)*30?'本期日账已经结清，请推进人生':'';
    if(a.type==='market_tick')return t.phase>=3?'今日已收盘，进入下一交易日或推进人生':'';
    if(a.type==='crypto_replay')return '行情随游玩出现，不能选择历史片段';
    if(a.type==='gamble_leave')return s.flags.gambling_quit?'已经停止参与':'';
    // Crypto orders at midnight start the next day; opening a page never changes time.
    if(t.phase>=3&&cryptoAction(s,a)){
      if(s.dayRoutine?.pending)return '先选完眼前这件日常小事，再推进时间';
      if((s.debtClock?.periodDays||0)>=api.months(s)*30)return '本期天数已过完，请先结算本期';
      return marketAvailability({...s,trading:{...t,day:t.day+1,phase:0,energy:6}},a,api);
    }
    const offline=offlineAction(s,a);
    if(t.phase>=3&&!offline)return '今日已收盘，进入下一交易日再操作';
    if(t.energy<=0&&!offline)return cryptoAction(s,a)?'今日操作次数已用完，推进至次日恢复':'今日操作已用完，仍可推进行情与收盘';
    const product=a.product??(a.type==='gamble'?'gambling':s.positions.find(p=>p.id===a.id)?.kind);
    const cryptoReason=cryptoLifeActionReason(s,a);if(cryptoReason)return cryptoReason;
    const asset=a.instrument??s.positions.find(p=>p.id===a.id)?.instrument;
    if((product==='stock'&&stockMarket(asset).id==='a'||product==='futures'&&futuresInstrument(asset)?.market==='a')&&s.dayRoutine&&![1,3].includes(s.dayRoutine.stage))return aShareSession(s).reason;
    if(product){const access=tradingAccess(s,product);if(!access.unlocked)return access.reason;}
    if(a.type==='desk_order') {
      const coin=instruments(product).find(i=>i.id===a.instrument);
      if(product==='crypto'&&isRugged(s,a.instrument))return '这个项目已经归零，停止交易';
      if(product==='stock'){const lot=stockLot(a.instrument);if(!Number.isSafeInteger(a.shares)||a.shares<lot||a.shares%lot!==0)return `这家公司按 ${lot} 股一份买入`;if(a.amount!==a.shares*quoteFor(s,'stock',a.instrument).price)return '股票报价已变化，请按最新价格下单';}
      const basic=api.orderAvailability(s,{...a,type:'invest',underlying:underlyingKey(product,a.instrument)});if(!basic.allowed)return basic.reason;
      if(!instruments(product).some(i=>i.id===a.instrument))return '请选择有效标的';
      if(['option','option_short'].includes(product)&&(![1,3,5].includes(a.duration)||![.95,1,1.05].includes(a.strikeRatio)))return '期权期限或行权价无效';
      if(product==='crypto_perp'&&!CRYPTO_LEVERAGES.includes(a.leverage))return '请选择 10 至 1000 倍之间的可用杠杆';
      if(a.recurring&&product!=='fund')return '仅基金支持这个定投计划';
      if(a.recurring&&t.plans.length>=6&&!t.plans.some(p=>p.instrument===a.instrument))return '最多保留 6 项定投计划';
    }
    if(a.type==='desk_sell') {
      if(![5000,10000].includes(a.bps))return '请选择处理一半或全部持仓';
      const p=s.positions.find(p=>p.id===a.id);if(!p)return '持仓不存在';
      if(p.cryptoLifeBranch==='scheme'){const reason=cryptoLifeActionReason(s,{action:'scheme_withdraw',positionId:p.id});if(reason)return reason;}
      if(p.honeypot)return '貔貅币限制卖出：账面涨幅无法兑现，可留证转追偿';
      if(a.bps!==10000&&(p.mortgageId||['angel','housing','ponzi'].includes(p.kind)))return '这类资产不支持部分交易';
      if(p.kind==='option_short'&&a.bps!==10000)return '期权卖方需全部买入平仓';
      if(p.shares!==undefined&&a.bps!==10000&&p.shares<stockLot(p)*2)return '不足两份，选择全部卖出';
      return api.orderAvailability(s,{type:'sell',id:a.id}).reason||'';
    }
    if(a.type==='desk_research') {
      if(!['fund','bond','angel','ponzi'].includes(product))return '这个市场没有该研究操作';
      if(t.research[`${product}:${a.instrument||'all'}`]===t.day)return '今天已经看过这份资料';
      if(product!=='ponzi'&&!instruments(product).some(i=>i.id===a.instrument))return '请选择有效研究对象';
    }
    if(a.type==='desk_manage') {
      if(a.operation==='cancel_plan')return t.plans.some(p=>p.instrument===a.instrument)?'':'定投计划不存在';
      const p=s.positions.find(p=>p.id===a.id);if(!p)return '持仓不存在';
      if(a.operation==='evidence')return p.honeypot?'':'这笔资产不属于貔貅币受骗记录';
      if(p.frozen||p.failed)return '这笔资产已冻结或失败';
      if(a.operation==='margin'&&!['futures','crypto_perp'].includes(p.kind))return '此持仓不使用逐仓保证金';
      if(a.operation==='follow'&&p.kind!=='angel')return '此持仓不是创业股权';
      if(a.operation==='renovate'&&(p.kind!=='housing'||p.renovated))return '此房产不能重复装修';
      if(!['margin','follow','renovate'].includes(a.operation))return '未知管理动作';
      const spend=a.operation==='renovate'?api.mul(p.cost,.03):a.amount;checkMoney(spend);
      if(spend>s.cash)return '实际现金不足';
      if(a.operation==='follow'&&(s.flags.exit_intent||s.flags.voluntary_exit))return '封盘后不再追加高风险股权';
    }
    if(['gamble','gamble_observe'].includes(a.type)) {
      if(s.behavior?.onlineGambling?.status==='RECOVERED')return '这段经历已经放下，入口只保留旧账';
      if(s.flags.gambling_quit)return '你已决定停止参与，入口保留旧账';
      if(s.flags.exit_intent||s.flags.voluntary_exit)return '已经封盘，不再新增赌博风险';
      return gamblingAvailability(s,a,api.metrics(s).availableCash);
    }
    return '';
  }catch(e){return e.message;}
}
const journal=appendMarketJournal;
// Wake at lunch: prices and held positions still move through the missed morning.
export function skipSleepingMorning(s,api){
 if(s.dayRoutine?.wakeKind==='late'&&s.dayRoutine.stage===2&&s.trading.phase===0)return tickMarket(s,api);
 return '';
}
export function executeMarket(s,a,api) {
  if(a.type==='stock_card'||(a.type==='desk_research'&&a.product==='stock'))throw Error('股票调查和行情卡已移除，请直接买入或卖出');
  s.trading??=newTrading(s);ensureGameCalendar(s);const t=s.trading;
  if(a.type==='desk_manage'&&a.operation==='cancel_plan'){t.plans=t.plans.filter(p=>p.instrument!==a.instrument);return '定投计划已暂停，原有基金继续持有。';}
  if(t.phase===3&&cryptoAction(s,a))executeMarket(s,{type:'market_day',market:'crypto'},api);
  if(a.type==='market_tick')return tickMarket(s,api,a.market==='crypto');
  if(a.type==='crypto_replay')throw Error('行情随游玩出现，不能选择历史片段');
  if(a.type==='market_day'){t.day++;t.dayInTurn=Math.min(2,t.dayInTurn+1);t.phase=0;t.energy=6;openTradingDay(s);resetRoutineDay(s);skipSleepingMorning(s,api);if(a.market==='crypto')return '加密行情进入新的一天，恢复 6 次市场操作。';return '三地市场进入新的一天。昨日买入的 A 股已满足 T+1，港股、美股仍可日内买卖；停牌等限制继续有效。';}
  if(a.type==='gamble_leave'){const text=api.quitGambling(s);journal(s,text);return text;}
  if(!offlineAction(s,a))t.energy--;
  if(a.type==='desk_order') {
    const i=instruments(a.product).find(i=>i.id===a.instrument),key=underlyingKey(a.product,i.id);
    if(['crypto','crypto_perp'].includes(a.product))ensureCryptoLife(s);
    const quote=quoteFor(s,a.product,i.id);s.markets[key]=quote.price;
    const cashBefore=s.cash,p=api.invest(s,{...a,underlying:key}),cashFlow=s.cash-cashBefore;p.instrument=i.id;p.name=i.name+(a.product==='crypto_perp'?' · 日内合约':'');p.managed=true;
    if(['crypto','crypto_perp'].includes(p.kind))p.cryptoLifeBranch=p.kind==='crypto_perp'?'leverage':i.cryptoLifeBranch||(/山寨/.test(i.tag)||i.meme?'alt':'spot');
    if(a.product==='stock')p.shares=a.shares;
    if(a.product==='fund'){p.fundStyle=i.id;p.lockUntilTurn=s.turn;p.openedDay=t.day;p.availableDay=t.day+1;if(a.recurring){t.plans=t.plans.filter(x=>x.instrument!==i.id);t.plans.push({instrument:i.id,amount:a.amount});}}
    if(a.product==='bond'){p.couponBps=i.coupon;p.maturityAge=s.age+i.months/12;}
    if(['option','option_short'].includes(a.product)){const terms=optionQuote({...a,price:p.entryPrice,phase:t.phase});if(!terms)throw Error('期权报价无效');p.expiryDay=t.day+a.duration-1;p.optionDays=a.duration;p.strike=terms.strike;p.units=terms.units;p.optionTimeValue=terms.timeValue;p.optionRemainingAtOpen=terms.remaining;if(a.product==='option_short')p.premium=terms.premium;delete p.expiryTurn;}
    if(a.product==='housing')p.rentBps=i.rent;
    if(a.product==='crypto_perp'){p.sameDay=true;p.openedDay=t.day;}
    if(['crypto','crypto_perp'].includes(a.product))enterCrypto(s,i.id,api);
    if(memeKind(s,i.id)==='honey'){p.honeypot=true;p.bookBalance=a.amount;p.value=0;api.record(s,'position',-a.amount,'貔貅币无可兑现价值',{positionId:p.id});}
    const text=`${a.product==='stock'?stockMarket(i.id).name+' · ':''}${p.name}${orderLabel(a.product,a.direction)}成交，${tradeTerms(a.product).amount} ¥${(a.amount/100).toLocaleString()}。${a.product==='stock'?(stockMarket(i.id).sellDelay?'这笔新仓明天才能卖出。':'这笔新仓可以日内卖出。'):a.product==='crypto_perp'?'可随时平仓，在每日结算时自动结清。':a.recurring?'以后每个人生回合尝试定投同样金额，现金不足会跳过。':'持仓已经记入账本。'}`;
    if(!recordCryptoTrade(s,p,{action:p.kind==='crypto_perp'?'open':'buy',cashFlow,text}))journal(s,text);return text;
  }
  if(a.type==='desk_sell') {
    const p=s.positions.find(p=>p.id===a.id);
    if(p?.cryptoLifeBranch==='scheme')return executeCryptoLifeEffect(s,{action:'scheme_withdraw',positionId:p.id},api);
    if(a.bps===10000){const discipline=recordDisciplineExit(s,p,api),text=api.sell(s,p.id)+(discipline?' '+discipline:'');if(!['crypto','crypto_perp'].includes(p.kind))journal(s,text);return text;}
    if(p.mortgageId||['angel','housing','ponzi'].includes(p.kind))throw Error('这类资产不支持部分交易');
    if(['crypto','crypto_perp'].includes(p.kind))advanceCryptoLife(s,api.metrics(s));
    const soldShares=partialExitShares(p);
    const ratio=soldShares!==null?soldShares/p.shares:a.bps/10000,value=api.mul(p.value,ratio),cost=api.mul(p.cost,ratio),fee=api.mul(value,p.kind==='fund'?.01:.002);
    if(soldShares!==null)p.shares-=soldShares;
    p.value-=value;p.cost-=cost;for(const k of ['units','margin','liquidation','premium','feesPaid','optionTimeValue'])if(p[k]!==undefined)p[k]-=api.mul(p[k],ratio);
    api.cashChange(s,value-fee,`${p.name}部分${tradeTerms(p.kind).close}`);api.noteRealizedProfit?.(s,value-fee-cost);api.record(s,'position',-value,`部分${tradeTerms(p.kind).close}估值`,{positionId:p.id});
    const discipline=recordDisciplineExit(s,{...p,value:value,cost},api),text=`${p.name}${soldShares!==null?`卖出 ${soldShares} 股${stockMarket(p).id==='us'?'':`（${soldShares/stockLot(p)} 手）`}`:tradeTerms(p.kind).half}，扣费后实收 ¥${((value-fee)/100).toLocaleString()}；剩余持仓继续结算。${discipline?' '+discipline:''}`;if(!recordCryptoTrade(s,p,{action:p.kind==='crypto_perp'?'close':'sell',cashFlow:value-fee,pnl:value-fee-cost,text}))journal(s,text);return text;
  }
  if(a.type==='desk_research') {
    api.stat(s,{insight:2});
    t.research[`${a.product}:${a.instrument||'all'}`]=t.day;
    const i=instruments(a.product).find(i=>i.id===a.instrument);
    const text=a.product==='ponzi'?'你核对了合同：收益来源无法验证，提前提现也可能失败。对方晒出的余额截图不能证明偿付能力。':`${i.name}的资料：${i.note||'价格受消息和市场共同影响。'} 研究提升理解，不提前揭露下一次涨跌。`;
    journal(s,text);return text;
  }
  if(a.type==='desk_manage') {
    if(a.operation==='cancel_plan'){t.plans=t.plans.filter(p=>p.instrument!==a.instrument);return '定投计划已暂停，原有基金继续持有。';}
    const p=s.positions.find(p=>p.id===a.id),spend=a.operation==='renovate'?api.mul(p.cost,.03):a.amount;
    if(a.operation==='evidence'){const c=api.freezePosition(s,p,'貔貅币受骗追偿');api.record(s,'claim',-c.value,'貔貅币追偿按零估值',{claimId:c.id});c.value=0;return '已登记被骗款项，等待追偿；当前可变现金额 ¥0。';}
    api.cashChange(s,-spend,`${p.name}：${a.operation==='margin'?'追加保证金':a.operation==='follow'?'跟投融资':'装修支出'}`);
    const added=a.operation==='renovate'?api.mul(spend,.5):spend;
    p.cost+=spend;p.value+=added;api.record(s,'position',added,'追加资产估值',{positionId:p.id});
    if(a.operation==='margin'){p.margin+=spend;if(p.kind==='crypto_perp')recordCryptoLifeTrade(s,p,{action:'margin',cashFlow:-spend});const discipline=recordDisciplineMargin(s,p,api);return '保证金已追加，仓位不变。'+(discipline?' '+discipline:'');}
    if(a.operation==='follow'){p.lockUntilTurn=Math.max(p.lockUntilTurn,s.turn+3);return '跟投款已进入项目，本笔股权至少再锁定 3 回合。估值增加来自你的投入，项目仍可能失败。';}
    p.renovated=true;p.rentBps=(p.rentBps||300)+80;return '装修完成：付出房屋成本的 3%，其中一半计入估值，年租金参数增加 0.8 个百分点；空置与维修仍存在。';
  }
  if(['gamble','gamble_observe'].includes(a.type)){const text=executeGambling(s,a,api);journal(s,text);return text;}
  throw Error('未知市场操作');
}

export function tickMarket(s,api,continuous=false,night=false) {
  const t=s.trading;
  const held=s.positions.find(p=>['crypto','crypto_perp'].includes(p.kind)&&!memeKind(s,p.instrument));if(held)enterCrypto(s,held.instrument,api);
  if(!night)t.phase++;advanceCryptoEncounter(s);const notes=settleMemeProjects(s,api);
  const stockMoves=stockSegment(s,api),stockReturns={};
  if(t.phase===1){t.stockNews=Object.entries(t.stockWorld).map(([id,w])=>`${stockMarket(STOCKS.find(i=>i.market===id).id).name}：${w.news}`).join(' ');notes.push(t.stockNews);}
  // Each instrument draws once per segment; all positions in it share that quote.
  const keys=new Set(s.positions.filter(p=>!['angel','housing','ponzi'].includes(p.kind)).map(p=>p.underlying));
  for(const kind of ['stock','fund','bond','crypto','futures'])for(const i of kind==='futures'?LEGACY_FUTURES:instruments(kind))keys.add(underlyingKey(kind,i.id));
  for(const key of keys){
    const linked=futuresInstrument(key);if(linked&&!['GOLD','SILVER'].includes(key))continue;
    const [prefix,id]=key.includes(':')?key.split(':'):['crypto',key];const i=(INSTRUMENTS[prefix]||[]).find(i=>i.id===id)||INSTRUMENTS.futures.find(i=>i.id===id)||LEGACY_FUTURES.find(i=>i.id===id);
    const initial=s.markets[key]??(prefix==='stock'?1000:10000),q=t.quotes[key]??{price:initial,open:initial,history:[initial]};
    const freezeA=Boolean(night&&['stock','fund','bond'].includes(prefix)||s.dayRoutine&&t.phase===3&&prefix==='stock'&&stockMarket(id).id==='a');
    // Additional fictional instruments must not consume the existing markets' random draws.
    const move=(prefix==='stock'&&i?stockMoves[i.id]+disclosureMove(s,i.id):((i?.cryptoLifeBranch?futuresNoise(s,'crypto-life:'+key+':'+q.price):api.draw(s))-.5)*2*(i?.vol??.025));let price=isRugged(s,key)?0:Math.max(1,api.mul(q.price,1+move));
    const real=historicalSegment(s,key);if(real?.length)price=historicalIndex(s,key,real.at(-1)[4]);
    if(prefix==='stock'&&stockMarket(id).limit)price=Math.max(1,api.mul(q.open,.9),Math.min(api.mul(q.open,1.1),price));
    if(freezeA)price=q.price;
    if(prefix==='stock'&&i)stockReturns[i.id]=price/q.price-1;
    recordDailyQuote(s,q,price);if(real?.length){const bar=q.daily.at(-1);bar.high=Math.max(bar.high,...real.map(c=>historicalIndex(s,key,c[2])));bar.low=Math.min(bar.low,...real.map(c=>historicalIndex(s,key,c[3])));}
    q.price=price;q.history.push(price);q.history=q.history.slice(-24);t.quotes[key]=q;s.markets[key]=price;
  }
  for(const i of FUTURES_INSTRUMENTS.filter(i=>!i.market&&i.group!=='fx'&&!['GOLD','SILVER'].includes(i.id))){
    const price=futurePrice(s,i.id),q=t.quotes[i.id]??{price,open:price,history:[price]},next=Math.max(1,api.mul(price,1+(futuresNoise(s,i.id+':'+price)-.5)*2*i.vol));
    recordDailyQuote(s,q,next);q.price=next;q.history=[...q.history,next].slice(-24);t.quotes[i.id]=q;s.markets[i.id]=next;
  }
  markStockSegment(s,stockReturns,api.mul,{daily:true});let fxDraw=0;moveFx(s,()=>futuresNoise(s,'fx-'+(fxDraw++)+':'+futurePrice(s,'USD_CNY')+':'+futurePrice(s,'EUR_CNY')),.004);syncLinkedFutures(s);t.influences={};
  for(const p of [...s.positions]) {
    if(p.honeypot){p.bookBalance=growScamBook(p.bookBalance);notes.push('貔貅币页面继续显示上涨，卖出限制没有解除；账面数字未计入可兑现资产。');continue;}
    if(p.frozen||['angel','housing','ponzi'].includes(p.kind))continue;
    const price=t.quotes[p.underlying]?.price??p.lastPrice,prior=p.value;
    if(['futures','crypto_perp'].includes(p.kind)){
      const fee=api.mul(p.units,.0002),pnl=api.mul(p.units,(price/p.entryPrice-1)*(p.direction==='short'?-1:1));p.feesPaid+=fee;
      const equity=p.margin+pnl-p.feesPaid;
      const path=historicalSegment(s,p.underlying),adverse=path?.length?historicalIndex(s,p.underlying,p.direction==='short'?Math.max(...path.map(c=>Number(c[2]))):Math.min(...path.map(c=>Number(c[3])))):price;
      const worst=p.margin+api.mul(p.units,(adverse/p.entryPrice-1)*(p.direction==='short'?-1:1))-p.feesPaid;
      if(worst<=p.liquidation||equity<=p.liquidation){recordDisciplineLiquidation(s,p,api);api.closePosition(s,p,Math.max(0,Math.min(equity,worst)),'日内逐仓强平');s.flags.futures_liquidated=true;api.stat(s,{stress:12});notes.push(`${p.name}触发强平，借款仍保留。`);continue;}
      if(p.kind==='crypto_perp'&&t.phase===3){api.closePosition(s,p,equity,'加密日内合约每日结清');notes.push(`${p.name}当日结清 ¥${equity/100}。`);continue;}
      p.value=equity;
    }else if(['option','option_short'].includes(p.kind)) {
      if(p.expiryDay===undefined)continue;
      const {intrinsic,liability}=optionMark(p,price,t.day,t.phase);
      if(t.day>=p.expiryDay&&t.phase===3){
        const equity=p.kind==='option'?intrinsic:p.margin+p.premium-intrinsic;api.closePosition(s,p,Math.max(0,equity),'期权交易日到期结算');if(equity<0)api.charge(s,-equity,'卖方期权超保证金赔付',{aprBps:600});notes.push(`${p.name}期权到期，${equity<0?'超额赔付': '返还'} ¥${Math.abs(equity)/100}。`);continue;
      }
      if(p.kind==='option_short'&&p.margin+p.premium<liability){api.closePosition(s,p,0,'期权卖方保证金耗尽');api.charge(s,liability-p.margin-p.premium,'卖方期权超保证金赔付',{aprBps:600});notes.push('期权卖方被强制平仓，超出保证金的赔付仍需偿还。');continue;}
      p.value=p.kind==='option'?liability:Math.max(0,p.margin+p.premium-liability);
    }else p.value=p.shares!==undefined?p.shares*price:Math.max(0,api.mul(p.value,price/Math.max(1,p.lastPrice)));
    p.lastPrice=price;
    if(p.value!==prior)api.record(s,'position',p.value-prior,'交易日盯市',{positionId:p.id});
  }
  if(t.cryptoReplay){const w=replayWindow(s),symbol=w.symbols.DOGEUSDT?'DOGEUSDT':'BTCUSDT',real=historicalSegment(s,symbol);if(real?.length){const change=(Number(real.at(-1)[4])/Number(real[0][1])-1)*100;notes.push(`币圈快讯 · ${symbol} 本段${change>=0?'上涨':'下跌'} ${Math.abs(change).toFixed(2)}%，已进入持仓结算。`);}}
  const text=`${continuous?['00:00','08:00 行情','16:00 行情','24:00 每日结算'][t.phase]:['开盘','午间行情','尾盘行情','当日收盘'][t.phase]}。${notes.join(' ')||'持仓已按同一份行情更新。现金、借款和生活账单没有重复结算。'}`;journal(s,text);return text;
}

export function finishTradingPeriod(s,api,notes) {
  // Finish the open day's path before age advances; intraday contracts never jump half a year.
  if(!s.trading)return;
  ensureGameCalendar(s);
  for(let guard=0;(s.positions.some(p=>p.kind==='crypto_perp'||p.expiryDay!==undefined)||(s.trading.cryptoReplay&&s.trading.cryptoReplay.step<9)||hasPendingCrypto(s))&&guard<30;guard++){
    if(s.trading.phase===3){s.trading.day++;s.trading.dayInTurn=Math.min(2,s.trading.dayInTurn+1);s.trading.phase=0;openTradingDay(s);}
    notes.push(tickMarket(s,api));
  }
  if(s.trading.cryptoReplay)for(const p of s.positions)if(p.kind==='crypto'&&replayWindow(s).symbols[p.underlying])p.historyPricedTurn=s.turn+1;
}
export function resetTradingPeriod(s,api,notes) {
  s.trading??=newTrading(s);const t=s.trading;t.day+=3-t.dayInTurn;t.dayInTurn=0;t.phase=0;t.energy=6;
  resetGameCalendar(s);if(s.age===18)ensureRoutine(s);resetRoutineDay(s);
  t.stockCards={bull:0,bear:0};t.cardUsedDay=null;t.influences={};
  t.cryptoReplay=null;delete t.cryptoEncounter;
  for(const [key,q] of Object.entries(t.quotes)){const next=s.markets[key]??q.price;if(q.price!==next){q.history.push(next);q.history=q.history.slice(-24);}q.price=next;q.open=q.price;}openTradingDay(s);
}
export function executePlans(s,api,notes) {
  const t=tradingState(s);
  if(getLegalStatus(s).inPrison)return;
  for(const plan of s.trading?.plans||[]){
    if(!getMarketAccess(s,'fund').unlocked||plan.amount>s.cash){notes.push('基金定投因现金或资格不足跳过，没有借钱补足。');continue;}
    const i=INSTRUMENTS.fund.find(i=>i.id===plan.instrument);if(!i)continue;
    const p=api.invest(s,{product:'fund',amount:plan.amount,underlying:underlyingKey('fund',i.id)});p.instrument=i.id;p.fundStyle=i.id;p.managed=true;p.lockUntilTurn=s.turn;p.openedDay=t.day;p.availableDay=t.day+1;p.name=i.name;notes.push(`${i.name}定投 ¥${plan.amount/100}。`);
  }
}
