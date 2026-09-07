import {beforeAll,expect,it} from 'vitest';
import {initPhysics,Simulation} from '../src/game/simulation';
import {mapTrack} from '../src/game/maps/catalog';
import {parseMap} from '../src/game/maps/schema';
import rawMap from '../src/game/maps/data/forest-crossing.json';
import {config} from '../src/game/config';
import {cableRoute,pathLength} from '../src/game/cable';
import {rotate} from '../src/game/math';
import {neutralInput} from '../src/game/types';
import {advance,placePlayer} from './cargo-helpers';

beforeAll(initPhysics);
function walk(s:Simulation,x:number,z:number){
  for(let tick=0;tick<1800;tick++){
    const p=s.player.translation(),dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);
    if(d<.2)return;
    s.step({...neutralInput(),moveX:-dx/Math.max(1,d),moveZ:dz/Math.max(1,d)});
  }
  throw new Error(`Cable carrier could not reach ${x}, ${z}: ${JSON.stringify(s.player.translation())}`);
}
for(const {name,x,z,anchor,exit} of [
  {name:'left hollow',x:-18,z:98,anchor:'anchor-left-1-east',exit:106},
  {name:'center hollow',x:0,z:112,anchor:'anchor-center-1-east',exit:120},
  {name:'right hollow',x:18,z:124,anchor:'anchor-right-1-west',exit:132},
  {name:'left hillside',x:-20,z:36,anchor:'anchor-3',exit:49},
])it(`${name}: an uphill tree is reachable and its winch physically recovers the bus`,()=>{
  const s=new Simulation('road',mapTrack(parseMap(rawMap)));
  try{
    s.vehicle.setTranslation({x,z,y:s.level.groundHeight(x,z)+1.4},true);advance(s,1);
    const before=s.vehicle.translation(),tree=s.level.anchors.find(a=>a.id===anchor)!;
    expect(tree.y).toBeGreaterThan(before.y+1);
    expect(pathLength(cableRoute(s.mount(),tree,s.level))).toBeLessThan(config.winch.maxLength-2);
    const mount=s.mount();placePlayer(s,mount.x+1.7,mount.z);s.action('winch');expect(s.snapshot().winch.phase,s.message).toBe('carried');
    walk(s,tree.x,tree.z-1.8);s.action('interact');expect(s.snapshot().winch.phase,s.message).toBe('attached');
    for(let tick=0;tick<2400&&s.vehicle.translation().z<exit;tick++)s.step({...neutralInput(),reel:1});
    const end=s.snapshot(),detail=JSON.stringify({position:end.vehicle.position,loaded:end.systems.loaded,winch:end.winch});
    expect(end.vehicle.position.z,detail).toBeGreaterThanOrEqual(exit);
    expect(end.vehicle.position.y,detail).toBeGreaterThan(before.y+1);
    expect(rotate({x:0,y:1,z:0},end.vehicle.rotation).y,detail).toBeGreaterThan(.6);
    expect(end.systems.loaded).toBe(3);
  }finally{s.destroy();}
});

for(const side of ['west','east'])it(`central gap: the ${side} bank tree retrieves a bus driven off the unbridged edge`,()=>{
  const s=new Simulation('road',mapTrack(parseMap(rawMap)));
  try{
    s.vehicle.setTranslation({x:0,z:35,y:s.level.groundHeight(0,35)+1.45},true);advance(s,1);
    placePlayer(s,-2.3,36);s.action('interact');expect(s.snapshot().player.driving).toBe(true);
    for(let tick=0;tick<900;tick++){const speed=s.snapshot().vehicle.speed;s.step({...neutralInput(),moveZ:speed<1.5?1:0,brake:speed>1.8});}
    const before=s.vehicle.translation();expect(before.z).toBeLessThan(43);expect(before.z).toBeGreaterThan(38);
    // Reach the hanging fairlead from the bank rather than the deep pit floor.
    s.action('interact');const mount=s.mount();placePlayer(s,mount.x+1.7,40.9);s.action('winch');expect(s.snapshot().winch.phase,JSON.stringify({message:s.message,mount,player:s.player.translation()})).toBe('carried');
    const tree=s.level.anchors.find(a=>a.id===`anchor-gap-${side}`)!;walk(s,mount.x+1.7,35);walk(s,tree.x,tree.z-1.8);s.action('interact');expect(s.snapshot().winch.phase,s.message).toBe('attached');
    // Pull back onto the departure bank; the far bank presents a vertical wall.
    for(let tick=0;tick<2400&&s.vehicle.translation().z>38;tick++)s.step({...neutralInput(),reel:1});
    const end=s.snapshot();expect(end.vehicle.position.z,JSON.stringify(end.vehicle.position)).toBeLessThanOrEqual(38);
    expect(end.vehicle.position.y).toBeGreaterThan(3.3);expect(rotate({x:0,y:1,z:0},end.vehicle.rotation).y).toBeGreaterThan(.8);expect(end.systems.loaded).toBe(3);
  }finally{s.destroy();}
});
