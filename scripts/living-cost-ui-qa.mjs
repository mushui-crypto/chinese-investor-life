import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {act} from '../src/game/narrative.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
import {resetGameCalendar} from '../src/game/game-calendar.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {EVENT_ART_ASSETS} from '../src/ui/event-art.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.35/living-cost-ui',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const check=(n,v)=>{assert.ok(v,n);checks.push(n);console.log('PASS',n);},click=q=>page.locator(q+':visible').first().click(),state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function adult(retired=false){const s=createPlayableRun({seed:'cost-ui',familyId:'F01',startAt:'adult'},catalog);Object.assign(s,{age:retired?67:25,occupation:retired?'退休':'待业青年',monthlyIncome:retired?400000:0,cash:1e7,activeEvent:null,phase:'planning',eventQueue:[],dueAnchors:[],presentations:[]});s.lifeArcs.pending=null;s.behavior.pending=null;resetGameCalendar(s);ensureRoutine(s);resetRoutineDay(s,1);return s;}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');await click('.life-pace-actions [data-action=day-routine]');}
try{
 for(const width of [1440,390])for(const retired of [false,true]){
  await page.setViewportSize({width,height:width<700?844:1000});await load(adult(retired));
  const name=(retired?'retired':'jobless')+'-'+width,dialog=page.locator('#game-dialog');
  check(name+' correct mode',(await dialog.innerText()).includes(retired?'退休生活':'待业日常'));
  check(name+' no salaried shift action',await dialog.locator('[data-choice=focus],[data-choice=slack]').count()===0);
  check(name+' free-day options',await dialog.locator('[data-choice=day_gig],[data-choice=learn],[data-choice=rest],[data-choice=job_hunt]').count()===4);
  check(name+' unclipped dialog',await page.locator('.dialog-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.screenshot({path:dir+'/'+name+'.png'});
  await click('.day-rules > summary');await click('.living-cost-detail details > summary');
  check(name+' age price visible',(await dialog.innerText()).includes(retired?'65 岁以后':'25–34 岁'));
  check(name+' age price ladder',await dialog.locator('.living-cost-detail details dt').count()===6);
  if(retired)check(name+' pension unaffected copy',(await dialog.innerText()).includes('养老金不受影响'));
  await page.locator('.living-cost-detail').scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/'+name+'-bills.png'});
  await page.locator('.dialog-body').evaluate(e=>e.scrollTop=0);const before=await state();await click('[data-choice=day_gig]');const after=await state();
  check(name+' gig pays immediately',after.cash>before.cash&&after.dayRoutine.choices[1]==='day_gig'&&after.actionPoints===before.actionPoints);
  check(name+' prevents repeat gig',await dialog.locator('[data-choice=day_gig]').isDisabled());
  await page.reload();await click('[data-action=load-slot]');check(name+' activity persisted',(await state()).dayRoutine.choices[1]==='day_gig');
 }
 // Exercise the genuine cost settlement, then read its UI and navigate the linked ledger.
 let s=adult();s.monthlyIncome=500000;s.occupation='普通职员';for(let i=0;i<100&&!s.livingCosts?.history?.length;i++){s.behavior.pending=null;s.lifeArcs.pending=null;s.dayRoutine.pending=null;s=act(s,{type:'calendar_day'},catalog);assert.ok(!s.lastResult?.error,s.lastResult?.error);}
 check('real unexpected expense generated',s.livingCosts.history.length>0);await page.setViewportSize({width:1440,height:1000});await load(s);await click('.recent-expenses > summary');
 check('expense receipt and amount visible',await page.locator('.recent-expenses li').count()>0&&(await page.locator('.recent-expenses').innerText()).includes('−¥'));
 await page.screenshot({path:dir+'/expense-receipt.png'});await click('.recent-expenses [data-tab=assets]');
 check('ledger button closes dialog and opens assets',!await page.locator('#game-dialog').evaluate(e=>e.open)&&await page.locator('.bottom-nav [data-tab=assets]').evaluate(e=>e.classList.contains('active')));
 // Visual sheet of every retained image under the actual new 3:1 frame.
 const retained=Object.entries(EVENT_ART_ASSETS).filter(([,v])=>v.focalY!==undefined);
 await page.setViewportSize({width:1500,height:1030});await page.setContent(`<base href="${url}/"><style>body{background:#eadcb7;margin:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img{width:100%;aspect-ratio:3/1;object-fit:cover;display:block;border:2px solid #71573b;border-radius:6px}figcaption{font:16px sans-serif;margin:8px}</style>${retained.map(([key,v])=>`<figure><img src="${v.src}" style="object-position:50% ${v.focalY}%"><figcaption>${key}</figcaption></figure>`).join('')}`);await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await page.screenshot({path:dir+'/retained-art-3x1.png'});
 check('no runtime errors',errors.length===0);await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
