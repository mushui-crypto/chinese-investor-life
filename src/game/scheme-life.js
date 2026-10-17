/** Project memories observe the existing cash ledger. They never pay money or draw RNG. */
import {gameDate} from './game-calendar.js';

const MAX=Number.MAX_SAFE_INTEGER;
const day=s=>s.debtClock?.day||0;
const age=s=>Math.round(((s.age??18)+(s.debtClock?.periodDays||0)/360)*100)/100;
const sum=xs=>xs.reduce((a,b)=>signed(a+b),0);
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const amount=n=>{if(!integer(n))throw Error('项目记忆金额无效');return n;};
const signed=n=>{if(!integer(n,-MAX))throw Error('项目记忆金额无效');return n;};
const add=(a,b)=>signed(a+b);
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
export const SCHEME_MEMORY_KEYS=['schemeExposed','firstScheme','firstSchemePayment','firstExitThought','firstSchemeWarning','falseRecoveryMemory','schemeQuit','schemeCollapsed','schemeRelapse','lastExitOpportunity','friendJoinedScheme','familyExposure','firstRecovery','screenshot'];
export const SCHEME_ACHIEVEMENTS=[['stable_income','稳定收益'],['principal_safe','本金安全'],['different_this_time','这次不一样'],['friend_certified','朋友认证'],['maintenance','系统维护'],['last_payment','最后一次到账'],['long_term','长期投资'],['screenshot','截图为证'],['where_teacher','老师去哪了']].map(([id,title])=>({id,title}));
export const SCHEME_ENDINGS=[
 ['never_joined','没听懂，也没损失','你没有把那笔钱交出去。','exit'],['meal_money','赚顿饭走人','第一笔到账以后，你连本金一起拿了回来。','exit'],['principal_first','本金先走','本金先回到了自己的账户，剩下的风险也有了边界。','exit'],['escaped','跑得快','后来有人说，你少赚了最后三个月。你看了看银行卡。','exit'],['second_time','第二次不赌','上一次恢复了，你还是决定走。','exit'],['successful_exit','成功退出','投入过的钱已经回来，后来的故事没有替你补扣一笔。','exit'],
 ['stable_income','稳定收益','它确实稳定了很久。直到不稳定的那一天。','failure'],['profits_not_cash','利润不是钱','数字一直都在。钱没有。','failure'],['whole_family','全家一起','账目之外，还有家里人等待你回答的问题。','failure'],['introduced_friend','朋友介绍的','“你不是说挺稳的吗？”那句话还留在聊天记录里。','failure'],['last_payment','最后一次到账','你其实已经准备走了。然后那笔钱到账了。','failure'],['graduated','资金盘毕业','损失留在账里，下一次邀请停在门外。','failure'],
].map(([id,title,text,kind])=>({id,title,text,kind}));
const memories=()=>Object.fromEntries(SCHEME_MEMORY_KEYS.map(k=>[k,null]));
export function newSchemeLife(){return {version:1,status:'UNEXPOSED',exposed:false,forbidRisk:false,trust:0,exposure:0,FOMO:0,analysis:0,refusals:0,relapseCount:0,peakBookBalance:0,currentProjectKey:null,interludes:0,lastEventDay:null,interludesAtLastEvent:0,cooldownUntil:0,eventCounts:{},eventLastDays:{},projects:{},memories:memories(),history:[],achievements:{}};}
export function schemeLifeState(s){return s.behavior?.cryptoLife?.schemeLife||newSchemeLife();}
const schemePosition=p=>p?.schemeLife===true||p?.cryptoLifeBranch==='scheme';
export const schemeProjectKey=p=>String(p?.cryptoScheme?.projectKey||p?.projectKey||p?.id||'');
const personalHeld=(s,key)=>(s.positions||[]).filter(p=>schemePosition(p)&&(!key||schemeProjectKey(p)===key));
const held=(s,key)=>[...personalHeld(s,key),...(s.trading?.schemeFamilyProjects||[]).filter(p=>(!key||schemeProjectKey(p)===key)&&(p.cryptoScheme?.familyPrincipal>0||p.cryptoScheme?.familyValue>0))];
function newProject(s,key,p={},info={},legacy=false){
 const q=p.cryptoScheme||{};
 return {key,name:String(info.projectName||info.name||q.name||p.name||'朋友的新项目'),source:String(info.introducer||q.introducer||p.introducer||'friend'),status:'EXPOSED',stage:'intro',exposed:false,legacyImported:legacy,observedDay:day(s),joinedDay:null,initialPrincipal:0,currentPrincipal:0,currentValue:0,bookBalance:0,peakBookBalance:0,invested:0,returned:0,paid:0,realizedProfit:0,paymentCount:0,observedPaymentCount:0,normalPaymentStreak:0,maxNormalPaymentStreak:0,additions:0,principalReturned:0,retainedProfit:0,warningCount:0,recoveryCount:0,maintenanceCount:0,trust:0,exposure:0,FOMO:0,analysis:0,friendJoined:false,familyJoined:false,familyExposure:0,familyInvested:0,familyReturned:0,familyPaid:0,familyRealizedProfit:0,familyCurrentPrincipal:0,familyCurrentValue:0,familyCollapsed:false,relationships:{friend:'unknown',family:'unknown',introducer:'unknown',admin:'unknown',host:'unknown'},exitIntent:false,preparedExitDay:null,paymentAfterExitThought:false,continuedAfterRecovery:false,quitDay:null,collapsedDay:null,unavailableSinceDay:null,lastPaymentDay:null,lastWarningDay:null,lastStageDay:null,lastRecoveryDay:null,exitAfterWarning:false,exitAfterRecovery:false,principalProtected:false,escapedFailure:false,lastPageBalance:0,refusals:0,memories:memories(),history:[],eventCounts:{},eventLastDays:{},achievements:{},receiptIds:[]};
}
function project(g,s,key,p={},info={},legacy=false){if(!key)throw Error('项目缺少独立编号');return g.projects[key]??=(newProject(s,key,p,info,legacy));}
function clock(s,info={}){const n=info.lifeDay??day(s);if(!integer(n)||n>day(s))throw Error('项目回执日期无效');return n;}
function snapshot(s,pr,info={},value=0){const n=clock(s,info);return {day:n,age:Math.round((age(s)-(day(s)-n)/360)*100)/100,amount:signed(value),projectKey:pr?.key||null,eventId:String(info.eventId||info.source||''),choice:String(info.choice||''),action:String(info.action||'')};}
function keep(rows,row){rows.push(row);if(rows.length>240)rows.splice(1,1);}
function record(g,pr,row){keep(g.history,row);if(pr)keep(pr.history,row);}
function remember(g,pr,key,s,info={},value=0){const m=snapshot(s,pr,info,value);if(!g.memories[key])g.memories[key]=m;if(pr&&!pr.memories[key])pr.memories[key]=m;return m;}
function unlock(g,pr,id,s){const m={day:day(s),age:age(s),projectKey:pr?.key||null};if(!g.achievements[id])g.achievements[id]=m;if(pr&&!pr.achievements[id])pr.achievements[id]=m;}
function adjust(g,pr,values={}){for(const [raw,value] of Object.entries(values)){const key={schemeTrust:'trust',schemeExposure:'exposure',fomo:'FOMO'}[raw]||raw;if(!['trust','exposure','FOMO','analysis'].includes(key)||!Number.isFinite(value))throw Error('项目倾向无效');g[key]=clamp(g[key]+value);if(pr)pr[key]=clamp(pr[key]+value);}}
function observe(s,pr){
 const ps=held(s,pr.key),own=personalHeld(s,pr.key);pr.currentPrincipal=sum(own.map(p=>p.cost||0));pr.currentValue=sum(own.map(p=>p.value||0));pr.familyCurrentPrincipal=sum(ps.map(p=>p.cryptoScheme?.familyPrincipal||0));pr.familyCurrentValue=sum(ps.map(p=>p.cryptoScheme?.familyValue||0));
 if(ps.length){pr.bookBalance=sum(ps.map(p=>p.bookBalance??p.cryptoScheme?.lastPageBalance??p.value??0));pr.peakBookBalance=Math.max(pr.peakBookBalance,pr.bookBalance);pr.retainedProfit=sum(ps.map(p=>p.cryptoScheme?.retainedProfit||0));pr.observedPaymentCount=Math.max(pr.observedPaymentCount,...ps.map(p=>p.cryptoScheme?.paymentCount||0));const q=ps[0].cryptoScheme||{};pr.stage=q.stage||({paying:'normal',mature:'normal',warning:'delay',frozen:'maintenance',failed:'failed'}[q.status])||pr.stage;pr.status='ACTIVE';
  const unavailable=ps.every(p=>p.frozen||p.failed||p.unsellable);if(unavailable)pr.unavailableSinceDay??=day(s);else pr.unavailableSinceDay=null;
 }else if(pr.status!=='COLLAPSED'&&(pr.invested||pr.legacyImported)){pr.status='QUIT_SCHEME';pr.currentValue=0;pr.currentPrincipal=0;}
 return ps;
}
export function ensureSchemeLife(s,options={}){
 const parent=s.behavior?.cryptoLife;if(!parent)throw Error('项目记忆需要先初始化Crypto状态');const g=parent.schemeLife??=(newSchemeLife());
 for(const p of held(s)){if(p.id===options.excludePositionId)continue;const key=schemeProjectKey(p);if(!g.projects[key]){const pr=project(g,s,key,p,{},true);pr.exposed=true;pr.status='ACTIVE';observe(s,pr);g.exposed=true;g.currentProjectKey??=key;}}
 return g;
}
function refreshStatus(s,g){g.peakBookBalance=Math.max(g.peakBookBalance,sum(personalHeld(s).map(p=>p.bookBalance??p.value??0)));if(g.forbidRisk)g.status='FORBID_RISK';else if(held(s).length)g.status='ACTIVE';else if(Object.values(g.projects).some(p=>p.status==='COLLAPSED'))g.status='COLLAPSED';else if(Object.values(g.projects).some(p=>p.status==='QUIT_SCHEME'))g.status='QUIT_SCHEME';else g.status=g.exposed?'EXPOSED':'UNEXPOSED';}
function milestones(s,g,pr){
 if(pr.peakBookBalance>=100000000&&pr.returned<10000000)unlock(g,pr,'principal_safe',s);
 if(pr.maintenanceCount>=3)unlock(g,pr,'maintenance',s);
 if(pr.unavailableSinceDay!==null&&day(s)-pr.unavailableSinceDay>=720&&held(s,pr.key).length)unlock(g,pr,'long_term',s);
 if(pr.status==='COLLAPSED'&&pr.maxNormalPaymentStreak>=12)unlock(g,pr,'stable_income',s);
 if(pr.status==='COLLAPSED'&&pr.memories.screenshot&&pr.lastPageBalance>0)unlock(g,pr,'screenshot',s);
 if(['introducer','admin','host'].every(k=>pr.relationships[k]==='missing'))unlock(g,pr,'where_teacher',s);
}
export function advanceSchemeLife(s){const g=ensureSchemeLife(s);for(const pr of Object.values(g.projects)){observe(s,pr);milestones(s,g,pr);}refreshStatus(s,g);return g;}
function stageReceipt(s,g,pr,p,info){
 const q=p.cryptoScheme||{},next=info.stage||info.warningStage||q.stage,now=clock(s,info),previous=pr.stage;
 if(next&&next!==previous){pr.stage=next;pr.lastStageDay=now;if(next!=='normal')pr.normalPaymentStreak=0;if(['delay','rumor','slow'].includes(next)){pr.warningCount++;pr.lastWarningDay=now;remember(g,pr,'firstSchemeWarning',s,info,pr.bookBalance);}if(next==='maintenance'){pr.maintenanceCount++;pr.unavailableSinceDay??=now;}}
 if(info.schemeWarning&&pr.warningCount===0){pr.warningCount=1;pr.lastWarningDay=now;remember(g,pr,'firstSchemeWarning',s,info,pr.bookBalance);}
 if(info.preparedExit||q.preparedExit){pr.exitIntent=true;pr.preparedExitDay??=now;remember(g,pr,'firstExitThought',s,info,pr.currentValue);}
 const balance=info.bookBalance??q.lastPageBalance??p.bookBalance;if(integer(balance)){pr.bookBalance=balance;pr.peakBookBalance=Math.max(pr.peakBookBalance,balance);pr.lastPageBalance=balance;}
 if(integer(info.principalReturned??q.principalReturned))pr.principalReturned=info.principalReturned??q.principalReturned;
 if(integer(info.retainedProfit??q.retainedProfit))pr.retainedProfit=info.retainedProfit??q.retainedProfit;
}
export function recordSchemeTrade(s,p,info={}){
 if(!schemePosition(p)&&!info.projectKey)return false;
 const action=String(info.action||''),buy=['buy','open','add','subscribe','invest','family_buy'].includes(action),flow=signed(info.cashFlow??0),pnl=info.pnl===undefined?null:signed(info.pnl),now=clock(s,info),g=ensureSchemeLife(s,buy?{excludePositionId:p.id}:{}),key=String(info.projectKey||schemeProjectKey(p)),existed=Boolean(g.projects[key]),pr=project(g,s,key,p,info,Boolean(p.cryptoScheme?.legacyFinance||p.cryptoScheme?.historyKnown===false));
 if(info.receiptId&&pr.receiptIds.includes(info.receiptId))return false;
 if(buy&&(flow>=0||g.forbidRisk))throw Error(g.forbidRisk?'已永久拒绝资金盘':'项目投入缺少真实现金支出');if(!buy&&flow<0)throw Error('项目回款不能为负');
 if(info.receiptId){pr.receiptIds.push(String(info.receiptId));if(pr.receiptIds.length>500)pr.receiptIds.shift();}
 const priorProfit=pr.realizedProfit;stageReceipt(s,g,pr,p,info);
 if(info.family||action.startsWith('family_')){
  if(action==='family_buy'){if(flow>=0||g.forbidRisk)throw Error('家庭项目投入缺少真实支出或已永久拒绝');pr.familyInvested=add(pr.familyInvested,-flow);pr.familyExposure=add(pr.familyExposure,-flow);pr.familyJoined=true;pr.relationships.family='joined';remember(g,pr,'familyExposure',s,info,-flow);}
  else {if(flow<0)throw Error('家庭项目回款不能为负');pr.familyReturned=add(pr.familyReturned,flow);if(action==='family_payment')pr.familyPaid=add(pr.familyPaid,flow);if(action==='family_failure'&&(pnl<0||pr.familyCurrentPrincipal>0))pr.familyCollapsed=true;}
  if(pnl!==null)pr.familyRealizedProfit=add(pr.familyRealizedProfit,pnl);
  record(g,pr,{...snapshot(s,pr,info,flow),kind:'receipt',family:true,cashFlow:flow,pnl:pnl??0,realizedProfit:pr.realizedProfit,familyRealizedProfit:pr.familyRealizedProfit});observe(s,pr);milestones(s,g,pr);refreshStatus(s,g);return pr;
 }
 if(buy){
  const relapse=!pr.joinedDay&&!pr.invested&&Object.values(g.projects).some(other=>other.key!==key&&other.collapsedDay!==null);
  if(!pr.invested&&!pr.legacyImported){pr.initialPrincipal=-flow;pr.joinedDay=now;remember(g,pr,'firstScheme',s,info,-flow);}else pr.additions++;
  if(relapse){g.relapseCount++;remember(g,pr,'schemeRelapse',s,info,-flow);unlock(g,pr,'different_this_time',s);}
  pr.invested=add(pr.invested,-flow);pr.status='ACTIVE';pr.quitDay=null;pr.exposed=true;g.exposed=true;g.currentProjectKey=key;adjust(g,pr,{exposure:action==='add'?12:5});
 }else if(['payment','scheme_payment','income'].includes(action)){
  if(flow>0){pr.returned=add(pr.returned,flow);pr.paid=add(pr.paid,flow);pr.paymentCount++;pr.lastPaymentDay=now;if((info.stage||p.cryptoScheme?.stage||pr.stage)==='normal'){pr.normalPaymentStreak++;pr.maxNormalPaymentStreak=Math.max(pr.maxNormalPaymentStreak,pr.normalPaymentStreak);}else pr.normalPaymentStreak=0;if(!pr.legacyImported||!existed)remember(g,pr,'firstSchemePayment',s,info,flow);else if(!pr.memories.firstSchemePayment&&!pr.observedPaymentCount)remember(g,pr,'firstSchemePayment',s,info,flow);adjust(g,pr,{trust:2});
   if(['recovered','last_payment'].includes(info.stage||p.cryptoScheme?.stage)){if(pr.lastRecoveryDay!==pr.lastStageDay){pr.recoveryCount++;pr.lastRecoveryDay=pr.lastStageDay;}remember(g,pr,'falseRecoveryMemory',s,info,flow);if(pr.exitIntent&&pr.preparedExitDay<=now)pr.paymentAfterExitThought=true;}
  }
 }else if(action==='accrual'){pr.normalPaymentStreak=0;}else if(action==='recovery'){
  if(flow<=0||pnl!==flow)throw Error('项目追偿缺少真实回执');pr.returned=add(pr.returned,flow);
 }else if(['sell','withdraw','principal','sell_principal','close'].includes(action)){
  pr.returned=add(pr.returned,flow);observe(s,pr);if(!personalHeld(s,key).length){pr.status='QUIT_SCHEME';pr.quitDay=now;g.cooldownUntil=Math.max(g.cooldownUntil,now+180);pr.exitAfterWarning=pr.warningCount>0;pr.exitAfterRecovery=pr.recoveryCount>0;remember(g,pr,'schemeQuit',s,info,flow);}if(pr.principalReturned>=pr.initialPrincipal&&pr.initialPrincipal>0)pr.principalProtected=true;
 }else if(info.schemeFailure||['scheme_failure','failure','collapse'].includes(action)){
  pr.status='COLLAPSED';pr.stage='failed';pr.collapsedDay??=now;pr.lastPageBalance=amount(info.lastPageBalance??p.cryptoScheme?.lastPageBalance??p.bookBalance??0);pr.peakBookBalance=Math.max(pr.peakBookBalance,pr.lastPageBalance);pr.currentValue=0;pr.currentPrincipal=0;remember(g,pr,'schemeCollapsed',s,info,pr.lastPageBalance);
 }else if(info.schemeFailureNews||action==='scheme_failure_news'){if(pr.quitDay!==null&&pr.exitAfterWarning)pr.escapedFailure=true;}
 if(pnl!==null){pr.realizedProfit=add(pr.realizedProfit,pnl);if(priorProfit<0&&pr.realizedProfit>=0)remember(g,pr,'firstRecovery',s,info,pr.realizedProfit);}
 record(g,pr,{...snapshot(s,pr,info,buy?-flow:flow),kind:['warning','status','accrual','scheme_failure_news'].includes(action)?'status':'receipt',cashFlow:flow,pnl:pnl??0,realizedProfit:pr.realizedProfit});
 observe(s,pr);milestones(s,g,pr);refreshStatus(s,g);return pr;
}
const CHOICE_TENDENCIES={curious:{analysis:2},analyze:{analysis:6},inspect:{analysis:6},trust:{trust:8},reassure:{trust:10},fomo:{FOMO:8},add:{exposure:8},refuse:{trust:-5},distrust:{analysis:5,trust:-5},friend_certified:{trust:8},family_join:{exposure:12},friend_join:{trust:4}};
export function recordSchemeEvent(s,info={}){
 const id=String(info.eventId||'');if(!id)throw Error('项目事件缺少编号');const g=ensureSchemeLife(s),key=String(info.projectKey||g.currentProjectKey||'unassigned'),pr=project(g,s,key,{},info),now=day(s),action=String(info.action||'');g.currentProjectKey=key;
 g.eventCounts[id]=(g.eventCounts[id]||0)+1;g.eventLastDays[id]=now;pr.eventCounts[id]=(pr.eventCounts[id]||0)+1;pr.eventLastDays[id]=now;g.lastEventDay=now;g.interludesAtLastEvent=g.interludes;
 const trigger=g.projects[info.triggerProjectKey];if(trigger&&trigger!==pr){trigger.eventCounts[id]=(trigger.eventCounts[id]||0)+1;trigger.eventLastDays[id]=now;}
 if(info.exposure||action==='expose'){g.exposed=true;pr.exposed=true;remember(g,pr,'schemeExposed',s,info);}
 if(info.source&&['friend','colleague','relative','crypto_group'].includes(info.source))pr.source=info.source;
 adjust(g,pr,CHOICE_TENDENCIES[action]);if(info.tendencies)adjust(g,pr,info.tendencies);
 if(info.refused||action==='refuse'){g.refusals++;pr.refusals++;g.cooldownUntil=Math.max(g.cooldownUntil,now+180);}
 if(info.permanentRefusal||action==='permanent_refuse'){g.forbidRisk=true;g.cooldownUntil=Math.max(g.cooldownUntil,now+180);}
 if(['prepare_exit','wait_payment','withdraw','principal'].includes(action)||info.preparedExit){pr.exitIntent=true;pr.preparedExitDay??=now;remember(g,pr,'firstExitThought',s,info,pr.currentValue);}
 if(info.exitOpportunity){const m=snapshot(s,pr,info,pr.currentValue);pr.memories.lastExitOpportunity=m;g.memories.lastExitOpportunity=m;}
 if(['continue','trust','reassure'].includes(action)&&pr.paymentAfterExitThought){pr.continuedAfterRecovery=true;pr.exitIntent=false;unlock(g,pr,'last_payment',s);}
 if(action==='friend_certified')unlock(g,pr,'friend_certified',s);
 if(info.friendJoined||action==='friend_join'){pr.friendJoined=true;pr.relationships.friend='joined';remember(g,pr,'friendJoinedScheme',s,info);}
 if(info.familyJoined||action==='family_join'||info.familyExposure){pr.familyJoined=true;pr.relationships.family='joined';if(info.familyExposure)pr.familyExposure=add(pr.familyExposure,amount(info.familyExposure));remember(g,pr,'familyExposure',s,info,pr.familyExposure);}
 if(action==='screenshot')remember(g,pr,'screenshot',s,info,pr.bookBalance||pr.lastPageBalance);
 const relation={friend_victim:'victim',friend_escaped:'escaped',friend_missing:'missing'}[info.variant];if(relation)pr.relationships.introducer=relation;
 for(const role of info.missingRoles||[])if(['friend','family','introducer','admin','host'].includes(role))pr.relationships[role]='missing';
 if(info.relationshipRole&&['friend','family'].includes(info.relationshipRole)&&['concerned','strained','repaired','victim'].includes(info.relationshipOutcome)){if(pr[info.relationshipRole==='friend'?'friendJoined':'familyJoined'])pr.relationships[info.relationshipRole]=info.relationshipOutcome;}
 record(g,pr,{...snapshot(s,pr,info,pr.realizedProfit),kind:'event',realizedProfit:pr.realizedProfit,exitOpportunity:Boolean(info.exitOpportunity)});advanceSchemeLife(s);return pr;
}
export const recordSchemeLifeEvent=recordSchemeEvent;
export function recordSchemeInterlude(s){const g=ensureSchemeLife(s);g.interludes=add(g.interludes,1);return g.interludes;}
function predicate(s,g,pr,key,metrics={}){
 if(key&&typeof key==='object'){const value=key.memory?pr?.memories[key.memory]?.amount:key.tendency?(pr?.[key.tendency]??g[key.tendency]):key.metric?metrics[key.metric]:pr?.[key.key]??g[key.key];return key.min!==undefined?Number(value)>=key.min:key.max!==undefined?Number(value)<=key.max:value===key.value;}
 const ps=pr?held(s,pr.key):[],stage=pr?.stage,payments=Math.max(pr?.paymentCount||0,pr?.observedPaymentCount||0),now=day(s);
 if(['exposed','schemeExposed'].includes(key))return pr?pr.exposed:g.exposed;
 if(['permanentlyRefused','forbidRisk'].includes(key))return g.forbidRisk;
 if(key==='neverJoined')return Boolean(pr&&!pr.invested&&!pr.legacyImported&&pr.joinedDay===null);
 if(['joined','firstScheme'].includes(key))return Boolean(pr&&(pr.invested||pr.legacyImported));
 if(['hasPosition','held'].includes(key))return ps.length>0;
 if(key==='paying')return ps.some(p=>['paying','mature'].includes(p.cryptoScheme?.status));
 if(['firstPaid','paidOnce'].includes(key))return payments>=1;
 if(key==='paidTwice')return payments>=2;
 if(key==='coveredInitial')return pr?.initialPrincipal>0&&pr.paid>=pr.initialPrincipal;
 if(key==='longPaying')return payments>=12;
 if(key==='largeExposure')return (pr?.currentPrincipal||0)>=Math.max(1000000,(s.monthlyIncome||0)*3);
 if(['delay','recovered','rumor','slow','last_payment','maintenance','silent','missing','balance'].includes(key))return stage===key;
 if(key==='warning')return ['delay','rumor','slow','last_payment','maintenance','silent','missing','balance'].includes(stage);
 if(key==='firstWarning')return pr?.warningCount===1;
 if(['collapsed','schemeCollapsed'].includes(key))return pr?.collapsedDay!==null&&pr?.collapsedDay!==undefined;
 if(key==='escapedFailure')return Boolean(pr?.escapedFailure);
 if(['quit','QUIT_SCHEME'].includes(key))return pr?.status==='QUIT_SCHEME';
 if(key==='yearsSinceCollapse')return Object.values(g.projects).some(p=>p.collapsedDay!==null&&now-p.collapsedDay>=720);
 if(key==='highTrust')return (pr?.trust??g.trust)>=30;
 if(key==='friendJoined')return Boolean(pr?.friendJoined);
 if(['familyJoined','familyExposed'].includes(key))return Boolean(pr?.familyJoined);
 if(key==='lifeBonus')return(s.employment?.history||[]).some(h=>h.kind==='bonus'&&h.amount>0&&now>=h.day&&now-h.day<=180);
 if(key==='lifeSalary'){const today=Date.parse(gameDate(s));return(s.payroll?.history||[]).some(h=>(key==='lifeBonus'?h.bonus>0:h.net>0)&&today>=Date.parse(h.payday)&&today-Date.parse(h.payday)<=30*86400000);}
 if(['lifePartner','lifeMarriage'].includes(key))return Boolean(s.household?.partner||s.flags?.partner||s.flags?.married);
 if(key==='lifeHome')return (s.positions||[]).some(p=>p.kind==='housing')||Boolean(s.flags?.housing_plan||s.flags?.house_purchase_plan);
 if(key==='lifeUnemployed')return s.age>=22&&s.monthlyIncome<=0&&(s.occupation==='离职待业'||(s.employment?.history||[]).some(h=>['layoff','discharge','resign'].includes(h.kind)&&now>=h.day&&now-h.day<=180));
 if(key==='parentsAvailable')return typeof s.household?.livingParent==='boolean'?s.household.livingParent:s.flags?.living_parent===true;
 if(key==='familySavings')return Number.isSafeInteger(s.familyReserve)&&s.familyReserve>0;
 if(key==='friendSource')return pr?.source==='friend';
 if(SCHEME_MEMORY_KEYS.includes(key))return Boolean(pr?.memories[key]);
 if(['trust','exposure','analysis','FOMO'].includes(key))return (pr?.[key]??g[key])>0;
 return Boolean(pr?.[key]??g[key]);
}
function projectMatches(s,g,p,meta,metrics){
 if(meta.stage&&!(meta.stage==='intro'&&meta.newProject)&&p&&p.stage!==meta.stage)return false;
 return(meta.requiredState||[]).every(k=>predicate(s,g,p,k,metrics))&&!(meta.blockedState||[]).some(k=>predicate(s,g,p,k,metrics));
}
export function schemeEventProject(s,event,metrics={}){
 const g=schemeLifeState(s),meta=event?.schemeLife||{};if(meta.projectKey)return g.projects[meta.projectKey]||null;
 const rows=Object.values(g.projects).sort((a,b)=>(b.key===g.currentProjectKey)-(a.key===g.currentProjectKey)||b.observedDay-a.observedDay);
 return rows.find(p=>projectMatches(s,g,p,meta,metrics))||null;
}
export function schemeEventAllowed(s,event,metrics={}){
 const meta=event?.schemeLife;if(!meta)return true;const g=schemeLifeState(s),now=day(s),range=meta.ageStage||[event.age_min??24,event.age_max??80];
 if(s.age<24||s.age<range[0]||s.age>range[1]||s.legal?.prisonMonthsLeft>0||s.survival?.failed)return false;
 if(g.forbidRisk&&!meta.memoryOnly)return false;if(now<g.cooldownUntil)return false;
 if(meta.newProject&&held(s).length)return false;
 if(g.lastEventDay!==null&&(now-g.lastEventDay<Math.max(90,meta.minDelay??90)||g.interludes-g.interludesAtLastEvent<Math.max(2,meta.minOrdinaryEvents??2)))return false;
 const pr=schemeEventProject(s,event,metrics);if(!pr&&(meta.projectKey||Object.keys(g.projects).length))return false;if(!projectMatches(s,g,pr,meta,metrics))return false;
 const last=pr?.eventLastDays[event.id]??(pr?undefined:g.eventLastDays[event.id]);if(last!==undefined&&(!(meta.repeatable??meta.repeat)||now-last<Math.max(180,meta.cooldown??180)))return false;return true;
}
export function schemeEventWeight(s,event,metrics={}){
 const base=typeof metrics==='number'?metrics:event?.schemeLife?.weight??event?.weight??10;if(typeof metrics==='number')metrics={};if(!schemeEventAllowed(s,event,metrics))return 0;const g=schemeLifeState(s),meta=event.schemeLife;if(!meta)return base;const p=schemeEventProject(s,event,metrics);let value=base;
 for(const key of meta.memoryTrigger||[])if(p?.memories[key])value*=1.35;
 const tendencies=Array.isArray(meta.tendency)?meta.tendency:meta.tendency?[meta.tendency]:['trust'];for(const raw of tendencies){const k={schemeTrust:'trust',schemeExposure:'exposure'}[raw]||raw;value*=1+(p?.[k]??g[k]??0)/80;}
 if(p?.status==='QUIT_SCHEME'&&!meta.memoryOnly)value*=.3;if(g.forbidRisk&&!meta.memoryOnly)return 0;value/=1+Math.min(p?.refusals??g.refusals,8)*.18;return Math.max(0,value);
}
function projectEnding(g,p){
 if(p.collapsedDay!==null){if(g.forbidRisk&&-p.realizedProfit>=Math.max(10000,p.invested*.25))return 'graduated';if(p.familyCollapsed)return 'whole_family';if(p.friendJoined)return 'introduced_friend';if(p.continuedAfterRecovery)return 'last_payment';if(p.peakBookBalance>=100000000&&p.returned<p.peakBookBalance*.1)return 'profits_not_cash';if(p.maxNormalPaymentStreak>=12&&p.additions>0)return 'stable_income';return null;}
 if(!p.invested&&!p.legacyImported&&p.refusals)return 'never_joined';
 if(p.quitDay!==null){if(p.escapedFailure&&p.exitAfterWarning)return 'escaped';if(p.exitAfterRecovery)return 'second_time';if(p.principalProtected&&p.paid>=p.initialPrincipal&&p.initialPrincipal>0)return 'principal_first';if(p.paymentCount===1&&!p.additions&&p.realizedProfit>0)return 'meal_money';if(p.invested>=1000000&&p.returned>=p.invested)return 'successful_exit';}
 if(p.principalProtected&&p.initialPrincipal>0&&p.paid>=p.initialPrincipal)return 'principal_first';return null;
}
export function schemeLifeSummary(s,metrics={}){
 const g=schemeLifeState(s),projects=Object.values(g.projects).map(p=>{const ps=personalHeld(s,p.key),family=held(s,p.key),id=projectEnding(g,p),ending=SCHEME_ENDINGS.find(e=>e.id===id)||null;return {...p,currentPrincipal:sum(ps.map(p=>p.cost||0)),currentValue:sum(ps.map(p=>p.value||0)),familyCurrentPrincipal:sum(family.map(p=>p.cryptoScheme?.familyPrincipal||0)),familyCurrentValue:sum(family.map(p=>p.cryptoScheme?.familyValue||0)),peakBalance:p.peakBookBalance,netLoss:Math.max(0,-p.realizedProfit),ending,achievements:SCHEME_ACHIEVEMENTS.filter(a=>p.achievements[a.id]).map(a=>({...a,...p.achievements[a.id]}))};});
 const totals=Object.fromEntries(['invested','returned','paid','realizedProfit','currentValue','currentPrincipal','familyInvested','familyReturned','familyPaid','familyRealizedProfit','familyCurrentPrincipal','familyCurrentValue'].map(k=>[k,sum(projects.map(p=>p[k]))]));totals.netLoss=Math.max(0,-totals.realizedProfit);totals.peakBookBalance=g.peakBookBalance;totals.currentCost=totals.currentPrincipal;totals.finalAssets=metrics.assets??(s.cash||0)+sum((s.positions||[]).map(p=>p.value||0))+sum((s.claims||[]).map(p=>p.value||0))+sum((s.businesses||[]).map(b=>b.value||0));totals.finalDebt=metrics.debt??sum((s.debts||[]).map(d=>(d.principal||0)+(d.interest||0)));
 const endings=projects.filter(p=>p.ending).map(p=>({...p.ending,projectKey:p.key,projectName:p.name}));const points=g.history.filter(h=>h.exitOpportunity||h.kind==='receipt'&&['buy','payment','withdraw','scheme_failure','recovery'].includes(h.action));
 return {status:g.status,exposed:g.exposed,forbidRisk:g.forbidRisk,permanentRefusal:g.forbidRisk,trust:g.trust,exposure:g.exposure,FOMO:g.FOMO,analysis:g.analysis,relapseCount:g.relapseCount,totals,projects,activeProjects:projects.filter(p=>held(s,p.key).length),memories:g.memories,points:points.length<=12?points:Array.from({length:12},(_,i)=>points[Math.floor(i*(points.length-1)/11)]),achievements:SCHEME_ACHIEVEMENTS.filter(a=>g.achievements[a.id]).map(a=>({...a,...g.achievements[a.id]})),ending:endings.at(-1)||null,endings,legacyImported:projects.some(p=>p.legacyImported)};
}
export function validateSchemeLife(s){
 const g=ensureSchemeLife(s),fail=()=>{throw Error('存档中的项目人生记忆无效');},num=(n,min=0,max=MAX)=>{if(!integer(n,min)||n>max)fail();},str=(v,max=400)=>{if(typeof v!=='string'||v.length>max)fail();},obj=o=>{if(!o||typeof o!=='object'||Array.isArray(o))fail();},bool=v=>{if(typeof v!=='boolean')fail();};
 obj(g);if(g.version!==1||!['UNEXPOSED','EXPOSED','ACTIVE','QUIT_SCHEME','COLLAPSED','FORBID_RISK'].includes(g.status))fail();bool(g.exposed);bool(g.forbidRisk);for(const k of ['trust','exposure','FOMO','analysis'])num(g[k],0,100);for(const k of ['refusals','relapseCount','peakBookBalance','interludes','interludesAtLastEvent','cooldownUntil'])num(g[k]);if(g.interludesAtLastEvent>g.interludes)fail();if(g.lastEventDay!==null)num(g.lastEventDay,0,day(s));obj(g.projects);if(Object.keys(g.projects).length>20000)fail();if(g.currentProjectKey!==null&&(!Object.hasOwn(g.projects,g.currentProjectKey)))fail();
 const point=p=>{obj(p);num(p.day,0,day(s));if(!Number.isFinite(p.age)||p.age<18||p.age>age(s)+.02)fail();num(p.amount,-MAX);str(p.eventId,200);str(p.choice);str(p.action,100);if(p.projectKey!==null&&!Object.hasOwn(g.projects,p.projectKey))fail();};
 const audit=o=>{obj(o.memories);for(const key of SCHEME_MEMORY_KEYS)if(o.memories[key]!==null)point(o.memories[key]);if(!Array.isArray(o.history)||o.history.length>240)fail();for(const h of o.history){point(h);if(!['event','receipt','status'].includes(h.kind))fail();if(h.cashFlow!==undefined)num(h.cashFlow,-MAX);if(h.pnl!==undefined)num(h.pnl,-MAX);num(h.realizedProfit,-MAX);}obj(o.eventCounts);obj(o.eventLastDays);for(const [id,n]of Object.entries(o.eventCounts)){str(id,100);num(n,1);num(o.eventLastDays[id],0,day(s));}for(const id of Object.keys(o.eventLastDays))if(!Object.hasOwn(o.eventCounts,id))fail();obj(o.achievements);for(const [id,a]of Object.entries(o.achievements)){if(!SCHEME_ACHIEVEMENTS.some(x=>x.id===id))fail();obj(a);num(a.day,0,day(s));if(!Number.isFinite(a.age)||a.age<18||a.age>age(s)+.02||a.projectKey!==null&&!Object.hasOwn(g.projects,a.projectKey))fail();}};
 audit(g);
 for(const [key,p]of Object.entries(g.projects)){obj(p);str(key,200);if(key!==p.key)fail();str(p.name,200);str(p.source,100);if(!['EXPOSED','ACTIVE','QUIT_SCHEME','COLLAPSED'].includes(p.status))fail();if(!['intro','normal','delay','recovered','rumor','slow','last_payment','maintenance','silent','missing','balance','failed'].includes(p.stage))fail();for(const k of ['exposed','legacyImported','friendJoined','familyJoined','familyCollapsed','exitIntent','paymentAfterExitThought','continuedAfterRecovery','exitAfterWarning','exitAfterRecovery','principalProtected','escapedFailure'])bool(p[k]);for(const k of ['observedDay','initialPrincipal','currentPrincipal','currentValue','bookBalance','peakBookBalance','invested','returned','paid','paymentCount','observedPaymentCount','normalPaymentStreak','maxNormalPaymentStreak','additions','principalReturned','retainedProfit','warningCount','recoveryCount','maintenanceCount','familyExposure','familyInvested','familyReturned','familyPaid','familyCurrentPrincipal','familyCurrentValue','lastPageBalance','refusals'])num(p[k]);if(p.normalPaymentStreak>p.maxNormalPaymentStreak||p.maxNormalPaymentStreak>p.paymentCount||p.observedDay>day(s)||p.peakBookBalance<p.bookBalance||p.paid>p.returned||p.familyPaid>p.familyReturned)fail();num(p.realizedProfit,-MAX);num(p.familyRealizedProfit,-MAX);for(const k of ['trust','exposure','FOMO','analysis'])num(p[k],0,100);for(const k of ['joinedDay','preparedExitDay','quitDay','collapsedDay','unavailableSinceDay','lastPaymentDay','lastWarningDay','lastStageDay','lastRecoveryDay'])if(p[k]!==null)num(p[k],0,day(s));obj(p.relationships);for(const role of ['friend','family','introducer','admin','host'])if(!['unknown','joined','victim','escaped','missing','concerned','strained','repaired'].includes(p.relationships[role]))fail();if(!Array.isArray(p.receiptIds)||p.receiptIds.length>500||new Set(p.receiptIds).size!==p.receiptIds.length)fail();p.receiptIds.forEach(x=>str(x,200));audit(p);for(const m of [...p.history,...Object.values(p.memories).filter(Boolean)])if(m.projectKey!==key)fail();}
 return g;
}
