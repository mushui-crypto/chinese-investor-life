import {CRYPTO_LEVERAGES,cryptoMaintenanceRate} from '../game/crypto-markets.js';
import {upbringing} from '../game/market-intelligence.js';
export const PATHS={study:['读书求知','童年多读书，积累学业、自律、本事和眼力。'],practical:['动手与生活','每期第一次认真打工或接零活，多赚 10%。'],social:['亲友往来','童年多和亲友往来，积累人缘，也可能错过部分学业成长。']};
export function renderUpbringing(s,{esc}){if(s.age<6)return '';const p=PATHS[upbringing(s)];return p?`<details class="upbringing-note"><summary>童年练出的本事 · ${p[0]}</summary><p>${esc(p[1])}</p><small>18 岁后固定。</small></details>`:'';}
export function contractExamples(a){
 if(!['futures','crypto_perp'].includes(a.product)||!Number.isSafeInteger(a.amount)||a.amount<=0||!(a.product==='crypto_perp'?CRYPTO_LEVERAGES:[2,5,10]).includes(a.leverage)||!['long','short'].includes(a.direction))return null;
 const exposure=a.amount*a.leverage;if(!Number.isSafeInteger(exposure))return null;
 const minimum=a.product==='crypto_perp'?Math.round(exposure*cryptoMaintenanceRate(a.leverage)):Math.round(a.amount*.1),fee=Math.round(exposure*.0002),distance=Math.max(0,(a.amount-minimum-fee)/exposure*100);
 return {fee,distance,rows:[1,3].map(percent=>{const change=Math.round(exposure*percent/100),left=Math.max(0,a.amount-change-fee);return {percent,gain:change-fee,loss:Math.min(a.amount,change+fee),liquidated:left<=minimum};})};
}
export function renderContractRisk(a,{money}){const example=contractExamples(a);if(!example)return '';
 return `<details class="contract-scenarios" open><summary>盈亏与强平估算</summary><div><span>下一时段持仓费用</span><b>${money(example.fee)}</b></div>${example.rows.map(r=>`<div><span>${a.direction==='short'?'下跌':'上涨'} ${r.percent}%</span><b>预计盈利 ${money(r.gain)}</b></div><div><span>${a.direction==='short'?'上涨':'下跌'} ${r.percent}%</span><b>${r.liquidated?'触发强平，最多亏损':'预计亏损'} ${money(r.liquidated?a.amount:r.loss)}</b></div>`).join('')}<p>${a.direction==='short'?'上涨':'下跌'}约 ${example.distance.toFixed(2)}% 可能触发强制平仓。逐仓最多亏损本单保证金；借款仍需偿还。</p><small>按下一段行情估算，已扣费用。日内波动可提前触发强平。</small></details>`;
}
