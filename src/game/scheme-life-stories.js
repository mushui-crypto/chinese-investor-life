import {schemeLifeState,schemeEventAllowed,schemeEventProject,recordSchemeEvent} from './scheme-life.js';
import {schemeLifeActionPreview,nextSchemeProject,SCHEME_PROJECTS} from './scheme-life-finance.js';

// Text observes one project's receipts. Only explicit finance effects move money.
export const SCHEME_LIFE_EVENT_IDS=['CL22','CL23','CL24','CL25','CL26','CL27','CL28','CL29','CL30','CL31','CL42',...Array.from({length:24},(_,i)=>`SL${String(i+1).padStart(2,'0')}`)];
const money=n=>`¥${((n||0)/100).toLocaleString('zh-CN',{maximumFractionDigits:2})}`;
const SOURCES={friend:'朋友',colleague:'同事',relative:'亲戚',crypto_group:'Crypto 群里的熟人'};
const FINANCIAL=new Set(['join','add','withdraw','partial','principal','retain','cash_payout','prepare_exit','wait_payment','family_join','family_withdraw']);
const RISK=new Set(['join','add','family_join']);
const WARNING=new Set(['delay','recovered','rumor','slow','last_payment','maintenance','silent','missing','balance']);
const EXPOSURE=new Set(['CL22','SL21','SL22']);
function scopedEvent(event,c){return c?.schemeSpecial?{...event,schemeLife:{requiredState:c.schemeSpecial,blockedState:['permanentlyRefused'],ageStage:[24,80],minDelay:90,cooldown:180,repeatable:true}}:event;}
function context(s,event,c){
 const target=scopedEvent(event,c),g=schemeLifeState(s),row=schemeEventProject(s,target)||(!event.schemeLife?.newProject?g.projects[g.currentProjectKey]:null),next=nextSchemeProject(s),fresh=event.schemeLife?.newProject||!row;
 const key=fresh?next.projectKey:row.key,name=fresh?next.name:row.name,source=event.schemeLife?.source||(fresh?next.introducer:row.source)||'friend';
 return {row,fresh,key,name,source,triggerProjectKey:row?.key,packaging:(fresh?next:SCHEME_PROJECTS.find(p=>key.startsWith(p.id+':')))?.packaging||'此前介绍的虚构项目'};
}
function replace(text,ctx){return (text||'').replaceAll('{project}',ctx.name).replaceAll('{source}',SOURCES[ctx.source]||'介绍人');}
function personalPosition(s,key){return(s.positions||[]).find(p=>(p.projectKey||p.cryptoScheme?.projectKey||p.id)===key&&p.cryptoLifeBranch==='scheme');}
function projectPositions(s,key){return [...(s.positions||[]),...(s.trading?.schemeFamilyProjects||[])].filter(p=>(p.projectKey||p.cryptoScheme?.projectKey||p.id)===key&&p.cryptoLifeBranch==='scheme');}
function accountLine(s,ctx){
 const p=ctx.row;if(!p||ctx.fresh)return '';
 const own=personalPosition(s,ctx.key),positions=projectPositions(s,ctx.key),unavailable=positions.length>0&&positions.every(p=>p.frozen||p.failed||p.cryptoScheme?.status==='frozen');
 const lines=[`这个项目累计投入 ${money(p.invested)}，累计实际到账 ${money(p.returned)}（其中收益支付 ${money(p.paid)}，${p.paymentCount||0} 次）。当前未退个人本金 ${money(own?.cost)}，项目页面余额 ${money(own?.bookBalance??p.bookBalance)}；当前可兑现个人资金 ${money(own?.value)}。`];
 if(p.legacyImported)lines.push('这是旧存档中的项目；缺少回执的历史不补造投入或付款记忆。');
 if(unavailable)lines.push('提现受限，页面数字不是现金，当前不能追加。');
 if(p.familyJoined||p.familyInvested)lines.push(`家庭另外实际投入 ${money(p.familyInvested)}，实际回到家庭储备 ${money(p.familyReturned)}；这部分与个人现金分账。`);
 return lines.join('\n');
}
export function schemeStoryPresentation(s,event){
 if(!event?.schemeLife)return event;
 const ctx=context(s,event),p=ctx.row;let title=event.title,prompt=replace(event.prompt,ctx);
 if(EXPOSURE.has(event.id))prompt+=`\n\n这次的介绍来自${SOURCES[ctx.source]||'熟人'}，项目自称做“${ctx.packaging}”。介绍不是担保；今天听完也可以不投入。`;
 if(event.id==='CL28'&&(p?.eventCounts?.CL28||0)>0)title='又一次提现延迟';
 if(event.id==='CL29'&&(p?.eventCounts?.CL29||0)>0)title='又一次系统维护';
 if(event.id==='CL30'&&(p?.eventCounts?.CL30||0)>0)title='群聊再次安静下来';
 const payment=[...(p?.history||[])].reverse().find(h=>h.kind==='receipt'&&h.action==='payment'&&h.cashFlow>0&&!h.family);
 if(['CL24','CL25','SL07','SL10'].includes(event.id)&&payment)prompt+=`\n\n最近可核对的一笔：${payment.age} 岁，真实收益到账 ${money(payment.cashFlow)}。钱已在那时结算，本次对话不会再发一次。`;
 if(event.id==='CL31'&&p)prompt+=`\n\n最后页面余额 ${money(p.lastPageBalance)}；累计实际到账 ${money(p.returned)}；累计个人投入 ${money(p.invested)}。最终可提现 ¥0，个人累计已实现${p.realizedProfit>=0?'收益':'亏损'} ${money(Math.abs(p.realizedProfit))}，损失已经结算，不再扣一次。`;
 if(event.id==='CL31'&&p?.familyInvested)prompt+=`\n家庭独立投入 ${money(p.familyInvested)}，实际退回家庭储备 ${money(p.familyReturned)}；家庭累计已实现${p.familyRealizedProfit>=0?'收益':'亏损'} ${money(Math.abs(p.familyRealizedProfit))}。这些金额没有并入个人现金。`;
 if(event.id==='CL42'&&p){const receipt=[...p.history].reverse().find(h=>h.kind==='receipt'&&h.action==='withdraw'&&!h.family);if(receipt)prompt+=`\n\n${receipt.age} 岁退出时实际拿回 ${money(receipt.cashFlow)}。退出后的坏消息不会再扣你已经拿回的钱。`;}
 if(event.id==='SL21'&&p)prompt+=`\n\n上一次是${p.name}，实际投入 ${money(p.invested)}、累计回款 ${money(p.returned)}。新项目没有继承旧项目的支付记录。`;
 const line=accountLine(s,ctx);if(line&&event.id!=='CL31')prompt+=`\n\n${line}`;
 if(['SL06','SL15','SL23'].includes(event.id))prompt+=`\n\n目前可核对的家庭储备 ${money(s.familyReserve)}。家庭参与必须单独确认，不能挪用个人现金补足。`;
 return {...event,title,prompt,scopeNote:'一件生活插曲 · 做完选择后回到日常',artKey:null};
}
function effectFor(s,event,c,ctx){
 const action=c.schemeAction;if(!FINANCIAL.has(action))return null;
 let mapped=action==='wait_payment'?'prepare_exit':action;
 if(action==='add'&&!personalPosition(s,ctx.key))mapped='join';
 const effect={op:'crypto_life',action:`scheme_${mapped}`,schemeLife:true,branch:'scheme',projectKey:ctx.key,receipt:{eventId:event.id,choice:replace(c.label,ctx)}};
 if(c.schemeAmount!==undefined)effect.amount=c.schemeAmount;
 if(c.schemeFraction!==undefined){if(action==='partial')effect.fraction=c.schemeFraction;else effect.amount=Math.floor(Math.max(0,action==='family_join'?s.familyReserve||0:s.cash||0)*c.schemeFraction);}
 return effect;
}
function hintFor(action,p,hasFamily){
 if(!p)return '';
 if(action==='family_join')return `明确从家庭储备投入 ${money(p.familyCashCost)}，手续费 ¥0。个人现金不参与；项目风险由这份家庭资金承担`;
 if(action==='family_withdraw')return `预计退回家庭储备 ${money(p.familyProceeds)}，手续费 ¥0；个人现金不增加`;
 if(['join','add'].includes(action))return `本次个人现金支出 ${money(p.cashCost)}，手续费 ¥0。投入不保证本金或未来收益`;
 if(['retain','cash_payout','prepare_exit','wait_payment'].includes(action))return p.note;
 return `当前预计实际提现 ${money(p.proceeds)}，手续费 ${money(p.fee)}；剩余个人本金 ${money(p.remainingPrincipal)}${hasFamily?'。此项只退个人资金，家庭份额需单独申请退出':''}`;
}
export function schemeStoryChoice(s,event,c){
 if(!c?.schemeAction)return c;
 const ctx=context(s,event,c),action=c.schemeAction,effect=effectFor(s,event,c,ctx),preview=effect?schemeLifeActionPreview(s,effect):null;
 const hidden=action==='family_withdraw'?!projectPositions(s,ctx.key).some(p=>p.cryptoScheme?.familyPrincipal>0):Boolean(c.schemeSpecial&&!schemeEventAllowed(s,scopedEvent(event,c))),reason=preview?.reason||'',hint=hintFor(action,preview,ctx.row?.familyCurrentPrincipal>0),stage=event.schemeLife?.stage;
 const outcomes=c.outcomes.map(o=>{
  const effects=(o.effects||[]).filter(e=>!['spend','earn','loan','venture','crypto_life'].includes(e.op));
  if(effect)effects.push(effect);
  if(WARNING.has(stage)&&action!=='withdraw')effects.push({op:'crypto_life',action:'scheme_ack',schemeLife:true,branch:'scheme',projectKey:ctx.key,stage,receipt:{eventId:event.id,choice:replace(c.label,ctx)}});
  return {...o,title:replace(o.title,ctx),text:replace(o.text,ctx),effects,schedule:[],schemeResolution:{action,projectKey:ctx.key,projectName:ctx.name,source:ctx.source,triggerProjectKey:ctx.triggerProjectKey,active:RISK.has(action),variant:o.schemeOutcome||'quiet',amount:effect?.amount||0,details:hint}};
 });
 return {...c,label:replace(c.label,ctx),schemeHidden:hidden,schemeReason:reason,cryptoHidden:hidden,cryptoReason:reason,planHint:hint,requirements:{...c.requirements,min_cash_yuan:(preview?.cashCost||0)/100},outcomes};
}
export function schemeStoryChoices(s,event){return(event?.choices||[]).map(c=>schemeStoryChoice(s,event,c)).filter(c=>!c.schemeHidden);}
export function recordSchemeStory(next,before,event,choice,outcome){
 const res=outcome?.schemeResolution;if(!res&&!choice?.schemeAction)return;
 const ctx=context(before,event,choice),action=res?.action||choice.schemeAction,variant=res?.variant||outcome.schemeOutcome||'quiet',key=res?.projectKey||ctx.key;
 const info={eventId:event.id,choice:replace(choice.label,ctx),action,variant,projectKey:key,projectName:res?.projectName||ctx.name,source:res?.source||ctx.source,triggerProjectKey:res?.triggerProjectKey||ctx.triggerProjectKey,exposure:EXPOSURE.has(event.id),refused:action==='refuse',permanentRefusal:action==='permanent_refuse',exitOpportunity:Boolean(ctx.row?.currentValue>0)};
 // The asynchronous introduction replaces the old fixed-age awareness event.
 // Hearing about the project grants awareness, never an automatic investment.
 if(info.exposure){next.flags.ponzi_exposed=true;if(next.education)next.education.ponziExposureAge??=next.age;}
 if(variant==='friend_joined')info.friendJoined=true;
 if(variant==='friend_missing'&&choice.id==='SL11_1')info.missingRoles=['introducer','admin','host'];
 if(event.id==='SL13'){info.relationshipRole='family';info.relationshipOutcome=action==='hide'?'strained':action==='disclose'?'repaired':'concerned';}
 if(event.id==='SL14'){info.relationshipRole='friend';info.relationshipOutcome=action==='hide'?'strained':action==='disclose'?'repaired':'concerned';}
 if(action==='greed')info.tendencies={FOMO:5};
 recordSchemeEvent(next,info);
}
