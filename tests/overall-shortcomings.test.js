import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createPlayableRun} from '../src/game/quick-start.js';
import {createRun} from '../src/game/narrative.js';
import {applyAction,getMetrics,getActionAvailability,PRODUCTS} from '../src/game/core.js';
import {STOCKS} from '../src/game/stock-markets.js';
import {disclosureMove,upbringing,visibleLifeDay} from '../src/game/market-intelligence.js';
import {encodeSave,decodeSave,setSaveCatalog,updateCollection,getCollection,savePlaytest} from '../src/game/storage.js';
import {renderContractRisk} from '../src/ui/market-information.js';
import {receiptSummary} from '../src/ui/play-guide-panel.js';
import {timePreview} from '../src/game/play-guide.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
function adult(seed='intelligence',path=null){let s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:20000000,monthlyIncome:0,giftReceived:true});s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};if(path)s.childhood.summary={path,cash:s.cash,gift:0,purchases:0,receipts:0,skill:s.stats.skill,insight:s.stats.insight,trust:s.stats.trust};return s;}
const step=(s,a)=>{const r=applyAction(s,a);assert.equal(r.result.error,undefined,r.result.error);return r.state;};
const tick=s=>step(s,{type:'market_tick'});
const roundTrip=s=>decodeSave(encodeSave(s));
const ctx={esc:String,money:n=>'¥'+(n/100).toFixed(2),button:(label,a)=>label+JSON.stringify(a)};

test('216 complete childhood openings leave adult learning room across families and directions',()=>{
 const rows=[];for(let seed=0;seed<6;seed++)for(const family of catalog.families)for(const path of ['study','practical','social']){const s=createPlayableRun({seed:'growth-'+seed,familyId:family.id,startAt:'adult',childhood:path},catalog);assert.equal(s.age,18);assert.equal(upbringing(s),path);assert.ok(s.stats.skill<90);assert.ok(s.stats.insight<90);assert.ok(s.stats.stress<80);assert.ok(s.stats.trust<90);assert.ok(s.giftReceived);assert.deepEqual(roundTrip(s),s);rows.push({seed,family:family.id,path,cash:s.cash,...s.stats});}
 assert.ok(new Set(rows.map(r=>r.cash)).size>30);assert.ok(new Set(rows.map(r=>r.skill)).size>8);assert.ok(new Set(rows.map(r=>r.insight)).size>5);
 mkdirSync('reports/v1.13',{recursive:true});writeFileSync('reports/v1.13/growth-sample.json',JSON.stringify(rows,null,2));
});
test('legacy adults retain capped stats and cash; new adults can keep learning',()=>{const s=adult();s.stats.skill=100;s.stats.insight=100;s.stats.stress=100;const loaded=roundTrip(s);assert.deepEqual(loaded.stats,s.stats);assert.equal(loaded.cash,s.cash);assert.equal(upbringing(loaded),null);const young=adult();young.stats.skill=60;young.stats.insight=42;const next=step(young,{type:'study'});assert.equal(next.stats.skill,64);assert.equal(next.stats.insight,45);});
test('stock investigation is retired for every source and upbringing without consuming anything',()=>{
 for(const path of [null,'study','practical','social'])for(const source of [undefined,'orders','cash','contacts']){
  const s=adult('retired-research',path),before=structuredClone(s);s.relationships.N07=100;before.relationships.N07=100;
  const a={type:'desk_research',product:'stock',instrument:STOCKS[0].id,source};assert.match(getActionAvailability(s,a).reason,/已移除/);
  const r=applyAction(s,a);assert.match(r.result.error,/已移除/);assert.strictEqual(r.state,s);assert.deepEqual(s,before);
 }
});
test('research remains available for other markets',()=>{
 for(const [product,instrument] of [['fund','balanced'],['bond','solid'],['angel','robot'],['ponzi','all']]){
  const s=adult(),r=step(s,{type:'desk_research',product,instrument});assert.equal(r.trading.energy,['angel','ponzi'].includes(product)?s.trading.energy:s.trading.energy-1);assert.equal(r.cash,s.cash);assert.equal(r.rng,s.rng);assert.deepEqual(roundTrip(r),r);
 }
});
test('legacy stock reports reload without adding new review records or changing prices',()=>{
 const plain=adult(),s=structuredClone(plain);s.trading.research['stock:chip:orders']=s.trading.day;
 s.trading.disclosures=[{day:s.trading.day,id:'chip',expected:1,actual:2,cash:50,before:1000,after:1002,sources:['orders']}];
 const old=roundTrip(s);assert.deepEqual(old,s);const actual=tick(tick(old)),baseline=tick(tick(plain));
 assert.deepEqual(actual.trading.quotes,baseline.trading.quotes);assert.equal(actual.rng,baseline.rng);assert.deepEqual(actual.trading.disclosures,s.trading.disclosures);assert.deepEqual(baseline.trading.disclosures,[]);
});

test('passive company news retains bounded positive and negative price effects',()=>{
 let up=0,down=0;for(let i=0;i<80;i++){const s=tick(tick(adult('disclosure-'+i))),m=disclosureMove(s,STOCKS[0].id);assert.ok(Math.abs(m)<=.065);if(m>0)up++;if(m<0)down++;assert.deepEqual(s.trading.disclosures,[]);s.trading.phase=1;assert.equal(disclosureMove(s,STOCKS[0].id),0);}
 assert.ok(up>15&&down>15);
});

test('practical upbringing retains its once-per-period work bonus',()=>{
 const s=adult('same','practical'),plain=adult('same','study');let a=step(s,{type:'work'}),b=step(plain,{type:'work'});const pay=b.cash-plain.cash;assert.equal(a.cash-s.cash,pay+Math.round(pay*.1));assert.equal(roundTrip(a).childhood.workBonusTurn,s.turn);a=step(a,{type:'calendar_day'});b=step(b,{type:'calendar_day'});a=step(a,{type:'market_day'});b=step(b,{type:'market_day'});const nextA=step(a,{type:'gig'}),nextB=step(b,{type:'gig'});assert.equal(nextA.cash-a.cash,nextB.cash-b.cash);
});
test('contract risk preview matches current margin and funding fee rules',()=>{for(const leverage of [10,25,50,100]){const html=renderContractRisk({product:'crypto_perp',amount:100000,leverage,direction:'long'},ctx);assert.ok(html.includes('预计盈利'));assert.ok(html.includes('逐仓最多亏损本单保证金'));assert.ok(!html.includes('保证金的 300%'));assert.ok(html.includes((100/leverage-.5-.02).toFixed(2)+'%'));}assert.equal(renderContractRisk({product:'stock',amount:100000},ctx),'');});
test('read-only time estimate tracks billed days without charging them again',()=>{const s=adult(),p=timePreview(s),before=structuredClone(s);assert.equal(p.days,180);assert.deepEqual(s,before);const after=tick(tick(tick(s))),later=timePreview(after);assert.equal(visibleLifeDay(after),1);assert.equal(visibleLifeDay(step(after,{type:'market_day'})),2);assert.equal(later.days,179);assert.equal(later.living,p.living-after.survival.livingAccrued);assert.equal(after.cash,s.cash-after.survival.last.paid);});
test('disclosure and upbringing metadata reject damaged values on save import',()=>{const s=tick(tick(adult('validation','study')));s.trading.disclosures=[{day:s.trading.day,id:'chip',expected:1,actual:2,cash:50,before:1000,after:1002,sources:['orders']}];assert.deepEqual(roundTrip(s),s);for(const change of [n=>n.trading.disclosures[0].before=0,n=>n.trading.disclosures[0].sources=['oracle'],n=>n.childhood.summary.path='oracle',n=>n.childhood.workBonusTurn=n.turn+1]){const n=structuredClone(s);change(n);assert.throws(()=>encodeSave(n));}});
test('cross-run comparisons use actual endings, deduplicate resumed lives and keep self reports explicit',()=>{
 const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const s=adult('compare','study');updateCollection(s);assert.equal(getCollection().completedRuns.length,0);s.ending=catalog.endings[0];updateCollection(s);updateCollection(s);assert.equal(getCollection().completedRuns.length,1);s.familyId='F02';s.familyName='second';updateCollection(s);assert.equal(getCollection().completedRuns.length,2);savePlaytest(s,{firstTrade:'1–3 分钟',recovery:'本次还没遇到亏损',replay:'还没决定',note:'只存本机'});assert.equal(getCollection().playtests[0].source,'player-reported');assert.throws(()=>savePlaytest(s,{firstTrade:'invented'}));delete globalThis.localStorage;
});

test('old stock research receipts stay hidden without mutating the saved result',()=>{
 const s=adult();for(const action of ['stock_card','desk_research'])for(const text of ['订单抽样：旧记录','回款核查：旧记录','供应商访谈：旧记录']){
  s.journey.lastAction=action;s.lastResult={text,changes:[]};const before=structuredClone(s);assert.equal(receiptSummary(s),null);assert.deepEqual(s,before);
 }
 s.lastResult.text='林间均衡的资料：经理分散配置';assert.ok(receiptSummary(s));s.journey.lastAction='desk_sell';s.lastResult.text='卖出股票，现金到账';assert.ok(receiptSummary(s));
});
