import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyEffects,applyAction,getMetrics,PRODUCTS} from '../src/game/core.js';
import {createRun} from '../src/game/narrative.js';
import {ensureCryptoLife,cryptoLifeState} from '../src/game/crypto-life.js';
import {ensureSchemeLife,schemeLifeState} from '../src/game/scheme-life.js';
import {cryptoLifeActionPreview,cryptoLifeActionReason,validateCryptoLifeFinance} from '../src/game/crypto-life-finance.js';
import {nextSchemeProject,validateSchemeLifeFinance} from '../src/game/scheme-life-finance.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const families=JSON.parse(fs.readFileSync(new URL('../data/families.json',import.meta.url)));
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));const catalog={events:read('events').events,families,characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
function adult(seed='scheme-finance'){
 const s=createRun({seed,familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000000,familyReserve:1000000,monthlyIncome:0,giftReceived:true});
 s.flags.crypto_aware=true;s.flags.ponzi_exposed=true;s.marketProgress={firstExperienceAge:18,simulations:0,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};ensureCryptoLife(s);ensureSchemeLife(s);return s;
}
function effect(s,e){const r=applyEffects(s,[{op:'crypto_life',schemeLife:true,...e}]);assert.equal(r.result.error,undefined,r.result.error);return r.state;}
function clock(s,days){const n=structuredClone(s);n.debtClock.day+=days;n.age+=days/360;const r=applyEffects(n,[]);assert.equal(r.result.error,undefined,r.result.error);return r.state;}
function ledger(s){for(const account of ['position','claim'])assert.equal(s.ledger.filter(e=>e.account===account).reduce((n,e)=>n+e.amount,0),(account==='position'?s.positions:s.claims).reduce((n,p)=>n+p.value,0),account);validateCryptoLifeFinance(s);}
function project(s){return s.positions.find(p=>p.schemeLife)||s.trading.schemeFamilyProjects?.[0];}
function longProject(){for(let i=0;i<100;i++){const s=effect(adult('long-'+i),{action:'scheme_join',amount:100000});if(project(s).cryptoScheme.normalMonths>=42)return s;}throw Error('No long-payment fixture seed');}
function collapse(s){for(let n=0;n<20&&project(s);n++){const p=project(s),q=p.cryptoScheme;if(q.stage==='normal')s=clock(s,1800);else{s=effect(s,{action:'scheme_ack',stage:q.stage,projectKey:p.projectKey});s=clock(s,90);}}assert.equal(project(s),undefined);return s;}

test('independent projects can pay at least twelve times and real payouts can cover initial principal',()=>{
 let s=longProject(),p=project(s),cash=s.cash,worth=getMetrics(s).netWorth;s=clock(s,360);assert.equal(project(s).cryptoScheme.paymentCount,12);assert.equal(s.cash-cash,30000);assert.equal(getMetrics(s).netWorth-worth,30000);assert.equal(schemeLifeState(s).projects[p.projectKey].paymentCount,12);
 s=clock(s,840);assert.equal(project(s).cryptoScheme.paymentCount,40);assert.equal(s.cash-cash,100000);assert.equal(project(s).cost,100000);const noRepeat=clock(s,0);assert.equal(noRepeat.cash,s.cash);assert.equal(cryptoLifeState(noRepeat).schemePayments,40);ledger(s);
});

test('retained earnings are assets without cash, and principal withdrawal can leave only uncollected profit',()=>{
 let s=longProject();s=effect(s,{action:'scheme_retain'});const cash=s.cash,before=getMetrics(s).netWorth;s=clock(s,360);const p=project(s);assert.equal(s.cash,cash);assert.ok(p.cryptoScheme.retainedProfit>0);assert.equal(p.value,p.cost+p.cryptoScheme.retainedProfit);assert.equal(getMetrics(s).netWorth-before,p.cryptoScheme.retainedProfit);assert.equal(schemeLifeState(s).projects[p.projectKey].returned,0);
 const preview=cryptoLifeActionPreview(s,{action:'scheme_principal',schemeLife:true});assert.equal(preview.proceeds,100000);s=effect(s,{action:'scheme_principal'});assert.equal(s.cash-cash,preview.proceeds);assert.equal(project(s).cost,0);assert.ok(project(s).value>0);ledger(s);
 const after=s.cash;s=collapse(s);assert.ok(s.cash>=after);assert.equal(s.claims.length,0);assert.equal(cryptoLifeState(s).branches.scheme.realizedProfit,s.cash-cash-100000);ledger(s);
});

test('partial withdrawals conserve the remaining cash principal and do not pay future interest on removed money',()=>{
 let s=longProject(),before=s.cash;const preview=cryptoLifeActionPreview(s,{action:'scheme_partial',schemeLife:true,fraction:.25});s=effect(s,{action:'scheme_partial',fraction:.25});assert.equal(s.cash-before,preview.proceeds);assert.equal(project(s).cost,75000);assert.equal(project(s).cryptoScheme.contributions.reduce((n,c)=>n+c.amount,0),75000);before=s.cash;s=clock(s,30);assert.equal(s.cash-before,1875);ledger(s);
 s=effect(s,{action:'scheme_withdraw'});const error=applyEffects(s,[{op:'crypto_life',schemeLife:true,action:'scheme_withdraw'}]);assert.match(error.result.error,/没有|重复/);assert.equal(error.state.cash,s.cash);
});

test('a delayed project can recover with actual cash and an immediately executable exit',()=>{
 let recovered;
 for(let seed=0;seed<20&&!recovered;seed++){let s=effect(adult('recover-'+seed),{action:'scheme_join',amount:100000});s=clock(s,1800);assert.equal(project(s).cryptoScheme.stage,'delay');s=effect(s,{action:'scheme_ack',stage:'delay'});const before=s.cash;s=clock(s,60);if(project(s).cryptoScheme.stage==='recovered')recovered={s,before};}
 assert.ok(recovered);let {s,before}=recovered;assert.equal(s.cash-before,2500);assert.equal(cryptoLifeActionReason(s,{action:'scheme_withdraw'}),'');assert.ok(schemeLifeState(s).projects[project(s).projectKey].memories.falseRecoveryMemory);const quote=cryptoLifeActionPreview(s,{action:'scheme_withdraw'});before=s.cash;s=effect(s,{action:'scheme_withdraw'});assert.equal(s.cash-before,quote.proceeds);ledger(s);
});

test('reading a recovery notice years later does not manufacture payments for the paused years',()=>{
 let s;
 for(let seed=0;seed<20&&!s;seed++){let n=effect(adult('late-recovery-'+seed),{action:'scheme_join',amount:100000});n=clock(n,1800);n=effect(n,{action:'scheme_ack',stage:'delay'});n=clock(n,60);if(project(n).cryptoScheme.stage==='recovered')s=n;}
 assert.ok(s);const entered=project(s).cryptoScheme.stageEnteredDay,paid=project(s).cryptoScheme.paymentCount;s=clock(s,720);assert.equal(project(s).cryptoScheme.paymentCount,paid+2);const before=s.cash;s=effect(s,{action:'scheme_ack',stage:'recovered'});assert.equal(project(s).cryptoScheme.stageEnteredDay,entered);assert.equal(s.cash,before);s=clock(s,90);assert.equal(project(s).cryptoScheme.stage,'rumor');assert.equal(s.cash,before);assert.equal(project(s).cryptoScheme.paymentCount,paid+2);ledger(s);
});

test('large time steps cannot skip unread warnings or maintenance, and the acknowledged sequence eventually ends',()=>{
 let s=longProject();s=clock(s,1800);assert.equal(project(s).cryptoScheme.stage,'delay');const before=structuredClone(s);s=clock(s,3600);assert.equal(project(s).cryptoScheme.stage,'delay');assert.equal(s.cash,before.cash);assert.equal(s.rng,before.rng);
 for(let n=0;n<10&&project(s).cryptoScheme.stage!=='maintenance';n++){const q=project(s).cryptoScheme;s=effect(s,{action:'scheme_ack',stage:q.stage});s=clock(s,90);assert.ok(project(s));}
 assert.equal(project(s).cryptoScheme.stage,'maintenance');const cash=s.cash;s=clock(s,3600);assert.equal(project(s).cryptoScheme.stage,'maintenance');assert.equal(s.cash,cash);assert.equal(project(s).value,0);ledger(s);
 s=collapse(s);assert.equal(s.claims.length,1);assert.equal(s.claims[0].face,100000);assert.equal(s.claims[0].value,0);assert.ok(s.claims[0].schemeLife);const last=s.cash;s=clock(s,3600);assert.equal(s.cash,last);ledger(s);
});

test('project catalogs cycle distinct names and keys and permanent scheme refusal does not close spot',()=>{
 let s=adult(),names=[],keys=[];for(let i=0;i<3;i++){const next=nextSchemeProject(s);s=effect(s,{action:'scheme_join',amount:100000});const p=project(s);assert.equal(p.name,next.name);names.push(p.name);keys.push(p.projectKey);s=effect(s,{action:'scheme_withdraw'});}
 assert.equal(new Set(names).size,3);assert.equal(new Set(keys).size,3);schemeLifeState(s).forbidRisk=true;assert.match(cryptoLifeActionReason(s,{action:'scheme_join',schemeLife:true}),/永久拒绝/);assert.match(cryptoLifeActionReason(s,{type:'desk_order',product:'ponzi',amount:100000}),/永久拒绝/);assert.equal(cryptoLifeActionReason(s,{action:'buy',amount:10000}),'');
});

test('adopting an old CL project preserves cash, principal, previous payout and RNG',()=>{
 let s=effect(adult(),{action:'scheme_join',schemeLife:false,amount:100000});s=clock(s,30);const p=project(s)||s.positions[0],before={cash:s.cash,cost:p.cost,value:p.value,paid:p.cryptoScheme.paid,rng:s.rng};assert.equal(cryptoLifeActionReason(s,{action:'scheme_withdraw',schemeLife:true,projectKey:p.id}),'');s=effect(s,{action:'scheme_retain',projectKey:p.id});const q=project(s).cryptoScheme;assert.equal(q.legacyFinance,true);assert.equal(q.historyKnown,false);assert.deepEqual({cash:s.cash,cost:project(s).cost,value:project(s).value,paid:q.paid,rng:s.rng},before);ledger(s);
});

test('family participation uses only real family reserve and returns there, separate from personal wealth',()=>{
 let s=longProject(),cash=s.cash,worth=getMetrics(s).netWorth,reserve=s.familyReserve;const preview=cryptoLifeActionPreview(s,{action:'scheme_family_join',schemeLife:true,amount:100000});assert.equal(preview.cashCost,0);assert.equal(preview.familyCashCost,100000);
 s=effect(s,{action:'scheme_family_join',amount:100000});assert.equal(s.familyReserve,reserve-100000);assert.equal(s.cash,cash);assert.equal(getMetrics(s).netWorth,worth);const key=project(s).projectKey,personal=schemeLifeState(s).projects[key].invested;s=clock(s,30);assert.equal(s.familyReserve,reserve-100000+2500);assert.equal(schemeLifeState(s).projects[key].invested,personal);const familyQuote=cryptoLifeActionPreview(s,{action:'scheme_family_withdraw',schemeLife:true});assert.equal(familyQuote.proceeds,0);assert.equal(familyQuote.familyProceeds,100000);cash=s.cash;s=effect(s,{action:'scheme_family_withdraw'});assert.equal(s.familyReserve,reserve+2500);assert.equal(s.cash,cash);ledger(s);
});

test('family exposure stays outside personal assets after the player exits and can independently collapse',()=>{
 let s=longProject();s=effect(s,{action:'scheme_family_join',amount:100000});s=effect(s,{action:'scheme_withdraw'});assert.equal(s.positions.length,0);assert.equal(s.trading.schemeFamilyProjects.length,1);const worth=getMetrics(s).netWorth,cash=s.cash,invested=cryptoLifeState(s).invested,profit=cryptoLifeState(s).realizedProfit;s=collapse(s);assert.equal(s.positions.length,0);assert.equal(s.cash,cash);assert.equal(getMetrics(s).netWorth,worth);assert.equal(cryptoLifeState(s).invested,invested);assert.equal(cryptoLifeState(s).realizedProfit,profit);assert.equal(s.claims.length,0);assert.equal(s.trading.schemeFamilyProjects.length,0);ledger(s);
});

test('forged family funds, future dates and invented book gains are rejected',()=>{
 let s=longProject();const tooMuch=applyEffects(s,[{op:'crypto_life',schemeLife:true,action:'scheme_family_join',amount:s.familyReserve+1}]);assert.match(tooMuch.result.error,/家庭储备/);assert.equal(tooMuch.state.familyReserve,s.familyReserve);const bad=structuredClone(s);project(bad).bookBalance++;assert.throws(()=>validateSchemeLifeFinance(bad),/账面/);
});

test('new project and separate family carrier survive save/load and ordinary market exits preserve retained earnings',()=>{
 let s=longProject();s=effect(s,{action:'scheme_retain'});s=clock(s,60);s=effect(s,{action:'scheme_family_join',amount:100000});assert.deepEqual(decodeSave(encodeSave(s)),s);const before=s.cash,expected=project(s).value,id=project(s).id;
 const out=applyAction(s,{type:'desk_sell',id,bps:10000});assert.equal(out.result.error,undefined,out.result.error);s=out.state;assert.equal(s.cash-before,expected);assert.equal(s.positions.length,0);assert.deepEqual(decodeSave(encodeSave(s)),s);ledger(s);
});

test('a new failed-project claim recovers to the same project exactly once with no new participation',()=>{
 let s=collapse(longProject()),key=s.claims[0].projectKey,pr=schemeLifeState(s).projects[key],returned=pr.returned,invested=pr.invested,cash=s.cash;
 const r=applyEffects(s,[{op:'recover_claim',recovery_bps:3000}],{resolutionId:'scheme:recovery:once'});assert.equal(r.result.error,undefined,r.result.error);s=r.state;assert.equal(s.cash-cash,30000);assert.equal(schemeLifeState(s).projects[key].returned-returned,30000);assert.equal(schemeLifeState(s).projects[key].invested,invested);assert.equal(s.claims[0].face,70000);assert.deepEqual(decodeSave(encodeSave(s)),s);
 const again=applyEffects(s,[{op:'recover_claim',recovery_bps:3000}],{resolutionId:'scheme:recovery:once'});assert.equal(again.result.alreadyApplied,true);assert.equal(again.state.cash,s.cash);ledger(s);
});

test('seeded project paths include a final real payment and three separate maintenance notices without endless loops',()=>{
 let finalPayment=false,maintenanceThree=false;
 for(let seed=0;seed<80&&!(finalPayment&&maintenanceThree);seed++){
  let s=effect(adult('variety-'+seed),{action:'scheme_join',amount:100000});s=clock(s,1800);const key=project(s).projectKey;let priorStage,steps=0;
  while(project(s)&&steps++<18){const p=project(s),stage=p.cryptoScheme.stage;if(stage==='slow')s=effect(s,{action:'scheme_prepare_exit'});s=effect(s,{action:'scheme_ack',stage});const before=s.cash;s=clock(s,90);if(project(s)?.cryptoScheme.stage==='last_payment'&&stage==='slow'){assert.ok(s.cash>before);finalPayment=true;}priorStage=stage;}
  assert.equal(project(s),undefined);const pr=schemeLifeState(s).projects[key];if(pr.maintenanceCount===3)maintenanceThree=true;assert.ok(pr.maintenanceCount<=3);ledger(s);
 }
 assert.equal(finalPayment,true);assert.equal(maintenanceThree,true);
});
