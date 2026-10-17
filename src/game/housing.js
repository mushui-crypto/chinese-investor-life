export function housingQuote(price,financed=false,rentBps=300){
 if(!Number.isSafeInteger(price)||price<=0)return null;
 const payment=financed?Math.round(price*.3):price,principal=price-payment;
 return {price,payment,principal,monthlyPayment:Math.round(principal/240+principal*.045/12),annualRent:Math.round(price*rentBps/10000),annualMaintenance:Math.round(price*.01)};
}
