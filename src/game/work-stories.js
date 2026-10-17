import {meetPerson} from './people.js';
import {remember} from './life-arcs.js';
const day=s=>s.debtClock?.day||0;
const step=(chain,stage)=>s=>(s.workStories?.[chain]?.stage||'new')===stage;
const event=(chain,stage,person,title,text,choices,stages=[1,3],roles=['employed'])=>({chain,storyStage:stage,person,title,text,choices,stages,roles,when:step(chain,stage)});
export const WORK_STORY_EVENTS={
 zhou_cover:event('zhou','new','N04','老周想早点去接孩子','老周的交接表还差几项。他指着墙上的钟，问你能不能帮着核完。', [['help','接过来核完','疲劳 +4 · 老周信任 +3'],['decline','说清自己的进度','老周信任 −1']]),
 zhou_return:event('zhou','return','N04','老周把整理好的模板发来了','“上回多亏你。这个我用了几年，你拿去省点事。”', [['learn','跟他学一遍','本事 +2 · 疲劳 +3 · 老周信任 +2'],['thanks','道谢，先收好','老周信任 +1']], [2,5],[]),
 zhou_request:event('zhou','request','N04','老周搬家，少一个搭手的人','几天前的模板还放在电脑桌面。他问你今晚能不能帮着搬几箱东西。', [['help','下班后过去帮忙','占用今晚 · 疲劳 +10 · 老周信任 +4'],['decline','这次实在走不开','老周信任 −2']], [5],[]),
 zhou_thanks:event('zhou','thanks','N04','老周发来一个红包','“搬家那天没顾上请饭，这顿补上。”红包里是八十块钱。', [['accept','收下，下次再聚','到账 ¥80 · 老周信任 +1'],['refuse','饭下次吃，钱退回去','不收钱 · 老周信任 +2']], [2,5],[]),
 wu_error:event('wu','new','N12','吴师傅那份报表，错了一个数','月底汇总还没发出去，你发现自己交上去的那份数据多算了一项。', [['report','马上说明，补一份更正','压力 +2 · 吴师傅信任 +2'],['hide','先放着，等有没有人问','压力 +3 · 留下未更正的记录']]),
 wu_review:event('wu','review','N12','吴师傅让你再核一次','他把那份已更正的报表推过来：“这回跟原始单据逐项对一下。”', [['check','逐项核完，留好记录','疲劳 +6 · 自律 +2'],['rush','扫一遍，先交上去','压力 +1 · 复核可能不过关']]),
 wu_bonus:event('wu','bonus','N12','这次复核有了结果','几天前核对过的单据全对上了。吴师傅给这次额外核查批了 150 元补贴。', [['accept','签收补贴','到账 ¥150 · 吴师傅信任 +3'],['decline','这次不领，记好经验','本事 +2 · 吴师傅信任 +2']]),
 wu_rework:event('wu','rework','N12','报表又被退了回来','上次匆匆扫过的几行仍然对不上。吴师傅要求今天重新核完。', [['repair','重新核，承认没查仔细','疲劳 +8 · 吴师傅信任 −2'],['explain','把问题逐条说清','压力 +4 · 吴师傅信任 −3']]),
 wu_audit:event('wu','audit','N12','月底对账，那个错数还是找到了','原始记录和报表摆在一起。吴师傅问你为什么发现以后没有更正。', [['admit','承认漏报，补齐记录','工作扣款 ¥30 · 疲劳 +6 · 吴师傅信任 −4'],['argue','坚持不是自己的问题','工作扣款 ¥50 · 压力 +6 · 吴师傅信任 −6']])
};
export function workStoryReady(s,id){const e=WORK_STORY_EVENTS[id],v=s.workStories?.[e?.chain];return Boolean(e&&e.when(s)&&(e.storyStage==='new'||v.due<=day(s)));}
export function dueWorkStory(s,stage,role){return Object.entries(WORK_STORY_EVENTS).find(([id,e])=>e.storyStage!=='new'&&workStoryReady(s,id)&&e.stages.includes(stage)&&(!e.roles.length||e.roles.includes(role)))?.[0];}
export function showWorkStory(s,id){const e=WORK_STORY_EVENTS[id];if(e)meetPerson(s,e.person);}
export function chooseWorkStory(s,id,choice,api){
 const e=WORK_STORY_EVENTS[id];if(!e)return null;
 s.workStories??={};const next=(stage,days=0)=>s.workStories[e.chain]={stage,due:day(s)+days};
 let stats={},fatigue=0,trust=0,text='';
 switch(id){
 case 'zhou_cover': if(choice==='help'){fatigue=4;trust=3;next('return',3);text='交接表核完了。老周记住了这次帮忙。';}else{trust=-1;next('done');text='你说清了手头的事，老周另找人帮忙。';}break;
 case 'zhou_return': if(choice==='learn'){stats={skill:2};fatigue=3;trust=2;text='模板学会了，老周说以后有事可以互相搭把手。';}else{trust=1;text='你收下模板，给老周回了声谢谢。';}next('request',5);break;
 case 'zhou_request': if(choice==='help'){fatigue=10;trust=4;next('thanks',4);s.dayRoutine.choices[5]='friends';text='你帮老周搬完最后几箱，今天的傍晚就这样过了。';}else{trust=-2;next('done');text='这次没能去帮忙，老周自己找了人。';}break;
 case 'zhou_thanks': if(choice==='accept'){api.cashChange(s,8000,'老周补的饭钱');trust=1;text='八十元收下了。你们说好以后有空再聚。';}else{trust=2;text='红包退了回去，约着有空一起吃饭。';}next('done');break;
 case 'wu_error': if(choice==='report'){stats={stress:2};trust=2;next('review',3);text='更正送到了吴师傅手里，他说过几天一起复核。';}else{stats={stress:3};next('audit',3);text='报表留在了原处，那个错数也还在。';}break;
 case 'wu_review': if(choice==='check'){stats={discipline:2};fatigue=6;next('bonus',4);text='原始单据逐项核完，等吴师傅确认。';}else{stats={stress:1};next('rework',2);text='你匆匆交了回去，还没核清的几行留给了复核。';}break;
 case 'wu_bonus': if(choice==='accept'){api.cashChange(s,15000,'报表核查补贴');trust=3;text='核查补贴一百五十元到账，这次工作记在吴师傅的记录里。';}else{stats={skill:2};trust=2;text='补贴没有领，你把核查步骤记了下来。';}next('done');break;
 case 'wu_rework': if(choice==='repair'){fatigue=8;trust=-2;text='这次逐条核完了，吴师傅要求以后先检查再交。';}else{stats={stress:4};trust=-3;text='问题说清了，吴师傅仍记下了这次返工。';}next('done');break;
 case 'wu_audit': if(choice==='admit'){api.charge(s,3000,'漏报差错扣款');fatigue=6;trust=-4;text='扣款三十元，未付部分记入欠款。你补齐了记录。';}else{api.charge(s,5000,'漏报差错扣款');stats={stress:6};trust=-6;text='扣款五十元，未付部分记入欠款。这次争执留在了工作记录里。';}next('done');break;
 }
 api.stat(s,stats);s.behavior.fatigue=Math.min(100,s.behavior.fatigue+fatigue);remember(s,e.person,`${e.title}：${text}`,trust);return text;
}
export function validateWorkStories(s){
 const v=s.workStories;if(v===undefined)return;
 const states={zhou:['return','request','thanks','done'],wu:['review','bonus','rework','audit','done']};
 if(!v||Array.isArray(v)||typeof v!=='object')throw Error('工作往来记录无效');
 for(const [key,x] of Object.entries(v))if(!states[key]?.includes(x?.stage)||!Number.isSafeInteger(x?.due)||x.due<0)throw Error('工作往来记录无效');
}
