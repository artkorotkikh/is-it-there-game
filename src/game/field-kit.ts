import RAPIER from '@dimforge/rapier3d-compat';
import { config } from './config';
import type { Level } from './level';
import { add, distance, length, rotate, scale, sub } from './math';
import type { Rotation, Vec3 } from './types';

export type ResourceKind='plank'|'stone';
export interface ResourceSnapshot { id:string; kind:ResourceKind; phase:'available'|'carried'|'placed'; carrierId:string|null; position:Vec3; rotation:Rotation }
export interface Placement { kind:ResourceKind; position:Vec3; rotation:Rotation; valid:boolean; reason:string; supports:string[] }
export interface FieldKitSnapshot { items:ResourceSnapshot[]; carriedId:string|null; preview:Placement|null; pushing:boolean; ping:Vec3|null }
interface Item extends ResourceSnapshot { body:RAPIER.RigidBody; collider:RAPIER.Collider; supports:string[] }
export const yawRotation=(yaw:number):Rotation=>({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)});
export const resourceSize=(kind:ResourceKind)=>config.fieldKit[kind];

/** Local-space convex surfaces, shared by collision, solid visuals and preview. */
export function resourceMesh(kind:ResourceKind) {
  const {width:w,height:h,length:d}=resourceSize(kind),top=kind==='stone'?.42:1;
  return {positions:[-w/2,-h/2,-d/2,w/2,-h/2,-d/2,w/2,-h/2,d/2,-w/2,-h/2,d/2,
    -w/2*top,h/2,-d/2*top,w/2*top,h/2,-d/2*top,w/2*top,h/2,d/2*top,-w/2*top,h/2,d/2*top],
    indices:[0,1,2,0,2,3,4,6,5,4,7,6,0,5,1,0,4,5,1,6,2,1,5,6,2,7,3,2,6,7,3,4,0,3,7,4]};
}
function descriptor(kind:ResourceKind) {
  const mesh=resourceMesh(kind);
  return RAPIER.ColliderDesc.convexMesh(new Float32Array(mesh.positions),new Uint32Array(mesh.indices))!.setFriction(1.1);
}

/** Stable, reusable props. The host owns every pickup/place transition. No
 * stacking stones or removing load-bearing supports; carried props don't collide. */
export class FieldKit {
  readonly items:Item[]=[];
  private angles=new Map<string,number>();
  pushing=false;
  ping:Vec3|null=null;
  private pingTime=0;
  message='';
  constructor(private world:RAPIER.World,private level:Level,private vehicle:RAPIER.RigidBody) {
    for(const source of level.track.map?.resources??[]) {
      const size=resourceSize(source.kind),rotation=yawRotation(source.yaw);
      const position={x:source.x,y:level.groundHeight(source.x,source.z)+size.height/2+.035,z:source.z};
      const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x,position.y,position.z).setRotation(rotation));
      const collider=world.createCollider(descriptor(source.kind),body);
      this.items.push({id:source.id,kind:source.kind,phase:'available',carrierId:null,position,rotation,body,collider,supports:[]});
    }
  }
  carried(playerId='local-player') { return this.items.find(item=>item.carrierId===playerId); }
  nearest(player:Vec3) {
    const reach=(item:Item)=>{const projection=item.collider.projectPoint(player,true);return projection?distance(player,projection.point):Infinity;};
    return this.items.filter(item=>item.phase!=='carried'&&reach(item)<config.fieldKit.reach).sort((a,b)=>reach(a)-reach(b))[0];
  }
  /** Includes blocked props so an explicitly selected support can explain why. */
  targets(player:Vec3) {
    return this.items.filter(item=>item.phase!=='carried').flatMap(item=>{
      const point=item.collider.projectPoint(player,true)?.point;
      if(!point || distance(player,point)>=config.fieldKit.reach)return [];
      return [{id:item.id,kind:item.kind,position:{...point},reason:this.pickupBlock(item,player)}];
    });
  }
  private loaded(item:Item) {
    if(this.items.some(other=>other.phase!=='carried'&&other.supports.includes(item.id)))return true;
    const size=resourceSize(item.kind);
    // Raycast wheels have no colliders. Protect the whole chassis footprint down
    // to its suspension rather than relying on chassis contacts with the plank.
    const hit=this.world.intersectionWithShape(add(item.position,{x:0,y:1,z:0}),item.rotation,
      new RAPIER.Cuboid(size.width/2+.08,1.4,size.length/2+.08),undefined,undefined,item.collider,undefined,
      collider=>collider.parent()?.handle===this.vehicle.handle);
    return Boolean(hit);
  }
  private pickupBlock(item:Item,player:Vec3) {
    if(this.loaded(item))return 'That support is in use. Move the bus or lift the plank first.';
    const delta=sub(item.collider.projectPoint(player,true)!.point,player),span=length(delta);
    if(span<.01)return '';
    const hit=this.world.castRay(new RAPIER.Ray(player,scale(delta,1/span)),span+.02,true,undefined,undefined,undefined,undefined,c=>!c.parent()?.isKinematic());
    return hit&&hit.collider.handle!==item.collider.handle?'Walk around to reach that item.':'';
  }
  pickup(player:Vec3,playerId='local-player',itemId?:string):boolean {
    if(this.carried(playerId))return false;
    const item=itemId?this.items.find(item=>item.id===itemId&&item.phase!=='carried'&&distance(player,item.collider.projectPoint(player,true)!.point)<config.fieldKit.reach):this.nearest(player);if(!item)return false;
    const blocked=this.pickupBlock(item,player);if(blocked){this.message=blocked;return true;}
    item.phase='carried';item.carrierId=playerId;item.supports=[];item.collider.setEnabled(false);this.angles.set(playerId,0);
    this.message=`${item.kind==='plank'?'Plank':'Stone'} in hand. Q / R rotate; E places on valid supports.`;return true;
  }
  private support(x:number,z:number,stones:boolean):{height:number;id?:string} {
    let height=this.level.groundHeight(x,z),id:string|undefined;
    if(stones)for(const item of this.items)if(item.kind==='stone'&&item.phase!=='carried') {
      const hit=item.collider.castRay(new RAPIER.Ray({x,y:90,z},{x:0,y:-1,z:0}),110,true);
      if(hit>=0 && 90-hit>height){height=90-hit;id=item.id;}
    }
    return {height,id};
  }
  preview(player:Vec3,yaw:number,playerId='local-player'):Placement|null {
    const item=this.carried(playerId);if(!item)return null;
    const size=resourceSize(item.kind),angle=yaw+(this.angles.get(playerId)??0);
    const forward={x:Math.sin(angle),y:0,z:Math.cos(angle)},right={x:Math.cos(angle),y:0,z:-Math.sin(angle)};
    const center=add(player,{x:Math.sin(yaw)*config.fieldKit.placementReach,y:0,z:Math.cos(yaw)*config.fieldKit.placementReach});
    const along=size.length/2-config.fieldKit.supportInset,across=size.width/2-.07;
    const ends=[-1,1].map(sign=>[-1,1].map(side=>{
      const p=add(center,add(scale(forward,sign*along),scale(right,side*across)));
      return {...p,...this.support(p.x,p.z,item.kind==='plank')};
    }));
    const a=Math.max(...ends[0].map(p=>p.height)),b=Math.max(...ends[1].map(p=>p.height));
    const pitch=item.kind==='plank'?-Math.atan2(b-a,along*2):0;
    const qy=yawRotation(angle),s=Math.sin(pitch/2),c=Math.cos(pitch/2);
    const rotation:Rotation={x:qy.w*s,y:qy.y*c,z:-qy.y*s,w:qy.w*c};
    const position={x:center.x,y:(item.kind==='plank'?(a+b)/2:Math.max(a,b))+size.height/2+config.fieldKit.clearance,z:center.z};
    const placement:Placement={kind:item.kind,position,rotation,valid:true,reason:'E · Place here',supports:[...new Set(ends.flat().flatMap(p=>p.id?[p.id]:[]))]};
    const invalid=(reason:string)=>{placement.valid=false;placement.reason=reason;return placement;};
    if(ends.flat().some(p=>!this.level.contains(p.x,p.z,1)))return invalid('Keep the item inside the clearing');
    if(Math.abs(b-a)/(along*2)>config.fieldKit.maxSlope || ends.some(end=>Math.abs(end[0].height-end[1].height)>.18))return invalid(item.kind==='plank'?'Rest both ends on the banks or stones':'Find flatter supports');
    if(item.kind==='stone'&&Math.max(a,b)-Math.min(...ends.flat().map(p=>p.height))>.22)return invalid('Place stones on stable ground');
    // Check the whole footprint: endpoints alone would allow planks through hills.
    for(let z=-1;z<=1.001;z+=.125)for(const x of [-.9,0,.9]) {
      const local=rotate({x:x*size.width/2,y:-size.height/2,z:z*size.length/2},rotation),p=add(position,local);
      if(this.level.groundHeight(p.x,p.z)>p.y+config.fieldKit.maxBurial)return invalid('The ground blocks that placement');
    }
    const occupied=this.world.intersectionWithShape(position,rotation,item.collider.shape,undefined,undefined,item.collider,undefined,c=>{
      const other=this.items.find(candidate=>candidate.collider.handle===c.handle);
      return other?!placement.supports.includes(other.id):c.shape.type!==RAPIER.ShapeType.TriMesh;
    });
    if(occupied)return invalid('Move clear of the bus, players and other items');
    const wheelLoad=this.world.intersectionWithShape(add(position,{x:0,y:1,z:0}),rotation,new RAPIER.Cuboid(size.width/2+.08,1.4,size.length/2+.08),undefined,undefined,item.collider,undefined,c=>c.parent()?.handle===this.vehicle.handle);
    if(wheelLoad)return invalid('Move the bus clear before placing a support');
    return placement;
  }
  place(player:Vec3,yaw:number,playerId='local-player'):boolean {
    const item=this.carried(playerId),preview=this.preview(player,yaw,playerId);if(!item||!preview)return false;
    if(!preview.valid){this.message=preview.reason;return true;}
    item.position={...preview.position};item.rotation={...preview.rotation};item.phase='placed';item.carrierId=null;item.supports=preview.supports;
    item.body.setTranslation(item.position,true);item.body.setRotation(item.rotation,true);item.collider.setEnabled(true);
    this.angles.delete(playerId);this.message='Support placed. Bring the wheels onto it slowly.';return true;
  }
  tick(player:Vec3,yaw:number,reel:number,dt:number,playerId='local-player') {
    const item=this.carried(playerId);
    if(item){this.angles.set(playerId,((this.angles.get(playerId)??0)+reel*config.fieldKit.rotationSpeed*dt)%(2*Math.PI));item.position=add(player,{x:Math.sin(yaw)*1.1,y:.35,z:Math.cos(yaw)*1.1});item.rotation=yawRotation(yaw+Math.PI/2);}
  }
  advance(dt:number) { this.pingTime=Math.max(0,this.pingTime-dt);if(!this.pingTime)this.ping=null; }
  mark(player:Vec3,yaw:number) {const p=this.level.safePlayerPosition(add(player,{x:Math.sin(yaw)*config.fieldKit.pingDistance,y:0,z:Math.cos(yaw)*config.fieldKit.pingDistance}));this.ping={x:p.x,y:this.level.groundHeight(p.x,p.z)+.15,z:p.z};this.pingTime=config.fieldKit.pingLifetime;}
  push(player:Vec3,held:boolean) {
    this.pushing=false;if(!held||distance(player,this.vehicle.translation())>config.fieldKit.pushReach||length(this.vehicle.linvel())>config.fieldKit.pushMaxSpeed)return;
    const delta=sub(this.vehicle.translation(),player),norm=Math.hypot(delta.x,delta.z);if(norm<.1)return;
    this.vehicle.addForceAtPoint({x:delta.x/norm*config.fieldKit.pushForce,y:0,z:delta.z/norm*config.fieldKit.pushForce},player,true);this.pushing=true;
  }
  snapshot(player:Vec3,yaw:number,playerId='local-player'):FieldKitSnapshot {
    return {items:this.items.map(({id,kind,phase,carrierId,position,rotation})=>({id,kind,phase,carrierId,position:{...position},rotation:{...rotation}})),carriedId:this.carried(playerId)?.id??null,preview:this.preview(player,yaw,playerId),pushing:this.pushing,ping:this.ping?{...this.ping}:null};
  }
}
