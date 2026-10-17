import {gameDate,validGameDate} from './game-calendar.js';
/** Recorded game sessions only. Never invent daily candles from an unlabelled old price path. */
export const DAILY_QUOTE_LIMIT=60;
const current=(s,b)=>b?.day===s.trading.day&&b.turn===s.turn;
function opening(s,q,price,phase=0){return {day:s.trading.day,turn:s.turn,date:gameDate(s),open:q.open??price,high:Math.max(q.open??price,price),low:Math.min(q.open??price,price),close:price,stage:phase,complete:phase===3,partial:phase>0};}
export function dailyQuotes(s,q,price=q.price){
 const bars=(q.daily||[]).filter(b=>b.stage>0||current(s,b));
 if(current(s,bars.at(-1)))return bars;
 // A quiet calendar jump has no new market observation: leave the last actual trading day intact.
 if(bars.length&&s.trading.phase!==0)return bars;
 return [...bars,opening(s,q,price,s.trading.phase)].slice(-DAILY_QUOTE_LIMIT);
}
export function openDailyQuote(s,q,price=q.price){
 if(current(s,q.daily?.at(-1)))return;
 q.daily=[...(q.daily||[]).filter(b=>b.stage>0),opening(s,q,price)].slice(-DAILY_QUOTE_LIMIT);
}
export function recordDailyQuote(s,q,price,previous=q.price){
 q.daily??=[];
 if(!current(s,q.daily.at(-1))){q.daily=q.daily.filter(b=>b.stage>0);q.daily.push(opening(s,q,previous,Math.max(0,s.trading.phase-1)));}
 const b=q.daily.at(-1);b.high=Math.max(b.high,price);b.low=Math.min(b.low,price);b.close=price;b.stage=s.trading.phase;b.complete=s.trading.phase===3;
 q.daily=q.daily.slice(-DAILY_QUOTE_LIMIT);
}
export function validateDailyQuotes(s,q,price=q.price,allowZero=false){
 if(q.daily===undefined)return; // v1.28 and earlier stay byte-for-byte compatible on load.
 const fail=()=>{throw Error('日线行情数据无效');};
 if(!Array.isArray(q.daily)||!q.daily.length||q.daily.length>DAILY_QUOTE_LIMIT)fail();
 let day=-1,turn=-1;
 for(const b of q.daily){
  if(b.date!==undefined&&!validGameDate(b.date))fail();
  if(!b||!Number.isSafeInteger(b.day)||b.day<=day||b.day>s.trading.day||!Number.isSafeInteger(b.turn)||b.turn<turn||b.turn<0||b.turn>s.turn)fail();
  if(!['open','high','low','close'].every(k=>Number.isSafeInteger(b[k])&&b[k]>=(allowZero?0:1))||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||b.low>b.high||!Number.isInteger(b.stage)||b.stage<0||b.stage>3||b.complete!==(b.stage===3)||typeof b.partial!=='boolean')fail();
  day=b.day;turn=b.turn;
 }
 const last=q.daily.at(-1);if(current(s,last)&&(last.close!==price||last.complete!==(s.trading.phase===3)))fail();
}
