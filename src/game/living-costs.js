import {dependentChild,schoolAgeChild} from './household.js';
import {familyCosts} from './family-life.js';
import {planSavings} from './living-plan.js';
import {isCollegeStudent} from './education.js';
/** Fictional game prices, in cents. Ordinary bills and unexpected costs are separate. */
export const COLLEGE_DAILY_COST=6000;
export const AGE_LIVING_COSTS=[
 {from:18,to:25,label:'18–24 岁',daily:10000},
 {from:25,to:35,label:'25–34 岁',daily:18000},
 {from:35,to:45,label:'35–44 岁',daily:21000},
 {from:45,to:55,label:'45–54 岁',daily:23000},
 {from:55,to:65,label:'55–64 岁',daily:21000},
 {from:65,to:Infinity,label:'65 岁以后',daily:19000}
];
export function livingCostBreakdown(s){
 const band=AGE_LIVING_COSTS.find(b=>s.age>=b.from&&s.age<b.to),prison=s.legal?.prisonMonthsLeft>0;
 if(!band)return {label:s.age<18?'由家里承担':'人生已结算',base:0,home:0,partner:0,child:0,parent:0,lifestyle:0,total:0};
 const college=isCollegeStudent(s);
 const family=s.familyLife?familyCosts(s):null;
 const b={label:college?'大学在读':band.label,base:prison?0:(college?COLLEGE_DAILY_COST:band.daily)*30,home:0,partner:s.household.partner?90000:0,child:dependentChild(s)?200000:0,parent:s.age>=55&&s.household.livingParent?90000:0,lifestyle:prison?0:(s.lifeArcs?.lifestyle||0)+(s.lifeArcs?.consumption?.monthly||0)};
 b.home=-planSavings(s,b.base)||0;
 if(family){b.partner=family.partner;b.child=family.child;b.lifestyle+=family.transport;}
 return {...b,total:b.base+b.home+b.partner+b.child+b.parent+b.lifestyle};
}

export const EXPENSE_EVENTS=[
 {id:'keys',tier:'small',title:'钥匙找不到了',text:'翻遍口袋也没有，只好请师傅开锁。',min:6000,max:16000,stress:1},
 {id:'charger',tier:'small',title:'充电器罢工',text:'手机还得用，换了一根线和一个充电头。',min:4000,max:12000,stress:1},
 {id:'rain',tier:'small',title:'一场雨把计划打乱',text:'鞋子湿透了，打车回家又添了点日用品。',min:3000,max:10000,stress:1},
 {id:'repair',tier:'small',title:'水龙头一直漏',text:'水一直滴，买零件、请师傅都得花钱。',min:8000,max:22000,stress:1},
 {id:'phone',tier:'medium',title:'手机摔坏了',text:'屏幕一地裂纹，维修费比想的贵。',min:40000,max:100000,stress:2},
 {id:'tooth',tier:'medium',title:'牙疼不是小事',text:'拖了几天还是去了牙科，检查和治疗都要钱。',min:60000,max:180000,stress:2},
 {id:'appliance',tier:'medium',title:'家电突然不转了',text:'用了多年的家电坏了，维修和更换零件花了一笔。',min:50000,max:150000,stress:2},
 {id:'child',tier:'medium',title:'孩子这边要添东西',text:'孩子的日常用品需要添置，家里又多了一笔开销。',min:40000,max:120000,stress:2,when:dependentChild},
 {id:'medical',tier:'large',title:'临时住了几天院',text:'做完检查又留院观察，医保之外还有自付费用。',min:300000,max:650000,stress:4},
 {id:'parent',tier:'large',title:'家里老人需要照料',text:'这次检查和短期护理，家里需要你分担一部分。',min:350000,max:800000,stress:4,when:s=>s.age>=35&&s.household.livingParent},
 {id:'moving',tier:'large',title:'住处临时要换',text:'临时搬家，搬运和短住费用都省不下来。',min:250000,max:500000,stress:4},
 {id:'sole',tier:'small',title:'鞋底开胶了',text:'走到半路才发现鞋底张了口，找地方补了一下。',min:3000,max:8000,stress:1},
 {id:'pipe',tier:'small',title:'下水道堵住了',text:'自己通了半天没通开，最后请师傅来处理。',min:8000,max:20000,stress:1},
 {id:'access_card',tier:'small',title:'门禁卡丢在路上',text:'回家进不了楼，补办门禁卡又交了一笔工本费。',min:2000,max:6000,stress:1},
 {id:'glasses',tier:'medium',title:'眼镜架断了',text:'临时修补撑不了几天，只好换一副日常用的眼镜。',min:30000,max:80000,stress:2},
 {id:'battery',tier:'medium',title:'旧电脑存不住电',text:'电池坏了，换掉后才能继续带出门用。',min:30000,max:70000,stress:2},
 {id:'schooltrip',tier:'medium',title:'学校临时收来一张通知',text:'孩子的外出活动要交交通和食宿费，这个月又多了一笔。',min:30000,max:80000,stress:2,when:schoolAgeChild},
 {id:'followup',tier:'medium',title:'复查和交通费凑到一起',text:'复查不止跑一趟，检查自付和往返费用都记在这次账里。',min:40000,max:120000,stress:2,when:s=>s.age>=45},
 {id:'care',tier:'large',title:'受伤后请了短期照护',text:'治疗后的几天需要人帮忙，护理和必要的辅助用品加起来不少。',min:250000,max:550000,stress:4,when:s=>s.age>=55}
];
// Kept in the same catalog so old expense history remains valid after graduation.
export const CAMPUS_EXPENSE_EVENTS=[
 {id:'campus_card',tier:'small',title:'校园卡不见了',text:'挂失后补办新卡，交了一笔工本费。',min:2000,max:4000,stress:1,campus:true},
 {id:'campus_print',tier:'small',title:'报告要重新打印装订',text:'交稿前发现格式错了，多印了一份报告。',min:2000,max:6000,stress:1,campus:true},
 {id:'campus_bike',tier:'small',title:'去上课时车胎漏气',text:'推到校门口修车摊，补胎换了内胎。',min:3000,max:8000,stress:1,campus:true},
 {id:'campus_charger',tier:'small',title:'充电线突然坏了',text:'旧线接触不良，买了一根平价替换线。',min:3000,max:10000,stress:1,campus:true},
 {id:'campus_clinic',tier:'medium',title:'去校医院看了次小病',text:'检查和药费有一部分需要自己承担。',min:10000,max:25000,stress:2,campus:true},
 {id:'campus_computer',tier:'medium',title:'赶作业时电脑坏了',text:'排查后换了小配件，机器能继续用了。',min:15000,max:45000,stress:2,campus:true},
];
EXPENSE_EVENTS.push(...CAMPUS_EXPENSE_EVENTS);
export const newLivingCosts=()=>({days:0,lastAny:0,lastMedium:0,lastLarge:0,total:0,history:[]});
/** Once per settled life day, also used by the compressed period settlement. */
export function advanceLivingCosts(s,days,api,{age=s.age,prison=s.legal?.prisonMonthsLeft>0}={}){
 if(age<18||age>=80||prison||days<=0)return '';
 const v=s.livingCosts??=newLivingCosts(),notes=[],college=isCollegeStudent({...s,age});
 for(let i=0;i<days;i++){
  v.days++;
  // A quiet opening, at least a week between bills, and two weeks after a large bill.
  if(v.days<(college?30:11)||v.days-v.lastAny<(college?60:7)||v.lastLarge&&v.days-v.lastLarge<14||s.survival?.active||s.survival?.failed)continue;
  if(v.history.filter(e=>v.days-e.day<(college?60:30)).length>=(college?1:3))continue;
  const nextDaily=Math.ceil(livingCostBreakdown({...s,age}).total/30);
  if(s.cash<nextDaily)continue;
  // Separate seeded stream: household mishaps must not re-roll investment outcomes.
  let seed=2166136261;for(const c of `${s.seed}:living-costs:${v.days}`)seed=Math.imul(seed^c.charCodeAt(0),16777619);
  const draw=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  let tier;
  if(!college&&age>=25&&v.days-v.lastLarge>=180&&draw()<.008)tier='large';
  else if(v.days-v.lastMedium>=(college?180:45)&&draw()<(college?.002:.035))tier='medium';
  else if(draw()<(college?.012:.07))tier='small';
  if(!tier)continue;
  const pool=EXPENSE_EVENTS.filter(e=>Boolean(e.campus)===college&&e.tier===tier&&(!e.when||e.when({...s,age}))),previous=v.history.at(-1)?.id;
  const fresh=pool.filter(e=>e.id!==previous),choices=fresh.length?fresh:pool;
  const e=choices[Math.floor(draw()*choices.length)];
  const amount=e.min+Math.floor(draw()*((e.max-e.min)/100+1))*100;
  const owed=api.charge(s,amount,'临时开销：'+e.title);api.stat(s,{stress:e.stress});
  v.lastAny=v.days;if(tier==='medium')v.lastMedium=v.days;if(tier==='large')v.lastLarge=v.days;
  v.total+=amount;v.history.push({id:e.id,day:v.days,age,tier,amount,owed});v.history=v.history.slice(-12);
  notes.push(`${e.title}：${e.text} 花了 ¥${amount/100}${owed?`，其中 ¥${owed/100} 记为待付账单`:''}。`);
 }
 return notes.join('\n');
}
export function validateLivingCosts(s){
 const v=s.livingCosts;if(v===undefined)return;
 const bad=()=>{throw Error('存档中的临时开销记录无效');};
 if(!v||typeof v!=='object'||Array.isArray(v))bad();
 for(const k of ['days','lastAny','lastMedium','lastLarge','total'])if(!Number.isSafeInteger(v[k])||v[k]<0)bad();
 if(v.lastAny>v.days||v.lastMedium>v.lastAny||v.lastLarge>v.lastAny||!Array.isArray(v.history)||v.history.length>12)bad();
 let prior=0,total=0;for(const h of v.history){const e=EXPENSE_EVENTS.find(e=>e.id===h.id);if(!e||h.tier!==e.tier||!Number.isSafeInteger(h.day)||h.day<=prior||h.day>v.days||!Number.isFinite(h.age)||h.age<18||h.age>=80||!Number.isSafeInteger(h.amount)||h.amount<e.min||h.amount>e.max||h.amount%100||!Number.isSafeInteger(h.owed)||h.owed<0||h.owed>h.amount)bad();prior=h.day;total+=h.amount;}
 if(total>v.total||v.history.length&&v.history.at(-1).day!==v.lastAny)bad();
}
