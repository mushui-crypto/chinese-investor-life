import {lifeChapter} from './life-chapters.js';
import {act,nextTurn} from './narrative.js';
import {getMetrics,getSurvivalStatus,getTurnMonths,getActionAvailability} from './core.js';
import {gameDate} from './game-calendar.js';

export function chapterPause(s){
  if(s.phase==='ended'||s.survival?.failed)return {kind:'ended',reason:'这段人生已经结束。'};
  if(s.phase!=='planning')return {kind:'event',reason:'先看完眼前的故事，再继续生活。'};
  if(s.dayRoutine?.pending||s.lifeArcs?.pending||s.behavior?.pending)return {kind:'event',reason:'有件事情需要你决定。'};
  if(s.legal?.prisonMonthsLeft>0)return {kind:'prison',reason:'服刑期间沿用服刑日历。'};
  if(getSurvivalStatus(s).needsCare&&(s.debtClock?.periodDays||0)<getTurnMonths(s)*30)return {kind:'health',reason:'健康告急，暂停快速推进。可以安排就医，或暂不治疗、逐日生活。'};
  return null;
}
export function chapterTrip(s){
  const c=lifeChapter(s);
  if(!c)return null;
  return {from:gameDate(s),to:gameDate(s),target:c.end,days:0,income:0,spending:0,cash:0,worth:0,holdings:0,debt:0,trust:0,kind:'',reason:'',changes:{}};
}
export function canSettleChapterDay(s){
  if(!lifeChapter(s)||chapterPause(s))return false;
  if((s.debtClock?.periodDays||0)>=getTurnMonths(s)*30)return true;
  return getActionAvailability(s,{type:'chapter_days',days:1,acceptDebt:true}).allowed;
}
export function addChapterReceipt(trip,before,after,stop){
  const b=getMetrics(before),m=getMetrics(after),entries=after.ledger.slice(before.ledger.length).filter(e=>e.account==='cash');
  const food=after.survival?.last,hasNewFood=food?.foodDue!==undefined&&after.survival.lastBilledDay!==before.survival?.lastBilledDay;
  return {...trip,to:gameDate(after),days:trip.days+Math.max(0,(after.debtClock?.day||0)-(before.debtClock?.day||0)),
    ...(hasNewFood?{lastFood:{foodDue:food.foodDue,foodPaid:food.foodPaid,healthLost:food.healthLost,hospital:food.hospital}}:{}),
    income:trip.income+entries.reduce((sum,e)=>sum+Math.max(0,e.amount),0),
    spending:trip.spending+entries.reduce((sum,e)=>sum+Math.max(0,-e.amount),0),
    cash:trip.cash+after.cash-before.cash,worth:trip.worth+m.netWorth-b.netWorth,holdings:trip.holdings+m.invested-b.invested,debt:(trip.debt||0)+m.debt-b.debt,
    trust:trip.trust+after.stats.trust-before.stats.trust,changes:Object.fromEntries([...Object.keys(before.stats),'fatigue'].map(k=>[k,(trip.changes?.[k]||0)+(k==='fatigue'?after.behavior.fatigue-before.behavior.fatigue:after.stats[k]-before.stats[k])])),kind:stop?.kind||'',reason:stop?.reason||''};
}
export function stopChapterTrip(trip,reason='停在这里，已经过去的日子和收支都已保存。'){
  return {...trip,kind:'manual',reason};
}
/** One bounded chunk. No event choices, new positions, loans or asset sales are automated. */
export function advanceChapterStep(s,catalog,trip,{settleDay=false}={}){
  let stop=chapterPause(s);
  const c=lifeChapter(s);
  if(!stop&&(!c||s.age>=trip.target))stop={kind:'complete',reason:`已经来到 ${trip.target} 岁，新的一章开始了。`};
  if(stop)return {state:s,trip:{...trip,...stop},stop};
  const full=(s.debtClock?.periodDays||0)>=getTurnMonths(s)*30;
  if(full){
    const months=getTurnMonths(s),legacyDue=s.debts.filter(d=>!d.calendar).reduce((total,d)=>total+
      (d.monthsLeft>0?Math.min(d.principal,Math.round(d.principal*Math.min(months,d.monthsLeft)/d.monthsLeft)):d.principal)+
      d.interest+Math.round(d.principal*d.aprBps/10000*months/12),0);
    if(legacyDue>s.cash&&!settleDay){stop={kind:'bill',reason:'旧约到期款不够支付。可以先处理还款，或保留欠款进入下一账期，按规则承担逾期后果。'};return {state:s,trip:{...trip,...stop},stop};}
  }
  const next=full?nextTurn(s,catalog):act(s,{type:'chapter_days',days:settleDay?1:30,...(settleDay?{acceptDebt:true}:{})},catalog);
  if(next.lastResult?.error)stop={kind:'error',reason:next.lastResult.error};
  else if(next.lastResult?.chapterRun?.reason&&!full)stop={kind:next.lastResult.chapterRun.kind,reason:next.lastResult.chapterRun.reason};
  else stop=chapterPause(next);
  if(full&&!stop){
    if(s.monthlyIncome!==next.monthlyIncome||s.occupation!==next.occupation)stop={kind:'work',reason:'身份或收入发生变化，看看接下来的安排。'};
    else if(s.positions.some(p=>{const held=next.positions.find(h=>h.id===p.id);return !held||held.frozen&&!p.frozen||p.value>0&&Math.abs(held.value-p.value)>=p.value*.2;}))stop={kind:'position',reason:'持仓结算有了较大变化，先查看结果。'};
  }
  if(!stop&&next.age>=trip.target)stop={kind:'complete',reason:`已经来到 ${trip.target} 岁，新的一章开始了。`};
  if(!stop&&next.age===s.age&&next.debtClock.day===s.debtClock.day)stop={kind:'pause',reason:'有件事情需要先处理，再继续生活。'};
  if(!stop&&settleDay)stop={kind:'day',reason:full?'本期已结算，欠款继续保留，利息与逾期照常计算。':'今天已结算，精力恢复至 2。未付清的费用已记为欠款，可以继续安排开支或筹措资金。'};
  const summary=addChapterReceipt(trip,s,next,stop);
  // Save a receipt at every checkpoint; reloading never resumes time advancement on its own.
  const state=next===s?structuredClone(next):next;
  state.chapterSummary=summary;
  return {state,trip:summary,stop};
}
