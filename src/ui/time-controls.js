import {lifeChapter} from '../game/life-chapters.js';
export function renderFastForward(s,{esc},classes='button',daily=false){
 return lifeChapter(s)&&s.phase==='planning'?`<button class="${classes}" data-action="stage-return">回到阶段安排</button>`:'';
}
