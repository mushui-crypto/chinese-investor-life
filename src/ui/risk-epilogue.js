export function renderRiskEpilogue(s,{money}){
 const t=s.riskLife?.terminal;if(!t)return '';
 const rows=[['失去的存款',t.cash],['失去的持仓',t.holdings],['失去的生意',t.business],['没收回的款项',t.claims],['失去的存货',t.inventory]].filter(([,v])=>v>0);
 return `<section class="gambling-ledger ending-risk-ledger risk-epilogue" aria-label="尾声清算"><h2>清算明细</h2><dl>${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>−${money(v)}</dd></div>`).join('')}<div><dt>清算后个人资产</dt><dd>${money(0)}</dd></div><div><dt>原来欠的钱</dt><dd>${money(t.debt)}</dd></div></dl><p>旧债仍需偿还，家庭储备未扣除。本局结束。</p></section>`;
}
