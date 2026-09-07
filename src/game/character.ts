import * as pc from 'playcanvas';
import { clamp } from './math';
import type { Snapshot, Vec3 } from './types';

export type Primitive = 'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule';
export type ShapeFactory = (type: Primitive, size: number[], position: number[], color: string, parent: pc.Entity) => pc.Entity;

/** A worn-out adult traveler. The detailed mesh is visual; collision stays a capsule. */
export class Character {
  readonly root: pc.Entity;
  private readonly torso: pc.Entity;
  private readonly head: pc.Entity;
  private readonly leftArm: pc.Entity;
  private readonly rightArm: pc.Entity;
  private readonly leftHand: pc.Entity;
  private readonly hips: pc.Entity[] = [];
  private readonly knees: pc.Entity[] = [];
  private lastPosition: Vec3 | undefined;
  private gait = 0;
  private idle = 0;
  private facing = 0;

  constructor(app: pc.Application, shape: ShapeFactory) {
    this.root = new pc.Entity('Traveler: patched shirt, bruised eye', app);
    app.root.addChild(this.root);
    const pivot = (name: string, position: number[], parent = this.root) => {
      const entity = new pc.Entity(name, app);
      entity.setLocalPosition(position[0], position[1], position[2]);
      parent.addChild(entity);
      return entity;
    };
    const part = (name: string, type: Primitive, size: number[], pos: number[], color: string, parent = this.root) => {
      const entity = shape(type, size, pos, color, parent);
      entity.name = name;
      return entity;
    };

    this.torso = pivot('Slightly slouched torso', [0, 0, 0]);
    part('Faded ochre shirt', 'box', [.59, .62, .33], [0, .04, 0], '#b48646', this.torso);
    part('Shirt hem', 'box', [.61, .07, .35], [0, -.23, 0], '#8b683d', this.torso);
    for (const x of [-.2, .18]) part('Worn plaid vertical', 'box', [.075, .59, .012], [x, .05, .175], '#865c36', this.torso);
    for (const y of [-.12, .09, .28]) part('Worn plaid horizontal', 'box', [.57, .045, .012], [0, y, .181], '#76583b', this.torso);
    part('Undershirt', 'box', [.18, .26, .019], [0, .23, .188], '#dbd1ad', this.torso);
    part('Left collar', 'box', [.14, .14, .04], [.13, .3, .18], '#b99765', this.torso).setLocalEulerAngles(0, 0, 28);
    part('Right collar', 'box', [.14, .14, .04], [-.13, .3, .18], '#b99765', this.torso).setLocalEulerAngles(0, 0, -28);
    part('Chest pocket', 'box', [.17, .16, .035], [.19, .11, .195], '#9c773e', this.torso);
    part('Pocket stitching', 'box', [.13, .013, .014], [.19, .04, .218], '#d1b888', this.torso);
    part('Mud on shirt', 'box', [.17, .1, .018], [-.19, -.15, .192], '#645744', this.torso).setLocalEulerAngles(0, 0, -13);
    part('Neck', 'cylinder', [.19, .17, .19], [0, .4, 0], '#ca9470', this.torso);

    this.head = pivot('Tired head', [0, .64, 0], this.torso);
    part('Face', 'box', [.43, .43, .39], [0, 0, .015], '#d9ab7e', this.head);
    part('Hair at back', 'box', [.46, .3, .12], [0, .06, -.19], '#5b493b', this.head);
    for (const x of [-.24, .24]) part('Ear', 'sphere', [.095, .145, .11], [x, -.02, .015], '#ca9470', this.head);
    part('Stubble', 'box', [.38, .15, .065], [0, -.145, .225], '#76604c', this.head);
    part('Crooked mouth', 'box', [.13, .025, .028], [.025, -.13, .266], '#4c4438', this.head).setLocalEulerAngles(0, 0, -8);
    part('Black eye', 'sphere', [.145, .115, .028], [.11, .028, .221], '#8a716d', this.head);
    for (const x of [-.105, .105]) {
      part('Eye white', 'box', [.072, .048, .025], [x, .028, .239], '#eae1c9', this.head);
      part('Pupil', 'box', [.027, .042, .025], [x - .007, .023, .257], '#3d4237', this.head);
      part('Tired eyebrow', 'box', [.09, .023, .025], [x, .078, .246], '#68513a', this.head).setLocalEulerAngles(0, 0, x > 0 ? -13 : 8);
    }
    part('Sunburnt nose', 'sphere', [.095, .12, .12], [0, -.028, .274], '#ce936c', this.head);
    part('Forehead bandage', 'box', [.17, .043, .021], [-.085, .133, .231], '#e9d8b0', this.head).setLocalEulerAngles(0, 0, -16);
    part('Bandage pad', 'box', [.049, .05, .025], [-.085, .133, .243], '#cdb895', this.head);
    part('Old trucker cap', 'box', [.49, .15, .46], [0, .23, -.008], '#61776c', this.head);
    part('Cap front patch', 'box', [.2, .087, .026], [0, .229, .232], '#d8cfaa', this.head);
    part('Cap stitched mark', 'box', [.08, .015, .015], [0, .229, .25], '#677566', this.head).setLocalEulerAngles(0, 0, 25);
    part('Bent cap brim', 'box', [.51, .035, .22], [0, .165, .272], '#435c51', this.head).setLocalEulerAngles(-9, 0, -3);

    part('Trousers waist', 'box', [.48, .24, .32], [0, -.28, -.015], '#3e5a58');
    part('Belt', 'box', [.5, .07, .35], [0, -.23, -.015], '#5b4e3b');
    part('Belt buckle', 'box', [.09, .055, .023], [0, -.23, .172], '#b4aa81');
    for (const [i, x] of [-.15, .15].entries()) {
      const hip = pivot('Hip', [x, -.34, 0]);
      this.hips.push(hip);
      part('Trouser leg', 'box', [.22, .22, .27], [0, -.095, 0], '#425d58', hip);
      const knee = pivot('Knee', [0, -.2, 0], hip);
      this.knees.push(knee);
      part('Shin', 'box', [.2, .18, .24], [0, -.08, 0], '#3b5551', knee);
      part('Knee patch', 'box', [.16, .12, .022], [0, .005, .142], i === 0 ? '#9d9676' : '#526758', knee).setLocalEulerAngles(0, 0, 6);
      part('Scuffed boot', 'box', [.24, .13, .36], [0, -.205, .055], '#635640', knee);
      part('Boot sole', 'box', [.25, .035, .38], [0, -.267, .055], '#343c32', knee);
      part('Boot scuff', 'box', [.14, .032, .018], [0, -.195, .244], '#a89d77', knee);
      for (const z of [.08, .135]) part('Boot lace', 'box', [.17, .017, .014], [0, -.132, z], '#aaa78d', knee);
    }

    this.leftArm = pivot('Cable arm', [.36, .25, 0], this.torso);
    this.rightArm = pivot('Free arm', [-.36, .25, 0], this.torso);
    let hand: pc.Entity | undefined;
    for (const [i, arm] of [this.leftArm, this.rightArm].entries()) {
      part('Rolled sleeve', 'box', [.21, .23, .25], [0, -.1, 0], '#b0874d', arm);
      part('Sleeve cuff', 'box', [.225, .075, .27], [0, -.19, 0], '#c19d69', arm);
      const elbow = pivot('Elbow', [0, -.21, 0], arm);
      part('Forearm', 'box', [.145, .24, .16], [0, -.1, 0], '#c59970', elbow);
      const palm = part('Hand', 'sphere', [.18, .19, .17], [0, -.25, .015], '#cba079', elbow);
      if (i === 0) {
        hand = palm;
        part('Arm bandage', 'box', [.15, .06, .175], [0, -.09, 0], '#d4c7a0', elbow);
      }
    }
    this.leftHand = hand!;
  }

  update(snapshot: Snapshot, position: Vec3, dt: number, menu: boolean) {
    const last = this.lastPosition ?? position;
    const dx = position.x - last.x;
    const dz = position.z - last.z;
    const speed = clamp(Math.hypot(dx, dz) / Math.max(dt, .001), 0, 7);
    this.lastPosition = { ...position };
    this.idle += dt;
    if (speed > .2) this.facing = Math.atan2(dx, dz);
    else if (menu) this.facing = .6;
    const carrying = snapshot.canisters.some(item => item.phase === 'carried'&&item.carrierId===(snapshot.player.id??'local-player')) || Boolean(snapshot.fieldKit?.carriedId);
    if (carrying) this.facing = snapshot.player.yaw;
    const kick = snapshot.recovery;
    if (kick.charge > 0 || kick.animation > 0) this.facing = Math.atan2(snapshot.vehicle.position.x-position.x,snapshot.vehicle.position.z-position.z);
    this.gait += speed * dt * 7;
    const stride = snapshot.player.grounded ? clamp(speed / 4, 0, 1) : 0;
    const swing = Math.sin(this.gait) * 29 * stride;
    this.root.enabled = !snapshot.player.driving&&!snapshot.player.passenger;
    this.root.setPosition(position.x, position.y, position.z);
    this.root.setEulerAngles(0, this.facing * pc.math.RAD_TO_DEG, 0);
    this.torso.setLocalEulerAngles(4 + stride * 5, 0, Math.sin(this.idle * 1.7) * 1.2);
    this.head.setLocalEulerAngles(-4 + Math.sin(this.idle * 1.3) * 2, -6, -5);
    this.hips[0].setLocalEulerAngles(swing, 0, -2);
    this.hips[1].setLocalEulerAngles(-swing * .8, 0, 3);
    this.knees[0].setLocalEulerAngles(Math.max(0, -swing) * .65, 0, 0);
    this.knees[1].setLocalEulerAngles(Math.max(0, swing) * .65, 0, 0);
    this.leftArm.setLocalEulerAngles(carrying ? -78 : snapshot.winch.phase === 'carried'&&snapshot.winch.carrierId===(snapshot.player.id??'local-player') ? -38 : -swing * .7, 0, -6);
    this.rightArm.setLocalEulerAngles(carrying ? -78 : swing * .7, 0, 8);
    if (kick.charge > 0 || kick.animation > 0) {
      const strike = Math.sin(Math.min(1,kick.animation/.5)*Math.PI);
      this.torso.setLocalEulerAngles(-15*kick.charge+22*strike,0,-6);
      this.hips[0].setLocalEulerAngles(30*kick.charge-82*strike,0,-3);
      this.knees[0].setLocalEulerAngles(50*kick.charge+12*strike,0,0);
      this.leftArm.setLocalEulerAngles(-25-35*strike,0,-25);
      this.rightArm.setLocalEulerAngles(-18,0,20);
    }
  }

  cableHand() { return this.leftHand.getPosition().clone(); }
  reset() { this.lastPosition = undefined; this.gait = 0; }
}
