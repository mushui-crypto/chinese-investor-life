import {getMetrics} from '../game/core.js';
import {cashBudget} from '../game/order-budget.js';
import {infoButton} from './info-popover.js';
export function renderCashBudget(s,{money,compact=false,order=false,quiet=false,verb='买入'},spend=null){
 const b=cashBudget(s,getMetrics(s),spend??0);
 return `<section class="cash-budget ${compact?'compact-budget':''} ${order?'order-budget':''}" aria-label="现金与生活开支"><dl><div><dt>当前现金</dt><dd data-budget="cash">${money(b.cash)}</dd></div><div><dt>本期剩余生活费${quiet?infoButton('budget','生活费预留规则'):''}</dt><dd data-budget="living">${money(b.remaining)}</dd></div><div><dt>留足生活费后剩余</dt><dd data-budget="spare">${money(b.spare)}</dd></div></dl>${!quiet||b.shortage||spend!==null?`<div class="budget-footer">${b.shortage?`<p class="cash-shortage">生活费还差 ${money(b.shortage)}</p>`:''}${quiet?'':compact&&!order?`<span class="budget-rule">生活费提醒 ${infoButton('budget','生活费预留规则')}</span>`:order?infoButton('budget','生活费按日扣除'):`<span class="budget-rule">生活费 ${infoButton('budget','生活费预留规则')}</span>`}${spend!==null?renderSpendingWarning(s,spend,{money,verb}):'<button type="button" class="button small market-route-button budget-work-button" data-action="go-work">去打工</button>'}</div>`:''}</section>`;
}
export function renderSpendingWarning(s,spend,{money,verb='买入'}){
 if(!Number.isSafeInteger(spend)||spend<0)return '';
 const b=cashBudget(s,getMetrics(s),spend);
 if(b.after<0)return `<p class="cash-shortage">实际现金不足，还差 ${money(-b.after)}。</p><button type="button" class="button small market-route-button budget-work-button" data-action="go-work">去打工</button>`;
 return `<div class="cash-warning ${b.afterShortage?'shortfall':''}" role="status">${b.afterShortage?`这笔${verb}后还剩 ${money(b.after)}，本期剩余生活费需要 ${money(b.remaining)}，还差 ${money(b.afterShortage)}。仍可${verb}。`:`这笔${verb}后还剩 ${money(b.after)}，生活费够用。`}<button type="button" class="button small market-route-button budget-work-button" data-action="go-work">去打工</button></div>`;
}
