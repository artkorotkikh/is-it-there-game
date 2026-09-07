import {test,expect,type Page} from '@playwright/test';
import type {Snapshot} from '../src/game/types';

const state=(page:Page):Promise<Snapshot>=>page.evaluate(()=>(window as unknown as {__expeditionDebug:{snapshot:Snapshot}}).__expeditionDebug.snapshot);
async function walk(page:Page,x:number,z:number){
  for(let i=0;i<240;i++){
    const p=(await state(page)).player,dx=x-p.position.x,dz=z-p.position.z;
    if(Math.hypot(dx,dz)<.16)return;
    const mx=-Math.cos(p.yaw)*dx+Math.sin(p.yaw)*dz,mz=Math.sin(p.yaw)*dx+Math.cos(p.yaw)*dz;
    const keys:string[]=[];if(mx>.09)keys.push('KeyD');if(mx<-.09)keys.push('KeyA');if(mz>.09)keys.push('KeyW');if(mz<-.09)keys.push('KeyS');
    const tick=(await state(page)).tick;
    for(const key of keys)await page.keyboard.down(key);
    try{await expect.poll(async()=>(await state(page)).tick,{intervals:[16,32],timeout:12000}).toBeGreaterThanOrEqual(tick+3);}
    finally{for(const key of keys)await page.keyboard.up(key);}
  }
  throw new Error(`Could not walk to ${x}, ${z}: ${JSON.stringify((await state(page)).player)}`);
}

test('carry a longer plank to the ravine and place it from the bank',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?mode=expedition');
  await expect(page.locator('#exp-explore')).toBeEnabled({timeout:30000});await page.locator('#exp-explore').click();
  await expect(page.locator('#exp-hud')).toBeVisible();
  await walk(page,5,5);await page.keyboard.press('KeyE');
  await expect.poll(async()=>(await state(page)).fieldKit!.carriedId).toBe('plank-1');
  await walk(page,5,16);await walk(page,1.04,39.9);
  await expect.poll(async()=>(await state(page)).fieldKit!.preview!.valid).toBe(true);
  await page.screenshot({path:'test-results/expedition-plank-preview.png'});
  await page.keyboard.press('KeyE');
  await expect.poll(async()=>(await state(page)).fieldKit!.items.find(item=>item.id==='plank-1')!.phase).toBe('placed');
  expect((await state(page)).fieldKit!.carriedId).toBeNull();
  await page.screenshot({path:'test-results/expedition-plank-placed.png'});
  expect(errors).toEqual([]);
});
