import {shouldOfferDayOff} from './attendance.js';
import {ensureCareer} from './careers.js';
import {routineState,dayOptions,DAILY_EVENTS} from './day-routine.js';
const day=s=>s.debtClock?.day||0;
export const routinePlan=s=>s.routinePlan??{days:7,evening:'rest',smallEvents:'pause'};
const valid=a=>Number.isInteger(a.days)&&a.days>=1&&a.days<=30&&['rest','learn','night_gig'].includes(a.evening)&&['pause','habit'].includes(a.smallEvents);
export function routinePlanReason(s,a,api){
 if(!valid(a))return '请选择 1–30 天、晚间安排和遇事处理方式';
 if(s.phase!=='planning'||s.age<18||s.age>=80||s.legal?.prisonMonthsLeft>0)return '先处理眼前的故事';
 if(s.dayRoutine?.pending||s.lifeArcs?.pending||s.behavior?.pending)return '眼前还有一件事，处理完再按作息过日子';
 if(api.survival(s).needsCare)return '健康已到就医线，先去医院';
 if(api.survival(s).active)return '今天的生活费还不够，先调整开支或安排周转';
 if((s.debtClock?.periodDays||0)>=api.months(s)*30)return '本期日账已结清，请进入下一阶段';
 return '';
}
const habits={overtime:'decline',coworker:'eat',commute:'message',family:'talk',neighbour:'chat',lunch:'eat',handover:'check',deadline:'order',work_error:'correct',praise:'credit',office_rumor:'wait',coworker_request:'decline',computer_crash:'help',client_revision:'confirm',help_newcomer:'manual',task_credit:'record',late_lunch:'callback',sleepy_shift:'water',office_group_tip:'mute',urgent_errand:'walk',meeting_overrun:'summarize',shift_cover:'split',resume_reply:'prepare',interview_deposit:'leave',gig_cancel:'search',free_class:'schedule',study_group:'divide',exam_week:'study',dorm_tip:'question',park_walk:'walk',community_phone:'learn',old_colleague:'reply',neighbor_parcel:'contact',broken_elevator:'wait',unread_family:'call',sleepless:'write',old_friend:'reschedule',secondhand:'close',found_wallet:'desk',price_alert:'mute'};
export function plannedActivity(s,plan){
 const r=routineState(s);if(r.choices[r.stage]||r.stage>=7)return {type:'day_next'};
 const options=dayOptions(s).map(c=>c[0]);
 let choice=['breakfast','focus','nap','focus','stretch',plan.evening,'sleep'][r.stage];
 if(!options.includes(choice))choice=options.includes('attend_class')?'attend_class':options.includes('coursework')?'coursework':r.stage===1?(s.occupation==='退休'?'rest':'job_hunt'):r.stage===3?(s.occupation==='退休'?'learn':'day_gig'):'rest';
 if(!options.includes(choice))choice=options[0];
 return choice?{type:'day_activity',choice}:{type:'day_next'};
}
/** Reuses the same action engine as manual play; never invents a bulk wage or skips a choice. */
export function runRoutinePlan(state,a,api,apply){
 let s=structuredClone(state);s.routinePlan={days:a.days,evening:a.evening,smallEvents:a.smallEvents};
 ensureCareer(s);
 const start=day(s),target=Math.min(a.days,api.months(s)*30-(s.debtClock?.periodDays||0)),watch=new Map(s.positions.filter(p=>!p.frozen&&!['housing','angel','ponzi'].includes(p.kind)).map(p=>[p.id,p.value]));
 const handled=[];let steps=0,reason='';
 while(day(s)-start<target&&steps<600){
  const r=routineState(s),e=DAILY_EVENTS[r.pending];
  if(s.lifeArcs?.pending||s.behavior?.pending){reason='有一条新消息，先看看。';break;}
  if(!e&&shouldOfferDayOff(s)){reason='昨晚没歇好，先决定今天上不上班。';break;}
  if(api.survival(s).needsCare||api.survival(s).active||s.survival?.failed||s.phase!=='planning'){reason='生活费或人生状态有变化，先停下来。';break;}
  if(s.debts.some(d=>d.calendar?.nextDay<=day(s)+1&&d.principal+d.interest>0)||s.lifeArcs.promises.some(p=>p.status==='open'&&p.day<=day(s)+1)){reason='有还款或约定快到期，先安排这件事。';break;}
  let action;
  if(e){
   const choice=a.smallEvents==='habit'&&!e.chain&&habits[r.pending];
   if(!choice){reason=e.title;break;}
   action={type:'day_event_choice',choice};
  }else{
   action=plannedActivity(s,a);
   // A full day of casual jobs leaves no capacity for an additional night shift.
   if(action.choice==='night_gig'&&!api.available(s,action).allowed)action={type:'day_activity',choice:'rest'};
  }
  const before=s,out=apply(s,action);
  if(out.result?.error){reason=out.result.error;break;}
  s=out.state;steps++;
  if(e)handled.push({day:day(before)-start+1,title:e.title,choice:e.choices.find(c=>c[0]===action.choice)[1]});
  const changed=[...watch].find(([id,value])=>{const p=s.positions.find(p=>p.id===id);return !p||value>0&&Math.abs(p.value-value)>=value*.2;});
  if(changed)reason=s.positions.some(p=>p.id===changed[0])?'有持仓涨跌达到 20%，先看账户。':'有持仓到期、强平或退出，先看结算。';
  else if(s.monthlyIncome!==before.monthlyIncome||s.occupation!==before.occupation)reason='工作状态有变化，接下来的日子重新安排。';
  else if((s.employment?.history.at(-1)?.day||0)>(before.employment?.history.at(-1)?.day||0))reason=s.employment.history.at(-1).text;
  else if((s.livingCosts?.lastAny||0)>(before.livingCosts?.lastAny||0))reason='有一笔临时开销，看看这次账单。';
  else if(before.lifeArcs.jobs.some(j=>!s.lifeArcs.jobs.some(n=>n.id===j.id)))reason='接下的活有结果了。';
  if(reason)break;
 }
 if(!reason){if(s.dayRoutine?.pending)reason=DAILY_EVENTS[s.dayRoutine.pending].title;else if(s.lifeArcs?.pending||s.behavior?.pending)reason='有一条新消息，先看看。';else if(api.survival(s).needsCare||api.survival(s).active||s.survival?.failed)reason='生活费不够了，先安排周转。';else reason=(s.debtClock?.periodDays||0)>=api.months(s)*30?'本期日账已结清。':'这段作息结束，接下来由你安排。';}
 // Keep a batch receipt instead of seven identical activity logs per day.
 // Event choices remain in that receipt; distinct liquidation/legal logs stay separate.
 const logs=s.logs.slice(state.logs.length).filter(row=>row.title!=='今天的安排');
 s.logs.splice(state.logs.length,s.logs.length-state.logs.length,...logs);
 const merged=new Map(),rows=[];
 for(const row of s.ledger.slice(state.ledger.length)){
  const merge=row.account==='cash'&&['当日工资结算','基本生活费欠款'].includes(row.label);
  if(merge&&merged.has(row.label))merged.get(row.label).amount+=row.amount;
  else{if(merge)merged.set(row.label,row);rows.push(row);}
 }
 s.ledger.splice(state.ledger.length,s.ledger.length-state.ledger.length,...rows);
 return {state:s,days:day(s)-start,steps,handled,reason};
}
export function validateRoutinePlan(s){if(s.routinePlan!==undefined&&(!s.routinePlan||!valid(s.routinePlan)))throw Error('常用作息安排无效');}
