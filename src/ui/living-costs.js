import {AGE_LIVING_COSTS,COLLEGE_DAILY_COST,livingCostBreakdown,EXPENSE_EVENTS} from '../game/living-costs.js';
export function renderLivingCosts(s,{money,esc}){
 const b=livingCostBreakdown(s),rows=[['基本日常开销',b.base],['吃住节省',b.home],['伴侣开支',b.partner],['孩子开支',b.child],['照料长辈',b.parent],['生活档次',b.lifestyle]].filter(([,n])=>n);
 return `<section class="living-cost-detail"><h3>${esc(b.label)} · 生活账</h3><dl>${rows.map(([label,n])=>`<div><dt>${label}</dt><dd>${money(n)} / 月</dd></div>`).join('')}<div class="living-total"><dt>合计</dt><dd>${money(b.total)} / 月</dd></div></dl><p>基本开销含吃住、交通和日用品。出租房投资不抵扣自住开销。</p>${s.age>=18&&s.age<80&&!s.legal?.prisonMonthsLeft?'<button class="button small" data-action="living-plan">调整日常开支</button>':''}<details><summary>各阶段的基本开销</summary><dl><div><dt>大学在读 · 18–21 岁</dt><dd>${money(COLLEGE_DAILY_COST)} / 天</dd></div>${AGE_LIVING_COSTS.map(b=>`<div><dt>${b.label}${b.from===18?' · 非在读':''}</dt><dd>${money(b.daily)} / 天</dd></div>`).join('')}</dl><p>未成年由家里承担。</p></details><p>修理、看病等临时开销另计，未付部分记为欠款。</p></section>`;
}
export function renderRecentExpenses(s,{money,esc}){
 const recent=s.livingCosts?.history?.slice(-3).reverse()||[];
 if(!recent.length)return '';
 return `<details class="recent-expenses"><summary>最近的临时开销 <span>${money(recent[0].amount)}</span></summary><ul>${recent.map(h=>{const e=EXPENSE_EVENTS.find(e=>e.id===h.id);return `<li><div><strong>${esc(e.title)}</strong><b>−${money(h.amount)}</b></div><p>${esc(e.text)}${h.owed?` 尚有 ${money(h.owed)} 记入欠款。`:''}</p></li>`;}).join('')}</ul><button class="button small" data-action="chapter-bills">日常消费账单</button></details>`;
}
