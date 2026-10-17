import {cryptoClock,cryptoCoin} from './crypto-markets.js';
import {CRYPTO_HISTORY} from './crypto-history-data.js';
export {CRYPTO_HISTORY};
export const HISTORY_WINDOWS=Object.values(CRYPTO_HISTORY.windows);
export function replayWindow(s){return CRYPTO_HISTORY.windows[s.trading?.cryptoReplay?.scenario]||null;}
export function visibleCandles(s,symbol){const w=replayWindow(s);return w?.symbols[symbol]?.candles.slice(0,w.prelude+(s.trading.cryptoReplay.step||0)*8)||[];}
export function historicalSegment(s,symbol){const w=replayWindow(s),step=s.trading.cryptoReplay?.step;if(!w?.symbols[symbol]||!step||(s.trading.cryptoReplay.lastClock!==undefined&&s.trading.cryptoReplay.lastClock!==cryptoClock(s)))return null;return w.symbols[symbol].candles.slice(w.prelude+(step-1)*8,w.prelude+step*8);}
export function historicalIndex(s,symbol,realPrice){const w=replayWindow(s);if(!w?.symbols[symbol])return null;const base=Number(w.symbols[symbol].candles[w.prelude-1][4]);return Math.max(1,Math.round(Number(realPrice)/base*(s.trading.cryptoReplay.anchors?.[symbol]??1000000)));}
export function cryptoReference(symbol){const data=CRYPTO_HISTORY.windows.nov2022?.symbols[symbol];return data?Number(data.candles[23][4]):cryptoCoin(symbol)?.reference??1;}
