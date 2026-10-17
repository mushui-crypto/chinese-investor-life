/** Reclassify only legacy wipeouts for which the ledger proves spendable cash remained. */
export function repairLegacyWipeouts(s){
 if(s.wipeoutRepairVersion===1)return s;
 const serial=id=>Number(String(id).split('-').at(-1));
 let removed=0;const invalidTurns=new Set();
 for(const log of s.logs){
  if(log.title!=='爆仓之后，人还在')continue;
  const n=serial(log.id);if(!Number.isSafeInteger(n))continue;
  const cashAtLog=s.cash-s.ledger.filter(e=>e.account==='cash'&&serial(e.id)>n).reduce((sum,e)=>sum+e.amount,0);
  if(cashAtLog<=0)continue;
  log.title='当时仍有现金，撤销归零判定';log.text='旧版本把生活费预留不足也计为归零。账本证明当时还有可用现金，本条不再计入归零次数；既有交易与账款保留。';log.kind='system';removed++;invalidTurns.add(log.turn);
 }
 if(removed){
  s.wipeouts=Math.max(0,s.wipeouts-removed);
  s.presentations=(s.presentations||[]).filter(p=>p.kind!=='wipeout'||!invalidTurns.has(p.turn));
  if(!s.wipeouts){s.flags.ever_wipeout=false;s.flags.rebuilding=false;s.lastWipeoutTurn=null;}
 }
 s.wipeoutRepairVersion=1;return s;
}
