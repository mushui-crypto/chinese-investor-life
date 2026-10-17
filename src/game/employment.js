import {ensureCareer,advanceCareer,validateCareer} from './careers.js';
import {isCollegeStudent} from './education.js';
import {attendanceJobStart,attendanceStatus} from './attendance.js';
import {hasSalariedJob} from './work-economy.js';
import {gameDate,addGameDays,validGameDate} from './game-calendar.js';
import {DAILY_EVENTS} from './day-routine.js';
import {startJobSearch,ensureJobSearch} from './job-search.js';

export const WORK_EVENT_RULES={bonusChance:.7,penaltyChance:.012,layoffChance:.0008,penaltyGap:30,layoffGrace:60};
export const WORK_EVENT_NAMES={bonus:'年终奖到账',penalty:'工作扣款',layoff:'裁员补偿到账',promotion:'晋升加薪'};
const employed=s=>s.age>=18&&s.age<80&&hasSalariedJob(s);
const lifeDay=s=>s.debtClock?.day||0;
export function employmentStatus(s){
 if(s.age<18)return {key:'student',label:s.age<3?'未入学':'在读'};
 if(s.legal?.prisonMonthsLeft>0)return {key:'prison',label:'服刑中'};
 if(s.occupation==='退休')return {key:'retired',label:'已退休'};
 if(employed(s))return {key:'employed',label:s.behavior?.jobStartsTomorrow?'待入职':s.behavior?.leaveDays?(attendanceStatus(s).today?.kind==='absent'?'在职 · 旷工':'在职 · 请假'):'在职'};
 if(isCollegeStudent(s))return {key:'student',label:'在读'};
 return {key:'unemployed',label:'无固定工作'};
}
export function syncEmployment(s,age=s.age){
 if(s.employment?.active&&!employed({...s,age})&&s.occupation!=='退休'&&!isCollegeStudent(s)&&!s.legal?.prisonMonthsLeft)startJobSearch(s,{source:'separation'});
 ensureJobSearch(s);
 if(employed({...s,age})){
  const migrating=!s.career;ensureCareer(s);
  if(migrating&&s.employment?.active)s.employment.title=s.occupation;
 }
 const active=employed({...s,age}),title=active?s.occupation:'',wage=active?s.monthlyIncome:0;
 s.employment??={active,title,wage,tenure:0,lastDay:lifeDay(s),lastPenalty:null,bonusYear:null,history:[]};
 const e=s.employment;
 if(active&&!e.active)attendanceJobStart(s);
 if(e.active!==active||active&&(e.title!==title||e.wage!==wage))e.tenure=0;
 Object.assign(e,{active,title,wage});return e;
}
function randomFor(s,day){
 let seed=2166136261;for(const c of `${s.seed}:employment:${day}`)seed=Math.imul(seed^c.charCodeAt(0),16777619);
 return ()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
}
const yuanFloor=n=>Math.floor(n/100)*100;
export function workEventAmount(kind,wage,tenure,roll){
 if(kind==='penalty')return Math.max(0,Math.min(yuanFloor(wage*.05),2000+Math.floor(roll*81)*100));
 if(kind==='bonus')return Math.max(0,yuanFloor(Math.min(500000,wage,Math.max(30000,wage*(.25+.75*roll)))));
 const months=tenure<180?.5:tenure<360?1:Math.min(3,Math.ceil(tenure/360));
 return Math.max(0,yuanFloor(Math.min(1000000,wage*3,Math.max(80000,wage*months*(.8+.4*roll)))));
}

// Runs once for each newly settled day. Its seed is separate from market/story draws.
export function advanceEmployment(s,days,api,{startDay=lifeDay(s),startDate=gameDate(s),age=s.age,prison=Boolean(s.legal?.prisonMonthsLeft),worked=true,firstDayOff=false}={}){
 const e=syncEmployment(s,age),notes=[];let unpaidSalary=0;
 for(let i=0;i<days;i++){
  const day=startDay+i+1;if(day<=e.lastDay)continue;e.lastDay=day;
  if(age<18||age>=80||prison||!hasSalariedJob(s))continue;
  e.tenure++;
  const date=addGameDays(startDate,i),year=+date.slice(0,4),draw=randomFor(s,day);
  let kind;
  if(e.tenure>=30&&date.slice(5)>='12-15'&&e.bonusYear!==year){
   e.bonusYear=year;if(draw()<WORK_EVENT_RULES.bonusChance)kind='bonus';
  }
  if(!kind&&e.tenure>=WORK_EVENT_RULES.layoffGrace&&draw()<WORK_EVENT_RULES.layoffChance)kind='layoff';
  if(!kind&&worked&&!(i===0&&firstDayOff)&&e.tenure>=7&&(e.lastPenalty===null||day-e.lastPenalty>=WORK_EVENT_RULES.penaltyGap)&&draw()<WORK_EVENT_RULES.penaltyChance)kind='penalty';
  const promotion=advanceCareer(s,day,{worked:worked&&!(i===0&&firstDayOff)&&kind!=='layoff',allowPromotion:!kind});
  if(promotion){
   e.history.push({kind:'promotion',day,date,amount:promotion.raise,owed:0,wage:promotion.oldWage,tenure:e.tenure,text:promotion.text});e.history=e.history.slice(-12);Object.assign(e,{title:s.occupation,wage:s.monthlyIncome});notes.push(promotion.text);continue;
  }
  if(!kind)continue;
  const wage=s.monthlyIncome,tenure=e.tenure,amount=workEventAmount(kind,wage,tenure,draw());if(!amount)continue;
  let owed=0,text;
  if(kind==='penalty'){
   if(s.career)s.career.lastSetback=day;
   owed=api.charge(s,amount,'工作扣款');api.stat(s,{stress:2});e.lastPenalty=day;
   text=`考勤和工作差错扣款 ¥${amount/100}${owed?`，其中 ¥${owed/100} 待付`:''}。`;
  }else{
   api.cashChange(s,amount,WORK_EVENT_NAMES[kind]);
   if(kind==='bonus'){api.stat(s,{stress:-3});text=`今年的年终奖 ¥${amount/100} 到账了。`;}
   else{
    unpaidSalary=Math.round(wage*(days-i-1)/30);
   s.monthlyIncome=0;s.occupation='离职待业';s.flags.employed=false;
   startJobSearch(s,{day,source:'layoff'});
    s.behavior.leaveDays=0;s.behavior.jobStartsTomorrow=false;
    if(s.behavior.pending==='work_warning')s.behavior.pending=null;
    if(DAILY_EVENTS[s.dayRoutine?.pending]?.roles.includes('employed'))s.dayRoutine.pending=null;
    Object.assign(e,{active:false,title:'',wage:0,tenure:0});api.stat(s,{stress:8});
    text=`岗位裁撤，补偿 ¥${amount/100} 已到账。今天的工资计入待发，明天起不再计薪。重新投递和面试需要时间，先安排过渡期间的生活。`;
   }
  }
  e.history.push({kind,day,date,amount,owed,wage,tenure,text});e.history=e.history.slice(-12);
  notes.push(text);
 }
 return {text:notes.join('\n'),unpaidSalary};
}

export function validateEmployment(s){
 validateCareer(s);
 const e=s.employment;if(e===undefined)return;
 const bad=()=>{throw Error('存档中的工作记录无效');};
 const int=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 if(!e||Array.isArray(e)||typeof e!=='object'||typeof e.active!=='boolean'||typeof e.title!=='string'||e.title.length>100||!int(e.wage)||!int(e.tenure)||!int(e.lastDay)||e.lastDay>lifeDay(s)||e.tenure>e.lastDay||!(e.lastPenalty===null||int(e.lastPenalty)&&e.lastPenalty<=e.lastDay)||!(e.bonusYear===null||int(e.bonusYear,1900)&&e.bonusYear<=2200)||!Array.isArray(e.history)||e.history.length>12)bad();
 let prior=0;
 for(const h of e.history){
  if(!h||!Object.hasOwn(WORK_EVENT_NAMES,h.kind)||!int(h.day,1)||h.day<=prior||h.day>e.lastDay||!validGameDate(h.date)||!int(h.wage,1)||!int(h.tenure,1)||h.tenure>h.day||!int(h.amount,1)||h.amount%100||(h.kind==='promotion'?![50000,60000,70000,90000,100000,110000,130000,140000,150000,170000,190000].includes(h.amount):h.amount<workEventAmount(h.kind,h.wage,h.tenure,0)||h.amount>workEventAmount(h.kind,h.wage,h.tenure,1-Number.EPSILON))||!int(h.owed)||h.owed>h.amount||h.kind!=='penalty'&&h.owed!==0||typeof h.text!=='string'||h.text.length>300)bad();
  prior=h.day;
 }
}
