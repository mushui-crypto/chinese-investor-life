import {queueRealizedProfit as noteRealizedProfit} from './consumption.js';
import {noteLateNight,recordAbsence,attendanceReason,attendanceStatus} from './attendance.js';
import {hasSalariedJob,dailyWageQuote} from './work-economy.js';
import {BEHAVIOR_EVENTS} from './behavior-events.js';
import {debtClock} from './debt-calendar.js';
const clamp=n=>Math.max(0,Math.min(100,n));
const riskProducts=new Set(['stock','option','option_short','futures','crypto','crypto_perp','ponzi','angel']);
export const BEHAVIOR_ACTIONS=new Set(['behavior_choice','behavior_pause','behavior_limit','behavior_talk','behavior_evidence']);
export function newBehavior(){return {heat:0,fatigue:0,riskActions:0,dailyRisk:0,winStreak:0,lossStreak:0,marketPnl:0,marketPeak:0,pending:null,seen:[],history:[],lastSceneDay:-1,lastSceneAction:0,peakFixation:false,reportedDebt:0,disclosure:'none',hiddenAt:null,aidCount:0,aidBlocked:false,supervisedUntil:0,lastTalkDay:-7,group:'none',tip:'',platform:'none',platformPaid:0,platformBook:0,platformDueDay:null,platformClaimId:null,cooldownUntil:0,dailyLimit:null,limitSetDay:-1,usedToday:0,cleanDays:0,recoveryPlan:false,recoveryDebtStart:0,relapses:0,stopped:false,rebuilt:false,lostWages:0,leaveDays:0,jobStartsTomorrow:false,nightDay:-1};}
export function behaviorState(s){return s.behavior||newBehavior();}
export function disciplineStatus(s){const b=behaviorState(s),raw=s.stats?.discipline??35,effective=clamp(Math.round(raw-(s.stats?.stress??0)*.2-b.heat*.25));return {raw,effective,level:effective>=60?'稳':effective>=35?'摇摆':'上头风险高',stopLoss:effective>=60?'较容易按计划止损':effective>=35?'亏损时可能犹豫':'容易扛单到强平',allIn:effective>=60?'冲动加仓风险较低':effective>=35?'连续输赢会放大冲动':'容易追损或梭哈'};}
export function recordDisciplineExit(s,p,api){if(!p||p.value>=p.cost||!riskProducts.has(p.kind))return '';s.flags.strict_stop_loss=true;s.behavior.heat=clamp(s.behavior.heat-10);api.stat(s,{discipline:2,stress:-2});return '你在亏损继续扩大前执行了退出计划。自律 +2，上头下降。';}
export function recordDisciplineMargin(s,p,api){if(!p||p.value>=p.cost||!['futures','crypto_perp'].includes(p.kind))return '';s.flags.held_loser=true;s.behavior.heat=clamp(s.behavior.heat+10);api.stat(s,{discipline:-2,stress:3});return '你在亏损仓位上继续追加保证金。自律 -2，扛单风险上升。';}
export function recordDisciplineLiquidation(s,p,api){if(!p||!['futures','crypto_perp'].includes(p.kind))return;const status=disciplineStatus(s);if(s.flags.held_loser&&status.effective<45){s.flags.discipline_liquidation=true;api.stat(s,{discipline:-2});}}
const totalDebt=s=>s.debts.reduce((n,d)=>n+d.principal+d.interest,0);
export function isRiskAction(s,a){return a.type==='gamble'||(['invest','desk_order'].includes(a.type)&&riskProducts.has(a.product))||(a.type==='desk_manage'&&['margin','follow'].includes(a.operation)&&riskProducts.has(s.positions.find(p=>p.id===a.id)?.kind));}
export function storyRiskAction(s,effects,product,profile,availableCash){
 const gambling=['uw_gamble','uw_chase'].includes(profile),investing=riskProducts.has(product)&&effects.some(e=>['venture','illiquid','freeze_investment'].includes(e.op));
 if(!gambling&&!investing)return null;
 const amount=effects.reduce((n,e)=>n+(e.op==='spend'?Math.round((e.amount_yuan||0)*100):['venture','illiquid','freeze_investment'].includes(e.op)?Math.round(availableCash*(e.stake_fraction||0)):0),0);
 return {type:gambling?'gamble':'invest',product,amount};
}
export function behaviorAvailability(s,a,metrics){
 const b=behaviorState(s),day=debtClock(s).day;
 if(s.age<18||s.age>=80||s.phase!=='planning'||s.legal?.prisonMonthsLeft>0||s.survival?.failed)return '先回到可以安排生活的成年阶段';
 if(['behavior_pause','behavior_limit'].includes(a.type))return '交易限额与冷静期功能已移除';
 if(a.type==='behavior_talk'){if(b.lastSceneDay===day)return '今天已经处理过一件生活事，明天再谈';if(b.pending)return '先处理盘外人生里尚未做完的决定';if(metrics.debt<=0)return '当前没有需要摊开的债务';if(day-b.lastTalkDay<7)return '刚谈过这笔账，七天后可以再谈';return '';}
 if(a.type==='behavior_evidence')return ['lost','stopped'].includes(b.platform)&&!b.platformClaimId?'':'当前没有尚待登记的黑平台损失';
 if(a.type==='behavior_choice'){
  if(a.scene!==b.pending||!Object.hasOwn(BEHAVIOR_EVENTS,a.scene)||!BEHAVIOR_EVENTS[a.scene].choices.some(c=>c.id===a.choice))return '这段生活事件已处理或选项无效';
  if((s.flags.gambling_quit||['QUIT','RECOVERED'].includes(b.onlineGambling?.status))&&((a.scene==='platform_invite'&&a.choice==='deposit')||(a.scene==='platform_withdraw'&&a.choice==='fee')))return '已经决定停止参与，不再向这个平台转钱；仍可离开或保留证据';
  if(a.scene==='work_warning'&&['rest','ignore'].includes(a.choice)&&hasSalariedJob(s)){const reason=attendanceReason(s);if(reason)return reason;}
  if(a.scene==='group_tip'&&a.choice==='pay'&&s.cash<30000)return '需 ¥300 可用现金';
  if(a.scene==='platform_invite'&&a.choice==='deposit'&&s.cash<100000)return '需 ¥1,000 可用现金';
  if(a.scene==='platform_withdraw'&&a.choice==='fee'&&s.cash<50000)return '需 ¥500 可用现金';
  if(a.scene==='night_watch'&&a.choice==='stay'&&(b.nightDay===day||s.trading.phase>=3))return '今天已熬过夜或市场已收盘，可以选择休息';
  return '';
 }
 return '未知的盘外人生安排';
}
function suggest(s,key,urgent=false){
 const b=s.behavior,day=debtClock(s).day;
 if(!Object.hasOwn(BEHAVIOR_EVENTS,key)||b.pending||b.lastSceneDay===day||(!urgent&&b.riskActions-b.lastSceneAction<3))return false;
 if(b.seen.includes(key)){
  const gap={tilt:30,hot_hand:30,drawdown:30,night_watch:7,work_warning:30,relapse:90}[key];
  const last=b.history.findLast(h=>h.scene===key);
  // New cycles require actual new bets, not reloading or repeatedly declining.
  if(!gap||!last||day-last.day<gap)return false;
  if(key==='relapse'){if(b.relapses<=(last.relapses??0))return false;}
  else if(b.riskActions-(last.riskActions??b.lastSceneAction)<(key==='night_watch'?4:6))return false;
 }
 b.pending=key;return true;
}
export function behaviorEvent(s,key=s.behavior?.pending){
 const base=BEHAVIOR_EVENTS[key];if(!base)return null;
 if(key==='work_warning'){const n=attendanceStatus(s);return {...base,choices:base.choices.map(c=>c.id==='rest'?{...c,hint:`疲劳 −40 · 无薪；近 30 天请假 ${n.leave}/3 次，超限开除、无补偿`}:c.id==='ignore'?{...c,hint:`计一次旷工 · 无薪；近 30 天旷工 ${n.absent}/1 次，超限开除、无补偿`}:c)};}
 const again=s.behavior?.history?.some(h=>h.scene===key);
 const text={
  tilt:'又是熟悉的数字。上回说好不追了，这次你却觉得只差一把就能回来。饭已经凉了，买入按钮还亮着。',
  hot_hand:'最近几笔又赚了。你翻出以前的盈利截图，自动略过了中间那些难看的账单。“这次真不一样。”你想。',
  drawdown:'高点的截图还在相册里。眼前的账户已经换了数字，你却忍不住每天拿出来比一遍。',
  night_watch:'闹钟再过几个小时就响。你上次答应早点睡，今天却又把手机充上了电。',
  work_warning:'这已经不是第一次漏回工作消息。行情涨跌没人追究，没交出去的活却有人一直等着。',
  relapse:'日子刚安稳了一阵，手机又响了。你也记得上次是怎么回去的：先看看，再试一点，然后就停不下来。'
 }[key];
 return again&&text?{...base,text}:base;
}
export function refreshBehavior(s,metrics){
 s.behavior??=newBehavior();const b=s.behavior,day=debtClock(s).day;
 if(s.age<18||s.age>=80||s.legal?.prisonMonthsLeft>0||s.survival?.failed)return;
 if(['waiting','frozen'].includes(b.platform)&&day>=(b.platformDueDay??Infinity)){b.platform='frozen';if(suggest(s,'platform_withdraw',true))return;}
 if(['partial','hidden'].includes(b.disclosure)&&metrics.debt>b.reportedDebt&&(day-(b.hiddenAt??day)>=7||s.debts.some(d=>d.overdue))){if(suggest(s,'family_exposed',true))return;}
 if(b.pending==='work_warning'&&!hasSalariedJob(s))b.pending=null;
 if(b.fatigue>=65&&hasSalariedJob(s)&&!b.leaveDays&&!b.jobStartsTomorrow){if(suggest(s,'work_warning',true))return;}
 if(b.recoveryPlan&&b.cleanDays>=30&&metrics.debt<=b.recoveryDebtStart){if(suggest(s,'rebuild',true))return;}
 if(b.stopped&&b.cleanDays>=7&&!['QUIT','RECOVERED'].includes(b.onlineGambling?.status)){if(suggest(s,'relapse',true))return;}
 if(metrics.debt>0&&b.disclosure==='none'&&(b.riskActions>0||s.debts.some(d=>['card','shark'].includes(d.kind)))){if(suggest(s,'family_call',true))return;}
 if(b.dailyRisk>=4&&(!s.dayRoutine||s.dayRoutine.stage>=6)){if(suggest(s,'night_watch',true))return;}
 if(b.marketPnl>0&&b.marketPeak-b.marketPnl>=Math.max(100000,b.marketPeak*.3)){if(suggest(s,'drawdown'))return;}
 if(b.lossStreak>=2||b.heat>=65){if(suggest(s,'tilt'))return;}
 if(b.winStreak>=3){if(suggest(s,'hot_hand'))return;}
 if(b.group==='none'){if(suggest(s,'group_invite'))return;}
 if(b.group==='joined'){if(suggest(s,'group_tip'))return;if(b.seen.includes('group_tip'))suggest(s,'platform_invite');}
}
export function trackRisk(s,a,pnl,api){
 if(a.type==='gamble')noteRealizedProfit(s,pnl);
 if(a.type==='gamble'&&s.dayRoutine&&[6,7].includes(s.dayRoutine.stage))noteLateNight(s);
 s.behavior??=newBehavior();const b=s.behavior;
 if(!Number.isSafeInteger(pnl)||!Number.isSafeInteger(b.marketPnl+pnl))throw Error('交易人生账本超出范围');
 b.marketPnl+=pnl;b.marketPeak=Math.max(b.marketPeak,b.marketPnl);
 if(isRiskAction(s,a)){
  const beforeCash=api.metrics(s).cash+(a.amount||0),fraction=beforeCash>0?(a.amount||0)/beforeCash:0,status=disciplineStatus(s),base=a.type==='gamble'?9:5;
  b.riskActions++;b.dailyRisk++;b.usedToday+=a.amount||0;b.heat=clamp(b.heat+Math.max(2,base+(status.effective<35?5:status.effective>=60?-2:0)));b.fatigue=clamp(b.fatigue+5);
  if(fraction>=.75){if(status.effective<45){b.heat=clamp(b.heat+8);api.stat(s,{discipline:-2});s.flags.impulsive_allin=true;}else api.stat(s,{discipline:1});}
  if(b.stopped){b.relapses++;b.stopped=false;b.cleanDays=0;api.stat(s,{stress:4});}
 }
 if(pnl>0){b.winStreak++;b.lossStreak=0;b.heat=clamp(b.heat+3);}else if(pnl<0){b.lossStreak++;b.winStreak=0;b.heat=clamp(b.heat+5);}
 refreshBehavior(s,api.metrics(s));
}
export function afterLifeAction(s,a,api){
 s.behavior??=newBehavior();const b=s.behavior;
 if(a.type==='rest'){b.fatigue=clamp(b.fatigue-30);b.heat=clamp(b.heat-12);}
 if(a.type==='market_review')b.heat=clamp(b.heat-8);
 if(a.type==='quit_gambling'||a.type==='gamble_leave'||a.type==='exit_risk'){b.stopped=true;b.recoveryPlan=true;b.cleanDays=0;b.recoveryDebtStart=api.metrics(s).debt;}
 refreshBehavior(s,api.metrics(s));
}
export function fatigueWage(s,base){s.behavior??=newBehavior();const b=s.behavior,pay=dailyWageQuote(s,base);b.lostWages+=base-pay;if(hasSalariedJob(s)&&b.leaveDays)b.leaveDays--;b.jobStartsTomorrow=false;return pay;}
export function advanceBehaviorDays(s,days,api){
 if(!days)return;s.behavior??=newBehavior();const b=s.behavior;
 b.cleanDays=b.dailyRisk?Math.max(0,days-1):b.cleanDays+days;
 b.heat=clamp(b.heat-days);b.fatigue=clamp(b.fatigue-days*3);b.dailyRisk=0;b.usedToday=0;
 refreshBehavior(s,api.metrics(s));
}
// A story decision records intent; it never disables the next trade.
function stepBack(s){const b=s.behavior;b.heat=clamp(b.heat-12);b.recoveryPlan=true;b.recoveryDebtStart=totalDebt(s);if(!b.stopped)b.cleanDays=0;b.stopped=true;}
function evidence(s,api){const b=s.behavior;if(b.platformClaimId)throw Error('这份损失已经登记');const claim=api.addClaim(s,b.platformPaid,0,'聚宝夜盘实际损失追偿');b.platformClaimId=claim.id;b.platform='evidence';b.platformBook=0;return `实际损失 ¥${b.platformPaid/100} 已留证，债权账面估值为零，追回款项后才算可用现金。`;}
function disclose(s,api,aid){
 const b=s.behavior,m=api.metrics(s);b.disclosure='honest';b.reportedDebt=m.debt;b.hiddenAt=null;b.lastTalkDay=debtClock(s).day;b.aidBlocked=false;b.supervisedUntil=debtClock(s).day+30;
 let amount=0;if(aid&&m.debt>0&&b.aidCount<2&&s.stats.trust>=40&&s.familyReserve>0){amount=Math.min(s.familyReserve,Math.max(Math.ceil(m.monthlyExpense/30)*7,Math.min(500000,Math.round(m.debt*.2))));s.familyReserve-=amount;api.cashChange(s,amount,'家庭有限生活援助');b.aidCount++;}
 return amount?`家人拿出 ¥${amount/100} 帮你维持生活；家庭储备等额减少。未来 30 天家人会提醒你留意生活开支；是否继续投入由你决定。原有债务仍需偿还。`:'家人听完了全部数字。这次没有额外资金援助，未来 30 天家人会提醒你留意生活开支，仍可自行决定投入。';
}
export function executeBehavior(s,a,api){
 s.behavior??=newBehavior();const b=s.behavior,day=debtClock(s).day;
 if(['behavior_pause','behavior_limit'].includes(a.type))throw Error('交易限额与冷静期功能已移除');
 if(a.type==='behavior_talk'){b.pending='family_call';b.lastTalkDay=day;return '家人已经坐在饭桌旁。打开盘外人生，把这一次的话说清楚。';}
 if(a.type==='behavior_evidence')return evidence(s,api);
 const key=a.scene,ch=a.choice;let text='';
 switch(key){
  case 'tilt':if(ch==='chase'){b.heat=clamp(b.heat+12);api.stat(s,{discipline:-3});text='你把“回本”写成下一次的目标。自律下降，下一次更容易冲动加仓。';}else if(ch==='cool'){stepBack(s);api.stat(s,{discipline:2});text='你关掉收益截图，把这次亏损记进账本。'}else{b.heat=clamp(b.heat-12);api.stat(s,{insight:3,discipline:2});text='你把投入和回款重新算了一遍，总算记清了亏多少。';}break;
  case 'hot_hand':if(ch==='confidence'){b.heat=clamp(b.heat+10);api.stat(s,{fame:2,discipline:-2});text='“老师”这个称呼让你受用。你开始盘算下一笔要加多少。';}else if(ch==='protect'){stepBack(s);api.stat(s,{discipline:2});text='你提醒自己，手上的盈利也有运气的成分。'}else{b.heat=clamp(b.heat-10);api.stat(s,{insight:3,discipline:1});text='你记下几次判断出错的地方。';}break;
  case 'drawdown':if(ch==='peak'){b.peakFixation=true;b.heat=clamp(b.heat+10);api.stat(s,{stress:5,discipline:-2});text='你盯着账户最高点，越想越不甘心。';}else if(ch==='pause'){stepBack(s);api.stat(s,{stress:-6,discipline:2});text='你把目光从账户高点移开，重新安排今天的生活。';}else{b.peakFixation=false;b.heat=clamp(b.heat-10);api.stat(s,{stress:-4,discipline:1});text='你接受了回撤，把接下来的安排放回真实账本上。';}break;
  case 'family_call':b.lastTalkDay=day;if(ch==='honest'){api.stat(s,{trust:2});b.heat=clamp(b.heat-10);text=disclose(s,api,true);}else{b.disclosure=ch==='partial'?'partial':'hidden';b.reportedDebt=ch==='partial'?Math.floor(totalDebt(s)/2):0;b.hiddenAt=day;if(ch==='hide')b.heat=clamp(b.heat+5);text=`你向家人说出的欠款是 ¥${b.reportedDebt/100}。没说的部分，账单上还写着。`;}break;
  case 'family_exposed':if(ch==='avoid'){b.aidBlocked=true;b.disclosure='refused';api.stat(s,{trust:-15,stress:8});text='家人暂时不再出借储备。已经欠下的人情债仍在，之后可以认真修复关系、重新谈这笔账。';}else{api.stat(s,{trust:ch==='truth'?-8:-5});text=disclose(s,api,false);if(ch==='own'){b.recoveryPlan=true;b.recoveryDebtStart=totalDebt(s);}}break;
  case 'group_invite':if(ch==='join'){b.group='joined';b.tip='群友：这几天涨跌真猛，你们还拿着吗？';text='你进了群，未读消息一下跳出几十条。';}else if(ch==='verify'){b.group='muted';api.stat(s,{insight:3});b.tip='你找到了原公告，把群里添油加醋的几句话划掉了。';text=b.tip;}else{b.group='muted';b.heat=clamp(b.heat-5);text='你关掉群聊邀请，继续自己的安排。';}break;
  case 'group_tip':if(ch==='pay'){api.cashChange(s,-30000,'行情群分析费用');b.tip='付费观点：群主看涨，理由是“大家都在买”。问起消息来源，他没回复。';text='付了 ¥300，群主发来一段语音。';}else if(ch==='check'){api.stat(s,{insight:4});b.tip='核验笔记：这条消息只有转发，没有可确认的原始依据。';text=b.tip;}else{b.group='muted';b.heat=clamp(b.heat-8);text='你退出了这个群，之后不再收到它的邀请。';}break;
  case 'platform_invite':if(ch==='deposit'){api.cashChange(s,-100000,'虚构聚宝夜盘转入');b.platformPaid=100000;b.platformBook=200000;b.platform='waiting';b.platformDueDay=day+1;trackRisk(s,{type:'gamble',amount:100000},-100000,api);text='已转入 ¥1,000。平台显示 ¥2,000，提现审核中；明天查看进展。';}else{b.platform='declined';if(ch==='inspect')api.stat(s,{insight:4});text='你没有转入资金，这条邀请就停在了这里。';}break;
  case 'platform_withdraw':if(ch==='fee'){api.cashChange(s,-50000,'虚构聚宝夜盘追加费用');b.platformPaid+=50000;trackRisk(s,{type:'gamble',amount:50000},-50000,api);b.platform='lost';b.platformBook=0;api.stat(s,{stress:12});text='¥500 已付出，提现没有回来。平台随后失联；实际损失可从盘外人生登记追偿。';}else if(ch==='evidence')text=evidence(s,api);else{b.platform='stopped';b.platformBook=0;text='你停止了追加付款，接受已发生的损失。以后仍可登记证据、尝试追偿。';}break;
  case 'night_watch':if(ch==='stay')noteLateNight(s);if(ch==='stay'){b.nightDay=day;s.trading.energy=Math.min(6,s.trading.energy+2);if(s.dayRoutine){s.dayRoutine.choices[6]='stay';s.dayRoutine.stage=7;text='又熬到两点，多了两次市场操作。睡下后疲劳 +24、压力 +5，连续熬夜会更伤身体。';}else{b.fatigue=clamp(b.fatigue+28);api.stat(s,{health:-2});text='你又腾出两次市场操作。疲劳增加 28，健康下降 2；高疲劳会扣减工资和零工效率。';}}else if(ch==='sleep'){b.fatigue=clamp(b.fatigue-25);b.heat=clamp(b.heat-8);text='手机放下了。行情仍在走，你先把自己照顾好。';}else{b.heat=clamp(b.heat-6);api.stat(s,{insight:1});text='你把今天的成交记下来，发现自己已经反复改过几次判断。上头 −6，眼力 +1。';}break;
  case 'work_warning':if(!hasSalariedJob(s)){b.fatigue=clamp(b.fatigue-20);text='这份工作已经结束，先休息一天。';}else if(ch==='rest'){text=recordAbsence(s,'leave',api,{fatigue:40});}else if(ch==='balance'){b.fatigue=clamp(b.fatigue-20);api.stat(s,{skill:2});stepBack(s);text='你把工作和睡觉的时间重新排好，先处理堆着的任务。';}else{text=recordAbsence(s,'absent',api);}break;
  case 'relapse':if(ch==='keep'){stepBack(s);api.stat(s,{stress:-5});text='你没有跟着截图起哄，继续处理自己的账单。';}else if(ch==='limited'){b.heat=clamp(b.heat-5);text='你翻出自己以前的成交记录，提醒自己别只看别人赚了多少。上头 −5。';}else{b.heat=clamp(b.heat+10);text='你又打开了那张收益截图，看了好一会儿。';}break;
  case 'rebuild':b.rebuilt=true;b.recoveryPlan=true;if(ch==='plan')api.stat(s,{trust:5,stress:-8});else if(ch==='family'){api.stat(s,{trust:7});b.disclosure='honest';b.reportedDebt=totalDebt(s);b.aidBlocked=false;}else api.stat(s,{health:4});text='你翻过这一页账本，写下明天要做的事。';break;
  default:throw Error('未知的生活事件');
 }
 b.history.push({scene:key,choice:ch,day,turn:s.turn,age:s.age,title:BEHAVIOR_EVENTS[key].title,text,riskActions:b.riskActions,relapses:b.relapses});if(b.history.length>200)b.history.shift();if(!b.seen.includes(key))b.seen.push(key);b.pending=null;b.lastSceneDay=day;b.lastSceneAction=b.riskActions;return text;
}

export function validateBehavior(s){
 s.behavior??=newBehavior();const b=s.behavior,bad=()=>{throw Error('存档中的盘外人生记录无效');},int=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(n)||n<min||n>max)bad();};
 if(!b||typeof b!=='object'||Array.isArray(b))bad();if(b.leaveDays===undefined)b.leaveDays=0;int(b.leaveDays,0,1);if(b.jobStartsTomorrow===undefined)b.jobStartsTomorrow=false;if(typeof b.jobStartsTomorrow!=='boolean')bad();for(const k of ['heat','fatigue'])int(b[k],0,100);
 for(const k of ['riskActions','dailyRisk','winStreak','lossStreak','marketPeak','lastSceneAction','reportedDebt','aidCount','supervisedUntil','platformPaid','platformBook','cooldownUntil','usedToday','cleanDays','recoveryDebtStart','relapses','lostWages'])int(b[k]);int(b.marketPnl,-Number.MAX_SAFE_INTEGER);for(const k of ['lastSceneDay','limitSetDay','nightDay'])int(b[k],-1);int(b.lastTalkDay,-7);
 for(const k of ['peakFixation','aidBlocked','recoveryPlan','stopped','rebuilt'])if(typeof b[k]!=='boolean')bad();
 if(b.dailyLimit!==null)int(b.dailyLimit);for(const k of ['hiddenAt','platformDueDay'])if(b[k]!==null)int(b[k]);
 if(!['none','honest','partial','hidden','refused'].includes(b.disclosure)||!['none','joined','muted'].includes(b.group)||!['none','waiting','frozen','lost','stopped','evidence','declined'].includes(b.platform))bad();
 if(b.pending!==null&&!Object.hasOwn(BEHAVIOR_EVENTS,b.pending))bad();if(!Array.isArray(b.seen)||b.seen.length>30||new Set(b.seen).size!==b.seen.length||b.seen.some(k=>!Object.hasOwn(BEHAVIOR_EVENTS,k)))bad();
 if(!Array.isArray(b.history)||b.history.length>200)bad();for(const h of b.history){if(!BEHAVIOR_EVENTS[h.scene]?.choices.some(c=>c.id===h.choice)||typeof h.text!=='string'||h.text.length>5000||h.title!==BEHAVIOR_EVENTS[h.scene].title)bad();int(h.day,0,debtClock(s).day);int(h.turn,0,s.turn);if(!Number.isFinite(h.age)||h.age<18||h.age>s.age)bad();}
 if(typeof b.tip!=='string'||b.tip.length>2000||b.aidCount>2||b.lastSceneAction>b.riskActions||b.marketPeak<b.marketPnl)bad();
 for(const h of b.history){if(h.riskActions!==undefined)int(h.riskActions,0,b.riskActions);if(h.relapses!==undefined)int(h.relapses,0,b.relapses);}
 if(!Array.isArray(s.claims))bad();
 if(b.platformClaimId!==null&&(typeof b.platformClaimId!=='string'||(!s.claims.some(c=>c.id===b.platformClaimId)&&b.platform!=='evidence')))bad();
}
