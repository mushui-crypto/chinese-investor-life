import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun} from '../src/game/narrative.js';
import {PRODUCTS} from '../src/game/core.js';
import {gameDate} from '../src/game/game-calendar.js';
import {setSaveCatalog,encodeSave} from '../src/game/storage.js';
import {chooseGameOption} from './game-control-helpers.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${n}.json`));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.33/chart-axes',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1500,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const click=q=>page.locator(q+':visible').first().click(),current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
function adult(){const s=createRun({seed:'trading-chrome-qa',familyId:'F08'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000,monthlyIncome:800000,giftReceived:true});s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};s.stats.insight=90;return s;}
async function load(s){await page.goto(url);await page.locator('#app button').first().waitFor();await page.evaluate(save=>{localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));localStorage.setItem('cng-v1-active-slot','0');sessionStorage.removeItem('cng-trade-mail-read');},encodeSave(s));await page.reload();await click('[data-action=load-slot]');await click('[data-action=tab][data-tab=market]');}
async function open(kind){if(await page.locator('#desk-switch').count()&&await page.locator('#desk-switch').locator('..').locator('.game-select-trigger').isVisible())await chooseGameOption(page,'#desk-switch',kind);else {if(await page.locator('.market-desk').count())await click('[data-action=desk-back]');await click(`[data-action=invest][data-product=${kind}]`);}}
async function shot(name){await page.locator('#toast.show').waitFor({state:'detached',timeout:5000});await page.screenshot({path:`${dir}/${name}.png`,animations:'disabled'});}
const chart=()=>page.locator('.desk-research-pane [data-daily-chart],.terminal-chart-area [data-daily-chart]').first();
const inspect=()=>chart().evaluate(el=>{
 const svg=el.querySelector('svg'),box=svg.getBoundingClientRect(),texts=[...svg.querySelectorAll('text')].map(n=>({text:n.textContent,cls:n.getAttribute('class'),r:n.getBoundingClientRect().toJSON(),size:getComputedStyle(n).fontSize}));
 const x=texts.filter(t=>t.cls?.includes('daily-time-tick')),y=texts.filter(t=>t.cls?.includes('daily-price-tick'));
 const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 return {width:box.width,height:box.height,font:texts.map(t=>t.size),inside:texts.every(t=>t.r.left>=box.left-1&&t.r.right<=box.right+1&&t.r.top>=box.top-1&&t.r.bottom<=box.bottom+1),xNoOverlap:x.every((t,i)=>!i||!overlaps(t.r,x[i-1].r)),yNoOverlap:y.every((t,i)=>!i||!overlaps(t.r,y[i-1].r)),x:x.map(t=>t.text),y:y.map(t=>t.text),ready:Math.abs(Number(svg.getAttribute('width'))-box.width)<2,footer:!!el.querySelector(':scope>small'),rowHeight:el.querySelector('.daily-readout').getBoundingClientRect().height};
});
try{
 await load(adult());await open('stock');const saved=JSON.stringify(await current());check('profile and trading clock show the same virtual date',await page.locator('.player-date').innerText().then(t=>t.includes('2013-01-01'))&&await page.locator('.quickbar-clock').innerText().then(t=>t.includes('2013-01-01')));
 for(const width of [1920,1440,1024,768,390,320]){
  await page.setViewportSize({width,height:width<500?900:1000});
  for(const kind of ['stock','fund','crypto']){
   await open(kind);await chart().scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const e=document.querySelector('.desk-research-pane .daily-plot,.terminal-chart-area .daily-plot');return e&&Math.abs(Number(e.dataset.width)-e.getBoundingClientRect().width)<2;});
   const m=await inspect();check(`${kind} ${width}: SVG uses actual CSS pixel width`,m.ready);check(`${kind} ${width}: axis labels stay inside without overlaps`,m.inside&&m.xNoOverlap&&m.yNoOverlap);check(`${kind} ${width}: axis font remains 12px`,m.font.every(f=>f==='12px'));check(`${kind} ${width}: time labels use one convention`,m.x.length>=2&&m.x.at(-1)==='01-01'&&m.x.every(t=>/^\d{2}-\d{2}$/.test(t)));check(`${kind} ${width}: footer removed; OHLC row is compact`,!m.footer&&m.rowHeight<100);
   if(kind==='stock'&&width>760)check(`stock ${width}: narrow list sits vertically left of chart`,await page.locator('.desk-research-pane').evaluate(e=>{const list=e.querySelector('.stock-board'),chart=e.querySelector('.daily-chart'),lr=list.getBoundingClientRect(),cr=chart.getBoundingClientRect(),rows=[...list.querySelectorAll('.instrument-option')].map(b=>b.getBoundingClientRect());return lr.width<=202&&cr.left>=lr.right+10&&Math.abs(cr.top-lr.top)<2&&rows.every((r,i)=>!i||r.top>=rows[i-1].bottom);}));
   await shot(`${kind}-${width}`);
  }
 }
 await page.setViewportSize({width:1440,height:1000});await open('stock');await chart().scrollIntoViewIfNeeded();
 await chart().locator('[data-daily-point]').nth(8).hover();check('hover shows that candle OHLC',await chart().locator('[data-daily-field=close]').innerText()===JSON.parse(await chart().locator('[data-daily-point]').nth(8).getAttribute('data-daily-point')).close);
 await chart().locator('[data-daily-point]').nth(5).click();const selected=await chart().locator('[data-daily-field=day]').innerText();await page.mouse.move(20,20);await page.setViewportSize({width:1024,height:900});await chart().scrollIntoViewIfNeeded();check('resize preserves pinned date',await chart().locator('[data-daily-field=day]').innerText()===selected);
 await chart().locator('[data-daily-point]').first().focus();await page.keyboard.press('End');check('keyboard End selects latest',await chart().locator('[data-daily-field=day]').innerText()===gameDate(await current()));
 await chart().locator('[data-info=daily-chart]').click();check('chart explanation available behind info icon',(await page.locator('#game-info').innerText()).includes('开盘前为模拟走势'));await page.keyboard.press('Escape');
 for(const id of ['hk_platform','us_compute']){await click(`[data-action=stock-market][data-id=${id}]`);await chart().scrollIntoViewIfNeeded();const m=await inspect();check(id+' uses the same clean axes',m.inside&&m.xNoOverlap&&m.yNoOverlap);}
 check('chart navigation and resize do not alter game state',JSON.stringify(await current())===saved);
 check('no runtime errors',errors.length===0);await writeFile(`${dir}/checks.json`,JSON.stringify({passed:true,checks,errors},null,2));
}catch(e){await page.screenshot({path:`${dir}/failure.png`});await writeFile(`${dir}/checks.json`,JSON.stringify({passed:false,checks,errors,error:String(e)},null,2));throw e;}finally{await browser.close();}
