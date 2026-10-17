import {getSurvivalStatus,getTurnMonths,getActionAvailability} from '../game/core.js';
import {shouldOfferDayOff} from '../game/attendance.js';
import {canSettleChapterDay,chapterPause} from '../game/chapter-progress.js';

// A deliberate one-day settlement is always separate from automatic stage progress.
export function renderShortfallSettlement(s,ctx={money:n=>`¥${(n/100).toFixed(2)}`}){
 const v=getSurvivalStatus(s),full=(s.debtClock?.periodDays||0)>=getTurnMonths(s)*30;
 if(v.needsCare&&!full&&chapterPause(s)?.kind==='health'&&getActionAvailability(s,{type:'calendar_day'}).allowed){
  const billed=v.lastBilledDay===s.trading.day;
  return `<div class="shortfall-settlement health-day-settlement"><div><strong>暂时不治疗，也能继续过一天</strong><p>${billed?'今天已结算，将按下一天的实际伙食和生活开销结算。':v.foodShortage?`今天伙食不足，预计健康 −${v.expectedHealthLoss}；未吃到的饭不收费。`:'今天基本伙食够付，不会因缺食扣健康；继续生活不等于接受治疗。'}健康降至 0 时本局结束。</p><p>不收医疗费，不恢复住院健康；未付固定费用仍记欠款。结算不消耗精力。</p></div><button class="button" data-action="life-action" data-type="calendar_day">暂不治疗 · 过一天</button></div>`;
 }
 if(!v.shortage&&!(full&&s.debts.length)||!canSettleChapterDay(s)||shouldOfferDayOff(s))return '';
 if(full)return '<div class="shortfall-settlement"><div><strong>本期生活费已经按天结算</strong><p>还没还清的欠款可以带入下一账期，利息与逾期后果照常计算。</p></div><button class="button" data-action="chapter-settle-day">进入下一账期 · 保留欠款</button></div>';
 const billed=v.lastBilledDay===s.trading.day;
 return `<div class="shortfall-settlement"><div><strong>${s.actionPoints===0?'精力用完，也能继续过日子':'暂时补不上，也可以先过一天'}</strong><p>${v.foodShortage?`未吃到的伙食不收费；预计健康 −${v.expectedHealthLoss}，缺食天数继续累计。`:'现金和今日到账优先付伙食；伙食够付时，其他欠费不扣健康。'}</p><p>结算不消耗精力，之后恢复至 2 点。未付固定费用预计 ${ctx.money(v.expectedDebt)}，记为欠款；到期还款照常处理。</p></div><button class="button" data-action="chapter-settle-day">${billed?'过下一天 · 未付固定费用记欠款':v.foodShortage?'挨饿过今天 · 承担健康损失':'先结算今天 · 未付固定费用记欠款'}</button></div>`;
}
