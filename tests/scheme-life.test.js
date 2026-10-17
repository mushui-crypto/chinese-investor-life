import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newSchemeLife,schemeLifeState,ensureSchemeLife,advanceSchemeLife,recordSchemeTrade,recordSchemeEvent,recordSchemeInterlude,schemeEventAllowed,schemeEventWeight,schemeEventProject,schemeLifeSummary,validateSchemeLife,SCHEME_ACHIEVEMENTS,SCHEME_ENDINGS} from '../src/game/scheme-life.js';
import {renderSchemeLifeLedger,schemeLifeText} from '../src/ui/scheme-life-ledger.js';
const player=()=>({age:30,debtClock:{day:10000,periodDays:0},behavior:{cryptoLife:{}},cash:100000000,familyReserve:100000000,positions:[],claims:[],businesses:[],debts:[],flags:{living_parent:true},trading:{},monthlyIncome:500000});
const now=s=>s.debtClock.day;
const event=(id,requiredState=[],extra={})=>({id,weight:20,schemeLife:{requiredState,blockedState:[],ageStage:[24,80],minDelay:90,cooldown:180,repeatable:true,...extra}});
function open(s,key='a',amount=100000){const p={id:key,projectKey:key,schemeLife:true,cryptoLifeBranch:'scheme',name:'虚构项目 '+key,cost:amount,value:amount,bookBalance:amount,cryptoScheme:{projectKey:key,historyKnown:true,status:'paying',stage:'normal',paymentCount:0,paid:0,retainedProfit:0,principalReturned:0,lastPageBalance:amount,introducer:'friend'}};s.cash-=amount;s.positions.push(p);recordSchemeTrade(s,p,{action:'buy',cashFlow:-amount,pnl:0});return p;}
function pay(s,p,n=2500,stage='normal'){s.cash+=n;p.cryptoScheme.paymentCount++;p.cryptoScheme.paid+=n;p.cryptoScheme.stage=stage;recordSchemeTrade(s,p,{action:'payment',cashFlow:n,pnl:n,stage});}
function status(s,p,stage){p.cryptoScheme.stage=stage;recordSchemeTrade(s,p,{action:'status',cashFlow:0,pnl:0,stage});}
function exit(s,p){const cost=p.cost,value=p.value;s.positions=s.positions.filter(x=>x!==p);s.cash+=value;p.cryptoScheme.principalReturned+=cost;p.value=p.cost=p.bookBalance=p.cryptoScheme.lastPageBalance=0;recordSchemeTrade(s,p,{action:'withdraw',cashFlow:value,pnl:value-cost,principalReturned:p.cryptoScheme.principalReturned});}
function collapse(s,p){s.positions=s.positions.filter(x=>x!==p);recordSchemeTrade(s,p,{action:'scheme_failure',cashFlow:0,pnl:-p.cost,schemeFailure:true,lastPageBalance:p.bookBalance});}
function choice(s,p,action,extra={}){return recordSchemeEvent(s,{eventId:'S-'+action+'-'+now(s),projectKey:p.projectKey,action,choice:'你选择：'+action,...extra});}
const ending=(s,key)=>schemeLifeSummary(s).projects.find(p=>p.key===key)?.ending?.id;

test('read-only selectors and legacy migration do not fabricate first receipts, dates, money or RNG',()=>{
 const s=player();s.rng=123;s.positions=[{id:'old',name:'旧长灯',cryptoLifeBranch:'scheme',cost:12300,value:12300,bookBalance:12300,cryptoScheme:{status:'mature',paymentCount:8,paid:2460}}];const original=structuredClone(s);
 schemeLifeState(s);schemeLifeSummary(s);schemeEventAllowed(s,event('intro'));schemeEventWeight(s,event('intro'));assert.deepEqual(s,original);
 const g=ensureSchemeLife(s),p=g.projects.old;assert.equal(p.legacyImported,true);assert.equal(p.invested,0);assert.equal(p.joinedDay,null);assert.equal(p.memories.firstScheme,null);assert.equal(p.memories.firstSchemePayment,null);assert.equal(p.observedPaymentCount,8);for(const k of ['cash','positions','rng'])assert.deepEqual(s[k],original[k]);validateSchemeLife(s);
});
test('fresh buys and all payments stay within their project; a later project cannot inherit eligibility',()=>{
 const s=player(),a=open(s,'a');pay(s,a);pay(s,a);status(s,a,'delay');const b=open(s,'b');const g=schemeLifeState(s);assert.equal(g.projects.a.legacyImported,false);assert.equal(g.projects.b.paymentCount,0);assert.equal(g.projects.b.memories.firstSchemeWarning,null);assert.equal(schemeEventProject(s,event('paid',['paidTwice'])).key,'a');assert.equal(schemeEventProject(s,event('warn',['delay'])).key,'a');assert.equal(schemeEventProject(s,event('b-paid',['paidTwice'],{projectKey:'b'})).key,'b');assert.equal(schemeEventAllowed(s,event('b-paid',['paidTwice'],{projectKey:'b'})),false);assert.equal(g.projects.a.paid,5000);assert.equal(g.projects.b.paid,0);validateSchemeLife(s);
});
test('scheme cooling uses its own 90 days and two other events, including Crypto or online stories',()=>{
 const s=player();recordSchemeEvent(s,{eventId:'intro',projectKey:'a',action:'expose',exposure:true});const next=event('try',['exposed','neverJoined']);assert.equal(schemeEventAllowed(s,next),false);s.debtClock.day+=90;recordSchemeInterlude(s);assert.equal(schemeEventAllowed(s,next),false);recordSchemeInterlude(s);assert.equal(schemeEventAllowed(s,next),true);assert.equal(s.behavior.cryptoLife.onlineGambling,undefined);const before=structuredClone(s);schemeEventAllowed(s,next);schemeEventWeight(s,next);assert.deepEqual(s,before);
 recordSchemeEvent(s,{eventId:'try',projectKey:'a',action:'inspect'});s.debtClock.day+=179;recordSchemeInterlude(s);recordSchemeInterlude(s);assert.equal(schemeEventAllowed(s,next),false);s.debtClock.day++;assert.equal(schemeEventAllowed(s,next),true);validateSchemeLife(s);
});
test('a missing qualifying project cannot borrow global exposure for a repeated introduction',()=>{
 const s=player(),intro=event('first',[],{stage:'intro',blockedState:['exposed']}),trial=event('trial',['exposed','neverJoined'],{stage:'intro'}),repeat=event('repeat',['exposed','neverJoined'],{stage:'intro',newProject:true});
 assert.equal(schemeEventAllowed(s,intro),true);assert.equal(schemeEventAllowed(s,trial),false);assert.equal(schemeEventAllowed(s,event('missing',[],{projectKey:'absent'})),false);
 recordSchemeEvent(s,{eventId:'first',projectKey:'a',action:'refuse',exposure:true});s.debtClock.day+=180;recordSchemeInterlude(s);recordSchemeInterlude(s);assert.equal(schemeEventAllowed(s,intro),false);assert.equal(schemeEventAllowed(s,trial),true);assert.equal(schemeEventAllowed(s,repeat),true);
 open(s,'a');const before=structuredClone(s);assert.equal(schemeEventProject(s,trial),null);assert.equal(schemeEventAllowed(s,trial),false);assert.equal(schemeEventAllowed(s,repeat),false);assert.equal(schemeEventWeight(s,trial),0);assert.deepEqual(s,before);
});
test('refusals reduce weights without permanent closure; a permanent refusal blocks all new projects',()=>{
 const s=player();recordSchemeEvent(s,{eventId:'intro',projectKey:'a',action:'expose',exposure:true});s.debtClock.day+=180;recordSchemeInterlude(s);recordSchemeInterlude(s);const e=event('try',['exposed']);const before=schemeEventWeight(s,e);recordSchemeEvent(s,{eventId:'no',projectKey:'a',action:'refuse'});s.debtClock.day+=180;recordSchemeInterlude(s);recordSchemeInterlude(s);assert.ok(schemeEventWeight(s,e)>0&&schemeEventWeight(s,e)<before);recordSchemeEvent(s,{eventId:'never',projectKey:'a',action:'permanent_refuse'});s.debtClock.day+=720;recordSchemeInterlude(s);recordSchemeInterlude(s);assert.equal(schemeLifeState(s).forbidRisk,true);assert.equal(schemeEventAllowed(s,e),false);assert.equal(schemeEventAllowed(s,event('memory',[],{memoryOnly:true})),true);assert.equal(schemeLifeState(s).projects.a.invested,0);validateSchemeLife(s);
});
test('parent scenes use the household source of truth while family savings use actual reserve',()=>{
 const s=player(),parent=event('parent',['parentsAvailable']),savings=event('savings',['familySavings']);s.household={livingParent:false};s.flags.living_parent=true;const before=structuredClone(s);assert.equal(schemeEventAllowed(s,parent),false);assert.equal(schemeEventAllowed(s,savings),true);assert.deepEqual(s,before);
 s.household.livingParent=true;s.flags.living_parent=false;s.familyReserve=0;assert.equal(schemeEventAllowed(s,parent),true);assert.equal(schemeEventAllowed(s,savings),false);
 delete s.household;s.flags.living_parent=true;assert.equal(schemeEventAllowed(s,parent),true);delete s.flags.living_parent;assert.equal(schemeEventAllowed(s,parent),false);
});
test('only an actual complete personal withdrawal starts the 180-day branch cooldown across projects',()=>{
 const s=player(),a=open(s,'a'),b=open(s,'b');pay(s,b);choice(s,a,'prepare_exit');const g=schemeLifeState(s);assert.equal(g.cooldownUntil,0);
 a.cost-=20000;a.value-=20000;a.bookBalance-=20000;a.cryptoScheme.lastPageBalance=a.bookBalance;a.cryptoScheme.principalReturned=20000;s.cash+=20000;recordSchemeTrade(s,a,{action:'withdraw',cashFlow:20000,pnl:0,principalReturned:20000});assert.equal(g.cooldownUntil,0);assert.equal(g.projects.a.quitDay,null);
 const beforeB=structuredClone(g.projects.b),cash=s.cash;exit(s,a);assert.equal(s.cash-cash,80000);assert.equal(g.projects.a.status,'QUIT_SCHEME');assert.equal(g.projects.a.quitDay,now(s));assert.equal(g.cooldownUntil,now(s)+180);assert.deepEqual(g.projects.b,beforeB);
 recordSchemeInterlude(s);recordSchemeInterlude(s);s.debtClock.day+=179;const e=event('b-memory',['hasPosition','firstPaid'],{projectKey:'b'});assert.equal(schemeEventAllowed(s,e),false);s.debtClock.day++;assert.equal(schemeEventAllowed(s,e),true);validateSchemeLife(s);
});
test('permanent refusal survives full withdrawal and a later project identity while old exits remain recordable',()=>{
 const s=player(),p=open(s);choice(s,p,'permanent_refuse');const g=schemeLifeState(s),cash=s.cash;exit(s,p);assert.equal(s.cash-cash,100000);assert.equal(g.forbidRisk,true);assert.equal(g.status,'FORBID_RISK');s.debtClock.day+=720;recordSchemeInterlude(s);recordSchemeInterlude(s);recordSchemeEvent(s,{eventId:'later-memory',projectKey:'b',action:'remember'});assert.equal(g.forbidRisk,true);assert.equal(g.projects.b.invested,0);assert.equal(schemeEventAllowed(s,event('new-risk',[],{projectKey:'b'})),false);
 const balances=structuredClone({cash:s.cash,familyReserve:s.familyReserve,positions:s.positions});assert.throws(()=>recordSchemeTrade(s,{id:'b',schemeLife:true,projectKey:'b',cryptoLifeBranch:'scheme',cost:10000,value:10000},{action:'buy',cashFlow:-10000,pnl:0}),/永久拒绝/);assert.deepEqual({cash:s.cash,familyReserve:s.familyReserve,positions:s.positions},balances);validateSchemeLife(s);
});
test('permanent refusal preserves authored warning eligibility for existing personal and family exposure',()=>{
 const events=JSON.parse(readFileSync(new URL('../data/events.json',import.meta.url))).events,s=player(),p=open(s);choice(s,p,'permanent_refuse');s.debtClock.day+=180;recordSchemeInterlude(s);recordSchemeInterlude(s);
 const stages={CL28:'delay',SL07:'recovered',SL08:'rumor',SL09:'slow',SL10:'last_payment',CL29:'maintenance',CL30:'silent',SL11:'missing',SL12:'balance'};
 for(const [id,stage] of Object.entries(stages)){status(s,p,stage);const e=events.find(e=>e.id===id);assert.equal(schemeEventAllowed(s,e),true,id);assert.ok(schemeEventWeight(s,e)>0,id);}
 assert.equal(schemeEventAllowed(s,events.find(e=>e.id==='CL23')),false);p.cryptoScheme.familyPrincipal=50000;p.cryptoScheme.familyValue=50000;exit(s,p);s.trading.schemeFamilyProjects=[{...p,schemeFamilyOnly:true}];advanceSchemeLife(s);s.debtClock.day+=180;status(s,s.trading.schemeFamilyProjects[0],'delay');assert.equal(schemeEventAllowed(s,events.find(e=>e.id==='CL28')),true);assert.equal(schemeLifeState(s).forbidRisk,true);
});
test('catch-up receipts retain actual payment days while accrual is not cash income',()=>{
 const s=player(),p=open(s);s.debtClock.day+=360;recordSchemeTrade(s,p,{action:'payment',cashFlow:2500,pnl:2500,lifeDay:10030});assert.equal(schemeLifeState(s).projects.a.memories.firstSchemePayment.day,10030);p.bookBalance+=10000;p.value+=10000;p.cryptoScheme.lastPageBalance=p.bookBalance;recordSchemeTrade(s,p,{action:'accrual',cashFlow:0,pnl:0,bookBalance:p.bookBalance});const g=schemeLifeState(s);assert.equal(g.projects.a.returned,2500);assert.equal(g.projects.a.paymentCount,1);assert.equal(g.projects.a.realizedProfit,2500);assert.equal(g.peakBookBalance,110000);validateSchemeLife(s);
});
test('normal-stage stories stop at warnings and bonuses use the real employment receipt shape',()=>{
 const s=player(),p=open(s);pay(s,p);const normal=event('paid',['hasPosition','firstPaid'],{stage:'normal'});assert.equal(schemeEventAllowed(s,normal),true);status(s,p,'delay');assert.equal(schemeEventAllowed(s,normal),false);const bonus=event('bonus',['lifeBonus']);assert.equal(schemeEventAllowed(s,bonus),false);s.employment={history:[{kind:'bonus',day:now(s)-20,amount:100000}]};assert.equal(schemeEventAllowed(s,bonus),true);s.employment.history[0].day=now(s)+1;assert.equal(schemeEventAllowed(s,bonus),false);
});
test('one recovery episode with several payments counts once, and twelve interrupted payments are not a normal streak',()=>{
 const s=player(),p=open(s);for(let i=0;i<6;i++)pay(s,p);status(s,p,'delay');pay(s,p,2500,'recovered');s.debtClock.day+=30;pay(s,p,2500,'recovered');assert.equal(schemeLifeState(s).projects.a.recoveryCount,1);status(s,p,'normal');for(let i=0;i<6;i++)pay(s,p);collapse(s,p);assert.equal(schemeLifeState(s).projects.a.paymentCount,14);assert.equal(schemeLifeState(s).achievements.stable_income,undefined);validateSchemeLife(s);
});
test('recovered payment only becomes the last-payment achievement after a prior exit intent and a chosen continuation',()=>{
 const s=player(),p=open(s);status(s,p,'delay');pay(s,p,2500,'recovered');choice(s,p,'continue');assert.equal(schemeLifeState(s).achievements.last_payment,undefined);choice(s,p,'prepare_exit');s.debtClock.day++;pay(s,p,2500,'last_payment');assert.equal(schemeLifeState(s).achievements.last_payment,undefined);choice(s,p,'continue');assert.ok(schemeLifeState(s).projects.a.achievements.last_payment);collapse(s,p);assert.equal(ending(s,'a'),'last_payment');validateSchemeLife(s);
});
test('all six exit endings require their distinct real exposure, payments or withdrawal evidence',()=>{
 let s=player();recordSchemeEvent(s,{eventId:'no',projectKey:'a',action:'refuse',exposure:true});assert.equal(ending(s,'a'),'never_joined');
 s=player();let p=open(s);pay(s,p);exit(s,p);assert.equal(ending(s,'a'),'meal_money');
 s=player();p=open(s);pay(s,p,100000);exit(s,p);assert.equal(ending(s,'a'),'principal_first');
 s=player();p=open(s);status(s,p,'delay');exit(s,p);assert.notEqual(ending(s,'a'),'escaped');recordSchemeTrade(s,p,{action:'scheme_failure_news',cashFlow:0,pnl:0,schemeFailureNews:true});assert.equal(ending(s,'a'),'escaped');
 s=player();p=open(s);status(s,p,'delay');pay(s,p,2500,'recovered');exit(s,p);assert.equal(ending(s,'a'),'second_time');
 s=player();p=open(s,'a',1000000);exit(s,p);assert.equal(ending(s,'a'),'successful_exit');assert.equal(SCHEME_ENDINGS.filter(e=>e.kind==='exit').length,6);validateSchemeLife(s);
});
test('all six failure endings follow actual project-specific loss, relationships or permanent refusal',()=>{
 let s=player(),p=open(s);for(let i=0;i<12;i++)pay(s,p);p.cost+=100000;p.value+=100000;p.bookBalance+=100000;recordSchemeTrade(s,p,{action:'add',cashFlow:-100000,pnl:0,bookBalance:p.bookBalance});collapse(s,p);assert.equal(ending(s,'a'),'stable_income');
 s=player();p=open(s,'a',1000000);p.bookBalance=p.value=100000000;recordSchemeTrade(s,p,{action:'accrual',cashFlow:0,pnl:0,bookBalance:p.bookBalance});collapse(s,p);assert.equal(ending(s,'a'),'profits_not_cash');
 s=player();p=open(s);p.cryptoScheme.familyPrincipal=50000;p.cryptoScheme.familyValue=50000;recordSchemeTrade(s,p,{family:true,action:'family_buy',cashFlow:-50000,pnl:0});p.cryptoScheme.familyPrincipal=p.cryptoScheme.familyValue=0;recordSchemeTrade(s,p,{family:true,action:'family_failure',cashFlow:0,pnl:-50000});collapse(s,p);assert.equal(ending(s,'a'),'whole_family');
 s=player();p=open(s);choice(s,p,'friend_join');collapse(s,p);assert.equal(ending(s,'a'),'introduced_friend');
 s=player();p=open(s);choice(s,p,'prepare_exit');pay(s,p,2500,'last_payment');choice(s,p,'continue');collapse(s,p);assert.equal(ending(s,'a'),'last_payment');
 s=player();p=open(s);collapse(s,p);choice(s,p,'permanent_refuse');assert.equal(ending(s,'a'),'graduated');assert.equal(SCHEME_ENDINGS.filter(e=>e.kind==='failure').length,6);validateSchemeLife(s);
});
test('the nine achievements use real receipts and selected memories rather than cross-project totals',()=>{
 const s=player(),p=open(s,'a',1000000);for(let i=0;i<12;i++)pay(s,p);choice(s,p,'friend_certified');choice(s,p,'prepare_exit');pay(s,p,2500,'recovered');choice(s,p,'continue');
 for(let i=0;i<3;i++){status(s,p,'maintenance');status(s,p,'recovered');}p.frozen=true;p.value=0;status(s,p,'maintenance');s.debtClock.day+=720;advanceSchemeLife(s);p.bookBalance=100000000;p.cryptoScheme.lastPageBalance=p.bookBalance;recordSchemeTrade(s,p,{action:'accrual',cashFlow:0,pnl:0,bookBalance:p.bookBalance});choice(s,p,'screenshot',{missingRoles:['introducer','admin','host']});collapse(s,p);const b=open(s,'b');const g=schemeLifeState(s);assert.equal(g.relapseCount,1);for(const a of SCHEME_ACHIEVEMENTS)assert.ok(g.achievements[a.id],a.id);assert.equal(g.projects.b.achievements.stable_income,undefined);assert.equal(SCHEME_ACHIEVEMENTS.length,9);validateSchemeLife(s);
});
test('family cash flows and a family-only carrier remain separate from the player ledger',()=>{
 const s=player(),p=open(s);p.cryptoScheme.familyPrincipal=50000;p.cryptoScheme.familyValue=50000;const cash=s.cash;recordSchemeTrade(s,p,{family:true,action:'family_buy',cashFlow:-50000,pnl:0});recordSchemeTrade(s,p,{family:true,action:'family_payment',cashFlow:1250,pnl:1250});exit(s,p);s.trading.schemeFamilyProjects=[{...p,cost:0,value:0,bookBalance:0}];advanceSchemeLife(s);const a=schemeLifeSummary(s),pr=a.projects[0];assert.equal(a.totals.invested,100000);assert.equal(a.totals.returned,100000);assert.equal(a.totals.realizedProfit,0);assert.equal(a.totals.familyInvested,50000);assert.equal(a.totals.familyReturned,1250);assert.equal(pr.currentValue,0);assert.equal(pr.familyCurrentValue,50000);assert.equal(a.activeProjects.length,1);assert.equal(s.cash,cash+100000);validateSchemeLife(s);
});
test('project peaks are not added across unrelated years and observed claims cannot create a new trade',()=>{
 const s=player(),p=open(s,'a',100000);exit(s,p);const b=open(s,'b',200000);assert.equal(schemeLifeSummary(s).totals.peakBookBalance,200000);collapse(s,b);const old=schemeLifeState(s).projects.b;recordSchemeTrade(s,{id:'claim-b',schemeLife:true,projectKey:'b',cryptoLifeBranch:'scheme',cost:0,value:0},{action:'recovery',cashFlow:100000,pnl:100000});assert.equal(old.returned,100000);assert.equal(old.realizedProfit,-100000);assert.equal(old.paymentCount,0);assert.equal(old.status,'COLLAPSED');validateSchemeLife(s);
});
test('validation rejects malformed nested dates, relationships, receipt maps and cross-project memories',()=>{
 const s=player(),p=open(s);pay(s,p);open(s,'b');validateSchemeLife(s);
 for(const mutate of [g=>g.projects.a.memories.firstScheme.day=now(s)+1,g=>g.projects.a.relationships.family='invented',g=>g.projects.a.eventCounts.x=1,g=>g.projects.a.receiptIds=['x','x'],g=>g.projects.a.familyInvested=-1,g=>g.projects.b.memories.firstScheme=g.projects.a.memories.firstScheme,g=>g.forbidRisk='true']){const bad=structuredClone(s);mutate(schemeLifeState(bad));assert.throws(()=>validateSchemeLife(bad),/项目人生记忆/);}
});
test('project recap escapes names and choices and labels household funds separately',()=>{
 const s=player(),p=open(s);p.name='<script>alert(1)</script>';recordSchemeEvent(s,{eventId:'recap',projectKey:'a',action:'prepare_exit',choice:'<img onerror=bad>'});recordSchemeTrade(s,p,{action:'status',cashFlow:0,pnl:0});const pr=schemeLifeState(s).projects.a;pr.name=p.name;pr.familyJoined=true;const money=n=>'¥'+(n/100).toFixed(2),html=renderSchemeLifeLedger(s,{money},true),text=schemeLifeText(s,money);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;img onerror=bad&gt;'));assert.match(html,/家人自己的账|家庭储备/);assert.match(text,/第一次投入/);assert.match(html,/当前可提现估值/);assert.equal(renderSchemeLifeLedger(player(),{money}), '');
});
