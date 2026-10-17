import {gameDate,addGameDays,validGameDate} from './game-calendar.js';
import {hasSalariedJob,dailyWageQuote,monthlyReceipts} from './work-economy.js';
import {newCollegeSupport,settleCollegeSupport} from './college-support.js';

// Salary is earned each civil day, but only becomes cash on the next month's 10th.
// A missing payroll is an old save: start an empty book, never reissue past daily pay.
export const newPayroll=()=>({version:1,lastAccruedDate:null,pending:[],history:[]});
const total=rows=>rows.reduce((n,r)=>n+r.net,0);
export function paydayFor(month){
 const [year,m]=month.split('-').map(Number);
 return new Date(Date.UTC(year,m,10)).toISOString().slice(0,10);
}
export function payrollBase(s,date=gameDate(s),{age=s.age,prison=Boolean(s.legal?.prisonMonthsLeft)}={}){
 if(age<18||age>=80||prison)return {wage:0,pension:0,total:0};
 const [year,month,day]=date.split('-').map(Number),days=new Date(Date.UTC(year,month,0)).getUTCDate();
 const nominalRate=hasSalariedJob(s)?s.monthlyIncome:0;
 const rate=nominalRate&&s.career?.changedOn===date?s.career.previousWage:nominalRate;
 // Telescoping cents make a full ordinary calendar month exactly one monthly salary.
 const wage=Math.floor(rate*day/days)-Math.floor(rate*(day-1)/days);
 const pension=Math.floor(Math.max(0,monthlyReceipts(s)-nominalRate)/30);
 return {wage,pension,total:wage+pension};
}
export function payrollStatus(s,date=gameDate(s)){
 const rows=s.payroll?.pending||[],due=rows.filter(r=>paydayFor(r.month)<=date);
 const next=rows.length?paydayFor(rows[0].month):hasSalariedJob(s)?paydayFor(date.slice(0,7)):null;
 return {monthly:hasSalariedJob(s)?s.monthlyIncome:0,pending:total(rows),due:total(due),nextPayday:next,last:s.payroll?.history.at(-1)||null};
}
export function settlePayroll(s,api,{date=gameDate(s),gross=0,earned=0}={}){
 const p=s.payroll??=newPayroll();
 if(p.lastAccruedDate===null||date>p.lastAccruedDate){
  if(gross){
   const month=date.slice(0,7);let row=p.pending.find(r=>r.month===month);
   if(!row){row={month,gross:0,net:0};p.pending.push(row);}
   row.gross+=gross;row.net+=earned;
  }
  p.lastAccruedDate=date;
 }
 let paid=0;
 for(const row of p.pending.filter(r=>paydayFor(r.month)<=date)){
  const payday=paydayFor(row.month);
  if(row.net)api.cashChange(s,row.net,`${row.month} 工资 · ${payday} 发薪`);
  paid+=row.net;p.history.push({...row,payday});
 }
 p.pending=p.pending.filter(r=>paydayFor(r.month)>date);p.history=p.history.slice(-12);
 return paid;
}
// Read-only estimate. Unpaid current-month earnings remain outside the cash forecast.
export function fixedIncomeCashflow(s,days,dailyExpense=0){
 const q={...s,payroll:structuredClone(s.payroll||newPayroll()),collegeSupport:structuredClone(s.collegeSupport||newCollegeSupport()),behavior:{...s.behavior},dayRoutine:{...s.dayRoutine}};
 const start=addGameDays(gameDate(s),s.survival?.lastBilledDay===s.trading.day?1:0);
 if(s.survival?.lastBilledDay===s.trading.day){q.dayRoutine.lateForWork=false;q.dayRoutine.wagePenalty=false;}
 let income=0,cash=s.cash,lowestCash=cash;
 for(let i=0;i<days;i++){
  const date=addGameDays(start,i),base=payrollBase(q,date),earned=dailyWageQuote(q,base.total);
  const paid=settlePayroll(q,{cashChange:()=>{}},{date,gross:base.wage,earned:Math.max(0,earned-base.pension)})+base.pension+settleCollegeSupport(q,{cashChange:()=>{}},{date});
  income+=paid;cash+=paid-dailyExpense+(i===0?s.survival?.foodPrepaid||0:0);lowestCash=Math.min(lowestCash,cash);
  if(q.behavior.leaveDays)q.behavior.leaveDays--;q.behavior.jobStartsTomorrow=false;
  q.dayRoutine.lateForWork=false;q.dayRoutine.wagePenalty=false;
 }
 return {income,lowestCash};
}
export function validatePayroll(s){
 const p=s.payroll;if(p===undefined)return;
 const bad=()=>{throw Error('存档中的月薪记录无效');},int=n=>Number.isSafeInteger(n)&&n>=0;
 if(!p||p.version!==1||!(p.lastAccruedDate===null||validGameDate(p.lastAccruedDate))||!Array.isArray(p.pending)||!Array.isArray(p.history)||p.pending.length>2||p.history.length>12)bad();
 let prior='';
 for(const r of [...p.history,...p.pending]){
  if(!r||typeof r.month!=='string'||!/^\d{4}-\d{2}$/.test(r.month)||!validGameDate(r.month+'-01')||r.month<=prior||!int(r.gross)||!int(r.net)||r.net>r.gross||!p.lastAccruedDate||r.month>p.lastAccruedDate.slice(0,7))bad();
  prior=r.month;
 }
 for(const r of p.history)if(r.payday!==paydayFor(r.month)||r.payday>p.lastAccruedDate)bad();
 for(const r of p.pending)if(paydayFor(r.month)<=p.lastAccruedDate)bad();
}
