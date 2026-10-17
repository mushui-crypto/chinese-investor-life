/** Game rules, not clinical thresholds. Money is integer cents. */
import {fatigueIncomeReason,lateWageReason,hasSalariedJob} from './work-economy.js';
import {payrollBase,payrollStatus,settlePayroll,fixedIncomeCashflow} from './payroll.js';
import {COLLEGE_MONTHLY_SUPPORT,collegeSupportStatus,settleCollegeSupport} from './college-support.js';
export const SURVIVAL_BUFFER_DAYS=7;
export const FOOD_DAILY_COST=2000;
export const HUNGER_HEALTH_LOSS=10;
export const HOSPITAL_THRESHOLD=30;
export const CRITICAL_HEALTH=10;
export const HOSPITAL_COST=150000;
export const HOSPITAL_RECOVERY=60;
export function newSurvival(){return {active:false,unpaidDays:0,hungryDays:0,foodPrepaid:0,days:0,livingAccrued:0,salaryPaid:0,lastBilledDay:null,last:null,failed:false,failureCause:null,hospitalVisits:0,hospitalDay:null,healthPromptLevel:0,recoveries:0,rescuePromptSeen:false};}
export function survivalState(s){return {...newSurvival(),...s.survival};}
export function remainingLiving(s,monthly,months){return Math.max(0,Math.round(monthly*Math.max(0,months*30-(s.survival?.days||0))/30)-(s.survival?.foodPrepaid||0));}
export function survivalStatus(s,m){
 const v=survivalState(s),exempt=s.age<18||s.age>=80||s.legal?.prisonMonthsLeft>0;
 const payroll=payrollStatus(s),base=payrollBase(s),closed=v.lastBilledDay===s.trading.day;
 const dailyExpense=exempt?0:Math.ceil(m.monthlyExpense/30),baseDailySalary=base.total,dailySalary=exempt||closed?0:payroll.due+base.pension;
 const collegeSupport=collegeSupportStatus(s),dailyIncome=dailySalary+(exempt||closed?0:collegeSupport.due);
 const foodDue=Math.min(FOOD_DAILY_COST,dailyExpense),foodRemaining=Math.max(0,foodDue-v.foodPrepaid);
 const shortage=Math.max(0,dailyExpense-v.foodPrepaid-s.cash-dailyIncome),buffer=dailyExpense*SURVIVAL_BUFFER_DAYS;
 const recovered=!shortage&&(s.cash>=buffer||dailyIncome>=dailyExpense);
 const health=s.stats.health,needsCare=!exempt&&!v.failed&&health<=HOSPITAL_THRESHOLD;
 const healthLevel=needsCare?(health<=CRITICAL_HEALTH?2:1):0;
 const foodShortage=Math.max(0,foodRemaining-s.cash-dailyIncome);
 const active=!exempt&&!v.failed&&(shortage>0||v.active&&!recovered);
 return {...v,active,exempt,health,needsCare,healthLevel,dailyExpense,baseDailySalary,dailySalary,dailyIncome,collegeSupport,payroll,shortage,buffer,foodDue,foodRemaining,foodShortage,expectedDebt:Math.max(0,shortage-foodShortage),expectedHealthLoss:foodDue?Math.ceil(HUNGER_HEALTH_LOSS*foodShortage/foodDue):0,foodSecured:foodRemaining===0,cashDays:dailyExpense?Math.floor(s.cash/dailyExpense):null,cashableAssets:m.cashableAssets||0};
}
export function syncSurvival(s,m){
 s.survival={...newSurvival(),...s.survival};const v=s.survival;
 if(s.age>=18&&s.age<80&&s.stats.health<=0&&!v.failed){v.failed=true;v.failureCause=v.hungryDays>0?'starvation':'health';}
 const status=survivalStatus(s,m);
 if(v.active&&!status.active&&!status.exempt&&!v.failed){v.recoveries++;v.unpaidDays=0;}
 if(status.exempt&&!v.failed){v.unpaidDays=0;v.hungryDays=0;}
 if(!status.active&&!status.needsCare)v.rescuePromptSeen=false;
 if(!status.needsCare)v.healthPromptLevel=0;
 v.active=status.active;s.flags.survival_failed=v.failed;s.flags.health_failed=v.failureCause==='health';
}
export function shouldOfferRescue(s,m){const v=survivalStatus(s,m);return s.phase==='planning'&&(v.active&&!v.rescuePromptSeen||v.healthLevel>v.healthPromptLevel);}
export function acknowledgeRescue(s){const next=structuredClone(s),v=survivalState(s);next.survival={...v,rescuePromptSeen:true,healthPromptLevel:s.stats.health<=CRITICAL_HEALTH?2:s.stats.health<=HOSPITAL_THRESHOLD?1:0};return next;}
export function survivalActionReason(s,a,m){
 const v=survivalStatus(s,m);
 if(s.phase!=='planning'||v.exempt||v.failed)return '先处理眼前的故事，回到成年生活安排';
 if(a.type==='secure_food'){
  if(v.lastBilledDay===s.trading.day)return '今天已结算，起床后再安排明天的伙食';
  if(v.foodSecured)return '今天的基本伙食已安排';
  return s.cash<v.foodRemaining?'现金还不够基本伙食，先做兼职、变现或周转':'';
 }
 if(!v.needsCare)return '健康高于 30，暂不需要住院';
 if(s.dayRoutine?.pending)return '先处理眼前的小事，再去医院';
 if(v.days>=m.turnDays)return '本期已经结清，进入下一期后就医';
 if(s.cash<HOSPITAL_COST)return `住院需现金 ¥${HOSPITAL_COST/100}，还差 ¥${((HOSPITAL_COST-s.cash)/100).toFixed(2)}；医疗费不能赊欠`;
 return '';
}
export function secureFood(s,api){
 const v=s.survival,status=survivalStatus(s,api.metrics(s));
 api.cashChange(s,-status.foodRemaining,'今日基本伙食');v.foodPrepaid+=status.foodRemaining;v.hungryDays=0;
 return `今天的基本伙食已安排，花费 ¥${status.foodRemaining/100}。这笔钱计入今天生活费，日结不重复扣。缺食中断，健康不会立刻回满。`;
}
export function settleSurvivalDay(s,api,{hospital=false}={}){
 s.survival={...newSurvival(),...s.survival};const v=s.survival,status=survivalStatus(s,api.metrics(s)),day=s.trading.day;
 if(status.exempt||v.failed||v.lastBilledDay===day||v.days>=api.months(s)*30)return '';
 const worked=!hospital&&hasSalariedJob(s)&&!s.behavior?.leaveDays&&!s.behavior?.jobStartsTomorrow;
 const quote=payrollBase(s),base=quote.total;
 const wageReason=worked?fatigueIncomeReason(s)+lateWageReason(s,base):'';
 const wage=hospital&&hasSalariedJob(s)?quote.pension:api.dailyWage?api.dailyWage(s,base):base;
 if(hospital&&hasSalariedJob(s))s.behavior.lostWages+=quote.wage;
 const earned=Math.max(0,wage-quote.pension),salary=settlePayroll(s,api,{gross:quote.wage,earned})+quote.pension;
 const support=settleCollegeSupport(s,api);
 const monthly=api.metrics(s).monthlyExpense,due=Math.round(monthly*(v.days+1)/30)-Math.round(monthly*v.days/30);
 if(quote.pension)api.cashChange(s,quote.pension,'养老金日结');
 if(salary)v.salaryPaid+=salary;
 if(earned)s.flags.career_history=true;
 const foodDue=Math.min(FOOD_DAILY_COST,due),prepaid=Math.min(v.foodPrepaid,foodDue);
 const foodPaid=hospital?foodDue:Math.min(foodDue,prepaid+s.cash),missing=foodDue-foodPaid;
 // Uneaten food is not a purchase. Hospital meals are included in the medical bill.
 const foodUnspent=hospital?foodDue-prepaid:missing;
 const payable=due-prepaid-foodUnspent,paid=prepaid+Math.min(s.cash,payable),shortfall=due-paid-foodUnspent;
 api.charge(s,payable,'基本生活费欠款');v.foodPrepaid=0;
 // Mark the whole planned day settled, including skipped food, so rollover cannot rebill it.
 v.livingAccrued+=due;v.days++;v.lastBilledDay=day;
 v.unpaidDays=shortfall?v.unpaidDays+1:0;
 v.hungryDays=missing?v.hungryDays+1:0;
 const healthLost=missing?Math.min(s.stats.health,Math.ceil(HUNGER_HEALTH_LOSS*missing/foodDue)):0;
 if(healthLost)api.stat(s,{health:-healthLost});
 v.last={day,due,paid,shortfall,foodUnspent,salary,earned,support,unpaidDays:v.unpaidDays,foodDue,foodPaid,healthLost,hospital};
 const extra=api.settleDay?api.settleDay(s,{worked}):'';
 if(hospital){v.hungryDays=0;api.stat(s,{health:HOSPITAL_RECOVERY-s.stats.health,stress:-5});v.hospitalVisits++;v.hospitalDay=day;}
 syncSurvival(s,api.metrics(s));
 const healthNote=missing?`伙食少吃 ¥${missing/100}，未消费部分不记欠款；健康 −${healthLost}（现 ${s.stats.health}/100）。`:hospital?'住院期间供餐，健康恢复至 60。':'基本伙食已够，欠费本身不扣健康。';
 return `${wageReason}${earned?`今日计薪 ¥${(earned/100).toFixed(2)}，记入待发工资，次月 10 号到账。`:''}${support?`家里本月生活费 ¥${support/100} 到账。`:''}今日生活预算 ¥${due/100}，工资 / 养老金到账 ¥${salary/100}，实付 ¥${paid/100}${shortfall?`，固定费用新增欠款 ¥${shortfall/100}`:''}。${healthNote}${v.failed?'健康已耗尽，本局结束。':s.stats.health<=HOSPITAL_THRESHOLD?'健康已到就医线，请尽快住院。':''}${extra?'\n'+extra:''}`;
}
/** Prevent a compressed half-year from hiding a food/health crisis. */
export function needsDailySettlement(s,m,months){
 if(s.phase!=='planning'||s.age<18||s.age>=80||s.legal?.prisonMonthsLeft>0)return false;
 const v=survivalStatus(s,m),days=Math.max(0,months*30-v.days);
 return days>0&&(v.active||v.needsCare||v.hungryDays>0||v.foodPrepaid>0||fixedIncomeCashflow(s,days,v.dailyExpense).lowestCash<0);
}
export function resetSurvivalPeriod(s){s.survival??=newSurvival();Object.assign(s.survival,{days:0,livingAccrued:0,salaryPaid:0});}
export function validateSurvival(s){
 s.survival??=newSurvival();const v=s.survival,bad=()=>{throw Error('存档中的每日生存记录无效');};
 if(!v||Array.isArray(v)||typeof v!=='object')bad();
 // Migrate old records without inventing hunger or retroactive damage.
 if(v.failureCause===undefined)v.failureCause=v.failed?'legacy':null;
 for(const key of ['hungryDays','foodPrepaid','hospitalVisits','healthPromptLevel'])if(v[key]===undefined)v[key]=0;
 if(v.hospitalDay===undefined)v.hospitalDay=null;
 if(v.rescuePromptSeen===undefined)v.rescuePromptSeen=false;
 if(typeof v.rescuePromptSeen!=='boolean')bad();
 for(const k of ['active','failed'])if(typeof v[k]!=='boolean')bad();
 for(const k of ['unpaidDays','hungryDays','foodPrepaid','days','livingAccrued','salaryPaid','recoveries','hospitalVisits','healthPromptLevel'])if(!Number.isSafeInteger(v[k])||v[k]<0)bad();
 if(v.healthPromptLevel>2||v.foodPrepaid>FOOD_DAILY_COST||v.failed&&v.active)bad();
 if(![null,'legacy','starvation','health'].includes(v.failureCause)||v.failed!==(v.failureCause!==null))bad();
 if(v.failureCause==='legacy'&&v.unpaidDays!==7||['starvation','health'].includes(v.failureCause)&&s.stats.health!==0||v.failureCause==='starvation'&&v.hungryDays===0)bad();
 for(const k of ['lastBilledDay','hospitalDay'])if(v[k]!==null&&(!Number.isSafeInteger(v[k])||v[k]<0||v[k]>s.trading.day))bad();
 if(v.foodPrepaid&&v.lastBilledDay===s.trading.day)bad();
 if(v.last!==null){const r=v.last;if(!r||typeof r!=='object'||Array.isArray(r))bad();for(const k of ['day','due','paid','shortfall','salary','unpaidDays'])if(!Number.isSafeInteger(r[k])||r[k]<0)bad();if(r.foodUnspent!==undefined&&(!Number.isSafeInteger(r.foodUnspent)||r.foodUnspent<0||r.foodUnspent>(r.foodDue??0)))bad();if(r.paid+r.shortfall+(r.foodUnspent||0)!==r.due||r.day!==v.lastBilledDay)bad();
  if(v.unpaidDays>r.unpaidDays)bad();
  if(r.earned!==undefined&&(!Number.isSafeInteger(r.earned)||r.earned<0))bad();
  if(r.support!==undefined&&(!Number.isSafeInteger(r.support)||r.support<0||r.support>COLLEGE_MONTHLY_SUPPORT))bad();
  if(r.foodDue!==undefined){for(const k of ['foodDue','foodPaid'])if(!Number.isSafeInteger(r[k])||r[k]<0)bad();if(r.foodPaid>r.foodDue||r.foodDue>Math.min(FOOD_DAILY_COST,r.due)||!Number.isFinite(r.healthLost)||r.healthLost<0||r.healthLost>HUNGER_HEALTH_LOSS||typeof r.hospital!=='boolean')bad();}
 }
 if(Boolean(s.flags.survival_failed)!==v.failed)bad();return v;
}
