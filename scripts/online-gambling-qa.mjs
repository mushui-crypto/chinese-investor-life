import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {chooseEvent} from '../src/game/narrative.js';
import {recordOnlineExposure,recordOnlineBet,recordOnlineEvent} from '../src/game/online-gambling.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir='reports/v1.60.0/online-ui';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
const fixture=()=>{const s=createPlayableRun({seed:'online-ui',familyId:'F01',startAt:'adult'},catalog);s.eventQueue=[];s.dueAnchors=[];s.presentations=[];s.behavior.pending=null;s.lifeArcs.pending=null;s.cash=1000000;return s;};
function openEvent(s,id){const e=catalog.events.find(e=>e.id===id);s.phase='event';s.activeEvent={eventId:id,instanceId:`online:${id}:${s.turn}:${++s.serial}`,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes.find(o=>o.onlineOutcome==='big_win')?.id||c.outcomes[0].id]))};s.lastResult=null;return s;}
async function load(s){await page.goto('http://127.0.0.1:4174/');await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await page.locator('[data-action=load-slot]').click();}
try{
 for(const [width,height]of [[1440,900],[1280,800],[390,844]]){
  await page.setViewportSize({width,height});await load(openEvent(fixture(),'OG01'));
  const dock=page.locator('.online-event-dock');await dock.waitFor();check(`exposure has four choices ${width}`,await dock.locator('[data-action=choose]').count()===4);check(`no decorative event art ${width}`,await dock.locator('.event-art').count()===0);
  const layout=await page.evaluate(()=>{const d=document.querySelector('.online-event-dock'),r=d.getBoundingClientRect(),n=document.querySelector('.bottom-nav').getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,nav:n.y,w:innerWidth,h:innerHeight,overflow:d.scrollWidth>d.clientWidth+1,page:document.documentElement.scrollWidth>innerWidth};});check(`dock fits and clears nav ${width}`,layout.x>=0&&layout.y>=0&&layout.right<=width+1&&layout.bottom<=layout.nav+1&&!layout.overflow&&!layout.page);
  await page.screenshot({path:`${dir}/exposure-${width}.png`});await dock.locator('[data-action=choose]').last().click();check(`refusal result renders ${width}`,await dock.locator('[data-action=continue]').count()===1);await dock.locator('[data-action=continue]').click();check(`returns to ordinary life ${width}`,await page.locator('.online-event-dock').count()===0);
 }
 const s=fixture();recordOnlineExposure(s,'look');s.debtClock.day+=180;s.age=18.5;s.behavior.onlineGambling.ordinaryEvents+=2;openEvent(s,'OG02');await page.setViewportSize({width:1280,height:800});await load(s);const own=s.cash;
 await page.locator('.online-event-dock [data-action=choose]').nth(1).click();check('win result uses actual outcome',await page.locator('.online-event-dock').innerText().then(t=>t.includes('盈利')&&/压力\s*[−–－-]\s*2/.test(t)));await page.screenshot({path:dir+'/win.png'});
 await page.reload();await page.locator('[data-action=load-slot]').click();check('result survives reload without draw',await page.locator('.online-event-dock').innerText().then(t=>t.includes('盈利')));
 await page.locator('.online-event-dock [data-action=continue]').click();await page.locator('.bottom-nav [data-tab=journal]').click();await page.locator('.online-life-ledger summary').click();check('history shows exit opportunities',await page.locator('.online-life-ledger').innerText().then(t=>t.includes('你曾经有 1 次离场机会')&&t.includes('累计下注')));await page.screenshot({path:dir+'/ledger.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('.online-life-ledger').scrollIntoViewIfNeeded();check('mobile ledger no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:dir+'/ledger-mobile.png'});
 check('no browser runtime errors',errors.length===0);await writeFile(dir+'/checks.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,dir}));
}catch(error){await page.screenshot({path:dir+'/FAILURE.png'});await writeFile(dir+'/checks.json',JSON.stringify({checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
