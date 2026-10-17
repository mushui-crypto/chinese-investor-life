import {optionQuote} from '../game/option-pricing.js';
import {gameDate,addGameDays} from '../game/game-calendar.js';
import {INSTRUMENTS} from '../game/market-play.js';
import {getMetrics,getTurnMonths} from '../game/core.js';

export function renderOrderOutcome(s,a,{money}) {
 if(!Number.isSafeInteger(a.amount)||a.amount<=0)return '';
 const row=(label,value)=>`<div><span>${label}</span><b>${value}</b></div>`;
 const i=INSTRUMENTS[a.product]?.find(i=>i.id===a.instrument),phase=s.trading.phase;
 let html='';
 if(['option','option_short'].includes(a.product)){
  const q=optionQuote({...a,phase,price:s.trading.quotes.stock?.price??s.markets.stock});
  if(q)html=row('行权价',(q.strike/100).toFixed(2))+row('到期日',addGameDays(gameDate(s),a.duration-1)+' 收盘')+row(a.product==='option'?'最多亏损':'本单权利金',money(q.premium))+row('到期回本价（未计平仓费）',(q.breakEven/100).toFixed(2))+`<small>${a.product==='option'?(a.direction==='short'?'到期低于回本价才盈利。':'到期高于回本价才盈利。'):'权利金随平仓结算；赔付超过保证金时会形成欠款。'}</small>`;
 }
 if(a.product==='fund')html=row('最早赎回',addGameDays(gameDate(s),1))+row('赎回费','赎回金额的 1%')+(a.recurring?row('下次自动申购',`${getTurnMonths(s)} 个月一期 · 下期开始`):'');
 if(a.product==='bond'&&i)html=row('每年约收票息',money(Math.round(a.amount*i.coupon/10000)))+row('期限',`${i.months} 个月`)+`<small>每期按实际持有时长付息，到期返还本金；提前出售按市价结算。</small>`;
 if(a.product==='angel')html=row('初始锁定',`6 期 · 当前每期 ${getTurnMonths(s)} 个月`)+row('退出费用','转让金额的 8%');
 if(a.product==='housing'){
  const price=a.financed?Math.round(a.amount/.3):a.amount,principal=price-a.amount;
  html=row('房屋总价',money(price))+row('新增按揭本金',money(principal))+row('满租年租金约',money(Math.round(price*(i?.rent??300)/10000)))+row('年度维修约',money(Math.round(price*.01)))+row('出售锁定',`2 期 · 当前每期 ${getTurnMonths(s)} 个月`);
  if(principal)html+=row('首月本息约',money(Math.round(principal/240+principal*.045/12)));
 }
 if(a.product==='ponzi')html='<small>投入后先记入项目账面，只有提现成功才回到现金。</small>';
 return html?`<div class="order-outcome" aria-label="本单规则">${html}</div>`:'';
}
export function renderOrderBudget(s,spend,{money}) {
 if(!Number.isSafeInteger(spend)||spend<0)return '<p>请输入有效金额。</p>';
 const after=s.cash-spend,reserve=getMetrics(s).livingReserve;
 return `<div class="order-cash"><div><span>本次支付</span><b>${money(spend)}</b></div><div><span>支付后现金</span><b>${money(after)}</b></div>${after<0?`<p class="cash-shortage">现金不足，还差 ${money(-after)}。</p>`:after<reserve?`<p class="cash-shortage">本期生活费还差 ${money(reserve-after)}，仍可下单。</p>`:''}</div>`;
}
