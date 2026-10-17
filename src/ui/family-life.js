import {familyStatus,familyActionReason,weddingQuote,WEDDING_GIFTS,WEDDING_FEASTS} from '../game/family-life.js';

export function childAgeLabel(s){
 const age=familyStatus(s).childAge;
 if(age===null)return '出生时间未记录';
 if(age<1/12)return '新生儿';
 if(age<1)return `${Math.floor(age*12)} 个月`;
 return `${Math.floor(age)} 岁${Math.floor(age*12)%12?' '+Math.floor(age*12)%12+' 个月':''}`;
}
export function renderFamilyPanel(s,{esc,money}){
 const f=familyStatus(s),couple=f.stage!=='friends';
 const button=(label,action,primary=false)=>{const reason=familyActionReason(s,action);return `<div class="family-action"><button class="button ${primary?'primary':''}" data-action="family-command" data-command="${esc(JSON.stringify(action))}" ${reason?'disabled':''}>${label}</button>${reason?`<small>${esc(reason)}</small>`:''}</div>`;};
 let next='';
 if(f.pending)next='<button class="button primary" data-action="life-scene">继续两个人的故事 →</button>';
 else if(f.stage==='friends')next=button(f.seen.friendsOnly?'重新表达心意':'认真表达心意',{type:f.seen.friendsOnly?'family_topic':'family_start',topic:'romance'},true);
 else if(f.stage==='engaged')next='<button class="button primary" data-action="family-wedding-open">商量婚礼方案 →</button>';
 else if(['dating','together'].includes(f.stage))next=button('商量结婚安排',{type:'family_topic',topic:'marriage'},true);
 else if(!s.household.hasChild&&!f.pregnancyOn)next=button('商量生育计划',{type:'family_topic',topic:'baby'},true);
 const date=f.marriedOn?`结婚于 ${f.marriedOn}`:f.startedOn?`开始交往于 ${f.startedOn}`:f.legacyShared?'原有共同生活关系已保留，未记录结婚日期':f.metOn?`相识于 ${f.metOn}`:'从日常往来开始，慢慢了解彼此';
 return `<section class="family-panel" aria-label="和林夏的关系安排"><div class="family-heading"><h3>两个人的生活</h3><span class="family-stage">${esc(f.label)}</span></div><p class="family-date">${esc(date)}</p>${f.pregnancyOn?`<p class="family-status-line">正在准备迎接孩子 · 孕期从 ${f.pregnancyOn} 开始</p>`:''}${s.household.hasChild?`<p class="family-status-line">小满 · ${childAgeLabel(s)}${s.household.childBornOn?` · ${s.household.childBornOn} 出生`:''}</p>`:''}<div class="family-next">${next}</div><div class="family-personal"><span>林夏 · ${esc(f.career.title)}</span><span>${f.career.income?`${f.career.incomeLabel} ${money(f.career.income)}`:'目前没有固定工资'}${f.career.recovery?' · 产后恢复中':''}</span><span>她自己的积蓄 <strong>${money(f.wallet)}</strong></span></div>${couple?`<div class="family-budget-summary"><div><strong>约会预算</strong><span>${money(f.romanceBudget)} / 月上限</span></div><button class="text-button" data-action="family-budget-open">调整预算 →</button></div>${f.costs.total?`<details class="family-costs"><summary>共同生活与育儿 · 你每月承担 ${money(f.costs.player)}</summary><dl><div><dt>共同增量预算</dt><dd>${money(f.costs.total)}</dd></div><div><dt>林夏直接承担</dt><dd>${money(f.costs.contribution)}</dd></div><div><dt>你的承担额</dt><dd>${money(f.costs.player)}</dd></div></dl><p>你的原有日常开支另计；共同费用按天结算，已包含在生活费中。林夏的收入留在她自己的账户。</p></details>`:''}<button class="text-button family-ledger" data-action="chapter-bills">查看约会、婚礼和日常消费账单 →</button>`:''}${f.car?`<div class="family-car"><div><strong>家庭车辆</strong><p>当前估值 ${money(f.car.value)} · 养车 ${money(80000)} / 月</p></div>${button('出售车辆',{type:'family_car_sell'})}</div>`:''}</section>`;
}
export function renderRomanceBudget(s,{money}){
 const f=familyStatus(s),amounts=s.age<22?[0,10000,20000]:[0,20000,60000,120000,200000];
 return `<section class="family-settings"><p class="dialog-intro">选一个每月上限。日常约会分两次安排，只记实际支出；生日礼物另行决定。</p><div class="family-budget-options" aria-label="每月约会预算">${amounts.map(amount=>`<button class="button ${f.romanceBudget===amount?'selected':''}" data-action="family-command" data-command='${JSON.stringify({type:'family_budget',amount})}' aria-pressed="${f.romanceBudget===amount}">${amount?money(amount)+' / 月':'免费活动'}</button>`).join('')}</div><p class="field-help">余额不足时改成散步、聊天等免费安排。林夏也会按自己的预算请客、回礼。</p></section>`;
}
export function weddingFormAction(form){const d=new FormData(form);return {type:'family_wedding',gift:Number(d.get('gift')),feast:Number(d.get('feast')),housing:d.get('housing'),transport:d.get('transport')};}
export function renderWeddingPlan(s,ctx){
 const {money}=ctx,option=(value,label)=>`<option value="${value}">${label}</option>`;
 return `<form id="family-wedding-form" class="family-wedding-form"><p class="dialog-intro">把婚礼办成你们负担得起的样子。林夏用自己的积蓄分担婚礼与搬家，彩礼和车辆由你承担。</p><fieldset><legend>婚礼与礼金</legend><div class="family-form-grid"><div class="field"><label for="wedding-gift">彩礼 · 赠予林夏家人</label><select id="wedding-gift" name="gift">${WEDDING_GIFTS.map(n=>option(n,n?money(n):'双方商定不另付彩礼')).join('')}</select></div><div class="field"><label for="wedding-feast">婚礼安排</label><select id="wedding-feast" name="feast">${WEDDING_FEASTS.map((n,i)=>option(n,['家人聚餐','简单婚礼','小型宴席','较大宴席'][i]+' · '+money(n))).join('')}</select></div></div></fieldset><fieldset><legend>婚后的住处与出行</legend><div class="family-form-grid"><div class="field"><label for="wedding-home">住房安排</label><select id="wedding-home" name="housing">${option('rent','继续租住 · 搬家整理 ¥600')}${option('owned','入住已有房产 · 需持有可用住房')}</select><small>可以先租房结婚。需要买房时，去房产市场挑选，不在这里自动购买。</small></div><div class="field"><label for="wedding-transport">日常出行</label><select id="wedding-transport" name="transport">${option('public','公共交通 · 暂不购车')}${option('car',s.familyLife?.car?'使用已有家庭车辆':'购入二手代步车 · ¥30,000')}</select><small>买车保留车辆资产；养车额外 ¥800 / 月，可在人物页出售。</small></div></div></fieldset><section class="family-wedding-quote" aria-live="polite"></section><p class="form-error" role="alert"></p><div class="family-confirm"><button class="button" type="button" data-action="close-dialog">先存钱，回头再定</button><button class="button primary" type="submit">确认方案，举办婚礼</button></div></form>`;
}
export function updateWeddingPlan(form,s,{money}){
 const q=weddingQuote(s,weddingFormAction(form));
 form.querySelector('.family-wedding-quote').innerHTML=`<h3>这次实际支付</h3><dl><div><dt>方案总额</dt><dd>${money(q.total)}</dd></div><div><dt>林夏出资</dt><dd>${money(q.partner)}</dd></div><div class="family-total"><dt>你需要支付</dt><dd>${money(q.player)}</dd></div><div><dt>支付后现金</dt><dd>${money(s.cash-q.player)}</dd></div></dl><p>${q.reason||'确认后才扣款，并记录结婚日期。后续生活与生育仍由你们决定。'}</p>`;
 form.querySelector('[type=submit]').disabled=Boolean(q.reason);
}
