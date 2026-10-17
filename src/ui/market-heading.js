import {marketSwitchOptions} from './market-menu.js';
import {infoButton} from './info-popover.js';
export function renderMarketHeading(kind,title,symbol,{icon,s}){
 return `<header class="market-heading"><div class="market-heading-name"><h1>${icon(symbol)}<span>${title}</span></h1>${infoButton('market:'+kind,title+'玩法说明')}</div><label class="market-heading-switch">换个市场<select id="desk-switch" aria-label="切换市场">${marketSwitchOptions(kind,s)}</select></label></header>`;
}
