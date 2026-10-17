// Shared transaction wording for orders, holdings, receipts and the asset ledger.
const terms={
 stock:{open:'买入',close:'卖出',all:'全部卖出',half:'卖出一半',amount:'买入金额',fee:'交易手续费'},
 fund:{open:'申购',close:'赎回',all:'全部赎回',half:'赎回一半',amount:'申购金额',fee:'赎回费'},
 bond:{open:'买入',close:'卖出',all:'全部卖出',half:'卖出一半',amount:'买入金额',fee:'交易手续费'},
 crypto:{open:'买入',close:'卖出',all:'全部卖出',half:'卖出一半',amount:'买入金额',fee:'交易手续费'},
 futures:{open:'开仓',close:'平仓',all:'全部平仓',half:'平仓一半',amount:'保证金',fee:'平仓手续费'},
 crypto_perp:{open:'开仓',close:'平仓',all:'全部平仓',half:'平仓一半',amount:'保证金',fee:'平仓手续费'},
 option:{open:'买入开仓',close:'卖出平仓',all:'全部卖出平仓',half:'卖出平仓一半',amount:'权利金',fee:'平仓手续费'},
 option_short:{open:'卖出开仓',close:'买入平仓',all:'全部买入平仓',half:'买入平仓一半',amount:'保证金',fee:'平仓手续费'},
 angel:{open:'认购股权',close:'转让股权',all:'全部转让',amount:'投资金额',fee:'转让手续费'},
 housing:{open:'购买房产',close:'出售房产',all:'出售房产',amount:'购房款',fee:'出售手续费'},
 ponzi:{open:'投入',close:'提现',all:'申请提现',amount:'投入金额',fee:'提现手续费'}
};
export function tradeTerms(kind){return terms[kind]||{open:'投入',close:'转让',all:'全部转让',amount:'投入金额',fee:'交易手续费'};}
export function directionLabel(kind,direction='long'){
 if(['option','option_short'].includes(kind))return direction==='short'?'认沽期权':'认购期权';
 return direction==='short'?'做空':'做多';
}
export function orderLabel(kind,direction='long'){
 return ['futures','crypto_perp'].includes(kind)?directionLabel(kind,direction)+'开仓':tradeTerms(kind).open;
}
export function positionSide(p){
 if(!p.direction)return '';
 return (p.kind==='option'?'买入':p.kind==='option_short'?'卖出':'')+directionLabel(p.kind,p.direction);
}
