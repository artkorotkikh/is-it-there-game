import { afterEach, beforeAll, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import rawMap from '../src/game/maps/data/forest-crossing.json';
import { parseMap } from '../src/game/maps/schema';
import { mapTrack } from '../src/game/maps/catalog';
import { initPhysics, Simulation } from '../src/game/simulation';
import { cableRoute } from '../src/game/cable';
import { mix } from '../src/game/math';
import { advance } from './cargo-helpers';

const worlds:Simulation[]=[];beforeAll(initPhysics);afterEach(()=>worlds.splice(0).forEach(s=>s.destroy()));
const create=()=>{const s=new Simulation('road',mapTrack(parseMap(rawMap)));worlds.push(s);advance(s,.1);return s;};
it('map data validates and reserves existing solo identities',()=>{
  expect(parseMap(rawMap).id).toBe('forest-crossing');
  for(const edit of [{id:'old-road'},{schemaVersion:2},{script:'alert(1)'},{id:'../bad'}])expect(()=>parseMap({...rawMap,...edit})).toThrow();
  expect(()=>parseMap({...rawMap,terrain:{...rawMap.terrain,heights:[1,2]}})).toThrow();
  expect(()=>parseMap({...rawMap,resources:[...rawMap.resources,rawMap.resources[0]]})).toThrow();
  expect(()=>parseMap({...rawMap,spawn:{...rawMap.spawn,vehicle:{x:500,z:3,yaw:0}}})).toThrow();
});
it('height sampling agrees with actual collision triangles in all three approaches',()=>{
  const s=create();
  for(const x of [-22.3,-16.7,-7.1,.23,5.7,13.2,20.4,28.1])for(const z of [18.34,35.71,41.36,43.62,46.41,62.34,78.81,96.32,112.67,124.3,145.1,169.4]){
    const hit=s.world.castRay(new RAPIER.Ray({x,y:89,z},{x:0,y:-1,z:0}),100,true,undefined,undefined,undefined,undefined,c=>c.shape.type===RAPIER.ShapeType.TriMesh);
    expect(hit).not.toBeNull();expect(89-hit!.timeOfImpact).toBeCloseTo(s.level.groundHeight(x,z),3);
  }
  expect(s.level.groundHeight(0,44)).toBeLessThan(s.level.groundHeight(18,44)-4);
});
it('cable routing includes heightfield diagonal edges and clears slopes',()=>{
  const s=create();
  for(const [start,end] of [[{x:-21,y:2.5,z:32},{x:-9,y:10,z:54}],[{x:1,y:4,z:38},{x:10,y:6,z:54}],[{x:-20,y:5,z:44},{x:20,y:7,z:44}]] as const){
    const from={...start,y:Math.max(start.y,s.level.groundHeight(start.x,start.z)+.5)},to={...end,y:Math.max(end.y,s.level.groundHeight(end.x,end.z)+.5)};
    const route=cableRoute(from,to,s.level);expect(route.length).toBeGreaterThanOrEqual(2);
    for(let i=1;i<route.length;i++)for(let t=.02;t<1;t+=.03){const p=mix(route[i-1],route[i],t);expect(p.y).toBeGreaterThanOrEqual(s.level.groundHeight(p.x,p.z)-.01);}
  }
});
it('map reset restores supplies and preserves independent solo terrain',()=>{
  const s=create(),solo=new Simulation();worlds.push(solo);
  expect(s.canisters.loadedCount()).toBe(3);expect(s.fieldKit!.items).toHaveLength(rawMap.resources.length);
  expect(s.level.contains(-31,30,2)).toBe(false);expect(s.level.contains(-20,30,2)).toBe(true);
  expect(solo.snapshot().trackId).toBe('old-road');expect(solo.fieldKit).toBeUndefined();expect(solo.level.roadHeight(44)).toBe(.09);
});
