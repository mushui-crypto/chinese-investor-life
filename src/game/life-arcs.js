import {childAge} from './household.js';
import {refreshFamily,familyScene,familyChoiceReason,executeFamilyChoice,advanceFamilyDay,noteFamilyVisit} from './family-life.js';
import {jobSearchWait,jobSearchState} from './job-search.js';
import {startCareer} from './careers.js';
import {refreshConsumption,consumptionScene,consumptionReason,executeConsumption,validateConsumption} from './consumption.js';
import {isCollegeStudent,COLLEGE_JOB_REASON} from './education.js';
import {monthlyReceipts,preservePension,hasSalariedJob} from './work-economy.js';
import {hasMetPerson,meetPerson,meetStoryPeople,storyPeople,personRelation,setPersonRelation} from './people.js';
import {fullDayWorkReason,recordWork} from './work-economy.js';
import {childhoodActivity} from './childhood-activities.js';
/** 人物、承诺与重建。使用独立的确定性种子；读档和预览不消耗市场随机数。 */
export const PEOPLE={N01:'阿豪',N02:'林夏',N03:'许舟',N04:'老周',N07:'赵姨',N09:'小满',N10:'父母或照护者',N12:'吴师傅'};
const hash=text=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const now=s=>s.debtClock?.day||0;
const worth=s=>s.cash+(s.childhood?.inventory?.cost||0)+[...s.positions,...s.claims,...s.businesses].reduce((n,x)=>n+x.value,0)-s.debts.reduce((n,d)=>n+d.principal+d.interest,0);
export function newLifeArcs(s,legacy=false){const net=worth(s);return {version:1,legacy,startedAge:s.age,startedDay:now(s),seed:hash(`${s.seed}:${s.familyId}:people`),lifestyle:0,pending:null,seen:[],history:[],memories:{},visits:{},promises:[],jobs:[],used:[],wageRate:monthlyReceipts(s),wageTurn:s.turn,wageAdjustment:0,businessTurns:0,lastBusinessTurn:s.turn,inheritance:false,audit:{peak:net,trough:net,maxDrawdown:0,biggestDrop:0,dropTitle:'',interestPaid:0,repaid:0,decisions:[]}};}
export const lifeArcs=s=>s.lifeArcs||(s.lifeArcs=newLifeArcs(s,true));
const variant=(s,key)=>hash(`${lifeArcs(s).seed}:${key}`)%3;
export const relation=personRelation;
export function remember(s,id,text,change=0){meetPerson(s,id);const a=lifeArcs(s),list=a.memories[id]??=[];list.push({age:s.age,day:now(s),text});if(list.length>24)list.shift();setPersonRelation(s,id,relation(s,id)+change);}
function history(s,key,title,text){const a=lifeArcs(s);a.history.push({key,title,text,age:s.age,day:now(s)});if(a.history.length>240)a.history.shift();if(!a.seen.includes(key))a.seen.push(key);}
export function lifeScene(s){const key=lifeArcs(s).pending;if(!key)return null;if(key==='family')return familyScene(s);if(key==='consumption')return consumptionScene(s);
 const scenes={
  comfort:{title:'终于能过点好日子了',text:'账户里的数变大了。你看中了一套更宽敞的出租屋，饭局上的朋友也开始习惯由你买单。',choices:[['upgrade','搬家，把生活过阔一点','每月固定开销增加 1,200 元。'],['steady','先照现在的日子过','']]},
  pressure:{title:'收入瘦了，账单没瘦',text:'搬家后的花销已经变成习惯，账户却跌回了从前。账单摆在桌上，有人问你最近到底怎么样。',choices:[['cut','退掉额外开销，把账摊开','取消每月 1,200 元额外开销。'],['keep','先撑住，之后再说','每月仍多支出 1,200 元。']]},
  request:{title:'熟人也有难处',text:`${PEOPLE[contact(s)]}发来消息：家里临时缺一笔钱，想请你搭把手。消息里没有说什么时候能缓过来。`,choices:[['help','拿出 300 元帮忙','赠予对方，不用归还。'],['promise','约好七天内见面聊','1 点精力'],['decline','坦白说自己也紧张','']]},
  promise_due:{title:'那次约定，没能赴约',text:'对话框里的“改天见”一直停在那里。对方已经不再追问。',choices:[['repair','说清楚，重新约一次','花 1 点精力。'],['leave','暂时放下这段对话','']]},
  disclosure:{title:'账单寄到了家里',text:'家里人看到了逾期通知。电话里没有谈行情，只问你现在到底欠了多少。',choices:[['tell','把账本完整拿出来','说清欠款，压力下降。'],['hide','还是说很快就好','欠款和催收照常继续。']]},
  response:{title:'几天后，收到回信',text:['对方记住了你这次伸手，说有合适的活会再联系你。','那笔钱确实帮上了忙，但对方眼下还顾不上别的。','消息停在已读。你暂时联系不上对方。'][variant(s,'motive')],choices:[['read','把这件事记下','']]},
 };
 return scenes[key]?{key,...scenes[key]}:null;
}
export function contact(s){const ids=s.familyId==='F04'?['N07','N04','N01']:s.familyId==='F02'?['N12','N07','N01']:['N01','N04','N07'];return ids[variant(s,'contact')];}
export function refreshLifeArcs(s){const a=lifeArcs(s);if(s.age<18||s.age>=80||s.legal?.prisonMonthsLeft>0||a.pending||s.survival?.failed)return;
 if(refreshFamily(s))return;
 const net=worth(s),pick=key=>{if(!a.seen.includes(key)){a.pending=key;return true;}return false;};
 if(a.lifestyle>0&&(net<a.audit.peak*.55||s.debts.some(d=>d.overdue))&&pick('pressure'))return;
 if(s.debts.some(d=>d.overdue)&&a.seen.includes('pressure')&&pick('disclosure'))return;
 if(a.promises.some(p=>p.status==='broken')&&pick('promise_due'))return;
 if(refreshConsumption(s)){a.pending='consumption';return;}
 if(a.history.at(-1)?.day===now(s))return;
 if(net>=20_000_000&&pick('comfort'))return;
 // A familiar person arrives at a different stage in different lives.
 if(hasMetPerson(s,contact(s))&&s.age>=20+variant(s,'arrival')&&s.turn%3===variant(s,'visit')&&s.cash>=100_000&&pick('request'))return;
}
export function rebuildOffers(s){const a=lifeArcs(s),r=relation(s,'N04'),released=s.flags.ever_released;const offers=[
 {id:'shift',title:'赵姨的临时班',text:'去社区店里替一个班，当场结算。',days:0,pay:10000,cost:0,reason:fullDayWorkReason(s)},
 {id:'repair',title:'接一张维修单',text:'3 天后交付，收 300 元工钱。',days:3,pay:30000,cost:0,reason:s.stats.skill<40?'谋生本事达到 40 后可接单':''},
 {id:'referral',title:'老周介绍的工作',text:'2 天后入职，月薪 2,800 元。',days:2,wage:280000,pay:0,cost:0,reason:r<55?'与老周的熟悉与信任达到 55':''},
 {id:'apprentice',title:'吴师傅的短训',text:'先付 200 元材料费，5 天后可上岗，月薪 2,400 元。',days:5,wage:240000,pay:0,cost:20000,reason:''},
 {id:'reentry',title:'出狱后的试工',text:'3 天试工后发 240 元，并转为月薪 2,200 元的岗位。',days:3,wage:220000,pay:24000,cost:0,reason:released?'':'有出狱经历后可申请'},
 {id:'preorder',title:'老客的小订单',text:'预付 300 元备料，4 天后收 700 元货款。',days:4,pay:70000,cost:30000,reason:!s.businesses.length?'经营一家小店后开放':s.stats.credit<40?'信用恢复到 40 后可接单':''},
 ];
 for(const o of offers){o.personId=o.id==='referral'?'N04':['shift','preorder'].includes(o.id)?'N07':'N12';if(o.wage&&jobSearchWait(s))o.reason=jobSearchWait(s);else if(o.wage&&isCollegeStudent(s))o.reason=COLLEGE_JOB_REASON;else if(o.wage&&s.monthlyIncome>=o.wage)o.reason='现有月薪不低于这份工作';if(!hasMetPerson(s,o.personId))o.reason='还没有认识介绍人';}
 return offers.sort((x,y)=>hash(`${a.seed}:${x.id}`)-hash(`${a.seed}:${y.id}`)).map(o=>({...o,reason:a.used.includes(o.id)?'这次机会已经接过':o.reason||(s.cash<o.cost?'现金不足以支付材料费':s.actionPoints<1?'需要 1 点精力':''),allowed:!a.used.includes(o.id)&&!o.reason&&s.cash>=o.cost&&s.actionPoints>0&&s.phase==='planning'&&s.age>=18&&s.age<80&&!s.legal?.prisonMonthsLeft&&!s.survival?.failed}));
}
export const LIFE_ACTIONS=new Set(['life_choice','life_offer','life_visit','life_succession']);
export function lifeAvailability(s,action){
 if(s.phase!=='planning'||s.age<18||s.age>=80||s.legal?.prisonMonthsLeft>0)return '成年且能自由安排生活时开放';
 const a=lifeArcs(s);
 if(action.type==='life_choice'){const scene=lifeScene(s),choice=scene?.choices.find(c=>c[0]===action.choice);if(!scene||scene.key!==action.scene||!choice)return '这件事已经处理，或选项不存在';if(scene.key==='family')return familyChoiceReason(s,action.choice,action.event);if(scene.key==='consumption')return consumptionReason(s,action.choice);if(action.choice==='help'&&s.cash<30000)return '需要现金 300 元';if(action.choice==='repair'&&s.actionPoints<1)return '需要 1 点精力';return null;}
 if(s.actionPoints<1)return '需要 1 点精力，推进时间后恢复';
 if(action.type==='life_offer'){const o=rebuildOffers(s).find(o=>o.id===action.id);return o?.allowed?null:o?.reason||'没有这次机会';}
 if(action.type==='life_visit'){if(!PEOPLE[action.id]||!hasMetPerson(s,action.id))return '还没有认识这个人';if(action.id==='N10'&&!s.household.livingParent)return '已无法再见面';if(a.visits[action.id]===now(s))return '今天已经见过了，改天再来';return null;}
 if(action.type==='life_succession')return s.age<55?'55 岁后可整理传承':a.inheritance?'交接清单已经写好':null;
 return '未知生活安排';
}
export function executeLife(s,action,api){const a=lifeArcs(s);let text='';
 if(action.type==='life_choice'){
  const scene=lifeScene(s),c=action.choice,id=contact(s);a.pending=null;
  if(scene.key==='family')return executeFamilyChoice(s,c,api);
  if(scene.key==='consumption'){text=executeConsumption(s,c,api);history(s,'consumption_'+scene.id,scene.title,text);return text;}
  if(c==='upgrade'){a.lifestyle=120000;text='你搬进了更大的屋子，每月多支出 1,200 元。';remember(s,'N10','你说以后家里也能宽裕一点。',3);}
  if(c==='steady')text='你把租约留在了原处。账户涨了，生活费照旧。';
  if(c==='cut'){a.lifestyle=0;remember(s,'N10','你主动缩减开销，把回撤告诉了家里。',5);api.stat(s,{stress:-5});text='额外开销取消。你把账本摊在桌上。';}
  if(c==='keep'){remember(s,'N10','你说花销还能撑住，没有展开说。',-3);api.stat(s,{stress:6});text='原来的开销继续，每月多支出 1,200 元。';}
  if(c==='help'){api.cashChange(s,-30000,'帮助'+PEOPLE[id]);remember(s,id,'困难的时候，你拿出过 300 元。',8);a.jobs.push({id:'response',due:now(s)+7,kind:'reply',pay:0,wage:0});text='300 元已经转出。对方说了声谢谢。';}
  if(c==='promise'){a.promises.push({id,day:now(s)+7,status:'open'});remember(s,id,'你答应七天内见面聊聊。');text='约定记在了日历上，七天内去人物页拜访。';}
  if(c==='decline'){remember(s,id,'你坦白说自己也紧张。',variant(s,'motive')===2?-3:1);text='这次没有转钱。你把自己的情况说了出来。';}
  if(c==='repair'){s.actionPoints--;remember(s,id,'错过约定后，你认真作了解释。',5);text='道歉已经说出口，往后的相处仍要慢慢来。';}
  if(c==='leave')text='你暂时没有回复。';
  if(c==='tell'){s.behavior.disclosure='honest';s.behavior.reportedDebt=s.debts.reduce((n,d)=>n+d.principal+d.interest,0);s.behavior.hiddenAt=null;s.behavior.aidBlocked=false;remember(s,'N10','你把真实债务说清楚了。',5);api.stat(s,{stress:-6});text='债务没有减少，但家里知道了实情。';}
  if(c==='hide'){remember(s,'N10','面对逾期通知，你仍说很快就好。',-12);s.behavior.aidBlocked=true;api.stat(s,{stress:10});text='家人暂时不愿再提供援助，旧账照常继续。';}
  if(c==='read'){text=scene.text;remember(s,id,text,variant(s,'motive')===2?-8:4);}
  history(s,scene.key,scene.title,text);return text;
 }
 s.actionPoints--;
 if(action.type==='life_offer'){const o=rebuildOffers({...s,actionPoints:s.actionPoints+1}).find(o=>o.id===action.id);a.used.push(o.id);if(o.cost)api.cashChange(s,-o.cost,o.title+'材料费');if(o.days===0){if(o.id==='shift')recordWork(s,2);api.cashChange(s,o.pay,o.title+'工钱');text=`${o.title}做完了，工钱 ${o.pay/100} 元已经到账。`;}else{a.jobs.push({id:o.id,due:now(s)+o.days,kind:'work',pay:o.pay,wage:o.wage||0});text=`已接下${o.title}，${o.days} 个生活日后交付。`;}remember(s,o.id==='referral'?'N04':o.id==='shift'||o.id==='preorder'?'N07':'N12',text,3);history(s,'job_'+o.id,o.title,text);return text;}
 if(action.type==='life_visit'){const id=action.id;a.visits[id]=now(s);noteFamilyVisit(s,id);const p=a.promises.find(p=>p.id===id&&p.status==='open'&&now(s)<=p.day);if(p)p.status='kept';text=id==='N09'&&s.household.hasChild&&childAge(s)!==null&&childAge(s)<3?'你陪小满玩了一会儿，也分担了换洗和照护。':p?'你按约来了。两个人坐下来，把近况讲清楚。':s.debts.some(d=>d.overdue)?'你说起最近的欠款，对方听了很久。':worth(s)>=20_000_000?'你们聊起突然宽裕起来的日子，也聊到过去。':['你们一起吃了顿便饭，没看手机。','对方最近很忙，还是留了点时间给你。','你们聊起旧事，一直聊到天黑。'][variant(s,id+Math.floor(now(s)/7))];remember(s,id,text,p?8:4);api.stat(s,{trust:2,stress:-3});history(s,'visit_'+id,'与'+PEOPLE[id]+'见面',text);return text;}
 a.inheritance=true;const heir=s.household.hasChild?'N09':hasMetPerson(s,'N12')?'N12':null;if(heir)remember(s,heir,'你整理了资产和债务，并留下自己的安排。',5);history(s,'succession','把账本留清楚','你写明资产、债务和交接意愿。没有要求谁必须接班。');return '交接安排已写好，资产和债务仍在你名下。';
}
export function advanceLifeDays(s,api,notes=[]){const a=lifeArcs(s);
 for(const job of a.jobs.filter(j=>j.due<=now(s))){
  if(s.legal?.prisonMonthsLeft>0&&job.kind==='work'){notes.push('服刑期间无法履行'+job.id+'，这次工作取消。');history(s,'cancel_'+job.id,'工作没能继续','原定工作因服刑取消，材料费不退。');continue;}
  if(job.kind==='reply'){if(!a.seen.includes('response')&&!a.pending)a.pending='response';else {job.due=now(s)+1;continue;}}
  else if(job.wage&&isCollegeStudent(s)){if(job.id==='apprentice')api.cashChange(s,20000,'在读取消正式入职，退回材料费');if(job.pay)api.cashChange(s,job.pay,'已完成试工的工钱');const text='仍在大学读书，正式入职已取消；毕业后再求职。';notes.push(text);history(s,'done_'+job.id,'暂缓正式入职',text);}
  else if(job.wage&&jobSearchWait(s)){if(job.pay){api.cashChange(s,job.pay,'已完成试工的工钱');job.pay=0;}job.due=jobSearchState(s).readyOn;notes.push('试工已经交付，正式岗位还在等待招聘方确认，暂不计月薪。');continue;}
  else {if(job.pay)api.cashChange(s,job.pay,'完成'+job.id+'实际收款');if(job.wage&&(!hasSalariedJob(s)||job.wage>s.monthlyIncome)){preservePension(s);startCareer(s,{source:'job:'+job.id,wage:job.wage});s.flags.employed=true;s.flags.career_history=true;if(s.flags.ever_released)s.flags.reentry_employed=true;}api.stat(s,{skill:3,stress:-3});const text=`工钱到账 ${job.pay/100} 元${job.wage?`，目前月薪 ${s.monthlyIncome/100} 元`:''}。`;notes.push(text);history(s,'done_'+job.id,'一件工作交付了',text);}
  job.done=true;
 }
 a.jobs=a.jobs.filter(j=>!j.done&&!(s.legal?.prisonMonthsLeft>0&&j.kind==='work'&&j.due<=now(s)));
 for(const p of a.promises)if(p.status==='open'&&p.day<now(s)){p.status='broken';remember(s,p.id,'你答应见面，后来没有出现。',-12);}
 advanceFamilyDay(s,api);captureWage(s);refreshLifeArcs(s);return notes;
}
export function captureWage(s){const a=lifeArcs(s);if(a.wageTurn!==s.turn){a.wageAdjustment=0;a.wageTurn=s.turn;a.wageRate=monthlyReceipts(s);}else if(a.wageRate!==monthlyReceipts(s)){a.wageAdjustment+=Math.round((monthlyReceipts(s)-a.wageRate)*(s.survival?.days||0)/30);a.wageRate=monthlyReceipts(s);}}
export function noteLifeAction(s,action){
 if(action.type==='social'){
  const child=childhoodActivity(s,action.type);
  if(!child||child.family)remember(s,'N10',child?.text??'你把时间留给了一顿家常饭。',2);
 }
 if(action.type==='prison_letter')remember(s,'N10','你写信说了自己的近况。',2);
 if(action.type==='relationship'){
  const id=action.kind==='child'||action.kind==='succession'?'N09':'N02';
  remember(s,id,{partner:'你们决定一起生活。',child:'小满来到了家里。',repair:'你认真解释了过去的事，愿意重新相处。',succession:'你让小满自己选择往后的路。'}[action.kind]);
 }
 const introduction=s.age>=18?({job_accept:s.monthlyIncome>0?['N04','入职时，你认识了同事老周，互相留了联系方式。']:null,seek_job:s.monthlyIncome>0?['N04','入职时，你认识了同事老周，互相留了联系方式。']:null,work:['N07','一起收工时，你认识了社区店里的赵姨。'],gig:['N07','赵姨结清了今天的工钱，留下了联系方式。'],study:['N12','练习时遇到吴师傅，他帮你看了看做错的地方。']})[action.type]:null;
 if(introduction&&!hasMetPerson(s,introduction[0])){remember(s,...introduction);return introduction[1];}
 return '';
}
export function observeLife(before,s,title){captureWage(s);const a=lifeArcs(s),net=worth(s),prior=worth(before);a.audit.peak=Math.max(a.audit.peak,net);a.audit.trough=Math.min(a.audit.trough,net);a.audit.maxDrawdown=Math.max(a.audit.maxDrawdown,a.audit.peak-net);if(prior-net>a.audit.biggestDrop){a.audit.biggestDrop=prior-net;a.audit.dropTitle=title;}
 if(s.turn!==a.lastBusinessTurn){a.businessTurns=s.businesses.some(b=>b.monthlyProfit>0)?a.businessTurns+1:0;a.lastBusinessTurn=s.turn;}
 if((Math.abs(net-prior)>=Math.max(100000,Math.abs(prior)*.25)||before.legal?.prisonMonthsLeft!==s.legal?.prisonMonthsLeft)&&a.audit.decisions.length<80)a.audit.decisions.push({age:s.age,title,delta:net-prior});
 refreshLifeArcs(s);
}
export function noteStoryPeople(s,event,choice,outcome){meetStoryPeople(s,event,outcome?.text);for(const id of storyPeople(event,outcome?.text))if(PEOPLE[id])remember(s,id,`${event.title}：你选择了${choice.label}。`);}
export function validateLifeArcs(s){validateConsumption(s);const a=lifeArcs(s),bad=()=>{throw Error('存档中的人物与人生记录无效');},int=(x,min=0)=>Number.isSafeInteger(x)&&x>=min,arr=(x,max)=>Array.isArray(x)&&x.length<=max,txt=x=>typeof x==='string'&&x.length<=5000;
 if(!int(a.wageRate)||!int(a.wageTurn)||!int(a.wageAdjustment,-Number.MAX_SAFE_INTEGER))bad();
 if(a.version!==1||typeof a.legacy!=='boolean'||!int(a.seed)||!int(a.startedDay)||!Number.isFinite(a.startedAge)||a.startedAge<0||a.startedAge>s.age||![0,120000].includes(a.lifestyle)||!int(a.businessTurns)||!int(a.lastBusinessTurn)||typeof a.inheritance!=='boolean')bad();
 if(a.pending!==null&&!['comfort','pressure','request','promise_due','disclosure','response','consumption','family'].includes(a.pending))bad();
 if(!arr(a.seen,100)||new Set(a.seen).size!==a.seen.length||a.seen.some(x=>!txt(x))||!arr(a.history,240)||!arr(a.used,6)||new Set(a.used).size!==a.used.length||a.used.some(x=>!['shift','repair','referral','apprentice','reentry','preorder'].includes(x)))bad();
 if(!a.memories||Array.isArray(a.memories)||!a.visits||Array.isArray(a.visits))bad();
 for(const [id,records] of Object.entries(a.memories))if(!PEOPLE[id]||!arr(records,24)||records.some(r=>!int(r.day)||r.day>now(s)||!Number.isFinite(r.age)||r.age<0||r.age>s.age||!txt(r.text)))bad();
 for(const [id,day] of Object.entries(a.visits))if(!PEOPLE[id]||!int(day)||day>now(s))bad();
 for(const h of a.history)if(!txt(h.key)||!txt(h.title)||!txt(h.text)||!int(h.day)||!Number.isFinite(h.age)||h.age<0||h.age>s.age)bad();
 if(!arr(a.jobs,8)||!arr(a.promises,4)||new Set(a.jobs.map(j=>j.id)).size!==a.jobs.length)bad();for(const j of a.jobs)if(!['shift','repair','referral','apprentice','reentry','preorder','response'].includes(j.id)||!['work','reply'].includes(j.kind)||!int(j.due)||!int(j.pay)||j.pay>150000||!int(j.wage)||j.wage>360000)bad();for(const p of a.promises)if(!PEOPLE[p.id]||!int(p.day)||!['open','kept','broken'].includes(p.status))bad();
 if(!a.audit||!arr(a.audit.decisions,80)||!txt(a.audit.dropTitle))bad();for(const k of ['peak','trough','maxDrawdown','biggestDrop','interestPaid','repaid'])if(!int(a.audit[k],['peak','trough'].includes(k)?-Number.MAX_SAFE_INTEGER:0))bad();for(const d of a.audit.decisions)if(!txt(d.title)||!int(d.delta,-Number.MAX_SAFE_INTEGER)||!Number.isFinite(d.age)||d.age<0||d.age>s.age)bad();
}
export function lifeStatement(s){const a=lifeArcs(s);return {scope:a.legacy?`本版从 ${a.startedAge} 岁起记录；更早的关系、逐笔利息和盘中高低点未补算。`:'按每次结算记录，不含盘中瞬时价格。',...a.audit,people:Object.entries(a.memories).map(([id,list])=>({id,name:PEOPLE[id],trust:relation(s,id),last:list.at(-1)?.text})),chapters:a.history.slice(-12),completed:s.journey?.completed||[]};}
