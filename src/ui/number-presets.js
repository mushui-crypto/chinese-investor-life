// Values use the field's visible unit (yuan, shares, years), not ledger cents.
export function numberPresets({name='',min=0,max=Infinity,step=1,presets=''}){
 const money=['amount','price'].includes(name);
 let values=presets?presets.split(',').map(Number):name==='birthYear'?[1980,1988,1995,2000]:name==='quantity'?[1,2,3]:name==='lots'?[1,5,10,50]:name==='number'?[0,1,3,6]:money?[100,500,1000,5000,10000,50000,100000,300000,500000,1000000]:[1,5,10,30];
 if(money&&!presets&&min>100)values.unshift(min);
 values=[...new Set(values)].filter(n=>Number.isFinite(n)&&n>=min&&n<=max&&Math.abs((n-min)/step-Math.round((n-min)/step))<.00001).slice(0,4);
 // Exact remaining debt / cash below the first preset remains selectable.
 if(!values.length&&Number.isFinite(max)&&max>=min&&max>0)values=[Math.floor(max/step)*step];
 return values.map(value=>({value,label:money?'¥'+value.toLocaleString('zh-CN',{maximumFractionDigits:2}):String(value)+(name==='birthYear'?' 年':name==='quantity'?' 件':'')}));
}
