import {isCollegeStudent} from './education.js';
/** Fictional hard-mode wages, in cents. No real-world salary dataset is implied. */
export const ECONOMY_REVISION=1;
export const FATIGUE_WORK_THRESHOLD=65;
export const fatigueAffectsIncome=s=>(s.behavior?.fatigue||0)>=FATIGUE_WORK_THRESHOLD;
export const fatigueIncomeReason=s=>fatigueAffectsIncome(s)?'疲劳导致工作出错，本次工作收入减少 25%。':'';
const skill=s=>Math.max(0,Math.min(100,Math.floor(s.stats.skill)));
export const jobMonthlyPay=s=>(2200+skill(s)*20)*100;
export const fullDayPay=(s,type='work')=>(80+skill(s)*(type==='gig'?.2:.4))*100;
export const halfDayPay=s=>Math.floor(fullDayPay(s)/2);
export const overtimePay=s=>Math.min(2500,Math.floor(s.monthlyIncome/150));
export const hasSalariedJob=s=>!isCollegeStudent(s)&&s.monthlyIncome>0&&s.occupation!=='退休'&&!s.legal?.prisonMonthsLeft;
export function preservePension(s){if(s.occupation==='退休')s.retirementIncome??=s.monthlyIncome;}
export const monthlyReceipts=s=>(isCollegeStudent(s)?0:s.monthlyIncome)+(s.occupation==='退休'?0:s.retirementIncome||0);
export function lateWagePenalty(s,base){
 if(!hasSalariedJob(s)||!s.dayRoutine?.lateForWork||s.behavior?.leaveDays||s.behavior?.jobStartsTomorrow)return 0;
 const wage=Math.max(0,base-Math.floor((s.retirementIncome||0)/30));return Math.floor(wage*.1);
}
export const lateWageReason=(s,base)=>lateWagePenalty(s,base)?`熬夜睡过头，上班迟到，扣当天工资 10%（¥${(lateWagePenalty(s,base)/100).toFixed(2)}）。`:'';
export function dailyWageQuote(s,base){
 if(!hasSalariedJob(s))return base;
 const pension=Math.min(base,Math.floor((s.retirementIncome||0)/30)),wage=base-pension;
 if(s.behavior?.leaveDays||s.behavior?.jobStartsTomorrow)return pension;
 return base-((fatigueAffectsIncome(s)||s.dayRoutine?.wagePenalty)?Math.floor(wage*.25):0)-lateWagePenalty(s,base);
}
const dayKey=s=>`${s.turn}:${s.trading.day}`;
export const workUnitsLeft=s=>2-(s.workday?.key===dayKey(s)?s.workday.units:0);
export function workLimitReason(s,units=2){
 if(s.trading.phase===3||s.survival?.lastBilledDay===s.trading.day)return '今天已经结账，明天再接活';
 return workUnitsLeft(s)>=units?'':workUnitsLeft(s)===1?'今天只剩半天接活时间，可去日常安排接半天零工':'今天的零工已经做满，明天再接';
}
export function fullDayWorkReason(s){
 if(isCollegeStudent(s))return '大学期间可在日常安排接半天兼职或晚班兼职';
 const quota=workLimitReason(s);if(quota)return quota;
 if(hasSalariedJob(s))return '白天有固定工作，18:30 下班后可接晚班零工';
 const r=s.dayRoutine,stage=r?.stage??[1,2,3,8][s.trading.phase];
 if(stage>1||r?.choices[1]||r?.choices[3])return '整天的活要上午开始，可在日常安排里接剩余时段的零工';
 return r?.pending?'先处理眼前的日常小事':'';
}
export function recordWork(s,units){const reason=workLimitReason(s,units);if(reason)throw Error(reason);s.workday={key:dayKey(s),units:2-workUnitsLeft(s)+units};}
export function validateWorkEconomy(s){
 if(s.economyRevision!==undefined&&s.economyRevision!==ECONOMY_REVISION)throw Error('收入规则版本无效');
 if(s.workday!==undefined&&(!s.workday||typeof s.workday.key!=='string'||!/^\d+:\d+$/.test(s.workday.key)||!Number.isInteger(s.workday.units)||s.workday.units<0||s.workday.units>2))throw Error('当天接活记录无效');
}

export function markNewJobStart(s,previousWage){
 const stage=s.dayRoutine?.stage??[1,2,3,8][s.trading.phase];
 if(!previousWage&&hasSalariedJob(s)&&stage>=2&&s.trading.phase<3&&s.survival?.lastBilledDay!==s.trading.day)s.behavior.jobStartsTomorrow=true;
}
