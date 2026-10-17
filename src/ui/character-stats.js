import {fatigueAffectsIncome} from '../game/work-economy.js';
import {infoButton} from './info-popover.js';

export function renderCharacterStats(s,{icon}){
 const rows=[['health','健康','heart'],['fatigue','疲劳','sun'],['stress','压力值','clock'],['academic','学业','book'],['discipline','自律','check'],['skill','谋生本事','work'],['insight','眼力见','spark'],['trust','人缘','people'],['fame','江湖名气','star'],['credit','信用','check']]
  .filter(([key])=>key==='fatigue'?s.age>=18:s.age>=6||!['academic','skill','fame','credit'].includes(key));
 return `<dl class="stats">${rows.map(([key,label,ico])=>{
  const value=Math.round(Math.max(0,Math.min(100,(key==='fatigue'?s.behavior?.fatigue:s.stats[key])||0)));
  const tired=key==='fatigue',high=tired&&fatigueAffectsIncome(s);
  const note=high?'工作出错 · 工作收入 −25%':tired&&value>=50?'注意休息 · 65 起影响收入':'';
  return `<div class="stat ${high?'is-fatigued':''}" data-stat="${key}"><dt>${icon(ico)}<span>${label}</span>${infoButton('stat:'+key,label)}</dt><dd>${value}<span>/100</span></dd><div class="stat-track ${['stress','fatigue'].includes(key)?'pressure':''}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"${tired?` aria-valuetext="${value} / 100，越低越好${note?'，'+note:''}"`:''}><i style="width:${value}%"></i></div>${note?`<small class="stat-note">${note}</small>`:''}</div>`;
 }).join('')}</dl>`;
}

export function fatigueTransitionNotice(before,after){
 if(!before||after.age<18||after.lastResult?.error)return '';
 const wasTired=fatigueAffectsIncome(before),isTired=fatigueAffectsIncome(after);
 if(!wasTired&&isTired)return '疲劳达到 65，工作容易出错，工资和兼职收入减少 25%。先休息可以恢复。';
 if(wasTired&&!isTired)return '疲劳已降至 65 以下，疲劳造成的收入扣减已解除。';
 return '';
}
