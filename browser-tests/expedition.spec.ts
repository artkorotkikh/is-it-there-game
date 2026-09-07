import {test,expect,type Page} from '@playwright/test';
import type {Snapshot} from '../src/game/types';
import {expeditionAccount} from './expedition-account-fixture';
const state=(page:Page):Promise<Snapshot>=>page.evaluate(()=>(window as unknown as {__expeditionDebug:{snapshot:Snapshot}}).__expeditionDebug.snapshot);
async function hold(page:Page,keys:string[],ticks:number){const start=(await state(page)).tick;for(const key of keys)await page.keyboard.down(key);await expect.poll(async()=>(await state(page)).tick,{timeout:12000}).toBeGreaterThanOrEqual(start+ticks);for(const key of keys)await page.keyboard.up(key);}
async function walk(page:Page,x:number,z:number){for(let i=0;i<90;i++){const p=(await state(page)).player,dx=x-p.position.x,dz=z-p.position.z;if(Math.hypot(dx,dz)<.55)return;const mx=-Math.cos(p.yaw)*dx+Math.sin(p.yaw)*dz,mz=Math.sin(p.yaw)*dx+Math.cos(p.yaw)*dz;const keys=[];if(mx>.2)keys.push('KeyD');if(mx<-.2)keys.push('KeyA');if(mz>.2)keys.push('KeyW');if(mz<-.2)keys.push('KeyS');await hold(page,keys,6);}throw new Error(`Walk failed ${JSON.stringify((await state(page)).player)}`);}
test('ICP invite, two browsers, shared props, guest driving, pause and restart',async({page,browser})=>{
 test.skip(process.env.ICP_LOCAL_BACKEND!=='1','Requires the local rooms canister; see docs/networking.md.');
 test.setTimeout(180_000);
 const requests:string[]=[];for(const surface of [page])surface.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const guestContext=await browser.newContext({viewport:{width:1280,height:800}}),guest=await guestContext.newPage();guest.on('pageerror',e=>errors.push(e.message));guest.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
 await expeditionAccount(page,61);await expeditionAccount(guest,62);
 await page.goto('/?mode=expedition');await expect(page.locator('#exp-host')).toBeEnabled({timeout:30000});await page.screenshot({path:'test-results/expedition-menu.png'});
 await page.locator('#exp-host').click();await expect(page.locator('#exp-invite')).not.toHaveValue('',{timeout:30000});const invite=await page.locator('#exp-invite').inputValue();
 await guest.goto(invite);await expect(guest.locator('#exp-ready')).toBeEnabled({timeout:40000});await expect(page.locator('#exp-ready')).toBeDisabled();
 await guest.locator('#exp-ready').click();await expect(page.locator('#exp-ready')).toHaveText('Start expedition ↗');await page.locator('#exp-ready').click();await expect(guest.locator('#exp-hud')).toBeVisible();
 expect((await state(guest)).players).toHaveLength(2);const onboardingRequests=requests.length;
 // Host places a real prop through ordinary controls; guest receives its owner/pose.
 await walk(page,5,5);await page.keyboard.press('KeyE');await expect.poll(async()=>(await state(page)).fieldKit!.carriedId).toBe('plank-1');
 await expect.poll(async()=>(await state(guest)).fieldKit!.items.find(i=>i.id==='plank-1')!.carrierId).toBe('local-player');
 await walk(page,9,16);await hold(page,['KeyQ'],15);await expect.poll(async()=>(await state(page)).fieldKit!.preview!.valid).toBe(true);await page.keyboard.press('KeyE');await expect.poll(async()=>(await state(guest)).fieldKit!.items.find(i=>i.id==='plank-1')!.phase).toBe('placed');
 await page.keyboard.press('KeyT');await expect.poll(async()=>(await state(guest)).fieldKit!.ping).not.toBeNull();
 // Guest owns the driver's seat and controls the single host-simulated bus.
 await walk(guest,-2.3,3);await hold(guest,[],12);await expect(guest.locator('#exp-prompt')).toContainText('Get in');await guest.keyboard.press('KeyE');await expect.poll(async()=>(await state(guest)).player.driving).toBe(true);
 const z=(await state(page)).vehicle.position.z;await hold(guest,['KeyW'],70);await expect.poll(async()=>(await state(page)).vehicle.position.z).toBeGreaterThan(z+.8);await hold(guest,['Space'],25);
 await page.screenshot({path:'test-results/expedition-team.png'});await guest.screenshot({path:'test-results/expedition-guest.png'});
 await guest.locator('#exp-pause-button').click();await expect(page.locator('#exp-pause')).toBeVisible();const tick=(await state(page)).tick;await page.waitForTimeout(400);expect((await state(page)).tick).toBe(tick);
 await guest.locator('#exp-resume').click();await expect(page.locator('#exp-hud')).toBeVisible();await expect.poll(async()=>(await state(page)).tick).toBeGreaterThan(tick);
 await page.locator('#exp-pause-button').click();await page.locator('#exp-restart').click();await expect.poll(async()=>(await state(guest)).fieldKit!.items.find(i=>i.id==='plank-1')!.phase).toBe('available');
 expect(requests.length).toBe(onboardingRequests);
 await guestContext.close();await expect(page.locator('#exp-lobby')).toBeVisible({timeout:10000});expect(errors).toEqual([]);
});
