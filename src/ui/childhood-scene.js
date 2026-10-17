import {childhoodActivities,childhoodActivityPreview} from '../game/childhood-activities.js';
import {renderChildhoodEffects} from './childhood-effects.js';
import {educationStage} from '../game/education.js';
import {childhoodContinueLabel} from '../game/childhood-stages.js';
import {getActionAvailability} from '../game/core.js';

// Derive the scene from the saved action. Opening a page never consumes randomness.
export function completedChildhoodActivity(s){
 if(!s||s.age>=18||s.phase!=='planning'||s.actionPoints>=2)return null;
 return childhoodActivities(s).find(a=>a.type===s.journey?.lastAction&&(a.title===s.lastResult?.title||a.legacyTitle&&a.legacyTitle===s.lastResult?.title))??null;
}
export function childhoodScene(s){
 if(!s||s.age<1||s.age>=6||s.phase==='ended')return null;
 const nap=s.age<3&&completedChildhoodActivity(s)?.type==='rest';
 const key=s.age>=3?'preschool-home':nap?'toddler-nap':'toddler-play';
 return {key,src:`./public/assets/childhood/${key}-v1.webp`,title:s.age>=3?'家里的游戏时间':nap?'家人守着你睡午觉':'家人陪你玩积木'};
}
export function renderChildhoodStage(s,{esc}){
 const scene=childhoodScene(s);if(!scene||s.phase!=='planning')return '';
 return `<section class="childhood-stage" aria-label="${esc(scene.title)}" data-scene="${scene.key}"><img class="childhood-mobile-art" src="${scene.src}" alt="${esc(scene.title)}" width="1920" height="1080" decoding="async"></section>`;
}
export function renderChildhoodOperations(s,{esc,icon}){
 if(s.age>=18||s.phase!=='planning')return '';
 const done=completedChildhoodActivity(s),stage=educationStage(s);
 return `<section class="childhood-operations" aria-labelledby="childhood-operation-title">
  <div class="childhood-operation-heading"><h2 id="childhood-operation-title">${esc(stage.name)} · ${esc(stage.range)}</h2><span>精力 <strong>${s.actionPoints}</strong> / 2</span></div>
  ${done?`<div class="childhood-feedback" role="status"><div><strong>已完成：${esc(done.label)}</strong>${Array.isArray(s.lastResult.statChanges)?s.lastResult.statChanges.length?renderChildhoodEffects(s.lastResult.statChanges,{esc}):'<span>属性已达当前上限，本次没有变化</span>':''}</div><p>${esc(s.lastResult.text)}</p></div>`:''}
  <div class="childhood-operation-actions">
   <div class="childhood-activity-buttons" role="group" aria-label="这一阶段的成长习惯，每项消耗 1 点精力">${childhoodActivities(s).map(a=>{const can=getActionAvailability(s,{type:a.type}),changes=childhoodActivityPreview(s,a.type);return `<button class="button childhood-activity" data-action="life-action" data-type="${a.type}" ${can.allowed?'':`disabled title="${esc(can.reason)}"`}><span class="childhood-activity-label">${icon(a.icon)}<strong>${esc(a.label)}</strong></span>${renderChildhoodEffects(changes,{esc},{preview:true})}<small>${can.allowed?`消耗 1 点精力${a.cost?` · 花费 ¥${a.cost/100}`:''}`:esc(can.reason)}</small></button>`;}).join('')}</div>
   <div class="childhood-year-end">${s.actionPoints>0?`<p id="childhood-unused-actions">剩余精力不带入下一阶段</p>`:''}<button class="button primary" data-action="life-continue" ${s.actionPoints>0?'aria-describedby="childhood-unused-actions"':''}>${esc(childhoodContinueLabel(s))}</button></div>
  </div>
 </section>`;
}
