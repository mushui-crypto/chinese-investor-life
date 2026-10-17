import {getActionAvailability} from '../game/core.js';
import {HOSPITAL_COST,HOSPITAL_RECOVERY} from '../game/survival.js';
import {renderShortfallSettlement} from './shortfall-settlement.js';

export function renderHospitalDialog(s,{money,esc}){
 const care=getActionAvailability(s,{type:'hospital'}),short=Math.max(0,HOSPITAL_COST-s.cash);
 return `<div class="hospital-options"><p>住院治疗与观察一天，健康恢复至 ${HOSPITAL_RECOVERY}。医疗费须先用现金付清，不能记欠款。</p><dl class="hospital-costs"><div><dt>住院费用</dt><dd>${money(HOSPITAL_COST)}</dd></div><div><dt>手头现金</dt><dd>${money(s.cash)}</dd></div>${short?`<div><dt>还差</dt><dd>${money(short)}</dd></div>`:''}</dl><p>住院当天供餐、不计工作工资；房租等固定费用和原持仓照常结算。</p>${!care.allowed?`<p class="hospital-reason" id="hospital-reason">${esc(care.reason)}</p>`:''}<div class="hospital-actions"><button class="button primary" data-action="life-action" data-type="hospital" ${care.allowed?'':'disabled aria-describedby="hospital-reason"'}>支付 ${money(HOSPITAL_COST)} · 住院一天</button><button class="button" data-action="rescue-options">筹钱周转</button></div>${renderShortfallSettlement(s,{money})}<div class="dialog-footer"><button class="text-button" data-action="close-dialog">返回生活安排</button></div></div>`;
}
