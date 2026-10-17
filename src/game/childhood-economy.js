export const MONTHLY_ALLOWANCE=200;
export function childhoodSpending(age){
 if(age<6||age>=18)return null;
 return age<12?{min:120,max:180}:age<15?{min:150,max:190}:{min:170,max:200};
}
// Settle each eligible month once. Old saves start from their current age.
export function settleChildhoodAllowance(s,fromAge,{draw,cashChange}){
 if(s.age<6||fromAge>=18)return [];
 const through=Math.min(215,Math.floor(s.age*12));
 const previous=s.childhood.allowanceThroughMonth??Math.max(71,Math.floor(fromAge*12));
 if(through<=previous)return [];
 let spent=0;
 for(let month=previous+1;month<=through;month++){
  const range=childhoodSpending(month/12);
  spent+=range.min+Math.floor(draw(s)*(range.max-range.min+1));
 }
 const months=through-previous,income=months*MONTHLY_ALLOWANCE;
 cashChange(s,income*100,'成长阶段零花钱');
 cashChange(s,-spent*100,'童年日常花销');
 s.childhood.allowanceThroughMonth=through;
 return [`${months} 个月零花钱 ${income} 元，零食、文具和出行等花销 ${spent} 元，存下 ${income-spent} 元。`];
}
