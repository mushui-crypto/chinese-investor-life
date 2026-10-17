/** Thirty-day game months. Existing unsigned schedules keep their original period terms. */
export function newDebtClock(){return {day:0,periodDays:0,dailyMode:false,dailyWork:false};}
export function debtClock(s){return s.debtClock||newDebtClock();}
export function attachSchedule(s,d){d.calendar={nextDay:debtClock(s).day+30,principalDue:0,monthlyPrincipal:Math.ceil(d.principal/Math.max(1,d.monthsLeft)),extensions:0,lastPenaltyDay:-1};}
export function calendarRows(s,months){
 const clock=debtClock(s);
 return s.debts.map(d=>({id:d.id,name:d.name,balance:d.principal+d.interest,overdue:d.overdue,modern:Boolean(d.calendar),days:d.calendar?Math.max(0,d.calendar.nextDay-clock.day):Math.max(0,months*30-clock.periodDays),due:d.calendar?Math.min(d.principal,d.calendar.principalDue+d.calendar.monthlyPrincipal)+d.interest+Math.round(d.principal*d.aprBps/120000):d.principal+d.interest,arrears:d.calendar?d.calendar.principalDue+d.interest:0})).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||a.days-b.days);
}
export function extensionTerms(s,d){
 let reason='';
 if(!d)reason='这笔债务已经不存在';
 else if(!d.calendar)reason='旧约沿用原账期，仍可提前偿还';
 else if(d.kind==='shark')reason='对方拒绝展期，只接受还款';
 else if(d.overdue)reason='已经逾期，先处理到期欠款';
 else if(d.calendar.extensions>=1)reason='这笔借款已展期一次';
 else if(['family','friend'].includes(d.kind)?s.stats.trust<40:s.stats.credit<35)reason='关系或信用不足，对方不接受展期';
 const fee=d?Math.round(d.principal*.02):0,interest=d?Math.round(d.principal*d.aprBps/120000):0;
 if(!reason&&s.cash<fee)reason='现金不足以支付本次展期费';
 return {reason,fee,interest,days:30};
}
export function extendDebt(s,d,api){const q=extensionTerms(s,d);if(q.reason)throw Error(q.reason);api.cashChange(s,-q.fee,'协商展期费用');d.interest+=q.interest;if(q.interest)api.record(s,'debt',q.interest,'展期增加一个月利息',{debtId:d.id});d.calendar.nextDay+=30;d.calendar.extensions++;return `还款日推迟 30 天，现金支付费用 ¥${q.fee/100}，新增利息 ¥${q.interest/100}；本金 ¥${d.principal/100} 仍在。`;}
export function storyExtension(s){
 const legacy=s.debts.filter(d=>!d.calendar),modern=s.debts.find(d=>d.calendar&&!extensionTerms(s,d).reason),q=modern?extensionTerms(s,modern):null;
 return {legacy,modern,reason:legacy.length||modern?'':'当前债务不符合展期条件，先处理到期款或补足费用',hint:modern?`协商成功时：${modern.name}延后 30 天，费用 ¥${q.fee/100}，另增利息 ¥${q.interest/100}${legacy.length?'；旧约沿用原展期规则':''}。失败不扣款。`:'协商成功时按旧约调整期限，本金和已计利息仍须偿还。'};
}

export function advanceDebtClock(s,days,api,notes=[]){
 s.debtClock??=newDebtClock();const c=s.debtClock,target=c.day+days;
 if(!Number.isSafeInteger(days)||days<0||days>3600)throw Error('还款日历推进无效');
 // Due dates are processed chronologically across creditors, including a compressed life period.
 for(let guard=0;guard<20000;guard++){
  const d=s.debts.filter(d=>d.calendar&&d.calendar.nextDay<=target).sort((a,b)=>a.calendar.nextDay-b.calendar.nextDay||a.id.localeCompare(b.id))[0];if(!d)break;
  const dueDay=d.calendar.nextDay,k=d.calendar;
  const interest=api.mul(d.principal,d.aprBps/120000);d.interest+=interest;if(interest)api.record(s,'debt',interest,`${d.name}月度利息`,{debtId:d.id});
  k.principalDue=Math.min(d.principal,k.principalDue+k.monthlyPrincipal);d.monthsLeft=Math.max(0,d.monthsLeft-1);
  const due=k.principalDue+d.interest,paid=api.payDebt(s,Math.min(s.cash,due),d.id);
  if(s.debts.includes(d)){
   d.overdue=k.principalDue+d.interest>0;
   if(d.overdue){api.stat(s,{credit:-5,stress:5});if(['family','friend'].includes(d.kind))api.stat(s,{trust:-6});if(d.kind==='shark')api.stat(s,{stress:10,health:-2});if(d.kind==='card')api.stat(s,{credit:-5});k.lastPenaltyDay=dueDay;}
   k.nextDay=dueDay+30;
  }
  notes.push(`第 ${dueDay} 天 · ${d.name}到期 ¥${due/100}，实际还款 ¥${paid/100}${d.overdue?'，未还部分继续记账'+(d.kind==='shark'?'；催收电话增加压力并影响健康':d.kind==='card'?'；信用卡额度被冻结':''):'，本次账单已付清'}。`);
  if(guard===19999)throw Error('还款日历记录过多');
 }
 c.day=target;c.periodDays+=days;return notes;
}

export function validateDebtClock(s){
 s.debtClock??=newDebtClock();const c=s.debtClock,bad=()=>{throw Error('存档中的还款日历无效');},int=(x,min=0)=>{if(!Number.isSafeInteger(x)||x<min)bad();};
 if(!c||typeof c!=='object'||Array.isArray(c))bad();if(c.dailyMode===undefined)c.dailyMode=false;if(typeof c.dailyMode!=='boolean')bad();if(c.dailyWork===undefined)c.dailyWork=Boolean(c.dailyMode||s.survival?.active||c.periodDays>3);if(typeof c.dailyWork!=='boolean')bad();int(c.day);int(c.periodDays);if(c.periodDays>c.day)bad();
 if(!Array.isArray(s.debts))bad();
 for(const d of s.debts){const k=d.calendar;if(k===undefined)continue;if(!k||typeof k!=='object'||Array.isArray(k))bad();for(const x of ['nextDay','principalDue','monthlyPrincipal','extensions'])int(k[x]);int(k.lastPenaltyDay,-1);if(k.nextDay<=c.day||k.principalDue>d.principal||!k.monthlyPrincipal||k.extensions>1||k.lastPenaltyDay>c.day)bad();}
}
