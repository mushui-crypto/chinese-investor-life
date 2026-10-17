import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,act,settleRun} from '../src/game/narrative.js';
import {getEndingMetrics,rngNext} from '../src/game/core.js';
import {resolveGamble,resolveHouseGamble,newGambling,gamblingAudit} from '../src/game/gambling.js';
import {setSaveCatalog,encodeSave} from '../src/game/storage.js';
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${n}.json`));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
const out=process.env.QA_REPORT_DIR||'reports/v1.16/ledger',url=process.env.GAME_URL||'http://127.0.0.1:4173';await mkdir(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click();
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function adult(){const s=createRun({seed:'risk-ledger-browser',familyId:'F03'},catalog);Object.assign(s,{age:60,turn:60,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:20000000,giftReceived:true});return s;}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>localStorage.setItem('cng-v1-slot-0',JSON.stringify(save)),encodeSave(s));await page.reload();await click('[data-action=load-slot]');}
async function shot(name,selector){await page.locator('#toast.show').waitFor({state:'hidden',timeout:5000});if(selector)await page.locator(selector).scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${name}.png`});}
try{
 let seed=0;for(;seed<200000;seed++){let rng=seed;const draw=()=>{const r=rngNext(rng);rng=r.seed;return r.value;};if(resolveGamble({game:'slots',pick:'spin'},draw).multiplier===1000){rng=seed;if(resolveHouseGamble({game:'slots',pick:'spin',amount:20000000},draw,newGambling(),20000000).multiplier===1000)break;}}assert.ok(seed<200000);
 const before=adult();before.rng=seed;const win=act(before,{type:'gamble',game:'slots',pick:'spin',amount:before.cash},catalog);assert.ok(!win.lastResult.error);
 const audit=gamblingAudit(win),money=n=>'¥'+(n/100).toLocaleString('zh-CN',{maximumFractionDigits:2});
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:width<700?844:1000});await load(win);await click('.bottom-nav [data-tab=market]');await click('[data-action=desk-open][data-product=gambling]');
  check(`ledger ${width}: starts collapsed`,!await page.locator('details.gambling-ledger').evaluate(e=>e.open));
  await page.locator('.gambling-ledger summary').focus();await page.keyboard.press('Enter');
  check(`ledger ${width}: keyboard expands`,await page.locator('.gambling-ledger').evaluate(e=>e.open));
  check(`ledger ${width}: exact distinct balances`,JSON.stringify(await page.locator('.gambling-ledger dd').allTextContents())===JSON.stringify([money(audit.staked),money(audit.returned),'+'+money(audit.tableNet),money(0),money(0),money(audit.pendingBills)]));
  check(`ledger ${width}: no page overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check(`ledger ${width}: viewing never changes money or RNG`,(await state()).cash===win.cash&&(await state()).rng===win.rng);
  await shot('ledger-'+width,'.gambling-ledger');
 }
 const ending=settleRun(win,catalog);await load(ending);
 check('ending excludes provisional jackpot from rich ending',await page.locator('.ending-paper h1').innerText()===ending.ending.title&&ending.ending.id!=='E01');
 check('ending explains the uncharged pending bills',(await page.locator('.ending-paper').innerText()).includes('按当前金额计入这次后记'));
 check('ending retains the gambling ledger',await page.locator('.ending-gambling-ledger').count()===1);
 check('comparison uses the same closing worth',await page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-collection')).completedRuns.at(-1).worth)===getEndingMetrics(ending).netWorth);
 await shot('ending-pending-mobile','.ending-gambling-ledger');
 check('early epilogue can resume with real assets',await page.locator('[data-action=resume]').count()===1);await page.reload();await click('[data-action=load-slot]');const saved=await state();check('actual ledger survives reload without another loss',saved.cash===win.cash&&saved.riskLife.terminal===null&&saved.ledger.length===win.ledger.length);
 const ordinary=adult();ordinary.cash=500000000;const invested=act(ordinary,{type:'invest',product:'fund',amount:100000},catalog),freedom=settleRun(invested,catalog);assert.equal(freedom.ending.id,'E30');
 for(const width of [1440,320]){await page.setViewportSize({width,height:width<700?844:1000});await load(freedom);check(`freedom ${width}: title and total ending count`,await page.locator('.ending-paper h1').innerText()==='这回，钱够慢慢花了'&&(await page.locator('[data-action=ending-collection]').innerText()).includes('/ '+catalog.endings.length));check(`freedom ${width}: no empty gambling ledger`,await page.locator('.gambling-ledger').count()===0);check(`freedom ${width}: no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>scrollTo(0,0));await shot('freedom-'+width);}
 check('no browser errors',errors.length===0);await writeFile(`${out}/risk-ledger-browser.json`,JSON.stringify({passed:true,checks,errors,url,date:new Date().toISOString()},null,2));
}catch(e){await page.screenshot({path:`${out}/FAILURE.png`,fullPage:true});await writeFile(`${out}/risk-ledger-browser.json`,JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));console.error(e);process.exitCode=1;}finally{await browser.close();}
