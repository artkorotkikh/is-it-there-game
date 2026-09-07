import { clamp } from './math';
import type { Action, InputFrame } from './types';

/** Keyboard and independent touch pointers feed the same simulation input. */
export class Input {
  private keys = new Set<string>();
  private touches = new Map<number, string>();
  private stick = { x: 0, z: 0 };
  private cameraPointer: number | null = null;
  private cameraType = 'mouse';
  private cameraX = 0;
  private cameraY = 0;
  yaw = 0;
  pitch = 0.35;
  onAction: (action: Action) => void = () => {};
  onPause: () => void = () => {};
  onDebug: () => void = () => {};
  onClear: () => void = () => {};
  active = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', event => {
      if (event.code === 'Backquote') { if (!event.repeat) this.onDebug(); return; }
      if (!this.active) return;
      if (event.code === 'Escape') { if (!event.repeat) this.onPause(); return; }
      if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) return;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) event.preventDefault();
      const held = this.held(event.code);
      this.keys.add(event.code);
      if (!event.repeat && !held) this.action(event.code);
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('resize', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    canvas.addEventListener('pointerdown', event => {
      if (!this.active || event.button !== 0 || this.cameraPointer !== null) return;
      this.cameraPointer = event.pointerId; this.cameraType = event.pointerType;
      this.cameraX = event.clientX; this.cameraY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    window.addEventListener('pointermove', event => {
      if (!this.active) return;
      const locked = document.pointerLockElement === canvas;
      if (!locked && event.pointerId !== this.cameraPointer) return;
      const dx = locked ? event.movementX : event.clientX - this.cameraX;
      const dy = locked ? event.movementY : event.clientY - this.cameraY;
      this.cameraX = event.clientX; this.cameraY = event.clientY;
      this.yaw -= dx * .004;
      this.pitch = clamp(this.pitch + dy * .003, .1, 1.15);
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId === this.cameraPointer) this.cameraPointer = null;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
    canvas.addEventListener('dblclick', () => {
      if (this.active && this.cameraType === 'mouse') void canvas.requestPointerLock?.()?.catch(() => {});
    });
  }

  private held(code: string) { return this.keys.has(code) || [...this.touches.values()].includes(code); }
  private action(code: string) {
    const actions: Record<string, Action> = { KeyE:'interact', KeyF:'winch', KeyG:'drop', KeyP:'park', Space:'jump', KeyT:'ping', KeyX:'cycleTarget' };
    if (actions[code]) this.onAction(actions[code]);
  }
  touchDown(id: number, code: string) {
    if (!this.active) return;
    const held = this.held(code);
    this.touches.set(id, code);
    if (!held) this.action(code);
  }
  touchUp(id: number) { this.touches.delete(id); }
  setStick(x: number, z: number) { if (this.active) this.stick = { x: clamp(x,-1,1), z: clamp(z,-1,1) }; }
  frame(): InputFrame {
    const k = (code: string) => this.held(code) ? 1 : 0;
    return {
      moveX: clamp(k('KeyD') - k('KeyA') + this.stick.x,-1,1), moveZ: clamp(k('KeyW') - k('KeyS') + this.stick.z,-1,1), yaw: this.yaw,
      sprint: this.held('ShiftLeft') || this.held('ShiftRight'), brake: this.held('Space'), reel: k('KeyQ') - k('KeyR'), interact: this.held('KeyE'), push:this.held('KeyB'),
    };
  }
  clear() {
    this.keys.clear(); this.touches.clear(); this.stick = {x:0,z:0}; this.cameraPointer = null; this.onClear();
  }
}
