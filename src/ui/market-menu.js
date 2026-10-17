import {discoveredMarkets,marketNotice} from '../game/market-notices.js';
import {getMarketAccess,getGamblingAccess} from '../game/market-access.js';
import {DESKS} from '../game/market-play.js';
export const isOptionMarket = key => ['option', 'option_short'].includes(key);
export const marketMenuKey = key => key === 'option_short' ? 'option' : key;
// Keep engine product IDs distinct; share navigation and access while settlement stays distinct.
export const MARKET_MENU = Object.entries(DESKS).filter(([key]) => key !== 'option_short').map(([key, desk]) => [key, key === 'option' ? '期权交易室' : desk.title]);
export const marketIsOpen = (state,key) => (key==='gambling'?getGamblingAccess(state):getMarketAccess(state,key)).unlocked;
export const marketIsVisible = (state,key) => marketIsOpen(state,key)||discoveredMarkets(state).includes(marketMenuKey(key));
export const visibleMarkets = state => MARKET_MENU.filter(([key])=>marketIsVisible(state,key));
export function marketSwitchOptions(selected,state) {
 return visibleMarkets(state).map(([key, title]) => `<option value="${key}" ${key === marketMenuKey(selected) ? 'selected' : ''}>${marketNotice(state,key)?'● ':''}${title}${marketIsOpen(state,key)?'':' · 待满足条件'}</option>`).join('');
}
