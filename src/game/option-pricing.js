// Simplified game quote: intrinsic value plus time value. Both sides use the
// same premium rate; choosing an in-the-money strike cannot create free equity.
export function optionQuote({product,amount,direction='long',strikeRatio=1,duration=1,phase=0,price=10000}) {
 if(!['option','option_short'].includes(product)||!Number.isSafeInteger(amount)||amount<=0||![1,3,5].includes(duration)||![.95,1,1.05].includes(strikeRatio)||!['long','short'].includes(direction)||!Number.isSafeInteger(price)||price<=0||![0,1,2].includes(phase))return null;
 const remaining=duration-phase/3,strike=Math.round(price*strikeRatio);
 const intrinsicRate=Math.max(0,(price-strike)/price*(direction==='short'?-1:1));
 const timeRate=.04*Math.sqrt(remaining/3),rate=intrinsicRate+timeRate;
 const units=product==='option'?Math.floor(amount/rate):amount*3;
 if(!Number.isSafeInteger(units)||units<=0)return null;
 const intrinsic=Math.round(units*intrinsicRate),premium=product==='option'?amount:Math.round(units*rate);
 const timeValue=premium-intrinsic;
 const breakEven=strike+(direction==='short'?-1:1)*price*premium/units;
 return {units,premium,strike,timeValue,remaining,breakEven,margin:product==='option_short'?amount:0};
}
export function optionMark(position,price,day,phase) {
 const sign=position.direction==='short'?-1:1;
 const intrinsic=Math.round(position.units*Math.max(0,(price-position.strike)/position.entryPrice*sign));
 const remaining=Math.max(0,position.expiryDay-day+1-phase/3);
 const timeValue=Math.round((position.optionTimeValue??(position.kind==='option'?position.cost:position.premium))*Math.min(1,remaining/(position.optionRemainingAtOpen??position.optionDays)));
 return {intrinsic,liability:intrinsic+timeValue};
}
