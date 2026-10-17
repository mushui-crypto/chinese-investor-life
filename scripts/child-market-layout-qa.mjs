import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun} from '../src/game/narrative.js';
import {newChildhood} from '../src/game/childhood-state.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const s=createRun({seed:'market-alignment',familyId:'F01'},catalog);Object.assign(s,{age:13,turn:7,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:480300});s.childhood=newChildhood(s);
const out='reports/v1.59/child-market-layout';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
try{
 for(const width of [1512,1280,1024,768,390,320]){
  await page.setViewportSize({width,height:900});await page.goto(process.env.GAME_URL||'http://127.0.0.1:4174');
  await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));localStorage.setItem('cng-v1-settings',JSON.stringify({reduced:true}));},encodeSave(s));
  await page.reload();await page.locator('[data-action=load-slot]').first().click();
  const form=page.locator('#child-market-form');await form.scrollIntoViewIfNeeded();await form.locator('.number-preset').last().waitFor();
  const g=await form.evaluate(f=>{const r=e=>e.getBoundingClientRect(),a=r(f.querySelector('.game-select-trigger')),b=r(f.querySelector('input')),labels=[...f.querySelectorAll(':scope>label')].map(r);return {side:labels[1].left>labels[0].left+10,aligned:Math.abs(a.top-b.top)<2,stacked:Math.abs(labels[1].left-labels[0].left)<2&&labels[1].top>a.bottom,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...f.querySelectorAll('button')].every(e=>r(e).height>=44),emptyError:getComputedStyle(f.querySelector('.form-error')).display==='none'};});
  check(`aligned fields ${width}`,g.side?g.aligned:g.stacked);check(`no overflow and usable controls ${width}`,!g.overflow&&g.buttons&&g.emptyError);
  if(width<=560)check(`compact layout ${width}`,!g.side);
  await form.locator('.number-preset[data-value="3"]').click();check(`preset updates amount ${width}`,(await form.locator('input').inputValue())==='3'&&(await form.locator('.child-buy-preview').innerText()).includes('36'));
  await page.locator('.child-market').screenshot({path:`${out}/${width}.png`});
  await form.locator('[type=submit]').click();const cash=await page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state.cash);check(`purchase works ${width}`,cash===476700);
 }
 check('no runtime errors',errors.length===0);await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
