import {receiptSummary,renderInlineReceipt} from './play-guide-panel.js';

// A visible receipt rail; rendering never changes the life save or its RNG.
export function renderTradeMailbox(s,ctx){
 const q=receiptSummary(s);
 return `<aside id="trade-inbox" class="trade-inbox" aria-labelledby="trade-inbox-title" tabindex="-1"><header class="inbox-heading">${ctx.icon('mail')}<div><h2 id="trade-inbox-title">成交明细</h2>${q?'<span>最新回执</span>':''}</div></header>${q?`<div class="inbox-letter">${renderInlineReceipt(s,ctx,{expanded:true})}</div>`:'<div class="inbox-empty">暂无成交。</div>'}</aside>`;
}
