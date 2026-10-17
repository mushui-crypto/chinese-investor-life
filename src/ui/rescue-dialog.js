import {renderFixedIncome} from './payroll.js';
import {isCollegeStudent} from '../game/education.js';
import {fatigueIncomeReason} from '../game/work-economy.js';
import {getLoanOffers,getActionAvailability,getSurvivalStatus,getWorkOffer} from '../game/core.js';
import {healthRules,foodHealthControls,survivalStreaks} from './survival-panel.js';
import {renderShortfallSettlement} from './shortfall-settlement.js';

export function renderRescueDialog(s,{money,esc,icon}) {
 const v=getSurvivalStatus(s),offers=getLoanOffers(s),student=isCollegeStudent(s);
 const gigReason=getActionAvailability(s,{type:'gig'}).reason,jobReason=getActionAvailability(s,{type:'seek_job'}).reason,sharedIncomeReason=gigReason&&gigReason===jobReason?gigReason:'';
 const action=(type,label)=>{const a=getActionAvailability(s,{type});return `<div class="rescue-action"><button class="button small" data-action="life-action" data-type="${type}" ${a.allowed?'':`disabled aria-describedby="${sharedIncomeReason?'rescue-income-reason':`rescue-${type}-reason`}"`}>${label}</button>${a.reason&&!sharedIncomeReason?`<small id="rescue-${type}-reason">${esc(a.reason)}</small>`:''}</div>`;};
 const loan=o=>`<article class="rescue-offer ${o.risky?'costly':''}" data-loan-kind="${o.kind}"><div class="rescue-offer-title"><h4>${esc(o.label)}</h4><span class="rescue-cost">${o.aprBps?`年化 ${o.aprBps/100}%`:'无息'} · ${o.months} 个月</span></div><div class="rescue-offer-detail"><div><p id="rescue-loan-${o.kind}">${o.allowed?`可申请上限 ${money(o.cap,true)}`:esc(o.reason)}</p><small>${esc(o.consequence)}</small></div><button class="button small" data-action="loans" data-kind="${o.kind}" aria-describedby="rescue-loan-${o.kind}" ${o.allowed?'':'disabled'}>${o.allowed?'填写金额':'暂不可用'}</button></div></article>`;
 return `<div class="rescue-menu">
 <section class="rescue-balance ${v.shortage?'is-short':'is-covered'}" aria-label="今日生活费缺口"><div class="rescue-balance-heading"><h3>${v.shortage?'今天生活费还差':'今天生活费已够'}</h3>${v.shortage?`<strong>${money(v.shortage)}</strong>`:''}</div><dl><div><dt>日常开销</dt><dd>${money(v.dailyExpense)}</dd></div><div><dt>今日待到账</dt><dd>${money(v.dailyIncome)}</dd></div><div><dt>手头现金</dt><dd>${money(s.cash)}</dd></div></dl>${renderFixedIncome(s,{money})}${survivalStreaks(v)}${v.shortage?'':'<p>攒够 7 天生活费或让今日到账覆盖开销后，结束应急期。</p>'}</section>
 ${foodHealthControls(s,{money,esc,icon})}
 ${renderShortfallSettlement(s,{money})}
 <section class="rescue-options" aria-labelledby="rescue-cash-heading"><h3 id="rescue-cash-heading">先安排开销和现金</h3>
 <div class="rescue-option-row"><div><h4>降低日常开销</h4><p>合租、自己做饭；从下次日结起生效。</p></div><div class="rescue-action"><button class="button small" data-action="living-plan">调整开支</button><small>${s.actionPoints>0?'1 点精力':'精力不足，可先查看'}</small></div></div>
 <div class="rescue-option-row"><div><h4>${student?'课余兼职':'打工收入'}</h4><p>${esc(fatigueIncomeReason(s))}${student?'选课余时段，做完结账。':`零工预计到账 ${money(getWorkOffer(s,'gig').total)}；正式工作每月 10 号发上月工资。`}</p></div><div class="rescue-income-actions">${student?'<button class="button small" data-action="student-jobs">查看兼职日程</button>':`<div class="rescue-income-buttons">${action('gig','接日结零工')}${action('seek_job',s.monthlyIncome?'换份工作':'找份工作')}</div>${sharedIncomeReason?`<small id="rescue-income-reason">${esc(sharedIncomeReason)}</small>`:''}`}</div></div>
 <div class="rescue-option-row"><div><h4>出售资产</h4><p>${v.cashableAssets?`预计可变现 ${money(v.cashableAssets,true)}，卖出后才能付账。`:'暂无可变现资产，可查看持仓与锁定期限。'}</p></div><button class="button small ${v.cashableAssets?'primary':''}" data-action="rescue-assets">${v.cashableAssets?'查看可卖资产':'查看持有资产'}</button></div>
 <div class="rescue-option-row"><div><h4>熟人工作机会</h4><p>在人情往来中接单，交付后到账。</p></div><button class="button small" data-action="life-rebuild">查看工作机会</button></div>
 </section>
 <details class="rescue-borrow"><summary><span><strong>借款周转</strong><small>${s.actionPoints>0?`${offers.filter(o=>o.allowed).length} 种可申请 · 申请用 1 点精力`:'精力不足 · 申请需 1 点精力'}</small></span><span class="rescue-expand" aria-hidden="true">${icon('chevron')}</span></summary><div class="rescue-borrow-body"><p class="rescue-borrow-note">获批后到账，本金与利息按月偿还。</p><div class="rescue-offers">${offers.filter(o=>!o.risky).map(loan).join('')}</div><h4 class="rescue-costly-heading">高成本借款 <span>到账扣费</span></h4><div class="rescue-offers">${offers.filter(o=>o.risky).map(loan).join('')}</div></div></details>
 <details class="rescue-rules"><summary>欠费怎么算</summary><p>只有推进时间才结算开销。付清一天生活费可中断连续欠费，旧欠款仍需偿还。</p>${healthRules({money})}<p>结束应急期：现金达到 ${money(v.buffer)}（7 天生活费），或今日到账覆盖日常开销。</p></details>
 <div class="dialog-footer"><button class="button" data-action="close-dialog">返回游戏</button></div></div>`;
}
export const rescueBackLink=()=>'<div class="rescue-back"><button class="text-button" data-action="rescue-options">← 返回生活费安排</button></div>';
