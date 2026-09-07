import { beforeAll, afterEach, expect, it } from 'vitest';
import { initPhysics, Simulation } from '../src/game/simulation';
import { CargoLossNotice, cargoLossSeconds } from '../src/ui/cargo-loss';

const worlds: Simulation[] = [];
beforeAll(initPhysics);
afterEach(() => worlds.splice(0).forEach(sim => sim.destroy()));
function create() { const sim = new Simulation('recovery'); worlds.push(sim); return sim; }

it('initial loose cargo, pickup and manual set-down do not announce an ejection', () => {
  const snapshot = create().snapshot(), notice = new CargoLossNotice();
  for (const item of snapshot.canisters) item.phase = 'loose';
  snapshot.events = ['pickup', 'drop', 'ready', 'rattle'].map((kind, i) => ({ sequence: i + 1, kind: kind as 'pickup' | 'drop' | 'ready' | 'rattle', type: 'winch' }));
  notice.advance(snapshot, 1);
  expect(notice.event).toBeNull();
});

it('consumes a real ejection once; retained events cannot keep the notice alive', () => {
  const sim = create(), notice = new CargoLossNotice();
  sim.canisters.eject('winch'); notice.advance(sim.snapshot(), 1 / 60);
  expect(notice.event?.type).toBe('winch');
  notice.advance(sim.snapshot(), 2.99);
  expect(notice.event?.type).toBe('winch');
  notice.advance(sim.snapshot(), .02);
  expect(notice.event).toBeNull();
  notice.advance(sim.snapshot(), 1 / 60);
  expect(notice.event).toBeNull();
});

it('fades and zooms in, holds, then fades and zooms out within three seconds', () => {
  const sim = create(), notice = new CargoLossNotice();
  sim.canisters.eject('winch'); notice.advance(sim.snapshot(), 0);
  expect(notice.appearance).toEqual({ opacity: 0, scale: .94 });
  notice.advance(sim.snapshot(), .11);
  expect(notice.appearance.opacity).toBeGreaterThan(0); expect(notice.appearance.opacity).toBeLessThan(1);
  expect(notice.appearance.scale).toBeGreaterThan(.94); expect(notice.appearance.scale).toBeLessThan(1);
  notice.advance(sim.snapshot(), .89);
  expect(notice.appearance).toEqual({ opacity: 1, scale: 1 });
  notice.advance(sim.snapshot(), 1.86);
  expect(notice.appearance.opacity).toBeCloseTo(.25);
  expect(notice.appearance.scale).toBeGreaterThan(1);
  notice.advance(sim.snapshot(), .14);
  expect(notice.event).toBeNull();
});

it('a new loss immediately replaces an older one and receives the full reading time', () => {
  const sim = create(), notice = new CargoLossNotice();
  sim.canisters.eject('cycles'); notice.advance(sim.snapshot(), 0);
  notice.advance(sim.snapshot(), 1);
  sim.canisters.eject('skills'); notice.advance(sim.snapshot(), 1 / 60);
  expect(notice.event?.type).toBe('skills');
  expect(notice.remaining).toBe(cargoLossSeconds);
  expect(sim.snapshot().systems.engine).toBe(false); // Existing power priority must not hide SKILLS.
});

it('reinstallation dismisses stale loss and a repeat ejection is announced', () => {
  const sim = create(), notice = new CargoLossNotice();
  sim.canisters.eject('winch'); notice.advance(sim.snapshot(), 0);
  const restored = sim.snapshot(); restored.canisters.find(item => item.type === 'winch')!.phase = 'docked';
  notice.advance(restored, 1 / 60); expect(notice.event).toBeNull();
  // Presentation fixture for a later ejection of the same physical item ID.
  const repeated = sim.snapshot(); repeated.events.push({ sequence: 2, kind: 'eject', type: 'winch' });
  notice.advance(repeated, 1 / 60);
  expect(notice.event?.sequence).toBe(2); expect(notice.remaining).toBe(cargoLossSeconds);
});

it('no simulation time means no expiration; reset accepts a fresh event sequence', () => {
  const sim = create(), notice = new CargoLossNotice();
  sim.canisters.eject('winch'); notice.advance(sim.snapshot(), 0);
  notice.advance(sim.snapshot(), 0); expect(notice.remaining).toBe(cargoLossSeconds);
  notice.reset(); expect(notice.event).toBeNull();
  const fresh = create(); fresh.canisters.eject('cycles'); notice.advance(fresh.snapshot(), 0);
  expect(notice.event?.type).toBe('cycles'); expect(notice.event?.sequence).toBe(1);
});
