import {isCollegeStudent} from './education.js';
import {jobSearchWait,completeJobSearch} from './job-search.js';

// Fictional career paths. Artwork and job offers share this persisted identity.
export const CAREERS={
 service:{name:'门店服务',scene:'service',entry:'街边门店贴出招人启事。你从接待顾客、清点货架和交班做起。',roles:['门店店员','资深店员','门店副店长','门店店长'],skill:[0,25,45,65],discipline:[0,40,50,60],raises:[0,500,900,1400]},
 logistics:{name:'仓配物流',scene:'logistics',entry:'打包间的负责人愿意带你熟悉流程。收货、分拣和出库，每一步都要对得上单子。',roles:['仓配助理','仓配专员','仓配组长','仓配主管'],skill:[0,25,45,65],discipline:[0,40,55,65],raises:[0,500,1000,1500]},
 operations:{name:'文职运营',scene:'operations',entry:'面试通过后，你领到一张工牌。从整理表格、跟进订单开始，慢慢接手一个小项目。',roles:['运营助理','运营专员','运营组长','运营主管'],skill:[0,30,50,70],discipline:[0,45,55,65],raises:[0,600,1100,1700]},
 technical:{name:'技术维护',scene:'technical',entry:'师傅把工具和故障单交到你手里。先跟着检查、记录，再学习独立处理问题。',roles:['技术学徒','维护技术员','资深技术员','技术组长'],skill:[0,35,55,75],discipline:[0,40,50,60],raises:[0,700,1300,1900]}
};
export const PROMOTION_DAYS=[0,360,720,1080];
export const INDUSTRIES={retail:'生活零售',logistics:'仓储物流',commerce:'电商服务',technology:'技术服务'};
export const TRACK_INDUSTRY={service:'retail',logistics:'logistics',operations:'commerce',technical:'technology'};
export const COMPANIES=['海临实业集团','城南商贸集团','启程生活集团','新桥产业集团','远川实业集团'];
export function careerCompany(s,offset=0){return COMPANIES[(hash(`${s.seed}:employer:${s.career?.jobs||0}`)+offset)%COMPANIES.length];}
export function careerIdentity(s){
 const c=s.career,offer=c?null:careerOffer(s,'existing-job');
 const track=c?.track||Object.entries(CAREERS).find(([,r])=>r.roles.includes(s.occupation))?.[0]||offer?.track;
 return {track,company:c?.company||careerCompany(s),industry:c?.industry||TRACK_INDUSTRY[track],development:c?.development||'standard'};
}
export const promotionDays=(development,level)=>Math.ceil(PROMOTION_DAYS[level]*(development==='mentored'?.8:1));
const day=s=>s.debtClock?.day||0;
const salaried=s=>s.age>=18&&!isCollegeStudent(s)&&s.monthlyIncome>0&&s.occupation!=='退休'&&!s.legal?.prisonMonthsLeft;
function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function careerOffer(s,source='job-search'){
 if(s.age<18||isCollegeStudent(s)||s.legal?.prisonMonthsLeft)return null;
 let pool=['service','logistics'];
 if(s.education?.college||s.stats.academic>=45)pool.push('operations','operations');
 if(s.stats.skill>=25)pool.push('technical');
 if(s.seenEvents?.includes('ZHOU01'))pool.push('operations');
 if(s.seenEvents?.some(id=>['JOB06','ZHOU03','ZHOU04'].includes(id)))pool.push('technical','technical');
 if(s.seenEvents?.includes('HAO01'))pool.push('logistics','logistics');
 const specific={'job:apprentice':'technical','job:referral':'operations','job:reentry':'logistics',ZHOU01:'operations',JOB06:'technical',RE01:'logistics',RE02:'logistics'}[source];
 const track=specific||pool[hash(`${s.seed}:career:${s.career?.jobs||0}:${source}:${s.turn}`)%pool.length];
 const route=CAREERS[track],wage=(2200+Math.max(0,Math.min(100,Math.floor(s.stats.skill)))*20)*100;
 const lead=source.startsWith('job:')?'熟人介绍了一份岗位。':source==='ZHOU01'?'老周留下的工位有了着落。':'';
 return {track,title:route.roles[0],wage,entry:lead+route.entry};
}
export function startCareer(s,{source='job-search',wage,offer=careerOffer(s,source)}={}){
 const waiting=jobSearchWait(s);if(waiting)throw Error(waiting);
 if(!offer)return null;
 completeJobSearch(s);
 const company=offer.company||careerCompany(s);
 s.career={version:1,track:offer.track,level:offer.level||0,daysInLevel:0,lastDay:day(s),jobs:(s.career?.jobs||0)+1,source,entry:offer.entry,company,industry:offer.industry||TRACK_INDUSTRY[offer.track],development:offer.development||'standard'};
 s.monthlyIncome=wage??offer.wage;s.occupation=offer.title;s.flags.employed=true;s.flags.career_history=true;
 return offer;
}
export function ensureCareer(s){
 if(!salaried(s))return s.career;
 if(s.career){Object.assign(s.career,careerIdentity(s));return s.career;}
 const offer=careerOffer(s,'existing-job');
 const matched=Object.entries(CAREERS).find(([,c])=>c.roles.includes(s.occupation));
 s.career={version:1,track:matched?.[0]||offer.track,level:matched?matched[1].roles.indexOf(s.occupation):0,daysInLevel:0,lastDay:day(s),jobs:1,source:'existing-job',entry:'这份工作的工资和已赚收入保留；从现在开始记录岗位成长。'};
 // Existing work is assigned a concrete route without back-paying or cutting wages.
 s.occupation=CAREERS[s.career.track].roles[s.career.level];Object.assign(s.career,careerIdentity(s));return s.career;
}
export function careerStatus(s){
 const c=s.career,route=CAREERS[c?.track];if(!c||!route)return null;
 const next=c.level+1,needs=next<route.roles.length?[
  {label:'本岗位有效出勤',value:c.daysInLevel,target:promotionDays(c.development,next),unit:'天'},
  {label:'谋生本事',value:s.stats.skill,target:route.skill[next]},
  {label:'自律',value:s.stats.discipline,target:route.discipline[next]}
 ]:[];
 if(next<route.roles.length)needs.push({label:'近期稳定表现',value:c.lastSetback===undefined?30:Math.min(30,Math.max(0,day(s)-c.lastSetback)),target:30,unit:'天'});
 return {...c,route,title:route.roles[c.level],next:route.roles[next]||null,raise:route.raises[next]||0,needs};
}
export function advanceCareer(s,currentDay,{worked=true,allowPromotion=true}={}){
 if(!salaried(s))return null;
 const c=ensureCareer(s);if(currentDay<=c.lastDay)return null;c.lastDay=currentDay;
 if(!worked)return null;
 c.daysInLevel++;
 if(s.behavior?.fatigue>=65||s.dayRoutine?.lateForWork||s.dayRoutine?.wagePenalty||s.employment?.lastPenalty===currentDay)c.lastSetback=currentDay;
 const v=careerStatus({...s,debtClock:{...s.debtClock,day:currentDay}});
 if(!allowPromotion||!v.next||v.needs.some(n=>n.value<n.target)||s.behavior?.fatigue>=65||s.stats.health<35||s.dayRoutine?.lateForWork||s.dayRoutine?.wagePenalty)return null;
 const from=s.occupation,oldWage=s.monthlyIncome;
 c.level++;c.daysInLevel=0;s.occupation=v.next;s.monthlyIncome+=v.raise*100;
 return {from,to:v.next,oldWage,raise:v.raise*100,text:`你把手头的工作做熟，也能独立处理更难的任务了。从${from}晋升为${v.next}，月薪从 ¥${oldWage/100} 调整为 ¥${s.monthlyIncome/100}。新标准从次日计薪，仍在每月 10 号发上月工资。`};
}
export function validateCareer(s){
 const c=s.career;if(c===undefined)return;
 const int=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 if(!c||c.version!==1||!Object.hasOwn(CAREERS,c.track)||!int(c.level)||c.level>3||!int(c.daysInLevel)||!int(c.lastDay)||c.daysInLevel>c.lastDay||c.lastDay>day(s)||!int(c.jobs,1)||typeof c.source!=='string'||c.source.length>100||typeof c.entry!=='string'||c.entry.length>400)throw Error('职业成长记录无效');
 if(c.company!==undefined&&(typeof c.company!=='string'||!c.company.trim()||c.company.length>60)||c.industry!==undefined&&!Object.hasOwn(INDUSTRIES,c.industry)||c.development!==undefined&&!['standard','mentored'].includes(c.development))throw Error('公司与行业记录无效');
 if(c.changedOn!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(c.changedOn)||!int(c.previousWage)))throw Error('换岗工资记录无效');
 if(c.lastSetback!==undefined&&(!int(c.lastSetback)||c.lastSetback>day(s)))throw Error('晋升考核记录无效');
}
