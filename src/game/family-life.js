import {gameDate,addGameDays,validGameDate} from './game-calendar.js';
import {hasMetPerson,meetPerson,personRelation,setPersonRelation} from './people.js';
import {childAge,welcomeChild} from './household.js';
import {familyStory} from './family-scenes.js';

const days=(a,b)=>a&&b?Math.max(0,Math.floor((Date.parse(b)-Date.parse(a))/86400000)):0;
const today=gameDate;
export const FAMILY_ACTIONS=new Set(['family_start','family_budget','family_wedding','family_topic','family_car_sell']);
export const FAMILY_STAGES={friends:'朋友',dating:'恋爱中',together:'共同生活',engaged:'筹备婚礼',married:'已婚'};
export const WEDDING_GIFTS=[0,1880000,3880000,6880000];
export const WEDDING_FEASTS=[300000,1000000,3000000,8000000];
export function familyState(s){
 return s.familyLife||{version:1,stage:s.household.partner?'together':'friends',legacyShared:Boolean(s.household.partner),metOn:null,startedOn:null,marriedOn:null,visits:0,pending:null,pendingOn:null,seen:{},nextTopicOn:null,romanceBudget:0,householdMonthly:180000,lastSalaryMonth:null,lastDateSlot:null,dateMonth:null,dateSpent:0,wallet:0,giftValue:0,playerPaid:0,partnerPaid:0,childPlan:'undecided',pregnancyOn:null,prenatal:false,supplies:false,careSeen:false,car:null};
}
export const ensureFamily=s=>s.familyLife??=familyState(s);
export const familyTimeActive=s=>Boolean(s.familyLife&&(s.familyLife.pending||s.familyLife.stage!=='friends'));
export const familyAssetValue=s=>s.familyLife?.car?.value||0;
export function linXiaCareer(s){
 const f=familyState(s),young=s.age<22;
 const base=young?200000:s.age<30?280000:s.age<40?460000:s.age<60?650000:300000;
 const recovery=s.household.childBornOn&&days(s.household.childBornOn,today(s))<180;
 return {title:young?'大学在读':s.age>=60?'退休':s.age<30?'社区项目助理':s.age<40?'项目协调员':'项目负责人',income:Math.round(base*(recovery?.6:1)),incomeLabel:young?'每月生活费':s.age>=60?'每月养老金':'月收入',recovery:Boolean(recovery),wallet:f.wallet};
}
export function familyCosts(s){
 const f=familyState(s),age=childAge(s),couple=f.stage==='married'||f.legacyShared;
 const child=s.household.hasChild&&(age===null||age<22)?age===null?200000:age<3?200000:age<6?140000:age<12?160000:age<18?200000:240000:0;
 if(f.legacyShared||f.stage==='friends'){const partner=s.household.partner?90000:0,legacyChild=s.household.hasChild&&(age===null||age<22)?200000:0;return {total:partner+legacyChild,contribution:0,player:partner+legacyChild,partner,child:legacyChild,transport:f.car?80000:0,childTotal:legacyChild};}
 const total=(couple?f.householdMonthly:0)+child;
 const contribution=couple?Math.min(Math.floor(total/2),Math.floor(linXiaCareer(s).income*.5)):0;
 const childShare=total?Math.round(contribution*child/total):0;
 return {total,contribution,player:total-contribution,partner:couple?f.householdMonthly-(contribution-childShare):0,child:child-childShare,transport:f.car?80000:0,childTotal:child};
}
export function familyStatus(s){
 const f=familyState(s),date=today(s);
 return {...f,label:FAMILY_STAGES[f.stage],daysKnown:days(f.metOn,date),daysDating:days(f.startedOn,date),daysMarried:days(f.marriedOn,date),childAge:childAge(s),career:linXiaCareer(s),costs:familyCosts(s)};
}
function remember(s,title,text,trust=0,id='N02'){
 const f=ensureFamily(s);meetPerson(s,id);setPersonRelation(s,id,personRelation(s,id)+trust);
 if(s.lifeArcs){
  const list=s.lifeArcs.memories[id]??=[];list.push({age:s.age,day:s.debtClock?.day||0,date:today(s),text});if(list.length>24)list.shift();
  s.lifeArcs.history.push({key:'family_'+(f.pending||'daily'),title,text,age:s.age,day:s.debtClock?.day||0});if(s.lifeArcs.history.length>240)s.lifeArcs.history.shift();
 }
}
function offer(s,key){const f=ensureFamily(s);f.pending=key;f.pendingOn=today(s);s.lifeArcs.pending='family';return true;}
export function noteFamilyVisit(s,id){if(id!=='N02')return;const f=ensureFamily(s);f.metOn??=today(s);f.visits++;}
export function familyStartReason(s){
 const f=familyStatus(s);
 if(!hasMetPerson(s,'N02'))return '先在故事中认识林夏';
 if(f.stage!=='friends')return '你们已经确认关系';
 if(f.seen.friendsOnly)return '你们约定先做朋友；可在关系安排中重新提出';
 if(f.daysKnown<30||f.visits<3)return '认识至少 30 天，并有 3 次实际往来后再谈恋爱';
 if(personRelation(s,'N02')<60)return '与林夏的信任达到 60 后再表达心意';
 return '';
}
export function refreshFamily(s){
 const f=ensureFamily(s),date=today(s);
 if(s.age<18||s.age>=80||s.survival?.failed||s.legal?.prisonMonthsLeft>0)return false;
 if(hasMetPerson(s,'N02'))f.metOn??=date;
 if(f.pending){if(!s.lifeArcs.pending)s.lifeArcs.pending='family';return true;}
 if(s.lifeArcs.pending)return false;
 if(!hasMetPerson(s,'N02'))return s.age>=18.5&&s.seenEvents?.includes('MAIN04')&&!f.seen.meet&&offer(s,'meet');
 if(f.stage==='friends')return !familyStartReason(s)&&!f.seen.confession&&offer(s,'confession');
 if(s.household.hasChild){
  const age=childAge(s);
  if(age!==null&&age>=18&&!f.seen.adulthood)return offer(s,'adulthood');
  if(age!==null&&age>=6&&!f.seen.school)return offer(s,'school');
  if(age!==null&&age<1&&!f.careSeen&&days(s.household.childBornOn,date)>=30)return offer(s,'childcare');
 }
 if(f.pregnancyOn&&!s.household.hasChild){
  const elapsed=days(f.pregnancyOn,date);
  if(elapsed>=90&&!f.prenatal)return offer(s,'prenatal');
  if(elapsed>=180&&!f.supplies)return offer(s,'baby_supplies');
  if(elapsed>=270)return offer(s,'birth');
 }
 const topicDue=!f.nextTopicOn||date>=f.nextTopicOn;
 if(topicDue&&['dating','together'].includes(f.stage)&&s.age>=24&&(f.legacyShared||days(f.startedOn,date)>=365)&&!f.seen.noMarriage)return offer(s,'marriage');
 if(topicDue&&f.stage==='married'&&s.age<45&&!s.household.hasChild&&!f.pregnancyOn&&f.childPlan==='undecided'&&days(f.marriedOn,date)>=455)return offer(s,'baby_plan');
 // Ordinary scenes are spaced six weeks apart and cannot displace a milestone.
 const last=f.seen.lastStory;
 if(last&&days(last,date)<45)return false;
 if(personRelation(s,'N02')<35&&(!f.seen.reconnect||days(f.seen.reconnect,date)>=180))return offer(s,'reconnect');
 if(f.giftValue>0&&(!f.seen.return_gift||days(f.seen.return_gift,date)>=180))return offer(s,'return_gift');
 const year=date.slice(0,4);
 if(date.slice(5)==='06-15'&&f.seen.birthdayYear!==year)return offer(s,'birthday');
 const bucket=Math.floor((s.debtClock?.day||0)/120);
 if(f.seen.ordinaryBucket!==bucket){f.seen.ordinaryBucket=bucket;return offer(s,bucket%2?'her_work':'disagreement');}
 return false;
}
export function familyScene(s){
 const f=familyState(s),scene=familyStory(s,f);if(!scene)return null;
 if(scene.art==='family-date'&&s.age>=35)scene.art='family-talk';
 if(['family_budget','baby_plan','marriage','adulthood'].includes(scene.id))scene.art='family-budget';
 if(scene.art==='family-newborn'&&s.age>=36)scene.art='family-newborn-hospital';
 if(scene.id==='return_gift')scene.text=`林夏递来${f.giftValue?'一份按自己预算挑选的小礼物':'一张亲手写的卡片'}：“你记得我的喜好，我也想记得你的。”她还安排了下一次由她请客。礼物留作纪念，不会变成账户里的现金。`;
 return scene;
}
export function weddingQuote(s,plan={}){
 const f=familyState(s),gift=plan.gift??0,feast=plan.feast??300000,housing=plan.housing??'rent',transport=plan.transport??'public';
 const owned=s.positions.some(p=>p.kind==='housing'&&p.value>0&&!p.frozen);
 const relocation=housing==='rent'?60000:0,car=transport==='car'&&!f.car?3000000:0;
 const partner=Math.min(f.wallet,Math.floor((feast+relocation)/2));
 const player=gift+feast+relocation+car-partner;
 const invalid=!WEDDING_GIFTS.includes(gift)||!WEDDING_FEASTS.includes(feast)||!['rent','owned'].includes(housing)||!['public','car'].includes(transport);
 const reason=invalid?'请选择有效的婚礼方案':housing==='owned'&&!owned?'目前没有可入住的自有房产，可以先租房或去房产市场购置':s.cash<player?`还差 ¥${((player-s.cash)/100).toFixed(2)}，可以缩减方案或继续存钱`:'';
 return {gift,feast,housing,transport,relocation,car,partner,player,total:player+partner,reason};
}
export function familyActionReason(s,a){
 if(s.phase!=='planning'||s.age<18||s.age>=80||s.legal?.prisonMonthsLeft>0||s.survival?.failed)return '先处理眼前的事，再安排两个人的生活';
 const f=familyState(s);
 if(a.type==='family_start')return s.lifeArcs?.pending?'先处理当前消息':familyStartReason(s);
 if(!hasMetPerson(s,'N02'))return '还没有认识林夏';
 if(a.type==='family_budget'){
  if(f.stage==='friends')return '确认恋爱关系后再安排共同预算';
  if(!Number.isSafeInteger(a.amount)||a.amount<0||a.amount>200000)return '每月约会预算请选择 0–2,000 元的整数金额';
  return '';
 }
 if(a.type==='family_wedding'&&s.lifeArcs?.pending)return '先处理眼前的消息，再确认婚礼';
 if(a.type==='family_wedding')return f.stage!=='engaged'?'先和林夏谈谈结婚的打算':weddingQuote(s,a).reason;
 if(a.type==='family_car_sell')return f.car?'':'目前没有家庭车辆';
 if(a.type==='family_topic'){
  if(s.lifeArcs?.pending||f.pending)return '先处理眼前这条消息';
  if(a.topic==='romance'){if(f.stage!=='friends')return '你们已经在交往';const copy={...s,familyLife:{...f,seen:{...f.seen,friendsOnly:false}}};return familyStartReason(copy);}
  if(a.topic==='marriage')return ['dating','together','engaged'].includes(f.stage)&&s.age>=24&&(f.legacyShared||days(f.startedOn,today(s))>=365)?'':'24 岁且恋爱满一年后，再一起商量婚礼';
  if(a.topic==='baby')return f.stage==='married'&&s.age<45&&!s.household.hasChild&&!f.pregnancyOn&&days(f.marriedOn,today(s))>=455?'':s.age>=45?'这段人生不再新增孕育线，可以继续两个人的生活':'婚后一年多再商量生育计划';
  return '没有这项家庭安排';
 }
 return '没有这项家庭安排';
}
export function familyChoiceReason(s,choice,event){
 const f=familyState(s),scene=familyScene(s);
 if(event!==undefined&&event!==`${f.pending}:${f.pendingOn}`)return '这条家庭消息已更新，请重新打开后选择';
 if(!scene?.choices.some(c=>c[0]===choice))return '这件事已经处理，或选项不存在';
 const cost=scene.id==='birthday'&&choice==='gift'?20000:scene.id==='her_work'&&choice==='celebrate'?10000:0;
 if(s.cash<cost)return `需要现金 ¥${cost/100}，也可以选择不花钱的安排`;
 if(scene.id==='confession'&&choice==='date')return familyStartReason(s);
 if(scene.id==='baby_plan'&&choice==='prepare'&&f.stage!=='married')return '先完成婚姻安排';
 return '';
}
function spend(s,api,amount,label,required=false){
 const f=ensureFamily(s);if(!amount)return;
 if(required)api.charge(s,amount,'家庭：'+label);else api.cashChange(s,-amount,'家庭：'+label);
 f.playerPaid+=amount;
}
function sharedSpend(s,api,total,label){
 const f=ensureFamily(s),partner=Math.min(f.wallet,Math.floor(total/2));f.wallet-=partner;f.partnerPaid+=partner;
 spend(s,api,total-partner,label,true);
 return `总额 ¥${total/100}，林夏用自己的储蓄支付 ¥${partner/100}，你承担 ¥${(total-partner)/100}。现金不足的已发生费用记入待付账单。`;
}
export function executeFamilyAction(s,a,api){
 const f=ensureFamily(s);
 if(a.type==='family_start'){offer(s,'confession');return {title:'把心意说给林夏听',text:'林夏愿意认真聊聊你们的关系，等你作出回应。'};}
 if(a.type==='family_budget'){f.romanceBudget=a.amount;return {title:'约会预算已调整',text:`每月最多 ¥${a.amount/100}，分两次安排；只在实际活动时支付，余额不足会改成免费活动。礼物另行决定。${f.dateSpent?`本月已发生的 ¥${f.dateSpent/100} 不退回，剩余安排按新上限执行。`:""}`};}
 if(a.type==='family_topic'){
  const key={romance:'confession',marriage:'marriage',baby:'baby_plan'}[a.topic];
  if(a.topic==='romance'){delete f.seen.friendsOnly;delete f.seen.confession;const reason=familyStartReason(s);if(reason)throw Error(reason);}
  offer(s,key);return {title:'约好认真聊一次',text:'这件事需要你们共同决定。'};
 }
 if(a.type==='family_car_sell'){
  const value=f.car.value;api.cashChange(s,value,'出售家庭车辆');api.record(s,'position',-value,'家庭车辆出售');f.car=null;
  return {title:'家庭车辆已出售',text:`车辆成交到账 ¥${value/100}，之后不再收取每月养车预算。`};
 }
 const q=weddingQuote(s,a);
 f.wallet-=q.partner;f.partnerPaid+=q.partner;
 spend(s,api,q.gift,'彩礼赠予林夏家人');spend(s,api,q.feast+q.relocation-q.partner,'婚礼与搬家实际分担');
 if(q.car){api.cashChange(s,-q.car,'购入家庭车辆');f.car={cost:q.car,value:q.car,boughtOn:today(s),lastMonth:today(s).slice(0,7)};api.record(s,'position',q.car,'家庭车辆入账');}
 f.stage='married';f.legacyShared=false;f.marriedOn=today(s);f.wedding={...q,date:today(s)};f.nextTopicOn=null;s.household.partner=true;s.flags.partner=true;s.flags.shared_household=true;
 const text=`婚礼办好了。你实际支付 ¥${q.player/100}，林夏支付 ¥${q.partner/100}。${q.gift?'彩礼赠予她的家人，不再计入你们的资产。':'双方商定不另付彩礼。'}${q.car?'车辆记为你的家庭资产，可在关系页出售。':''}接下来一起安排每月生活。`;
 remember(s,'你和林夏结婚了',text,6);offer(s,'family_budget');return {title:'你和林夏结婚了',text};
}
export function executeFamilyChoice(s,c,api){
 const f=ensureFamily(s),scene=familyScene(s),key=f.pending;let text='',trust=0;
 f.seen[key]=today(s);f.seen.lastStory=today(s);f.pending=null;f.pendingOn=null;s.lifeArcs.pending=null;
 if(key==='meet'){f.seen.meet=true;if(c==='meet'){meetPerson(s,'N02');f.metOn=today(s);f.visits=1;trust=4;text='你们交换了联系方式，约好下次活动再见。';}else text='今天先告别，这次没有建立新的往来。';}
 if(key==='confession'){if(c==='date'){f.stage='dating';f.startedOn=today(s);s.household.partner=true;s.flags.partner=true;f.nextTopicOn=addGameDays(today(s),45);trust=5;text='你们确认了恋爱关系。各自生活照旧，约会预算由你们另行安排，暂不增加共同生活费。';}else{f.seen.friendsOnly=true;text='你们决定先做朋友，保留平常的来往。';}}
 if(key==='birthday'){f.seen.birthdayYear=today(s).slice(0,4);if(c==='gift'){spend(s,api,20000,'给林夏的生日礼物');f.giftValue=20000;trust=5;text='你花 ¥200 挑了她用得上的礼物，她很喜欢你记住了那句话。';}else{trust=c==='handmade'?4:-1;text=c==='handmade'?'信里写着你记得的小事。你们一起散步，没有额外消费。':'你提前说明今天的安排，林夏说改天再见。';}}
 if(key==='return_gift'){const value=Math.min(f.wallet,f.giftValue);f.wallet-=value;f.partnerPaid+=value;f.giftValue=0;trust=c==='thanks'?4:3;if(c==='talk')api.stat(s,{stress:-2});text=`林夏送来的心意已记入往来${value?`，礼物价值约 ¥${value/100}`:'，她亲手写了卡片'}。这是礼物，没有增加你的现金。`;}
 if(key==='disagreement'){trust=c==='listen'?5:c==='explain'?2:-8;api.stat(s,{stress:c==='listen'?-3:c==='explain'?-1:3});text=c==='ignore'?'你继续看行情，林夏独自吃完了饭。':c==='listen'?'你把手机收起来，认真听她讲完。':'你说清了自己的不安，也重新约好了完整相处的时间。';}
 if(key==='her_work'){trust=c==='celebrate'?4:c==='walk'?3:-5;if(c==='celebrate')spend(s,api,10000,'一起庆祝林夏项目完成');text=c==='celebrate'?'你支付自己的 ¥100 餐费，林夏承担她那份。':c==='walk'?'你们走了很久，听她讲那些不容易的地方。':'她还没讲完，你又聊起自己的收益。';}
 if(['marriage','wedding_ready'].includes(key)){if(c==='plan'){f.stage='engaged';text='你们开始筹婚。到关系页核对方案，最终确认前不扣钱。';}else{f.stage=f.legacyShared?'together':'dating';f.nextTopicOn=addGameDays(today(s),180);if(c==='unmarried')f.seen.noMarriage=true;text=c==='unmarried'?'你们决定保留恋爱关系，暂不筹备婚礼。':'你们决定再积累半年，到时重新商量。';}}
 if(key==='family_budget'){f.householdMonthly=c==='frugal'?120000:c==='comfortable'?300000:180000;trust=3;text=`共同增量生活预算定为每月 ¥${f.householdMonthly/100}，与原有个人日常开支分开；林夏按收入承担自己的份额。实际每日结算，不一次扣整月。`;}
 if(key==='baby_plan'){if(c==='prepare'){f.childPlan='expecting';f.pregnancyOn=today(s);f.prenatal=false;f.supplies=false;trust=4;text='你们共同决定迎接孩子，开始记录孕期。预计约九个月后分娩；检查与用品按实际进度付费。';}else{f.childPlan=c==='postpone'?'undecided':'not_now';f.nextTopicOn=addGameDays(today(s),365);text=c==='postpone'?'你们决定一年后再谈，这段时间先照顾好彼此。':'你们决定暂不生育。以后愿意时，可以在关系页重新商量。';}}
 if(key==='prenatal'){f.prenatal=true;trust=c==='accompany'?4:1;if(c==='accompany')s.behavior.fatigue=Math.min(100,s.behavior.fatigue+3);text='孕期检查完成。'+sharedSpend(s,api,100000,'孕期检查');}
 if(key==='baby_supplies'){f.supplies=true;trust=3;text='必需用品已准备。'+sharedSpend(s,api,c==='help'?100000:200000,'新生儿必需用品');}
 if(key==='birth'){
  welcomeChild(s);f.childPlan='born';f.pregnancyOn=null;meetPerson(s,'N09');setPersonRelation(s,'N09',60);trust=5;s.behavior.fatigue=Math.min(100,s.behavior.fatigue+(c==='shared'?8:3));
  text='小满今天出生，年龄从 0 岁开始。'+sharedSpend(s,api,c==='shared'?300000:500000,'分娩与初期照护')+'林夏恢复期间收入暂按六成计算，共同照护费用按孩子年龄进入日常账本。';
 }
 if(key==='childcare'){f.careSeen=true;trust=c==='share'?4:c==='cover'?5:-7;s.behavior.fatigue=Math.min(100,s.behavior.fatigue+(c==='share'?5:c==='cover'?10:0));if(c==='leave')api.stat(s,{stress:4});text=c==='leave'?'照护又落在林夏一个人身上，她对这个安排很失望。':'你们重新分好夜间照护，也给彼此留出补觉时间。';}
 if(key==='school'){trust=c==='share'?3:0;setPersonRelation(s,'N09',personRelation(s,'N09')+(c==='share'?4:6));text='入学和接送安排记好了，之后按孩子自己的年龄更新日常开销。';}
 if(key==='adulthood'){setPersonRelation(s,'N09',personRelation(s,'N09')+(c==='respect'?6:4));if(c==='support')api.stat(s,{stress:-2});text='你们给小满留下选择的空间，支持也说清楚了边界。';}
 if(key==='reconnect'){trust=c==='repair'?6:1;if(c==='space')f.romanceBudget=0;text=c==='repair'?'你认真承认失约，接下来需要用行动兑现。':'你们给彼此留出空间，付费约会暂时取消。';}
 if(key!=='meet'||c==='meet')remember(s,scene.title,text,trust);
 return text;
}
export function advanceFamilyDay(s,api){
 const f=ensureFamily(s),date=today(s),month=date.slice(0,7);
 if(!hasMetPerson(s,'N02')||s.age<18)return;
 const career=linXiaCareer(s);
 if(date.slice(8)>='10'&&f.lastSalaryMonth!==month){
  f.lastSalaryMonth=month;
  // Her own costs and her share never pass through the player's cash account.
  f.wallet+=Math.max(0,career.income-160000-familyCosts(s).contribution);
  if(f.car&&f.car.lastMonth!==month){const old=f.car.value;f.car.value=Math.max(100000,Math.round(old*.99));f.car.lastMonth=month;api.record(s,'position',f.car.value-old,'家庭车辆折旧');}
 }
 if(!['dating','engaged','married','together'].includes(f.stage)||f.pending||s.legal?.prisonMonthsLeft>0)return;
 const slot=month+(Number(date.slice(8))<15?':a':':b');
 if(f.lastDateSlot===slot)return;f.lastDateSlot=slot;
 if(f.dateMonth!==month){f.dateMonth=month;f.dateSpent=0;}
 const cost=Math.max(0,Math.min(Math.floor(f.romanceBudget/2),f.romanceBudget-f.dateSpent)),paid=cost>0&&s.cash>=cost?cost:0;
 f.dateSpent+=paid;
 if(paid)spend(s,api,paid,'与林夏的日常约会');
 const herCost=Math.min(f.wallet,paid);f.wallet-=herCost;f.partnerPaid+=herCost;
 remember(s,'两个人的日常',paid?`这次约会你花 ¥${paid/100}，林夏承担自己的 ¥${herCost/100}。`:'你们留了时间散步聊天，没有额外消费。',1);
}
export function validateFamily(s){
 const f=ensureFamily(s),bad=()=>{throw Error('存档中的婚恋家庭记录无效');};
 f.dateMonth??=null;f.dateSpent??=0;
 if(f.version!==1||!Object.hasOwn(FAMILY_STAGES,f.stage)||typeof f.legacyShared!=='boolean')bad();
 for(const k of ['dateSpent','visits','romanceBudget','householdMonthly','wallet','giftValue','playerPaid','partnerPaid'])if(!Number.isSafeInteger(f[k])||f[k]<0||f[k]>Number.MAX_SAFE_INTEGER/4)bad();
 if(f.romanceBudget>200000||![120000,180000,300000].includes(f.householdMonthly))bad();
 for(const k of ['metOn','startedOn','marriedOn','pendingOn','nextTopicOn','pregnancyOn'])if(f[k]!==null&&!validGameDate(f[k]))bad();
 if(f.pending!==null&&!familyStory(s,f))bad();
 if(f.pending&&s.lifeArcs?.pending!=='family')bad();
 if(s.lifeArcs?.pending==='family'&&!f.pending)bad();
 if(!f.seen||typeof f.seen!=='object'||Array.isArray(f.seen)||Object.keys(f.seen).length>40)bad();
 for(const k of ['prenatal','supplies','careSeen'])if(typeof f[k]!=='boolean')bad();
 if(!['undecided','not_now','expecting','born'].includes(f.childPlan))bad();
 if(f.lastSalaryMonth!==null&&!/^\d{4}-\d{2}$/.test(f.lastSalaryMonth))bad();
 if(f.dateMonth!==null&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(f.dateMonth))bad();
 if(f.lastDateSlot!==null&&!/^\d{4}-\d{2}:[ab]$/.test(f.lastDateSlot))bad();
 if(f.car&&(!Number.isSafeInteger(f.car.value)||f.car.value<0||f.car.value>f.car.cost||f.car.cost!==3000000||!validGameDate(f.car.boughtOn)||!/^\d{4}-\d{2}$/.test(f.car.lastMonth)))bad();
 if(s.household.childBornOn!==undefined&&(!validGameDate(s.household.childBornOn)||s.household.childBornOn>today(s)))bad();
 if(f.pending&&!f.pendingOn)bad();
 for(const k of ['metOn','startedOn','marriedOn','pendingOn','pregnancyOn'])if(f[k]&&f[k]>today(s))bad();
 if(f.stage==='married'&&!f.marriedOn)bad();
 if(f.metOn&&f.startedOn&&f.startedOn<f.metOn)bad();
 if(f.marriedOn&&f.startedOn&&f.marriedOn<f.startedOn)bad();
 if(f.pregnancyOn&&(f.stage!=='married'||s.household.hasChild||f.childPlan!=='expecting'))bad();
 return f;
}
