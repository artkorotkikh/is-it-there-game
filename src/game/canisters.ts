import RAPIER from '@dimforge/rapier3d-compat';
import { config, moduleDefinitions } from './config';
import { defaultLevel, type Level } from './level';
import { add, clamp, distance, length, rotate, scale, sub } from './math';
import { canisterTypes, type CanisterPhase, type CanisterSnapshot, type CanisterType, type CargoEvent, type Interaction, type Rotation, type Vec3 } from './types';

const identity = { x: 0, y: 0, z: 0, w: 1 };
const zero = { x: 0, y: 0, z: 0 };
type Item = { carrierId: string | null; type: CanisterType; phase: CanisterPhase; body: RAPIER.RigidBody; collider: RAPIER.Collider; impactCooldown: number; dockGrace: number; rattle: number; rattleVelocity: number };
// Rotate the weakest latch so every capability can be lost, without randomness.
const releaseOrder: readonly CanisterType[] = ['winch', 'skills', 'cycles'];

/** One authoritative owner per module. Carried and docked bodies never collide. */
export class Canisters {
  readonly items: Record<CanisterType, Item>;
  readonly events: CargoEvent[] = [];
  startupCompleted: boolean;
  driveInputArmed: boolean;
  message = '';
  private sequence = 0;
  private actorId = 'local-player';
  private actors = new Map<string, { body: RAPIER.RigidBody; holding: CanisterType | null; heldSeconds: number; facing: number }>();
  private get actor() { return this.actors.get(this.actorId)!; }
  private get player() { return this.actor.body; }
  private get holding() { return this.actor.holding; }
  private set holding(value: CanisterType | null) { this.actor.holding=value; }
  private get heldSeconds() { return this.actor.heldSeconds; }
  private set heldSeconds(value: number) { this.actor.heldSeconds=value; }
  private get facing() { return this.actor.facing; }
  private set facing(value: number) { this.actor.facing=value; }
  setPlayer(body: RAPIER.RigidBody, id='local-player', yaw=0) {
    this.actorId=id;
    if(!this.actors.has(id))this.actors.set(id,{body,holding:null,heldSeconds:0,facing:yaw});
    this.actor.facing=yaw;
  }
  private nextLatch = 0;
  private releaseCooldown = 0;
  private impactQuiet = 0;
  private impactReleased = false;
  private rattleCooldown = 0;

  constructor(private world: RAPIER.World, private vehicle: RAPIER.RigidBody, player: RAPIER.RigidBody, loaded: boolean, private level: Level = defaultLevel) {
    this.setPlayer(player);
    this.startupCompleted = loaded;
    this.driveInputArmed = loaded;
    const c = config.cargo;
    this.items = Object.fromEntries(canisterTypes.map(type => {
      const x = moduleDefinitions[type].x * 1.9;
      const z = vehicle.translation().z - 4.5;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, this.level.groundHeight(x, z) + c.halfHeight + 0.03, z)
        .setCcdEnabled(true).setLinearDamping(0.25).setAngularDamping(1.2));
      const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(c.halfWidth, c.halfHeight, c.halfDepth)
        .setMass(c.mass).setFriction(c.friction).setRestitution(c.restitution), body);
      body.setEnabled(!loaded);
      return [type, { carrierId: null, type, phase: loaded ? 'docked' : 'loose', body, collider, impactCooldown: 0, dockGrace: c.dockGrace, rattle: 0, rattleVelocity: 0 }];
    })) as Record<CanisterType, Item>;
  }

  isDocked(type: CanisterType) { return this.items[type].phase === 'docked'; }
  carried() { return canisterTypes.find(type => this.items[type].phase === 'carried' && this.items[type].carrierId === this.actorId) ?? null; }
  loadedCount() { return canisterTypes.filter(type => this.isDocked(type)).length; }
  engineEnabled() { return this.startupCompleted && this.isDocked('cycles'); }
  socket(type: CanisterType) {
    return add(this.vehicle.translation(), rotate({ x: moduleDefinitions[type].x, y: config.cargo.socketY, z: config.cargo.socketZ }, this.vehicle.rotation()));
  }
  private carryPosition(id=this.actorId) { return add(this.actors.get(id)!.body.translation(), rotate({ x: 0, y: config.cargo.carryY, z: config.cargo.carryForward }, this.carryRotation(id))); }
  private carryRotation(id=this.actorId): Rotation { const facing=this.actors.get(id)!.facing; return { x: 0, y: Math.sin(facing / 2), z: 0, w: Math.cos(facing / 2) }; }
  position(type: CanisterType): Vec3 {
    const item = this.items[type];
    return item.phase === 'docked' ? this.socket(type) : item.phase === 'carried' ? this.carryPosition(item.carrierId!) : { ...item.body.translation() };
  }
  private emit(kind: CargoEvent['kind'], type: CanisterType, message = '') {
    this.events.push({ sequence: ++this.sequence, kind, type });
    if (this.events.length > 20) this.events.shift();
    if (message) this.message = message;
  }
  private setPhase(type: CanisterType, phase: CanisterPhase) {
    const wasDocked = this.isDocked(type);
    this.items[type].phase = phase;
    this.items[type].carrierId = phase==='carried'?this.actorId:null;
    this.items[type].body.setEnabled(phase === 'loose');
    this.items[type].rattle = this.items[type].rattleVelocity = 0;
    if (phase === 'docked') this.items[type].dockGrace = config.cargo.dockGrace;
    // Mapping changes in either direction and power restoration require neutral input.
    if (type === 'skills' && wasDocked !== (phase === 'docked') || type === 'cycles' && !wasDocked && phase === 'docked') this.driveInputArmed = false;
    if (!this.startupCompleted && this.loadedCount() === 3) {
      this.startupCompleted = true;
      this.driveInputArmed = false;
      this.emit('ready', type, 'ALL SYSTEMS ONLINE. Get in. Let’s get ICP there.');
    }
  }

  private visible(type: CanisterType) {
    const origin = this.player.translation();
    const delta = sub(this.position(type), origin);
    const len = length(delta);
    if (len < 0.01) return true;
    // Other loose modules and teammates must not hide a handle in a cargo pile.
    // Terrain, the chassis and field-kit supports still block reaching through them.
    const hit = this.world.castRay(new RAPIER.Ray(origin, scale(delta, 1 / len)), len, true, undefined, undefined, undefined, this.player,
      collider => !collider.parent()?.isKinematic() && !canisterTypes.some(other => other !== type && this.items[other].phase === 'loose' && collider.handle === this.items[other].collider.handle));
    return !hit || hit.collider.parent()?.handle === this.items[type].body.handle;
  }

  interaction(cableInHand: boolean, targetType?:CanisterType, skipLoose=false): Interaction {
    const none: Interaction = { kind: 'none', type: null, position: null, prompt: '', hold: 0 };
    const p = this.player.translation();
    const carried = this.carried();
    const q = this.vehicle.rotation();
    const local = rotate(sub(p, this.vehicle.translation()), { x: -q.x, y: -q.y, z: -q.z, w: q.w });
    // All sockets are accessed from the rear opening, never through the chassis.
    const behind = local.z < -config.vehicle.halfLength - 0.1;
    const closest = targetType ?? [...canisterTypes].sort((a, b) => distance(p, this.socket(a)) - distance(p, this.socket(b)))[0];
    const nearSocket = behind && distance(p, this.socket(closest)) < config.cargo.socketReach;
    if (carried) {
      if (nearSocket) {
        const prompt = closest !== carried ? `${moduleDefinitions[closest].label} socket · needs ${moduleDefinitions[closest].label}`
          : length(this.vehicle.linvel()) > config.cargo.stationarySpeed ? 'Stop the bus before loading' : `E · Install ${moduleDefinitions[carried].label}`;
        return { kind: closest === carried && length(this.vehicle.linvel()) <= config.cargo.stationarySpeed ? 'dock' : 'blocked', type: closest, position: this.socket(closest), prompt, hold: 0 };
      }
      return { ...none, kind: 'blocked', prompt: `Carry ${moduleDefinitions[carried].label} to its rear socket · G to set down` };
    }
    const loose = (skipLoose ? [] : canisterTypes).filter(type => (!targetType || type === targetType) && this.items[type].phase === 'loose' && distance(p, this.position(type)) < config.cargo.reach && (targetType || this.visible(type)))
      .sort((a, b) => distance(p, this.position(a)) - distance(p, this.position(b)))[0];
    if (loose) {
      const blocked = cableInHand ? 'Stow or attach the cable first' : !this.visible(loose) ? 'Walk around to reach this canister' : '';
      return { kind: blocked ? 'blocked' : 'pickup', type: loose, position: this.position(loose), prompt: blocked || `E · Pick up ${moduleDefinitions[loose].label}`, hold: 0 };
    }
    if (nearSocket) {
      if (cableInHand) return { ...none, kind: 'blocked', prompt: 'Stow or attach the cable first' };
      if (!this.isDocked(closest)) return { ...none, type: closest, position: this.socket(closest), kind: 'blocked', prompt: `${moduleDefinitions[closest].label} socket · empty` };
      const stopped = length(this.vehicle.linvel()) <= config.cargo.stationarySpeed;
      return { kind: stopped ? 'remove' : 'blocked', type: closest, position: this.socket(closest), prompt: stopped ? `Hold E · Remove ${moduleDefinitions[closest].label}` : 'Stop the bus before removing a module', hold: this.holding === closest ? this.heldSeconds / config.cargo.removeSeconds : 0 };
    }
    return none;
  }

  interact(cableInHand: boolean, targetType?:CanisterType): boolean {
    const target = this.interaction(cableInHand,targetType);
    if (target.kind === 'none') return false;
    const type = target.type;
    if (type && target.kind === 'pickup') {
      this.setPhase(type, 'carried');
      this.emit('pickup', type, `Carrying ${moduleDefinitions[type].label}. Match the rear socket.`);
    } else if (type && target.kind === 'dock') {
      const startupBefore = this.startupCompleted;
      this.setPhase(type, 'docked');
      this.emit('dock', type, startupBefore || !this.startupCompleted ? type === 'skills' ? 'SKILLS RESTORED. Driving licence reinstalled.' : `${moduleDefinitions[type].label} ONLINE.` : 'ALL SYSTEMS ONLINE. Get in. Let’s get ICP there.');
    } else if (type && target.kind === 'remove') {
      this.holding = type; this.heldSeconds = 0;
    } else this.message = target.prompt;
    return true;
  }

  updateHold(held: boolean, cableInHand: boolean, driving: boolean) {
    if (!this.holding) return;
    const target = this.interaction(cableInHand,this.holding);
    if (!held || driving || target.kind !== 'remove' || target.type !== this.holding) { this.cancelHold(); return; }
    this.heldSeconds += config.physics.step;
    if (this.heldSeconds >= config.cargo.removeSeconds) {
      const type = this.holding;
      this.setPhase(type, 'carried');
      this.emit('pickup', type, `${moduleDefinitions[type].label} removed. G to set down.`);
      this.cancelHold();
    }
  }
  cancelHold() { this.holding = null; this.heldSeconds = 0; }

  private freeSpace(position: Vec3, rotation: Rotation, item: Item) {
    const c = config.cargo;
    return !this.world.intersectionWithShape(position, rotation, new RAPIER.Cuboid(c.halfWidth + .03, c.halfHeight + .03, c.halfDepth + .03),
      undefined, undefined, item.collider, this.player);
  }
  drop() {
    const type = this.carried();
    if (!type) return;
    const item = this.items[type];
    const position = this.carryPosition();
    const rotation = this.carryRotation();
    if (!this.freeSpace(position, rotation, item)) { this.message = 'No room to set it down. Take a step back.'; return; }
    item.body.setTranslation(position, true); item.body.setRotation(rotation, true);
    item.body.setLinvel(zero, true); item.body.setAngvel(zero, true);
    this.setPhase(type, 'loose');
    this.emit('drop', type, `${moduleDefinitions[type].label} set down.`);
  }

  /** Releases at the actual socket, preserving point velocity and angular velocity. */
  eject(type: CanisterType) {
    if (!this.isDocked(type)) return false;
    const item = this.items[type];
    const position = this.socket(type);
    const q = this.vehicle.rotation();
    const c = config.cargo;
    item.body.setTranslation(position, true); item.body.setRotation(q, true);
    const kick = rotate({ x: Math.sign(moduleDefinitions[type].x || 1) * c.ejectSide, y: c.ejectLift, z: -c.ejectSpeed }, q);
    item.body.setLinvel(add(this.vehicle.velocityAtPoint(position), kick), true);
    item.body.setAngvel(add(this.vehicle.angvel(), rotate({ x: 1.2, y: .3, z: .6 }, q)), true);
    this.setPhase(type, 'loose');
    this.emit('eject', type, type === 'skills' ? 'DRIVING SKILLS UNLOADED · W ↔ S / A ↔ D. Release all drive controls first.' : `${moduleDefinitions[type].label} OFFLINE. Your module is on the road.`);
    return true;
  }

  /** Actual chassis shocks anywhere on the course; no position or one-shot gates. */
  updateRide(acceleration: number, travelSpeed: number): CanisterType | null {
    const c = config.cargo, dt = config.physics.step;
    this.releaseCooldown = Math.max(0, this.releaseCooldown - dt);
    this.rattleCooldown = Math.max(0, this.rattleCooldown - dt);
    const shock = Math.max(0, acceleration);
    this.impactQuiet = shock < c.impactReset ? this.impactQuiet + dt : 0;
    if (this.impactQuiet >= c.impactQuietSeconds) this.impactReleased = false;
    for (const type of canisterTypes) {
      const item = this.items[type];
      item.dockGrace = Math.max(0, item.dockGrace - dt);
      if (item.phase !== 'docked') continue;
      const response = 1 + moduleDefinitions[type].x * .18;
      item.rattleVelocity += (-clamp(acceleration, -45, 45) * c.rattleGain * response - c.rattleSpring * item.rattle - c.rattleDamping * item.rattleVelocity) * dt;
      item.rattle += item.rattleVelocity * dt;
      if (Math.abs(item.rattle) > c.rattleTravel) {
        item.rattle = clamp(item.rattle, -c.rattleTravel, c.rattleTravel);
        item.rattleVelocity *= -.2;
      }
    }
    const installed = canisterTypes.find(type => this.isDocked(type));
    if (installed && travelSpeed > .5 && shock >= c.rattleThreshold && this.rattleCooldown === 0) {
      this.emit('rattle', installed); this.rattleCooldown = .35;
    }
    if (!this.startupCompleted || travelSpeed < c.minimumBumpSpeed || shock < c.shockThreshold || this.releaseCooldown > 0 || this.impactReleased) return null;
    for (let offset = 0; offset < releaseOrder.length; offset++) {
      const index = (this.nextLatch + offset) % releaseOrder.length, type = releaseOrder[index];
      if (!this.isDocked(type) || this.items[type].dockGrace > 0) continue;
      if (this.eject(type)) {
        this.nextLatch = (index + 1) % releaseOrder.length;
        this.releaseCooldown = c.releaseCooldown;
        this.impactReleased = true;
        return type;
      }
    }
    return null;
  }

  tick(facing: number, previousVertical: Record<CanisterType, number>) {
    this.facing = facing;
    for (const type of canisterTypes) {
      const item = this.items[type];
      if (item.phase !== 'loose') continue;
      item.impactCooldown = Math.max(0, item.impactCooldown - config.physics.step);
      const p = item.body.translation();
      if (!this.level.contains(p.x,p.z) || p.y < this.level.groundHeight(p.x, p.z) - config.cargo.belowGroundLimit) {
        const z = clamp(p.z, this.level.minZ + 3, this.level.maxZ - 3);
        const center=this.level.centerX(z),x=clamp(p.x,center-this.level.track.roadHalfWidth+1,center+this.level.track.roadHalfWidth-1);
        // Deterministic search keeps the same object and only uses collision-free ground.
        let restored = false;
        for (const radius of [0, 1.1, 2.2, 3.3, 4.4]) {
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const next = { x: x + dx * radius, y: 0, z: clamp(z + dz * radius, this.level.minZ + 2, this.level.maxZ - 2) };
            next.y = this.level.groundHeight(next.x, next.z) + config.cargo.halfHeight + .2;
            if (!this.freeSpace(next, identity, item)) continue;
            item.body.setTranslation(next, true); item.body.setRotation(identity, true);
            item.body.setLinvel(zero, true); item.body.setAngvel(zero, true);
            this.emit('rescue', type, `${moduleDefinitions[type].label} returned to safe ground. Pick it up to reconnect.`);
            restored = true; break;
          }
          if (restored) break;
        }
      } else if (previousVertical[type] < -1 && item.body.linvel().y - previousVertical[type] > 1.5 && item.impactCooldown === 0) {
        this.emit('impact', type); item.impactCooldown = .25;
      }
    }
  }

  snapshot(): CanisterSnapshot[] {
    return canisterTypes.map(type => {
      const item = this.items[type];
      const position = this.position(type);
      return { id: moduleDefinitions[type].id, type, phase: item.phase, carrierId: item.carrierId,
        position, rotation: { ...(item.phase === 'docked' ? this.vehicle.rotation() : item.phase === 'carried' ? this.carryRotation(item.carrierId!) : item.body.rotation()) },
        velocity: { ...(item.phase === 'docked' ? this.vehicle.velocityAtPoint(position) : item.phase === 'loose' ? item.body.linvel() : zero) },
        angularVelocity: { ...(item.phase === 'loose' ? item.body.angvel() : zero) }, socket: this.socket(type), rattle: item.rattle };
    });
  }
}
