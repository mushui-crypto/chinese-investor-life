import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cryptoStoryPresentation,cryptoStoryChoice,cryptoStoryChoices,recordCryptoStory,CRYPTO_LIFE_EVENT_IDS,LEGACY_SCHEME_STORY_IDS} from '../src/game/crypto-life-stories.js';
import {newCryptoLife,cryptoEventAllowed} from '../src/game/crypto-life.js';
import {schemeLifeState,ensureSchemeLife,recordSchemeTrade} from '../src/game/scheme-life.js';
const events=JSON.parse(fs.readFileSync(new URL('../data/events.json',import.meta.url))).events;
const event=id=>events.find(e=>e.id===id);
const choice=(s,id,action)=>cryptoStoryChoice(s,event(id),event(id).choices.find(c=>c.cryptoAction===action));
function state(){return {age:28,cash:100000,rng:123,flags:{},stats:{},debts:[],positions:[],businesses:[],claims:[],turn:12,monthlyIncome:600000,occupation:'职员',debtClock:{day:3600,periodDays:0},trading:{quotes:{CLG:{price:10000,open:9000,history:[8000,8500,9000,9500,10000]},CHI:{price:20000,open:10000,history:[8000,10000,14000,18000,20000]}}},behavior:{onlineGambling:{ordinaryEvents:6,lastEventDay:null},cryptoLife:newCryptoLife()}};}
const pos=(id,cost,value,branch='spot')=>({id,kind:'crypto',instrument:branch==='alt'?'CHI':'CLG',name:branch==='alt'?'赤尾币':'澄光币',cost,value,cryptoLifeBranch:branch});

test('42 adult Crypto scenes are independent, retain exits and preserve all OG nodes',()=>{
 assert.equal(CRYPTO_LIFE_EVENT_IDS.length,42);assert.equal(events.filter(e=>e.onlineGambling).length,27);
 for(const id of CRYPTO_LIFE_EVENT_IDS){const e=event(id);assert.ok(e);assert.ok(e.age_min>=18);assert.ok(e.cryptoLife.minDelay>=90);assert.ok(e.choices.some(c=>['sell','principal','quit','reduce','exit_all','permanent_close','scheme_withdraw','refuse','remember','acknowledge'].includes(c.cryptoAction)));for(const c of e.choices)for(const o of c.outcomes)assert.deepEqual(o.schedule,[]);}
 assert.deepEqual(event('CL31').choices.map(c=>c.label),['知道了。']);assert.deepEqual(event('CL40').choices.map(c=>c.label),['哦。']);
 assert.ok(!JSON.stringify(events.filter(e=>e.cryptoLife)).match(/BTC|ETH|USDT|币安|Binance|比特币|星禾/));
});
test('every exposure answer records only exposure, no position, cash or next-node schedule',()=>{
 for(const id of ['CL01','CL08','CL13','CL22'])for(const c of cryptoStoryChoices(state(),event(id))){
  // CL08 includes an explicitly labelled buy; only the free introduction choices are observational.
  if(c.cryptoAction==='alt_buy')continue;
  const s=state(),next=structuredClone(s),o=c.outcomes[0];recordCryptoStory(next,s,event(id),c,o);
  assert.equal(next.cash,s.cash);assert.deepEqual(next.positions,[]);assert.equal(id==='CL22'?schemeLifeState(next).exposed:next.behavior.cryptoLife.exposed,true);assert.equal(next.behavior.cryptoLife.totalTrades,0);assert.ok(o.effects.every(x=>!['earn','spend','loan','crypto_life'].includes(x.op)));assert.deepEqual(o.schedule,[]);
 }
});
test('reading every scene and choice is deterministic and cannot draw or mutate state',()=>{
 const s=state();s.positions=[pos('spot',10000,12500),pos('alt',10000,1000,'alt')];const before=structuredClone(s);
 for(let i=0;i<2;i++)for(const id of CRYPTO_LIFE_EVENT_IDS){cryptoStoryPresentation(s,event(id));cryptoStoryChoices(s,event(id));}assert.deepEqual(s,before);
});
test('a first spot buy creates one explicit cent-denominated order and never promises a random payout',()=>{
 const s=state(),c=choice(s,'CL02','buy'),o=c.outcomes[0],e=o.effects.find(x=>x.op==='crypto_life');
 assert.equal(c.requirements.min_cash_yuan,100);assert.equal(e.amount,10000);assert.equal(e.action,'buy');assert.equal(e.branch,'spot');assert.match(c.planHint,/¥100/);assert.match(c.planHint,/手续费 ¥0/);assert.ok(o.effects.every(x=>!['earn','spend','venture'].includes(x.op)));assert.ok(!/已赚|盈利到账|随机盈利/.test(o.text));assert.equal(e.receipt.choice,c.label);
 s.cash=9999;assert.match(choice(s,'CL02','buy').cryptoReason,/现金不足/);assert.equal(choice(s,'CL02','refuse').cryptoReason,'');
});
test('price stories describe and sell the actual matching position rather than unrelated aggregate gains',()=>{
 const s=state();s.positions=[pos('loser',100000,2000),pos('winner',10000,22500)];const p=cryptoStoryPresentation(s,event('CL04')),c=choice(s,'CL04','sell');
 assert.match(p.prompt,/¥225/);assert.match(p.prompt,/\+125.0%/);assert.equal(c.outcomes[0].effects.find(e=>e.op==='crypto_life').positionId,'winner');assert.match(c.planHint,/¥224.55/);assert.match(c.planHint,/¥0.45/);
 s.positions=[];assert.match(choice(s,'CL04','sell').cryptoReason,/没有这类持仓/);
});
test('receipt recollections use the relevant real settled trade and never duplicate wages or scheme payments',()=>{
 const s=state(),g=s.behavior.cryptoLife;g.history=[{kind:'trade',branch:'leverage',age:25,cashFlow:12000,pnl:2000},{kind:'trade',branch:'spot',age:28,cashFlow:50000,pnl:10000}];g.schemePaid=99999;g.schemePayments=3;
 const p={id:'scheme',kind:'ponzi',name:'长灯计划',cost:100000,value:100000,bookBalance:100000,cryptoLifeBranch:'scheme',cryptoScheme:{status:'paying',stage:'normal',historyKnown:true}};s.positions=[p];recordSchemeTrade(s,p,{action:'buy',cashFlow:-100000,pnl:0});recordSchemeTrade(s,p,{action:'payment',cashFlow:12345,pnl:12345});
 assert.match(cryptoStoryPresentation(s,event('CL15')).prompt,/25 岁的实际结算：回款 ¥120，盈利 ¥20/);
 assert.match(cryptoStoryPresentation(s,event('CL24')).prompt,/累计实际到账 ¥123.45/);assert.doesNotMatch(cryptoStoryPresentation(s,event('CL24')).prompt,/¥999.99/);
 for(const id of ['CL15','CL24','CL25','CL32'])for(const c of cryptoStoryChoices(s,event(id)))assert.ok(c.outcomes.every(o=>o.effects.every(e=>e.op!=='earn')));
});
test('warning choices acknowledge the real warning or withdraw principal through the finance contract',()=>{
 const s=state();s.positions=[{id:'scheme',kind:'ponzi',name:'长灯计划',cost:10000,value:10000,cryptoLifeBranch:'scheme',cryptoScheme:{status:'warning',paymentCount:6}}];ensureSchemeLife(s);
 for(const c of cryptoStoryChoices(s,event('CL28'))){const effects=c.outcomes[0].effects.filter(e=>e.op==='crypto_life');assert.equal(effects.length,1);assert.equal(effects[0].action,c.cryptoAction==='scheme_withdraw'?'scheme_withdraw':'scheme_ack');assert.equal(c.cryptoReason,'');}
 const fail=cryptoStoryChoices(s,event('CL31'));assert.equal(fail.length,1);assert.ok(fail[0].outcomes[0].effects.every(e=>e.op!=='crypto_life'));
 for(const id of ['CL29','CL30'])for(const c of cryptoStoryChoices(s,event(id)))if(c.cryptoAction!=='scheme_withdraw')assert.ok(c.outcomes[0].effects.some(e=>e.op==='crypto_life'&&e.action==='scheme_ack'));
});
test('free rejection keeps all four branches optional, while leverage reduction never opens a new position',()=>{
 const s=state();for(const id of ['CL02','CL08','CL14','CL23']){const c=choice(s,id,'refuse');assert.equal(c.requirements.min_cash_yuan,0);assert.ok(c.outcomes[0].effects.every(x=>x.op!=='crypto_life'));}
 const c=choice(s,'CL20','reduce');assert.equal(c.outcomes[0].effects.find(x=>x.op==='crypto_life').action,'close_leverage');
 const n=structuredClone(s);n.behavior.cryptoLife.highLeverage=true;recordCryptoStory(n,s,event('CL20'),c,c.outcomes[0]);assert.equal(n.behavior.cryptoLife.highLeverage,false);assert.equal(n.cash,s.cash);
});
test('ordinary special choices need both real history and a gap through ordinary life',()=>{
 const s=state(),e=event('ENC_JOB03');assert.equal(cryptoStoryChoices(s,e).filter(c=>c.cryptoSpecial).length,0);
 const g=s.behavior.cryptoLife;g.exposed=true;g.tendencies.bigWinMemory=10;
 assert.equal(cryptoStoryChoices(s,e).filter(c=>c.cryptoSpecial).length,1);
 g.lastEventDay=s.debtClock.day;g.ordinaryAtLastEvent=6;
 assert.equal(cryptoStoryChoices(s,e).filter(c=>c.cryptoSpecial).length,0);
 s.debtClock.day+=90;s.behavior.onlineGambling.ordinaryEvents+=2;assert.equal(cryptoStoryChoices(s,e).filter(c=>c.cryptoSpecial).length,1);
});
test('a complete exit addresses every branch while daily life still offers a non-investment answer',()=>{
 const s=state(),c=choice(s,'CL34','exit_all'),effect=c.outcomes[0].effects.find(e=>e.op==='crypto_life');assert.equal(effect.action,'exit_all');assert.equal(effect.branch,undefined);
 for(const id of ['CL32','CL33','CL34','CL35','CL36','CL37','CL38','CL39'])assert.ok(cryptoStoryChoices(s,event(id)).some(c=>['refuse','remember'].includes(c.cryptoAction)));
 assert.equal(event('CL39').cryptoLife.allowRelapse,true);assert.equal(event('CL40').cryptoLife.memoryOnly,true);
});
test('financial gates do not prevent a zero-cash player from leaving every possible scene',()=>{
 const s=state();s.cash=0;
 for(const id of CRYPTO_LIFE_EVENT_IDS){const cs=cryptoStoryChoices(s,event(id));assert.ok(cs.some(c=>!c.cryptoReason&&c.requirements.min_cash_yuan===0),id);}
});
test('eligibility is based on real quotes and positions and does not force risk progression',()=>{
 const s=state(),g=s.behavior.cryptoLife;g.exposed=true;g.status='ACTIVE';g.exposedDay=1000;
 assert.equal(cryptoEventAllowed(s,event('CL03')),false);s.positions=[pos('held',10000,12500)];assert.equal(cryptoEventAllowed(s,event('CL03')),true);assert.equal(cryptoEventAllowed(s,event('CL14')),false);assert.equal(cryptoEventAllowed(s,event('CL23')),false);
 s.positions=[];g.leverageExposed=true;assert.equal(cryptoEventAllowed(s,event('CL14')),true);assert.equal(cryptoEventAllowed(s,event('CL23')),false);
});
test('retired PON invitations preserve locked ids but never schedule another funding chapter or pay referral rewards',()=>{
 const s=state();
 for(const id of LEGACY_SCHEME_STORY_IDS)for(const original of event(id).choices){const c=cryptoStoryChoice(s,event(id),original);assert.equal(c.id,original.id);assert.deepEqual(c.outcomes.map(o=>o.id),original.outcomes.map(o=>o.id));assert.ok(c.outcomes.every(o=>o.schedule.length===0));if(original.profile!=='ponzi_recruit')assert.deepEqual(c.outcomes.map(o=>o.effects),original.outcomes.map(o=>o.effects));}
 const recruit=cryptoStoryChoice(s,event('PON02'),event('PON02').choices.find(c=>c.profile==='ponzi_recruit'));
 assert.equal(recruit.profile,'observe');assert.equal(recruit.requirements.min_cash_yuan,0);assert.match(recruit.label,/不收介绍费/);assert.ok(recruit.outcomes.every(o=>!o.effects.some(e=>e.op==='earn'||e.op==='flag'&&e.key==='recruited')));assert.ok(recruit.outcomes.every(o=>o.effects.some(e=>e.op==='stat'&&e.delta.trust<0)));assert.equal(s.cash,100000);
});
