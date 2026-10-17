import {getTurnMonths} from '../game/core.js';
export function projectBrief(s,kind,item,{money,esc,button}){
 const pairs=rows=>`<dl class="project-facts">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
 let title=item.name,intro=item.note||'',facts=[],foot='',action='';
 if(kind==='housing'){facts=[['满租年租金率',`${item.rent/100}%`],['年度维修', '估值的 1%'],['出售等待',`2 期 · 当前每期 ${getTurnMonths(s)} 个月`]];foot='投资房可装修一次，提高租金。出售扣除 5% 费用，按揭优先结清；租金不抵扣自己的日常生活费。';}
 if(kind==='angel'){facts=[['持有的是','未上市公司股权'],['初始锁定',`6 期 · 当前每期 ${getTurnMonths(s)} 个月`],['转让费用','成交额的 8%']];foot='估值上涨不等于现金到账。项目可能失败，新融资可能稀释股份；跟投后至少再锁定 3 期。';action=button('查看尽调资料',{type:'desk_research',product:kind,instrument:item.id});}
 if(kind==='ponzi'){title='熟人高息项目';intro='熟人把群里的到账截图转给你，说自己已经拿过几次收益。你追问资金用在哪里，对方只让你先看看页面上的余额。';facts=[['收益来源','未能核实'],['账面增长','约 18% / 年 · 未提现'],['提现方式','随时申请，可能失败']];foot='项目余额只是对方记的数字。提现成功才成为现金，并扣 0.2% 费用；停付时转为追偿，不能继续当现金花。';action=button('核对合同与资金来源',{type:'desk_research',product:kind,instrument:item.id});}
 if(kind==='fund'){title='这只基金怎么配置';facts=[['配置风格',item.name],['首次赎回','申购后的下一交易日'],['赎回费用','赎回额的 1%']];foot='定投按人生回合执行，不是每天自动扣钱。下一期申购同样金额，现金不足时跳过，可在计划中暂停。';}
 if(kind==='bond'){title='票息与还本安排';facts=[['年票息率',`${item.coupon/100}%`],['到期期限',`${item.months} 个月`],['投入 1 万元年票息',money(item.coupon*100)]];foot='按实际持有时长计息，到期还本。提前出售按市价结算并扣 0.2%；违约后停止付息，转入追偿。';}
 if(!facts.length)return '';
 return `<section class="project-brief" aria-label="项目资料"><header><h2>${esc(title)}</h2><p>${esc(intro)}</p></header>${pairs(facts)}<p class="project-footnote">${esc(foot)}</p>${action?`<div class="project-research">${action}</div>`:''}</section>`;
}
export function projectPosition(p,{s,money,esc,button}){
 const ponzi=p.kind==='ponzi',wait=Math.max(0,p.lockUntilTurn-s.turn),difference=p.value-p.cost;
 const row=(k,v)=>`<div><dt>${k}</dt><dd>${v}</dd></div>`;
 return `<article class="desk-position-row project-holding"><header class="position-heading"><div><h3>${esc(p.name)}</h3><span>${ponzi?'提现成功才可使用':wait?`锁定中 · 还需 ${wait} 期`:'已解锁 · 可申请转让'}</span></div><div><small>${ponzi?'项目账面余额':'当前股权估值'}</small><strong>${money(ponzi?(p.bookBalance??p.value):p.value)}</strong></div></header><dl class="position-numbers">${row('累计投入',money(p.cost))}${row(ponzi?'账面增减':'估值增减',(difference>0?'+':'')+money(difference))}${!ponzi?row('持股份额',`${(p.ownershipBps??1000)/100}%`):''}</dl><div class="position-actions">${button(ponzi?'申请全部提现':'转让全部股权',{type:'desk_sell',id:p.id,bps:10000})}</div><p class="position-footnote">${ponzi?'提现不受证券交易日限制，失败后按实际结果转入追偿。':'估值仍未兑现，转让成功后才有现金回款。'}</p></article>`;
}
