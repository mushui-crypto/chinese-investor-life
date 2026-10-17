import {marketNotice} from '../game/market-notices.js';
import {getMarketAccess,getGamblingAccess} from '../game/market-access.js';
import {renderChapterEntry,renderChapterPlan} from './life-chapters.js';
import {renderConsumptionDock} from './life-panel.js';
import {MARKET_GUIDES} from '../game/market-guide.js';
import {renderLivingCosts} from './living-costs.js';
import {disciplineStatus,behaviorState} from '../game/behavior.js';
import {renderDailyDockEvent,renderDailyDockChoices} from './day-routine.js';
import {renderFastForward} from './time-controls.js';
import {routineClock,routineWindow} from '../game/day-routine.js';
import {marketMenuKey,marketIsOpen,marketIsVisible} from './market-menu.js';
import {infoButton} from './info-popover.js';
import {continuation} from '../game/continuation.js';
import {getTurnMonths,getSurvivalStatus,getBehaviorStatus,getLegalStatus,getActionAvailability,getDebtCalendar,getMetrics,PRODUCTS} from '../game/core.js';
import {goalStatus,journey,nextStep} from '../game/play-guide.js';
import {marketCapital} from '../game/market-access.js';
import {renderCashBudget} from './cash-budget.js';
import {renderTimePanel,routeButton} from './play-guide-panel.js';

const STATS={
 health:['健康','健康 ≤30 需要就医，≤10 危急，降至 0 本局结束。','日结优先付基本伙食；全天缺食健康 −10，部分不足按比例扣。先吃饱再休息；去医院可付费治疗。'],
 fatigue:['疲劳','疲劳越低越好。达到 65 后，疲劳导致工作出错，工资和兼职收入减少 25%。','睡觉、午休和休息可降低疲劳；低于 65 后解除这项扣减。与摸鱼扣钱不叠加，养老金和家庭生活费不受影响。疲劳不等于安排活动用的精力。'],
 stress:['压力值','超过 75 时，期末额外扣健康。','打工增加压力，休息减压。'],
 academic:['学业','主要影响 18 岁升学结果，也记录童年到高中的学习基础。','上课、订正和主动学习会提升。'],
 discipline:['自律','影响升学，也影响亏损时能否执行止损、是否扛单和冲动加仓。','坚持计划会提升；上头追损、亏损加码会消耗。'],
 skill:['谋生本事','影响工钱、求职工资、经营收入和接单条件。','学习和工作可提升。换高薪要重新求职。'],
 insight:['眼力见','影响股票、期权和合约的开放条件。','学习、模拟练习和调研可提升。'],
 trust:['人缘','影响亲友借款额度、家庭援助和协商展期。','见朋友、修复关系可提升；个人交情单独计算。'],
 fame:['江湖名气','影响人物称呼和部分结局。','不影响工资和投资收益。'],
 credit:['信用','影响借款审批、额度、按揭和部分接单条件。','逾期扣信用；借款还需满足收入和负债条件。']
};
export const MARKET_BRIEFS=Object.fromEntries(Object.entries(MARKET_GUIDES).map(([k,g])=>[k,[g.icon,g.action,g.timing,g.risk]]));
export function renderPeriodConsole(s,ctx,budget=true,life=false){
 const {esc}=ctx,left=Math.max(0,getTurnMonths(s)*30-(s.debtClock?.periodDays||0)),c=continuation(s),v=getSurvivalStatus(s);
 if(life){
  const event=renderDailyDockEvent(s,ctx,{rescue:v.active})||(!v.needsCare?renderConsumptionDock(s,ctx):''),routine=s.phase==='planning'&&s.age>=18&&s.age<80&&!getLegalStatus(s).inPrison&&left>0;
  if(!ctx.detailedDay&&s.phase==='planning'&&s.age>=18&&s.age<80&&!getLegalStatus(s).inPrison&&!event)return `<section class="life-clockbar stage-operation-bar" aria-label="阶段生活安排">${renderChapterPlan(s,ctx,true)}</section>`;
  const actions=event||(routine?renderDailyDockChoices(s,ctx,{rescue:v.active,next:c}):s.phase==='planning'?`<div class="life-pace-actions"><button class="button primary" data-action="life-continue">${esc(c.label)}</button></div>`:'');
  return `<section class="life-clockbar ${event?'has-daily-event':routine?'has-daily-activities':''}" aria-label="${event?'当前事件与选择':'生活时间与账单'}"><div class="life-clock"><strong>${ctx.icon('clock')}${routine?routineWindow(s):routineClock(s)}</strong><span>${v.active?'求生期':`当前账期余 ${left} 天`} · 日常开销 ${ctx.money(v.dailyExpense)} ${infoButton('period','查看本期生活账单')}</span>${v.active?`<b class="life-shortage">${v.shortage>0?`${v.dailyIncome>0?'算上今日到账，':'今天'}生活费还差 ${ctx.money(v.shortage)}`:'今天的生活费够了，先攒下应急钱'}</b>`:s.cash<getMetrics(s).livingReserve?'<span class="life-shortage">今天够用，本账期预算尚未备齐</span>':''}</div>${renderChapterEntry(s,ctx)}${actions}</section>`;
 }
 return `<section class="period-console ${life?'life-console':''}" aria-label="本期安排与资金"><div class="period-heading"><div><div class="period-title"><h2>${v.active?'先凑生活费':life?'生活安排':'本期安排'}</h2>${infoButton('period','时间与生活账单')}${life?'':`<span class="period-life-menu">生活与账单 ${infoButton('desk-life','生活与账单')}</span>`}</div><p>${v.active?'求生期 · 按天结算':routineClock(s)+` · 本期余 ${left} 天`}${s.phase==='planning'?` · 精力 ${s.actionPoints} / 2`:' · 有待选故事'}</p></div>${s.phase==='planning'?`<div class="life-pace-actions">${s.lifeArcs?.pending==='consumption'?'<button class="button" data-action="life-scene">有个消费念头 →</button>':''}<button class="button primary" data-action="stage-detail">${s.dayRoutine?.pending?'处理当前事件':'展开今天'}</button><button class="button" data-action="stage-return">阶段生活安排 →</button></div>`:''}</div>${budget?renderCashBudget(s,{...ctx,compact:true,quiet:life}):''}</section>`;
}
export function renderLifeAlerts(s,ctx){
 if(s.age<18)return '';
 const due=getDebtCalendar(s).filter(d=>d.overdue||d.days<=1),pending=s.lifeArcs?.pending;
 if(!due.length&&!pending)return '';
 return `<div class="life-alerts" aria-label="待处理的生活事项">${pending?'<button class="text-button" data-action="life-scene">有一条生活消息 →</button>':''}${due.length?`<button class="text-button" data-action="debt-calendar">${due.some(d=>d.overdue)?'有逾期欠款':`最近有 ${due.length} 笔还款`} ${ctx.icon('chevron')}</button>`:''}</div>`;
}
export function renderCompactGoal(s,ctx){
 if(s.age<18)return '';const g=goalStatus(s);
 const actionLabel=g.route.type==='life-action'?({seek_job:'找份工作',gig:'接点零活',market_practice:'模拟练习'}[g.route.action]||'生活安排'):({'debt-calendar':'查看还款','market-rules':'查看开放条件','life-legacy':'整理交接'}[g.route.type]||({life:'生活安排',assets:'查看资产',people:'人情往来'}[g.route.tab])||'查看目标');
 return `<section class="goal-panel compact-goal"><div class="section-heading"><h2>小目标</h2>${g.done?'<span class="goal-complete">已达成</span>':''}<button class="button small notebook-button" data-action="goals">换目标</button></div><strong>${ctx.esc(g.title)}</strong>${g.done?'':`<progress max="1" value="${g.ratio}" aria-label="阶段目标进度"></progress>${routeButton(g.route,actionLabel,ctx,'button small notebook-button goal-action')}`}</section>`;
}
export function renderLifeLinks(s,ctx){
 if(s.age<18)return '';const b=getBehaviorStatus(s);
 return `<section class="life-links" aria-label="日常生活入口"><div class="life-links-heading"><h2>日常</h2><span class="life-state">上头 <b>${b.heat}</b> · 疲劳 <b>${b.fatigue}</b></span>${infoButton('behavior','上头与疲劳')}</div><div class="notebook-actions"><button class="button small notebook-button" data-action="life-hub">人物与约定</button><button class="button small notebook-button" data-action="debt-calendar">还款日历</button><button class="button small notebook-button" data-action="life-rebuild">接单赚钱</button><button class="button small notebook-button" data-action="behavior-hub">状态与消息${b.pending?'<span class="notebook-new">有新消息</span>':''}</button></div>${s.age>=55?'<button class="button small notebook-button notebook-settle" data-action="settle">回顾这一生</button>':''}</section>`;
}
export function renderMarketList(s,products,filter,ctx){
 const {esc,icon}=ctx,watch=journey(s).watchlist.map(marketMenuKey);
 const all=[...products.filter(([k])=>k!=='option_short').map(p=>[p[0],p[0]==='option'?'期权':p[1]]),['gambling','深夜赌局']].filter(([k])=>marketIsVisible(s,k));
 const selected=filter==='watched'?'watched':'all',rows=all.filter(([k])=>selected==='all'||watch.includes(k));
 const practice=getActionAvailability(s,{type:'market_practice'});
 return `<section class="workspace market-workspace market-directory"><header class="market-directory-heading"><div><h1>${icon('chart')} 投资市场</h1><span>${all.length} 个市场 ${infoButton('markets','市场开放')}${s.positions.length?`<button class="text-button holdings-link" data-action="tab" data-tab="assets">持仓 ${s.positions.length} 笔 →</button>`:''}</span></div>${s.age>=18?`<button class="button small" data-action="market-practice" ${practice.allowed?'':'disabled'} title="${esc(practice.reason||'1 点精力 · 眼力 +10')}">${icon('book')} 模拟练习</button>`:''}</header>${getLegalStatus(s).inPrison?'<p class="inline-notice">服刑期间暂停交易，原有持仓和债务继续结算。</p>':s.phase!=='planning'&&s.age>=18?'<button class="inline-return" data-action="tab" data-tab="life">先处理眼前的故事 →</button>':''}${all.length?`<nav class="filter-row market-filters" aria-label="市场列表">${[['all','全部市场'],['watched','已关注']].map(([k,t])=>`<button class="filter ${selected===k?'active':''}" data-action="market-filter" data-filter="${k}" aria-pressed="${selected===k}">${t}</button>`).join('')}</nav>`:''}<div class="market-list">${rows.map(([key,name])=>{const g=MARKET_GUIDES[key],followed=watch.includes(key),held=s.positions.filter(p=>marketMenuKey(p.kind==='crypto_perp'?'crypto':p.kind)===key).length,open=marketIsOpen(s,key),notice=marketNotice(s,key),access=key==='gambling'?getGamblingAccess(s):getMarketAccess(s,key);return `<article class="market-row ${open?'is-open':'is-introduced'}" data-market="${key}"><div class="market-row-name"><span class="market-object">${icon(g.icon)}</span><div><h2>${esc(name)} ${infoButton('market:'+key,name+'玩法说明')}${notice?`<span class="market-update-tag"><i aria-hidden="true"></i>${notice}</span>`:''}</h2><span class="market-state">${!open?'已介绍 · 待满足条件':held?`持仓 ${held} 笔`:key==='gambling'?'虚构风险经历':key==='ponzi'?'熟人项目':'可进入'}</span></div></div><div class="market-row-facts"><strong>${esc(g.action)}</strong><span>${esc(open?g.timing:access.reason||'完成介绍剧情后可参与')}</span></div><div class="market-row-actions"><button class="market-watch" data-action="toggle-watch" data-product="${key}" aria-label="${followed?'取消关注':'关注'}${esc(name)}" aria-pressed="${followed}">${icon('star')}</button><button class="button small ${open?'primary':''}" data-action="desk-open" data-product="${key}">${open?'进入':'查看条件'} ${icon(open?'chevron':'lock')}</button></div></article>`;}).join('')||`<div class="empty-state"><p>${selected==='watched'?'还没有关注的市场。点市场旁的星星即可收藏。':s.age<18?'成年后再来看看。现在先过好眼前的生活。':'暂时还没有可进入的市场。继续生活、学习或结识朋友后再来看看。'}</p><button class="button small" data-action="${selected==='watched'?'market-filter':'tab'}" ${selected==='watched'?'data-filter="all"':'data-tab="life"'}>${selected==='watched'?'查看全部市场':'回到生活安排'}</button></div>`}</div></section>`;
}
export function infoContent(key,s,products,ctx){
 const {esc,money}=ctx;
 if(key==='discipline'){
  const d=disciplineStatus(s),b=behaviorState(s);
  return {title:'交易纪律',body:`<p>自律 <b>${d.raw}</b> · 压力 <b>${s.stats.stress}</b> · 上头 <b>${b.heat}</b></p><p>有效自律 <b>${d.effective} / 100</b>：自律减去压力的 20% 和上头的 25%，四舍五入，最低为 0。</p><p class="info-secondary">亏损卖出可增加自律、降低上头；给亏损合约追加保证金会降低自律、增加上头。</p>`};
 }
 if(key==='daily-chart')return {title:'行情图',body:'<p>每根 K 线代表一天，横轴是游戏日期，右轴是价格。虚线表示中间有未记录的日期。</p><p>悬停、点击或按左右键查看开、高、低、收。基金和指数用折线。</p><p>前 30 日为模拟走势，之后逐日记录。</p>'};
 if(key.startsWith('stat:')){const [title,effect,advice]=STATS[key.slice(5)]||[];return {title:title+'会影响什么',body:`<p>${esc(effect)}</p><p class="info-secondary">${esc(advice)}</p>`};}
 if(key==='desk-life')return {title:'生活与账单',body:`<div class="desk-life-links"><button class="button small" data-action="go-work">去打工</button><button class="button small" data-action="life-rebuild">接单赚钱</button><button class="button small" data-action="debt-calendar">还款日历</button><button class="button small" data-action="life-hub">人物与约定${s.lifeArcs?.pending?' · 新消息':''}</button><button class="button small" data-action="behavior-hub">状态与消息${s.behavior?.pending?' · 新消息':''}</button></div>`};
 if(key==='budget')return {title:'现金与生活费',body:`${renderLivingCosts(s,ctx)}<p>生活费按日扣除，预留金额仍可使用。</p><p>可以梭哈；之后付不起生活费会进入求生期。</p><button class="text-button" data-action="go-work">去打工 →</button>`};
 if(key==='work')return {title:'工钱与工资',body:'<p>「认真打工」「接点零活」完成即到账。</p><p>全天零工：上午至 18:30。晚班：18:30–22:30。有固定工作只能接晚班。每日接活上限合计一天。</p><p>「找份工作」获得固定月薪，平时计入待发工资，每月 10 号发上月工资；到账前不能花。</p><p>学习、休息、见朋友各用 1 点精力。</p>'};
 if(key==='behavior')return {title:'上头与疲劳',body:'<p>频繁交易、下注会积累上头和疲劳。</p><p>疲劳达到 65 后会导致工作出错，工资和兼职收入减少 25%；休息降至 65 以下可解除。</p><button class="text-button" data-action="behavior-hub">打开状态与消息 →</button>'};
 if(key==='period'){
  const v=getSurvivalStatus(s),n=nextStep(s,null);
  return {title:'时间与生活账单',body:`<p>每日开销 <b>${money(v.dailyExpense)}</b> · 今日待到账 <b>${money(v.dailyIncome)}</b></p>${renderCashBudget(s,{...ctx,compact:true})}${renderLivingCosts(s,ctx)}${renderTimePanel(s,ctx).replace('<details class="time-preview">','<details class="time-preview" open>')}<hr><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>${routeButton(n.route,'去这一步',ctx)} <button class="text-button" data-action="help">玩法手册</button>`};
 }
 if(key==='markets')return {title:'市场开放',body:`<p>故事介绍过的市场会保留在列表中，条件不满足时可查看开放条件；满足条件后才能交易。没有参与经验或模拟练习次数要求。新市场和持仓行情变化会亮红点，查看对应市场后清除。</p><p>自有金融资产 ${money(marketCapital(s))}：现金＋可计入的证券持仓－全部欠款。家庭储备、房产和未退出的股权不计入。</p><p>模拟练习可选：1 点精力，眼力 +10，不花现金。</p>`};
 if(key.startsWith('market:')){
  const kind=key.slice(7),g=MARKET_GUIDES[kind],p=products.find(p=>p[0]===kind);
  if(!g)return {title:'市场玩法',body:'<p>这个市场尚未开放。</p>'};
  return {title:(kind==='option'?'期权':kind==='gambling'?'深夜赌局':p?.[1]||'市场')+' · 玩法',body:`<p><strong>${esc(g.action)}</strong></p><p>${esc(g.timing)}。</p><p>${esc(g.risk)}</p><p>${esc(g.detail)}</p>${kind!=='gambling'&&kind!=='stock'?`<p>最低投入 ${money(PRODUCTS[kind].min)}${kind==='option'?'；卖方保证金至少 '+money(PRODUCTS.option_short.min):''}。</p>`:''}`};
 }
 return {title:'玩法说明',body:'<button class="text-button" data-action="help">打开玩法手册</button>'};
}
