import assert from 'node:assert/strict';
import {applyEffects} from '../../src/game/core.js';
import {ensureCryptoLife} from '../../src/game/crypto-life.js';
import {ensureSchemeLife,schemeLifeState,recordSchemeEvent,recordSchemeInterlude,schemeEventAllowed} from '../../src/game/scheme-life.js';
import {nextSchemeProject} from '../../src/game/scheme-life-finance.js';
import {gameDate} from '../../src/game/game-calendar.js';
import {workEventAmount} from '../../src/game/employment.js';

const held=s=>s.positions.find(p=>p.schemeLife);
function run(s,effects){const r=applyEffects(s,effects);assert.equal(r.result.error,undefined,r.result.error);return r.state;}
const effect=(s,action,extra={})=>run(s,[{op:'crypto_life',schemeLife:true,action,...extra}]);
function clock(s,days){const n=structuredClone(s);n.debtClock.day+=days;n.age+=days/360;recordSchemeInterlude(n);recordSchemeInterlude(n);n.behavior.onlineGambling.ordinaryEvents+=2;return run(n,[]);}

// Build each prerequisite using settled cash and the same finance effects as play.
// RNG seeds select real possible paths; no stage, receipt or profit is fabricated.
export function attachSchemeFixture(state,event,choice=null){
 if(!event.schemeLife&&!choice?.schemeSpecial)return state;
 const meta=event.schemeLife||{requiredState:choice.schemeSpecial,blockedState:[],ageStage:[24,80],minDelay:90,cooldown:180,repeatable:true};
 const required=meta.requiredState||[],target=meta.stage,needsFamily=choice?.schemeAction==='family_withdraw'||required.some(k=>['familyJoined','familyCollapsed'].includes(k));
 state.age=Math.max(24,state.age);state.debtClock.day=Math.max(1000,state.debtClock.day);state.familyReserve=Math.max(state.familyReserve||0,1000000);ensureCryptoLife(state);ensureSchemeLife(state);
 if(event.id==='CL22')return state;
 const base=structuredClone(state),next=nextSchemeProject(base);
 recordSchemeEvent(base,{eventId:'fixture-project-introduction',choice:'只听介绍',action:'curious',exposure:true,projectKey:next.projectKey,projectName:next.name,source:next.introducer});
 let s=clock(base,90);
 if(!required.includes('neverJoined')){
  let found=null;
  for(let attempt=1;attempt<=100&&!found;attempt++){
   let n=structuredClone(s);n.rng=(attempt*2654435761)>>>0;n=effect(n,'scheme_join',{amount:100000});
   if(required.includes('coveredInitial')&&held(n).cryptoScheme.normalMonths<=42)continue;
   if(needsFamily)n=effect(n,'scheme_family_join',{amount:100000});
   if(required.includes('friendJoined'))recordSchemeEvent(n,{eventId:'fixture-friend-conversation',choice:'展示真实记录',action:'friend_join',projectKey:held(n).projectKey});
   if(required.includes('highTrust'))recordSchemeEvent(n,{eventId:'fixture-trust-after-receipts',choice:'还要继续核对',action:'trust',projectKey:held(n).projectKey,tendencies:{trust:30}});
   const needCollapse=required.includes('collapsed'),needEscape=required.includes('escapedFailure');
   if(!needCollapse&&!needEscape&&(!target||target==='normal')){
    const months=required.includes('coveredInitial')?40:required.includes('longPaying')?12:3;
    n=clock(n,months*30);if(held(n).cryptoScheme.stage!=='normal')continue;found=n;break;
   }
   n=clock(n,1800);
   if(needEscape){n=effect(n,'scheme_withdraw');for(let i=0;i<13&&!Object.values(schemeLifeState(n).projects).some(p=>p.escapedFailure);i++)n=clock(n,180);assert.ok(Object.values(schemeLifeState(n).projects).some(p=>p.escapedFailure));found=n;break;}
   for(let step=0;step<24;step++){
    const p=held(n);if(!p){if(needCollapse)found=n;break;}
    if(!needCollapse&&p.cryptoScheme.stage===target){found=n;break;}
    n=effect(n,'scheme_ack',{projectKey:p.projectKey,stage:p.cryptoScheme.stage});n=clock(n,90);
   }
  }
  assert.ok(found,`${event.id} must have a real finance path to ${target||required.join(',')}`);s=found;
 }
 if(required.includes('yearsSinceCollapse'))s=clock(s,720);
 if(required.includes('lifeSalary')){const today=gameDate(s),[y,m,d]=today.split('-').map(Number),offset=d<10?1:0,payday=new Date(Date.UTC(y,m-1-offset,10)).toISOString().slice(0,10),month=new Date(Date.UTC(y,m-2-offset,1)).toISOString().slice(0,7);s.payroll={version:1,lastAccruedDate:today,pending:[],history:[{month,gross:100000,net:100000,payday}]};}
 if(required.includes('lifeBonus')){s.employment.lastDay=s.debtClock.day;s.employment.tenure=360;s.employment.history.push({kind:'bonus',day:s.debtClock.day,date:gameDate(s),amount:workEventAmount('bonus',s.monthlyIncome,360,.5),owed:0,wage:s.monthlyIncome,tenure:360,text:'奖金到账的有效测试记录'});}
 if(required.includes('lifeUnemployed')){s.monthlyIncome=0;s.occupation='离职待业';}
 if(required.includes('lifeHome'))s.flags.housing_plan=true;
 if(required.includes('parentsAvailable'))s.flags.living_parent=true;
 if(required.includes('lifePartner'))s.household.partner=true;
 // Rendering ordinary variants uses the same independent pacing gate.
 assert.equal(schemeEventAllowed(s,{...event,schemeLife:meta}),true,`${event.id} scheme prerequisite fixture`);
 Object.assign(state,s);return state;
}
