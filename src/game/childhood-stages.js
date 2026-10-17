export const CHILDHOOD_NODES=[0,3,6,10,12,13,14,15,16,17,18];
export function nextChildhoodAge(age){return CHILDHOOD_NODES.find(value=>value>age)??18;}
export function childhoodStageYears(s){return Math.max(1,Math.ceil(nextChildhoodAge(s.age)-s.age));}
export function childhoodContinueLabel(s){
 const age=nextChildhoodAge(s.age),name={3:'上幼儿园',6:'上小学',10:'小学高年级',12:'上初中',15:'上高中',18:'步入成年'}[age];
 return `${name||'继续这一学年'} → ${age} 岁`;
}
