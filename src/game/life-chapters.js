/** Chapters group existing billing periods; loan terms and save history keep their clocks. */
import {FOOD_DAILY_COST,HUNGER_HEALTH_LOSS} from './survival.js';
export const CHAPTER_EXPERIENCE_DAYS = 3;
const boundaries = [
  ...Array.from({length:19},(_,i)=>18+i),
  ...Array.from({length:12},(_,i)=>38+i*2),65,70,75,80,
];
export const LIFE_CHAPTERS = Object.freeze(boundaries.slice(0,-1).map((start,i)=>Object.freeze({
  number:i+1,start,end:boundaries[i+1],
  name:start<22?'初入成年':start<36?'独立生活':start<60?'人生中场':'往后的日子',
})));
export function lifeChapter(s){
  if(s.age<18||s.age>=80)return null;
  const c=LIFE_CHAPTERS.find(c=>s.age>=c.start&&s.age<c.end);
  const elapsed=Math.max(0,Math.round((s.age-c.start)*360)+(s.debtClock?.periodDays||0));
  // Legacy saves already played day by day count immediately, without rewriting a save on render.
  const experienced=s.chapterPace?(s.chapterPace.start===c.start?s.chapterPace.experienced:0):Math.min(CHAPTER_EXPERIENCE_DAYS,elapsed);
  return {...c,total:LIFE_CHAPTERS.length,elapsed,days:(c.end-c.start)*360,experienced,ready:true};
}
export function recordChapterProgress(before,after,{automatic=false}={}){
  const c=lifeChapter(after),old=lifeChapter(before);
  if(!c){delete after.chapterPace;return;}
  const gained=automatic?0:Math.max(0,(after.debtClock?.day||0)-(before.debtClock?.day||0));
  after.chapterPace={start:c.start,experienced:old?.start===c.start?Math.min(CHAPTER_EXPERIENCE_DAYS,old.experienced+gained):0};
}
export function validateChapters(s){
  const bad=()=>{throw Error('存档中的人生章节记录无效');};
  if(s.chapterPace!==undefined){
    const p=s.chapterPace;
    // An archived or resumed life may retain an earlier chapter's counter. It is
    // ignored by lifeChapter and replaced on the next action, never credited twice.
    if(!p||!LIFE_CHAPTERS.some(c=>c.start===p.start)||p.start>s.age||!Number.isInteger(p.experienced)||p.experienced<0||p.experienced>CHAPTER_EXPERIENCE_DAYS)bad();
  }
  if(s.chapterSummary!==undefined){
    const r=s.chapterSummary;
    if(!r||Array.isArray(r)||typeof r!=='object')bad();
    for(const k of ['from','to'])if(typeof r[k]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r[k]))bad();
    for(const k of ['reason','kind'])if(typeof r[k]!=='string'||r[k].length>500)bad();
    for(const k of ['days','income','spending','target'])if(!Number.isSafeInteger(r[k])||r[k]<0)bad();
    if(r.days>1800||r.target<19||r.target>80)bad();
    if(r.changes!==undefined&&(!r.changes||Array.isArray(r.changes)||Object.entries(r.changes).some(([k,v])=>!['health','stress','academic','discipline','skill','insight','trust','fame','credit','fatigue'].includes(k)||!Number.isFinite(v))))bad();
    for(const k of ['cash','worth','holdings','trust'])if(!Number.isSafeInteger(r[k]))bad();
    if(r.debt!==undefined&&!Number.isSafeInteger(r.debt))bad();
    if(r.lastFood!==undefined){
      const f=r.lastFood;
      if(!f||Array.isArray(f)||typeof f!=='object'||!Number.isSafeInteger(f.foodDue)||f.foodDue<0||f.foodDue>FOOD_DAILY_COST||!Number.isSafeInteger(f.foodPaid)||f.foodPaid<0||f.foodPaid>f.foodDue||!Number.isFinite(f.healthLost)||f.healthLost<0||f.healthLost>HUNGER_HEALTH_LOSS||typeof f.hospital!=='boolean')bad();
    }
  }
}
