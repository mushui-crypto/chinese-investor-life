import {HOUSING_PLANS,FOOD_PLANS,livingPlan,movingCost,minimumLivingCost} from '../game/living-plan.js';
import {collegeSupportStatus} from '../game/college-support.js';
import {livingCostBreakdown} from '../game/living-costs.js';
import {getActionAvailability} from '../game/core.js';
export function livingPlanAction(form){const d=new FormData(form);return {type:'living_plan',housing:d.get('housing'),food:d.get('food'),cutExtras:d.has('cutExtras')};}
export function renderLivingPlan(s,{money,esc}){
 const p=livingPlan(s),group=(name,title,items)=>`<fieldset class="plan-options"><legend>${title}</legend>${Object.entries(items).map(([id,o])=>`<label class="mode-option"><input type="radio" name="${name}" value="${id}" ${p[name]===id?'checked':''}><span><strong>${esc(o.name)}</strong><small>${esc(o.note)}</small></span></label>`).join('')}</fieldset>`;
 return `<form id="living-plan-form" class="life-plan-form"><p class="dialog-intro">省吃住，留一点余钱。家人的开支、还款和临时账单另算。</p>${group('housing','住在哪里',HOUSING_PLANS)}${group('food','怎么吃饭',FOOD_PLANS)}${s.lifeArcs.lifestyle||s.lifeArcs.consumption?.monthly?`<label class="check-field"><input name="cutExtras" type="checkbox">取消每月 ¥${((s.lifeArcs.lifestyle||0)+(s.lifeArcs.consumption?.monthly||0))/100} 额外消费</label>`:''}<div class="plan-preview" aria-live="polite"></div><p class="field-help">调整用 1 点精力；住处每 30 天可换一次。个人基本开销最低 ${money(minimumLivingCost(s))} / 月，从下次日结起生效。</p><div class="dialog-footer"><button class="button" type="button" data-action="close-dialog">暂时不改</button><button class="button primary" type="submit">照这样生活</button></div><p class="form-error" role="alert"></p></form>`;
}
export function updateLivingPlan(form,s,{money}){
 const a=livingPlanAction(form),preview={...s,livingPlan:{...livingPlan(s),housing:a.housing,food:a.food},lifeArcs:{...s.lifeArcs,lifestyle:a.cutExtras?0:s.lifeArcs.lifestyle,...(s.lifeArcs.consumption?{consumption:{...s.lifeArcs.consumption,monthly:a.cutExtras?0:s.lifeArcs.consumption.monthly}}:{})}},before=livingCostBreakdown(s),after=livingCostBreakdown(preview),fee=movingCost(s,a.housing),net=s.monthlyIncome+collegeSupportStatus(s).monthly-after.total,can=getActionAvailability(s,a);
 form.querySelector('.plan-preview').innerHTML=`<dl><div><dt>每月生活费</dt><dd>${money(after.total)}</dd></div><div><dt>比现在${after.total<=before.total?'少':'多'}</dt><dd>${money(Math.abs(before.total-after.total))} / 月</dd></div><div><dt>固定收入 − 生活费</dt><dd>${net>=0?'+':'−'}${money(Math.abs(net))} / 月</dd></div>${fee?`<div><dt>这次搬家</dt><dd>${money(fee)}</dd></div>`:''}</dl><small>未扣还款和临时开销。</small>`;
 form.querySelector('[type=submit]').disabled=!can.allowed;form.querySelector('.form-error').textContent=can.reason||'';
}
export function renderRoutineReceipt(s,{esc}){
 const r=s.lastResult?.routineRun;if(!r)return '';
 return `<div class="routine-receipt" role="status"><strong>${r.days?`按作息过了 ${r.days} 天`:'作息暂时停下'}</strong><span>${esc(r.reason)}</span>${r.handled.length?`<details><summary>已处理 ${r.handled.length} 件小事</summary><ul>${r.handled.map(h=>`<li>第 ${h.day} 天 · ${esc(h.title)}：${esc(h.choice)}</li>`).join('')}</ul></details>`:''}</div>`;
}
