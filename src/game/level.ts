import { config } from './config';
import { clamp, lerp } from './math';
import { tracks, type Track } from './tracks';
import type { Vec3 } from './types';

/** Instance-owned geometry: switching tracks never changes another simulation. */
export class Level {
  readonly anchor: Vec3;
  readonly anchors: readonly (Vec3 & {id:string})[];
  readonly rows: readonly number[];
  private readonly centers: readonly (readonly [number,number])[];
  readonly minZ: number;
  readonly maxZ: number;
  constructor(readonly track: Track = tracks[0]) {
    if (track.map) {
      const t=track.map.terrain;
      this.minZ=t.originZ;this.maxZ=t.originZ+(t.rows-1)*t.cellSize;
      this.centers=[[this.minZ,0],[this.maxZ,0]];
      this.rows=Array.from({length:t.rows},(_,i)=>t.originZ+i*t.cellSize);
      this.anchors=track.map.anchors.map(a=>({id:a.id,x:a.x,z:a.z,y:this.groundHeight(a.x,a.z)+1.1}));
      this.anchor=this.anchors[0];return;
    }
    this.minZ = track.profile[0][0];
    this.maxZ = track.profile[track.profile.length - 1][0];
    // Bake smooth bends into short linear segments. Sampling, mesh and cable
    // all use these same segments rather than disagreeing about a curved edge.
    const centers: [number,number][]=[];
    for(let i=1;i<track.centerline.length;i++) {
      const [a,x]=track.centerline[i-1], [b,y]=track.centerline[i];
      const count=x===y ? 1 : Math.max(1,Math.ceil((b-a)/2));
      for(let j=0;j<count;j++) {const t=j/count; centers.push([lerp(a,b,t),lerp(x,y,t*t*(3-2*t))]);}
    }
    centers.push([...track.centerline[track.centerline.length-1]]);
    this.centers=centers;
    this.rows=[...new Set([...track.profile.map(p=>p[0]),...centers.map(p=>p[0])])].sort((a,b)=>a-b);
    this.anchor = { x: track.anchorX, y: this.roadHeight(track.anchorZ) + 1.1, z: track.anchorZ };
    const anchors=[{...this.anchor,id:'recovery-tree'}];
    for(let z=24;z<track.finishZ;z+=28) for(const side of [-1,1]) {
      const x=this.centerX(z)+side*(track.roadHalfWidth+1.2);
      anchors.push({id:`tree-${z}-${side}`,x,y:this.groundHeight(x,z)+1.1,z});
    }
    this.anchors=anchors;
  }
  centerX(z:number):number {
    for(let i=1;i<this.centers.length;i++) {const [a,x]=this.centers[i-1],[b,y]=this.centers[i]; if(z<=b)return lerp(x,y,clamp((z-a)/(b-a),0,1));}
    return this.centers[this.centers.length-1][1];
  }
  roadHeight(z: number): number {
    if(this.track.map)return this.groundHeight(0,z);
    const profile = this.track.profile;
    for (let i = 1; i < profile.length; i++) {
      const [z1,y1] = profile[i-1], [z2,y2] = profile[i];
      if (z <= z2) return lerp(y1,y2,Math.max(0,(z-z1)/(z2-z1)));
    }
    return profile[profile.length-1][1];
  }
  groundHeight(x: number, z: number) {
    const t=this.track.map?.terrain;
    if(t) {
      const gx=clamp((x-t.originX)/t.cellSize,0,t.columns-1),gz=clamp((z-t.originZ)/t.cellSize,0,t.rows-1);
      const ix=Math.min(t.columns-2,Math.floor(gx)),iz=Math.min(t.rows-2,Math.floor(gz));
      const u=gx-ix,v=gz-iz,i=iz*t.columns+ix;
      const a=t.heights[i],b=t.heights[i+1],c=t.heights[i+t.columns],d=t.heights[i+t.columns+1];
      // Same a-c-b / b-c-d diagonal as terrainMesh, not bilinear interpolation.
      return u+v<=1 ? a+(b-a)*u+(c-a)*v : d+(c-d)*(1-u)+(b-d)*(1-v);
    }
    return this.roadHeight(z) - Math.max(0,Math.abs(x-this.centerX(z))-this.track.roadHalfWidth)*this.track.shoulderSlope;
  }
  terrainMesh() {
    const t=this.track.map?.terrain;
    if(t) {
      const positions:number[]=[],indices:number[]=[];
      for(let z=0;z<t.rows;z++)for(let x=0;x<t.columns;x++)positions.push(t.originX+x*t.cellSize,t.heights[z*t.columns+x],t.originZ+z*t.cellSize);
      for(let z=0;z<t.rows-1;z++)for(let x=0;x<t.columns-1;x++){const a=z*t.columns+x;indices.push(a,a+t.columns,a+1,a+1,a+t.columns,a+t.columns+1);}
      return {positions,indices};
    }
    const xs = [-config.terrain.halfWidth,-this.track.roadHalfWidth,0,this.track.roadHalfWidth,config.terrain.halfWidth];
    const positions: number[] = [], indices: number[] = [];
    for (const z of this.rows) for (const x of xs) positions.push(x+this.centerX(z),this.groundHeight(x+this.centerX(z),z),z);
    for (let row=0;row<this.rows.length-1;row++) for(let col=0;col<xs.length-1;col++) {
      const a=row*xs.length+col; indices.push(a,a+xs.length,a+1,a+1,a+xs.length,a+xs.length+1);
    }
    return {positions,indices};
  }
  safePlayerPosition(position: Vec3): Vec3 {
    const t=config.terrain;
    const z=clamp(position.z,this.minZ+t.edgeMargin,this.maxZ-t.edgeMargin);
    const center=this.centerX(z);
    const grid=this.track.map?.terrain;
    const minX=grid?grid.originX:center-t.halfWidth,maxX=grid?grid.originX+(grid.columns-1)*grid.cellSize:center+t.halfWidth;
    const x=clamp(position.x,minX+t.edgeMargin,maxX-t.edgeMargin);
    const floor=this.groundHeight(x,z)+config.player.halfHeight+config.player.radius+.02;
    return {x,y:Math.max(position.y,floor),z};
  }

  contains(x:number,z:number,margin=0):boolean {
    const t=this.track.map?.terrain;
    const minX=t?t.originX:this.centerX(z)-config.terrain.halfWidth;
    const maxX=t?t.originX+(t.columns-1)*t.cellSize:this.centerX(z)+config.terrain.halfWidth;
    return x>=minX+margin&&x<=maxX-margin&&z>=this.minZ+margin&&z<=this.maxZ-margin;
  }

  /** Exact crossings of every heightfield triangle edge for terrain-only rope support. */
  gridBreaks(start:Vec3,end:Vec3):number[] {
    const t=this.track.map?.terrain;if(!t)return [];
    const values:number[]=[];
    const cross=(a:number,b:number,origin:number,count:number)=>{
      if(Math.abs(b-a)<1e-8)return;
      const first=Math.max(0,Math.ceil((Math.min(a,b)-origin)/t.cellSize));
      const last=Math.min(count-1,Math.floor((Math.max(a,b)-origin)/t.cellSize));
      for(let i=first;i<=last;i++){const f=(origin+i*t.cellSize-a)/(b-a);if(f>0&&f<1)values.push(f);}
    };
    cross(start.x,end.x,t.originX,t.columns);cross(start.z,end.z,t.originZ,t.rows);
    cross(start.x+start.z,end.x+end.z,t.originX+t.originZ,t.columns+t.rows-1);
    return values;
  }
  roadMesh(halfWidth: number, offsetY=0) {
    const positions: number[]=[],indices: number[]=[];
    for (const z of this.rows) {const x=this.centerX(z),y=this.roadHeight(z);positions.push(x-halfWidth,y+offsetY,z,x+halfWidth,y+offsetY,z);}
    for (let i=0;i<this.rows.length-1;i++) {const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    return {positions,indices};
  }

  rolloverRockPosition(): Vec3 {
    const z = this.track.rolloverRockZ, x = this.centerX(z) + config.rolloverRock.roadOffset;
    return { x, y: this.groundHeight(x, z), z };
  }

  /** One convex, faceted stone shared by collision and rendering; no roll trigger/impulse. */
  rolloverRockMesh() {
    const { width: w, length: d, height: h, peakFraction } = config.rolloverRock;
    const p = this.rolloverRockPosition();
    const points = [[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[-w*.32,h,d*peakFraction],[w*.32,h,d*peakFraction]];
    return {
      positions: points.flatMap(([x,y,z]) => [p.x+x,p.y+y,p.z+z]),
      indices: [0,1,2,0,2,3,0,5,1,0,4,5,3,5,4,3,2,5,0,3,4,1,5,2],
    };
  }
}
// Existing tuning/tests can use the original route without setting global state.
export const defaultLevel=new Level();
export const roadProfile=defaultLevel.track.profile;
export const anchor=defaultLevel.anchor;
export const roadHeight=(z:number)=>defaultLevel.roadHeight(z);
export const groundHeight=(x:number,z:number)=>defaultLevel.groundHeight(x,z);
export const terrainMesh=()=>defaultLevel.terrainMesh();
export const roadMesh=(width:number,offset=0)=>defaultLevel.roadMesh(width,offset);
export const safePlayerPosition=(p:Vec3)=>defaultLevel.safePlayerPosition(p);
