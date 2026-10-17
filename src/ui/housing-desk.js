import {housingQuote} from '../game/housing.js';
export function housingOrder(selected,{esc,icon}){
 const budgets=selected.id==='suburb'?[300000,500000,800000]:selected.id==='center'?[500000,800000,1200000]:[800000,1200000,1800000];
 return `<form id="desk-order" class="trade-ticket housing-order" data-product="housing" data-instrument="${selected.id}"><h2>购买${esc(selected.name)}</h2><p>先选总价，再比较全款与按揭。</p><label class="desk-field"><span>房屋总价（元）</span><input name="price" type="number" inputmode="decimal" step="0.01" min="50000" value="${budgets[0]}" data-presets="${budgets.join(',')}" required></label><fieldset class="payment-methods"><legend>付款方式</legend><label><input type="radio" name="payment" value="cash" checked><span><strong>全款购房</strong><small>一次付清，无月供</small></span></label><label><input type="radio" name="payment" value="mortgage"><span><strong>首付 30% · 按揭</strong><small>年利率 4.5% · 20 年</small></span></label></fieldset><div class="desk-preview" aria-live="polite"></div><p class="form-error" role="status"></p><button class="button primary full" type="submit"><span data-order-label>确认全款购买</span> ${icon('check')}</button><small>这是一处出租投资房，自住生活费仍照常结算。</small></form>`;
}
export function housingPreview(s,a,selected,{money}){
 const q=housingQuote(a.propertyPrice,a.financed,selected?.rent??300);if(!q)return '<p>请输入有效的房屋总价。</p>';
 const row=(label,n,cls='')=>`<div class="${cls}"><span>${label}</span><b>${money(n)}</b></div>`;
 return `<div class="housing-payment">${row(a.financed?'本次首付':'本次全款',q.payment,'payment-total')}${row('购房后现金',s.cash-q.payment)}${q.principal?row('新增按揭',q.principal)+row('首月月供约',q.monthlyPayment):''}</div><div class="housing-cashflow"><h3>持有期间的收支</h3>${row('满租年租金约',q.annualRent)}${row('年度维修约',q.annualMaintenance)}<small>租金随估值和出租情况变化；空置时无租金，月供与维修继续支付。</small></div>${s.cash<q.payment?`<p class="cash-shortage">现金不足，还差 ${money(q.payment-s.cash)}。</p>`:''}`;
}
export function housingPosition(p,{s,money,esc,button}){
 const debt=s.debts.find(d=>d.id===p.mortgageId),owed=debt?debt.principal+debt.interest:0,net=p.value-owed,wait=Math.max(0,p.lockUntilTurn-s.turn);
 const row=(k,v)=>`<div><dt>${k}</dt><dd>${v}</dd></div>`;
 return `<article class="desk-position-row property-holding"><header class="position-heading"><div><h3>${esc(p.name)}</h3><span>${debt?'按揭中':'无按揭'} · ${wait?`还需 ${wait} 期可出售`:'可申请出售'}</span></div><div><small>当前房产估值</small><strong>${money(p.value)}</strong></div></header><dl class="position-numbers">${row('买入总价',money(p.cost))}${row('剩余按揭',money(owed))}${row('房产净值',money(net))}${row('满租年租金约',money(Math.round(p.value*(p.rentBps??300)/10000)))}</dl><div class="position-actions">${button('出售房产',{type:'desk_sell',id:p.id,bps:10000})}${button(p.renovated?'已完成装修':`装修 · ${money(Math.round(p.cost*.03))}`,{type:'desk_manage',id:p.id,operation:'renovate'})}</div><p class="position-footnote">出售扣除 5% 费用后，先偿还按揭；剩余款项才是可用现金。${p.renovated?'装修已计入租金水平。':''}</p></article>`;
}
