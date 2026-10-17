import {routineNext} from './day-routine.js';
import {childhoodContinueLabel} from './childhood-stages.js';
import {getTurnMonths,getSurvivalStatus,getLegalStatus,getActionAvailability,getDebtCalendar} from './core.js';
/** Read-only plan. No market draw, event outcome or undiscovered motive is exposed. */
export function continuation(s,{skipMarket=false,market=null}={}){
 if(s.phase==='ended')return {kind:'ended',label:'查看人生账单',days:0};
 if(s.phase==='event')return {kind:'story',label:'继续 · 处理眼前的故事',days:0};
 if(s.age<18&&s.phase!=='event')return {kind:'childhood',label:s.phase==='result'?'安排这一阶段':childhoodContinueLabel(s),days:0};
 if(s.phase==='result')return {kind:'result',label:'继续 · 读下一件事',days:0};
 const months=getTurnMonths(s);
 if(getLegalStatus(s).inPrison)return {kind:'period',label:`继续 · ${months} 个月`,days:months*30};
 const left=Math.max(0,months*30-(s.debtClock?.periodDays||0)),t=s.trading;
 if(s.dayRoutine?.pending)return {kind:'daily',label:'查看当前事件',days:0};
 if(left>0&&getSurvivalStatus(s).needsCare)return {kind:'health',label:'健康告急 · 去医院',days:0};
 if(getSurvivalStatus(s).active&&left>0&&s.trading.phase===3)return {kind:'action',action:{type:'day_next'},label:'起床 · 安排新的一天',days:0};
 if(getSurvivalStatus(s).active&&left>0)return {kind:'action',action:{type:'day_next'},label:routineNext(s),days:0};
 if(s.lifeArcs?.pending)return {kind:'life',label:'继续 · 看看新消息',days:0};
 if(s.behavior?.pending)return {kind:'behavior',label:'继续 · 处理盘外的事',days:0};
 if(!left)return {kind:'period',label:'继续 · 本期结算与下一阶段',days:0};
 if(skipMarket){
  const days=Math.min(30,left);
  return {kind:'action',action:{type:'live_days',days},label:`快进 · 最多 ${days} 天`,days};
 }
 return {kind:'action',action:{type:'day_next'},label:routineNext(s),days:0};
}
