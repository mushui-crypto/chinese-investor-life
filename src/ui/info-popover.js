import {prepareDialogContent} from './dialog-content.js';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function infoButton(key,label){return `<button type="button" class="info-button" data-action="info-open" data-info="${escape(key)}" aria-label="了解${escape(label)}" aria-haspopup="dialog" aria-expanded="false"><span aria-hidden="true">i</span></button>`;}
let active=null,source=null;
export function closeInfo(restore=false){
 const old=active,trigger=source;active=null;source=null;
 if(old){if(old.matches(':popover-open'))old.hidePopover();old.remove();}
 trigger?.setAttribute('aria-expanded','false');
 if(restore&&trigger?.isConnected)trigger.focus({preventScroll:true});
}
export function showInfo(trigger,{title,body}){
 if(source===trigger){closeInfo(true);return;}
 closeInfo();source=trigger;
 const panel=document.createElement('section');active=panel;
 panel.id='game-info';panel.className='game-info';panel.setAttribute('popover','auto');panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','game-info-title');
 panel.innerHTML=`<div class="info-heading"><h2 id="game-info-title">${escape(title)}</h2><button type="button" class="info-close" aria-label="关闭说明">×</button></div><div class="info-body">${body}</div>`;
 (trigger.closest('dialog[open]')||document.body).append(panel);
 prepareDialogContent(panel);trigger.setAttribute('aria-expanded','true');panel.showPopover({source:trigger});
 const place=()=>{if(active!==panel)return;const r=trigger.getBoundingClientRect(),w=panel.offsetWidth,h=panel.offsetHeight;panel.style.left=Math.max(12,Math.min(innerWidth-w-12,r.left))+'px';panel.style.top=Math.max(12,Math.min(innerHeight-h-12,r.bottom+8))+'px';};
 place();panel.querySelector('.info-close').focus({preventScroll:true});
 panel.querySelector('.info-close').addEventListener('click',()=>closeInfo(true));
 panel.addEventListener('toggle',e=>{if(e.newState==='closed'&&active===panel)closeInfo();});
}
// Escape dismisses the small explanation before an enclosing character dialog.
if(typeof document!=='undefined'){
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();e.stopImmediatePropagation();closeInfo(true);}},true);
 document.addEventListener('click',e=>{if(active&&e.target.closest('[data-action]')?.dataset.action!=='info-open'&&e.target.closest('[data-action]'))closeInfo(active.contains(e.target));});
 document.addEventListener('scroll',e=>{if(active&&!active.contains(e.target)&&e.target!==active)closeInfo();},true);
 window.addEventListener('resize',()=>closeInfo());
}
