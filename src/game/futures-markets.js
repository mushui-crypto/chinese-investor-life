import {recordDailyQuote} from './daily-quotes.js';
export const FUTURES_GROUPS=[['metals','金属'],['energy','能源'],['agriculture','农产品'],['indices','指数'],['fx','外汇']];
// All quotes are fictional. Commodity quotes are rebased to 100 at opening.
export const FUTURES_INSTRUMENTS=[
 {id:'GOLD',name:'黄金',group:'metals',tag:'贵金属',vol:.018},
 {id:'SILVER',name:'白银',group:'metals',tag:'贵金属',vol:.032},
 {id:'COPPER',name:'铜',group:'metals',tag:'工业金属',vol:.025},
 {id:'CRUDE',name:'原油',group:'energy',tag:'能源',vol:.04},
 {id:'NATGAS',name:'天然气',group:'energy',tag:'能源',vol:.055},
 {id:'GASOLINE',name:'汽油',group:'energy',tag:'成品油',vol:.035},
 {id:'SOYBEAN',name:'大豆',group:'agriculture',tag:'农产品',vol:.02},
 {id:'SUGAR',name:'原糖',group:'agriculture',tag:'农产品',vol:.027},
 {id:'COTTON',name:'棉花',group:'agriculture',tag:'农产品',vol:.023},
 {id:'INDEX_A',name:'A 股指数',group:'indices',tag:'跟随 A 股大盘',market:'a',vol:.02},
 {id:'INDEX_HK',name:'港股指数',group:'indices',tag:'跟随港股大盘',market:'hk',vol:.025},
 {id:'INDEX_US',name:'美股指数',group:'indices',tag:'跟随美股大盘',market:'us',vol:.025},
 {id:'USD_CNY',name:'美元 / 人民币',group:'fx',tag:'USD / CNY',base:'美元',quote:'人民币',vol:.004,initial:720000},
 {id:'EUR_CNY',name:'欧元 / 人民币',group:'fx',tag:'EUR / CNY',base:'欧元',quote:'人民币',vol:.005,initial:780000},
 {id:'EUR_USD',name:'欧元 / 美元',group:'fx',tag:'EUR / USD',base:'欧元',quote:'美元',vol:.005,initial:108333},
];
export const LEGACY_FUTURES=[{id:'GOLD',vol:.018},{id:'SILVER',vol:.032},{id:'stock',vol:.025},{id:'GBP',vol:.015},{id:'CHF',vol:.012},{id:'WTI_2020_05',vol:.04}];
export function futuresNoise(s,key){let hash=2166136261;for(const c of `${s.seed}:futures:${s.turn}:${s.trading.day}:${s.trading.phase}:${key}`)hash=Math.imul(hash^c.charCodeAt(0),16777619);hash^=hash>>>16;hash=Math.imul(hash,2246822507);hash^=hash>>>13;return (hash>>>0)/4294967296;}
export const futuresInstrument=id=>FUTURES_INSTRUMENTS.find(i=>i.id===id);
export const futureScale=id=>futuresInstrument(id)?.group==='fx'?100000:100;
export const formatFuturePrice=(id,n)=>(n/futureScale(id)).toLocaleString('zh-CN',{minimumFractionDigits:futureScale(id)===100?2:4,maximumFractionDigits:futureScale(id)===100?2:4});
export function futurePrice(s,id){
 const i=futuresInstrument(id);
 if(i?.market)return s.trading?.stockWorld?.[i.market]?.index??10000;
 if(id==='EUR_USD')return Math.max(1,Math.round(futurePrice(s,'EUR_CNY')/futurePrice(s,'USD_CNY')*100000));
 return s.markets[id]??i?.initial??10000;
}
export function syncFutureQuote(s,id,price,{daily=true}={}){
 const t=s.trading,i=futuresInstrument(id),old=i?.market?(t.stockWorld?.[i.market]?.open??10000):(s.markets[id]??i?.initial??10000);
 const q=t.quotes[id]??{price:old,open:old,history:[old]};
 if(daily)recordDailyQuote(s,q,price);
 q.price=price;q.history=[...q.history,price].slice(-24);t.quotes[id]=q;s.markets[id]=price;
}
export function syncLinkedFutures(s,{daily=true}={}){
 for(const i of FUTURES_INSTRUMENTS.filter(i=>i.market||i.group==='fx'))syncFutureQuote(s,i.id,futurePrice(s,i.id),{daily});
}
// Derive the cross from two shared legs; no independent EUR/USD random walk.
export function moveFx(s,draw,amplitude){
 for(const id of ['USD_CNY','EUR_CNY','EUR_USD']){const price=futurePrice(s,id);s.trading.quotes[id]??={price,open:price,history:[price]};}
 for(const id of ['USD_CNY','EUR_CNY'])s.markets[id]=Math.max(1,Math.round(futurePrice(s,id)*Math.exp((draw(s)-.5)*2*amplitude*(id==='EUR_CNY'?1.2:1))));
 s.markets.EUR_USD=futurePrice(s,'EUR_USD');
}
export function futuresPeriodPrices(s,years,{mul}){
 let counter=0;const draw=()=>futuresNoise(s,'period-'+counter++);const prices={};
 for(const i of FUTURES_INSTRUMENTS.filter(i=>!i.market&&i.group!=='fx'))prices[i.id]=Math.max(1,mul(futurePrice(s,i.id),Math.max(.15,1+(draw(s)-.5)*i.vol*12*Math.sqrt(years))));
 moveFx(s,draw,.08*Math.sqrt(years));
 for(const i of FUTURES_INSTRUMENTS.filter(i=>i.market||i.group==='fx'))prices[i.id]=futurePrice(s,i.id);
 return prices;
}
