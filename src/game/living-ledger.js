// Living bills are expenses already incurred, not interest-bearing loans.
export const isLivingExpenseLabel=label=>/^(基本生活费欠款|今日基本伙食|住院医疗欠款|住院医疗费|临时开销：|消费：|家庭：|搬家费|搬家支出|搬家开销)/.test(label||'');
export const isLivingBill=d=>d.kind==='arrears'&&d.aprBps===0&&isLivingExpenseLabel(d.name);
export function livingLedger(s){
 const rows=[];
 for(const [index,e] of (s.ledger||[]).entries()){
  if(!isLivingExpenseLabel(e.label)||!(e.account==='cash'&&e.amount<0||e.account==='debt'&&e.amount>0))continue;
  const prev=rows.at(-1),unpaid=e.account==='debt';
  if(unpaid&&prev&&prev.index===index-1&&!prev.unpaid&&prev.label===e.label&&prev.date===e.date&&prev.day===e.lifeDay&&prev.turn===e.turn){prev.unpaid=e.amount;prev.total+=e.amount;continue;}
  rows.push({index,id:e.id,label:e.label,date:e.date,day:e.lifeDay,turn:e.turn,age:e.age,paid:unpaid?0:-e.amount,unpaid:unpaid?e.amount:0,total:Math.abs(e.amount)});
 }
 return rows.reverse();
}
export const livingBillName=name=>name==='基本生活费欠款'?'日常生活费':name==='住院医疗欠款'?'住院医疗费':name.replace(/^临时开销：/,'');
