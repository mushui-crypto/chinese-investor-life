import test from 'node:test';
import assert from 'node:assert/strict';
import {newCryptoLife,ensureCryptoLife,cryptoLifeState,advanceCryptoLife,recordCryptoLifeEvent,recordCryptoLifeTrade,cryptoEventAllowed,cryptoEventWeight,cryptoLifeSummary,validateCryptoLife,CRYPTO_MEMORIES,CRYPTO_ENDINGS,CRYPTO_ACHIEVEMENTS} from '../src/game/crypto-life.js';
import {recordOnlineEvent,recordOnlineOrdinaryEvent} from '../src/game/online-gambling.js';
const player=()=>({age:22,turn:10,birthYear:1988,cash:10000000,monthlyIncome:300000,occupation:'普通职员',flags:{},behavior:{cryptoLife:newCryptoLife()},debtClock:{day:0,periodDays:0},positions:[],businesses:[],claims:[],debts:[],household:{partner:false,hasChild:false},stats:{social:10}});
const time=(s,n)=>{s.debtClock.day+=n;s.age+=n/360;s.turn++;return s;};
const event=(id='CL03',meta={})=>({id,weight:10,cryptoLife:{requiredState:['exposed'],repeatable:true,...meta}});
const normal=s=>{recordOnlineOrdinaryEvent(s,{id:'study'});recordOnlineOrdinaryEvent(s,{id:'friend'});};
let serial=0;
function buy(s,branch='spot',amount=10000,extra={}){const p={id:'crypto-'+serial++,kind:branch==='leverage'?'crypto_perp':branch==='scheme'?'ponzi':'crypto',cryptoLifeBranch:branch,cost:amount,value:amount,leverage:extra.leverage||1};s.positions.push(p);recordCryptoLifeTrade(s,p,{action:'buy',cashFlow:-amount,...extra});return p;}
function close(s,p,returned,extra={}){s.positions=s.positions.filter(x=>x.id!==p.id);recordCryptoLifeTrade(s,p,{action:'sell',cashFlow:returned,pnl:returned-p.cost,...extra});}
function act(s,action,extra={}){return recordCryptoLifeEvent(s,{eventId:'CL'+serial++,action,choice:action,...extra});}

test('all eligibility and summary reads are pure and never migrate a save',()=>{
 const s=player();delete s.behavior.cryptoLife;const before=structuredClone(s);cryptoLifeState(s);cryptoEventAllowed(s,event());cryptoEventWeight(s,event());cryptoLifeSummary(s);assert.deepEqual(s,before);
});
test('exposure changes memories only and every first introduction can decline',()=>{
 const s=player(),before=structuredClone(s);act(s,'curious',{exposure:true});assert.equal(s.behavior.cryptoLife.status,'EXPOSED');assert.equal(s.behavior.cryptoLife.tendencies.curiosity,7);act(s,'decline',{branch:'leverage',exposure:true});assert.equal(s.behavior.cryptoLife.leverageExposed,true);assert.equal(s.behavior.cryptoLife.totalTrades,0);assert.equal(s.cash,before.cash);assert.deepEqual(s.positions,before.positions);validateCryptoLife(s);
});
test('crypto and online stories share 90 days plus two ordinary completions',()=>{
 const s=player();act(s,'expose');time(s,90);assert.equal(cryptoEventAllowed(s,event()),false);normal(s);assert.equal(cryptoEventAllowed(s,event()),true);recordOnlineEvent(s,{eventId:'OG02'});time(s,90);assert.equal(cryptoEventAllowed(s,event()),false);normal(s);assert.equal(cryptoEventAllowed(s,event()),true);
});
test('repeat nodes enforce at least 180 days even if metadata asks for less',()=>{
 const s=player();recordCryptoLifeEvent(s,{eventId:'CL03',action:'expose'});time(s,90);normal(s);assert.equal(cryptoEventAllowed(s,event('CL03',{cooldown:1,minDelay:1})),false);time(s,90);assert.equal(cryptoEventAllowed(s,event('CL03',{cooldown:1,minDelay:1})),true);assert.equal(cryptoEventAllowed(s,event('CL03',{repeatable:false})),false);
});
test('four branches retain independent invested, returned and realized money in cents',()=>{
 const s=player(),cash=s.cash;for(const b of ['spot','alt','leverage','scheme']){const p=buy(s,b,10000);close(s,p,15000);}const g=cryptoLifeState(s);assert.equal(g.invested,40000);assert.equal(g.returned,60000);assert.equal(g.realizedProfit,20000);assert.equal(g.contractWins,1);assert.equal(g.contractLosses,0);assert.equal(s.cash,cash);assert.equal(s.debts.length,0);for(const b of Object.values(g.branches))assert.equal(b.realizedProfit,5000);validateCryptoLife(s);
});
test('paper wealth is never counted as realized return and first recovery needs receipts',()=>{
 const s=player(),p=buy(s,'alt',10000);p.value=110000;advanceCryptoLife(s);let g=cryptoLifeState(s);assert.equal(g.highestCryptoWealth,110000);assert.equal(g.returned,0);assert.equal(g.realizedProfit,0);assert.equal(g.memories.firstAltcoinBigWin.realized,false);assert.equal(g.memories.firstCryptoWin,null);close(s,p,5000);const q=buy(s,'spot',10000);close(s,q,16000);assert.equal(g.realizedProfit,1000);assert.equal(g.memories.firstRecovery.amount,1000);assert.equal(g.memories.firstCryptoWin.realized,true);validateCryptoLife(s);
});
test('spot breakeven requires that same live position to have been under water',()=>{
 const s=player(),p=buy(s);assert.equal(cryptoEventAllowed(s,event('CL06',{requiredState:['spotBreakeven']})),false);p.value=7000;advanceCryptoLife(s);p.value=10000;assert.equal(cryptoEventAllowed(s,event('CL06',{requiredState:['spotBreakeven']})),true);close(s,p,10000);buy(s);assert.equal(cryptoEventAllowed(s,event('CL06',{requiredState:['spotBreakeven']})),false);
});
test('actual liquidation records loss and cannot invent correct direction',()=>{
 const s=player(),p=buy(s,'leverage',100000,{leverage:50});close(s,p,0,{action:'liquidation'});const g=cryptoLifeState(s);assert.equal(g.liquidations,1);assert.equal(g.memories.firstLiquidation.amount,100000);assert.equal(cryptoEventAllowed(s,event('CL18',{requiredState:['directionCorrect']})),false);act(s,'direction_correct');assert.equal(g.correctLiquidations,0);assert.equal(g.contractLosses,1);validateCryptoLife(s);
});
test('observed +42 percent then liquidation can awaken the overnight story',()=>{
 const s=player(),p=buy(s,'leverage',100000);p.value=142000;advanceCryptoLife(s);close(s,p,0,{action:'liquidation'});assert.equal(cryptoEventAllowed(s,event('CL19',{requiredState:['overnightLoss']})),true);
});
test('payday, employment and family wakeups use real current facts',()=>{
 const s=player();for(const k of ['lifeSalary','lifeUnemployed','lifeMarriage','lifeChild','workTrouble'])assert.equal(cryptoEventAllowed(s,event('CL32',{requiredState:[k]})),false);s.payroll={history:[{net:300000,payday:'2010-01-01'}]};s.household.hasChild=true;s.household.partner=true;s.employment={history:[{kind:'penalty',day:0}]};for(const k of ['lifeSalary','lifeMarriage','lifeChild','workTrouble'])assert.equal(cryptoEventAllowed(s,event('CL32',{requiredState:[k]})),true);s.age=20;s.occupation='大学生';s.monthlyIncome=0;assert.equal(cryptoEventAllowed(s,event('CL33',{requiredState:['lifeUnemployed']})),false);
});
test('a quit decision never sells holdings and no amount of waiting exits a held asset',()=>{
 const s=player(),p=buy(s);act(s,'quit');assert.equal(s.positions[0],p);assert.equal(cryptoLifeState(s).status,'ACTIVE');time(s,900);advanceCryptoLife(s);assert.equal(cryptoLifeState(s).status,'ACTIVE');close(s,p,9000);advanceCryptoLife(s);assert.equal(cryptoLifeState(s).status,'QUIT');time(s,719);advanceCryptoLife(s);assert.equal(cryptoLifeState(s).status,'QUIT');time(s,1);advanceCryptoLife(s);assert.equal(cryptoLifeState(s).status,'CRYPTO_EXITED');validateCryptoLife(s);
});
test('zero-value unsold holdings prevent a false recovered status',()=>{
 const s=player(),p=buy(s,'alt');p.value=0;p.unsellable=true;act(s,'quit');time(s,1000);advanceCryptoLife(s);assert.equal(cryptoLifeState(s).status,'ACTIVE');assert.equal(cryptoLifeSummary(s).achievements.some(x=>x.id==='long_term'),true);
});
test('refusing years later does not reset abstinence and only a real purchase relapses',()=>{
 const s=player(),p=buy(s);close(s,p,12000);act(s,'quit');time(s,720);act(s,'refuse');assert.equal(cryptoLifeState(s).status,'CRYPTO_EXITED');const cash=s.cash;time(s,180);act(s,'ignore');assert.equal(cryptoLifeState(s).relapseCount,0);buy(s,'alt');const g=cryptoLifeState(s);assert.equal(g.relapseCount,1);assert.equal(g.status,'ACTIVE');assert.equal(g.memories.cryptoRelapse.day,900);assert.ok(g.achievements.bull_return);assert.equal(s.cash,cash);validateCryptoLife(s);
});
test('exited users receive memory events while voluntary trading can resume',()=>{
 const s=player(),p=buy(s);close(s,p,10000);time(s,720);advanceCryptoLife(s);assert.equal(cryptoEventAllowed(s,event()),false);assert.equal(cryptoEventAllowed(s,event('CL40',{memoryOnly:true})),true);assert.equal(cryptoEventAllowed(s,event('CL39',{allowRelapse:true})),true);
});
test('scheme payments are real receipts and warnings are not phantom sales',()=>{
 const s=player(),p=buy(s,'scheme',100000);for(let i=0;i<6;i++){time(s,30);recordCryptoLifeTrade(s,p,{action:'payment',cashFlow:1000,pnl:1000});}const g=cryptoLifeState(s),before=g.totalTrades;recordCryptoLifeTrade(s,p,{action:'warning',cashFlow:0,pnl:0,schemeWarning:true});assert.equal(g.totalTrades,before);assert.equal(g.branches.scheme.sells,0);assert.equal(g.schemePaid,6000);assert.equal(g.memories.firstSchemePayment.amount,1000);assert.ok(g.memories.firstSchemeWarning);close(s,p,0,{action:'scheme_failure',schemeFailure:true,lastPageBalance:130000});assert.equal(g.schemeLastPageBalance,130000);assert.equal(g.realizedProfit,-94000);assert.ok(g.achievements.stable_income);assert.equal(cryptoLifeSummary(s).ending.id,'stable_income');validateCryptoLife(s);
});
test('warning-time withdrawal needs later independent failure news for escaped ending',()=>{
 const s=player(),p=buy(s,'scheme',100000);recordCryptoLifeTrade(s,p,{action:'warning',cashFlow:0,schemeWarning:true});close(s,p,100000);assert.equal(cryptoLifeState(s).schemeExitedAfterWarning,true);assert.notEqual(cryptoLifeSummary(s).ending?.id,'escaped');time(s,180);act(s,'scheme_failure_news');assert.equal(cryptoLifeSummary(s).ending.id,'escaped');
});
test('cross-line and childhood tendencies reweight an event without changing choices or finances',()=>{
 const a=player(),b=player();act(a,'expose');act(b,'expose');time(a,90);time(b,90);normal(a);normal(b);b.studentStories={traits:{allIn:60}};b.behavior.onlineGambling.tendencies.chasing=40;b.flags.lottery_big_win=true;const e=event('CL16',{tendency:['chasing','FOMO']});const before=structuredClone(b);assert.ok(cryptoEventWeight(b,e)>cryptoEventWeight(a,e));assert.deepEqual(b,before);
});
test('legacy migration preserves cash and avoids invented first ages and lifetime totals',()=>{
 const s=player();delete s.behavior.cryptoLife;s.positions=[{id:'old',kind:'crypto',instrument:'BTC',cost:10000,value:18000}];s.trading={journal:[{crypto:{product:'crypto',action:'buy',cashFlow:-10000}}]};const before=structuredClone(s);const g=ensureCryptoLife(s);assert.equal(g.legacyImported,true);assert.equal(g.memories.firstCryptoBuy,null);assert.equal(g.invested,0);assert.equal(g.returned,0);assert.equal(g.highestCryptoWealth,18000);assert.equal(s.cash,before.cash);assert.deepEqual(s.positions,before.positions);const p=buy(s);close(s,p,12000);assert.equal(g.memories.firstCryptoBuy,null);assert.equal(g.memories.firstCryptoWin,null);validateCryptoLife(s);
});
test('achievements follow actual choices plus observed asset history',()=>{
 const s=player(),p=buy(s,'alt',10000);p.value=90000;advanceCryptoLife(s);p.value=3000;advanceCryptoLife(s);assert.ok(cryptoLifeState(s).achievements.held_it);p.value=1000;act(s,'hold',{branch:'alt'});act(s,'protect_principal',{branch:'alt'});p.value=100;act(s,'next_round',{branch:'alt'});for(let i=0;i<20;i++)act(s,'theory');for(let i=0;i<5;i++)buy(s,'spot',10000,{dipBuying:true});const q=s.positions.at(-1);q.value=1000;advanceCryptoLife(s);const g=cryptoLifeState(s);for(const k of ['value_investing','principal_protection','next_round','technical_analysis','dip_master','bought_bottom'])assert.ok(g.achievements[k],k);assert.equal(CRYPTO_ACHIEVEMENTS.length,12);validateCryptoLife(s);
});
test('12 achievement and 13 ending catalogs are unique; financial trouble alone is no Crypto bankruptcy',()=>{
 assert.equal(CRYPTO_ENDINGS.length,13);assert.equal(new Set(CRYPTO_ENDINGS.map(x=>x.id)).size,13);assert.equal(CRYPTO_MEMORIES.length,14);const s=player(),p=buy(s);close(s,p,0);assert.notEqual(cryptoLifeSummary(s,{netWorth:-100000,debt:100000,monthlyExpense:300000}).ending?.id,'bankruptcy');
});
test('forever-spot paths and profitable exits remain valid without entering risky branches',()=>{
 const a=player();buy(a,'spot',10000);time(a,1800);advanceCryptoLife(a);assert.equal(cryptoLifeSummary(a).ending.id,'forgotten');const b=player();buy(b,'spot',200000);time(b,1800);advanceCryptoLife(b);assert.equal(cryptoLifeSummary(b).ending.id,'holder');const c=player(),p=buy(c);close(c,p,13000);act(c,'quit');assert.equal(cryptoLifeSummary(c).ending.id,'walked_away');
});
test('summary is read-only and supplies complete branch and replay data',()=>{
 const s=player();buy(s);for(let i=0;i<12;i++){act(s,'hold',{exitOpportunity:true});time(s,180);normal(s);}const before=structuredClone(s),out=cryptoLifeSummary(s);assert.equal(out.points.length,8);assert.equal(out.points[0].day,0);assert.equal(out.points.at(-1).day,1980);assert.equal(out.exitOpportunities,12);assert.deepEqual(Object.keys(out.branches),['spot','alt','leverage','scheme']);assert.deepEqual(s,before);validateCryptoLife(s);
});
test('validation rejects tampered balances, memories, counters, future dates and unsafe cents',()=>{
 const s=player(),p=buy(s);close(s,p,14000);act(s,'hold');for(const change of [g=>g.invested++,g=>g.returned++,g=>g.realizedProfit++,g=>g.totalTrades++,g=>g.memories.firstCryptoBuy.day=1,g=>g.tendencies.FOMO=101,g=>g.status='OTHER',g=>g.eventLastDays[Object.keys(g.eventCounts)[0]]=100,g=>g.ordinaryAtLastEvent=99,g=>g.history[0].amount=NaN,g=>g.branches.spot.invested=MAX]){const copy=structuredClone(s);change(copy.behavior.cryptoLife);assert.throws(()=>validateCryptoLife(copy),/Crypto人生记忆/);}assert.throws(()=>recordCryptoLifeTrade(s,p,{action:'buy',cashFlow:-1.5}),/金额/);
});
const MAX=Number.MAX_SAFE_INTEGER;
test('catch-up payments preserve actual settled life days instead of stamping all as today',()=>{
 const s=player(),p=buy(s,'scheme',100000);time(s,210);recordCryptoLifeTrade(s,p,{action:'payment',cashFlow:1000,pnl:1000,lifeDay:30});recordCryptoLifeTrade(s,p,{action:'payment',cashFlow:1000,pnl:1000,lifeDay:210});const g=cryptoLifeState(s);assert.equal(g.memories.firstSchemePayment.day,30);assert.equal(g.schemeFirstPaidDay,30);assert.equal(g.schemeLastPaidDay,210);assert.equal(g.memories.firstSchemePayment.age,22.08);validateCryptoLife(s);
});
test('direction-correct memory is proven by a later real price and counted once',()=>{
 const s=player(),p=buy(s,'leverage',100000);p.underlying='CLG';p.entryPrice=10000;p.direction='long';s.markets={CLG:9000};close(s,p,0,{action:'liquidation'});advanceCryptoLife(s);assert.equal(cryptoLifeState(s).correctLiquidations,0);time(s,1);s.markets.CLG=10500;advanceCryptoLife(s);advanceCryptoLife(s);assert.equal(cryptoLifeState(s).correctLiquidations,1);assert.equal(cryptoEventAllowed(s,event('CL18',{requiredState:['directionCorrect']})),true);validateCryptoLife(s);
});
test('real purpose-specific loans are neither trade income nor fabricated borrowing',()=>{
 const s=player(),p={kind:'crypto_perp',cryptoLifeBranch:'leverage'},before=structuredClone(s);recordCryptoLifeTrade(s,p,{action:'borrow',cashFlow:100000,borrowed:100000,debtId:'actual-issued-loan'});const g=cryptoLifeState(s);assert.equal(g.borrowed,100000);assert.equal(g.returned,0);assert.equal(g.realizedProfit,0);assert.equal(g.totalTrades,0);assert.equal(s.cash,before.cash);assert.deepEqual(s.debts,before.debts);validateCryptoLife(s);
});
test('long-quit return requires a real market rally but does not require retained holdings',()=>{
 const s=player(),p=buy(s);close(s,p,12000);act(s,'quit');time(s,800);advanceCryptoLife(s);normal(s);const e=event('CL39',{requiredState:['exited','bullMarket','yearsSinceQuit'],allowRelapse:true});assert.equal(cryptoEventAllowed(s,e),false);s.trading={quotes:{CLG:{price:13000,open:10000,history:[10000,11000,13000]}}};assert.equal(cryptoEventAllowed(s,e),true);
});
test('the remaining distinct endings require their actual branch history rather than catalog labels',()=>{
 const ids=new Set();
 const right=player();for(let i=0;i<2;i++){const p=buy(right,'leverage',10000,{leverage:100});close(right,p,0,{action:'liquidation',directionCorrect:true});}ids.add(cryptoLifeSummary(right).ending.id);assert.equal(cryptoLifeSummary(right).ending.id,'right_direction');
 const graduate=player(),gp=buy(graduate,'leverage',10000,{leverage:100});close(graduate,gp,0,{action:'liquidation'});act(graduate,'lower_leverage');assert.equal(cryptoLifeSummary(graduate).ending.id,'leverage_graduate');ids.add('leverage_graduate');
 const overnight=player(),op=buy(overnight,'leverage',100000,{leverage:100});close(overnight,op,0,{action:'liquidation'});assert.equal(cryptoLifeSummary(overnight).ending.id,'overnight_zero');ids.add('overnight_zero');
 const king=player(),kp=buy(king,'alt',100000);kp.value=20000000;advanceCryptoLife(king);kp.value=200000;advanceCryptoLife(king);assert.equal(cryptoLifeSummary(king).ending.id,'alt_king');ids.add('alt_king');
 const hunt=player(),hp=buy(hunt,'alt',10000);hp.value=1000000;advanceCryptoLife(hunt);close(hunt,hp,1000000);act(hunt,'fomo');const loss=buy(hunt,'alt',2000000);close(hunt,loss,0);assert.equal(cryptoLifeSummary(hunt).ending.id,'after_hundredfold');ids.add('after_hundredfold');
 const exited=player();for(const b of ['spot','alt']){const p=buy(exited,b);close(exited,p,9000);}act(exited,'quit');time(exited,720);advanceCryptoLife(exited);assert.equal(cryptoLifeSummary(exited).ending.id,'graduated');ids.add('graduated');
 const bull=player(),p=buy(bull);close(bull,p,10000);act(bull,'quit');time(bull,720);advanceCryptoLife(bull);const gain=buy(bull,'spot',10000);close(bull,gain,20000);const ruin=buy(bull,'leverage',50000,{leverage:100});close(bull,ruin,0,{action:'liquidation'});assert.equal(cryptoLifeSummary(bull).ending.id,'bull_return');ids.add('bull_return');
 const bankrupt=player();for(const b of ['alt','scheme']){const p=buy(bankrupt,b,100000);close(bankrupt,p,0);}recordCryptoLifeTrade(bankrupt,{kind:'crypto_perp'},{action:'borrow',cashFlow:100000,borrowed:100000});act(bankrupt,'chase');const bp=buy(bankrupt,'leverage',100000,{leverage:100});close(bankrupt,bp,0,{action:'liquidation'});assert.equal(cryptoLifeSummary(bankrupt,{netWorth:-100000,debt:100000}).ending.id,'bankruptcy');ids.add('bankruptcy');
 assert.equal(ids.size,8);for(const s of [right,graduate,overnight,king,hunt,exited,bull,bankrupt])validateCryptoLife(s);
});
