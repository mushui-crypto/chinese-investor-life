import {numberPresets} from './number-presets.js';
// Keep the original form values and validation; replace only the visible controls.
const choices=new WeakMap();
let serial=0,active=null,started=false;
const set=(node,key,value)=>{if(node.getAttribute(key)!==String(value))node.setAttribute(key,value);};
function fieldName(input){
 if(input.getAttribute('aria-label'))return input.getAttribute('aria-label');
 const label=input.labels?.[0];if(!label)return input.name==='amount'?'金额':'这一项';
 const copy=label.cloneNode(true);copy.querySelectorAll('input,select,textarea,button,.game-select,.game-number').forEach(n=>n.remove());
 return copy.textContent.trim()||'这一项';
}
function theme(node){return node.closest('.crypto-terminal')?'terminal':node.closest('.casino-hall')?'casino':'paper';}
export function closeGameChoice(restore=false){
 if(!active)return;
 const {panel,trigger}=active;active=null;
 if(panel.matches(':popover-open'))panel.hidePopover();panel.remove();
 set(trigger,'aria-expanded',false);trigger.removeAttribute('aria-activedescendant');
 if(restore&&trigger.isConnected)trigger.focus({preventScroll:true});
}
function syncChoice(select){
 const c=choices.get(select);if(!c)return;
 const text=select.selectedOptions[0]?.textContent||'请选择';
 if(c.value.textContent!==text)c.value.textContent=text;
 set(c.trigger,'aria-label',`${c.name}：${text}`);
 if(c.trigger.disabled!==select.disabled)c.trigger.disabled=select.disabled;
 set(c.trigger,'aria-required',select.required);
 if(active?.select===select&&select.disabled)closeGameChoice();
}
function highlight(index){
 if(!active)return;const a=active;
 if(!a.items[index]||a.items[index].disabled)return;
 a.index=index;
 a.items.forEach((x,i)=>x.node.classList.toggle('is-current',i===index));
 set(a.trigger,'aria-activedescendant',a.items[index].node.id);
 const option=a.items[index].node,top=option.offsetTop,bottom=top+option.offsetHeight;
 if(top<a.panel.scrollTop)a.panel.scrollTop=top;
 else if(bottom>a.panel.scrollTop+a.panel.clientHeight)a.panel.scrollTop=bottom-a.panel.clientHeight;
}
function move(step){
 if(!active)return;const a=active;
 for(let i=a.index+step;i>=0&&i<a.items.length;i+=step)if(!a.items[i].disabled){highlight(i);break;}
}
function commitChoice(index){
 const a=active;if(!a||a.items[index]?.disabled)return;
 const changed=a.select.selectedIndex!==index;
 a.select.selectedIndex=index;syncChoice(a.select);closeGameChoice(true);
 if(changed){a.select.dispatchEvent(new Event('input',{bubbles:true}));a.select.dispatchEvent(new Event('change',{bubbles:true}));}
}
function openChoice(select){
 const c=choices.get(select);if(select.disabled||!c)return;
 if(active?.select===select){closeGameChoice(true);return;}
 closeGameChoice();syncChoice(select);
 const panel=document.createElement('div');panel.id=c.listId;panel.className='game-choice-list';panel.dataset.controlTheme=theme(select);
 panel.setAttribute('popover','manual');panel.setAttribute('role','listbox');panel.setAttribute('aria-label',c.name);
 const items=Array.from(select.options,(option,index)=>{
  const node=document.createElement('div'),disabled=option.disabled||option.parentElement?.disabled;
  node.id=`${c.listId}-${index}`;node.className='game-choice-option';node.setAttribute('role','option');node.setAttribute('aria-selected',index===select.selectedIndex);node.setAttribute('aria-disabled',Boolean(disabled));
  const check=document.createElement('span');check.className='game-choice-check';check.setAttribute('aria-hidden','true');check.textContent=index===select.selectedIndex?'✓':'';
  const text=document.createElement('span');text.textContent=option.textContent;node.append(check,text);panel.append(node);
  node.addEventListener('pointerdown',e=>e.preventDefault());
  node.addEventListener('pointermove',()=>highlight(index));node.addEventListener('click',()=>commitChoice(index));
  return {node,disabled:Boolean(disabled)};
 });
 (select.closest('dialog[open]')||document.body).append(panel);
 active={select,trigger:c.trigger,panel,items,index:select.selectedIndex,search:'',searchAt:0};
 set(c.trigger,'aria-expanded',true);panel.showPopover();
 const view=window.visualViewport,r=c.trigger.getBoundingClientRect(),leftEdge=view?.offsetLeft||0,topEdge=view?.offsetTop||0,vw=view?.width||innerWidth,vh=view?.height||innerHeight;
 panel.style.width=Math.min(Math.max(r.width,220),vw-24)+'px';
 const below=topEdge+vh-r.bottom-12,above=r.top-topEdge-12,up=below<180&&above>below;
 panel.style.maxHeight=Math.max(44,Math.min(320,(up?above:below)-6))+'px';
 panel.style.left=Math.max(leftEdge+12,Math.min(r.left,leftEdge+vw-panel.offsetWidth-12))+'px';
 panel.style.top=Math.max(topEdge+12,up?r.top-panel.offsetHeight-6:r.bottom+6)+'px';
 active.rect=r;
 c.trigger.focus({preventScroll:true});
 highlight(items[select.selectedIndex]?.disabled?items.findIndex(x=>!x.disabled):select.selectedIndex);
}
function enhanceChoice(select){
 if(choices.has(select)){syncChoice(select);return;}
 const id=++serial,name=fieldName(select),labels=Array.from(select.labels||[]),wrapper=document.createElement('span'),trigger=document.createElement('button'),value=document.createElement('span'),arrow=document.createElement('span');
 wrapper.className='game-select';wrapper.dataset.controlTheme=theme(select);
 trigger.type='button';trigger.id=`game-choice-${id}`;trigger.className='game-select-trigger';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-label',name);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',`game-list-${id}`);
 value.className='game-select-value';arrow.className='game-select-arrow';arrow.textContent='▾';arrow.setAttribute('aria-hidden','true');trigger.append(value,arrow);
 const focused=document.activeElement===select;
 select.before(wrapper);wrapper.append(select,trigger);select.dataset.gameNative='';select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 choices.set(select,{trigger,value,listId:`game-list-${id}`,name});syncChoice(select);
 for(const label of labels){if(label.htmlFor===select.id&&select.id)label.htmlFor=trigger.id;else label.addEventListener('click',e=>{if(e.target===label){e.preventDefault();trigger.focus();}});}
 trigger.addEventListener('click',()=>openChoice(select));
 if(focused)trigger.focus({preventScroll:true});
}
function syncNumber(input){
 const wrap=input.closest('.game-number'),group=wrap?.querySelector('.number-presets');if(!group)return;
 const items=numberPresets({name:input.name,min:input.min===''?0:Number(input.min),max:input.max===''?Infinity:Number(input.max),step:Number(input.step)||1,presets:input.dataset.presets||''});
 const signature=JSON.stringify(items);
 if(group.dataset.signature!==signature){
  group.dataset.signature=signature;group.replaceChildren();
  for(const {value,label} of items){const b=document.createElement('button');b.type='button';b.className='button small number-preset';b.dataset.value=value;b.textContent=label;b.addEventListener('click',()=>{if(input.disabled||input.readOnly)return;input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));syncNumber(input);});group.append(b);}
 }
 for(const b of group.children){b.disabled=input.disabled||input.readOnly;set(b,'aria-pressed',Number(b.dataset.value)===input.valueAsNumber);}
 group.hidden=!items.length;
}
function enhanceNumber(input){
 if(input.closest('.game-number')){syncNumber(input);return;}
 if(!input.hasAttribute('aria-label'))input.setAttribute('aria-label',fieldName(input));
 const focused=document.activeElement===input,wrapper=document.createElement('span'),group=document.createElement('span');wrapper.className='game-number';group.className='number-presets';group.setAttribute('role','group');group.setAttribute('aria-label',fieldName(input)+'常用值');
 input.before(wrapper);wrapper.append(input,group);
 if(!input.hasAttribute('inputmode'))input.setAttribute('inputmode',Number(input.step||1)<1?'decimal':'numeric');
 syncNumber(input);if(focused)input.focus({preventScroll:true});
}
export function enhanceGameControls(root=document){
 root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]),textarea').forEach(input=>input.classList.add('game-text-input'));
 root.querySelectorAll('select').forEach(enhanceChoice);
 root.querySelectorAll('input[type="number"]').forEach(enhanceNumber);
 
 if(active&&!active.trigger.isConnected)closeGameChoice();
}
export function initGameControls(){
 if(started)return;started=true;enhanceGameControls();
 new MutationObserver(()=>enhanceGameControls()).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','readonly','selected','min','max','required']});
 for(const type of ['input','change'])document.addEventListener(type,e=>{
  if(e.target.matches('select'))syncChoice(e.target);
  if(e.target.matches('input,select,textarea')){
   e.target.removeAttribute('aria-invalid');choices.get(e.target)?.trigger.removeAttribute('aria-invalid');
   const error=document.getElementById(e.target.dataset.gameError);if(error){error.remove();const anchor=choices.get(e.target)?.trigger||e.target;const ids=(anchor.getAttribute('aria-describedby')||'').split(' ').filter(id=>id!==error.id);if(ids.length)set(anchor,'aria-describedby',ids.join(' '));else anchor.removeAttribute('aria-describedby');}
   if(e.target.matches('input[type="number"]'))syncNumber(e.target);
  }
 },true);
 document.addEventListener('reset',()=>queueMicrotask(()=>enhanceGameControls()));
 document.addEventListener('pointerdown',e=>{if(active&&!active.panel.contains(e.target)&&!active.trigger.contains(e.target))closeGameChoice();},true);
 document.addEventListener('scroll',e=>{if(active&&!active.panel.contains(e.target)){const r=active.trigger.getBoundingClientRect();if(Math.abs(r.top-active.rect.top)>1||Math.abs(r.left-active.rect.left)>1)closeGameChoice();}},true);
 window.addEventListener('resize',()=>closeGameChoice());
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&active){e.preventDefault();e.stopImmediatePropagation();closeGameChoice(true);return;}
  const trigger=e.target.closest('.game-select-trigger');if(!trigger)return;
  const select=trigger.closest('.game-select').querySelector('select');
  if(e.key==='Tab'){closeGameChoice();return;}
  if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(e.key)){
   e.preventDefault();e.stopImmediatePropagation();
   if(!active){openChoice(select);if(e.key==='Home')highlight(active?.items.findIndex(x=>!x.disabled));else if(e.key==='End'&&active)highlight(active.items.findLastIndex(x=>!x.disabled));return;}
   if(e.key==='Enter'||e.key===' ')commitChoice(active.index);
   else if(e.key==='Home')highlight(active.items.findIndex(x=>!x.disabled));
   else if(e.key==='End')highlight(active.items.findLastIndex(x=>!x.disabled));
   else move(e.key==='ArrowDown'?1:-1);
  }else if(e.key.length===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
   e.stopImmediatePropagation();if(!active)openChoice(select);if(!active)return;
   const now=Date.now();active.search=now-active.searchAt>700?e.key:active.search+e.key;active.searchAt=now;
   const index=Array.from(select.options).findIndex((o,i)=>!active.items[i].disabled&&o.textContent.trim().toLocaleLowerCase().startsWith(active.search.toLocaleLowerCase()));if(index>=0)highlight(index);
  }
 },true);
 // Inline validation also handles required hidden selects without native focus errors.
 document.addEventListener('invalid',e=>{
  const input=e.target;if(!input.matches('input,select,textarea'))return;e.preventDefault();
  const name=choices.get(input)?.name||fieldName(input),v=input.validity;
  let message=v.valueMissing?`请填写${name}`:v.rangeUnderflow?`最少填写 ${input.min}`:v.rangeOverflow?`最多填写 ${input.max}`:v.stepMismatch?`请按 ${input.step||1} 的单位填写`:'请检查这一项的内容';
  if(input.matches('select'))message=`请选择${name}`;
  const anchor=choices.get(input)?.trigger||input;set(anchor,'aria-invalid',true);
  const id=input.dataset.gameError||`game-field-error-${++serial}`;input.dataset.gameError=id;
  let error=document.getElementById(id);if(!error){error=document.createElement('span');error.id=id;error.className='game-field-error';error.setAttribute('role','alert');(input.closest('.game-number,.game-select')||input).after(error);}error.textContent=message;
  set(anchor,'aria-describedby',[...(anchor.getAttribute('aria-describedby')||'').split(' ').filter(Boolean).filter(x=>x!==id),id].join(' '));
  if(!input.form?.querySelector('[aria-invalid="true"]')||input.form.querySelector('[aria-invalid="true"]')===anchor)anchor.focus();
 },true);
}
