import {getMetrics,getEndingMetrics} from '../game/core.js';
import {onlineGamblingSummary} from '../game/online-gambling.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const duration=days=>days>=360?`${Math.floor(days/360)} 年${days%360>=30?` ${Math.floor(days%360/30)} 个月`:''}`:days>=30?`${Math.floor(days/30)} 个月`:`${days} 天`;
const age=n=>n===null?'未记录':`${Number(n.toFixed(1))} 岁`;
const signed=(n,money)=>(n>0?'+':'')+money(n);
const pointLabel={borrow:'借入赌资',quit:'决定离开',relapse:'再次参与',recovery:'累计盈亏回到零以上',recovered:'生活重新稳定',event:'一次选择'};

function rows(a,money){return [
 ['累计下注（自己的钱）',money(a.staked)],['累计提现（含返还本金）',money(a.withdrawn)],['一次性赠送筹码',money(a.freeCredit)],
 ['累计净输赢',signed(a.netProfit,money)],['累计净亏损',money(a.netLoss)],
 ['历史最高个人资产',money(a.peakAssets)],['当前个人资产',money(a.finalAssets)],['当前负债',money(a.finalDebt)],
 ['第一次下注',age(a.firstBetAge)],['第一次大胜',a.firstBigWin?`${age(a.firstBigWin.age)} · ${money(a.firstBigWin.amount)}`:'没有'],
 ['第一次借赌资',a.firstBorrow?`${age(a.firstBorrow.age)} · ${money(a.firstBorrow.amount)}`:'没有'],
 ['戒赌次数',String(a.quitCount)],['最长离开时间',duration(a.longestQuit)],['复赌次数',String(a.relapseCount)],
 ];}

export function onlineGamblingText(s,money){
 const a=onlineGamblingSummary(s,s.phase==='ended'?getEndingMetrics(s):getMetrics(s));if(!a.exposed&&!a.totalBets)return '';
 return `## 这段经历${a.ending?' · '+a.ending.title:''}\n\n${rows(a,money).map(([k,v])=>`${s.phase==='ended'?k.replace('当前','最终'):k}：${v}`).join('\n')}\n\n你曾经有 ${a.exitOpportunities} 次离场机会\n${a.points.map(p=>`${age(p.age)} · 累计净输赢 ${signed(p.netProfit,money)} · 你选择：${p.choice||pointLabel[p.kind]}`).join('\n')}`;
}

export function renderOnlineGamblingLedger(s,{money},ending=false){
 const a=onlineGamblingSummary(s,ending?getEndingMetrics(s):getMetrics(s));if(!a.exposed&&!a.totalBets)return '';
 const title=a.ending?.title||({ACTIVE:'故事还在继续',QUIT:'离开以后的日子',RECOVERED:'上岸',EXPOSED:'那个群里的链接'})[a.status]||'这段经历';
 const content=`<p class="online-ledger-status">${ending?'人生回看':'当前阶段'} · ${esc(title)}</p><dl>${rows(a,money).map(([k,v])=>`<div><dt>${ending?k.replace('当前','最终'):k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="field-help">赠送筹码不计个人支出；返还落入现金账本。普通投资和生活借款不算网赌参与。</p>${a.legacyImported?'<p class="field-help">已接入旧赌局总账；旧回执没有日期的经历，不补造年龄与选择。</p>':''}<h3>你曾经有 ${a.exitOpportunities} 次离场机会</h3>${a.points.length?`<ol class="online-memory-timeline">${a.points.map(p=>`<li><span>${age(p.age)} · ${esc(pointLabel[p.kind]||'一次选择')}</span><strong>累计净输赢 ${esc(signed(p.netProfit,money))}</strong>${p.kind==='relapse'?`<small>此前离开 ${duration(p.quitDays||0)}</small>`:''}<p>你选择：${esc(p.choice||pointLabel[p.kind])}</p></li>`).join('')}</ol>`:'<p>还没有需要回看的下注选择。</p>'}`;
 return ending?`<section class="gambling-ledger online-life-ledger" aria-label="网赌人生回看"><h2>这段经历留下的账</h2>${content}</section>`:`<details class="gambling-ledger online-life-ledger"><summary>这段经历 · ${esc(title)}</summary>${content}</details>`;
}
