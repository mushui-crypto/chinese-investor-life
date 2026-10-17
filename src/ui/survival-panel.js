import {renderFixedIncome} from './payroll.js';
import {getSurvivalStatus,getActionAvailability} from '../game/core.js';
import {FOOD_DAILY_COST,HUNGER_HEALTH_LOSS,HOSPITAL_THRESHOLD,CRITICAL_HEALTH,HOSPITAL_COST,HOSPITAL_RECOVERY} from '../game/survival.js';
export function healthRules({money}){
 return `<p>每日基本伙食 ${money(FOOD_DAILY_COST)} 已包含在生活费里，结算时优先支付。完全缺食一天健康 −${HUNGER_HEALTH_LOSS}，部分不足按比例向上取整；未吃到的伙食不收费，房租等未付固定费用记欠款。</p><p>健康 ≤${HOSPITAL_THRESHOLD} 需要就医，≤${CRITICAL_HEALTH} 为危急，降至 0 本局结束；持续缺食造成的死亡记为饥饿结局。休息不能代替吃饭。</p><p>住院治疗与观察占用一天，医疗费 ${money(HOSPITAL_COST)}，健康恢复至 ${HOSPITAL_RECOVERY}；当天供餐、不计工作工资，须先用现金付清，不允许医疗费赊欠。钱不足时可筹钱，或暂不治疗、逐日生活。上述数值为游戏规则。</p>`;
}
export function foodSettlementResult(last,{money}){
 if(!last||last.foodDue===undefined)return '';
 return `<p class="food-settlement-result"><span>上次伙食${last.hospital?'由医院提供':`已付 ${money(last.foodPaid)} / ${money(last.foodDue)}`}</span><span>缺食扣健康 <strong>${last.healthLost?`−${last.healthLost}`:'0'}</strong></span></p>`;
}
export function survivalStreaks(v){
 return `<p class="survival-streaks"><span>连续欠费 <strong>${v.unpaidDays}</strong> 天</span><span${v.hungryDays?' class="is-hungry"':''}>连续缺食 <strong>${v.hungryDays}</strong> 天</span></p>`;
}
export function foodHealthControls(s,ctx,{panel=false}={}){
 const {money,esc}=ctx,v=getSurvivalStatus(s),food=getActionAvailability(s,{type:'secure_food'});
 return `<div class="survival-health ${v.needsCare?'needs-care':''}" aria-label="伙食与健康"><div><strong>健康 ${Math.round(v.health)} / 100 · ${v.healthLevel===2?'危急':v.needsCare?'需要就医':v.hungryDays?'正在缺食':'正常'}</strong>${foodSettlementResult(v.last,ctx)}<p>${v.lastBilledDay===s.trading.day?'今日已经结算。':v.foodSecured?'今日基本伙食已安排，日结不重复扣。':v.foodShortage?`今天伙食还差 ${money(v.foodShortage)}；直接结算预计健康 −${v.expectedHealthLoss}。`:`今天现金与预计收入够付 ${money(v.foodDue)} 伙食。`}${v.needsCare?'可查看治疗费用；暂不治疗也能逐日生活。':''}</p></div><div class="survival-health-actions">${v.lastBilledDay===s.trading.day?'':`<button class="button small" data-action="life-action" data-type="secure_food" ${food.allowed?'':`disabled title="${esc(food.reason)}"`}>${v.foodSecured?'伙食已安排':`先安排伙食 ${money(v.foodRemaining)}`}</button>`}${v.needsCare?`<button class="button primary small" data-action="hospital-options" >去医院</button>`:''}${panel?'<button class="button small" data-action="rescue-options">安排生活费</button><button class="button small" data-action="tab" data-tab="assets">查看可卖资产</button>':''}</div></div>`;
}
export function renderSurvivalPanel(s,ctx){
 const {money}=ctx,v=getSurvivalStatus(s);if(v.exempt)return '';
 const urgent=v.active||v.needsCare||v.hungryDays>0;
 const panel=`<section class="survival-panel ${urgent?'survival-crisis':''}" aria-label="生活与健康"><div class="survival-heading"><div><h2>${v.needsCare?'健康告急':v.active?'生活费告急':'每日生活账'}</h2><p>${v.shortage?`今天生活费还差 ${money(v.shortage)}。`:v.active?'今天够付，后续生活费仍需安排。':'生活费用与健康单独结算。'}</p>${survivalStreaks(v)}</div></div><dl class="survival-metrics"><div><dt>每日开销</dt><dd>${money(v.dailyExpense)}</dd></div><div><dt>今日待到账</dt><dd>${money(v.dailyIncome)}</dd></div><div><dt>可变现资产</dt><dd>${money(v.cashableAssets,true)}</dd></div></dl>${renderFixedIncome(s,ctx)}${foodHealthControls(s,ctx,{panel:true})}<details class="survival-rules"><summary>健康规则与日结明细</summary>${healthRules(ctx)}<p>只有推进时间才结算；欠款不会自动免除，持仓不会自动卖出。付清一天生活费中断连续欠费。今日到账覆盖开销或备齐 ${money(v.buffer)} 后结束应急期。</p>${v.last?`<p>上次日结：实付 ${money(v.last.paid)}，固定费用欠款 ${money(v.last.shortfall)}${v.last.foodUnspent&&!v.last.hospital?`，未消费伙食 ${money(v.last.foodUnspent)}（不记欠款）`:""}${v.last.healthLost?`，缺食损失健康 ${v.last.healthLost}`:''}。</p>`:''}</details></section>`;
 return urgent?panel:`<details class="daily-account-drawer"><summary>每日生活账 · 开销 ${money(v.dailyExpense)}</summary>${panel}</details>`;
}
