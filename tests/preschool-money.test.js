import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState,advanceTurn,applyAction,getMetrics} from '../src/game/core.js';
import {createRun,chooseEvent,eligibleChoices,continueStory,nextTurn} from '../src/game/narrative.js';
import {decodeSave,encodeSave,setSaveCatalog} from '../src/game/storage.js';

const catalog={};
for(const key of ['events','families','characters','history','endings']){
  const data=JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)));
  catalog[key]=key==='events'?data.events:data;
}
setSaveCatalog(catalog);
const reload=s=>decodeSave(encodeSave(s));
function ok(out){assert.equal(out.result.error,undefined,out.result.error);return out.state;}

test('every family receives 200 per eligible month and pays personal expenses before saving',()=>{
  for(const family of catalog.families){
    let s=createState({family,seed:'preschool-boundary'});
    const reserve=s.familyReserve,gift=s.adultGift;
    for(const age of [3,6,10,12,13,14,15,16,17,18]){
      s=ok(advanceTurn(s));assert.equal(s.age,age);
      assert.equal(s.familyReserve,reserve);
      assert.equal(s.cash,s.ledger.filter(e=>e.account==='cash').reduce((n,e)=>n+e.amount,0));
      if(age<6)assert.equal(s.cash,0);
      if(age===6)assert.ok(s.cash>=2000&&s.cash<=8000);
    }
    const income=s.ledger.filter(e=>e.label==='成长阶段零花钱').reduce((n,e)=>n+e.amount,0);
    const spent=-s.ledger.filter(e=>e.label==='童年日常花销').reduce((n,e)=>n+e.amount,0);
    assert.equal(income,200*12*12*100);
    assert.ok(spent>0&&spent<income);assert.equal(s.cash,gift+income-spent);
    assert.equal(s.ledger.filter(e=>e.label==='成年一次性赠与').length,1);
    assert.equal(s.childhood.allowanceThroughMonth,215);
  }
});

test('stage playable stories and save/load reach six without any earlier allowance',()=>{
  for(const family of catalog.families){
    let s=createRun({familyId:family.id,seed:'preschool-story'},catalog),steps=0;
    while(s.age<6){
      assert.equal(s.cash,0);
      assert.deepEqual(reload(s),s);
      if(s.phase==='event'){
        const event=catalog.events.find(e=>e.id===s.activeEvent.eventId);
        const choice=eligibleChoices(s,event).find(c=>!c.disabled);
        assert.ok(choice,event.id);s=chooseEvent(s,event.id,choice.id,catalog);
      }else if(s.phase==='result')s=continueStory(s,catalog);
      else s=nextTurn(s,catalog);
      assert.ok(!s.lastResult?.error,s.lastResult?.error);assert.ok(++steps<80);
    }
    assert.equal(s.age,6);assert.ok(s.cash>0);assert.deepEqual(reload(s),s);
    assert.equal(s.ledger.filter(e=>e.label==='成长阶段零花钱').length,1);
  }
});

test('legacy preschool cash moves to family custody once, keeping stories, RNG and total funds',()=>{
  const old=createRun({familyId:'F01',seed:'legacy-preschool'},catalog);
  old.age=1;old.cash=12395;old.ledger.push({id:'legacy-pocket',age:1,turn:0,account:'cash',amount:12395,label:'成长阶段零花钱'});
  const envelope=encodeSave(old),s=decodeSave(envelope);
  assert.equal(s.cash,0);assert.equal(s.familyReserve,old.familyReserve+12395);
  assert.equal(getMetrics(s).assets,0);assert.equal(s.familyReserve+s.cash,old.familyReserve+old.cash);
  for(const key of ['rng','activeEvent','stats','storyHistory','appliedEffectIds','adultGift','giftReceived'])assert.deepEqual(s[key],old[key]);
  assert.equal(s.ledger.reduce((sum,e)=>sum+(e.account==='cash'?e.amount:0),0),0);
  assert.equal(s.logs.at(-1).title,'这笔钱由家长保管');
  assert.deepEqual(reload(reload(s)),s);assert.equal(envelope.state.cash,12395);
});

test('preschool migration rejects overflow and preserves already school-age or adult money',()=>{
  const old=createRun({seed:'money-age'},catalog);old.cash=12395;
  for(const age of [6,12,18]){
    const s=structuredClone(old);s.age=age;
    assert.deepEqual(reload(s),s);
  }
  old.familyReserve=Number.MAX_SAFE_INTEGER;
  assert.throws(()=>reload(old),/家长保管资金/);
});

test('zero preschool cash keeps free activities usable and cannot be replaced by a family loan',()=>{
  for(const type of ['study','rest','social']){
    const s=createState({family:catalog.families[0],seed:type});s.age=3;
    const next=ok(applyAction(s,{type}));assert.equal(next.cash,0);assert.equal(next.actionPoints,1);
    const borrow=applyAction(s,{type:'borrow',kind:'family',amount:10000});
    assert.ok(borrow.result.error);assert.equal(borrow.state,s);
  }
});
