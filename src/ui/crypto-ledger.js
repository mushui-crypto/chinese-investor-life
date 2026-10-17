import {MEME_COINS,CRYPTO_COINS} from '../game/crypto-markets.js';
import {legacyCryptoRecord} from '../game/crypto-records.js';
import {getActionAvailability} from '../game/core.js';
import {tradeTerms,positionSide} from '../game/trade-terms.js';

const actions={buy:'买入',sell:'卖出',open:'开仓',close:'平仓',liquidation:'强平',settlement:'每日结清'};
const isMeme=id=>MEME_COINS.some(c=>c.id===id);
const matchesMode=(product,id,mode)=>mode==='perp'?product==='crypto_perp':product==='crypto'&&isMeme(id)===(mode==='meme');
const tone=n=>n>0?'crypto-up':n<0?'crypto-down':'crypto-flat';
const delta=(n,money)=>(n>0?'+':'')+money(n);

export function cryptoHistory(s,mode){
 const trades=[],news=[];
 for(const j of s.trading.journal){
  if(j.crypto){if(matchesMode(j.crypto.product,j.crypto.instrument,mode))trades.push(j);continue;}
  const coin=[...CRYPTO_COINS,...MEME_COINS].find(c=>j.text.includes(c.id)||j.text.includes(c.name));
  if(!coin&&!/币圈|加密|新币|貔貅币/.test(j.text))continue;
  const trade=legacyCryptoRecord(j);
  if(trade){if(matchesMode(trade.product,trade.instrument,mode))trades.push(j);}
  else news.push(j);
 }
 return {trades:trades.reverse(),news:news.reverse()};
}

function positionRow(p,{s,esc,money,button}){
 const perp=p.kind==='crypto_perp',terms=tradeTerms(p.kind),profit=p.value-p.cost;
 const can=getActionAvailability(s,{type:'desk_sell',id:p.id,bps:10000});
 const pct=p.cost?`${profit>0?'+':''}${(profit/p.cost*100).toFixed(2)}%`:'—';
 return `<tr data-position-id="${esc(p.id)}"><td class="crypto-asset-cell" data-label="币种"><strong>${esc(p.name.replace(' · 日内合约',''))}</strong><small>${perp?`${positionSide(p)} · ${p.leverage||1} 倍 · 逐仓`:p.honeypot?'限制卖出':'现货'}</small></td><td class="crypto-value-cell" data-label="${perp?'当前权益':'当前市值'}">${money(p.value)}</td><td data-label="浮动盈亏" class="crypto-pnl-cell ${tone(profit)}"><b>${delta(profit,money)}</b><small>${pct}</small></td><td class="crypto-cost-cell" data-label="${perp?'保证金':'持仓成本'}">${money(perp?(p.margin??p.cost):p.cost)}</td><td class="crypto-position-actions" data-label="操作"><div>${button(terms.half,{type:'desk_sell',id:p.id,bps:5000},'crypto-exit-secondary')}${button(terms.all,{type:'desk_sell',id:p.id,bps:10000},'crypto-exit-primary')}${p.honeypot?button('留证追偿',{type:'desk_manage',id:p.id,operation:'evidence'}):''}</div>${!can.allowed?`<small class="position-restriction">${esc(can.reason)}</small>`:''}${perp?`<details class="crypto-margin"><summary>追加保证金</summary><form class="desk-manage-form" data-id="${esc(p.id)}" data-operation="margin"><label class="desk-field"><span>保证金（元）</span><input name="amount" type="number" value="1000" min="1" step="0.01" required></label><div class="desk-preview" aria-live="polite"></div><p class="form-error" role="status"></p><button class="button small" type="submit">确认追加</button></form></details>`:''}</td></tr>`;
}

function timestamp(j,esc){return `<time>${esc(j.date||`第 ${j.day+1} 交易日`)}</time><small>${esc(j.clock||['开盘','午间','尾盘','结算'][j.phase])}</small>`;}
function tradeRows(rows,{esc,money},structured){
 return rows.map(j=>{const c=j.crypto;
  return `<tr><td class="crypto-record-time" data-label="时间">${timestamp(j,esc)}</td>${c?`<td data-label="币种"><strong>${esc(c.name.replace(' · 日内合约',''))}</strong><small>${c.product==='crypto_perp'?`${c.direction==='short'?'做空':'做多'} · ${c.leverage} 倍`:'现货'}</small></td><td data-label="操作"><span class="crypto-trade-side is-${c.action}">${actions[c.action]}</span></td><td data-label="资金变动">${delta(c.cashFlow,money)}</td><td data-label="已实现盈亏" class="${tone(c.pnl||0)}">${c.pnl===undefined?'—':delta(c.pnl,money)}</td>`:`<td colspan="${structured?4:1}" class="crypto-legacy-record" data-label="成交摘要">${esc(j.text)}</td>`}</tr>`;
 }).join('');
}

function newsGroups(rows,{esc}){
 const groups=[];
 for(const j of rows){const date=j.date||`第 ${j.day+1} 交易日`;if(groups.at(-1)?.date!==date)groups.push({date,rows:[]});groups.at(-1).rows.push(j);}
 return `<div class="crypto-news-list">${groups.map(g=>`<section class="crypto-news-day"><h4>${esc(g.date)}</h4><ol>${g.rows.map(j=>{
  const prefix=j.text.match(/^((?:\d{2}:\d{2})(?: 行情| 每日结算)?|开盘|午间行情|尾盘行情|当日收盘)[。．]\s*([\s\S]*)$/);
  const clock=j.clock||prefix?.[1]||['开盘','午间','尾盘','结算'][j.phase];
  return `<li><time>${esc(clock)}</time><p>${esc(prefix?.[2]||j.text)}</p></li>`;
 }).join('')}</ol></section>`).join('')}</div>`;
}

export function renderCryptoRecords(s,mode,ctx){
 const {esc,money}=ctx,{trades,news}=cryptoHistory(s,mode),active=ctx.cryptoLedgerTab==='news'?'news':'trades';
 const label=mode==='perp'?'合约':mode==='meme'?'新币':'现货';
 const tabs=[['trades','成交记录',trades.length],['news','行情动态',news.length]],structured=trades.some(j=>j.crypto);
 const headings=structured?['时间','币种','操作','资金变动','已实现盈亏']:['时间','成交摘要'];
 const records=active==='news'?(news.length?newsGroups(news,ctx):'<p class="crypto-ledger-empty">暂无加密行情动态。</p>'):(trades.length?`<table class="crypto-account-table crypto-trades-table ${structured?'':'is-summary'}" aria-label="${label}成交记录"><thead><tr>${headings.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${tradeRows(trades,ctx,structured)}</tbody></table>`:'<p class="crypto-ledger-empty">完成买卖后，成交会记录在这里。</p>');
 return `<section class="crypto-records" aria-label="近期记录"><header class="crypto-records-heading"><nav class="crypto-ledger-tabs" aria-label="记录分类">${tabs.map(([id,title,count])=>`<button type="button" data-action="crypto-ledger-tab" data-view="${id}" aria-pressed="${active===id}">${title}<span>${count}</span></button>`).join('')}</nav>${active==='trades'&&structured?'<small>金额 ¥ · 盈亏已扣费</small>':''}</header><div class="crypto-account-content crypto-records-content" tabindex="0" role="region" aria-label="${active==='trades'?'成交记录':'行情动态'}列表">${records}</div></section>`;
}

export function renderCryptoLedger(s,mode,positions,ctx){
 const {money}=ctx,perp=mode==='perp',label=perp?'合约':mode==='meme'?'新币':'现货';
 const worth=positions.reduce((n,p)=>n+p.value,0),pnl=positions.reduce((n,p)=>n+p.value-p.cost,0);
 const holdings=positions.length?`<table class="crypto-account-table crypto-positions-table" aria-label="${label}持仓"><colgroup><col class="asset-column"><col><col class="pnl-column"><col><col class="actions-column"></colgroup><thead><tr>${['币种',perp?'当前权益':'当前市值','浮动盈亏',perp?'保证金':'持仓成本','操作'].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${positions.map(p=>positionRow(p,ctx)).join('')}</tbody></table>`:`<div class="crypto-holdings-empty"><p>暂无${label}持仓</p><button type="button" class="button small" data-action="desk-jump" data-area="order">去下单</button></div>`;
 return `<section class="desk-positions crypto-account" aria-label="加密持仓与记录"><header class="crypto-holdings-heading"><h2>${label}持仓 <span>${positions.length} 笔</span></h2>${positions.length>1?`<div class="crypto-account-total"><span>${perp?'总权益':'总市值'} <b>${money(worth)}</b></span><span>总盈亏 <b class="${tone(pnl)}">${delta(pnl,money)}</b></span></div>`:''}</header><div class="crypto-account-content crypto-holdings-content" tabindex="0" role="region" aria-label="${label}持仓列表">${holdings}</div>${renderCryptoRecords(s,mode,ctx)}</section>`;
}
