import {fixedIncomeCashflow} from './payroll.js';
import {routineNext} from './day-routine.js';
import {getMetrics,getSurvivalStatus,getLegalStatus,getTurnMonths,getActionAvailability,getDebtCalendar} from './core.js';
import {getMarketAccess,getGamblingAccess} from './market-access.js';
export const WATCH_MARKETS=['stock','fund','bond','option','option_short','futures','crypto','ponzi','angel','housing','gambling'];
export const GOALS={buffer:'攒够 30 天生活费',debt:'还清眼前的债',practice:'完成一次模拟练习',option:'达到期权开放条件',kin:'还清欠亲友的钱',shop:'让小店稳定经营',home:'有一处安稳的住处',retire:'留够退休生活的钱',legacy:'把人生交接清楚'};
export const newJourney=()=>({start:'birth',childhood:'study',goal:'buffer',debtStart:0,completed:[],watchlist:['stock','fund'],lastAction:null});
export const journey=s=>s.journey||newJourney();
export function goalStatus(s,key=journey(s).goal){
 const m=getMetrics(s),j=journey(s);let current=0,target=1,hint='',route={type:'tab',tab:'life'};
 if(key==='buffer'){current=s.cash;target=Math.max(1,m.monthlyExpense);hint='现金达到 30 天基本开销。';route={type:'life-action',action:'seek_job'};if(s.monthlyIncome>=m.monthlyExpense)route={type:'life-action',action:'gig'};}
 if(key==='debt'){target=Math.max(1,j.debtStart);current=Math.max(0,target-m.debt);hint=`还清全部本金和利息。`;route={type:'debt-calendar'};}
 if(key==='practice'){current=s.marketProgress?.simulations||0;hint='免费，消耗 1 点精力；练习会提高眼力。';route={type:'life-action',action:'market_practice'};}
 if(key==='option'){const a=getMarketAccess(s,'option');current=a.unlocked?a.requirements.length:a.requirements.filter(r=>r.met).length;target=a.requirements.length;hint=a.unlocked?'已达到开放条件。':a.reason;route={type:'market-rules',product:'option'};}
 if(key==='kin'){const debt=s.debts.filter(d=>['family','friend'].includes(d.kind)).reduce((n,d)=>n+d.principal+d.interest,0),had=s.ledger.some(e=>e.account==='debt'&&/亲友|朋友|家人|家庭/.test(e.label)&&e.amount>0);target=2;current=Number(had)+Number(had&&debt===0);hint='实际借过亲友的钱，并还清全部人情债本息。';route={type:'debt-calendar'};}
 if(key==='shop'){target=3;current=Number(s.businesses.some(b=>b.monthlyProfit>0))+Number((s.lifeArcs?.businessTurns||0)>=3)+Number(m.monthlyIncome>=m.monthlyExpense&&s.businesses.length>0);hint='有盈利小店、连续经营 3 期、当前稳定收入覆盖基本开销。';route={type:'tab',tab:'life'};}
 if(key==='home'){target=3;current=Number(s.positions.some(p=>p.kind==='housing'&&p.value>0))+Number(!s.debts.some(d=>d.kind==='mortgage'&&d.overdue))+Number(s.cash>=m.monthlyExpense*3);hint='拥有房屋、按揭无逾期、留有 3 个月现金开销。';route={type:'tab',tab:'assets'};}
 if(key==='retire'){target=4;current=Number(s.age>=55)+Number(m.debt===0)+Number(s.cash>=m.monthlyExpense*24)+Number(Boolean(s.flags.voluntary_exit));hint='55 岁后，无欠款、留足 24 个月现金开销，并履行两期封盘决定。';route={type:'tab',tab:'people'};}
 if(key==='legacy'){target=2;current=Number(s.age>=55)+Number(Boolean(s.lifeArcs?.inheritance));hint='55 岁后可整理资产、债务和交接安排。';route={type:'life-legacy'};}
 return {key,title:GOALS[key],current,target,done:j.completed.includes(key)||current>=target,ratio:Math.min(1,Math.max(0,current/target)),hint,route};
}
export function updateJourney(before,after,action){
 if(!after||after.lastResult?.error)return after;
 const s=structuredClone(after);s.journey??=newJourney();
 if(action)s.journey.lastAction=action.type;
 // Keep an activity/event illustration only while its original clock slot is current.
 if(action&&before?.dayRoutine&&before.turn===s.turn&&s.dayRoutine&&s.lastResult&&before.trading.day===s.trading.day&&before.dayRoutine.stage===s.dayRoutine.stage){
  s.lastResult.sceneContext={day:s.trading.day,stage:s.dayRoutine.stage,action:action.type,...(action.type==='day_event_choice'?{event:before.dayRoutine.pending,choice:action.choice}:{})};
 }
 if(before&&before.turn!==s.turn)s.journey.lastAction=null;
 const g=goalStatus(s);if(s.age>=18&&g.done&&!s.journey.completed.includes(g.key))s.journey.completed.push(g.key);
 return s;
}
export function setGoal(state,key){if(!Object.hasOwn(GOALS,key))throw Error('没有这个阶段目标');if(key==='debt'&&getMetrics(state).debt<=0)throw Error('现在没有欠款，可以选择另一个目标');const s=structuredClone(state);s.journey??=newJourney();s.journey.goal=key;if(key==='debt'){s.journey.debtStart=getMetrics(s).debt;s.journey.completed=s.journey.completed.filter(k=>k!==key);}return updateJourney(null,s);}
export function toggleWatch(state,key){if(!WATCH_MARKETS.includes(key))throw Error('没有这个市场');const s=structuredClone(state);s.journey??=newJourney();s.journey.watchlist=s.journey.watchlist.includes(key)?s.journey.watchlist.filter(k=>k!==key):[...s.journey.watchlist,key];return s;}
export function validateJourney(s){
 s.journey??=newJourney();const j=s.journey,bad=()=>{throw Error('存档中的玩法指引无效');};
 if(!j||Array.isArray(j)||!['birth','adult'].includes(j.start)||!['study','practical','social'].includes(j.childhood)||!Object.hasOwn(GOALS,j.goal)||!Number.isSafeInteger(j.debtStart)||j.debtStart<0)bad();
 for(const [values,allowed] of [[j.completed,Object.keys(GOALS)],[j.watchlist,WATCH_MARKETS]])if(!Array.isArray(values)||values.length>allowed.length||new Set(values).size!==values.length||values.some(k=>!allowed.includes(k)))bad();
 if(j.lastAction!==null&&(typeof j.lastAction!=='string'||j.lastAction.length>60))bad();
}
// Projections use only the present ledger, never RNG, hidden events, or future market prices.
export function timePreview(s){
 const months=getTurnMonths(s),m=getMetrics(s),v=getSurvivalStatus(s),legal=getLegalStatus(s),dayMode=v.active&&(s.survival?.days||0)<months*30;
 const days=dayMode?1:Math.max(0,months*30-(s.debtClock?.periodDays||0));
 const salary=s.age<18||legal.inPrison?0:dayMode?v.dailyIncome:fixedIncomeCashflow(s,days).income;
 const living=s.age<18||legal.inPrison?0:dayMode?v.dailyExpense:m.livingReserve;
 let debt=0;const now=s.debtClock?.day||0;
 if(s.age>=18)for(const d of s.debts){
  if(!d.calendar){if(!dayMode)debt+=Math.min(d.principal,Math.round(d.principal*(d.monthsLeft>0?Math.min(months,d.monthsLeft)/d.monthsLeft:1)))+d.interest+Math.round(d.principal*d.aprBps/10000*months/12);continue;}
  let principal=d.principal,interest=d.interest,arrears=d.calendar.principalDue;
  for(let at=d.calendar.nextDay;at<=now+days&&principal+interest>0;at+=30){interest+=Math.round(principal*d.aprBps/120000);const part=Math.min(principal,arrears+d.calendar.monthlyPrincipal);debt+=part+interest;principal-=part;interest=0;arrears=0;}
 }
 return {months,days,dayMode,salary,living,debt,cashAfter:s.cash+salary-living-debt,ageAfter:dayMode?s.age:Math.min(80,s.age+months/12),nextBill:getDebtCalendar(s)[0]||null,legal:legal.inPrison};
}
export function nextStep(s,desk=null){
 const go=(title,text,route)=>({title,text,route}),v=getSurvivalStatus(s),legal=getLegalStatus(s);
 if(s.phase==='event')return go('先做眼前这个决定','选择当前故事的下一步。',{type:'tab',tab:'life'});
 if(s.phase==='result')return go('这件事已经记下了','继续阅读，或安排生活与交易。',{type:'continue'});
 if(s.phase==='ended')return go('这一生已有后记','可以保留档案，或开启另一种人生。',{type:'saves'});
 if(legal.inPrison)return go('服刑期间也可以继续人生',`还剩 ${legal.prisonMonthsLeft} 个月；学习、写信后可推进刑期，旧债仍继续结算。`,{type:'next-turn'});
 if(s.age<18)return go(s.age>=12?'逛逛集市，或继续长大':'继续长大',s.age>=12?'每个学段都有成长故事；初中、高中各有一次摆摊机会，也可以快进到成年。':'按学段经历成长故事，用精力选择这一阶段的习惯。',{type:'tab',tab:'life'});
 if(v.active)return go('先接上今天的生活费',s.actionPoints?'日结零工或求职都不需要先借钱；也可以处理可售资产。':'精力已用完，结算今天后恢复 2 点精力。',s.actionPoints?{type:'rescue-options'}:{type:'life-action',action:'survival_day'});
 const t=s.trading;
 if(s.dayRoutine?.pending)return go('有件日常小事','处理完再继续今天。',{type:'day-routine'});
 if(desk&&t.phase===3){const a=getActionAvailability(s,{type:'market_day'});return go(a.allowed?'今天的账已结清，开始新一天':'本期交易时段已结束',a.allowed?'A 股昨日买入的部分可按 T+1 卖出；新一天恢复 6 次市场操作。':'可以管理生活安排，或按下方账单预览推进下一期。',a.allowed?{type:'command',command:{type:'day_next'}}:{type:'next-turn'});}
 if(desk&&t.energy===0)return go('操作用完了，行情仍可推进','精力与市场操作分别计数。睡觉结算今天，次日恢复操作次数。',{type:'command',command:{type:'day_next'}});
 if(desk==='stock'&&s.positions.some(p=>p.kind==='stock'&&p.availableDay>t.day))return go('今天买的 A 股，明天才能卖','睡下后进入次日；也可以先买卖其他可交易的持仓。',{type:'command',command:{type:'day_next'}});
 if(desk){
  if(desk==='gambling'&&s.flags.gambling_quit)return go('已离开赌桌','可返回投资市场或生活安排。',{type:'desk-back'});
  const access=desk==='gambling'?getGamblingAccess(s):getMarketAccess(s,desk);
  if(!access.unlocked)return go('这张桌还没开放，先看缺什么',access.reason,{type:'market-rules',product:desk});
  return go('可以继续操作，也可以让行情往前走',`本日还剩 ${t.energy} 次市场操作。看完持仓后，可以推进一段行情；睡觉时结算一天生活费。`,{type:'command',command:{type:'day_next'}});
 }
 const g=goalStatus(s);
 if(g.done)return go('这个小目标已经达成','可选择下一个目标。',{type:'goals'});
 if(g.route.type==='life-action'&&!getActionAvailability(s,{type:g.route.action}).allowed)return go('精力已用完，市场仍可继续','可继续交易或推进时间。',{type:'tab',tab:'market'});
 return go(g.title,g.hint,g.route);
}
export const INLINE_ACTIONS=new Set(['living_plan','routine_days','day_next','day_activity','day_event_choice','work','gig','child_buy','child_price','child_sell','child_decline','child_clear','live_days','wait_days','life_visit','life_offer','desk_order','desk_sell','desk_research','desk_manage','market_tick','market_day','stock_card','crypto_replay','gamble','gamble_observe','invest','sell','market_practice','market_review','calendar_day','survival_day']);
export function needsMajorReceipt(before,after,action){
 const major=(after.presentations||[]).some(p=>(action.type==='gamble'?['judgment','release']:['wealth','wipeout','judgment','release']).includes(p.kind));
 return major||(action.type==='gamble'&&(before.cash>0&&after.cash===0||(after.trading.gambling.last?.multiplier||0)>=100));
}
