import { test, expect } from '@playwright/test';
import { enter, followRoad, hold, startPractice, state, stop } from './helpers';
import { rotate } from '../src/game/math';
import { config } from '../src/game/config';

test('optional roadside rock: drive one side onto it, exit and kick the bus upright',async({page})=>{
  test.setTimeout(300_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/');await startPractice(page);await enter(page);
  await followRoad(page,s=>s.vehicle.position.z>62,{maxSpeed:3});
  await page.screenshot({path:'test-results/rollover-approach.png'});
  await followRoad(page,s=>rotate({x:0,y:1,z:0},s.vehicle.rotation).y<.3,{
    targetX:()=>config.rolloverRock.roadOffset-config.vehicle.wheelX,
    maxSpeed:6,
  });
  await stop(page);
  expect((await state(page)).vehicle.position.z).toBeGreaterThan(70);
  expect((await state(page)).vehicle.position.z).toBeLessThan(85);
  await page.screenshot({path:'test-results/rollover-side.png'});
  await page.keyboard.press('KeyE');await hold(page,[],200);
  expect((await state(page)).player.driving).toBe(false);
  await expect.poll(async()=> (await state(page)).recovery.available).toBe(true);
  await expect(page.locator('#prompt')).toContainText('Kick the bus upright');
  await hold(page,['KeyE'],1000);
  await expect.poll(async()=>rotate({x:0,y:1,z:0},(await state(page)).vehicle.rotation).y,{timeout:20000}).toBeGreaterThan(.85);
  for(let i=0;i<4;i++)await hold(page,[],1000);
  expect((await state(page)).recovery.kicks).toBe(1);
  expect(rotate({x:0,y:1,z:0},(await state(page)).vehicle.rotation).y).toBeGreaterThan(.85);
  await page.screenshot({path:'test-results/rollover-upright.png'});
  expect(errors).toEqual([]);
});
