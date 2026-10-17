import {schemeLifeSummary} from '../game/scheme-life.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const age=v=>Number.isFinite(v)?`${Number(v.toFixed(1))} 岁`:'未记录';
const signed=(n,money)=>(n>0?'+':'')+money(n);
const memoryNames={schemeExposed:'第一次听说',firstScheme:'第一次投入',firstSchemePayment:'它真的付过钱',firstExitThought:'第一次想退出',firstSchemeWarning:'第一次预警',falseRecoveryMemory:'上次也没事',schemeQuit:'实际退出',schemeCollapsed:'项目消失',schemeRelapse:'又一个项目',lastExitOpportunity:'最后一次退出机会',friendJoinedScheme:'朋友自己参与',familyExposure:'家人自己参与',firstRecovery:'累计回款补回损失',screenshot:'留下余额截图'};
const relationNames={unknown:'未记录',joined:'曾自主参与',victim:'也是受害者',escaped:'提前退出',missing:'失联',concerned:'担忧',strained:'关系受损',repaired:'已沟通',};
function rows(a,money){const t=a.totals;return [['个人累计投入',money(t.invested)],['个人真实回款（含本金）',money(t.returned)],['个人已实现净盈亏',signed(t.realizedProfit,money)],['历史最高项目页面总余额',money(t.peakBookBalance)],['目前可提现估值',money(t.currentValue)],['尚未取回的个人本金',money(t.currentPrincipal)]];}
function projectRows(p,money){return [['初始个人投入',p.legacyImported?'旧账未完整记录':money(p.initialPrincipal)],['个人累计投入',money(p.invested)],['个人累计真实回款',money(p.returned)],['其中收益到账',money(p.paid)],['已实现净盈亏',signed(p.realizedProfit,money)],['该项目最高页面余额',money(p.peakBookBalance)],['最后页面余额',money(p.lastPageBalance)],['当前可提现估值',money(p.currentValue)]];}
function familyRows(p,money){return [['家人自己的储蓄投入',money(p.familyInvested)],['回到家庭储备的款项',money(p.familyReturned)],['家庭项目已实现盈亏',signed(p.familyRealizedProfit,money)],['家庭项目当前可提现',money(p.familyCurrentValue)]];}
const memoryRows=p=>Object.entries(p.memories).filter(([,m])=>m).sort((a,b)=>a[1].day-b[1].day);
export function schemeLifeText(s,money){
 const a=schemeLifeSummary(s);if(!a.exposed&&!a.projects.length)return '';
 return `## 高收益项目的旧账${a.forbidRisk?' · 已永久拒绝':''}\n\n${rows(a,money).map(([k,v])=>`${k}：${v}`).join('\n')}\n\n`+a.projects.map(p=>`### ${p.name}${p.ending?' · '+p.ending.title:''}\n${p.ending?.text||''}\n${projectRows(p,money).map(([k,v])=>`${k}：${v}`).join('\n')}${p.familyJoined?'\n'+familyRows(p,money).map(([k,v])=>`${k}：${v}`).join('\n'):''}\n${memoryRows(p).map(([k,m])=>`${age(m.age)} · ${memoryNames[k]} · ${money(m.amount)}${m.choice?' · 你选择：'+m.choice:''}`).join('\n')}\n${p.achievements.map(x=>x.title).join('、')}`).join('\n\n');
}
export function renderSchemeLifeLedger(s,{money},ending=false){
 const a=schemeLifeSummary(s);if(!a.exposed&&!a.projects.length)return '';
 const dl=list=>`<dl>${list.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
 const projects=a.projects.map(p=>`<details${a.projects.length===1?' open':''}><summary>${esc(p.name)}${p.ending?' · '+esc(p.ending.title):''}</summary>${p.ending?`<p>${esc(p.ending.text)}</p>`:''}${dl(projectRows(p,money))}${p.legacyImported?'<p class="field-help">旧项目接入时缺少完整回执；未知的初次日期和历史投入没有补造，累计流水从可追踪回执开始。</p>':''}${p.familyJoined?`<h3>家人自己的账</h3>${dl(familyRows(p,money))}<p class="field-help">来自家庭储备，与玩家个人现金和盈亏分别记录。${!p.familyInvested?'只记录了家人参与；金额没有可靠回执，未计入账目。':''}</p>`:''}${p.friendJoined?`<p>朋友：${esc(relationNames[p.relationships.friend])}。这是对方的参与记录，未计作你的投入或损失。</p>`:''}${p.relationships.introducer!=='unknown'?`<p>介绍人：${esc(relationNames[p.relationships.introducer])}。</p>`:''}<ol class="online-memory-timeline">${memoryRows(p).map(([k,m])=>`<li><span>${age(m.age)} · ${esc(memoryNames[k])}</span><strong>${esc(money(m.amount))}</strong>${m.choice?`<p>你选择：${esc(m.choice)}</p>`:''}</li>`).join('')}</ol>${p.achievements.length?`<p>留下的片段：${p.achievements.map(x=>esc(x.title)).join(' · ')}</p>`:''}</details>`).join('');
 const content=`<p class="online-ledger-status">${a.forbidRisk?'已永久拒绝新的资金盘；旧项目仍按真实账目处理。':ending?'每一轮项目，各有各的账。':'到账记录和页面余额，分别留下。'}</p>${dl(rows(a,money))}<p class="field-help">真实回款包含本金与已到账收益；留在项目页面上的数字不是现金。不同项目的首次、警报和关系后果分别记录。</p>${projects}`;
 return ending?`<section class="gambling-ledger online-life-ledger scheme-life-ledger" aria-label="高收益项目人生回看"><h2>它以前真的付过</h2>${content}</section>`:`<details class="gambling-ledger online-life-ledger scheme-life-ledger"><summary>高收益项目 · ${a.forbidRisk?'不再参与':a.projects.length+' 段经历'}</summary>${content}</details>`;
}
