import {isCollegeStudent} from './education.js';
import {hasSalariedJob} from './work-economy.js';

const now=s=>s.debtClock?.day||0;
function hash(value){let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function record(s,day,source){return {version:1,lostOn:day,readyOn:day+90+hash(`${s.seed}:job-search:${s.career?.jobs||0}:${day}:${source}`)%181,source,completedOn:null};}
export function startJobSearch(s,{day=now(s),source='layoff'}={}){
 if(s.jobSearch?.completedOn===null)return s.jobSearch;
 return s.jobSearch=record(s,day,source);
}
// Old saves derive the same window from their last recorded job loss, without
// restarting it on reload or when the player opens the opportunities dialog.
export function jobSearchState(s){
 if(s.jobSearch)return s.jobSearch;
 if(hasSalariedJob(s)||s.age<18||isCollegeStudent(s)||s.occupation==='退休'||s.legal?.prisonMonthsLeft)return null;
 const laid=s.employment?.history.filter(r=>r.kind==='layoff').at(-1),fired=s.attendance?.records.filter(r=>r.fired).at(-1);
 const loss=[laid&&{day:laid.day,source:'layoff'},fired&&{day:fired.day,source:'dismissal'}].filter(Boolean).sort((a,b)=>b.day-a.day)[0];
 if(loss)return record(s,loss.day,loss.source);
 if(s.career&&/离职|开除/.test(s.occupation))return record(s,s.career.lastDay,'separation');
 return null;
}
export function ensureJobSearch(s){const q=jobSearchState(s);if(q&&!s.jobSearch)s.jobSearch=q;return q;}
export function jobSearchWait(s){
 if(hasSalariedJob(s))return '';
 const q=jobSearchState(s);
 if(!q||q.completedOn!==null||now(s)>=q.readyOn)return '';
 return now(s)-q.lostOn<30?'离开原岗位后，还在整理简历、联系招聘方，暂时没有合适的录用机会。':'简历仍在投递和筛选中，面试还没有落实录用；可以先接零工、提升本事，继续过日子。';
}
export function completeJobSearch(s){const q=ensureJobSearch(s);if(q&&q.completedOn===null)q.completedOn=now(s);}
export function validateJobSearch(s){
 const q=s.jobSearch;if(q===undefined)return;
 const int=n=>Number.isSafeInteger(n)&&n>=0;
 if(!q||q.version!==1||!int(q.lostOn)||q.lostOn>now(s)||!int(q.readyOn)||q.readyOn-q.lostOn<90||q.readyOn-q.lostOn>270||!['layoff','dismissal','separation'].includes(q.source)||!(q.completedOn===null||int(q.completedOn)&&q.completedOn>=q.readyOn&&q.completedOn<=now(s)))throw Error('求职进展记录无效');
}
