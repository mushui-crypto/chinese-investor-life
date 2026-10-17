import {stagePlan,stageOptions} from '../game/stage-plan.js';
import {lifeChapter} from '../game/life-chapters.js';
import {dailyEventRole} from '../game/day-routine.js';
import {dailyScene} from './daily-scene.js';
/** A representative scene for the period, not a mutation of the live trading clock. */
export function stageScene(s){
 if(s.dayRoutine?.pending||s.lifeArcs?.pending||s.behavior?.pending)return dailyScene(s);
 // Before a focus is chosen, show the role's ordinary setting instead of the
 // hidden daily clock's breakfast scene. This does not select a plan or move time.
 const p=stagePlan(s),focus=p?.focus||'steady';
 const role=dailyEventRole(s),slot=focus==='parttime'||focus==='social'?5:focus==='steady'?1:3;
 const choice={study:role==='student'?'coursework':'learn',parttime:'night_gig',social:'friends',market:'review',recover:'rest'}[focus];
 const scene=dailyScene({...s,lastResult:null,dayRoutine:{...s.dayRoutine,stage:slot,choices:choice?{[slot]:choice}:{},pending:null}});
 if(!scene)return null;
 const chapter=lifeChapter(s);
 if(!p&&role==='student'&&chapter?.start===18&&chapter.elapsed===0)return {...scene,key:'campus-arrival',src:'./public/assets/daily/campus-arrival-v1.webp',title:'第一次踏入大学校园',line:'行李箱拉进校门，大学生活就从这里开始。',stamp:'stage:18:campus-arrival'};
 const title=p?stageOptions(s).find(o=>o.id===focus)?.title:{student:'大学生活',employed:'工作与生活',self:'照看生意',retired:'退休生活',unemployed:'寻找生活方向'}[role];
 if(focus==='parttime')Object.assign(scene,{key:'gig',src:'./public/assets/daily/gig-night-v1.webp',motion:'lamp',night:true});
 if(focus==='market'&&role!=='employed'&&role!=='student')Object.assign(scene,{key:'home-trading',src:'./public/assets/daily/home-trading-v1.webp',motion:'screen'});
 const lines={steady:role==='student'?'上课、交作业，日子一页页往前翻。':role==='employed'?'把手头的工作做好，再想想接下来的打算。':'把眼前的生活照顾好，再慢慢往前走。',study:role==='student'?'课后再多看一会儿，总有一点东西留在脑子里。':'每天多练一点，本事慢慢攒起来。',parttime:'这段时间，留些空闲接活，挣来的钱一笔笔记下。',social:'抽空见见面，也听听他们最近的日子。',market:'行情经常打开，买卖还得自己拿主意。',recover:'把日子过稳一些，先让身体和精神缓过来。'};
 const entryLines={student:'上课、作业和课余生活，接下来想把心思放在哪里？',employed:'工作之外，也想给自己的生活留点时间。',self:'照看生意之余，也盘算盘算接下来的日子。',retired:'日子慢下来，可以留些时间给喜欢的事。',unemployed:'先找一份合适的工作，再慢慢把日子过稳。'};
 return {...scene,title,line:p?lines[focus]:entryLines[role],stamp:`stage:${p?.start??s.age}:${p?.focus||'unselected'}:${role}`};
}
