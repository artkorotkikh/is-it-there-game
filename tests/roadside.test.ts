import { beforeAll, afterEach, expect, it } from 'vitest';
import { Simulation, initPhysics } from '../src/game/simulation';
import { config } from '../src/game/config';
import { Level } from '../src/game/level';
import { tracks } from '../src/game/tracks';
import { cableRoute, cableShape, pathLength } from '../src/game/cable';
import { distance, mix, rotate } from '../src/game/math';
import { advance, loadAll, placePlayer } from './cargo-helpers';
const worlds:Simulation[]=[];
beforeAll(initPhysics);afterEach(()=>worlds.splice(0).forEach(sim=>sim.destroy()));
function overturned(angle:number) {
  const sim=new Simulation();worlds.push(sim);advance(sim,1);loadAll(sim);
  sim.vehicle.setRotation({x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)},true);
  sim.vehicle.setTranslation({x:0,y:5,z:3},true);sim.vehicle.setLinvel({x:0,y:0,z:0},true);sim.vehicle.setAngvel({x:0,y:0,z:0},true);
  placePlayer(sim,3.4,3);advance(sim,2);return sim;
}
for(const angle of [Math.PI/2,-Math.PI/2,Math.PI]) it(`a held kick rights a bus at ${Math.round(angle*180/Math.PI)} degrees using bounded physical movement`,()=>{
  const sim=overturned(angle),before=sim.vehicle.translation();
  expect(sim.snapshot().recovery.available).toBe(true);sim.action('interact');advance(sim,config.recovery.holdSeconds+.05,{interact:true});
  expect(sim.snapshot().recovery.kicks).toBe(1);
  let maxSpeed=0,maxHeight=0,maxRotationStep=0,last=rotate({x:0,y:1,z:0},sim.vehicle.rotation());
  for(let i=0;i<300;i++) {sim.step();const p=sim.vehicle.translation(),up=rotate({x:0,y:1,z:0},sim.vehicle.rotation());maxSpeed=Math.max(maxSpeed,sim.snapshot().vehicle.speed);maxHeight=Math.max(maxHeight,p.y-before.y);maxRotationStep=Math.max(maxRotationStep,distance(up,last));last=up;}
  const up=rotate({x:0,y:1,z:0},sim.vehicle.rotation());
  expect(up.y,JSON.stringify({up,p:sim.vehicle.translation(),maxSpeed,maxHeight})).toBeGreaterThan(.9);
  expect(maxSpeed).toBeLessThan(7);expect(maxHeight).toBeLessThan(3);expect(maxRotationStep).toBeLessThan(.2);
  expect(distance(sim.vehicle.translation(),before)).toBeLessThan(5);expect(sim.snapshot().systems.loaded).toBe(3);
});
it('kick charging cancels on release, movement and pause; sustained holding does not repeat',()=>{
  const sim=overturned(Math.PI/2);sim.action('interact');advance(sim,.4,{interact:true});expect(sim.snapshot().recovery.charge).toBeGreaterThan(.3);
  advance(sim,.1);expect(sim.snapshot().recovery.charge).toBe(0);expect(sim.snapshot().recovery.kicks).toBe(0);
  sim.action('interact');advance(sim,.3,{interact:true});advance(sim,.1,{interact:true,moveX:1});expect(sim.snapshot().recovery.charge).toBe(0);
  sim.action('interact');advance(sim,.3,{interact:true});sim.cancelInteractions();advance(sim,.7,{interact:true});expect(sim.snapshot().recovery.kicks).toBe(0);
  sim.action('interact');advance(sim,1,{interact:true});expect(sim.snapshot().recovery.kicks).toBe(1);expect(sim.snapshot().recovery.cooldown).toBeGreaterThan(2);
  advance(sim,6,{interact:true});expect(sim.snapshot().recovery.kicks).toBe(1);
});
it('a distant player cannot kick and an upright bus keeps its normal enter interaction',()=>{
  const sim=overturned(Math.PI/2);placePlayer(sim,10,3);expect(sim.snapshot().recovery.available).toBe(false);sim.action('interact');advance(sim,1,{interact:true});expect(sim.snapshot().recovery.kicks).toBe(0);
  sim.vehicle.setRotation({x:0,y:0,z:0,w:1},true);sim.vehicle.setTranslation({x:0,y:5,z:3},true);advance(sim,2);placePlayer(sim,3.1,3);
  expect(sim.snapshot().recovery.available).toBe(false);sim.action('interact');expect(sim.snapshot().player.driving).toBe(true);
});
it('a different marked tree selects a persistent endpoint and physically pulls sideways',()=>{
  const sim=new Simulation();worlds.push(sim);advance(sim,1);loadAll(sim);
  sim.vehicle.setTranslation({x:0,y:sim.level.roadHeight(24)+1.4,z:24},true);advance(sim,1);
  const mount=sim.mount();placePlayer(sim,mount.x+2,mount.z);sim.action('winch');expect(sim.snapshot().winch.phase).toBe('carried');
  const tree=sim.level.anchors.find(a=>a.id==='tree-24-1')!;placePlayer(sim,tree.x-1.6,tree.z);sim.action('interact');
  expect(sim.snapshot().winch.phase).toBe('attached');expect(sim.snapshot().winch.end.x).toBe(tree.x);const before=sim.vehicle.translation().x;
  advance(sim,4,{reel:1});expect(sim.vehicle.translation().x).toBeGreaterThan(before+1);expect(sim.snapshot().winch.end.z).toBe(tree.z);
  sim.action('winch');expect(sim.snapshot().winch.phase).toBe('stowed');
});
for(const track of tracks) it(`${track.name}: cables stay above curved shoulders even with constant world X`,()=>{
  const level=new Level(track),a={x:track.roadHalfWidth+1,y:0,z:track.centerline[1][0]},b={x:track.roadHalfWidth+1,y:0,z:track.centerline[2][0]};
  a.y=level.groundHeight(a.x,a.z)+.5;b.y=level.groundHeight(b.x,b.z)+.5;
  const route=cableRoute(a,b,level),shape=cableShape(a,b,pathLength(route)+2,level);
  for(const points of [route,shape])for(let i=1;i<points.length;i++)for(let t=0;t<=1;t+=.05){const p=mix(points[i-1],points[i],t);expect(p.y-level.groundHeight(p.x,p.z)).toBeGreaterThanOrEqual(config.winch.groundClearance-1e-5);}
  expect(Math.abs(level.centerX(a.z)-level.centerX(b.z))).toBeGreaterThan(1);
});
for(const side of [-1,1]) it(`SKILLS reverses actual yaw for steering ${side} and keeps effective forward motion`,()=>{
  const headings:number[]=[];
  for(const missing of [false,true]) {
    const sim=new Simulation();worlds.push(sim);advance(sim,1);loadAll(sim);sim.action('interact');
    if(missing)sim.canisters.eject('skills');sim.step();const start=sim.vehicle.translation().z;
    advance(sim,1.2,{moveZ:missing ? -1 : 1,moveX:side});
    expect(sim.vehicle.translation().z).toBeGreaterThan(start+1);
    headings.push(rotate({x:0,y:0,z:1},sim.vehicle.rotation()).x);
  }
  expect(headings[0]*side).toBeLessThan(-.1);expect(headings[1]*side).toBeGreaterThan(.1);
});
it('the first training bump keeps cargo at a forgiving moderate speed',()=>{
  const sim=new Simulation();worlds.push(sim);advance(sim,1);loadAll(sim);sim.action('interact');
  let peakSpeed=0;
  for(let i=0;i<1400 && !sim.snapshot().progress.ejected.winch && sim.vehicle.translation().z<17;i++) {
    const speed=sim.snapshot().vehicle.speed;peakSpeed=Math.max(peakSpeed,speed);
    advance(sim,config.physics.step,{moveZ:speed<2.2 ? .5 : 0,brake:speed>2.4});
  }
  expect(peakSpeed).toBeLessThan(2.6);expect(sim.vehicle.translation().z).toBeGreaterThanOrEqual(17);expect(sim.canisters.loadedCount()).toBe(3);
});
