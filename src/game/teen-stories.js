/** Required money stories are read and chosen by the player, in school-year order. */
export const TEEN_STORY_STEPS = [
 {age:12,id:'MAIN03'}, {age:12,id:'FAM07'},
 {age:13,id:'YOU01'}, {age:14,id:'FAM04'}, {age:15,id:'FAM05'},
 {age:16,id:'FAM06'}, {age:16,id:'AGE16A'}, {age:16,id:'AGE16B'}, {age:16,id:'AGE16C'},
 {age:17,id:'FAM02'}, {age:17,id:'YOU02'}, {age:17,id:'YOU05'},
];
const steps=new Map(TEEN_STORY_STEPS.map((step,index)=>[step.id,{...step,index}]));
export const isTeenStory=id=>steps.has(id);
export const teenStoryAge=id=>steps.get(id)?.age;
export const teenStoryOrder=id=>steps.get(id)?.index??Infinity;
export const needsTeenChoice=s=>s.age<18&&s.phase==='event'&&isTeenStory(s.activeEvent?.eventId);

/** Refer only to already-read stories, without inventing a family shop or a second parent. */
export function teenStoryPresentation(s,e){
 if(!isTeenStory(e.id))return e;
 const seen=id=>s.seenEvents?.includes(id),carer=s.familyId==='F12'?'外婆':s.familyId==='F11'?'妈妈':'家人';
 const stories={
  MAIN03:{title:'十二岁：第一次听懂家里的账',prompt:`升上初中，课本、交通和每天的饭钱都要重新安排。晚上，${carer}把账本摊在桌上，说起哪些开支得先留出来。你第一次发现，自己的生活也写在这些数字里。`},
  FAM07:{title:`${s.familyId==='F12'?'外婆':'母亲'}的应急铁盒`,prompt:`${seen('MAIN03')?'聊过家里的日常开支后，':''}停电的一晚，${s.familyId==='F12'?'外婆':'妈妈'}从柜顶拿下一个铁盒，借着手电筒检查里面的零钱和信封。她说，这笔钱是留给突然要用钱的时候的。`},
  YOU01:{prompt:'初中的班级义卖快到了。同桌拉你一起摆摊，老师把登记好的旧书和手工品交给你们：价钱写清楚，收款要记账，最后统一捐出。这回轮到你自己核对每一笔小钱。'},
  FAM04:{prompt:'放学回家，听见邻居说这条街也许要拆迁，连搬去哪儿都聊起来了。家人说还没有正式通知，家里的预算先照常安排。你想知道，这种消息究竟能不能当真。'},
  FAM05:{title:'学费和家里的日常开支',prompt:`准备上高中，${carer}把新学期的学费、交通和生活用品列成一张清单。继续读书的钱要先安排好，家里的其他开支也得顾上。你坐下来，想说说自己能做些什么。`},
  FAM06:{title:'家里留下的旧股票凭证',prompt:'整理家里抽屉，你翻出一张长辈留下的旧股票凭证。家人说，当年它也让人兴奋过，不过纸上写的金额不等于今天能取出来的钱。你想先弄清这张纸是什么。'},
  AGE16A:{title:'家里的旧股票交割单',prompt:`${seen('FAM06')?'看过旧股票凭证后，家人又找来几张过去的交割单。':'整理抽屉时，你发现几张长辈留下的股票交割单。'}上面有买入、卖出和手续费，有赚过的，也有亏过的。比起只听一个收益数字，这些记录具体多了。`},
  AGE16B:{prompt:`${seen('AGE16A')?'旧交割单上几个看不懂的地方，成了周末饭桌上的话题。':'周末聚餐，亲戚聊起股票开户。'}家人把买入、卖出、费用和亏损逐项说清，也提醒你：现在先了解规则，十八岁以后再决定是否用自己的钱参与。`},
  AGE16C:{prompt:`${seen('AGE16B')?'聊过开户和交易费用后，':''}家人摊开报纸，提议挑几只股票，用一笔虚拟本金记在纸上，过些日子再核算。这里只做模拟，不动你的零花钱，也不会买入真实股票。`},
  FAM02:{prompt:`十七岁的家庭聚餐上，${seen('AGE16C')?'你刚接触过纸上模拟，就听见':''}舅舅宣布自己一天赚了别人一个月工资，舅妈却问他去年亏了多少。真实买卖里的得意与难堪，同时摆在了饭桌上。`},
  YOU02:{prompt:`${seen('AGE16C')?'看过纸上记录后，':''}同学带你试了一个股票模拟账户。里面用的都是虚拟资金，连赢三次，你忍不住给自己取名“海临索罗斯”。这份成绩还没有替你挣到一分钱。`},
  YOU05:{prompt:'高三放假前，同学阿豪说成年后想一起做点小生意，林夏追问准备卖什么、钱从哪里来。你们站在小卖部门口，汽水还没喝完。眼下先把书读完，以后的事能不能约定得具体一点？'},
 };
 return {...e,...stories[e.id]};
}
export function teenStoryChoice(s,e,c){
 if(!isTeenStory(e.id))return c;
 const index=e.choices.findIndex(choice=>choice.id===c.id);
 const labels={
  MAIN03:['试着核对一项开支','说自己以后也想分担','坐下来听家人把账算完'],
  FAM05:['把学业安排好，争取奖学金','放学后帮家里分担些事情','一起核对哪些开支可以调整'],
  FAM06:['查查这张凭证的来历','带去学校给同学看看','听家人讲长辈当年的经历'],
  AGE16A:['把买入卖出记成一张表','问家人当年为什么买','只看记录，暂时不下判断'],
  AGE16B:['先学会算交易费用','问家人亏钱以后怎么办','听完规则，先不急着参与'],
  AGE16C:['把价格和费用都记下来','请家人讲讲当年的判断','先观察几周再记结论'],
  YOU02:['核对每笔模拟交易和漏记的亏损','把模拟收益截图设成头像','退出模拟盘，和同学去打球'],
 };
 const schoolResults=[
  ['你把课程和奖学金条件记下来，家人也把学费从其他开支里单独留好。','奖学金的要求比想象中高，你先从整理功课和查清申请条件做起。'],
  ['放学后你帮着跑腿、核对购物清单，家里少了一点忙乱，你也更明白日常开支。','你把事情排得太满，作业做晚了。家人和你重新商量了不耽误上课的安排。'],
  ['你们把必要开支和可以推迟的购买分开写，读书和生活都有了更清楚的安排。'],
 ];
 return {...c,label:labels[e.id]?.[index]??c.label,outcomes:c.outcomes.map((o,i)=>({...o,
  ...(e.id==='FAM05'?{title:'新学期的开支安排好了',text:schoolResults[index][i]??schoolResults[index][0]}:{}),
  ...(e.id==='FAM06'?{text:o.text.replaceAll('爷爷','家人').replace('他讲的最多的','家人讲得最多的')}:{}),
  ...(['AGE16A','AGE16C'].includes(e.id)?{text:o.text.replace('他们讲了','家人讲了').replace('他们翻出','家人翻出')}:{}),
  ...(e.id==='FAM07'&&s.familyId==='F12'?{text:o.text.replaceAll('母亲','外婆')}:{}),
 }))};
}
