import * as pc from 'playcanvas';
import { resourceMesh, type ResourceKind } from './field-kit';
import { mix } from './math';
import type { Snapshot } from './types';

/** Props and placement ghosts read snapshots only; shared mesh defines collision. */
export class FieldKitVisuals {
  private root:pc.Entity;
  private objects=new Map<string,pc.Entity>();
  private meshes=new Map<ResourceKind,pc.Mesh>();
  private materials:pc.StandardMaterial[]=[];
  private ghosts=new Map<ResourceKind,pc.Entity>();
  private ghostMaterial:pc.StandardMaterial;
  private ping:pc.Entity;
  private q=new pc.Quat();
  private previousQ=new pc.Quat();
  constructor(private app:pc.Application) {
    this.root=new pc.Entity('Field kit');app.root.addChild(this.root);
    this.ghostMaterial=this.material('#83d99b',.38);
    for(const kind of ['plank','stone'] as const){this.ghosts.set(kind,this.entity(kind,this.ghostMaterial));this.ghosts.get(kind)!.enabled=false;}
    this.ping=new pc.Entity('Crew marker');this.ping.addComponent('render',{type:'cylinder',material:this.material('#f0bb59'),castShadows:false});this.ping.setLocalScale(.65,.08,.65);this.root.addChild(this.ping);this.ping.enabled=false;
  }
  private material(color:string,opacity=1) {
    const mat=new pc.StandardMaterial();mat.diffuse=new pc.Color().fromString(color);mat.gloss=.1;
    if(opacity<1){mat.opacity=opacity;mat.blendType=pc.BLEND_NORMAL;mat.depthWrite=false;}
    mat.update();this.materials.push(mat);return mat;
  }
  private entity(kind:ResourceKind,material:pc.StandardMaterial) {
    let mesh=this.meshes.get(kind);
    if(!mesh){const source=resourceMesh(kind),positions=source.indices.flatMap(i=>source.positions.slice(i*3,i*3+3)),indices=source.indices.map((_,i)=>i);mesh=new pc.Mesh(this.app.graphicsDevice);mesh.setPositions(positions);mesh.setNormals(pc.calculateNormals(positions,indices));mesh.setIndices(indices);mesh.update();this.meshes.set(kind,mesh);}
    const entity=new pc.Entity(kind);entity.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,material)],castShadows:material.opacity===1});this.root.addChild(entity);return entity;
  }
  draw(previous:Snapshot,current:Snapshot,alpha:number) {
    const kit=current.fieldKit;this.root.enabled=Boolean(kit);if(!kit)return;
    for(const item of kit.items) {
      let entity=this.objects.get(item.id);
      if(!entity){entity=this.entity(item.kind,this.material(item.kind==='plank'?'#c6a471':'#92968b'));entity.name=item.id;this.objects.set(item.id,entity);}
      const prior=previous.fieldKit?.items.find(p=>p.id===item.id),p=prior&&prior.phase===item.phase?mix(prior.position,item.position,alpha):item.position;
      entity.setPosition(p.x,p.y,p.z);
      const r=item.rotation;this.q.set(r.x,r.y,r.z,r.w);
      if(prior&&prior.phase===item.phase){const q=prior.rotation;this.previousQ.set(q.x,q.y,q.z,q.w);this.q.slerp(this.previousQ,this.q,alpha);}
      entity.setRotation(this.q);
    }
    for(const [kind,ghost] of this.ghosts){const preview=kit.preview;ghost.enabled=Boolean(preview&&preview.kind===kind);if(!preview)continue;const p=preview.position,r=preview.rotation;ghost.setPosition(p.x,p.y,p.z);ghost.setRotation(r.x,r.y,r.z,r.w);}
    this.ghostMaterial.diffuse.fromString(kit.preview?.valid?'#83d99b':'#ee826d');this.ghostMaterial.update();
    this.ping.enabled=Boolean(kit.ping);if(kit.ping)this.ping.setPosition(kit.ping.x,kit.ping.y,kit.ping.z);
  }
  destroy(){this.root.destroy();for(const mesh of this.meshes.values())mesh.destroy();for(const mat of this.materials)mat.destroy();}
}
