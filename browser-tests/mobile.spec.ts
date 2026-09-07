import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { startPractice, state } from './helpers';
import type { Snapshot } from '../src/game/types';

// Real browser touch events (including concurrent IDs), never simulation setters.
class Fingers {
  private points=new Map<number,{x:number;y:number;id:number}>();
  constructor(private cdp:CDPSession){}
  async down(id:number,x:number,y:number){this.points.set(id,{x,y,id});await this.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[...this.points.values()]});}
  async move(id:number,x:number,y:number){this.points.set(id,{x,y,id});await this.cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[...this.points.values()]});}
  async up(id:number){this.points.delete(id);await this.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[...this.points.values()]});}
  async cancel(){this.points.clear();await this.cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});}
}
async function center(page:Page,selector:string){const r=await page.locator(selector).boundingBox();expect(r).not.toBeNull();return {x:r!.x+r!.width/2,y:r!.y+r!.height/2};}
async function ticks(page:Page,count:number){const tick=(await state(page)).tick;await page.waitForFunction(target=>(window as unknown as {__rvDebug:{snapshot:Snapshot}}).__rvDebug.snapshot.tick>=target,tick+count);}
async function tap(page:Page,fingers:Fingers,selector:string){const p=await center(page,selector);await fingers.down(8,p.x,p.y);await ticks(page,2);await fingers.up(8);}

for(const size of [{width:390,height:844},{width:844,height:390}]) test(`phone ${size.width}×${size.height}: multitouch movement, actions, camera, cancel and pause`,async({browser})=>{
  const context=await browser.newContext({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:5173/');await expect(page.locator('html')).toHaveClass(/touch-mode/);
    await expect(page.locator('#start')).toBeEnabled();await page.screenshot({path:`test-results/phone-${size.width}-title.png`});
    await startPractice(page,true);await expect(page.locator('#touch-controls')).toBeVisible();
    await expect(page.locator('#controls')).toBeHidden();
    const fingers=new Fingers(await context.newCDPSession(page));
    const stick=await center(page,'#touch-stick'),before=await state(page);
    await fingers.down(1,stick.x,stick.y-32);await ticks(page,12);
    const walking=await state(page);expect(walking.player.position.z).toBeGreaterThan(before.player.position.z+.4);
    // Second finger orbits while first keeps walking; lifting it must not stop walking.
    await fingers.down(2,size.width*.48,size.height*.5);await fingers.move(2,size.width*.48+45,size.height*.5-10);await ticks(page,5);await fingers.up(2);await ticks(page,10);
    const looked=await state(page);expect(Math.abs(looked.player.yaw)).toBeGreaterThan(.1);expect(looked.player.position.z).toBeGreaterThan(walking.player.position.z+.4);
    await fingers.cancel();await ticks(page,8);const released=(await state(page)).player.position;await ticks(page,12);
    expect(Math.hypot((await state(page)).player.position.x-released.x,(await state(page)).player.position.z-released.z)).toBeLessThan(.03);
    await page.locator('#pause-button').tap();await expect(page.locator('#touch-controls')).toBeHidden();await page.locator('#pause-music').tap();await expect(page.locator('#pause-music')).toHaveAttribute('aria-pressed','false');
    await page.locator('#restart').tap();await ticks(page,60);
    // Starting near the side door lets the same touch context action enter the bus.
    await tap(page,fingers,'#touch-KeyE');expect((await state(page)).player.driving).toBe(true);
    const driveStick=await center(page,'#touch-stick');const z=(await state(page)).vehicle.position.z;
    await fingers.down(1,driveStick.x,driveStick.y-40);await ticks(page,45);expect((await state(page)).vehicle.position.z).toBeGreaterThan(z+.3);
    const brake=await center(page,'#touch-Space');await fingers.down(3,brake.x,brake.y);await ticks(page,40);expect((await state(page)).vehicle.speed).toBeLessThan(.6);await fingers.up(3);
    await page.locator('#pause-button').tap();const tick=(await state(page)).tick;await page.waitForTimeout(150);expect((await state(page)).tick).toBe(tick);
    await fingers.cancel();await page.locator('#resume').tap();await ticks(page,6);expect((await state(page)).vehicle.throttle).toBe(0);
    for(const selector of ['#touch-stick','#touch-KeyE','#touch-KeyF','#touch-Space','#pause-button']){
      const r=(await page.locator(selector).boundingBox())!;expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(size.width);expect(r.y+r.height).toBeLessThanOrEqual(size.height);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    await page.screenshot({path:`test-results/phone-${size.width}-driving.png`});expect(errors).toEqual([]);
  } finally {await context.close();}
});

async function touchWalk(page:Page,fingers:Fingers,x:number,z:number,ready?: (s:Snapshot)=>boolean) {
  const stick=await center(page,'#touch-stick'),r=(await page.locator('#touch-stick').boundingBox())!,radius=r.width*.34;
  await fingers.down(1,stick.x,stick.y);
  for(let i=0;i<240;i++) {
    const s=await state(page),dx=x-s.player.position.x,dz=z-s.player.position.z,d=Math.hypot(dx,dz);
    if(ready ? ready(s) : d<.45){await fingers.up(1);await ticks(page,2);return;}
    const mx=-Math.cos(s.player.yaw)*dx+Math.sin(s.player.yaw)*dz,mz=Math.sin(s.player.yaw)*dx+Math.cos(s.player.yaw)*dz;
    const scale=radius/Math.max(1,d);await fingers.move(1,stick.x+mx*scale,stick.y-mz*scale);await ticks(page,5);
  }
  await fingers.up(1);throw new Error(`Touch walk failed: ${JSON.stringify(await state(page))}`);
}

test('phone: load all cargo, cancel a held removal, attach a tree and reel with touch only',async({browser})=>{
  test.setTimeout(240_000);
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();
  try {
    await page.goto('http://127.0.0.1:5173/');await page.locator('#start').tap();const fingers=new Fingers(await context.newCDPSession(page));await ticks(page,40);
    for(const type of ['winch','cycles','skills'] as const){
      let s=await state(page),item=s.canisters.find(c=>c.type===type)!;
      await touchWalk(page,fingers,item.position.x,item.position.z-1.2,s=>s.interaction.kind==='pickup' && s.interaction.type===type);await tap(page,fingers,'#touch-KeyE');
      expect((await state(page)).canisters.find(c=>c.type===type)!.phase).toBe('carried');
      s=await state(page);item=s.canisters.find(c=>c.type===type)!;
      await touchWalk(page,fingers,item.socket.x,s.vehicle.position.z-3.2,s=>s.interaction.kind==='dock' && s.interaction.type===type);await tap(page,fingers,'#touch-KeyE');
      expect((await state(page)).canisters.find(c=>c.type===type)!.phase).toBe('docked');
    }
    expect((await state(page)).systems.loaded).toBe(3);await page.screenshot({path:'test-results/phone-cargo-loaded.png'});
    const e=await center(page,'#touch-KeyE');await fingers.down(9,e.x,e.y);await ticks(page,20);expect((await state(page)).interaction.hold).toBeGreaterThan(.2);
    await page.locator('#pause-button').tap();await fingers.cancel();await page.locator('#resume').tap();await ticks(page,50);expect((await state(page)).systems.loaded).toBe(3);
    await page.locator('#pause-button').tap();await page.locator('#back-menu').tap();await startPractice(page,true);await ticks(page,60);
    const rv=(await state(page)).vehicle.position;await touchWalk(page,fingers,rv.x+2.6,rv.z+2.8);await tap(page,fingers,'#touch-KeyF');expect((await state(page)).winch.phase).toBe('carried');
    await touchWalk(page,fingers,3.5,58);await expect(page.locator('#touch-KeyE')).toHaveText('Attach');await tap(page,fingers,'#touch-KeyE');expect((await state(page)).winch.phase).toBe('attached');
    const q=await center(page,'#touch-KeyQ');await fingers.down(4,q.x,q.y);await page.waitForFunction(()=>(window as unknown as {__rvDebug:{snapshot:Snapshot}}).__rvDebug.snapshot.progress.recovered,undefined,{timeout:45_000});await fingers.up(4);
    await page.screenshot({path:'test-results/phone-cable-recovery.png'});expect((await state(page)).progress.recovered).toBe(true);
  }finally{await context.close();}
});
