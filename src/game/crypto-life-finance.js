/** Long-lived stories use the existing cash, positions and claim accounts. Amounts are cents. */
import {FICTIONAL_CRYPTO_COINS,MEME_COINS} from './crypto-markets.js';
import {recordCryptoTrade} from './crypto-records.js';
import {cryptoLifeState,ensureCryptoLife,advanceCryptoLife,recordCryptoLifeTrade} from './crypto-life.js';
import {recordSchemeTrade} from './scheme-life.js';
import {isIndependentSchemeEffect,schemeLifeActionReason,schemeLifeActionPreview,executeSchemeLifeEffect,settleSchemeLifeProjects,validateSchemeLifeFinance} from './scheme-life-finance.js';

const MAX=Number.MAX_SAFE_INTEGER;
const day=s=>s.debtClock?.day||0;
const branchOf=p=>p.cryptoLifeBranch||(p.kind==='crypto_perp'?'leverage':p.kind==='crypto'?(p.instrument==='CHI'||MEME_COINS.some(c=>c.id===(p.instrument||p.underlying))?'alt':'spot'):null);
const branchName=b=>b==='altcoin'?'alt':b;
const aliases={add:'buy',alt_buy:'buy',leverage_open:'open_leverage',principal:'sell_principal',quit:'exit_all',permanent_close:'close_leverage',scheme_wait:'scheme_ack'};
const normalize=e=>({...e,action:aliases[e.action]||e.action,branch:branchName(e.branch)||(e.action==='alt_buy'?'alt':undefined)});
const int=n=>Number.isSafeInteger(n)&&n>=0;
const checked=n=>{if(!Number.isSafeInteger(n)||n<0)throw Error('Crypto 金额超出范围');return n;};
const add=(a,b)=>checked(a+b);
const sum=xs=>xs.reduce(add,0);
const scaled=(n,bps)=>Number((BigInt(n)*BigInt(bps)+5000n)/10000n);
const fmt=n=>`¥${(n/100).toLocaleString('zh-CN',{maximumFractionDigits:2})}`;
const isCrypto=p=>['crypto','crypto_perp'].includes(p.kind)||p.cryptoLifeBranch==='scheme';
const sellable=p=>!p.frozen&&!p.honeypot&&!p.failed&&p.cryptoScheme?.status!=='frozen';
const TIER={low:10,medium:25,high:100,extreme:500};
export function cryptoLifeHoldings(s,branch){const b=branchName(branch);return (s.positions||[]).filter(p=>isCrypto(p)&&(!b||branchOf(p)===b));}
export function cryptoLifePositionSummary(s,branch){const positions=cryptoLifeHoldings(s,branch),cost=sum(positions.map(p=>p.cost)),value=sum(positions.map(p=>p.value));return {positions,cost,value,pnl:value-cost,returnBps:cost?Math.round((value/cost-1)*10000):0};}
function selected(s,e){return cryptoLifeHoldings(s,e.branch).filter(p=>!(e.positionId||e.id)||p.id===(e.positionId||e.id));}
function investmentAmount(s,e){
 let n=e.amount??(e.amount_yuan===undefined?undefined:Math.round(e.amount_yuan*100));
 if(n===undefined&&e.fraction!==undefined){if(!Number.isFinite(e.fraction)||e.fraction<=0||e.fraction>1)return NaN;n=Math.floor(s.cash*e.fraction);}
 return n??10000;
}
function saleTerms(p,action){
 const principal=action==='sell_principal';
 const value=principal?Math.min(p.value,Number((BigInt(p.cost)*10000n+9979n)/9980n)):p.value;
 const fee=p.cryptoLifeBranch==='scheme'?0:scaled(value,20);
 return {value,fee,proceeds:value-fee,cost:value===p.value?p.cost:Math.min(p.cost,Math.round(p.cost*value/p.value))};
}
const owed=s=>sum((s.debts||[]).map(d=>add(d.principal,d.interest)));
function isNewRisk(e){return ['buy','open_leverage','scheme_join','scheme_add','borrow'].includes(e.action)||e.type==='invest'||e.type==='desk_order'||e.type==='desk_manage'&&e.operation==='margin';}
export function cryptoLifeActionReason(s,actiondata={}){
 const e=normalize(actiondata),g=cryptoLifeState(s),p=(s.positions||[]).find(p=>p.id===(e.positionId||e.id));
 if(e.product==='ponzi'&&['invest','desk_order'].includes(e.type)&&s.behavior?.cryptoLife?.schemeLife?.forbidRisk)return '你已经永久拒绝资金盘，仍可处理旧项目';
 if(isIndependentSchemeEffect(s,e))return schemeLifeActionReason(s,e);
 if(['scheme_join','scheme_add'].includes(e.action)&&s.behavior?.cryptoLife?.schemeLife?.forbidRisk)return '你已经永久拒绝资金盘，仍可处理旧项目';
 const relevant=!e.type||['crypto','crypto_perp'].includes(e.product)||p&&isCrypto(p);
 if(!relevant)return '';
 if(isNewRisk(e)){
  if(g.status==='CRYPTO_EXITED'&&(e.type||e.allowRelapse!==true))return '你已经长期退出 Crypto，仍可处理旧持仓';
  if((e.action==='open_leverage'||e.product==='crypto_perp'||e.operation==='margin'&&p?.kind==='crypto_perp')&&g.leverageClosed)return '合约入口已经永久关闭，仍可平掉旧仓';
  if(s.age<18)return '成年以后才能参与 Crypto';
  if(s.legal?.prisonMonthsLeft>0)return '服刑期间暂停外部交易';
  if(s.flags?.voluntary_exit||s.flags?.exit_intent)return '已经决定封盘，仍可退出旧持仓';
 }
 if(e.type)return '';
 if(['buy','open_leverage','scheme_join','scheme_add','borrow'].includes(e.action)){
  const amount=investmentAmount(s,e);if(!int(amount)||amount<100)return '投入金额至少为 ¥1，且必须是有效整分';
  if(e.action!=='borrow'&&amount>s.cash)return '实际现金不足，持仓和账面余额不能当作现金';
  if(e.action==='open_leverage'&&!Object.hasOwn(TIER,e.tier||'low'))return '请选择有效的风险档位';
  if(e.direction!==undefined&&!['long','short'].includes(e.direction))return '合约方向无效';
  if(e.branch!==undefined&&!['spot','alt','leverage','scheme'].includes(e.branch))return 'Crypto 分支无效';
  if(e.action==='scheme_join'&&s.age<24)return '这一类项目在 24 岁后才可能接触';
  if(e.action==='scheme_add'){
   const projects=selected(s,{...e,branch:'scheme'});if(!projects.length)return '当前没有可以追加的项目';
   if(projects.some(p=>!['paying','mature'].includes(p.cryptoScheme?.status)))return '项目已经出现异常，不能追加';
  }
 }
 if(['sell','sell_principal','scheme_withdraw'].includes(e.action)){
  const held=selected(s,e.action==='scheme_withdraw'?{...e,branch:'scheme'}:e);
  if(!held.length)return '当前没有这类持仓，不能重复卖出或提现';
  if(!held.some(sellable))return '这笔资产已经冻结或限制卖出，当前可提现为 ¥0';
 }
 if(e.action==='repay'){
  const amount=investmentAmount(s,e);if(!int(amount)||amount<=0)return '还款金额无效';
  if(!owed(s))return '当前没有需要偿还的债务';
  if(Math.min(amount,owed(s))>s.cash)return '实际现金不足，不能用持仓抵作还款';
 }
 return '';
}
export function cryptoLifeActionPreview(s,effect={}){
 if(isIndependentSchemeEffect(s,effect))return schemeLifeActionPreview(s,effect);
 const e=normalize(effect),reason=cryptoLifeActionReason(s,e),buy=['buy','open_leverage','scheme_join','scheme_add','borrow'].includes(e.action);
 const held=selected(s,e.action==='scheme_withdraw'?{...e,branch:'scheme'}:e).filter(sellable);
 const sells=['sell','sell_principal','scheme_withdraw','exit_all','close_leverage','reduce'].includes(e.action);
 const actual=['close_leverage','reduce'].includes(e.action)?held.filter(p=>p.kind==='crypto_perp'):held;
 const terms=sells?actual.map(p=>saleTerms(p,e.action)):[];
 return {ok:!reason,reason,amount:buy?investmentAmount(s,e):e.action==='repay'?Math.min(investmentAmount(s,e),owed(s)):sum(terms.map(t=>t.value)),cashCost:buy&&e.action!=='borrow'?investmentAmount(s,e):e.action==='repay'?Math.min(investmentAmount(s,e),owed(s)):0,fee:sum(terms.map(t=>t.fee)),proceeds:sum(terms.map(t=>t.proceeds))};
}
function receipt(s,p,info,api){const detail={...p.cryptoLifeOrigin,...info};recordCryptoLifeTrade(s,p,detail,api.metrics?.(s)||{});if(p.cryptoLifeBranch==='scheme')recordSchemeTrade(s,p,detail);}
function rememberSchemeExit(s,p,api,info={}){
 if(p.cryptoScheme?.warningDay===null||p.cryptoScheme?.warningDay===undefined)return;
 // A withdrawal from a warned project is itself a real observation of that warning.
 receipt(s,p,{...info,action:'warning',cashFlow:0,pnl:0,schemeWarning:true},api);
 s.trading.cryptoSchemeFollowups??=[];
 if(!s.trading.cryptoSchemeFollowups.some(q=>q.positionId===p.id))s.trading.cryptoSchemeFollowups.push({positionId:p.id,name:p.name,leftDay:day(s),lastCheckedDay:day(s),ordinaryAtExit:s.behavior?.onlineGambling?.ordinaryEvents||0,status:'waiting',amount:p.cost});
}
/** Emergency asset sales share their real haircut, while retaining branch receipts and remaining principal. */
function liquidateCryptoPosition(s,p,e,api,info){
 if(p.schemeLife){const before=s.cash;executeSchemeLifeEffect(s,{...e,positionId:p.id,receipt:info},api);return s.cash-before;}
 if(!s.positions.some(x=>x.id===p.id)||!sellable(p))throw Error('持仓已处理或无法提现');
 if(!Number.isFinite(e.fraction)||e.fraction<=0||e.fraction>1||!Number.isFinite(e.haircut_bps)||e.haircut_bps<0||e.haircut_bps>10000)throw Error('Crypto 资产出售比例无效');
 const sale=api.mul(p.value,e.fraction);if(!sale)return 0;
 advanceCryptoLife(s,api.metrics?.(s)||{});
 const prior={...p},ratio=sale/p.value,soldCost=sale===p.value?p.cost:api.mul(p.cost,ratio),proceeds=api.mul(sale,1-e.haircut_bps/10000);
 const sold={...prior,value:sale,cost:soldCost};
 p.value-=sale;p.cost-=soldCost;
 for(const key of ['units','margin','liquidation','premium','feesPaid'])if(p[key]!==undefined)p[key]-=api.mul(p[key],ratio);
 if(p.cryptoLifeBranch==='scheme'){
  p.bookBalance=p.value;p.cryptoScheme.lastPageBalance=p.bookBalance;
  if(p.cryptoScheme.contributions){
   // Cumulative allocation conserves every cent, including uneven contribution sizes.
   let prefix=0,allocated=0;
   p.cryptoScheme.contributions=p.cryptoScheme.contributions.map(c=>{prefix+=c.amount;const total=prior.cost?Number(BigInt(prefix)*BigInt(p.cost)/BigInt(prior.cost)):0,amount=total-allocated;allocated=total;return {...c,amount};}).filter(c=>c.amount>0);
  }
  if(!p.value)rememberSchemeExit(s,prior,api,info);
 }
 if(!p.value)s.positions=s.positions.filter(x=>x.id!==p.id);
 api.cashChange(s,proceeds,'折价出售个人资产',{positionId:p.id});api.record(s,'position',-sale,'部分资产出售',{positionId:p.id});api.noteRealizedProfit?.(s,proceeds-soldCost);
 const trade={...info,action:p.cryptoLifeBranch==='scheme'?'withdraw':p.kind==='crypto_perp'?'close':'sell',cashFlow:proceeds,pnl:proceeds-soldCost,costBasis:soldCost,text:`${p.name}折价出售，实际到账 ${fmt(proceeds)}。`};
 if(p.cryptoLifeBranch==='scheme')receipt(s,sold,trade,api);else recordCryptoTrade(s,sold,trade);
 return proceeds;
}
function sellOne(s,p,e,api){
 if(p.schemeLife){const before=s.cash;executeSchemeLifeEffect(s,{...e,action:e.action==='sell_principal'?'scheme_principal':'scheme_withdraw',positionId:p.id},api);return s.cash-before;}
 if(!s.positions.some(x=>x.id===p.id)||!sellable(p))throw Error('持仓已处理或无法提现');
 advanceCryptoLife(s,api.metrics?.(s)||{});
 const t=saleTerms(p,e.action),before=s.cash;
 if(p.cryptoLifeBranch==='scheme'){
  rememberSchemeExit(s,p,api,e.receipt);
  api.closePosition(s,p,p.value,`${p.name}本金退出`);
  receipt(s,p,{action:'withdraw',cashFlow:s.cash-before,pnl:s.cash-before-p.cost,costBasis:p.cost,...e.receipt},api);
 }else if(t.value===p.value){p.cryptoLifeReceipt=e.receipt||{};api.sell(s,p.id);}
 else{
  const ratio=t.value/p.value;p.value-=t.value;p.cost-=t.cost;
  for(const key of ['units','margin','liquidation','premium','feesPaid'])if(p[key]!==undefined)p[key]-=api.mul(p[key],ratio);
  api.cashChange(s,t.proceeds,`${p.name}取回部分资金`,{positionId:p.id});api.record(s,'position',-t.value,`${p.name}部分卖出`,{positionId:p.id});api.noteRealizedProfit?.(s,t.proceeds-t.cost);
  recordCryptoTrade(s,p,{...e.receipt,action:p.kind==='crypto_perp'?'close':'sell',cashFlow:t.proceeds,pnl:t.proceeds-t.cost,text:`${p.name}部分卖出，实际到账 ${fmt(t.proceeds)}。`});
 }
 return s.cash-before;
}
export function executeCryptoLifeEffect(s,effect,api,context={}){
 if(isIndependentSchemeEffect(s,effect))return executeSchemeLifeEffect(s,effect,api,context);
 const e=normalize(effect),reason=cryptoLifeActionReason(s,e);if(reason)throw Error(reason);
 if(cryptoLifeState(s).status==='CRYPTO_EXITED'&&isNewRisk(e)&&e.allowRelapse===true&&context.eventId!=='CL39')throw Error('复入需要在多年后的重逢事件中明确选择');
 ensureCryptoLife(s);
 const info={eventId:context.eventId||'',choice:context.choiceId||'',...(e.receipt||{})};
 if(e.action==='liquidate'){
  const held=selected(s,e);if(!held.length)throw Error('当前没有这类持仓，不能重复出售');
  let returned=0;for(const p of held)returned=add(returned,liquidateCryptoPosition(s,p,e,api,info));
  return `真实 Crypto 资产出售到账 ${fmt(returned)}，余下成本和项目本金已同步。`;
 }
 if(['buy','open_leverage'].includes(e.action)){
  const branch=e.action==='open_leverage'?'leverage':e.branch||'spot',instrument=e.instrument||(branch==='alt'?'CHI':'CLG');
  const coin=FICTIONAL_CRYPTO_COINS.find(c=>c.id===instrument);if(!coin)throw Error('长期剧情只使用虚构币种');
  const amount=investmentAmount(s,e),product=branch==='leverage'?'crypto_perp':'crypto';
  const quote=s.trading?.quotes?.[instrument]?.price??s.markets[instrument]??10000;if(!int(quote)||quote<=0)throw Error('这个币种当前无法交易');s.markets[instrument]=quote;
  const before=s.cash,p=api.invest(s,{product,amount,underlying:instrument,direction:e.direction||'long',leverage:TIER[e.tier||'low']});
  p.instrument=instrument;p.name=coin.name+(branch==='leverage'?' · 日内合约':'');p.managed=true;p.cryptoLifeBranch=branch;p.cryptoLifeOrigin=info;
  const text=`${p.name}投入 ${fmt(amount)}，现金和持仓已记入账本${branch==='leverage'?'；当日按实际行情结清':''}。`;
  recordCryptoTrade(s,p,{...info,action:branch==='leverage'?'open':'buy',cashFlow:s.cash-before,text});return text;
 }
 if(e.action==='scheme_join'){
  const amount=investmentAmount(s,e),before=s.cash,p=api.invest(s,{product:'ponzi',amount,underlying:'LANTERN'});
  p.instrument='LANTERN';p.name='长灯计划';p.cryptoLifeBranch='scheme';p.cryptoLifeOrigin=info;p.cryptoScheme={status:'paying',joinedDay:day(s),lastPaidDay:day(s),lastTransitionDay:day(s),paymentCount:0,paid:0,warningDay:null,warningSeen:false,maintenanceSeen:false,lastPageBalance:amount};
  receipt(s,p,{...info,action:'buy',cashFlow:s.cash-before},api);return `长灯计划收到了 ${fmt(amount)}。本金成为一笔可追踪持仓，首笔收益尚未到账。`;
 }
 if(e.action==='scheme_add'){
  const p=selected(s,{...e,branch:'scheme'})[0],amount=investmentAmount(s,e);api.cashChange(s,-amount,'长灯计划追加本金',{positionId:p.id});p.cost=add(p.cost,amount);p.value=add(p.value,amount);p.bookBalance=p.value;p.cryptoScheme.lastPageBalance=p.bookBalance;
  // New capital earns only from its own contribution date, never retroactively.
  p.cryptoScheme.contributions??=[{amount:p.cost-amount,day:p.cryptoScheme.joinedDay}];p.cryptoScheme.contributions.push({amount,day:day(s)});
  api.record(s,'position',amount,'长灯计划追加本金估值',{positionId:p.id});receipt(s,p,{...info,action:'add',cashFlow:-amount},api);return `追加 ${fmt(amount)}，这笔钱已从现金转入项目本金。`;
 }
 if(['sell','sell_principal','scheme_withdraw','exit_all','close_leverage','reduce'].includes(e.action)){
  const held=selected(s,e.action==='scheme_withdraw'?{...e,branch:'scheme'}:e).filter(p=>sellable(p)&&(!['close_leverage','reduce'].includes(e.action)||p.kind==='crypto_perp'));
  let returned=0;for(const p of held)returned=add(returned,sellOne(s,p,{...e,receipt:info},api));
  const locked=cryptoLifeHoldings(s).filter(p=>!sellable(p)).length;
  return returned?`已处理真实持仓，实际到账 ${fmt(returned)}。${locked?'仍有冻结资产，不能计作提现。':''}`:`没有可兑现的仓位需要处理。${locked?'冻结资产仍保留追偿或等待记录。':''}`;
 }
 if(e.action==='scheme_ack'){
  for(const p of cryptoLifeHoldings(s,'scheme'))if(['warning','frozen'].includes(p.cryptoScheme?.status)){
   const q=p.cryptoScheme;
   if(!q.warningSeen||q.status==='frozen'&&!q.maintenanceSeen)q.lastTransitionDay=day(s);
   q.warningSeen=true;if(q.status==='frozen')q.maintenanceSeen=true;
   receipt(s,p,{...info,action:'warning',cashFlow:0,pnl:0,schemeWarning:true},api);
  }
  return '你已经看见项目的异常，选择留在这段记忆里。';
 }
 if(e.action==='borrow'){
  if(typeof api.issueLoan!=='function')throw Error('当前借款入口不可用');const amount=investmentAmount(s,e);
  const before=s.cash,debt=api.issueLoan(s,e.kind||'friend',amount,{purpose:'crypto',aprBps:e.aprBps??800,monthsLeft:e.monthsLeft??12});receipt(s,{kind:'crypto',cryptoLifeBranch:e.branch||'leverage'},{...info,action:'borrow',cashFlow:s.cash-before,borrowed:s.cash-before,debtId:debt?.id},api);return `借入 ${fmt(amount)}，债务已经登记；这笔钱尚未投入 Crypto。`;
 }
 if(e.action==='repay'){const before=s.cash;api.payDebt(s,Math.min(investmentAmount(s,e),owed(s)),e.debtId);return `已经用实际现金还款 ${fmt(before-s.cash)}，持仓未动。`;}
 // Exposure, refusal and preference changes are handled by the shared story-memory layer.
 return '';
}

/** Call after the life-day clock moves; absolute due dates make repeated calls harmless. */
export function settleCryptoLifeSchemes(s,days,api,notes=[]){
 const now=day(s);if(!Number.isSafeInteger(days)||days<0)throw Error('项目结算天数无效');
 for(const p of [...cryptoLifeHoldings(s,'scheme')]){
  if(p.schemeLife)continue;
  const q=p.cryptoScheme;if(!q)continue;
  // One monthly receipt per elapsed real game month. Payments stop as soon as warning begins.
  while(['paying','mature'].includes(q.status)&&now-q.lastPaidDay>=30){
   q.lastPaidDay+=30;
   const contributions=q.contributions||[{amount:p.cost,day:q.joinedDay}];
   const amount=sum(contributions.map(c=>api.mul(c.amount,.025*Math.min(30,Math.max(0,q.lastPaidDay-c.day))/30)));
   if(amount){api.cashChange(s,amount,'长灯计划实际收益到账',{positionId:p.id});api.noteRealizedProfit?.(s,amount);p.withdrawals=add(p.withdrawals||0,amount);q.paid=add(q.paid,amount);receipt(s,p,{action:'payment',cashFlow:amount,pnl:amount,costBasis:0,lifeDay:q.lastPaidDay},api);notes.push(`长灯计划实际到账 ${fmt(amount)}，本金仍在项目中。`);}
   q.paymentCount++;q.lastTransitionDay=q.lastPaidDay;
   if(q.paymentCount>=6){q.status='mature';if(q.paymentCount>6&&api.draw(s)<.18){q.status='warning';q.warningDay=q.lastPaidDay;q.warningSeen=false;q.lastPageBalance=p.bookBalance;notes.push('长灯计划的下一笔回款变慢了，页面显示“处理中”。');}}
  }
  // A warning must be chosen by the player before any freeze; a large fast-forward cannot skip it.
  if(q.status==='warning'&&q.warningSeen&&now-q.lastTransitionDay>=30){
   q.lastTransitionDay=now;const roll=api.draw(s);
   if(roll<.35){const prior=p.value;p.value=0;p.frozen=true;q.status='frozen';q.maintenanceSeen=false;q.lastPageBalance=p.bookBalance;api.record(s,'position',-prior,'长灯计划暂停提现，当前可兑现估值归零',{positionId:p.id});notes.push('长灯计划显示“系统维护”，目前无法提现。');}
   else if(roll>.8){q.status='mature';q.warningSeen=false;q.lastPaidDay=now;notes.push('长灯计划恢复了回款，本次等待仍留下记录。');}
  // A compressed life period must leave room for either maintenance or silent-group
  // story to be read before another random change can close this project.
  }else if(q.status==='frozen'&&q.maintenanceSeen===true&&now-q.lastTransitionDay>=30){
   q.lastTransitionDay=now;const roll=api.draw(s);
   if(roll<.3){const claim=api.freezePosition(s,p,'长灯计划停止兑付追偿本金');if(claim.value)api.record(s,'claim',-claim.value,'长灯计划追偿尚无可兑现价值',{claimId:claim.id});claim.value=0;claim.cryptoLifeBranch='scheme';claim.projectKey=p.projectKey||q.projectKey||p.id;claim.sourcePositionId=p.id;q.status='failed';receipt(s,p,{action:'scheme_failure',cashFlow:0,pnl:-p.cost,costBasis:p.cost,schemeFailure:true,lastPageBalance:q.lastPageBalance},api);notes.push(`长灯计划消失了。最后页面余额 ${fmt(q.lastPageBalance)}，实际可提现 ¥0。`);}
   else if(roll>.8){p.frozen=false;p.value=p.cost;p.bookBalance=p.cost;api.record(s,'position',p.value,'长灯计划重新开放提现',{positionId:p.id});q.status='mature';q.lastPaidDay=now;q.warningSeen=false;q.maintenanceSeen=false;notes.push('长灯计划重新开放了提现，是否退出由你决定。');}
  }
 }
 for(const q of s.trading?.cryptoSchemeFollowups||[]){
  if(q.status!=='waiting'||now-q.leftDay<180||now-q.lastCheckedDay<30||(s.behavior?.onlineGambling?.ordinaryEvents||0)-q.ordinaryAtExit<2)continue;
  q.lastCheckedDay=now;if(api.draw(s)<.25){q.status='failed';receipt(s,{id:q.positionId,kind:'ponzi',cryptoLifeBranch:'scheme',name:q.name,cost:0,value:0},{action:'scheme_failure_news',cashFlow:0,schemeFailureNews:true},api);notes.push(`你曾经退出的${q.name}传来停付消息。已经到账的钱没有变化。`);}
 }
 settleSchemeLifeProjects(s,days,api,notes);return notes;
}

export function validateCryptoLifeFinance(s){
 const followups=s.trading?.cryptoSchemeFollowups;if(followups!==undefined){if(!Array.isArray(followups)||followups.length>20000)throw Error('Crypto 项目消息记录无效');for(const q of followups)if(typeof q.positionId!=='string'||typeof q.name!=='string'||!['waiting','failed'].includes(q.status)||!['leftDay','lastCheckedDay','ordinaryAtExit','amount'].every(k=>int(q[k]))||q.leftDay>q.lastCheckedDay||q.lastCheckedDay>day(s))throw Error('Crypto 项目消息记录无效');}
 for(const p of s.positions||[]){
  if(p.cryptoLifeBranch!==undefined&&!['spot','alt','leverage','scheme'].includes(p.cryptoLifeBranch))throw Error('Crypto 持仓分支无效');
  if(p.cryptoLifeBranch!=='scheme')continue;
  const q=p.cryptoScheme;if(p.kind!=='ponzi'||!q||!['paying','mature','warning','frozen'].includes(q.status))throw Error('Crypto 项目状态无效');
  for(const k of ['joinedDay','lastPaidDay','lastTransitionDay','paymentCount','paid','lastPageBalance'])if(!int(q[k]))throw Error('Crypto 项目账目无效');
  if(q.lastPaidDay>day(s)||q.joinedDay>q.lastPaidDay||typeof q.warningSeen!=='boolean'||q.warningDay!==null&&!int(q.warningDay))throw Error('Crypto 项目日期无效');
  if(q.maintenanceSeen!==undefined&&typeof q.maintenanceSeen!=='boolean')throw Error('Crypto 项目维护记忆无效');
  if(q.status==='frozen'&&(!p.frozen||p.value!==0))throw Error('冻结项目不能计为可兑现资产');
  if(q.contributions){if(!Array.isArray(q.contributions)||q.contributions.some(c=>!int(c.amount)||!int(c.day)||c.day>day(s))||sum(q.contributions.map(c=>c.amount))!==p.cost)throw Error('Crypto 项目追加账目无效');}
 }
 validateSchemeLifeFinance(s);return s;
}
