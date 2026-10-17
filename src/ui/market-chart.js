import {dailyQuotes} from '../game/daily-quotes.js';
import {addGameDays,quoteDates} from '../game/game-calendar.js';
import {futurePrice,futuresInstrument} from '../game/futures-markets.js';

/** Fill the chart's opening window, without writing prices or consuming game RNG.
 * Work backwards from the earliest recorded opening price. As actual days arrive,
 * only the oldest preview bars leave the window; the remaining history stays put.
 */
export function marketChartBars(s,key,q,{price=q.price,vol=.02,beforeOpen=false}={}){
 const actual=dailyQuotes(s,q,price),first=actual[0],count=Math.max(0,30-actual.length);
 const visible=bars=>beforeOpen?bars.filter(b=>b.turn!==s.turn||b.day!==s.trading.day):bars;
 if(!count||first.open<=0)return visible(actual);
 let seed=2166136261;for(const c of s.seed+':chart:'+key)seed=Math.imul(seed^c.charCodeAt(0),16777619);
 const draw=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const prior=[],firstDate=quoteDates(s,actual)[0];let close=first.open;
 for(let offset=1;offset<=count;offset++){
  const open=Math.max(1,Math.round(close/(1+(draw()-.5)*vol*1.6)));
  const high=Math.max(open,close,Math.round(Math.max(open,close)*(1+draw()*vol*.35)));
  const low=Math.max(1,Math.min(open,close,Math.round(Math.min(open,close)*(1-draw()*vol*.35))));
  prior.push({day:first.day-offset,turn:first.turn,date:addGameDays(firstDate,-offset),open,high,low,close,stage:3,complete:true,partial:false,preview:true});close=open;
 }
 return visible([...prior.reverse(),...actual]);
}

export function forexChartBars(s,id,q){
 const bars=marketChartBars(s,'futures:'+id,q,{vol:futuresInstrument(id).vol});
 if(id!=='EUR_USD')return bars;
 const leg=id=>{const price=futurePrice(s,id),quote=s.trading.quotes[id]??{price,open:price,history:[price]};return new Map(marketChartBars(s,'futures:'+id,quote,{vol:futuresInstrument(id).vol}).map(b=>[b.date,b]));};
 const usd=leg('USD_CNY'),eur=leg('EUR_CNY'),ratio=(a,b)=>Math.max(1,Math.round(a/b*100000));
 return bars.map(b=>{if(!b.preview)return b;const u=usd.get(b.date),e=eur.get(b.date);if(!u||!e)return b;return {...b,open:ratio(e.open,u.open),close:ratio(e.close,u.close),high:ratio(e.high,u.low),low:ratio(e.low,u.high)};});
}
