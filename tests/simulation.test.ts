import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/game/config';
import { cableRoute } from '../src/game/cable';
import { anchor, groundHeight } from '../src/game/level';
import { cableForce, mix } from '../src/game/math';
import { initPhysics, Simulation } from '../src/game/simulation';
import { neutralInput, type InputFrame, type StartMode } from '../src/game/types';
import { loadAll } from './cargo-helpers';

const worlds: Simulation[] = [];
beforeAll(async () => { await initPhysics(); });
afterEach(() => { worlds.splice(0).forEach(world => world.destroy()); });

function create(mode: StartMode = 'road') {
  const sim = new Simulation(mode);
  worlds.push(sim);
  advance(sim, 2);
  return sim;
}
function advance(sim: Simulation, seconds: number, input: Partial<InputFrame> = {}) {
  for (let i = 0; i < seconds * 60; i++) sim.step({ ...neutralInput(), ...input });
}
function walkTo(sim: Simulation, x: number, z: number) {
  for (let i = 0; i < 1000; i++) {
    const pos = sim.snapshot().player.position;
    const dx = x - pos.x;
    const dz = z - pos.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.15) return;
    sim.step({ ...neutralInput(), moveX: -dx / distance, moveZ: dz / distance });
  }
  throw new Error(`Could not walk to ${x},${z}; at ${JSON.stringify(sim.snapshot().player.position)}`);
}
function attach(sim: Simulation) {
  const rv = sim.snapshot().vehicle.position;
  walkTo(sim, rv.x + 2.6, rv.z + 2.8);
  sim.action('winch');
  expect(sim.snapshot().winch.phase).toBe('carried');
  walkTo(sim, anchor.x, anchor.z - 2);
  sim.action('interact');
  expect(sim.snapshot().winch.phase).toBe('attached');
}

describe('local authoritative physics', () => {
  it('parks on its suspension without drifting or falling through the road', () => {
    const sim = create();
    const start = sim.snapshot().vehicle.position;
    advance(sim, 20);
    const state = sim.snapshot();
    expect(state.vehicle.position.y).toBeGreaterThan(4);
    expect(state.vehicle.position.y).toBeLessThan(5);
    expect(Math.abs(state.vehicle.position.z - start.z)).toBeLessThan(0.3);
    expect(state.vehicle.speed).toBeLessThan(0.1);
    expect(state.player.grounded).toBe(true);
  });

  it('enters the RV, drives forward, brakes, reverses, and exits', () => {
    const sim = create();
    loadAll(sim);
    sim.action('interact');
    expect(sim.snapshot().player.driving).toBe(true);
    advance(sim, 2, { moveZ: 1 });
    expect(sim.snapshot().vehicle.position.z).toBeGreaterThan(7);
    advance(sim, 2, { brake: true });
    expect(sim.snapshot().vehicle.speed).toBeLessThan(0.3);
    const z = sim.snapshot().vehicle.position.z;
    advance(sim, 2, { moveZ: -1 });
    expect(sim.snapshot().vehicle.position.z).toBeLessThan(z - 2);
    sim.action('interact');
    expect(sim.snapshot().player.driving).toBe(false);
    advance(sim, 1);
    expect(sim.snapshot().player.grounded).toBe(true);
  });

  it('steers a moving vehicle and lets a walking player jump', () => {
    const sim = create();
    loadAll(sim);
    const y = sim.snapshot().player.position.y;
    sim.action('jump'); advance(sim, 0.2);
    expect(sim.snapshot().player.position.y).toBeGreaterThan(y + 0.5);
    advance(sim, 1.5);
    sim.action('interact');
    advance(sim, 2, { moveZ: 1, moveX: 0.7 });
    expect(sim.snapshot().vehicle.position.x).toBeLessThan(-0.5);
  });

  it('requires proximity for cable pickup and cannot drive while carrying it', () => {
    const sim = create('recovery');
    sim.action('winch');
    expect(sim.snapshot().winch.phase).toBe('stowed');
    walkTo(sim, 2.6, 41.8);
    sim.action('winch');
    expect(sim.snapshot().winch.phase).toBe('carried');
    walkTo(sim, 2.6, 39);
    sim.action('interact');
    expect(sim.snapshot().player.driving).toBe(false);
    sim.action('winch'); // Not at front bumper: cannot stow from anywhere.
    expect(sim.snapshot().winch.phase).toBe('carried');
  });

  it('can drive up the gentler first recovery slope without the winch', () => {
    const sim = create('recovery');
    sim.action('interact');
    advance(sim, 18, { moveZ: 1 });
    expect(sim.snapshot().progress.recovered).toBe(true);
    expect(sim.snapshot().winch.phase).toBe('stowed');
    expect(sim.snapshot().vehicle.position.z).toBeGreaterThan(53);
  });

  it('drives the normal descent into the ditch instead of skipping the recovery gate', () => {
    const sim = create();
    loadAll(sim);
    sim.action('interact');
    for(let i=0;i<1200 && sim.vehicle.translation().z<40;i++) advance(sim,1/60,{moveZ:1});
    expect(sim.snapshot().progress.enteredDitch).toBe(true);
    expect(sim.snapshot().progress.recovered).toBe(false);
  });

  it('carries and attaches the cable, recovers the RV onto the road, and releases it', () => {
    const sim = create('recovery');
    attach(sim);
    advance(sim, 16, { reel: 1 });
    const state = sim.snapshot();
    expect(state.vehicle.position.z).toBeGreaterThan(53);
    expect(state.vehicle.position.y).toBeGreaterThan(4);
    expect(state.progress.recovered).toBe(true);
    expect(state.winch.tension).toBeLessThanOrEqual(config.winch.maxForce);
    expect(Number.isFinite(state.vehicle.rotation.w)).toBe(true);
    sim.action('winch');
    expect(sim.snapshot().winch.phase).toBe('stowed');
    expect(sim.snapshot().winch.tension).toBe(0);
  });

  it('pays cable out and clamps the length at its allowed maximum', () => {
    const sim = create('recovery');
    attach(sim);
    advance(sim, 20, { reel: -1 });
    expect(sim.snapshot().winch.length).toBe(config.winch.maxLength);
    expect(sim.snapshot().winch.tension).toBe(0);
    expect(sim.snapshot().progress.recovered).toBe(false);
  });

  it('attaches without a kick, supports the crest, holds, then resumes recovery', () => {
    const sim = create('recovery');
    attach(sim);
    const start = sim.snapshot();
    expect(start.winch.length - start.winch.span).toBeCloseTo(config.winch.attachSlack, 4);
    advance(sim, 1);
    expect(sim.snapshot().vehicle.speed).toBeLessThan(0.15);
    expect(sim.snapshot().winch.tension).toBe(0);
    let peakSpeed = 0;
    for (let tick = 0; tick < 1200; tick++) {
      // Release Q midway up the slope, let the cable hold, then pull again.
      sim.step({ ...neutralInput(), reel: tick >= 270 && tick < 450 ? 0 : 1 });
      const s = sim.snapshot();
      peakSpeed = Math.max(peakSpeed, s.vehicle.speed);
      const route = cableRoute(s.winch.mount, s.winch.end);
      for (let i = 1; i < route.length; i++) for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const p = mix(route[i - 1], route[i], t);
        expect(p.y).toBeGreaterThanOrEqual(groundHeight(p.x, p.z) + config.winch.groundClearance - 0.001);
      }
      expect(s.winch.tension).toBeLessThanOrEqual(config.winch.maxForce);
      expect(s.winch.span - s.winch.length).toBeLessThan(0.85);
      if (tick === 449) expect(s.vehicle.speed).toBeLessThan(0.3);
    }
    expect(peakSpeed).toBeLessThan(3);
    expect(sim.snapshot().progress.recovered).toBe(true);
  });

  it('stalls at a blocked chassis without winding in invisible cable, then pays out', () => {
    const sim = create('recovery');
    attach(sim);
    // Fix all chassis axes to represent an immovable obstacle reproducibly.
    sim.vehicle.lockTranslations(true, true);
    sim.vehicle.lockRotations(true, true);
    advance(sim, 10, { reel: 1 });
    const stopped = sim.snapshot();
    expect(stopped.winch.tension).toBeGreaterThan(config.winch.maxForce * 0.9);
    advance(sim, 10, { reel: 1 });
    expect(Math.abs(sim.snapshot().winch.length - stopped.winch.length)).toBeLessThan(0.2);
    advance(sim, 2, { reel: -1 });
    expect(sim.snapshot().winch.tension).toBe(0);
    expect(sim.snapshot().winch.length - sim.snapshot().winch.span).toBeGreaterThan(1);
  });

  it('maps D to camera-right and W to camera-forward at rotated headings', () => {
    const sim = create();
    const start = sim.snapshot().player.position;
    advance(sim, 0.2, { moveX: 1 });
    expect(sim.snapshot().player.position.x).toBeLessThan(start.x - 0.6);
    const before = sim.snapshot().player.position;
    advance(sim, 0.2, { moveX: 1, yaw: Math.PI / 2 });
    expect(sim.snapshot().player.position.z).toBeGreaterThan(before.z + 0.6);
  });

  it('keeps a sprinting player above the shoulders and inside all terrain edges', () => {
    const sim = create();
    for (const movement of [{ moveX: -1 }, { moveZ: 1 }, { moveX: 1 }, { moveZ: -1 }]) {
      for (let i = 0; i < 1200; i++) {
        sim.step({ ...neutralInput(), ...movement, sprint: true });
        const p = sim.snapshot().player.position;
        expect(p.y).toBeGreaterThanOrEqual(groundHeight(p.x, p.z) + 0.79);
        expect(Math.abs(p.x-sim.level.centerX(p.z))).toBeLessThan(18);
        expect(p.z).toBeGreaterThan(-24);
        expect(p.z).toBeLessThan(sim.level.maxZ);
      }
    }
  });

  it('exits an overturned vehicle above the terrain without falling underground', () => {
    const sim = create('recovery');
    sim.action('interact');
    sim.vehicle.setRotation({ x: 0, y: 0, z: Math.sin(1.4), w: Math.cos(1.4) }, true);
    sim.action('interact');
    advance(sim, 2);
    const p = sim.snapshot().player.position;
    expect(p.y).toBeGreaterThanOrEqual(groundHeight(p.x, p.z) + 0.79);
  });
});

describe('winch physical constraints', () => {
  it('does not push or damp a slack cable, caps tension, and releases on rapid approach', () => {
    expect(cableForce(-1, 20, 6000, 2800, 28000)).toBe(0);
    expect(cableForce(10, 20, 6000, 2800, 28000)).toBe(28000);
    expect(cableForce(1, -20, 6000, 2800, 28000)).toBe(0);
  });
});
