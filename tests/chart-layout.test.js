import test from 'node:test';
import assert from 'node:assert/strict';
import {priceDomain,chartGeometry,renderDailyChart} from '../src/ui/daily-chart.js';
const state={birthYear:1988,age:18,turn:11,debtClock:{periodDays:2},trading:{day:31,phase:1}},bar=(day,open=1000,close=1032)=>({day,turn:11,open,high:Math.max(open,close)+10,low:Math.min(open,close)-10,close,stage:3,complete:true,partial:false});
const bars=Array.from({length:30},(_,i)=>bar(i+2)),quote={price:1032,open:1000};
const markup=()=>renderDailyChart(state,quote,{esc:String,bars,title:'测试股 · 日线'});
const model=()=>JSON.parse(markup().match(/data-chart-model='([^']+)'/)[1]);
test('price axis has evenly spaced nice ticks and leaves headroom for candles',()=>{
 for(const [lo,hi] of [[9.81,10.87],[10,10],[0,0],[.00000012,.00000089],[67000,71000],[0,99]]){const d=priceDomain(lo,hi,Math.max(hi*.00001,.00000001));assert.ok(d.low<=lo&&d.high>hi);assert.ok(d.ticks.length>=4&&d.ticks.length<=8);assert.ok(d.ticks.every(Number.isFinite));for(let i=1;i<d.ticks.length;i++)assert.ok(Math.abs(d.ticks[i]-d.ticks[i-1]-d.step)<d.step*1e-6);assert.equal(new Set(d.ticks).size,d.ticks.length);}
});
test('responsive geometry preserves price gutter, candle spacing and time label spacing',()=>{
 const m=model();for(const width of [210,260,390,620,1120,1600]){const g=chartGeometry(m,width);assert.ok(g.right<width-50);assert.ok(g.x(0)>g.left&&g.x(29)<g.right);assert.ok(g.height>=240&&g.height<=340);for(let i=1;i<g.indices.length;i++)assert.ok(g.x(g.indices[i])-g.x(g.indices[i-1])>=50);for(const b of m.bars)assert.ok(g.y(b.high)>=g.top&&g.y(b.low)<=g.bottom);}
});
test('one time convention covers simulated and recorded days, preserving actual gaps',()=>{
 const earlier=bar(0);earlier.preview=true;earlier.label='开盘前 29 日';earlier.axisLabel='−29 日';const html=renderDailyChart(state,quote,{esc:String,bars:[earlier,bar(31)]});assert.ok(html.includes('2005-12-03'));assert.ok(html.includes('2006-01-03'));assert.ok(html.includes('01-03'));assert.ok(!html.includes('日前'));assert.ok(!html.includes('−29 日'));assert.ok(!html.includes('第 32 交易日'));assert.ok(html.includes('daily-gap'));
});
test('compact chart keeps prices and accessible provenance; explanations are behind info icon',()=>{
 const html=markup();assert.ok(html.includes('data-info="daily-chart"'));assert.ok(!html.includes('<small>'));assert.ok(html.includes('daily-latest'));assert.ok(html.includes('data-daily-field="open"'));assert.ok(html.includes('已收盘'));assert.equal((html.match(/class="daily-body"/g)||[]).length,30);assert.ok(!/NaN|Infinity/.test(html));
});
test('displayed crypto scale, not its internal quote, determines axis ticks',()=>{
 const html=renderDailyChart(state,quote,{esc:String,bars,displayScale:63.5,decimals:2,formatPrice:n=>(n*63.5).toFixed(2)}),m=JSON.parse(html.match(/data-chart-model='([^']+)'/)[1]);assert.equal(m.bars.at(-1).close,1032*63.5);const g=chartGeometry(m,620);assert.ok(g.domain.high>=m.bars.at(-1).high);assert.ok(g.domain.step>=100);assert.ok(g.labels.every(n=>!n.includes('k')));
});
test('rendering and resizing never mutates quotes, history, or game state',()=>{
 const before=JSON.stringify({state,quote,bars}),html=markup(),m=model(),snapshot=JSON.stringify(m);for(const w of [320,620,1100])chartGeometry(m,w);assert.equal(JSON.stringify(m),snapshot);assert.equal(JSON.stringify({state,quote,bars}),before);assert.ok(html.includes('data-daily-point'));
});

test('one-day and zero-price old charts still have a valid time axis',()=>{
 for(const line of [false,true])for(const price of [0,1000]){const b=bar(31,price,price);b.low=price;b.high=price;const html=renderDailyChart(state,{price,open:price},{esc:String,bars:[b],line});assert.ok(!/NaN|Infinity/.test(html));assert.ok(html.includes('daily-time-tick'));}
});
