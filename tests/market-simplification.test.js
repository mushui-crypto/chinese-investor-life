import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyAction,advanceTurn,getActionAvailability,getMetrics} from '../src/game/core.js';
import {getMarketAccess,MARKET_RULES,rememberOpenMarkets} from '../src/game/market-access.js';
import {visibleMarkets,marketSwitchOptions} from '../src/ui/market-menu.js';
import {renderMarketList,infoContent} from '../src/ui/readability.js';
import {renderDesk} from '../src/ui/market-desks.js';
import {renderMarketFocus} from '../src/ui/play-guide-panel.js';
import {optionQuote,optionMark} from '../src/game/option-pricing.js';
import {encodeSave,decodeSave,setSaveCatalog} from '../src/game/storage.js';
import {renderOrderOutcome} from '../src/ui/order-outcome.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
const ctx={esc:s=>String(s),money:n=>'¥'+(n/100).toFixed(2),icon:()=>'',ageText:n=>n+' 岁'};
const products=Object.keys(MARKET_RULES).filter(k=>k!=='crypto_perp').map(k=>[k,k]);
function adult(){const s=createRun({seed:'market-simple',familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:50000000,monthlyIncome:800000,giftReceived:true});s.stats.insight=60;s.flags.stock_aware=true;s.marketProgress={firstExperienceAge:null,simulations:0,unlocked:{}};return s;}
function step(s,a){const r=applyAction(s,a);assert.equal(r.result.error,undefined,r.result.error);return r.state;}
const save=s=>decodeSave(encodeSave(s));

test('undiscovered locked products stay hidden; introduced products remain visible without granting access',()=>{
 const s=adult();s.cash=10000000;s.stats.insight=30;
 assert.deepEqual(visibleMarkets(s).map(([k])=>k),['stock','fund','bond']);
 s.journey={...s.journey,watchlist:['futures','angel','fund']};
 for(const filter of ['all','open','locked','watched']){const html=renderMarketList(s,products,filter,ctx);assert.ok(!html.includes('data-market="futures"'));assert.ok(!html.includes('data-filter="locked"'));assert.ok(!html.includes('参与经验'));}
 assert.ok(!marketSwitchOptions('stock',s).includes('value="futures"'));
 assert.ok(!renderMarketFocus(s,ctx).includes('data-product="futures"'));
 for(const k of ['option','option_short','futures','angel']){s.cash=300000000;s.stats.insight=60;assert.equal(getMarketAccess(s,k).unlocked,true,k);assert.ok(getMarketAccess(s,k).requirements.every(r=>r.key!=='experience'&&r.key!=='simulation'));}
 s.age=17;assert.deepEqual(visibleMarkets(s).map(([k])=>k),['stock']);assert.match(renderMarketList(s,products,'all',ctx),/已介绍 · 待满足条件/);assert.equal(getMarketAccess(s,'stock').unlocked,false);
});
test('special markets require discovery while crypto spot and contracts open together',()=>{
 const s=adult();s.cash=300000000;
 assert.ok(!visibleMarkets(s).some(([k])=>['crypto','ponzi','gambling'].includes(k)));
 Object.assign(s.flags,{crypto_aware:true,ponzi_exposed:true,gambling_exposed:true});
 assert.equal(visibleMarkets(s).length,10);
 s.stats.insight=0;const html=renderDesk(s,'crypto',null,'spot',ctx);assert.ok(html.includes('data-mode="perp"'));
 assert.ok(html.includes('币易交易所'));
 for(const direction of ['long','short']){const n=step(s,{type:'desk_order',product:'crypto_perp',instrument:'BTCUSDT',amount:100000,leverage:10,direction});assert.equal(n.positions.at(-1).kind,'crypto_perp');assert.equal(n.positions.at(-1).direction,direction);}
 const legacy=adult();legacy.stats.insight=0;legacy.marketProgress.unlocked.crypto=true;assert.equal(getMarketAccess(save(legacy),'crypto_perp').unlocked,true);
 legacy.age=17;assert.equal(getMarketAccess(legacy,'crypto_perp').unlocked,false);
});
test('an opened market stays visible after losses and save/load without inventing experience',()=>{
 const previous=adult();previous.cash=300000000;
 const s=structuredClone(previous);s.cash=0;s.stats.insight=5;
 rememberOpenMarkets(s,previous);
 for(const product of ['option','option_short','futures','angel','housing'])assert.equal(getMarketAccess(s,product).unlocked,true,product);
 assert.equal(s.marketProgress.firstExperienceAge,null);assert.equal(s.marketProgress.simulations,0);
 assert.deepEqual(save(s),s);
 assert.ok(!visibleMarkets(s).some(([k])=>['crypto','ponzi','gambling'].includes(k)));
 s.age=17;assert.deepEqual(visibleMarkets(s).map(([k])=>k),['stock']);assert.equal(getMarketAccess(s,'stock').unlocked,false);
});
test('all option strikes and entry phases preserve initial equity with shared quote and no free intrinsic value',()=>{
 for(const product of ['option','option_short'])for(const direction of ['long','short'])for(const duration of [1,3,5])for(const strikeRatio of [.95,1,1.05])for(const phase of [0,1,2]){
  let s=adult();s.trading.phase=phase;const amount=product==='option'?100000:1000000;
  const a={type:'desk_order',product,instrument:'stock',amount,direction,duration,strikeRatio};const worth=getMetrics(s).netWorth;
  s=step(s,a);const p=s.positions[0],q=optionQuote({...a,price:p.entryPrice,phase});
  assert.equal(p.units,q.units);assert.equal(getMetrics(s).netWorth,worth);assert.equal(p.strike,q.strike);
  const mark=optionMark(p,p.entryPrice,s.trading.day,phase);
  const equity=product==='option'?mark.liability:p.margin+p.premium-mark.liability;
  assert.equal(equity,amount,JSON.stringify(a));
  assert.ok(optionMark(p,p.entryPrice,s.trading.day,phase+1).liability<=mark.liability);
  assert.deepEqual(save(s),s);
  const n=step(s,{type:'desk_sell',id:p.id,bps:10000});assert.equal(getMetrics(n).netWorth,worth-Math.round(amount*.002));
 }
});
test('buyer partial close reduces time value proportionally and saved legacy options still settle',()=>{
 let s=step(adult(),{type:'desk_order',product:'option',instrument:'stock',amount:100000,direction:'long',duration:3,strikeRatio:.95});
 const old=s.positions[0];s=step(s,{type:'desk_sell',id:old.id,bps:5000});const p=s.positions[0];
 assert.equal(p.optionTimeValue,old.optionTimeValue-Math.round(old.optionTimeValue/2));assert.deepEqual(save(s),s);
 delete p.optionTimeValue;delete p.optionRemainingAtOpen;assert.deepEqual(save(s),s);assert.ok(Number.isSafeInteger(optionMark(p,p.entryPrice,s.trading.day,1).liability));
});
test('fund redemption unlocks next day and cannot bypass from asset ledger; cancellation needs no order or rollover',()=>{
 let s=step(adult(),{type:'desk_order',product:'fund',instrument:'balanced',amount:100000,recurring:true});const id=s.positions[0].id;
 for(const type of ['sell','desk_sell'])assert.match(getActionAvailability(s,{type,id,bps:10000}).reason,/下一交易日/);
 s=save(s);while(s.trading.phase<3)s=step(s,{type:'market_tick'});
 s.trading.energy=0;const before=structuredClone(s),n=step(s,{type:'desk_manage',operation:'cancel_plan',instrument:'balanced'});
 assert.equal(n.trading.energy,0);assert.equal(n.trading.day,s.trading.day);assert.equal(n.cash,s.cash);assert.deepEqual(n.positions,s.positions);assert.equal(n.trading.plans.length,0);assert.deepEqual(s,before);
 s=step(n,{type:'market_day'});assert.ok(getActionAvailability(s,{type:'desk_sell',id,bps:10000}).allowed);
 const value=s.positions[0].value,cash=s.cash;s=step(s,{type:'desk_sell',id,bps:10000});assert.equal(s.cash,cash+value-Math.round(value*.01));
});
test('recurring fund keeps next-day redemption, while legacy period locks are honored',()=>{
 let s=step(adult(),{type:'desk_order',product:'fund',instrument:'balanced',amount:100000,recurring:true});const r=advanceTurn(s);assert.equal(r.result.error,undefined);s=r.state;
 assert.equal(s.positions.length,2);const p=s.positions.at(-1);assert.equal(p.availableDay,s.trading.day+1);assert.deepEqual(save(s),s);
 const old=adult();old.marketProgress.unlocked.fund=true;const legacy=step(old,{type:'invest',product:'fund',amount:100000});assert.equal(legacy.positions[0].lockUntilTurn,legacy.turn+1);assert.match(getActionAvailability(legacy,{type:'sell',id:legacy.positions[0].id}).reason,/回合/);
});
test('each visible market has a concise route, settlement timing and cost; order previews agree with chosen product',()=>{
 const s=adult();Object.assign(s.flags,{crypto_aware:true,ponzi_exposed:true,gambling_exposed:true});s.cash=300000000;
 for(const [k] of visibleMarkets(s)){const html=renderDesk(s,k,null,'spot',ctx);assert.match(html,/desk-play-summary/);assert.ok(!html.includes('undefined'),k);assert.ok(!html.includes('投资经验'));assert.ok(infoContent('market:'+k,s,products,ctx).body.length>0);}
 assert.match(renderOrderOutcome(s,{product:'bond',instrument:'industrial',amount:1000000},ctx),/¥600.00/);
 assert.match(renderOrderOutcome(s,{product:'housing',instrument:'suburb',amount:30000000,financed:true},ctx),/¥700000.00/);
 assert.match(renderOrderOutcome(s,{product:'option',amount:100000,direction:'short',strikeRatio:1,duration:3},ctx),/回本价/);
});
