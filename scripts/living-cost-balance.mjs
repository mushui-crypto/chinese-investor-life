import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun} from '../src/game/narrative.js';
import {advanceLivingCosts,AGE_LIVING_COSTS,livingCostBreakdown} from '../src/game/living-costs.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}
const samples=200,days=720,rows=[],api={charge:(s,n)=>{s.cash-=n;return 0;},stat:()=>{}};
for(const band of AGE_LIVING_COSTS){
 const count={small:0,medium:0,large:0};let amount=0,minGap=Infinity,maxMonthly=0;
 for(let i=0;i<samples;i++){
  const s=createRun({seed:'balance-'+i,familyId:'F01'},catalog);s.age=band.from;s.cash=1e10;s.monthlyIncome=500000;
  let previous=0,all=[];
  for(let day=0;day<days;day++){
   advanceLivingCosts(s,1,api);
   if(s.livingCosts.lastAny>previous){const e=s.livingCosts.history.at(-1);all.push(e);count[e.tier]++;amount+=e.amount;if(previous)minGap=Math.min(minGap,e.day-previous);previous=e.day;maxMonthly=Math.max(maxMonthly,all.filter(h=>e.day-h.day<30).length);}
  }
 }
 assert.ok(minGap>=7);assert.ok(maxMonthly<=3);
 const round=n=>Math.round(n*100)/100;
 rows.push({age:band.label,basePerDay:band.daily/100,smallPer30Days:round(count.small/samples/days*30),mediumPer360Days:round(count.medium/samples/days*360),largePer360Days:round(count.large/samples/days*360),meanExtraPer30Days:round(amount/100/samples/days*30),minGap,maxRolling30Days:maxMonthly});
}
const report={samples,days,model:'Fictional 30-day months; ample cash, no dependants; independent seeded expense draws. Actual shortage/survival suppresses draws.',rows};
const out=process.env.QA_REPORT_DIR||'reports/v1.35';await mkdir(out,{recursive:true});await writeFile(out+'/expense-balance.json',JSON.stringify(report,null,2));console.table(rows);
