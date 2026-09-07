import { describe, expect, it } from 'vitest';
import { cableRoute, cableShape, pathLength } from '../src/game/cable';
import { config } from '../src/game/config';
import { Level } from '../src/game/level';
import { tracks } from '../src/game/tracks';
const level=new Level(tracks[1]),anchor=level.anchor;
const groundHeight=(x:number,z:number)=>level.groundHeight(x,z);
import { distance, mix } from '../src/game/math';
import type { Vec3 } from '../src/game/types';

function expectAboveGround(points: Vec3[]) {
  for (let i = 1; i < points.length; i++) for (let j = 0; j <= 20; j++) {
    const p = mix(points[i - 1], points[i], j / 20);
    expect(p.y - groundHeight(p.x, p.z)).toBeGreaterThanOrEqual(config.winch.groundClearance - 1e-6);
  }
}

describe('terrain-supported cable', () => {
  const mount = { x: 0, y: groundHeight(0,52)+1, z: 52 };

  it('routes both pull and drawing over the crest instead of through the slope', () => {
    const route = cableRoute(mount, anchor, level);
    expectAboveGround(route);
    expect(route[0]).toEqual(mount);
    expect(route.at(-1)).toEqual(anchor);
    expect(pathLength(route)).toBeGreaterThan(distance(mount, anchor) + 0.25);
    expect(route.some(p => p.z === 61)).toBe(true);
    expect(cableRoute(anchor, mount, level).reverse()).toEqual(route);
  });

  it('keeps paid-out slack above the road, preserves endpoints and shows the extra length', () => {
    const shortest = pathLength(cableRoute(mount, anchor, level));
    for (const extra of [0, 0.3, 2, 8, 32 - shortest]) {
      const shape = cableShape(mount, anchor, shortest + extra, level);
      expectAboveGround(shape);
      expect(shape[0]).toEqual(mount);
      expect(shape.at(-1)).toEqual(anchor);
      expect(pathLength(shape)).toBeCloseTo(shortest + extra, 1);
    }
    expect(cableShape(mount, anchor, shortest + 2, level).some(p => Math.abs(p.x - (p.z - mount.z) / (anchor.z - mount.z) * anchor.x) > 0.1)).toBe(true);
  });

  it('supports cables crossing the shoulders and a vertical hanging cable', () => {
    const a = { x: -15, y: groundHeight(-15, 46) + 1, z: 46 };
    const b = { x: 12, y: groundHeight(12, 60) + 1, z: 60 };
    expectAboveGround(cableRoute(a, b, level));
    expectAboveGround(cableShape(a, b, pathLength(cableRoute(a, b, level)) + 2, level));
    const vertical = cableShape({ x: 0, y: 6, z: 0 }, { x: 0, y: 4, z: 0 }, 2);
    expect(pathLength(vertical)).toBe(2);
    const looseVertical = cableShape({ x: 0, y: 6, z: 0 }, { x: 0, y: 4, z: 0 }, 6);
    expectAboveGround(looseVertical);
    expect(pathLength(looseVertical)).toBeCloseTo(6, 1);
  });
});
