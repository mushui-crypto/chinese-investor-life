import {gameDate} from './game-calendar.js';
import {CRYPTO_COINS,MEME_COINS} from './crypto-markets.js';
import {recordCryptoLifeTrade} from './crypto-life.js';

export function legacyCryptoRecord(j){
 if(j.crypto||/行情|快讯/.test(j.text)||!/成交|卖出|平仓|结清|强平/.test(j.text))return null;
 const coin=[...CRYPTO_COINS,...MEME_COINS].find(c=>j.text.startsWith(c.id)||j.text.startsWith(c.name));
 return coin?{product:/合约/.test(j.text)?'crypto_perp':'crypto',instrument:coin.id}:null;
}

export function appendMarketJournal(s,text,crypto){
 const t=s.trading;
 const clock=['07:00','09:30','11:30','13:00','15:00','18:30','22:30','次日 02:00','夜间'][s.dayRoutine?.stage];
 t.journal.push({day:t.day,phase:t.phase,text,date:gameDate(s),...(clock?{clock}:{}),...(crypto?{crypto}:{})});
 // Keep executed trades from being pushed out by repeated quote updates.
 const isTrade=j=>Boolean(j.crypto||legacyCryptoRecord(j));
 const trades=t.journal.filter(isTrade).slice(-30),other=t.journal.filter(j=>!isTrade(j)).slice(-(60-trades.length));
 const kept=new Set([...trades,...other]);t.journal=t.journal.filter(j=>kept.has(j));
}

export function recordCryptoTrade(s,p,{action,cashFlow,pnl,text,...info}){
 if(!['crypto','crypto_perp'].includes(p.kind)||!s.trading)return false;
 recordCryptoLifeTrade(s,p,{...(p.cryptoLifeReceipt||p.cryptoLifeOrigin||{}),...info,action,cashFlow,pnl});
 const crypto={product:p.kind,instrument:p.instrument||p.underlying||'crypto',name:p.name,action,cashFlow};
 if(pnl!==undefined)crypto.pnl=pnl;
 if(p.kind==='crypto_perp'){crypto.direction=p.direction||'long';crypto.leverage=p.leverage||1;}
 appendMarketJournal(s,text,crypto);return true;
}
