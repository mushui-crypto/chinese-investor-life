import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act,eligibleChoices} from '../src/game/narrative.js';
import {applyEffects,advanceTurn,getMetrics,getActionAvailability,getBehaviorStatus,getDebtCalendar,getDebtExtension,PRODUCTS} from '../src/game/core.js';
import {newCryptoLife} from '../src/game/crypto-life.js';
import {newBehavior} from '../src/game/behavior.js';
import {recordOnlineExposure,recordOnlineBet,recordOnlineQuit} from '../src/game/online-gambling.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {renderBehaviorHub,renderDebtCalendar} from '../src/ui/behavior-panel.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(cash=10000000,wage=400000){const s=createRun({seed:'life-v17',familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:wage,giftReceived:true});s.flags.gambling_exposed=true;s.stats.trust=70;s.stats.credit=80;s.stats.health=90;s.marketProgress={firstExperienceAge:18,simulations:2,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const action=(s,a)=>{const n=act(s,a,catalog);assert.equal(n.lastResult?.error,undefined,n.lastResult?.error);return n;};
const choose=(s,scene,choice)=>{s=structuredClone(s);s.behavior.pending=scene;return action(s,{type:'behavior_choice',scene,choice});};
const day=s=>action(s,{type:'calendar_day'});
const save=s=>decodeSave(encodeSave(s));
function loan(s=adult()){const r=applyEffects(s,[{op:'loan',principal_yuan:3600,apr_bps:1200,term_months:12,purpose:'approved_use'}],{profile:'bank'});assert.equal(r.result.error,undefined);return r.state;}

test('loan calendar settles only on due dates, repays interest then principal, and survives reload',()=>{
 let s=loan(),initial=s.cash;assert.equal(getDebtCalendar(s)[0].days,30);for(let i=0;i<29;i++)s=day(s);assert.equal(s.debts[0].principal,360000);assert.equal(getDebtCalendar(s)[0].days,1);s=day(save(s));assert.equal(s.debtClock.day,30);assert.equal(s.debts[0].principal,330000);assert.equal(s.debts[0].interest,0);assert.equal(s.debts[0].monthsLeft,11);assert.equal(s.cash,initial-30*18000-33600-(s.livingCosts?.total||0));assert.equal(getDebtCalendar(s)[0].days,30);assert.deepEqual(save(s),s);
});
test('daily and compressed monthly servicing produce the same total without duplicate interest or wages',()=>{
 const start=loan();const bulk=advanceTurn(start);assert.equal(bulk.result.error,undefined);let daily=start;for(let i=0;i<30;i++)daily=day(daily);daily=advanceTurn(daily).state;assert.equal(daily.cash,bulk.state.cash);assert.deepEqual(daily.debts,bulk.state.debts);assert.equal(daily.debtClock.day,180);assert.equal(daily.debtClock.periodDays,0);
});
test('partial targeted repayment reduces one creditor only and leaves unpaid due amounts overdue',()=>{
 let s=loan();s.cash=0;s.monthlyIncome=540000;for(let i=0;i<30;i++){s.cash=18000;s=day(s);}let d=s.debts.find(d=>d.kind==='bank');assert.ok(d.overdue);assert.equal(d.calendar.principalDue,30000);s.cash=10000;const before=d.principal;s=action(s,{type:'repay',id:d.id,amount:10000});d=s.debts.find(d=>d.kind==='bank');assert.equal(d.interest,0);assert.equal(d.principal,before-6400);assert.equal(d.calendar.principalDue,23600);assert.ok(d.overdue);assert.deepEqual(save(s),s);
});
test('one extension charges cash and extra interest, shifts the next bill, and cannot repeat',()=>{
 let s=loan(),d=s.debts[0],q=getDebtExtension(s,d.id),before=s.cash;assert.equal(q.fee,7200);assert.equal(q.interest,3600);s=action(s,{type:'debt_extend',id:d.id});assert.equal(s.cash,before-7200);assert.equal(s.debts[0].interest,3600);assert.equal(getDebtCalendar(s)[0].days,60);assert.match(getDebtExtension(s,d.id).reason,/一次/);for(let i=0;i<60;i++)s=day(s);assert.equal(s.debts[0].principal,330000);assert.equal(s.debts[0].interest,0);assert.deepEqual(save(s),s);
});
test('calendar daily mode uses real one-day gigs rather than multiplying half-year batches',()=>{
 let s=day(adult(1000000,0));assert.ok(s.debtClock.dailyMode);s=action(s,{type:'market_day'});const cash=s.cash;s=action(s,{type:'gig'});assert.equal(s.cash-cash,8000+Math.floor(adult().stats.skill)*20);for(let i=0;i<4;i++)s=day(s);assert.equal(s.debtClock.day,5);assert.ok(s.trading.dayInTurn<=2);
});
test('fatigue reduces paid salary once and the period does not refund the loss',()=>{
 const base=adult();let s=structuredClone(base);s.behavior.fatigue=65;s=day(s);assert.equal(s.survival.salaryPaid,0);assert.equal(s.survival.last.earned,9678);assert.equal(s.behavior.lostWages,3225);assert.equal(s.cash,base.cash-18000);const after=advanceTurn(s).state,normal=advanceTurn(base).state;assert.equal(normal.cash-after.cash,3225);assert.equal(after.behavior.lostWages,0);
});
test('high fatigue harms gig output; rest reduces fatigue and warning choices can lose or preserve a job',()=>{
 let s=adult();s.behavior.fatigue=85;const exhausted=action({...s,monthlyIncome:0},{type:'gig'});const healthy=action(adult(10000000,0),{type:'gig'});assert.equal(exhausted.cash-s.cash,Math.round((healthy.cash-s.cash)*.75));let rested=action(s,{type:'rest'});assert.equal(rested.behavior.fatigue,55);assert.ok(rested.stats.health>s.stats.health);
 const warning=choose(s,'work_warning','ignore');assert.equal(warning.monthlyIncome,s.monthlyIncome);assert.equal(warning.attendance.records.at(-1).kind,'absent');const repeated=structuredClone(s);repeated.debtClock.day=1;repeated.employment.active=true;repeated.attendance={job:0,lateDay:null,records:[{day:0,job:0,kind:'absent',fired:false}]};const lost=choose(repeated,'work_warning','ignore');assert.equal(lost.monthlyIncome,0);assert.match(lost.occupation,/开除/);const kept=choose(s,'work_warning','balance');assert.equal(kept.monthlyIncome,s.monthlyIncome);assert.equal(getBehaviorStatus(kept).cooldownDays,0);assert.equal(kept.behavior.cooldownUntil,0);
});
test('risk activity triggers a persisted story without mutating probabilities or auto-submitting a bet',()=>{
 let s=adult(10000000,0);for(let i=0;i<3;i++)s=action(s,{type:'gamble',game:'redblack',pick:'red',amount:10000});assert.ok(s.behavior.pending);const before=structuredClone(s);renderBehaviorHub(s,{money:n=>String(n),esc:s=>String(s),icon:()=>''});renderDebtCalendar(s,{money:n=>String(n),esc:s=>String(s),icon:()=>''});assert.deepEqual(s,before);assert.deepEqual(save(s),s);
 const n=choose(s,'tilt','chase');assert.equal(n.cash,s.cash);assert.equal(n.rng,s.rng);assert.deepEqual(n.trading.gambling,s.trading.gambling);assert.equal(n.behavior.heat,Math.min(100,s.behavior.heat+12));assert.equal(n.actionPoints,s.actionPoints);
});
test('legacy trade limits and cooldowns do not block orders; removed settings reject without mutation',()=>{
 let s=adult();Object.assign(s.behavior,{dailyLimit:0,limitSetDay:0,cooldownUntil:30});s=save(s);
 const before=structuredClone(s),html=renderBehaviorHub(s,{money:n=>String(n),esc:s=>String(s),icon:()=>''});
 assert.doesNotMatch(html,/交易限额与休息|behavior-limit|behavior_pause|behavior_limit|安排一次休息/);assert.deepEqual(s,before);
 for(const a of [{type:'behavior_limit',amount:100000},{type:'behavior_pause',days:7}]){assert.match(getActionAvailability(s,a).reason,/已移除/);const out=act(s,a,catalog);assert.ok(out.lastResult.error);assert.equal(out.cash,s.cash);assert.deepEqual(out.behavior,s.behavior);assert.equal(out.rng,s.rng);}
 assert.ok(getActionAvailability(s,{type:'invest',product:'crypto',amount:100000}).allowed);
 s=action(s,{type:'gamble',game:'redblack',pick:'red',amount:10000});assert.equal(s.behavior.usedToday,10000);
 assert.ok(getActionAvailability(s,{type:'invest',product:'crypto',amount:100000}).allowed);
 assert.equal(getBehaviorStatus(s).cooldownDays,0);assert.equal(getBehaviorStatus(s).dailyLimit,null);
 const poor=adult(0,0);Object.assign(poor.behavior,{dailyLimit:0,cooldownUntil:30});assert.equal(getActionAvailability(poor,{type:'gamble',game:'redblack',pick:'red',amount:10000}).allowed,false);
});
test('legacy cooldowns also leave authored risk choices available and life rest usable',()=>{
 let s=adult(10000000,0);s.behavior.cooldownUntil=30;s.behavior.dailyLimit=0;s=save(s);
 assert.ok(getActionAvailability(s,{type:'gamble',amount:10000,game:'redblack',pick:'red'}).allowed);
 assert.ok(getActionAvailability(s,{type:'gig'}).allowed);assert.ok(getActionAvailability(s,{type:'rest'}).allowed);
 const event=catalog.events.find(e=>e.id==='UG01');assert.ok(!eligibleChoices(s,event).find(c=>c.profile==='uw_gamble').disabled);
 const effects=event.choices.find(c=>c.profile==='uw_gamble').outcomes[0].effects;assert.equal(applyEffects(s,effects,{profile:'uw_gamble'}).result.error,undefined);
 s=choose(s,'tilt','cool');assert.ok(s.behavior.stopped);assert.ok(getActionAvailability(s,{type:'gamble',amount:10000,game:'redblack',pick:'red'}).allowed);
 s=action(s,{type:'gamble',game:'redblack',pick:'red',amount:10000});assert.equal(s.behavior.relapses,1);assert.equal(s.behavior.stopped,false);
});
test('family aid comes from finite reserves, preserves debt and refuses an unlimited bailout',()=>{
 let s=loan(),reserve=s.familyReserve,owed=getMetrics(s).debt;s=choose(s,'family_call','honest');const aid=reserve-s.familyReserve;assert.ok(aid>0&&aid<=500000);assert.equal(getMetrics(s).debt,owed);assert.equal(s.behavior.aidCount,1);assert.equal(s.behavior.supervisedUntil,30);assert.equal(s.behavior.disclosure,'honest');s.cash=10000;assert.equal(getActionAvailability(s,{type:'gamble',game:'redblack',pick:'red',amount:10000}).allowed,true);
 for(let i=0;i<2;i++){s.debtClock.day+=7;s.debtClock.periodDays+=7;s=choose(s,'family_call','honest');}assert.equal(s.behavior.aidCount,2);assert.deepEqual(save(s),s);
});
test('hidden debts can be discovered, shut off aid, and later be repaired through honest disclosure',()=>{
 let s=choose(loan(),'family_call','partial');assert.equal(s.behavior.reportedDebt,180000);for(let i=0;i<7;i++)s=day(s);assert.equal(s.behavior.pending,'family_exposed');s=action(s,{type:'behavior_choice',scene:'family_exposed',choice:'avoid'});assert.ok(s.behavior.aidBlocked);assert.match(getActionAvailability(s,{type:'borrow',kind:'family',amount:10000}).reason,/援助/);s=choose(s,'family_call','honest');assert.equal(s.behavior.aidBlocked,false);
});
test('group fees buy only a cached opinion; mute ends future group invitations',()=>{
 let s=choose(adult(),'group_invite','join'),cash=s.cash,rng=s.rng;s=choose(s,'group_tip','pay');assert.equal(s.cash,cash-30000);assert.equal(s.rng,rng);assert.match(s.behavior.tip,/问起消息来源，他没回复/);assert.equal(s.positions.length,0);s=choose(s,'group_tip','leave');assert.equal(s.behavior.group,'muted');
});
test('black-platform balance cannot pay bills and fee demand resolves to actual loss and one claim',()=>{
 let s=choose(adult(),'platform_invite','deposit');assert.equal(s.behavior.platformPaid,100000);assert.equal(s.behavior.platformBook,200000);assert.equal(s.cash,adult().cash-100000);assert.equal(getMetrics(s).assets,s.cash);s=day(s);assert.equal(s.behavior.pending,'platform_withdraw');s=action(s,{type:'behavior_choice',scene:'platform_withdraw',choice:'fee'});assert.equal(s.behavior.platformPaid,150000);assert.equal(s.behavior.platform,'lost');s=action(s,{type:'behavior_evidence'});assert.equal(s.claims.at(-1).face,150000);assert.equal(s.claims.at(-1).value,0);assert.equal(getMetrics(s).cashableAssets,0);assert.equal(getActionAvailability(s,{type:'behavior_evidence'}).allowed,false);assert.deepEqual(save(s),s);
});
test('quitting or recovering prevents legacy platform payments while preserving refusal and evidence',()=>{
 for(const status of ['QUIT','RECOVERED']){
  const start=adult();recordOnlineExposure(start);recordOnlineBet(start,{stake:10000,returned:0});recordOnlineQuit(start);start.behavior.onlineGambling.status=status;start.flags.gambling_quit=true;
  for(const [scene,choice] of [['platform_invite','deposit'],['platform_withdraw','fee']]){
   const s=structuredClone(start);s.behavior.pending=scene;s.behavior.platform='frozen';s.behavior.platformPaid=100000;s.behavior.platformBook=200000;
   const a={type:'behavior_choice',scene,choice};assert.equal(getActionAvailability(s,a).allowed,false);
   const blocked=act(s,a,catalog);assert.ok(blocked.lastResult.error);assert.equal(blocked.cash,s.cash);assert.equal(blocked.rng,s.rng);assert.deepEqual(blocked.behavior,s.behavior);
  }
  for(const c of ['inspect','decline']){const n=choose(start,'platform_invite',c);assert.equal(n.cash,start.cash);assert.equal(n.behavior.onlineGambling.status,status);}
  for(const c of ['evidence','stop']){const s=structuredClone(start);s.behavior.platform='frozen';s.behavior.platformPaid=100000;s.behavior.platformBook=200000;const n=choose(s,'platform_withdraw',c);assert.equal(n.cash,s.cash);assert.equal(n.behavior.onlineGambling.status,status);if(c==='evidence')assert.equal(n.claims.at(-1).face,100000);}
 }
});
test('a clean period leads to a recovery milestone without erasing debts or credit history',()=>{
 let s=choose(loan(),'tilt','cool');for(let i=0;i<7;i++)s=day(s);assert.equal(s.behavior.pending,'relapse');s=action(s,{type:'behavior_choice',scene:'relapse',choice:'limited'});for(let i=0;i<23;i++)s=day(s);assert.equal(s.behavior.pending,'rebuild');const debt=getMetrics(s).debt;s=action(s,{type:'behavior_choice',scene:'rebuild',choice:'plan'});assert.ok(s.behavior.rebuilt);assert.equal(getMetrics(s).debt,debt);assert.ok(s.behavior.history.some(h=>h.scene==='rebuild'));assert.deepEqual(save(s),s);
});
test('every authored behavior choice is executable with prerequisites and has persisted readable consequences',()=>{
 for(const [scene,e] of Object.entries(BEHAVIOR_EVENTS))for(const c of e.choices){let s=loan();if(scene==='platform_withdraw'){s.behavior.platform='frozen';s.behavior.platformPaid=100000;s.behavior.platformBook=200000;}s.behavior.fatigue=85;s=choose(s,scene,c.id);assert.ok(s.lastResult.text.trim().length>0,scene+':'+c.id);assert.equal(s.behavior.history.at(-1).scene,scene);assert.deepEqual(save(s),s);}
});
test('new fields migrate without charging or changing RNG; invalid calendars and story references are rejected',()=>{
 const s=adult();delete s.behavior;delete s.debtClock;const n=save(s);const {onlineGambling,cryptoLife,...priorBehavior}=n.behavior;assert.deepEqual(priorBehavior,newBehavior());assert.deepEqual(cryptoLife,newCryptoLife());assert.equal(onlineGambling.status,'EXPOSED');assert.equal(onlineGambling.totalBets,0);assert.equal(onlineGambling.staked,0);assert.equal(onlineGambling.returned,0);assert.equal(onlineGambling.memories.firstBet,null);assert.equal(n.cash,s.cash);assert.equal(n.rng,s.rng);
 for(const mutate of [s=>s.behavior.pending='invented',s=>s.behavior.heat=101,s=>s.debtClock.day=-1,s=>s.debts[0].calendar.nextDay=-1,s=>s.behavior.dailyLimit=-5]){const bad=loan();mutate(bad);assert.throws(()=>encodeSave(bad),/存档/);}
});
test('story choices never reinstate trading restrictions and a paid-off debt cannot yield family aid',()=>{
 for(const [scene,choice] of [['night_watch','limit'],['relapse','limited'],['relapse','keep'],['work_warning','balance'],['tilt','cool'],['hot_hand','protect'],['drawdown','pause']]){const n=choose(adult(),scene,choice);assert.equal(n.behavior.dailyLimit,null);assert.equal(n.behavior.cooldownUntil,0);assert.ok(getActionAvailability(n,{type:'gamble',amount:10000,game:'redblack',pick:'red'}).allowed);assert.doesNotMatch(n.lastResult.text,/限额|冷静期|七天/);}
 const noDebt=adult(),after=choose(noDebt,'family_call','honest');assert.equal(after.cash,noDebt.cash);assert.equal(after.familyReserve,noDebt.familyReserve);assert.equal(after.behavior.aidCount,0);
 assert.match(getActionAvailability(after,{type:'behavior_talk'}).reason,/明天/);
});
test('authored negotiations preview and apply the same paid extension without clearing overdue bills',()=>{
 const s=loan(),event=catalog.events.find(e=>e.id==='DEB03'),choice=eligibleChoices(s,event).find(c=>c.profile==='negotiate');assert.ok(!choice.disabled);assert.match(choice.planHint,/72/);assert.match(choice.planHint,/36/);
 const n=applyEffects(s,[{op:'extend_debt',turns:2}],{profile:'negotiate'});assert.equal(n.result.error,undefined);assert.equal(n.state.cash,s.cash-7200);assert.equal(n.state.debts[0].calendar.nextDay,60);assert.equal(n.state.debts[0].interest,3600);assert.ok(eligibleChoices(n.state,event).find(c=>c.profile==='negotiate').disabled);
 const overdue=loan();overdue.debts[0].overdue=true;overdue.debts[0].calendar.principalDue=30000;const rejected=applyEffects(overdue,[{op:'extend_debt',turns:2}]);assert.ok(rejected.result.error);assert.deepEqual(rejected.state,overdue);
});
test('legacy investment actions retain risk accounting without enforcing caps and period closing losses enter the same PnL ledger',()=>{
 let s=adult();s.behavior.dailyLimit=0;s=action(s,{type:'invest',product:'stock',amount:100000});assert.equal(s.behavior.usedToday,100000);assert.equal(s.behavior.riskActions,1);assert.ok(getActionAvailability(s,{type:'gamble',amount:10000,game:'redblack',pick:'red'}).allowed);
 const start=action(adult(),{type:'desk_order',product:'crypto_perp',amount:100000,direction:'long',leverage:10,instrument:'BTCUSDT'});const end=advanceTurn(start);assert.equal(end.result.error,undefined);assert.ok(!end.state.positions.some(p=>p.kind==='crypto_perp'));assert.equal(end.state.behavior.marketPnl,getMetrics(end.state).netWorth-getMetrics(adult()).netWorth-400000*5+540000*6+(end.state.livingCosts?.total||0)-end.state.employment.history.reduce((sum,h)=>sum+(h.kind==='penalty'?-h.amount:h.amount),0));
 const retire=adult();retire.age=55;const paused=action(retire,{type:'exit_risk'});assert.ok(paused.behavior.recoveryPlan&&paused.behavior.stopped);
});
