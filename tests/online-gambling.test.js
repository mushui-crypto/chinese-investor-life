import test from 'node:test';
import assert from 'node:assert/strict';
import {newOnlineGambling,ensureOnlineGambling,onlineGamblingState,recordOnlineExposure,recordOnlineBet,recordOnlineBorrow,recordOnlineQuit,recordOnlineRefusal,recordOnlineOrdinaryEvent,recordOnlineEvent,advanceOnlineGambling,adjustOnlineTendencies,onlineEventAllowed,onlineEventWeight,onlineChoiceWeight,onlineGamblingSummary,validateOnlineGambling,ONLINE_ENDINGS} from '../src/game/online-gambling.js';
const player=()=>({age:22,turn:10,birthYear:1988,cash:1000000,monthlyIncome:300000,occupation:'普通职员',flags:{},behavior:{},debtClock:{day:0,periodDays:0},positions:[],businesses:[],claims:[],debts:[],household:{partner:false}});
const time=(s,n)=>{s.debtClock.day+=n;s.age+=n/360;s.turn++;return s;};
const event=(id='OG04',meta={})=>({id,weight:10,onlineGambling:{requiredState:['firstBet'],repeatable:true,...meta}});
const normal=s=>{recordOnlineOrdinaryEvent(s,{eventId:'study'});recordOnlineOrdinaryEvent(s,{eventId:'friend'});};
const bet=(s,stake,returned,more={})=>recordOnlineBet(s,{stake,returned,source:'OG02',choice:'试一点',...more});

test('first exposure and a refusal return to life without placing a bet or changing money',()=>{
 const s=player(),before=structuredClone(s);recordOnlineExposure(s,'leave');const g=onlineGamblingState(s);
 assert.equal(s.cash,before.cash);assert.deepEqual(s.debts,before.debts);assert.equal(g.totalBets,0);assert.equal(g.status,'EXPOSED');assert.equal(g.cooldownUntil,180);assert.ok(s.flags.onlineGamblingExposed);assert.equal(onlineGamblingSummary(s).ending.title,'没点开的链接');
});
test('pure selectors do not create state, draw RNG or rewrite a save',()=>{
 const s=player(),before=structuredClone(s);onlineGamblingState(s);onlineGamblingSummary(s);onlineEventAllowed(s,event());onlineEventWeight(s,event());onlineChoiceWeight(s,{variant:'win'},10);assert.deepEqual(s,before);
});
test('paid and bonus outcomes are auditable while cash settlement stays with the existing engine',()=>{
 const s=player(),cash=s.cash;bet(s,2000,0);bet(s,5000,15000);bet(s,0,16800,{freeCredit:2000});const g=onlineGamblingState(s);
 assert.equal(g.staked,7000);assert.equal(g.returned,31800);assert.equal(g.freeCredit,2000);assert.equal(g.netProfit,24800);assert.equal(g.bonusClaimed,true);assert.equal(g.memories.firstBet.amount,2000);assert.equal(g.memories.firstLoss.amount,2000);assert.equal(g.memories.firstRecovery.amount,8000);assert.equal(g.memories.firstWin.amount,10000);assert.equal(s.cash,cash);assert.deepEqual(validateOnlineGambling(s),g);
});
test('large wins and later losses preserve first memories and historical high instead of guaranteeing failure',()=>{
 const s=player();bet(s,10000,180000,{bigWin:true});const first=structuredClone(onlineGamblingState(s).memories);time(s,360);bet(s,1000,2000);bet(s,1000,0);const g=onlineGamblingState(s);
 assert.deepEqual(g.memories.firstBigWin,first.firstBigWin);assert.deepEqual(g.memories.firstWin,first.firstWin);assert.equal(g.highestProfit,171000);assert.equal(g.netProfit,170000);recordOnlineQuit(s);assert.equal(onlineGamblingSummary(s).ending.title,'把运气当成运气');assert.equal(g.status,'QUIT');
});
test('every important stage can really quit, including first loss, first win, recovery and borrowing',()=>{
 for(const [stake,returned,title]of [[2000,0,'几十块买来的教训'],[2000,3000,'拿钱走人']]){const s=player();bet(s,stake,returned);const cash=s.cash;recordOnlineQuit(s,{choice:'停在这里'});assert.equal(onlineGamblingSummary(s).ending.title,title);assert.equal(s.cash,cash);assert.equal(s.debts.length,0);}
 const s=player();bet(s,10000,0);time(s,180);bet(s,10000,20000,{chasing:true});recordOnlineQuit(s);assert.ok(onlineGamblingState(s).memories.firstRecovery);assert.equal(onlineGamblingState(s).status,'QUIT');
});
test('calendar cooldown and two distinct completed life events are both required',()=>{
 const s=player();bet(s,10000,0);recordOnlineEvent(s,{eventId:'OG02',choice:'试一点',exitOpportunity:true});assert.equal(onlineEventAllowed(s,event()),false);
 time(s,60);assert.equal(onlineEventAllowed(s,event()),false);recordOnlineOrdinaryEvent(s,{eventId:'study'});recordOnlineOrdinaryEvent(s,{eventId:'study'});assert.equal(onlineEventAllowed(s,event()),false);
 recordOnlineOrdinaryEvent(s,{eventId:'friend'});assert.equal(onlineEventAllowed(s,event()),true);recordOnlineEvent(s,{eventId:'OG04',choice:'看看',ordinary:true});assert.equal(onlineEventAllowed(s,event('OG05')),false);
});
test('per-node repeat cooldown and long refusal cooldown coexist with ordinary event gaps',()=>{
 const s=player();bet(s,10000,0);recordOnlineEvent(s,{eventId:'OG08',choice:'最后一把'});time(s,60);normal(s);
 assert.equal(onlineEventAllowed(s,event('OG08',{cooldown:180})),false);time(s,120);assert.equal(onlineEventAllowed(s,event('OG08',{cooldown:180})),true);
 recordOnlineQuit(s);assert.equal(onlineEventAllowed(s,event('OG23',{requiredState:['QUIT']})),false);time(s,180);assert.equal(onlineEventAllowed(s,event('OG23',{requiredState:['QUIT']})),true);
});
test('trait, childhood history and key memories change weights without predetermining results',()=>{
 const a=player(),b=player();bet(a,1000,0);bet(b,1000,0);adjustOnlineTendencies(b,{chasing:40});b.studentStories={traits:{chasing:60,analysis:10}};
 const e=event('OG04',{tendency:'chasing',memoryTrigger:['firstLoss']});assert.ok(onlineEventWeight(b,e)>onlineEventWeight(a,e));
 for(const action of ['chase','allin','research','small'])for(const variant of ['loss','win','big_win','zero'])assert.ok(onlineChoiceWeight(b,{action,variant},10)>0);
});
test('loan memories record actual approved purpose-specific borrowing and do not fabricate money or debt',()=>{
 const s=player(),before=structuredClone(s);recordOnlineBorrow(s,{amount:10000,debtId:'loan-1',eventId:'OG19',choice:'借 100'});const g=onlineGamblingState(s);
 assert.equal(g.borrowCount,1);assert.equal(g.memories.firstBorrow.amount,10000);assert.equal(g.memories.firstDebt.eventId,'OG19');assert.deepEqual(g.borrowDebtIds,['loan-1']);assert.equal(s.cash,before.cash);assert.deepEqual(s.debts,before.debts);validateOnlineGambling(s);
});
test('recovery needs two years, repeated refusals, no new gambling loans and principal repayment',()=>{
 const s=player();bet(s,10000,0);s.debts=[{principal:100000,interest:0}];recordOnlineBorrow(s,{amount:100000,debtId:'a'});recordOnlineQuit(s);
 time(s,360);recordOnlineRefusal(s);recordOnlineRefusal(s);s.debts[0].principal=0;advanceOnlineGambling(s);assert.equal(onlineGamblingState(s).status,'QUIT');
 time(s,360);s.debts[0].principal=30000;advanceOnlineGambling(s);assert.equal(onlineGamblingState(s).status,'QUIT');s.debts[0].principal=20000;advanceOnlineGambling(s);assert.equal(onlineGamblingState(s).status,'RECOVERED');assert.equal(onlineGamblingSummary(s).ending.title,'上岸');
 time(s,720);normal(s);assert.equal(onlineEventAllowed(s,event('OG26')),true);assert.equal(onlineEventAllowed(s,event('OG02')),false);assert.equal(onlineEventAllowed(s,event('OG23')),false);validateOnlineGambling(s);
});
test('a remembered big win cannot claim recovery before serious borrowing or chasing has been repaired',()=>{
 const s=player();bet(s,10000,200000,{bigWin:true});recordOnlineBorrow(s,{amount:10000,debtId:'repair'});s.debts=[{principal:10000,interest:0}];recordOnlineQuit(s);assert.equal(onlineGamblingSummary(s).ending,null);
 time(s,720);recordOnlineRefusal(s);recordOnlineRefusal(s);assert.equal(onlineGamblingSummary(s).ending,null);s.debts=[];advanceOnlineGambling(s);assert.equal(onlineGamblingSummary(s).ending.id,'recovered');
 const chase=player();bet(chase,10000,200000,{bigWin:true});adjustOnlineTendencies(chase,{chasing:40});recordOnlineQuit(chase);assert.equal(onlineGamblingSummary(chase).ending,null);
});
test('years of small fixed-stake losses without escalation remain casual rather than a severe recovery route',()=>{
 const s=player();for(let i=0;i<6;i++){bet(s,2000,0,{action:'small'});time(s,360);}recordOnlineQuit(s);const g=onlineGamblingState(s);assert.equal(g.losses,6);assert.equal(g.escalations,0);assert.equal(g.borrowCount,0);assert.equal(g.tendencies.chasing,0);assert.equal(onlineGamblingSummary(s).ending.id,'casual');
 time(s,720);recordOnlineRefusal(s);recordOnlineRefusal(s);assert.equal(g.status,'RECOVERED');assert.equal(onlineGamblingSummary(s).ending.id,'casual');
});
test('a new gambling loan prevents recovery even if an old debt was paid',()=>{
 const s=player();bet(s,10000,0);recordOnlineQuit(s);recordOnlineBorrow(s,{amount:10000,debtId:'new'});time(s,800);recordOnlineRefusal(s);recordOnlineRefusal(s);advanceOnlineGambling(s);assert.equal(onlineGamblingState(s).status,'QUIT');
});
test('losing virtual trial credit records the loss without fabricating a cash deduction',()=>{
 const s=player();bet(s,0,0,{freeCredit:2000});const g=onlineGamblingState(s);assert.equal(g.firstOutcome,'loss');assert.equal(g.memories.firstLoss.amount,2000);assert.equal(g.staked,0);assert.equal(g.netProfit,0);assert.equal(s.cash,1000000);const before=structuredClone(s);assert.throws(()=>bet(s,0,1000,{freeCredit:2000}),/重复/);assert.deepEqual(s,before);validateOnlineGambling(s);
});
test('leaving after losing only free credit never claims the player paid for a lesson',()=>{
 const s=player();bet(s,0,0,{freeCredit:2000});recordOnlineQuit(s,{choice:'删掉'});const summary=onlineGamblingSummary(s);assert.equal(summary.status,'QUIT');assert.equal(summary.staked,0);assert.equal(summary.returned,0);assert.equal(summary.netLoss,0);assert.equal(summary.ending,null);validateOnlineGambling(s);
 const partial=player();bet(partial,0,1000,{freeCredit:2000});recordOnlineQuit(partial);assert.equal(onlineGamblingSummary(partial).ending.id,'walked_away');
});
test('recovered players cannot bypass the memory-only path with a direct bet or gambling loan',()=>{
 const s=player();bet(s,1000,0);recordOnlineQuit(s);time(s,720);recordOnlineRefusal(s);recordOnlineRefusal(s);const before=structuredClone(s);assert.throws(()=>bet(s,10000,0),/已经上岸/);assert.throws(()=>recordOnlineBorrow(s,{amount:10000}),/已经上岸/);assert.deepEqual(s,before);
});
test('only actual gambling resumes the chain; normal money and calendar changes preserve abstinence',()=>{
 const s=player();bet(s,10000,20000);recordOnlineQuit(s);time(s,900);s.cash+=100000;s.positions.push({value:20000});advanceOnlineGambling(s);assert.equal(onlineGamblingState(s).relapseCount,0);assert.equal(onlineGamblingState(s).longestQuit,900);
 bet(s,10000,0);const g=onlineGamblingState(s);assert.equal(g.relapseCount,1);assert.equal(g.status,'ACTIVE');assert.equal(g.memories.firstRelapse.day,900);assert.equal(g.longestQuit,900);assert.equal(g.quitDay,null);
});
test('legacy casino ledgers import totals without inventing a historical first-bet age',()=>{
 const s=player();s.flags.gambling_history=true;s.trading={gambling:{rounds:4,staked:60000,returned:70000,house:{largestStake:20000}}};const cash=s.cash;ensureOnlineGambling(s);const g=onlineGamblingState(s);assert.equal(g.legacyImported,true);assert.equal(g.totalBets,4);assert.equal(g.netProfit,10000);assert.equal(g.memories.firstBet,null);assert.equal(onlineGamblingSummary(s).firstBetAge,null);assert.equal(s.cash,cash);assert.equal(ensureOnlineGambling(s),g);bet(s,10000,20000);assert.equal(g.memories.firstBet,null);assert.equal(g.memories.firstWin,null);validateOnlineGambling(s);
 assert.equal(onlineEventAllowed(s,event('OG03',{requiredState:['firstWin']})),true);assert.equal(onlineEventAllowed(s,event('OG04',{requiredState:['firstBet']})),true);
});
test('payday and promotion scenes require real recent records',()=>{
 const s=player();bet(s,1000,0);const p=event('OG17',{requiredState:['payday']}),j=event('OG24',{requiredState:['recentPromotion']});assert.equal(onlineEventAllowed(s,p),false);assert.equal(onlineEventAllowed(s,j),false);
 s.payroll={history:[{net:300000,payday:'2010-01-01'}]};s.employment={history:[{kind:'promotion',day:0}]};assert.equal(onlineEventAllowed(s,p),true);assert.equal(onlineEventAllowed(s,j),true);time(s,181);assert.equal(onlineEventAllowed(s,p),false);assert.equal(onlineEventAllowed(s,j),false);
});
test('guru, model and borrowed-win followups require wins from that exact behavior',()=>{
 const s=player();bet(s,10000,20000,{action:'small'});recordOnlineBorrow(s,{amount:10000});
 for(const key of ['lastGuruWin','lastModelWin','lastModelLoss','borrowedWin'])assert.equal(onlineEventAllowed(s,event('OG12',{requiredState:[key]})),false);
 bet(s,10000,20000,{action:'guru'});assert.equal(onlineEventAllowed(s,event('OG12',{requiredState:['lastGuruWin']})),true);
 bet(s,10000,0,{action:'model'});assert.equal(onlineEventAllowed(s,event('OG16',{requiredState:['lastModelLoss']})),true);assert.equal(onlineEventAllowed(s,event('OG15',{requiredState:['lastModelWin']})),false);
 bet(s,10000,20000,{action:'model'});assert.equal(onlineEventAllowed(s,event('OG15',{requiredState:['lastModelWin']})),true);assert.equal(onlineEventAllowed(s,event('OG16',{requiredState:['lastModelLoss']})),false);
 bet(s,10000,20000,{action:'borrow',borrowed:10000});assert.equal(onlineEventAllowed(s,event('OG20',{requiredState:['borrowedWin']})),true);validateOnlineGambling(s);
});
test('stage summaries separate all thirteen paths and never settle assets or end the game',()=>{
 const make=()=>{const s=player();s.cash=10000;bet(s,10000,0);return s;},id=s=>onlineGamblingSummary(s,{netWorth:-1,debt:1000}).ending?.id;
 const a=make();bet(a,20000,50000);bet(a,50000,0);assert.equal(id(a),'after_recovery');
 const b=player();b.cash=10000;bet(b,10000,20000);bet(b,20000,30000);bet(b,50000,0);assert.equal(id(b),'winning_then_ruin');
 const c=make();adjustOnlineTendencies(c,{patternBelief:40});bet(c,20000,0);assert.equal(id(c),'theorist');
 const d=make();adjustOnlineTendencies(d,{guruDependence:40});d.flags.online_guru_gone=true;assert.equal(id(d),'guru');
 const e=make();recordOnlineBorrow(e,{amount:10000});recordOnlineBorrow(e,{amount:10000});assert.equal(id(e),'debt_cycle');
 const f=make();bet(f,20000,0);assert.equal(id(f),'bankruptcy');
 const casual=make();bet(casual,10000,15000);bet(casual,10000,10000);assert.equal(onlineGamblingSummary(casual).ending.id,'casual');
 const quit=make();for(let i=0;i<2;i++){recordOnlineQuit(quit);time(quit,180);bet(quit,10000,0);}recordOnlineQuit(quit);time(quit,720);recordOnlineRefusal(quit);recordOnlineRefusal(quit);assert.equal(onlineGamblingSummary(quit).ending.id,'back_and_forth');
 assert.equal(ONLINE_ENDINGS.length,13);const before=structuredClone(f);onlineGamblingSummary(f);assert.deepEqual(f,before);
});
test('small long-ago losses do not label unrelated insolvency as a gambling bankruptcy',()=>{
 const s=player();bet(s,1000,0);bet(s,1000,0);bet(s,1000,0);assert.notEqual(onlineGamblingSummary(s,{netWorth:-100000,debt:100000,monthlyExpense:300000}).ending?.id,'bankruptcy');
});
test('exit opportunities are counted at real decisions and sampled across the lifetime',()=>{
 const s=player();bet(s,10000,20000);for(let i=0;i<12;i++){recordOnlineEvent(s,{eventId:'OG08',choice:i<9?'再玩一次':'嗯。',exitOpportunity:true});time(s,180);normal(s);}const out=onlineGamblingSummary(s);assert.equal(out.exitOpportunities,12);assert.equal(out.points.length,6);assert.equal(out.points[0].day,0);assert.equal(out.points.at(-1).day,1980);assert.equal(onlineGamblingState(s).eventCounts.OG08,12);validateOnlineGambling(s);
});
test('tampered counters, first memories, future dates and arithmetic are rejected',()=>{
 const s=player();bet(s,10000,20000);recordOnlineEvent(s,{eventId:'OG02',exitOpportunity:true});for(const mutate of [g=>g.netProfit++,g=>g.memories.firstBet.day=1,g=>g.status='OTHER',g=>g.tendencies.chasing=101,g=>g.staked=-1,g=>g.eventLastDays.OG02=100,g=>g.ordinaryAtLastEvent=99,g=>g.history[0].amount=NaN]){const n=structuredClone(s);mutate(n.behavior.onlineGambling);assert.throws(()=>validateOnlineGambling(n),/网赌人生记忆/);}
});
