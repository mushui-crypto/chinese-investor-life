import {applyStageShift,settleStageFocus,offerStageEvent} from './stage-plan.js';
import {shouldOfferDayOff} from './attendance.js';
import {lifeChapter} from './life-chapters.js';
import {calendarRows} from './debt-calendar.js';
import {dueWorkStory,showWorkStory} from './work-stories.js';
import {dailyEventRole} from './day-routine.js';

export function chapterDaysReason(s,a,api){
  if(!lifeChapter(s))return '当前不在成年生活阶段';
  if(s.phase!=='planning'||s.lifeArcs?.pending||s.behavior?.pending||s.dayRoutine?.pending)return '先处理眼前的故事或消息';
  if(s.legal?.prisonMonthsLeft>0)return '服刑期间沿用服刑日历';
  if(s.survival?.failed||api.survival(s).needsCare)return '先处理健康问题';
  if(!Number.isSafeInteger(a.days)||a.days<1||a.days>30)return '每次最多推进 30 天';
  if(a.acceptDebt!==undefined&&(typeof a.acceptDebt!=='boolean'||a.acceptDebt&&a.days!==1))return '欠费结算每次只处理一天';
  if((s.debtClock?.periodDays||0)>=api.months(s)*30)return '本账期已结清';
  return '';
}

/** Simulate the actual daily accounts, pausing BEFORE an unaffordable day or bill. */
export function runChapterDays(state,a,api){
  const s=structuredClone(state),start=s.ledger.length,startDay=s.debtClock.day,t=s.trading;
  api.ensureCalendar(s);s.debtClock.dailyWork=true;
  const target=Math.min(a.days,api.months(s)*30-s.debtClock.periodDays);
  const watch=new Map(s.positions.filter(p=>!p.frozen&&!['housing','angel','ponzi'].includes(p.kind)).map(p=>[p.id,p.value]));
  let reason='',kind='',marketPnl=0;
  const pause=(k,text)=>{kind=k;reason=text;};
  const funds=()=>{
    // A work shift may cross fatigue 65 today; quote the wage AFTER ordinary work.
    const projected=structuredClone(s);
    applyStageShift(projected,api);
    api.completeWork(projected);
    const v=api.survival(projected);
    if(v.shortage&&!a.acceptDebt){
      const fatigue=projected.behavior.fatigue>=65&&s.behavior.fatigue<65?'按今天的工作量，疲劳会达到 65，工作出错将使工资减少 25%。':'';
      pause('living',`${fatigue}今天生活费预计还差 ¥${(v.shortage/100).toFixed(2)}。可以先安排资金，或结算今天，未付固定费用记欠款，没吃到的伙食不收费。`);return false;
    }
    const due=calendarRows(s,api.months(s)).filter(d=>d.modern&&(d.overdue||d.days<=1)).reduce((n,d)=>n+(d.overdue?d.arrears:d.due),0);
    if(!a.acceptDebt&&due>projected.cash+v.dailyIncome-Math.max(0,v.dailyExpense-v.foodPrepaid)){pause('bill','到期款不够支付，先处理还款。');return false;}
    return true;
  };
  const watchPositions=()=>{
    for(const [id,value]of watch){const p=s.positions.find(p=>p.id===id);
      if(!p||p.frozen){pause('position','持仓到期、强平或被冻结，先查看结果。');return;}
      if(value>0&&Math.abs(p.value-value)>=value*.2){pause('position','有持仓涨跌达到 20%，先看看要不要处理。');return;}
    }
  };
  while(s.debtClock.day-startDay<target){
    if(s.lifeArcs?.pending||s.behavior?.pending||s.dayRoutine?.pending){pause('event','有件事情需要你决定。');break;}
    if(api.survival(s).needsCare||s.survival.failed){pause('health','健康需要照料，先停下来。');break;}
    if(s.lifeArcs.promises.some(p=>p.status==='open'&&p.day<=s.debtClock.day+1)){pause('promise','约定的日子到了，先安排这件事。');break;}
    if(t.phase===3&&s.survival.lastBilledDay===t.day){
      t.day++;t.dayInTurn=Math.min(2,t.dayInTurn+1);t.phase=0;t.energy=6;
      api.openDay(s);api.resetRoutine(s,0);api.sleepingMorning(s);
      if(s.dayRoutine?.pending){pause('event','睡过头了，先处理今天的迟到。');break;}
    }
    if(shouldOfferDayOff(s)){pause('attendance','昨晚没睡好，先决定今天是否出勤。');break;}
    if(!funds())break;
    if(offerStageEvent(s,api)){
      const phase=s.dayRoutine.stage<2?0:s.dayRoutine.stage<4?1:2;
      while(t.phase<phase){const before=api.metrics(s);api.tick(s);const after=api.metrics(s);api.track(s,after.netWorth-before.netWorth);}
      pause('event','这段日子里，有件事需要你决定。');break;
    }
    // Keep authored follow-ups from disappearing in the ordinary-day montage.
    const r=s.dayRoutine;
    if(r&&!r.checked.includes('event')){
      const stage=[1,2,3,5,6].find(stage=>stage>=r.stage&&dueWorkStory(s,stage,dailyEventRole(s)));
      if(stage!==undefined){
        r.stage=stage;r.pending=dueWorkStory(s,stage,dailyEventRole(s));r.checked.push('event');showWorkStory(s,r.pending);
        // The pending story is the next action; time before it still marks the market.
        const phase=stage<2?0:stage<4?1:2;
        while(t.phase<phase){const before=api.metrics(s);api.tick(s);const after=api.metrics(s);api.track(s,after.netWorth-before.netWorth);}
        pause('event','之前的工作往来有了后续。');break;
      }
    }
    const jobHistory=s.employment?.history.length||0,hadJob=s.monthlyIncome,ledgerStart=s.ledger.length;
    const jobDue=s.lifeArcs.jobs.some(j=>j.due<=s.debtClock.day+1);
    while(t.phase<3){
      const before=api.metrics(s),nightStage=s.dayRoutine?.stage;
      if(t.phase===2)applyStageShift(s,api);
      api.tick(s);
      if(s.dayRoutine)s.dayRoutine.stage=nightStage===7?7:[1,2,4,8][t.phase];
      const after=api.metrics(s),pnl=after.netWorth-before.netWorth;marketPnl+=pnl;
      api.track(s,pnl);
      watchPositions();
      if(s.lifeArcs.pending||s.behavior.pending)pause('event','收到一条新消息。');
      if(reason)break;
    }
    // Even when interrupted at the close, do not charge a day the player cannot afford.
    if(t.phase===3&&funds()){
      api.captureWage(s);api.settle(s);api.sleep(s);settleStageFocus(s,api);s.actionPoints=2;
    }
    if(s.survival.failed||api.survival(s).needsCare)pause('health','健康需要照料，先停下来。');
    else if(s.lifeArcs.pending||s.behavior.pending)pause('event','收到一条新消息。');
    else if((s.employment?.history.length||0)>jobHistory||s.monthlyIncome!==hadJob)pause('work',s.employment?.history.at(-1)?.text||'工作收入有了变化。');
    else if(jobDue)pause('job','接下的活有结果了。');
    else if(s.ledger.slice(ledgerStart).some(e=>e.account==='cash'&&e.amount< -api.survival(s).dailyExpense*7))pause('expense','有一笔较大的支出，先看看账单。');
    if(reason)break;
  }
  const merged=new Map(),rows=[];
  for(const e of s.ledger.slice(start)){
    const merge=e.account==='cash'&&['当日工资结算','基本生活费欠款'].includes(e.label);
    if(merge&&merged.has(e.label))merged.get(e.label).amount+=e.amount;
    else{if(merge)merged.set(e.label,e);rows.push(e);}
  }
  s.ledger.splice(start,s.ledger.length-start,...rows);
  return {state:s,days:s.debtClock.day-startDay,marketPnl,kind,reason};
}
