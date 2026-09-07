import RAPIER from '@dimforge/rapier3d-compat';
import { Canisters } from './canisters';
import { FieldKit, yawRotation } from './field-kit';
import { config, moduleDefinitions } from './config';
import { cableRoute, pathLength } from './cable';
import { Level } from './level';
import { tracks, type Track } from './tracks';
import { add, cableForce, cameraMovement, clamp, distance, dot, length, rotate, scale, sub } from './math';
import { canisterTypes, neutralInput, type Action, type CanisterType, type InputFrame, type Interaction, type Snapshot, type StartMode, type Vec3, type WinchPhase } from './types';

let initialization: Promise<void> | undefined;
export const initPhysics = () => initialization ??= RAPIER.init();

interface PlayerState { id:string; body:RAPIER.RigidBody; collider:RAPIER.Collider; character:RAPIER.KinematicCharacterController; yaw:number; grounded:boolean; verticalSpeed:number; passenger:boolean; focus:string|null }
interface InteractionCandidate extends Interaction { id:string; label:string; priority:number }

/** Authoritative, DOM-free state. Call step only with the fixed timestep. */
export class Simulation {
  readonly world: RAPIER.World;
  readonly vehicle: RAPIER.RigidBody;
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  private players=new Map<string,PlayerState>();
  private activeId='local-player';
  private driverId:string|null=null;
  private cableCarrier:string|null=null;
  private cableOperator:string|null=null;
  private rightOwner='local-player';
  private get actor() { return this.players.get(this.activeId)!; }
  get player() { return this.actor.body; }
  get playerCollider() { return this.actor.collider; }
  private get character() { return this.actor.character; }
  private get driving() { return this.driverId===this.activeId; }
  private set driving(on:boolean) { if(on){this.driverId=this.activeId;if(this.players.size>1)this.canisters.driveInputArmed=false;}else if(this.driverId===this.activeId)this.driverId=null; }
  private get seated() { return this.driving||this.actor.passenger; }
  private get grounded() { return this.actor.grounded; }
  private set grounded(value:boolean) { this.actor.grounded=value; }
  private get playerYaw() { return this.actor.yaw; }
  private set playerYaw(value:number) { this.actor.yaw=value; }
  private get verticalSpeed() { return this.actor.verticalSpeed; }
  private set verticalSpeed(value:number) { this.actor.verticalSpeed=value; }
  private get carryingCable() { return this.phase==='carried'&&this.cableCarrier===this.activeId; }
  private selectPlayer(id:string) { this.activeId=id;this.canisters?.setPlayer(this.player,id,this.playerYaw); }
  private asPlayer<T>(id:string,fn:()=>T):T { if(!this.players.has(id))throw new Error('Unknown player');const old=this.activeId;this.selectPlayer(id);try{return fn();}finally{this.selectPlayer(old);} }
  readonly canisters: Canisters;
  readonly fieldKit: FieldKit | undefined;
  private tick = 0;
  private elapsed = 0;
  private steering = 0;
  private phase: WinchPhase = 'stowed';
  private cableLength: number = config.winch.maxLength;
  private tension = 0;
  private enteredDitch = false;
  private recovered = false;
  private finished = false;
  private parkingBrake = false;
  private throttle = 0;
  private shock = 0;
  private attachedTree = 'recovery-tree';
  private rightHolding = false;
  private rightCharge = 0;
  private rightCooldown = 0;
  private rightAssist = 0;
  private kicks = 0;
  private kickAnimation = 0;
  private ejected = { winch: false, skills: false, cycles: false };
  private lastCargoMessage = '';
  message = '';

  readonly level: Level;

  constructor(mode: StartMode = 'road', track: Track = tracks[0]) {
    this.level = new Level(track);
    this.world = new RAPIER.World({ x: 0, y: config.physics.gravity, z: 0 });
    this.world.timestep = config.physics.step;
    const terrain = this.level.terrainMesh();
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(terrain.positions), new Uint32Array(terrain.indices)).setFriction(1.1));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(180, 1, 200).setTranslation(0, -10, 40));
    // The marked tree is a real obstacle; distant scenery is decorative.
    for(const anchor of this.level.anchors) this.world.createCollider(RAPIER.ColliderDesc.cylinder(3, .5).setTranslation(anchor.x, anchor.y+1.9, anchor.z));

    for (const obstacle of track.obstacles) {
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(obstacle.width/2, obstacle.height/2, obstacle.depth/2)
        .setTranslation(this.level.centerX(obstacle.z)+obstacle.x, this.level.roadHeight(obstacle.z)+obstacle.height/2, obstacle.z).setFriction(.7));
    }
    if(!track.map) {
      const rock = this.level.rolloverRockMesh();
      this.world.createCollider(RAPIER.ColliderDesc.convexMesh(new Float32Array(rock.positions), new Uint32Array(rock.indices))!.setFriction(config.rolloverRock.friction));
    }
    for(const obstacle of track.map?.obstacles??[])this.world.createCollider(RAPIER.ColliderDesc.cuboid(obstacle.width/2,obstacle.height/2,obstacle.depth/2)
      .setTranslation(obstacle.x,this.level.groundHeight(obstacle.x,obstacle.z)+obstacle.height/2,obstacle.z).setRotation(yawRotation(obstacle.yaw)).setFriction(.9));
    const z = track.map?.spawn.vehicle.z ?? (mode === 'recovery' ? track.recoverySpawnZ : 3);
    const x = track.map?.spawn.vehicle.x ?? 0;
    this.vehicle = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      // The raycast controller updates velocities directly each tick. Sleeping
      // would leave those velocities unapplied and accumulate suspension impulses.
      .setTranslation(x, this.level.groundHeight(x,z) + 1.45, z).setRotation(yawRotation(track.map?.spawn.vehicle.yaw??0)).setLinearDamping(0.12).setAngularDamping(0.5).setCcdEnabled(true).setCanSleep(false));
    const c = config.vehicle;
    // Hollow rear bay. Preserve the former chassis mass, COM and inertia so
    // opening the compartment does not retune the suspension or winch.
    this.vehicle.setAdditionalMassProperties(c.mass, { x: 0, y: 0, z: 0 }, {
      x: c.mass / 3 * (c.halfHeight ** 2 + c.halfLength ** 2),
      y: c.mass / 3 * (c.halfWidth ** 2 + c.halfLength ** 2),
      z: c.mass / 3 * (c.halfWidth ** 2 + c.halfHeight ** 2),
    }, { x: 0, y: 0, z: 0, w: 1 }, true);
    for (const [hx, hy, hz, x, y, bz] of [
      [1.08, .75, 1.925, 0, 0, .425],
      [.06, .75, .425, -1.02, 0, -1.925], [.06, .75, .425, 1.02, 0, -1.925],
      [1.08, .1, .425, 0, -.65, -1.925], [1.08, .07, .425, 0, .68, -1.925],
    ]) this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, bz).setDensity(0).setFriction(.5), this.vehicle);
    this.controller = this.world.createVehicleController(this.vehicle);
    this.controller.indexUpAxis = 1;
    this.controller.setIndexForwardAxis = 2;
    for (const wz of [c.wheelZ, -c.wheelZ]) {
      for (const wx of [-c.wheelX, c.wheelX]) {
        const i = this.controller.numWheels();
        this.controller.addWheel({ x: wx, y: c.wheelY, z: wz }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, c.suspension, c.wheelRadius);
        this.controller.setWheelSuspensionStiffness(i, c.suspensionStiffness);
        this.controller.setWheelSuspensionCompression(i, c.suspensionCompression);
        this.controller.setWheelSuspensionRelaxation(i, c.suspensionRelaxation);
        this.controller.setWheelMaxSuspensionForce(i, c.maxSuspensionForce);
        this.controller.setWheelMaxSuspensionTravel(i, 0.25);
        this.controller.setWheelFrictionSlip(i, 2.4);
        this.controller.setWheelSideFrictionStiffness(i, 1.4);
      }
    }
    const start=track.map?.spawn.players[0];
    this.createPlayer('local-player',start?.x??3.1,start?.z??(mode==='road'?z-5:z),start?.yaw??0);
    this.canisters = new Canisters(this.world, this.vehicle, this.player, mode === 'recovery'||Boolean(track.map), this.level);
    this.fieldKit = track.map ? new FieldKit(this.world,this.level,this.vehicle) : undefined;
    this.attachedTree=this.level.anchors[0].id;
    this.enteredDitch = mode === 'recovery';
  }

  private createPlayer(id:string,x:number,z:number,yaw:number) {
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,this.level.groundHeight(x,z)+1,z));
    const collider=this.world.createCollider(RAPIER.ColliderDesc.capsule(config.player.halfHeight,config.player.radius),body);
    const character=this.world.createCharacterController(.02);character.enableAutostep(.35,.2,false);character.enableSnapToGround(.25);character.setMaxSlopeClimbAngle(Math.PI/3);character.setMinSlopeSlideAngle(Math.PI/3);
    this.players.set(id,{id,body,collider,character,yaw,grounded:false,verticalSpeed:0,passenger:false,focus:null});
  }
  addPlayer(id='guest-player') {
    if(!this.level.track.map||this.players.size>=2||this.players.has(id))throw new Error('This expedition supports exactly two players');
    const spawn=this.level.track.map.spawn.players[1];this.createPlayer(id,spawn.x,spawn.z,spawn.yaw);
    this.asPlayer(id,()=>{});
  }
  action(action:Action,playerId='local-player',targetId?:string) { this.asPlayer(playerId,()=>this.playerAction(action,targetId)); }

  /** One candidate list drives the prompt, outline, cycle action and host validation. */
  private interactionCandidates():InteractionCandidate[] {
    if(this.seated || this.fieldKit?.carried(this.activeId))return [];
    const p=this.player.translation(),items:InteractionCandidate[]=[];
    const addTarget=(id:string,label:string,priority:number,interaction:Interaction)=>items.push({...interaction,id,label,priority:interaction.kind==='blocked'?10:priority});
    if(!this.canisters.carried())for(const type of canisterTypes) {
      if(this.canisters.items[type].phase!=='loose'||distance(p,this.canisters.position(type))>=config.cargo.reach)continue;
      addTarget(`cargo:${type}`,moduleDefinitions[type].label,0,this.canisters.interaction(this.carryingCable,type));
    }
    const cargo=this.canisters.interaction(this.carryingCable,undefined,true);
    if(cargo.type&&cargo.position)addTarget(`socket:${cargo.type}`,`${moduleDefinitions[cargo.type].label} socket`,3,cargo);
    if(this.canisters.carried())return items;
    if(!this.carryingCable)for(const item of this.fieldKit?.targets(p)??[])
      addTarget(`resource:${item.id}`,item.kind==='plank'?'Plank':'Stone',1,{kind:item.reason?'blocked':'pickup',type:null,position:item.position,prompt:item.reason||`E · Pick up ${item.kind}`,hold:0});
    if(this.canRight())addTarget('bus:right','Right the bus',2,{kind:'right',type:null,position:{...this.vehicle.translation()},prompt:'Hold E · Kick the bus upright',hold:this.rightCharge/config.recovery.holdSeconds});
    const tree=this.carryingCable?this.nearTree():undefined;
    if(tree)addTarget(`tree:${tree.id}`,'Winch tree',0,{kind:'attach',type:null,position:{...tree},prompt:'E · Attach cable to tree',hold:0});
    if(distance(p,this.vehicle.translation())<config.player.interactionDistance)
      addTarget('bus:enter',this.driverId?'Passenger seat':'Driver seat',4,{kind:this.carryingCable?'blocked':'enter',type:null,position:{...this.vehicle.translation()},prompt:this.carryingCable?'Attach or stow the cable before driving.':'E · Get in · Hold B to push',hold:0});
    return items.sort((a,b)=>a.priority-b.priority||distance(p,a.position!)-distance(p,b.position!)||a.id.localeCompare(b.id));
  }

  private selectedInteraction():Interaction {
    const candidates=this.interactionCandidates();
    let index=candidates.findIndex(item=>item.id===this.actor.focus);
    if(index<0){this.actor.focus=null;index=0;}
    const item=candidates[index];
    if(!item)return {kind:'none',type:null,position:null,prompt:'',hold:0};
    const {id,label,priority:_,...interaction}=item;
    return {...interaction,target:{id,label,index:index+1,total:candidates.length}};
  }

  private expeditionInteract(targetId?:string) {
    const candidates=this.interactionCandidates(),id=targetId??this.selectedInteraction().target?.id;
    const target=candidates.find(item=>item.id===id);
    if(!target){this.message=targetId?'That target is no longer available. Choose another.':this.canisters.interaction(this.carryingCable).prompt||'Move closer to an item or the bus.';return;}
    this.actor.focus=target.id;
    if(target.kind==='blocked'){this.message=target.prompt;return;}
    if(target.id.startsWith('resource:')) {
      this.fieldKit!.pickup(this.player.translation(),this.activeId,target.id.slice(9));this.message=this.fieldKit!.message;
    } else if(target.type) {this.canisters.interact(this.carryingCable,target.type);this.cargoNotice();}
    else if(target.kind==='right'){this.rightOwner=this.activeId;this.rightHolding=true;this.rightCharge=0;}
    else if(target.kind==='attach')this.attachCable();
    else if(target.kind==='enter'){
      if(this.driverId)this.actor.passenger=true;else this.driving=true;
      this.playerCollider.setEnabled(false);this.message='Easy on the throttle. It has seen better days.';
    }
    if(target.kind!=='remove'&&target.kind!=='right')this.actor.focus=null;
  }

  private attachCable() {
    const anchor=this.nearTree()!;
    const required=pathLength(cableRoute(this.mount(),anchor,this.level));
    if(required>config.winch.maxLength){this.message='Not enough cable over the slope. Bring the RV closer.';return;}
    this.phase='attached';this.cableCarrier=null;this.cableOperator=this.activeId;this.attachedTree=anchor.id;
    this.cableLength=clamp(required+config.winch.attachSlack,config.winch.minLength,config.winch.maxLength);
    this.message='Cable attached. Hold Q to pull. R gives it slack.';
  }

  private playerAction(action: Action,targetId?:string) {

    if (this.finished) return;
    if(action==='cycleTarget'){
      if(!this.fieldKit)return;
      const current=this.selectedInteraction(),candidates=this.interactionCandidates();
      if(candidates.length>1){this.actor.focus=candidates[(current.target!.index)%candidates.length].id;this.canisters.cancelHold();if(this.rightOwner===this.activeId){this.rightHolding=false;this.rightCharge=0;}this.message='';}
      return;
    }
    if(action==='ping'){this.fieldKit?.mark(this.player.translation(),this.playerYaw);return;}
    if (action === 'park') {
      if(this.players.size>1&&!this.driving&&distance(this.player.translation(),this.vehicle.translation())>config.player.interactionDistance){this.message='Walk to the bus to use its parking brake.';return;}
      this.parkingBrake = !this.parkingBrake;
      this.message = this.parkingBrake ? 'Parking brake ON. Safe to collect cargo. P to release.' : 'Parking brake released.';
      return;
    }
    if (action === 'drop') { if (!this.seated) {if(this.fieldKit?.carried(this.activeId)){this.fieldKit.place(this.player.translation(),this.playerYaw,this.activeId);this.message=this.fieldKit.message;return;}this.canisters.drop();} this.cargoNotice(); return; }
    if (action === 'jump') {
      if (!this.seated && this.grounded) this.verticalSpeed = config.player.jumpSpeed;
      return;
    }
    const player = this.player.translation();
    if (action === 'interact') {
      if(targetId&&(this.seated||this.fieldKit?.carried(this.activeId))){this.message='That target is no longer available. Choose another.';return;}
      if (this.seated) {
        const exit = this.exitPosition();
        if (!exit) { this.message = 'No clear place to get out. Move the bus a little.'; return; }
        this.player.setTranslation(exit, true);
        this.player.setNextKinematicTranslation(exit);
        this.playerCollider.setEnabled(true);
        this.verticalSpeed = 0;
        this.driving = false;this.actor.passenger=false;
        this.message = 'Back on your feet.';
      } else if(this.fieldKit?.carried(this.activeId)) {
        this.fieldKit.place(player,this.playerYaw,this.activeId);this.message=this.fieldKit.message;
      } else if(this.fieldKit) {
        this.expeditionInteract(targetId);
      } else if (this.canRight()) {
        this.rightOwner=this.activeId;this.rightHolding=true; this.rightCharge=0;
      } else if (this.canisters.interact(this.carryingCable)) {
        this.cargoNotice();
      } else if (this.carryingCable && this.nearTree()) {
        this.attachCable();
      } else if (distance(player, this.vehicle.translation()) < config.player.interactionDistance) {
        if (this.carryingCable) { this.message = 'Attach or stow the cable before driving.'; return; }
        if(this.driverId)this.actor.passenger=true;else this.driving=true;
        this.playerCollider.setEnabled(false);
        this.message = 'Easy on the throttle. It has seen better days.';
      } else {
        this.message = this.phase === 'carried' ? 'Bring the cable to the marked tree.' : 'Walk closer to the RV.';
      }
    } else if (action === 'winch') {
      if (this.canisters.carried() || this.fieldKit?.carried(this.activeId)) { this.message = 'Set down the item first.'; return; }
      if (this.phase === 'attached') {
        if (this.driving || distance(player, this.anchor()) < config.player.interactionDistance || distance(player, this.mount()) < config.player.interactionDistance) {
          this.phase = 'stowed'; this.tension = 0;this.cableCarrier=null;this.cableOperator=null;
          this.message = 'Cable released.';
        } else this.message = 'Walk to the tree or RV to release the cable.';
      } else if (!this.seated && distance(player, this.mount()) < config.player.interactionDistance) {
        if(this.phase==='carried'&&!this.carryingCable){this.message='Your teammate has the cable.';return;}
        this.phase = this.carryingCable ? 'stowed' : 'carried';this.cableCarrier=this.phase==='carried'?this.activeId:null;
        this.message = this.phase === 'carried' ? 'Take the cable to the tree with the orange band.' : 'Cable stowed.';
      } else this.message = 'The winch is at the front of the RV.';
    }
  }

  step(input:InputFrame=neutralInput()) { this.stepPlayers({'local-player':input}); }
  stepPlayers(inputs:Record<string,InputFrame>) {
    this.selectPlayer(this.driverId??'local-player');
    const input=inputs[this.activeId]??neutralInput();
    if (this.finished) { this.selectPlayer('local-player'); return; }
    const dt = config.physics.step;
    const c = config.vehicle;
    const previousVertical = this.vehicle.linvel().y;
    const previousCargoVertical = Object.fromEntries(canisterTypes.map(type => [type, this.canisters.items[type].body.linvel().y])) as Record<CanisterType, number>;
    for(const id of this.players.keys())this.asPlayer(id,()=>{this.playerYaw=(inputs[id]??neutralInput()).yaw;this.canisters.updateHold(Boolean(inputs[id]?.interact),this.carryingCable||Boolean(this.fieldKit?.carried(id)),this.seated);});
    if (Math.abs(input.moveZ) < .01 && Math.abs(input.moveX) < .01) this.canisters.driveInputArmed = true;
    this.elapsed += dt;
    this.tick++;
    this.vehicle.resetForces(true);
    this.vehicle.resetTorques(true);
    this.asPlayer(this.rightOwner,()=>this.updateRighting(inputs[this.rightOwner]??neutralInput(),dt));
    if(this.fieldKit){
      this.fieldKit.advance(dt);this.fieldKit.pushing=false;
      for(const id of this.players.keys())this.asPlayer(id,()=>{
        const frame=inputs[id]??neutralInput();
        this.fieldKit!.tick(this.player.translation(),frame.yaw,this.seated?0:frame.reel,dt,id);
        const pushing=this.fieldKit!.pushing;
        this.fieldKit!.push(this.player.translation(),Boolean(frame.push&&!this.seated&&!this.fieldKit!.carried(id)&&!this.canisters.carried()&&!this.carryingCable&&!this.parkingBrake));
        this.fieldKit!.pushing ||= pushing;
      });
    }
    const forward = rotate({ x: 0, y: 0, z: 1 }, this.vehicle.rotation());
    const signedSpeed = dot(this.vehicle.linvel(), forward);
    const requested = this.driving ? clamp(input.moveZ, -1, 1) : 0;
    const throttle = this.throttle = this.canisters.engineEnabled() && this.canisters.driveInputArmed ? requested * (this.canisters.isDocked('skills') ? 1 : -1) : 0;
    if (requested && !this.canisters.engineEnabled()) this.message = this.canisters.startupCompleted ? 'CYCLES DISCONNECTED. Reinstall the fuel module.' : `LOAD CANISTERS · ${this.canisters.loadedCount()}/3. Rear sockets first.`;
    else if ((requested || input.moveX) && !this.canisters.driveInputArmed) this.message = 'Release all drive controls, then press again.';
    // Positive wheel yaw turns toward world +X, which is LEFT in the +Z chase view.
    const steeringTarget = this.driving && this.canisters.driveInputArmed ? -clamp(input.moveX, -1, 1) * c.maxSteering * (this.canisters.isDocked('skills') ? 1 : -1) : 0;
    this.steering += clamp(steeringTarget - this.steering, -c.steeringResponse * dt, c.steeringResponse * dt);
    const braking = this.driving && (input.brake || (throttle !== 0 && Math.sign(throttle) !== Math.sign(signedSpeed) && Math.abs(signedSpeed) > 0.6));
    for (let i = 0; i < 4; i++) {
      this.controller.setWheelSteering(i, i < 2 ? this.steering : 0);
      const force = Math.abs(signedSpeed) < c.maxSpeed && !braking ? throttle * c.engineForce : 0;
      this.controller.setWheelEngineForce(i, force);
      // Release the automatic parking brake while pulling the vehicle with the winch.
      this.controller.setWheelBrake(i, braking || this.parkingBrake || !this.canisters.startupCompleted ? c.brakeForce : !this.driverId && this.phase !== 'attached' && !this.fieldKit?.pushing ? c.parkingBrake : 0);
    }
    // Side-facing wheel rays can hit a rock wall and fight the righting torque.
    // Keep chassis collisions active, but engage suspension only within 60° of upright.
    if (rotate({x:0,y:1,z:0},this.vehicle.rotation()).y > c.minSuspensionUp) this.controller.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC, undefined, collider => collider.parent()?.handle !== this.vehicle.handle);
    const previousTension = this.tension;
    this.tension = 0;
    if (this.phase === 'attached') {
      const mount = this.mount();
      const route = cableRoute(mount, this.anchor(), this.level);
      const len = pathLength(route);
      const operator=this.cableOperator??'local-player';
      const reel = this.canisters.isDocked('winch') && !this.fieldKit?.carried(operator) ? clamp(inputs[operator]?.reel??0, -1, 1) : 0;
      if (input.reel && !this.canisters.isDocked('winch')) this.message = 'WINCH OFFLINE. The cable holds; reinstall its motor module to reel.';
      const rate = reel > 0 ? config.winch.reelSpeed * (1 - previousTension / config.winch.maxForce) : config.winch.reelSpeed;
      // A stalled drum cannot keep shortening the rest length and store metres
      // of invisible spring extension. Paying out always remains available.
      const minimum = reel > 0 ? Math.max(config.winch.minLength, Math.min(this.cableLength, len - config.winch.maxForce / config.winch.stiffness)) : config.winch.minLength;
      this.cableLength = clamp(this.cableLength - reel * rate * dt, minimum, config.winch.maxLength);
      const delta = sub(route[1], mount);
      const direction = scale(delta, 1 / Math.max(length(delta), 0.001));
      const mountVelocity = this.vehicle.velocityAtPoint(mount);
      this.tension = cableForce(len - this.cableLength, -dot(mountVelocity, direction), config.winch.stiffness, config.winch.damping, config.winch.maxForce);
      this.vehicle.addForceAtPoint(scale(direction, this.tension), mount, true);
    }

    for(const id of this.players.keys())this.asPlayer(id,()=>this.movePlayer(inputs[id]??neutralInput(),dt));

    this.world.step();
    const rideAcceleration = (this.vehicle.linvel().y - previousVertical) / dt;
    this.shock = Math.max(0, rideAcceleration);
    const pos = this.vehicle.translation();
    const track = this.level.track;
    if (pos.z > track.ditch[0] && pos.z < track.ditch[1] && pos.y < track.ditchMaxY) this.enteredDitch = true;
    if (this.enteredDitch && pos.z > track.recoveredZ && pos.y > track.recoveredMinY) this.recovered = true;
    const released = this.canisters.updateRide(rideAcceleration, Math.abs(signedSpeed));
    if (released) this.ejected[released] = true;
    // Item pose uses camera-facing carry direction; articulated hands follow it.
    this.canisters.tick(this.playerYaw, previousCargoVertical);
    this.cargoNotice();
    if(track.map) {
      const goal=track.map.finish;
      if(this.canisters.loadedCount()===3&&this.driverId!==null&&Math.hypot(pos.x-goal.x,pos.z-goal.z)<goal.radius&&pos.y>this.level.groundHeight(pos.x,pos.z)&&rotate({x:0,y:1,z:0},this.vehicle.rotation()).y>.6)this.finished=true;
    } else if (this.recovered && this.canisters.loadedCount() === 3 && this.driving && pos.z >= track.finishZ && Math.abs(pos.x-this.level.centerX(pos.z)) < track.roadHalfWidth - 1) this.finished = true;
    this.selectPlayer('local-player');
  }

  private movePlayer(input:InputFrame,dt:number) {
    if (!this.seated) {
      this.playerYaw = input.yaw;
      const magnitude = Math.max(1, Math.hypot(input.moveX, input.moveZ));
      const speed = this.fieldKit?.carried(this.activeId) ? config.fieldKit.carrySpeed : this.canisters.carried() ? config.cargo.carrySpeed : input.sprint ? config.player.runSpeed : config.player.walkSpeed;
      const mx = input.moveX / magnitude;
      const mz = input.moveZ / magnitude;
      const movement = cameraMovement(mx, mz, input.yaw);
      this.verticalSpeed += config.physics.gravity * dt;
      this.character.computeColliderMovement(this.playerCollider, {
        x: movement.x * speed * dt,
        y: this.verticalSpeed * dt,
        z: movement.z * speed * dt,
      });
      this.grounded = this.character.computedGrounded();
      if (this.grounded && this.verticalSpeed < 0) this.verticalSpeed = 0;
      const computed = add(this.player.translation(), this.character.computedMovement());
      const next = this.level.safePlayerPosition(computed);
      if (next.y > computed.y + 0.0001 && this.verticalSpeed < 0) { this.verticalSpeed = 0; this.grounded = true; }
      // Carrying has a finite reach; no invisible force or teleport is applied to the RV.
      if (this.carryingCable && pathLength(cableRoute(this.mount(), add(next, { x: 0, y: 0.25, z: 0 }), this.level)) > config.winch.maxLength) {
        next.x = this.player.translation().x; next.z = this.player.translation().z;
        this.message = 'That is all the cable. Bring the RV closer.';
      }
      this.player.setNextKinematicTranslation(next);
    } else this.player.setNextKinematicTranslation(add(this.vehicle.translation(), rotate({ x: this.driving?-.5:.5, y: .8, z: .8 },this.vehicle.rotation())));

  }

  private cargoNotice() {
    if (this.canisters.message !== this.lastCargoMessage) { this.lastCargoMessage = this.canisters.message; this.message = this.lastCargoMessage; }
  }

  private anchor() { return this.level.anchors.find(tree=>tree.id===this.attachedTree)!; }
  private nearTree() { return this.level.anchors.filter(tree=>distance(this.player.translation(),tree)<config.player.interactionDistance).sort((a,b)=>distance(this.player.translation(),a)-distance(this.player.translation(),b))[0]; }
  private canRight() {
    const up=rotate({x:0,y:1,z:0},this.vehicle.rotation());
    return !this.seated && !this.carryingCable && !this.canisters.carried() && !this.fieldKit?.carried(this.activeId) && this.rightCooldown===0 && up.y<.45 && length(this.vehicle.linvel())<1.5 && distance(this.player.translation(),this.vehicle.translation())<config.recovery.reach;
  }
  private exitPosition(): Vec3 | null {
    const pos = this.vehicle.translation(), q = this.vehicle.rotation();
    const localRight = rotate({x:1,y:0,z:0},q), localForward = rotate({x:0,y:0,z:1},q);
    // A rolled bus's door direction points vertically. Search on the ground
    // instead of placing the player inside the chassis, where it blocks righting.
    const basis = Math.hypot(localRight.x,localRight.z) > .5 ? localRight : {x:localForward.z,y:0,z:-localForward.x};
    const norm = Math.hypot(basis.x,basis.z) || 1, right = {x:basis.x/norm,z:basis.z/norm};
    const radii = [config.player.exitDistance,config.recovery.exitDistance];
    if (rotate({x:0,y:1,z:0},q).y < .45) radii.reverse();
    for (const radius of radii) for (const [sx,sz] of [[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[-.707,.707],[.707,-.707],[-.707,-.707]]) {
      const p = this.level.safePlayerPosition({x:pos.x+(right.x*sx-right.z*sz)*radius,y:0,z:pos.z+(right.z*sx+right.x*sz)*radius});
      p.y = this.level.groundHeight(p.x,p.z) + config.player.halfHeight + config.player.radius + .05;
      const occupied = this.world.intersectionWithShape(p,{x:0,y:0,z:0,w:1},new RAPIER.Capsule(config.player.halfHeight,config.player.radius),undefined,undefined,this.playerCollider,this.player);
      if (!occupied) return p;
    }
    return null;
  }
  private updateRighting(input:InputFrame,dt:number) {
    const r=config.recovery;
    this.rightCooldown=Math.max(0,this.rightCooldown-dt);this.kickAnimation=Math.max(0,this.kickAnimation-dt);
    if(this.rightHolding) {
      if(!input.interact || !this.canRight() || Math.hypot(input.moveX,input.moveZ)>.1) {this.rightHolding=false;this.rightCharge=0;}
      else if((this.rightCharge+=dt)>=r.holdSeconds) {
        this.rightHolding=false;this.rightCharge=0;this.rightCooldown=r.cooldown;this.rightAssist=r.assistSeconds;this.kickAnimation=.5;this.kicks++;
        // Move a side-resting chassis slightly away from the surface under its wheels
        // before turning it: a nearby rock must not pin the suspension mid-kick.
        const up = rotate({x:0,y:1,z:0},this.vehicle.rotation());
        this.vehicle.applyImpulse({x:up.x*config.vehicle.mass*r.clearanceSpeed,y:config.vehicle.mass*r.liftSpeed,z:up.z*config.vehicle.mass*r.clearanceSpeed},true);
        this.message='PERCUSSIVE MAINTENANCE! Have you tried kicking it?';
      }
    }
    if(this.rightAssist>0) {
      this.rightAssist=Math.max(0,this.rightAssist-dt);
      const up=rotate({x:0,y:1,z:0},this.vehicle.rotation()), angle=Math.acos(clamp(up.y,-1,1));
      let axis={x:-up.z,y:0,z:up.x};
      if(length(axis)<.02) {const forward=rotate({x:0,y:0,z:1},this.vehicle.rotation());axis={x:forward.x,y:0,z:forward.z};if(length(axis)<.02)axis={x:0,y:0,z:1};}
      axis=scale(axis,1/length(axis));
      const velocity=this.vehicle.angvel();
      this.vehicle.addTorque({x:axis.x*angle*r.torque-velocity.x*r.damping,y:-velocity.y*r.damping,z:axis.z*angle*r.torque-velocity.z*r.damping},true);
      if(up.y>.98 && length(velocity)<.2)this.rightAssist=0;
    }
  }
  cancelInteractions() { for(const id of this.players.keys())this.asPlayer(id,()=>this.canisters.cancelHold());this.rightHolding=false;this.rightCharge=0; }

  mount() { return add(this.vehicle.translation(), rotate(config.winch.mount, this.vehicle.rotation())); }

  snapshot(playerId='local-player'):Snapshot { return this.asPlayer(playerId,()=>this.playerSnapshot()); }
  private playerSnapshot(): Snapshot {
    const mount = this.mount();
    const end = this.phase === 'attached' ? { ...this.anchor() } : this.phase === 'carried' ? add(this.players.get(this.cableCarrier??'local-player')!.body.translation(), { x: 0, y: 0.25, z: 0 }) : mount;
    return {
      tick: this.tick,
      trackId: this.level.track.id,
      ...(this.fieldKit?{fieldKit:this.fieldKit.snapshot(this.player.translation(),this.playerYaw,this.activeId)}:{}),
      players: [...this.players.values()].map(p=>({id:p.id,position:{...p.body.translation()},yaw:p.yaw,driving:this.driverId===p.id,grounded:p.grounded,passenger:p.passenger})),
      player: { id:this.activeId,passenger:this.actor.passenger,position: { ...this.player.translation() }, yaw: this.playerYaw, driving: this.driving, grounded: this.grounded },
      vehicle: {
        position: { ...this.vehicle.translation() }, rotation: { ...this.vehicle.rotation() }, velocity: { ...this.vehicle.linvel() },
        speed: length(this.vehicle.linvel()), steering: this.steering,
        parkingBrake: this.parkingBrake || !this.canisters.startupCompleted || !this.driverId && this.phase !== 'attached' && !this.fieldKit?.pushing, throttle: this.throttle, shock: this.shock,
        wheels: Array.from({ length: 4 }, (_, i) => ({ suspension: this.controller.wheelSuspensionLength(i) ?? config.vehicle.suspension, rotation: this.controller.wheelRotation(i) ?? 0 })),
      },
      canisters: this.canisters.snapshot(),
      systems: { startupCompleted: this.canisters.startupCompleted, driveInputArmed: this.canisters.driveInputArmed, engine: this.canisters.engineEnabled(), winch: this.canisters.isDocked('winch'), skills: this.canisters.isDocked('skills') ? 'normal' : 'swapped', loaded: this.canisters.loadedCount(), doorOpen: true },
      recovery: {available:this.canRight(),charge:this.rightCharge/config.recovery.holdSeconds,cooldown:this.rightCooldown,kicks:this.kicks,animation:this.kickAnimation},
      interaction: this.seated ? { kind: 'none', type: null, position: null, prompt: '', hold: 0 } : this.fieldKit?this.selectedInteraction():this.canisters.interaction(this.carryingCable),
      events: [...this.canisters.events],
      winch: { carrierId:this.cableCarrier,operatorId:this.cableOperator,phase: this.phase, length: this.cableLength, span: pathLength(cableRoute(mount, end, this.level)), tension: this.tension, mount, end },
      progress: { enteredDitch: this.enteredDitch, recovered: this.recovered, finished: this.finished, elapsed: this.elapsed, ejected: { ...this.ejected } },
    };
  }

  prompt(playerId='local-player'):string { return this.asPlayer(playerId,()=>this.playerPrompt()); }
  private playerPrompt() {
    const p = this.player.translation();
    if(this.actor.passenger)return 'E · Step outside · passenger seat';
    if (this.driving) return this.phase === 'attached' && this.cableOperator===this.activeId ? 'Q · Pull   R · Give slack   F · Detach' : 'E · Step outside';
    if(this.fieldKit?.carried(this.activeId))return `${this.fieldKit.preview(p,this.playerYaw,this.activeId)?.reason} · Q / R rotate`;
    if(this.fieldKit){const selected=this.selectedInteraction();if(selected.target)return selected.prompt;}
    if(this.canRight())return 'Hold E · Kick the bus upright';
    const cargo = this.canisters.interaction(this.carryingCable);
    if (cargo.kind !== 'none') return cargo.prompt;
    if (this.carryingCable && this.nearTree()) return 'E · Attach cable to tree';
    if (distance(p, this.mount()) < config.player.interactionDistance && this.phase !== 'attached') return this.carryingCable ? 'F · Stow cable' : this.phase==='carried' ? 'Your teammate has the cable' : 'F · Take winch cable';
    if (distance(p, this.vehicle.translation()) < config.player.interactionDistance) return this.fieldKit ? 'E · Get in · Hold B to push' : 'E · Get in the RV';
    if (this.phase === 'attached') return this.cableOperator===this.activeId ? 'Hold Q · Reel in     R · Pay out' : 'Your teammate operates the winch';
    if (this.carryingCable) return 'Bring the cable to the marked tree';
    return this.fieldKit ? 'Find a route · E pick up · T mark a spot' : 'Find your way back to the RV';
  }

  destroy() { this.world.free(); }
}
