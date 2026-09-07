import {test,expect,type Page} from '@playwright/test';
import {expeditionAccount} from './expedition-account-fixture';
import type {Snapshot} from '../src/game/types';
const state=(page:Page):Promise<Snapshot>=>page.evaluate(()=>(window as unknown as {__expeditionDebug:{snapshot:Snapshot}}).__expeditionDebug.snapshot);
test('guest movement survives uneven state delivery, pause and a fresh round',async({page,browser})=>{
 test.skip(process.env.ICP_LOCAL_BACKEND!=='1','Requires local records/rooms.');
 const context=await browser.newContext(),guest=await context.newPage(),errors:string[]=[];
 for(const surface of [page,guest])surface.on('pageerror',e=>errors.push(e.message));
 try{
  await expeditionAccount(page,81);await expeditionAccount(guest,82);
  // Delay only guest state delivery, after real WebRTC transport; no physics fixture.
  await guest.addInitScript(()=>{
   const original=Object.getOwnPropertyDescriptor(RTCDataChannel.prototype,'onmessage')!;
   let count=0;
   Object.defineProperty(RTCDataChannel.prototype,'onmessage',{
    configurable:true,get:original.get,
    set(listener:(event:MessageEvent)=>void){
     original.set!.call(this,(event:MessageEvent)=>{
      const packet=JSON.parse(event.data);
      if(packet.type==='state')setTimeout(()=>listener.call(this,event),[0,70,10,40][count++%4]);
      else listener.call(this,event);
     });
    },
   });
  });
  await page.goto('/?mode=expedition');await expect(page.locator('#exp-host')).toBeEnabled({timeout:30000});
  await page.locator('#exp-host').click();await expect(page.locator('#exp-invite')).not.toHaveValue('',{timeout:30000});
  await guest.goto(await page.locator('#exp-invite').inputValue());await expect(guest.locator('#exp-ready')).toBeEnabled({timeout:40000});
  await guest.locator('#exp-ready').click();await expect(page.locator('#exp-ready')).toBeEnabled();await page.locator('#exp-ready').click();
  await expect(guest.locator('#exp-hud')).toBeVisible();
  const before=await state(guest);await guest.keyboard.down('KeyW');
  await expect.poll(async()=>Math.hypot((await state(guest)).player.position.x-before.player.position.x,(await state(guest)).player.position.z-before.player.position.z),{timeout:10000}).toBeGreaterThan(1);
  await guest.keyboard.up('KeyW');
  await guest.locator('#exp-pause-button').click();await expect(page.locator('#exp-pause')).toBeVisible();
  const tick=(await state(page)).tick;
  await guest.locator('#exp-resume').click();await expect.poll(async()=>(await state(guest)).tick).toBeGreaterThan(tick+6);
  await page.locator('#exp-pause-button').click();await page.locator('#exp-restart').click();
  await expect(guest.locator('#exp-hud')).toBeVisible();await expect.poll(async()=>(await state(guest)).tick).toBeLessThan(tick);
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
