import * as pc from 'playcanvas';
import { config } from './config';
import { resourceSize } from './field-kit';
import { add, rotate } from './math';
import type { Snapshot } from './types';

const ready=new pc.Color().fromString('#e4f6bc'),blocked=new pc.Color().fromString('#f4bc62');
/** Outline the exact host-selected object; amber also identifies blocked targets. */
export function drawInteractionTarget(app:pc.Application,s:Snapshot) {
  const {target,position,kind}=s.interaction;if(!target||!position)return;
  const resource=s.fieldKit?.items.find(item=>`resource:${item.id}`===target.id);
  const cargo=s.canisters.find(item=>`cargo:${item.type}`===target.id);
  const bus=target.id.startsWith('bus:');
  const center=resource?.position??cargo?.position??position;
  const rotation=resource?.rotation??cargo?.rotation??(bus?s.vehicle.rotation:{x:0,y:0,z:0,w:1});
  const size=resource?resourceSize(resource.kind):cargo?{width:config.cargo.halfWidth*2,height:1,length:config.cargo.halfDepth*2}:bus?{width:config.vehicle.halfWidth*2,height:config.vehicle.halfHeight*2,length:config.vehicle.halfLength*2}:{width:.6,height:.8,length:.6};
  const half=[size.width/2+.07,size.height/2+.07,size.length/2+.07];
  const points:pc.Vec3[]=[];
  // Short corner brackets retain the object's shape without covering its artwork.
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]) {
    const corner=[x*half[0],y*half[1],z*half[2]];
    for(let axis=0;axis<3;axis++) {
      const end=[...corner];end[axis]*=.65;
      for(const point of [corner,end]){const world=add(center,rotate({x:point[0],y:point[1],z:point[2]},rotation));points.push(new pc.Vec3(world.x,world.y,world.z));}
    }
  }
  app.drawLines(points,kind==='blocked'?blocked:ready,false);
}
