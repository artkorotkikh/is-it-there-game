import { expect } from 'vitest';
import { config, moduleDefinitions } from '../src/game/config';
import { add, rotate } from '../src/game/math';
import type { Simulation } from '../src/game/simulation';
import { canisterTypes, neutralInput, type CanisterType, type InputFrame } from '../src/game/types';

export function advance(sim: Simulation, seconds: number, input: Partial<InputFrame> = {}) {
  for (let i = 0; i < seconds / config.physics.step; i++) sim.step({ ...neutralInput(), ...input });
}
/** Test fixture placement only; all possession changes still use public interactions. */
export function placePlayer(sim: Simulation, x: number, z: number) {
  const p = { x, z, y: sim.level.groundHeight(x, z) + .85 };
  sim.player.setTranslation(p, true); sim.player.setNextKinematicTranslation(p);
  advance(sim, .1);
}
export function atSocket(sim: Simulation, type: CanisterType) {
  const p = add(sim.vehicle.translation(), rotate({ x: moduleDefinitions[type].x, y: 0, z: -3.15 }, sim.vehicle.rotation()));
  placePlayer(sim, p.x, p.z);
}
export function pickup(sim: Simulation, type: CanisterType) {
  const p = sim.canisters.position(type);
  placePlayer(sim, p.x, p.z - .8);
  sim.action('interact');
  expect(sim.canisters.carried(), sim.prompt()).toBe(type);
}
export function install(sim: Simulation, type: CanisterType) {
  pickup(sim, type); atSocket(sim, type); sim.action('interact');
  expect(sim.canisters.isDocked(type), sim.prompt()).toBe(true);
}
export function loadAll(sim: Simulation) {
  for (const type of canisterTypes) if (!sim.canisters.isDocked(type)) install(sim, type);
  const p = sim.vehicle.translation(); placePlayer(sim, p.x + 3.1, p.z);
}
export function remove(sim: Simulation, type: CanisterType) {
  atSocket(sim, type); sim.action('interact'); advance(sim, config.cargo.removeSeconds + .1, { interact: true });
  expect(sim.canisters.carried(), sim.prompt()).toBe(type);
}
