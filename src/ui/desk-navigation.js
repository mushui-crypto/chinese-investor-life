import {gameScrollBounds,scrollGameBy} from './game-scroll.js';
let keyboardTraversal=false;
export function noteTradeInput(event){keyboardTraversal=event.type==='keydown'&&event.key==='Tab';}
/** UI navigation only: these helpers never read RNG or submit an order. */
export function jumpWithinDesk(area){
 const selectors={order:'#desk-order,#gamble-form',holdings:'.desk-positions,.casino-history',market:'.stock-exchanges,.instrument-list,.terminal-chart-area,.casino-games,.project-brief'};
 const target=document.querySelector(selectors[area]);if(!target)return;
 const bar=document.querySelector('.game-scroll .desk-quickbar'),offset=gameScrollBounds().top+(bar?.getBoundingClientRect().height||0)+12;
 const focus=area==='order'?target.querySelector('input:not([disabled]),select:not([disabled])'):target;
 if(focus){if(focus===target)focus.tabIndex=-1;focus.focus({preventScroll:true});}
 // Open the history drawer when it is the destination, but never act on its contents.
 if(target.tagName==='DETAILS')target.open=true;
 scrollGameBy(target.getBoundingClientRect().top-offset);
}
export function captureTradeFocus(){
 const e=document.activeElement;if(!e||e.closest('#game-dialog'))return null;
 return {action:e.dataset.action,command:e.dataset.command,route:e.dataset.route,name:e.name,form:e.form?.id,type:e.type,value:e.value};
}
export function restoreTradeFocus(f){
 if(!f)return;let target;
 if(f.form)target=[...document.querySelectorAll(`#${CSS.escape(f.form)} input,#${CSS.escape(f.form)} select,#${CSS.escape(f.form)} button`)].find(e=>e.name===f.name&&e.type===f.type&&(f.type!=='radio'||e.value===f.value));
 else if(f.action)target=[...document.querySelectorAll('[data-action]')].find(e=>e.dataset.action===f.action&&(!f.command||e.dataset.command===f.command)&&(!f.route||e.dataset.route===f.route));
 if(!target||target.disabled)target=document.querySelector('.desk-quickbar [data-action=life-continue],.desk-quickbar [data-command]:not([disabled]),.desk-quickbar [data-action=desk-life-preview],.play-guide [data-action=guide-route]');
 target?.focus({preventScroll:true});
}
export function keepTradeFocusVisible(target){
 if(!keyboardTraversal||!target?.closest?.('#desk-order,#gamble-form,.crypto-account,.desk-position-row,.holding-actions,.story-panel .choice,.story-panel [data-action=continue]'))return;
 queueMicrotask(()=>{
  if(document.activeElement!==target||!target.isConnected)return;
  const r=target.getBoundingClientRect(),bar=document.querySelector('.game-scroll .desk-quickbar')?.getBoundingClientRect(),bounds=gameScrollBounds();
  const top=bar&&bar.top<=bounds.top+12?bar.bottom+12:bounds.top+12,bottom=bounds.bottom-12;
  if(r.height>bottom-top)return;
  if(r.bottom>bottom)scrollGameBy(r.bottom-bottom);
  else if(r.top<top)scrollGameBy(r.top-top);
 });
}
