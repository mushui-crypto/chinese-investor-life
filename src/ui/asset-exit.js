import {tradeTerms} from '../game/trade-terms.js';
import {cryptoModeFor} from '../game/crypto-markets.js';
import {getActionAvailability,PRODUCTS} from '../game/core.js';
import {deskOf} from '../game/market-play.js';

/** The same holding uses the same market action from either screen. Shops keep their life action. */
export function assetExit(s,p){
 const market=Boolean(p.managed),action=market?{type:'desk_sell',id:p.id,bps:10000}:{type:'sell',id:p.id};
 const access=s.phase==='planning'?getActionAvailability(s,action):{allowed:false,reason:`先处理眼前的故事，再安排${tradeTerms(p.kind).close}`};
 return {action,...access,market,desk:market?deskOf(p.kind):null,mode:cryptoModeFor(p),label:p.kind==='ponzi'?'申请提现':tradeTerms(p.kind).close,cost:market?'用 1 次市场操作':'用 1 点精力'};
}
export function renderHolding(s,p,{money,esc,terms}){
 const exit=assetExit(s,p);
 return `<article class="holding" data-position-id="${esc(p.id)}"><div class="holding-description"><h3>${esc(p.name||PRODUCTS[p.kind]?.name||'持有资产')}</h3><p>${esc(terms)}</p><p class="holding-exit-reason ${exit.allowed?'':'is-blocked'}">${esc(exit.allowed?exit.cost:exit.reason)}</p></div><div class="holding-value"><strong>${money(p.value,true)}</strong><small>投入 ${money(p.cost,true)}</small></div><div class="holding-actions"><button class="button small" data-action="sell" data-id="${esc(p.id)}" ${exit.allowed?'':'disabled'} title="${esc(exit.allowed?exit.cost:exit.reason)}">${exit.label}</button>${exit.market?`<button class="text-button" data-action="desk-open" data-product="${exit.desk}" data-instrument="${esc(p.instrument||'')}" data-mode="${exit.mode}" data-area="holdings">去交易室 →</button>`:''}</div></article>`;
}
