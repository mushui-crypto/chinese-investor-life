import {dailyQuotes} from '../game/daily-quotes.js';
import {quoteDates} from '../game/game-calendar.js';
import {infoButton} from './info-popover.js';
const value=n=>(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const signed=n=>(n>0?'+':'')+n.toFixed(2)+'%';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sameSession=(a,b)=>b&&a.turn===b.turn&&a.day===b.day+1;

// Tick calculations use displayed prices, including the crypto quote conversion.
export function priceDomain(lo,hi,minUnit=.01){
 const pad=Math.max((hi-lo)*.1,Math.abs(hi)*.005,minUnit),lower=Math.max(0,lo-pad),upper=hi+pad;
 const rough=(upper-lower)/5,power=10**Math.floor(Math.log10(rough));
 const step=([1,2,2.5,5,10].find(n=>n*power>=rough)||10)*power;
 const low=Math.floor(lower/step)*step,high=Math.ceil(upper/step)*step;
 const decimals=Math.min(12,Math.max(0,-Math.floor(Math.log10(step))+(step/power===2.5?1:0)));
 const ticks=Array.from({length:Math.round((high-low)/step)+1},(_,i)=>Number((low+i*step).toFixed(decimals)));
 return {low,high,step,ticks,decimals};
}
export function chartGeometry(model,width,plotHeight){
 const bars=model.bars,last=bars.at(-1),lo=Math.min(...bars.map(b=>model.line?b.close:b.low)),hi=Math.max(...bars.map(b=>model.line?b.close:b.high));
 const domain=priceDomain(lo,hi,model.minUnit),digits=Math.max(model.decimals,domain.decimals);
 const format=n=>n.toLocaleString('zh-CN',{minimumFractionDigits:digits,maximumFractionDigits:digits});
 const labels=domain.ticks.map(format),gutter=Math.max(64,...labels.map(v=>v.length*7+16),last.detail.close.length*7+16);
 const height=Math.round(plotHeight>=220?plotHeight:Math.max(240,Math.min(340,width*.34))),left=8,right=Math.max(left+60,width-gutter),top=16,bottom=height-36;
 const step=(right-left)/bars.length,x=i=>left+step*(i+.5),y=n=>top+(domain.high-n)/(domain.high-domain.low)*(bottom-top);
 const stride=Math.min(Math.max(1,bars.length-1),[1,2,5,10,15,20,30,60].find(n=>n*step>=72)||60);
 const indices=[];for(let i=bars.length-1;i>=0;i-=stride)indices.unshift(i);
 if(indices[0]>0&&indices[0]*step>=72)indices.unshift(0);
 return {width,height,left,right,top,bottom,step,x,y,domain,labels,indices};
}
export function renderDailyPlot(model,width=620,selected=model.bars.length-1,plotHeight){
 const {bars,line}=model,last=bars.at(-1),g=chartGeometry(model,width,plotHeight),{left,right,top,bottom,x,y,step,height,domain,labels,indices}=g,latestY=y(last.close);
 const segments=[];if(line)for(let i=1;i<bars.length;i++)if(sameSession(bars[i],bars[i-1]))segments.push(`<path d="M${x(i-1)} ${y(bars[i-1].close)}L${x(i)} ${y(bars[i].close)}" class="daily-line"/>`);
 const tone=b=>b.close>b.open?'daily-up':b.close<b.open?'daily-down':'daily-flat';
 return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="group" aria-label="${escape(model.title)}，左右方向键切换交易日">
 ${domain.ticks.map((n,i)=>`<path d="M${left} ${y(n)}H${right}" class="daily-grid"/>${Math.abs(y(n)-latestY)>17?`<text x="${right+8}" y="${y(n)}" dominant-baseline="middle" class="daily-axis daily-price-tick">${labels[i]}</text>`:''}`).join('')}
 ${indices.map(i=>`<path d="M${x(i)} ${top}V${bottom}" class="daily-grid daily-time-grid"/>`).join('')}
 <path d="M${left} ${bottom}H${right}V${top}" class="daily-axis-line"/>
 ${bars.map((b,i)=>i&&!sameSession(b,bars[i-1])?`<path d="M${x(i)-step/2} ${top}V${bottom}" class="daily-gap"><title>这段时间没有日线记录</title></path>`:'').join('')}${segments.join('')}
 <path d="M${left} ${latestY}H${right}" class="daily-latest-line ${tone(last)}"/>
 ${bars.map((b,i)=>{const cx=x(i),r=Math.max(.65,Math.min(8,step*.3)),v=b.detail,label=`${v.day}，${line?model.unit+' '+v.close+'，日涨跌 '+v.change:'开盘 '+v.open+'，最高 '+v.high+'，最低 '+v.low+'，'+v.label+' '+v.close}，${v.status}`;return `<g class="daily-point ${tone(b)}" role="button" tabindex="${i===selected?0:-1}" aria-label="${escape(label)}" aria-pressed="${i===selected}" data-chart-index="${i}" data-daily-point='${escape(JSON.stringify(v))}'><title>${escape(label)}</title><rect class="daily-hit" x="${cx-step/2}" y="${top}" width="${step}" height="${bottom-top}"/><path class="daily-crosshair" d="M${cx} ${top}V${bottom}"/>${line?`<circle cx="${cx}" cy="${y(b.close)}" r="2.5" class="daily-dot"/>`:`<path d="M${cx} ${y(b.high)}V${y(b.low)}" class="daily-wick"/><rect x="${cx-r}" y="${Math.min(y(b.open),y(b.close))}" width="${r*2}" height="${Math.max(1.5,Math.abs(y(b.open)-y(b.close)))}" class="daily-body"/>`}</g>`;}).join('')}
 <g class="daily-latest ${tone(last)}" aria-label="最新价 ${escape(last.detail.close)}"><rect x="${right+3}" y="${latestY-10}" width="${width-right-5}" height="20" rx="2"/><text x="${right+8}" y="${latestY}" dominant-baseline="middle">${escape(last.detail.close)}</text></g>
 ${indices.map(i=>`<text x="${x(i)}" y="${height-12}" text-anchor="${i===bars.length-1?'end':i===0?'start':'middle'}" class="daily-axis daily-time-tick">${escape(bars[i].detail.axis)}</text>`).join('')}
 </svg>`;
}
export function renderDailyChart(s,q,{esc=escape,title='日线行情',line=false,price=q.price,unit='价格',formatPrice=value,displayScale=.01,decimals=2,bars:providedBars,continuous=false,sessionClosed=false}={}){
 const allBars=providedBars??dailyQuotes(s,q,price),dates=quoteDates(s,allBars).slice(-30),bars=allBars.slice(-30),last=bars.at(-1);
 const status=b=>b.preview?(continuous?'历史模拟':'开盘前模拟'):b.partial?'旧档片段':(b.complete||sessionClosed)?(continuous?'日线已完成':'已收盘'):b.day===s.trading.day&&b.turn===s.turn?(continuous?'日线更新中':'今日未收盘'):'当日片段';
 const detail=b=>({day:dates[bars.indexOf(b)],axis:dates[bars.indexOf(b)].slice(5),status:status(b),open:formatPrice(b.open),high:formatPrice(b.high),low:formatPrice(b.low),close:formatPrice(b.close),change:signed(b.open?(b.close/b.open-1)*100:0),label:line?unit:b.complete||sessionClosed?'收':'现'});
 const data=detail(last),model={title,line,unit,decimals,minUnit:displayScale,bars:bars.map(b=>({day:b.day,turn:b.turn,open:b.open*displayScale,high:b.high*displayScale,low:b.low*displayScale,close:b.close*displayScale,detail:detail(b)}))};
 return `<figure class="quote-chart daily-chart ${line?'daily-net-value':''}" aria-label="${esc(title)}" data-daily-chart data-chart-model='${esc(JSON.stringify(model))}'>
 <figcaption><strong>${esc(title)}</strong><span class="daily-chart-tools">${line?'日线':'日 K'} ${infoButton('daily-chart','行情图说明')}</span></figcaption>
 <div class="daily-readout" aria-live="polite"><span class="daily-readout-day" data-daily-field="day" title="${esc(data.status)}">${data.day}</span><dl>${(line?[['close',unit],['change','日涨跌']]:[['open','开'],['high','高'],['low','低'],['close',data.label]]).map(([key,label])=>`<div><dt ${key==='close'&&!line?'data-daily-field="label"':''}>${label}</dt><dd data-daily-field="${key}">${esc(data[key])}</dd></div>`).join('')}</dl></div>
 <div class="daily-plot">${renderDailyPlot(model)}</div></figure>`;
}
function selectPoint(point,focus=false){
 const chart=point.closest('[data-daily-chart]'),data=JSON.parse(point.dataset.dailyPoint);chart.dataset.inspecting='true';
 for(const node of chart.querySelectorAll('[data-daily-point]')){node.tabIndex=node===point?0:-1;node.setAttribute('aria-pressed',String(node===point));}
 for(const node of chart.querySelectorAll('[data-daily-field]'))node.textContent=data[node.dataset.dailyField];
 chart.querySelector('.daily-readout-day').title=data.status;
 if(focus)point.focus({preventScroll:true});
}
export function bindDailyCharts(root=document){
 // Recalculate in CSS pixels: labels never scale up with the surrounding SVG.
 const observed=new Set(),resize=new ResizeObserver(entries=>{for(const {target,contentRect} of entries){const width=Math.round(contentRect.width),height=getComputedStyle(target).getPropertyValue('--fill-chart').trim()==='1'?Math.round(contentRect.height):0;if(width<100||(target.dataset.width===String(width)&&target.dataset.height===String(height)))continue;target.dataset.width=width;target.dataset.height=height;const chart=target.closest('[data-daily-chart]'),model=JSON.parse(chart.dataset.chartModel),selected=Number(chart.querySelector('[aria-pressed=true]')?.dataset.chartIndex??model.bars.length-1),focused=target.contains(document.activeElement);target.innerHTML=renderDailyPlot(model,width,selected,height);if(focused)target.querySelector(`[data-chart-index="${selected}"]`)?.focus({preventScroll:true});}});
 const sync=()=>{for(const el of observed)if(!el.isConnected){resize.unobserve(el);observed.delete(el);}for(const el of root.querySelectorAll('.daily-plot'))if(!observed.has(el)){observed.add(el);resize.observe(el);}};
 sync();new MutationObserver(sync).observe(root===document?document.body:root,{subtree:true,childList:true});
 root.addEventListener('click',event=>{const point=event.target.closest?.('[data-daily-point]');if(point){point.closest('[data-daily-chart]').dataset.pinned=point.dataset.chartIndex;selectPoint(point);}});
 root.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;const point=event.target.closest?.('[data-daily-point]');if(point&&point.getAttribute('aria-pressed')!=='true')selectPoint(point);});
 root.addEventListener('pointerout',event=>{const chart=event.target.closest?.('[data-daily-chart]');if(!chart||chart.contains(event.relatedTarget))return;const points=chart.querySelectorAll('[data-daily-point]'),pinned=chart.dataset.pinned;selectPoint(points[pinned??points.length-1]);if(pinned===undefined)delete chart.dataset.inspecting;});
 root.addEventListener('keydown',event=>{
  const point=event.target.closest?.('[data-daily-point]');if(!point)return;
  const chart=point.closest('[data-daily-chart]'),points=[...chart.querySelectorAll('[data-daily-point]')],i=points.indexOf(point);
  const next={ArrowLeft:Math.max(0,i-1),ArrowRight:Math.min(points.length-1,i+1),Home:0,End:points.length-1,Enter:i,' ':i}[event.key];
  if(next!==undefined){event.preventDefault();chart.dataset.pinned=String(next);selectPoint(points[next],true);}
 });
}
