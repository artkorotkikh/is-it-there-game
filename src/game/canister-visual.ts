import * as pc from 'playcanvas';
import { config, moduleDefinitions } from './config';
import type { ShapeFactory } from './character';
import { mix } from './math';
import { Signage } from './signage';
import { canisterTypes, type CanisterType, type Snapshot } from './types';

export class CanisterVisuals {
  private objects = {} as Record<CanisterType, pc.Entity>;
  private lamps = {} as Record<CanisterType, pc.Entity>;
  private highlights = {} as Record<CanisterType, pc.Entity>;
  private hatch: pc.Entity;
  private hatchAngle = 150;

  constructor(app: pc.Application, rv: pc.Entity, shape: ShapeFactory, signage: Signage) {
    for (const type of canisterTypes) {
      const def = moduleDefinitions[type];
      const root = this.objects[type] = new pc.Entity(`${def.label} canister`, app);
      app.root.addChild(root);
      const part = (size: number[], pos: number[], color: string, parent = root) => shape('box', size, pos, color, parent);
      part([.51, .7, .48], [0, 0, 0], '#334748');
      part([.45, .62, .022], [0, 0, -.247], def.color);
      part([.38, .38, .024], [0, .005, -.265], '#d9d3b5');
      signage.label([`${def.number}  ${def.symbol}`, def.label], .365, .34, [0, .02, -.28], root, '#e9ddbb');
      // Handle and rubber feet give every module the same graspable silhouette.
      for (const x of [-.15, .15]) part([.065, .14, .1], [x, .405, 0], '#aab6a3');
      part([.36, .065, .1], [0, .46, 0], '#aab6a3');
      for (const x of [-.225, .225]) for (const y of [-.295, .295]) part([.1, .13, .53], [x, y, 0], '#202f31');
      for (const x of [-.13, 0, .13]) part([.06, .17, .06], [x, -.03, .268], '#c8b67f');
      part([.22, .04, .025], [.045, -.255, -.272], '#7f806c').setLocalEulerAngles(0, 0, -12);
      shape('sphere', [.045, .045, .025], [.16, .245, -.27], '#c6e6a6', root);
      if (type === 'winch') {
        shape('cylinder', [.25, .15, .25], [.31, -.01, 0], '#a3a58a', root).setLocalEulerAngles(0, 0, 90);
        part([.06, .18, .08], [.33, -.17, 0], def.color);
      } else if (type === 'cycles') {
        for (const y of [-.12, 0, .12]) part([.028, .045, .24], [.267, y, 0], '#72e8da');
      } else {
        part([.024, .21, .04], [.3, .1, -.03], '#514965');
        const card = signage.label(['DRIVING', 'LICENCE'], .18, .13, [.32, -.04, -.05], root, '#e0cee9');
        card.setLocalEulerAngles(0, -12, -14);
      }

      const socket = new pc.Entity(`${def.label} socket`, app); rv.addChild(socket);
      socket.setLocalPosition(def.x, config.cargo.socketY, config.cargo.socketZ);
      part([.56, .76, .04], [0, 0, .28], '#1b3034', socket);
      for (const x of [-.28, .28]) part([.035, .73, .54], [x, -.02, 0], '#707e72', socket);
      part([.57, .04, .57], [0, -.37, 0], '#9fa78b', socket);
      signage.label([def.number, def.label], .39, .32, [0, 0, .254], socket, '#253d3f', def.color);
      signage.label([def.label], .48, .12, [def.x, .45, -2.365], rv, '#344b49', def.color);
      this.lamps[type] = shape('sphere', [.08, .08, .04], [def.x, .59, -2.39], '#9beaac', rv);
      const highlight = this.highlights[type] = new pc.Entity('Socket selection', app); socket.addChild(highlight);
      for (const x of [-.3, .3]) part([.027, .8, .025], [x, 0, -.4], def.color, highlight);
      for (const y of [-.4, .4]) part([.62, .027, .025], [0, y, -.4], def.color, highlight);
    }
    this.hatch = new pc.Entity('Rear service hatch', app); rv.addChild(this.hatch);
    this.hatch.setLocalPosition(0, .63, -2.4);
    shape('box', [1.94, 1.12, .06], [0, -.56, 0], '#8b9b81', this.hatch);
    signage.label(['PROBABLY WORKS', 'DEPENDENCIES INSIDE'], 1.7, .5, [0, -.5, -.04], this.hatch, '#dcd3ac');
    shape('box', [.44, .055, .08], [0, -.99, -.06], '#344c47', this.hatch);
  }

  draw(previous: Snapshot, current: Snapshot, alpha: number, dt: number) {
    for (const item of current.canisters) {
      const before = previous.canisters.find(p => p.id === item.id)!;
      const t = before.phase === item.phase ? alpha : 1;
      const p = mix(before.position, item.position, t);
      const q = new pc.Quat().slerp(new pc.Quat(before.rotation.x, before.rotation.y, before.rotation.z, before.rotation.w), new pc.Quat(item.rotation.x, item.rotation.y, item.rotation.z, item.rotation.w), t);
      const entity = this.objects[item.type]; entity.setPosition(p.x, p.y, p.z); entity.setRotation(q);
      if (item.phase === 'docked') {
        const rattle = before.rattle + (item.rattle - before.rattle) * t;
        entity.translateLocal(0, rattle, -Math.abs(rattle) * .35);
        entity.rotateLocal(rattle * 65, 0, rattle * 35 * Math.sign(moduleDefinitions[item.type].x || 1));
      }
      this.lamps[item.type].enabled = item.phase === 'docked';
      this.highlights[item.type].enabled = (current.interaction.type === item.type && !current.interaction.target?.id.startsWith('cargo:')) || item.carrierId === (current.player.id??'local-player');
    }
    const target = current.systems.doorOpen ? 150 : 0;
    this.hatchAngle += (target - this.hatchAngle) * Math.min(1, dt * 12);
    this.hatch.setLocalEulerAngles(this.hatchAngle, 0, 0);
  }
}
