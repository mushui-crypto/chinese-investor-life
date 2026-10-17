import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun} from '../src/game/narrative.js';
import {PRODUCTS} from '../src/game/core.js';
import {setSaveCatalog,encodeSave} from '../src/game/storage.js';
import {chooseGameOption} from './game-control-helpers.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${n}.json`));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.33/receipt-rail/trading-chrome',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1500,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const click=q=>page.locator(q+':visible').first().click(),current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
function adult(){const s=createRun({seed:'trading-chrome-qa',familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000,monthlyIncome:800000,giftReceived:true});s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};s.stats.insight=90;return s;}
async function load(s){await page.goto(url);await page.locator('#app button').first().waitFor();await page.evaluate(save=>{localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));localStorage.setItem('cng-v1-active-slot','0');sessionStorage.removeItem('cng-trade-mail-read');},encodeSave(s));await page.reload();await click('[data-action=load-slot]');await click('[data-action=tab][data-tab=market]');}
async function open(kind){if(kind==='option_short'){await open('option');await click('[data-action=option-side][data-product=option_short]');return;}if(await page.locator('#desk-switch').count()&&await page.locator('#desk-switch').locator('..').locator('.game-select-trigger').isVisible())await chooseGameOption(page,'#desk-switch',kind);else {if(await page.locator('.market-desk').count())await click('[data-action=desk-back]');await click(`[data-action=invest][data-product=${kind}]`);}}
async function shot(name){await page.locator('#toast.show').waitFor({state:'detached',timeout:5000});await page.screenshot({path:`${dir}/${name}.png`,animations:'disabled'});}
const bounds=()=>page.evaluate(()=>{const b=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};return {toolbar:b('.trade-toolbar'),pane:b('.game-scroll'),header:b('.player-header'),nav:b('.bottom-nav'),window:scrollY,scroll:document.querySelector('.game-scroll').scrollTop};});
try{
 await load(adult());await open('stock');
 check('toolbar exists once, outside scrolling content',await page.locator('.trade-toolbar>.desk-quickbar').count()===1&&await page.locator('.game-scroll .desk-quickbar').count()===0);
 check('empty receipt is already open without a mail trigger',await page.locator('.inbox-empty').isVisible()&&await page.locator('[data-action=trade-mail]').count()===0);
 check('receipt occupies the right rail',await page.locator('#trade-inbox').evaluate(e=>{const r=e.getBoundingClientRect(),p=document.querySelector('.game-scroll').getBoundingClientRect();return r.left>=p.right&&innerWidth-r.right===20&&getComputedStyle(e).position==='fixed';}));
 const before=await bounds();await page.mouse.move(1100,560);await page.mouse.wheel(0,800);await page.waitForFunction(()=>document.querySelector('.game-scroll').scrollTop>100);const after=await bounds();
 check('only contents scroll; toolbar stays above them',after.window===0&&after.scroll>before.scroll&&after.toolbar.top===before.toolbar.top&&after.toolbar.bottom<=after.pane.top);
 check('stock outer frame stays on viewport when contents scroll',before.pane.top===after.pane.top&&await page.locator('.stock-scroll-frame').evaluate(e=>{const style=getComputedStyle(e),desk=e.querySelector('.desk-stock');return parseFloat(style.borderTopWidth)===3&&parseFloat(style.borderBottomWidth)===3&&style.borderTopStyle==='solid'&&parseFloat(getComputedStyle(desk).borderTopWidth)===0&&desk.getBoundingClientRect().top<e.getBoundingClientRect().top;}));
 await shot('stock-fixed-frame-scrolled');
 await click('[data-action=desk-jump][data-area=market]');await shot('stock-board-desktop');
 check('stock background is warm paper, chart is deep green',await page.locator('.desk-stock').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(232, 217, 178)')&&await page.locator('.desk-research-pane .daily-chart').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(36, 62, 50)'));
 check('opening chart still contains thirty days',await page.locator('.desk-research-pane .daily-body').count()===30);
 const stateBefore=await current(),price=Number(await page.locator('#desk-order').getAttribute('data-price'));
 await click('[data-action=desk-jump][data-area=order]');await click('#desk-order [type=submit]');
 const bought=await current();check('stock purchase keeps original price and 100-share unit',bought.cash===stateBefore.cash-price*100&&bought.positions.at(-1).shares===100);
 check('receipt updates visibly in the right rail',await page.locator('.inbox-letter .inline-receipt').isVisible()&&await page.locator('.main-stage .inline-receipt').count()===0);
 check('letter shows the completed purchase and cash movement',(await page.locator('.inbox-letter').innerText()).includes('现金')&&(await page.locator('.inbox-letter .receipt-metrics').innerText()).includes('−'));
 check('full receipt is open without details or a close control',await page.locator('#trade-inbox details,#trade-inbox [popover],.inbox-close').count()===0&&await page.locator('.receipt-detail').isVisible());await shot('stock-mail-desktop');
 check('reading mail does not alter save or RNG',JSON.stringify(await current())===JSON.stringify(bought));
 await page.reload();await click('[data-action=load-slot]');await open('stock');check('receipt stays open after reload',await page.locator('.receipt-detail').isVisible());
 await click('[data-action=stock-market][data-id=us_compute]');await click('[data-action=desk-jump][data-area=order]');const secondName=await page.locator('#desk-order [type=submit]').innerText();await click('#desk-order [type=submit]');check('new transaction replaces the visible receipt',(await page.locator('.receipt-detail').innerText()).includes(secondName.replace('买入 ','')));
 await click('[data-action=desk-jump][data-area=holdings]');await shot('stock-holdings-desktop');
 for(const kind of ['fund','bond','option','option_short','futures','crypto','ponzi','angel','housing','gambling']){await open(kind);check(kind+' uses one external toolbar',await page.locator('.trade-toolbar>.desk-quickbar').count()===1&&await page.locator('.game-scroll .desk-quickbar').count()===0);}
 for(const width of [1920,1700,1500,1250,1024,768,390,320]){await page.setViewportSize({width,height:width<=390?700:900});for(const kind of ['stock','crypto','gambling']){
  await open(kind);check(`${kind} has no page overflow at ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
  if(kind==='stock'&&width>=1700){
   const aligned=()=>page.locator('.desk-stock').evaluate(e=>{const r=selector=>e.querySelector(selector).getBoundingClientRect(),box=e.getBoundingClientRect(),list=r('.stock-board'),chart=r('.desk-research-pane .daily-chart'),order=r('#desk-order');return {header:order.top-box.top,aligned:Math.max(list.height,chart.height,order.height)-Math.min(list.height,chart.height,order.height)<2&&Math.max(list.top,chart.top,order.top)-Math.min(list.top,chart.top,order.top)<2};});
   let layout=await aligned();check(`stock header is compact at ${width}px`,layout.header<240);check(`stock list, chart and order align at ${width}px`,layout.aligned);
   await click('[data-action=desk-budget][data-fraction="1"]');
   layout=await aligned();check(`all-in warning preserves equal panels and permits purchase at ${width}px`,layout.aligned&&await page.locator('#desk-order .cash-warning.shortfall').isVisible()&&await page.locator('#desk-order [type=submit]').isEnabled());
   await page.locator('#desk-order [name=lots]').fill('1');
  }
  if(width>=1250)check(`${kind} toolbar starts beside compact profile at ${width}px`,await page.locator('.trade-toolbar').evaluate(e=>{const bar=e.getBoundingClientRect(),profile=document.querySelector('.player-profile').getBoundingClientRect(),tools=document.querySelector('.header-tools').getBoundingClientRect();return Math.abs(bar.top-profile.top)<1&&bar.left>=profile.right+19&&bar.right<=tools.left&&bar.top===20;}));
  const b=await bounds();check(`${kind} toolbar fits above scroll pane at ${width}px`,b.toolbar.left>=0&&b.toolbar.right<=width&&b.toolbar.bottom<=b.pane.top+1&&b.pane.height>180&&Math.abs(b.toolbar.left-b.pane.left)<2&&Math.abs(b.toolbar.right-b.pane.right)<2);
  await click('[data-action=desk-jump][data-area=order]');check(`${kind} order input visible at ${width}px`,await page.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),p=document.querySelector('.game-scroll').getBoundingClientRect();return ['INPUT','SELECT'].includes(e.tagName)&&r.top>=p.top&&r.bottom<=p.bottom;}));
  check(`${kind} frame only applies to stock at ${width}px`,await page.locator('.stock-scroll-frame').count()===(kind==='stock'?1:0));
  await shot(`${kind}-order-${width}`);
 }
 if(width<1250)await page.locator('#trade-inbox').scrollIntoViewIfNeeded();
 check(`receipt remains open at ${width}px`,await page.locator('.receipt-detail').isVisible()&&await page.locator('#trade-inbox details').count()===0);
 check(`receipt fits horizontally at ${width}px`,await page.locator('#trade-inbox').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth+1;}));
 if(width>=1250){
  check(`receipt is outside the market scroll at ${width}px`,await page.locator('#trade-inbox').evaluate(e=>{const r=e.getBoundingClientRect(),p=document.querySelector('.game-scroll').getBoundingClientRect();return r.left>=p.right&&Math.abs(r.top-(document.querySelector('.header-tools').getBoundingClientRect().bottom+20))<=1&&r.bottom<=innerHeight;}));
  const railTop=await page.locator('#trade-inbox').evaluate(e=>e.getBoundingClientRect().top);
  await click('[data-action=desk-jump][data-area=holdings]');check(`scroll keeps right rail fixed at ${width}px`,await page.locator('#trade-inbox').evaluate(e=>e.getBoundingClientRect().top)===railTop);
 }
 await shot(`mail-${width}`);}
 await click('[data-action=tab][data-tab=life]');check('life page has no trading toolbar or receipt rail',await page.locator('.trade-toolbar').count()===0&&await page.locator('#trade-inbox').count()===0);
 check('no browser errors',errors.length===0);await writeFile(`${dir}/checks.json`,JSON.stringify({passed:true,checks,errors},null,2));
}catch(e){await page.screenshot({path:`${dir}/failure.png`});await writeFile(`${dir}/checks.json`,JSON.stringify({passed:false,checks,errors,error:String(e)},null,2));throw e;}finally{await browser.close();}
