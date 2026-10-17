import {jobOpportunities,jobSearchReason} from '../game/job-opportunities.js';
import {careerIdentity,INDUSTRIES} from '../game/careers.js';
import {hasSalariedJob} from '../game/work-economy.js';
import {getActionAvailability} from '../game/core.js';
import {jobSearchWait} from '../game/job-search.js';

export function renderJobOpportunities(s,{esc,money},selectedId){
 const employed=hasSalariedJob(s),identity=careerIdentity(s),offers=jobOpportunities(s);
 const o=offers.find(o=>o.id===selectedId)||offers[0];
 if(!o)return `<section class="job-search-progress"><h3>求职还在进行中</h3><p>${esc(jobSearchReason(s)||jobSearchWait(s)||'暂时没有合适的岗位。')}</p><p>零工做完结账，原来已经赚到的工资仍按发薪日到账。日常开支可以在生活安排中调整。</p><div class="dialog-footer"><button class="button primary" data-action="close-dialog">回到生活安排</button></div></section>`;
 const a=getActionAvailability(s,{type:'job_accept',offerId:o.id});
 const salaryLabel=offer=>!employed?'月薪':offer.delta===0?'月薪不变':`${offer.delta>0?'涨薪':'降薪'} ${money(Math.abs(offer.delta))}`;
 const salaryClass=offer=>!employed||offer.delta===0?'':offer.delta>0?'positive':'negative';
 return `<section class="job-search" aria-label="比较工作机会">
 <header class="job-current"><div><span>${employed?'现在的工作':s.flags.career_history?'重新找工作':'准备走进职场'}</span><strong>${esc(employed?identity.company+' · '+s.occupation:s.occupation||'暂无固定工作')}</strong>${employed?`<small>${esc(INDUSTRIES[identity.industry])}</small>`:''}</div><div class="job-current-pay"><span>${employed?'当前月薪':'固定工资'}</span><strong>${money(employed?s.monthlyIncome:0)}</strong></div></header>
 <p class="job-search-help">先比较条件，确定后再入职。查看不耗精力，接受一份工作用 1 点精力。</p>
 <div class="job-comparison"><nav class="job-offer-list" aria-label="工作机会">${offers.map(offer=>`<button class="job-offer-option ${offer.id===o.id?'selected':''}" data-action="job-select" data-id="${esc(offer.id)}" aria-pressed="${offer.id===o.id}" aria-controls="job-offer-detail"><strong>${esc(offer.label)}</strong><span class="${salaryClass(offer)}">${money(offer.wage)} <small>／月</small></span><small>${esc(salaryLabel(offer))}${offer.allowed?'':' · 条件未满足'}</small></button>`).join('')}</nav>
 <article class="job-offer-detail" id="job-offer-detail" aria-live="polite"><div class="job-offer-heading"><span>${esc(o.company)} · ${esc(INDUSTRIES[o.industry])}</span><h3>${esc(o.title)}</h3></div>
 <div class="job-salary"><strong>${money(o.wage)}<small>／月</small></strong><span class="${salaryClass(o)}">${esc(employed?salaryLabel(o):'每月 10 号发上月工资')}</span></div>
 <p>${esc(o.text)}</p>
 <dl class="job-terms"><div><dt>公司</dt><dd>${esc(employed&&identity.company===o.company?'保留现公司 · 内部转岗':o.company)}${employed&&identity.company!==o.company?'<small>更换公司，工龄重新累计</small>':''}</dd></div><div><dt>行业</dt><dd>${esc(employed?INDUSTRIES[identity.industry]+(identity.industry===o.industry?' · 不变':' → '+INDUSTRIES[o.industry]):INDUSTRIES[o.industry])}</dd></div></dl>
 <section class="job-prospect"><h4>${o.development==='mentored'?'导师带教 · 更快进入晋升考核':'岗位发展'}</h4>${o.next?`<p>${esc(o.title)} → <strong>${esc(o.next)}</strong></p><span>有效出勤 ${o.promotionDays} 天 · 谋生本事 ${o.promotionSkill} · 自律 ${o.promotionDiscipline}</span><p>晋升后月薪 <strong>${money(o.wage+o.promotionRaise)}</strong>（+${money(o.promotionRaise)}）</p><small>${o.creditedDays?'已有经验计入 '+o.creditedDays+' 天；':''}还需最近 30 天工作表现稳定；迟到、工作出错后重新观察，疲劳过高或健康过低暂缓。</small>`:'<p>已到该路线最高岗位，没有下一档固定晋升。</p>'}</section>
 <section class="job-requirements"><h4>申请条件</h4>${o.requirements.length?`<ul>${o.requirements.map(r=>`<li class="${r.met?'':'negative'}">${r.met?'已满足':'未满足'} · ${esc(r.label)} ${r.current} / ${r.target}</li>`).join('')}</ul>`:o.key==='same-industry'?'<p>认可现有岗位经历，没有额外申请门槛。</p>':'<p>接受新手，入职后从基础工作做起。</p>'}</section></article></div>
 <footer class="job-decision"><div><strong>${esc(o.label)}</strong><small>${a.allowed?`接受用 1 点精力 · 剩余 ${s.actionPoints} 点`:esc(a.reason)}</small></div><button class="button" data-action="close-dialog">${employed?'暂不换工作':'再考虑一下'}</button><button class="button primary" data-action="job-accept" data-id="${esc(o.id)}" ${a.allowed?'':'disabled'}>${employed?'接受这份安排':'接受这份工作'}</button></footer>
 </section>`;
}
