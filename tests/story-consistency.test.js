import {gameDate} from '../src/game/game-calendar.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,chooseEvent,eligibleChoices,getEventPresentation,getEventCandidates} from '../src/game/narrative.js';
import {applyAction,applyEffects,getMetrics} from '../src/game/core.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
import {characterAppearance,previewChoice} from '../src/game/experience.js';
import {resultMood} from '../src/game/story-presentation.js';
import {storyContextAllowed} from '../src/game/story-context.js';
import {repairLegacyWipeouts} from '../src/game/legacy-wipeout.js';
import {settleStageFocus,selectStagePlan} from '../src/game/stage-plan.js';
import {resultArtKey} from '../src/ui/event-art.js';
const read=n=>JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),history:read('history'),endings:read('endings'),characters:read('characters')};setSaveCatalog(catalog);
const event=id=>catalog.events.find(e=>e.id===id);
function fixture(cash=1000000){const s=createRun({familyId:'F01',seed:'story-fixes'},catalog);Object.assign(s,{age:18,turn:6,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:0,giftReceived:true});s.education.college=true;s.flags.college_student=true;s.flags.college_not_admitted=false;s.flags.stock_aware=true;s.occupation='大学生';s.stats.stress=30;s.stats.health=80;return s;}
function resolve(s,id,c=0,o=0){const e=event(id);s={...s,phase:'event',activeEvent:{eventId:id,outcomes:Object.fromEntries(e.choices.map((x,i)=>[x.id,x.outcomes[i===c?o:0].id]))}};const n=chooseEvent(s,id,e.choices[c].id,catalog);assert.equal(n.lastResult.error,undefined);return n;}
for(const [cash,paid,debt,health] of [[0,0,4000,10],[1000,1000,4000,5],[2000,2000,4000,0],[5000,5000,1000,0],[6000,6000,0,0]])test(`food not consumed creates no debt: cash ${cash}`,()=>{
 const s=fixture(cash);s.collegeSupport={version:1,lastPaidMonth:gameDate(s).slice(0,7),totalPaid:200000}; // no monthly transfer in this isolated settlement
 const n=applyAction(s,{type:'calendar_day'});assert.equal(n.result.error,undefined);const l=n.state.survival.last;
 assert.equal(l.paid,paid);assert.equal(l.shortfall,debt);assert.equal(l.healthLost,health);assert.equal(l.paid+l.shortfall+l.foodUnspent,l.due);
 assert.deepEqual(decodeSave(encodeSave(n.state)),n.state);
});
test('realized profit has result-specific title, matching artwork, readable stake and stress relief',()=>{
 const s=fixture(),n=resolve(s,'FND08',1,0);assert.equal(n.cash-s.cash,450000);assert.equal(n.stats.stress,26);assert.match(n.lastResult.title,/资源股上涨/);assert.equal(resultMood(n),'profit');assert.equal(resultArtKey(n,n.lastResult),'student-profit');assert.equal(characterAppearance(n).condition,0);
 assert.equal(previewChoice(s,event('FND08').choices[1]).stake.min,300000);assert.ok(n.ledger.some(e=>e.storyStake&&e.amount===-300000));assert.ok(!n.ledger.some(e=>/故事原型/.test(e.label)));
});
test('business result distinguishes retained capital from spendable cash',()=>{
 const s=fixture(),n=resolve(s,'HAO01');assert.equal(getMetrics(n).netWorth-getMetrics(s).netWorth,200000);assert.equal(n.cash-s.cash,42500);assert.equal(n.businesses[0].value,157500);assert.match(n.lastResult.title,/订单交付/);assert.match(n.lastResult.details,/1575 元留作经营资产/);assert.equal(n.stats.stress,26);assert.equal(resultArtKey(n,n.lastResult),'first-order-profit');
});
test('only losing actual cash and assets triggers wipeout; budget shortfall does not',()=>{
 const s=fixture(1000);s.investmentHistory=true;let n=applyEffects(s,[{op:'spend',amount_yuan:10}]).state;assert.equal(n.wipeouts,0);
 n=applyEffects(s,[{op:'venture',stake_fraction:1,gross_multiple:0}],{profile:'stock'}).state;assert.equal(n.wipeouts,1);assert.equal(n.wipeoutEvidence.capitalAfter,0);
 s.businesses.push({id:'business-proof',value:1,monthlyProfit:0});n=applyEffects(s,[{op:'venture',stake_fraction:1,gross_multiple:0}],{profile:'stock'}).state;assert.equal(n.wipeouts,0);
});
test('every first market category receives an introduction exactly until its first resolved event',()=>{
 const s=fixture();delete s.flags.stock_aware;for(const category of ['股票','基金与债券','期权','期货与合约','加密资产','资金盘与骗局','天使投资与创业股权','房产与大额资产']){
  const e=catalog.events.find(e=>e.category===category),before=JSON.stringify(s);const p=getEventPresentation(s,e,catalog);assert.notEqual(p.title,e.title,category);if(category!=='房产与大额资产')assert.ok(p.prompt.endsWith(e.prompt));assert.equal(JSON.stringify(s),before);
  const seen={...s,seenEvents:[e.id]};if(category!=='房产与大额资产')assert.equal(getEventPresentation(seen,e,catalog).title,e.title);
 }
 const p=getEventPresentation(s,event('OPT06'),catalog);assert.doesNotMatch(p.prompt,/出差|登机|落地/);assert.match(p.scopeNote,/500,000/);
});
test('gambling introduction gives three concrete choices without placing an undisclosed wager',()=>{
 for(const id of ['AGE20U','AGE20N'])for(let i=0;i<3;i++){const s=fixture();s.age=20;const n=resolve(s,id,i);assert.equal(n.cash,s.cash);assert.ok(n.flags.gambling_exposed);assert.doesNotMatch(n.lastResult.text,/没有急着下结论|标准答案|脑子重新能用/);}
});
test('relationship repair requires an actual overdue personal debt; old pending event becomes a neutral check-in',()=>{
 const s=fixture();s.flags.ever_wipeout=true;assert.equal(storyContextAllowed(s,event('REC07')),false);assert.ok(!getEventCandidates(s,catalog).some(e=>e.id==='REC07'));
 const p=getEventPresentation(s,event('REC07'),catalog);assert.match(p.title,/朋友.*开支/);assert.equal(p.artKey,'personal-budget');assert.ok(eligibleChoices(s,event('REC07')).every(c=>!c.disabled));
 const n=resolve(s,'REC07',1);assert.equal(n.cash,s.cash);assert.match(n.lastResult.text,/没有支出/);
 const employed={...s,age:25,flags:{...s.flags,employed:true},monthlyIncome:100000};const listened=resolve(employed,'REC07',2);assert.equal(listened.monthlyIncome,100000);assert.ok(listened.flags.employed);
 assert.ok(storyContextAllowed({...s,debts:[{kind:'friend',overdue:true}]},event('REC07')));
});
test('legacy repair uses cash at the historical log, not current wealth after recovery',()=>{
 const s={cash:5000,wipeouts:2,flags:{ever_wipeout:true},lastWipeoutTurn:3,logs:[{id:'log-2-10',title:'爆仓之后，人还在'},{id:'log-3-20',title:'爆仓之后，人还在'}],ledger:[{id:'entry-3-15',account:'cash',amount:-1000},{id:'entry-4-30',account:'cash',amount:5000}],presentations:[]};
 repairLegacyWipeouts(s);assert.equal(s.wipeouts,1);assert.ok(s.flags.ever_wipeout);const before=structuredClone(s);repairLegacyWipeouts(s);assert.deepEqual(s,before);
});
test('daily focus rewards are not farmed by switching, repeated settlement, a used evening or staying up',()=>{
 const s=fixture();s.behavior.fatigue=60;selectStagePlan(s,'recover');const api={stat:(x,d)=>{for(const [k,v] of Object.entries(d))x.stats[k]=Math.max(0,Math.min(100,x.stats[k]+v));}};
 s.debtClock.day++;settleStageFocus(s,api);assert.equal(s.stats.health,81);assert.equal(s.behavior.fatigue,48);assert.equal(s.stats.stress,27);const before=structuredClone(s);settleStageFocus(s,api);assert.deepEqual(s,before);
 for(const choices of [{5:'rest'},{6:'stay'}]){s.dayRoutine={choices};s.debtClock.day++;const health=s.stats.health;settleStageFocus(s,api);assert.equal(s.stats.health,health);}
});

test('graduation is shown at the college anchor with concrete non-investment choices',()=>{
 const s=fixture();s.age=22;const e=event('MAIN05'),p=getEventPresentation(s,e,catalog);assert.match(p.title,/大学毕业/);assert.equal(p.artKey,'graduation');assert.match(p.prompt,/学士帽/);
 const choices=eligibleChoices(s,e);assert.ok(choices.every(c=>!c.disabled));assert.match(choices[1].label,/求职.*技能/);const n=resolve(s,'MAIN05',1);assert.equal(n.cash,s.cash);assert.equal(n.stats.skill,s.stats.skill+4);assert.equal(n.ledger.length,s.ledger.length);
});

test('profit artwork follows the chosen stock instead of the surrounding option story, including an old saved receipt',async()=>{
 const {currentResultCopy}=await import('../src/game/story-presentation.js');const s=fixture(),n=resolve(s,'OPT02',1,0);
 assert.equal(n.lastResult.context.profile,'stock');assert.equal(resultArtKey(n,n.lastResult),'student-profit');
 delete n.lastResult.context;delete n.lastResult.investmentChanges;const before=JSON.stringify(n),r=currentResultCopy(n,catalog);
 assert.equal(resultArtKey(n,r),'student-profit');assert.equal(JSON.stringify(n),before);
});
test('paid option learning is clearly a course, not a losing trade',()=>{
 const s=fixture(),n=resolve(s,'HST16',1,0);assert.equal(n.cash-s.cash,-100000);assert.match(n.lastResult.title,/学习期权，未进行交易/);
 assert.equal(resultArtKey(n,n.lastResult),'options-study');assert.equal(resultMood(n),null);assert.match(event('HST16').choices[1].label,/¥1,000/);
});
test('profit, loss, flat, frozen and valuation outcomes use distinct artwork without guessing from price direction',()=>{
 const s=fixture();s.phase='result';
 for(const [pnl,key]of [[10000,'investment-profit'],[-10000,'investment-loss'],[0,'market-review'],[null,'market-review']])assert.equal(resultArtKey(s,{context:{activity:'investment',profile:'contract',settlement:'realized',pnl}}),key);
 assert.equal(resultArtKey(s,{context:{activity:'investment',profile:'angel',settlement:'valuation',pnl:20000}}),'venture');
 assert.equal(resultArtKey(s,{context:{activity:'investment',profile:'ponzi',settlement:'frozen',pnl:-10000}}),'account-frozen');
 s.education.college=false;s.flags.college_student=false;s.occupation='普通职员';assert.equal(resultArtKey(s,{context:{activity:'investment',profile:'stock',settlement:'realized',pnl:10000}}),'investment-profit');
});
test('an unrelated cash gift cannot turn investment loss into a profit illustration',()=>{
 const s=fixture(),r=applyEffects(s,[{op:'venture',stake_fraction:.1,gross_multiple:0},{op:'earn',amount_yuan:5000}],{profile:'stock'});
 assert.equal(r.result.investmentChanges[0].value,-100000);assert.ok(getMetrics(r.state).netWorth>getMetrics(s).netWorth);
});
