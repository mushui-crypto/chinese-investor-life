import {renderCryptoLedger} from './crypto-ledger.js';
import {renderMarketHeading} from './market-heading.js';
import {getMarketAccess} from '../game/market-access.js';
import {cryptoChartBars} from './crypto-chart.js';
import {quoteFor} from '../game/market-play.js';
import {CRYPTO_COINS,MEME_COINS,isRugged} from '../game/crypto-markets.js';
import {cryptoReference} from '../game/crypto-history.js';
import {renderDailyChart} from './daily-chart.js';
const price=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:n>0&&n<1?5:2,maximumFractionDigits:n>0&&n<1?6:2});
const quoted=(q,id,n=q.price)=>(q.baseUSDT||cryptoReference(id))*n/(q.scale||10000);
export function renderCryptoTerminal({s,t,selected,cryptoMode,order,controls,lock,rows,position,context}){
 const {money,esc,icon}=context,meme=cryptoMode==='meme',coins=meme?MEME_COINS:CRYPTO_COINS;
 const q=quoteFor(s,'crypto',selected.id),quote=quoted(q,selected.id),change=q.open?(q.price/q.open-1)*100:0;
 const failed=isRugged(s,selected.id),restricted=s.positions.some(p=>p.instrument===selected.id&&p.honeypot);
 return `<section class="market-desk crypto-terminal" data-desk="crypto">${renderMarketHeading('crypto','币易交易所','globe',{icon,s})}
 ${context.quickbar}<div class="terminal-modes" role="group" aria-label="加密交易类型">${[['spot','现货'],['perp','合约'],['meme','ignite.fun · Meme']].filter(([id])=>id!=='perp'||getMarketAccess(s,'crypto_perp').unlocked).map(([id,label])=>`<button data-action="crypto-mode" data-mode="${id}" class="button small ${cryptoMode===id?'active':''}" aria-pressed="${cryptoMode===id}">${label}</button>`).join('')}</div>${controls}${lock}
 <div class="terminal-grid"><aside class="coin-watchlist"><h2>${meme?'ignite.fun':'交易币种'} <small>${coins.length} 个 · USDT</small></h2><div class="coin-table-head"><span>币种</span><span>最新价</span></div><div class="coin-rows">${coins.map(i=>{const qi=quoteFor(s,'crypto',i.id);return `<button class="coin-row ${i.id===selected.id?'selected':''}" data-action="desk-instrument" data-id="${i.id}" aria-pressed="${i.id===selected.id}"><span><strong>${esc(meme?i.name:i.id.replace('USDT',''))}<small> / USDT</small></strong><small>${isRugged(s,i.id)?'停止交易':i.tag}</small></span><b>${price(quoted(qi,i.id))}</b></button>`;}).join('')}</div></aside>
 <div class="terminal-chart-area"><div class="symbol-strip"><div><strong>${esc(selected.name)}</strong><span>${failed?'已归零 · 停止交易':cryptoMode==='perp'?'逐仓 · 每日结清':'24 小时交易 · 可跨期持有'}</span></div><div><b class="${change>=0?'crypto-up':'crypto-down'}">${price(quote)}</b><small class="${change>=0?'crypto-up':'crypto-down'}">${change>=0?'+':''}${change.toFixed(2)}%</small></div></div>
 ${renderDailyChart(s,q,{esc,continuous:true,bars:cryptoChartBars(s,selected.id,q),title:selected.name+' · 行情',formatPrice:n=>price(quoted(q,selected.id,n)),displayScale:quoted(q,selected.id,1),decimals:quote>0&&quote<.01?6:2})}
 ${restricted?'<p class="crypto-status">卖出被项目方拦住了。账面金额提不出来，可在持仓中留证追偿。</p>':''}${failed?'<p class="crypto-status">项目撤走了流动性，持仓已经按零结算。</p>':''}
 <details class="source-note"><summary>ⓘ 行情与玩法</summary><p>${meme?'新币可能暴涨，也可能无法卖出或突然归零。':'现货全天可买卖；合约可提前平仓，每日结算时自动结清。'}</p><p>日 K 按游戏日期记录，部分波动参考历史行情。合约强平计入日内高低价。</p><a href="https://github.com/binance/binance-public-data" target="_blank" rel="noopener">历史数据来源 ↗</a></details></div>
 <aside class="terminal-order" aria-label="加密下单">${order}</aside></div>
 ${renderCryptoLedger(s,cryptoMode,rows,context)}</section>`;
}
