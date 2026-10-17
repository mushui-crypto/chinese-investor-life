import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import * as current from '../src/game/narrative.js';
import {setSaveCatalog, decodeSave, encodeSave} from '../src/game/storage.js';

const version=process.env.COMPAT_ARCHIVE?.match(/v[\d.]+(?=\.zip)/)?.[0]||'v1.0';
const reportDir=process.env.QA_REPORT_DIR||'reports/v1.4';
const source=process.env.COMPAT_ARCHIVE||'中国式赌狗-v1.0.zip';
const archive=resolve(source),root=await mkdtemp(join(tmpdir(),'gou-released-save-'));
try{
 execFileSync('unzip',['-q',archive,'src/game/*','data/*','package.json','-d',root]);
 const old=await import(pathToFileURL(join(root,'src/game/narrative.js')));
 const oldStorage=await import(pathToFileURL(join(root,'src/game/storage.js')));
 async function load(prefix){const catalog={};for(const name of ['events','families','history','endings','characters']){const value=JSON.parse(await readFile(join(prefix,'data',name+'.json'),'utf8'));catalog[name]=name==='events'?value.events:value;}return catalog;}
 const oldCatalog=await load(root),newCatalog=await load(resolve('.'));oldStorage.setSaveCatalog(oldCatalog);setSaveCatalog(newCatalog);
 const checks=[];
 function drain(state){
  for(let guard=0;['event','result'].includes(state.phase);guard++){
   assert.ok(guard<30);
   if(state.phase==='result'){state=old.continueStory(state,oldCatalog);continue;}
   const event=oldCatalog.events.find(e=>e.id===state.activeEvent.eventId),choices=old.eligibleChoices(state,event).filter(c=>!c.disabled);
   const choice=choices.find(c=>['observe','self_study','rest','family','school'].includes(c.profile))||choices[0];state=old.chooseEvent(state,event.id,choice.id,oldCatalog);assert.ok(!state.lastResult?.error);
  }
  return state;
 }
 function check(state,label){
  const envelope=oldStorage.encodeSave(state),saved=envelope.state,migrated=decodeSave(JSON.stringify(envelope));
  // Compare persisted JSON values; undefined object properties are never part of a save file.
  for(const key of ['rng','cash','activeEvent','debts','positions','seenEvents','pending','netWorthHistory'])assert.deepEqual(migrated[key],saved[key],label+': '+key);
  assert.deepEqual(migrated.legal.cases,saved.legal?.cases??[]);assert.deepEqual(decodeSave(encodeSave(migrated)),migrated);
  if(migrated.phase==='event'){
   const event=newCatalog.events.find(e=>e.id===migrated.activeEvent.eventId),choice=current.eligibleChoices(migrated,event).find(c=>!c.disabled);
   assert.ok(!current.chooseEvent(migrated,event.id,choice.id,newCatalog).lastResult?.error);
  }
  label=label.replace('v1.0',version);checks.push({label,age:state.age,phase:state.phase});console.log('PASS',label);
 }
 let state=old.createRun({name:'真实旧版迁移',seed:'released-v1-compat',familyId:'F08'},oldCatalog);check(state,'v1.0 shipped code: birth active story');
 while(state.age<18)state=old.nextTurn(drain(state),oldCatalog);check(state,'v1.0 shipped code: adult active story');
 if(['v1.3','v1.4','v1.5','v1.6','v1.7','v1.8','v1.9','v1.10','v1.11','v1.12'].includes(version)){
  const oldCore=await import(pathToFileURL(join(root,'src/game/core.js')));
  const gambler=structuredClone(state);Object.assign(gambler,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000});
  const played=oldCore.applyAction(gambler,{type:'gamble',pick:'red',amount:10000});assert.equal(played.result.error,undefined);
  check(played.state,version+' shipped code: real red-black result and participation case');
  const migrated=decodeSave(JSON.stringify(oldStorage.encodeSave(played.state)));
  assert.deepEqual(migrated.trading.gambling.last,played.state.trading.gambling.last);
  assert.equal(migrated.trading.gambling.rounds,1);assert.equal(migrated.trading.gambling.history.length,version==='v1.3'?0:1);
 }
 if(['v1.5','v1.6','v1.7','v1.8','v1.9','v1.10','v1.11','v1.12'].includes(version)){
  let crisis=structuredClone(state);Object.assign(crisis,{age:25,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:0,monthlyIncome:0});check(crisis,version+' shipped code: unshown survival emergency');
  for(let i=0;i<7;i++)crisis=old.nextTurn(crisis,oldCatalog);assert.equal(crisis.ending?.id,'E29');check(crisis,version+' shipped code: survival failure ending');
 }
 const oldCore=await import(pathToFileURL(join(root,'src/game/core.js')));
 if(['v1.9','v1.10','v1.11','v1.12'].includes(version)){
  const trader=structuredClone(state);Object.assign(trader,{age:25,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000});trader.stats.insight=90;
  const r=oldCore.applyAction(trader,{type:'desk_order',product:'stock',instrument:'chip',shares:200,amount:200000});assert.equal(r.result.error,undefined);check(r.state,'v1.9 A-share lot and T+1 lock');
  const m=decodeSave(JSON.stringify(oldStorage.encodeSave(r.state))),newCore=await import('../src/game/core.js');assert.ok(!newCore.getActionAvailability(m,{type:'sell',id:m.positions[0].id}).allowed);const n=newCore.applyAction(m,{type:'market_tick'});assert.equal(n.result.error,undefined);assert.equal(n.state.positions[0].shares,200);assert.deepEqual(decodeSave(encodeSave(n.state)),n.state);
 }
 if(version==='v1.6'){
  const borrower=structuredClone(state);Object.assign(borrower,{age:25,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000,monthlyIncome:400000});borrower.stats.credit=80;
  const r=oldCore.applyAction(borrower,{type:'borrow',kind:'card',amount:300000});assert.equal(r.result.error,undefined);assert.ok(r.state.debts.some(d=>d.kind==='card'));
  check(r.state,'v1.6 shipped code: existing card debt retains its old contract');
  const migrated=decodeSave(JSON.stringify(oldStorage.encodeSave(r.state)));assert.ok(migrated.debts.every(d=>!d.calendar));
  const newCore=await import('../src/game/core.js');const next=newCore.advanceTurn(migrated),prior=oldCore.advanceTurn(r.state);assert.equal(next.result.error,undefined);assert.equal(next.state.cash,prior.state.cash);assert.deepEqual(next.state.debts,prior.state.debts);
 }
 if(['v1.7','v1.8','v1.9','v1.10','v1.11','v1.12'].includes(version)){
  const b=structuredClone(state);Object.assign(b,{age:25,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000000,monthlyIncome:400000});b.stats.credit=80;const r=oldCore.applyAction(b,{type:'borrow',kind:'card',amount:300000});assert.equal(r.result.error,undefined);r.state.behavior.cooldownUntil=7;check(r.state,version+' calendar loan and cooling-off state');const m=decodeSave(JSON.stringify(oldStorage.encodeSave(r.state)));assert.deepEqual(m.behavior,r.state.behavior);assert.ok(m.debts[0].calendar);assert.deepEqual(m.journey.watchlist,['stock','fund']);
 }
 if(['v1.8','v1.9','v1.10','v1.11','v1.12'].includes(version)){const guide=await import(pathToFileURL(join(root,'src/game/play-guide.js')));const personalized=guide.toggleWatch(guide.setGoal(state,'practice'),'crypto');check(personalized,'v1.8 selected goal and watched markets');assert.deepEqual(decodeSave(JSON.stringify(oldStorage.encodeSave(personalized))).journey,personalized.journey);}
 let guard=0;while(state.phase!=='ended'&&guard++<180){state=drain(state);if(['v1.5','v1.6','v1.7','v1.8','v1.9','v1.10','v1.11','v1.12'].includes(version)&&state.phase==='planning'&&state.age>=18&&state.age<65&&state.monthlyIncome<oldCore.getMetrics(state).monthlyExpense&&state.actionPoints>0)state=old.act(state,{type:'seek_job'},oldCatalog);if(state.phase!=='ended')state=old.nextTurn(state,oldCatalog);}
 assert.equal(state.age,80);assert.equal(state.phase,'ended');check(state,'v1.0 shipped code: completed life');
 await mkdir(reportDir,{recursive:true});
 await writeFile(reportDir+'/save-compat-'+(version)+'.json',JSON.stringify({passed:true,date:new Date().toISOString(),source,checks},null,2));
}finally{await rm(root,{recursive:true,force:true});}
