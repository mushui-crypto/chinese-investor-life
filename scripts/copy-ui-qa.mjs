import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {applyEffects,PRODUCTS} from '../src/game/core.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.38/copy-ui',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click();
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function adult(){let s=createPlayableRun({seed:'copy-ui',familyId:'F01',startAt:'adult'},catalog);Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash:15000000,monthlyIncome:300000,occupation:'普通职员'});s.lifeArcs=newLifeArcs(s);s.behavior.pending=null;ensureRoutine(s);resetRoutineDay(s,1);s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return applyEffects(s,[{op:'loan',principal_yuan:1000,apr_bps:1200,term_months:12,purpose:'approved_use'}],{profile:'bank'}).state;}
async function close(){if(await page.locator('#game-info').count())await page.keyboard.press('Escape');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('#game-dialog [data-action=close-dialog]');}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');await close();}
async function inspect(name,selector='#game-dialog'){
 const e=page.locator(selector);await e.waitFor({state:'visible'});const w=page.viewportSize().width,h=page.viewportSize().height,r=await e.boundingBox();
 check(name+' frame '+w,r.x>=-1&&r.y>=-1&&r.x+r.width<=w+1&&r.y+r.height<=h+1);
 const body=e.locator(selector==='#game-dialog'?'.dialog-body':'.info-body');check(name+' content '+w,await body.evaluate(e=>e.scrollWidth<=e.clientWidth+1&&Boolean(e.textContent.trim())));
 check(name+' buttons '+w,await e.locator('button').evaluateAll(es=>es.every(e=>e.textContent.trim()||e.getAttribute('aria-label'))));
 if(['help','behavior','stock-budget','new-game'].includes(name))await page.screenshot({path:`${dir}/${name}-${w}.png`});
}
async function lifeEntry(action){await close();await click(`.bottom-nav [data-tab=life]`);if(!await page.locator(`[data-action=${action}]:visible`).count())await click('.life-notebook > summary');await click(`[data-action=${action}]`);}
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await click('[data-action=new-game]');await inspect('new-game');await close();
  await load(adult());const baseline=JSON.stringify(await state());
  for(const tab of ['life','market','assets','people','journal','history','legal']){await click(`.bottom-nav [data-tab=${tab}]`);check(tab+' page fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));check(tab+' no empty subtitle '+width,await page.locator('.workspace-head p:empty').count()===0);}
  for(const action of ['settings','saves']){await click(`[data-action=${action}]`);await inspect(action);if(action==='settings'){await click('#game-dialog [data-action=help]');await inspect('help');}await close();}
  await click('.bottom-nav [data-tab=life]');if(width<900)await click('[data-action=character]');
  for(const stat of ['health','stress','skill','insight','trust','fame','credit']){await click(`[data-info="stat:${stat}"]`);await inspect(stat,'#game-info');await page.keyboard.press('Escape');}await close();
  for(const action of ['behavior-hub','goals','day-rules']){await lifeEntry(action);await inspect(action==='behavior-hub'?'behavior':action);await close();}
  for(const action of ['life-hub','life-rebuild']){await lifeEntry(action);check(action+' opens people page '+width,await page.locator('.people-workspace').isVisible());if(action==='life-rebuild')check('work opportunities filter selected '+width,await page.locator('[data-action=people-filter][data-filter=work]').getAttribute('aria-pressed')==='true');}
  await click('.bottom-nav [data-tab=assets]');for(const action of ['business','loans','debt-calendar','repay']){await click(`[data-action=${action}]`);await inspect(action);await close();}
  await click('.bottom-nav [data-tab=market]');for(const key of ['stock','fund','bond','option','futures','crypto','ponzi','angel','housing','gambling']){await click(`[data-info="market:${key}"]`);await inspect('market-'+key,'#game-info');await page.keyboard.press('Escape');}
  await click('.market-row[data-market=stock] [data-action=invest]');await click('#desk-order [data-action=desk-budget][data-fraction="1"]');
  check('all in warning and enabled order '+width,await page.locator('#desk-order .cash-warning.shortfall').isVisible()&&await page.locator('#desk-order [type=submit]').isEnabled());
  await click('#desk-order [data-info=budget]');await inspect('stock-budget','#game-info');await page.keyboard.press('Escape');
  check('viewing copy preserves save and RNG '+width,JSON.stringify(await state())===baseline);
 }
 check('no browser exceptions',errors.length===0);await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(e){await page.screenshot({path:dir+'/failure.png'});await writeFile(dir+'/failure.json',JSON.stringify({checks,errors,error:e.stack},null,2));throw e;}finally{await browser.close();}
