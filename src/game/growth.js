/** Childhood accumulation is deliberately slower than adult training. Never rebase a loaded save. */
export function growthDelta(s,key,value){
 if(s.age>=18||value<=0)return value;
 if(['academic','discipline','skill','insight','fame','trust'].includes(key)){
  if(s.stats[key]>=75)return 0;
  return Math.min(75-s.stats[key],Math.max(1,Math.round(value*.45*Math.max(.15,1-s.stats[key]/90))));
 }
 if(key==='stress')return Math.max(1,Math.round(value*.5));
 return value;
}
export function childhoodRoutine(s,focus){
 if(s.stats.stress>=42||s.stats.health<60||s.turn%3===2)return 'rest';
 if(focus==='social')return 'social';
 return 'study';
}
