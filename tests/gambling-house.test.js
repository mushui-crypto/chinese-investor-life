import test from 'node:test';
import assert from 'node:assert/strict';
import {newGambling,resolveGamble,resolveHouseGamble,validateGambling} from '../src/game/gambling.js';
import {rngNext} from '../src/game/core.js';

const drawFor=seed=>()=>{const r=rngNext(seed);seed=r.seed;return r.value;};
const bet=(amount=10000,game='redblack',pick='red')=>({game,pick,amount});
function deal(g,a,draw,cash){const r=resolveHouseGamble(a,draw,g,cash);g.rounds++;g.staked+=a.amount;g.returned+=Math.round(a.amount*r.multiplier);return r;}

test('early small wagers usually win; ordinary wagers lose more; sudden increases lose most',()=>{
 let warm=0,normal=0,large=0,base=0;
 const count=2000;
 for(let i=0;i<count;i++){
  const seed=i*7919+31;
  warm+=resolveHouseGamble(bet(),drawFor(seed),newGambling(),1000000).multiplier>1;
  const established=()=>({...newGambling(),rounds:8,staked:80000,house:{smallWins:2,smallStake:10000,largestStake:10000}});
  normal+=resolveHouseGamble(bet(),drawFor(seed),established(),1000000).multiplier>1;
  large+=resolveHouseGamble(bet(50000),drawFor(seed),established(),1000000).multiplier>1;
  base+=resolveGamble(bet(),drawFor(seed)).multiplier>1;
 }
 assert.ok(warm/count>.85);assert.ok(normal<base&&normal/count<.35);
 assert.ok(large/count<.1&&large>0);assert.ok(large<normal);
});

test('switching tables does not reset small-win allowance; large first bets get no welcome win',()=>{
 const g=newGambling(),draw=drawFor(4001);
 for(const a of [bet(),bet(10000,'baccarat','banker'),bet(10000,'roulette','red')])deal(g,a,draw,1000000);
 assert.ok(g.house.smallWins<=2);assert.equal(g.rounds,3);assert.equal(g.house.smallStake,10000);
 validateGambling(g,0);
 let wins=0;for(let i=0;i<1000;i++)wins+=resolveHouseGamble(bet(500000),drawFor(i*7919),newGambling(),1000000).multiplier>1;
 assert.ok(wins>0&&wins<100);
});

test('saved house state reproduces results without rewriting old receipts or rerolling on reads',()=>{
 const g=newGambling();deal(g,bet(),drawFor(9021),1000000);g.history=[];
 const saved=JSON.parse(JSON.stringify(g)),a=bet(80000,'baccarat','player');
 assert.deepEqual(resolveHouseGamble(a,drawFor(7171),g,1000000),resolveHouseGamble(a,drawFor(7171),saved,1000000));
 assert.deepEqual(g,saved);
 const old=newGambling();delete old.house;validateGambling(old,0);assert.deepEqual(old.house,newGambling().house);
 for(const mutate of [h=>h.smallWins=3,h=>h.smallStake=-1,h=>h.largestStake=1]){const bad=newGambling();mutate(bad.house);assert.throws(()=>validateGambling(bad,0));}
});

test('selected outcomes keep their normal payout and early gifts never manufacture a jackpot',()=>{
 for(let seed=0;seed<200;seed++){
  const g=newGambling(),r=deal(g,bet(10000,'slots','spin'),drawFor(seed*7919),1000000);
  g.last={...r,stake:10000,returned:Math.round(10000*r.multiplier),round:1,day:0,bust:false,reckless:false};g.history=[g.last];
  validateGambling(g,0);
  if(g.house.smallWins)assert.ok(r.multiplier>1&&r.multiplier<=3);
 }
});
