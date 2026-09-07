import { config } from './config';
import { defaultLevel, type Level } from './level';
import { distance, mix } from './math';
import type { Vec3 } from './types';

export const pathLength = (points: Vec3[]) => points.reduce((sum, point, i) => sum + (i ? distance(points[i - 1], point) : 0), 0);

/** Shortest taut path in the vertical plane between the fairlead and hook.
 * The upper hull includes every terrain slope change, so neither physics nor
 * rendering can shortcut through a crest. It is a sliding, frictionless cable;
 * lateral wrapping around arbitrary obstacles is outside this prototype.
 */
export function cableRoute(start: Vec3, end: Vec3, level: Level = defaultLevel): Vec3[] {
  const breaks = [0, 1, ...level.gridBreaks(start,end)];
  const dz = end.z - start.z;
  const dx = end.x - start.x;
  if (Math.abs(dz) > 1e-6) for (const z of level.rows) breaks.push((z - start.z) / dz);
  const segments=[...new Set(breaks.filter(t=>t>=0&&t<=1))].sort((a,b)=>a-b);
  // Every road/shoulder intersection must be included, including a winding
  // edge crossed by a cable whose world X remains constant.
  for(let i=1;!level.track.map && i<segments.length;i++) {
    const a=segments[i-1],b=segments[i];
    const xa=start.x+dx*a-level.centerX(start.z+dz*a), xb=start.x+dx*b-level.centerX(start.z+dz*b);
    if(Math.abs(xb-xa)<1e-8)continue;
    for(const edge of [-level.track.roadHalfWidth,level.track.roadHalfWidth]) {const t=(edge-xa)/(xb-xa);if(t>0&&t<1)breaks.push(a+t*(b-a));}
  }
  const ts = [...new Set(breaks.filter(t => t >= 0 && t <= 1))].sort((a, b) => a - b);
  const hull: { t: number; p: Vec3 }[] = [];
  for (const t of ts) {
    const p = mix(start, end, t);
    if (t > 0 && t < 1) p.y = level.groundHeight(p.x, p.z) + config.winch.groundClearance;
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      // Keep descending slopes (upper convex hull), including exact endpoints.
      if ((b.p.y - a.p.y) * (t - b.t) > (p.y - b.p.y) * (b.t - a.t) + 1e-10) break;
      hull.pop();
    }
    hull.push({ t, p });
  }
  return hull.map(node => node.p);
}

/** Quasi-static visual slack: hanging sections sag, excess on the ground forms
 * loose bends. Solve for paid-out length; this is not an extra physics world.
 * The authoritative pulling direction always comes from cableRoute instead.
 */
export function cableShape(start: Vec3, end: Vec3, paidOut: number, level: Level = defaultLevel): Vec3[] {
  const route = cableRoute(start, end, level);
  const shortest = pathLength(route);
  if (paidOut <= shortest + 0.005 || shortest < 0.01) return route;
  const samples: { p: Vec3; t: number }[] = [];
  let traversed = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const span = distance(a, b);
    const count = Math.max(1, Math.ceil(span / config.winch.visualSegmentLength), Math.ceil(span / shortest * 16));
    for (let j = 0; j < count; j++) samples.push({ p: mix(a, b, j / count), t: (traversed + span * j / count) / shortest });
    traversed += span;
  }
  samples.push({ p: end, t: 1 });
  const horizontal = Math.hypot(end.x - start.x, end.z - start.z);
  const right = horizontal > 0.001 ? { x: (end.z - start.z) / horizontal, z: -(end.x - start.x) / horizontal } : { x: 1, z: 0 };
  const shape = (sag: number) => samples.map(({ p, t }, i) => {
    if (i === 0 || i === samples.length - 1) return { ...p };
    const y = p.y - 4 * sag * t * (1 - t);
    const floor = level.groundHeight(p.x, p.z) + config.winch.groundClearance;
    const bend = Math.max(0, floor - y) * 0.45 * Math.sin(t * Math.PI * 6);
    const x = p.x + right.x * bend;
    const z = p.z + right.z * bend;
    return { x, y: Math.max(y, level.groundHeight(x, z) + config.winch.groundClearance), z };
  });
  let lo = 0;
  let hi: number = config.winch.maxLength;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (pathLength(shape(mid)) < paidOut) lo = mid; else hi = mid;
  }
  const loose = shape((lo + hi) / 2);
  // Bends may cross a terrain break laterally. Insert its support point as well.
  return loose.flatMap((p, i) => i ? cableRoute(loose[i - 1], p, level).slice(1) : [p]);
}
