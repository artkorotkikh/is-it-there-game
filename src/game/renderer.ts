import * as pc from 'playcanvas';
import { Character, type Primitive } from './character';
import { config } from './config';
import { touchDevice } from './touch-controls';
import { cableRoute, cableShape, pathLength } from './cable';
import { CableVisual } from './cable-visual';
import { CanisterVisuals } from './canister-visual';
import { FieldKitVisuals } from './field-kit-visual';
import { drawInteractionTarget } from './interaction-visual';
import { Signage } from './signage';
import { defaultSkin, paintFor, decalStyles, type BusSkin } from './skin';
import { Level } from './level';
import { tracks, type Track } from './tracks';
import { lerp, mix } from './math';
import type { Snapshot, Vec3 } from './types';

/** PlayCanvas only visualizes snapshots. All colliders live in Simulation. */
export class Renderer {
  readonly app: pc.Application;
  private readonly camera: pc.Entity;
  private readonly rv: pc.Entity;
  private readonly character: Character;
  private teammates=new Map<string,Character>();
  private readonly wheels: pc.Entity[] = [];
  private readonly frontPivots: pc.Entity[] = [];
  private readonly rope: CableVisual;
  private readonly hook: pc.Entity;
  private readonly cargo: CanisterVisuals;
  private fieldKit:FieldKitVisuals|undefined;
  private readonly signage: Signage;
  private readonly quaternion = new pc.Quat();
  private readonly previousQuaternion = new pc.Quat();
  private cameraReady = false;
  private skin: BusSkin = {...defaultSkin};
  private paintParts: pc.Entity[] = [];
  private wheelTrims: {stock:pc.Entity; whitewall:pc.Entity; rally:pc.Entity}[] = [];
  private decalVariants = new Map<string,pc.Entity>();
  private materials = new Map<string, pc.StandardMaterial>();

  private level = new Level();
  private scenery!: pc.Entity;
  private sceneryBatch: number | undefined;
  private landscapeMeshes: pc.Mesh[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: true, alpha: false, powerPreference: 'high-performance' } });
    this.camera = new pc.Entity('Camera', this.app);
    this.rv = new pc.Entity('RV', this.app);
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, touchDevice() ? 1.25 : 1.75);
    this.app.scene.ambientLight = new pc.Color(0.58, 0.64, 0.59);
    this.app.scene.fog.type = pc.FOG_LINEAR;
    this.app.scene.fog.color = new pc.Color(0.76, 0.79, 0.68);
    this.app.scene.fog.start = 55;
    this.app.scene.fog.end = 175;
    this.camera.addComponent('camera', { clearColor: new pc.Color(0.76, 0.79, 0.68), farClip: 350, nearClip: 0.15, fov: 54 });
    this.app.root.addChild(this.camera);
    const sun = new pc.Entity('Late afternoon');
    sun.addComponent('light', { type: 'directional', color: new pc.Color(1, 0.86, 0.63), intensity: 1.5, castShadows: true, shadowDistance: 75, shadowResolution: touchDevice() ? 1024 : 2048, shadowBias: 0.2, normalOffsetBias: 0.04 });
    sun.setEulerAngles(48, -32, 0);
    this.app.root.addChild(sun);
    this.signage = new Signage(this.app);
    this.setTrack(tracks[0]);
    this.createVehicle();
    this.cargo = new CanisterVisuals(this.app, this.rv, (type, size, position, color, parent) => this.shape(type, size, position, color, parent), this.signage);
    this.character = new Character(this.app, (type, size, position, color, parent) => this.shape(type, size, position, color, parent));
    this.rope = new CableVisual(this.app, this.material('#f0bb59'));
    this.hook = this.shape('sphere', [0.14, 0.14, 0.14], [0, 0, 0], '#f0bb59', this.app.root);
    window.addEventListener('resize', () => this.app.resizeCanvas());
    this.app.start();
  }

  private material(hex: string) {
    let mat = this.materials.get(hex);
    if (!mat) {
      mat = new pc.StandardMaterial();
      mat.diffuse = new pc.Color().fromString(hex);
      mat.gloss = 0.2;
      mat.useMetalness = true;
      mat.metalness = 0;
      mat.update();
      this.materials.set(hex, mat);
    }
    return mat;
  }

  private shape(type: Primitive, size: number[], position: number[], color: string, parent = this.scenery) {
    const e = new pc.Entity(type);
    e.addComponent('render', { type, material: this.material(color), castShadows: true, receiveShadows: true });
    e.setLocalScale(size[0], size[1], size[2]);
    e.setLocalPosition(position[0], position[1], position[2]);
    parent.addChild(e);
    return e;
  }

  private meshRoad(width: number, offset: number, color: string) {
    this.meshSurface(this.level.roadMesh(width, offset), color);
  }

  private meshSurface({ positions, indices }: { positions: number[]; indices: number[] }, color: string, castShadows = false) {
    const mesh = new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setNormals(pc.calculateNormals(positions, indices));
    mesh.setIndices(indices);
    mesh.update();
    const entity = new pc.Entity('Road');
    entity.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, this.material(color))], castShadows });
    this.scenery.addChild(entity);
    this.landscapeMeshes.push(mesh);
  }

  private tree(x: number, z: number, height: number, marked = false) {
    const y = this.level.contains(x,z) ? this.level.groundHeight(x, z) : -9;
    this.shape('cylinder', [marked ? 1 : 0.55, height * 0.65, marked ? 1 : 0.55], [x, y + height * 0.3, z], '#635747');
    for (let layer = 0; layer < 3; layer++) {
      const w = height * ((marked ? 0.45 : 0.65) - layer * 0.1);
      this.shape('cone', [w, height * (marked ? 0.4 : 0.6), w], [x, y + height * (0.5 + layer * 0.18), z], marked ? '#476953' : this.level.track.palette.trees);
    }
    if (marked) {
      this.shape('cylinder', [1.06, 0.35, 1.06], [x, y + 1.1, z], '#efac53');
      this.shape('box', [1.5, 1.5, 0.12], [x, y + 3, z - 0.7], '#efac53').setEulerAngles(0, 0, 45);
      this.shape('box', [0.18, 0.8, 0.15], [x, y + 3, z - 0.8], '#3c4c40');
    }
  }

  setTrack(track: Track) {
    this.fieldKit?.destroy();this.fieldKit=track.map?new FieldKitVisuals(this.app):undefined;
    if(this.sceneryBatch!==undefined)this.app.batcher!.removeGroup(this.sceneryBatch);
    this.scenery?.destroy();
    for (const mesh of this.landscapeMeshes) mesh.destroy();
    this.landscapeMeshes = [];
    this.scenery = new pc.Entity('Track scenery', this.app);
    this.app.root.addChild(this.scenery);
    this.level = new Level(track);
    const sky = new pc.Color().fromString(track.palette.sky);
    this.app.scene.fog.color = sky;
    this.camera.camera!.clearColor = sky;
    this.createLandscape();
    // Scenery never moves within a run. Batch it separately from the articulated
    // bus/traveler so extra anchors don't cost a draw call per primitive.
    const group=this.app.batcher!.addGroup('Roadside scenery',false,60)!;
    this.sceneryBatch=group.id;
    for(const render of this.scenery.findComponents('render') as pc.RenderComponent[])render.batchGroupId=group.id;
    this.app.batcher!.generate([group.id]);
    this.cameraReady = false;
  }

  private createLandscape() {
    const track = this.level.track, palette = track.palette;
    if(track.map){this.createExpeditionLandscape();return;}
    const roadWidth = Math.min(3.7, track.roadHalfWidth - .3);
    this.shape('box', [360, 2, 380], [0, -10, 50], '#718166');
    this.meshSurface(this.level.terrainMesh(), palette.ground);
    this.meshRoad(roadWidth, .008, palette.verge);
    this.meshRoad(roadWidth-.8, .015, palette.road);
    // Seeded placement makes the scenery identical on every load and machine.
    let seed = 23 + Number(track.number)*7;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 32; i++) {
      const x = (i % 2 ? 1 : -1) * (62 + random() * 85);
      const z = -38 + random() * (this.level.maxZ + 50);
      const height = 24 + random() * 46;
      const mountain = this.shape('cone', [45 + random() * 35, height, 45 + random() * 35], [x, height / 2 - 12, z], ['#77836c', '#8a9074', '#667a69'][i % 3]);
      mountain.setEulerAngles(0, random() * 180, random() * 10 - 5);
    }
    const rockAt = this.level.rolloverRockPosition();
    for (let i = 0; i < (touchDevice() ? 42 : 67); i++) {
      const z = -18 + random() * (this.level.maxZ + 18);
      const x = this.level.centerX(z) + (i % 2 ? 1 : -1) * (6 + random() * 19);
      if (z > 20 || Math.abs(x-this.level.centerX(z))>18) {
        const height = 5 + random() * 5;
        // Keep the optional obstacle and its approach sign visible through the canopy.
        if (Math.hypot(x-rockAt.x,z-rockAt.z)>7) this.tree(x,z,height);
      }
    }
    for (let i = 0; i < 45; i++) {
      const z = -15 + random() * (this.level.maxZ + 15);
      const x = this.level.centerX(z) + (i % 2 ? 1 : -1) * (track.roadHalfWidth + .2 + random() * 3.4);
      const rock = this.shape('box', [0.2 + random() * 0.8, 0.2 + random() * 0.5, 0.4 + random()], [x, this.level.groundHeight(x,z), z], '#828472');
      rock.setEulerAngles(random() * 30, random() * 180, random() * 40);
    }
    for (let z = -8; z < this.level.maxZ-5; z += 7) {
      for (const offset of [-track.roadHalfWidth-.4, track.roadHalfWidth+.4]) {
        const x = this.level.centerX(z) + offset;
        this.shape('box', [0.14, 0.9, 0.14], [x, this.level.roadHeight(z) + 0.43, z], '#d6ccb0');
        this.shape('box', [0.17, 0.2, 0.17], [x, this.level.roadHeight(z) + 0.65, z], '#956b4a');
      }
    }
    for (const anchor of this.level.anchors) this.tree(anchor.x, anchor.z, 10, true);
    // Duplicate face vertices for flat stone facets while retaining the exact collider surface.
    const rock = this.level.rolloverRockMesh(), rockPositions = rock.indices.flatMap(i => rock.positions.slice(i*3,i*3+3));
    this.meshSurface({positions:rockPositions,indices:rock.indices.map((_,i)=>i)}, '#929188', true);
    const signX = rockAt.x + 1.8, signZ = rockAt.z - 3.8, signY = this.level.groundHeight(signX,signZ);
    this.shape('box',[.12,2.3,.12],[signX,signY+1.15,signZ],'#625c4d');
    this.signage.label(['ROLL TEST','ONE WHEEL ON','OR GO AROUND'],1.8,1.15,[signX,signY+2.1,signZ-.08],this.scenery,'#dfb476','#273d35');
    for (const block of track.obstacles) {
      const y = this.level.roadHeight(block.z), bx = this.level.centerX(block.z) + block.x;
      this.shape('box', [block.width, block.height, block.depth], [bx,y+block.height/2,block.z], '#596c70');
      this.signage.label(['RELAY WORKS', block.x < 0 ? '← KEEP LEFT' : 'KEEP RIGHT →'], block.width-.25,.75,[bx,y+.7,block.z-.51],this.scenery,palette.accent);
      for (let x=-block.width/2+.3;x<block.width/2;x+=.65) this.shape('box',[.3,.16,1.04],[bx+x,y+block.height+.06,block.z],'#e4d7b3');
    }
    if (track.id === 'finality-quarry') for (const side of [-1,1]) for (let z=75;z<track.finishZ;z+=24) {
      const x=this.level.centerX(z)+side*12, y=this.level.groundHeight(x,z);
      this.shape('box',[5,3.2,12],[x,y+1.2,z],'#927666');
      this.shape('box',[3.8,1.8,10],[x,y+3,z],'#ab8a74');
    }
    this.signage.label([track.number+' / '+track.name.toUpperCase()],3.2,.55,[-5.5,6.7,9.9],this.scenery,palette.accent);
    // Start sign and picnic stop.
    this.shape('box', [0.16, 3, 0.16], [-5.5, 4.5, 10], '#53594a');
    this.shape('box', [2.4, 1.2, 0.16], [-5.5, 5.6, 10], '#d6c599');
    this.shape('box', [1.6, 0.12, 0.1], [-5.5, 5.7, 9.89], '#5b684e');
    this.shape('box', [0.65, 0.12, 0.1], [-5.05, 5.49, 9.88], '#5b684e').setEulerAngles(0, 0, 35);
    this.signage.label(['PROBABLY WORKS', 'DELIVERIES ↑'], 2.25, 1.06, [-5.5, 5.6, 9.9], this.scenery);
    for (const ridgeZ of track.bumps) {
      const z = ridgeZ - 5;
      const y = this.level.roadHeight(z);
      this.shape('box', [.09, 2.1, .09], [this.level.centerX(z)+track.roadHalfWidth+.6, y + 1.05, z], '#586b60');
      this.signage.label(['!', 'LOOSE CARGO', 'SLOW DOWN'], 1.1, 1.22, [this.level.centerX(z)+track.roadHalfWidth+.6, y + 2.05, z], this.scenery, '#edb44e');
      // Visible gravel shoulders at the actual road-profile bumps.
      for (const x of [-3.4, -2.1, -.9, .6, 1.8, 3.2]) {
        const pebble = this.shape('box', [.2, .06, .13], [this.level.centerX(ridgeZ)+x, this.level.roadHeight(ridgeZ) + .035, ridgeZ], '#887958');
        pebble.setEulerAngles(0, x * 17, 0);
      }
    }
    this.shape('box', [2.6, 0.2, 1.25], [6.1, 4, -4], '#8c7357');
    for (const z of [-4.4, -3.6]) this.shape('box', [2.9, 0.18, 0.32], [6.1, 3.6, z + (z < -4 ? -0.7 : 0.7)], '#8c7357');
    for (const x of [5.2, 7]) this.shape('box', [0.2, 0.95, 1.8], [x, 3.5, -4], '#6c6350');
    const finish = track.finishZ + 3, finishX = this.level.centerX(finish);
    for (const x of [-4.7, 4.7]) this.shape('box', [.45, 5.8, .45], [finishX+x, this.level.roadHeight(finish) + 2.9, finish], '#465b4b');
    this.shape('box', [10, .95, .5], [finishX, this.level.roadHeight(finish) + 5.4, finish], '#394c4d');
    this.signage.label(['YES. WE GOT IT THERE.'], 8.5, .65, [finishX, this.level.roadHeight(finish) + 5.4, finish - .27], this.scenery, '#394c4d', '#efdfb7');
    ['#e3a34c', '#df729d', '#ad83d8', '#65c8d0'].forEach((color, i) => {
      this.shape('box', [2.5, .12, .06], [finishX-3.75 + i * 2.5, this.level.roadHeight(finish) + 6, finish - .27], color);
    });
  }

  private createExpeditionLandscape() {
    const map=this.level.track.map!,t=map.terrain;
    this.shape('box',[360,2,380],[0,-10,50],'#718166');
    const mesh=this.level.terrainMesh();this.meshSurface(mesh,'#83906a');
    // Broad exposed ground follows actual triangles; there is no painted optimal path.
    const dirt:number[]=[],cliff:number[]=[];
    for(let i=0;i<mesh.indices.length;i+=3){const triangle=mesh.indices.slice(i,i+3),p=triangle.map(k=>mesh.positions.slice(k*3,k*3+3));const x=p.reduce((s,v)=>s+v[0],0)/3,z=p.reduce((s,v)=>s+v[2],0)/3;
      if(x<t.originX+7||x>t.originX+(t.columns-1)*t.cellSize-7||z<t.originZ+(t.rows-1)*t.cellSize*.25||z>t.originZ+(t.rows-1)*t.cellSize*.8)continue;
      const steep=Math.max(...p.map(v=>v[1]))-Math.min(...p.map(v=>v[1]))>.65;
      (steep?cliff:dirt).push(...triangle);
    }
    const surface=mesh.positions.map((n,i)=>i%3===1?n+.012:n);
    this.meshSurface({positions:surface,indices:dirt},'#b2a07c');this.meshSurface({positions:surface,indices:cliff},'#7c806f');
    for(const a of this.level.anchors)this.tree(a.x,a.z,9,true);
    for(let z=t.originZ+3;z<this.level.maxZ-2;z+=7)for(const x of [t.originX+3,t.originX+(t.columns-1)*t.cellSize-3])this.tree(x,z,7+Math.abs(Math.sin(z))*3);
    for(const b of map.obstacles){const e=this.shape('box',[b.width,b.height,b.depth],[b.x,this.level.groundHeight(b.x,b.z)+b.height/2,b.z],'#727d70');e.setEulerAngles(0,b.yaw*pc.math.RAD_TO_DEG,0);}
    for(const x of [t.originX-33,t.originX+(t.columns-1)*t.cellSize+33])for(let z=t.originZ;z<this.level.maxZ+15;z+=26){const m=this.shape('cone',[40,38,44],[x,6,z],'#75816c');m.setEulerAngles(0,z*3,0);}
    const fx=map.finish.x,fz=map.finish.z,fy=this.level.groundHeight(fx,fz);
    for(const side of [-1,1])this.shape('box',[.25,4,.25],[fx+side*4.5,fy+2,fz],'#e7d9af');
    this.signage.label(['PRODUCTION','PROBABLY WORKS · LIVE'],8.7,1.3,[fx,fy+3.8,fz],this.scenery,'#edb44e','#273d35');
    for(let i=0;i<20;i++){const a=i/20*Math.PI*2,x=fx+Math.sin(a)*map.finish.radius,z=fz+Math.cos(a)*map.finish.radius;this.shape('box',[.45,.05,.45],[x,this.level.groundHeight(x,z)+.04,z],'#e7d9af');}
    const signX=map.spawn.vehicle.x-7,signZ=map.spawn.vehicle.z+2,signY=this.level.groundHeight(signX,signZ);
    this.shape('box',[.14,2.8,.14],[signX,signY+1.4,signZ],'#635747');
    this.signage.label(['LOCAL BUILD',map.name.toUpperCase()],3.8,1.15,[signX,signY+2.4,signZ-.1],this.scenery,'#d6c599','#273d35');
    const supply=map.resources[0];if(supply){const x=supply.x+2,z=supply.z+3;this.signage.label(['ROAD CREW SUPPLIES','TAKE WHAT YOU NEED'],3,.85,[x,this.level.groundHeight(x,z)+1.9,z],this.scenery,'#c3aa7b','#273d35');}
  }

  private createVehicle() {
    this.app.root.addChild(this.rv);
    const paint = (size:number[],position:number[]) => {const part=this.shape('box',size,position,paintFor(this.skin).hex,this.rv);this.paintParts.push(part);};
    paint([2.16,1.5,3.85],[0,0,.425]);
    this.shape('box', [2.18, .56, 3.85], [0, -.28, .425], '#8b9b81', this.rv);
    for (const x of [-1.02, 1.02]) paint([.12,1.5,.85],[x,0,-1.925]);
    this.shape('box', [2.16, .2, .85], [0, -.65, -1.925], '#52645c', this.rv);
    paint([2.16,.14,.85],[0,.68,-1.925]);
    for (const x of [-1.103, 1.103]) {
      for (const z of [-1.25, .3]) this.shape('box', [.035, .045, .24], [x, -.48, z], '#786e57', this.rv).setLocalEulerAngles(x > 0 ? -12 : 12, 0, 0);
    }
    paint([2.14,.22,4.4],[0,.83,-.05]);
    this.shape('box', [1.78, 0.64, 0.035], [0, 0.39, 2.36], '#344e4d', this.rv);
    this.shape('box', [0.06, 0.66, 0.05], [0, 0.39, 2.39], '#b9bda1', this.rv);
    for (const x of [-1.09, 1.09]) {
      this.shape('box', [0.035, 0.58, 0.86], [x, 0.41, 1.64], '#344e4d', this.rv);
      this.shape('box', [0.2, 0.33, 0.34], [x * 1.15, 0.24, 1.97], '#4d5950', this.rv);
    }
    paint([.07,1.17,.74],[1.13,-.1,.75]);
    this.shape('box', [0.1, 0.07, 0.18], [1.19, 0.03, 0.51], '#586353', this.rv);
    for (const x of [-0.78, 0.78]) {
      this.shape('box', [0.38, 0.26, 0.12], [x, -0.34, 2.43], '#f6dc9a', this.rv);
      this.shape('box', [0.2, 0.32, 0.1], [x, -0.3, -2.39], '#9a5943', this.rv);
    }
    this.shape('box', [0.9, 0.27, 0.06], [0, -0.38, 2.42], '#536258', this.rv);
    this.shape('box', [2.3, 0.18, 0.2], [0, -0.68, 2.44], '#56645c', this.rv);
    this.shape('box', [2.3, 0.18, 0.2], [0, -0.68, -2.44], '#56645c', this.rv);
    this.shape('box', [1.1, 0.27, 1.4], [0, 1.02, -0.65], '#aab299', this.rv);
    this.createDecals();
    this.shape('box', [0.6, 0.25, 0.3], [0, -0.25, 2.5], '#49584d', this.rv);
    for (const z of [config.vehicle.wheelZ, -config.vehicle.wheelZ]) {
      for (const x of [-config.vehicle.wheelX, config.vehicle.wheelX]) {
        const pivot = new pc.Entity('Wheel steering');
        pivot.setLocalPosition(x, -0.8, z);
        this.rv.addChild(pivot);
        const tire = this.shape('cylinder', [0.9, 0.33, 0.9], [0, 0, 0], '#323d36', pivot);
        tire.setEulerAngles(0, 0, 90);
        const stock=this.shape('cylinder',[.47,1.035,.47],[0,0,0],'#b3b6a0',tire);
        const whitewall=new pc.Entity('Whitewall trim');tire.addChild(whitewall);
        this.shape('cylinder',[.77,1.04,.77],[0,0,0],'#efe6cc',whitewall);
        this.shape('cylinder',[.50,1.06,.50],[0,0,0],'#46594e',whitewall);
        this.shape('cylinder',[.20,1.075,.20],[0,0,0],'#d4c79e',whitewall);
        const rally=new pc.Entity('Rally trim');tire.addChild(rally);
        this.shape('cylinder',[.63,1.04,.63],[0,0,0],'#bb8753',rally);
        this.shape('cylinder',[.16,1.07,.16],[0,0,0],'#e7d4a5',rally);
        for(const side of [-1,1]) for(let spoke=0;spoke<5;spoke++) {
          const angle=spoke*Math.PI*2/5;
          this.shape('cylinder',[.10,.016,.10],[Math.sin(angle)*.21,side*.531,Math.cos(angle)*.21],'#323d36',rally);
        }
        whitewall.enabled=false;rally.enabled=false;
        this.wheelTrims.push({stock,whitewall,rally});
        this.wheels.push(tire);
        this.frontPivots.push(pivot);
      }
    }
  }

  private createDecals() {
    // Create the bounded variants once; repeated profile edits reuse meshes/textures.
    for(const style of decalStyles) {
      const group=new pc.Entity(`Stickers ${style.id}`);this.rv.addChild(group);this.decalVariants.set(style.id,group);
      for(const x of [-1.103,1.103]) this.signage.appWindow(2.3,1.13,[x*1.01,.08,-.73],group,style.id).setLocalEulerAngles(0,x>0?-90:90,0);
      this.signage.appWindow(1.78,1.42,[0,.947,1.04],group,style.id).setLocalEulerAngles(90,0,0);
      group.enabled=style.id===this.skin.decal;
    }
  }
  setSkin(skin:BusSkin) {
    if(JSON.stringify(skin)===JSON.stringify(this.skin)) return;
    this.skin={...skin};
    for(const part of this.paintParts) for(const mesh of part.render!.meshInstances) mesh.material=this.material(paintFor(skin).hex);
    for(const trim of this.wheelTrims) {trim.stock.enabled=skin.wheels==='stock';trim.whitewall.enabled=skin.wheels==='whitewall';trim.rally.enabled=skin.wheels==='rally';}
    for(const [id,group] of this.decalVariants) group.enabled=id===skin.decal;
  }

  draw(previous: Snapshot, current: Snapshot, alpha: number, yaw: number, pitch: number, menu: boolean, dt: number) {
    const pos = mix(previous.vehicle.position, current.vehicle.position, alpha);
    const q = current.vehicle.rotation;
    const p = previous.vehicle.rotation;
    this.previousQuaternion.set(p.x, p.y, p.z, p.w);
    this.quaternion.slerp(this.previousQuaternion, new pc.Quat(q.x, q.y, q.z, q.w), alpha);
    this.rv.setPosition(pos.x, pos.y, pos.z);
    this.rv.setRotation(this.quaternion);
    for (let i = 0; i < 4; i++) {
      const wheel = current.vehicle.wheels[i];
      this.frontPivots[i].setLocalPosition(i % 2 ? config.vehicle.wheelX : -config.vehicle.wheelX, config.vehicle.wheelY - wheel.suspension, i < 2 ? config.vehicle.wheelZ : -config.vehicle.wheelZ);
      this.frontPivots[i].setLocalEulerAngles(0, i < 2 ? current.vehicle.steering * pc.math.RAD_TO_DEG : 0, 0);
      this.wheels[i].setLocalEulerAngles(0, wheel.rotation * pc.math.RAD_TO_DEG, 90);
    }
    const pp = mix(previous.player.position, current.player.position, alpha);
    this.fieldKit?.draw(previous,current,alpha);
    this.character.update(current, pp, dt, menu);
    for(const player of current.players??[])if(player.id!==current.player.id) {
      const id=player.id!;let character=this.teammates.get(id);
      if(!character){character=new Character(this.app,(type,size,position,color,parent)=>this.shape(type,size,position,color,parent));this.teammates.set(id,character);}
      const prior=previous.players?.find(p=>p.id===id)??player,kit=current.fieldKit;
      character.update({...current,player,recovery:{...current.recovery,available:false,charge:0,animation:0},...(kit?{fieldKit:{...kit,carriedId:kit.items.find(item=>item.carrierId===id)?.id??null,preview:null}}:{})},mix(prior.position,player.position,alpha),dt,menu);
    }
    for(const [id,character]of this.teammates)if(!(current.players??[]).some(player=>player.id===id&&id!==current.player.id)){character.root.enabled=false;}
    this.cargo.draw(previous, current, alpha, dt);
    if(!menu)drawInteractionTarget(this.app,current);
    this.rope.entity.enabled = current.winch.phase !== 'stowed';
    this.hook.enabled = this.rope.entity.enabled;
    if (this.rope.entity.enabled) {
      const a = mix(previous.winch.mount, current.winch.mount, alpha);
      const carrier=current.winch.carrierId===current.player.id?this.character:this.teammates.get(current.winch.carrierId??'');
      const b = current.winch.phase === 'carried' ? carrier?.cableHand()??current.winch.end : current.winch.phase === previous.winch.phase ? mix(previous.winch.end, current.winch.end, alpha) : current.winch.end;
      const paidOut = current.winch.phase === 'carried' ? pathLength(cableRoute(a, b, this.level)) + config.winch.attachSlack : current.winch.phase === previous.winch.phase ? lerp(previous.winch.length, current.winch.length, alpha) : current.winch.length;
      this.rope.update(cableShape(a, b, paidOut, this.level));
      this.hook.setPosition(b.x, b.y, b.z);
    }
    const pulling = !menu && !current.player.driving && current.winch.phase === 'attached';
    const loading = !menu && !current.player.driving && !current.systems.startupCompleted && Math.hypot(pp.x - pos.x, pp.z - pos.z) < 10;
    const target: Vec3 = menu ? { x: pos.x - 1.8, y: pos.y + 0.7, z: pos.z + 1.5 } : loading ? { x: pos.x, y: pos.y + .1, z: pos.z - 1.6 } : current.player.driving ? { x: pos.x, y: pos.y + 0.7, z: pos.z + 1 } : pulling ? { x: (pos.x + pp.x) / 2, y: (pos.y + pp.y) / 2 + 0.6, z: (pos.z + pp.z) / 2 } : { x: pp.x, y: pp.y + 0.45, z: pp.z };
    // Fit a sphere around both subjects, including chassis extents, inside the
    // narrower FOV. A horizontal-distance heuristic clipped the RV on slopes.
    const halfFov = this.camera.camera!.fov * pc.math.DEG_TO_RAD / 2;
    const aspect = this.app.graphicsDevice.width / this.app.graphicsDevice.height;
    const frameFov = Math.min(halfFov, Math.atan(Math.tan(halfFov) * aspect));
    const radius = pulling ? (Math.hypot(pos.x - pp.x, pos.y - pp.y, pos.z - pp.z) / 2 + 4) / Math.sin(frameFov) : loading ? 11 * Math.max(1,.8/aspect) : current.player.driving ? 10.5 * Math.max(1,.65/aspect) : 7 * Math.max(1,.6/aspect);
    const cameraPitch = pulling ? Math.max(0.6, pitch) : loading ? Math.max(.5, pitch) : pitch;
    const desired = menu ? { x: pos.x + 13, y: pos.y + 7.5, z: pos.z + 15 } : {
      x: target.x - Math.sin(yaw) * Math.cos(cameraPitch) * radius,
      y: target.y + Math.sin(cameraPitch) * radius + 1,
      z: target.z - Math.cos(yaw) * Math.cos(cameraPitch) * radius,
    };
    // Keep the orbit above the road; full occlusion handling is a later polish task.
    if (this.level.contains(desired.x,desired.z)) desired.y = Math.max(desired.y, this.level.groundHeight(desired.x, desired.z) + 1.2);
    const cp = this.camera.getPosition();
    const t = this.cameraReady ? 1 - Math.exp(-7 * dt) : 1;
    this.camera.setPosition(lerp(cp.x, desired.x, t), lerp(cp.y, desired.y, t), lerp(cp.z, desired.z, t));
    this.camera.lookAt(target.x, target.y, target.z);
    this.cameraReady = true;
  }

  resetCamera() { this.cameraReady = false; this.character.reset();for(const character of this.teammates.values())character.reset(); }

  marker(position: Vec3) {
    const projected = this.camera.camera!.worldToScreen(new pc.Vec3(position.x, position.y + .65, position.z));
    const delta = new pc.Vec3(position.x, position.y, position.z).sub(this.camera.getPosition());
    const behind = this.camera.forward.dot(delta) < 0;
    return { x: projected.x * window.innerWidth / this.app.graphicsDevice.width, y: projected.y * window.innerHeight / this.app.graphicsDevice.height, behind };
  }
}
