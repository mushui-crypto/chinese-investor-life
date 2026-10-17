import {onlineGamblingState,ensureOnlineGambling,recordOnlineExposure,recordOnlineBet,recordOnlineBorrow,recordOnlineQuit,recordOnlineRefusal,recordOnlineEvent,adjustOnlineTendencies,onlineChoiceWeight,onlineEventAllowed} from './online-gambling.js';

// Rendering is deterministic: outcome draws remain owned by the existing event engine.
export const ONLINE_EVENT_IDS=Array.from({length:27},(_,i)=>`OG${String(i+1).padStart(2,'0')}`);
const ACTIVE=new Set(['bonus','small','raise','chase','allin','borrow','guru','model']);
const EXIT=new Set(['quit','withdraw','disclose']);
const LEGACY=new Set(['AGE20U','AGE20N','UG01','UG02','UG03','UG11','UG12']);
const money=n=>`¥${(n/100).toLocaleString('zh-CN',{maximumFractionDigits:2})}`;
const units=n=>Number.isInteger(n)?String(n):String(Math.round(n*10)/10);
const ageText=n=>`${units(n)} 岁`;
const day=s=>s.debtClock?.day||0;
const debts=s=>(s.debts||[]).reduce((n,d)=>n+(d.principal||0)+(d.interest||0),0);
const firstMemory=g=>g.memories?.firstWin||g.memories?.firstBet;
const strategyBet=(g,action)=>[...(g.history||[])].reverse().find(h=>h.kind==='bet'&&h.action===action);
const borrowedWin=g=>[...(g.history||[])].reverse().find(h=>h.kind==='bet'&&(h.borrowed>0||h.action==='borrow')&&h.returned>h.stake);
function memoryLine(s,g){
 const m=firstMemory(g);if(!m)return '';
 const years=Math.max(0,Math.floor(s.age-m.age));
 return g.memories.firstWin?`${years>=1?`${years} 年前，`:'那一次，'}你在 ${ageText(m.age)} 第一次赢了 ${money(m.amount)}。这笔数记得很牢，后面的账仍要另算。`:`你第一次参与是在 ${ageText(m.age)}，当时是 ${money(m.amount)}。那次选择没有替今天做决定。`;
}
function marbleLine(s){
 const history=s.studentStories?.history||[],h=history.find(h=>h.resource==='marbles');
 if(!h)return '你想起小时候在操场边看过别人玩玻璃球。自己没有留下那一局的记录，倒记得围在旁边的人喊得很起劲。';
 if(['leave','redeem'].includes(h.action))return `你记得 ${h.age} 岁那回，把弹珠收好就离开了。后来手里的东西越来越值钱，停下来仍然是自己可以做的选择。`;
 if(h.action==='allin')return `你记得 ${h.age} 岁那回，把带来的弹珠全摆上去了。${h.delta<0?'当时输掉的，不过十几颗玻璃球。':'当时的输赢已经过去，那股把东西全部摆上去的念头却很熟。'}`;
 return `你记得 ${h.age} 岁那回选了“${h.choice}”。那时的输赢装在一个小布袋里，现在却要算进生活。`;
}
function repeatedPrompt(id,count){
 if(id==='OG08')return count>=9?'“最后一把？”你看着那四个字，连保证的标点都省了。':count>=4?'“真正的最后一把。”这句话已经用过好几次，今晚又像新的一样摆在面前。':count>0?'你又说了一次“最后一把”。上次也是这么说的，闹钟倒没有跟着改时间。':null;
 if(id==='OG11'&&count>0)return `又一个群，又一个被叫作老师的人。这已是第 ${count+1} 次听到相似的介绍，截图换了，保证的语气没有。`;
 if(id==='OG23'&&count>0)return `这已是第 ${count+1} 次有人说“就看看”。你以前有过自己的回答，今天仍然需要自己再回答一次。`;
 if(id==='OG22'&&count>0)return `你又把完整账单摆到眼前。第 ${count+1} 次谈停止，不会被前一次作废；今天能做的，是先不再加一笔。`;
 return null;
}
export function onlineStoryPresentation(s,event){
 if(!event)return event;
 const g=onlineGamblingState(s);let title=event.title,prompt=event.prompt;
 if(!event.onlineGambling){
  if(['XIA01','ENC_JOB02'].includes(event.id)&&g.exposed){const line=memoryLine(s,g);prompt+=line?`\n\n${line}`:'';if(g.tendencies.chasing>0)prompt+=' 你发现自己想用一次回本，让眼前的问题一笔勾销。';}
  return {...event,title,prompt};
 }
 const count=g.eventCounts[event.id]||0;
 prompt=repeatedPrompt(event.id,count)||(count?`这已经是你第 ${count+1} 次碰到相似的念头。`+prompt:prompt);
 if(event.id==='OG01'&&s.age>=22)prompt='下班后，旧同学群里突然活跃起来。有人发来链接：“这个注册送，我刚弄出来几十块。”下面一片起哄，你原本只是想问周末聚会几点。';
 if(event.id==='OG03'){const first=g.memories.firstWin;title='第一次提现 · 回看那笔到账';prompt=first?`你重新翻到 ${ageText(first.age)} 的那条收款记录。那是你第一次赢下 ${money(first.amount)}，钱当时就已经到账了。现在再看，你在想的是：要不要把已有的钱又放回去？`:'你重新翻到第一次收款的记录，钱当时就已经到账了。现在再看，你在想的是：要不要把已有的钱又放回去？';}
 if(event.id==='OG04'&&g.staked===0&&g.freeCredit>0)prompt='上次试用的额度没有保住，虽然没搭上自己的现金，你却有点不服。免费的那份已经用完了，再进去，就得先掏自己的钱。';
 if(event.id==='OG07'){
  const target=s.cash<10000?10000:s.cash<1000000?1000000:s.cash<100000000?100000000:Math.ceil((s.cash+1)/100000000)*100000000;
  title=`凑个整数 · 想凑到 ${money(target)}`;
  prompt=`你看着手里的 ${money(s.cash)}，心里盯上了 ${money(target)}。${count?`这种“差一点”的感觉，已经是第 ${count+1} 次。`:'零头本来没有要求，是你开始替它着急。'}以前可能只是 97 到 100，现在同一句话已经能装下更多钱。`;
 }
 if(event.id==='OG12'){const h=strategyBet(g,'guru');if(h&&h.returned>h.stake)prompt=`你又翻到跟着群里那位老师参与的记录：${ageText(h.age)} 那次，投入 ${money(h.stake)}，回款 ${money(h.returned)}。那回确实赢了。群里今天又有人喊“跟上”，金额比上回说得更轻巧。`;}
 if(['OG15','OG16'].includes(event.id)){const h=strategyBet(g,'model');if(h)prompt=`你翻开自己的表格，最近那次真钱验证写得很清楚：投入 ${money(h.stake)}，回款 ${money(h.returned)}。${event.id==='OG15'?'结果确实是赢的。你还没检查别的样本，已经想给这张表起个正式名字。':'结果没有按模型预想的走。你又加了一列“特殊情况”，发现只要列足够多，每次失误都能找到位置。'}`;}
 if(event.id==='OG20'){const h=borrowedWin(g),left=(s.debts||[]).filter(d=>(g.borrowDebtIds||[]).includes(d.id)).reduce((n,d)=>n+(d.principal||0)+(d.interest||0),0);prompt=h?`你想起 ${ageText(h.age)} 那次借钱参与：借来的 ${money(h.borrowed||h.stake)} 投进去，回款 ${money(h.returned)}，那一回真的赢了。${left>0?`现在相关借款还剩 ${money(left)}，仍在还款账上。`:'那笔借款现在已经还清，赢过的经历仍然留在记忆里。'}群里又热闹起来，你把账单往下翻了一页。`:prompt;}
 if(event.id==='OG18'){
  title='房租还有三天';
  prompt='朋友发来一句“房租还有三天”，问你要不要一起试着赢一笔。你也在算自己的吃住开销，手头不太宽裕。那三天是他的期限，你自己的日常住房支出仍按原来的安排结算。';
 }
 if(event.id==='OG19'&&s.cash>0){title='那笔赌资归零';prompt='上一次投入的那笔已经全部损失，其他现金仍在你自己账户里。朋友问要不要借一百再试。先前一直说的是再来一把，现在终于出现了“还”字。';}
 if(event.id==='OG19'&&g.lastStake&&g.lastNet>-g.lastStake){title='亏损以后，借 100 吗';prompt='上次的亏损仍在账上，朋友问要不要借一百再试。你的其他钱和资产仍按账本记录，面前的问题只是：要不要为了再赌一次添这笔债。';}
 if(event.id==='OG21'&&g.netProfit<0){title='曾经回本以后';prompt='你确实有过一次把旧亏损全部赢回来的时候。后来又继续了，今天累计盈亏重新成了负数。“回本就走”那句话还在，出口也还在。';}
 if(event.id==='OG24')title='最近升职以后';
 if(event.id==='OG26'){
  const elapsed=g.memories.firstBet?Math.max(0,Math.floor(s.age-g.memories.firstBet.age)):0;
  prompt=(elapsed?`${elapsed} 年过去，整理旧手机时你又看到那段聊天。`:'整理旧聊天时，那个熟悉的入口又出现在眼前。')+' 有些人早就换了头像，当年的保证却一字没变。';
 }
 if(event.id==='OG27')prompt=marbleLine(s);
 if(['OG09','OG10','OG17','OG23','OG26'].includes(event.id))prompt+='\n\n'+memoryLine(s,g);
 if(g.status==='RECOVERED'&&['OG26','OG27'].includes(event.id))prompt+='\n\n这已经是一段旧事。你留下回忆，今天不再提供下注的入口。';
 return {...event,title,prompt,scopeNote:'一件生活插曲 · 做完选择后回到日常',artKey:null};
}
function actionFor(event,c){
 if(c.onlineAction)return c.onlineAction;
 if(!LEGACY.has(event.id))return '';
 if(['AGE20U','AGE20N'].includes(event.id))return c.id.endsWith('_1')?'curious':c.id.endsWith('_2')?'inspect':'refuse';
 if(c.profile==='uw_quit')return 'quit';
 return '';
}
const TENDENCY_DELTA={bonus:{casualGambling:3},small:{casualGambling:3},raise:{confidence:5},chase:{chasing:5},allin:{chasing:5,confidence:5},borrow:{chasing:8},guru:{guruDependence:10},model:{patternBelief:8},inspect:{confidence:-2,patternBelief:-1},quit:{chasing:-8,confidence:-5,guruDependence:-8},withdraw:{confidence:-4,chasing:-5},refuse:{chasing:-3},disclose:{chasing:-8,confidence:-5}};
function stakeFor(s,event,action){
 const g=onlineGamblingState(s);
 if(action==='bonus')return {stake:0,freeCredit:2000};
 if(action==='borrow')return {stake:10000,freeCredit:0,borrowed:10000};
 if(action==='small'||action==='model')return {stake:2000,freeCredit:0};
 if(action==='allin')return {stake:Math.max(0,s.cash||0),freeCredit:0};
 if(event.id==='OG02')return {stake:10000,freeCredit:0};
 if(action==='chase')return {stake:Math.max(10000,Math.ceil(Math.max(g.lastStake*2,(s.cash||0)*.2)/100)*100),freeCredit:0};
 return {stake:Math.max(10000,Math.ceil((s.cash||0)*.1/100)*100),freeCredit:0};
}
function resultCopy(event,action,variant,stake,returned,freeCredit){
 const net=returned-stake;
 const after={win:'到账提示响了一声，你把数字看了两遍。门外有人叫你，手机上的热闹暂时停在这里。',big_win:'这次意外赢了很多。回款到账后，你截了张图，连手边已经凉了的茶都忘了喝。',loss:'你把剩下的钱转回来，账上比开始少了一截。群里正有人催下一把，你先退回了手机桌面。',zero:'这一次投入的余额变成零，旁边的充值按钮仍然很亮。你盯了一会，把手机放到桌边。',tie:'钱转了一圈又回来了。你核对了一遍，金额没变，钟上的指针倒是走了不少。'}[variant];
 let title=freeCredit?returned>0?'试用额度结算，回款到账':'试用额度用完，现金未扣':net>0?'网赌结算盈利':net<0?'网赌结算亏损':'网赌结算持平';
 let text=after||event.prompt;
 if(freeCredit)text=returned>0?`一次性的 20 元试用额度已经用完，本次可提现回款 ${money(returned)} 已到账。你没有投入自有现金，也不会再领一份赠金。`:'一次性的 20 元试用额度已经用完，没有可提现回款。你没有投入自有现金，这次也没有欠款。';
 if(action==='borrow')text+=` 这次主动借入的 ${money(stake)} 仍是债务，无息，3 个月内按还款安排偿还；赢钱不会自动免除。`;
 if(action==='guru')text+=net>0?' 你开始更相信那位老师，但这一次成功没有替下一次作保证。':' 群里已经有人在解释原因，你的账先记下这次的实际结果。';
 if(action==='model')text+=net>0?' 你的那张表这次碰巧对上了，记录仍从这一笔算起。':' 你的那张表这次没有对上，旧预测没有因此被删除。';
 return {title:`${event.title} · ${title}`,text};
}
export function onlineStoryChoice(s,event,c){
 if(!event||!c)return c;
 const action=actionFor(event,c);if(!action)return c;
 const g=onlineGamblingState(s),active=ACTIVE.has(action),count=g.eventCounts[event.id]||0;
 let onlineHidden=Boolean(c.onlineSpecial&&(!g.exposed||g.status==='RECOVERED'||!c.onlineSpecial.some(k=>(g.tendencies[k]||0)>0))),onlineReason='',label=c.label;
 if(c.onlineSpecial&&!onlineEventAllowed(s,{...event,onlineGambling:{requiredState:['exposed'],blockedState:['QUIT','RECOVERED'],minDelay:90,minOrdinaryEvents:2}}))onlineHidden=true;
 if(g.status==='RECOVERED'&&active)onlineHidden=true;
 if(action==='bonus'&&(g.bonusClaimed||g.totalBets>0))onlineReason='一次性试用额度已经使用，不能重复领取';
 if(event.id==='OG17'&&action==='chase'&&!g.tendencies.chasing)onlineHidden=true;
 if(event.id==='OG17'&&action==='raise'&&!g.tendencies.confidence&&!g.tendencies.bigWinMemory)onlineHidden=true;
 if(event.id==='OG08'&&count>=9&&action==='small')label='嗯。只再放 20 元。';
 if(event.id==='OG27'&&action==='allin'&&!(s.studentStories?.traits?.allIn>15||g.tendencies.chasing>10))onlineHidden=true;
 const stakeData=active?stakeFor(s,event,action):{stake:0,freeCredit:0};
 if(active&&!stakeData.stake&&!stakeData.freeCredit)onlineReason='当前没有可投入现金，仍可免费离开';
 if(action==='borrow'&&s.flags?.online_borrow_blocked)onlineReason='这次没有人愿意再借，仍可停止参与';
 const ownCost=stakeData.borrowed?0:stakeData.stake;
 const hint=active?(stakeData.freeCredit?'一次性试用 20 元 · 不扣现金':stakeData.borrowed?'明确借入 ¥100 后全部投入 · 无息 · 3 个月偿还':`本次自有现金 ${money(stakeData.stake)} · 最多损失这笔金额`):action==='repay'?'仅偿还现有债务，不新增借款':'不新增赌资';
 const outcomes=c.outcomes.map(o=>{
  if(!active){
   // Exposure choices in existing saves retain their authored effects and IDs.
   let effects=[...(o.effects||[])];
   if(EXIT.has(action)&&g.totalBets>0){effects=effects.filter(x=>x.op!=='quit_gambling');effects.push({op:'flag',key:'gambling_quit',value:true},{op:'stat',delta:{stress:-3}});}
   return {...o,effects,schedule:LEGACY.has(event.id)||event.onlineGambling?[]:o.schedule,onlineResolution:{action,active:false,details:hint}};
  }
  const variant=o.onlineOutcome||'zero',gross=stakeData.stake+stakeData.freeCredit;
  const returned=variant==='big_win'?Math.round(gross*8.4):variant==='win'?Math.round(gross*1.5):variant==='loss'?Math.floor(gross*.5):variant==='tie'?gross:0;
  const net=returned-stakeData.stake;
  const effects=(o.effects||[]).filter(x=>['flag','stat','relationship'].includes(x.op));
  if(stakeData.borrowed)effects.push({op:'loan',principal_yuan:100,apr_bps:0,term_months:3,purpose:'online_gambling'});
  if(stakeData.stake)effects.push({op:'spend',amount_yuan:stakeData.stake/100});
  if(returned)effects.push({op:'earn',amount_yuan:returned/100});
  effects.push({op:'flag',key:'gambling_history',value:true},{op:'flag',key:'gambling_quit',value:false});
  if(net)effects.push({op:'stat',delta:{stress:net>0?-2:active&&action==='allin'?8:4}});
  const details=`${stakeData.freeCredit?`一次性试用 ${money(stakeData.freeCredit)}`:`现金投入 ${money(stakeData.stake)}`}；回款 ${money(returned)}；${net>=0?'现金净增':'现金净减'} ${money(Math.abs(net))}。`;
  return {...o,...resultCopy(event,action,variant,stakeData.stake,returned,stakeData.freeCredit),effects,schedule:[],weight:onlineChoiceWeight(s,{action,variant},o.weight),onlineResolution:{...stakeData,returned,net,action,active:true,variant,details}};
 });
 return {...c,label,onlineGambling:active||Boolean(event.onlineGambling),onlineHidden,onlineReason,planHint:hint,requirements:{...c.requirements,min_cash_yuan:ownCost/100},outcomes};
}
export function onlineStoryChoices(s,event){return (event?.choices||[]).map(c=>onlineStoryChoice(s,event,c)).filter(c=>!c.onlineHidden);}
export function recordOnlineStory(next,before,event,choice,outcome){
 const res=outcome.onlineResolution,legacy=LEGACY.has(event.id),g=ensureOnlineGambling(next);
 if(!res&&!legacy)return;
 const action=res?.action||actionFor(event,choice),info={eventId:event.id,choice:choice.label,source:'story'};
 if(event.id==='OG01'||['AGE20U','AGE20N'].includes(event.id))recordOnlineExposure(next,action==='refuse'?'decline':action);
 if(res?.active){
  if(res.borrowed){const oldIds=new Set((before.debts||[]).map(d=>d.id)),newDebt=(next.debts||[]).find(d=>!oldIds.has(d.id));if(newDebt)recordOnlineBorrow(next,{...info,amount:res.borrowed,debtId:newDebt.id});}
  recordOnlineBet(next,{...info,stake:res.stake,returned:res.returned,freeCredit:res.freeCredit,action,chasing:action==='chase',borrowed:res.borrowed||0,bigWin:res.variant==='big_win',tendencies:TENDENCY_DELTA[action]});
 }else{
  if(TENDENCY_DELTA[action])adjustOnlineTendencies(next,TENDENCY_DELTA[action]);
  if(EXIT.has(action))recordOnlineQuit(next,info);
  if(action==='refuse')recordOnlineRefusal(next,info);
 }
 if(event.onlineGambling||legacy||res?.active)recordOnlineEvent(next,{...info,exitOpportunity:onlineGamblingState(before).status!=='RECOVERED'&&Boolean(res?.active||g.totalBets||event.id==='OG01'),ordinary:event.onlineGambling?.ordinary});
}
