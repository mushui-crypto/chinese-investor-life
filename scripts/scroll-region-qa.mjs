import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun} from '../src/game/narrative.js';
import {createPlayableRun} from '../src/game/quick-start.js';
import {skipBirth} from '../src/game/childhood.js';
import {PRODUCTS} from '../src/game/core.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const out=process.env.QA_REPORT_DIR||'reports/v1.30/scroll',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click();
function adult(){const s=createRun({seed:'pane-30',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:500000000,monthlyIncome:0,giftReceived:true});s.stats.insight=90;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(d=>d.open))await click('#game-dialog [data-action=close-dialog]');}
const geom=()=>page.evaluate(()=>{const rect=q=>{const e=document.querySelector(q);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom,right:r.right,height:r.height};};return {y:scrollY,body:document.documentElement.scrollHeight,h:innerHeight,width:document.documentElement.scrollWidth,w:innerWidth,scroll:document.querySelector('.game-scroll')?.scrollTop,region:rect('.game-scroll'),header:rect('.player-header'),rail:rect('.status-rail'),nav:rect('.bottom-nav'),right:rect('.arrangement-panel'),profile:rect('.player-profile'),tools:rect('.header-tools')};});
async function wheel(){const r=await page.locator('.game-scroll').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.wheel(0,500);await page.waitForFunction(()=>document.querySelector('.game-scroll').scrollTop>0);}
async function shot(name){await page.screenshot({path:`${out}/${name}.png`});}
async function atTop(){await page.locator('.game-scroll').evaluate(e=>e.scrollTop=0);}
async function focusFits(){return page.evaluate(()=>{const r=document.activeElement.getBoundingClientRect(),box=document.querySelector('.game-scroll').getBoundingClientRect(),bar=document.querySelector('.desk-quickbar').getBoundingClientRect();return r.top>=Math.max(box.top,bar.bottom)&&r.bottom<=box.bottom&&scrollY===0;});}
try{
 for(const [width,height] of [[1920,1080],[1440,1000],[1024,768],[768,900],[390,844],[320,640]]){
  await page.setViewportSize({width,height});await load(adult());const before=await geom();if(width===1440)await shot('market-top');await wheel();const after=await geom();if(width===1440)await shot('market-scrolled');
  check(`wheel moves only content ${width}`,after.scroll>0&&after.y===0&&after.body===height);
  check(`header navigation and rail stay still ${width}`,['header','nav','rail'].every(k=>JSON.stringify(before[k])===JSON.stringify(after[k])));
  check(`content clears header and nav ${width}`,[after.profile,after.tools].every(r=>after.region.x>=r.right||after.region.right<=r.x||after.region.y>=r.bottom-1)&&after.region.bottom<=after.nav.y-10&&after.width===width);
  await page.locator('.game-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);const last=page.locator('.market-row').last();
  if(await last.count())check(`last market reachable ${width}`,await last.evaluate(e=>{const r=e.getBoundingClientRect(),s=e.closest('.game-scroll').getBoundingClientRect();return r.bottom<=s.bottom&&r.bottom>s.top;}));
  const bottom=await geom();await page.mouse.wheel(0,3000);await page.keyboard.press('End');check(`end does not scroll body ${width}`,(await geom()).y===0);
  await atTop();await click('[data-action=invest][data-product=stock]');await click('.desk-quickbar [data-area=order]');check(`stock order jump clears sticky bar ${width}`,await focusFits());
  await page.keyboard.press('Tab');check(`keyboard stays inside content ${width}`,await focusFits());
  await click('[data-action=desk-back]');check(`market back starts at top ${width}`,(await geom()).scroll===0);
  await click('[data-action=invest][data-product=crypto]');await click('.desk-quickbar [data-area=order]');check(`crypto order jump clears sticky bar ${width}`,await focusFits());
  await click('.desk-quickbar [data-area=holdings]');check(`holdings jump keeps body fixed ${width}`,(await geom()).y===0);
  if(width===1440||width===390)await shot('crypto-holdings-'+width);
 }
 await page.setViewportSize({width:1440,height:1000});await load(adult());await wheel();const watch=page.locator('.market-row [data-action=toggle-watch]').nth(4);await watch.scrollIntoViewIfNeeded();const previous=await geom();await watch.click();
 check('watch rerender preserves content position',Math.abs((await geom()).scroll-previous.scroll)<2);
 await page.setViewportSize({width:1440,height:600});await click('.bottom-nav [data-tab=life]');check('page switch starts at top',(await geom()).scroll===0);await load(skipBirth(createPlayableRun({seed:'pane-sidebar',familyId:'F01',startAt:'birth'},catalog),catalog));const right=await geom();await wheel();check('right arrangements stay fixed',JSON.stringify(right.right)===JSON.stringify((await geom()).right));
 await page.setViewportSize({width:1440,height:1000});await load(adult());await click('.bottom-nav [data-tab=market]');await click('[data-action=invest][data-product=crypto]');await click('.desk-quickbar [data-area=order]');
 const amount=page.locator('#desk-order [name=amount]');await amount.fill('1000');const screenBefore=await amount.boundingBox();await click('#desk-order [type=submit]');
 check('inline buy keeps draft and screen position',(await amount.inputValue())==='1000'&&Math.abs((await amount.boundingBox()).y-screenBefore.y)<3&&(await geom()).y===0);
 await click('.desk-quickbar [data-info=desk-life]');check('help is not clipped by content scroller',await page.locator('#game-info').isVisible());await wheel();await page.waitForFunction(()=>!document.querySelector('#game-info'));check('scroll dismisses detached help',await page.locator('#game-info').count()===0);
 const child=skipBirth(createPlayableRun({seed:'pane-child',familyId:'F01',startAt:'birth'},catalog),catalog);await load(child);await page.locator('.choice:last-child').click();check('story choice still opens result',await page.locator('.story-panel [data-action=continue]').count()>0);await click('.story-panel [data-action=continue]');check('next story focuses in content',await page.locator('.story-panel h2').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('.game-scroll').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;}));await shot('child-desktop');
 await click('[data-action=settings]');await click('[data-action=home]');check('title screen releases scroll lock',await page.evaluate(()=>!document.documentElement.classList.contains('game-active')));
 await load(createPlayableRun({seed:'pane-birth',familyId:'F01',startAt:'birth'},catalog));check('birth remains a normal reading page',await page.locator('.birth-stage').count()===1&&await page.evaluate(()=>!document.documentElement.classList.contains('game-active')));
 check('no runtime errors',errors.length===0);await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,errors,url},null,2));
}catch(e){await shot('FAILURE');await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,errors,error:e.stack,url},null,2));console.error(e);process.exitCode=1;}finally{await browser.close();}
