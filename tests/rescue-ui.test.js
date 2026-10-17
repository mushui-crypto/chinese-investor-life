import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {getMetrics,getSurvivalStatus,getLoanOffers} from '../src/game/core.js';
import {syncSurvival} from '../src/game/survival.js';
import {renderRescueDialog} from '../src/ui/rescue-dialog.js';
import {foodSettlementResult} from '../src/ui/survival-panel.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));catalog[n]=n==='events'?d.events:d;}
const ctx={money:n=>`¥${n/100}`,esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),icon:()=>''};
function fixture(){const s=createRun({seed:'rescue-ui',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:2000,monthlyIncome:300000,giftReceived:true});syncSurvival(s,getMetrics(s));return s;}
test('cash gap accounts for current cash and expected daily income without mutating the save',()=>{
 const s=fixture(),before=structuredClone(s),v=getSurvivalStatus(s),html=renderRescueDialog(s,ctx);
 assert.equal(v.shortage,v.dailyExpense-s.cash-v.dailySalary);
 assert.match(html,new RegExp(`<strong>¥${v.shortage/100}</strong>`));
 assert.match(html,/<dt>今日待到账<\/dt><dd>¥0<\/dd>/);assert.deepEqual(s,before);
});
test('covering today while still in the emergency period does not display a red zero shortfall',()=>{
 const s=fixture();s.cash=30000;syncSurvival(s,getMetrics(s));assert.equal(getSurvivalStatus(s).active,true);
 const html=renderRescueDialog(s,ctx);assert.match(html,/今天生活费已够/);assert.doesNotMatch(html,/今天生活费还差/);
});
test('college students get the timetable instead of full-time work controls',()=>{
 const s=fixture();s.age=18;s.education.college=true;s.monthlyIncome=0;
 const html=renderRescueDialog(s,ctx);assert.match(html,/data-action="student-jobs"/);assert.doesNotMatch(html,/data-type="(?:seek_job|gig)"/);
});
test('zero energy keeps review paths reachable and explains unavailable borrowing',()=>{
 const s=fixture();s.actionPoints=0;s.positions=[];const html=renderRescueDialog(s,ctx);
 assert.match(html,/精力不足，可先查看/);assert.match(html,/精力不足 · 申请需 1 点精力/);assert.match(html,/暂无可变现资产/);
 assert.match(html,/<button[^>]+data-action="rescue-assets">查看持有资产<\/button>/);
 for(const o of getLoanOffers(s)){assert.equal(o.allowed,false);assert.ok(html.includes(ctx.esc(o.reason)));}
 assert.match(html,/高成本借款/);assert.match(html,/<details class="rescue-borrow">/);
 assert.match(html,/data-action="chapter-settle-day"/);assert.match(html,/结算不消耗精力/);
});
test('rent arrears and hunger have independent visible counters, including zero hunger',()=>{
 const s=fixture();s.survival.unpaidDays=33;s.survival.hungryDays=0;
 s.survival.last={foodDue:2000,foodPaid:2000,healthLost:0,hospital:false};
 let html=renderRescueDialog(s,ctx);
 assert.match(html,/连续欠费 <strong>33<\/strong> 天/);
 assert.match(html,/连续缺食 <strong>0<\/strong> 天/);
 assert.match(html,/上次伙食已付 ¥20 \/ ¥20<\/span><span>缺食扣健康 <strong>0/);
 s.survival.hungryDays=3;s.survival.last.foodPaid=0;s.survival.last.healthLost=10;
 html=renderRescueDialog(s,ctx);assert.match(html,/连续缺食 <strong>3<\/strong> 天/);
 assert.match(html,/缺食扣健康 <strong>−10/);
 assert.equal(foodSettlementResult({paid:0},ctx),'');
 assert.match(foodSettlementResult({foodDue:2000,foodPaid:2000,healthLost:0,hospital:true},ctx),/伙食由医院提供/);
});
