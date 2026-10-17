const statNames={health:'健康',stress:'压力',academic:'学业',discipline:'自律',skill:'本事',insight:'眼力',trust:'人缘',fame:'名气'};
const signed=n=>n>0?`+${n}`:`−${-n}`;
export function option(id,label,text,stats={},fatigue=0,heat=0,cost=0){
 const note=[...(cost?[`花费 ¥${cost/100}`]:[]),...Object.entries(stats).map(([k,v])=>`${statNames[k]} ${signed(v)}`),...(fatigue?[`疲劳 ${signed(fatigue)}`]:[]),...(heat?[`上头 ${signed(heat)}`]:[])].join(' · ');
 return {choice:[id,label,note],effect:{text,stats,fatigue,heat,cost}};
}
export function event(title,text,stages,roles,options,when){
 return {title,text,stages,roles,when,choices:options.map(o=>o.choice),effects:Object.fromEntries(options.map(o=>[o.choice[0],o.effect]))};
}
