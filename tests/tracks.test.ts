import { afterEach, beforeAll, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { initPhysics, Simulation } from '../src/game/simulation';
import { Level } from '../src/game/level';
import { tracks } from '../src/game/tracks';
import { cableRoute } from '../src/game/cable';
import { clamp, mix } from '../src/game/math';
import { advance, placePlayer } from './cargo-helpers';
const worlds:Simulation[]=[];
beforeAll(initPhysics);afterEach(()=>worlds.splice(0).forEach(sim=>sim.destroy()));
for(const track of tracks) {
  it(`${track.name}: terrain, shoulders and cable share the selected profile`,()=>{
    const level=new Level(track),sim=new Simulation('recovery',track);worlds.push(sim);advance(sim,1);
    for(const [z] of track.profile.slice(1,-1)) for(const offset of [-12,0,12]) {
      const x=level.centerX(z)+offset;
      const hit=sim.world.castRay(new RAPIER.Ray({x,y:40,z},{x:0,y:-1,z:0}),80,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC|RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC);
      expect(hit).not.toBeNull();expect(40-hit!.timeOfImpact).toBeCloseTo(level.groundHeight(x,z),3);
    }
    const route=cableRoute(sim.mount(),level.anchor,level);
    for(let i=1;i<route.length;i++) for(let t=.05;t<1;t+=.1) {const p=mix(route[i-1],route[i],t);expect(p.y).toBeGreaterThanOrEqual(level.groundHeight(p.x,p.z)-.001);}
    expect(level.safePlayerPosition({x:99,y:-99,z:999}).z).toBeCloseTo(level.maxZ-.6);
  });
  it(`${track.name}: the winch actually pulls the bus up its own recovery slope`,()=>{
    const sim=new Simulation('recovery',track);worlds.push(sim);advance(sim,1);
    const pos=sim.vehicle.translation();placePlayer(sim,pos.x+2.6,pos.z+2.8);sim.action('winch');expect(sim.snapshot().winch.phase).toBe('carried');
    const anchor=sim.level.anchor;placePlayer(sim,anchor.x,anchor.z-2);sim.action('interact');expect(sim.snapshot().winch.phase).toBe('attached');
    advance(sim,19,{reel:1});expect(sim.snapshot().progress.recovered).toBe(true);expect(sim.vehicle.translation().z).toBeGreaterThan(track.recoveredZ);
    expect(sim.snapshot().trackId).toBe(track.id);
    sim.action('winch'); const p=sim.vehicle.translation();placePlayer(sim,p.x+3.1,p.z);sim.action('interact');expect(sim.snapshot().player.driving).toBe(true);
    for(let i=0;i<2500 && !sim.snapshot().progress.ejected.winch;i++) {
      const state=sim.snapshot(), q=state.vehicle.rotation;
      const heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.x*q.x));
      const desired=Math.atan2(-state.vehicle.position.x,12);
      sim.step({moveX:clamp((heading-desired)*3,-1,1),moveZ:1,yaw:0,sprint:false,brake:false,reel:0,interact:false});
    }
    expect(sim.snapshot().progress.ejected.winch,JSON.stringify(sim.vehicle.translation())).toBe(true);
    advance(sim,4,{brake:true});
    const q=sim.vehicle.rotation();expect(1-2*(q.x*q.x+q.z*q.z),'Bus must stay upright after braking at the cargo bump').toBeGreaterThan(.6);
  });
}
for(const track of tracks.slice(1)) it(`${track.name}: the harder recovery slope still needs its winch`,()=>{
  const sim=new Simulation('recovery',track);worlds.push(sim);advance(sim,2);sim.action('interact');
  expect(sim.snapshot().player.driving).toBe(true);advance(sim,18,{moveZ:1});
  expect(sim.snapshot().progress.recovered).toBe(false);expect(sim.vehicle.translation().z).toBeLessThan(track.recoveredZ);
});
it('Relay ridge roadblocks have real collision surfaces matching their visible dimensions',()=>{
  const track=tracks[1],sim=new Simulation('recovery',track);worlds.push(sim);advance(sim,.1);
  for(const block of track.obstacles){
    const ray=new RAPIER.Ray({x:sim.level.centerX(block.z)+block.x,y:sim.level.roadHeight(block.z)+.5,z:block.z-5},{x:0,y:0,z:1});
    const hit=sim.world.castRay(ray,10,true);expect(hit).not.toBeNull();expect(hit!.timeOfImpact).toBeCloseTo(5-block.depth/2,3);
  }
});
it('concurrent track simulations do not overwrite each other’s terrain or anchors',()=>{
  const first=new Simulation('road',tracks[0]),third=new Simulation('road',tracks[2]);worlds.push(first,third);
  advance(first,2);advance(third,2);expect(first.level.anchor.z).toBe(60);expect(third.level.anchor.z).toBe(73);
  expect(first.level.roadHeight(190)).not.toBe(third.level.roadHeight(190));expect(first.snapshot().trackId).toBe('old-road');
});
for(const track of tracks.slice(1)) it(`${track.name}: a fast first-bump hit can release WINCH`,async()=>{
  const {loadAll}=await import('./cargo-helpers');const sim=new Simulation('road',track);worlds.push(sim);advance(sim,1);loadAll(sim);sim.action('interact');
  let peak=0;for(let i=0;i<1000 && sim.vehicle.translation().z<track.bumps[0]+5;i++) {sim.step({moveX:0,moveZ:1,yaw:0,sprint:false,brake:false,reel:0,interact:false});peak=Math.max(peak,sim.snapshot().vehicle.shock);}
  expect(sim.snapshot().progress.ejected.winch,JSON.stringify({peak,z:sim.vehicle.translation().z})).toBe(true);
});
