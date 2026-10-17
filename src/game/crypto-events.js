import {HISTORY_WINDOWS} from './crypto-history.js';
import {cryptoClock,cryptoCoin,memeKind,FICTIONAL_CRYPTO_COINS} from './crypto-markets.js';
import {recordDailyQuote} from './daily-quotes.js';

export function enterCrypto(s,id,api){
 // Long-lived fictional coins use the same quote engine, without real-world replay scenes.
 if(FICTIONAL_CRYPTO_COINS.some(c=>c.id===id))return;
 const t=s.trading,kind=memeKind(s,id);
 if(kind==='rug'){
  t.memeProjects??={};t.memeProjects[id]??={due:cryptoClock(s)+2+Math.floor(api.draw(s)*5),failed:false};
 }
 if(!kind&&!t.cryptoEncounter&&!t.cryptoReplay){
  const scenario=api.draw(s)<.7?HISTORY_WINDOWS[Math.floor(api.draw(s)*HISTORY_WINDOWS.length)].id:null;
  t.cryptoEncounter={scenario,due:cryptoClock(s)+2+Math.floor(api.draw(s)*4),status:scenario?'waiting':'quiet'};
 }
}
export function advanceCryptoEncounter(s){
 const t=s.trading,e=t.cryptoEncounter;
 if(e?.status==='waiting'&&cryptoClock(s)>=e.due){
  const w=HISTORY_WINDOWS.find(w=>w.id===e.scenario),anchors={};
  for(const id of Object.keys(w.symbols))anchors[id]=t.quotes[id]?.price??s.markets[id]??10000;
  t.cryptoReplay={scenario:e.scenario,step:0,anchors};e.status='active';
 }
 if(t.cryptoReplay&&t.cryptoReplay.step<9){t.cryptoReplay.step++;t.cryptoReplay.lastClock=cryptoClock(s);if(t.cryptoReplay.step===9&&e)e.status='done';}
}
export function settleMemeProjects(s,api){
 const notes=[];
 for(const [id,p] of Object.entries(s.trading.memeProjects||{})){
  if(p.failed||cryptoClock(s)<p.due)continue;
  p.failed=true;
  const q=s.trading.quotes[id]??{price:s.markets[id]??10000,open:s.markets[id]??10000,history:[s.markets[id]??10000]};
  recordDailyQuote(s,q,0);q.price=0;q.history.push(0);q.history=q.history.slice(-24);s.trading.quotes[id]=q;s.markets[id]=0;
  for(const position of [...s.positions])if(position.instrument===id)api.closePosition(s,position,0,'Meme 项目归零');
  const text=`${cryptoCoin(id).name}突然撤走流动性，价格归零，停止交易。`;notes.push(text);
  s.trading.journal.push({day:s.trading.day,phase:s.trading.phase,text});s.trading.journal=s.trading.journal.slice(-60);
 }
 return notes;
}
export function hasPendingCrypto(s){return s.trading.cryptoEncounter?.status==='waiting'||Object.values(s.trading.memeProjects||{}).some(p=>!p.failed);}
