import {isCollegeStudent} from './education.js';
import {hasSalariedJob} from './work-economy.js';
import {teenStoryPresentation,teenStoryChoice,isTeenStory} from './teen-stories.js';
export const ownsHome=s=>(s.positions||[]).some(p=>p.kind==='housing'&&p.value>0);
const housingLearning=(s,e)=>/^HOU/.test(e.id)&&!ownsHome(s)&&(isCollegeStudent(s)||e.id==='HOU07');
/** Consequence stories require evidence in the player's life, not a low budget estimate. */
export function relationshipMoneyConflict(s){
 return s.debts.some(d=>d.overdue&&['family','friend'].includes(d.kind));
}
export function storyContextAllowed(s,e){
 if(e.id.startsWith('ENC_')){
  if(s.legal?.prisonMonthsLeft>0)return false;
  const role=isCollegeStudent(s)?'COL':s.occupation==='退休'?'RET':hasSalariedJob(s)?'JOB':s.businesses.length?'BIZ':'SEEK';
  return e.id.startsWith(`ENC_${role}`);
 }
 if(e.id==='HOU07'&&!ownsHome(s))return false;
 if(/^HOU/.test(e.id)&&isCollegeStudent(s)&&!ownsHome(s))return e.id==='HOU01';
 if(e.id==='REC07')return relationshipMoneyConflict(s);
 if(e.id==='REC06')return s.cash>=1000000;
 if(['REC02','REC03'].includes(e.id)&&s.age<22)return false;
 return true;
}
export function contextualStory(s,e){
 if(isTeenStory(e.id))return teenStoryPresentation(s,e);
 if(housingLearning(s,e))return {...e,title:isCollegeStudent(s)?'聊起毕业后租房要花多少钱':'先了解楼盘消息，不急着买房',prompt:isCollegeStudent(s)?'宿舍里，同学转来毕业学长找房的消息：月租、押金和通勤费加起来并不少。你们顺着房源介绍聊到买房，才发现还要考虑首付、贷款和交付。你现在没有买房，也不是业主；这次只是先了解以后的居住成本，不需要交钱。':'你看到一条楼盘施工变慢的消息。目前你没有持有房产，也没有购房合同要处理。这次可以先查公开信息，了解情况，不需要付费，也不会出售你的其他资产。',housingIntroduction:true};
 if(e.id!=='REC07')return e;
 const conflict=relationshipMoneyConflict(s),d=s.debts.find(d=>d.overdue&&['family','friend'].includes(d.kind));
 return {...e,title:conflict?'约好的还款日过去了，亲友来问钱':'和朋友聊聊最近的开支',prompt:conflict?`你借的“${d.name}”已经逾期。对方发来消息，问什么时候能还。之前的约定没有做到，这次你得认真回应。`:'朋友约你坐一会儿，问最近上课、生活和手头的钱怎么样。你们翻了翻各自的账单，发现日常开支里有不少可以聊的事。'};
}
export function contextualChoice(s,e,c){
 if(isTeenStory(e.id))return teenStoryChoice(s,e,c);
 if(housingLearning(s,e)){
  const i=e.choices.findIndex(x=>x.id===c.id),labels=['查公开的房源与施工信息（免费）',isCollegeStudent(s)?'算算毕业后的租房预算':'比较租房和买房的必要开支','先了解这些，继续自己的生活'];
  return {...c,label:labels[i],profile:'observe',requirements:{min_cash_yuan:0,all:[]},outcomes:c.outcomes.map(o=>({...o,title:['查清了一些住房信息','列了一份居住预算','暂时没有购房计划'][i],text:['你翻了公开的房源资料和公告，分清了报价、月供与交付情况。没有购买房产，也没有花钱。','你记下租金、押金和通勤这些必要开支。这是一份以后的预算，今天没有付款。','你收起消息，把注意力放回眼前的生活。这次没有交易，也没有支出。'][i],effects:i===2?[]:[{op:'stat',delta:{insight:i===0?2:1}}],schedule:[]}))};
 }
 if(e.id==='MAIN05'&&s.education?.college&&!s.legal?.prisonMonthsLeft){
  const i=e.choices.findIndex(x=>x.id===c.id),labels=['先做一份短工，攒求职的生活费','继续学一门求职用得上的技能','和同学聊聊毕业后的打算'];
  return {...c,label:labels[i],...(i===1?{profile:'self_study',requirements:{min_cash_yuan:0,all:[]}}:{}),outcomes:c.outcomes.map(o=>({...o,title:i===0?'毕业后先接了份短工':i===1?'开始为求职补技能':'和同学交换求职消息',text:i===0?((o.effects.find(f=>f.op==='earn')?.amount_yuan===600)?'你做完这份短工，拿到 600 元工钱。生活费多了一点，接下来继续找正式工作。':'这份短工只结了 150 元，但你学到了实际工作中的做法。'):i===1?'你整理岗位要求，开始练习用得上的技能。这次没有投入资金，也没有获得工作收入。':'同学们聊起各自的去向，也约好互相转发招聘消息。',effects:i===1?[{op:'stat',delta:{skill:4,discipline:2}}]:o.effects.filter(f=>!(f.op==='flag'&&f.key==='employed'&&!f.value))}))};
 }
 if(e.id!=='REC07'||relationshipMoneyConflict(s))return c;
 const i=e.choices.findIndex(x=>x.id===c.id),labels=['说说自己的日常开支和手头余钱',s.debts.length?'拿部分现金偿还现有欠款':'算算接下来要用的生活费','听听朋友平时怎么安排开销'];
 const texts=['你把自己的日常开支说清楚了，朋友也聊起自己的打算。有人一起商量，心里轻松一些。','你把伙食、交通和必要开支列下来，知道了接下来要留意哪些账单。这次只是做计划，没有支出。','朋友讲了自己的安排，你耐心听完，发现有几种做法也适合自己。'];
 return {...c,label:labels[i],...(i===1&&!s.debts.length?{profile:'observe',requirements:{min_cash_yuan:0,all:[]}}:{}),outcomes:c.outcomes.map(o=>({...o,title:i===1&&s.debts.length?'偿还了一笔现有欠款':'把生活开支聊清楚了',text:i===1&&s.debts.length?'你拿出部分现金还款，账上的债务相应减少。':texts[i],effects:i===1&&!s.debts.length?[{op:'stat',delta:{insight:2}}]:o.effects.filter(f=>!(f.op==='flag'&&f.key==='employed'))}))};
}
