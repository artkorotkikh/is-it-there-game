import { afterEach, beforeAll, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import rawMap from '../src/game/maps/data/forest-crossing.json';
import { parseMap } from '../src/game/maps/schema';
import { mapTrack } from '../src/game/maps/catalog';
import { initPhysics, Simulation } from '../src/game/simulation';
import { neutralInput } from '../src/game/types';
import { advance, placePlayer } from './cargo-helpers';
import { config } from '../src/game/config';

const worlds:Simulation[]=[];beforeAll(initPhysics);afterEach(()=>worlds.splice(0).forEach(s=>s.destroy()));
function create(){const s=new Simulation('road',mapTrack(parseMap(rawMap)));worlds.push(s);advance(s,1);return s;}
function pick(s:Simulation,id:string){const item=s.fieldKit!.items.find(i=>i.id===id)!;placePlayer(s,item.position.x,item.position.z-1);s.action('interact');expect(s.fieldKit!.carried()?.id,s.message).toBe(id);}
function lay(s:Simulation,id:string,x:number,z:number){pick(s,id);placePlayer(s,x,z-config.fieldKit.placementReach);expect(s.fieldKit!.preview(s.player.translation(),0)?.valid,s.fieldKit!.preview(s.player.translation(),0)?.reason).toBe(true);s.action('interact');expect(s.fieldKit!.items.find(i=>i.id===id)!.phase,s.message).toBe('placed');advance(s,.1);}
it('pickup, rotation, placement and pickup again retain one identity',()=>{
  const s=create();pick(s,'plank-1');expect(s.fieldKit!.items.find(i=>i.id==='plank-1')!.collider.isEnabled()).toBe(false);
  placePlayer(s,0,20);const before=s.snapshot().fieldKit!.preview!.rotation;advance(s,.5,{reel:1});expect(s.snapshot().fieldKit!.preview!.rotation).not.toEqual(before);
  s.action('interact');const item=s.fieldKit!.items.find(i=>i.id==='plank-1')!;expect(item.phase,s.message).toBe('placed');expect(item.collider.isEnabled()).toBe(true);advance(s,.1);
  placePlayer(s,item.position.x,item.position.z-1);s.action('interact');expect(s.fieldKit!.carried()?.id).toBe('plank-1');
});
it('invalid terrain and occupied placements keep the carried item',()=>{
  const s=create();pick(s,'plank-1');placePlayer(s,0,39.5-config.fieldKit.placementReach);
  expect(s.snapshot().fieldKit!.preview!.valid).toBe(false);s.action('interact');expect(s.fieldKit!.carried()?.id).toBe('plank-1');
  placePlayer(s,0,3-config.fieldKit.placementReach);expect(s.snapshot().fieldKit!.preview!.valid).toBe(false);
});
it('a plank creates a real wheel support across the deep center gap',()=>{
  const s=create();lay(s,'plank-1',1.04,43.5);
  const ray=new RAPIER.Ray({x:1.04,y:12,z:43.5},{x:0,y:-1,z:0});
  const hit=s.world.castRay(ray,20,true);expect(hit).not.toBeNull();expect(12-hit!.timeOfImpact).toBeGreaterThan(3);
  expect(s.level.groundHeight(1.04,43.5)).toBe(-1);
});
it('the bridge can be placed across a broad bank approach with small rotation errors',()=>{
  // A metre of walking tolerance, at both wheel tracks and +/- 7 degrees.
  // Each case places a real collider from the near bank using the normal action.
  for(const x of [-1.04,1.04])for(const z of [39.1,39.6,40.1])for(const yaw of [-.12,0,.12]){
    const s=create();pick(s,'plank-1');placePlayer(s,x,z);advance(s,.1,{yaw});
    const preview=s.snapshot().fieldKit!.preview!;
    expect(preview.valid,`${x}, ${z}, ${yaw}: ${preview.reason}`).toBe(true);
    s.action('interact');expect(s.fieldKit!.items.find(i=>i.id==='plank-1')!.phase,s.message).toBe('placed');
    advance(s,.1);
    const ray=new RAPIER.Ray({x:preview.position.x,y:12,z:43.5},{x:0,y:-1,z:0});
    const hit=s.world.castRay(ray,20,true);expect(hit).not.toBeNull();
    expect(12-hit!.timeOfImpact).toBeGreaterThan(3);
  }
});
it('a bus can cross on two placed planks but cannot cross the unsupported gap',()=>{
  function crossing(withPlanks:boolean){
    const s=create();if(withPlanks){lay(s,'plank-1',1.04,43.5);lay(s,'plank-2',-1.04,43.5);}
    s.vehicle.setTranslation({x:0,y:s.level.groundHeight(0,35)+1.45,z:35},true);s.vehicle.setLinvel({x:0,y:0,z:0},true);advance(s,1);
    // Approach ahead of the supply pile so E selects the bus, not a spare plank.
    placePlayer(s,-2.3,36);s.action('interact');expect(s.snapshot().player.driving,s.message).toBe(true);advance(s,.1);
    let lowest=99;
    for(let i=0;i<1800&&s.vehicle.translation().z<51;i++){const speed=s.snapshot().vehicle.speed;s.step({...neutralInput(),moveZ:speed<1.8?1:0,brake:speed>2});if(s.vehicle.translation().z>42)lowest=Math.min(lowest,s.vehicle.translation().y);}
    return {z:s.vehicle.translation().z,lowest};
  }
  const supported=crossing(true),bare=crossing(false);
  expect(supported.z,JSON.stringify(supported)).toBeGreaterThan(50);expect(supported.lowest).toBeGreaterThan(3.5);
  expect(bare.z,JSON.stringify(bare)).toBeLessThan(43);
});
it('load-bearing planks cannot disappear below raycast wheels',()=>{
  const s=create();lay(s,'plank-1',1.04,43.5);
  s.vehicle.setTranslation({x:0,y:4.7,z:43.5},true);advance(s,.1);placePlayer(s,1.04,40.7);
  for(let i=0;i<10&&s.snapshot().interaction.target?.id!=='resource:plank-1';i++)s.action('cycleTarget');
  expect(s.snapshot().interaction.target?.id).toBe('resource:plank-1');s.action('interact');
  expect(s.fieldKit!.items.find(i=>i.id==='plank-1')!.phase).toBe('placed');expect(s.message).toContain('in use');
});
it('pushing moves the bus, respects the brake and stops on neutral input',()=>{
  const s=create();placePlayer(s,0,-.05);const start=s.vehicle.translation().z;advance(s,1,{push:true});expect(s.vehicle.translation().z).toBeGreaterThan(start+.12);
  s.action('park');placePlayer(s,0,s.vehicle.translation().z-3);const parked=s.vehicle.translation().z;advance(s,1,{push:true});expect(Math.abs(s.vehicle.translation().z-parked)).toBeLessThan(.12);
  advance(s,.1);expect(s.snapshot().fieldKit!.pushing).toBe(false);
});
it('a shared marker expires on simulation time',()=>{const s=create();s.action('ping');expect(s.snapshot().fieldKit!.ping).not.toBeNull();advance(s,5.1);expect(s.snapshot().fieldKit!.ping).toBeNull();});
it('a placed stone supports a ramp and cannot be removed until the plank is lifted',()=>{
 const map=parseMap(structuredClone(rawMap));map.terrain.heights.fill(3);const s=new Simulation('road',mapTrack(map));worlds.push(s);advance(s,1);
 const stoneZ=26-(config.fieldKit.plank.length/2-config.fieldKit.supportInset);
 lay(s,'stone-1',0,stoneZ);lay(s,'plank-1',0,26);
 const plank=s.fieldKit!.items.find(i=>i.id==='plank-1')!;expect(plank.supports).toContain('stone-1');
 placePlayer(s,0,stoneZ-1.56);expect(s.fieldKit!.nearest(s.player.translation())?.id).toBe('stone-1');
 // A free plank now wins the default selection; explicitly choose its blocked support.
 for(let i=0;i<10&&s.snapshot().interaction.target?.id!=='resource:stone-1';i++)s.action('cycleTarget');
 expect(s.snapshot().interaction.target?.id).toBe('resource:stone-1');s.action('interact');expect(s.fieldKit!.items.find(i=>i.id==='stone-1')!.phase).toBe('placed');expect(s.message).toContain('in use');
});
