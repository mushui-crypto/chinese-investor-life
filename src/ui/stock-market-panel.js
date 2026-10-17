import {aShareSession,routineState} from '../game/day-routine.js';
import {renderDailyChart} from './daily-chart.js';
import {marketChartBars} from './market-chart.js';
import {STOCK_MARKETS,STOCKS,stockMarket,stockWorld} from '../game/stock-markets.js';

export function renderStockMarkets(s,selected,{esc,icon}){
  const market=stockMarket(selected.id),world=stockWorld(s),w=world[market.id];
  const change=(w.index/w.open-1)*100,session=aShareSession(s),morning=routineState(s).stage===0,beforeOpen=market.id==='a'&&morning;
  return `<section class="stock-exchanges" aria-label="三地股票市场">
    <div class="stock-market-tabs" role="group" aria-label="选择股票市场">${Object.values(STOCK_MARKETS).map(m=>{
      const value=world[m.id],count=s.positions.filter(p=>p.kind==='stock'&&stockMarket(p).id===m.id).length,delta=(value.index/value.open-1)*100;
      const waiting=m.id==='a'&&morning;
      return `<button class="stock-market-tab ${m.id===market.id?'selected':''}" data-action="stock-market" data-id="${STOCKS.find(i=>i.market===m.id).id}" aria-pressed="${m.id===market.id}"><strong>${icon(m.id==='a'?'chart':m.id==='hk'?'coin':'globe')}${m.name}</strong><b class="${waiting?'':delta>0?'stock-up':delta<0?'stock-down':''}" title="${waiting?'A 股 09:30 开盘':'模拟大盘指数相对今日开盘的涨跌幅'}">${waiting?'未开盘':`<em>大盘</em>${delta>=0?'+':''}${delta.toFixed(2)}%`}</b><small>${count?count+' 笔持仓':'暂无持仓'}</small></button>`;
    }).join('')}</div>
    ${beforeOpen?`<div class="stock-premarket"><strong>盘前消息</strong><span>09:30 开盘</span><p>${w.news==='交易所刚刚开门，等待第一段行情。'?'暂无新的市场消息。':`最近消息 · ${esc(w.news)}`}</p></div>`:''}
    <details class="stock-market-weather"><summary>${beforeOpen?'历史行情与交易规则':'大盘、市场消息与交易规则'}${market.id==='a'?`<span class="stock-session-status">${session.label}${session.open?'':' · 仅查看行情'}</span>`:''}</summary>
      <div class="stock-weather-content">
      <div class="stock-weather-heading"><h2>${market.name}${beforeOpen?'历史行情':'行情'}</h2><span class="${beforeOpen?'':change>0?'stock-up':change<0?'stock-down':''}">${beforeOpen?'今日尚未开盘':`较开盘 ${change>=0?'+':''}${change.toFixed(2)}%`}</span></div>
      ${renderDailyChart(s,w,{esc,title:market.name+'指数 · '+(beforeOpen?'历史日线':'日线'),price:w.index,line:true,unit:'指数',sessionClosed:beforeOpen||market.id==='a'&&s.dayRoutine?.stage>=4,bars:marketChartBars(s,'index:'+market.id,w,{price:w.index,beforeOpen,vol:{a:.012,hk:.017,us:.014}[market.id]})})}
      <div class="stock-market-context">
      <p class="stock-market-rule">${icon('clock')} ${market.rule}</p>
      ${beforeOpen?'':`<p class="stock-market-news">${esc(w.news)}</p>`}
      </div>
      <blockquote class="stock-forum"><span>股民茶水间</span>“${esc(w.meme)}”</blockquote>
      <details class="stock-reality"><summary class="button small">交易规则 ${icon('chevron')}</summary><div class="stock-reality-body"><p>${market.detail}</p><p>三地共用现金与每日 6 次操作。价格折合人民币，卖出扣费后到账。</p></div></details>
      </div>
    </details>
  </section>`;
}
