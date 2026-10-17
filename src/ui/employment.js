import {renderPayroll} from './payroll.js';
import {careerIdentity,INDUSTRIES,careerStatus} from '../game/careers.js';
import {isCollegeStudent,COLLEGE_GRADUATION_AGE} from '../game/education.js';
import {attendanceStatus} from '../game/attendance.js';
import {employmentStatus,WORK_EVENT_NAMES} from '../game/employment.js';

export function employmentBadge(s,{esc}){
 const status=employmentStatus(s);
 return `<span class="employment-badge is-${status.key}" aria-label="就业状态：${esc(status.label)}">${esc(status.label)}</span>`;
}
export function renderCareerRoute(s,{esc,money}){
 const v=careerStatus(s);if(!v||employmentStatus(s).key!=='employed')return '';
 return `<section class="career-route" aria-label="职业晋升路线"><h4>${esc(v.route.name)} · 晋升路线</h4><p class="field-help">${esc(careerIdentity(s).company)} · ${esc(INDUSTRIES[careerIdentity(s).industry])}</p><p class="field-help">${esc(v.entry)}</p><ol class="career-steps">${v.route.roles.map((name,i)=>`<li${i===v.level?' aria-current="step"':''}><span>${i+1}</span><strong>${esc(name)}</strong><small>${i<v.level?'已走过':i===v.level?'当前岗位':'后续岗位'}</small></li>`).join('')}</ol>${v.next?`<div class="career-next"><strong>下一步：${esc(v.next)}</strong><span>晋升后月薪 +${money(v.raise*100)}</span></div><dl class="career-requirements">${v.needs.map(n=>`<div><dt>${esc(n.label)}</dt><dd>${n.value} / ${n.target}${n.unit||''}<small>${n.value>=n.target?'已达到':'尚需 '+(n.target-n.value)+(n.unit||' 点')}</small></dd></div>`).join('')}</dl><p class="field-help">出勤、能力与最近 30 天稳定表现全部达标后，在正常出勤结算时晋升。请假、旷工不计有效出勤；当天迟到、工作出错、疲劳 ≥65 或健康 <35 暂缓评定。新工资从次日计薪，每月 10 号发上月工资。</p>`:'<p class="field-help">已走到这条路线的最高岗位，可以继续工作，也可以另找机会。</p>'}</section>`;
}
export function renderWorkUpdate(s,{esc,money}){
 const attendance=attendanceStatus(s),dismissal=attendance.last;
 if(dismissal?.fired&&(s.debtClock?.day||0)-dismissal.day<=1&&employmentStatus(s).key==='unemployed')return '<div class="employment-update" role="status"><strong>因缺勤被开除 · 补偿 ¥0</strong><p>不再计薪，生活费继续；已赚工资仍按原发薪日到账。重新投递和面试需要时间，可先接零工周转。</p></div>';
 const last=s.employment?.history.at(-1);
 if(!last||(s.debtClock?.day||0)-last.day>1)return '';
 return `<div class="employment-update" role="status"><strong>${WORK_EVENT_NAMES[last.kind]} <span class="${last.kind==='penalty'?'negative':'positive'}">${last.kind==='promotion'?'月薪 +':last.kind==='penalty'?'−':'+'}${money(last.amount)}</span></strong><p>${esc(last.text)}</p></div>`;
}
export function renderEmployment(s,{esc,money},{expanded=true}={}){
 if(s.age<18)return '';
 if(isCollegeStudent(s))return `<section class="employment-detail" aria-label="学业状态"><h3>学业状态 ${employmentBadge(s,{esc})}</h3><dl><div><dt>四年制本科</dt><dd>18 岁入学 · ${COLLEGE_GRADUATION_AGE} 岁毕业</dd></div><div><dt>课余收入</dt><dd>09:30 / 13:00 半天班<br>18:30 晚班</dd></div></dl></section>`;
 const status=employmentStatus(s),job=status.key==='employed',history=s.employment?.history||[],attendance=attendanceStatus(s);
 return `<section class="employment-detail" aria-label="工作状态与记录"><h3>工作状态 ${employmentBadge(s,{esc})}</h3><dl><div><dt>${status.key==='retired'?'每月养老金':'固定月薪'}</dt><dd>${money(s.monthlyIncome)}</dd></div>${status.key!=='retired'&&s.retirementIncome?`<div><dt>每月养老金</dt><dd>${money(s.retirementIncome)}</dd></div>`:''}${job?`<div><dt>当前岗位</dt><dd>${esc(s.occupation)}</dd></div>${s.employment?.tenure?`<div><dt>本次在岗</dt><dd>${s.employment.tenure} 天</dd></div>`:''}`:''}</dl>${renderPayroll(s,{money},{details:true,showMonthly:false})}${renderCareerRoute(s,{esc,money})}${job||s.attendance?.records.length?`<div class="attendance-summary"><strong>近 30 天 · ${job?'本份工作':'上一份工作'}</strong><span>请假 ${attendance.leave} / 3 次 · 旷工 ${attendance.absent} / 1 次</span><small>超限会被开除，无补偿；缺勤当天不计薪。</small></div>`:''}${s.attendance?.records.length?`<details class="work-history"><summary>出勤记录</summary><ol>${s.attendance.records.slice(-8).reverse().map(r=>`<li><strong>生活第 ${r.day+1} 天 · ${r.kind==='leave'?'请假':'旷工'}</strong><p>${r.fired?'超过次数，被开除；补偿 ¥0。':'当天无薪。'}</p></li>`).join('')}</ol></details>`:''}${history.length?`<details class="work-history" ${expanded?'open':''}><summary>最近的工作消息</summary><ol>${history.slice().reverse().map(h=>`<li><div><strong>${WORK_EVENT_NAMES[h.kind]}</strong><b class="${h.kind==='penalty'?'negative':'positive'}">${h.kind==='promotion'?'月薪 +':h.kind==='penalty'?'−':'+'}${money(h.amount)}</b></div><time>${h.date}</time><p>${esc(h.text)}</p></li>`).join('')}</ol></details>`:''}<details class="work-event-rules"><summary>奖金、考勤与离职</summary><ul><li>年终奖：在岗满 30 天，年底有机会拿到，通常 ¥300–5,000；不超过一个月工资，一年最多一次。</li><li>工作扣款：通常 ¥20–100，最多为月薪的 5%，两次至少隔 30 天。钱不够时记入待付账单。</li><li>考勤：滚动 30 天内，请假超过 3 次或旷工超过 1 次被开除，无补偿。重新入职后，新工作的次数从零计算。</li><li>裁员：入职前 60 天不触发；补偿随在岗时间增加，通常 ¥800–10,000，最多三个月工资。当天工资计入待发，次日起不再计薪。</li></ul></details></section>`;
}
