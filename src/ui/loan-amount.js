export function loanAmountPresets(cap){
 if(!Number.isSafeInteger(cap)||cap<=0)return [];
 const values=[10000,50000,100000,300000,500000].filter(value=>value<=cap);
 return values.length?values:[cap];
}
export function renderLoanAmount(offer,{money}){
 return `<div class="field"><label for="amount">申请本金 <span>元</span></label><input id="amount" name="amount" type="text" inputmode="decimal" value="${offer.principal/100}" maxlength="16" required aria-describedby="loan-amount-hint"><small id="loan-amount-hint">选择常用金额，也可以直接输入。</small><div class="loan-amount-presets" role="group" aria-label="常用借款金额">${renderLoanPresets(offer.cap,offer.principal,{money})}</div></div>`;
}
export function renderLoanPresets(cap,selected,{money}){
 return loanAmountPresets(cap).map(value=>`<button type="button" class="button small" data-action="loan-amount" data-amount="${value}" aria-pressed="${value===selected}">${money(value)}</button>`).join('');
}
export function updateLoanPresets(form,cap,selected,ctx){
 const group=form.querySelector('.loan-amount-presets');if(!group)return;
 const values=loanAmountPresets(cap).join(',');
 if(group.dataset.values!==values){group.innerHTML=renderLoanPresets(cap,selected,ctx);group.dataset.values=values;}
 for(const button of group.querySelectorAll('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.amount)===selected));
}
