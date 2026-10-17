import {renderLivingBills} from './living-ledger.js';
import {renderFixedIncome} from './payroll.js';
import {foodSettlementResult} from './survival-panel.js';
import {renderShortfallSettlement} from './shortfall-settlement.js';
import {stagePlan,stageOptions} from '../game/stage-plan.js';
import {shouldOfferDayOff} from '../game/attendance.js';
import {gameDate} from '../game/game-calendar.js';
import {lifeChapter} from '../game/life-chapters.js';
import {chapterPause} from '../game/chapter-progress.js';
import {getSurvivalStatus} from '../game/core.js';
import {dailyScene} from './daily-scene.js';

export function renderChapterEntry(s,{esc}){
  const c=lifeChapter(s);if(!c||s.legal?.prisonMonthsLeft)return '';
  const p=stagePlan(s),focus=stageOptions(s).find(o=>o.id===p?.focus);
  return `<div class="chapter-entry"><div><strong>${c.start}–${c.end} 岁 · ${esc(c.name)}</strong><span>${focus?esc(focus.title):'选好这段时间的生活重心，再推进人生'}</span></div><button class="button small" data-action="stage-return">回到阶段安排 →</button></div>`;
}
export function renderChapterPlan(s,{esc,money},inline=false){
  const c=lifeChapter(s),v=getSurvivalStatus(s),pause=chapterPause(s),p=stagePlan(s),options=stageOptions(s),chosen=options.find(o=>o.id===p?.focus);
  if(!c)return '<p>这一阶段没有可继续的章节。</p>';
  const pauseAction=v.needsCare?'rescue-options':s.lifeArcs?.pending?'life-scene':s.behavior?.pending?'behavior-hub':s.dayRoutine?.pending?'stage-detail':'life-continue';
  const attendance=shouldOfferDayOff(s);
  return `<section class="chapter-plan ${inline?'stage-plan-inline':''}" aria-label="阶段生活安排"><div class="stage-heading"><div><strong>${c.start}–${c.end} 岁 · ${esc(c.name)}</strong><span>${gameDate(s)} · ${s.occupation==='大学生'?'大学生活':'这一阶段'}</span></div><button class="text-button" data-action="chapter-receipt" ${s.chapterSummary?'':'hidden'}>上次进展 →</button></div><details class="stage-focus-selector" ${chosen?'':'open'}><summary>${chosen?`生活重心：${esc(chosen.title)} <span>调整</span>`:'这段时间，把心思放在哪里？'}</summary><div class="stage-focus-options" role="group" aria-label="选择生活重心">${options.map(o=>`<button class="button stage-focus-option ${o.id===p?.focus?'is-selected':''}" data-action="stage-focus" data-focus="${o.id}" aria-pressed="${o.id===p?.focus}" ${pause?'disabled':''}><strong>${esc(o.title)}</strong><span>${esc(o.note)}</span><small>${esc(o.effect)}</small></button>`).join('')}</div></details>${chosen?`<p class="stage-plan-effect">${esc(chosen.effect)}。按实际度过的天数生效；已手动安排晚间活动或熬夜的当天不再叠加。</p>`:''}${pause?`<p class="chapter-stop">${esc(pause.reason)} <button class="button small" data-action="${pauseAction}">${v.needsCare?'安排就医':'处理眼前的事'}</button></p>`:attendance?'<p class="chapter-stop">昨晚没睡好，先决定今天是否出勤。</p>':v.shortage?`<p class="stage-shortage">今天生活费预计还差 ${money(v.shortage)}。<button class="text-button" data-action="rescue-options">安排生活费 →</button></p>`:''}${renderShortfallSettlement(s,{money})}<div class="stage-footer"><div class="stage-time-actions"><div class="stage-time-buttons" role="group" aria-label="选择生活推进方式"><button class="button primary" data-action="stage-detail">展开今天${attendance?' · 出勤选择':''}</button><button class="text-button stage-fast-forward" data-action="chapter-start" ${!chosen||pause||attendance?'disabled':''}>按安排快进</button></div><small>亲自安排今天，或按生活重心推进；遇到事情会暂停。</small></div><button class="text-button" data-action="tab" data-tab="market">去投资市场 →</button></div></section>`;
}
export function renderChapterMontage(s,trip,{esc},reduced=false){
  const shots=chapterMontageShots(s);
  return `<section class="chapter-montage ${reduced?'is-still':''}" aria-label="时间过渡"><figure>${shots.map((scene,i)=>`<img data-chapter-shot="${i}" ${i?'hidden':''} src="${esc(scene.src)}" alt="${esc(scene.title)}" style="object-position:50% ${scene.focalY??50}%">`).join('')}<figcaption>这段日子</figcaption></figure><div class="chapter-date" role="status" aria-live="polite">${esc(trip.from)} → ${esc(trip.to)}<strong>已度过 ${trip.days} 天</strong></div><p>上课、工作和日常收支照常进行，遇到需要你决定的事情会停下来。</p><div class="chapter-controls"><button class="button" data-action="chapter-stop">停在这里</button></div></section>`;
}
export function chapterMontageShots(s){
  // Presentation only: use the existing identity/location-aware scene selector.
  // Do not let yesterday's activity or a stale result select an unrelated picture.
  return [2,3,6].map(stage=>dailyScene({...s,lastResult:null,dayRoutine:{...s.dayRoutine,stage,choices:{},pending:null}})||
    {src:'./public/assets/life-rental-v2.webp',title:'日子慢慢过去'});
}
export function renderChapterReceipt(s,r,{esc,money}){
  const signed=n=>(n>0?'+':'')+money(n),v=getSurvivalStatus(s);
  const route=v.needsCare?'rescue-options':v.shortage||r.kind==='living'?'rescue-options':r.kind==='bill'?'debt-calendar':r.kind==='position'?'chapter-assets':r.kind==='promise'?'life-hub':r.kind==='attendance'?'stage-detail':s.behavior?.pending?'behavior-hub':s.lifeArcs?.pending?'life-scene':'chapter-return';
  const label=route==='rescue-options'?(v.needsCare?'安排就医':'安排生活费'):route==='debt-calendar'?'查看还款':route==='chapter-assets'?'查看持仓':route==='life-hub'?'处理约定':route==='behavior-hub'||route==='life-scene'?'看看消息':s.dayRoutine?.pending||s.phase!=='planning'?'处理眼前的事':r.kind==='attendance'?'决定今天是否出勤':'回到阶段安排';
  return `<section class="chapter-receipt"><p class="chapter-target">${esc(r.from)} → ${esc(r.to)} · 过了 ${r.days} 天</p><p class="chapter-stop">${esc(r.reason||'停在这里，稍后可以继续。')}${r.kind==='expense'?'<button class="button small" data-action="chapter-bills">查看账单 →</button>':''}</p>${renderFixedIncome(s,{money})}<dl class="chapter-numbers"><div><dt>现金收入</dt><dd>${money(r.income)}</dd></div><div><dt>实际支付</dt><dd>${money(r.spending)}</dd></div><div><dt>现金变化</dt><dd>${signed(r.cash)}</dd></div><div><dt>持仓市值变化</dt><dd>${signed(r.holdings)}</dd></div><div><dt>净资产变化</dt><dd>${signed(r.worth)}</dd></div><div><dt>欠款变化</dt><dd>${signed(r.debt||0)}</dd></div><div><dt>人缘变化</dt><dd>${r.trust>0?'+':''}${r.trust}</dd></div></dl>${r.changes?`<p class="stage-stat-receipt">${Object.entries(r.changes).filter(([,n])=>n).map(([k,n])=>`${({health:'健康',fatigue:'疲劳',academic:'学业',skill:'本事',discipline:'自律',insight:'眼力',stress:'压力',trust:'人缘',fame:'名气',credit:'信用'})[k]||k} ${n>0?'+':''}${n}`).join(' · ')||'属性没有变化'}</p>`:''}${foodSettlementResult(r.lastFood,{money})}<p class="field-help">收入、生活开销、到期还款及临时花销已记入账本。持仓变化包含行情、到期与强平结果，浮盈没有变成现金。</p>${renderShortfallSettlement(s,{money})}<div class="chapter-controls">${route!=='chapter-return'?'<button class="button" data-action="chapter-return">回到阶段安排</button>':''}<button class="button primary" data-action="${route}">${label}</button></div></section>`;
}

export const renderChapterBills=renderLivingBills;
