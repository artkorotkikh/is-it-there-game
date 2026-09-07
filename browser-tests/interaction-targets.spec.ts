import {test,expect,type Page} from '@playwright/test';
import type {Simulation} from '../src/game/simulation';
import type {Snapshot} from '../src/game/types';

const state=(page:Page):Promise<Snapshot>=>page.evaluate(()=>(window as unknown as {__expeditionDebug:{snapshot:Snapshot}}).__expeditionDebug.snapshot);
async function crowd(page:Page){
  // Only the obstacle arrangement is a fixture. The live expedition, physics,
  // keyboard/touch input, selection HUD and pickup transitions are the real code.
  await page.route('**/src/game/simulation.ts*',async route=>{
    const response=await route.fetch(),body=await response.text();
    const anchor='this.attachedTree = this.level.anchors[0].id;';expect(body).toContain(anchor);
    await route.fulfill({response,body:body.replace(anchor,`${anchor} Object.assign(window,{__interactionFixture:this});`)});
  });
  await page.goto('/?mode=expedition');await expect(page.locator('#exp-explore')).toBeEnabled({timeout:30000});await page.locator('#exp-explore').click();
  await page.evaluate(()=>{
    const s=(window as unknown as {__interactionFixture:Simulation}).__interactionFixture;
    const plank=s.fieldKit!.items.find(item=>item.id==='plank-1')!;
    plank.position={x:1.04,y:s.level.groundHeight(1.04,2)+.13,z:2};plank.rotation={x:0,y:0,z:0,w:1};plank.phase='placed';
    plank.body.setTranslation(plank.position,true);plank.body.setRotation(plank.rotation,true);
    for(const [type,x,z] of [['winch',2,1.9],['skills',2.7,1.4]] as const){s.canisters.eject(type);const item=s.canisters.items[type];item.body.setTranslation({x,y:s.level.groundHeight(x,z)+.4,z},true);item.body.setLinvel({x:0,y:0,z:0},true);item.body.setAngvel({x:0,y:0,z:0},true);}
    const p={x:2,y:s.level.groundHeight(2,1)+1,z:1};s.player.setTranslation(p,true);s.player.setNextKinematicTranslation(p);
  });
  await expect.poll(async()=>(await state(page)).interaction.target?.id).toMatch(/^cargo:/);
}
async function select(page:Page,id:string,touch=false){
  for(let i=0;i<10;i++){
    const snapshot=await state(page);if(snapshot.interaction.target?.id===id)return;
    if(touch)await page.locator('#touch-KeyX').tap();else await page.keyboard.press('KeyX');
    await expect.poll(async()=>(await state(page)).interaction.target?.id).not.toBe(snapshot.interaction.target?.id);
  }
  throw new Error(`Cannot select ${id}`);
}

test('crowded pickup shows the exact target and cycles with keyboard or touch',async({page,browser})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await crowd(page);
  await expect(page.locator('#interaction-cycle')).toBeVisible();await select(page,'resource:plank-1');
  await expect(page.locator('#interaction-target')).toContainText('Plank · blocked');await expect(page.locator('#exp-prompt')).toContainText('in use');
  await page.keyboard.press('KeyE');expect((await state(page)).fieldKit!.carriedId).toBeNull();
  await select(page,'cargo:skills');await expect(page.locator('#interaction-target')).toHaveText('SKILLS');
  await expect(page.locator('#exp-prompt')).toHaveText('E · Pick up SKILLS');
  await page.screenshot({path:'test-results/interaction-target-desktop.png'});
  await page.keyboard.press('KeyE');await expect.poll(async()=>(await state(page)).canisters.find(item=>item.type==='skills')!.phase).toBe('carried');
  expect((await state(page)).canisters.find(item=>item.type==='winch')!.phase).toBe('loose');
  await page.locator('#exp-pause-button').click();await expect(page.locator('#interaction-target')).toBeHidden();expect(errors).toEqual([]);

  const context=await browser.newContext({hasTouch:true,viewport:{width:844,height:390}}),phone=await context.newPage();phone.on('pageerror',error=>errors.push(error.message));
  await crowd(phone);await expect(phone.locator('#touch-KeyX')).toBeVisible();await select(phone,'cargo:winch',true);
  await expect(phone.locator('#interaction-target')).toHaveText('WINCH');await phone.screenshot({path:'test-results/interaction-target-touch.png'});
  await phone.locator('#touch-KeyE').tap();await expect.poll(async()=>(await state(phone)).canisters.find(item=>item.type==='winch')!.phase).toBe('carried');
  expect(errors).toEqual([]);await context.close();
});
