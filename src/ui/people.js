import {renderFamilyPanel,childAgeLabel} from './family-life.js';
import {childAge} from '../game/household.js';
import {familyState,FAMILY_STAGES} from '../game/family-life.js';
import {isCollegeStudent} from '../game/education.js';
import {hasMetPerson,storyPeople} from '../game/people.js';
import {lifeArcs,PEOPLE,relation,rebuildOffers} from '../game/life-arcs.js';
import {getActionAvailability} from '../game/core.js';

const ROLES={N01:'同学',N02:'朋友',N03:'创业者',N04:'同事',N05:'银行客户经理',N06:'理财推介人',N07:'社区店主',N08:'投资圈联系人',N09:'学徒',N10:'家人',N11:'媒体策划',N12:'师傅'};
export function personPortrait(s,id){
  if(id==='N09'&&s.household.hasChild&&childAge(s)!==null&&childAge(s)<.25)return '/assets/events/family-newborn-hospital-v1.png';
  const variant=id==='N10'?(s.familyId==='F11'?'N10-single':s.familyId==='F12'?'N10-elders':'N10'):id;
  return `/assets/people/${variant}.webp`;
}
export function peopleDirectory(s,catalog,view={}){
  const a=lifeArcs(s),offers=rebuildOffers(s),day=s.debtClock?.day||0;
  const people=catalog.characters.filter(p=>hasMetPerson(s,p.id)).map(p=>{
    const promise=a.promises.find(x=>x.id===p.id&&x.status==='open');
    const work=offers.filter(o=>o.personId===p.id&&(o.id!=='reentry'||s.flags.ever_released));
    const jobs=a.jobs.filter(j=>work.some(o=>o.id===j.id));
    const deceased=p.id==='N10'&&!s.household.livingParent;
    return {...p,promise,work,jobs,deceased,trust:Math.round(relation(s,p.id)),role:deceased?'家人 · 已离世':p.id==='N02'&&s.household.partner?FAMILY_STAGES[familyState(s).stage]:p.id==='N09'&&s.household.hasChild?'孩子 · '+childAgeLabel(s):ROLES[p.id],hasWork:work.some(o=>!a.used.includes(o.id))||jobs.length>0};
  }).sort((x,y)=>Number(Boolean(y.promise))-Number(Boolean(x.promise))||Number(y.jobs.length>0)-Number(x.jobs.length>0));
  const filter=['all','promises','work'].includes(view.filter)?view.filter:'all';
  const filtered=people.filter(p=>filter==='promises'?p.promise:filter==='work'?p.hasWork:true);
  return {a,day,people,filtered,filter,selected:filtered.find(p=>p.id===view.selectedId)||filtered[0],counts:{all:people.length,promises:people.filter(p=>p.promise).length,work:people.filter(p=>p.hasWork).length}};
}

export function renderPeoplePage(s,catalog,{esc,icon,money,ageText},view={}){
  const {a,day,people,filtered,filter,selected,counts}=peopleDirectory(s,catalog,view);
  const portrait=(id,cls='')=>id==='N09'&&s.household.hasChild&&(childAge(s)===null||childAge(s)>=.25&&childAge(s)<18)?`<span class="contact-portrait child-age-portrait ${cls}" aria-label="小满，${childAgeLabel(s)}">${childAge(s)===null?'小满':childAge(s)<1/12?'初生':childAge(s)<1?Math.floor(childAge(s)*12)+'月':Math.floor(childAge(s))+'岁'}</span>`:`<img class="contact-portrait ${cls}" src="${personPortrait(s,id)}" alt="" width="72" height="72" decoding="async">`;
  const command=(action,label,personId,primary=false)=>{
    const can=getActionAvailability(s,action);
    return `<button class="button small ${primary?'primary':''}" data-action="people-command" data-person-id="${personId}" data-command="${esc(JSON.stringify(action))}" ${can.allowed?'':'disabled'}>${esc(label)}</button>${can.reason?`<small class="contact-reason">${esc(can.reason)}</small>`:''}`;
  };
  const filters=[['all','全部'],['promises','待赴约'],['work','工作机会']];
  const roster=filtered.map(p=>{
    const status=p.promise?(p.promise.day===day?'今天赴约':`${Math.max(0,p.promise.day-day)} 天内赴约`):p.jobs.length?'有工作待交付':a.visits[p.id]===day?'今天见过':p.role;
    return `<button class="contact-picker ${selected?.id===p.id?'selected':''}" data-action="people-select" data-person-id="${p.id}" aria-pressed="${selected?.id===p.id}" aria-controls="contact-detail">${portrait(p.id)}<span class="contact-picker-copy"><strong>${esc(p.id==='N10'?'家人':p.name)}</strong><small class="${p.promise?'has-promise':''}">${esc(status)}</small></span>${p.promise?'<span class="contact-dot" aria-hidden="true"></span>':''}</button>`;
  }).join('');

  function detail(p){
    const events=new Map(catalog.events.map(e=>[e.id,e]));
    const stories=(s.storyHistory||[]).filter(h=>storyPeople(events.get(h.eventId),h.text).includes(p.id));
    const memories=a.memories[p.id]||[];
    const workHistory=a.history.filter(h=>p.work.some(o=>h.key==='done_'+o.id||h.key==='cancel_'+o.id));
    const lastWork=workHistory.at(-1),lastMemory=memories.at(-1);
    const newest=lastWork&&lastWork.day>(lastMemory?.day??-1)?lastWork:lastMemory||stories.at(-1);
    const latest=newest?.text||(p.id==='N10'?'从小照顾你的人。':'刚认识，往后慢慢来往。');
    const latestAge=newest?.age;const infant=p.id==='N09'&&s.household.hasChild&&childAge(s)!==null&&childAge(s)<3;
    const records=[...memories.filter(m=>!stories.some(h=>m.text.startsWith(h.title+'：'))),...stories,...workHistory].sort((x,y)=>y.age-x.age||(y.day||0)-(x.day||0));
    const feedback=view.feedback?.personId===p.id?view.feedback:null;
    const visit=PEOPLE[p.id]&&!p.deceased?`<section class="contact-section contact-meeting"><div class="contact-section-heading"><h3>${p.promise?'这次约定':'日常来往'}</h3><span>1 点精力</span></div>${p.promise?`<div class="contact-appointment"><strong>${p.promise.day===day?'今天要赴约':`约好见面 · 还剩 ${Math.max(0,p.promise.day-day)} 天`}</strong><span>赴约信任 +8；失约 −12</span></div>`:''}<div class="contact-action-row"><div><strong>${p.promise?'按约见面':infant?'陪小满玩，分担照护':'见个面，聊聊近况'}</strong><p>信任 +${p.promise?8:4} · 人缘 +2 · 压力 −3</p><small>每人每天一次</small></div><div class="contact-action-end">${command({type:'life_visit',id:p.id},p.promise?'去赴约':infant?'陪伴照护':'见个面',p.id,true)}</div></div></section>`:'';
    const remaining=p.work.filter(o=>!a.used.includes(o.id)||p.jobs.some(j=>j.id===o.id));
    const work=remaining.length?`<section class="contact-section"><div class="contact-section-heading"><h3>工作机会</h3><span>接单用 1 点精力</span></div>${remaining.map(o=>{
      const job=p.jobs.find(j=>j.id===o.id);
      return `<div class="contact-action-row contact-opportunity"><div><h4>${esc(o.title)}</h4><p>${esc(o.text)}</p>${o.cost?`<small>现在支付 ${money(o.cost)} 材料费</small>`:''}</div><div class="contact-action-end">${job?`<strong class="contact-job">已接下 · ${Math.max(0,job.due-day)} 天后交付</strong>`:command({type:'life_offer',id:o.id},o.wage?'接受安排':'接下这单',p.id)}</div></div>`;
    }).join('')}</section>`:'';
    const family=[];
    if(p.id==='N09'&&s.household.hasChild&&childAge(s)!==null&&childAge(s)>=18&&s.age>=55)family.push(['往后走自己的路','资产和债务仍归你名下','','succession','让孩子自己选']);
    const familyHtml=family.length?`<section class="contact-section"><div class="contact-section-heading"><h3>关系与家庭</h3><span>1 点精力</span></div>${family.map(([title,hint,cost,kind,label])=>`<div class="contact-action-row contact-family"><div><h4>${title}</h4><p>${hint}</p>${cost?`<small>${cost}</small>`:''}</div><div class="contact-action-end">${command({type:'relationship',kind},label,p.id)}</div></div>`).join('')}</section>`:'';
    return `<article class="contact-detail" id="contact-detail" data-person-id="${p.id}" aria-labelledby="contact-name"><header class="contact-identity">${portrait(p.id,'large')}<div><span class="contact-eyebrow">${esc(p.role)}</span><h2 id="contact-name" tabindex="-1">${esc(p.name)}</h2></div><div class="contact-trust"><span>信任</span><strong>${p.trust}<small> / 100</small></strong><span class="contact-trust-track" aria-hidden="true"><i style="width:${p.trust}%"></i></span></div></header>${feedback?`<div class="contact-feedback" role="status" tabindex="-1"><strong>${icon('check')} ${esc(feedback.title)}</strong><p>${esc(feedback.text)}</p><div class="contact-feedback-metrics">${feedback.trust?`<span>信任 ${feedback.trust>0?'+':''}${feedback.trust}</span>`:''}${feedback.actions?`<span>消耗 ${feedback.actions} 点精力</span>`:''}${feedback.cash?`<span>现金 ${feedback.cash>0?'+':''}${money(feedback.cash)}</span>`:''}</div></div>`:`<div class="contact-recent"><span>最近往来${newest?.date?' · '+esc(newest.date):latestAge===undefined?'':' · 你 '+ageText(latestAge)+'时'}</span><p>${esc(latest)}</p></div>`}${p.id==='N02'?renderFamilyPanel(s,{esc,money}):''}${visit}${work}${familyHtml}${!PEOPLE[p.id]||p.deceased?`<p class="contact-no-action">${p.deceased?'往事留在这里。':'等有新消息，再接着聊。'}</p>`:''}${records.length?`<details class="contact-history" data-fold="contact-history-${p.id}"><summary>往来记录 <span>${records.length} 条</span>${icon('chevron')}</summary><div>${records.slice(0,12).map(m=>`<p><span>${ageText(m.age)}${m.title?' · '+esc(m.title):''}</span>${esc(m.text)}</p>`).join('')}</div></details>`:''}</article>`;
  }
  const empty=filter==='promises'?'目前没有待赴的约。':filter==='work'?'认识的人里暂时没有工作机会。':'还没有认识的人。';
  return `<section class="workspace people-workspace" aria-labelledby="people-title"><header class="contacts-heading"><h1 id="people-title">${icon('people')} 人情往来</h1><span>认识 ${people.length} 人<small>精力 ${s.actionPoints} / 2</small></span></header><div class="contacts-toolbar" aria-label="筛选人物">${filters.map(([id,label])=>`<button class="button small contact-filter ${filter===id?'selected':''}" data-action="people-filter" data-filter="${id}" aria-pressed="${filter===id}">${label}<span>${counts[id]}</span></button>`).join('')}${a.pending?'<button class="button small contacts-message" data-action="life-scene">读新消息</button>':''}</div><div class="contacts-book"><nav class="contacts-roster" aria-label="已认识的人物">${roster||'<p class="contact-roster-empty">暂无人物</p>'}</nav>${selected?detail(selected):`<div class="contacts-empty"><h2>${empty}</h2><p>${filter==='work'?(isCollegeStudent(s)?'课余时段可以做兼职。':'可以先找份工作、接零工，或学点本事。'):'去过日子，有约定再回来。'}</p><button class="button" data-action="people-filter" data-filter="all">查看全部人物</button>${filter==='work'?`<button class="button" data-action="${isCollegeStudent(s)?'student-jobs':'go-work'}">${isCollegeStudent(s)?'查看兼职日程':'去找工作'}</button>`:''}</div>`}</div>${s.age>=55?`<details class="contacts-later" data-fold="people-later"><summary>往后的安排 ${icon('chevron')}</summary><div>${command({type:'life_succession'},'整理交接清单',selected?.id||'N10')}${s.flags.exit_intent?'<span>已经决定封盘</span>':command({type:'exit_risk'},'决定封盘',selected?.id||'N10')}<small>每项用 1 点精力</small></div></details>`:''}</section>`;
}
