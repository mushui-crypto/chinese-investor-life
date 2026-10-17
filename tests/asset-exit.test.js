import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {getActionAvailability,PRODUCTS} from '../src/game/core.js';
import {quoteFor} from '../src/game/market-play.js';
import {assetExit} from '../src/ui/asset-exit.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(){const s=createRun({seed:'exit-consistency',familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000000,giftReceived:true});s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
function order(s,instrument='us_compute'){return act(s,{type:'desk_order',product:'stock',instrument,shares:100,amount:100*quoteFor(s,'stock',instrument).price},catalog);}
test('asset-page market exits use market energy even after daily life actions are exhausted',()=>{
 let s=order(adult());s.actionPoints=0;const before=structuredClone(s),p=s.positions[0],exit=assetExit(s,p);assert.ok(exit.allowed);assert.equal(exit.action.type,'desk_sell');assert.deepEqual(s,before);
 const sold=act(s,exit.action,catalog);assert.ok(!sold.lastResult.error);assert.equal(sold.cash-s.cash,p.value-Math.round(p.value*.002));assert.equal(sold.actionPoints,0);assert.equal(sold.trading.energy,s.trading.energy-1);assert.equal(sold.positions.length,0);assert.deepEqual(decodeSave(encodeSave(sold)),sold);
});
test('asset-page exits cannot bypass T+1, market close, frozen holdings or used trading actions',()=>{
 const a=order(adult(),'chip'),p=a.positions[0];assert.match(assetExit(a,p).reason,/T\+1/);
 const s=order(adult()),position=s.positions[0];for(const mutate of [x=>x.trading.energy=0,x=>x.trading.phase=3,x=>x.positions[0].frozen=true,x=>x.positions[0].lockUntilTurn=x.turn+2,x=>x.phase='event']){const n=structuredClone(s);mutate(n);const exit=assetExit(n,n.positions[0]);assert.ok(!exit.allowed);assert.ok(exit.reason);assert.equal(exit.reason,getActionAvailability(n,{type:'desk_sell',id:position.id,bps:10000}).reason=== '先读完眼前的故事'?'先处理眼前的故事，再安排卖出':getActionAvailability(n,{type:'desk_sell',id:position.id,bps:10000}).reason);}
});
test('older story assets and shops retain their original life-action sale, and contracts route to the right desk',()=>{
 let s=act(adult(),{type:'invest',product:'fund',amount:100000},catalog);const p=s.positions[0];assert.equal(assetExit(s,p).action.type,'sell');s.actionPoints=0;assert.ok(!assetExit(s,p).allowed);s.actionPoints=2;
 s.businesses=[{id:'shop',name:'小店',value:100000,monthlyProfit:0,managedTurn:20,openedTurn:20}];const exit=assetExit(s,s.businesses[0]);assert.equal(exit.action.type,'sell');const n=act(s,exit.action,catalog);assert.equal(n.cash-s.cash,80000);assert.equal(n.actionPoints,s.actionPoints-1);assert.equal(n.trading.energy,s.trading.energy);
 const c=act(adult(),{type:'desk_order',product:'crypto_perp',instrument:'BTCUSDT',amount:100000,leverage:10,direction:'long'},catalog),route=assetExit(c,c.positions[0]);assert.equal(route.desk,'crypto');assert.equal(route.mode,'perp');
});
