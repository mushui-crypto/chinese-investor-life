import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {skipBirth} from '../src/game/childhood.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${n}.json`));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
const child=skipBirth(createPlayableRun({seed:'story-read',familyId:'F01',startAt:'birth'},catalog),catalog);
const out=process.env.QA_REPORT_DIR||'reports/v1.27/story-reading',url=process.env.GAME_URL||'http://127.0.0.1:4173';await mkdir(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.env.HOME+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[],measurements=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name)};
const click=s=>page.locator(s+':visible').first().click();
async function decode(){await page.locator('.event-illustration img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));}
try{
 for(const width of [1920,1440,1024,768,390,320]){
  await page.setViewportSize({width,height:width>700?1000:844});await page.goto(url);await page.locator('[data-action=new-game]').waitFor();
  await page.evaluate(s=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(s))},encodeSave(child));await page.reload();
  let release;const gate=new Promise(resolve=>{release=resolve;});await page.route('**/assets/events/*.webp',async route=>{await gate;await route.continue();});
  await click('[data-action=load-slot]');
  const pending=await page.locator('.event-illustration img').evaluate(i=>({width:i.clientWidth,height:i.clientHeight,complete:i.complete}));
  check('slow image has reserved space '+width,!pending.complete&&pending.height>0);
  release();await decode();await page.unroute('**/assets/events/*.webp');
  const loaded=await page.locator('.event-illustration img').evaluate(i=>({width:i.clientWidth,height:i.clientHeight,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,fit:getComputedStyle(i).objectFit,frameWidth:i.parentElement.getBoundingClientRect().width,frameHeight:i.parentElement.getBoundingClientRect().height}));
  check('illustration uses a 3:1 frame '+width,Math.abs(loaded.frameWidth/loaded.frameHeight-3/1)<.01);
  check('image loading does not move the story '+width,Math.abs(loaded.height-pending.height)<2);
  check('image covers the frame without letterboxing '+width,Math.abs(loaded.width-(loaded.frameWidth-2))<2&&Math.abs(loaded.height-(loaded.frameHeight-2))<2&&loaded.fit==='cover');
  await page.locator('.choice:not([disabled])').first().focus();await page.keyboard.press('Enter');await decode();
  check('choice moves keyboard focus to the result '+width,await page.locator('.result-panel h2').evaluate(e=>e===document.activeElement));
  check('result heading is visible above navigation '+width,await page.locator('.result-panel h2').evaluate(e=>{const r=e.getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect(),h=document.querySelector('.player-header');const top=getComputedStyle(h).position==='fixed'?h.getBoundingClientRect().bottom:0;return r.top>=top&&r.bottom<=nav.top;}));
  await page.keyboard.press('Tab');check('Tab reaches Continue after reading the result '+width,await page.locator('[data-action=continue]').evaluate(e=>e===document.activeElement));
  await page.keyboard.press('Enter');await decode();
  check('next story keeps keyboard focus in its panel '+width,await page.locator('.story-panel').evaluate(e=>e===document.activeElement));
  await page.keyboard.press('Tab');check('Tab reaches a choice in the next event '+width,await page.locator('.choice').first().evaluate(e=>e===document.activeElement));
  const last=page.locator('.choice:last-child');for(let i=1;i<await page.locator('.choice').count();i++)await page.keyboard.press('Tab');check('last choice is unobstructed '+width,await last.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  check('page fits without horizontal scrolling '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  measurements.push({width,pending,loaded});await page.screenshot({path:`${out}/story-${width}.png`});
 }
 check('no browser exceptions',errors.length===0);await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,measurements,errors},null,2));
}catch(error){await page.screenshot({path:`${out}/FAILURE.png`});await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,measurements,errors,error:error.stack},null,2));console.error(error);process.exitCode=1;}finally{await browser.close();}
