import {positionDailySpeech} from './daily-scene.js';

// The game shell owns scrolling. Title, birth and ending screens use the window.
let viewportObserver;
export function syncGameViewport(shell){
 viewportObserver?.disconnect();viewportObserver=null;
 if(!shell)return;
 const nav=shell.querySelector('.bottom-nav'),dock=shell.querySelector('.daily-operation-dock'),profile=shell.querySelector('.player-profile'),tools=shell.querySelector('.header-tools');
 const measure=()=>{
  const bottom=parseFloat(getComputedStyle(nav).bottom)||0;
  const gap=parseFloat(getComputedStyle(shell).getPropertyValue('--screen-gap'))||12;
  const navSpace=nav.offsetHeight+bottom+gap;
  const panelGap=parseFloat(getComputedStyle(shell).getPropertyValue('--panel-gap'))||16;
  const dockBottom=nav.offsetHeight+bottom+panelGap;
  // Leave a usable scene above the dock, including on short phone screens.
  const contentTop=shell.querySelector('.game-scroll')?.getBoundingClientRect().top||0;
  const available=window.innerHeight-contentTop-navSpace-panelGap*2;
  const dockLimit=Math.max(96,available-Math.min(120,available*.35));
  shell.style.setProperty('--operation-max-height',`${Math.floor(dockLimit)}px`);
  shell.style.setProperty('--game-nav-space',`${navSpace}px`);
  shell.style.setProperty('--daily-dock-bottom',`${dockBottom}px`);
  shell.style.setProperty('--game-bottom-space',`${dock?dockBottom+dock.offsetHeight+panelGap:navSpace}px`);
  if(profile)shell.style.setProperty('--status-rail-top',`${Math.ceil(profile.getBoundingClientRect().bottom+gap)}px`);
  if(tools)shell.style.setProperty('--right-rail-top',`${Math.ceil(tools.getBoundingClientRect().bottom+gap)}px`);
  positionDailySpeech(shell);
 };
 measure();viewportObserver=new ResizeObserver(measure);for(const element of [nav,dock,shell,profile,tools,shell.querySelector('.daily-stage')])if(element)viewportObserver.observe(element);
}
export function gameScrollContainer(){return document.querySelector('.game-scroll');}
export function scrollGameTo(top){(gameScrollContainer()||window).scrollTo({top,behavior:'instant'});}
export function scrollGameBy(top){(gameScrollContainer()||window).scrollBy({top,behavior:'instant'});}
export function gameScrollBounds(){
 const region=gameScrollContainer();
 if(region){const r=region.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}
 const header=document.querySelector('.player-header'),nav=document.querySelector('.bottom-nav');
 return {top:header&&getComputedStyle(header).position==='fixed'?header.getBoundingClientRect().bottom:0,bottom:nav?.getBoundingClientRect().top??innerHeight};
}
