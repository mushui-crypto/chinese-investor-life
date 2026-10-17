import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlayableRun} from '../src/game/quick-start.js';
import {applyAction,PRODUCTS,getActionAvailability} from '../src/game/core.js';
import {instruments,quoteFor} from '../src/game/market-play.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),characters:read('characters'),history:read('history'),endings:read('endings')};setSaveCatalog(catalog);
function adult(){const s=createPlayableRun({seed:'metals',familyId:'F08',startAt:'adult'},catalog);Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:100000000});s.marketProgress.unlocked.futures=true;return s;}
function step(s,a){const r=applyAction(s,a);assert.equal(r.result.error,undefined);return r.state;}
const order=(instrument,direction,leverage=5)=>({type:'desk_order',product:'futures',instrument,direction,leverage,amount:1000000});
for(const metal of ['GOLD','SILVER'])test(`${metal}: long and short share quotes, fees, margin, exit and save rules`,()=>{
 assert.ok(instruments('futures').some(i=>i.id===metal));
 let s=adult();s=step(s,order(metal,'long'));s=step(s,order(metal,'short'));
 const initial=quoteFor(s,'futures',metal).price;s=step(s,{type:'market_tick'});
 const [long,short]=s.positions;
 assert.equal(long.lastPrice,short.lastPrice);assert.notEqual(long.lastPrice,initial);
 assert.equal(long.value+short.value,long.margin+short.margin-long.feesPaid-short.feesPaid);
 const units=long.units;s=step(s,{type:'desk_manage',id:long.id,operation:'margin',amount:100000});
 assert.equal(s.positions[0].units,units);assert.equal(s.positions[0].margin,1100000);
 assert.deepEqual(decodeSave(encodeSave(s)),s);
 const cash=s.cash;s=step(s,{type:'desk_sell',id:long.id,bps:10000});
 assert.ok(s.cash>cash);assert.equal(s.positions.length,1);
 const q=s.trading.quotes[metal];assert.ok(q.daily.length&&q.daily[0].high>=q.daily[0].low);
});
test('precious metals retain access, cash and leverage limits',()=>{
 const s=adult();s.marketProgress.unlocked.futures=false;s.stats.insight=0;
 assert.equal(getActionAvailability(s,order('GOLD','long')).allowed,false);
 s.marketProgress.unlocked.futures=true;
 assert.equal(getActionAvailability(s,order('GOLD','long',1000)).allowed,false);
 s.cash=PRODUCTS.futures.min-1;
 assert.equal(getActionAvailability(s,{...order('SILVER','short'),amount:PRODUCTS.futures.min}).allowed,false);
});
