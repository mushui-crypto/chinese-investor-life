/** Passive company news still affects prices. Legacy research records are validated only for save compatibility. */
const LEGACY_SOURCES=new Set(['orders','cash','contacts']);
function sample(s,id,day,salt){let n=2166136261;for(const c of `${s.seed}|disclosure|${id}|${day}|${salt}`)n=Math.imul(n^c.charCodeAt(0),16777619);n^=n>>>16;n=Math.imul(n,0x45d9f3b);n^=n>>>16;return (n>>>0)/4294967296;}
function facts(s,id,day){const pick=k=>sample(s,id,day,k);const orders=(Math.round(pick('orders')*60-20)||0),cash=Math.round(pick('cash')*100),expected=(Math.round(pick('expected')*48-14)||0);return {orders,cash,expected,actual:(Math.round(orders*.7+(cash-50)*.22+(pick('audit')-.5)*12)||0),rumor:Math.round(orders+(pick('rumor')-.5)*40)};}
export function upbringing(s){return s.childhood?.summary?.path||null;}
export function visibleLifeDay(s){return Math.max(1,(s.debtClock?.day||0)+(s.trading.phase===3&&s.survival?.lastBilledDay===s.trading.day?0:1));}
// Announcement effect is shared by every position in this company; market/sector noise still applies.
export function disclosureMove(s,id){if(s.trading.phase!==2)return 0;const f=facts(s,id,s.trading.day);return Math.max(-.065,Math.min(.065,(f.actual-f.expected)*.0018));}
export function validateIntelligence(s){const t=s.trading;t.disclosures??=[];if(!Array.isArray(t.disclosures)||t.disclosures.length>120)throw Error('公告复盘记录无效');
 for(const r of t.disclosures){if((r.lifeDay!==undefined&&(!Number.isSafeInteger(r.lifeDay)||r.lifeDay<1||r.lifeDay>(s.debtClock?.day||0)+1))||!Number.isSafeInteger(r.day)||r.day<0||r.day>t.day||typeof r.id!=='string'||r.id.length>60||!['expected','actual','cash','before','after'].every(k=>Number.isSafeInteger(r[k]))||r.before<1||r.after<1||Math.abs(r.expected)>100||Math.abs(r.actual)>100||r.cash<0||r.cash>100||!Array.isArray(r.sources)||r.sources.length>3||r.sources.some(k=>!LEGACY_SOURCES.has(k)))throw Error('公告复盘记录无效');}
}
