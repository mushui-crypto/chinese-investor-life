import {schemeStoryPresentation,schemeStoryChoice,recordSchemeStory} from './scheme-life-stories.js';
import {cryptoLifeState,cryptoEventAllowed,recordCryptoLifeEvent,cryptoWageWinReceipt} from './crypto-life.js';
import {cryptoLifeActionPreview,cryptoLifePositionSummary} from './crypto-life-finance.js';

// Stories observe prices and settled receipts. Rendering never draws RNG or invents returns.
export const CRYPTO_LIFE_EVENT_IDS=Array.from({length:42},(_,i)=>`CL${String(i+1).padStart(2,'0')}`);
export const LEGACY_SCHEME_STORY_IDS=['AGE24A',...Array.from({length:8},(_,i)=>`PON${String(i+1).padStart(2,'0')}`)];
const money=n=>`¥${((n||0)/100).toLocaleString('zh-CN',{maximumFractionDigits:2})}`;
const pct=n=>`${n>=0?'+':''}${(n/100).toFixed(1)}%`;
const sum=xs=>xs.reduce((n,x)=>n+x,0);
const EXPOSURE=new Set(['CL01','CL08','CL13','CL22']);
const NEW_RISK=new Set(['buy','add','alt_buy','dip_buy','leverage_open','scheme_join','scheme_add']);
const FINANCIAL=new Set([...NEW_RISK,'sell','principal','quit','reduce','permanent_close','exit_all','scheme_withdraw','repay','borrow']);
const EXIT=new Set(['sell','quit','reduce','permanent_close','exit_all','scheme_withdraw','refuse','remember','acknowledge']);
const TENDENCIES={inspect:{analysis:6},ambition:{greed:6,confidence:5},confidence:{confidence:6},pattern:{patternBelief:5},refuse:{greed:-2,FOMO:-3},remember:{FOMO:-2},invite:{schemeTrust:3,guilt:4},hide:{guilt:5},reduce:{leveragePreference:-8},quit:{chasing:-4},next_cycle:{holding:5}};
function chosenPosition(s,event){
 const branch=event.cryptoLife?.branch||event.choices?.find(c=>c.cryptoBranch)?.cryptoBranch||'spot';
 const ps=cryptoLifePositionSummary(s,branch).positions,g=cryptoLifeState(s);
 const ratio=p=>p.cost?(p.value-p.cost)/p.cost:0;
 const filter={CL03:p=>ratio(p)>=.2,CL07:p=>ratio(p)>=.2,CL04:p=>ratio(p)>=1,CL05:p=>ratio(p)<=-.3,CL06:p=>p.value>=p.cost&&g.positionHistory?.[p.id]?.minReturnBps<=-1000,CL09:p=>ratio(p)>=1,CL12:p=>ratio(p)<=-.9}[event.id];
 return filter?ps.find(filter)||null:null;
}
function observedSummary(s,event){
 const p=chosenPosition(s,event);if(p)return {positions:[p],cost:p.cost,value:p.value,pnl:p.value-p.cost,returnBps:p.cost?Math.round((p.value/p.cost-1)*10000):0};
 return cryptoLifePositionSummary(s,event.cryptoLife?.branch||'spot');
}
function receipt(g,predicate){return [...(g.history||[])].reverse().find(h=>h.kind==='trade'&&predicate(h));}
function firstLine(g){
 const m=g.memories?.firstCryptoBuy;if(!m)return '';
 return `你在 ${m.age} 岁第一次实际投入了 ${money(m.amount)}。${g.memories.cryptoQuit?`后来在 ${g.memories.cryptoQuit.age} 岁作过退出的选择。`:''}`;
}
function balanceLine(s){const all=cryptoLifePositionSummary(s),debt=sum((s.debts||[]).map(d=>(d.principal||0)+(d.interest||0)));return `当前Crypto可兑现估值 ${money(all.value)}，当前持仓成本 ${money(all.cost)}；现金 ${money(s.cash)}，现有债务 ${money(debt)}。` ;}
export function cryptoStoryPresentation(s,event){
 if(event?.schemeLife)return schemeStoryPresentation(s,event);
 if(!event)return event;
 const g=cryptoLifeState(s);if(!event.cryptoLife)return event;
 let {title,prompt}=event;
 const summary=observedSummary(s,event),count=g.eventCounts?.[event.id]||0;
 if(['CL03','CL04','CL05','CL06','CL07','CL09','CL12'].includes(event.id)){
  const noun=event.cryptoLife.branch==='alt'?'这笔山寨币':'这部分现货';
  title=({CL03:`现货涨了 ${pct(summary.returnBps)}`,CL04:'再看时，现货已经翻倍',CL05:`现货回撤 ${pct(summary.returnBps)}`,CL06:'曾经亏损的现货回到成本附近',CL07:'牛市里的普通一天',CL09:'再看时，山寨币已经翻倍',CL12:'长期投资者'})[event.id];
  prompt+=`\n\n${noun}当前估值 ${money(summary.value)}，成本 ${money(summary.cost)}，账面${summary.pnl>=0?'浮盈':'浮亏'} ${money(Math.abs(summary.pnl))}（${pct(summary.returnBps)}）。这不是已到账收益；卖出净回款还要扣成交手续费。`;
  const p=summary.positions[0];if(p&&p.instrument!=='CHI')prompt=prompt.replaceAll('赤尾币','这笔山寨币');
 }
 if(['CL15','CL17','CL18','CL19','CL21'].includes(event.id)){
  const pred=event.id==='CL17'?h=>h.branch==='leverage'&&h.liquidation:event.id==='CL18'?h=>h.branch==='leverage'&&h.liquidation&&h.directionCorrect:event.id==='CL19'?h=>h.branch==='leverage'&&h.overnightLoss:h=>h.branch==='leverage'&&h.pnl>0;
  const h=event.id==='CL21'?cryptoWageWinReceipt(s):receipt(g,pred);
  if(event.id==='CL21')prompt='你翻到一笔已经结算的合约盈利，把那时的回执放在今天的工资旁边，脑中冒出两个字：“上班？”旧回执不会再付一次钱，工资仍要靠工作到账。';
  if(h)prompt+=`\n\n${h.age} 岁的实际结算：回款 ${money(h.cashFlow)}，${h.pnl>=0?'盈利':'亏损'} ${money(Math.abs(h.pnl))}。这笔现金已经结算，本事件不会再发放或再扣除。`;
  if(event.id==='CL17'&&count)title='那次爆仓以后';
  if(event.id==='CL21'){title='一笔盈利，相当于多少工资';prompt+=` 目前月工资 ${money(s.monthlyIncome)}${h?`，这笔盈利约相当于 ${(h.pnl*30/s.monthlyIncome).toFixed(1)} 天工资`:''}，不把交易速度当成稳定收入。`;}
 }
 if(['CL24','CL25','CL26','CL27','CL28','CL29','CL30'].includes(event.id)){
  const q=cryptoLifePositionSummary(s,'scheme');
  prompt+=`\n\n项目当前本金成本 ${money(q.cost)}，实际收益累计到账 ${money(g.schemePaid)}，已有 ${g.schemePayments||0} 次真实支付。${q.positions.some(p=>p.frozen)?'当前可提现 ¥0，页面金额不能当作现金。':''}`;
 }
 if(event.id==='CL31')prompt+=`\n\n最后页面余额 ${money(g.schemeLastPageBalance)}；当前可提现 ¥0。实际损失已经记入账本。`;
 if(['CL33','CL37','CL38','CL39','CL40'].includes(event.id)){const line=firstLine(g);if(line)prompt+=`\n\n${line}`;}
 if(event.id==='CL33'&&!g.memories.firstCryptoWin)prompt='没有工作收入的这段日子，你又想起以前Crypto账户上那次大涨。记忆里亮起来的是账面数字，并不是已经到账的收入；今天需要钱，也不会让旧涨幅自动重来。'+(firstLine(g)?`\n\n${firstLine(g)}`:'');
 if(['CL34','CL35','CL36'].includes(event.id))prompt+=`\n\n${balanceLine(s)}`;
 if(event.id==='CL32')prompt+='\n\n本事件只讨论已到账工资的安排，不会再发一次工资，也不会自动投资。';
 if(event.id==='CL42'){const h=receipt(g,h=>h.branch==='scheme'&&['withdraw','sell'].includes(h.action)&&h.cashFlow>0);if(h)prompt+=`\n\n当时实际退回 ${money(h.cashFlow)}，退出时 ${h.age} 岁。退款不会再次发放。`;}
 return {...event,title,prompt,scopeNote:'一件生活插曲 · 做完选择后回到日常',artKey:null};
}
function actionEffect(s,event,c){
 const action=c.cryptoAction,branch=c.cryptoBranch||event.cryptoLife?.branch||'spot';
 if(!FINANCIAL.has(action))return null;
 const mapped={dip_buy:'buy',reduce:'close_leverage',permanent_close:'close_leverage'}[action]||action;
 const effect={op:'crypto_life',action:mapped,...(!['exit_all','permanent_close'].includes(action)?{branch}:{}),receipt:{eventId:event.id,choice:c.label}};
 if(c.cryptoAmount!==undefined)effect.amount=c.cryptoAmount;
 if(c.cryptoFraction!==undefined)effect.amount=Math.floor(Math.max(0,s.cash||0)*c.cryptoFraction);
 if(c.cryptoTier)effect.tier=c.cryptoTier;
 if(event.id==='CL39'&&NEW_RISK.has(action))effect.allowRelapse=true;
 const p=chosenPosition(s,event);if(p&&['sell','principal'].includes(action))effect.positionId=p.id;
 if(action==='repay')effect.amount=Math.min(Math.max(0,s.cash||0),sum((s.debts||[]).map(d=>(d.principal||0)+(d.interest||0))),10000);
 if(action==='dip_buy')effect.receipt.dipBuying=true;
 return effect;
}
function hintFor(action,preview,branch){
 if(!preview)return '';
 if(action==='borrow')return `向朋友借入 ${money(preview.amount)}，形成等额本金；年利率 8%，12 个月偿还，手续费 ¥0。只转入现金，不自动加仓`;
 if(NEW_RISK.has(action))return `本次现金支出 ${money(preview.cashCost)}${branch==='leverage'?'（澄光币做多合约），其中保证金':'，投入'} ${money(preview.amount)}；成交手续费 ${money(preview.fee)}${branch==='leverage'?'。只开本次合约，当日按真实行情结算；后续资金费用按真实回执计入':'。买入不等于保证回款'}`;
 if(action==='repay')return `本次最多偿还 ${money(preview.amount)}，仅使用现有现金，不新增借款`;
 return `当前预计现金回款 ${money(preview.proceeds)}；成交手续费 ${money(preview.fee)}。受限资产保留，不能计作提现`;
}
export function cryptoStoryChoice(s,event,c){
 if(LEGACY_SCHEME_STORY_IDS.includes(event?.id)){
  // Retired invitations remain resolvable in existing saves, but cannot start a
  // new fixed chain. Historical cash already received is never changed here.
  const recruit=event.id==='PON02'&&c?.profile==='ponzi_recruit';
  return {...c,...(recruit?{label:'讲清真实情况，不收介绍费。',profile:'observe',planHint:'',requirements:{min_cash_yuan:0,all:[]}}:{}),outcomes:c.outcomes.map(o=>({...o,schedule:[],...(recruit?{title:'把情况讲清',text:'你把自己能够核对的情况讲清，没有收取介绍费，也没有替对方保证以后会回款。关系里的疑问仍需要面对。',effects:o.effects.filter(e=>e.op!=='earn'&&!(e.op==='flag'&&e.key==='recruited')).map(e=>e.op==='stat'?{...e,delta:Object.fromEntries(Object.entries(e.delta).filter(([k])=>k!=='fame'))}:e)}:{})}))};
 }
 if(event?.schemeLife||c?.schemeAction)return schemeStoryChoice(s,event,c);
 if(!event||!c?.cryptoAction)return c;
 const g=cryptoLifeState(s),action=c.cryptoAction,branch=c.cryptoBranch||event.cryptoLife?.branch||'spot';
 let hidden=false;
 if(c.cryptoSpecial){
  const meta={requiredState:c.cryptoSpecial,blockedState:[],ageStage:[18,80],minDelay:90,cooldown:180,repeatable:true};
  hidden=!cryptoEventAllowed(s,{...event,cryptoLife:meta});
 }
 if(event.id==='CL40'&&NEW_RISK.has(action))hidden=true;
 if(action==='borrow'&&g.borrowed>0)hidden=true;
 const effect=actionEffect(s,event,c),preview=effect?cryptoLifeActionPreview(s,effect):null;
 let reason=preview?.reason||'';
 if(action==='repay'&&!effect.amount)reason='当前没有可偿还的债务或现金，仍可免费离开';
 const hint=hintFor(action,preview,branch),active=NEW_RISK.has(action);
 const outcomes=c.outcomes.map(o=>{
  // Only the finance module may create/cash out a position; prose never simulates profit.
  const effects=(o.effects||[]).filter(x=>!['spend','earn','loan','venture','crypto_life'].includes(x.op));
  if(effect)effects.push(effect);
  if(['CL28','CL29','CL30'].includes(event.id)&&action!=='scheme_withdraw')effects.push({op:'crypto_life',action:'scheme_ack',branch:'scheme',receipt:{eventId:event.id,choice:c.label}});
  return {...o,effects,schedule:[],cryptoResolution:{action,branch,active,amount:effect?.amount||0,tier:c.cryptoTier||null,variant:o.cryptoOutcome||'quiet',details:hint}};
 });
 return {...c,cryptoHidden:hidden,cryptoReason:reason,planHint:hint,requirements:{...c.requirements,min_cash_yuan:preview?.cashCost?preview.cashCost/100:0},outcomes};
}
export function cryptoStoryChoices(s,event){return (event?.choices||[]).map(c=>cryptoStoryChoice(s,event,c)).filter(c=>!c.cryptoHidden);}
export function recordCryptoStory(next,before,event,choice,outcome){
 if(event?.schemeLife||outcome?.schemeResolution)return recordSchemeStory(next,before,event,choice,outcome);
 const res=outcome?.cryptoResolution;if(!res&&!choice?.cryptoAction)return;
 const action=res?.action||choice.cryptoAction,branch=res?.branch||choice.cryptoBranch;
 const aliases={inspect:'research',pattern:'theory',ambition:'continue',next_cycle:'next_round',invite:'recruit',reduce:'lower_leverage',permanent_close:'close_leverage'};
 let recorded=aliases[action]||action;
 if(action==='leverage_open')recorded=choice.cryptoTier==='extreme'?'extreme_leverage':choice.cryptoTier==='high'?'high_leverage':choice.cryptoTier==='medium'?'increase_leverage':action;
 if(event.id==='CL42')recorded='scheme_failure_news';
 const g=cryptoLifeState(before),tendencies={...(TENDENCIES[action]||{})};
 const observed=chosenPosition(before,event);
 if(event.id==='CL04'&&action==='ambition'&&observed?.cost>0&&observed.value>=observed.cost*2)tendencies.bigWinMemory=10;
 const protectedPrincipal=event.id==='CL12'&&action==='sell'&&observed?.cost>0&&observed.value<=observed.cost*.1;
 if(event.id==='CL17'&&action==='leverage_open'&&g.liquidations>0)tendencies.chasing=8;
 if(action==='ambition'&&branch==='leverage')tendencies.leveragePreference=8;
 if(action==='ambition'&&branch==='alt'){tendencies.altcoinConfidence=8;tendencies.FOMO=5;}
 recordCryptoLifeEvent(next,{eventId:event.id,choice:choice.label,action:recorded,branch,variant:res?.variant,exposure:EXPOSURE.has(event.id),tendencies,protectedPrincipal,quit:['quit','exit_all','permanent_close'].includes(action),refused:action==='refuse',exitOpportunity:g.status!=='CRYPTO_EXITED'&&Boolean(g.totalTrades||EXPOSURE.has(event.id)||EXIT.has(action))});
}
