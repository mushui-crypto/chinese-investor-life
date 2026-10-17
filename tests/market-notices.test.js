import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun} from '../src/game/narrative.js';
import {applyAction,getActionAvailability} from '../src/game/core.js';
import {syncMarketNotices,marketNotice,readMarketNotice,hasMarketNotice,storyMarkets} from '../src/game/market-notices.js';
import {getMarketAccess} from '../src/game/market-access.js';
import {visibleMarkets,marketSwitchOptions} from '../src/ui/market-menu.js';
import {renderMarketList} from '../src/ui/readability.js';
import {setSaveCatalog,encodeSave,decodeSave} from '../src/game/storage.js';
const read=n=>JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const catalog={events:read('events').events,families:read('families'),history:read('history'),endings:read('endings'),characters:read('characters')};setSaveCatalog(catalog);
function fixture(){const s=createRun({seed:'market-notices',familyId:'F01'},catalog);Object.assign(s,{age:19,turn:8,phase:'planning',activeEvent:null,seenEvents:[],eventQueue:[],dueAnchors:[],cash:1000000,giftReceived:true});s.stats.insight=60;return s;}
const ctx={esc:String,money:n=>'¥'+n/100,icon:()=>''};
test('a story introduces a locked market immediately without granting access or allowing orders',()=>{
 const s=fixture();const e=catalog.events.find(e=>e.id==='OPT06');s.activeEvent={eventId:e.id};syncMarketNotices(s,catalog);
 assert.ok(visibleMarkets(s).some(([k])=>k==='option'));assert.equal(getMarketAccess(s,'option').unlocked,false);
 assert.equal(getActionAvailability(s,{type:'desk_order',product:'option',amount:100000,instrument:'stock',direction:'long',duration:1}).allowed,false);
 const html=renderMarketList(s,[['option','期权']],'all',ctx);assert.match(html,/data-market="option"/);assert.match(html,/查看条件/);assert.match(html,/500,000/);assert.match(html,/新市场/);assert.match(marketSwitchOptions('stock',s),/期权交易室 · 待满足条件/);
});
test('legacy resolved stories restore discovery; no need to replay or choose an investment',()=>{
 const s=fixture();s.seenEvents=['HST15','HST16','AGE20U'];syncMarketNotices(s,catalog);
 for(const key of ['futures','option','gambling'])assert.equal(marketNotice(s,key),'新市场');
 assert.equal(getMarketAccess(s,'futures').unlocked,false);assert.equal(s.cash,1000000);
 assert.ok(storyMarkets(catalog.events.find(e=>e.id==='HST15')).includes('futures'));
});
test('reading one market clears only that notice, and repeated refresh does not recreate it',()=>{
 const s=fixture();s.seenEvents=['HST15','HST16'];syncMarketNotices(s,catalog);readMarketNotice(s,'option_short');assert.equal(marketNotice(s,'option'),'');assert.equal(marketNotice(s,'futures'),'新市场');
 assert.equal(syncMarketNotices(s,catalog),false);assert.ok(hasMarketNotice(s));readMarketNotice(s,'futures');for(const k of Object.keys(s.marketNotices.unread))readMarketNotice(s,k);assert.equal(hasMarketNotice(s),false);
 const copy=decodeSave(encodeSave(s));assert.deepEqual(copy.marketNotices,s.marketNotices);syncMarketNotices(copy,catalog);assert.equal(hasMarketNotice(copy),false);
});
test('unheld quotes, opening an order and partial selling do not count as a holding price update',()=>{
 let s=fixture();s.flags.crypto_aware=true;syncMarketNotices(s,catalog);readMarketNotice(s,'crypto');s.markets.BTCUSDT=120000;syncMarketNotices(s,catalog);assert.equal(marketNotice(s,'crypto'),'');
 const r=applyAction(s,{type:'desk_order',product:'crypto',instrument:'BTCUSDT',amount:100000});assert.equal(r.result.error,undefined);s=r.state;syncMarketNotices(s,catalog);assert.equal(marketNotice(s,'crypto'),'');
 const sale=applyAction(s,{type:'desk_sell',id:s.positions[0].id,bps:5000});assert.equal(sale.result.error,undefined);s=sale.state;syncMarketNotices(s,catalog);assert.equal(marketNotice(s,'crypto'),'');
 s.positions[0].lastPrice+=100;s.positions[0].value+=100;syncMarketNotices(s,catalog);assert.equal(marketNotice(s,'crypto'),'持仓行情有变化');
 const seed=s.rngState,cash=s.cash;readMarketNotice(s,'crypto');syncMarketNotices(s,catalog);assert.equal(marketNotice(s,'crypto'),'');assert.equal(s.rngState,seed);assert.equal(s.cash,cash);
 s.positions[0].lastPrice-=200;syncMarketNotices(s,catalog);assert.equal(marketNotice(s,'crypto'),'持仓行情有变化');
});
test('new optional notification save data rejects malformed values',()=>{
 const s=fixture();syncMarketNotices(s,catalog);s.marketNotices.unread.unknown={introduced:true};assert.throws(()=>decodeSave(encodeSave(s)),/市场提醒/);
});

test('option time decay at unchanged underlying price and automatic liquidation also notify',()=>{
 const s=fixture();s.positions=[{id:'test-position',kind:'option',lastPrice:10000,value:100000,cost:100000}];syncMarketNotices(s,catalog);readMarketNotice(s,'option');
 s.positions[0].value=90000;syncMarketNotices(s,catalog);assert.equal(marketNotice(s,'option'),'持仓行情有变化');readMarketNotice(s,'option');
 s.positions=[];s.ledger.push({positionId:'test-position',account:'position',amount:-90000,label:'期权交易日到期结算'});syncMarketNotices(s,catalog);assert.equal(marketNotice(s,'option'),'持仓行情有变化');readMarketNotice(s,'option');syncMarketNotices(s,catalog);assert.equal(marketNotice(s,'option'),'');
});
