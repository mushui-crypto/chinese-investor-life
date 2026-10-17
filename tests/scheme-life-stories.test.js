import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createState,applyEffects,PRODUCTS} from '../src/game/core.js';
import {schemeStoryPresentation,schemeStoryChoice,schemeStoryChoices,recordSchemeStory,SCHEME_LIFE_EVENT_IDS} from '../src/game/scheme-life-stories.js';
import {schemeLifeState,ensureSchemeLife,schemeEventAllowed,recordSchemeInterlude,recordSchemeTrade} from '../src/game/scheme-life.js';
import {ensureCryptoLife,cryptoLifeState} from '../src/game/crypto-life.js';
const events=JSON.parse(fs.readFileSync(new URL('../data/events.json',import.meta.url))).events;
const families=JSON.parse(fs.readFileSync(new URL('../data/families.json',import.meta.url)));
const event=id=>events.find(e=>e.id===id);
function adult(seed='scheme-story'){
 const s=createState({seed,family:families.find(f=>f.id==='F08')});Object.assign(s,{age:28,turn:20,phase:'planning',cash:1000000,familyReserve:1000000,monthlyIncome:300000,giftReceived:true});
 s.flags.living_parent=true;s.flags.crypto_aware=true;s.flags.ponzi_exposed=true;s.marketProgress={firstExperienceAge:18,simulations:0,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};ensureCryptoLife(s);ensureSchemeLife(s);return s;
}
function choice(s,id,action,index=0){return schemeStoryChoices(s,event(id)).filter(c=>c.schemeAction===action)[index];}
function choose(s,id,action,index=0,variant){const c=choice(s,id,action,index);assert.ok(c,`${id}/${action}`);assert.equal(c.schemeReason,'',c.schemeReason);const o=variant?c.outcomes.find(o=>o.schemeOutcome===variant):c.outcomes[0];assert.ok(o);const r=applyEffects(s,o.effects);assert.equal(r.result.error,undefined,r.result.error);recordSchemeStory(r.state,s,event(id),c,o);return r.state;}
function clock(s,days){const next=structuredClone(s);next.debtClock.day+=days;next.age+=days/360;for(let i=0;i<2;i++)recordSchemeInterlude(next);const r=applyEffects(next,[]);assert.equal(r.result.error,undefined,r.result.error);return r.state;}
function joined(seed){let s=choose(adult(seed),'CL22','curious');s=clock(s,90);return choose(s,'CL23','join');}
const position=s=>s.positions.find(p=>p.schemeLife);
function stage(s,name){const n=structuredClone(s),p=position(n);p.cryptoScheme.stage=name;p.cryptoScheme.status=['maintenance','silent','missing','balance'].includes(name)?'frozen':['delay','rumor','slow'].includes(name)?'warning':'mature';if(p.cryptoScheme.status==='frozen'){p.frozen=true;p.value=0;}recordSchemeTrade(n,p,{action:'status',stage:name,cashFlow:0,pnl:0});return n;}

test('35 asynchronous scheme nodes cover ordinary life, preserve free exits, and never schedule a followup',()=>{
 assert.equal(SCHEME_LIFE_EVENT_IDS.length,35);assert.equal(events.filter(e=>e.schemeLife).length,35);
 for(const id of SCHEME_LIFE_EVENT_IDS){const e=event(id);assert.ok(e.cryptoLife);assert.equal(e.age_min,24);for(const k of ['requiredState','blockedState','weight','cooldown','minDelay','ageStage','memoryTrigger','repeatable'])assert.ok(Object.hasOwn(e.schemeLife,k),`${id}/${k}`);for(const c of e.choices)for(const o of c.outcomes){assert.deepEqual(o.schedule,[]);assert.ok(o.effects.every(x=>!['earn','spend','loan','venture'].includes(x.op)));}const s=adult();s.cash=0;s.familyReserve=0;assert.ok(schemeStoryChoices(s,e).some(c=>!c.schemeReason&&c.requirements.min_cash_yuan===0),id);}
 assert.deepEqual(event('CL31').choices.map(c=>c.label),['知道了。']);assert.ok(event('SL12').choices.every(c=>!['join','add','family_join'].includes(c.schemeAction)));
});
test('every first introduction answer creates only project exposure and does not alter Crypto counters',()=>{
 for(const c of event('CL22').choices){let s=adult(),before=structuredClone(s);s=choose(s,'CL22',c.schemeAction);const g=schemeLifeState(s);assert.equal(g.exposed,true);assert.equal(Object.values(g.projects).length,1);assert.equal(s.cash,before.cash);assert.deepEqual(s.positions,[]);assert.equal(cryptoLifeState(s).totalTrades,0);assert.deepEqual(cryptoLifeState(s).eventCounts,before.behavior.cryptoLife.eventCounts);assert.equal(g.projects[g.currentProjectKey].invested,0);}
});
test('presentation and choice previews do not draw, initialize or mutate state',()=>{
 const s=clock(joined(),90),before=structuredClone(s);for(let pass=0;pass<2;pass++)for(const id of SCHEME_LIFE_EVENT_IDS){schemeStoryPresentation(s,event(id));schemeStoryChoices(s,event(id));}assert.deepEqual(s,before);
});
test('small trial charges only explicitly confirmed cents and refuses insufficient real cash',()=>{
 let s=choose(adult(),'CL22','curious');const c=choice(s,'CL23','join');assert.equal(c.outcomes[0].effects[0].amount,10000);assert.equal(c.outcomes[0].effects[0].schemeLife,true);assert.match(c.planHint,/现金支出 ¥100，手续费 ¥0/);const before=s.cash;s=choose(s,'CL23','join');assert.equal(s.cash,before-10000);assert.equal(position(s).cost,10000);assert.equal(schemeLifeState(s).projects[position(s).projectKey].paid,0);
 const poor=adult();poor.cash=9999;assert.match(choice(poor,'CL23','join').schemeReason,/现金不足/);assert.equal(choice(poor,'CL23','refuse').schemeReason,'');
});
test('actual first and second payouts are described by project and never paid again by story text',()=>{
 let s=clock(joined(),60),p=position(s),cash=s.cash,row=schemeLifeState(s).projects[p.projectKey];assert.equal(row.paymentCount,2);const text=schemeStoryPresentation(s,event('CL24')).prompt;assert.match(text,/真实收益到账 ¥2.5/);assert.match(text,/累计实际到账 ¥5/);s=choose(s,'CL24','continue');assert.equal(s.cash,cash);assert.equal(schemeLifeState(s).projects[p.projectKey].paymentCount,2);
});
test('partial withdrawal and principal-first choices use exact finance quotes and retained profit remains noncash',()=>{
 let s=clock(joined(),90);s=choose(s,'SL24','retain');const cash=s.cash;s=clock(s,90);assert.equal(s.cash,cash);assert.ok(position(s).cryptoScheme.retainedProfit>0);const c=choice(s,'SL24','principal');assert.match(c.planHint,/提现 ¥100/);s=choose(s,'SL24','principal');assert.equal(s.cash,cash+10000);assert.equal(position(s).cost,0);assert.ok(position(s).value>0);const text=schemeStoryPresentation(s,event('SL24')).prompt;assert.match(text,/未退个人本金 ¥0/);
});
test('every visible warning acknowledges only its own project and a real exit bypasses acknowledgement',()=>{
 const mapping={CL28:'delay',SL07:'recovered',SL08:'rumor',SL09:'slow',SL10:'last_payment',CL29:'maintenance',CL30:'silent',SL11:'missing',SL12:'balance'};
 for(const [id,name] of Object.entries(mapping)){const s=stage(clock(joined(),90),name),key=position(s).projectKey;for(const c of schemeStoryChoices(s,event(id))){const effects=c.outcomes[0].effects.filter(e=>e.op==='crypto_life');assert.ok(effects.every(e=>e.projectKey===key),id);if(c.schemeAction==='withdraw')assert.ok(!effects.some(e=>e.action==='scheme_ack'));else assert.ok(effects.some(e=>e.action==='scheme_ack'&&e.stage===name),`${id}/${c.id}`);}}
 let s=stage(clock(joined(),90),'delay'),before=s.cash;s=choose(s,'CL28','withdraw');assert.equal(s.cash,before+10000);assert.equal(s.positions.length,0);assert.ok(schemeLifeState(s).memories.schemeQuit);
});
test('waiting for one more payment records the intention without pretending the principal left',()=>{
 let s=stage(clock(joined(),90),'slow'),cash=s.cash;s=choose(s,'SL09','wait_payment');assert.equal(s.cash,cash);assert.equal(position(s).cost,10000);assert.equal(position(s).cryptoScheme.preparedExit,true);assert.equal(position(s).cryptoScheme.seenStages.slow,true);assert.ok(schemeLifeState(s).memories.firstExitThought);
});
test('family participation debits only explicitly stated real reserve, has an independent exit, and cannot invent money',()=>{
 let s=clock(joined(),90),cash=s.cash,reserve=s.familyReserve;const c=choice(s,'SL06','family_join');assert.match(c.label,/1,000 元/);assert.match(c.planHint,/家庭储备投入 ¥1,000/);s=choose(s,'SL06','family_join');assert.equal(s.cash,cash);assert.equal(s.familyReserve,reserve-100000);assert.equal(schemeLifeState(s).projects[position(s).projectKey].familyInvested,100000);
 s=clock(s,90);const current=s.familyReserve;s=choose(s,'SL06','family_withdraw');assert.equal(s.familyReserve,current+100000);assert.equal(s.cash,cash+750);
 const poor=clock(joined(),90);poor.familyReserve=99999;assert.match(choice(poor,'SL06','family_join').schemeReason,/家庭储备不足/);assert.equal(choice(poor,'SL06','boundary').schemeReason,'');
});
test('friend participation and introducer outcomes are locked variants without player financial transfers',()=>{
 const s=clock(joined(),90),cash=s.cash,c=choice(s,'CL27','friend_info');assert.deepEqual(c.outcomes.map(o=>o.schemeOutcome),['friend_joined','friend_declined']);assert.equal(c.outcomes[0].id,'CL27_4_quiet');const joinedFriend=choose(s,'CL27','friend_info',0,'friend_joined');assert.equal(joinedFriend.cash,cash);assert.equal(schemeLifeState(joinedFriend).projects[position(joinedFriend).projectKey].friendJoined,true);
 for(const v of ['friend_victim','friend_escaped','friend_missing']){const next=choose(stage(s,'missing'),'SL11','contact',0,v);assert.equal(next.cash,cash);assert.equal(schemeLifeState(next).projects[position(next).projectKey].relationships.introducer,{friend_victim:'victim',friend_escaped:'escaped',friend_missing:'missing'}[v]);}
});
test('permanent refusal blocks new risk but leaves old account and family consequences readable',()=>{
 let s=clock(joined(),90),cash=s.cash;s=choose(s,'SL19','permanent_refuse');assert.equal(s.cash,cash);assert.equal(schemeLifeState(s).forbidRisk,true);assert.match(choice(s,'CL26','add').schemeReason,/永久拒绝/);assert.equal(choice(s,'CL26','withdraw').schemeReason,'');for(const id of ['CL31','CL42','SL13','SL14','SL20'])assert.deepEqual(event(id).schemeLife.blockedState,[]);
 s=clock(s,1800);assert.equal(schemeEventAllowed(s,event('CL28')),true);cash=s.cash;s=choose(s,'CL28','wait');assert.equal(s.cash,cash);assert.equal(position(s).cryptoScheme.seenStages.delay,true);assert.match(choice(stage(s,'last_payment'),'SL10','add').schemeReason,/永久拒绝/);
});
test('ordinary life scheme options require real history and at least two independent interludes',()=>{
 let s=adult();assert.equal(schemeStoryChoices(s,event('ENC_JOB03')).some(c=>c.schemeAction),false);s=clock(joined(),450);const g=schemeLifeState(s),p=g.projects[g.currentProjectKey];p.trust=40;g.trust=40;assert.equal(schemeEventAllowed(s,event('CL25')),true);assert.equal(schemeStoryChoices(s,event('ENC_JOB03')).some(c=>c.schemeAction),true);s=choose(s,'CL25','continue');assert.equal(schemeStoryChoices(s,event('ENC_JOB03')).some(c=>c.schemeAction),false);
});
test('a later project changes its name and introducer without inheriting old receipts or forcing reentry',()=>{
 let s=clock(joined('scheme-new-cycle'),1800);s=choose(s,'CL28','trust');const oldKey=position(s).projectKey,oldName=position(s).name;
 for(let i=0;i<20&&position(s);i++){const p=position(s),r=applyEffects(s,[{op:'crypto_life',schemeLife:true,action:'scheme_ack',projectKey:p.projectKey,stage:p.cryptoScheme.stage}]);assert.equal(r.result.error,undefined);s=clock(r.state,90);}
 assert.equal(s.positions.length,0);assert.ok(schemeLifeState(s).projects[oldKey].collapsedDay!==null);s=clock(s,720);const old=structuredClone(schemeLifeState(s).projects[oldKey]),cash=s.cash;
 assert.equal(schemeEventAllowed(s,event('SL21')),true);const shown=schemeStoryPresentation(s,event('SL21'));assert.match(shown.prompt,/晴禾协作/);assert.match(shown.prompt,new RegExp(oldName));s=choose(s,'SL21','next_project');let g=schemeLifeState(s),fresh=g.projects[g.currentProjectKey];assert.notEqual(fresh.key,oldKey);assert.equal(fresh.source,'colleague');assert.equal(fresh.paid,0);assert.equal(fresh.returned,0);assert.equal(fresh.invested,0);assert.equal(s.cash,cash);assert.equal(g.projects[oldKey].paid,old.paid);assert.equal(g.projects[oldKey].eventCounts.SL21,1);
 s=clock(s,90);s=choose(s,'CL23','join');g=schemeLifeState(s);fresh=g.projects[g.currentProjectKey];assert.equal(fresh.initialPrincipal,10000);assert.equal(fresh.paymentCount,0);assert.equal(fresh.name,'晴禾协作');assert.equal(g.relapseCount,1);assert.equal(g.projects[oldKey].returned,old.returned);
});
