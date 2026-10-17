import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {act,nextTurn,chooseEvent,continueStory,eligibleChoices,leaveUnavailableEvent} from '../src/game/narrative.js';
import {getMetrics,getEndingMetrics,getActionAvailability,PRODUCTS} from '../src/game/core.js';
import {quoteFor} from '../src/game/market-play.js';
import {maximumOrder} from '../src/game/order-budget.js';
import {getMarketAccess} from '../src/game/market-access.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const catalog={};for(const key of ['events','families','history','endings','characters']){const data=JSON.parse(await readFile(`data/${key}.json`));catalog[key]=key==='events'?data.events:data;}setSaveCatalog(catalog);
const sourceHashes={};for(const file of ['src/game/core.js','src/game/risk-ending.js','src/game/narrative.js','src/game/gambling.js','data/endings.json'])sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const out=process.env.QA_REPORT_DIR||'reports/v1.18/balance',seeds=Number(process.env.BALANCE_SEEDS||6),policies=(process.env.BALANCE_POLICIES||'casino_allin,crypto_allin,diversified').split(',');await mkdir(out,{recursive:true});
const safe=['observe','uw_quit','self_study','school','rest','prison_study','prison_reflect','prison_letter','legal_cooperate','family','network','repair','job','work'];
const runs=[],errors=[];
for(const policy of policies)for(const family of catalog.families)for(let seed=0;seed<seeds;seed++){
 let s=createPlayableRun({seed:`balance-${family.id}-${seed}`,familyId:family.id,startAt:'adult',childhood:'study'},catalog),steps=0,trades=0,wins=0,zeroes=0,minWorth=getMetrics(s).netWorth;const starting=getMetrics(s).netWorth;
 const go=a=>{if(!getActionAvailability(s,a).allowed)return false;const old=s,n=act(s,a,catalog);assert.ok(!n.lastResult?.error,n.lastResult?.error);s=n;if(old.cash>0&&s.cash===0)zeroes++;minWorth=Math.min(minWorth,getMetrics(s).netWorth);return true;};
 try{
  while(s.phase!=='ended'&&steps++<1600){
   if(s.phase==='result'){s=continueStory(s,catalog);continue;}
   if(s.phase==='event'){const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),rank=policy==='casino_allin'?['uw_gamble','uw_chase',...safe.filter(x=>x!=='uw_quit')]:safe,choices=eligibleChoices(s,e).filter(c=>!c.disabled).sort((a,b)=>(rank.includes(a.profile)?rank.indexOf(a.profile):99)-(rank.includes(b.profile)?rank.indexOf(b.profile):99));if(!choices.length){s=leaveUnavailableEvent(s,catalog);continue;}s=chooseEvent(s,e.id,choices[0].id,catalog);assert.ok(!s.lastResult?.error,s.lastResult?.error);continue;}
   if(s.legal.prisonMonthsLeft===0){
    if(s.monthlyIncome<getMetrics(s).monthlyExpense*1.3)go({type:'seek_job'});
    if(policy==='diversified'){
     const spare=Math.max(0,s.cash-Math.max(getMetrics(s).livingReserve,getMetrics(s).monthlyExpense*12));
     const allocations=[['fund','balanced',.5],['bond','solid',.3],['stock','us_compute',.2]];
     for(const [product,instrument,fraction] of allocations){let amount=Math.floor(spare*fraction),a={type:'desk_order',product,instrument,amount};if(product==='stock')a={...a,...maximumOrder(amount,{product,instrument,price:quoteFor(s,product,instrument).price})};if(a.amount>=PRODUCTS[product].min&&go(a))trades++;}
     }else{
     if(policy==='crypto_allin'&&!getMarketAccess(s,'crypto_perp').unlocked){if(!s.marketProgress.simulations)go({type:'market_practice'});if(s.stats.insight<45)go({type:'study'});}
     for(let day=0;day<3&&!s.survival.failed;day++){
      for(let bet=0;bet<6&&s.trading.energy>0;bet++){
       if(policy==='casino_allin'){if(s.cash<10000)break;const before=s.cash;if(go({type:'gamble',game:'redblack',pick:'red',amount:s.cash})){trades++;if(s.cash>before)wins++;}else break;}
       else{if(s.cash<100000||!getMarketAccess(s,'crypto_perp').unlocked)break;if(!go({type:'desk_order',product:'crypto_perp',instrument:'BTCUSDT',amount:s.cash,leverage:100,direction:'long'}))break;trades++;const before=getMetrics(s).netWorth;go({type:'market_tick'});if(getMetrics(s).netWorth>before)wins++;if(s.trading.phase===3)break;}
      }
      while(s.trading.phase<3&&go({type:'market_tick'})){}
      if(!go({type:'market_day'}))break;
     }
    }
   }
   if(s.phase==='planning'&&s.actionPoints>0)go({type:s.stats.health<60||s.stats.stress>60?'rest':'work'});
   if(s.phase!=='ended'){s=nextTurn(s,catalog);assert.ok(!s.lastResult?.error,s.lastResult?.error);}
   if(steps%30===0)s=decodeSave(encodeSave(s));
  }
  assert.equal(s.phase,'ended','life must finish');const m=getMetrics(s),closing=getEndingMetrics(s);assert.deepEqual(decodeSave(encodeSave(s)),s);
  runs.push({policy,family:family.id,seed,age:s.age,ending:s.ending.id,starting,worth:closing.netWorth,recordedWorth:m.netWorth,pendingBills:m.pendingLegalBills,cash:s.cash,debt:m.debt,peak:s.peakNetWorth,minWorth,zeroes,trades,wins,failed:Boolean(s.survival.failed),ruined:s.survival.failed||closing.netWorth<=0,gamblingRounds:s.trading.gambling.rounds,allIns:s.riskLife.allIns,fate:s.riskLife.fate,terminal:s.riskLife.terminal?.kind??null,assets:m.assets,pendingGambling:s.legal.cases.filter(c=>c.type==='gambling'&&!c.settled).length});
 }catch(error){errors.push({policy,family:family.id,seed,age:s.age,phase:s.phase,error:error.stack});}
 if(seed===seeds-1)console.log(policy,family.id,'done');
}
const summary=Object.fromEntries(policies.map(policy=>{const rows=runs.filter(r=>r.policy===policy),worth=rows.map(r=>r.worth).sort((a,b)=>a-b);return [policy,{runs:rows.length,ruined:rows.filter(r=>r.ruined).length,everCashZero:rows.filter(r=>r.zeroes>0).length,hadWin:rows.filter(r=>r.wins>0).length,medianWorth:worth[Math.floor(worth.length/2)],millionYuan:rows.filter(r=>r.worth>=100000000).length,tenMillionYuan:rows.filter(r=>r.worth>=1000000000).length,grewWealth:rows.filter(r=>r.worth>r.starting).length,pendingGamblingAtEnd:rows.filter(r=>r.pendingGambling>0).length}];}));
await writeFile(`${out}/results.json`,JSON.stringify({passed:!errors.length,seeds,sourceHashes,summary,runs,errors,method:'Same seeds and all 12 families. Actions obey real permissions, cash, time, and bills. All policies seek work when pay is low and use remaining life actions for work or rest. All-in policies repeatedly wager available cash; diversified keeps 12 months of cash and invests surplus 50/30/20 in fund/bond/US stock. Final worth subtracts pending legal bills; recordedWorth retains the actual ledger before those bills settle. Each policy plays the three featured trading days, then advances the rest of the life period, during which wages may rebuild cash. This does not simulate daily gambling through every day of life and cannot prove universal ruin. The authored epilogue clears remaining personal assets on the gambling route and on selected repeated-all-in routes. Zero assets at these endings is enforced by the fictional ending rule, not claimed as an emergent result of real gambling odds or real market prices. These are scripted game samples, not human outcomes.'},null,2));console.log(JSON.stringify(summary,null,2));if(errors.length){console.error(errors);process.exitCode=1;}
