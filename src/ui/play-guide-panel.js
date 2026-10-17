import {MARKET_GUIDES} from '../game/market-guide.js';
import {tradeTerms} from '../game/trade-terms.js';
import {marketMenuKey,marketIsOpen} from './market-menu.js';
import {cryptoModeFor} from '../game/crypto-markets.js';
import {actionQuip} from './action-motion.js';
import {continuation} from '../game/continuation.js';
import {GOALS,journey,goalStatus,nextStep,timePreview} from '../game/play-guide.js';
import {getMetrics,getActionAvailability,getSurvivalStatus,getLegalStatus} from '../game/core.js';
import {getMarketAccess,getGamblingAccess} from '../game/market-access.js';
import {DESKS,MARKET_ACTIONS} from '../game/market-play.js';
export function routeButton(route,label,ctx,cls='button small'){
 const {esc}=ctx;return `<button class="${cls}" data-action="guide-route" data-route="${esc(JSON.stringify(route))}">${esc(label)}</button>`;
}
export function renderGuide(s,desk,ctx){const n=nextStep(s,desk);return `<section class="play-guide" aria-label="下一步玩法指引"><div><strong>${ctx.esc(n.title)}</strong><p>${ctx.esc(n.text)}</p></div>${routeButton(n.route,'去这一步',ctx)}<button class="text-button" data-action="help">玩法手册</button>${s.age>=18&&!getLegalStatus(s).inPrison?'<button class="text-button guide-life-link" data-action="behavior-hub">状态与消息</button>':''}</section>`;}
export function renderTimePanel(s,ctx){
 if(s.age<18||s.phase==='ended')return '';
 const {money,esc,ageText}=ctx,p=timePreview(s),t=s.trading,stage=s.age>=18&&s.age<80&&!getLegalStatus(s).inPrison;
 return `<details class="time-preview"><summary><strong>本期尚余 ${Math.max(0,p.months*30-(s.debtClock?.periodDays||0))} 个生活日</strong><span>${p.nextBill?`${esc(p.nextBill.name)} · ${p.nextBill.overdue?'已有逾期':p.nextBill.days+' 天后到期'}`:'账单与时间说明'}</span></summary><div><p>${ctx.market==='crypto'?'加密行情跨过 24:00 算过一天，市场继续交易':'行情走到收盘算过一天'}；进入下一段人生时才会长岁数。阶段推进会在资金不足或重要事件前暂停。以下仅计算本账期未结算的部分。</p><dl><div><dt>预计固定收入到账</dt><dd>+${money(p.salary)}</dd></div><div><dt>还要交生活费</dt><dd>−${money(p.living)}</dd></div><div><dt>预计到期还款</dt><dd>−${money(p.debt)}</dd></div></dl><p class="forecast-total">结算后预计现金 ${money(p.cashAfter)}${p.cashAfter<0?'，需要先安排资金。':'。'}</p><small>未计持仓涨跌、生意和突发开销。</small><div class="guide-actions"><button class="button small" data-action="debt-calendar">查看具体账单</button><button class="button small" data-action="${stage?'stage-return':'next-turn'}" ${s.phase==='planning'?'':'disabled'}>${stage?'回到阶段安排':esc(continuation(s,{skipMarket:true}).label)}</button></div></div></details>`;
}
export function renderGoal(s,ctx){if(s.age<18)return '';const g=goalStatus(s),{esc,money}=ctx;return `<section class="goal-panel"><div class="section-heading"><h2>眼前的小目标</h2><button class="text-button" data-action="goals">换一个</button></div><strong>${esc(g.title)}</strong><progress max="1" value="${g.ratio}" aria-label="阶段目标进度"></progress><p>${g.done?'目标完成了。':['buffer','debt'].includes(g.key)?`${money(g.current)} / ${money(g.target)}`:`${g.current} / ${g.target} 项`}</p>${routeButton(g.done?{type:'goals'}:g.route,g.done?'选择下一目标':'看看怎么做',ctx)}</section>`;}
export function renderGoals(s,ctx){return `<p class="dialog-intro">目标无奖金，可随时更换。</p><div class="goal-choices">${Object.entries(GOALS).map(([key,title])=>{const g=goalStatus(s,key),disabled=key==='debt'&&getMetrics(s).debt<=0;return `<button class="behavior-choice" data-action="set-goal" data-goal="${key}" aria-pressed="${journey(s).goal===key}" ${disabled?'disabled':''}><strong>${ctx.esc(title)}${journey(s).goal===key?' · 当前目标':''}</strong><span>${disabled?'现在没有欠款':ctx.esc(g.hint)}</span></button>`;}).join('')}</div>`;}
export function renderMarketFocus(s,ctx){
 const {esc,money,icon}=ctx,watch=[...new Set(journey(s).watchlist.map(marketMenuKey))],positions=s.positions;
 return `<section class="market-focus"><div class="section-heading"><h2>${icon('wallet')} 持仓概览</h2><button class="text-button" data-action="tab" data-tab="assets">完整资产账本</button></div>${positions.length?`<div class="focus-holdings">${positions.map(p=>{const product=p.kind==='crypto_perp'?'crypto':p.kind,a=getActionAvailability(s,{type:'desk_sell',id:p.id,bps:10000});return `<article><div><strong>${esc(p.name)}</strong><small>${a.allowed?'可'+tradeTerms(p.kind).close:esc(a.reason)}</small></div><div><b>${money(p.value,true)}</b><small class="${p.value>=p.cost?'positive':'negative'}">浮动盈亏 ${p.value>=p.cost?'+':''}${money(p.value-p.cost,true)}</small></div><button class="button small" data-action="desk-open" data-product="${esc(product)}" data-instrument="${esc(p.instrument||'')}" data-mode="${cryptoModeFor(p)}">查看持仓</button></article>`;}).join('')}</div>`:'<p class="focus-empty">暂无持仓。</p>'}<div class="watch-heading"><h3>我关注的市场</h3><button class="text-button" data-action="browse-markets">选择新市场 ↓</button></div><div class="watch-markets">${watch.filter(key=>marketIsOpen(s,key)).map(key=>{const a=key==='gambling'?getGamblingAccess(s):key==='option'?{unlocked:getMarketAccess(s,'option').unlocked||getMarketAccess(s,'option_short').unlocked}:getMarketAccess(s,key);return `<button class="watch-market" data-action="desk-open" data-product="${key}"><strong>${esc(key==='option'?'期权交易室':DESKS[key].title)}</strong><span>${a.unlocked?'进入交易室':'查看玩法与开放条件'}</span></button>`;}).join('')||'<p>点市场旁的星星即可关注。</p>'}</div>${s.trading.stockNews?`<details class="focus-news"><summary>最近的股票消息</summary><p>${esc(s.trading.stockNews)}</p></details>`:''}</section>`;
}
export function receiptSummary(s){
 const r=s.lastResult;if(!r||s.phase!=='planning'||!journey(s).lastAction)return null;
 // Old saves can retain the last removed stock action; do not resurface its tutorial receipt.
 const action=journey(s).lastAction;if(action==='crypto_replay'||action==='stock_card'||(action==='desk_research'&&/^(订单抽样|回款核查|供应商访谈)/.test(r.text||'')))return null;
 const value=label=>r.changes?.find(c=>c.label===label)?.value||0;
 const brief=(r.text||r.title||'操作已记录').split(/[。\n]/)[0];
 return {r,brief:brief.length>110?brief.slice(0,107)+'…':brief,cash:value('现金'),worth:value('净资产'),debt:value('负债')};
}
export function renderInlineReceipt(s,ctx,{expanded=false,scope='all'}={}){
 const action=journey(s).lastAction;
 if(scope==='life'&&(MARKET_ACTIONS.has(action)||['invest','sell','market_practice','market_review'].includes(action)))return '';
 const q=receiptSummary(s);if(!q)return '';const {r}=q,{esc,money}=ctx,delta=n=>(n>0?'+':'')+money(n,true);
 return `<section class="inline-receipt" role="status" aria-live="polite"><strong>${esc(expanded?r.title||q.brief:q.brief)}</strong><div class="receipt-metrics"><span>现金 <b>${delta(q.cash)}</b></span><span>净资产变化 <b>${delta(q.worth)}</b></span>${q.debt?`<span>负债 <b>${delta(q.debt)}</b></span>`:''}</div>${expanded?'<div class="receipt-detail">':'<details><summary>查看这次明细</summary>'}<p>${esc(r.text)}</p>${r.chapterRun?.kind==='expense'?'<button class="button small" data-action="chapter-bills">查看账单 →</button>':''}${actionQuip(s)?`<p class="action-quip">${esc(actionQuip(s))}</p>`:''}${r.statChanges?.length?`<p>${r.statChanges.map(c=>`${esc(({health:'健康',stress:'压力',academic:'学业',discipline:'自律',insight:'眼力',skill:'本事',trust:'人缘',credit:'信用',fame:'名气'})[c.key]||c.key)} ${c.value>0?'+':''}${c.value}`).join(' · ')}</p>`:''}${expanded?'</div>':'</details>'}</section>`;
}
export function renderDeskGuide(s,kind,ctx){
 const g=MARKET_GUIDES[kind];if(!g)return '';
 return `<details class="desk-play-help"><summary>交易规则与费用</summary><p>${ctx.esc(g.risk)}</p><p>${ctx.esc(g.detail)}</p></details>`;
}
