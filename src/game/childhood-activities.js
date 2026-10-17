import {growthDelta} from './growth.js';
import {childhoodStageYears} from './childhood-stages.js';
// Saved action IDs stay stable. Each choice is a habit across the remaining stage.
const activity=(type,icon,label,delta,title,text,family=false)=>({type,icon,label,delta,title,text,family});
export const CHILD_REBEL_ACTIONS=['child_game','child_talkback','child_skipclass','child_latenight'];
const stages=[
 {until:1,focus:{study:'认识周围',practical:'摸摸抓抓',social:'家人陪伴'},actions:[
  activity('study','spark','感官探索',{insight:2,stress:-1},'一点点认识周围','家人用摇铃、声音和拥抱陪你认识周围，你开始回应熟悉的声音。'),
  activity('rest','sun','规律作息',{health:8,stress:-8},'吃饱，睡好','家人慢慢摸清了你的作息，吃饭和睡觉都有了规律。'),
  activity('social','heart','亲子陪伴',{trust:3,stress:-5},'熟悉的怀抱','有人回应你的哭声，也有人陪你咿咿呀呀。熟悉的怀抱让你安心。',true),
 ]},
 {until:3,focus:{study:'探索与玩耍',practical:'动手尝试',social:'家人陪伴'},actions:[
  activity('study','spark','玩耍探索',{insight:3,discipline:1},'在玩耍中长大','积木搭倒了再来，小车推远了再追。家人陪着你尝试，你渐渐学会自己动手。'),
  activity('rest','sun','规律作息',{health:8,stress:-8},'睡足了再去玩','家人守住了午睡和晚睡的时间，你吃得下，也睡得安稳。'),
  activity('social','heart','亲子陪伴',{trust:4,stress:-5},'家里总有人陪你','一起说话、玩游戏、出去散步，家人陪着你走过这几年。',true),
 ]},
 {until:6,focus:{study:'故事与绘本',practical:'拼搭游戏',social:'一起玩耍'},actions:[
  activity('study','book','亲子阅读',{insight:3,discipline:1},'故事陪着你长大','家人常常陪你翻绘本。你从看图、提问，慢慢开始自己讲故事。'),
  activity('rest','sun','户外玩耍',{health:7,stress:-7},'跑跑跳跳的几年','放学后常有一段户外时间。追球、爬台阶、走小路，你的动作越来越稳。'),
  activity('social','people','集体游戏',{trust:4,stress:-4,discipline:1},'慢慢学会一起玩','在幼儿园里，你练习轮流拿玩具、一起收拾，也渐渐交到了玩伴。'),
 ]},
 {until:12,focus:{study:'读书求知',practical:'动手与生活',social:'同学与家人'},actions:[
  activity('study','book','上课做作业',{academic:5,discipline:2,insight:1,stress:2},'作业本一页页写满','上课跟着老师读课文、做算术，回家写完作业，再请家人帮忙检查。'),
  activity('rest','sun','放学玩耍',{health:8,stress:-10},'放学后再玩一会儿','放学后，你在家附近跳绳、踢毽子。家人喊吃饭时，才拍掉裤子上的灰跑回去。'),
  activity('social','people','和同学玩',{trust:5,stress:-4},'课间一起玩','下课后，你和同学跳房子、玩捉迷藏。偶尔闹别扭，第二天又凑到了一起。'),
 ]},
 {until:15,focus:{study:'读书求知',practical:'动手与生活',social:'同学与家人'},actions:[
  activity('study','book','复习功课',{academic:5,discipline:2,insight:2,stress:3},'把不会的题弄明白','科目多了，放学后先写作业，再翻翻当天的笔记。实在不懂的题，第二天去问老师。'),
  activity('rest','sun','课后运动',{health:8,stress:-10},'操场上跑几圈','体育课认真跟着练，放学后和同学打会儿球。出一身汗，再背着书包回家。'),
  activity('social','people','和同学聊天',{trust:5,stress:-4},'放学路上的闲话','课间和放学路上，你们聊漫画、球赛和班里的趣事，也会互相借笔记、讲难题。'),
  {...activity('child_game','spark','课后打两局',{trust:3,stress:-6,academic:-1},'课间多了共同话题','放学后，你和同学轮流玩游戏，第二天课间还在聊怎么过关。人熟了，心情也轻松了，只是留给复习的时间少了一点。'),legacyTitle:'作业旁边藏着游戏机'},
  {...activity('child_talkback','people','坚持自己的主意',{insight:4,discipline:2,stress:-3,trust:-1},'这次想自己做决定','你想自己安排周末，和家人争了几句，也答应把该做的事完成。慢慢学着说清理由、兑现承诺；家人还不太习惯，偶尔仍会有摩擦。'),legacyTitle:'不想什么都听大人的'},
 ]},
 {until:18,focus:{study:'读书求知',practical:'动手与生活',social:'同学与家人'},actions:[
  activity('study','book','备考积累',{academic:6,discipline:2,insight:2,stress:3},'把薄弱处一点点补上','你把复习排进日常，隔几周回看薄弱科目，让练过的题真正留下来。'),
  activity('rest','sun','运动与作息',{health:8,stress:-10},'再忙也留一点喘息','晚自习之外，你尽量睡够，也留出走路和运动的时间。'),
  activity('social','people','维系朋友',{trust:5,stress:-4},'各有压力，也有人说话','你和朋友保持来往，聊考试，也聊毕业后想做什么。忙起来时，彼此还能搭把手。'),
  {...activity('child_skipclass','spark','和朋友组队开黑',{trust:5,stress:-8,academic:-2},'这一局靠大家配合','周末去朋友家打游戏，赢了互相击掌，输了就研究下一局。你花了些零花钱买零食饮料，和朋友更熟了，但几次玩过头，周末的复习没做完。'),cost:3000,legacyTitle:'有几节课没回教室'},
  {...activity('child_latenight','clock','熬夜看小说',{insight:3,stress:-8,health:-2,academic:-1},'再看一章就睡','故事正到精彩处，你舍不得合上书。跟着不同人物的经历想了很多，也暂时忘了考试压力；只是睡得少了，第二天上课容易走神。'),legacyTitle:'灯熄了，人还没睡'},
 ]},
];
export function childhoodActivities(s){return stages.find(stage=>s.age<stage.until)?.actions??[];}
export function childhoodActivity(s,type){return childhoodActivities(s).find(action=>action.type===type);}
// Preview the same yearly, capped growth as the engine without touching saves or RNG.
export function childhoodActivityPreview(s,type){
 const action=childhoodActivity(s,type);if(!action)return [];
 const copy={age:s.age,stats:{...s.stats}};
 for(let year=0;year<childhoodStageYears(s);year++)for(const [key,value] of Object.entries(action.delta)){
  copy.stats[key]=Math.max(0,Math.min(100,copy.stats[key]+growthDelta(copy,key,value)));
 }
 return Object.keys(action.delta).map(key=>({key,value:copy.stats[key]-s.stats[key]}));
}
export function childhoodFocusNames(s){return stages.find(stage=>s.age<stage.until)?.focus??{study:'读书求知',practical:'动手与生活',social:'亲友往来'};}
