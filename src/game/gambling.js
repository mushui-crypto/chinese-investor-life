import {ensureOnlineGambling,recordOnlineBet,recordOnlineEvent} from './online-gambling.js';
/** Offline fictional gambling games. No network, account, or rendering-time RNG. */
export const GAMBLING_GAMES = Object.freeze({
  dragon_tiger:{name:'龙虎斗',tag:'一张牌，见高低',max:51,icon:'cards',rules:'龙、虎各发一张牌，A 最小、K 最大，花色不比大小。押龙/虎猜中总返还 2 倍，和局退一半；押和总返还 12 倍，同花同点总返还 51 倍。'},
  baccarat:{name:'百家乐',tag:'庄 · 闲 · 和',max:9,icon:'cards',rules:'各发两张牌，A 计 1，10/J/Q/K 计 0，总点数取个位，按补牌表自动补牌。押闲赢返还 2 倍，押庄赢返还 1.95 倍，押和赢返还 9 倍；和局时庄闲原注退回。'},
  dragon_cut:{name:'斩龙',tag:'长龙会在哪一手断',max:2,icon:'road',rules:'与百家乐共用真实发生的庄闲路单。连续至少 3 次同一方胜出后，可跟龙押同方，或斩龙押反方。和局不截断长龙；赔率与百家乐庄闲一致，每局重新洗八副牌，路单只记录已发生的结果。'},
  sicbo:{name:'骰宝',tag:'三颗骰子的悬念',max:181,icon:'dice',rules:'三颗六面骰。小为 4–10 点、大为 11–17 点，均不含三同号，猜中返还 2 倍；任意围骰返还 32 倍，指定围骰返还 181 倍。'},
  roulette:{name:'单零轮盘',tag:'小球停下之前',max:36,icon:'wheel',rules:'0–36 共 37 个号码。押单号中返还 36 倍；红/黑、单/双返还 2 倍。0 不属于红黑或单双，这些下注遇到 0 全输。'},
  slots:{name:'午夜老虎机',tag:'三轴一线 · 千倍大奖',max:1000,icon:'slots',rules:'转轴图案：铜钱、樱桃、铃铛、BAR、红七、玉印。三同图总返还依次为 3/8/25/60/200/1000 倍；恰好两颗樱桃返还 2 倍，其余为 0。'},
  redblack:{name:'红黑牌',tag:'熟悉的第一把',max:1.9,icon:'cards',rules:'开出红牌、黑牌或空牌。猜中总返还 1.9 倍，包含本金；开出空牌则输掉赌资。'},
});
export const SLOT_SYMBOLS=[{id:'coin',name:'铜钱',weight:8,pay:3},{id:'cherry',name:'樱桃',weight:5,pay:8},{id:'bell',name:'铃铛',weight:3,pay:25},{id:'bar',name:'BAR',weight:2,pay:60},{id:'seven',name:'红七',weight:1,pay:200},{id:'jade',name:'玉印',weight:1,pay:1000}];
export const RED_NUMBERS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const own=(o,k)=>Object.hasOwn(o,k);
export function gamblingGame(id){return own(GAMBLING_GAMES,id)?GAMBLING_GAMES[id]:null;}
export function newGambling(){return {rounds:0,staked:0,returned:0,last:null,history:[],roads:{baccarat:[],dragon_tiger:[]},lastObserved:null,bestWin:0,bestMultiplier:0,busts:0,house:{smallWins:0,smallStake:0,largestStake:0}};}
export function gamblingState(s){const old=s.trading?.gambling;return {...newGambling(),...old};}
export function gamblingAudit(s){
 const g=gamblingState(s),cases=(s.legal?.cases||[]).filter(c=>c.type==='gambling'),ids=new Set(cases.map(c=>c.id));
 const total=list=>list.reduce((n,c)=>n+c.confiscation+c.fine+c.restitution,0);
 return {rounds:g.rounds,staked:g.staked,returned:g.returned,tableNet:g.returned-g.staked,busts:g.busts,
  assessedBills:total(cases.filter(c=>c.settled)),pendingBills:total(cases.filter(c=>!c.settled)),
  unpaidBills:(s.debts||[]).filter(d=>ids.has(d.legalCaseId)).reduce((n,d)=>n+d.principal+d.interest,0)};
}
export function migrateGambling(g){for(const [k,v] of Object.entries(newGambling()))if(g[k]===undefined)g[k]=v;return g;}
export function baccaratStreak(g){const road=g.roads?.baccarat||[];let side=null,count=0;for(let i=road.length-1;i>=0;i--){const r=road[i];if(r==='tie')continue;if(side===null)side=r;if(r!==side)break;count++;}return {side,count};}
export function betChoices(game){
 const list={dragon_tiger:[['dragon','押龙'],['tiger','押虎'],['tie','押和'],['suited','同花同点']],baccarat:[['banker','押庄'],['player','押闲'],['tie','押和']],dragon_cut:[['cut','斩龙 · 押反方'],['follow','跟龙 · 押同方']],sicbo:[['small','小 · 4–10'],['big','大 · 11–17'],['triple','任意围骰'],['specific','指定围骰']],roulette:[['red','红'],['black','黑'],['odd','单'],['even','双'],['number','指定号码']],slots:[['spin','转动三轴']],redblack:[['red','红牌'],['black','黑牌']]};
 return own(list,game)?list[game]:[];
}
export function gamblingAvailability(s,a,availableCash){
 const game=a.game??'redblack',meta=gamblingGame(game);if(!meta)return '请选择已有赌局';
 if(a.type==='gamble_observe')return ['baccarat','dragon_cut','dragon_tiger'].includes(game)?'':'这个玩法没有观牌操作';
 if(!betChoices(game).some(([p])=>p===a.pick))return '先选择这一局押什么';
 if(a.reckless!==undefined&&typeof a.reckless!=='boolean')return '生活费开关无效';
 if(!Number.isSafeInteger(a.amount)||a.amount<10000)return '本局赌资至少 100 元，金额以分保存';
 if(a.amount>s.cash)return '现金不足，不会自动借款';
 if(a.amount*meta.max>Number.MAX_SAFE_INTEGER-s.cash||a.amount*meta.max>Number.MAX_SAFE_INTEGER-(s.trading?.gambling?.returned||0))return '金额超过本局可安全结算的上限';
 if((s.trading?.gambling?.staked||0)>Number.MAX_SAFE_INTEGER-a.amount)return '累计赌资已达到存档金额上限';
 if(game==='roulette'&&a.pick==='number'&&(!Number.isInteger(a.number)||a.number<0||a.number>36))return '轮盘号码须为 0–36';
 if(game==='sicbo'&&a.pick==='specific'&&(!Number.isInteger(a.number)||a.number<1||a.number>6))return '围骰点数须为 1–6';
 if(game==='dragon_cut'&&baccaratStreak(gamblingState(s)).count<3)return '还没有三连庄或三连闲，先观牌，或去百家乐参与';
 return '';
}
function randomIndex(draw,n){const r=draw();if(!Number.isFinite(r)||r<0||r>=1)throw Error('随机状态无效');return Math.floor(r*n);}
function shoeDraw(draw){const cards=Array.from({length:416},(_,n)=>({rank:n%13+1,suit:Math.floor(n/13)%4}));return ()=>cards.splice(randomIndex(draw,cards.length),1)[0];}
const points=cards=>cards.reduce((n,c)=>n+(c.rank>=10?0:c.rank),0)%10;
/** Standard third-card tableau, with a newly shuffled 8-deck shoe per round. */
export function dealBaccarat(draw){
 const card=shoeDraw(draw),p=[card()],b=[card()];p.push(card());b.push(card());
 const pp=points(p),bb=points(b);
 if(pp<8&&bb<8){
  if(pp<=5)p.push(card());
  if(p.length===2){if(bb<=5)b.push(card());}
  else {const third=p[2].rank>=10?0:p[2].rank;const hit=bb<=2||(bb===3&&third!==8)||(bb===4&&third>=2&&third<=7)||(bb===5&&third>=4&&third<=7)||(bb===6&&[6,7].includes(third));if(hit)b.push(card());}
 }
 const playerPoints=points(p),bankerPoints=points(b);return {player:p,banker:b,playerPoints,bankerPoints,winner:playerPoints===bankerPoints?'tie':playerPoints>bankerPoints?'player':'banker'};
}
export function slotMultiplier(reels){if(reels.length!==3||reels.some(x=>!SLOT_SYMBOLS.some(s=>s.id===x)))throw Error('转轴结果无效');return reels.every(x=>x===reels[0])?SLOT_SYMBOLS.find(s=>s.id===reels[0]).pay:reels.filter(x=>x==='cherry').length===2?2:0;}
export function resolveGamble(a,draw,g=newGambling()){
 const game=a.game??'redblack';let detail={},winner,multiplier=0,label='',bet=a.pick;
 if(['baccarat','dragon_cut'].includes(game)){
  if(game==='dragon_cut'){const streak=baccaratStreak(g);if(streak.count<3)throw Error('斩龙需要已发生的三连走势');bet=a.pick==='follow'?streak.side:streak.side==='banker'?'player':'banker';detail={streakBefore:streak.count,sideBefore:streak.side};}
  detail={...detail,...dealBaccarat(draw),bet};winner=detail.winner;
  multiplier=winner==='tie'?(bet==='tie'?9:1):winner===bet?(bet==='banker'?1.95:2):0;
  label=`庄 ${detail.bankerPoints} 点，闲 ${detail.playerPoints} 点，${winner==='tie'?'和局':winner==='banker'?'庄赢':'闲赢'}${game==='dragon_cut'?'；你押的是'+(bet==='banker'?'庄':'闲'):''}`;
 }else if(game==='dragon_tiger'){
  const card=shoeDraw(draw),dragon=card(),tiger=card();detail={dragon,tiger};winner=dragon.rank===tiger.rank?'tie':dragon.rank>tiger.rank?'dragon':'tiger';
  multiplier=a.pick==='suited'?(winner==='tie'&&dragon.suit===tiger.suit?51:0):a.pick==='tie'?(winner==='tie'?12:0):winner==='tie'?.5:winner===a.pick?2:0;
  label=`龙 ${rankName(dragon.rank)}，虎 ${rankName(tiger.rank)}，${winner==='tie'?'和局':winner==='dragon'?'龙赢':'虎赢'}`;
 }else if(game==='sicbo'){
  const dice=Array.from({length:3},()=>randomIndex(draw,6)+1),total=dice.reduce((a,b)=>a+b),triple=dice.every(x=>x===dice[0]);detail={dice,total,triple,number:a.pick==='specific'?a.number:null};winner=triple?'triple':total<=10?'small':'big';
  multiplier=a.pick==='specific'?(triple&&dice[0]===a.number?181:0):a.pick==='triple'?(triple?32:0):a.pick===winner?2:0;label=`${dice.join(' · ')}，${total} 点${triple?'，三同号':'，'+(total<=10?'小':'大')}`;
 }else if(game==='roulette'){
  const number=randomIndex(draw,37),color=number===0?'zero':RED_NUMBERS.has(number)?'red':'black';detail={number,color,target:a.pick==='number'?a.number:null};winner=color;
  multiplier=a.pick==='number'?(a.number===number?36:0):number===0?0:(a.pick===color||(a.pick==='odd'&&number%2===1)||(a.pick==='even'&&number%2===0))?2:0;label=`小球停在 ${number}${number===0?' · 绿色零号':color==='red'?' · 红':' · 黑'}`;
 }else if(game==='slots'){
  const reels=Array.from({length:3},()=>{let n=randomIndex(draw,20);for(const x of SLOT_SYMBOLS){if(n<x.weight)return x.id;n-=x.weight;}});detail={reels};multiplier=slotMultiplier(reels);winner=multiplier>0?'prize':'empty';label=reels.map(id=>SLOT_SYMBOLS.find(x=>x.id===id).name).join(' · ');
 }else if(game==='redblack'){
  const r=draw();winner=r<.46?'red':r<.92?'black':'blank';detail={face:winner};multiplier=winner===a.pick?1.9:0;label='开出'+({red:'红牌',black:'黑牌',blank:'空牌'}[winner]);
 }else throw Error('未知赌局');
 return {game,pick:a.pick,winner,multiplier,detail,label};
}
export function rankName(n){return ({1:'A',11:'J',12:'Q',13:'K'})[n]||String(n);}
/** Fictional black-platform dealing. Persistent across tables; never changes a settled receipt. */
export function resolveHouseGamble(a,draw,g,cash){
 const h=g.house??=newGambling().house;
 const small=a.amount<=50000&&a.amount<=cash*.1;
 const large=a.amount>=cash*.4||(h.smallStake>0&&a.amount>=h.smallStake*4);
 const modestBet=['dragon','tiger','banker','player','cut','follow','small','big','red','black','odd','even','spin'].includes(a.pick);
 const warm=!large&&small&&modestBet&&g.rounds<3&&h.smallWins<2;
 let result=resolveGamble(a,draw,g);
 const roll=draw();
 const target=warm&&roll<.9?r=>r.multiplier>1&&r.multiplier<=3:
   !warm&&roll<(large?.9:.4)?r=>r.multiplier===0:null;
 if(target&&!target(result)){
  // Re-deal a consistent outcome, not a different payout for the visible cards.
  for(let i=0;i<64;i++){const candidate=resolveGamble(a,draw,g);if(target(candidate)){result=candidate;break;}}
 }
 if(warm&&result.multiplier>1&&result.multiplier<=3)h.smallWins++;
 if(small)h.smallStake=Math.max(h.smallStake,a.amount);
 h.largestStake=Math.max(h.largestStake,a.amount);
 return result;
}
function rememberRoad(g,r){const key=['baccarat','dragon_cut'].includes(r.game)?'baccarat':r.game==='dragon_tiger'?'dragon_tiger':null;if(key){g.roads[key].push(r.winner);g.roads[key]=g.roads[key].slice(-60);}}
const safeSum=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n)||n<0)throw Error('赌局账本超出范围');return n;};
export function executeGambling(s,a,api){
 const g=migrateGambling(s.trading.gambling),game=a.game??'redblack';
 if(a.type==='gamble_observe'){
  const r=resolveGamble({game:game==='dragon_cut'?'baccarat':game,pick:game==='dragon_tiger'?'dragon':'banker'},()=>api.draw(s),g);rememberRoad(g,r);g.lastObserved=r;return `你只看了一局，没有下注。${r.label}。路单仅记录已经发生的结果。`;
 }
 ensureOnlineGambling(s);const beforeAssets=api.metrics(s).assets;
 const beforeCash=s.cash;api.cashChange(s,-a.amount,`${GAMBLING_GAMES[game].name}本局赌资`);
 const r=resolveHouseGamble(a,()=>api.draw(s),g,beforeCash),returned=api.mul(a.amount,r.multiplier),net=returned-a.amount;
 if(returned)api.cashChange(s,returned,`${GAMBLING_GAMES[game].name}本局返还（含本金）`);
 let c=s.legal.cases.find(c=>c.type==='gambling'&&c.openedTurn===s.turn&&!c.settled);if(!c)c=api.openLegalCase(s,{case_type:'gambling',profit_yuan:0},{});
 const profit=Math.max(0,net);c.profit=safeSum(c.profit,profit);c.confiscation=c.profit;
 g.rounds++;g.staked=safeSum(g.staked,a.amount);g.returned=safeSum(g.returned,returned);g.bestWin=Math.max(g.bestWin,profit);g.bestMultiplier=Math.max(g.bestMultiplier,r.multiplier);const bust=beforeCash>0&&s.cash===0;if(bust){g.busts++;s.flags.gambling_cash_bust=true;}
 g.last={...r,stake:a.amount,returned,day:s.trading.day,round:g.rounds,bust,reckless:Boolean(a.reckless),...(game==='redblack'?{face:r.winner}:{})};g.history.push(g.last);g.history=g.history.slice(-60);g.lastObserved=null;rememberRoad(g,r);
 s.flags.gambling_history=true;s.flags.gambling_quit=false;if(g.rounds>=3)s.flags.gambling_habit=true;if(r.multiplier>=10)s.flags.gambling_big_win=true;
 api.stat(s,{stress:bust?15:net>0?-2:net<0?7:1,trust:-1});
 recordOnlineBet(s,{stake:a.amount,returned,source:'casino:'+game,choice:'继续参与',bigWin:r.multiplier>=10},{...api.metrics(s),assets:Math.max(beforeAssets,api.metrics(s).assets)});
 recordOnlineEvent(s,{eventId:'casino:'+game,choice:'继续参与',exitOpportunity:true});
 return `${r.label}。投入 ¥${a.amount/100}，总返还 ¥${returned/100}，${net>0?'净赢':net<0?'净亏':'不赚不亏'}${net===0?'':` ¥${Math.abs(net)/100}`}。${bust?'手里的现金归零了，持有资产和欠款仍在；可以返回生活接活或求职。':net>0?'这局的钱到账了，网赌相关账单还没结清。':'这局已记入输赢账本。'}`;
}

/** Strict shape checks while preserving v1.3's red/black receipt unchanged. */
export function validateGambling(g,day){
 const bad=()=>{throw Error('存档中的赌局记录无效');},int=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(n)||n<min||n>max)bad();};
 if(!g||typeof g!=='object'||Array.isArray(g))bad();migrateGambling(g);
 for(const k of ['rounds','staked','returned','bestWin','busts'])int(g[k]);if(!Number.isFinite(g.bestMultiplier)||g.bestMultiplier<0||g.bestMultiplier>1000)bad();
 const h=g.house;if(!h||typeof h!=='object'||Array.isArray(h))bad();int(h.smallWins,0,Math.min(2,g.rounds));int(h.smallStake,0,50000);int(h.largestStake);if(h.smallStake>h.largestStake||h.largestStake>g.staked)bad();
 if(!g.roads||!Array.isArray(g.roads.baccarat)||!Array.isArray(g.roads.dragon_tiger))bad();
 for(const [key,allowed] of [['baccarat',['banker','player','tie']],['dragon_tiger',['dragon','tiger','tie']]]){if(g.roads[key].length>60||g.roads[key].some(x=>!allowed.includes(x)))bad();}
 const card=c=>{if(!c)bad();int(c.rank,1,13);int(c.suit,0,3);};
 const outcome=r=>{
  if(!r||!gamblingGame(r.game)||!betChoices(r.game).some(([p])=>p===r.pick)||typeof r.label!=='string'||r.label.length>300||!Number.isFinite(r.multiplier)||r.multiplier<0||r.multiplier>GAMBLING_GAMES[r.game].max)bad();const d=r.detail;if(!d||typeof d!=='object')bad();
  if(['baccarat','dragon_cut'].includes(r.game)){for(const k of ['player','banker']){if(!Array.isArray(d[k])||d[k].length<2||d[k].length>3)bad();d[k].forEach(card);}if(d.playerPoints!==points(d.player)||d.bankerPoints!==points(d.banker)||!['banker','player','tie'].includes(r.winner)||!['banker','player','tie'].includes(d.bet))bad();}
  if(r.game==='dragon_tiger'){card(d.dragon);card(d.tiger);if(!['dragon','tiger','tie'].includes(r.winner))bad();}
  if(r.game==='sicbo'){if(!Array.isArray(d.dice)||d.dice.length!==3)bad();d.dice.forEach(n=>int(n,1,6));if(d.total!==d.dice.reduce((a,b)=>a+b)||typeof d.triple!=='boolean'||!['small','big','triple'].includes(r.winner))bad();if(r.pick==='specific')int(d.number,1,6);}
  if(r.game==='roulette'){int(d.number,0,36);if(!['red','black','zero'].includes(d.color)||r.winner!==d.color)bad();if(r.pick==='number')int(d.target,0,36);}
  if(r.game==='slots'){if(!Array.isArray(d.reels)||slotMultiplier(d.reels)!==r.multiplier||!['prize','empty'].includes(r.winner))bad();}
  if(r.game==='redblack'&&(!['red','black','blank'].includes(d.face)||r.winner!==d.face))bad();
 };
 const receipt=r=>{int(r.stake,10000);int(r.returned);int(r.day,0,day);if(r.game===undefined){if(!['red','black','blank'].includes(r.face)||!['red','black'].includes(r.pick))bad();return;}outcome(r);int(r.round,1,g.rounds);if(typeof r.bust!=='boolean'||typeof r.reckless!=='boolean')bad();if(r.returned!==Number((BigInt(r.stake)*BigInt(Math.round(r.multiplier*1000000))+500000n)/1000000n))bad();};
 if(g.last!==null)receipt(g.last);if(g.lastObserved!==null)outcome(g.lastObserved);
 if(!Array.isArray(g.history)||g.history.length>60)bad();g.history.forEach(receipt);for(let i=1;i<g.history.length;i++)if(g.history[i].round<=g.history[i-1].round)bad();
 if(g.history.length&&JSON.stringify(g.history.at(-1))!==JSON.stringify(g.last))bad();if(g.busts>g.rounds||g.bestWin>g.returned)bad();
 return g;
}
