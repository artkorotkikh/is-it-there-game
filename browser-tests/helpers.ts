import { expect, type Page } from '@playwright/test';
import { Level } from '../src/game/level';
import { trackById } from '../src/game/tracks';
import { moduleDefinitions } from '../src/game/config';
import { add, rotate } from '../src/game/math';
import type { CanisterType, Snapshot } from '../src/game/types';

export const state = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __rvDebug: { snapshot: Snapshot } }).__rvDebug.snapshot);
export async function startPractice(page: Page, touch = false) {
  const press = (selector: string) => touch ? page.locator(selector).tap() : page.locator(selector).click();
  await press('#start');
  await press('#pause-button');
  await press('#recovery');
}
export async function hold(page: Page, keys: string[], ms: number) {
  const tick = (await state(page)).tick;
  for (const key of keys) await page.keyboard.down(key);
  // Software WebGL may render slower than a short wall-clock key tap. Wait for
  // actual fixed ticks so a complete press cannot fall between two game frames.
  await page.waitForFunction(target => { const s = (window as unknown as { __rvDebug: { snapshot: Snapshot } }).__rvDebug.snapshot; return s.tick >= target || s.progress.finished; },
    tick + Math.max(1, Math.ceil(ms / 1000 * 60)), { timeout: 15000 });
  for (const key of keys) await page.keyboard.up(key);
}
export async function walkTo(page: Page, x: number, z: number, pickupType?: CanisterType, ready?: (s: Snapshot) => boolean) {
  for (let i = 0; i < 220; i++) {
    const s = await state(page);
    if (pickupType && s.interaction.kind === 'pickup' && s.interaction.type === pickupType) return;
    if (ready?.(s)) return;
    const dx = x - s.player.position.x, dz = z - s.player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .6 && !ready && !pickupType) return;
    const mx = -Math.cos(s.player.yaw) * dx + Math.sin(s.player.yaw) * dz;
    const mz = Math.sin(s.player.yaw) * dx + Math.cos(s.player.yaw) * dz;
    const keys = [];
    if (mx > .13) keys.push('KeyD'); if (mx < -.13) keys.push('KeyA');
    if (mz > .13) keys.push('KeyW'); if (mz < -.13) keys.push('KeyS');
    await hold(page, keys, distance < .6 ? 40 : 80);
  }
  const failed=await state(page);
  throw new Error(`Walk failed to ${x},${z}: ${JSON.stringify({player:failed.player,vehicle:failed.vehicle,canisters:failed.canisters,interaction:failed.interaction})}`);
}
export async function socket(page: Page, type: CanisterType) {
  const s = await state(page);
  const rear = add(s.vehicle.position, rotate({ x: 0, y: 0, z: -3.15 }, s.vehicle.rotation));
  const side = add(s.vehicle.position, rotate({ x: 3, y: 0, z: -3.15 }, s.vehicle.rotation));
  // Go around the chassis before approaching a socket from its accessible rear.
  if (s.player.position.z > rear.z + .4) await walkTo(page, side.x, side.z);
  const target = add(s.vehicle.position, rotate({ x: moduleDefinitions[type].x, y: 0, z: -3.15 }, s.vehicle.rotation));
  await walkTo(page, target.x, target.z, undefined, s => s.interaction.type === type && ['dock', 'remove', 'blocked'].includes(s.interaction.kind) && s.interaction.position !== null);
}
export async function collect(page: Page, type: CanisterType) {
  const s = await state(page);
  const p = s.canisters.find(item => item.type === type)!.position;
  if (s.player.position.z > s.vehicle.position.z - 2.6 && !(s.interaction.kind === 'pickup' && s.interaction.type === type)) {
    const x=s.vehicle.position.x+3, z=Math.min(p.z-1.65,s.vehicle.position.z-3.6);
    await walkTo(page,x,z,undefined,s=>(s.interaction.kind==='pickup' && s.interaction.type===type) || Math.hypot(s.player.position.x-x,s.player.position.z-z)<.6);
  }
  await walkTo(page, p.x, p.z - 1.35, type);
  await expect(page.locator('#prompt')).toContainText(`Pick up ${moduleDefinitions[type].label}`);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await state(page)).canisters.find(item => item.type === type)!.phase).toBe('carried');
}
export async function install(page: Page, type: CanisterType) {
  await socket(page, type);
  await expect(page.locator('#prompt')).toContainText(`Install ${moduleDefinitions[type].label}`);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await state(page)).canisters.find(item => item.type === type)!.phase).toBe('docked');
}
export async function enter(page: Page) {
  const s = await state(page);
  await walkTo(page, s.vehicle.position.x + 3.8, s.player.position.z);
  await walkTo(page, s.vehicle.position.x + 3.8, s.vehicle.position.z);
  await walkTo(page, s.vehicle.position.x + 3, s.vehicle.position.z, undefined, s => Math.hypot(s.player.position.x - s.vehicle.position.x, s.player.position.y - s.vehicle.position.y, s.player.position.z - s.vehicle.position.z) < 3.3);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await state(page)).player.driving).toBe(true);
}
export async function stop(page: Page, park = false) {
  await page.keyboard.down('Space');
  await expect.poll(async () => (await state(page)).vehicle.speed, { timeout: 10000 }).toBeLessThan(.22);
  if (park && !(await state(page)).vehicle.parkingBrake) await page.keyboard.press('KeyP');
  await page.keyboard.up('Space');
}
/** Slow before elevation corners, including unmarked landings; no cargo immunity. */
export function carefulSpeed(s: Snapshot) {
  const track = trackById(s.trackId), z = s.vehicle.position.z;
  const rough = track.profile.slice(1, -1).some(([knot, height], i) => {
    const before = track.profile[i], after = track.profile[i + 2];
    const slopeChange = Math.abs((height - before[1]) / (knot - before[0]) - (after[1] - height) / (after[0] - knot));
    return slopeChange > .065 && knot - z < 9 && z - knot < 5;
  });
  return rough ? 1.5 : 5;
}
export async function recoverCargo(page: Page) {
  // Coast clear of the ejected item before braking, also with CYCLES offline.
  await hold(page, [], 600); await stop(page, true); await page.keyboard.press('KeyE');
  for (const item of (await state(page)).canisters) if (item.phase === 'loose') {
    await collect(page, item.type); await install(page, item.type);
  }
  expect((await state(page)).systems.loaded).toBe(3);
  await enter(page); await page.keyboard.press('KeyP');
}
export async function followRoad(page: Page, until: (s: Snapshot) => boolean, options: {targetX?: (s:Snapshot)=>number; maxSpeed?: number | ((s: Snapshot) => number)} = {}) {
  for (let i = 0; i < 2000; i++) {
    const s = await state(page);
    if (until(s)) return;
    // A real release must reach a simulation tick before a remapped command.
    if (!s.systems.driveInputArmed) { await hold(page, [], 50); continue; }
    const q = s.vehicle.rotation;
    const heading = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
    const lookahead=options.targetX ? 7 : 8;
    const level=new Level(trackById(s.trackId));
    const desired = Math.atan2(level.centerX(s.vehicle.position.z+lookahead)+(options.targetX?.(s) ?? 0)-s.vehicle.position.x,lookahead);
    const error = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
    const limit = typeof options.maxSpeed === 'function' ? options.maxSpeed(s) : options.maxSpeed ?? 99;
    const keys = s.vehicle.speed > limit ? ['Space'] : [s.systems.skills==='swapped' ? 'KeyS' : 'KeyW'];
    if (error > .05) keys.push(s.systems.skills==='swapped' ? 'KeyD' : 'KeyA'); if (error < -.05) keys.push(s.systems.skills==='swapped' ? 'KeyA' : 'KeyD');
    await hold(page, keys, 90);
  }
  throw new Error(`Route target not reached: ${JSON.stringify(await state(page))}`);
}
