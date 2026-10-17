import {getSurvivalStatus} from '../game/core.js';
import {lifeChapter} from '../game/life-chapters.js';
import {collegeSupportStatus} from '../game/college-support.js';
import {payrollStatus} from '../game/payroll.js';
import {monthlyReceipts} from '../game/work-economy.js';

export function renderWalletLiving(s,{money}){
 if(!lifeChapter(s))return '';
 const v=getSurvivalStatus(s),support=collegeSupportStatus(s),salary=payrollStatus(s);
 const income=support.monthly||monthlyReceipts(s),label=support.monthly?'家里生活费':salary.monthly?'月薪':income?'养老金':'固定收入';
 const payday=support.monthly?'每月 1 号到账。':salary.monthly?'每月 10 号发上月工资。':income?'养老金按日结算。':'';
 return `<details class="wallet-living" data-fold="wallet-living"><summary>生活收支</summary><div class="wallet-living-body"><dl><div><dt>${label}</dt><dd>${money(income)}<small> / 月</small></dd></div><div><dt>日常消费</dt><dd>${money(v.dailyExpense)}<small> / 天</small></dd></div></dl>${payday?`<p class="wallet-payday">${payday}</p>`:''}</div></details><button class="text-button wallet-bills" data-action="chapter-bills">日常消费账单 →</button>`;
}
