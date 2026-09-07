import { beforeAll, afterEach, it, expect } from 'vitest';
import { initPhysics, Simulation } from '../src/game/simulation';
import { tracks, type Track } from '../src/game/tracks';
import { config } from '../src/game/config';
import { neutralInput } from '../src/game/types';
import { distance, rotate } from '../src/game/math';
import { advance, placePlayer } from './cargo-helpers';
import { Level } from '../src/game/level';

const worlds: Simulation[]=[];
beforeAll(initPhysics);afterEach(()=>worlds.splice(0).forEach(sim=>sim.destroy()));
// Only the approach is placed: roll, landing and recovery must all come from physics.
function crossing(track: Track, offset: number, speed: number, bypass = false) {
  const sim = new Simulation('recovery',track);worlds.push(sim);
  const rock=sim.level.rolloverRockPosition(),x=sim.level.centerX(rock.z)+offset,z=rock.z-6;
  sim.vehicle.setTranslation({x,y:sim.level.groundHeight(x,z)+1.45,z},true);
  advance(sim,2);const parked=sim.vehicle.translation();placePlayer(sim,parked.x-3.05,parked.z);sim.action('interact');expect(sim.snapshot().player.driving).toBe(true);
  sim.vehicle.setLinvel({x:0,y:0,z:speed},true);
  let minUp=1,maxY=0,maxSpeed=0,maxBank=0;
  for(let i=0;i<420;i++) {
    const s=sim.snapshot();
    if (bypass && s.vehicle.position.z > rock.z + config.rolloverRock.length/2 + config.vehicle.halfLength) break;
    const up=rotate({x:0,y:1,z:0},s.vehicle.rotation).y;
    sim.step({...neutralInput(),moveZ:s.systems.driveInputArmed&&s.vehicle.speed<speed&&up>.4 ? 1 : 0,brake:up<.4||s.vehicle.position.z>rock.z+6});
    minUp=Math.min(minUp,up);maxY=Math.max(maxY,s.vehicle.position.y-rock.y);maxSpeed=Math.max(maxSpeed,s.vehicle.speed);
    maxBank=Math.max(maxBank,Math.abs(rotate({x:1,y:0,z:0},s.vehicle.rotation).y));
  }
  return {sim,minUp,maxY,maxSpeed,maxBank};
}
for (const track of tracks) {
  it(`${track.name}: stone occupies only the edge of a flat straight with a wide bypass`,()=>{
    const level=new Level(track),rock=level.rolloverRockPosition();
    for(const dz of [-3,0,3]) {
      expect(level.centerX(rock.z+dz)).toBe(level.centerX(rock.z));
      expect(level.roadHeight(rock.z+dz)).toBe(rock.y);
    }
    const innerEdge=rock.x-level.centerX(rock.z)-config.rolloverRock.width/2;
    expect(innerEdge-config.vehicle.halfWidth).toBeGreaterThan(1.5);
    expect(config.rolloverRock.roadOffset+config.rolloverRock.width/2).toBeLessThan(track.roadHalfWidth);
  });
  for(const speed of [4,8])for(const tolerance of [-.18,.18])it(`${track.name}: one side at ${speed} m/s / offset ${tolerance} rolls and can be kicked upright`,()=>{
    const {sim,minUp,maxY,maxSpeed}=crossing(track,config.rolloverRock.roadOffset-config.vehicle.wheelX+tolerance,speed);
    expect(minUp).toBeLessThan(.15);expect(rotate({x:0,y:1,z:0},sim.vehicle.rotation()).y).toBeLessThan(.2);
    expect(maxY).toBeLessThan(3);expect(maxSpeed).toBeLessThan(15);
    sim.action('interact');advance(sim,.2);
    expect(sim.snapshot().player.driving).toBe(false);expect(sim.snapshot().recovery.available).toBe(true);
    const beforeKick=sim.snapshot();
    sim.action('interact');advance(sim,config.recovery.holdSeconds+.05,{interact:true});
    let kickSpeed=0,kickRise=0;
    for(let i=0;i<240;i++) { sim.step();kickSpeed=Math.max(kickSpeed,sim.snapshot().vehicle.speed);kickRise=Math.max(kickRise,sim.vehicle.translation().y-beforeKick.vehicle.position.y); }
    expect(kickSpeed).toBeLessThan(7);expect(kickRise).toBeLessThan(3);
    expect(distance(sim.vehicle.translation(),beforeKick.vehicle.position)).toBeLessThan(5);
    expect(sim.snapshot().recovery.kicks).toBe(1);
    expect(rotate({x:0,y:1,z:0},sim.vehicle.rotation()).y,JSON.stringify({before:{p:beforeKick.vehicle.position,q:beforeKick.vehicle.rotation,player:beforeKick.player.position},after:{p:sim.vehicle.translation(),q:sim.vehicle.rotation(),player:sim.player.translation()}})).toBeGreaterThan(.85);
  });
  for(const offset of [0,1.2])it(`${track.name}: the open lane at X=${offset} passes upright at full speed`,()=>{
    const {sim,minUp,maxBank}=crossing(track,offset,config.vehicle.maxSpeed,true);
    expect(minUp).toBeGreaterThan(.7);expect(maxBank).toBeLessThan(.08);
    expect(sim.vehicle.translation().z).toBeGreaterThan(track.rolloverRockZ+config.rolloverRock.length/2+config.vehicle.halfLength);
  });
}
