import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyAction} from '../src/game/core.js';
import {gameDate} from '../src/game/game-calendar.js';
import {livingLedger,isLivingBill} from '../src/game/living-ledger.js';
import {renderLivingBills} from '../src/ui/living-ledger.js';
import {renderWalletLiving} from '../src/ui/wallet-living.js';
import {advanceLivingCosts} from '../src/game/living-costs.js';
import {noteRealizedProfit} from '../src/game/consumption.js';
import {marketWelcome,renderMarketWelcome} from '../src/ui/market-welcome.js';
const catalog={};for(const key of ['events','families','history','endings','characters']){const v=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));catalog[key]=key==='events'?v.events:v;}
const ctx={esc:s=>String(s).replaceAll('<','&lt;'),money:n=>'¥'+n/100};
function student(seed='bills'){const s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age:18,turn:6,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1000,monthlyIncome:0,giftReceived:true});s.education.college=true;s.flags.college_student=true;s.occupation='大学生';s.collegeSupport={version:1,lastPaidMonth:gameDate(s).slice(0,7),totalPaid:200000};return s;}
test('dated living ledger combines paid and unpaid portions but excludes trades and borrowing',()=>{
 const s=student(),n=applyAction(s,{type:'calendar_day'}).state;const rows=livingLedger(n);assert.equal(rows[0].total,5000);assert.equal(rows[0].paid,1000);assert.equal(rows[0].unpaid,4000);assert.equal(rows[0].date,'2006-01-01');assert.ok(n.debts.every(isLivingBill));
 n.ledger.push({id:'trade',account:'cash',amount:-100000,label:'买入股票'},{id:'loan',account:'debt',amount:10000,label:'银行借款'});assert.deepEqual(livingLedger(n),rows);
 const html=renderLivingBills(n,ctx);assert.match(html,/当时未付/);assert.doesNotMatch(html,/年化|利息|个月|买入股票/);assert.match(html,/支付账单/);assert.match(renderWalletLiving(n,ctx),/日常消费账单/);
});
test('old ledger never invents a calendar date and separates bill debt from loans',()=>{
 const s={ledger:[{id:'old',account:'cash',amount:-200,label:'临时开销：补卡',age:18,turn:6}],debts:[]};assert.match(renderLivingBills(s,ctx),/未记录具体日期/);assert.ok(!isLivingBill({kind:'bank',aprBps:0,name:'银行借款'}));assert.ok(!isLivingBill({kind:'arrears',aprBps:600,name:'卖方期权超保证金赔付'}));
});
test('campus incidents are smaller and less frequent than working life, without adult household bills',()=>{
 let campus=0,working=0;const api={charge:()=>0,stat:()=>{}};
 for(let i=0;i<40;i++){const s=student('expense-'+i);s.cash=100000000;advanceLivingCosts(s,360,api);campus+=s.livingCosts.history.length;assert.ok(s.livingCosts.history.every(x=>x.id.startsWith('campus_')&&x.amount<=45000));for(let j=1;j<s.livingCosts.history.length;j++)assert.ok(s.livingCosts.history[j].day-s.livingCosts.history[j-1].day>=60);
 const a=student('expense-'+i);a.age=26;a.cash=100000000;advanceLivingCosts(a,360,api);working+=a.livingCosts.history.length;assert.ok(a.livingCosts.history.every(x=>!x.id.startsWith('campus_')));}
 assert.ok(campus>0&&working>campus*2,{campus,working});
});
test('optional post-profit purchases use student-scale stories and reduced frequency',()=>{
 let campus=0,working=0;
 for(let i=0;i<100;i++){for(const college of [true,false]){const s=student('consume-'+i);s.cash=1000000;s.debtClock.day=90;if(!college)s.age=26;noteRealizedProfit(s,1000000);const p=s.lifeArcs.consumption?.pending;if(p){if(college){campus++;assert.ok(p.id.startsWith('campus_'));}else{working++;assert.ok(!p.id.startsWith('campus_'));}}}}
 assert.ok(campus>0&&working>campus*1.5,{campus,working});
});
test('all market entries have a contextual introduction with specific navigation choices, no hidden transactions',()=>{
 const s=student(),before=structuredClone(s);for(const kind of ['stock','fund','bond','option','option_short','futures','crypto','ponzi','angel','housing','gambling']){assert.ok(marketWelcome(s,kind));assert.match(renderMarketWelcome(s,kind,ctx),/market-intro-enter/);assert.match(renderMarketWelcome(s,kind,ctx),/暂时不看/);assert.deepEqual(s,before);}
 s.flags.market_intro_option=true;assert.equal(marketWelcome(s,'option_short'),null);assert.match(marketWelcome(s,'futures').text,/指数和汇率/);
});
