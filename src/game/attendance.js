import {hasSalariedJob} from './work-economy.js';
import {startJobSearch} from './job-search.js';
const now=s=>s.debtClock?.day||0;
export const ATTENDANCE_LIMITS={leave:3,absent:1};
const fresh=()=>({job:0,lateDay:null,records:[]});
export function attendanceStatus(s){
 const a=s.attendance??fresh(),day=now(s),rows=a.records.filter(r=>r.job===a.job&&r.day<=day&&day-r.day<30),today=a.records.find(r=>r.day===day);
 return {leave:rows.filter(r=>r.kind==='leave').length,absent:rows.filter(r=>r.kind==='absent').length,today,last:a.records.at(-1)};
}
export function noteLateNight(s){const a=s.attendance??=fresh();a.lateDay=now(s);}
export function attendanceJobStart(s){if(s.attendance){s.attendance.job++;s.behavior.leaveDays=0;}}
export function attendanceReason(s){
 if(!hasSalariedJob(s)||s.behavior?.jobStartsTomorrow)return '当前没有已经入职的工作';
 if(attendanceStatus(s).today)return '今天已经记录过请假或旷工';
 return '';
}
export function dismissedToday(s){const last=s.attendance?.records.at(-1);return Boolean(last?.fired&&last.day===now(s));}
export function shouldOfferDayOff(s){
 const r=s.dayRoutine,stage=r?.stage??[1,2,3,8][s.trading.phase];
 if(attendanceReason(s)||s.behavior?.leaveDays||![0,1].includes(stage)||r?.choices[stage]||stage===1&&r?.choices[0]==='breakfast')return false;
 return Boolean(r?.nightStreak>0||s.attendance?.lateDay===now(s)-1);
}
export function attendanceOptions(s){
 const n=attendanceStatus(s);
 return [['day_leave','请一天假',`无薪 · 疲劳 −12 · 近 30 天 ${n.leave}/3 次${n.leave>=3?' · 再请将开除，无补偿':''}`],['day_absent','不打招呼，旷工不去',`无薪 · 压力 +5 · 近 30 天 ${n.absent}/1 次${n.absent>=1?' · 再旷将开除，无补偿':''}`]];
}
export function recordAbsence(s,kind,api,{fatigue=kind==='leave'?12:6}={}){
 api.syncEmployment?.(s);
 const reason=attendanceReason(s);if(reason)throw Error(reason);
 const a=s.attendance??=fresh(),count=attendanceStatus(s)[kind]+1,fired=count>ATTENDANCE_LIMITS[kind];
 a.records.push({day:now(s),job:a.job,kind,fired});a.records=a.records.slice(-60);
 s.behavior.leaveDays=1;s.behavior.fatigue=Math.max(0,s.behavior.fatigue-fatigue);
 api.stat(s,kind==='leave'?{stress:-2}:{stress:5,trust:-2});
 const label=kind==='leave'?'请假':'旷工';
 if(fired){s.monthlyIncome=0;s.occupation='因缺勤被开除';s.flags.employed=false;s.flags.fired_for_absence=true;s.behavior.leaveDays=0;s.behavior.jobStartsTomorrow=false;if(s.behavior.pending==='work_warning')s.behavior.pending=null;
  startJobSearch(s,{source:'dismissal'});
  return `近 30 天${label} ${count} 次，超过 ${ATTENDANCE_LIMITS[kind]} 次。你被开除了，没有补偿金；当天起停薪，生活费照扣。重新找工作需要投递和面试，暂时先安排过渡生活。`;
 }
 return `今天${label}，不领工资，生活费照扣。近 30 天${label} ${count}/${ATTENDANCE_LIMITS[kind]} 次${count===ATTENDANCE_LIMITS[kind]?'，再来一次会被开除，没有补偿金':''}。`;
}
export function validateAttendance(s){
 const a=s.attendance;if(a===undefined)return;const int=n=>Number.isSafeInteger(n)&&n>=0,bad=()=>{throw Error('工作出勤记录无效');};
 if(!a||Array.isArray(a)||!int(a.job)||!(a.lateDay===null||int(a.lateDay)&&a.lateDay<=now(s))||!Array.isArray(a.records)||a.records.length>60)bad();
 let prior=-1;for(const r of a.records){if(!r||!int(r.day)||r.day>now(s)||r.day<=prior||!int(r.job)||r.job>a.job||!Object.hasOwn(ATTENDANCE_LIMITS,r.kind)||typeof r.fired!=='boolean')bad();prior=r.day;}
}
