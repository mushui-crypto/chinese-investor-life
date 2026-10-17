/** Five formative decisions, selected at arrival, using a save-owned random stream. */
export const STUDENT_AGES=[6,10,13,16,17];
export const STUDENT_TRAITS=['riskTaking','chasing','restraint','analysis','probability','superstition','allIn','impulse'];
export const isStudentStory=id=>/^STU_[A-H][1-5](?:_MORE)?$/.test(id||'');
export const needsStudentChoice=s=>s.age<18&&s.phase==='event'&&isStudentStory(s.activeEvent?.eventId);
export const newStudentStories=()=>({version:1,traits:Object.fromEntries(STUDENT_TRAITS.map(k=>[k,10])),friend:{name:'阿川',relationship:50,borrowed:0},history:[],selected:[],pending:null,resources:null,summary:null,rng:0x591be23});
const clamp=n=>Math.max(0,Math.min(100,n));
const positive=o=>['win','big_win','streak_win'].includes(o);
const negative=o=>['loss','big_loss','streak_loss','renege'].includes(o);
const ACTIVE=new Set(['allin','small','risk','partner','borrow','buy','chase','test']);
const ACTION_TRAITS={allin:{riskTaking:6,allIn:8,impulse:4,restraint:-2},small:{riskTaking:2,restraint:2},risk:{riskTaking:4,superstition:4},partner:{riskTaking:2,restraint:1},borrow:{chasing:7,impulse:3},buy:{riskTaking:2},chase:{chasing:7,impulse:4,restraint:-2},test:{analysis:3,probability:2,riskTaking:1},observe:{analysis:6,probability:4},exchange:{analysis:3,restraint:3},organize:{analysis:4,probability:2},redeem:{restraint:5},leave:{restraint:5,riskTaking:-1},drink:{restraint:3},purchase:{analysis:2,restraint:2}};
function nextRandom(ss){let x=ss.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;ss.rng=x>>>0;return ss.rng/4294967296;}
export function seedStudentStories(s,seed){let h=2166136261;for(const c of String(seed)){h=Math.imul(h^c.charCodeAt(0),16777619);}s.studentStories=newStudentStories();s.studentStories.rng=h>>>0||1;}
export function studentEventWeight(s,e){
 const ss=s.studentStories;if(!ss||!e.studentStory)return 0;
 const {line}=e.studentStory,t=ss.traits,history=ss.history.filter(h=>!h.followup);
 const affinity={A:t.riskTaking*.45+t.allIn*.3,B:t.analysis*.2+t.chasing*.2,C:t.superstition*.7,D:t.chasing*.8,E:t.analysis*.55+t.probability*.2,F:ss.friend.relationship*.15,G:t.analysis*.35,H:t.restraint*.7}[line];
 let w=10+affinity;
 if(history.some(h=>h.line===line))w+=7;
 if(history.at(-1)?.line===line)w*=.55; // continuity without railroading a whole line
 if(line==='D'&&history.some(h=>negative(h.variant)||['STU_D1','STU_D2','STU_D3'].includes(h.eventId)))w+=18;
 if(line==='C'&&history.some(h=>positive(h.variant)||['STU_C1','STU_H1','STU_H2'].includes(h.eventId)))w+=14;
 if(line==='F'&&history.some(h=>h.action==='partner'||h.action==='borrow'))w+=15;
 if(line==='B'&&history.some(h=>h.resource==='cards'&&h.delta<0))w+=12;
 if(line==='H'&&history.some(h=>h.action==='leave'||h.action==='redeem'))w+=10;
 return Math.max(1,w);
}
function resourceBudget(s,e){const r=e.studentStory.resource;if(r==='cash')return Math.min(50,Math.floor(s.cash/100));if(r==='packs')return Math.min(6,Math.floor(s.cash/200));return {marbles:10,cards:8,tokens:e.id==='STU_D3'?2:10,items:2,chances:3}[r]||0;}
export function queueStudentStory(s,catalog){
 const ss=s.studentStories;if(!ss||s.age<6||s.age>=18)return false;
 if(ss.pending){if(s.activeEvent?.eventId!==ss.pending&&!s.eventQueue.includes(ss.pending))s.eventQueue.unshift(ss.pending);return true;}
 const slot=STUDENT_AGES.findIndex(age=>age===s.age)+1;
 if(!slot||ss.selected.some(x=>x.slot===slot))return false;
 const bag=catalog.events.filter(e=>e.studentStory?.slot===slot&&!e.studentStory.followup).map(e=>({e,w:studentEventWeight(s,e)*(.9+nextRandom(ss)*.2)}));
 if(!bag.length)return false;
 let n=nextRandom(ss)*bag.reduce((sum,x)=>sum+x.w,0);const selected=bag.find(x=>(n-=x.w)<0)||bag.at(-1),e=selected.e;
 ss.selected.push({slot,eventId:e.id});ss.pending=e.id;ss.resources={resource:e.studentStory.resource,available:resourceBudget(s,e),spent:0,gained:0};
 s.eventQueue.unshift(e.id);return true;
}
export function studentEventAllowed(s,e){return !e.studentStory||s.studentStories?.pending===e.id;}
export function studentChoiceVisible(s,c){const r=c.studentSpecial;return !r||(s.studentStories?.traits[r.trait]||0)>=r.min;}
function historicalLine(s){const h=s.studentStories.history.filter(x=>!x.followup);if(!h.length)return '';
 const last=h.at(-1);return `你想起${last.age}岁那次「${last.title}」，自己选的是“${last.choice}”。${negative(last.variant)?'不顺利的那一下，你还记得。':positive(last.variant)?'那次的好手气，也一直有人提起。':'当时说过的话，这回又到了嘴边。'}`;}
export function studentPresentation(s,e){
 if(!e?.studentStory||!s.studentStories)return e;
 const ss=s.studentStories,{slot,line,followup}=e.studentStory;let prompt=e.prompt,title=e.title;
 if(e.id==='STU_C2'&&ss.history.some(h=>positive(h.variant)))prompt='阿川在小卖部又指向抽奖盒，说起你以前赢过的那次。你记得奖品拿在手里的分量，至于那些没中奖的人，当时倒没怎么看。';
 if(e.id==='STU_B5'){const loss=ss.history.find(h=>h.eventId==='STU_B3'&&h.action==='allin'&&h.delta<0);prompt=loss?'毕业交换会上，你曾经在那次牌局里输掉的稀有卡又出现了。持有人开价二十，也愿意交换；阿川说，要不赌一局把它拿回来？':'毕业交换会上，你以前见过、却没有收进册子的稀有卡又出现了。持有人开价二十，也愿意换卡；旁边的人却提议，不如一局定归属。';}
 if(e.id==='STU_A5'&&!ss.history.some(h=>h.resource==='marbles'))prompt='毕业聚会还没散，阿川把自己小时候留的一颗玻璃球放在桌上，讲起小学的游戏。你们一起经历的却是另一些小事。有人提议再玩一局，这次由你决定押什么。';
 if(e.id==='STU_H5'&&!ss.history.some(h=>['leave','redeem'].includes(h.action)))prompt='毕业聚会的最后一局，条件被说得格外诱人。阿川问你，今天要不要给自己定个停下来的地方？以往没有守过的原则，这次也可以从头商量。';
 if(!followup&&slot>1)prompt+='\n\n'+historicalLine(s);
 if(line==='F'&&slot>1)prompt+=ss.friend.relationship>=55?' 阿川记得你们说话算数的几次，愿意听你把条件讲完。':ss.friend.relationship<45?' 之前的小别扭还在，阿川这回先问你是不是真的愿意。':' 阿川没有替你拿主意，等你自己开口。';
 if(slot===4&&ss.traits.allIn>=18)prompt+=' 你第一反应是把这次带的钱一起拿出来，手却还没伸进口袋。';
 if(slot===4&&ss.traits.analysis>=18)prompt+=' 你开始留意哪些记录没被拿出来说。';
 if(e.id==='STU_D4'&&!ss.history.some(h=>h.resource==='cash'&&h.delta<0)){title='第一次拿现金猜比赛';prompt='同学拿出二十元，提议猜今晚的比赛。你以前见过有人输完又加码，嘴上都说赢回来就停。这回第一次要用自己的小钱，你先决定要不要接。'+(historicalLine(s)?'\n\n'+historicalLine(s):'');}
 if(e.id==='STU_H4'){title='赢了以后，还会继续吗';prompt='同学提议猜一场比赛，赢家能拿到二十元。有人已经替你安排好：第一场赢了就接着玩。钱还没离开口袋，你先想好打算玩到哪里。'+(historicalLine(s)?'\n\n'+historicalLine(s):'');}
 const unit={marbles:'颗弹珠',cards:'张卡片',tokens:'枚游戏币',items:'件可交换道具',chances:'次游戏机会',packs:'包零食的预算',cash:'元本次可用额度'}[e.studentStory.resource];
 return {...e,title,prompt,artKey:`student-${e.studentStory.art}`,scopeNote:`学生旧事 ${slot} / 5${followup?' · 同一件事的追问':''} · 这次带来 ${ss.resources?.available??0} ${unit}${e.studentStory.resource==='packs'?'（每包 ¥2，从零花钱支付）':''}。${slot<4?'弹珠、卡片和游戏币不计作现金资产。':'本次现金上限 ¥50，不动其他存款。'}`};
}
function stakeFor(e,c,s){const r=e.studentStory.resource,k=c.studentAction,a=s.studentStories.resources?.available??0;
 if(k==='drink')return 3;if(k==='purchase')return 20;if(!ACTIVE.has(k))return 0;
 if(r==='cash')return k==='allin'?50:k==='test'?5:20;
 if(r==='packs')return k==='allin'?a:1;
 if(r==='items')return 1;
 if(r==='cards')return k==='allin'?(e.id==='STU_B2'?3:e.id==='STU_B3'?1:a):1;
 if(k==='borrow')return 3;
 if(r==='tokens')return k==='allin'?a:k==='risk'?3:2;
 return k==='allin'?a:Math.min(3,a);
}
const VARIANT_TEXT={win:'这一局赢了，阿川替你数了两遍，生怕少算自己那声喝彩。',loss:'这一局输了。大家已经在谈下一局，你还在看刚才拿出去的东西。',big_win:'这次意外赢得比想象多，围观的人一下多了起来，像刚才一直都在。',big_loss:'几乎没来得及反应，这次押出的就全没了。原本很响亮的把握，现在只剩一声“啊”。',tie:'折腾一圈，最后打平，各自拿回原来的份额。',renege:'你这边明明赢了，对方却改口不认，最后只拿回自己那份。阿川第一次没接上玩笑。',interrupted:'家长过来找人，事情还没开始就散了。你把东西原样收回，今晚倒不用编输赢的理由。',friend_exit:'阿川临时被叫走，约好的这一局没开成。大家各自拿回东西。',streak_win:'约好的两小局都顺利，旁边已经有人替你总结起“今天手气好”。',streak_loss:'约好的两小局都没成，原定份额用完了。你发现“下一次”三个字越来越顺口。'};
export function studentChoice(s,e,c){
 if(!e?.studentStory||!s.studentStories)return c;
 const ss=s.studentStories,k=c.studentAction,r=e.studentStory.resource,stake=stakeFor(e,c,s),available=ss.resources?.available||0;
 let label=c.label;
 if(e.id==='STU_D4'&&!ss.history.some(h=>h.resource==='cash'&&h.delta<0))label={allin:'拿 50 元，一次猜大一点。',chase:'先拿 20 元试一场。',observe:'先做纸上预测，看完再说。',leave:'今天只看比赛，不赌钱。'}[k]||label;
 if(e.id==='STU_H4')label={allin:'拿 50 元猜一场。',small:'只拿 20 元，输赢都停。',observe:'先记下预测，不掏钱。',leave:'比赛照看，钱先收好。'}[k]||label;
 if(e.id==='STU_A5'&&k==='chase'&&!ss.history.some(h=>negative(h.variant)))label='还是押 20 元，不加码。';
 if(e.id==='STU_F5'&&k==='partner'&&ss.friend.relationship<45)label='先讲清各算各的，再各拿 20 元。';
 if(e.id==='STU_F5'&&k==='observe'&&ss.friend.relationship>=55)label='不用赌约，也把以后见面的日子约好。';
 if(e.id==='STU_E5'&&k==='allin'&&ss.traits.allIn<18)label='提高到 50 元，试一次自己的判断。';
 let reason='';
 if(ACTIVE.has(k)&&k!=='borrow'&&(stake<=0||stake>available))reason='这次带来的筹码不够，仍可观察或离开';
 if(k==='borrow'&&ss.friend.relationship<40)reason='阿川还在介意上次的事，这次不愿借游戏币';
 const cashCost=r==='cash'?stake:r==='packs'?stake*2:k==='drink'?3:0;
 // Scripted context only describes wins/losses from earlier rounds if actually recorded.
 const outcomes=c.outcomes.map(o=>{
  const variant=o.studentOutcome;let delta=0,tokenDelta=0,details='',text='',traits={...(ACTION_TRAITS[e.id==='STU_D4'&&k==='chase'&&!ss.history.some(h=>h.resource==='cash'&&h.delta<0)?'small':k]||{})};
  const cancelled=['interrupted','friend_exit','tie','renege'].includes(variant);
  if(ACTIVE.has(k)){
   let net=positive(variant)?stake*(variant==='big_win'?2:1):negative(variant)&&variant!=='renege'?-stake:0;
   if(r==='packs')net=-stake; // opening packets always costs money, even when a rare card appears
   delta=r==='cash'?net:r==='packs'?(cancelled?0:-stake*2):0;tokenDelta=['cash','packs'].includes(r)?0:net;
   text=VARIANT_TEXT[variant]||'';
   if(variant==='streak_win')text='这一次又赢了。想起上次顺利的那一局，你忍不住觉得好运正在站队。';
   if(variant==='streak_loss')text='这一次又没成。想起上次的失利，你发现“下一次”三个字越来越顺口。';
   if(r==='packs')text=cancelled?'店主临时收摊，这几包还没拆，钱原样收回。':positive(variant)?'这一包里终于有了想找的卡。零食还在手上，你已经先把卡举了起来。':'拆出来仍是重复卡。零食倒是一包没少，只是你现在看它们不太顺眼。';
   if(['cards','items'].includes(r)&&variant==='big_win')text='这次意外连赢，想要的收藏也换到了手。你比刚才更舍不得离开桌边。';
   if(variant==='interrupted'&&['card-club','statistics'].includes(e.studentStory.art))text='老师进来找值日生，这一局还没开就散了。东西各自收回，名字倒是都记住了。';
   if(positive(variant)){traits.superstition=(traits.superstition||0)+2;if(e.studentStory.line==='C')traits.superstition+=3;}
   if(negative(variant)&&variant!=='renege')traits.chasing=(traits.chasing||0)+2;
   if(variant==='renege')traits.analysis=(traits.analysis||0)+2;
  }else{
   text={observe:'你留下来看，也把没成功的几次记住。阿川说你像在做作业，你说这份至少没人替你改答案。',exchange:'你们把各自愿意换的东西摆出来，谈妥再交换。没有惊天逆转，倒也没有谁回去翻旧账。',leave:'你把自己的东西收好。热闹还在继续，这次不需要你付一份。阿川说下次再叫你，你没急着答应。',organize:'你先把约定讲明白，遇到争议请没参与的人核对。组织者也得守规则，省下的不是麻烦，是以后互相猜疑的功夫。',redeem:'你把这次的游戏币换成了眼前的小奖品。机器还亮着，奖品已经可以带走了。',drink:'你们改成请一瓶饮料，付了三元。比赛照看，没人需要一边看比分一边盘算翻本。',purchase:'你确认是自己要的那张卡，花二十元买下。这次没有抽签，钱换来什么说得清楚。'}[k]||'这件事先告一段落，你们各自收好东西。';
   if(k==='purchase'||k==='drink')delta=-cashCost;
   if(k==='leave'&&e.id==='STU_B4')text='你们改成组队打副本，装备还是自己的装备。阿川忘了刚才的彩头，忙着喊你躲技能。';
   if(k==='observe'&&e.id==='STU_B4')text='查过规则才知道哪些道具绑定、哪些能交换。你把不能转出的那件划掉，没让一场约定变成互相赖账。';
   if(k==='observe'&&e.studentStory.line==='F')text='你陪阿川把情况看完，没因为一句兄弟就先把东西交出去。他也把本来没说完的规矩补了两句。';
   if(k==='leave'&&e.studentStory.line==='G')text='大家只记积分，卡片和零花钱各自收好。你发现没有彩头以后，争论谁先谁后的人少了一半。';
   if(k==='redeem')tokenDelta=-available;
  }
  if(e.studentStory.slot===5&&k==='observe')text='你们把以前的记录和今天的条件分开说。毕业不是一张免算账的通行证，阿川听完，提议先把聚餐钱分清。';
  if(e.studentStory.slot===5&&k==='leave')text='你收起桌上的旧物，没接下一局。阿川把合照发给你：这次留下来的，不必是一笔输赢。';
  if(e.id==='STU_G5'&&k==='leave')text='你把本子推给大家，一人写一句毕业留言。刚才还要争先后的人，这回怕字太丑，谁都不肯先写。';
  if(e.id==='STU_F5'&&['observe','leave'].includes(k))text='你们约好以后再聚，顺手把汽水喝完。阿川说，不一起押钱，总不至于就不算朋友。';
  const resourceName={marbles:'弹珠',cards:'卡片',tokens:'游戏币',items:'道具',chances:'游戏机会'}[r];
  if(r==='packs')details=cancelled?'未拆封，未支付。':`购买 ${stake} 包零食，支付 ¥${stake*2}；${positive(variant)?'获得想要的收藏卡':'得到重复卡'}。`;
  else if(r==='cash'||delta)details=`本次${delta>=0?'收入':'支出'} ¥${Math.abs(delta)}${ACTIVE.has(k)?`；约定金额 ¥${stake}`:''}。`;
  else details=`${resourceName} ${tokenDelta>0?'+':''}${tokenDelta}；${k==='borrow'?'向阿川借用 3 枚游戏币，这份人情记下了。':'没有现金收支。'}`;
  const resultLabel=ACTIVE.has(k)?cancelled?'这一局没有结算输赢':r==='packs'?positive(variant)?'抽到了想找的卡':'又拆到重复卡':positive(variant)?'这次赢了':negative(variant)?'这次输了':'这一局结束了':{purchase:'把收藏卡买回来了',exchange:'交换谈妥了',observe:'先把事情看明白',leave:'今天玩到这里',organize:'把规矩说在前面',redeem:'游戏币换成了奖品',drink:'赌约换成了一瓶饮料'}[k];
  const effects=delta?[{op:delta>0?'earn':'spend',amount_yuan:Math.abs(delta)}]:[];
  if(k==='observe'||k==='organize')effects.push({op:'stat',delta:{insight:1}});
  if(k==='leave'||k==='redeem')effects.push({op:'stat',delta:{stress:-1}});
  if(variant==='big_loss')effects.push({op:'stat',delta:{stress:1}});
  let weight=o.weight;
  if(['match','card-club','statistics'].includes(e.studentStory.art)&&['win','loss'].includes(variant)){const edge=Math.min(6,ss.traits.analysis/8);weight+=variant==='win'?edge:-edge;}
  if(variant==='streak_win'&&!positive(ss.history.at(-1)?.variant))weight=0;
  if(variant==='streak_loss'&&!negative(ss.history.at(-1)?.variant))weight=0;
  if(r==='packs'&&!cancelled){const p=1-Math.pow(11/12,stake);weight*=positive(variant)?p/.37:(1-p)/.63;}
  if(variant==='friend_exit')weight*=ss.friend.relationship<40?2:1;
  if(variant==='renege'&&k==='organize')weight*=.5;
  return {...o,weight,title:`${e.title} · ${resultLabel}`,text,effects,studentResolution:{delta,tokenDelta,stake,details,traits,variant,action:k,resource:r,cancelled}};
 });
 return {...c,label,studentReason:reason,requirements:{...c.requirements,min_cash_yuan:cashCost},planHint:r==='packs'?`每包 ¥2 · 本次最多 ¥${cashCost}`:r==='cash'&&cashCost?`本次最多 ¥${cashCost}`:k==='borrow'?'借 3 枚游戏币，记入阿川的往来':ACTIVE.has(k)?`本次 ${stake} ${ {marbles:'颗弹珠',cards:'张卡片',tokens:'枚游戏币',items:'件道具',chances:'次游戏机会'}[r]||''}`:'不额外花钱',outcomes};
}
export function recordStudentChoice(next,e,c,o){
 if(!e.studentStory||!next.studentStories)return;
 const ss=next.studentStories,res=o.studentResolution,{line,slot,followup}=e.studentStory;
 if(ss.history.some(h=>h.eventId===e.id))return;
 for(const [key,value]of Object.entries(res.traits))ss.traits[key]=clamp(ss.traits[key]+value);
 ss.friend.relationship=clamp(ss.friend.relationship+(['partner','organize','exchange','drink'].includes(res.action)?4:res.variant==='renege'?-8:res.action==='leave'?-1:1));
 if(res.action==='borrow'&&!res.cancelled)ss.friend.borrowed+=3;
 const used=res.cancelled?0:ACTIVE.has(res.action)?res.stake:0;
 ss.resources.spent+=used;ss.resources.gained+=Math.max(0,res.tokenDelta);
 ss.resources.available=Math.max(0,ss.resources.available+(res.action==='borrow'&&!res.cancelled?3:0)+(res.resource==='packs'?-used:res.tokenDelta));
 ss.history.push({eventId:e.id,choiceId:c.id,outcomeId:o.id,age:next.age,line,slot,followup,title:e.title,choice:c.label,variant:res.variant,action:res.action,resource:res.resource,delta:res.tokenDelta||res.delta,art:e.studentStory.art});
 ss.pending=null;
 if(!followup&&['STU_A2','STU_D2'].includes(e.id)&&ACTIVE.has(res.action)&&negative(res.variant))ss.pending=e.id+'_MORE';
 if(slot===5){const cores=ss.history.filter(h=>!h.followup);ss.summary={traits:{...ss.traits},events:cores.map(h=>h.eventId),text:`${cores.map(h=>`${h.age}岁，你在「${h.title}」里选了“${h.choice}”`).join('；')}。${ss.friend.borrowed?'阿川还记得借过你的那几枚游戏币。':'阿川把这些年收进一句“以后再见”。'}`};}
 next.lastResult.details=[next.lastResult.details,res.details,slot===5?ss.summary.text:''].filter(Boolean).join('\n');
 next.lastResult.artKey=`student-${e.studentStory.art}`;
}
export function validateStudentStories(s){
 const ss=s.studentStories;if(ss===undefined)return; // Legacy adults retain their real history; no fabricated childhood.
 const fail=()=>{throw new Error('学生旧事存档无效');};
 if(!ss||ss.version!==1||!Number.isInteger(ss.rng)||ss.rng<0||ss.rng>4294967295)fail();
 if(!ss.traits||Object.keys(ss.traits).length!==STUDENT_TRAITS.length||STUDENT_TRAITS.some(k=>!Number.isFinite(ss.traits[k])||ss.traits[k]<0||ss.traits[k]>100))fail();
 if(!ss.friend||ss.friend.name!=='阿川'||!Number.isInteger(ss.friend.relationship)||ss.friend.relationship<0||ss.friend.relationship>100||!Number.isInteger(ss.friend.borrowed)||ss.friend.borrowed<0||ss.friend.borrowed>3)fail();
 if(!Array.isArray(ss.selected)||ss.selected.length>5||new Set(ss.selected.map(x=>x.slot)).size!==ss.selected.length)fail();
 for(const x of ss.selected)if(!Number.isInteger(x.slot)||x.slot<1||x.slot>5||!new RegExp(`^STU_[A-H]${x.slot}$`).test(x.eventId))fail();
 if(!Array.isArray(ss.history)||ss.history.length>6||new Set(ss.history.map(h=>h.eventId)).size!==ss.history.length)fail();
 for(const h of ss.history)if(!isStudentStory(h.eventId)||h.age!==STUDENT_AGES[h.slot-1]||!ss.selected.some(x=>x.slot===h.slot&&h.eventId.startsWith(x.eventId))||!s.seenEvents.includes(h.eventId))fail();
 for(const h of ss.history){const saved=s.storyHistory.find(x=>x.eventId===h.eventId);if(!saved||saved.choiceId!==h.choiceId||saved.outcomeId!==h.outcomeId||saved.age!==h.age||!Number.isFinite(h.delta)||typeof h.followup!=='boolean'||!['quiet','win','loss','big_win','big_loss','tie','renege','interrupted','friend_exit','streak_win','streak_loss'].includes(h.variant))fail();}
 if(ss.pending!==null&&(!isStudentStory(ss.pending)||s.seenEvents.includes(ss.pending)||!ss.selected.some(x=>ss.pending.startsWith(x.eventId))))fail();
 if(ss.resources&&(!['marbles','cards','tokens','items','chances','packs','cash'].includes(ss.resources.resource)||['available','spent','gained'].some(k=>!Number.isFinite(ss.resources[k])||ss.resources[k]<0||ss.resources[k]>1000)))fail();
 if(ss.pending&&STUDENT_AGES[Number(ss.pending.match(/[1-5]/)[0])-1]!==s.age)fail();
 if(s.activeEvent?.eventId?.startsWith('STU_')&&s.phase==='event'&&ss.pending!==s.activeEvent.eventId)fail();
 if(ss.summary!==null&&(!ss.summary||!Array.isArray(ss.summary.events)||typeof ss.summary.text!=='string'||!ss.history.some(h=>h.slot===5)))fail();
}
