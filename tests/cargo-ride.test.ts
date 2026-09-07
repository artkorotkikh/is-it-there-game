import { beforeAll, afterEach, it, expect } from 'vitest';
import { initPhysics, Simulation } from '../src/game/simulation';
import { tracks } from '../src/game/tracks';
import { config } from '../src/game/config';
import { advance, install, placePlayer } from './cargo-helpers';
import { neutralInput } from '../src/game/types';
const worlds: Simulation[] = [];
beforeAll(initPhysics);
afterEach(() => worlds.splice(0).forEach(sim => sim.destroy()));
function create() { const sim = new Simulation('recovery', tracks[2]); worlds.push(sim); return sim; }
// Test-only initial placement; each crossing uses Rapier suspension and road collisions.
function startAt(sim: Simulation, z: number, reverse = false) {
  const x = sim.level.centerX(z);
  sim.vehicle.setTranslation({ x, y: sim.level.groundHeight(x, z) + 1.4, z }, true);
  sim.vehicle.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  sim.vehicle.setLinvel({ x: 0, y: 0, z: 0 }, true); sim.vehicle.setAngvel({ x: 0, y: 0, z: 0 }, true);
  advance(sim, 3);
  if (!sim.snapshot().player.driving) { placePlayer(sim, x + 3, z); sim.action('interact'); }
  expect(sim.snapshot().player.driving).toBe(true);
  return reverse ? -1 : 1;
}
function cross(sim: Simulation, end: number, speed: number, direction = 1) {
  sim.vehicle.setLinvel({ x: 0, y: 0, z: speed * direction }, true);
  let peak = 0, rattle = 0;
  for (let i = 0; i < 1800 && (end - sim.vehicle.translation().z) * direction > 0; i++) {
    const state = sim.snapshot();
    sim.step({ ...neutralInput(), moveZ: state.vehicle.speed < speed ? direction * .5 : 0, brake: state.vehicle.speed > speed + .2 });
    peak = Math.max(peak, sim.snapshot().vehicle.shock);
    rattle = Math.max(rattle, ...sim.snapshot().canisters.filter(c => c.phase === 'docked').map(c => Math.abs(c.rattle)));
  }
  expect((sim.vehicle.translation().z - end) * direction).toBeGreaterThanOrEqual(0);
  return { peak, rattle };
}
for (const bump of [98, 124, 138, 152, 198]) it(`quarry bump ${bump}: fast impacts eject cargo; careful crossing visibly rattles and keeps it`, () => {
  const slow = create(); startAt(slow, bump - 8); const gentle = cross(slow, bump + 5, 1.7);
  expect(slow.canisters.loadedCount()).toBe(3);
  expect(gentle.rattle).toBeGreaterThan(.001);
  for (const speed of [8, config.vehicle.maxSpeed]) {
    const fast = create(); startAt(fast, bump - 8); const hard = cross(fast, bump + 5, speed);
    expect(hard.peak).toBeGreaterThan(config.cargo.shockThreshold);
    expect(hard.rattle).toBeGreaterThan(.018);
    expect(hard.rattle).toBeGreaterThan(gentle.rattle);
    expect(hard.rattle).toBeLessThanOrEqual(config.cargo.rattleTravel);
    expect(fast.snapshot().events.filter(e => e.kind === 'eject')).toHaveLength(1);
    expect(fast.canisters.loadedCount()).toBe(2);
  }
});
it('repeat physical crossings can eject all three types and the reinstalled first module again', () => {
  const sim = create();
  for (const type of ['winch', 'skills', 'cycles', 'winch'] as const) {
    startAt(sim, 116); cross(sim, 127, 8);
    expect(sim.canisters.isDocked(type), type).toBe(false);
    if (type === 'skills') expect(sim.snapshot().systems.driveInputArmed).toBe(false);
    if (type === 'cycles') expect(sim.snapshot().systems.engine).toBe(false);
    advance(sim, 2, { brake: true }); sim.action('interact');
    install(sim, type);
    expect(sim.canisters.loadedCount()).toBe(3);
  }
  expect(sim.snapshot().progress.ejected).toEqual({ winch: true, skills: true, cycles: true });
});
it('reverse travel also responds to real bumps', () => {
  const sim = create(); startAt(sim, 132, true); cross(sim, 120, 8, -1);
  expect(sim.canisters.loadedCount()).toBe(2);
});
it('fast flat travel does not eject cargo; visual rattling settles after parking', () => {
  const sim = create(); startAt(sim, 4); cross(sim, 12, 8);
  expect(sim.canisters.loadedCount()).toBe(3);
  advance(sim, 5, { brake: true });
  expect(Math.max(...sim.snapshot().canisters.map(c => Math.abs(c.rattle)))).toBeLessThan(.002);
});
it('one sustained shock cannot empty the bay and freshly docked cargo has settling time', () => {
  const sim = create(); advance(sim, 3);
  // Exercise the burst gate with a sustained sensor signal, independent of road seams.
  for (let i = 0; i < 600; i++) sim.canisters.updateRide(30, 8);
  expect(sim.canisters.loadedCount()).toBe(2);
  advance(sim, 2); install(sim, 'winch');
  sim.canisters.eject('skills'); sim.canisters.eject('cycles');
  for (let i = 0; i < 30; i++) sim.canisters.updateRide(0, 8);
  sim.canisters.updateRide(30, 8); expect(sim.canisters.isDocked('winch')).toBe(true);
  for (let i = 0; i < 150; i++) sim.canisters.updateRide(0, 8);
  sim.canisters.updateRide(30, 8); expect(sim.canisters.isDocked('winch')).toBe(false);
});
