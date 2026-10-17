/** Exercise the player's shared clock, including the messages it stops at. */
export async function clearClockMessages(page,current){
 for(let guard=0;guard<12;guard++){
  const s=await current();if(!s.lifeArcs?.pending&&!s.behavior?.pending&&!s.dayRoutine?.pending)return;
  await page.locator('.desk-quickbar [data-action=life-continue]:visible').click();
  const choice=page.locator('#game-dialog [data-action=day-command]:not([disabled]),#game-dialog [data-action=life-command]:not([disabled]),#game-dialog [data-action=behavior-do]:not([disabled])').first();
  await choice.click();if(await page.locator('#game-dialog').evaluate(e=>e.open))await page.locator('#game-dialog [data-action=close-dialog]').first().click();
 }
 throw Error('消息处理未能收敛');
}
