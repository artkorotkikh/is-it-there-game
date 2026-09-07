import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/game/config';
import { anchor, groundHeight } from '../src/game/level';
import { add, distance, rotate } from '../src/game/math';
import { initPhysics, Simulation } from '../src/game/simulation';
import { canisterTypes, neutralInput, type CanisterType, type StartMode } from '../src/game/types';
import { advance, atSocket, install, loadAll, pickup, placePlayer, remove } from './cargo-helpers';

const worlds: Simulation[] = [];
beforeAll(initPhysics);
afterEach(() => worlds.splice(0).forEach(sim => sim.destroy()));
function create(mode: StartMode = 'road') { const sim = new Simulation(mode); worlds.push(sim); advance(sim, 1); return sim; }
function enter(sim: Simulation) { const p = sim.vehicle.translation(); placePlayer(sim, p.x + 3, p.z); sim.action('interact'); expect(sim.snapshot().player.driving).toBe(true); }
function stop(sim: Simulation) { advance(sim, 2, { brake: true }); sim.action('interact'); }
function driveUntil(sim: Simulation, z: number, careful = false) {
  let peak = 0;
  for (let i = 0; i < 3000 && sim.vehicle.translation().z < z; i++) {
    const speed = sim.snapshot().vehicle.speed;
    sim.step({ ...neutralInput(), moveZ: careful ? speed < 1.65 ? .4 : 0 : 1, brake: careful && speed > 1.9 });
    peak = Math.max(peak, sim.snapshot().vehicle.shock);
  }
  return peak;
}

describe('three canisters', () => {
  it('starts with three loose IDs and no drive power; shortcut is already loaded', () => {
    const sim = create();
    expect(new Set(sim.snapshot().canisters.map(c => c.id)).size).toBe(3);
    expect(sim.snapshot().canisters.every(c => c.phase === 'loose')).toBe(true);
    enter(sim); advance(sim, 2, { moveZ: 1 });
    expect(sim.vehicle.translation().z).toBeCloseTo(3, 1);
    expect(sim.message).toContain('LOAD CANISTERS');
    const shortcut = create('recovery');
    expect(shortcut.snapshot().systems).toMatchObject({ startupCompleted: true, loaded: 3, engine: true, winch: true, skills: 'normal' });
  });

  it.each<CanisterType[][]>([
    [['winch', 'cycles', 'skills']], [['winch', 'skills', 'cycles']], [['cycles', 'winch', 'skills']],
    [['cycles', 'skills', 'winch']], [['skills', 'winch', 'cycles']], [['skills', 'cycles', 'winch']],
  ])('loads in order %j and requires all three at once', order => {
    const sim = create();
    order.forEach((type, i) => {
      install(sim, type);
      expect(sim.snapshot().systems.loaded).toBe(i + 1);
      expect(sim.snapshot().systems.startupCompleted).toBe(i === 2);
    });
    expect(sim.snapshot().vehicle.speed).toBeLessThan(.1);
    enter(sim); advance(sim, 1, { moveZ: 1 });
    expect(sim.vehicle.translation().z).toBeGreaterThan(4);
  });

  it('rejects wrong slots, distance and busy hands, then safely drops the same item', () => {
    const sim = create();
    pickup(sim, 'cycles');
    const id = sim.snapshot().canisters.find(c => c.type === 'cycles')!.id;
    atSocket(sim, 'winch'); sim.action('interact');
    expect(sim.canisters.carried()).toBe('cycles'); expect(sim.message).toContain('WINCH socket');
    placePlayer(sim, 3, 6); sim.action('winch'); expect(sim.snapshot().winch.phase).toBe('stowed');
    placePlayer(sim, 3, 3); sim.action('interact'); expect(sim.snapshot().player.driving).toBe(false);
    placePlayer(sim, 5, -3); sim.action('drop'); advance(sim, 2);
    const item = sim.snapshot().canisters.find(c => c.id === id)!;
    expect(item.phase).toBe('loose'); expect(item.position.y).toBeGreaterThan(groundHeight(item.position.x, item.position.z));
    expect(sim.snapshot().canisters).toHaveLength(3);
    expect(sim.snapshot().vehicle.speed).toBeLessThan(.1);
  });

  it('does not count a removed initial module, and only removes with an uninterrupted hold', () => {
    const sim = create(); install(sim, 'cycles'); install(sim, 'winch');
    atSocket(sim, 'winch'); sim.action('interact'); advance(sim, .3, { interact: true }); advance(sim, .1);
    expect(sim.canisters.isDocked('winch')).toBe(true);
    sim.action('interact'); advance(sim, .3, { interact: true }); sim.cancelInteractions(); advance(sim, 1, { interact: true });
    expect(sim.canisters.isDocked('winch')).toBe(true);
    remove(sim, 'winch'); placePlayer(sim, 4, -3); sim.action('drop'); install(sim, 'skills');
    expect(sim.snapshot().systems).toMatchObject({ startupCompleted: false, loaded: 2, engine: false });
    install(sim, 'winch'); expect(sim.snapshot().systems.startupCompleted).toBe(true);
  });

  it('releases from the socket with point velocity, falls outside the hollow bay and stays finite', () => {
    const sim = create(); loadAll(sim);
    sim.vehicle.setLinvel({ x: .2, y: 0, z: 4 }, true);
    sim.vehicle.setAngvel({ x: .1, y: .2, z: .05 }, true);
    const origin = sim.canisters.socket('winch');
    const v = sim.vehicle.velocityAtPoint(origin);
    const kick = rotate({ x: config.cargo.ejectSide, y: config.cargo.ejectLift, z: -config.cargo.ejectSpeed }, sim.vehicle.rotation());
    sim.canisters.eject('winch');
    expect(distance(sim.canisters.position('winch'), origin)).toBeLessThan(.001);
    expect(distance(sim.canisters.items.winch.body.linvel(), add(v, kick))).toBeLessThan(.001);
    let peak = 0;
    for (let i = 0; i < 240; i++) { sim.step(); peak = Math.max(peak, sim.snapshot().vehicle.speed, Math.hypot(...Object.values(sim.canisters.items.winch.body.linvel()))); }
    expect(peak).toBeLessThan(14);
    const item = sim.canisters.position('winch');
    expect(item.y).toBeGreaterThan(groundHeight(item.x, item.z));
    expect(distance(item, sim.canisters.socket('winch'))).toBeGreaterThan(.8);
    expect(sim.vehicle.mass()).toBeCloseTo(config.vehicle.mass, 2);
  });

  it('CYCLES removes power while preserving inertia and requires a fresh press after restoration', () => {
    const sim = create(); loadAll(sim); remove(sim, 'cycles');
    placePlayer(sim, 4, -2); sim.action('drop'); enter(sim);
    sim.vehicle.setLinvel({ x: 0, y: 0, z: 3 }, true);
    const z = sim.vehicle.translation().z; advance(sim, .4, { moveZ: 1 });
    expect(sim.vehicle.translation().z).toBeGreaterThan(z + .5);
    expect(sim.snapshot().vehicle.throttle).toBe(0); expect(sim.message).toContain('CYCLES DISCONNECTED');
    stop(sim); install(sim, 'cycles');
    // Power restoration is gated at the exact transition, before any neutral fixture steps.
    expect(sim.snapshot().systems.driveInputArmed).toBe(false);
    sim.step({ ...neutralInput(), moveZ: 1 }); expect(sim.snapshot().systems.driveInputArmed).toBe(false);
    sim.step(); expect(sim.snapshot().systems.driveInputArmed).toBe(true);
    enter(sim); advance(sim, 1, { moveZ: 1 }); expect(sim.snapshot().vehicle.throttle).toBe(1);
  });

  it('SKILLS reverses both driving axes after release, keeps walking, and restores normal driving', () => {
    const sim = create(); loadAll(sim); enter(sim);
    sim.canisters.eject('skills');
    const z = sim.vehicle.translation().z;
    advance(sim, 1, { moveZ: 1 }); expect(sim.vehicle.translation().z).toBeCloseTo(z, 1);
    expect(sim.snapshot().vehicle.throttle).toBe(0);
    advance(sim,.2,{moveX:1}); expect(sim.snapshot().systems.driveInputArmed).toBe(false);
    expect(sim.snapshot().vehicle.steering).toBe(0);
    sim.step(); advance(sim, 1.5, { moveZ: 1 });
    expect(sim.vehicle.translation().z).toBeLessThan(z - 2);
    expect(sim.snapshot().vehicle.throttle).toBe(-1);
    advance(sim, .2, { moveX: 1, brake: true }); expect(sim.snapshot().vehicle.steering).toBeGreaterThan(0);
    stop(sim); const p = sim.player.translation(); advance(sim, .2, { moveX: 1 });
    expect(sim.player.translation().x).toBeLessThan(p.x - .5);
    install(sim, 'skills'); expect(sim.snapshot().systems.driveInputArmed).toBe(false);
    enter(sim); const start = sim.vehicle.translation().z; advance(sim, 1.5, { moveZ: 1 });
    expect(sim.vehicle.translation().z).toBeGreaterThan(start + 2);
  });

  it('missing CYCLES takes priority over swapped skills; restoring only CYCLES keeps W reversed', () => {
    const sim = create(); loadAll(sim); sim.canisters.eject('skills'); sim.canisters.eject('cycles'); advance(sim, 2);
    enter(sim); advance(sim, .4, { moveZ: 1 });
    expect(sim.snapshot().vehicle.throttle).toBe(0); expect(sim.message).toContain('CYCLES DISCONNECTED');
    stop(sim); install(sim, 'cycles'); enter(sim);
    const z = sim.vehicle.translation().z; advance(sim, 1.5, { moveZ: 1 });
    expect(sim.vehicle.translation().z).toBeLessThan(z - 2);
  });

  it('unplugged WINCH preserves passive cable length and holding tension', () => {
    const sim = create('recovery'); placePlayer(sim, 2.6, 41.8); sim.action('winch');
    placePlayer(sim, anchor.x, anchor.z - 2); sim.action('interact');
    advance(sim, 8, { reel: 1 });
    sim.canisters.eject('winch');
    const start = sim.snapshot(); advance(sim, 3, { reel: 1 });
    expect(sim.snapshot().winch.length).toBe(start.winch.length);
    expect(sim.snapshot().winch.tension).toBeGreaterThan(500);
    expect(distance(sim.vehicle.translation(), start.vehicle.position)).toBeLessThan(1);
    sim.action('winch'); expect(sim.snapshot().winch.phase).toBe('stowed');
  });

  it('a careful physical bump crossing keeps cargo; a hard hit releases one module', () => {
    const slow = create(); loadAll(slow); enter(slow); driveUntil(slow, 19, true);
    expect(slow.vehicle.translation().z).toBeGreaterThan(18);
    expect(slow.snapshot().systems.loaded).toBe(3);
    const fast = create(); loadAll(fast); enter(fast); const peak = driveUntil(fast, 36);
    expect(peak).toBeGreaterThan(config.cargo.shockThreshold);
    expect(fast.canisters.isDocked('winch')).toBe(false);
    expect(fast.snapshot().events.filter(e => e.kind === 'eject')).toHaveLength(1);
  });

  it('recovers unreachable items with the same ID, without duplication or automatic installation', () => {
    const sim = create();
    const original = sim.snapshot().canisters.map(c => c.id);
    sim.canisters.items.cycles.body.setTranslation({ x: 100, y: -50, z: 300 }, true);
    sim.step();
    const c = sim.snapshot().canisters.find(c => c.type === 'cycles')!;
    expect(c.phase).toBe('loose'); expect(c.position.z).toBeLessThan(sim.level.maxZ);
    expect(c.position.y).toBeGreaterThan(groundHeight(c.position.x, c.position.z));
    expect(sim.snapshot().canisters.map(c => c.id)).toEqual(original);
    expect(sim.snapshot().systems.engine).toBe(false);
  });

  it('restart creates a clean three-item state and clears event flags', () => {
    const sim = create(); loadAll(sim); sim.canisters.eject('skills');
    const reset = create();
    expect(reset.snapshot().systems.startupCompleted).toBe(false);
    expect(reset.snapshot().progress.ejected).toEqual({ winch: false, skills: false, cycles: false });
    expect(reset.snapshot().canisters.map(c => c.type)).toEqual([...canisterTypes]);
  });

  it('walking crosses the bump slope sideways without snagging on terrain seams', () => {
    const sim = create(); placePlayer(sim, 2.54, 12.99);
    advance(sim, 1, { moveX: -1 });
    expect(sim.player.translation().x).toBeGreaterThan(6);
    expect(sim.player.translation().y).toBeGreaterThanOrEqual(groundHeight(sim.player.translation().x, sim.player.translation().z) + .79);
  });

  it('moving the bus or changing sockets cancels removal; rear access is required', () => {
    const sim = create(); loadAll(sim); atSocket(sim, 'cycles');
    sim.action('interact'); advance(sim, .25, { interact: true });
    sim.vehicle.setLinvel({ x: 0, y: 0, z: 2 }, true); advance(sim, .9, { interact: true });
    expect(sim.canisters.isDocked('cycles')).toBe(true);
    atSocket(sim, 'cycles'); sim.action('interact'); advance(sim, .25, { interact: true });
    atSocket(sim, 'skills'); advance(sim, 1, { interact: true });
    expect(sim.canisters.isDocked('cycles')).toBe(true);
    const pos = add(sim.vehicle.translation(), rotate({ x: 0, y: 0, z: -1.4 }, sim.vehicle.rotation()));
    sim.player.setTranslation(pos, true);
    expect(sim.canisters.interaction(false).kind).toBe('none');
  });

  it('a missing WINCH does not prevent another installed module from shaking loose', () => {
    const sim = create(); loadAll(sim); sim.canisters.eject('winch'); advance(sim, 2); enter(sim);
    driveUntil(sim, 36);
    expect(sim.snapshot().progress.ejected.skills).toBe(true);
    expect(sim.canisters.isDocked('skills')).toBe(false);
    expect(sim.snapshot().systems.driveInputArmed).toBe(false);
  });
});
