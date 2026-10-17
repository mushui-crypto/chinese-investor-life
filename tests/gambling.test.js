import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun,act,settleRun,resumeRun,evaluateEndings} from '../src/game/narrative.js';
import {applyAction,advanceTurn,rngNext,getMetrics,getEndingMetrics} from '../src/game/core.js';
import {GAMBLING_GAMES,newGambling,resolveHouseGamble,resolveGamble,dealBaccarat,baccaratStreak,slotMultiplier,validateGambling,gamblingAudit} from '../src/game/gambling.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
function adult(){const s=createRun({seed:'casino-test',familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000000,monthlyIncome:800000,giftReceived:true});s.flags.gambling_exposed=true;return s;}
const step=(s,a)=>{const r=applyAction(s,a);assert.equal(r.result.error,undefined,r.result.error);return r.state;};
const save=s=>decodeSave(encodeSave(s));
const drawValues=values=>{let i=0;return ()=>{assert.ok(i<values.length,'only expected draws');return values[i++];};};
function cardDraw(ranks){const shoe=Array.from({length:416},(_,i)=>({rank:i%13+1,suit:Math.floor(i/13)%4}));return ()=>{const target=ranks.shift();assert.ok(target,'expected card request');const i=shoe.findIndex(c=>c.rank===(target.rank||target)&&(target.suit===undefined||target.suit===c.suit));assert.ok(i>=0);const r=(i+.25)/shoe.length;shoe.splice(i,1);return r;};}
const a=(game,pick,extra={})=>({type:'gamble',game,pick,amount:10000,...extra});
const seeded=n=>()=>{const r=rngNext(n);n=r.seed;return r.value;};

test('seven real engine paths produce reproducible receipts and one legal case per life period',()=>{
 let s=adult();assert.equal(Object.keys(GAMBLING_GAMES).length,7);
 for(const [game,pick] of [['dragon_tiger','dragon'],['baccarat','banker'],['dragon_cut','cut'],['sicbo','specific'],['roulette','number'],['slots','spin'],['redblack','red']]){
  if(game==='dragon_cut')s.trading.gambling.roads.baccarat=['banker','banker','tie','banker'];
  const before=structuredClone(s),command=a(game,pick,{number:6}),n=step(s,command);assert.deepEqual(step(save(s),command),n);assert.equal(s.rng,before.rng);assert.equal(n.cash-s.cash,n.trading.gambling.last.returned-10000);assert.equal(n.actionPoints,s.actionPoints);assert.equal(n.trading.energy,s.trading.energy);assert.deepEqual(save(n),n);s=n;
 }
 assert.equal(s.legal.cases.length,1);assert.equal(s.trading.gambling.history.length,7);assert.equal(s.trading.gambling.rounds,7);
});
test('dragon tiger compares rank, refunds half on ties and distinguishes suited ties',()=>{
 assert.equal(resolveGamble(a('dragon_tiger','dragon'),cardDraw([13,1])).multiplier,2);
 assert.equal(resolveGamble(a('dragon_tiger','tiger'),cardDraw([13,1])).multiplier,0);
 for(const pick of ['dragon','tiger'])assert.equal(resolveGamble(a('dragon_tiger',pick),cardDraw([5,5])).multiplier,.5);
 assert.equal(resolveGamble(a('dragon_tiger','tie'),cardDraw([5,5])).multiplier,12);
 assert.equal(resolveGamble(a('dragon_tiger','suited'),cardDraw([{rank:5,suit:0},{rank:5,suit:0}])).multiplier,51);
 assert.equal(resolveGamble(a('dragon_tiger','suited'),cardDraw([{rank:5,suit:0},{rank:5,suit:1}])).multiplier,0);
});
test('baccarat naturals stop dealing and every banker tableau boundary is enforced',()=>{
 const natural=dealBaccarat(cardDraw([4,2,4,3]));assert.equal(natural.player.length,2);assert.equal(natural.banker.length,2);assert.equal(natural.winner,'player');
 const hitByTotal=[new Set([0,1,2,3,4,5,6,7,8,9]),new Set([0,1,2,3,4,5,6,7,8,9]),new Set([0,1,2,3,4,5,6,7,8,9]),new Set([0,1,2,3,4,5,6,7,9]),new Set([2,3,4,5,6,7]),new Set([4,5,6,7]),new Set([6,7]),new Set()];
 for(let b=0;b<=7;b++)for(let third=0;third<=9;third++){
  const r=dealBaccarat(cardDraw([2,b||10,3,10,third||10,2]));assert.equal(r.player.length,3);assert.equal(r.banker.length,hitByTotal[b].has(third)?3:2,`banker ${b}, player third ${third}`);
 }
 for(let b=0;b<=7;b++){const r=dealBaccarat(cardDraw([3,b||10,3,10,2]));assert.equal(r.player.length,2);assert.equal(r.banker.length,b<=5?3:2);}
});
test('banker commission, player wins and tie pushes settle as advertised',()=>{
 assert.equal(resolveGamble(a('baccarat','banker'),cardDraw([4,4,3,5])).multiplier,1.95);
 assert.equal(resolveGamble(a('baccarat','player'),cardDraw([4,2,4,3])).multiplier,2);
 for(const pick of ['banker','player'])assert.equal(resolveGamble(a('baccarat',pick),cardDraw([4,4,4,4])).multiplier,1);
 assert.equal(resolveGamble(a('baccarat','tie'),cardDraw([4,4,4,4])).multiplier,9);
});
test('cut and follow share baccarat draws, ties preserve the streak and UI choices cannot change the deck',()=>{
 const g=newGambling();g.roads.baccarat=['player','banker','banker','tie','banker'];assert.deepEqual(baccaratStreak(g),{side:'banker',count:3});
 const cut=resolveGamble(a('dragon_cut','cut'),seeded(787),g),follow=resolveGamble(a('dragon_cut','follow'),seeded(787),g),plain=resolveGamble(a('baccarat','banker'),seeded(787),g);
 assert.equal(cut.detail.bet,'player');assert.equal(follow.detail.bet,'banker');assert.deepEqual(cut.detail.player,follow.detail.player);assert.deepEqual(cut.detail.banker,plain.detail.banker);assert.equal(cut.winner,plain.winner);
 const short=adult();assert.ok(applyAction(short,a('dragon_cut','cut')).result.error);
});
test('all 216 dice outcomes include triple exclusions and exactly one specific jackpot',()=>{
 let small=0,big=0,triple=0,specific=0;
 for(let x=0;x<6;x++)for(let y=0;y<6;y++)for(let z=0;z<6;z++){
  const values=[(x+.1)/6,(y+.1)/6,(z+.1)/6];const rolls=pick=>resolveGamble(a('sicbo',pick,{number:6}),drawValues(values));
  small+=rolls('small').multiplier;big+=rolls('big').multiplier;triple+=rolls('triple').multiplier;specific+=rolls('specific').multiplier;
  if(x===y&&y===z){assert.equal(rolls('small').multiplier,0);assert.equal(rolls('big').multiplier,0);}
 }
 assert.equal(small,210);assert.equal(big,210);assert.equal(triple,192);assert.equal(specific,181);
});
test('roulette has one zero, 18 of each color and straight-number payout includes principal',()=>{
 let red=0,black=0,single=0;
 for(let n=0;n<=36;n++){const draw=()=> (n+.1)/37;red+=resolveGamble(a('roulette','red'),draw).multiplier;black+=resolveGamble(a('roulette','black'),draw).multiplier;single+=resolveGamble(a('roulette','number',{number:0}),draw).multiplier;}
 assert.equal(red,36);assert.equal(black,36);assert.equal(single,36);for(const pick of ['red','black','odd','even'])assert.equal(resolveGamble(a('roulette',pick),()=>0).multiplier,0);
});
test('base slot generator covers all symbols and payouts before house selection',()=>{
 let payouts=0,jackpots=0;
 for(let x=0;x<20;x++)for(let y=0;y<20;y++)for(let z=0;z<20;z++){const r=resolveGamble(a('slots','spin'),drawValues([(x+.1)/20,(y+.1)/20,(z+.1)/20]));payouts+=r.multiplier;if(r.multiplier===1000)jackpots++;}
 assert.equal(jackpots,1);assert.equal(payouts/8000,.892625);assert.equal(slotMultiplier(['cherry','coin','cherry']),2);assert.equal(slotMultiplier(['cherry','cherry','cherry']),8);
});
test('observing a table records actual past cards without money, cases, or paid-round counters',()=>{
 let s=adult(),before=structuredClone(s);s=step(s,{type:'gamble_observe',game:'dragon_cut'});assert.equal(s.cash,before.cash);assert.equal(s.legal.cases.length,0);assert.equal(s.trading.gambling.rounds,0);assert.equal(s.trading.gambling.roads.baccarat.length,1);assert.equal(s.trading.energy,before.trading.energy);assert.ok(s.trading.gambling.lastObserved);assert.deepEqual(save(s),s);
});
test('all cash needs no reserve override, can hit zero, keeps debt and leaves work available',()=>{
 let s=adult();s.cash=100000;s=step(s,{type:'borrow',kind:'net',amount:100000});const debt=structuredClone(s.debts);s.monthlyIncome=0;s.occupation='待业青年';s.rng=0;const amount=s.cash;
 assert.equal(applyAction(s,a('roulette','number',{number:36,amount})).result.error,undefined);
 const n=step(s,a('roulette','number',{number:36,amount}));assert.equal(n.cash,0);assert.equal(n.trading.gambling.busts,1);assert.equal(n.flags.gambling_cash_bust,true);assert.deepEqual(n.debts,debt);assert.ok(!applyAction(n,{type:'gig'}).result.error);assert.deepEqual(save(n),n);
});
test('a naturally reachable 1000x seed pays cash but unresolved gambling bills prevent a wealth celebration',()=>{
 let jackpotSeed=null;for(let seed=0;seed<200000;seed++){if(resolveGamble(a('slots','spin'),seeded(seed)).multiplier===1000&&resolveHouseGamble(a('slots','spin',{amount:100000}),seeded(seed),newGambling(),200000).multiplier===1000){jackpotSeed=seed;break;}}assert.notEqual(jackpotSeed,null);
 const s=adult();s.cash=200000;s.peakNetWorth=200000;s.rng=jackpotSeed;
 const n=act(s,a('slots','spin',{amount:100000,reckless:true}),catalog);assert.equal(n.lastResult.error,undefined);assert.equal(n.cash,100100000);assert.equal(n.trading.gambling.bestWin,99900000);assert.ok(n.flags.gambling_big_win);assert.ok(!n.presentations.some(p=>p.kind==='wealth'));assert.ok(!n.flags.first_million_scene);assert.equal(n.legal.cases[0].profit,99900000);assert.deepEqual(save(n),n);
});
test('invalid bets fail atomically and exit, age and prison restrictions cover every new game',()=>{
 const s=adult();for(const command of [a('fake','spin'),a('__proto__','spin'),a('slots','hack'),a('roulette','number',{number:37}),a('sicbo','specific',{number:0}),a('slots','spin',{amount:-1}),a('slots','spin',{amount:Number.MAX_SAFE_INTEGER,reckless:true}),a('slots','spin',{reckless:'true'})]){const r=applyAction(s,command);assert.ok(r.result.error);assert.strictEqual(r.state,s);}
 for(const mutate of [x=>x.age=17,x=>x.flags.gambling_quit=true,x=>x.legal.prisonMonthsLeft=12,x=>x.flags.exit_intent=true]){const locked=structuredClone(s);mutate(locked);for(const game of Object.keys(GAMBLING_GAMES))assert.ok(applyAction(locked,a(game,'spin')).result.error);assert.ok(applyAction(locked,{type:'gamble_observe',game:'baccarat'}).result.error);}
});
test('new receipts are strictly validated and v1.3 red-black saves retain their old outcome and RNG',()=>{
 let s=step(adult(),a('slots','spin'));for(const mutate of [g=>g.history[0].stake=-1,g=>g.last.returned++,g=>g.roads.baccarat.push('FAKE'),g=>g.last.detail.reels=['jade','jade','jade'],g=>g.busts=999,g=>g.lastObserved={}]){const bad=structuredClone(s);mutate(bad.trading.gambling);assert.throws(()=>encodeSave(bad));}
 const old=adult();old.trading.gambling={rounds:1,staked:10000,returned:19000,last:{face:'red',pick:'red',stake:10000,returned:19000,day:0}};const copy=structuredClone(old),n=save(old);assert.deepEqual(n.trading.gambling.last,copy.trading.gambling.last);assert.equal(n.rng,copy.rng);assert.equal(n.cash,copy.cash);assert.equal(n.trading.gambling.history.length,0);
});
test('winning money, exiting and advancing still resolves the existing delayed legal liabilities once',()=>{
 let s=adult();s=step(s,a('slots','spin'));s=step(s,{type:'gamble_leave'});assert.ok(applyAction(s,a('redblack','red')).result.error);const caseId=s.legal.cases[0].id;
 for(let n=0;n<4;n++)s=advanceTurn(s).state;assert.equal(s.legal.cases.find(c=>c.id===caseId).status,'admin_closed');const count=s.ledger.filter(x=>x.label.includes('案件罚款')).length;s=advanceTurn(s).state;assert.equal(s.ledger.filter(x=>x.label.includes('案件罚款')).length,count);assert.deepEqual(save(s),s);
});
test('the gambling audit separates table cashflow, assessed bills, pending bills and unpaid debt',()=>{
 let s=step(adult(),a('redblack','red'));const copy=structuredClone(s),before=gamblingAudit(s),c=s.legal.cases[0];
 assert.deepEqual(s,copy);assert.equal(before.tableNet,s.trading.gambling.returned-s.trading.gambling.staked);assert.equal(before.pendingBills,c.confiscation+c.fine);assert.equal(before.assessedBills,0);assert.equal(before.unpaidBills,0);
 for(let i=0;i<4;i++)s=advanceTurn(s).state;
 const after=gamblingAudit(s);assert.equal(after.pendingBills,0);assert.equal(after.assessedBills,before.pendingBills);assert.equal(after.tableNet,before.tableNet);assert.equal(after.unpaidBills,s.debts.filter(d=>d.legalCaseId===c.id).reduce((n,d)=>n+d.principal+d.interest,0));
 assert.deepEqual(gamblingAudit(save(s)),after);
});
test('jackpot ending preserves real assets and pending bills without another wager',()=>{
 let seed=0;while(seed<200000&&(resolveGamble(a('slots','spin'),seeded(seed)).multiplier!==1000||resolveHouseGamble(a('slots','spin',{amount:20000000}),seeded(seed),newGambling(),20000000).multiplier!==1000))seed++;assert.ok(seed<200000);
 let s=adult();s.age=55;s.cash=20000000;s.peakNetWorth=s.cash;s.rng=seed;
 s=step(s,a('slots','spin',{amount:s.cash}));const before=structuredClone(s),m=getMetrics(s),closing=getEndingMetrics(s);
 assert.ok(m.net_worth_yuan>=100000000);assert.equal(closing.netWorth,m.netWorth-m.pendingLegalBills);assert.equal(closing.assets-closing.debt,closing.netWorth);
 assert.ok(!evaluateEndings(s,catalog).some(e=>e.id==='E01'||e.id==='E30'));
 const end=settleRun(s,catalog);assert.equal(end.phase,'ended');assert.equal(end.cash,before.cash);assert.equal(end.runStats.settlements.at(-1).netWorth,closing.netWorth);assert.equal(end.riskLife.terminal,null);
 for(const key of ['debts','legal','rng'])assert.deepEqual(end[key],before[key]);assert.deepEqual(end.trading.gambling,before.trading.gambling);assert.deepEqual(save(end),end);assert.deepEqual(s,before);
 assert.equal(resumeRun(end,catalog).lastResult?.error,undefined);s=structuredClone(before);
 for(let i=0;i<4;i++)s=advanceTurn(s).state;assert.equal(getMetrics(s).pendingLegalBills,0);assert.equal(getEndingMetrics(s).netWorth,getMetrics(s).netWorth);assert.equal(s.legal.cases.filter(c=>c.settled).length,1);assert.deepEqual(save(s),s);
});
