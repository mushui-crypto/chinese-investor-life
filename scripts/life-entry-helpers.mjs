/** Navigate the same visible disclosure controls as a player; never change game state. */
export async function openLifeEntry(page,action){
 let target=page.locator(`[data-action="${action}"]:visible`).first();
 if(!await target.count()){
  if(['goals','guide-route'].includes(action)&&await page.locator('.life-notebook>summary:visible').count())await page.locator('.life-notebook>summary').click();
  else if(await page.locator('[data-info="desk-life"]:visible').count())await page.locator('[data-info="desk-life"]:visible').first().click();
  else {await page.locator('[data-action=tab][data-tab=life]:visible').first().click();if(['goals','guide-route'].includes(action))await page.locator('.life-notebook>summary').click();}
 }
 await page.locator(`[data-action="${action}"]:visible`).first().click();
}
