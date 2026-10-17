/** Independent fictional projects, settled entirely through the existing cash/asset ledger. */
import {ensureSchemeLife,schemeLifeState,recordSchemeTrade} from './scheme-life.js';
import {recordCryptoLifeTrade,advanceCryptoLife,ensureCryptoLife} from './crypto-life.js';

export const SCHEME_PROJECTS=Object.freeze([
 {id:'lantern',name:'长灯计划',packaging:'闲置仓储协作',introducer:'friend',relationship:'朋友'},
 {id:'qinghe',name:'晴禾协作',packaging:'室内种植设备计划',introducer:'colleague',relationship:'同事'},
 {id:'boyun',name:'泊云工坊',packaging:'数字设备共享计划',introducer:'relative',relationship:'亲戚'},
]);
const day=s=>s.debtClock?.day||0;
const int=n=>Number.isSafeInteger(n)&&n>=0;
const check=n=>{if(!int(n))throw Error('资金盘金额超出范围');return n;};
const sum=xs=>xs.reduce((a,b)=>check(a+b),0);
const fmt=n=>`¥${(n/100).toLocaleString('zh-CN',{maximumFractionDigits:2})}`;
const all=s=>[...(s.positions||[]).filter(p=>p.cryptoLifeBranch==='scheme'),...(s.trading?.schemeFamilyProjects||[])];
const select=(s,e={})=>all(s).filter(p=>!(e.positionId||e.id||e.projectKey)||p.id===(e.positionId||e.id)||e.projectKey!==undefined&&e.projectKey===(p.cryptoScheme?.projectKey||p.projectKey||p.id));
const available=p=>!p.frozen&&!p.failed&&p.cryptoScheme?.status!=='frozen';
const stages=['normal','delay','recovered','rumor','slow','last_payment','maintenance','silent','missing','balance'];
const riskActions=['scheme_join','scheme_add'];
const exitActions=['scheme_withdraw','scheme_partial','scheme_principal','sell','sell_principal','exit_all','liquidate'];
const aliases={scheme_take_principal:'scheme_principal',scheme_keep_profit:'scheme_retain',scheme_prepare:'scheme_prepare_exit'};
const normalize=e=>({...e,action:aliases[e.action]||e.action});
const amount=(s,e)=>e.amount??(e.amount_yuan===undefined?e.fraction===undefined?10000:Math.floor(s.cash*e.fraction):Math.round(e.amount_yuan*100));
const ordinary=s=>schemeLifeState(s).interludes;
export function isIndependentSchemeEffect(s,e={}){const schemeAction=(e.action||'').startsWith('scheme_');return e.schemeLife===true&&schemeAction||select(s,e).some(p=>p.schemeLife)&&(schemeAction||(e.positionId||e.id||e.projectKey||e.branch==='scheme')&&['sell','sell_principal','exit_all','liquidate'].includes(e.action));}
export function nextSchemeProject(s){
 const g=schemeLifeState(s),projects=Object.values(g.projects),current=g.projects[g.currentProjectKey];
 if(current&&!current.invested&&!current.legacyImported&&current.collapsedDay===null){const catalog=SCHEME_PROJECTS.find(p=>current.key.startsWith(p.id+':'));if(catalog)return {...catalog,introducer:['friend','colleague','relative','crypto_group'].includes(current.source)?current.source:catalog.introducer,projectKey:current.key};}
 const count=projects.filter(p=>p.invested||p.legacyImported||p.joinedDay!==null).length;
 const catalog=SCHEME_PROJECTS[count%SCHEME_PROJECTS.length];
 return {...catalog,projectKey:`${catalog.id}:${count+1}`};
}
function metadata(p,info={}){const q=p.cryptoScheme;return {projectKey:p.projectKey||q?.projectKey,stage:q?.stage,bookBalance:p.bookBalance??p.value??0,retainedProfit:q?.retainedProfit||0,principalReturned:q?.principalReturned||0,preparedExit:Boolean(q?.preparedExit),...info};}
function receipt(s,p,info,api){
 const detail=metadata(p,{...p.cryptoLifeOrigin,...info});
 if((['buy','add','withdraw','payment','scheme_failure','recovery'].includes(info.action)||info.schemeWarning||info.schemeFailureNews)&&!(p.schemeFamilyOnly&&info.action==='scheme_failure'))recordCryptoLifeTrade(s,p,detail,api.metrics?.(s)||{});
 recordSchemeTrade(s,p,detail);
}
/** Adoption adds bookkeeping to an existing asset; it never recreates money or invents a past trade. */
export function adoptSchemePosition(s,p){
 if(p.schemeLife){p.cryptoScheme.stageEnteredDay??=p.cryptoScheme.lastTransitionDay;return p;}
 const q=p.cryptoScheme||{},status=q.status||'mature';
 const stage=status==='frozen'?'maintenance':status==='warning'?'delay':'normal';
 Object.assign(q,{projectKey:q.projectKey||p.projectKey||p.id,stage,stageEnteredDay:q.lastTransitionDay,legacyFinance:true,historyKnown:false,
  invested:q.invested??p.cost,returned:q.returned??q.paid??0,paid:q.paid??0,principalReturned:q.principalReturned??0,
  retainedProfit:q.retainedProfit??Math.max(0,(p.bookBalance??p.value)-p.cost),highestBalance:q.highestBalance??p.bookBalance??p.value,
  periodCount:q.periodCount??q.paymentCount??0,normalMonths:q.normalMonths??Math.max(12,(q.paymentCount||0)+12),
  payoutMode:q.payoutMode||'cash',seenStages:q.seenStages||{},preparedExit:Boolean(q.preparedExit),warningCount:q.warningCount??(q.warningDay===null||q.warningDay===undefined?0:1),
  transitionCount:q.transitionCount||0,maintenanceCount:q.maintenanceCount??(status==='frozen'?1:0),introducer:q.introducer||'friend',packaging:q.packaging||'此前参与的虚构项目'});
 if(q.warningSeen)q.seenStages.delay=true;if(q.maintenanceSeen)q.seenStages.maintenance=true;
 p.schemeLife=true;p.projectKey=q.projectKey;p.cryptoScheme=q;
 return p;
}
function terms(p,e){
 const q=p.cryptoScheme,principal=['scheme_principal','sell_principal'].includes(e.action),partial=['scheme_partial','liquidate'].includes(e.action)||e.action==='scheme_withdraw'&&e.fraction!==undefined;
 const fraction=e.fraction??.25;
 let value=principal?Math.min(p.value,p.cost):partial?Math.floor(p.value*fraction):p.value;
 if(e.amount!==undefined&&!principal&&e.action!=='liquidate')value=Math.min(value,e.amount);
 const cost=principal?value:value===p.value?p.cost:Math.min(p.cost,Math.floor(p.cost*value/Math.max(1,p.value)));
 const proceeds=e.action==='liquidate'?Math.round(value*(1-(e.haircut_bps||0)/10000)):value;
 return {value,cost,proceeds,fee:value-proceeds,remainingPrincipal:p.cost-cost,remainingBookBalance:Math.max(0,(p.bookBalance??p.value)-value),remainingProfit:Math.max(0,(q?.retainedProfit??p.value-p.cost)-(value-cost))};
}
export function schemeLifeActionReason(s,raw={}){
 const e=normalize(raw),held=select(s,e),g=schemeLifeState(s);
 if([...riskActions,'scheme_family_join'].includes(e.action)){
  if(g?.forbidRisk)return '你已经永久拒绝资金盘，仍可处理旧项目';
  if(s.age<24)return '这一类项目在 24 岁后才可能接触';
  if(s.legal?.prisonMonthsLeft>0)return '服刑期间暂停外部交易';
  if(s.flags?.voluntary_exit||s.flags?.exit_intent)return '已经决定封盘，仍可退出旧项目';
  const n=amount(s,e);if(!int(n)||n<100)return '投入金额至少为 ¥1，且必须是有效整分';
  if(n>(e.action==='scheme_family_join'?s.familyReserve:s.cash))return e.action==='scheme_family_join'?'真实家庭储备不足，不能挪用玩家现金或虚构家人的钱':'实际现金不足，账面收益不能当作现金追加';
  if(e.action==='scheme_join'&&all(s).length)return '已有项目尚未处理，请先处理现有项目';
  if(['scheme_add','scheme_family_join'].includes(e.action)&&(!held.length||held.some(p=>!available(p)||!['normal','recovered','last_payment',undefined].includes(p.cryptoScheme?.stage))))return '当前项目处于异常阶段，不能追加';
  if(e.action==='scheme_add'&&held.every(p=>!(s.positions||[]).includes(p)))return '你的本金已经全部退出，不能把家庭份额当成自己的持仓追加';
 }
 if(exitActions.includes(e.action)){
  if(!held.length)return '当前没有项目持仓，不能重复提现';
  if(!held.some(p=>available(p)&&p.value>0))return held.some(p=>p.cryptoScheme?.familyPrincipal>0)?'你的个人份额已退出，家庭份额需要选择“退出家庭份额”处理':'这笔资产已经冻结，页面余额不是现金，当前可提现为 ¥0';
  if(e.fraction!==undefined&&(!Number.isFinite(e.fraction)||e.fraction<=0||e.fraction>1))return '提现比例必须大于 0 且不超过 100%';
  if(e.amount!==undefined&&(!int(e.amount)||!e.amount))return '提现金额必须是有效正整分';
  if(e.action==='liquidate'&&(!Number.isFinite(e.haircut_bps)||e.haircut_bps<0||e.haircut_bps>10000))return '资产折价比例无效';
  if(['scheme_principal','sell_principal'].includes(e.action)&&!held.some(p=>p.cost>0))return '现金本金已经全部取回，项目里只剩未提现利润';
 }
 if(['scheme_retain','scheme_cash_payout','scheme_prepare_exit'].includes(e.action)){
  if(!held.length)return '当前没有可处理的项目';
  if(!held.some(available))return '项目已冻结，不能把页面余额变成现金';
  if(e.action!=='scheme_prepare_exit'&&!held.some(p=>p.value>0))return '你的个人份额已经退出，不能改变家庭份额的收益处理方式';
 }
 if(e.action==='scheme_ack'&&e.stage!==undefined&&!stages.includes(e.stage))return '项目阶段无效';
 if(e.action==='scheme_family_withdraw'&&(!held.some(p=>p.cryptoScheme?.familyValue>0)||!held.some(available)))return '当前没有可兑现的家庭项目份额';
 return '';
}
export function schemeLifeActionPreview(s,raw={}){
 const e=normalize(raw),reason=schemeLifeActionReason(s,e),held=select(s,e).filter(available),p=held[0],next=p?{name:p.name,projectKey:p.projectKey||p.cryptoScheme?.projectKey||p.id}:nextSchemeProject(s);
 const sells=exitActions.includes(e.action),quotes=sells?held.map(p=>terms(p,e)):[],risk=riskActions.includes(e.action);
 return {ok:!reason,reason,amount:risk||e.action==='scheme_family_join'?amount(s,e):sum(quotes.map(q=>q.value)),cashCost:risk?amount(s,e):0,fee:sum(quotes.map(q=>q.fee)),proceeds:sum(quotes.map(q=>q.proceeds)),nonCashCredit:0,
  remainingPrincipal:sells?sum(quotes.map(q=>q.remainingPrincipal)):sum(held.map(p=>p.cost)),remainingBookBalance:sells?sum(quotes.map(q=>q.remainingBookBalance)):sum(held.map(p=>p.bookBalance??p.value)),
  projectName:next.name,projectKey:next.projectKey,familyCashCost:e.action==='scheme_family_join'?amount(s,e):0,familyProceeds:e.action==='scheme_family_withdraw'?sum(held.map(p=>p.cryptoScheme?.familyValue||0)):0,payoutMode:e.action==='scheme_retain'?'retain':e.action==='scheme_cash_payout'?'cash':p?.cryptoScheme?.payoutMode||'cash',
  note:e.action==='scheme_retain'?'今后收益仅记在项目余额，现金不会增加；成功提现后才算到账。':e.action==='scheme_cash_payout'?'今后结算的收益转入真实现金；已有账面利润不会自动提现。':e.action==='scheme_prepare_exit'?'仅记录退出打算，今天没有转账，也没有减少风险本金。':''};
}
function notice(s,p,stage,api,info={}){
 const q=p.cryptoScheme;q.stage=stage;q.stageEnteredDay=day(s);q.lastTransitionDay=day(s);q.transitionCount++;q.seenStages[stage]=false;
 if(['delay','rumor','slow'].includes(stage)){q.status='warning';q.warningSeen=false;q.warningDay??=day(s);q.warningCount++;receipt(s,p,{...info,action:'warning',cashFlow:0,pnl:0,schemeWarning:true,warningStage:stage},api);}
 else receipt(s,p,{...info,action:'status',cashFlow:0,pnl:0},api);
}
function adjustContributions(p,oldCost){const q=p.cryptoScheme;let prefix=0,allocated=0;q.contributions=(q.contributions||[{amount:oldCost,day:q.joinedDay}]).map(c=>{prefix+=c.amount;const next=oldCost?Number(BigInt(prefix)*BigInt(p.cost)/BigInt(oldCost)):0,amount=next-allocated;allocated=next;return {...c,amount};}).filter(c=>c.amount>0);}
function rememberExit(s,p,api,info){
 const q=p.cryptoScheme;
 if(q.warningDay===null||q.familyPrincipal>0)return;
 receipt(s,p,{...info,action:'warning',cashFlow:0,pnl:0,schemeWarning:true},api);
 s.trading.schemeLifeFollowups??=[];
 if(!s.trading.schemeLifeFollowups.some(x=>x.projectKey===p.projectKey))s.trading.schemeLifeFollowups.push({projectKey:p.projectKey,positionId:p.id,name:p.name,leftDay:day(s),lastCheckedDay:day(s),ordinaryAtExit:ordinary(s),status:'waiting',checks:0,bookBalance:q.lastPageBalance});
}
function withdraw(s,p,e,api,info){
 adoptSchemePosition(s,p);advanceCryptoLife(s,api.metrics?.(s)||{});
 const t=terms(p,e),q=p.cryptoScheme,priorCost=p.cost;
 if(!t.value)throw Error('当前没有可提现金额');
 p.value-=t.value;p.cost-=t.cost;p.bookBalance=t.remainingBookBalance;q.lastPageBalance=p.bookBalance;q.retainedProfit=t.remainingProfit;
 q.returned=check(q.returned+t.proceeds);q.principalReturned=check(q.principalReturned+Math.min(t.cost,t.proceeds));adjustContributions(p,priorCost);
  if(!p.value){rememberExit(s,p,api,info);s.positions=s.positions.filter(x=>x.id!==p.id);if(q.familyPrincipal>0){p.schemeFamilyOnly=true;s.trading.schemeFamilyProjects??=[];if(!s.trading.schemeFamilyProjects.some(x=>x.id===p.id))s.trading.schemeFamilyProjects.push(p);}}
 api.cashChange(s,t.proceeds,`${p.name}实际提现`,{positionId:p.id});api.record(s,'position',-t.value,`${p.name}减少项目余额`,{positionId:p.id});api.noteRealizedProfit?.(s,t.proceeds-t.cost);
 receipt(s,p,{...info,action:'withdraw',cashFlow:t.proceeds,pnl:t.proceeds-t.cost,costBasis:t.cost,principalReturned:q.principalReturned,fullExit:!p.value,principalOnly:['scheme_principal','sell_principal'].includes(e.action)},api);
 return t.proceeds;
}
export function executeSchemeLifeEffect(s,raw,api,context={}){
 const e=normalize(raw),reason=schemeLifeActionReason(s,e);if(reason)throw Error(reason);
 ensureCryptoLife(s);ensureSchemeLife(s);const info={eventId:context.eventId||'',choice:context.choiceId||'',...e.receipt};
 if(e.action==='scheme_join'){
  const project=nextSchemeProject(s),n=amount(s,e),p=api.invest(s,{product:'ponzi',amount:n,underlying:project.id.toUpperCase()});
  Object.assign(p,{schemeLife:true,projectKey:project.projectKey,instrument:project.id.toUpperCase(),name:project.name,cryptoLifeBranch:'scheme',cryptoLifeOrigin:info,managed:true});
  p.cryptoScheme={status:'paying',stage:'normal',projectKey:p.projectKey,packaging:project.packaging,introducer:project.introducer,historyKnown:true,joinedDay:day(s),lastPaidDay:day(s),lastTransitionDay:day(s),stageEnteredDay:day(s),paymentCount:0,periodCount:0,paid:0,invested:n,returned:0,principalReturned:0,retainedProfit:0,highestBalance:n,lastPageBalance:n,warningDay:null,warningSeen:false,maintenanceSeen:false,warningCount:0,transitionCount:0,maintenanceCount:0,normalMonths:12+Math.floor(api.draw(s)*49),payoutMode:'cash',preparedExit:false,seenStages:{},contributions:[{amount:n,day:day(s)}]};
  receipt(s,p,{...info,action:'buy',cashFlow:-n,pnl:0},api);return `${p.name}收到 ${fmt(n)}，这笔钱已从现金转入真实项目持仓。首笔收益尚未到账。`;
 }
 const held=select(s,e);for(const p of held)adoptSchemePosition(s,p);
 if(e.action==='scheme_family_join'){
  const p=held[0],q=p.cryptoScheme,n=amount(s,e);s.familyReserve=check(s.familyReserve-n);q.familyPrincipal=check((q.familyPrincipal||0)+n);q.familyValue=check((q.familyValue||0)+n);q.familyInvested=check((q.familyInvested||0)+n);q.familyReturned??=0;q.familyPaid??=0;q.familyLastPaidDay??=day(s);q.familyContributions??=[];q.familyContributions.push({amount:n,day:day(s)});
  recordSchemeTrade(s,p,metadata(p,{...info,action:'family_buy',family:true,cashFlow:-n,pnl:0}));return `家人明确投入 ${fmt(n)}，从家庭储备转入家庭项目份额；你的现金和个人净值没有变化。`;
 }
 if(e.action==='scheme_family_withdraw'){
  let returned=0;for(const p of held.filter(available)){const q=p.cryptoScheme,n=q.familyValue||0;if(!n)continue;s.familyReserve=check(s.familyReserve+n);q.familyReturned=check((q.familyReturned||0)+n);const principal=q.familyPrincipal;q.familyPrincipal=0;q.familyValue=0;q.familyContributions=[];recordSchemeTrade(s,p,metadata(p,{...info,action:'family_withdraw',family:true,cashFlow:n,pnl:n-principal,costBasis:principal}));returned=check(returned+n);if(!p.value){rememberExit(s,p,api,info);s.trading.schemeFamilyProjects=(s.trading.schemeFamilyProjects||[]).filter(x=>x.id!==p.id);}}
  return `家庭项目份额实际退出 ${fmt(returned)}，已经回到家庭储备；你的现金没有变化。`;
 }
 if(e.action==='scheme_add'){
  const p=held[0],q=p.cryptoScheme,n=amount(s,e);api.cashChange(s,-n,`${p.name}追加本金`,{positionId:p.id});p.cost=check(p.cost+n);p.value=check(p.value+n);p.bookBalance=check(p.bookBalance+n);q.invested=check(q.invested+n);q.lastPageBalance=p.bookBalance;q.highestBalance=Math.max(q.highestBalance,p.bookBalance);q.contributions??=[{amount:p.cost-n,day:q.joinedDay}];q.contributions.push({amount:n,day:day(s)});api.record(s,'position',n,`${p.name}追加本金估值`,{positionId:p.id});receipt(s,p,{...info,action:'add',cashFlow:-n,pnl:0},api);return `追加 ${fmt(n)}，现金减少同等金额；新本金从今天起参与结算。`;
 }
 if(exitActions.includes(e.action)){let returned=0;for(const p of held.filter(available))returned=check(returned+withdraw(s,p,e,api,info));return `实际提现 ${fmt(returned)}，剩余本金与未提现利润已同步；到账的钱属于你。`;}
 if(e.action==='scheme_retain'||e.action==='scheme_cash_payout'){
  for(const p of held){p.cryptoScheme.payoutMode=e.action==='scheme_retain'?'retain':'cash';receipt(s,p,{...info,action:'status',cashFlow:0,pnl:0},api);}return schemeLifeActionPreview(s,e).note;
 }
 if(e.action==='scheme_prepare_exit'){for(const p of held){p.cryptoScheme.preparedExit=true;receipt(s,p,{...info,action:'status',cashFlow:0,pnl:0,preparedExit:true},api);}return '你记下了准备退出的念头。今天没有转账，本金仍在项目里。';}
 if(e.action==='scheme_ack'){
  for(const p of held){const q=p.cryptoScheme;if(e.stage&&e.stage!==q.stage)continue;if(!q.seenStages[q.stage]){q.seenStages[q.stage]=true;q.lastTransitionDay=day(s);}if(['delay','rumor','slow'].includes(q.stage))q.warningSeen=true;if(q.status==='frozen')q.maintenanceSeen=true;receipt(s,p,{...info,action:'status',cashFlow:0,pnl:0,stageAcknowledged:q.stage},api);}
  return '你已经看过这一次项目消息。资金没有因此转入或转出。';
 }
 return '';
}
function pay(s,p,at,api,notes,{forceCash=false}={}){
 const q=p.cryptoScheme,contributions=q.contributions||[{amount:p.cost,day:q.joinedDay}];
 const n=sum(contributions.map(c=>api.mul(c.amount,.025*Math.min(30,Math.max(0,at-c.day))/30)))+api.mul(q.retainedProfit,.025);
 q.lastPaidDay=at;q.periodCount++;
 const familyAmount=sum((q.familyContributions||[]).map(c=>api.mul(c.amount,.025*Math.min(30,Math.max(0,at-c.day))/30)));
 if(familyAmount){s.familyReserve=check(s.familyReserve+familyAmount);q.familyPaid=check((q.familyPaid||0)+familyAmount);q.familyReturned=check((q.familyReturned||0)+familyAmount);q.familyLastPaidDay=at;recordSchemeTrade(s,p,metadata(p,{action:'family_payment',family:true,cashFlow:familyAmount,pnl:familyAmount,lifeDay:at}));notes.push(`${p.name}的家庭份额到账 ${fmt(familyAmount)}，进入家庭储备。`);}
 if(!n)return;
 if(q.payoutMode==='retain'&&!forceCash){p.value=check(p.value+n);p.bookBalance=check(p.bookBalance+n);q.retainedProfit=check(q.retainedProfit+n);q.lastPageBalance=p.bookBalance;q.highestBalance=Math.max(q.highestBalance,p.bookBalance);api.record(s,'position',n,`${p.name}收益留在项目，未到账`,{positionId:p.id});receipt(s,p,{action:'accrual',cashFlow:0,pnl:0,nonCashCredit:n,lifeDay:at},api);notes.push(`${p.name}页面增加 ${fmt(n)}，按你的选择留在项目，现金没有增加。`);}
 else {q.paymentCount++;q.paid=check(q.paid+n);q.returned=check(q.returned+n);p.withdrawals=check((p.withdrawals||0)+n);api.cashChange(s,n,`${p.name}实际收益到账`,{positionId:p.id});api.noteRealizedProfit?.(s,n);receipt(s,p,{action:'payment',cashFlow:n,pnl:n,costBasis:0,lifeDay:at},api);notes.push(`${p.name}实际到账 ${fmt(n)}，本金仍在项目中。`);}
}
function freeze(s,p,api,notes){const q=p.cryptoScheme,prior=p.value;p.frozen=true;p.value=0;q.familyValue=0;q.status='frozen';q.maintenanceSeen=false;q.maintenanceCount=(q.maintenanceCount||0)+1;q.lastPageBalance=p.bookBalance;if(prior)api.record(s,'position',-prior,`${p.name}暂停提现，当前估值归零`,{positionId:p.id});notice(s,p,'maintenance',api);notes.push(`${p.name}进入系统维护，页面余额 ${fmt(p.bookBalance)} 当前无法提现。`);}
function fail(s,p,api,notes){
 const q=p.cryptoScheme;
 if(p.cost>0){const c=api.freezePosition(s,p,`${p.name}停付后的本金追偿`);if(c.value)api.record(s,'claim',-c.value,`${p.name}追偿尚无可兑现价值`,{claimId:c.id});Object.assign(c,{value:0,cryptoLifeBranch:'scheme',schemeLife:true,projectKey:p.projectKey,sourcePositionId:p.id});}
 else {s.positions=s.positions.filter(x=>x.id!==p.id);if(p.value)api.record(s,'position',-p.value,`${p.name}未提现收益消失`,{positionId:p.id});}
 if(q.familyPrincipal>0)recordSchemeTrade(s,p,metadata(p,{action:'family_failure',family:true,cashFlow:0,pnl:-q.familyPrincipal,costBasis:q.familyPrincipal}));
 s.trading.schemeFamilyProjects=(s.trading.schemeFamilyProjects||[]).filter(x=>x.id!==p.id);
 q.status='failed';receipt(s,p,{action:'scheme_failure',cashFlow:0,pnl:-p.cost,costBasis:p.cost,schemeFailure:true,lastPageBalance:q.lastPageBalance},api);notes.push(`${p.name}消失了。累计投入 ${fmt(q.invested)}，累计真实到账 ${fmt(q.returned)}，最后页面余额 ${fmt(q.lastPageBalance)}，当前可提现 ¥0。`);
}
/** Each warning stage needs a separate seen marker and a later date; one long step cannot consume the whole sequence. */
export function settleSchemeLifeProjects(s,days,api,notes=[]){
 const now=day(s);if(!int(days))throw Error('资金盘结算天数无效');
 for(const p of [...all(s)].filter(p=>p.schemeLife)){
  const q=p.cryptoScheme,startStage=q.stage;
  if(startStage==='normal'){
   while(now-q.lastPaidDay>=30&&q.stage==='normal'){pay(s,p,q.lastPaidDay+30,api,notes);q.status=q.periodCount>=6?'mature':'paying';if(q.periodCount>=q.normalMonths){notice(s,p,'delay',api);notes.push(`${p.name}第一笔延迟出现，页面显示“处理中”；现在仍有真实退出窗口。`);}}
   continue;
  }
  if(['recovered','last_payment'].includes(startStage))while(now-q.lastPaidDay>=30&&q.lastPaidDay-(q.stageEnteredDay??q.lastTransitionDay)<60)pay(s,p,q.lastPaidDay+30,api,notes);
  if(!q.seenStages[startStage]||now-q.lastTransitionDay<(['maintenance','recovered'].includes(startStage)?90:60))continue;
  if(startStage==='delay'){
   if(api.draw(s)<.6){q.status='mature';notice(s,p,'recovered',api);pay(s,p,now,api,notes,{forceCash:true});}
   else notice(s,p,'rumor',api);
  }else if(startStage==='recovered')notice(s,p,'rumor',api);
  else if(startStage==='rumor')notice(s,p,'slow',api);
  else if(startStage==='slow'){
   if(api.draw(s)<.4){q.status='mature';notice(s,p,'last_payment',api);pay(s,p,now,api,notes,{forceCash:true});}
   else freeze(s,p,api,notes);
  }else if(startStage==='last_payment')freeze(s,p,api,notes);
  else if(startStage==='maintenance')notice(s,p,'silent',api);
  else if(startStage==='silent'){if(q.maintenanceCount<3&&api.draw(s)<.3)freeze(s,p,api,notes);else notice(s,p,q.introducer==='friend'?'missing':'balance',api);}
  else if(startStage==='missing')notice(s,p,'balance',api);
  else if(startStage==='balance')fail(s,p,api,notes);
 }
 for(const q of s.trading?.schemeLifeFollowups||[]){
  if(q.status!=='waiting'||now-q.leftDay<180||now-q.lastCheckedDay<90||ordinary(s)-q.ordinaryAtExit<2)continue;
  q.lastCheckedDay=now;q.checks++;if(api.draw(s)<.3||q.checks>=12){q.status='failed';const p={id:q.positionId,name:q.name,kind:'ponzi',cryptoLifeBranch:'scheme',schemeLife:true,projectKey:q.projectKey,cost:0,value:0,bookBalance:q.bookBalance};receipt(s,p,{action:'scheme_failure_news',cashFlow:0,pnl:0,schemeFailureNews:true,projectKey:q.projectKey},api);notes.push(`你已经退出的${q.name}传来停付消息。曾经到账的钱没有减少。`);}
 }
 return notes;
}
export function validateSchemeLifeFinance(s){
 for(const p of all(s).filter(p=>p.schemeLife)){
  const q=p.cryptoScheme;if(!q||!stages.includes(q.stage)||!['paying','mature','warning','frozen'].includes(q.status)||typeof p.projectKey!=='string'||q.projectKey!==p.projectKey)throw Error('独立项目状态无效');
  for(const key of ['invested','returned','paid','paymentCount','periodCount','principalReturned','retainedProfit','highestBalance','lastPageBalance','normalMonths','warningCount','transitionCount','maintenanceCount'])if(!int(q[key]))throw Error('独立项目账目无效');
  if(!['cash','retain'].includes(q.payoutMode)||typeof q.preparedExit!=='boolean'||!q.seenStages||Object.entries(q.seenStages).some(([k,v])=>!stages.includes(k)||typeof v!=='boolean'))throw Error('独立项目选择记录无效');
  if(p.bookBalance!==p.cost+q.retainedProfit||q.lastPageBalance!==p.bookBalance||q.highestBalance<p.bookBalance||q.paid>q.returned)throw Error('独立项目本金与账面利润不一致');
  if(q.status==='frozen'?(p.value!==0||!p.frozen):p.value!==p.bookBalance)throw Error('独立项目可提现估值无效');
  if(q.lastTransitionDay>day(s)||q.normalMonths<12)throw Error('独立项目时序无效');
  if(q.stageEnteredDay!==undefined&&(!int(q.stageEnteredDay)||q.stageEnteredDay>q.lastTransitionDay))throw Error('独立项目阶段日期无效');
  if(q.familyPrincipal!==undefined){for(const k of ['familyPrincipal','familyValue','familyInvested','familyReturned','familyPaid'])if(!int(q[k]))throw Error('家庭项目账目无效');if(q.familyPaid>q.familyReturned||!Array.isArray(q.familyContributions)||q.familyContributions.some(c=>!int(c.amount)||!int(c.day)||c.day>day(s))||sum(q.familyContributions.map(c=>c.amount))!==q.familyPrincipal||q.familyValue!==(q.status==='frozen'?0:q.familyPrincipal))throw Error('家庭项目本金与现金回款不一致');}
 }
 const follow=s.trading?.schemeLifeFollowups;if(follow!==undefined&&(!Array.isArray(follow)||follow.some(q=>typeof q.projectKey!=='string'||typeof q.positionId!=='string'||!['waiting','failed'].includes(q.status)||!['leftDay','lastCheckedDay','ordinaryAtExit','checks','bookBalance'].every(k=>int(q[k]))||q.leftDay>q.lastCheckedDay||q.lastCheckedDay>day(s))))throw Error('退出后的项目消息无效');
 const carriers=s.trading?.schemeFamilyProjects;if(carriers!==undefined&&(!Array.isArray(carriers)||new Set(carriers.map(p=>p.id)).size!==carriers.length||carriers.some(p=>!p.schemeFamilyOnly||p.cost!==0||p.value!==0||p.bookBalance!==0||!p.cryptoScheme?.familyPrincipal||(s.positions||[]).some(x=>x.id===p.id))))throw Error('家庭独立项目承载记录无效');
 return s;
}
