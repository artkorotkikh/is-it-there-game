import {beforeAll,expect,it} from 'vitest';
import {initPhysics,Simulation} from '../src/game/simulation';
import {mapTrack} from '../src/game/maps/catalog';
import {parseMap} from '../src/game/maps/schema';
import rawMap from '../src/game/maps/data/forest-crossing.json';
import {neutralInput} from '../src/game/types';
import {rotate} from '../src/game/math';
import {config} from '../src/game/config';
import {advance,placePlayer} from './cargo-helpers';

beforeAll(initPhysics);
const create=()=>{const s=new Simulation('road',mapTrack(parseMap(rawMap)));advance(s,1);return s;};
function relocate(s:Simulation,id:string,x:number,z:number){
 const item=s.fieldKit!.items.find(i=>i.id===id)!;
 placePlayer(s,item.position.x,item.position.z-1);s.action('interact');expect(s.fieldKit!.carried()?.id,s.message).toBe(id);
 placePlayer(s,x,z-config.fieldKit.placementReach);s.action('interact');expect(item.phase,s.message).toBe('placed');advance(s,.1);
}
function clear(s:Simulation,route:string,x:number,z:number){
 for(const [i,side] of ['west','east'].entries())relocate(s,`stone-${route}-${side}`,x+(i?5:-5),z-10);
}
function board(s:Simulation){const p=s.vehicle.translation();placePlayer(s,p.x-3.1,p.z);s.action('interact');expect(s.snapshot().player.driving,s.message).toBe(true);advance(s,.1);}
function drive(s:Simulation,points:number[][],finish=false){
 let waypoint=0;
 for(let tick=0;tick<20000;tick++){
  const snap=s.snapshot(),p=snap.vehicle.position,target=points[waypoint];
  if(Math.hypot(target[0]-p.x,target[1]-p.z)<(waypoint===points.length-1?1.3:2.5)){
   if(waypoint===points.length-1)break;waypoint++;
  }
  if(finish&&snap.progress.finished)break;
  const forward=rotate({x:0,y:0,z:1},snap.vehicle.rotation),desired=Math.atan2(points[waypoint][0]-p.x,points[waypoint][1]-p.z),yaw=Math.atan2(forward.x,forward.z),delta=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));
  s.step({...neutralInput(),moveZ:snap.vehicle.speed<1.5?1:0,moveX:Math.max(-1,Math.min(1,-delta*2)),brake:snap.vehicle.speed>1.8});
 }
 const end=s.snapshot(),target=points[points.length-1],detail=JSON.stringify({position:end.vehicle.position,loaded:end.systems.loaded,waypoint});
 if(finish)expect(end.progress.finished,detail).toBe(true);
 else expect(Math.hypot(end.vehicle.position.x-target[0],end.vehicle.position.z-target[1]),detail).toBeLessThan(1.4);
 advance(s,1,{brake:true});
}
function attach(s:Simulation,id:string){
 const mount=s.mount();placePlayer(s,mount.x+1.7,mount.z);s.action('winch');expect(s.snapshot().winch.phase,s.message).toBe('carried');
 const tree=s.level.anchors.find(a=>a.id===id)!;placePlayer(s,tree.x,tree.z-1.8);s.action('interact');expect(s.snapshot().winch.phase,s.message).toBe('attached');
}
it('the extended right route delivers after clearing stones and crossing its hollow and climb',()=>{
 const s=create();try{
  for(const [i,id] of ['stone-4','stone-5','stone-6'].entries())relocate(s,id,i===1?24:21,(i===2?16:20)+config.fieldKit.placementReach);
  clear(s,'right',18,106);board(s);
  drive(s,[[16,25],[20,38],[20,47],[19,53],[18,65],[18,99],[18,124],[18,146],[12,158],[0,170]],true);
  expect(s.fieldKit!.items.filter(i=>i.kind==='plank').every(i=>i.phase==='available')).toBe(true);
 }finally{s.destroy();}
});
it('the extended center route delivers over two planks, cleared stones, a hollow and a climb',()=>{
 const s=create();try{
  relocate(s,'plank-1',1.04,43.5);relocate(s,'plank-2',-1.04,43.5);clear(s,'center',0,94);board(s);
  drive(s,[[0,35],[0,54],[0,99],[0,112],[0,132],[0,170]],true);
 }finally{s.destroy();}
});
it('the extended left route delivers using its hill anchor, cleared stones and lower hollow',()=>{
 const s=create();try{
  relocate(s,'stone-1',-18,10);relocate(s,'stone-2',-20,14);
  clear(s,'left',-18,82);board(s);drive(s,[[-18,25],[-20,33],[-20,36]]);
  s.action('interact');attach(s,'anchor-3');
  for(let i=0;i<2400&&s.vehicle.translation().z<49;i++)s.step({...neutralInput(),reel:1});
  expect(s.vehicle.translation().z,JSON.stringify(s.vehicle.translation())).toBeGreaterThanOrEqual(49);
  s.action('winch');board(s);
  drive(s,[[-20,57],[-18,74],[-18,99],[-18,124],[-18,144],[-10,158],[0,170]],true);
 }finally{s.destroy();}
});
