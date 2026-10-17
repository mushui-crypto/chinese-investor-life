import {gameDate} from './game-calendar.js';
// Birth age is explicit for new children. Legacy saves use an actual birth log,
// or retain unknown age; loading must never invent a date or rewrite past bills.
export function childAge(s){
 if(!s.household.hasChild)return null;
 if(s.household.childBornOn){
  const born=s.household.childBornOn,date=gameDate(s);let years=Number(date.slice(0,4))-Number(born.slice(0,4));
  const anniversary=year=>`${year}-${born.slice(5)==='02-29'&&new Date(Date.UTC(year,1,29)).getUTCMonth()!==1?'02-28':born.slice(5)}`;
  if(date<anniversary(Number(born.slice(0,4))+years))years--;
  if(years<0)return 0;
  const start=Date.parse(anniversary(Number(born.slice(0,4))+years)),end=Date.parse(anniversary(Number(born.slice(0,4))+years+1));
  return years+(Date.parse(date)-start)/(end-start);
 }
 const born=s.household.childBornAge??s.logs?.find(row=>row.title==='家里多了一双小鞋')?.age;
 return Number.isFinite(born)&&born<=s.age?Math.max(0,s.age-born):null;
}
export const schoolAgeChild=s=>{const age=childAge(s);return age!==null&&age>=6&&age<18;};
export const dependentChild=s=>s.household.hasChild&&(childAge(s)===null||childAge(s)<22);
export function welcomeChild(s){
 if(!s.household.hasChild){s.household.childBornAge=s.age;s.household.childBornOn=gameDate(s);}
 s.household.hasChild=true;
}
