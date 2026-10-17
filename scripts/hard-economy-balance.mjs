import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {createRun,act} from '../src/game/narrative.js';import {applyAction,advanceTurn,getMetrics} from '../src/game/core.js';import {newLifeArcs} from '../src/game/life-arcs.js';import {AGE_LIVING_COSTS} from '../src/game/living-costs.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await fs.readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}
function adult(seed,{age=25,cash=1e7,skill=50}={}){const s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:0,occupation:'待业青年'});s.stats.skill=skill;s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];return s;}
function go(s,a){const n=act(s,a,catalog);assert.ok(!n.lastResult?.error,n.lastResult?.error);return n;}
const bands=AGE_LIVING_COSTS.map(b=>({age:b.label,daily:b.daily/100,monthly:b.daily*30/100})),profiles=[];
for(const [name,opts] of [['年轻人',{age:18,skill:25}],['普通职员',{age:25,skill:50}],['熟练职员',{age:40,skill:80}],['有孩子的中年人',{age:45,skill:100,dependants:true}]]){
 let s=adult('balance-'+name,opts);if(opts.dependants){s.household.partner=true;s.household.hasChild=true;}s=go(s,{type:'seek_job'});const start=s.cash,base=getMetrics(s).monthlyExpense/100;
 for(let i=0;i<30;i++){s.behavior.pending=null;s.lifeArcs.pending=null;s=go(s,{type:'calendar_day'});}profiles.push({profile:name,salary:s.monthlyIncome/100,baseMonthlyCost:base,thirtyDayNet:(s.cash-start)/100,unexpected:s.livingCosts?.total/100||0});
 assert.ok(s.cash<start,'Ordinary wages should not easily cover these city costs');
}
const ruin=[];for(const mode of ['no-work','daily-gig','salaried']){let s=adult('ruin-'+mode,{age:18,cash:0});if(mode==='salaried')s=go(s,{type:'seek_job'});let days=0;
 while(s.phase!=='ended'&&days<30){if(mode==='daily-gig'){if(s.trading.phase===3)s=go(s,{type:'market_day'});const r=applyAction(s,{type:'work'});assert.ok(!r.result.error);s=r.state;}s=go(s,{type:'calendar_day'});days++;}
 assert.equal(s.phase,'ended');assert.equal(s.ending.id,'E29');ruin.push({mode,days,unpaid:s.debts.reduce((a,d)=>a+d.principal+d.interest,0)/100});}
// A solvent character can still settle to age 80; hard mode does not make age progression itself impossible.
let solvent=adult('funded-lifetime',{age:18,cash:1e9});let periods=0;while(solvent.age<80){const result=advanceTurn(solvent);assert.ok(!result.result.error);solvent=result.state;periods++;assert.ok(periods<110);}assert.equal(solvent.age,80);
const report={fictional:true,bands,profiles,ruin,fundedLifetime:{age:solvent.age,periods,endingCash:solvent.cash/100},note:'Uses fixed wages and no investment returns for budget comparisons. Solvent fixture funds chronology coverage; it is not an ordinary-player win rate.'};const reportDir=process.env.QA_REPORT_DIR||'reports/v1.36';await fs.mkdir(reportDir,{recursive:true});await fs.writeFile(reportDir+'/hard-economy-balance.json',JSON.stringify(report,null,2)+'\n');console.table(profiles);console.table(ruin);console.log('Funded lifetime:',periods,'periods, age',solvent.age);
