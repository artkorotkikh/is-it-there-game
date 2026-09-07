export type Vec3 = { x: number; y: number; z: number };
export type Rotation = { x: number; y: number; z: number; w: number };
export type StartMode = 'road' | 'recovery';
export type Action = 'interact' | 'winch' | 'jump' | 'drop' | 'park' | 'ping' | 'cycleTarget';
export type WinchPhase = 'stowed' | 'carried' | 'attached';
export const canisterTypes = ['winch', 'cycles', 'skills'] as const;
export type CanisterType = typeof canisterTypes[number];
export type CanisterPhase = 'loose' | 'carried' | 'docked';
export interface CanisterSnapshot {
  id: string; type: CanisterType; phase: CanisterPhase; carrierId: string | null;
  position: Vec3; rotation: Rotation; velocity: Vec3; angularVelocity: Vec3; socket: Vec3;
  rattle: number; // Local vertical socket displacement in metres, presentation only.
}
export interface CargoEvent { sequence: number; kind: 'pickup' | 'dock' | 'drop' | 'eject' | 'rescue' | 'impact' | 'rattle' | 'ready'; type: CanisterType }
export interface Interaction {
  kind: 'pickup' | 'dock' | 'remove' | 'blocked' | 'none' | 'enter' | 'right' | 'attach';
  type: CanisterType | null; position: Vec3 | null; prompt: string; hold: number;
  target?: { id:string; label:string; index:number; total:number };
}

export interface InputFrame {
  push?: boolean;
  moveX: number;
  moveZ: number;
  yaw: number;
  sprint: boolean;
  brake: boolean;
  reel: number; // -1 pays out, +1 reels in.
  interact: boolean; // Held E; removal is deliberately slower than a tap.
}

export const neutralInput = (): InputFrame => ({
  moveX: 0, moveZ: 0, yaw: 0, sprint: false, brake: false, reel: 0, interact: false,
});

export interface Snapshot {
  players?: PlayerSnapshot[];
  fieldKit?: import('./field-kit').FieldKitSnapshot;
  trackId: import('./tracks').TrackId;
  tick: number;
  player: PlayerSnapshot;
  vehicle: { position: Vec3; rotation: Rotation; velocity: Vec3; speed: number; steering: number; parkingBrake: boolean; throttle: number; shock: number; wheels: { suspension: number; rotation: number }[] };
  canisters: CanisterSnapshot[];
  systems: { startupCompleted: boolean; driveInputArmed: boolean; engine: boolean; winch: boolean; skills: 'normal' | 'swapped'; loaded: number; doorOpen: boolean };
  interaction: Interaction;
  recovery: { available:boolean; charge:number; cooldown:number; kicks:number; animation:number };
  events: CargoEvent[];
  winch: { phase: WinchPhase; length: number; span: number; tension: number; mount: Vec3; end: Vec3; carrierId?:string|null; operatorId?:string|null };
  progress: { enteredDitch: boolean; recovered: boolean; finished: boolean; elapsed: number; ejected: Record<CanisterType, boolean> };
}
export interface PlayerSnapshot { id?:string; position:Vec3; yaw:number; driving:boolean; grounded:boolean; passenger?:boolean }
