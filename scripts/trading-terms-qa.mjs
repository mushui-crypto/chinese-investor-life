import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {resetGameCalendar} from '../src/game/game-calendar.js';
import {PRODUCTS} from '../src/game/core.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.39/trading',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(name,x)=>{assert.ok(x,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click(),state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function adult(){const s=createPlayableRun({seed:'term-qa',familyId:'F01',startAt:'adult'},catalog);Object.assign(s,{age:18.5,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash:1e9,monthlyIncome:0,occupation:'待业青年'});s.positions=[];s.debts=[];s.behavior.pending=null;s.lifeArcs.pending=null;s.stats.insight=40;s.marketProgress={firstExperienceAge:s.age-.5,simulations:1,unlocked:Object.fromEntries(Object.keys(PRODUCTS).filter(k=>!k.startsWith('option')).map(k=>[k,true]))};resetGameCalendar(s);ensureRoutine(s);resetRoutineDay(s,1);return s;}
async function load(s=adult()){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=market]');}
async function choose(name,label){await page.locator(`#desk-order [name=${name}]`).locator('..').locator('.game-select-trigger').click();await page.getByRole('option',{name:label,exact:true}).click();}
async function open(product,mode){await click(`[data-action=invest][data-product=${product==='option_short'?'option':product}]`);if(product==='option_short')await click('.option-sides [data-product=option_short]');if(mode)await click(`[data-action=crypto-mode][data-mode=${mode}]`);}
async function shot(name){await page.locator('#toast.show').waitFor({state:'hidden'});await page.screenshot({path:`${dir}/${name}.png`});}
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});
  const locked=adult();locked.stats.insight=39;await load(locked);check('single option access list '+width,await page.locator('.market-row[data-market=option] .market-access-heading').count()===1);await open('option');check('buyer locked below common threshold '+width,await page.locator('.desk-locked').count()===1&&await page.locator('#desk-order [type=submit]').isDisabled());await click('.option-sides [data-product=option_short]');check('seller shares lock reason '+width,(await page.locator('.desk-locked').innerText()).includes('眼力见需 40 点'));
  const ready=adult();ready.cash=50000000;await load(ready);await open('option');check('buyer unlocked at shared threshold '+width,await page.locator('.desk-locked').count()===0&&await page.locator('#desk-order [type=submit]').isEnabled());await click('.option-sides [data-product=option_short]');check('seller unlocked at same threshold '+width,await page.locator('.desk-locked').count()===0&&await page.locator('#desk-order [type=submit]').isEnabled());
  // Exact UI strings are intentional acceptance criteria: direction and settlement labels must agree.
  const cases=[['stock',null,'买入','全部卖出','卖出'],['fund',null,'申购','全部赎回','赎回'],['bond',null,'买入','全部卖出','卖出'],['option',null,'买入开仓','全部卖出平仓','卖出平仓'],['option_short',null,'卖出开仓','全部买入平仓','买入平仓'],['futures',null,'做空开仓','全部平仓','平仓'],['crypto','spot','买入','全部卖出','卖出'],['crypto','perp','做空开仓','全部平仓','平仓'],['crypto','meme','买入','全部卖出','卖出'],['angel',null,'认购股权','全部转让','转让股权'],['housing',null,'购买房产','出售房产','出售房产'],['ponzi',null,'投入','申请提现','申请提现']];
  for(const [product,mode,opening,closing,assetLabel] of cases){
   const tag=product+(mode?'-'+mode:'')+'-'+width;await load();await open(product,mode);
   if(['futures','option','option_short'].includes(product)||mode==='perp')await choose('direction',product.startsWith('option')?'认沽期权':'做空');
   if(product==='stock')await page.locator('#desk-order [name=lots]').fill('2');
   check('standard order label '+tag,(await page.locator('#desk-order [type=submit]').innerText()).includes(opening));
   check('no betting metaphor in trading panel '+tag,!/押涨|押跌|押对|押错|买涨|买跌|押了|安排这一笔|确认这一笔/.test(await page.locator('.market-desk').innerText()));
   check('form fits '+tag,await page.locator('#desk-order').evaluate(e=>e.scrollWidth<=e.clientWidth+1)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const before=await state();await click('#desk-order [type=submit]');const after=await state();check('order executes expected product '+tag,after.positions.length===1&&after.cash<before.cash&&after.positions[0].kind===(mode==='perp'?'crypto_perp':product));
   if(product.startsWith('option')){check('option type and both permissions retained '+tag,after.positions[0].direction==='short'&&after.marketProgress.unlocked.option&&after.marketProgress.unlocked.option_short);check('option holding identifies its side '+tag,(await page.locator('.desk-position-row').innerText()).includes(product==='option'?'买入认沽期权':'卖出认沽期权'));}
   const close=page.locator('.position-actions button').filter({hasText:new RegExp('^'+closing+'$')});check('holding exit label '+tag,await close.count()===1);
   const isClosable=await close.isEnabled();await click('.bottom-nav [data-tab=assets]');check('asset ledger agrees on exit '+tag,(await page.locator('.holding [data-action=sell]').first().innerText())===assetLabel);
   await click('.holding [data-action=desk-open]');
   if(isClosable&&['option','option_short','futures'].includes(product)||isClosable&&product==='crypto'&&mode!=='meme'){
    if(['futures'].includes(product)||mode==='perp'){const half=page.locator('.position-actions button').filter({hasText:/^平仓一半$/});await half.click();const partial=await state();check('partial close reports correct action '+tag,partial.positions.length===1&&partial.lastResult.text.includes('平仓一半'));}
    await page.locator('.position-actions button').filter({hasText:new RegExp('^'+closing+'$')}).click();check('close reports matching transaction '+tag,(await state()).positions.length===0&&(await state()).lastResult.text.includes(assetLabel));
   }
   if(['option_short','futures'].includes(product)||mode==='perp')await shot(tag);
  }
  for(const side of ['option','option_short']){const legacy=adult();legacy.cash=100000;legacy.stats.insight=0;legacy.marketProgress={firstExperienceAge:null,simulations:0,unlocked:{[side]:true}};await load(legacy);await open('option');check('legacy '+side+' unlocks buyer '+width,await page.locator('.desk-locked').count()===0);await click('.option-sides [data-product=option_short]');check('legacy '+side+' unlocks seller but cash still required '+width,await page.locator('.desk-locked').count()===0&&await page.locator('#desk-order [type=submit]').isDisabled()&&(await page.locator('.form-error').innerText()).includes('现金不足'));}
 }
 check('no runtime errors',errors.length===0);await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(e){await page.screenshot({path:dir+'/FAILURE.png'});await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors,error:e.stack},null,2));throw e;}finally{await browser.close();}
