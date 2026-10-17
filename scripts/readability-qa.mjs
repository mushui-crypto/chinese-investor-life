import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {continueStory,chooseEvent,eligibleChoices} from '../src/game/narrative.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${n}.json`));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
const out=process.env.QA_REPORT_DIR||'reports/v1.14/readability',url=process.env.GAME_URL||'http://127.0.0.1:4173';await mkdir(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[],measurements=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
function adult(){let s=createPlayableRun({seed:'readability-v114',familyId:'F01',startAt:'adult',childhood:'study'},catalog);for(let g=0;['event','result'].includes(s.phase)&&g<30;g++){if(s.phase==='result')s=continueStory(s,catalog);else{const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),c=eligibleChoices(s,e).find(c=>!c.disabled);s=chooseEvent(s,e.id,c.id,catalog);}}s.cash=714444;return s;}
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state),click=sel=>page.locator(sel+':visible').first().click();
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');}
async function shot(name){await page.locator('#toast.show').waitFor({state:'detached',timeout:5000});await page.screenshot({path:`${out}/${name}.png`});}
const fits=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
try{
 await load(adult());await click('[data-action=tab][data-tab=life]');await page.evaluate(()=>scrollTo(0,0));
 check('life has one continuation and no stacked guide panels',await page.locator('main [data-action=life-continue]').count()===1&&await page.locator('main>.play-guide,main>.time-preview,main>.life-flow,.daily-account-drawer').count()===0);
 check('all three budget values and shortage remain visible',await page.locator('.compact-budget [data-budget]').count()===3&&await page.locator('.cash-shortage').isVisible());
 const initial=JSON.stringify(await current());
 for(const k of ['health','stress','skill','insight','trust','fame','credit']){await click(`[data-info="stat:${k}"]`);check(k+' explanation opens on click',await page.locator('#game-info:popover-open').count()===1&&(await page.locator('.info-body').innerText()).length>35);await page.keyboard.press('Escape');check(k+' Escape restores trigger focus',await page.locator(`[data-info="stat:${k}"]`).first().evaluate(e=>e===document.activeElement));}
 await click('[data-info=work]');check('payment timing is available on demand',(await page.locator('.info-body').innerText()).includes('做完就到账')&&(await page.locator('.info-body').innerText()).includes('随时间结算到账'));await page.keyboard.press('Escape');
 await click('[data-info=period]');check('time info preserves forecast and recommended next step',await page.locator('#game-info .time-preview[open]').count()===1&&await page.locator('#game-info [data-action=guide-route]').count()===1);await click('.info-close');
 await click('[data-info=budget]');check('reserve described as advisory',await page.locator('.info-body').innerText().then(t=>t.includes('不冻结')&&t.includes('全部现金')));await page.mouse.click(5,400);check('outside click dismisses explanation',await page.locator('#game-info:popover-open').count()===0);
 check('reading information changes neither RNG nor save',JSON.stringify(await current())===initial);
 await shot('life-desktop');await click('[data-info="stat:skill"]');await shot('stat-explanation');await page.keyboard.press('Escape');
 for(const width of [1965,1440,768,390,320]){
  await page.setViewportSize({width,height:width>1000?1100:900});await click('[data-action=tab][data-tab=life]');await page.evaluate(()=>scrollTo(0,0));check('life '+width+' fits viewport',await fits());await shot('life-'+width);
  if(width<760){await click('[data-action=character]');await click('#game-dialog [data-info="stat:credit"]');await page.keyboard.press('Escape');check('mobile '+width+' Escape keeps character dialog open',await page.locator('#game-dialog').evaluate(e=>e.open)&&await page.locator('#game-info:popover-open').count()===0);await click('#game-dialog [data-action=close-dialog]');}
  await click('[data-action=tab][data-tab=market]');await page.evaluate(()=>scrollTo(0,0));
  const rows=await page.locator('.market-row').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom};}));check('market '+width+' has 11 vertically stacked projects',rows.length===11&&rows.every((r,i)=>!i||(r.y>=rows[i-1].bottom&&Math.abs(r.x-rows[0].x)<1)));check('market '+width+' fits viewport',await fits());
  check('market '+width+' hides long explanations',await page.locator('.market-explanation,.market-cards,.workspace-footnote').count()===0);
  await shot('market-'+width);await click('[data-info="market:option_short"]');const box=await page.locator('#game-info').boundingBox();check('market '+width+' info fits screen',box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=(width>1000?1100:900)+1);check('market '+width+' shows conditions on row and gameplay only on demand',await page.locator('[data-market=option_short] .market-access-conditions li').count()===5&&await page.locator('#game-info .info-conditions').count()===0&&(await page.locator('#game-info').innerText()).includes('交易方式')&&!(await page.locator('[data-market=option_short]').innerText()).includes('到期履约'));await shot('market-info-'+width);await page.keyboard.press('Escape');measurements.push({width,rows,popover:box});
 }
 await click('[data-action=market-filter][data-filter=locked]');check('locked filter includes only locked projects',await page.locator('.market-row.is-open').count()===0&&await page.locator('.market-missing').count()>0);await click('[data-action=market-filter][data-filter=open]');check('open filter includes gambling consistently',await page.locator('.market-row.is-locked').count()===0&&await page.locator('[data-market=gambling]').count()===1);
 await click('[data-action=toggle-watch][data-product=bond]');await click('[data-action=market-filter][data-filter=watched]');check('watch filter reflects starred project',await page.locator('[data-market=bond]').count()===1);await click('[data-action=market-filter][data-filter=all]');
 await click('[data-info="market:option"]');await click('#game-info [data-action=market-rules]');check('full market rules still reachable',await page.locator('#game-dialog .access-checklist').count()===1);await click('#game-dialog [data-action=close-dialog]');
 await click('[data-action=invest][data-product=stock]');check('row enters actual stock desk',await page.locator('#desk-order').count()===1);await click('#desk-order [data-action=desk-budget][data-fraction="1"]');check('all-in warning remains visible and permits trade',await page.locator('#desk-order .cash-warning.shortfall').isVisible()&&!await page.locator('#desk-order [type=submit]').isDisabled());
 check('no browser exceptions',errors.length===0);await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,errors,measurements,url},null,2));
}catch(e){await page.screenshot({path:`${out}/FAILURE.png`});await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));console.error(e);process.exitCode=1;}finally{await browser.close();}
