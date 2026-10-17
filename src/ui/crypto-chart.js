import {marketChartBars} from './market-chart.js';
import {cryptoCoin} from '../game/crypto-markets.js';

/** Decorative, explicitly labelled market prehistory. Never draws game RNG or predicts an event. */
export function cryptoChartBars(s,id,q){
 return marketChartBars(s,id,q,{vol:cryptoCoin(id)?.vol??.05});
}
