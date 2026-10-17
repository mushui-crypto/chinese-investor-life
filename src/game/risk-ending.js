/** Endings describe the played ledger; they never place another bet or erase assets. */
import {gamblingAudit} from './gambling.js';
// Kept only to verify already-ended v1 saves, never used to decide a new ending.
const LEGACY_ALL_IN_RUIN_PERCENT=85;
const speculative=new Set(['stock','option','option_short','futures','crypto','crypto_perp','ponzi','angel']);
function fate(seed){let h=2166136261;for(const c of `${seed}|last-stake-v1`)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)%100;}
export function newRiskLife(s){return {allIns:0,lastAllInTurn:null,lastAllInCapital:null,fate:fate(s.seed),terminal:null};}
export function riskLife(s){return s.riskLife||newRiskLife(s);}
const capital=s=>s.cash+s.positions.reduce((n,p)=>n+p.value,0)+s.businesses.reduce((n,b)=>n+b.value,0)+s.claims.reduce((n,c)=>n+c.value,0);
export function recordRiskCommitment(s,cash,product,committed,wealth=capital(s)){
 if(!speculative.has(product)||cash<=0||committed<Math.ceil(cash*.9)||committed<Math.ceil(wealth*.75))return;
 const r=s.riskLife??=newRiskLife(s);r.allIns++;r.lastAllInTurn=s.turn;r.lastAllInCapital=wealth;
}
export function recordRiskOrder(s,before,a){
 let product=a.product;
 if(a.type==='desk_manage'&&['margin','follow'].includes(a.operation))product=before.positions.find(p=>p.id===a.id)?.kind;
 else if(!['invest','desk_order'].includes(a.type))return;
 // Count the actual commitment, including existing fees, never a button's label.
 recordRiskCommitment(s,before.cash,product,before.cash-s.cash,capital(before));
}
export function hasGambled(s){return (s.behavior?.onlineGambling?.totalBets||0)>0||(s.trading?.gambling?.rounds||0)>0||(s.legal?.cases||[]).some(c=>c.type==='gambling')||(s.behavior?.platformPaid||0)>0;}
export function riskEndingKind(s,metrics){
 const r=riskLife(s);if(r.terminal)return r.terminal.kind;
 // A survival failure has its own cause and ending; an old bet must not override it.
 if(s.survival?.failed||metrics.netWorth>0)return null;
 if(s.behavior?.stopped&&s.behavior.cleanDays>=30)return null;
 const g=gamblingAudit(s),platformRecovery=(s.claims||[]).find(c=>c.id===s.behavior?.platformClaimId)?.recovered||0;
 const online=s.behavior?.onlineGambling;
 const gamblingLoss=(online?.totalBets?-online.netProfit:-g.tableNet)+g.assessedBills+g.pendingBills+(s.behavior?.platformPaid||0)-platformRecovery;
 // Do not attribute an unrelated later bankruptcy to a small, long-ago wager.
 if(hasGambled(s)&&!['QUIT','RECOVERED'].includes(online?.status)&&gamblingLoss>=Math.max(1,metrics.monthlyExpense,s.peakNetWorth*.5))return 'gambling';
 if(r.allIns>=3&&r.lastAllInTurn!==null&&s.turn-r.lastAllInTurn<=4&&!s.flags.voluntary_exit&&r.lastAllInCapital>0&&metrics.assets<=r.lastAllInCapital*.25)return 'allin';
 return null;
}
export function validateRiskLife(s){
 s.riskLife??=newRiskLife(s);const r=s.riskLife,bad=()=>{throw Error('人生清算记录无效');};
 const int=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(n)||n<min||n>max)bad();};
 if(!r||typeof r!=='object'||Array.isArray(r))bad();int(r.allIns);int(r.fate,0,99);if(r.fate!==fate(s.seed))bad();
 if(r.lastAllInTurn!==null)int(r.lastAllInTurn,0,s.turn);if(Boolean(r.allIns)!==(r.lastAllInTurn!==null))bad();
 // Old running saves have no reliable commitment snapshot. Do not invent one.
 if(r.lastAllInCapital===undefined)r.lastAllInCapital=null;
 if(r.lastAllInCapital!==null){int(r.lastAllInCapital,1);if(!r.allIns)bad();}
 if(r.terminal!==null){const t=r.terminal;if(!t||typeof t!=='object'||!['gambling','allin'].includes(t.kind))bad();int(t.turn,0,s.turn);if(t.age!==s.age||t.turn!==s.turn||s.phase!=='ended')bad();
  for(const k of ['cash','holdings','business','claims','inventory','total','debt'])int(t[k]);
  if(t.total!==t.cash+t.holdings+t.business+t.claims+t.inventory||s.cash!==0||s.positions.some(p=>p.value)||s.businesses.some(b=>b.value)||s.claims.some(c=>c.value))bad();
  if(!s.flags[t.kind==='gambling'?'gambling_final_loss':'allin_final_loss'])bad();
  if(t.kind==='gambling'&&!hasGambled(s)||t.kind==='allin'&&(r.allIns<3||r.fate>=LEGACY_ALL_IN_RUIN_PERCENT))bad();
  if(t.debt!==s.debts.reduce((n,d)=>n+d.principal+d.interest,0))bad();
  if(!Array.isArray(t.ledgerIds)||new Set(t.ledgerIds).size!==t.ledgerIds.length)bad();
  const rows=t.ledgerIds.map(id=>s.ledger.find(e=>e.id===id));if(rows.some(e=>!e||e.amount>0||e.account==='debt'||!e.label.startsWith('尾声清算：'))||-rows.reduce((n,e)=>n+e.amount,0)!==t.total)bad();
 }
 return r;
}
