import {CAREERS,INDUSTRIES,TRACK_INDUSTRY,COMPANIES,careerIdentity,careerOffer,startCareer,promotionDays} from './careers.js';
import {isCollegeStudent} from './education.js';
import {hasSalariedJob} from './work-economy.js';
import {attendanceJobStart} from './attendance.js';
import {gameDate} from './game-calendar.js';
import {jobSearchWait} from './job-search.js';

function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
const marketWage=(s,track,level=0)=>Math.round((2200+s.stats.skill*20+CAREERS[track].raises.slice(0,level+1).reduce((a,b)=>a+b,0))/10)*1000;
export function jobSearchReason(s){
 if(s.phase!=='planning')return '先处理眼前的故事，再看工作机会';
 if(s.age<18)return '成年后再找正式工作';
 if(isCollegeStudent(s))return '大学在读期间先安排课余兼职，毕业后再找正式工作';
 if(s.legal?.prisonMonthsLeft)return '服刑期间不能申请外部岗位';
 return '';
}
// An opening/closing dialog is read-only. Offers depend on the life, job and month,
// never consume the narrative RNG, and cannot be replayed after changing jobs.
export function jobOpportunities(s){
 if(jobSearchReason(s)||jobSearchWait(s))return [];
 const employed=hasSalariedJob(s),current=careerIdentity(s),base=careerOffer(s),month=Math.floor((s.debtClock?.day||0)/30);
 const stamp=hash(`${s.seed}:${s.career?.jobs||0}:${current.company}:${current.track}:${s.monthlyIncome}:${s.stats.skill}:${s.stats.academic}:${s.stats.discipline}:${month}`).toString(36);
 const otherTracks=Object.keys(CAREERS).filter(t=>t!==current.track);
 const target=otherTracks[hash(`${s.seed}:transition:${s.career?.jobs||0}:${month}`)%otherTracks.length];
 const another=otherTracks[(otherTracks.indexOf(target)+1)%otherTracks.length];
 const firms=COMPANIES.filter(c=>c!==current.company),firm=i=>firms[(hash(stamp)+i)%firms.length];
 const level=s.career?.level||0;
 const definitions=employed?[
  {key:'same-industry',label:'换公司 · 留在本行业',company:firm(0),industry:current.industry,track:current.track,level,wage:Math.round(marketWage(s,current.track,level)*1.15/1000)*1000,development:'standard',text:'另一家公司在招熟手，愿意按岗位行情报价。沿用原来的职业路线，一半本级出勤经验计入新岗位，原公司工龄不带走。'},
  {key:'internal-transfer',label:'留在公司 · 转入新行业',company:current.company,industry:TRACK_INDUSTRY[target],track:target,wage:s.monthlyIncome,development:'mentored',text:`集团的${INDUSTRIES[TRACK_INDUSTRY[target]]}事业部开放内部转岗。保留工资和公司工龄，从新路线的入门岗位学起，有导师带教，晋升考核所需出勤天数缩短。`},
  {key:'cross-industry',label:'换公司 · 也换行业',company:firm(1),industry:TRACK_INDUSTRY[target],track:target,wage:Math.round(marketWage(s,target)*1.08/1000)*1000,development:'standard',text:'新公司的业务和工作方法都不同。按新行业的入门岗位定薪，职业路线和公司工龄重新开始。'},
  {key:'lateral-growth',label:'平薪换公司 · 看重培养',company:firm(2),industry:TRACK_INDUSTRY[another],track:another,wage:s.monthlyIncome,development:'mentored',text:'对方认可你已有的工作能力，愿意平薪接收转行。先做基础岗位，配导师和明确的考核路线；本级出勤从头累计。'},
 ]:[
  {key:'first-job',label:s.flags.career_history?'重返职场 · 先接上收入':'第一份工作 · 从基础做起',company:firm(0),industry:TRACK_INDUSTRY[base.track],track:base.track,wage:base.wage,development:'standard',text:base.entry},
  {key:'trainee',label:'带教岗位 · 起薪低一些',company:firm(1),industry:TRACK_INDUSTRY[target],track:target,wage:Math.round(marketWage(s,target)*.9/1000)*1000,development:'mentored',text:'招聘负责人把培训安排和考核标准一起交给你。起薪比普通岗位低一成，导师带教缩短晋升所需的出勤天数，技能要求仍要自己达到。'},
  {key:'experienced',label:'直接应聘专员 · 要求更高',company:firm(2),industry:TRACK_INDUSTRY[another],track:another,level:1,wage:marketWage(s,another,1),development:'standard',text:'这份岗位希望新人能独立做事。满足技能和自律要求，可以直接从第二级岗位起步。'},
 ];
 return definitions.map(o=>{
  const route=CAREERS[o.track],level=o.level||0,next=level+1;
  const minimum=o.key==='experienced'?{skill:40,discipline:45}:o.key==='lateral-growth'?{skill:35,discipline:40}:o.key==='internal-transfer'?{skill:20,discipline:35}:{skill:0,discipline:0};
  const requirements=Object.entries(minimum).filter(([,target])=>target>0).map(([key,target])=>({key,label:key==='skill'?'谋生本事':'自律',target,current:s.stats[key],met:s.stats[key]>=target}));
  const missing=requirements.filter(r=>!r.met),delta=o.wage-(employed?s.monthlyIncome:0);
  return {...o,id:`${stamp}:${o.key}`,level,title:route.roles[level],delta,requirements,allowed:!missing.length,reason:missing.map(r=>`${r.label}需 ${r.target}（当前 ${r.current}）`).join('；'),
   next:route.roles[next]||null,promotionDays:promotionDays(o.development,next)||0,promotionRaise:route.raises[next]*100||0,promotionSkill:route.skill[next]||0,promotionDiscipline:route.discipline[next]||0,
   creditedDays:o.key==='same-industry'?Math.floor((s.career?.daysInLevel||0)/2):0};
 });
}
export function jobOfferReason(s,id){
 const reason=jobSearchReason(s)||jobSearchWait(s);if(reason)return reason;
 const o=jobOpportunities(s).find(o=>o.id===id);
 return !o?'这份机会已变化，请重新打开工作机会':o.reason;
}
export function acceptJobOpportunity(s,id){
 const reason=jobOfferReason(s,id);if(reason)throw Error(reason);
 const offer=jobOpportunities(s).find(o=>o.id===id),employed=hasSalariedJob(s),old=careerIdentity(s),oldTitle=s.occupation,oldWage=employed?s.monthlyIncome:0;
 const todayWage=s.career?.changedOn===gameDate(s)?s.career.previousWage:oldWage,leaveDays=s.behavior.leaveDays;
 const sameCompany=employed&&old.company===offer.company;
 const entry=`${offer.company} · ${INDUSTRIES[offer.industry]}。${offer.text}`;
 startCareer(s,{offer:{...offer,entry},source:'chosen:'+offer.key});
 s.career.daysInLevel=offer.creditedDays;
 // Earnings already booked in payroll stay intact; an employed player keeps
 // today's old rate and earns the new rate from the following calendar day.
 if(employed){s.career.changedOn=gameDate(s);s.career.previousWage=todayWage;}
 if(s.employment){s.employment.active=true;s.employment.title=s.occupation;s.employment.wage=s.monthlyIncome;if(!sameCompany)s.employment.tenure=0;}
 if(!sameCompany){attendanceJobStart(s);if(employed)s.behavior.leaveDays=leaveDays;}
 const difference=oldWage?offer.delta===0?'月薪不变':`月薪${offer.delta>0?'增加':'减少'} ¥${Math.abs(offer.delta)/100}`:'正式月薪已确定';
 const growth=offer.next?`下一步是${offer.next}：有效出勤 ${offer.promotionDays} 天、谋生本事 ${offer.promotionSkill}、自律 ${offer.promotionDiscipline} 达标后评定，晋升月薪增加 ¥${offer.promotionRaise/100}。`:'已到这条路线的最高岗位。';
 return {offer,oldWage,text:`${employed?`从${old.company}的${oldTitle}，转到`:'入职'}${offer.company}的${offer.title}（${INDUSTRIES[offer.industry]}）。${difference}，月薪 ¥${offer.wage/100}。${employed?'新工资明天起计薪；':''}每月 10 号发上月工资，已赚的待发工资保留。\n${sameCompany?'公司工龄保留，新岗位出勤重新累计。':offer.creditedDays?`公司工龄重新开始，本级带入 ${offer.creditedDays} 天相关经验。`:'公司工龄与新岗位出勤从头累计。'}${growth}`};
}
