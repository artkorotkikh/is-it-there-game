import type { Rotation, Vec3 } from './types';

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec3, b: Vec3) => length(sub(a, b));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
// Camera looks toward +Z at yaw=0. Screen-right is -X, not +X.
export const cameraMovement = (right: number, forward: number, yaw: number): Vec3 => ({
  x: -Math.cos(yaw) * right + Math.sin(yaw) * forward,
  y: 0,
  z: Math.sin(yaw) * right + Math.cos(yaw) * forward,
});
export const rotate = (v: Vec3, q: Rotation): Vec3 => {
  // q * v * inverse(q), for a normalized XYZW quaternion.
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return { x: v.x + q.w * tx + q.y * tz - q.z * ty, y: v.y + q.w * ty + q.z * tx - q.x * tz, z: v.z + q.w * tz + q.x * ty - q.y * tx };
};

export function cableForce(extension: number, separationSpeed: number, stiffness: number, damping: number, cap: number): number {
  // A slack cable cannot exert damping or compression forces.
  return extension > 0 ? clamp(extension * stiffness + separationSpeed * damping, 0, cap) : 0;
}
