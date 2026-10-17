import {payrollStatus} from '../game/payroll.js';
import {collegeSupportStatus} from '../game/college-support.js';

export function renderFixedIncome(s,ctx){
 const p=collegeSupportStatus(s);
 const support=p.monthly?`<div class="college-support-summary"><p>家里生活费 <b>${ctx.money(p.monthly)} / 月</b></p><p>每月 1 号结算时到账，22 岁毕业后停止。</p><p>${p.due?'本月尚未领取，下次日结发放。':`本月已到账 · 下次 ${p.nextPayday}`}</p></div>`:'';
 return support+renderPayroll(s,ctx);
}

export function renderPayroll(s,{money},{details=false,showMonthly=true}={}){
 const p=payrollStatus(s);
 if(!p.monthly&&!p.pending&&!p.last)return '';
 return `<div class="payroll-summary"><p>${p.monthly&&showMonthly?`月薪 <b>${money(p.monthly)}</b> · `:''}每月 10 号发上月工资</p><p>${p.nextPayday?`下次发薪 ${p.nextPayday} · `:''}累计待发 <b>${money(p.pending)}</b><small>到账前不可用于生活费或交易。</small></p>${details?`<details><summary>工资单与计薪规则</summary><p>按当月日历天数计薪；月中入职只计实际在岗部分。请假、旷工、迟到和疲劳扣款计入对应月份。离职后，已赚取的工资仍按原发薪日到账。</p>${s.payroll?.history.length?`<ol>${s.payroll.history.slice(-3).reverse().map(r=>`<li>${r.month} · ${r.payday} 到账 ${money(r.net)}${r.gross>r.net?`（扣薪 ${money(r.gross-r.net)}）`:''}</li>`).join('')}</ol>`:'<p>暂无已发工资；旧存档此前领过的日薪不会补发。</p>'}</details>`:''}</div>`;
}
