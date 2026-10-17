import {renderOnlineGamblingLedger} from './online-gambling-ledger.js';
import {gamblingAudit} from '../game/gambling.js';
export function renderGamblingLedger(s,{money},ending=false){const a=gamblingAudit(s),life=renderOnlineGamblingLedger(s,{money},ending);if(!a.rounds)return life;
 const rows=`<dl><div><dt>累计下注</dt><dd>${money(a.staked)}</dd></div><div><dt>累计返还（含本金）</dt><dd>${money(a.returned)}</dd></div><div><dt>赌桌净输赢</dt><dd>${a.tableNet>0?'+':''}${money(a.tableNet)}</dd></div><div><dt>已经定下的网赌账单</dt><dd>${money(a.assessedBills)}</dd></div><div><dt>其中仍没还清</dt><dd>${money(a.unpaidBills)}</dd></div><div><dt>还有多少没结账</dt><dd>${money(a.pendingBills)}</dd></div></dl><p>追缴和罚款另计；未付部分记入欠款。</p>`;
 return life+(ending?`<section class="gambling-ledger ending-gambling-ledger"><h2>这 ${a.rounds} 局，最后留下了什么</h2><p>手里现金曾归零 ${a.busts} 次。</p>${rows}</section>`:`<details class="gambling-ledger"><summary>赌局总账 · 下注 ${a.rounds} 局${a.pendingBills?' · 还有账没结清':''}</summary>${rows}</details>`);
}
