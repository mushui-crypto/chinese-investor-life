import {newSchemeLife,schemeEventAllowed,schemeEventWeight} from './scheme-life.js';
/** Crypto life memories observe real positions and receipts; money, RNG and queues belong to the engine. */
import {gameDate} from './game-calendar.js';
import {MEME_COINS} from './crypto-markets.js';
export const CRYPTO_BRANCHES=['spot','alt','leverage','scheme'];
export const CRYPTO_STATUSES=['UNEXPOSED','EXPOSED','ACTIVE','QUIT','CRYPTO_EXITED'];
export const CRYPTO_MEMORIES=['firstCryptoBuy','firstCryptoWin','firstCryptoLoss','firstAltcoin','firstAltcoinBigWin','firstLeverage','firstLiquidation','highestCryptoWealth','firstScheme','firstSchemePayment','firstSchemeWarning','cryptoQuit','cryptoRelapse','firstRecovery'];
export const CRYPTO_TENDENCIES=['curiosity','analysis','greed','holding','dipBuying','chasing','FOMO','bigWinMemory','altcoinConfidence','leveragePreference','leverageConfidence','patternBelief','confidence','schemeTrust','guilt'];
export const CRYPTO_ENDINGS=[
 ['forgotten','买了就忘','多年以后，你才想起来自己还有这个。'],['walked_away','拿钱走人','你没有卖在最高点。但钱到账了。'],['holder','长期持有者','行情换过很多种说法，你的持仓还是当年的名字。'],['alt_king','山寨之王','截图留下了最高点，到账记录留下了另一条线。'],['after_hundredfold','百倍以后','你一直在找下一个。后来赚过的那一次，也没剩下。'],['right_direction','方向正确','你很多次都是对的。账户不是。'],['leverage_graduate','杠杆毕业','胜率看起来不错，账户却没有毕业证。'],['overnight_zero','一夜归零','昨日账户还亮着，今日只剩那张截图。'],['stable_income','稳定收益','它真的付过钱。最后一次，余额也真的还在页面上。'],['escaped','跑得快','你第一次觉得，没有赚到最后一分钱也挺好。'],['graduated','币圈毕业','后来那些涨跌，你都没有再参与。'],['bull_return','牛回速归','你回来了，行情也回去了。'],['bankruptcy','Crypto爆仓破产','你花了很多年研究什么时候买。最后发现，真正困难的是什么时候停。'],
].map(([id,title,text])=>({id,title,text}));
export const CRYPTO_ACHIEVEMENTS=[['value_investing','价值投资'],['technical_analysis','技术分析'],['long_term','长期主义'],['held_it','拿住了'],['bought_bottom','成功抄底'],['dip_master','抄底大师'],['right_direction','方向正确'],['risk_management','风险管理'],['stable_income','稳定收益'],['principal_protection','本金保护'],['bull_return','牛回速归'],['next_round','下一轮']].map(([id,title])=>({id,title}));
const MAX=Number.MAX_SAFE_INTEGER;
const day=s=>s.debtClock?.day||0;
const age=s=>Math.round(((s.age??18)+(s.debtClock?.periodDays||0)/360)*100)/100;
const sum=a=>a.reduce((x,y)=>x+y,0);
const debt=s=>sum((s.debts||[]).map(d=>(d.principal||0)+(d.interest||0)));
const assets=s=>(s.cash||0)+sum((s.positions||[]).map(p=>p.value||0))+sum((s.businesses||[]).map(p=>p.value||0))+sum((s.claims||[]).map(p=>p.value||0));
const ordinary=s=>s.behavior?.onlineGambling?.ordinaryEvents||0;
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
const money=n=>{if(!Number.isSafeInteger(n)||n<0)throw Error('Crypto记忆金额无效');return n;};
const signed=n=>{if(!Number.isSafeInteger(n))throw Error('Crypto记忆金额无效');return n;};
const add=(a,b)=>signed(a+b);
export function cryptoLifeBranch(p){if(CRYPTO_BRANCHES.includes(p?.cryptoLifeBranch))return p.cryptoLifeBranch;if(p?.kind==='crypto_perp')return 'leverage';if(p?.kind==='crypto')return p.meme||p.memeKind||p.instrument==='CHI'||MEME_COINS.some(c=>c.id===(p.instrument||p.underlying))?'alt':'spot';return null;}
const positions=(s,branch)=> (s.positions||[]).filter(p=>cryptoLifeBranch(p)&&(!branch||cryptoLifeBranch(p)===branch));
const wealth=(s,branch)=>sum(positions(s,branch).map(p=>p.value||0));
const cost=(s,branch)=>sum(positions(s,branch).map(p=>p.cost||0));
const branchState=()=>({invested:0,returned:0,realizedProfit:0,trades:0,buys:0,sells:0,peakWealth:0,peakUnrealizedProfit:0,peakReturnBps:0});
export function newCryptoLife(){return {version:1,schemeLife:newSchemeLife(),status:'UNEXPOSED',exposed:false,exposedDay:null,altcoinExposed:false,leverageExposed:false,schemeExposed:false,legacyImported:false,legacyBranches:[],branches:Object.fromEntries(CRYPTO_BRANCHES.map(k=>[k,branchState()])),tendencies:Object.fromEntries(CRYPTO_TENDENCIES.map(k=>[k,0])),memories:Object.fromEntries(CRYPTO_MEMORIES.map(k=>[k,null])),invested:0,returned:0,realizedProfit:0,highestCryptoWealth:0,highestRealizedProfit:0,totalTrades:0,contractWins:0,contractLosses:0,liquidations:0,correctLiquidations:0,largestLiquidation:0,highLeverage:false,everHighLeverage:false,leverageClosed:false,preferredLeverage:'low',leverageReducedAfterLiquidation:false,highLeverageChoices:0,dipBuys:0,theoryChanges:0,schemePayments:0,schemePaid:0,schemeFirstPaidDay:null,schemeLastPaidDay:null,schemeFailed:false,schemeLastPageBalance:0,schemeExitedAfterWarning:false,schemeFailureConfirmed:false,quitIntent:false,quitCount:0,quitDay:null,exitedDay:null,longestQuit:0,relapseCount:0,lastRelapseDay:null,relapseProfit:0,relapseRaisedRisk:false,refusals:0,cooldownUntil:0,lastEventDay:null,ordinaryAtLastEvent:0,eventCounts:{},eventLastDays:{},lastTradeDay:null,lastBehaviorDay:null,emptySinceDay:null,borrowed:0,exitOpportunities:0,achievements:{},history:[],positionHistory:{}};}
/** These selectors never migrate a save, consume RNG, or alter any financial value. */
export function cryptoLifeState(s){return s.behavior?.cryptoLife||newCryptoLife();}
/** Eligibility and prose must compare the same settled receipt with today's pay. */
export function cryptoWageWinReceipt(s){return s.monthlyIncome>0?cryptoLifeState(s).history.findLast(h=>h.kind==='trade'&&h.branch==='leverage'&&h.pnl>=s.monthlyIncome/30)||null:null;}
export function ensureCryptoLife(s){
 s.behavior??={};if(s.behavior.cryptoLife)return s.behavior.cryptoLife;
 const g=s.behavior.cryptoLife=newCryptoLife(),held=positions(s),receipts=(s.trading?.journal||[]).filter(j=>j.crypto),legacy=held.length||receipts.length||s.flags?.crypto_investor||s.flags?.crypto_perp_investor;
 if(s.flags?.cryptoExposed||s.flags?.crypto_exposed||legacy){g.exposed=true;g.status=legacy?'ACTIVE':'EXPOSED';}
 if(legacy){g.legacyImported=true;g.legacyBranches=[...new Set([...held.map(cryptoLifeBranch),...receipts.map(j=>j.crypto.product==='crypto_perp'?'leverage':'spot')])];g.highestCryptoWealth=wealth(s);for(const b of CRYPTO_BRANCHES)g.branches[b].peakWealth=wealth(s,b);}
 // A truncated journal cannot recover lifetime totals or first dates. Leave them unknown.
 return g;
}
function receiptDay(s,info={}){const n=info.lifeDay??day(s);if(!Number.isSafeInteger(n)||n<0||n>day(s))throw Error('Crypto回执日期无效');return n;}
function snapshot(s,info={},value=0){const n=receiptDay(s,info);return {age:Math.round((age(s)-(day(s)-n)/360)*100)/100,day:n,amount:signed(value),eventId:String(info.eventId||info.source||''),choice:String(info.choice||''),branch:CRYPTO_BRANCHES.includes(info.branch)?info.branch:null};}
function remember(g,key,s,info,value=0,extra={}){if(!g.memories[key])g.memories[key]={...snapshot(s,info,value),...extra};}
function firstKnown(g,key,s,info,value=0,extra={}){const unknown=g.legacyImported&&(['firstCryptoBuy','firstCryptoWin','firstCryptoLoss'].includes(key)||g.legacyBranches.includes(info.branch));if(!unknown)remember(g,key,s,info,value,extra);}
function history(g,row){g.history.push(row);if(g.history.length>240){const i=g.history.findIndex(h=>h.kind==='trade'&&!h.exitOpportunity&&!h.liquidation);g.history.splice(i>=0?i:1,1);}}
function unlock(g,id,s){if(!g.achievements[id])g.achievements[id]={day:day(s),age:age(s)};}
function adjust(g,delta={}){for(const [key,value] of Object.entries(delta)){if(!CRYPTO_TENDENCIES.includes(key)||!Number.isFinite(value))throw Error('Crypto倾向无效');g.tendencies[key]=clamp(g.tendencies[key]+value);}}
function markQuit(s,g,info={}){
 g.quitIntent=true;if(positions(s).length)return;
 if(!g.totalTrades&&!g.legacyImported)return;
 if(!['QUIT','CRYPTO_EXITED'].includes(g.status)){g.status='QUIT';g.quitCount++;g.quitDay=day(s);g.emptySinceDay??=day(s);remember(g,'cryptoQuit',s,info,g.realizedProfit);history(g,{...snapshot(s,info,g.realizedProfit),kind:'quit',realizedProfit:g.realizedProfit});}
}
function liveValue(s,g){
 const total=wealth(s);if(total>g.highestCryptoWealth){g.highestCryptoWealth=total;g.memories.highestCryptoWealth={...snapshot(s,{source:'valuation'},total),realized:false};}
 for(const b of CRYPTO_BRANCHES){const ps=positions(s,b),value=sum(ps.map(p=>p.value||0)),basis=sum(ps.map(p=>p.cost||0)),bs=g.branches[b];bs.peakWealth=Math.max(bs.peakWealth,value);bs.peakUnrealizedProfit=Math.max(bs.peakUnrealizedProfit,value-basis);
  for(const p of ps){const r=basis>0?Math.floor((p.value-p.cost)/Math.max(1,p.cost)*10000):0;bs.peakReturnBps=Math.max(bs.peakReturnBps,Math.min(MAX,r));const h=g.positionHistory[p.id];if(h){h.peakValue=Math.max(h.peakValue,p.value||0);h.peakReturnBps=Math.max(h.peakReturnBps,r);h.minReturnBps=Math.min(h.minReturnBps??0,r);if(b==='alt'&&h.peakReturnBps>=80000&&r<=-6000)unlock(g,'held_it',s);if(h.dipEntryValue>0&&p.value<=h.dipEntryValue*.2)unlock(g,'bought_bottom',s);if((p.unsellable||p.honeypot||p.frozen||p.failed)&&h.firstObservedDay!==null&&day(s)-h.firstObservedDay>=720)unlock(g,'long_term',s);}
   if(b==='alt'&&r>=10000){firstKnown(g,'firstAltcoinBigWin',s,{branch:b,source:'valuation'},p.value-p.cost,{realized:false,returnBps:r});}
  }
 }
 return total;
}
export function advanceCryptoLife(s,metrics={}){
 const g=ensureCryptoLife(s);liveValue(s,g);
 for(const h of Object.values(g.positionHistory)){const q=h.liquidation;if(!q||q.confirmed||day(s)<=q.day)continue;const price=s.trading?.quotes?.[q.underlying]?.price??s.markets?.[q.underlying];if(Number.isFinite(price)&&(q.direction==='short'?price<q.entryPrice:price>q.entryPrice)){q.confirmed=true;g.correctLiquidations++;for(const row of g.history)if(row.liquidation&&row.positionId===q.positionId)row.directionCorrect=true;unlock(g,'right_direction',s);}}
 if(positions(s).length){g.emptySinceDay=null;if(g.status==='CRYPTO_EXITED')g.status='ACTIVE';return g;}
 if(!g.totalTrades&&!g.legacyImported)return g;
 g.emptySinceDay??=day(s);if(g.quitIntent)markQuit(s,g);
 const since=Math.max(g.emptySinceDay,g.lastBehaviorDay??g.emptySinceDay),elapsed=Math.max(0,day(s)-since);g.longestQuit=Math.max(g.longestQuit,elapsed);
 if(elapsed>=720&&g.status!=='CRYPTO_EXITED'){g.status='CRYPTO_EXITED';g.exitedDay=day(s);history(g,{...snapshot(s,{source:'crypto_exited'},g.realizedProfit),kind:'exited',realizedProfit:g.realizedProfit});}
 return g;
}
const ACTION_TENDENCIES={curious:{curiosity:7},analyze:{analysis:7},research:{analysis:6},greed:{greed:7},hold:{holding:5},dip_buy:{dipBuying:8},chase:{chasing:8,FOMO:4},fomo:{FOMO:8},continue:{confidence:5},seek_next:{FOMO:8,altcoinConfidence:6},increase_leverage:{leveragePreference:8},high_leverage:{leveragePreference:12},lower_leverage:{leveragePreference:-8},theory:{patternBelief:5},trust:{schemeTrust:7},recruit:{schemeTrust:4,guilt:4},disclose:{guilt:-5},decline:{greed:-3,FOMO:-3},quit:{chasing:-5,FOMO:-5}};
export function recordCryptoLifeEvent(s,info={}){
 const id=String(info.eventId||info.id||'');if(!id)throw Error('Crypto事件记忆缺少编号');
 const g=ensureCryptoLife(s),action=String(info.action||''),branch=info.branch,now=day(s);g.eventCounts[id]=(g.eventCounts[id]||0)+1;g.eventLastDays[id]=now;g.lastEventDay=now;g.ordinaryAtLastEvent=ordinary(s);if(info.exitOpportunity)g.exitOpportunities++;
 if(info.exposure||['expose','curious','analyze','greed'].includes(action)){g.exposed=true;g.exposedDay??=now;if(g.status==='UNEXPOSED')g.status='EXPOSED';s.flags??={};s.flags.cryptoExposed=true;}
 if(action==='alt_exposure'||branch==='alt'&&(action==='expose'||info.exposure))g.altcoinExposed=true;
 if(action==='leverage_exposure'||branch==='leverage'&&(action==='expose'||info.exposure))g.leverageExposed=true;
 if(action==='scheme_exposure'||branch==='scheme'&&(action==='expose'||info.exposure))g.schemeExposed=true;
 adjust(g,ACTION_TENDENCIES[action]);if(info.tendencies)adjust(g,info.tendencies);
 if(info.refused||['decline','refuse','ignore'].includes(action)){g.refusals++;g.cooldownUntil=Math.max(g.cooldownUntil,now+180);}
 if(info.quit||action==='quit'||['sell','principal','scheme_withdraw'].includes(action)&&!positions(s).length){markQuit(s,g,info);g.cooldownUntil=Math.max(g.cooldownUntil,now+180);}
 if(action==='close_leverage'){g.leverageClosed=true;g.highLeverage=false;g.preferredLeverage='low';}
 if(action==='lower_leverage'){g.highLeverage=false;g.preferredLeverage='low';if(g.liquidations)g.leverageReducedAfterLiquidation=true;}
 if(['increase_leverage','high_leverage','extreme_leverage'].includes(action)){g.highLeverageChoices++;g.preferredLeverage=action==='extreme_leverage'?'extreme':action==='high_leverage'?'high':'medium';if(action!=='increase_leverage'||g.highLeverageChoices>=3){g.highLeverage=true;g.everHighLeverage=true;}if(g.leverageReducedAfterLiquidation)unlock(g,'risk_management',s);if(g.lastRelapseDay!==null)g.relapseRaisedRisk=true;}
 if(action==='theory'){g.theoryChanges++;if(g.theoryChanges>=20)unlock(g,'technical_analysis',s);}
 if(action==='scheme_warning'){remember(g,'firstSchemeWarning',s,info,wealth(s,'scheme'));}
 if(action==='scheme_failure_news'&&g.schemeExitedAfterWarning){g.schemeFailureConfirmed=true;}
 if(action==='direction_correct'&&g.correctLiquidations){unlock(g,'right_direction',s);}
 if(info.protectedPrincipal||action==='protect_principal'&&positions(s,branch).some(p=>p.cost>0&&p.value<=p.cost*.1))unlock(g,'principal_protection',s);
 if(['hold','next_round'].includes(action)){if(positions(s,'alt').some(p=>p.cost>0&&p.value<=p.cost*.1))unlock(g,'value_investing',s);if(action==='next_round'&&positions(s,'alt').some(p=>p.cost>0&&p.value<=p.cost*.03))unlock(g,'next_round',s);}
 if(action==='hold'&&positions(s,branch).some(p=>p.cost>0&&p.value>=p.cost*2))adjust(g,{bigWinMemory:10});
 // Decisions to watch/refuse are not a new investment and do not reset abstinence.
 history(g,{...snapshot(s,info,g.realizedProfit),kind:'event',action,exitOpportunity:Boolean(info.exitOpportunity),realizedProfit:g.realizedProfit});return advanceCryptoLife(s);
}
/** Call after a real engine receipt. No cash, holdings, quotes, or loan is created here. */
export function recordCryptoLifeTrade(s,p,info={},metrics={}){
 const branch=cryptoLifeBranch(p);if(!branch)return false;
 const action=String(info.action||''),flow=signed(info.cashFlow??0),pnl=info.pnl===undefined?null:signed(info.pnl),buy=['buy','open','add','margin','invest','subscribe'].includes(action),payment=['payment','income','scheme_payment'].includes(action),failure=info.schemeFailure||['scheme_failure','failure'].includes(action),liquidation=action==='liquidation';
 if(buy&&flow>=0)throw Error('Crypto投入缺少真实支出');if(!buy&&flow<0)throw Error('Crypto回款不能为负');
 const g=ensureCryptoLife(s),bs=g.branches[branch],now=receiptDay(s,info),before=g.realizedProfit,detail={...info,branch},legacyBranch=g.legacyImported&&g.legacyBranches.includes(branch);
 if(action==='borrow'){const borrowed=money(info.borrowed??flow);if(!borrowed||flow!==borrowed)throw Error('Crypto借款缺少真实回执');g.borrowed=add(g.borrowed,borrowed);history(g,{...snapshot(s,detail,borrowed),kind:'borrow',realizedProfit:g.realizedProfit,debtId:String(info.debtId||'')});return g;}
 if(info.schemeFailureNews){if(!g.schemeExitedAfterWarning)throw Error('没有已提前退出的项目');g.schemeFailureConfirmed=true;history(g,{...snapshot(s,detail,0),kind:'event',action:'scheme_failure_news',realizedProfit:g.realizedProfit});return g;}
 if(info.schemeWarning&&flow===0&&!pnl){remember(g,'firstSchemeWarning',s,detail,p.value||0);return g;}
 if(action==='recovery'){
  if(branch!=='scheme'||flow<=0||pnl!==flow)throw Error('Crypto追偿缺少真实回执');
  g.returned=add(g.returned,flow);bs.returned=add(bs.returned,flow);g.realizedProfit=add(g.realizedProfit,pnl);bs.realizedProfit=add(bs.realizedProfit,pnl);g.highestRealizedProfit=Math.max(g.highestRealizedProfit,g.realizedProfit);
  const recoveredBalance=before<0&&g.realizedProfit>=0;if(recoveredBalance)remember(g,'firstRecovery',s,detail,g.realizedProfit,{realized:true});
  // Recovery repairs an earlier loss; it is not a new trade or a relapse.
  history(g,{...snapshot(s,detail,flow),kind:recoveredBalance?'recovery':'event',action,cashFlow:flow,pnl,realizedProfit:g.realizedProfit,positionId:String(p.id||'')});return g;
 }
 if(buy&&g.leverageClosed&&branch==='leverage')throw Error('已永久关闭合约');
 if(buy){if(['QUIT','CRYPTO_EXITED'].includes(g.status)){
   const elapsed=Math.max(0,now-(g.quitDay??g.emptySinceDay??now));g.longestQuit=Math.max(g.longestQuit,elapsed);g.relapseCount++;g.lastRelapseDay=now;g.relapseProfit=0;g.relapseRaisedRisk=false;remember(g,'cryptoRelapse',s,detail,-flow);history(g,{...snapshot(s,detail,-flow),kind:'relapse',quitDays:elapsed,realizedProfit:before});if(elapsed>=720)unlock(g,'bull_return',s);
  }
  g.status='ACTIVE';g.quitDay=null;g.exitedDay=null;g.emptySinceDay=null;g.quitIntent=false;g.exposed=true;g.exposedDay??=legacyBranch?null:now;g.invested=add(g.invested,-flow);bs.invested=add(bs.invested,-flow);bs.buys++;
  if(!g.legacyImported)remember(g,'firstCryptoBuy',s,detail,-flow,{realized:true});
  const key={alt:'firstAltcoin',leverage:'firstLeverage',scheme:'firstScheme'}[branch];if(key&&!legacyBranch)remember(g,key,s,detail,-flow,{realized:true});
  if(branch==='alt')g.altcoinExposed=true;if(branch==='leverage')g.leverageExposed=true;if(branch==='scheme')g.schemeExposed=true;
  if(info.borrowed)g.borrowed=add(g.borrowed,money(info.borrowed));
  if(info.dipBuying||info.dipBuy){g.dipBuys++;if(g.dipBuys>=5)unlock(g,'dip_master',s);}
  if(branch==='leverage'&&(info.highLeverage||p.leverage>=50)){g.highLeverage=true;g.everHighLeverage=true;if(g.lastRelapseDay!==null)g.relapseRaisedRisk=true;}
  if(p.id){const old=g.positionHistory[p.id];g.positionHistory[p.id]={firstObservedDay:old?.firstObservedDay??now,peakValue:Math.max(old?.peakValue||0,p.value||0),peakReturnBps:old?.peakReturnBps||0,minReturnBps:old?.minReturnBps||0,dipEntryValue:info.dipBuying||info.dipBuy?p.value||0:old?.dipEntryValue||0};}
 }else{
  g.returned=add(g.returned,flow);bs.returned=add(bs.returned,flow);if(!payment)bs.sells++;
  if(pnl!==null){g.realizedProfit=add(g.realizedProfit,pnl);bs.realizedProfit=add(bs.realizedProfit,pnl);g.highestRealizedProfit=Math.max(g.highestRealizedProfit,g.realizedProfit);if(g.lastRelapseDay!==null)g.relapseProfit=add(g.relapseProfit,pnl);
   if(pnl>0)firstKnown(g,'firstCryptoWin',s,detail,pnl,{realized:true});if(pnl<0)firstKnown(g,'firstCryptoLoss',s,detail,-pnl,{realized:true});
   if(branch==='leverage'&&!payment){if(pnl>0)g.contractWins++;if(pnl<0)g.contractLosses++;}
   if(before<0&&g.realizedProfit>=0){remember(g,'firstRecovery',s,detail,g.realizedProfit,{realized:true});history(g,{...snapshot(s,detail,g.realizedProfit),kind:'recovery',realizedProfit:g.realizedProfit});}
   if(pnl>0&&p.cost>0&&pnl>=p.cost){adjust(g,{bigWinMemory:10});if(branch==='alt')firstKnown(g,'firstAltcoinBigWin',s,detail,pnl,{realized:true});}
  }
  if(payment&&flow>0&&branch==='scheme'){g.schemePayments++;g.schemePaid=add(g.schemePaid,flow);g.schemeFirstPaidDay??=now;g.schemeLastPaidDay=now;firstKnown(g,'firstSchemePayment',s,detail,flow,{realized:true});}
  if(branch==='scheme'&&!payment&&!failure&&g.memories.firstSchemeWarning&&!positions(s,'scheme').length)g.schemeExitedAfterWarning=true;
  if(liquidation){if(p.id&&p.entryPrice>0){const h=g.positionHistory[p.id]??={firstObservedDay:now,peakValue:p.value||0,peakReturnBps:0,minReturnBps:0,dipEntryValue:0};h.liquidation={positionId:p.id,day:now,underlying:String(p.instrument||p.underlying||'crypto'),entryPrice:p.entryPrice,direction:p.direction||'long',confirmed:Boolean(info.directionCorrect)};}g.liquidations++;g.largestLiquidation=Math.max(g.largestLiquidation,Math.max(0,-(pnl??0)));firstKnown(g,'firstLiquidation',s,detail,Math.max(0,-(pnl??0)),{realized:true});if(info.directionCorrect){g.correctLiquidations++;unlock(g,'right_direction',s);}}
  if(failure&&branch==='scheme'){g.schemeFailed=true;g.schemeLastPageBalance=money(info.lastPageBalance??p.bookBalance??p.value??0);if(g.schemePayments>=6&&g.schemeFirstPaidDay!==null&&(g.schemeLastPaidDay??now)-g.schemeFirstPaidDay>=150)unlock(g,'stable_income',s);}
 }
 if(info.schemeWarning)remember(g,'firstSchemeWarning',s,detail,p.value||0);
 g.totalTrades++;bs.trades++;g.lastTradeDay=Math.max(g.lastTradeDay??0,now);g.lastBehaviorDay=Math.max(g.lastBehaviorDay??0,now);
 history(g,{...snapshot(s,detail,buy?-flow:flow),kind:'trade',action,cashFlow:flow,pnl:pnl??0,realizedProfit:g.realizedProfit,positionId:String(p.id||''),directionCorrect:Boolean(info.directionCorrect),liquidation,overnightLoss:Boolean(liquidation&&(info.overnightLoss||g.positionHistory[p.id]?.peakReturnBps>=4200))});
 liveValue(s,g);if(!positions(s).length)g.emptySinceDay??=now;if(info.quit)markQuit(s,g,detail);return g;
}
function hasState(s,g,key,metrics){
 if(key&&typeof key==='object'){const value=key.memory?g.memories[key.memory]?.amount:key.tendency?g.tendencies[key.tendency]:key.metric?metrics[key.metric]:g[key.key];return key.min!==undefined?Number(value)>=key.min:key.max!==undefined?Number(value)<=key.max:value===key.value;}
 if(CRYPTO_STATUSES.includes(key))return g.status===key;
 if(key==='firstAltcoin')return Boolean(g.memories.firstAltcoin)||g.legacyBranches.includes('alt');
 if(key==='firstLeverage')return Boolean(g.memories.firstLeverage)||g.legacyBranches.includes('leverage');
 if(key==='firstScheme')return Boolean(g.memories.firstScheme)||g.legacyBranches.includes('scheme');
 if(CRYPTO_MEMORIES.includes(key))return Boolean(g.memories[key]);
 if(CRYPTO_TENDENCIES.includes(key))return g.tendencies[key]>0;
 const ps=positions(s),spot=positions(s,'spot'),alt=positions(s,'alt'),scheme=positions(s,'scheme'),perp=positions(s,'leverage');
 const ratio=(arr,min,max=Infinity)=>arr.some(p=>p.cost>0&&(p.value-p.cost)/p.cost>=min&&(p.value-p.cost)/p.cost<=max);
 const now=day(s),recentEmployment=kind=>(s.employment?.history||[]).some(h=>h.kind===kind&&Number.isSafeInteger(h.day)&&now>=h.day&&now-h.day<=180);
 if(['exposed','cryptoExposed','crypto_exposed'].includes(key))return g.exposed||Boolean(s.flags?.cryptoExposed||s.flags?.crypto_exposed);
 if(key==='firstSpotBuy')return g.branches.spot.buys>0||g.legacyBranches.includes('spot');
 if(key==='participated')return g.totalTrades>0||g.legacyImported;if(key==='neverBought')return !g.branches.spot.buys&&!g.legacyBranches.includes('spot');
 if(['spotHeld','spotHolding'].includes(key))return spot.length>0;if(key==='spotProfit20')return ratio(spot,.2);if(key==='spotDouble')return ratio(spot,1);if(key==='spotLoss30')return ratio(spot,-Infinity,-.3);
 if(key==='spotBreakeven')return spot.some(p=>p.cost>0&&p.value>=p.cost&&g.positionHistory[p.id]?.minReturnBps<=-1000);
 if(key==='bullMarket')return ['CLG','CHI'].some(id=>{const q=s.trading?.quotes?.[id],h=q?.history||[];return q?.price>0&&(h.length>1&&q.price>=h[Math.max(0,h.length-5)]*1.2||q.open>0&&q.price>=q.open*1.2);})||ps.filter(p=>['spot','alt'].includes(cryptoLifeBranch(p))).some(p=>p.cost>0&&p.value>=p.cost*1.2);
 if(['altcoinHeld','altHeld'].includes(key))return alt.length>0;if(key==='altcoinDouble')return ratio(alt,1);if(key==='altcoinExtremeLoss')return ratio(alt,-Infinity,-.9);
 if(key==='leverageHeld')return perp.length>0;if(key==='leverageSettledWin')return g.history.some(h=>h.kind==='trade'&&h.branch==='leverage'&&h.pnl>0);
 if(key==='leverageLiquidated')return g.liquidations>0;if(key==='directionCorrect')return g.correctLiquidations>0;if(key==='overnightLoss')return g.history.some(h=>h.kind==='trade'&&h.liquidation&&h.overnightLoss);
 if(key==='wageWin')return Boolean(cryptoWageWinReceipt(s));
 if(key==='cryptoHeld')return ps.length>0;if(key==='noCryptoHeld')return ps.length===0;
 if(key==='schemeHeld')return scheme.length>0;if(key==='schemePaidOnce')return scheme.length?scheme.some(p=>p.cryptoScheme?p.cryptoScheme.paymentCount>0:g.schemePayments>0):g.schemePayments>0;if(key==='schemePaidMany')return scheme.length?scheme.some(p=>p.cryptoScheme?p.cryptoScheme.paymentCount>=2:g.schemePayments>=2):g.schemePayments>=2;
 if(key==='schemeWarning')return scheme.some(p=>['warning','maintenance','silent','frozen'].includes(p.cryptoScheme?.status));
 if(key==='schemeMaintenance')return scheme.some(p=>['maintenance','frozen'].includes(p.cryptoScheme?.status));if(key==='schemeSilent')return scheme.some(p=>p.cryptoScheme?.status==='silent'||p.frozen);
 if(['exited','recovered'].includes(key))return g.status==='CRYPTO_EXITED';if(key==='quit')return ['QUIT','CRYPTO_EXITED'].includes(g.status);
 if(key==='cryptoExperienced')return g.legacyImported||g.exposedDay!==null&&now-g.exposedDay>=180;
 if(key==='yearsSinceQuit')return ['QUIT','CRYPTO_EXITED'].includes(g.status)&&(g.quitDay!==null&&now-g.quitDay>=720||g.emptySinceDay!==null&&now-Math.max(g.emptySinceDay,g.lastBehaviorDay??g.emptySinceDay)>=720);
 if(key==='schemeEscapedFailure')return g.schemeExitedAfterWarning&&g.schemeFailureConfirmed;
 if(key==='altcoinRally'){const q=s.trading?.quotes?.CHI,prices=q?.history||[];return Number.isFinite(q?.price)&&q.price>0&&(prices.length>1&&q.price>=prices[Math.max(0,prices.length-5)]*1.2||q.open>0&&q.price>=q.open*1.2);}
 if(key==='yearsSinceExposure')return g.exposedDay!==null&&now-g.exposedDay>=360;if(key==='knownForAWhile')return g.exposedDay!==null&&now-g.exposedDay>=180;
 if(['payday','lifeSalary'].includes(key)){const date=Date.parse(gameDate(s));return (s.payroll?.history||[]).some(h=>h.net>0&&date>=Date.parse(h.payday)&&date-Date.parse(h.payday)<=30*86400000);}
 if(['employed','lifeEmployed'].includes(key))return s.age>=18&&s.monthlyIncome>0&&!['退休','离职待业','大学生'].includes(s.occupation);
 if(['unemployed','lifeUnemployed'].includes(key))return s.age>=22&&s.monthlyIncome<=0&&(s.occupation==='离职待业'||recentEmployment('layoff')||recentEmployment('discharge')||recentEmployment('resign'));
 if(['recentPromotion','bonus'].includes(key))return recentEmployment(key==='bonus'?'bonus':'promotion')||(s.payroll?.history||[]).some(h=>h.bonus>0&&Date.parse(gameDate(s))-Date.parse(h.payday)<=30*86400000);
 if(['partner','lifeMarriage'].includes(key))return Boolean(s.household?.partner||s.flags?.partner||s.flags?.married||s.familyLife?.stage==='married');
 if(['home','lifeHome'].includes(key))return (s.positions||[]).some(p=>p.kind==='housing')||Boolean(s.flags?.house_purchase_plan||s.flags?.housing_plan);
 if(['child','lifeChild'].includes(key))return Boolean(s.household?.hasChild||s.household?.children?.length||s.family?.children?.length||s.flags?.has_child||s.flags?.child_born);
 if(['lifeGathering','friendGathering'].includes(key))return Boolean(s.flags?.friend_gathering||s.flags?.crypto_friend_reunion||s.studentStories?.friend||s.people?.friends?.length||s.stats?.social>0);
 if(key==='workTrouble')return recentEmployment('penalty')||recentEmployment('layoff')||recentEmployment('warning')||Boolean(s.flags?.work_trouble);
 if(key==='colleagueWin')return s.age>=18&&s.monthlyIncome>0&&!['退休','离职待业','大学生'].includes(s.occupation);
 if(key==='financialPressure')return (metrics.debt??debt(s))>0||(s.cash||0)<(metrics.monthlyExpense??180000);
 if(key==='debt')return (metrics.debt??debt(s))>0;if(key==='bankrupt')return (metrics.netWorth??assets(s)-debt(s))<=0;
 if(key==='realizedProfit')return g.realizedProfit>0;if(key==='realizedLoss')return g.realizedProfit<0;
 return Boolean(g[key]??s.flags?.[key]);
}
export function cryptoEventAllowed(s,event,metrics={}){
 if(event?.schemeLife)return schemeEventAllowed(s,event,metrics);
 const meta=event?.cryptoLife;if(!meta)return true;const g=cryptoLifeState(s),now=day(s),range=meta.ageStage||[event.age_min??18,event.age_max??80];
 if(s.age<18||s.age<range[0]||s.age>range[1]||s.legal?.prisonMonthsLeft>0||s.survival?.failed)return false;
 if(g.status==='CRYPTO_EXITED'&&!meta.memoryOnly&&!meta.allowRelapse&&!meta.allowAfterExit)return false;
 if(now<g.cooldownUntil)return false;
 for(const last of [g,s.behavior?.onlineGambling])if(last?.lastEventDay!==null&&last?.lastEventDay!==undefined&&(now-last.lastEventDay<Math.max(90,meta.minDelay??90)||ordinary(s)-(last.ordinaryAtLastEvent||0)<Math.max(2,meta.minOrdinaryEvents??2)))return false;
 const previous=g.eventLastDays[event.id];if(previous!==undefined&&(!(meta.repeatable??meta.repeat)||now-previous<Math.max(180,meta.cooldown??180)))return false;
 if(!(meta.requiredState||[]).every(k=>hasState(s,g,k,metrics))||(meta.blockedState||[]).some(k=>hasState(s,g,k,metrics)))return false;
 return true;
}
export function cryptoEventWeight(s,event,metrics={}){
 if(event?.schemeLife)return schemeEventWeight(s,event,metrics);
 const base=typeof metrics==='number'?metrics:event.cryptoLife?.weight??event.weight??10;if(typeof metrics==='number')metrics={};if(!cryptoEventAllowed(s,event,metrics))return 0;
 const g=cryptoLifeState(s),meta=event.cryptoLife;if(!meta)return base;let value=base;
 const tendencies=Array.isArray(meta.tendency)?meta.tendency:meta.tendency?[meta.tendency]:[];
 for(const t of tendencies)value*=1+(g.tendencies[t]||0)/40;for(const key of meta.memoryTrigger||[])if(g.memories[key])value*=1.45;
 if(meta.branch==='alt'&&g.branches.spot.realizedProfit>0)value*=1.3;if(meta.branch==='leverage'&&g.memories.firstAltcoinBigWin)value*=1.4;
 const childhood=s.studentStories?.traits,og=s.behavior?.onlineGambling;
 if(tendencies.includes('leveragePreference')||tendencies.includes('chasing'))value*=1+(childhood?.allIn||0)/150;
 if(tendencies.includes('chasing'))value*=1+(og?.tendencies?.chasing||0)/100;
 if(tendencies.includes('FOMO')){const lottery=s.behavior?.lottery;const won=Boolean(lottery?.memories?.firstBigWin||lottery?.bigWinMemory||s.flags?.lottery_big_win||s.flags?.lottery_jackpot);if(won)value*=1.35;}
 if(['QUIT','CRYPTO_EXITED'].includes(g.status))value*=meta.memoryOnly?1:g.status==='CRYPTO_EXITED'?.08:.25;
 value/=1+Math.min(g.refusals,8)*.12;return Math.max(0,value);
}
function stageEnding(s,g,metrics){
 const b=g.branches,held=positions(s),value=wealth(s),net=metrics.netWorth??assets(s)-debt(s),owed=metrics.debt??debt(s),participated=CRYPTO_BRANCHES.filter(k=>b[k].buys||g.legacyBranches.includes(k));
 if(!g.totalTrades&&!g.legacyImported)return null;
 const severe=-g.realizedProfit>=Math.max(10000,metrics.monthlyExpense||0,g.highestCryptoWealth*.25),ruin=net<=0&&severe;
 if(ruin&&g.everHighLeverage&&g.tendencies.chasing>0&&g.borrowed>0&&b.alt.buys&&b.scheme.buys&&owed>0)return 'bankruptcy';
 if(g.relapseCount>0&&g.relapseRaisedRisk&&g.history.some(h=>h.kind==='trade'&&h.day>=g.lastRelapseDay&&h.pnl>0)&&g.liquidations>0&&value===0&&g.relapseProfit<0)return 'bull_return';
 if(g.schemeFailureConfirmed&&g.schemeExitedAfterWarning)return 'escaped';
 if(g.schemeFailed&&g.achievements.stable_income)return 'stable_income';
 if(g.correctLiquidations>=2&&g.liquidations>=2&&b.leverage.realizedProfit<0)return 'right_direction';
 if(g.everHighLeverage&&g.largestLiquidation>=Math.max(100000,g.highestCryptoWealth*.5)&&value===0)return 'overnight_zero';
 if(g.everHighLeverage&&g.liquidations>0&&b.leverage.realizedProfit<0)return 'leverage_graduate';
 if(b.alt.peakReturnBps>=990000&&g.tendencies.FOMO>0&&b.alt.realizedProfit<0)return 'after_hundredfold';
 if(b.alt.peakWealth>=10000000&&wealth(s,'alt')+b.alt.returned<=b.alt.peakWealth*.4)return 'alt_king';
 if(g.status==='CRYPTO_EXITED'&&participated.length>=2)return 'graduated';
 if(['QUIT','CRYPTO_EXITED'].includes(g.status)&&!held.length&&g.realizedProfit>0)return 'walked_away';
 if(participated.length===1&&participated[0]==='spot'&&held.length){const first=g.memories.firstCryptoBuy?.day;if(first!==undefined&&day(s)-first>=1800)return b.spot.buys===1&&b.spot.invested<=100000?'forgotten':'holder';}
 return null;
}
export function cryptoLifeSummary(s,metrics={}){
 const g=cryptoLifeState(s),id=stageEnding(s,g,metrics),ending=CRYPTO_ENDINGS.find(e=>e.id===id)||null,finalCryptoWealth=wealth(s),closed=g.contractWins+g.contractLosses;
 const keyRows=g.history.filter(h=>h.exitOpportunity||['quit','relapse','recovery','exited','borrow'].includes(h.kind)||h.liquidation),points=keyRows.length<=8?keyRows:Array.from({length:8},(_,i)=>keyRows[Math.floor(i*(keyRows.length-1)/7)]);
 const branches=Object.fromEntries(CRYPTO_BRANCHES.map(b=>[b,{...g.branches[b],currentWealth:wealth(s,b),currentCost:cost(s,b),unrealizedProfit:wealth(s,b)-cost(s,b)}]));
 return {status:g.status,ending,exposed:g.exposed,invested:g.invested,returned:g.returned,withdrawn:g.returned,realizedProfit:g.realizedProfit,netProfit:g.realizedProfit,netLoss:Math.max(0,-g.realizedProfit),highestRealizedProfit:g.highestRealizedProfit,highestCryptoWealth:Math.max(g.highestCryptoWealth,finalCryptoWealth),peakAssets:g.highestCryptoWealth,unrealizedProfit:finalCryptoWealth-cost(s),finalCryptoWealth,finalAssets:metrics.assets??assets(s),finalDebt:metrics.debt??debt(s),totalTrades:g.totalTrades,contractWins:g.contractWins,contractLosses:g.contractLosses,contractWinRate:closed?g.contractWins/closed:0,liquidations:g.liquidations,schemeLastPageBalance:g.schemeLastPageBalance,branches,memories:g.memories,firstBuyAge:g.memories.firstCryptoBuy?.age??null,quitCount:g.quitCount,longestQuit:Math.max(g.longestQuit,g.emptySinceDay===null?0:day(s)-Math.max(g.emptySinceDay,g.lastBehaviorDay??g.emptySinceDay)),relapseCount:g.relapseCount,exitOpportunities:g.exitOpportunities,points,achievements:CRYPTO_ACHIEVEMENTS.filter(a=>g.achievements[a.id]).map(a=>({...a,...g.achievements[a.id]})),legacyImported:g.legacyImported};
}
export function validateCryptoLife(s){
 const g=ensureCryptoLife(s),bad=()=>{throw Error('存档中的Crypto人生记忆无效');},int=(n,min=0,max=MAX)=>{if(!Number.isSafeInteger(n)||n<min||n>max)bad();};
 if(!g||typeof g!=='object'||Array.isArray(g)||g.version!==1||!CRYPTO_STATUSES.includes(g.status))bad();
 for(const k of ['exposed','altcoinExposed','leverageExposed','schemeExposed','legacyImported','highLeverage','everHighLeverage','leverageClosed','leverageReducedAfterLiquidation','schemeFailed','schemeExitedAfterWarning','schemeFailureConfirmed','quitIntent','relapseRaisedRisk'])if(typeof g[k]!=='boolean')bad();
 for(const k of ['invested','returned','highestCryptoWealth','highestRealizedProfit','totalTrades','contractWins','contractLosses','liquidations','correctLiquidations','largestLiquidation','highLeverageChoices','dipBuys','theoryChanges','schemePayments','schemePaid','schemeLastPageBalance','quitCount','longestQuit','relapseCount','refusals','cooldownUntil','ordinaryAtLastEvent','borrowed','exitOpportunities'])int(g[k]);
 for(const k of ['realizedProfit','relapseProfit'])int(g[k],-MAX);
 if(!['low','medium','high','extreme'].includes(g.preferredLeverage))bad();
 for(const k of ['exposedDay','schemeFirstPaidDay','schemeLastPaidDay','quitDay','exitedDay','lastRelapseDay','lastEventDay','lastTradeDay','lastBehaviorDay','emptySinceDay'])if(g[k]!==null)int(g[k],0,day(s));
 if(!g.branches||!g.tendencies||!g.memories||!g.eventCounts||!g.eventLastDays||!g.achievements||!g.positionHistory)bad();
 for(const k of CRYPTO_TENDENCIES)int(g.tendencies[k],0,100);
 for(const b of CRYPTO_BRANCHES){const v=g.branches[b];if(!v)bad();for(const k of ['invested','returned','trades','buys','sells','peakWealth','peakUnrealizedProfit','peakReturnBps'])int(v[k]);int(v.realizedProfit,-MAX);if(v.buys+v.sells>v.trades)bad();}
 for(const [total,key]of [['invested','invested'],['returned','returned'],['realizedProfit','realizedProfit'],['totalTrades','trades']])if(g[total]!==sum(CRYPTO_BRANCHES.map(b=>g.branches[b][key])))bad();
 if(g.contractWins+g.contractLosses>g.branches.leverage.sells||g.liquidations>g.branches.leverage.sells||g.correctLiquidations>g.liquidations||g.ordinaryAtLastEvent>ordinary(s)||g.highestRealizedProfit<Math.max(0,g.realizedProfit))bad();
 const point=h=>{if(!h||typeof h!=='object'||!Number.isFinite(h.age)||h.age<18||h.age>age(s)+.01||typeof h.eventId!=='string'||h.eventId.length>100||typeof h.choice!=='string'||h.choice.length>400||!(h.branch===null||CRYPTO_BRANCHES.includes(h.branch)))bad();int(h.day,0,day(s));int(h.amount,-MAX);};
 for(const k of CRYPTO_MEMORIES)if(g.memories[k]!==null)point(g.memories[k]);
 if(!Array.isArray(g.history)||g.history.length>240)bad();for(const h of g.history){point(h);if(!['trade','event','quit','relapse','recovery','exited','borrow'].includes(h.kind))bad();int(h.realizedProfit,-MAX);if(h.cashFlow!==undefined)int(h.cashFlow,-MAX);if(h.pnl!==undefined)int(h.pnl,-MAX);}
 for(const [id,n]of Object.entries(g.eventCounts)){if(!id||id.length>100)bad();int(n,1);int(g.eventLastDays[id],0,day(s));}
 if(!Array.isArray(g.legacyBranches)||g.legacyBranches.some(b=>!CRYPTO_BRANCHES.includes(b)))bad();
 for(const [id,a]of Object.entries(g.achievements)){if(!CRYPTO_ACHIEVEMENTS.some(x=>x.id===id)||!Number.isFinite(a.age)||a.age<18||a.age>age(s)+.01)bad();int(a.day,0,day(s));}
 for(const p of Object.values(g.positionHistory)){int(p.firstObservedDay,0,day(s));int(p.peakValue);int(p.peakReturnBps);int(p.dipEntryValue);if(p.minReturnBps!==undefined)int(p.minReturnBps,-10000);if(p.liquidation){const q=p.liquidation;int(q.day,0,day(s));int(q.entryPrice,1);if(typeof q.underlying!=='string'||!['long','short'].includes(q.direction)||typeof q.confirmed!=='boolean')bad();}}
 if(g.status==='CRYPTO_EXITED'&&positions(s).length)bad();return g;
}
