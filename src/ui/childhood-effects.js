import {childhoodActivityPreview} from '../game/childhood-activities.js';

const labels={health:'健康',stress:'压力',academic:'学业',discipline:'自律',skill:'本事',insight:'眼力见',trust:'人缘',fame:'名气',credit:'信用'};
export function childhoodEffectText(change){
 const label=labels[change.key]??change.key;
 return `${label} ${change.value>0?'+':change.value<0?'−':''}${Math.abs(change.value)}`;
}
export function childhoodPreviewText(s,type){return childhoodActivityPreview(s,type).map(c=>c.value===0?`${labels[c.key]}不变`:childhoodEffectText(c)).join(' · ');}
export function renderChildhoodEffects(changes,{esc},{preview=false}={}){
 return `<span class="childhood-effects">${changes.map(c=>`<span>${esc(preview&&c.value===0?`${labels[c.key]}不变`:childhoodEffectText(c))}</span>`).join('')}</span>`;
}
