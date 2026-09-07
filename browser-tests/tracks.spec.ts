import { test, expect } from '@playwright/test';
import { tracks } from '../src/game/tracks';
import { canisterTypes } from '../src/game/types';
import { startPractice, carefulSpeed,collect,enter,followRoad,hold,install,recoverCargo,state,stop,walkTo } from './helpers';

for (const track of tracks.slice(1)) test(`${track.name}: full cargo delivery through the distinct course`,async({page})=>{
  test.setTimeout(720_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/');await page.getByRole('button',{name:new RegExp(track.number+' /')}).click();
  await expect(page.locator(`#track-${track.id}`)).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:`test-results/${track.id}-menu.png`});
  await page.locator('#start').click();
  expect((await state(page)).trackId).toBe(track.id);
  for(const type of canisterTypes){await collect(page,type);await install(page,type);}
  console.log(track.id,'loaded');
  await enter(page);await followRoad(page,s=>s.progress.ejected.winch);
  console.log(track.id,'winch lost');
  await stop(page,true);await page.keyboard.press('KeyE');await collect(page,'winch');await install(page,'winch');await enter(page);await page.keyboard.press('KeyP');
  await followRoad(page,s=>s.vehicle.position.z>track.ditch[0]+1,{maxSpeed:1.5});expect((await state(page)).systems.loaded).toBe(3);await stop(page);await page.keyboard.press('KeyE');
  const rv=(await state(page)).vehicle.position;await walkTo(page,rv.x+2.6,rv.z+2.8);await page.keyboard.press('KeyF');
  await walkTo(page,track.anchorX,track.anchorZ-2);await page.keyboard.press('KeyE');expect((await state(page)).winch.phase).toBe('attached');
  await page.keyboard.down('KeyQ');await expect.poll(async()=>(await state(page)).progress.recovered,{timeout:45_000}).toBe(true);await page.keyboard.up('KeyQ');await page.keyboard.press('KeyF');
  console.log(track.id,'recovered');
  await enter(page);await followRoad(page,s=>s.progress.ejected.skills);await stop(page);
  // Braking can leave loose cargo under the rear bay. With SKILLS missing, S
  // moves forward: park beyond the fallen module before walking back for it.
  await hold(page,['KeyS'],1600);await stop(page,true);await page.keyboard.press('KeyE');
  await collect(page,'skills');await install(page,'skills');await enter(page);await page.keyboard.press('KeyP');
  await page.screenshot({path:`test-results/${track.id}-course.png`});
  if(track.id==='finality-quarry') {
    // Reproduce the user's late-roller report with real driving, then reinstall.
    await followRoad(page,s=>!s.systems.engine);
    expect((await state(page)).vehicle.position.z).toBeGreaterThan(110);
    await page.screenshot({path:'test-results/quarry-late-cycles-loss.png'});
    await recoverCargo(page);
    await followRoad(page,s=>!s.systems.winch);
    expect((await state(page)).vehicle.position.z).toBeGreaterThan(130);
    await page.screenshot({path:'test-results/quarry-repeat-winch-loss.png'});
    await recoverCargo(page);
  }
  await followRoad(page,s=>s.progress.finished,{maxSpeed:s=>Math.min(carefulSpeed(s),track.obstacles.length ? 4 : 8),targetX:track.obstacles.length ? s=>{
    const next=track.obstacles.find(block=>block.z+6>s.vehicle.position.z);
    return next ? (next.x<0 ? 2.55 : -2.55) : 0;
  }:undefined});
  await expect(page.locator('#finish')).toBeVisible();await expect(page.locator('#finish-time')).toContainText(track.name);
  await expect(page.locator('#save-status')).toContainText('Guest delivery');expect((await state(page)).systems.loaded).toBe(3);
  await page.screenshot({path:`test-results/${track.id}-finish.png`});expect(errors).toEqual([]);
  await page.getByRole('button',{name:'Choose a track',exact:true}).click();await expect(page.locator('#menu')).toBeVisible();
});

test('track selection, practice, restart and pause preserve course and timer rules',async({page})=>{
  await page.goto('/');await page.locator('#track-finality-quarry').click();await startPractice(page);
  await expect(page.locator('#run-timer')).toContainText('PRACTICE');expect((await state(page)).vehicle.position.z).toBeCloseTo(52,0);
  await page.keyboard.press('Escape');const elapsed=(await state(page)).progress.elapsed;await page.waitForTimeout(350);expect((await state(page)).progress.elapsed).toBe(elapsed);
  await page.getByRole('button',{name:'Start over',exact:true}).click();expect((await state(page)).trackId).toBe('finality-quarry');expect((await state(page)).systems.loaded).toBe(3);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to title'}).click();await page.locator('#track-old-road').click();
  await page.locator('#start').click();expect((await state(page)).trackId).toBe('old-road');expect((await state(page)).systems.loaded).toBe(0);
});
