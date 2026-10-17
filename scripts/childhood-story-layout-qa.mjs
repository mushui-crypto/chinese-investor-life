import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {skipBirth} from '../src/game/childhood.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
import {chooseGameOption} from './game-control-helpers.mjs';
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const state=skipBirth(createPlayableRun({seed:'compact-kindergarten',familyId:'F01',startAt:'birth'},catalog),catalog);
const out='reports/v1.59/childhood-story-layout';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
try{
 for(const [width,height]of [[1920,1080],[1512,850],[1280,800],[1024,768],[390,844]]){
  await page.setViewportSize({width,height});await page.goto(process.env.GAME_URL||'http://127.0.0.1:4174');
  await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));localStorage.setItem('cng-v1-settings',JSON.stringify({reduced:true}));},encodeSave(state));
  await page.reload();await page.locator('[data-action=load-slot]').first().click();
  check(`one growth settings in right rail ${width}`,await page.locator('.childhood-path').count()===1&&await page.locator('.arrangement-panel>.childhood-path:first-child').count()===1);
  const metrics=await page.locator('.main-stage>.story-panel').evaluate(el=>{const r=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect(),a=el.querySelector('.event-illustration').getBoundingClientRect();return{width:r.width,center:Math.abs((r.left+r.right)-(parent.left+parent.right))<2,ratio:a.width/a.height,cols:getComputedStyle(el.querySelector('.choices')).gridTemplateColumns.split(' ').length,overflow:document.documentElement.scrollWidth>innerWidth};});
  check(`compact centered story with 3:1 art ${width}`,metrics.width<=1041&&metrics.center&&Math.abs(metrics.ratio-3)<.02&&!metrics.overflow);
  check(`choice columns ${width}`,metrics.cols===(width>=1280?2:width===390?1:metrics.cols));
  const settings=page.locator('.arrangement-panel>.childhood-path');await settings.locator('summary').click();
  await chooseGameOption(page,'#child-focus','practical');
  check(`growth setting saves ${width}`,await page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state.childhood.focus==='practical'));
  check(`open settings fit rail ${width}`,await settings.evaluate(el=>el.scrollWidth<=el.clientWidth));
  if(width>=1280){await page.locator('.game-scroll').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`${out}/${width}.png`});}
  await page.locator('.story-panel .choice:not([disabled])').first().click();await page.locator('.result-panel').waitFor();
  check(`result retains relocated settings ${width}`,await page.locator('.childhood-path').count()===1&&await page.locator('.arrangement-panel>.childhood-path:first-child').count()===1);
  await page.locator('[data-action=continue]').first().click();
  check(`planning retains only one settings module ${width}`,await page.locator('.childhood-path').count()===1&&await page.locator('.main-stage .childhood-path').count()===0);
 }
 check('no runtime errors',errors.length===0);await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
