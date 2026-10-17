import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {onlineStoryPresentation,onlineStoryChoice,onlineStoryChoices,recordOnlineStory,ONLINE_EVENT_IDS} from '../src/game/online-gambling-stories.js';
import {newOnlineGambling} from '../src/game/online-gambling.js';
const events=JSON.parse(fs.readFileSync(new URL('../data/events.json',import.meta.url))).events;
const event=id=>events.find(e=>e.id===id),byAction=(id,action)=>event(id).choices.find(c=>c.onlineAction===action);
function state(){const g=newOnlineGambling();g.exposed=true;g.status='ACTIVE';return {age:24,cash:970000,rng:123,flags:{},stats:{},debts:[],positions:[],businesses:[],claims:[],turn:12,debtClock:{day:2160,periodDays:0},behavior:{onlineGambling:g}};}
const resolved=(s,id,action)=>onlineStoryChoice(s,event(id),byAction(id,action));

test('27 adult nodes retain the old student catalog and no automatic next-node links',()=>{
 assert.equal(ONLINE_EVENT_IDS.length,27);assert.equal(events.filter(e=>e.studentStory).length,42);
 for(const id of ONLINE_EVENT_IDS){const e=event(id);assert.ok(e);assert.ok(e.age_min>=18);assert.ok(e.onlineGambling.minDelay>=60);assert.ok(e.onlineGambling.minOrdinaryEvents>=2);assert.ok(e.choices.some(c=>['quit','withdraw','refuse','remember'].includes(c.onlineAction)));assert.ok(e.choices.every(c=>c.outcomes.every(o=>o.schedule.length===0)));}
});
test('first exposure has the four intended free actions; choosing one never stakes or schedules another story',()=>{
 const s=state();s.behavior.onlineGambling=newOnlineGambling();const e=event('OG01');assert.deepEqual(e.choices.map(c=>c.label),['我看看。','你先玩，赢了告诉我。','靠谱吗？','算了。']);
 for(const c of onlineStoryChoices(s,e)){assert.equal(c.requirements.min_cash_yuan,0);assert.ok(c.outcomes.every(o=>!o.effects.some(x=>['spend','earn','loan'].includes(x.op))));const next=structuredClone(s);recordOnlineStory(next,s,e,c,c.outcomes[0]);assert.equal(next.behavior.onlineGambling.exposed,true);assert.equal(next.behavior.onlineGambling.totalBets,0);assert.equal(next.cash,s.cash);}
});
test('all render and weight helpers are pure, including repeated and high-risk cases',()=>{
 const s=state(),copy=structuredClone(s);for(const id of ONLINE_EVENT_IDS){const e=event(id);onlineStoryPresentation(s,e);onlineStoryChoices(s,e);}assert.deepEqual(s,copy);
});
test('first trial is one-time non-cash credit, while self-funded choices retain genuinely random gains and losses',()=>{
 const s=state();s.behavior.onlineGambling.status='EXPOSED';const c=resolved(s,'OG02','bonus');assert.equal(c.requirements.min_cash_yuan,0);assert.ok(c.outcomes.every(o=>!o.effects.some(e=>e.op==='spend')));assert.ok(c.outcomes.every(o=>o.onlineResolution.freeCredit===2000));
 const own=resolved(s,'OG02','small');assert.equal(own.requirements.min_cash_yuan,20);assert.deepEqual(own.outcomes.map(o=>o.onlineOutcome),['win','loss','big_win','zero','tie']);assert.ok(own.outcomes.find(o=>o.onlineOutcome==='big_win').weight<own.outcomes.find(o=>o.onlineOutcome==='win').weight);
 s.behavior.onlineGambling.bonusClaimed=true;assert.match(resolved(s,'OG02','bonus').onlineReason,/已经使用/);
 s.behavior.onlineGambling.bonusClaimed=false;s.behavior.onlineGambling.totalBets=1;assert.match(resolved(s,'OG02','bonus').onlineReason,/已经使用/);
});
test('every active outcome has cent-exact receipts and no loss exceeds the explicit stake',()=>{
 const s=state();s.cash=9876543;
 for(const id of ONLINE_EVENT_IDS)for(const c of onlineStoryChoices(s,event(id)))for(const o of c.outcomes){const r=o.onlineResolution;if(!r?.active)continue;assert.ok(Number.isSafeInteger(r.stake));assert.ok(Number.isSafeInteger(r.returned));assert.ok(r.net>=-r.stake);const spent=o.effects.filter(e=>e.op==='spend').reduce((n,e)=>n+Math.round(e.amount_yuan*100),0),received=o.effects.filter(e=>e.op==='earn').reduce((n,e)=>n+Math.round(e.amount_yuan*100),0);assert.equal(spent,r.stake);assert.equal(received,r.returned);const stress=o.effects.find(e=>e.op==='stat')?.delta?.stress;if(r.net>0)assert.ok(stress<0);if(r.net<0)assert.ok(stress>0);}
});
test('only explicit borrow choices create a loan, and a win leaves the loan outstanding',()=>{
 const s=state(),c=resolved(s,'OG19','borrow'),o=c.outcomes.find(o=>o.onlineOutcome==='win');assert.match(c.label,/借 100/);assert.equal(c.requirements.min_cash_yuan,0);assert.deepEqual(o.effects[0],{op:'loan',principal_yuan:100,apr_bps:0,term_months:3,purpose:'online_gambling'});assert.equal(o.effects[1].op,'spend');assert.match(o.text,/仍是债务/);
 for(const id of ONLINE_EVENT_IDS)for(const c of onlineStoryChoices(s,event(id)))if(c.onlineAction!=='borrow')assert.ok(c.outcomes.every(o=>!o.effects.some(e=>e.op==='loan')));
});
test('repetition and current wealth change last-bet and rounded-number copy without a redraw',()=>{
 const s=state();s.behavior.onlineGambling.eventCounts.OG08=4;assert.match(onlineStoryPresentation(s,event('OG08')).prompt,/真正的最后一把/);s.behavior.onlineGambling.eventCounts.OG08=9;assert.match(onlineStoryPresentation(s,event('OG08')).prompt,/最后一把？/);assert.match(resolved(s,'OG08','small').label,/嗯/);
 for(const [cash,target] of [[9700,'¥100'],[970000,'¥10,000'],[97000000,'¥1,000,000']]){s.cash=cash;assert.ok(onlineStoryPresentation(s,event('OG07')).title.includes(target));}
});
test('recovered memories never offer stakes; remembered marbles describe recorded childhood actions',()=>{
 const s=state();s.behavior.onlineGambling.status='RECOVERED';for(const id of ['OG26','OG27'])assert.ok(onlineStoryChoices(s,event(id)).every(c=>c.outcomes.every(o=>!o.onlineResolution.active)));
 s.studentStories={history:[{age:6,resource:'marbles',action:'allin',delta:-10,choice:'全部押上'}],traits:{allIn:30}};assert.match(onlineStoryPresentation(s,event('OG27')).prompt,/全摆上去/);
 delete s.studentStories;assert.match(onlineStoryPresentation(s,event('OG27')).prompt,/没有留下那一局的记录/);
});
test('ordinary relationship and career events add real tendency-gated choices with stable saved IDs',()=>{
 const s=state();for(const id of ['XIA01','ENC_JOB02']){const e=event(id),normal=onlineStoryChoices(s,e);assert.equal(normal.length,3);s.behavior.onlineGambling.tendencies.chasing=10;s.behavior.onlineGambling.tendencies.confidence=10;const special=onlineStoryChoices(s,e).filter(c=>c.onlineSpecial);assert.equal(special.length,2);assert.ok(special.every(c=>e.choices.some(original=>original.id===c.id)));s.behavior.onlineGambling.tendencies.chasing=0;s.behavior.onlineGambling.tendencies.confidence=0;}
});
test('payroll and promotion echoes never pay wages twice and housing text never invents a player rent deadline',()=>{
 const s=state();for(const id of ['OG10','OG17','OG24'])for(const c of onlineStoryChoices(s,event(id)))if(!c.outcomes[0].onlineResolution.active)assert.ok(c.outcomes.every(o=>!o.effects.some(x=>['earn','spend'].includes(x.op))));assert.ok(event('OG17').onlineGambling.requiredState.includes('payday'));assert.ok(event('OG24').onlineGambling.requiredState.includes('recentPromotion'));assert.match(onlineStoryPresentation(s,event('OG18')).prompt,/那三天是他的期限/);
});
test('ordinary special choices cannot bypass online cooldown or the intervening life-event requirement',()=>{
 const s=state(),g=s.behavior.onlineGambling;g.tendencies.chasing=15;g.lastEventDay=s.debtClock.day;g.ordinaryAtLastEvent=0;g.ordinaryEvents=0;
 assert.equal(onlineStoryChoices(s,event('ENC_JOB02')).length,3);
 s.debtClock.day+=90;assert.equal(onlineStoryChoices(s,event('ENC_JOB02')).length,3);
 g.ordinaryEvents=2;assert.equal(onlineStoryChoices(s,event('ENC_JOB02')).filter(c=>c.onlineSpecial).length,1);
});
test('a random betting resolution retains authored nonfinancial facts such as the missing guru',()=>{
 const c=resolved(state(),'OG13','chase');assert.ok(c.outcomes.every(o=>o.effects.some(x=>x.op==='flag'&&x.key==='online_guru_gone'&&x.value===true)));
});
test('teacher, model and borrowed-win copy refers to the actual strategy receipt, not an unrelated win',()=>{
 const s=state(),g=s.behavior.onlineGambling;
 g.history=[{kind:'bet',age:22,eventId:'OG11',action:'guru',stake:10000,returned:15000},{kind:'bet',age:23,eventId:'OG14',action:'model',stake:2000,returned:1000},{kind:'bet',age:24,eventId:'OG19',action:'borrow',borrowed:10000,stake:10000,returned:15000},{kind:'bet',age:24,eventId:'OG05',action:'small',stake:2000,returned:16800}];
 assert.deepEqual(event('OG12').onlineGambling.requiredState,['lastGuruWin']);assert.deepEqual(event('OG15').onlineGambling.requiredState,['lastModelWin']);assert.deepEqual(event('OG16').onlineGambling.requiredState,['lastModelLoss']);assert.deepEqual(event('OG20').onlineGambling.requiredState,['borrowedWin']);
 assert.match(onlineStoryPresentation(s,event('OG12')).prompt,/22 岁/);assert.match(onlineStoryPresentation(s,event('OG12')).prompt,/回款 ¥150/);assert.match(onlineStoryPresentation(s,event('OG16')).prompt,/回款 ¥10/);
 g.borrowDebtIds=['borrow-1'];s.debts=[{id:'borrow-1',principal:10000,interest:0}];assert.match(onlineStoryPresentation(s,event('OG20')).prompt,/借来的 ¥100/);assert.match(onlineStoryPresentation(s,event('OG20')).prompt,/还剩 ¥100/);
 s.debts=[];assert.match(onlineStoryPresentation(s,event('OG20')).prompt,/已经还清/);assert.deepEqual(byAction('OG20','repay').requirements.all,['debt_positive']);
});
test('first withdrawal is a retrospective receipt and never duplicates money already paid',()=>{
 const s=state();s.behavior.onlineGambling.memories.firstWin={age:18,amount:16800,day:0,eventId:'OG02',choice:'只用赠金'};
 const p=onlineStoryPresentation(s,event('OG03'));assert.match(p.title,/回看那笔到账/);assert.match(p.prompt,/当时就已经到账/);assert.match(p.prompt,/¥168/);
 const leave=resolved(s,'OG03','withdraw');assert.ok(leave.outcomes.every(o=>!o.effects.some(e=>e.op==='earn')));
});

test('recovered memories do not invent another missed exit opportunity',()=>{
 const s=state(),g=s.behavior.onlineGambling;g.status='RECOVERED';g.totalBets=4;g.exitOpportunities=5;
 const e=event('OG27'),c=onlineStoryChoices(s,e).find(c=>c.onlineAction==='remember')||onlineStoryChoices(s,e).find(c=>!c.outcomes[0].onlineResolution.active),n=structuredClone(s);
 recordOnlineStory(n,s,e,c,c.outcomes[0]);assert.equal(n.behavior.onlineGambling.exitOpportunities,5);
});
