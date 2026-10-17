import {getMetrics,getEndingMetrics} from '../game/core.js';
import {cryptoLifeSummary} from '../game/crypto-life.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const age=v=>Number.isFinite(v)?`${Number(v.toFixed(1))} 岁`:'未记录';
const duration=n=>n>=360?`${Math.floor(n/360)} 年 ${Math.floor(n%360/30)} 个月`:n>=30?`${Math.floor(n/30)} 个月`:`${n} 天`;
const signed=(n,money)=>(n>0?'+':'')+money(n);
const branchNames={spot:'现货',alt:'山寨币',leverage:'合约',scheme:'高收益项目'};
const memoryNames={firstCryptoBuy:'第一次实际投入',firstCryptoWin:'第一次已实现盈利',firstCryptoLoss:'第一次已实现亏损',firstAltcoin:'第一次山寨币',firstAltcoinBigWin:'第一次山寨币大涨',firstLeverage:'第一次合约',firstLiquidation:'第一次爆仓',highestCryptoWealth:'Crypto 最高持仓',firstScheme:'第一次高收益项目',firstSchemePayment:'第一次项目回款',firstSchemeWarning:'第一次项目预警',cryptoQuit:'第一次离开',cryptoRelapse:'第一次重新参与',firstRecovery:'第一次累计回本'};
const pointNames={trade:'实际成交',borrow:'借入资金',event:'一次选择',quit:'决定离开',relapse:'重新参与',recovery:'累计回本',exited:'离开以后的生活'};
function rows(a,money,ending){return [
 ['累计实际投入',money(a.invested)],['累计实际回款（含本金）',money(a.returned)],
 ['已实现净盈亏',signed(a.realizedProfit,money)],['当前账面浮盈亏',signed(a.unrealizedProfit,money)],
 ['历史最高 Crypto 持仓',money(a.highestCryptoWealth)],[(ending?'最终':'当前')+' Crypto 持仓',money(a.finalCryptoWealth)],
 [(ending?'最终':'当前')+'个人资产',money(a.finalAssets)],[(ending?'最终':'当前')+'负债',money(a.finalDebt)],
 ['合约盈利 / 亏损交易',`${a.contractWins} / ${a.contractLosses}`],['合约已结算胜率',`${(a.contractWinRate*100).toFixed(1)}%`],
 ['主动离开 / 再次参与',`${a.quitCount} / ${a.relapseCount}`],['最长离开时间',duration(a.longestQuit)],
 ];}
function title(a){return a.ending?.title||({ACTIVE:'故事还在继续',QUIT:'离开以后的日子',CRYPTO_EXITED:'行情与你隔了一段生活',EXPOSED:'听说这个能涨'})[a.status]||'Crypto 经历';}
const read=s=>cryptoLifeSummary(s,s.phase==='ended'?getEndingMetrics(s):getMetrics(s));
export function cryptoLifeText(s,money){
 const a=read(s);if(!a.exposed&&!a.totalTrades)return '';
 return `## Crypto 经历 · ${title(a)}\n\n${a.ending?.text||''}\n${rows(a,money,s.phase==='ended').map(([k,v])=>`${k}：${v}`).join('\n')}\n\n${Object.entries(a.memories).filter(([,v])=>v).map(([k,v])=>`${age(v.age)} · ${memoryNames[k]} · ${money(v.amount)}`).join('\n')}\n\n你曾经有 ${a.exitOpportunities} 次离场机会\n${a.points.map(p=>`${age(p.age)} · 已实现净盈亏 ${signed(p.realizedProfit,money)} · ${p.choice?'你选择：'+p.choice:pointNames[p.kind]}`).join('\n')}\n${a.achievements.map(a=>`${age(a.age)} · ${a.title}`).join('\n')}`;
}
export function renderCryptoLifeLedger(s,{money},ending=false){
 const a=read(s);if(!a.exposed&&!a.totalTrades)return '';
 const content=`<p class="online-ledger-status">${ending?'人生回看':'当前阶段'} · ${esc(title(a))}</p>${a.ending?`<p>${esc(a.ending.text)}</p>`:''}<dl>${rows(a,money,ending).map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="field-help">回款包含返还本金和已到账收益；账面浮盈、项目页面余额不算提现。合约胜率不等于总盈利。</p>${a.legacyImported?'<p class="field-help">旧存档接入时已有的持仓保留；缺少完整回执的历史金额、首次日期与选择不补造。累计投入与回款从可追踪的新回执开始。</p>':''}<details><summary>按分支查看</summary><dl>${Object.entries(a.branches).filter(([,b])=>b.buys||b.currentWealth).map(([k,b])=>`<div><dt>${branchNames[k]} · 已实现盈亏</dt><dd>${esc(signed(b.realizedProfit,money))}</dd></div>`).join('')||'<p>还没有实际交易。</p>'}</dl></details><details><summary>第一次与最高点</summary><ol class="online-memory-timeline">${Object.entries(a.memories).filter(([,m])=>m).sort((a,b)=>a[1].day-b[1].day).map(([k,m])=>`<li><span>${age(m.age)} · ${memoryNames[k]}</span><strong>${esc(money(m.amount))}</strong>${m.choice?`<p>你选择：${esc(m.choice)}</p>`:''}</li>`).join('')}</ol></details>${a.schemeLastPageBalance?`<p>项目最后页面余额 ${esc(money(a.schemeLastPageBalance))} · 该金额不代表可提现现金。</p>`:''}<h3>你曾经有 ${a.exitOpportunities} 次离场机会</h3>${a.points.length?`<ol class="online-memory-timeline">${a.points.map(p=>`<li><span>${age(p.age)} · ${pointNames[p.kind]||'一次选择'}</span><strong>已实现净盈亏 ${esc(signed(p.realizedProfit,money))}</strong>${p.kind==='relapse'?`<small>此前离开 ${duration(p.quitDays||0)}</small>`:''}${p.choice?`<p>你选择：${esc(p.choice)}</p>`:''}</li>`).join('')}</ol>`:'<p>还没有需要回看的交易决定。</p>'}${a.achievements.length?`<h3>留下的片段</h3><ul>${a.achievements.map(a=>`<li>${age(a.age)} · ${a.title}</li>`).join('')}</ul>`:''}`;
 return ending?`<section class="gambling-ledger online-life-ledger crypto-life-ledger" aria-label="Crypto 人生回看"><h2>Crypto 经历留下的账</h2>${content}</section>`:`<details class="gambling-ledger online-life-ledger crypto-life-ledger"><summary>Crypto 经历 · ${esc(title(a))}</summary>${content}</details>`;
}
