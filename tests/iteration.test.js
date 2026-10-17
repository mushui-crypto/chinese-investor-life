import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,act} from '../src/game/narrative.js';
import {getMetrics,PRODUCTS} from '../src/game/core.js';
import {partialExitShares,partialExitLabel} from '../src/game/market-play.js';
import {nextStep,updateJourney} from '../src/game/play-guide.js';
import {receiptSummary,renderInlineReceipt} from '../src/ui/play-guide-panel.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?d.events:d;}
function adult(){let s=createRun({seed:'iteration',familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000000,monthlyIncome:400000,giftReceived:true});s.flags.gambling_exposed=true;s.stats.insight=90;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
const go=(s,a)=>{const n=act(s,a,catalog);assert.ok(!n.lastResult?.error,n.lastResult?.error);return updateJourney(s,n,a);};
test('odd stock lots show and sell the same integer quantity while preserving cash asset identity',()=>{
 let s=go(adult(),{type:'desk_order',product:'stock',instrument:'chip',shares:300,amount:300000});for(let n=0;n<3;n++)s=go(s,{type:'market_tick'});s=go(s,{type:'market_day'});const p=s.positions[0],before=getMetrics(s),value=p.value/3;assert.equal(partialExitShares(p),100);assert.equal(partialExitLabel(p),'卖出 1 手');s=go(s,{type:'desk_sell',id:p.id,bps:5000});assert.equal(s.positions[0].shares,200);assert.match(s.lastResult.text,/卖出 100 股（1 手）/);assert.equal(s.cash-before.cash,value-Math.round(value*.002));assert.equal(getMetrics(s).netWorth-before.netWorth,-Math.round(value*.002));
});
test('trade receipts distinguish asset transfers from profit without advancing RNG',()=>{
 let s=adult(),rng=s.rng;s=go(s,{type:'desk_order',product:'stock',instrument:'chip',shares:100,amount:100000});const q=receiptSummary(s);assert.match(q.brief,/海临芯科买入成交/);assert.equal(q.cash,-100000);assert.equal(q.worth,0);assert.equal(s.rng,rng);const html=renderInlineReceipt(s,{esc:String,money:String});assert.match(html,/现金 <b>-100000<\/b>/);assert.match(html,/净资产变化 <b>0<\/b>/);assert.match(html,/净资产变化/);
 const honey=go(adult(),{type:'desk_order',product:'crypto',instrument:'PIXIU',amount:100000});assert.equal(receiptSummary(honey).worth,-100000);assert.ok(!renderInlineReceipt(honey,{esc:String,money:String}).includes('买成了资产，不是亏掉了'));
});
test('a trading desk points to market activity even when the selected life goal is already completed',()=>{
 const s=adult();s.journey.completed=['buffer'];for(const desk of ['stock','fund','bond','option','option_short','futures','crypto','ponzi','angel','housing','gambling'])assert.equal(nextStep(s,desk).route.command.type,'day_next');
});
test('locked and exited desks offer honest paths instead of pushing new orders',()=>{
 const s=adult();s.marketProgress.unlocked={};s.cash=1000000;assert.equal(nextStep(s,'option').route.type,'market-rules');assert.equal(nextStep(s,'option').route.product,'option');s.flags.gambling_quit=true;assert.equal(nextStep(s,'gambling').route.type,'desk-back');assert.equal(partialExitLabel({shares:100}),'不足两手');
});
