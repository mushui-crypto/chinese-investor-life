import {stockLot} from './stock-markets.js';
/** Current game entry fees are zero. Exit/holding fees remain with settlement. */
export function orderCost(action){const amount=action.amount;return {amount,fee:0,total:amount};}
export function maximumOrder(cash,{product,instrument,price}={}){
 if(!Number.isSafeInteger(cash)||cash<0)throw Error('现金金额无效');
 if(product==='stock'){
  const lot=stockLot(instrument);if(!Number.isSafeInteger(price)||price<=0)throw Error('报价无效');
  const unit=BigInt(lot)*BigInt(price),lots=Number(BigInt(cash)/unit),shares=lots*lot,amount=Number(BigInt(lots)*unit);
  return {lots,shares,amount,...orderCost({amount})};
 }
 return {amount:cash,...orderCost({amount:cash})};
}
export function cashBudget(s,m,spend=0){const remaining=m.livingReserve,after=s.cash-spend;return {cash:s.cash,remaining,spare:Math.max(0,s.cash-remaining),shortage:Math.max(0,remaining-s.cash),after,afterShortage:Math.max(0,remaining-after)};}
