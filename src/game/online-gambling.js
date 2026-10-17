/** Long-lived gambling memories. Cash, loans, RNG and event queues stay in the existing engine. */
import {gameDate} from './game-calendar.js';
export const ONLINE_TENDENCIES=['chasing','confidence','casualGambling','guruDependence','patternBelief','bigWinMemory'];
export const ONLINE_MEMORIES=['firstBet','firstWin','firstBigWin','firstLoss','firstChase','firstBorrow','firstRecovery','highestProfit','firstDebt','firstQuit','firstRelapse'];
export const ONLINE_STATUSES=['UNEXPOSED','EXPOSED','ACTIVE','QUIT','RECOVERED'];
export const ONLINE_ENDINGS=[
 ['unopened','没点开的链接'],['lesson','几十块买来的教训'],['walked_away','拿钱走人'],['casual','娱乐玩家'],['luck','把运气当成运气'],['recovered','上岸'],['back_and_forth','反复横跳'],['winning_then_ruin','赢了，但没走'],['after_recovery','回本以后'],['theorist','理论大师'],['guru','老师毕业了'],['debt_cycle','债务循环'],['bankruptcy','爆仓破产'],
].map(([id,title])=>({id,title}));
const MAX=Number.MAX_SAFE_INTEGER;
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
const day=s=>s.debtClock?.day||0;
const age=s=>Math.round(((s.age||18)+(s.debtClock?.periodDays||0)/360)*100)/100;
const sum=a=>a.reduce((x,y)=>x+y,0);
const debt=s=>sum((s.debts||[]).map(d=>(d.principal||0)+(d.interest||0)));
const assets=s=>(s.cash||0)+sum((s.positions||[]).map(p=>p.value||0))+sum((s.businesses||[]).map(p=>p.value||0))+sum((s.claims||[]).map(p=>p.value||0));
const amount=n=>{if(!Number.isSafeInteger(n)||n<0)throw Error('网赌记忆金额无效');return n;};
const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error('网赌记忆账目超出范围');return n;};

export function newOnlineGambling(){return {version:1,status:'UNEXPOSED',exposed:false,exposedDay:null,tendencies:Object.fromEntries(ONLINE_TENDENCIES.map(k=>[k,0])),memories:Object.fromEntries(ONLINE_MEMORIES.map(k=>[k,null])),totalBets:0,staked:0,returned:0,freeCredit:0,bonusClaimed:false,netProfit:0,highestProfit:0,peakAssets:0,largestStake:0,lastStake:0,lastNet:0,lastBetDay:null,firstOutcome:null,losses:0,wins:0,escalations:0,borrowCount:0,borrowed:0,borrowDebtIds:[],quitCount:0,quitDay:null,longestQuit:0,relapseCount:0,refusals:0,quitRefusals:0,quitDebt:0,borrowedAtQuit:0,cooldownUntil:0,recoveredDay:null,lastEventDay:null,ordinaryEvents:0,ordinaryAtLastEvent:0,ordinaryKeys:[],eventCounts:{},eventLastDays:{},exitOpportunities:0,history:[],legacyImported:false};}
/** Read-only selectors must never migrate saves or consume randomness. */
export function onlineGamblingState(s){return s.behavior?.onlineGambling||newOnlineGambling();}
export function ensureOnlineGambling(s){
 s.behavior??={};if(s.behavior.onlineGambling)return s.behavior.onlineGambling;
 const g=s.behavior.onlineGambling=newOnlineGambling(),old=s.trading?.gambling;
 if(s.flags?.gambling_exposed){g.exposed=true;g.status='EXPOSED';}
 if(old?.rounds){
  g.legacyImported=true;g.totalBets=old.rounds;g.staked=old.staked||0;g.returned=old.returned||0;g.netProfit=g.returned-g.staked;g.highestProfit=Math.max(0,g.netProfit);g.largestStake=old.house?.largestStake||0;g.peakAssets=assets(s);g.exposed=true;g.status=s.flags?.gambling_quit?'QUIT':'ACTIVE';
  // Old receipts do not reliably contain life dates. Never invent first-bet ages.
  if(g.status==='QUIT'){g.quitDay=day(s);g.quitCount=1;g.quitDebt=debt(s);g.cooldownUntil=day(s)+180;}
 }
 return g;
}
function snapshot(s,info={},value=0){return {age:age(s),day:day(s),amount:value,eventId:String(info.eventId||info.source||''),choice:String(info.choice||'')};}
function remember(g,key,s,info,value=0){if(!g.memories[key])g.memories[key]=snapshot(s,info,value);}
function keepHistory(g,row){g.history.push(row);if(g.history.length>240){const disposable=g.history.findIndex(h=>h.kind==='bet'&&!h.borrowed&&!['guru','model'].includes(h.action));g.history.splice(disposable>=0?disposable:1,1);}}
export function adjustOnlineTendencies(s,delta={}){const g=ensureOnlineGambling(s);for(const [key,value]of Object.entries(delta)){if(!ONLINE_TENDENCIES.includes(key)||!Number.isFinite(value))throw Error('网赌倾向无效');g.tendencies[key]=clamp(g.tendencies[key]+value);}return g;}
export function recordOnlineExposure(s,choice='look'){
 const g=ensureOnlineGambling(s);g.exposed=true;g.exposedDay??=day(s);if(g.status==='UNEXPOSED')g.status='EXPOSED';s.flags??={};s.flags.onlineGamblingExposed=true;s.flags.gambling_exposed=true;
 if(['look','curious','A'].includes(choice))adjustOnlineTendencies(s,{confidence:2});
 if(['leave','decline','D'].includes(choice))g.cooldownUntil=Math.max(g.cooldownUntil,day(s)+180);
 return g;
}
export function recordOnlineBet(s,info={},metrics={}){
 const stake=amount(info.stake||0),returned=amount(info.returned||0),credit=amount(info.freeCredit||0);if(!stake&&!credit)throw Error('网赌记忆缺少实际赌资');
 const g=ensureOnlineGambling(s),previousNet=g.netProfit,previousStake=g.lastStake,now=day(s);
 if(g.status==='RECOVERED')throw Error('已经上岸，旧事只作回忆，不再下注');
 if(credit&&g.bonusClaimed)throw Error('试玩赠金已经使用，不会重复发放');
 if(['QUIT','RECOVERED'].includes(g.status)){
  const elapsed=g.quitDay===null?0:Math.max(0,now-g.quitDay);g.longestQuit=Math.max(g.longestQuit,elapsed);g.relapseCount++;remember(g,'firstRelapse',s,info,stake);keepHistory(g,{...snapshot(s,info,stake),kind:'relapse',quitDays:elapsed,netProfit:previousNet});
 }
 g.exposed=true;g.exposedDay??=now;g.status='ACTIVE';g.quitDay=null;g.recoveredDay=null;g.quitRefusals=0;
 g.totalBets++;g.staked=add(g.staked,stake);g.returned=add(g.returned,returned);g.freeCredit=add(g.freeCredit,credit);if(credit)g.bonusClaimed=true;g.netProfit=g.returned-g.staked;
 const net=returned-stake,gameNet=net-credit;g.lastStake=stake;g.lastNet=gameNet;g.lastBetDay=now;g.largestStake=Math.max(g.largestStake,stake);g.peakAssets=Math.max(g.peakAssets,metrics.assets??assets(s));
 if(g.totalBets===1){remember(g,'firstBet',s,info,stake+credit);g.firstOutcome=gameNet>0?'win':gameNet<0?'loss':'tie';}
 if(gameNet>0){g.wins++;if(!g.legacyImported)remember(g,'firstWin',s,info,gameNet);adjustOnlineTendencies(s,{confidence:3});}else if(gameNet<0){g.losses++;if(!g.legacyImported)remember(g,'firstLoss',s,info,-gameNet);}
 if(gameNet>0&&(info.bigWin===true||(gameNet>=100000&&gameNet>=Math.max(1,stake+credit)*3))){if(!g.legacyImported)remember(g,'firstBigWin',s,info,gameNet);adjustOnlineTendencies(s,{bigWinMemory:20,confidence:8});}
 if(g.netProfit>g.highestProfit){g.highestProfit=g.netProfit;g.memories.highestProfit=snapshot(s,info,g.netProfit);}
 if(stake>previousStake*1.5&&previousStake>0)g.escalations++;
 if(info.chasing||previousNet<0&&stake>previousStake&&previousStake>0){remember(g,'firstChase',s,info,stake);adjustOnlineTendencies(s,{chasing:8});}
 if(previousNet<0&&g.netProfit>=0){remember(g,'firstRecovery',s,info,g.netProfit);if(g.tendencies.chasing)adjustOnlineTendencies(s,{chasing:5,confidence:5});keepHistory(g,{...snapshot(s,info,g.netProfit),kind:'recovery',netProfit:g.netProfit});}
 if(info.borrowed&&!g.memories.firstBorrow)remember(g,'firstBorrow',s,info,typeof info.borrowed==='number'?info.borrowed:stake);
 if(info.tendencies)adjustOnlineTendencies(s,info.tendencies);
 keepHistory(g,{...snapshot(s,info,net),kind:'bet',stake,returned,freeCredit:credit,gameNet,action:String(info.action||''),borrowed:amount(typeof info.borrowed==='number'?info.borrowed:info.borrowed?stake:0),netProfit:g.netProfit});return g;
}
/** Call only after an explicitly gambling-related loan has really been issued. */
export function recordOnlineBorrow(s,info={},metrics={}){
 const value=amount(info.amount||0);if(!value)return ensureOnlineGambling(s);const g=ensureOnlineGambling(s);
 if(g.status==='RECOVERED')throw Error('已经上岸，不再为参赌借款');
 g.borrowCount++;g.borrowed=add(g.borrowed,value);remember(g,'firstBorrow',s,info,value);remember(g,'firstDebt',s,info,value);if(info.debtId&&!g.borrowDebtIds.includes(info.debtId))g.borrowDebtIds.push(String(info.debtId));
 adjustOnlineTendencies(s,{chasing:8});keepHistory(g,{...snapshot(s,info,value),kind:'borrow',netProfit:g.netProfit});return g;
}
export function recordOnlineQuit(s,info={},metrics={}){
 const g=ensureOnlineGambling(s);if(!g.totalBets){g.refusals++;g.cooldownUntil=Math.max(g.cooldownUntil,day(s)+180);return g;}
 if(!['QUIT','RECOVERED'].includes(g.status)){g.quitCount++;g.quitDay=day(s);g.quitDebt=metrics.debt??debt(s);g.borrowedAtQuit=g.borrowed;g.quitRefusals=0;g.status='QUIT';remember(g,'firstQuit',s,info,g.netProfit);keepHistory(g,{...snapshot(s,info,g.netProfit),kind:'quit',netProfit:g.netProfit});}
 g.cooldownUntil=Math.max(g.cooldownUntil,day(s)+180);return g;
}
export function recordOnlineRefusal(s,info={},metrics={}){
 const g=ensureOnlineGambling(s);g.refusals++;if(['QUIT','RECOVERED'].includes(g.status))g.quitRefusals++;
 g.cooldownUntil=Math.max(g.cooldownUntil,day(s)+(g.status==='RECOVERED'?720:180));keepHistory(g,{...snapshot(s,info,g.netProfit),kind:'refusal',netProfit:g.netProfit});return advanceOnlineGambling(s,metrics);
}
export function recordOnlineOrdinaryEvent(s,event={}){
 if(event.onlineGambling||event.cryptoLife)return ensureOnlineGambling(s);const g=ensureOnlineGambling(s),id=String(event.eventId||event.id||event.kind||'life');
 const key=`${day(s)}:${s.turn||0}:${id}`;if(g.ordinaryKeys.includes(key))return g;g.ordinaryEvents++;g.ordinaryKeys.push(key);g.ordinaryKeys=g.ordinaryKeys.slice(-80);return g;
}
export function recordOnlineEvent(s,info={}){
 const g=ensureOnlineGambling(s),id=String(info.eventId||info.id||'');if(!id)throw Error('网赌事件记忆缺少编号');
 g.eventCounts[id]=(g.eventCounts[id]||0)+1;g.eventLastDays[id]=day(s);g.lastEventDay=day(s);g.ordinaryAtLastEvent=g.ordinaryEvents;
 if(info.exitOpportunity)g.exitOpportunities++;
 keepHistory(g,{...snapshot(s,info,g.netProfit),kind:'event',netProfit:g.netProfit,exitOpportunity:Boolean(info.exitOpportunity),count:g.eventCounts[id]});return g;
}
export function advanceOnlineGambling(s,metrics={}){
 const g=ensureOnlineGambling(s);g.peakAssets=Math.max(g.peakAssets,metrics.assets??assets(s));if(g.quitDay===null)return g;
 const elapsed=Math.max(0,day(s)-g.quitDay);g.longestQuit=Math.max(g.longestQuit,elapsed);
 const owed=metrics.debt??debt(s),mainDebtRepaid=owed<=Math.floor(g.quitDebt*.2),noNewGamblingDebt=g.borrowed===g.borrowedAtQuit;
 if(g.status==='QUIT'&&elapsed>=720&&g.quitRefusals>=2&&mainDebtRepaid&&noNewGamblingDebt){g.status='RECOVERED';g.recoveredDay=day(s);keepHistory(g,{...snapshot(s,{source:'recovered'},g.netProfit),kind:'recovered',netProfit:g.netProfit});}
 return g;
}
function hasState(s,g,key,metrics){
 if(typeof key==='object'&&key){const value=key.memory?g.memories[key.memory]?.amount:key.tendency?g.tendencies[key.tendency]:g[key.key];return key.min!==undefined?Number(value)>=key.min:key.max!==undefined?Number(value)<=key.max:value===key.value;}
 if(ONLINE_STATUSES.includes(key))return g.status===key;
 if(['exposed','onlineGamblingExposed','gambling_exposed'].includes(key))return g.exposed||Boolean(s.flags?.gambling_exposed);
 if(key==='participated')return g.totalBets>0;if(key==='neverBet')return g.totalBets===0;
 if(key==='lastWin')return g.lastNet>0;if(key==='lastLoss')return g.lastNet<0;
 if(key==='partner')return Boolean(s.household?.partner||s.flags?.partner);
 if(key==='employed')return s.age>=22&&s.monthlyIncome>0&&!['退休','离职待业','大学生'].includes(s.occupation);
 if(key==='payday'){const now=Date.parse(gameDate(s));return(s.payroll?.history||[]).some(h=>h.net>0&&now>=Date.parse(h.payday)&&now-Date.parse(h.payday)<=30*86400000);}
 if(key==='recentPromotion')return(s.employment?.history||[]).some(h=>h.kind==='promotion'&&day(s)>=h.day&&day(s)-h.day<=180);
 if(key==='rentDue'){const due=s.household?.rentDueDay??s.livingPlan?.rentDueDay;return Number.isSafeInteger(due)&&due>=day(s)&&due-day(s)<=3;}
 if(key==='financialPressure')return (metrics.debt??debt(s))>0||(s.cash||0)<(metrics.monthlyExpense??180000);
 if(key==='livingPressure')return s.age>=18&&(s.cash||0)<Math.ceil((metrics.monthlyExpense??(s.age<22?180000:300000))/30)*3;
 if(key==='yearsSinceExposure'){const since=g.memories.firstBet?.day??g.exposedDay;return since!==null&&day(s)-since>=1800;}
 if(key==='debt')return (metrics.debt??debt(s))>0;if(key==='bankrupt')return (metrics.netWorth??assets(s)-debt(s))<=0;
 if(key==='guruGone')return Boolean(s.flags?.online_guru_gone);
 if(['lastGuruWin','lastModelWin','lastModelLoss'].includes(key)){const action=key==='lastGuruWin'?'guru':'model',h=g.history.findLast(h=>h.kind==='bet'&&h.action===action),net=h?.gameNet??h?.amount;return Boolean(h)&&(key==='lastModelLoss'?net<0:net>0);}
 if(key==='borrowedWin')return g.history.some(h=>h.kind==='bet'&&h.borrowed>0&&(h.gameNet??h.amount)>0);
 // Legacy totals establish participation, while new receipts establish wins/losses.
 // Unknown old first dates stay null, but must not lock the whole future event pool.
 if(key==='firstBet')return g.totalBets>0;
 if(key==='firstWin')return Boolean(g.memories.firstWin)||g.wins>0;
 if(key==='firstLoss')return Boolean(g.memories.firstLoss)||g.losses>0;
 if(key==='firstBigWin')return Boolean(g.memories.firstBigWin)||g.tendencies.bigWinMemory>0;
 if(ONLINE_MEMORIES.includes(key))return Boolean(g.memories[key]);if(ONLINE_TENDENCIES.includes(key))return g.tendencies[key]>0;
 return Boolean(g[key]??s.flags?.[key]);
}
export function onlineEventAllowed(s,event,metrics={}){
 const meta=event?.onlineGambling;if(!meta)return true;const g=onlineGamblingState(s),now=day(s),range=meta.ageStage||[event.age_min??18,event.age_max??80];
 if(s.age<range[0]||s.age>range[1]||s.age<18||s.legal?.prisonMonthsLeft>0||s.survival?.failed)return false;
 if(g.status==='RECOVERED'&&!['OG26','OG27'].includes(event.id))return false;
 const c=s.behavior?.cryptoLife;if(c?.lastEventDay!=null&&(now-c.lastEventDay<90||g.ordinaryEvents-c.ordinaryAtLastEvent<2))return false;
 if(now<g.cooldownUntil)return false;
 if(g.lastEventDay!==null&&(now-g.lastEventDay<Math.max(60,meta.minDelay??60)||g.ordinaryEvents-g.ordinaryAtLastEvent<Math.max(2,meta.minOrdinaryEvents??2)))return false;
 const last=g.eventLastDays[event.id];if(last!==undefined&&(!(meta.repeatable??meta.repeat)||now-last<Math.max(60,meta.cooldown??180)))return false;
 if(!(meta.requiredState||[]).every(key=>hasState(s,g,key,metrics))||(meta.blockedState||[]).some(key=>hasState(s,g,key,metrics)))return false;
 return true;
}
export function onlineEventWeight(s,event,metrics={}){
 const base=typeof metrics==='number'?metrics:event.onlineGambling?.weight??event.weight??10;if(typeof metrics==='number')metrics={};if(!onlineEventAllowed(s,event,metrics))return 0;
 const g=onlineGamblingState(s),meta=event.onlineGambling;if(!meta)return base;let value=base;
 const tendencies=Array.isArray(meta.tendency)?meta.tendency:meta.tendency?[meta.tendency]:[];
 for(const key of tendencies)value*=1+(g.tendencies[key]||0)/40;
 for(const key of meta.memoryTrigger||[])if(g.memories[key])value*=1.45;
 if(['QUIT','RECOVERED'].includes(g.status))value*=g.status==='RECOVERED'?.08:.22;
 if(g.refusals)value/=1+Math.min(g.refusals,8)*.18;
 const crypto=s.behavior?.cryptoLife;if(crypto?.memories?.firstAltcoinBigWin||crypto?.tendencies?.bigWinMemory>0)value*=1.12;
 const childhood=s.studentStories?.traits;if(childhood&&tendencies.includes('chasing'))value*=1+(childhood.chasing||0)/150;
 if(childhood&&tendencies.includes('patternBelief'))value*=1+(childhood.analysis||0)/180;
 return Math.max(0,value);
}
/** Reweights authored outcomes without making any win or loss inevitable. */
export function onlineChoiceWeight(s,{action='',variant=''}={},baseWeight=1){
 if(!Number.isFinite(baseWeight)||baseWeight<0)throw Error('网赌结果权重无效');const t=onlineGamblingState(s).tendencies;
 if(['big_loss','loss','zero'].includes(variant))return baseWeight*(1+(['chase','allin','borrow'].includes(action)?(t.chasing+t.confidence)/300:0));
 if(['win','big_win','recovery'].includes(variant))return baseWeight*(1+(['research','model'].includes(action)?Math.min(t.patternBelief,20)/200:0));return baseWeight;
}
function stageEnding(s,g,metrics){
 const stopped=['QUIT','RECOVERED'].includes(g.status),net=metrics.netWorth??assets(s)-debt(s),owed=metrics.debt??debt(s),serious=g.borrowCount>0||g.tendencies.chasing>=20||(g.losses>=5&&g.escalations>=2);
 const casual=g.totalBets>=3&&g.escalations===0&&g.borrowCount===0&&g.largestStake<=50000;
 if(!g.totalBets)return 'unopened';
 if(stopped&&g.staked===0&&g.returned===0)return null;
 if(stopped){if(serious&&g.status!=='RECOVERED')return null;if(g.relapseCount>=2&&g.status==='RECOVERED')return 'back_and_forth';if(serious&&g.status==='RECOVERED')return 'recovered';if(g.memories.firstBigWin||g.tendencies.bigWinMemory)return 'luck';if(casual)return 'casual';if(g.totalBets===1&&g.firstOutcome==='loss'&&g.netProfit<0)return 'lesson';if(g.netProfit>0)return 'walked_away';if(!serious)return g.firstOutcome==='loss'?'lesson':'walked_away';return null;}
 // Financial trouble alone is not a gambling ending: actual losses and escalation must match.
 const materialLoss=-g.netProfit>=Math.max(1,metrics.monthlyExpense||0,g.peakAssets*.25);
 const ruin=net<=0&&materialLoss&&(g.escalations>0||g.borrowCount>0||g.totalBets>=3);
 if(ruin){if(g.memories.firstRecovery)return 'after_recovery';if(g.highestProfit>0&&g.escalations>=2)return 'winning_then_ruin';if(g.tendencies.patternBelief>=30)return 'theorist';if(g.tendencies.guruDependence>=30&&s.flags?.online_guru_gone)return 'guru';if(g.borrowCount>=2&&owed>0)return 'debt_cycle';return 'bankruptcy';}
 if(g.tendencies.guruDependence>=30&&s.flags?.online_guru_gone&&g.netProfit<0)return 'guru';
 if(g.borrowCount>=2&&owed>0&&g.netProfit<0)return 'debt_cycle';
 if(casual)return 'casual';return null;
}
export function onlineGamblingSummary(s,metrics={}){
 const g=onlineGamblingState(s),id=stageEnding(s,g,metrics),ending=ONLINE_ENDINGS.find(e=>e.id===id)||null,longestQuit=Math.max(g.longestQuit,g.quitDay===null?0:Math.max(0,day(s)-g.quitDay));
 const keyHistory=g.history.filter(h=>h.exitOpportunity||['borrow','quit','relapse','recovery','recovered'].includes(h.kind));
 // Retain events from across a whole life, rather than showing only the final few decisions.
 const points=keyHistory.length<=6?keyHistory:Array.from({length:6},(_,i)=>keyHistory[Math.floor(i*(keyHistory.length-1)/5)]);
 return {status:g.status,ending,exposed:g.exposed,totalBets:g.totalBets,staked:g.staked,freeCredit:g.freeCredit,withdrawn:g.returned,returned:g.returned,netProfit:g.netProfit,netLoss:Math.max(0,-g.netProfit),highestProfit:g.highestProfit,peakAssets:Math.max(g.peakAssets,metrics.assets??assets(s)),finalAssets:metrics.assets??assets(s),finalDebt:metrics.debt??debt(s),firstBetAge:g.memories.firstBet?.age??null,firstBigWin:g.memories.firstBigWin,firstBorrow:g.memories.firstBorrow,quitCount:g.quitCount,longestQuit,relapseCount:g.relapseCount,exitOpportunities:g.exitOpportunities,points,legacyImported:g.legacyImported};
}

export function validateOnlineGambling(s){
 const g=ensureOnlineGambling(s),bad=()=>{throw Error('存档中的网赌人生记忆无效');},int=(n,min=0,max=MAX)=>{if(!Number.isSafeInteger(n)||n<min||n>max)bad();};
 if(!g||typeof g!=='object'||Array.isArray(g)||g.version!==1||!ONLINE_STATUSES.includes(g.status))bad();
 for(const k of ['exposed','legacyImported','bonusClaimed'])if(typeof g[k]!=='boolean')bad();
 if(!g.tendencies||!g.memories||!g.eventCounts||!g.eventLastDays)bad();for(const k of ONLINE_TENDENCIES)int(g.tendencies[k],0,100);
 for(const k of ['totalBets','staked','returned','freeCredit','highestProfit','peakAssets','largestStake','lastStake','losses','wins','escalations','borrowCount','borrowed','quitCount','longestQuit','relapseCount','refusals','quitRefusals','quitDebt','borrowedAtQuit','cooldownUntil','ordinaryEvents','ordinaryAtLastEvent','exitOpportunities'])int(g[k]);
 for(const k of ['netProfit','lastNet'])int(g[k],-MAX);
 if(g.netProfit!==g.returned-g.staked||g.lastStake>g.largestStake||g.largestStake>g.staked||g.ordinaryAtLastEvent>g.ordinaryEvents||g.highestProfit<Math.max(0,g.netProfit)||g.borrowedAtQuit>g.borrowed)bad();
 for(const k of ['exposedDay','lastBetDay','quitDay','recoveredDay','lastEventDay'])if(g[k]!==null)int(g[k],0,day(s));
 if(![null,'win','loss','tie'].includes(g.firstOutcome))bad();
 const point=h=>{if(!h||typeof h!=='object'||!Number.isFinite(h.age)||h.age<18||h.age>age(s)+.01||typeof h.eventId!=='string'||h.eventId.length>100||typeof h.choice!=='string'||h.choice.length>400)bad();int(h.day,0,day(s));int(h.amount,-MAX);};
 for(const k of ONLINE_MEMORIES)if(g.memories[k]!==null)point(g.memories[k]);
 if(!Array.isArray(g.history)||g.history.length>240)bad();for(const h of g.history){point(h);if(!['bet','borrow','event','quit','refusal','relapse','recovery','recovered'].includes(h.kind))bad();int(h.netProfit,-MAX);if(h.stake!==undefined)int(h.stake);if(h.returned!==undefined)int(h.returned);if(h.borrowed!==undefined)int(h.borrowed);if(h.action!==undefined&&(typeof h.action!=='string'||h.action.length>80))bad();if(h.gameNet!==undefined)int(h.gameNet,-MAX);}
 for(const [k,n]of Object.entries(g.eventCounts)){if(!k||k.length>100)bad();int(n,1);int(g.eventLastDays[k],0,day(s));}
 if(!Array.isArray(g.borrowDebtIds)||g.borrowDebtIds.length>500||g.borrowDebtIds.some(x=>typeof x!=='string'||x.length>100)||new Set(g.borrowDebtIds).size!==g.borrowDebtIds.length)bad();
 if(!Array.isArray(g.ordinaryKeys)||g.ordinaryKeys.length>80||g.ordinaryKeys.some(x=>typeof x!=='string'||x.length>200))bad();
 return g;
}
