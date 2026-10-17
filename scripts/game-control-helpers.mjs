// Exercise the actual game dropdown, with native fallback for archived versions.
export async function chooseGameOption(page,selector,value){
 const select=page.locator(selector),trigger=select.locator('..').locator('.game-select-trigger');
 if(!await trigger.count())return select.selectOption(value);
 const index=await select.evaluate((s,v)=>Array.from(s.options).findIndex(o=>typeof v==='object'?o.label===v.label:o.value===String(v)),value);
 if(index<0)throw Error(`No option ${JSON.stringify(value)} in ${selector}`);
 await trigger.click();await page.locator('.game-choice-list:popover-open [role=option]').nth(index).click();
}
